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
| ● | Audit reference versions (WordPress, PHP, jQuery) are **unverified** — see "Open question for the team" below. Verify or automate before launch, then re-check quarterly. | `src/data/versions.ts` | — |
| | Decide how the site-check score is presented: our own rating, or counts only — see "Open question for the team" below. | `lib/audit.ts`, `home.audit` copy | — |
| | Confirmations: publish the hourly rate; the "final quote won't exceed the range" promise on a public page; freelancer cost + timeline cells; MAW timeline cell; 4–8 weeks FAQ; ownership FAQ wording vs. T&C; outside-Quebec FAQ; reply-time promise on the thanks page. Each is a `_todo_*` key beside the string in `en.json` / `fr.json`. | `src/i18n/*.json` | §13 #6 |
| | MAW app change (`chat=open`, `project`, `lang`, `utm_*` persistence, `maw_lead_source`) scheduled with Karim or Hamza. The links already carry the parameters. | monkeysat.work repo | §7.1, §13 #7 |
| | Business address (enables `LocalBusiness`) and the privacy officer's name (Law 25). Privacy page text also needs a pass against monkeysat.work's policy. | `site.ts` (`org.address`), `privacy` in JSON | §13 #8, §11 |
| | Search Console export from monkeysat.work to fold ranking queries into the guide. | — | §13 #9 |
| ● | FR review pass on every `_review: true` node (37 nodes) and the FR guide (`review: true` in frontmatter). `main` cannot deploy until the count is zero. | `fr.json`, `fr/*.mdx` | §13 #10 |
| | Canonical host: `.htaccess` redirects `www` → bare domain. Confirm. | `public/.htaccess` | §10.4 |

## How to get a live demo (8 Sept 2026)

The site check cannot be demonstrated from a static file: a browser is not allowed to read another site's pages or
headers, which is why `public/api/audit.php` exists. So a demo anyone can click needs the site on a host that runs
PHP. SiteGround does, and the deploy already exists — what is missing is access.

**Do not demo on `createawebsite.ca` itself.** The French is unreviewed (35 flagged nodes), `TODO(angelique)` items
are still in the copy, and the production deploy blocks on both by design. A demo should be a separate subdomain.

`.github/workflows/staging.yml` builds and deploys one: run it from the Actions tab with a docroot and a URL. It
builds with `PUBLIC_NOINDEX=1`, so every page carries `noindex, nofollow` and `robots.txt` disallows everything, and
it refuses to publish if either of those is missing from the built output. The copy gate prints its counts but does
not block, because the point of a demo is to look at unfinished work.

Any SiteGround domain works — `monkeysatwork.dev`, a demo domain, or a subdomain of either. The workflow takes the
docroot and the URL as inputs; nothing is tied to `createawebsite.ca`. Two things decide the choice:

- **One hosting account or two.** SiteGround SSH credentials are per hosting account, not per domain. Domains under
  the same account share one set of secrets; a domain on a second account needs its own, and the secrets in this
  repository can only hold one at a time.
- **Whose name is on it.** The demo is a Monkeys at Work funnel with unreviewed French in it, so a domain that
  reads as MAW's own workshop is safer than one that could be mistaken for a client's or a product's.

The deploy leaves HubSpot disconnected unless the run asks for it, so a walkthrough does not leave test contacts in
the CRM, and analytics are off entirely. After the rsync it calls the audit endpoint once and warns if PHP is not
answering, since that is the failure everyone would otherwise discover during the demo itself.

To make it run, Angelique needs to provide, once:

1. a site or subdomain in SiteGround Site Tools (say `demo.monkeysatwork.dev`), with **PHP enabled** on that
   docroot — without PHP the pages work but the site check does not;
2. SSH enabled, and the Actions deploy key added;
3. three repository secrets: `SG_HOST`, `SG_USER`, `SG_SSH_KEY` (the same ones production will need).

Everything else — the build, the noindex guard, the rsync — is already written. The same three secrets unlock the
production deploy later, so this is not throwaway work.

## Open question for the team — where the site-check score comes from

Raised 8 Sept 2026. Nothing is blocked by it except the last item, which is a launch blocker on its own.

**The score is ours, not an industry measure.** Each finding carries a weight — urgent 18, worth fixing 7, small
note 2 — and the total runs through `100 / (1 + penalty / 45)`, floored at 1 (`packages/lander-kit/lib/audit.ts`).
Those numbers were chosen so the ranking behaved sensibly across the test fixtures, not derived from anything
published. A visitor cannot reproduce the number elsewhere, and it is not comparable to a Lighthouse or GTmetrix
score. Two ways to handle that, both cheap:

- keep the number and label it as our own rating rather than a benchmark; or
- drop the number and lead with the counts (`5 urgent · 9 to fix · 10 small · 1 good`), which are plain facts.

**The findings themselves sit on firmer ground, and split three ways.**

| Grounded in law or a published standard | Convention, not a published limit | Our judgement, no source |
|---|---|---|
| French version (Charter of the French Language, updated by Bill 96); tracking before consent (Law 25); alt text and `lang` (WCAG 2.1); PHP end-of-life (php.net support schedule); WordPress current release (wordpress.org) | Title ~65 characters, description ~165, one H1, canonical, sitemap, robots.txt, Open Graph — Google truncates by pixel width, not character count, so these approximate a rule nobody publishes | 500 KB of HTML is "heavy" and 200 KB "notable"; 2,500 ms is "slow" and 800 ms "fast"; more than three blocking scripts; more than four images without dimensions; 30% of images missing alt text turning a note into a warning; two or more missing security headers |

Each finding can be defended item by item on the left, explained as convention in the middle, and is a house
opinion on the right. Worth deciding whether the wording should say so where the right-hand column applies.

**● The version data needs a real source before launch.** `src/data/versions.ts` currently says WordPress 6.9 is
current (6.6 the oldest supported) and PHP 8.2 is the end-of-life boundary with 8.4 current. Those came from the
model's training data, which predates the build, and `api.wordpress.org`, `php.net` and `endoflife.date` were all
unreachable from the build sandbox, so **they are unverified**. If 6.9 is not actually the latest, the tool tells a
client running the genuine latest release that they are behind — the one kind of error that discredits a tool like
this outright. Two fixes:

- verify by hand and update the file (fastest, but goes stale again); or
- fetch at build time from `api.wordpress.org/core/version-check/1.7/` and `endoflife.date/api/php.json`, write the
  file, and fail the build if either is unreachable. GitHub Actions has open network, so this works in the deploy
  even though it did not here. The report already carries a checked-on date, which would then mean something.


## 2026-09-16 (later) — the site check has never seen a real website

Angelique: "Can this work for real though by just entering a domain?" — then: "recheck your strategy to make
this a real tool." Both are fair. What follows is what is established so far; a seven-dimension adversarial
audit of the whole path is in flight and its conclusions will be logged separately.

- **`audit.php` has never completed a single real fetch.** Its SSRF refusals were exercised directly and work;
  its happy path has never run. The development sandbox has no outbound network to real sites (verified again
  today against three domains), so this cannot be proven from here by any means. Everything below the endpoint
  — 71 findings, both languages, the downloadable report — has only ever seen hand-written fixtures.
- **`lang.frenchMissing` accuses compliant bilingual sites.** It is a `critical` whose copy cites the Charter of
  the French Language and Bill 96, and it fires on 4 of 10 realistic bilingual markup shapes: a switcher whose
  label sits in a `<span>` (WPML, Polylang, Elementor, Divi all do this), a flag image, French at `/fr-ca/`
  rather than `/fr/`, and any server that answers 405 to the HEAD probe. Only a real `hreflang` pair is a safe
  signal. This is the most damaging thing the tool can do: a wrong legal accusation, under MAW's name, with a
  "book a call" button attached. **Not yet fixed** — the shape of the fix waits on the audit, because the same
  defect is structural: a failed probe is currently indistinguishable from a negative result, everywhere.
- **`seo.canonical.mismatch` was firing on correct canonicals** — the comparison included the scheme and the
  `www.`, which are exactly what a canonical exists to declare. A site reached at `http://` or at `www.` whose
  canonical names the https, non-www version was told its canonical "points somewhere else". Fixed: host and
  path only, `www.` stripped, trailing slash ignored. Seven cases pinned in `scripts/audit-test.mjs`. The https
  and duplicate-host stories are told by their own findings.
- **A blocked fetch now says so.** 403, 406 and 429 on a home page are a bot wall in practice, and a great many
  small-business sites sit behind Cloudflare, Sucuri or a firewall plugin; 503 counts only when a firewall
  names itself in the headers or the body. New error `site_blocked` in both languages: "nothing is wrong on
  your end — we just can't read it from outside", with the by-hand fallback. It replaces `site_error`, which
  told the owner their own site had answered with an error.
- **`scripts/audit-self.mjs` runs the checker against our own built pages**, served over real HTTP, presented
  at their production address (an address is a property of the hosting, not of the markup). It is the cheapest
  false-positive alarm there is: a site we built to pass these checks should pass them. It found the canonical
  bug within a minute of existing. It runs as the `self` suite in `pnpm test` and is skipped without a build.
  Our own pages score 87 / 85 / 95, with only hosting artifacts and two genuine notes about our FR title and
  descriptions being slightly long.

TODO(angelique): nothing here makes the check safe to put in front of the public yet. The blocking item is
still "does PHP with outbound curl work on the SiteGround docroot", and it cannot be answered from this repo.


## 2026-09-16 — the site check, taken down to technical SEO

Angelique: "For the website report generator, can we make it really intuitive like even down to technical SEO?"
The check now covers 71 findings, up from 48, and the report is organised around what a reader can act on.

- **Findings carry an area, not just a severity.** Eight plain-language areas — safety and trust, what it runs on,
  being found on Google, English and French, on a phone, speed, everyone can use it, privacy law — declared once in
  `FINDING_AREAS` so TypeScript catches a new finding with no home. Severity answers "how bad"; the area answers
  "where", which is the question an owner actually has. The on-page report opens with a two-column strip of areas,
  each carrying one of three verdicts (needs work / worth a look / fine). Affects: `audit.ts`, `audit-panel.ts`,
  `SiteAudit.astro`.
- **Every finding that names a problem now says what to do about it.** A one-sentence `fix` line in both languages,
  shown under the finding on the page and in the downloadable file. The build fails if a non-reassuring finding is
  missing one — same rule as the existing "no finding without copy" check. Affects: `copy.ts`, `SiteAudit.astro`,
  both i18n files.
- **Findings quote the evidence.** The 95-character title, the canonical address that points elsewhere, the header
  that leaks the server version: shown verbatim under "What we saw". Evidence is data, not copy, so it is never
  translated, and it is trimmed to 180 characters.
- **The downloadable report is grouped by area with a contents list**, and keeps the checks the site passed. A list
  of only failures reads as a sales document; the passes are what make the failures credible. Within each area the
  findings still run urgent-first. Affects: `audit-report-file.ts`.
- **23 technical-SEO and related checks added:** page-wide `nofollow`; canonical missing vs. pointing elsewhere;
  meta refresh; redirect chains; www and non-www both answering; soft 404s; `robots.txt` blocking the whole site or
  naming no sitemap; a sitemap address that serves HTML; missing charset; thin content; too few internal links;
  heading levels that skip; an incomplete share preview; hreflang with no self-reference and no `x-default`; a
  viewport that blocks zoom or pins a fixed width; uncompressed HTML; stylesheet count; legacy image formats; links
  with nothing to read out; and an open `xmlrpc.php` on WordPress.
- **Four new probes in `audit.php`:** a path that cannot exist (soft 404), the other side of the www, `xmlrpc.php`
  on WordPress, and the sitemap fetched rather than merely asked about. Side requests now share a 12-second budget
  and get a 4-second timeout each, so a slow site cannot make the visitor wait through eleven of them. The SSRF
  guards are unchanged: every probe still goes through `check_url` and the pinned-address path.
- **The score curve was retuned, not the thresholds.** Twenty-three mostly-minor findings would have dragged a
  well-built site from 95 to the fifties on the old weights. Small notes now cost 1 instead of 2 and the softener
  went from 45 to 60; criticals (18) and warnings (7) are unchanged. On the fixtures: a healthy bilingual site 95, a
  tired WordPress site 27, a neglected one 22. The "healthy" recommendation threshold moved 85 → 80 to match.
  **This does not answer the open question below about where the numbers come from — it only keeps the curve honest
  against a longer list of checks.**
- **Screenshots of the result now have their own script** (`scripts/screens-audit.mjs`), because `screens.mjs` only
  photographs pages and the report only exists after a scan. It writes `audit-report--390/1280.png` plus the
  generated `audit-full-report.html` and a full-page picture of it, all from a fixed fixture.

TODO(angelique): the thresholds in these checks are ours, not anyone's published standard — title 65 characters,
description 165, thin content under 300 words, fewer than 5 internal links, more than 6 stylesheets. They are
defensible but they are judgement calls, and they belong in the same conversation as the score itself.


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
- **The site check ends in a decision, not a wall.** The page shows the score, what it detected and every urgent
  finding, then a "Need help with this?" block carrying the recommendation and two ways forward: get a quote, or get
  the full report. Warnings and small notes are not on the page at all — they are in the downloadable report, so the
  visitor reads a short list and decides rather than scrolling twenty findings.
- **The full report is a file, gated by an email, and following up is opt-in.** The report is generated in the
  browser as one self-contained HTML file (no fonts, no scripts, prints cleanly) and downloads immediately on
  submit — the visitor gets what they were promised whatever happens next. The address is kept, and a single
  unticked checkbox, "I'd like Angelique to follow up about these findings", decides whether anyone contacts them;
  the hint under it says so plainly. Both the purpose and the follow-up choice are recorded as the consent text, and
  the follow-up choice is written into the lead itself, so nobody has to guess later. Affects: §11, Law 25.
- **Site-check leads go to HubSpot, not to `process-lead`.** A site check is a contact with a report attached, not a
  quoted project. Sending it through the chat's pipeline would have forced an invented `estimated_quote` onto the
  record, and the MAW admin sorts leads by that figure — a report request would have outranked real quotes. It uses
  the HubSpot form already wired for the question form, with the findings in the message field.
  `TODO(angelique)`: this needs the same portal and form ids as the question form before it does anything.
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
