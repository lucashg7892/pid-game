/**
 * Niveau 2 « La mémoire » (T-021b) : constantes, issues, verrou et bornes de Ki, remise à zéro,
 * instantané (dont l'intégrale), reconstruction de la boucle, indépendance au découpage en images,
 * arbitres d'issue. Les issues du vrai niveau (boucle PI du noyau, sans anti-windup) sont celles
 * mesurées : victoire pour Ki de 0 à 800 N/(m·s), choc contre la poutre de 900 à 8000.
 */
import { describe, expect, it } from 'vitest';
import {
  BEAM_HEIGHT,
  KI_DEFAULT,
  KI_MAX,
  KI_MIN,
  KI_STEP,
  KP_DEFAULT,
  KP_MAX,
  KP_MIN,
  KP_STEP,
  LEVEL1_SETPOINT,
  LEVEL2_ARRIVAL_TOLERANCE,
  LEVEL2_KP,
  STEP_TOLERANCE,
  TRIP_MAX_STEPS,
  WIN_HOLD_STEPS,
  classifyTimeout2,
  createLevel1,
  createLevel2,
  createOutcomeJudge,
  createOutcomeJudge2,
  type Level2,
  type Level2Options,
  type LevelSnapshot,
} from '../../src/game';
import { createElevatorPiLoop } from '../../src/sim';
import { bitwiseEqual, copyTrace, finishTrip, mulberry32, reachConsole } from './helpers';

/** Crée un niveau 2, règle Ki, va à la console et joue un trajet complet. */
function runKi(ki: number, frame: () => number = () => 1 / 30, options: Level2Options = {}) {
  const level = createLevel2(options);
  reachConsole(level, frame);
  expect(level.setKi(ki)).toBe('accepted');
  return { ...finishTrip(level, frame), level };
}

/** Boucle PI du noyau avec un amortissement de cabine différent (pour les issues rares). */
const withDamping = (kp: number, damping: number) => (ki: number) =>
  createElevatorPiLoop({ kp, ki, params: { mass: 50, gravity: 9.81, damping } });

describe('constantes du niveau 2', () => {
  it('Kp fixé à 2500 N/m, bornes, pas et défaut de Ki repris de ceux de Kp', () => {
    expect(LEVEL2_KP).toBe(2500);
    expect(KI_MIN).toBe(KP_MIN);
    expect(KI_MAX).toBe(KP_MAX);
    expect(KI_STEP).toBe(KP_STEP);
    expect(KI_DEFAULT).toBe(KP_DEFAULT);
  });

  it('tolérance d’arrivée propre au niveau, égale pour l’instant à celle du niveau 1', () => {
    expect(LEVEL2_ARRIVAL_TOLERANCE).toBe(STEP_TOLERANCE);
  });

  it('même poutre et même durée que le niveau 1', () => {
    expect(BEAM_HEIGHT).toBe(3.3626);
    expect(TRIP_MAX_STEPS).toBe(720);
  });
});

describe('réglage de Ki', () => {
  it('description du réglage : Ki, [0 ; 8000], pas de 100 ; Kp reste fixé', () => {
    const level = createLevel2();
    expect(level.tuning).toEqual({ param: 'ki', min: 0, max: 8000, step: 100 });
    expect(level.snapshot.levelId).toBe('level2');
    expect(level.snapshot.kp).toBe(2500);
    expect(level.snapshot.ki).toBe(KI_DEFAULT);
    expect(createLevel1().tuning).toEqual({ param: 'kp', min: 0, max: 8000, step: 100 });
  });

  it('setKi : arrondi au pas, borné, valeur non finie refusée', () => {
    const level = createLevel2();
    expect(level.setKi(149)).toBe('accepted');
    expect(level.snapshot.ki).toBe(100);
    level.setKi(150);
    expect(level.snapshot.ki).toBe(200);
    level.setKi(-50);
    expect(level.snapshot.ki).toBe(0);
    expect(Object.is(level.snapshot.ki, -0)).toBe(false);
    level.setKi(99999);
    expect(level.snapshot.ki).toBe(8000);
    level.setKi(700);
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(level.setKi(bad)).toBe('invalid');
      expect(level.snapshot.ki).toBe(700);
    }
  });

  it('adjustKi : ajoute le pas, plafonne aux bornes, écart non fini refusé', () => {
    const level = createLevel2({ initialKi: 7900 });
    expect(level.adjustKi(100)).toBe('accepted');
    expect(level.snapshot.ki).toBe(8000);
    level.adjustKi(1000);
    expect(level.snapshot.ki).toBe(8000);
    level.setKi(100);
    level.adjustKi(-1000);
    expect(level.snapshot.ki).toBe(0);
    expect(level.adjustKi(NaN)).toBe('invalid');
    expect(level.snapshot.ki).toBe(0);
  });

  it('Kp ne change jamais, quel que soit Ki', () => {
    const level = createLevel2();
    for (const ki of [0, 400, 8000]) {
      level.setKi(ki);
      expect(level.snapshot.kp).toBe(LEVEL2_KP);
    }
  });

  it('initialKi hors bornes ou non fini : RangeError ; hors grille : accepté tel quel', () => {
    expect(() => createLevel2({ initialKi: -1 })).toThrow(RangeError);
    expect(() => createLevel2({ initialKi: 8001 })).toThrow(RangeError);
    expect(() => createLevel2({ initialKi: NaN })).toThrow(RangeError);
    expect(createLevel2({ initialKi: 150 }).snapshot.ki).toBe(150);
  });

  it('verrou : Ki refusé pendant le trajet, à l’issue et en pause', () => {
    const level = createLevel2();
    reachConsole(level);
    level.setKi(300);
    level.launch();
    expect(level.setKi(500)).toBe('locked');
    expect(level.adjustKi(100)).toBe('locked');
    expect(level.adjustKi(NaN)).toBe('locked');
    expect(level.snapshot.ki).toBe(300);
    level.pause();
    expect(level.setKi(500)).toBe('locked');
    level.resume();
    for (let i = 0; i < 1000 && level.snapshot.phase === 'trip'; i++) level.update(1 / 30);
    expect(level.snapshot.phase).toBe('outcome');
    expect(level.setKi(500)).toBe('locked');
    expect(level.snapshot.ki).toBe(300);
    level.restart();
    expect(level.setKi(500)).toBe('accepted');
  });

  it('réglable en approche (avant la console)', () => {
    const level = createLevel2();
    expect(level.setKi(600)).toBe('accepted');
    expect(level.snapshot.ki).toBe(600);
  });
});

describe('issues du vrai niveau 2 (boucle PI du noyau)', () => {
  it.each([0, 100, 500, 800])('Ki = %i : victoire, la cabine finit près du plateau', (ki) => {
    const r = runKi(ki);
    expect(r.outcome).toBe('win');
    expect(Math.abs(r.finalError ?? NaN)).toBeLessThanOrEqual(LEVEL2_ARRIVAL_TOLERANCE);
    expect(r.outcomeK).toBeLessThan(TRIP_MAX_STEPS);
  });

  it('plus Ki est grand (dans la fenêtre), plus l’erreur finale est petite, puis change de signe', () => {
    const errors = [0, 200, 400, 600, 800].map((ki) => runKi(ki).finalError ?? NaN);
    for (let i = 1; i < errors.length; i++) {
      expect(errors[i]).toBeLessThan(errors[i - 1] as number);
    }
    expect(errors[0]).toBeCloseTo(490.5 / 2500, 3);
    expect(errors[4]).toBeLessThan(0);
  });

  it.each([900, 1000, 2500, 5000, 8000])('Ki = %i : choc contre la poutre', (ki) => {
    const r = runKi(ki);
    expect(r.outcome).toBe('bonk');
    expect(r.finalY).toBeGreaterThan(BEAM_HEIGHT);
    expect(r.outcomeK).toBeLessThan(120);
    expect(r.finalError).toBeLessThan(0);
  });

  it('le choc vient du windup : le terme I dépasse le poids pendant la saturation', () => {
    const r = runKi(1000);
    expect(r.saturatedSteps).toBeGreaterThan(0);
    expect(r.level.snapshot.iTerm).toBeGreaterThan(490.5);
    expect(r.level.snapshot.saturationSeen).toBe(true);
  });

  it('Ki par défaut (500) : victoire sans réglage', () => {
    const level = createLevel2();
    reachConsole(level);
    expect(finishTrip(level).outcome).toBe('win');
  });

  it('« trop court » : à la fin du temps, loin du plateau (Kp injecté trop faible)', () => {
    const r = runKi(0, () => 1 / 30, { createLoop: withDamping(500, 400) });
    expect(r.outcome).toBe('step');
    expect(r.outcomeK).toBe(TRIP_MAX_STEPS);
    expect(Math.abs(r.finalError ?? 0)).toBeGreaterThan(LEVEL2_ARRIVAL_TOLERANCE);
  });

  it('« trop lent » : à la fin du temps, dans la tolérance mais pas stabilisée (amortissement injecté)', () => {
    const r = runKi(0, () => 1 / 30, { createLoop: withDamping(2500, 5000) });
    expect(r.outcome).toBe('slow');
    expect(r.outcomeK).toBe(TRIP_MAX_STEPS);
    expect(Math.abs(r.finalError ?? NaN)).toBeLessThanOrEqual(LEVEL2_ARRIVAL_TOLERANCE);
  });
});

describe('arbitres d’issue', () => {
  it('classifyTimeout2 : step hors tolérance, slow dans la tolérance, bornes incluses', () => {
    const r = LEVEL1_SETPOINT;
    expect(classifyTimeout2(r - LEVEL2_ARRIVAL_TOLERANCE - 0.01)).toBe('step');
    expect(classifyTimeout2(r - LEVEL2_ARRIVAL_TOLERANCE)).toBe('slow');
    expect(classifyTimeout2(r)).toBe('slow');
    expect(classifyTimeout2(r + LEVEL2_ARRIVAL_TOLERANCE)).toBe('slow');
  });

  it('niveau 2 : jamais noLift, même à Kp nul ; la fin de temps dépend de la position', () => {
    const judge = createOutcomeJudge2();
    expect(judge.evaluate(TRIP_MAX_STEPS, 0, 0, 0)).toBe('step');
    judge.reset();
    expect(judge.evaluate(TRIP_MAX_STEPS, 2.9, 5, 2500)).toBe('slow');
  });

  it('niveau 2 : choc strict, victoire après 120 pas, compteur remis à zéro', () => {
    const judge = createOutcomeJudge2();
    expect(judge.evaluate(1, BEAM_HEIGHT, 0, 2500)).toBeNull();
    expect(judge.evaluate(2, BEAM_HEIGHT + 1e-9, 0, 2500)).toBe('bonk');
    judge.reset();
    for (let n = 1; n < WIN_HOLD_STEPS; n++) {
      expect(judge.evaluate(n, 2.9, 0, 2500)).toBeNull();
    }
    expect(judge.evaluate(WIN_HOLD_STEPS, 2.9, 0, 2500)).toBe('win');
    judge.reset();
    expect(judge.holdSteps).toBe(0);
  });

  it('niveau 2 : la tolérance est un paramètre (0,1 m : 0,05 m passe, 0,15 m ne passe pas)', () => {
    const judge = createOutcomeJudge2(LEVEL1_SETPOINT, 0.1);
    for (let n = 1; n < WIN_HOLD_STEPS; n++) expect(judge.evaluate(n, 2.95, 0, 0)).toBeNull();
    expect(judge.evaluate(WIN_HOLD_STEPS, 2.95, 0, 0)).toBe('win');
    judge.reset();
    for (let n = 1; n <= WIN_HOLD_STEPS + 5; n++) {
      expect(judge.evaluate(n, 2.85, 0, 0)).toBeNull();
    }
    expect(judge.holdSteps).toBe(0);
  });

  it('niveau 1 inchangé : noLift à Kp ≤ 163,5, step sinon', () => {
    const judge = createOutcomeJudge();
    expect(judge.evaluate(TRIP_MAX_STEPS, 0, 0, 100)).toBe('noLift');
    judge.reset();
    expect(judge.evaluate(TRIP_MAX_STEPS, 0, 0, 500)).toBe('step');
  });
});

describe('instantané, intégrale et remise à zéro', () => {
  it('niveau 1 : ki = 0, iTerm = 0, levelId = level1', () => {
    const level = createLevel1();
    reachConsole(level);
    level.setKp(2500);
    level.launch();
    for (let i = 0; i < 20; i++) level.update(1 / 60);
    expect(level.snapshot.levelId).toBe('level1');
    expect(level.snapshot.ki).toBe(0);
    expect(level.snapshot.iTerm).toBe(0);
  });

  it('iTerm : 0 avant le lancement, croît pendant la saturation, égal à Ki·dt·Σe', () => {
    const level = createLevel2();
    reachConsole(level);
    level.setKi(1000);
    level.launch();
    expect(level.snapshot.iTerm).toBe(0);
    const dt = 1 / 120;
    let previous = 0;
    let sum = 0;
    let steps = 0;
    for (let i = 0; i < 20; i++) {
      // Un pas de simulation par image de 1/120 s : e(k) lu avant le pas, I mis à jour après.
      sum += LEVEL1_SETPOINT - level.snapshot.cabinY;
      level.update(dt);
      steps += 1;
      expect(level.snapshot.k).toBe(steps);
      expect(level.snapshot.iTerm).toBeGreaterThan(previous);
      expect(level.snapshot.iTerm).toBeCloseTo(1000 * dt * sum, 9);
      previous = level.snapshot.iTerm;
    }
    expect(level.snapshot.saturated).toBe(true);
  });

  it('Ki = 0 : iTerm reste 0', () => {
    const r = runKi(0);
    expect(r.level.snapshot.iTerm).toBe(0);
  });

  it('restart : intégrale, compteurs et issue remis à zéro, essai suivant, Ki conservé', () => {
    const r = runKi(1000);
    const level = r.level;
    expect(level.snapshot.iTerm).toBeGreaterThan(0);
    level.restart();
    const s = level.snapshot;
    expect(s.phase).toBe('tuning');
    expect(s.iTerm).toBe(0);
    expect(s.ki).toBe(1000);
    expect(s.kp).toBe(LEVEL2_KP);
    expect(s.attempt).toBe(2);
    expect(s.outcome).toBeNull();
    expect(s.k).toBe(0);
    expect(s.saturatedSteps).toBe(0);
    expect(level.signals.length).toBe(0);
  });

  it('un second trajet au même Ki redonne exactement le même résultat (intégrale remise à zéro)', () => {
    const level = createLevel2();
    reachConsole(level);
    level.setKi(600);
    const first = finishTrip(level);
    const iFirst = level.snapshot.iTerm;
    level.restart();
    const second = finishTrip(level);
    expect(second.outcome).toBe(first.outcome);
    expect(second.outcomeK).toBe(first.outcomeK);
    expect(Object.is(second.finalError, first.finalError)).toBe(true);
    expect(level.snapshot.iTerm).toBe(iFirst);
    expect(bitwiseEqual(second.trace, first.trace)).toBe(true);
  });

  it('reconstruit la boucle quand Ki change, pas quand il ne change pas', () => {
    const made: number[] = [];
    const level = createLevel2({
      createLoop: (ki) => {
        made.push(ki);
        return createElevatorPiLoop({ kp: LEVEL2_KP, ki });
      },
    });
    expect(made).toEqual([KI_DEFAULT]);
    reachConsole(level);
    level.launch();
    expect(made).toEqual([KI_DEFAULT]);
    level.restart();
    level.launch();
    expect(made).toEqual([KI_DEFAULT]);
    level.restart();
    level.setKi(700);
    level.launch();
    expect(made).toEqual([KI_DEFAULT, 700]);
  });

  it('l’instantané est un objet unique réécrit, et ne retient pas l’état du noyau', () => {
    const level = createLevel2();
    const ref: Readonly<LevelSnapshot> = level.snapshot;
    reachConsole(level);
    level.setKi(1000);
    level.launch();
    for (let i = 0; i < 300; i++) expect(level.update(1 / 60)).toBe(ref);
    expect(level.snapshot).toBe(ref);
  });
});

describe('indépendance au découpage en images', () => {
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

  it.each([0, 500, 800, 900, 3000])(
    'Ki = %i : même issue, même pas, même erreur, même intégrale, même trace',
    (ki) => {
      const results = framings.map(([name, make]) => {
        const r = runKi(ki, make());
        return { name, r, iTerm: r.level.snapshot.iTerm };
      });
      const ref = results[0];
      if (ref === undefined) throw new Error('aucun découpage');
      for (const { name, r, iTerm } of results) {
        expect(r.outcome, name).toBe(ref.r.outcome);
        expect(r.outcomeK, name).toBe(ref.r.outcomeK);
        expect(Object.is(r.finalError, ref.r.finalError), name).toBe(true);
        expect(Object.is(iTerm, ref.iTerm), name).toBe(true);
        expect(bitwiseEqual(r.trace, ref.r.trace), name).toBe(true);
      }
    },
  );

  it('la trace du niveau 2 à Ki = 0 est celle du niveau 1 à Kp = 2500 (P identique)', () => {
    const two = runKi(0);
    const one = createLevel1();
    reachConsole(one);
    one.setKp(LEVEL2_KP);
    const r1 = finishTrip(one);
    expect(bitwiseEqual(copyTrace(one), two.trace)).toBe(true);
    expect(r1.outcomeK).toBe(two.outcomeK);
  });
});

describe('type : un Level2 est un Level', () => {
  it('expose setKi/adjustKi et les commandes communes, pas setKp', () => {
    const level: Level2 = createLevel2();
    expect(typeof level.setKi).toBe('function');
    expect(typeof level.setTuning).toBe('function');
    expect('setKp' in level).toBe(false);
  });
});
