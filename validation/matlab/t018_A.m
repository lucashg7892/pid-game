%T018_A Point A de la validation du PI (T-023) : trajectoires du noyau TypeScript contre
%   l'oracle EXACT (t018_pi_oracle), au pas par pas, sur 1200 pas (10 s) à Kp = 2500.
%   Données : validation/data/pi_traj_dt120.csv (colonnes y, v, i, ucmd, usat, sat par Ki ;
%   ligne k = état après k pas ; ucmd, usat, sat = commande du k-ième pas, NaN à la ligne 0).
%   Critères (spec T-018 §8) : |dy| <= 1e-6 m, |dI| <= 1e-3 N à chaque pas ; drapeau saturé,
%   nombre de pas saturés, pas de sortie de saturation k*, pas du pic et issue identiques.
%   Exécutable tel quel : run('validation/matlab/t018_A.m') depuis la racine du dépôt.
P = t018_params();
addpath(fileparts(mfilename('fullpath')));
fichier = fullfile(P.root, 'validation', 'data', 'pi_traj_dt120.csv');
fid = fopen(fichier, 'r'); entete = strsplit(fgetl(fid), ','); fclose(fid);
T = readmatrix(fichier, 'NumHeaderLines', 1);
N = P.kMax;
if size(T,1) ~= N+1, error('CSV PI : %d lignes, %d attendues', size(T,1), N+1); end
colY = find(startsWith(entete, 'y_'));
KIS = cellfun(@(s) str2double(s(3:end)), entete(colY));
fprintf('A. Kp = %d N/m, dt = 1/%d s, %d pas ; Ki du CSV : %s\n', P.Kp, round(1/P.dt), N, ...
    strjoin(string(KIS), ', '));

[~, ~, infoZ] = t005_zoh(P, P.dt);
fprintf('   Discrétisation exacte : écart max expm / forme fermée = %.3e\n', infoZ.ecartFormeFermee);

n = numel(KIS);
R = zeros(n, 12);
issueTS = strings(n,1); issueEx = strings(n,1); kTS = zeros(n,1); kEx = zeros(n,1);
for i = 1:n
    c = colY(i);
    yT = T(:,c); vT = T(:,c+1); iT = T(:,c+2);
    ucT = T(2:end,c+3); usT = T(2:end,c+4); satT = T(2:end,c+5) == 1;
    S = t018_pi_oracle(P, P.Kp, KIS(i), P.dt, N, P.Umax);
    dy = max(abs(yT - S.y)); dv = max(abs(vT - S.v)); dI = max(abs(iT - S.I));
    duc = max(abs(ucT - S.uc)); dus = max(abs(usT - S.us));
    nFlag = sum(satT ~= S.sat);
    kStarT = find(~satT, 1); kStarE = find(~S.sat, 1);
    [ymT, kmT] = max(yT); [ymE, kmE] = max(S.y);
    [issueTS(i), kTS(i)] = t018_issue(P, yT, vT);
    [issueEx(i), kEx(i)] = t018_issue(P, S.y, S.v);
    R(i,:) = [KIS(i), dy, dv, dI, duc, dus, nFlag, sum(satT), sum(S.sat), kStarT - kStarE, ...
        kmT - kmE, abs(ymT - ymE)];
    if S.sol > 0, fprintf('   (Ki = %d : contrainte de sol active sur %d pas)\n', KIS(i), S.sol); end
end
fprintf('\n%6s | %10s %10s %10s | %10s %10s | %5s %9s | %4s %4s | %10s | %-5s %5s | %-5s %5s\n', ...
    'Ki', 'max|dy| m', 'max|dv|', 'max|dI| N', 'max|duc| N', 'max|dus| N', 'drap', 'sat TS/ex', ...
    'dk*', 'dkpic', '|dy_max| m', 'issTS', 'pas', 'issEx', 'pas');
for i = 1:n
    fprintf('%6d | %10.3e %10.3e %10.3e | %10.3e %10.3e | %5d %4d/%4d | %4d %4d | %10.3e | %-5s %5d | %-5s %5d\n', ...
        R(i,1), R(i,2), R(i,3), R(i,4), R(i,5), R(i,6), R(i,7), R(i,8), R(i,9), R(i,10), R(i,11), ...
        R(i,12), issueTS(i), kTS(i), issueEx(i), kEx(i));
end
[wy, iy] = max(R(:,2)); [wv, iv] = max(R(:,3)); [wI, iI] = max(R(:,4)); [wu, iu] = max(R(:,5));
fprintf('\nPire écart TS / exact : |dy| %.3e m (Ki = %d), |dv| %.3e m/s (Ki = %d), |dI| %.3e N (Ki = %d), |duc| %.3e N (Ki = %d)\n', ...
    wy, R(iy,1), wv, R(iv,1), wI, R(iI,1), wu, R(iu,1));
okA = all(R(:,2) <= 1e-6) && all(R(:,4) <= 1e-3) && all(R(:,7) == 0) && all(R(:,8) == R(:,9)) ...
    && all(R(:,10) == 0) && all(R(:,11) == 0) && all(issueTS == issueEx) && all(kTS == kEx);
fprintf('Critère A (|dy| <= 1e-6 m, |dI| <= 1e-3 N, drapeaux, k*, pic et issues identiques) : %s\n', string(okA));
assert(okA, 'T018 A : écart TS / exact hors critères');
