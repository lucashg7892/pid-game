/**
 * Maquette D du pupitre (lot B, v0.3, JETABLE) : « la planche de l'ingénieur ».
 *
 * Parti pris : une planche de calcul au crayon où l'on voit D'OÙ VIENT la force, pas seulement
 * combien elle vaut. Trois colonnes reliées par les mêmes lettres : la machine (cage, cabine,
 * câble, tambour, moteur), le calcul du régleur écrit avec les valeurs de l'instant (ressort P,
 * bocal I, addition des vecteurs sur une règle des forces où le moteur bute à 5 000 N, cabine
 * isolée), et les courbes. Réglage des gains en bas (réglettes, champs, bouton « Lancer »).
 *
 * Dessin : un canvas 2D de fond (papier millimétré, peint une fois par redimensionnement) et un
 * canvas 2D redessiné seulement quand le rejeu avance ; commandes DOM accessibles par-dessus.
 * Aucune boucle propre : l'horloge est celle de la coque (`mettreAJour`).
 */
import type { Contexte, EtatRejeu, Maquette } from '../contrat';
import type { IssueTrajet, TrajetReference } from '../common/types';
import { dessinerCourbes, dessinerCourbesFixe, preparerEchelles, type Echelles } from './courbes';
import { Crayon, dessinerPapier, ENCRE, ENCRE_PALE, POLICE } from './crayon';
import { dessinerForces, dessinerForcesFixe } from './forces';
import { nb } from './format';
import { dessinerMachine, dessinerMachineFixe } from './machine';
import { creerReglage, dessinerReglage, dessinerReglageFixe } from './reglage';

/** Taille logique de la planche (px CSS à l'échelle 1). */
const LARGEUR = 1280;
const HAUTEUR = 720;

const ISSUES: Readonly<Record<IssueTrajet, string>> = {
  win: 'victoire : la cabine est arrivée au quai',
  bonk: 'choc : la cabine a heurté la poutre',
  noLift: 'la cabine ne décolle pas',
  step: 'arrêt trop bas',
  slow: 'stabilisation trop lente',
};

const NOMS_TRAJETS: Readonly<Record<TrajetReference['id'], string>> = {
  victoire: '« victoire »',
  choc: '« choc »',
  saturation: '« saturation »',
};

/** Feuille de style de la maquette (police auto-hébergée, commandes manuscrites). */
function feuilleDeStyle(): string {
  const base = import.meta.env.BASE_URL;
  const bord = 'border-radius:255px 15px 225px 15px/15px 225px 15px 255px;';
  return (
    "@font-face{font-family:'Patrick Hand';font-style:normal;font-weight:400;font-display:swap;" +
    'src:url(' +
    base +
    "fonts/patrick-hand-latin-400-normal.woff2) format('woff2');" +
    'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,' +
    'U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}' +
    "@font-face{font-family:'Patrick Hand';font-style:normal;font-weight:400;font-display:swap;" +
    'src:url(' +
    base +
    "fonts/patrick-hand-latin-ext-400-normal.woff2) format('woff2');" +
    'unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,' +
    'U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}' +
    '.pd-planche{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0;}' +
    '.pd-planche canvas{position:absolute;left:0;top:0;width:1280px;height:720px;}' +
    '.pd-reglette{position:absolute;cursor:ew-resize;border-radius:8px;touch-action:none;}' +
    '.pd-reglette[aria-disabled="true"]{cursor:default;}' +
    '.pd-champ{position:absolute;box-sizing:border-box;padding:0 8px;margin:0;' +
    'font:21px ' +
    POLICE +
    ';color:#2a2724;background:#fbf7ec;border:2px solid #3a3a3a;text-align:right;' +
    bord +
    '}' +
    '.pd-champ:disabled{opacity:0.4;}' +
    '.pd-lancer{position:absolute;box-sizing:border-box;margin:0;padding:0;cursor:pointer;' +
    'font:27px ' +
    POLICE +
    ';color:#2a2724;background:#fbf7ec;border:2.5px solid #2a2724;' +
    bord +
    '}' +
    '.pd-lancer:hover{background:#f3ead2;}' +
    '.pd-lancer:active{transform:translate(3px,3px);}' +
    '.pd-reglette:focus-visible,.pd-champ:focus-visible,.pd-lancer:focus-visible' +
    '{outline:2px dashed #2a2724;outline-offset:4px;}'
  );
}

/** Crée la maquette D. */
export function creer(contexte: Contexte): Maquette {
  const racine = contexte.racine;
  const abandon = new AbortController();
  const signal = abandon.signal;
  const mesure = new URLSearchParams(window.location.search).get('mesure') === '1';
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const style = document.createElement('style');
  style.textContent = feuilleDeStyle();
  const planche = document.createElement('div');
  planche.className = 'pd-planche';
  const fond = document.createElement('canvas');
  const dessin = document.createElement('canvas');
  fond.setAttribute('aria-hidden', 'true');
  dessin.setAttribute('role', 'img');
  dessin.setAttribute(
    'aria-label',
    'Planche de l’ingénieur : machine, calcul de la force et courbes du trajet',
  );
  planche.append(fond, dessin);
  racine.append(style, planche);
  const ctxFond = fond.getContext('2d');
  // Tramage CPU (willReadFrequently) : mesuré, le canvas accéléré sous SwiftShader (rendu
  // logiciel) prend du retard sur le compositeur ; en tramage CPU l'image suit à 60 i/s.
  const ctx = dessin.getContext('2d', { willReadFrequently: true });
  if (ctxFond === null || ctx === null) throw new Error('maquette D : canvas 2D indisponible');
  const crayon = new Crayon(ctx);
  const crayonFond = new Crayon(ctxFond);

  let sale = true;
  let detruite = false;
  let echelle = 1;
  let trajetCourant: TrajetReference = contexte.trajets[0] as TrajetReference;
  let echelles: Echelles = preparerEchelles(trajetCourant);
  let dernierT = -1;
  let dernierePhase = '';
  let dernierTrajet = '';
  let dernierBouillon = -1;
  // Mesures (paramètre `mesure=1`) : durée de mettreAJour.
  let mesures = 0;
  let somme = 0;
  let pire = 0;

  const marquer = (): void => {
    sale = true;
  };
  const lancer = (): void => {
    contexte.lancer();
  };
  const reglage = creerReglage(planche, signal, lancer, marquer);

  /** En-tête, partie fixe : titre, aide clavier, cadre du cartouche, trajet. */
  const dessinerEnteteFixe = (c: Crayon, t: TrajetReference): void => {
    c.texte('Planche de l’ingénieur : le treuil et son régleur', 16, 34, 30, 'left', ENCRE);
    c.trait(16, 42, 590, 41, 1.6, 0.9, ENCRE, 0.8);
    c.texte(
      'Clavier : Tab passe d’un réglage à l’autre · flèches ou + / − : ±100 · Page préc. / suiv. : ±1 000 · Entrée : lancer',
      16,
      60,
      14,
      'left',
      ENCRE_PALE,
    );
    c.rect(848, 6, 424, 54, 1.6, 0.95, ENCRE);
    c.trait(1150, 6, 1150, 60, 1.2, 0.9);
    c.texte(
      'Trajet ' +
        NOMS_TRAJETS[t.id] +
        ' · niveau ' +
        (t.niveau === 'level2' ? '2 (P + I)' : '1 (P seul)') +
        ' · Kp ' +
        nb(t.kp) +
        (t.niveau === 'level2' ? ' · Ki ' + nb(t.ki) : ''),
      856,
      27,
      15,
      'left',
      ENCRE,
    );
    c.texte('temps', 1211, 23, 13, 'center', ENCRE_PALE);
    // Cadres et titres des trois colonnes et du bandeau de réglage.
    c.rect(8, 68, 392, 540, 1.3, 0.8);
    c.rect(406, 68, 436, 540, 1.3, 0.8);
    c.rect(848, 68, 424, 540, 1.3, 0.8);
    c.rect(8, 616, 1264, 98, 1.3, 0.8);
    c.texte('La machine', 16, 90, 21, 'left', ENCRE);
    c.texte('D’où vient la force ?', 414, 90, 21, 'left', ENCRE);
    c.texte('Les courbes, tracées jusqu’à l’instant t', 856, 90, 21, 'left', ENCRE);
  };

  /** En-tête, partie variable : état ou issue, temps. */
  const dessinerEntete = (etat: Readonly<EtatRejeu>): void => {
    let ligne: string;
    if (etat.issueAtteinte) ligne = 'Issue : ' + ISSUES[etat.trajet.issue];
    else if (etat.phase === 'attente') ligne = 'En attente : appuie sur « Lancer »';
    else if (etat.phase === 'pause') ligne = 'En pause (P pour reprendre)';
    else ligne = 'En marche…';
    if (etat.phase === 'pause' && etat.issueAtteinte) ligne += ' (pause)';
    crayon.texte(ligne, 856, 51, 17, 'left', ENCRE);
    crayon.texte('t = ' + nb(etat.t, 2) + ' s', 1211, 50, 24, 'center', ENCRE);
  };

  /** Repeint le fond : papier et toutes les parties fixes du trajet courant. */
  function peindreFond(): void {
    dessinerPapier(crayonFond.ctx, LARGEUR, HAUTEUR);
    crayonFond.debut(0);
    dessinerEnteteFixe(crayonFond, trajetCourant);
    dessinerMachineFixe(crayonFond, trajetCourant);
    dessinerForcesFixe(crayonFond, trajetCourant);
    dessinerCourbesFixe(crayonFond, trajetCourant, echelles);
    dessinerReglageFixe(crayonFond, reglage);
    sale = true;
  }

  /** Ajuste la planche à la racine (échelle uniforme, centrée) et repeint le fond. */
  const ajuster = (): void => {
    const l = racine.clientWidth || LARGEUR;
    const h = racine.clientHeight || HAUTEUR;
    echelle = Math.min(l / LARGEUR, h / HAUTEUR);
    const dx = (l - LARGEUR * echelle) / 2;
    const dy = (h - HAUTEUR * echelle) / 2;
    planche.style.transform =
      'translate(' + String(dx) + 'px,' + String(dy) + 'px) scale(' + String(echelle) + ')';
    const dpr = window.devicePixelRatio || 1;
    const k = echelle * dpr;
    for (const cv of [fond, dessin]) {
      cv.width = Math.round(LARGEUR * k);
      cv.height = Math.round(HAUTEUR * k);
    }
    ctxFond.setTransform(k, 0, 0, k, 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    peindreFond();
  };
  racine.style.background = '#f7f0de';
  ajuster();
  const observateur = new ResizeObserver(ajuster);
  observateur.observe(racine);
  document.fonts.load('16px ' + POLICE).then(
    () => {
      if (!detruite) peindreFond();
    },
    () => {
      // Police indisponible : les replis de POLICE suffisent.
    },
  );

  // Entrée sans élément focalisé : lance aussi (le bouton reste le chemin principal).
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' && !e.repeat && e.target === document.body) lancer();
    },
    { signal },
  );

  return {
    charger(trajet: TrajetReference): void {
      trajetCourant = trajet;
      echelles = preparerEchelles(trajet);
      reglage.definir(trajet);
      peindreFond();
      mesures = 0;
      somme = 0;
      pire = 0;
    },
    mettreAJour(etat: Readonly<EtatRejeu>): void {
      if (detruite) return;
      const debut = mesure ? performance.now() : 0;
      if (etat.trajet !== trajetCourant) {
        trajetCourant = etat.trajet;
        echelles = preparerEchelles(etat.trajet);
        peindreFond();
      }
      const enMarche = etat.phase === 'en-cours';
      const bouillon = reduit ? 0 : Math.floor(etat.t * 8) % 16;
      if (
        !sale &&
        etat.t === dernierT &&
        etat.phase === dernierePhase &&
        etat.trajet.id === dernierTrajet &&
        bouillon === dernierBouillon
      ) {
        return;
      }
      sale = false;
      dernierT = etat.t;
      dernierePhase = etat.phase;
      dernierTrajet = etat.trajet.id;
      dernierBouillon = bouillon;

      crayon.debut(bouillon);
      ctx.clearRect(0, 0, LARGEUR, HAUTEUR);
      const secousse =
        enMarche && !reduit && etat.echantillon.saturated ? Math.sin(etat.t * 95) * 1.4 : 0;
      dessinerEntete(etat);
      dessinerMachine(crayon, etat, secousse);
      dessinerForces(crayon, etat);
      dessinerCourbes(crayon, etat, echelles);
      dessinerReglage(crayon, reglage);

      if (mesure) {
        // Lecture d'un pixel : force le tramage des ordres en attente, compté dans la mesure.
        ctx.getImageData(0, 0, 1, 1);
        const duree = performance.now() - debut;
        mesures += 1;
        somme += duree;
        if (duree > pire) pire = duree;
        racine.dataset.pdImages = String(mesures);
        racine.dataset.pdMoyenne = (somme / mesures).toFixed(3);
        racine.dataset.pdPire = pire.toFixed(3);
      }
    },
    detruire(): void {
      detruite = true;
      abandon.abort();
      observateur.disconnect();
      planche.remove();
      style.remove();
    },
  };
}
