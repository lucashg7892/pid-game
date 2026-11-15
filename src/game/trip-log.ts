/**
 * Journal du trajet (T-048, décision D35) : les signaux de CHAQUE pas du trajet courant, pour les
 * courbes du pupitre de contrôle pendant le trajet et pour le curseur qui le reparcourt à l'issue.
 * Tableaux typés préalloués une fois ; aucune allocation par pas.
 */

/**
 * Colonne du journal, en lecture seule : vue directe (pas une copie) sur un tableau typé préalloué
 * de longueur {@link TripLog.capacity}. Seuls les indices 0 … {@link TripLog.count} − 1 sont
 * significatifs ; au-delà, ce sont des restes d'un trajet précédent (ou des 0), à ignorer. Le type
 * n'expose ni écriture indexée ni méthode de modification (`set`, `fill`…) : l'interface lit,
 * le niveau seul écrit.
 */
export type TripLogColumn = ArrayLike<number>;

/**
 * Journal des signaux du trajet courant, un enregistrement par pas simulé, en lecture seule.
 *
 * Instant et convention : l'enregistrement j (0 ≤ j < `count`) décrit le pas j → j + 1, pris à
 * l'instant t = j·dt où sa commande a été calculée, état AVANT le pas (convention `LoopSample` du
 * noyau, celle des champs `step*`, `uCmd`, `pTerm`, `iTermUsed`, `uSat` et `saturated` de
 * l'instantané). Il est écrit au moment même où l'instantané reçoit ces champs : il est égal bit à
 * bit à ce que l'instantané montrerait après le pas j (`stepY` = y[j], `stepVelocity` = v[j],
 * `stepAcceleration` = a[j], `stepError` = e[j], `uCmd` = uCmd[j], `uSat` = uSat[j],
 * `pTerm` = p[j], `iTermUsed` = i[j], `saturated` = (saturated[j] = 1)). Cohérence, au bit près :
 * e = r − y, uCmd = p + i (hors −0), uSat = uCmd borné à ±Umax, saturated = (uSat ≠ uCmd),
 * a = (uSat − m·g − c·v)/m (0 cabine posée au sol sous une force nette vers le bas).
 *
 * Lecture : sous `noUncheckedIndexedAccess`, une colonne `ArrayLike<number>` se lit avec `as number`.
 *
 * Cycle de vie : vidé (`count` = 0) au lancement, donc pendant tout l'embarquement et au départ du
 * trajet, et à `restart` ; un enregistrement par pas pendant le trajet (`count` = `snapshot.k`) ;
 * rien n'est ajouté après le pas de l'issue : le contenu est conservé tel quel pendant la sortie,
 * à l'issue et en pause, jusqu'au recommencement. `count` ≤ `capacity` (= `TRIP_MAX_STEPS`, la
 * durée maximale d'un trajet) : un trajet complet tient toujours.
 *
 * Cabine à afficher pour un curseur placé au pas j ∈ [0 ; count] (instant j·dt) :
 * - j < count : y[j] et v[j], état au temps j·dt (avant le pas j). Pour j ≥ 1, y[j] et v[j]
 *   égalent bit à bit l'état APRÈS le pas j − 1 (`cabinY`, `cabinVelocity` de l'instantané de
 *   ce pas-là) ;
 * - j = count (fin du journal : pas de l'issue, ou dernier pas simulé pendant le trajet) :
 *   `snapshot.cabinY` et `snapshot.cabinVelocity`, état APRÈS le dernier pas, celui où la cabine
 *   reste figée à l'issue (au choc, y[count − 1] est encore sous la poutre et la cabine figée
 *   au-dessus : ne pas dessiner y[count − 1] à la fin).
 *   L'erreur à afficher à cet instant est `snapshot.e` (= `finalError` à l'issue), et non e[count − 1].
 *
 * Objet unique, gelé, réutilisé pour toute la vie du niveau : les colonnes sont toujours les mêmes
 * tableaux (les garder en référence est sûr) ; `count` se relit à chaque image. Le jeu n'en relit
 * jamais le contenu : il ne peut pas influer sur le trajet.
 */
export interface TripLog {
  /** Nombre maximal d'enregistrements (sans unité) : longueur de chaque colonne. */
  readonly capacity: number;
  /** Nombre d'enregistrements significatifs (sans unité) : pas simulés du trajet courant. */
  readonly count: number;
  /** Pas de temps dt (s) : l'enregistrement j est pris à t = j·dt depuis le départ du trajet. */
  readonly dt: number;
  /** Hauteur du plancher de la cabine y (m, sol = 0), mesure du contrôleur ; `stepY`. */
  readonly y: TripLogColumn;
  /** Vitesse verticale de la cabine ẏ (m/s, positive vers le haut) ; `stepVelocity`. */
  readonly v: TripLogColumn;
  /**
   * Accélération verticale ÿ (m/s²) donnée par le modèle sous la force appliquée (jamais une
   * différence entre deux pas) ; `stepAcceleration`.
   */
  readonly a: TripLogColumn;
  /** Erreur vue par le contrôleur e = r − y (m) ; `stepError`. */
  readonly e: TripLogColumn;
  /** Force demandée par le contrôleur, avant saturation (N) ; `uCmd`. */
  readonly uCmd: TripLogColumn;
  /** Force appliquée par le moteur, après saturation à ±Umax (N) ; `uSat`. */
  readonly uSat: TripLogColumn;
  /** Terme proportionnel Kp·e (N) ; `pTerm`. */
  readonly p: TripLogColumn;
  /**
   * Terme intégral utilisé pour calculer uCmd (N), l'intégrale AVANT sa mise à jour par ce pas ;
   * `iTermUsed`. 0 au niveau 1.
   */
  readonly i: TripLogColumn;
  /** 1 si la saturation a écrêté la commande (uSat ≠ uCmd), 0 sinon ; `saturated`. */
  readonly saturated: TripLogColumn;
}

/** Écriture du journal, réservée au niveau. */
export interface TripLogWriter {
  /** Vue en lecture seule, à exposer à l'interface. */
  readonly log: TripLog;
  /** Vide le journal (`count` = 0) sans réallouer ni effacer les tableaux. */
  clear(): void;
  /**
   * Ajoute l'enregistrement du pas `count` (sans allocation).
   * @throws RangeError si le journal est plein (impossible dans le jeu : un trajet s'arrête à
   * `TRIP_MAX_STEPS` pas, la capacité).
   */
  record(
    y: number,
    v: number,
    a: number,
    e: number,
    uCmd: number,
    uSat: number,
    p: number,
    i: number,
    saturated: boolean,
  ): void;
}

/**
 * Crée un journal de trajet vide, tableaux alloués une fois pour toutes.
 * @param capacity nombre maximal d'enregistrements, entier ≥ 1.
 * @param dt pas de temps (s), fini et > 0.
 * @throws RangeError si `capacity` ou `dt` est invalide.
 */
export function createTripLog(capacity: number, dt: number): TripLogWriter {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`capacity doit être un entier ≥ 1 (reçu ${String(capacity)})`);
  }
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new RangeError(`dt doit être fini et > 0 (reçu ${String(dt)})`);
  }
  const y = new Float64Array(capacity);
  const v = new Float64Array(capacity);
  const a = new Float64Array(capacity);
  const e = new Float64Array(capacity);
  const uCmd = new Float64Array(capacity);
  const uSat = new Float64Array(capacity);
  const p = new Float64Array(capacity);
  const i = new Float64Array(capacity);
  const saturated = new Uint8Array(capacity);
  let count = 0;

  const log: TripLog = Object.freeze({
    capacity,
    get count(): number {
      return count;
    },
    dt,
    y,
    v,
    a,
    e,
    uCmd,
    uSat,
    p,
    i,
    saturated,
  });

  return {
    log,
    clear(): void {
      count = 0;
    },
    record(
      yj: number,
      vj: number,
      aj: number,
      ej: number,
      uCmdj: number,
      uSatj: number,
      pj: number,
      ij: number,
      saturatedj: boolean,
    ): void {
      if (count === capacity) {
        throw new RangeError(`journal du trajet plein (${String(capacity)} pas)`);
      }
      y[count] = yj;
      v[count] = vj;
      a[count] = aj;
      e[count] = ej;
      uCmd[count] = uCmdj;
      uSat[count] = uSatj;
      p[count] = pj;
      i[count] = ij;
      saturated[count] = saturatedj ? 1 : 0;
      count += 1;
    },
  };
}
