# Contributing Guide

## Branch Strategy

- `main`: always stable and runnable
- `feature/*`: new features
- `fix/*`: bug fixes
- `chore/*`: maintenance only

## Development Flow

1. Pull latest `main`
2. Create a branch from `main`
3. Implement one logical change per branch
4. Verify locally:
   - `npm run lint`
5. Open a PR and request review
6. Merge after approval

## Commit Message Style

Use short, clear commit messages:

- `feat: add local queue detection`
- `fix: prevent csv mojibake in export`
- `chore: update readme team workflow`

## Pull Request Checklist

- [ ] Scope is small and focused
- [ ] `npm run lint` passes
- [ ] UI change is verified manually
- [ ] No secrets included in commit
