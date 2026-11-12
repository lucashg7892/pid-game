/**
 * Catalogues de textes FR/EN (spec T-001 §8). Le type des clés est dérivé du fichier français :
 * une clé absente de `fr.json` est une erreur de compilation partout où une {@link MessageKey}
 * est attendue, et `en.json` doit contenir au moins toutes les clés françaises.
 */
import en from './locales/en.json';
import fr from './locales/fr.json';

/**
 * Langues prises en charge. Ce sont des étiquettes BCP 47 valides, utilisables telles quelles
 * pour `<html lang>` et `Intl.NumberFormat`.
 */
export const SUPPORTED_LOCALES = ['fr', 'en'] as const;

/** Langue prise en charge : `'fr'` ou `'en'`. */
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Langue de repli quand ni l'URL ni le navigateur ne désignent une langue prise en charge. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Clé de texte, dérivée de `locales/fr.json` (clés plates, segments séparés par des points). */
export type MessageKey = keyof typeof fr;

/** Catalogue complet d'une langue : un texte par clé. */
export type Catalog = Readonly<Record<MessageKey, string>>;

/** Catalogue anglais, typé contre le français : une clé manquante en anglais ne compile pas. */
const EN_CATALOG: Catalog = en;

/** Catalogues de toutes les langues prises en charge. */
export const CATALOGS: Readonly<Record<Locale, Catalog>> = { fr, en: EN_CATALOG };

/**
 * Indique si une chaîne quelconque est une langue prise en charge (comparaison exacte, sensible
 * à la casse : utiliser {@link matchLocale} pour une étiquette venant de l'extérieur).
 * @param value chaîne à tester.
 */
export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Indique si une chaîne quelconque est une clé du catalogue de référence (français).
 * @param value chaîne à tester.
 */
export function isMessageKey(value: string): value is MessageKey {
  return Object.hasOwn(fr, value);
}

/**
 * Renvoie l'autre langue (pour le bouton de bascule FR ⇄ EN).
 * @param locale langue courante.
 */
export function otherLocale(locale: Locale): Locale {
  return locale === 'fr' ? 'en' : 'fr';
}

/**
 * Associe une étiquette de langue (BCP 47, casse et séparateur `-`/`_` libres) à une langue prise
 * en charge en comparant sa sous-étiquette principale : `fr-CA` → `fr`, `EN_us` → `en`.
 * La comparaison porte sur le segment entier, pas sur un simple préfixe de caractères : `frr`
 * (frison septentrional) n'est pas du français.
 * @param tag étiquette à analyser.
 * @returns la langue reconnue, ou `undefined`.
 */
export function matchLocale(tag: string): Locale | undefined {
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return isLocale(primary) ? primary : undefined;
}
