# Testing rules

A test is coverage only when it pins behaviour; anything else is a change detector that breaks on safe refactors and passes on real bugs.

## What to assert

- Test observable outcomes through public interfaces: inputs in, verdict out.
- Never assert internals, storage formats, rendered copy, CSS classes, DOM shape or element counts.
- The only presentation pins allowed: hidden-vs-removed state, a class that is itself the contract, an error literal the consumer matches, a policy check on the complete artifact.
- Locate elements by published IDs and attribute-qualified selectors, not styling classes.
- Pin expected payloads for equality asserts; an expectation recomputed from the code under test tests nothing.

## Speed and layering

- Most tests live at the pure-logic layer; full UI and integration runs are the minority. A slow test is usually a test at the wrong layer.
- The unit tier runs in milliseconds. If it can't, move the logic down or delete the test.
- Build state through composable factories and real domain APIs, not copy-pasted setup.

## Synchronization

- Synchronize on events, calls, monitors and round trips; never on sleeps, timed windows or production timeouts.
- Assert absence only after a deterministic sync point; a timed refute waits on nothing and hides races.
- Drive timers and clocks through seams; inject time into pure logic instead of waiting for it.
- Make races deterministic with explicit holds and signals, and prove each with a mutation that must fail.

## Doubles and globals

- Configure test doubles per test at the narrowest boundary; verify a fake's contract against the real path before trusting it.
- Thread test values through parameters and options; never mutate global environment or app config from a test.
- Prefer async and parallel tests execution by default.

## Hygiene

- Mirror test placement to the source layout.
- Static checks only for real policies over complete artifacts or the suite's own source.
- When moving a test between tiers, record why, and classify the covered edge: major (auth, data loss, state transitions, side effects) vs minor (parse, format, invariants).
- Delete rather than mend: a test asserting implementation is not coverage, it is a liability.
