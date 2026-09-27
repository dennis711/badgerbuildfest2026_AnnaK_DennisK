import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile, applyStage, rankWithRhythm, reasonsFor, learnedSignals, removeSignal, parseAsk, askLocal, MOODS} from './rhythm.js';
import {buildDemoEvents, connections, user, demoLocation} from './data.js';

const now = new Date(2026, 8, 26, 18); // Saturday evening
const events = buildDemoEvents(now);
const ctx = {user, connections, location: demoLocation, now: now.getTime()};
const day1 = {...defaultProfile(), onboarded: true, picks: ['movement', 'artdesign']};

test('"Not for me" removes the event and lowers its kind', () => {
  const event = events.find(e => e.interest === 'Design');
  const profile = {...day1, notForMe: [event.id], lessOf: {Design: 1}};
  const ranked = rankWithRhythm(events, profile, ctx);
  assert.ok(!ranked.some(e => e.id === event.id));
});

test('personalization off falls back to plain time order', () => {
  const ranked = rankWithRhythm(events, {...day1, personalization: false}, ctx);
  assert.deepEqual(ranked.map(e => e.start), [...ranked].map(e => e.start).sort((a, b) => a - b));
  assert.deepEqual(reasonsFor(events[0], {...day1, personalization: false}, ctx), []);
});

test('reasons explain an event in plain words', () => {
  const ceramics = events.find(e => e.title === 'Outdoor Ceramics Pop-Up');
  const reasons = reasonsFor(ceramics, applyStage(day1, 'later'), ctx);
  assert.ok(reasons.includes('You like art + design'));
  assert.ok(reasons.includes('Sarah is going'));
  assert.ok(reasons.some(r => /min away/.test(r)));
});

test('what Out There knows grows with the stage and can be removed', () => {
  assert.equal(learnedSignals(day1).length, 1);
  const later = applyStage(day1, 'later');
  assert.ok(learnedSignals(later).length > learnedSignals(applyStage(day1, 'week1')).length);
  const without = removeSignal(later, 'budget');
  assert.ok(!learnedSignals(without).some(s => s.id === 'budget'));
});

test('signals never sound like tracking', () => {
  const texts = learnedSignals(applyStage({...day1, outdoorPriority: true}, 'later')).map(s => s.text).join(' ');
  assert.doesNotMatch(texts, /we noticed|we tracked|we know/i);
});

test('"Sarah and I have Saturday afternoon free" finds Saturday plans that fit both', () => {
  const query = parseAsk('Sarah and I have Saturday afternoon free.', now, connections);
  assert.equal(query.people[0].name, 'Sarah');
  assert.equal(new Date(query.from).getDay(), 6);
  const {reply, events: found} = askLocal(query, events, day1, ctx);
  assert.match(reply, /both of you/);
  assert.equal(found[0].title, 'Outdoor Ceramics Pop-Up');
  assert.ok(found.every(e => new Date(e.start).getDay() === 6 && new Date(e.start).getHours() >= 12));
});

test('price and outdoor wishes are respected', () => {
  const query = parseAsk('Something outdoors under $30.', now, connections);
  assert.equal(query.maxPrice, 30);
  const {events: found} = askLocal(query, events, day1, ctx);
  assert.ok(found.length && found.every(e => e.outdoor && (e.price ?? 0) <= 30));
});

test('the Move mood keeps active things only', () => {
  const move = MOODS.find(m => m.id === 'move');
  assert.ok(events.filter(e => move.match(e)).every(e => ['Sport', 'Wellness', 'Outdoor'].includes(e.interest)));
});

import {buildFlexEvent, consensus, resolveFlex, flexMatches, nextMonday} from './flex.js';
test('the "?" canoe event lands on Monday and locks the slot most people can do', () => {
  const flex = buildFlexEvent(new Date(2026, 8, 26));
  assert.equal(new Date(flex.start).toDateString(), nextMonday(new Date(2026, 8, 26)).toDateString());
  assert.equal(consensus(flex, 'late').id, 'late');
  const done = resolveFlex(flex, 'late');
  assert.equal(done.status, 'published');
  assert.equal(new Date(done.start).getHours(), 16);
  assert.equal(new Date(done.start).getMinutes(), 30);
});
test('the "?" event only shows for outdoor or movement people', () => {
  const s = {moodId: null, interests: []};
  assert.equal(flexMatches({picks: ['food']}, s), false);
  assert.equal(flexMatches({picks: ['outdoors']}, s), true);
  assert.equal(flexMatches({picks: ['food']}, {...s, moodId: 'move'}), true);
});
