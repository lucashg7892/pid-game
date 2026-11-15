/**
 * Maquette A (lot B, v0.3, jetable) : couche VIVE du pupitre, redessinée à chaque image. Aiguilles,
 * voyants, plumes et papier qui défile des enregistreurs, rotor et tambour qui tournent, câble,
 * cabine, jauge de force. Tracés directs (sans tremblé aléatoire) pour ne rien allouer par image.
 */
import type { EtatRejeu } from '../contrat';
import type { Echantillon, TrajetReference } from '../common/types';
import { ENCRE, GRAPHITE, PAPIER_CLAIR, POLICE, ROUGE, fr } from './crayon';
import { NOM_ISSUE, definitionsEnregistreurs } from './fond';
import {
  ARBRE_R,
  ARBRE_X0,
  ARBRE_X1,
  AXE_Y,
  CABLE_X,
  POULIE_Y,
  CADRANS,
  CHRONO_R,
  CHRONO_TOUR,
  CHRONO_X,
  CHRONO_Y,
  COLLECTEUR_R,
  COLLECTEUR_X0,
  COLLECTEUR_X1,
  COUPE_R_ARBRE,
  COUPE_R_ROTOR,
  COUPE_X,
  COUPE_Y,
  ENCOCHES,
  ENREG_PAS,
  ENREG_W,
  ENREG_X,
  ENREG_Y0,
  HAUTEUR,
  JAUGE_X0,
  JAUGE_X1,
  LAMES,
  LARGEUR,
  LEVIER_HAUT,
  LEVIER_KI_X,
  LEVIER_KP_X,
  LOUPE_I,
  PANNEAU_GAINS,
  PAPIER_BAS,
  PAPIER_HAUT,
  PAPIER_X0,
  PAPIER_X1,
  PLUME_X,
  PX_PAR_S,
  RAD_PAR_M,
  REGLE_X,
  ROTOR_R,
  ROTOR_X0,
  ROTOR_X1,
  TAMBOUR_R,
  TAMBOUR_X0,
  TAMBOUR_X1,
  VOYANTS,
  VOYANT_Y,
  angleCadran,
  yGain,
  yJauge,
  yRegle,
  yTrace,
  type Echelle,
} from './plan';

/** Réglage affiché par les leviers (valeurs visuelles). */
export interface Reglage {
  readonly kp: number;
  readonly ki: number;
  /** Leviers verrouillés (trajet en marche ou en pause). */
  readonly verrouille: boolean;
}

/** Sélecteurs de signaux (fonctions fixes : aucune fermeture créée par image). */
const SEL_E = (s: Readonly<Echantillon>): number => s.e;
const SEL_USAT = (s: Readonly<Echantillon>): number => s.uSat / 1000;
const SEL_UCMD = (s: Readonly<Echantillon>): number => s.uCmd / 1000;
const SEL_P = (s: Readonly<Echantillon>): number => s.p / 1000;
const SEL_I = (s: Readonly<Echantillon>): number => (s.i / 1000) * LOUPE_I;
const SEL_V = (s: Readonly<Echantillon>): number => s.v;
const SEL_A = (s: Readonly<Echantillon>): number => s.a;
type Selecteur = (s: Readonly<Echantillon>) => number;

const TIRETS_DEMANDE: number[] = [5, 3];
const TIRETS_I: number[] = [1.5, 2.5];
const SANS_TIRETS: number[] = [];

/** Contexte d'une image (réutilisé). */
interface Image {
  ctx: CanvasRenderingContext2D | null;
  /** Le rejeu a commencé (sinon instruments au repos). */
  actif: boolean;
  sature: boolean;
  /** Pulsation 0…1 des alertes (figée à 1 si mouvements réduits). */
  pulse: number;
  uSat: number;
  uCmd: number;
  v: number;
  /** Erreur affichée (au repos : cabine au sol, e = r). */
  e: number;
}
const IMG: Image = {
  ctx: null,
  actif: false,
  sature: false,
  pulse: 1,
  uSat: 0,
  uCmd: 0,
  v: 0,
  e: 0,
};

/** Contexte de dessin de l'image en cours. */
function toile(): CanvasRenderingContext2D {
  if (IMG.ctx === null) throw new Error('maquette A : aucun contexte de dessin');
  return IMG.ctx;
}

function police(ctx: CanvasRenderingContext2D, taille: number): void {
  ctx.font = `${String(taille)}px ${POLICE}`;
}

function ecrire(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  taille: number,
  align: CanvasTextAlign,
  couleur: string,
): number {
  police(ctx, taille);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = couleur;
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
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
function lampe(x: number, y: number, rayon: number, rouge: boolean, pulse: number): void {
  const ctx = toile();
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

// --- En-tête ----------------------------------------------------------------------------------

function voyants(etat: Readonly<EtatRejeu>): void {
  const [marche, pause, sat, fin] = VOYANTS;
  if (marche !== undefined && etat.phase === 'en-cours') lampe(marche.x, VOYANT_Y, 10, false, 0.6);
  if (pause !== undefined && etat.phase === 'pause') lampe(pause.x, VOYANT_Y, 10, false, 0.6);
  if (sat !== undefined && IMG.sature) lampe(sat.x, VOYANT_Y, 10, true, IMG.pulse);
  if (fin !== undefined && etat.phase === 'fini') lampe(fin.x, VOYANT_Y, 10, false, 0.6);
}

// --- Leviers ----------------------------------------------------------------------------------

function levier(cx: number, valeur: number, verrouille: boolean): void {
  const ctx = toile();
  const fx = cx + 6;
  const y = yGain(valeur);
  // tige qui sort de la fente
  trait(ctx, fx, y, fx + 30, y - 2, GRAPHITE, 4, 0.85);
  disque(ctx, fx + 34, y - 2, 7, PAPIER_CLAIR, 1);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(fx + 34, y - 2, 7, 0, Math.PI * 2);
  ctx.stroke();
  // poignée (boule hachurée)
  ctx.save();
  ctx.beginPath();
  ctx.arc(fx + 34, y - 2, 7, 0, Math.PI * 2);
  ctx.clip();
  for (let k = -8; k <= 8; k += 2.4)
    trait(ctx, fx + 30 + k, y + 6, fx + 38 + k, y - 10, GRAPHITE, 0.8, 0.5);
  ctx.restore();
  disque(ctx, fx + 31.5, y - 4.5, 2, PAPIER_CLAIR, 1);
  // coulisseau dans la fente et index
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(fx - 7, y - 6, 14, 12);
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(fx - 7, y - 6, 14, 12);
  ctx.fillStyle = GRAPHITE;
  ctx.beginPath();
  ctx.moveTo(fx - 7, y);
  ctx.lineTo(fx - 13, y - 4);
  ctx.lineTo(fx - 13, y + 4);
  ctx.closePath();
  ctx.fill();
  if (verrouille) {
    // cadenas
    const lx = cx + 42;
    const ly = LEVIER_HAUT + 22;
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(lx, ly - 4, 4.5, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = GRAPHITE;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(lx - 6.5, ly - 4, 13, 10);
    ctx.globalAlpha = 1;
  }
}

function gains(trajet: TrajetReference, reglage: Readonly<Reglage>): void {
  const ctx = toile();
  levier(LEVIER_KP_X, reglage.kp, reglage.verrouille);
  if (trajet.niveau === 'level2') levier(LEVIER_KI_X, reglage.ki, reglage.verrouille);
  const p = PANNEAU_GAINS;
  const different =
    reglage.kp !== trajet.kp || (trajet.niveau === 'level2' && reglage.ki !== trajet.ki);
  const note = reglage.verrouille
    ? 'leviers verrouillés pendant le trajet'
    : different
      ? 'réglage ≠ trajet de référence : le rejeu ne change pas'
      : 'réglage visuel : Lancer rejoue le trajet de référence';
  ecrire(
    ctx,
    note,
    p.x + p.w / 2,
    p.y + 42,
    13,
    'center',
    different && !reglage.verrouille ? ROUGE : ENCRE,
  );
}

// --- Chronomètre et issue ---------------------------------------------------------------------

const PHASE: Readonly<Record<EtatRejeu['phase'], string>> = {
  attente: 'EN ATTENTE',
  'en-cours': 'EN MARCHE',
  pause: 'EN PAUSE',
  fini: 'TRAJET TERMINÉ',
};

function chrono(etat: Readonly<EtatRejeu>): void {
  const ctx = toile();
  const a = -Math.PI / 2 + (etat.t / CHRONO_TOUR) * Math.PI * 2;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  trait(
    ctx,
    CHRONO_X - ca * 12,
    CHRONO_Y - sa * 12,
    CHRONO_X + ca * (CHRONO_R - 6),
    CHRONO_Y + sa * (CHRONO_R - 6),
    GRAPHITE,
    2.2,
    0.95,
  );
  disque(ctx, CHRONO_X, CHRONO_Y, 4.5, GRAPHITE, 0.9);
  disque(ctx, CHRONO_X, CHRONO_Y, 1.5, PAPIER_CLAIR, 1);

  const x = 158;
  ecrire(ctx, `t = ${fr(etat.t, 2)} s`, x, 521, 27, 'left', ENCRE);
  ecrire(ctx, PHASE[etat.phase], x, 562, 17, 'left', ENCRE);
  if (etat.phase === 'attente') ecrire(ctx, 'appuyer sur LANCER', x, 578, 13, 'left', ENCRE);
  else if (etat.phase === 'pause') ecrire(ctx, 'P pour reprendre', x, 578, 13, 'left', ENCRE);
  const tr = etat.trajet;
  if (etat.issueAtteinte) {
    const bon = tr.issue === 'win';
    lampe(x + 12, 612, 10, !bon, bon ? 0.6 : IMG.pulse);
    ecrire(ctx, NOM_ISSUE[tr.issue], x + 30, 622, 21, 'left', bon ? ENCRE : ROUGE);
    const detail =
      tr.issue === 'win'
        ? `écart final ${fr(tr.erreurFinale * 100, 1)} cm`
        : tr.issue === 'bonk'
          ? 'la cabine heurte la poutre'
          : tr.issue === 'noLift'
            ? 'la cabine reste au sol'
            : tr.issue === 'step'
              ? 'arrêt sous la consigne'
              : 'stabilisation trop lente';
    ecrire(ctx, detail, x, 642, 13, 'left', ENCRE);
  } else {
    ecrire(ctx, '—', x + 32, 620, 18, 'left', ENCRE);
  }
}

// --- Enregistreurs ----------------------------------------------------------------------------

function courbe(
  etat: Readonly<EtatRejeu>,
  y0: number,
  echelle: Echelle,
  sel: Selecteur,
  couleur: string,
  largeur: number,
  tirets: number[],
): void {
  const ctx = toile();
  const ech = etat.trajet.echantillons;
  const dt = etat.trajet.dt;
  const t = etat.t;
  const tGauche = t - (PLUME_X - PAPIER_X0) / PX_PAR_S;
  const j0 = Math.max(0, Math.floor(tGauche / dt));
  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = largeur;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(tirets);
  ctx.beginPath();
  let premier = true;
  for (let j = j0; j <= etat.indice; j++) {
    const s = ech[j];
    if (s === undefined) break;
    const x = PLUME_X - (t - s.t) * PX_PAR_S;
    const y = yTrace(y0, echelle, sel(s));
    if (premier) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    premier = false;
  }
  ctx.lineTo(PLUME_X, yTrace(y0, echelle, sel(etat.echantillon)));
  ctx.stroke();
  ctx.setLineDash(SANS_TIRETS);
  ctx.globalAlpha = 1;
}

function plume(y: number, couleur: string): void {
  const ctx = toile();
  trait(ctx, PLUME_X, y, PLUME_X + 14, y, couleur, 1.4, 0.95);
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(PLUME_X + 10, y - 4, 10, 8);
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(PLUME_X + 10, y - 4, 10, 8);
  disque(toile(), PLUME_X, y, 2, couleur, 0.95);
}

function papier(etat: Readonly<EtatRejeu>, y0: number): void {
  const ctx = toile();
  const t = etat.t;
  const tGauche = t - (PLUME_X - PAPIER_X0) / PX_PAR_S;
  const tDroite = t + (PAPIER_X1 - PLUME_X) / PX_PAR_S;
  const m0 = Math.ceil(tGauche * 10);
  const m1 = Math.floor(tDroite * 10);
  const haut = y0 + PAPIER_HAUT;
  const bas = y0 + PAPIER_BAS;
  ctx.lineWidth = 0.8;
  for (let classe = 0; classe < 3; classe++) {
    ctx.strokeStyle = classe === 0 ? '#86b9b2' : '#3d8580';
    ctx.globalAlpha = classe === 0 ? 0.3 : classe === 1 ? 0.35 : 0.6;
    ctx.beginPath();
    for (let m = m0; m <= m1; m++) {
      const c = m % 10 === 0 ? 2 : m % 5 === 0 ? 1 : 0;
      if (c !== classe) continue;
      const x = PLUME_X - (t - m / 10) * PX_PAR_S;
      ctx.moveTo(x, haut + 7);
      ctx.lineTo(x, bas - (c === 2 ? 2 : 13));
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // perforations d'entraînement
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (let m = Math.ceil(tGauche * 4); m <= Math.floor(tDroite * 4); m++) {
    const x = PLUME_X - (t - m / 4) * PX_PAR_S;
    ctx.moveTo(x + 1.6, haut + 4);
    ctx.arc(x, haut + 4, 1.6, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // secondes imprimées
  police(ctx, 12);
  ctx.textAlign = 'right';
  ctx.fillStyle = ENCRE;
  for (let s = Math.max(0, Math.ceil(tGauche)); s <= Math.floor(tDroite); s++) {
    const x = PLUME_X - (t - s) * PX_PAR_S;
    ctx.fillText(`${String(s)} s`, x - 3, bas - 3);
  }
}

function enregistreurs(etat: Readonly<EtatRejeu>): void {
  const ctx = toile();
  const defs = definitionsEnregistreurs(etat.trajet);
  const niveau2 = etat.trajet.niveau === 'level2';
  const s = etat.echantillon;
  const xd = ENREG_X + ENREG_W - 14;
  for (let k = 0; k < defs.length; k++) {
    const def = defs[k];
    if (def === undefined) continue;
    const y0 = ENREG_Y0 + k * ENREG_PAS;
    const e = def.echelle;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAPIER_X0, y0 + PAPIER_HAUT, PAPIER_X1 - PAPIER_X0, PAPIER_BAS - PAPIER_HAUT);
    ctx.clip();
    papier(etat, y0);
    if (IMG.actif) {
      if (k === 0) courbe(etat, y0, e, SEL_E, GRAPHITE, 1.8, SANS_TIRETS);
      else if (k === 1) {
        courbe(etat, y0, e, SEL_UCMD, ROUGE, 1.4, TIRETS_DEMANDE);
        courbe(etat, y0, e, SEL_USAT, GRAPHITE, 1.9, SANS_TIRETS);
      } else if (k === 2) {
        if (niveau2) courbe(etat, y0, e, SEL_I, GRAPHITE, 1.6, TIRETS_I);
        courbe(etat, y0, e, SEL_P, GRAPHITE, 1.8, SANS_TIRETS);
      } else if (k === 3) courbe(etat, y0, e, SEL_V, GRAPHITE, 1.8, SANS_TIRETS);
      else courbe(etat, y0, e, SEL_A, GRAPHITE, 1.6, SANS_TIRETS);
    }
    ctx.restore();
    // plumes et lectures
    const yv = y0 + 15;
    if (k === 0) {
      plume(yTrace(y0, e, IMG.e), GRAPHITE);
      ecrire(ctx, `e = ${fr(IMG.e, 3)} m`, xd, yv, 15, 'right', ENCRE);
    } else if (k === 1) {
      plume(yTrace(y0, e, IMG.uCmd / 1000), ROUGE);
      plume(yTrace(y0, e, IMG.uSat / 1000), GRAPHITE);
      const w = ecrire(
        ctx,
        `demandée ${fr(IMG.uCmd / 1000, 2)} kN`,
        xd,
        yv,
        15,
        'right',
        IMG.sature ? ROUGE : ENCRE,
      );
      ctx.setLineDash(TIRETS_DEMANDE);
      trait(ctx, xd - w - 26, yv - 5, xd - w - 6, yv - 5, ROUGE, 1.6);
      ctx.setLineDash(SANS_TIRETS);
      const w2 = ecrire(
        ctx,
        `appliquée ${fr(IMG.uSat / 1000, 2)}`,
        xd - w - 34,
        yv,
        15,
        'right',
        ENCRE,
      );
      trait(ctx, xd - w - w2 - 60, yv - 5, xd - w - w2 - 40, yv - 5, GRAPHITE, 2);
    } else if (k === 2) {
      const p = IMG.actif ? s.p : 0;
      const i = IMG.actif ? s.i : 0;
      if (niveau2) {
        plume(yTrace(y0, e, (i / 1000) * LOUPE_I), GRAPHITE);
        plume(yTrace(y0, e, p / 1000), GRAPHITE);
        const w = ecrire(
          ctx,
          `I ${fr(i / 1000, 3)} kN (tracé ×${String(LOUPE_I)})`,
          xd,
          yv,
          15,
          'right',
          ENCRE,
        );
        ctx.setLineDash(TIRETS_I);
        trait(ctx, xd - w - 26, yv - 5, xd - w - 6, yv - 5, GRAPHITE, 1.8);
        ctx.setLineDash(SANS_TIRETS);
        const w2 = ecrire(ctx, `P ${fr(p / 1000, 2)}`, xd - w - 34, yv, 15, 'right', ENCRE);
        trait(ctx, xd - w - w2 - 60, yv - 5, xd - w - w2 - 40, yv - 5, GRAPHITE, 2);
      } else {
        plume(yTrace(y0, e, p / 1000), GRAPHITE);
        const w = ecrire(ctx, 'plume I relevée (niveau 1)', xd, yv, 13, 'right', ENCRE);
        ecrire(ctx, `P ${fr(p / 1000, 2)} kN`, xd - w - 16, yv, 15, 'right', ENCRE);
      }
    } else if (k === 3) {
      plume(yTrace(y0, e, IMG.v), GRAPHITE);
      ecrire(ctx, `v = ${fr(IMG.v, 2)} m/s`, xd, yv, 15, 'right', ENCRE);
    } else {
      const a = IMG.actif ? s.a : 0;
      plume(yTrace(y0, e, a), GRAPHITE);
      ecrire(ctx, `a = ${fr(a, 1)} m/s²`, xd, yv, 15, 'right', ENCRE);
    }
  }
}

// --- Cadrans ----------------------------------------------------------------------------------

function aiguille(cx: number, cy: number, rayon: number, a: number, couleur: string): void {
  const ctx = toile();
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.moveTo(cx + ca * (rayon - 7), cy + sa * (rayon - 7));
  ctx.lineTo(cx - sa * 2.6, cy + ca * 2.6);
  ctx.lineTo(cx - ca * 13, cy - sa * 13);
  ctx.lineTo(cx + sa * 2.6, cy - ca * 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  disque(ctx, cx, cy, 5, GRAPHITE, 0.95);
  disque(ctx, cx, cy, 1.8, PAPIER_CLAIR, 1);
}

function cadrans(): void {
  const ctx = toile();
  const valeurs0 = IMG.uSat / 1000;
  const valeurs1 = IMG.uCmd / 1000;
  for (let k = 0; k < CADRANS.length; k++) {
    const c = CADRANS[k];
    if (c === undefined) continue;
    const v = k === 0 ? valeurs0 : k === 1 ? valeurs1 : IMG.v;
    const rouge = c.rouge !== null && v > c.rouge + 0.01;
    ecrire(ctx, `${fr(v, 2)} ${c.unite}`, c.cx, c.cy + 31, 15, 'center', rouge ? ROUGE : ENCRE);
    aiguille(c.cx, c.cy, c.rayon, angleCadran(c, v), rouge ? ROUGE : GRAPHITE);
    if (k === 0 && IMG.sature) {
      // l'aiguille bute : petits traits de choc rouges
      const a = angleCadran(c, c.max);
      const bx = c.cx + Math.cos(a) * (c.rayon - 8);
      const by = c.cy + Math.sin(a) * (c.rayon - 8);
      const l = 3 + 3 * IMG.pulse;
      for (let j = 0; j < 4; j++) {
        const b = a + 0.5 + j * 0.7;
        trait(
          ctx,
          bx + Math.cos(b) * 5,
          by + Math.sin(b) * 5,
          bx + Math.cos(b) * (5 + l),
          by + Math.sin(b) * (5 + l),
          ROUGE,
          1.3,
        );
      }
      ecrire(ctx, 'BUTÉE', c.cx, c.cy + 49, 13, 'center', ROUGE);
    }
  }
}

// --- Moteur -----------------------------------------------------------------------------------

/** Lignes d'une surface cylindrique vue de côté qui tourne (génératrices visibles seulement). */
function generatrices(
  x0: number,
  x1: number,
  rayon: number,
  phi: number,
  n: number,
  largeur: number,
  repere: boolean,
): void {
  const ctx = toile();
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

function etincelles(x: number, y: number, s: number): void {
  const ctx = toile();
  const l = 3 + 4 * IMG.pulse;
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
  cx: number,
  cy: number,
  rayon: number,
  a0: number,
  a1: number,
  couleur: string,
  largeur: number,
): void {
  const ctx = toile();
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
function brin(xa: number, ya: number, xb: number, yb: number, decal: number): void {
  const ctx = toile();
  const lg = Math.hypot(xb - xa, yb - ya);
  if (lg < 1) return;
  const ux = (xb - xa) / lg;
  const uy = (yb - ya) / lg;
  trait(ctx, xa - uy * 0.8, ya + ux * 0.8, xb - uy * 0.8, yb + ux * 0.8, GRAPHITE, 1.1, 0.95);
  trait(ctx, xa + uy * 0.8, ya - ux * 0.8, xb + uy * 0.8, yb - ux * 0.8, GRAPHITE, 1.1, 0.95);
  for (let d = decal; d < lg; d += 14) {
    const x = xa + ux * d;
    const y = ya + uy * d;
    trait(ctx, x - uy * 2.5, y + ux * 2.5, x + uy * 2.5, y - ux * 2.5, GRAPHITE, 1.1);
  }
}

function moteur(etat: Readonly<EtatRejeu>, reduit: boolean, maintenant: number): void {
  const ctx = toile();
  const yc = IMG.actif ? etat.cabine.y : 0;
  const phi = yc * RAD_PAR_M;
  const effort = Math.min(1, Math.abs(IMG.uSat) / 5000);
  const signe = IMG.uSat >= 0 ? 1 : -1;
  const couleurEffort = IMG.sature ? ROUGE : GRAPHITE;

  // vue de côté : encoches du rotor, lames du collecteur
  generatrices(ROTOR_X0 + 2, ROTOR_X1 - 2, ROTOR_R - 2, phi, ENCOCHES, 1.4, true);
  generatrices(COLLECTEUR_X0 + 1, COLLECTEUR_X1 - 1, COLLECTEUR_R - 1, phi, LAMES, 1, false);
  if (IMG.sature) {
    etincelles(1014, AXE_Y - COLLECTEUR_R, -1);
    etincelles(1014, AXE_Y + COLLECTEUR_R, 1);
  }
  // jauge de torsion de l'arbre : génératrices inclinées selon l'effort
  const dx = signe * effort * 9;
  for (let x = ARBRE_X0 + 6; x <= ARBRE_X1 - 6; x += 5) {
    trait(
      ctx,
      x - dx,
      AXE_Y - ARBRE_R + 1,
      x + dx,
      AXE_Y + ARBRE_R - 1,
      couleurEffort,
      0.9 + effort * 1.2,
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
  generatrices(TAMBOUR_X0 + 1, TAMBOUR_X1 - 1, TAMBOUR_R - 1, phi, 10, 1, true);
  const largeurEnroulee = Math.min(TAMBOUR_X1 - TAMBOUR_X0 - 4, 6 + Math.max(0, yc) * 17);
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

  // câble jusqu'à la cabine, avec des repères qui défilent
  const yCab = yRegle(Math.max(0, yc));
  // du tambour à la poulie de renvoi, puis à la verticale jusqu'au toit de la cabine
  const pas = 14;
  const decal = (((-yc * 60) % pas) + pas) % pas;
  brin(xe - 1, AXE_Y + TAMBOUR_R + 2, CABLE_X, POULIE_Y, decal);
  brin(CABLE_X, POULIE_Y, CABLE_X, yCab - 26, decal);
  // cabine et bonhomme
  // cabine étroite entre les corbeaux de la poutre ; seul le plancher, large, peut les heurter
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
  ctx.setLineDash(TIRETS_I);
  trait(ctx, REGLE_X + 3, yCab, CABLE_X - 21, yCab, GRAPHITE, 1);
  ctx.setLineDash(SANS_TIRETS);
  ctx.fillStyle = GRAPHITE;
  ctx.beginPath();
  ctx.moveTo(REGLE_X + 1, yCab);
  ctx.lineTo(REGLE_X + 7, yCab - 3.5);
  ctx.lineTo(REGLE_X + 7, yCab + 3.5);
  ctx.closePath();
  ctx.fill();
  ecrire(ctx, `cabine : ${fr(yc, 2)} m`, 1046, 474, 13, 'left', ENCRE);

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
  const omega = IMG.v * RAD_PAR_M;
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
  const ak = -phi;
  ctx.fillStyle = GRAPHITE;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ak);
  ctx.fillRect(COUPE_R_ARBRE - 4, -2, 4, 4);
  ctx.restore();
  // couple : deux flèches courbes, épaisses selon la force appliquée
  if (IMG.actif && effort > 0.01) {
    const ouverture = 0.12 + 0.5 * effort;
    const larg = 1 + 3.5 * effort;
    const rr = COUPE_R_ROTOR + 9;
    for (const base of [0, Math.PI]) {
      const a0 = base + ouverture * signe;
      const a1 = base - ouverture * signe;
      fleche(cx, cy, rr, a0, a1, couleurEffort, larg);
    }
  }
  // tremblement de la carcasse en saturation
  if (IMG.sature) {
    const dec = reduit ? 0 : Math.sin(maintenant / 23) * 1.5;
    for (let j = 0; j < 3; j++) {
      trait(ctx, 878 + dec, 300 + j * 8, 872 + dec, 296 + j * 8, ROUGE, 1.3);
      trait(ctx, 1046 - dec, 300 + j * 8, 1052 - dec, 296 + j * 8, ROUGE, 1.3);
      trait(ctx, cx - 86 + dec, cy - 20 + j * 10, cx - 80 + dec, cy - 24 + j * 10, ROUGE, 1.3);
      trait(ctx, cx + 80 - dec, cy - 20 + j * 10, cx + 86 - dec, cy - 24 + j * 10, ROUGE, 1.3);
    }
    ecrire(ctx, 'SATURATION', 1060, 268 - 0, 15, 'left', ROUGE);
  }
}

// --- Jauge de force ---------------------------------------------------------------------------

function jauge(): void {
  const ctx = toile();
  const y0 = yJauge(0);
  const ys = yJauge(IMG.uSat / 1000);
  const yd = yJauge(IMG.uCmd / 1000);
  // force appliquée : colonne hachurée serrée
  const haut = Math.min(y0, ys);
  const h = Math.abs(ys - y0);
  if (h > 0.5) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(JAUGE_X0 + 1, haut, JAUGE_X1 - JAUGE_X0 - 2, h);
    ctx.clip();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = GRAPHITE;
    ctx.fillRect(JAUGE_X0, haut, JAUGE_X1 - JAUGE_X0, h);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let y = haut - 24; y < haut + h + 4; y += 3.4) {
      ctx.moveTo(JAUGE_X0, y + 20);
      ctx.lineTo(JAUGE_X1, y);
    }
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    trait(ctx, JAUGE_X0 - 1, ys, JAUGE_X1 + 1, ys, GRAPHITE, 2.4);
  }
  // force demandée : contour rouge en tirets, au-delà s'il le faut
  if (IMG.actif) {
    ctx.setLineDash(TIRETS_DEMANDE);
    ctx.strokeStyle = ROUGE;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.95;
    ctx.strokeRect(JAUGE_X0 - 3, Math.min(y0, yd), JAUGE_X1 - JAUGE_X0 + 6, Math.abs(yd - y0));
    ctx.setLineDash(SANS_TIRETS);
    ctx.fillStyle = ROUGE;
    ctx.beginPath();
    ctx.moveTo(JAUGE_X1 + 3, yd);
    ctx.lineTo(JAUGE_X1 + 9, yd - 5);
    ctx.lineTo(JAUGE_X1 + 9, yd + 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    if (IMG.sature && yd < ys) {
      // partie écrêtée : hachure croisée rouge
      ctx.save();
      ctx.beginPath();
      ctx.rect(JAUGE_X0 + 1, yd, JAUGE_X1 - JAUGE_X0 - 2, ys - yd);
      ctx.clip();
      ctx.strokeStyle = ROUGE;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      for (let y = yd - 24; y < ys + 4; y += 4) {
        ctx.moveTo(JAUGE_X0, y);
        ctx.lineTo(JAUGE_X1, y + 20);
        ctx.moveTo(JAUGE_X0, y + 20);
        ctx.lineTo(JAUGE_X1, y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
  if (IMG.sature) lampe(1248, 694, 6, true, IMG.pulse);
}

/**
 * Dessine la couche vive.
 * @param maintenant horloge murale (ms), seulement pour la pulsation des alertes.
 * @param reduit mouvements réduits demandés : alertes fixes, pas de tremblement.
 */
export function dessinerVif(
  ctx: CanvasRenderingContext2D,
  etat: Readonly<EtatRejeu>,
  reglage: Readonly<Reglage>,
  maintenant: number,
  reduit: boolean,
): void {
  ctx.clearRect(0, 0, LARGEUR, HAUTEUR);
  IMG.ctx = ctx;
  IMG.actif = etat.phase !== 'attente';
  const s = etat.echantillon;
  IMG.sature = IMG.actif && s.saturated;
  IMG.pulse = reduit ? 1 : 0.5 + 0.5 * Math.sin(maintenant / 70);
  IMG.uSat = IMG.actif ? s.uSat : 0;
  IMG.uCmd = IMG.actif ? s.uCmd : 0;
  IMG.v = IMG.actif ? s.v : 0;
  IMG.e = IMG.actif ? s.e : etat.trajet.physique.r;
  voyants(etat);
  gains(etat.trajet, reglage);
  chrono(etat);
  enregistreurs(etat);
  cadrans();
  moteur(etat, reduit, maintenant);
  jauge();
}
