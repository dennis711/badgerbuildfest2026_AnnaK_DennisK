// AI-coordinated flexible event ("?"): enough people want the same thing on
// the same day, but nobody has fixed a time. Everyone who joins picks the
// window that works; 24 h before, Out There locks in the slot where most
// people are free and turns the "?" into a normal, confirmed pin.

export const FLEX_SLOTS = [
  {id: 'morning', label: 'Morning', time: '9–11 AM', start: [9, 0], end: [11, 0]},
  {id: 'afternoon', label: 'Afternoon', time: '2–4 PM', start: [14, 0], end: [16, 0]},
  {id: 'late', label: 'Late afternoon', time: '4–6 PM', start: [16, 30], end: [18, 0]},
  {id: 'any', label: 'Anytime', time: 'I’m flexible', start: null, end: null},
];

// Next Monday (today counts if it is Monday).
export function nextMonday(today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7));
  return d;
}

export function buildFlexEvent(today = new Date()) {
  const day = nextMonday(today);
  const at = (h, m = 0) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
  return {
    id: 'flex-canoe', source: 'flex', status: 'proposed', flex: true, sponsored: false,
    host: {id: null, name: 'Out There community', kind: 'community', verified: true, rating: null},
    title: 'Lake Mendota Canoe & Paddle — Community Gathering',
    interest: 'Outdoor', mode: 'Social', outdoor: true,
    // The whole possible window, so the pin shows on Monday until a time is fixed.
    start: at(9), end: at(18),
    lat: 43.0772, lng: -89.4003,
    venue: 'Hoofer Outdoor Club · Memorial Union Terrace',
    address: '800 Langdon St, Madison, WI',
    description: 'Canoes and kayaks from the Hoofers dock, an easy loop along the shore, then a drink on the Terrace. All levels welcome.',
    cost: 'Canoe rental ~$15', price: 15, spots: null,
    attendees: ['julia', 'sarah'], tags: ['#canoe', '#kayak', '#lakemendota', '#outdoors'],
    votes: {morning: 3, afternoon: 4, late: 7, any: 2},
    requirements: 'Life jackets provided · Wear clothes that can get wet',
    external: false, age: null, cover: null, timeKnown: false,
  };
}

export const interestedCount = (event, mine) =>
  Object.values(event.votes).reduce((a, b) => a + b, 0) + (mine ? 1 : 0);

// Slot with the most people free. "Anytime" counts for every real slot.
export function consensus(event, mine) {
  const votes = {...event.votes};
  if (mine) votes[mine] = (votes[mine] || 0) + 1;
  const real = FLEX_SLOTS.filter(s => s.start);
  return real.reduce((best, s) => ((votes[s.id] || 0) + (votes.any || 0) > (votes[best.id] || 0) + (votes.any || 0) ? s : best), real[0]);
}

export function resolveFlex(event, mine) {
  const slot = consensus(event, mine);
  const day = new Date(event.start);
  const at = ([h, m]) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
  return {
    ...event, status: 'published', source: 'community', flex: true, resolved: true, timeKnown: true,
    start: at(slot.start), end: at(slot.end), lockedSlot: slot.id,
  };
}

// Only surfaced to people who like being outside or on the move.
export const flexMatches = (profile, state) =>
  profile.picks.includes('outdoors') || profile.picks.includes('movement')
  || state.moodId === 'move' || state.interests.includes('Outdoor') || state.interests.includes('Sport');
