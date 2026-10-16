import { useRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";

interface FilePickerProps {
  /** Comma-separated accept list, e.g. `".json,application/json"`. */
  accept: string;
  label: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  onFile: (file: File) => void;
}

/**
 * A button that opens the native file dialog. The `<input>` is hidden but
 * present in the DOM so the dialog is a real user gesture (no synthetic
 * programmatic file access).
 */
export function FilePicker({ accept, label, variant = "ghost", size, onFile }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) onFile(file);
        }}
      />
    </>
  );
}
