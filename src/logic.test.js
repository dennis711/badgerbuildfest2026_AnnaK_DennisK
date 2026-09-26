import test from 'node:test';
import assert from 'node:assert/strict';
import {filterEvents,visibleConnections} from './logic.js';
import {events,connections} from './data.js';
const query={date:new Date(2026,8,26),hour:null,mode:'All',interests:[],friends:false};
test('date windows include the right events and empty future dates',()=>{assert.equal(filterEvents(events,query,connections,'anna').length,6);assert.equal(filterEvents(events,{...query,date:new Date(2027,1,1)},connections,'anna').length,0);});
test('hour windows include ongoing events and exclude ended events',()=>{const results=filterEvents(events,{...query,hour:10},connections,'anna');assert.deepEqual(results.map(e=>e.id),['event-0','event-4']);assert.equal(filterEvents(events,{...query,hour:12},connections,'anna').length,0);});
test('mode and interests intersect',()=>{assert.deepEqual(filterEvents(events,{...query,mode:'Professional',interests:['Design']},connections,'anna').map(e=>e.id),['event-1']);});
test('private attendance never qualifies as a visible connection',()=>{const hidden=connections.map(c=>({...c,visibleTo:[]}));assert.equal(visibleConnections(events[0],hidden,'anna').length,0);assert.equal(filterEvents(events,{...query,friends:true},hidden,'anna').length,0);assert.equal(filterEvents(events,{...query,friends:true},connections,'anna').length,4);});
