/**
 * Colonne de la machine du pupitre (T-050) : logique pure (angle du rotor, état de la machine,
 * voyants, échelles fixes de la règle et de la jauge, formats, résumé pour les lecteurs d'écran) et
 * dessin sans erreur sur des états faits à la main, aux deux langues.
 */
import { describe, expect, it } from 'vitest';
import {
  BEAM_HEIGHT,
  ELEVATOR_MAX_FORCE,
  createLevel1,
  createLevel2,
  type Level,
} from '../../../src/game';
import { createTranslator, type Locale } from '../../../src/i18n';
import {
  COLONNES,
  JAUGE_MAX,
  JAUGE_MIN,
  RAD_PAR_M,
  REGLE_MAX,
  angleRotor,
  animationMachine,
  creerColonneMachine,
  depassement,
  disposition,
  effort,
  etatMachineDirect,
  etatMachineVide,
  fractionJauge,
  geometrieJauge,
  hauteurAffichee,
  reglageDe,
  resumeMachine,
  texteForce,
  texteHauteur,
  yJauge,
  yRegle,
  type EtatMachine,
  type EtatPupitre,
} from '../../../src/ui/pupitre';
import {
  creerMemoireTextes,
  dessinerVifMachine,
  majTextes,
} from '../../../src/ui/pupitre/machine-vif';
import { dessinerFondMachine } from '../../../src/ui/pupitre/machine-fond';

interface Texte {
  s: string;
  taille: number;
}

/** Contexte 2D factice : enregistre les textes et leur taille, accepte tout le reste. */
function faux(): { ctx: CanvasRenderingContext2D; textes: Texte[]; appels: { n: number } } {
  const textes: Texte[] = [];
  const appels = { n: 0 };
  const etat: Record<string, unknown> = { font: '10px x' };
  const ctx = new Proxy(etat, {
    get(cible, nom: string) {
      if (nom === 'fillText') {
        return (s: string): void => {
          textes.push({ s, taille: Number.parseFloat(String(cible['font'])) });
        };
      }
      if (nom === 'measureText') {
        return (s: string): { width: number } => ({ width: s.length * 8 });
      }
      if (nom in cible) return cible[nom];
      return () => {
        appels.n += 1;
      };
    },
    set(cible, nom: string, valeur) {
      cible[nom] = valeur;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, textes, appels };
}

function etatDe(level: Level, locale: Locale, mouvementReduit = false): EtatPupitre {
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
    mouvementReduit,
    versionFond: 1,
    maintenant: 1234,
    annoncer: () => undefined,
  };
}

/** Avance le niveau jusqu'à l'issue (borne de sécurité). */
function jusqueALIssue(level: Level): void {
  for (let i = 0; i < 6000 && level.snapshot.phase !== 'outcome'; i += 1) {
    level.update(1 / 30);
  }
}

/** Remplace les espaces insécables (NBSP, fine) par des espaces ordinaires. */
const plat = (s: string): string =>
  s.replaceAll(String.fromCharCode(160), ' ').replaceAll(String.fromCharCode(8239), ' ');

describe('angle du rotor', () => {
  it('nul au sol, proportionnel à la hauteur (câble sur le tambour), borné', () => {
    expect(angleRotor(0)).toBe(0);
    expect(angleRotor(1)).toBe(RAD_PAR_M);
    expect(angleRotor(2.5)).toBeCloseTo(2.5 * RAD_PAR_M, 12);
    expect(angleRotor(-1)).toBe(0);
    expect(angleRotor(Number.NaN)).toBe(0);
    expect(angleRotor(10)).toBe(hauteurAffichee(10) * RAD_PAR_M);
  });

  it('croît avec la hauteur : il n’avance que si la cabine monte', () => {
    let avant = angleRotor(0);
    for (let y = 0.1; y <= 3.5; y += 0.1) {
      const a = angleRotor(y);
      expect(a).toBeGreaterThan(avant);
      avant = a;
    }
  });

  it('ne dépend ni de l’horloge murale ni du mouvement réduit', () => {
    const s = createLevel1({ animations: false });
    s.interact();
    s.launch();
    for (let i = 0; i < 40; i += 1) s.update(1 / 60);
    const a = etatMachineVide();
    const b = etatMachineVide();
    etatMachineDirect(etatDe(s, 'fr', false), a);
    etatMachineDirect(etatDe(s, 'fr', true), b);
    expect(angleRotor(a.y)).toBe(angleRotor(b.y));
  });
});

describe('échelles fixes', () => {
  it('la règle couvre 0 à 3,5 m : la poutre et la cabine finale d’un choc ne sont jamais coupées', () => {
    expect(REGLE_MAX).toBeGreaterThanOrEqual(3.5);
    expect(BEAM_HEIGHT).toBeLessThan(REGLE_MAX);
    expect(hauteurAffichee(3.44)).toBe(3.44);
    expect(hauteurAffichee(BEAM_HEIGHT)).toBe(BEAM_HEIGHT);
    expect(yRegle(0)).toBeGreaterThan(yRegle(3.44));
    expect(yRegle(3.44)).toBeGreaterThan(yRegle(hauteurAffichee(100)) - 1e-9);
  });

  it('la jauge couvre ±Umax avec marge, et la demande de 25 000 N sort de l’échelle', () => {
    expect(JAUGE_MIN).toBeLessThan(-ELEVATOR_MAX_FORCE);
    expect(JAUGE_MAX).toBeGreaterThan(ELEVATOR_MAX_FORCE);
    expect(ELEVATOR_MAX_FORCE).toBe(5000);
    expect(depassement(25000)).toBe('haut');
    expect(depassement(-25000)).toBe('bas');
    expect(depassement(5000)).toBe('aucun');
    expect(depassement(JAUGE_MAX)).toBe('aucun');
    expect(depassement(JAUGE_MIN)).toBe('aucun');
  });

  it('position sur la jauge : bornée, monotone, haut et bas aux bornes', () => {
    const g = geometrieJauge(disposition(COLONNES.machine).jauge);
    expect(fractionJauge(JAUGE_MIN)).toBe(0);
    expect(fractionJauge(JAUGE_MAX)).toBe(1);
    expect(fractionJauge(1e9)).toBe(1);
    expect(fractionJauge(-1e9)).toBe(0);
    expect(fractionJauge(Number.NaN)).toBe(0);
    expect(yJauge(g, JAUGE_MIN)).toBe(g.bas);
    expect(yJauge(g, JAUGE_MAX)).toBe(g.haut);
    expect(yJauge(g, 25000)).toBe(g.haut);
    expect(yJauge(g, 0)).toBeLessThan(yJauge(g, -1000));
    expect(yJauge(g, 5000)).toBeLessThan(yJauge(g, 0));
    // 16 unités par kN : au moins 12 pour qu’un écart de 1 kN se voie.
    expect((g.bas - g.haut) / ((JAUGE_MAX - JAUGE_MIN) / 1000)).toBeGreaterThanOrEqual(12);
  });

  it('effort relatif : |u| / Umax borné à [0 ; 1]', () => {
    expect(effort(0, 5000)).toBe(0);
    expect(effort(-2500, 5000)).toBe(0.5);
    expect(effort(25000, 5000)).toBe(1);
    expect(effort(Number.NaN, 5000)).toBe(0);
  });
});

describe('disposition de la colonne', () => {
  it('voyants, moteur et jauge tiennent dans la colonne sans se recouvrir', () => {
    const c = COLONNES.machine;
    const d = disposition(c);
    for (const p of [d.voyants, d.moteur, d.jauge]) {
      expect(p.x).toBeGreaterThanOrEqual(c.x);
      expect(p.y).toBeGreaterThanOrEqual(c.y);
      expect(p.x + p.w).toBeLessThanOrEqual(c.x + c.w);
      expect(p.y + p.h).toBeLessThanOrEqual(c.y + c.h);
    }
    expect(d.voyants.y + d.voyants.h).toBeLessThan(d.moteur.y);
    expect(d.moteur.x + d.moteur.w).toBeLessThan(d.jauge.x);
    const g = geometrieJauge(d.jauge);
    expect(g.haut).toBeGreaterThan(d.jauge.y);
    expect(g.bas).toBeLessThan(d.jauge.y + d.jauge.h);
  });
});

describe('état de la machine du jeu en direct', () => {
  it('avant le lancement : au repos, cabine au sol, forces nulles, aucun voyant', () => {
    const level = createLevel1({ animations: false });
    level.interact();
    const m = etatMachineDirect(etatDe(level, 'fr'), etatMachineVide());
    expect(m).toEqual(etatMachineVide());
  });

  it('en trajet : valeurs du snapshot telles quelles, voyant Marche', () => {
    const level = createLevel1({ animations: false });
    level.interact();
    level.setTuning(5000);
    level.launch();
    for (let i = 0; i < 3; i += 1) level.update(1 / 30);
    const s = level.snapshot;
    expect(s.phase).toBe('trip');
    const m = etatMachineDirect(etatDe(level, 'fr'), etatMachineVide());
    expect(m.y).toBe(s.cabinY);
    expect(m.v).toBe(s.cabinVelocity);
    expect(m.uCmd).toBe(s.uCmd);
    expect(m.uSat).toBe(s.uSat);
    expect(m.sature).toBe(s.saturated);
    expect(m.marche).toBe(true);
    expect(m.pause).toBe(false);
    expect(m.fin).toBe(false);
    // Kp 5000 : la demande dépasse 5 000 N au début, le moteur sature.
    expect(m.sature).toBe(true);
    expect(m.uCmd).toBeGreaterThan(m.uSat);
    expect(m.uSat).toBeCloseTo(ELEVATOR_MAX_FORCE, 9);
  });

  it('en pause : voyant Pause, Marche éteint, forces gardées', () => {
    const level = createLevel1({ animations: false });
    level.interact();
    level.launch();
    for (let i = 0; i < 10; i += 1) level.update(1 / 30);
    level.pause();
    expect(level.snapshot.phase).toBe('paused');
    const m = etatMachineDirect(etatDe(level, 'fr'), etatMachineVide());
    expect(m.pause).toBe(true);
    expect(m.marche).toBe(false);
    expect(m.uSat).toBe(level.snapshot.uSat);
  });

  it('à l’issue : voyant Fin, cabine figée sur cabinY (victoire et choc)', () => {
    const win = createLevel1({ animations: false });
    win.interact();
    win.setTuning(2500);
    win.launch();
    jusqueALIssue(win);
    expect(win.snapshot.outcome).toBe('win');
    const mw = etatMachineDirect(etatDe(win, 'fr'), etatMachineVide());
    expect(mw.fin).toBe(true);
    expect(mw.marche).toBe(false);
    expect(mw.y).toBe(win.snapshot.cabinY);

    const bonk = createLevel2({ animations: false });
    bonk.interact();
    bonk.setTuning(2000);
    bonk.launch();
    jusqueALIssue(bonk);
    expect(bonk.snapshot.outcome).toBe('bonk');
    const mb = etatMachineDirect(etatDe(bonk, 'fr'), etatMachineVide());
    expect(mb.fin).toBe(true);
    expect(mb.y).toBe(bonk.snapshot.cabinY);
    // La cabine figée au choc reste entièrement dessinable (jamais coupée).
    expect(mb.y).toBeGreaterThan(BEAM_HEIGHT);
    expect(hauteurAffichee(mb.y)).toBe(mb.y);
  });

  it('réécrit l’objet donné, sans en créer un autre', () => {
    const level = createLevel1({ animations: false });
    const sortie = etatMachineVide();
    expect(etatMachineDirect(etatDe(level, 'fr'), sortie)).toBe(sortie);
  });
});

describe('animation décorative', () => {
  it('mouvement réduit ou pause : pulsation figée, aucune secousse', () => {
    const a = { pulse: 0, secousse: 0 };
    animationMachine(500, true, false, a);
    expect(a).toEqual({ pulse: 1, secousse: 0 });
    animationMachine(123, false, true, a);
    expect(a).toEqual({ pulse: 1, secousse: 0 });
  });

  it('sinon : pulsation dans [0 ; 1], secousse bornée', () => {
    const a = { pulse: 0, secousse: 0 };
    for (let t = 0; t < 2000; t += 7) {
      animationMachine(t, false, false, a);
      expect(a.pulse).toBeGreaterThanOrEqual(0);
      expect(a.pulse).toBeLessThanOrEqual(1);
      expect(Math.abs(a.secousse)).toBeLessThanOrEqual(1.5);
    }
  });
});

describe('formats', () => {
  it('forces en newtons : séparateur de milliers de la langue, signe moins typographique', () => {
    const fr = createTranslator('fr');
    const en = createTranslator('en');
    expect(texteForce(en, 5000)).toBe('5000');
    expect(texteForce(en, 25000)).toBe('25,000');
    expect(texteForce(fr, 5000)).toBe('5000');
    expect(texteForce(fr, -5000)).toBe('−5000');
    expect(texteForce(fr, 0)).toBe('0');
    expect(texteForce(fr, -0.2)).toBe('0');
    expect(texteForce(fr, 25000).replace(/\s/g, ' ')).toBe('25 000');
  });

  it('hauteur en mètres : deux décimales, virgule en français, point en anglais', () => {
    expect(texteHauteur(createTranslator('fr'), 3.4412)).toBe('3,44');
    expect(texteHauteur(createTranslator('en'), 3.4412)).toBe('3.44');
    expect(texteHauteur(createTranslator('fr'), 0)).toBe('0,00');
  });
});

describe('résumé pour les lecteurs d’écran', () => {
  const m = (sur: Partial<EtatMachine>): EtatMachine => ({ ...etatMachineVide(), ...sur });

  it('dit l’état, la hauteur, les deux forces, et la saturation seulement si elle a lieu', () => {
    const fr = createTranslator('fr');
    const repos = plat(resumeMachine(m({}), fr));
    expect(repos).toContain('À l’arrêt');
    expect(repos).toContain('0,00 m');
    expect(repos).not.toContain('Saturation');
    const sat = plat(
      resumeMachine(m({ y: 1.25, uCmd: 25000, uSat: 5000, sature: true, marche: true }), fr),
    );
    expect(sat).toContain('1,25 m');
    expect(sat).toMatch(/appliquée 5000 N/);
    expect(sat).toMatch(/demandée 25 000 N/);
    expect(sat).toContain('Saturation');
    expect(sat).toContain('Trajet en cours');
    const en = createTranslator('en');
    expect(
      plat(resumeMachine(m({ y: 1.25, uCmd: 25000, uSat: 5000, sature: true, fin: true }), en)),
    ).toContain('requested force 25,000 N');
    expect(resumeMachine(m({ pause: true }), fr)).toContain('Jeu en pause');
    expect(resumeMachine(m({ fin: true }), fr)).toContain('Trajet terminé');
  });
});

describe('textes dynamiques en cache', () => {
  it('ne recalcule que si la valeur arrondie ou la langue change', () => {
    const tr = createTranslator('fr');
    const mem = creerMemoireTextes();
    const m1 = { ...etatMachineVide(), y: 1.234, uSat: 4999.6, uCmd: 12000 };
    const a = majTextes(mem, m1, tr);
    const cabineA = a.cabine;
    expect(plat(cabineA)).toBe('cabine : 1,23 m');
    expect(a.demandee.replace(/\s/g, ' ')).toBe('12 000 N');
    // Même valeur arrondie : mêmes chaînes (pas de nouveau calcul).
    const b = majTextes(mem, { ...m1, y: 1.2341 }, tr);
    expect(b.cabine).toBe(cabineA);
    // Autre valeur : mise à jour.
    expect(plat(majTextes(mem, { ...m1, y: 1.5 }, tr).cabine)).toBe('cabine : 1,50 m');
    // Autre langue : tout est retraduit.
    tr.setLocale('en');
    expect(plat(majTextes(mem, { ...m1, y: 1.5 }, tr).cabine)).toBe('cabin: 1.50 m');
  });
});

describe('dessin de la colonne de la machine', () => {
  /** États faits à la main : repos, trajet, saturation à 25 000 N, saturation négative, fin au choc. */
  const ETATS: readonly (readonly [string, Partial<EtatMachine>])[] = [
    ['repos', {}],
    ['trajet', { y: 1.5, v: 4.2, uCmd: 3000, uSat: 3000, marche: true }],
    [
      'saturation, demande hors échelle',
      { y: 0.2, v: 1, uCmd: 25000, uSat: 5000, sature: true, marche: true },
    ],
    ['saturation négative', { y: 2, v: -3, uCmd: -25000, uSat: -5000, sature: true, marche: true }],
    ['fin au choc', { y: 3.44, v: 0, uCmd: 900, uSat: 900, fin: true }],
    ['pause', { y: 1, v: 2, uCmd: 500, uSat: 500, pause: true }],
    ['hauteur extrême', { y: 99, v: 99, uCmd: 1e9, uSat: 5000, sature: true }],
  ];

  for (const locale of ['fr', 'en'] as const) {
    it(`${locale} : fond et vif sans erreur, tous les textes en 16 unités au moins`, () => {
      const tr = createTranslator(locale);
      const vus: Texte[] = [];
      const fond = faux();
      dessinerFondMachine(fond.ctx, COLONNES.machine, tr);
      vus.push(...fond.textes);
      for (const [nom, sur] of ETATS) {
        const { ctx, textes } = faux();
        const mem = creerMemoireTextes();
        const etat = { ...etatMachineVide(), ...sur };
        dessinerVifMachine(
          ctx,
          COLONNES.machine,
          etat,
          { pulse: 0.5, secousse: 1 },
          majTextes(mem, etat, tr),
        );
        expect(textes.length, nom).toBeGreaterThan(1);
        vus.push(...textes);
      }
      expect(vus.length).toBeGreaterThan(40);
      for (const t of vus) {
        expect(t.taille, t.s).toBeGreaterThanOrEqual(16);
        expect(t.s.trim(), 'texte vide').not.toBe('');
        expect(t.s).not.toMatch(/undefined|NaN|\[object|Infinity/);
      }
    });
  }

  it('la saturation allume le voyant, montre le texte « SATURATION » et la demande hors échelle', () => {
    const tr = createTranslator('fr');
    const { ctx, textes } = faux();
    const etat = { ...etatMachineVide(), uCmd: 25000, uSat: 5000, sature: true, marche: true };
    dessinerVifMachine(
      ctx,
      COLONNES.machine,
      etat,
      { pulse: 1, secousse: 0 },
      majTextes(creerMemoireTextes(), etat, tr),
    );
    const dits = textes.map((t) => t.s.replace(/\s/g, ' '));
    expect(dits).toContain('SATURATION');
    expect(dits.filter((s) => s === '25 000 N').length).toBeGreaterThanOrEqual(2);
    expect(dits).toContain('5000 N');
  });

  it('sans saturation : pas de texte « SATURATION » dans le vif', () => {
    const tr = createTranslator('fr');
    const { ctx, textes } = faux();
    const etat = { ...etatMachineVide(), uCmd: 900, uSat: 900, marche: true };
    dessinerVifMachine(
      ctx,
      COLONNES.machine,
      etat,
      { pulse: 1, secousse: 0 },
      majTextes(creerMemoireTextes(), etat, tr),
    );
    expect(textes.map((t) => t.s)).not.toContain('SATURATION');
  });

  it('la colonne branchée sur le vrai jeu dessine à chaque étape, et fournit son résumé', () => {
    const level = createLevel2({ animations: false });
    level.interact();
    level.setTuning(2000);
    const colonne = creerColonneMachine();
    expect(colonne.id).toBe('machine');
    const resumes: string[] = [];
    for (const etape of ['reglage', 'trajet', 'issue'] as const) {
      if (etape === 'trajet') {
        level.launch();
        for (let i = 0; i < 5; i += 1) level.update(1 / 30);
      } else if (etape === 'issue') {
        jusqueALIssue(level);
      }
      const etat = etatDe(level, 'fr');
      const { ctx, textes } = faux();
      colonne.dessinerFond(ctx, COLONNES.machine, etat);
      colonne.dessiner(ctx, COLONNES.machine, etat);
      expect(textes.length, etape).toBeGreaterThan(10);
      resumes.push(plat(colonne.resume?.(etat) ?? ''));
    }
    expect(resumes[0]).toContain('À l’arrêt');
    expect(resumes[1]).toContain('Trajet en cours');
    expect(resumes[2]).toContain('Trajet terminé');
  });

  it('une colonne avec un autre « choisirEtat » (curseur du trajet) dessine l’état fourni', () => {
    const level = createLevel1({ animations: false });
    const colonne = creerColonneMachine({
      choisirEtat: (_etat, sortie) => {
        sortie.y = 2;
        sortie.uSat = -5000;
        sortie.uCmd = -9000;
        sortie.sature = true;
        return sortie;
      },
    });
    const { ctx, textes } = faux();
    colonne.dessiner(ctx, COLONNES.machine, etatDe(level, 'fr'));
    expect(textes.map((t) => plat(t.s))).toContain('cabine : 2,00 m');
    expect(plat(colonne.resume?.(etatDe(level, 'fr')) ?? '')).toMatch(/force appliquée −5000 N/);
  });
});
