# Out There

Project for **badgerbuildfest2026_AnnaK_DennisK** — BadgerBuildFest 2026 Repository.

A mobile-first, map-first social discovery prototype for Anna in Madison. No backend, accounts, messages, or public people browsing.

## Run

Requires Node.js 20 or later. No install step or API key needed.

```sh
node server.mjs
```

Open http://localhost:5173. Run checks with `node --test`.

## Structure

- `src/app.js`: app shell, map adapter, reusable event rows/cards, filters, timeline, and navigation.
- `src/data.js`: separate mock users, connections, hosts, and events.
- `src/logic.js`: time, interest, mode, and privacy filtering.
- `src/icons.js`: consistent inline SVG icons.
- `src/styles.css`: responsive layouts and centralized semantic color tokens, with a future dark-theme token override.
- `public/vendor`: locally bundled Leaflet 1.9.4 (BSD-2-Clause).
- `server.mjs`: dependency-free local static server.

## Demo behavior

The demo clock is fixed at September 26, 2026, 8 AM. Dates use the browser's local timezone for a consistent mock wall clock; production should use the event's America/Chicago timezone. Browse indefinitely using the week arrows. The hour slider shows events overlapping a three-hour window. Here & now restores the demo clock and requests the user's location, falling back to Madison if unavailable.

Save and Join are independent and persist in localStorage. My Events reflects both. Joining again leaves the event. External ticket actions are explicitly mocked. Share copies a local event deep link; it is not a published public page. All hosts, ratings, capacity, and attendance are fictional. Only mutually connected people whose attendance is visible to Anna are counted. Other navigation destinations are intentionally lightweight placeholders.

Map tiles come from OpenStreetMap and require internet access. Their standard map has labels and points of interest; a CSS desaturation treatment keeps it visually quiet. Follow the OpenStreetMap tile usage policy before deploying to broad production traffic: https://operations.osmfoundation.org/policies/tiles/. Typography uses Google Fonts with a system fallback.

No dark-mode switch is exposed in this iteration. The tokens prepare the UI for it; map tiles would also need a matching dark style.
