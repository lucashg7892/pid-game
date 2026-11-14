import { describe, expect, it, vi } from 'vitest';
import { createFailureGuard, type RenderFailure } from '../../src/render/failure';

describe('createFailureGuard', () => {
  it('laisse passer les appels tant que rien n’a échoué', () => {
    const onFailure = vi.fn();
    const guard = createFailureGuard(onFailure);
    const fn = vi.fn<(a: number, b: string) => void>();
    guard.guard(fn)(1, 'x');
    expect(fn).toHaveBeenCalledWith(1, 'x');
    expect(guard.failed).toBe(false);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('transforme une exception en échec « error », sans la relancer', () => {
    const failures: RenderFailure[] = [];
    const guard = createFailureGuard((failure) => {
      failures.push(failure);
    });
    const wrapped = guard.guard(() => {
      throw new Error('boum');
    });
    expect(wrapped).not.toThrow();
    expect(failures).toEqual([{ kind: 'error', detail: 'boum' }]);
    expect(guard.failed).toBe(true);
  });

  it('décrit une valeur levée qui n’est pas une Error', () => {
    const failures: RenderFailure[] = [];
    const guard = createFailureGuard((failure) => {
      failures.push(failure);
    });
    guard.guard(() => {
      throw JSON.parse('"texte"');
    })();
    expect(failures[0]?.detail).toBe('texte');
  });

  it('n’appelle plus rien après un échec et ne signale qu’une fois', () => {
    const onFailure = vi.fn();
    const guard = createFailureGuard(onFailure);
    const fn = vi.fn();
    const wrapped = guard.guard(fn);
    guard.fail('context-lost', 'perdu');
    guard.fail('error', 'second');
    wrapped();
    expect(fn).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({ kind: 'context-lost', detail: 'perdu' });
  });
});
