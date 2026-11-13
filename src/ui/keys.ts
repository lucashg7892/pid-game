/**
 * Traduction touche → intention (commandes définitives, spec T-001 §6, T-010). Fonction pure,
 * testable sous Node : ni DOM, ni état. Le code DOM (`input.ts`) lui passe les champs utiles de
 * `KeyboardEvent` et la cible du focus, puis exécute l'intention.
 *
 * Règles :
 * - Ctrl, Alt ou Meta enfoncée : aucune intention (raccourcis du navigateur intacts) ;
 * - la marche se lit sur `code` (position physique : Q/D en AZERTY, A/D en QWERTY) ;
 * - `+`, `-` se lisent sur `key` (`=` vaut `+`), le pavé numérique sur `code` ;
 * - champ numérique : comportement natif pour tout sauf Échap ;
 * - bouton (ou autre contrôle activable) : Entrée et Espace restent natifs ;
 * - curseur : flèches, Début et Fin restent natives (elles règlent la valeur) ;
 * - toute touche du jeu, et les touches qui feraient défiler la page, sont bloquées
 *   (`preventDefault`).
 */
import type { LevelPhase } from '../game';

/** Ce qui a le focus au moment de la frappe. */
export type FocusTarget =
  /** Le document, le canvas ou un élément non interactif. */
  | 'none'
  /** Le curseur `<input type="range">` de Kp. */
  | 'range'
  /** Le champ numérique de Kp (saisie libre). */
  | 'number'
  /** Un bouton, un lien ou un résumé de `<details>`. */
  | 'button';

/** Champs de `KeyboardEvent` et contexte utiles à la traduction. */
export interface KeyInput {
  /** `KeyboardEvent.code` (position physique). */
  readonly code: string;
  /** `KeyboardEvent.key` (caractère produit). */
  readonly key: string;
  /** Touche Ctrl enfoncée. */
  readonly ctrlKey: boolean;
  /** Touche Alt enfoncée. */
  readonly altKey: boolean;
  /** Touche Meta (⌘, Windows) enfoncée. */
  readonly metaKey: boolean;
  /** Répétition automatique d'une touche maintenue. */
  readonly repeat: boolean;
  /** Phase courante du niveau. */
  readonly phase: LevelPhase;
  /** Cible du focus. */
  readonly focus: FocusTarget;
  /** Vrai si le panneau d'aide des commandes est ouvert. */
  readonly helpOpen: boolean;
}

/**
 * Intention produite par une touche :
 * - `none` : rien, comportement natif conservé ;
 * - `block` : rien, mais `preventDefault` (empêche le défilement) ;
 * - les autres : une commande du jeu ou de l'interface, avec `preventDefault`.
 */
export type KeyIntent =
  | 'none'
  | 'block'
  | 'walkLeft'
  | 'walkRight'
  | 'interact'
  | 'launch'
  | 'kpUp'
  | 'kpDown'
  | 'kpUpBig'
  | 'kpDownBig'
  | 'restart'
  | 'pause'
  | 'resume'
  | 'closeHelp';

/** Écart de Kp d'une touche + ou − (N/m). */
export const KP_SMALL_STEP = 100;
/** Écart de Kp d'une touche Page préc. ou Page suiv. (N/m). */
export const KP_BIG_STEP = 1000;

/** Touches qui feraient défiler la page : bloquées quand le focus n'est sur aucun contrôle. */
const SCROLL_CODES: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Space',
  'Enter',
  'NumpadEnter',
]);

/** Côté de marche d'une touche (par `code`), ou `null`. */
export function walkSideOf(code: string): 'left' | 'right' | null {
  if (code === 'ArrowLeft' || code === 'KeyA') {
    return 'left';
  }
  if (code === 'ArrowRight' || code === 'KeyD') {
    return 'right';
  }
  return null;
}

/**
 * Écart de Kp (N/m) d'une intention de réglage ; 0 pour une autre intention.
 * @param intent intention.
 */
export function kpDeltaOf(intent: KeyIntent): number {
  switch (intent) {
    case 'kpUp':
      return KP_SMALL_STEP;
    case 'kpDown':
      return -KP_SMALL_STEP;
    case 'kpUpBig':
      return KP_BIG_STEP;
    case 'kpDownBig':
      return -KP_BIG_STEP;
    default:
      return 0;
  }
}

/** Intention `+`/`−` : touches principales (par `key`) et pavé numérique (par `code`). */
function kpIntentOf(code: string, key: string): KeyIntent {
  if (code === 'NumpadAdd' || key === '+' || key === '=') {
    return 'kpUp';
  }
  if (code === 'NumpadSubtract' || key === '-' || key === '−') {
    return 'kpDown';
  }
  if (code === 'PageUp') {
    return 'kpUpBig';
  }
  if (code === 'PageDown') {
    return 'kpDownBig';
  }
  return 'none';
}

/** Intention de « E / Entrée / Espace » selon la phase. */
function useIntentOf(phase: LevelPhase, repeat: boolean): KeyIntent {
  if (repeat) {
    return 'block';
  }
  if (phase === 'approach') {
    return 'interact';
  }
  if (phase === 'tuning') {
    return 'launch';
  }
  return 'block';
}

/**
 * Traduit une frappe en intention (fonction pure).
 * @param input champs de l'événement clavier et contexte.
 * @returns l'intention ; `none` laisse le comportement natif, toute autre valeur appelle
 * `preventDefault`.
 */
export function keyToIntent(input: KeyInput): KeyIntent {
  const { code, key, phase, focus } = input;
  if (input.ctrlKey || input.altKey || input.metaKey) {
    return 'none';
  }
  if (code === 'Escape') {
    if (input.helpOpen) {
      return 'closeHelp';
    }
    return phase === 'paused' ? 'resume' : 'pause';
  }
  if (focus === 'number') {
    return 'none';
  }
  const isUseKey =
    code === 'KeyE' || code === 'Enter' || code === 'NumpadEnter' || code === 'Space';
  if (isUseKey) {
    if (focus === 'button' && code !== 'KeyE') {
      return 'none';
    }
    return useIntentOf(phase, input.repeat);
  }
  const side = walkSideOf(code);
  if (side !== null) {
    if (focus === 'range' && code.startsWith('Arrow')) {
      return 'none';
    }
    return side === 'left' ? 'walkLeft' : 'walkRight';
  }
  const kp = kpIntentOf(code, key);
  if (kp !== 'none') {
    return kp;
  }
  if (code === 'KeyR') {
    return input.repeat ? 'block' : 'restart';
  }
  if (focus === 'none' && SCROLL_CODES.has(code)) {
    return 'block';
  }
  return 'none';
}
