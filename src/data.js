// Demo content: partner (sponsored) and verified-host events around Madison.
// Dates are relative to "today" so the demo always has something happening.
// Real events come from the AI scraper (see server/event-scraper.js).

export const user = {id: 'anna', name: 'Anna', avatar: '/public/anna.svg', interests: ['Design', 'Wellness', 'Sport', 'Food', 'Art', 'Tech']};
export const recommendationProfile = {userId: 'anna', topics: ['design', 'wellness', 'yoga', 'running', 'food', 'art', 'health tech'], defaultMode: 'For you'};
export const demoLocation = {lat: 43.0773, lng: -89.3892, isDemo: true, city: 'Madison'};
// People Anna has met in person. `interests` lets the concierge find plans
// that fit two people ("Sarah and I have Saturday afternoon free").
export const connections = [
  {id: 'sarah', name: 'Sarah', visibleTo: ['anna'], interests: ['Art', 'Outdoor', 'Food', 'Wellness']},
  {id: 'julia', name: 'Julia', visibleTo: ['anna'], interests: ['Sport', 'Outdoor', 'Food']},
  {id: 'sofia', name: 'Sofia', visibleTo: ['anna'], interests: ['Wellness', 'Design', 'Art']},
  {id: 'ryan', name: 'Ryan', visibleTo: ['anna'], interests: ['Tech', 'Sport', 'Music']},
];

// kind: partner = pays to be shown (sponsored), host = verified community host.
export const hosts = [
  ['run', 'Madison Run Club', 'host', 4.9], ['design', 'Monona Design Collective', 'host', 4.7],
  ['clay', 'Midwest Clay Studio', 'host', 4.8], ['founder', 'StartingBlock Madison', 'partner', 4.6],
  ['yoga', 'Good Space Studio', 'host', 4.9], ['art', 'Madison Museum of Contemporary Art', 'partner', 4.8],
  ['jazz', 'The Robin Room', 'partner', 4.5], ['tech', 'UW Health Innovation', 'host', 4.4],
  ['dinner', 'The Neighborhood Table', 'host', 4.8], ['pilates', 'Form & Field', 'host', 4.3],
  ['paddle', 'Monona Paddle Co.', 'partner', 4.7], ['boulder', 'Boulders Climbing Gym', 'host', 4.8],
  ['sketch', 'Drawn Together Madison', 'host', 4.6], ['market', 'Northside Night Market', 'host', 4.5],
].map(([id, name, kind, rating]) => ({id, name, kind, verified: true, rating}));

// [hostId, title, interest, dayOffset, hour, hours, lat, lng, venue, description, attendees, spots, price]
const rows = [
  ['run', 'Saturday Morning Run', 'Sport', 0, 9, 2, 43.083, -89.382, 'James Madison Park', 'Morning 5K, lakeside air, and coffee after. Come as you are. All paces welcome.', ['julia', 'ryan'], 12, 0],
  ['design', 'Design After Hours', 'Design', 0, 18, 3, 43.074, -89.39, 'Garver Studio Downtown', 'Good ideas start with a conversation. An easy evening for designers, makers, and curious minds.', ['sofia'], 18, 0],
  ['clay', 'Ceramics & Wine', 'Art', 0, 15, 2, 43.079, -89.373, 'Midwest Clay Studio', 'Slow down and make something with your hands. Clay, tools, and a glass of wine included.', ['julia'], 6, 35],
  ['founder', 'Founder Breakfast', 'Tech', 1, 9, 2, 43.077, -89.367, 'StartingBlock Madison', 'Coffee, breakfast, and honest conversations about building something new.', ['ryan'], 10, 0],
  ['yoga', 'Outdoor Yoga', 'Wellness', 0, 10, 1, 43.071, -89.401, 'Brittingham Park', 'A gentle flow by the water. Bring your mat and leave a little lighter.', ['sofia'], null, 0],
  ['art', 'Gallery Opening', 'Culture', 0, 17, 3, 43.0748, -89.393, 'MMoCA · State Street', 'A new perspective on familiar places. Meet local artists over an evening of contemporary art.', [], null, 0],
  ['jazz', 'Live Jazz Session', 'Music', 0, 21, 2, 43.083, -89.374, 'The Robin Room', 'An intimate late-night set from Madison’s local jazz scene.', [], null, 18],
  ['tech', 'Health Tech Meetup', 'Tech', 2, 18, 2, 43.071, -89.41, 'Discovery Building', 'People working toward healthier futures. Short talks, thoughtful conversations, and new connections.', ['ryan'], 24, 0],
  ['dinner', 'Community Dinner', 'Food', 1, 18, 3, 43.087, -89.36, 'The Neighborhood Table', 'One long table. Seasonal food. A few new faces. Pull up a chair.', ['julia', 'sofia'], 8, 25],
  ['pilates', 'Pilates Social', 'Wellness', 1, 11, 2, 43.067, -89.397, 'Form & Field Studio', 'A feel-good class followed by coffee around the corner. Beginners very welcome.', [], 9, 15],
  ['run', 'Lakeside Sunday Walk', 'Outdoor', 1, 15, 2, 43.083, -89.382, 'James Madison Park', 'A little fresh air and unhurried conversation along Lake Mendota.', ['julia'], null, 0],
  ['design', 'Open Studio Evening', 'Design', 3, 18, 2, 43.074, -89.39, 'Monona Design Collective', 'Step inside local creative studios and meet the people behind the work.', [], 20, 0],
  ['boulder', 'Intro to Bouldering', 'Sport', 1, 17, 2, 43.0985, -89.3235, 'Boulders Climbing Gym', 'Shoes, chalk and a friendly coach. Your first climb is on us.', ['julia'], 10, 20],
  ['market', 'Night Market & Street Food', 'Food', 2, 18, 3, 43.0893, -89.3677, 'Tenney Park Lot', 'Dumplings, tacos, live music and long tables under string lights.', ['sarah'], null, 0],
  ['run', 'Sunrise Lakeshore Run', 'Sport', 2, 7, 1, 43.0762, -89.4125, 'Lakeshore Path', 'An easy 6K at sunrise along Lake Mendota. Coffee after, no one left behind.', ['julia'], 20, 0],
  ['sketch', 'Sketch & Coffee', 'Design', 4, 9, 2, 43.0754, -89.3893, 'Capitol Square', 'Bring a pencil. We draw the square and then talk over coffee.', ['sofia'], 14, 0],
  // "Saturday afternoon window" content for the advanced concierge moment
  ['clay', 'Outdoor Ceramics Pop-Up', 'Art', 'sat', 17, 2, 43.0536, -89.3862, 'Olin Park Pavilion', 'Wheels outside by the lake. Throw a bowl, glaze it, pick it up next week. Beginners welcome.', ['sarah'], 12, 18],
  ['paddle', 'Sunset Paddle on Monona', 'Outdoor', 'sat', 16, 2, 43.0659, -89.3669, 'Olbrich Boat Launch', 'Guided stand-up paddle at golden hour. Boards and vests included.', [], 16, 25],
  ['sketch', 'Rooftop Sketch Session', 'Design', 'sat', 16, 2, 43.0731, -89.3827, 'Graduate Hotel Rooftop', 'Draw the skyline with a small, friendly group. Paper provided.', ['sofia'], 18, 0],
];

// Next Saturday that still has an afternoon left (the demo's free window).
export function windowSaturday(today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (days === 0 && today.getHours() >= 16 ? 7 : days));
  return d;
}

export function buildDemoEvents(today = new Date()) {
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  const saturday = Math.round((windowSaturday(today) - new Date(y, m, d)) / 86400000);
  return rows.map(([hostId, title, interest, offset, hour, hours, lat, lng, venue, description, attendees, spots, price], i) => {
    const dayOffset = offset === 'sat' ? saturday : offset;
    const host = hosts.find(h => h.id === hostId);
    return {
      id: 'event-' + i, hostId, host, source: host.kind, sponsored: host.kind === 'partner',
      title, interest, start: new Date(y, m, d + dayOffset, hour).getTime(), end: new Date(y, m, d + dayOffset, hour + hours).getTime(),
      lat, lng, venue, description, attendees, spots, price,
      mode: ['design', 'founder', 'tech'].includes(hostId) ? 'Professional' : 'Social',
      external: hostId === 'jazz', age: /wine/i.test(title) || hostId === 'jazz' ? 21 : null,
      status: 'published', tags: [],
      outdoor: interest === 'Outdoor' || /park|lake|path|pavilion|launch|lot|square|rooftop/i.test(venue),
      requirements: hostId === 'run' ? 'All paces welcome · Comfortable running shoes' : hostId === 'yoga' ? 'All levels · Bring your own mat' : null,
      cover: hostId === 'yoga' ? {src: '/public/park-cover.svg', alt: 'Illustrated lakeside park and walking path'} : null,
    };
  });
}
