/**
 * Maquette D (lot B, v0.3, JETABLE) : outils de dessin « au crayon » sur un canvas 2D.
 *
 * Tremblé déterministe : chaque trait reçoit une graine tirée d'un compteur remis à zéro au début
 * de chaque image ; le même dessin tremble donc de la même façon d'une image à l'autre, sauf quand
 * le « bouillon » change (8 fois par seconde de rejeu, comme le boiling du jeu).
 */
import { GRAPHITE_COLOR, RED_PENCIL_COLOR } from '../../render/pencil-style';

/** Papier crème (même teinte que `src/render/paper.ts`, recopiée : ce module importe three). */
export const PAPIER = '#f7f0de';
/** Encre des textes (contraste ≈ 14:1 sur le papier, comme `src/ui/ui.css`). */
export const ENCRE = '#2a2724';
/** Texte secondaire (≈ 9:1). */
export const ENCRE_PALE = '#4a4540';
/** Graphite des traits (charte crayon du jeu). */
export const GRAPHITE = GRAPHITE_COLOR;
/** Crayon rouge : seule couleur, réservée à la saturation (charte crayon du jeu). */
export const ROUGE = RED_PENCIL_COLOR;
/** Rouge des textes (plus sombre, ≈ 7:1, comme `src/ui/ui.css`). */
export const ROUGE_TEXTE = '#9a2a1c';
/** Grille du papier millimétré (couleurs de `src/render/paper.ts`). */
const GRILLE_FINE = '#86b9b2';
const GRILLE_DEMI = '#5f9f99';
const GRILLE_CM = '#3d8580';
/** Police manuscrite auto-hébergée (`public/fonts/`), avec replis. */
export const POLICE = "'Patrick Hand', 'Segoe Print', 'Comic Sans MS', sans-serif";

/** Bruit pseudo-aléatoire déterministe dans [0, 1[. */
export function bruit(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Crayon : primitives de dessin tremblées sur un contexte 2D. */
export class Crayon {
  readonly ctx: CanvasRenderingContext2D;
  private graine = 0;
  private bouillon = 0;
  private readonly polices = new Map<number, string>();
  private policeCourante = '';

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Début d'image : remet le compteur de graines (tremblé stable) et fixe le bouillon. */
  debut(bouillon: number): void {
    this.graine = 0;
    this.bouillon = bouillon;
    this.policeCourante = '';
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.setLineDash([]);
    this.ctx.globalAlpha = 1;
  }

  private graineSuivante(): number {
    this.graine += 1;
    return this.graine * 7.13 + this.bouillon * 131.7;
  }

  /** Chemin d'un trait tremblé (sans le tracer). */
  private chemin(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    g: number,
    tremble: number,
    deborde: number,
    decalage: number,
  ): void {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const longueur = Math.hypot(dx, dy);
    ctx.beginPath();
    if (longueur < 1e-6) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + 0.01, y1);
      return;
    }
    const ux = dx / longueur;
    const uy = dy / longueur;
    const ax = x1 - ux * deborde;
    const ay = y1 - uy * deborde;
    const total = longueur + 2 * deborde;
    const n = Math.max(1, Math.ceil(total / 26));
    for (let k = 0; k <= n; k += 1) {
      const f = k / n;
      const amplitude = k === 0 || k === n ? 0.35 : 1;
      const o = decalage + tremble * amplitude * (bruit(g + k * 1.618) * 2 - 1);
      const px = ax + ux * total * f - uy * o;
      const py = ay + uy * total * f + ux * o;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }

  /**
   * Trait de crayon de (x1, y1) à (x2, y2) : un passage principal et un passage léger décalé
   * (grain du graphite) pour les traits assez épais.
   */
  trait(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    epaisseur = 1.4,
    encre = 0.9,
    couleur: string = GRAPHITE,
    tremble = 0.6,
    deborde = 0,
  ): void {
    const ctx = this.ctx;
    const g = this.graineSuivante();
    this.chemin(x1, y1, x2, y2, g, tremble, deborde, 0);
    ctx.globalAlpha = encre;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.stroke();
    if (epaisseur >= 1.2) {
      this.chemin(x1, y1, x2, y2, g + 33.3, tremble, deborde, 0.55);
      ctx.globalAlpha = encre * 0.35;
      ctx.lineWidth = Math.max(0.6, epaisseur * 0.45);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Trait en tirets (motif donné), sans tremblé. */
  tirets(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    motif: readonly number[],
    epaisseur = 1.2,
    encre = 0.85,
    couleur: string = GRAPHITE,
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.setLineDash(motif);
    ctx.globalAlpha = encre;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /** Rectangle aux coins qui débordent (croquis d'atelier). */
  rect(
    x: number,
    y: number,
    l: number,
    h: number,
    epaisseur = 1.4,
    encre = 0.9,
    couleur: string = GRAPHITE,
    deborde = 2.5,
  ): void {
    this.trait(x, y, x + l, y, epaisseur, encre, couleur, 0.6, deborde);
    this.trait(x + l, y, x + l, y + h, epaisseur, encre, couleur, 0.6, deborde);
    this.trait(x + l, y + h, x, y + h, epaisseur, encre, couleur, 0.6, deborde);
    this.trait(x, y + h, x, y, epaisseur, encre, couleur, 0.6, deborde);
  }

  /** Cercle tremblé qui se referme en se chevauchant un peu. */
  cercle(
    cx: number,
    cy: number,
    r: number,
    epaisseur = 1.4,
    encre = 0.9,
    couleur: string = GRAPHITE,
    tremble = 0.5,
  ): void {
    this.arc(cx, cy, r, 0, Math.PI * 2 + 0.3, epaisseur, encre, couleur, tremble, true);
  }

  /** Arc tremblé de a0 à a1 (rad, sens du canvas). */
  arc(
    cx: number,
    cy: number,
    r: number,
    a0: number,
    a1: number,
    epaisseur = 1.4,
    encre = 0.9,
    couleur: string = GRAPHITE,
    tremble = 0.5,
    tourne = false,
  ): void {
    const ctx = this.ctx;
    const g = this.graineSuivante();
    const depart = tourne ? bruit(g) * Math.PI * 2 : 0;
    const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r * 0.15));
    ctx.beginPath();
    for (let k = 0; k <= n; k += 1) {
      const a = depart + a0 + ((a1 - a0) * k) / n;
      const rr = r + tremble * (bruit(g + k * 0.71) * 2 - 1);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.globalAlpha = encre;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Flèche de (x1, y1) vers (x2, y2), pointe en (x2, y2). */
  fleche(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    epaisseur = 1.6,
    encre = 0.95,
    couleur: string = GRAPHITE,
    tete = 8,
  ): void {
    const longueur = Math.hypot(x2 - x1, y2 - y1);
    if (longueur < 1.5) {
      this.point(x2, y2, epaisseur + 1, encre, couleur);
      return;
    }
    this.trait(x1, y1, x2, y2, epaisseur, encre, couleur, 0.4);
    this.pointe(x1, y1, x2, y2, epaisseur, encre, couleur, Math.min(tete, longueur * 0.6));
  }

  /** Pointe de flèche en (x2, y2), dans la direction (x1, y1) → (x2, y2). */
  pointe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    epaisseur = 1.6,
    encre = 0.95,
    couleur: string = GRAPHITE,
    tete = 8,
  ): void {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const ouverture = 0.42;
    this.trait(
      x2,
      y2,
      x2 - Math.cos(a - ouverture) * tete,
      y2 - Math.sin(a - ouverture) * tete,
      epaisseur,
      encre,
      couleur,
      0.2,
    );
    this.trait(
      x2,
      y2,
      x2 - Math.cos(a + ouverture) * tete,
      y2 - Math.sin(a + ouverture) * tete,
      epaisseur,
      encre,
      couleur,
      0.2,
    );
  }

  /** Cote d'atelier : flèche double de (x1, y1) à (x2, y2). */
  cote(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    epaisseur = 1.1,
    encre = 0.95,
    couleur: string = GRAPHITE,
  ): void {
    const longueur = Math.hypot(x2 - x1, y2 - y1);
    if (longueur < 14) {
      // Cote trop courte : pointes extérieures, comme sur un plan.
      const ux = longueur > 1e-6 ? (x2 - x1) / longueur : 0;
      const uy = longueur > 1e-6 ? (y2 - y1) / longueur : 1;
      this.trait(x1, y1, x2, y2, epaisseur, encre, couleur, 0);
      this.fleche(x1 - ux * 12, y1 - uy * 12, x1, y1, epaisseur, encre, couleur, 5);
      this.fleche(x2 + ux * 12, y2 + uy * 12, x2, y2, epaisseur, encre, couleur, 5);
      return;
    }
    this.trait(x1, y1, x2, y2, epaisseur, encre, couleur, 0.3);
    this.pointe(x2, y2, x1, y1, epaisseur, encre, couleur, 6);
    this.pointe(x1, y1, x2, y2, epaisseur, encre, couleur, 6);
  }

  /** Point appuyé. */
  point(x: number, y: number, rayon = 2.2, encre = 0.95, couleur: string = GRAPHITE): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, rayon, 0, Math.PI * 2);
    ctx.globalAlpha = encre;
    ctx.fillStyle = couleur;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Remplit un rectangle de papier (pour masquer ce qui est derrière). */
  gomme(x: number, y: number, l: number, h: number): void {
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAPIER;
    ctx.fillRect(x, y, l, h);
  }

  /** Hachures parallèles dans un rectangle (angle en rad depuis l'horizontale, vers le haut). */
  hachures(
    x: number,
    y: number,
    l: number,
    h: number,
    angle: number,
    pas: number,
    epaisseur = 0.9,
    encre = 0.55,
    couleur: string = GRAPHITE,
  ): void {
    if (l <= 0.5 || h <= 0.5) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, l, h);
    ctx.clip();
    this.hachuresDansZone(x, y, l, h, angle, pas, epaisseur, encre, couleur);
    ctx.restore();
  }

  /**
   * Hachures qui couvrent le rectangle (x, y, l, h), à tracer dans une zone de découpe déjà posée
   * par l'appelant (`ctx.clip`).
   */
  hachuresDansZone(
    x: number,
    y: number,
    l: number,
    h: number,
    angle: number,
    pas: number,
    epaisseur = 0.9,
    encre = 0.55,
    couleur: string = GRAPHITE,
  ): void {
    const ctx = this.ctx;
    const g = this.graineSuivante();
    const cx = x + l / 2;
    const cy = y + h / 2;
    const demi = Math.hypot(l, h) / 2 + 2;
    const dx = Math.cos(angle);
    const dy = -Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    ctx.beginPath();
    let k = 0;
    for (let s = -demi; s <= demi; s += pas) {
      const j = (bruit(g + k * 3.3) - 0.5) * pas * 0.25;
      const px = cx + nx * (s + j);
      const py = cy + ny * (s + j);
      ctx.moveTo(px - dx * demi, py - dy * demi);
      ctx.lineTo(px + dx * demi, py + dy * demi);
      k += 1;
    }
    ctx.globalAlpha = encre;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Ouvre un lot de segments droits tracés d'un seul coup (graduations, petites marques). */
  lot(): void {
    this.ctx.beginPath();
  }

  /** Ajoute un segment au lot ouvert. */
  segment(x1: number, y1: number, x2: number, y2: number): void {
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
  }

  /** Trace le lot ouvert. */
  finLot(epaisseur = 1, encre = 0.85, couleur: string = GRAPHITE): void {
    const ctx = this.ctx;
    ctx.globalAlpha = encre;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private police(taille: number): void {
    let p = this.polices.get(taille);
    if (p === undefined) {
      p = String(taille) + 'px ' + POLICE;
      this.polices.set(taille, p);
    }
    if (p !== this.policeCourante) {
      this.ctx.font = p;
      this.policeCourante = p;
    }
  }

  /** Texte manuscrit, avec un liseré de papier (« gommé » autour) pour rester lisible. */
  texte(
    s: string,
    x: number,
    y: number,
    taille: number,
    alignement: CanvasTextAlign = 'left',
    couleur: string = ENCRE,
    halo = true,
  ): void {
    const ctx = this.ctx;
    this.police(taille);
    ctx.textAlign = alignement;
    ctx.textBaseline = 'alphabetic';
    if (halo) {
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = 4;
      ctx.strokeStyle = PAPIER;
      ctx.strokeText(s, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = couleur;
    ctx.fillText(s, x, y);
  }

  /** Largeur d'un texte à la taille donnée. */
  largeur(s: string, taille: number): number {
    this.police(taille);
    return this.ctx.measureText(s).width;
  }
}

/**
 * Peint la feuille de papier millimétré (fond fixe, une seule fois par redimensionnement) :
 * crème, grain discret, traits tous les 8 px (« millimètre »), 40 px et 80 px (« centimètre »).
 */
export function dessinerPapier(ctx: CanvasRenderingContext2D, l: number, h: number): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPIER;
  ctx.fillRect(0, 0, l, h);
  ctx.fillStyle = '#6b5f4a';
  for (let i = 0; i < 5000; i += 1) {
    ctx.globalAlpha = 0.04 + 0.06 * bruit(i * 0.37 + 5);
    ctx.fillRect(bruit(i * 3.1) * l, bruit(i * 7.7 + 1) * h, 1, 1);
  }
  const famille = (pas: number, couleur: string, encre: number, epaisseur: number): void => {
    ctx.beginPath();
    for (let x = 0; x <= l; x += pas) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y <= h; y += pas) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(l, y + 0.5);
    }
    ctx.globalAlpha = encre;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.stroke();
  };
  famille(8, GRILLE_FINE, 0.22, 0.6);
  famille(40, GRILLE_DEMI, 0.26, 0.8);
  famille(80, GRILLE_CM, 0.34, 1.1);
  ctx.globalAlpha = 1;
}
