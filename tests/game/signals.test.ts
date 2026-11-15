/**
 * Signaux du dernier pas dans l'instantané (T-041) : stepY, stepVelocity, stepAcceleration,
 * stepError, uCmd, pTerm, iTermUsed, uSat, saturated, aux deux niveaux. Comparés pas à pas à une
 * boucle du noyau jouée à part, cohérents entre eux, neutres hors trajet, conservés à l'issue,
 * indépendants du découpage en images et des animations ; trajet et issues inchangés.
 */
import { describe, expect, it } from 'vitest';
import {
  CABIN_WEIGHT,
  LEVEL1_SETPOINT,
  LEVEL2_KP,
  createLevel1,
  createLevel2,
  type Level,
  type LevelSnapshot,
} from '../../src/game';
import {
  ELEVATOR_MAX_FORCE,
  ELEVATOR_PARAMS,
  ELEVATOR_VELOCITY,
  createElevatorLoop,
  createElevatorPiLoop,
  elevatorAcceleration,
  type SteppableClosedLoop,
} from '../../src/sim';
import { mulberry32, reachConsole } from './helpers';

/** Signaux d'un pas, copiés. */
interface StepSignals {
  y: number;
  v: number;
  a: number;
  e: number;
  uCmd: number;
  uSat: number;
  p: number;
  i: number;
  saturated: boolean;
}

/** Niveau et gain réglé (Kp au niveau 1, Ki au niveau 2). */
type Case = readonly ['level1' | 'level2', number];

const NUMERIC = ['y', 'v', 'a', 'e', 'uCmd', 'uSat', 'p', 'i'] as const;

/** Copie les signaux du dernier pas de l'instantané. */
function read(s: Readonly<LevelSnapshot>): StepSignals {
  return {
    y: s.stepY,
    v: s.stepVelocity,
    a: s.stepAcceleration,
    e: s.stepError,
    uCmd: s.uCmd,
    uSat: s.uSat,
    p: s.pTerm,
    i: s.iTermUsed,
    saturated: s.saturated,
  };
}

/** Vrai si deux jeux de signaux sont identiques bit à bit (−0 distingué de +0). */
function same(a: StepSignals, b: StepSignals): boolean {
  return NUMERIC.every((f) => Object.is(a[f], b[f])) && a.saturated === b.saturated;
}

/** Signaux neutres (cabine posée, moteur coupé). */
const NEUTRAL: StepSignals = {
  y: 0,
  v: 0,
  a: 0,
  e: 0,
  uCmd: 0,
  uSat: 0,
  p: 0,
  i: 0,
  saturated: false,
};

/** Crée le niveau du cas, gain réglé, panneau ouvert (phase `tuning`). */
function levelFor([id, gain]: Case, animations = false, frame = () => 1 / 60): Level {
  const level =
    id === 'level1'
      ? createLevel1({ animations, initialKp: gain })
      : createLevel2({ animations, initialKi: gain });
  reachConsole(level, frame);
  return level;
}

/**
 * Signaux attendus des `steps` premiers pas, d'après une boucle du noyau jouée à part : vitesse et
 * intégrale lues avant le pas, accélération recalculée ici depuis la formule du modèle.
 */
function expectedSeries([id, gain]: Case, steps: number): StepSignals[] {
  const pi = id === 'level2' ? createElevatorPiLoop({ kp: LEVEL2_KP, ki: gain }) : null;
  const loop: SteppableClosedLoop = pi ?? createElevatorLoop({ kp: gain });
  const kp = id === 'level2' ? LEVEL2_KP : gain;
  const { mass, damping } = ELEVATOR_PARAMS;
  const out: StepSignals[] = [];
  for (let k = 0; k < steps; k++) {
    const v = loop.x[ELEVATOR_VELOCITY] as number;
    const i = pi === null ? 0 : pi.controller.integral;
    const s = loop.step();
    const net = s.uSat - mass * ELEVATOR_PARAMS.gravity - damping * v;
    const a = s.y <= 0 && v <= 0 && net < 0 ? 0 : net / mass;
    out.push({
      y: s.y,
      v,
      a,
      e: s.e,
      uCmd: s.uCmd,
      uSat: s.uSat,
      p: kp * s.e,
      i,
      saturated: s.saturated,
    });
  }
  return out;
}

/**
 * Lance et joue le trajet jusqu'à l'issue (images `frame()`), en vérifiant à chaque image que les
 * signaux de l'instantané sont ceux du pas k − 1 de `reference` (si fournie). Rend la série
 * observée image après image (indice k − 1 ; seuls les pas visibles à une image sont renseignés).
 */
function playTrip(
  level: Level,
  frame: () => number,
  reference?: readonly StepSignals[],
): (StepSignals | undefined)[] {
  expect(level.launch()).toBe('accepted');
  const seen: (StepSignals | undefined)[] = [];
  for (let n = 0; n < 100_000 && level.snapshot.outcome === null; n++) {
    const s = level.update(frame());
    if (s.k === 0) {
      expect(same(read(s), NEUTRAL)).toBe(true);
      continue;
    }
    const got = read(s);
    seen[s.k - 1] = got;
    if (reference !== undefined) {
      const want = reference[s.k - 1];
      if (want === undefined || !same(got, want)) {
        throw new Error(
          `pas ${String(s.k - 1)} : ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`,
        );
      }
    }
  }
  expect(level.snapshot.outcome).not.toBeNull();
  return seen;
}

const CASES: readonly Case[] = [
  ['level1', 0],
  ['level1', 100],
  ['level1', 800],
  ['level1', 2500],
  ['level1', 5000],
  ['level1', 8000],
  ['level2', 0],
  ['level2', 130],
  ['level2', 500],
  ['level2', 800],
  ['level2', 2000],
  ['level2', 8000],
];

describe('signaux du dernier pas : égaux à la boucle du noyau, cohérents entre eux', () => {
  it.each(CASES)('%s, gain %i : chaque pas, bit à bit', (id, gain) => {
    const level = levelFor([id, gain]);
    const reference = expectedSeries([id, gain], 1200);
    const seen = playTrip(level, () => 1 / 120, reference);
    const s = level.snapshot;
    expect(seen).toHaveLength(s.outcomeK as number);
    // L'enregistreur du jeu porte les mêmes y, e et uSat.
    const rec: number[][] = [[], [], []];
    level.signals.forEach('y', (_t, v) => rec[0]?.push(v));
    level.signals.forEach('e', (_t, v) => rec[1]?.push(v));
    level.signals.forEach('uSat', (_t, v) => rec[2]?.push(v));
    for (let k = 0; k < seen.length; k++) {
      const x = seen[k] as StepSignals;
      expect(Object.is(rec[0]?.[k], x.y)).toBe(true);
      expect(Object.is(rec[1]?.[k], x.e)).toBe(true);
      expect(Object.is(rec[2]?.[k], x.uSat)).toBe(true);
      // Cohérence interne.
      expect(x.uCmd).toBe(x.p + x.i);
      expect(x.uSat).toBe(Math.min(Math.max(x.uCmd, -ELEVATOR_MAX_FORCE), ELEVATOR_MAX_FORCE));
      expect(x.saturated).toBe(x.uSat !== x.uCmd);
      expect(x.e).toBe(LEVEL1_SETPOINT - x.y);
      expect(x.a).toBe(elevatorAcceleration(x.y, x.v, x.uSat));
      // La vitesse du pas k est celle de l'état après le pas k − 1.
      if (k > 0) {
        const prev = seen[k - 1] as StepSignals;
        expect(x.y).toBeGreaterThanOrEqual(0);
        expect(Math.abs(x.y - (prev.y + prev.v / 120))).toBeLessThan(0.01);
      }
      if (id === 'level1') expect(x.i).toBe(0);
    }
    // Le dernier pas : iTerm (intégrale après le pas) = iTermUsed + Ki·dt·e.
    const last = seen[seen.length - 1] as StepSignals;
    expect(s.iTerm).toBe(id === 'level2' ? last.i + gain * (1 / 120) * last.e : 0);
  });

  it('Kp ≤ m·g/r (ne décolle pas) : cabine posée, accélération nulle à chaque pas', () => {
    for (const kp of [0, 100, 150]) {
      const level = levelFor(['level1', kp]);
      const seen = playTrip(level, () => 1 / 120);
      expect(level.snapshot.outcome).toBe('noLift');
      for (const x of seen) {
        expect(x?.y).toBe(0);
        expect(x?.v).toBe(0);
        expect(Object.is(x?.a, 0)).toBe(true);
        expect((x?.uSat as number) - CABIN_WEIGHT).toBeLessThan(0);
      }
    }
  });

  it('victoire du niveau 2 : saturation au départ, terme I qui monte, puis non saturé', () => {
    const level = levelFor(['level2', 500]);
    const seen = playTrip(level, () => 1 / 120) as StepSignals[];
    expect(level.snapshot.outcome).toBe('win');
    expect(seen[0]?.saturated).toBe(true);
    expect(seen[0]?.uCmd).toBe(LEVEL2_KP * LEVEL1_SETPOINT);
    expect(seen[0]?.uSat).toBe(ELEVATOR_MAX_FORCE);
    expect(seen[0]?.i).toBe(0);
    expect(seen[0]?.a).toBeGreaterThan(80);
    expect(seen[100]?.i).toBeGreaterThan(seen[10]?.i as number);
    expect(seen[seen.length - 1]?.saturated).toBe(false);
  });
});

describe('valeurs neutres hors trajet, conservées à l’issue', () => {
  it('avant le lancement, pendant l’embarquement, après recommencer : tout à 0', () => {
    for (const id of ['level1', 'level2'] as const) {
      const level = id === 'level1' ? createLevel1() : createLevel2({ initialKi: 500 });
      expect(same(read(level.snapshot), NEUTRAL)).toBe(true);
      level.moveRight();
      for (let i = 0; i < 60; i++) expect(same(read(level.update(1 / 60)), NEUTRAL)).toBe(true);
      level.interact();
      for (let i = 0; i < 60; i++) expect(same(read(level.update(1 / 60)), NEUTRAL)).toBe(true);
      expect(level.snapshot.phase).toBe('tuning');
      level.launch();
      expect(level.snapshot.phase).toBe('boarding');
      for (let i = 0; level.snapshot.phase === 'boarding'; i++) {
        expect(i).toBeLessThan(1000);
        expect(same(read(level.snapshot), NEUTRAL)).toBe(true);
        level.update(1 / 60);
      }
      level.update(1 / 60);
      expect(level.snapshot.phase).toBe('trip');
      expect(same(read(level.snapshot), NEUTRAL)).toBe(false);
      level.restart();
      expect(same(read(level.snapshot), NEUTRAL)).toBe(true);
      level.update(1 / 60);
      expect(same(read(level.snapshot), NEUTRAL)).toBe(true);
    }
  });

  it('sans animations, au lancement (k = 0, avant le premier pas) : neutres', () => {
    const level = levelFor(['level1', 2500]);
    level.launch();
    expect(level.snapshot.phase).toBe('trip');
    expect(same(read(level.snapshot), NEUTRAL)).toBe(true);
  });

  it.each([
    ['level1', 2500, false],
    ['level1', 2500, true],
    ['level1', 8000, false],
    ['level2', 500, true],
    ['level2', 2000, false],
    ['level2', 0, false],
  ] as const)('%s, gain %i, animations %s : valeurs du dernier pas gardées', (id, gain, anim) => {
    const level = levelFor([id, gain], anim);
    playTripUntilJudged(level);
    const s = level.snapshot;
    const reference = expectedSeries([id, gain], s.outcomeK as number);
    const last = reference[reference.length - 1] as StepSignals;
    expect(same(read(s), last)).toBe(true);
    for (let i = 0; i < 600; i++) {
      level.update(1 / 60);
      expect(same(read(level.snapshot), last)).toBe(true);
    }
    expect(level.snapshot.phase).toBe('outcome');
    // La pause ne change rien non plus.
    level.pause();
    expect(same(read(level.update(1 / 60)), last)).toBe(true);
  });
});

/** Lance et joue jusqu'à ce que l'issue soit jugée (sortie animée comprise : phase `exit`). */
function playTripUntilJudged(level: Level): void {
  level.launch();
  for (let i = 0; i < 100_000 && level.snapshot.outcome === null; i++) level.update(1 / 60);
}

describe('indépendance au découpage en images et aux animations', () => {
  const framings: [string, () => () => number][] = [
    ['1/30 s', () => () => 1 / 30],
    ['1/60 s', () => () => 1 / 60],
    ['1/144 s', () => () => 1 / 144],
    [
      'irrégulier 7–40 ms',
      () => {
        const rnd = mulberry32(42);
        return () => 0.007 + 0.033 * rnd();
      },
    ],
    [
      'irrégulier + image de 0,5 s toutes les 50 images',
      () => {
        const rnd = mulberry32(7);
        let n = 0;
        return () => (++n % 50 === 0 ? 0.5 : 0.007 + 0.033 * rnd());
      },
    ],
  ];

  it.each([
    ['level1', 2500],
    ['level1', 8000],
    ['level2', 500],
    ['level2', 2000],
  ] as const)('%s, gain %i : mêmes signaux à chaque image qu’à 1/120 s', (id, gain) => {
    const reference = playTrip(levelFor([id, gain]), () => 1 / 120) as StepSignals[];
    for (const [name, make] of framings) {
      const level = levelFor([id, gain], false, make());
      playTrip(level, make(), reference);
      const s = level.snapshot;
      expect(s.outcomeK, name).toBe(reference.length);
      expect(same(read(s), reference[reference.length - 1] as StepSignals), name).toBe(true);
    }
  });

  it.each([
    ['level1', 2500],
    ['level2', 500],
    ['level2', 2000],
  ] as const)('%s, gain %i : mêmes signaux avec et sans animations', (id, gain) => {
    const without = playTrip(levelFor([id, gain]), () => 1 / 120) as StepSignals[];
    const level = levelFor([id, gain], true);
    expect(level.launch()).toBe('accepted');
    const seen: StepSignals[] = [];
    for (let i = 0; i < 100_000 && level.snapshot.outcome === null; i++) {
      const s = level.update(1 / 120);
      if (s.phase === 'boarding') expect(same(read(s), NEUTRAL)).toBe(true);
      else if (s.k > 0) seen[s.k - 1] = read(s);
    }
    expect(seen).toHaveLength(without.length);
    seen.forEach((x, k) => {
      expect(same(x, without[k] as StepSignals), `pas ${String(k)}`).toBe(true);
    });
  });
});

/**
 * Non-régression du trajet : issue, pas d'issue, erreur finale, intégrale finale et pas saturés,
 * mesurés sur le code d'AVANT l'ajout des signaux (commit ec7d0d7), images de 1/120 s.
 */
const BEFORE: readonly (readonly [1 | 2, number, string, number, number, number, number])[] = [
  [1, 0, 'noLift', 1200, 3, 0, 0],
  [1, 100, 'noLift', 1200, 3, 0, 0],
  [1, 150, 'noLift', 1200, 3, 0, 0],
  [1, 200, 'step', 1200, 2.4552409824494212, 0, 0],
  [1, 500, 'step', 1200, 0.981000431525223, 0, 0],
  [1, 800, 'step', 1200, 0.6131249999999953, 0, 0],
  [1, 900, 'step', 1200, 0.5450000000000101, 0, 0],
  [1, 1000, 'win', 267, 0.48975686715043754, 0, 0],
  [1, 1500, 'win', 280, 0.3269108234121778, 0, 0],
  [1, 2000, 'win', 262, 0.24468037771445017, 0, 15],
  [1, 2500, 'win', 291, 0.19640662809861142, 0, 23],
  [1, 3000, 'win', 285, 0.16327316055062768, 0, 27],
  [1, 4000, 'win', 301, 0.12286702629556512, 0, 32],
  [1, 4100, 'win', 301, 0.11988058208161423, 0, 33],
  [1, 5000, 'win', 293, 0.09804718630787823, 0, 35],
  [1, 5100, 'bonk', 61, -0.36419704639811545, 0, 36],
  [1, 6000, 'bonk', 57, -0.36450654275635586, 0, 37],
  [1, 8000, 'bonk', 55, -0.37371803456042585, 0, 40],
  [2, 0, 'step', 1200, 0.1962000000000006, 0, 23],
  [2, 100, 'step', 1200, 0.11648734513386927, 201.1480153591085, 23],
  [2, 120, 'step', 1200, 0.10463246166343732, 230.93111940545717, 23],
  [2, 130, 'slow', 1200, 0.09912347052544268, 244.75679026238996, 23],
  [2, 140, 'win', 1185, 0.0945427273515973, 256.2650249643377, 23],
  [2, 200, 'win', 733, 0.0922598933695653, 262.81066216915804, 23],
  [2, 300, 'win', 313, 0.09267096503861705, 263.2159231934576, 24],
  [2, 500, 'win', 298, 0.04620355912036711, 379.1739485467916, 24],
  [2, 700, 'win', 298, 0.010763758607560625, 465.3803012188262, 25],
  [2, 800, 'win', 298, -0.0029914872863918696, 498.2268821598044, 25],
  [2, 840, 'win', 298, -0.00783757216094072, 509.69020658294437, 25],
  [2, 850, 'bonk', 72, -0.36356200877771094, 585.5526406128832, 25],
  [2, 900, 'bonk', 69, -0.36526910822728764, 625.9989555984355, 25],
  [2, 1000, 'bonk', 66, -0.36512086632800367, 700.5244036210803, 26],
  [2, 2000, 'bonk', 57, -0.3722569878521562, 1406.4467457552355, 29],
  [2, 4000, 'bonk', 52, -0.3781817841481261, 2802.0365604476083, 36],
  [2, 8000, 'bonk', 51, -0.4290018258977697, 5597.671352276463, 50],
];

describe('non-régression : trajet et issue inchangés par l’ajout des signaux', () => {
  it.each(BEFORE)('niveau %i, gain %i → %s au pas %i', (n, gain, outcome, k, err, iTerm, sat) => {
    const level = levelFor([n === 1 ? 'level1' : 'level2', gain]);
    level.launch();
    for (let i = 0; i < 2000 && level.snapshot.outcome === null; i++) level.update(1 / 120);
    const s = level.snapshot;
    expect(s.outcome).toBe(outcome);
    expect(s.outcomeK).toBe(k);
    expect(s.finalError).toBe(err);
    expect(s.iTerm).toBe(iTerm);
    expect(s.saturatedSteps).toBe(sat);
  });
});
