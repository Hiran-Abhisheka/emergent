import { Boxes, FlaskConical, HardDrive, LineChart } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/Tabs";

export type MainTab = "world" | "statistics" | "experiments" | "saves";

/** Primary navigation between the live world and the analysis views. */
export function MainNav() {
  return (
    <TabsList className="border-b-0 px-2">
      <TabsTrigger value="world">
        <Boxes className="h-3.5 w-3.5" />
        World
      </TabsTrigger>
      <TabsTrigger value="statistics">
        <LineChart className="h-3.5 w-3.5" />
        Statistics
      </TabsTrigger>
      <TabsTrigger value="experiments">
        <FlaskConical className="h-3.5 w-3.5" />
        Experiments
      </TabsTrigger>
      <TabsTrigger value="saves">
        <HardDrive className="h-3.5 w-3.5" />
        Saves
      </TabsTrigger>
    </TabsList>
  );
}
