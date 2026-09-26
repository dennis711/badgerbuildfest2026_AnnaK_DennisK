export function visibleConnections(event, connections, userId) {
  return connections.filter(c => (event.attendees || []).includes(c.id) && c.visibleTo.includes(userId));
}

const dayStart = date => new Date(date).setHours(0, 0, 0, 0);
const dayEnd = date => new Date(date).setHours(24, 0, 0, 0);

// Events overlapping the selected day / week / month (from and to are inclusive days).
export function filterEvents(events, {from, to, mode, interests, friends}, connections, userId) {
  const start = dayStart(from), end = dayEnd(to);
  return events.filter(e => e.status !== 'cancelled' && e.start < end && e.end > start
    && (mode === 'For you' || mode === 'All' || e.mode === mode)
    && (!interests.length || interests.includes(e.interest))
    && (!friends || visibleConnections(e, connections, userId).length > 0));
}

// For-You ranking: personal interests, friends going, host reputation,
// distance and a clearly labelled boost for paying partners.
export function fyScore(event, {user, connections, location, now = Date.now()}) {
  const interest = user.interests.includes(event.interest) ? 3 : 0;
  const friends = Math.min(2, visibleConnections(event, connections, user.id).length) * 1.5;
  const reputation = event.host?.rating ? (event.host.rating - 3) : 0;
  const sponsored = event.sponsored ? 1.5 : 0;
  const community = event.source === 'community' ? 1 : 0;
  const distance = location ? Math.min(3, distanceMiles(location, event) / 2) : 0;
  const ended = event.end <= now ? 10 : 0; // past events sink to the end
  return interest + friends + reputation + sponsored + community - distance - ended;
}

export function rankForYou(events, context) {
  return [...events].sort((a, b) => fyScore(b, context) - fyScore(a, context) || a.start - b.start);
}

export function walletEvents(events, joined, acknowledged, now) {
  const privateEvents = events.filter(e => joined.has(e.id));
  const cancelled = privateEvents.filter(e => e.status === 'cancelled' && !acknowledged.has(e.id));
  const upcoming = privateEvents.filter(e => e.end > now && e.status !== 'cancelled').sort((a, b) => a.start - b.start);
  const history = privateEvents.filter(e => e.status === 'cancelled' ? acknowledged.has(e.id) : e.end <= now).sort((a, b) => b.start - a.start);
  return {upcoming, cancelled, history};
}

export function distanceMiles(a, b) {
  const radians = n => n * Math.PI / 180;
  const lat = radians(b.lat - a.lat), lng = radians(b.lng - a.lng);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// "2026-09-26T19:00" from the AI → local timestamp (the phone is in the event's city).
export function parseLocal(value) {
  const [date, time = '12:00'] = value.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}

export const isoDay = date => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
