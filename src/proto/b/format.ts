/** Maquette B (jetable) : écriture des nombres à la française et plages d'axes « rondes ». */

/** Espace insécable des milliers. */
const ESPACE = String.fromCharCode(0xa0);
/** Signe moins typographique (présent dans la police manuscrite). */
const MOINS = String.fromCharCode(0x2212);

/**
 * Nombre à la française : virgule décimale, milliers séparés (à partir de 1 000), vrai signe
 * moins, jamais de « −0 ».
 */
export function nombre(x: number, decimales = 0): string {
  const brut = Math.abs(x).toFixed(decimales);
  const negatif = x < 0 && Number(brut) !== 0;
  const point = brut.indexOf('.');
  const entier = point < 0 ? brut : brut.slice(0, point);
  const reste = point < 0 ? '' : ',' + brut.slice(point + 1);
  let groupe = '';
  for (let k = 0; k < entier.length; k++) {
    if (k > 0 && (entier.length - k) % 3 === 0) groupe += ESPACE;
    groupe += entier.charAt(k);
  }
  return (negatif ? MOINS : '') + groupe + reste;
}

/** Plage d'axe : bornes et pas de graduation. */
export interface Plage {
  readonly min: number;
  readonly max: number;
  readonly pas: number;
  /** Décimales à afficher pour les graduations. */
  readonly decimales: number;
}

/** Plage ronde contenant [min ; max] et 0, avec environ `cible` intervalles. */
export function plageRonde(min: number, max: number, cible = 4): Plage {
  const bas = Math.min(min, 0);
  const haut = Math.max(max, 0);
  const brut = (haut - bas) / cible || 1;
  const p10 = 10 ** Math.floor(Math.log10(brut));
  let pas = 10 * p10;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * p10 >= brut - 1e-12) {
      pas = m * p10;
      break;
    }
  }
  const lo = Math.floor(bas / pas + 1e-9) * pas;
  const hi = Math.ceil(haut / pas - 1e-9) * pas;
  let decimales = 0;
  while (
    decimales < 4 &&
    Math.abs(Math.round(pas * 10 ** decimales) - pas * 10 ** decimales) > 1e-6
  )
    decimales++;
  return { min: lo, max: hi === lo ? lo + pas : hi, pas, decimales };
}
