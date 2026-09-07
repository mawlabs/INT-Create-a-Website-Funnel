# createawebsite.ca — build brief

Status: v1 · 7 Sept 2026 · Owner: Angelique Roussos (Monkeys at Work / MAW Labs) · Repo: `maw-landers` (this is the first site in it)

## 0. Read this first

**What this is.** A static, bilingual (EN / FR-CA) single-page funnel site at `createawebsite.ca` that (1) shows honest price ranges for getting a website built, (2) sends warm visitors into Monkeys at Work's existing quote chat on `monkeysat.work`, and (3) captures the rest with a short form into HubSpot. It is a MAW Labs funnel bet, effort "S" (days), shipped in one batch week alongside two sister landers built from the same kit.

**What it is not.** Not a product, not a blog, not a CMS, not a redesign of monkeysat.work, not a chat embed. Do not add anything that is not in §2.

**Order of work.** §3 repo skeleton → §8 kit (tokens, fonts, components) → §5 home page → §7 conversion + tracking → §6 guide page → §10 SEO/technical → §11 privacy → §12 deploy → §14 definition of done. After each section, screenshot at 390 px and 1280 px into `docs/screens/`.

**When the brief is silent**, pick the simplest option that keeps Lighthouse ≥ 95 and record it in `docs/DECISIONS.md`. **When the brief needs a fact only Angelique has** (§13), leave `TODO(angelique): …` in the code and in `docs/DECISIONS.md`. Never invent prices, promises, testimonials, timelines or legal text.

## 1. Goal, audience, gate

- **Goal:** turn "I need a website, where do I start?" searchers into quote-chat starts and HubSpot leads, attributed to this domain.
- **Audience:** owners of small businesses in Quebec and the rest of Canada, mostly on a phone, comparing a DIY builder against hiring someone. Many are francophone.
- **Positioning:** the sincere guide, not the salesperson. Public price ranges, a real price in minutes, and "we'll say so if a DIY builder is the better call." Visibly run by Monkeys at Work.
- **Primary conversion:** click-through into the MAW quote chat with the project type pre-selected.
- **Secondary conversion:** the "Still deciding?" form → HubSpot.
- **Gate (90 days after launch):** ≥ 300 organic sessions/month, or ≥ 5 quote-chat starts, or 1 qualified lead → keep publishing one guide a month. Below that, stop content and let the domain sit. Tracking in §7 exists to make this measurable.

## 2. Scope

**In (batch week):**
1. The `lander-kit` shared package (tokens, fonts, layout, components, SEO/schema helpers, consent, form handler).
2. `createawebsite.ca` home page, EN + FR.
3. One cornerstone guide, EN + FR (separately written, not translated).
4. Privacy page, thank-you page, 404 — EN + FR.
5. HubSpot form via the Forms API (no HubSpot script).
6. GA4 with consent, Search Console, sitemap, robots, `llms.txt`, JSON-LD.
7. GitHub Actions deploy to SiteGround.
8. `sites/wphandyman-ca` scaffold only (workspace entry + config, `deploy: false`, nothing published).

**Out:** on-domain chat embed, industry pages, more guides, CMS, newsletter, cookie-based A/B tests, animations beyond §8.5, Tailwind or any UI kit, any framework runtime on the client.

## 3. Repo and stack

```
maw-landers/
  CLAUDE.md
  docs/
    createawebsite-brief.md      ← this file
    DECISIONS.md                 ← Claude Code keeps this
    screens/
  packages/
    lander-kit/
      assets/                    ← logo SVGs (see §13), og templates
      fonts/                     ← Satoshi-Bold, IBMPlexSans-Regular/SemiBold (subset woff2)
      styles/tokens.css          ← the design system (§8.1)
      styles/base.css            ← reset, type scale, focus, reduced-motion
      components/                ← Astro components (§8.6)
      lib/                       ← seo.ts (meta + hreflang), schema.ts (JSON-LD), hubspot.ts, analytics.ts, i18n.ts
  sites/
    createawebsite-ca/
      astro.config.mjs
      src/pages/                 ← index.astro, guides/[...slug].astro, privacy.astro, thanks.astro, 404.astro (+ fr/)
      src/content/guides/{en,fr}/
      src/i18n/{en,fr}.json      ← every UI string, meta title/description, FAQ, form copy
      src/data/pricing.ts        ← §5.3 table + hero reveal data, single source of truth
      public/                    ← robots.txt, llms.txt, .htaccess, favicon set
    wphandyman-ca/               ← scaffold only
  sites.json                     ← [{ name, domain, docroot, deploy }]
  .github/workflows/ci.yml       ← build + astro check + Lighthouse CI on PRs
  .github/workflows/deploy.yml   ← matrix over sites.json where deploy: true
```

- **Stack:** Astro (latest stable, static output), TypeScript, pnpm workspaces, current Node LTS. Plain CSS with custom properties — no Tailwind, no component library. Vanilla TS for the three interactive islands (hero reveal, form, consent). `astro:assets` for images. `@astrojs/sitemap` with i18n.
- **i18n:** Astro built-in — `defaultLocale: "en"`, `locales: ["en", "fr"]`, `prefixDefaultLocale: false`. EN at `/`, FR at `/fr/`. `<html lang="en-CA">` / `lang="fr-CA"`. All strings from `src/i18n/*.json`; no hard-coded copy in components.
- **Content:** guides as content collections with a `lang` field; FR and EN guides are separate documents linked by a shared `pairKey` for hreflang.
- **Env:** `PUBLIC_SITE_URL`, `PUBLIC_GA4_ID`, `PUBLIC_HUBSPOT_PORTAL_ID`, `PUBLIC_HUBSPOT_FORM_EN`, `PUBLIC_HUBSPOT_FORM_FR`, `PUBLIC_GSC_VERIFICATION`. These are public identifiers, not secrets. Real secrets (SSH) live only in GitHub Actions.

## 4. Routes

| EN | FR | Page |
|---|---|---|
| `/` | `/fr/` | Home (§5) |
| `/guides/how-much-does-a-website-cost-canada` | `/fr/guides/combien-coute-un-site-web-quebec` | Cornerstone guide (§6) |
| `/privacy` | `/fr/confidentialite` | Privacy policy (§11) |
| `/thanks` | `/fr/merci` | Form success (GA4 conversion) |
| `/404` | `/fr/404` | Not found (Apache `ErrorDocument`, language by path prefix) |
| `/sitemap-index.xml`, `/robots.txt`, `/llms.txt` | — | Generated / static |

Language switch is a link to the same page in the other locale (never a redirect based on `Accept-Language`). Show a one-line "Ce site est aussi en français" / "This site is also in English" bar on first visit when the browser language differs; dismiss in `localStorage`.

## 5. Home page spec

Wireframe (desktop ≥ 960 px left, mobile right). Content left-aligned throughout; max content width 72 rem; measure ≤ 68 ch.

```
┌───────────────────────────────────────────────┐   ┌──────────────────┐
│ [MONKEYS at.work]  createawebsite.ca   EN | FR│   │ logo      EN | FR│
│ ───────── thin Perfect Sunset rule ───────────│   │ ──────────────── │
│                                               │   │ H1               │
│ H1 (two lines)              ┌──────────────┐  │   │ sub              │
│ sub (≤ 55 words)            │ What do you  │  │   │ ┌──────────────┐ │
│                             │ need?        │  │   │ │ What do you  │ │
│                             │ ( ) business │  │   │ │ need?        │ │
│                             │ ( ) store    │  │   │ │ tiles        │ │
│                             │ ( ) redesign │  │   │ │ reveal panel │ │
│                             │ ( ) fix      │  │   │ │ [Get my exact│ │
│                             │ ( ) custom   │  │   │ │  range]      │ │
│                             │ reveal panel │  │   │ └──────────────┘ │
│                             │ [CTA]        │  │   │ Do you need us?  │
│                             └──────────────┘  │   │ (stacked table)  │
├───────────────────────────────────────────────┤   │ …                │
│ Do you need us?  (3-column comparison table)  │   └──────────────────┘
├───────────────────────────────────────────────┤
│ What things cost  (pricing tables)            │
├───────────────────────────────────────────────┤
│ How it works  (1 · 2 · 3 — a real sequence)   │
├───────────────────────────────────────────────┤
│ Work we've shipped  (3 case studies + quotes) │
├───────────────────────────────────────────────┤
│ Questions  (native <details> FAQ)             │
├───────────────────────────────────────────────┤
│ Still deciding?  (form)                       │
├───────────────────────────────────────────────┤
│ footer: icon mark · run by Monkeys at Work    │
└───────────────────────────────────────────────┘
```

All copy below is EN v1 — use it as written. FR: draft in Quebec French following §9.2, mark each FR string `<!-- FR-REVIEW -->` in the JSON (as a `_review: true` flag), and never ship FR without Angelique's pass.

### 5.1 Header
Full wordmark (link to `/`), the domain name in Satoshi Bold beside it, EN | FR switch right. Thin Perfect Sunset rule under the header (brand pattern). Sticky on desktop only; never sticky on mobile.

### 5.2 Hero — the one memorable thing
The hero *is* the first question of the MAW quote chat, made tangible. Spend the design boldness here and nowhere else.

- **H1:** A real price for a real website, in about three minutes.
- **Sub:** Pick what you need and we'll show you what it usually costs. Want an exact range? Our quote chat asks about ten questions and gives you one — no sales call, and the final quote won't go above it. If a DIY builder is the better call for you, we'll say so.
- **Panel heading:** What do you need?
- **Tiles** (native `<input type="radio">` in a `<fieldset>`, styled as large tappable rows; no selection by default):

| Tile label | Reveal text (CAD) | `project` param |
|---|---|---|
| A website for my business | Most business sites land between $2,500 and $6,000 (30–70 hours). Fully custom builds run $6,000–$10,000+. | `business` |
| An online store | Shopify stores $2,500–$8,000, WooCommerce $3,000–$8,000 (30–95 hours). Big custom stores go higher. | `ecommerce` |
| A redesign of my current site | A visual refresh $3,500–$5,000. A full redesign $5,500–$8,500. Changing platform too, $7,000–$12,000+. | `redesign` |
| A fix or an update | Quick fixes and updates $85–$680 (1–8 hours). | `changes` |
| A custom app or integration | Starts with a paid discovery phase, $375–$750 (5–10 hours). The build quote comes after that. | `custom` |

- **Reveal panel:** `aria-live="polite"`; before any selection it reads "Pick one to see a typical range." After selection: the reveal text, then the CTA. 150 ms opacity crossfade only; none under `prefers-reduced-motion`.
- **CTA (primary button):** Get my exact range → link built per §7.1 with the selected `project`. Small text under it: Opens our quote chat on monkeysat.work.
- **Caption under the panel:** Ballpark ranges in Canadian dollars. The chat narrows it to your project; the final quote stays within the range it gives you.
- Fires `price_reveal` (§7.3) on selection.

Data for tiles and tables lives in `src/data/pricing.ts` — one source of truth, rendered into both.

### 5.3 Do you need us?
- **H2:** Do you need us?
- **Intro:** Sometimes the answer is no. Here's how the three ways to get a website compare.
- A real `<table>` on desktop; on mobile, each column becomes a stacked block with row labels repeated (not cards).

| | DIY builder (Wix, Squarespace, Shopify theme) | Freelancer | Monkeys at Work |
|---|---|---|---|
| Cost | $20–$60 a month, plus your evenings | $1,000–$4,000 typical `TODO(angelique): confirm` | $2,500–$10,000+ (ranges below) |
| Time to first version | A weekend to a few weeks | 3–8 weeks `TODO(angelique): confirm` | 4–10 weeks `TODO(angelique): confirm` |
| Who does the work | You | One person | A team: design, development, content, QA |
| Best when | A simple site, a tight budget, and you like tinkering | A small site with a clear brief | Bilingual, e-commerce, custom features, or a site your revenue depends on |
| Watch out for | Templates look like templates; French, SEO and integrations are on you; subscriptions add up over years | Availability, hand-off, and who fixes it in a year | Not the cheapest option — and we'll say so if you don't need us |

- **Two short lists under the table:**
  - *You probably don't need us if* — you want a one-page site for a hobby or side project and you're fine with a builder · you have no online sales, no custom features and no need for French and English · you'd rather spend time than money right now.
  - *You probably do if* — the site has to earn its keep (sales, bookings, leads) · you're in Quebec and it has to work properly in both languages · it needs to connect to something (payments, CRM, booking, inventory).

### 5.4 What things cost
- **H2:** What things cost
- **Intro:** Real ranges, in Canadian dollars, from our rate of $85 an hour. Most agencies won't publish these. We think you should see them before you talk to anyone. `TODO(angelique): confirm publishing the hourly rate.`
- Tables use the brand data-table pattern (Power Blue header row, white Satoshi Bold header text, white body rows). One table per group, tiers as rows: Price · Hours · What's included.

**Websites (WordPress with ACF or Elementor)** — Basic $2,500–$3,500, 30–40 h, custom design from components, 5–10 pages, basic forms · Intermediate $4,000–$6,000, 45–70 h, custom design plus custom functions and relations, CMS, enhanced features · Fully custom $6,000–$10,000+, 70–120 h+, discovery phase, complex integrations, advanced functionality.

**Online stores — Shopify** — Basic $2,500–$4,000, 30–50 h, purchased theme, on-brand styling, up to 50 products · Intermediate $4,500–$8,000, 55–95 h, custom templates within the theme, hard-coded customizations · Fully custom $8,000–$15,000+, 95–180 h+, custom theme, complex checkout, app integrations.

**Online stores — WooCommerce** — Basic $3,000–$4,500, 35–55 h, ACF/Elementor design, standard WooCommerce, up to 50 products · Intermediate $5,000–$8,000, 60–95 h, custom product types, tailored checkout, shipping and tax rules · Fully custom $8,000–$18,000+, 95–210 h+, B2B/wholesale, subscriptions, ERP integrations.

**Redesigns** — Refresh (UI only) $3,500–$5,000, 40–60 h, new design on the existing structure · Full redesign $5,500–$8,500, 65–100 h, new structure, content restructuring, SEO · Platform migration + redesign $7,000–$12,000+, 80–140 h+, new platform, data migration, redirects.

**Custom apps, plugins, dashboards** — Discovery phase $375–$750, 5–10 h, a full plan and roadmap · Build: quoted after discovery.

**Quick fixes and updates** — $85–$680, 1–8 h.

**After launch — maintenance plans at $75 an hour** — Light $750–$1,350 a month, 10–18 h · Standard $1,350–$2,250, 18–30 h · Premium $2,250–$3,750+, 30–50 h+.

- **Line under the tables:** Ranges cover the typical scope. The quote chat narrows them to your project in about three minutes. [Get my exact range]

### 5.5 How it works
A genuine three-step sequence, so numbering is appropriate here (and only here).
- **H2:** How it works
1. **Answer about ten questions** in the quote chat: what you're building, platform, pages, languages, integrations, timeline.
2. **Get a price range on the spot,** with the hours split across design, development, content, and testing and launch.
3. **Angelique confirms the exact amount with you.** The final quote stays within the range you were given.

### 5.6 Work we've shipped
- **H2:** Work we've shipped
- Three case studies: image, client, one sentence on the job, one on the result, link to the case study on monkeysat.work. `TODO(angelique): pick the three (see §13) — do not fabricate.`
- Two testimonials as plain blockquotes with name and business. `TODO(angelique): text and permission.`

### 5.7 Questions (FAQ)
Native `<details>`/`<summary>`; first item open. Rendered as `FAQPage` JSON-LD (§10.3).

1. **How much does a website cost?** Most business sites cost $2,500–$6,000; stores and custom builds more. The full ranges are above, and the guide *How much does a website cost in Canada* walks through what moves the number.
2. **How long does it take?** Most business sites take 4 to 8 weeks from kickoff; stores and custom builds longer. The chat gives you a timeline with your quote. `TODO(angelique): confirm.`
3. **Does my Quebec website need to be in French?** If you do business in Quebec, yes: your site has to be available in French, at least as prominently as any other language (the Charter of the French Language, updated by Bill 96). We build in both languages by default, and the French is written, not machine-translated.
4. **Is the price from the chat binding?** It's a range, not a final quote. Angelique confirms the exact amount after a short conversation, and it won't exceed the range you were shown.
5. **Who owns the site when it's done?** You do — code, design, content and accounts in your name. `TODO(angelique): confirm against the T&C wording.`
6. **What do you build on?** WordPress (with ACF or Elementor), Shopify, WooCommerce, or fully custom code when the project calls for it. We recommend the one that fits, not the one that pays us the most.
7. **What happens after launch?** Run it yourself — we hand over with training — or put it on a maintenance plan (Light, Standard or Premium; ranges above).
8. **Do you work with businesses outside Quebec?** Yes, across Canada, in English or French. `TODO(angelique): confirm.`

### 5.8 Still deciding? (form)
- **H2:** Still deciding?
- **Intro:** Tell us what you're trying to build and we'll answer by email — no call unless you ask for one.
- Fields: Name · Email · What are you trying to build? (textarea) · consent checkbox (§11 text) · button **Send my question**.
- Success → `/thanks`: **Got it.** Angelique reads every one of these and replies within one business day. `TODO(angelique): confirm the reply-time promise.`
- Errors are specific and in the interface voice: "Enter an email address so we can reply." Never a generic "Something went wrong" without the next step.

### 5.9 Footer
Icon mark left. Line: createawebsite.ca is run by Monkeys at Work, a web studio in Quebec. Links: monkeysat.work · Portfolio · Book a call (`https://meetings.hubspot.com/ange1`) · Privacy · EN/FR. No social icons, no newsletter.

## 6. Cornerstone guide

- **EN:** *How much does a website cost in Canada in 2026?* (`/guides/how-much-does-a-website-cost-canada`) · 1,200–1,600 words.
- **FR:** *Combien coûte un site web au Québec en 2026?* (`/fr/guides/combien-coute-un-site-web-quebec`) — written for Quebec, not a translation; same structure, Quebec examples, `FR-REVIEW`.
- Outline: 60-word answer with the headline ranges → what moves the price (pages, custom vs. theme, e-commerce, integrations, two languages, who writes the content) → DIY vs. freelancer vs. studio (reuse §5.3 data) → costs people forget (domain, hosting, maintenance, apps/plugins, translation, photography) → how to get a real number in three minutes (CTA per §7.1 with `project` omitted) → four FAQ items reused from §5.7.
- Same voice as the home page. Prices from `src/data/pricing.ts`; never retype numbers. `Article` JSON-LD, author Angelique Roussos, publisher Monkeys at Work, `dateModified` from frontmatter.

## 7. Conversion and tracking

### 7.1 Primary CTA — link into the MAW quote chat
Every "Get my exact range" button links to:

```
https://monkeysat.work/?chat=open&project={business|ecommerce|redesign|changes|custom}&lang={en|fr}
  &utm_source=createawebsite.ca&utm_medium=funnel&utm_campaign=lander-{en|fr}&utm_content={section}
```

`section` ∈ `hero`, `pricing`, `guide`. Omit `project` when nothing is selected. Open in the same tab. No JavaScript needed for the link itself; the hero island only rewrites the `project` value.

**Dependency in the MAW app repo (not this repo) — do it first, ~2–3 h, owner Karim or Hamza:**
1. `ChatContext` / `ChatWidget`: on load, read `chat=open` → open the widget; `project` → skip to the new-project flow with that project type answered; `lang` → set the i18next language.
2. Persist `utm_*` from the landing URL in `sessionStorage`; `useChat` passes them to `process-lead`; add a nullable `source jsonb` column on `leads` by migration; write a HubSpot custom contact + deal property `maw_lead_source` (create it in HubSpot) so the domain shows up in reports.
3. Until that ships the link still works (the visitor opens the chat by hand), but attribution and pre-selection don't — so test the full path before launch day.

### 7.2 Secondary — HubSpot form without the HubSpot script
- Native `<form>`; on submit, POST JSON to `https://api.hsforms.com/submissions/v3/integration/submit/{PUBLIC_HUBSPOT_PORTAL_ID}/{form guid for the locale}` with `fields` (`email`, `firstname`, `message`), `context` (`pageUri`, `pageName`, `hutk` cookie if present — only present after consent) and `legalConsentOptions` carrying the §11 consent text.
- Spam: honeypot field + reject submissions under 3 seconds after page load (mirrors `useSpamProtection` in the MAW app). No CAPTCHA.
- No-JS fallback: the Forms API needs JavaScript, so inside `<noscript>` replace the form with one line and the address `support@monkeysat.work` (the public address the MAW chat already shows).
- Success redirects to `/thanks` (or `/fr/merci`).

### 7.3 Analytics
- GA4 (`PUBLIC_GA4_ID`) loaded **only after** analytics consent (§11). Events: `price_reveal {project}`, `cta_click {project, section, lang}`, `form_submit {lang}` (fired from the thanks page), `lang_switch`. Mark `cta_click` and `form_submit` as conversions in GA4. `TODO(angelique): GA4 property + measurement ID.`
- Google Search Console: verify via `PUBLIC_GSC_VERIFICATION` meta tag; submit the sitemap. `TODO(angelique): access.`
- Swap-in alternative if the banner proves too costly for conversion: a cookieless analytics script (no consent needed) — a one-line change in `analytics.ts`. Decision for after the 90-day gate, not now.

## 8. Design system

Brand palette and type are fixed. Everything else below is a deliberate choice for this brief — follow it, and do not fall back to generic "AI landing page" defaults (see §8.5).

### 8.1 Tokens (`packages/lander-kit/styles/tokens.css`)

```css
:root {
  --maw-power-blue: #264653;
  --maw-perfect-sunset: #E76F51;
  --maw-pacific-sea: #2A9D8F;
  --maw-charcoal: #36393E;
  --maw-not-exactly-white: #F7FBFE;
  --maw-deep-warmth: #F4A261;

  --color-bg: var(--maw-not-exactly-white);       /* page background — never pure white */
  --color-surface: #FFFFFF;                        /* table body cells and form fields only */
  --color-text: var(--maw-charcoal);
  --color-heading: var(--maw-power-blue);
  --color-accent: var(--maw-perfect-sunset);
  --color-secondary: var(--maw-pacific-sea);
  --color-rule: color-mix(in srgb, var(--maw-power-blue) 18%, transparent);
  --color-focus: var(--maw-power-blue);

  --font-heading: "Satoshi", system-ui, sans-serif;
  --font-body: "IBM Plex Sans", system-ui, sans-serif;

  /* fluid type scale, ratio 1.25 (mobile) → 1.333 (desktop) */
  --step--1: clamp(0.94rem, 0.90rem + 0.20vw, 1.00rem);
  --step-0:  clamp(1.06rem, 1.00rem + 0.30vw, 1.19rem);   /* body: 17 → 19 px */
  --step-1:  clamp(1.33rem, 1.20rem + 0.60vw, 1.58rem);
  --step-2:  clamp(1.66rem, 1.45rem + 1.00vw, 2.11rem);
  --step-3:  clamp(2.07rem, 1.70rem + 1.70vw, 2.81rem);
  --step-4:  clamp(2.59rem, 2.00rem + 2.70vw, 3.75rem);   /* H1 */

  --measure: 68ch;
  --content-max: 72rem;
  --space-1: 0.5rem; --space-2: 1rem; --space-3: 1.5rem; --space-4: 2.5rem; --space-5: 4rem; --space-6: 6.5rem;
  --radius: 6px;                                    /* one radius, everywhere it is used */
}
```

### 8.2 Type
- Satoshi Bold for H1–H3, the domain wordmark, button labels and table headers. Tight leading (1.05–1.15), letter-spacing −0.01em on H1 only.
- IBM Plex Sans Regular for body, SemiBold for row labels and `<summary>`. Body leading 1.55. Line length ≤ 68 ch.
- Self-host both as subset woff2 (latin + latin-ext — French accents), `font-display: swap`, preload Satoshi Bold and Plex Regular only. Satoshi via Fontshare (ITF free license), IBM Plex Sans (OFL).
- Sentence case everywhere. No all-caps labels, no eyebrow labels, no single coloured word inside a headline.

### 8.3 Colour rules (contrast checked against the page background)
- Power Blue on background ≈ 9.7:1 — headings, links (underlined), row labels. Charcoal ≈ 11:1 — body.
- Perfect Sunset on background ≈ 2.97:1 — **never a text colour**. Use it as: the primary button fill, the header rule, the hero reveal panel's left border, `<summary>` markers, and the selected-tile indicator. Nothing else.
- Primary button: Sunset fill, **Power Blue label** in Satoshi Bold ≥ 20 px (≈ 3.3:1, passes AA for large text); hover `color-mix(in srgb, var(--maw-perfect-sunset) 88%, var(--maw-charcoal))`; focus ring 3 px Power Blue, offset 2 px.
- Pacific Sea on background ≈ 3.2:1 — large text only (≥ 24 px or ≥ 19 px bold): H3 sub-labels and the "Best when" row highlight. Also link hover colour (underline stays).
- Deep Warmth: not used on this site.
- Pure white only inside table cells and inputs; the page is always Not Exactly White.

### 8.4 Layout
- Left-aligned, single column, generous vertical rhythm (`--space-5` between sections, `--space-6` above and below the hero). No section backgrounds alternating in colour; sections are separated by whitespace and one thin `--color-rule` line.
- Hero: two columns from 960 px (copy 7/12, panel 5/12); stacked on mobile with the panel directly under the sub.
- Tables are tables. On mobile, `.stack` transforms each column into a block with the row label as a `<dt>` — no horizontal scrolling, no cards.
- Motion: the reveal crossfade in §5.2 and `<details>` open/close. Nothing on scroll, nothing on page load, no hover lifts.

### 8.5 Not this (generic defaults to avoid)
Rounded cards with the same shadow on everything · gradient washes · tracked-out uppercase eyebrows above headings · numbered markers on content that isn't a sequence · "→" appended to buttons and links · scroll-triggered fade-ups · a tinted near-black background · a monospace face for small labels · emoji or icon rows to decorate features · stock-photo hero.

### 8.6 Components (`packages/lander-kit/components/`)
`Header`, `Footer`, `LangBar`, `Hero` (with `PriceReveal` island), `CompareTable`, `PricingTable`, `Steps`, `CaseStudies`, `Faq`, `LeadForm` (island), `ConsentBanner` (island), `Seo` (meta + hreflang + OG), `JsonLd`. Each takes locale strings via props; none contains copy.

### 8.7 OG images
`og-en.png` and `og-fr.png`, 1200×630: Not Exactly White background, wordmark top-left, the H1 in Power Blue Satoshi Bold, thin Sunset rule. Generate from an SVG template at build time (`sharp`) so the sister landers reuse it.

## 9. Content and voice

### 9.1 English
Sincere, plain, a touch irreverent. Short sentences, active voice, sentence case. Say what things cost and what happens next. No "elevate / unlock / seamless / cutting-edge", no exclamation marks in body text, no jargon a shop owner wouldn't use. Buttons name the action ("Get my exact range", "Send my question"); the same action keeps the same name through the flow.

### 9.2 French (Quebec)
Written for Quebec readers, not translated line by line. `vous`. "site web" (not "site internet"), "courriel", "infolettre", "boutique en ligne", "fourchette de prix". Currency: `2 500 $` — narrow no-break space (U+202F) as thousands separator and before the `$`; ranges as `2 500 $ à 6 000 $`. Dates: `7 septembre 2026`. Every FR string carries `_review: true` until Angelique clears it; the build prints a count of un-reviewed FR strings and CI fails on `main` if it is non-zero.

Seed lines (review): H1 « Un vrai prix pour un vrai site web, en trois minutes. » · CTA « Obtenir ma fourchette exacte » · form button « Envoyer ma question » · panel heading « De quoi avez-vous besoin? »

## 10. SEO and technical

### 10.1 Targets
Do not chase "create a website" — the head term belongs to the DIY builders and an exact-match domain carries no ranking weight. Win on intent + geography + French.

| Page | EN primary / secondary | FR primary / secondary |
|---|---|---|
| Home | hire someone to build my website · website design cost Canada · web design Quebec / Montreal | créer un site web pour mon entreprise · faire faire un site web Québec · agence web Québec prix |
| Guide | how much does a website cost in Canada · website cost small business · web design pricing Canada | combien coûte un site web au Québec · prix site web entreprise · coût création site web 2026 |

Pull monkeysat.work's Search Console queries before writing the guide and fold in any that already rank (`TODO(angelique): export`).

### 10.2 Meta
- EN home title: *Create a website: real prices, honest advice — Canada* · description: *See what a website really costs in Canada, whether to DIY or hire, and get an exact price range from Monkeys at Work's quote chat in about three minutes.*
- FR home title: *Créer un site web au Québec : vrais prix, conseils honnêtes* · description: *Combien coûte vraiment un site web au Québec, quand le faire soi-même ou engager un studio, et une fourchette de prix exacte en trois minutes avec Monkeys at Work.*
- Canonical per locale; `hreflang` `en-CA`, `fr-CA`, `x-default` → EN; OG/Twitter tags with §8.7 images.

### 10.3 Structured data (JSON-LD via `schema.ts`)
`WebSite` · `Organization` for Monkeys at Work (`url` monkeysat.work, `sameAs` Instagram `monkeysat.work`, Facebook `themonkeysatwork`, LinkedIn `angeliqueroussos`) · `Service` (web design and development, `areaServed` Canada/Quebec, `offers` with `priceRange` from the data file, `provider` → Organization) · `FAQPage` on the home page · `Article` on guides · `BreadcrumbList` on guides. `LocalBusiness` only if Angelique supplies an address (§13).

### 10.4 Files
- `sitemap-index.xml` via `@astrojs/sitemap` with `i18n` locales `en-CA` / `fr-CA`.
- `robots.txt`: allow all, sitemap URL.
- `llms.txt`: what the site is, the headline ranges, the guide URLs, and the chat link — same pattern as monkeysat.work's.
- `.htaccess`: force HTTPS; canonical host (non-www → `TODO(angelique): confirm www or not`); `ErrorDocument 404 /404.html`; long cache for `/_astro/*` (immutable), short for HTML; no language redirects.

### 10.5 Performance and accessibility budgets (CI fails otherwise)
- Lighthouse mobile ≥ 95 in all four categories on every page.
- First load ≤ 300 KB transferred, zero third-party requests before consent, no framework runtime.
- WCAG 2.1 AA: skip link, visible focus, labels on every field, `aria-live` on the reveal, `<details>` for FAQ, all images with alt text in both languages, `prefers-reduced-motion` respected.

## 11. Privacy and compliance

- **Quebec Law 25:** tracking is off until the visitor accepts. `ConsentBanner` (EN/FR, small, bottom, two buttons **Accept analytics** / **Decline**, link to the privacy page); choice stored in `localStorage` for 12 months. GA4 loads only on accept.
- **Consent text under the form** (checkbox, required): *I agree that Monkeys at Work may store my details to answer this request. No newsletter, no sharing.* Sent to HubSpot in `legalConsentOptions`.
- **Privacy page** (`/privacy`, `/fr/confidentialite`): what is collected (form fields, analytics after consent), why, where it goes (HubSpot, GA4), how to withdraw, contact. `TODO(angelique): confirm against monkeysat.work's policy and name the privacy officer Law 25 requires.`
- **Bill 96 / Charter of the French Language:** the FR site is a legal requirement for a Quebec business, not an SEO extra. French must be at least as complete and prominent as English — every string, meta tag, image alt, error and email.

## 12. Deploy

- `sites.json` drives everything: `[{ "name": "createawebsite-ca", "domain": "createawebsite.ca", "docroot": "www/createawebsite.ca/public_html", "deploy": true }, { "name": "wphandyman-ca", ..., "deploy": false }]`.
- **CI (`ci.yml`) on every PR:** `pnpm install --frozen-lockfile`, `astro check`, build each site, Lighthouse CI against the built output with the §10.5 budgets, FR-review count.
- **Deploy (`deploy.yml`) on push to `main`:** matrix over sites where `deploy` is true → build → `rsync -az --delete dist/ $SG_USER@$SG_HOST:~/$DOCROOT/`. Secrets: `SG_HOST`, `SG_USER`, `SG_SSH_KEY` (SiteGround Site Tools → SSH keys). `TODO(angelique): create the site in Site Tools, enable SSH, add the deploy key, share host/user.`
- **DNS:** `createawebsite.ca` A/AAAA → SiteGround; Let's Encrypt via Site Tools. If the `.com` is also owned, 301 it to the `.ca` at the DNS/Site Tools level — never serve the same site on both.
- Preview: PR builds are uploaded as an artifact; no preview domain in batch week.

## 13. Inputs needed from Angelique (blocking items marked ●)

| # | Input | Used in | Blocking |
|---|---|---|---|
| 1 | Logo SVGs: dark wordmark + icon mark (export from the Figma Brand Guide, page node 2-2); PNG fallbacks exist in the brand kit | §5.1, §5.9, §8.7 | ● |
| 2 | HubSpot portal ID + two form GUIDs (EN, FR) with the consent field | §7.2 | ● |
| 3 | GA4 measurement ID; Search Console access | §7.3 | ● before launch |
| 4 | SiteGround: site created, SSH host/user, deploy key added, docroot path; DNS for the `.ca` (and whether the `.com` exists) | §12 | ● |
| 5 | Three case studies (which, images, one-line results) and two testimonials with permission | §5.6 | ● |
| 6 | Confirmations: publish the hourly rate; the "final quote won't exceed the range" promise on a public page; freelancer/MAW timeline cells; reply-time promise; ownership FAQ; outside-Quebec FAQ | §5.3, §5.4, §5.7, §5.8 | before launch |
| 7 | MAW app change from §7.1 scheduled with Karim or Hamza | §7.1 | before launch-day QA |
| 8 | Business address and privacy officer name (Law 25) — optional address enables `LocalBusiness` schema | §10.3, §11 | before launch |
| 9 | Search Console export from monkeysat.work (queries, last 12 months) | §10.1 | nice to have |
| 10 | FR review pass on every `_review: true` string | §9.2 | ● before launch |

## 14. Definition of done

- [ ] All routes in §4 exist in both locales; language switch and `hreflang` verified with a crawler.
- [ ] Hero reveal works with keyboard only and with a screen reader; `project` param appears in the CTA URL.
- [ ] Every "Get my exact range" opens the MAW chat with the project pre-selected, and a test lead shows `maw_lead_source = createawebsite.ca` in HubSpot.
- [ ] Form submission creates a HubSpot contact with consent recorded; honeypot and timing rejects verified.
- [ ] GA4 events fire only after consent; decline leaves zero third-party requests.
- [ ] Lighthouse mobile ≥ 95 ×4 on every page, in CI.
- [ ] No `TODO(angelique)` left in shipped copy; FR-review count is zero.
- [ ] JSON-LD validates (Rich Results test) for `FAQPage`, `Article`, `Organization`, `Service`.
- [ ] Sitemap submitted in Search Console; `robots.txt` and `llms.txt` served; `.htaccess` redirects verified (http→https, host canonical, 404).
- [ ] Screenshots at 390 px and 1280 px for every page in `docs/screens/`; `docs/DECISIONS.md` current.
- [ ] `wphandyman-ca` scaffold builds but is not deployed.

## 15. After launch

- Nothing gets added to this site until the 90-day gate (§1) is read. Draft, don't publish: *DIY vs. hiring* · *WordPress vs. Shopify vs. custom* · *Does my Quebec website need to be in French?* · "create a website for a restaurant / clinic / contractor / store" pages mapped to the `project` params.
- Things worth promoting back to MAW HQ if they work here: public pricing on monkeysat.work, this static-lander pipeline as the model for the Lovable exit, and — later, only if the lander converts — an embeddable version of the quote widget for partner and white-label sites.
