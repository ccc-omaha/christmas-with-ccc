# Christmas with CCC

Live site: https://christmaswithccc.com

## Editing
Staff edit at https://app.pagescms.org → `cccomaha/christmas-with-ccc`.
The sidebar follows the page from top to bottom:

1. Service times (enter once; cards, calendar buttons, invite options and Google event listings update automatically)
2. Top of page and story
3. What to expect
4. Photo gallery
5. Watch online
6. FAQ
7. Invite
8. Closing (Bethlehem)
9. Links, sharing and Google

Hand-written text that mentions times (FAQ answers, Google description,
text-a-friend message, social preview graphics) needs updating by hand.

Formatting in text fields: `*italic*` and `[link text](https://...)`.
Photos: keep uploads under 2 MB; larger ones are shrunk automatically.

## How it builds
Netlify runs `npm run build` (see `netlify.toml`), which fills the
templates in `src/` with `content/*.json` and writes the site to `dist/`.
Static files (images, the Quest game) live in `public/` and are copied as-is.

## Link previews
One link works everywhere. `netlify/edge-functions/social-preview.js`
serves the wide share graphic to social crawlers (Facebook, LinkedIn, X,
Slack...) and the tall 4:5 graphic to iMessage, Android texting and everyone
else. No need to share /share anymore.

## Live bar
While the YouTube channel in section 5 is live, a bar with a tassel appears
across the top of the page; clicking it slides down the stream. The page asks
`/api/live` (`netlify/functions/live.mjs`) once a minute, but only from 5 minutes before
to 75 minutes after each Christmas service and each weekly stream time. Netlify caches that
answer for 60 seconds, so YouTube is checked about once a minute in total.
Test it any time with `https://christmaswithccc.com/?live=` plus a YouTube video ID or link.
Turn it off in Pages CMS: 5. Watch online → Live bar on.
