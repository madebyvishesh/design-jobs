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
- Added a portal breakdown that filters listings, grouped the headline with its timestamp, and reserved space for all three row actions when Details is open.
- Replaced the large role total and portal chart after screenshot feedback. A sentence describes the roles, totals sit beside the results, and the portal selector remains under Filters.
- Restyled the existing table and mobile listings with neutral ink, a pale results surface and rounded controls. Portal colors and the green Remote indicator still identify each listing.
- Applied the responsive content plan with three-line phone cards, independent tablet metadata stacks and fixed action space, compact desktop dates, and a collapsible overview on smaller screens.
- Simplified browsing to search and Filters, with scopes and Remote on one line. Moved feed information and Details into Filters, kept custom sorting visible and reduced repeated badge and button fills. Portal names and the desktop portal column are visible in Details.
- Combined search, filters and the wordmark in a responsive header, switched to the bundled Geist font, and grouped each listing around its role title. Added individual portal and date filter removal, a focusable return to search, and readable company initials while logos load. Tested compact and detailed listings at 16 widths from 320 to 2560 pixels in Chromium, Firefox and WebKit. Fixed initial mobile pagination overflow and narrow WebKit scrollbar overflow.
- Moved company and remote-role totals beneath the site title on initial render. The footer now owns the feed timestamp. Aligned select arrows and checkboxes, grouped browse scopes in a segmented control, and aligned desktop column labels with listing content. Checked filter and navigation geometry at 14 viewport widths in Chromium, WebKit, and Firefox.
- Compared the live Search Browser homepage and numbers section with the board. Adopted neutral ink, warm gray surfaces, rounded controls, consistent outline icons, and spacing between listings. Desktop keeps inline actions and column headings, tablet pairs the title with the employer, and phones have a compact filter button and a trailing action column. Touch controls retain 44px targets. Replaced the full-page theme animation with immediate switching and local press feedback.
- Simplified compact phone listings to title, employer, location and Save. The title opens the application. Details adds the date, portal, Copy and Apply. Grouped tablet columns by role/employer and location/date, and unified control and panel radii. Replaced the button-like brand mark with a wordmark, placed counts beside the results, aligned tab text and column text, and separated first-row hover from the header. Restored an interruptible sun–moon icon transition with an immediate reduced-motion state. Verified both motion settings, text alignment and touch actions.
