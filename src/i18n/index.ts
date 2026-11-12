/** Internationalisation FR/EN (spec T-001 §8). Pur : ni DOM, ni dépendance externe. */

export {
  CATALOGS,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLocale,
  isMessageKey,
  matchLocale,
  otherLocale,
  type Catalog,
  type Locale,
  type MessageKey,
} from './catalogs';
export {
  MESSAGE_PARAMS,
  type MessageParams,
  type ParamName,
  type ParameterizedKey,
  type PlainKey,
} from './params';
export {
  I18nError,
  interpolate,
  parseTemplate,
  placeholdersOf,
  type TemplatePart,
} from './interpolate';
export {
  NBSP,
  NNBSP,
  formatNumber,
  formatQuantity,
  type NumberFormatOptions,
  type Unit,
} from './format';
export { detectLocale } from './detect';
export { createTranslator, type LocaleListener, type Translator } from './translator';
