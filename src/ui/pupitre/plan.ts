/**
 * Plan du pupitre (T-049) : le pupitre est dessiné dans un plan fixe de {@link PLAN_LARGEUR} ×
 * {@link PLAN_HAUTEUR} unités (1 unité = 1 px CSS à l'échelle 1), mis à l'échelle et centré dans la
 * zone que le jeu lui laisse (entre la barre du haut et le bandeau du bas, qui restent visibles).
 * À 1280 × 720 l'échelle vaut 1 : une taille de police du plan est une taille réelle en pixels.
 *
 * Trois colonnes : réglage (à gauche, T-049), machine (au centre, T-050) et courbes (à droite,
 * T-051). Sur un écran étroit (portrait), seule la colonne de réglage est montrée, à la plus
 * grande échelle qui tient.
 *
 * Fonctions pures : aucune dépendance au DOM.
 */

/** Largeur du plan (unités). */
export const PLAN_LARGEUR = 1280;
/** Hauteur du plan (unités). */
export const PLAN_HAUTEUR = 580;
/** Hauteur réservée en haut (px) : la barre du haut (titre, boutons) reste visible. */
export const RESERVE_HAUT = 56;
/** Idem en portrait étroit (px) : le titre et l'étiquette de Kp passent sur deux lignes. */
export const RESERVE_HAUT_PORTRAIT = 76;
/** Hauteur réservée en bas (px) : le bandeau d'aide, ou l'issue repliée, reste visible. */
export const RESERVE_BAS = 84;
/** Largeur d'écran (px) en dessous de laquelle seule la colonne de réglage est montrée. */
export const LARGEUR_ETROITE = 900;
/** Échelle maximale en mode étroit (pour ne pas agrandir la colonne démesurément). */
export const ECHELLE_ETROITE_MAX = 1.5;

/** Rectangle du plan (unités). */
export interface RectPlan {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Colonne du pupitre. */
export type IdColonne = 'reglage' | 'machine' | 'courbes';

/** Rectangles des colonnes dans le plan (marge de 10 unités autour, 8 entre les colonnes). */
export const COLONNES: Readonly<Record<IdColonne, RectPlan>> = Object.freeze({
  reglage: { x: 10, y: 10, w: 308, h: 560 },
  machine: { x: 326, y: 10, w: 536, h: 560 },
  courbes: { x: 870, y: 10, w: 400, h: 560 },
});

/**
 * Hauteur réservée en haut pour une fenêtre donnée : celle de la barre du haut, plus grande en
 * portrait étroit (même condition que la règle CSS `.ui-pupitre`).
 * @param largeur largeur de la fenêtre (px).
 * @param hauteur hauteur de la fenêtre (px).
 */
export function reserveHaut(largeur: number, hauteur: number): number {
  return hauteur >= largeur && largeur <= 700 ? RESERVE_HAUT_PORTRAIT : RESERVE_HAUT;
}

/** Placement du plan dans la fenêtre. */
export interface PlacementPlan {
  /** Étroit : seule la colonne de réglage est montrée. */
  readonly etroit: boolean;
  /** Échelle du plan (px par unité). */
  readonly echelle: number;
  /** Largeur du plan montré (unités). */
  readonly largeur: number;
  /** Hauteur du plan montré (unités). */
  readonly hauteur: number;
  /** Décalage horizontal du plan montré, en px CSS depuis le bord gauche de la zone. */
  readonly gauche: number;
  /** Décalage vertical du plan montré, en px CSS depuis le haut de la zone. */
  readonly haut: number;
  /** Largeur de la zone laissée au pupitre (px CSS). */
  readonly zoneLargeur: number;
  /** Hauteur de la zone laissée au pupitre (px CSS). */
  readonly zoneHauteur: number;
  /** Colonnes montrées. */
  readonly colonnes: readonly IdColonne[];
}

/**
 * Place le plan dans une fenêtre de `largeur` × `hauteur` px CSS.
 * @param largeur largeur de la fenêtre (px).
 * @param hauteur hauteur de la fenêtre (px).
 */
export function placerPlan(largeur: number, hauteur: number): PlacementPlan {
  const zoneLargeur = Math.max(1, largeur);
  const zoneHauteur = Math.max(1, hauteur - reserveHaut(largeur, hauteur) - RESERVE_BAS);
  const etroit = zoneLargeur < LARGEUR_ETROITE;
  const reglage = COLONNES.reglage;
  const w = etroit ? reglage.w + 2 * reglage.x : PLAN_LARGEUR;
  const h = etroit ? reglage.h + 2 * reglage.y : PLAN_HAUTEUR;
  const plafond = etroit ? ECHELLE_ETROITE_MAX : Number.POSITIVE_INFINITY;
  const echelle = Math.min(zoneLargeur / w, zoneHauteur / h, plafond);
  return {
    etroit,
    echelle,
    largeur: w,
    hauteur: h,
    gauche: (zoneLargeur - w * echelle) / 2,
    haut: (zoneHauteur - h * echelle) / 2,
    zoneLargeur,
    zoneHauteur,
    colonnes: etroit ? ['reglage'] : ['reglage', 'machine', 'courbes'],
  };
}
