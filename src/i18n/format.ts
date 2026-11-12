/**
 * Formatage des nombres et des grandeurs physiques selon la langue (spec T-001 §8).
 *
 * Choix typographiques :
 * - séparateur décimal et de milliers fournis par `Intl.NumberFormat` (virgule en français,
 *   point en anglais) ; groupement `min2` : seuls les nombres d'au moins 5 chiffres entiers
 *   sont groupés (`5000`, mais `12 345` / `12,345`), selon l'usage SI et français ; en
 *   français, l'espace de groupement est celle d'ICU, U+202F (espace fine insécable) ;
 * - signe : `signDisplay: 'negative'`, donc `-0` et un négatif arrondi à zéro s'affichent `0` ;
 *   le signe moins est celui d'ICU (U+002D dans les deux langues avec Node 22) ;
 * - nombre et unité sont séparés par {@link NBSP} (U+00A0, espace insécable), sauf `%` en
 *   anglais, collé au nombre (`12%`) ; en français, `12 %` avec U+00A0.
 */
import type { Locale } from './catalogs';

/** Espace insécable U+00A0, entre un nombre et son unité, et avant « : » en français. */
export const NBSP = '\u00A0';

/** Espace fine insécable U+202F, avant « ; », « ! » et « ? » en français. */
export const NNBSP = '\u202F';

/** Unités affichées dans le jeu (symboles SI identiques en français et en anglais). */
export type Unit = 'm' | 'N' | 'N/m' | 's' | '%';

/** Nombre de décimales affichées. Défaut : minimum 0, maximum max(minimum, 2). */
export interface NumberFormatOptions {
  /** Décimales minimales (entier de 0 à 20). */
  readonly minimumFractionDigits?: number;
  /** Décimales maximales (entier de 0 à 20, ≥ minimum) ; arrondi au plus proche. */
  readonly maximumFractionDigits?: number;
}

const formatters = new Map<string, Intl.NumberFormat>();

function checkDigits(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 20) {
    throw new RangeError(`${label} doit être un entier de 0 à 20 (reçu ${String(value)})`);
  }
}

function formatterFor(locale: Locale, min: number, max: number): Intl.NumberFormat {
  const id = `${locale}|${String(min)}|${String(max)}`;
  let formatter = formatters.get(id);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: 'min2',
      signDisplay: 'negative',
    });
    formatters.set(id, formatter);
  }
  return formatter;
}

/**
 * Formate un nombre selon la langue : `formatNumber('fr', 0.2)` → `"0,2"`, `('en', 0.2)` →
 * `"0.2"`. Les formateurs `Intl` sont mis en cache.
 * @param locale langue d'affichage.
 * @param value nombre fini.
 * @param options décimales.
 * @throws RangeError si `value` n'est pas fini (NaN, ±Infinity : jamais montré au joueur) ou si
 *   les options sont invalides.
 */
export function formatNumber(
  locale: Locale,
  value: number,
  options: NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`nombre non fini : ${String(value)}`);
  }
  const min = options.minimumFractionDigits ?? 0;
  checkDigits(min, 'minimumFractionDigits');
  const max = options.maximumFractionDigits ?? Math.max(min, 2);
  checkDigits(max, 'maximumFractionDigits');
  if (max < min) {
    throw new RangeError(
      `maximumFractionDigits (${String(max)}) < minimumFractionDigits (${String(min)})`,
    );
  }
  return formatterFor(locale, min, max).format(value);
}

/**
 * Formate une grandeur avec son unité : `formatQuantity('fr', 0.196, 'm')` → `"0,2 m"` (U+00A0).
 * @param locale langue d'affichage.
 * @param value nombre fini, exprimé dans `unit`.
 * @param unit unité affichée ; pour `%`, `value` est déjà en pour cent (12.5 → `12,5 %`).
 * @param options décimales.
 * @throws RangeError comme {@link formatNumber}.
 */
export function formatQuantity(
  locale: Locale,
  value: number,
  unit: Unit,
  options: NumberFormatOptions = {},
): string {
  const separator = unit === '%' && locale === 'en' ? '' : NBSP;
  return `${formatNumber(locale, value, options)}${separator}${unit}`;
}
