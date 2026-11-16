/**
 * Colonne de la machine (T-050), couche VIVE : voyants allumés, rotor et tambour qui tournent (angle
 * donné par la hauteur de la cabine), câble, cabine, coupe A-A animée, étincelles et rouge en
 * saturation, jauge de force (force appliquée et force demandée). Redessinée à chaque image d'après
 * un {@link EtatMachine} ; aucune allocation par image (tracés directs, sans tremblé aléatoire,
 * textes mis en cache par {@link TextesMachine}). Dessin repris de la maquette A du lot B (v0.3).
 */
import type { Translator } from '../../i18n';
import {
  ENCRE,
  GRAPHITE,
  PAPIER_CLAIR,
  POLICE,
  POLICE_NOMBRES,
  ROUGE,
  ROUGE_TEXTE,
} from './crayon';
import {
  angleRotor,
  ARBRE_R,
  ARBRE_X0,
  ARBRE_X1,
  AXE_Y,
  CABLE_X,
  COLLECTEUR_R,
  COLLECTEUR_X0,
  COLLECTEUR_X1,
  COUPE_R_ARBRE,
  COUPE_R_ROTOR,
  COUPE_X,
  COUPE_Y,
  ENCOCHES,
  ENROULE_PAR_M,
  FORCE_MAX,
  LAMES,
  POULIE_Y,
  RAD_PAR_M,
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
  depassement,
  disposition,
  geometrieJauge,
  hauteurAffichee,
  yJauge,
  yRegle,
  type GeometrieJauge,
  type Plaque,
} from './machine-plan';
import {
  arrondir,
  effort,
  texteForce,
  texteHauteur,
  type AnimationMachine,
  type EtatMachine,
} from './machine-etat';
import type { RectPlan } from './plan';

/** Unité des forces affichées (symbole SI, identique dans toutes les langues). */
const UNITE_FORCE = 'N';
/** Espace insécable entre un nombre et son unité. */
const ESPACE_UNITE = String.fromCharCode(160);

const FONTE_TEXTE = `${String(TAILLE_TEXTE)}px ${POLICE}`;
const FONTE_NOMBRES = `${String(TAILLE_TEXTE)}px ${POLICE_NOMBRES}`;

const TIRETS_DEMANDE: number[] = [5, 3];
const TIRETS_REPERE: number[] = [1.5, 2.5];
const SANS_TIRETS: number[] = [];

/** Textes dynamiques de la colonne, recalculés seulement quand la valeur arrondie ou la langue change. */
export interface TextesMachine {
  /** « cabine : 1,25 m ». */
  cabine: string;
  /** « 5 000 N » : force appliquée. */
  appliquee: string;
  /** « 25 000 N » : force demandée. */
  demandee: string;
  /** « SATURATION ». */
  saturation: string;
}

/** Mémoire des textes : valeurs arrondies et langue du dernier calcul. */
export interface MemoireTextes {
  readonly textes: TextesMachine;
  /** Hauteur arrondie au centimètre, force appliquée et demandée arrondies au newton. */
  yCm: number;
  uSat: number;
  uCmd: number;
  langue: string;
}

/** Crée la mémoire des textes (vide : le premier appel de {@link majTextes} les calcule). */
export function creerMemoireTextes(): MemoireTextes {
  return {
    textes: { cabine: '', appliquee: '', demandee: '', saturation: '' },
    yCm: Number.NaN,
    uSat: Number.NaN,
    uCmd: Number.NaN,
    langue: '',
  };
}

/**
 * Met à jour les textes dynamiques si une valeur affichée a changé (sinon ne fait rien).
 * @param mem mémoire des textes.
 * @param m état de la machine.
 * @param tr traducteur.
 * @returns les textes à jour.
 */
export function majTextes(
  mem: MemoireTextes,
  m: Readonly<EtatMachine>,
  tr: Translator,
): Readonly<TextesMachine> {
  const yCm = arrondir(hauteurAffichee(m.y), 0.01);
  const uSat = arrondir(m.uSat, 1);
  const uCmd = arrondir(m.uCmd, 1);
  const langueChangee = mem.langue !== tr.locale;
  if (langueChangee || yCm !== mem.yCm) {
    mem.yCm = yCm;
    mem.textes.cabine = tr.t('pupitre.machine.cabine', { y: texteHauteur(tr, yCm) });
  }
  if (langueChangee || uSat !== mem.uSat) {
    mem.uSat = uSat;
    mem.textes.appliquee = `${texteForce(tr, uSat)}${ESPACE_UNITE}${UNITE_FORCE}`;
  }
  if (langueChangee || uCmd !== mem.uCmd) {
    mem.uCmd = uCmd;
    mem.textes.demandee = `${texteForce(tr, uCmd)}${ESPACE_UNITE}${UNITE_FORCE}`;
  }
  if (langueChangee) {
    mem.langue = tr.locale;
    mem.textes.saturation = tr.t('pupitre.machine.saturation');
  }
  return mem.textes;
}

// --- Primitives (tracés directs) ------------------------------------------------------------------

function ecrire(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  fonte: string,
  align: CanvasTextAlign,
  couleur: string,
): void {
  ctx.font = fonte;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = couleur;
  ctx.fillText(s, x, y);
}

function trait(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  couleur: string,
  largeur: number,
  alpha = 0.9,
): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = largeur;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function disque(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  couleur: string,
  alpha: number,
): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Voyant allumé : verre plein, reflet, rayons de crayon (pulsés en alerte). */
function lampe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rayon: number,
  rouge: boolean,
  pulse: number,
): void {
  const c = rouge ? ROUGE : GRAPHITE;
  disque(ctx, x, y, rayon - 0.5, c, rouge ? 0.85 : 0.72);
  disque(ctx, x - rayon * 0.35, y - rayon * 0.35, rayon * 0.28, PAPIER_CLAIR, 0.9);
  const l = 2.5 + 3 * pulse;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    trait(
      ctx,
      x + ca * (rayon + 5),
      y + sa * (rayon + 5),
      x + ca * (rayon + 5 + l),
      y + sa * (rayon + 5 + l),
      c,
      1.3,
      0.8,
    );
  }
}

// --- Entrée --------------------------------------------------------------------------------------

/**
 * Dessine la couche vive de la colonne de la machine.
 * @param ctx contexte du canvas vif, en unités du plan (déjà effacé).
 * @param rc rectangle de la colonne dans le plan.
 * @param m état de la machine à montrer (jeu en direct, ou curseur du trajet).
 * @param anim animation décorative de l'image (pulsation, secousse).
 * @param textes textes dynamiques, voir {@link majTextes}.
 */
export function dessinerVifMachine(
  ctx: CanvasRenderingContext2D,
  rc: Readonly<RectPlan>,
  m: Readonly<EtatMachine>,
  anim: Readonly<AnimationMachine>,
  textes: Readonly<TextesMachine>,
): void {
  const d = disposition(rc);
  voyants(ctx, d.voyants, m, anim);
  ctx.save();
  ctx.translate(d.dx, d.dy);
  moteurVif(ctx, m, anim, textes);
  ctx.restore();
  jaugeVif(ctx, d.jauge, m, textes);
}

// --- Voyants ----------------------------------------------------------------------------------

function voyants(
  ctx: CanvasRenderingContext2D,
  p: Readonly<Plaque>,
  m: Readonly<EtatMachine>,
  anim: Readonly<AnimationMachine>,
): void {
  const y = p.y + p.h / 2;
  const [marche, pause, sat, fin] = VOYANTS;
  if (m.marche) lampe(ctx, p.x + marche.x, y, VOYANT_R, false, 0.6);
  if (m.pause) lampe(ctx, p.x + pause.x, y, VOYANT_R, false, 0.6);
  if (m.sature) lampe(ctx, p.x + sat.x, y, VOYANT_R, true, anim.pulse);
  if (m.fin) lampe(ctx, p.x + fin.x, y, VOYANT_R, false, 0.6);
}

// --- Moteur (coordonnées de la maquette, ctx translaté) ---------------------------------------------

/** Lignes d'une surface cylindrique vue de côté qui tourne (génératrices visibles seulement). */
function generatrices(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  rayon: number,
  phi: number,
  n: number,
  largeur: number,
  repere: boolean,
): void {
  for (let k = 0; k < n; k++) {
    const th = phi + (k * Math.PI * 2) / n;
    const c = Math.cos(th);
    if (c <= 0) continue;
    const y = AXE_Y - rayon * Math.sin(th);
    const marque = repere && k === 0;
    trait(ctx, x0, y, x1, y, GRAPHITE, marque ? largeur + 1.6 : largeur, 0.25 + 0.65 * c);
    if (marque) trait(ctx, x0, y + 2.5, x1, y + 2.5, GRAPHITE, 0.8, 0.6 * c);
  }
}

function etincelles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  pulse: number,
): void {
  const l = 3 + 4 * pulse;
  for (let j = 0; j < 5; j++) {
    const a = (s < 0 ? Math.PI : 0) + 0.3 + j * 0.62;
    trait(
      ctx,
      x + Math.cos(a) * 3,
      y + Math.sin(a) * 3,
      x + Math.cos(a) * (3 + l),
      y + Math.sin(a) * (3 + l),
      ROUGE,
      1.2,
    );
  }
}

function fleche(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rayon: number,
  a0: number,
  a1: number,
  couleur: string,
  largeur: number,
): void {
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = largeur;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, rayon, Math.min(a0, a1), Math.max(a0, a1));
  ctx.stroke();
  // pointe à a1
  const dir = a1 > a0 ? 1 : -1;
  const px = cx + Math.cos(a1) * rayon;
  const py = cy + Math.sin(a1) * rayon;
  const tx = -Math.sin(a1) * dir;
  const ty = Math.cos(a1) * dir;
  const nx = Math.cos(a1);
  const ny = Math.sin(a1);
  const t = 4 + largeur;
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.moveTo(px + tx * t, py + ty * t);
  ctx.lineTo(px + nx * t * 0.6, py + ny * t * 0.6);
  ctx.lineTo(px - nx * t * 0.6, py - ny * t * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Brin de câble (double trait) avec des repères qui défilent quand il se déroule. */
function brin(
  ctx: CanvasRenderingContext2D,
  xa: number,
  ya: number,
  xb: number,
  yb: number,
  decal: number,
): void {
  const lg = Math.hypot(xb - xa, yb - ya);
  if (lg < 1) return;
  const ux = (xb - xa) / lg;
  const uy = (yb - ya) / lg;
  trait(ctx, xa - uy * 0.8, ya + ux * 0.8, xb - uy * 0.8, yb + ux * 0.8, GRAPHITE, 1.1, 0.95);
  trait(ctx, xa + uy * 0.8, ya - ux * 0.8, xb + uy * 0.8, yb - ux * 0.8, GRAPHITE, 1.1, 0.95);
  for (let dd = decal; dd < lg; dd += 14) {
    const x = xa + ux * dd;
    const y = ya + uy * dd;
    trait(ctx, x - uy * 2.5, y + ux * 2.5, x + uy * 2.5, y - ux * 2.5, GRAPHITE, 1.1);
  }
}

function moteurVif(
  ctx: CanvasRenderingContext2D,
  m: Readonly<EtatMachine>,
  anim: Readonly<AnimationMachine>,
  textes: Readonly<TextesMachine>,
): void {
  const yc = hauteurAffichee(m.y);
  const phi = angleRotor(m.y);
  const effortRel = effort(m.uSat, FORCE_MAX);
  const signe = m.uSat >= 0 ? 1 : -1;
  const couleurEffort = m.sature ? ROUGE : GRAPHITE;
  const pulse = anim.pulse;

  // vue de côté : encoches du rotor, lames du collecteur
  generatrices(ctx, ROTOR_X0 + 2, ROTOR_X1 - 2, ROTOR_R - 2, phi, ENCOCHES, 1.4, true);
  generatrices(ctx, COLLECTEUR_X0 + 1, COLLECTEUR_X1 - 1, COLLECTEUR_R - 1, phi, LAMES, 1, false);
  if (m.sature) {
    etincelles(ctx, 1014, AXE_Y - COLLECTEUR_R, -1, pulse);
    etincelles(ctx, 1014, AXE_Y + COLLECTEUR_R, 1, pulse);
  }
  // jauge de torsion de l'arbre : génératrices inclinées selon l'effort
  const dx = signe * effortRel * 9;
  for (let x = ARBRE_X0 + 6; x <= ARBRE_X1 - 6; x += 5) {
    trait(
      ctx,
      x - dx,
      AXE_Y - ARBRE_R + 1,
      x + dx,
      AXE_Y + ARBRE_R - 1,
      couleurEffort,
      0.9 + effortRel * 1.2,
    );
  }
  // clavette qui tourne avec l'arbre
  const ck = Math.cos(phi);
  if (ck > 0)
    trait(
      ctx,
      ARBRE_X0 + 2,
      AXE_Y - (ARBRE_R - 2) * Math.sin(phi),
      ARBRE_X1 - 2,
      AXE_Y - (ARBRE_R - 2) * Math.sin(phi),
      GRAPHITE,
      1.6,
      0.4 + 0.5 * ck,
    );
  // boulons de l'accouplement
  for (let k = 0; k < 4; k++) {
    const th = phi + (k * Math.PI) / 2;
    const c = Math.cos(th);
    if (c <= 0) continue;
    const y = AXE_Y - 12 * Math.sin(th);
    ctx.globalAlpha = 0.4 + 0.5 * c;
    ctx.fillStyle = GRAPHITE;
    ctx.fillRect(1076, y - 1.8, 18, 3.6);
    ctx.globalAlpha = 1;
  }
  // tambour : génératrices puis câble enroulé (sa largeur croît avec la hauteur de la cabine)
  generatrices(ctx, TAMBOUR_X0 + 1, TAMBOUR_X1 - 1, TAMBOUR_R - 1, phi, 10, 1, true);
  const largeurEnroulee = Math.min(TAMBOUR_X1 - TAMBOUR_X0 - 4, 6 + yc * ENROULE_PAR_M);
  const xe = TAMBOUR_X0 + largeurEnroulee;
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(TAMBOUR_X0 + 0.5, AXE_Y - TAMBOUR_R - 2, largeurEnroulee, 2 * TAMBOUR_R + 4);
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = TAMBOUR_X0 + 2; x < xe; x += 3.2) {
    ctx.moveTo(x, AXE_Y - TAMBOUR_R - 2);
    ctx.lineTo(x + 2.4, AXE_Y + TAMBOUR_R + 2);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  trait(ctx, xe, AXE_Y - TAMBOUR_R - 2, xe, AXE_Y + TAMBOUR_R + 2, GRAPHITE, 1.2);

  // câble jusqu'à la cabine, avec des repères qui défilent avec la hauteur (donc avec la simulation)
  const yCab = yRegle(yc);
  const pas = 14;
  const decal = (((-yc * 60) % pas) + pas) % pas;
  brin(ctx, xe - 1, AXE_Y + TAMBOUR_R + 2, CABLE_X, POULIE_Y, decal);
  brin(ctx, CABLE_X, POULIE_Y, CABLE_X, yCab - 26, decal);
  // cabine et bonhomme : étroite entre les corbeaux de la poutre ; seul le plancher, large, les touche
  const cx0 = CABLE_X - 10;
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(cx0, yCab - 26, 20, 26);
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 1.3;
  ctx.strokeRect(cx0, yCab - 26, 20, 26);
  trait(ctx, CABLE_X - 19, yCab, CABLE_X + 19, yCab, GRAPHITE, 3);
  disque(ctx, CABLE_X, yCab - 19, 3, GRAPHITE, 0.85);
  trait(ctx, CABLE_X, yCab - 16, CABLE_X, yCab - 8, GRAPHITE, 1.4);
  trait(ctx, CABLE_X, yCab - 8, CABLE_X - 3, yCab - 1, GRAPHITE, 1.4);
  trait(ctx, CABLE_X, yCab - 8, CABLE_X + 3, yCab - 1, GRAPHITE, 1.4);
  trait(ctx, CABLE_X - 5, yCab - 13, CABLE_X + 5, yCab - 13, GRAPHITE, 1.2);
  // index sur la règle
  ctx.setLineDash(TIRETS_REPERE);
  trait(ctx, REGLE_X + 3, yCab, CABLE_X - 21, yCab, GRAPHITE, 1);
  ctx.setLineDash(SANS_TIRETS);
  ctx.fillStyle = GRAPHITE;
  ctx.beginPath();
  ctx.moveTo(REGLE_X + 1, yCab);
  ctx.lineTo(REGLE_X + 7, yCab - 3.5);
  ctx.lineTo(REGLE_X + 7, yCab + 3.5);
  ctx.closePath();
  ctx.fill();
  ecrire(ctx, textes.cabine, 1052, 716, FONTE_NOMBRES, 'left', ENCRE);

  // coupe A-A : rotor qui tourne (sens trigonométrique quand la cabine monte)
  const cx = COUPE_X;
  const cy = COUPE_Y;
  for (let k = 0; k < ENCOCHES; k++) {
    const a = -phi - (k * Math.PI * 2) / ENCOCHES;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ra = COUPE_R_ROTOR;
    // encoche ouverte vers l'entrefer
    trait(
      ctx,
      cx + Math.cos(a - 0.1) * (ra - 7),
      cy + Math.sin(a - 0.1) * (ra - 7),
      cx + Math.cos(a - 0.1) * ra,
      cy + Math.sin(a - 0.1) * ra,
      GRAPHITE,
      1,
    );
    trait(
      ctx,
      cx + Math.cos(a + 0.1) * (ra - 7),
      cy + Math.sin(a + 0.1) * (ra - 7),
      cx + Math.cos(a + 0.1) * ra,
      cy + Math.sin(a + 0.1) * ra,
      GRAPHITE,
      1,
    );
    disque(ctx, cx + ca * (ra - 11), cy + sa * (ra - 11), 4, GRAPHITE, k === 0 ? 0.95 : 0.35);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx + ca * (ra - 11), cy + sa * (ra - 11), 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // traînée de vitesse derrière le repère
  const omega = (Number.isFinite(m.v) ? m.v : 0) * RAD_PAR_M;
  if (Math.abs(omega) > 0.4) {
    const a0 = -phi;
    const l = Math.min(1.6, Math.abs(omega) * 0.16);
    for (let j = 0; j < 3; j++) {
      const rr = COUPE_R_ROTOR - 6 - j * 5;
      const deb = a0 + (omega > 0 ? 0.2 : -0.2);
      const fin = a0 + (omega > 0 ? 0.2 + l : -0.2 - l);
      ctx.globalAlpha = 0.5 - j * 0.12;
      ctx.strokeStyle = GRAPHITE;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, Math.min(deb, fin), Math.max(deb, fin));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // arbre et clavette
  disque(ctx, cx, cy, COUPE_R_ARBRE, PAPIER_CLAIR, 1);
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, COUPE_R_ARBRE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = GRAPHITE;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-phi);
  ctx.fillRect(COUPE_R_ARBRE - 4, -2, 4, 4);
  ctx.restore();
  // couple : deux flèches courbes, épaisses selon la force appliquée
  if (effortRel > 0.01) {
    const ouverture = 0.12 + 0.5 * effortRel;
    const larg = 1 + 3.5 * effortRel;
    const rr = COUPE_R_ROTOR + 9;
    for (let k = 0; k < 2; k++) {
      const base = k * Math.PI;
      fleche(
        ctx,
        cx,
        cy,
        rr,
        base + ouverture * signe,
        base - ouverture * signe,
        couleurEffort,
        larg,
      );
    }
  }
  // tremblement de la carcasse en saturation (jamais en mouvement réduit : secousse nulle)
  if (m.sature) {
    const dec = anim.secousse;
    for (let j = 0; j < 3; j++) {
      trait(ctx, 878 + dec, 300 + j * 8, 872 + dec, 296 + j * 8, ROUGE, 1.3);
      trait(ctx, 1046 - dec, 300 + j * 8, 1052 - dec, 296 + j * 8, ROUGE, 1.3);
      trait(ctx, cx - 86 + dec, cy - 20 + j * 10, cx - 80 + dec, cy - 24 + j * 10, ROUGE, 1.3);
      trait(ctx, cx + 80 - dec, cy - 20 + j * 10, cx + 86 - dec, cy - 24 + j * 10, ROUGE, 1.3);
    }
    ecrire(ctx, textes.saturation, 1080, 270, FONTE_TEXTE, 'left', ROUGE_TEXTE);
  }
}

// --- Jauge de force ---------------------------------------------------------------------------

/** Chevron plein (triangle) pointant vers le haut (`sens` = −1) ou vers le bas (`sens` = 1). */
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, sens: number): void {
  ctx.fillStyle = ROUGE;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(x, y + sens * 9);
  ctx.lineTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function jaugeVif(
  ctx: CanvasRenderingContext2D,
  p: Readonly<Plaque>,
  m: Readonly<EtatMachine>,
  textes: Readonly<TextesMachine>,
): void {
  const g: GeometrieJauge = geometrieJauge(p);
  const y0 = yJauge(g, 0);
  const ys = yJauge(g, m.uSat);
  const yd = yJauge(g, m.uCmd);
  // force appliquée : colonne hachurée serrée
  const haut = Math.min(y0, ys);
  const h = Math.abs(ys - y0);
  if (h > 0.5) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0 + 1, haut, g.x1 - g.x0 - 2, h);
    ctx.clip();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = GRAPHITE;
    ctx.fillRect(g.x0, haut, g.x1 - g.x0, h);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let y = haut - 24; y < haut + h + 4; y += 3.4) {
      ctx.moveTo(g.x0, y + 20);
      ctx.lineTo(g.x1, y);
    }
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    trait(ctx, g.x0 - 1, ys, g.x1 + 1, ys, GRAPHITE, 2.4);
  }
  // force demandée : contour rouge en tirets, tronqué au bord de l'échelle s'il le faut
  const hd = Math.abs(yd - y0);
  if (hd > 0.5) {
    ctx.setLineDash(TIRETS_DEMANDE);
    ctx.strokeStyle = ROUGE;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.95;
    ctx.strokeRect(g.x0 - 3, Math.min(y0, yd), g.x1 - g.x0 + 6, hd);
    ctx.setLineDash(SANS_TIRETS);
    ctx.fillStyle = ROUGE;
    ctx.beginPath();
    ctx.moveTo(g.x1 + 3, yd);
    ctx.lineTo(g.x1 + 9, yd - 5);
    ctx.lineTo(g.x1 + 9, yd + 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    if (m.sature && yd !== ys) {
      // partie écrêtée : hachure croisée rouge entre la demande et la force appliquée
      const a = Math.min(yd, ys);
      const b = Math.max(yd, ys);
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x0 + 1, a, g.x1 - g.x0 - 2, b - a);
      ctx.clip();
      ctx.strokeStyle = ROUGE;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      for (let y = a - 24; y < b + 4; y += 4) {
        ctx.moveTo(g.x0, y);
        ctx.lineTo(g.x1, y + 20);
        ctx.moveTo(g.x0, y + 20);
        ctx.lineTo(g.x1, y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
  // demande hors échelle : chevron au bord de la colonne et valeur en toutes lettres à côté
  const hors = depassement(m.uCmd);
  if (hors !== 'aucun') {
    const xc = (g.x0 + g.x1) / 2;
    if (hors === 'haut') {
      chevron(ctx, xc, g.haut - 12, -1);
      ecrire(ctx, textes.demandee, g.x1 + 14, g.haut + 14, FONTE_NOMBRES, 'left', ROUGE_TEXTE);
    } else {
      chevron(ctx, xc, g.bas + 12, 1);
      ecrire(ctx, textes.demandee, g.x1 + 14, g.bas + 14, FONTE_NOMBRES, 'left', ROUGE_TEXTE);
    }
  }
  // valeurs lues : force appliquée et force demandée (en rouge quand le moteur sature)
  const xv = p.x + p.w - 12;
  ecrire(ctx, textes.appliquee, xv, p.y + 59, FONTE_NOMBRES, 'right', ENCRE);
  ecrire(
    ctx,
    textes.demandee,
    xv,
    p.y + 91,
    FONTE_NOMBRES,
    'right',
    m.sature ? ROUGE_TEXTE : ENCRE,
  );
}
