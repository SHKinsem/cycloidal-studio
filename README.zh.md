# 摆线工作室 Cycloidal Studio

**在浏览器里设计、优化、导出摆线针轮的齿廓修型。**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![无需构建](https://img.shields.io/badge/build-none-brightgreen)

*[English → README.md](README.md)*

摆线针轮减速器(RV 减速器、机器人关节里的那种)的成败,系于**齿廓修型**——几微米的去料量,决定了
背隙、刚度、丝滑度,以及计入加工公差后它到底能不能正常啮合。本项目把这个设计闭环做成了交互式:两个
自包含网页 + 一个 Python 优化器,产出可与论文对标的**帕累托前沿**。

网页工具是**纯 HTML/JS/Canvas——无需构建、零依赖、无需服务器。** 直接打开文件,或两步部署到 GitHub Pages。

| 齿廓设计器 (`index.html`) | 帕累托浏览器 (`pareto.html`) |
|---|---|
| ![设计器](assets/screenshot-designer.png) | ![浏览器](assets/screenshot-pareto.png) |

---

## 快速开始

- **在线演示:** `https://<你的用户名>.github.io/cycloidal-studio/` *(部署后,见下文)*
- **本地零安装:** 克隆仓库,浏览器打开 `index.html`。

---

## 两个工具

### 1. 齿廓设计器 — `index.html`
调一颗齿,实时看整个减速器的响应:
- **可编辑几何与工况:** 针齿中心圆 Rb、针齿半径 Rr、偏心距 E、齿数 N、公差叠加、额定扭矩。
- **修型** `δ(θ) = offset + s1·cos(Nθ) + s2·cos(2Nθ)`,滑块拖拽 + 预设。
- **实时指标:** 背隙、扭转刚度、传动误差波动、公差余量、受载齿数——拖动时由真实准静态加载接触模型实时算出。
- **啮合动画:** 偏心盘真的会转,受载齿发亮。
- **一键 SolidWorks 导出:** 复制方程驱动曲线 `X(t)` / `Y(t)`(数值内联),或下载点云 CSV。
- 全界面 **中 / EN** 切换。

### 2. 帕累托浏览器 — `pareto.html`
浏览优化器产出的 114 个设计:
- 交互散点,**坐标轴与颜色可选**(背隙 ↔ 刚度 ↔ 波动 ↔ 压力角 ↔ 鲁棒余量)。
- **点击任意点**查看全部指标,并复制该设计的 SolidWorks 方程。
- 每个设计都**互不支配**、**鲁棒**(±7.5µm 加工误差下仍有余量)、**可加工**(最小曲率半径 ≥ 刀具半径)。

---

## 它算什么

一个模型,产出文献里全部关心的量:

| 指标 | 含义 | 越好方向 |
|---|---|---|
| **背隙** | 空回/回差 [arcmin] | 越小 |
| **扭转刚度** | 单位加载转角能扛的扭矩 [N·m/arcmin] | 越大 |
| **波动** | 一个啮合周期内负载传动误差的峰峰值 [µrad] | 越小 |
| **压力角** | 受载接触点 力向量与运动方向夹角 [deg] | 越小 |
| **公差/鲁棒余量** | ±公差叠加下剩余的自由间隙 [arcmin] | 越大(>0 = 不卡死) |
| **可加工性** | 凹处最小曲率半径 vs 刀具半径 [mm] | 越大 |
| **受载齿数** | 分担额定扭矩的齿数 | 越多 |

---

## 重跑优化器(可选 — Python)

只有当你要为**自己的几何**生成新前沿时才需要 Python。网页里已内嵌一份前沿。

```bash
pip install -r requirements.txt
cd optimizer

python test_model.py        # 快速自检
python benchmark.py         # 复现文献趋势 (5/5)
python optimize.py          # NSGA-II → results/pareto_front.csv (+ 图 + SolidWorks 方程)
python build_pareto_page.py # 从 CSV 重新生成 ../pareto.html
python model.py             # 单个设计的分析图 → results/
```

`optimize.py` 跑真正的 **NSGA-II**(用 `pygad`,无冷门依赖),在 4 谐波齿廓
`δ(θ)=offset+Σₖ cₖ·cos(kNθ)` 上求 4 目标(背隙/刚度/波动/压力角)的帕累托前沿,带硬约束
(鲁棒余量 ≥ 0.5′、可加工、处处去料)。冒烟测试:`QUICK=1 python optimize.py`。

---

## 和论文对标

文献调研(见 git 历史)发现:所谓"用神经网络学最优齿廓"在本领域基本是误解——已发表的 ML 几乎都只是
**代理模型**,用来加速 FEA,外面照样套经典 GA/NSGA-II;设计自由度的突破来自**更丰富的几何参数化**,
而非神经网络。本项目正是这条路(富谐波 + NSGA-II + 加工鲁棒性),`benchmark.py` **5/5** 复现文献定性结论:

1. 修型降低峰值压力角(未修型 ≈85° → ≈55°)。
2. "反弓"修型在刚度和载荷分担上优于纯等距。
3. 受载齿数随扭矩上升(弹性载荷扩散)。
4. 背隙与公差余量单调权衡。
5. 加工误差侵蚀余量——名义最优会卡死,鲁棒设计不会。

物理为准静态、刚性盘、线性化接触——趋势可靠,绝对值为量级估计。要论文级绝对数值,下一步是加载齿接触/FEA。

---

## 部署到 GitHub Pages

静态站点,部署极简。二选一:

**A. 自动(已含工作流)。** 推送到 `main`,`.github/workflows/pages.yml` 会自动发布。
只需启用一次:**Settings → Pages → Build and deployment → Source: GitHub Actions**。

**B. 零配置。** **Settings → Pages → Deploy from a branch → `main` / root**。

站点地址 `https://<你的用户名>.github.io/<仓库名>/`。`index.html` 是首页,`pareto.html` 从中链接。

---

## 许可

MIT,见 [LICENSE](LICENSE)。为 RoboMaster 社区与摆线传动爱好者而作。
