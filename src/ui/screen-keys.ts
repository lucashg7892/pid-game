/**
 * Traduction touche → intention pour les écrans titre et menu (spec T-017 §4.4). Fonction pure,
 * testable sous Node, sur le modèle de `keys.ts`.
 *
 * Règles :
 * - Ctrl, Alt ou Meta enfoncée : aucune intention (raccourcis du navigateur intacts) ;
 * - Entrée et Espace, Tab et Maj+Tab : comportement natif du bouton focalisé (`none`) ;
 * - titre : Échap ne fait rien ;
 * - menu : ↑ ↓ déplacent le focus entre les contrôles (niveaux jouables puis « Retour »), sans
 *   bouclage ; Échap revient au titre ;
 * - niveau : ces touches n'ont aucun rôle (le clavier du niveau est `keys.ts`).
 */
import type { ScreenId } from '../app';

/** Entrée de {@link screenKeyToIntent}. */
export interface ScreenKeyInput {
  /** `KeyboardEvent.code`. */
  readonly code: string;
  /** Écran affiché. */
  readonly screen: ScreenId;
  /**
   * Rang du contrôle qui a le focus parmi les contrôles du menu (niveaux jouables dans l'ordre,
   * puis « Retour »), ou -1 si le focus est ailleurs.
   */
  readonly focusIndex: number;
  /** Nombre de contrôles focalisables du menu (« Retour » compris). */
  readonly focusCount: number;
  /** Répétition automatique d'une touche maintenue. */
  readonly repeat: boolean;
  /** Touche Ctrl enfoncée. */
  readonly ctrlKey: boolean;
  /** Touche Alt enfoncée. */
  readonly altKey: boolean;
  /** Touche Meta enfoncée. */
  readonly metaKey: boolean;
}

/**
 * Intention :
 * - `none` : rien, comportement natif conservé ;
 * - `block` : rien, mais `preventDefault` (la page ne défile pas) ;
 * - les autres : exécutées avec `preventDefault`.
 */
export type ScreenKeyIntent =
  'none' | 'block' | 'focusPrev' | 'focusNext' | 'focusFirst' | 'focusLast' | 'back';

/**
 * Traduit une frappe en intention (fonction pure).
 * @param input champs de l'événement clavier et contexte.
 */
export function screenKeyToIntent(input: ScreenKeyInput): ScreenKeyIntent {
  const { code, focusIndex, focusCount } = input;
  if (input.ctrlKey || input.altKey || input.metaKey) {
    return 'none';
  }
  // Entrée maintenue : le navigateur synthétiserait un clic à chaque répétition et la frappe
  // traverserait deux écrans (A-01). La première frappe reste native.
  if (input.repeat && (code === 'Enter' || code === 'NumpadEnter' || code === 'Space')) {
    return input.screen === 'level' ? 'none' : 'block';
  }
  if (input.screen !== 'menu') {
    return 'none';
  }
  if (code === 'Escape') {
    return 'back';
  }
  if (code !== 'ArrowUp' && code !== 'ArrowDown') {
    return 'none';
  }
  const inList = focusIndex >= 0 && focusIndex < focusCount;
  if (!inList) {
    return code === 'ArrowDown' ? 'focusFirst' : 'focusLast';
  }
  if (code === 'ArrowDown') {
    return focusIndex < focusCount - 1 ? 'focusNext' : 'block';
  }
  return focusIndex > 0 ? 'focusPrev' : 'block';
}
