/**
 * Colonne sans contenu (T-049) : un cadre sobre, habillé comme les autres (plaque rivetée), qui
 * tient la place des colonnes du centre (machine, T-050) et de droite (courbes, T-051) tant
 * qu'elles ne sont pas faites. Pour la remplacer, brancher une vraie {@link ColonnePupitre}
 * de même `id` dans `creerPupitre` (option `colonnes`).
 */
import type { ColonnePupitre } from './colonne';
import { MINE_FINE, alea, plaque, rivet, trait } from './crayon';
import type { IdColonne } from './plan';

/**
 * Colonne vide.
 * @param id emplacement de la colonne.
 */
export function creerColonneVide(id: Exclude<IdColonne, 'reglage'>): ColonnePupitre {
  const graine = id === 'machine' ? 101 : 202;
  return {
    id,
    dessinerFond(ctx, r): void {
      const hasard = alea(graine);
      plaque(ctx, r.x, r.y, r.w, r.h, hasard);
      // Rivets le long des bords haut et bas : la plaque attend ses instruments.
      for (let x = r.x + 40; x < r.x + r.w - 30; x += 60) {
        rivet(ctx, x, r.y + 18, hasard);
        rivet(ctx, x, r.y + r.h - 18, hasard);
      }
      trait(ctx, r.x + 24, r.y + 32, r.x + r.w - 24, r.y + 32, MINE_FINE, hasard);
      trait(ctx, r.x + 24, r.y + r.h - 32, r.x + r.w - 24, r.y + r.h - 32, MINE_FINE, hasard);
    },
    dessiner(): void {
      // Rien de vif : la colonne n'a pas encore d'instrument.
    },
  };
}
