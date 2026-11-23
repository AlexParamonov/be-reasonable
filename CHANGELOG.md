# Changelog

One bullet per change a reader can observe. The lead sentence is under 25 words; nesting is only for a new
setting (name, default, where to toggle), a breaking change's migration, or a number the reader acts on.
`## [Unreleased]` is the draft. Everything below a `## [x.y.z]` heading shipped and is not edited.

## [Unreleased]

### Added

- **`/be-reasonable-settings` menu** — change any setting without editing a file. Each row first asks which
  level to write, Global or Project, and a value the project file provides is marked `[project]`.
- **Skills visibility switch** — keep a shipped skill out of the model's listing; `/skill:name` still runs it.
  - `modelInvocable` in `~/.pi/agent/be-reasonable.json` or a trusted project's `.pi/be-reasonable.json`, or the
    **Skills** rows in the menu. Defaults: `be-reasonable` and `maintain-tests` shown, `maintain-changelog` not.
- **Prompt reminder for `be-reasonable`** — the model is told to load and apply the skill before it reports
  work complete. Pi only.

### Changed

- **`be-reasonable` description** — starts with when to load it, so an agent picks it up on its own more often.
- **One trim request per answer, not per prompt** — a later run in the same turn, one a background notification
  started for example, gets its own request, and a request you typed yourself is never repeated.
- **Answer prose bound** — defaults to 700 characters, down from 1200.
- **Trim request wording** — defaults to the two words `Be concise`, replacing the longer instruction the skill
  used to carry.
- **Project config** — overrides every `beConcise` setting, not only the bound, so one repository can run with its
  own switch, bound and wording.
- **`maintain-changelog` no longer ships `disable-model-invocation: true`** — its visibility is the setting now,
  and it is off by default. Offer it to the model from the **Skills** rows.
  - Claude Code and Codex read no such setting: there an agent may now select the skill on its own, held back
    only by its description.
