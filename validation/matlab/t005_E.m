%T005_E Point E : fenêtre de jeu avec l'oracle EXACT (saturation ±5000 N, sol, dt = 1/120).
%   Pour Kp = 100..8000 par pas de 100 : issue selon la spec §6 (t005_issue) et règle
%   simplifiée de l'ordre de mission (|e| final > tolérance de marche => marche ; y_max > poutre
%   => choc). Comparaison avec l'issue calculée sur les trajectoires TypeScript
%   (validation/data/ts_sweep_summary.csv). Règles d'issue de T-020 (t005_params) : poutre
%   3,3626 m, marche 0,5 m, horizon 720 pas. Marges à la poutre à Kp = 5000 et 5100.
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
fprintf('E. Règles : poutre %.4f m, marche %.2f m, horizon %d pas (%.1f s)\n', ...
    P.hPoutre, P.tolMarche, P.kMax, P.kMax*P.dt);
fprintf('E. Fenêtre de victoire (spec §6, oracle exact) : Kp in [%d ; %d], %d valeurs, contiguë : %s\n', ...
    min(win), max(win), numel(win), string(isequal(win, min(win):100:max(win))));
fprintf('   Règle simplifiée (ordre de mission) identique à la règle §6 : %s\n', string(all(issue == issueSimple)));
fprintf('   Désaccords TS / exact (issue ou pas de l''issue) : %d sur %d ; max |y_max TS - exact| = %.3e m\n', ...
    nDesaccord, n, max(dyMaxTS));
fprintf('   Victoire la plus lente : pas %d (Kp = %s) ; marge avant l''horizon : %d pas\n', ...
    max(kIss(issue == "victoire")), strjoin(string(KPS(issue == "victoire" & kIss == max(kIss(issue == "victoire")))), ', '), ...
    P.kMax - max(kIss(issue == "victoire")));
fprintf('\n%6s | %-12s %5s | %12s | %12s | %10s\n', 'Kp', 'issue', 'pas', 'y_max éch.', 'y_max inter', 'poutre-y_max');
for Kp = [100 200 800 900 1000 1100 2500 3800 4000 4900 5000 5100 5200 6000 8000]
    i = find(KPS == Kp);
    fprintf('%6d | %-12s %5d | %12.9f | %12.9f | %+9.3f mm\n', Kp, issue(i), kIss(i), yMax(i), ...
        yInt(i), 1000*(P.hPoutre - yMax(i)));
end
% Bornes continues de la fenêtre (Kp réel) : y_max(Kp) = poutre et premier Kp gagnant.
fy = @(K) max(t005_oracle(P, K, P.dt, P.kMax, P.Umax).y) - P.hPoutre;
KhautEch = fzero(fy, [5000 5100]);
fyi = @(K) max(t005_oracle(P, K, P.dt, P.kMax, P.Umax).yInter) - P.hPoutre;
KhautInt = fzero(fyi, [4900 5100]);
lo = 900; hi = 1000;
for it = 1:40
    mid = (lo + hi)/2; S = t005_oracle(P, mid, P.dt, P.kMax, P.Umax);
    if t005_issue(P, mid, S.y, S.v) == "victoire", hi = mid; else, lo = mid; end
end
fprintf('\nBorne haute continue (y_max échantillonné = poutre) : Kp = %.2f N/m\n', KhautEch);
fprintf('Borne haute continue (y_max entre échantillons = poutre) : Kp = %.2f N/m\n', KhautInt);
fprintf('Borne basse continue (première victoire §6) : Kp = %.2f N/m (m.g/tolérance = %.1f)\n', hi, P.m*P.g/P.tolMarche);
i50 = KPS == 5000; i51 = KPS == 5100;
fprintf('Marge à 5000 : %.3f mm ; dépassement à 5100 : %.3f mm ; écart TS/exact sur y_max à 5000 : %.2e m, à 5100 : %.2e m\n', ...
    1000*(P.hPoutre - yMax(i50)), 1000*(yMax(i51) - P.hPoutre), dyMaxTS(i50), dyMaxTS(i51));
fprintf('Marge de tolérance à Kp = 1000 : tolérance - m.g/Kp = %.3f mm\n', 1000*(P.tolMarche - P.m*P.g/1000));
