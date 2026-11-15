/**
 * Maquette B (jetable) : outils de dessin « au crayon » sur canvas 2D. Traits légèrement tremblés
 * (tremblé déterministe, graine par trait : rien ne « bout » d'une image à l'autre), grain de
 * graphite par motif, hachures, papier millimétré. Seules teintes : graphite et crayon rouge
 * (réservé à la saturation, comme dans la charte du jeu).
 */

/** Graphite (charte du jeu). */
export const GRAPHITE = '#3a3a3a';
/** Encre du texte (contraste ≈ 14:1 sur le papier). */
export const ENCRE = '#2a2724';
/** Texte secondaire (≈ 9:1). */
export const ENCRE_DOUCE = '#4a4540';
/** Crayon rouge : saturation seulement. */
export const ROUGE = '#c23a2b';
/** Rouge du texte (≈ 7:1). */
export const ROUGE_TEXTE = '#9a2a1c';
/** Papier crème. */
export const PAPIER = '#f7f0de';
/** Papier plus clair des cadrans et des courbes (feuille collée dans le cahier). */
export const PAPIER_CLAIR = '#fbf7ec';
/** Famille de la police manuscrite (chargée par `index.ts`), avec replis. */
export const POLICE =
  '"Patrick Hand B", "Patrick Hand", "Segoe Print", "Bradley Hand", "Comic Sans MS", sans-serif';

/** Générateur pseudo-aléatoire à graine (mulberry32), pour un tremblé reproductible. */
export function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pinceau d'un contexte : le contexte et ses deux motifs de grain. */
export interface Crayon {
  readonly ctx: CanvasRenderingContext2D;
  readonly graphite: CanvasPattern | string;
  readonly rouge: CanvasPattern | string;
}

function motifGrain(
  ctx: CanvasRenderingContext2D,
  rgb: readonly [number, number, number],
  graine: number,
): CanvasPattern | string {
  const repli = `rgb(${String(rgb[0])}, ${String(rgb[1])}, ${String(rgb[2])})`;
  const toile = document.createElement('canvas');
  toile.width = 64;
  toile.height = 64;
  const c = toile.getContext('2d');
  if (c === null) return repli;
  const image = c.createImageData(64, 64);
  const rnd = alea(graine);
  for (let k = 0; k < 64 * 64; k++) {
    const o = k * 4;
    image.data[o] = rgb[0];
    image.data[o + 1] = rgb[1];
    image.data[o + 2] = rgb[2];
    const r = rnd();
    image.data[o + 3] = Math.round(255 * (r < 0.08 ? 0.45 : 0.72 + 0.28 * rnd()));
  }
  c.putImageData(image, 0, 0);
  return ctx.createPattern(toile, 'repeat') ?? repli;
}

/** Crée le pinceau d'un contexte. */
export function creerCrayon(ctx: CanvasRenderingContext2D): Crayon {
  return {
    ctx,
    graphite: motifGrain(ctx, [58, 58, 58], 11),
    rouge: motifGrain(ctx, [194, 58, 43], 23),
  };
}

/** Style d'un trait (longueurs en px de la scène 1280×720). */
export interface StyleTrait {
  readonly largeur: number;
  /** Opacité dans [0 ; 1]. */
  readonly encre: number;
  /** Amplitude du tremblé perpendiculaire (px). */
  readonly tremble: number;
  readonly rouge?: boolean;
  readonly tirets?: readonly number[];
}

/** Trait appuyé (contours des instruments). */
export const APPUYE: StyleTrait = { largeur: 2.4, encre: 0.95, tremble: 0.7 };
/** Trait ordinaire (graduations principales). */
export const ORDINAIRE: StyleTrait = { largeur: 1.7, encre: 0.9, tremble: 0.45 };
/** Trait fin (graduations secondaires, repères). */
export const FIN: StyleTrait = { largeur: 1.1, encre: 0.8, tremble: 0.3 };
/** Hachure. */
export const HACHURE: StyleTrait = { largeur: 1, encre: 0.5, tremble: 0.4 };

/**
 * Trace une ligne brisée au crayon : deux passes (trait principal, puis un passage plus fin et
 * plus pâle légèrement décalé, comme un graphite repassé), tremblé lisse et déterministe.
 * @param pts coordonnées à plat x0, y0, x1, y1…
 */
export function trait(
  cr: Crayon,
  pts: readonly number[],
  s: StyleTrait,
  graine: number,
  ferme = false,
): void {
  const ctx = cr.ctx;
  const n = pts.length >> 1;
  if (n < 2) return;
  const rnd = alea(graine);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.rouge === true ? cr.rouge : cr.graphite;
  if (s.tirets !== undefined) ctx.setLineDash(s.tirets);
  const segments = ferme ? n : n - 1;
  for (let passe = 0; passe < 2; passe++) {
    const f1 = 0.025 + rnd() * 0.03;
    const f2 = 0.08 + rnd() * 0.05;
    const p1 = rnd() * 6.283;
    const p2 = rnd() * 6.283;
    const amp = s.tremble * (passe === 0 ? 1 : 1.5);
    const dx = passe === 0 ? 0 : 0.45;
    const dy = passe === 0 ? 0 : 0.35;
    ctx.globalAlpha = s.encre * (passe === 0 ? 1 : 0.4);
    ctx.lineWidth = s.largeur * (passe === 0 ? 1 : 0.55);
    ctx.beginPath();
    let u = 0;
    for (let k = 0; k < segments; k++) {
      const x0 = pts[2 * k] ?? 0;
      const y0 = pts[2 * k + 1] ?? 0;
      const suivant = (k + 1) % n;
      const x1 = pts[2 * suivant] ?? 0;
      const y1 = pts[2 * suivant + 1] ?? 0;
      const longueur = Math.hypot(x1 - x0, y1 - y0);
      const nx = longueur > 0 ? -(y1 - y0) / longueur : 0;
      const ny = longueur > 0 ? (x1 - x0) / longueur : 0;
      const m = Math.max(1, Math.ceil(longueur / 16));
      for (let j = k === 0 ? 0 : 1; j <= m; j++) {
        const f = j / m;
        const uu = u + f * longueur;
        const decalage = amp * (0.65 * Math.sin(uu * f1 + p1) + 0.35 * Math.sin(uu * f2 + p2));
        const x = x0 + (x1 - x0) * f + nx * decalage + dx;
        const y = y0 + (y1 - y0) * f + ny * decalage + dy;
        if (k === 0 && j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      u += longueur;
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Points d'un arc (angles en radians, sens du canvas : horaire à l'écran). */
export function pointsArc(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  pas = 0.06,
): number[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / pas));
  const pts: number[] = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
}

/** Cercle à main levée : léger dépassement au bout, rayon qui dérive d'un rien. */
export function cercle(
  cr: Crayon,
  cx: number,
  cy: number,
  r: number,
  s: StyleTrait,
  graine: number,
): void {
  const rnd = alea(graine);
  const depart = rnd() * 6.283;
  const derive = (rnd() - 0.5) * 1.6;
  const n = Math.max(24, Math.ceil(r / 2.5));
  const pts: number[] = [];
  const total = 6.283 + 0.22;
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    const a = depart + total * f;
    const rr = r + derive * f;
    pts.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  trait(cr, pts, s, graine + 1);
}

/** Rectangle à main levée (bords prolongés d'un rien aux coins). */
export function rectangle(
  cr: Crayon,
  x: number,
  y: number,
  l: number,
  h: number,
  s: StyleTrait,
  graine: number,
): void {
  const d = 3;
  trait(cr, [x - d, y, x + l + d * 0.5, y], s, graine);
  trait(cr, [x + l, y - d * 0.5, x + l, y + h + d], s, graine + 1);
  trait(cr, [x + l + d, y + h, x - d * 0.5, y + h], s, graine + 2);
  trait(cr, [x, y + h + d * 0.5, x, y - d], s, graine + 3);
}

/**
 * Hachures parallèles dans une zone (le chemin `zone` sert de masque).
 * @param angle angle des hachures (rad).
 * @param pas écart entre deux hachures (px).
 */
export function hachurer(
  cr: Crayon,
  zone: (ctx: CanvasRenderingContext2D) => void,
  boite: readonly [number, number, number, number],
  angle: number,
  pas: number,
  s: StyleTrait,
  graine: number,
): void {
  const ctx = cr.ctx;
  ctx.save();
  ctx.beginPath();
  zone(ctx);
  ctx.clip();
  const [x0, y0, x1, y1] = boite;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const demi = Math.hypot(x1 - x0, y1 - y0) / 2 + 4;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  let k = 0;
  for (let d = -demi; d <= demi; d += pas) {
    const px = cx - uy * d;
    const py = cy + ux * d;
    trait(cr, [px - ux * demi, py - uy * demi, px + ux * demi, py + uy * demi], s, graine + k);
    k++;
  }
  ctx.restore();
}

/** Police manuscrite à la taille donnée (px de scène). */
export function police(taille: number): string {
  return `${String(taille)}px ${POLICE}`;
}

/** Écrit un texte à la main. */
export function ecrire(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  taille: number,
  align: CanvasTextAlign = 'left',
  couleur = ENCRE,
): void {
  ctx.font = police(taille);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = couleur;
  ctx.globalAlpha = 1;
  ctx.fillText(texte, x, y);
}

/**
 * Papier millimétré en pixels de l'appareil (transformation remise à l'identité) : fond crème,
 * grain, traits fins, demi-centimètres et centimètres, calés sur l'origine de la scène.
 * @param ox abscisse de l'origine de la scène (px appareil).
 * @param k taille d'un px de scène en px appareil.
 */
export function dessinerPapier(
  ctx: CanvasRenderingContext2D,
  largeur: number,
  hauteur: number,
  ox: number,
  oy: number,
  k: number,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPIER;
  ctx.fillRect(0, 0, largeur, hauteur);
  // Grain du papier : petit motif de bruit répété.
  const grain = document.createElement('canvas');
  grain.width = 128;
  grain.height = 128;
  const g = grain.getContext('2d');
  if (g !== null) {
    const image = g.createImageData(128, 128);
    const rnd = alea(7);
    for (let i = 0; i < 128 * 128; i++) {
      const o = i * 4;
      const sombre = rnd() < 0.5;
      image.data[o] = sombre ? 90 : 255;
      image.data[o + 1] = sombre ? 80 : 255;
      image.data[o + 2] = sombre ? 60 : 250;
      image.data[o + 3] = Math.round(rnd() * 14);
    }
    g.putImageData(image, 0, 0);
    const motif = ctx.createPattern(grain, 'repeat');
    if (motif !== null) {
      ctx.fillStyle = motif;
      ctx.fillRect(0, 0, largeur, hauteur);
    }
  }
  const familles: readonly (readonly [number, string, number, number])[] = [
    [8, '#86b9b2', 0.28, 1],
    [40, '#5f9f99', 0.32, 1],
    [80, '#3d8580', 0.38, 1.4],
  ];
  for (const [pas, couleur, opacite, epaisseur] of familles) {
    const p = pas * k;
    if (p < 3) continue;
    ctx.strokeStyle = couleur;
    ctx.globalAlpha = opacite;
    ctx.lineWidth = Math.max(1, epaisseur * Math.min(k, 1.5));
    ctx.beginPath();
    const decalX = ((ox % p) + p) % p;
    const decalY = ((oy % p) + p) % p;
    for (let x = decalX; x <= largeur; x += p) {
      const xx = Math.round(x) + 0.5;
      ctx.moveTo(xx, 0);
      ctx.lineTo(xx, hauteur);
    }
    for (let y = decalY; y <= hauteur; y += p) {
      const yy = Math.round(y) + 0.5;
      ctx.moveTo(0, yy);
      ctx.lineTo(largeur, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
