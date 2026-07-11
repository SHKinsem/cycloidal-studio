import { configure, getState, profile, meshState, windup, playRange, hertzMaxMPa, phasedPtp, profileHealth } from './physics.js';
var DWC=0, OUT_K=Infinity, N_DISC=1, R_TOOL=0.1, NK=4;
function evalFast(offset,coeffs){
  var nPts=1800, ns=14, prof=profile(offset,coeffs,nPts), arcmin=180/Math.PI*60;
  var __s=getState(), N=__s.N, Np=__s.Np, PINS=__s.PINS;
  var plays=[],blmaxs=[],rmargins=[],ks=[],bs=[],nes=[], paMax=0, sigMax=0;
  for(var i=0;i<ns;i++){ var psi=2*Math.PI/N*i/ns, ms=meshState(prof,psi);
    var pr=playRange(ms.gaps,ms.arms); plays.push(pr[1]-pr[0]);
    var pm2=playRange(ms.gaps,ms.arms,DWC); rmargins.push(pm2[1]-pm2[0]);
    var pl=playRange(ms.gaps,ms.arms,-DWC); blmaxs.push(pl[1]-pl[0]);
    var w=windup(ms.gaps,ms.arms); ks.push(w.k); bs.push(w.b); nes.push(w.ne);
    var sg=hertzMaxMPa(w.F,ms.invre); if(sg>sigMax)sigMax=sg;
    var fmax=1e-9; for(var j=0;j<Np;j++) if(w.F[j]>fmax)fmax=w.F[j];
    for(var j=0;j<Np;j++){ if(w.F[j]>0.10*fmax){ var px=PINS[j][0],py=PINS[j][1], nx=px-ms.cpx[j], ny=py-ms.cpy[j], nn=Math.hypot(nx,ny);
      if(nn>1e-9){ var phi=Math.atan2(py,px), c=Math.abs((nx/nn)*(-Math.sin(phi))+(ny/nn)*Math.cos(phi)); var a=Math.acos(Math.min(1,Math.max(0,c)))*180/Math.PI; if(a>paMax)paMax=a; } } }
  }
  var kmesh=Math.min.apply(null,ks)/1e3/arcmin;
  var ksys=(OUT_K>0&&isFinite(OUT_K))? 1/(1/kmesh+1/OUT_K) : kmesh;   // series with output pin-hole stage (matches main panel)
  var H=profileHealth(prof.X,prof.Y);
  return { backlash:Math.max.apply(null,plays)*arcmin, blmax:Math.max.apply(null,blmaxs)*arcmin,
           stiff:ksys,
           ripple:phasedPtp(bs,N_DISC)*1e6,
           rmargin:Math.min.apply(null,rmargins)*arcmin, n_eng:Math.min.apply(null,nes), maxPA:paMax, sigmaH:sigMax,
           rmin:H.rmin, cusp:H.cusp };
}
var LO=[-0.10,-0.04,-0.04,-0.04,-0.04], HI=[-0.015,0.04,0.04,0.04,0.04], D=5, POP=48, GEN=44, SEEDS=[];
function rnd(a,b){return a+Math.random()*(b-a);}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function newx(){var x=[];for(var i=0;i<D;i++)x.push(rnd(LO[i],HI[i]));return x;}
function evalx(x){ var coeffs=x.slice(1), r=evalFast(x[0],coeffs), dmax=x[0];
  for(var i=0;i<coeffs.length;i++)dmax+=Math.abs(coeffs[i]);
  var cv=0; if(dmax>-0.005)cv+=(dmax+0.005)*100; if(!isFinite(r.ripple))cv+=100;
  if(r.rmargin<0.05)cv+=(0.05-r.rmargin); if(r.n_eng<2)cv+=1;   // robust: must survive worst machining error
  if(r.cusp)cv+=100; if(r.rmin<R_TOOL)cv+=(R_TOOL-r.rmin)*10;   // manufacturable: no self-intersection, concave radius ≥ tool
  r.f=[r.backlash,-r.stiff,r.ripple,r.maxPA]; r.cv=cv; r.x=x; return r; }
function dom(a,b){ if(a.cv>0||b.cv>0) return a.cv<b.cv;
  var le=true,lt=false; for(var k=0;k<4;k++){ if(a.f[k]>b.f[k]+1e-12)le=false; if(a.f[k]<b.f[k]-1e-12)lt=true; } return le&&lt; }
function ndsort(P){ var S=[],n=[],fronts=[[]];
  for(var p=0;p<P.length;p++){ S[p]=[]; n[p]=0;
    for(var q=0;q<P.length;q++){ if(p===q)continue; if(dom(P[p],P[q]))S[p].push(q); else if(dom(P[q],P[p]))n[p]++; }
    if(n[p]===0){P[p].rank=0; fronts[0].push(p);} }
  var i=0; while(fronts[i] && fronts[i].length){ var nx=[];
    for(var a=0;a<fronts[i].length;a++){ var pi=fronts[i][a];
      for(var b=0;b<S[pi].length;b++){ var qi=S[pi][b]; n[qi]--; if(n[qi]===0){P[qi].rank=i+1; nx.push(qi);} } }
    i++; fronts.push(nx); } fronts.pop(); return fronts; }
function crowd(P,idxs){ for(var k=0;k<idxs.length;k++)P[idxs[k]].cd=0;
  for(var m=0;m<4;m++){ idxs.sort(function(a,b){return P[a].f[m]-P[b].f[m];});
    P[idxs[0]].cd=Infinity; P[idxs[idxs.length-1]].cd=Infinity;
    var rg=(P[idxs[idxs.length-1]].f[m]-P[idxs[0]].f[m])||1;
    for(var i=1;i<idxs.length-1;i++)P[idxs[i]].cd+=(P[idxs[i+1]].f[m]-P[idxs[i-1]].f[m])/rg; } }
function tour(P){ var a=P[Math.floor(Math.random()*P.length)], b=P[Math.floor(Math.random()*P.length)];
  if(a.rank!==b.rank) return a.rank<b.rank?a:b; return (a.cd||0)>(b.cd||0)?a:b; }
function cross(p1,p2){ var c1=[],c2=[]; for(var i=0;i<D;i++){ var lo=Math.min(p1.x[i],p2.x[i]), hi=Math.max(p1.x[i],p2.x[i]), d=hi-lo||1e-6;
  c1.push(clamp(lo-0.25*d+Math.random()*1.5*d,LO[i],HI[i])); c2.push(clamp(lo-0.25*d+Math.random()*1.5*d,LO[i],HI[i])); } return [c1,c2]; }
function mutate(x){ for(var i=0;i<D;i++) if(Math.random()<0.25) x[i]=clamp(x[i]+(Math.random()-0.5)*(HI[i]-LO[i])*0.15,LO[i],HI[i]); return x; }
function frontOut(pop){ var feas=pop.filter(function(p){return p.cv===0;});
  var nd=feas.filter(function(p,i){ for(var j=0;j<feas.length;j++){ if(j!==i && dom(feas[j],p)) return false; } return true; });
  var out=[]; nd.forEach(function(p){ if(!out.some(function(q){return Math.abs(q.backlash-p.backlash)<0.05 && Math.abs(q.stiff-p.stiff)<0.2;}))
    out.push({offset:p.x[0],coeffs:p.x.slice(1),backlash:p.backlash,blmax:p.blmax,stiff:p.stiff,ripple:p.ripple,maxPA:p.maxPA,rmargin:p.rmargin,n_eng:p.n_eng,sigmaH:p.sigmaH}); });
  return out; }
function run(){
  var pop=[];  // seed with known-good designs first, then fill with random exploration
  for(var s=0;s<SEEDS.length && pop.length<POP;s++){ var sx=SEEDS[s].slice(0,D); while(sx.length<D)sx.push(0);
    for(var i=0;i<D;i++)sx[i]=clamp(sx[i],LO[i],HI[i]); pop.push(evalx(sx)); }
  while(pop.length<POP)pop.push(evalx(newx()));
  for(var gen=0; gen<GEN; gen++){
    var off=[]; while(off.length<POP){ var cs=cross(tour(pop),tour(pop)); off.push(evalx(mutate(cs[0]))); if(off.length<POP)off.push(evalx(mutate(cs[1]))); }
    var R=pop.concat(off); var fronts=ndsort(R); var np=[], fi=0;
    while(fi<fronts.length && np.length+fronts[fi].length<=POP){ crowd(R,fronts[fi]); for(var a=0;a<fronts[fi].length;a++)np.push(R[fronts[fi][a]]); fi++; }
    if(np.length<POP && fi<fronts.length){ crowd(R,fronts[fi]); var last=fronts[fi].slice().sort(function(a,b){return (R[b].cd||0)-(R[a].cd||0);});
      for(var a=0;a<last.length && np.length<POP;a++)np.push(R[last[a]]); }
    pop=np;
    postMessage({type:'progress', pct:Math.round(100*(gen+1)/GEN), front:frontOut(pop)});
  }
  postMessage({type:'done', pct:100, front:frontOut(pop)});
}
onmessage=function(e){ var g=e.data;
  configure({Rb:g.Rb,Rr:g.Rr,E:g.E,N:g.N,T_RATED:g.T_RATED,ROT_SIGN:g.ROT,PINS:g.PINS,L_TOOTH:g.L_TOOTH});
  DWC=g.DWC||0; OUT_K=g.OUT_K; N_DISC=g.N_DISC||1; R_TOOL=g.R_TOOL||0.1; NK=g.NK; SEEDS=g.SEEDS||[];
  run();
};
