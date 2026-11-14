/**
 * Déterminisme de la boucle PI (spec T-018 §9), sur le modèle de `determinism.test.ts`. La
 * trace d'une exécution est une Float64Array de TRACE_STRIDE valeurs par pas : [y, ẏ] après
 * le pas, uCmd, uSat, puis l'intégrale I après le pas (SI).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  SIM_DT,
  createElevatorPiLoop,
  createFixedStepClock,
  type ElevatorPiLoop,
} from '../../src/sim';

/** 1800 pas = 15 s à dt = 1/120 s. */
const STEPS = 1800;
const TRACE_STRIDE = 5;
const KP = 2500;
const KI = 1000;

/**
 * Empreinte figée de la trace Kp = 2500, Ki = 1000, saturation ±5000 N, 1800 pas, octets de
 * la Float64Array en ordre machine (petit-boutiste sur x86-64 et ARM64).
 */
const TRACE_SHA256 = '0d9d331a5a4a9df28a188dd71b599a3559bd47ccc04f6d4ab78b7db5b725744b';

/** Exécute un pas et écrit son enregistrement à l'indice `k`. */
function stepAndRecord(trace: Float64Array, loop: ElevatorPiLoop): void {
  const k = loop.k;
  const s = loop.step();
  const base = k * TRACE_STRIDE;
  trace[base] = s.x[0] as number;
  trace[base + 1] = s.x[1] as number;
  trace[base + 2] = s.uCmd;
  trace[base + 3] = s.uSat;
  trace[base + 4] = loop.controller.integral;
}

/** Exécution directe de STEPS pas. */
function directTrace(): Float64Array {
  const loop = createElevatorPiLoop({ kp: KP, ki: KI });
  const trace = new Float64Array(STEPS * TRACE_STRIDE);
  while (loop.k < STEPS) stepAndRecord(trace, loop);
  return trace;
}

/** Même scénario piloté par l'horloge à pas fixe avec des images de durée `frameSeconds`. */
function clockedTrace(frameSeconds: number): { trace: Float64Array; frames: number } {
  const loop = createElevatorPiLoop({ kp: KP, ki: KI });
  const clock = createFixedStepClock(SIM_DT);
  const trace = new Float64Array(STEPS * TRACE_STRIDE);
  let frames = 0;
  while (loop.k < STEPS) {
    const steps = clock.advance(frameSeconds);
    frames++;
    for (let i = 0; i < steps && loop.k < STEPS; i++) stepAndRecord(trace, loop);
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

describe('déterminisme de la boucle PI (spec T-018 §9)', () => {
  it('deux exécutions de 1800 pas : traces identiques bit à bit', () => {
    const first = directTrace();
    const second = directTrace();
    expect(first).not.toBe(second);
    expect(bitwiseEqual(first, second)).toBe(true);
  });

  it('images de 1/60 s puis de 1/144 s : mêmes états et même intégrale aux mêmes k', () => {
    const reference = directTrace();
    const at60 = clockedTrace(1 / 60);
    const at144 = clockedTrace(1 / 144);
    expect(at60.frames).toBe(900);
    expect(at144.frames).toBe(2160);
    expect(bitwiseEqual(at60.trace, at144.trace)).toBe(true);
    expect(bitwiseEqual(at60.trace, reference)).toBe(true);
  });

  it('empreinte SHA-256 de la trace Kp = 2500, Ki = 1000 figée', () => {
    const trace = directTrace();
    const digest = createHash('sha256')
      .update(new Uint8Array(trace.buffer, trace.byteOffset, trace.byteLength))
      .digest('hex');
    console.info(`SHA-256 trace PI Kp=2500 Ki=1000 (1800 pas × [y, ẏ, uCmd, uSat, I]) = ${digest}`);
    expect(digest).toBe(TRACE_SHA256);
  });

  it('la trace n’est pas triviale (saturation, intégrale proche du poids en fin de trace)', () => {
    const trace = directTrace();
    let saturated = 0;
    for (let k = 0; k < STEPS; k++) {
      const base = k * TRACE_STRIDE;
      if (trace[base + 2] !== trace[base + 3]) saturated++;
    }
    const last = (STEPS - 1) * TRACE_STRIDE;
    expect(saturated).toBeGreaterThan(0);
    expect(Math.abs(3 - (trace[last] as number))).toBeLessThan(1e-3);
    expect(Math.abs(490.5 - (trace[last + 4] as number))).toBeLessThan(1);
  });
});
