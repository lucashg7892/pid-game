function S = t018_pi_oracle(P, Kp, Ki, h, N, Umax, x0, I0)
%T018_PI_ORACLE Simulation exacte pas à pas de la boucle PI échantillonnée (oracle de T-023).
%   S = t018_pi_oracle(P, Kp, Ki, h, N, Umax) simule N pas de durée h depuis y = 0,
%   dy/dt = 0, I = 0 ; S = t018_pi_oracle(..., x0, I0) part de x0 = [y; dy/dt] et de I0.
%   Algorithme (spec T-018 §3.1, ordre normatif) à chaque pas k :
%     1. e = r - y ;
%     2. u = Kp.e + I, avec I la valeur AVANT mise à jour ;
%     3. I <- I + Ki.h.e (sur l'erreur, jamais sur la commande saturée : pas d'anti-windup) ;
%     4. us = min(max(u,-Umax),Umax), constante sur le pas (bloqueur d'ordre zéro) ;
%     5. propagation EXACTE de [y; dy/dt] sur h à force nette us - m.g constante (t005_zoh) ;
%     6. sol : si y < 0 alors y = 0 et dy/dt = max(dy/dt, 0).
%   Aucune intégration numérique : l'intégrale du contrôleur est une somme finie (exacte par
%   construction) et la cabine suit la solution exacte de m.y'' = us - m.g - c.y' sur le pas.
%   Sorties (vecteurs colonnes) :
%     S.y, S.v, S.I  : état et intégrale aux instants k.h, k = 0..N (indice 1 = k = 0) ;
%     S.uc, S.us     : commande demandée et commande appliquée au k-ième pas, k = 1..N ;
%     S.sat          : drapeau saturé (us ~= uc) au k-ième pas ;
%     S.yInter       : max EXACT de y à l'intérieur du k-ième pas (entre échantillons) ;
%     S.sol          : nombre de pas où la contrainte de sol a agi.
[Phi, Gam] = t005_zoh(P, h);
a = P.c/P.m;
y = zeros(N+1,1); v = zeros(N+1,1); I = zeros(N+1,1);
uc = zeros(N,1); us = zeros(N,1); sat = false(N,1); yInter = zeros(N,1);
if nargin < 7, x0 = [0; 0]; end
if nargin < 8, I0 = 0; end
x = x0(:); Ik = I0; nSol = 0;
y(1) = x(1); v(1) = x(2); I(1) = Ik;
for k = 1:N
    e = P.r - x(1);
    u = Kp*e + Ik;
    Ik = Ik + Ki*h*e;
    s = min(max(u, -Umax), Umax);
    uc(k) = u; us(k) = s; sat(k) = (s ~= u);
    f = s - P.m*P.g;                       % force nette constante sur le pas (N)
    % Maximum intra-pas : dy/dt s'annule en tau si v0 > 0 et accélération limite b/a < 0.
    b = f/P.m; v0 = x(2); ym = max(x(1), 0);
    if v0 > 0 && b < 0
        tau = -log((-b/a) / (v0 - b/a)) / a;
        if tau > 0 && tau < h
            u1 = -expm1(-a*tau);
            ym = x(1) + v0*u1/a + b*(a*tau - u1)/a^2;
        end
    end
    x = Phi*x + Gam*f;
    if x(1) < 0
        x(1) = 0; x(2) = max(x(2), 0); nSol = nSol + 1;
    end
    yInter(k) = max([ym, x(1)]);
    y(k+1) = x(1); v(k+1) = x(2); I(k+1) = Ik;
end
S.y = y; S.v = v; S.I = I; S.uc = uc; S.us = us; S.sat = sat; S.yInter = yInter; S.sol = nSol;
end
