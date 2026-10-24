# be-reasonable

Two slash commands that keep your AI coding agent honest — **after** it writes the code.

Most agent rules are system prompts loaded before the work: they compete for the
context window, drift out of date, and blur into a hundred other instructions.
These commands are review-time guardrails. You fire them when the agent is done;
they challenge what it produced. Nothing is loaded, nothing runs, until you ask.

## Commands

### `/be-reasonable`

Post-hoc simplicity review. Asks whether the solution is simple and maintainable,
whether every moving piece earns its place, and what the smallest correct version
looks like. Takes a scope: the change just written, a file, a spec.

### `/maintain-tests`

Test hygiene review. Cuts assertions on copy, CSS classes, DOM shape and other
implementation details, drives tests toward behaviour-only, and pushes the suite
toward milliseconds. Backed by a one-page, stack-agnostic
[ruleset](skills/maintain-tests/testing.md).

## Install

**Claude Code (commands):** copy the files from [`commands/`](commands/) into
`.claude/commands/` (per project) or `~/.claude/commands/` (global).

**Any agent (skills):** one command via [skills.sh](https://skills.sh):

```
npx skills@latest add AlexParamonov/be-reasonable -a <agent>
```

**Manual:** copy `commands/*.md` wherever your agent reads slash commands, and/or
`skills/` if it reads `SKILL.md`. No other files, no hooks, no build step.

## Why every command ships twice

`commands/` is the canonical form: these are user-invoked slash commands, and the
markdown there is the source of truth. `skills/` is a fallback mirror so that
skills-only agents and one-command installers work, and so `testing.md` travels
with `maintain-tests` when installed as a skill. If the two copies disagree,
`commands/` wins; keep them in sync.

Both copies are phrased **user-invoked only**: their descriptions tell the model
never to trigger them on its own. A guardrail runs when a human decides the agent
should be checked, not when the model feels like it — that is the whole design.
