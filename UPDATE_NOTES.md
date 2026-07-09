# 移距修型算法更新说明

## 更新日期
2025-10-07

## 主要修改

### 1. 修型算法变更
**原算法（全局周期）：**
```python
phi = (theta - theta_max + π) % (2π) - π
delta = offset + shift * (phi/π)²
```
- 在整个360°范围内形成单一的二次曲线修型
- 修型量在 theta_max 处最小，在 theta_max ± π 处最大

**新算法（逐齿周期）：**
```python
tooth_pitch = 2π / N  # 单齿角度宽度
phi = (theta % tooth_pitch) - tooth_pitch/2
delta = offset + shift * (phi / (tooth_pitch/2))²
```
- 在每个齿的范围内独立形成二次曲线修型
- 每个齿在齿中心处修型量最小，在齿间隙处最大
- 产生 N 个周期性修型（对应 N 个齿）

### 2. SolidWorks方程更新

**新的修型公式：**
```
delta(t) = DeltaOffset + DeltaShift * ((1 - cos(N*t))/2)
```

其中：
- `N = 14` (齿数)
- `(1 - cos(14*t))/2` 产生14个周期性调制，范围 [0, 1]
- 在每个齿中心 (t = k*2π/14, k=0,1,2,...13) 处，cos(14*t) = 1，调制量为0，修型量最小
- 在齿间隙处 (t = (2k+1)*π/14)，cos(14*t) = -1，调制量为1，修型量最大
- 修型量范围：[DeltaOffset, DeltaOffset + DeltaShift] = [-0.0388, -0.02] mm

**COMPACT 变体方程（推荐使用）：**

X(t):
```
34.0*cos(t)+2.0*cos(15*t) + ( -0.0388 + 0.0188*((1 - cos(14*t))/2) - 2.5)*( 34.0*cos(t)+2.0*15*cos(15*t) )/sqrt( (-34.0*sin(t)-2.0*15*sin(15*t))^2 + (34.0*cos(t)+2.0*15*cos(15*t))^2 )
```

Y(t):
```
34.0*sin(t)+2.0*sin(15*t) + ( -0.0388 + 0.0188*((1 - cos(14*t))/2) - 2.5)*( 34.0*sin(t)+2.0*15*sin(15*t) )/sqrt( (-34.0*sin(t)-2.0*15*sin(15*t))^2 + (34.0*cos(t)+2.0*15*cos(15*t))^2 )
```

### 3. 参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| Rb | 34.0 mm | 针齿中心圆半径 |
| Rr | 2.5 mm | 针齿（滚子）半径 |
| E | 2.0 mm | 偏心距 |
| N | 14 | 摆线盘齿数 |
| DeltaOffset | -0.0388 mm | 等距修型基准量 |
| DeltaShift | 0.0188 mm | 移距修型振幅 |

### 4. SolidWorks 导入步骤

1. **创建全局变量**（在 Equations 中）：
   ```
   "Rb" = 34.0
   "Rr" = 2.5
   "E" = 2.0
   "N" = 14
   "DeltaOffset" = -0.0388
   "DeltaShift" = 0.0188
   ```

2. **插入方程驱动曲线**：
   - Insert > Curve > Equation Driven Curve
   - 选择 "Parametric" 类型
   - 参数范围：t = 0 到 6.28318 (2π)
   - 点数建议：500

3. **粘贴方程**：
   - 从 `solidworks_equations.txt` 复制 COMPACT 变体的 X(t) 和 Y(t)
   - 如果方程过长无法一次粘贴，可分两次：先粘贴 X(t) 并确认，再重新打开粘贴 Y(t)

4. **备选方案**（如果方程不工作）：
   - 使用点云导入：Insert > Curve > Curve Through XYZ Points
   - 导入 `cycloidal_modified.csv` 文件
   - 使用 Fit Spline 功能拟合曲线

## 技术优势

### 逐齿周期修型的优点：
1. **更精确的齿形控制**：每个齿独立修型，避免全局修型导致的不均匀性
2. **更好的啮合性能**：每个齿在啮合中心区域（齿中心）保持较小修型量，提高接触精度
3. **减少边缘效应**：齿间隙处增大修型量，减少应力集中
4. **周期一致性**：14个齿的修型模式完全一致，保证运动平稳性

### 与全局修型的对比：
| 特性 | 全局周期 | 逐齿周期 |
|------|---------|---------|
| 修型周期 | 1个/圈 | 14个/圈 |
| 齿形一致性 | 差 | 优 |
| 边界连续性 | 需要特殊处理 | 自然周期性 |
| 调整灵活性 | 低 | 高 |

## 验证方法

运行 `CycloidalOptim.py` 会生成：
1. **图形显示**：标准齿廓 vs 修型齿廓对比
2. **修型量曲线**：δ(θ) 随角度变化图（应显示14个周期）
3. **导出文件**：
   - `solidworks_equations.txt`：方程文件
   - `cycloidal_standard.csv`：标准齿廓点云
   - `cycloidal_modified.csv`：修型齿廓点云

## 注意事项

⚠️ **重要**：如果你已经在 SolidWorks 中使用了旧方程，需要：
1. 删除旧的方程驱动曲线
2. 更新全局变量（如需要）
3. 使用新方程重新创建曲线

⚠️ **调试提示**：
- 如果曲线看起来不正确，检查 N 的值是否正确设置为 14
- 可以通过调整 DeltaShift 参数观察修型效果（增大该值会增强修型幅度）
- 使用 MINIMAL 变体可以验证基础摆线形状（不含修型）

## 文件清单

修改的文件：
- ✅ `CycloidalOptim.py` - 主程序（更新了 build_equation_variants 函数）
- ✅ `solidworks_equations.txt` - 自动生成的方程文件
- ✅ `cycloidal_modified.csv` - 自动生成的修型齿廓点云
- ✅ `cycloidal_standard.csv` - 自动生成的标准齿廓点云

## 后续优化建议

1. **参数化调整**：可以通过调整 `Delta_offset` 和 `Delta_shift` 优化啮合性能
2. **有限元验证**：建议在 SolidWorks Simulation 中验证应力分布
3. **齿形优化**：可以考虑使用遗传算法（`CycloidalOptim_GA.py`）进一步优化参数

---

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

### 本次最优解（Rb=34, Rr=2.5, E=1.5, N=18, T=30N·m, tol=15μm, seed=42, 80代）
offset=-0.0254, s1=-0.0034, s2=-0.0081 →
- 背隙 5.22 arcmin（当前 pertooth 设计 9.72）
- 刚度 33.9 N·m/arcmin（当前 29.1，反而更高：修型把最紧点放到齿腰，受载齿数 3→4）
- 波动 12.2 μrad（当前 104，丝滑度提升约 8 倍）
- 公差余量 0.68 arcmin（贴着 15μm 硬约束的边界；余量换齿数是本设计的核心权衡）

齿廓形状：齿腰(u≈0.25/0.75)最紧≈17μm→刚度；齿顶/齿根放松→吸收公差与入啮冲击。这就是"反弓"修型。

⚠️ 余量仅 0.68 arcmin，若实际公差叠加 > 15μm 会卡死。放宽 `TOL_BUDGET` 或提高 `MARGIN_MIN`
重跑即可得到更保守（余量更大、背隙略增）的解。背隙-余量为此消彼长，5.22 arcmin 已近约束下限。

### 交互式可视化
`cycloidal_viz.html`（单文件，离线可用）：啮合动画 + 齿廓/间隙曲线 + 三方案对比 + 参数游标。

### 文件变更
- 删除 `CycloidalOptim_GA,py`（废弃：全局修型公式 + Rb=65 旧参数），替代品 `CycloidalOptim_GA.py`
- `CycloidalModAnalysis.py` 重构为可 import 模块，新增 harmonic 变体与 `test_cycloidal.py`
- 新增 `cycloidal_viz.html` 交互可视化

---
*更新完成。如有问题请检查运行输出或查看生成的图形。*
