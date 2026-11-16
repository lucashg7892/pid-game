/**
 * Colonne des courbes (T-051), couche VIVE : les tracés du journal du trajet (quatre enregistreurs,
 * plume à la fin), les zones de saturation, les chevrons des valeurs hors échelle, les valeurs lues,
 * et, à l'issue, la ligne du curseur et sa poignée. Redessinée à chaque image ; aucune allocation par
 * image : les tracés sont des boucles directes sur les colonnes typées du journal, les textes sont
 * recalculés seulement quand la valeur arrondie ou la langue change.
 *
 * Coût : au plus 1200 points par signal et sept signaux, soit environ 8 400 segments par image,
 * sans réduction (3,8 pas du journal par unité de largeur : un décimé par pixel ne gagnerait pas
 * plus d'un facteur 2 et pourrait écraser un pic d'un seul pas).
 */
import type { LevelId, TripLog } from '../../game';
import type { Translator } from '../../i18n';
import { ECHELLES, texteValeur, type EchelleSignal } from './courbes-echelles';
import { TAILLE, yDeValeur, type ColonnesLegende } from './courbes-fond';
import { xDePas, type BandeCourbes, type DispositionCourbes } from './courbes-plan';
import { STYLES, type CleSignal } from './courbes-style';
import {
  ENCRE,
  ENCRE_DOUCE,
  GRAPHITE,
  PAPIER_CLAIR,
  POLICE,
  POLICE_NOMBRES,
  ROUGE,
  ROUGE_TEXTE,
} from './crayon';
import type { RectPlan } from './plan';
import type { ValeursCourbes } from './curseur';

const FONTE_NOMBRES = `${String(TAILLE)}px ${POLICE_NOMBRES}`;
const FONTE_TEXTE = `${String(TAILLE)}px ${POLICE}`;
const FONTE_TEMPS = `${String(TAILLE + 2)}px ${POLICE_NOMBRES}`;
const SANS_TIRETS: number[] = [];
/** Espace insécable entre un nombre et son unité. */
const ESPACE_UNITE = String.fromCharCode(160);
/** Tiret demi-cadratin : valeur absente (aucun trajet). */
const ABSENT = '—';

/** Textes des valeurs lues. */
export interface TextesCourbes {
  /** « t = 3,25 s ». */
  t: string;
  /** « 0,52 m ». */
  e: string;
  /** « 5 000 N » (force appliquée). */
  uSat: string;
  /** « 25 000 N » (force demandée). */
  uCmd: string;
  /** « 1 200 N » (terme P). */
  p: string;
  /** « 800 N » (terme I). */
  i: string;
  /** « 8,3 m/s ». */
  v: string;
  /** « 23,8 m/s² ». */
  a: string;
}

/** Mémoire des textes : valeurs arrondies du dernier calcul. */
export interface MemoireCourbes {
  readonly textes: TextesCourbes;
  /** Valeurs arrondies (centièmes de seconde, centièmes, newtons, dixièmes…), NaN avant le premier calcul. */
  readonly rondes: Float64Array;
  /** Langue du dernier calcul. */
  langue: string;
  /** Niveau du dernier calcul. */
  vide: boolean;
}

const RANG = { t: 0, e: 1, uSat: 2, uCmd: 3, p: 4, i: 5, v: 6, a: 7 } as const;

/** Crée la mémoire des textes (vide : le premier appel de {@link majTextesCourbes} les calcule). */
export function creerMemoireCourbes(): MemoireCourbes {
  return {
    textes: { t: '', e: '', uSat: '', uCmd: '', p: '', i: '', v: '', a: '' },
    rondes: new Float64Array(8).fill(Number.NaN),
    langue: '',
    vide: false,
  };
}

/** Valeur arrondie à `decimales` près. */
function ronde(valeur: number, decimales: number): number {
  const pas = 10 ** -decimales;
  const r = Math.round(valeur / pas) * pas;
  return r === 0 ? 0 : r;
}

/**
 * Met à jour les textes lus si une valeur affichée (ou la langue) a changé, sinon ne fait rien.
 * @param mem mémoire des textes.
 * @param v valeurs lues.
 * @param niveau niveau (les échelles donnent les décimales).
 * @param tr traducteur.
 * @returns les textes à jour.
 */
export function majTextesCourbes(
  mem: MemoireCourbes,
  v: Readonly<ValeursCourbes>,
  niveau: LevelId,
  tr: Translator,
): Readonly<TextesCourbes> {
  const ech = ECHELLES[niveau];
  const t = mem.textes;
  const langue = mem.langue !== tr.locale;
  mem.langue = tr.locale;
  if (v.vide) {
    if (!mem.vide || langue) {
      mem.vide = true;
      mem.rondes.fill(Number.NaN);
      t.t = '';
      t.e = t.uSat = t.uCmd = t.p = t.i = t.v = t.a = ABSENT;
    }
    return t;
  }
  mem.vide = false;
  const maj = (rang: number, valeur: number, decimales: number): boolean => {
    const r = ronde(valeur, decimales);
    if (!langue && mem.rondes[rang] === r) {
      return false;
    }
    mem.rondes[rang] = r;
    return true;
  };
  const avec = (valeur: number, decimales: number, unite: string): string =>
    `${texteValeur(tr, valeur, decimales)}${ESPACE_UNITE}${unite}`;
  if (maj(RANG.t, v.t, 2)) {
    t.t = tr.t('pupitre.courbes.temps', { t: texteValeur(tr, v.t, 2) });
  }
  if (maj(RANG.e, v.e, ech.erreur.decimales)) {
    t.e = avec(v.e, ech.erreur.decimales, 'm');
  }
  if (maj(RANG.uSat, v.uSat, 0)) {
    t.uSat = avec(v.uSat, 0, 'N');
  }
  if (maj(RANG.uCmd, v.uCmd, 0)) {
    t.uCmd = avec(v.uCmd, 0, 'N');
  }
  if (maj(RANG.p, v.p, 0)) {
    t.p = avec(v.p, 0, 'N');
  }
  if (maj(RANG.i, v.i, 0)) {
    t.i = avec(v.i, 0, 'N');
  }
  if (maj(RANG.v, v.v, ech.vitesse.decimales)) {
    t.v = avec(v.v, ech.vitesse.decimales, 'm/s');
  }
  if (maj(RANG.a, v.a, ech.acceleration.decimales)) {
    t.a = avec(v.a, ech.acceleration.decimales, 'm/s²');
  }
  return t;
}

// --- Tracés -----------------------------------------------------------------------------------

/** Nombre maximal de chevrons mémorisés par signal (les premiers dépassements). */
const CHEVRONS_MAX = 8;

/** Tampon des chevrons d'un signal (créé une fois). */
export interface TamponChevrons {
  n: number;
  readonly x: Float64Array;
  readonly sens: Int8Array;
}

/** Crée un tampon de chevrons. */
export function creerTamponChevrons(): TamponChevrons {
  return { n: 0, x: new Float64Array(CHEVRONS_MAX), sens: new Int8Array(CHEVRONS_MAX) };
}

/**
 * Trace une colonne du journal de l'indice 0 à `n − 1` : une seule polyligne, valeurs écrêtées au bord
 * du papier ; mémorise dans `chev` l'abscisse et le sens de chaque début de dépassement.
 * Boucle directe, sans allocation.
 * @param ctx contexte 2D.
 * @param colonne colonne du journal.
 * @param n nombre de points.
 * @param e échelle du signal.
 * @param bande papier.
 * @param x0 abscisse du pas 0.
 * @param dx largeur d'un pas.
 * @param chev tampon des chevrons (réécrit).
 */
export function tracerColonne(
  ctx: CanvasRenderingContext2D,
  colonne: ArrayLike<number>,
  n: number,
  e: Readonly<Pick<EchelleSignal, 'min' | 'max'>>,
  bande: Readonly<Pick<BandeCourbes, 'haut' | 'bas'>>,
  x0: number,
  dx: number,
  chev: TamponChevrons,
): void {
  const bas = bande.bas;
  const h = bande.bas - bande.haut;
  const min = e.min;
  const k = 1 / (e.max - e.min);
  let avant = 0;
  chev.n = 0;
  ctx.beginPath();
  for (let j = 0; j < n; j += 1) {
    let f = ((colonne[j] as number) - min) * k;
    let sens = 0;
    if (f < 0) {
      f = 0;
      sens = -1;
    } else if (f > 1) {
      f = 1;
      sens = 1;
    } else if (f !== f) {
      f = 0;
    }
    const x = x0 + j * dx;
    if (sens !== 0 && sens !== avant && chev.n < CHEVRONS_MAX) {
      chev.x[chev.n] = x;
      chev.sens[chev.n] = sens;
      chev.n += 1;
    }
    avant = sens;
    if (j === 0) {
      ctx.moveTo(x, bas - f * h);
    } else {
      ctx.lineTo(x, bas - f * h);
    }
  }
  ctx.stroke();
}

/**
 * Chevron rouge plein au bord du papier, pointant vers l'extérieur : `sens` 1 pour une valeur
 * au-dessus de l'échelle (bord haut), −1 pour une valeur en dessous (bord bas).
 */
export function chevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  bande: Readonly<Pick<BandeCourbes, 'haut' | 'bas'>>,
  sens: number,
): void {
  const bord = sens > 0 ? bande.haut : bande.bas;
  const dedans = sens > 0 ? 9 : -9;
  ctx.fillStyle = ROUGE;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(x, bord);
  ctx.lineTo(x - 5, bord + dedans);
  ctx.lineTo(x + 5, bord + dedans);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.9;
}

/** Trace un signal avec son style, puis ses chevrons. */
function signal(
  ctx: CanvasRenderingContext2D,
  cle: CleSignal,
  colonne: ArrayLike<number>,
  n: number,
  e: Readonly<EchelleSignal>,
  bande: Readonly<BandeCourbes>,
  x0: number,
  dx: number,
  chev: TamponChevrons,
): void {
  const style = STYLES[cle];
  ctx.lineWidth = style.largeur;
  ctx.setLineDash(style.tirets);
  tracerColonne(ctx, colonne, n, e, bande, x0, dx, chev);
  if (chev.n > 0) {
    ctx.setLineDash(SANS_TIRETS);
    for (let c = 0; c < chev.n; c += 1) {
      chevron(ctx, chev.x[c] as number, bande, chev.sens[c] as number);
    }
  }
}

/** Disque de la plume au bout d'un tracé. */
function plume(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 3.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Texte d'une valeur lue. */
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

/** Tampons réutilisés par {@link dessinerVifCourbes} (créés une fois par colonne). */
export interface TamponsCourbes {
  readonly chevrons: TamponChevrons;
}

/** Données du dessin d'une image. */
export interface EntreeVifCourbes {
  /** Niveau. */
  readonly niveau: LevelId;
  /** Journal du trajet. */
  readonly journal: TripLog;
  /** Valeurs lues (curseur, ou fin du journal en direct). */
  readonly valeurs: Readonly<ValeursCourbes>;
  /** Textes des valeurs. */
  readonly textes: Readonly<TextesCourbes>;
  /** Textes fixes traduits. */
  readonly traducteur: Translator;
  /** Vrai si le curseur est actif (ligne et poignée dessinées). */
  readonly curseurActif: boolean;
  /** Disposition de la colonne (calculée une fois). */
  readonly disposition: Readonly<DispositionCourbes>;
  /** Colonnes des rangées de légende (calculées une fois). */
  readonly legende: Readonly<ColonnesLegende>;
}

/**
 * Dessine la partie vive de la colonne.
 * @param ctx contexte du canvas vif.
 * @param r rectangle de la colonne.
 * @param entree données de l'image.
 * @param tampons tampons réutilisés.
 */
export function dessinerVifCourbes(
  ctx: CanvasRenderingContext2D,
  r: Readonly<RectPlan>,
  entree: EntreeVifCourbes,
  tampons: TamponsCourbes,
): void {
  const { niveau, journal, valeurs, textes, curseurActif } = entree;
  const g = entree.disposition;
  const ech = ECHELLES[niveau];
  const [be, bc, bv, ba] = g.bandes;
  const n = journal.count;
  const dx = (g.x1 - g.x0) / journal.capacity;
  const tete = n - 1;

  // Valeurs lues.
  const xDroite = r.x + r.w - 16;
  const leg = entree.legende;
  const droiteGauche = leg.gauche + leg.largeur - 8;
  const droiteDroite = leg.droite + leg.largeur - 8;
  if (!valeurs.vide) {
    ecrire(ctx, textes.t, r.x + r.w - 20, g.titreY, FONTE_TEMPS, 'right', ENCRE);
  }
  ecrire(ctx, textes.e, xDroite, be.titreY, FONTE_NOMBRES, 'right', ENCRE);
  ecrire(ctx, textes.v, xDroite, bv.titreY, FONTE_NOMBRES, 'right', ENCRE);
  ecrire(ctx, textes.a, xDroite, ba.titreY, FONTE_NOMBRES, 'right', ENCRE);
  const ligne1 = bc.legendesY[0] as number;
  ecrire(ctx, textes.uSat, droiteGauche, ligne1, FONTE_NOMBRES, 'right', ENCRE);
  ecrire(
    ctx,
    textes.uCmd,
    droiteDroite,
    ligne1,
    FONTE_NOMBRES,
    'right',
    valeurs.sature ? ROUGE_TEXTE : ENCRE,
  );
  const ligne2 = bc.legendesY[1];
  if (ligne2 !== undefined && ech.termesPI) {
    ecrire(ctx, textes.p, droiteGauche, ligne2, FONTE_NOMBRES, 'right', ENCRE);
    ecrire(ctx, textes.i, droiteDroite, ligne2, FONTE_NOMBRES, 'right', ENCRE);
  }

  if (n <= 0) {
    // Papier propre : la plume attend le lancement.
    ecrire(
      ctx,
      entree.traducteur.t('pupitre.courbes.vide'),
      (g.x0 + g.x1) / 2,
      (be.haut + be.bas) / 2 + 5,
      FONTE_TEXTE,
      'center',
      ENCRE_DOUCE,
    );
    return;
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = GRAPHITE;
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 0.9;

  // Zones saturées : bandes rouges derrière la force du moteur.
  const sat = journal.saturated;
  ctx.fillStyle = ROUGE;
  ctx.globalAlpha = 0.16;
  let debut = -1;
  for (let j = 0; j <= n; j += 1) {
    const s = j < n && sat[j] === 1;
    if (s && debut < 0) {
      debut = j;
    } else if (!s && debut >= 0) {
      const xa = g.x0 + debut * dx;
      ctx.fillRect(xa, bc.haut, Math.max(1, g.x0 + j * dx - xa), bc.bas - bc.haut);
      debut = -1;
    }
  }
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 0.9;

  const chev = tampons.chevrons;
  signal(ctx, 'e', journal.e, n, ech.erreur, be, g.x0, dx, chev);
  if (ech.termesPI) {
    signal(ctx, 'p', journal.p, n, ech.commande, bc, g.x0, dx, chev);
    signal(ctx, 'i', journal.i, n, ech.commande, bc, g.x0, dx, chev);
  }
  signal(ctx, 'uCmd', journal.uCmd, n, ech.commande, bc, g.x0, dx, chev);
  signal(ctx, 'uSat', journal.uSat, n, ech.commande, bc, g.x0, dx, chev);
  signal(ctx, 'v', journal.v, n, ech.vitesse, bv, g.x0, dx, chev);
  signal(ctx, 'a', journal.a, n, ech.acceleration, ba, g.x0, dx, chev);

  // Plume : un disque au bout de chaque tracé principal (à la position du curseur s'il y en a un).
  ctx.setLineDash(SANS_TIRETS);
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 1;
  const k = curseurActif ? Math.min(valeurs.indice, tete) : tete;
  const xk = g.x0 + k * dx;
  plume(ctx, xk, yDeValeur(be, ech.erreur, journal.e[k] as number));
  plume(ctx, xk, yDeValeur(bc, ech.commande, journal.uSat[k] as number));
  plume(ctx, xk, yDeValeur(bc, ech.commande, journal.uCmd[k] as number));
  plume(ctx, xk, yDeValeur(bv, ech.vitesse, journal.v[k] as number));
  plume(ctx, xk, yDeValeur(ba, ech.acceleration, journal.a[k] as number));

  // Curseur : ligne à travers les quatre papiers, poignée sous le dernier.
  if (curseurActif) {
    const x = xDePas(g, valeurs.indice, journal.capacity);
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, be.haut);
    ctx.lineTo(x, g.axeBas + 1);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.fillRect(x - 9, g.axeBas + 1, 18, 13);
    ctx.lineWidth = 1.7;
    ctx.strokeRect(x - 9, g.axeBas + 1, 18, 13);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 3, g.axeBas + 4);
    ctx.lineTo(x - 3, g.axeBas + 11);
    ctx.moveTo(x + 3, g.axeBas + 4);
    ctx.lineTo(x + 3, g.axeBas + 11);
    ctx.stroke();
  }
  ctx.restore();
}
