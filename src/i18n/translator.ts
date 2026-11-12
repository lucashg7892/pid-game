/**
 * Traducteur avec langue courante et abonnés (spec T-001 §8 : bouton de bascule, `<html lang>`
 * mis à jour par l'abonné du point de composition).
 */
import { CATALOGS, isLocale, type Catalog, type Locale, type MessageKey } from './catalogs';
import { formatNumber, formatQuantity, type NumberFormatOptions, type Unit } from './format';
import { I18nError, interpolate } from './interpolate';
import type { MessageParams, ParameterizedKey, PlainKey } from './params';

/** Fonction appelée après un changement de langue effectif. */
export type LocaleListener = (locale: Locale, previous: Locale) => void;

/** Traducteur lié à une langue courante modifiable. */
export interface Translator {
  /** Langue courante. */
  readonly locale: Locale;
  /**
   * Texte d'une clé sans paramètre dans la langue courante. Une clé inconnue est refusée à la
   * compilation et, à l'exécution (appel non typé), lève I18nError.
   */
  t(key: PlainKey): string;
  /**
   * Texte d'une clé à paramètres dans la langue courante, chaque `{nom}` remplacé. Paramètre
   * manquant ou en trop : refusé à la compilation et, à l'exécution, I18nError.
   */
  t<K extends ParameterizedKey>(key: K, params: MessageParams<K>): string;
  /**
   * Change la langue. Notifie chaque abonné une fois, seulement si la langue change.
   * @returns vrai si la langue a changé.
   * @throws RangeError si la langue n'est pas prise en charge (appel non typé).
   * @throws AggregateError si un ou plusieurs abonnés ont levé une exception (tous les abonnés
   *   sont appelés quand même, et la langue reste changée).
   */
  setLocale(locale: Locale): boolean;
  /**
   * Abonne une fonction aux changements de langue (une même fonction n'est inscrite qu'une
   * fois). Un abonnement ou désabonnement pendant une notification prend effet à la suivante.
   * @returns fonction de désabonnement, sans effet si appelée plusieurs fois.
   */
  subscribe(listener: LocaleListener): () => void;
  /** {@link formatNumber} dans la langue courante. */
  formatNumber(value: number, options?: NumberFormatOptions): string;
  /** {@link formatQuantity} dans la langue courante. */
  formatQuantity(value: number, unit: Unit, options?: NumberFormatOptions): string;
}

/**
 * Crée un traducteur.
 * @param initial langue initiale (voir `detectLocale`).
 * @param catalogs catalogues ; défaut : les locales du jeu (paramètre destiné aux tests).
 * @throws RangeError si `initial` n'est pas prise en charge.
 */
export function createTranslator(
  initial: Locale,
  catalogs: Readonly<Record<Locale, Catalog>> = CATALOGS,
): Translator {
  assertLocale(initial);
  let current: Locale = initial;
  const listeners = new Set<LocaleListener>();

  return {
    get locale(): Locale {
      return current;
    },
    t(key: MessageKey, params?: Readonly<Record<string, string>>): string {
      const catalog = catalogs[current];
      if (!Object.hasOwn(catalog, key)) {
        throw new I18nError(`clé inconnue « ${key} » (langue ${current})`);
      }
      return interpolate(catalog[key], params, key);
    },
    setLocale(locale: Locale): boolean {
      assertLocale(locale);
      if (locale === current) {
        return false;
      }
      const previous = current;
      current = locale;
      const errors: unknown[] = [];
      for (const listener of [...listeners]) {
        try {
          listener(locale, previous);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) {
        throw new AggregateError(errors, `${String(errors.length)} abonné(s) en erreur`);
      }
      return true;
    },
    subscribe(listener: LocaleListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    formatNumber(value: number, options?: NumberFormatOptions): string {
      return formatNumber(current, value, options);
    },
    formatQuantity(value: number, unit: Unit, options?: NumberFormatOptions): string {
      return formatQuantity(current, value, unit, options);
    },
  };
}

function assertLocale(locale: string): void {
  if (!isLocale(locale)) {
    throw new RangeError(`langue non prise en charge : ${locale}`);
  }
}
