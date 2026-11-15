/**
 * Maquette C du pupitre (lot B, v0.3, jetable) : « pupitre au crayon avec un tube cathodique à
 * phosphore vert encastré ».
 *
 * Choix de dessin :
 * - papier millimétré en CSS (dégradés) sous une scène 1280×720 mise à l'échelle de la fenêtre ;
 * - pupitre au crayon sur deux calques canvas 2D : un fixe (redessiné au chargement d'un trajet,
 *   au redimensionnement et quand la police est prête) et un mobile (leviers, jauge, voyant,
 *   redessiné seulement si une valeur affichée change) ;
 * - commandes en DOM (leviers focalisables `role="slider"`, champs numériques, bouton) ;
 * - le tube : canvas 2D « phosphore » (fil de fer projeté à la main et oscilloscope) passé dans un
 *   post-traitement three.js (rémanence, écran bombé, halo, balayage, grain), seul élément
 *   lumineux de la page. Aucune boucle d'animation propre : tout suit `mettreAJour`.
 */
import type { Contexte, EtatRejeu, Maquette } from '../contrat';
import type { IssueTrajet, TrajetReference } from '../common/types';
import { Crayon, POLICE_MAIN } from './crayon';
import { nombre, Oscillo } from './oscillo';
import {
  BLOC_KI,
  BLOC_KP,
  dessinerFond,
  dessinerMobile,
  DROITE,
  type EtatMobile,
  GAIN_MAX,
  GAIN_PAS,
  gainDuPoint,
  quadrant,
  TUBE,
  type Quadrant,
} from './pupitre';
import { creerStyle } from './styles';
import { RAYON_TAMBOUR, Treuil, type Cadre, type EtatTreuil } from './treuil';
import { Tube } from './tube';

const LARGEUR = 1280;
const HAUTEUR = 720;
const POLICE_TUBE = "'Consolas', 'Lucida Console', 'Courier New', monospace";

const PHASES: Readonly<Record<EtatRejeu['phase'], string>> = {
  attente: 'en attente',
  'en-cours': 'rejeu en cours',
  pause: 'en pause',
  fini: 'fin du trajet',
};

const ISSUES: Readonly<Record<IssueTrajet, string>> = {
  win: 'Victoire : la cabine est arrivée',
  bonk: 'Choc contre la poutre',
  noLift: 'La cabine ne décolle pas',
  step: 'Arrêt trop bas',
  slow: 'Stabilisation trop lente',
};

const ISSUES_TUBE: Readonly<Record<IssueTrajet, string>> = {
  win: 'VICTOIRE',
  bonk: 'CHOC',
  noLift: 'NE DÉCOLLE PAS',
  step: 'ARRÊT TROP BAS',
  slow: 'TROP LENT',
};

/** Zones du tube (pixels CSS du tube). */
const CADRE_TREUIL: Cadre = { x: 14, y: 66, l: 236, h: 380 };
const CADRE_OSCILLO: Cadre = { x: 262, y: 20, l: 494, h: 494 };

function texte(
  parent: HTMLElement,
  x: number,
  y: number,
  taille: number,
  classe = '',
): HTMLElement {
  const el = document.createElement('div');
  el.className = `pc-txt ${classe}`;
  el.style.left = `${String(x)}px`;
  el.style.top = `${String(y)}px`;
  el.style.fontSize = `${String(taille)}px`;
  parent.append(el);
  return el;
}

/**
 * Lecture chiffrée : libellé manuscrit, nombre en police système à chiffres tabulaires (comme les
 * `.num` du jeu : le 7 barré de la police manuscrite se lit mal en petit). Rend le `span` du nombre.
 */
function lecture(
  parent: HTMLElement,
  x: number,
  y: number,
  avant: string,
  apres: string,
  classe = '',
): HTMLElement {
  const el = texte(parent, x, y, 17, classe);
  const nombreEl = document.createElement('span');
  nombreEl.className = 'pc-num';
  el.append(avant, nombreEl, apres);
  return nombreEl;
}

/** Met un texte à jour seulement s'il change (pas d'écriture DOM inutile à chaque image). */
function ecrire(el: HTMLElement, s: string): void {
  if (el.textContent !== s) el.textContent = s;
}

function borner(g: number): number {
  if (!Number.isFinite(g)) return 0;
  return Math.min(GAIN_MAX, Math.max(0, Math.round(g / GAIN_PAS) * GAIN_PAS));
}

/** Un gain réglable : levier (slider), champ, unité. */
interface Reglage {
  valeur: number;
  readonly levier: HTMLElement;
  readonly champ: HTMLInputElement;
  readonly unite: HTMLElement;
  readonly q: Quadrant;
}

export function creer(contexte: Contexte): Maquette {
  const racine = contexte.racine;
  const style = creerStyle();
  document.head.append(style);

  const feuille = document.createElement('div');
  feuille.className = 'pc-feuille';
  const scene = document.createElement('div');
  scene.className = 'pc-scene';
  feuille.append(scene);
  racine.append(feuille);

  const calqueFond = document.createElement('canvas');
  const calqueMobile = document.createElement('canvas');
  calqueFond.className = 'pc-calque';
  calqueMobile.className = 'pc-calque';
  scene.append(calqueFond);
  const ctxFond = calqueFond.getContext('2d');
  const ctxMobile = calqueMobile.getContext('2d');
  if (ctxFond === null || ctxMobile === null) throw new Error('canvas 2D indisponible');
  const crayonFond = new Crayon(ctxFond, 1);
  const crayonMobile = new Crayon(ctxMobile, 2);

  const tube = new Tube(TUBE.l, TUBE.h);
  tube.element.classList.add('pc-tube');
  tube.element.style.left = `${String(TUBE.x)}px`;
  tube.element.style.top = `${String(TUBE.y)}px`;
  tube.element.setAttribute('role', 'img');
  tube.element.setAttribute(
    'aria-label',
    'Tube à phosphore : treuil en fil de fer et courbes de l’oscilloscope',
  );
  scene.append(tube.element);
  scene.append(calqueMobile);

  const treuil = new Treuil();
  const oscillo = new Oscillo();

  // Bandeau du haut.
  const elTrajet = texte(scene, 330, 14, 20);
  const elTemps = texte(scene, 1050, 10, 24, 'pc-num');
  const elPhase = texte(scene, 1050, 38, 16);
  const elEcart = texte(scene, 330, 38, 15, 'pc-rouge');

  // Réglages.
  const creerReglage = (haut: number, nom: string, unite: string): Reglage => {
    const q = quadrant(haut);
    const levier = document.createElement('div');
    levier.className = 'pc-levier';
    levier.tabIndex = 0;
    levier.setAttribute('role', 'slider');
    levier.setAttribute('aria-label', `${nom}, ${unite}`);
    levier.setAttribute('aria-valuemin', '0');
    levier.setAttribute('aria-valuemax', String(GAIN_MAX));
    levier.style.left = `${String(q.px - q.r - 22)}px`;
    levier.style.top = `${String(q.py - q.r - 26)}px`;
    levier.style.width = `${String(2 * q.r + 44)}px`;
    levier.style.height = `${String(q.r + 36)}px`;
    scene.append(levier);
    const champ = document.createElement('input');
    champ.className = 'pc-champ pc-num';
    champ.type = 'number';
    champ.min = '0';
    champ.max = String(GAIN_MAX);
    champ.step = String(GAIN_PAS);
    champ.setAttribute('aria-label', `${nom} (${unite})`);
    champ.style.left = `${String(q.px - 66)}px`;
    champ.style.top = `${String(q.py + 12)}px`;
    scene.append(champ);
    const el = texte(scene, q.px + 36, q.py + 18, 18);
    el.textContent = unite;
    return { valeur: 0, levier, champ, unite: el, q };
  };
  const kp = creerReglage(BLOC_KP, 'Kp', 'N/m');
  const ki = creerReglage(BLOC_KI, 'Ki', 'N/(m·s)');

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'pc-bouton';
  bouton.textContent = 'Lancer ▸';
  bouton.style.left = '40px';
  bouton.style.top = '470px';
  bouton.style.width = '158px';
  bouton.style.height = '52px';
  scene.append(bouton);

  // Jauge : valeurs lues.
  const elAppliquee = lecture(scene, DROITE.x + 12, 568, 'appliquée uSat : ', ' N');
  const elDemandee = lecture(scene, DROITE.x + 12, 588, 'demandée uCmd : ', ' N');
  const elEcretee = lecture(scene, DROITE.x + 12, 608, 'écrêtée : ', ' N', 'pc-rouge');
  // Issue.
  const elIssue = texte(scene, 80, 636, 22);
  const elIssueDetail = texte(scene, 26, 670, 16, 'pc-num');

  let trajet: TrajetReference | null = null;
  let niveau2 = false;
  let echelle = 1;
  let detruit = false;
  let derniere = 0;
  let duree = 0;
  let signature = '';
  const mobile: EtatMobile = {
    kp: 0,
    ki: 0,
    niveau2: false,
    actif: false,
    uSat: 0,
    uCmd: 0,
    sature: false,
  };
  const etatTreuil: { -readonly [K in keyof EtatTreuil]: EtatTreuil[K] } = {
    y: 0,
    v: 0,
    uSat: 0,
    uMax: 5000,
    sature: false,
    r: 3,
    poutre: 3.36,
    choc: false,
    clignote: 1,
  };
  const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)');

  const majReglage = (r: Reglage, v: number, depuisChamp = false): void => {
    r.valeur = borner(v);
    r.levier.setAttribute('aria-valuenow', String(r.valeur));
    r.levier.setAttribute('aria-valuetext', `${String(r.valeur)} ${r.unite.textContent}`);
    if (!depuisChamp) r.champ.value = String(r.valeur);
    signature = '';
    majEcart();
  };

  const majEcart = (): void => {
    if (trajet === null) return;
    const diff = kp.valeur !== trajet.kp || (niveau2 && ki.valeur !== trajet.ki);
    ecrire(
      elEcart,
      diff
        ? `réglage affiché ≠ trajet rejoué (Kp ${String(trajet.kp)}${niveau2 ? `, Ki ${String(trajet.ki)}` : ''}) : maquette, réglage visuel`
        : '',
    );
  };

  const dessinerFixe = (): void => {
    ctxFond.setTransform(1, 0, 0, 1, 0, 0);
    ctxFond.clearRect(0, 0, calqueFond.width, calqueFond.height);
    const k = calqueFond.width / LARGEUR;
    ctxFond.setTransform(k, 0, 0, k, 0, 0);
    dessinerFond(crayonFond, niveau2);
    signature = '';
  };

  const redimensionner = (): void => {
    const l = racine.clientWidth || window.innerWidth;
    const h = racine.clientHeight || window.innerHeight;
    echelle = Math.min(l / LARGEUR, h / HAUTEUR);
    scene.style.transform = `scale(${String(echelle)})`;
    scene.style.left = `${String(Math.max(0, (l - LARGEUR * echelle) / 2))}px`;
    scene.style.top = `${String(Math.max(0, (h - HAUTEUR * echelle) / 2))}px`;
    const densite = Math.min(2, echelle * (window.devicePixelRatio || 1));
    for (const c of [calqueFond, calqueMobile]) {
      c.width = Math.round(LARGEUR * densite);
      c.height = Math.round(HAUTEUR * densite);
    }
    tube.redimensionner(densite);
    dessinerFixe();
  };

  const charger = (t: TrajetReference): void => {
    trajet = t;
    niveau2 = t.niveau === 'level2';
    duree = (t.echantillons.length - 1) * t.dt;
    majReglage(kp, t.kp);
    majReglage(ki, niveau2 ? t.ki : 0);
    for (const el of [ki.levier, ki.champ, ki.unite]) el.classList.toggle('pc-cache', !niveau2);
    ki.champ.disabled = !niveau2;
    ecrire(
      elTrajet,
      `Trajet de référence : ${t.titre.split(' : ')[0] ?? t.id} · niveau ${niveau2 ? '2 (PI)' : '1 (P)'}`,
    );
    etatTreuil.uMax = t.physique.uMax;
    etatTreuil.r = t.physique.r;
    etatTreuil.poutre = t.physique.hauteurPoutre;
    oscillo.charger(t, CADRE_OSCILLO);
    tube.oublier();
    dessinerFixe();
  };

  const lancer = (): void => {
    for (const r of [kp, ki]) majReglage(r, Number(r.champ.value));
    contexte.lancer();
  };

  // Clavier : une seule écoute sur la fenêtre ; les touches de la coque (1, 2, 3, P, R, H)
  // ne sont jamais interceptées.
  const surTouche = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const cible = e.target;
    if (cible instanceof HTMLButtonElement) return; // Entrée et Espace : clic natif.
    if (cible instanceof HTMLInputElement) {
      if (e.key === 'Enter') {
        e.preventDefault();
        lancer();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      lancer();
      return;
    }
    const r = cible === ki.levier || (e.shiftKey && niveau2) ? ki : kp;
    let d = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+' || e.key === '=') d = 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-') d = -1;
    else if (e.key === 'PageUp') d = 10;
    else if (e.key === 'PageDown') d = -10;
    else if (e.key === 'Home') d = -GAIN_MAX;
    else if (e.key === 'End') d = GAIN_MAX;
    if (d === 0) return;
    e.preventDefault();
    majReglage(r, r.valeur + d * GAIN_PAS);
  };
  window.addEventListener('keydown', surTouche);

  const surChamp = (r: Reglage) => (): void => {
    const v = Number(r.champ.value);
    if (r.champ.value !== '' && Number.isFinite(v)) majReglage(r, v, true);
  };
  const surFinChamp = (r: Reglage) => (): void => {
    majReglage(r, Number(r.champ.value));
  };
  const ecouteurs: [EventTarget, string, EventListener][] = [];
  const ecouter = (cible: EventTarget, type: string, f: EventListener): void => {
    cible.addEventListener(type, f);
    ecouteurs.push([cible, type, f]);
  };
  // Glisser un levier à la souris ou au doigt.
  const glisser = (r: Reglage, e: PointerEvent): void => {
    const rect = scene.getBoundingClientRect();
    const x = (e.clientX - rect.left) / echelle;
    const y = (e.clientY - rect.top) / echelle;
    majReglage(r, gainDuPoint(r.q, x, y));
  };
  for (const r of [kp, ki]) {
    ecouter(r.champ, 'input', surChamp(r));
    ecouter(r.champ, 'change', surFinChamp(r));
    ecouter(r.champ, 'blur', surFinChamp(r));
    ecouter(r.levier, 'pointerdown', (e) => {
      const pe = e as PointerEvent;
      r.levier.setPointerCapture(pe.pointerId);
      r.levier.focus();
      glisser(r, pe);
    });
    ecouter(r.levier, 'pointermove', (e) => {
      const pe = e as PointerEvent;
      if (r.levier.hasPointerCapture(pe.pointerId)) glisser(r, pe);
    });
  }
  ecouter(bouton, 'click', lancer);
  ecouter(window, 'resize', redimensionner);

  redimensionner();
  // La police manuscrite peut arriver après le premier dessin : redessiner le calque fixe.
  document.fonts
    .load(`20px ${POLICE_MAIN}`)
    .then(() => {
      if (!detruit) dessinerFixe();
    })
    .catch(() => {
      // Police indisponible : le repli système reste lisible.
    });

  const dessinerTube = (etat: Readonly<EtatRejeu>, actif: boolean, clignote: number): void => {
    const ctx = tube.effacer();
    const t = etat.trajet;
    const ech = etat.echantillon;
    const sature = actif && ech.saturated && !etat.issueAtteinte;
    etatTreuil.y = etat.cabine.y;
    etatTreuil.v = actif ? etat.cabine.v : 0;
    etatTreuil.uSat = actif ? ech.uSat : 0;
    etatTreuil.sature = sature;
    etatTreuil.choc = etat.issueAtteinte && t.issue === 'bonk';
    etatTreuil.clignote = clignote;
    treuil.dessiner(ctx, CADRE_TREUIL, etatTreuil);
    oscillo.dessiner(ctx, etat.indice, ech, actif);

    // Textes du treuil.
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#b8ffc4';
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `bold 14px ${POLICE_TUBE}`;
    ctx.fillText('TREUIL', 22, 30);
    ctx.font = `13px ${POLICE_TUBE}`;
    const omega = ((etatTreuil.v / RAYON_TAMBOUR) * 60) / (2 * Math.PI);
    const xL = 22;
    let yL = 452;
    ctx.fillText(`y = ${nombre(etatTreuil.y, 2)} m`, xL, yL);
    yL += 17;
    ctx.fillText(`v = ${nombre(etatTreuil.v, 2)} m/s`, xL, yL);
    yL += 17;
    ctx.fillText(`ω = ${nombre(omega, 0)} tr/min`, xL, yL);
    yL += 17;
    ctx.fillText(`F = ${nombre(actif ? ech.uSat : 0, 0)} N`, xL, yL);
    // Messages.
    if (sature && clignote > 0) {
      ctx.font = `bold 15px ${POLICE_TUBE}`;
      ctx.strokeStyle = '#d8ffe0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(108, 18, 138, 24);
      ctx.fillText('SATURATION', 120, 31);
    }
    if (etat.issueAtteinte) {
      ctx.font = `bold 15px ${POLICE_TUBE}`;
      ctx.textAlign = 'left';
      ctx.fillText(`ISSUE : ${ISSUES_TUBE[t.issue]}`, 22, 52);
    }
    const c = oscillo.centre();
    ctx.textAlign = 'center';
    if (etat.phase === 'attente') {
      ctx.font = `bold 18px ${POLICE_TUBE}`;
      ctx.fillText('EN ATTENTE', c.x, c.y - 12);
      if (clignote > 0) {
        const demi = ctx.measureText('EN ATTENTE').width / 2;
        ctx.fillRect(c.x + demi + 6, c.y - 21, 10, 17);
      }
      ctx.font = `14px ${POLICE_TUBE}`;
      ctx.fillText('Entrée ou « Lancer » : rejouer le trajet', c.x, c.y + 12);
    } else if (etat.phase === 'pause') {
      ctx.font = `bold 18px ${POLICE_TUBE}`;
      ctx.fillText('PAUSE', c.x, c.y);
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  return {
    charger,

    mettreAJour(etat: Readonly<EtatRejeu>): void {
      if (detruit) return;
      if (etat.trajet !== trajet) charger(etat.trajet);
      const t = etat.trajet;
      const maintenant = performance.now();
      const dt = derniere === 0 ? 1 / 60 : Math.min(0.25, (maintenant - derniere) / 1000);
      derniere = maintenant;
      const reduit = mouvementReduit.matches;
      const clignote = reduit ? 1 : Math.floor(maintenant / 180) % 2;
      const actif = etat.phase !== 'attente';
      const ech = etat.echantillon;
      // Avant le lancement, la cabine est au repos : aucune force affichée, pas d'alerte.
      const sature = actif && ech.saturated && !etat.issueAtteinte;

      ecrire(elTemps, `t = ${nombre(etat.t, 2)} s / ${nombre(duree, 2)} s`);
      ecrire(elPhase, PHASES[etat.phase]);
      if (etat.issueAtteinte) {
        ecrire(elIssue, ISSUES[t.issue]);
        ecrire(
          elIssueDetail,
          `à t = ${nombre(t.pasIssue * t.dt, 2)} s · hauteur ${nombre(t.yFinal, 2)} m · erreur ${nombre(t.erreurFinale, 2)} m`,
        );
      } else {
        ecrire(elIssue, actif ? '…' : '—');
        ecrire(elIssueDetail, actif ? 'trajet en cours' : 'pas encore lancé');
      }
      const uSat = actif ? ech.uSat : 0;
      const uCmd = actif ? ech.uCmd : 0;
      ecrire(elAppliquee, nombre(uSat, 0));
      ecrire(elDemandee, nombre(uCmd, 0));
      ecrire(elEcretee, nombre(Math.abs(uCmd - uSat), 0));
      elEcretee.parentElement?.classList.toggle('pc-cache', !sature);

      mobile.kp = kp.valeur;
      mobile.ki = ki.valeur;
      mobile.niveau2 = niveau2;
      mobile.actif = actif;
      mobile.uSat = Math.round(uSat / 10) * 10;
      mobile.uCmd = Math.round(uCmd / 10) * 10;
      mobile.sature = sature;
      const sig = `${String(mobile.kp)}|${String(mobile.ki)}|${String(niveau2)}|${String(actif)}|${String(mobile.uSat)}|${String(mobile.uCmd)}|${String(sature)}`;
      if (sig !== signature) {
        signature = sig;
        ctxMobile.setTransform(1, 0, 0, 1, 0, 0);
        ctxMobile.clearRect(0, 0, calqueMobile.width, calqueMobile.height);
        const k = calqueMobile.width / LARGEUR;
        ctxMobile.setTransform(k, 0, 0, k, 0, 0);
        dessinerMobile(crayonMobile, mobile);
      }

      dessinerTube(etat, actif, clignote);
      tube.presenter(dt, !reduit);
    },

    detruire(): void {
      detruit = true;
      window.removeEventListener('keydown', surTouche);
      for (const [cible, type, f] of ecouteurs) cible.removeEventListener(type, f);
      ecouteurs.length = 0;
      tube.detruire();
      feuille.remove();
      style.remove();
    },
  };
}
