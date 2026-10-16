/**
 * Core cycle detection over an in-memory module graph.
 *
 * Design notes:
 *
 * - We use an explicit stack rather than recursion because real-world module
 *   graphs can be thousands deep and JS engines still have call-stack limits.
 * - A node's `state` distinguishes "in progress" from "done" so we can detect
 *   the back edge that forms a cycle and then materialize the chain by
 *   walking the explicit stack.
 * - Self-imports (`a` requires `a`) are reported as a one-element cycle.
 *   This is the smallest possible cycle and pretending it isn't one would
 *   surprise anyone debugging init order problems.
 */

/**
 * @typedef {{ id: string, requires: string[] }} Module
 */

const WHITE = 0; // unseen
const GRAY = 1;  // on the current DFS stack
const BLACK = 2; // fully explored

/**
 * @param {Module[]} modules
 * @param {string[]|undefined} entrypoints
 * @returns {{ cycles: string[][], edges: Record<string, string[]> }}
 */
export function analyze(modules, entrypoints) {
  const byId = new Map();
  const order = [];

  for (const m of modules) {
    if (!byId.has(m.id)) {
      byId.set(m.id, { id: m.id, requires: [] });
      order.push(m.id);
    }
    const node = byId.get(m.id);
    for (const r of m.requires) {
      node.requires.push(r);
      if (!byId.has(r)) {
        byId.set(r, { id: r, requires: [] });
        order.push(r);
      }
    }
  }

  const ids = order;
  const requires = new Map();
  for (const id of ids) {
    requires.set(id, byId.get(id).requires.slice());
  }

  const roots =
    entrypoints && entrypoints.length > 0
      ? entrypoints
      : ids;

  const state = new Map();
  const cycles = [];
  const seen = new Set();

  /**
   * Visit using an explicit stack so we can report the chain that closes the
   * cycle without relying on call-stack depth.
   */
  function visit(start) {
    const stack = [];
    const iters = new Map();

    stack.push(start);
    state.set(start, GRAY);
    iters.set(start, 0);

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const neighbors = requires.get(top) || [];
      const idx = iters.get(top);

      if (idx < neighbors.length) {
        iters.set(top, idx + 1);
        const nb = neighbors[idx];

        const s = state.get(nb);
        if (s === undefined) {
          stack.push(nb);
          state.set(nb, GRAY);
          iters.set(nb, 0);
        } else if (s === GRAY) {
          // Back edge. Reconstruct the cycle as [target, ..., source],
          // where source === top and target === nb.
          let startIdx = -1;
          for (let i = 0; i < stack.length; i++) {
            if (stack[i] === nb) {
              startIdx = i;
              break;
            }
          }
          const cyc = stack.slice(startIdx).concat([nb]);
          if (startIdx === -1) {
            // nb is not on the stack; this is a cross edge to a completed
            // subgraph, not a cycle. Ignore it.
            continue;
          }
          const key = cycleKey(cyc);
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push(cyc);
          }
        }
        // BLACK: already fully explored; skip.
      } else {
        state.set(top, BLACK);
        stack.pop();
      }
    }
  }

  for (const r of roots) {
    if (byId.has(r) && state.get(r) === undefined) {
      visit(r);
    }
  }

  cycles.sort((a, b) => {
    const la = a.length;
    const lb = b.length;
    if (la !== lb) return la - lb;
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    }
    return 0;
  });

  const edges = {};
  for (const id of ids) {
    edges[id] = (requires.get(id) || []).slice().sort();
  }

  return { cycles, edges };
}

/**
 * Normalize a cycle so the same loop in different rotation orders compares
 * equal. We rotate so the lexicographically smallest id is first, then drop
 * the duplicated last element.
 */
function cycleKey(cycle) {
  if (cycle.length <= 1) return cycle.join('\u0000');
  const body = cycle.slice(0, -1);
  let minIdx = 0;
  for (let i = 1; i < body.length; i++) {
    if (body[i] < body[minIdx]) minIdx = i;
  }
  const rotated = body.slice(minIdx).concat(body.slice(0, minIdx));
  return rotated.join('\u0000');
}
