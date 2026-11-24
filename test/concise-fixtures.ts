import type { AssistantMessage, ToolResultMessage } from "@earendil-works/pi-ai";

export function assistant(text: string, overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "anthropic-messages",
    provider: "test",
    model: "test",
    usage: {
      input: 0,
      output: 0,
      totalTokens: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: 0,
    ...overrides,
  };
}

export function toolCallAnswer(): AssistantMessage {
  return assistant("", {
    content: [{ type: "toolCall", id: "call", name: "read", arguments: {} }],
    stopReason: "toolUse",
  });
}

export function toolResult(): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: "call",
    toolName: "read",
    content: [{ type: "text", text: "Tool output" }],
    isError: false,
    timestamp: 0,
  };
}
