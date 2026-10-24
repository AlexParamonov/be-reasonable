---
name: maintain-tests
description: Review tests for maintainability, cut what asserts implementation details
---

Critically review your tests. Remove, delete or change parts that assert copy, CSS classes, DOM shape or other implementation details. Tests should only test behaviour.

Rules of thumb:

- Assert observable outcomes through public interfaces; never internals, storage formats, copy or element counts.
- Locate elements by published IDs; a CSS class is fair game only when the class itself is the contract.
- Synchronize on events and round trips, never on sleeps or timed windows.
- Cut duplicated setup; build state through shared factories and real APIs.
- A test that needs a real timer, network or full UI mount to prove logic is testing the wrong layer.

Full guidance: [testing.md](https://github.com/AlexParamonov/be-reasonable/blob/main/skills/maintain-tests/testing.md)

Reduce the tests-to-production ratio significantly and make the suite run in a few milliseconds.
