%T005_E Point E : fenêtre de jeu avec l'oracle EXACT (saturation ±5000 N, sol, dt = 1/120).
%   Pour Kp = 100..8000 par pas de 100 : issue selon la spec §6 (t005_issue) et règle
%   simplifiée de l'ordre de mission (|e| final > 0,25 m => marche ; y_max > 3,30 m => choc).
%   Comparaison avec l'issue calculée sur les trajectoires TypeScript
%   (validation/data/ts_sweep_summary.csv). Marges à la poutre à Kp = 3800 et 3900.
P = t005_params();
addpath(fileparts(mfilename('fullpath')));
TS = readtable(fullfile(P.root, 'validation', 'data', 'ts_sweep_summary.csv'), 'TextType', 'string');
KPS = 100:100:8000; n = numel(KPS);
issue = strings(n,1); kIss = zeros(n,1); yMax = zeros(n,1); yInt = zeros(n,1);
issueSimple = strings(n,1); nDesaccord = 0; dyMaxTS = zeros(n,1);
for i = 1:n
    S = t005_oracle(P, KPS(i), P.dt, P.kMax, P.Umax);
    [issue(i), kIss(i)] = t005_issue(P, KPS(i), S.y, S.v);
    yMax(i) = max(S.y); yInt(i) = max(S.yInter);
    if KPS(i) <= P.m*P.g/P.r,                    issueSimple(i) = "decolle_pas";
    elseif yMax(i) > P.hPoutre,                  issueSimple(i) = "choc";
    elseif abs(P.r - S.y(end)) > P.tolMarche,    issueSimple(i) = "trop_faible";
    else,                                        issueSimple(i) = "victoire";
    end
    j = find(TS.kp == KPS(i));
    dyMaxTS(i) = abs(TS.y_max(j) - yMax(i));
    if TS.issue(j) ~= issue(i) || TS.k_issue(j) ~= kIss(i), nDesaccord = nDesaccord + 1; end
end
win = KPS(issue == "victoire");
fprintf('E. Fenêtre de victoire (spec §6, oracle exact) : Kp in [%d ; %d], %d valeurs, contiguë : %s\n', ...
    min(win), max(win), numel(win), string(isequal(win, min(win):100:max(win))));
fprintf('   Règle simplifiée (ordre de mission) identique à la règle §6 : %s\n', string(all(issue == issueSimple)));
fprintf('   Désaccords TS / exact (issue ou pas de l''issue) : %d sur %d ; max |y_max TS - exact| = %.3e m\n', ...
    nDesaccord, n, max(dyMaxTS));
fprintf('\n%6s | %-12s %5s | %12s | %12s | %10s\n', 'Kp', 'issue', 'pas', 'y_max éch.', 'y_max inter', '3,30-y_max');
for Kp = [100 200 1500 1800 1900 2000 2100 2500 3500 3700 3800 3900 4000 4500 8000]
    i = find(KPS == Kp);
    fprintf('%6d | %-12s %5d | %12.9f | %12.9f | %+9.3f mm\n', Kp, issue(i), kIss(i), yMax(i), ...
        yInt(i), 1000*(P.hPoutre - yMax(i)));
end
% Bornes continues de la fenêtre (Kp réel) : y_max(Kp) = 3,30 m et premier Kp gagnant.
fy = @(K) max(t005_oracle(P, K, P.dt, P.kMax, P.Umax).y) - P.hPoutre;
KhautEch = fzero(fy, [3800 3900]);
fyi = @(K) max(t005_oracle(P, K, P.dt, P.kMax, P.Umax).yInter) - P.hPoutre;
KhautInt = fzero(fyi, [3800 3900]);
lo = 1900; hi = 2000;
for it = 1:40
    mid = (lo + hi)/2; S = t005_oracle(P, mid, P.dt, P.kMax, P.Umax);
    if t005_issue(P, mid, S.y, S.v) == "victoire", hi = mid; else, lo = mid; end
end
fprintf('\nBorne haute continue (y_max échantillonné = 3,30 m) : Kp = %.2f N/m\n', KhautEch);
fprintf('Borne haute continue (y_max entre échantillons = 3,30 m) : Kp = %.2f N/m\n', KhautInt);
fprintf('Borne basse continue (première victoire §6) : Kp = %.2f N/m (m.g/0,25 = %.1f)\n', hi, P.m*P.g/0.25);
i38 = KPS == 3800; i39 = KPS == 3900;
fprintf('Marge à 3800 : %.3f mm ; à 3900 : %.3f mm ; écart TS/exact sur y_max à 3800 : %.2e m, à 3900 : %.2e m\n', ...
    1000*(P.hPoutre - yMax(i38)), 1000*(P.hPoutre - yMax(i39)), dyMaxTS(i38), dyMaxTS(i39));
