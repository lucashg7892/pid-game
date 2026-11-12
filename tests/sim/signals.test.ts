import { describe, expect, it } from 'vitest';
import {
  SIGNAL_STRIDE,
  createSignalRecorder,
  type LoopSample,
  type SignalName,
} from '../../src/sim';

/** Échantillon synthétique : chaque grandeur est déduite de k pour être reconnaissable. */
function sample(k: number): LoopSample {
  return {
    k,
    t: k / 120,
    r: 1,
    y: k,
    e: 1 - k,
    uCmd: 10 * k,
    uSat: Math.min(10 * k, 50),
    saturated: 10 * k > 50,
    x: new Float64Array([k, 0]),
  };
}

/** Relève un signal sous forme de paires [t, v]. */
function collect(
  rec: ReturnType<typeof createSignalRecorder>,
  name: SignalName,
): [number, number][] {
  const out: [number, number][] = [];
  rec.forEach(name, (t, v) => out.push([t, v]));
  return out;
}

describe('enregistreur de signaux', () => {
  it('tampon préalloué : Float64Array de capacity × 5', () => {
    const rec = createSignalRecorder(4);
    expect(rec.capacity).toBe(4);
    expect(rec.length).toBe(0);
    expect(rec.buffer).toBeInstanceOf(Float64Array);
    expect(rec.buffer.length).toBe(4 * SIGNAL_STRIDE);
  });

  it('restitue r, y, e, uSat dans l’ordre chronologique avant saturation du tampon', () => {
    const rec = createSignalRecorder(4);
    for (let k = 0; k < 3; k++) rec.push(sample(k));
    expect(rec.length).toBe(3);
    expect(collect(rec, 'y')).toEqual([
      [0, 0],
      [1 / 120, 1],
      [2 / 120, 2],
    ]);
    expect(collect(rec, 'r').map(([, v]) => v)).toEqual([1, 1, 1]);
    expect(collect(rec, 'e').map(([, v]) => v)).toEqual([1, 0, -1]);
    expect(collect(rec, 'uSat').map(([, v]) => v)).toEqual([0, 10, 20]);
  });

  it('à capacité atteinte : écrase le plus ancien, length = capacity, ordre conservé', () => {
    const rec = createSignalRecorder(4);
    for (let k = 0; k < 10; k++) rec.push(sample(k));
    expect(rec.length).toBe(4);
    expect(collect(rec, 'y').map(([, v]) => v)).toEqual([6, 7, 8, 9]);
    expect(collect(rec, 'uSat').map(([, v]) => v)).toEqual([50, 50, 50, 50]);
    // Remplissage exact (tête revenue à 0) : ordre toujours correct.
    const exact = createSignalRecorder(3);
    for (let k = 0; k < 6; k++) exact.push(sample(k));
    expect(collect(exact, 'y').map(([, v]) => v)).toEqual([3, 4, 5]);
  });

  it('aucun nouveau tampon après N écritures (même référence buffer)', () => {
    const rec = createSignalRecorder(100);
    const buffer = rec.buffer;
    const arrayBuffer = rec.buffer.buffer;
    for (let k = 0; k < 10_000; k++) rec.push(sample(k));
    expect(rec.buffer).toBe(buffer);
    expect(rec.buffer.buffer).toBe(arrayBuffer);
    expect(rec.buffer.length).toBe(100 * SIGNAL_STRIDE);
  });

  it('clear vide sans réallouer', () => {
    const rec = createSignalRecorder(2);
    const buffer = rec.buffer;
    rec.push(sample(1));
    rec.clear();
    expect(rec.length).toBe(0);
    expect(collect(rec, 'y')).toEqual([]);
    rec.push(sample(5));
    expect(collect(rec, 'y')).toEqual([[5 / 120, 5]]);
    expect(rec.buffer).toBe(buffer);
  });

  it('capacité 1 : garde le dernier échantillon', () => {
    const rec = createSignalRecorder(1);
    rec.push(sample(1));
    rec.push(sample(2));
    expect(collect(rec, 'y')).toEqual([[2 / 120, 2]]);
  });

  it('capacité invalide : RangeError', () => {
    expect(() => createSignalRecorder(0)).toThrow(RangeError);
    expect(() => createSignalRecorder(2.5)).toThrow(RangeError);
    expect(() => createSignalRecorder(Number.NaN)).toThrow(RangeError);
  });

  it('D-12 nom de signal inconnu : RangeError, fn jamais appelée', () => {
    const rec = createSignalRecorder(2);
    rec.push(sample(1));
    let calls = 0;
    const count = (): void => {
      calls++;
    };
    for (const raw of ['zz', 'toString', 't', '']) {
      const name = raw as SignalName; // contourne le typage, comme un appel depuis du JS
      expect(() => {
        rec.forEach(name, count);
      }).toThrow(RangeError);
    }
    expect(calls).toBe(0);
  });
});
