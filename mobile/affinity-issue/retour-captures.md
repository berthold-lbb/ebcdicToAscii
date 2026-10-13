# Retour sur les captures 28861, 28862 et 28863

13 octobre 2026. Lecture des images fournies par l’utilisateur, confrontée à la proposition locale et aux sources Android. La section « Où l’analyse se trompe » est coupée entre les images 2 et 3 : seul son dernier passage sur les tests est visible. Son argument complet ne peut pas être évalué à partir de ces images.

## Décision sur le correctif

Le retour valide le principe de la simplification à quatre champs et reconnaît le gain de l’enum. Il recommande de reporter cette refactorisation parce que le correctif actuel est annoncé comme déjà validé sur appareil et proche d’une PR.

**Je suis d’accord avec ce choix de calendrier.** La correction de navigation n’a pas besoin de cette refactorisation pour fonctionner. Garder la variante comme amélioration de suivi permet d’adapter les tests et de refaire la validation du comportement avec un périmètre clair.

Les captures rapportent une compilation réussie, 21 tests verts et une comparaison de plusieurs scénarios entre les versions. Je n’ai ni exécuté ces tests ni reçu leurs sources ; cela ne constitue pas une preuve locale d’équivalence exhaustive, notamment sur les chemins d’exception.

## Garde de visibilité : garder aussi isFinishing

Le retour a raison d’adopter `Lifecycle.State.RESUMED` pour éviter les effets UI en arrière-plan et de laisser `cancelAll()` hors de cette garde. Il a également raison de considérer `isDestroyed` comme superflu ici avec le cycle de vie AndroidX correctement suivi.

En revanche, `RESUMED` n’implique pas `!isFinishing` : `finish()` pose le marqueur de fermeture sans attendre que le cycle de vie ait reçu `ON_PAUSE`. L’inférence à partir de ces deux mécanismes est qu’une activité peut être encore `RESUMED` alors que sa fermeture est déjà demandée.

Je recommande donc cette garde :

```kotlin
if (activity != null &&
    !activity.isFinishing &&
    activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
) {
    // Effets UI uniquement.
}
```

Sources : [Activity.java — isFinishing et finish](https://android.googlesource.com/platform/frameworks/base/+/a3894f99a570/core/java/android/app/Activity.java), [Lifecycle.Event — ON_PAUSE](https://developer.android.com/reference/kotlin/androidx/lifecycle/Lifecycle.Event). Ce cas n’a pas été reproduit sur appareil ici.

## Affinité vide : contexte nouveau, formulation encore trop absolue

La capture 2 rapporte `taskAffinity=""` dans le manifeste réel. La copie locale contient toujours `taskAffinity="${applicationId}"`. Il s’agit d’une différence de version importante : notre analyse ne pouvait pas établir le comportement du manifeste réel à partir de cette copie.

L’absence d’affinité explique que la recherche par affinité ne retrouve pas la tâche de session. Les journaux rapportés, avec passage de la tâche 209 à la tâche 210, sont cohérents avec ce diagnostic pour ce lancement de `LogoutActivity`.

Cependant, « aucune tâche ne peut jamais correspondre » et « NEW_TASK crée toujours une tâche neuve » restent trop forts. La recherche Android peut également reconnaître une tâche par son composant racine, avant de comparer les affinités. Une tâche compatible déjà enracinée dans la destination peut donc être retrouvée malgré l’absence d’affinité.

La formulation précise pour ce cas est : **le lancement observé de LogoutActivity n’a pas réutilisé la tâche de session ; l’absence d’affinité est cohérente avec l’échec de la recherche par affinité.** Cela confirme l’intérêt de lancer depuis l’activité courante sans flag de nouvelle tâche.

Source : [RootWindowContainer.java — FindTaskResult](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/services/core/java/com/android/server/wm/RootWindowContainer.java), comparaison `task.realActivity` avec le composant demandé, puis recherche par `task.rootAffinity`. Source AOSP consultée pour vérifier la règle générale, pas code de la version Android de l’appareil concerné.

## Logs d’exception et fin sans résultat

Le rétablissement des logs dans les deux `catch` est utile : une exception absorbée doit rester diagnostiquable.

Le retour reconnaît aussi que libérer le verrou seul ne suffit pas si l’opération ne produit aucun résultat. Il faut assurer la fin de l’indicateur d’attente et traiter les effets tardifs de l’opération. Les captures visibles ne montrent pas de correctif de ce chemin. La variante à quatre champs ne le résout pas non plus ; le contrat terminal SCRATCH reste à établir.

## Tests et identité de l’abonnement

Le passage visible indique que plusieurs tests invoquent les fonctions internes avec des identifiants et qu’un cas forge un identifiant périmé. Ces tests sont couplés à la représentation actuelle. Leur réécriture est un coût réel du changement, mais ne démontre pas que le nouveau comportement est incorrect.

Un test qui vérifie seulement le rejet d’un numéro fabriqué peut devenir inutile lorsque l’API n’expose plus de numéros. En revanche, la propriété utile — un ancien callback ne doit pas libérer l’opération courante ni relancer la navigation — doit rester couverte si le contrat d’exécution permet ce scénario. Elle peut être testée avec une source d’événements contrôlée qui conserve les callbacks, sans exposer les champs internes. Si le scénario est impossible avec le contrat réel de l’API, il faut documenter cet invariant plutôt qu’ajouter une API uniquement pour le test.

Les captures ne changent pas le constat sur la lisibilité : l’enum exprime trois décisions de navigation. Précision après relecture : le code actuel donne priorité à `navigationHandled`. Le couple `pending=true, handled=true` n’est donc pas un quatrième comportement ni la preuve d’un bug ; il bloque la navigation, comme `HANDLED`. Ce couple peut même exister brièvement entre les deux affectations successives de `navigateIfReady()`. L’enum supprime cette représentation redondante. Voir [la proposition finale](./PROPOSITION-FINALE.md).

Ce dossier reste une analyse. Les sources applicatives et le manifeste local n’ont pas été modifiés.
