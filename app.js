import { configure, getState, evaluate, profile, meshState, windup, dwc, rebuildPins, pickRotSign, rebuildOutStage, sobolShutoff, mcYield, thermalDrift, preloadReport } from './physics.js';
// ============================ i18n ============================
const TXT = {
  eyebrow:      { en:'Cycloidal drive · profile designer', zh:'摆线针轮 · 齿廓设计器' },
  title_main:   { en:'Cycloidal Shape Designer', zh:'摆线齿廓设计器' },
  title_thin:   { en:'— tune it, mesh it, export to SolidWorks', zh:'— 调形、啮合、导出 SolidWorks' },
  lede:         { en:"Set your geometry, pick how each part will be made, and the tool converts your shop's real accuracy into the backlash of the units you'd actually build. Then one click finds the tooth modification that still meets your target despite those errors.",
                  zh:'输入几何参数,选好每个零件怎么加工——工具把你车间的真实精度换算成做出来的装机背隙。再一键搜出在这些误差下仍能达标的最优修型。' },
  setup_h:      { en:'Geometry & spec', zh:'几何参数与工况' },
  lbl_Rb:       { en:'pin-circle Rb', zh:'针齿中心圆 Rb' },
  lbl_Rr:       { en:'pin radius Rr', zh:'针齿半径 Rr' },
  lbl_E:        { en:'eccentricity E', zh:'偏心距 E' },
  lbl_N:        { en:'lobes N', zh:'齿数 N' },
  lbl_T:        { en:'rated torque', zh:'额定扭矩' },
  mfg_h:        { en:'Manufacturing plan — pick how each part is made; the ±µm numbers are editable if you know your shop better',
                  zh:'加工方案 —— 选每个零件怎么做,工具替你算公差;更了解你的车间就直接改 ±µm 数值' },
  lbl_prof:     { en:'disk profile', zh:'摆线盘齿廓' },
  lbl_pin:      { en:'pins', zh:'针齿销' },
  lbl_hole:     { en:'pin holes', zh:'针齿孔位' },
  lbl_ecc:      { en:'eccentric E', zh:'偏心距 E' },
  pr_grind:     { en:'profile ground', zh:'磨齿' },
  pr_wslow:     { en:'wire EDM · slow', zh:'慢走丝' },
  pr_wfast:     { en:'wire EDM · fast', zh:'快走丝' },
  pr_mill:      { en:'CNC milled', zh:'CNC 铣' },
  pr_print:     { en:'3D printed', zh:'3D 打印' },
  pr_custom:    { en:'custom', zh:'自定义' },
  pn_ground:    { en:'ground / needle rollers', zh:'研磨销 / 滚针' },
  pn_std:       { en:'dowel pins h7', zh:'标准圆柱销 h7' },
  pn_turn:      { en:'turned', zh:'车削' },
  ho_jig:       { en:'jig-bored / ground', zh:'坐标镗 / 磨' },
  ho_wslow:     { en:'wire EDM · slow', zh:'慢走丝' },
  ho_wfast:     { en:'wire EDM · fast', zh:'快走丝' },
  ho_ream:      { en:'reamed', zh:'铰孔' },
  ho_drill:     { en:'drilled', zh:'钻孔' },
  ec_grind:     { en:'ground', zh:'磨削' },
  ec_turn:      { en:'turned', zh:'车削' },
  src_prof:     { en:'profile', zh:'齿廓' },
  src_pin:      { en:'pins', zh:'针销' },
  src_hole:     { en:'holes', zh:'销孔' },
  src_ecc:      { en:'eccentric', zh:'偏心' },
  bud_lead:     { en:'as-built P95 backlash {p}′ · what drives the spread (remove ⇒ −′) — tighten the top one:',
                  zh:'装机 95分位背隙 {p}′ · 谁主导离散（移除 ⇒ −′）—— 优先收紧最上面那个:' },
  bud_hint:     { en:'· tighten {s} first', zh:'· 先收紧:{s}' },
  lbl_thick:    { en:'disk width', zh:'摆线盘厚度' },
  lbl_cbear:    { en:'bearing clr.', zh:'轴承游隙' },
  lbl_cout:     { en:'output clr.', zh:'输出机构间隙' },
  lbl_zw:       { en:'output pins', zh:'输出销数' },
  lbl_rw:       { en:'output PCR', zh:'输出销中心圆' },
  lbl_rwp:      { en:'output pin r', zh:'输出销半径' },
  lbl_cbrg:     { en:'ecc-bearing C', zh:'偏心轴承额定 C' },
  lbl_nin:      { en:'input speed', zh:'输入转速' },
  lbl_dt:       { en:'temp rise ΔT', zh:'温升 ΔT' },
  lbl_cteh:     { en:'housing CTE', zh:'壳体热膨胀' },
  lbl_cted:     { en:'gear CTE', zh:'摆线盘热膨胀' },
  lbl_mu:       { en:'friction µ', zh:'摩擦系数 µ' },
  lbl_ndisc:    { en:'discs (phased)', zh:'摆线盘数(相位)' },
  lbl_rtool:    { en:'tool radius', zh:'刀具半径' },
  lbl_adje:     { en:'adjustable ecc', zh:'可调偏心' },
  adje_unit:    { en:'matched assy', zh:'配对装配' },
  adje_on:      { en:'· dial E per unit', zh:'· 每台调E' },
  lbl_orol:     { en:'output rollers', zh:'输出销滚子' },
  orol_unit:    { en:'rolling', zh:'滚动接触' },
  warn:         { en:"Geometry undercuts — the unmodified tooth can't mesh with all pins. Reduce E or increase Rb.",
                  zh:'几何根切 —— 未修型齿廓无法与全部针齿共轭啮合。请减小 E 或增大 Rb。' },
  mesh_h:       { en:'Mesh', zh:'啮合' },
  mesh_aux:     { en:'ratio {R}:1 · output frame', zh:'减速比 {R}:1 · 输出坐标系' },
  jam:          { en:'Worst-case jam — locks if every manufacturing error lands at its tightest', zh:'最坏卡死 —— 所有加工误差同时取最坏时摆线盘锁死' },
  play_pause:   { en:'❚❚ pause', zh:'❚❚ 暂停' },
  play_play:    { en:'▶ play', zh:'▶ 播放' },
  speed:        { en:'speed', zh:'速度' },
  lg_pins:      { en:'pins / housing', zh:'针齿 / 壳体' },
  lg_disk:      { en:'disk (your design)', zh:'摆线盘（你的设计）' },
  lg_load:      { en:'tooth under load', zh:'受载齿' },
  mod_h:        { en:'Modification', zh:'修型' },
  preset_uniform:{ en:'uniform', zh:'等距' },
  preset_deep:  { en:'deep', zh:'深修' },
  preset_ga:    { en:'GA optimum', zh:'GA 最优' },
  lbl_offset:   { en:'offset', zh:'等距量' },
  desc_offset:  { en:'even removal', zh:'均匀去料' },
  desc_c1:      { en:'tip ↔ root bias', zh:'齿顶↔齿根偏置' },
  desc_c2:      { en:'mid-flank (reverse-bow)', zh:'齿腰（反弓）' },
  desc_c3:      { en:'flank fine shape', zh:'齿面细部' },
  desc_c4:      { en:'flank fine shape', zh:'齿面细部' },
  m_backlash:   { en:'backlash', zh:'背隙' },
  sub_backlash: { en:'zero-error ideal, mesh only', zh:'零误差理想值,仅啮合' },
  m_asbuilt:    { en:'as-built backlash', zh:'装机背隙(预测)' },
  sub_asbuilt:  { en:'Monte-Carlo over your plan · typical–95%', zh:'按加工方案抽样 400 台 · 典型–95%分位' },
  mc_jam:       { en:'% jam', zh:'% 卡死' },
  m_syslm:      { en:'system lost motion', zh:'系统空回' },
  sub_syslm:    { en:'mesh + bearing clr + output pin-hole', zh:'啮合 + 轴承游隙 + 输出销孔' },
  m_stiff:      { en:'stiffness', zh:'刚度' },
  sub_stiff:    { en:'system: mesh ⊕ output pin-hole (bearings excl.)', zh:'系统：啮合 ⊕ 输出销孔（不含支承轴承）' },
  m_stress:     { en:'contact stress', zh:'接触应力' },
  sub_stress:   { en:'peak Hertz pressure, loaded pin', zh:'峰值赫兹接触压力' },
  m_safety:     { en:'safety factor', zh:'安全系数' },
  sub_safety:   { en:'vs 1500 MPa contact-fatigue limit', zh:'相对 1500 MPa 接触疲劳极限' },
  overload:     { en:'· overstressed', zh:'· 超载' },
  m_ripple:     { en:'ripple', zh:'波动' },
  sub_ripple:   { en:'wind-up variation = smoothness', zh:'加载转角波动 = 丝滑度' },
  m_rmargin:    { en:'worst-case margin', zh:'最坏余量' },
  sub_rmargin:  { en:'every error at its tightest — >0 still assembles', zh:'全部误差取最紧 — >0 仍可装配' },
  m_teeth:      { en:'loaded teeth', zh:'受载齿数' },
  sub_teeth:    { en:'sharing the rated torque', zh:'分担额定扭矩' },
  m_pa:         { en:'pressure angle', zh:'压力角' },
  grp_sys:      { en:'system', zh:'系统' },
  grp_dur:      { en:'durability', zh:'耐久' },
  grp_th:       { en:'thermal', zh:'热' },
  grp_mfg:      { en:'manufacturability', zh:'可制造性' },
  m_ostress:    { en:'output-pin stress', zh:'输出销应力' },
  sub_ostress:  { en:'Hertz on output pins · safety', zh:'输出销赫兹应力 · 安全系数' },
  m_life:       { en:'bearing life', zh:'轴承寿命' },
  sub_life:     { en:'eccentric-bearing L10 · mesh + output reaction', zh:'偏心轴承 L10 · 啮合+输出反力' },
  m_thermal:    { en:'thermal drift', zh:'热漂移' },
  sub_thermal:  { en:'backlash at ΔT · housing↔gear CTE mismatch', zh:'温升下背隙 · 壳体↔盘热膨胀失配' },
  th_off:       { en:'set ΔT to check', zh:'设温升以检查' },
  m_eff:        { en:'mesh efficiency', zh:'啮合效率' },
  sub_eff:      { en:'sliding loss · mesh + output pins · fwd / backdrive', zh:'滑动损耗 · 啮合+输出销 · 正驱/反驱' },
  m_wear:       { en:'sliding / wear', zh:'滑动 / 磨损' },
  sub_wear:     { en:'peak slip · PV scuffing-wear index', zh:'峰值滑动 · PV 胶合磨损指标' },
  nonbd:        { en:'non-backdrive', zh:'不可逆' },
  m_preload:    { en:'preload for zero backlash', zh:'零背隙预紧' },
  sub_preload:  { en:'min interference · no-load stiffness k₀ · drag', zh:'最小过盈 · 空载刚度 k₀ · 拖曳扭矩' },
  m_minr:       { en:'min flank radius', zh:'最小齿面半径' },
  sub_minr:     { en:'tightest concave curvature vs finishing tool', zh:'最紧凹曲率 vs 精加工刀具' },
  cuspword:     { en:'⚠ self-intersects (cusp)', zh:'⚠ 自交(尖点)' },
  tooth_h:      { en:'Tooth flank', zh:'齿面' },
  tooth_aux:    { en:'one tooth · modification', zh:'单齿 · 修型' },
  lg_unmod:     { en:'unmodified (pure conjugate)', zh:'未修型（纯共轭）' },
  lg_mod:       { en:'modified flank', zh:'修型后齿面' },
  clr_h:        { en:'Clearance across one tooth', zh:'单齿间隙分布' },
  clr_aux:      { en:'normal gap vs mesh phase', zh:'法向间隙 vs 啮合相位' },
  lg_shipped:   { en:'shipped design', zh:'当前出图设计' },
  lg_uniform:   { en:'uniform', zh:'等距' },
  lg_yours:     { en:'your design', zh:'你的设计' },
  lg_tol:       { en:'worst-case error', zh:'最坏总误差' },
  export_h:     { en:'Export to SolidWorks', zh:'导出到 SolidWorks' },
  export_sub:   { en:'equation-driven curve · numbers baked in · units mm', zh:'方程驱动曲线 · 数值已内联 · 单位 mm' },
  btn_copyx:    { en:'Copy X(t)', zh:'复制 X(t)' },
  btn_copyy:    { en:'Copy Y(t)', zh:'复制 Y(t)' },
  btn_copyboth: { en:'Copy both', zh:'复制两式' },
  btn_csv:      { en:'Download point-cloud CSV', zh:'下载点云 CSV' },
  copied:       { en:'✓ copied', zh:'✓ 已复制' },
  tight:        { en:'· tight', zh:'· 偏紧' },
  jamword:      { en:'· jam', zh:'· 卡死' },
  riskword:     { en:'· jam risk', zh:'· 卡死风险' },
  opt_h:        { en:'Optimize for this geometry', zh:'为当前几何搜索最优' },
  opt_sub:      { en:'one click → the optimal curve loaded into the sliders, judged on the backlash of the units you\'d actually build', zh:'一键 → 最优曲线直接载入滑块;达标与否按"做出来的装机背隙"判定' },
  opt_run:      { en:'◆ Get the optimal curve', zh:'◆ 一键生成最优曲线' },
  opt_running:  { en:'searching…', zh:'搜索中…' },
  opt_result:   { en:'✓ Optimal curve loaded · backlash {b}′ (as-built ≤{a}′) · ripple {r} µrad · efficiency {e}% — SolidWorks equation ready below ↓',
                  zh:'✓ 最优曲线已载入 · 背隙 {b}′（装机 ≤{a}′）· 波动 {r} µrad · 效率 {e}% —— 下方 SolidWorks 方程就绪 ↓' },
  adv_params:   { en:'Advanced (system, durability, thermal — rarely needed; sensible defaults)',
                  zh:'高级参数（系统 / 耐久 / 热 —— 少用，已给合理默认值）' },
  adv_metrics:  { en:'More metrics (durability, system, thermal, manufacturability)',
                  zh:'更多指标（耐久 / 系统 / 热 / 可制造性）' },
  opt_hint:     { en:'Set the geometry & tolerance above, then click — you get one modified curve: min backlash, smoothest backdrive, efficient.',
                  zh:'设好上方几何与公差,点一下 —— 直接给你一条修形曲线：背隙最小、反驱最丝滑、效率最优。' },
  opt_stale:    { en:'⟳ inputs changed — re-run to update the front', zh:'⟳ 参数已改 — 重新搜索以更新前沿' },
  opt_none:     { en:'no feasible design in range — loosen the manufacturing plan or geometry', zh:'范围内无可行解 — 放宽加工方案或几何' },
  opt_lg:       { en:'non-dominated designs (backlash ↔ stiffness, colour = pressure angle)',
                  zh:'非支配设计 (背隙 ↔ 刚度, 颜色 = 压力角)' },
  opt_ghost:    { en:'run once to see the design front', zh:'运行一次即可看到设计前沿' },
  opt_err:      { en:'optimizer error (see console)', zh:'优化器出错（见控制台）' },
  opt_prog:     { en:'{p}% · {n} designs', zh:'{p}% · 已找到 {n} 个设计' },
  opt_load:     { en:'load into sliders →', zh:'载入滑块 →' },
  pin_on:       { en:'pin — keeps this chart on screen while you scroll & tune', zh:'钉住 — 滚动/调参时保持可见' },
  pin_off:      { en:'unpin — back to its place', zh:'取消钉住 — 回到原位' },
  how:          { en:'In SolidWorks: Insert → Curve → Equation Driven Curve → Parametric. Set t from 0 to 6.28318, paste X(t) and Y(t). Or import the CSV via Insert → Curve → Curve Through XYZ Points, then Fit Spline.',
                  zh:'在 SolidWorks 中：插入 → 曲线 → 方程驱动曲线 → 参数化。设 t 从 0 到 6.28318，粘贴 X(t) 与 Y(t)。或用 插入 → 曲线 → 通过 XYZ 点的曲线 导入 CSV，再用 拟合样条。' },
  c_tip:        { en:'tip', zh:'齿顶' },
  c_root:       { en:'root', zh:'齿根' },
  c_mid:        { en:'mid-flank', zh:'齿腰' },
  c_clr:        { en:'clearance µm', zh:'间隙 µm' },
  c_stack:      { en:'worst-case error', zh:'最坏总误差' },
  footer_read:  { en:"Reading it: tight at the mid-flank (where the arm is longest) carries load with little lost motion — that buys stiffness and low backlash. Relieved at tip and root leaves room for the tolerance stack and softens entry/exit shock. That reverse-bow, sitting right at the tolerance edge, is what the GA optimum finds.",
                  zh:'看图：齿腰（力臂最长处）最紧 —— 用极小的空回承载，换来高刚度、低背隙；齿顶与齿根放松 —— 给公差叠加留余量、缓和入啮/出啮冲击。这条贴着公差边界的"反弓"曲线，正是 GA 最优解。' },
  footer_note:  { en:'Model: quasi-static, rigid disk, linearised load-sharing (K ∝ disk width; 50 N/µm per tooth at 10 mm). As-built backlash is a 400-sample Monte-Carlo over the per-part manufacturing errors (pin batch common-mode; holes and flank independent per pin; eccentricity via finite-difference gap sensitivity); worst-case numbers put every error at its extreme simultaneously. System lost motion adds bearing/output clearances as lumped deadbands; contact stress is a Hertz line-contact post-process (steel, 1500 MPa fatigue limit). Trends are faithful; absolute values are order-of-magnitude. No lubricant film / dynamics.',
                  zh:'模型：准静态、刚性盘、线性化载荷分配（K∝盘宽，10mm 时 50 N/µm 每齿）。装机背隙为对各加工误差源做 400 次蒙特卡洛抽样（针销同批共模;销孔与齿面逐针独立;偏心距经有限差分间隙灵敏度折算）;"最坏"类指标为全部误差同时取极值。系统空回把轴承与输出机构间隙作为集总死区叠加；接触应力是赫兹线接触后处理（钢，1500 MPa 疲劳极限）。趋势可靠，绝对值为量级估计。未含油膜与动力学。' },
};
const NK = 4;   // number of harmonics in the modification δ(θ)=offset+Σ_{k=1}^{NK} c_k·cos(kNθ)
const state = { offset:-0.0209, coeffs:[-0.0012,-0.0037,0,0], psi:0, playing:true, speed:0.45, exag:40, lang:'en' };
function t(key){ const e=TXT[key]; return e ? (e[state.lang]||e.en) : key; }

// ============================ presets, colors, baseline ============================
const PRESETS = {
  uniform: { offset:-0.040,  coeffs:[0,0,0,0] },
  deep:    { offset:-0.075,  coeffs:[0,0,0,0] },
  ga:      { offset:-0.0209, coeffs:[-0.0012,-0.0037,0,0] },   // low-backlash reverse-bow (5.06', stiff 35.7)
};
const css = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
const COL = {};
for (const k of ['blue','orange','green','hot','danger','steel','ink','ink-2','ink-3','line','line-2','panel'])
  COL[k] = css('--'+k);
const MONO = css('--mono');   // cached: getComputedStyle per frame is measurable jank
let BASE = null;  // pertooth reference at current geometry, for delta arrows

// ============================ canvas helpers ============================
const I = id => document.getElementById(id);
function fit(cv){
  const dpr=Math.min(window.devicePixelRatio||1, 2);
  const w=cv.clientWidth, h=cv.clientHeight, bw=Math.round(w*dpr), bh=Math.round(h*dpr);
  if(cv.width!==bw||cv.height!==bh){ cv.width=bw; cv.height=bh; }   // realloc only on resize, not every animation frame
  const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w,h};
}

// ---- mesh ----
const stage=I('stage');
let meshProf=null;
function drawMesh(){
  const {Rb,Rr,Np,PINS}=getState();
  const {ctx,w,h}=fit(stage);
  ctx.clearRect(0,0,w,h);
  const cx=w/2, cy=h/2, R=Math.min(w,h)/2-14, sc=R/(Rb+Rr+2.5);
  const toX=x=>cx+x*sc, toY=y=>cy-y*sc;
  ctx.strokeStyle=COL.steel; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(cx,cy,(Rb+Rr+1.6)*sc,0,2*Math.PI); ctx.stroke();
  const ms=meshState(meshProf,state.psi), wnd=windup(ms.gaps,ms.arms), Fmax=Math.max(1e-9,...wnd.F);
  for(let j=0;j<Np;j++){
    const [px,py]=PINS[j], f=wnd.F[j]/Fmax;
    if(f>0.02){ ctx.beginPath(); ctx.arc(toX(px),toY(py),Rr*sc+7,0,2*Math.PI); ctx.fillStyle=`rgba(250,178,25,${0.05+0.22*f})`; ctx.fill(); }
    ctx.beginPath(); ctx.arc(toX(px),toY(py),Rr*sc,0,2*Math.PI);
    ctx.strokeStyle= f>0.02 ? COL.hot : COL.steel; ctx.lineWidth= f>0.02?1.6:1; ctx.stroke();
  }
  const {X,Y}=meshProf, co=Math.cos(ms.rot), si=Math.sin(ms.rot);
  ctx.beginPath();
  for(let i=0;i<X.length;i++){ const wx=co*X[i]-si*Y[i]+ms.cx, wy=si*X[i]+co*Y[i]+ms.cy; const sx=toX(wx), sy=toY(wy); i?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy); }
  ctx.closePath(); ctx.fillStyle='rgba(34,184,146,0.07)'; ctx.fill(); ctx.strokeStyle=COL.green; ctx.lineWidth=1.5; ctx.stroke();
  ctx.strokeStyle=COL['line-2']; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(toX(0),toY(0)); ctx.lineTo(toX(ms.cx),toY(ms.cy)); ctx.stroke();
  ctx.beginPath(); ctx.arc(toX(ms.cx),toY(ms.cy),3,0,2*Math.PI); ctx.fillStyle=COL.ink; ctx.fill();
  ctx.beginPath(); ctx.arc(toX(0),toY(0),2,0,2*Math.PI); ctx.fillStyle=COL['ink-3']; ctx.fill();
  for(let j=0;j<Np;j++){ if(wnd.F[j]/Fmax>0.02){ ctx.beginPath(); ctx.arc(toX(ms.cpx[j]),toY(ms.cpy[j]),2.4,0,2*Math.PI); ctx.fillStyle=COL.hot; ctx.fill(); } }
}

// ---- tooth flank ----
const tooth=I('tooth');
function drawTooth(){
  const {Rb,Rr,E,N,M}=getState();
  const {ctx,w,h}=fit(tooth);
  ctx.clearRect(0,0,w,h);
  const tp=2*Math.PI/N, span=tp*0.60, ex=state.exag, nS=280;
  const bx=[],by=[],mx=[],my=[];
  for(let k=0;k<=nS;k++){
    const th=-span+(2*span)*k/nS;
    const xc=Rb*Math.cos(th)+E*Math.cos(M*th), yc=Rb*Math.sin(th)+E*Math.sin(M*th);
    const dx=-Rb*Math.sin(th)-E*M*Math.sin(M*th), dy=Rb*Math.cos(th)+E*M*Math.cos(M*th);
    const nn=Math.hypot(dx,dy), nx=dy/nn, ny=-dx/nn;
    let d=state.offset; for(let kk=0;kk<state.coeffs.length;kk++) d+=state.coeffs[kk]*Math.cos((kk+1)*N*th);
    const bxr=xc-Rr*nx, byr=yc-Rr*ny, mxr=xc-Rr*nx+d*ex*nx, myr=yc-Rr*ny+d*ex*ny;
    bx.push(-byr); by.push(bxr); mx.push(-myr); my.push(mxr);  // rotate tip-up
  }
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  for(let k=0;k<bx.length;k++){ minx=Math.min(minx,bx[k],mx[k]); maxx=Math.max(maxx,bx[k],mx[k]); miny=Math.min(miny,by[k],my[k]); maxy=Math.max(maxy,by[k],my[k]); }
  const pad=32, sc=Math.min((w-2*pad)/(maxx-minx),(h-2*pad)/(maxy-miny));
  const ox=(w-(maxx-minx)*sc)/2-minx*sc, oyTop=(h-(maxy-miny)*sc)/2;
  const X=x=>ox+x*sc, Y=y=>oyTop+(maxy-y)*sc;
  ctx.beginPath();
  for(let k=0;k<bx.length;k++){ const x=X(bx[k]),y=Y(by[k]); k?ctx.lineTo(x,y):ctx.moveTo(x,y); }
  for(let k=mx.length-1;k>=0;k--){ ctx.lineTo(X(mx[k]),Y(my[k])); }
  ctx.closePath(); ctx.fillStyle='rgba(34,184,146,0.10)'; ctx.fill();
  const stroke=(XS,YS,c,wd)=>{ ctx.beginPath(); for(let k=0;k<XS.length;k++){const x=X(XS[k]),y=Y(YS[k]); k?ctx.lineTo(x,y):ctx.moveTo(x,y);} ctx.strokeStyle=c; ctx.lineWidth=wd; ctx.stroke(); };
  stroke(bx,by,'#8b96a6',1.6); stroke(mx,my,COL.green,2.2);
  ctx.fillStyle=COL['ink-3']; ctx.font='13px '+MONO; ctx.textAlign='center';
  ctx.fillText(t('c_root'), X(bx[6]), Y(by[6])+16);
  ctx.fillText(t('c_tip'), X(bx[Math.round(nS/2)]), Y(by[Math.round(nS/2)])-13);
  ctx.fillText(t('c_root'), X(bx[bx.length-6]), Y(by[by.length-6])+16);
}

// ---- clearance ----
const clr=I('clr');
function clearanceCurve(offset,coeffs,variant){
  const prof=profile(offset,coeffs,4000,variant), ms=meshState(prof,0);
  const idx=[...ms.uu.keys()].sort((a,b)=>ms.uu[a]-ms.uu[b]);
  return idx.map(j=>[ms.uu[j], ms.gaps[j]*1e3]);
}
function drawClearance(){
  const {ctx,w,h}=fit(clr);
  ctx.clearRect(0,0,w,h);
  const padL=50, padR=14, padT=14, padB=28;
  const series=[
    ['shipped', ()=>clearanceCurve(-0.075,[0.05],'pertooth'),                COL.blue,   1.5],
    ['uniform', ()=>clearanceCurve(-0.040,[0,0,0,0],'harmonic'),             COL.orange, 1.5],
    ['yours',   ()=>clearanceCurve(state.offset,state.coeffs,'harmonic'),    COL.green, 2.4],
  ].map(([n,f,c,wd])=>({n,c,wd,data:f()}));
  let ymin=10, ymax=Math.max(20, dwc()*1e3+5);
  for(const s of series) for(const d of s.data){ ymin=Math.min(ymin,d[1]); ymax=Math.max(ymax,d[1]); }
  ymin=Math.floor((ymin-2)/5)*5; ymax=Math.ceil((ymax+2)/5)*5;
  const mapx=u=>padL+u*(w-padL-padR), mapy=v=>padT+(ymax-v)/(ymax-ymin)*(h-padT-padB);
  ctx.font='12px '+MONO; ctx.textAlign='right'; ctx.textBaseline='middle';
  for(let v=ymin; v<=ymax; v+=10){
    ctx.strokeStyle=COL.line; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(padL,mapy(v)); ctx.lineTo(w-padR,mapy(v)); ctx.stroke();
    ctx.fillStyle=COL['ink-3']; ctx.fillText(v, padL-6, mapy(v));
  }
  const DWU=dwc()*1e3;
  ctx.strokeStyle=COL.danger; ctx.lineWidth=1.3; ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.moveTo(padL,mapy(DWU)); ctx.lineTo(w-padR,mapy(DWU)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle=COL.danger; ctx.textAlign='left'; ctx.fillText(`±${DWU.toFixed(0)} µm ${t('c_stack')}`, padL+4, mapy(DWU)-8);
  ctx.fillStyle=COL['ink-3']; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText(t('c_tip'), mapx(0), h-9); ctx.fillText(t('c_mid'), mapx(0.25), h-9);
  ctx.fillText(t('c_root'), mapx(0.5), h-9); ctx.fillText(t('c_mid'), mapx(0.75), h-9); ctx.fillText(t('c_tip'), mapx(0.98), h-9);
  ctx.textAlign='right'; ctx.save(); ctx.translate(13,h/2); ctx.rotate(-Math.PI/2); ctx.textAlign='center'; ctx.fillText(t('c_clr'),0,0); ctx.restore();
  for(const s of series){
    ctx.beginPath(); s.data.forEach((d,i)=>{ const x=mapx(d[0]),y=mapy(d[1]); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.strokeStyle=s.c; ctx.lineWidth=s.wd; ctx.stroke();
  }
}

// ============================ metrics ============================
const fmt=(x,d=2)=> (isFinite(x)? x.toFixed(d): '—');
function deltaTag(now, base, better){
  if(!isFinite(now)||!isFinite(base)) return '';
  const d=now-base; if(Math.abs(d)<1e-6) return '';
  const good = better==='high' ? d>0 : d<0;
  return `<span class="delta ${good?'up':'down'}">${d>0?'▲':'▼'}${Math.abs(d).toFixed(better==='ripple'?0:1)}</span>`;
}
function lifeStr(r){   // eccentric-bearing L10: revolutions (speed-free) unless an input speed is given → hours
  const {N_IN}=getState();
  const rev=r.L10rev; if(!isFinite(rev)||rev<=0) return '∞';
  if(N_IN>0){ return `${fmt(rev/(60*N_IN),0)}<u>h @${N_IN|0} rpm</u>`; }
  const m=rev/1e6; return `${m>=1000? fmt(m/1000,1)+'×10⁹' : fmt(m,0)+'×10⁶'}<u> rev</u>`;
}
function updateMetrics(){
  const {Np,ERR,R_TOOL,DELTA_T,N_DISC,A_ADJ}=getState();
  const mc=sobolShutoff(state.offset,state.coeffs);   // full MC distribution + per-source shut-off ranking; also refreshes SENS_E
  const r=evaluate(state.offset,state.coeffs);
  const set=(id,html,cls)=>{ const el=I(id); el.innerHTML=html; el.className='v'+(cls?' '+cls:''); };
  set('m-backlash', `${fmt(r.backlash)}<u>′</u> ${deltaTag(r.backlash,BASE&&BASE.backlash,'low')}`);
  const jstate = mc.jam>0.05?'bad':(mc.jam>0?'warn':'');
  const jcue = mc.jam>0? ` <u>${(mc.jam*100).toFixed(0)}${t('mc_jam')}</u>`:'';
  const adjTag = A_ADJ? ` <u>${t('adje_on')}</u>` : '';
  set('m-asbuilt',  mc.jam>=0.5? `—${jcue}${adjTag}` : `${fmt(mc.p50,1)}–${fmt(mc.p95,1)}<u>′</u>${jcue}${adjTag}`, jstate);
  set('m-syslm',    `${fmt(r.sysLM)}<u>′</u>`);
  set('m-stiff',    `${fmt(r.stiff,1)}<u>N·m/′</u> ${deltaTag(r.stiff,BASE&&BASE.stiff,'high')}`);
  set('m-stress',   `${fmt(r.sigmaH,0)}<u>MPa</u>`);
  const sfstate = r.safety<1?'bad':(r.safety<1.2?'warn':'');
  const sfcue = sfstate==='bad'?` <u>${t('overload')}</u>` : sfstate==='warn'?` <u>${t('tight')}</u>` : '';
  set('m-safety',   `${fmt(r.safety,2)}<u>×</u>${sfcue}`, sfstate);
  set('m-ripple',   `${fmt(r.ripple,1)}<u>µrad${N_DISC>1?` · ${N_DISC}-disc`:''}</u> ${deltaTag(r.ripple,BASE&&BASE.ripple,'ripple')}`);
  const rstate = r.rmargin<=0?'bad':(r.rmargin<0.5?'warn':'');
  const rcue = rstate==='bad'?` <u>${t('jamword')}</u>` : rstate==='warn'?` <u>${t('tight')}</u>` : '';
  set('m-rmargin',  `${fmt(Math.max(r.rmargin,-99))}<u>′</u>${rcue}`, rstate);   // deep interference: the cue matters, not the number
  set('m-teeth',    `${r.n_eng}<u>/ ${Np}${N_DISC>1?' ·/disc':''}</u>`);
  set('m-ostress',  `${fmt(r.outSigma,0)}<u>MPa · ${fmt(r.outSafety,2)}×</u>`, r.outSafety<1?'bad':(r.outSafety<1.2?'warn':''));
  set('m-life',     lifeStr(r));
  const th=thermalDrift(state.offset,state.coeffs);
  set('m-thermal',  th.active? `${fmt(th.backlash)}<u>′ @${DELTA_T|0}°C · ${th.dRb>0?'+':''}${fmt(th.dRb,1)}µm</u>${th.jam?` <u>${t('jamword')}</u>`:''}` : `<u>${t('th_off')}</u>`,
                    th.active&&th.jam?'bad':(th.active&&th.rmargin<0.5?'warn':''));
  set('m-eff',      `${fmt(r.eta*100,1)}<u>% · back ${r.etaBd>0?fmt(r.etaBd*100,0)+'%':t('nonbd')}</u>`);
  set('m-wear',     `${fmt(r.vsMax,2)}<u> mm/rad · PV ${fmt(r.pvMax,0)}</u>`);
  const pl=preloadReport(state.offset,state.coeffs);
  set('m-preload',  `≥${fmt(pl.pmin,0)}<u>µm → k₀ ${fmt(pl.kNoLoad,0)} · drag ${fmt(pl.drag,2)}N·m</u>`);
  set('m-minr',     r.cusp? `<u>${t('cuspword')}</u>` : `${fmt(r.rmin,2)}<u>mm ${r.rmin>=R_TOOL?'✓':'✗'} vs tool ${R_TOOL}</u>`,
                    r.cusp||r.rmin<R_TOOL?'bad':'');
  I('jam').classList.toggle('on', r.rmargin<=0);
  // error budget: each source's TRUE p95 contribution (shut-off = re-sample with that source removed),
  // biggest first → tells you which tolerance to tighten. Correctly de-ranks the per-unit-independent hole
  // error that the old coherent worst-case lever over-weighted.
  const names=[t('src_prof'),t('src_pin'),t('src_hole'),t('src_ecc')];
  const vals=[ERR.prof,ERR.pin,ERR.hole,ERR.ecc];
  const drops=mc.drops;
  const order=[0,1,2,3].sort((a,b)=>drops[b]-drops[a]);
  const dmax=Math.max(0.01,...drops);
  I('budget').innerHTML =
    `<b>${t('bud_lead').replace('{p}',mc.p95.toFixed(1))}</b><br>`+
    order.map(i=>`<span class="src"><i class="bar" style="width:${Math.max(3,42*drops[i]/dmax)|0}px"></i>${names[i]} ±${vals[i]}µm → ${drops[i]>=0.05?'−'+drops[i].toFixed(1)+'′':'~0'}</span>`).join('')+
    ` <span class="hint">${t('bud_hint').replace('{s}',names[order[0]])}</span>`;
}

// ============================ SolidWorks export ============================
const g = x => String(Math.round(x*1e6)/1e6);
function swEquations(){
  const {Rb,E,M,Rr,N}=getState();
  const dterms=state.coeffs.map((c,k)=>`${g(c)}*cos(${(k+1)*N}*t)`).join(' + ');
  const d=`(${g(state.offset)} + ${dterms})`;
  const den=`sqrt( (-${g(Rb)}*sin(t)-${g(E)}*${M}*sin(${M}*t))^2 + (${g(Rb)}*cos(t)+${g(E)}*${M}*cos(${M}*t))^2 )`;
  const X=`${g(Rb)}*cos(t)+${g(E)}*cos(${M}*t) + ( ${d} - ${g(Rr)} )*( ${g(Rb)}*cos(t)+${g(E)}*${M}*cos(${M}*t) )/${den}`;
  const Y=`${g(Rb)}*sin(t)+${g(E)}*sin(${M}*t) + ( ${d} - ${g(Rr)} )*( ${g(Rb)}*sin(t)+${g(E)}*${M}*sin(${M}*t) )/${den}`;
  return {X,Y};
}
function refreshExport(){
  const {X,Y}=swEquations();
  I('eq-x').textContent=X; I('eq-y').textContent=Y;
}
function flashCopied(btn){ const key=btn.dataset.i18n; btn.textContent=t('copied'); setTimeout(()=>{ btn.textContent=t(key); },1200); }
function copyText(txt, btn){
  const ok=()=>flashCopied(btn);
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(ok).catch(()=>fallbackCopy(txt,ok)); }
  else fallbackCopy(txt,ok);
}
function fallbackCopy(txt,ok){ const ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){} document.body.removeChild(ta); ok(); }
function downloadCSV(){
  const {Rb,N}=getState();
  const prof=profile(state.offset,state.coeffs,4000,'harmonic');
  let s="X,Y,Z\n"; for(let i=0;i<prof.X.length;i+=20) s+=`${prof.X[i].toFixed(6)},${prof.Y[i].toFixed(6)},0.000000\n`;
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([s],{type:'text/csv'}));
  a.download=`cycloid_Rb${g(Rb)}_N${N}_off${g(state.offset*1e3)}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
}

// ============================ language ============================
function playLabel(){ return t(state.playing?'play_pause':'play_play'); }
function applyLang(lang){
  state.lang=lang;
  document.documentElement.lang = lang==='zh'?'zh-CN':'en';
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent=t(el.dataset.i18n); });
  I('ratio').textContent=t('mesh_aux').replace('{R}', getState().N);
  I('play').textContent=playLabel();
  I('lang-en').classList.toggle('on', lang==='en');
  I('lang-zh').classList.toggle('on', lang==='zh');
  updateMetrics();
  drawTooth(); drawClearance();
  updatePinGlyphs();
  if(typeof OPT!=='undefined'){
    if(!OPT.ran) setOptStat(t('opt_hint'));
    else if(OPT.front.length && !OPT.running) applyGoalPick(false);   // re-render the verdict in the new language
    drawOptPlot(); if(OPT.sel>=0) showPick();
  }
}

// ============================ geometry / interaction ============================
const clampNum=(v,a,b)=>Math.max(a,Math.min(b,v));
function applyGeometry(){
  configure({
    Rb:clampNum(+I('g-Rb').value||34, 15, 120),
    Rr:clampNum(+I('g-Rr').value||2.5, 0.5, 12),
    E :clampNum(+I('g-E').value||1.5, 0.2, 6),
    N :Math.round(clampNum(+I('g-N').value||18, 6, 40)),
    T_RATED:clampNum(+I('g-T').value||30, 1, 500),
  });
  readSpec(); readErr();
  rebuildPins();
  pickRotSign();
  I('warn').classList.toggle('on', getState().GEOM_WORST>0.003);
  BASE=evaluate(-0.075,[0.05],8000,'pertooth');
  I('ratio').textContent=t('mesh_aux').replace('{R}', getState().N);
  invalidateOpt();      // the current front was for the old geometry
  afterChange();
}
function readSpec(){   // durability / lost-motion spec — affects metrics only, not the profile or pins
  configure({
    L_TOOTH:clampNum(+I('g-thick').value||10, 1, 100),
    C_BEAR :clampNum(+I('g-cbear').value||0, 0, 100)/1000,
    C_OUT  :clampNum(+I('g-cout').value||0, 0, 100)/1000,
    R_W  :clampNum(+I('g-rw').value||20, 3, 110),
    Z_W  :Math.round(clampNum(+I('g-zw').value||8, 3, 24)),
    RW_PIN:clampNum(+I('g-rwp').value||3, 0.5, 20),
    C_BRG:clampNum(+I('g-cbrg').value||10000, 100, 1e6),
    N_IN :clampNum(+I('g-nin').value||0, 0, 100000),
    DELTA_T:clampNum(+I('g-dt').value||0, -100, 300),
    CTE_H  :clampNum(+I('g-cteh').value||23, 0, 50)/1e6,
    CTE_D  :clampNum(+I('g-cted').value||11.5, 0, 50)/1e6,
    MU_MESH:clampNum(+I('g-mu').value||0.06, 0.01, 0.2),
    N_DISC :Math.round(clampNum(+I('g-ndisc').value||1, 1, 3)),
    R_TOOL :clampNum(+I('g-rtool').value||0.1, 0.02, 5),
    A_ADJ  :I('g-adje').checked,
    O_ROLL :I('g-orol').checked,
  });
  rebuildOutStage();   // output stage depends only on geometry/spec — recompute here, cache in OUT
}
function readErr(){   // manufacturing plan → per-source half-bands [µm]
  configure({ERR:{
    prof:clampNum(+I('e-prof').value||0, 0, 100),
    pin :clampNum(+I('e-pin').value||0, 0, 100),
    hole:clampNum(+I('e-hole').value||0, 0, 100),
    ecc :clampNum(+I('e-ecc').value||0, 0, 100),
  }});
}
function errChanged(){ readErr(); invalidateOpt(); drawClearance(); scheduleMetrics(); }
function syncSliders(){
  I('s-offset').value=state.offset*1e3; I('v-offset').textContent=(state.offset*1e3).toFixed(1)+' µm';
  for(let k=1;k<=NK;k++){ I('s-c'+k).value=(state.coeffs[k-1]||0)*1e3; I('v-c'+k).textContent=((state.coeffs[k-1]||0)*1e3).toFixed(1)+' µm'; }
}
function rebuildMeshProf(){ meshProf=profile(state.offset,state.coeffs,1440); }
let mt; function scheduleMetrics(){ clearTimeout(mt); mt=setTimeout(updateMetrics,60); }
function afterChange(){ syncSliders(); rebuildMeshProf(); drawMesh(); drawTooth(); drawClearance(); refreshExport(); scheduleMetrics(); markPreset(); }

function markPreset(){
  const hit=Object.entries(PRESETS).find(([k,p])=>
    Math.abs(p.offset-state.offset)<1e-6 && p.coeffs.every((c,i)=>Math.abs(c-(state.coeffs[i]||0))<1e-6));
  document.querySelectorAll('.presets button').forEach(b=>b.classList.toggle('active', !!hit && b.dataset.k===hit[0]));
}
document.querySelectorAll('.presets button').forEach(b=>b.addEventListener('click',()=>{
  const p=PRESETS[b.dataset.k]; state.offset=p.offset; state.coeffs=p.coeffs.slice(); afterChange();
}));
I('s-offset').addEventListener('input',e=>{ state.offset=clampNum(+e.target.value/1e3,-0.12,0.04); afterChange(); });   // negative = clearance (backlash); ≥0 = interference/preload (metrics flag jam)
for(let k=1;k<=NK;k++){ I('s-c'+k).addEventListener('input',e=>{ state.coeffs[k-1]=+e.target.value/1e3; afterChange(); }); }
['g-Rb','g-Rr','g-E','g-N','g-T'].forEach(id=>I(id).addEventListener('input',applyGeometry));
// spec inputs that the GA actually consumes (K∝width, OUT.k, DWC, N_DISC, tool guard) must also stale the front
const GA_SPEC=new Set(['g-thick','g-cout','g-rw','g-zw','g-rwp','g-ndisc','g-rtool','g-adje']);
const specChanged=id=>{ readSpec(); if(GA_SPEC.has(id)) invalidateOpt(); scheduleMetrics(); };
['g-thick','g-cbear','g-cout','g-rw','g-zw','g-rwp','g-cbrg','g-nin','g-dt','g-cteh','g-cted','g-mu','g-ndisc','g-rtool','g-adje','g-orol'].forEach(id=>I(id).addEventListener('input',()=>specChanged(id)));
I('g-adje').addEventListener('change',()=>specChanged('g-adje'));   // checkbox: 'change' is the reliable toggle event
I('g-orol').addEventListener('change',()=>specChanged('g-orol'));
// process picker fills the µm field; editing the field flips the picker to "custom"
const TOOLR={'2':0.3,'4':0.1,'12':0.15,'15':1.0,'60':0.4};   // profile process → finishing tool radius [mm]
[['p-prof','e-prof'],['p-pin','e-pin'],['p-hole','e-hole'],['p-ecc','e-ecc']].forEach(([ps,es])=>{
  I(ps).addEventListener('change',()=>{ const v=I(ps).value; if(v!=='c') I(es).value=v;
    if(ps==='p-prof' && TOOLR[v]!=null){ I('g-rtool').value=TOOLR[v]; readSpec(); }   // tool radius follows the milling / EDM / grinding method
    errChanged(); });
  I(es).addEventListener('input',()=>{ I(ps).value='c'; errChanged(); });
});

I('play').addEventListener('click',()=>{ state.playing=!state.playing; I('play').textContent=playLabel(); I('play').setAttribute('aria-pressed',state.playing); });
I('speed').addEventListener('input',e=>{ state.speed=+e.target.value/100; });
I('copy-x').addEventListener('click',e=>copyText(swEquations().X, e.currentTarget));
I('copy-y').addEventListener('click',e=>copyText(swEquations().Y, e.currentTarget));
I('copy-both').addEventListener('click',e=>{ const {X,Y}=swEquations(); copyText('X(t):\n'+X+'\n\nY(t):\n'+Y, e.currentTarget); });
I('dl-csv').addEventListener('click',downloadCSV);
I('lang-en').addEventListener('click',()=>applyLang('en'));
I('lang-zh').addEventListener('click',()=>applyLang('zh'));

// ---- pin: float a chart panel bottom-right (one at a time) so it tracks the window while you tune ----
function updatePinGlyphs(){ document.querySelectorAll('.panel .pin').forEach(b=>{
  const on=b.closest('.panel').classList.contains('pinned');
  b.textContent=on?'✕':'❐'; b.title=t(on?'pin_off':'pin_on');
  b.setAttribute('aria-label',b.title); b.setAttribute('aria-pressed',on); }); }
document.querySelectorAll('.panel .pin').forEach(b=>b.addEventListener('click',()=>{
  const p=b.closest('.panel'), was=p.classList.contains('pinned');
  document.querySelectorAll('.panel.pinned').forEach(q=>q.classList.remove('pinned'));
  if(!was) p.classList.add('pinned');
  updatePinGlyphs();
  drawMesh(); drawTooth(); drawClearance();   // canvas CSS size just changed — re-fit immediately
}));

// ============================ in-browser optimizer: NSGA-II in a Web Worker ============================
const OPT = { front:[], sel:-1, hover:-1, running:false, ran:false, pts:[], worker:null };
function stopWorker(){ if(OPT.worker){ OPT.worker.terminate(); OPT.worker=null; } }
// single write-path for the optimizer verdict — the tool's most important line gets a semantic colour
function setOptStat(msg,cls){ const el=I('opt-stat'); el.textContent=msg; el.className='optstat'+(cls?' '+cls:''); }
function invalidateOpt(){ if(!OPT.ran) return; stopWorker(); OPT.running=false; OPT.front=[]; OPT.sel=-1;
  const b=I('opt-run'); b.disabled=false; b.textContent=t('opt_run'); setOptStat(t('opt_stale'),'warn'); I('opt-pick').innerHTML=''; drawOptPlot(); }
function runOptimize(){
  if(OPT.running) return;
  OPT.running=true; OPT.ran=true; OPT.front=[]; OPT.sel=-1; I('opt-pick').innerHTML='';
  const btn=I('opt-run'); btn.disabled=true; btn.textContent=t('opt_running');
  stopWorker();
  const wk=new Worker('worker.js',{type:'module'});
  OPT.worker=wk;
  wk.onmessage=(e)=>{
    const m=e.data;
    if(m.type==='log'){ console.log('[optimizer]', m.msg); return; }
    OPT.front=m.front||[];
    if(m.type==='progress'){ setOptStat(t('opt_prog').replace('{p}',m.pct).replace('{n}',OPT.front.length),'busy'); drawOptPlot(); return; }
    OPT.running=false; btn.disabled=false; btn.textContent=t('opt_run'); stopWorker();
    if(OPT.front.length){ applyGoalPick(true); } else { setOptStat(t('opt_none'),'err'); }
    drawOptPlot();
  };
  wk.onerror=(err)=>{ OPT.running=false; btn.disabled=false; btn.textContent=t('opt_run'); stopWorker();
    setOptStat(t('opt_err'),'err'); console.error(err); };
  // seed the search with known-good designs so the big 5-parameter space converges reliably at the
  // low-backlash / high-stiffness corner: the presets, the current design, and an offset sweep.
  const SEEDS=[];
  for(const p of Object.values(PRESETS)) SEEDS.push([p.offset].concat(p.coeffs));
  SEEDS.push([state.offset].concat(state.coeffs.slice(0,NK)));
  for(let off=-0.017; off>=-0.098; off-=0.006){ SEEDS.push([off,-0.0012,-0.0037,0,0]); SEEDS.push([off,0,0,0,0]); }
  const G=getState();
  wk.postMessage({ Rb:G.Rb,Rr:G.Rr,E:G.E,N:G.N,M:G.M,Np:G.Np,DWC:dwc(),T_RATED:G.T_RATED,K_CONTACT:G.K_CONTACT,ROT:G.ROT_SIGN, PINS:G.PINS, NK, OUT_K:G.OUT.k, N_DISC:G.N_DISC, R_TOOL:G.R_TOOL, SEEDS, L_TOOTH:G.L_TOOTH, ESTAR:G.ESTAR });
}
// goal-driven, judged on the AS-BUILT backlash: tier 1 = worst-case bound meets the target, tier 2 =
// 95% Monte-Carlo yield meets it, else miss with a self-calibrated "shrink to ±X µm, start with Y"
// advisory. Picks the stiffest design that guarantees the target (else the lowest worst-case one) and
// — after a fresh search — loads it straight into the sliders / SolidWorks export.
// ponytail: the MC runs only on the picked design (front-wide MC would cost ~2 s for little gain).
function applyGoalPick(autoload){
  if(!OPT.front.length) return;
  // THE best curve, lexicographic: essentially-minimum backlash (within 0.5′ of the front's best) →
  // smoothest among those (ripple within 10% of the best) → then the STIFFEST of that set, so a
  // meaningless 0.01 µrad ripple digit can no longer throw away 3× the torsional stiffness.
  const F=OPT.front, blMin=Math.min(...F.map(d=>d.backlash));
  const near=F.filter(d=>d.backlash<=blMin+0.5);
  const ripMin=Math.min(...near.map(d=>d.ripple));
  const smooth=near.filter(d=>d.ripple<=ripMin*1.1+1e-9);
  OPT.sel = F.indexOf(smooth.reduce((a,b)=>b.stiff>a.stiff?b:a));
  const d=F[OPT.sel];
  if(autoload){ state.offset=d.offset; state.coeffs=d.coeffs.slice(); afterChange(); }
  const eta=evaluate(d.offset,d.coeffs).eta;   // efficiency is main-thread only
  setOptStat(t('opt_result')
    .replace('{b}', d.backlash.toFixed(2)).replace('{a}', d.blmax!=null?d.blmax.toFixed(1):'—')
    .replace('{r}', d.ripple.toFixed(1)).replace('{e}', (eta*100).toFixed(1)), 'ok');
  showPick();
}
function showPick(){
  const el=I('opt-pick'); if(OPT.sel<0||!OPT.front[OPT.sel]){ el.innerHTML=''; return; }
  const d=OPT.front[OPT.sel];
  const row=(k,v)=>`<div class="row"><span class="muted">${k}</span><b>${v}</b></div>`;
  el.innerHTML =
    row(t('m_backlash'), d.backlash.toFixed(2)+"'")+
    (d.blmax!=null?row(t('m_asbuilt'), '≤ '+d.blmax.toFixed(2)+"'"):'')+
    row(t('m_stiff'), d.stiff.toFixed(1)+' N·m/′')+
    (d.sigmaH!=null?row(t('m_stress'), d.sigmaH.toFixed(0)+' MPa'):'')+
    row(t('m_ripple'), d.ripple.toFixed(1)+' µrad')+
    row(t('m_pa'), d.maxPA.toFixed(1)+'°')+
    row(t('m_rmargin'), (d.rmargin!=null?d.rmargin.toFixed(2):'—')+"'")+
    row(t('m_teeth'), d.n_eng+' / '+getState().Np)+
    `<button class="load" id="opt-load">${t('opt_load')}</button>`;
  I('opt-load').onclick=()=>{ state.offset=d.offset; state.coeffs=d.coeffs.slice(); afterChange(); };
}
const VIRID=[[253,231,37],[94,201,98],[33,145,140],[59,82,139],[68,1,84]];
function optColor(tt){ tt=Math.max(0,Math.min(1,tt)); const x=tt*4,i=Math.floor(x),f=x-i,a=VIRID[i],b=VIRID[Math.min(i+1,4)]; return `rgb(${a[0]+(b[0]-a[0])*f|0},${a[1]+(b[1]-a[1])*f|0},${a[2]+(b[2]-a[2])*f|0})`; }
function niceTicks(mn,mx,n){ const span=mx-mn; if(!(span>0)) return [mn];
  const raw=span/n, mag=Math.pow(10,Math.floor(Math.log10(raw))), r=raw/mag;
  const step=(r>=5?5:r>=2?2:1)*mag, out=[];
  for(let v=Math.ceil(mn/step-1e-9)*step; v<=mx+step*1e-6; v+=step) out.push(v);
  return out; }
const tickFmt=(v,step)=> step>=1? v.toFixed(0) : step>=0.1? v.toFixed(1) : v.toFixed(2);
function drawOptPlot(){
  const F=OPT.front;
  I('optpanel').classList.toggle('optempty', !OPT.running && !F.length);   // pre-run / stale: ghost hint, no 430px void
  const {ctx,w,h}=fit(I('optplot')); ctx.clearRect(0,0,w,h);
  const padL=48,padR=56,padT=12,padB=34;   // padR holds the pressure-angle colorbar
  if(!F.length){ ctx.fillStyle=COL['ink-3']; ctx.font='13px '+MONO; ctx.textAlign='center';
    ctx.fillText(OPT.running?'…':'—', w/2, h/2); OPT.pts=[]; return; }
  const B=F.map(d=>d.backlash), S=F.map(d=>d.stiff), P=F.map(d=>d.maxPA);
  const bmn=Math.min(...B),bmx=Math.max(...B),smn=Math.min(...S),smx=Math.max(...S),pmn=Math.min(...P),pmx=Math.max(...P);
  const X=v=>padL+(v-bmn)/((bmx-bmn)||1)*(w-padL-padR), Y=v=>padT+(smx-v)/((smx-smn)||1)*(h-padT-padB);
  ctx.font='11px '+MONO; ctx.lineWidth=1;
  const ty=niceTicks(smn,smx,3), tys=ty.length>1?ty[1]-ty[0]:1;
  ctx.textAlign='right'; ctx.textBaseline='middle';
  for(const v of ty){ ctx.strokeStyle=COL.line; ctx.beginPath();ctx.moveTo(padL,Y(v));ctx.lineTo(w-padR,Y(v));ctx.stroke();
    ctx.fillStyle=COL['ink-3']; ctx.fillText(tickFmt(v,tys),padL-6,Y(v)); }
  const tx=niceTicks(bmn,bmx,4), txs=tx.length>1?tx[1]-tx[0]:1;
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  for(const v of tx){ ctx.strokeStyle=COL.line; ctx.beginPath();ctx.moveTo(X(v),padT);ctx.lineTo(X(v),h-padB);ctx.stroke();
    ctx.fillStyle=COL['ink-3']; ctx.fillText(tickFmt(v,txs),X(v),h-20); }
  ctx.fillStyle=COL['ink-2']; ctx.fillText(t('m_backlash')+" [']  ↓", (padL+w-padR)/2, h-5);
  ctx.save();ctx.translate(13,h/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText(t('m_stiff')+'  ↑',0,0);ctx.restore();
  // colorbar: the legend says "colour = pressure angle" — give the colours a scale
  const cbx=w-padR+14, cbw=8, cb0=padT+8, cb1=h-padB-8;
  for(let yy=cb0; yy<=cb1; yy++){ ctx.fillStyle=optColor(1-(yy-cb0)/(cb1-cb0)); ctx.fillRect(cbx,yy,cbw,1); }
  ctx.font='10px '+MONO; ctx.fillStyle=COL['ink-3']; ctx.textAlign='left';
  ctx.textBaseline='top';    ctx.fillText(pmx.toFixed(0)+'°', cbx+cbw+3, cb0-2);
  ctx.textBaseline='bottom'; ctx.fillText(pmn.toFixed(0)+'°', cbx+cbw+3, cb1+2);
  ctx.textBaseline='alphabetic';
  OPT.pts=[];
  for(let i=0;i<F.length;i++){ const sx=X(B[i]),sy=Y(S[i]); OPT.pts.push([sx,sy]);
    ctx.beginPath();ctx.arc(sx,sy,i===OPT.sel?7:5,0,2*Math.PI); ctx.fillStyle=optColor((P[i]-pmn)/((pmx-pmn)||1)); ctx.fill();
    if(i===OPT.sel){ ctx.lineWidth=2.5; ctx.strokeStyle=COL.danger; ctx.stroke(); }
    else if(i===OPT.hover){ ctx.lineWidth=1.5; ctx.strokeStyle=COL.ink; ctx.stroke(); } }
  if(OPT.hover>=0 && OPT.hover<F.length){   // hover tooltip: read the numbers without committing a click
    const d=F[OPT.hover], [sx,sy]=OPT.pts[OPT.hover];
    const txt=`${d.backlash.toFixed(2)}′ · ${d.stiff.toFixed(1)} N·m/′ · ${d.maxPA.toFixed(0)}°`;
    ctx.font='12px '+MONO; const tw=ctx.measureText(txt).width;
    const bxp=Math.min(Math.max(sx-tw/2-6,padL),w-padR-tw-12), byp= sy-32<padT? sy+12 : sy-32;
    ctx.fillStyle='rgba(12,13,15,.92)'; ctx.strokeStyle=COL['line-2'];
    ctx.beginPath(); ctx.roundRect(bxp,byp,tw+12,20,5); ctx.fill(); ctx.stroke();
    ctx.fillStyle=COL.ink; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(txt,bxp+6,byp+10);
    ctx.textBaseline='alphabetic';
  }
}
function optHit(e){ if(!OPT.pts.length) return -1;
  const r=e.currentTarget.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
  let bi=-1,bd=400; for(let i=0;i<OPT.pts.length;i++){ const dx=OPT.pts[i][0]-mx,dy=OPT.pts[i][1]-my,dd=dx*dx+dy*dy; if(dd<bd){bd=dd;bi=i;} }
  return bi; }
I('optplot').addEventListener('click',e=>{ const bi=optHit(e); if(bi>=0){ OPT.sel=bi; drawOptPlot(); showPick(); } });
I('optplot').addEventListener('mousemove',e=>{ const bi=optHit(e); if(bi!==OPT.hover){ OPT.hover=bi; drawOptPlot(); } });
I('optplot').addEventListener('mouseleave',()=>{ if(OPT.hover!==-1){ OPT.hover=-1; drawOptPlot(); } });
I('opt-run').addEventListener('click',runOptimize);

// ============================ animation ============================
let last=performance.now();
function loop(tm){
  const dt=Math.min(0.05,(tm-last)/1000); last=tm;
  if(state.playing){ state.psi=(state.psi+dt*(0.3+state.speed*2.4))%(2*Math.PI); drawMesh(); }
  requestAnimationFrame(loop);
}
window.addEventListener('resize',()=>{ drawMesh(); drawTooth(); drawClearance(); drawOptPlot(); });

// ============================ init ============================
// wire every field label to its control (click-to-focus + accessible names) — ids already exist
document.querySelectorAll('.field').forEach(f=>{ const inp=f.querySelector('select,input'), lab=f.querySelector('label'); if(inp&&lab&&inp.id) lab.htmlFor=inp.id; });
applyGeometry();      // sets ROT_SIGN, PINS, BASE, meshProf via afterChange
applyLang('en');
refreshExport();
// honor OS reduced-motion: start paused on a static frame instead of auto-rotating
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  state.playing=false; I('play').textContent=playLabel(); I('play').setAttribute('aria-pressed','false');
}
drawMesh();
setOptStat(t('opt_hint'));
drawOptPlot();
requestAnimationFrame(loop);