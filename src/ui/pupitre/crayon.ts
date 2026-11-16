/**
 * Primitives « au crayon » du pupitre (T-049), en canvas 2D : traits légèrement tremblés et
 * dépassants, double passe de graphite, cercles ouverts, hachures découpées, vis, rivets et
 * plaques de pupitre. Le tremblé vient d'un aléa À GRAINE : un même dessin redonne exactement les
 * mêmes traits (rien ne « bout » d'une image à l'autre). Habillage repris de la maquette A du lot B
 * (v0.3), nettoyé ; aucun import de `src/proto`.
 *
 * Toutes les longueurs sont en unités du plan du pupitre (1 unité = 1 px CSS à l'échelle 1).
 */

/** Encre des textes (contraste ≈ 14:1 sur le papier). */
export const ENCRE = '#2a2724';
/** Texte secondaire (≈ 9:1). */
export const ENCRE_DOUCE = '#4a4540';
/** Graphite des traits (charte crayon du jeu). */
export const GRAPHITE = '#3a3a3a';
/** Crayon rouge : réservé à la saturation et aux alertes. */
export const ROUGE = '#c23a2b';
/** Rouge du texte (≈ 7:1). */
export const ROUGE_TEXTE = '#9a2a1c';
/** Papier crème du jeu. */
export const PAPIER = '#f7f0de';
/** Papier plus clair des plaques. */
export const PAPIER_CLAIR = '#fbf8ee';
/** Police manuscrite auto-hébergée du jeu (voir `ui.css`), avec replis. */
export const POLICE = '"Patrick Hand", "Segoe Print", "Bradley Hand", "Comic Sans MS", sans-serif';
/**
 * Police des valeurs chiffrées : chiffres tabulaires et virgule nettement distincte du point
 * (celle de Patrick Hand se lit presque comme un point à petite taille, constat du lot B).
 */
export const POLICE_NOMBRES = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Générateur pseudo-aléatoire dans [0, 1[. */
export type Alea = () => number;

/** Aléa à graine (mulberry32) : le dessin au crayon est reproductible. */
export function alea(graine: number): Alea {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mine de crayon : épaisseur, encre, tremblé, dépassement aux extrémités. */
export interface Mine {
  readonly largeur: number;
  readonly alpha: number;
  readonly couleur: string;
  /** Amplitude du tremblé perpendiculaire. */
  readonly tremble: number;
  /** Dépassement maximal aux bouts. */
  readonly depasse: number;
  /** Seconde passe plus légère, décalée (aspect graphite repassé). */
  readonly repasse: boolean;
}

/** Trait appuyé (contours des plaques). */
export const MINE_FORTE: Mine = {
  largeur: 2.1,
  alpha: 0.92,
  couleur: GRAPHITE,
  tremble: 0.9,
  depasse: 3,
  repasse: true,
};
/** Trait ordinaire. */
export const MINE: Mine = {
  largeur: 1.4,
  alpha: 0.88,
  couleur: GRAPHITE,
  tremble: 0.7,
  depasse: 2,
  repasse: true,
};
/** Trait fin (graduations, lignes de rappel). */
export const MINE_FINE: Mine = {
  largeur: 0.9,
  alpha: 0.8,
  couleur: GRAPHITE,
  tremble: 0.45,
  depasse: 1,
  repasse: false,
};
/** Hachure de remplissage. */
export const MINE_HACHURE: Mine = {
  largeur: 0.8,
  alpha: 0.45,
  couleur: GRAPHITE,
  tremble: 0.5,
  depasse: 1,
  repasse: false,
};
/** Crayon rouge (alertes). */
export const MINE_ROUGE: Mine = {
  largeur: 1.4,
  alpha: 0.9,
  couleur: ROUGE,
  tremble: 0.6,
  depasse: 1.5,
  repasse: false,
};

/** Hachure rouge de remplissage (zone hors limites, saturation). */
export const MINE_ROUGE_HACHURE: Mine = {
  largeur: 0.8,
  alpha: 0.5,
  couleur: ROUGE,
  tremble: 0.5,
  depasse: 1,
  repasse: false,
};

/** Dessine une polyligne tremblée (points à plat : x0, y0, x1, y1…). */
function passe(
  ctx: CanvasRenderingContext2D,
  pts: readonly number[],
  r: Alea,
  decalage: number,
): void {
  ctx.beginPath();
  const n = pts.length / 2;
  for (let k = 0; k < n; k++) {
    const x = (pts[2 * k] ?? 0) + decalage * (r() - 0.5);
    const y = (pts[2 * k + 1] ?? 0) + decalage * (r() - 0.5);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Points d'un segment tremblé, avec dépassement aux deux bouts. */
function pointsSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mine: Mine,
  r: Alea,
): number[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l = Math.hypot(dx, dy);
  const ux = dx / l;
  const uy = dy / l;
  const deb = (r() - 0.25) * mine.depasse;
  const fin = (r() - 0.25) * mine.depasse;
  const n = Math.max(2, Math.ceil(l / 16));
  const amp = mine.tremble * (r() * 2 - 1);
  const phase = r() * Math.PI * 2;
  const freq = 0.6 + r() * 1.4;
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const le = -deb + (l + deb + fin) * s;
    const off = amp * Math.sin(Math.PI * freq * s + phase) + mine.tremble * 0.3 * (r() - 0.5);
    pts.push(x1 + ux * le - uy * off, y1 + uy * le + ux * off);
  }
  return pts;
}

function tracer(ctx: CanvasRenderingContext2D, pts: readonly number[], mine: Mine, r: Alea): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = mine.couleur;
  ctx.globalAlpha = mine.alpha;
  ctx.lineWidth = mine.largeur * (0.9 + r() * 0.2);
  passe(ctx, pts, r, 0);
  if (mine.repasse) {
    ctx.globalAlpha = mine.alpha * 0.35;
    ctx.lineWidth = mine.largeur * 0.6;
    passe(ctx, pts, r, 1.1);
  }
  ctx.globalAlpha = 1;
}

/** Trait de crayon de (x1, y1) à (x2, y2). */
export function trait(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mine: Mine,
  r: Alea,
): void {
  if (Math.hypot(x2 - x1, y2 - y1) < 0.05) return;
  tracer(ctx, pointsSegment(x1, y1, x2, y2, mine, r), mine, r);
}

/** Polyligne de crayon (points à plat), fermée ou non. */
export function polyligne(
  ctx: CanvasRenderingContext2D,
  pts: readonly number[],
  mine: Mine,
  r: Alea,
  fermee = false,
): void {
  const n = pts.length / 2;
  const fin = fermee ? n : n - 1;
  for (let k = 0; k < fin; k++) {
    const j = (k + 1) % n;
    trait(ctx, pts[2 * k] ?? 0, pts[2 * k + 1] ?? 0, pts[2 * j] ?? 0, pts[2 * j + 1] ?? 0, mine, r);
  }
}

/** Rectangle au crayon (coins qui se croisent légèrement). */
export function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mine: Mine,
  r: Alea,
): void {
  polyligne(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], mine, r, true);
}

/** Arc de cercle au crayon, d'un angle a0 à a1 (rad, sens du canvas). */
export function arc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rayon: number,
  a0: number,
  a1: number,
  mine: Mine,
  r: Alea,
): void {
  const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * rayon) / 6));
  const amp = mine.tremble * 0.9;
  const ph = r() * 6.283;
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const rr = rayon + amp * Math.sin(a * 2 + ph) + mine.tremble * 0.25 * (r() - 0.5);
    pts.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  tracer(ctx, pts, mine, r);
}

/** Cercle au crayon, ouvert et un peu dépassant comme à main levée. */
export function cercle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rayon: number,
  mine: Mine,
  r: Alea,
): void {
  const a0 = r() * Math.PI * 2;
  const surplus = Math.min(0.5, 6 / Math.max(rayon, 1)) * (0.4 + r() * 0.6);
  arc(ctx, cx, cy, rayon, a0, a0 + Math.PI * 2 + surplus, mine, r);
}

/** Hachures parallèles dans la zone découpée par `zone` (qui trace un chemin). */
export function hachures(
  ctx: CanvasRenderingContext2D,
  zone: (c: CanvasRenderingContext2D) => void,
  boite: readonly [number, number, number, number],
  angle: number,
  pas: number,
  mine: Mine,
  r: Alea,
  regle: CanvasFillRule = 'nonzero',
): void {
  const [x, y, w, h] = boite;
  ctx.save();
  ctx.beginPath();
  zone(ctx);
  ctx.clip(regle);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const demi = Math.hypot(w, h) / 2 + 4;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  for (let d = -demi; d <= demi; d += pas) {
    const px = cx - uy * d;
    const py = cy + ux * d;
    trait(ctx, px - ux * demi, py - uy * demi, px + ux * demi, py + uy * demi, mine, r);
  }
  ctx.restore();
}

/** Hachures dans un rectangle. */
export function hachuresRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  pas: number,
  mine: Mine,
  r: Alea,
): void {
  hachures(
    ctx,
    (c) => {
      c.rect(x, y, w, h);
    },
    [x, y, w, h],
    angle,
    pas,
    mine,
    r,
  );
}

/**
 * Texte. `nombres` : police des valeurs chiffrées ({@link POLICE_NOMBRES}) au lieu de la manuscrite.
 */
export function texte(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  taille: number,
  align: CanvasTextAlign = 'left',
  couleur: string = ENCRE,
  nombres = false,
): void {
  ctx.font = `${String(taille)}px ${nombres ? POLICE_NOMBRES : POLICE}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = couleur;
  ctx.globalAlpha = 1;
  ctx.fillText(s, x, y);
}

/** Vis à tête fendue (fente d'angle aléatoire, ombre hachurée). */
export function vis(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rayon: number,
  r: Alea,
): void {
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.beginPath();
  ctx.arc(x, y, rayon, 0, Math.PI * 2);
  ctx.fill();
  cercle(ctx, x, y, rayon, MINE_FINE, r);
  const a = r() * Math.PI;
  const dx = Math.cos(a) * rayon * 0.8;
  const dy = Math.sin(a) * rayon * 0.8;
  trait(ctx, x - dx, y - dy, x + dx, y + dy, MINE, r);
  arc(ctx, x, y, rayon - 1, 0.2, 1.9, MINE_HACHURE, r);
}

/** Rivet : petit cercle et point. */
export function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r: Alea): void {
  cercle(ctx, x, y, 2.4, MINE_FINE, r);
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(x - 0.6, y - 0.6, 1.4, 1.4);
  ctx.globalAlpha = 1;
}

/** Plaque de pupitre : papier clair, double contour, biseau hachuré, vis aux coins. */
export function plaque(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: Alea,
  visCoins = true,
): void {
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  // Biseau : bande hachurée à droite et en bas (relief).
  hachures(
    ctx,
    (c) => {
      c.moveTo(x + w, y + 4);
      c.lineTo(x + w, y + h);
      c.lineTo(x + 4, y + h);
      c.lineTo(x + 8, y + h - 4);
      c.lineTo(x + w - 4, y + h - 4);
      c.lineTo(x + w - 4, y + 8);
      c.closePath();
    },
    [x, y, w, h],
    Math.PI / 4,
    3.2,
    MINE_HACHURE,
    r,
  );
  rect(ctx, x, y, w, h, MINE_FORTE, r);
  rect(ctx, x + 4, y + 4, w - 8, h - 8, MINE_FINE, r);
  if (visCoins) {
    vis(ctx, x + 10, y + 10, 3.6, r);
    vis(ctx, x + w - 10, y + 10, 3.6, r);
    vis(ctx, x + 10, y + h - 10, 3.6, r);
    vis(ctx, x + w - 10, y + h - 10, 3.6, r);
  }
}

/** Cadenas dessiné (anse, corps plein), centré sur (x, y). */
export function cadenas(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 5, 5.5, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x - 8, y - 5, 16, 12);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(x - 1.2, y - 1, 2.4, 5);
  ctx.restore();
}
