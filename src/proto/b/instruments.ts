/**
 * Maquette B (jetable) : les deux cadrans qui remplacent le dessin du moteur du treuil.
 * - Dynamomètre : effort du moteur. Aiguille pleine = force appliquée (uSat) ; aiguille en
 *   tirets = force demandée (uCmd), qui entre dans la zone rouge hachurée quand elle dépasse ce
 *   que le moteur peut donner (uMax) ; la vraie aiguille, elle, reste à la butée.
 * - Tachymètre : vitesse de rotation du tambour, déduite de la vitesse de la cabine
 *   (ω = v / R, R choisi pour le dessin) ; sous le cadran, le câble enroulé défile (sa position
 *   est la hauteur de la cabine, intégrale de la vitesse).
 */
import {
  APPUYE,
  ENCRE_DOUCE,
  FIN,
  ORDINAIRE,
  PAPIER_CLAIR,
  ROUGE_TEXTE,
  cercle,
  ecrire,
  hachurer,
  pointsArc,
  rectangle,
  trait,
  type Crayon,
} from './crayon';
import { nombre } from './format';

/** Rayon du tambour du treuil (m) : celui du dessin du jeu (`MOTOR_RADIUS`), choix de dessin. */
export const RAYON_TAMBOUR = 0.17;

/** Dynamomètre : centre, rayon, échelle (N), balayage (rad). */
export const DYNA = {
  cx: 495,
  cy: 198,
  r: 118,
  min: -2500,
  max: 15000,
  a0: Math.PI * 0.75,
  a1: Math.PI * 2.25,
} as const;

/** Tachymètre : centre, rayon, échelle (tr/min), balayage (rad), 0 en haut. */
export const TACHY = {
  cx: 495,
  cy: 534,
  r: 96,
  min: -600,
  max: 600,
  a0: (Math.PI * 5) / 6,
  a1: (Math.PI * 13) / 6,
} as const;

/** Fenêtre du câble qui défile, sous le tachymètre. */
const BANDE = { x0: 385, x1: 605, y0: 648, y1: 674, pxParMetre: 100 } as const;

function angleDyna(f: number): number {
  const c = f < DYNA.min ? DYNA.min : f > DYNA.max ? DYNA.max : f;
  return DYNA.a0 + ((c - DYNA.min) / (DYNA.max - DYNA.min)) * (DYNA.a1 - DYNA.a0);
}

function angleTachy(n: number): number {
  const c = n < TACHY.min ? TACHY.min : n > TACHY.max ? TACHY.max : n;
  return TACHY.a0 + ((c - TACHY.min) / (TACHY.max - TACHY.min)) * (TACHY.a1 - TACHY.a0);
}

/** Vitesse de rotation du tambour (tr/min) pour une vitesse de câble v (m/s). */
export function toursParMinute(v: number): number {
  return ((v / RAYON_TAMBOUR) * 60) / (2 * Math.PI);
}

function fondCadran(cr: Crayon, cx: number, cy: number, r: number, graine: number): void {
  const ctx = cr.ctx;
  ctx.save();
  ctx.globalAlpha = 0.93;
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  cercle(cr, cx, cy, r, APPUYE, graine);
}

function graduer(
  cr: Crayon,
  cx: number,
  cy: number,
  rayon: number,
  angle: number,
  longueur: number,
  majeure: boolean,
  graine: number,
): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  trait(
    cr,
    [cx + c * rayon, cy + s * rayon, cx + c * (rayon - longueur), cy + s * (rayon - longueur)],
    majeure ? ORDINAIRE : FIN,
    graine,
  );
}

/**
 * Face fixe du dynamomètre et du tachymètre (titres, graduations, zones), dessinée une fois.
 * @param uMax saturation du moteur (N).
 * @param poids poids de la cabine m·g (N), repère sur le cadran.
 */
export function dessinerFacesInstruments(cr: Crayon, uMax: number, poids: number): void {
  const ctx = cr.ctx;
  // ---- Dynamomètre
  const { cx, cy, r } = DYNA;
  ecrire(ctx, 'Dynamomètre', cx, 40, 28, 'center');
  ecrire(ctx, 'effort du moteur sur le câble', cx, 62, 17, 'center', ENCRE_DOUCE);
  fondCadran(cr, cx, cy, r, 101);
  const aSat = angleDyna(uMax);
  hachurer(
    cr,
    (c) => {
      c.arc(cx, cy, r - 4, aSat, DYNA.a1);
      c.arc(cx, cy, r - 22, DYNA.a1, aSat, true);
      c.closePath();
    },
    [cx - r, cy - r, cx + r, cy + r],
    Math.PI / 3,
    5,
    { largeur: 1.1, encre: 0.6, tremble: 0.3, rouge: true },
    130,
  );
  trait(cr, pointsArc(cx, cy, r - 22, aSat, DYNA.a1), { ...FIN, rouge: true }, 131);
  for (let f: number = DYNA.min, k = 0; f <= DYNA.max; f += 500, k++) {
    const majeure = f % 2500 === 0;
    graduer(cr, cx, cy, r - 4, angleDyna(f), majeure ? 15 : 7, majeure, 140 + k);
    if (majeure) {
      const a = angleDyna(f);
      const texte = nombre(f / 1000, f % 1000 === 0 ? 0 : 1);
      ecrire(
        ctx,
        texte,
        cx + Math.cos(a) * (r - 34),
        cy + Math.sin(a) * (r - 34) + 6,
        17,
        'center',
      );
    }
  }
  ecrire(ctx, 'kN', cx, cy - 32, 17, 'center', ENCRE_DOUCE);
  const aLib = Math.PI * 1.9;
  ecrire(
    ctx,
    'saturation',
    cx + Math.cos(aLib) * 54,
    cy + Math.sin(aLib) * 54 + 5,
    16,
    'center',
    ROUGE_TEXTE,
  );
  // Repère du poids m·g : la force qu'il faut pour tenir la cabine en l'air.
  const aP = angleDyna(poids);
  const cp = Math.cos(aP);
  const sp = Math.sin(aP);
  trait(
    cr,
    [
      cx + cp * (r + 13) - sp * 5,
      cy + sp * (r + 13) + cp * 5,
      cx + cp * (r + 2),
      cy + sp * (r + 2),
      cx + cp * (r + 13) + sp * 5,
      cy + sp * (r + 13) - cp * 5,
    ],
    ORDINAIRE,
    160,
    true,
  );
  ecrire(ctx, 'poids', cx + cp * (r + 18), cy + sp * (r + 18) + 6, 16, 'right', ENCRE_DOUCE);

  // ---- Tachymètre
  const t = TACHY;
  ecrire(ctx, 'Tachymètre', t.cx, 401, 28, 'center');
  ecrire(ctx, 'vitesse de rotation du tambour', t.cx, 423, 17, 'center', ENCRE_DOUCE);
  fondCadran(cr, t.cx, t.cy, t.r, 201);
  for (let n: number = t.min, k = 0; n <= t.max; n += 50, k++) {
    const majeure = n % 200 === 0;
    graduer(cr, t.cx, t.cy, t.r - 4, angleTachy(n), majeure ? 13 : 6, majeure, 210 + k);
    if (majeure) {
      const a = angleTachy(n);
      ecrire(
        ctx,
        nombre(n),
        t.cx + Math.cos(a) * (t.r - 31),
        t.cy + Math.sin(a) * (t.r - 31) + 5,
        16,
        'center',
      );
    }
  }
  ecrire(ctx, 'descente', t.cx - t.r - 10, t.cy + 6, 17, 'right', ENCRE_DOUCE);
  ecrire(ctx, 'montée', t.cx + t.r + 10, t.cy + 6, 17, 'left', ENCRE_DOUCE);
}

/** Aiguille effilée pleine (de la queue à la pointe). */
function aiguille(
  cr: Crayon,
  cx: number,
  cy: number,
  angle: number,
  longueur: number,
  rouge: boolean,
): void {
  const ctx = cr.ctx;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const queue = 10;
  ctx.save();
  ctx.fillStyle = rouge ? cr.rouge : cr.graphite;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(cx + c * longueur, cy + s * longueur);
  ctx.lineTo(cx - s * 4, cy + c * 4);
  ctx.lineTo(cx - c * queue - s * 2.5, cy - s * queue + c * 2.5);
  ctx.lineTo(cx - c * queue + s * 2.5, cy - s * queue - c * 2.5);
  ctx.lineTo(cx + s * 4, cy - c * 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  cercle(cr, cx, cy, 7, ORDINAIRE, 300);
}

/** État dynamique du dynamomètre. */
export interface EtatDyna {
  readonly actif: boolean;
  readonly uSat: number;
  readonly uCmd: number;
  readonly sature: boolean;
  readonly uMax: number;
}

/** Aiguilles et lectures du dynamomètre. */
export function dessinerDyna(cr: Crayon, e: EtatDyna): void {
  const ctx = cr.ctx;
  const { cx, cy, r } = DYNA;
  const uSat = e.actif ? e.uSat : 0;
  const uCmd = e.actif ? e.uCmd : 0;
  if (e.sature) {
    // Tampon d'alerte sur le cadran.
    ctx.save();
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(cx - 52, cy - 62, 104, 34);
    ctx.restore();
    rectangle(
      cr,
      cx - 52,
      cy - 62,
      104,
      34,
      { largeur: 2.2, encre: 1, tremble: 0.6, rouge: true },
      400,
    );
    ecrire(ctx, 'SATURÉ !', cx, cy - 36, 24, 'center', ROUGE_TEXTE);
  }
  if (e.actif) {
    // Force demandée : aiguille en tirets, prolongée d'une flèche si elle sort du cadran.
    const a = angleDyna(uCmd);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const style = { largeur: 2, encre: 0.95, tremble: 0, tirets: [7, 5], rouge: e.sature };
    trait(cr, [cx + c * 12, cy + s * 12, cx + c * (r - 10), cy + s * (r - 10)], style, 410);
    const xp = cx + c * (r - 4);
    const yp = cy + s * (r - 4);
    trait(
      cr,
      [xp - c * 12 - s * 6, yp - s * 12 + c * 6, xp, yp, xp - c * 12 + s * 6, yp - s * 12 - c * 6],
      { largeur: 2, encre: 1, tremble: 0, rouge: e.sature },
      411,
      true,
    );
  }
  aiguille(cr, cx, cy, angleDyna(uSat), r - 16, e.sature);
  ecrire(ctx, nombre(uSat) + ' N', cx, cy + 46, 26, 'center');
  ecrire(ctx, 'appliquée', cx, cy + 66, 16, 'center', ENCRE_DOUCE);
  const couleur = e.sature ? ROUGE_TEXTE : ENCRE_DOUCE;
  ecrire(ctx, 'demandée : ' + nombre(uCmd) + ' N', cx, cy + r + 26, 19, 'center', couleur);
  if (e.sature) {
    ecrire(
      ctx,
      'le moteur plafonne à ' + nombre(e.uMax) + ' N',
      cx,
      cy + r + 47,
      17,
      'center',
      ROUGE_TEXTE,
    );
  }
}

/** Aiguille, lectures du tachymètre et câble qui défile. */
export function dessinerTachy(cr: Crayon, v: number, y: number): void {
  const ctx = cr.ctx;
  const t = TACHY;
  const n = toursParMinute(v);
  aiguille(cr, t.cx, t.cy, angleTachy(n), t.r - 14, false);
  ecrire(ctx, 'tr/min', t.cx, t.cy + 24, 15, 'center', ENCRE_DOUCE);
  ecrire(ctx, nombre(n), t.cx, t.cy + 51, 26, 'center');
  const sens = Math.abs(v) < 0.005 ? 'cabine arrêtée' : v > 0 ? 'cabine ↑ ' : 'cabine ↓ ';
  const texte = Math.abs(v) < 0.005 ? sens : sens + nombre(Math.abs(v), 1) + ' m/s';
  ecrire(ctx, texte, t.cx, t.cy + 71, 16, 'center', ENCRE_DOUCE);

  // Câble enroulé : une bande graduée qui défile sous un repère fixe.
  const b = BANDE;
  const milieu = (b.x0 + b.x1) / 2;
  ctx.save();
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.beginPath();
  ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.clip();
  ctx.strokeStyle = cr.graphite;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const demi = (b.x1 - b.x0) / 2 / b.pxParMetre;
  const k0 = Math.ceil((y - demi) * 10);
  const k1 = Math.floor((y + demi) * 10);
  for (let k = k0; k <= k1; k++) {
    const x = milieu + (k / 10 - y) * b.pxParMetre;
    const l = k % 10 === 0 ? 12 : k % 5 === 0 ? 8 : 5;
    ctx.moveTo(x, b.y0);
    ctx.lineTo(x, b.y0 + l);
  }
  ctx.stroke();
  for (let k = Math.ceil(k0 / 10) * 10; k <= k1; k += 10) {
    const x = milieu + (k / 10 - y) * b.pxParMetre;
    ecrire(ctx, nombre(k / 10) + ' m', x + 3, b.y1 - 3, 14, 'left', ENCRE_DOUCE);
  }
  ctx.restore();
  rectangle(cr, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, ORDINAIRE, 500);
  trait(
    cr,
    [milieu - 6, b.y0 - 9, milieu, b.y0 - 1, milieu + 6, b.y0 - 9],
    { largeur: 2, encre: 1, tremble: 0 },
    501,
    true,
  );
  trait(cr, [milieu, b.y0, milieu, b.y1], { largeur: 2, encre: 1, tremble: 0 }, 502);
  ecrire(ctx, 'câble enroulé : ' + nombre(y, 2) + ' m', milieu, b.y1 + 22, 17, 'center');
}
