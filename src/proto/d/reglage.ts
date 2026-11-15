/**
 * Maquette D (lot B, v0.3, JETABLE) : réglage des gains. Deux réglettes graduées (Kp, Ki)
 * dessinées au crayon sur le canvas, chacune doublée d'un élément DOM transparent et focalisable
 * (`role="slider"`) qui reçoit le pointeur et le clavier, d'un champ de saisie et d'un bouton
 * « Lancer ». Le réglage est VISUEL : le rejeu suit toujours le trajet de référence.
 */
import type { TrajetReference } from '../common/types';
import { Crayon, ENCRE, ENCRE_PALE, GRAPHITE } from './crayon';
import { entier, nb } from './format';

/** Bornes et pas du réglage (N/m pour Kp, N/(m·s) pour Ki). */
const MIN = 0;
const MAX = 8000;
const PAS = 100;
const GRAND_PAS = 1000;
/** Tirets du repère de la valeur du trajet de référence. */
const TIRETS_REFERENCE: readonly number[] = [2, 2];

/** Géométrie (repère logique 1280 × 720) d'un bloc de réglage. */
interface Geometrie {
  readonly etiquette: string;
  readonly nom: string;
  readonly unite: string;
  readonly xTexte: number;
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
  readonly xChamp: number;
}

const GEO_KP: Geometrie = {
  etiquette: 'Kp : raideur du ressort P',
  nom: 'Kp',
  unite: 'N/m',
  xTexte: 22,
  x0: 34,
  x1: 386,
  y: 664,
  xChamp: 408,
};
const GEO_KI: Geometrie = {
  etiquette: 'Ki : débit du bocal I',
  nom: 'Ki',
  unite: 'N/(m·s)',
  xTexte: 566,
  x0: 578,
  x1: 930,
  y: 664,
  xChamp: 952,
};
/** Bouton « Lancer ». */
export const BOUTON = { x: 1146, y: 636, l: 116, h: 54 } as const;
const CHAMP_L = 84;
const CHAMP_H = 34;

/** Un gain réglable. */
export interface Gain {
  readonly geo: Geometrie;
  readonly reglette: HTMLDivElement;
  readonly champ: HTMLInputElement;
  valeur: number;
  reference: number;
  actif: boolean;
  focus: boolean;
}

/** Les deux gains et le bouton. */
export interface Reglage {
  readonly kp: Gain;
  readonly ki: Gain;
  readonly bouton: HTMLButtonElement;
  /** Remet les valeurs du trajet (au chargement). */
  definir(trajet: TrajetReference): void;
}

function borne(x: number): number {
  const r = Math.round(x / PAS) * PAS;
  return r < MIN ? MIN : r > MAX ? MAX : r;
}

function placer(el: HTMLElement, x: number, y: number, l: number, h: number): void {
  el.style.left = String(x) + 'px';
  el.style.top = String(y) + 'px';
  el.style.width = String(l) + 'px';
  el.style.height = String(h) + 'px';
}

/**
 * Crée les commandes DOM du réglage dans `parent` (la planche 1280 × 720).
 * @param signal abandon : retire tous les écouteurs à la destruction.
 * @param lancer appelé par le bouton, par Entrée sur une réglette ou dans un champ.
 * @param change appelé à chaque changement visible (redessiner).
 */
export function creerReglage(
  parent: HTMLElement,
  signal: AbortSignal,
  lancer: () => void,
  change: () => void,
): Reglage {
  const creerGain = (geo: Geometrie): Gain => {
    const reglette = document.createElement('div');
    reglette.className = 'pd-reglette';
    reglette.tabIndex = 0;
    reglette.setAttribute('role', 'slider');
    reglette.setAttribute('aria-label', 'Gain ' + geo.nom + ' (' + geo.unite + ')');
    reglette.setAttribute('aria-valuemin', String(MIN));
    reglette.setAttribute('aria-valuemax', String(MAX));
    placer(reglette, geo.x0 - 12, geo.y - 18, geo.x1 - geo.x0 + 24, 44);
    const champ = document.createElement('input');
    champ.className = 'pd-champ';
    champ.type = 'text';
    champ.inputMode = 'numeric';
    champ.setAttribute('aria-label', geo.nom + ' en ' + geo.unite);
    placer(champ, geo.xChamp, geo.y - CHAMP_H / 2, CHAMP_L, CHAMP_H);
    parent.append(reglette, champ);
    const gain: Gain = {
      geo,
      reglette,
      champ,
      valeur: 0,
      reference: 0,
      actif: true,
      focus: false,
    };
    const ecrire = (v: number): void => {
      gain.valeur = borne(v);
      reglette.setAttribute('aria-valuenow', String(gain.valeur));
      reglette.setAttribute('aria-valuetext', nb(gain.valeur) + ' ' + geo.unite);
      if (document.activeElement !== champ) champ.value = entier(gain.valeur);
      change();
    };
    const depuisPointeur = (clientX: number): void => {
      const r = reglette.getBoundingClientRect();
      const largeur = geo.x1 - geo.x0 + 24;
      const lx = ((clientX - r.left) / r.width) * largeur - 12;
      ecrire((lx / (geo.x1 - geo.x0)) * (MAX - MIN) + MIN);
    };
    reglette.addEventListener(
      'keydown',
      (e) => {
        if (!gain.actif || e.ctrlKey || e.altKey || e.metaKey) return;
        let v = gain.valeur;
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowUp':
          case '+':
          case '=':
            v += PAS;
            break;
          case 'ArrowLeft':
          case 'ArrowDown':
          case '-':
            v -= PAS;
            break;
          case 'PageUp':
            v += GRAND_PAS;
            break;
          case 'PageDown':
            v -= GRAND_PAS;
            break;
          case 'Home':
            v = MIN;
            break;
          case 'End':
            v = MAX;
            break;
          case 'Enter':
            e.preventDefault();
            lancer();
            return;
          default:
            return;
        }
        e.preventDefault();
        ecrire(v);
      },
      { signal },
    );
    reglette.addEventListener(
      'pointerdown',
      (e) => {
        if (!gain.actif) return;
        reglette.setPointerCapture(e.pointerId);
        reglette.focus();
        depuisPointeur(e.clientX);
      },
      { signal },
    );
    reglette.addEventListener(
      'pointermove',
      (e) => {
        if (gain.actif && reglette.hasPointerCapture(e.pointerId)) depuisPointeur(e.clientX);
      },
      { signal },
    );
    reglette.addEventListener(
      'focus',
      () => {
        gain.focus = true;
        change();
      },
      { signal },
    );
    reglette.addEventListener(
      'blur',
      () => {
        gain.focus = false;
        change();
      },
      { signal },
    );
    const valider = (): void => {
      const lu = Number(champ.value.replace(/\s/g, '').replace(',', '.'));
      if (champ.value.trim() === '' || !Number.isFinite(lu)) champ.value = entier(gain.valeur);
      else {
        ecrire(lu);
        champ.value = entier(gain.valeur);
      }
    };
    champ.addEventListener(
      'keydown',
      (e) => {
        let v: number | null = null;
        if (e.key === 'Enter') {
          valider();
          lancer();
        } else if (e.key === 'Escape') champ.value = entier(gain.valeur);
        else if (e.key === 'ArrowUp') v = gain.valeur + PAS;
        else if (e.key === 'ArrowDown') v = gain.valeur - PAS;
        else if (e.key === 'PageUp') v = gain.valeur + GRAND_PAS;
        else if (e.key === 'PageDown') v = gain.valeur - GRAND_PAS;
        else return;
        e.preventDefault();
        if (v !== null) {
          ecrire(v);
          champ.value = entier(gain.valeur);
        }
      },
      { signal },
    );
    champ.addEventListener('change', valider, { signal });
    champ.addEventListener('blur', valider, { signal });
    return gain;
  };

  const kp = creerGain(GEO_KP);
  const ki = creerGain(GEO_KI);
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'pd-lancer';
  bouton.textContent = 'Lancer';
  placer(bouton, BOUTON.x, BOUTON.y, BOUTON.l, BOUTON.h);
  bouton.addEventListener('click', lancer, { signal });
  parent.append(bouton);

  const regler = (gain: Gain, valeur: number, actif: boolean): void => {
    gain.valeur = borne(valeur);
    gain.reference = gain.valeur;
    gain.actif = actif;
    gain.champ.value = entier(gain.valeur);
    gain.champ.disabled = !actif;
    gain.reglette.tabIndex = actif ? 0 : -1;
    gain.reglette.setAttribute('aria-disabled', actif ? 'false' : 'true');
    gain.reglette.setAttribute('aria-valuenow', String(gain.valeur));
    gain.reglette.setAttribute('aria-valuetext', nb(gain.valeur) + ' ' + gain.geo.unite);
  };

  return {
    kp,
    ki,
    bouton,
    definir(trajet: TrajetReference): void {
      regler(kp, trajet.kp, true);
      regler(ki, trajet.ki, trajet.niveau === 'level2');
      change();
    },
  };
}

function abscisse(geo: Geometrie, v: number): number {
  return geo.x0 + ((v - MIN) / (MAX - MIN)) * (geo.x1 - geo.x0);
}

/** Partie fixe d'une réglette : étiquette, corps, graduations, unité. */
function dessinerGainFixe(c: Crayon, g: Gain): void {
  const { geo } = g;
  const encre = g.actif ? 1 : 0.3;
  const couleurTexte = g.actif ? ENCRE : ENCRE_PALE;
  c.texte(geo.etiquette, geo.xTexte, 638, 17, 'left', couleurTexte);
  c.rect(geo.x0, geo.y - 6, geo.x1 - geo.x0, 12, 1.4, encre, GRAPHITE, 2);
  c.lot();
  for (let v = MIN; v <= MAX; v += 500) {
    const x = abscisse(geo, v);
    const l = v % 2000 === 0 ? 7 : v % 1000 === 0 ? 5 : 3;
    c.segment(x, geo.y + 6, x, geo.y + 6 + l);
  }
  c.finLot(1, 0.9 * encre);
  for (let v = MIN; v <= MAX; v += 2000) {
    c.texte(nb(v), abscisse(geo, v), geo.y + 26, 13, 'center', couleurTexte);
  }
  if (!g.actif) {
    const milieu = (geo.x0 + geo.x1) / 2;
    c.texte('pas de Ki au niveau 1 (régleur P seul)', milieu, geo.y - 12, 15, 'center', ENCRE);
  }
  c.texte(geo.unite, geo.xChamp + CHAMP_L + 6, geo.y + 6, 15, 'left', couleurTexte);
}

/** Partie variable d'une réglette : partie réglée hachurée, curseur, repère du trajet. */
function dessinerGain(c: Crayon, g: Gain): void {
  if (!g.actif) return;
  const { geo } = g;
  const x = abscisse(geo, g.valeur);
  c.hachures(geo.x0, geo.y - 6, x - geo.x0, 12, Math.PI / 4, 4, 1, 0.7);
  // Curseur de règle à calcul : cadre, fil de lecture, poignée.
  c.gomme(x - 7, geo.y - 13, 14, 26);
  c.rect(x - 7, geo.y - 13, 14, 26, 1.6, 1, ENCRE, 1);
  c.trait(x, geo.y - 13, x, geo.y + 13, 1, 1, ENCRE, 0);
  c.trait(x - 4, geo.y - 17, x + 4, geo.y - 17, 2.4, 1, ENCRE, 0.2);
  // Repère de la valeur du trajet de référence, si le réglage s'en écarte.
  if (g.valeur !== g.reference) {
    const xr = abscisse(geo, g.reference);
    c.tirets(xr, geo.y - 12, xr, geo.y + 12, TIRETS_REFERENCE, 1.2, 0.9, ENCRE);
    c.trait(xr, geo.y - 9, xr - 4, geo.y - 15, 1.2, 0.9, ENCRE, 0);
    c.trait(xr, geo.y - 9, xr + 4, geo.y - 15, 1.2, 0.9, ENCRE, 0);
  }
}

/** Partie FIXE du bandeau de réglage (peinte sur le fond, une fois par trajet). */
export function dessinerReglageFixe(c: Crayon, r: Readonly<Reglage>): void {
  dessinerGainFixe(c, r.kp);
  dessinerGainFixe(c, r.ki);
  // Ombre hachurée du bouton (le bouton DOM est posé par-dessus).
  c.hachures(BOUTON.x + 5, BOUTON.y + 5, BOUTON.l, BOUTON.h, Math.PI / 4, 3.5, 1, 0.6);
}

/** Partie VARIABLE du bandeau de réglage : curseurs et note sur le rejeu. */
export function dessinerReglage(c: Crayon, r: Readonly<Reglage>): void {
  dessinerGain(c, r.kp);
  dessinerGain(c, r.ki);
  const ecart = r.kp.valeur !== r.kp.reference || (r.ki.actif && r.ki.valeur !== r.ki.reference);
  if (ecart) {
    c.texte(
      'Maquette : le rejeu suit le trajet de référence (repère en tirets : Kp ' +
        nb(r.kp.reference) +
        (r.ki.actif ? ', Ki ' + nb(r.ki.reference) : '') +
        '), pas ce réglage.',
      566,
      708,
      13,
      'left',
      ENCRE_PALE,
    );
  }
}
