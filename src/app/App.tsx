import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { MainNav, type MainTab } from "@/components/layout/MainNav";
import { Sidebar, type SidebarTab } from "@/components/layout/Sidebar";
import { TransportControls } from "@/components/controls/TransportControls";
import { SimulationCanvas } from "@/components/canvas/SimulationCanvas";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { useSimulation } from "@/hooks/useSimulation";
import { useCanvasCamera } from "@/hooks/useCanvasCamera";
import { useEnvironmentDraft } from "@/hooks/useEnvironmentDraft";
import { usePersistence } from "@/hooks/usePersistence";
import { useExperimentLibrary } from "@/hooks/useExperimentLibrary";
import { createExperiment } from "@/simulation/experiments/record";
import { DEFAULT_CONFIG } from "@/simulation/config";
import { cn } from "@/lib/cn";
import type { ViewOptions } from "@/simulation/renderer/draw";
import type { Preset } from "@/simulation/presets";

/**
 * Width at and above which the control rail sits permanently beside the world
 * instead of collapsing into a toggled overlay drawer. Mirrors the `lg`
 * breakpoint so the media query and the CSS classes never disagree.
 */
const RAIL_QUERY = "(min-width: 1024px)";

/** Charts (Recharts) load on demand so the world view stays small. */
const StatisticsView = lazy(() =>
  import("@/components/charts/StatisticsView").then((module) => ({
    default: module.StatisticsView,
  })),
);

const ExperimentsView = lazy(() =>
  import("@/components/experiments/ExperimentsView").then((module) => ({
    default: module.ExperimentsView,
  })),
);

const StoragePanel = lazy(() =>
  import("@/components/persistence/StoragePanel").then((module) => ({
    default: module.StoragePanel,
  })),
);

/** Fallback shown while a lazy analysis view loads. */
function ViewFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[11px] text-ink-faint">
      Loading {label}…
    </div>
  );
}

/** Minimum samples before the live run is worth recording or plotting. */
const MIN_LIVE_SAMPLES = 2;

const INITIAL_VIEW: ViewOptions = {
  showFood: true,
  showObstacles: true,
  showSensorLines: true,
  showVisionCircle: true,
  showLabels: false,
};

/**
 * Application shell. Wires the worker (useSimulation), the camera, the
 * environment draft and the canvas together, and hosts the tabbed analysis
 * views. Snapshots stay in a ref (D-306); only status/stats/inspection re-render.
 */
export function App() {
  const sim = useSimulation(DEFAULT_CONFIG);
  const camera = useCanvasCamera();
  const env = useEnvironmentDraft(sim);
  const library = useExperimentLibrary();
  const persistence = usePersistence(sim);

  const [view, setView] = useState<ViewOptions>(INITIAL_VIEW);
  const [mainTab, setMainTab] = useState<MainTab>("world");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("environment");

  // Narrow layouts collapse the control rail into an overlay drawer; wide ones
  // keep it permanently beside the world. The two states share one component.
  const [railOpen, setRailOpen] = useState(false);
  const [wideRail, setWideRail] = useState(() => window.matchMedia(RAIL_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(RAIL_QUERY);
    const onChange = (): void => {
      setWideRail(query.matches);
      // Leaving the narrow layout restores the permanent rail, so drop the drawer.
      if (query.matches) setRailOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  /**
   * Switching views also dismisses the overlay drawer, which otherwise covers
   * the very view the user just asked for.
   */
  const selectTab = useCallback((next: MainTab) => {
    setMainTab(next);
    setRailOpen(false);
  }, []);

  /**
   * The live run as a record, rebuilt whenever a new sample arrives. Existing
   * records are immutable snapshots; this one is only ever read (for the live
   * comparison line and to seed a capture), never stored.
   */
  const liveRecord = useMemo(
    () =>
      sim.statsHistory.length < MIN_LIVE_SAMPLES
        ? null
        : createExperiment({
            id: "live",
            name: "Live run (current)",
            createdAt: 0,
            config: sim.config,
            ticks: sim.tick,
            history: sim.statsHistory,
          }),
    [sim.statsHistory, sim.tick, sim.config],
  );

  const handleCapture = useCallback(
    (name: string) => {
      const record = createExperiment({
        id: library.makeId(),
        name,
        createdAt: Date.now(),
        config: sim.config,
        ticks: sim.tick,
        history: sim.statsHistory,
      });
      library.add(record);
      return record;
    },
    [library, sim.config, sim.tick, sim.statsHistory],
  );

  const patchView = useCallback((patch: Partial<ViewOptions>) => {
    setView((current) => ({ ...current, ...patch }));
  }, []);

  const handleSelect = useCallback(
    (id: number | null) => {
      sim.inspect(id);
    },
    [sim],
  );

  const handlePreset = useCallback(
    (preset: Preset) => {
      env.applyPreset(preset);
      setSidebarTab("environment");
    },
    [env],
  );

  // Keyboard shortcuts: space toggles run, Escape clears selection, F fits,
  // 1/2/3/4 switch between the World, Statistics, Experiments and Saves tabs.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target !== null &&
        (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA");
      if (typing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.code === "Space") {
        event.preventDefault();
        sim.toggleRun();
      } else if (event.key === "Escape") {
        setRailOpen(false);
        handleSelect(null);
      } else if (event.key.toLowerCase() === "f") {
        camera.fit();
      } else if (event.key === "1") {
        selectTab("world");
      } else if (event.key === "2") {
        selectTab("statistics");
      } else if (event.key === "3") {
        selectTab("experiments");
      } else if (event.key === "4") {
        selectTab("saves");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sim, camera, handleSelect, selectTab]);

  const stats = sim.latestStats?.sample;

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <TopBar
          status={sim.status}
          tick={sim.tick}
          population={sim.population}
          foodRemaining={stats?.foodRemaining ?? 0}
          maxGeneration={stats?.maxGeneration ?? 0}
          speed={sim.speed}
        />

        {sim.error !== null && (
          <div className="border-b border-danger/40 bg-danger/10 px-4 py-1.5 text-[11px] text-danger">
            Engine error: {sim.error}
          </div>
        )}

        <Tabs
          value={mainTab}
          onValueChange={(next) => selectTab(next as MainTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface pr-2 sm:pr-3">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <MainNav />
            </div>
            <span className="hidden shrink-0 text-[10px] text-ink-faint lg:inline">
              Space run/pause · pan: drag or arrows · zoom: scroll or ± · click a creature · 1-4 tabs
            </span>
            <button
              type="button"
              onClick={() => setRailOpen((open) => !open)}
              title="Control panels"
              aria-label="Toggle control panels"
              aria-expanded={railOpen}
              aria-controls="app-rail"
              className={cn(
                "flex h-7 shrink-0 items-center gap-1.5 border px-2 text-[11px] font-medium tracking-wide transition-colors lg:hidden",
                railOpen
                  ? "border-accent-dim bg-accent/15 text-accent"
                  : "border-line bg-surface-2 text-ink-dim hover:border-line-strong hover:text-ink",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Panels</span>
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            <main className="relative min-w-0 flex-1">
              <TabsContent value="world" className="h-full">
                <SimulationCanvas
                  snapshotRef={sim.snapshotRef}
                  obstacles={sim.obstacles}
                  worldWidth={sim.worldWidth}
                  worldHeight={sim.worldHeight}
                  creatureRadius={sim.config.creatureRadius}
                  maxEnergy={sim.config.maxEnergy}
                  camera={camera}
                  view={view}
                  inspection={sim.inspection}
                  onSelect={handleSelect}
                />
                {sim.status === "paused" && sim.tick === 0 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
                    <span className="border border-line-strong bg-surface/90 px-3 py-1 text-[11px] text-ink-dim">
                      Paused at tick 0 — press Start or Space to run
                    </span>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="statistics" className="h-full overflow-hidden">
                <Suspense fallback={<ViewFallback label="analysis" />}>
                  <StatisticsView
                    statsHistory={sim.statsHistory}
                    latestStats={sim.latestStats}
                    tick={sim.tick}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="experiments" className="h-full overflow-hidden">
                <Suspense fallback={<ViewFallback label="experiments" />}>
                  <ExperimentsView
                    experiments={library.experiments}
                    liveRecord={liveRecord}
                    onCapture={handleCapture}
                    onRemove={library.remove}
                    onRename={library.rename}
                    onClear={library.clear}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="saves" className="h-full overflow-hidden">
                <Suspense fallback={<ViewFallback label="storage" />}>
                  <StoragePanel sim={sim} persistence={persistence} library={library} />
                </Suspense>
              </TabsContent>
            </main>

            {railOpen && (
              <div
                className="fixed inset-0 z-30 bg-void/70 lg:hidden"
                onClick={() => setRailOpen(false)}
                aria-hidden="true"
              />
            )}

            <Sidebar
              id="app-rail"
              className={cn(
                "fixed inset-y-0 right-0 z-40 w-80 max-w-[85vw] shadow-2xl shadow-black/60 transition-transform duration-200 ease-out",
                "lg:static lg:z-auto lg:w-72 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none lg:transition-none",
                railOpen ? "translate-x-0" : "translate-x-full",
              )}
              inert={!wideRail && !railOpen}
              value={sidebarTab}
              onChange={setSidebarTab}
              environment={{
                draft: env.draft,
                errors: env.errors,
                isValid: env.isValid,
                pendingReset: env.pendingReset,
                isLive: sim.isLive,
                onValue: env.setValue,
                onSeed: env.setSeed,
                onPreset: handlePreset,
                onApplyReset: env.applyReset,
                onRevert: env.revert,
              }}
              inspector={{
                inspection: sim.inspection,
                maxEnergy: sim.config.maxEnergy,
                tick: sim.tick,
              }}
              view={{
                colorMode: sim.colorMode,
                onColorMode: sim.setColorMode,
                view,
                onView: patchView,
                onZoom: camera.zoomCentre,
                onResetView: camera.fit,
                zoomPercent: camera.zoomPercent,
              }}
            />
          </div>
        </Tabs>

        <footer className="flex flex-col gap-2 border-t border-line bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <TransportControls
            status={sim.status}
            speed={sim.speed}
            onToggleRun={sim.toggleRun}
            onReset={env.applyReset}
            onSpeed={sim.setSpeed}
          />
          <div className="flex items-center gap-4 text-[11px] text-ink-faint">
            <span className="tnum truncate text-ink-dim">
              {sim.inspection !== null
                ? `Selected #${sim.inspection.id} · gen ${sim.inspection.generation} · energy ${sim.inspection.energy.toFixed(1)}`
                : "No creature selected"}
            </span>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
