// Tiny pub-sub store. ~30 lines.
// Views subscribe with a selector; their callback runs only when that slice changes.

export function createStore(initial) {
  let state = initial;
  const subs = new Set();

  function get() { return state; }

  function set(patch) {
    const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
    if (next === state) return;
    const prev = state;
    state = next;
    for (const { selector, cb, lastValue } of subs) {
      const v = selector(state);
      if (!shallowEq(v, lastValue.value)) {
        lastValue.value = v;
        cb(v, selector(prev));
      }
    }
  }

  function subscribe(selector, cb) {
    const lastValue = { value: selector(state) };
    const entry = { selector, cb, lastValue };
    subs.add(entry);
    cb(lastValue.value, undefined);
    return () => subs.delete(entry);
  }

  return { get, set, subscribe };
}

function shallowEq(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a), bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) if (a[k] !== b[k]) return false;
    return true;
  }
  return false;
}
