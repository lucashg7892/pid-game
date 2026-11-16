/**
 * Colonne de droite du pupitre : « les courbes » (T-051, décision D35). Quatre enregistreurs à papier
 * alignés sur un axe du temps commun (erreur, force du moteur appliquée et demandée avec les termes P
 * et I au niveau 2, vitesse, accélération), tracés en direct d'après le journal du trajet
 * (`etat.journal`), à échelles fixes par niveau ({@link ECHELLES}).
 *
 * Après l'issue, les courbes restent affichées et un curseur ({@link CurseurTrajet}) permet de
 * reparcourir le trajet : glisser sur les courbes (souris, doigt), ou clavier (`<input type="range">`
 * accessible posé sur la poignée : flèches ±1 pas, Page précédente et suivante ±10, Début, Fin). Les
 * valeurs lues sont celles du curseur, et la colonne de la machine suit le même curseur. Le curseur ne
 * touche jamais au jeu ; il disparaît dès qu'un nouveau trajet est lancé.
 *
 * Fond : plaque, papiers, échelles, légendes. Vif : tracés, valeurs, curseur (voir `courbes-fond.ts` et
 * `courbes-vif.ts`).
 */
import type { ColonnePupitre, ContextePlan, EtatPupitre, MontageColonne } from './colonne';
import { dispositionCourbes, pasDeX, type DispositionCourbes } from './courbes-plan';
import { dessinerFondCourbes, colonnesLegende, type ColonnesLegende } from './courbes-fond';
import {
  creerMemoireCourbes,
  creerTamponChevrons,
  dessinerVifCourbes,
  majTextesCourbes,
  type TamponsCourbes,
} from './courbes-vif';
import { ECHELLES, texteValeur } from './courbes-echelles';
import {
  indiceApresTouche,
  valeursAuPas,
  valeursVides,
  type CurseurTrajet,
  type ValeursCourbes,
} from './curseur';
import type { IdColonne, RectPlan } from './plan';

/** Options de {@link creerColonneCourbes}. */
export interface OptionsCourbes {
  /** Curseur du trajet, partagé avec la colonne de la machine. */
  readonly curseur: CurseurTrajet;
}

/** Place un élément dans le plan (unités du plan) : n'écrit que si la position change. */
function poser(noeud: HTMLElement, r: Readonly<RectPlan>): void {
  const cle = `${String(r.x)}|${String(r.y)}|${String(r.w)}|${String(r.h)}`;
  if (noeud.dataset['pos'] === cle) {
    return;
  }
  noeud.dataset['pos'] = cle;
  noeud.style.left = `${String(Math.round(r.x))}px`;
  noeud.style.top = `${String(Math.round(r.y))}px`;
  noeud.style.width = `${String(Math.round(r.w))}px`;
  noeud.style.height = `${String(Math.round(r.h))}px`;
}

/**
 * Crée la colonne des courbes.
 * @param options voir {@link OptionsCourbes}.
 */
export function creerColonneCourbes(options: OptionsCourbes): ColonnePupitre {
  const curseur = options.curseur;
  const id: IdColonne = 'courbes';
  const valeurs: ValeursCourbes = valeursVides();
  const memoire = creerMemoireCourbes();
  const tampons: TamponsCourbes = { chevrons: creerTamponChevrons() };
  // Disposition et colonnes de légende : calculées une fois par niveau (aucune allocation par image).
  let dispo: DispositionCourbes | null = null;
  let legende: ColonnesLegende | null = null;
  let dispoRect: RectPlan | null = null;
  let dispoNiveau = '';
  const disposition = (r: RectPlan, niveau: EtatPupitre['niveau']): DispositionCourbes => {
    if (dispo === null || dispoRect !== r || dispoNiveau !== niveau) {
      dispo = dispositionCourbes(r, niveau);
      legende = colonnesLegende(r);
      dispoRect = r;
      dispoNiveau = niveau;
    }
    return dispo;
  };

  /** Lit les valeurs au curseur (ou à la fin du journal en direct). */
  const lire = (etat: Readonly<EtatPupitre>): void => {
    curseur.synchroniser(etat);
    const j = curseur.actif ? curseur.indice : etat.journal.count;
    valeursAuPas(etat.journal, etat.snapshot, j, valeurs);
  };

  return {
    id,
    dessinerFond(ctx, rect, etat): void {
      dessinerFondCourbes(ctx, rect, etat.niveau, etat.traducteur);
    },
    dessiner(ctx, rect, etat): void {
      lire(etat);
      const g = disposition(rect, etat.niveau);
      const textes = majTextesCourbes(memoire, valeurs, etat.niveau, etat.traducteur);
      dessinerVifCourbes(
        ctx,
        rect,
        {
          niveau: etat.niveau,
          journal: etat.journal,
          valeurs,
          textes,
          traducteur: etat.traducteur,
          curseurActif: curseur.actif,
          disposition: g,
          legende: legende as ColonnesLegende,
        },
        tampons,
      );
    },
    resume(etat): string {
      lire(etat);
      const tr = etat.traducteur;
      if (valeurs.vide) {
        return tr.t('pupitre.courbes.resumeVide');
      }
      const ech = ECHELLES[etat.niveau];
      const base = tr.t('pupitre.courbes.resume', {
        t: texteValeur(tr, valeurs.t, 2),
        e: texteValeur(tr, valeurs.e, ech.erreur.decimales),
        appliquee: texteValeur(tr, valeurs.uSat, 0),
        demandee: texteValeur(tr, valeurs.uCmd, 0),
        v: texteValeur(tr, valeurs.v, ech.vitesse.decimales),
        a: texteValeur(tr, valeurs.a, ech.acceleration.decimales),
      });
      const pi = ech.termesPI
        ? ` ${tr.t('pupitre.courbes.resumePi', {
            p: texteValeur(tr, valeurs.p, 0),
            i: texteValeur(tr, valeurs.i, 0),
          })}`
        : '';
      const cur = curseur.actif ? ` ${tr.t('pupitre.courbes.resumeCurseur')}` : '';
      return `${base}${pi}${cur}`;
    },
    monter(contexte: ContextePlan): MontageColonne {
      return monterCurseur(contexte, curseur);
    },
  };
}

/** Éléments DOM du curseur : curseur clavier (`<input type="range">`) et zone de pointeur. */
function monterCurseur(contexte: ContextePlan, curseur: CurseurTrajet): MontageColonne {
  const { plan, traducteur: tr } = contexte;
  const champ = document.createElement('input');
  champ.type = 'range';
  champ.className = 'ui-pupitre-curseur';
  champ.min = '0';
  champ.step = '1';
  champ.max = '0';
  champ.value = '0';
  champ.hidden = true;
  const zone = document.createElement('div');
  zone.className = 'ui-pupitre-zone ui-pupitre-zone-courbes';
  zone.setAttribute('aria-hidden', 'true');
  zone.hidden = true;
  plan.append(zone, champ);

  let etatCourant: Readonly<EtatPupitre> | null = null;
  let dispo: DispositionCourbes | null = null;
  let dispoRect: RectPlan | null = null;
  let dispoNiveau = '';
  let langue = '';
  let cleTexte = '';
  const tampon: ValeursCourbes = valeursVides();

  const appliquer = (indice: number): void => {
    curseur.deplacer(indice);
    contexte.rafraichir();
  };
  champ.addEventListener('input', () => {
    appliquer(champ.valueAsNumber);
  });
  champ.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }
    const suite = indiceApresTouche(e.code, curseur.indice, curseur.count);
    if (suite === null) {
      return;
    }
    // La touche est à nous : ni défilement, ni réglage de Kp (PageUp et PageDown), ni marche.
    e.preventDefault();
    e.stopPropagation();
    appliquer(suite);
  });
  const suivre = (e: PointerEvent): void => {
    const echelle = contexte.echelle();
    if (dispo === null || etatCourant === null || echelle <= 0) {
      return;
    }
    const x = (e.clientX - plan.getBoundingClientRect().left) / echelle;
    appliquer(pasDeX(dispo, x, etatCourant.journal.capacity));
  };
  zone.addEventListener('pointerdown', (e) => {
    if (!curseur.actif) {
      return;
    }
    e.preventDefault();
    champ.focus({ preventScroll: true });
    zone.setPointerCapture(e.pointerId);
    suivre(e);
  });
  zone.addEventListener('pointermove', (e) => {
    if (curseur.actif && zone.hasPointerCapture(e.pointerId)) {
      suivre(e);
    }
  });

  return {
    maj(etat, rect, montree): void {
      etatCourant = etat;
      curseur.synchroniser(etat);
      const visible = montree && curseur.actif;
      if (champ.hidden === visible) {
        champ.hidden = !visible;
      }
      if (zone.hidden === visible) {
        zone.hidden = !visible;
      }
      if (!visible) {
        return;
      }
      if (dispo === null || dispoRect !== rect || dispoNiveau !== etat.niveau) {
        dispo = dispositionCourbes(rect, etat.niveau);
        dispoRect = rect;
        dispoNiveau = etat.niveau;
        poser(zone, dispo.zone);
        poser(champ, {
          x: dispo.x0 - 6,
          y: dispo.axeBas - 2,
          w: dispo.x1 - dispo.x0 + 12,
          h: 20,
        });
      }
      const max = String(curseur.count);
      if (champ.max !== max) {
        champ.max = max;
      }
      const valeur = String(curseur.indice);
      if (champ.value !== valeur) {
        champ.value = valeur;
      }
      const cle = `${tr.locale}|${valeur}|${max}`;
      if (cle !== cleTexte || langue !== tr.locale) {
        cleTexte = cle;
        langue = tr.locale;
        champ.setAttribute('aria-label', tr.t('pupitre.courbes.curseur.label'));
        valeursAuPas(etat.journal, etat.snapshot, curseur.indice, tampon);
        const ech = ECHELLES[etat.niveau];
        champ.setAttribute(
          'aria-valuetext',
          tr.t('pupitre.courbes.curseur.valeur', {
            t: texteValeur(tr, tampon.t, 2),
            e: texteValeur(tr, tampon.e, ech.erreur.decimales),
            appliquee: texteValeur(tr, tampon.uSat, 0),
            v: texteValeur(tr, tampon.v, ech.vitesse.decimales),
            a: texteValeur(tr, tampon.a, ech.acceleration.decimales),
          }),
        );
      }
    },
    detruire(): void {
      champ.remove();
      zone.remove();
    },
  };
}
