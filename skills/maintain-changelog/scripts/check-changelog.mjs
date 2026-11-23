#!/usr/bin/env node
// Bound changelog bullet length. Default scope: the Unreleased section, which is the draft
// an agent is allowed to rewrite. Exit 1 on a violation, 2 on bad arguments.
// Usage: node scripts/check-changelog.mjs [path] [--all] [--max-words N] [--max-section N]

import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--")) ?? "CHANGELOG.md";

function threshold(name, dflt) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const value = Number(argv[i + 1]);
  if (!Number.isInteger(value) || value < 1) {
    console.error(`--${name} needs a positive integer, got ${argv[i + 1]}`);
    process.exit(2);
  }
  return value;
}
const maxWords = threshold("max-words", 80);
const maxSection = threshold("max-section", 600);
const unreleased = /^unreleased$/i;
const sections = [];
let current = null;

for (const [i, line] of readFileSync(file, "utf8").split("\n").entries()) {
  const heading = line.match(/^## +\[([^\]]+)\]/);
  if (heading) {
    current = { name: heading[1], bullets: [], words: 0 };
    sections.push(current);
    continue;
  }
  if (!current) continue;
  const bullet = line.match(/^\s*- +(.*)$/);
  if (bullet) current.bullets.push({ line: i + 1, text: bullet[1] });
  else if (current.bullets.length && line.trim()) current.bullets.at(-1).text += " " + line.trim();
}

for (const section of sections) section.bullets.forEach((b) => (b.words = b.text.split(/\s+/).length));
const scoped = argv.includes("--all") ? sections : sections.filter((s) => unreleased.test(s.name));
if (!scoped.length) {
  console.error(
    argv.includes("--all")
      ? `${file}: no "## [version]" sections found`
      : `${file}: no "## [Unreleased]" section found (use --all for every section)`,
  );
  process.exit(2);
}

let violations = 0;
for (const section of scoped) {
  const counts = section.bullets.map((b) => b.words).sort((a, b) => a - b);
  const total = counts.reduce((a, b) => a + b, 0);
  console.log(
    `[${section.name}] ${counts.length} bullets, median ${counts[Math.floor(counts.length / 2)] ?? 0}, ` +
      `max ${counts.at(-1) ?? 0}, ${total} words`,
  );
  for (const bullet of section.bullets) {
    if (bullet.words <= maxWords) continue;
    violations++;
    console.log(`  ${file}:${bullet.line}  ${bullet.words}w  ${bullet.text.slice(0, 70)}…`);
  }
  if (unreleased.test(section.name) && total > maxSection) {
    violations++;
    console.log(`  section is ${total} words, over the ${maxSection}-word limit`);
  }
}

if (violations) {
  console.error(
    `\n${violations} violation(s): a bullet states at most one observable change plus its setting, ` +
      `migration or number. Move tests, measurements, issue ids and ADR reasoning out of the entry.`,
  );
  process.exit(1);
}
