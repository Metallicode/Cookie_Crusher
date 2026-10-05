# Cookie Crusher 🍪

Accept the cookie banner, read the page, crush the cookies.

## Views

- **This site**: cookies for the current tab's site. "Crush 'em" removes them all; "Crush N trackers" removes only advertising and analytics cookies, so logins and your consent choice (no banner next time) survive.
- **Recent**: cookies first seen in the last 5m / 1h / 24h / 7d, from any site, including third-party trackers.
- **All sites**: every cookie grouped by site, with search (by site, cookie name or company) and a "Trackers only" filter.
- **Settings** (gear): auto-crush, deep crush, toolbar badge and protected sites.

Every crush shows an **Undo** toast for 6 seconds that puts the cookies back exactly as they were.

## Features

- **Tracker labels**: known cookies get a colored tag. Red is advertising, purple is analytics, green is a consent choice and blue is social. The list lives in `trackers.js` and is hand-picked, not exhaustive.
- **Auto-crush**: when a site has no open tabs left, its cookies are crushed after a wait (30s / 1m / 5m / 15m). Cookies from sites you never had open in a tab (third-party trackers) are crushed on the next sweep. Leftovers from the last session are swept shortly after Chrome starts. Protected sites are never touched.
- **Deep crush**: whole-site crushes (manual or auto) also clear localStorage, IndexedDB, Cache Storage, service workers and file systems for the same domains. This part can't be undone.
- **Badge**: the toolbar icon shows the current site's cookie count, tracker count, or nothing.
- **Protected sites**: never bulk-crushed or auto-crushed, subdomains included. Single cookies there show a lock.

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick this folder (or click the reload icon on the card after updating)

## Notes

- Chrome doesn't record when a cookie was created. The background worker watches cookie changes and keeps its own log (last 7 days, max 3000 entries), so **Recent** only knows about cookies set after installing.
- Turning on auto-crush means everything that isn't open or protected is temporary. The first sweep clears cookies from every other site, so protect your logins first.
- Auto-crush can also remove cookies of third-party embeds on a page that's still open (for example a YouTube player), since that embed's site has no tab of its own.
- Grouping by site uses a small heuristic (handles `co.uk`-style suffixes), not the full public suffix list.
- Undo lives in the popup, so it's gone once the popup closes. Auto-crushes have no undo.
- Nothing leaves your browser: no network requests, no external fonts.

## Files

| File | What it does |
| --- | --- |
| `manifest.json` | MV3 manifest |
| `background.js` | Cookie log, toolbar badge, auto-crush sweeps |
| `lib.js` | Shared helpers: settings, site grouping, remove/restore, deep clean |
| `trackers.js` | Known tracker/consent cookie list and classifier |
| `popup.html/css/js` | The popup UI, crush effects and undo |
| `icons/` | Toolbar icons |
