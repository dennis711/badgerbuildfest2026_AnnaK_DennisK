import {parseLocal, isoDay} from './logic.js';

// One pool for all four ways an event reaches the map:
//   partner   – organisers who pay to be shown (sponsored)
//   host      – verified community hosts
//   ai        – found on the web by the AI event scraper
//   community – created by the Event-Creator agent from matching interests
export function createEventStore(demoEvents) {
  const events = new Map(demoEvents.map(e => [e.id, e]));
  const ranges = new Map(); // "from|to" → {status, count, city, error}
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => fn());

  function fromAi(raw) {
    const start = parseLocal(raw.start);
    const end = raw.end ? parseLocal(raw.end) : start + 2 * 3600e3;
    return {
      ...raw,
      start, end: end > start ? end : start + 2 * 3600e3,
      host: {id: null, name: raw.organizer, kind: 'ai', verified: false, rating: null},
      price: raw.price, spots: raw.capacity, attendees: [], status: 'published',
      external: false, sponsored: false, age: null, requirements: null, cover: null,
    };
  }

  async function loadRange(from, to, location, {refresh = false} = {}) {
    const key = `${isoDay(from)}|${isoDay(to)}|${location.lat.toFixed(2)},${location.lng.toFixed(2)}`;
    const existing = ranges.get(key);
    if (!refresh && existing && existing.status !== 'error') return existing;
    const entry = {status: 'loading', from: isoDay(from), to: isoDay(to), count: 0};
    ranges.set(key, entry);
    emit();
    try {
      const params = new URLSearchParams({lat: location.lat, lng: location.lng, from: entry.from, to: entry.to, ...(refresh ? {refresh: '1'} : {})});
      const response = await fetch(`/api/events?${params}`);
      const body = await response.json();
      if (!response.ok) throw Object.assign(new Error(body.error || 'Request failed'), {code: body.code});
      for (const raw of body.events) events.set(raw.id, fromAi(raw));
      Object.assign(entry, {status: 'done', count: body.events.length, city: body.city, cached: !!body.cached, fetchedAt: body.fetchedAt});
    } catch (error) {
      Object.assign(entry, {status: 'error', error: error.message, code: error.code || 'failed'});
    }
    emit();
    return entry;
  }

  return {
    all: () => [...events.values()],
    get: id => events.get(id),
    add(event) { events.set(event.id, event); emit(); },
    loadRange,
    ranges: () => [...ranges.values()],
    loading: () => [...ranges.values()].some(r => r.status === 'loading'),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
