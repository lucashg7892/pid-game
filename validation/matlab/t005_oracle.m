function S = t005_oracle(P, Kp, h, N, Umax)
%T005_ORACLE Simulation exacte pas à pas de la boucle échantillonnée (oracle de T-005).
%   S = t005_oracle(P, Kp, h, N, Umax) simule N pas de durée h depuis y = 0, dy/dt = 0.
%   Algorithme (spec T-001 §4, ordre normatif) à chaque pas k :
%     1. e = r - y ;  2. u = Kp.e ;  3. us = min(max(u,-Umax),Umax) ;
%     4. propagation EXACTE sur h à force constante (t005_zoh) ;
%     5. sol : si y < 0 alors y = 0 et dy/dt = max(dy/dt, 0).
%   Sorties (vecteurs colonnes, indice 1 = k = 0) :
%     S.y, S.v       : état aux instants k.h, k = 0..N ;
%     S.us, S.sat    : commande appliquée et drapeau saturé au pas k = 0..N-1 ;
%     S.yInter       : max EXACT de y à l'intérieur de chaque pas (entre échantillons).
[Phi, Gam] = t005_zoh(P, h);
a = P.c/P.m;
y = zeros(N+1,1); v = zeros(N+1,1);
us = zeros(N,1); sat = false(N,1); yInter = zeros(N,1);
x = [0; 0];
for k = 1:N
    u = Kp*(P.r - x(1));
    s = min(max(u, -Umax), Umax);
    us(k) = s; sat(k) = (s ~= u);
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
        x(1) = 0; x(2) = max(x(2), 0);
    end
    yInter(k) = max([ym, x(1)]);
    y(k+1) = x(1); v(k+1) = x(2);
end
S.y = y; S.v = v; S.us = us; S.sat = sat; S.yInter = yInter;
end
