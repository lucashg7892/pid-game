import { describe, expect, it } from 'vitest';
import { createReducedMotionWatcher, type MediaQueryLike } from '../../src/render/bootstrap';

type Listener = (event: { readonly matches: boolean }) => void;

/** Requête média factice : mémorise les écouteurs et sait émettre `change`. */
function fakeQuery(matches: boolean): MediaQueryLike & {
  listeners: Set<Listener>;
  adds: number;
  removes: number;
  set(value: boolean): void;
} {
  const q = {
    matches,
    listeners: new Set<Listener>(),
    adds: 0,
    removes: 0,
    addEventListener(_type: 'change', l: Listener): void {
      q.adds += 1;
      q.listeners.add(l);
    },
    removeEventListener(_type: 'change', l: Listener): void {
      q.removes += 1;
      q.listeners.delete(l);
    },
    set(value: boolean): void {
      q.matches = value;
      for (const l of [...q.listeners]) l({ matches: value });
    },
  };
  return q;
}

describe('createReducedMotionWatcher (K22)', () => {
  it('lit la valeur initiale puis suit les changements', () => {
    const q = fakeQuery(false);
    const w = createReducedMotionWatcher(q);
    expect(w.reduced).toBe(false);
    q.set(true);
    expect(w.reduced).toBe(true);
    q.set(false);
    expect(w.reduced).toBe(false);
  });

  it('démarre à vrai si la préférence est déjà active', () => {
    expect(createReducedMotionWatcher(fakeQuery(true)).reduced).toBe(true);
  });

  it('retire son écouteur une seule fois et ne suit plus ensuite', () => {
    const q = fakeQuery(false);
    const w = createReducedMotionWatcher(q);
    expect(q.listeners.size).toBe(1);
    w.dispose();
    w.dispose();
    expect(q.listeners.size).toBe(0);
    expect([q.adds, q.removes]).toEqual([1, 1]);
    q.set(true);
    expect(w.reduced).toBe(false);
  });

  it('sans matchMedia : faux, et dispose ne lève pas', () => {
    const w = createReducedMotionWatcher(null);
    expect(w.reduced).toBe(false);
    expect(() => {
      w.dispose();
    }).not.toThrow();
  });
});
