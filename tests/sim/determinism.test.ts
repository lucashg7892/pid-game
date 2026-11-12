/**
 * Déterminisme du noyau (spec T-001 §9 a, b, c). La trace d'une exécution est une Float64Array
 * de TRACE_STRIDE valeurs par pas : [y, ẏ] après le pas, uCmd, uSat (SI).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SIM_DT, createElevatorLoop, createFixedStepClock } from '../../src/sim';

/** 1800 pas = 15 s à dt = 1/120 s. */
const STEPS = 1800;
const TRACE_STRIDE = 4;
const KP = 2500;

/**
 * Empreinte figée de la trace Kp = 2500, saturation ±5000 N, 1800 pas, octets de la
 * Float64Array en ordre machine (petit-boutiste sur x86-64 et ARM64).
 */
const TRACE_SHA256 = '5f85e15aa78afeeb834bf30e651b062be643a3e763b2821d7d534bcbbb38a821';

/** Écrit dans `trace` l'enregistrement du pas d'indice `k`. */
function record(
  trace: Float64Array,
  k: number,
  s: { x: Readonly<Float64Array>; uCmd: number; uSat: number },
): void {
  const base = k * TRACE_STRIDE;
  trace[base] = s.x[0] as number;
  trace[base + 1] = s.x[1] as number;
  trace[base + 2] = s.uCmd;
  trace[base + 3] = s.uSat;
}

/** Exécution directe de STEPS pas. */
function directTrace(): Float64Array {
  const loop = createElevatorLoop({ kp: KP });
  const trace = new Float64Array(STEPS * TRACE_STRIDE);
  for (let k = 0; k < STEPS; k++) record(trace, k, loop.step());
  return trace;
}

/** Même scénario piloté par l'horloge à pas fixe avec des images de durée `frameSeconds`. */
function clockedTrace(frameSeconds: number): { trace: Float64Array; frames: number } {
  const loop = createElevatorLoop({ kp: KP });
  const clock = createFixedStepClock(SIM_DT);
  const trace = new Float64Array(STEPS * TRACE_STRIDE);
  let frames = 0;
  while (loop.k < STEPS) {
    const steps = clock.advance(frameSeconds);
    frames++;
    for (let i = 0; i < steps && loop.k < STEPS; i++) {
      const k = loop.k;
      record(trace, k, loop.step());
    }
  }
  return { trace, frames };
}

/** Compare deux Float64Array bit à bit (distingue −0 de +0 et compare les NaN par leurs bits). */
function bitwiseEqual(a: Float64Array, b: Float64Array): boolean {
  if (a.length !== b.length) return false;
  const ua = new BigUint64Array(a.buffer, a.byteOffset, a.length);
  const ub = new BigUint64Array(b.buffer, b.byteOffset, b.length);
  for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return false;
  return true;
}

describe('déterminisme (spec §9)', () => {
  it('(a) deux exécutions de 1800 pas : traces identiques bit à bit', () => {
    const first = directTrace();
    const second = directTrace();
    expect(first).not.toBe(second);
    expect(bitwiseEqual(first, second)).toBe(true);
  });

  it('(b) images de 1/60 s puis de 1/144 s : mêmes états aux mêmes k', () => {
    const reference = directTrace();
    const at60 = clockedTrace(1 / 60);
    const at144 = clockedTrace(1 / 144);
    // 1800 pas = 15 s : 900 images de 1/60 s, 2160 images de 1/144 s.
    expect(at60.frames).toBe(900);
    expect(at144.frames).toBe(2160);
    expect(bitwiseEqual(at60.trace, at144.trace)).toBe(true);
    expect(bitwiseEqual(at60.trace, reference)).toBe(true);
  });

  it('(c) empreinte SHA-256 de la trace Kp = 2500 figée', () => {
    const trace = directTrace();
    const digest = createHash('sha256')
      .update(new Uint8Array(trace.buffer, trace.byteOffset, trace.byteLength))
      .digest('hex');
    console.info(`SHA-256 trace Kp=2500 (1800 pas × [y, ẏ, uCmd, uSat]) = ${digest}`);
    expect(digest).toBe(TRACE_SHA256);
  });

  it('la trace n’est pas triviale (la cabine a bougé et la saturation a joué)', () => {
    const trace = directTrace();
    let saturated = 0;
    for (let k = 0; k < STEPS; k++) {
      const base = k * TRACE_STRIDE;
      if (trace[base + 2] !== trace[base + 3]) saturated++;
    }
    expect(trace[(STEPS - 1) * TRACE_STRIDE]).toBeGreaterThan(2.8);
    expect(saturated).toBeGreaterThan(0);
  });
});
