/**
 * Machine d'application (spec T-017 §3.2) : écran courant `title`, `menu` ou `level`. Pure : ne
 * connaît que des identifiants de niveau, ni DOM, ni rendu, ni textes. Aucune commande ne lève
 * d'exception.
 */
import type { LevelEntry } from './levels';

/** Écran courant. */
export type ScreenId = 'title' | 'menu' | 'level';

/** État de l'application ; `levelId` est non nul si et seulement si `screen === 'level'`. */
export interface AppState {
  readonly screen: ScreenId;
  readonly levelId: string | null;
}

/** Résultat d'une commande. */
export type AppResult = 'ok' | 'ignored' | 'invalid';

/** Abonné : appelé après chaque changement d'état, avec l'écran précédent. */
export type AppListener = (state: Readonly<AppState>, previous: ScreenId) => void;

/** Machine d'application. */
export interface AppMachine {
  /** État courant (objet remplacé à chaque transition). */
  readonly state: Readonly<AppState>;
  /** Titre vers menu. */
  play(): AppResult;
  /** Menu vers niveau ; `invalid` si l'identifiant est inconnu ou non jouable. */
  openLevel(id: string): AppResult;
  /** Menu vers titre ; ignoré ailleurs. */
  back(): AppResult;
  /** Niveau vers menu. */
  leaveLevel(): AppResult;
  /** S'abonne aux changements ; renvoie la fonction de désabonnement. */
  subscribe(listener: AppListener): () => void;
}

/**
 * Crée la machine, au départ sur l'écran titre.
 * @param levels catalogue des niveaux.
 */
export function createAppMachine(levels: readonly LevelEntry[]): AppMachine {
  let state: Readonly<AppState> = { screen: 'title', levelId: null };
  const listeners: AppListener[] = [];
  // Transitions demandées pendant une notification : exécutées après elle, dans l'ordre.
  const pending: Array<() => void> = [];
  let notifying = false;

  const notify = (previous: ScreenId): void => {
    notifying = true;
    try {
      for (const listener of listeners.slice()) {
        listener(state, previous);
      }
    } finally {
      notifying = false;
    }
    const next = pending.shift();
    next?.();
  };

  const move = (next: Readonly<AppState>): void => {
    const previous = state.screen;
    state = next;
    notify(previous);
  };

  /** Exécute `command` tout de suite, ou après la notification en cours. */
  const submit = (from: ScreenId, command: () => AppResult): AppResult => {
    if (notifying) {
      pending.push(command);
      return 'ok';
    }
    return state.screen === from ? command() : 'ignored';
  };

  return {
    get state(): Readonly<AppState> {
      return state;
    },
    play(): AppResult {
      return submit('title', () => {
        if (state.screen !== 'title') {
          return 'ignored';
        }
        move({ screen: 'menu', levelId: null });
        return 'ok';
      });
    },
    openLevel(id: string): AppResult {
      return submit('menu', () => {
        if (state.screen !== 'menu') {
          return 'ignored';
        }
        const entry = levels.find((level) => level.id === id);
        if (entry === undefined || !entry.playable) {
          return 'invalid';
        }
        move({ screen: 'level', levelId: entry.id });
        return 'ok';
      });
    },
    back(): AppResult {
      return submit('menu', () => {
        if (state.screen !== 'menu') {
          return 'ignored';
        }
        move({ screen: 'title', levelId: null });
        return 'ok';
      });
    },
    leaveLevel(): AppResult {
      return submit('level', () => {
        if (state.screen !== 'level') {
          return 'ignored';
        }
        move({ screen: 'menu', levelId: null });
        return 'ok';
      });
    },
    subscribe(listener: AppListener): () => void {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    },
  };
}
