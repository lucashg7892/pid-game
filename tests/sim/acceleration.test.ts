/**
 * Accélération de la cabine donnée par le modèle (T-041) : `elevatorAcceleration` égale, bit à
 * bit, la composante vitesse des dérivées de `createElevator` hors contact, et vaut 0 pour la
 * cabine posée au sol sous une force nette vers le bas.
 */
import { describe, expect, it } from 'vitest';
import {
  ELEVATOR_MAX_FORCE,
  ELEVATOR_PARAMS,
  ELEVATOR_POSITION,
  ELEVATOR_STATE_SIZE,
  ELEVATOR_VELOCITY,
  createElevator,
  elevatorAcceleration,
  type ElevatorParams,
} from '../../src/sim';
import { mulberry32 } from '../game/helpers';

/** Composante vitesse des dérivées du modèle, dẏ/dt, à l'état (y, ẏ) sous la force u. */
function modelAcceleration(params: Readonly<ElevatorParams>, y: number, v: number, u: number) {
  const x = new Float64Array(ELEVATOR_STATE_SIZE);
  x[ELEVATOR_POSITION] = y;
  x[ELEVATOR_VELOCITY] = v;
  const out = new Float64Array(ELEVATOR_STATE_SIZE);
  createElevator(params).derivative(x, u, out);
  return out[ELEVATOR_VELOCITY] as number;
}

const PARAMS: readonly Readonly<ElevatorParams>[] = [
  ELEVATOR_PARAMS,
  { mass: 50, gravity: 9.81, damping: 0 },
  { mass: 73.3, gravity: 1.62, damping: 12.5 },
  { mass: 0.5, gravity: -3, damping: 1e4 },
];

describe('elevatorAcceleration : même expression que le modèle', () => {
  it('hors contact, égale bit à bit dẏ/dt du modèle sur 40 000 états et forces', () => {
    const rnd = mulberry32(2041);
    let checked = 0;
    for (const params of PARAMS) {
      const net = (v: number, u: number) => u - params.mass * params.gravity - params.damping * v;
      for (let j = 0; j < 10_000; j++) {
        // y au sol une fois sur quatre, sinon dans [−0,5 ; 4] m ; ẏ dans [−4 ; 4] m/s.
        const y = j % 4 === 0 ? 0 : -0.5 + 4.5 * rnd();
        const v = j % 7 === 0 ? 0 : -4 + 8 * rnd();
        const u = (2 * rnd() - 1) * 1.5 * ELEVATOR_MAX_FORCE;
        const got = elevatorAcceleration(y, v, u, params);
        const contact = y <= 0 && v <= 0 && net(v, u) < 0;
        if (contact) {
          expect(Object.is(got, 0)).toBe(true);
        } else {
          expect(Object.is(got, modelAcceleration(params, y, v, u))).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(30_000);
  });

  it('paramètres par défaut : ceux du noyau (ELEVATOR_PARAMS)', () => {
    for (const [y, v, u] of [
      [1, 0.5, 3000],
      [2.9, -1.2, -5000],
      [0, 0, 5000],
      [0, 0.3, 0],
    ] as const) {
      expect(elevatorAcceleration(y, v, u)).toBe(elevatorAcceleration(y, v, u, ELEVATOR_PARAMS));
      expect(
        Object.is(elevatorAcceleration(y, v, u), modelAcceleration(ELEVATOR_PARAMS, y, v, u)),
      ).toBe(true);
    }
    // Valeur de la formule : (5000 − 490,5 − 0)/50 = 90,19 m/s².
    expect(elevatorAcceleration(0, 0, 5000)).toBe((5000 - 50 * 9.81) / 50);
  });
});

describe('elevatorAcceleration : contact au sol', () => {
  const W = ELEVATOR_PARAMS.mass * ELEVATOR_PARAMS.gravity;

  it('cabine posée, moteur trop faible ou coupé : accélération nulle (+0)', () => {
    for (const u of [0, 100, W - 1e-9, -5000]) {
      expect(Object.is(elevatorAcceleration(0, 0, u), 0)).toBe(true);
    }
    // Sous le sol ou en descente au contact : le sol retient la cabine.
    expect(Object.is(elevatorAcceleration(-0.01, -0.2, 0), 0)).toBe(true);
    expect(Object.is(elevatorAcceleration(0, -0.2, 100), 0)).toBe(true);
    expect(Object.is(elevatorAcceleration(-0, -0, 0), 0)).toBe(true);
  });

  it('en descente au sol, le frottement peut rendre la force nette positive : formule', () => {
    // 300 − 490,5 + 400 = 209,5 N > 0 : pas de contact retenu.
    expect(elevatorAcceleration(0, -1, 300)).toBe(modelAcceleration(ELEVATOR_PARAMS, 0, -1, 300));
    expect(elevatorAcceleration(0, -1, 300)).toBeGreaterThan(0);
  });

  it('force nette ≥ 0 au sol : la formule s’applique (décollage, ou équilibre exact à 0)', () => {
    expect(elevatorAcceleration(0, 0, W)).toBe(0);
    expect(elevatorAcceleration(0, 0, W + 50)).toBe((W + 50 - W) / 50);
    expect(elevatorAcceleration(0, 0, 5000)).toBeGreaterThan(0);
  });

  it('au sol mais en montée, ou en l’air : jamais retenue', () => {
    expect(elevatorAcceleration(0, 0.5, 0)).toBe(modelAcceleration(ELEVATOR_PARAMS, 0, 0.5, 0));
    expect(elevatorAcceleration(0, 0.5, 0)).toBeLessThan(0);
    expect(elevatorAcceleration(1e-12, 0, 0)).toBe(modelAcceleration(ELEVATOR_PARAMS, 1e-12, 0, 0));
    expect(elevatorAcceleration(1e-12, 0, 0)).toBeCloseTo(-ELEVATOR_PARAMS.gravity, 12);
    expect(elevatorAcceleration(2, -1, -5000)).toBe(
      modelAcceleration(ELEVATOR_PARAMS, 2, -1, -5000),
    );
  });

  it('NaN de ẏ ou de la force propagé, jamais masqué par le contact', () => {
    expect(elevatorAcceleration(0, Number.NaN, 0)).toBeNaN();
    expect(elevatorAcceleration(0, 0, Number.NaN)).toBeNaN();
    // y n'entre que dans le test de contact (comme dans le modèle, où ÿ ne dépend pas de y) :
    // y NaN n'est jamais « au sol », la formule s'applique.
    expect(elevatorAcceleration(Number.NaN, 0, 0)).toBe(
      modelAcceleration(ELEVATOR_PARAMS, Number.NaN, 0, 0),
    );
  });
});
