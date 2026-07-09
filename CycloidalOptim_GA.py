# -*- coding: utf-8 -*-
"""
GA 优化摆线盘双谐波修型 (offset, s1, s2):
    δ(θ) = offset + s1·cos(N·θ) + s2·cos(2N·θ)      [法向, δ<0 去料]
适应度 = -( 背隙[arcmin] + 0.05·波动[urad] + 0.10·max(0, 25-刚度) + 公差余量惩罚 )
运行:  python CycloidalOptim_GA.py            完整 80 代 (~2 min)
       $env:QUICK=1; python CycloidalOptim_GA.py   冒烟 5 代
"""
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pygad
import CycloidalModAnalysis as m

MARGIN_MIN = 0.5    # 公差余量下限 [arcmin], 低于此重罚
W_RIPPLE   = 0.05   # 波动权重 [1/urad]
W_STIFF    = 0.10   # 刚度不足25 N*m/arcmin 的惩罚权重
GENS       = 5 if os.environ.get('QUICK') else 80
GENE_SPACE = [{'low': -0.10, 'high': -0.015},   # offset [mm]
              {'low': -0.04, 'high':  0.04},    # s1 [mm]
              {'low': -0.04, 'high':  0.04}]    # s2 [mm]

def cost(offset, s1, s2):
    dmax = offset + abs(s1) + abs(s2)      # δ 的最大值 (最少去料处)
    if dmax > -0.005:                      # 必须处处去料>=5um, 梯度化惩罚引导GA离开
        return 1e3 + 1e5*(dmax + 0.005)
    r = m.evaluate(offset, s1, 'harmonic', s2=s2)
    pen = 100.0*max(0.0, MARGIN_MIN - r['margin'])
    return r['backlash'] + W_RIPPLE*r['ripple'] + W_STIFF*max(0.0, 25.0 - r['stiff']) + pen

def fitness_func(ga, sol, idx):
    return -cost(*sol)

def on_gen(ga):
    if ga.generations_completed % 10 == 0 or ga.generations_completed == GENS:
        print(f"  gen {ga.generations_completed:3d}/{GENS}  best cost = {-max(ga.solutions_fitness):.3f}")

ga = pygad.GA(num_generations=GENS, num_parents_mating=8,
              fitness_func=fitness_func, sol_per_pop=24, num_genes=3,
              gene_space=GENE_SPACE, parent_selection_type="rank",
              crossover_type="single_point", mutation_type="random",
              mutation_percent_genes=25, random_seed=42,
              on_generation=on_gen, save_solutions=True, suppress_warnings=True)
ga.run()
# 全局最优: 扫描所有已评估解 (ga.best_solution() 只看末代种群, 不可靠)
sols = np.array(ga.solutions)
fits = np.array(ga.solutions_fitness)
best_i = int(np.argmax(fits))
offset, s1, s2 = sols[best_i]
fit = fits[best_i]
r = m.evaluate(offset, s1, 'harmonic', s2=s2)
print(f"\n[best] offset={offset:.4f}  s1={s1:.4f}  s2={s2:.4f}  (cost={-fit:.3f})")
print(f"  backlash={r['backlash']:.2f} arcmin  stiff={r['stiff']:.1f} N*m/arcmin  "
      f"margin={r['margin']:.2f} arcmin  teeth>={r['n_eng']}  ripple={r['ripple']:.1f} urad")
assert r['margin'] >= MARGIN_MIN - 1e-6, "GA best violates tolerance margin - widen GENE_SPACE or raise penalty"

# —— SolidWorks 方程导出 (COMPACT 同构, 法向 δ-Rr) ——
def sw_equations(offset, s1, s2):
    Rb, Rr, E, N, M = m.Rb, m.Rr, m.E, m.N, m.M
    d   = f"({offset:.4f} + {s1:.4f}*cos({N}*t) + {s2:.4f}*cos({2*N}*t))"
    den = f"sqrt( (-{Rb}*sin(t)-{E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t)+{E}*{M}*cos({M}*t))^2 )"
    x = f"{Rb}*cos(t)+{E}*cos({M}*t) + ( {d} - {Rr} )*( {Rb}*cos(t)+{E}*{M}*cos({M}*t) )/{den}"
    y = f"{Rb}*sin(t)+{E}*sin({M}*t) + ( {d} - {Rr} )*( {Rb}*sin(t)+{E}*{M}*sin({M}*t) )/{den}"
    return x, y

xeq, yeq = sw_equations(offset, s1, s2)
with open("solidworks_equations_harmonic.txt", "w", encoding="utf-8") as f:
    f.write("HARMONIC MODIFICATION - SolidWorks Equation Driven Curve (Parametric)\n")
    f.write(f"offset={offset:.4f}  s1={s1:.4f}  s2={s2:.4f}  [mm]\n")
    f.write(f"metrics: backlash={r['backlash']:.2f} arcmin, stiffness={r['stiff']:.1f} N*m/arcmin, "
            f"margin={r['margin']:.2f} arcmin @ tol={m.TOL_BUDGET*1e3:.0f} um\n\n")
    f.write("X(t):\n" + xeq + "\n\nY(t):\n" + yeq + "\n\nt: 0 .. 6.28318, points: 500\n")
print("[OK] solidworks_equations_harmonic.txt")

# —— CSV 点云导出 ——
X, Y = m.profile(offset, s1, 'harmonic', s2=s2)
with open("cycloidal_harmonic_opt.csv", "w") as f:
    f.write("X,Y,Z\n")
    for x_, y_ in zip(X[::20], Y[::20]):
        f.write(f"{x_:.6f},{y_:.6f},0.000000\n")
print("[OK] cycloidal_harmonic_opt.csv")

# —— 对比图: 当前设计 vs 纯等距 vs GA最优 ——
def clearance_curve(X, Y):
    gaps, _, uu = m.mesh_state(X, Y, 0.0, m.ROT_SIGN)
    o = np.argsort(uu)
    return uu[o], gaps[o]*1e3

fig, ax = plt.subplots(figsize=(9, 5.5))
cases = [('current pertooth (-0.075, 0.05)', m.profile(-0.075, 0.05, 'pertooth'),        '#2563eb'),
         ('uniform offset -0.040',           m.profile(-0.040, 0.0,  'harmonic'),        '#ea8600'),
         (f'GA harmonic ({offset:.3f}, {s1:.3f}, {s2:.3f})',
                                             m.profile(offset, s1, 'harmonic', s2=s2),   '#188038')]
for label, (Xc, Yc), c in cases:
    u, g = clearance_curve(Xc, Yc)
    ax.plot(u, g, 'o-', color=c, ms=4, lw=1.3, label=label)
ax.axhline(m.TOL_BUDGET*1e3, color='#9aa0a6', ls='--', lw=1.2)
ax.text(0.01, m.TOL_BUDGET*1e3, f' tolerance budget {m.TOL_BUDGET*1e3:.0f} um', color='#9aa0a6',
        fontsize=8, va='bottom')
ax.set_xlabel('contact phase within tooth (0=tip, 0.5=root)')
ax.set_ylabel('normal clearance [um]')
ax.set_title(f'Clearance distribution: GA optimum vs baselines  '
             f'(backlash {r["backlash"]:.2f} arcmin, stiffness {r["stiff"]:.1f} N*m/arcmin)')
ax.legend(); ax.grid(alpha=0.3)
fig.tight_layout(); fig.savefig('ModAnalysis_optimal.png', dpi=140)
print("[OK] ModAnalysis_optimal.png")
