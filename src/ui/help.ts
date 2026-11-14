/**
 * Règles pures de l'aide des commandes (K19, K21) : pause automatique pendant un trajet et piège
 * de focus. Testable sous Node : ni DOM, ni état.
 */
import type { LevelPhase } from '../game';

/** Décision prise à l'ouverture ou à la fermeture de l'aide. */
export interface HelpPauseDecision {
  /** Commande à envoyer au niveau. */
  readonly action: 'pause' | 'resume' | 'none';
  /** Vrai si c'est l'aide qui tient le jeu en pause après cette décision. */
  readonly pausedByHelp: boolean;
}

/**
 * Décide de la pause à l'ouverture (`opening`) ou à la fermeture de l'aide.
 * L'ouverture met en pause seulement pendant un trajet ; la fermeture reprend seulement si c'est
 * l'aide qui avait mis en pause et que le jeu est toujours en pause.
 * @param opening vrai à l'ouverture, faux à la fermeture.
 * @param phase phase courante du niveau.
 * @param pausedByHelp vrai si l'aide avait mis le jeu en pause.
 */
export function helpPauseDecision(
  opening: boolean,
  phase: LevelPhase,
  pausedByHelp: boolean,
): HelpPauseDecision {
  if (opening) {
    return phase === 'trip'
      ? { action: 'pause', pausedByHelp: true }
      : { action: 'none', pausedByHelp: false };
  }
  return pausedByHelp && phase === 'paused'
    ? { action: 'resume', pausedByHelp: false }
    : { action: 'none', pausedByHelp: false };
}

/**
 * Indice du contrôle qui doit recevoir le focus après un Tab dans l'aide, ou `null` si le
 * comportement natif convient (le focus reste entre deux contrôles de l'aide).
 * @param current indice du contrôle actif dans l'aide, -1 s'il est hors de l'aide.
 * @param count nombre de contrôles focalisables de l'aide.
 * @param shift vrai pour Maj+Tab.
 */
export function trapFocusIndex(current: number, count: number, shift: boolean): number | null {
  if (count <= 0) {
    return null;
  }
  if (current < 0) {
    return shift ? count - 1 : 0;
  }
  if (shift && current === 0) {
    return count - 1;
  }
  if (!shift && current === count - 1) {
    return 0;
  }
  return null;
}
