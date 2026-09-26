# UI refinement verification

> Recorded for the previous UI iteration (before the Day/Week/Month scrubber and the AI event scraper).

Verified locally in the browser with the dependency-free Node server.

- Viewports: 375 × 667, 390 × 844, 430 × 932, and desktop.
- No horizontal page overflow at the three mobile sizes.
- Event cards retain a 12px gap above navigation; navigation retains approximately 16px bottom clearance in the browser viewport. CSS adds device safe-area insets. This is viewport simulation, not a physical iOS device test.
- MapLibre basemap loads without a paid key or runtime errors. Leaflet markers and the vector map stay aligned after resizing.
- Day-scale dragging moves under a fixed indicator. Future dates default to All day. Keyboard hour refinement updates pins; empty periods do not jump to another time.
- Social/Professional and interests intersect independently. Shared-connections filtering excludes other attendance. Reset restores the personalized Social default without unexpectedly changing time.
- Preview excludes the description. The handle supports tap/drag to Full and swipe down to Preview. Horizontal swipes change the marker and event, with finite bounds.
- Optional local cover illustration and no-image layouts both tested. Full event content scrolls independently of the sticky action and floating navigation.
- Join confirms immediately. Leave requires confirmation. Save stays independent. Both survive navigation and reload using the original storage key.
- Events orders Upcoming chronologically and keeps Saved separate. AI, Connections, and profile navigation work.
- Automated tests additionally cover private History, cancellation acknowledgement, overnight time windows, and distance calculations.

Demo limitations: fixed September 26 clock; illustrative profile/cover assets; mocked tickets, reporting, and host profiles; local-only share URLs. No backend or AI event generation.
