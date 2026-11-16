/**
 * Pupitre de contrôle (T-049) : ossature, colonne de réglage, et API pour brancher les colonnes
 * du centre (machine) et de droite (courbes). Voir `colonne.ts` pour le contrat des colonnes.
 */
export { creerColonneVide } from './colonne-vide';
export type { ColonnePupitre, ContextePlan, EtatPupitre, MontageColonne } from './colonne';
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
export { creerColonneMachine, type OptionsMachine } from './machine';
export {
  animationMachine,
  arrondir,
  effort,
  etatMachineDirect,
  etatMachineVide,
  resumeMachine,
  texteForce,
  texteHauteur,
  type AnimationMachine,
  type EtatMachine,
} from './machine-etat';
export {
  ESPACE,
  FORCE_MAX,
  JAUGE_MAX,
  JAUGE_MIN,
  RAD_PAR_M,
  REGLE_MAX,
  angleRotor,
  depassement,
  disposition,
  fractionJauge,
  geometrieJauge,
  hauteurAffichee,
  yJauge,
  yRegle,
  type Depassement,
  type DispositionMachine,
  type GeometrieJauge,
} from './machine-plan';
export { creerColonnesTrajet } from './colonnes-trajet';
export { creerColonneCourbes, type OptionsCourbes } from './courbes';
export {
  DUREE_MAX_S,
  ECHELLES,
  PAS_MAX,
  fractionSurEchelle,
  graduationsEchelle,
  positionSurEchelle,
  texteValeur,
  type EchelleSignal,
  type EchellesCourbes,
  type PositionEchelle,
} from './courbes-echelles';
export {
  dispositionCourbes,
  pasDeX,
  xDePas,
  type BandeCourbes,
  type DispositionCourbes,
  type IdBande,
} from './courbes-plan';
export {
  borneIndice,
  choisirEtatMachine,
  creerCurseur,
  etatMachineAuPas,
  indiceApresTouche,
  valeursAuPas,
  valeursVides,
  type CurseurTrajet,
  type ValeursCourbes,
} from './curseur';
export { creerPupitre, type OptionsPupitre, type Pupitre } from './pupitre';
