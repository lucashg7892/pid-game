%T018_STABILITY Stabilité de la boucle PI échantillonnée EXACTE (sans saturation), Kp = 2500.
%   Écart à l'équilibre xi = [y - r; dy/dt; I - m.g] : xi(k+1) = M.xi(k) (spec T-018 §4.2).
%   1. M contrôlée contre un pas de l'oracle (régime non saturé) ;
%   2. Ki critique : rayon spectral de M = 1 (fzero), croisé par le critère de Jury sur le
%      polynôme caractéristique cubique et par simulation de l'oracle sans saturation ;
%      comparé à la limite continue de Routh, Ki < c.Kp/m = 8.Kp ;
%   3. pôle lent : constante de temps discrète comparée à Kp/Ki (approximation continue).
P = t018_params();
addpath(fileparts(mfilename('fullpath')));
h = P.dt;
Mf = @(Kp, Ki, hh) mpi(P, Kp, Ki, hh);
rho = @(Ki) max(abs(eig(Mf(P.Kp, Ki, h))));

% 1. Contrôle de M contre un pas de l'oracle, depuis un état non saturé quelconque.
S = t018_pi_oracle(P, P.Kp, 1000, h, P.kMax, P.Umax);
k0 = find(~S.sat, 1) + 50;                         % état après k0-1 pas, régime linéaire
xi0 = [S.y(k0) - P.r; S.v(k0); S.I(k0) - P.m*P.g];
xi1 = Mf(P.Kp, 1000, h)*xi0;
ecM = max(abs(xi1 - [S.y(k0+1) - P.r; S.v(k0+1); S.I(k0+1) - P.m*P.g]));
fprintf('1. M contre un pas de l''oracle (Ki = 1000, pas %d) : écart max %.3e\n', k0, ecM);
assert(ecM <= 1e-9, 'T018 stabilité : M incohérente avec l''oracle');

% 2. Ki critique.
KiC = 8*P.Kp;                                       % c.Kp/m = 8.Kp (m = 50, c = 400)
fprintf('2. Limite continue (Routh) : Ki < c.Kp/m = %.1f N/(m.s)\n', P.c*P.Kp/P.m);
fprintf('   rho(M) : Ki = 0 -> %.12f ; Ki = 100 -> %.12f ; Ki = 8000 -> %.9f ; Ki = 20000 -> %.9f\n', ...
    rho(0), rho(100), rho(8000), rho(KiC));
KiCrit = fzero(@(K) rho(K) - 1, [1e3 1e6]);
% Jury, polynôme z^3 + a2.z^2 + a1.z + a0 : stable ssi |a0| < 1, p(1) > 0, -p(-1) > 0 et
% |a0^2 - 1| > |a0.a2 - a1|. La frontière est la première condition qui s'annule.
jury = @(K) juryMarges(poly(Mf(P.Kp, K, h)));
mJ = @(K) min(jury(K));
KiJury = fzero(mJ, [1e3 1e6]);
mc = jury(KiJury); [~, quelle] = min(abs(mc));
% Simulation de l'oracle sans saturation, depuis l'équilibre perturbé (y = r - 0,01 m, I = m.g) :
% décroissance à 0,99.Ki_crit, croissance à 1,01.Ki_crit (rapport des amplitudes de |y - r| sur
% les pas 5881..6000 et 2881..3000).
amp = @(K) S2(P, K, Inf);
fprintf('   Ki critique (rayon spectral = 1) : %.2f N/(m.s) ; Jury : %.2f N/(m.s) (condition %d sur 4)\n', ...
    KiCrit, KiJury, quelle);
fprintf('   rapport Ki_crit / limite continue 8.Kp = %.4f ; Ki_crit / Ki_max du curseur (%d) = %.2f\n', ...
    KiCrit/KiC, P.KiMax, KiCrit/P.KiMax);
a99 = amp(0.99*KiCrit); a101 = amp(1.01*KiCrit);
fprintf('   oracle sans saturation, amplitude de |y - r| à 50 s / à 25 s : %.4f à 0,99.Ki_crit, %.4f à 1,01.Ki_crit\n', ...
    a99, a101);
assert(abs(KiCrit - KiJury) <= 1e-3*KiCrit, 'T018 stabilité : Jury et valeurs propres en désaccord');
assert(a99 < 1 && a101 > 1, 'T018 stabilité : la simulation ne confirme pas Ki critique');
z = eig(Mf(P.Kp, KiCrit, h)); [~, j] = max(abs(z));
fprintf('   pôles critiques : |z| = %.6f, arg z = %.5f rad (fréquence %.3f Hz)\n', abs(z(j)), ...
    abs(angle(z(j))), abs(angle(z(j)))/(2*pi*h));

% 3. Pôle lent.
fprintf('\n3. Pôle lent (Kp = %d) : constante de temps discrète -dt/ln|z_lent| contre Kp/Ki\n', P.Kp);
fprintf('%8s | %12s | %12s | %10s | %10s\n', 'Ki', '|z_lent|', 'tau disc. s', 'Kp/Ki s', 'rho(M)');
for Ki = [100 130 140 200 500 800 840 850 1000 2000 4000 8000]
    z = eig(Mf(P.Kp, Ki, h)); zr = z(abs(imag(z)) < 1e-12);
    [zl, ~] = max(abs(zr));
    fprintf('%8d | %12.9f | %12.5f | %10.5f | %10.7f\n', Ki, zl, -h/log(zl), P.Kp/Ki, max(abs(z)));
end

function M = mpi(P, Kp, Ki, h)
% Matrice de boucle fermée PI échantillonnée exacte (forme fermée de Phi et Gam).
[~, ~, Z] = t005_zoh(P, h); Phi = Z.PhiF; Gam = Z.GamF;
M = [1 - Gam(1)*Kp, Phi(1,2), Gam(1); -Gam(2)*Kp, Phi(2,2), Gam(2); -Ki*h, 0, 1];
end

function m = juryMarges(c)
% Marges du critère de Jury pour c = [1 a2 a1 a0] (toutes > 0 <=> stable).
a2 = c(2); a1 = c(3); a0 = c(4);
m = [1 - abs(a0), 1 + a2 + a1 + a0, 1 - a2 + a1 - a0, abs(a0^2 - 1) - abs(a0*a2 - a1)];
end

function q = S2(P, Ki, Umax)
% Rapport des amplitudes max |y - r| sur les pas 5881..6000 et 2881..3000 (oracle sans
% saturation, départ y = r - 0,01 m, dy/dt = 0, I = m.g) ; erreur si la contrainte de sol a agi
% (le système ne serait plus linéaire).
S = t018_pi_oracle(P, P.Kp, Ki, P.dt, 6000, Umax, [P.r - 0.01; 0], P.m*P.g);
if S.sol > 0, error('T018 stabilité : contrainte de sol active à Ki = %.1f', Ki); end
q = max(abs(P.r - S.y(5882:6001))) / max(abs(P.r - S.y(2882:3001)));
end
