import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  EnvironmentPanel,
  type EnvironmentPanelProps,
} from "@/components/controls/EnvironmentPanel";
import { InspectorPanel, type InspectorPanelProps } from "@/components/inspector/InspectorPanel";
import { ViewControls, type ViewControlsProps } from "@/components/controls/ViewControls";

export type SidebarTab = "environment" | "inspector" | "view";

interface SidebarProps {
  value: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  environment: EnvironmentPanelProps;
  inspector: InspectorPanelProps;
  view: ViewControlsProps;
}

/** The right-hand instrument rail: environment editor, inspector and view options. */
export function Sidebar({ value, onChange, environment, inspector, view }: SidebarProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-line bg-surface">
      <Tabs
        value={value}
        onValueChange={(next) => onChange(next as SidebarTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="px-1">
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="inspector">
            Inspector
            {inspector.inspection !== null && (
              <span className="tnum text-[9px] text-accent">#{inspector.inspection.id}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="view">View</TabsTrigger>
        </TabsList>
        <TabsContent value="environment" className="flex min-h-0 flex-1 flex-col">
          <EnvironmentPanel {...environment} />
        </TabsContent>
        <TabsContent value="inspector" className="flex min-h-0 flex-1 flex-col">
          <InspectorPanel {...inspector} />
        </TabsContent>
        <TabsContent value="view" className="min-h-0 flex-1 overflow-y-auto">
          <ViewControls {...view} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
