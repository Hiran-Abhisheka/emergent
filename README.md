# Emergent — Artificial Life Laboratory

A 2D artificial-life simulation where **every creature is controlled by its own
small neural network**. Creatures forage, spend energy, reproduce with mutation,
and die. Evolution is not scripted — it emerges from the rules.

Everything the UI shows (numbers, charts, the network diagram, the statistics
series) comes from real simulation state. There is no fake data, no placeholder
logic, and no external AI service. The engine is pure TypeScript with **zero DOM
or React imports**, so the same code runs in the browser worker and headless in
Node for calibration and tests.

### ▶ [**Live demo**](https://emergent-nine-lemon.vercel.app/)

Open it and press **Start** — no install required.

---

## Quick start

```bash
npm install

npm run dev        # dev server (Vite)
npm run build      # production build (typechecks first)
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit, strict
npm run lint       # ESLint
npm test           # Vitest unit + integration tests
npm run calibrate  # headless 10-seed × 20 000-tick calibration, no browser
```

Node 20+ is required. Exact pinned dependency versions are in `package.json`
(no caret ranges).

---

## Using the laboratory

The app opens **paused at tick 0** with 100 founders. Press **Start** (or
Space).

| Tab | What it is for |
| --- | --- |
| **World** | The live canvas. Drag to pan, scroll to zoom about the cursor, click a creature to inspect it. |
| **Statistics** | Live charts of population, energy, generation, trait distributions and completed-lifetime food intake. |
| **Experiments** | Capture the current run, keep a library of runs, and overlay any subset on one chart. |
| **Saves** | Durable snapshots, a rolling autosave, and JSON/CSV import & export. |

The right rail holds **Environment** (the full configuration editor),
**Inspector** (the selected creature, its sensors and its network diagram) and
**View** (colour modes and overlays). Each environment field is marked **live**
(applied to the running world immediately) or **reset** (kept as a draft until
"Apply & reset").

**Keyboard:** `Space` run/pause · `Escape` deselect · `F` fit view ·
`1`–`4` switch tabs.

---

## The model

### World and time

The world is **1200 × 800 simulation units**, seeded with 250 food items placed
in 6 clusters plus a uniform background fraction, and 6 obstacles (circles and
rectangles). The engine advances in **whole ticks at 30 ticks/second**; the UI
speed control changes only how many ticks are run per animation frame, never the
tick semantics.

### Genome: 8 → 12 → 4 network

Each creature carries a flat `Float32Array` of **160 parameters**:

```
inputs(8) → hidden(12, tanh) → outputs(4, tanh)

w1: 8×12 = 96
b1:     12
w2: 12×4  = 48
b2:      4
        ---
        160
```

Layout is versioned (`GENOME_LAYOUT_VERSION`), so a stored genome is only
accepted by a reader that agrees on the meaning of every parameter.

### Sensors (input vector, all bounded)

| # | Sensor | Range | Meaning |
| --- | --- | --- | --- |
| 0 | energy | [0,1] | `energy / maxEnergy` |
| 1 | food proximity | [0,1] | `1 − d/visionRange` to nearest **visible** food |
| 2 | food bearing | [−1,1] | relative angle to that food, `Δθ/π` |
| 3 | food visible | {0,1} | any food within vision |
| 4 | obstacle proximity | [0,1] | nearest obstacle **or wall** within vision |
| 5 | obstacle bearing | [−1,1] | relative angle to it |
| 6 | previous speed | [0,1] | `speed / own maxSpeed` |
| 7 | food density | [0,1] | visible food count / 5, saturating |

Perception is **limited to the creature's own `visionRange`** and is currently
omnidirectional (field-of-view is a documented future extension). Sensors never
tell a creature which way is "better" — they only expose the world.

### Outputs

Outputs are `tanh` in [−1,1]: `turn left`, `turn right`, `thrust`, `reproduce`.
Turning is `(turnRight − turnLeft) × maxTurnRate`; a `reproduce` output above
`0.5` counts as an attempt (the attempt can still fail its preconditions).

### Energy: every benefit carries a real cost

```
cost = ( basalCost
       + moveCost   × (speed       / baseMaxSpeed)²
       + visionCost × (visionRange / baseVisionRange) )
     × metabolicMultiplier
```

The denominators are the **global** config baselines, not the creature's own
traits. That is deliberate (D-105): normalising by the creature's own maximum
would make a fast creature pay exactly what a slow one pays, and the speed trait
would then be free. Measuring against the baseline means faster and
farther-seeing creatures genuinely pay more, which is what lets selection act on
those traits at all.

Eating adds `foodEnergy` (30) and clamps to `maxEnergy` (100).

### Movement, collision and eating

Speed blends toward the thrust target each tick (smoothing 0.35) and is capped
by the creature's `maxSpeed` trait. Creatures collide with obstacles and walls
and slide along them. Food is eaten when within `creatureRadius + FOOD_RADIUS`.
If several creatures reach the same item in one tick, the **lowest creature id**
wins (creatures are always processed in ascending id order and each item has an
`eaten` flag, so it is removed exactly once). There is no creature–creature
collision (D-204).

### Death and reproduction

A creature dies when `energy ≤ 0` or `age ≥ maxLifespan` (3000). Its exact
lifetime totals are folded into the per-generation tables at the moment of
death, which is what makes "food per **completed** lifetime" honest.

Reproduction is asexual and gated on all of: alive, `cooldown ≤ 0`,
`aliveCount < maxPopulation`, `energy ≥ reproductionThreshold` (90) and
`energy ≥ reproductionCost` (50). **Reproduction never creates energy:** the
parent pays 50, the child starts with 40, and the difference of 10 is lost to
the world. The child is placed near the parent (falling back to the parent's own
position if no free spot is found) and **never acts on the tick it is born**.

### Mutation

Mutation is part of the run — a heritable `mutationRate` trait, not a toggle.

- **Genome:** each parameter is perturbed with probability `mutationRate`
  (default 0.02) by Gaussian noise of std `mutationStrength` (0.15).
- **Traits:** each trait is perturbed **log-normally**,
  `value × exp(N(0, traitMutationStrength))`, so a trait can never flip sign,
  then clamped to its documented range.

| Trait | Range | Cost |
| --- | --- | --- |
| `maxSpeed` | 0.5 – 4.0 | movement cost scales with `speed²` |
| `visionRange` | 40 – 320 | vision cost scales linearly |
| `metabolicMultiplier` | 0.5 – 2.0 | multiplies the whole basal cost |
| `mutationRate` | 0.005 – 0.1 | affects offspring fidelity |

Founders are drawn from a single documented prior (identical for all founders):
Gaussian weights with per-layer std `1/√fan-in`, small hidden biases, and a
**positive thrust bias** (`tanh(0.75) ≈ 0.635`, so fresh creatures drift forward
instead of freezing). This is an initialisation prior, not reward shaping — no
part of the system rewards a creature for approaching food.

---

## Determinism

A single seeded PRNG (sfc32 seeded by splitmix32) lives **inside the world
state**, so the entire run is reproducible from the seed and the command
history. Gaussian draws use Box–Muller consuming exactly two uniforms with no
cached spare, which keeps the draw sequence stable.

- Commands are applied **at tick boundaries**: the worker handles messages in
  the same task loop that steps the world, so a command can never interleave
  with a tick.
- `hashState(world)` (FNV-1a) is the equality check used by tests and by the
  round-trip storage tests.
- `Math.random` and `Date.now` appear **nowhere** in the engine.
- **Known caveat:** `Math.tanh` is not required to be bit-identical across JS
  engines, so determinism is guaranteed within one engine/browser, not
  bit-exactly across all of them. Speed is wall-clock pacing, not state:
  determinism is defined **per tick**, so 1 000 ticks produce identical state
  regardless of how many frames or how many seconds it took.

---

## Architecture

```
main thread                     worker (owns the world)
-----------                     ------------------------
React UI  ──commands──────────▶  simulation.worker.ts
          ◀─events/snapshots──   stepWorld(world, runtime)
   canvas (reads a ref)          spatial grid, sensors, NN, energy
```

- **The worker owns authoritative state.** The UI never mutates the world; it
  sends typed, runtime-validated commands.
- **Snapshots are pooled and transferred**, not copied: a stride-6
  `Float32Array` (`x, y, heading, energy, flags, colorValue`) plus a parallel
  `Int32Array` of ids. Buffers are returned to the worker via an ack, so
  steady-state allocation is ~zero. Snapshots are published through a
  **`useRef`, never React state** — putting a 30 Hz buffer into state would
  re-render the app 30 times a second.
- **Statistics** are emitted every 30 ticks and **inspection** every 3 ticks
  (the engine's `METRICS_HISTORY_CAPACITY` ring buffer holds 4 000 samples —
  ≈ 66 minutes at 1 sample/s).
- **Rendering** is canvas-only per creature with device-pixel-ratio scaling, a
  `ResizeObserver`, wheel zoom about the cursor, drag pan, and click-to-select
  by id. Colour modes (energy, generation, speed, food eaten, lineage) and
  overlays (vision circle, sensor lines, ids) are drawn from real state.
- **Analysis views are code-split** (`React.lazy`). Recharts is ~363 kB
  (107 kB gzip) and loads only when you open Statistics, Experiments or Saves;
  the world view — the thing that must feel instant — ships at ~446 kB
  (144 kB gzip) and the worker at ~28 kB.

### Project layout

```
src/simulation/          engine — no DOM, no React
  constants.ts           every named constant
  config.ts              SimConfig, limits, validation, live-vs-reset keys
  types.ts               WorldState, Creature, MetricsPayload, StatsSample
  presets.ts             scenario presets (pure config patches)
  engine/                prng, genome-aware world, spatial grid, sensors,
                         movement, energy, food, reproduction, placement,
                         obstacles, hash, step
  neural/genome.ts       forward pass, founder prior, genome mutation
  evolution/traits.ts    trait ranges, founder traits, log-normal mutation
  metrics/               collectors, diversity (histograms, dispersion)
  renderer/              camera, colours, draw
  storage/               SerializedWorld, base64, JSON round-trip
  experiments/           run records, comparison, CSV
  worker/                protocol messaging, inspection, snapshot pool
  simulation.worker.ts   world owner + tick loop

src/components/          ui primitives, canvas, controls, inspector, charts,
                         experiments, persistence, layout
src/hooks/               worker lifecycle, camera, env draft, experiments,
                         experiment library, persistence
src/storage/db.ts        IndexedDB (idb): save slots + experiment library
scripts/calibrate.ts     headless calibration harness
docs/DECISIONS.md        the running log of every design decision
```

---

## Calibration — and an honest negative result

`npm run calibrate` runs 10 seeds × 20 000 ticks headless and reports survival,
population, generations and per-generation lifetime food intake. Current
findings on the default configuration:

| | mutation on | mutation off (control) |
| --- | --- | --- |
| extinctions | **0 / 10** | 1 / 10 |
| time pinned at cap | 0.7 % | 0.8 % |
| mean population | 232.2 | 199.0 |
| mean max generation | 25.7 | 24.0 |
| mean cumulative births | 2342 | 2011 |
| final mean traits | speed 1.58, vision 107.5, metab 0.75, mutRate 0.0225 | speed 1.32, vision 107.4, metab 0.79, mutRate 0.0187 |

The population survives on every seed and does not pin at the cap, which were
the survival targets. **However, the intake-efficiency target is not clearly
met, and the calibration says so rather than hiding it:** mean food eaten per
completed lifetime, early vs late generation, moves from 2.80 → 2.03 (mutation
on) and 2.78 → 2.28 (mutation off) — i.e. **no clear improvement over the
control** on these settings. Mutation-on does survive better and reach a higher
population, so selection is doing *something*; the honest reading is that in a
food-limited world where the cap is rarely reached, intake per lifetime is
dominated by density and competition effects rather than by improving foraging
skill. See `docs/DECISIONS.md` for the calibration history and the metrics used.

---

## Accessibility

- The app is fully keyboard-operable: `Tab` reaches every control, a global
  focus ring marks the focused element, and all icon-only buttons carry
  `aria-label`s.
- The world canvas is a labelled, focusable widget: arrows pan, `+`/`-` zoom,
  `F` fits, `Escape` clears the selection, and the panel readouts give every
  number as text.
- Small labels meet WCAG AA contrast (see D-703). One known limitation is
  recorded honestly in `docs/DECISIONS.md` (D-704): decorative hairline borders
  sit below the 3:1 non-text threshold; only borders that are the *sole*
  indicator of a control's boundary use the high-contrast variant.
- The app starts paused, and nothing animates until you ask it to.

---

## Persistence and export

Everything is local to the browser (`emergent-lab` IndexedDB); nothing is
uploaded anywhere.

- **Save slots** store the exact `SerializedWorld` **plus** the statistics
  series, so loading resumes the whole laboratory rather than just the
  creatures. World blobs are kept in a separate object store from the small
  listable headers, so the list never deserializes a world to render a row.
- **A rolling autosave** every 30 seconds (while running) goes to a reserved
  slot that is never listed with manual saves; a reload does **not** silently
  restore it — restoring is an explicit button press.
- **Export** produces a portable JSON world, a CSV of the statistics series, a
  CSV per recorded run, or the whole experiment library as JSON. Imports are
  validated with the engine's own reader before they reach the worker, and
  anything malformed, outdated or duplicated is skipped with a message.
- IndexedDB can be unavailable (private/embedded contexts); the app detects this
  and degrades to session-only, still offering JSON/CSV export.

---

## Testing

```bash
npm test
```

Vitest covers the engine and the data layer: seeded determinism and state
hashing, neural forward pass and genome mutation, spatial-grid queries, the full
tick pipeline and pipeline ordering, energy accounting (including that
reproduction never creates energy), death/lifetime tables, config validation and
live-vs-reset classification, structured and JSON serialization round-trips
(bit-exact), metrics collection, experiment records/comparison/validation, and
CSV formatting. Browser QA (canvas rendering, charts, dialogs, IndexedDB
persistence across a reload) is run separately against the production build with
Playwright, asserting **zero console errors and zero failed requests**.

---

## Limitations and future work

- Intake-efficiency evolution is not clearly demonstrated on the default
  settings (see above). Longer runs, larger populations, or a harder energy
  budget would be the next experiments — the Experiments and Saves tabs exist
  precisely to make those runs comparable and repeatable.
- Vision is omnidirectional; a field-of-view cone is a documented extension.
- There is no creature–creature collision, and no predation.
- Saved worlds are tied to the save schema and genome layout versions; a
  mismatch is rejected with a clear message rather than being guessed at.
- `Math.tanh` prevents bit-exact cross-browser determinism.

## Documentation

`docs/DECISIONS.md` is the authoritative log: every non-obvious choice, the
alternative it was chosen over, and the reason — including the decisions that
were later superseded.
