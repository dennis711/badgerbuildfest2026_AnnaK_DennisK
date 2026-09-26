// Native shells can subscribe to these explicit interaction boundaries.
// The web prototype deliberately never calls navigator.vibrate().
export function feedback(kind) {
  window.dispatchEvent(new CustomEvent('outthere:feedback', {detail: {kind}}));
}
