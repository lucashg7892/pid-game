function [issue, kIssue] = t005_issue(P, Kp, y, v)
%T005_ISSUE Issue du niveau selon la spec T-001 §6, évaluée sur l'état après chaque pas.
%   y, v : vecteurs colonnes, indice 1 = k = 0 (au moins P.kMax+1 valeurs).
%   'choc' dès que y > 3,30 m ; 'victoire' au 120e pas consécutif avec |r-y| <= 0,25 m
%   et |dy/dt| <= 0,10 m/s ; sinon à k = 1800 : 'decolle_pas' si Kp <= m.g/r,
%   'trop_faible' (marche trop haute / trop lent) sinon.
run = 0;
for k = 1:P.kMax
    yk = y(k+1); vk = v(k+1);
    if yk > P.hPoutre
        issue = 'choc'; kIssue = k; return
    end
    if abs(P.r - yk) <= P.tolMarche && abs(vk) <= P.tolVitesse
        run = run + 1;
    else
        run = 0;
    end
    if run >= P.nVictoire
        issue = 'victoire'; kIssue = k; return
    end
end
kIssue = P.kMax;
if Kp <= P.m*P.g/P.r
    issue = 'decolle_pas';
else
    issue = 'trop_faible';
end
end
