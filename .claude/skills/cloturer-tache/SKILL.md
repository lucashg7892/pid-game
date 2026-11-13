---
name: cloturer-tache
description: Clôture une tâche de PID_GAME une fois son travail terminé : vérification selon le niveau, registre, journal, commit. À utiliser quand une tâche T-xxx ou D-xxx est prête à être validée.
---

# Clôturer une tâche

1. **Niveau.** Retrouve le niveau (N1, N2, N3) annoncé pour la tâche, ou fixe-le avec le tableau de `CLAUDE.md`.
2. **Vérification.** N1 : `npm run lint` et `npm run typecheck`. N2 et N3 : relance toi-même `npm run check` (au premier plan, sous 180 s) et lis le diff avec `git diff`. N3 : fais intervenir le sous-agent `validateur`, puis relance les commandes sur lesquelles repose son verdict.
3. **Résultat.** Vert : continue. Rouge : renvoie la tâche à l'agent avec la sortie utile, puis reprends à l'étape 2. Si l'échec vient d'une consigne mal posée, note une leçon dans la section 4 du registre.
4. **Traces.** N2 et N3 : une ligne dans le tableau de la section 3 de `orchestration/REGISTRE.md`. N3 : le log `orchestration/logs/T-xxx.md` (commandes, verdict, réserves). Les défauts découverts vont dans `orchestration/DEFAUTS-CONNUS.md`.
5. **Documentation.** Si la tâche change un comportement décrit dans `docs/`, lance le sous-agent `redacteur` sur le commit figé de la tâche.
6. **Commit.** Un commit pour la tâche : `T-xxx : résumé en une ligne`. Pas de push sauf demande de l'utilisateur.
