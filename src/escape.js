// Everything the AI scraped comes from the open web: always escape it
// before it goes into innerHTML, and only allow http(s) links.
const MAP = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => MAP[c]);
export const safeUrl = value => (typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null);
