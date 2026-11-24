import type { ContextEditEntryDraft, ProjectedSessionEntry, SessionEntry } from "@earendil-works/pi-coding-agent";

export const TRIM_TYPE = "be-concise";

function classify(entry: SessionEntry): "request" | "output" | "barrier" | "transparent" {
  switch (entry.type) {
    case "custom_message":
      return entry.customType === TRIM_TYPE ? "request" : "barrier";
    case "branch_summary":
    case "compaction":
      return "barrier";
    case "message":
      if (entry.message.role === "assistant" || entry.message.role === "toolResult") return "output";
      if (entry.message.role === "user" || entry.message.role === "bashExecution") return "barrier";
      return "transparent";
    default:
      return "transparent";
  }
}

export function wasTrimRequested(entries: readonly ProjectedSessionEntry[]): boolean {
  for (let i = entries.length - 1; i >= 0; i--) {
    const kind = classify(entries[i].sourceEntry);
    if (kind === "request" || kind === "barrier") return kind === "request";
  }
  return false;
}

export function trimContextEdits(entries: readonly ProjectedSessionEntry[]): ContextEditEntryDraft[] {
  const edits: ContextEditEntryDraft[] = [];
  let inTrim = false;
  for (const { sourceEntry, messages } of entries) {
    const kind = classify(sourceEntry);
    if (kind === "request" || kind === "barrier") inTrim = kind === "request";
    if (inTrim && messages.length > 0 && (kind === "request" || kind === "output")) {
      edits.push({ type: "context_edit", targetId: sourceEntry.id, replacement: null });
    }
  }
  return edits;
}
