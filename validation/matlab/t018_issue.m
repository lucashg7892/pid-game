function [issue, kIssue] = t018_issue(P, y, v)
%T018_ISSUE Issue du niveau 2, évaluée sur l'état après chaque pas (règles recopiées de la
%   spec T-018 §5.2 et des décisions D27, D29 ; identifiants du jeu : win, bonk, step, slow).
%   y, v : vecteurs colonnes, indice 1 = k = 0 (au moins P.kMax+1 valeurs).
%   À chaque pas k = 1..P.kMax, dans cet ordre :
%     'bonk' dès que y > P.hPoutre ;
%     'win' au P.nVictoire-ième pas consécutif avec |r-y| <= P.tol et |dy/dt| <= P.tolVitesse
%       (une victoire acquise au pas P.kMax l'emporte sur la fin de temps) ;
%     à k = P.kMax : 'step' (trop court) si |r-y| > P.tol, sinon 'slow' (trop lent).
run = 0;
for k = 1:P.kMax
    yk = y(k+1); vk = v(k+1);
    if yk > P.hPoutre
        issue = "bonk"; kIssue = k; return
    end
    if abs(P.r - yk) <= P.tol && abs(vk) <= P.tolVitesse
        run = run + 1;
    else
        run = 0;
    end
    if run >= P.nVictoire
        issue = "win"; kIssue = k; return
    end
end
kIssue = P.kMax;
if abs(P.r - y(P.kMax+1)) > P.tol
    issue = "step";
else
    issue = "slow";
end
end
