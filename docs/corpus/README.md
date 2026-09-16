# Corpus — real websites the checker is replayed against

Snapshots of real sites, in exactly the shape `sites/createawebsite-ca/public/api/audit.php` returns. They are
committed so `pnpm test` replays real pages on every change, with no network.

This exists because the engine shipped several confident false statements — a patched WordPress reported as
3.7.1, an all-French bakery accused under Bill 96, ordinary footer links called broken mixed content — and
every one of them survived because nothing had ever run the engine over a page we had not written ourselves.

## Filling it

On any machine with an internet connection (a laptop is fine — this does not need SiteGround, PHP, or
anything deployed):

```
node scripts/audit-capture.mjs boulangerie-example.ca clinique-example.qc.ca
node scripts/audit-capture.mjs --from docs/corpus-sites.txt
```

Then read what it says about them, and commit the ones that are fair to keep:

```
node scripts/run-tests.mjs corpus                        # the frequency table
node scripts/audit-corpus.mjs --verbose                  # every finding, site by site
node scripts/audit-corpus.mjs --id lang.frenchMissing    # who trips one check, and why
```

## What to aim for

40–60 sites that look like the audience: small Quebec businesses, mostly WordPress, a mix of French-only,
English-only and bilingual, some on Wix or Squarespace, some behind Cloudflare, a few plainly neglected and a
few genuinely well built. **The well-built ones matter most** — they are the only way a false positive shows
itself.

## Reading the result

The frequency table is the point. A `critical` that fires on most of the corpus is either describing a real
epidemic or is broken, and one look at the sites it names usually settles which. A check that fires on nothing
is not proven harmless, only untested.

## Before you commit a snapshot

These are other people's websites. A snapshot holds their home page HTML and response headers as any visitor
or search engine would see them — nothing private, nothing behind a login — but check anyway that nothing
personal came along in the markup, and prefer businesses MAW has a relationship with or whose sites are
plainly public-facing.
