# -*- coding: utf-8 -*-
"""生成自包含的帕累托前沿浏览器 cycloidal_pareto.html (从 pareto_front.csv 嵌入数据)。
运行: python gen_pareto_html.py"""
import csv

rows = []
with open("pareto_front.csv", newline="") as f:
    for r in csv.DictReader(f):
        rows.append([
            float(r["offset"]), float(r["c1"]), float(r["c2"]), float(r["c3"]), float(r["c4"]),
            float(r["backlash_arcmin"]), float(r["stiff_Nm_per_arcmin"]), float(r["ripple_urad"]),
            float(r["max_pressure_angle_deg"]), float(r["worst_margin_arcmin"]),
            float(r["min_curv_radius_mm"]), int(r["n_eng"]),
        ])
rows.sort(key=lambda x: x[5])  # by backlash
data_js = "[\n" + ",\n".join("  [" + ",".join(f"{v:.5g}" if isinstance(v, float) else str(v) for v in row) + "]" for row in rows) + "\n]"

TEMPLATE = r"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cycloidal Pareto Explorer</title>
<style>
  :root{
    color-scheme: dark;
    --bg:#0c0d0f; --panel:#15171b; --panel-2:#1b1e24; --line:#2a2e35; --line-2:#363b44;
    --ink:#eceef1; --ink-2:#a2a8b0; --ink-3:#6b7178;
    --blue:#3987e5; --green:#22b892; --hot:#fab219; --danger:#e0554e; --steel:#47566a;
    --mono:ui-monospace,"Cascadia Code","SF Mono",Consolas,monospace;
    --sans:system-ui,-apple-system,"Segoe UI",Roboto,"Microsoft YaHei",sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1180px;margin:0 auto;padding:30px 22px 72px}
  header{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:22px}
  .topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  .eyebrow{font-family:var(--mono);font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:var(--green);margin:0 0 12px}
  :root:lang(zh) .eyebrow{letter-spacing:.1em}
  h1{font-size:clamp(28px,4.4vw,42px);line-height:1.05;margin:0 0 12px;font-weight:640;letter-spacing:-.015em;text-wrap:balance}
  h1 .thin{color:var(--ink-3);font-weight:300}
  .lede{color:var(--ink-2);max-width:70ch;margin:0;font-size:16.5px}
  .lang{display:inline-flex;border:1px solid var(--line-2);border-radius:7px;overflow:hidden;flex:none}
  .lang button{font-family:var(--mono);font-size:13px;padding:7px 13px;cursor:pointer;background:transparent;border:0;color:var(--ink-3)}
  .lang button.on{color:var(--bg);background:var(--green)}
  .grid{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}
  @media (max-width:880px){.grid{grid-template-columns:1fr}}
  .panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;position:relative}
  .panel h2{font-family:var(--mono);font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin:0 0 14px;font-weight:500;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  :root:lang(zh) .panel h2{letter-spacing:.05em}
  canvas{display:block;width:100%;aspect-ratio:4/3}
  .axes{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:12px}
  .axes label{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);display:flex;align-items:center;gap:6px}
  select{font-family:var(--mono);font-size:13px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line-2);border-radius:6px;padding:5px 8px}
  select:focus-visible{outline:2px solid var(--green)}
  .legend{display:flex;flex-wrap:wrap;gap:14px;font-family:var(--mono);font-size:12.5px;color:var(--ink-2);margin-top:10px}
  .legend .grad{width:90px;height:10px;border-radius:2px;background:linear-gradient(90deg,#fde725,#5ec962,#21918c,#3b528b,#440154)}
  /* detail */
  .kv{display:grid;grid-template-columns:1fr auto;gap:6px 10px;font-family:var(--mono);font-size:13.5px;border-bottom:1px solid var(--line);padding:7px 0}
  .kv:last-of-type{border-bottom:0}
  .kv .k{color:var(--ink-2)} .kv .k small{display:block;color:var(--ink-3);font-size:11px}
  .kv .v{color:var(--ink);text-align:right;font-variant-numeric:tabular-nums}
  .kv .v.good{color:var(--green)} .kv .v.warn{color:var(--hot)}
  .subhead{font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin:16px 0 8px}
  pre{font-family:var(--mono);font-size:12px;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:10px 12px;margin:0 0 10px;overflow-x:auto;white-space:pre;line-height:1.5}
  .actions{display:flex;flex-wrap:wrap;gap:8px}
  .actions button{font-family:var(--mono);font-size:13px;color:var(--ink);background:var(--panel-2);border:1px solid var(--line-2);border-radius:7px;padding:8px 13px;cursor:pointer}
  .actions button:hover{border-color:var(--green);color:var(--green)}
  .actions button:focus-visible{outline:2px solid var(--green)}
  footer{margin-top:26px;padding-top:18px;border-top:1px solid var(--line);color:var(--ink-3);font-size:13.5px}
  footer a{color:var(--green);text-decoration:none} footer a:hover{text-decoration:underline}
  .note{font-family:var(--mono);font-size:12px;color:var(--ink-3);margin-top:10px}
</style>

<div class="wrap">
  <header>
    <div class="topbar">
      <div>
        <p class="eyebrow" data-i18n="eyebrow">NSGA-II multi-objective · robust · manufacturable</p>
        <h1><span data-i18n="title">Cycloidal Pareto Explorer</span> <span class="thin" data-i18n="thin">— pick your trade-off</span></h1>
      </div>
      <div class="lang"><button id="en" class="on">EN</button><button id="zh">中文</button></div>
    </div>
    <p class="lede" data-i18n="lede">Every point is a 4-harmonic tooth modification that survived NSGA-II: non-dominated on backlash / stiffness / ripple / pressure angle, robust to ±7.5 µm machining error, and manufacturable. Pick the trade-off you want; copy its SolidWorks equation.</p>
  </header>

  <div class="grid">
    <div class="panel">
      <h2><span data-i18n="front">Pareto front</span> <span class="aux" id="count"></span></h2>
      <div class="axes">
        <label><span data-i18n="xax">x</span> <select id="xsel"></select></label>
        <label><span data-i18n="yax">y</span> <select id="ysel"></select></label>
        <label><span data-i18n="csel_l">color</span> <select id="csel"></select></label>
      </div>
      <canvas id="plot"></canvas>
      <div class="legend"><span id="clow"></span><i class="grad"></i><span id="chigh"></span><span data-i18n="clickhint">· click a point to inspect</span></div>
    </div>

    <div class="panel">
      <h2><span data-i18n="design">Selected design</span></h2>
      <div id="detail"></div>
    </div>
  </div>

  <footer>
    <span data-i18n="foot1">Geometry fixed at Rb 34 · Rr 2.5 · E 1.5 · N 18 (ratio 18:1), rated 30 N·m, tolerance stack ±15 µm — the geometry the front was optimized for. Live single-tooth tuning:</span>
    <a href="cycloidal_viz.html" data-i18n="footlink">open the Shape Designer →</a>
    <div class="note" data-i18n="note">δ(θ)=offset+Σₖ cₖ·cos(kNθ), normal modification. Metrics from a quasi-static loaded-contact model (K=50 N/µm per tooth), verified against CycloidalModAnalysis.py. Trends match the RV-reducer literature (5/5 benchmark). Absolute values are order-of-magnitude.</div>
  </footer>
</div>

<script>
"use strict";
// columns: offset,c1,c2,c3,c4, backlash, stiff, ripple, maxPA, worstMargin, minCurvR, teeth
const DATA = /*DATA*/;
const Rb=34,Rr=2.5,E=1.5,N=18,M=19;
const COLS = {
  backlash:{i:5,dir:'min',u:"'",zh:'背隙',en:'backlash'},
  stiff:{i:6,dir:'max',u:'N·m/′',zh:'刚度',en:'stiffness'},
  ripple:{i:7,dir:'min',u:'µrad',zh:'波动',en:'ripple'},
  maxPA:{i:8,dir:'min',u:'°',zh:'最大压力角',en:'max pressure angle'},
  worstMargin:{i:9,dir:'max',u:"'",zh:'鲁棒余量',en:'robust margin'},
  teeth:{i:11,dir:'max',u:'',zh:'受载齿数',en:'loaded teeth'},
};
const TXT={
  eyebrow:{en:'NSGA-II multi-objective · robust · manufacturable',zh:'NSGA-II 多目标 · 鲁棒 · 可加工'},
  title:{en:'Cycloidal Pareto Explorer',zh:'摆线帕累托前沿浏览器'},
  thin:{en:'— pick your trade-off',zh:'— 选择你的权衡'},
  lede:{en:'Every point is a 4-harmonic tooth modification that survived NSGA-II: non-dominated on backlash / stiffness / ripple / pressure angle, robust to ±7.5 µm machining error, and manufacturable. Pick the trade-off you want; copy its SolidWorks equation.',
        zh:'每个点都是通过 NSGA-II 的 4 谐波修型: 在背隙/刚度/波动/压力角上互不支配, 对 ±7.5µm 加工误差鲁棒, 且可加工。选你要的权衡, 复制它的 SolidWorks 方程。'},
  front:{en:'Pareto front',zh:'帕累托前沿'},
  design:{en:'Selected design',zh:'选中设计'},
  xax:{en:'x',zh:'横轴'}, yax:{en:'y',zh:'纵轴'}, csel_l:{en:'color',zh:'颜色'},
  clickhint:{en:'· click a point to inspect',zh:'· 点击散点查看'},
  copyx:{en:'Copy X(t)',zh:'复制 X(t)'}, copyy:{en:'Copy Y(t)',zh:'复制 Y(t)'}, copied:{en:'✓ copied',zh:'✓ 已复制'},
  params:{en:'Modification (mm)',zh:'修型参数 (mm)'}, sweq:{en:'SolidWorks equation-driven curve',zh:'SolidWorks 方程驱动曲线'},
  foot1:{en:'Geometry fixed at Rb 34 · Rr 2.5 · E 1.5 · N 18 (ratio 18:1), rated 30 N·m, tolerance stack ±15 µm — the geometry the front was optimized for. Live single-tooth tuning:',
         zh:'几何固定为 Rb 34 · Rr 2.5 · E 1.5 · N 18 (减速比 18:1), 额定 30 N·m, 公差叠加 ±15µm —— 前沿即在此几何下优化。单齿实时调形:'},
  footlink:{en:'open the Shape Designer →',zh:'打开齿廓设计器 →'},
  note:{en:'δ(θ)=offset+Σₖ cₖ·cos(kNθ), normal modification. Metrics from a quasi-static loaded-contact model (K=50 N/µm per tooth), verified against CycloidalModAnalysis.py. Trends match the RV-reducer literature (5/5 benchmark). Absolute values are order-of-magnitude.',
        zh:'δ(θ)=offset+Σₖ cₖ·cos(kNθ), 法向修型。指标来自准静态加载接触模型(每齿 K=50 N/µm), 已与 CycloidalModAnalysis.py 核对; 趋势符合 RV 减速器文献(5/5 基准)。绝对值为量级估计。'},
  m_backlash:{en:'backlash',zh:'背隙'}, m_stiff:{en:'stiffness',zh:'刚度'}, m_ripple:{en:'ripple',zh:'波动'},
  m_maxPA:{en:'max pressure angle',zh:'最大压力角'}, m_worstMargin:{en:'robust margin (±7.5µm)',zh:'鲁棒余量 (±7.5µm)'},
  m_minR:{en:'min curvature radius',zh:'最小曲率半径'}, m_teeth:{en:'loaded teeth',zh:'受载齿数'},
};
let lang='en';
const t=k=>{const e=TXT[k];return e?(e[lang]||e.en):k;};
const css=k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim();
const I=id=>document.getElementById(id);

// viridis-ish colormap (matches ParetoFront.png)
const VIR=[[253,231,37],[94,201,98],[33,145,140],[59,82,139],[68,1,84]];
function cmap(t){t=Math.max(0,Math.min(1,t));const x=t*(VIR.length-1),i=Math.floor(x),f=x-i,a=VIR[i],b=VIR[Math.min(i+1,VIR.length-1)];return `rgb(${a[0]+(b[0]-a[0])*f|0},${a[1]+(b[1]-a[1])*f|0},${a[2]+(b[2]-a[2])*f|0})`;}

let sel=0, hover=-1;
const plot=I('plot');
let PT=[]; // screen coords cache

function draw(){
  const dpr=Math.min(window.devicePixelRatio||1,2), w=plot.clientWidth, h=plot.clientHeight;
  plot.width=w*dpr|0; plot.height=h*dpr|0; const ctx=plot.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  const xk=I('xsel').value, yk=I('ysel').value, ck=I('csel').value;
  const xi=COLS[xk].i, yi=COLS[yk].i, ci=COLS[ck].i;
  const xs=DATA.map(d=>d[xi]), ys=DATA.map(d=>d[yi]), cs=DATA.map(d=>d[ci]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),cmin=Math.min(...cs),cmax=Math.max(...cs);
  const pl=54,pr=16,pt=14,pb=42;
  const X=v=>pl+(v-xmin)/((xmax-xmin)||1)*(w-pl-pr);
  const Y=v=>pt+(ymax-v)/((ymax-ymin)||1)*(h-pt-pb);
  // grid + ticks
  ctx.font='11px '+css('--mono'); ctx.fillStyle=css('--ink-3'); ctx.strokeStyle=css('--line'); ctx.lineWidth=1;
  ctx.textAlign='right'; ctx.textBaseline='middle';
  for(let g=0;g<=4;g++){const v=ymin+(ymax-ymin)*g/4;ctx.beginPath();ctx.moveTo(pl,Y(v));ctx.lineTo(w-pr,Y(v));ctx.stroke();ctx.fillText(v.toFixed(1),pl-6,Y(v));}
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  for(let g=0;g<=4;g++){const v=xmin+(xmax-xmin)*g/4;ctx.fillText(v.toFixed(1),X(v),h-24);}
  // axis titles
  ctx.fillStyle=css('--ink-2');
  ctx.fillText(`${TXT['m_'+xk]?t('m_'+xk):xk}  [${COLS[xk].u}]  ${COLS[xk].dir==='min'?'↓':'↑'}`, w/2, h-6);
  ctx.save();ctx.translate(13,h/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';
  ctx.fillText(`${TXT['m_'+yk]?t('m_'+yk):yk}  [${COLS[yk].u}]  ${COLS[yk].dir==='min'?'↓':'↑'}`,0,0);ctx.restore();
  // points
  PT=[];
  for(let k=0;k<DATA.length;k++){
    const sx=X(xs[k]), sy=Y(ys[k]); PT.push([sx,sy]);
    const tt=(cs[k]-cmin)/((cmax-cmin)||1);
    ctx.beginPath(); ctx.arc(sx,sy,k===sel?8:(k===hover?7:5),0,2*Math.PI);
    ctx.fillStyle=cmap(tt); ctx.fill();
    if(k===sel){ctx.lineWidth=2.5;ctx.strokeStyle=css('--danger');ctx.stroke();}
    else if(k===hover){ctx.lineWidth=1.5;ctx.strokeStyle=css('--ink');ctx.stroke();}
  }
  // color legend labels
  I('clow').textContent=`${t('m_'+ck)} ${cmin.toFixed(0)}${COLS[ck].u}`;
  I('chigh').textContent=`${cmax.toFixed(0)}${COLS[ck].u}`;
}

const g=x=>String(Math.round(x*1e6)/1e6);
function swEq(d){
  const off=d[0],c=[d[1],d[2],d[3],d[4]];
  const dterms=c.map((ck,k)=>`${g(ck)}*cos(${(k+1)*N}*t)`).join(' + ');
  const dd=`(${g(off)} + ${dterms})`;
  const den=`sqrt( (-${Rb}*sin(t)-${E}*${M}*sin(${M}*t))^2 + (${Rb}*cos(t)+${E}*${M}*cos(${M}*t))^2 )`;
  const X=`${Rb}*cos(t)+${E}*cos(${M}*t) + ( ${dd} - ${Rr} )*( ${Rb}*cos(t)+${E}*${M}*cos(${M}*t) )/${den}`;
  const Y=`${Rb}*sin(t)+${E}*sin(${M}*t) + ( ${dd} - ${Rr} )*( ${Rb}*sin(t)+${E}*${M}*sin(${M}*t) )/${den}`;
  return {X,Y};
}
function fmt(x,n){return x.toFixed(n);}
function detail(){
  const d=DATA[sel], {X,Y}=swEq(d);
  const row=(k,v,cls)=>`<div class="kv"><span class="k">${t('m_'+k)}<small>${COLS[k]?(COLS[k].dir==='min'?'lower better':'higher better'):''}</small></span><span class="v${cls?' '+cls:''}">${v}</span></div>`;
  const wmCls=d[9]>=1.0?'good':(d[9]>=0.5?'warn':'');
  const html=
    row('backlash',fmt(d[5],2)+" '")+
    row('stiff',fmt(d[6],1)+' <small style="display:inline;color:var(--ink-3)">N·m/′</small>')+
    row('ripple',fmt(d[7],1)+' µrad')+
    row('maxPA',fmt(d[8],1)+'°')+
    row('worstMargin',fmt(d[9],2)+" '",wmCls)+
    row('minR',fmt(d[10],2)+' mm')+
    row('teeth',d[11]+' / 19')+
    `<div class="subhead">${t('params')}</div>`+
    `<pre>offset = ${g(d[0])}\nc1 = ${g(d[1])}\nc2 = ${g(d[2])}\nc3 = ${g(d[3])}\nc4 = ${g(d[4])}</pre>`+
    `<div class="subhead">${t('sweq')}</div>`+
    `<pre id="eqx">${X}</pre><pre id="eqy">${Y}</pre>`+
    `<div class="actions"><button id="cx">${t('copyx')}</button><button id="cy">${t('copyy')}</button></div>`;
  I('detail').innerHTML=html;
  I('cx').onclick=e=>copy(X,e.target); I('cy').onclick=e=>copy(Y,e.target);
}
function copy(txt,btn){const o=btn.textContent;const done=()=>{btn.textContent=t('copied');setTimeout(()=>btn.textContent=o,1200);};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done).catch(()=>fb());else fb();
  function fb(){const ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(ta);done();}}

function nearest(mx,my){let best=-1,bd=1e9;for(let k=0;k<PT.length;k++){const dx=PT[k][0]-mx,dy=PT[k][1]-my,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best=k;}}return bd<400?best:-1;}
plot.addEventListener('mousemove',e=>{const r=plot.getBoundingClientRect();const k=nearest(e.clientX-r.left,e.clientY-r.top);if(k!==hover){hover=k;draw();plot.style.cursor=k>=0?'pointer':'default';}});
plot.addEventListener('mouseleave',()=>{if(hover!==-1){hover=-1;draw();}});
plot.addEventListener('click',e=>{const r=plot.getBoundingClientRect();const k=nearest(e.clientX-r.left,e.clientY-r.top);if(k>=0){sel=k;draw();detail();}});

function fillSelectors(){
  const opts=Object.keys(COLS).map(k=>`<option value="${k}">${t('m_'+k)}</option>`).join('');
  I('xsel').innerHTML=opts; I('ysel').innerHTML=opts; I('csel').innerHTML=opts;
  I('xsel').value='backlash'; I('ysel').value='stiff'; I('csel').value='maxPA';
}
['xsel','ysel','csel'].forEach(id=>I(id).addEventListener('change',draw));

function applyLang(l){lang=l;document.documentElement.lang=l==='zh'?'zh-CN':'en';
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  I('count').textContent=`${DATA.length} designs`;
  I('en').classList.toggle('on',l==='en');I('zh').classList.toggle('on',l==='zh');
  fillSelectors(); draw(); detail();}
I('en').onclick=()=>applyLang('en'); I('zh').onclick=()=>applyLang('zh');
window.addEventListener('resize',draw);

// init: select the knee (min normalized distance to ideal on backlash/stiff/ripple/PA)
(function(){let bi=0,bd=1e9;const cols=['backlash','stiff','ripple','maxPA'];
  const ranges=cols.map(k=>{const v=DATA.map(d=>d[COLS[k].i]);return[Math.min(...v),Math.max(...v)];});
  for(let k=0;k<DATA.length;k++){let s=0;cols.forEach((c,ci)=>{const i=COLS[c].i,[lo,hi]=ranges[ci];let n=(DATA[k][i]-lo)/((hi-lo)||1);if(COLS[c].dir==='max')n=1-n;s+=n*n;});if(s<bd){bd=s;bi=k;}}
  sel=bi;})();
fillSelectors(); applyLang('en');
</script>
"""

html = TEMPLATE.replace("/*DATA*/", data_js)
with open("cycloidal_pareto.html", "w", encoding="utf-8", newline="\n") as f:
    f.write(html)
print(f"[OK] cycloidal_pareto.html written ({len(rows)} designs, {len(html)} bytes)")
