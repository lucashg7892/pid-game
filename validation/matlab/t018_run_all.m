%T018_RUN_ALL Relance complète de la validation du contrôleur PI (T-023, spec T-018 §8).
%   Depuis la racine du dépôt : run('validation/matlab/t018_run_all.m')
%   Prérequis : MATLAB de base uniquement (expm, fzero, eig, poly, readmatrix, readtable) ;
%   aucune toolbox. Données d'entrée : validation/data/pi_*.csv (noyau TypeScript).
%   Chaque point s'arrête sur une erreur (assert) si un critère n'est pas tenu : la dernière
%   ligne « T018 : FIN SANS ERREUR » n'est affichée que si tout est vérifié.
ici = fileparts(mfilename('fullpath'));
addpath(ici);
v = ver('MATLAB');
fprintf('MATLAB %s %s — validation T-018 (contrôleur PI)\n', v.Version, v.Release);
fprintf('\n===== A : trajectoires TS / exact =====\n');      run(fullfile(ici, 't018_A.m'));
fprintf('\n===== Phases : forme fermée par morceaux =====\n'); run(fullfile(ici, 't018_phases.m'));
fprintf('\n===== Stabilité échantillonnée =====\n');          run(fullfile(ici, 't018_stability.m'));
fprintf('\n===== Fenêtre de Ki =====\n');                     run(fullfile(ici, 't018_window.m'));
fprintf('\nT018 : FIN SANS ERREUR\n');
