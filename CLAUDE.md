# maw-landers — notes for Claude Code

Monorepo for Monkeys at Work (MAW) funnel landing sites: static Astro sites sharing one kit (`packages/lander-kit`), each deployed to its own SiteGround docroot by GitHub Actions. First site: `createawebsite.ca`. Sister sites (`wphandyman.ca`, weappear landers) reuse the kit later.

**Read `docs/createawebsite-brief.md` before doing anything.** It is the spec: scope, routes, page copy, design tokens, conversion, SEO, privacy, deploy, definition of done. Build what it says, in the order in its §0. Where it is silent, choose the simplest option that keeps Lighthouse ≥ 95 and log the choice in `docs/DECISIONS.md`.

## Layout

- `packages/lander-kit/` — tokens, fonts, base styles, Astro components, helpers (seo, schema, hubspot, analytics, i18n). No copy lives here.
- `sites/<name>/` — one Astro site per domain: pages, `src/i18n/{en,fr}.json`, `src/data/pricing.ts`, `src/content/guides/`.
- `sites.json` — name, domain, docroot, `deploy` flag; drives CI and deploy matrices.
- `docs/` — briefs, `DECISIONS.md`, `screens/`.

## Commands

- `pnpm install` — workspace install (current Node LTS, pnpm).
- `pnpm --filter createawebsite-ca dev | build | preview`
- `pnpm check` — `astro check` + lint + FR-review count across sites.
- `pnpm lhci` — Lighthouse CI against built output with the budgets in the brief §10.5.

## Non-negotiables

1. **Brand at creation time.** Only the tokens in `packages/lander-kit/styles/tokens.css`; Satoshi Bold for headings, IBM Plex Sans for body, both self-hosted; page background is Not Exactly White `#F7FBFE`, never pure white; logo from `packages/lander-kit/assets/`. Perfect Sunset `#E76F51` is never a text colour (fails contrast) — button fill and rules only. If a brand asset is missing, stop and ask; do not ship placeholder styling to be fixed later.
2. **Bilingual by law, not by preference.** Every route, string, meta tag, schema field, alt text, error and email exists in EN and FR-CA. Flag machine-drafted French with `_review: true`; `main` cannot deploy while the count is non-zero.
3. **Weight.** No framework runtime on the client. Vanilla TS islands only for the hero reveal, the form and the consent banner. Zero third-party requests before consent. Lighthouse mobile ≥ 95 in all four categories on every page — CI fails otherwise.
4. **Accessibility.** WCAG 2.1 AA: keyboard-only works everywhere, visible focus, native controls (`radio`, `details`, `table`), `prefers-reduced-motion` respected, no scroll or load animations.
5. **Facts come from the brief or from Angelique.** Prices come from `src/data/pricing.ts` only. Never invent testimonials, case studies, timelines, promises or legal text — leave `TODO(angelique): …` and list it in `docs/DECISIONS.md`.
6. **Secrets.** Only `PUBLIC_*` identifiers in `.env`; SSH keys and hosts live in GitHub Actions secrets. Nothing else in git.
7. **Design defaults to avoid** (brief §8.5): uniform rounded cards with shadows, gradient washes, uppercase eyebrow labels, arrows on buttons, numbered markers on non-sequences, fade-up-on-scroll, stock hero photos.

## Working style

- One PR per brief section; each PR includes 390 px and 1280 px screenshots in `docs/screens/`.
- Keep `docs/DECISIONS.md` current: date, decision, why, what it affects.
- Ask (don't guess) when: a brand asset is missing, copy is ambiguous, a legal text is needed, a budget can't be met without dropping something in the brief.
- Do not touch the MAW app repo from here; the chat-parameter change in brief §7.1 is a separate task for the MAW team.
