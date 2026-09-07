# Decisions — maw-landers

Kept by Claude Code. One entry per choice the brief left open, plus every `TODO(angelique)`. Newest first within each section.

## Open items for Angelique (blocking marked ●)

Run `pnpm check:copy -- --list` for the live list. As of 7 Sept 2026:

| # | Item | Where | Brief |
|---|---|---|---|
| ● | Logo SVGs (dark wordmark + icon mark). The site ships the PNG fallbacks from the brand kit through `astro:assets`; swap the files in `packages/lander-kit/assets/` and the header/footer pick them up. The favicon is an SVG traced from the icon PNG (two triangles); replace with the official mark. | `packages/lander-kit/assets/`, `scripts/og.mjs` | §13 #1 |
| ● | HubSpot portal ID + EN/FR form GUIDs → `PUBLIC_HUBSPOT_*` (GitHub Actions variables + local `.env`). Until then the form shows "This form isn't connected yet. Email support@monkeysat.work". | `sites/createawebsite-ca/src/site.ts` | §13 #2 |
| ● | GA4 measurement ID → `PUBLIC_GA4_ID`; Search Console verification → `PUBLIC_GSC_VERIFICATION`; submit `sitemap-index.xml`. | `site.ts`, `deploy.yml` | §13 #3 |
| ● | SiteGround: site created, SSH enabled, deploy key added → secrets `SG_HOST`, `SG_USER`, `SG_SSH_KEY`; docroot in `sites.json`; DNS; whether the `.com` exists. | `deploy.yml`, `sites.json` | §13 #4 |
| ● | Three case studies + two testimonials. `src/data/work.ts` is empty and the "Work we've shipped" section is not rendered until it has data — nothing fabricated. | `src/data/work.ts` | §13 #5 |
| | Confirmations: publish the hourly rate; the "final quote won't exceed the range" promise on a public page; freelancer cost + timeline cells; MAW timeline cell; 4–8 weeks FAQ; ownership FAQ wording vs. T&C; outside-Quebec FAQ; reply-time promise on the thanks page. Each is a `_todo_*` key beside the string in `en.json` / `fr.json`. | `src/i18n/*.json` | §13 #6 |
| | MAW app change (`chat=open`, `project`, `lang`, `utm_*` persistence, `maw_lead_source`) scheduled with Karim or Hamza. The links already carry the parameters. | monkeysat.work repo | §7.1, §13 #7 |
| | Business address (enables `LocalBusiness`) and the privacy officer's name (Law 25). Privacy page text also needs a pass against monkeysat.work's policy. | `site.ts` (`org.address`), `privacy` in JSON | §13 #8, §11 |
| | Search Console export from monkeysat.work to fold ranking queries into the guide. | — | §13 #9 |
| ● | FR review pass on every `_review: true` node (37 nodes) and the FR guide (`review: true` in frontmatter). `main` cannot deploy until the count is zero. | `fr.json`, `fr/*.mdx` | §13 #10 |
| | Canonical host: `.htaccess` redirects `www` → bare domain. Confirm. | `public/.htaccess` | §10.4 |

## 2026-09-07 — build week, first pass

- **Astro 7.3 (latest stable) with `output: 'static'`, `trailingSlash: 'always'`, directory URLs.** The brief says "latest stable". Astro's built-in i18n handles `/` and `/fr/`, `Astro.currentLocale`, and `prefixDefaultLocale: false`. Affects: every page.
- **Fonts self-hosted as subset woff2 in the kit.** Satoshi Bold was produced from Fontshare's Satoshi Variable file (ITF Free Font License), instanced at weight 700 with fontTools and subset to latin + latin-ext; IBM Plex Sans Regular/SemiBold subset from IBM's OFL release. Fontshare's CDN was unreachable from the build container, so the static TTF used for OG rendering is kept in `assets/`. Total ≈ 80 KB. Only Satoshi Bold and Plex Regular are preloaded. Affects: base.css, Layout.
- **Logo: PNG fallbacks from the brand kit, not placeholders.** The SVGs are blocking on Angelique (§13 #1). `astro:assets` outputs them as webp at 1× and 2× for the header and footer, so the swap to SVG is a file replacement. Affects: Header, Footer, `og.mjs`.
- **OG images and favicons generated at build time** (`prebuild` → `packages/lander-kit/scripts/og.mjs`): text is converted to SVG paths with opentype.js so no system fonts are needed, then rasterized with sharp. Generated files are git-ignored under `public/`. Affects: §8.7, sister sites reuse the script.
- **Pricing tokens in copy** (`{price:websites.basic..websites.intermediate}`, `{h:…}`, `{rate}`) resolved by `lib/pricing.ts` at build time, so no number is ever retyped in JSON or MDX. Guides are MDX and use `<Price of="…" />` for the same reason (`@astrojs/mdx` is build-time only; no client runtime). A typo in a token fails the build. Affects: hero, compare table, pricing tables, FAQ, guides, llms.txt, Service JSON-LD.
- **`llms.txt` is a build-time endpoint** (`src/pages/llms.txt.ts`) rather than a static file, so its ranges come from `pricing.ts`. Affects: §10.4.
- **EN/FR key parity is asserted at build time** (`src/i18n/index.ts`): a string present in one language and missing in the other fails the build. `_review` and `_todo*` keys are exempt. Affects: CLAUDE.md #2.
- **`_review: true` lives on JSON nodes, not individual strings**, so Angelique clears a whole hero/FAQ item/section at once. `scripts/check-copy.mjs` counts nodes plus MDX guides with `review: true`, and `TODO(angelique)` items; `--strict` (used on `main` and in deploy) fails on either count. Affects: CI, deploy.
- **Case studies and testimonials render nothing while empty.** The `CaseStudies` component exists and is wired; `src/data/work.ts` holds the shape. No invented work. Affects: §5.6.
- **Compare and pricing tables are rendered twice**: a real `<table>` at ≥ 45 em and a `<dl>` stack (row labels as `<dt>`) below, toggled with CSS. Pseudo-element "responsive table" tricks were rejected because they are invisible to screen readers and the brief asks for `<dt>`. Affects: §5.3, §8.4.
- **Hero works without JavaScript.** CSS `:has()` reveals the selected range; the island (when present) adds the 150 ms crossfade, rewrites `project` in the CTA URL and fires `price_reveal`. `html.js` disables the CSS path once the island runs so the crossfade is not pre-empted. Affects: §5.2, §14.
- **Language bar** shows only when the browser's first language matches the *other* locale (a Spanish browser on the EN page gets no bar). Dismissal and any language-switch click store `maw-langbar-dismissed`. It is a fourth, ~500-byte script; the brief's own §4 requires browser-language detection. Affects: §4.
- **Consent** (`maw-consent` in localStorage, 12-month TTL): GA4 is injected only after "Accept analytics"; events are pushed to a local `dataLayer` array regardless, so nothing leaves the page before consent and nothing is lost if consent arrives later on the same page. `thanks` fires `form_submit` through `<body data-event>` read by the same island — no extra script. The privacy page has a "change my analytics choice" button that clears the key and re-shows the banner. Affects: §7.3, §11.
- **HubSpot `hutk`** is only sent when the cookie exists *and* analytics consent is granted. We never set it ourselves. Affects: §7.2.
- **Lighthouse budget on `noindex` pages.** `/404`, `/thanks` and `/fr/merci` carry `noindex` on purpose, which caps Lighthouse's SEO category at 0.69 (the `is-crawlable` audit). `lighthouserc.json` keeps performance / accessibility / best-practices ≥ 95 on those four URLs and exempts only the SEO category there; every indexable page is held to all four. Affects: §10.5, CI.
- **404 by language prefix**: Apache `ErrorDocument 404 /404.html` globally and `/fr/404/index.html` inside an `<If "%{REQUEST_URI} =~ m#^/fr(/|$)#">` block. Verify on SiteGround at launch (§14). Affects: `.htaccess`.
- **Sitemap hreflang** uses a `serialize` hook over the route table (`src/routes.ts`) because EN and FR slugs differ and `@astrojs/sitemap`'s `i18n` option can only pair identical paths. Thanks and 404 pages are filtered out. Affects: §10.4.
- **`.htaccess` canonical host** is non-www; `www.` 301s to bare. Change one line if Angelique prefers `www`. Affects: §10.4.
- **"Best when" row highlight is Power Blue semibold, not Pacific Sea.** The cells are body size (17–19 px, weight 600) and Pacific Sea on the page background is 3.19:1, which only passes AA at ≥ 24 px or ≥ 18.66 px at weight 700 — Lighthouse flagged it at 0.97. Pacific Sea stays on `h3` (≥ 21 px bold) and link hover. Affects: §8.3, CompareTable.
- **Design choices where the brief was silent:** consent banner and language bar use Power Blue outlined/filled buttons (Sunset is reserved for the primary CTA); the selected tile shows a 4 px Sunset left edge; the `<summary>` marker is Sunset; `h3` is Pacific Sea only at ≥ 21 px bold. Header is sticky from 60 em only. Affects: §8.3, §8.5.
- **Guides link to the home page only in the breadcrumb** (no `/guides/` index exists — out of scope). `BreadcrumbList` is Home → Guide. Affects: §6, §10.3.
- **wphandyman-ca** is a one-page scaffold with `noindex` and `Disallow: /`, `deploy: false` in `sites.json`. Affects: §2 #8.
