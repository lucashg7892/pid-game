/**
 * Interpolation `{nom}` stricte. Règles (spec T-001 §8, CA-3 de T-006) :
 * - `{nom}` est remplacé par `params[nom]` ; `nom` suit `[A-Za-z_][A-Za-z0-9_]*` ;
 * - `{{` et `}}` produisent des accolades littérales `{` et `}` ;
 * - un paramètre manquant, un paramètre en trop, une valeur non textuelle ou une accolade
 *   isolée lèvent {@link I18nError} : un `{e}` brut n'est jamais montré au joueur, et une faute
 *   de frappe dans un nom de paramètre est détectée au lieu d'être ignorée.
 */

/** Erreur de l'i18n (gabarit mal formé, paramètre manquant ou en trop, clé inconnue). */
export class I18nError extends Error {
  /** Nom de la classe d'erreur, pour les journaux. */
  override readonly name = 'I18nError';
}

/** Morceau d'un gabarit analysé : texte littéral ou paramètre. */
export type TemplatePart =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'param'; readonly name: string };

const PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function describe(context: string | undefined): string {
  return context === undefined ? '' : ` (clé « ${context} »)`;
}

/**
 * Découpe un gabarit en morceaux de texte et de paramètres.
 * @param template gabarit, p. ex. `"Il manque {e} m"`.
 * @param context clé d'origine, citée dans les messages d'erreur.
 * @throws I18nError si une accolade est isolée, non fermée ou entoure un nom invalide.
 */
export function parseTemplate(template: string, context?: string): readonly TemplatePart[] {
  const parts: TemplatePart[] = [];
  let text = '';
  let i = 0;
  while (i < template.length) {
    const c = template.charAt(i);
    const next = template.charAt(i + 1);
    if (c === '{' && next === '{') {
      text += '{';
      i += 2;
    } else if (c === '}' && next === '}') {
      text += '}';
      i += 2;
    } else if (c === '{') {
      const end = template.indexOf('}', i + 1);
      if (end < 0) {
        throw new I18nError(
          `accolade ouvrante non fermée à la position ${String(i)}${describe(context)}`,
        );
      }
      const name = template.slice(i + 1, end);
      if (!PARAM_NAME.test(name)) {
        throw new I18nError(`nom de paramètre invalide « {${name}} »${describe(context)}`);
      }
      if (text !== '') {
        parts.push({ kind: 'text', value: text });
        text = '';
      }
      parts.push({ kind: 'param', name });
      i = end + 1;
    } else if (c === '}') {
      throw new I18nError(
        `accolade fermante isolée à la position ${String(i)}${describe(context)}`,
      );
    } else {
      text += c;
      i += 1;
    }
  }
  if (text !== '') {
    parts.push({ kind: 'text', value: text });
  }
  return parts;
}

/**
 * Liste les noms de paramètres d'un gabarit, sans doublon, dans l'ordre d'apparition.
 * @param template gabarit.
 * @throws I18nError si le gabarit est mal formé.
 */
export function placeholdersOf(template: string): readonly string[] {
  const names: string[] = [];
  for (const part of parseTemplate(template)) {
    if (part.kind === 'param' && !names.includes(part.name)) {
      names.push(part.name);
    }
  }
  return names;
}

/**
 * Remplace les paramètres `{nom}` d'un gabarit.
 * @param template gabarit.
 * @param params valeurs textuelles déjà formatées ; doit contenir exactement les paramètres du
 *   gabarit.
 * @param context clé d'origine, citée dans les messages d'erreur.
 * @throws I18nError si le gabarit est mal formé, si un paramètre manque ou est en trop, ou si
 *   une valeur n'est pas une chaîne.
 */
export function interpolate(
  template: string,
  params: Readonly<Record<string, string>> = {},
  context?: string,
): string {
  const parts = parseTemplate(template, context);
  const used = new Set<string>();
  let out = '';
  for (const part of parts) {
    if (part.kind === 'text') {
      out += part.value;
      continue;
    }
    if (!Object.hasOwn(params, part.name)) {
      throw new I18nError(`paramètre manquant « ${part.name} »${describe(context)}`);
    }
    const value: unknown = params[part.name];
    if (typeof value !== 'string') {
      throw new I18nError(
        `le paramètre « ${part.name} » doit être une chaîne déjà formatée${describe(context)}`,
      );
    }
    used.add(part.name);
    out += value;
  }
  const extra = Object.keys(params).filter((name) => !used.has(name));
  if (extra.length > 0) {
    throw new I18nError(`paramètre(s) en trop : ${extra.join(', ')}${describe(context)}`);
  }
  return out;
}
