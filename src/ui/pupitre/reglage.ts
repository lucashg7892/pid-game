/**
 * Colonne de gauche du pupitre : le réglage (T-049). Deux leviers verticaux Kp et Ki sur plaques
 * rivetées (habillage de la maquette A du lot B : fente graduée, coulisseau, tige et manette),
 * leurs champs numériques et le bouton « Lancer » (éléments DOM posés par `pupitre.ts` d'après
 * {@link geometrieReglage}), et sous eux une plaque d'état : temps du trajet, phase et issue.
 *
 * Lisibilité (maquette B) : les nombres sont écrits en 16 unités au moins, dans la police des
 * chiffres (virgule bien distincte du point) ; les graduations tous les 1000, un chiffre tous les
 * 2000. Niveau 1 : le levier Ki est hors service (barré, voyant éteint). Niveau 2 : le levier Kp
 * est fixé (valeur imposée, grisée, cadenas). Hors réglage libre (trajet, pause, issue), les leviers
 * sont grisés et munis d'un cadenas.
 *
 * Fond : plaques, fentes, graduations, noms, mentions « hors service ». Vif : coulisseaux, voyants,
 * cadenas, note, temps, état et issue.
 */
import type { LevelId, LevelPhase } from '../../game';
import type { Translator } from '../../i18n';
import type { ColonnePupitre, EtatPupitre } from './colonne';
import {
  ENCRE,
  ENCRE_DOUCE,
  GRAPHITE,
  MINE,
  MINE_FINE,
  MINE_HACHURE,
  MINE_ROUGE,
  PAPIER_CLAIR,
  POLICE,
  ROUGE_TEXTE,
  alea,
  arc,
  cadenas,
  cercle,
  hachuresRect,
  plaque,
  rect,
  rivet,
  texte,
  trait,
} from './crayon';
import {
  cleEtat,
  cleTitreIssue,
  fractionDe,
  graduations,
  type EtatLevier,
  type ModePupitre,
} from './modele';
import type { RectPlan } from './plan';

/** Symbole de Kp (notation scientifique, identique dans toutes les langues). */
export const SYMBOLE_KP = 'Kp';
/** Symbole de Ki. */
export const SYMBOLE_KI = 'Ki';
/** Unité de Kp. */
export const UNITE_KP = 'N/m';
/** Unité de Ki. */
export const UNITE_KI = 'N/(m·s)';

/**
 * Note de la colonne : pourquoi le réglage est figé (verrou du trajet, ou réglage du dernier essai
 * à l'issue) ; vide en réglage libre. Dessinée sous le titre et reprise par le pupitre pour les
 * lecteurs d'écran.
 * @param tr traducteur.
 * @param niveau niveau.
 * @param phase phase effective.
 * @param mode réglage libre ou lecture seule.
 */
export function texteNote(
  tr: Translator,
  niveau: LevelId,
  phase: LevelPhase,
  mode: ModePupitre,
): string {
  if (mode === 'edition') {
    return '';
  }
  if (phase === 'outcome') {
    return tr.t('pupitre.note.issue');
  }
  return tr.t(niveau === 'level2' ? 'level2.ki.locked' : 'level1.kp.locked');
}

/** Géométrie d'un levier (unités du plan). */
export interface GeometrieLevier {
  /** Milieu horizontal du bloc du levier. */
  readonly cx: number;
  /** Fente : abscisse, ordonnée du haut (valeur maximale) et du bas (valeur minimale). */
  readonly fente: { readonly x: number; readonly haut: number; readonly bas: number };
  /** Zone qui reçoit le doigt ou la souris (fente et manette). */
  readonly zone: RectPlan;
  /** Champ numérique. */
  readonly champ: RectPlan;
  /** Ordonnée de la ligne de base du nom. */
  readonly nomY: number;
}

/** Géométrie de toute la colonne (unités du plan). */
export interface GeometrieReglage {
  /** Plaque des leviers. */
  readonly plaque: RectPlan;
  /** Plaque d'état (temps, phase, issue). */
  readonly etat: RectPlan;
  /** Levier Kp. */
  readonly kp: GeometrieLevier;
  /** Levier Ki. */
  readonly ki: GeometrieLevier;
  /** Bouton « Lancer » (et « Recommencer », au même endroit). */
  readonly lancer: RectPlan;
  /** Bouton « Fermer ». */
  readonly fermer: RectPlan;
}

function levier(rx: number, ry: number, cx: number): GeometrieLevier {
  const x = rx + cx - 6;
  // Sous la note (deux lignes au plus) ; au-dessus du nom et du champ.
  const haut = ry + 88;
  const bas = ry + 230;
  return {
    cx: rx + cx,
    fente: { x, haut, bas },
    zone: { x: x - 30, y: haut - 14, w: 92, h: bas - haut + 28 },
    champ: { x: rx + cx - 62, y: ry + 288, w: 124, h: 44 },
    nomY: ry + 262,
  };
}

/**
 * Géométrie de la colonne de réglage dans son rectangle.
 * @param r rectangle de la colonne dans le plan.
 */
export function geometrieReglage(r: Readonly<RectPlan>): GeometrieReglage {
  const hauteurPlaque = 404;
  const etatY = r.y + hauteurPlaque + 8;
  return {
    plaque: { x: r.x, y: r.y, w: r.w, h: hauteurPlaque },
    etat: { x: r.x, y: etatY, w: r.w, h: r.y + r.h - etatY },
    kp: levier(r.x, r.y, 77),
    ki: levier(r.x, r.y, 231),
    lancer: { x: r.x + 24, y: r.y + 346, w: r.w - 48, h: 46 },
    fermer: { x: r.x + r.w - 126, y: r.y + r.h - 52, w: 110, h: 40 },
  };
}

/** Ordonnée d'une valeur sur la fente d'un levier. */
export function yDeValeur(g: GeometrieLevier, fraction: number): number {
  return g.fente.bas - fraction * (g.fente.bas - g.fente.haut);
}

/**
 * Fraction [0 ; 1] correspondant à une ordonnée sur la fente (hors de la fente : bornée).
 * @param g levier.
 * @param y ordonnée dans le plan.
 */
export function fractionDeY(g: GeometrieLevier, y: number): number {
  const f = (g.fente.bas - y) / (g.fente.bas - g.fente.haut);
  return Math.min(1, Math.max(0, f));
}

/** Découpe un texte en lignes d'au plus `largeur` unités (mots entiers). */
function lignes(
  ctx: CanvasRenderingContext2D,
  s: string,
  largeur: number,
  taille: number,
): string[] {
  ctx.font = `${String(taille)}px ${POLICE}`;
  const sortie: string[] = [];
  let ligne = '';
  for (const mot of s.split(' ')) {
    const essai = ligne === '' ? mot : `${ligne} ${mot}`;
    if (ligne !== '' && ctx.measureText(essai).width > largeur) {
      sortie.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  }
  if (ligne !== '') {
    sortie.push(ligne);
  }
  return sortie;
}

/** Fond d'un levier : fente, graduations, nom et unité. */
function fondLevier(
  ctx: CanvasRenderingContext2D,
  g: GeometrieLevier,
  etat: Readonly<EtatPupitre>,
  nom: string,
  unite: string,
  graine: number,
  graduer: boolean,
): void {
  const r = alea(graine);
  const { x, haut, bas } = g.fente;
  const tr = etat.traducteur;
  // Fente.
  ctx.fillStyle = '#d9d3c2';
  ctx.fillRect(x - 4, haut - 6, 8, bas - haut + 12);
  rect(ctx, x - 4, haut - 6, 8, bas - haut + 12, MINE, r);
  hachuresRect(ctx, x - 4, haut - 6, 8, bas - haut + 12, 1.2, 3, MINE_HACHURE, r);
  // Graduations : un trait tous les 1000, un chiffre tous les 2000.
  for (const grad of graduer ? graduations(etat.reglageSpec, 500, 2000) : []) {
    const y = yDeValeur(g, fractionDe(grad.valeur, etat.reglageSpec));
    const majeur = grad.valeur % 1000 === 0;
    trait(ctx, x - 10 - (majeur ? 8 : 4), y, x - 9, y, majeur ? MINE : MINE_FINE, r);
    if (grad.etiquetee) {
      texte(
        ctx,
        tr.formatNumber(grad.valeur, { maximumFractionDigits: 0 }),
        x - 22,
        y + 5.5,
        16,
        'right',
        ENCRE_DOUCE,
        true,
      );
    }
  }
  if (graduer) {
    trait(ctx, x - 9, haut, x - 9, bas, MINE_FINE, r);
  }
  // Nom et unité sous la fente.
  texte(ctx, nom, g.cx - 14, g.nomY, 26, 'left');
  texte(ctx, unite, g.cx, g.nomY + 22, 17, 'center', ENCRE_DOUCE);
}

/** Mention « hors service » posée sur le levier Ki du niveau 1. */
function fondHorsService(
  ctx: CanvasRenderingContext2D,
  g: GeometrieLevier,
  etat: Readonly<EtatPupitre>,
): void {
  const r = alea(515);
  const tr = etat.traducteur;
  const w = 124;
  const x = g.cx - w / 2;
  const y = g.fente.haut + 30;
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(x, y, w, 106);
  rect(ctx, x, y, w, 106, MINE_ROUGE, r);
  // Barre en diagonale : le levier est barré.
  trait(ctx, g.fente.x - 24, g.fente.haut - 4, g.fente.x + 24, g.fente.bas + 4, MINE_ROUGE, r);
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(x + 3, y + 3, w - 6, 100);
  texte(ctx, tr.t('pupitre.ki.horsService'), g.cx, y + 28, 19, 'center', ROUGE_TEXTE);
  let ligneY = y + 52;
  for (const ligne of lignes(ctx, tr.t('pupitre.ki.horsServiceDetail'), w - 14, 16)) {
    texte(ctx, ligne, g.cx, ligneY, 16, 'center');
    ligneY += 20;
  }
}

/** Voyant : allumé (disque et rayons) ou éteint (verre vide). */
function voyant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  allume: boolean,
  graine: number,
): void {
  const r = alea(graine);
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  cercle(ctx, x, y, 9, MINE, r);
  if (allume) {
    ctx.fillStyle = GRAPHITE;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    arc(ctx, x, y, 5, -2.6, -1.6, MINE_FINE, r);
  }
}

/** Coulisseau, tige et manette d'un levier à la valeur donnée. */
function manette(
  ctx: CanvasRenderingContext2D,
  g: GeometrieLevier,
  fraction: number,
  actif: boolean,
): void {
  const fx = g.fente.x;
  const y = yDeValeur(g, fraction);
  ctx.save();
  ctx.globalAlpha = actif ? 1 : 0.55;
  // Remplissage de la fente jusqu'au coulisseau : « combien de gain ».
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = actif ? 0.75 : 0.4;
  ctx.fillRect(fx - 2.5, y, 5, g.fente.bas - y);
  ctx.globalAlpha = actif ? 1 : 0.55;
  // Tige et boule hachurée.
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(fx, y);
  ctx.lineTo(fx + 30, y - 2);
  ctx.stroke();
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.beginPath();
  ctx.arc(fx + 36, y - 2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(fx + 36, y - 2, 8, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.5;
  for (let k = -9; k <= 9; k += 2.6) {
    ctx.beginPath();
    ctx.moveTo(fx + 31 + k, y + 7);
    ctx.lineTo(fx + 40 + k, y - 11);
    ctx.stroke();
  }
  ctx.restore();
  // Coulisseau dans la fente et index qui désigne la graduation.
  ctx.fillStyle = PAPIER_CLAIR;
  ctx.fillRect(fx - 8, y - 7, 16, 14);
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 1.7;
  ctx.strokeRect(fx - 8, y - 7, 16, 14);
  ctx.fillStyle = GRAPHITE;
  ctx.beginPath();
  ctx.moveTo(fx - 8, y);
  ctx.lineTo(fx - 15, y - 4.5);
  ctx.lineTo(fx - 15, y + 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Ligne de nom d'un levier : voyant, et cadenas + mention si le levier est figé. */
function enteteLevier(
  ctx: CanvasRenderingContext2D,
  g: GeometrieLevier,
  etatLevier: EtatLevier,
  etat: Readonly<EtatPupitre>,
  graine: number,
): void {
  voyant(ctx, g.cx - 30, g.nomY - 8, etatLevier !== 'hors-service', graine);
  if (etatLevier === 'verrouille' || etatLevier === 'fixe') {
    cadenas(ctx, g.cx + 30, g.nomY - 9);
  }
  if (etatLevier === 'fixe') {
    texte(ctx, etat.traducteur.t('pupitre.kp.fixe'), g.cx + 44, g.nomY - 2, 17, 'left', ENCRE);
  }
}

/** Colonne du réglage. */
export function creerColonneReglage(): ColonnePupitre {
  // Texte du temps : refait seulement quand le dixième de seconde ou la langue change.
  let cleTemps = Number.NaN;
  let langueTemps = '';
  let texteTemps = '';
  return {
    id: 'reglage',
    dessinerFond(ctx, rectColonne, etat): void {
      const geo = geometrieReglage(rectColonne);
      const tr = etat.traducteur;
      const p = geo.plaque;
      const r = alea(11);
      plaque(ctx, p.x, p.y, p.w, p.h, r);
      texte(ctx, tr.t('pupitre.reglage.titre'), p.x + p.w / 2, p.y + 32, 23, 'center');
      fondLevier(ctx, geo.kp, etat, SYMBOLE_KP, UNITE_KP, 21, etat.reglage.kp !== 'hors-service');
      fondLevier(ctx, geo.ki, etat, SYMBOLE_KI, UNITE_KI, 31, etat.reglage.ki !== 'hors-service');
      if (etat.reglage.ki === 'hors-service') {
        fondHorsService(ctx, geo.ki, etat);
      }
      const e = geo.etat;
      plaque(ctx, e.x, e.y, e.w, e.h, alea(41));
      for (const [cx, cy] of [
        [p.x + 18, p.y + p.h - 18],
        [p.x + p.w - 18, p.y + p.h - 18],
      ] as const) {
        rivet(ctx, cx, cy, r);
      }
    },
    dessiner(ctx, rectColonne, etat): void {
      const geo = geometrieReglage(rectColonne);
      const tr = etat.traducteur;
      const s = etat.snapshot;
      const reglage = etat.reglage;
      // Note sous le titre : verrou, ou réglage du dernier essai.
      const note = texteNote(tr, etat.niveau, etat.phase, reglage.mode);
      if (note !== '') {
        const lignesNote = lignes(ctx, note, geo.plaque.w - 36, 17);
        lignesNote.forEach((ligne, i) => {
          texte(
            ctx,
            ligne,
            geo.plaque.x + geo.plaque.w / 2,
            geo.plaque.y + 54 + i * 19,
            17,
            'center',
            ENCRE_DOUCE,
          );
        });
      }
      enteteLevier(ctx, geo.kp, reglage.kp, etat, 61);
      enteteLevier(ctx, geo.ki, reglage.ki, etat, 62);
      if (reglage.kp !== 'hors-service') {
        manette(ctx, geo.kp, fractionDe(s.kp, etat.reglageSpec), reglage.kp === 'libre');
      }
      if (reglage.ki !== 'hors-service') {
        manette(ctx, geo.ki, fractionDe(s.ki, etat.reglageSpec), reglage.ki === 'libre');
      }
      // Plaque d'état : temps, phase, issue.
      const e = geo.etat;
      const t10 = Math.round(s.t * 10);
      if (t10 !== cleTemps || langueTemps !== tr.locale) {
        cleTemps = t10;
        langueTemps = tr.locale;
        texteTemps = tr.t('hud.time.value', {
          t: tr.formatNumber(s.t, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        });
      }
      texte(ctx, texteTemps, e.x + 20, e.y + 42, 28, 'left', ENCRE, true);
      texte(
        ctx,
        tr.t(cleEtat(etat.phase, etat.enPause)),
        e.x + 20,
        e.y + 70,
        19,
        'left',
        ENCRE_DOUCE,
      );
      if (etat.phase === 'outcome' && s.outcome !== null) {
        texte(
          ctx,
          tr.t(cleTitreIssue(etat.niveau, s.outcome)),
          e.x + 20,
          e.y + 98,
          21,
          'left',
          s.outcome === 'win' ? ENCRE : ROUGE_TEXTE,
        );
      }
    },
  };
}
