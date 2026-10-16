# Emergent — Decisions log

Every non-obvious choice (especially where the build spec was ambiguous) is
recorded here as **Decision / Reason / Alternative**.

## Stage 0 — scaffolding

### D-001 Tech stack versions

- **Decision:** React 19.3.1, TypeScript 5.9.3, Vite 7.3.7, `@vitejs/plugin-react`
  5.2.0, Tailwind CSS 4.3.3 (`@tailwindcss/vite`), Recharts 3.10.1, `idb` 8.0.4,
  Vitest 5.0.5, ESLint 10.12.0 + `typescript-eslint` 8.71.2, `tsx` 4.23.15.
  All pinned to exact versions.
- **Reason:** This is the newest mutually compatible set. `@vitejs/plugin-react`
  v6 requires Vite 8, and `typescript-eslint` 8.x requires TypeScript `< 6.1`,
  so Vite 7 + TS 5.9 was the safe intersection. Tailwind 4 + shadcn-style
  primitives install cleanly with the Vite plugin.
- **Alternative:** Vite 8 + plugin-react 6 (bleeding edge, more peer-dep risk);
  Tailwind 3 (older toolchain, larger config surface).

### D-002 Single flat `tsconfig.json`

- **Decision:** One `tsconfig.json` covering `src`, `tests`, `scripts`,
  `vite.config.ts` (no project references / composite build).
- **Reason:** Simpler `typecheck`/`build` (`tsc --noEmit`), and this project has
  a single output target. The Vite React template's split configs exist mainly
  for composite builds, which we do not need.
- **Alternative:** `tsconfig.app.json` + `tsconfig.node.json` references.

### D-003 Extensionless TS imports

- **Decision:** Import engine modules without `.ts` extensions
  (`allowImportingTsExtensions: false`).
- **Reason:** Matches Vite convention; works with Vite, Vitest and `tsx`.
- **Alternative:** Force `.ts` extensions everywhere (`allowImportingTsExtensions: true`).

## Stage 1 — foundation

### D-101 PRNG = sfc32, seeded via splitmix32

- **Decision:** `Rng` uses sfc32 for output and splitmix32 to expand one integer
  seed into the four 32-bit state words. State lives in the world state.
- **Reason:** Spec named sfc32 or mulberry32. sfc32 has a longer period and a
  compact serialisable 4-word state. splitmix32 gives good word dispersion from
  a single integer seed.
- **Alternative:** mulberry32 (single 32-bit state, shorter period).

### D-102 Gaussian samples use Box–Muller with no cached spare

- **Decision:** Every `nextGaussian()` consumes exactly two uniforms.
- **Reason:** With no cached spare, the RNG state is fully described by its four
  words, so save/restore determinism is trivial and cannot depend on whether an
  odd number of Gaussian draws happened.
- **Alternative:** Cache the second Box–Muller value (fewer draws, but the spare
  would have to be serialised as part of the state).

### D-103 Trait mutation is log-normal (multiplicative)

- **Decision:** `trait = clamp(trait * exp(Normal(0, strength)))`.
- **Reason:** Spec says traits mutate multiplicatively; `exp()` keeps traits
  strictly positive regardless of draw size (a plain `1 + g` can go negative),
  and clamps cleanly.
- **Alternative:** `trait * (1 + Normal(0, strength))` then clamp.

### D-104 Founder prior applies identically to all founders

- **Decision:** Weights `~ Normal(0, 1/sqrt(fan-in))` per layer; hidden biases
  `|Normal(0, 0.05)|`; thrust output bias `+0.75` (`tanh ≈ 0.635`), turn and
  reproduce biases `0`.
- **Reason:** Spec requires the same prior for every founder and a positive
  thrust bias so random creators move instead of freezing. A positive hidden
  bias keeps hidden units out of the dead zone for small inputs.
- **Alternative:** Zero hidden biases (more founders would freeze at low input
  magnitudes).

### D-105 Metabolic cost uses GLOBAL baselines as denominators

- **Decision:** Per-tick cost uses `(speed / baseMaxSpeed)²` and
  `(visionRange / baseVisionRange)`, i.e. the *global* config baselines, not the
  creature's own `maxSpeed`.
- **Reason:** The spec's literal `(speed / maxSpeed)²` would make a fast creature
  at full throttle pay exactly the same as a slow one — so `maxSpeed` would carry
  no cost and evolution would peg it at the maximum. The spec also says the
  global "speed"/"vision range" controls are *the baselines traits vary around*,
  which only makes sense if costs are measured against those baselines. This
  keeps every beneficial trait metabolically expensive.
- **Alternative:** Literal `(speed / maxSpeed)²` (rejected: removes the cost of
  the speed trait).
- **Full implementation lands in Stage 2 (`engine/energy.ts`); recorded here so
  the formula is not silently changed later.**

## Stage 2 — headless engine

### D-201 Tick pipeline order

- **Decision:** per creature, in ascending id order: age/cooldown → sense →
  think (forward pass) → steer → move + collide → eat → pay metabolic cost →
  die **or** reproduce. Food regeneration runs at the end of the tick, then
  eaten food and dead creatures are compacted out and the RNG state is written
  back.
- **Reason:** Sensing before moving gives the "previous speed" sensor a
  well-defined meaning. Dying before reproducing (rather than the reverse)
  guarantees dead creatures can never reproduce. Paying cost before the
  reproduction check means reproduction uses post-cost energy, which is what
  the threshold is meant to gate.
- **Alternative:** move-then-sense (less intuitive), or reproduce-before-death
  (lets a creature that starved this tick still spawn — rejected).

### D-202 Food is marked `eaten`, then compacted; contested food goes to the lowest creature id

- **Decision:** Eating sets a per-item `eaten` flag; items are removed by an
  in-place compaction at tick end. When several creatures reach the same item
  in one tick, the first processed wins — and creatures are always processed in
  ascending id order, so the winner is the lowest creature id.
- **Reason:** The spec requires each item to be removed exactly once and a
  deterministic winner. Compacting at the end keeps food array indices stable
  for the whole tick (the food grid stores those indices).
- **Alternative:** remove immediately (shifts indices mid-tick → grid desync).

### D-203 Creatures collide with walls and obstacles, not with each other

- **Decision:** Wall/obstacle collisions are resolved by pushing the creature
  back onto the surface and zeroing its speed (no tunnelling). Creature-creature
  overlap is allowed.
- **Reason:** The spec only requires wall/obstacle collision. Speed-zeroing is a
  simple, stable anti-tunnelling rule (per-tick displacement is bounded by
  `maxSpeed`, which is small relative to obstacle sizes). Creature-creature
  collision would add O(n²)-ish contact resolution for little scientific value
  at this scale.
- **Alternative:** elastic creature-creature collisions (deferred).

### D-204 Reproduction mutation probability is the heritable `mutationRate` trait

- **Decision:** A child's genome mutates each parameter with probability equal
  to the **parent's `mutationRate` trait** (founders draw it around
  `config.mutationProbability`), by `Gaussian(0, config.mutationStrength)`.
  Traits mutate log-normally by `config.traitMutationStrength` and are clamped.
- **Reason:** The spec lists `mutationRate` as a heritable trait, so it must
  actually drive mutation or it is decoration. `config.mutationProbability` then
  sets the founder baseline. Because the Gaussian std is what changes parameters,
  a "mutation off" control is exactly `mutationStrength = 0` **and**
  `traitMutationStrength = 0` (the probability becomes irrelevant when the step
  is zero), which the calibration script uses.
- **Alternative:** always use `config.mutationProbability` (makes the trait inert).

### D-205 Perception limited to vision range; omnidirectional; 0 when nothing is visible

- **Decision:** All sensing uses an omnidirectional radius equal to the
  creature's `visionRange`. If no food is visible, inputs 1–3 are 0; if no
  obstacle or wall is within vision, inputs 4–5 are 0. Input 6 (previous speed)
  is normalised by the creature's own `maxSpeed`.
- **Reason:** The spec requires bounded inputs and perception limited to vision
  range; field-of-view is explicitly a future extension. Returning 0 (rather
  than a huge proximity) when nothing is in range keeps inputs bounded and
  consistent.
- **Alternative:** field-of-view cone (future work).

### D-206 Metrics sampling never touches the world RNG

- **Decision:** Genome dispersion is sampled with a **separate** `metricsRng`
  held in the runtime (seeded from the world seed), never the world RNG.
- **Reason:** Statistics must be observable without perturbing the deterministic
  simulation. Sampling 50 creatures from up to 400 uses a partial Fisher–Yates
  shuffle.
- **Alternative:** reuse the world RNG (would make metrics calls change the run).

### D-207 Lifetime statistics are recorded exactly at death

- **Decision:** The world keeps `lifetimeFoodByGeneration`,
  `lifetimeCountByGeneration` and `lifetimeAgeByGeneration`, updated once per
  death (starvation or max lifespan).
- **Reason:** The spec asks for "mean food eaten per creature *lifetime* by
  generation bucket". A living creature's total is only a partial lifetime, so a
  survivor-biased estimate would be wrong. These arrays are part of the saved
  state and the state hash (so restore determinism stays exact).
- **Alternative:** sample living creatures' running totals (survivor-biased).

### D-208 Calibration finding (honest)

- **Result (default config, 10 seeds × 20 000 ticks):** extinction 0/10;
  time pinned at the cap 0.7 %; mean population 232; mean max generation 25.7;
  mean cumulative births 2342. **Both stated targets are met.**
- **Evolution check:** the spec's "later-generation food-intake efficiency
  exceeds early-generation" holds only **weakly / not clearly**. Using the
  exact per-completed-lifetime intake **rate** (food per 1000 ticks of life):
  mutation-on 2.80 → 2.03, mutation-off 2.78 → 2.28 across generation buckets.
  The rate *declines* with generation in both, because the world is
  food-limited: population grows toward carrying capacity, total food income is
  fixed by regeneration, so per-capita intake falls as density rises. This is a
  density effect, not a failure of selection.
- **Supporting evidence that selection is acting:** mutation-on sustains a
  higher mean population (232 vs 199), more cumulative births (2342 vs 2011),
  fewer extinctions (0 vs 1) and a higher final speed trait (1.58 vs 1.32) than
  the mutation-off control, while both lower the metabolic multiplier
  (0.75 vs 0.79). Founder traits alone (mutation-off) already shift under
  selection, so standing variation responds too.
- **Tuning attempted (legitimate only, never reward shaping):**
  - lower mutation (`mutationProbability` 0.01, `mutationStrength` 0.1) → worse
    (intake rate 2.74 → 2.03);
  - tighter/fewer food clusters + higher `visionCost` (4 clusters, radius 70,
    15 % background, `visionCost` 0.035) → mutation-on declines less than the
    control (rate Δ −0.54 vs −1.09) and keeps higher vision (120 vs 113) and
    lower metabolic cost (0.834 vs 0.914), but does not produce a rising rate.
- **Decision:** keep the default config (survival and cap targets are met).
  Report the intake-efficiency result as **not clearly demonstrated**, and treat
  population/births/trait composition as the adaptation evidence. A future,
  fairer efficiency probe would measure *time-to-first-meal* or intake rate at
  controlled density.
- **Alternative considered:** raise regeneration / lower population to make food
  non-limiting (would show higher intake but remove most selective pressure —
  rejected as it would not test adaptation).


## Stage 3 — worker + renderer

### D-301 Worker owns state; ack-gated pooled transferable snapshots

- **Decision:** The worker is the single authority over `WorldState` +
  `WorldRuntime`. It posts snapshots as a pooled `Float32Array` (+ a parallel
  `Int32Array` of creature ids) transferred to the client. The client returns
  each buffer pair with `SNAPSHOT_ACK`. There are exactly 2 buffers; when the
  pool is empty the worker **skips** the frame instead of queueing it.
- **Reason:** True zero-copy transfer with bounded memory and real
  backpressure: a slow/hidden client drops frames rather than growing an
  unbounded message queue. The first snapshot cannot deadlock because a second
  buffer is always available to send before the first ACK returns.
- **Alternative:** copy the snapshot (no transfer) — simpler but allocates and
  copies every frame; an unbounded queue — a stalled tab would exhaust memory.

### D-302 Snapshot stride 6 + a separate id array

- **Decision:** Creature block is 6 floats (`x, y, heading, energy, flags,
  colorValue`), followed by `foodCount*2` food coordinates. Creature **ids**
  travel in a parallel `Int32Array` (same index), not in the float block.
- **Reason:** Click-to-select needs the id of the creature under the cursor, and
  the spec fixes the creature stride at 6 — an id does not fit without another
  float. A parallel typed array keeps the documented stride and makes hit-test →
  `INSPECT_CREATURE` exact (no id guessing).
- **Alternative:** stride 7 (breaks the documented contract); encode the id in
  the flags float (loses bit-packing headroom and invites precision bugs).

### D-303 `colorValue` is raw; the renderer normalises

- **Decision:** Slot 5 carries the **raw** value for the active colour mode
  (energy / generation / speed trait). The renderer normalises it (`/maxEnergy`,
  `/maxGeneration`, or over `TRAIT_RANGES.maxSpeed`).
- **Reason:** Keeps one authoritative value in the wire format and one place
  (the renderer) that knows how to map values to colours; changing a ramp never
  touches the protocol.
- **Alternative:** send a pre-normalised `[0,1]` colour factor (hides the real
  value, e.g. the inspector/labels could not show energy).

### D-304 Commands are applied in `onmessage` (tick boundary by construction)

- **Decision:** Worker commands are parsed and applied directly in the message
  handler; the tick loop is only entered from its own `setTimeout` callback.
- **Reason:** JS runs one task at a time, so a message handler can never
  interleave with a tick — every command lands exactly on a tick boundary with
  no queue or locking. This is what makes the "commands applied at tick
  boundaries" requirement structural rather than best-effort.
- **Alternative:** a command queue drained inside the loop (equivalent, but adds
  a second place where sequencing can go wrong).

### D-305 Speed is wall-clock pacing, not part of the deterministic state

- **Decision:** `SET_SPEED` scales ticks-per-second via an accumulator
  (`TICKS_PER_SECOND * speed`, clamped to `MAX_TICKS_PER_FRAME` with a
  `FRAME_BUDGET_MS` deadline). The number of ticks run per animation frame
  varies with device speed.
- **Reason:** Determinism is defined per tick, not per frame: state after N
  ticks is identical regardless of how many frames it took. Pacing must adapt
  to the device or the UI would stall. Command timing is captured in the
  command log alongside the tick it was applied at.
- **Alternative:** fixed ticks per frame (ties simulation speed to refresh rate
  and to device performance).

### D-306 Snapshots never enter React state

- **Decision:** The latest snapshot lives in a `useRef`; the canvas reads it from
  a `requestAnimationFrame` loop. Only low-frequency data (status, stats,
  inspection) goes through `useState`.
- **Reason:** At ~30 snapshots/s, copying each into state would re-render the
  whole tree 30×/s for no benefit. The canvas is the only consumer and it
  repaints every frame anyway.
- **Alternative:** snapshot in state + a memoised canvas (still re-renders the
  tree; wastes the frame budget the simulation needs).

### D-307 Selected-creature overlays are rendered from real sensor data

- **Decision:** Sensor overlay lines are drawn from the selected creature's
  **last real input vector** (proximity 1..0 → distance, bearing → angle) and
  its `visionRange` trait. Nothing is drawn unless the corresponding sensor
  reported a detection this tick.
- **Reason:** The overlay must show what the creature actually perceived, not a
  plausible-looking reconstruction. Proximity is defined as `1 - d/range`, so
  inverting it reproduces the true sensed distance.
- **Alternative:** ray-cast from the creature for display (would show geometry
  the creature's sensors did not report — i.e. lie).

### D-308 Local worker-scope typing (no `WebWorker` lib)

- **Decision:** The worker declares a minimal `WorkerScope` interface and casts
  `self`, instead of adding `"WebWorker"` to `tsconfig.lib`.
- **Reason:** `lib: ["DOM", "WebWorker"]` makes `self` a duplicate-identifier
  error. The worker uses only `postMessage`/`onmessage`, so a 4-line local
  interface is enough and keeps one flat `tsconfig.json` (D-002).
- **Alternative:** separate tsconfig for the worker; `@ts-expect-error` casts.

### D-309 Reset is a two-step armed button, not `window.confirm`

- **Decision:** The destructive Reset button arms on first click ("Confirm
  reset", auto-disarms after 4 s) and only resets on the second click.
- **Reason:** Satisfies "confirmation only for destructive reset" without a
  blocking native dialog, and the armed state is visible and reversible.
- **Alternative:** `window.confirm` (blocks the thread, unstyled, awkward to
  test); an alert-dialog primitive (heavier than the interaction warrants here).

### D-310 Initial `pixelsPaused` rendering note

- **Decision:** No change; recorded as an observation.
- **Reason:** During browser QA the canvas sampled as empty in the first frame
  after load (before the first snapshot/rAF commit) and fully populated once
  running (~43 000 non-background pixels). This is expected ordering, not a bug.

## Stage 4 — interface

### D-401 Remaining stages reconstructed from evidence

- **Decision:** The original stage-by-stage build text is not on disk, so the
  remaining scope was reconstructed from the decision log, the Stage 3 report
  and the installed-but-unused dependencies, then fixed as: **Stage 4 Interface**
  (this stage), **Stage 5 Experiments**, **Stage 6 Persistence**, **Stage 7
  Polish & documentation**. This is recorded as a reconstruction rather than
  quoted as the original plan.
- **Reason:** Continuing truthfully requires saying which parts are recovered
  fact and which are reconstruction. The reconstruction was cross-checked
  against concrete evidence: every dependency installed in Stage 0 (Recharts,
  `idb`, Radix, `lucide-react`, cva, clsx, tailwind-merge) is now consumed, and
  no dependency was added.
- **Alternative:** invent plausible-sounding stage titles with no evidence
  (would misrepresent the recovered plan).

### D-402 Two-level tabbed shell (main views vs the instrument rail)

- **Decision:** A main tab row switches the **central** view (World, then
  Statistics, then Experiments); a separate tab row in the right rail switches
  Environment / Inspector / View. The rail stays mounted across main tabs; the
  canvas unmounts when the World tab is inactive and remounts on return (the
  camera is preserved because fit is one-shot).
- **Reason:** Charts and the live world compete for the same area, so they are
  peer views, while the environment editor and inspector are *controls* that
  should remain reachable regardless of which view is showing. Unmounting the
  idle canvas frees its rAF loop.
- **Alternative:** one flat tab set for everything (loses the control/peer
  distinction); always-mounted canvas hidden with CSS (keeps a wasted rAF loop
  running under the charts).

### D-403 Adopt the installed Radix primitives instead of hand-rolled widgets

- **Decision:** Build the UI on the Radix primitives already in `package.json`
  (`react-tabs`, `react-switch`, `react-slider`, `react-select`,
  `react-tooltip`, `react-separator`, `react-label`, `react-collapsible`,
  `react-alert-dialog`), the shadcn way: `lib/cn.ts` is `clsx` +
  `tailwind-merge`, and `Button`/`Badge` are `class-variance-authority`
  variants. The Stage 3 hand-rolled `ui/Toggle.tsx` is deleted in favour of
  Radix Switch.
- **Reason:** These dependencies were pinned in D-001 for exactly this purpose;
  hand-rolling equivalents would leave the declared stack unused and re-implement
  focus management, roving tabindex and dismiss behaviour that Radix supplies.
  Client-side tooltips (not `title=`) are used for the explanations the UI needs.
- **Alternative:** keep hand-rolled buttons/sliders (works, but ignores the
  pinned stack and re-solves accessibility by hand, worse).

### D-404 Destructive reset confirmation uses an AlertDialog (supersedes D-309)

- **Decision:** Reset opens a Radix `AlertDialog` ("Reset the world?"). The
  Stage 3 two-step armed button (D-309) is **removed**. Reset is also the action
  behind Environment's "Apply & reset"; that path validates the draft first and
  is disabled when the draft is invalid, so it cannot be reached accidentally.
- **Reason:** D-309 chose an armed button to avoid the weight of a dialog, but
  the primitive is already installed for other confirmations and a modal gives a
  correct focus trap, Escape-to-cancel and an explicit Cancel affordance for an
  irreversible action. The superseded decision is kept above, not deleted.
- **Alternative:** keep arming (a stray second click still destroys the run).

### D-405 Environment panel is a complete `SimConfig` editor, drafted

- **Decision:** Every numeric `SimConfig` field (plus `seed`) is editable, each
  labelled **live** (pushed to the running world, debounced by 120 ms) or
  **reset** (kept in a local draft until "Apply & reset"). Incoming config from
  the worker refreshes **only live fields**, so a pending reset edit is never
  silently overwritten. Cross-field validation (e.g. population cap ≥ founders)
  is shown inline and blocks "Apply & reset" and the offending live push.
- **Reason:** "Live vs reset" must be visible per field, and the two kinds must
  not fight: the worker owns live truth, the user owns unapplied reset edits.
  Coalescing live pushes keeps a slider drag from flooding the worker (each
  `SET_ENVIRONMENT` re-posts a snapshot).
- **Alternative:** apply every edit only on reset (no live exploration);
  two-way bind straight to worker config (a pending reset edit is lost on the
  next status echo).

### D-406 Analysis views are code-split

- **Decision:** The Statistics view is loaded with `React.lazy` + `Suspense`.
  (Experiments joins it in Stage 5.)
- **Reason:** Recharts is ~390 kB raw / 114 kB gzip. Splitting keeps the initial
  World payload at ~429 kB raw / 138 kB gzip instead of ~820 kB, and Vite's
  own build output flagged the single-chunk size. The world view is what loads
  first and is the thing that must feel instant.
- **Alternative:** ship one bundle (nearly doubles first-load bytes for a view
  most sessions never open).

### D-407 `MetricsPayload` gained exact completed-lifetime buckets

- **Decision:** `collectMetrics` now also returns
  `lifetimeByGeneration: GenerationBucket[]` — mean food eaten and mean lifespan
  over **creatures that have already died**, bucketed by generation
  (`GENERATION_BUCKET_SIZE = 5`). The `GenerationBucket` type moved to `types.ts`
  and the old `collectors.ts` interface became an alias.
- **Reason:** The lifetime chart is only honest if it plots real completed
  lifetimes; the worker already maintained the per-generation lifetime tables
  (Stage 2), and the UI has no `WorldState` to compute them from. The metrics
  RNG is untouched, so determinism and the exact stat samples are unchanged.
- **Alternative:** reconstruct lifetimes from `statsHistory` (an estimate, not
  the exact tables, and it would conflate the living with the dead).

### D-408 Scenario presets are pure config patches and never set the seed

- **Decision:** `src/simulation/presets.ts` exposes six named presets
  (Default, Scarce, Abundant, Crowded, High mutation, Fast generations) as
  `Partial<SimConfig>` patches that deliberately omit `seed`, so applying a
  preset keeps the current seed and stays comparable with the previous run.
- **Reason:** A "laboratory" is only useful if you can change one thing and
  compare; silently changing the seed would make two preset runs
  incomparable. Presets are pure data (engine-side, no DOM) so they can be
  tested and reused by experiment records later.
- **Alternative:** presets as full configs including a seed (destroys
  comparability); presets in the component (not reusable/testable).

### D-409 Sliders only where the full valid range is small

- **Decision:** Only five fields get a slider in addition to the numeric input
  (`mutationProbability`, `foodBackgroundFraction`, `maxTurnRate`,
  `baseMaxSpeed`, `creatureRadius`). Everything else uses the numeric input
  alone.
- **Reason:** A slider is a precision instrument only when its range is
  meaningful; spanning `maxLifespan` up to 10⁶ would make every useful value
  land in the first pixel. The numeric input always accepts the full validated
  range, so no field is less editable for lacking a slider.
- **Alternative:** a slider on every field (unusable on wide-range values);
  no sliders anywhere (less tactile for the continuous 0..1 parameters).

## Stage 5 — experiments

### D-501 A recorded run is an immutable snapshot of the real sample series

- **Decision:** `ExperimentRecord` stores a **copy** of the exact `StatsSample`
  series (every 30 ticks), the full `SimConfig` and the seed at capture, plus a
  derived `ExperimentSummary`. Capturing never interrupts the running world, and
  later ticks cannot mutate a record (the history is deep-copied).
- **Reason:** A comparison is only meaningful if a run is frozen. Storing a
  reference into the live `statsHistory` would make yesterday's record silently
  change as the simulation runs.
- **Alternative:** store only the summary (loses the curve that makes the
  comparison worth showing); store a live reference (records mutate).

### D-502 Runs are aligned by tick, which is exact under the fixed cadence

- **Decision:** `buildComparison` merges runs into rows keyed by **tick**
  (downsampled to ≤500 points, first and last always kept). Runs that ended
  earlier simply have no value after their last tick, and the chart connects
  across the gap (`connectNulls`).
- **Reason:** Stats are emitted on a fixed 30-tick cadence from tick 0, so two
  runs of the same cadence align *exactly* by tick — no resampling or
  interpolation is needed, and none is done. Aligning by sample index would
  silently scale a short run to look as long as a long one.
- **Alternative:** align by index (misleading); resample onto a common grid
  (invents data between real samples).

### D-503 The library is session-scoped now, persistent in Stage 6

- **Decision:** `useExperiments` owns the list in React state and exposes an
  `onChange` callback plus `replaceAll`. Stage 5 uses it purely in memory;
  Stage 6 points `onChange`/`initial` at IndexedDB without the view changing.
- **Reason:** Keeps the stage boundary honest (this stage delivers capture +
  comparison, not durability) while making persistence a wiring change rather
  than a rewrite. A `Clear library` confirmation guards the unauthored loss.
- **Alternative:** build persistence first (couples Stage 5 to `idb` before the
  data model is proven).

### D-504 Imported records are validated and their summary is recomputed

- **Decision:** `parseExperimentRecord` checks the schema version, id, name,
  timestamps, tick count, the full config (via the engine's `validateConfig`)
  and every sample (all 11 numeric fields finite), then **recomputes** the
  summary from the history instead of trusting the stored one. It returns
  `null` rather than throwing.
- **Reason:** Persisted or imported data is untrusted input. A stored summary
  can drift from the history if the derivation ever changes, so the derived
  value is always regenerated — the history is the single source of truth.
- **Alternative:** trust the stored summary (a stale or hand-edited summary
  would silently mislead); throw on bad input (one corrupt record would break
  loading the whole library).

### D-505 The live run is a virtual record and is never stored

- **Decision:** The current run is exposed to the Experiments view as a
  `liveRecord` built with the same `createExperiment` function, with
  `createdAt: 0` and id `"live"`. It is offered as a comparison line ("Live run
  (current)") but is never added to the library.
- **Reason:** Comparing a fresh run against saved ones is the main reason to
  open this tab, and reusing the exact same builder guarantees the live line is
  computed identically to a captured one. Keeping it out of the library avoids
  a record that mutates under the user.
- **Alternative:** no live line (must capture before you can see anything);
  auto-capture on every stats event (spams the library).

### D-506 Comparison colours are assigned per run, not per series order

- **Decision:** A run's chart colour is derived from its index in the library
  (`SERIES_PALETTE[(index + 1) % n]`), and the live run always takes
  `SERIES_PALETTE[0]`. Toggling a run or changing the metric never reassigns
  the other colours.
- **Reason:** If colour tracked position in the *selected* list, deselecting one
  run would recolour every other line, destroying the visual continuity the
  comparison depends on.
- **Alternative:** colour by selection order (lines change colour as you
  toggle others — actively confusing).

## Stage 6 — persistence

### D-601 Save slots are split across two object stores, written atomically

- **Decision:** `saveMeta` holds the small listable header (id, name,
  createdAt, tick, population, seed, sample count); `saveData` holds the bulky
  `SerializedWorld` plus the statistics series. Saving and deleting touch both
  stores inside one `readwrite` transaction; listing reads only `saveMeta`.
- **Reason:** IndexedDB has no partial read — listing slots from a single store
  would deserialize every creature of every save just to render a table row.
  Keeping the header apart makes the list cheap and costs only a second store
  and a multi-store transaction.
- **Alternative:** one store and `getAll` then project (simple, but every list
  read pays for the full world blobs); a cached in-memory index (loses sync
  with the database).

### D-602 A snapshot stores the statistics series as well as the world

- **Decision:** A slot stores `SerializedWorld` plus the client's
  `StatsSample[]`. Loading restores the world (`restoreState`) and installs the
  history via a new `replaceHistory` on `useSimulation`. `latestStats` is
  cleared rather than reconstructed.
- **Reason:** `WorldState` has no statistics history — it is a client-side
  series. Restoring only the world would resume the creatures but silently
  discard the run's history, so the Statistics tab would restart from empty and
  a loaded run would be incomparable with the one that was saved. The
  `MetricsPayload` histograms and lifetime buckets genuinely cannot be rebuilt
  from a `StatsSample`, so `latestStats` is left null (repopulated by the next
  stats tick) instead of fabricating a payload.
- **Alternative:** save only the world (`latestStats`/charts restart, history
  lost); recompute summary histograms from samples (they are per-bucket
  distributions the samples do not carry — inventing them would be dishonest).

### D-603 The autosave is a reserved slot and must refresh the UI after writing

- **Decision:** The rolling autosave is written to the reserved id `autosave`,
  filtered out of the manual list, shown in its own panel, and overwritten in
  place. After each autosave write the hook calls `refresh()` so the panel's
  badge and the Restore button reflect the new slot immediately.
- **Reason:** The first implementation wrote the slot but never refreshed React
  state, so the panel kept reporting "empty" and Restore stayed disabled even
  though a valid autosave existed on disk. Found by browser QA (a 34-second run
  produced a populated database with an empty-looking panel). Distinguishing
  the autosave from manual slots is what makes it safe to overwrite it
  silently.
- **Alternative:** list the autosave with manual saves (a user could mistake a
  rolling slot for a deliberate checkpoint); skip the refresh (the bug above).

### D-604 Imported data is validated with the engine's own reader first

- **Decision:** Imported worlds are parsed with `serializedWorldFromJson` and
  then run through the engine's `deserializeWorld` *on the client* before being
  sent to the worker; imported experiment records go through
  `parseExperimentRecord`. Failures produce a message in the panel.
- **Reason:** The worker is a separate failure domain: sending it a mismatched
  save would surface as a generic engine error banner after the fact. Validating
  client-side turns it into a specific, actionable message ("Unsupported save
  schema …") and keeps the worker's error channel for engine faults.
- **Alternative:** let the worker validate (works, but the error arrives as a
  crash-style banner with no filename context).

### D-605 An autosave failure is reported, not swallowed

- **Decision:** Autosave write failures set the persistence `error` state,
  shown as a notice in the Current run panel. They never touch the engine error
  banner and never interrupt the run.
- **Reason:** The first implementation swallowed autosave errors with an empty
  `catch`, which is exactly why the missing-refresh bug was invisible. A failed
  autosave is not fatal, but it must be visible.
- **Alternative:** rethrow into the engine error banner (mislabels a storage
  problem as an engine fault).

### D-606 A reload does not auto-restore the autosave

- **Decision:** After a reload the world starts fresh at tick 0; restoring the
  autosave is an explicit button press.
- **Reason:** Silently resuming someone else's last run on page load is
  surprising and would make "what am I looking at?" ambiguous. The autosave is
  offered prominently instead, and manual slots are never overwritten by it.
- **Alternative:** auto-restore on boot (surprising, and hides the fresh-start
  default that every other control assumes).

### D-607 One JSON implementation for worlds, shared by both entry points

- **Decision:** `serializedWorldToJson`/`serializedWorldFromJson` were extracted
  as the single implementation, and the older `worldToJson`/`worldFromJson`
  (which take a `WorldState`) now delegate to them. The UI — which only ever
  holds a `SerializedWorld` from the worker — needed the `SerializedWorld`
  variants.
- **Reason:** The UI never has a `WorldState` (that lives in the worker), so
  without this it would have needed a second, divergent copy of the
  genome/base64 marshalling. Two implementations of a binary format is how
  round-trip bugs get introduced. A test asserts both paths are lossless.
- **Alternative:** duplicate the base64 genome marshalling in `src/storage`
  (two formats to keep in sync).

### D-608 Storage is optional and the app degrades instead of failing

- **Decision:** `isPersistenceSupported()` gates every database call; when
  IndexedDB is unavailable the Saves tab explains the situation and still offers
  JSON/CSV export, and the experiment library works session-scoped.
- **Reason:** IndexedDB is absent in some embedded/private contexts, and a
  feature that throws on import would take the whole app down with it. Refs and
  `ready` flags are derived so an unsupported environment reports `ready`
  immediately rather than hanging on a load that will never happen.
- **Alternative:** assume IndexedDB always exists (the app breaks in those
  contexts).

### D-609 Testing note: `innerText` does not contain `<input>` values

- **Decision:** Browser checks that assert on a **record name** must read the
  input's `value` (e.g. `getByLabel(...).inputValue()`), because editable names
  live in `<input>` elements which contribute nothing to `innerText`.
- **Reason:** Two QA runs produced false negatives from this: the experiment
  library looked like it was not persisting across a reload (the row and the
  "1 runs" badge were both correct in the DOM and in IndexedDB), and an earlier
  Stage 5 rename result was reported from truncated output without ever being
  read. Direct inspection of the database (`rows: 1`, valid record, no error)
  is what finally separated the test's fault from the app's.
- **Alternative:** keep asserting on `innerText` (silently wrong for every
  editable field).

## Stage 7 — polish and documentation

### D-701 The keyboard focus ring was being explicitly removed

- **Decision:** Removed `focus-visible:outline-none` from `Button` and from the
  slider thumb. The stylesheet defines a single global
  `*:focus-visible { outline: 2px solid accent; outline-offset: 1px; }`, and
  those two utilities (specificity 0,2,0) were overriding it (0,1,0) — so every
  button and the sliders had **no visible keyboard focus at all**.
- **Reason:** An invisible focus indicator makes the entire app unusable by
  keyboard. The global rule already existed and was correct; the components were
  quietly defeating it. Deleting the override is the minimal fix and makes focus
  styling consistent everywhere.
- **Alternative:** add per-component `ring` utilities (duplicates the global
  rule, and would drift).

### D-702 The simulation canvas is labelled and keyboard-operable

- **Decision:** The canvas is `role="application"` with
  `aria-roledescription="simulation viewport"`, an `aria-label` naming the keys,
  `tabIndex={0}`, and a key handler: arrows pan (scrolling convention), `+`/`-`
  zoom about the centre, `F` fits, `Escape` clears the selection. Unhandled keys
  fall through to the app shortcuts (`Space`, `1`–`4`).
- **Reason:** The world view was pointer-only: panning, zooming and selecting a
  creature all required a mouse, so a keyboard user could not use the primary
  view. `role="application"` is used deliberately — under a screen reader's
  browse mode the arrow keys would otherwise be consumed for navigation and the
  pan keys would never reach the canvas.
- **Alternative:** `role="img"` with a label only (describes the canvas but
  leaves it unusable without a pointer); exposing pan/zoom only through the
  sidebar buttons (does not help select or inspect a creature).

### D-703 Faint text was darkened to meet WCAG AA

- **Decision:** `--color-ink-faint` changed from `#5a6a80` to `#7b8ca6`.
- **Reason:** Faint text is used for 9–10 px uppercase labels. The old value
  measured ≈ 3.35:1 against `surface` and ≈ 2.8:1 against `surface-3`, both below
  the 4.5:1 AA threshold for small text. The new value measures ≈ 5.4:1 and
  ≈ 4.8:1 respectively while remaining clearly dimmer than `ink-dim` (≈ 6.9:1),
  so the visual hierarchy is preserved.
- **Alternative:** leave it (fails AA on the app's most common label style).

### D-704 Known limitation: subtle borders are below 3:1

- **Decision:** Recorded, not "fixed". `--color-line` (`#1e2a3d`) is ≈ 1.2:1 and
  `--color-line-strong` (`#2c3b52`) is ≈ 9.2:1 against `surface-2`. Only the
  strong variant is used where a border is the *sole* indicator of a control's
  extent (e.g. focused inputs).
- **Reason:** WCAG 1.4.11 asks for 3:1 on meaningful UI boundaries. Raising every
  hairline would flatten the "scientific instrument" look the design is built
  on, and most of these borders are decorative separators between panels, not
  controls. Form fields do communicate their extent through background contrast
  and the accent focus border. This is an honest, known limitation rather than a
  silent one.
- **Alternative:** brighten every divider (a large visual change for a marginal
  gain on decorative lines).

### D-705 The page title is a real heading

- **Decision:** The "EMERGENT — Artificial Life Laboratory" lockup in the top bar
  is an `<h1>` (the wordmark and the subtitle are one heading), not two `<span>`s.
- **Reason:** The document had no heading at all, so screen-reader users had no
  page-level landmark to navigate to. `<h1>` costs nothing visually here.
- **Alternative:** leave the spans (no page structure for assistive tech).

### D-706 The Saves tab was split into one file per card

- **Decision:** `StoragePanel` (which had grown to 412 lines) was split into
  `StoragePanel` (the Saves-tab composer + the "Current run" and "Storage"
  cards, 170 lines), `SaveSlotTable`, `AutosavePanel`, `ImportExportPanel` and a
  shared `Notice`. Each card owns its own handlers and notice state.
- **Reason:** The project convention is files of ≲300 lines with one clear
  responsibility; every other component already obeys it. The import/export card
  previously reported a failed *world* import into the "Current run" card, which
  put the message in a different card from the button that produced it; owning
  the notice per card fixes that as a side effect.
- **Alternative:** leave the monolith (one 412-line file, and a notice that
  appears somewhere other than where the user clicked).
