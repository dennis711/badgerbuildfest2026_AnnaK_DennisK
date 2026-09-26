export function visibleConnections(event, connections, userId) {
  return connections.filter(c => event.attendees.includes(c.id) && c.visibleTo.includes(userId));
}

export function filterEvents(events, {date, hour, mode, interests, friends}, connections, userId) {
  const start = new Date(date).setHours(hour ?? 0, 0, 0, 0);
  const end = new Date(date).setHours(hour === null ? 24 : hour + 3, 0, 0, 0);
  return events.filter(e => e.status !== 'cancelled' && e.start < end && e.end > start
    && (mode === 'All' || e.mode === mode)
    && (!interests.length || interests.includes(e.interest))
    && (!friends || visibleConnections(e, connections, userId).length > 0));
}

export function walletEvents(events, joined, acknowledged, now) {
  const privateEvents = events.filter(e => joined.has(e.id));
  const cancelled = privateEvents.filter(e => e.status === 'cancelled' && !acknowledged.has(e.id));
  const upcoming = privateEvents.filter(e => e.end > now && e.status !== 'cancelled').sort((a,b) => a.start-b.start);
  const history = privateEvents.filter(e => e.status === 'cancelled' ? acknowledged.has(e.id) : e.end <= now).sort((a,b) => b.start-a.start);
  return {upcoming, cancelled, history};
}

export function distanceMiles(a, b) {
  const radians = n => n * Math.PI / 180;
  const lat = radians(b.lat-a.lat), lng = radians(b.lng-a.lng);
  const h = Math.sin(lat/2)**2 + Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(lng/2)**2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
