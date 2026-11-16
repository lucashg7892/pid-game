/**
 * Colonne des courbes du pupitre (T-051) : table des échelles par niveau, conversion valeur → pixel et
 * écrêtage avec chevron, disposition, curseur du trajet (bornes, clavier, retour au direct), état de la
 * machine à l'indice du curseur, valeurs lues, formats FR/EN, résumé pour lecteurs d'écran, dessin
 * (contexte 2D factice), indépendance du jeu en direct.
 */
import { describe, expect, it } from 'vitest';
import {
  ELEVATOR_MAX_FORCE,
  createLevel1,
  createLevel2,
  type Level,
  type LevelId,
} from '../../../src/game';
import { createTranslator, type Locale } from '../../../src/i18n';
import {
  COLONNES,
  DUREE_MAX_S,
  ECHELLES,
  PAS_MAX,
  borneIndice,
  choisirEtatMachine,
  creerColonneCourbes,
  creerColonneMachine,
  creerColonnesTrajet,
  creerCurseur,
  dispositionCourbes,
  etatMachineAuPas,
  etatMachineVide,
  fractionSurEchelle,
  graduationsEchelle,
  indiceApresTouche,
  pasDeX,
  positionSurEchelle,
  reglageDe,
  texteValeur,
  valeursAuPas,
  valeursVides,
  xDePas,
  type EtatPupitre,
  type PositionEchelle,
} from '../../../src/ui/pupitre';
import { creerTamponChevrons, tracerColonne } from '../../../src/ui/pupitre/courbes-vif';
import { finishTrip, reachConsole } from '../../game/helpers';

interface Texte {
  s: string;
  taille: number;
  x: number;
}

/** Contexte 2D factice : enregistre les textes et compte les segments tracés. */
function faux(): {
  ctx: CanvasRenderingContext2D;
  textes: Texte[];
  segments: { lineTo: number; moveTo: number; fill: number };
} {
  const textes: Texte[] = [];
  const segments = { lineTo: 0, moveTo: 0, fill: 0 };
  const etat: Record<string, unknown> = { font: '10px x' };
  const ctx = new Proxy(etat, {
    get(cible, nom: string) {
      if (nom === 'fillText') {
        return (s: string, x: number): void => {
          textes.push({ s, taille: Number.parseFloat(String(cible['font'])), x });
        };
      }
      if (nom === 'measureText') {
        return (s: string): { width: number } => ({ width: s.length * 8 });
      }
      if (nom === 'lineTo') {
        return (): void => {
          segments.lineTo += 1;
        };
      }
      if (nom === 'moveTo') {
        return (): void => {
          segments.moveTo += 1;
        };
      }
      if (nom === 'fill') {
        return (): void => {
          segments.fill += 1;
        };
      }
      if (nom in cible) return cible[nom];
      return () => undefined;
    },
    set(cible, nom: string, valeur) {
      cible[nom] = valeur;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, textes, segments };
}

function etatDe(level: Level, locale: Locale): EtatPupitre {
  const s = level.snapshot;
  const paused = s.phase === 'paused';
  const phase = paused && s.resumePhase !== null ? s.resumePhase : s.phase;
  return {
    niveau: s.levelId,
    reglageSpec: level.tuning,
    snapshot: s,
    journal: level.tripLog,
    traducteur: createTranslator(locale),
    reglage: reglageDe(s.levelId, phase, paused),
    phase,
    enPause: paused,
    mouvementReduit: false,
    versionFond: 1,
    maintenant: 1234,
    annoncer: () => undefined,
  };
}

/** Trajet complet au réglage donné, jusqu'à l'issue. */
function trajet(niveau: LevelId, reglage: number): Level {
  const level =
    niveau === 'level1' ? createLevel1({ animations: false }) : createLevel2({ animations: false });
  reachConsole(level);
  level.setTuning(reglage);
  finishTrip(level);
  return level;
}

/** Remplace les espaces insécables (NBSP, fine) par des espaces ordinaires. */
const plat = (s: string): string =>
  s.replaceAll(String.fromCharCode(160), ' ').replaceAll(String.fromCharCode(8239), ' ');

const NIVEAUX: readonly LevelId[] = ['level1', 'level2'];

describe('table des échelles', () => {
  it('valeurs par niveau : axe 0 à 10 s, e, commande, v et a fixes', () => {
    for (const n of NIVEAUX) {
      const e = ECHELLES[n];
      expect(e.temps).toEqual({ max: 10, pas: 1, chiffreTousLes: 2 });
      expect(e.erreur).toMatchObject({ min: -0.5, max: 3, pas: 0.5 });
      expect(e.vitesse).toMatchObject({ min: -4, max: 12, pas: 2 });
    }
    expect(ECHELLES.level1.commande).toMatchObject({ min: -5000, max: 25000, pas: 5000 });
    expect(ECHELLES.level2.commande).toMatchObject({ min: -2500, max: 10000, pas: 2500 });
    expect(ECHELLES.level1.acceleration).toMatchObject({ min: -100, max: 100, pas: 25 });
    expect(ECHELLES.level2.acceleration).toMatchObject({ min: -50, max: 100, pas: 25 });
    expect(ECHELLES.level1.termesPI).toBe(false);
    expect(ECHELLES.level2.termesPI).toBe(true);
  });

  it('chaque échelle est cohérente : bornes ordonnées, pas entiers, chiffres sur les traits', () => {
    for (const n of NIVEAUX) {
      for (const cle of ['erreur', 'commande', 'vitesse', 'acceleration'] as const) {
        const e = ECHELLES[n][cle];
        expect(e.max).toBeGreaterThan(e.min);
        const pas = (e.max - e.min) / e.pas;
        expect(Math.abs(pas - Math.round(pas))).toBeLessThan(1e-9);
        const rang = e.chiffreTousLes / e.pas;
        expect(Math.abs(rang - Math.round(rang))).toBeLessThan(1e-9);
        expect(e.min < 0 && e.max > 0).toBe(true);
        expect(graduationsEchelle(e).some((g) => g.valeur === 0 && g.chiffre)).toBe(true);
      }
    }
  });

  it('±Umax = 5 000 N est dans l’échelle de la commande au niveau 1 (bord bas) et au niveau 2 (haut)', () => {
    expect(ELEVATOR_MAX_FORCE).toBe(5000);
    expect(ECHELLES.level1.commande.min).toBeLessThanOrEqual(-ELEVATOR_MAX_FORCE);
    expect(ECHELLES.level1.commande.max).toBeGreaterThan(ELEVATOR_MAX_FORCE);
    expect(ECHELLES.level2.commande.max).toBeGreaterThan(ELEVATOR_MAX_FORCE);
  });

  it('l’axe du temps est celui du journal : capacité × dt = 10 s, partout', () => {
    for (const n of NIVEAUX) {
      const level = n === 'level1' ? createLevel1() : createLevel2();
      expect(level.tripLog.capacity).toBe(PAS_MAX);
      expect(level.tripLog.capacity * level.tripLog.dt).toBeCloseTo(DUREE_MAX_S, 12);
      expect(ECHELLES[n].temps.max).toBe(DUREE_MAX_S);
    }
  });

  it('graduations : chiffres au pas voulu, jamais de chiffre collé au suivant', () => {
    const lib = (n: LevelId, cle: 'erreur' | 'commande' | 'vitesse' | 'acceleration'): number[] =>
      graduationsEchelle(ECHELLES[n][cle])
        .filter((g) => g.chiffre)
        .map((g) => g.valeur);
    expect(lib('level1', 'erreur')).toEqual([0, 1, 2, 3]);
    expect(lib('level1', 'commande')).toEqual([0, 10000, 20000]);
    expect(lib('level2', 'commande')).toEqual([0, 5000, 10000]);
    expect(lib('level1', 'vitesse')).toEqual([-4, 0, 4, 8, 12]);
    expect(lib('level1', 'acceleration')).toEqual([-100, 0, 100]);
    expect(lib('level2', 'acceleration')).toEqual([-50, 0, 50, 100]);
    // Les chiffres sont à au moins 16 unités l'un de l'autre (corps 16) sur la hauteur du papier.
    for (const n of NIVEAUX) {
      const g = dispositionCourbes(COLONNES.courbes, n);
      for (const b of g.bandes) {
        const e = ECHELLES[n][b.id];
        const nb = graduationsEchelle(e).filter((x) => x.chiffre).length;
        expect((b.bas - b.haut) / (nb - 1)).toBeGreaterThanOrEqual(17);
      }
    }
  });
});

describe('conversion valeur → position et écrêtage', () => {
  const sortie: PositionEchelle = { fraction: 0, ecrete: 0 };
  const e = ECHELLES.level1.commande;

  it('dedans : fraction linéaire, pas de dépassement', () => {
    expect(positionSurEchelle(e, e.min, sortie)).toEqual({ fraction: 0, ecrete: 0 });
    expect(positionSurEchelle(e, e.max, sortie)).toEqual({ fraction: 1, ecrete: 0 });
    expect(positionSurEchelle(e, 10000, sortie).fraction).toBeCloseTo(0.5, 12);
    expect(positionSurEchelle(e, 5000, sortie).fraction).toBeCloseTo(1 / 3, 12);
  });

  it('hors échelle : écrêté au bord avec le sens du dépassement, jamais ignoré', () => {
    expect(positionSurEchelle(e, 120000, sortie)).toEqual({ fraction: 1, ecrete: 1 });
    expect(positionSurEchelle(e, -1e9, sortie)).toEqual({ fraction: 0, ecrete: -1 });
    expect(fractionSurEchelle(e, 25001)).toBe(1);
    expect(fractionSurEchelle(e, -5001)).toBe(0);
    expect(fractionSurEchelle(e, Number.NaN)).toBe(0);
    expect(positionSurEchelle(e, Number.NaN, sortie)).toEqual({ fraction: 0, ecrete: 0 });
  });

  it('le tracé écrête au bord de la bande et mémorise un chevron par dépassement', () => {
    const { ctx, segments } = faux();
    const colonne = [0, 30000, 40000, 0, -9000, -9000, 100, 30000];
    const chev = creerTamponChevrons();
    const bande = { haut: 100, bas: 200 };
    tracerColonne(ctx, colonne, colonne.length, e, bande, 0, 1, chev);
    expect(segments.moveTo).toBe(1);
    expect(segments.lineTo).toBe(colonne.length - 1);
    expect(chev.n).toBe(3);
    expect([chev.sens[0], chev.sens[1], chev.sens[2]]).toEqual([1, -1, 1]);
    // Début de chaque dépassement : abscisses des points 1, 4 et 7.
    expect([chev.x[0], chev.x[1], chev.x[2]]).toEqual([1, 4, 7]);
  });

  it('le tracé reste borné : au plus 8 chevrons mémorisés, tous les points tracés', () => {
    const { ctx, segments } = faux();
    const colonne = Array.from({ length: 40 }, (_, k) => (k % 2 === 0 ? 0 : 1e6));
    const chev = creerTamponChevrons();
    tracerColonne(ctx, colonne, colonne.length, e, { haut: 0, bas: 50 }, 0, 1, chev);
    expect(chev.n).toBe(8);
    expect(segments.lineTo).toBe(39);
  });

  it('abscisse d’un pas et pas sous une abscisse : inverses, bornés aux bords du papier', () => {
    const g = dispositionCourbes(COLONNES.courbes, 'level1');
    expect(xDePas(g, 0, PAS_MAX)).toBe(g.x0);
    expect(xDePas(g, PAS_MAX, PAS_MAX)).toBe(g.x1);
    for (const j of [0, 1, 17, 599, 600, 1199, 1200]) {
      expect(pasDeX(g, xDePas(g, j, PAS_MAX), PAS_MAX)).toBe(j);
    }
    expect(pasDeX(g, g.x0 - 50, PAS_MAX)).toBe(0);
    expect(pasDeX(g, g.x1 + 50, PAS_MAX)).toBe(PAS_MAX);
    expect(pasDeX(g, Number.NaN, PAS_MAX)).toBe(0);
  });
});

describe('format des nombres', () => {
  it('virgule en français, point en anglais, séparateur de milliers, moins typographique', () => {
    const fr = createTranslator('fr');
    const en = createTranslator('en');
    expect(texteValeur(fr, 0.524, 2)).toBe('0,52');
    expect(texteValeur(en, 0.524, 2)).toBe('0.52');
    expect(plat(texteValeur(fr, 25000, 0))).toBe('25 000');
    expect(texteValeur(en, 25000, 0)).toBe('25,000');
    expect(texteValeur(fr, -4.04, 1)).toBe('−4,0');
    expect(texteValeur(fr, 8.3, 1)).toBe('8,3');
    expect(texteValeur(fr, 2, 2)).toBe('2,00');
  });

  it('jamais « −0 » : une valeur qui s’arrondit à zéro s’écrit 0', () => {
    const fr = createTranslator('fr');
    expect(texteValeur(fr, -0.001, 2)).toBe('0,00');
    expect(texteValeur(fr, -0.2, 0)).toBe('0');
    expect(texteValeur(fr, -0, 1)).toBe('0,0');
  });
});

describe('disposition', () => {
  it('quatre enregistreurs alignés, dans l’ordre, sans recouvrement, dans la colonne', () => {
    const c = COLONNES.courbes;
    for (const n of NIVEAUX) {
      const g = dispositionCourbes(c, n);
      expect(g.bandes.map((b) => b.id)).toEqual(['erreur', 'commande', 'vitesse', 'acceleration']);
      let precedent = c.y;
      for (const b of g.bandes) {
        expect(b.titreY).toBeGreaterThan(precedent);
        expect(b.haut).toBeGreaterThan(b.titreY);
        expect(b.bas).toBeGreaterThan(b.haut + 60);
        for (const l of b.legendesY) {
          expect(l).toBeGreaterThan(b.titreY);
          expect(l).toBeLessThan(b.haut);
        }
        precedent = b.bas;
      }
      expect(g.x0).toBeGreaterThanOrEqual(c.x + 54);
      expect(g.x1).toBeLessThanOrEqual(c.x + c.w - 10);
      expect(g.axeTitreY).toBeLessThanOrEqual(c.y + c.h - 8);
      expect(g.zone.y + g.zone.h).toBeLessThanOrEqual(c.y + c.h);
    }
    expect(dispositionCourbes(c, 'level1').bandes[1].legendesY).toHaveLength(1);
    expect(dispositionCourbes(c, 'level2').bandes[1].legendesY).toHaveLength(2);
  });
});

describe('curseur du trajet', () => {
  it('bornes : j ∈ [0 ; count], entier ; NaN va à la fin', () => {
    expect(borneIndice(-5, 100)).toBe(0);
    expect(borneIndice(0, 100)).toBe(0);
    expect(borneIndice(37.4, 100)).toBe(37);
    expect(borneIndice(37.6, 100)).toBe(38);
    expect(borneIndice(100, 100)).toBe(100);
    expect(borneIndice(101, 100)).toBe(100);
    expect(borneIndice(Number.NaN, 100)).toBe(100);
    expect(borneIndice(5, 0)).toBe(0);
  });

  it('clavier : flèches ±1, Page ±10, Début, Fin, et rien pour les autres touches', () => {
    expect(indiceApresTouche('ArrowRight', 10, 100)).toBe(11);
    expect(indiceApresTouche('ArrowUp', 10, 100)).toBe(11);
    expect(indiceApresTouche('ArrowLeft', 10, 100)).toBe(9);
    expect(indiceApresTouche('ArrowDown', 10, 100)).toBe(9);
    expect(indiceApresTouche('PageUp', 10, 100)).toBe(20);
    expect(indiceApresTouche('PageDown', 10, 100)).toBe(0);
    expect(indiceApresTouche('PageDown', 15, 100)).toBe(5);
    expect(indiceApresTouche('Home', 55, 100)).toBe(0);
    expect(indiceApresTouche('End', 55, 100)).toBe(100);
    expect(indiceApresTouche('ArrowLeft', 0, 100)).toBe(0);
    expect(indiceApresTouche('ArrowRight', 100, 100)).toBe(100);
    expect(indiceApresTouche('PageUp', 95, 100)).toBe(100);
    expect(indiceApresTouche('KeyE', 10, 100)).toBeNull();
    expect(indiceApresTouche('Escape', 10, 100)).toBeNull();
    expect(indiceApresTouche('Tab', 10, 100)).toBeNull();
  });

  it('inactif sans issue, à la fin par défaut à l’issue, borné, indépendant du direct', () => {
    const level = createLevel1({ animations: false });
    const curseur = creerCurseur();
    const etat = etatDe(level, 'fr');
    curseur.synchroniser(etat);
    expect(curseur.actif).toBe(false);
    reachConsole(level);
    level.setTuning(2500);
    level.launch();
    for (let i = 0; i < 40; i += 1) level.update(1 / 60);
    curseur.synchroniser(etat);
    expect(level.snapshot.phase).toBe('trip');
    expect(curseur.actif).toBe(false);
    curseur.deplacer(5);
    expect(curseur.actif).toBe(false);
    finishTrip(level);
    curseur.synchroniser(etat);
    const count = level.tripLog.count;
    expect(count).toBeGreaterThan(50);
    expect(curseur.actif).toBe(true);
    expect(curseur.count).toBe(count);
    expect(curseur.indice).toBe(count);
    curseur.deplacer(-3);
    expect(curseur.indice).toBe(0);
    curseur.deplacer(count + 99);
    expect(curseur.indice).toBe(count);
    curseur.deplacer(Math.floor(count / 2));
    curseur.synchroniser(etat);
    expect(curseur.indice).toBe(Math.floor(count / 2));
  });

  it('un nouveau trajet fait disparaître le curseur ; le suivant repart de la fin', () => {
    const level = trajet('level1', 2500);
    const curseur = creerCurseur();
    const etat = etatDe(level, 'fr');
    curseur.synchroniser(etat);
    curseur.deplacer(10);
    expect(curseur.indice).toBe(10);
    level.restart();
    curseur.synchroniser(etat);
    expect(curseur.actif).toBe(false);
    // Après « Recommencer » le jeu est au réglage : on règle et on relance.
    expect(level.snapshot.phase).toBe('tuning');
    level.setTuning(800);
    finishTrip(level);
    curseur.synchroniser(etat);
    expect(curseur.actif).toBe(true);
    expect(curseur.indice).toBe(level.tripLog.count);
  });

  it('un nouvel essai terminé pendant que le pupitre était fermé ramène le curseur à la fin', () => {
    const level = trajet('level1', 2500);
    const curseur = creerCurseur();
    const etat = etatDe(level, 'fr');
    curseur.synchroniser(etat);
    curseur.deplacer(10);
    // Pas de synchronisation entre-temps (pupitre fermé) : seul le numéro d'essai change.
    level.restart();
    level.setTuning(2500);
    finishTrip(level);
    curseur.synchroniser(etat);
    expect(level.tripLog.count).toBeGreaterThan(50);
    expect(curseur.indice).toBe(level.tripLog.count);
  });
});

describe('valeurs lues et état de la machine au curseur', () => {
  it('j < count : tout vient de l’enregistrement j, bit à bit', () => {
    const level = trajet('level2', 2000);
    const log = level.tripLog;
    const v = valeursVides();
    for (const j of [0, 1, 50, log.count - 1]) {
      valeursAuPas(log, level.snapshot, j, v);
      expect(v.vide).toBe(false);
      expect(v.indice).toBe(j);
      expect(v.t).toBe(j * log.dt);
      expect(v.e).toBe(log.e[j]);
      expect(v.v).toBe(log.v[j]);
      expect(v.a).toBe(log.a[j]);
      expect(v.uSat).toBe(log.uSat[j]);
      expect(v.uCmd).toBe(log.uCmd[j]);
      expect(v.p).toBe(log.p[j]);
      expect(v.i).toBe(log.i[j]);
      expect(v.sature).toBe(log.saturated[j] === 1);
    }
  });

  it('j = count : erreur et vitesse de l’instantané, forces du dernier enregistrement', () => {
    const level = trajet('level1', 5100);
    const log = level.tripLog;
    const s = level.snapshot;
    const v = valeursVides();
    valeursAuPas(log, s, log.count, v);
    expect(v.indice).toBe(log.count);
    expect(v.e).toBe(s.e);
    expect(v.v).toBe(s.cabinVelocity);
    expect(v.uSat).toBe(log.uSat[log.count - 1]);
    expect(v.a).toBe(log.a[log.count - 1]);
    // Hors bornes : ramené à la fin.
    valeursAuPas(log, s, log.count + 500, v);
    expect(v.indice).toBe(log.count);
  });

  it('journal vide : valeurs absentes', () => {
    const level = createLevel1();
    const v = valeursVides();
    v.vide = false;
    valeursAuPas(level.tripLog, level.snapshot, 0, v);
    expect(v.vide).toBe(true);
  });

  it('machine à l’indice j : cabine du journal, et celle de l’instantané à la fin (choc)', () => {
    const level = trajet('level1', 5100);
    expect(level.snapshot.outcome).toBe('bonk');
    const log = level.tripLog;
    const s = level.snapshot;
    const etat = etatDe(level, 'fr');
    const m = etatMachineVide();
    etatMachineAuPas(etat, 30, m);
    expect(m.y).toBe(log.y[30]);
    expect(m.v).toBe(log.v[30]);
    expect(m.uCmd).toBe(log.uCmd[30]);
    expect(m.uSat).toBe(log.uSat[30]);
    expect(m.sature).toBe(log.saturated[30] === 1);
    expect(m.fin).toBe(true);
    expect(m.marche).toBe(false);
    etatMachineAuPas(etat, log.count, m);
    // À la fin : la cabine figée de l'instantané, pas y[count − 1] (sous la poutre au choc).
    expect(m.y).toBe(s.cabinY);
    expect(m.v).toBe(s.cabinVelocity);
    expect(m.y).not.toBe(log.y[log.count - 1]);
    expect(m.uSat).toBe(log.uSat[log.count - 1]);
    expect(m.uCmd).toBe(log.uCmd[log.count - 1]);
    expect(m.fin).toBe(true);
  });

  it('la machine suit le curseur : cabine différente au milieu, direct tant qu’il n’y a pas d’issue', () => {
    const curseur = creerCurseur();
    const choisir = choisirEtatMachine(curseur);
    const level = createLevel1({ animations: false });
    reachConsole(level);
    level.setTuning(2500);
    level.launch();
    for (let i = 0; i < 100; i += 1) level.update(1 / 60);
    const m = etatMachineVide();
    // Trajet en cours : état du jeu en direct, voyant Marche.
    choisir(etatDe(level, 'fr'), m);
    expect(m.y).toBe(level.snapshot.cabinY);
    expect(m.marche).toBe(true);
    expect(m.fin).toBe(false);
    finishTrip(level);
    const etat = etatDe(level, 'fr');
    choisir(etat, m);
    const yFin = m.y;
    expect(yFin).toBe(level.snapshot.cabinY);
    expect(m.fin).toBe(true);
    expect(m.marche).toBe(false);
    curseur.deplacer(Math.floor(level.tripLog.count / 3));
    choisir(etat, m);
    expect(m.y).toBe(level.tripLog.y[Math.floor(level.tripLog.count / 3)]);
    expect(m.y).not.toBe(yFin);
    curseur.deplacer(0);
    choisir(etat, m);
    expect(m.y).toBe(level.tripLog.y[0]);
    expect(m.y).toBeLessThan(yFin);
    expect(m.fin).toBe(true);
  });

  it('changer le curseur ne modifie ni l’issue, ni l’instantané, ni le journal', () => {
    const level = trajet('level2', 800);
    const avant = JSON.stringify(level.snapshot);
    const log = level.tripLog;
    const copie = (c: ArrayLike<number>): number[] =>
      Array.from({ length: log.count }, (_, k) => c[k] as number);
    const colonnesAvant = [log.y, log.v, log.a, log.e, log.uCmd, log.uSat].map(copie);
    const curseur = creerCurseur();
    const machine = creerColonneMachine({ choisirEtat: choisirEtatMachine(curseur) });
    const courbes = creerColonneCourbes({ curseur });
    const etat = etatDe(level, 'fr');
    const { ctx } = faux();
    for (const j of [0, 10, 200, log.count, 7]) {
      machine.dessiner(ctx, COLONNES.machine, etat);
      curseur.deplacer(j);
      machine.dessiner(ctx, COLONNES.machine, etat);
      courbes.dessiner(ctx, COLONNES.courbes, etat);
      expect(curseur.indice).toBe(j);
    }
    expect(JSON.stringify(level.snapshot)).toBe(avant);
    expect([log.y, log.v, log.a, log.e, log.uCmd, log.uSat].map(copie)).toEqual(colonnesAvant);
    expect(level.snapshot.outcome).toBe('win');
  });
});

describe('dessin et résumé', () => {
  it('avant le trajet : papier propre, aucune courbe, message de la plume, valeurs absentes', () => {
    for (const n of NIVEAUX) {
      const level = n === 'level1' ? createLevel1() : createLevel2();
      const { ctx, textes, segments } = faux();
      const [, courbes] = creerColonnesTrajet();
      courbes?.dessiner(ctx, COLONNES.courbes, etatDe(level, 'fr'));
      expect(segments.lineTo).toBe(0);
      expect(textes.some((t) => t.s.includes('plume'))).toBe(true);
      expect(textes.some((t) => t.s === '—')).toBe(true);
    }
  });

  it('en trajet : un point par pas et par signal (5 signaux au niveau 1, 7 au niveau 2 avec P et I), valeurs en 16 px au moins', () => {
    for (const [n, reglage, nbSignaux] of [
      ['level1', 2500, 5],
      ['level2', 800, 7],
    ] as const) {
      const level = trajet(n, reglage);
      const count = level.tripLog.count;
      const { ctx, textes, segments } = faux();
      const courbes = creerColonneCourbes({ curseur: creerCurseur() });
      courbes.dessiner(ctx, COLONNES.courbes, etatDe(level, 'fr'));
      // Chaque signal : un moveTo puis count − 1 lineTo ; plus les segments de la poignée du curseur.
      expect(segments.lineTo).toBeGreaterThanOrEqual(nbSignaux * (count - 1));
      expect(segments.lineTo).toBeLessThanOrEqual(nbSignaux * (count - 1) + 12);
      for (const t of textes) {
        expect(t.taille).toBeGreaterThanOrEqual(16);
      }
      expect(textes.some((t) => /^t = \d+,\d\d s$/.test(plat(t.s)))).toBe(true);
    }
  });

  it('les valeurs lues suivent le curseur (virgule en français, point en anglais)', () => {
    const level = trajet('level1', 2500);
    const curseur = creerCurseur();
    const courbes = creerColonneCourbes({ curseur });
    const etatFr = etatDe(level, 'fr');
    const a = faux();
    courbes.dessiner(a.ctx, COLONNES.courbes, etatFr);
    curseur.deplacer(10);
    const b = faux();
    courbes.dessiner(b.ctx, COLONNES.courbes, etatFr);
    const v10 = level.tripLog.v[10] as number;
    const attendu = `${texteValeur(etatFr.traducteur, v10, 1)} m/s`;
    expect(b.textes.some((t) => plat(t.s) === attendu)).toBe(true);
    expect(a.textes.some((t) => plat(t.s) === attendu)).toBe(false);
    expect(b.textes.some((t) => plat(t.s).startsWith('t = 0,08'))).toBe(true);
    const en = createLevel1({ animations: false });
    reachConsole(en);
    en.setTuning(2500);
    finishTrip(en);
    const curseurEn = creerCurseur();
    const colEn = creerColonneCourbes({ curseur: curseurEn });
    const c = faux();
    curseurEn.synchroniser(etatDe(en, 'en'));
    curseurEn.deplacer(10);
    colEn.dessiner(c.ctx, COLONNES.courbes, etatDe(en, 'en'));
    expect(c.textes.some((t) => plat(t.s).startsWith('t = 0.08'))).toBe(true);
  });

  it('résumé lecteur d’écran : vide, en direct, puis au curseur ; FR et EN', () => {
    const level = createLevel2({ animations: false });
    const curseur = creerCurseur();
    const courbes = creerColonneCourbes({ curseur });
    const resume = (locale: Locale): string => courbes.resume?.(etatDe(level, locale)) ?? '';
    expect(resume('fr')).toContain('vides');
    expect(resume('en')).toContain('empty');
    reachConsole(level);
    level.setTuning(800);
    finishTrip(level);
    const fr = plat(resume('fr'));
    const en = plat(resume('en'));
    expect(fr).toContain('Courbes du trajet');
    expect(fr).toContain('Terme proportionnel');
    expect(fr).toContain('curseur');
    expect(en).toContain('Trip curves');
    expect(en).toContain('Proportional term');
    curseur.deplacer(0);
    expect(plat(resume('fr'))).toContain('Instant 0,00 s');
    expect(plat(resume('en'))).toContain('At 0.00 s');
    // Niveau 1 : pas de termes P et I.
    const l1 = trajet('level1', 2500);
    const r1 = creerColonneCourbes({ curseur: creerCurseur() }).resume?.(etatDe(l1, 'fr')) ?? '';
    expect(r1).not.toContain('proportionnel');
  });

  it('le fond se dessine aux deux niveaux et aux deux langues, tous les textes en 16 unités au moins (hors titre)', () => {
    for (const n of NIVEAUX) {
      for (const locale of ['fr', 'en'] as const) {
        const level = n === 'level1' ? createLevel1() : createLevel2();
        const { ctx, textes } = faux();
        const col = creerColonneCourbes({ curseur: creerCurseur() });
        col.dessinerFond(ctx, COLONNES.courbes, etatDe(level, locale));
        expect(textes.length).toBeGreaterThan(20);
        for (const t of textes) {
          expect(t.taille).toBeGreaterThanOrEqual(16);
        }
        expect(textes.some((t) => t.s === '±Umax')).toBe(true);
        expect(textes.some((t) => t.s === 'P')).toBe(n === 'level2');
      }
    }
  });
});
