/**
 * Maquette D (lot B, v0.3, JETABLE) : colonne « La machine ». Coupe de la cage d'ascenseur au
 * crayon : règle des hauteurs, cabine et bonhomme, câbles qui défilent sur les poulies, tambour
 * du treuil qui tourne d'autant que la cabine monte, moteur dont l'effort se lit aux hachures.
 */
import type { EtatRejeu } from '../contrat';
import type { IssueTrajet, TrajetReference } from '../common/types';
import { Crayon, ENCRE, ENCRE_PALE, GRAPHITE, PAPIER, ROUGE, ROUGE_TEXTE } from './crayon';
import { nb } from './format';

/** Échelle de la coupe (px par m) et ordonnée écran du sol (y = 0). */
const S = 84;
const SOL = 590;
/** Murs de la cage (x), haut de la cage (bas de la traverse). */
const MUR_G = 96;
const MUR_D = 286;
const HAUT = 108;
/** Cabine : plateau, poteaux de rambarde (où s'accrochent les câbles), centre du bonhomme. */
const CAB_G = 104;
const CAB_D = 278;
const POT_G = 124;
const POT_D = 258;
const CENTRE = 191;
const RAMBARDE = 1 * S;
/** Poulies (le câble passe sur leur gauche puis par-dessus). */
const POULIE_R = 8;
const POULIE_Y = HAUT + 10;
const CABLE_Y = POULIE_Y - POULIE_R;
/** Tambour du treuil et carter du moteur. */
const TAMBOUR_R = 24;
const TAMBOUR_X = 334;
const TAMBOUR_Y = CABLE_Y + TAMBOUR_R;
const CARTER_X = 346;
const CARTER_Y = CABLE_Y + 6;
const CARTER_L = 50;
const CARTER_H = 58;
const PLATEFORME_Y = CARTER_Y + CARTER_H + 2;
/** Écart des repères peints sur le câble (px) : ils défilent avec lui. */
const ECART_MARQUES = 24;
/** Abscisse de la cote de l'écart e. */
const COTE_X = 306;
/** Abscisses des deux poteaux (câbles). */
const POTEAUX: readonly number[] = [POT_G, POT_D];

const TAMPONS: Readonly<Record<IssueTrajet, string>> = {
  win: 'ARRIVÉ AU QUAI',
  bonk: 'CHOC !',
  noLift: 'NE DÉCOLLE PAS',
  step: 'TROP BAS',
  slow: 'TROP LENT',
};

function ecranY(y: number): number {
  return SOL - y * S;
}

/** Bonhomme bâton au chapeau melon, pieds sur le plancher (yp), mains sur la rambarde. */
function bonhomme(c: Crayon, yp: number, pose: 'debout' | 'victoire' | 'choc'): void {
  const x = CENTRE;
  const hanche = yp - 0.9 * S;
  const cou = hanche - 0.5 * S;
  const epaule = cou + 5;
  const tete = cou - 14;
  const ep = 2.4;
  c.trait(x, hanche, x - 9, yp, ep, 1, ENCRE, 0.4);
  c.trait(x, hanche, x + 9, yp, ep, 1, ENCRE, 0.4);
  c.trait(x, hanche, x + (pose === 'choc' ? 4 : 0), cou, ep, 1, ENCRE, 0.4);
  if (pose === 'victoire') {
    c.trait(x, epaule, x - 18, epaule - 18, ep, 1, ENCRE, 0.3);
    c.trait(x - 18, epaule - 18, x - 24, epaule - 40, ep, 1, ENCRE, 0.3);
    c.trait(x, epaule, x + 18, epaule - 18, ep, 1, ENCRE, 0.3);
    c.trait(x + 18, epaule - 18, x + 24, epaule - 40, ep, 1, ENCRE, 0.3);
  } else {
    const mainY = yp - RAMBARDE;
    c.trait(x, epaule, x - 22, epaule + 14, ep, 1, ENCRE, 0.3);
    c.trait(x - 22, epaule + 14, POT_G + 30, mainY, ep, 1, ENCRE, 0.3);
    c.trait(x, epaule, x + 22, epaule + 14, ep, 1, ENCRE, 0.3);
    c.trait(x + 22, epaule + 14, POT_D - 30, mainY, ep, 1, ENCRE, 0.3);
  }
  const tx = x + (pose === 'choc' ? 5 : 0);
  c.cercle(tx, tete, 10, ep, 1, ENCRE, 0.4);
  // Chapeau melon : bord et calotte.
  c.trait(tx - 13, tete - 8, tx + 13, tete - 8, 2.2, 1, ENCRE, 0.2);
  c.arc(tx, tete - 8, 8, Math.PI, Math.PI * 2, 2.2, 1, ENCRE, 0.3);
  if (pose === 'choc') {
    c.lot();
    for (let k = 0; k < 3; k += 1) {
      const sx = tx - 22 + k * 22;
      const sy = tete - 24 - (k % 2) * 6;
      c.segment(sx - 4, sy, sx + 4, sy);
      c.segment(sx, sy - 4, sx, sy + 4);
      c.segment(sx - 3, sy - 3, sx + 3, sy + 3);
      c.segment(sx - 3, sy + 3, sx + 3, sy - 3);
    }
    c.finLot(1.3, 0.95, ENCRE);
  }
}

/** Partie FIXE de la colonne « La machine » (peinte sur le fond, une fois par trajet). */
export function dessinerMachineFixe(c: Crayon, trajet: TrajetReference): void {
  const physique = trajet.physique;
  const yr = ecranY(physique.r);
  const yb = ecranY(physique.hauteurPoutre);

  // --- Sol, puits, quai d'arrivée -------------------------------------------------------
  c.trait(14, SOL, MUR_G - 6, SOL, 2.2, 1, GRAPHITE, 0.5, 2);
  c.hachures(14, SOL, MUR_G - 20, 14, Math.PI / 4, 7, 0.9, 0.5);
  c.trait(MUR_G, SOL + 14, MUR_D, SOL + 14, 1.6, 0.9);
  c.trait(MUR_D + 6, yr, 396, yr, 2.2, 1, GRAPHITE, 0.5, 2);
  c.hachures(MUR_D + 6, yr, 396 - MUR_D - 6, 22, Math.PI / 4, 7, 0.9, 0.5);
  c.trait(MUR_D + 6, yr + 22, 396, yr + 22, 1, 0.6);
  c.texte('quai d’arrivée', 300, yr + 38, 14, 'left', ENCRE_PALE);

  // --- Murs et traverse -------------------------------------------------------------------
  c.trait(MUR_G, HAUT, MUR_G, SOL + 14, 1.8, 0.95);
  c.trait(MUR_G - 6, HAUT, MUR_G - 6, SOL, 1.2, 0.8);
  c.hachures(MUR_G - 6, HAUT, 6, SOL - HAUT, Math.PI / 4, 6, 0.8, 0.45);
  c.trait(MUR_D, HAUT, MUR_D, SOL + 14, 1.8, 0.95);
  c.trait(MUR_D + 6, HAUT, MUR_D + 6, SOL, 1.2, 0.8);
  c.hachures(MUR_D, HAUT, 6, SOL - HAUT, Math.PI / 4, 6, 0.8, 0.45);
  c.rect(MUR_G - 6, HAUT - 8, MUR_D - MUR_G + 12, 8, 1.4, 0.95);
  c.hachures(MUR_G - 6, HAUT - 8, MUR_D - MUR_G + 12, 8, Math.PI / 4, 5, 0.8, 0.5);

  // --- Consigne (pointillés) et poutre -----------------------------------------------------
  c.tirets(40, yr, MUR_D, yr, [7, 5], 1.3, 0.9);
  c.texte('consigne r = ' + nb(physique.r, 0) + ' m', 296, yr - 6, 14, 'left', ENCRE);
  c.rect(MUR_G, yb - 16, 18, 16, 1.4, 1);
  c.hachures(MUR_G, yb - 16, 18, 16, Math.PI / 4, 4, 1, 0.8);
  c.hachures(MUR_G, yb - 16, 18, 16, -Math.PI / 4, 4, 1, 0.8);
  c.rect(MUR_D - 18, yb - 16, 18, 16, 1.4, 1);
  c.hachures(MUR_D - 18, yb - 16, 18, 16, Math.PI / 4, 4, 1, 0.8);
  c.hachures(MUR_D - 18, yb - 16, 18, 16, -Math.PI / 4, 4, 1, 0.8);
  c.texte('← poutre (' + nb(physique.hauteurPoutre, 2) + ' m)', 292, yb - 2, 13, 'left', ENCRE);

  // --- Règle des hauteurs ---------------------------------------------------------------
  const xr = 36;
  c.trait(xr, SOL, xr, ecranY(3.6), 1.4, 0.95, GRAPHITE, 0.3);
  c.lot();
  for (let k = 0; k <= 36; k += 1) {
    const y = ecranY(k / 10);
    const l = k % 10 === 0 ? 10 : k % 5 === 0 ? 7 : 4;
    c.segment(xr, y, xr + l, y);
  }
  c.finLot(1, 0.85);
  for (let k = 0; k <= 3; k += 1) c.texte(String(k) + ' m', xr - 4, ecranY(k) + 5, 14, 'right');
  c.texte('hauteur', xr - 22, ecranY(3.6) - 8, 13, 'left', ENCRE_PALE);
  // --- Poulies (cercles et suspentes), plateforme du moteur, légende -----------------------
  for (const xp of POTEAUX) {
    const cx = xp + POULIE_R;
    c.trait(cx, HAUT, cx, POULIE_Y, 1, 0.8, GRAPHITE, 0);
    c.cercle(cx, POULIE_Y, POULIE_R, 1.4, 0.95);
  }
  c.trait(MUR_D + 6, PLATEFORME_Y, 398, PLATEFORME_Y, 1.8, 0.95, GRAPHITE, 0.4, 2);
  c.trait(392, PLATEFORME_Y, 392, yr, 1.4, 0.85);
  c.texte('moteur du treuil', 344, PLATEFORME_Y + 18, 14, 'center', ENCRE);
}

/**
 * Partie VARIABLE de la colonne « La machine » : cabine, câbles, tambour, moteur, cotes.
 * @param secousse décalage (px) du moteur quand il force en butée (0 sinon).
 */
export function dessinerMachine(c: Crayon, etat: Readonly<EtatRejeu>, secousse: number): void {
  const trajet = etat.trajet;
  const physique = trajet.physique;
  const s = etat.echantillon;
  const attente = etat.phase === 'attente';
  const yCab = etat.cabine.y;
  const vCab = etat.cabine.v;
  const yp = ecranY(yCab);
  const yr = ecranY(physique.r);
  const sature = !attente && s.saturated;
  const effort = attente ? 0 : Math.min(1, Math.abs(s.uSat) / physique.uMax);
  const xr = 36;

  // Repère de la cabine sur la règle.
  c.trait(xr + 12, yp, xr + 22, yp - 5, 1.4, 1, ENCRE, 0.2);
  c.trait(xr + 12, yp, xr + 22, yp + 5, 1.4, 1, ENCRE, 0.2);
  c.texte('y', xr + 25, yp + 5, 15, 'left', ENCRE);

  // --- Flèche de vitesse (à gauche de la cage) --------------------------------------------
  const xv = 72;
  if (!attente && Math.abs(vCab) > 0.05) {
    const lv = Math.max(-90, Math.min(90, -vCab * 8));
    c.fleche(xv, yp - 30, xv, yp - 30 + lv, 2, 1, ENCRE, 7);
    c.texte('v', xv - 7, yp - 30 + lv / 2 + 5, 15, 'right', ENCRE);
  }

  // --- Cabine ------------------------------------------------------------------------------
  c.gomme(CAB_G, yp, CAB_D - CAB_G, 9);
  c.rect(CAB_G, yp, CAB_D - CAB_G, 9, 2.2, 1, ENCRE, 1.5);
  c.hachures(CAB_G, yp, CAB_D - CAB_G, 9, Math.PI / 4, 5, 0.9, 0.6);
  c.trait(POT_G, yp, POT_G, yp - RAMBARDE, 1.8, 0.95);
  c.trait(POT_D, yp, POT_D, yp - RAMBARDE, 1.8, 0.95);
  c.trait(POT_G, yp - RAMBARDE, POT_G + 34, yp - RAMBARDE, 1.6, 0.95);
  c.trait(POT_D, yp - RAMBARDE, POT_D - 34, yp - RAMBARDE, 1.6, 0.95);
  const pose =
    etat.issueAtteinte && trajet.issue === 'bonk'
      ? 'choc'
      : etat.issueAtteinte && trajet.issue === 'win'
        ? 'victoire'
        : 'debout';
  bonhomme(c, yp, pose);

  // --- Câbles, poulies et repères qui défilent -------------------------------------------
  const avance = yCab * S; // longueur de câble enroulée (px) depuis le départ
  for (const xp of POTEAUX) {
    const cx = xp + POULIE_R;
    const ap = avance / POULIE_R;
    c.trait(cx, POULIE_Y, cx + Math.cos(ap) * 6, POULIE_Y + Math.sin(ap) * 6, 1, 0.9, GRAPHITE, 0);
    c.trait(xp, yp - RAMBARDE, xp, POULIE_Y, 1.3, 0.95, ENCRE, 0.2);
    c.arc(cx, POULIE_Y, POULIE_R, Math.PI, Math.PI * 1.5, 1.3, 0.95, ENCRE, 0);
  }
  c.trait(POT_G + POULIE_R, CABLE_Y, TAMBOUR_X, CABLE_Y, 1.3, 0.95, ENCRE, 0.2);
  // Repères peints sur le câble : fixés au câble, donc ils montent avec la cabine.
  c.lot();
  for (const xp of POTEAUX) {
    for (let y = yp - RAMBARDE - 8; y > POULIE_Y + 2; y -= ECART_MARQUES) {
      c.segment(xp - 3, y, xp + 3, y);
    }
  }
  const phase = avance % ECART_MARQUES;
  for (let x = POT_D + POULIE_R + phase; x < TAMBOUR_X - 4; x += ECART_MARQUES) {
    c.segment(x, CABLE_Y - 3, x, CABLE_Y + 3);
  }
  c.finLot(1.2, 0.75, ENCRE);

  // --- Moteur : plateforme, carter, tambour ------------------------------------------------
  c.ctx.save();
  c.ctx.translate(secousse, secousse * 0.4);
  c.rect(CARTER_X, CARTER_Y, CARTER_L, CARTER_H, 1.8, 1, ENCRE);
  c.lot();
  for (let x = CARTER_X + 6; x < CARTER_X + CARTER_L; x += 6) {
    c.segment(x, CARTER_Y + 4, x, CARTER_Y + CARTER_H - 4);
  }
  c.finLot(0.8, 0.5);
  if (effort > 0.02) {
    // Plus le moteur force, plus le carter est noirci (hachures serrées et appuyées).
    const pas = 12 - 8 * effort;
    c.hachures(CARTER_X, CARTER_Y, CARTER_L, CARTER_H, Math.PI / 4, pas, 1.1, 0.35 + 0.5 * effort);
  }
  if (sature) {
    c.hachures(CARTER_X, CARTER_Y, CARTER_L, CARTER_H, -Math.PI / 4, 4, 1.2, 0.85, ROUGE);
    c.rect(CARTER_X - 3, CARTER_Y - 3, CARTER_L + 6, CARTER_H + 6, 1.6, 0.95, ROUGE);
  }
  // Traits d'effort au-dessus du carter : leur nombre et leur hauteur suivent la force.
  const nTraits = Math.round(effort * 5);
  c.lot();
  for (let k = 0; k < nTraits; k += 1) {
    const x = CARTER_X + 6 + k * 9;
    c.segment(x, CARTER_Y - 4, x + 2, CARTER_Y - 6 - 8 * effort);
  }
  c.finLot(1.4, 0.9, sature ? ROUGE : ENCRE);

  // Tambour : fond de papier (cache le carter), jante, moyeu, rayons qui tournent avec le câble.
  const angle = avance / TAMBOUR_R;
  c.ctx.beginPath();
  c.ctx.arc(TAMBOUR_X, TAMBOUR_Y, TAMBOUR_R, 0, Math.PI * 2);
  c.ctx.fillStyle = PAPIER;
  c.ctx.fill();
  c.cercle(TAMBOUR_X, TAMBOUR_Y, TAMBOUR_R, 2, 1, ENCRE);
  c.cercle(TAMBOUR_X, TAMBOUR_Y, TAMBOUR_R - 4, 0.9, 0.6);
  c.cercle(TAMBOUR_X, TAMBOUR_Y, 5, 1.4, 1, ENCRE);
  for (let k = 0; k < 4; k += 1) {
    const a = angle + (k * Math.PI) / 2;
    c.trait(
      TAMBOUR_X + Math.cos(a) * 5,
      TAMBOUR_Y + Math.sin(a) * 5,
      TAMBOUR_X + Math.cos(a) * (TAMBOUR_R - 4),
      TAMBOUR_Y + Math.sin(a) * (TAMBOUR_R - 4),
      1.6,
      1,
      ENCRE,
      0.2,
    );
  }
  // Repère peint sur la jante : un trait épais qui tourne.
  c.trait(
    TAMBOUR_X + Math.cos(angle + 0.8) * (TAMBOUR_R - 4),
    TAMBOUR_Y + Math.sin(angle + 0.8) * (TAMBOUR_R - 4),
    TAMBOUR_X + Math.cos(angle + 0.8) * TAMBOUR_R,
    TAMBOUR_Y + Math.sin(angle + 0.8) * TAMBOUR_R,
    3,
    1,
    ENCRE,
    0,
  );
  c.ctx.restore();

  // Légendes du moteur.
  const xm = 344;
  if (attente) {
    c.texte('à l’arrêt', xm, PLATEFORME_Y + 36, 14, 'center', ENCRE_PALE);
  } else {
    const sens = s.uSat >= 0 ? 'tire ' : 'retient ';
    c.texte(sens + nb(Math.abs(s.uSat)) + ' N', xm, PLATEFORME_Y + 36, 15, 'center', ENCRE);
    c.texte(
      'effort ' + nb(effort * 100) + ' %',
      xm,
      PLATEFORME_Y + 54,
      14,
      'center',
      sature ? ROUGE_TEXTE : ENCRE_PALE,
    );
    if (sature) {
      c.texte('AU MAXIMUM !', xm, PLATEFORME_Y + 72, 16, 'center', ROUGE_TEXTE);
    }
  }
  c.texte('câble enroulé : ' + nb(yCab, 2) + ' m', CENTRE, HAUT + 30, 14, 'center', ENCRE_PALE);

  // --- Cote de l'écart e (entre le plancher et la consigne) ------------------------------
  const ecart = etat.issueAtteinte ? physique.r - yCab : s.e;
  c.tirets(CAB_D + 2, yp, COTE_X + 6, yp, [3, 3], 1, 0.8);
  c.cote(COTE_X, yp, COTE_X, yr, 1.3, 1, ENCRE);
  const milieu = (yp + yr) / 2;
  const ye = milieu > yr + 70 ? milieu + 5 : yr + 70;
  c.texte('e = ' + nb(ecart, 2) + ' m', COTE_X + 6, ye, 16, 'left', ENCRE);
  if (ye !== milieu + 5) c.trait(COTE_X + 2, milieu, COTE_X + 10, ye - 14, 0.9, 0.7);

  // --- Tampon de l'issue ---------------------------------------------------------------
  if (etat.issueAtteinte) {
    const texte = TAMPONS[trajet.issue];
    const ctx = c.ctx;
    ctx.save();
    ctx.translate(CENTRE, 470);
    ctx.rotate(-0.12);
    const l = c.largeur(texte, 26) + 28;
    c.gomme(-l / 2, -24, l, 40);
    c.rect(-l / 2, -24, l, 40, 2.2, 1, ENCRE);
    c.rect(-l / 2 + 4, -20, l - 8, 32, 1, 0.8, ENCRE, 0);
    c.texte(texte, 0, 5, 26, 'center', ENCRE, false);
    ctx.restore();
  }
}
