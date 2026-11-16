/**
 * Pupitre de contrôle (T-049, décisions D35 et D36) : remplace le panneau de réglage. Un plan
 * dessiné en canvas 2D (deux canvas : fond et vif, voir `colonne.ts`) en surimpression sur la
 * scène, avec par-dessus les contrôles DOM accessibles de la colonne de réglage (leviers
 * `<input type="range">` rendus transparents, champs numériques, boutons « Lancer »,
 * « Recommencer » et « Fermer »). Aucune dépendance à three.
 *
 * Visibilité (règles pures dans `modele.ts`) : le pupitre s'ouvre tout seul en phase de réglage ;
 * le joueur peut aussi l'ouvrir en LECTURE SEULE (trajet, embarquement, sortie, issue, pause)
 * sans mettre le jeu en pause. L'ouverture demandée et la fermeture passent par l'interface
 * (`Ui.setPupitre`), qui décide d'appeler `level.interact()` ou de basculer l'affichage en lecture.
 *
 * Mouvement réduit : le pupitre n'anime rien (les leviers sautent à la valeur) ; la préférence est
 * transmise aux colonnes dans `EtatPupitre.mouvementReduit`.
 */
import type { Level, LevelSnapshot } from '../../game';
import type { Translator } from '../../i18n';
import { creerColonneVide } from './colonne-vide';
import type { ColonnePupitre, EtatPupitre } from './colonne';
import { pupitreVisible, reglageDe, valeurDe, type ReglagePupitre } from './modele';
import { COLONNES, placerPlan, type PlacementPlan } from './plan';
import {
  creerColonneReglage,
  fractionDeY,
  geometrieReglage,
  texteNote,
  type GeometrieLevier,
} from './reglage';

/** Options de {@link creerPupitre}. */
export interface OptionsPupitre {
  /** Conteneur de l'interface (le pupitre y ajoute son élément). */
  readonly racine: HTMLElement;
  /** Niveau piloté (réglage, lancement, journal du trajet : lecture seule pour le journal). */
  readonly level: Level;
  /** Traducteur. */
  readonly traducteur: Translator;
  /** Annonce une phrase dans la région `aria-live` du jeu. */
  readonly annoncer: (texte: string) => void;
  /** Vrai si les commandes du niveau sont suspendues (aide ou tableau ouvert). */
  readonly bloque: () => boolean;
  /** Appelée après chaque commande du joueur (met l'interface à jour tout de suite). */
  readonly apresCommande: () => void;
  /** Ferme le pupitre (bouton « Fermer »). */
  readonly fermer: () => void;
  /**
   * Colonnes qui remplacent celles par défaut, par emplacement : les colonnes du centre et de droite
   * (T-050, T-051) se branchent ici. Défaut : réglage pour la gauche, cadres vides ailleurs.
   */
  readonly colonnes?: readonly ColonnePupitre[];
  /** Préférence « mouvement réduit » (défaut : `prefers-reduced-motion` du navigateur). */
  readonly mouvementReduit?: () => boolean;
}

/** Pupitre monté. */
export interface Pupitre {
  /** Élément racine du pupitre (dans le conteneur de l'interface). */
  readonly element: HTMLElement;
  /** Vrai si le pupitre est visible. */
  readonly visible: boolean;
  /** Vrai si le joueur l'a ouvert en lecture seule. */
  readonly lectureOuverte: boolean;
  /** Placement courant du plan (échelle, colonnes montrées). */
  readonly placement: Readonly<PlacementPlan>;
  /**
   * Ouvre ou ferme l'affichage en lecture seule (sans effet sur la phase du niveau).
   * @param ouvert vrai pour ouvrir.
   */
  setLecture(ouvert: boolean): void;
  /**
   * Contrôles qui peuvent recevoir le focus, dans l'ordre de tabulation (piège de focus).
   */
  focalisables(): HTMLElement[];
  /**
   * Met le pupitre à jour d'après le niveau et le dessine s'il est visible.
   * @param largeur largeur de la fenêtre (px CSS).
   * @param hauteur hauteur de la fenêtre (px CSS).
   */
  update(largeur: number, hauteur: number): void;
  /** Démonte le pupitre. */
  destroy(): void;
}

/** Crée un élément avec une classe. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] {
  const noeud = document.createElement(tag);
  noeud.className = classe;
  parent.append(noeud);
  return noeud;
}

/** Place un élément dans le plan (unités du plan). */
function poser(noeud: HTMLElement, x: number, y: number, largeur: number, hauteur: number): void {
  noeud.style.left = `${String(Math.round(x))}px`;
  noeud.style.top = `${String(Math.round(y))}px`;
  noeud.style.width = `${String(Math.round(largeur))}px`;
  noeud.style.height = `${String(Math.round(hauteur))}px`;
}

/** Contrôles DOM d'un levier. */
interface ControlesLevier {
  readonly geo: GeometrieLevier;
  readonly curseur: HTMLInputElement;
  readonly zone: HTMLDivElement;
  readonly champ: HTMLInputElement;
  readonly aide: HTMLElement;
}

/**
 * Monte le pupitre dans `options.racine`, caché.
 * @param options voir {@link OptionsPupitre}.
 */
export function creerPupitre(options: OptionsPupitre): Pupitre {
  const { racine, level, traducteur: tr, annoncer, bloque, apresCommande } = options;
  const spec = level.tuning;
  const niveau = level.snapshot.levelId;
  const colonnes = new Map<string, ColonnePupitre>();
  colonnes.set('reglage', creerColonneReglage());
  colonnes.set('machine', creerColonneVide('machine'));
  colonnes.set('courbes', creerColonneVide('courbes'));
  for (const c of options.colonnes ?? []) {
    colonnes.set(c.id, c);
  }
  const mouvementReduit =
    options.mouvementReduit ??
    ((): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // --- DOM ---
  const section = el('section', 'ui-pupitre', racine);
  section.id = 'ui-pupitre';
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-labelledby', 'ui-pupitre-titre');
  section.hidden = true;
  const plan = el('div', 'ui-pupitre-plan', section);
  const toileFond = el('canvas', 'ui-pupitre-toile', plan);
  const toileVive = el('canvas', 'ui-pupitre-toile', plan);
  toileFond.setAttribute('aria-hidden', 'true');
  toileVive.setAttribute('aria-hidden', 'true');
  const titre = el('h2', 'ui-sr', plan);
  titre.id = 'ui-pupitre-titre';
  const geo = geometrieReglage(COLONNES.reglage);

  const creerControles = (g: GeometrieLevier, idAide: string): ControlesLevier => {
    const longueur = g.fente.bas - g.fente.haut + 12;
    const curseur = el('input', 'ui-pupitre-levier', plan);
    curseur.type = 'range';
    curseur.min = String(spec.min);
    curseur.max = String(spec.max);
    curseur.step = String(spec.step);
    poser(curseur, g.fente.x - longueur / 2, (g.fente.haut + g.fente.bas) / 2 - 20, longueur, 40);
    const zone = el('div', 'ui-pupitre-zone', plan);
    zone.setAttribute('aria-hidden', 'true');
    poser(zone, g.zone.x, g.zone.y, g.zone.w, g.zone.h);
    const champ = el('input', 'ui-pupitre-champ num', plan);
    champ.type = 'number';
    champ.min = String(spec.min);
    champ.max = String(spec.max);
    champ.step = String(spec.step);
    champ.inputMode = 'numeric';
    poser(champ, g.champ.x, g.champ.y, g.champ.w, g.champ.h);
    const aide = el('p', 'ui-sr', plan);
    aide.id = idAide;
    curseur.setAttribute('aria-describedby', idAide);
    return { geo: g, curseur, zone, champ, aide };
  };
  const kp = creerControles(geo.kp, 'ui-pupitre-aide-kp');
  const ki = creerControles(geo.ki, 'ui-pupitre-aide-ki');
  // Note lue aux lecteurs d'écran : pourquoi le réglage est figé (dessinée aussi dans le canvas).
  const note = el('p', 'ui-sr ui-pupitre-note', plan);
  const lancer = el('button', 'ui-btn ui-primary ui-pupitre-lancer', plan);
  lancer.type = 'button';
  poser(lancer, geo.lancer.x, geo.lancer.y, geo.lancer.w, geo.lancer.h);
  const recommencer = el('button', 'ui-btn ui-pupitre-recommencer', plan);
  recommencer.type = 'button';
  poser(recommencer, geo.lancer.x, geo.lancer.y, geo.lancer.w, geo.lancer.h);
  const fermer = el('button', 'ui-btn ui-pupitre-fermer', plan);
  fermer.type = 'button';
  poser(fermer, geo.fermer.x, geo.fermer.y, geo.fermer.w, geo.fermer.h);

  const ctxFond = toileFond.getContext('2d');
  const ctxVif = toileVive.getContext('2d');

  // --- État ---
  let lectureOuverte = false;
  let visible = false;
  let detruit = false;
  let placement: PlacementPlan = placerPlan(1280, 720);
  let tailleLargeur = -1;
  let tailleHauteur = -1;
  let densite = -1;
  let versionFond = 1;
  let langue = '';
  let cleReglage = '';
  let ouvreur: HTMLElement | null = null;
  let issueAnnoncee = -1;
  let editableAvant = false;
  /** Instant de l'image (ms) lu par les colonnes. */
  const etatPartage = {
    maintenant: 0,
    mouvementReduit: false,
    versionFond: 1,
    reglage: reglageDe(niveau, 'approach', false) as Readonly<ReglagePupitre>,
    phase: 'approach' as LevelSnapshot['phase'],
    enPause: false,
  };
  const etat: EtatPupitre = {
    niveau,
    reglageSpec: spec,
    snapshot: level.snapshot,
    journal: level.tripLog,
    traducteur: tr,
    get reglage() {
      return etatPartage.reglage;
    },
    get phase() {
      return etatPartage.phase;
    },
    get enPause() {
      return etatPartage.enPause;
    },
    get mouvementReduit() {
      return etatPartage.mouvementReduit;
    },
    get versionFond() {
      return etatPartage.versionFond;
    },
    get maintenant() {
      return etatPartage.maintenant;
    },
    annoncer,
  };

  // --- Textes (réécrits quand la langue change) ---
  const ecrireTextes = (): void => {
    titre.textContent = tr.t('pupitre.titre');
    lancer.textContent = tr.t('controls.launch');
    recommencer.textContent = tr.t('controls.restart');
    fermer.textContent = tr.t('pupitre.fermer');
    kp.curseur.setAttribute('aria-label', tr.t('level1.kp.label'));
    kp.champ.setAttribute('aria-label', tr.t('level1.kp.field'));
    ki.curseur.setAttribute('aria-label', tr.t('level2.ki.label'));
    ki.champ.setAttribute('aria-label', tr.t('level2.ki.field'));
    kp.aide.textContent = `${tr.t('level1.kp.help')} ${tr.t('level1.kp.range')}`;
    ki.aide.textContent = `${tr.t('level2.ki.help')} ${tr.t('level2.ki.range')}`;
  };

  /** Texte lu pour la valeur d'un levier. */
  const texteValeur = (qui: 'kp' | 'ki', valeur: number): string => {
    if (qui === 'ki' && niveau === 'level1') {
      return tr.t('pupitre.ki.horsService');
    }
    const n = tr.formatNumber(valeur, { maximumFractionDigits: 0 });
    return qui === 'kp'
      ? tr.t('level1.kp.valueText', { kp: n })
      : tr.t('level2.ki.valueText', { ki: n });
  };

  /** Applique un état de levier aux contrôles. */
  const regler = (
    c: ControlesLevier,
    qui: 'kp' | 'ki',
    etatLevier: ReglagePupitre['kp'],
    valeur: number,
  ): void => {
    const libre = etatLevier === 'libre';
    if (c.curseur.disabled === libre) {
      c.curseur.disabled = !libre;
    }
    if (c.champ.disabled === libre) {
      c.champ.disabled = !libre;
    }
    const horsService = etatLevier === 'hors-service';
    c.zone.classList.toggle('is-inactive', !libre);
    c.curseur.valueAsNumber = valeur;
    c.curseur.setAttribute('aria-valuetext', texteValeur(qui, valeur));
    if (horsService) {
      c.champ.value = '';
      c.champ.placeholder = '—';
    } else if (document.activeElement !== c.champ) {
      c.champ.valueAsNumber = valeur;
    }
  };

  // --- Commandes du joueur ---
  const commande = (action: () => unknown): void => {
    if (bloque()) {
      return;
    }
    action();
    apresCommande();
  };
  const brancher = (c: ControlesLevier, editable: () => boolean): void => {
    c.curseur.addEventListener('input', () => {
      if (editable()) {
        commande(() => level.setTuning(c.curseur.valueAsNumber));
      }
    });
    const valider = (): void => {
      if (!editable() || bloque()) {
        c.champ.valueAsNumber = level.snapshot[niveau === 'level2' ? 'ki' : 'kp'];
        return;
      }
      const valeur = c.champ.valueAsNumber;
      if (Number.isFinite(valeur)) {
        level.setTuning(valeur);
      }
      c.champ.valueAsNumber = level.snapshot[niveau === 'level2' ? 'ki' : 'kp'];
      apresCommande();
    };
    c.champ.addEventListener('change', valider);
    // Entrée valide la saisie (sans lancer) ; Échap l'annule avant que le pupitre se ferme.
    c.champ.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        valider();
      } else if (e.key === 'Escape') {
        c.champ.valueAsNumber = level.snapshot[niveau === 'level2' ? 'ki' : 'kp'];
      }
    });
    // Souris et doigt : la manette suit le pointeur le long de la fente.
    const suivre = (e: PointerEvent): void => {
      const boite = plan.getBoundingClientRect();
      const echelle = placement.echelle;
      if (echelle <= 0) {
        return;
      }
      const y = (e.clientY - boite.top) / echelle;
      const valeur = valeurDe(fractionDeY(c.geo, y), spec);
      commande(() => level.setTuning(valeur));
    };
    c.zone.addEventListener('pointerdown', (e) => {
      if (!editable()) {
        return;
      }
      e.preventDefault();
      c.curseur.focus({ preventScroll: true });
      c.zone.setPointerCapture(e.pointerId);
      suivre(e);
    });
    c.zone.addEventListener('pointermove', (e) => {
      if (editable() && c.zone.hasPointerCapture(e.pointerId)) {
        suivre(e);
      }
    });
  };
  const reglageCourant = (): Readonly<ReglagePupitre> => etatPartage.reglage;
  brancher(kp, () => reglageCourant().kp === 'libre');
  brancher(ki, () => reglageCourant().ki === 'libre');
  lancer.addEventListener('click', () => {
    commande(() => level.launch());
  });
  recommencer.addEventListener('click', () => {
    commande(() => level.restart());
  });
  fermer.addEventListener('click', () => {
    options.fermer();
  });

  // --- Dessin ---
  const dimensionner = (largeur: number, hauteur: number): void => {
    const dpr = Math.max(1, window.devicePixelRatio);
    if (largeur === tailleLargeur && hauteur === tailleHauteur && dpr === densite) {
      return;
    }
    tailleLargeur = largeur;
    tailleHauteur = hauteur;
    densite = dpr;
    placement = placerPlan(largeur, hauteur);
    plan.style.width = `${String(placement.largeur)}px`;
    plan.style.height = `${String(placement.hauteur)}px`;
    plan.style.left = `${placement.gauche.toFixed(2)}px`;
    plan.style.top = `${placement.haut.toFixed(2)}px`;
    plan.style.transform = `scale(${placement.echelle.toFixed(4)})`;
    plan.classList.toggle('is-etroit', placement.etroit);
    for (const toile of [toileFond, toileVive]) {
      toile.style.width = `${String(placement.largeur)}px`;
      toile.style.height = `${String(placement.hauteur)}px`;
      toile.width = Math.max(1, Math.round(placement.largeur * placement.echelle * dpr));
      toile.height = Math.max(1, Math.round(placement.hauteur * placement.echelle * dpr));
    }
    versionFond += 1;
  };

  const effacer = (ctx: CanvasRenderingContext2D): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const k = placement.echelle * densite;
    ctx.setTransform(k, 0, 0, k, 0, 0);
  };

  const dessiner = (): void => {
    if (ctxFond === null || ctxVif === null) {
      return;
    }
    if (etatPartage.versionFond !== versionFond) {
      etatPartage.versionFond = versionFond;
      effacer(ctxFond);
      for (const id of placement.colonnes) {
        colonnes.get(id)?.dessinerFond(ctxFond, COLONNES[id], etat);
      }
    }
    effacer(ctxVif);
    for (const id of placement.colonnes) {
      colonnes.get(id)?.dessiner(ctxVif, COLONNES[id], etat);
    }
  };

  // Police manuscrite chargée à la demande : le fond se redessine quand elle arrive.
  const surPolice = (): void => {
    if (!detruit) {
      versionFond += 1;
    }
  };
  void document.fonts.load('18px "Patrick Hand"').then(surPolice, surPolice);
  void document.fonts.ready.then(surPolice, surPolice);

  /** Rend le focus au document (ou à l'élément qui a ouvert le pupitre) à la fermeture. */
  const rendreFocus = (): void => {
    const actif = document.activeElement;
    if (actif instanceof HTMLElement && section.contains(actif)) {
      actif.blur();
      if (ouvreur?.isConnected === true) {
        ouvreur.focus({ preventScroll: true });
      }
    }
    ouvreur = null;
  };

  const update = (largeur: number, hauteur: number): void => {
    if (detruit) {
      return;
    }
    const s = level.snapshot;
    const enPause = s.phase === 'paused';
    const phase = enPause && s.resumePhase !== null ? s.resumePhase : s.phase;
    if (phase === 'tuning' && !enPause) {
      // Le réglage reprend la main : l'affichage en lecture seule n'a plus lieu d'être.
      lectureOuverte = false;
    }
    const doitEtreVisible = pupitreVisible(phase, enPause, lectureOuverte);
    if (!doitEtreVisible) {
      if (visible) {
        visible = false;
        section.hidden = true;
        rendreFocus();
      }
      editableAvant = false;
      return;
    }
    const reglage = reglageDe(niveau, phase, enPause);
    // Langue : textes DOM et fond.
    if (langue !== tr.locale) {
      langue = tr.locale;
      ecrireTextes();
      versionFond += 1;
    }
    const cle = `${reglage.mode}|${reglage.kp}|${reglage.ki}`;
    if (cle !== cleReglage) {
      cleReglage = cle;
      versionFond += 1;
    }
    etatPartage.reglage = reglage;
    const texteDeNote = texteNote(tr, niveau, phase, reglage.mode);
    if (note.textContent !== texteDeNote) {
      note.textContent = texteDeNote;
    }
    etatPartage.phase = phase;
    etatPartage.enPause = enPause;
    etatPartage.mouvementReduit = mouvementReduit();
    etatPartage.maintenant = performance.now();
    const ouvertureNouvelle = !visible;
    if (ouvertureNouvelle) {
      visible = true;
      section.hidden = false;
    }
    dimensionner(largeur, hauteur);

    // Contrôles.
    regler(kp, 'kp', reglage.kp, s.kp);
    regler(ki, 'ki', reglage.ki, s.ki);
    lancer.hidden = !reglage.lancerVisible;
    if (lancer.disabled === reglage.lancerActif) {
      lancer.disabled = !reglage.lancerActif;
    }
    recommencer.hidden = !reglage.recommencerVisible;
    if (recommencer.disabled === reglage.recommencerActif) {
      recommencer.disabled = !reglage.recommencerActif;
    }

    // Focus : sur le levier réglable à l'ouverture et à la reprise du réglage ; sur « Fermer »
    // quand le pupitre s'ouvre en lecture seule.
    const editable = reglage.mode === 'edition';
    if (editable && (ouvertureNouvelle || !editableAvant)) {
      (niveau === 'level2' ? ki : kp).curseur.focus({ preventScroll: true });
    } else if (ouvertureNouvelle) {
      fermer.focus({ preventScroll: true });
    } else if (!editable && editableAvant) {
      // Le réglage vient de se verrouiller (lancement) : le focus ne doit pas rester sur un contrôle grisé.
      const actif = document.activeElement;
      if (
        !(actif instanceof HTMLElement) ||
        !section.contains(actif) ||
        actif.matches(':disabled')
      ) {
        fermer.focus({ preventScroll: true });
      }
    }
    editableAvant = editable;

    // Annonce sobre : une seule, à l'issue (jamais par pas de simulation).
    if (phase === 'outcome' && s.outcome !== null && s.attempt !== issueAnnoncee) {
      issueAnnoncee = s.attempt;
      const n = (v: number): string => tr.formatNumber(v, { maximumFractionDigits: 0 });
      const reglageTexte =
        niveau === 'level2'
          ? tr.t('hud.ki.tag', { kp: n(s.kp), ki: n(s.ki) })
          : tr.t('hud.kp.value', { kp: n(s.kp) });
      annoncer(
        s.saturationSeen
          ? tr.t('pupitre.annonce.issueSature', { reglage: reglageTexte })
          : tr.t('pupitre.annonce.issueLibre', { reglage: reglageTexte }),
      );
    } else if (phase !== 'outcome') {
      issueAnnoncee = -1;
    }

    dessiner();
  };

  return {
    element: section,
    get visible(): boolean {
      return visible;
    },
    get lectureOuverte(): boolean {
      return lectureOuverte;
    },
    get placement(): Readonly<PlacementPlan> {
      return placement;
    },
    setLecture(ouvert: boolean): void {
      if (ouvert === lectureOuverte) {
        return;
      }
      lectureOuverte = ouvert;
      if (ouvert) {
        const actif = document.activeElement;
        ouvreur = actif instanceof HTMLElement && actif !== document.body ? actif : null;
      }
    },
    focalisables(): HTMLElement[] {
      return Array.from(
        section.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)'),
      ).filter((n) => n.closest('[hidden]') === null);
    },
    update,
    destroy(): void {
      detruit = true;
      section.remove();
    },
  };
}
