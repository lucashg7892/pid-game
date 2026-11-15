/**
 * Maquette A (lot B, v0.3, jetable) : couche FIXE du pupitre, redessinée seulement au chargement
 * d'un trajet, au redimensionnement et à l'arrivée de la police. Plaques rivetées, cadrans, cadres
 * des enregistreurs, moteur en écorché (pièces immobiles), jauge, câblage, grain du graphite.
 */
import type { TrajetReference } from '../common/types';
import {
  GRAPHITE,
  GRILLE_FINE,
  GRILLE_FORTE,
  MINE,
  MINE_FINE,
  MINE_FORTE,
  MINE_HACHURE,
  MINE_ROUGE,
  MINE_ROUGE_HACHURE,
  PAPIER_CLAIR,
  ROUGE,
  alea,
  arc,
  cercle,
  fr,
  frEntier,
  grain,
  hachures,
  hachuresRect,
  plaque,
  polyligne,
  rect,
  rivet,
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
  CABLE_X,
  CADRANS,
  CADRAN_A0,
  CADRAN_OUVERTURE,
  CHRONO_R,
  CHRONO_TOUR,
  CHRONO_X,
  CHRONO_Y,
  COLLECTEUR_R,
  COLLECTEUR_X0,
  COLLECTEUR_X1,
  COUPE_R_CARCASSE,
  COUPE_R_CARCASSE_INT,
  COUPE_R_POLE,
  COUPE_R_ROTOR,
  COUPE_X,
  COUPE_Y,
  ECHELLE_A,
  ECHELLE_E,
  ECHELLE_V,
  ENREG_H,
  ENREG_PAS,
  ENREG_W,
  ENREG_X,
  ENREG_Y0,
  ENTETE_TITRE,
  ENTETE_TRAJET,
  ENTETE_VOYANTS,
  FENTE_BAS,
  FENTE_HAUT,
  GAIN_MAX,
  HAUTEUR,
  JAUGE_BAS,
  JAUGE_HAUT,
  JAUGE_X0,
  JAUGE_X1,
  LARGEUR,
  LEVIER_BAS,
  LEVIER_HAUT,
  LEVIER_KI_X,
  LEVIER_KP_X,
  PANNEAU_CADRANS,
  PANNEAU_CHRONO,
  PANNEAU_GAINS,
  PANNEAU_JAUGE,
  PANNEAU_MOTEUR,
  PAPIER_BAS,
  PAPIER_HAUT,
  PAPIER_X0,
  PAPIER_X1,
  PLUME_X,
  POULIE_Y,
  REGLE_BAS,
  REGLE_HAUT,
  REGLE_X,
  ROTOR_R,
  ROTOR_X0,
  ROTOR_X1,
  TAMBOUR_R,
  TAMBOUR_X0,
  TAMBOUR_X1,
  TRACE_BAS,
  TRACE_HAUT,
  VOYANTS,
  VOYANT_Y,
  angleCadran,
  echelleForce,
  yGain,
  yJauge,
  yRegle,
  yTrace,
  type Echelle,
} from './plan';

/** Libellés des issues (affichés au joueur dans la maquette). */
export const NOM_ISSUE: Readonly<Record<TrajetReference['issue'], string>> = {
  win: 'VICTOIRE',
  bonk: 'CHOC !',
  noLift: 'PAS DÉCOLLÉ',
  step: 'ARRÊT TROP BAS',
  slow: 'TROP LENT',
};

/** Nom court des trajets de référence. */
const NOM_TRAJET: Readonly<Record<TrajetReference['id'], string>> = {
  victoire: 'Victoire',
  choc: 'Choc contre la poutre',
  saturation: 'Saturation prolongée',
};

/** Dessine toute la couche fixe (la planche est en unités de 1280 × 720). */
export function dessinerFond(ctx: CanvasRenderingContext2D, trajet: TrajetReference): void {
  ctx.clearRect(0, 0, LARGEUR, HAUTEUR);
  const r = alea(1952);
  cablage(ctx, r);
  entete(ctx, trajet, r);
  panneauGains(ctx, trajet, r);
  panneauChrono(ctx, trajet, r);
  enregistreurs(ctx, trajet, r);
  cadrans(ctx, r);
  moteur(ctx, trajet, r);
  jauge(ctx, r);
  grain(ctx, LARGEUR * 2, HAUTEUR * 2, 0.22);
}

// --- Câblage dans les gouttières --------------------------------------------------------------

function cable(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, r: Alea): void {
  const pts: number[] = [];
  const amp = 1.2 + r() * 1.5;
  const ph = r() * 6;
  for (let y = y0; y <= y1; y += 12) {
    pts.push(x + amp * Math.sin(y / 37 + ph), y);
  }
  ctx.save();
  ctx.globalAlpha = 0.7;
  polyligne(ctx, pts, MINE_FINE, r);
  ctx.restore();
}

function cablage(ctx: CanvasRenderingContext2D, r: Alea): void {
  for (const x of [320, 323.5]) cable(ctx, x, 62, 712, r);
  for (const x of [864, 867.5]) cable(ctx, x, 62, 712, r);
  for (const y of [62, 64.5]) {
    const pts: number[] = [];
    for (let x = 12; x <= 1268; x += 14) pts.push(x, y + Math.sin(x / 41 + y) * 0.8);
    polyligne(ctx, pts, MINE_FINE, r);
  }
  // colliers de serrage
  for (const y of [150, 300, 450, 600]) {
    rect(ctx, 318, y, 8, 5, MINE_FINE, r);
    rect(ctx, 862, y + 40, 8, 5, MINE_FINE, r);
  }
  for (const x of [200, 640, 1080]) rect(ctx, x, 60.5, 6, 6, MINE_FINE, r);
}

// --- En-tête ----------------------------------------------------------------------------------

function entete(ctx: CanvasRenderingContext2D, trajet: TrajetReference, r: Alea): void {
  const t = ENTETE_TITRE;
  plaque(ctx, t.x, t.y, t.w, t.h, r);
  texte(ctx, 'SALLE DE COMMANDE DU TREUIL', t.x + 22, t.y + 30, 25);
  texte(
    ctx,
    'Huygens & Cie · pupitre analogique, modèle 1952 · rejeu du trajet de référence',
    t.x + 22,
    t.y + 46,
    13,
  );
  const p = ENTETE_TRAJET;
  plaque(ctx, p.x, p.y, p.w, p.h, r);
  texte(ctx, `TRAJET : ${NOM_TRAJET[trajet.id]}`, p.x + 20, p.y + 26, 19);
  const niveau =
    trajet.niveau === 'level2'
      ? `niveau 2, régulateur PI · Kp ${frEntier(trajet.kp)} · Ki ${frEntier(trajet.ki)}`
      : `niveau 1, régulateur P · Kp ${frEntier(trajet.kp)}`;
  texte(
    ctx,
    `${niveau} · consigne ${fr(trajet.physique.r, 1)} m · m = ${String(trajet.physique.m)} kg`,
    p.x + 20,
    p.y + 44,
    13,
  );
  const v = ENTETE_VOYANTS;
  plaque(ctx, v.x, v.y, v.w, v.h, r);
  for (const voy of VOYANTS) {
    lampeEteinte(ctx, voy.x, VOYANT_Y, 10, r);
    texte(ctx, voy.libelle, voy.x + 23, VOYANT_Y + 6, 15);
  }
}

/** Voyant éteint : douille, verre, reflet. */
export function lampeEteinte(
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

// --- Réglage des gains ------------------------------------------------------------------------

function plaqueLevier(
  ctx: CanvasRenderingContext2D,
  cx: number,
  nom: string,
  unite: string,
  actif: boolean,
  r: Alea,
): void {
  const x = cx - 58;
  const w = 116;
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(x, LEVIER_HAUT, w, LEVIER_BAS - LEVIER_HAUT);
  rect(ctx, x, LEVIER_HAUT, w, LEVIER_BAS - LEVIER_HAUT, MINE, r);
  rivet(ctx, x + 6, LEVIER_HAUT + 6, r);
  rivet(ctx, x + w - 6, LEVIER_HAUT + 6, r);
  rivet(ctx, x + 6, LEVIER_BAS - 6, r);
  rivet(ctx, x + w - 6, LEVIER_BAS - 6, r);
  // fente
  const fx = cx + 6;
  ctx.fillStyle = '#d9d3c2';
  ctx.fillRect(fx - 4, FENTE_HAUT - 6, 8, FENTE_BAS - FENTE_HAUT + 12);
  rect(ctx, fx - 4, FENTE_HAUT - 6, 8, FENTE_BAS - FENTE_HAUT + 12, MINE, r);
  hachuresRect(
    ctx,
    fx - 4,
    FENTE_HAUT - 6,
    8,
    FENTE_BAS - FENTE_HAUT + 12,
    1.2,
    3,
    MINE_HACHURE,
    r,
  );
  // graduations
  for (let g = 0; g <= GAIN_MAX; g += 500) {
    const y = yGain(g);
    const majeur = g % 1000 === 0;
    trait(ctx, fx - 10 - (majeur ? 8 : 4), y, fx - 9, y, majeur ? MINE : MINE_FINE, r);
    if (g % 2000 === 0) texte(ctx, frEntier(g), fx - 22, y + 4.5, 13, 'right');
  }
  trait(ctx, fx - 9, FENTE_HAUT, fx - 9, FENTE_BAS, MINE_FINE, r);
  texte(ctx, nom, cx - 24, LEVIER_BAS + 19, 21, 'left');
  texte(ctx, unite, cx + 2, LEVIER_BAS + 19, 13, 'left');
  if (!actif) {
    hachuresRect(
      ctx,
      x + 3,
      LEVIER_HAUT + 3,
      w - 6,
      LEVIER_BAS - LEVIER_HAUT - 6,
      0.7,
      6,
      MINE_HACHURE,
      r,
    );
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.fillRect(x + 8, 206, w - 16, 52);
    rect(ctx, x + 8, 206, w - 16, 52, MINE_ROUGE, r);
    texte(ctx, 'HORS SERVICE', cx, 228, 16, 'center', ROUGE);
    texte(ctx, 'niveau 1 :', cx, 243, 13, 'center');
    texte(ctx, 'régulateur P seul', cx, 255, 13, 'center');
  }
}

function panneauGains(ctx: CanvasRenderingContext2D, trajet: TrajetReference, r: Alea): void {
  const p = PANNEAU_GAINS;
  plaque(ctx, p.x, p.y, p.w, p.h, r);
  texte(ctx, 'RÉGLAGE DES GAINS', p.x + p.w / 2, p.y + 25, 20, 'center');
  plaqueLevier(ctx, LEVIER_KP_X, 'Kp', '(N/m)', true, r);
  plaqueLevier(ctx, LEVIER_KI_X, 'Ki', '(N/(m·s))', trajet.niveau === 'level2', r);
}

// --- Chronomètre et issue ---------------------------------------------------------------------

function panneauChrono(ctx: CanvasRenderingContext2D, trajet: TrajetReference, r: Alea): void {
  const p = PANNEAU_CHRONO;
  plaque(ctx, p.x, p.y, p.w, p.h, r);
  // boîtier du chronographe
  rect(ctx, CHRONO_X - 6, CHRONO_Y - CHRONO_R - 15, 12, 8, MINE, r);
  hachuresRect(ctx, CHRONO_X - 6, CHRONO_Y - CHRONO_R - 15, 12, 8, 1.57, 2, MINE_HACHURE, r);
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.beginPath();
  ctx.arc(CHRONO_X, CHRONO_Y, CHRONO_R + 6, 0, Math.PI * 2);
  ctx.fill();
  cercle(ctx, CHRONO_X, CHRONO_Y, CHRONO_R + 6, MINE_FORTE, r);
  cercle(ctx, CHRONO_X, CHRONO_Y, CHRONO_R, MINE, r);
  for (let k = 0; k < CHRONO_TOUR * 10; k++) {
    const a = -Math.PI / 2 + (k / (CHRONO_TOUR * 10)) * Math.PI * 2;
    const l = k % 10 === 0 ? 10 : k % 5 === 0 ? 7 : 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    trait(
      ctx,
      CHRONO_X + c * (CHRONO_R - 2),
      CHRONO_Y + s * (CHRONO_R - 2),
      CHRONO_X + c * (CHRONO_R - 2 - l),
      CHRONO_Y + s * (CHRONO_R - 2 - l),
      k % 5 === 0 ? MINE : MINE_FINE,
      r,
    );
    if (k % 10 === 0) {
      texte(
        ctx,
        String(k / 10),
        CHRONO_X + c * (CHRONO_R - 20),
        CHRONO_Y + s * (CHRONO_R - 20) + 5,
        15,
        'center',
      );
    }
  }
  // repère de la durée du trajet
  const aFin =
    -Math.PI / 2 + (trajet.echantillons.length - 1) * trajet.dt * ((Math.PI * 2) / CHRONO_TOUR);
  arc(ctx, CHRONO_X, CHRONO_Y, CHRONO_R + 2, -Math.PI / 2, aFin, MINE_FINE, r);
  texte(ctx, 'secondes', CHRONO_X, CHRONO_Y + 24, 12, 'center');

  const x = 158;
  texte(ctx, 'TEMPS DE TRAJET', x, 490, 14);
  const duree = (trajet.echantillons.length - 1) * trajet.dt;
  texte(ctx, `durée du rejeu : ${fr(duree, 2)} s`, x, 538, 13);
  lampeEteinte(ctx, x + 12, 612, 10, r);
  texte(ctx, 'ISSUE', x + 30, 598, 13);
  // aide clavier
  trait(ctx, p.x + 12, 652, p.x + p.w - 12, 652, MINE_FINE, r);
  texte(ctx, '↑ ↓ ou + − : gain ±100 · PgPréc / PgSuiv : ±1000', p.x + 14, 668, 13);
  texte(ctx, 'Tab : levier ou champ suivant · Entrée : LANCER', p.x + 14, 683, 13);
  texte(ctx, 'Coque : touches 1 2 3 trajets · P pause · R rejouer', p.x + 14, 698, 13);
}

// --- Enregistreurs ----------------------------------------------------------------------------

/** Titres et échelles des cinq enregistreurs pour un trajet. */
export function definitionsEnregistreurs(
  trajet: TrajetReference,
): readonly { readonly titre: string; readonly echelle: Echelle }[] {
  const f = echelleForce(trajet.niveau);
  return [
    { titre: 'ENR. 1 · ERREUR  e = r − y  (m)', echelle: ECHELLE_E },
    { titre: 'ENR. 2 · COMMANDE  u  (kN)', echelle: f },
    {
      titre:
        trajet.niveau === 'level2' ? 'ENR. 3 · TERMES  P  et  I  (kN)' : 'ENR. 3 · TERME  P  (kN)',
      echelle: f,
    },
    { titre: 'ENR. 4 · VITESSE  v  (m/s)', echelle: ECHELLE_V },
    { titre: 'ENR. 5 · ACCÉLÉRATION  a  (m/s²)', echelle: ECHELLE_A },
  ];
}

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

function enregistreurs(ctx: CanvasRenderingContext2D, trajet: TrajetReference, r: Alea): void {
  const defs = definitionsEnregistreurs(trajet);
  const ph = trajet.physique;
  defs.forEach((def, k) => {
    const y0 = ENREG_Y0 + k * ENREG_PAS;
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(ENREG_X, y0, ENREG_W, ENREG_H);
    ctx.globalAlpha = 1;
    rect(ctx, ENREG_X, y0, ENREG_W, ENREG_H, MINE_FORTE, r);
    rivet(ctx, ENREG_X + 6, y0 + 6, r);
    rivet(ctx, ENREG_X + ENREG_W - 6, y0 + 6, r);
    rivet(ctx, ENREG_X + 6, y0 + ENREG_H - 6, r);
    rivet(ctx, ENREG_X + ENREG_W - 6, y0 + ENREG_H - 6, r);
    texte(ctx, def.titre, ENREG_X + 14, y0 + 15, 14);
    // papier
    const py0 = y0 + PAPIER_HAUT;
    const ph0 = PAPIER_BAS - PAPIER_HAUT;
    ctx.fillStyle = '#fefcf5';
    ctx.fillRect(PAPIER_X0, py0, PAPIER_X1 - PAPIER_X0, ph0);
    rect(ctx, PAPIER_X0, py0, PAPIER_X1 - PAPIER_X0, ph0, MINE_FINE, r);
    const e = def.echelle;
    for (let v = e.min; v <= e.max + 1e-9; v += e.pas / 2) {
      const y = yTrace(y0, e, v);
      const majeur = Math.abs(v / e.pas - Math.round(v / e.pas)) < 1e-6;
      ligneDroite(
        ctx,
        PAPIER_X0,
        y,
        PAPIER_X1,
        y,
        majeur ? GRILLE_FORTE : GRILLE_FINE,
        majeur ? 0.4 : 0.3,
        0.8,
      );
      trait(ctx, PAPIER_X0 - 5, y, PAPIER_X0 - (majeur ? 1 : 3), y, MINE_FINE, r);
    }
    for (const v of e.etiquettes) {
      texte(ctx, fr(v, 0), PAPIER_X0 - 8, yTrace(y0, e, v) + 4.5, 13, 'right');
    }
    if (e.min < 0)
      ligneDroite(ctx, PAPIER_X0, yTrace(y0, e, 0), PAPIER_X1, yTrace(y0, e, 0), GRAPHITE, 0.55, 1);
    // rouleaux : réception à gauche, réserve à droite
    for (const rx of [PAPIER_X0 - 3, PAPIER_X1 + 3]) {
      ctx.fillStyle = PAPIER_CLAIR;
      ctx.fillRect(rx - 3, py0 - 3, 6, ph0 + 6);
      rect(ctx, rx - 3, py0 - 3, 6, ph0 + 6, MINE, r);
      hachuresRect(ctx, rx - 3, py0 - 3, 6, ph0 + 6, 1.4, 2.6, MINE_HACHURE, r);
    }
    // rail des plumes
    trait(ctx, PLUME_X + 13, y0 + TRACE_HAUT - 6, PLUME_X + 13, y0 + TRACE_BAS + 6, MINE_FINE, r);
    trait(ctx, PLUME_X + 16, y0 + TRACE_HAUT - 6, PLUME_X + 16, y0 + TRACE_BAS + 6, MINE_FINE, r);
    vis(ctx, PLUME_X + 14.5, y0 + TRACE_HAUT - 9, 3, r);
    vis(ctx, PLUME_X + 14.5, y0 + TRACE_BAS + 9, 3, r);
    // repères propres à chaque enregistreur
    if (k === 0) {
      const tol = ph.toleranceArrivee;
      ctx.setLineDash([2, 3]);
      ligneDroite(
        ctx,
        PAPIER_X0,
        yTrace(y0, e, tol),
        PAPIER_X1,
        yTrace(y0, e, tol),
        GRAPHITE,
        0.6,
        1,
      );
      ligneDroite(
        ctx,
        PAPIER_X0,
        yTrace(y0, e, -tol),
        PAPIER_X1,
        yTrace(y0, e, -tol),
        GRAPHITE,
        0.6,
        1,
      );
      ctx.setLineDash([]);
      texte(ctx, 'tolérance ±' + fr(tol, 1) + ' m', PAPIER_X0 + 4, yTrace(y0, e, 0) + 15, 12);
    }
    if (k === 1 || k === 2) {
      const umax = ph.uMax / 1000;
      const yU = yTrace(y0, e, umax);
      hachuresRect(
        ctx,
        PAPIER_X0,
        y0 + TRACE_HAUT - 2,
        PAPIER_X1 - PAPIER_X0,
        yU - (y0 + TRACE_HAUT - 2),
        0.5,
        7,
        MINE_ROUGE_HACHURE,
        r,
      );
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#fefcf5';
      ctx.fillRect(
        PAPIER_X0,
        y0 + TRACE_HAUT - 2,
        PAPIER_X1 - PAPIER_X0,
        yU - (y0 + TRACE_HAUT - 2),
      );
      ctx.restore();
      trait(ctx, PAPIER_X0, yU, PAPIER_X1, yU, MINE_ROUGE, r);
      texte(ctx, 'Umax', PAPIER_X1 - 4, yU - 3, 12, 'right', ROUGE);
      if (k === 1) {
        const yP = yTrace(y0, e, (ph.m * ph.g) / 1000);
        ctx.setLineDash([1.5, 3]);
        ligneDroite(ctx, PAPIER_X0, yP, PAPIER_X1, yP, GRAPHITE, 0.7, 1);
        ctx.setLineDash([]);
        texte(ctx, 'm·g', PAPIER_X1 - 4, yP - 3, 12, 'right');
      }
    }
  });
}

// --- Cadrans ----------------------------------------------------------------------------------

function cadrans(ctx: CanvasRenderingContext2D, r: Alea): void {
  const p = PANNEAU_CADRANS;
  plaque(ctx, p.x, p.y, p.w, p.h, r, false);
  for (const c of CADRANS) {
    const { cx, cy, rayon } = c;
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.beginPath();
    ctx.arc(cx, cy, rayon + 6, 0, Math.PI * 2);
    ctx.fill();
    // lunette moletée
    cercle(ctx, cx, cy, rayon + 6, MINE_FORTE, r);
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      trait(
        ctx,
        cx + Math.cos(a) * (rayon + 3.5),
        cy + Math.sin(a) * (rayon + 3.5),
        cx + Math.cos(a) * (rayon + 6),
        cy + Math.sin(a) * (rayon + 6),
        MINE_HACHURE,
        r,
      );
    }
    cercle(ctx, cx, cy, rayon, MINE, r);
    // zone rouge
    if (c.rouge !== null && c.rouge < c.max) {
      const a0 = angleCadran(c, c.rouge);
      const a1 = angleCadran(c, c.max);
      hachures(
        ctx,
        (k) => {
          k.arc(cx, cy, rayon - 2, a0, a1);
          k.arc(cx, cy, rayon - 12, a1, a0, true);
          k.closePath();
        },
        [cx - rayon, cy - rayon, rayon * 2, rayon * 2],
        0.8,
        2.6,
        MINE_ROUGE_HACHURE,
        r,
      );
      arc(ctx, cx, cy, rayon - 12, a0, a1, MINE_ROUGE, r);
    }
    // graduations
    const n = Math.round((c.max - c.min) / c.pas);
    for (let k = 0; k <= n; k++) {
      const v = c.min + k * c.pas;
      const a = angleCadran(c, v);
      const majeur = c.etiquettes.some((e) => Math.abs(e - v) < 1e-6);
      const l = majeur ? 9 : 5;
      const rouge = c.rouge !== null && v >= c.rouge - 1e-6;
      trait(
        ctx,
        cx + Math.cos(a) * (rayon - 2),
        cy + Math.sin(a) * (rayon - 2),
        cx + Math.cos(a) * (rayon - 2 - l),
        cy + Math.sin(a) * (rayon - 2 - l),
        rouge ? MINE_ROUGE : majeur ? MINE : MINE_FINE,
        r,
      );
      if (majeur) {
        texte(
          ctx,
          fr(v, 0),
          cx + Math.cos(a) * (rayon - 20),
          cy + Math.sin(a) * (rayon - 20) + 4.5,
          13,
          'center',
          rouge ? ROUGE : undefined,
        );
      }
    }
    // butée de l'aiguille
    const ab = CADRAN_A0 + CADRAN_OUVERTURE + 0.06;
    cercle(ctx, cx + Math.cos(ab) * (rayon - 8), cy + Math.sin(ab) * (rayon - 8), 2.2, MINE, r);
    // fenêtre de lecture
    ctx.fillStyle = '#fefcf5';
    ctx.fillRect(cx - 32, cy + 16, 64, 19);
    rect(ctx, cx - 32, cy + 16, 64, 19, MINE_FINE, r);
    texte(ctx, c.titre, cx, cy + rayon + 23, 14, 'center');
  }
}

// --- Moteur en écorché -------------------------------------------------------------------------

function rappel(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  cibleX: number,
  cibleY: number,
  r: Alea,
): void {
  texte(ctx, s, x, y, 13);
  const w = ctx.measureText(s).width;
  const dx = Math.min(Math.max(cibleX, x + 4), x + w - 4);
  const dy = cibleY < y ? y - 13 : y + 3;
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

function moteur(ctx: CanvasRenderingContext2D, trajet: TrajetReference, r: Alea): void {
  const p = PANNEAU_MOTEUR;
  plaque(ctx, p.x, p.y, p.w, p.h, r);
  texte(ctx, 'MOTEUR DU TREUIL · ÉCORCHÉ', p.x + 16, p.y + 22, 16);

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
  for (const px of [896, 1006]) {
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.fillRect(px, yB, 22, 414 - yB);
    rect(ctx, px, yB, 22, 414 - yB, MINE, r);
    vis(ctx, px + 11, yB + 5, 2.6, r);
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
  texte(ctx, 'A', xa - 9, yH - 6, 13);
  texte(ctx, 'A', xa - 9, yB + 11, 13);

  // rappels (légendes)
  rappel(ctx, 'carcasse', 884, 276, 896, 300, r);
  rappel(ctx, 'bornes', 1000, 272, 978, 282, r);
  rappel(ctx, 'balais', 1046, 290, 1020, 312, r);
  rappel(ctx, 'tambour', 1112, 290, 1130, 312, r);
  rappel(ctx, 'pôle + bobine', 880, 440, 932, 392, r);
  rappel(ctx, 'rotor', 966, 440, 974, 370, r);
  rappel(ctx, 'collecteur', 1000, 440, 1016, 360, r);
  rappel(ctx, 'arbre : torsion', 1052, 456, 1062, 354, r);

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
    texte(ctx, s < 0 ? 'N' : 'S', cx + 36, cy + s * 50 + 5, 13, 'center');
  }
  cercle(ctx, cx, cy, COUPE_R_ROTOR, MINE, r);
  texte(ctx, 'COUPE A-A · rotor animé', cx, cy + COUPE_R_CARCASSE + 20, 13, 'center');
  texte(ctx, 'flèches : couple ∝ force', cx, cy + COUPE_R_CARCASSE + 34, 12, 'center');

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
  for (let k = 0; k <= 35; k++) {
    const h = k / 10;
    const y = yRegle(h);
    const l = k % 10 === 0 ? 8 : k % 5 === 0 ? 5 : 2.5;
    trait(ctx, REGLE_X - l, y, REGLE_X, y, k % 5 === 0 ? MINE : MINE_FINE, r);
    if (k % 10 === 0) texte(ctx, String(k / 10), REGLE_X - 11, y + 4.5, 13, 'right');
  }
  const ph = trajet.physique;
  const yr = yRegle(ph.r);
  ctx.setLineDash([4, 3]);
  ligneDroite(ctx, REGLE_X, yr, 1184, yr, GRAPHITE, 0.85, 1.2);
  ctx.setLineDash([]);
  texte(ctx, 'r', REGLE_X + 4, yr + 13, 13);
  const yp = yRegle(ph.hauteurPoutre);
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(CABLE_X + 13, yp - 6, 1184 - CABLE_X - 13, 6);
  hachuresRect(ctx, CABLE_X + 13, yp - 6, 1184 - CABLE_X - 13, 6, 0.8, 2.2, MINE, r);
  rect(ctx, CABLE_X + 13, yp - 6, 1184 - CABLE_X - 13, 6, MINE_FORTE, r);
  hachuresRect(ctx, REGLE_X + 2, yp - 6, CABLE_X - 15 - REGLE_X, 6, 0.8, 2.2, MINE, r);
  rect(ctx, REGLE_X + 2, yp - 6, CABLE_X - 15 - REGLE_X, 6, MINE_FORTE, r);
  texte(ctx, 'poutre', REGLE_X - 12, yp + 4, 12, 'right');
  // sol
  hachuresRect(ctx, REGLE_X + 2, REGLE_BAS, 1184 - REGLE_X - 2, 6, 0.8, 3, MINE_HACHURE, r);
  trait(ctx, REGLE_X + 2, REGLE_BAS, 1184, REGLE_BAS, MINE, r);
}

// --- Jauge de force ---------------------------------------------------------------------------

function jauge(ctx: CanvasRenderingContext2D, r: Alea): void {
  const p = PANNEAU_JAUGE;
  plaque(ctx, p.x, p.y, p.w, p.h, r, false);
  const cx = p.x + p.w / 2;
  texte(ctx, 'JAUGE DE', cx, p.y + 21, 14, 'center');
  texte(ctx, 'FORCE (kN)', cx, p.y + 36, 14, 'center');
  // légende
  hachuresRect(ctx, p.x + 8, p.y + 46, 10, 10, Math.PI / 4, 2.2, MINE, r);
  rect(ctx, p.x + 8, p.y + 46, 10, 10, MINE_FINE, r);
  texte(ctx, 'appliquée', p.x + 22, p.y + 56, 12);
  ctx.setLineDash([3, 2]);
  ctx.strokeStyle = ROUGE;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(p.x + 8, p.y + 62, 10, 10);
  ctx.setLineDash([]);
  texte(ctx, 'demandée', p.x + 22, p.y + 72, 12);

  ctx.fillStyle = '#fefcf5';
  ctx.fillRect(JAUGE_X0, JAUGE_HAUT, JAUGE_X1 - JAUGE_X0, JAUGE_BAS - JAUGE_HAUT);
  // zone hors moteur (au-dessus de 5 kN)
  const y5 = yJauge(5);
  hachuresRect(
    ctx,
    JAUGE_X0,
    JAUGE_HAUT,
    JAUGE_X1 - JAUGE_X0,
    y5 - JAUGE_HAUT,
    -0.6,
    5,
    MINE_ROUGE_HACHURE,
    r,
  );
  rect(ctx, JAUGE_X0, JAUGE_HAUT, JAUGE_X1 - JAUGE_X0, JAUGE_BAS - JAUGE_HAUT, MINE_FORTE, r);
  for (let k = -2; k <= 16; k++) {
    const y = yJauge(k);
    const majeur = k % 5 === 0;
    trait(ctx, JAUGE_X0 - (majeur ? 7 : 4), y, JAUGE_X0, y, majeur ? MINE : MINE_FINE, r);
    if (majeur && k !== 5) texte(ctx, String(k), JAUGE_X0 - 9, y + 4.5, 13, 'right');
  }
  texte(ctx, '−2', JAUGE_X0 - 9, yJauge(-2) + 4.5, 12, 'right');
  trait(ctx, p.x + 6, y5, JAUGE_X1 + 2, y5, { ...MINE_ROUGE, largeur: 2 }, r);
  texte(ctx, 'Umax', p.x + 8, y5 - 4, 12, 'left', ROUGE);
  texte(ctx, '5', JAUGE_X0 - 9, y5 + 13, 13, 'right', ROUGE);
  texte(ctx, 'écrêté', JAUGE_X0 - 9, JAUGE_HAUT + 50, 12, 'right', ROUGE);
  texte(ctx, 'au-delà', JAUGE_X0 - 9, JAUGE_HAUT + 64, 12, 'right', ROUGE);
  lampeEteinte(ctx, p.x + 56, 694, 6, r);
  texte(ctx, 'SAT', p.x + 44, 699, 13, 'right');
}
