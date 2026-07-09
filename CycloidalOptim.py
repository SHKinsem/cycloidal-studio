import numpy as np
import matplotlib.pyplot as plt

# Rb = 34.0        
# Rr = 2.5
# E  = 2.0
# N  = 14

# Rb = 30
# Rr = 2.5
# E  = 1 
# N  = 24

# Rb = 17
# Rr = 1.5
# E  = 0.5
# N  = 12

# Rb = 16
# Rr = 1.5
# E  = 1
# N  = 12

# Rb = 34  
# Rr = 2.5 
# E  = 1.5 
# N  = 15  

# Delta_offset  = -0.0388  # 等距修型量 [mm]
# Delta_shift   =  0.0188  # 移距修型振幅 [mm]

# —— 1. 基本参数
Rb = 34         # 针齿中心圆半径 [mm]
Rr = 2.5          # 针齿（滚子）半径 [mm]
E  = 1.5          # 偏心距 [mm]
N  = 18           # 摆线盘齿数



Np = N + 1        # 针齿数
Delta_offset  = -0.075  # 等距修型量 [mm]
Delta_shift   =  0.05  # 移距修型振幅 [mm]
theta_max_deg =   0   # 修型顶点角度 [deg]
theta_max_rad = np.deg2rad(theta_max_deg)
DISK_X_SHIFT  = -E   # 仅用于绘图：将摆线盘整体向左平移 [mm] (不影响导出/方程)

# 选择导出给 SolidWorks 的方程变体:
#   'COMPACT' (推荐) | 'SAFE' | 'FULL' | 'MINIMAL'
SW_EQ_VARIANT = 'COMPACT'

# —— 2. 函数定义
def cycloid_base(theta, Rb, E, N):
    """理论摆线曲线（不含滚子补偿）"""
    x_c = Rb * np.cos(theta) + E * np.cos((N+1) * theta)
    y_c = Rb * np.sin(theta) + E * np.sin((N+1) * theta)
    return x_c, y_c

def analytical_normals(theta, Rb, E, N):
    """解析法法向量，指向外侧"""
    dx = -Rb * np.sin(theta) - E*(N+1) * np.sin((N+1)*theta)
    dy =  Rb * np.cos(theta) + E*(N+1) * np.cos((N+1)*theta)
    norm = np.hypot(dx, dy)
    nx =  dy / norm
    ny = -dx / norm
    return nx, ny

def modification_delta(theta, offset, shift, theta_max):
    """对称二次修型量，0→2π端点一致"""
    # phi = (theta - theta_max + np.pi) % (2*np.pi) - np.pi
    # return offset + shift * (phi/np.pi)**2
    # 单齿角度宽度
    tooth_pitch = 2*np.pi / N

    # 将 theta 映射到单齿区间
    phi = (theta % tooth_pitch) - tooth_pitch/2

    # 在每个齿区间内定义修型量
    delta = offset + shift * (phi/(tooth_pitch/2))**2
    
    return delta

# —— 3. 计算标准与修型齿廓
theta = np.linspace(0, 2*np.pi, 10000)

# 基线与法向
x_c, y_c = cycloid_base(theta, Rb, E, N)
nx, ny = analytical_normals(theta, Rb, E, N)

# 标准等距曲线（向内补偿滚子半径）
x_std = x_c - Rr * nx
y_std = y_c - Rr * ny

# 修型量
delta = modification_delta(theta, Delta_offset, Delta_shift, theta_max_rad)

r_norm = np.hypot(x_std, y_std)
rx = x_std / r_norm
ry = y_std / r_norm

# 修型后齿廓
x_mod = x_std + delta * rx
y_mod = y_std + delta * ry


# —— 4. 绘图：齿廓
plt.figure(figsize=(8,8))
# 仅用于显示的平移，不修改原始数据（保持CSV与方程在未平移坐标系下）
x_std_plot = x_std + DISK_X_SHIFT
x_mod_plot = x_mod + DISK_X_SHIFT
plt.plot(x_std_plot, y_std, label=f'Standard Profile (shift {DISK_X_SHIFT}mm)', linewidth=1.5)
plt.plot(x_mod_plot, y_mod, label='Modified Profile (shifted)', linestyle='--', color='red', linewidth=1.5)

# 针齿中心圆
phi = np.linspace(0, 2*np.pi, 200)
plt.plot(Rb*np.cos(phi), Rb*np.sin(phi), 'g--', label='Pin Center Circle')

# 示例针齿
for i in range(Np):
    ang = 2*np.pi * i / Np
    cx, cy = Rb*np.cos(ang), Rb*np.sin(ang)
    circle = plt.Circle((cx, cy), Rr, fill=False, edgecolor='gray', alpha=0.5)
    plt.gca().add_patch(circle)

plt.axis('equal')
plt.grid(True)
plt.legend()
plt.title('Cycloidal Disk Tooth Profiles (Display Shifted Left 1.5mm)\n(Analytical Normals + Quadratic Modification)')
plt.xlabel('X (mm)')
plt.ylabel('Y (mm)')
plt.show()

# —— 5. 绘图：修型量曲线
plt.figure(figsize=(8,4))
plt.plot(np.rad2deg(theta), delta*1000, label='δ(θ) [μm]')
plt.axhline(Delta_offset*1000, color='r', linestyle='--', label='Offset Component')
plt.title('Modification Amount vs. Rolling Angle')
plt.xlabel('Angle θ [deg]')
plt.ylabel('Modification δ(θ) [μm]')
plt.grid(True)
plt.legend()
plt.tight_layout()
plt.show()

# —— 6. 生成SolidWorks参数和方程
def build_equation_variants(Rb, Rr, E, N, Delta_offset, Delta_shift, theta_max_rad):
    """返回不同复杂度的方程字典 {name: (x_eq, y_eq)}"""
    M = N + 1
    tooth_pitch = 2*3.14159 / N  # 单齿角度宽度
    
    # 新的移距修型公式: phi = mod(t, tooth_pitch) - tooth_pitch/2
    # delta = Delta_offset + Delta_shift * (phi / (tooth_pitch/2))^2
    # 简化为: Delta_offset + Delta_shift * ((mod(t, tooth_pitch) - tooth_pitch/2) / (tooth_pitch/2))^2
    
    # 为了 SolidWorks 兼容性，使用: mod(t, tp) 可以表示为 t - tp*floor(t/tp)
    # 但 SolidWorks 不支持 floor，我们使用三角函数周期性实现
    # 更简单的方式：使用 cos(N*t) 来产生 N 个周期的调制
    
    # 每齿周期调制公式（使用余弦函数实现周期性）
    # Python版本: phi = (theta % tooth_pitch) - tooth_pitch/2
    #            delta = offset + shift * (phi/(tooth_pitch/2))^2
    # 其中 phi/(tooth_pitch/2) 范围是 [-1, 1]，平方后 [0, 1]
    
    # SolidWorks近似：使用 cos(N*t) 产生 N 周期调制
    # (1 - cos(N*t))/2 范围是 [0, 1]
    # 在齿中心 (t = 2πk/N) 处，cos(N*t) = 1，调制量 = 0
    # 在齿间隙 (t = π(2k+1)/N) 处，cos(N*t) = -1，调制量 = 1
    tooth_mod_formula = f"((1 - cos({N}*t))/2)"  # 0到1之间周期变化
    
    # 公共分母 (法向归一化) 分拆为内联表达（保持与单行兼容）
    # FULL 版本 (使用新的每齿周期修型)
    full_x = (f"(({Rb}*cos(t) + {E}*cos({M}*t)) - {Rr}*((({Rb}*cos(t) + {E}*{M}*cos({M}*t))"
               f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)) ) + "
               f"({Delta_offset} + {Delta_shift}*{tooth_mod_formula})*((({Rb}*cos(t) + {E}*{M}*cos({M}*t))"
               f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)) ))")
    full_y = (f"(({Rb}*sin(t) + {E}*sin({M}*t)) - {Rr}*((-(-{Rb}*sin(t) - {E}*{M}*sin({M}*t)))"
               f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)) ) + "
               f"({Delta_offset} + {Delta_shift}*{tooth_mod_formula})*((-(-{Rb}*sin(t) - {E}*{M}*sin({M}*t)))"
               f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)) ))")
    
    # SAFE 版本 (使用相同的每齿周期公式)
    safe_x = (f"(({Rb}*cos(t) + {E}*cos({M}*t)) - {Rr}*((({Rb}*cos(t) + {E}*{M}*cos({M}*t))"
               f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)) ) + "
               f"({Delta_offset} + {Delta_shift}*{tooth_mod_formula})*((({Rb}*cos(t) + {E}*{M}*cos({M}*t))"
               f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)) ))")
    safe_y = (f"(({Rb}*sin(t) + {E}*sin({M}*t)) - {Rr}*((-(-{Rb}*sin(t) - {E}*{M}*sin({M}*t)))"
               f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)) ) + "
               f"({Delta_offset} + {Delta_shift}*{tooth_mod_formula})*((-(-{Rb}*sin(t) - {E}*{M}*sin({M}*t)))"
               f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)) ))")
    
    # COMPACT (推荐): base + (delta - Rr)* normal，使用新的每齿修型
    compact_x = (f"{Rb}*cos(t)+{E}*cos({M}*t) + ( {Delta_offset} + {Delta_shift}*{tooth_mod_formula} - {Rr})"
                 f"*( {Rb}*cos(t)+{E}*{M}*cos({M}*t) )/sqrt( (-{Rb}*sin(t)-{E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t)+{E}*{M}*cos({M}*t))^2 )")
    compact_y = (f"{Rb}*sin(t)+{E}*sin({M}*t) + ( {Delta_offset} + {Delta_shift}*{tooth_mod_formula} - {Rr})"
                 f"*( {Rb}*sin(t)+{E}*{M}*sin({M}*t) )/sqrt( (-{Rb}*sin(t)-{E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t)+{E}*{M}*cos({M}*t))^2 )")
    
    # MINIMAL (无修型 delta_shift) 只含滚子补偿
    minimal_x = (f"{Rb}*cos(t) + {E}*cos({M}*t) - {Rr}*((({Rb}*cos(t) + {E}*{M}*cos({M}*t))"
                 f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)))")
    minimal_y = (f"{Rb}*sin(t) + {E}*sin({M}*t) - {Rr}*((-(-{Rb}*sin(t) - {E}*{M}*sin({M}*t))"
                 f"/sqrt((-{Rb}*sin(t) - {E}*{M}*sin({M}*t))^2 + ({Rb}*cos(t) + {E}*{M}*cos({M}*t))^2)))")
    return {
        'FULL': (full_x, full_y),
        'SAFE': (safe_x, safe_y),
        'COMPACT': (compact_x, compact_y),
        'MINIMAL': (minimal_x, minimal_y)
    }

def generate_solidworks_equations():
    """生成SolidWorks等距曲线方程 (带变体选择)"""
    print("=" * 60)
    print("SOLIDWORKS EQUATION-DRIVEN CURVE PARAMETERS")
    print("=" * 60)
    
    # 全局变量
    print("\n1. GLOBAL VARIABLES (Copy & Paste to SolidWorks Equations):")
    print("-" * 50)
    print(f'"Rb" = {Rb}')
    print(f'"Rr" = {Rr}')
    print(f'"E" = {E}')
    print(f'"N" = {N}')
    print(f'"DeltaOffset" = {Delta_offset}')
    print(f'"DeltaShift" = {Delta_shift}')
    print(f'"ThetaMax" = {theta_max_rad}')
    
    # 详细的SolidWorks方程
    print("\n2. SOLIDWORKS EQUATION-DRIVEN CURVE SETUP:")
    print("-" * 50)
    print("Step 1: Create a new sketch")
    print("Step 2: Insert > Curve > Equation Driven Curve")
    print("Step 3: Select 'Parametric' type")
    print("Step 4: Copy and paste the equations below:")
    
    variants = build_equation_variants(Rb, Rr, E, N, Delta_offset, Delta_shift, theta_max_rad)
    chosen_x, chosen_y = variants.get(SW_EQ_VARIANT.upper(), variants['COMPACT'])
    M = N + 1

    print("\n3. VARIANT OVERVIEW:")
    print("-" * 50)
    for k, (vx, vy) in variants.items():
        tag = '<< SELECTED' if k.upper() == SW_EQ_VARIANT.upper() else ''
        print(f"{k}: length(X)={len(vx)} {tag}")

    print(f"\n4. SELECTED VARIANT = {SW_EQ_VARIANT.upper()}  (Paste these into SolidWorks)")
    print("-" * 50)
    print("X(t):")
    print(chosen_x)
    print("Y(t):")
    print(chosen_y)

    print("\n5. (Optional) OTHER VARIANTS (copy if needed):")
    print("-" * 50)
    for name in ['COMPACT','SAFE','FULL','MINIMAL']:
        if name.upper() != SW_EQ_VARIANT.upper():
            ox, oy = variants[name]
            print(f"-- {name} X:")
            print(ox)
            print(f"-- {name} Y:")
            print(oy)
    
    print("\n6. PARAMETER RANGE:")
    print("-" * 50)
    print("Start value: 0")
    print("End value: 6.28318")
    print("Number of points: 500 (or as needed)")
    
    # 简化版本
    print("\n7. MODIFICATION FORMULA:")
    print("-" * 50)
    print("Per-tooth periodic modification using:")
    print(f"delta(t) = {Delta_offset} + {Delta_shift} * ((1 - cos({N}*t))/2)")
    print(f"This creates {N} periodic modifications matching each tooth")
    print("Each tooth has minimum delta at tooth center, maximum between teeth")
    print("Range: [offset, offset+shift] = [{}, {}] mm".format(Delta_offset, Delta_offset + Delta_shift))
    
    print("\n8. SIMPLIFIED BASE (No modification):")
    print("-" * 50)
    print("X equation (standard cycloid only):")
    print(f"{Rb}*cos(t) + {E}*cos(({N}+1)*t)")
    print("Y equation (standard cycloid only):")
    print(f"{Rb}*sin(t) + {E}*sin(({N}+1)*t)")
    
    # 保存方程到文件
    save_equations_to_file()
    
    # 导出点云文件
    print("\n9. ALTERNATIVE: POINT CLOUD FILES")
    print("-" * 50)
    export_to_csv("cycloidal_standard.csv", x_std, y_std)
    export_to_csv("cycloidal_modified.csv", x_mod, y_mod)
    
    print("[OK] cycloidal_standard.csv - Standard profile points")
    print("[OK] cycloidal_modified.csv - Modified profile points")
    print("\nTo use in SolidWorks:")
    print("Insert > Curve > Curve Through XYZ Points > Browse for CSV file")
    print("\nTROUBLESHOOTING (Equations):")
    print("- If equation invalid: start with COMPACT_X / COMPACT_Y first.")
    print("- Ensure parameter type is Parametric and t range 0 to 6.28318.")
    print("- Enter global vars (Rb,Rr,E,N,DeltaOffset,DeltaShift,ThetaMax) before curve.")
    print("- SolidWorks sometimes rejects long equations: paste X, press OK, reopen for Y.")
    print("- If still failing, import CSV and then use 'Fit Spline'.")

def save_equations_to_file():
    variants = build_equation_variants(Rb, Rr, E, N, Delta_offset, Delta_shift, theta_max_rad)
    chosen_x, chosen_y = variants.get(SW_EQ_VARIANT.upper(), variants['COMPACT'])
    with open("solidworks_equations.txt", "w", encoding="utf-8") as f:
        f.write("SOLIDWORKS EQUATION-DRIVEN CURVE PARAMETERS\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"SELECTED VARIANT: {SW_EQ_VARIANT.upper()}\n\n")
        f.write("GLOBAL VARIABLES:\n")
        f.write("-" * 20 + "\n")
        for name, val in [("Rb", Rb),("Rr",Rr),("E",E),("N",N),("DeltaOffset",Delta_offset),("DeltaShift",Delta_shift),("ThetaMax",theta_max_rad)]:
            f.write(f"{name} = {val}\n")
        f.write("\nSELECTED X(t):\n" + chosen_x + "\n\n")
        f.write("SELECTED Y(t):\n" + chosen_y + "\n\n")
        f.write("OTHER VARIANTS (X then Y):\n")
        for k,(vx,vy) in variants.items():
            if k.upper() == SW_EQ_VARIANT.upper():
                continue
            f.write("-- " + k + "\n")
            f.write(vx + "\n")
            f.write(vy + "\n\n")
        f.write("PARAM RANGE: t = 0 .. 6.28318 (rad)\n")
        f.write("Points suggestion: 500\n")
    print("[OK] Equations saved to 'solidworks_equations.txt' (variant=" + SW_EQ_VARIANT + ")")

def export_to_csv(filename, x_coords, y_coords):
    """导出坐标点到CSV文件供SolidWorks使用"""
    # 减少点数以避免文件过大（每20个点取一个）
    step = 20
    x_reduced = x_coords[::step]
    y_reduced = y_coords[::step]
    
    with open(filename, 'w') as f:
        f.write("X,Y,Z\n")  # SolidWorks头文件
        for x, y in zip(x_reduced, y_reduced):
            f.write(f"{x:.6f},{y:.6f},0.000000\n")  # Z=0用于2D轮廓
    
    print(f"[OK] 已导出 {len(x_reduced)} 个点到 {filename}")

# 运行SolidWorks输出
generate_solidworks_equations()
