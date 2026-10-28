# be-reasonable for Pi

Simplify code without sacrificing correctness and keep tests focused on behavior.

## Install

```sh
pi install npm:be-reasonable
```

Pi loads the package's prompt templates and skills by default. To install for the current project instead of all projects:

```sh
pi install -l npm:be-reasonable
```

## Prompt commands

Run these slash commands when you want a review:

- `/be-reasonable [scope]` asks whether a plan or implementation can be simpler without compromising correctness. Pass a file, feature, or other scope as an argument.
- `/maintain-tests` reviews tests for behavior-focused assertions and follows the project's testing guidance when available.

## Skills

Pi can select the package's skills when relevant, or you can invoke one directly:

- `/skill:be-reasonable` applies the simplicity review.
- `/skill:maintain-tests` reviews test quality and includes a bundled fallback testing guide.

## Choose which resources to load

By default, Pi loads the package's prompts and skills. To load only one kind, replace the package's string entry in `packages` in `~/.pi/agent/settings.json` (global) or `.pi/settings.json` (project-local) with an object. Keep any other package entries in that array.

**Commands only:** disable skills; prompts remain enabled.

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

**Skills only:** disable prompts; skills remain enabled.

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

To load both, leave the package entry unfiltered or use the regular `pi install` command.
