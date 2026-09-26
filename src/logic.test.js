import test from 'node:test';
import assert from 'node:assert/strict';
import {filterEvents,visibleConnections,walletEvents,distanceMiles} from './logic.js';
import {events,connections} from './data.js';
const query={date:new Date(2026,8,26),hour:null,mode:'All',interests:[],friends:false};
test('date windows include the right events and empty future dates',()=>{assert.equal(filterEvents(events,query,connections,'anna').length,6);assert.equal(filterEvents(events,{...query,date:new Date(2027,1,1)},connections,'anna').length,0);});
test('hour windows include ongoing events and exclude ended events',()=>{const results=filterEvents(events,{...query,hour:10},connections,'anna');assert.deepEqual(results.map(e=>e.id),['event-0','event-4']);assert.equal(filterEvents(events,{...query,hour:12},connections,'anna').length,0);});
test('mode and interests intersect',()=>{assert.deepEqual(filterEvents(events,{...query,mode:'Professional',interests:['Design']},connections,'anna').map(e=>e.id),['event-1']);});
test('private attendance never qualifies as a visible connection',()=>{const hidden=connections.map(c=>({...c,visibleTo:[]}));assert.equal(visibleConnections(events[0],hidden,'anna').length,0);assert.equal(filterEvents(events,{...query,friends:true},hidden,'anna').length,0);assert.equal(filterEvents(events,{...query,friends:true},connections,'anna').length,4);});
test('late events remain discoverable across midnight and cancellations are excluded',()=>{
  const night={...events[0],id:'night',start:new Date(2026,8,25,23).getTime(),end:new Date(2026,8,26,2).getTime()};
  const cancelled={...night,id:'cancelled',status:'cancelled'};
  assert.deepEqual(filterEvents([night,cancelled],{...query,hour:0},connections,'anna').map(e=>e.id),['night']);
  assert.equal(filterEvents([night],{...query,hour:2},connections,'anna').length,0);
});
test('wallet moves ended plans to private history independently of map time',()=>{
  const now=new Date(2026,8,26,12).getTime();
  const result=walletEvents(events,new Set(['event-0','event-1','event-3']),new Set(),now);
  assert.deepEqual(result.history.map(e=>e.id),['event-0']);
  assert.deepEqual(result.upcoming.map(e=>e.id),['event-1','event-3']);
});
test('cancelled plans require acknowledgement and remain in private history',()=>{
  const event={...events[0],status:'cancelled'};
  const before=walletEvents([event],new Set([event.id]),new Set(),0);
  assert.equal(before.cancelled.length,1);assert.equal(before.upcoming.length,0);
  const after=walletEvents([event],new Set([event.id]),new Set([event.id]),0);
  assert.equal(after.cancelled.length,0);assert.equal(after.history.length,1);
});
test('distance is stable and symmetric',()=>{
  assert.equal(distanceMiles(events[0],events[0]),0);
  assert.ok(distanceMiles(events[0],events[1])>0);
  assert.equal(distanceMiles(events[0],events[1]),distanceMiles(events[1],events[0]));
});
