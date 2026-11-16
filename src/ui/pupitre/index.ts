/**
 * Pupitre de contrôle (T-049) : ossature, colonne de réglage, et API pour brancher les colonnes
 * du centre (machine) et de droite (courbes). Voir `colonne.ts` pour le contrat des colonnes.
 */
export { creerColonneVide } from './colonne-vide';
export type { ColonnePupitre, EtatPupitre } from './colonne';
export {
  cleEtat,
  cleTitreIssue,
  fractionDe,
  graduations,
  pupitreVisible,
  reglageDe,
  valeurDe,
  type EtatLevier,
  type Graduation,
  type ModePupitre,
  type ReglagePupitre,
} from './modele';
export {
  COLONNES,
  ECHELLE_ETROITE_MAX,
  LARGEUR_ETROITE,
  PLAN_HAUTEUR,
  PLAN_LARGEUR,
  RESERVE_BAS,
  RESERVE_HAUT,
  RESERVE_HAUT_PORTRAIT,
  placerPlan,
  reserveHaut,
  type IdColonne,
  type PlacementPlan,
  type RectPlan,
} from './plan';
export {
  SYMBOLE_KI,
  SYMBOLE_KP,
  UNITE_KI,
  UNITE_KP,
  creerColonneReglage,
  texteNote,
  fractionDeY,
  geometrieReglage,
  yDeValeur,
  type GeometrieLevier,
  type GeometrieReglage,
} from './reglage';
export { creerPupitre, type OptionsPupitre, type Pupitre } from './pupitre';
