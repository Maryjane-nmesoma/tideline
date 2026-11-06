## What and why

<!-- What does this change, and what problem does it solve? Link the issue or milestone item. -->

Closes #

## How I checked it

<!-- Commands you ran, transaction hashes or pages you tried. For UI changes, add a screenshot. -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass
- [ ] New logic has a unit test, and a bug fix has a test that fails without it
- [ ] No mock or placeholder data, and an unreachable source shows as unreachable (not zero, not "unsupported")
- [ ] No new `any`; new upstream shapes are typed in `lib/upstream.ts`
- [ ] Docs updated if behaviour changed (`README.md`, `docs/`, `CHANGELOG.md`, and the known limits list)
- [ ] The diff only contains what this change needs
