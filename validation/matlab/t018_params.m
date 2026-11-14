function P = t018_params()
%T018_PARAMS Paramètres du niveau 2 « La mémoire » (contrôleur PI, spec T-018), unités SI.
%   P = t018_params() renvoie une structure. Rien n'est lu dans le code TypeScript ni dans
%   t005_params : les valeurs sont recopiées de la spec T-018 et des décisions D27 à D29
%   (log T-022), pour que l'oracle reste indépendant. Mêmes noms de champs que t005_params
%   pour la physique, afin de réutiliser t005_zoh.
% Physique de l'ascenseur (spec T-001 §5, T-018 §4.1).
P.m    = 50;      % masse cabine + bonhomme (kg)
P.g    = 9.81;    % pesanteur (m/s^2)
P.c    = 400;     % frottement visqueux (N.s/m)
P.Umax = 5000;    % saturation moteur, symétrique (N)
P.r    = 3;       % consigne (m)
P.dt   = 1/120;   % pas d'échantillonnage du jeu (s)
% Contrôleur du niveau 2 (spec T-018 §3.1, décision Q1) : u = Kp.e + I, I <- I + Ki.dt.e.
P.Kp   = 2500;    % gain proportionnel fixé du niveau 2 (N/m)
P.KiMax  = 8000;  % borne haute du curseur de Ki (N/(m.s))
P.KiStep = 100;   % pas du curseur de Ki (N/(m.s))
% Règles d'issue du niveau 2 (T-018 §5.2 ; D27, D29 ; écarts de réalisation : pas de noLift,
% pas d'oscillation). Ordre d'évaluation après chaque pas : choc, victoire, fin de temps.
P.hPoutre    = 3.3626; % poutre : y > 3,3626 m => choc (m), T-020
P.tol        = 0.10;   % tolérance d'arrivée du niveau 2 (m), D29
P.tolVitesse = 0.10;   % |dy/dt| max pour la victoire (m/s)
P.nVictoire  = 120;    % pas consécutifs requis pour la victoire
P.kMax       = 1200;   % horizon (pas) = 10 s, D27 ; fin de temps : 'step' si |r-y| > tol, sinon 'slow'
% Racine du dépôt, déduite de l'emplacement de ce fichier (validation/matlab/).
P.root = fileparts(fileparts(fileparts(mfilename('fullpath'))));
end
