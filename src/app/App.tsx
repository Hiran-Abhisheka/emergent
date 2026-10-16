import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import type { ViewOptions } from "@/simulation/renderer/draw";
import type { Preset } from "@/simulation/presets";

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
        handleSelect(null);
      } else if (event.key.toLowerCase() === "f") {
        camera.fit();
      } else if (event.key === "1") {
        setMainTab("world");
      } else if (event.key === "2") {
        setMainTab("statistics");
      } else if (event.key === "3") {
        setMainTab("experiments");
      } else if (event.key === "4") {
        setMainTab("saves");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sim, camera, handleSelect]);

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
          onValueChange={(next) => setMainTab(next as MainTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex items-center justify-between border-b border-line bg-surface pr-3">
            <MainNav />
            <span className="hidden text-[10px] text-ink-faint lg:inline">
              Space run/pause · pan: drag or arrows · zoom: scroll or ± · click a creature · 1-4 tabs
            </span>
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

            <Sidebar
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

        <footer className="flex items-center justify-between border-t border-line bg-surface px-4 py-2">
          <TransportControls
            status={sim.status}
            speed={sim.speed}
            onToggleRun={sim.toggleRun}
            onReset={env.applyReset}
            onSpeed={sim.setSpeed}
          />
          <div className="flex items-center gap-4 text-[11px] text-ink-faint">
            <span className="tnum text-ink-dim">
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
