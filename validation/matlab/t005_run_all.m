%T005_RUN_ALL Relance complète de la validation T-005 (points A à E).
%   Depuis la racine du dépôt : run('validation/matlab/t005_run_all.m')
%   Prérequis : MATLAB de base uniquement (expm, ode45, fzero, readmatrix, readtable) ;
%   aucune toolbox. Données d'entrée : validation/data/*.csv (trajectoires du code TS).
ici = fileparts(mfilename('fullpath'));
addpath(ici);
v = ver('MATLAB');
fprintf('MATLAB %s %s — validation T-005\n', v.Version, v.Release);
fprintf('\n===== A + B =====\n');  run(fullfile(ici, 't005_A_B.m'));
fprintf('\n===== C =====\n');      run(fullfile(ici, 't005_C.m'));
fprintf('\n===== D =====\n');      run(fullfile(ici, 't005_D.m'));
fprintf('\n===== E =====\n');      run(fullfile(ici, 't005_E.m'));
fprintf('\nT005 : FIN SANS ERREUR\n');
