# be-reasonable

Less to review: simpler code, tests that assert behavior, changelogs a person can read, and answers that fit on a screen.

Four skills and one extension. An agent picks a skill when the task matches, or you run it yourself. The skills work in any agent that reads `SKILL.md`. The extension is pi only and on by default.

## Pi

```sh
pi install npm:be-reasonable
```

Add `-l` to install for the current project instead of every project.

### Shorter answers

`be-concise` is pi only, and on by default. It asks the model to reword its last message when its length is above the configured threshold. The threshold ignores code blocks and tables. Switch it off in `/be-reasonable-settings`.

But that message is invisible to the model in later turns. This avoids lobotomizing the model's intelligence.

You see both answers in the transcript. The model sees only the full answer. It works alongside other extensions and tools.

### Skills

- `/skill:be-reasonable` cuts the complexity a reviewer would push back on. Pi is told to apply it before it reports work complete.
- `/skill:maintain-tests` keeps tests on behavior. No assertions on copy, class names or private methods.
- `/skill:maintain-changelog` writes one bullet per change a reader can observe, with a checker that refuses an over-long one. Its row is off, so pi will not pick it up on its own.
- `/skill:be-concise` asks for a shorter answer by hand.

### Settings

`/be-reasonable-settings` allows you to configure what is loaded and how extention behaves on Global or Project level.

Settings live in `~/.pi/agent/be-reasonable.json`, and in `.pi/be-reasonable.json` of a trusted project, when you create project level settins:

| Setting | Default | Effect |
| --- | --- | --- |
| `beConcise.enabled` | `true` | Ask for a shorter answer when a final answer passes the bound. |
| `beConcise.maxChars` | `700` | Characters of prose allowed. Code blocks and tables are not counted. |
| `beConcise.message` | `Be concise` | The instruction the model receives. Any text; a longer one tested worse. |
| `modelInvocable.<skill>` | `true`, except `maintain-changelog` | Whether the model sees the skill in its listing. |

### Skill visibility

Pi shows the model every skill it loads. The model reads those descriptions to decide what to open. If you only ever run a skill yourself, that listing costs you tokens on every turn. Switch it off under **Skills**, one row per skill.

A switched-off skill frees the model's context. You can still run it as command manually like `/skill:maintain-tests`

## Other agents

These read the `SKILL.md` files only.

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

To install one skill, add `--skill maintain-changelog`, `--skill maintain-tests`, `--skill be-concise` or `--skill be-reasonable`. Use `-g` for a global install. `npx skills --help` lists supported agents.

## Development

```sh
npm install
npm run check   # format, lint and type checks
npm test
```
