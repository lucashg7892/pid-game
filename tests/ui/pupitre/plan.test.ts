/**
 * Plan du pupitre (T-049) : placement dans la fenêtre, échelle, mode étroit, colonnes.
 */
import { describe, expect, it } from 'vitest';
import {
  COLONNES,
  LARGEUR_ETROITE,
  PLAN_HAUTEUR,
  PLAN_LARGEUR,
  RESERVE_BAS,
  RESERVE_HAUT,
  RESERVE_HAUT_PORTRAIT,
  placerPlan,
  reserveHaut,
} from '../../../src/ui/pupitre';

describe('placerPlan', () => {
  it('1280×720 : échelle 1, le plan remplit la zone entre la barre du haut et le bandeau', () => {
    const p = placerPlan(1280, 720);
    expect(p.etroit).toBe(false);
    expect(p.echelle).toBe(1);
    expect(p.largeur).toBe(PLAN_LARGEUR);
    expect(p.hauteur).toBe(PLAN_HAUTEUR);
    expect(p.zoneHauteur).toBe(720 - RESERVE_HAUT - RESERVE_BAS);
    expect(p.gauche).toBe(0);
    expect(p.haut).toBe(0);
    expect(p.colonnes).toEqual(['reglage', 'machine', 'courbes']);
  });

  it('le plan ne sort jamais de la zone, à toutes les tailles larges', () => {
    for (const [w, h] of [
      [1024, 576],
      [1280, 720],
      [1366, 768],
      [1920, 1080],
      [2560, 1440],
      [3840, 700],
      [900, 900],
    ] as const) {
      const p = placerPlan(w, h);
      expect(p.etroit, `${String(w)}×${String(h)}`).toBe(false);
      expect(p.largeur * p.echelle).toBeLessThanOrEqual(p.zoneLargeur + 1e-9);
      expect(p.hauteur * p.echelle).toBeLessThanOrEqual(p.zoneHauteur + 1e-9);
      expect(p.gauche).toBeGreaterThanOrEqual(0);
      expect(p.haut).toBeGreaterThanOrEqual(0);
      expect(p.gauche + p.largeur * p.echelle).toBeLessThanOrEqual(p.zoneLargeur + 1e-9);
      expect(p.haut + p.hauteur * p.echelle).toBeLessThanOrEqual(p.zoneHauteur + 1e-9);
    }
  });

  it('plan centré : marges égales de part et d’autre', () => {
    const p = placerPlan(1920, 1080);
    expect(p.gauche * 2 + p.largeur * p.echelle).toBeCloseTo(p.zoneLargeur, 9);
    expect(p.haut * 2 + p.hauteur * p.echelle).toBeCloseTo(p.zoneHauteur, 9);
  });

  it('écran étroit : seule la colonne de réglage, à la plus grande échelle qui tient', () => {
    const p = placerPlan(390, 844);
    expect(LARGEUR_ETROITE).toBeGreaterThan(390);
    expect(p.etroit).toBe(true);
    expect(p.colonnes).toEqual(['reglage']);
    expect(p.largeur).toBe(COLONNES.reglage.w + 2 * COLONNES.reglage.x);
    expect(p.largeur * p.echelle).toBeLessThanOrEqual(390 + 1e-9);
    expect(p.hauteur * p.echelle).toBeLessThanOrEqual(p.zoneHauteur + 1e-9);
    // Plus lisible que le plan complet réduit à 390 px de large.
    expect(p.echelle).toBeGreaterThan(390 / PLAN_LARGEUR);
  });

  it('portrait étroit : la barre du haut, sur deux lignes, garde plus de place (même règle que le CSS)', () => {
    expect(reserveHaut(390, 844)).toBe(RESERVE_HAUT_PORTRAIT);
    expect(reserveHaut(700, 700)).toBe(RESERVE_HAUT_PORTRAIT);
    expect(reserveHaut(1280, 720)).toBe(RESERVE_HAUT);
    expect(reserveHaut(740, 360)).toBe(RESERVE_HAUT);
    expect(reserveHaut(800, 1200)).toBe(RESERVE_HAUT);
    expect(placerPlan(390, 844).zoneHauteur).toBe(844 - RESERVE_HAUT_PORTRAIT - RESERVE_BAS);
  });

  it('fenêtre minuscule : échelle positive, pas de NaN', () => {
    for (const [w, h] of [
      [0, 0],
      [10, 10],
      [800, 200],
    ] as const) {
      const p = placerPlan(w, h);
      expect(p.echelle).toBeGreaterThan(0);
      expect(Number.isFinite(p.gauche + p.haut + p.echelle)).toBe(true);
    }
  });
});

describe('colonnes du plan', () => {
  it('trois colonnes côte à côte, sans se chevaucher, dans le plan', () => {
    const { reglage, machine, courbes } = COLONNES;
    expect(reglage.x + reglage.w).toBeLessThan(machine.x);
    expect(machine.x + machine.w).toBeLessThan(courbes.x);
    expect(courbes.x + courbes.w).toBeLessThanOrEqual(PLAN_LARGEUR);
    for (const c of [reglage, machine, courbes]) {
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y + c.h).toBeLessThanOrEqual(PLAN_HAUTEUR);
    }
  });
});
