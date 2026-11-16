/**
 * Modèle de vue (CA-2 de T-010) : pour chaque phase et chaque issue, bandeau, textes et valeurs
 * attendus en français et en anglais ; Kp toujours présent ; e mesurée (cote, message) et e
 * théorique (formule) aux bons endroits ; mémoïsation (mêmes chaînes tant que rien ne change).
 */
import { describe, expect, it } from 'vitest';
import { ELEVATOR_MAX_FORCE, createLevel1, type Level1 } from '../../src/game';
import { CATALOGS } from '../../src/i18n';
import { chooseHint, hintLine, hintText, type HintId } from '../../src/ui/hints';
import {
  createViewModelBuilder,
  effectivePhase,
  staticTexts,
  type ViewModel,
} from '../../src/ui/view-model';
import { NB, advance, atConsole, copy, finished, tr, tuning } from './helpers';

const CLOSED = { helpOpen: false };

/** Bandeaux attendus, texte brut (éléments séparés par « · »). */
const HINTS: Readonly<Record<'fr' | 'en', Readonly<Record<HintId, string>>>> = {
  fr: {
    use: `E${NB}: régler l’ascenseur`,
    tune: `+ / −${NB}: régler Kp · Page préc. / Page suiv.${NB}: pas de 1000 · E ou Entrée${NB}: lancer`,
    skip: `E ou Entrée${NB}: passer · R${NB}: recommencer · Échap${NB}: mettre en pause`,
    trip: `Kp est verrouillé · R${NB}: recommencer · Échap${NB}: mettre en pause`,
    outcome: `R${NB}: réessayer`,
    paused: `Jeu en pause. · Échap${NB}: reprendre`,
    help: `Échap${NB}: fermer l’aide`,
    board: `Échap${NB}: fermer le tableau`,
    pupitre: `Échap${NB}: fermer le pupitre`,
  },
  en: {
    use: 'E: set up the lift',
    tune: '+ / −: set Kp · Page Up / Page Down: steps of 1000 · E or Enter: launch',
    skip: 'E or Enter: skip · R: restart · Esc: pause',
    trip: 'Kp is locked · R: restart · Esc: pause',
    outcome: 'R: try again',
    paused: 'Game paused. · Esc: resume',
    help: 'Esc: close the help',
    board: 'Esc: close the blackboard',
    pupitre: 'Esc: close the desk',
  },
};

function build(level: Level1, locale: 'fr' | 'en', helpOpen = false): Readonly<ViewModel> {
  return createViewModelBuilder(tr(locale)).build(level.snapshot, { helpOpen });
}

describe('bandeau d’aide : chaque phase, FR et EN', () => {
  for (const locale of ['fr', 'en'] as const) {
    it(`${locale} : textes exacts des neuf bandeaux`, () => {
      const t = tr(locale);
      for (const id of Object.keys(HINTS[locale]) as HintId[]) {
        expect(hintText(hintLine(id, t)), id).toBe(HINTS[locale][id]);
      }
    });
  }

  it('les touches sont des morceaux « key » (dessinés en <kbd>), le reste du texte', () => {
    const line = hintLine('tune', tr('fr'));
    const keys = line.flatMap((item) => item.filter((s) => s.kind === 'key').map((s) => s.text));
    expect(keys).toEqual(['+', '−', 'Page préc.', 'Page suiv.', 'E', 'Entrée']);
    const en = hintLine('trip', tr('en'));
    expect(en.flatMap((i) => i.filter((s) => s.kind === 'key').map((s) => s.text))).toEqual([
      'R',
      'Esc',
    ]);
  });

  it('chooseHint suit la phase et l’aide ; en approche, E de n’importe où (D31)', () => {
    const level = createLevel1({ animations: false });
    expect(chooseHint(level.snapshot, false)).toBe('use');
    expect(chooseHint(level.snapshot, true)).toBe('help');
    const there = atConsole();
    expect(chooseHint(there.snapshot, false)).toBe('use');
    expect(chooseHint(tuning().snapshot, false)).toBe('tune');
    const trip = tuning(2500);
    trip.launch();
    expect(chooseHint(trip.snapshot, false)).toBe('trip');
    trip.pause();
    expect(chooseHint(trip.snapshot, false)).toBe('paused');
    expect(chooseHint(finished(2500).snapshot, false)).toBe('outcome');
  });
});

describe('étiquettes de la jauge', () => {
  it('légende, haut d’échelle (tiré de ELEVATOR_MAX_FORCE) et repère du poids, FR et EN', () => {
    const fr = staticTexts(tr('fr'));
    const en = staticTexts(tr('en'));
    expect(fr.gaugeTitle).toBe('Force du moteur');
    expect(en.gaugeTitle).toBe('Motor force');
    expect(fr.gaugeMax).toBe(`${String(ELEVATOR_MAX_FORCE)}${NB}N max`);
    expect(en.gaugeMax).toBe(`${String(ELEVATOR_MAX_FORCE)}${NB}N max`);
    expect(fr.gaugeWeight).toBe('poids');
    expect(en.gaugeWeight).toBe('weight');
  });
});

describe('modèle de vue par phase', () => {
  it('approche, loin de la console : bulle d’objectif, bandeau « E : régler », Kp visible', () => {
    const level = createLevel1({ animations: false });
    const fr = build(level, 'fr');
    expect(fr.hintId).toBe('use');
    expect(hintText(fr.hint)).toBe(HINTS.fr.use);
    expect(fr.bubble).toBe(CATALOGS.fr['level1.goal']);
    expect(fr.kpTag).toBe(`Kp = 2000${NB}N/m`);
    expect(fr.readoutVisible).toBe(false);
    expect(fr.outcomeVisible).toBe(false);
    expect(fr.locale).toBe('fr');
    expect(fr.otherLocale).toBe('en');
    const en = build(level, 'en');
    expect(en.bubble).toBe(CATALOGS.en['level1.goal']);
    expect(en.otherLocale).toBe('fr');
  });

  it('approche, à la console : invite à la console', () => {
    const level = atConsole();
    expect(build(level, 'fr').bubble).toBe(CATALOGS.fr['level1.console.prompt']);
    expect(build(level, 'en').bubble).toBe(CATALOGS.en['level1.console.prompt']);
    expect(build(level, 'fr').hintId).toBe('use');
  });

  it('réglage : étiquette « Kp = 2500 N/m », bulle masquée', () => {
    const level = tuning(2500);
    const fr = build(level, 'fr');
    expect(fr.kpTag).toBe(`Kp = 2500${NB}N/m`);
    expect(fr.bubble).toBe('');
    expect(hintText(fr.hint)).toBe(HINTS.fr.tune);
  });

  it('trajet : temps, erreur et force formatés, saturation', () => {
    const level = tuning(2500);
    level.launch();
    advance(level, 0.1);
    const early = build(level, 'fr');
    expect(early.readoutVisible).toBe(true);
    expect(early.saturated).toBe(true); // 2500 × 3 m = 7500 N > 5000 N au départ
    expect(early.force).toBe(`Force${NB}: 5000${NB}N`);
    advance(level, 0.9);
    const s = level.snapshot;
    expect(s.k).toBe(120);
    const fr = build(level, 'fr');
    expect(fr.time).toBe(`Temps${NB}: 1,0${NB}s`);
    expect(fr.error).toMatch(/^Erreur\u00A0: -?\d+,\d{2}\u00A0m$/);
    expect(fr.force).toMatch(/^Force\u00A0: -?\d+\u00A0N$/);
    expect(fr.kpTag).toBe(`Kp = 2500${NB}N/m`);
    expect(hintText(fr.hint)).toBe(HINTS.fr.trip);
    const en = build(level, 'en');
    expect(en.time).toBe(`Time: 1.0${NB}s`);
    expect(en.error).toMatch(/^Error: -?\d+\.\d{2}\u00A0m$/);
    expect(en.saturated).toBe(s.saturated);
  });

  it('légende : dépliée pendant le premier trajet seulement, repliée à l’issue et ensuite', () => {
    const level = tuning(2500);
    expect(build(level, 'fr').legendOpenByDefault).toBe(false);
    level.launch();
    advance(level, 0.5);
    expect(build(level, 'fr').legendOpenByDefault).toBe(true);
    level.pause();
    expect(build(level, 'fr').legendOpenByDefault).toBe(true);
    level.resume();
    advance(level, 4);
    expect(level.snapshot.phase).toBe('outcome');
    expect(build(level, 'fr').legendOpenByDefault).toBe(false);
    level.restart();
    level.launch();
    advance(level, 0.5);
    expect(level.snapshot.attempt).toBe(2);
    expect(build(level, 'fr').legendOpenByDefault).toBe(false);
  });

  it('pause pendant le trajet : phase effective « trip », bandeau de reprise', () => {
    const level = tuning(2500);
    level.launch();
    advance(level, 0.5);
    level.pause();
    expect(effectivePhase(level.snapshot)).toBe('trip');
    const fr = build(level, 'fr');
    expect(fr.paused).toBe(true);
    expect(fr.phase).toBe('trip');
    expect(hintText(fr.hint)).toBe(HINTS.fr.paused);
    expect(hintText(build(level, 'en').hint)).toBe(HINTS.en.paused);
  });

  it('pause pendant le réglage : phase effective « tuning », en pause', () => {
    const level = tuning(2500);
    level.pause();
    const vm = build(level, 'fr');
    expect(vm.phase).toBe('tuning');
    expect(vm.paused).toBe(true);
  });

  it('D31-D32, avec animations : réglage tout de suite, embarquement verrouillé, issue après la sortie', () => {
    const level = createLevel1();
    level.setKp(2500);
    level.interact();
    // Panneau ouvert dès E, loin de la console, pendant la marche vers le poste.
    let vm = build(level, 'fr');
    expect(level.snapshot.walkerAction).toBe('toPost');
    expect(vm.hintId).toBe('tune');
    expect(vm.bubble).toBe('');
    level.launch();
    vm = build(level, 'fr');
    expect(vm.phase).toBe('boarding');
    expect(vm.readoutVisible).toBe(false);
    expect(vm.outcomeVisible).toBe(false);
    expect(hintText(vm.hint)).toBe(HINTS.fr.skip);
    expect(hintText(build(level, 'en').hint)).toBe(HINTS.en.skip);
    level.pause();
    expect(build(level, 'fr').phase).toBe('boarding');
    expect(build(level, 'fr').hintId).toBe('paused');
    level.resume();
    for (let i = 0; i < 10_000 && level.snapshot.phase !== 'exit'; i += 1) level.update(1 / 60);
    vm = build(level, 'fr');
    expect(vm.phase).toBe('exit');
    expect(level.snapshot.outcome).toBe('win');
    // Issue jugée mais pas encore affichée : mesures et légende du trajet restent, pas de panneau.
    expect(vm.outcomeVisible).toBe(false);
    expect(vm.outcome).toBeNull();
    expect(vm.outcomeTitle).toBe('');
    expect(vm.readoutVisible).toBe(true);
    expect(vm.legendOpenByDefault).toBe(true);
    expect(vm.hintId).toBe('skip');
    for (let i = 0; i < 10_000 && level.snapshot.phase === 'exit'; i += 1) level.update(1 / 60);
    vm = build(level, 'fr');
    expect(vm.phase).toBe('outcome');
    expect(vm.outcomeVisible).toBe(true);
    expect(vm.outcome).toBe('win');
    expect(vm.outcomeTitle).toBe(CATALOGS.fr['level1.winTitle']);
  });

  it('aide ouverte : bandeau « Échap : fermer l’aide »', () => {
    expect(hintText(build(createLevel1({ animations: false }), 'fr', true).hint)).toBe(
      HINTS.fr.help,
    );
    expect(build(createLevel1({ animations: false }), 'en', true).helpOpen).toBe(true);
  });
});

describe('issues : titres, messages pédagogiques complets, cote et formule', () => {
  it('victoire à Kp = 2500 : cote « e = 0,20 m », formule, teaser, bouton', () => {
    const level = finished(2500);
    expect(level.snapshot.outcome).toBe('win');
    const fr = build(level, 'fr');
    expect(fr.outcomeVisible).toBe(true);
    expect(fr.outcome).toBe('win');
    expect(fr.outcomeTitle).toBe(CATALOGS.fr['level1.winTitle']);
    expect(fr.outcomeMessage).toBe(CATALOGS.fr['level1.win']);
    expect(fr.dimension).toBe(`e = 0,20${NB}m`);
    expect(fr.formula).toBe(`e = m·g/Kp = 490,5${NB}N ÷ 2500${NB}N/m ≈ 0,20${NB}m`);
    expect(fr.outcomeButton).toBe(CATALOGS.fr['level1.replay']);
    expect(fr.texts.teaser).toBe(CATALOGS.fr['level1.teaser']);
    expect(fr.texts.nextLevel).toBe(CATALOGS.fr['controls.nextLevel']);
    expect(fr.texts.nextLevel).toBe('Niveau suivant');
    expect(fr.readoutVisible).toBe(true);
    expect(fr.kpTag).toBe(`Kp = 2500${NB}N/m`);
    expect(hintText(fr.hint)).toBe(HINTS.fr.outcome);
    const en = build(level, 'en');
    expect(en.dimension).toBe(`e = 0.20${NB}m`);
    expect(en.formula).toBe(`e = m·g/Kp = 490.5${NB}N ÷ 2500${NB}N/m ≈ 0.20${NB}m`);
    expect(en.outcomeMessage).toBe(CATALOGS.en['level1.win']);
  });

  it('cote = e MESURÉE (finalError), formule = e THÉORIQUE (m·g/Kp)', () => {
    const level = finished(2500);
    const fake = copy(level.snapshot, { finalError: 0.314, theoreticalError: 0.1234 });
    const vm = createViewModelBuilder(tr('fr')).build(fake, CLOSED);
    expect(vm.dimension).toBe(`e = 0,31${NB}m`);
    expect(vm.formula).toContain(`≈ 0,12${NB}m`);
    expect(vm.formula).not.toContain('0,31');
  });

  it('marche trop haute à Kp = 800 : message avec e mesurée (0,61 m)', () => {
    const level = finished(800);
    expect(level.snapshot.outcome).toBe('step');
    const fr = build(level, 'fr');
    expect(fr.outcomeTitle).toBe(CATALOGS.fr['level1.failTitle.step']);
    expect(fr.outcomeMessage.startsWith(`Il manque 0,61${NB}m`)).toBe(true);
    expect(fr.outcomeMessage).toBe(CATALOGS.fr['level1.fail.step'].replace('{e}', '0,61'));
    expect(fr.dimension).toBe('');
    expect(fr.formula).toBe('');
    expect(fr.outcomeButton).toBe(CATALOGS.fr['controls.restart']);
    const en = build(level, 'en');
    expect(en.outcomeMessage.startsWith(`0.61${NB}m short`)).toBe(true);
  });

  it('pas de décollage à Kp = 100 et choc à Kp = 7000 : titres et messages de la locale', () => {
    const noLift = finished(100);
    expect(noLift.snapshot.outcome).toBe('noLift');
    expect(build(noLift, 'fr').outcomeTitle).toBe(CATALOGS.fr['level1.failTitle.noLift']);
    expect(build(noLift, 'fr').outcomeMessage).toBe(CATALOGS.fr['level1.fail.noLift']);
    expect(build(noLift, 'en').outcomeMessage).toBe(CATALOGS.en['level1.fail.noLift']);
    const bonk = finished(7000);
    expect(bonk.snapshot.outcome).toBe('bonk');
    expect(build(bonk, 'fr').outcomeTitle).toBe(CATALOGS.fr['level1.failTitle.bonk']);
    expect(build(bonk, 'en').outcomeMessage).toBe(CATALOGS.en['level1.fail.bonk']);
    expect(build(bonk, 'en').outcomeTitle).toBe(CATALOGS.en['level1.failTitle.bonk']);
    expect(build(bonk, 'en').dimension).toBe('');
  });

  it('après « recommencer », retour au réglage avec Kp conservé et issue masquée', () => {
    const level = finished(2500);
    const builder = createViewModelBuilder(tr('fr'));
    expect(builder.build(level.snapshot, CLOSED).outcomeVisible).toBe(true);
    level.restart();
    const vm = builder.build(level.snapshot, CLOSED);
    expect(vm.outcomeVisible).toBe(false);
    expect(vm.outcomeTitle).toBe('');
    expect(vm.dimension).toBe('');
    expect(vm.phase).toBe('tuning');
  });
});

describe('Kp toujours présent, langue et mémoïsation', () => {
  it('l’étiquette Kp est présente dans toutes les phases, en FR et en EN', () => {
    const levels = [
      createLevel1({ animations: false }),
      atConsole(),
      tuning(3000),
      finished(2500),
      finished(7000),
      finished(800),
    ];
    const trip = tuning(2700);
    trip.launch();
    advance(trip, 0.5);
    levels.push(trip);
    const paused = tuning(2700);
    paused.pause();
    levels.push(paused);
    for (const level of levels) {
      for (const locale of ['fr', 'en'] as const) {
        expect(build(level, locale).kpTag).toMatch(/^Kp = \d+\u00A0N\/m$/);
      }
    }
  });

  it('même objet, mêmes chaînes tant que rien ne change ; suit la langue du traducteur', () => {
    const t = tr('fr');
    const builder = createViewModelBuilder(t);
    const level = tuning(2500);
    level.launch();
    advance(level, 0.5);
    const a = builder.build(level.snapshot, CLOSED);
    const before = { hint: a.hint, kpTag: a.kpTag, time: a.time, error: a.error, texts: a.texts };
    const b = builder.build(level.snapshot, CLOSED);
    expect(b).toBe(a);
    expect(b.hint).toBe(before.hint);
    expect(b.kpTag).toBe(before.kpTag);
    expect(b.time).toBe(before.time);
    expect(b.error).toBe(before.error);
    expect(b.texts).toBe(before.texts);
    t.setLocale('en');
    const c = builder.build(level.snapshot, CLOSED);
    expect(c.locale).toBe('en');
    expect(c.texts.title).toBe('Huygens’s world');
    expect(c.time).toBe(`Time: 0.5${NB}s`);
    expect(hintText(c.hint)).toBe(HINTS.en.trip);
    expect(c.texts).not.toBe(before.texts);
  });

  it('textes fixes : titre « Huygens’s world » dans les deux langues, aide complète', () => {
    for (const locale of ['fr', 'en'] as const) {
      const texts = staticTexts(tr(locale));
      expect(texts.title).toBe('Huygens’s world');
      expect(texts.helpLines).toHaveLength(10);
      expect(texts.legendLines).toHaveLength(4);
      for (const value of Object.values(texts)) {
        if (typeof value === 'string') expect(value.length).toBeGreaterThan(0);
      }
    }
    expect(staticTexts(tr('fr')).languageButton).toBe('English');
    expect(staticTexts(tr('en')).languageButton).toBe('Français');
  });

  it('bouton de retour au menu : « Menu » dans les deux langues, distinct de « Pause »', () => {
    for (const locale of ['fr', 'en'] as const) {
      const texts = staticTexts(tr(locale));
      expect(texts.menu).toBe('Menu');
      expect(texts.menu).not.toBe(texts.resume);
    }
  });
});

describe("tableau d'école ouvert (T-042)", () => {
  it('le bandeau annonce la fermeture du tableau, avant celui de l’aide, et le modèle le reflète', () => {
    for (const locale of ['fr', 'en'] as const) {
      const level = tuning(2500);
      const vm = createViewModelBuilder(tr(locale)).build(level.snapshot, {
        helpOpen: false,
        boardOpen: true,
      });
      expect(vm.boardOpen).toBe(true);
      expect(vm.hintId).toBe('board');
      expect(hintText(vm.hint)).toBe(HINTS[locale].board);
      const both = createViewModelBuilder(tr(locale)).build(level.snapshot, {
        helpOpen: true,
        boardOpen: true,
      });
      expect(both.hintId).toBe('board');
      expect(build(level, locale).boardOpen).toBe(false);
    }
  });

  it("les textes du tableau et la ligne d'aide de la touche T suivent la langue", () => {
    const fr = staticTexts(tr('fr'));
    const en = staticTexts(tr('en'));
    expect(fr.boardOpen).toBe('Ouvrir le tableau d’école');
    expect(en.boardOpen).toBe('Open the blackboard');
    expect(fr.helpLines).toContain(CATALOGS.fr['controls.help.board']);
    expect(en.helpLines).toContain(CATALOGS.en['controls.help.board']);
  });
});

describe('pupitre de contrôle : bandeau et textes (T-049)', () => {
  it('pupitre ouvert en lecture seule : bandeau « fermer le pupitre », après le tableau et l’aide', () => {
    const level = createLevel1({ animations: false });
    const builder = createViewModelBuilder(tr('fr'));
    const vm = builder.build(level.snapshot, { helpOpen: false, pupitreLecture: true });
    expect(vm.pupitreReadOnly).toBe(true);
    expect(vm.hintId).toBe('pupitre');
    expect(builder.build(level.snapshot, { helpOpen: true, pupitreLecture: true }).hintId).toBe(
      'help',
    );
    expect(
      builder.build(level.snapshot, { helpOpen: false, boardOpen: true, pupitreLecture: true })
        .hintId,
    ).toBe('board');
    expect(builder.build(level.snapshot, CLOSED).pupitreReadOnly).toBe(false);
  });

  it('textes du bouton de la barre du haut : FR et EN', () => {
    expect(staticTexts(tr('fr')).pupitreButton).toBe('Pupitre');
    expect(staticTexts(tr('fr')).pupitreLabel).toBe('Pupitre de contrôle');
    expect(staticTexts(tr('en')).pupitreButton).toBe('Desk');
    expect(staticTexts(tr('en')).pupitreLabel).toBe('Control desk');
  });
});
