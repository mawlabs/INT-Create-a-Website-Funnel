# Decisions — maw-landers

Kept by Claude Code. One entry per choice the brief left open, plus every `TODO(angelique)`. Newest first within each section.

## Open items for Angelique (blocking marked ●)

Run `pnpm check:copy -- --list` for the live list. As of 7 Sept 2026:

| # | Item | Where | Brief |
|---|---|---|---|
| ● | MAW wordmark SVG for the footer plate (the PNG from the brand kit is used through `astro:assets`). The site's own mark is the typographic C mark from the design; if you want a drawn SVG, replace `components/Mark.astro`. | `packages/lander-kit/assets/`, `components/Mark.astro` | §13 #1 |
| ● | `process-lead` endpoint: confirm URL and CORS with Karim or Hamza, and that the extra `source`, `language` and `quoted_range_*` fields are accepted; add the `source jsonb` column and `maw_lead_source` HubSpot property from brief §7.1 so the domain shows in reports. Test one lead end to end before launch. | `src/site.ts` (`leadEndpoint`), `lib/quote.ts` (`buildLeadPayload`) | §7.1, §14 |
| | Public URL of the MAW terms & conditions for the intake consent line. | `src/site.ts` (`termsUrl`) | §7.2 |
| | Landing-page base hours (20–30 / 30–45 / 45–70 h) and the timeline-from-hours formula are derived, not in the chat framework. Confirm or adjust in `pricing.ts` / `quote.ts`. | `src/data/pricing.ts`, `lib/quote.ts` | §9 of the MAW docs |
| ● | HubSpot portal ID + EN/FR form GUIDs → `PUBLIC_HUBSPOT_*` (GitHub Actions variables + local `.env`). Until then the form shows "This form isn't connected yet. Email support@monkeysat.work". | `sites/createawebsite-ca/src/site.ts` | §13 #2 |
| ● | GA4 measurement ID → `PUBLIC_GA4_ID`; Search Console verification → `PUBLIC_GSC_VERIFICATION`; submit `sitemap-index.xml`. | `site.ts`, `deploy.yml` | §13 #3 |
| ● | SiteGround: site created, SSH enabled, deploy key added → secrets `SG_HOST`, `SG_USER`, `SG_SSH_KEY`; docroot in `sites.json`; DNS; whether the `.com` exists. | `deploy.yml`, `sites.json` | §13 #4 |
| ● | Three case studies + two testimonials. `src/data/work.ts` is empty and the "Work we've shipped" section is not rendered until it has data — nothing fabricated. | `src/data/work.ts` | §13 #5 |
| ● | The MAW `process-lead` endpoint: confirm the URL, that it accepts cross-origin POSTs from this domain, and that the extra quote fields are stored. Then send one test lead end to end. | `site.ts`, `PUBLIC_MAW_LEAD_ENDPOINT` | §7.1 |
| ● | SiteGround: confirm PHP is enabled for the docroot, or the site audit cannot run. | `public/api/audit.php` | §12 |
| | Audit reference versions (WordPress, PHP, jQuery) — re-check quarterly. | `src/data/versions.ts` | — |
| | Confirmations: publish the hourly rate; the "final quote won't exceed the range" promise on a public page; freelancer cost + timeline cells; MAW timeline cell; 4–8 weeks FAQ; ownership FAQ wording vs. T&C; outside-Quebec FAQ; reply-time promise on the thanks page. Each is a `_todo_*` key beside the string in `en.json` / `fr.json`. | `src/i18n/*.json` | §13 #6 |
| | MAW app change (`chat=open`, `project`, `lang`, `utm_*` persistence, `maw_lead_source`) scheduled with Karim or Hamza. The links already carry the parameters. | monkeysat.work repo | §7.1, §13 #7 |
| | Business address (enables `LocalBusiness`) and the privacy officer's name (Law 25). Privacy page text also needs a pass against monkeysat.work's policy. | `site.ts` (`org.address`), `privacy` in JSON | §13 #8, §11 |
| | Search Console export from monkeysat.work to fold ranking queries into the guide. | — | §13 #9 |
| ● | FR review pass on every `_review: true` node (37 nodes) and the FR guide (`review: true` in frontmatter). `main` cannot deploy until the count is zero. | `fr.json`, `fr/*.mdx` | §13 #10 |
| | Canonical host: `.htaccess` redirects `www` → bare domain. Confirm. | `public/.htaccess` | §10.4 |

## 2026-09-07 (evening) — direction change: quote-first, "Menu du jour" sub-brand

Angelique reviewed the first pass and the Claude Design directions and ruled: the site must do what the MAW chatbot does, get the visitor an instant quote for the type of website they want. The "sincere guide" positioning (DIY vs. freelancer vs. studio, "Do you need us?") pushed people towards DIY and is dropped. Three decisions were confirmed with her before the rebuild:

- **The quote happens on the page.** `packages/lander-kit/lib/quote.ts` is a deterministic engine that mirrors the MAW chat edge function's `SYSTEM_PROMPT` flow (project type → platform → build approach → scope questions → timeline) and the pricing framework in `chat-flow-documentation.md`: base tier from `pricing.ts`, then hour adders for pages, languages, products, integrations (the framework's add-on table converted at the hourly rate), ×1.2–1.3 for rush. Complexity thresholds match `process-lead`'s config (simple < 40 h, moderate < 80, complex < 150, major). No AI call, no chat embed. `scripts/quote-test.mjs` walks all 80,644 answer paths. Where the framework has no number (landing-page base hours, the timeline-from-hours formula) the value is derived and flagged `TODO(angelique)`.
- **Leads go into the same pipeline as the chat.** "Great, let's get started" opens an intake form (name, email, phone, company, notes, consent) and POSTs a `process-lead` payload (`lib/lead.ts`, `buildLeadPayload`) with the quoted range, hours, complexity, urgency, a readable answer summary in `issue_description`, and a `source` object for attribution (`utm_source=createawebsite.ca`). The endpoint is `PUBLIC_MAW_LEAD_ENDPOINT`, defaulting to the documented project host. **Unverified from this environment** (monkeysat.work and supabase.co are unreachable from the build container): confirm URL, CORS and that `process-lead` tolerates the extra fields with Karim or Hamza before launch. "Book a discovery call" opens `meetings.hubspot.com/ange1`; "Out of budget" offers the call or a one-month follow-up (`follow_up_requested`, `feedback: out_of_budget`), as in the chat. Custom solutions get the discovery-phase path with no build price, as the chat prompt requires. The "Still have a question?" form stays on the HubSpot Forms API because `process-lead` would record it as a quoted lead.
- **Visual system: "Menu du jour"** from the Claude Design round, kept; only the content changed. Paper `#FBF4EA` page ground (the one added tint), charcoal ink, Deep Warmth dot leaders, Sunset for the brand dot and primary CTA, Pacific Sea for confirm marks, Power Blue reserved for the MAW mark. Zero radius, hard offset shadows, IBM Plex Mono for meta labels, Satoshi Black for display. This supersedes CLAUDE.md non-negotiable #1's "page background is Not Exactly White" and the brief §8 tokens for this site; the brand palette itself is unchanged. The MAW wordmark (real asset, not the design's typographic "M") sits in the footer on a Not Exactly White plate.

Consequences and smaller calls:
- Contrast corrections to the design handoff: paper text on Sunset is 2.8:1 and fails even for large text, so every Sunset or Warmth button carries a charcoal label (3.8:1 and 5.6:1). Paper on Pacific Sea also fails, so Pacific Sea is a mark colour, never a text ground. Mono meta labels are 72 % charcoal (≈ 4.6:1), not the handoff's 50 %.
- The mono "signage" labels (`Instant quote`, `Le menu`) are rule-flanked labels inside dark blocks, as the design intends; CLAUDE.md #7's "no uppercase eyebrow labels above headings" still holds for headings on paper.
- Hero without JavaScript: the seven project types render as links into the MAW chat with `project` pre-selected, so the no-JS visitor still gets a quote path.
- Quote state lives in `sessionStorage` so a reload or the browser back button keeps the visitor's place; it is cleared after a successful lead.
- Analytics events, all local until consent: `quote_start`, `quote_step {step, value}`, `quote_shown {project, low, high, complexity}`, `quote_accept`, `quote_lead {status}`, `book_call`, `out_of_budget`, plus the earlier `cta_click`, `lang_switch`, `form_submit`. Mark `quote_lead` and `quote_accept` as conversions in GA4.
- Guides keep their SEO purpose but lose the three-way comparison table and the "you probably don't need us" lists; a short "What a studio quote includes" section replaces them and every CTA points at the on-page quote.
- Fonts now: Satoshi Black 900 and Bold 700 (both instanced from Fontshare's Variable file), Plex Sans 400/600, Plex Mono 500; ≈ 125 KB total, Black and Plex Regular preloaded.
- OG images and favicons are regenerated by `scripts/og.mjs` with the C mark; glyphs are laid out and transformed manually from raw font units because opentype.js 2.0's `getPath`/`toSVG` emit NaN coordinates at some offsets.

## 2026-09-08 — Angelique's review: quote-first, no price table, a site audit

The site was rebuilt around getting the visitor a quote. Everything below supersedes the parts of the brief it
touches; the brief itself is unchanged and still governs anything not listed here.

- **The chatbot's questions, on the page.** The hero is a step-by-step quote panel that mirrors the MAW chat flow
  (`supabase/functions/chat` system prompt and `public/docs/chat-flow-documentation.md`, April 2026): project type,
  platform, build approach, scope, timeline, with the same skips (build approach is not asked for "fully custom" or
  "other", and never for the changes flow). `packages/lander-kit/lib/quote.ts` is the engine: a base tier from
  `pricing.ts`, the framework's add-on hours for pages, languages, products and integrations, and the rush
  multiplier. Deterministic, no AI call, no network. `pnpm test:quote` walks all 80,644 answer paths.
- **Leads go where chat leads go.** "Great, let's get started" posts to the MAW `process-lead` edge function with the
  quoted range, hours, complexity and a readable summary of the answers, so a lander lead lands in Supabase, HubSpot
  and ClickUp exactly like a chat lead. `TODO(angelique)`: confirm the function URL, CORS and the extra fields with
  Karim or Hamza, and send one test lead before launch. Until then the panel says the pipeline isn't connected and
  gives the support address. Affects: `site.ts` (`leadEndpoint`), `lib/lead.ts`, `PUBLIC_MAW_LEAD_ENDPOINT`.
- **Design hours are not charged when the client brings a design.** Choosing "Yes, a finished design" leaves a 15%
  handoff allowance on the design phase and removes the rest from the quote; the total and the price follow from the
  sum of the phases, so the quote never bills hours it doesn't list. A basic business site goes from $2,500–$3,500
  (30–40 h) to $1,800–$2,650 (22–30 h). Phases are allocated with the largest-remainder method so they add up exactly
  and an untouched quote still equals the published tier. Affects: §5.2, `quote.ts`.
- **"What things cost" is gone.** The public price table was cut. Prices still reach the visitor through the quote
  tool, which is specific to their project rather than a wall of ranges, and `pricing.ts` remains the single source of
  truth for the engine, `llms.txt` and the `Service` schema. The header nav now points at the two tools.
  Affects: brief §5.4, `PriceBoard` (deleted), `board` copy (deleted).
- **"Do you need us?" and the DIY comparison are gone**, from the home page and from both guides. The brief's
  positioning ("we'll tell you to use a builder") survives as one line in the hero and in the audit's own
  recommendation, not as a section arguing the visitor out of hiring anyone. Affects: brief §5.3, §6.
- **A site audit tool replaces the price table.** Enter a website address and get a plain-language report: platform
  and version, PHP version, HTTPS and mixed content, search-engine basics, whether a French version exists (Bill 96),
  phone readiness, speed and accessibility signals, and consent-before-tracking under Law 25. It ends in one
  recommendation, and the recommendation prefills the quote flow with the project type and platform it detected, so a
  scan turns into a quote without retyping. The audit summary rides along on the lead.
  - **The one server-side file.** A browser cannot read another origin's pages or headers, so `public/api/audit.php`
    fetches the page and returns a snapshot; all analysis happens in the browser (`lib/audit.ts`), which keeps the
    site static everywhere else. SiteGround runs PHP on the same docroot, so it deploys with the rsync that already
    exists. `TODO(angelique)`: confirm PHP is enabled for the docroot in Site Tools.
  - **It is a URL fetcher, so it is locked down**: http and https only on default ports; the host is resolved here and
    private, loopback, link-local and reserved addresses are refused; the connection is pinned to the address that was
    validated, so DNS cannot change under it; redirects are followed by hand and every hop is re-validated; the
    response is size- and time-capped; no cookies or credentials; 12 scans per 10 minutes per IP address. Verified
    against loopback, link-local metadata, private ranges, non-standard ports, credentials in the URL and non-HTTP
    schemes. It reads one page from the outside — no login, no writes, no scanning for private files.
  - **Reference versions live in `src/data/versions.ts`** with a checked-on date, because "outdated" is a moving
    target. `TODO(angelique)`: re-check WordPress and PHP support dates each quarter.
- **Plain language, checked twice.** Every quote question was rewritten for a reader who does not know what a page
  builder or a CRM is, with a one-line description under any option that uses a term. The audit findings are written
  the same way: what it is, why it matters, what it takes to fix. Someone who knows the words still sees WordPress,
  Shopify and "custom-coded" as the labels.
- **The header has fixed rows.** French labels are longer than English ones, so at phone width the header wrapped
  onto an extra line with the fallback font and lost it when Satoshi and Plex swapped in — moving the whole page up
  41 px and costing every French page about eight Lighthouse performance points. The bar is now a grid with set row
  heights (brand and actions on one row, section links on a scrollable row below, one row from 48 em), so its height
  never depends on text metrics. The language bar is decided by a small inline script in `<head>` for the same
  reason: added after first paint, it pushed the page down. Affects: `Header.astro`, `Layout.astro`, `LangBar.astro`.
- **The audit score is a curve, not a subtraction.** `100 / (1 + penalty / 45)`, floored at 1. A neglected site ranks
  low without bottoming out at zero, which reads as an insult rather than a measurement. Affects: `audit.ts`.
- **No dashed or dotted boxes.** The dashed frame around the quote result and the dotted rules in the FAQ, the footer
  and the stacked tables are now hairlines or nothing. The dot leader on a price line stays: it is the sub-brand's
  device, and it is a leader, not a border. The "taxes extra" stamp and the "no robots here" badge were also cut; the
  quote result carries one plain line, "In Canadian dollars, before tax."

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
