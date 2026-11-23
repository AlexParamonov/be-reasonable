/**
 * index.ts — Extension entry: watch the final answer and ask for a trim when its prose passes the bound.
 *
 * The bound is read at `agent_before_settle`, where the run's answer can still be seen, and the request is
 * sent at `agent_settled`, where Pi has stopped continuing on its own: that is the final answer, and a
 * message from the middle of a task is never cut short.
 */
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ConfigStore } from "./config/config-store.ts";
import { shouldRequestTrim } from "./be-concise.ts";

const TRIM_TYPE = "be-concise";

function lastAssistantText(messages: readonly { role: string; content: unknown }[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    const parts = Array.isArray(message.content) ? message.content : [];
    return parts
      .map((part) =>
        part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "",
      )
      .join("");
  }
  return "";
}

export default function (pi: ExtensionAPI) {
  const store = new ConfigStore();
  let trimWanted = false;
  let requested = false;

  pi.on("session_start", async (_event, ctx) => {
    store.setProjectDir(ctx.isProjectTrusted() ? join(ctx.cwd, ".pi") : undefined);
    store.reload();
    trimWanted = false;
    requested = false;
  });

  pi.on("input", async () => {
    trimWanted = false;
    requested = false;
  });

  pi.on("agent_before_settle", async (event) => {
    if (event.outcome !== "completed") {
      trimWanted = false;
      return;
    }
    trimWanted = shouldRequestTrim({
      text: lastAssistantText(event.context.llmMessages),
      beConcise: store.beConcise,
      alreadyTrimmed: requested,
    });
  });

  pi.on("agent_settled", async (event, ctx) => {
    if (!trimWanted || event.aborted) return;
    trimWanted = false;
    // The user already has a message waiting: it will steer the answer, so a trim request is noise.
    if (ctx.hasPendingMessages()) return;
    requested = true;
    pi.sendMessage(
      { customType: TRIM_TYPE, content: store.beConcise.message, display: true },
      { triggerTurn: true, deliverAs: "followUp" },
    );
  });
}
