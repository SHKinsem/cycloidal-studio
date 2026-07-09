# 摆线盘谐波修型 + GA 优化升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 SolidWorks 导出相位 bug；把 GA 优化器的目标函数从"最大压力角"换成真实啮合指标（背隙/刚度/公差余量/波动）；新增可控"紧点位置"的双谐波修型参数化，并能直接导出 SolidWorks 方程。

**Architecture:** `CycloidalModAnalysis.py`（已存在，数值啮合分析：间隙/背隙/刚度/公差可行性）重构为可 import 的模块并新增 `'harmonic'` 法向修型变体 `δ(θ)=offset+s1·cos(Nθ)+s2·cos(2Nθ)`；新建 `CycloidalOptim_GA.py` 以 `evaluate()` 为适应度做 3 基因 GA，输出最优参数 + SolidWorks 方程 + CSV + 对比图；`CycloidalOptim.py` 只做一行相位修复。

**Tech Stack:** Python 3 + numpy + matplotlib(Agg) + pygad（均已安装，旧 GA 文件用的就是 pygad 3.x 的 `fitness_func(ga, sol, idx)` 签名）。

## Global Constraints

- 工作目录（所有命令在此执行）：`C:\Users\xusen\OneDrive - HKUST Connect\Workshop\Projects\ROBOMASTER\RM26\Experimental\CycloidalDrive\##Reference`
- **非 git 仓库**：没有 commit 步骤，每个任务以"验证命令 + 预期输出"收尾（OneDrive 版本历史兜底）。
- Windows 控制台是 GBK：所有运行命令前设 `$env:PYTHONIOENCODING='utf-8'`（PowerShell）。
- 几何参数保持与现有一致：`Rb=34.0, Rr=2.5, E=1.5, N=18, Np=19`。
- 修型约定：δ ≤ 0 表示去料（沿轮廓外法向，δ−Rr 结构与 SW COMPACT 方程同构）；任何候选解必须处处去料 ≥ 5 μm，否则视为干涉。
- 假设常量不改动：`T_RATED=30.0`（N·m）、`K_CONTACT=5.0e4`（N/mm）、`TOL_BUDGET=0.015`（mm）、`PSI_SAMPLES`（6 个曲柄角）。
- 旧的 `'pertooth'`/`'sw'` 径向修型变体**保留不动**（历史对照用），新功能全部走 `'harmonic'`。
- 图表配色固定顺序：蓝 `#2563eb`、橙 `#ea8600`、绿 `#188038`、灰 `#9aa0a6`；图内文字用英文（Agg 默认字体无中文）。

---

### Task 1: 把 CycloidalModAnalysis.py 重构成可 import 的模块（行为不变）

现状：该文件是纯脚本，`import` 它会执行 256 格参数扫描并写 PNG。GA 需要 `import CycloidalModAnalysis` 只拿函数和 `ROT_SIGN`。

**Files:**
- Modify: `CycloidalModAnalysis.py`

**Interfaces:**
- Produces（Task 2/4 依赖）：模块级常量 `Rb, Rr, E, N, Np, M, T_RATED, K_CONTACT, TOL_BUDGET, PSI_SAMPLES, TH, PIN_XY, ROT_SIGN`；函数 `profile(offset, shift, variant)`、`mesh_state(X, Y, psi, rot_sign)`、`play_range(gaps, arms, tol=0.0)`、`windup(gaps, arms)`、`evaluate(offset, shift, variant)`（签名 Task 2 会扩展）。

- [ ] **Step 1: 移动自检块、包主流程进 `_main()`**

文件目前的顺序是：常量 → `profile/mesh_state/play_range/windup/evaluate` → 自检块（以 `# —— 运动学符号自检` 开头，设置全局 `ROT_SIGN` 并 `assert`）→ 三段主流程（`# —— 1. 当前设计`、`# —— 2. 参数扫描`、`# —— 3. 绘图`）。

做两个编辑：

1. 自检块**保留在模块顶层**（import 时执行，~50ms，负责给 `ROT_SIGN` 赋值），只把它的 `print` 改为英文避免 GBK 乱码：

```python
print(f"[self-check OK] unmodified profile contacts all {Np} pins (rot_sign={ROT_SIGN:+.0f})")
```

2. 从 `# —— 1. 当前设计` 那一行开始直到文件末尾，全部整体缩进 4 空格，包进：

```python
def _main():
    # —— 1. 当前设计: pertooth(Python/CSV几何) vs sw(SolidWorks方程几何) ——
    ...（原有代码，仅整体缩进）...

if __name__ == '__main__':
    _main()
```

注意 `_main()` 内部对 `evaluate/profile/mesh_state` 的调用走模块作用域，不需要 `global`。

- [ ] **Step 2: 验证 import 无副作用**

```powershell
$env:PYTHONIOENCODING='utf-8'; python -c "import CycloidalModAnalysis as m; print('ROT_SIGN=', m.ROT_SIGN); print('has evaluate:', callable(m.evaluate))"
```

预期：打印 `[self-check OK] ...`、`ROT_SIGN= -1.0`、`has evaluate: True`，**不出现**扫描进度和 `[OK] ModAnalysis_*.png`，3 秒内结束。

- [ ] **Step 3: 验证脚本模式行为不变**

```powershell
$env:PYTHONIOENCODING='utf-8'; python CycloidalModAnalysis.py
```

预期：与重构前相同——自检行、pertooth/sw 两行指标（背隙 9.72 / 3.92 arcmin）、16 行扫描进度、`[推荐] offset=-0.030 ...`、两个 `[OK] ...png`。

---

### Task 2: 新增 'harmonic' 法向双谐波修型变体（TDD）

**Files:**
- Modify: `CycloidalModAnalysis.py`（`profile()` 与 `evaluate()`）
- Create: `test_cycloidal.py`

**Interfaces:**
- Produces（Task 4 依赖）：
  - `profile(offset, shift, variant, s2=0.0)` → `(X, Y)` 两个 `np.ndarray(NTH)`；`variant='harmonic'` 时 `shift` 就是 s1，修型量 `δ(θ)=offset+shift·cos(N·θ)+s2·cos(2N·θ)` 沿**外法向**叠加（轮廓 = 基线 + (δ−Rr)·n̂）。
  - `evaluate(offset, shift, variant, s2=0.0)` → `dict(backlash, stiff, margin, n_eng, ripple)`，单位分别 arcmin、N·m/arcmin、arcmin、个、μrad。

- [ ] **Step 1: 写失败测试 `test_cycloidal.py`**

```python
# -*- coding: utf-8 -*-
# 运行: python test_cycloidal.py   (无pytest依赖, assert式自检)
import numpy as np
import CycloidalModAnalysis as m

def test_conjugate():
    """无修型齿廓必须与19针全部同时接触(共轭性, 管线正确性基线)"""
    X, Y = m.profile(0, 0, 'none')
    for psi in (0.0, 0.3, 1.1):
        gaps, _, _ = m.mesh_state(X, Y, psi, m.ROT_SIGN)
        assert np.abs(gaps).max() < 5e-4, f"psi={psi}: {np.abs(gaps).max()}"

def test_harmonic_uniform():
    """s1=s2=0 即纯等距修型: 法向间隙处处= |offset| (偏置曲线性质, 精确)"""
    X, Y = m.profile(-0.030, 0.0, 'harmonic')
    gaps, _, _ = m.mesh_state(X, Y, 0.0, m.ROT_SIGN)
    assert np.abs(gaps - 0.030).max() < 1e-3, f"max dev {np.abs(gaps-0.030).max()*1e3:.2f} um"

def test_harmonic_midflank():
    """s2<0 应把最紧点放到齿腰 u≈0.25/0.75 (紧点可控性)"""
    X, Y = m.profile(-0.040, 0.0, 'harmonic', s2=-0.015)
    gaps, _, uu = m.mesh_state(X, Y, 0.0, m.ROT_SIGN)
    u_min = uu[np.argmin(gaps)]
    assert min(abs(u_min - 0.25), abs(u_min - 0.75)) < 0.10, f"tightest at u={u_min:.2f}"

def test_unknown_variant():
    try:
        m.profile(0, 0, 'typo')
    except ValueError:
        return
    raise AssertionError("unknown variant should raise ValueError")

if __name__ == '__main__':
    for fn in (test_conjugate, test_harmonic_uniform, test_harmonic_midflank, test_unknown_variant):
        fn(); print(f"  PASS {fn.__name__}")
    print("ALL TESTS PASS")
```

- [ ] **Step 2: 运行确认失败**

```powershell
$env:PYTHONIOENCODING='utf-8'; python test_cycloidal.py
```

预期：`test_conjugate` PASS 后，`test_harmonic_uniform` 抛 AssertionError（当前 `'harmonic'` 落进 else 分支 δ=0，间隙≈0 而非 30 μm）。

- [ ] **Step 3: 实现——替换 `profile()` 全函数**

```python
def profile(offset, shift, variant, s2=0.0):
    """修型齿廓 (盘坐标系)。
    variant:
      'harmonic' : 法向修型 δ(θ)=offset+shift·cos(N·θ)+s2·cos(2N·θ)  [shift 即 s1]
                   轮廓 = 基线 + (δ - Rr)·n̂ , 与 SolidWorks COMPACT 方程同构、可精确导出。
                   紧点位置: s1>0 齿顶紧 / s1<0 齿根紧 / s2<0 齿腰(u≈0.25)紧。
      'pertooth' : 旧版 Python 逐齿二次修型, 沿径向 (历史对照)
      'sw'       : 旧版导出到 SolidWorks 的余弦修型, 沿径向 (历史对照, 相位与 pertooth 差半齿距)
      'none'     : 无修型
    """
    xc = Rb*np.cos(TH) + E*np.cos(M*TH)
    yc = Rb*np.sin(TH) + E*np.sin(M*TH)
    dx = -Rb*np.sin(TH) - E*M*np.sin(M*TH)
    dy =  Rb*np.cos(TH) + E*M*np.cos(M*TH)
    nn = np.hypot(dx, dy)
    nx, ny = dy/nn, -dx/nn
    tp = 2*np.pi/N
    if variant == 'harmonic':
        d = offset + shift*np.cos(N*TH) + s2*np.cos(2*N*TH)
        return xc + (d - Rr)*nx, yc + (d - Rr)*ny
    xs, ys = xc - Rr*nx, yc - Rr*ny
    if variant == 'pertooth':
        ph = (TH % tp) - tp/2
        d  = offset + shift*(ph/(tp/2))**2
    elif variant == 'sw':
        d  = offset + shift*(1 - np.cos(N*TH))/2
    elif variant == 'none':
        d  = np.zeros(NTH)
    else:
        raise ValueError(f"unknown variant: {variant!r}")
    r = np.hypot(xs, ys)
    return xs + d*xs/r, ys + d*ys/r
```

同时把 `evaluate()` 第一行签名与 profile 调用改为：

```python
def evaluate(offset, shift, variant, s2=0.0):
    """跨曲柄角聚合: 背隙(最坏)[arcmin], 刚度(最差)[N*m/arcmin], 公差余量(最小)[arcmin], 最少受载齿数, 加载转角波动[urad]"""
    X, Y = profile(offset, shift, variant, s2=s2)
```

其余函数体不动。注意现文件 `evaluate` 返回的 `margin` 单位是 rad——**顺手统一成 arcmin**（Task 4 的适应度直接用）：返回行改为

```python
    arcmin = 180/np.pi*60
    k_min = np.min(ks)
    return dict(backlash=np.max(plays)*arcmin,
                stiff=k_min/1e3/arcmin,
                ripple=(np.max(wus)-np.min(wus))*1e6,
                margin=np.min(margins)*arcmin,
                n_eng=int(np.min(nes)))
```

并检查 `_main()` 里两处用到 `margin` 的地方：`r['margin'] > 0` 判可行的逻辑不受单位影响，不用改；`[推荐]` 打印行里的 `rb['margin']*180/np.pi*60` 要把 `*180/np.pi*60` 删掉（否则双重换算）。

- [ ] **Step 4: 运行测试确认全过**

```powershell
$env:PYTHONIOENCODING='utf-8'; python test_cycloidal.py
```

预期：4 行 `PASS` + `ALL TESTS PASS`。

---

### Task 3: 修复 CycloidalOptim.py 的 SolidWorks 相位 bug（一行 + 注释）

背景：Python/CSV 的逐齿二次修型在齿顶去料最少（w=1）、齿根最多（w=0）；导出的 SW 公式 `(1-cos(N*t))/2` 相位正好反了半个齿距，导致 SW 方程画出的盘齿根最紧、公差下卡死（已实测）。

**Files:**
- Modify: `CycloidalOptim.py:167`（`build_equation_variants` 内 `tooth_mod_formula`）

- [ ] **Step 1: 编辑**

把

```python
    tooth_mod_formula = f"((1 - cos({N}*t))/2)"  # 0到1之间周期变化
```

改为

```python
    # 与Python逐齿二次修型同相位: 齿顶(t=k*2pi/N)权重=1(去料最少), 齿根=0(去料最多)。
    # 注意: Python侧修型沿径向、此方程沿法向, 齿腰处仍有 δ·(1-cosβ) 的几微米级残差;
    # 需要精确一致请改用 CycloidalOptim_GA.py 导出的 harmonic 方程。
    tooth_mod_formula = f"((1 + cos({N}*t))/2)"
```

- [ ] **Step 2: 重新生成并验证**

```powershell
$env:PYTHONIOENCODING='utf-8'; python CycloidalOptim.py
```

（会弹两个 matplotlib 窗口，关掉即可；无显示环境时可临时在文件头加 `matplotlib.use('Agg')`，跑完删掉。）然后：

```powershell
Select-String -Path solidworks_equations.txt -Pattern '1 \+ cos\(18\*t\)' | Measure-Object | Select-Object -ExpandProperty Count
```

预期：计数 ≥ 2（X、Y 方程里都有），且 `Select-String -Path solidworks_equations.txt -Pattern '1 - cos\(18'` 无结果。

---

### Task 4: 重写 GA 优化器为 CycloidalOptim_GA.py（新目标函数 + 3 基因）

旧文件 `CycloidalOptim_GA,py`（文件名带逗号）用的是废弃的全局修型公式、不同的几何参数（Rb=65）、且只压最大压力角——完全替换，Task 5 里删除旧文件。

**Files:**
- Create: `CycloidalOptim_GA.py`

**Interfaces:**
- Consumes：Task 2 的 `m.evaluate(offset, s1, 'harmonic', s2=s2)`、`m.profile(...)`、`m.mesh_state(X, Y, 0.0, m.ROT_SIGN)`、常量 `m.Rb, m.Rr, m.E, m.N, m.M, m.TOL_BUDGET, m.T_RATED`。
- Produces：运行后输出最优 `(offset, s1, s2)`、指标表、`solidworks_equations_harmonic.txt`、`cycloidal_harmonic_opt.csv`、`ModAnalysis_optimal.png`。

- [ ] **Step 1: 写完整文件**

```python
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
        print(f"  gen {ga.generations_completed:3d}/{GENS}  best cost = {-ga.best_solution()[1]:.3f}")

ga = pygad.GA(num_generations=GENS, num_parents_mating=8,
              fitness_func=fitness_func, sol_per_pop=24, num_genes=3,
              gene_space=GENE_SPACE, parent_selection_type="rank",
              crossover_type="single_point", mutation_type="random",
              mutation_percent_genes=25, random_seed=42,
              on_generation=on_gen, suppress_warnings=True)
ga.run()
(offset, s1, s2), fit, _ = ga.best_solution()
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
```

- [ ] **Step 2: 冒烟测试（5 代）**

```powershell
$env:PYTHONIOENCODING='utf-8'; $env:QUICK='1'; python CycloidalOptim_GA.py; Remove-Item Env:QUICK
```

预期：打印 `gen ...` 进度、`[best] offset=...`（margin ≥ 0.5，assert 不触发）、三个 `[OK]` 文件行，约 20 秒内完成。若 assert 触发：这是冒烟运行代数太少，属正常，直接进 Step 3 跑完整版；完整版仍触发才需要调 `GENE_SPACE`/惩罚。

- [ ] **Step 3: 检查产物合理性**

```powershell
Get-Content solidworks_equations_harmonic.txt -TotalCount 8
Import-Csv cycloidal_harmonic_opt.csv | Measure-Object | Select-Object -ExpandProperty Count
```

预期：方程文件头 3 行含参数与指标；CSV 行数 = 400（8000/20）。用 Read 工具看一眼 `ModAnalysis_optimal.png`：三条曲线都在公差线上方、绿色（GA）曲线最紧处应高于灰线且低于蓝线。

---

### Task 5: 完整运行、文档更新、清理

**Files:**
- Modify: `UPDATE_NOTES.md`（追加章节）
- Delete: `CycloidalOptim_GA,py`（带逗号的旧文件，已被 Task 4 完全取代：旧内容是废弃的全局修型 + Rb=65 参数 + 纯压力角目标，无保留价值；OneDrive 版本历史可找回）

- [ ] **Step 1: 完整 GA 运行（80 代）**

```powershell
$env:PYTHONIOENCODING='utf-8'; python CycloidalOptim_GA.py
```

预期（验收标准）：`backlash ≤ 5 arcmin`、`margin ≥ 0.5 arcmin`、`stiff ≥ 28 N*m/arcmin`、cost 随代数单调下降。把 `[best]` 两行结果原样记录下来，Step 2 要写进文档。

- [ ] **Step 2: 追加 UPDATE_NOTES.md 章节**

在文件末尾（`---` 分隔线之前）追加，`<...>` 处填 Step 1 的实际数值：

```markdown
## 2026-07-10 谐波修型 + GA 目标函数升级

### Bug 修复
- SolidWorks 导出相位反了半个齿距：`tooth_mod_formula` 由 `(1-cos(N*t))/2` 改为 `(1+cos(N*t))/2`，
  现在与 Python/CSV 几何同相位（此前 SW 方程的盘齿根最紧，15μm 公差叠加下会卡死）。

### 新参数化（推荐使用）
δ(θ) = offset + s1·cos(N·θ) + s2·cos(2N·θ)，沿轮廓法向，δ<0 去料。
- s1>0 齿顶紧 / s1<0 齿根紧 / s2<0 齿腰紧（经典"反弓"形状）
- 与 SW COMPACT 方程同构，导出零误差；旧 pertooth/sw 径向变体仅作历史对照。

### GA 目标函数
旧：最小化最大压力角。新：公差可行（margin≥0.5 arcmin @ 15μm 最坏叠加）前提下
最小化 背隙 + 0.05·波动 + 刚度不足惩罚。见 `CycloidalOptim_GA.py`。

### 本次最优解（Rb=34, Rr=2.5, E=1.5, N=18, T=30N·m, tol=15μm, seed=42）
offset=<...>, s1=<...>, s2=<...> → 背隙 <...> arcmin，刚度 <...> N·m/arcmin，余量 <...> arcmin
产物：`solidworks_equations_harmonic.txt`、`cycloidal_harmonic_opt.csv`、`ModAnalysis_optimal.png`

### 文件变更
- 删除 `CycloidalOptim_GA,py`（废弃：全局修型公式 + Rb=65 旧参数），替代品 `CycloidalOptim_GA.py`
- `CycloidalModAnalysis.py` 重构为可 import 模块，新增 harmonic 变体与 `test_cycloidal.py`
```

- [ ] **Step 3: 删除旧 GA 文件**

```powershell
Remove-Item 'CycloidalOptim_GA,py' -Confirm:$false
```

- [ ] **Step 4: 终验——全套测试与脚本各跑一遍**

```powershell
$env:PYTHONIOENCODING='utf-8'; python test_cycloidal.py; python CycloidalModAnalysis.py
```

预期：`ALL TESTS PASS`；分析脚本输出与 Task 1 Step 3 一致（注意 `[推荐]` 行 margin 单位改成 arcmin 后数值是 0.09 左右不变，因为该处原本就做了换算、Task 2 已删掉重复换算）。目录中存在：`CycloidalOptim_GA.py`、`test_cycloidal.py`、`solidworks_equations_harmonic.txt`、`cycloidal_harmonic_opt.csv`、`ModAnalysis_optimal.png`，且 `CycloidalOptim_GA,py` 已不存在。
