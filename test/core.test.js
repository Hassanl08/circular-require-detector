import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectCycles, listEdges } from '../src/index.js';

function mod(id, requires = []) {
  return { id, requires };
}

function cyc(arr) {
  // Helper: the detector returns [target, ..., source, target].
  return arr.concat([arr[0]]);
}

function extract(cycles) {
  // Drop the duplicated closing node so tests can compare the chain body.
  return cycles.map((c) => c.slice(0, -1));
}

test('returns empty array when there are no cycles', () => {
  const ms = [mod('a', ['b']), mod('b', ['c']), mod('c', [])];
  assert.deepEqual(detectCycles(ms), []);
});

test('detects a simple two-node cycle', () => {
  const ms = [mod('a', ['b']), mod('b', ['a'])];
  assert.deepEqual(extract(detectCycles(ms)), [['a', 'b']]);
});

test('detects a three-node cycle', () => {
  const ms = [mod('a', ['b']), mod('b', ['c']), mod('c', ['a'])];
  assert.deepEqual(extract(detectCycles(ms)), [['a', 'b', 'c']]);
});

test('detects a self-import as a one-element cycle', () => {
  const ms = [mod('a', ['a'])];
  assert.deepEqual(extract(detectCycles(ms)), [['a']]);
});

test('detects multiple distinct cycles', () => {
  const ms = [
    mod('a', ['b']),
    mod('b', ['a']),
    mod('c', ['d']),
    mod('d', ['c']),
  ];
  assert.deepEqual(extract(detectCycles(ms)), [
    ['a', 'b'],
    ['c', 'd'],
  ]);
});

test('does not treat shared leaves as cycles', () => {
  const ms = [
    mod('a', ['util']),
    mod('b', ['util']),
    mod('util', []),
  ];
  assert.deepEqual(detectCycles(ms), []);
});

test('reports only cycles reachable from given entrypoints', () => {
  const ms = [
    mod('a', ['b']),
    mod('b', ['a']),
    mod('x', ['y']),
    mod('y', ['x']),
  ];
  const got = detectCycles(ms, { entrypoints: ['x'] });
  assert.deepEqual(extract(got), [['x', 'y']]);
});

test('ignores entrypoints that are not in the graph', () => {
  const ms = [mod('a', ['b']), mod('b', ['a'])];
  const got = detectCycles(ms, { entrypoints: ['ghost'] });
  assert.deepEqual(got, []);
});

test('deduplicates the same cycle discovered from two entries', () => {
  const ms = [mod('a', ['b']), mod('b', ['a'])];
  const got = detectCycles(ms, { entrypoints: ['a', 'b'] });
  assert.equal(got.length, 1);
});

test('listEdges returns the dependency map', () => {
  const ms = [
    mod('a', ['b', 'c']),
    mod('b', ['a']),
    mod('c', []),
  ];
  assert.deepEqual(listEdges(ms), {
    a: ['b', 'c'],
    b: ['a'],
    c: [],
  });
});

test('handles modules that require unknown targets', () => {
  const ms = [mod('a', ['missing'])];
  // missing becomes a node with no outgoing edges; no cycle is formed.
  assert.deepEqual(detectCycles(ms), []);
  assert.deepEqual(listEdges(ms), {
    a: ['missing'],
    missing: [],
  });
});
