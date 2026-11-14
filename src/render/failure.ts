/**
 * Garde-fou du rendu en cours de route : un seul signalement d'échec (perte de contexte GPU ou
 * exception inattendue), puis plus aucun appel gardé. Logique pure, sans three ni DOM.
 */

/** Nature d'un échec du rendu après son démarrage. */
export type RenderFailureKind = 'context-lost' | 'error';

/** Échec signalé au point de composition. */
export interface RenderFailure {
  /** Perte du contexte ou du périphérique GPU, ou exception inattendue. */
  readonly kind: RenderFailureKind;
  /** Message technique (pour la console, jamais affiché au joueur). */
  readonly detail: string;
}

/** Garde-fou renvoyé par {@link createFailureGuard}. */
export interface FailureGuard {
  /** Vrai dès le premier échec. */
  readonly failed: boolean;
  /** Signale un échec ; sans effet après le premier. */
  fail(kind: RenderFailureKind, detail: string): void;
  /**
   * Enveloppe `fn` : une exception devient un échec `error`, et plus rien n'est appelé après un
   * échec.
   */
  guard<Args extends unknown[]>(fn: (...args: Args) => void): (...args: Args) => void;
}

/** Message technique d'une valeur levée. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Crée un garde-fou.
 * @param onFailure appelé une seule fois, au premier échec.
 */
export function createFailureGuard(onFailure: (failure: RenderFailure) => void): FailureGuard {
  let failed = false;
  const fail = (kind: RenderFailureKind, detail: string): void => {
    if (failed) {
      return;
    }
    failed = true;
    onFailure({ kind, detail });
  };
  return {
    get failed(): boolean {
      return failed;
    },
    fail,
    guard<Args extends unknown[]>(fn: (...args: Args) => void): (...args: Args) => void {
      return (...args: Args): void => {
        if (failed) {
          return;
        }
        try {
          fn(...args);
        } catch (error: unknown) {
          fail('error', describeError(error));
        }
      };
    },
  };
}
