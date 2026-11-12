import { describe, expect, it } from 'vitest';
import {
  ELEVATOR_MAX_FORCE,
  ELEVATOR_PARAMS,
  ELEVATOR_SETPOINT,
  SIM_DT,
  createClosedLoop,
  createElevator,
  createElevatorLoop,
  createProportionalController,
  createRk4,
  createSaturation,
  saturate,
  MAX_SIM_DT,
  type ClosedLoopConfig,
  type Controller,
  type LoopSample,
  type PlantModel,
} from '../../src/sim';

/** Copie les valeurs d'un échantillon (l'objet renvoyé par step est réutilisé). */
function snapshot(s: LoopSample): number[] {
  return [s.k, s.t, s.r, s.y, s.e, s.uCmd, s.uSat, s.saturated ? 1 : 0, ...Array.from(s.x)];
}

describe('contrôleur proportionnel', () => {
  it('u = Kp·(r − y), sans état ni dépendance à dt', () => {
    const p = createProportionalController(2500);
    expect(p.kp).toBe(2500);
    expect(p.update(3, 0, SIM_DT)).toBe(7500);
    expect(p.update(3, 3.5, 1)).toBe(-1250);
    p.reset();
    expect(p.update(3, 0, 0.5)).toBe(7500);
    expect(createProportionalController(0).update(3, 0, SIM_DT)).toBe(0);
  });

  it('Kp invalide : RangeError', () => {
    expect(() => createProportionalController(-1)).toThrow(RangeError);
    expect(() => createProportionalController(Number.NaN)).toThrow(RangeError);
    expect(() => createProportionalController(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('modèle de l’ascenseur', () => {
  const { mass, gravity, damping } = ELEVATOR_PARAMS;

  it('paramètres de la spec §5 figés', () => {
    expect(ELEVATOR_PARAMS).toEqual({ mass: 50, gravity: 9.81, damping: 400 });
    expect(Object.isFrozen(ELEVATOR_PARAMS)).toBe(true);
    expect(ELEVATOR_SETPOINT).toBe(3);
  });

  it('dérivée : ẏ et (u − m·g − c·ẏ)/m ; sortie y', () => {
    const plant = createElevator();
    const out = new Float64Array(2);
    const x = new Float64Array([1.2, 0.7]);
    plant.derivative(x, 1000, out);
    expect(out[0]).toBe(0.7);
    expect(out[1]).toBeCloseTo((1000 - mass * gravity - damping * 0.7) / mass, 12);
    expect(plant.output(x)).toBe(1.2);
    expect(Array.from(x)).toEqual([1.2, 0.7]); // x non modifié
  });

  it('contrainte sol : y < 0 ⇒ y = 0 et ẏ = max(ẏ, 0) ; sinon inchangé', () => {
    const plant = createElevator();
    const below = new Float64Array([-0.01, -2]);
    plant.constrain(below);
    expect(Array.from(below)).toEqual([0, 0]);
    const rising = new Float64Array([-0.01, 1.5]);
    plant.constrain(rising);
    expect(Array.from(rising)).toEqual([0, 1.5]);
    const above = new Float64Array([0.5, -3]);
    plant.constrain(above);
    expect(Array.from(above)).toEqual([0.5, -3]);
  });

  it('paramètres invalides : RangeError', () => {
    expect(() => createElevator({ mass: 0, gravity, damping })).toThrow(RangeError);
    expect(() => createElevator({ mass: Number.NaN, gravity, damping })).toThrow(RangeError);
    expect(() => createElevator({ mass, gravity: Number.NaN, damping })).toThrow(RangeError);
    expect(() => createElevator({ mass, gravity, damping: -1 })).toThrow(RangeError);
    expect(() => createElevator({ mass, gravity, damping: Number.POSITIVE_INFINITY })).toThrow(
      RangeError,
    );
  });
});

describe('boucle fermée', () => {
  it('LoopSample cohérent : k, t = k·dt, e = r − y, uSat = sat(uCmd), drapeau, x après le pas', () => {
    const loop = createElevatorLoop({ kp: 3500 });
    const sat = createSaturation(-ELEVATOR_MAX_FORCE, ELEVATOR_MAX_FORCE);
    let previousX = Array.from(loop.x);
    let saturatedSeen = 0;
    for (let k = 0; k < 1200; k++) {
      const s = loop.step();
      expect(s.k).toBe(k);
      expect(s.t).toBe(k * SIM_DT);
      expect(s.r).toBe(ELEVATOR_SETPOINT);
      expect(s.y).toBe(previousX[0]); // mesure faite avant l'intégration
      expect(s.e).toBe(s.r - s.y);
      expect(s.uCmd).toBe(3500 * (s.r - s.y));
      expect(s.uSat).toBe(saturate(s.uCmd, sat));
      expect(s.saturated).toBe(s.uSat !== s.uCmd);
      expect(loop.k).toBe(k + 1);
      if (s.saturated) saturatedSeen++;
      previousX = Array.from(s.x);
    }
    expect(saturatedSeen).toBe(30); // cf. valeurs de référence §5
  });

  it('aucune allocation : même objet échantillon et même tableau d’état sur 1000 pas', () => {
    const loop = createElevatorLoop({ kp: 2500 });
    const first = loop.step();
    expect(first.x).toBe(loop.x);
    for (let k = 1; k < 1000; k++) {
      const s = loop.step();
      expect(s).toBe(first);
      expect(s.x).toBe(loop.x);
    }
  });

  it('reset() restaure l’état initial : trace identique après reset', () => {
    const loop = createElevatorLoop({ kp: 2500 });
    const run = (): number[][] => {
      const rows: number[][] = [];
      for (let k = 0; k < 600; k++) rows.push(snapshot(loop.step()));
      return rows;
    };
    const first = run();
    loop.setEnabled(false);
    loop.reset();
    expect(loop.k).toBe(0);
    expect(loop.enabled).toBe(true);
    expect(Array.from(loop.x)).toEqual([0, 0]);
    expect(run()).toEqual(first);
  });

  it('reset() appelle controller.reset() et l’état initial est copié à la création', () => {
    let resets = 0;
    const p = createProportionalController(1000);
    const controller: Controller = {
      reset: () => {
        resets++;
      },
      update: (r, y, dt) => p.update(r, y, dt),
    };
    const x0 = new Float64Array([1, 0]);
    const loop = createClosedLoop({
      plant: createElevator(),
      controller,
      saturation: createSaturation(-ELEVATOR_MAX_FORCE, ELEVATOR_MAX_FORCE),
      integrator: createRk4(2),
      dt: SIM_DT,
      x0,
      setpoint: () => ELEVATOR_SETPOINT,
    });
    x0[0] = 99; // sans effet sur la boucle
    expect(loop.dt).toBe(SIM_DT);
    expect(Array.from(loop.x)).toEqual([1, 0]);
    loop.step();
    loop.reset();
    expect(resets).toBe(1);
    expect(Array.from(loop.x)).toEqual([1, 0]);
  });

  it('setpoint reçoit t = k·dt (jamais accumulé)', () => {
    const times: number[] = [];
    const dt = 1 / 30; // pas « non rond » (1/30 n'est pas représentable exactement)
    const loop = createClosedLoop({
      plant: createElevator(),
      controller: createProportionalController(1000),
      saturation: createSaturation(-ELEVATOR_MAX_FORCE, ELEVATOR_MAX_FORCE),
      integrator: createRk4(2),
      dt,
      x0: new Float64Array(2),
      setpoint: (t) => {
        times.push(t);
        return t < 0.5 ? 0 : ELEVATOR_SETPOINT;
      },
    });
    for (let k = 0; k < 60; k++) loop.step();
    expect(times).toEqual(Array.from({ length: 60 }, (_, k) => k * dt));
    expect(loop.x[0]).toBeGreaterThan(0); // consigne en échelon à t = 0,5 s suivie
  });

  it('setEnabled(false) : uCmd = 0, contrôleur non appelé, chute libre amortie jusqu’au sol', () => {
    let calls = 0;
    const p = createProportionalController(2500);
    const loop = createClosedLoop({
      plant: createElevator(),
      controller: {
        reset: () => undefined,
        update: (r, y, dt) => {
          calls++;
          return p.update(r, y, dt);
        },
      },
      saturation: createSaturation(-ELEVATOR_MAX_FORCE, ELEVATOR_MAX_FORCE),
      integrator: createRk4(2),
      dt: SIM_DT,
      x0: new Float64Array(2),
      setpoint: () => ELEVATOR_SETPOINT,
    });
    expect(loop.enabled).toBe(true);
    for (let k = 0; k < 240; k++) loop.step();
    expect(calls).toBe(240);
    const height = loop.x[0] as number;
    expect(height).toBeGreaterThan(2.5);

    loop.setEnabled(false);
    expect(loop.enabled).toBe(false);
    let landedAt = -1;
    for (let k = 0; k < 1200; k++) {
      const s = loop.step();
      expect(s.uCmd).toBe(0);
      expect(s.uSat).toBe(0);
      expect(s.saturated).toBe(false);
      expect(s.x[0]).toBeGreaterThanOrEqual(0); // jamais sous le sol
      if (s.x[0] === 0) {
        expect(s.x[1]).toBeGreaterThanOrEqual(0); // vitesse ≥ 0 au contact
        if (landedAt < 0) landedAt = s.k;
      }
    }
    expect(calls).toBe(240); // contrôleur jamais sollicité pendant la désactivation
    expect(landedAt).toBeGreaterThan(0);
    expect(Array.from(loop.x)).toEqual([0, 0]); // posée au repos

    loop.setEnabled(true);
    for (let k = 0; k < 240; k++) loop.step();
    expect(loop.x[0]).toBeGreaterThan(2.5); // redécolle
  });

  it('contact sol : départ vers le bas ⇒ y ≥ 0 à chaque pas et ẏ ≥ 0 au contact', () => {
    const loop = createClosedLoop({
      plant: createElevator(),
      controller: createProportionalController(150), // sous le seuil de décollage
      saturation: createSaturation(-ELEVATOR_MAX_FORCE, ELEVATOR_MAX_FORCE),
      integrator: createRk4(2),
      dt: SIM_DT,
      x0: new Float64Array([0.2, -3]),
      setpoint: () => ELEVATOR_SETPOINT,
    });
    let contacts = 0;
    for (let k = 0; k < 600; k++) {
      const s = loop.step();
      expect(s.x[0]).toBeGreaterThanOrEqual(0);
      if (s.x[0] === 0) {
        contacts++;
        expect(s.x[1]).toBeGreaterThanOrEqual(0);
      }
    }
    expect(contacts).toBeGreaterThan(500);
    expect(Array.from(loop.x)).toEqual([0, 0]);
  });

  it('commande négative saturée à −Umax (cabine très au-dessus de la consigne)', () => {
    const loop = createClosedLoop({
      plant: createElevator(),
      controller: createProportionalController(8000),
      saturation: createSaturation(-ELEVATOR_MAX_FORCE, ELEVATOR_MAX_FORCE),
      integrator: createRk4(2),
      dt: SIM_DT,
      x0: new Float64Array([10, 0]),
      setpoint: () => ELEVATOR_SETPOINT,
    });
    const s = loop.step();
    expect(s.uCmd).toBe(8000 * (3 - 10));
    expect(s.uSat).toBe(-ELEVATOR_MAX_FORCE);
    expect(s.saturated).toBe(true);
  });

  it('configuration invalide : RangeError', () => {
    const base = {
      plant: createElevator(),
      controller: createProportionalController(1000),
      saturation: createSaturation(-ELEVATOR_MAX_FORCE, ELEVATOR_MAX_FORCE),
      integrator: createRk4(2),
      dt: SIM_DT,
      x0: new Float64Array(2),
      setpoint: () => ELEVATOR_SETPOINT,
    };
    expect(() => createClosedLoop({ ...base, dt: 0 })).toThrow(RangeError);
    expect(() => createClosedLoop({ ...base, dt: Number.NaN })).toThrow(RangeError);
    expect(() => createClosedLoop({ ...base, dt: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => createClosedLoop({ ...base, x0: new Float64Array(3) })).toThrow(RangeError);
    expect(() => createElevatorLoop({ kp: 1000, maxForce: -1 })).toThrow(RangeError);
    expect(() => createElevatorLoop({ kp: -1 })).toThrow(RangeError);
  });

  it('createElevatorLoop : options par défaut = configuration de jeu', () => {
    const loop = createElevatorLoop({ kp: 2500 });
    expect(loop.dt).toBe(SIM_DT);
    const s = loop.step();
    expect(s.r).toBe(ELEVATOR_SETPOINT);
    expect(s.uSat).toBe(ELEVATOR_MAX_FORCE);
    const custom = createElevatorLoop({
      kp: 2500,
      maxForce: 1e12,
      dt: 0.01,
      setpoint: 2,
      params: ELEVATOR_PARAMS,
    });
    const c = custom.step();
    expect(c.r).toBe(2);
    expect(c.uSat).toBe(5000);
    expect(c.saturated).toBe(false);
    expect(custom.dt).toBe(0.01);
  });

  it('un modèle quelconque (PlantModel) est accepté : intégrateur simple ẋ = u', () => {
    const integratorPlant: PlantModel = {
      stateSize: 1,
      derivative(_x, u, out) {
        out[0] = u;
      },
      output: (x) => x[0] as number,
      constrain: () => undefined,
    };
    const loop = createClosedLoop({
      plant: integratorPlant,
      controller: createProportionalController(1),
      saturation: createSaturation(-1, 1),
      integrator: createRk4(1),
      dt: 1 / 32,
      x0: new Float64Array([0]),
      setpoint: () => 4,
    });
    expect(loop.step().uSat).toBe(1); // 4 saturé à 1
    expect(loop.x[0]).toBe(1 / 32);
  });
});

describe('validation des entrées (T-004b, défauts D-1, D-2, D-7 de T-005)', () => {
  /** Configuration valide de référence ; chaque test n'en change qu'un champ. */
  const base = (): ClosedLoopConfig => ({
    plant: createElevator(),
    controller: createProportionalController(2500),
    saturation: createSaturation(-ELEVATOR_MAX_FORCE, ELEVATOR_MAX_FORCE),
    integrator: createRk4(2),
    dt: SIM_DT,
    x0: new Float64Array(2),
    setpoint: () => ELEVATOR_SETPOINT,
  });

  it('D-1 consigne constante non finie : RangeError à la création (createElevatorLoop)', () => {
    for (const setpoint of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => createElevatorLoop({ kp: 2500, setpoint })).toThrow(RangeError);
    }
    expect(createElevatorLoop({ kp: 2500, setpoint: -2 }).step().r).toBe(-2); // finie : acceptée
  });

  it('D-1 consigne r(t) non finie : step() lève RangeError avant toute modification', () => {
    let calls = 0;
    const p = createProportionalController(2500);
    const loop = createClosedLoop({
      ...base(),
      controller: {
        reset: () => undefined,
        update: (r, y, dt) => {
          calls++;
          return p.update(r, y, dt);
        },
      },
      setpoint: (t) => (t < 0.5 ? ELEVATOR_SETPOINT : Number.NaN),
    });
    for (let k = 0; k < 60; k++) loop.step(); // t = 0 … 59/120 < 0,5 : consigne finie
    const before = Array.from(loop.x);
    expect(() => loop.step()).toThrow(RangeError); // t = 60/120 = 0,5 : NaN
    expect(loop.k).toBe(60); // pas non compté
    expect(Array.from(loop.x)).toEqual(before); // état intact, pas de NaN
    expect(calls).toBe(60); // contrôleur non appelé
    for (const bad of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const l = createClosedLoop({ ...base(), setpoint: () => bad });
      expect(() => l.step()).toThrow(RangeError);
    }
  });

  it('D-2 dt > MAX_SIM_DT = 1/30 s : RangeError ; dt = MAX_SIM_DT accepté', () => {
    expect(MAX_SIM_DT).toBe(1 / 30);
    expect(SIM_DT).toBeLessThanOrEqual(MAX_SIM_DT);
    for (const dt of [1, 0.25, 1 / 29]) {
      expect(() => createClosedLoop({ ...base(), dt })).toThrow(RangeError);
      expect(() => createElevatorLoop({ kp: 2500, dt })).toThrow(RangeError);
    }
    for (const dt of [1 / 1000, 1 / 240, 1 / 120, 1 / 60, 1 / 30]) {
      expect(createClosedLoop({ ...base(), dt }).dt).toBe(dt);
      expect(createElevatorLoop({ kp: 2500, dt }).dt).toBe(dt);
    }
  });

  it('D-2 dt = MAX_SIM_DT, Kp = 8000 : boucle stable, converge vers r − m·g/Kp', () => {
    const kp = 8000;
    const loop = createElevatorLoop({ kp, dt: MAX_SIM_DT });
    for (let k = 0; k < 30 * 30; k++) loop.step(); // 30 s
    const { mass, gravity } = ELEVATOR_PARAMS;
    expect(
      Math.abs((loop.x[0] as number) - (ELEVATOR_SETPOINT - (mass * gravity) / kp)),
    ).toBeLessThan(1e-9);
  });

  it('D-7 état initial sous le sol ou non fini : RangeError ; posé au sol accepté', () => {
    const bad = [
      [-1, -5],
      [-1e-12, 0],
      [Number.NaN, 0],
      [0, Number.NaN],
      [Number.POSITIVE_INFINITY, 0],
      [1, Number.NEGATIVE_INFINITY],
    ];
    for (const x0 of bad) {
      expect(() => createClosedLoop({ ...base(), x0: new Float64Array(x0) })).toThrow(RangeError);
    }
    const onGround = createClosedLoop({ ...base(), x0: new Float64Array([0, -5]) });
    expect(Array.from(onGround.x)).toEqual([0, -5]); // y = 0 respecte la contrainte y ≥ 0
  });
});
