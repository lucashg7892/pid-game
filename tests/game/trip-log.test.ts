/**
 * Journal du trajet (T-048, D35) : `level.tripLog` garde les signaux de chaque pas du trajet
 * courant, aux deux niveaux. Égal bit à bit aux champs `step*` de l'instantané à chaque pas et aux
 * trajets de référence ; vidé au lancement et à `restart` ; conservé pendant la sortie, à l'issue
 * et en pause ; indépendant du découpage en images et des animations ; en lecture seule ;
 * préalloué, sans débordement.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  TRIP_MAX_STEPS,
  createLevel1,
  createLevel2,
  type Level,
  type LevelSnapshot,
  type TripLog,
} from '../../src/game';
import { createTripLog } from '../../src/game/trip-log';
import { TRAJETS_REFERENCE } from '../../src/proto/common/trajets';
import { SIM_DT } from '../../src/sim';
import { mulberry32, reachConsole } from './helpers';

/** Niveau et gain réglé (Kp au niveau 1, Ki au niveau 2). */
type Case = readonly ['level1' | 'level2', number];

/** Colonnes numériques du journal, et le champ de l'instantané qui leur correspond. */
const COLUMNS = [
  ['y', 'stepY'],
  ['v', 'stepVelocity'],
  ['a', 'stepAcceleration'],
  ['e', 'stepError'],
  ['uCmd', 'uCmd'],
  ['uSat', 'uSat'],
  ['p', 'pTerm'],
  ['i', 'iTermUsed'],
] as const;

/** Un enregistrement copié : 8 nombres et `saturated` en 0/1. */
type Row = readonly number[];

/** Copie l'enregistrement j du journal. */
function row(log: TripLog, j: number): Row {
  return [...COLUMNS.map(([c]) => log[c][j] as number), log.saturated[j] as number];
}

/** Signaux du dernier pas lus dans l'instantané, dans l'ordre de {@link row}. */
function snapRow(s: Readonly<LevelSnapshot>): Row {
  return [...COLUMNS.map(([, f]) => s[f]), s.saturated ? 1 : 0];
}

/** Égalité bit à bit (−0 distingué de +0). */
function sameRow(a: Row, b: Row): boolean {
  return a.length === b.length && a.every((x, n) => Object.is(x, b[n]));
}

/** Copie des `count` premiers enregistrements. */
function copyLog(log: TripLog): Row[] {
  const out: Row[] = [];
  for (let j = 0; j < log.count; j++) out.push(row(log, j));
  return out;
}

/** Égalité bit à bit de deux journaux copiés. */
function sameLog(a: readonly Row[], b: readonly Row[]): boolean {
  return a.length === b.length && a.every((r, j) => sameRow(r, b[j] as Row));
}

/** Les neuf colonnes du journal (références, pas des copies). */
function columnsOf(log: TripLog): TripLog['y'][] {
  return [log.y, log.v, log.a, log.e, log.uCmd, log.uSat, log.p, log.i, log.saturated];
}

/** Vérifie que le journal expose toujours les mêmes tableaux. */
function expectSameColumns(log: TripLog, columns: readonly TripLog['y'][]): void {
  columnsOf(log).forEach((c, n) => {
    expect(c).toBe(columns[n]);
  });
}

/** Crée le niveau du cas, gain réglé, panneau ouvert (phase `tuning`). */
function levelFor([id, gain]: Case, animations = false, frame = () => 1 / 60): Level {
  const level =
    id === 'level1'
      ? createLevel1({ animations, initialKp: gain })
      : createLevel2({ animations, initialKi: gain });
  reachConsole(level, frame);
  return level;
}

/** Avance (images `frame()`) jusqu'à `done`, avec garde-fou. */
function until(level: Level, done: () => boolean, frame: () => number = () => SIM_DT): void {
  for (let n = 0; !done(); n++) {
    if (n > 100_000) throw new Error('condition jamais atteinte');
    level.update(frame());
  }
}

/**
 * Lance et joue jusqu'à l'issue jugée, en vérifiant à CHAQUE image : count = k, et le dernier
 * enregistrement égal aux champs `step*` de l'instantané. Rend le journal copié à l'issue.
 */
function playChecked(level: Level, frame: () => number): Row[] {
  expect(level.launch()).toBe('accepted');
  const log = level.tripLog;
  expect(log.count).toBe(0);
  until(
    level,
    () => {
      const s = level.snapshot;
      if (log.count !== s.k) throw new Error(`count ${String(log.count)} ≠ k ${String(s.k)}`);
      if (s.k > 0 && !sameRow(row(log, s.k - 1), snapRow(s))) {
        throw new Error(`pas ${String(s.k - 1)} : journal ≠ instantané`);
      }
      return s.outcome !== null;
    },
    frame,
  );
  return copyLog(log);
}

const CASES: readonly Case[] = [
  ['level1', 0],
  ['level1', 100],
  ['level1', 150],
  ['level1', 163],
  ['level1', 164],
  ['level1', 200],
  ['level1', 500],
  ['level1', 900],
  ['level1', 1000],
  ['level1', 1500],
  ['level1', 2000],
  ['level1', 2500],
  ['level1', 4000],
  ['level1', 5000],
  ['level1', 5100],
  ['level1', 6000],
  ['level1', 8000],
  ['level2', 0],
  ['level2', 100],
  ['level2', 120],
  ['level2', 130],
  ['level2', 140],
  ['level2', 200],
  ['level2', 300],
  ['level2', 500],
  ['level2', 800],
  ['level2', 840],
  ['level2', 850],
  ['level2', 900],
  ['level2', 2000],
  ['level2', 4000],
  ['level2', 8000],
];

describe('journal = champs step* de l’instantané à chaque pas', () => {
  it('les cas couvrent victoire, choc, trop court, noLift et trop lent', () => {
    const outcomes = new Set<string>();
    for (const c of CASES) {
      const level = levelFor(c);
      playChecked(level, () => SIM_DT);
      outcomes.add(level.snapshot.outcome as string);
    }
    expect([...outcomes].sort()).toEqual(['bonk', 'noLift', 'slow', 'step', 'win']);
    expect(CASES.length).toBeGreaterThanOrEqual(30);
  });

  it.each(CASES)('%s, gain %i : chaque pas, bit à bit ; cabine reconstituée', (id, gain) => {
    const level = levelFor([id, gain]);
    expect(level.launch()).toBe('accepted');
    const log = level.tripLog;
    const seen: Row[] = [];
    const cabin: [number, number][] = [[level.snapshot.cabinY, level.snapshot.cabinVelocity]];
    until(level, () => {
      const s = level.snapshot;
      if (s.k > seen.length) {
        seen.push(snapRow(s));
        cabin.push([s.cabinY, s.cabinVelocity]);
      }
      return s.outcome !== null;
    });
    const s = level.snapshot;
    expect(log.count).toBe(s.outcomeK);
    expect(seen).toHaveLength(log.count);
    // Le journal entier, relu à l'issue, égale ce que l'instantané montrait à chaque pas.
    expect(sameLog(copyLog(log), seen)).toBe(true);
    expect(log.dt).toBe(SIM_DT);
    // Cabine au pas j : y[j], v[j] = état après le pas j − 1 ; à la fin : cabinY, cabinVelocity.
    for (let j = 0; j < log.count; j++) {
      const [y, v] = cabin[j] as [number, number];
      expect(Object.is(log.y[j], y) && Object.is(log.v[j], v), `pas ${String(j)}`).toBe(true);
    }
    expect(cabin[log.count]).toEqual([s.cabinY, s.cabinVelocity]);
    // Erreur affichée à la fin : snapshot.e = finalError, pas e[count − 1].
    expect(s.e).toBe(s.finalError);
    // Cohérence interne de chaque enregistrement.
    for (let j = 0; j < log.count; j++) {
      expect(log.uCmd[j]).toBe((log.p[j] as number) + (log.i[j] as number));
      expect(log.saturated[j]).toBe(log.uSat[j] === log.uCmd[j] ? 0 : 1);
      if (id === 'level1') expect(log.i[j]).toBe(0);
    }
  });
});

describe('journal = trajets de référence de src/proto, bit à bit', () => {
  it.each(TRAJETS_REFERENCE.map((t) => [t.id, t] as const))('%s', (_id, t) => {
    const level =
      t.niveau === 'level1'
        ? createLevel1({ animations: false, initialKp: t.kp })
        : createLevel2({ animations: false, initialKi: t.ki });
    level.interact();
    level.launch();
    until(
      level,
      () => level.snapshot.outcome !== null,
      () => 1 / 30,
    );
    const log = level.tripLog;
    expect(log.count).toBe(t.pasIssue);
    expect(level.snapshot.cabinY).toBe(t.yFinal);
    expect(level.snapshot.cabinVelocity).toBe(t.vFinal);
    for (let j = 0; j < t.pasIssue; j++) {
      const x = t.echantillons[j];
      if (x === undefined) throw new Error('échantillon manquant');
      const want: Row = [x.y, x.v, x.a, x.e, x.uCmd, x.uSat, x.p, x.i, x.saturated ? 1 : 0];
      if (!sameRow(row(log, j), want)) throw new Error(`${t.id}, pas ${String(j)}`);
    }
  });
});

describe('remise à zéro et conservation', () => {
  it('vide avant le premier lancement, au lancement, pendant l’embarquement, au départ', () => {
    for (const id of ['level1', 'level2'] as const) {
      const level = id === 'level1' ? createLevel1() : createLevel2({ initialKi: 500 });
      const log = level.tripLog;
      expect(log.count).toBe(0);
      expect(log.capacity).toBe(TRIP_MAX_STEPS);
      level.moveRight();
      for (let i = 0; i < 60; i++) level.update(1 / 60);
      expect(log.count).toBe(0);
      level.interact();
      until(level, () => level.snapshot.walkerAction === 'atPost');
      expect(log.count).toBe(0);
      level.launch();
      expect(level.snapshot.phase).toBe('boarding');
      until(level, () => {
        expect(log.count).toBe(0);
        return level.snapshot.phase !== 'boarding';
      });
      // Départ du trajet : le pas qui finit l'embarquement ne simule rien.
      expect(level.snapshot.phase).toBe('trip');
      expect(level.snapshot.k).toBe(0);
      expect(log.count).toBe(0);
      level.update(SIM_DT);
      expect(log.count).toBe(1);
    }
  });

  /** Amène un niveau animé (Ki 500, victoire) dans la phase voulue, journal non vide sauf au début. */
  function reach(phase: 'boarding' | 'trip' | 'exit' | 'outcome'): Level {
    const level = levelFor(['level2', 500], true);
    level.launch();
    if (phase === 'boarding') {
      for (let i = 0; i < 10; i++) level.update(SIM_DT);
      return level;
    }
    until(level, () => level.snapshot.phase === 'trip');
    until(level, () => level.snapshot.k >= 100 || level.snapshot.phase !== 'trip');
    if (phase === 'trip') return level;
    until(level, () => level.snapshot.phase === phase);
    return level;
  }

  it.each(['boarding', 'trip', 'exit', 'outcome'] as const)(
    'restart depuis %s : journal vidé, mêmes tableaux, trajet suivant identique',
    (phase) => {
      const level = reach(phase);
      const log = level.tripLog;
      const columns = columnsOf(log);
      expect(level.snapshot.phase).toBe(phase);
      if (phase !== 'boarding') expect(log.count).toBeGreaterThan(0);
      expect(level.restart()).toBe('accepted');
      expect(log.count).toBe(0);
      level.update(1 / 60);
      expect(log.count).toBe(0);
      // Trajet suivant, réglage changé : égal à celui d'un niveau neuf malgré les restes.
      expect(level.setTuning(2000)).toBe('accepted');
      const again = playChecked(level, () => 1 / 60);
      const fresh = playChecked(levelFor(['level2', 2000]), () => 1 / 60);
      expect(sameLog(again, fresh)).toBe(true);
      expect(level.tripLog).toBe(log);
      expectSameColumns(log, columns);
    },
  );

  it('restart refusé en pause : journal intact', () => {
    const level = reach('trip');
    const before = copyLog(level.tripLog);
    level.pause();
    expect(level.restart()).toBe('ignored');
    expect(sameLog(copyLog(level.tripLog), before)).toBe(true);
  });

  it.each([
    ['level1', 2500],
    ['level2', 500],
    ['level2', 840],
  ] as const)('%s, gain %i : conservé pendant la sortie, à l’issue et en pause', (id, gain) => {
    const level = levelFor([id, gain], true);
    level.launch();
    until(level, () => level.snapshot.outcome !== null);
    expect(level.snapshot.phase).toBe('exit');
    const judged = copyLog(level.tripLog);
    expect(judged).toHaveLength(level.snapshot.outcomeK as number);
    // Pas d'issue + 1 : aucun enregistrement supplémentaire.
    level.update(SIM_DT);
    expect(level.tripLog.count).toBe(judged.length);
    until(level, () => {
      expect(sameLog(copyLog(level.tripLog), judged)).toBe(true);
      return level.snapshot.phase === 'outcome';
    });
    for (let i = 0; i < 600; i++) level.update(1 / 60);
    expect(sameLog(copyLog(level.tripLog), judged)).toBe(true);
    level.pause();
    for (let i = 0; i < 60; i++) level.update(1 / 60);
    level.resume();
    level.update(1 / 60);
    expect(sameLog(copyLog(level.tripLog), judged)).toBe(true);
  });

  it('pause pendant le trajet : rien n’est ajouté, la suite est identique', () => {
    const reference = playChecked(levelFor(['level2', 500]), () => SIM_DT);
    const level = levelFor(['level2', 500]);
    level.launch();
    for (let i = 0; i < 50; i++) level.update(SIM_DT);
    expect(level.pause()).toBe('accepted');
    const count = level.tripLog.count;
    for (let i = 0; i < 100; i++) level.update(1 / 30);
    expect(level.tripLog.count).toBe(count);
    level.resume();
    until(level, () => level.snapshot.outcome !== null);
    expect(sameLog(copyLog(level.tripLog), reference)).toBe(true);
  });
});

describe('indépendance au découpage en images, aux animations et à skipAnimation', () => {
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
    ['level1', 0],
    ['level2', 500],
    ['level2', 2000],
    ['level2', 130],
  ] as const)('%s, gain %i : même journal pour 5 découpages', (id, gain) => {
    const reference = playChecked(levelFor([id, gain]), () => SIM_DT);
    for (const [name, make] of framings) {
      const level = levelFor([id, gain], false, make());
      const got = playChecked(level, make());
      expect(sameLog(got, reference), name).toBe(true);
    }
  });

  it.each([
    ['level1', 2500],
    ['level1', 6000],
    ['level2', 500],
    ['level2', 2000],
  ] as const)('%s, gain %i : même journal avec et sans animations', (id, gain) => {
    const without = playChecked(levelFor([id, gain]), () => SIM_DT);
    const animated = levelFor([id, gain], true);
    const got = playChecked(animated, () => 1 / 60);
    expect(sameLog(got, without)).toBe(true);
    until(
      animated,
      () => animated.snapshot.phase === 'outcome',
      () => 1 / 60,
    );
    expect(sameLog(copyLog(animated.tripLog), without)).toBe(true);
  });

  it('skipAnimation et setAnimations(false) : embarquement passé à vide, sortie sans effet', () => {
    const reference = playChecked(levelFor(['level2', 500]), () => SIM_DT);
    // Embarquement passé : le trajet part, journal vide.
    const skipped = levelFor(['level2', 500], true);
    skipped.launch();
    for (let i = 0; i < 20; i++) skipped.update(SIM_DT);
    expect(skipped.skipAnimation()).toBe('accepted');
    expect(skipped.snapshot.phase).toBe('trip');
    expect(skipped.tripLog.count).toBe(0);
    until(skipped, () => skipped.snapshot.outcome !== null);
    expect(skipped.snapshot.phase).toBe('exit');
    // Sortie passée : journal intact.
    for (let i = 0; i < 30; i++) skipped.update(SIM_DT);
    expect(skipped.skipAnimation()).toBe('accepted');
    expect(skipped.snapshot.phase).toBe('outcome');
    expect(sameLog(copyLog(skipped.tripLog), reference)).toBe(true);
    // Animations coupées pendant l'embarquement, puis pendant la sortie.
    const cut = levelFor(['level2', 500], true);
    cut.launch();
    cut.update(0.1);
    cut.setAnimations(false);
    expect(cut.snapshot.phase).toBe('trip');
    expect(cut.tripLog.count).toBe(0);
    until(cut, () => cut.snapshot.outcome !== null);
    expect(cut.snapshot.phase).toBe('outcome');
    expect(sameLog(copyLog(cut.tripLog), reference)).toBe(true);
    const late = levelFor(['level2', 500], true);
    late.launch();
    until(late, () => late.snapshot.outcome !== null);
    late.setAnimations(false);
    expect(late.snapshot.phase).toBe('outcome');
    expect(sameLog(copyLog(late.tripLog), reference)).toBe(true);
  });
});

describe('lecture seule', () => {
  it('types : colonnes sans écriture indexée ni méthode de modification', () => {
    const log = createLevel1().tripLog;
    expectTypeOf(log.y).not.toHaveProperty('set');
    expectTypeOf(log.y).not.toHaveProperty('fill');
    expectTypeOf(log.saturated).not.toHaveProperty('copyWithin');
    expectTypeOf(log).toHaveProperty('count').toEqualTypeOf<number>();
    // Vérifié par `npm run typecheck` : une écriture est une erreur de type.
    const write = (): void => {
      // @ts-expect-error -- colonne du journal en lecture seule
      log.y[0] = 1;
      // @ts-expect-error -- compteur en lecture seule
      log.count = 3;
      // @ts-expect-error -- colonne non remplaçable
      log.uSat = new Float64Array(1);
    };
    expect(typeof write).toBe('function');
  });

  it('exécution : objet gelé, compteur et colonnes non remplaçables', () => {
    const level = levelFor(['level1', 2500]);
    const log = level.tripLog;
    const y = log.y;
    expect(Object.isFrozen(log)).toBe(true);
    const mutable = log as unknown as Record<string, unknown>;
    expect(() => {
      mutable.count = 7;
    }).toThrow(TypeError);
    expect(() => {
      mutable.y = new Float64Array(3);
    }).toThrow(TypeError);
    expect(log.count).toBe(0);
    expect(log.y).toBe(y);
  });

  it('le jeu ne relit jamais le journal : le saccager ne change pas le trajet', () => {
    const reference = levelFor(['level2', 500]);
    const want = playChecked(reference, () => SIM_DT);
    const level = levelFor(['level2', 500]);
    level.launch();
    const columns = columnsOf(level.tripLog);
    until(level, () => {
      for (const c of columns) (c as unknown as Float64Array).fill(-12345);
      return level.snapshot.outcome !== null;
    });
    const s = level.snapshot;
    expect(s.outcome).toBe(reference.snapshot.outcome);
    expect(s.outcomeK).toBe(want.length);
    expect(s.finalError).toBe(reference.snapshot.finalError);
    expect(s.iTerm).toBe(reference.snapshot.iTerm);
    expect(s.cabinY).toBe(reference.snapshot.cabinY);
  });
});

describe('préallocation et capacité', () => {
  it('mêmes tableaux pour toute la vie du niveau, aucune réallocation', () => {
    const level = levelFor(['level1', 2500]);
    const log = level.tripLog;
    const columns = columnsOf(log);
    const buffers = columns.map((c) => (c as unknown as Float64Array).buffer);
    for (const gain of [2500, 8000, 0, 2500]) {
      level.setTuning(gain);
      playChecked(level, () => 1 / 60);
      for (let i = 0; i < 30; i++) level.update(1 / 60);
      expect(level.tripLog).toBe(log);
      expectSameColumns(log, columns);
      columns.forEach((c, n) => {
        expect(c.length).toBe(TRIP_MAX_STEPS);
        expect((c as unknown as Float64Array).buffer).toBe(buffers[n]);
      });
      level.restart();
    }
    expect(log.y).toBeInstanceOf(Float64Array);
    expect(log.saturated).toBeInstanceOf(Uint8Array);
  });

  it.each([
    ['level1', 0, 'noLift'],
    ['level1', 500, 'step'],
    ['level2', 130, 'slow'],
    ['level2', 0, 'step'],
  ] as const)('%s, gain %i : trajet de 1200 pas (%s) sans débordement', (id, gain, outcome) => {
    const level = levelFor([id, gain]);
    const got = playChecked(level, () => 0.25);
    expect(level.snapshot.outcome).toBe(outcome);
    expect(got).toHaveLength(TRIP_MAX_STEPS);
    expect(level.tripLog.count).toBe(level.tripLog.capacity);
    for (let i = 0; i < 10; i++) level.update(0.25);
    expect(level.tripLog.count).toBe(TRIP_MAX_STEPS);
  });

  it('createTripLog : arguments refusés, débordement signalé, clear sans effacer', () => {
    expect(() => createTripLog(0, SIM_DT)).toThrow(RangeError);
    expect(() => createTripLog(1.5, SIM_DT)).toThrow(RangeError);
    expect(() => createTripLog(2, 0)).toThrow(RangeError);
    expect(() => createTripLog(2, Number.NaN)).toThrow(RangeError);
    const writer = createTripLog(2, SIM_DT);
    const { log } = writer;
    writer.record(1, 2, 3, 4, 5, 6, 7, 8, true);
    writer.record(-0, 0, 0, 0, 0, 0, 0, 0, false);
    expect(log.count).toBe(2);
    expect(row(log, 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 1]);
    expect(Object.is(log.y[1], -0)).toBe(true);
    expect(log.saturated[1]).toBe(0);
    expect(() => {
      writer.record(0, 0, 0, 0, 0, 0, 0, 0, false);
    }).toThrow(RangeError);
    expect(log.count).toBe(2);
    writer.clear();
    expect(log.count).toBe(0);
    expect(log.y[0]).toBe(1);
  });
});
