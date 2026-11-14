%T018_PHASES Contrôle croisé de l'oracle PI par raisonnement par morceaux (spec T-018 §8),
%   sans la récurrence pas à pas de t018_pi_oracle :
%   1. phase saturée au départ (u >= Umax, force nette F = Umax - m.g constante, départ au
%      repos) : forme fermée y(t) = (F/c).(t - (1 - e^(-a.t))/a), dy/dt = (F/c).(1 - e^(-a.t)),
%      a = c/m, et I_k = Ki.dt.sum_{j<k} (r - y_j) en somme finie ; k* = premier pas non saturé ;
%   2. phase linéaire à trois états xi = [y - r; dy/dt; I - m.g] : xi(k*-1+n) = M^n.xi(k*-1),
%      M = [1 - G1.Kp, F12, G1 ; -G2.Kp, F22, G2 ; -Ki.dt, 0, 1] (spec §4.2), construite avec la
%      forme fermée de Phi et Gam (pas expm), jusqu'à une éventuelle re-saturation.
%   Écart maximal comparé à l'oracle exact pas à pas, pour chaque Ki.
P = t018_params();
addpath(fileparts(mfilename('fullpath')));
h = P.dt; a = P.c/P.m; F = P.Umax - P.m*P.g; W = P.m*P.g;
[~, ~, Z] = t005_zoh(P, h); Phi = Z.PhiF; Gam = Z.GamF;
fprintf('Phase saturée : F = Umax - m.g = %.1f N, vitesse limite F/c = %.4f m/s\n', F, F/P.c);
fprintf('%6s | %4s %4s | %10s %10s | %10s | %8s | %10s %10s %10s | %s\n', 'Ki', 'k*', 'k*ex', ...
    'y(k*-1) m', 'I(k*-1) N', 'sat |dy|', 'sat |dI|', 'lin |dy| m', 'lin |dv|', 'lin |dI| N', ...
    'fin de la phase linéaire');
pire = 0;
for Ki = [0 130 200 800 840 850 1000 2000 4000 8000]
    S = t018_pi_oracle(P, P.Kp, Ki, h, P.kMax, P.Umax);
    % 1. Phase saturée en forme fermée.
    yF = zeros(P.kMax+1,1); vF = yF; IF = yF; kStar = 0;
    for k = 1:P.kMax
        t = (k-1)*h;
        yF(k) = (F/P.c)*(t + expm1(-a*t)/a); vF(k) = -(F/P.c)*expm1(-a*t);
        if k > 1, IF(k) = IF(k-1) + Ki*h*(P.r - yF(k-1)); end
        if P.Kp*(P.r - yF(k)) + IF(k) < P.Umax, kStar = k; break; end   % pas k non saturé
    end
    kStarEx = find(~S.sat, 1);
    js = 1:kStar;                                 % états après 0..k*-1 pas
    dSatY = max(abs(yF(js) - S.y(js))); dSatI = max(abs(IF(js) - S.I(js)));
    % 2. Phase linéaire : xi(n) = M^n.xi0, tant que la commande reste dans [-Umax ; Umax].
    M = [1 - Gam(1)*P.Kp, Phi(1,2), Gam(1); -Gam(2)*P.Kp, Phi(2,2), Gam(2); -Ki*h, 0, 1];
    xi0 = [yF(kStar) - P.r; vF(kStar); IF(kStar) - W];
    dLin = [0 0 0]; fin = sprintf('linéaire jusqu''à l''horizon (%d pas)', P.kMax);
    for nn = 0:(P.kMax - kStar + 1)
        xi = M^nn*xi0; kk = kStar + nn;           % indice MATLAB : état après kk-1 pas
        dLin = max(dLin, abs([xi(1) + P.r - S.y(kk), xi(2) - S.v(kk), xi(3) + W - S.I(kk)]));
        u = -P.Kp*xi(1) + xi(3) + W;              % commande du pas suivant
        if kk <= P.kMax && abs(u) >= P.Umax
            fin = sprintf('re-saturation au pas %d (u = %.1f N)', kk, u); break
        end
    end
    pire = max([pire, dSatY, dLin(1)]);
    fprintf('%6d | %4d %4d | %10.6f %10.4f | %10.3e | %8.2e | %10.3e %10.3e %10.3e | %s\n', Ki, ...
        kStar, kStarEx, yF(kStar), IF(kStar), dSatY, dSatI, dLin(1), dLin(2), dLin(3), fin);
    assert(kStar == kStarEx, 'T018 phases : k* forme fermée %d ~= oracle %d (Ki = %d)', kStar, kStarEx, Ki);
end
fprintf('Pire écart sur y, forme fermée par morceaux / oracle pas à pas : %.3e m\n', pire);
assert(pire <= 1e-9, 'T018 phases : forme fermée par morceaux et oracle en désaccord');
