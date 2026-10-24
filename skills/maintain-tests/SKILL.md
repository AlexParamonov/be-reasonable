---
name: maintain-tests
description: User-invoked only, never runs automatically. Reviews a test suite for maintainability, cutting assertions on copy, CSS and other implementation details. Run only when the user explicitly asks for a test review.
---

Critically review your tests. Remove, delete or change parts that assert copy, CSS classes, DOM shape or other implementation details. Tests should only test behaviour.

Apply the rules in [testing.md](./testing.md) next to this file.

Reduce the tests-to-production ratio significantly and make the suite run in a few milliseconds.
