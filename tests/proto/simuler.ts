/**
 * Simulation des trajets de référence par le VRAI jeu (pas un test) : partagée par le test de
 * garde `trajets.test.ts` et par la régénération `regenerer-trajets.test.ts`.
 */
import {
  BEAM_HEIGHT,
  LEVEL1_SETPOINT,
  LEVEL2_ARRIVAL_TOLERANCE,
  SETTLE_SPEED_TOLERANCE,
  STEP_TOLERANCE,
  createLevel1,
  createLevel2,
  type Level,
} from '../../src/game';
import { ELEVATOR_MAX_FORCE, ELEVATOR_PARAMS, SIM_DT } from '../../src/sim';
import type {
  ColonnesTrajet,
  IdTrajet,
  MetaTrajet,
  NiveauTrajet,
} from '../../src/proto/common/types';

/** Réglage d'un trajet de référence. */
export interface ReglageTrajet {
  readonly id: IdTrajet;
  readonly titre: string;
  readonly niveau: NiveauTrajet;
  /** Kp (N/m) : réglé au niveau 1, fixé (2500) au niveau 2. */
  readonly kp: number;
  /** Ki (N/(m·s)) : 0 au niveau 1. */
  readonly ki: number;
  /** Nom de la constante exportée par `trajets.ts`. */
  readonly constante: string;
}

/** Les trois trajets de référence du lot B, dans l'ordre du fichier généré. */
export const REGLAGES: readonly ReglageTrajet[] = [
  {
    id: 'victoire',
    titre: 'Victoire : niveau 2, Kp = 2500, Ki = 500',
    niveau: 'level2',
    kp: 2500,
    ki: 500,
    constante: 'TRAJET_VICTOIRE',
  },
  {
    id: 'choc',
    titre: 'Choc contre la poutre (windup) : niveau 2, Kp = 2500, Ki = 2000',
    niveau: 'level2',
    kp: 2500,
    ki: 2000,
    constante: 'TRAJET_CHOC',
  },
  {
    id: 'saturation',
    titre: 'Saturation prolongée sans choc : niveau 1, Kp = 5000',
    niveau: 'level1',
    kp: 5000,
    ki: 0,
    constante: 'TRAJET_SATURATION',
  },
];

/** Échantillons enregistrés après l'issue : 1 s à 120 échantillons par seconde. */
export const ECHANTILLONS_APRES_ISSUE = 120;

/** Trajet simulé : métadonnées et colonnes (forme du fichier généré). */
export interface TrajetSimule {
  readonly meta: MetaTrajet;
  readonly colonnes: ColonnesTrajet;
}

/** Colonnes modifiables pendant l'enregistrement. */
type ColonnesMutables = { [K in keyof ColonnesTrajet]: ColonnesTrajet[K][number][] };

/** Ajoute à `c` les signaux du dernier pas lus dans l'instantané du jeu. */
function enregistrer(c: ColonnesMutables, level: Level): void {
  const s = level.snapshot;
  c.y.push(s.stepY);
  c.v.push(s.stepVelocity);
  c.a.push(s.stepAcceleration);
  c.e.push(s.stepError);
  c.uCmd.push(s.uCmd);
  c.uSat.push(s.uSat);
  c.p.push(s.pTerm);
  c.i.push(s.iTermUsed);
  c.saturated.push(s.saturated ? 1 : 0);
}

/**
 * Joue un trajet dans le vrai jeu (`createLevel1`/`createLevel2`, animations désactivées), une
 * image de 1/120 s par pas : réglage, ouverture du panneau, lancement, puis un échantillon par
 * pas jusqu'à l'issue, et {@link ECHANTILLONS_APRES_ISSUE} images de plus, jeu figé sur l'issue.
 * @throws Error si une image ne fait pas exactement un pas, ou si le trajet n'aboutit pas.
 */
export function simulerTrajet(reglage: ReglageTrajet): TrajetSimule {
  const level: Level =
    reglage.niveau === 'level1'
      ? createLevel1({ animations: false, initialKp: reglage.kp })
      : createLevel2({ animations: false, initialKi: reglage.ki });
  if (level.snapshot.kp !== reglage.kp || level.snapshot.ki !== reglage.ki) {
    throw new Error(`réglage non appliqué pour ${reglage.id}`);
  }
  if (level.interact() !== 'accepted' || level.launch() !== 'accepted') {
    throw new Error(`lancement refusé pour ${reglage.id}`);
  }
  const c: ColonnesMutables = {
    y: [],
    v: [],
    a: [],
    e: [],
    uCmd: [],
    uSat: [],
    p: [],
    i: [],
    saturated: [],
  };
  let n = 0;
  while (level.snapshot.phase === 'trip') {
    level.update(SIM_DT);
    n += 1;
    if (level.snapshot.k !== n)
      throw new Error(`image ${String(n)} : k = ${String(level.snapshot.k)}`);
    enregistrer(c, level);
  }
  const s = level.snapshot;
  if (s.phase !== 'outcome' || s.outcome === null || s.outcomeK !== n || s.finalError === null) {
    throw new Error(`trajet ${reglage.id} sans issue (phase ${s.phase})`);
  }
  const yFinal = s.cabinY;
  const vFinal = s.cabinVelocity;
  for (let j = 0; j < ECHANTILLONS_APRES_ISSUE; j++) {
    level.update(SIM_DT);
    if (level.snapshot.k !== n) throw new Error('le jeu doit rester figé après l’issue');
    enregistrer(c, level);
  }
  const level2 = reglage.niveau === 'level2';
  return {
    meta: {
      id: reglage.id,
      titre: reglage.titre,
      niveau: reglage.niveau,
      kp: s.kp,
      ki: s.ki,
      issue: s.outcome,
      pasIssue: n,
      yFinal,
      vFinal,
      erreurFinale: s.finalError,
      dt: SIM_DT,
      physique: {
        m: ELEVATOR_PARAMS.mass,
        g: ELEVATOR_PARAMS.gravity,
        c: ELEVATOR_PARAMS.damping,
        uMax: ELEVATOR_MAX_FORCE,
        r: LEVEL1_SETPOINT,
        hauteurPoutre: BEAM_HEIGHT,
        toleranceArrivee: level2 ? LEVEL2_ARRIVAL_TOLERANCE : STEP_TOLERANCE,
        toleranceVitesse: SETTLE_SPEED_TOLERANCE,
      },
    },
    colonnes: c,
  };
}

/** Écrit un nombre sous une forme relue à l'identique (bit à bit, −0 compris). */
function nombre(x: number): string {
  if (!Number.isFinite(x)) throw new RangeError(`valeur non finie : ${String(x)}`);
  return Object.is(x, -0) ? '-0' : String(x);
}

/** Texte TypeScript d'un tableau de nombres. */
function tableau(xs: readonly number[]): string {
  return `[${xs.map(nombre).join(', ')}]`;
}

/** En-tête du fichier généré. */
const EN_TETE = `/**
 * Trajets de référence des maquettes (lot B de la v0.3), FICHIER GÉNÉRÉ : ne pas modifier à la
 * main. Simulés par le vrai jeu (\`createLevel1\` / \`createLevel2\`, animations désactivées, une
 * image de 1/120 s par pas), un échantillon par pas depuis k = 0 jusqu'à l'issue, puis 1 s
 * (120 échantillons) de jeu figé sur l'issue. Le test \`tests/proto/trajets.test.ts\` vérifie
 * qu'ils égalent bit à bit une nouvelle simulation du jeu.
 *
 * Régénérer (depuis la racine du dépôt, Git Bash) :
 *   REGENERER_TRAJETS=1 npx vitest run tests/proto/regenerer-trajets.test.ts
 * ou sous PowerShell :
 *   $env:REGENERER_TRAJETS='1'; npx.cmd vitest run tests/proto/regenerer-trajets.test.ts; Remove-Item Env:REGENERER_TRAJETS
 * Le réglage des trois trajets est dans \`tests/proto/simuler.ts\` (\`REGLAGES\`).
 */
import { trajetDepuisColonnes } from './colonnes';
import type { TrajetReference } from './types';
`;

/**
 * Texte du module `src/proto/common/trajets.ts` (avant formatage par Prettier).
 * @param trajets trajets simulés, dans l'ordre de {@link REGLAGES}.
 */
export function moduleTrajets(trajets: readonly TrajetSimule[]): string {
  const blocs = trajets.map(({ meta, colonnes }, j) => {
    const reglage = REGLAGES[j];
    if (reglage === undefined) throw new Error('trajet sans réglage');
    const p = meta.physique;
    const physique = `{ m: ${nombre(p.m)}, g: ${nombre(p.g)}, c: ${nombre(p.c)}, uMax: ${nombre(p.uMax)}, r: ${nombre(p.r)}, hauteurPoutre: ${nombre(p.hauteurPoutre)}, toleranceArrivee: ${nombre(p.toleranceArrivee)}, toleranceVitesse: ${nombre(p.toleranceVitesse)} }`;
    const metaTexte = `{ id: '${meta.id}', titre: '${meta.titre}', niveau: '${meta.niveau}', kp: ${nombre(meta.kp)}, ki: ${nombre(meta.ki)}, issue: '${meta.issue}', pasIssue: ${nombre(meta.pasIssue)}, yFinal: ${nombre(meta.yFinal)}, vFinal: ${nombre(meta.vFinal)}, erreurFinale: ${nombre(meta.erreurFinale)}, dt: ${nombre(meta.dt)}, physique: ${physique} }`;
    const cols = (Object.keys(colonnes) as (keyof ColonnesTrajet)[])
      .map((cle) => `${cle}: ${tableau(colonnes[cle])}`)
      .join(',\n');
    return `/** ${meta.titre} (issue \`${meta.issue}\` au pas ${String(meta.pasIssue)}). */
export const ${reglage.constante}: TrajetReference = trajetDepuisColonnes(${metaTexte}, {
${cols}
});
`;
  });
  const liste = REGLAGES.map((r) => r.constante).join(', ');
  return `${EN_TETE}
${blocs.join('\n')}
/** Les trois trajets de référence, dans l'ordre : victoire, choc, saturation. */
export const TRAJETS_REFERENCE: readonly TrajetReference[] = [${liste}];
`;
}
