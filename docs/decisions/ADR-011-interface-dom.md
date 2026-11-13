# ADR-011 — Interface en DOM superposé, pilotée par un modèle de vue pur

## Contexte

Le joueur doit lire les touches, régler Kp, comprendre l'issue, en français ou en anglais (D3). L'interface doit être accessible (clavier, lecteur d'écran, spec T-001 §8). L'essai de l'utilisateur sur son PC (D16) a montré que, sans texte, on oublie les touches.

## Décision

- Textes et contrôles en **HTML posé sur le canvas** (`src/ui/overlay.ts`), construits une fois.
- Un **modèle de vue pur** (`view-model.ts`) traduit « instantané + langue + état de l'UI » en textes à afficher. Une **disposition pure** (`layout.ts`) place les panneaux hors de la cage, de la console et du bonhomme. Le DOM n'est écrit que si une valeur change.
- Les touches passent par une fonction pure (`keyToIntent`) testée sous Node.
- `src/ui` n'importe que `src/game` et `src/i18n` ; les positions à l'écran calculées par le rendu lui sont passées comme données par `src/main.ts`.
- Police manuscrite Patrick Hand (OFL 1.1), auto-hébergée (D10).

## Alternatives écartées

| Option | Raison |
|---|---|
| textes dessinés dans la scène three (textures de texte, SDF) | invisibles pour les lecteurs d'écran ; traduction et retour à la ligne à refaire ; pas de champ ni de curseur natifs |
| bibliothèque d'interface (framework) | dépendance et poids pour une vingtaine d'éléments ; le rendu à chaque image demande un contrôle fin des écritures |
| interface qui lit directement le rendu | violerait la règle `ui-deps` et couplerait deux modules qui évoluent séparément |

## Conséquences

- Accessibilité testée en e2e (noms accessibles, ordre de tabulation, focus visible, `aria-live`) en français et en anglais.
- Textes exacts des bandeaux et messages testés sous Node, dans les deux langues.
- Les ancres écran ont une image de retard (mise à jour de l'UI avant le dessin), invisible pour des étiquettes.
- Les boutons tactiles n'ont pas été essayés sur un vrai écran tactile.

Détails : [interface.md](../interface.md).

## Statut

Accepté (T-010 ; 2026-11-13).
