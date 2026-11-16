/**
 * Style des tracés des courbes (T-051) : épaisseur et tirets de chaque signal, communs à la légende
 * (couche fixe) et aux courbes (couche vive). Les tableaux de tirets sont créés une fois : le dessin de
 * chaque image n'alloue rien.
 */

/** Signal tracé. */
export type CleSignal = 'e' | 'uSat' | 'uCmd' | 'p' | 'i' | 'v' | 'a';

/** Style d'un tracé. */
export interface StyleTrace {
  /** Épaisseur (unités). */
  readonly largeur: number;
  /** Tirets (vide : trait plein). */
  readonly tirets: number[];
}

/** Styles : la force demandée en tirets, le terme P fin, le terme I en pointillés. */
export const STYLES: Readonly<Record<CleSignal, StyleTrace>> = {
  e: { largeur: 2.4, tirets: [] },
  uSat: { largeur: 2.8, tirets: [] },
  uCmd: { largeur: 1.8, tirets: [7, 5] },
  p: { largeur: 1.3, tirets: [] },
  i: { largeur: 2.6, tirets: [0.5, 5] },
  v: { largeur: 2.4, tirets: [] },
  a: { largeur: 2.4, tirets: [] },
};
