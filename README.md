# be-reasonable

Simplify code without sacrificing correctness and keep tests focused on behavior.

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

To install only one skill, add `--skill maintain-changelog`, `--skill maintain-tests` or `--skill be-reasonable`. Use `-g` for a global install; `npx skills --help` lists supported agents.
