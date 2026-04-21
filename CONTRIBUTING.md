# Contributing to Juragan

Welcome! Juragan is a self-hosted business AI agent for Indonesian UMKM owners. Here's how to work on it.

## Quick start

```bash
git clone https://github.com/<your-fork>/juragan
cd juragan
pnpm setup
pnpm dev
```

## Branch naming

- `fix/<issue>-<short-description>` — bug fixes
- `feat/<short-description>` — new features
- `chore/<short-description>` — tooling, deps, CI
- `docs/<short-description>` — documentation only

Examples:
- `fix/path-traversal-workspace`
- `feat/whatsapp-channel`
- `chore/add-dependabot`

## Commit style

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
fix(api-routes): correct path traversal check for workspace files
feat(worker): add BullMQ retry for failed reminder dispatches
chore(deps): pin zod to v3.25 as specified in memory
```

Prefixes: `fix`, `feat`, `chore`, `docs`, `refactor`, `test`

## PR process

1. **Fork** the repo and create a branch from `main`.
2. **Fill in the PR description** — what changed, why, how to test.
3. CI must pass (`check-types`, `lint`, `test`).
4. At least one review required before merge.
5. Squash-merge on merge. Use the PR title as the commit subject.

## Code standards

- **Biome** enforces formatting + linting. Run `pnpm format` before commit.
- **TypeScript strict mode** — no `any`, no non-null assertions (`!`) unless absolutely justified.
- **Tests** — new tools get a test file in `apps/api/tests/tools/`. Run `pnpm test` to verify.
- **No commented-out dead code** — remove it instead of commenting it out.
- **No hardcoded secrets** — use env vars or the settings DB.

## Adding a tool

1. Create `apps/api/src/mastra/tools/mytool.ts` — factory function `createMyTools({ db, tenantId })`.
2. Return a tool from `createTool()` with a Zod input schema.
3. Wire it into `apps/api/src/mastra/agents/juragan.ts`.
4. Add tests in `apps/api/tests/tools/mytool.test.ts`.
5. Document the tool in the agent instructions (the `instructions` string in `juragan.ts`).

## Adding a package

1. Add to `pnpm-workspace.yaml`.
2. Create the package with the right TypeScript config (`tsconfig.base.json` extends it).
3. Export types from `packages/<name>/src/index.ts`.
4. If new deps are needed, add them to the package and run `pnpm install`.

## Roadmap

See the [README](./README.md) Roadmap section. Pick up any item labeled "planned" — drop a comment in the issue or PR before starting so we don't duplicate work.

## Getting help

Open an issue with your question. Bug reports welcome, feature requests welcome, contributions welcome.
