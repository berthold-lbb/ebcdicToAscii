# V2 — tests et critères de validation

Statut : plan de tests à implémenter sur la branche complète. Aucun test Kotlin, Android, iOS ou BrowserStack exécuté dans cette livraison documentaire. Les exemples proposés ne doivent pas être présentés comme un correctif validé.

## 1. Tests déterministes du coordinateur

Utiliser `runTest`, un scope supervisé contrôlé par le scheduler de test, un faux temps et un faux transport suspendu par `CompletableDeferred`. Éviter les sleeps et les assertions basées sur un délai réel. Compter les appels et enregistrer uniquement des jetons synthétiques R1/R2.

| Cas | Mise en place | Assertion |
| --- | --- | --- |
| Deux refresh forcés avec rotation | Installer S1/R1. Démarrer A, attendre que le faux transport soit entré, démarrer B, puis libérer R2. | Un appel ; A et B SUCCESS ; état R2. |
| Deux refresh sans rotation | Même scénario, réponse acceptée conservant R1. | Un appel ; deux succès ; pas de dépendance à R1 != R2. |
| Access encore valide | Appeler `refresh(false)` sans tentative en cours. | Aucun appel HTTP ; access courant. |
| Force malgré access valide | Appeler `refresh(true)`. | Un appel ; email actualisé. |
| Accès pendant refresh forcé | A force le réseau ; B appelle `refresh(false)`. | B rejoint A, ne lit pas un email/access intermédiaire. |
| Refresh absent / blanc | Installer un access valide avec refresh null, vide, puis blanc. | `refresh(true)` refuse sans réseau. |
| Aucun état authentifié | Appeler les deux modes. | UNAUTHORIZED sans réseau. |
| Refus définitif | Deux participants, réponse Rejected. | Même refus pour les participants ; état vidé ; appel suivant sans réseau. |
| Erreur temporaire | Deux participants, réponse Failed. | Un appel pour cette tentative ; état conservé ; un retry ultérieur explicite est possible. |
| Email non vérifié | Réponse dédiée. | EMAIL_NOT_VERIFIED ; aucun succès ; pas de retry automatique. |
| Fermeture de l'écran A | A et B attendent ; annuler uniquement A ; libérer R2. | B réussit et R2 est enregistré. |
| Tous les écrans ferment | Annuler les attentes A et B, garder le scope propriétaire actif. | La tentative partie termine et publie R2. |
| Logout pendant réseau | A est suspendu ; attendre `clearSession()` ; libérer A. | SESSION_CHANGED ; snapshot vide ; aucun jeton restauré. |
| Reconnexion pendant réseau | A/S1 suspendu ; beginLogin(S2), completeLogin(S2), puis libérer A. | S2 reste inchangée ; A obsolète. |
| Ancien finally / nouvelle tentative | S1 suspendu ; installer S2 ; lancer un refresh S2 ; finir S1 ; joindre S2 avec C. | C rejoint la tentative S2 ; pas de second refresh S2. |
| Deux connexions concurrentes | Tickets T1 puis T2 ; terminer T2 puis T1. | T1 ignoré ; T2 conservé. |
| Redirect dupliqué | Compléter T1, rafraîchir vers R2, compléter de nouveau T1 avec R1. | Deuxième complétion SESSION_CHANGED ; R2 conservé. |
| Ancienne webview annulée | T1 puis T2 ; cancelLogin(T1). | T2 n'est pas invalidé. |
| Connexion abandonnée | T1 puis cancelLogin(T1), réponse tardive T1. | Aucun jeton installé. |
| Nouvelle connexion sans refresh | S1/R1 puis connexion S2 sans refresh. | Aucun fallback R1 ; refresh forcé refusé sans réseau. |
| Changement de tenant | Invalider S1 puis commencer S2 sur un autre endpoint. | Aucune requête S1 n'utilise l'URL/client S2 ; aucun commit S1. |
| Exception après envoi | Faux transport lève une exception non CancellationException. | Récupération conservatrice, état non renouvelable, pas de replay automatique. |

Les assertions « un appel » exigent de vérifier que B a réellement rejoint pendant que A est suspendu. Deux appels lancés dans le même bloc mais exécutés successivement après complétion ne constituent pas ce scénario.

## 2. Tests de l'adaptateur HTTP et du stockage

- Vérifier avec un mock HTTP la forme exacte du POST et l'absence de POST pour refresh vide/blanc.
- Parser les corps réels anonymisés `invalid_grant`, `invalid_client`, email non vérifié et erreur inconnue. Tester `invalid_grant` avec les statuts 400 et 403 ; ne pas dépendre du seul statut.
- Tester access vide, JWT invalide, expiré, claims email/marque absents, mauvais tenant et succès sans refresh.
- Tester le fallback refresh uniquement pour le renouvellement ; jamais pour une connexion.
- Vérifier que le client Ktor et les couches intermédiaires n'appliquent pas un retry automatique caché aux POST de rotation.
- Distinguer absence réseau avant envoi, timeout après envoi et réponse HTTP reçue ; vérifier la classification utilisée par le coordinateur.
- Si persistance requise : simuler un échec d'écriture après rotation ; ne jamais retourner SUCCESS avec un ancien refresh restaurable. Tester redémarrage et nettoyage de la clé historique.
- Vérifier que les consommateurs n'utilisent plus un ancien `TokensDataSource` ou `EmailDataSource` indépendant après migration.
- Tester le binding DI : deux ViewModels et le manager de session doivent partager la même instance du coordinateur.

## 3. Tests UI / navigation

- Sur UNAUTHORIZED, chargement terminé et une seule connexion bas privilège proposée/ouverte.
- Deux écrans en échec ne créent pas deux URLs authorize ni deux verifiers concurrents.
- Le `state`, le code verifier, le ticket et le tenant restent associés à la même tentative OAuth.
- Un résultat SESSION_CHANGED ne déclenche pas d'erreur, ne met pas le nouvel utilisateur en NOT_AUTH et n'ouvre pas une reconnexion.
- Revalider la génération au moment où la navigation est exécutée, même si l'événement était déjà en file d'attente.
- Une annulation utilisateur ne réouvre pas immédiatement la connexion ; reprise d'intention au plus une fois.
- Une reconnexion bas privilège réussie reconstruit les jetons bas privilège avant de reprendre OCS.
- Le retour de la webview de modification actualise réellement l'email ; les règles métier de vérification du courriel restent respectées.
- Vérifier les handlers Android et iOS ; une nouvelle réaction shared ne doit pas tomber dans un `else/default` silencieux.

## 4. Validation UAT2 / Prod-BETA

Faire les scénarios avec et sans biométrie, avant et après expiration de l'access token, en premier plan et après retour d'arrière-plan. Rejouer profil, OCS et Nous écrire en traçant le véritable point d'entrée.

Pour chaque exécution, relever : version exacte, environnement/client/tenant, durée de vie observée de l'access token, identifiant de session et de tentative non secrets, heure du début/fin, code OAuth parsé, résultat local, événement de reconnexion. Corréler avec Auth0 depuis la dernière connexion, pas seulement autour du 403 final.

Critères de passage : aucun refresh vide ; une tentative par groupe réellement concurrent ; aucun commit après invalidation ; reconnexion unique et fonctionnelle ; aucune régression email/biométrie/OCS ; pas de secrets dans les logs. Si le 403 persiste, son diagnostic reste ouvert jusqu'à corrélation avec les événements serveur.

## 5. Validation effectuée pour les documents

Lecture des sources citées et recherche des appelants, lecture des déclarations de test Gradle, vérification des fichiers livrés et de leurs liens internes. Le compilateur `kotlinc` n'est pas disponible dans le PATH observé ; le projet présente aussi des fichiers essentiels vides et une incohérence DTO. Aucun résultat de compilation n'est déduit de cette revue.
