/**
 * Tremblé à graine du trait de crayon (T-009). Fonctions pures et déterministes : même graine,
 * même résultat, sur toute machine (arithmétique entière 32 bits par `Math.imul`). Aucun aléa.
 */

/**
 * Hachage entier → réel dans [0, 1). Déterministe ; `seed` et `index` sont ramenés à des entiers
 * 32 bits.
 * @param seed graine.
 * @param index indice (cellule, numéro de trait…).
 */
export function hash01(seed: number, index: number): number {
  let h = Math.imul((seed | 0) ^ 0x2545f491, 0x9e3779b1) ^ Math.imul(index | 0, 0x85ebca6b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Bruit de valeur 1D lissé, borné dans [−1, 1] : interpolation `smoothstep` entre valeurs hachées
 * aux entiers. Continu en `x`.
 * @param seed graine.
 * @param x abscisse (sans unité ; diviser par la longueur d'onde voulue).
 */
export function valueNoise(seed: number, x: number): number {
  const cell = Math.floor(x);
  const f = x - cell;
  const a = hash01(seed, cell) * 2 - 1;
  const b = hash01(seed, cell + 1) * 2 - 1;
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

/**
 * Combine deux graines en une graine 32 bits (ordre significatif).
 * @param a première graine.
 * @param b seconde graine.
 */
export function mixSeed(a: number, b: number): number {
  return (Math.imul(a | 0, 0x01000193) ^ Math.imul((b | 0) + 0x3c6ef372, 0x5bd1e995)) | 0;
}

/**
 * Graine du « boiling » à l'instant `seconds` : change `rateHz` fois par seconde et boucle sur
 * `count` valeurs. Avec `reducedMotion`, toujours 0 (dessin immobile).
 * @param seconds temps visuel écoulé (s).
 * @param rateHz changements par seconde.
 * @param count nombre de graines distinctes (entier ≥ 1).
 * @param reducedMotion préférence `prefers-reduced-motion`.
 */
export function boilSeed(
  seconds: number,
  rateHz: number,
  count: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || !Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.floor(seconds * rateHz) % count;
}
