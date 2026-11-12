import type { LoopSample, SignalName, SignalRecorder } from './types';

/** Nombre de valeurs stockées par échantillon : t, r, y, e, uSat. */
export const SIGNAL_STRIDE = 5;

/** Décalage de chaque grandeur dans un échantillon du tampon (t est au décalage 0). */
const OFFSET: Readonly<Record<SignalName, number>> = { r: 1, y: 2, e: 3, uSat: 4 };

/** Enregistreur circulaire dont le tampon préalloué est exposé en lecture. */
export interface CircularSignalRecorder extends SignalRecorder {
  /**
   * Tampon unique, alloué à la création et jamais réalloué : `capacity × SIGNAL_STRIDE` valeurs,
   * échantillon i (emplacement physique, pas chronologique) = [t (s), r (m), y (m), e (m),
   * uSat (N)].
   */
  readonly buffer: Float64Array;
  /** Vide l'enregistreur (length = 0) sans réallouer. */
  clear(): void;
}

/**
 * Crée un enregistreur de signaux à tampon circulaire préalloué (Float64Array).
 * À capacité atteinte, chaque `push` écrase l'échantillon le plus ancien (spec T-001 §4 :
 * « tampon circulaire ») ; `length` reste alors égal à `capacity`. `push` et `forEach`
 * n'allouent rien. `forEach` lève RangeError si le nom de signal est inconnu (appel non typé,
 * depuis du JavaScript par exemple), avant tout appel de `fn`.
 * @param capacity nombre d'échantillons conservés, entier ≥ 1.
 * @throws RangeError si `capacity` est invalide.
 */
export function createSignalRecorder(capacity: number): CircularSignalRecorder {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`capacity doit être un entier ≥ 1 (reçu ${String(capacity)})`);
  }
  const buffer = new Float64Array(capacity * SIGNAL_STRIDE);
  /** Emplacement du prochain échantillon écrit. */
  let head = 0;
  let length = 0;

  return {
    capacity,
    buffer,
    get length(): number {
      return length;
    },
    push(s: LoopSample): void {
      const base = head * SIGNAL_STRIDE;
      buffer[base] = s.t;
      buffer[base + 1] = s.r;
      buffer[base + 2] = s.y;
      buffer[base + 3] = s.e;
      buffer[base + 4] = s.uSat;
      head = head + 1 === capacity ? 0 : head + 1;
      if (length < capacity) length++;
    },
    forEach(name: SignalName, fn: (t: number, v: number) => void): void {
      if (!Object.hasOwn(OFFSET, name)) {
        throw new RangeError(`signal inconnu : « ${name} » (attendu r, y, e ou uSat)`);
      }
      const offset = OFFSET[name];
      let slot = head - length;
      if (slot < 0) slot += capacity;
      for (let n = 0; n < length; n++) {
        const base = slot * SIGNAL_STRIDE;
        fn(buffer[base] as number, buffer[base + offset] as number);
        slot = slot + 1 === capacity ? 0 : slot + 1;
      }
    },
    clear(): void {
      head = 0;
      length = 0;
    },
  };
}
