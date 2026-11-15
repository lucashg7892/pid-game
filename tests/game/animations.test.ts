/**
 * T-037 (D31, D32) : poste au pupitre, embarquement et sortie. Les animations avancent par pas
 * fixes de l'horloge de simulation ; le trajet (issue, pas d'issue, courbe, erreur finale, terme
 * I, pas saturés) est identique avec et sans elles, quels que soient le découpage en images, les
 * pauses, `skipAnimation` ou `setAnimations(false)` en cours de route.
 */
import { describe, expect, it } from 'vitest';
import {
  CABIN_CENTER_X,
  CONSOLE_POST_X,
  EXIT_END_X,
  EXIT_STEP_MAX_X,
  EXIT_STEP_MIN_X,
  LEVEL1_SETPOINT,
  WALKER_MAX_X,
  WALKER_MIN_X,
  WALKER_SPAWN_X,
  WALKER_SPEED,
  createLevel1,
  createLevel2,
  createWalker,
  type GameEvent,
  type Level,
  type LevelPhase,
  type TripOutcome,
  type WalkerAction,
} from '../../src/game';
import { SIM_DT } from '../../src/sim';
import { bitwiseEqual, copyTrace, mulberry32 } from './helpers';

/** Distance parcourue en un pas (m). */
const STEP = WALKER_SPEED * SIM_DT;
/** Durée théorique (en pas) d'une marche de `distance` m. */
const stepsFor = (distance: number): number => Math.abs(distance) / STEP;

/** Fabrique d'un niveau réglé sur une valeur (Kp au niveau 1, Ki au niveau 2). */
type Make = (animations: boolean) => Level;
const level1 =
  (kp: number): Make =>
  (animations) => {
    const level = createLevel1({ animations });
    level.setTuning(kp);
    return level;
  };
const level2 =
  (ki: number, exact = false): Make =>
  (animations) => {
    if (exact) return createLevel2({ animations, initialKi: ki });
    const level = createLevel2({ animations });
    level.setTuning(ki);
    return level;
  };

/** Résultat copié d'un essai complet. */
interface Played {
  outcome: TripOutcome | null;
  outcomeK: number | null;
  finalError: number | null;
  saturatedSteps: number;
  iTerm: number;
  finalY: number;
  trace: Float64Array;
  walkerX: number;
  walkerY: number;
  action: WalkerAction;
  phases: LevelPhase[];
}

/** Avance jusqu'à ce que `done` soit vrai (images de `frame()`), avec garde-fou. */
function until(level: Level, done: () => boolean, frame: () => number = () => SIM_DT): number {
  let frames = 0;
  while (!done()) {
    level.update(frame());
    frames += 1;
    if (frames > 100_000) throw new Error('condition jamais atteinte');
  }
  return frames;
}

/** Copie l'état final d'un essai. */
function result(level: Level, phases: LevelPhase[]): Played {
  const s = level.snapshot;
  return {
    outcome: s.outcome,
    outcomeK: s.outcomeK,
    finalError: s.finalError,
    saturatedSteps: s.saturatedSteps,
    iTerm: s.iTerm,
    finalY: s.cabinY,
    trace: copyTrace(level),
    walkerX: s.walkerX,
    walkerY: s.walkerY,
    action: s.walkerAction,
    phases,
  };
}

/**
 * Essai complet : E depuis l'entrée, attente du poste, lancement, jusqu'à l'issue affichée.
 * `hook` est appelé après chaque image (pauses, sauts, bascules…).
 */
function play(
  level: Level,
  frame: () => number = () => SIM_DT,
  hook: (level: Level) => void = () => undefined,
): Played {
  const phases: LevelPhase[] = [];
  const note = (): void => {
    const p = level.snapshot.phase;
    if (phases[phases.length - 1] !== p) phases.push(p);
  };
  expect(level.interact()).toBe('accepted');
  note();
  until(
    level,
    () => {
      note();
      hook(level);
      return level.snapshot.phase === 'tuning' && level.snapshot.atPost;
    },
    frame,
  );
  expect(level.launch()).toBe('accepted');
  note();
  until(
    level,
    () => {
      note();
      hook(level);
      return level.snapshot.phase === 'outcome';
    },
    frame,
  );
  note();
  return result(level, phases);
}

/** Vérifie que deux essais ont le même trajet (issue, pas, erreur, courbe, I, saturation). */
function expectSameTrip(a: Played, b: Played, label: string): void {
  expect(a.outcome, label).toBe(b.outcome);
  expect(a.outcomeK, label).toBe(b.outcomeK);
  expect(Object.is(a.finalError, b.finalError), label).toBe(true);
  expect(Object.is(a.finalY, b.finalY), label).toBe(true);
  expect(Object.is(a.iTerm, b.iTerm), label).toBe(true);
  expect(a.saturatedSteps, label).toBe(b.saturatedSteps);
  expect(bitwiseEqual(a.trace, b.trace), label).toBe(true);
}

/** Amène le bonhomme vers `x` (marche manuelle, pas d'une image de 1/120 s). */
function walkTo(level: Level, x: number): void {
  if (x > level.snapshot.walkerX) {
    level.moveRight();
    until(level, () => level.snapshot.walkerX >= x);
  } else {
    level.moveLeft();
    until(level, () => level.snapshot.walkerX <= x);
  }
  level.stop();
  level.update(SIM_DT);
}

describe('D31 : poste au pupitre', () => {
  it.each([
    ['entrée', WALKER_SPAWN_X],
    ['milieu du quai', -3],
    ['bord droit', WALKER_MAX_X],
  ])(
    'E depuis %s : panneau ouvert tout de suite, marche au poste en distance / vitesse',
    (_n, x) => {
      const level = createLevel1();
      if (x !== WALKER_SPAWN_X) walkTo(level, x);
      const start = level.snapshot.walkerX;
      expect(level.interact()).toBe('accepted');
      // Panneau ouvert au pas 0 : phase `tuning`, marche vers le poste pas encore commencée.
      let s = level.snapshot;
      expect(s.phase).toBe('tuning');
      expect(s.walkerAction).toBe('toPost');
      expect(s.walkerMoving).toBe(true);
      expect(s.atPost).toBe(false);
      expect(s.walkerX).toBe(start);
      // Réglage permis pendant la marche, aucun verrou.
      expect(level.setTuning(3000)).toBe('accepted');
      const toLeft = start > CONSOLE_POST_X;
      let steps = 0;
      while (!level.snapshot.atPost) {
        level.update(SIM_DT);
        steps += 1;
        s = level.snapshot;
        expect(s.walkerX).toBeGreaterThanOrEqual(WALKER_MIN_X);
        expect(s.walkerX).toBeLessThanOrEqual(WALKER_MAX_X);
        expect(s.walkerY).toBe(0);
        if (!s.atPost) {
          expect(s.walkerFacing).toBe(toLeft ? -1 : 1);
          expect(Math.abs(s.walkerX - s.walkerPrevX)).toBeCloseTo(STEP, 12);
          expect(s.animationStep).toBe(steps);
        }
        if (steps > 10_000) throw new Error('poste jamais atteint');
      }
      expect(Math.abs(steps - stepsFor(CONSOLE_POST_X - start))).toBeLessThanOrEqual(1);
      s = level.snapshot;
      expect(s.walkerX).toBe(CONSOLE_POST_X);
      expect(s.walkerFacing).toBe(1);
      expect(s.walkerAction).toBe('atPost');
      expect(s.walkerMoving).toBe(false);
      expect(s.animationStep).toBe(0);
      expect(s.atConsole).toBe(true);
      expect(s.kp).toBe(3000);
      // Il reste au poste.
      for (let i = 0; i < 60; i++) level.update(1 / 60);
      expect(level.snapshot.walkerX).toBe(CONSOLE_POST_X);
      expect(level.snapshot.walkerPrevX).toBe(CONSOLE_POST_X);
    },
  );

  it('le poste ne chevauche pas le pupitre et reste sur le quai, dans la zone de la console', () => {
    // Bord gauche du pupitre dessiné : CONSOLE_X − 0,30 = −1,30 m ; demi-largeur du bonhomme 0,14 m.
    expect(CONSOLE_POST_X + 0.14).toBeLessThan(-1.3);
    expect(CONSOLE_POST_X).toBeGreaterThan(WALKER_MIN_X);
    expect(CONSOLE_POST_X).toBeLessThan(WALKER_MAX_X);
  });

  it('refermer le réglage pendant la marche : le bonhomme s’arrête et redevient libre ; au poste aussi', () => {
    const level = createLevel1();
    level.interact();
    for (let i = 0; i < 40; i++) level.update(SIM_DT);
    const x = level.snapshot.walkerX;
    expect(level.interact()).toBe('accepted');
    let s = level.snapshot;
    expect(s.phase).toBe('approach');
    expect(s.walkerAction).toBe('free');
    expect(s.walkerMoving).toBe(false);
    level.update(0.5);
    expect(level.snapshot.walkerX).toBe(x);
    expect(level.moveLeft()).toBe('accepted');
    level.update(0.1);
    expect(level.snapshot.walkerX).toBeLessThan(x);
    // Rouvert puis refermé au poste : libre, à l'arrêt, au poste.
    level.stop();
    level.interact();
    until(level, () => level.snapshot.atPost);
    expect(level.interact()).toBe('accepted');
    s = level.snapshot;
    expect(s.walkerAction).toBe('free');
    expect(s.walkerX).toBe(CONSOLE_POST_X);
    expect(level.moveRight()).toBe('accepted');
  });

  it('E au poste exactement : au poste aussitôt ; marche refusée en réglage', () => {
    const level = createLevel1();
    level.interact();
    until(level, () => level.snapshot.atPost);
    level.interact();
    expect(level.interact()).toBe('accepted');
    expect(level.snapshot.atPost).toBe(true);
    expect(level.snapshot.animationStep).toBe(0);
    expect(level.moveLeft()).toBe('ignored');
  });
});

describe('D32 : embarquement', () => {
  it('durée = distance / vitesse ; k = 0 à la fin de l’embarquement ; trajet ensuite comme sans animations', () => {
    const level = level1(2500)(true);
    level.interact();
    until(level, () => level.snapshot.atPost);
    expect(level.launch()).toBe('accepted');
    let s = level.snapshot;
    expect(s.phase).toBe('boarding');
    expect(s.walkerAction).toBe('boarding');
    expect(s.k).toBe(0);
    expect(s.r).toBe(0);
    expect(s.walkerInCabin).toBe(false);
    // Verrous pendant l'embarquement.
    expect(level.launch()).toBe('ignored');
    expect(level.setTuning(4000)).toBe('locked');
    expect(level.adjustTuning(Number.NaN)).toBe('locked');
    expect(level.moveRight()).toBe('ignored');
    expect(level.interact()).toBe('ignored');
    let steps = 0;
    while (level.snapshot.phase === 'boarding') {
      level.update(SIM_DT);
      steps += 1;
      s = level.snapshot;
      expect(s.cabinY).toBe(0);
      expect(s.walkerY).toBe(0);
      expect(s.walkerFacing).toBe(1);
      expect(level.signals.length).toBe(0);
    }
    expect(Math.abs(steps - stepsFor(CABIN_CENTER_X - CONSOLE_POST_X))).toBeLessThanOrEqual(1);
    s = level.snapshot;
    expect(s.phase).toBe('trip');
    expect(s.k).toBe(0);
    expect(s.t).toBe(0);
    expect(s.r).toBe(LEVEL1_SETPOINT);
    expect(s.walkerX).toBe(CABIN_CENTER_X);
    expect(s.walkerInCabin).toBe(true);
    expect(s.walkerAction).toBe('inCabin');
    expect(level.signals.length).toBe(0);
    level.update(SIM_DT);
    expect(level.snapshot.k).toBe(1);
    expect(level.snapshot.walkerY).toBe(level.snapshot.cabinY);
    expect(level.snapshot.walkerPrevY).toBe(level.snapshot.cabinPrevY);
  });

  it('lancer pendant la marche vers le poste : embarquement depuis là où il est', () => {
    const level = createLevel1();
    level.interact();
    for (let i = 0; i < 100; i++) level.update(SIM_DT);
    const x = level.snapshot.walkerX;
    expect(level.launch()).toBe('accepted');
    const steps = until(level, () => level.snapshot.phase === 'trip');
    expect(Math.abs(steps - stepsFor(CABIN_CENTER_X - x))).toBeLessThanOrEqual(1);
  });

  it('sans animations : lancement → trajet aussitôt, bonhomme dans la cabine', () => {
    const level = createLevel1({ animations: false });
    level.interact();
    level.launch();
    expect(level.snapshot.phase).toBe('trip');
    expect(level.snapshot.walkerX).toBe(CABIN_CENTER_X);
    expect(level.snapshot.walkerAction).toBe('inCabin');
  });
});

/** Grille des réglages gagnants : niveau 1 (Kp) et niveau 2 (Ki, dont 800 : cabine trop haute). */
const WINNERS: readonly [string, Make][] = [
  ...[1000, 1500, 2000, 2500, 3000, 4000, 5000].map((kp): [string, Make] => [
    `niveau 1, Kp = ${String(kp)}`,
    level1(kp),
  ]),
  ...[200, 300, 400, 500, 600, 700, 800].map((ki): [string, Make] => [
    `niveau 2, Ki = ${String(ki)}`,
    level2(ki),
  ]),
  // Hors grille, au pas de 10 : erreurs négatives de quelques millimètres (cabine trop haute).
  ['niveau 2, Ki = 780 (hors grille)', level2(780, true)],
  ['niveau 2, Ki = 840 (hors grille)', level2(840, true)],
];

describe('D32 : sortie après une victoire', () => {
  it.each(WINNERS)(
    '%s : pas de sortie de hauteur r − y_final, continu, issue affichée à la fin',
    (_name, make) => {
      const level = make(true);
      level.interact();
      until(level, () => level.snapshot.atPost);
      level.launch();
      const events: GameEvent[] = [];
      const drain = (): void => {
        level.drainEvents((e) => events.push({ ...e }));
      };
      until(level, () => {
        drain();
        return level.snapshot.phase !== 'boarding' && level.snapshot.phase !== 'trip';
      });
      let s = level.snapshot;
      // Pas de victoire : issue jugée, figée, mais pas encore affichée ni annoncée.
      expect(s.phase).toBe('exit');
      expect(s.outcome).toBe('win');
      const outcomeK = s.outcomeK;
      const finalError = s.finalError as number;
      const yFinal = s.cabinY;
      expect(Object.is(finalError, LEVEL1_SETPOINT - yFinal)).toBe(true);
      expect(events.filter((e) => e.type === 'outcome')).toHaveLength(0);
      expect(s.walkerY).toBe(yFinal);
      expect(s.walkerX).toBe(CABIN_CENTER_X);
      expect(s.walkerInCabin).toBe(true);
      const traceLength = level.signals.length;
      // Plafond de variation de la hauteur des pieds par pas : |e| × pas / longueur du pas.
      const maxDy = (Math.abs(finalError) * STEP) / (EXIT_STEP_MAX_X - EXIT_STEP_MIN_X) + 1e-12;
      let steps = 0;
      let stepped = false;
      while (level.snapshot.phase === 'exit') {
        const prevY = level.snapshot.walkerY;
        level.update(SIM_DT);
        drain();
        steps += 1;
        s = level.snapshot;
        // Cabine figée, physique arrêtée.
        expect(s.cabinY).toBe(yFinal);
        expect(s.cabinPrevY).toBe(yFinal);
        expect(s.k).toBe(outcomeK);
        expect(level.signals.length).toBe(traceLength);
        expect(s.walkerFacing).toBe(1);
        expect(s.walkerPrevY).toBe(prevY);
        expect(Math.abs(s.walkerY - prevY)).toBeLessThanOrEqual(maxDy);
        // Monotone : monte si la cabine est trop basse, descend si elle est trop haute.
        expect(Math.sign(s.walkerY - prevY) * Math.sign(finalError)).toBeGreaterThanOrEqual(0);
        if (s.walkerAction === 'stepping') {
          stepped = true;
          expect(s.exitStepProgress).toBeGreaterThan(0);
          expect(s.exitStepProgress).toBeLessThan(1);
          expect(s.walkerInCabin).toBe(false);
        }
        if (s.phase === 'exit') expect(events.filter((e) => e.type === 'outcome')).toHaveLength(0);
      }
      expect(stepped).toBe(true);
      expect(Math.abs(steps - stepsFor(EXIT_END_X - CABIN_CENTER_X))).toBeLessThanOrEqual(1);
      s = level.snapshot;
      expect(s.phase).toBe('outcome');
      expect(s.walkerAction).toBe('arrived');
      expect(s.walkerX).toBe(EXIT_END_X);
      expect(s.walkerY).toBe(LEVEL1_SETPOINT);
      expect(s.exitStepProgress).toBe(1);
      expect(s.walkerInCabin).toBe(false);
      // Hauteur exacte du pas : lue sur l'état figé.
      expect(Object.is(s.walkerY - yFinal, finalError)).toBe(true);
      expect(s.outcomeK).toBe(outcomeK);
      expect(Object.is(s.finalError, finalError)).toBe(true);
      // Annoncée une fois, à la fin de la sortie, avec le pas de l'issue.
      const announced = events.filter((e) => e.type === 'outcome');
      expect(announced).toEqual([{ type: 'outcome', k: outcomeK, outcome: 'win', attempt: 1 }]);
      for (let i = 0; i < 30; i++) level.update(1 / 60);
      expect(level.snapshot.walkerX).toBe(EXIT_END_X);
      expect(level.snapshot.walkerPrevY).toBe(LEVEL1_SETPOINT);
    },
  );

  it('signes : la grille contient des pas qui montent (e > 0) et qui descendent (e < 0)', () => {
    const signs = new Set<number>();
    for (const [, make] of WINNERS) {
      const level = make(false);
      level.interact();
      level.launch();
      until(level, () => level.snapshot.phase === 'outcome');
      expect(level.snapshot.outcome).toBe('win');
      signs.add(Math.sign(level.snapshot.finalError as number));
    }
    expect([...signs].sort()).toEqual([-1, 1]);
  });

  it('sans animations : issue au pas de victoire, bonhomme resté dans la cabine', () => {
    const level = level1(2500)(false);
    level.interact();
    level.launch();
    until(level, () => level.snapshot.phase !== 'trip');
    const s = level.snapshot;
    expect(s.phase).toBe('outcome');
    expect(s.outcome).toBe('win');
    expect(s.walkerAction).toBe('inCabin');
    expect(s.walkerX).toBe(CABIN_CENTER_X);
    expect(s.walkerY).toBe(s.cabinY);
  });
});

/** Échecs de chaque type, aux deux niveaux. */
const FAILURES: readonly [string, TripOutcome, Make][] = [
  ['niveau 1, Kp = 100', 'noLift', level1(100)],
  ['niveau 1, Kp = 800', 'step', level1(800)],
  ['niveau 1, Kp = 7000', 'bonk', level1(7000)],
  ['niveau 2, Ki = 0', 'step', level2(0)],
  ['niveau 2, Ki = 130 (hors grille)', 'slow', level2(130, true)],
  ['niveau 2, Ki = 2000', 'bonk', level2(2000)],
];

describe('D32 : échecs inchangés', () => {
  it.each(FAILURES)(
    '%s : issue « %s » affichée au pas de fin, sans sortie',
    (_name, expected, make) => {
      const level = make(true);
      const events: GameEvent[] = [];
      const r = play(
        level,
        () => SIM_DT,
        (l) => {
          l.drainEvents((e) => events.push({ ...e }));
          if (l.snapshot.phase === 'outcome') {
            // Au plus tard à l'image du pas d'issue : l'issue est annoncée tout de suite.
            expect(events.some((e) => e.type === 'outcome')).toBe(true);
          }
        },
      );
      expect(r.outcome).toBe(expected);
      expect(r.phases).not.toContain('exit');
      expect(r.phases).toEqual(['tuning', 'boarding', 'trip', 'outcome']);
      expect(r.action).toBe('inCabin');
      expect(r.walkerX).toBe(CABIN_CENTER_X);
      expect(r.walkerY).toBe(r.finalY);
      expect(level.snapshot.walkerInCabin).toBe(true);
      expect(level.skipAnimation()).toBe('ignored');
    },
  );
});

describe('identité du trajet avec et sans animations', () => {
  const grid: [string, Make][] = [];
  for (let v = 0; v <= 8000; v += 100) {
    grid.push([`niveau 1, Kp = ${String(v)}`, level1(v)]);
    grid.push([`niveau 2, Ki = ${String(v)}`, level2(v)]);
  }
  grid.push([
    'niveau 1, Kp = 150 (hors grille)',
    (a) => createLevel1({ animations: a, initialKp: 150 }),
  ]);
  grid.push(['niveau 2, Ki = 130 (hors grille)', level2(130, true)]);

  it(`${String(grid.length)} réglages : même issue, même pas, même erreur, même courbe, même I`, () => {
    for (const [name, make] of grid) {
      const off = play(make(false));
      const on = play(make(true));
      expectSameTrip(on, off, name);
      expect(off.phases, name).not.toContain('boarding');
      expect(off.phases, name).not.toContain('exit');
      expect(on.phases, name).toContain('boarding');
      expect(on.phases.includes('exit'), name).toBe(on.outcome === 'win');
    }
  });
});

/** Découpages d'images (modèle : frames.test.ts). */
function framings(): [string, () => () => number][] {
  return [
    ['1/120 s', () => () => SIM_DT],
    ['1/30 s', () => () => 1 / 30],
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
}

/** État du bonhomme relevé à une image, repéré par la phase et le pas d'animation. */
type Pose = [x: number, y: number, p: number];

describe('indépendance du découpage en images, nouvelles phases', () => {
  it.each([
    ['niveau 1, Kp = 2500 (victoire)', level1(2500)],
    ['niveau 1, Kp = 7000 (choc)', level1(7000)],
    ['niveau 2, Ki = 800 (victoire, e < 0)', level2(800)],
  ])('%s : mêmes positions à chaque pas d’animation, même trajet, même arrivée', (_n, make) => {
    let ref: Played | null = null;
    let refPoses: Map<string, Pose> | null = null;
    for (const [name, makeFrame] of framings()) {
      const poses = new Map<string, Pose>();
      const r = play(make(true), makeFrame(), (l) => {
        const s = l.snapshot;
        if (s.animationStep > 0) {
          poses.set(`${s.phase}:${String(s.animationStep)}`, [
            s.walkerX,
            s.walkerY,
            s.exitStepProgress,
          ]);
        }
      });
      if (ref === null || refPoses === null) {
        ref = r;
        refPoses = poses;
        continue;
      }
      expectSameTrip(r, ref, name);
      expect(r.walkerX, name).toBe(ref.walkerX);
      expect(r.walkerY, name).toBe(ref.walkerY);
      expect(r.action, name).toBe(ref.action);
      expect(poses.size, name).toBeGreaterThan(0);
      for (const [key, pose] of poses) {
        const expected = refPoses.get(key);
        expect(expected, `${name} ${key}`).toBeDefined();
        expect(pose, `${name} ${key}`).toEqual(expected);
      }
    }
  });
});

describe('pause dans chaque nouvelle phase', () => {
  it.each([
    ['marche vers le poste', 'tuning', 50],
    ['embarquement', 'boarding', 100],
    ['sortie', 'exit', 100],
  ] as const)(
    '%s : rien ne bouge en pause, reprise sans saut, trajet identique',
    (_n, at, after) => {
      const ref = play(level1(2500)(true));
      const level = level1(2500)(true);
      let paused = false;
      const r = play(
        level,
        () => SIM_DT,
        (l) => {
          const s = l.snapshot;
          if (!paused && s.phase === at && s.animationStep === after) {
            paused = true;
            expect(l.pause()).toBe('accepted');
            const before = { ...l.snapshot };
            expect(before.resumePhase).toBe(at);
            expect(l.skipAnimation()).toBe('ignored');
            expect(l.launch()).toBe('ignored');
            for (let i = 0; i < 50; i++) l.update(0.25);
            expect(l.snapshot).toEqual(before);
            expect(l.resume()).toBe('accepted');
            expect(l.snapshot.phase).toBe(at);
            expect(l.snapshot.animationStep).toBe(after);
          }
        },
      );
      expect(paused).toBe(true);
      expectSameTrip(r, ref, at);
      expect(r.walkerX).toBe(ref.walkerX);
      expect(r.walkerY).toBe(ref.walkerY);
    },
  );
});

describe('skipAnimation', () => {
  it('sans objet hors animation : approche, réglage au poste, trajet, issue, pause', () => {
    const level = level1(2500)(true);
    expect(level.skipAnimation()).toBe('ignored');
    level.interact();
    level.pause();
    expect(level.skipAnimation()).toBe('ignored');
    level.resume();
    expect(level.skipAnimation()).toBe('accepted');
    expect(level.snapshot.atPost).toBe(true);
    expect(level.snapshot.walkerPrevX).toBe(CONSOLE_POST_X);
    expect(level.skipAnimation()).toBe('ignored');
    level.launch();
    expect(level.skipAnimation()).toBe('accepted');
    expect(level.snapshot.phase).toBe('trip');
    expect(level.skipAnimation()).toBe('ignored');
  });

  it('à chaque pas de la marche vers le poste et de l’embarquement : même trajet', () => {
    const ref = play(level1(2500)(false));
    const walk = Math.ceil(stepsFor(CONSOLE_POST_X - WALKER_SPAWN_X));
    for (let n = 0; n <= walk; n += 1) {
      const level = level1(2500)(true);
      level.interact();
      for (let i = 0; i < n; i++) level.update(SIM_DT);
      if (!level.snapshot.atPost) {
        expect(level.skipAnimation()).toBe('accepted');
      }
      const s = level.snapshot;
      expect(s.walkerX).toBe(CONSOLE_POST_X);
      expect(s.walkerFacing).toBe(1);
      expect(s.atPost).toBe(true);
    }
    const board = Math.ceil(stepsFor(CABIN_CENTER_X - CONSOLE_POST_X));
    for (let n = 0; n < board; n += 1) {
      const level = level1(2500)(true);
      level.interact();
      level.skipAnimation();
      level.launch();
      for (let i = 0; i < n; i++) level.update(SIM_DT);
      expect(level.snapshot.phase, `n = ${String(n)}`).toBe('boarding');
      expect(level.skipAnimation()).toBe('accepted');
      const s = level.snapshot;
      expect(s.phase).toBe('trip');
      expect(s.k).toBe(0);
      expect(s.walkerX).toBe(CABIN_CENTER_X);
      expect(s.walkerPrevX).toBe(CABIN_CENTER_X);
      expect(s.walkerInCabin).toBe(true);
      until(level, () => level.snapshot.phase === 'exit');
      const r = result(level, []);
      expect(r.outcomeK).toBe(ref.outcomeK);
      expect(Object.is(r.finalError, ref.finalError)).toBe(true);
      expect(bitwiseEqual(r.trace, ref.trace)).toBe(true);
    }
  });

  it('à chaque pas de la sortie : bonhomme sur le plateau, issue affichée et annoncée une fois', () => {
    const ref = play(level1(2500)(true));
    const exit = Math.ceil(stepsFor(EXIT_END_X - CABIN_CENTER_X));
    for (let n = 0; n < exit; n += 1) {
      const level = level1(2500)(true);
      level.interact();
      level.skipAnimation();
      level.launch();
      level.skipAnimation();
      until(level, () => level.snapshot.phase === 'exit');
      for (let i = 0; i < n; i++) level.update(SIM_DT);
      expect(level.snapshot.phase).toBe('exit');
      const events: GameEvent[] = [];
      level.drainEvents((e) => events.push({ ...e }));
      expect(events.some((e) => e.type === 'outcome')).toBe(false);
      expect(level.skipAnimation()).toBe('accepted');
      const s = level.snapshot;
      expect(s.phase).toBe('outcome');
      expect(s.walkerX).toBe(EXIT_END_X);
      expect(s.walkerPrevX).toBe(EXIT_END_X);
      expect(s.walkerY).toBe(LEVEL1_SETPOINT);
      expect(s.walkerPrevY).toBe(LEVEL1_SETPOINT);
      expect(s.walkerAction).toBe('arrived');
      level.drainEvents((e) => events.push({ ...e }));
      expect(events.filter((e) => e.type === 'outcome')).toEqual([
        { type: 'outcome', k: ref.outcomeK, outcome: 'win', attempt: 1 },
      ]);
      expectSameTrip(result(level, []), ref, `n = ${String(n)}`);
      expect(level.skipAnimation()).toBe('ignored');
    }
  });
});

describe('setAnimations', () => {
  it('false en cours d’animation : la termine aussitôt ; true ensuite : animé de nouveau', () => {
    const ref = play(level1(2500)(false));
    const level = level1(2500)(true);
    expect(level.snapshot.animations).toBe(true);
    level.interact();
    level.update(0.2);
    level.setAnimations(false);
    expect(level.snapshot.animations).toBe(false);
    expect(level.snapshot.atPost).toBe(true);
    level.setAnimations(true);
    level.launch();
    level.update(0.2);
    expect(level.snapshot.phase).toBe('boarding');
    level.setAnimations(false);
    expect(level.snapshot.phase).toBe('trip');
    expect(level.snapshot.k).toBe(0);
    level.setAnimations(true);
    until(level, () => level.snapshot.phase === 'exit');
    level.update(0.5);
    level.setAnimations(false);
    expect(level.snapshot.phase).toBe('outcome');
    expect(level.snapshot.walkerX).toBe(EXIT_END_X);
    expectSameTrip(result(level, []), ref, 'bascules');
    // Sans effet hors animation.
    level.setAnimations(false);
    expect(level.snapshot.phase).toBe('outcome');
  });

  it('false pendant une pause : la phase à reprendre suit (embarquement → trajet, sortie → issue)', () => {
    const level = level1(2500)(true);
    level.interact();
    level.skipAnimation();
    level.launch();
    level.update(0.1);
    level.pause();
    level.setAnimations(false);
    expect(level.snapshot.phase).toBe('paused');
    expect(level.snapshot.resumePhase).toBe('trip');
    level.resume();
    expect(level.snapshot.phase).toBe('trip');
    level.setAnimations(true);
    until(level, () => level.snapshot.phase === 'exit');
    level.pause();
    const events: GameEvent[] = [];
    level.drainEvents(() => undefined);
    level.setAnimations(false);
    level.drainEvents((e) => events.push({ ...e }));
    expect(level.snapshot.resumePhase).toBe('outcome');
    expect(events.map((e) => e.type)).toEqual(['outcome']);
    level.resume();
    expect(level.snapshot.phase).toBe('outcome');
  });
});

describe('restart depuis chaque phase', () => {
  it.each(['boarding', 'trip', 'exit', 'outcome'] as const)(
    'depuis %s : retour au réglage, bonhomme au poste, essai suivant, trajet identique',
    (from) => {
      const ref = play(level1(2500)(true));
      const level = level1(2500)(true);
      level.interact();
      until(level, () => level.snapshot.atPost);
      level.launch();
      until(level, () => level.snapshot.phase === from);
      level.update(0.1);
      level.drainEvents(() => undefined);
      expect(level.restart()).toBe('accepted');
      const s = level.snapshot;
      expect(s.phase).toBe('tuning');
      expect(s.attempt).toBe(2);
      expect(s.walkerX).toBe(CONSOLE_POST_X);
      expect(s.walkerY).toBe(0);
      expect(s.walkerAction).toBe('atPost');
      expect(s.cabinY).toBe(0);
      expect(s.k).toBe(0);
      expect(s.outcome).toBeNull();
      expect(s.exitStepProgress).toBe(0);
      expect(level.signals.length).toBe(0);
      const types: string[] = [];
      level.drainEvents((e) => types.push(e.type));
      expect(types).toEqual(['reset']);
      expect(level.launch()).toBe('accepted');
      until(level, () => level.snapshot.phase === 'outcome');
      expectSameTrip(result(level, []), ref, from);
    },
  );

  it('restart refusé en approche, en réglage et en pause', () => {
    const level = createLevel1();
    expect(level.restart()).toBe('ignored');
    level.interact();
    expect(level.restart()).toBe('ignored');
    level.launch();
    level.pause();
    expect(level.restart()).toBe('ignored');
  });
});

describe('options et marche automatique', () => {
  it('animations par défaut aux deux niveaux ; option de fabrique respectée', () => {
    expect(createLevel1().snapshot.animations).toBe(true);
    expect(createLevel2().snapshot.animations).toBe(true);
    expect(createLevel1({ animations: false }).snapshot.animations).toBe(false);
    expect(createLevel2({ animations: false }).snapshot.animations).toBe(false);
  });

  it('stepToward : orientation vers la cible, arrivée exacte, sans les bornes du quai', () => {
    const w = createWalker();
    expect(w.stepToward(WALKER_SPAWN_X, SIM_DT)).toBe(true);
    expect(w.facing).toBe(1);
    expect(w.stepToward(WALKER_SPAWN_X - 1, SIM_DT)).toBe(false);
    expect(w.facing).toBe(-1);
    expect(w.x).toBeLessThan(WALKER_MIN_X);
    expect(w.prevX).toBe(WALKER_SPAWN_X);
    w.face(1);
    expect(w.facing).toBe(1);
    expect(w.x).toBe(WALKER_SPAWN_X - STEP);
  });
});

describe('allocation et instantané', () => {
  it('instantané réutilisé dans toutes les phases animées, aux deux niveaux', () => {
    for (const make of [level1(2500), level2(500)]) {
      const level = make(true);
      const ref = level.snapshot;
      const r = play(
        level,
        () => 1 / 60,
        (l) => {
          expect(l.snapshot).toBe(ref);
        },
      );
      expect(r.phases).toEqual(['tuning', 'boarding', 'trip', 'exit', 'outcome']);
      expect(level.update(1 / 60)).toBe(ref);
    }
  });
});
