/**
 * Construction des formules du tableau d'école en MathML natif (T-042), sans bibliothèque : une
 * petite description en arbre (pure, testable sous Node) des éléments `math`, `mrow`, `mi`, `mn`,
 * `mo`, `mtext`, `mfrac`, `msub`, `msup`, `mover`, `munderover` et `mspace`, puis sa mise en
 * éléments du document par `createElementNS` dans l'espace de noms MathML. Les formules ne
 * dépendent pas de la langue ; seul le texte accessible (`aria-label`) est traduit par l'appelant.
 */

/** Espace de noms MathML. */
export const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

/** Éléments MathML utilisés. */
export type MathTag =
  | 'math'
  | 'mrow'
  | 'mi'
  | 'mn'
  | 'mo'
  | 'mtext'
  | 'mspace'
  | 'mfrac'
  | 'msub'
  | 'msup'
  | 'mover'
  | 'munderover';

/** Nœud d'une formule : un élément MathML, avec son texte (feuilles) ou ses enfants. */
export interface MathNode {
  /** Nom de l'élément. */
  readonly tag: MathTag;
  /** Texte d'une feuille (`mi`, `mn`, `mo`, `mtext`) ; absent ailleurs. */
  readonly text?: string;
  /** Attributs. */
  readonly attrs?: Readonly<Record<string, string>>;
  /** Enfants, dans l'ordre du document. */
  readonly children?: readonly MathNode[];
}

/** Signes usuels (caractères Unicode, pas de balisage). */
export const SIGN = Object.freeze({
  minus: '−',
  plus: '+',
  equals: '=',
  times: '·',
  arrow: '←',
  integral: '∫',
  dot: '˙',
  ddot: '¨',
  open: '(',
  close: ')',
  comma: ',',
});

function leaf(tag: MathTag, text: string, attrs?: Readonly<Record<string, string>>): MathNode {
  return attrs === undefined ? { tag, text } : { tag, text, attrs };
}

/** Identificateur (`mi`) : une lettre s'écrit en italique, un mot en droit. */
export function mi(text: string): MathNode {
  return leaf('mi', text);
}

/** Identificateur droit (`mi` en `mathvariant="normal"`) : indice « p », « i », nom d'opérateur. */
export function miUpright(text: string): MathNode {
  return leaf('mi', text, { mathvariant: 'normal' });
}

/** Nombre (`mn`). */
export function mn(text: string): MathNode {
  return leaf('mn', text);
}

/** Opérateur ou signe (`mo`). */
export function mo(text: string): MathNode {
  return leaf('mo', text);
}

/** Texte courant dans une formule (`mtext`). */
export function mtext(text: string): MathNode {
  return leaf('mtext', text);
}

/** Espace fine (`mspace`), p. ex. avant le « d » d'une différentielle. */
export function space(width = '0.17em'): MathNode {
  return { tag: 'mspace', attrs: { width } };
}

/** Groupe (`mrow`). */
export function row(...children: readonly MathNode[]): MathNode {
  return { tag: 'mrow', children };
}

/** Fraction (`mfrac`) : numérateur au-dessus du dénominateur. */
export function frac(numerator: MathNode, denominator: MathNode): MathNode {
  return { tag: 'mfrac', children: [numerator, denominator] };
}

/** Indice (`msub`). */
export function sub(base: MathNode, subscript: MathNode): MathNode {
  return { tag: 'msub', children: [base, subscript] };
}

/** Exposant (`msup`). */
export function sup(base: MathNode, superscript: MathNode): MathNode {
  return { tag: 'msup', children: [base, superscript] };
}

/** Accent au-dessus d'une base (`mover accent`) : point (vitesse), double point (accélération). */
export function accent(base: MathNode, mark: string): MathNode {
  return { tag: 'mover', attrs: { accent: 'true' }, children: [base, mo(mark)] };
}

/** Un point au-dessus de la base (dérivée première). */
export function dot(base: MathNode): MathNode {
  return accent(base, SIGN.dot);
}

/** Deux points au-dessus de la base (dérivée seconde). */
export function ddot(base: MathNode): MathNode {
  return accent(base, SIGN.ddot);
}

/** Opérateur avec limites basse et haute (`munderover`) : l'intégrale avec ses bornes. */
export function underover(base: MathNode, lower: MathNode, upper: MathNode): MathNode {
  return { tag: 'munderover', children: [base, lower, upper] };
}

/**
 * Formule complète (`math`) accessible : `aria-label` en toutes lettres, `display="block"` pour
 * une formule seule sur sa ligne (fractions et bornes pleine taille).
 * @param label lecture de la formule, dans la langue de l'interface.
 * @param children contenu.
 */
export function math(label: string, ...children: readonly MathNode[]): MathNode {
  return {
    tag: 'math',
    attrs: { display: 'block', 'aria-label': label },
    children: [row(...children)],
  };
}

/** Ce que {@link createMathElement} exige d'un élément du document. */
export interface MathElementLike<E> {
  /** Texte de l'élément. */
  textContent: string | null;
  /** Écrit un attribut. */
  setAttribute(name: string, value: string): void;
  /** Ajoute des enfants. */
  append(...children: E[]): void;
}

/** Ce que {@link createMathElement} exige du document (`document` convient). */
export interface MathFactory<E extends MathElementLike<E>> {
  /** Crée un élément dans un espace de noms. */
  createElementNS(namespace: string, qualifiedName: string): E;
}

/**
 * Crée les éléments MathML d'un nœud, enfants compris, dans l'espace de noms MathML.
 * @param doc document (ou équivalent de test).
 * @param node nœud à construire.
 */
export function createMathElement<E extends MathElementLike<E>>(
  doc: MathFactory<E>,
  node: MathNode,
): E {
  const element = doc.createElementNS(MATHML_NS, node.tag);
  if (node.attrs !== undefined) {
    for (const [name, value] of Object.entries(node.attrs)) {
      element.setAttribute(name, value);
    }
  }
  if (node.text !== undefined) {
    element.textContent = node.text;
  }
  for (const child of node.children ?? []) {
    element.append(createMathElement(doc, child));
  }
  return element;
}
