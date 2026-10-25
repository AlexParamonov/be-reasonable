---
name: maintain-tests
description: Make tests assert behaviour, not implementation. The agent drops copy, CSS and private-method assertions and keeps the suite fast.
---

Critically review your tests and remove/delete/change parts that assert copy, css classes or private methods.
Tests should only test behaviour, see project's testing.md or docs/patterns/testing.md.
Reduce tests to prod ratio significantly and make tests run under a few ms.
