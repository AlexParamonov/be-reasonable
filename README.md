# be-reasonable

Less to review: simpler code, tests that assert behavior, changelogs a person can read, and answers that fit on a screen.

Four skills, picked by the agent when the task matches or run by you, and one extension that trims a long answer. The skills work in any agent that reads `SKILL.md`; the extension is pi only and on by default.

## Pi

```sh
pi install npm:be-reasonable
```

Add `-l` to install for the current project instead of every project.

### Shorter answers

`be-concise` is pi only, and on by default. It is for you to read, not for the model to work from: when the answer to your prompt is final, it counts the prose, ignoring code blocks and tables, and asks for a shorter answer when it passes your bound. Switch it off in `/be-reasonable-settings`.

**What you see:** your full answer, then a shorter one below it. Both stay in the session and on screen, also after a reopen; nothing is rewritten.

**What the model sees:** the full answer and your reply, and nothing else. Pi keeps the session whole and filters the request and the shorter answer out before the model, so later answers are exactly the ones you would have had without be-concise.

One request per answer, after it finishes: none for an interrupted answer, and none when a message you queued will steer it instead.

### Skills

- `/skill:be-reasonable` cuts the complexity a reviewer would push back on. Pi is also told to apply it before it reports work complete.
- `/skill:maintain-tests` keeps tests on behavior: no assertions on copy, class names or private methods.
- `/skill:maintain-changelog` writes one bullet per change a reader can observe, with a checker that refuses an over-long one. Its row is off, so pi will not pick it up on its own.
- `/skill:be-concise` asks for a shorter answer by hand.

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

Pi shows the model every skill it loads, and the model reads those descriptions to decide what to open. If you only ever run a skill yourself, that listing costs you tokens on every turn. Switch it off under **Skills**, one row per skill.

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
