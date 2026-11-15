/** Maquette D (lot B, v0.3, JETABLE) : écriture des nombres à la française (virgule, espaces). */

const formats = new Map<number, Intl.NumberFormat>();

function format(decimales: number): Intl.NumberFormat {
  let f = formats.get(decimales);
  if (f === undefined) {
    f = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
    formats.set(decimales, f);
  }
  return f;
}

/**
 * Nombre écrit en français : virgule décimale, espace fine insécable entre les milliers, vrai
 * signe moins ; jamais de « −0 ».
 */
export function nb(x: number, decimales = 0): string {
  const seuil = 0.5 * 10 ** -decimales;
  const v = Math.abs(x) < seuil ? 0 : x;
  return format(decimales).format(v).replace('-', '−');
}

/** Nombre entier sans séparateur (valeur d'un champ de saisie). */
export function entier(x: number): string {
  return String(Math.round(x));
}
