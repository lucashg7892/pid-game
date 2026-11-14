/** Outils partagés des tests de `src/ui` (pas un fichier de test). */
import { createLevel1, type Level, type Level1, type LevelSnapshot } from '../../src/game';
import { createTranslator, type Locale, type Translator } from '../../src/i18n';

/** Durée d'une image des tests (s). */
export const FRAME = 1 / 60;

/** Avance le niveau de `seconds` par images de 1/60 s. */
export function advance(level: Level, seconds: number): void {
  const frames = Math.round(seconds / FRAME);
  for (let i = 0; i < frames; i += 1) level.update(FRAME);
}

/** Niveau en approche, bonhomme à la console (panneau fermé). */
export function atConsole(): Level1 {
  const level = createLevel1();
  level.moveRight();
  for (let i = 0; i < 10_000 && !level.snapshot.atConsole; i += 1) level.update(FRAME);
  level.stop();
  if (!level.snapshot.atConsole) throw new Error('console jamais atteinte');
  return level;
}

/** Niveau en réglage (panneau ouvert) avec le Kp donné. */
export function tuning(kp = 1000): Level1 {
  const level = atConsole();
  if (level.interact() !== 'accepted') throw new Error('interaction refusée');
  if (level.setKp(kp) !== 'accepted') throw new Error('Kp refusé');
  return level;
}

/** Niveau après un trajet complet au Kp donné (phase `outcome`). */
export function finished(kp: number): Level1 {
  const level = tuning(kp);
  level.launch();
  for (let i = 0; i < 2000 && level.snapshot.phase === 'trip'; i += 1) level.update(1 / 30);
  if (level.snapshot.phase !== 'outcome') throw new Error('trajet non terminé');
  return level;
}

/** Copie modifiable d'un instantané. */
export function copy(
  s: Readonly<LevelSnapshot>,
  patch: Partial<LevelSnapshot> = {},
): LevelSnapshot {
  return { ...s, ...patch };
}

/** Traducteur dans une langue. */
export function tr(locale: Locale): Translator {
  return createTranslator(locale);
}

/** Espace insécable U+00A0. */
export const NB = '\u00A0';
/** Espace fine insécable U+202F. */
export const NNB = '\u202F';
