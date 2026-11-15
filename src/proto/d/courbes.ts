/**
 * Maquette D (lot B, v0.3, JETABLE) : colonne « Les courbes ». Quatre feuillets superposés
 * (erreur e, commande, vitesse v, accélération a), tracés jusqu'à l'instant courant sur des
 * échelles fixées au chargement du trajet (elles ne bougent pas pendant le rejeu).
 */
import type { EtatRejeu } from '../contrat';
import type { Echantillon, TrajetReference } from '../common/types';
import { Crayon, ENCRE, ENCRE_PALE, GRAPHITE, ROUGE, ROUGE_TEXTE } from './crayon';
import { nb } from './format';

/** Zone de tracé commune (x) et feuillets (haut de chacun, hauteur de la zone). */
const X0 = 906;
const X1 = 1258;
const HAUTS: readonly number[] = [96, 222, 348, 474];
const DECALAGE_ZONE = 26;
const H_ZONE = 80;

const TIRETS_DEMANDE: readonly number[] = [6, 4];
const TIRETS_P: readonly number[] = [10, 3, 2, 3];
const TIRETS_I: readonly number[] = [1.5, 3];
const AUCUN: readonly number[] = [];
const TIRETS_BUTEE: readonly number[] = [3, 3];
const TIRETS_INSTANT: readonly number[] = [2, 4];
const SIGNES: readonly number[] = [1, -1];
const COULEURS_SAT: readonly boolean[] = [false, true];

/** Grandeur tracée. */
type Champ = 'e' | 'v' | 'a' | 'uCmd' | 'uSat' | 'p' | 'i';

/** Échelle verticale d'un feuillet. */
interface Echelle {
  readonly min: number;
  readonly max: number;
  readonly pas: number;
  readonly decimales: number;
}

/** Échelles d'un trajet (calculées au chargement). */
export interface Echelles {
  readonly tMax: number;
  readonly e: Echelle;
  readonly force: Echelle;
  readonly v: Echelle;
  readonly a: Echelle;
}

function echelle(bas: number, haut: number): Echelle {
  const etendue = Math.max(haut - bas, 1e-9);
  const brut = etendue / 4;
  const p10 = 10 ** Math.floor(Math.log10(brut));
  const m = brut / p10;
  const pas = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p10;
  const min = Math.floor(bas / pas + 1e-6) * pas;
  const max = Math.ceil(haut / pas - 1e-6) * pas;
  const decimales = pas >= 1 ? 0 : pas >= 0.1 ? 1 : 2;
  return {
    min,
    max,
    pas,
    decimales: Number.isInteger(pas * 10 ** decimales) ? decimales : decimales + 1,
  };
}

function bornes(trajet: TrajetReference, champs: readonly Champ[]): [number, number] {
  let bas = 0;
  let haut = 0;
  for (const s of trajet.echantillons) {
    for (const champ of champs) {
      const x = s[champ];
      if (x < bas) bas = x;
      if (x > haut) haut = x;
    }
  }
  return [bas, haut];
}

/** Calcule les échelles des quatre feuillets pour un trajet. */
export function preparerEchelles(trajet: TrajetReference): Echelles {
  const duree = (trajet.echantillons.length - 1) * trajet.dt;
  const [eb, eh] = bornes(trajet, ['e']);
  const [fb, fh] = bornes(trajet, ['uCmd', 'uSat', 'p', 'i']);
  const [vb, vh] = bornes(trajet, ['v']);
  const [ab, ah] = bornes(trajet, ['a']);
  return {
    tMax: Math.ceil(duree / 0.5 - 1e-6) * 0.5,
    e: echelle(eb, eh),
    force: echelle(fb, Math.max(fh, trajet.physique.uMax)),
    v: echelle(vb, vh),
    a: echelle(ab, ah),
  };
}

/** Feuillet en cours de tracé (positions écran). */
let haut = 0;
let echelleCourante: Echelle = { min: 0, max: 1, pas: 1, decimales: 0 };
let tMax = 1;

function px(t: number): number {
  return X0 + (t / tMax) * (X1 - X0);
}

function py(valeur: number): number {
  const e = echelleCourante;
  const f = (valeur - e.min) / (e.max - e.min);
  return haut + DECALAGE_ZONE + H_ZONE * (1 - f);
}

/** Cadre, graduations et titre d'un feuillet. */
function feuillet(
  c: Crayon,
  indice: number,
  titre: string,
  e: Echelle,
  graduationsTemps: boolean,
): void {
  haut = HAUTS[indice] ?? 0;
  echelleCourante = e;
  const y0 = haut + DECALAGE_ZONE;
  const y1 = y0 + H_ZONE;
  c.texte(titre, 856, haut + 16, 16, 'left', ENCRE);
  c.trait(X0, y0 - 2, X0, y1, 1.3, 0.95);
  c.trait(X0, y1, X1, y1, 1.1, 0.7);
  // Graduations verticales et lignes de rappel.
  c.lot();
  for (let v = e.min; v <= e.max + e.pas * 1e-6; v += e.pas) {
    const y = py(v);
    c.segment(X0 - 4, y, X0, y);
  }
  c.finLot(1, 0.9);
  c.lot();
  for (let v = e.min; v <= e.max + e.pas * 1e-6; v += e.pas) {
    if (Math.abs(v) < e.pas * 1e-6) continue;
    const y = py(v);
    c.segment(X0, y, X1, y);
  }
  c.finLot(0.6, 0.25);
  for (let v = e.min; v <= e.max + e.pas * 1e-6; v += e.pas) {
    c.texte(nb(v, e.decimales), X0 - 7, py(v) + 4.5, 13, 'right', ENCRE);
  }
  // Ligne du zéro, appuyée.
  if (e.min < 0 && e.max > 0) c.trait(X0, py(0), X1, py(0), 1.2, 0.9, GRAPHITE, 0.2);
  // Graduations du temps (toutes les 0,5 s).
  c.lot();
  for (let t = 0; t <= tMax + 1e-6; t += 0.5) {
    const x = px(t);
    c.segment(x, y1, x, y1 + (Number.isInteger(t) ? 5 : 3));
  }
  c.finLot(1, 0.85);
  if (graduationsTemps) {
    for (let t = 0; t <= tMax + 1e-6; t += 0.5) {
      c.texte(nb(t, Number.isInteger(t) ? 0 : 1), px(t), y1 + 18, 13, 'center');
    }
    c.texte('t (s)', X0 - 7, y1 + 18, 13, 'right', ENCRE_PALE);
  }
}

/** Trace une grandeur du départ jusqu'à l'instant courant (dernier point interpolé). */
function trace(
  c: Crayon,
  etat: Readonly<EtatRejeu>,
  champ: Champ,
  epaisseur: number,
  encre: number,
  motif: readonly number[],
): void {
  const ech = etat.lecteur.trajet.echantillons;
  const ctx = c.ctx;
  ctx.beginPath();
  for (let k = 0; k <= etat.indice; k += 1) {
    const s = ech[k] as Echantillon;
    if (k === 0) ctx.moveTo(px(s.t), py(s[champ]));
    else ctx.lineTo(px(s.t), py(s[champ]));
  }
  ctx.lineTo(px(etat.t), py(etat.echantillon[champ]));
  ctx.setLineDash(motif);
  ctx.globalAlpha = encre;
  ctx.strokeStyle = ENCRE;
  ctx.lineWidth = epaisseur;
  ctx.stroke();
  ctx.setLineDash(AUCUN);
  ctx.globalAlpha = 1;
}

/** Force appliquée : trait appuyé, au crayon rouge là où le moteur sature. */
function traceAppliquee(c: Crayon, etat: Readonly<EtatRejeu>): void {
  const ech = etat.lecteur.trajet.echantillons;
  const ctx = c.ctx;
  for (const rouge of COULEURS_SAT) {
    ctx.beginPath();
    let ouvert = false;
    for (let k = 0; k <= etat.indice; k += 1) {
      const s = ech[k] as Echantillon;
      const suivant = k < etat.indice ? (ech[k + 1] as Echantillon) : etat.echantillon;
      if (s.saturated !== rouge) {
        ouvert = false;
        continue;
      }
      if (!ouvert) ctx.moveTo(px(s.t), py(s.uSat));
      ctx.lineTo(px(suivant.t), py(suivant.uSat));
      ouvert = true;
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rouge ? ROUGE : ENCRE;
    ctx.lineWidth = rouge ? 3.4 : 2.6;
    ctx.stroke();
  }
}

/** Point courant et sa valeur écrite à côté. */
function curseur(c: Crayon, t: number, valeur: number, texte: string, couleur: string): void {
  const x = px(t);
  const y = py(valeur);
  c.point(x, y, 3.2, 1, couleur === ROUGE_TEXTE ? ROUGE : ENCRE);
  const aDroite = x < X1 - 70;
  const yt = Math.max(
    haut + DECALAGE_ZONE + 10,
    Math.min(haut + DECALAGE_ZONE + H_ZONE - 4, y - 6),
  );
  c.texte(texte, aDroite ? x + 7 : x - 7, yt, 15, aDroite ? 'left' : 'right', couleur);
}

/** Petit échantillon de trait pour la légende. */
function legende(
  c: Crayon,
  x: number,
  y: number,
  texte: string,
  motif: readonly number[],
  epaisseur: number,
): void {
  c.tirets(x, y - 4, x + 22, y - 4, motif, epaisseur, 1, ENCRE);
  c.texte(texte, x + 26, y, 14, 'left', ENCRE);
}

/** Se place sur un feuillet (pour les fonctions px et py). */
function choisir(indice: number, e: Echelle): void {
  haut = HAUTS[indice] ?? 0;
  echelleCourante = e;
}

/**
 * Partie FIXE de la colonne « Les courbes » (peinte sur le fond, une fois par trajet) : titres,
 * axes, graduations, butée, légende.
 */
export function dessinerCourbesFixe(c: Crayon, trajet: TrajetReference, echelles: Echelles): void {
  tMax = echelles.tMax;
  const niveau2 = trajet.niveau === 'level2';
  feuillet(c, 0, 'erreur e (m)', echelles.e, false);
  if (niveau2) {
    c.texte('aire hachurée = ∫e dt', X1, haut + DECALAGE_ZONE + 12, 14, 'right', ENCRE_PALE);
  }
  feuillet(c, 1, 'commande (N)', echelles.force, false);
  const yb = py(trajet.physique.uMax);
  c.tirets(X0, yb, X1, yb, TIRETS_BUTEE, 1.2, 0.9, GRAPHITE);
  c.hachures(
    X0,
    haut + DECALAGE_ZONE,
    X1 - X0,
    yb - haut - DECALAGE_ZONE,
    Math.PI / 4,
    9,
    0.7,
    0.18,
  );
  c.texte('butée ' + nb(trajet.physique.uMax) + ' N', X1, yb - 4, 13, 'right', ENCRE_PALE);
  const yl = haut + 16;
  legende(c, 984, yl, 'appliquée', AUCUN, 2.6);
  legende(c, 1078, yl, niveau2 ? 'P + I' : 'demandée', TIRETS_DEMANDE, 1.6);
  if (niveau2) {
    legende(c, 1146, yl, 'P', TIRETS_P, 1.4);
    legende(c, 1196, yl, 'I', TIRETS_I, 1.8);
  }
  feuillet(c, 2, 'vitesse v (m/s)', echelles.v, false);
  feuillet(c, 3, 'accélération a (m/s²)', echelles.a, true);
}

/** Partie VARIABLE de la colonne « Les courbes » : tracés jusqu'à l'instant courant. */
export function dessinerCourbes(c: Crayon, etat: Readonly<EtatRejeu>, echelles: Echelles): void {
  tMax = echelles.tMax;
  const trajet = etat.trajet;
  const niveau2 = trajet.niveau === 'level2';
  const s = etat.echantillon;
  const t = etat.t;
  if (etat.phase === 'attente') {
    c.texte(
      'Rien n’est encore tracé : appuie sur « Lancer ».',
      1082,
      164,
      16,
      'center',
      ENCRE_PALE,
    );
    return;
  }

  // --- Erreur e, avec l'aire hachurée (∫e dt) au niveau 2 ------------------------------------
  choisir(0, echelles.e);
  if (niveau2) {
    const ech = trajet.echantillons;
    const ctx = c.ctx;
    const y0 = py(0);
    for (const signe of SIGNES) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px(0), y0);
      for (let k = 0; k <= etat.indice; k += 1) {
        const e = ech[k] as Echantillon;
        ctx.lineTo(px(e.t), py(e.e));
      }
      ctx.lineTo(px(t), py(s.e));
      ctx.lineTo(px(t), y0);
      ctx.closePath();
      ctx.clip();
      const zy = signe > 0 ? haut + DECALAGE_ZONE : y0;
      const zh = signe > 0 ? y0 - zy : haut + DECALAGE_ZONE + H_ZONE - y0;
      ctx.beginPath();
      ctx.rect(X0, zy, px(t) - X0 + 1, zh);
      ctx.clip();
      const angle = signe > 0 ? Math.PI / 3 : -Math.PI / 3;
      c.hachuresDansZone(X0, zy, px(t) - X0 + 1, zh, angle, 5, 0.9, 0.55);
      ctx.restore();
    }
  }
  trace(c, etat, 'e', 2.2, 1, AUCUN);

  // --- Commande -----------------------------------------------------------------------------
  choisir(1, echelles.force);
  if (niveau2) {
    trace(c, etat, 'p', 1.4, 0.9, TIRETS_P);
    trace(c, etat, 'i', 1.8, 0.95, TIRETS_I);
  }
  trace(c, etat, 'uCmd', 1.6, 0.95, TIRETS_DEMANDE);
  traceAppliquee(c, etat);
  curseur(c, t, s.uSat, nb(s.uSat) + ' N', s.saturated ? ROUGE_TEXTE : ENCRE);

  // --- Vitesse et accélération --------------------------------------------------------------
  choisir(2, echelles.v);
  trace(c, etat, 'v', 2.2, 1, AUCUN);
  choisir(3, echelles.a);
  trace(c, etat, 'a', 2.2, 1, AUCUN);

  // --- Instant courant : trait vertical sur les quatre feuillets ---------------------------
  const x = px(t);
  const haut0 = (HAUTS[0] ?? 0) + DECALAGE_ZONE;
  const bas3 = (HAUTS[3] ?? 0) + DECALAGE_ZONE + H_ZONE;
  c.tirets(x, haut0, x, bas3, TIRETS_INSTANT, 1, 0.7);
  choisir(0, echelles.e);
  curseur(c, t, s.e, nb(s.e, 2) + ' m', ENCRE);
  choisir(2, echelles.v);
  curseur(c, t, s.v, nb(s.v, 2) + ' m/s', ENCRE);
  choisir(3, echelles.a);
  curseur(c, t, s.a, nb(s.a, 1) + ' m/s²', ENCRE);
}
