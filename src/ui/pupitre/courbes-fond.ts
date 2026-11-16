/**
 * Colonne des courbes (T-051), couche FIXE : plaque rivetée, quatre enregistreurs à papier
 * millimétré (quadrillage, repères, chiffres des échelles, titres, légendes), ligne de la limite du
 * moteur ±Umax, axe du temps commun. Redessinée seulement quand le fond change (ouverture, langue,
 * niveau, police). Habillage de la maquette A du lot B (enregistreurs à papier) et lisibilité de la
 * maquette B (quatre courbes alignées), nettoyés ; aucun import de `src/proto`.
 */
import type { LevelId } from '../../game';
import type { Translator } from '../../i18n';
import {
  ECHELLES,
  fractionSurEchelle,
  graduationsEchelle,
  type EchelleSignal,
} from './courbes-echelles';
import { dispositionCourbes, type BandeCourbes, type DispositionCourbes } from './courbes-plan';
import { STYLES, type CleSignal } from './courbes-style';
import {
  ENCRE,
  ENCRE_DOUCE,
  GRAPHITE,
  MINE,
  MINE_FINE,
  ROUGE,
  ROUGE_TEXTE,
  alea,
  plaque,
  rect,
  texte,
  trait,
} from './crayon';
import { FORCE_MAX } from './machine-plan';
import type { RectPlan } from './plan';

/** Papier des enregistreurs : plus clair que la plaque. */
export const PAPIER_ENREGISTREUR = '#fffef8';
/** Taille des textes de la colonne (unités) : 16 au moins. */
export const TAILLE = 16;
/** Symbole de la limite du moteur (identique dans toutes les langues). */
export const SYMBOLE_UMAX = '±Umax';
/** Symboles des termes P et I (identiques dans toutes les langues). */
export const SYMBOLE_P = 'P';
/** Voir {@link SYMBOLE_P}. */
export const SYMBOLE_I = 'I';
/** Longueur de l'échantillon de trait des légendes (unités). */
export const ECHANTILLON = 24;

/** Ordonnée d'une valeur sur un papier (valeur écrêtée à l'échelle). */
export function yDeValeur(
  bande: Readonly<Pick<BandeCourbes, 'haut' | 'bas'>>,
  echelle: Readonly<Pick<EchelleSignal, 'min' | 'max'>>,
  valeur: number,
): number {
  return bande.bas - fractionSurEchelle(echelle, valeur) * (bande.bas - bande.haut);
}

/** Échantillon de trait d'une légende, au style du signal. */
function echantillon(ctx: CanvasRenderingContext2D, cle: CleSignal, x: number, y: number): void {
  const style = STYLES[cle];
  ctx.save();
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = style.largeur;
  ctx.lineCap = 'round';
  ctx.setLineDash(style.tirets);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + ECHANTILLON, y);
  ctx.stroke();
  ctx.restore();
}

/** Colonnes d'une rangée de légende : abscisse de chaque moitié et largeur d'une moitié. */
export interface ColonnesLegende {
  readonly gauche: number;
  readonly droite: number;
  readonly largeur: number;
}

/**
 * Colonnes des rangées de légende de la colonne (deux moitiés égales entre les marges).
 * @param r rectangle de la colonne.
 */
export function colonnesLegende(r: Readonly<RectPlan>): ColonnesLegende {
  const largeur = (r.w - 2 * 16) / 2;
  return { gauche: r.x + 16, droite: r.x + 16 + largeur, largeur };
}

/** Quadrillage d'un papier : traits fins et traits majeurs, ligne du zéro. */
function papier(
  ctx: CanvasRenderingContext2D,
  g: Readonly<DispositionCourbes>,
  bande: Readonly<BandeCourbes>,
  echelle: Readonly<EchelleSignal>,
  dureeMax: number,
  pasTemps: number,
): void {
  const largeur = g.x1 - g.x0;
  ctx.fillStyle = PAPIER_ENREGISTREUR;
  ctx.fillRect(g.x0, bande.haut, largeur, bande.bas - bande.haut);
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 1;
  // Traits fins : demi-pas de la valeur et demi-seconde.
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  for (let v = echelle.min + echelle.pas / 2; v < echelle.max; v += echelle.pas) {
    const y = Math.round(yDeValeur(bande, echelle, v)) + 0.5;
    ctx.moveTo(g.x0, y);
    ctx.lineTo(g.x1, y);
  }
  for (let t = pasTemps / 2; t < dureeMax; t += pasTemps) {
    const x = Math.round(g.x0 + (t / dureeMax) * largeur) + 0.5;
    ctx.moveTo(x, bande.haut);
    ctx.lineTo(x, bande.bas);
  }
  ctx.stroke();
  // Traits majeurs : pas de la valeur et seconde.
  ctx.globalAlpha = 0.24;
  ctx.beginPath();
  for (const grad of graduationsEchelle(echelle)) {
    const y = Math.round(yDeValeur(bande, echelle, grad.valeur)) + 0.5;
    ctx.moveTo(g.x0, y);
    ctx.lineTo(g.x1, y);
  }
  for (let t = pasTemps; t < dureeMax; t += pasTemps) {
    const x = Math.round(g.x0 + (t / dureeMax) * largeur) + 0.5;
    ctx.moveTo(x, bande.haut);
    ctx.lineTo(x, bande.bas);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Dessine le fond de la colonne.
 * @param ctx contexte du canvas de fond.
 * @param r rectangle de la colonne.
 * @param niveau niveau.
 * @param tr traducteur.
 */
export function dessinerFondCourbes(
  ctx: CanvasRenderingContext2D,
  r: Readonly<RectPlan>,
  niveau: LevelId,
  tr: Translator,
): void {
  const g = dispositionCourbes(r, niveau);
  const ech = ECHELLES[niveau];
  const hasard = alea(202);
  plaque(ctx, r.x, r.y, r.w, r.h, hasard);
  texte(ctx, tr.t('pupitre.courbes.titre'), r.x + 24, g.titreY, 22, 'left');

  const titres: Readonly<Record<BandeCourbes['id'], string>> = {
    erreur: tr.t('pupitre.courbes.erreur'),
    commande: tr.t('pupitre.courbes.commande'),
    vitesse: tr.t('pupitre.courbes.vitesse'),
    acceleration: tr.t('pupitre.courbes.acceleration'),
  };
  const echelles: Readonly<Record<BandeCourbes['id'], EchelleSignal>> = {
    erreur: ech.erreur,
    commande: ech.commande,
    vitesse: ech.vitesse,
    acceleration: ech.acceleration,
  };
  const legende = colonnesLegende(r);

  g.bandes.forEach((bande, rang) => {
    const e = echelles[bande.id];
    papier(ctx, g, bande, e, ech.temps.max, ech.temps.pas / 2);
    // Ligne du zéro, plus appuyée.
    if (e.min < 0 && e.max > 0) {
      const y = yDeValeur(bande, e, 0);
      trait(ctx, g.x0, y, g.x1, y, MINE, alea(300 + rang));
    }
    // Chiffres de l'échelle et petits traits de repère en dehors du papier.
    for (const grad of graduationsEchelle(e)) {
      const y = yDeValeur(bande, e, grad.valeur);
      trait(ctx, g.x0 - (grad.chiffre ? 7 : 4), y, g.x0 - 1, y, MINE_FINE, alea(400 + rang));
      if (grad.chiffre) {
        texte(
          ctx,
          tr.formatNumber(grad.valeur, { maximumFractionDigits: 0 }),
          g.x0 - 10,
          // Le chiffre du haut reste sous la rangée de texte, celui du bas au-dessus du papier suivant.
          Math.min(bande.bas, Math.max(bande.haut + 11, y + 5.5)),
          TAILLE,
          'right',
          ENCRE_DOUCE,
          true,
        );
      }
    }
    rect(ctx, g.x0, bande.haut, g.x1 - g.x0, bande.bas - bande.haut, MINE_FINE, alea(500 + rang));
    texte(ctx, titres[bande.id], r.x + 16, bande.titreY, TAILLE, 'left');
  });

  // Force du moteur : légendes (échantillons de trait) et limite ±Umax.
  const commande = g.bandes[1];
  const leg1 = commande.legendesY[0];
  if (leg1 !== undefined) {
    echantillon(ctx, 'uSat', legende.gauche, leg1 - 5);
    texte(
      ctx,
      tr.t('pupitre.courbes.appliquee'),
      legende.gauche + ECHANTILLON + 6,
      leg1,
      TAILLE,
      'left',
      ENCRE_DOUCE,
    );
    echantillon(ctx, 'uCmd', legende.droite, leg1 - 5);
    texte(
      ctx,
      tr.t('pupitre.courbes.demandee'),
      legende.droite + ECHANTILLON + 6,
      leg1,
      TAILLE,
      'left',
      ENCRE_DOUCE,
    );
  }
  const leg2 = commande.legendesY[1];
  if (leg2 !== undefined && ech.termesPI) {
    echantillon(ctx, 'p', legende.gauche, leg2 - 5);
    texte(ctx, SYMBOLE_P, legende.gauche + ECHANTILLON + 6, leg2, TAILLE, 'left', ENCRE_DOUCE);
    echantillon(ctx, 'i', legende.droite, leg2 - 5);
    texte(ctx, SYMBOLE_I, legende.droite + ECHANTILLON + 6, leg2, TAILLE, 'left', ENCRE_DOUCE);
  }
  ctx.save();
  ctx.strokeStyle = ROUGE;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.9;
  ctx.setLineDash([8, 5]);
  for (const sens of [1, -1]) {
    const valeur = sens * FORCE_MAX;
    if (valeur < ech.commande.min || valeur > ech.commande.max) {
      continue;
    }
    const y = yDeValeur(commande, ech.commande, valeur);
    ctx.beginPath();
    ctx.moveTo(g.x0, y);
    ctx.lineTo(g.x1, y);
    ctx.stroke();
  }
  ctx.restore();
  texte(
    ctx,
    SYMBOLE_UMAX,
    g.x1 - 4,
    yDeValeur(commande, ech.commande, FORCE_MAX) - 5,
    TAILLE,
    'right',
    ROUGE_TEXTE,
  );

  // Axe du temps commun : chiffres tous les 2 s sous le dernier papier.
  const largeur = g.x1 - g.x0;
  for (let t = 0; t <= ech.temps.max + 1e-9; t += ech.temps.chiffreTousLes) {
    const x = g.x0 + (t / ech.temps.max) * largeur;
    trait(ctx, x, g.axeBas, x, g.axeBas + 5, MINE_FINE, alea(600 + t));
    texte(
      ctx,
      tr.formatNumber(t, { maximumFractionDigits: 0 }),
      x,
      g.chiffresY,
      TAILLE,
      'center',
      ENCRE_DOUCE,
      true,
    );
  }
  texte(ctx, tr.t('pupitre.courbes.axeTemps'), r.x + 16, g.axeTitreY, TAILLE, 'left', ENCRE);
}
