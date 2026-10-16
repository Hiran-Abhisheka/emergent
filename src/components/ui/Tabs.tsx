import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...rest }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn("flex items-stretch border-b border-line bg-surface", className)}
      {...rest}
    />
  );
}

export function TabsTrigger({ className, ...rest }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium tracking-wide text-ink-faint transition-colors",
        "hover:text-ink-dim data-[state=active]:text-accent",
        "data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-px data-[state=active]:after:bg-accent",
        className,
      )}
      {...rest}
    />
  );
}

export function TabsContent({ className, ...rest }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...rest} />;
}
