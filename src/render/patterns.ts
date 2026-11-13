/**
 * Motifs de remplissage et de trait (T-009) : hachures d'un polygone et pointillés. Fonctions
 * pures, sans three ni allocation : les résultats sont écrits dans des tableaux fournis par
 * l'appelant (segments x0, y0, x1, y1 entrelacés).
 */

/** Valeurs par segment dans les tableaux de sortie (x0, y0, x1, y1). */
export const SEGMENT_STRIDE = 4;

/**
 * Hachures parallèles d'un polygone, règle pair-impair (un polygone qui se recoupe, comme la zone
 * entre une courbe et une droite qu'elle traverse, est rempli correctement). Les droites de
 * hachure sont ancrées dans le repère monde : celle d'indice k passe à la distance
 * `phase + k × spacing` de l'origine, mesurée selon la normale à la direction des hachures.
 *
 * @param poly sommets du polygone (x0, y0, x1, y1…), fermé implicitement.
 * @param vertexCount nombre de sommets (≥ 3, sinon aucune hachure).
 * @param angle direction des hachures (rad, depuis l'axe x).
 * @param spacing pas entre deux hachures (m, > 0).
 * @param phase décalage des hachures (m).
 * @param out segments produits ; s'arrête quand il est plein.
 * @param scratch tableau de travail (intersections d'une droite), sa taille borne le nombre
 *   d'intersections retenues par droite.
 * @returns nombre de segments écrits.
 */
export function hatchPolygon(
  poly: ArrayLike<number>,
  vertexCount: number,
  angle: number,
  spacing: number,
  phase: number,
  out: Float64Array,
  scratch: Float64Array,
): number {
  if (vertexCount < 3 || !(spacing > 0)) {
    return 0;
  }
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // Normale à la direction des hachures.
  const nx = -dy;
  const ny = dx;
  let qMin = Infinity;
  let qMax = -Infinity;
  for (let i = 0; i < vertexCount; i += 1) {
    const q = (poly[2 * i] as number) * nx + (poly[2 * i + 1] as number) * ny;
    if (q < qMin) qMin = q;
    if (q > qMax) qMax = q;
  }
  if (!Number.isFinite(qMin) || !Number.isFinite(qMax) || !Number.isFinite(phase)) {
    return 0;
  }
  const maxSegments = Math.floor(out.length / SEGMENT_STRIDE);
  let segments = 0;
  const firstK = Math.ceil((qMin - phase) / spacing);
  for (let k = firstK; ; k += 1) {
    const q = phase + k * spacing;
    if (q >= qMax) {
      break;
    }
    if (q <= qMin) {
      continue;
    }
    // Intersections de la droite {p · n = q} avec les arêtes, abscisses u = p · d triées.
    let hits = 0;
    for (let i = 0; i < vertexCount; i += 1) {
      const j = i + 1 === vertexCount ? 0 : i + 1;
      const x0 = poly[2 * i] as number;
      const y0 = poly[2 * i + 1] as number;
      const x1 = poly[2 * j] as number;
      const y1 = poly[2 * j + 1] as number;
      const q0 = x0 * nx + y0 * ny;
      const q1 = x1 * nx + y1 * ny;
      // Demi-ouvert : un sommet sur la droite n'est compté qu'une fois.
      if ((q0 <= q && q < q1) || (q1 <= q && q < q0)) {
        const t = (q - q0) / (q1 - q0);
        const u = (x0 + (x1 - x0) * t) * dx + (y0 + (y1 - y0) * t) * dy;
        if (hits < scratch.length) {
          // Tri par insertion (peu d'intersections par droite).
          let slot = hits;
          while (slot > 0 && (scratch[slot - 1] as number) > u) {
            scratch[slot] = scratch[slot - 1] as number;
            slot -= 1;
          }
          scratch[slot] = u;
          hits += 1;
        }
      }
    }
    for (let h = 0; h + 1 < hits; h += 2) {
      if (segments >= maxSegments) {
        return segments;
      }
      const u0 = scratch[h] as number;
      const u1 = scratch[h + 1] as number;
      const base = segments * SEGMENT_STRIDE;
      out[base] = u0 * dx + q * nx;
      out[base + 1] = u0 * dy + q * ny;
      out[base + 2] = u1 * dx + q * nx;
      out[base + 3] = u1 * dy + q * ny;
      segments += 1;
    }
  }
  return segments;
}

/**
 * Découpe un segment en tirets : tirets de longueur `dash` séparés de `gap`, en partant du point
 * de départ ; le dernier tiret est tronqué au point d'arrivée.
 * @param x0 abscisse de départ (m).
 * @param y0 ordonnée de départ (m).
 * @param x1 abscisse d'arrivée (m).
 * @param y1 ordonnée d'arrivée (m).
 * @param dash longueur d'un tiret (m, > 0).
 * @param gap longueur d'un vide (m, ≥ 0).
 * @param out tirets produits ; s'arrête quand il est plein.
 * @returns nombre de tirets écrits.
 */
export function dashLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dash: number,
  gap: number,
  out: Float64Array,
): number {
  const length = Math.hypot(x1 - x0, y1 - y0);
  if (!(length > 0) || !(dash > 0) || !(gap >= 0)) {
    return 0;
  }
  const ux = (x1 - x0) / length;
  const uy = (y1 - y0) / length;
  const maxSegments = Math.floor(out.length / SEGMENT_STRIDE);
  let count = 0;
  for (let s = 0; s < length && count < maxSegments; s += dash + gap) {
    const e = Math.min(s + dash, length);
    const base = count * SEGMENT_STRIDE;
    out[base] = x0 + ux * s;
    out[base + 1] = y0 + uy * s;
    out[base + 2] = x0 + ux * e;
    out[base + 3] = y0 + uy * e;
    count += 1;
  }
  return count;
}
