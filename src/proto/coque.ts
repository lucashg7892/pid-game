/**
 * Coque des maquettes (lot B, v0.3) : monte une maquette dans la page, tient l'horloge de rejeu
 * des trajets de référence (`common/`), traite les touches réservées (1, 2, 3, P, R, H) et les
 * messages d une page parente (plus de page `tous`). Jetable comme les maquettes : aucun test, aucun texte EN.
 *
 * Paramètres d'URL : `proto=c` ; `trajet=victoire|choc|saturation` (défaut victoire) ;
 * `autoplay=1` (lance le trajet au montage) ; `chrome=0` (masque l'aide de la coque : captures) ;
 * `embed=1` (montée en iframe : pas d'aide, écoute les messages du parent).
 */
import { creerLecteur, type LecteurTrajet } from './common/replay';
import { TRAJETS_REFERENCE } from './common/trajets';
import type { IdTrajet, TrajetReference } from './common/types';
import type {
  Contexte,
  EtatRejeu,
  Maquette,
  MessageCommande,
  MessagePret,
  ModuleMaquette,
  NomMaquette,
} from './contrat';

/** Chargeurs des maquettes (imports dynamiques : rien de tout cela n'entre dans le jeu normal). */
const MAQUETTES: Readonly<Record<NomMaquette, () => Promise<ModuleMaquette>>> = {
  c: () => import('./c/index'),
};

/** Ordre des trajets pour les touches 1, 2, 3. */
const ORDRE: readonly IdTrajet[] = ['victoire', 'choc', 'saturation'];

/** État modifiable du rejeu (l'objet exposé aux maquettes est le même, en lecture seule). */
type EtatModifiable = { -readonly [K in keyof EtatRejeu]: EtatRejeu[K] };

/** Vrai si le nom désigne une maquette. */
export function estNomMaquette(nom: string): nom is NomMaquette {
  return nom === 'c';
}

function trajetParId(id: string | null): TrajetReference {
  const trouve = TRAJETS_REFERENCE.find((t) => t.id === id);
  return trouve ?? (TRAJETS_REFERENCE[0] as TrajetReference);
}

/** Aide de la coque (coin du haut), masquable. */
function creerAide(parent: HTMLElement): HTMLElement {
  const aide = document.createElement('div');
  aide.style.cssText =
    'position:fixed;right:8px;top:6px;z-index:99999;font:12px/1.35 system-ui,sans-serif;' +
    'color:#2a2724;background:rgba(247,240,222,0.86);border:1px solid rgba(42,39,36,0.35);' +
    'border-radius:4px;padding:3px 8px;pointer-events:none;opacity:0.85;';
  aide.textContent = '1 victoire · 2 choc · 3 saturation · P pause · R rejouer · H aide';
  parent.append(aide);
  return aide;
}

/**
 * Monte une maquette dans `body` et lance la boucle d'images.
 * @param nom maquette `a`, `b`, `c` ou `d`.
 * @param params paramètres d'URL.
 * @returns fonction qui détruit la maquette et la coque.
 */
export async function lancerMaquette(
  nom: NomMaquette,
  params: URLSearchParams,
): Promise<() => void> {
  const embarquee = params.get('embed') === '1';
  const masquerAide = embarquee || params.get('chrome') === '0';
  document.documentElement.style.cssText =
    'margin:0;height:100%;overflow:hidden;background:#f7f0de;';
  document.body.style.cssText = 'margin:0;height:100%;overflow:hidden;background:#f7f0de;';
  document.querySelector('#scene')?.setAttribute('hidden', '');
  const racine = document.createElement('div');
  racine.id = 'proto-racine';
  racine.style.cssText =
    'position:relative;width:100vw;height:100vh;overflow:hidden;background:#f7f0de;color:#2a2724;';
  document.body.append(racine);
  const aide = masquerAide ? null : creerAide(document.body);

  const lecteurs = new Map<IdTrajet, LecteurTrajet>();
  for (const trajet of TRAJETS_REFERENCE) lecteurs.set(trajet.id, creerLecteur(trajet));
  let courant: TrajetReference = trajetParId(params.get('trajet'));
  let lecteur = lecteurs.get(courant.id) as LecteurTrajet;
  let phase: EtatRejeu['phase'] = 'attente';
  let t = 0;
  let derniereImage = 0;
  let maquette: Maquette | null = null;

  const etat: EtatModifiable = {
    trajet: courant,
    lecteur,
    phase: 'attente',
    t: 0,
    indice: 0,
    echantillon: lecteur.plusProche(0),
    cabine: lecteur.cabine(0),
    issueAtteinte: false,
  };

  const choisir = (id: IdTrajet): void => {
    courant = trajetParId(id);
    lecteur = lecteurs.get(courant.id) as LecteurTrajet;
    phase = 'attente';
    t = 0;
    maquette?.charger(courant);
  };
  const lancer = (): void => {
    phase = 'en-cours';
    t = 0;
  };
  const contexte: Contexte = {
    racine,
    trajets: TRAJETS_REFERENCE,
    lancer,
    choisirTrajet: choisir,
  };

  const module = await MAQUETTES[nom]();
  maquette = module.creer(contexte);
  maquette.charger(courant);
  if (params.get('autoplay') === '1') lancer();

  const surTouche = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const cible = e.target;
    if (cible instanceof HTMLInputElement || cible instanceof HTMLTextAreaElement) return;
    const index =
      ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
    if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
      if (index >= 0 && !e.repeat) {
        choisir(ORDRE[index] as IdTrajet);
        lancer();
      }
    } else if (e.code === 'KeyP' && !e.repeat) {
      phase = phase === 'en-cours' ? 'pause' : phase === 'pause' ? 'en-cours' : phase;
    } else if (e.code === 'KeyR' && !e.repeat) {
      lancer();
    } else if (e.code === 'KeyH' && !e.repeat && aide !== null) {
      aide.style.display = aide.style.display === 'none' ? '' : 'none';
    }
  };
  window.addEventListener('keydown', surTouche);

  const surMessage = (e: MessageEvent): void => {
    const m = e.data as Partial<MessageCommande> | null;
    if (m === null || typeof m !== 'object' || m.proto !== 'cmd') return;
    if (m.cmd === 'trajet' && m.id !== undefined) {
      choisir(m.id);
      lancer();
    } else if (m.cmd === 'pause') {
      phase = phase === 'en-cours' ? 'pause' : phase === 'pause' ? 'en-cours' : phase;
    } else if (m.cmd === 'rejouer') {
      lancer();
    }
  };
  window.addEventListener('message', surMessage);

  let arret = false;
  const image = (maintenant: number): void => {
    if (arret) return;
    const dt = derniereImage === 0 ? 0 : Math.min(0.1, (maintenant - derniereImage) / 1000);
    derniereImage = maintenant;
    if (phase === 'en-cours') {
      t += dt;
      if (t >= lecteur.duree) {
        t = lecteur.duree;
        phase = 'fini';
      }
    }
    const tt = phase === 'attente' ? 0 : t;
    etat.trajet = courant;
    etat.lecteur = lecteur;
    etat.phase = phase;
    etat.t = tt;
    etat.indice = lecteur.indice(tt);
    etat.echantillon = lecteur.interpole(tt);
    etat.cabine = lecteur.cabine(tt);
    etat.issueAtteinte = phase !== 'attente' && etat.indice >= courant.pasIssue;
    maquette.mettreAJour(etat);
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);

  if (embarquee && window.parent !== window) {
    const pret: MessagePret = { proto: 'pret', nom };
    window.parent.postMessage(pret, '*');
  }

  return () => {
    arret = true;
    window.removeEventListener('keydown', surTouche);
    window.removeEventListener('message', surMessage);
    maquette.detruire();
    racine.remove();
    aide?.remove();
  };
}
