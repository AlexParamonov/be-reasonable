# be-reasonable

Simplify code without sacrificing correctness, keep tests focused on behavior, and keep answers short.

The package ships four skills. An agent loads one when the task matches its description, and you can run any of them as a command.

## Pi

```sh
pi install npm:be-reasonable
```

Add `-l` to install for the current project instead of every project.

### Skills

- `/skill:be-reasonable` reviews unnecessary complexity. Pi is told to apply it before reporting work complete.
- `/skill:maintain-tests` reviews test quality, with a bundled fallback guide.
- `/skill:maintain-changelog` writes or tidies `CHANGELOG.md`: pass the change to document, or nothing to tidy the Unreleased section. Its settings row is off, so Pi will not pick it up on its own.
- `/skill:be-concise` asks for a shorter answer.

### Be concise

Pi only. It is on by default: switch it off in `/be-reasonable-settings` when you do not want it. When the answer to your prompt is final, the extension counts its prose, ignoring fenced code blocks and tables, and asks for a shorter answer when it passes your bound.

The request comes after the answer finishes, never while tools are still running, and once per answer: the answer to a request is never asked again, an interrupted answer gets none, and neither does one when you already have a message queued, because that message steers the answer itself.

#### Why nothing is rewritten

The trim request and the shorter answer stay in the session and on screen, after a reopen too. Only the model's context loses them, once the shorter answer's last message ends. Pi records the hide as a separate context-edit entry that names the message, so nothing is deleted or rewritten, and every consumer of context follows the same projection, compaction and token counts included.

What you gain: the trim instruction stops steering turns that have nothing to do with it, the shorter answer is not paid for twice, and the record stays honest about what was said.

What it costs: the model never sees the shorter answer, so a reply that refers to it is answered from the full answer. And if Pi exits before the shorter answer's last message ends, the next answer still sees the exchange; Pi hides it when that answer ends.

### Settings

`/be-reasonable-settings` writes every setting without editing a file. **Be concise** opens its three rows, **Skills** one row per skill. A row first asks which level to write, Global or Project, and its **Clear...** entry removes the setting from one level at a time. A value the project file provides shows as `500 [project]`, and every change says which file it landed in.

Settings live in `~/.pi/agent/be-reasonable.json`, and in `.pi/be-reasonable.json` of a trusted project, whose values override the global ones:

| Setting | Default | Effect |
| --- | --- | --- |
| `beConcise.enabled` | `true` | Ask for a shorter answer when a final answer passes the bound. |
| `beConcise.maxChars` | `700` | Characters of prose allowed. Code blocks and tables are not counted. |
| `beConcise.message` | `Be concise` | The instruction the model receives. Any text; a longer one tested worse. |
| `modelInvocable.<skill>` | `true`, except `maintain-changelog` | Whether the model sees the skill in its listing. |

### Skill visibility

Pi shows the model every skill it loads, and the model reads those descriptions to decide what to open. If you only ever run a skill yourself, that listing costs you tokens on every turn.

A switched-off skill leaves the model's listing from the next turn, and `/skill:maintain-tests` still runs it: the switch hides the invitation, not the skill. A project's config can switch only the skills this package ships. `be-concise` has no row: its `SKILL.md` ships `disable-model-invocation: true`, which is pi's own switch and applies first.

## Other agents

These read the `SKILL.md` files and nothing else, so the skill visibility setting is pi's alone.

Claude Code:

```sh
claude plugin marketplace add AlexParamonov/be-reasonable
/plugin install be-reasonable@be-reasonable
```

Its skills are namespaced, for example `/be-reasonable:maintain-tests`.

Codex:

```sh
codex plugin marketplace add AlexParamonov/be-reasonable
codex plugin add be-reasonable@be-reasonable
```

After repository updates, refresh the marketplace with `codex plugin marketplace upgrade be-reasonable` and start a new session.

Other agents install the skills with [skills.sh](https://skills.sh):

```sh
npx skills@latest add AlexParamonov/be-reasonable -a claude-code
npx skills@latest add AlexParamonov/be-reasonable -a codex
npx skills@latest add AlexParamonov/be-reasonable -a cursor
npx skills@latest add AlexParamonov/be-reasonable -a gemini-cli
npx skills@latest add AlexParamonov/be-reasonable -a opencode
npx skills@latest add AlexParamonov/be-reasonable -a universal   # shared .agents/skills/
```

To install one skill, add `--skill maintain-changelog`, `--skill maintain-tests`, `--skill be-concise` or `--skill be-reasonable`. Use `-g` for a global install; `npx skills --help` lists supported agents.

## Development

```sh
npm install
npm run check   # format, lint and type checks
npm test
```
