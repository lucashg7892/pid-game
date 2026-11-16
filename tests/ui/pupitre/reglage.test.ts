/**
 * Colonne de réglage du pupitre (T-049) : géométrie des leviers (zones, champs, boutons), position
 * de la manette, et dessin sans erreur aux deux niveaux dans les états de verrou (contexte 2D
 * factice : on vérifie qu'il dessine des textes traduits et lisibles).
 */
import { describe, expect, it } from 'vitest';
import { createLevel1, createLevel2, type Level } from '../../../src/game';
import { createTranslator, type Locale } from '../../../src/i18n';
import {
  COLONNES,
  creerColonneReglage,
  creerColonneVide,
  fractionDeY,
  geometrieReglage,
  reglageDe,
  yDeValeur,
  type EtatPupitre,
} from '../../../src/ui/pupitre';

interface Texte {
  s: string;
  taille: number;
}

/** Contexte 2D factice : enregistre les textes et leur taille, accepte tout le reste. */
function faux(): { ctx: CanvasRenderingContext2D; textes: Texte[] } {
  const textes: Texte[] = [];
  const etat: Record<string, unknown> = { font: '10px x' };
  const ctx = new Proxy(etat, {
    get(cible, nom: string) {
      if (nom === 'fillText') {
        return (s: string): void => {
          textes.push({ s, taille: Number.parseFloat(String(cible['font'])) });
        };
      }
      if (nom === 'measureText') {
        return (s: string): { width: number } => ({ width: s.length * 8 });
      }
      if (nom in cible) return cible[nom];
      return () => undefined;
    },
    set(cible, nom: string, valeur) {
      cible[nom] = valeur;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, textes };
}

function etatDe(level: Level, locale: Locale): EtatPupitre {
  const s = level.snapshot;
  const paused = s.phase === 'paused';
  const phase = paused && s.resumePhase !== null ? s.resumePhase : s.phase;
  return {
    niveau: s.levelId,
    reglageSpec: level.tuning,
    snapshot: s,
    journal: level.tripLog,
    traducteur: createTranslator(locale),
    reglage: reglageDe(s.levelId, phase, paused),
    phase,
    enPause: paused,
    mouvementReduit: false,
    versionFond: 1,
    maintenant: 0,
    annoncer: () => undefined,
  };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const croise = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('géométrie de la colonne de réglage', () => {
  const geo = geometrieReglage(COLONNES.reglage);
  const col = COLONNES.reglage;

  it('tout tient dans la colonne, sans chevauchement entre les deux plaques', () => {
    for (const r of [geo.plaque, geo.etat]) {
      expect(r.x).toBeGreaterThanOrEqual(col.x);
      expect(r.x + r.w).toBeLessThanOrEqual(col.x + col.w);
      expect(r.y).toBeGreaterThanOrEqual(col.y);
      expect(r.y + r.h).toBeLessThanOrEqual(col.y + col.h);
    }
    expect(geo.plaque.y + geo.plaque.h).toBeLessThan(geo.etat.y);
  });

  it('leviers, champs, Lancer et Fermer sont dans leur plaque, sans se recouvrir', () => {
    const dans = (r: Rect, p: Rect): void => {
      expect(r.x).toBeGreaterThanOrEqual(p.x);
      expect(r.y).toBeGreaterThanOrEqual(p.y);
      expect(r.x + r.w).toBeLessThanOrEqual(p.x + p.w);
      expect(r.y + r.h).toBeLessThanOrEqual(p.y + p.h);
    };
    for (const l of [geo.kp, geo.ki]) {
      dans(l.zone, geo.plaque);
      dans(l.champ, geo.plaque);
      expect(l.fente.haut).toBeLessThan(l.fente.bas);
      expect(l.zone.y + l.zone.h).toBeLessThan(l.champ.y);
    }
    dans(geo.lancer, geo.plaque);
    dans(geo.fermer, geo.etat);
    expect(croise(geo.kp.champ, geo.ki.champ)).toBe(false);
    expect(croise(geo.kp.zone, geo.ki.zone)).toBe(false);
    expect(croise(geo.kp.champ, geo.lancer)).toBe(false);
    expect(croise(geo.ki.champ, geo.lancer)).toBe(false);
  });

  it('cibles de pointeur d’au moins 40 unités de large, champs et boutons d’au moins 40 de haut', () => {
    for (const l of [geo.kp, geo.ki]) {
      expect(l.zone.w).toBeGreaterThanOrEqual(40);
      expect(l.champ.h).toBeGreaterThanOrEqual(40);
    }
    expect(geo.lancer.h).toBeGreaterThanOrEqual(40);
    expect(geo.fermer.h).toBeGreaterThanOrEqual(40);
  });

  it('yDeValeur et fractionDeY sont inverses, et bornées', () => {
    const l = geo.kp;
    expect(yDeValeur(l, 0)).toBe(l.fente.bas);
    expect(yDeValeur(l, 1)).toBe(l.fente.haut);
    for (const f of [0, 0.25, 0.5, 1]) {
      expect(fractionDeY(l, yDeValeur(l, f))).toBeCloseTo(f, 9);
    }
    expect(fractionDeY(l, l.fente.haut - 500)).toBe(1);
    expect(fractionDeY(l, l.fente.bas + 500)).toBe(0);
  });
});

describe('dessin de la colonne de réglage', () => {
  for (const locale of ['fr', 'en'] as const) {
    for (const [nom, creer] of [
      ['niveau 1', () => createLevel1({ animations: false })],
      ['niveau 2', () => createLevel2({ animations: false })],
    ] as const) {
      it(`${locale}, ${nom} : fond et vif dessinés en réglage, en trajet et à l’issue, textes lisibles`, () => {
        const level = creer();
        level.interact();
        const colonne = creerColonneReglage();
        const vus: Texte[] = [];
        for (const etape of ['reglage', 'trajet', 'issue'] as const) {
          if (etape === 'trajet') {
            level.launch();
            level.update(0.5);
          } else if (etape === 'issue') {
            for (let i = 0; i < 4000 && level.snapshot.phase !== 'outcome'; i += 1) {
              level.update(1 / 30);
            }
          }
          const etat = etatDe(level, locale);
          const { ctx, textes } = faux();
          colonne.dessinerFond(ctx, COLONNES.reglage, etat);
          colonne.dessiner(ctx, COLONNES.reglage, etat);
          expect(textes.length, etape).toBeGreaterThan(5);
          vus.push(...textes);
        }
        // Chaque nombre et chaque libellé : 16 unités au moins (lisibles à l'échelle 1).
        for (const t of vus) {
          expect(t.taille, t.s).toBeGreaterThanOrEqual(16);
          expect(t.s.trim(), 'texte vide').not.toBe('');
          expect(t.s).not.toMatch(/undefined|NaN|\[object/);
        }
      });
    }
  }

  it('niveau 1 : « Hors service » ; niveau 2 : « fixé » ; en FR et en EN', () => {
    for (const [locale, hors, fixe] of [
      ['fr', 'Hors service', 'fixé'],
      ['en', 'Out of service', 'fixed'],
    ] as const) {
      const colonne = creerColonneReglage();
      const l1 = createLevel1({ animations: false });
      l1.interact();
      const a = faux();
      colonne.dessinerFond(a.ctx, COLONNES.reglage, etatDe(l1, locale));
      colonne.dessiner(a.ctx, COLONNES.reglage, etatDe(l1, locale));
      expect(a.textes.map((t) => t.s)).toContain(hors);
      const l2 = createLevel2({ animations: false });
      l2.interact();
      const b = faux();
      colonne.dessinerFond(b.ctx, COLONNES.reglage, etatDe(l2, locale));
      colonne.dessiner(b.ctx, COLONNES.reglage, etatDe(l2, locale));
      expect(b.textes.map((t) => t.s)).toContain(fixe);
      expect(b.textes.map((t) => t.s)).not.toContain(hors);
    }
  });

  it('temps du trajet : texte stable tant que le dixième de seconde ne change pas', () => {
    const level = createLevel1({ animations: false });
    level.interact();
    level.launch();
    for (let i = 0; i < 18; i += 1) level.update(1 / 60);
    const colonne = creerColonneReglage();
    const etat = etatDe(level, 'fr');
    const a = faux();
    colonne.dessiner(a.ctx, COLONNES.reglage, etat);
    const tempsA = a.textes.find((t) => t.s.startsWith('Temps'))?.s;
    expect(tempsA).toMatch(/^Temps\s: 0,3\ss$/);
    const b = faux();
    colonne.dessiner(b.ctx, COLONNES.reglage, etat);
    expect(b.textes.find((t) => t.s.startsWith('Temps'))?.s).toBe(tempsA);
  });

  it('colonnes vides : dessinent un cadre et rien d’autre, sans texte', () => {
    for (const id of ['machine', 'courbes'] as const) {
      const colonne = creerColonneVide(id);
      expect(colonne.id).toBe(id);
      const level = createLevel1({ animations: false });
      const { ctx, textes } = faux();
      colonne.dessinerFond(ctx, COLONNES[id], etatDe(level, 'fr'));
      colonne.dessiner(ctx, COLONNES[id], etatDe(level, 'fr'));
      expect(textes).toEqual([]);
    }
  });
});

describe('plaque d’état : rien de superposé (correctif T-051)', () => {
  interface Boite {
    s: string;
    x: number;
    y: number;
    taille: number;
    align: string;
  }

  /** Contexte 2D factice qui garde la position des textes (0,45 fois le corps par caractère (large pour la police réelle)). */
  function fauxPositions(): { ctx: CanvasRenderingContext2D; boites: Boite[] } {
    const boites: Boite[] = [];
    const etat: Record<string, unknown> = { font: '10px x', textAlign: 'left' };
    const taille = (): number => Number.parseFloat(String(etat['font']));
    const ctx = new Proxy(etat, {
      get(cible, nom: string) {
        if (nom === 'fillText') {
          return (s: string, x: number, y: number): void => {
            boites.push({ s, x, y, taille: taille(), align: String(cible['textAlign']) });
          };
        }
        if (nom === 'measureText') {
          return (s: string): { width: number } => ({ width: s.length * taille() * 0.45 });
        }
        if (nom in cible) return cible[nom];
        return () => undefined;
      },
      set(cible, nom: string, valeur) {
        cible[nom] = valeur;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, boites };
  }

  const issues = [
    ['level1', ['win', 'bonk', 'noLift', 'step']],
    ['level2', ['win', 'bonk', 'slow', 'step']],
  ] as const;

  it('le titre de l’issue (une ou deux lignes), le temps et l’état ne touchent pas « Fermer »', () => {
    const geo = geometrieReglage(COLONNES.reglage);
    for (const [niveau, sorties] of issues) {
      for (const locale of ['fr', 'en'] as const) {
        for (const outcome of sorties) {
          const level = niveau === 'level1' ? createLevel1() : createLevel2();
          const base = etatDe(level, locale);
          const etat: EtatPupitre = {
            ...base,
            phase: 'outcome',
            snapshot: { ...base.snapshot, outcome, t: 12.3 },
            reglage: reglageDe(niveau, 'outcome', false),
          };
          const { ctx, boites } = fauxPositions();
          creerColonneReglage().dessiner(ctx, COLONNES.reglage, etat);
          const f = geo.fermer;
          for (const b of boites) {
            const largeur = b.s.length * b.taille * 0.45;
            const gauche = b.align === 'center' ? b.x - largeur / 2 : b.x;
            const touche =
              gauche < f.x + f.w &&
              gauche + largeur > f.x &&
              b.y - b.taille < f.y + f.h &&
              b.y + 4 > f.y;
            expect(touche, `${locale} ${niveau} ${outcome} : « ${b.s} » touche Fermer`).toBe(false);
            // Le texte tient dans la plaque d'état.
            expect(gauche + largeur).toBeLessThanOrEqual(geo.etat.x + geo.etat.w - 8);
            expect(b.y + 4).toBeLessThanOrEqual(geo.etat.y + geo.etat.h - 4);
          }
        }
      }
    }
  });

  it('une issue longue passe sur deux lignes, sans dépasser de la plaque', () => {
    const level = createLevel1();
    const base = etatDe(level, 'en');
    const etat: EtatPupitre = {
      ...base,
      phase: 'outcome',
      snapshot: { ...base.snapshot, outcome: 'noLift' },
      reglage: reglageDe('level1', 'outcome', false),
    };
    const { ctx, boites } = fauxPositions();
    creerColonneReglage().dessiner(ctx, COLONNES.reglage, etat);
    const titre = boites.filter((b) => b.taille === 21);
    expect(titre.length).toBe(2);
    expect(titre.map((b) => b.s).join(' ')).toBe('The lift won’t leave the ground');
  });
});
