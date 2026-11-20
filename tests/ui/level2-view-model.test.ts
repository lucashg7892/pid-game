/**
 * Niveau 2 dans l'interface (T-021b) : modèle de vue (réglage de Ki, Kp fixé, textes d'issue),
 * bandeaux, annonces `aria-live`, en français et en anglais ; parité avec le niveau 1 inchangé.
 */
import { describe, expect, it } from 'vitest';
import { createLevel1, createLevel2, type GameEvent, type Level } from '../../src/game';
import { CATALOGS } from '../../src/i18n';
import { announcementFor } from '../../src/ui/announce';
import { hintLine, hintText } from '../../src/ui/hints';
import { createViewModelBuilder, staticTexts } from '../../src/ui/view-model';
import { NB, NNB, advance, copy, tr } from './helpers';

const CLOSED = { helpOpen: false };

/** Niveau 2 en réglage (panneau ouvert) avec le Ki donné. */
function tuning2(ki = 500): Level {
  const level = createLevel2({ animations: false });
  level.moveRight();
  for (let i = 0; i < 10_000 && !level.snapshot.atConsole; i += 1) level.update(1 / 60);
  level.stop();
  level.interact();
  level.setTuning(ki);
  return level;
}

/** Niveau 2 après un trajet complet au Ki donné (phase `outcome`). */
function finished2(ki: number): Level {
  const level = tuning2(ki);
  level.launch();
  for (let i = 0; i < 2000 && level.snapshot.phase === 'trip'; i += 1) level.update(1 / 30);
  if (level.snapshot.phase !== 'outcome') throw new Error('trajet non terminé');
  return level;
}

describe('modèle de vue du niveau 2', () => {
  for (const locale of ['fr', 'en'] as const) {
    const cat = CATALOGS[locale];

    it(`${locale} : étiquette Kp et Ki, aide des commandes de Ki`, () => {
      const level = tuning2(1200);
      const vm = createViewModelBuilder(tr(locale), 'level2').build(level.snapshot, CLOSED);
      expect(vm.kpTag).toBe('Kp = 2500 · Ki = 1200');
      expect(vm.texts.helpLines).toContain(cat['controls.help.ki']);
      expect(vm.texts.helpLines).not.toContain(cat['controls.help.kp']);
    });

    it(`${locale} : bulle d’ouverture du niveau 2, qui annonce le terme I`, () => {
      const level = createLevel2({ animations: false });
      const vm = createViewModelBuilder(tr(locale), 'level2').build(level.snapshot, CLOSED);
      expect(vm.bubble).toBe(cat['level2.goal']);
      expect(vm.bubble).toContain('I');
    });

    it(`${locale} : le niveau 1 garde ses textes`, () => {
      const level = createLevel1({ animations: false });
      const vm = createViewModelBuilder(tr(locale)).build(level.snapshot, CLOSED);
      expect(vm.bubble).toBe(cat['level1.goal']);
      expect(vm.kpTag).toBe(cat['hud.kp.value'].replace('{kp}', '2000'));
    });

    it(`${locale} : issues du niveau 2 (victoire, choc), bouton et cote`, () => {
      const win = finished2(500);
      const vw = createViewModelBuilder(tr(locale), 'level2').build(win.snapshot, CLOSED);
      expect(vw.outcome).toBe('win');
      expect(vw.outcomeTitle).toBe(cat['level2.winTitle']);
      expect(vw.outcomeMessage).toBe(cat['level2.win']);
      expect(vw.formula).toBe('');
      expect(vw.dimension).toBe(
        cat['level1.dimension'].replace('{e}', locale === 'fr' ? '0,05' : '0.05'),
      );
      expect(vw.outcomeButton).toBe(cat['level1.replay']);

      const bonk = finished2(2000);
      const vb = createViewModelBuilder(tr(locale), 'level2').build(bonk.snapshot, CLOSED);
      expect(vb.outcome).toBe('bonk');
      expect(vb.outcomeTitle).toBe(cat['level2.failTitle.bonk']);
      expect(vb.outcomeMessage).toBe(cat['level2.fail.bonk']);
      expect(vb.outcomeButton).toBe(cat['controls.restart']);
      expect(vb.dimension).toBe('');
    });

    it(`${locale} : vrai « trop court » à Ki = 0 (10 s, 0,1 m) et vrai « trop lent » à Ki = 130`, () => {
      const step = finished2(0);
      expect(step.snapshot.outcome).toBe('step');
      expect(step.snapshot.outcomeK).toBe(1200);
      const builder = createViewModelBuilder(tr(locale), 'level2');
      const vs = builder.build(step.snapshot, CLOSED);
      expect(vs.outcomeTitle).toBe(cat['level2.failTitle.step']);
      expect(vs.outcomeMessage).toBe(
        cat['level2.fail.step'].replace('{e}', locale === 'fr' ? '0,20' : '0.20'),
      );
      expect(vs.outcomeMessage).toContain(`10${NB}s`);
      expect(vs.outcomeMessage).toContain(locale === 'fr' ? `0,1${NB}m` : `0.1${NB}m`);
      const slowLevel = createLevel2({ animations: false, initialKi: 130 });
      slowLevel.moveRight();
      for (let i = 0; i < 10_000 && !slowLevel.snapshot.atConsole; i += 1) slowLevel.update(1 / 60);
      slowLevel.interact();
      slowLevel.launch();
      for (let i = 0; i < 2000 && slowLevel.snapshot.phase === 'trip'; i += 1) {
        slowLevel.update(1 / 30);
      }
      expect(slowLevel.snapshot.outcome).toBe('slow');
      const vl = builder.build(slowLevel.snapshot, CLOSED);
      expect(vl.outcomeTitle).toBe(cat['level2.failTitle.slow']);
      expect(vl.outcomeMessage).toBe(cat['level2.fail.slow']);
    });

    it(`${locale} : « trop court » et « trop lent » ont leur titre et leur message`, () => {
      const base = finished2(500).snapshot;
      const builder = createViewModelBuilder(tr(locale), 'level2');
      const slow = builder.build(copy(base, { outcome: 'slow', attempt: 90 }), CLOSED);
      expect(slow.outcomeTitle).toBe(cat['level2.failTitle.slow']);
      expect(slow.outcomeMessage).toBe(cat['level2.fail.slow']);
      const step = builder.build(
        copy(base, { outcome: 'step', finalError: 0.8, attempt: 91 }),
        CLOSED,
      );
      expect(step.outcomeTitle).toBe(cat['level2.failTitle.step']);
      expect(step.outcomeMessage).toContain('0');
      expect(step.outcomeMessage).toBe(
        cat['level2.fail.step'].replace('{e}', locale === 'fr' ? '0,80' : '0.80'),
      );
    });
  }

  it('jauge I : légende de la jauge et ligne de légende propres au niveau 2, niveau 1 inchangé', () => {
    for (const locale of ['fr', 'en'] as const) {
      const cat = CATALOGS[locale];
      const t2 = staticTexts(tr(locale), 'level2');
      const t1 = staticTexts(tr(locale));
      expect(t1.legendLines).toHaveLength(3);
      expect(t2.legendLines).toHaveLength(4);
      expect(t2.legendLines.slice(0, 3)).toEqual(t1.legendLines);
      expect(t2.legendLines[3]).toBe(cat['level2.legend.integral']);
      expect(t2.legendLines[3]).toContain('490');
      expect(t2.integralTitle).toBe(cat['hud.igauge.title']);
    }
  });

  for (const locale of ['fr', 'en'] as const) {
    it(`${locale} : valeur de I affichée en trajet, signée, arrondie, mémoïsée ; vide au niveau 1`, () => {
      const cat = CATALOGS[locale];
      const level = tuning2(800);
      const builder = createViewModelBuilder(tr(locale), 'level2');
      expect(builder.build(level.snapshot, CLOSED).integral).toBe('');
      level.launch();
      advance(level, 0.3);
      const vm = builder.build(level.snapshot, CLOSED);
      const i = level.snapshot.iTerm;
      expect(i).toBeGreaterThan(0);
      const text = tr(locale).formatNumber(i, { maximumFractionDigits: 0 });
      expect(vm.integral).toBe(cat['hud.igauge.value'].replace('{i}', text));
      expect(vm.integralReadout).toBe(cat['hud.readout.iTerm'].replace('{i}', text));
      // Même chaîne tant que la valeur arrondie ne change pas.
      const before = vm.integral;
      builder.build(level.snapshot, CLOSED);
      expect(builder.model.integral).toBe(before);
      // Valeur négative : signe conservé (la jauge en montre l'intensité).
      const negative = builder.build(copy(level.snapshot, { iTerm: -300 }), CLOSED);
      expect(negative.integral).toContain('300');
      expect(negative.integral).toMatch(/[-−]/);
      // Valeur non finie : 0.
      expect(builder.build(copy(level.snapshot, { iTerm: Number.NaN }), CLOSED).integral).toBe(
        cat['hud.igauge.value'].replace('{i}', '0'),
      );
      const one = createLevel1({ animations: false });
      one.moveRight();
      expect(createViewModelBuilder(tr(locale)).build(one.snapshot, CLOSED).integral).toBe('');
    });
  }

  it('changement de langue en trajet : le texte de la jauge I suit', () => {
    const t = tr('fr');
    const level = tuning2(800);
    level.launch();
    advance(level, 0.3);
    const builder = createViewModelBuilder(t, 'level2');
    expect(builder.build(level.snapshot, CLOSED).integral).toMatch(new RegExp(`^I${NB}: `));
    t.setLocale('en');
    expect(builder.build(level.snapshot, CLOSED).integral).toMatch(/^I: /);
  });

  it('textes statiques : le niveau 2 ne change rien aux textes communs', () => {
    const t = tr('fr');
    const a = staticTexts(t);
    const b = staticTexts(t, 'level2');
    expect(b.title).toBe(a.title);
    expect(b.pupitreButton).toBe(a.pupitreButton);
    expect(b.helpLines).not.toEqual(a.helpLines);
  });

  it('mémoïsation : mêmes chaînes tant que Ki ne change pas, nouvelles quand il change', () => {
    const level = tuning2(300);
    const builder = createViewModelBuilder(tr('fr'), 'level2');
    const first = builder.build(level.snapshot, CLOSED);
    const tag = first.kpTag;
    advance(level, 0.2);
    builder.build(level.snapshot, CLOSED);
    expect(builder.model.kpTag).toBe(tag);
    level.setTuning(400);
    builder.build(level.snapshot, CLOSED);
    expect(builder.model.kpTag).toBe('Kp = 2500 · Ki = 400');
  });

  it('changement de langue : les textes du niveau 2 suivent', () => {
    const t = tr('fr');
    const level = tuning2(300);
    const builder = createViewModelBuilder(t, 'level2');
    expect(builder.build(level.snapshot, CLOSED).texts.helpLines).toContain(
      CATALOGS.fr['controls.help.ki'],
    );
    t.setLocale('en');
    expect(builder.build(level.snapshot, CLOSED).texts.helpLines).toContain(
      CATALOGS.en['controls.help.ki'],
    );
  });
});

describe('bandeaux du niveau 2', () => {
  it('réglage et verrou citent Ki ; le reste est commun', () => {
    expect(hintText(hintLine('tune', tr('fr'), 'level2'))).toBe(
      `+ / −${NB}: régler Ki · Page préc. / Page suiv.${NB}: pas de 1000 · E ou Entrée${NB}: lancer`,
    );
    expect(hintText(hintLine('trip', tr('en'), 'level2'))).toBe(
      'Ki is locked · R: restart · Esc: pause',
    );
    for (const id of ['use', 'skip'] as const) {
      expect(hintText(hintLine(id, tr('fr'), 'level2'))).toBe(hintText(hintLine(id, tr('fr'))));
    }
    expect(hintText(hintLine('tune', tr('fr')))).toContain('régler Kp');
  });
});

describe('annonces du niveau 2', () => {
  const ev = (type: GameEvent['type'], outcome: GameEvent['outcome'] = null): GameEvent => ({
    type,
    k: 0,
    outcome,
    attempt: 1,
  });

  it('FR : prêt, lancement avec Kp et Ki, saturation, reset', () => {
    const t = tr('fr');
    const s = tuning2(700).snapshot;
    expect(announcementFor(ev('tuningOpened'), s, t)).toBe(CATALOGS.fr['hud.status.readyKi']);
    expect(announcementFor(ev('launch'), s, t)).toBe(
      `Lancement avec Kp = 2500${NB}N/m et Ki = 700${NB}N/(m·s)${NB}: la consigne passe de 0 à 3${NB}m.`,
    );
    expect(announcementFor(ev('firstSaturation'), s, t)).toBe(CATALOGS.fr['level2.saturation']);
    expect(announcementFor(ev('reset'), s, t)).toBe(CATALOGS.fr['hud.status.resetKi']);
  });

  it('EN : lancement avec Kp et Ki', () => {
    const s = tuning2(700).snapshot;
    expect(announcementFor(ev('launch'), s, tr('en'))).toBe(
      `Launching with Kp = 2500${NB}N/m and Ki = 700${NB}N/(m·s): the setpoint jumps from 0 to 3${NB}m.`,
    );
  });

  it('issues : victoire, choc, trop lent, trop court', () => {
    const t = tr('fr');
    const win = finished2(800).snapshot;
    expect(announcementFor(ev('outcome', 'win'), win, t)).toBe(
      `Réussi${NNB}! La cabine s’est stabilisée à 0,00${NB}m du plateau d’arrivée.`,
    );
    const bonk = finished2(2000).snapshot;
    expect(announcementFor(ev('outcome', 'bonk'), bonk, t)).toContain('heurté la poutre');
    expect(announcementFor(ev('outcome', 'slow'), bonk, t)).toBe(
      CATALOGS.fr['hud.status.fail.slow'],
    );
    expect(announcementFor(ev('outcome', 'step'), copy(bonk, { finalError: 0.8 }), t)).toContain(
      '0,80',
    );
  });

  it('trop court : annonce propre au niveau 2 (10 s, tolérance 0,1 m), jamais celle du niveau 1', () => {
    const step = finished2(0).snapshot;
    expect(step.outcome).toBe('step');
    expect(announcementFor(ev('outcome', 'step'), step, tr('fr'))).toBe(
      `Échec${NB}: au bout de 10${NB}s, la cabine est encore 0,20${NB}m sous le plateau d’arrivée, plus loin que les 0,1${NB}m permis.`,
    );
    expect(announcementFor(ev('outcome', 'step'), step, tr('en'))).toBe(
      `Failed: after 10${NB}s, the lift is still 0.20${NB}m below the ledge, further than the 0.1${NB}m allowed.`,
    );
    expect(announcementFor(ev('outcome', 'step'), step, tr('fr'))).not.toContain('0,5');
    expect(announcementFor(ev('outcome', 'slow'), step, tr('en'))).toContain(`10${NB}s`);
  });

  it('niveau 1 : annonces inchangées', () => {
    const s = createLevel1({ animations: false }).snapshot;
    const t = tr('fr');
    expect(announcementFor(ev('tuningOpened'), s, t)).toBe(CATALOGS.fr['hud.status.ready']);
    expect(announcementFor(ev('firstSaturation'), s, t)).toBe(CATALOGS.fr['level1.saturation']);
    expect(announcementFor(ev('outcome', 'slow'), s, t)).toBe(CATALOGS.fr['hud.status.fail.slow']);
    expect(announcementFor(ev('outcome', 'step'), copy(s, { finalError: 0.61 }), t)).toBe(
      `Échec${NB}: la cabine s’est arrêtée 0,61${NB}m sous le plateau d’arrivée, au-delà des 0,5${NB}m que le bonhomme peut enjamber.`,
    );
  });
});
