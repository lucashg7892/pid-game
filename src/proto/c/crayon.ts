/**
 * Maquette C (jetable) : crayon sur un contexte 2D. Traits de graphite tremblés (deux passes,
 * dépassement aux bouts, grain du graphite par motif), cercles, arcs et hachures. Les valeurs de
 * couleur reprennent la charte crayon du jeu (`src/render/pencil-style.ts`) sans l'importer : la
 * maquette dessine en pixels CSS, le jeu en mètres monde.
 */

/** Graphite (même teinte que la charte du jeu). */
export const GRAPHITE = '#3a3a3a';
/** Encre du texte manuscrit (contraste ≈ 14:1 sur le papier). */
export const ENCRE_TEXTE = '#2a2724';
/** Crayon rouge : réservé à la saturation (charte du jeu). */
export const CRAYON_ROUGE = '#c23a2b';
/** Rouge du texte, plus sombre pour le contraste (≈ 7:1). */
export const TEXTE_ROUGE = '#9a2a1c';
/** Police manuscrite (déclarée par `styles.ts`, repli système). */
export const POLICE_MAIN =
  "'Patrick Hand C', 'Patrick Hand', 'Segoe Print', 'Comic Sans MS', cursive";

/** Générateur pseudo-aléatoire à graine (mulberry32) : le dessin est le même à chaque image. */
export type Alea = () => number;

export function creerAlea(graine: number): Alea {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Style d'un trait (pixels CSS). */
export interface StyleTrait {
  /** Épaisseur (px). */
  readonly largeur: number;
  /** Opacité de l'encre. */
  readonly encre: number;
  /** Amplitude du tremblé perpendiculaire (px). */
  readonly tremble: number;
  /** Crayon rouge au lieu du graphite. */
  readonly rouge?: boolean;
}

export const TRAIT_APPUYE: StyleTrait = { largeur: 2.6, encre: 1, tremble: 0.8 };
export const TRAIT_CONTOUR: StyleTrait = { largeur: 1.8, encre: 0.92, tremble: 0.9 };
export const TRAIT_FIN: StyleTrait = { largeur: 1.15, encre: 0.85, tremble: 0.5 };
export const TRAIT_HACHURE: StyleTrait = { largeur: 0.9, encre: 0.5, tremble: 0.45 };
export const TRAIT_HACHURE_DENSE: StyleTrait = { largeur: 1.1, encre: 0.85, tremble: 0.35 };
export const TRAIT_ROUGE: StyleTrait = { largeur: 2.2, encre: 0.95, tremble: 0.7, rouge: true };
export const HACHURE_ROUGE: StyleTrait = { largeur: 1.2, encre: 0.9, tremble: 0.35, rouge: true };

/** Motif de grain : la couleur du crayon, à opacité irrégulière, en tuile de 64 px. */
function motif(ctx: CanvasRenderingContext2D, couleur: string, alea: Alea): CanvasPattern | string {
  const tuile = document.createElement('canvas');
  tuile.width = 64;
  tuile.height = 64;
  const t = tuile.getContext('2d');
  if (t === null) return couleur;
  const r = parseInt(couleur.slice(1, 3), 16);
  const g = parseInt(couleur.slice(3, 5), 16);
  const b = parseInt(couleur.slice(5, 7), 16);
  const image = t.createImageData(64, 64);
  for (let k = 0; k < 64 * 64; k++) {
    image.data[k * 4] = r;
    image.data[k * 4 + 1] = g;
    image.data[k * 4 + 2] = b;
    image.data[k * 4 + 3] = Math.round(255 * (0.55 + 0.45 * alea()));
  }
  t.putImageData(image, 0, 0);
  return ctx.createPattern(tuile, 'repeat') ?? couleur;
}

/** Crayon lié à un contexte 2D (coordonnées en pixels CSS, transformation posée par l'appelant). */
export class Crayon {
  readonly ctx: CanvasRenderingContext2D;
  private alea: Alea;
  private readonly graphite: CanvasPattern | string;
  private readonly rouge: CanvasPattern | string;

  constructor(ctx: CanvasRenderingContext2D, graine: number) {
    this.ctx = ctx;
    this.alea = creerAlea(graine);
    this.graphite = motif(ctx, GRAPHITE, creerAlea(7));
    this.rouge = motif(ctx, CRAYON_ROUGE, creerAlea(11));
  }

  /** Repart d'une graine (même graine, même dessin). */
  graine(g: number): void {
    this.alea = creerAlea(g);
  }

  /** Trait de crayon de (x1, y1) à (x2, y2). */
  trait(x1: number, y1: number, x2: number, y2: number, style: StyleTrait): void {
    const ctx = this.ctx;
    const alea = this.alea;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const long = Math.hypot(dx, dy);
    if (long < 0.01) return;
    const ux = dx / long;
    const uy = dy / long;
    const d0 = (alea() - 0.35) * 2.4;
    const d1 = (alea() - 0.35) * 2.4;
    const n = Math.max(2, Math.ceil(long / 14));
    const ph1 = alea() * 6.283;
    const ph2 = alea() * 6.283;
    const k1 = 1 + alea() * 1.5;
    const k2 = 3 + alea() * 3;
    const tr = style.tremble * Math.min(1, long / 30);
    ctx.strokeStyle = style.rouge === true ? this.rouge : this.graphite;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let passe = 0; passe < 2; passe++) {
      ctx.globalAlpha = passe === 0 ? style.encre : style.encre * 0.35;
      ctx.lineWidth = passe === 0 ? style.largeur : style.largeur * 0.55;
      const decal = passe === 0 ? 0 : (alea() - 0.5) * style.largeur * 1.1;
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        const s = -d0 + f * (long + d0 + d1);
        const w =
          tr * (Math.sin(ph1 + f * k1 * Math.PI) * 0.7 + Math.sin(ph2 + f * k2 * Math.PI) * 0.3) +
          decal;
        const x = x1 + ux * s - uy * w;
        const y = y1 + uy * s + ux * w;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Rectangle au crayon (quatre traits qui se croisent aux coins). */
  rect(x: number, y: number, l: number, h: number, style: StyleTrait): void {
    this.trait(x, y, x + l, y, style);
    this.trait(x + l, y, x + l, y + h, style);
    this.trait(x + l, y + h, x, y + h, style);
    this.trait(x, y + h, x, y, style);
  }

  /** Arc de cercle tremblé, de a0 à a1 (rad, sens des aiguilles d'une montre à l'écran). */
  arc(cx: number, cy: number, r: number, a0: number, a1: number, style: StyleTrait): void {
    const ctx = this.ctx;
    const alea = this.alea;
    const n = Math.max(10, Math.ceil((Math.abs(a1 - a0) * r) / 6));
    const ph = alea() * 6.283;
    const amp = style.tremble * 0.8;
    ctx.strokeStyle = style.rouge === true ? this.rouge : this.graphite;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let passe = 0; passe < 2; passe++) {
      ctx.globalAlpha = passe === 0 ? style.encre : style.encre * 0.35;
      ctx.lineWidth = passe === 0 ? style.largeur : style.largeur * 0.55;
      const dr = passe === 0 ? 0 : (alea() - 0.5) * style.largeur;
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        const a = a0 + (a1 - a0) * f;
        const rr = r + dr + amp * Math.sin(ph + f * 5.3);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Cercle à main levée (les bouts se recouvrent un peu). */
  cercle(cx: number, cy: number, r: number, style: StyleTrait): void {
    const a0 = this.alea() * 6.283;
    this.arc(cx, cy, r, a0, a0 + 6.283 + 0.25, style);
  }

  /** Hachures parallèles dans un rectangle (angle en rad depuis l'horizontale, pas en px). */
  hachures(
    x: number,
    y: number,
    l: number,
    h: number,
    angle: number,
    pas: number,
    style: StyleTrait,
  ): void {
    if (l <= 0 || h <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, l, h);
    ctx.clip();
    const cx = x + l / 2;
    const cy = y + h / 2;
    const demi = Math.hypot(l, h) / 2 + 4;
    const ux = Math.cos(angle);
    const uy = -Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    for (let d = -demi; d <= demi; d += pas) {
      const px = cx + nx * d;
      const py = cy + ny * d;
      this.trait(px - ux * demi, py - uy * demi, px + ux * demi, py + uy * demi, style);
    }
    ctx.restore();
  }

  /** Texte manuscrit. */
  texte(
    s: string,
    x: number,
    y: number,
    taille: number,
    align: CanvasTextAlign = 'left',
    couleur: string = ENCRE_TEXTE,
  ): void {
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.fillStyle = couleur;
    ctx.font = `${String(taille)}px ${POLICE_MAIN}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }
}
