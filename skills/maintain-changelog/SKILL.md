---
name: maintain-changelog
description: Write or tidy CHANGELOG.md. One bullet per observable change, proof linked not inlined. Rewrites the Unreleased section without losing a fact, and never edits a released section.
disable-model-invocation: true
---

# Changelog

Work from the repository root, on the `CHANGELOG.md` there. Follow the format the file declares
in its own header. The reader is deciding whether to upgrade: they skim the bullets and stop the
moment a sentence stops telling them something they can act on. Everything else belongs in the
commit message, an ADR or a design doc.

If the request named a change, document that change. If it named nothing, tidy the Unreleased
section.

## Rules

1. One bullet is one change the reader can observe. Before writing, name what the reader now
   sees, sets, or must do differently. If you cannot name it, the change gets no entry.
2. Lead with that sentence: under 25 words, subject plus what changed plus the observable
   effect. Keep the project's `**Lead-in** — text` style where the file already uses it.
3. Put details in at most two nested bullets, and only for: a new setting (name, default,
   where to toggle), a breaking change (plus its migration), or a number the reader acts on.
4. Cut and link, never inline: test names, measured numbers, verification prose, issue ids,
   rejected alternatives, ADR reasoning. `See ADR-0012.` carries the rest.
   Failure: the entry becomes the acceptance-test record and no reader finishes it.
5. State a limit only where a reader could be harmed by assuming the opposite, and in one
   clause. Do not enumerate the edge cases and attacks you considered.
6. State an invariant once. If it also sits in the README, `CONTEXT.md` or a code comment,
   this bullet points at that home instead of restating it.
7. Verify a claim against the code before keeping it, including claims you did not write. An
   entry that no longer matches the code is corrected or dropped, and the mismatch reported.
8. A released section is immutable: never edit, merge, reorder or delete anything below a
   `## [x.y.z]` heading. Only `## [Unreleased]` is a draft.
9. Cut a release by inserting `## [x.y.z] - YYYY-MM-DD` directly below `## [Unreleased]`, so
   the entries fall under the version and Unreleased is left empty. Bump the package version
   and tag the commit in the same change.

## Tidying an Unreleased section

Run the checker first, then rewrite. `scripts/` below is this skill's own directory;
`CHANGELOG.md` is the one in the repository root:

    node scripts/check-changelog.mjs CHANGELOG.md

1. Read the whole section, and the released sections below it: those are the house standard for
   length, not any guide outside the repository.
2. For each bullet, sort its sentences into claim (reader-visible), detail (rule 3), proof
   (tests, ADRs, measurements) and provenance (`used to X, now Y`, issue ids).
3. Rewrite each claim as a fresh sentence. Do not compress by keeping the head of one sentence
   and the tail of another; that produces fragments nobody re-reads.
4. Move proof and provenance to its home (ADR, design doc, commit message) before cutting it
   from the entry. Confirm the destination holds it; report what you cannot place rather than
   deleting it.
5. Merge bullets that describe one change, keeping the strongest claim.
6. Re-run the checker until it is clean, then check nothing was lost: every setting name,
   identifier and number from the removed text is still in the file, or in the doc you named
   for it.

## Limits

The checker bounds size: no bullet over 80 words, `Unreleased` under 600 words. It cannot check
rule 2, so read the lead sentence of every bullet you touch. A section that only fits by
dropping reader-visible behavior means the release needs an ADR, not a longer bullet.

## Finish only when

- [ ] The checker is clean on the Unreleased section.
- [ ] Every bullet's first sentence says something the reader can act on.
- [ ] `git diff` touches nothing below a `## [x.y.z]` heading.
- [ ] No fact, setting name or number was lost: each survives in the file or its new home.
- [ ] Breaking changes name their migration; new settings name their default and location.
