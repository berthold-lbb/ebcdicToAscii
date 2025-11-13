1. Contexte de départ

Front existant :

Root single-spa + SystemJS.

Les micro-frontends Angular 14 sont livrés en UMD/System.register via webpack custom.

Le root charge les MFEs avec System.import('nom-mfe') en s’appuyant sur un import-map.

Objectif de la migration :

Migrer un MFE Angular 14 → Angular 20.

Garder le root tel qu’il est (SystemJS + UMD) pour ne pas casser les MFEs existants.

Pouvoir charger le nouveau MFE Angular 20 via le root single-spa.

Problème : Angular 20 ne sait plus sortir du UMD nativement. Il sort uniquement du ESM moderne.

2. ESM vs UMD – rappel rapide
UMD (Universal Module Definition)

Pensé pour supporter :

CommonJS (Node),

AMD / RequireJS,

et un global (window.lib = ...).

Exemple d’utilisation :

On met un <script> qui définit un global, ou on le charge via SystemJS qui sait comprendre la forme System.register/UMD.

Avantages :

Très compatible avec des vieux bundlers / chargeurs (SystemJS, RequireJS).

Format “universel” pour les architectures existantes.

Inconvénients :

Optimisations plus limitées (tree-shaking plus difficile).

Pas le format “natif” des navigateurs modernes.

Complexifie les partages de dépendances et la migration vers les nouveaux outils (Vite, esbuild, etc.).

ESM (ECMAScript Modules)

Format standard du JavaScript moderne :

import / export natifs dans le navigateur.

Directement supporté par les navigateurs sans loader externe.

Avantages :

Meilleur tree-shaking → bundles plus petits.

Meilleure intégration avec les outils modernes (Angular 20, Vite, Rollup, Webpack 5…).

Chargement dynamique simple : import('…').

plus aligné avec les librairies récentes (RxJS, Angular, etc.).

Inconvénients dans ton contexte :

Ton root actuel ne parle que SystemJS + UMD/System.register.

Un bundle ESM “pur” ne peut pas être chargé tel quel avec System.import() sans adapter le root.

3. Les options de migration
Option A – Moderniser le root pour parler ESM

Idée :

Adapter le root (index.ejs + root-config) pour charger les MFEs Angular 20 directement en ESM :

Utiliser les import maps natives :

<script type="importmap">
  {
    "imports": {
      "mfe-concil": "https://…/main-esm.js"
    }
  }
</script>
<script type="module">
  import { start } from 'single-spa';
  import './root-config.js';
  start();
</script>


Remplacer certains System.import() par des import() ou utiliser le support ESM de single-spa.

Avantages :

Architecture à jour, alignée sur Angular 20 et les navigateurs modernes.

Moins de couches techniques (plus besoin de SystemJS à terme).

Plus facile pour les futurs MFEs.

Inconvénients :

Impacts lourds sur le root :

Il faut tester tous les MFEs existants.

Risque de régression si certains MFEs ou libs supposent encore du UMD/global.

Migration “Big Bang” ou au moins assez structurante.

Option B – Garder le root en UMD et convertir le bundle ESM → System.register après le build (post-build Rollup)

Idée :

Build Angular 20 normalement en ESM :

ng build → dist/angular-20/browser/main-XXXX.js (+ chunks).

Post-build Rollup :

Rollup lit main-XXXX.js en entrée.

Il rebundle en un seul fichier System.register :

export default {
  input: process.env.ROLLUP_INPUT,
  output: {
    format: "system",
    file: "dist/angular-20/browser/main.system.js",
    inlineDynamicImports: true
  },
  plugins: [resolve(), commonjs(), terser()]
};


Résultat : dist/angular-20/browser/main.system.js

Côté root :

Rien ne change dans le code.

On pointe simplement l’import map vers ce nouveau bundle :

{
  "imports": {
    "mfe-concil": "http://localhost:4510/angular-20/main.system.js"
  }
}


et System.import('mfe-concil') continue de fonctionner comme avant.

Avantages :

Le root reste strictement identique (SystemJS, UMD, autres MFEs).

On profite quand même :

du tooling moderne d’Angular 20,

de la compilation Ivy/ESM,

et on ne touche pas aux MFEs existants.

Migration progressive : MFE par MFE.

Inconvénients :

On introduit une étape build supplémentaire (Rollup).

Le bundle final est un gros fichier unique (inlineDynamicImports) :

plus simple pour SystemJS,

mais moins optimal pour le code-splitting.

Solution “pont” : à long terme, il faudra quand même envisager une vraie migration ESM du root.

4. Solutions recommandées dans ton contexte
Court/moyen terme (ce que tu es en train de mettre en place)

Garder le root en SystemJS/UMD et convertir le MFE Angular 20 en System.register avec Rollup (Option B).

Pourquoi c’est pertinent :

Risque minimal : le root ne change pas, les autres MFEs continuent d’être chargés comme avant.

Focalisé sur un seul MFE : on peut valider Angular 20 sans toucher à toute la plateforme.

Réversible : si un problème survient, tu peux toujours revenir à l’ancien MFE Angular 14.

En pratique :

ng build (Angular 20) → bundle ESM.

rollup post-build → main.system.js.

Root importe main.system.js via SystemJS comme un UMD/System.register classique.

Long terme

Planifier une migration progressive du root vers un modèle full ESM / import maps.

Une fois que plusieurs MFEs sont en Angular 20+ :

réduire l’usage de SystemJS,

servir les MFEs comme scripts type="module",

déplacer le partage des dépendances dans des import maps natives.

5. Message clé à faire passer en présentation

Angular 20 impose un build moderne basé sur ESM.

Le root actuel est structuré autour de SystemJS + UMD/System.register.

Modifier le root tout de suite serait risqué pour tous les MFEs existants.

La stratégie choisie est donc une migration progressive :

On build le MFE Angular 20 en ESM, puis on utilise Rollup pour le transformer en System.register afin qu’il reste compatible avec le root historique, sans toucher aux autres microfrontends.