/**
 * Maquette A du pupitre (lot B, v0.3, JETABLE) : « salle de commande analogique ». Pupitre chargé
 * des années 1950 dessiné au crayon sur papier millimétré : cadrans à aiguille, voyants,
 * enregistreurs à papier déroulant, moteur du treuil en écorché (rotor animé), jauge de force.
 *
 * Dessin : deux canvas 2D superposés (couche fixe redessinée rarement, couche vive à chaque image)
 * sous des commandes DOM focalisables (leviers `role=slider`, champs numériques, bouton Lancer).
 * La planche fait 1280 × 720 et s'adapte à la fenêtre par une mise à l'échelle CSS.
 * Le rejeu suit toujours le trajet de référence : le réglage des gains est VISUEL.
 */
import type { Contexte, EtatRejeu, Maquette } from '../contrat';
import type { TrajetReference } from '../common/types';
import { ENCRE, PAPIER, POLICE } from './crayon';
import { dessinerFond } from './fond';
import {
  FENTE_BAS,
  FENTE_HAUT,
  GAIN_MAX,
  GAIN_PAS,
  HAUTEUR,
  LARGEUR,
  LEVIER_BAS,
  LEVIER_HAUT,
  LEVIER_KI_X,
  LEVIER_KP_X,
  PANNEAU_GAINS,
} from './plan';
import { dessinerVif, type Reglage } from './vif';

const STYLE = `
.pa-scene{position:absolute;inset:0;overflow:hidden;background-color:${PAPIER};}
.pa-plateau{position:absolute;left:0;top:0;width:${String(LARGEUR)}px;height:${String(HAUTEUR)}px;transform-origin:0 0;}
.pa-plateau canvas{position:absolute;left:0;top:0;width:${String(LARGEUR)}px;height:${String(HAUTEUR)}px;}
.pa-levier{position:absolute;border-radius:8px;cursor:ns-resize;touch-action:none;outline:none;}
.pa-levier:focus-visible{outline:3px dashed #1f4e7a;outline-offset:2px;}
.pa-levier[aria-disabled="true"]{cursor:not-allowed;}
.pa-champ{position:absolute;box-sizing:border-box;width:104px;height:30px;padding:0 6px;
  font:21px/1 ${POLICE};color:${ENCRE};text-align:center;background:rgba(254,252,245,0.95);
  border:1.5px solid #3a3a3a;border-radius:3px 6px 4px 5px;appearance:textfield;-moz-appearance:textfield;}
.pa-champ::-webkit-inner-spin-button,.pa-champ::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
.pa-champ:focus-visible{outline:3px dashed #1f4e7a;outline-offset:2px;}
.pa-champ:disabled{opacity:0.45;}
.pa-lancer{position:absolute;box-sizing:border-box;font:25px/1 ${POLICE};letter-spacing:2px;color:${ENCRE};
  background:repeating-linear-gradient(135deg,rgba(58,58,58,0.10) 0 1px,transparent 1px 5px),#fbf8ee;
  border:2.5px solid #3a3a3a;border-radius:11px 15px 10px 13px;box-shadow:3px 3px 0 rgba(58,58,58,0.45);
  cursor:pointer;}
.pa-lancer:hover{background-color:#fff;}
.pa-lancer:active{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(58,58,58,0.45);}
.pa-lancer:focus-visible{outline:3px dashed #1f4e7a;outline-offset:3px;}
.pa-lancer small{font-size:14px;letter-spacing:0;}
`;

/** Gain borné à [0 ; 8000] et arrondi au pas de 100. */
function borner(g: number): number {
  if (!Number.isFinite(g)) return 0;
  const a = Math.round(g / GAIN_PAS) * GAIN_PAS;
  return a < 0 ? 0 : a > GAIN_MAX ? GAIN_MAX : a;
}

type Gain = 'kp' | 'ki';

export function creer(contexte: Contexte): Maquette {
  const doc = contexte.racine.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'pa-scene';
  const style = doc.createElement('style');
  style.textContent = STYLE;
  scene.append(style);
  const plateau = doc.createElement('div');
  plateau.className = 'pa-plateau';
  scene.append(plateau);

  const toileFond = doc.createElement('canvas');
  const toileVive = doc.createElement('canvas');
  toileFond.setAttribute('aria-hidden', 'true');
  toileVive.setAttribute('role', 'img');
  toileVive.setAttribute(
    'aria-label',
    'Pupitre de commande du treuil : cadrans, enregistreurs, moteur et jauge de force',
  );
  plateau.append(toileFond, toileVive);
  const ctxFond = toileFond.getContext('2d');
  const ctxVif = toileVive.getContext('2d');
  if (ctxFond === null || ctxVif === null) throw new Error('maquette A : canvas 2D indisponible');

  // --- commandes ------------------------------------------------------------------------------
  const creerLevier = (cx: number, nom: string): HTMLDivElement => {
    const l = doc.createElement('div');
    l.className = 'pa-levier';
    l.tabIndex = 0;
    l.setAttribute('role', 'slider');
    l.setAttribute('aria-label', nom);
    l.setAttribute('aria-valuemin', '0');
    l.setAttribute('aria-valuemax', String(GAIN_MAX));
    l.style.left = `${String(cx - 56)}px`;
    l.style.top = `${String(LEVIER_HAUT + 2)}px`;
    l.style.width = '112px';
    l.style.height = `${String(LEVIER_BAS - LEVIER_HAUT - 4)}px`;
    plateau.append(l);
    return l;
  };
  const creerChamp = (cx: number, nom: string): HTMLInputElement => {
    const c = doc.createElement('input');
    c.className = 'pa-champ';
    c.type = 'number';
    c.min = '0';
    c.max = String(GAIN_MAX);
    c.step = String(GAIN_PAS);
    c.setAttribute('aria-label', nom);
    c.style.left = `${String(cx - 52)}px`;
    c.style.top = `${String(LEVIER_BAS + 26)}px`;
    plateau.append(c);
    return c;
  };
  const levierKp = creerLevier(LEVIER_KP_X, 'Gain proportionnel Kp, en newtons par mètre');
  const levierKi = creerLevier(LEVIER_KI_X, 'Gain intégral Ki, en newtons par mètre-seconde');
  const champKp = creerChamp(LEVIER_KP_X, 'Kp en N/m');
  const champKi = creerChamp(LEVIER_KI_X, 'Ki en N/(m·s)');
  const lancer = doc.createElement('button');
  lancer.type = 'button';
  lancer.className = 'pa-lancer';
  lancer.innerHTML = 'LANCER <small>(Entrée)</small>';
  lancer.style.left = `${String(PANNEAU_GAINS.x + 22)}px`;
  lancer.style.top = `${String(LEVIER_BAS + 64)}px`;
  lancer.style.width = `${String(PANNEAU_GAINS.w - 44)}px`;
  lancer.style.height = '42px';
  plateau.append(lancer);
  contexte.racine.append(scene);

  // --- état local -----------------------------------------------------------------------------
  let trajet: TrajetReference | null = null;
  const reglage: { -readonly [K in keyof Reglage]: Reglage[K] } = {
    kp: 0,
    ki: 0,
    verrouille: false,
  };
  let detruit = false;
  let echelle = 1;
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // mesures de performance, lisibles par les scripts de capture (attributs data-*)
  let libelleLancer = 'LANCER';
  let nbFonds = 0;
  let nbImages = 0;
  let sommeMs = 0;
  let maxMs = 0;

  const kiActif = (): boolean => trajet !== null && trajet.niveau === 'level2';

  const afficherReglage = (): void => {
    for (const [nom, levier, champ] of [
      ['kp', levierKp, champKp],
      ['ki', levierKi, champKi],
    ] as const) {
      const v = reglage[nom];
      const actif = nom === 'kp' || kiActif();
      levier.setAttribute('aria-valuenow', String(v));
      levier.setAttribute('aria-valuetext', actif ? String(v) : 'hors service au niveau 1');
      levier.setAttribute('aria-disabled', String(!actif || reglage.verrouille));
      levier.tabIndex = actif ? 0 : -1;
      if (doc.activeElement !== champ) champ.value = String(v);
      champ.disabled = !actif || reglage.verrouille;
    }
  };

  const regler = (nom: Gain, valeur: number): void => {
    if (reglage.verrouille) return;
    if (nom === 'ki' && !kiActif()) return;
    reglage[nom] = borner(valeur);
    afficherReglage();
  };

  const redessinerFond = (): void => {
    if (trajet === null || detruit) return;
    const debut = performance.now();
    dessinerFond(ctxFond, trajet);
    nbFonds++;
    scene.dataset.fonds = String(nbFonds);
    scene.dataset.fondMs = (performance.now() - debut).toFixed(1);
  };

  const ajuster = (): void => {
    const w = scene.clientWidth || LARGEUR;
    const h = scene.clientHeight || HAUTEUR;
    echelle = Math.min(w / LARGEUR, h / HAUTEUR);
    const dx = (w - LARGEUR * echelle) / 2;
    const dy = (h - HAUTEUR * echelle) / 2;
    plateau.style.transform = `translate(${String(dx)}px, ${String(dy)}px) scale(${String(echelle)})`;
    const dpr = window.devicePixelRatio || 1;
    for (const [toile, ctx] of [
      [toileFond, ctxFond],
      [toileVive, ctxVif],
    ] as const) {
      toile.width = Math.round(LARGEUR * echelle * dpr);
      toile.height = Math.round(HAUTEUR * echelle * dpr);
      ctx.setTransform(echelle * dpr, 0, 0, echelle * dpr, 0, 0);
    }
    // papier millimétré de toute la page, calé sur la planche
    const p = (n: number): string => `${String(n * echelle)}px`;
    const fin = 'rgba(134,185,178,0.30)';
    const demi = 'rgba(95,159,153,0.30)';
    const fort = 'rgba(61,133,128,0.42)';
    scene.style.backgroundImage = [fort, fort, demi, demi, fin, fin]
      .map(
        (c, k) => `linear-gradient(${k % 2 === 0 ? '0deg' : '90deg'}, ${c} 1px, transparent 1px)`,
      )
      .join(',');
    scene.style.backgroundSize = [50, 50, 25, 25, 5, 5].map((n) => `${p(n)} ${p(n)}`).join(',');
    scene.style.backgroundPosition = `${String(dx)}px ${String(dy)}px`;
    redessinerFond();
  };

  const observateur = new ResizeObserver(ajuster);
  observateur.observe(scene);
  ajuster();

  // police manuscrite : redessiner la couche fixe quand elle est prête
  doc.fonts.load(`16px ${POLICE}`).then(
    () => {
      redessinerFond();
    },
    () => {
      redessinerFond();
    },
  );

  // --- événements -----------------------------------------------------------------------------
  const valeurDepuisPointeur = (e: PointerEvent): number => {
    const r = plateau.getBoundingClientRect();
    const y = (e.clientY - r.top) / echelle;
    return ((FENTE_BAS - y) / (FENTE_BAS - FENTE_HAUT)) * GAIN_MAX;
  };
  const brancherLevier = (levier: HTMLDivElement, nom: Gain): void => {
    levier.addEventListener('pointerdown', (e) => {
      levier.focus();
      levier.setPointerCapture(e.pointerId);
      regler(nom, valeurDepuisPointeur(e));
    });
    levier.addEventListener('pointermove', (e) => {
      if (levier.hasPointerCapture(e.pointerId)) regler(nom, valeurDepuisPointeur(e));
    });
    levier.addEventListener('wheel', (e) => {
      e.preventDefault();
      regler(nom, reglage[nom] + (e.deltaY < 0 ? GAIN_PAS : -GAIN_PAS));
    });
  };
  brancherLevier(levierKp, 'kp');
  brancherLevier(levierKi, 'ki');

  const brancherChamp = (champ: HTMLInputElement, nom: Gain): void => {
    champ.addEventListener('input', () => {
      if (champ.value !== '') regler(nom, Number(champ.value));
    });
    champ.addEventListener('change', () => {
      regler(nom, Number(champ.value));
      champ.value = String(reglage[nom]);
    });
    champ.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        regler(nom, Number(champ.value));
        champ.value = String(reglage[nom]);
        contexte.lancer();
      } else if (e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        regler(nom, reglage[nom] + (e.key === 'PageUp' ? 1000 : -1000));
        champ.value = String(reglage[nom]);
      }
    });
  };
  brancherChamp(champKp, 'kp');
  brancherChamp(champKi, 'ki');

  lancer.addEventListener('click', () => {
    contexte.lancer();
  });

  const surTouche = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const cible = e.target;
    if (cible instanceof HTMLInputElement || cible instanceof HTMLButtonElement) return;
    if (cible instanceof Node && !scene.contains(cible) && cible !== doc.body) return;
    const nom: Gain = cible === levierKi ? 'ki' : 'kp';
    let pas: number;
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
      case '+':
        pas = GAIN_PAS;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
      case '-':
        pas = -GAIN_PAS;
        break;
      case 'PageUp':
        pas = 1000;
        break;
      case 'PageDown':
        pas = -1000;
        break;
      case 'Home':
        pas = -GAIN_MAX;
        break;
      case 'End':
        pas = GAIN_MAX;
        break;
      case 'Enter':
        e.preventDefault();
        contexte.lancer();
        return;
      default:
        return;
    }
    e.preventDefault();
    regler(nom, reglage[nom] + pas);
  };
  window.addEventListener('keydown', surTouche);

  return {
    charger(t: TrajetReference): void {
      trajet = t;
      reglage.kp = borner(t.kp);
      reglage.ki = t.niveau === 'level2' ? borner(t.ki) : 0;
      reglage.verrouille = false;
      nbImages = 0;
      sommeMs = 0;
      maxMs = 0;
      afficherReglage();
      redessinerFond();
    },
    mettreAJour(etat: Readonly<EtatRejeu>): void {
      if (detruit) return;
      const debut = performance.now();
      if (trajet !== etat.trajet) {
        trajet = etat.trajet;
        redessinerFond();
      }
      const verrou = etat.phase === 'en-cours' || etat.phase === 'pause';
      if (verrou !== reglage.verrouille) {
        reglage.verrouille = verrou;
        afficherReglage();
      }
      const libelle = etat.phase === 'attente' ? 'LANCER' : 'RELANCER';
      if (libelle !== libelleLancer) {
        libelleLancer = libelle;
        lancer.innerHTML = `${libelle} <small>(Entrée)</small>`;
      }
      dessinerVif(ctxVif, etat, reglage, debut, reduit);
      const duree = performance.now() - debut;
      nbImages++;
      sommeMs += duree;
      if (duree > maxMs) maxMs = duree;
      if (nbImages % 30 === 0) {
        scene.dataset.images = String(nbImages);
        scene.dataset.moyenneMs = (sommeMs / nbImages).toFixed(3);
        scene.dataset.maxMs = maxMs.toFixed(3);
      }
    },
    detruire(): void {
      detruit = true;
      observateur.disconnect();
      window.removeEventListener('keydown', surTouche);
      scene.remove();
    },
  };
}
