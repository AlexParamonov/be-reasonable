# Changelog

One bullet per change a reader can observe. The lead sentence is under 25 words; nesting is only for a new
setting (name, default, where to toggle), a breaking change's migration, or a number the reader acts on.
`## [Unreleased]` is the draft. Everything below a `## [x.y.z]` heading shipped and is not edited.

## [Unreleased]

### Removed

- **`be-concise` skill** — removed the manual `/skill:be-concise` shortcut; automatic shortening remains in the pi extension.

## [0.3.0] - 2026-11-24

### Changed

- **`be-concise`** — the shorter answer stays in the transcript, and the model no longer sees it or the request in later turns.
- **`be-concise` default** — on by default, so a long answer is trimmed without setup. Switch it off in `/be-reasonable-settings` or with `"enabled": false`.

## [0.2.0] - 2026-11-23

### Added

- **`be-concise`** — pi counts the prose in your final answer and asks for a shorter one when it passes your
  bound. One request per answer, and an interrupted answer gets none.
  - `beConcise`: `enabled` off by default, `maxChars` 700, `message` `Be concise`. Set it in
    `~/.pi/agent/be-reasonable.json`, in a trusted project's `.pi/be-reasonable.json`, or in the menu.
- **`maintain-changelog` skill** — writes or tidies `CHANGELOG.md`, one bullet per observable change, with a
  checker that refuses an over-long bullet. An agent may load it on its own: only its description holds it back.
- **`/be-reasonable-settings` menu** — change any setting without editing a file. Each row first asks which
  level to write, Global or Project, and a value the project file provides is marked `[project]`.
- **Skills visibility switch** — keep a shipped skill out of the model's listing; `/skill:name` still runs it.
  - `modelInvocable`, per skill, shown by default except `maintain-changelog`. Toggle it in the menu.
- **Prompt reminder for `be-reasonable`** — the model is told to load and apply the skill before it reports work
  complete. Pi only.

### Changed

- **`be-reasonable` description** — starts with when to load it, so an agent picks it up on its own more often.

### Removed

- **Prompt templates** — `/be-reasonable` and `/maintain-tests` are gone; the package ships skills only.
  - Run `/skill:be-reasonable` and `/skill:maintain-tests` instead.
