/** Catalogue des niveaux (données pures : les titres vivent dans les catalogues i18n). */

/** Entrée du catalogue. */
export interface LevelEntry {
  /** Identifiant stable du niveau. */
  readonly id: string;
  /** Vrai si le niveau peut être lancé. */
  readonly playable: boolean;
}

/** Niveaux du jeu, dans l'ordre du menu. */
export const LEVELS: readonly LevelEntry[] = Object.freeze([
  Object.freeze({ id: 'level1', playable: true }),
  Object.freeze({ id: 'level2', playable: true }),
]);
