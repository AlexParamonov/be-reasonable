# be-reasonable

Simplify code without sacrificing correctness and keep tests focused on behavior.

Use the prompts for on-demand reviews. The skills provide reusable guidance to agents that support Agent Skills.

## Pi

Install the package from npm:

```sh
pi install npm:be-reasonable
```

Pi loads prompts and skills by default. To install for the current project instead of all projects:

```sh
pi install -l npm:be-reasonable
```

### Prompts

- `/be-reasonable [scope]` reviews a plan or implementation for simpler alternatives that preserve correctness.
- `/maintain-tests` reviews tests for behavior-focused assertions and follows the project's testing guidance when available.

### Skills

Pi can select the skills when relevant, or you can invoke them directly:

- `/skill:be-reasonable` reviews unnecessary complexity.
- `/skill:maintain-tests` reviews test quality and includes a bundled fallback testing guide.

### Choose which resources to load

To load only prompts or only skills, replace the package's string entry in `packages` in `~/.pi/agent/settings.json` (global) or `.pi/settings.json` (project-local) with an object. Keep any other entries in that array.

**Prompts only:**

```json
{
  "packages": [
    {
      "source": "npm:be-reasonable",
      "skills": []
    }
  ]
}
```

**Skills only:**

```json
{
  "packages": [
    {
      "source": "npm:be-reasonable",
      "prompts": []
    }
  ]
}
```

Leave the package entry unfiltered to load both.

## Other agents

Claude Code users can install the GitHub plugin:

```sh
claude plugin marketplace add AlexParamonov/be-reasonable
/plugin install be-reasonable@be-reasonable
```

Its skills are namespaced, for example `/be-reasonable:maintain-tests`. To use plain commands instead, copy the Markdown files from `commands/` into `~/.claude/commands/`.

Codex users can install the GitHub marketplace plugin:

```sh
codex plugin marketplace add AlexParamonov/be-reasonable
codex plugin add be-reasonable@be-reasonable
```

After repository updates, refresh the marketplace with `codex plugin marketplace upgrade be-reasonable` and start a new session.

OpenCode users can copy `commands/*.md` to `~/.config/opencode/command/` (global) or `.opencode/command/` (project-local). Other agents can use the Markdown prompts in `commands/` and install skills with [skills.sh](https://skills.sh):

```sh
npx skills@latest add AlexParamonov/be-reasonable -a claude-code
npx skills@latest add AlexParamonov/be-reasonable -a codex
npx skills@latest add AlexParamonov/be-reasonable -a cursor
npx skills@latest add AlexParamonov/be-reasonable -a gemini-cli
npx skills@latest add AlexParamonov/be-reasonable -a opencode
npx skills@latest add AlexParamonov/be-reasonable -a universal   # shared .agents/skills/
```

To install only one skill, add `--skill maintain-tests` or `--skill be-reasonable`. Use `-g` for a global install; `npx skills --help` lists supported agents.
