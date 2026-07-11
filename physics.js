let Rb=34.0, Rr=2.5, E=1.5, N=18, M=N+1, Np=N+1;
let T_RATED=30.0;
// manufacturing-error sources, half-band [µm] each — set by the process pickers, editable.
// prof = flank form error, pin = pin diameter, hole = pin-hole true position, ecc = eccentricity.
let ERR={prof:4, pin:2, hole:4, ecc:3};
let SENS_E=1.5;   // worst |∂gap/∂E| over pins+cranks — finite-differenced by mcYield(), not assumed
const dwc=()=>(ERR.prof+ERR.pin/2+ERR.hole+SENS_E*ERR.ecc)/1000;  // worst-case gap tightening [mm]  (pin is a Ø tol → only half lands on the radial gap)
let L_TOOTH=10.0, C_BEAR=0.0, C_OUT=0.0;   // disk thickness [mm]; input-bearing & output-coupling radial clearance [mm] (opt-in)
// output pin-hole (W) stage + eccentric-bearing life. R_W = output pin-circle radius, Z_W = output pins,
// RW_PIN = output-pin/roller radius [mm]; C_BRG = eccentric-bearing dynamic capacity C [N]; N_IN = input speed [rpm] (0 ⇒ report revs only).
let R_W=20.0, Z_W=8, RW_PIN=3.0, C_BRG=10000.0, N_IN=0.0;
let OUT={k:Infinity,bl:0,sigma:0,safety:Infinity,neng:0};   // output-stage results — geometry-only (profile-independent), cached per geometry/spec change
// thermal-drift: only the housing↔disc CTE MISMATCH moves clearance — uniform expansion is a similarity
// transform (angular backlash invariant). DELTA_T = operating rise [°C]; CTE_H/CTE_D = housing/disc CTE [1/K].
let DELTA_T=0.0, CTE_H=23.0e-6, CTE_D=11.5e-6;
let MU_MESH=0.06;   // boundary/EP-grease friction coeff at pin contacts → mesh efficiency + PV wear index (sliding loss only, excl. bearings/seals)
let N_DISC=1;       // number of phased cycloid discs (1/2/3) — phased superposition cancels TE-ripple harmonics not a multiple of N_DISC
let R_TOOL=0.1;     // finishing tool radius [mm] (wire-EDM wire ~0.1, form-grinding wheel 0.5–3) — min concave flank radius must exceed it
const K_CONTACT=5.0e4;
const ESTAR=115385.0, SH_LIM=1500.0;   // steel-steel Hertz E* [MPa] (1/E*=2(1-0.3²)/210000); contact-fatigue limit [MPa]
let ROT_SIGN=-1.0, GEOM_WORST=0;
let PINS=[];
function rebuildPins(){ PINS=[]; for(let j=0;j<Np;j++) PINS.push([Rb*Math.cos(2*Math.PI*j/Np), Rb*Math.sin(2*Math.PI*j/Np)]); }

// ============================ physics (port of optimizer/model.py) ============================
// coeffs = [c1,c2,...,cK] harmonic amplitudes; δ(θ)=offset + Σ c_k·cos(kNθ) (normal modification).
// 'pertooth' uses coeffs[0] as the legacy radial quadratic "shift" (reference curve only).
function profile(offset,coeffs,nPts,variant){
  variant=variant||'harmonic'; coeffs=coeffs||[];
  const X=new Float64Array(nPts),Y=new Float64Array(nPts),TH=new Float64Array(nPts), tp=2*Math.PI/N;
  for(let i=0;i<nPts;i++){
    const th=2*Math.PI*i/nPts;
    const xc=Rb*Math.cos(th)+E*Math.cos(M*th), yc=Rb*Math.sin(th)+E*Math.sin(M*th);
    const dx=-Rb*Math.sin(th)-E*M*Math.sin(M*th), dy=Rb*Math.cos(th)+E*M*Math.cos(M*th);
    const nn=Math.hypot(dx,dy), nx=dy/nn, ny=-dx/nn; TH[i]=th;
    if(variant==='pertooth'){
      const xs=xc-Rr*nx, ys=yc-Rr*ny, ph=((th%tp)+tp)%tp-tp/2;
      const d=offset+(coeffs[0]||0)*(ph/(tp/2))**2, r=Math.hypot(xs,ys);
      X[i]=xs+d*xs/r; Y[i]=ys+d*ys/r;
    } else {
      let d=offset; for(let k=0;k<coeffs.length;k++) d+=coeffs[k]*Math.cos((k+1)*N*th);
      X[i]=xc+(d-Rr)*nx; Y[i]=yc+(d-Rr)*ny;
    }
  }
  return {X,Y,TH};
}
function meshState(prof,psi,rot){
  if(rot===undefined) rot=ROT_SIGN;
  const {X,Y,TH}=prof, n=X.length;
  const cx=-E*Math.cos(psi), cy=-E*Math.sin(psi);
  const a=rot*psi/N, co=Math.cos(a), si=Math.sin(a), tp=2*Math.PI/N;
  const WX=new Float64Array(n), WY=new Float64Array(n);
  for(let i=0;i<n;i++){ WX[i]=co*X[i]-si*Y[i]+cx; WY[i]=si*X[i]+co*Y[i]+cy; }
  const gaps=[],arms=[],uu=[],cpx=[],cpy=[],invre=[],cnx=[],cny=[];
  for(let j=0;j<Np;j++){
    const px=PINS[j][0], py=PINS[j][1]; let best=Infinity, bi=0;
    for(let i=0;i<n;i++){ const dd=(WX[i]-px)**2+(WY[i]-py)**2; if(dd<best){best=dd; bi=i;} }
    const wx=WX[bi], wy=WY[bi], dist=Math.hypot(wx-px,wy-py);
    gaps.push(dist-Rr);
    const nxj=(px-wx)/dist, nyj=(py-wy)/dist;
    arms.push((wx-cx)*nyj-(wy-cy)*nxj); cnx.push(nxj); cny.push(nyj);   // cn = contact normal (pin→flank) for the bearing-reaction resultant
    uu.push((((TH[bi]%tp)+tp)%tp)/tp); cpx.push(wx); cpy.push(wy);
    invre.push(contactInvRe(WX,WY,bi,wx,wy,px,py));
  }
  return {gaps,arms,uu,cpx,cpy,invre,cnx,cny,cx,cy,rot:a};
}
// equivalent curvature 1/R_e for the pin↔tooth line contact at the nearest sample.
// ponytail: finite-diff curvature at the contact sample (first-order); concave (conforming) flank
// subtracts, so the cycloid valley gives a low-stress contact. Cap R_e≤1000mm to avoid a 0-stress singularity.
function contactInvRe(WX,WY,bi,wx,wy,px,py){
  const n=WX.length, bm=(bi-1+n)%n, bp=(bi+1)%n;
  const tx=(WX[bp]-WX[bm])*0.5, ty=(WY[bp]-WY[bm])*0.5;      // ≈ 1st derivative
  const ax=WX[bp]-2*wx+WX[bm], ay=WY[bp]-2*wy+WY[bm];        // ≈ 2nd derivative (points to centre of curvature)
  const sp=Math.hypot(tx,ty)||1e-9, kap=Math.abs((tx*ay-ty*ax)/(sp*sp*sp));
  const rho=kap>1e-9? 1/kap : 1e6;
  const concave=(ax*(px-wx)+ay*(py-wy))>0;                    // tooth bends toward the pin ⇒ conforming
  let invRe=concave? Math.abs(1/Rr-1/rho) : (1/Rr+1/rho);
  return invRe<1e-3? 1e-3 : invRe;
}
// worst Hertzian line-contact pressure over the loaded pins [MPa]. F [N], invre [1/mm].
// σ_max = sqrt(F'·E*/(π·R_e)), F'=F/L. Uses the forces the load solve already produced.
function hertzMaxMPa(F,invre){
  let sm=0; for(let j=0;j<F.length;j++){ if(F[j]>0){ const s=Math.sqrt((F[j]/L_TOOTH)*ESTAR*invre[j]/Math.PI); if(s>sm)sm=s; } }
  return sm;
}
function playRange(gaps,arms,tol=0){
  let hi=Infinity, lo=-Infinity;
  for(let j=0;j<gaps.length;j++){ const g=gaps[j]-tol, aa=arms[j];
    if(aa>1e-9) hi=Math.min(hi,g/aa); else if(aa<-1e-9) lo=Math.max(lo,g/aa); }
  return [lo,hi];
}
function windup(gaps,arms){
  // returns absolute loaded output angle b (rad, from ideal conjugate pose); ptp(b) over a
  // mesh cycle is the true loaded transmission error. b = clearance take-up hi + elastic strain.
  const T=T_RATED*1000.0, hi=playRange(gaps,arms)[1];
  const torque=b=>{let s=0;for(let j=0;j<gaps.length;j++){const p=Math.max(0,b*arms[j]-gaps[j]);s+=K_CONTACT*p*arms[j];}return s;};
  let b1=hi+1e-6;
  while(torque(b1)<T){ b1=hi+2*(b1-hi); if(b1-hi>0.05) return {b:(isFinite(hi)?hi:0)+0.05,k:0,ne:0,F:gaps.map(()=>0)}; }
  let b0=hi;
  for(let it=0;it<60;it++){ const bm=0.5*(b0+b1); if(torque(bm)<T) b0=bm; else b1=bm; }
  const b=0.5*(b0+b1), F=gaps.map((g,j)=>K_CONTACT*Math.max(0,b*arms[j]-g));
  let ne=0,k=0; for(let j=0;j<gaps.length;j++) if(F[j]>0){ne++; k+=K_CONTACT*arms[j]**2;}
  return {b,k,ne,F};
}
// Output pin-hole (W) mechanism: the disc drives the output flange through Z_W pins in oversized holes
// (hole radius = pin radius + E + play; the 2E kinematic clearance is consumed by the eccentric orbit, so
// the only backlash source is the manufacturing radial play C_OUT). Same clearance-driven load solve as the
// mesh — uniform gap C_OUT, moment arm R_W·sin(φ−ψ_j) so only ~half the pins carry a given torque direction.
// Profile-independent (geometry only) ⇒ solved once per geometry/spec change and cached in OUT.
function rebuildOutStage(){
  if(!(Z_W>=1)||!(R_W>0)){ OUT={k:Infinity,bl:0,sigma:0,safety:Infinity,neng:0}; return; }
  const arcmin=180/Math.PI*60, invre=Math.abs(1/RW_PIN-1/(RW_PIN+E));   // conforming pin-in-hole line contact (concave ⇒ low stress)
  const cvec=new Array(Z_W).fill(invre);
  let kmin=Infinity, blmax=0, smax=0, nmin=Z_W;
  for(let i=0;i<24;i++){
    const phi=2*Math.PI/Z_W*i/24, gaps=new Array(Z_W), arms=new Array(Z_W);
    for(let j=0;j<Z_W;j++){ arms[j]=R_W*Math.sin(phi-2*Math.PI*j/Z_W); gaps[j]=C_OUT; }
    const [lo,hi]=playRange(gaps,arms); if(hi-lo>blmax)blmax=hi-lo;
    const w=windup(gaps,arms); if(w.k<kmin)kmin=w.k; if(w.ne<nmin)nmin=w.ne;
    const s=hertzMaxMPa(w.F,cvec); if(s>smax)smax=s;
  }
  OUT={ k:kmin/1e3/arcmin, bl:blmax, sigma:smax, safety:(smax>1e-9?SH_LIM/smax:Infinity), neng:nmin };
}
// Manufacturability / validity of the modified flank: min radius of curvature over the CONCAVE (valley)
// regions a finishing wheel must enter (must exceed the tool radius), and a self-intersection/cusp check —
// the equidistant offset folds where its speed →0, so a near-zero min profile speed flags an invalid curve.
function profileHealth(X,Y){
  const n=X.length; let rmin=1e9, minSp=Infinity, meanSp=0;
  for(let i=0;i<n;i++){ const im=(i-1+n)%n, ip=(i+1)%n;
    const tx=(X[ip]-X[im])*0.5, ty=(Y[ip]-Y[im])*0.5;
    const ax=X[ip]-2*X[i]+X[im], ay=Y[ip]-2*Y[i]+Y[im];
    const sp=Math.hypot(tx,ty); if(sp<minSp)minSp=sp; meanSp+=sp;
    if((ax*X[i]+ay*Y[i])>0){ const kap=Math.abs((tx*ay-ty*ax)/(sp*sp*sp||1e-12)), rho=kap>1e-9?1/kap:1e9; if(rho<rmin)rmin=rho; }
  }
  return { rmin, cusp: minSp < 0.02*(meanSp/n) };
}
// n-disc phased superposition of the loaded wind-up waveform: disc k is offset by k/nd of a crank rev, so
// the net output TE cancels every ripple harmonic whose order is NOT a multiple of nd (2 discs kill the odd
// orders incl. the dominant fundamental; 3 discs kill non-multiples-of-3). Interpolated → any sample count.
function phasedPtp(bs, nd){
  const ns=bs.length; let mn=Infinity, mx=-Infinity;
  if(nd<=1){ for(const v of bs){ if(v<mn)mn=v; if(v>mx)mx=v; } return mx-mn; }
  for(let i=0;i<ns;i++){ let s=0;
    for(let k=0;k<nd;k++){ const x=i+ns*k/nd, i0=Math.floor(x)%ns, f=x-Math.floor(x);
      s+=bs[i0]*(1-f)+bs[(i0+1)%ns]*f; }
    s/=nd; if(s<mn)mn=s; if(s>mx)mx=s;
  }
  return mx-mn;
}
function evaluate(offset,coeffs,nPts,variant){
  nPts=nPts||8000;   // match Python NTH so the nearest-point search agrees to the displayed digit
  const prof=profile(offset,coeffs,nPts,variant), arcmin=180/Math.PI*60;
  const DW=dwc(), TS=[ERR.prof/1e3, ERR.pin/2e3, ERR.hole/1e3, SENS_E*ERR.ecc/1e3];   // pin: Ø-band → radius
  const plays=[],rmargins=[],blmaxs=[],ks=[],bs=[],nes=[], bud=[0,0,0,0]; let sigMax=0, Psum=0, plossSum=0, vsMax=0, pvMax=0;
  const P_EXP=10/3;   // roller-bearing life exponent (ISO 281)
  for(let i=0;i<48;i++){   // 48 crank samples over one mesh cycle to resolve the TE ripple
    const psi=2*Math.PI/N*i/48, ms=meshState(prof,psi);
    const [lo,hi]=playRange(ms.gaps,ms.arms); plays.push(hi-lo);
    // ± error band: the tight side (all sources removing clearance) is the jam check, the loose
    // side (all sources adding clearance) bounds the as-built backlash.
    const [tlo,thi]=playRange(ms.gaps,ms.arms,DW); rmargins.push(thi-tlo);
    const [llo,lhi]=playRange(ms.gaps,ms.arms,-DW); blmaxs.push(lhi-llo);
    for(let s=0;s<4;s++){ const pr=playRange(ms.gaps,ms.arms,-TS[s]), wd=pr[1]-pr[0]; if(wd>bud[s])bud[s]=wd; }
    const w=windup(ms.gaps,ms.arms); ks.push(w.k); bs.push(w.b); nes.push(w.ne);
    const s=hertzMaxMPa(w.F,ms.invre); if(s>sigMax)sigMax=s;   // durability: stress on the loaded contacts
    // eccentric-bearing radial load = vector sum of the mesh contact forces (mesh-reaction only; dominant term)
    let Rx=0,Ry=0; for(let j=0;j<Np;j++){ Rx+=w.F[j]*ms.cnx[j]; Ry+=w.F[j]*ms.cny[j]; }
    Psum+=Math.pow(Math.hypot(Rx,Ry),P_EXP);
    // sliding kernel: contact slip v_s = |V_disc·tangent|, V_disc = V_center + ω_disc(=−1/N)×r_c  (per unit ω_in).
    // Feeds mesh friction loss (efficiency) and the PV = σ·v_s wear/scuffing driver. Speed cancels in η.
    const Vcx=E*Math.sin(psi), Vcy=-E*Math.cos(psi);
    for(let j=0;j<Np;j++){ if(w.F[j]<=0) continue;
      const rcx=ms.cpx[j]-ms.cx, rcy=ms.cpy[j]-ms.cy;
      const vs=Math.abs((Vcx+rcy/N)*(-ms.cny[j])+(Vcy-rcx/N)*ms.cnx[j]);
      plossSum+=MU_MESH*w.F[j]*vs;
      const pv=Math.sqrt((w.F[j]/L_TOOTH)*ESTAR*ms.invre[j]/Math.PI)*vs;
      if(vs>vsMax)vsMax=vs; if(pv>pvMax)pvMax=pv;
    }
  }
  // system lost motion = mesh backlash + input-bearing deadband + REAL output pin-hole backlash (OUT.bl),
  // each a first-order output-referred angular deadband (bearing lumped as C_BEAR/Rb).
  const backlash=Math.max(...plays)*arcmin;
  const sysLM=(Math.max(...plays) + C_BEAR/Rb + OUT.bl)*arcmin;
  const kmesh=Math.min(...ks)/1e3/arcmin;
  const stiff=(OUT.k>0&&isFinite(OUT.k))? 1/(1/kmesh+1/OUT.k) : kmesh;   // series: mesh ⊕ output pin-hole (support bearings excluded)
  const Peq=Math.pow(Psum/48,1/P_EXP);   // ISO 281 equivalent dynamic load for the varying cyclic load
  const L10rev=Math.pow(C_BRG/Math.max(Peq,1e-6),P_EXP)*1e6;
  const Pout=T_RATED*1000/N;                       // output power per unit ω_in [N·mm/rad]
  const eta=Pout/(Pout+plossSum/48);               // cycle-mean mesh efficiency (mesh sliding only; ω_in cancels)
  const etaBd=eta>0.5? 2-1/eta : 0;                // standard backdrive relation (η_bd = 2 − 1/η_fwd)
  return { backlash, blmax:Math.max(...blmaxs)*arcmin,
           budget:bud.map(v=>Math.max(0,v*arcmin-backlash)),   // each source's worst-case backlash adder [′]
           stiff, stiffMesh:kmesh,
           ripple:phasedPtp(bs,N_DISC)*1e6,
           rmargin:Math.min(...rmargins)*arcmin, n_eng:Math.min(...nes),
           sigmaH:sigMax, safety:(sigMax>1e-9?SH_LIM/sigMax:Infinity), sysLM,
           outSigma:OUT.sigma, outSafety:OUT.safety, outNeng:OUT.neng, outBL:OUT.bl*arcmin, L10rev, Peq,
           eta, etaBd, vsMax, pvMax, ...profileHealth(prof.X,prof.Y) };
}
// Thermal-clearance drift: at temperature only the pin-circle-vs-disc CTE mismatch shifts the mesh
// (verified: uniform all-steel ΔT leaves angular backlash invariant — a similarity transform). Working in
// the disc's thermal frame, the pin circle moves radially by (CTE_H−CTE_D)·ΔT·Rb against the fixed flank;
// hot (Al housing) opens clearance, cold tightens → cold-start jam. Re-runs the gap field, restores Rb/PINS.
function thermalDrift(offset,coeffs){
  const dRel=(CTE_H-CTE_D)*DELTA_T, arcmin=180/Math.PI*60;
  if(DELTA_T===0 || Math.abs(dRel)<1e-12) return {active:false};
  const prof=profile(offset,coeffs,4000), DW=dwc(), Rb0=Rb, PINS0=PINS;
  Rb=Rb0*(1+dRel); rebuildPins();
  let blmax=0, rmin=Infinity;
  for(let i=0;i<24;i++){ const ms=meshState(prof,2*Math.PI/N*i/24);
    const [lo,hi]=playRange(ms.gaps,ms.arms); if(hi-lo>blmax)blmax=hi-lo;
    const [tlo,thi]=playRange(ms.gaps,ms.arms,DW); if(thi-tlo<rmin)rmin=thi-tlo;
  }
  Rb=Rb0; PINS=PINS0;   // restore the nominal geometry
  return {active:true, backlash:blmax*arcmin, rmargin:rmin*arcmin, jam:rmin<=0, dRb:dRel*Rb0*1e3};
}
// Preload / negative-clearance anti-backlash: how much interference guarantees ZERO backlash across the
// worst-case error stack + hot thermal opening, and what that preload costs. windup()'s clearance-driven
// solve already admits negative gaps; here we (1) binary-search the min interference p that drives the
// worst-case loose play ≤0 at every crank angle, then (2) at p report the no-load torsional stiffness —
// BOTH flanks engage so ≈2× the loaded half-set, the stiffness that governs positioning near zero load
// (today's deadband model reports ~0 there) — and the preload drag torque = Σ μ·F_preload·v_slide.
function preloadReport(offset,coeffs){
  const arcmin=180/Math.PI*60, DW=dwc();
  const thOpen=Math.max(0,(CTE_H-CTE_D)*DELTA_T*Rb);   // hot thermal opening [mm] (cold tightens, needs no preload)
  const open=DW+thOpen;                                // worst-case clearance opening the preload must overcome
  const prof=profile(offset,coeffs,4000), MS=[];
  for(let i=0;i<24;i++){ const psi=2*Math.PI/N*i/24; MS.push({m:meshState(prof,psi),psi}); }
  const worstPlay=p=>{ let w=-Infinity;
    for(const {m} of MS){ const [lo,hi]=playRange(m.gaps.map(x=>x+open-p),m.arms); if(hi-lo>w)w=hi-lo; }
    return w; };
  let lo=0,hi=0.5;                                      // cap 0.5 mm interference
  for(let it=0;it<40;it++){ const mid=0.5*(lo+hi); if(worstPlay(mid)<=1e-9) hi=mid; else lo=mid; }
  const pmin=hi;
  let kmin=Infinity, drag=0;                            // no-load stiffness + drag at the nominal build preloaded by pmin
  for(const {m,psi} of MS){
    const Vcx=E*Math.sin(psi), Vcy=-E*Math.cos(psi); let k=0, td=0;
    for(let j=0;j<Np;j++){ const g=m.gaps[j]-pmin; if(g>=0) continue;
      k+=K_CONTACT*m.arms[j]**2;
      const rcx=m.cpx[j]-m.cx, rcy=m.cpy[j]-m.cy;
      const vs=Math.abs((Vcx+rcy/N)*(-m.cny[j])+(Vcy-rcx/N)*m.cnx[j]);
      td+=MU_MESH*K_CONTACT*(-g)*vs;
    }
    if(k<kmin)kmin=k; if(td>drag)drag=td;
  }
  return { pmin:pmin*1e3, kNoLoad:(isFinite(kmin)?kmin:0)/1e3/arcmin, drag:drag/1000, thOpen:thOpen*1e3 };
}
// Monte-Carlo as-built prediction: sample every manufacturing-error source over its ± band, rebuild
// the gap field, and read off the backlash distribution + jam risk of the units you'd actually make.
// Eccentricity error = the disk was CUT for the nominal E but the shaft throw came out E±e, so only
// the mesh position is perturbed (profile fixed) — finite-differenced per pin per crank angle.
// Also refreshes the global SENS_E for the worst-case math.
// ponytail: pin diameter is common-mode (one batch); hole position and flank error are independent
// per pin, hole error taken fully along the contact normal (worst orientation, mildly conservative).
// mulberry32 PRNG — deterministic draws so the shut-off's per-source deltas use COMMON random numbers.
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
// Base gap field + per-pin ∂gap/∂E; also refreshes the global SENS_E used by the worst-case math.
function mcBuildBase(offset,coeffs){
  const nc=12, nPts=2000, h=0.002, E0=E;
  const base=[], gp=[], gm=[], sens=[]; let sMax=0;
  const p0=profile(offset,coeffs,nPts);
  try{
    for(let c=0;c<nc;c++) base.push(meshState(p0,2*Math.PI/N*c/nc));
    E=E0+h; for(let c=0;c<nc;c++) gp.push(meshState(p0,2*Math.PI/N*c/nc).gaps);
    E=E0-h; for(let c=0;c<nc;c++) gm.push(meshState(p0,2*Math.PI/N*c/nc).gaps);
  } finally { E=E0; }
  for(let c=0;c<nc;c++) sens.push(base[c].gaps.map((g,j)=>{
    const s=(gp[c][j]-gm[c][j])/(2*h); if(Math.abs(s)>sMax)sMax=Math.abs(s); return s; }));
  SENS_E=Math.min(5,Math.max(0.2,sMax));   // clamp against finite-diff noise; typically ~1–2
  return {base, sens, nc};
}
// Draw nSamp as-built units. mult=[prof,pin,hole,ecc] scales each source's band (0 ⇒ that source off).
// seed=null ⇒ Math.random; a number seeds a deterministic PRNG for common-random-number comparisons.
function mcSample(B, nSamp, mult, seed){
  const arcmin=180/Math.PI*60, rng = seed==null? Math.random : mulberry32(seed);
  const ep=ERR.prof/1e3*mult[0], en=ERR.pin/2e3*mult[1], eh=ERR.hole/1e3*mult[2], ee=ERR.ecc/1e3*mult[3];   // en: pin Ø-band → radius
  const bl=[]; let nj=0;
  for(let s=0;s<nSamp;s++){
    const dpin=(2*rng()-1)*en, dE=(2*rng()-1)*ee;
    const uh=[]; for(let j=0;j<Np;j++) uh.push((2*rng()-1)*eh);
    let wide=0, tight=Infinity;
    for(let c=0;c<B.nc;c++){
      const g0=B.base[c].gaps, sc=B.sens[c], g2=new Array(g0.length);
      for(let j=0;j<g0.length;j++) g2[j]=g0[j]-dpin+uh[j]+(2*rng()-1)*ep+sc[j]*dE;
      const pr=playRange(g2,B.base[c].arms), wd=pr[1]-pr[0];
      if(wd>wide)wide=wd; if(wd<tight)tight=wd;
    }
    bl.push(wide*arcmin); if(!(tight>0)) nj++;
  }
  bl.sort((a,b)=>a-b);
  return { p50:bl[Math.floor(nSamp*0.5)], p95:bl[Math.floor(nSamp*0.95)], jam:nj/nSamp };
}
function mcYield(offset,coeffs,nSamp){
  return mcSample(mcBuildBase(offset,coeffs), nSamp||400, [1,1,1,1], null);
}
// Shut-off tolerance sensitivity: which source actually drives the as-built backlash spread? Re-sample the
// SAME Monte-Carlo (common random numbers via a fixed seed) with each source's band zeroed; the p95 drop
// when a source is removed is its total-effect contribution. Correctly separates the common-mode pin-diameter
// batch from the per-unit-independent hole error the coherent worst-case budget over-ranks. Deterministic
// (fixed seed) so the panel ranking doesn't flicker across keystrokes. Returns the full distribution too.
function sobolShutoff(offset,coeffs,nSamp){
  nSamp=nSamp||700; const B=mcBuildBase(offset,coeffs), seed=0x9E3779B9|0;
  const full=mcSample(B,nSamp,[1,1,1,1],seed), drops=[];
  for(let s=0;s<4;s++){ const m=[1,1,1,1]; m[s]=0; drops.push(Math.max(0,full.p95-mcSample(B,nSamp,m,seed).p95)); }
  return { p50:full.p50, p95:full.p95, jam:full.jam, drops };
}
// pick rotation sign by conjugacy of the unmodified tooth (mirrors Python self-check);
// also reports worst residual clearance so we can flag an invalid (undercut) geometry.
function pickRotSign(){
  const prof=profile(0,[],2000,'harmonic');
  let bestSign=-1, bestWorst=Infinity;
  for(const s of [-1,1]){
    let worst=0;
    for(const psi of [0,0.3,1.1]){ const ms=meshState(prof,psi,s); for(const g of ms.gaps) worst=Math.max(worst,Math.abs(g)); }
    if(worst<bestWorst){ bestWorst=worst; bestSign=s; }
  }
  GEOM_WORST=bestWorst; ROT_SIGN=bestSign; return bestSign;
}

function configure(o){
  if('Rb' in o) Rb=o.Rb;
  if('Rr' in o) Rr=o.Rr;
  if('E' in o) E=o.E;
  if('N' in o){ N=o.N; M=N+1; Np=N+1; }
  if('T_RATED' in o) T_RATED=o.T_RATED;
  if('ERR' in o) ERR=o.ERR;
  if('L_TOOTH' in o) L_TOOTH=o.L_TOOTH;
  if('C_BEAR' in o) C_BEAR=o.C_BEAR;
  if('C_OUT' in o) C_OUT=o.C_OUT;
  if('R_W' in o) R_W=o.R_W;
  if('Z_W' in o) Z_W=o.Z_W;
  if('RW_PIN' in o) RW_PIN=o.RW_PIN;
  if('C_BRG' in o) C_BRG=o.C_BRG;
  if('N_IN' in o) N_IN=o.N_IN;
  if('DELTA_T' in o) DELTA_T=o.DELTA_T;
  if('CTE_H' in o) CTE_H=o.CTE_H;
  if('CTE_D' in o) CTE_D=o.CTE_D;
  if('MU_MESH' in o) MU_MESH=o.MU_MESH;
  if('N_DISC' in o) N_DISC=o.N_DISC;
  if('R_TOOL' in o) R_TOOL=o.R_TOOL;
  if('ROT_SIGN' in o) ROT_SIGN=o.ROT_SIGN;
  if('PINS' in o) PINS=o.PINS;
}
function getState(){ return {Rb,Rr,E,N,M,Np,T_RATED,ERR,SENS_E,L_TOOTH,C_BEAR,C_OUT,R_W,Z_W,RW_PIN,C_BRG,N_IN,OUT,DELTA_T,CTE_H,CTE_D,MU_MESH,N_DISC,R_TOOL,ROT_SIGN,GEOM_WORST,PINS,K_CONTACT,ESTAR,SH_LIM}; }
export { profile, meshState, contactInvRe, hertzMaxMPa, playRange, windup, rebuildOutStage, phasedPtp, profileHealth, evaluate, mulberry32, mcBuildBase, mcSample, mcYield, sobolShutoff, thermalDrift, preloadReport, pickRotSign, rebuildPins, dwc, configure, getState };
