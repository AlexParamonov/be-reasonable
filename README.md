# be-reasonable

Simplify code without sacrificing correctness and keep tests focused on behavior.

Most agent rules are system prompts loaded before the work: they compete for the context window, drift out of date, and blur into a hundred other instructions.

I supply skills version just for that. But also encourage you to run `/be-reasonable` after planning, implementation or as often as you wish.
You will be surprised how much junk it will remove without sacrificing system correctness.

Put those in your automated pipeline or just run manually - it will get rid of slop that your other instructions missed.

## Commands

### `/be-reasonable`

Post-hoc simplicity review. Asks whether the solution is simple and maintainable,
whether every moving piece earns its place, and what the smallest correct version
looks like. You can add extra instructions or scope it to a feature

### `/maintain-tests`

Test hygiene review. Cuts assertions on copy, CSS classes, private methods and
other implementation details, drives tests toward behaviour-only, and pushes the
suite toward milliseconds. If your project documents its own testing rules
(`testing.md` or `docs/patterns/testing.md`), the command reviews against those;
otherwise it falls back to the bundled stack-agnostic
[base ruleset](skills/maintain-tests/testing.base.md).

## Install

Install the commands, skills, or both for your agent:

- **Commands** — user-invoked slash commands, zero system-prompt impact. Per harness below.
- **Skills** — for skills-only agents; bundles `testing.base.md`. One installer, any agent.

### Commands

**Pi**

```
pi install npm:be-reasonable
```

This installs the package's prompt commands and skills. See the
[Pi-specific guide](https://github.com/AlexParamonov/be-reasonable/blob/main/README.pi.md)
for details and resource selection. Or install straight from GitHub, no npm
needed: `pi install git:github.com/AlexParamonov/be-reasonable`.

**Claude Code**

```
claude plugin marketplace add AlexParamonov/be-reasonable
/plugin install be-reasonable@be-reasonable
```

Plugin commands are namespaced (`/be-reasonable:maintain-tests` — and, yes,
`/be-reasonable:be-reasonable`). Prefer the plain names? Drop the files in yourself:

```bash
mkdir -p ~/.claude/commands
base=https://raw.githubusercontent.com/AlexParamonov/be-reasonable/main/commands
curl -fsSL $base/be-reasonable.md -o ~/.claude/commands/be-reasonable.md
curl -fsSL $base/maintain-tests.md -o ~/.claude/commands/maintain-tests.md
```

**Codex** — no prompt distribution channel, so copy into `~/.codex/prompts/`
yourself (runs as `/prompts:be-reasonable` and `/prompts:maintain-tests`):

```bash
mkdir -p ~/.codex/prompts
base=https://raw.githubusercontent.com/AlexParamonov/be-reasonable/main/commands
curl -fsSL $base/be-reasonable.md -o ~/.codex/prompts/be-reasonable.md
curl -fsSL $base/maintain-tests.md -o ~/.codex/prompts/maintain-tests.md
```

**OpenCode** — same files into `~/.config/opencode/command/` (global) or
`.opencode/command/` (project).

**Any other agent** — `commands/*.md` is plain markdown in the native prompt
format for Pi, Claude Code, Codex and OpenCode alike; copy it wherever your
agent reads prompts or commands.

### Skills

Pi users can install commands and skills together with one package install;
see the [Pi-specific guide](https://github.com/AlexParamonov/be-reasonable/blob/main/README.pi.md)
for selective installation.

Via [skills.sh](https://skills.sh), any agent:

```bash
npx skills@latest add AlexParamonov/be-reasonable -a claude-code
npx skills@latest add AlexParamonov/be-reasonable -a codex
npx skills@latest add AlexParamonov/be-reasonable -a cursor
npx skills@latest add AlexParamonov/be-reasonable -a gemini-cli
npx skills@latest add AlexParamonov/be-reasonable -a opencode
npx skills@latest add AlexParamonov/be-reasonable -a universal   # shared .agents/skills/
```

To install a specific skill, select it:

```bash
npx skills@latest add AlexParamonov/be-reasonable --skill maintain-tests -a universal
```

Add `-g` for a global install; `npx skills --help` lists all supported agents.
