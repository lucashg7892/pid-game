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

/**
 * Niveau jouable qui suit `levelId` dans le catalogue.
 * @param levelId identifiant du niveau terminé.
 * @param levels catalogue (défaut : {@link LEVELS}).
 * @returns l'identifiant du suivant jouable, ou `null` si `levelId` est inconnu ou dernier.
 */
export function nextLevelId(
  levelId: string,
  levels: readonly LevelEntry[] = LEVELS,
): string | null {
  const index = levels.findIndex((level) => level.id === levelId);
  if (index < 0) {
    return null;
  }
  return levels.slice(index + 1).find((level) => level.playable)?.id ?? null;
}
