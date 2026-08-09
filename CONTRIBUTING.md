# Contributing to Bindog

Thanks for your interest in helping. To keep contributions healthy and inclusive, we follow a shared workflow.

## Getting started

1. Open an **issue** describing the problem or the change you want;
2. After maintainers confirm the issue and green-light the work, **fork** the repository;
3. Implement the change on your fork;
4. Open a **pull request** against the `main` branch of the upstream repo.

Please keep PRs focused. Prefer small, reviewable changes over large mixed patches.

## Local setup

Follow the [README](README.md) “How to run” section (app + optional signaling Worker for multiplayer).

Before opening a PR, run what applies to your change:

```bash
npm run lint
npm run typecheck
npm run test
```

## Project conventions

- Match existing TypeScript / React patterns in `src/` (path alias `#/*` → `./src/*`).
- Prefer clear names: `camelCase` for variables and functions, `PascalCase` for components and types.
- Keep game rules and multiplayer protocol changes covered by tests when practical (`npm run test`).
- Do not commit secrets (`.env`, `.env.local`, Worker TURN credentials).
- UI primitives under `src/components/ui/` are Shadcn-managed — prefer adding/updating via the Shadcn CLI when possible.
- Follow the repo **Prettier** and **ESLint** config (`code-conventions` when available).

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

Examples: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

## Signaling Worker

Changes under `workers/bindog-signaling/` should stay aligned with the Worker README (CORS origins, rate limits, Durable Object room model). Document new env vars or secrets in that README when you add them.

## i18n

User-facing copy lives in `messages/{locale}.json`. When you add or change strings, update **all** locales (`pt-BR`, `en-US`, `fr-FR`, `it-IT`, `de-DE`, `ko-KR`) or note in the PR which locales still need translation.
