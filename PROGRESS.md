# Build progress — benchmarkable cycloidal design tool (/loop autonomous)

**Goal:** evolve the tool so its results can be benchmarked against the published literature:
richer parameterization + full objective set (incl. pressure angle, manufacturability, smoothness,
robustness) + NSGA-II Pareto front + validation reproducing published qualitative findings + HTML.

**Guiding facts (from deep-research):** ML in this field = surrogates wrapping classical GA/NSGA-II/DE;
the design-freedom win is richer GEOMETRIC parameterization (splines / many harmonics / vectorial),
NOT neural nets. Published baselines to hit: piecewise-spline beats offset+shift (IJPEM 2024);
reverse profile optimal under large clearance/torque (Appl.Sci 2019); load-compensated modification
cut backlash 1.3->0.66 arcmin ~49% EXPERIMENTALLY (RG backlash paper); pressure-angle used as a design
variable (Appl.Sci 2020). Non-NN NSGA-II is the field's consensus optimizer.

**Architecture decision:** keep verified `CycloidalModAnalysis.py` core untouched; add
`cycloidal_advanced.py` that reuses its `mesh_state/play_range/windup` with a richer profile +
new metrics + NSGA-II (pygad, no new dep). Update HTML after Python is validated.

## Stages
- [x] A. Richer parameterization: δ(θ)=offset+Σ_{k=1}^K c_k·cos(kNθ) (cosine-only=bidirectional-symmetric),
      K configurable (default 6). Reduces to current at K=2. `profile_coeffs`, `evaluate_design`.
- [x] B. New metrics: pressure angle (max/RMS over loaded contacts), min radius of curvature
      (manufacturability vs tool radius), geometric smoothness (curvature variation), robustness
      (metric spread under ± machining perturbation). All in `evaluate_design`.
- [x] C. NSGA-II multi-objective (pygad nsga2): design vec p=[offset,c1..cK] → Pareto front over
      {backlash, -stiffness, ripple, max_pressure_angle} with hard constraints (margin>=0.5,
      min_curv_radius>=tool, delta<=-5um everywhere). Save Pareto CSV + plot + a picked knee design.
- [x] D. Benchmark/validation script `cycloidal_benchmark.py`: reproduce published qualitatives
      (reverse-bow optimal at high torque; combined>pure-offset; pressure angle bounded; backlash
      reduction magnitude sane). Print a PASS/orientation table vs the papers.
- [x] E. HTML: interactive Pareto explorer cycloidal_pareto.html (bilingual, click-to-inspect, K-harmonic
      SolidWorks export) + cross-link from the designer. (Chose a focused explorer over rewriting the 715-line
      designer — lower risk, and a browsable Pareto front IS the literature-comparable artifact.)
- [x] F. Docs (UPDATE_NOTES updated), committed. Final report + publish + stop loop.

## COMPLETE — all stages A-F done. Tool is benchmarkable (Pareto front + 5/5 literature benchmark).

## State / notes
- pygad 3.5 supports NSGA-II (list fitness + parent_selection_type='nsga2'). scipy 1.15 available. pymoo NOT installed.
- Reuse verified physics; JS parity must be re-checked after HTML update.
- Current committed baseline (3-harmonic GA optimum): offset -0.0209 s1 -0.0012 s2 -0.0037 -> backlash 5.06', stiff 35.7, ripple 16.4, margin 0.69, 4 teeth.

## Done log
- Iter 1: `cycloidal_advanced.py` — K-harmonic profile_coeffs, evaluate_design (parity K=2 exact vs base:
  5.056/35.716/16.441/0.688/4), pressure angle (force-weighted; modification 84.9->55.1deg confirms metric),
  min_curv_radius (manufacturability, 2.6mm), smoothness_tv, evaluate_robust (±tol margin). `cycloidal_nsga2.py`
  — NSGA-II (pygad, K=4) → Pareto front + CSV + plot + SW export; QUICK smoke passed (20-pt front). Committed.
  Full NSGA-II run launched in background (45 gens, pop 44).
- Iter 2: full NSGA-II done — 1788 evals -> 114-pt robust Pareto front (pareto_front.csv, ParetoFront.png,
  solidworks_equations_pareto.txt). Knee: offset -0.0483 c=[-0.0239,-0.0166,-0.0107,-0.0035] -> backlash 8.90',
  stiff 35.7, ripple 42.2, maxPA 47.8deg, worstMargin 2.98', 4 teeth. Front shows stiffness<->pressure-angle
  coupling. Benchmark 5/5 PASS. KEY FINDING: prior nominal 3-harm optimum (offset -0.0209) has worst_margin
  -1.79' under +/-7.5um => JAMS; robust Pareto designs don't. Committed.
- NEXT (iter 3) — Stage E HTML integration (the big one):
  1. Port pressure angle to JS (compute at loaded contacts in the mesh loop) + add to live metrics.
  2. Extend modification UI from fixed offset/s1/s2 to offset + K coefficient sliders (K=4); update SW export to K terms.
  3. Add worst_margin (robustness) to live metrics (evaluate at offset +/- TOL/2).
  4. Embed pareto_front.csv as JSON -> Pareto explorer panel (scatter backlash vs stiffness, color=pressure angle,
     click a point loads that design's coeffs into the designer). This is the headline "对标论文" visual.
  5. Re-verify JS==Python parity (backlash/stiff/ripple/margin/teeth/pressure-angle) at a couple designs.
  Then Stage F: UPDATE_NOTES + final report + PushNotification, then stop the loop.
