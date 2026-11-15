/**
 * Maquette B (jetable) : quatre petites courbes alignées sur le même axe du temps (erreur,
 * forces, vitesse, accélération), tracées de t = 0 jusqu'à l'instant présent. Les axes sont
 * fixés au chargement du trajet (plage ronde de tout le trajet) : rien ne bouge pendant le rejeu.
 */
import type { Echantillon, IssueTrajet, TrajetReference } from '../common/types';
import {
  ENCRE_DOUCE,
  GRAPHITE,
  HACHURE,
  ORDINAIRE,
  PAPIER_CLAIR,
  ROUGE,
  ROUGE_TEXTE,
  ecrire,
  hachurer,
  rectangle,
  trait,
  type Crayon,
} from './crayon';
import { nombre, plageRonde, type Plage } from './format';

/** Zone des courbes (px de scène) et durée affichée (s, commune aux trois trajets). */
const X0 = 772;
const X1 = 1240;
const T_MAX = 3.5;
const HAUTEUR = 112;
const ECART = 138;
const HAUT = 94;
/** Marge intérieure haute et basse d'une bande (px) : une courbe sur la borne reste visible. */
const MARGE = 5;

type Cle = 'e' | 'uCmd' | 'uSat' | 'p' | 'i' | 'v' | 'a';

interface Bande {
  readonly y0: number;
  readonly y1: number;
  readonly plage: Plage;
  readonly titre: string;
}

/** Axes d'un trajet, calculés au chargement. */
export interface AxesCourbes {
  readonly trajet: TrajetReference;
  readonly bandes: readonly [Bande, Bande, Bande, Bande];
  readonly niveau2: boolean;
}

function etendue(trajet: TrajetReference, cles: readonly Cle[]): [number, number] {
  let mn = Infinity;
  let mx = -Infinity;
  for (const x of trajet.echantillons) {
    for (const cle of cles) {
      const val = x[cle];
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
  }
  return [mn, mx];
}

function bande(rang: number, plage: Plage, titre: string): Bande {
  const y0 = HAUT + rang * ECART;
  return { y0, y1: y0 + HAUTEUR, plage, titre };
}

/** Calcule les axes des quatre bandes pour un trajet. */
export function preparerAxes(trajet: TrajetReference): AxesCourbes {
  const niveau2 = trajet.niveau === 'level2';
  const [eMin, eMax] = etendue(trajet, ['e']);
  const forces: readonly Cle[] = niveau2 ? ['uCmd', 'uSat', 'p', 'i'] : ['uCmd', 'uSat'];
  const [fMin, fMax] = etendue(trajet, forces);
  const [vMin, vMax] = etendue(trajet, ['v']);
  const [aMin, aMax] = etendue(trajet, ['a']);
  return {
    trajet,
    niveau2,
    bandes: [
      bande(0, plageRonde(eMin, eMax), 'erreur  e = r − y  (m)'),
      bande(1, plageRonde(fMin, Math.max(fMax, trajet.physique.uMax)), 'forces  (N)'),
      bande(2, plageRonde(vMin, vMax), 'vitesse de la cabine  v  (m/s)'),
      bande(3, plageRonde(aMin, aMax), 'accélération  a  (m/s²)'),
    ],
  };
}

function yDe(b: Bande, val: number): number {
  const f = (val - b.plage.min) / (b.plage.max - b.plage.min);
  return b.y1 - MARGE - f * (HAUTEUR - 2 * MARGE);
}

function xDe(t: number): number {
  return X0 + (Math.min(t, T_MAX) / T_MAX) * (X1 - X0);
}

/** Petit échantillon de trait pour la légende. */
function echantillonLegende(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largeur: number,
  tirets: readonly number[],
): void {
  ctx.save();
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = largeur;
  ctx.lineCap = 'round';
  ctx.setLineDash(tirets);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 24, y);
  ctx.stroke();
  ctx.restore();
}

/** Nom court de l'issue, écrit près de son repère. */
const ISSUE_COURTE: Readonly<Record<IssueTrajet, string>> = {
  win: 'arrivée',
  bonk: 'choc !',
  noLift: 'pas de décollage',
  step: 'arrêt trop bas',
  slow: 'trop lent',
};

/** Styles des séries : largeur et tirets. */
const STYLE: Readonly<Record<Cle, readonly [number, readonly number[]]>> = {
  e: [2.6, []],
  uSat: [2.8, []],
  uCmd: [1.8, [7, 5]],
  p: [1.3, []],
  i: [2.6, [0.5, 5]],
  v: [2.6, []],
  a: [2.6, []],
};

/** Partie fixe : titres, cadres, graduations, légende, zones de référence. */
export function dessinerFondCourbes(cr: Crayon, axes: AxesCourbes): void {
  const ctx = cr.ctx;
  const phys = axes.trajet.physique;
  ecrire(ctx, 'Courbes de l’essai', (X0 + X1) / 2, 40, 28, 'center');
  ecrire(ctx, 'de t = 0 jusqu’à l’instant présent', (X0 + X1) / 2, 62, 17, 'center', ENCRE_DOUCE);
  axes.bandes.forEach((b, rang) => {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.fillRect(X0, b.y0, X1 - X0, HAUTEUR);
    ctx.restore();
    // Quadrillage léger : graduations de la valeur et demi-secondes.
    ctx.save();
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    for (let v = b.plage.min; v <= b.plage.max + 1e-9; v += b.plage.pas) {
      const y = Math.round(yDe(b, v)) + 0.5;
      ctx.moveTo(X0, y);
      ctx.lineTo(X1, y);
    }
    for (let t = 0.5; t < T_MAX; t += 0.5) {
      const x = Math.round(xDe(t)) + 0.5;
      ctx.moveTo(x, b.y0);
      ctx.lineTo(x, b.y1);
    }
    ctx.stroke();
    ctx.restore();
    // Ligne du zéro, plus marquée.
    trait(
      cr,
      [X0, yDe(b, 0), X1, yDe(b, 0)],
      { largeur: 1.2, encre: 0.7, tremble: 0.2 },
      600 + rang,
    );
    for (let v = b.plage.min; v <= b.plage.max + 1e-9; v += b.plage.pas) {
      ecrire(ctx, nombre(v, b.plage.decimales), X0 - 8, yDe(b, v) + 5, 15, 'right', ENCRE_DOUCE);
    }
    rectangle(cr, X0, b.y0, X1 - X0, HAUTEUR, ORDINAIRE, 620 + rang * 4);
    ecrire(ctx, b.titre, X0, b.y0 - 8, 19, 'left');
  });

  const [be, bf] = axes.bandes;
  // Erreur : zone d'arrivée ±tolérance, hachurée.
  const yHaut = yDe(be, phys.toleranceArrivee);
  const yBas = yDe(be, -phys.toleranceArrivee);
  hachurer(
    cr,
    (c) => {
      c.rect(X0, yHaut, X1 - X0, yBas - yHaut);
    },
    [X0, yHaut, X1, yBas],
    Math.PI / 4,
    6,
    HACHURE,
    650,
  );
  ecrire(
    ctx,
    'zone d’arrivée (±' + nombre(phys.toleranceArrivee, 2) + ' m)',
    X1 - 6,
    yHaut - 5,
    15,
    'right',
    ENCRE_DOUCE,
  );

  // Forces : limite du moteur, en rouge.
  const yLim = yDe(bf, phys.uMax);
  trait(
    cr,
    [X0, yLim, X1, yLim],
    { largeur: 1.4, encre: 0.85, tremble: 0, tirets: [10, 6], rouge: true },
    660,
  );
  ecrire(
    ctx,
    'limite du moteur ' + nombre(phys.uMax) + ' N',
    X1 - 6,
    yLim - 5,
    15,
    'right',
    ROUGE_TEXTE,
  );
  // Légende des forces, sur la ligne du titre.
  let x = X0 + 112;
  const yl = bf.y0 - 13;
  const items: readonly (readonly [string, number, readonly number[]])[] = axes.niveau2
    ? [
        ['appliquée', 2.8, []],
        ['demandée', 1.8, [7, 5]],
        ['P', 1.3, []],
        ['I', 2.6, [0.5, 5]],
      ]
    : [
        ['appliquée', 2.8, []],
        ['demandée', 1.8, [7, 5]],
      ];
  for (const [nom, largeur, tirets] of items) {
    echantillonLegende(ctx, x, yl, largeur, tirets);
    ecrire(ctx, nom, x + 30, yl + 5, 17, 'left', ENCRE_DOUCE);
    x += 30 + ctx.measureText(nom).width + 22;
  }

  // Axe du temps, sous la dernière bande.
  const bb = axes.bandes[3];
  for (let t = 0; t <= T_MAX + 1e-9; t += 0.5) {
    ecrire(ctx, nombre(t, t % 1 === 0 ? 0 : 1), xDe(t), bb.y1 + 20, 16, 'center', ENCRE_DOUCE);
  }
  ecrire(ctx, 'temps  t  (s)', (X0 + X1) / 2, bb.y1 + 42, 18, 'center');
}

/** Trace une série jusqu'à l'indice n, puis jusqu'à la tête interpolée. */
function serie(
  ctx: CanvasRenderingContext2D,
  b: Bande,
  ech: readonly Echantillon[],
  n: number,
  tete: Readonly<Echantillon>,
  cle: Cle,
): void {
  const [largeur, tirets] = STYLE[cle];
  ctx.lineWidth = largeur;
  ctx.setLineDash(tirets);
  ctx.beginPath();
  for (let j = 0; j <= n; j++) {
    const x = ech[j] as Echantillon;
    if (j === 0) ctx.moveTo(xDe(x.t), yDe(b, x[cle]));
    else ctx.lineTo(xDe(x.t), yDe(b, x[cle]));
  }
  ctx.lineTo(xDe(tete.t), yDe(b, tete[cle]));
  ctx.stroke();
}

function point(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 3.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Partie mobile : courbes jusqu'à l'instant présent, saturation, curseur, lectures. */
export function dessinerCourbes(
  cr: Crayon,
  axes: AxesCourbes,
  actif: boolean,
  indice: number,
  courant: Readonly<Echantillon>,
): void {
  const ctx = cr.ctx;
  const [be, bf, bv, ba] = axes.bandes;
  if (!actif) {
    ecrire(ctx, 'en attente du lancement…', (X0 + X1) / 2, be.y0 + 62, 22, 'center', ENCRE_DOUCE);
    return;
  }
  const ech = axes.trajet.echantillons;
  // Le jeu est figé à l'issue : les courbes s'arrêtent au dernier pas simulé.
  const dernier = Math.max(0, Math.min(axes.trajet.pasIssue - 1, ech.length - 1));
  const fige = indice >= dernier;
  const n = Math.min(indice, dernier);
  const tete: Readonly<Echantillon> = fige ? (ech[dernier] as Echantillon) : courant;

  // Saturation : bandes rouges hachurées sur les intervalles saturés déjà parcourus.
  ctx.save();
  ctx.beginPath();
  ctx.rect(X0, bf.y0, X1 - X0, HAUTEUR);
  ctx.clip();
  ctx.strokeStyle = ROUGE;
  ctx.lineWidth = 1;
  let debut = -1;
  for (let j = 0; j <= n + 1; j++) {
    const sat = j <= n && (ech[j] as Echantillon).saturated;
    if (sat && debut < 0) debut = j;
    if (!sat && debut >= 0) {
      const xa = xDe((ech[debut] as Echantillon).t);
      const xb = j <= n ? xDe((ech[j] as Echantillon).t) : xDe(tete.t);
      ctx.save();
      ctx.beginPath();
      ctx.rect(xa, bf.y0, xb - xa, HAUTEUR);
      ctx.clip();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = ROUGE;
      ctx.fillRect(xa, bf.y0, xb - xa, HAUTEUR);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let d = xa - HAUTEUR; d < xb; d += 6) {
        ctx.moveTo(d, bf.y1);
        ctx.lineTo(d + HAUTEUR, bf.y0);
      }
      ctx.stroke();
      ctx.restore();
      debut = -1;
    }
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = cr.graphite;
  ctx.fillStyle = cr.graphite;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const forces: readonly Cle[] = axes.niveau2 ? ['p', 'i', 'uCmd', 'uSat'] : ['uCmd', 'uSat'];
  const groupes: readonly (readonly [Bande, readonly Cle[]])[] = [
    [be, ['e']],
    [bf, forces],
    [bv, ['v']],
    [ba, ['a']],
  ];
  for (const [b, cles] of groupes) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(X0, b.y0, X1 - X0, HAUTEUR);
    ctx.clip();
    for (const cle of cles) serie(ctx, b, ech, n, tete, cle);
    ctx.setLineDash([]);
    for (const cle of cles)
      if (cle !== 'p' && cle !== 'i') point(ctx, xDe(tete.t), yDe(b, tete[cle]));
    ctx.restore();
  }
  ctx.restore();

  // Repère de l'issue, en trait plein, à travers les quatre bandes.
  if (fige) {
    const xi = xDe(tete.t);
    trait(cr, [xi, be.y0, xi, ba.y1], { largeur: 1.6, encre: 0.9, tremble: 0.3 }, 680);
    const gauche = xi > X1 - 90;
    ecrire(
      ctx,
      ISSUE_COURTE[axes.trajet.issue],
      xi + (gauche ? -6 : 6),
      be.y0 + 20,
      18,
      gauche ? 'right' : 'left',
    );
  }

  // Curseur de l'instant présent, à travers les quatre bandes.
  const xc = xDe(courant.t);
  ctx.save();
  ctx.strokeStyle = GRAPHITE;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(Math.round(xc) + 0.5, be.y0);
  ctx.lineTo(Math.round(xc) + 0.5, ba.y1);
  ctx.stroke();
  ctx.restore();

  // Lectures à droite des titres.
  ecrire(ctx, 'e = ' + nombre(tete.e, 2) + ' m', X1, be.y0 - 8, 19, 'right');
  ecrire(ctx, 'v = ' + nombre(tete.v, 1) + ' m/s', X1, bv.y0 - 8, 19, 'right');
  ecrire(ctx, 'a = ' + nombre(tete.a, 1) + ' m/s²', X1, ba.y0 - 8, 19, 'right');
}
