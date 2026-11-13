import { describe, expect, it } from 'vitest';
import { CABIN_CENTER_X, CABIN_WIDTH, TRIP_MAX_STEPS } from '../../src/game';
import { SIM_DT, createSignalRecorder } from '../../src/sim';
import {
  CURVE_CAPACITY,
  CURVE_FULL_SPEED_SECONDS,
  CURVE_MAX_SPEED,
  CURVE_ORIGIN_X,
  CURVE_SPAN,
  CurveTrace,
  curveTimeScale,
  curveX,
} from '../../src/render/curve';
import { STYLE_CURVE } from '../../src/render/pencil-style';
import { StrokeBatch, VERTICES_PER_SEGMENT } from '../../src/render/stroke-batch';

/** Enregistreur rempli de `n` échantillons y_k = f(k). */
function recorder(n: number, f: (k: number) => number) {
  const rec = createSignalRecorder(TRIP_MAX_STEPS);
  const x = new Float64Array(2);
  for (let k = 0; k < n; k += 1) {
    const y = f(k);
    rec.push({ k, t: k * SIM_DT, r: 3, y, e: 3 - y, uCmd: 0, uSat: 0, saturated: false, x });
  }
  return rec;
}

const wave = (k: number): number => 3 - 3 * Math.exp(-k / 60) * Math.cos(k / 13) + 1e-3 * k;

describe('échelle de temps', () => {
  it('1,2 m/s jusqu’à 3 s, puis resserrée pour tenir dans le plancher', () => {
    expect(CURVE_ORIGIN_X).toBe(CABIN_CENTER_X - CABIN_WIDTH / 2);
    expect(CURVE_SPAN).toBe(CABIN_WIDTH);
    expect(CURVE_FULL_SPEED_SECONDS).toBeCloseTo(3, 12);
    expect(curveTimeScale(0)).toBe(CURVE_MAX_SPEED);
    expect(curveTimeScale(2.425)).toBe(CURVE_MAX_SPEED);
    expect(curveTimeScale(3)).toBe(CURVE_MAX_SPEED);
    expect(curveTimeScale(15)).toBeCloseTo(0.24, 12);
    expect(curveTimeScale(Number.NaN)).toBe(CURVE_MAX_SPEED);
    for (const tEnd of [0.5, 2.4, 3, 4, 9.9, 15]) {
      const end = curveX(tEnd, curveTimeScale(tEnd));
      expect(end).toBeLessThanOrEqual(CURVE_ORIGIN_X + CURVE_SPAN + 1e-12);
      expect(end).toBeGreaterThan(CURVE_ORIGIN_X);
    }
  });
});

describe('CurveTrace', () => {
  it('N échantillons → N points, y fidèle à 1e-9, x selon l’échelle', () => {
    const n = 291;
    const rec = recorder(n, wave);
    const trace = new CurveTrace();
    const tEnd = n * SIM_DT;
    trace.begin(tEnd);
    rec.forEach('y', trace.add);
    expect(trace.count).toBe(n);
    for (let k = 0; k < n; k += 1) {
      expect(Math.abs((trace.points[2 * k + 1] as number) - wave(k))).toBeLessThanOrEqual(1e-9);
      expect(trace.points[2 * k]).toBeCloseTo(curveX(k * SIM_DT, curveTimeScale(tEnd)), 12);
    }
  });
  it('capacité 1800 + pointe sans débordement, points dans la zone', () => {
    const rec = recorder(TRIP_MAX_STEPS, wave);
    const trace = new CurveTrace();
    expect(trace.capacity).toBe(CURVE_CAPACITY);
    const tEnd = TRIP_MAX_STEPS * SIM_DT;
    trace.begin(tEnd);
    rec.forEach('y', trace.add);
    trace.add(tEnd, 2.7);
    expect(trace.count).toBe(TRIP_MAX_STEPS + 1);
    expect(trace.dropped).toBe(0);
    for (let i = 0; i < trace.count; i += 1) {
      const x = trace.points[2 * i] as number;
      expect(x).toBeGreaterThanOrEqual(CURVE_ORIGIN_X);
      expect(x).toBeLessThanOrEqual(CURVE_ORIGIN_X + CURVE_SPAN + 1e-9);
    }
    trace.add(tEnd, 2.7);
    expect(trace.dropped).toBe(1);
    trace.begin(1);
    expect(trace.count).toBe(0);
    expect(trace.dropped).toBe(0);
  });
  it('refuse une capacité invalide', () => {
    expect(() => new CurveTrace(1)).toThrow(RangeError);
    expect(() => new CurveTrace(2.5)).toThrow(RangeError);
  });
  it('ruban de la courbe : sommets attendus, y des sommets = échantillons (précision flottant 32 bits)', () => {
    const n = 600;
    const rec = recorder(n, wave);
    const trace = new CurveTrace();
    trace.begin(n * SIM_DT);
    rec.forEach('y', trace.add);
    const batch = new StrokeBatch(12_000);
    batch.polyline(trace.points, trace.count, STYLE_CURVE);
    expect(batch.vertexCount).toBe((n - 1) * VERTICES_PER_SEGMENT);
    expect(batch.dropped).toBe(0);
    // Premier quad de chaque segment : sommets 0 (gauche) et 1 (droit) au point k.
    for (let k = 0; k < n - 1; k += 1) {
      const v = k * VERTICES_PER_SEGMENT;
      const mid =
        ((batch.positions[3 * v + 1] as number) + (batch.positions[3 * (v + 1) + 1] as number)) / 2;
      expect(Math.abs(mid - wave(k))).toBeLessThan(2e-6);
    }
  });
  it('1801 points tiennent dans le lot de la courbe', () => {
    const rec = recorder(TRIP_MAX_STEPS, wave);
    const trace = new CurveTrace();
    trace.begin(15);
    rec.forEach('y', trace.add);
    trace.add(15, 2.7);
    const batch = new StrokeBatch(12_000);
    batch.polyline(trace.points, trace.count, STYLE_CURVE);
    expect(batch.vertexCount).toBe(TRIP_MAX_STEPS * VERTICES_PER_SEGMENT);
    expect(batch.dropped).toBe(0);
  });
});
