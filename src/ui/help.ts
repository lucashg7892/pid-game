/**
 * Règles pures de l'aide des commandes (K19, K21) : pause automatique pendant un trajet et piège
 * de focus. Testable sous Node : ni DOM, ni état.
 */
import { isRunningPhase, type LevelPhase } from '../game';

/** Décision prise à l'ouverture ou à la fermeture de l'aide. */
export interface HelpPauseDecision {
  /** Commande à envoyer au niveau. */
  readonly action: 'pause' | 'resume' | 'none';
  /** Vrai si c'est l'aide qui tient le jeu en pause après cette décision. */
  readonly pausedByHelp: boolean;
}

/**
 * Décide de la pause à l'ouverture (`opening`) ou à la fermeture de l'aide.
 * L'ouverture met en pause seulement quand le jeu avance seul (embarquement, trajet, sortie) ; la
 * fermeture reprend seulement si c'est
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
    return isRunningPhase(phase)
      ? { action: 'pause', pausedByHelp: true }
      : { action: 'none', pausedByHelp: false };
  }
  return pausedByHelp && phase === 'paused'
    ? { action: 'resume', pausedByHelp: false }
    : { action: 'none', pausedByHelp: false };
}

/** Fenêtre modale ouverte au-dessus du jeu : l'aide des commandes ou le tableau d'école. */
export type ModalKind = 'help' | 'board';

/**
 * Décide de la pause quand la fenêtre modale change (T-042). L'aide et le tableau se partagent la
 * même règle ({@link helpPauseDecision}) et s'excluent : passer de l'une à l'autre ne change pas la
 * pause (ni reprise, ni seconde pause) ; `pausedByHelp` désigne alors « la pause tenue par une
 * fenêtre modale ».
 * @param from fenêtre ouverte avant, ou `null`.
 * @param to fenêtre ouverte après, ou `null`.
 * @param phase phase courante du niveau.
 * @param pausedByModal vrai si une fenêtre modale tenait le jeu en pause.
 */
export function modalPauseDecision(
  from: ModalKind | null,
  to: ModalKind | null,
  phase: LevelPhase,
  pausedByModal: boolean,
): HelpPauseDecision {
  if (from === null && to !== null) {
    return helpPauseDecision(true, phase, pausedByModal);
  }
  if (from !== null && to === null) {
    return helpPauseDecision(false, phase, pausedByModal);
  }
  return { action: 'none', pausedByHelp: pausedByModal };
}

/**
 * Vrai si les commandes du niveau (pause, reprise, réglage, tactile...) sont suspendues : tant
 * que l'aide ou le tableau d'école est ouvert, seule sa fermeture agit (K24) ; la reprise se fait
 * par {@link modalPauseDecision}.
 * @param helpOpen vrai si l'aide est ouverte.
 * @param boardOpen vrai si le tableau d'école est ouvert.
 */
export function commandsBlocked(helpOpen: boolean, boardOpen = false): boolean {
  return helpOpen || boardOpen;
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

/**
 * Indice du contrôle qui doit recevoir le focus après un Tab quand l'ordre est géré à la main (le
 * pupitre ouvert, dont les contrôles ne suivent pas l'ordre du document) : le suivant, ou le
 * précédent avec Maj, en bouclant ; `null` s'il n'y a aucun contrôle. Hors de la liste (indice −1),
 * entre par le début, ou par la fin avec Maj.
 * @param current indice du contrôle actif dans la liste, -1 s'il est hors de la liste.
 * @param count nombre de contrôles.
 * @param shift vrai pour Maj+Tab.
 */
export function cycleFocusIndex(current: number, count: number, shift: boolean): number | null {
  if (count <= 0) {
    return null;
  }
  if (current < 0) {
    return shift ? count - 1 : 0;
  }
  return (current + (shift ? count - 1 : 1)) % count;
}
