# Cycloidal Studio

**Design, optimize, and export cycloidal-drive tooth profiles — right in your browser.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![No build step](https://img.shields.io/badge/build-none-brightgreen)
![Deps: zero for the web tools](https://img.shields.io/badge/web%20deps-none-blue)

*[中文说明 → README.zh.md](README.zh.md)*

Cycloidal drives (the reducers inside RV gearboxes and robot joints) live or die by their
**tooth-profile modification** — a few microns of relief that decide backlash, stiffness,
smoothness, and whether the thing even meshes after you account for machining tolerance. This
project makes that design loop interactive: one self-contained web page with a built-in
multi-objective optimizer, plus a Python pipeline that reproduces the literature benchmarks.

The web tool is **pure HTML/JS/Canvas — no build, no dependencies, no server.** Open the file, or
deploy to GitHub Pages in two clicks.

![Shape Designer](assets/screenshot-designer.png)

---

## Try it

- **Live demo:** **https://shkinsem.github.io/cycloidal-studio/** — no install, runs in the browser.
- **Locally:** clone the repo and open `index.html` in any modern browser.

---

## The tool — `index.html`

Tune one tooth and watch the whole drive respond, live:
- **Editable geometry & spec:** pin-circle Rb, pin radius Rr, eccentricity E, lobe count N, tolerance
  stack, **machining error ±e**, rated torque.
- **Modification** `δ(θ) = offset + Σₖ cₖ·cos(kNθ)` (4 harmonics) with drag sliders and presets.
- **Live optimizer:** a built-in NSGA-II (runs in a Web Worker, no Python) re-searches the optimum for
  *your* current geometry in a few seconds — seeded with known-good designs so it converges reliably.
  Every result is **robust**: it still assembles at the worst-case machining error you set.
- **Live metrics:** backlash, torsional stiffness, transmission-error ripple, tolerance margin,
  **robust margin**, loaded teeth — recomputed from a real quasi-static loaded-contact model as you drag.
- **Animated mesh:** the eccentric disk actually runs; loaded teeth glow.
- **One-click SolidWorks export:** copy the equation-driven `X(t)` / `Y(t)` (numbers baked in) or
  download a point-cloud CSV.
- **EN / 中文** toggle throughout.

The machining-error input is what links backlash to your shop floor: a looser `±e` forces the
optimizer toward more relief (more backlash but never jams as machined); tightening `±e` and the
tolerance stack is how you reach sub-3-arcmin designs.

---

## What it computes

Everything the RV-reducer literature reports, from one model:

| Metric | Meaning | Better |
|---|---|---|
| **Backlash** | mesh-only lost motion / angular play [arcmin] | lower |
| **System lost motion** | mesh + input-bearing + output-coupling clearance, referred to the output [arcmin] | lower |
| **Torsional stiffness** | torque per unit wind-up [N·m/arcmin] | higher |
| **Contact stress** | peak Hertz line-contact pressure on the loaded pin [MPa] | lower |
| **Safety factor** | contact-fatigue limit (≈1500 MPa) ÷ peak contact stress | higher (>1 = holds) |
| **Ripple** | loaded transmission-error swing over a mesh cycle [µrad] | lower |
| **Pressure angle** | force-vs-motion angle at loaded contacts [deg] | lower |
| **Tolerance / robust margin** | free play left under the ±tolerance stack [arcmin] | higher (>0 = doesn't jam) |
| **Manufacturability** | min concave radius of curvature vs tool radius [mm] | higher |
| **Loaded teeth** | how many teeth share the rated torque | higher |

---

## The Python pipeline (optional — for benchmarking)

The web tool needs no Python. The `optimizer/` pipeline exists to **verify the physics against the
literature** and to produce reference fronts at higher resolution (its knee designs are the web
tool's presets):

```bash
pip install -r requirements.txt
cd optimizer

python test_model.py        # sanity checks (fast)
python benchmark.py         # reproduce the literature trends (5/5)
python optimize.py          # NSGA-II → results/pareto_front.csv (+ plot, SolidWorks export)
python model.py             # analysis figures for one design → results/
```

`optimize.py` runs a real **NSGA-II** (via `pygad`, no exotic deps) over a 4-harmonic profile
`δ(θ)=offset+Σₖ cₖ·cos(kNθ)`, four objectives (backlash, stiffness, ripple, pressure angle) under
hard constraints (robust margin ≥ 0.5′, manufacturable, removes material everywhere). A quick smoke
run: `QUICK=1 python optimize.py`.

---

## How it stacks up against the papers

A literature review (see the notes in git history) found that "using a neural network to learn the
optimal profile" is mostly a myth in this field: published ML is almost entirely **surrogate models**
that just accelerate FEA inside a **classical GA/NSGA-II**. The design-freedom win comes from a
**richer geometric parameterization**, not a neural net. This project takes exactly that route —
richer harmonics + NSGA-II + manufacturing-error robustness — and `benchmark.py` reproduces the field's
qualitative results **5/5**:

1. Modification relieves peak pressure angle (unmodified ≈ 85° → ≈ 55°).
2. "Reverse-bow" modification beats a pure offset on stiffness and load sharing.
3. Loaded-tooth count rises with torque (elastic load spreading).
4. Backlash and tolerance margin trade off monotonically.
5. Machining error erodes margin — a nominal-optimal design can jam where a robust one holds.

Physics is quasi-static, rigid-disk, linearized contact — trends are faithful; absolute values are
order-of-magnitude. For paper-grade absolute numbers the next step is loaded-tooth-contact / FEA.

---

## Deploy to GitHub Pages

The site is static, so deployment is trivial. Either way:

**A. Automatic (included workflow).** Push to `main`; the workflow in `.github/workflows/pages.yml`
publishes the site. Enable it once: **Settings → Pages → Build and deployment → Source: GitHub Actions.**

**B. Zero-config.** **Settings → Pages → Deploy from a branch → `main` / root.**

Your site appears at `https://<your-username>.github.io/<repo>/`.

---

## Project structure

```
index.html              # the tool: designer + live robust optimizer (open this)
pareto.html             # legacy URL — redirects to index.html
optimizer/
  model.py              # physics core: mesh, backlash, stiffness, ripple, margin (verified)
  objectives.py         # K-harmonic profile + pressure angle / manufacturability / robustness
  optimize.py           # NSGA-II multi-objective → Pareto front
  benchmark.py          # reproduces the literature trends (5/5)
  test_model.py         # unit checks
  results/              # pareto_front.csv (committed reference front; figures/txt are regenerable, gitignored)
assets/                 # screenshot used in this README
cad/                    # reference SolidWorks part
requirements.txt        # numpy, matplotlib, pygad (only for the optimizer)
```

---

## Contributing

Issues and PRs welcome — this is meant to be hacked on. Good first directions: higher-fidelity
loaded-tooth-contact physics, a spline/NURBS parameterization option, exporting to other CAD formats,
or per-harmonic machining-error models beyond the uniform worst case.

## License

MIT — see [LICENSE](LICENSE). Built for the RoboMaster community and cycloidal-drive tinkerers.
