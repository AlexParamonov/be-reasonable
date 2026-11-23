# be-reasonable

Simplify code without sacrificing correctness and keep tests focused on behavior.

It also turns pages of agent prose into the answer you can read, without asking the agent to reason less.

The skills provide reusable guidance to agents that support Agent Skills. An agent selects them when the task matches, and you can also invoke a skill directly as a command.

## Pi

Install the package from npm:

```sh
pi install npm:be-reasonable
```

Pi loads the skills by default. To install for the current project instead of all projects:

```sh
pi install -l npm:be-reasonable
```

### Skills

Pi selects a skill when the task matches its description, or you can invoke it directly:

- `/skill:be-reasonable` reviews unnecessary complexity.
- `/skill:maintain-tests` reviews test quality and includes a bundled fallback testing guide.
- `/skill:maintain-changelog` writes or tidies `CHANGELOG.md`. It sets `disable-model-invocation: true`, so an agent never selects it on its own; run it yourself, and pass the change to document or nothing at all to tidy the Unreleased section.
- `/skill:be-concise` cuts the last reply down, automatically and fully configurable via /be-reasonable-settings menu

### be-concise extension

Pi only. When the answer to your prompt is final, the extension counts its prose, ignoring fenced code blocks and tables, and asks for a shorter answer if it passes your bound:

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

`enabled` is off until you set it, and `message` is the instruction the agent receives: those two words by default, the ones `/skill:be-concise` carries, because an elaborate instruction tested worse than the plain one. Put whatever you like there. A trusted project's `.pi/be-reasonable.json` overrides every setting for that project, so one repository can run with its own bound, switch and wording.

`/be-reasonable-settings` is the menu for these files: **Be concise** opens the be-concise settings, where the switch, the bound and the wording are each one row. A change is written to the global file as you make it, so a project's own setting still wins over it.

The request waits for the turn to end rather than cutting in while tools are still running. It comes once per prompt. An interrupted answer gets no request, and neither does one when you already have a message queued: that message will steer the answer itself.

## Other agents

Claude Code users can install the GitHub plugin:

```sh
claude plugin marketplace add AlexParamonov/be-reasonable
/plugin install be-reasonable@be-reasonable
```

Its skills are namespaced, for example `/be-reasonable:maintain-tests`.

Codex users can install the GitHub marketplace plugin:

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

To install only one skill, add `--skill maintain-changelog`, `--skill maintain-tests`, `--skill be-concise` or `--skill be-reasonable`. Use `-g` for a global install; `npx skills --help` lists supported agents.

## Development

```sh
npm install
npm run check   # format, lint and type checks
npm test
```
