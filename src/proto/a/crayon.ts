/**
 * Maquette A (lot B, v0.3, jetable) : primitives « au crayon » en canvas 2D. Traits légèrement
 * tremblés et dépassants, double passe de graphite, cercles ouverts, hachures découpées, vis et
 * plaques rivetées. Le tremblé vient d'un aléa À GRAINE : un même dessin redonne les mêmes traits.
 */

/** Encre des textes (contraste net sur le papier). */
export const ENCRE = '#2a2724';
/** Graphite des traits (charte crayon du jeu). */
export const GRAPHITE = '#3a3a3a';
/** Crayon rouge : réservé à la saturation et aux alertes. */
export const ROUGE = '#c23a2b';
/** Papier crème du jeu. */
export const PAPIER = '#f7f0de';
/** Papier plus clair des plaques et des rouleaux d'enregistreur. */
export const PAPIER_CLAIR = '#fbf8ee';
/** Bleu-vert pâle du millimétré (traits fins). */
export const GRILLE_FINE = '#86b9b2';
/** Bleu-vert du millimétré (traits du centimètre). */
export const GRILLE_FORTE = '#3d8580';
/** Police manuscrite auto-hébergée du jeu, avec replis. */
export const POLICE = '"Patrick Hand", "Segoe Print", "Bradley Hand", "Comic Sans MS", sans-serif';

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
  /** Amplitude du tremblé perpendiculaire (px). */
  readonly tremble: number;
  /** Dépassement maximal aux bouts (px). */
  readonly depasse: number;
  /** Seconde passe plus légère, décalée (aspect graphite repassé). */
  readonly repasse: boolean;
}

/** Trait appuyé (contours des plaques, carcasse). */
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
/** Trait fin (graduations, câblage, lignes de rappel). */
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
/** Crayon rouge (zones de saturation). */
export const MINE_ROUGE: Mine = {
  largeur: 1.4,
  alpha: 0.9,
  couleur: ROUGE,
  tremble: 0.6,
  depasse: 1.5,
  repasse: false,
};
/** Hachure au crayon rouge. */
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

/** Texte manuscrit. */
export function texte(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  taille: number,
  align: CanvasTextAlign = 'left',
  couleur = ENCRE,
): void {
  ctx.font = `${String(taille)}px ${POLICE}`;
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
  ctx.globalAlpha = 0.88;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  // biseau : bande hachurée à droite et en bas (relief)
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

/** Étiquette encadrée (petite plaque gravée). */
export function etiquette(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  taille: number,
  r: Alea,
  align: CanvasTextAlign = 'center',
): void {
  ctx.font = `${String(taille)}px ${POLICE}`;
  const w = ctx.measureText(s).width + 10;
  const h = taille + 6;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(x0, y - h + 4, w, h);
  rect(ctx, x0, y - h + 4, w, h, MINE_FINE, r);
  texte(ctx, s, x0 + w / 2, y, taille, 'center');
}

/**
 * Grain du graphite : gomme très légèrement le dessin avec un bruit (motif répété), pour que les
 * traits et les aplats aient l'irrégularité du papier.
 */
export function grain(
  ctx: CanvasRenderingContext2D,
  largeur: number,
  hauteur: number,
  force: number,
): void {
  const bruit = document.createElement('canvas');
  bruit.width = 128;
  bruit.height = 128;
  const b = bruit.getContext('2d');
  if (b === null) return;
  const img = b.createImageData(128, 128);
  const r = alea(7);
  for (let k = 0; k < img.data.length; k += 4) {
    img.data[k] = 0;
    img.data[k + 1] = 0;
    img.data[k + 2] = 0;
    img.data[k + 3] = Math.floor(255 * force * r() * r());
  }
  b.putImageData(img, 0, 0);
  const motif = ctx.createPattern(bruit, 'repeat');
  if (motif === null) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = motif;
  ctx.fillRect(0, 0, largeur, hauteur);
  ctx.restore();
}

/** Nombre à la française : virgule décimale, vrai signe moins. */
export function fr(v: number, decimales: number): string {
  const s = (Math.abs(v) < 0.5 * 10 ** -decimales ? 0 : v).toFixed(decimales);
  return s.replace('.', ',').replace('-', '−');
}

/** Nombre entier à la française avec espace fine des milliers (8 000). */
export function frEntier(v: number): string {
  const s = String(Math.round(Math.abs(v)));
  const groupes = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (v < 0 ? '−' : '') + groupes;
}
