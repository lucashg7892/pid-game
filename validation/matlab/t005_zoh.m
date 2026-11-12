function [Phi, Gam, info] = t005_zoh(P, h)
%T005_ZOH Discrétisation EXACTE (bloqueur d'ordre zéro) de l'ascenseur sur un pas h.
%   Entre deux échantillons, la force nette f = sat(u) - m.g est constante ; l'état
%   x = [y; dy/dt] suit dx/dt = A.x + B.f avec A = [0 1; 0 -c/m], B = [0; 1/m].
%   La solution exacte est x(h) = Phi.x(0) + Gam.f, avec Phi = e^(A.h) et
%   Gam = int_0^h e^(A.s) ds . B, obtenus par EXPM de la matrice augmentée
%   [A B; 0 0] (méthode de Van Loan), sans aucune intégration numérique.
%   info.ecartFormeFermee : écart max entre expm et la forme fermée analytique
%   (contrôle croisé indépendant de expm).
A = [0 1; 0 -P.c/P.m];
B = [0; 1/P.m];
M = expm([A B; zeros(1,3)] * h);
Phi = M(1:2,1:2);
Gam = M(1:2,3);
% Forme fermée (a = c/m) ; expm1 évite la cancellation de 1 - e^(-a.h).
a  = P.c/P.m;
u1 = -expm1(-a*h);                 % 1 - e^(-a.h)
PhiF = [1, u1/a; 0, 1-u1];
GamF = [(a*h - u1)/a^2; u1/a] / P.m;
info.ecartFormeFermee = max([abs(Phi(:)-PhiF(:)); abs(Gam-GamF)]);
info.PhiF = PhiF; info.GamF = GamF;
end
