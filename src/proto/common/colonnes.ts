import type { ColonnesTrajet, Echantillon, MetaTrajet, TrajetReference } from './types';

/**
 * Construit un trajet de référence à partir de sa forme en colonnes (fichier généré
 * `trajets.ts`) : un objet échantillon par indice, t = indice·dt, `saturated` = (colonne ≠ 0).
 * Appelée une fois par trajet, au chargement du module ; le résultat et ses échantillons sont
 * gelés.
 * @param meta métadonnées du trajet.
 * @param colonnes une valeur par échantillon et par grandeur, colonnes de même longueur (≥ 1).
 * @throws RangeError si les colonnes sont vides ou de longueurs différentes.
 */
export function trajetDepuisColonnes(meta: MetaTrajet, colonnes: ColonnesTrajet): TrajetReference {
  const n = colonnes.y.length;
  const longueurs = [
    colonnes.v.length,
    colonnes.a.length,
    colonnes.e.length,
    colonnes.uCmd.length,
    colonnes.uSat.length,
    colonnes.p.length,
    colonnes.i.length,
    colonnes.saturated.length,
  ];
  if (n === 0 || longueurs.some((l) => l !== n)) {
    throw new RangeError(
      `colonnes vides ou de longueurs différentes (y : ${String(n)}, autres : ${longueurs.join(', ')})`,
    );
  }
  const echantillons: Echantillon[] = [];
  for (let j = 0; j < n; j++) {
    echantillons.push(
      Object.freeze({
        t: j * meta.dt,
        y: colonnes.y[j] as number,
        v: colonnes.v[j] as number,
        a: colonnes.a[j] as number,
        e: colonnes.e[j] as number,
        uCmd: colonnes.uCmd[j] as number,
        uSat: colonnes.uSat[j] as number,
        p: colonnes.p[j] as number,
        i: colonnes.i[j] as number,
        saturated: colonnes.saturated[j] !== 0,
      }),
    );
  }
  return Object.freeze({
    ...meta,
    physique: Object.freeze({ ...meta.physique }),
    echantillons: Object.freeze(echantillons),
  });
}
