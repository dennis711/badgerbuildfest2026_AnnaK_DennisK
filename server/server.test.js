import test from 'node:test';
import assert from 'node:assert/strict';
import {extractJson, finalText} from './claude.js';
import {simulatePersonas, clusterIntents} from './proposals.js';

test('JSON is extracted from fenced or chatty answers', () => {
  assert.deepEqual(extractJson('```json\n{"events":[]}\n```'), {events: []});
  assert.deepEqual(extractJson('Here you go: {"city":"Madison","events":[{"name":"A"}]} Enjoy!'), {city: 'Madison', events: [{name: 'A'}]});
});

test('only the text after the last web search counts as the answer', () => {
  const response = {content: [
    {type: 'text', text: 'Let me search.'},
    {type: 'server_tool_use', id: '1'},
    {type: 'web_search_tool_result', tool_use_id: '1', content: []},
    {type: 'text', text: '{"events":'}, {type: 'text', text: '[]}'},
  ]};
  assert.equal(finalText(response), '{"events":[]}');
});

test('interest clusters are varied and deterministic', () => {
  const center = {lat: 43.07, lng: -89.39};
  const a = clusterIntents(simulatePersonas(center)), b = clusterIntents(simulatePersonas(center));
  assert.deepEqual(a.map(g => g.members.length), b.map(g => g.members.length));
  assert.equal(new Set(a.map(g => g.activity)).size, a.length);
});
