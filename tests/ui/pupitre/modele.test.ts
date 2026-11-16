/**
 * Modèle du pupitre (T-049) : conversion levier ↔ valeur, bornes et pas, verrous par niveau et par
 * phase, lecture seule, visibilité, textes d'état.
 */
import { describe, expect, it } from 'vitest';
import {
  KI_MAX,
  KI_MIN,
  KI_STEP,
  KP_MAX,
  KP_MIN,
  KP_STEP,
  createLevel1,
  createLevel2,
  type LevelPhase,
  type TuningSpec,
} from '../../../src/game';
import {
  cleEtat,
  cleTitreIssue,
  fractionDe,
  graduations,
  pupitreVisible,
  reglageDe,
  valeurDe,
} from '../../../src/ui/pupitre';
import { CATALOGS } from '../../../src/i18n';

const SPEC: TuningSpec = { param: 'kp', min: KP_MIN, max: KP_MAX, step: KP_STEP };
const PHASES: readonly LevelPhase[] = [
  'approach',
  'tuning',
  'boarding',
  'trip',
  'exit',
  'outcome',
  'paused',
];

describe('levier ↔ valeur', () => {
  it('les bornes du réglage sont celles du jeu : 0 à 8000 par pas de 100, aux deux niveaux', () => {
    expect([KP_MIN, KP_MAX, KP_STEP]).toEqual([0, 8000, 100]);
    expect([KI_MIN, KI_MAX, KI_STEP]).toEqual([0, 8000, 100]);
    expect(createLevel1().tuning).toMatchObject({ min: 0, max: 8000, step: 100 });
    expect(createLevel2().tuning).toMatchObject({ min: 0, max: 8000, step: 100 });
  });

  it('fractionDe : 0 en bas, 1 en haut, linéaire, bornée', () => {
    expect(fractionDe(0, SPEC)).toBe(0);
    expect(fractionDe(8000, SPEC)).toBe(1);
    expect(fractionDe(2000, SPEC)).toBe(0.25);
    expect(fractionDe(-500, SPEC)).toBe(0);
    expect(fractionDe(9000, SPEC)).toBe(1);
    expect(fractionDe(Number.NaN, SPEC)).toBe(0);
  });

  it('valeurDe : arrondie au pas de 100, bornée à [0 ; 8000]', () => {
    expect(valeurDe(0, SPEC)).toBe(0);
    expect(valeurDe(1, SPEC)).toBe(8000);
    expect(valeurDe(0.5, SPEC)).toBe(4000);
    expect(valeurDe(0.3123, SPEC)).toBe(2500);
    expect(valeurDe(-3, SPEC)).toBe(0);
    expect(valeurDe(7, SPEC)).toBe(8000);
    expect(valeurDe(Number.NaN, SPEC)).toBe(0);
    expect(valeurDe(Number.POSITIVE_INFINITY, SPEC)).toBe(0);
  });

  it('aller-retour : toute valeur de la grille ressort inchangée', () => {
    for (let v = KP_MIN; v <= KP_MAX; v += KP_STEP) {
      expect(valeurDe(fractionDe(v, SPEC), SPEC)).toBe(v);
    }
  });

  it('valeurDe respecte un autre pas et une autre plage', () => {
    const spec: TuningSpec = { param: 'ki', min: 100, max: 1100, step: 250 };
    expect(valeurDe(0, spec)).toBe(100);
    expect(valeurDe(1, spec)).toBe(1100);
    expect(valeurDe(0.5, spec)).toBe(600);
    expect(fractionDe(100, spec)).toBe(0);
    expect(fractionDe(1100, spec)).toBe(1);
  });

  it('graduations : un trait tous les 500, un chiffre tous les 2000', () => {
    const g = graduations(SPEC, 500, 2000);
    expect(g).toHaveLength(17);
    expect(g.filter((x) => x.etiquetee).map((x) => x.valeur)).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(g[0]?.valeur).toBe(0);
    expect(g[16]?.valeur).toBe(8000);
    expect(graduations(SPEC, 0, 2000)).toEqual([]);
  });
});

describe('verrous par niveau et par phase', () => {
  it('niveau 1, réglage : Kp libre, Ki hors service, Lancer actif, pas de Recommencer', () => {
    const r = reglageDe('level1', 'tuning', false);
    expect(r).toMatchObject({
      mode: 'edition',
      kp: 'libre',
      ki: 'hors-service',
      lancerVisible: true,
      lancerActif: true,
      recommencerVisible: false,
    });
  });

  it('niveau 2, réglage : Kp fixé, Ki libre', () => {
    const r = reglageDe('level2', 'tuning', false);
    expect(r).toMatchObject({ mode: 'edition', kp: 'fixe', ki: 'libre', lancerActif: true });
  });

  it('hors réglage, tout est en lecture seule : leviers verrouillés (ou fixés, hors service), Lancer grisé', () => {
    for (const phase of PHASES.filter((p) => p !== 'tuning')) {
      for (const paused of [false, true]) {
        const r1 = reglageDe('level1', phase, paused);
        expect(r1.mode, `${phase}/${String(paused)}`).toBe('lecture');
        expect(r1.kp).toBe('verrouille');
        expect(r1.ki).toBe('hors-service');
        expect(r1.lancerActif).toBe(false);
        const r2 = reglageDe('level2', phase, paused);
        expect(r2.kp).toBe('fixe');
        expect(r2.ki).toBe('verrouille');
        expect(r2.lancerActif).toBe(false);
      }
    }
  });

  it('en pause pendant le réglage : lecture seule aussi', () => {
    const r = reglageDe('level1', 'tuning', true);
    expect(r.mode).toBe('lecture');
    expect(r.kp).toBe('verrouille');
    expect(r.lancerActif).toBe(false);
  });

  it('embarquement et trajet : « Recommencer » remplace « Lancer » (grisé en pause)', () => {
    for (const phase of ['boarding', 'trip'] as const) {
      const r = reglageDe('level1', phase, false);
      expect(r.recommencerVisible).toBe(true);
      expect(r.recommencerActif).toBe(true);
      expect(r.lancerVisible).toBe(false);
      const p = reglageDe('level1', phase, true);
      expect(p.recommencerVisible).toBe(true);
      expect(p.recommencerActif).toBe(false);
    }
    for (const phase of ['approach', 'tuning', 'exit', 'outcome'] as const) {
      expect(reglageDe('level2', phase, false).recommencerVisible, phase).toBe(false);
      expect(reglageDe('level2', phase, false).lancerVisible, phase).toBe(true);
    }
  });

  it('un seul levier est réglable à la fois, jamais les deux', () => {
    for (const levelId of ['level1', 'level2'] as const) {
      const r = reglageDe(levelId, 'tuning', false);
      expect([r.kp, r.ki].filter((e) => e === 'libre')).toHaveLength(1);
    }
  });
});

describe('visibilité du pupitre', () => {
  it('s’ouvre seul en phase de réglage, jamais en pause, sauf ouverture demandée', () => {
    expect(pupitreVisible('tuning', false, false)).toBe(true);
    expect(pupitreVisible('tuning', true, false)).toBe(false);
    expect(pupitreVisible('tuning', true, true)).toBe(true);
  });

  it('en lecture seule demandée : visible dans toutes les phases', () => {
    for (const phase of PHASES) {
      for (const paused of [false, true]) {
        expect(pupitreVisible(phase, paused, true), `${phase}/${String(paused)}`).toBe(true);
      }
    }
  });

  it('non demandé : seulement en phase de réglage', () => {
    for (const phase of PHASES.filter((p) => p !== 'tuning')) {
      expect(pupitreVisible(phase, false, false), phase).toBe(false);
    }
  });
});

describe('textes d’état et d’issue', () => {
  it('chaque phase a son texte d’état, la pause prime, tous existent en FR et EN', () => {
    for (const phase of PHASES) {
      const cle = cleEtat(phase, false);
      expect(CATALOGS.fr[cle], cle).toBeTruthy();
      expect(CATALOGS.en[cle], cle).toBeTruthy();
    }
    expect(cleEtat('trip', true)).toBe('pupitre.etat.paused');
    expect(cleEtat('trip', false)).toBe('pupitre.etat.trip');
    expect(cleEtat('paused', false)).toBe('pupitre.etat.approach');
  });

  it('titre de l’issue : mêmes clés que le panneau d’issue, aux deux niveaux', () => {
    expect(cleTitreIssue('level1', 'win')).toBe('level1.winTitle');
    expect(cleTitreIssue('level1', 'noLift')).toBe('level1.failTitle.noLift');
    expect(cleTitreIssue('level1', 'bonk')).toBe('level1.failTitle.bonk');
    expect(cleTitreIssue('level1', 'step')).toBe('level1.failTitle.step');
    expect(cleTitreIssue('level1', 'slow')).toBe('level1.failTitle.step');
    expect(cleTitreIssue('level2', 'win')).toBe('level2.winTitle');
    expect(cleTitreIssue('level2', 'slow')).toBe('level2.failTitle.slow');
    expect(cleTitreIssue('level2', 'bonk')).toBe('level2.failTitle.bonk');
    expect(cleTitreIssue('level2', 'step')).toBe('level2.failTitle.step');
    expect(cleTitreIssue('level2', 'noLift')).toBe('level2.failTitle.step');
  });
});
