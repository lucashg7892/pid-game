%T005_A_B Points A et B de la validation T-005.
%   A : oracle EXACT (expm, bloqueur d'ordre zéro, saturation, sol) pour 12 valeurs de Kp.
%   B : comparaison avec les trajectoires exportées du code TypeScript
%       (validation/data/ts_traj_dt120.csv et ts_traj_dt240.csv), puis contrôle de l'ordre
%       de convergence : si l'écart vient de RK4, il doit être divisé par ~16 quand dt -> dt/2.
%   Exécutable tel quel : run('validation/matlab/t005_A_B.m') depuis la racine du dépôt.
P = t005_params();
addpath(fileparts(mfilename('fullpath')));
KPS = [150 500 1000 1500 2000 2500 3000 3500 3800 3900 4500 8000];

% Contrôle croisé de la discrétisation : expm contre forme fermée.
[~, ~, infoZ] = t005_zoh(P, P.dt);
fprintf('A. Discrétisation exacte : écart max expm / forme fermée = %.3e\n', infoZ.ecartFormeFermee);

res = zeros(numel(KPS), 9);
for d = [120 240]
    h = 1/d; N = 10*d;                    % 10 s simulées
    T = readmatrix(fullfile(P.root, 'validation', 'data', sprintf('ts_traj_dt%d.csv', d)), ...
        'NumHeaderLines', 1);
    if size(T,1) ~= N+1, error('CSV dt=1/%d : %d lignes, %d attendues', d, size(T,1), N+1); end
    for i = 1:numel(KPS)
        S = t005_oracle(P, KPS(i), h, N, P.Umax);
        yT = T(:, 2*i); vT = T(:, 2*i+1);
        [ey, ky] = max(abs(yT - S.y));
        [ev, kv] = max(abs(vT - S.v));
        if d == 120
            res(i,1:5) = [KPS(i), ey, ky-1, ev, kv-1];
        else
            res(i,6:7) = [ey, ev];
        end
    end
end
res(:,8) = res(:,2)./res(:,6);   % rapport des écarts sur y, dt/(dt/2)
res(:,9) = res(:,4)./res(:,7);   % idem sur dy/dt
fprintf('\nB. Écart TS (RK4) / oracle exact, 10 s simulées\n');
fprintf('%6s | %11s %6s | %11s %6s | %11s %11s | %7s %7s\n', 'Kp', 'max|dy| m', 'pas', ...
    'max|dv| m/s', 'pas', 'dy dt/2', 'dv dt/2', 'ratio y', 'ratio v');
for i = 1:numel(KPS)
    fprintf('%6d | %11.3e %6d | %11.3e %6d | %11.3e %11.3e | %7.2f %7.2f\n', res(i,1), ...
        res(i,2), res(i,3), res(i,4), res(i,5), res(i,6), res(i,7), res(i,8), res(i,9));
end
fprintf('Critère B (max|dy| <= 1e-6 m pour tout Kp) : %s ; pire écart %.3e m (Kp = %d)\n', ...
    string(all(res(:,2) <= 1e-6)), max(res(:,2)), res(find(res(:,2) == max(res(:,2)), 1), 1));

% Contrôle du tableau de référence de la spec §5 (configuration de jeu) contre l'oracle exact.
REF = [1500 2.430138 2.747366 2.671735 2.673000 2.776872 0
       2500 3.033662 2.784761 2.804005 2.803800 3.116315 23
       3500 3.236641 2.782849 2.858821 2.859857 3.266902 30
       4500 3.329140 2.825564 2.892738 2.891000 3.338958 34];
fprintf('\nTableau de référence spec §5 contre oracle exact (10 s) :\n');
for i = 1:size(REF,1)
    S = t005_oracle(P, REF(i,1), P.dt, 1200, P.Umax);
    ex = [S.y([60 120 240 600]+1)' max(S.y)];
    fprintf('  Kp = %4d : écart max %.2e m (tolérance 1e-6) ; pas saturés exact %d / spec %d\n', ...
        REF(i,1), max(abs(ex - REF(i,2:6))), sum(S.sat), REF(i,7));
end
