# -*- coding: utf-8 -*-
"""
摆线盘修型效果定量分析：啮合间隙分布 / 背隙(回差) / 接触齿数 / 扭转刚度 / 公差可行域
基于 CycloidalOptim.py 的几何 (逐齿二次径向修型)，数值法直接算每根针齿与修型齿廓的真实间隙。
运行:  python CycloidalModAnalysis.py   -> 输出 ModAnalysis_current.png / ModAnalysis_sweep.png + 终端摘要
"""
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# —— 参数 (与 CycloidalOptim.py 一致) ——
Rb, Rr, E, N = 34.0, 2.5, 1.5, 18
Np = N + 1
M  = N + 1

CUR_OFFSET, CUR_SHIFT = -0.075, 0.05   # 当前设计

T_RATED    = 30.0    # 额定扭矩 [N*m]
K_CONTACT  = 5.0e4   # 单齿接触线刚度 [N/mm]  ponytail: 线性化Hertz, 相对比较够用; 要绝对值时换Palmgren δ^(10/9)
TOL_BUDGET = 0.015   # 法向最坏公差叠加 [mm] (针孔位置+针径+齿廓加工+偏心误差)
NTH        = 8000
PSI_SAMPLES = np.linspace(0, 2*np.pi/N, 6, endpoint=False)  # 一个齿距内采样曲柄角 -> 波动(丝滑度)

TH = np.linspace(0, 2*np.pi, NTH, endpoint=False)
PIN_XY = np.stack([Rb*np.cos(2*np.pi*np.arange(Np)/Np),
                   Rb*np.sin(2*np.pi*np.arange(Np)/Np)], axis=1)

def profile(offset, shift, variant):
    """修型齿廓 (盘坐标系)。variant: 'pertooth'=Python逐齿二次 | 'sw'=导出的SolidWorks余弦 | 'none'"""
    xc = Rb*np.cos(TH) + E*np.cos(M*TH)
    yc = Rb*np.sin(TH) + E*np.sin(M*TH)
    dx = -Rb*np.sin(TH) - E*M*np.sin(M*TH)
    dy =  Rb*np.cos(TH) + E*M*np.cos(M*TH)
    nn = np.hypot(dx, dy)
    nx, ny = dy/nn, -dx/nn
    xs, ys = xc - Rr*nx, yc - Rr*ny
    tp = 2*np.pi/N
    if variant == 'pertooth':
        ph = (TH % tp) - tp/2
        d  = offset + shift*(ph/(tp/2))**2
    elif variant == 'sw':
        d  = offset + shift*(1 - np.cos(N*TH))/2
    else:
        d  = np.zeros(NTH)
    r = np.hypot(xs, ys)
    return xs + d*xs/r, ys + d*ys/r

def mesh_state(X, Y, psi, rot_sign):
    """给定曲柄角psi, 返回每根针齿的 法向间隙gap[mm], 力臂arm[mm](对盘心, 带符号), 啮合相位u[0..1]"""
    cx, cy = -E*np.cos(psi), -E*np.sin(psi)
    a = rot_sign*psi/N
    co, si = np.cos(a), np.sin(a)
    wx = co*X - si*Y + cx
    wy = si*X + co*Y + cy
    gaps = np.empty(Np); arms = np.empty(Np); uu = np.empty(Np)
    tp = 2*np.pi/N
    for j in range(Np):
        px, py = PIN_XY[j]
        d = np.hypot(wx-px, wy-py)
        i = int(d.argmin())
        gaps[j] = d[i] - Rr
        nxj, nyj = (px-wx[i])/d[i], (py-wy[i])/d[i]
        arms[j] = (wx[i]-cx)*nyj - (wy[i]-cy)*nxj   # dgap/dbeta = -arm
        uu[j]   = (TH[i] % tp)/tp                   # 接触点在单齿内的相位
    return gaps, arms, uu

def play_range(gaps, arms, tol=0.0):
    """盘可自由转动的角度区间 [lo, hi] (rad)。区间宽=角向游隙; lo>hi 表示被公差卡死(干涉)"""
    g = gaps - tol
    pos, neg = arms > 1e-9, arms < -1e-9
    hi = np.min(g[pos]/arms[pos]) if pos.any() else np.inf
    lo = np.max(g[neg]/arms[neg]) if neg.any() else -np.inf
    return lo, hi

def windup(gaps, arms):
    """额定扭矩下: 返回 (加载转角-初接触角)[rad], 切向刚度[N*mm/rad], 受载齿数, 每齿力[N]"""
    T = T_RATED*1000.0
    _, hi = play_range(gaps, arms)
    def torque(b):
        pen = np.maximum(0.0, b*arms - gaps)
        return K_CONTACT*np.sum(pen*arms)
    b1 = hi + 1e-6
    while torque(b1) < T:
        b1 = hi + 2*(b1-hi)
        if b1-hi > 0.05: return np.nan, 0.0, 0, np.zeros(Np)
    b0 = hi
    for _ in range(60):
        bm = 0.5*(b0+b1)
        if torque(bm) < T: b0 = bm
        else: b1 = bm
    b = 0.5*(b0+b1)
    F = K_CONTACT*np.maximum(0.0, b*arms - gaps)
    eng = F > 0
    return b - hi, K_CONTACT*np.sum(arms[eng]**2), int(eng.sum()), F

def evaluate(offset, shift, variant):
    """跨曲柄角聚合: 背隙(最坏)[arcmin], 刚度(最差)[N*m/arcmin], 加载转角波动[urad], 公差余量(最小)[rad], 最少受载齿数"""
    X, Y = profile(offset, shift, variant)
    plays, margins, ks, wus, nes = [], [], [], [], []
    for psi in PSI_SAMPLES:
        gaps, arms, _ = mesh_state(X, Y, psi, ROT_SIGN)
        lo, hi = play_range(gaps, arms)
        plays.append(hi-lo)
        tlo, thi = play_range(gaps, arms, TOL_BUDGET)
        margins.append(thi-tlo)
        wu, k, ne, _ = windup(gaps, arms)
        ks.append(k); wus.append(wu); nes.append(ne)
    arcmin = 180/np.pi*60
    k_min = np.min(ks)
    return dict(backlash=np.max(plays)*arcmin,
                stiff=k_min/1e3/arcmin,             # N*m / arcmin
                ripple=(np.max(wus)-np.min(wus))*1e6,
                margin=np.min(margins),
                n_eng=int(np.min(nes)))

# —— 运动学符号自检: 无修型齿廓必须与全部19针同时接触(共轭), 最大间隙≈0 ——
X0, Y0 = profile(0, 0, 'none')
ROT_SIGN = None
for s in (-1.0, 1.0):
    worst = max(np.abs(mesh_state(X0, Y0, psi, s)[0]).max() for psi in (0.0, 0.3, 1.1))
    if worst < 5e-4:
        ROT_SIGN = s
        break
assert ROT_SIGN is not None, "共轭自检失败: 检查曲线/运动学约定"
print(f"[self-check OK] unmodified profile contacts all {Np} pins (rot_sign={ROT_SIGN:+.0f})")

def _main():
    # —— 1. 当前设计: pertooth(Python/CSV几何) vs sw(SolidWorks方程几何) ——
    print("\n== 当前参数 offset=%.3f shift=%.3f 两种相位对比 ==" % (CUR_OFFSET, CUR_SHIFT))
    res = {}
    for v in ('pertooth', 'sw'):
        res[v] = evaluate(CUR_OFFSET, CUR_SHIFT, v)
        r = res[v]
        ok = "可行" if r['margin'] > 0 else "卡死!"
        print(f"  {v:8s}: 背隙={r['backlash']:.2f} arcmin  刚度={r['stiff']:.1f} N*m/arcmin  "
              f"受载齿数>={r['n_eng']}  波动={r['ripple']:.1f} urad  公差{TOL_BUDGET*1e3:.0f}um下{ok}")

    # —— 2. 参数扫描 (pertooth 几何) ——
    OFFS = np.linspace(-0.16, -0.01, 16)
    SHFS = np.linspace(0.0, 0.15, 16)
    BL = np.full((len(SHFS), len(OFFS)), np.nan)
    ST = np.full_like(BL, np.nan)
    FEAS = np.zeros_like(BL, dtype=bool)
    for iy, sh in enumerate(SHFS):
        for ix, of in enumerate(OFFS):
            r = evaluate(of, sh, 'pertooth')
            BL[iy, ix] = r['backlash']; ST[iy, ix] = r['stiff']
            FEAS[iy, ix] = r['margin'] > 0
        print(f"  扫描 {iy+1}/{len(SHFS)}", end='\r')
    print()

    # 推荐点: 可行域内先最小背隙, 同背隙(±10%)取最大刚度
    cand = np.argwhere(FEAS)
    best = None
    if len(cand):
        bl_min = BL[FEAS].min()
        pool = [(iy, ix) for iy, ix in cand if BL[iy, ix] <= bl_min*1.10]
        best = max(pool, key=lambda t: ST[t])
        b_of, b_sh = OFFS[best[1]], SHFS[best[0]]
        rb = evaluate(b_of, b_sh, 'pertooth')
        print(f"[推荐] offset={b_of:.3f}, shift={b_sh:.3f}: 背隙={rb['backlash']:.2f} arcmin, "
              f"刚度={rb['stiff']:.1f} N*m/arcmin, 受载齿数>={rb['n_eng']}, 公差余量={rb['margin']*180/np.pi*60:.2f} arcmin")

    # —— 3. 绘图 ——
    C_BLUE, C_ORANGE, C_GRAY = '#2563eb', '#ea8600', '#9aa0a6'
    fig, axes = plt.subplots(2, 2, figsize=(13, 10))
    tp = 2*np.pi/N

    # (a) 修型量曲线两相位对比
    ax = axes[0, 0]
    th2 = np.linspace(0, 2*tp, 400)
    ph = (th2 % tp) - tp/2
    ax.plot(np.rad2deg(th2), (CUR_OFFSET + CUR_SHIFT*(ph/(tp/2))**2)*1e3, color=C_BLUE, lw=2, label='Python/CSV (pertooth)')
    ax.plot(np.rad2deg(th2), (CUR_OFFSET + CUR_SHIFT*(1-np.cos(N*th2))/2)*1e3, color=C_ORANGE, lw=2, label='SolidWorks export (cos)')
    ax.axvline(np.rad2deg(tp)/2, color=C_GRAY, lw=1, ls=':')
    ax.text(np.rad2deg(tp)/2, CUR_OFFSET*1e3, ' tooth gap', color=C_GRAY, fontsize=8)
    ax.set_xlabel('theta [deg] (2 tooth pitches)'); ax.set_ylabel('delta [um]')
    ax.set_title('(a) Modification curves: phase mismatch (half pitch)')
    ax.legend(); ax.grid(alpha=0.3)

    # (b) 间隙分布 vs 啮合相位 (19针 = 19个相位采样)
    ax = axes[0, 1]
    for v, c in (('pertooth', C_BLUE), ('sw', C_ORANGE)):
        Xv, Yv = profile(CUR_OFFSET, CUR_SHIFT, v)
        gaps, arms, uu = mesh_state(Xv, Yv, 0.0, ROT_SIGN)
        o = np.argsort(uu)
        ax.plot(uu[o], gaps[o]*1e3, 'o-', color=c, ms=5, lw=1.2, label=v)
    ax.axhline(TOL_BUDGET*1e3, color=C_GRAY, ls='--', lw=1.2)
    ax.text(0.02, TOL_BUDGET*1e3, f'tolerance budget {TOL_BUDGET*1e3:.0f} um', color=C_GRAY, fontsize=8, va='bottom')
    ax.set_xlabel('contact phase within tooth (0=tip, 0.5=root)'); ax.set_ylabel('normal clearance [um]')
    ax.set_title('(b) Clearance distribution over mesh (psi=0)')
    ax.legend(); ax.grid(alpha=0.3)

    # (c) 额定扭矩下每齿受力
    ax = axes[1, 0]
    w = 0.35
    for k_, (v, c) in enumerate((('pertooth', C_BLUE), ('sw', C_ORANGE))):
        Xv, Yv = profile(CUR_OFFSET, CUR_SHIFT, v)
        gaps, arms, _ = mesh_state(Xv, Yv, 0.0, ROT_SIGN)
        _, _, _, F = windup(gaps, arms)
        ax.bar(np.arange(Np)+(k_-0.5)*w, F, w, color=c, label=v)
    ax.set_xlabel('pin index'); ax.set_ylabel(f'contact force [N] @ {T_RATED:.0f} N*m')
    ax.set_title('(c) Load sharing at rated torque')
    ax.legend(); ax.grid(alpha=0.3, axis='y')

    # (d) 摘要
    ax = axes[1, 1]; ax.axis('off')
    lines = [f"Rb={Rb} Rr={Rr} E={E} N={N}   T={T_RATED} N*m  tol={TOL_BUDGET*1e3:.0f} um", ""]
    for v in ('pertooth', 'sw'):
        r = res[v]
        lines += [f"{v}:", f"  backlash {r['backlash']:.2f} arcmin | stiffness {r['stiff']:.1f} N*m/arcmin",
                  f"  loaded teeth >= {r['n_eng']} | windup ripple {r['ripple']:.1f} urad",
                  f"  tolerance margin: {'OK' if r['margin']>0 else 'JAMMED'}", ""]
    if best is not None:
        lines += [f"RECOMMENDED (sweep): offset={b_of:.3f}, shift={b_sh:.3f}",
                  f"  backlash {rb['backlash']:.2f} arcmin | stiffness {rb['stiff']:.1f} N*m/arcmin"]
    ax.text(0.02, 0.95, "\n".join(lines), va='top', family='monospace', fontsize=10)
    fig.suptitle(f'Cycloidal modification analysis - current design (offset={CUR_OFFSET}, shift={CUR_SHIFT})')
    fig.tight_layout()
    fig.savefig('ModAnalysis_current.png', dpi=140)
    print("[OK] ModAnalysis_current.png")

    # 扫描热图
    fig2, axs = plt.subplots(1, 2, figsize=(13, 5.2))
    ext = [OFFS[0]*1e3, OFFS[-1]*1e3, SHFS[0]*1e3, SHFS[-1]*1e3]
    for ax, Z, name, cmap in ((axs[0], BL, 'Backlash [arcmin] (worst over crank)', 'viridis_r'),
                              (axs[1], ST, 'Torsional stiffness [N*m/arcmin] (worst)', 'viridis')):
        Zm = np.where(FEAS, Z, np.nan)
        im = ax.imshow(Zm, origin='lower', extent=ext, aspect='auto', cmap=cmap)
        ax.contourf(OFFS*1e3, SHFS*1e3, ~FEAS, levels=[0.5, 1.5], colors='none', hatches=['xx'])
        ax.plot(CUR_OFFSET*1e3, CUR_SHIFT*1e3, 's', color='#d93025', ms=9, mfc='none', mew=2, label='current')
        if best is not None:
            ax.plot(b_of*1e3, b_sh*1e3, '*', color='#d93025', ms=15, label='recommended')
        ax.set_xlabel('offset [um]'); ax.set_ylabel('shift [um]')
        ax.set_title(name + '\n(hatched = jams under tolerance)')
        ax.legend(loc='upper left')
        fig2.colorbar(im, ax=ax)
    fig2.suptitle('Parameter sweep (pertooth geometry), infeasible-under-tolerance masked')
    fig2.tight_layout()
    fig2.savefig('ModAnalysis_sweep.png', dpi=140)
    print("[OK] ModAnalysis_sweep.png")

if __name__ == '__main__':
    _main()
