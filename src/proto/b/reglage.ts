/**
 * Maquette B (jetable) : colonne de gauche. Réglage du gain (levier dessiné sur le canvas, piloté
 * par un élément DOM focalisable `role="slider"` posé dessus ; champ numérique ; bouton
 * « Lancer »), puis le temps, la phase et l'issue de l'essai.
 *
 * Le réglage est VISUEL : la maquette rejoue toujours le trajet de référence (une note le dit
 * dès que la valeur affichée diffère de celle de l'essai enregistré).
 */
import type { IssueTrajet, TrajetReference } from '../common/types';
import {
  APPUYE,
  ENCRE_DOUCE,
  FIN,
  ORDINAIRE,
  PAPIER_CLAIR,
  POLICE,
  ecrire,
  rectangle,
  trait,
  type Crayon,
} from './crayon';
import { nombre } from './format';

/** Bornes et pas du réglage (N/m pour Kp, N/(m·s) pour Ki). */
export const GAIN_MAX = 8000;
const PAS = 100;
const PAS_PAGE = 1000;

/** Levier : abscisses de la glissière (px de scène). */
const LX0 = 48;
const LX1 = 292;
const COL = 40;

/** Une commande de gain. */
export interface Gain {
  readonly nom: string;
  readonly unite: string;
  /** Ordonnée de la glissière. */
  readonly y: number;
  valeur: number;
  readonly levier: HTMLDivElement;
  readonly champ: HTMLInputElement;
}

/** La colonne de réglage. */
export interface Reglage {
  readonly kp: Gain;
  readonly ki: Gain;
  readonly bouton: HTMLButtonElement;
  /** Niveau 2 : la commande de Ki est visible. */
  niveau2: boolean;
  /** Valeurs de l'essai enregistré (pour la note « réglage visuel »). */
  kpEssai: number;
  kiEssai: number;
  /** Fixe une valeur (bornée, arrondie au pas) et met à jour le DOM. */
  regler(g: Gain, v: number): void;
  /** Gère une touche ; vrai si elle a été traitée. */
  touche(e: KeyboardEvent, g: Gain): boolean;
}

/** Feuille de style des éléments DOM de la maquette. */
export const CSS = `
.pb-scene{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0;
  pointer-events:none;color:#2a2724;font-family:${POLICE};}
.pb-scene [hidden]{display:none!important;}
.pb-levier{position:absolute;height:44px;border-radius:10px;cursor:pointer;pointer-events:auto;
  touch-action:none;}
.pb-champ{position:absolute;box-sizing:border-box;width:112px;height:40px;padding:0 8px;
  font:26px ${POLICE};color:#2a2724;background:rgba(251,247,236,0.92);border:0;
  border-bottom:2px solid #3a3a3a;border-radius:2px;text-align:right;pointer-events:auto;}
.pb-lancer{position:absolute;box-sizing:border-box;width:176px;height:56px;
  font:30px ${POLICE};color:#2a2724;background:#fbf7ec;cursor:pointer;pointer-events:auto;
  border:2.5px solid #3a3a3a;border-radius:255px 14px 225px 14px/14px 225px 14px 255px;}
.pb-lancer:hover{background:#f1e8cf;}
.pb-lancer:active{transform:translate(1px,2px);}
.pb-levier:focus-visible,.pb-champ:focus-visible,.pb-lancer:focus-visible{
  outline:3px solid #1f4e7a;outline-offset:3px;}
.pb-cache{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);
  white-space:nowrap;}
`;

function borner(v: number): number {
  const r = Math.round(v / PAS) * PAS;
  return r < 0 ? 0 : r > GAIN_MAX ? GAIN_MAX : r;
}

function xDe(v: number): number {
  return LX0 + (v / GAIN_MAX) * (LX1 - LX0);
}

/** Lit un nombre écrit à la française (espaces, virgule) ; NaN si illisible. */
function lire(texte: string): number {
  const propre = texte.replace(/\s/g, '').replace(',', '.');
  return propre === '' ? NaN : Number(propre);
}

function creerGain(
  scene: HTMLElement,
  nom: string,
  libelle: string,
  unite: string,
  y: number,
): Gain {
  const levier = document.createElement('div');
  levier.className = 'pb-levier';
  levier.tabIndex = 0;
  levier.setAttribute('role', 'slider');
  levier.setAttribute('aria-label', libelle);
  levier.setAttribute('aria-valuemin', '0');
  levier.setAttribute('aria-valuemax', String(GAIN_MAX));
  levier.style.left = String(LX0 - 14) + 'px';
  levier.style.width = String(LX1 - LX0 + 28) + 'px';
  levier.style.top = String(y - 22) + 'px';
  const champ = document.createElement('input');
  champ.className = 'pb-champ';
  champ.type = 'text';
  champ.inputMode = 'numeric';
  champ.autocomplete = 'off';
  champ.spellcheck = false;
  champ.setAttribute('aria-label', libelle + ' (' + unite + ')');
  champ.style.left = String(COL) + 'px';
  champ.style.top = String(y + 38) + 'px';
  scene.append(levier, champ);
  return { nom, unite, y, valeur: 0, levier, champ };
}

/**
 * Crée les commandes DOM dans la scène.
 * @param lancer appelé par le bouton, par Entrée sur le levier ou dans le champ.
 * @param change appelé à chaque changement de valeur (pour redessiner).
 */
export function creerReglage(scene: HTMLElement, lancer: () => void, change: () => void): Reglage {
  const kp = creerGain(scene, 'Kp', 'Gain proportionnel Kp', 'N/m', 134);
  const ki = creerGain(scene, 'Ki', 'Gain intégral Ki', 'N/(m·s)', 296);
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'pb-lancer';
  bouton.textContent = 'Lancer';
  bouton.style.left = String(COL) + 'px';
  bouton.style.top = '400px';
  bouton.addEventListener('click', lancer);
  scene.append(bouton);

  const reglage: Reglage = {
    kp,
    ki,
    bouton,
    niveau2: true,
    kpEssai: 0,
    kiEssai: 0,
    regler(g: Gain, v: number): void {
      g.valeur = borner(v);
      g.champ.value = nombre(g.valeur);
      g.levier.setAttribute('aria-valuenow', String(g.valeur));
      g.levier.setAttribute('aria-valuetext', nombre(g.valeur) + ' ' + g.unite);
      change();
    },
    touche(e: KeyboardEvent, g: Gain): boolean {
      const champ = e.target === g.champ;
      let v: number | null = null;
      switch (e.key) {
        case 'ArrowUp':
        case '+':
        case '=':
          v = g.valeur + PAS;
          break;
        case 'ArrowRight':
          if (!champ) v = g.valeur + PAS;
          break;
        case 'ArrowDown':
        case '-':
          v = g.valeur - PAS;
          break;
        case 'ArrowLeft':
          if (!champ) v = g.valeur - PAS;
          break;
        case 'PageUp':
          v = g.valeur + PAS_PAGE;
          break;
        case 'PageDown':
          v = g.valeur - PAS_PAGE;
          break;
        case 'Home':
          if (!champ) v = 0;
          break;
        case 'End':
          if (!champ) v = GAIN_MAX;
          break;
        case 'Enter':
          if (champ) valider(g);
          lancer();
          e.preventDefault();
          return true;
        case 'Escape':
          if (champ) {
            g.champ.value = nombre(g.valeur);
            return true;
          }
          return false;
        default:
          return false;
      }
      if (v === null) return false;
      if (champ) {
        const lu = lire(g.champ.value);
        if (Number.isFinite(lu) && borner(lu) !== g.valeur) {
          v = borner(lu) + (v - g.valeur);
        }
      }
      reglage.regler(g, v);
      e.preventDefault();
      return true;
    },
  };

  const valider = (g: Gain): void => {
    const lu = lire(g.champ.value);
    reglage.regler(g, Number.isFinite(lu) ? lu : g.valeur);
  };

  for (const g of [kp, ki]) {
    g.levier.addEventListener('keydown', (e) => {
      reglage.touche(e, g);
    });
    g.champ.addEventListener('keydown', (e) => {
      reglage.touche(e, g);
    });
    g.champ.addEventListener('change', () => {
      valider(g);
    });
    const depuisPointeur = (e: PointerEvent): void => {
      const r = g.levier.getBoundingClientRect();
      const echelle = r.width / (LX1 - LX0 + 28);
      const x = (e.clientX - r.left) / echelle + LX0 - 14;
      reglage.regler(g, ((x - LX0) / (LX1 - LX0)) * GAIN_MAX);
    };
    g.levier.addEventListener('pointerdown', (e) => {
      g.levier.focus();
      g.levier.setPointerCapture(e.pointerId);
      depuisPointeur(e);
      e.preventDefault();
    });
    g.levier.addEventListener('pointermove', (e) => {
      if (g.levier.hasPointerCapture(e.pointerId)) depuisPointeur(e);
    });
  }
  return reglage;
}

/** Libellés des issues : titre et explication courte. */
const ISSUES: Readonly<Record<IssueTrajet, readonly [string, string]>> = {
  win: ['Victoire !', 'arrivée au plateau, cabine stable'],
  bonk: ['Choc contre la poutre !', 'la cabine est montée trop haut'],
  noLift: ['La cabine ne décolle pas', 'la force reste sous le poids'],
  step: ['Arrêt trop bas', 'la cabine s’arrête sous le plateau'],
  slow: ['Trop lent', 'la cabine ne se stabilise pas à temps'],
};

/** Titre de l'issue d'un trajet (annonce pour les lecteurs d'écran). */
export function titreIssue(trajet: TrajetReference): string {
  return ISSUES[trajet.issue][0];
}

/** Partie fixe de la colonne (titres, glissières, graduations, aides clavier). */
export function dessinerFondReglage(cr: Crayon, r: Reglage, trajet: TrajetReference): void {
  const ctx = cr.ctx;
  ecrire(ctx, 'Réglage du gain', COL, 40, 28);
  ecrire(
    ctx,
    trajet.niveau === 'level2' ? 'niveau 2 : contrôleur P + I' : 'niveau 1 : contrôleur P seul',
    COL,
    62,
    17,
    'left',
    ENCRE_DOUCE,
  );
  const gains = r.niveau2 ? [r.kp, r.ki] : [r.kp];
  gains.forEach((g, rang) => {
    const libelle = g === r.kp ? 'gain proportionnel' : 'gain intégral';
    ecrire(ctx, g.nom, COL, g.y - 30, 22);
    ecrire(ctx, libelle, COL + 30, g.y - 30, 18, 'left', ENCRE_DOUCE);
    // Glissière : deux traits parallèles, fermés aux bouts.
    trait(cr, [LX0, g.y - 4, LX1, g.y - 4], ORDINAIRE, 700 + rang * 10);
    trait(cr, [LX0, g.y + 4, LX1, g.y + 4], ORDINAIRE, 701 + rang * 10);
    trait(cr, [LX0, g.y - 4, LX0, g.y + 4], FIN, 702 + rang * 10);
    trait(cr, [LX1, g.y - 4, LX1, g.y + 4], FIN, 703 + rang * 10);
    for (let v = 0, k = 0; v <= GAIN_MAX; v += 500, k++) {
      const majeure = v % 2000 === 0;
      trait(cr, [xDe(v), g.y + 8, xDe(v), g.y + (majeure ? 17 : 12)], FIN, 720 + rang * 40 + k);
      if (majeure) ecrire(ctx, nombre(v), xDe(v), g.y + 32, 15, 'center', ENCRE_DOUCE);
    }
    ecrire(ctx, g.unite, COL + 124, g.y + 66, 20, 'left', ENCRE_DOUCE);
  });
  if (!r.niveau2) {
    ecrire(ctx, 'Ki', COL, r.ki.y - 30, 22, 'left', ENCRE_DOUCE);
    ecrire(ctx, 'gain intégral', COL + 30, r.ki.y - 30, 18, 'left', ENCRE_DOUCE);
    ecrire(ctx, 'sans objet au niveau 1', COL, r.ki.y + 2, 18, 'left', ENCRE_DOUCE);
    ecrire(ctx, '(pas de terme intégral)', COL, r.ki.y + 24, 16, 'left', ENCRE_DOUCE);
  }
  ecrire(ctx, 'Entrée : lancer · flèches ou + − : ±100', COL, 482, 15, 'left', ENCRE_DOUCE);
  ecrire(ctx, 'Page haut / Page bas : ±1 000', COL, 500, 15, 'left', ENCRE_DOUCE);
}

/** État dynamique affiché dans la colonne. */
export interface EtatColonne {
  readonly phase: 'attente' | 'en-cours' | 'pause' | 'fini';
  readonly t: number;
  readonly issueAtteinte: boolean;
}

const PHASES: Readonly<Record<EtatColonne['phase'], string>> = {
  attente: 'en attente : règle, puis « Lancer »',
  'en-cours': 'essai en cours…',
  pause: 'en pause (P pour reprendre)',
  fini: 'essai terminé (R pour rejouer)',
};

/** Partie mobile : curseurs des leviers, note, temps, phase, issue. */
export function dessinerReglage(
  cr: Crayon,
  r: Reglage,
  trajet: TrajetReference,
  e: EtatColonne,
): void {
  const ctx = cr.ctx;
  const gains = r.niveau2 ? [r.kp, r.ki] : [r.kp];
  gains.forEach((g, rang) => {
    const x = xDe(g.valeur);
    // Remplissage de la glissière jusqu'au curseur : « combien de gain ».
    ctx.save();
    ctx.fillStyle = cr.graphite;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(LX0, g.y - 3, x - LX0, 6);
    ctx.restore();
    // Curseur : plaquette verticale avec une encoche.
    ctx.save();
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.fillRect(x - 8, g.y - 16, 16, 32);
    ctx.restore();
    rectangle(cr, x - 8, g.y - 16, 16, 32, APPUYE, 800 + rang * 10);
    trait(cr, [x, g.y - 10, x, g.y + 10], ORDINAIRE, 805 + rang * 10);
  });
  const ecart = r.kp.valeur !== r.kpEssai || (r.niveau2 && r.ki.valeur !== r.kiEssai);
  if (ecart) {
    const ref = r.niveau2
      ? 'Kp ' + nombre(r.kpEssai) + ', Ki ' + nombre(r.kiEssai)
      : 'Kp ' + nombre(r.kpEssai);
    ecrire(ctx, 'maquette : le rejeu montre l’essai', COL, 528, 15, 'left', ENCRE_DOUCE);
    ecrire(ctx, 'enregistré (' + ref + ')', COL, 546, 15, 'left', ENCRE_DOUCE);
  }
  ecrire(ctx, 't = ' + nombre(e.t, 2) + ' s', COL, 592, 36);
  ecrire(ctx, PHASES[e.phase], COL, 618, 18, 'left', ENCRE_DOUCE);
  if (e.issueAtteinte) {
    const [titre, detail] = ISSUES[trajet.issue];
    const tIssue = trajet.pasIssue * trajet.dt;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = PAPIER_CLAIR;
    ctx.fillRect(COL - 6, 634, 284, 76);
    ctx.restore();
    rectangle(cr, COL - 6, 634, 284, 76, APPUYE, 900);
    ecrire(ctx, titre, COL + 6, 664, 26);
    ecrire(ctx, detail, COL + 6, 684, 16, 'left', ENCRE_DOUCE);
    ecrire(
      ctx,
      'à t = ' + nombre(tIssue, 2) + ' s · écart final ' + nombre(trajet.erreurFinale, 2) + ' m',
      COL + 6,
      702,
      16,
      'left',
      ENCRE_DOUCE,
    );
  }
}
