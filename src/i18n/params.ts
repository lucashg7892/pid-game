/**
 * Paramètres d'interpolation attendus par clé. Cette table est la source du typage des appels
 * `t(clé, paramètres)` ; un test vérifie qu'elle correspond exactement aux `{…}` présents dans
 * les deux catalogues.
 */
import type { MessageKey } from './catalogs';

/** Noms des paramètres `{nom}` de chaque clé qui en a ; une clé absente n'en a aucun. */
export const MESSAGE_PARAMS = {
  'app.error.details': ['message'],
  'level1.kp.valueText': ['kp'],
  'level2.kp.fixed': ['kp'],
  'level2.ki.valueText': ['ki'],
  'level2.fail.step': ['e'],
  'level1.fail.step': ['e'],
  'level1.dimension': ['e'],
  'level1.formula': ['kp', 'e'],
  'hud.kp.value': ['kp'],
  'hud.ki.tag': ['kp', 'ki'],
  'hud.hint.item': ['keys', 'action'],
  'hud.gauge.max': ['n'],
  'hud.igauge.value': ['i'],
  'hud.readout.iTerm': ['i'],
  'hud.error.value': ['e'],
  'hud.time.value': ['t'],
  'hud.status.launch': ['kp'],
  'hud.status.launchKi': ['kp', 'ki'],
  'hud.status.win': ['e'],
  'hud.status.winKi': ['e'],
  'hud.status.fail.noLift': ['kp'],
  'hud.status.fail.step': ['e'],
  'hud.status.fail.stepKi': ['e'],
  'a11y.sceneState': ['y', 'r', 'e'],
  'board.motion.values': ['m', 'g', 'c'],
  'board.error.where': ['r'],
  'board.sat.intro': ['umax'],
  'board.value.ki': ['ki'],
  'pupitre.annonce.issueSature': ['reglage'],
  'pupitre.annonce.issueLibre': ['reglage'],
  'pupitre.machine.cabine': ['y'],
  'pupitre.machine.resume': ['etat', 'y', 'appliquee', 'demandee'],
  'pupitre.courbes.temps': ['t'],
  'pupitre.courbes.curseur.valeur': ['t', 'e', 'appliquee', 'v', 'a'],
  'pupitre.courbes.resume': ['t', 'e', 'appliquee', 'demandee', 'v', 'a'],
  'pupitre.courbes.resumePi': ['p', 'i'],
} as const satisfies Partial<Record<MessageKey, readonly string[]>>;

/** Clés qui attendent des paramètres. */
export type ParameterizedKey = keyof typeof MESSAGE_PARAMS;

/** Noms des paramètres de la clé `K` (`never` si elle n'en a pas). */
export type ParamName<K extends MessageKey> = K extends ParameterizedKey
  ? (typeof MESSAGE_PARAMS)[K][number]
  : never;

/**
 * Paramètres d'une clé : objet dont chaque valeur est une chaîne déjà formatée (nombre passé par
 * `formatNumber`, pour respecter la virgule décimale du français).
 */
export type MessageParams<K extends MessageKey> = Readonly<Record<ParamName<K>, string>>;

/** Clés sans paramètre. */
export type PlainKey = Exclude<MessageKey, ParameterizedKey>;
