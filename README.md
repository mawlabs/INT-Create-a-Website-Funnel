# maw-landers

Monkeys at Work funnel landing sites. Static Astro sites sharing one kit (`packages/lander-kit`), each deployed to its own SiteGround docroot by GitHub Actions. First site: `createawebsite.ca`.

Read `CLAUDE.md`, then `docs/createawebsite-brief.md`, then `docs/DECISIONS.md` (the 7 Sept evening entry records the quote-first direction that supersedes parts of the brief). Open items for Angelique are at the top of DECISIONS.md.

```sh
pnpm install
cp .env.example sites/createawebsite-ca/.env      # public identifiers only
pnpm --filter createawebsite-ca dev
pnpm --filter createawebsite-ca build             # generates OG images + favicons, then astro build
pnpm check                                        # astro check on every site + copy status
pnpm check:copy:strict                            # what main/deploy enforce: zero FR-review, zero TODO(angelique)
pnpm lhci                                         # Lighthouse CI on the built output (brief §10.5 budgets)
pnpm test:quote                                   # quote engine: every answer path prices and orders correctly
pnpm e2e                                          # browser checks: quote flow, consent gating, forms, no-JS, hreflang
pnpm screens                                      # 390 px + 1280 px screenshots into docs/screens/
```
