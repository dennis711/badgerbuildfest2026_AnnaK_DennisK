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

- `src/app.js`: app shell, state coordination, filters, navigation, and persistence.
- `src/map-view.js`: existing Leaflet camera/markers with a styled vector basemap, clustering, viewport updates, and the person glyph.
- `src/time-control.js`: compact day/hour instrument with pointer, keyboard, and wheel controls.
- `src/event-card.js`: preview/full event views, finite horizontal browsing, and swipe gestures.
- `src/wallet.js`: chronological Upcoming passes, Saved, private History, and cancellation acknowledgements.
- `src/feedback.js`: haptic-ready custom events; no web vibration.
- `src/data.js`: separate mock users, connections, hosts, and events.
- `src/logic.js`: time, interest, mode, and privacy filtering.
- `src/icons.js`: consistent inline SVG icons.
- `src/styles.css`: responsive layouts and centralized semantic color tokens, with a future dark-theme token override.
- `public/vendor`: locally bundled Leaflet 1.9.4, MapLibre GL 5.6.2, the Leaflet adapter 0.1.0, their licenses, and the OpenFreeMap Liberty base style.
- `public/anna.svg`, `public/park-cover.svg`: local illustrated demo assets; no photo downloads or external UI fonts.
- `server.mjs`: dependency-free local static server.

## Demo behavior

The demo clock is fixed at September 26, 2026, 8 AM. Dates use the browser's local timezone for a consistent mock wall clock; production should use the event's America/Chicago timezone. The default is personalized Social discovery during the next three hours. Mode and interests remain independent.

Tap the compact time control to explore. Drag its scale beneath the fixed indicator, or focus the slider and use arrow keys. Days have no fixed forward limit. Choosing another day selects All day; switch to Time to select a three-hour window. The dial collapses after inactivity or when panning the map. Empty periods remain empty. Here & now restores the demo clock and requests location, falling back to Madison when unavailable.

Tap an event marker to open Preview. Drag the handle up for Full event, down to return, and down again to close. Explicit buttons provide keyboard equivalents. Swipe horizontally to browse the finite set of events nearby when the card opened. The camera moves only enough to keep the selected marker in the visible map area. Map panning automatically refreshes the viewport's markers.

Save and Join are independent and persist in the existing `out-there-anna` localStorage record. Events reflects both. Joining is immediate; leaving requires confirmation. Upcoming is chronological and excludes ended events using the attendance clock, not the date explored on the map. Ended joins remain in private History. Cancelled joins show an acknowledgement notice in Events, then move to History. Cancellation behavior is model-ready and covered by fixtures in tests; no fake cancellation is triggered in the UI.

External tickets, host pages, and Report are explicitly mocked. Sharing uses the native share sheet when available, otherwise clipboard copy. Local event links open the event directly; they are not published public pages. Directions opens an external routing page. All hosts, ratings, capacity, attendance, and demo location are fictional. Only connections who share attendance with Anna are exposed. Connections, AI, and the profile remain intentionally lightweight placeholders.

`recommendationProfile` keeps future intent, availability, routines, and followed-host inputs separate from event data. No AI plans, demand aggregation, or generated events are implemented. `outthere:feedback` events expose `day-boundary`, `hour-boundary`, `event-change`, `joined`, and `recenter` hooks for a future native shell.

The basemap uses [OpenFreeMap](https://openfreemap.org/quick_start/) vector tiles through the [MapLibre Leaflet adapter](https://github.com/maplibre/maplibre-gl-leaflet). Commercial POIs, shields, and 3D buildings are removed; street labels appear progressively, while water and parks keep their colors. Map data/glyphs require internet access, but no API key. A standard OpenStreetMap raster fallback is available if vector setup fails. Its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) applies. The UI uses Helvetica Neue / Helvetica / Arial / system sans-serif, without external font requests.

No dark-mode switch is exposed. Semantic tokens prepare the UI; the vector map would also need matching dark paint values.

## Verification

Run `node --test` (or `node --test --test-isolation=none` where subprocesses are restricted). Tests cover privacy, time boundaries including overnight events, mode/interest intersections, cancellation acknowledgement, wallet lifecycle, and distances. Browser verification is recorded in `QA.md`.
