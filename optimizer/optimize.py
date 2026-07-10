# -*- coding: utf-8 -*-
"""
NSGA-II 多目标优化 (pygad, 无新依赖): 在更丰富的 K 谐波参数化上求帕累托前沿。
设计向量 p = [offset, c1, c2, c3, c4]  (K=4)
目标(最小化): 背隙, -刚度, 传动误差波动, 最大压力角
约束(罚入支配): 鲁棒公差余量>=0.5', 凹处曲率半径>=刀具半径, 处处去料>=5um
运行: python cycloidal_nsga2.py            完整 (~2-3 min)
      $env:QUICK=1; python cycloidal_nsga2.py   冒烟
输出: pareto_front.csv, ParetoFront.png, solidworks_equations_pareto.txt, 终端最优/膝点
"""
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pygad
import objectives as a

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, "results"); os.makedirs(RESULTS, exist_ok=True)

MARGIN_MIN = 0.5
NPS_FAST, NPTS_FAST = 24, 4000     # 优化时降精度加速; 最终前沿全精度复核
K = 4
GENS = 6 if os.environ.get('QUICK') else 45
POP  = 12 if os.environ.get('QUICK') else 44
SEED = 42
GENE_SPACE = [{'low': -0.10, 'high': -0.015}] + [{'low': -0.04, 'high': 0.04}]*K

OBJ_KEYS = ('backlash', 'stiff', 'ripple', 'max_pressure_angle')
def obj_vector(r):
    """最小化向量 (背隙, -刚度, 波动, 最大压力角)。"""
    return (r['backlash'], -r['stiff'], r['ripple'], r['max_pressure_angle'])

ARCHIVE = []   # (p_tuple, robust_metrics, penalty)
def fitness_func(ga, sol, idx):
    offset = float(sol[0]); coeffs = [float(x) for x in sol[1:]]
    if a.delta_max_coeffs(offset, coeffs) > -0.005:
        return [-1e6, -1e6, -1e6, -1e6]
    r = a.evaluate_robust(offset, coeffs, nps=NPS_FAST, nPts=NPTS_FAST)
    pen = 100.0*max(0.0, MARGIN_MIN - r['worst_margin']) \
        + 100.0*max(0.0, a.TOOL_RADIUS - r['min_curv_radius'])
    ARCHIVE.append((tuple(float(x) for x in sol), r, pen))
    # pygad 最大化 => 目标取负; 约束罚从每个目标扣, 使不可行解被支配
    return [-(r['backlash']+pen), r['stiff']-pen, -(r['ripple']+pen), -(r['max_pressure_angle']+pen)]

def nondominated(objs):
    """返回非支配点下标 (objs: 最小化元组列表)。O(n^2)。"""
    n = len(objs); keep = []
    for i in range(n):
        oi = objs[i]; dom = False
        for j in range(n):
            if i == j: continue
            oj = objs[j]
            if all(oj[k] <= oi[k] for k in range(len(oi))) and any(oj[k] < oi[k] for k in range(len(oi))):
                dom = True; break
        if not dom: keep.append(i)
    return keep

def on_gen(ga):
    if ga.generations_completed % 15 == 0 or ga.generations_completed == GENS:
        print(f"  gen {ga.generations_completed:3d}/{GENS}  archive={len(ARCHIVE)}")

print(f"NSGA-II: K={K} harmonics, pop={POP}, gens={GENS}")
ga = pygad.GA(num_generations=GENS, num_parents_mating=POP//2,
              fitness_func=fitness_func, sol_per_pop=POP, num_genes=K+1,
              gene_space=GENE_SPACE, parent_selection_type="nsga2",
              crossover_type="single_point", mutation_type="random",
              mutation_percent_genes=30, random_seed=SEED,
              on_generation=on_gen, save_solutions=False, suppress_warnings=True)
ga.run()

# —— 可行解 + 全精度复核 + 帕累托前沿 ——
feas = [(p, r) for (p, r, pen) in ARCHIVE if pen < 1e-6]
print(f"\nevaluated={len(ARCHIVE)}  feasible={len(feas)}")
# 去重(量化到 0.1um)
seen = {}
for p, r in feas:
    key = tuple(round(x*1e4) for x in p)
    seen[key] = p
uniq = list(seen.values())
print(f"unique feasible designs={len(uniq)}  -> full-fidelity re-eval")
full = []
for p in uniq:
    r = a.evaluate_robust(p[0], list(p[1:]))     # 全精度
    if r['worst_margin'] >= MARGIN_MIN - 1e-6 and r['min_curv_radius'] >= a.TOOL_RADIUS:
        full.append((p, r))
objs = [obj_vector(r) for _, r in full]
front_idx = nondominated(objs)
front = [full[i] for i in front_idx]
print(f"Pareto front size (full-fidelity, feasible) = {len(front)}")

# —— 保存前沿 CSV ——
with open(os.path.join(RESULTS, "pareto_front.csv"), "w") as f:
    f.write("offset,c1,c2,c3,c4,backlash_arcmin,stiff_Nm_per_arcmin,ripple_urad,max_pressure_angle_deg,worst_margin_arcmin,min_curv_radius_mm,n_eng\n")
    for p, r in sorted(front, key=lambda t: t[1]['backlash']):
        f.write(f"{p[0]:.5f},{p[1]:.5f},{p[2]:.5f},{p[3]:.5f},{p[4]:.5f},"
                f"{r['backlash']:.3f},{r['stiff']:.2f},{r['ripple']:.2f},{r['max_pressure_angle']:.2f},"
                f"{r['worst_margin']:.3f},{r['min_curv_radius']:.3f},{r['n_eng']}\n")
print("[OK] pareto_front.csv")

# —— 膝点: 归一化后到理想点最近 (背隙/波动/压力角 min, 刚度 max) ——
if front:
    B = np.array([r['backlash'] for _, r in front])
    S = np.array([r['stiff'] for _, r in front])
    R = np.array([r['ripple'] for _, r in front])
    PA = np.array([r['max_pressure_angle'] for _, r in front])
    def nrm(x, lo=True):
        rng = x.max()-x.min() or 1
        return (x-x.min())/rng if lo else (x.max()-x)/rng
    dist = np.sqrt(nrm(B)**2 + nrm(S, lo=False)**2 + nrm(R)**2 + nrm(PA)**2)
    knee = int(np.argmin(dist))
    kp, kr = front[knee]
    print(f"\n[KNEE] offset={kp[0]:.4f} c=[{kp[1]:.4f},{kp[2]:.4f},{kp[3]:.4f},{kp[4]:.4f}]")
    print(f"  backlash={kr['backlash']:.2f}' stiff={kr['stiff']:.1f} ripple={kr['ripple']:.1f}urad "
          f"maxPA={kr['max_pressure_angle']:.1f}deg worstMargin={kr['worst_margin']:.2f}' teeth={kr['n_eng']}")

    # —— 前沿散点图: 背隙 vs 刚度, 颜色=最大压力角 ——
    fig, ax = plt.subplots(figsize=(8, 5.5))
    sc = ax.scatter(B, S, c=PA, cmap='viridis_r', s=45, edgecolor='#222', linewidth=0.5)
    ax.scatter([B[knee]], [S[knee]], s=180, facecolor='none', edgecolor='#d93025', linewidth=2, label='knee')
    fig.colorbar(sc, label='max pressure angle [deg]')
    ax.set_xlabel('backlash [arcmin]  (lower better)')
    ax.set_ylabel('torsional stiffness [N*m/arcmin]  (higher better)')
    ax.set_title(f'Pareto front — {K}-harmonic NSGA-II ({len(front)} designs)\ncolor = pressure angle; robust margin>=0.5\', manufacturable')
    ax.legend(); ax.grid(alpha=0.3)
    fig.tight_layout(); fig.savefig(os.path.join(RESULTS, "ParetoFront.png"), dpi=140)
    print("[OK] ParetoFront.png")

    # —— 膝点 SolidWorks 方程导出 (K 谐波) ——
    def sw_eq(offset, coeffs):
        Rb, Rr, E, Nn, Mm = a.Rb, a.Rr, a.E, a.N, a.M
        g = lambda x: str(round(x, 6))
        dterms = " + ".join(f"{g(c)}*cos({(k+1)*Nn}*t)" for k, c in enumerate(coeffs))
        d = f"({g(offset)} + {dterms})"
        den = f"sqrt( (-{g(Rb)}*sin(t)-{g(E)}*{Mm}*sin({Mm}*t))^2 + ({g(Rb)}*cos(t)+{g(E)}*{Mm}*cos({Mm}*t))^2 )"
        x = f"{g(Rb)}*cos(t)+{g(E)}*cos({Mm}*t) + ( {d} - {g(Rr)} )*( {g(Rb)}*cos(t)+{g(E)}*{Mm}*cos({Mm}*t) )/{den}"
        y = f"{g(Rb)}*sin(t)+{g(E)}*sin({Mm}*t) + ( {d} - {g(Rr)} )*( {g(Rb)}*sin(t)+{g(E)}*{Mm}*sin({Mm}*t) )/{den}"
        return x, y
    xeq, yeq = sw_eq(kp[0], list(kp[1:]))
    with open(os.path.join(RESULTS, "solidworks_equations_pareto.txt"), "w", encoding="utf-8") as f:
        f.write("PARETO KNEE — %d-harmonic modification, SolidWorks Equation Driven Curve\n" % K)
        f.write(f"offset={kp[0]:.5f}  c=[{kp[1]:.5f},{kp[2]:.5f},{kp[3]:.5f},{kp[4]:.5f}] mm\n")
        f.write(f"metrics: backlash={kr['backlash']:.2f}' stiff={kr['stiff']:.1f} ripple={kr['ripple']:.1f}urad "
                f"maxPA={kr['max_pressure_angle']:.1f}deg robustMargin={kr['worst_margin']:.2f}'\n\n")
        f.write("X(t):\n" + xeq + "\n\nY(t):\n" + yeq + "\n\nt: 0 .. 6.28318, points: 500\n")
    print("[OK] solidworks_equations_pareto.txt")
else:
    print("!! empty Pareto front — loosen constraints or widen GENE_SPACE")
