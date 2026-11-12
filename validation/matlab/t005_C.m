%T005_C Point C : boucle CONTINUE (ode45) contre formules de la spec §5, puis effet du
%   bloqueur d'ordre zéro à dt = 1/120 s (boucle échantillonnée exacte), sans saturation.
%   Le dépassement est relatif à l'amplitude y_ss - y0 (définition de la spec §5).
P = t005_params();
addpath(fileparts(mfilename('fullpath')));
opts = odeset('RelTol', 1e-10, 'AbsTol', 1e-12, 'Events', @evPic);
fprintf('C1. Boucle continue sans saturation, ode45 (RelTol 1e-10, AbsTol 1e-12), T = 10 s\n');
fprintf('%5s | %12s %12s %9s | %9s %9s %9s | %8s %8s %9s\n', 'Kp', 'e_ss ode45', 'e_ss ana', ...
    'écart', 'Mp ode45', 'Mp ana', 'écart pt', 'tp ode45', 'tp ana', 'écart s');
for Kp = [1000 2500 4000]
    f = @(t, x) [x(2); (Kp*(P.r - x(1)) - P.m*P.g - P.c*x(2))/P.m];
    [~, X, te, xe] = ode45(f, [0 10], [0; 0], opts);
    yss = P.r - P.m*P.g/Kp;
    z = P.c/(2*sqrt(Kp*P.m)); wn = sqrt(Kp/P.m);
    MpA = exp(-z*pi/sqrt(1-z^2)); tpA = pi/(wn*sqrt(1-z^2));
    eS = P.r - X(end,1);
    MpS = (xe(1,1) - yss)/yss; tpS = te(1);   % premier passage de dy/dt par 0 (pic)
    fprintf('%5d | %12.9f %12.9f %9.2e | %8.4f%% %8.4f%% %9.2e | %8.5f %8.5f %9.2e\n', Kp, eS, ...
        P.m*P.g/Kp, abs(eS - P.m*P.g/Kp), 100*MpS, 100*MpA, 100*abs(MpS-MpA), tpS, tpA, abs(tpS-tpA));
end

fprintf('\nC2. Effet du bloqueur d''ordre zéro (boucle échantillonnée EXACTE, dt = 1/120, sans saturation)\n');
fprintf('    Mp_ech : pic des ÉCHANTILLONS (comme le jeu et oracle.test.ts), relatif au dernier échantillon à 10 s\n');
fprintf('    Mp_inter : pic EXACT entre échantillons ; tp_ech : instant de l''échantillon du pic\n');
fprintf('%5s | %8s %8s %8s | %9s %9s | %8s\n', 'Kp', 'Mp ana', 'Mp_ech', 'Mp_inter', 'écart ech', ...
    'écart int', 'tp_ech');
KPS = 1000:500:8000; dMp = zeros(size(KPS));
for i = 1:numel(KPS)
    Kp = KPS(i);
    S = t005_oracle(P, Kp, P.dt, 1200, Inf);
    yss = S.y(end);
    z = P.c/(2*sqrt(Kp*P.m)); MpA = exp(-z*pi/sqrt(1-z^2));
    [yp, kp] = max(S.y); MpE = (yp - yss)/yss; MpI = (max(S.yInter) - yss)/yss;
    dMp(i) = 100*(MpE - MpA);
    fprintf('%5d | %7.4f%% %7.4f%% %7.4f%% | %8.4fpt %8.4fpt | %8.5f\n', Kp, 100*MpA, 100*MpE, ...
        100*MpI, dMp(i), 100*(MpI - MpA), (kp-1)*P.dt);
end
fprintf('Affirmation spec T3 (0 <= écart <= 2,5 pt) pour Kp in {1000,2500,4000} : %s\n', ...
    string(all(dMp(ismember(KPS,[1000 2500 4000])) >= 0 & dMp(ismember(KPS,[1000 2500 4000])) <= 2.5)));
fprintf('Plus grand Kp du balayage tel que écart <= 2,5 pt : %d ; écart à Kp = 8000 : %.3f pt\n', ...
    max(KPS(dMp <= 2.5)), dMp(end));

function [val, term, dir] = evPic(~, x)
% Événement : dy/dt passe par 0 en décroissant (maximum local de y) ; le premier est le pic.
val = x(2); term = 0; dir = -1;   % non terminal : on intègre jusqu'à 10 s
end
