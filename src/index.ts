/**
 * index.ts — Extension entry: watch the settled answer and ask for a trim when its prose passes the bound.
 *
 * The request is one continuation, never a second one for the same answer: a continuation requested again
 * after an already-shortened reply is a loop that spends a turn per round.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "./config/config-io.ts";
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
  let awaitingTrimReply = false;

  pi.on("input", async () => {
    awaitingTrimReply = false;
  });

  pi.on("agent_before_settle", async (event) => {
    if (event.outcome !== "completed") return;
    const config = loadConfig();
    const text = lastAssistantText(event.context.llmMessages);
    if (!shouldRequestTrim({ text, config, alreadyTrimmed: awaitingTrimReply })) {
      awaitingTrimReply = false;
      return;
    }
    awaitingTrimReply = true;
    return {
      entries: [
        ...event.entries,
        { type: "custom_message", customType: TRIM_TYPE, content: config.beConcise.message, display: false },
      ],
      continue: true,
    };
  });
}
