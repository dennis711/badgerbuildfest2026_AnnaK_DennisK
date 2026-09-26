import test from 'node:test';
import assert from 'node:assert/strict';
import {filterEvents, visibleConnections, walletEvents, distanceMiles, rankForYou, parseLocal} from './logic.js';
import {buildDemoEvents, connections, user} from './data.js';
import {esc, safeUrl} from './escape.js';

const today = new Date(2026, 8, 26);
const events = buildDemoEvents(today);
const day = date => ({from: date, to: date, mode: 'For you', interests: [], friends: false});

test('a day shows only events that overlap it', () => {
  assert.equal(filterEvents(events, day(today), connections, 'anna').length, 9); // includes the Saturday-window demo events
  assert.equal(filterEvents(events, day(new Date(2027, 1, 1)), connections, 'anna').length, 0);
});

test('a week range includes every day of the week', () => {
  const week = {...day(new Date(2026, 8, 21)), to: new Date(2026, 8, 27)};
  assert.equal(filterEvents(events, week, connections, 'anna').length, 14);
});

test('late events remain discoverable across midnight and cancellations are excluded', () => {
  const night = {...events[0], id: 'night', start: new Date(2026, 8, 25, 23).getTime(), end: new Date(2026, 8, 26, 2).getTime()};
  const cancelled = {...night, id: 'cancelled', status: 'cancelled'};
  assert.deepEqual(filterEvents([night, cancelled], day(today), connections, 'anna').map(e => e.id), ['night']);
});

test('mode and interests intersect', () => {
  const result = filterEvents(events, {...day(today), mode: 'Professional', interests: ['Design']}, connections, 'anna');
  assert.deepEqual(result.map(e => e.title), ['Design After Hours']);
});

test('private attendance never qualifies as a visible connection', () => {
  const hidden = connections.map(c => ({...c, visibleTo: []}));
  assert.equal(visibleConnections(events[0], hidden, 'anna').length, 0);
  assert.equal(filterEvents(events, {...day(today), friends: true}, hidden, 'anna').length, 0);
  assert.equal(filterEvents(events, {...day(today), friends: true}, connections, 'anna').length, 6);
});

test('For You ranks personal matches first and ended events last', () => {
  const now = new Date(2026, 8, 26, 12).getTime();
  const ranked = rankForYou(filterEvents(events, day(today), connections, 'anna'), {user, connections, location: {lat: 43.0773, lng: -89.3892}, now});
  assert.ok(ranked.at(-1).end <= now);
  assert.ok(user.interests.includes(ranked[0].interest));
});

test('wallet moves ended plans to private history independently of map time', () => {
  const now = new Date(2026, 8, 26, 12).getTime();
  const result = walletEvents(events, new Set(['event-0', 'event-1', 'event-3']), new Set(), now);
  assert.deepEqual(result.history.map(e => e.id), ['event-0']);
  assert.deepEqual(result.upcoming.map(e => e.id), ['event-1', 'event-3']);
});

test('cancelled plans require acknowledgement and remain in private history', () => {
  const event = {...events[0], status: 'cancelled'};
  const before = walletEvents([event], new Set([event.id]), new Set(), 0);
  assert.equal(before.cancelled.length, 1);
  const after = walletEvents([event], new Set([event.id]), new Set([event.id]), 0);
  assert.equal(after.history.length, 1);
});

test('distance is stable and symmetric', () => {
  assert.equal(distanceMiles(events[0], events[0]), 0);
  assert.equal(distanceMiles(events[0], events[1]), distanceMiles(events[1], events[0]));
});

test('AI times are read as local wall-clock time', () => {
  assert.equal(parseLocal('2026-09-26T19:30'), new Date(2026, 8, 26, 19, 30).getTime());
});

test('scraped text is escaped and only web links survive', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://example.com'), 'https://example.com');
});
