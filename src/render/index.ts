/** Rendu (bouchon T-002). Seul module, avec main.ts, autorisé à importer three. */

export type RendererChoice = 'auto' | 'webgl';

/** Lit `?renderer=webgl` (spec T-001 §2) ; toute autre valeur donne 'auto'. */
export function parseRendererChoice(search: string): RendererChoice {
  return new URLSearchParams(search).get('renderer') === 'webgl' ? 'webgl' : 'auto';
}
