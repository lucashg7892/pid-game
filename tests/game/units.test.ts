import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_LEDGE_HEIGHT,
  ARRIVAL_LEDGE_MIN_X,
  BEAM_HEIGHT,
  CABIN_CENTER_X,
  CABIN_WIDTH,
  CONSOLE_REACH,
  CONSOLE_X,
  LEVEL1_SETPOINT,
  NO_LIFT_KP_THRESHOLD,
  START_LEDGE_MAX_X,
  TRIP_MAX_STEPS,
  VOID_MAX_X,
  VOID_MIN_X,
  VOID_WIDTH,
  WALKER_MAX_X,
  WALKER_MIN_X,
  WALKER_SPAWN_X,
  WIN_HOLD_STEPS,
  classifyTimeout,
  createOutcomeJudge,
  createWalker,
  isAtConsole,
  quantizeKp,
} from '../../src/game';

describe('géométrie du niveau (spec §6)', () => {
  it('quais, vide de 4 m, cage, poutre à 3,3626 m, consigne 3,00 m', () => {
    expect(VOID_WIDTH).toBe(4);
    expect(VOID_MIN_X).toBe(START_LEDGE_MAX_X);
    expect(VOID_MAX_X - VOID_MIN_X).toBe(4);
    expect(ARRIVAL_LEDGE_MIN_X).toBe(VOID_MAX_X);
    expect(CABIN_WIDTH).toBeLessThan(VOID_WIDTH);
    expect(CABIN_CENTER_X - CABIN_WIDTH / 2).toBeGreaterThanOrEqual(VOID_MIN_X);
    expect(CABIN_CENTER_X + CABIN_WIDTH / 2).toBeLessThanOrEqual(VOID_MAX_X);
    expect(BEAM_HEIGHT).toBe(3.3626);
    expect(LEVEL1_SETPOINT).toBe(3);
    expect(ARRIVAL_LEDGE_HEIGHT).toBe(3);
    // Console sur le quai de départ et accessible au bonhomme.
    expect(CONSOLE_X).toBeLessThan(START_LEDGE_MAX_X);
    expect(WALKER_MAX_X).toBeLessThan(START_LEDGE_MAX_X);
    expect(WALKER_MAX_X).toBeGreaterThanOrEqual(CONSOLE_X - CONSOLE_REACH);
    expect(isAtConsole(WALKER_SPAWN_X)).toBe(false);
    expect(WALKER_MIN_X).toBe(WALKER_SPAWN_X);
  });
});

describe('quantizeKp', () => {
  it.each([
    [0, 0],
    [49, 0],
    [50, 100],
    [-49, 0],
    [-1e6, 0],
    [1234, 1200],
    [7951, 8000],
    [8049, 8000],
    [1e300, 8000],
  ])('%d → %d', (v, expected) => {
    expect(quantizeKp(v)).toBe(expected);
  });
  it('non fini → null ; −0 normalisé', () => {
    expect(quantizeKp(NaN)).toBeNull();
    expect(quantizeKp(Infinity)).toBeNull();
    expect(quantizeKp(-Infinity)).toBeNull();
    expect(Object.is(quantizeKp(-0.4), 0)).toBe(true);
  });
});

describe("arbitre d'issue", () => {
  it('seuil noLift calculé m·g/r', () => {
    expect(NO_LIFT_KP_THRESHOLD).toBe((50 * 9.81) / 3);
    expect(classifyTimeout(163)).toBe('noLift');
    expect(classifyTimeout(NO_LIFT_KP_THRESHOLD)).toBe('noLift');
    expect(classifyTimeout(164)).toBe('step');
  });

  it('victoire au 120e pas consécutif, compteur remis à zéro', () => {
    const j = createOutcomeJudge();
    for (let n = 1; n < WIN_HOLD_STEPS; n++) expect(j.evaluate(n, 2.8, 0, 2500)).toBeNull();
    expect(j.holdSteps).toBe(WIN_HOLD_STEPS - 1);
    expect(j.evaluate(200, 2.8, 0.2, 2500)).toBeNull(); // vitesse trop grande
    expect(j.holdSteps).toBe(0);
    for (let n = 1; n < WIN_HOLD_STEPS; n++) j.evaluate(n, 2.5, -0.1, 2500); // bornes incluses
    expect(j.evaluate(300, 2.5, 0.1, 2500)).toBe('win');
    j.reset();
    expect(j.evaluate(1, 2.4999, 0, 2500)).toBeNull(); // 0,5001 m sous le plateau : hors tolérance
    expect(j.holdSteps).toBe(0);
    j.reset();
    expect(j.holdSteps).toBe(0);
  });

  it('choc strictement au-dessus de 3,3626 m ; victoire au pas 720 prioritaire ; NaN', () => {
    const j = createOutcomeJudge();
    expect(j.evaluate(1, 3.3626, 0, 4000)).toBeNull();
    expect(j.evaluate(2, 3.3626001, 0, 4000)).toBe('bonk');
    j.reset();
    expect(TRIP_MAX_STEPS).toBe(720);
    expect(j.evaluate(TRIP_MAX_STEPS - 1, 1, 0, 800)).toBeNull();
    expect(j.evaluate(TRIP_MAX_STEPS, 1, 0, 800)).toBe('step');
    expect(j.evaluate(TRIP_MAX_STEPS, 0, 0, 100)).toBe('noLift');
    j.reset();
    for (let n = 1; n < WIN_HOLD_STEPS; n++) j.evaluate(n, 3, 0, 2500);
    expect(j.evaluate(TRIP_MAX_STEPS, 3, 0, 2500)).toBe('win');
    j.reset();
    expect(j.evaluate(5, NaN, NaN, 2500)).toBeNull();
  });
});

describe('bonhomme', () => {
  it('place sans interpolation et remet l’intention à zéro', () => {
    const w = createWalker();
    w.setIntent('right');
    w.step(1);
    expect(w.x).toBeCloseTo(WALKER_SPAWN_X + 1.5, 12);
    expect(w.prevX).toBe(WALKER_SPAWN_X);
    w.place(CONSOLE_X, -1);
    expect(w.x).toBe(CONSOLE_X);
    expect(w.prevX).toBe(CONSOLE_X);
    expect(w.facing).toBe(-1);
    expect(w.intent).toBe('none');
    expect(w.atConsole).toBe(true);
    w.setIntent('none');
    expect(w.facing).toBe(-1);
  });
});

describe('pureté de src/game (spec §3)', () => {
  it("n'importe que src/game et src/sim ; ni aléa, ni horloge murale, ni DOM", () => {
    const dir = new URL('../../src/game/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/Math\.random|\bDate\b|\bperformance\b|\bwindow\b|\bdocument\b/);
      for (const m of code.matchAll(/from '([^']+)'/g)) {
        expect(m[1], f).toMatch(/^\.\/|^\.\.\/sim$/);
      }
    }
  });
});
