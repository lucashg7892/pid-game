# T-005 — Validation indépendante du noyau de simulation

Rôle : validateur indépendant (n'a pas écrit le code contrôlé). Date : 2026-11-12.
Périmètre : `src/sim/**`, `tests/sim/**`, spec `docs/specs/T-001-tranche-verticale.md` §4–§6.
Outils : MATLAB R2025a (25.1.0.2943329), **fonctions de base uniquement** (`expm`, `ode45`,
`fzero`, `eig`) ; Node 22.23.4 / Vitest 5.1.0 pour l'export des trajectoires et les attaques.

## Résumé

**Verdict : NOYAU VALIDÉ AVEC RÉSERVES.** Aucun défaut bloquant ni majeur.

- **Exactitude (A, B)** — exécuté. Le code TS colle à un oracle exact (exponentielle de
  matrice, sans RK4). Écart max sur y : **1,42e-7 m** (Kp = 8000), soit 7× sous le critère
  de 1e-6 m. L'écart est divisé par **16,4 à 17,4** quand dt est divisé par 2 : c'est bien
  l'erreur de troncature de RK4 (ordre 4), pas une différence de modèle.
- **Formules de la spec (C)** — exécuté. La boucle continue (`ode45`) retrouve e_ss, Mp et
  tp des formules §5 à 1e-9 près. Effet du bloqueur d'ordre zéro à dt = 1/120 : +0,07 à
  +1,76 point de dépassement pour Kp ∈ [1000 ; 4000]. L'affirmation « ≤ 2,5 points » est
  **confirmée pour les Kp testés**, mais **fausse au-delà de Kp ≈ 5500** : +3,55 points à
  8000 (D-3).
- **Stabilité (D)** — exécuté. Kp critique de la boucle échantillonnée exacte à
  dt = 1/120 : **97 079 N/m** (trois méthodes concordantes). C'est 12,1× le maximum du
  curseur (8000). **Toute la plage du jeu est stable**, avec un rayon spectral ≤ 0,970.
- **Fenêtre de jeu (E)** — exécuté. **[2000 ; 3800] confirmée** par l'oracle exact. L'issue
  du code TS est identique à celle de l'oracle pour les 80 valeurs de Kp, pas de l'issue
  compris. Marge à la poutre : **+5,842 mm à 3800** et **−1,865 mm à 3900** (choc). Ces
  marges valent 8·10⁴ fois l'écart TS/exact (7e-8 m) : elles sont robustes numériquement,
  mais physiquement minces (D-11).
- **Attaques (F)** — exécuté, 40 cas. Les entrées invalides de Kp, dt et Umax sont rejetées
  proprement. Une heure simulée ne dérive pas (|y − y_ss| = 4,4e-16 m). En revanche, la
  consigne n'est pas validée (NaN accepté, D-1) et aucun dt maximal n'est imposé (dt = 1 s
  diverge silencieusement, D-2).
- **Tests (G)** — exécuté, 8 mutants. Les 8 mutants sont tous tués, mais **les tests
  d'oracle T1–T5 et la propriété ζωn ne voient pas l'ordre de l'intégrateur** : un mutant
  Euler passe T1, T2 et T4, et un mutant RK2 passe tous les tests d'oracle (D-6).

« Exécuté » signifie que le chiffre sort d'une commande lancée pendant T-005. « Supposé »
signifie que l'affirmation est un raisonnement que je n'ai pas exécuté. Sans mention
contraire, tout chiffre de ce rapport est exécuté.

## Méthode

1. **Oracle exact** (`validation/matlab/t005_oracle.m`). Entre deux échantillons, la force
   nette f = sat(Kp·(r − y)) − m·g est constante. L'état x = [y ; ẏ] suit alors
   ẋ = A·x + B·f, avec A = [0 1 ; 0 −c/m] et B = [0 ; 1/m]. On calcule
   x(k+1) = Φ·x(k) + Γ·f, où Φ et Γ sont obtenus par `expm` de la matrice augmentée [A B ; 0 0]
   (Van Loan). On applique ensuite la contrainte de sol de la spec. Contrôle croisé de
   `expm` par la forme fermée analytique (avec `expm1`) : écart **2,7e-20**. L'oracle
   calcule aussi le maximum exact de y **entre** deux échantillons, là où ẏ s'annule dans le
   pas.
2. **Export TS**. Un test Vitest temporaire, supprimé ensuite et reproduit dans
   `validation/README.md`, a produit `validation/data/*.csv` en 17 chiffres significatifs.
3. **Attaques et mutants**. Tests Vitest temporaires, et copies du noyau mutées dans un
   dossier temporaire, le tout supprimé ensuite. `src/` et `tests/` n'ont jamais été modifiés.

## A–B. Écart TS (RK4) / oracle exact

Saturation ±5000 N et contrainte de sol actives, état initial nul, r = 3 m, 10 s simulées.
Le « pas » est l'indice k de l'état x(k·dt) où l'écart est maximal.

| Kp (N/m) | max \|Δy\| (m) | pas | max \|Δẏ\| (m/s) | pas | max \|Δy\| à dt/2 | rapport y | rapport ẏ |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 150 | 0 | – | 0 | – | 0 | – | – |
| 500 | 1,911e-8 | 13 | 1,684e-7 | 15 | 1,159e-9 | 16,49 | 16,45 |
| 1000 | 4,547e-8 | 12 | 4,341e-7 | 15 | 2,752e-9 | 16,52 | 16,46 |
| 1500 | 6,995e-8 | 11 | 7,162e-7 | 15 | 4,227e-9 | 16,55 | 16,47 |
| 2000 | 9,022e-8 | 15 | 7,820e-7 | 19 | 5,484e-9 | 16,45 | 16,53 |
| 2500 | 9,022e-8 | 15 | 8,114e-7 | 66 | 5,484e-9 | 16,45 | 16,63 |
| 3000 | 9,022e-8 | 15 | 9,780e-7 | 66 | 5,484e-9 | 16,45 | 16,74 |
| 3500 | 9,022e-8 | 15 | 1,132e-6 | 66 | 5,484e-9 | 16,45 | 16,76 |
| 3800 | 9,022e-8 | 15 | 1,214e-6 | 66 | 5,484e-9 | 16,45 | 16,68 |
| 3900 | 9,022e-8 | 15 | 1,248e-6 | 66 | 5,484e-9 | 16,45 | 16,68 |
| 4500 | 9,083e-8 | 58 | 1,420e-6 | 66 | 5,484e-9 | 16,56 | 16,70 |
| 8000 | 1,420e-7 | 84 | 2,311e-6 | 65 | 8,158e-9 | 17,41 | 16,83 |

- Critère « max |Δy| ≤ 1e-6 m » : **PASS pour les 12 Kp**.
- Kp = 150 : la cabine ne décolle pas. Les deux simulations ramènent y à 0 à chaque pas :
  l'écart est nul.
- Pour Kp ≥ 2000, l'écart max sur y est identique (9,022e-8 au pas 15). La commande est
  saturée à +5000 N au départ, donc la trajectoire des premiers pas ne dépend pas de Kp.
- Les écarts sur ẏ dépassent 1e-6 m/s pour Kp ≥ 3500. Le critère ne porte que sur y, mais
  ce chiffre compte si une règle de jeu utilise ẏ (seuil 0,10 m/s : marge de 4·10⁴).
- Tableau de référence de la spec §5 (`reference.test.ts`) comparé à l'oracle exact :
  écarts max 2,9e-7 / 4,7e-7 / 5,6e-7 / 2,5e-7 m pour Kp = 1500 / 2500 / 3500 / 4500. Pas
  saturés identiques (0 / 23 / 30 / 34). Ces valeurs sont donc **justes**, et pas seulement
  cohérentes avec le même algorithme. La marge restante sous la tolérance de 1e-6 n'est
  toutefois que de 4,4e-7 m, dominée par l'arrondi à 6 décimales.

## C. Boucle continue et effet du bloqueur d'ordre zéro

Boucle continue sans saturation, `ode45` (RelTol 1e-10, AbsTol 1e-12). Le pic est détecté
par un événement ẏ = 0.

| Kp | e_ss ode45 (m) | e_ss formule (m) | écart | Mp ode45 | Mp formule | tp ode45 (s) | tp formule (s) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1000 | 0,490500000 | 0,490500000 | 5,4e-15 | 0,1867 % | 0,1867 % | 1,57080 | 1,57080 |
| 2500 | 0,196200000 | 0,196200000 | 8,7e-15 | 11,5890 % | 11,5890 % | 0,53878 | 0,53878 |
| 4000 | 0,122625000 | 0,122625000 | 6,8e-16 | 20,7880 % | 20,7880 % | 0,39270 | 0,39270 |

Les formules de la spec §5 sont **confirmées** (écarts ≤ 8e-10 sur Mp et ≤ 4e-11 s sur tp).

Boucle échantillonnée **exacte** à dt = 1/120, sans saturation. Le dépassement est mesuré
comme dans `oracle.test.ts` : pic des échantillons, relatif au dernier échantillon à 10 s.

| Kp | Mp formule | Mp échantillonné | Δ (points) | Mp entre échantillons | tp échantillonné (s) |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1000 | 0,1867 % | 0,2550 % | +0,068 | 0,2550 % | 1,50833 |
| 1500 | 3,4787 % | 3,8860 % | +0,407 | 3,8860 % | 0,82500 |
| 2000 | 7,6912 % | 8,4002 % | +0,709 | 8,4002 % | 0,63333 |
| 2500 | 11,5890 % | 12,5780 % | +0,989 | 12,5782 % | 0,53333 |
| 3000 | 15,0401 % | 16,2946 % | +1,255 | 16,2963 % | 0,46667 |
| 3500 | 18,0854 % | 19,5966 % | +1,511 | 19,5988 % | 0,42500 |
| 4000 | 20,7880 % | 22,5439 % | +1,756 | 22,5507 % | 0,39167 |
| 5000 | 25,3827 % | 27,6187 % | +2,236 | 27,6242 % | 0,34167 |
| 5500 | 27,3591 % | 29,8077 % | +2,449 | 29,8314 % | 0,32500 |
| 6000 | 29,1640 % | 31,8459 % | **+2,682** | 31,8621 % | 0,30833 |
| 7000 | 32,3520 % | 35,4572 % | **+3,105** | 35,4879 % | 0,28333 |
| 8000 | 35,0920 % | 38,6434 % | **+3,551** | 38,6494 % | 0,25833 |

- Affirmation de la spec « 0 ≤ Δ ≤ 2,5 points » (T3, Kp ∈ {1000, 2500, 4000}) :
  **confirmée** (0,07 / 0,99 / 1,76 point). Les valeurs Mp échantillonné de la spec
  (0,25 / 12,58 / 22,54 %) sont retrouvées.
- Sur toute la plage du curseur, l'affirmation est **infirmée** : Δ > 2,5 points dès
  Kp = 6000, et Δ = 3,55 points à 8000 (D-3).
- tp échantillonné à Kp = 2500 : **0,53333 s**. La valeur « tp_sim = 0,538 s » donnée par
  la spec sous « Mesuré (dt = 1/120) » est en fait la valeur à dt = 1/1000. Coquille déjà
  signalée en T-004, confirmée ici (D-5).

## D. Stabilité de la boucle échantillonnée

Matrice de boucle fermée exacte : A_cl(Kp) = Φ − Γ·Kp·[1 0]. La pesanteur et la consigne
n'entrent que dans le terme constant.

| dt | Kp critique : valeurs propres | Jury det(A_cl) = 1 | forme fermée (1−E)/(g₂(1−E)/a − g₁E) |
| --- | ---: | ---: | ---: |
| 1/60 s | 49 090,6 N/m | 49 090,6 | 49 090,6 |
| **1/120 s** | **97 078,6 N/m** | 97 078,6 | 97 078,6 |
| 1/240 s | 193 072,6 N/m | 193 072,6 | 193 072,6 |

| Kp | rayon spectral | ζ équivalent (discret) | ζ continu | σ = −ln ρ / dt (s⁻¹) |
| ---: | ---: | ---: | ---: | ---: |
| 1000 | 0,967559 | 0,8850 | 0,8944 | 3,957 |
| 2500 | 0,968074 | 0,5508 | 0,5657 | 3,894 |
| 3800 | 0,968520 | 0,4405 | 0,4588 | 3,838 |
| 8000 | 0,969960 | 0,2896 | 0,3162 | 3,660 |
| 20 000 | 0,974060 | 0,1581 | 0,2000 | 3,154 |
| 100 000 | 1,000970 | −0,0026 | 0,0894 | −0,116 |

**Information de conception.** À dt = 1/120, la boucle P est stable jusqu'à
Kp ≈ 97 079 N/m. Le curseur s'arrête à 8000 N/m : **la boucle est stable sur toute sa
plage**, avec une marge de 12,1 en gain. Une instabilité numérique ne peut donc pas être
montrée au joueur avec le curseur actuel. Si l'on veut un jour illustrer l'instabilité due à
l'échantillonnage, il faudrait Kp ≈ 10⁵ N/m ou un dt plus grand (49 091 N/m à 1/60 s).

Contrôle sur le code TS (exécuté, 30 s simulées, sans saturation, Umax = 1e300) :

- Kp = 8000 : |y − y_ss| vaut 6,6e-2 m sur [1 s ; 2 s] et 8,9e-16 m sur [29 s ; 30 s].
  Convergence complète.
- Kp = 96 000 : de 2,86 à 0,86 m. Décroissance lente, stable.
- Kp = 97 000 : de 2,98 à 2,73 m. À peine stable, cohérent avec ρ ≈ 0,99997.
- Kp = 97 200 et 98 000 : amplitude constante d'environ 3,0 m. Instable : l'oscillation
  n'est bornée que par le sol (y_min = 0).

Le code TS bascule donc entre 97 000 et 97 200 N/m, en accord avec les 97 079 N/m de
l'oracle. Avec la saturation de jeu ±5000 N, la boucle reste bornée même à 98 000 N/m
(cycle limite, y ∈ [2,946 ; 3,044] m pendant la dernière seconde).

À noter (D-4) : le taux de décroissance réel σ de la boucle échantillonnée **diminue avec
Kp** : 3,96 s⁻¹ à 1000, 3,66 s⁻¹ à 8000, contre c/(2m) = 4 s⁻¹ en continu. Le message
pédagogique « Kp n'accélère pas la stabilisation » reste vrai, et même un peu plus que vrai.
Mais la propriété testée à 5 % près dans `oracle.test.ts` n'est vérifiée que parce que les
Kp testés s'arrêtent à 4000 (−4,3 %) ; à 8000, l'écart serait de −8,5 %.

## E. Fenêtre de jeu (oracle exact, saturation ±5000 N, 1800 pas)

Règles de la spec §6 évaluées sur l'état après chaque pas :

- **choc** dès que y > 3,30 m ;
- **victoire** au 120e pas consécutif avec |r − y| ≤ 0,25 m et |ẏ| ≤ 0,10 m/s ;
- sinon, à k = 1800 : **ne décolle pas** si Kp ≤ m·g/r, **trop faible** dans les autres cas.

La règle simplifiée de l'ordre de mission (|e| final > 0,25 m ⇒ marche ; y_max > 3,30 m ⇒
choc) donne **exactement les mêmes issues** pour les 80 valeurs de Kp.

| Kp | issue | pas | y_max échantillons (m) | y_max entre échantillons (m) | 3,30 − y_max |
| ---: | --- | ---: | ---: | ---: | ---: |
| 100 | ne décolle pas | 1800 | 0 | 0 | +3300 mm |
| 1500 | trop faible (marche 0,327 m) | 1800 | 2,776871998 | 2,776872023 | +523,1 mm |
| 1900 | trop faible | 1800 | 2,944781737 | 2,944801735 | +355,2 mm |
| **2000** | **victoire** | 311 | 2,979718469 | 2,979748934 | +320,3 mm |
| 2500 | victoire | 291 | 3,116315466 | 3,116318616 | +183,7 mm |
| 3500 | victoire | 278 | 3,266901829 | 3,266967597 | +33,1 mm |
| **3800** | **victoire** | 273 | 3,294158037 | 3,294246946 | **+5,842 mm** |
| **3900** | **choc** | 63 | 3,301864804 | 3,301864839 | **−1,865 mm** |
| 4500 | choc | 58 | 3,338958052 | 3,339170916 | −39,0 mm |
| 8000 | choc | 53 | 3,410114278 | 3,410466158 | −110,1 mm |

- **Fenêtre [2000 ; 3800] confirmée** : 19 valeurs gagnantes, contiguës.
- Bornes continues : la borne basse vaut **1962,00 N/m**, soit m·g/0,25 exactement. La borne
  haute vaut **3875,36 N/m** si l'on juge sur les échantillons, et 3875,28 N/m si l'on juge
  sur le maximum entre échantillons. Ce dernier écart est sans effet avec un curseur au pas
  de 100.
- Pas de victoire : 291 à Kp = 2500 et 278 à 3500, conformes à la spec (« ±1 »).
- Code TS contre oracle sur les 80 valeurs de Kp : **0 désaccord** sur l'issue et sur le pas
  de l'issue. max |y_max TS − y_max exact| = 1,1e-7 m.
- **Robustesse des marges.** À 3800, la marge de 5,842 mm vaut environ 84 000 fois l'écart
  TS/exact (6,96e-8 m). À 3900, le dépassement de 1,865 mm vaut environ 26 000 fois
  l'écart (7,08e-8 m). Les issues ne peuvent pas basculer pour une raison numérique. Une
  modification de la physique (g, m, c, Umax, dt) ou de la règle de choc pourrait en
  revanche faire basculer 3800 (D-11).

## F. Attaques sur le code

Toutes ont été exécutées via des tests Vitest temporaires, supprimés ensuite.
Kp = 2500 sauf mention contraire.

| # | Attaque | Attendu | Observé | Verdict |
| --- | --- | --- | --- | --- |
| F1 | Kp = 0 | reste au sol | y = 0, ẏ = 0 sur 1200 pas | conforme |
| F1 | Kp = −1, NaN, ±Infinity | refus | `RangeError` « kp doit être fini et ≥ 0 » | conforme |
| F1 | Kp = 163 et 164 (seuil 163,5) | 163 au sol, 164 décolle | 163 : y = 0 ; 164 : y(10 s) = 0,00902 m | conforme |
| F1 | Kp = 1e300 et Number.MAX_VALUE | borné par la saturation | 1200/1200 pas saturés ; cycle limite en tout-ou-rien (y ∈ [0,003 ; 3,42] m, ẏ(10 s) = −0,93 m/s) ; uCmd = Infinity sur 35/600 pas, uSat = ±5000, pas de NaN | non spécifié (D-9) |
| F2 | dt = 0, −1/120, NaN, Infinity | refus | `RangeError` « dt doit être fini et > 0 » | conforme |
| F2 | dt = 1e-300 | pas de NaN | y = 0 (le temps n'avance pas), pas de NaN | conforme |
| F2 | dt = 1/7 s, 0,25 s | ? | converge vers y_ss = 2,8038 m | non spécifié |
| F2 | dt = 1 s | refus ou garde de stabilité | **accepté** ; y = 3,7e20 m après 10 pas, aucune erreur, aucun NaN ; sans saturation, 8,7e99 m après 50 pas | **défaut mineur** (D-2) |
| F3 | 1 h simulée (432 000 pas) | pas de dérive ni de NaN | k = 432 000 ; t du dernier pas = 3599,991666666667 s, exact ; \|y − y_ss\| = 4,4e-16 m ; 0 valeur non finie | conforme |
| F3 | horloge : 1 h en images de 1/60 ; 10⁶ images de 1/120 | nombre de pas exact | 432 000 pas, alpha = 0 ; 10⁶ pas, aucune image à 0 ou 2 pas | conforme |
| F3 | horloge : advance(±Infinity) | borné | +Inf → 8 pas, alpha = 0 ; −Inf → 0 pas | conforme |
| F11 | horloge : images de dt·(1 − ε) | dérive négligeable | dérive ≤ 3,9e-4 pas sur 1 h (ε ≤ 9e-10), effet de STEP_EPSILON ; ε = 2e-9 : −0,999 pas, perte normale | conforme |
| F4 | x0 = [−1 ; −5] (sous le sol) via `createClosedLoop` | refus, ou contrainte appliquée d'abord | accepté ; l'échantillon 0 annonce y = −1 m et uCmd = 10 000 N, puis x = [0, 0] après le pas ; `reset()` rétablit x0 = [−1, −5] | non spécifié (D-7) |
| F5 | consigne = −2 m | reste au sol | y = 0, uCmd < 0 non saturé (Kp·(−2) = −5000) | conforme |
| F5 | consigne = NaN | refus | **accepté** ; état NaN dès le pas 0, pour toujours | **défaut mineur** (D-1) |
| F5 | consigne = Infinity ou 1e9 | refus ou borne | accepté ; montée à pleine force (y = 55 m en 5 s), e = Infinity | défaut mineur (D-1) |
| F5b | maxForce = −1, NaN | refus | `RangeError` (bornes invalides) | conforme |
| F5b | maxForce = 0, Infinity | – | 0 : au sol ; Infinity : pas de saturation | conforme |
| F6 | `reset()` après 500 pas (boucle désactivée), puis 1200 pas | identique à une boucle neuve | 0 pas différent, enabled = true | conforme |
| F7 | `setEnabled(false)` au pas 60, `true` au pas 300 | chute amortie puis reprise | y_min = 0,980 m, sol non atteint (vitesse limite m·g/c = 1,23 m/s) ; uSat = 0 pendant l'arrêt ; y final = y_ss | conforme |
| F7b | `reset()` avant tout `step()` | sans effet | k = 0, t = 0, y = 0 | conforme |
| F8 | l'appelant écrit `(s.x as Float64Array)[0] = 100` | interdit par le type | la mesure suivante vaut y = 100 : l'état interne est modifié | non spécifié, documenté (D-8) |
| F8b | l'appelant modifie `sample.k` et `sample.t` | sans effet | k et t corrects au pas suivant | conforme |
| F8c | trois échantillons conservés dans un tableau | (documenté) | un seul et même objet ; k stockés = 2, 2, 2 | conforme à la doc, piège (D-8) |
| F8d | mutation de `ELEVATOR_PARAMS` | refus | `TypeError` (objet gelé) | conforme |
| F8e | mutation de `options.params` après la création | sans effet | trajectoire inchangée (y_max = 3,116315 m) | conforme |
| F8f | consigne impure (compteur) | 1 appel par pas | 10 appels pour 10 pas | conforme |
| F9 | Kp autour du Kp critique | voir D | bascule entre 97 000 et 97 200 N/m | conforme à l'oracle |
| F10 | `recorder.forEach('zz')`, nom invalide | refus | valeurs `undefined` transmises sans erreur (le typage l'interdit) | remarque (D-12) |

## G. Relecture critique de `tests/sim/**`

Analyse de mutation, exécutée : chaque mutant est une copie de `src/sim` et `tests/sim`
dans un dossier temporaire, avec une seule modification. Les 78 tests du noyau sont lancés
sur chaque mutant.

| Mutant | Tests en échec | Qui le détecte |
| --- | ---: | --- |
| M1 RK4 → Euler explicite | 19 / 78 | tests unitaires RK4, références §5, SHA-256, T3 (Kp = 4000), T5, propriété ζωn ; **T1 (5/5), T2 et T4 passent** |
| M2 RK4 → RK2 (point milieu) | 9 / 78 | tests unitaires RK4, références §5, SHA-256 ; **T1–T5 et propriété ζωn passent** |
| M3 `constrain` supprimé | 3 / 78 | contact sol, chute libre, T5 |
| M4 intégration avec uCmd (pas de saturation) | 6 / 78 | références §5, SHA-256, cohérence de LoopSample |
| M5 sol : ẏ = 0 au lieu de max(ẏ, 0) | 1 / 78 | test unitaire de `constrain` uniquement |
| M6 t = (k+1)·dt | 2 / 78 | cohérence de LoopSample, consigne en k·dt |
| M7 g = 9,80665 au lieu de 9,81 | 11 / 78 | T1, dérivée, références, SHA-256 |
| M8 poids de k3 = 2,0001 | 9 / 78 | tests unitaires RK4, références, SHA-256 |

Les 8 mutants sont tués : la suite n'est pas complaisante. Les points faibles :

1. **T1 est insensible à l'intégrateur.** e_ss = m·g/Kp est un point fixe que tout
   intégrateur cohérent conserve exactement. T1 teste la dérivée, pas RK4 : le mutant Euler
   le passe. T2 et T4, à dt = 1/1000, passent aussi avec Euler et RK2. **Aucun test
   d'oracle ne contrôle la trajectoire transitoire à dt = 1/120 contre une solution
   exacte** (D-6).
2. **Les valeurs de référence §5 viennent du même algorithme** (script Python du
   concepteur, puis contre-épreuve de l'orchestrateur, également en RK4). Elles détectent
   une régression, pas une erreur de modèle. T-005 montre qu'elles sont justes à 5,6e-7 m
   près de l'exact. La tolérance de 1e-6 m ne laisse donc que 4,4e-7 m de marge.
3. **Tolérances.** T3 (« ≤ 2,5 points ») et la propriété ζωn (5 %) passent avec des marges
   réelles de 0,74 point et 0,75 % à Kp = 4000. Ces tolérances sont justes pour les Kp
   testés, mais elles sont présentées comme générales alors qu'elles sont fausses à
   Kp = 8000 (D-3, D-4).
4. **Tests partiellement tautologiques.** « LoopSample cohérent » réécrit les formules du
   code (`e = r − y`, `saturated = uSat !== uCmd`) ; il protège l'ordre des opérations, pas
   la physique. Le test « n'alloue pas » de RK4 compte les tampons `out` vus par
   `derivative`. Il est tombé avec les mutants M1 et M2 simplement parce qu'ils appelaient
   `derivative` une seule fois : c'est un effet de bord du mutant, pas une vraie détection.
5. **Cas non couverts malgré 100 % de couverture** : consigne NaN ou infinie ; dt grand
   (stabilité de RK4) ; x0 sous le sol ; Kp ≫ 8000 ; ẏ au contact sol au niveau de la boucle
   (M5 n'est détecté que par le test unitaire) ; issue de jeu à 3800 et 3900 (relève de
   T-007).

## Défauts

| Id | Gravité | Description | Reproduction | Recommandation |
| --- | --- | --- | --- | --- |
| D-1 | mineur | `createElevatorLoop` valide kp, dt et maxForce, mais **pas la consigne** : NaN donne un état NaN définitif dès le pas 0, et Infinity est accepté. | `createElevatorLoop({ kp: 2500, setpoint: NaN })`, puis `step()` : x = [NaN, NaN] | Lever `RangeError` si la consigne n'est pas finie, comme pour kp. |
| D-2 | mineur | Aucun dt maximal : `createElevatorLoop` et `createClosedLoop` acceptent dt = 1 s, et RK4 diverge silencieusement (y = 3,7e20 m en 10 pas, sans NaN ni erreur). | `createElevatorLoop({ kp: 2500, dt: 1 })`, 10 pas | Borner dt, par exemple ≤ 1/30 s, ou documenter que seul SIM_DT est pris en charge. |
| D-3 | remarque (spec) | Spec §5 : « effet du bloqueur ≤ 2,5 points ». C'est vrai pour Kp ≤ 5500, faux au-delà : +3,55 points à 8000. | `t005_C.m`, tableau C2 | Restreindre l'affirmation à Kp ≤ 5000 ou donner la valeur à 8000. |
| D-4 | remarque (spec, test) | La propriété « ζωn = c/(2m) indépendant de Kp » est vraie en continu, mais le σ échantillonné baisse : −8,5 % à 8000. Le test à 5 % ne passe que parce qu'il s'arrête à Kp = 4000 (−4,3 %). | `t005_D.m`, colonne σ | Le documenter ; ne pas étendre ce test à 8000 sans élargir la tolérance. |
| D-5 | remarque (spec) | Coquille : la spec donne tp_sim = 0,538 s « à dt = 1/120 » ; la valeur à 1/120 est 0,53333 s (0,538 est la valeur à 1/1000). | `t005_C.m`, colonne tp_ech | Corriger la spec, comme déjà demandé en T-004. |
| D-6 | mineur (tests) | Aucun test ne compare la trajectoire transitoire à une solution exacte : un mutant RK2 passe tous les tests d'oracle T1–T5. | mutant M2, section G | Ajouter un test d'oracle exact en TS : forme fermée Φ et Γ (`Math.exp` permis dans les tests), 1200 pas, Kp ∈ {500, 2500, 8000}, tolérance 5e-7 m. Valeurs mesurées : ≤ 1,42e-7. |
| D-7 | remarque | x0 sous le sol accepté. Le premier échantillon annonce y < 0 avant la contrainte, et `reset()` rétablit cet état. | F4 | Appliquer `constrain(x0)` à la création, ou lever `RangeError`. |
| D-8 | remarque | L'échantillon est réutilisé, et `x` est le tableau interne : il est modifiable par un simple transtypage. C'est documenté, mais c'est un piège pour T-007 (graphe, détection de choc). | F8, F8c | Rappeler la règle dans T-007 ; éventuellement exposer une copie de x en mode développement. |
| D-9 | remarque | Kp arbitrairement grand accepté. Au-delà d'environ 97 079 N/m, la boucle est instable sans saturation ; avec saturation, elle oscille en cycle limite tout-ou-rien. Inaccessible avec le curseur (≤ 8000). | F1, F9 | Borner kp dans `createElevatorLoop` (par exemple ≤ 20 000) ou le documenter. |
| D-10 | remarque | Valeurs de référence §5 justes, mais avec seulement 4,4e-7 m de marge sous la tolérance de 1e-6 m (arrondi à 6 décimales). | `t005_A_B.m`, dernier bloc | Donner 9 décimales dans la spec et resserrer la tolérance à 2e-7. |
| D-11 | remarque (conception) | Fenêtre [2000 ; 3800] robuste numériquement, mais Kp = 3800 ne gagne que de 5,8 mm. Toute retouche de g, m, c, Umax, dt ou de la règle de choc peut faire basculer cette borne (borne réelle : 3875 N/m). | `t005_E.m` | En T-007, figer les issues à 3800 et 3900 par un test ; relancer `t005_E.m` après chaque retouche de la physique. |
| D-12 | remarque | `forEach` avec un nom de signal invalide transmet `undefined` sans erreur (seul le typage protège). | F10 | Facultatif : `RangeError` sur un nom inconnu. |

## Recommandations

1. Traiter **D-1** et **D-2** : deux validations d'entrée, quelques lignes.
2. Ajouter le **test d'oracle exact (D-6)** dans `tests/sim/`. C'est le seul garde-fou qui
   vérifie que RK4 calcule la bonne trajectoire, et pas seulement le bon point d'équilibre.
3. Corriger la spec §5 (**D-3, D-4, D-5, D-10**).
4. En T-007 : choisir explicitement l'état qui sert à juger le choc et la victoire
   (`sample.y` mesuré avant le pas, ou `sample.x` après le pas ; même maximum, décalé d'un
   pas). Figer les issues à 2000, 3800 et 3900, et ne jamais conserver de référence à
   l'échantillon.
5. Pédagogie : la boucle est stable sur toute la plage du curseur. L'instabilité due à
   l'échantillonnage n'est pas montrable dans ce niveau ; à garder pour un niveau dédié
   (dt plus grand ou retard).

## Doutes et limites

- L'oracle « exact » est calculé en double précision. Son erreur d'arrondi est estimée à
  quelques 1e-15 m (supposé, non mesuré), négligeable devant les écarts de 1e-8 mesurés.
  `expm` et la forme fermée concordent à 2,7e-20.
- Les règles d'issue §6 sont implémentées par moi, en MATLAB et dans l'export TS, car la
  logique de jeu (T-007) n'existe pas encore. Elles sont évaluées sur l'état après chaque
  pas.
- Les CSV et les attaques ont été exécutés sous Linux (VM), Node 22.23.4. Le déterminisme
  entre navigateurs n'a pas été vérifié ici.
