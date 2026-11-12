import type { TripOutcome } from './outcome';

/**
 * Type d'un événement discret destiné à l'UI :
 * - `tuningOpened` / `tuningClosed` : panneau Kp ouvert / refermé à la console ;
 * - `launch` : départ d'un trajet (k = 0) ;
 * - `firstSaturation` : premier pas saturé du trajet (une fois par trajet au plus) ;
 * - `outcome` : fin du trajet, champ `outcome` renseigné ;
 * - `reset` : recommencer (cabine au sol, retour au réglage) ;
 * - `pause` / `resume` : mise en pause / reprise.
 */
export type GameEventType =
  | 'tuningOpened'
  | 'tuningClosed'
  | 'launch'
  | 'firstSaturation'
  | 'outcome'
  | 'reset'
  | 'pause'
  | 'resume';

/** Événement discret. Objet réutilisé : le copier pour le garder au-delà du visiteur. */
export interface GameEvent {
  /** Type de l'événement. */
  type: GameEventType;
  /** Nombre de pas exécutés dans le trajet courant au moment de l'événement (0 hors trajet). */
  k: number;
  /** Issue, pour un événement `outcome` ; `null` sinon. */
  outcome: TripOutcome | null;
  /** Numéro de l'essai en cours (≥ 1) au moment de l'événement. */
  attempt: number;
}

/** Capacité de la file d'événements ; au-delà, le plus ancien non consommé est perdu. */
export const EVENT_QUEUE_CAPACITY = 32;

/** File circulaire préallouée d'événements, consommés une seule fois. */
export interface EventQueue {
  /** Nombre d'événements en attente. */
  readonly length: number;
  /** Nombre d'événements perdus par débordement depuis la création. */
  readonly dropped: number;
  /** Ajoute un événement (sans allocation). */
  push(type: GameEventType, k: number, outcome: TripOutcome | null, attempt: number): void;
  /**
   * Retire les événements en attente, du plus ancien au plus récent, et passe chacun à
   * `visitor`. Un événement ajouté pendant la visite sera rendu au prochain appel.
   * @returns le nombre d'événements visités.
   */
  drain(visitor: (event: Readonly<GameEvent>) => void): number;
}

/**
 * Crée une file d'événements à {@link EVENT_QUEUE_CAPACITY} emplacements alloués une fois.
 * L'objet passé au visiteur est un emplacement réutilisé.
 */
export function createEventQueue(): EventQueue {
  const slots: GameEvent[] = [];
  for (let i = 0; i < EVENT_QUEUE_CAPACITY; i++) {
    slots.push({ type: 'reset', k: 0, outcome: null, attempt: 0 });
  }
  let head = 0;
  let length = 0;
  let dropped = 0;
  return {
    get length(): number {
      return length;
    },
    get dropped(): number {
      return dropped;
    },
    push(type: GameEventType, k: number, outcome: TripOutcome | null, attempt: number): void {
      if (length === EVENT_QUEUE_CAPACITY) {
        head = (head + 1) % EVENT_QUEUE_CAPACITY;
        length -= 1;
        dropped += 1;
      }
      const slot = slots[(head + length) % EVENT_QUEUE_CAPACITY] as GameEvent;
      slot.type = type;
      slot.k = k;
      slot.outcome = outcome;
      slot.attempt = attempt;
      length += 1;
    },
    drain(visitor: (event: Readonly<GameEvent>) => void): number {
      let count = length;
      const visited = count;
      while (count > 0) {
        const slot = slots[head] as GameEvent;
        head = (head + 1) % EVENT_QUEUE_CAPACITY;
        length -= 1;
        count -= 1;
        visitor(slot);
      }
      return visited;
    },
  };
}
