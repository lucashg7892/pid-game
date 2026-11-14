%T018_WINDOW Fenêtre de Ki du niveau 2 avec l'oracle EXACT (Kp = 2500, saturation ±5000 N,
%   sol, dt = 1/120, 1200 pas, règles de t018_issue). Balayage Ki = 0..8000 par pas de 100
%   (grille du curseur) et points fins Ki = 120..140 et 840..850 par pas de 1, comparé au
%   balayage du noyau TypeScript (validation/data/pi_sweep_summary.csv, issue calculée par
%   l'arbitre du jeu createOutcomeJudge2). Exige 0 désaccord sur l'issue et le pas de l'issue.
%   Puis bornes continues de Ki et marges de part et d'autre (leçon D-11 de T-005).
P = t018_params();
addpath(fileparts(mfilename('fullpath')));
TS = readtable(fullfile(P.root, 'validation', 'data', 'pi_sweep_summary.csv'), 'TextType', 'string');
KIS = TS.ki'; n = numel(KIS);
issue = strings(n,1); kIss = zeros(n,1); yMax = zeros(n,1); kYmax = zeros(n,1); yInt = zeros(n,1);
iMax = zeros(n,1); nSat = zeros(n,1); kStar = zeros(n,1); yFin = zeros(n,1); iFin = zeros(n,1);
for i = 1:n
    S = t018_pi_oracle(P, P.Kp, KIS(i), P.dt, P.kMax, P.Umax);
    [issue(i), kIss(i)] = t018_issue(P, S.y, S.v);
    [yMax(i), kYmax(i)] = max(S.y); kYmax(i) = kYmax(i) - 1;
    yInt(i) = max(S.yInter); iMax(i) = max(S.I); nSat(i) = sum(S.sat); kStar(i) = find(~S.sat, 1);
    yFin(i) = S.y(end); iFin(i) = S.I(end);
end
grille = mod(KIS', P.KiStep) == 0;
desIss = (TS.issue ~= issue) | (TS.k_issue ~= kIss);
desAux = (TS.sat_steps ~= nSat) | (TS.k_star ~= kStar) | (TS.k_ymax ~= kYmax);
fprintf('Règles : poutre %.4f m, tolérance %.2f m, |dy/dt| <= %.2f m/s pendant %d pas, horizon %d pas\n', ...
    P.hPoutre, P.tol, P.tolVitesse, P.nVictoire, P.kMax);
fprintf('Désaccords TS / exact (issue ou pas de l''issue) : %d sur %d (grille de %d : %d ; points fins : %d)\n', ...
    sum(desIss), n, P.KiStep, sum(desIss & grille), sum(desIss & ~grille));
fprintf('Désaccords sur pas saturés, k* ou pas du pic : %d ; max |y_max TS - exact| = %.3e m ; max |I_max TS - exact| = %.3e N\n', ...
    sum(desAux), max(abs(TS.y_max - yMax)), max(abs(TS.i_max - iMax)));
fprintf('max |y(1200) TS - exact| = %.3e m ; max |I(1200) TS - exact| = %.3e N\n', ...
    max(abs(TS.y_final - yFin)), max(abs(TS.i_final - iFin)));

% Plages d'issues contiguës.
plages = @(sel) decrire(KIS(sel), issue(sel));
fprintf('\nGrille (pas de %d) : %s\n', P.KiStep, plages(grille));
fprintf('Points fins 120..140 : %s\n', plages(KIS' >= 120 & KIS' <= 140 & ~grille | ismember(KIS', [100 200])));
fprintf('Points fins 840..850 : %s\n', plages(KIS' >= 840 & KIS' <= 850 & ~grille | ismember(KIS', [800 900])));
w = issue == "win" & grille;
fprintf('Victoire la plus lente sur la grille : pas %d (Ki = %s), marge avant l''horizon %d pas\n', ...
    max(kIss(w)), strjoin(string(KIS(w & kIss == max(kIss(w)))), ', '), P.kMax - max(kIss(w)));
wf = issue == "win";
fprintf('Victoire la plus lente, tous points : pas %d (Ki = %s)\n', max(kIss(wf)), ...
    strjoin(string(KIS(wf & kIss == max(kIss(wf)))), ', '));

fprintf('\n%6s | %-5s %5s | %12s %5s | %12s | %10s | %10s | %4s %4s | %10s\n', 'Ki', 'issue', 'pas', ...
    'y_max éch.', 'pas', 'y_max inter', 'poutre-y', 'I_max N', 'sat', 'k*', '|r-y(1200)|');
for Ki = [0 100 120 128 129 130 139 140 200 500 800 840 849 850 900 1000 2000 4000 8000]
    i = find(KIS == Ki);
    fprintf('%6d | %-5s %5d | %12.9f %5d | %12.9f | %+7.3f mm | %10.4f | %4d %4d | %10.6f\n', Ki, ...
        issue(i), kIss(i), yMax(i), kYmax(i), yInt(i), 1000*(P.hPoutre - yMax(i)), iMax(i), nSat(i), ...
        kStar(i), abs(P.r - yFin(i)));
end

% Bornes continues de Ki (réel), oracle exact.
fy  = @(K) max(t018_pi_oracle(P, P.Kp, K, P.dt, P.kMax, P.Umax).y) - P.hPoutre;
fyi = @(K) max(t018_pi_oracle(P, P.Kp, K, P.dt, P.kMax, P.Umax).yInter) - P.hPoutre;
KiChoc = fzero(fy, [840 850]); KiChocInt = fzero(fyi, [800 850]);
fe = @(K) abs(P.r - t018_pi_oracle(P, P.Kp, K, P.dt, P.kMax, P.Umax).y(end)) - P.tol;
KiStepSlow = fzero(fe, [120 130]);
lo = 130; hi = 140;                                % 130 : slow, 140 : win
for it = 1:40
    mid = (lo + hi)/2; S = t018_pi_oracle(P, P.Kp, mid, P.dt, P.kMax, P.Umax);
    if t018_issue(P, S.y, S.v) == "win", hi = mid; else, lo = mid; end
end
KiWinBas = hi;
fprintf('\nBornes continues (oracle exact) :\n');
fprintf('  step -> slow (|r - y(1200)| = tolérance)          : Ki = %.4f N/(m.s)\n', KiStepSlow);
fprintf('  première victoire (borne basse de la fenêtre)     : Ki = %.4f N/(m.s)\n', KiWinBas);
fprintf('  choc (y_max échantillonné = poutre, borne haute)  : Ki = %.4f N/(m.s)\n', KiChoc);
fprintf('  choc si on regardait y entre les échantillons     : Ki = %.4f N/(m.s)\n', KiChocInt);
dTS = abs(TS.y_max - yMax);
for Ki = [800 840 850 900]
    i = find(KIS == Ki);
    fprintf('  Ki = %4d : poutre - y_max = %+8.3f mm ; écart TS/exact sur y_max %.2e m ; rapport marge/écart %.1e\n', ...
        Ki, 1000*(P.hPoutre - yMax(i)), dTS(i), abs(P.hPoutre - yMax(i))/dTS(i));
end
for Ki = [100 120 130 140 200]
    i = find(KIS == Ki);
    fprintf('  Ki = %4d : %-5s au pas %4d ; |r - y(1200)| - tolérance = %+8.3f mm ; écart TS/exact sur y(1200) %.2e m\n', ...
        Ki, issue(i), kIss(i), 1000*(abs(P.r - yFin(i)) - P.tol), abs(TS.y_final(i) - yFin(i)));
end
fprintf('  Marges en Ki autour de la grille : borne basse %.2f au-dessus de 100 et %.2f sous 200 ; borne haute %.2f au-dessus de 800 et %.2f sous 900\n', ...
    KiWinBas - 100, 200 - KiWinBas, KiChoc - 800, 900 - KiChoc);
assert(sum(desIss) == 0, 'T018 fenêtre : %d désaccords TS / exact', sum(desIss));
assert(sum(desAux) == 0, 'T018 fenêtre : désaccord sur pas saturés, k* ou pas du pic');

function s = decrire(K, iss)
% Résume une suite de Ki triés en plages d'issues identiques : « 0-100 step | 200-800 win | ... ».
s = ""; d = 1;
for i = 2:numel(K)+1
    if i > numel(K) || iss(i) ~= iss(d)
        if K(i-1) == K(d), p = sprintf('%d', K(d)); else, p = sprintf('%d-%d', K(d), K(i-1)); end
        s = s + sprintf('%s %s', p, iss(d)); if i <= numel(K), s = s + " | "; end
        d = i;
    end
end
end
