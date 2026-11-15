/**
 * Maquette C (jetable) : le treuil en fil de fer 3D, dessiné sur le phosphore du tube.
 *
 * Projection perspective faite à la main (quelques centaines de segments) : tout le tube reste
 * un seul canvas 2D, donc un seul traitement « phosphore » pour le fil de fer, les courbes et les
 * textes. Monde en mètres : x à droite, y vers le haut (sol = 0), z vers l'observateur.
 * Rien de cette géométrie n'est une valeur de jeu sauf y (cabine), la consigne r et la poutre.
 */

/** Rayon du tambour (m) : choix de dessin ; l'angle du tambour vaut y / R (câble enroulé). */
export const RAYON_TAMBOUR = 0.3;

/** Zone du tube où dessiner le treuil (pixels CSS du tube). */
export interface Cadre {
  readonly x: number;
  readonly y: number;
  readonly l: number;
  readonly h: number;
}

/** Ce que le treuil doit montrer à cette image. */
export interface EtatTreuil {
  /** Hauteur et vitesse de la cabine à dessiner (m, m/s). */
  readonly y: number;
  readonly v: number;
  /** Force appliquée (N) et saturation du moteur (N). */
  readonly uSat: number;
  readonly uMax: number;
  /** Vrai si la commande est écrêtée. */
  readonly sature: boolean;
  /** Consigne et hauteur de la poutre (m). */
  readonly r: number;
  readonly poutre: number;
  /** Vrai si l'issue est un choc et qu'elle est atteinte. */
  readonly choc: boolean;
  /** Phase du clignotement (0 ou 1) ; toujours 1 si mouvement réduit. */
  readonly clignote: number;
}

const VERT = '#6dff8e';
const VERT_VIF = '#c9ffd2';
const VERT_TEXTE = '#b8ffc4';
const POLICE_TUBE = "'Consolas', 'Lucida Console', 'Courier New', monospace";

/** Projection courante (réécrite à chaque image, aucune allocation). */
const proj = { x: 0, y: 0 };

export class Treuil {
  private cx = 0;
  private cy = 0;
  private f = 0;
  private readonly lacet = -0.55;
  private readonly tangage = 0.2;
  private readonly distance = 11;
  private readonly yCentre = 2.45;
  private readonly cosL = Math.cos(this.lacet);
  private readonly sinL = Math.sin(this.lacet);
  private readonly cosT = Math.cos(this.tangage);
  private readonly sinT = Math.sin(this.tangage);
  private ctx: CanvasRenderingContext2D | null = null;

  /** Projette (x, y, z) monde vers `proj` (pixels du tube). */
  private projeter(x: number, y: number, z: number): void {
    const yy = y - this.yCentre;
    const x1 = x * this.cosL + z * this.sinL;
    const z1 = -x * this.sinL + z * this.cosL;
    const y2 = yy * this.cosT - z1 * this.sinT;
    const z2 = yy * this.sinT + z1 * this.cosT;
    const s = this.f / (this.distance - z2);
    proj.x = this.cx + x1 * s;
    proj.y = this.cy - y2 * s;
  }

  private seg(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    this.projeter(x1, y1, z1);
    ctx.moveTo(proj.x, proj.y);
    this.projeter(x2, y2, z2);
    ctx.lineTo(proj.x, proj.y);
  }

  /** Boîte en fil de fer (12 arêtes). */
  private boite(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.seg(x0, y0, z0, x1, y0, z0);
    this.seg(x1, y0, z0, x1, y0, z1);
    this.seg(x1, y0, z1, x0, y0, z1);
    this.seg(x0, y0, z1, x0, y0, z0);
    this.seg(x0, y1, z0, x1, y1, z0);
    this.seg(x1, y1, z0, x1, y1, z1);
    this.seg(x1, y1, z1, x0, y1, z1);
    this.seg(x0, y1, z1, x0, y1, z0);
    this.seg(x0, y0, z0, x0, y1, z0);
    this.seg(x1, y0, z0, x1, y1, z0);
    this.seg(x1, y0, z1, x1, y1, z1);
    this.seg(x0, y0, z1, x0, y1, z1);
  }

  /** Cercle dans un plan z = cte (axe z), n segments, décalé de l'angle a0. */
  private cercleZ(cx: number, cy: number, z: number, r: number, n: number): void {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const b = ((k + 1) / n) * Math.PI * 2;
      this.seg(
        cx + Math.cos(a) * r,
        cy + Math.sin(a) * r,
        z,
        cx + Math.cos(b) * r,
        cy + Math.sin(b) * r,
        z,
      );
    }
  }

  private tracer(couleur: string, alpha: number, largeur: number): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    ctx.strokeStyle = couleur;
    ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
    ctx.lineWidth = largeur;
    ctx.stroke();
    ctx.beginPath();
  }

  /** Dessine le treuil dans le cadre. */
  dessiner(ctx: CanvasRenderingContext2D, cadre: Cadre, e: Readonly<EtatTreuil>): void {
    this.ctx = ctx;
    this.cx = cadre.x + cadre.l * 0.56;
    this.cy = cadre.y + cadre.h * 0.5;
    this.f = (cadre.h / 6.3) * this.distance;
    const R = RAYON_TAMBOUR;
    const xt = -R; // axe du tambour : le câble tombe en x = 0
    const yt = 4.75;
    const angle = e.y / R;
    const effort = Math.min(1, Math.abs(e.uSat) / e.uMax);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();

    // Cage : sol, montants, cadre du haut.
    const X = 1.05;
    const Z = 0.7;
    this.boite(-X, 0, -Z, X, 4.35, Z);
    this.tracer(VERT, 0.28, 1);
    // Sol hachuré (trois lignes).
    for (let k = 1; k < 4; k++) this.seg(-X, 0, -Z + (k * 2 * Z) / 4, X, 0, -Z + (k * 2 * Z) / 4);
    this.tracer(VERT, 0.2, 1);

    // Consigne r : cadre pointillé autour de la cage.
    ctx.setLineDash([4, 4]);
    this.seg(-X, e.r, Z, X, e.r, Z);
    this.seg(X, e.r, Z, X, e.r, -Z);
    this.tracer(VERT_VIF, 0.7, 1.2);
    ctx.setLineDash([]);

    // Poutre : deux corbeaux sur les montants, hauteur de choc.
    const hp = e.poutre;
    const eclat = e.choc ? (e.clignote > 0 ? 1 : 0.55) : 0.6;
    this.boite(-X, hp, -Z, -X + 0.36, hp + 0.18, Z);
    this.boite(X - 0.36, hp, -Z, X, hp + 0.18, Z);
    for (let k = 0; k < 6; k++) {
      const z = -Z + (k * 2 * Z) / 5;
      this.seg(-X, hp, z, -X + 0.36, hp + 0.18, z);
      this.seg(X - 0.36, hp, z, X, hp + 0.18, z);
    }
    this.tracer(e.choc ? VERT_VIF : VERT, eclat, e.choc ? 2.2 : 1.2);

    // Cabine : plateau, rambarde, bonhomme.
    const y = e.y;
    const lx = 0.62;
    const lz = 0.48;
    this.boite(-lx, y - 0.1, -lz, lx, y, lz);
    this.seg(-lx, y, -lz, -lx, y + 0.9, -lz);
    this.seg(-lx, y, lz, -lx, y + 0.9, lz);
    this.seg(lx, y, -lz, lx, y + 0.9, -lz);
    this.seg(lx, y, lz, lx, y + 0.9, lz);
    this.seg(-lx, y + 0.9, -lz, -lx, y + 0.9, lz);
    this.seg(lx, y + 0.9, -lz, lx, y + 0.9, lz);
    // Étrier et câble.
    const yc = y + 1.3;
    this.seg(-lx, y + 0.9, 0, 0, yc, 0);
    this.seg(lx, y + 0.9, 0, 0, yc, 0);
    this.tracer(VERT, 0.95, 1.6);
    // Bonhomme (tête, buste, bras, jambes).
    const bx = 0.25;
    this.seg(bx - 0.1, y, 0, bx, y + 0.45, 0);
    this.seg(bx + 0.1, y, 0, bx, y + 0.45, 0);
    this.seg(bx, y + 0.45, 0, bx, y + 0.85, 0);
    this.seg(bx, y + 0.78, 0, bx - 0.18, y + 0.55, 0);
    this.seg(bx, y + 0.78, 0, bx + 0.2, y + 0.9, 0);
    this.cercleZ(bx, y + 0.97, 0, 0.11, 10);
    this.tracer(VERT_VIF, 0.85, 1.4);

    // Câble : de l'étrier au tambour ; repères qui défilent avec la cabine.
    this.seg(0, yc, 0, 0, yt, 0);
    this.tracer(VERT_VIF, 0.9, 1.5);
    for (let k = 0; k < 40; k++) {
      const ym = yc + 0.12 + k * 0.3;
      if (ym > yt - 0.02) break;
      this.seg(-0.05, ym, 0, 0.05, ym, 0);
    }
    this.tracer(VERT_VIF, 0.7, 1.2);

    // Tambour : deux flasques, génératrices et rayons qui tournent.
    const zt0 = -0.28;
    const zt1 = 0.28;
    this.cercleZ(xt, yt, zt0, R + 0.06, 18);
    this.cercleZ(xt, yt, zt1, R + 0.06, 18);
    this.cercleZ(xt, yt, zt1, R, 18);
    this.tracer(VERT, 0.85, 1.3);
    for (let k = 0; k < 8; k++) {
      const a = angle + (k * Math.PI) / 4;
      const ca = Math.cos(a) * R;
      const sa = Math.sin(a) * R;
      this.seg(xt + ca, yt + sa, zt0, xt + ca, yt + sa, zt1);
      if (k % 2 === 0) this.seg(xt, yt, zt1, xt + ca, yt + sa, zt1);
    }
    this.tracer(VERT, 0.8, 1.2);
    // Repère du tambour (un rayon plus marqué, pour lire le sens de rotation).
    this.seg(
      xt,
      yt,
      zt1 + 0.01,
      xt + Math.cos(angle) * (R + 0.06),
      yt + Math.sin(angle) * (R + 0.06),
      zt1,
    );
    this.tracer(VERT_VIF, 1, 2.2);

    // Arbre et moteur (en avant du tambour) : carcasse dont l'éclat suit l'effort.
    const zm0 = 0.5;
    const zm1 = 1.3;
    const Rm = 0.4;
    this.seg(xt, yt, zt1, xt, yt, zm0);
    this.tracer(VERT, 0.8, 1.5);
    const alerte = e.sature;
    const eclatMoteur = alerte ? (e.clignote > 0 ? 1 : 0.35) : 0.35 + 0.65 * effort;
    const largeurMoteur = alerte ? 2.4 : 1 + 1.2 * effort;
    this.cercleZ(xt, yt, zm0, Rm, 20);
    this.cercleZ(xt, yt, zm1, Rm, 20);
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5 + 0.3;
      const ca = Math.cos(a) * Rm;
      const sa = Math.sin(a) * Rm;
      this.seg(xt + ca, yt + sa, zm0, xt + ca, yt + sa, zm1);
    }
    // Ailettes (anneaux) : plus nombreux à l'effort fort.
    const anneaux = 1 + Math.round(effort * 3);
    for (let k = 1; k <= anneaux; k++) {
      this.cercleZ(xt, yt, zm0 + ((zm1 - zm0) * k) / (anneaux + 1), Rm + 0.03, 20);
    }
    // Socle du moteur sur le haut de la cage.
    this.seg(xt - Rm, yt - Rm, zm0, xt - Rm, 4.35, zm0);
    this.seg(xt + Rm, yt - Rm, zm0, xt + Rm, 4.35, zm0);
    this.seg(xt - Rm, yt - Rm, zm1, xt - Rm, 4.35, zm1);
    this.seg(xt + Rm, yt - Rm, zm1, xt + Rm, 4.35, zm1);
    this.tracer(alerte ? VERT_VIF : VERT, eclatMoteur, largeurMoteur);
    // Rotor visible par la face avant : six rayons dont un repère, à la vitesse du tambour.
    const Rr = 0.3;
    this.cercleZ(xt, yt, zm1 + 0.01, Rr, 14);
    for (let k = 0; k < 6; k++) {
      const a = angle + (k * Math.PI) / 3;
      this.seg(xt, yt, zm1 + 0.01, xt + Math.cos(a) * Rr, yt + Math.sin(a) * Rr, zm1 + 0.01);
    }
    this.tracer(VERT_VIF, 0.45 + 0.55 * effort, 1.2 + effort);
    this.seg(
      xt,
      yt,
      zm1 + 0.02,
      xt + Math.cos(angle) * Rr * 1.25,
      yt + Math.sin(angle) * Rr * 1.25,
      zm1 + 0.02,
    );
    this.tracer(VERT_VIF, 1, 2.6);
    // Rayonnement d'effort : traits radiaux autour de la carcasse, longueur ∝ effort.
    if (effort > 0.02) {
      const long = 0.08 + 0.22 * effort;
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        this.seg(
          xt + ca * (Rm + 0.07),
          yt + sa * (Rm + 0.07),
          zm1,
          xt + ca * (Rm + 0.07 + long),
          yt + sa * (Rm + 0.07 + long),
          zm1,
        );
      }
      this.tracer(VERT, alerte ? eclatMoteur : 0.3 + 0.5 * effort, 1);
    }

    // Flèche de force sur le câble, au-dessus de l'étrier (longueur ∝ uSat, vers le haut si > 0).
    const fl = (1.1 * e.uSat) / e.uMax;
    if (Math.abs(fl) > 0.02) {
      const xf = 0.42;
      const y0 = yc;
      const y1 = yc + fl;
      const sens = Math.sign(fl);
      this.seg(xf, y0, 0, xf, y1, 0);
      this.seg(xf, y1, 0, xf - 0.08, y1 - sens * 0.12, 0);
      this.seg(xf, y1, 0, xf + 0.08, y1 - sens * 0.12, 0);
      this.tracer(VERT_VIF, alerte ? eclatMoteur : 0.9, 2);
      this.projeter(xf + 0.1, y0 + fl * 0.5, 0);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = VERT_TEXTE;
      ctx.font = `13px ${POLICE_TUBE}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', proj.x + 2, proj.y);
    }

    // Étiquettes : consigne, poutre, moteur.
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = VERT_TEXTE;
    ctx.font = `13px ${POLICE_TUBE}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    this.projeter(X, e.r, Z);
    ctx.fillText('r', proj.x + 4, proj.y);
    this.projeter(X, hp + 0.09, -Z);
    ctx.fillText(e.choc ? 'CHOC' : 'poutre', proj.x + 4, proj.y);
    this.projeter(xt, yt + Rm + 0.12, (zm0 + zm1) / 2);
    ctx.textAlign = 'center';
    ctx.fillText(alerte ? 'SATURÉ' : 'moteur', proj.x, proj.y - 8);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.ctx = null;
  }
}
