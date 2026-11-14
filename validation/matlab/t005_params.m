function P = t005_params()
%T005_PARAMS Paramètres du modèle de l'ascenseur (spec T-001 §5), unités SI.
%   P = t005_params() renvoie une structure. Rien n'est lu dans le code TypeScript :
%   les valeurs sont recopiées de la spec, pour que l'oracle reste indépendant.
P.m    = 50;      % masse cabine + bonhomme (kg)
P.g    = 9.81;    % pesanteur (m/s^2)
P.c    = 400;     % frottement visqueux (N.s/m)
P.Umax = 5000;    % saturation moteur (N)
P.r    = 3;       % consigne (m)
P.dt   = 1/120;   % pas d'échantillonnage du jeu (s)
P.hPoutre = 3.3626; % poutre : y > 3,3626 m => choc (m), T-020
P.tolMarche = 0.5;    % marche franchissable (m), T-020
P.tolVitesse = 0.10;  % |dy/dt| max pour la victoire (m/s)
P.nVictoire = 120;    % pas consécutifs requis pour la victoire
P.kMax = 1200;        % horizon du niveau (pas) = 10 s, T-022 (D27)
% Racine du dépôt, déduite de l'emplacement de ce fichier (validation/matlab/).
P.root = fileparts(fileparts(fileparts(mfilename('fullpath'))));
end
