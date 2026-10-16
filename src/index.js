/**
 * Public entry point for circular-require-detector.
 *
 * We export only {@link detectCycles} and {@link listEdges}. The full
 * analyzer is not exported because it exposes a mutable, stateful API that
 * is easy to misuse; the single function form is harder to get wrong.
 */

import { analyze } from './core.js';

/**
 * Build the dependency graph from an array of source files and return every
 * cycle found, ordered by the lowest id in each cycle.
 *
 * @param {Array<{id: string, requires: string[]}>} modules - The modules to
 *   analyze. `requires` is the list of ids this module depends on. Unknown
 *   targets are kept as nodes so the chain is still legible.
 * @param {object} [options]
 * @param {string[]} [options.entrypoints] - If given, only cycles reachable
 *   from one of these ids are returned. This keeps output focused on code that
 *   is actually loaded.
 * @returns {string[][]} A list of cycles, each an array of module ids in the
 *   order they form the back edge: `[..., target, ...path, source]` where
 *   `source` requires `target`.
 */
export function detectCycles(modules, options = {}) {
  const { entrypoints } = options;
  return analyze(modules, entrypoints).cycles;
}

/**
 * Convenience accessor for the raw dependency edges after analysis. Mostly
 * useful for debugging why a cycle was or was not found.
 *
 * @param {Array<{id: string, requires: string[]}>} modules
 * @returns {Record<string, string[]>} A map of id -> sorted dependency ids.
 */
export function listEdges(modules) {
  return analyze(modules, undefined).edges;
}
