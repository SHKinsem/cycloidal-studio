# -*- coding: utf-8 -*-
"""
进阶层: 更丰富的谐波参数化 + 完整目标集(压力角/可加工性/平滑度/鲁棒性) + NSGA-II 帕累托前沿。
复用 CycloidalModAnalysis.py 的已验证物理 (mesh_state/play_range/windup), 不改动核心。

参数化(双向对称, 余弦级数, 天然带限=平滑):
    δ(θ) = offset + Σ_{k=1}^{K} c_k · cos(k·N·θ)     沿齿廓法向, δ<0 去料
    p = [offset, c1, c2, ..., cK]   (K=2 时退化为原 harmonic 的 s1,s2)
"""
import numpy as np
import model as m

Rb, Rr, E, N, M, Np = m.Rb, m.Rr, m.E, m.N, m.M, m.Np
TH, TOL, ROT = m.TH, m.TOL_BUDGET, m.ROT_SIGN
PSI = m.PSI_SAMPLES
arcmin = 180/np.pi*60

TOOL_RADIUS = 0.10   # 加工刀具/线径半径 [mm] (线切割~0.1); 齿廓凹处曲率半径须 >= 此值

def _profile_th(nPts):
    return TH if nPts is None else np.linspace(0, 2*np.pi, nPts, endpoint=False)

def profile_coeffs(offset, coeffs, nPts=None):
    """余弦级数修型齿廓 (盘坐标系), 复用基础几何。coeffs=[c1..cK]。"""
    th = _profile_th(nPts)
    xc = Rb*np.cos(th) + E*np.cos(M*th)
    yc = Rb*np.sin(th) + E*np.sin(M*th)
    dx = -Rb*np.sin(th) - E*M*np.sin(M*th)
    dy =  Rb*np.cos(th) + E*M*np.cos(M*th)
    nn = np.hypot(dx, dy); nx, ny = dy/nn, -dx/nn
    d = np.full_like(th, offset)
    for k, ck in enumerate(coeffs, start=1):
        d = d + ck*np.cos(k*N*th)
    return xc + (d - Rr)*nx, yc + (d - Rr)*ny

def delta_max_coeffs(offset, coeffs):
    """δ(θ) 的真实最大值(最少去料处), 网格采样(K>2 无简单闭式)。"""
    th = np.linspace(0, 2*np.pi/N, 400, endpoint=False)  # 一个齿周期足够(周期性)
    d = np.full_like(th, offset)
    for k, ck in enumerate(coeffs, start=1):
        d = d + ck*np.cos(k*N*th)
    return float(d.max())

def curvature_metrics(X, Y):
    """齿廓曲率: 返回 (最小曲率半径[mm], 最小凹曲率半径[mm], 曲率总变差[1/mm])。
    凹处半径 < 刀具半径 => 不可加工; 曲率总变差大 => 齿廓抖/不平滑。"""
    # θ 均匀采样, 用周期性中心差分
    Xp, Yp = np.gradient(X), np.gradient(Y)
    Xpp, Ypp = np.gradient(Xp), np.gradient(Yp)
    speed2 = Xp*Xp + Yp*Yp
    cross = Xp*Ypp - Yp*Xpp
    kappa = cross / np.power(speed2, 1.5)      # 带符号曲率
    R = 1.0/np.maximum(np.abs(kappa), 1e-9)    # 曲率半径
    min_R = float(R.min())
    # 凹: 曲率使齿廓向材料内弯 = 齿谷。摆线盘外轮廓凸为主, 凹处 = 齿根/齿谷。
    # 相对盘心的外法向; 凹 = 曲率中心在轮廓外侧 => 用 kappa 符号相对轮廓走向判断。
    # 简化: 齿谷处 kappa 符号与主体相反, 取符号少数侧为凹。
    sign = np.sign(np.median(kappa[kappa != 0]))
    concave = kappa*sign < 0
    min_concave_R = float(R[concave].min()) if concave.any() else np.inf
    ds = np.hypot(Xp, Yp)
    curv_tv = float(np.sum(np.abs(np.gradient(kappa))) )  # 曲率总变差(平滑度, 越小越平滑)
    return min_R, min_concave_R, curv_tv

def _mesh_full(X, Y, psi):
    """同 m.mesh_state, 但额外返回接触点(压力角需要)。返回 gaps,arms,uu,cpx,cpy,cx,cy。"""
    n = len(X)
    cx, cy = -E*np.cos(psi), -E*np.sin(psi)
    a = ROT*psi/N; co, si = np.cos(a), np.sin(a)
    wx = co*X - si*Y + cx; wy = si*X + co*Y + cy
    gaps = np.empty(Np); arms = np.empty(Np); uu = np.empty(Np)
    cpx = np.empty(Np); cpy = np.empty(Np); tp = 2*np.pi/N
    for j in range(Np):
        px, py = m.PIN_XY[j]
        d = np.hypot(wx-px, wy-py); i = int(d.argmin())
        gaps[j] = d[i] - Rr
        nxj, nyj = (px-wx[i])/d[i], (py-wy[i])/d[i]
        arms[j] = (wx[i]-cx)*nyj - (wy[i]-cy)*nxj
        uu[j] = ((2*np.pi*i/n) % tp)/tp        # 角度按当前网格长度算, 兼容降精度
        cpx[j], cpy[j] = wx[i], wy[i]
    return gaps, arms, uu, cpx, cpy, cx, cy

def _pressure_angles(cpx, cpy, F):
    """受载接触点的压力角[deg] 与其接触力, 返回 (angles[], forces[])。
    压力角 = 传力法向 与 针齿节圆切向 的夹角。低=高效传扭, 高=径向浪费/自锁风险。"""
    angs, fs = [], []
    for j in range(Np):
        if F[j] <= 0:
            continue
        px, py = m.PIN_XY[j]
        nx, ny = px-cpx[j], py-cpy[j]
        nrm = np.hypot(nx, ny)
        if nrm < 1e-9:
            continue
        nx, ny = nx/nrm, ny/nrm
        phi = np.arctan2(py, px)               # 针齿相对针轮中心 O 的角
        tx, ty = -np.sin(phi), np.cos(phi)     # 节圆切向
        c = abs(nx*tx + ny*ty)
        angs.append(np.degrees(np.arccos(np.clip(c, 0.0, 1.0)))); fs.append(F[j])
    return angs, fs

def evaluate_design(offset, coeffs, nps=None, nPts=None):
    """完整评估: 复用 windup/play_range + 新指标(压力角/可加工性/平滑度)。返回 dict。
    nps/nPts 可降精度加速优化(默认全精度: 48曲柄角 × 8000点), 最终解再全精度复核。"""
    X, Y = profile_coeffs(offset, coeffs, nPts)
    psis = PSI if nps is None else np.linspace(0, 2*np.pi/N, nps, endpoint=False)
    plays, margins, ks, bs, nes = [], [], [], [], []
    ang_all, f_all = [], []
    for psi in psis:
        gaps, arms, uu, cpx, cpy, cx, cy = _mesh_full(X, Y, psi)
        lo, hi = m.play_range(gaps, arms); plays.append(hi-lo)
        tlo, thi = m.play_range(gaps, arms, TOL); margins.append(thi-tlo)
        b, k, ne, F = m.windup(gaps, arms); ks.append(k); bs.append(b); nes.append(ne)
        a_, f_ = _pressure_angles(cpx, cpy, F); ang_all += a_; f_all += f_
    min_R, min_concave_R, curv_tv = curvature_metrics(X, Y)
    ang = np.array(ang_all) if ang_all else np.array([np.nan])
    fw  = np.array(f_all) if f_all else np.array([1.0])
    fmax = fw.max() if fw.size else 1.0
    sig = fw >= 0.10*fmax                          # 只看承载>10%峰值力的接触(忽略边缘微载)
    return dict(
        backlash = float(np.max(plays))*arcmin,
        stiff    = float(np.min(ks))/1e3/arcmin,
        ripple   = float(np.max(bs)-np.min(bs))*1e6,
        margin   = float(np.min(margins))*arcmin,
        n_eng    = int(np.min(nes)),
        max_pressure_angle = float(np.max(ang[sig])) if sig.any() else float(np.nanmax(ang)),  # 显著承载接触的最大压力角
        fw_pressure_angle  = float(np.sum(ang*fw)/np.sum(fw)),   # 力加权平均(效率代理)
        min_curv_radius    = min_concave_R,       # 可加工性: 凹处最小曲率半径 [mm]
        smoothness_tv      = curv_tv,             # 平滑度: 曲率总变差 (越小越平滑)
        delta_max          = delta_max_coeffs(offset, coeffs),
    )

def evaluate_robust(offset, coeffs, err=None, nps=None, nPts=None):
    """鲁棒性: 在 ±机加工误差(系统性等距偏差)下取最差 margin / 最差 backlash。
    err 默认取公差预算的一半(代表系统性偏移分量)。"""
    if err is None:
        err = TOL/2
    nom = evaluate_design(offset, coeffs, nps, nPts)
    tight = evaluate_design(offset + err, coeffs, nps, nPts)   # 整体偏紧(最伤 margin)
    loose = evaluate_design(offset - err, coeffs, nps, nPts)   # 整体偏松(最伤 backlash)
    nom['worst_margin']   = min(nom['margin'], tight['margin'], loose['margin'])
    nom['worst_backlash'] = max(nom['backlash'], tight['backlash'], loose['backlash'])
    return nom

if __name__ == '__main__':
    # 自检: K=2 [s1,s2] 应与基础 evaluate 一致
    r_adv = evaluate_design(-0.0209, [-0.0012, -0.0037])
    r_base = m.evaluate(-0.0209, -0.0012, 'harmonic', s2=-0.0037)  # parity check
    print("[parity K=2 vs base]")
    for key in ('backlash','stiff','ripple','margin','n_eng'):
        a, b = r_adv[key], r_base[key]
        ok = abs(a-b) < (0.01 if key!='n_eng' else 0.5)
        print(f"  {key:9s} adv={a:.3f}  base={b:.3f}  {'OK' if ok else 'MISMATCH'}")
    print("\n[new metrics @ current GA optimum]")
    for key in ('max_pressure_angle','fw_pressure_angle','min_curv_radius','smoothness_tv','delta_max'):
        print(f"  {key:20s} {r_adv[key]:.4f}")
    print("\n[richer K=6 example, mild relief]")
    r6 = evaluate_robust(-0.025, [-0.002,-0.004,0.001,-0.001,0.0005,-0.0003])
    for key in ('backlash','stiff','ripple','margin','max_pressure_angle','min_curv_radius','worst_margin','worst_backlash'):
        print(f"  {key:20s} {r6[key]:.3f}")
