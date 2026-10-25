---
name: maintain-tests
description: Use after writing or updating tests. Drop assertions on copy, CSS classes and private methods, assert behaviour only, keep the suite fast.
---

Critically review your tests and remove/delete/change parts that assert copy, css classes or private methods.
Tests should only test behaviour, see project's testing.md or docs/patterns/testing.md or if that is missing follow [testing.base.md](testing.base.md)
Reduce tests to prod ratio significantly and make tests run under a few ms.
