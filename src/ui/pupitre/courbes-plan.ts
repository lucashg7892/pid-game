/**
 * Disposition de la colonne de droite du pupitre, « les courbes » (T-051) : quatre enregistreurs à
 * papier alignés sur un axe du temps commun (erreur, force du moteur, vitesse, accélération), du haut
 * vers le bas, et l'axe du temps dessous, avec la poignée du curseur. Fonctions pures, sans DOM ni
 * canvas, en unités du plan du pupitre.
 */
import type { LevelId } from '../../game';
import type { RectPlan } from './plan';

/** Identifiant d'un enregistreur. */
export type IdBande = 'erreur' | 'commande' | 'vitesse' | 'acceleration';

/** Un enregistreur : rangées de textes au-dessus du papier, et papier (zone de tracé). */
export interface BandeCourbes {
  /** Enregistreur. */
  readonly id: IdBande;
  /** Ligne de base du titre (et de la valeur lue à droite). */
  readonly titreY: number;
  /** Lignes de base des rangées de légende (force du moteur : une au niveau 1, deux au niveau 2). */
  readonly legendesY: readonly number[];
  /** Haut du papier (valeur maximale de l'échelle). */
  readonly haut: number;
  /** Bas du papier (valeur minimale de l'échelle). */
  readonly bas: number;
}

/** Disposition de la colonne. */
export interface DispositionCourbes {
  /** Bord gauche du papier (t = 0). */
  readonly x0: number;
  /** Bord droit du papier (t = durée maximale). */
  readonly x1: number;
  /** Ligne de base du titre de la colonne. */
  readonly titreY: number;
  /** Quatre enregistreurs, du haut vers le bas. */
  readonly bandes: readonly [BandeCourbes, BandeCourbes, BandeCourbes, BandeCourbes];
  /** Bas du dernier papier. */
  readonly axeBas: number;
  /** Ligne de base des chiffres du temps. */
  readonly chiffresY: number;
  /** Ligne de base du titre de l'axe du temps. */
  readonly axeTitreY: number;
  /** Zone qui reçoit le doigt et la souris (tous les papiers et l'axe du temps). */
  readonly zone: RectPlan;
  /** Zone de la poignée (rangée sous le dernier papier) : porte le curseur clavier. */
  readonly poignee: RectPlan;
}

/** Hauteur d'une rangée de texte (unités) : 16 de corps, rien de collé. */
export const RANGEE = 25;
/** Hauteur d'une rangée de légende (unités). */
export const RANGEE_LEGENDE = 20;
/** Marge intérieure de la plaque (unités). */
export const MARGE = 16;
/** Largeur réservée aux chiffres des échelles, à gauche du papier (unités). */
export const MARGE_CHIFFRES = 54;
/** Hauteur de la poignée du curseur, sous le dernier papier (unités). */
export const HAUTEUR_POIGNEE = 14;

/**
 * Disposition de la colonne dans son rectangle.
 * @param r rectangle de la colonne dans le plan.
 * @param niveau niveau (le niveau 2 ajoute la rangée des termes P et I).
 */
export function dispositionCourbes(r: Readonly<RectPlan>, niveau: LevelId): DispositionCourbes {
  const x0 = r.x + MARGE + MARGE_CHIFFRES;
  const x1 = r.x + r.w - MARGE;
  const rangeesLegende = niveau === 'level2' ? 2 : 1;
  const ecart = 5;
  let y = r.y + 42;
  const fabrique = (id: IdBande, legendes: number, hauteur: number): BandeCourbes => {
    const titreY = y + 17;
    const legendesY: number[] = [];
    for (let k = 0; k < legendes; k += 1) {
      legendesY.push(y + RANGEE + k * RANGEE_LEGENDE + 15);
    }
    const haut = y + RANGEE + legendes * RANGEE_LEGENDE;
    const bas = haut + hauteur;
    y = bas + ecart;
    return { id, titreY, legendesY, haut, bas };
  };
  const erreur = fabrique('erreur', 0, 70);
  const commande = fabrique('commande', rangeesLegende, niveau === 'level2' ? 92 : 112);
  const vitesse = fabrique('vitesse', 0, 70);
  const acceleration = fabrique('acceleration', 0, 70);
  const axeBas = acceleration.bas;
  return {
    x0,
    x1,
    titreY: r.y + 30,
    bandes: [erreur, commande, vitesse, acceleration],
    axeBas,
    chiffresY: axeBas + HAUTEUR_POIGNEE + 15,
    axeTitreY: axeBas + HAUTEUR_POIGNEE + 36,
    zone: { x: x0, y: erreur.haut, w: x1 - x0, h: axeBas + HAUTEUR_POIGNEE - erreur.haut },
    poignee: { x: x0, y: axeBas, w: x1 - x0, h: HAUTEUR_POIGNEE },
  };
}

/**
 * Abscisse d'un pas du journal sur le papier.
 * @param g disposition.
 * @param indice pas (instant indice·dt).
 * @param pasMax nombre de pas de l'axe du temps (durée maximale).
 */
export function xDePas(
  g: Readonly<Pick<DispositionCourbes, 'x0' | 'x1'>>,
  indice: number,
  pasMax: number,
): number {
  return g.x0 + (indice / pasMax) * (g.x1 - g.x0);
}

/**
 * Pas du journal sous une abscisse du plan (arrondi, hors du papier : borné aux bords).
 * @param g disposition.
 * @param x abscisse dans le plan.
 * @param pasMax nombre de pas de l'axe du temps.
 */
export function pasDeX(
  g: Readonly<Pick<DispositionCourbes, 'x0' | 'x1'>>,
  x: number,
  pasMax: number,
): number {
  const f = (x - g.x0) / (g.x1 - g.x0);
  if (Number.isNaN(f)) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, f)) * pasMax);
}
