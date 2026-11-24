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

Pi only. When the answer to your prompt is final, the extension counts its prose, ignoring fenced code blocks and tables, and asks for a shorter answer when it passes your bound. It is off until you switch it on:

```json
// ~/.pi/agent/be-reasonable.json
{
  "beConcise": {
    "enabled": true,
    "maxChars": 700,
    "message": "Be concise"
  }
}
```

`message` is the instruction the model receives. The default is the plain two words `/skill:be-concise` carries, because a longer one tested worse. A trusted project's `.pi/be-reasonable.json` overrides every `beConcise` setting for that project.

The request waits for the turn to end rather than cutting in while tools run, and comes once per answer: the answer to a request is never asked again, an interrupted answer gets none, and neither does one when you already have a message queued, because that message steers the answer itself.

The shorter answer and the request stay in the transcript, also after you reopen the session, but leave the model's context once the shorter answer ends. Later replies are answered from the full answer, even when you refer to the shorter one. If Pi exits before the shorter answer's last message ends, the next answer still sees the exchange; Pi hides it at the end of that answer.

### Settings

`/be-reasonable-settings` changes any setting without editing a file. **Be concise** opens its three rows: the switch, the bound and the wording. A row first asks which level to write, Global or Project, and its **Clear...** entry removes the setting from one level at a time. A value the project file provides shows as `500 [project]`, and every change says which file it landed in.

### Skill visibility

Pi shows the model every skill it loads, and the model reads those descriptions to decide what to open. If you only ever run a skill yourself, that listing costs you tokens on every turn. Switch it off in `/be-reasonable-settings` under **Skills**, one row per skill:

```json
// ~/.pi/agent/be-reasonable.json
{
  "modelInvocable": {
    "maintain-tests": false
  }
}
```

A switched-off skill leaves the model's listing from the next turn, and `/skill:maintain-tests` still runs it: the switch hides the invitation, not the skill. Defaults: `be-reasonable` and `maintain-tests` shown, `maintain-changelog` not. Rows use the same Global and Project levels as the be-concise settings, and a project's config can switch only the skills this package ships.

`be-concise` has no row: its `SKILL.md` ships `disable-model-invocation: true`, which is pi's own switch and applies first.

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
