# Design Jobs project log

A public board for finding and saving design vacancies. Next.js and React serve the site on Vercel. GitHub Actions publishes job snapshots to Vercel Blob. Run locally with npm ci and npm run dev.

## Current work

26 Nov 2026 · One shared board now supports search, saving, filters and responsive browsing. Physical iPhone and screen-reader checks remain open.

## Decisions

- Retain the existing local bookmark key so readers keep saved roles.
- Keep GitHub publishing and the visit-triggered fallback. The board timestamp records the successful fetch.

## Progress

- Listings carry date provenance through deduplication. The board handles older snapshots conservatively. Added facility-role filtering for broad design titles.
- Implemented a single search and bookmark store, responsive job rows, accessible filters, accurate dates and an in-context fetch timestamp. Snapshot browser checks covered mobile and desktop search, bookmark reload, keyboard focus, date filters and pagination. On the same 591-role input, desktop markup decreased from 960,945 decoded bytes to 386,602 bytes.
- 26 Nov 2026 · Restored color-coded job portal names in the default results. Desktop rows have a dedicated Job portal column; mobile cards show the source beside the company. All contributing portals are shown for merged listings.
- Remote roles show a high-contrast green globe badge before their location in both layouts. The location still shows any geographic restrictions supplied by the employer.
- Simplified the masthead, grouped search with its filters and gave the results a quieter, divided-list layout. Portal names and remote status stay visible in both themes.
- Reworked tablet rows to pair job title and employer, shortened the introduction, labeled the details and portal controls, and kept dates and location qualifiers together.
- Control-by-control review: grouped mobile filters, aligned listing metadata independently of row actions, and restored focus after empty searches and shortlist removals.
