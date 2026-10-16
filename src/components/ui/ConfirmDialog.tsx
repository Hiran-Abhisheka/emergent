import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ConfirmDialogProps {
  /** The element that opens the dialog; composed with `asChild`. */
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * A blocking confirmation for destructive actions. This is the only place the
 * UI interrupts the user (see D-309/D-401): routine actions never gate.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root>
      <AlertDialogPrimitive.Trigger asChild>{trigger}</AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px]" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-line-strong bg-surface p-4 shadow-2xl shadow-black/60">
          <AlertDialogPrimitive.Title className="text-[13px] font-semibold tracking-wide text-ink">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description asChild>
            <div className="mt-2 text-[11px] leading-relaxed text-ink-dim">{description}</div>
          </AlertDialogPrimitive.Description>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel className="h-8 border border-line bg-surface-2 px-3 text-xs text-ink transition-colors hover:border-line-strong hover:bg-surface-3">
              {cancelLabel}
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              onClick={onConfirm}
              className={cn(
                "h-8 border px-3 text-xs font-medium transition-colors",
                destructive
                  ? "border-danger/50 bg-danger/15 text-danger hover:bg-danger/25"
                  : "border-accent-dim bg-accent/10 text-accent hover:bg-accent/20",
              )}
            >
              {confirmLabel}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
