# circular-require-detector

Scans an in-memory module graph for import cycles and reports the chain of dependencies involved. You hand it a list of modules — each an `{ id, requires }` pair — and it returns every cycle as an array of ids.

## Usage

```js
import { detectCycles, listEdges } from 'circular-require-detector';

const modules = [
  { id: 'auth', requires: ['db'] },
  { id: 'db',   requires: ['config'] },
  { id: 'config', requires: ['auth'] }, // back to auth
];

const cycles = detectCycles(modules);
// => [['config', 'auth', 'db', 'config']]
//      target ____/        \____ source

// Optionally restrict to cycles reachable from a set of entrypoints:
detectCycles(modules, { entrypoints: ['config'] });

// For debugging the graph itself:
listEdges(modules);
// => { auth: ['db'], db: ['config'], config: ['auth'] }
```

## Why

Circular dependencies in a codebase usually aren't fatal — most bundlers and runtimes tolerate them — but they make initialization order fragile and debugging painful. This library exists to take a graph you've already extracted from your source (by parsing `import`/`require`, reading a manifest, or instrumenting a loader) and answer one question: *which modules form a loop, and in what order?*

The trade-off: we work on an explicit, already-built graph rather than parsing files ourselves. That keeps the library zero-dependency and lets it sit at whatever stage of your pipeline is most convenient, but it means you have to produce the `{ id, requires }` list. It's a one-time cost per analysis run.

## Edge cases worth knowing

- **Self-imports** (`a` requires `a`) are reported as a one-element cycle `['a', 'a']`. This is deliberate: a module that imports itself is the smallest possible loop and hiding it would surprise anyone chasing init-order bugs.
- **Unknown targets** in `requires` become leaf nodes with no outgoing edges. They're kept in the graph so the reported chains stay legible, but they never form a cycle on their own.
- The same cycle is reported once, regardless of how many entrypoints reach it. Rotation order is normalized internally; the returned chain starts at whichever node the DFS first entered, so callers can still see "who pulled the trigger."

## Running the tests

```
node --test
```
