/** Outils partagés des tests de `src/game` (pas un fichier de test). */
import {
  createLevel1,
  quantizeKp,
  type Level1,
  type Level1Options,
  type TripOutcome,
} from '../../src/game';

/** Résultat copié d'un trajet complet. */
export interface TripResult {
  outcome: TripOutcome | null;
  outcomeK: number | null;
  finalError: number | null;
  saturatedSteps: number;
  /** y(k·dt) pour k = 0 … outcomeK − 1 (enregistreur), copié. */
  trace: Float64Array;
  /** Hauteur de la cabine au pas de l'issue (état après le pas), copiée. */
  finalY: number;
}

/** Générateur pseudo-aléatoire à graine explicite (mulberry32), pour des images irrégulières. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Amène le bonhomme à la console (marche à droite) et ouvre le réglage. */
export function reachConsole(level: Level1, frame: () => number = () => 1 / 60): void {
  level.moveRight();
  for (let i = 0; i < 100000 && !level.snapshot.atConsole; i++) level.update(frame());
  if (!level.snapshot.atConsole) throw new Error('console jamais atteinte');
  if (level.interact() !== 'accepted') throw new Error('interaction refusée');
}

/** Copie la trace y de l'enregistreur. */
export function copyTrace(level: Level1): Float64Array {
  const out = new Float64Array(level.signals.length);
  let i = 0;
  level.signals.forEach('y', (_t, v) => {
    out[i++] = v;
  });
  return out;
}

/** Joue le trajet déjà en phase `tuning` ou `trip` jusqu'à l'issue, images de durée `frame()`. */
export function finishTrip(level: Level1, frame: () => number = () => 1 / 30): TripResult {
  if (level.snapshot.phase === 'tuning') level.launch();
  for (let i = 0; i < 1_000_000 && level.snapshot.phase === 'trip'; i++) level.update(frame());
  const s = level.snapshot;
  return {
    outcome: s.outcome,
    outcomeK: s.outcomeK,
    finalError: s.finalError,
    saturatedSteps: s.saturatedSteps,
    trace: copyTrace(level),
    finalY: s.cabinY,
  };
}

/** Crée un niveau, règle Kp, va à la console et joue un trajet complet. */
export function runTrip(
  kp: number,
  frame: () => number = () => 1 / 30,
  options: Level1Options = {},
): TripResult & { level: Level1 } {
  // Kp sur la grille du curseur : chemin de l'UI (setKp). Hors grille (150) : initialKp.
  const onGrid = quantizeKp(kp) === kp;
  const level = createLevel1(onGrid ? options : { ...options, initialKp: kp });
  if (onGrid && level.setKp(kp) !== 'accepted') throw new Error(`Kp ${String(kp)} refusé`);
  if (level.snapshot.kp !== kp) throw new Error(`Kp ${String(kp)} non appliqué`);
  reachConsole(level, frame);
  return { ...finishTrip(level, frame), level };
}

/** Égalité bit à bit de deux traces. */
export function bitwiseEqual(a: Float64Array, b: Float64Array): boolean {
  if (a.length !== b.length) return false;
  const ua = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const ub = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  return ua.every((v, i) => v === ub[i]);
}
