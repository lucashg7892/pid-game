/**
 * Partie « D'où vient la force ? » du tableau (T-053) : calculs purs tirés de l'instantané du jeu
 * (ressort P, bocal I, butée, bilan des forces), flèches et ressort, section du tableau, parité des
 * clés FR/EN.
 */
import { describe, expect, it } from 'vitest';
import { ELEVATOR_MAX_FORCE, ELEVATOR_PARAMS } from '../../src/game';
import { CATALOGS, placeholdersOf, type MessageKey } from '../../src/i18n';
import { buildBoardSections } from '../../src/ui/board';
import {
  JAR_CAPACITY,
  arrowLength,
  computeForces,
  springLength,
  springPoints,
  type ForcesSource,
} from '../../src/ui/board-forces';
import { tr } from './helpers';

const MG = ELEVATOR_PARAMS.mass * ELEVATOR_PARAMS.gravity;

function source(patch: Partial<ForcesSource> = {}): ForcesSource {
  return {
    levelId: 'level1',
    k: 120,
    kp: 2000,
    ki: 0,
    stepError: 1,
    pTerm: 2000,
    iTermUsed: 0,
    uCmd: 2000,
    uSat: 2000,
    saturated: false,
    stepVelocity: 1,
    stepAcceleration: (2000 - MG - ELEVATOR_PARAMS.damping * 1) / ELEVATOR_PARAMS.mass,
    ...patch,
  };
}

describe('computeForces', () => {
  it('niveau 1 : ressort P et bilan cohérents avec le jeu', () => {
    const m = computeForces(source());
    expect(m.level2).toBe(false);
    expect(m.started).toBe(true);
    expect(m.p).toBe(m.kp * m.error);
    expect(m.i).toBe(0);
    expect(m.jarFill).toBe(0);
    expect(m.weight).toBeCloseTo(MG, 9);
    expect(m.friction).toBe(ELEVATOR_PARAMS.damping * 1);
    expect(m.net).toBeCloseTo(2000 - MG - ELEVATOR_PARAMS.damping, 9);
    expect(m.net / m.mass).toBeCloseTo(m.acceleration, 9);
    expect(m.grounded).toBe(false);
    expect(m.saturated).toBe(false);
    expect(m.clipped).toBe(0);
    expect(m.uMax).toBe(ELEVATOR_MAX_FORCE);
  });

  it('niveau 2 : le bocal vaut I / Ki, plafonné à plein, jamais négatif', () => {
    const half = computeForces(
      source({ levelId: 'level2', ki: 800, iTermUsed: 400, pTerm: 1000, uCmd: 1400, uSat: 1400 }),
    );
    expect(half.level2).toBe(true);
    expect(half.integral).toBeCloseTo(0.5, 9);
    expect(half.jarFill).toBeCloseTo(0.5 / JAR_CAPACITY, 9);
    expect(half.i).toBe(400);
    const full = computeForces(source({ levelId: 'level2', ki: 800, iTermUsed: 4000 }));
    expect(full.jarFill).toBe(1);
    const negative = computeForces(source({ levelId: 'level2', ki: 800, iTermUsed: -300 }));
    expect(negative.integral).toBeLessThan(0);
    expect(negative.jarFill).toBe(0);
    // Ki = 0 : pas de division par zéro.
    expect(computeForces(source({ levelId: 'level2', ki: 0, iTermUsed: 10 })).integral).toBe(0);
  });

  it('saturation : la part écrêtée est la différence entre demande et force appliquée', () => {
    const up = computeForces(source({ uCmd: 7500, uSat: ELEVATOR_MAX_FORCE, saturated: true }));
    expect(up.saturated).toBe(true);
    expect(up.clipped).toBe(7500 - ELEVATOR_MAX_FORCE);
    const down = computeForces(source({ uCmd: -6000, uSat: -ELEVATOR_MAX_FORCE, saturated: true }));
    expect(down.clipped).toBe(6000 - ELEVATOR_MAX_FORCE);
  });

  it('avant tout trajet : tout à zéro, cabine posée (retenue par le sol), pas de -0', () => {
    const m = computeForces(
      source({
        k: 0,
        stepError: 0,
        pTerm: 0,
        uCmd: 0,
        uSat: 0,
        stepVelocity: -0,
        stepAcceleration: 0,
      }),
    );
    expect(m.started).toBe(false);
    expect(Object.is(m.velocity, 0)).toBe(true);
    expect(Object.is(m.friction, 0)).toBe(true);
    expect(m.uSat).toBe(0);
    expect(m.net).toBeCloseTo(-MG, 9);
    expect(m.grounded).toBe(true);
  });

  it("les paramètres physiques sont ceux qu'on donne", () => {
    const m = computeForces(
      source({ stepVelocity: 2 }),
      { mass: 10, gravity: 10, damping: 5 },
      100,
    );
    expect(m.weight).toBe(100);
    expect(m.friction).toBe(10);
    expect(m.damping).toBe(5);
    expect(m.uMax).toBe(100);
  });
});

describe('dessins', () => {
  it('arrowLength : croît avec la force, sans échelle linéaire, bornée, signée', () => {
    expect(arrowLength(0, 5000, 34)).toBe(0);
    expect(arrowLength(0.2, 5000, 34)).toBe(0);
    const weight = arrowLength(MG, 5000, 34);
    expect(weight).toBeGreaterThan(6);
    // Le poids reste visible à côté de la butée : bien plus que 491/5000 de la longueur maximale.
    expect(weight / arrowLength(5000, 5000, 34)).toBeGreaterThan(0.3);
    expect(arrowLength(9000, 5000, 34)).toBe(34);
    expect(arrowLength(-2000, 5000, 34)).toBe(-arrowLength(2000, 5000, 34));
  });

  it("springLength : longueur au repos, croît avec l'erreur, jamais sous le minimum", () => {
    expect(springLength(0, 50, 22, 14)).toBe(50);
    expect(springLength(1, 50, 22, 14)).toBe(72);
    expect(springLength(-10, 50, 22, 14)).toBe(14);
  });

  it('springPoints : de x0 à x1, avec les spires en zigzag', () => {
    const points = springPoints(20, 100, 45).split(' ');
    expect(points[0]).toBe('20,45');
    expect(points.at(-1)).toBe('100.0,45');
    // Deux bouts, neuf spires, deux bouts.
    expect(points).toHaveLength(2 + 9 + 2);
    const ys = new Set(points.map((p) => p.split(',')[1]));
    expect(ys).toEqual(new Set(['45', '37', '53']));
  });
});

describe('section du tableau', () => {
  for (const locale of ['fr', 'en'] as const) {
    it(`${locale} : sous les équations, pleine largeur, avec les dessins en direct`, () => {
      for (const level of ['level1', 'level2'] as const) {
        const sections = buildBoardSections(tr(locale), level);
        const ids = sections.map((s) => s.id);
        expect(ids.indexOf('forces')).toBeGreaterThan(ids.indexOf('saturation'));
        expect(ids.indexOf('forces')).toBeLessThan(ids.indexOf('values'));
        const forces = sections.find((s) => s.id === 'forces');
        expect(forces?.column).toBe(3);
        expect(forces?.heading).toBe(CATALOGS[locale]['board.forces.title']);
        expect(forces?.blocks.map((b) => b.kind)).toEqual(['text', 'forces']);
      }
    });
  }

  it('parité FR/EN des clés board.forces.* : mêmes paramètres', () => {
    const keys = (Object.keys(CATALOGS.fr) as MessageKey[]).filter((k) =>
      k.startsWith('board.forces.'),
    );
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      expect([...placeholdersOf(CATALOGS.en[key])].sort(), key).toEqual(
        [...placeholdersOf(CATALOGS.fr[key])].sort(),
      );
    }
  });
});
