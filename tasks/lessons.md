# Lessons

- For Pi boundary tests, build previews from the session's real projection and dispatch successive boundaries against that same session, applying earlier drafts between them. Earlier proposals appear in the preview, but returning `entries` replaces the full list, and preview-only IDs may differ on commit; flat `llmMessages` fixtures miss source-entry identity.
- Read the ending from `BoundaryState.outcome`; `TurnEndEvent.message` is an `AgentMessage` union, not an assistant-only message.
- In a projected-session scan, update exchange ownership from source entries before checking visibility. A hidden request or barrier still changes ownership even though it cannot be an edit target.
- User-facing docs should distinguish what users see from what the model sees. Don't describe recoverable behavior as a product limit when the next turn resolves it.
