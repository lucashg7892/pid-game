# ADR-016 — Contrôleur PI sans anti-windup, validé par tests unitaires seulement

## Contexte

La décision D20 de l'utilisateur ajoute un niveau 2 où le joueur règle Ki, le gain de l'action intégrale. La spec [T-018](../specs/T-018-niveau-2-ascenseur-ki.md) proposait la forme du contrôleur discret, trois options pour le windup (Q2) et une extension de l'oracle MATLAB. Au niveau 1, la fenêtre de victoire sature le moteur dès le départ (l'erreur initiale de 3 m donne Kp·3 > 5000 N dès Kp > 1667 N/m) : avec une intégrale, le windup apparaît donc naturellement. Le niveau 2 a été réalisé sous les noms T-021a (noyau, N3, validateur indépendant) et T-021b (niveau, N2).

## Décision

- **Loi de commande** (`src/sim/controllers/pi.ts`) : `u = Kp·e + I`, avec I la valeur **avant** mise à jour, puis `I ← I + Ki·dt·e` : intégrale « rectangle à gauche », stockée **en newtons** (et non en m·s), pour la comparer directement à la jauge de force et au poids m·g (490,5 N).
- **Pas d'anti-windup** (décision de l'utilisateur). L'intégrale est calculée à partir de l'erreur e, jamais de la commande saturée ; le contrôleur ne voit pas la saturation et accumule pendant qu'elle agit. Le windup se montre par l'échec : à Ki assez grand, le terme I dépasse le poids pendant la saturation et la cabine heurte la poutre.
- **Ki = 0 est identique au P bit à bit** : tant que I vaut exactement 0, `u = Kp·e` est calculé sans addition (ce qui conserve aussi le zéro signé du P). Le niveau 1 et l'empreinte SHA-256 de sa trace ne changent pas.
- **Validation par tests unitaires et de déterminisme seulement.** L'oracle MATLAB du PI (`t018_*.m`) et le test d'oracle exact TypeScript (`tests/sim/pi-exact.test.ts`) sont **reportés** (décision de l'utilisateur, K28).
- **Niveau 2** : Kp fixé à 2500 N/m, Ki réglable de 0 à 8000 N/(m·s) par pas de 100 (mêmes bornes et même pas que Kp), `KI_DEFAULT` = `KP_DEFAULT` = 500 ; même poutre (3,3626 m) et même durée (720 pas, 6 s) que le niveau 1 ; **tolérance d'arrivée égale à celle du niveau 1** : `LEVEL2_ARRIVAL_TOLERANCE` = `STEP_TOLERANCE` = 0,5 m (constante propre au niveau, modifiable d'une seule ligne).
- La jauge du terme intégral, les annotations du windup, la loupe de la tolérance et la courbe I(t) sont reportées (K30, K31) ; l'instantané expose déjà `iTerm`.

## Alternatives écartées

| Option | Raison |
|---|---|
| anti-windup dans le contrôleur (intégration conditionnelle ou rétrocalcul) | supprime le windup à montrer et élargit la fenêtre de Ki ; la leçon serait donnée plus tard. Le contrat reste compatible : l'intégration conditionnelle se coderait dans `update`, le rétrocalcul demanderait une méthode optionnelle appelée par la boucle |
| interrupteur « anti-windup » pour le joueur (comparaison avant et après) | bonne suite pédagogique, mais double le travail (oracle à deux variantes, rendu, interface) |
| intégrale stockée en m·s (`∫e dt`) | moins directement comparable à la jauge de force et au poids ; la forme en newtons donne une boucle fermée linéaire discrète exacte à trois états, utile à un futur oracle |
| tolérance du niveau 2 plus stricte (0,10 m, proposition de la spec) | non retenue : décision de l'utilisateur d'aligner la tolérance sur celle du niveau 1 |

## Conséquences

- Le noyau reste pur et déterministe : `createProportionalIntegralController` et `createElevatorPiLoop` n'ajoutent que `+ − ×` ; empreinte SHA-256 du PI (Kp = 2500, Ki = 1000) figée : `0d9d331a5a4a9df28a188dd71b599a3559bd47ccc04f6d4ab78b7db5b725744b`, celle du P inchangée (`5f85e15a…a821`). 14 tests dans `pi.test.ts` et 4 dans `pi-determinism.test.ts`.
- Mesures de T-021a (Kp = 2500, règles du niveau 1) : Ki gagnants [0 ; 800], chocs [900 ; 8000], aucune fin de temps ; intégrale maximale 582,1 N (Ki 800), 724,8 N (1000), 2829,8 N (4000) ; Ki = 0 identique au P sur 1800 pas.
- **Le PI n'est pas validé par un oracle indépendant** (K28) : la limite de stabilité et le pôle lent de la spec T-018 §4.2 n'ont pas été vérifiés. À faire avant de s'appuyer sur des valeurs de Ki plus fines (tâche N3).
- **K32, point de jeu non résolu** : avec la tolérance de 0,5 m et Kp = 2500, Ki = 0 **gagne** (erreur statique m·g/Kp = 0,196 m < 0,5 m), `KI_DEFAULT` = 500 gagne sans réglage, et les issues « trop court » et « trop lent » ne sont atteintes par aucun Ki de 0 à 8000 : le niveau ne fait pas ressentir l'utilité de Ki. Correctif d'une ligne : `LEVEL2_ARRIVAL_TOLERANCE` à 0,10 m ; mesuré par T-021a, Ki gagnants alors [300 ; 800], fins de temps [0 ; 200], chocs [900 ; 8000], et le défaut de Ki devrait sortir de la fenêtre. C'est une valeur de jeu : décision de l'utilisateur.
- **K29** : la borne de choc de Ki est mince à Kp = 2500 : Ki = 840 passe à 0,384 mm sous la poutre et Ki = 850 la heurte (avec le curseur de 100, seuls 800 et 900 comptent).
- Toute retouche de la poutre, de la tolérance, de Kp ou de la physique déplace ces bornes (voir K7 pour le niveau 1).

Détails : [simulation.md](../simulation.md#contrôleur-pi-t-021a), [physique/ascenseur.md](../physique/ascenseur.md#niveau-2--contrôleur-pi), [jeu.md](../jeu.md#niveau-2--arbitre-et-fin-de-temps), [defauts-connus.md](../defauts-connus.md).

## Statut

Acceptée (T-021a et T-021b ; 2026-11-13).
