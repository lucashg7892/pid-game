/**
 * Formules du tableau d'école (T-042) : arbre MathML pur (fractions, indices, accents, intégrale
 * avec bornes) et sa mise en éléments par `createElementNS`, sur un faux document (le test tourne
 * sous Node, sans DOM).
 */
import { describe, expect, it } from 'vitest';
import {
  MATHML_NS,
  SIGN,
  createMathElement,
  ddot,
  dot,
  frac,
  math,
  mi,
  miUpright,
  mn,
  mo,
  mtext,
  row,
  space,
  sub,
  sup,
  underover,
  type MathElementLike,
  type MathFactory,
  type MathNode,
} from '../../src/ui/board-math';

/** Élément de test : nom, espace de noms, attributs, texte, enfants. */
class FakeElement implements MathElementLike<FakeElement> {
  textContent: string | null = null;
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  constructor(
    readonly namespace: string,
    readonly name: string,
  ) {}
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }
}

const doc: MathFactory<FakeElement> = {
  createElementNS: (namespace, name) => new FakeElement(namespace, name),
};

/** Noms des éléments, parcours en profondeur. */
function tags(node: MathNode): string[] {
  return [node.tag, ...(node.children ?? []).flatMap(tags)];
}

function elementTags(element: FakeElement): string[] {
  return [element.name, ...element.children.flatMap(elementTags)];
}

describe('constructeurs de formules', () => {
  it('feuilles : texte et attributs', () => {
    expect(mi('x')).toEqual({ tag: 'mi', text: 'x' });
    expect(miUpright('p')).toEqual({ tag: 'mi', text: 'p', attrs: { mathvariant: 'normal' } });
    expect(mn('0')).toEqual({ tag: 'mn', text: '0' });
    expect(mo('=')).toEqual({ tag: 'mo', text: '=' });
    expect(mtext('si')).toEqual({ tag: 'mtext', text: 'si' });
    expect(space('0.3em')).toEqual({ tag: 'mspace', attrs: { width: '0.3em' } });
    expect(space().attrs?.['width']).toBe('0.17em');
  });

  it('fraction : numérateur puis dénominateur dans un mfrac', () => {
    const f = frac(mi('a'), mi('b'));
    expect(f.tag).toBe('mfrac');
    expect(f.children).toEqual([mi('a'), mi('b')]);
  });

  it('indice et exposant : base puis indice, dans msub et msup', () => {
    const s = sub(mi('K'), miUpright('p'));
    expect(s.tag).toBe('msub');
    expect(s.children?.map((c) => c.text)).toEqual(['K', 'p']);
    expect(sup(mi('x'), mn('2')).tag).toBe('msup');
  });

  it('accents : un point et deux points au-dessus de la base, mover accent', () => {
    const one = dot(mi('y'));
    expect(one.tag).toBe('mover');
    expect(one.attrs).toEqual({ accent: 'true' });
    expect(one.children).toEqual([mi('y'), mo(SIGN.dot)]);
    const two = ddot(mi('y'));
    expect(two.children).toEqual([mi('y'), mo(SIGN.ddot)]);
    expect(SIGN.dot).toBe('˙');
    expect(SIGN.ddot).toBe('¨');
  });

  it('intégrale avec bornes : munderover(intégrale, borne basse, borne haute)', () => {
    const integral = underover(mo(SIGN.integral), mn('0'), mi('t'));
    expect(integral.tag).toBe('munderover');
    expect(integral.children?.map((c) => c.text)).toEqual(['∫', '0', 't']);
  });

  it('math : étiquette accessible, affichage en bloc, contenu dans un mrow', () => {
    const f = math('x égale un', mi('x'), mo('='), mn('1'));
    expect(f.tag).toBe('math');
    expect(f.attrs).toEqual({ display: 'block', 'aria-label': 'x égale un' });
    expect(f.children).toHaveLength(1);
    expect(f.children?.[0]?.tag).toBe('mrow');
    expect(f.children?.[0]?.children).toHaveLength(3);
    expect(row(mi('a')).children).toHaveLength(1);
  });
});

describe('createMathElement', () => {
  it("crée chaque élément dans l'espace de noms MathML, avec attributs, texte et enfants", () => {
    const tree = math('I égale', mi('I'), mo('='), underover(mo(SIGN.integral), mn('0'), mi('t')));
    const element = createMathElement(doc, tree);
    expect(element.name).toBe('math');
    expect(element.attributes.get('aria-label')).toBe('I égale');
    expect(element.attributes.get('display')).toBe('block');
    const all: FakeElement[] = [];
    const collect = (e: FakeElement): void => {
      all.push(e);
      e.children.forEach(collect);
    };
    collect(element);
    expect(all.every((e) => e.namespace === MATHML_NS)).toBe(true);
    expect(elementTags(element)).toEqual(tags(tree));
    const under = all.find((e) => e.name === 'munderover');
    expect(under?.children.map((c) => c.textContent)).toEqual(['∫', '0', 't']);
  });

  it('une feuille garde son attribut mathvariant', () => {
    const e = createMathElement(doc, miUpright('sat'));
    expect(e.textContent).toBe('sat');
    expect(e.attributes.get('mathvariant')).toBe('normal');
  });
});
