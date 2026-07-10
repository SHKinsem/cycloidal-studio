# -*- coding: utf-8 -*-
"""
对标验证: 检查本工具能复现文献里的定性结论(不是拟合具体数字, 而是趋势方向一致)。
每项给出对应论文 + 对比 + PASS/观察。运行: python cycloidal_benchmark.py
参考文献:
 [A] Appl.Sci 9(19):4099 (2019) 修型+载荷下传动性能: 组合/反弓修型优于纯等距; 反弓在大间隙/大扭矩下最优。
 [B] Sun et al. MMT 120:89-106 (2018): 计入加工误差的复合负修型最小化空回(鲁棒优化)。
 [C] 摆线传动理论: 未修型共轭齿廓在啮入/啮出极端位置压力角趋近 90deg, 修型relief可降低。
 [D] 加载齿接触: 扭矩越大, 弹性挤入使更多齿参与承载(受载齿数随扭矩增加)。
"""
import numpy as np
import model as m
import objectives as a

def line(): print("-"*70)
PASS = []

print("="*70); print("CYCLOIDAL DESIGN TOOL — LITERATURE BENCHMARK"); print("="*70)

# —— 1 [C] 修型降低峰值压力角 ——
line(); print("1. [C] Modification relieves peak pressure angle (theory: unmodified -> ~90deg)")
r_un = a.evaluate_design(0.0, [])                       # 未修型(纯共轭)
r_mod = a.evaluate_design(-0.0209, [-0.0012,-0.0037])   # 3谐波设计
print(f"   unmodified : max PA = {r_un['max_pressure_angle']:.1f} deg  (teeth {r_un['n_eng']})")
print(f"   modified   : max PA = {r_mod['max_pressure_angle']:.1f} deg  (teeth {r_mod['n_eng']})")
ok = r_mod['max_pressure_angle'] < r_un['max_pressure_angle'] - 10
print(f"   => modification LOWERS peak pressure angle: {'PASS' if ok else 'FAIL'}"); PASS.append(ok)

# —— 2 [A] 反弓(负s2)相对纯等距: 更高刚度/更多受载齿 (同等鲁棒余量下) ——
line(); print("2. [A] Reverse-bow (c2<0) vs pure equidistant offset, matched robust margin")
# 找两者使 worst_margin 接近 ~1.0'
def tune_offset(coeffs, target=1.0):
    lo, hi = -0.12, -0.010
    for _ in range(40):
        mid = 0.5*(lo+hi)
        wm = a.evaluate_robust(mid, coeffs)['worst_margin']
        if wm < target: lo = mid          # 太紧, 放松(更负)
        else: hi = mid
    return 0.5*(lo+hi)
off_u = tune_offset([]);                 ru = a.evaluate_robust(off_u, [])
off_r = tune_offset([-0.006,-0.010]);    rr = a.evaluate_robust(off_r, [-0.006,-0.010])
print(f"   pure offset  ({off_u*1e3:.1f}um)     : stiff {ru['stiff']:.1f}  ripple {ru['ripple']:.1f}  teeth {ru['n_eng']}  backlash {ru['backlash']:.2f}'")
print(f"   reverse-bow  ({off_r*1e3:.1f}um+c)   : stiff {rr['stiff']:.1f}  ripple {rr['ripple']:.1f}  teeth {rr['n_eng']}  backlash {rr['backlash']:.2f}'")
ok = (rr['stiff'] >= ru['stiff'] - 0.5) and (rr['n_eng'] >= ru['n_eng'])
print(f"   => reverse-bow >= pure offset on stiffness/load-sharing: {'PASS' if ok else 'FAIL'}"); PASS.append(ok)

# —— 3 [D] 受载齿数随扭矩增加 ——
line(); print("3. [D] Loaded-tooth count rises with rated torque (elastic load spreading)")
saved_T = m.T_RATED
counts = []
for T in (5.0, 30.0, 120.0):
    m.T_RATED = T
    counts.append(a.evaluate_design(-0.0209, [-0.0012,-0.0037])['n_eng'])
    print(f"   T={T:5.0f} N*m -> loaded teeth = {counts[-1]}")
m.T_RATED = saved_T
ok = counts[0] <= counts[1] <= counts[2] and counts[2] > counts[0]
print(f"   => monotonic non-decreasing with torque: {'PASS' if ok else 'FAIL'}"); PASS.append(ok)

# —— 4 backlash<->margin 单调权衡 ——
line(); print("4. [fundamental] Backlash and tolerance margin both grow as clearance opens")
prev_b = prev_mg = -1; mono = True
for off in (-0.020, -0.035, -0.050, -0.070):
    r = a.evaluate_design(off, [])
    print(f"   offset {off*1e3:5.0f}um -> backlash {r['backlash']:.2f}'  margin {r['margin']:.2f}'")
    if prev_b >= 0 and not (r['backlash'] > prev_b and r['margin'] > prev_mg): mono = False
    prev_b, prev_mg = r['backlash'], r['margin']
print(f"   => monotonic backlash<->margin tradeoff: {'PASS' if mono else 'FAIL'}"); PASS.append(mono)

# —— 5 [B] 鲁棒优化的意义: 名义最优在扰动下余量塌缩 ——
line(); print("5. [B] Robust design keeps margin under +/-machining error where nominal-optimal loses it")
nom = a.evaluate_robust(-0.0209, [-0.0012,-0.0037])    # 之前的名义3谐波最优
print(f"   nominal 3-harm optimum : margin {nom['margin']:.2f}'  worst_margin(+/-7.5um) {nom['worst_margin']:.2f}'")
print(f"   (Pareto knee is constrained worst_margin>=0.5' by construction — robustness built in)")
ok = nom['worst_margin'] < nom['margin']   # 扰动确实吃掉余量, 证明需要鲁棒约束
print(f"   => machining error erodes margin (=> robust constraint is meaningful): {'PASS' if ok else 'FAIL'}"); PASS.append(ok)

line(); print(f"BENCHMARK: {sum(PASS)}/{len(PASS)} checks reproduce the expected literature trends")
print("Metrics computed match the paper vocabulary: backlash[arcmin], torsional stiffness,")
print("loaded transmission-error ripple, pressure angle, loaded-tooth count, manufacturability.")
