%T005_D Point D : stabilité de la boucle P échantillonnée EXACTE (sans saturation).
%   x(k+1) = Phi.x(k) + Gam.(Kp.(r - y(k)) - m.g)  =>  matrice de boucle fermée
%   Acl(Kp) = Phi - Gam.Kp.[1 0]. La pesanteur et r n'interviennent que dans le terme
%   constant : la stabilité ne dépend que de Acl. Kp critique : rayon spectral = 1.
P = t005_params();
addpath(fileparts(mfilename('fullpath')));
rho = @(Kp, h) max(abs(eig(t005_acl(P, Kp, h))));
for h = [P.dt, 1/60, 1/240]
    Kc = fzero(@(K) rho(K, h) - 1, [1e3 1e8]);
    % Contrôle analytique (Jury, 2e ordre) : instabilité quand det(Acl) = 1 (pôles complexes
    % sur le cercle unité) ou quand le polynôme s'annule en z = -1 (pôle réel en -1).
    [Phi, Gam] = t005_zoh(P, h);
    a0 = @(K) det(Phi - Gam*K*[1 0]);
    Kj = fzero(@(K) a0(K) - 1, [1e3 1e8]);
    % Forme fermée : det(Acl) = E + Kp.(g2.(1-E)/a - g1.E), avec E = e^(-a.h),
    % g1 = Gam(1), g2 = Gam(2) (formes fermées de t005_zoh) => Kp_c = (1-E)/(g2.(1-E)/a - g1.E).
    a = P.c/P.m; E = exp(-a*h); [~, ~, inf2] = t005_zoh(P, h); g = inf2.GamF;
    Kf = (1 - E)/(g(2)*(1 - E)/a - g(1)*E);
    fprintf('dt = 1/%d s : Kp critique : valeurs propres %.1f N/m ; Jury det(Acl)=1 %.1f N/m ; forme fermée %.1f N/m\n', ...
        round(1/h), Kc, Kj, Kf);
end
fprintf('Kp max du curseur = 8000 N/m : rapport Kp_c/8000 = %.2f\n', fzero(@(K) rho(K, P.dt) - 1, [1e3 1e8])/8000);
fprintf('\nRayon spectral et amortissement équivalent des pôles discrets, dt = 1/120 :\n');
fprintf('%8s | %10s | %8s | %8s | %12s\n', 'Kp', 'rho(Acl)', 'zeta_eq', 'zeta_c', 'sigma (1/s)');
for Kp = [1000 2500 3800 4000 8000 20000 50000 100000]
    z = eig(t005_acl(P, Kp, P.dt)); s = log(z(1))/P.dt;
    % sigma = -ln(rho)/dt : taux de décroissance réel de la boucle échantillonnée (continu : c/2m = 4).
    fprintf('%8d | %10.6f | %8.4f | %8.4f | %12.4f\n', Kp, max(abs(z)), -real(s)/abs(s), ...
        P.c/(2*sqrt(Kp*P.m)), -log(max(abs(z)))/P.dt);
end

function A = t005_acl(P, Kp, h)
% Matrice de boucle fermée échantillonnée exacte pour le gain Kp et le pas h.
[Phi, Gam] = t005_zoh(P, h);
A = Phi - Gam*Kp*[1 0];
end
