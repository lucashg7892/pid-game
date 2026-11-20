/**
 * Contenu du tableau d'école (T-042) : équation du mouvement lue du modèle du noyau, erreur, loi de
 * commande selon le niveau (P ou PI), saturation, valeurs courantes ; parité FR/EN des clés
 * `board.*` ; les formules ne dépendent pas de la langue.
 */
import { describe, expect, it } from 'vitest';
import { ELEVATOR_MAX_FORCE, ELEVATOR_PARAMS, LEVEL1_SETPOINT, LEVEL2_KP } from '../../src/game';
import { CATALOGS, MESSAGE_PARAMS, placeholdersOf, type MessageKey } from '../../src/i18n';
import { boardValues, buildBoardSections, type BoardSection } from '../../src/ui/board';
import type { MathNode } from '../../src/ui/board-math';
import { NB, tr } from './helpers';

function tagsOf(node: MathNode): string[] {
  return [node.tag, ...(node.children ?? []).flatMap(tagsOf)];
}

function formulas(sections: readonly BoardSection[]): MathNode[] {
  return sections.flatMap((s) => s.blocks).flatMap((b) => (b.kind === 'formula' ? [b.math] : []));
}

/** Texte brut d'une formule : les feuilles mises bout à bout. */
function textOf(node: MathNode): string {
  return (node.text ?? '') + (node.children ?? []).map(textOf).join('');
}

function section(sections: readonly BoardSection[], id: BoardSection['id']): BoardSection {
  const found = sections.find((s) => s.id === id);
  if (found === undefined) throw new Error(`section absente : ${id}`);
  return found;
}

function paragraphs(sections: readonly BoardSection[], id: BoardSection['id']): string {
  return section(sections, id)
    .blocks.flatMap((b) => (b.kind === 'text' ? [b.text] : []))
    .join('|');
}

describe('clés board.* : parité FR/EN', () => {
  const keys = (Object.keys(CATALOGS.fr) as MessageKey[]).filter((k) => k.startsWith('board.'));

  it('mêmes clés, mêmes paramètres, aucune valeur vide', () => {
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      expect(CATALOGS.en[key], key).toBeTypeOf('string');
      expect(CATALOGS.en[key].length, key).toBeGreaterThan(0);
      expect([...placeholdersOf(CATALOGS.en[key])].sort(), key).toEqual(
        [...placeholdersOf(CATALOGS.fr[key])].sort(),
      );
    }
    expect(
      Object.keys(CATALOGS.en)
        .filter((k) => k.startsWith('board.'))
        .sort(),
    ).toEqual([...keys].sort());
  });

  it('les clés à paramètres sont déclarées', () => {
    for (const key of ['board.motion.values', 'board.error.where', 'board.sat.intro']) {
      expect(Object.hasOwn(MESSAGE_PARAMS, key), key).toBe(true);
    }
  });

  it("la touche T est dans l'aide des commandes et le bandeau du tableau existe", () => {
    expect(CATALOGS.fr['controls.help.board']).toMatch(/^T/);
    expect(CATALOGS.en['controls.help.board']).toMatch(/^T/);
    expect(CATALOGS.fr['hud.hint.closeBoard']).toBe('fermer le tableau');
    expect(CATALOGS.en['hud.hint.closeBoard']).toBe('close the blackboard');
  });
});

describe('contenu du tableau', () => {
  for (const locale of ['fr', 'en'] as const) {
    it(`${locale}, niveau 1 : mouvement, erreur, loi P, saturation, valeur de Kp seule`, () => {
      const sections = buildBoardSections(tr(locale), 'level1');
      expect(sections.map((s) => s.id)).toEqual([
        'motion',
        'error',
        'law',
        'saturation',
        'forces',
        'values',
      ]);
      const law = section(sections, 'law');
      expect(law.heading).toBe(CATALOGS[locale]['board.law.titleP']);
      expect(formulas([law]).map(textOf)).toEqual(['u=Kp·e']);
      expect(section(sections, 'values').blocks).toEqual([{ kind: 'value', id: 'kp' }]);
      // Pas de ligne sur le terme intégral au niveau 1.
      expect(formulas(sections).some((f) => tagsOf(f).includes('munderover'))).toBe(false);
      expect(paragraphs(sections, 'law')).not.toContain(CATALOGS[locale]['board.law.integral']);
    });

    it(`${locale}, niveau 2 : loi PI, intégrale avec bornes, forme discrète, Kp et Ki`, () => {
      const sections = buildBoardSections(tr(locale), 'level2');
      const law = section(sections, 'law');
      expect(law.heading).toBe(CATALOGS[locale]['board.law.titlePi']);
      const laws = formulas([law]);
      expect(laws.map(textOf)).toEqual(['u=Kp·e+I', 'I=∫0tKi·edτ', 'I←I+Ki·Δt·e']);
      expect(tagsOf(laws[1] as MathNode)).toContain('munderover');
      expect(section(sections, 'values').blocks).toEqual([
        { kind: 'value', id: 'kp' },
        { kind: 'value', id: 'ki' },
      ]);
    });
  }

  it("l'équation du mouvement est celle du modèle, puis sa forme en fraction", () => {
    const [first, second] = formulas([section(buildBoardSections(tr('fr'), 'level1'), 'motion')]);
    // m·ÿ = u_sat − m·g − c·ẏ : les accents suivent leur base (y¨ puis y˙).
    expect(textOf(first as MathNode)).toBe('m·y¨=usat−m·g−c·y˙');
    expect(tagsOf(first as MathNode)).toEqual(expect.arrayContaining(['mover', 'msub']));
    expect(tagsOf(first as MathNode)).not.toContain('mfrac');
    // ÿ = (u_sat − m·g − c·ẏ) / m
    expect(textOf(second as MathNode)).toBe('y¨=usat−m·g−c·y˙m');
    expect(tagsOf(second as MathNode)).toContain('mfrac');
  });

  it('la saturation et l’erreur ont leur formule', () => {
    const sections = buildBoardSections(tr('fr'), 'level1');
    expect(formulas([section(sections, 'error')]).map(textOf)).toEqual(['e=r−y']);
    expect(formulas([section(sections, 'saturation')]).map(textOf)).toEqual([
      'usat=max(−Umax,min(u,+Umax))',
    ]);
  });

  it('les formules sont identiques en français et en anglais, seul le texte accessible change', () => {
    const strip = (n: MathNode): unknown => ({
      tag: n.tag,
      text: n.text,
      children: n.children?.map(strip),
    });
    for (const level of ['level1', 'level2'] as const) {
      const fr = formulas(buildBoardSections(tr('fr'), level));
      const en = formulas(buildBoardSections(tr('en'), level));
      expect(fr.map(strip)).toEqual(en.map(strip));
      for (const f of [...fr, ...en]) {
        // Lecture en toutes lettres : aucun signe mathématique dans l'étiquette.
        const label = f.attrs?.['aria-label'] ?? '';
        expect(label.length).toBeGreaterThan(5);
        expect(label).not.toMatch(/[=−∫←]/);
      }
      expect(fr.map((f) => f.attrs?.['aria-label'])).not.toEqual(
        en.map((f) => f.attrs?.['aria-label']),
      );
    }
  });

  it('les valeurs du modèle sont lues du jeu, pas recopiées', () => {
    expect(ELEVATOR_PARAMS).toEqual({ mass: 50, gravity: 9.81, damping: 400 });
    const fr = buildBoardSections(tr('fr'), 'level1');
    expect(paragraphs(fr, 'motion')).toContain(`m = 50${NB}kg`);
    expect(paragraphs(fr, 'motion')).toContain(`g = 9,81${NB}m/s²`);
    expect(paragraphs(fr, 'motion')).toContain(`c = 400${NB}N·s/m`);
    expect(paragraphs(fr, 'error')).toContain(`r = ${String(LEVEL1_SETPOINT)}${NB}m`);
    expect(paragraphs(fr, 'saturation')).toContain(`Umax = ${String(ELEVATOR_MAX_FORCE)}${NB}N`);
    expect(paragraphs(buildBoardSections(tr('en'), 'level1'), 'motion')).toContain(
      `g = 9.81${NB}m/s²`,
    );
  });
});

describe('valeurs courantes', () => {
  it('niveau 1 : Kp seul, suit le réglage', () => {
    expect(boardValues(tr('fr'), 'level1', 3100, 0)).toEqual({ kp: `Kp = 3100${NB}N/m`, ki: '' });
    expect(boardValues(tr('en'), 'level1', 800, 0).kp).toBe(`Kp = 800${NB}N/m`);
  });

  it('niveau 2 : Kp fixé à 2500 et Ki', () => {
    const v = boardValues(tr('fr'), 'level2', LEVEL2_KP, 800);
    expect(v.kp).toBe(`Kp = 2500${NB}N/m (fixé)`);
    expect(v.ki).toBe(`Ki = 800${NB}N/(m·s)`);
    expect(boardValues(tr('en'), 'level2', LEVEL2_KP, 1200).kp).toBe(`Kp = 2500${NB}N/m (fixed)`);
  });
});
