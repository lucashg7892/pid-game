/**
 * Maquette B du pupitre (lot B, v0.3, JETABLE) : « Instruments seuls, épuré ». Un cahier de
 * laboratoire en trois colonnes, lues de gauche à droite : ce que je règle (gain, Lancer, temps
 * et issue) → ce que fait le moteur (dynamomètre, tachymètre, câble) → ce qui en résulte au fil
 * du temps (quatre courbes alignées). Le moteur du treuil n'est pas dessiné.
 *
 * Dessin : un seul canvas 2D plein écran (papier, cadrans, courbes, tracés au crayon), avec une
 * image de fond mise en cache (tout ce qui est fixe) ; DOM seulement pour ce qui se manipule
 * (leviers focalisables, champs, bouton). Scène logique 1280×720, mise à l'échelle et centrée.
 * Pas de boucle d'animation propre : on dessine dans `mettreAJour`, et seulement si quelque chose
 * a changé. `?mesure=1` expose `window.__mesureB` (durées de `mettreAJour`) pour les mesures.
 */
import type { Contexte, EtatRejeu, Maquette } from '../contrat';
import type { TrajetReference } from '../common/types';
import { creerCrayon, dessinerPapier, type Crayon } from './crayon';
import { dessinerCourbes, dessinerFondCourbes, preparerAxes, type AxesCourbes } from './courbes';
import { dessinerDyna, dessinerFacesInstruments, dessinerTachy } from './instruments';
import { CSS, creerReglage, dessinerFondReglage, dessinerReglage, titreIssue } from './reglage';

const LARGEUR = 1280;
const HAUTEUR = 720;

/** Mesures de performance (seulement avec `?mesure=1`). */
interface Mesure {
  images: number;
  dessins: number;
  somme: number;
  max: number;
  durees: number[];
}

function contexte2d(toile: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = toile.getContext('2d');
  if (ctx === null) throw new Error('maquette b : canvas 2D indisponible');
  return ctx;
}

export function creer(contexte: Contexte): Maquette {
  const racine = contexte.racine;
  const style = document.createElement('style');
  style.textContent = CSS;
  const toile = document.createElement('canvas');
  toile.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;';
  toile.setAttribute('role', 'img');
  toile.setAttribute(
    'aria-label',
    'Pupitre : dynamomètre, tachymètre et courbes de l’essai en cours',
  );
  const scene = document.createElement('div');
  scene.className = 'pb-scene';
  const annonce = document.createElement('div');
  annonce.className = 'pb-cache';
  annonce.setAttribute('aria-live', 'polite');
  scene.append(annonce);
  racine.append(style, toile, scene);

  const ctx = contexte2d(toile);
  const cache = document.createElement('canvas');
  const ctxCache = contexte2d(cache);
  const crayon: Crayon = creerCrayon(ctx);
  const crayonCache: Crayon = creerCrayon(ctxCache);

  let detruit = false;
  let sale = true;
  let fondSale = true;
  let tailleSale = true;
  let dernierT = -1;
  let dernierePhase = '';
  let dernierTrajet: TrajetReference | null = null;
  let derniereIssue = false;
  let k = 1;
  let ox = 0;
  let oy = 0;
  let dpr = 1;

  const reglage = creerReglage(
    scene,
    () => {
      contexte.lancer();
    },
    () => {
      sale = true;
    },
  );

  let trajet: TrajetReference = contexte.trajets[0] as TrajetReference;
  let axes: AxesCourbes = preparerAxes(trajet);

  const preparer = (t: TrajetReference): void => {
    trajet = t;
    axes = preparerAxes(t);
    reglage.niveau2 = t.niveau === 'level2';
    reglage.kpEssai = t.kp;
    reglage.kiEssai = t.ki;
    reglage.ki.levier.hidden = !reglage.niveau2;
    reglage.ki.champ.hidden = !reglage.niveau2;
    reglage.regler(reglage.kp, t.kp);
    reglage.regler(reglage.ki, t.ki);
    annonce.textContent = '';
    derniereIssue = false;
    fondSale = true;
    sale = true;
  };

  // Police manuscrite du jeu, auto-hébergée (même fichier que l'interface du jeu).
  const face = new FontFace(
    'Patrick Hand B',
    `url(${import.meta.env.BASE_URL}fonts/patrick-hand-latin-400-normal.woff2)`,
  );
  face.load().then(
    () => {
      if (detruit) return;
      document.fonts.add(face);
      fondSale = true;
      sale = true;
    },
    () => {
      // Police indisponible : les replis de POLICE suffisent.
      fondSale = true;
    },
  );

  const observateur = new ResizeObserver(() => {
    tailleSale = true;
  });
  observateur.observe(racine);

  // Sans élément focalisé : +/−, pages, Entrée agissent sur Kp (les champs ont leurs écouteurs).
  const surTouche = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target !== document.body && e.target !== document.documentElement) return;
    reglage.touche(e, reglage.kp);
  };
  window.addEventListener('keydown', surTouche);

  const mesure: Mesure | null = new URLSearchParams(location.search).has('mesure')
    ? { images: 0, dessins: 0, somme: 0, max: 0, durees: [] }
    : null;
  if (mesure !== null) Reflect.set(window, '__mesureB', mesure);

  const redimensionner = (): void => {
    const l = Math.max(1, racine.clientWidth);
    const h = Math.max(1, racine.clientHeight);
    dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    const s = Math.min(l / LARGEUR, h / HAUTEUR);
    ox = (l - LARGEUR * s) / 2;
    oy = (h - HAUTEUR * s) / 2;
    k = s * dpr;
    toile.width = Math.round(l * dpr);
    toile.height = Math.round(h * dpr);
    cache.width = toile.width;
    cache.height = toile.height;
    scene.style.transform = `translate(${String(ox)}px, ${String(oy)}px) scale(${String(s)})`;
    fondSale = true;
  };

  const dessinerFond = (): void => {
    dessinerPapier(ctxCache, cache.width, cache.height, ox * dpr, oy * dpr, k);
    ctxCache.setTransform(k, 0, 0, k, ox * dpr, oy * dpr);
    dessinerFondReglage(crayonCache, reglage, trajet);
    dessinerFacesInstruments(
      crayonCache,
      trajet.physique.uMax,
      trajet.physique.m * trajet.physique.g,
    );
    dessinerFondCourbes(crayonCache, axes);
    ctxCache.setTransform(1, 0, 0, 1, 0, 0);
  };

  const dessiner = (etat: Readonly<EtatRejeu>): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(cache, 0, 0);
    ctx.setTransform(k, 0, 0, k, ox * dpr, oy * dpr);
    const actif = etat.phase !== 'attente';
    const ech = etat.echantillon;
    dessinerReglage(crayon, reglage, trajet, etat);
    dessinerDyna(crayon, {
      actif,
      uSat: ech.uSat,
      uCmd: ech.uCmd,
      sature: actif && ech.saturated,
      uMax: trajet.physique.uMax,
    });
    // Après l'issue, le jeu est figé : le treuil ne tourne plus (même après un choc).
    dessinerTachy(crayon, actif && !etat.issueAtteinte ? etat.cabine.v : 0, etat.cabine.y);
    dessinerCourbes(crayon, axes, actif, etat.indice, ech);
  };

  return {
    charger(t: TrajetReference): void {
      preparer(t);
    },
    mettreAJour(etat: Readonly<EtatRejeu>): void {
      if (detruit) return;
      const debut = performance.now();
      if (etat.trajet !== trajet) preparer(etat.trajet);
      if (tailleSale) {
        tailleSale = false;
        redimensionner();
      }
      if (fondSale) {
        fondSale = false;
        dessinerFond();
        sale = true;
      }
      const change =
        sale ||
        etat.t !== dernierT ||
        etat.phase !== dernierePhase ||
        etat.trajet !== dernierTrajet;
      if (change) {
        sale = false;
        dernierT = etat.t;
        dernierePhase = etat.phase;
        dernierTrajet = etat.trajet;
        dessiner(etat);
        if (etat.issueAtteinte !== derniereIssue) {
          derniereIssue = etat.issueAtteinte;
          annonce.textContent = derniereIssue ? titreIssue(trajet) : '';
        }
      }
      if (mesure !== null) {
        const duree = performance.now() - debut;
        mesure.images++;
        if (change) mesure.dessins++;
        mesure.somme += duree;
        if (duree > mesure.max) mesure.max = duree;
        if (mesure.durees.length < 2000) mesure.durees.push(duree);
      }
    },
    detruire(): void {
      detruit = true;
      window.removeEventListener('keydown', surTouche);
      observateur.disconnect();
      document.fonts.delete(face);
      if (mesure !== null) Reflect.deleteProperty(window, '__mesureB');
      reglage.bouton.blur();
      style.remove();
      toile.remove();
      scene.remove();
      toile.width = 0;
      toile.height = 0;
      cache.width = 0;
      cache.height = 0;
    },
  };
}
