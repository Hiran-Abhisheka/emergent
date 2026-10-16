import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilePicker } from "@/components/ui/FilePicker";
import { Panel } from "@/components/ui/Panel";
import { parseExperimentRecord } from "@/simulation/experiments/record";
import type { UsePersistenceResult } from "@/hooks/usePersistence";
import type { ExperimentLibrary } from "@/hooks/useExperimentLibrary";
import { downloadText, readFileText } from "@/lib/download";
import { formatInt } from "@/lib/format";
import { Notice, type NoticeState } from "./Notice";

/**
 * The "Import / export" panel. Both file kinds are validated before they reach
 * the worker: worlds through the engine's own reader, experiment records through
 * `parseExperimentRecord` (see D-604).
 */
export function ImportExportPanel({
  persistence,
  library,
}: {
  persistence: UsePersistenceResult;
  library: ExperimentLibrary;
}) {
  const [notice, setNotice] = useState<NoticeState>(null);

  const handleExportLibrary = useCallback(() => {
    if (library.experiments.length === 0) {
      setNotice({ tone: "error", text: "The experiment library is empty." });
      return;
    }
    downloadText(
      "emergent-experiments.json",
      JSON.stringify(library.experiments, null, 2),
      "application/json",
    );
    setNotice({
      tone: "ok",
      text: `Exported ${formatInt(library.experiments.length)} recorded run(s).`,
    });
  }, [library.experiments]);

  const handleImportLibrary = useCallback(
    (file: File) => {
      void (async () => {
        try {
          const text = await readFileText(file);
          const parsed: unknown = JSON.parse(text);
          const candidates = Array.isArray(parsed) ? parsed : [parsed];
          const valid = candidates.map(parseExperimentRecord).filter((record) => record !== null);
          const existing = new Set(library.experiments.map((record) => record.id));
          const fresh = valid.filter((record) => !existing.has(record.id));
          library.addMany(fresh);
          setNotice({
            tone: fresh.length > 0 ? "ok" : "error",
            text:
              fresh.length > 0
                ? `Imported ${formatInt(fresh.length)} run(s)` +
                  (valid.length > fresh.length
                    ? `; ${formatInt(valid.length - fresh.length)} already present.`
                    : ".")
                : `Nothing imported: ${formatInt(candidates.length - valid.length)} invalid, ` +
                  `${formatInt(valid.length)} already present.`,
          });
        } catch (cause) {
          setNotice({
            tone: "error",
            text: `Could not read “${file.name}”: ${
              cause instanceof Error ? cause.message : String(cause)
            }`,
          });
        }
      })();
    },
    [library],
  );

  const handleImportWorld = useCallback(
    (file: File) => {
      void (async () => {
        const text = await readFileText(file);
        const message = persistence.importWorldJson(text);
        setNotice(
          message === null
            ? { tone: "ok", text: `Restored world from “${file.name}”.` }
            : { tone: "error", text: `Could not import “${file.name}”: ${message}` },
        );
      })();
    },
    [persistence],
  );

  return (
    <Panel
      title="Import / export"
      actions={
        <>
          <Badge tone="neutral">{formatInt(library.experiments.length)} runs</Badge>
          {library.error !== null && <Badge tone="danger">library error</Badge>}
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleExportLibrary}>Export experiments (JSON)</Button>
        <FilePicker
          accept=".json,application/json"
          label="Import experiments"
          onFile={handleImportLibrary}
        />
        <FilePicker
          accept=".json,application/json"
          label="Import world"
          variant="primary"
          onFile={handleImportWorld}
        />
      </div>
      <p className="pt-2 text-[9px] leading-relaxed text-ink-faint">
        Imported experiment records are validated; anything malformed, outdated, or already in the
        library is skipped. An imported world must carry a matching save schema and genome layout.
      </p>
      <div className="flex items-center gap-1.5 pt-2 text-[9px] text-ink-faint">
        <Upload className="h-3 w-3" />
        Importing a world replaces the running world immediately.
      </div>
      {notice !== null && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </Panel>
  );
}
