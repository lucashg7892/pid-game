import { describe, expect, it } from 'vitest';
import {
  CABIN_CENTER_X,
  CONSOLE_REACH,
  CONSOLE_X,
  KP_DEFAULT,
  KP_MAX,
  KP_MIN,
  WALKER_MAX_X,
  WALKER_MIN_X,
  WALKER_SPAWN_X,
  createLevel1,
  type LevelSnapshot,
} from '../../src/game';
import { SIM_DT, createElevatorLoop, type SteppableClosedLoop } from '../../src/sim';
import { bitwiseEqual, finishTrip, reachConsole } from './helpers';

/** Copie profonde d'un instantané (objet plat). */
function copy(s: Readonly<LevelSnapshot>): LevelSnapshot {
  return { ...s };
}

describe('état initial et approche', () => {
  it('démarre en approche : bonhomme à l’entrée, cabine au sol, Kp par défaut, essai 1', () => {
    const level = createLevel1();
    const s = level.snapshot;
    expect(s.phase).toBe('approach');
    expect(s.walkerX).toBe(WALKER_SPAWN_X);
    expect(s.cabinY).toBe(0);
    expect(s.kp).toBe(KP_DEFAULT);
    expect(s.attempt).toBe(1);
    expect(s.r).toBe(0);
    expect(s.outcome).toBeNull();
    expect(s.atConsole).toBe(false);
  });

  it('marche bornée au décor, orientation et arrêt', () => {
    const level = createLevel1();
    expect(level.moveLeft()).toBe('accepted');
    for (let i = 0; i < 120; i++) level.update(1 / 60);
    expect(level.snapshot.walkerX).toBe(WALKER_MIN_X);
    expect(level.snapshot.walkerFacing).toBe(-1);
    expect(level.snapshot.walkerMoving).toBe(true);
    level.moveRight();
    for (let i = 0; i < 1000; i++) level.update(1 / 60);
    expect(level.snapshot.walkerX).toBe(WALKER_MAX_X);
    expect(level.snapshot.walkerFacing).toBe(1);
    expect(level.stop()).toBe('accepted');
    level.update(1 / 60);
    expect(level.snapshot.walkerMoving).toBe(false);
    expect(level.snapshot.walkerPrevX).toBe(level.snapshot.walkerX);
  });

  it('CA-5 : interact hors de la zone de la console sans effet', () => {
    const level = createLevel1();
    const before = copy(level.snapshot);
    expect(level.interact()).toBe('ignored');
    expect(level.snapshot).toEqual(before);
    expect(level.drainEvents(() => undefined)).toBe(0);
  });

  it('zone de la console : entrée, interaction, fermeture du panneau', () => {
    const level = createLevel1();
    reachConsole(level);
    const s = level.snapshot;
    expect(s.phase).toBe('tuning');
    expect(s.walkerX).toBe(CONSOLE_X);
    expect(Math.abs(s.walkerX - CONSOLE_X)).toBeLessThanOrEqual(CONSOLE_REACH);
    // En réglage : pas de marche.
    expect(level.moveLeft()).toBe('ignored');
    expect(level.interact()).toBe('accepted');
    expect(level.snapshot.phase).toBe('approach');
    expect(level.interact()).toBe('accepted');
    expect(level.snapshot.phase).toBe('tuning');
  });
});

describe('CA-5 : réglage de Kp', () => {
  it('initialKp : hors grille accepté tel quel (150), hors bornes ou non fini refusé', () => {
    const level = createLevel1({ initialKp: 150 });
    expect(level.snapshot.kp).toBe(150);
    expect(level.snapshot.theoreticalError).toBe((50 * 9.81) / 150);
    expect(createLevel1({ initialKp: 0 }).snapshot.theoreticalError).toBe(Infinity);
    for (const bad of [NaN, Infinity, -1, 8001]) {
      expect(() => createLevel1({ initialKp: bad })).toThrow(RangeError);
    }
    // Le curseur repasse sur la grille : 150 + 0 → 200 (arrondi au plus proche, demi vers +∞).
    expect(level.adjustKp(0)).toBe('accepted');
    expect(level.snapshot.kp).toBe(200);
    expect(level.setKp(150)).toBe('accepted');
    expect(level.snapshot.kp).toBe(200);
    expect(level.setKp(149)).toBe('accepted');
    expect(level.snapshot.kp).toBe(100);
  });

  it('bornes, pas de 100, arrondi, NaN et Infinity refusés', () => {
    const level = createLevel1();
    expect(level.setKp(2549)).toBe('accepted');
    expect(level.snapshot.kp).toBe(2500);
    expect(level.setKp(2550)).toBe('accepted');
    expect(level.snapshot.kp).toBe(2600);
    expect(level.setKp(-500)).toBe('accepted');
    expect(level.snapshot.kp).toBe(KP_MIN);
    expect(Object.is(level.snapshot.kp, 0)).toBe(true);
    expect(level.snapshot.theoreticalError).toBe(Infinity);
    expect(level.setKp(1e9)).toBe('accepted');
    expect(level.snapshot.kp).toBe(KP_MAX);
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(level.setKp(bad)).toBe('invalid');
      expect(level.adjustKp(bad)).toBe('invalid');
    }
    expect(level.snapshot.kp).toBe(KP_MAX);
    expect(level.adjustKp(100)).toBe('accepted');
    expect(level.snapshot.kp).toBe(KP_MAX);
    expect(level.adjustKp(-1000)).toBe('accepted');
    expect(level.snapshot.kp).toBe(7000);
    expect(level.adjustKp(-40)).toBe('accepted');
    expect(level.snapshot.kp).toBe(7000);
    expect(level.adjustKp(-60)).toBe('accepted');
    expect(level.snapshot.kp).toBe(6900);
  });

  it('Kp verrouillé pendant le trajet, à l’issue et en pause (D9), sans exception', () => {
    const level = createLevel1();
    level.setKp(2500);
    reachConsole(level);
    expect(level.launch()).toBe('accepted');
    level.update(0.1);
    for (const attempt of [
      () => level.setKp(4000),
      () => level.adjustKp(100),
      () => level.adjustKp(NaN),
      () => level.setKp(NaN),
    ]) {
      expect(attempt()).toBe('locked');
    }
    expect(level.snapshot.kp).toBe(2500);
    level.pause();
    expect(level.setKp(4000)).toBe('locked');
    level.resume();
    const r = finishTrip(level);
    expect(r.outcome).toBe('win');
    expect(level.setKp(4000)).toBe('locked');
    expect(level.snapshot.kp).toBe(2500);
    // Après restart, le réglage est de nouveau permis.
    level.restart();
    expect(level.setKp(3000)).toBe('accepted');
    expect(level.snapshot.kp).toBe(3000);
  });

  it('launch hors de la phase de réglage sans effet', () => {
    const level = createLevel1();
    expect(level.launch()).toBe('ignored');
    expect(level.snapshot.phase).toBe('approach');
    reachConsole(level);
    expect(level.launch()).toBe('accepted');
    expect(level.launch()).toBe('ignored');
    level.pause();
    expect(level.launch()).toBe('ignored');
    expect(level.snapshot.phase).toBe('paused');
  });

  it('commandes sans objet : restart hors trajet, resume hors pause, double pause', () => {
    const level = createLevel1();
    expect(level.restart()).toBe('ignored');
    expect(level.resume()).toBe('ignored');
    expect(level.pause()).toBe('accepted');
    expect(level.pause()).toBe('ignored');
    expect(level.restart()).toBe('ignored');
    expect(level.interact()).toBe('ignored');
    expect(level.moveRight()).toBe('ignored');
    expect(level.resume()).toBe('accepted');
    expect(level.snapshot.phase).toBe('approach');
  });
});

describe('CA-5 : pause', () => {
  it('aucun pas de simulation en pause, reprise sans saut de temps', () => {
    const level = createLevel1();
    level.setKp(2500);
    reachConsole(level);
    level.launch();
    for (let i = 0; i < 10; i++) level.update(1 / 60);
    // Accumulateur non entier pour vérifier qu'il est conservé.
    level.update(SIM_DT / 2);
    const before = copy(level.snapshot);
    expect(before.k).toBe(20);
    expect(level.pause()).toBe('accepted');
    expect(level.snapshot.phase).toBe('paused');
    expect(level.snapshot.resumePhase).toBe('trip');
    for (let i = 0; i < 100; i++) level.update(0.25);
    expect(level.snapshot.k).toBe(before.k);
    expect(level.snapshot.cabinY).toBe(before.cabinY);
    expect(level.snapshot.alpha).toBe(before.alpha);
    expect(level.resume()).toBe('accepted');
    expect(level.snapshot).toEqual(before);
    // Une demi-image de plus donne exactement un pas : pas de rattrapage du temps de pause.
    level.update(SIM_DT / 2);
    expect(level.snapshot.k).toBe(21);

    // Même trajet sans pause : mêmes valeurs au pas 21.
    const ref = createLevel1();
    ref.setKp(2500);
    reachConsole(ref);
    ref.launch();
    for (let i = 0; i < 10; i++) ref.update(1 / 60);
    ref.update(SIM_DT / 2);
    ref.update(SIM_DT / 2);
    expect(ref.snapshot.k).toBe(21);
    expect(ref.snapshot.cabinY).toBe(level.snapshot.cabinY);
  });

  it('pause pendant l’approche : le bonhomme ne bouge pas', () => {
    const level = createLevel1();
    level.moveRight();
    level.update(0.1);
    const x = level.snapshot.walkerX;
    level.pause();
    level.update(0.25);
    expect(level.snapshot.walkerX).toBe(x);
    level.resume();
    level.update(0.1);
    expect(level.snapshot.walkerX).toBeGreaterThan(x);
  });
});

describe('trajet et CA-4 : restart', () => {
  it('pendant le trajet : bonhomme à bord, consigne r, erreur e = r − y', () => {
    const level = createLevel1();
    level.setKp(2500);
    reachConsole(level);
    level.launch();
    const s0 = copy(level.snapshot);
    expect(s0.phase).toBe('trip');
    expect(s0.walkerInCabin).toBe(true);
    expect(s0.walkerX).toBe(CABIN_CENTER_X);
    expect(s0.r).toBe(3);
    expect(s0.e).toBe(3);
    expect(s0.k).toBe(0);
    level.update(1 / 30);
    const s = level.snapshot;
    expect(s.k).toBe(4);
    expect(s.t).toBe(4 * SIM_DT);
    expect(s.e).toBe(s.r - s.cabinY);
    expect(s.cabinY).toBeGreaterThan(s.cabinPrevY);
    expect(s.uSat).toBe(5000);
    expect(s.saturated).toBe(true);
    expect(level.signals.length).toBe(4);
  });

  it('restart restaure l’état initial du réglage et un second trajet est identique bit à bit', () => {
    const level = createLevel1();
    level.setKp(2500);
    reachConsole(level);
    const initial = copy(level.snapshot);
    const first = finishTrip(level);
    expect(first.outcome).toBe('win');
    expect(level.restart()).toBe('accepted');
    const after = copy(level.snapshot);
    expect(after.attempt).toBe(initial.attempt + 1);
    expect(after.kp).toBe(2500);
    expect({ ...after, attempt: 0 }).toEqual({ ...initial, attempt: 0 });
    expect(level.signals.length).toBe(0);
    const second = finishTrip(level);
    expect(second.outcomeK).toBe(first.outcomeK);
    expect(Object.is(second.finalError, first.finalError)).toBe(true);
    expect(bitwiseEqual(second.trace, first.trace)).toBe(true);
    expect(second.trace.length).toBe(291);
  });

  it('restart en cours de trajet et Kp changé entre deux trajets', () => {
    let built = 0;
    const level = createLevel1({
      createLoop: (kp) => {
        built += 1;
        return createLevel1Loop(kp);
      },
    });
    expect(built).toBe(1);
    reachConsole(level);
    level.setKp(2500);
    level.launch();
    expect(built).toBe(2);
    level.update(0.2);
    expect(level.restart()).toBe('accepted');
    expect(level.snapshot.k).toBe(0);
    expect(level.snapshot.cabinY).toBe(0);
    expect(level.snapshot.phase).toBe('tuning');
    // Même Kp : boucle réutilisée.
    level.launch();
    expect(built).toBe(2);
    const r = finishTrip(level);
    expect(r.outcomeK).toBe(291);
    level.restart();
    level.setKp(4500);
    const b = finishTrip(level);
    expect(built).toBe(3);
    expect(b.outcome).toBe('bonk');
    expect(b.outcomeK).toBe(58);
    expect(level.snapshot.attempt).toBe(3);
  });

  it('après l’issue, des images supplémentaires ne changent rien', () => {
    const level = createLevel1();
    level.setKp(4500);
    reachConsole(level);
    finishTrip(level);
    const end = copy(level.snapshot);
    for (let i = 0; i < 50; i++) level.update(1 / 60);
    expect(level.snapshot.k).toBe(end.k);
    expect(level.snapshot.cabinY).toBe(end.cabinY);
    expect(level.snapshot.cabinPrevY).toBe(end.cabinY);
    expect(level.snapshot.outcome).toBe('bonk');
  });
});

/** Boucle par défaut, pour compter les constructions. */
function createLevel1Loop(kp: number): SteppableClosedLoop {
  return createElevatorLoop({ kp });
}
