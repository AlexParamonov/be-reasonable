---
name: be-reasonable
description: User-invoked only, never runs automatically. Reviews a change for unnecessary complexity and simpler alternatives. Run only when the user explicitly asks to be reasonable about something.
---

Is the solution simple and maintainable?
Think how to reduce complexity: do we really need all the moving pieces? Could this be achieved with fewer parts and a clean interface?
The goal is a maintainable, simple but still **correct** system.

Point it at the change just written, a file, or a spec, and challenge every piece: what does it earn? Name what you would delete, merge or inline, and what guarantee each cut preserves.
