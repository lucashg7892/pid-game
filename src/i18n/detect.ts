/**
 * Choix de la langue initiale (spec T-001 §8) : paramètre d'URL `?lang=`, puis langues préférées
 * du navigateur, puis anglais. Fonction pure : l'appelant (point de composition) lui passe
 * `location.search` et `navigator.languages`.
 */
import { DEFAULT_LOCALE, matchLocale, type Locale } from './catalogs';

/**
 * Détermine la langue initiale.
 * 1. `?lang=` : premier paramètre `lang` de la chaîne de requête, casse et région ignorées
 *    (`?lang=FR`, `?lang=fr-BE` → `fr`) ; une valeur non prise en charge ou vide est ignorée.
 * 2. Sinon, première langue de `preferred` dont la sous-étiquette principale est prise en
 *    charge (`['fr-CA', 'en']` → `fr`, `['de', 'fr']` → `fr`).
 * 3. Sinon {@link DEFAULT_LOCALE} (`en`).
 * @param search chaîne de requête, avec ou sans `?` initial (p. ex. `location.search`).
 * @param preferred langues préférées par ordre décroissant (p. ex. `navigator.languages`).
 */
export function detectLocale(search: string, preferred: readonly string[]): Locale {
  const fromUrl = new URLSearchParams(search).get('lang');
  const urlLocale = fromUrl === null ? undefined : matchLocale(fromUrl);
  if (urlLocale !== undefined) {
    return urlLocale;
  }
  for (const tag of preferred) {
    const locale = matchLocale(tag);
    if (locale !== undefined) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}
