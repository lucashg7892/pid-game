/**
 * Colonne de la machine (T-050), couche FIXE : les plaques, l'écorché du moteur du treuil (pièces
 * immobiles, légendes, coupe A-A, règle de hauteur, poutre et sol), les voyants éteints et la
 * jauge de force vide (graduations, zone écrêtée). Dessin repris de la maquette A du lot B (v0.3),
 * à l'identique, textes passés par les locales. Redessinée seulement quand `versionFond` change.
 */
import type { Translator } from '../../i18n';
import {
  ENCRE,
  ENCRE_DOUCE,
  GRAPHITE,
  MINE,
  MINE_FINE,
  MINE_FORTE,
  MINE_HACHURE,
  MINE_ROUGE,
  MINE_ROUGE_HACHURE,
  PAPIER_CLAIR,
  ROUGE,
  ROUGE_TEXTE,
  alea,
  arc,
  cercle,
  hachures,
  hachuresRect,
  plaque,
  polyligne,
  rect,
  texte,
  trait,
  vis,
  type Alea,
  type Mine,
} from './crayon';
import {
  ARBRE_R,
  ARBRE_X0,
  ARBRE_X1,
  AXE_Y,
  BORD_DROIT_X,
  CABLE_X,
  COLLECTEUR_R,
  COLLECTEUR_X0,
  COLLECTEUR_X1,
  COUPE_R_CARCASSE,
  COUPE_R_CARCASSE_INT,
  COUPE_R_POLE,
  COUPE_R_ROTOR,
  COUPE_X,
  COUPE_Y,
  FORCE_MAX,
  CONSIGNE,
  HAUTEUR_POUTRE,
  JAUGE_CHIFFRE,
  JAUGE_MAX,
  JAUGE_MIN,
  JAUGE_TRAIT,
  POULIE_Y,
  REGLE_BAS,
  REGLE_HAUT,
  REGLE_MAX,
  REGLE_X,
  ROTOR_R,
  ROTOR_X0,
  ROTOR_X1,
  TAILLE_TEXTE,
  TAMBOUR_R,
  TAMBOUR_X0,
  TAMBOUR_X1,
  VOYANTS,
  VOYANT_R,
  disposition,
  geometrieJauge,
  yJauge,
  yRegle,
  type Plaque,
} from './machine-plan';
import { texteForce } from './machine-etat';
import type { RectPlan } from './plan';

/** Symbole de la force maximale du moteur (notation scientifique, identique dans toutes les langues). */
const SYMBOLE_UMAX = 'Umax';

/** Ligne droite sans tremblé (trait de repère, en tirets si `tirets` est non vide). */
function ligneDroite(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  couleur: string,
  alpha: number,
  largeur: number,
): void {
  ctx.strokeStyle = couleur;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = largeur;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Voyant éteint : douille, verre, reflet. */
function lampeEteinte(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rayon: number,
  r: Alea,
): void {
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.beginPath();
  ctx.arc(x, y, rayon + 3, 0, Math.PI * 2);
  ctx.fill();
  cercle(ctx, x, y, rayon + 3, MINE, r);
  cercle(ctx, x, y, rayon, MINE_FINE, r);
  arc(ctx, x, y, rayon - 3, -2.6, -1.6, MINE_FINE, r);
}

/** Légende : texte et petit trait de rappel vers la pièce désignée. */
function rappel(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  cibleX: number,
  cibleY: number,
  r: Alea,
): void {
  texte(ctx, s, x, y, TAILLE_TEXTE);
  const w = ctx.measureText(s).width;
  const dx = Math.min(Math.max(cibleX, x + 4), x + w - 4);
  const dy = cibleY < y ? y - 15 : y + 3;
  trait(ctx, dx, dy, cibleX, cibleY, MINE_FINE, r);
  cercle(ctx, cibleX, cibleY, 1.4, MINE_FINE, r);
}

/** Hachure de coupe du métal (45°). */
function coupeMetal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: Alea,
  mine: Mine = MINE_HACHURE,
): void {
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(x, y, w, h);
  hachuresRect(ctx, x, y, w, h, Math.PI / 4, 3.4, mine, r);
  rect(ctx, x, y, w, h, MINE, r);
}

/** Bobine en coupe (cuivre : hachure croisée). */
function bobine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: Alea,
): void {
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(x, y, w, h);
  hachuresRect(ctx, x, y, w, h, Math.PI / 4, 2.6, MINE_HACHURE, r);
  hachuresRect(ctx, x, y, w, h, -Math.PI / 4, 2.6, MINE_HACHURE, r);
  rect(ctx, x, y, w, h, MINE_FINE, r);
}

/**
 * Dessine toute la couche fixe de la colonne.
 * @param ctx contexte du canvas de fond, en unités du plan.
 * @param rc rectangle de la colonne dans le plan.
 * @param tr traducteur.
 */
export function dessinerFondMachine(
  ctx: CanvasRenderingContext2D,
  rc: Readonly<RectPlan>,
  tr: Translator,
): void {
  const d = disposition(rc);
  const r = alea(1952);
  voyantsFond(ctx, d.voyants, tr, r);
  ctx.save();
  ctx.translate(d.dx, d.dy);
  moteurFond(ctx, tr, r);
  ctx.restore();
  jaugeFond(ctx, d.jauge, tr, r);
}

// --- Voyants ----------------------------------------------------------------------------------

function voyantsFond(
  ctx: CanvasRenderingContext2D,
  p: Readonly<Plaque>,
  tr: Translator,
  r: Alea,
): void {
  plaque(ctx, p.x, p.y, p.w, p.h, r);
  for (const v of VOYANTS) {
    lampeEteinte(ctx, p.x + v.x, p.y + p.h / 2, VOYANT_R, r);
    texte(ctx, tr.t(v.cle), p.x + v.x + 24, p.y + p.h / 2 + 6, 18);
  }
}

// --- Moteur en écorché (coordonnées de la maquette) -----------------------------------------------

function moteurFond(ctx: CanvasRenderingContext2D, tr: Translator, r: Alea): void {
  // Panneau : (870, 232) de 318 × 496.
  const px = 870;
  const py = 232;
  plaque(ctx, px, py, 318, 496, r);
  texte(ctx, tr.t('pupitre.machine.titre'), px + 16, py + 24, 18);

  const H = 56; // demi-hauteur extérieure de la carcasse
  const ep = 9; // épaisseur de la paroi
  const x0 = 884;
  const x1 = 1040;
  const yH = AXE_Y - H;
  const yB = AXE_Y + H;

  // arbre (dessous de tout)
  trait(ctx, 876, AXE_Y - ARBRE_R, TAMBOUR_X0, AXE_Y - ARBRE_R, MINE, r);
  trait(ctx, 876, AXE_Y + ARBRE_R, TAMBOUR_X0, AXE_Y + ARBRE_R, MINE, r);
  trait(ctx, 876, AXE_Y - ARBRE_R, 876, AXE_Y + ARBRE_R, MINE, r);
  trait(ctx, TAMBOUR_X1, AXE_Y - ARBRE_R, 1184, AXE_Y - ARBRE_R, MINE, r);
  trait(ctx, TAMBOUR_X1, AXE_Y + ARBRE_R, 1184, AXE_Y + ARBRE_R, MINE, r);
  ctx.setLineDash([10, 3, 2, 3]);
  ligneDroite(ctx, 872, AXE_Y, 1186, AXE_Y, GRAPHITE, 0.45, 0.8);
  ctx.setLineDash([]);

  // bâti et pattes
  coupeMetal(ctx, 878, 414, 308, 8, r);
  for (const pattes of [896, 1006]) {
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.fillRect(pattes, yB, 22, 414 - yB);
    rect(ctx, pattes, yB, 22, 414 - yB, MINE, r);
    vis(ctx, pattes + 11, yB + 5, 2.6, r);
  }

  // carcasse : parois en coupe
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(x0, yH, x1 - x0, 2 * H);
  coupeMetal(ctx, x0, yH, x1 - x0, ep, r);
  coupeMetal(ctx, x0, yB - ep, x1 - x0, ep, r);
  coupeMetal(ctx, x0, yH + ep, ep, AXE_Y - ARBRE_R - 8 - (yH + ep), r);
  coupeMetal(ctx, x0, AXE_Y + ARBRE_R + 8, ep, yB - ep - (AXE_Y + ARBRE_R + 8), r);
  coupeMetal(ctx, x1 - ep, yH + ep, ep, AXE_Y - ARBRE_R - 8 - (yH + ep), r);
  coupeMetal(ctx, x1 - ep, AXE_Y + ARBRE_R + 8, ep, yB - ep - (AXE_Y + ARBRE_R + 8), r);
  // paliers à billes
  for (const bx of [x0, x1 - ep]) {
    for (const s of [-1, 1]) {
      const by = s < 0 ? AXE_Y - ARBRE_R - 8 : AXE_Y + ARBRE_R;
      rect(ctx, bx, by, ep, 8, MINE, r);
      cercle(ctx, bx + ep / 2, by + 4, 2.4, MINE_FINE, r);
    }
  }
  // arbre visible dans la carcasse
  trait(ctx, x0, AXE_Y - ARBRE_R, x1, AXE_Y - ARBRE_R, MINE, r);
  trait(ctx, x0, AXE_Y + ARBRE_R, x1, AXE_Y + ARBRE_R, MINE, r);
  // déchirure de l'écorché (coin haut droit)
  polyligne(
    ctx,
    [1012, yH - 1, 1018, yH + 5, 1024, yH + 1, 1030, yH + 8, 1036, yH + 4, x1 + 1, yH + 12],
    MINE_FORTE,
    r,
  );

  // pôles du stator et bobines d'excitation
  for (const s of [-1, 1]) {
    const base = s < 0 ? yH + ep : yB - ep;
    const noyauY = s < 0 ? base : base - 13;
    coupeMetal(ctx, 940, noyauY, 35, 13, r);
    const semelleY = s < 0 ? base + 13 : base - 20;
    coupeMetal(ctx, 924, semelleY, 67, 7, r);
    bobine(ctx, 926, noyauY + (s < 0 ? 0 : 1), 13, 12, r);
    bobine(ctx, 976, noyauY + (s < 0 ? 0 : 1), 13, 12, r);
  }
  // rotor : contour et tôles (les encoches sont animées)
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(ROTOR_X0, AXE_Y - ROTOR_R, ROTOR_X1 - ROTOR_X0, 2 * ROTOR_R);
  for (let x = ROTOR_X0 + 4; x < ROTOR_X1; x += 4) {
    ligneDroite(ctx, x, AXE_Y - ROTOR_R + 1, x, AXE_Y + ROTOR_R - 1, GRAPHITE, 0.16, 0.7);
  }
  rect(ctx, ROTOR_X0, AXE_Y - ROTOR_R, ROTOR_X1 - ROTOR_X0, 2 * ROTOR_R, MINE, r);
  // collecteur
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(
    COLLECTEUR_X0,
    AXE_Y - COLLECTEUR_R,
    COLLECTEUR_X1 - COLLECTEUR_X0,
    2 * COLLECTEUR_R,
  );
  rect(
    ctx,
    COLLECTEUR_X0,
    AXE_Y - COLLECTEUR_R,
    COLLECTEUR_X1 - COLLECTEUR_X0,
    2 * COLLECTEUR_R,
    MINE,
    r,
  );
  // connexions rotor → collecteur
  for (const s of [-1, 1]) {
    trait(ctx, ROTOR_X1, AXE_Y + s * 14, COLLECTEUR_X0, AXE_Y + s * 9, MINE_FINE, r);
  }
  // balais et porte-balais (ressort)
  for (const s of [-1, 1]) {
    const yContact = AXE_Y + s * COLLECTEUR_R;
    const yBalai = s < 0 ? yContact - 13 : yContact;
    ctx.fillStyle = '#e4dfd0';
    ctx.fillRect(1008, yBalai, 12, 13);
    hachuresRect(ctx, 1008, yBalai, 12, 13, 0.3, 1.8, MINE_HACHURE, r);
    hachuresRect(ctx, 1008, yBalai, 12, 13, -1.2, 1.8, MINE_HACHURE, r);
    rect(ctx, 1008, yBalai, 12, 13, MINE, r);
    const yPorte = s < 0 ? yBalai - 12 : yBalai + 13;
    rect(ctx, 1005, yPorte, 18, 12, MINE_FINE, r);
    const pts: number[] = [];
    for (let k = 0; k <= 6; k++) pts.push(1014 + (k % 2 === 0 ? -4 : 4), yPorte + 1 + (k * 10) / 6);
    polyligne(ctx, pts, MINE_FINE, r);
  }
  // boîte à bornes
  coupeMetal(ctx, 950, yH - 12, 34, 12, r, MINE_HACHURE);
  cercle(ctx, 960, yH - 6, 2.4, MINE_FINE, r);
  cercle(ctx, 974, yH - 6, 2.4, MINE_FINE, r);

  // accouplement
  for (const fx of [1078, 1086]) coupeMetal(ctx, fx, AXE_Y - 18, 6, 36, r);
  // tronçon d'arbre de la jauge de torsion
  ctx.fillStyle = '#fefcf5';
  ctx.fillRect(ARBRE_X0, AXE_Y - ARBRE_R, ARBRE_X1 - ARBRE_X0, 2 * ARBRE_R);
  rect(ctx, ARBRE_X0, AXE_Y - ARBRE_R, ARBRE_X1 - ARBRE_X0, 2 * ARBRE_R, MINE, r);

  // tambour : joues et fût
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(TAMBOUR_X0, AXE_Y - TAMBOUR_R, TAMBOUR_X1 - TAMBOUR_X0, 2 * TAMBOUR_R);
  rect(ctx, TAMBOUR_X0, AXE_Y - TAMBOUR_R, TAMBOUR_X1 - TAMBOUR_X0, 2 * TAMBOUR_R, MINE, r);
  coupeMetal(ctx, TAMBOUR_X0 - 5, AXE_Y - TAMBOUR_R - 9, 5, 2 * TAMBOUR_R + 18, r);
  coupeMetal(ctx, TAMBOUR_X1, AXE_Y - TAMBOUR_R - 9, 5, 2 * TAMBOUR_R + 18, r);
  // palier du bout d'arbre
  coupeMetal(ctx, 1176, AXE_Y - 10, 8, 414 - (AXE_Y - 10), r);

  // repère de coupe A-A
  const xa = (ROTOR_X0 + ROTOR_X1) / 2;
  trait(ctx, xa, yH - 16, xa, yH - 4, MINE_FORTE, r);
  trait(ctx, xa, yB + 2, xa, yB + 10, MINE_FORTE, r);
  texte(ctx, 'A', xa - 10, yH - 6, TAILLE_TEXTE);
  texte(ctx, 'A', xa - 10, yB + 14, TAILLE_TEXTE);

  // légendes
  rappel(ctx, tr.t('pupitre.machine.legende.carcasse'), 884, 280, 896, 300, r);
  rappel(ctx, tr.t('pupitre.machine.legende.bornes'), 990, 276, 978, 282, r);
  rappel(ctx, tr.t('pupitre.machine.legende.balais'), 1046, 294, 1020, 312, r);
  rappel(ctx, tr.t('pupitre.machine.legende.tambour'), 1112, 294, 1130, 312, r);
  rappel(ctx, tr.t('pupitre.machine.legende.pole'), 874, 442, 932, 392, r);
  rappel(ctx, tr.t('pupitre.machine.legende.rotor'), 966, 442, 974, 370, r);
  rappel(ctx, tr.t('pupitre.machine.legende.collecteur'), 1004, 464, 1016, 360, r);
  rappel(ctx, tr.t('pupitre.machine.legende.arbre'), 1034, 442, 1062, 354, r);

  // --- coupe A-A -------------------------------------------------------------------------
  const cx = COUPE_X;
  const cy = COUPE_Y;
  hachures(
    ctx,
    (k) => {
      k.arc(cx, cy, COUPE_R_CARCASSE, 0, Math.PI * 2);
      k.arc(cx, cy, COUPE_R_CARCASSE_INT, Math.PI * 2, 0, true);
    },
    [cx - COUPE_R_CARCASSE, cy - COUPE_R_CARCASSE, 2 * COUPE_R_CARCASSE, 2 * COUPE_R_CARCASSE],
    Math.PI / 4,
    3.4,
    MINE_HACHURE,
    r,
    'evenodd',
  );
  cercle(ctx, cx, cy, COUPE_R_CARCASSE, MINE_FORTE, r);
  cercle(ctx, cx, cy, COUPE_R_CARCASSE_INT, MINE, r);
  for (const s of [-1, 1]) {
    // noyau du pôle
    const yN0 = cy + s * COUPE_R_CARCASSE_INT;
    const yN1 = cy + s * (COUPE_R_POLE + 6);
    const top = Math.min(yN0, yN1);
    coupeMetal(ctx, cx - 13, top, 26, Math.abs(yN1 - yN0), r);
    bobine(ctx, cx - 27, top + (s < 0 ? 2 : 0), 13, Math.abs(yN1 - yN0) - 2, r);
    bobine(ctx, cx + 14, top + (s < 0 ? 2 : 0), 13, Math.abs(yN1 - yN0) - 2, r);
    // épanouissement polaire
    const am = s < 0 ? -Math.PI / 2 : Math.PI / 2;
    hachures(
      ctx,
      (k) => {
        k.arc(cx, cy, COUPE_R_POLE + 6, am - 0.72, am + 0.72);
        k.arc(cx, cy, COUPE_R_POLE, am + 0.72, am - 0.72, true);
        k.closePath();
      },
      [cx - 60, cy - 60, 120, 120],
      Math.PI / 4,
      3.4,
      MINE_HACHURE,
      r,
    );
    arc(ctx, cx, cy, COUPE_R_POLE, am - 0.72, am + 0.72, MINE, r);
    arc(ctx, cx, cy, COUPE_R_POLE + 6, am - 0.72, am + 0.72, MINE, r);
    texte(ctx, s < 0 ? 'N' : 'S', cx + 38, cy + s * 50 + 5, TAILLE_TEXTE, 'center');
  }
  cercle(ctx, cx, cy, COUPE_R_ROTOR, MINE, r);
  const basCoupe = cy + COUPE_R_CARCASSE;
  texte(ctx, tr.t('pupitre.machine.coupe.titre'), cx, basCoupe + 20, TAILLE_TEXTE, 'center');
  texte(ctx, tr.t('pupitre.machine.coupe.rotor'), cx, basCoupe + 38, TAILLE_TEXTE, 'center');
  texte(ctx, tr.t('pupitre.machine.coupe.couple'), cx, basCoupe + 56, TAILLE_TEXTE, 'center');

  // --- règle de hauteur de la cabine -------------------------------------------------------
  // poulie de renvoi du câble
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.beginPath();
  ctx.arc(CABLE_X - 6, POULIE_Y, 6, 0, Math.PI * 2);
  ctx.fill();
  cercle(ctx, CABLE_X - 6, POULIE_Y, 6, MINE, r);
  cercle(ctx, CABLE_X - 6, POULIE_Y, 1.8, MINE_FINE, r);
  trait(ctx, CABLE_X - 6, POULIE_Y, CABLE_X + 14, POULIE_Y - 12, MINE, r);
  trait(ctx, CABLE_X + 14, POULIE_Y - 12, CABLE_X + 14, 422, MINE, r);
  trait(ctx, REGLE_X, REGLE_HAUT, REGLE_X, REGLE_BAS, MINE, r);
  for (let k = 0; k <= REGLE_MAX * 10; k++) {
    const h = k / 10;
    const y = yRegle(h);
    const l = k % 10 === 0 ? 8 : k % 5 === 0 ? 5 : 2.5;
    trait(ctx, REGLE_X - l, y, REGLE_X, y, k % 5 === 0 ? MINE : MINE_FINE, r);
    if (k % 10 === 0) {
      texte(
        ctx,
        tr.formatNumber(h, { maximumFractionDigits: 0 }),
        REGLE_X - 11,
        y + 5.5,
        TAILLE_TEXTE,
        'right',
        ENCRE,
        true,
      );
    }
  }
  const yr = yRegle(CONSIGNE);
  ctx.setLineDash([4, 3]);
  ligneDroite(ctx, REGLE_X, yr, 1184, yr, GRAPHITE, 0.85, 1.2);
  ctx.setLineDash([]);
  texte(ctx, 'r', REGLE_X + 4, yr + 15, TAILLE_TEXTE);
  const yp = yRegle(HAUTEUR_POUTRE);
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(CABLE_X + 13, yp - 6, BORD_DROIT_X - CABLE_X - 13, 6);
  hachuresRect(ctx, CABLE_X + 13, yp - 6, BORD_DROIT_X - CABLE_X - 13, 6, 0.8, 2.2, MINE, r);
  rect(ctx, CABLE_X + 13, yp - 6, BORD_DROIT_X - CABLE_X - 13, 6, MINE_FORTE, r);
  hachuresRect(ctx, REGLE_X + 2, yp - 6, CABLE_X - 15 - REGLE_X, 6, 0.8, 2.2, MINE, r);
  rect(ctx, REGLE_X + 2, yp - 6, CABLE_X - 15 - REGLE_X, 6, MINE_FORTE, r);
  texte(ctx, tr.t('pupitre.machine.poutre'), REGLE_X - 12, yp + 5, TAILLE_TEXTE, 'right');
  // sol
  hachuresRect(ctx, REGLE_X + 2, REGLE_BAS, BORD_DROIT_X - REGLE_X - 2, 6, 0.8, 3, MINE_HACHURE, r);
  trait(ctx, REGLE_X + 2, REGLE_BAS, BORD_DROIT_X, REGLE_BAS, MINE, r);
}

// --- Jauge de force ---------------------------------------------------------------------------

function jaugeFond(
  ctx: CanvasRenderingContext2D,
  p: Readonly<Plaque>,
  tr: Translator,
  r: Alea,
): void {
  plaque(ctx, p.x, p.y, p.w, p.h, r, false);
  const g = geometrieJauge(p);
  texte(ctx, tr.t('pupitre.machine.jauge.titre'), p.x + p.w / 2, p.y + 28, 18, 'center');

  // légende : appliquée (hachures) et demandée (contour rouge en tirets)
  hachuresRect(ctx, p.x + 12, p.y + 46, 14, 14, Math.PI / 4, 2.2, MINE, r);
  rect(ctx, p.x + 12, p.y + 46, 14, 14, MINE_FINE, r);
  texte(ctx, tr.t('pupitre.machine.jauge.appliquee'), p.x + 34, p.y + 59, TAILLE_TEXTE);
  ctx.setLineDash([3, 2]);
  ctx.strokeStyle = ROUGE;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(p.x + 12, p.y + 78, 14, 14);
  ctx.setLineDash([]);
  texte(ctx, tr.t('pupitre.machine.jauge.demandee'), p.x + 34, p.y + 91, TAILLE_TEXTE);

  ctx.fillStyle = '#fefcf5';
  ctx.fillRect(g.x0, g.haut, g.x1 - g.x0, g.bas - g.haut);
  // zones hors moteur : au-delà de +Umax et de −Umax
  const yPlus = yJauge(g, FORCE_MAX);
  const yMoins = yJauge(g, -FORCE_MAX);
  hachuresRect(ctx, g.x0, g.haut, g.x1 - g.x0, yPlus - g.haut, -0.6, 5, MINE_ROUGE_HACHURE, r);
  hachuresRect(ctx, g.x0, yMoins, g.x1 - g.x0, g.bas - yMoins, -0.6, 5, MINE_ROUGE_HACHURE, r);
  rect(ctx, g.x0, g.haut, g.x1 - g.x0, g.bas - g.haut, MINE_FORTE, r);
  for (let n = JAUGE_MIN; n <= JAUGE_MAX; n += JAUGE_TRAIT) {
    const y = yJauge(g, n);
    const majeur = n % JAUGE_CHIFFRE === 0;
    trait(ctx, g.x0 - (majeur ? 8 : 4), y, g.x0, y, majeur ? MINE : MINE_FINE, r);
    if (majeur && Math.abs(n) !== FORCE_MAX) {
      texte(ctx, texteForce(tr, n), g.x0 - 11, y + 5.5, TAILLE_TEXTE, 'right', ENCRE_DOUCE, true);
    }
  }
  // ±Umax : traits rouges, valeurs en rouge
  for (const [y, n] of [
    [yPlus, FORCE_MAX],
    [yMoins, -FORCE_MAX],
  ] as const) {
    trait(ctx, g.x0 - 10, y, g.x1 + 4, y, { ...MINE_ROUGE, largeur: 2 }, r);
    texte(ctx, texteForce(tr, n), g.x0 - 11, y + 5.5, TAILLE_TEXTE, 'right', ROUGE_TEXTE, true);
  }
  texte(ctx, SYMBOLE_UMAX, g.x1 + 14, yPlus + 5.5, TAILLE_TEXTE, 'left', ROUGE_TEXTE);
  texte(ctx, `−${SYMBOLE_UMAX}`, g.x1 + 14, yMoins + 5.5, TAILLE_TEXTE, 'left', ROUGE_TEXTE);
  texte(
    ctx,
    tr.t('pupitre.machine.jauge.ecrete'),
    g.x1 + 14,
    g.haut + 62,
    TAILLE_TEXTE,
    'left',
    ROUGE_TEXTE,
  );
  texte(
    ctx,
    tr.t('pupitre.machine.jauge.audela'),
    g.x1 + 14,
    g.haut + 80,
    TAILLE_TEXTE,
    'left',
    ROUGE_TEXTE,
  );
}
