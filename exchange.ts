Où mettre quoi (arbo finale)

À la racine du projet (même niveau que package.json, angular.json) :

/ (racine)
├─ src/
│  ├─ main.single-spa.ts      ← ton entrée MFE (déjà là)
│  └─ ...
├─ angular.json
├─ package.json
├─ rollup.config.mjs          ← AJOUTER ICI
└─ (le reste)


rollup.config.mjs vit à la racine.
On ne crée pas de sous-dossier spécial.

1) Installer les outils
npm i -D rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs rollup-plugin-terser glob

2) Créer rollup.config.mjs (à la racine)

Remplace dist/<app>/mfe-concil.system.js par ton chemin de sortie voulu (garde dist/...).

// rollup.config.mjs (RACINE)
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const input = process.env.ROLLUP_INPUT; // on le passera via npm script
if (!input) throw new Error('ROLLUP_INPUT manquant (main-*.js du build Angular).');

export default {
  input,
  output: {
    file: 'dist/conciliation/mfe-concil.system.js', // ← adapte "conciliation" au nom de ton app
    format: 'system',            // ⇒ System.register
    sourcemap: true,
    inlineDynamicImports: true   // ⇒ bundle unique, pas de chunks
  },
  // On embarque tout (AUCUN external) => le root n'a rien à partager
  plugins: [nodeResolve(), commonjs(), terser()]
};


Si ton projet s’appelle autrement (ex: angular-20), remplace dist/conciliation/... par dist/angular-20/....

3) Scripts dans package.json

Ajoute/merge ces scripts :

{
  "scripts": {
    "build:mfe": "ng build -c mfe",
    "postbuild:mfe": "node -e \"const {globSync}=require('glob');const m=globSync('dist/**/browser/main-*.js')[0];if(!m)throw new Error('main-*.js introuvable');process.env.ROLLUP_INPUT=m;require('child_process').execSync('rollup -c', {stdio:'inherit'});\"",
    "bundle:mfe": "npm run build:mfe && npm run postbuild:mfe"
  }
}


build:mfe : build Angular ESM en utilisant ta config mfe (où main = src/main.single-spa.ts).

postbuild:mfe : repère main-*.js dans dist/**/browser/ et lance Rollup avec ce fichier en entrée.

bundle:mfe : enchaîne les deux.

4) Vérifier angular.json (config mfe)

Dans ton projet (ex: conciliation) assure-toi d’avoir une config qui pointe sur main.single-spa.ts :

{
  "projects": {
    "conciliation": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist/conciliation",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "assets": ["src/favicon.ico", "src/assets"],
            "styles": ["src/styles.scss"],
            "outputHashing": "all",
            "baseHref": "/",
            "deployUrl": "/dist/conciliation/browser/"
          },
          "configurations": {
            "mfe": {
              "main": "src/main.single-spa.ts",
              "fileReplacements": [
                { "replace": "src/environments/environment.ts", "with": "src/environments/environment.prod.ts" }
              ]
            }
          }
        }
      }
    }
  }
}


outputPath: libre, mais garde-le cohérent avec rollup.config.mjs (ici dist/conciliation).

deployUrl: chemin public depuis lequel le navigateur récupérera les chunks pendant le build ESM (Rollup les fusionnera ensuite).

mfe.main → src/main.single-spa.ts ✅

5) Build + bundle
npm run bundle:mfe


Tu obtiens :

dist/conciliation/
├─ browser/
│  ├─ main-XXXX.js
│  ├─ chunk-*.js
│  └─ styles-*.css (si présent)
└─ mfe-concil.system.js        ← ✔️ le fichier final à donner au root


C’est ce fichier unique que le root doit charger via System.import('mfe-concil').

6) Côté root (aucun code à changer)

Tu ne touches pas au JS du root.
Tu mets à jour uniquement la cible (import map / config route → l’URL) :

<script type="systemjs-importmap">
{
  "imports": {
    "mfe-concil": "https://localhost:4510/dist/conciliation/mfe-concil.system.js"
  }
}
</script>


Le nom mfe-concil doit être le même que dans registerApplication({ name: 'mfe-concil', ... }).

Questions fréquentes

Où mettre le CSS global ?

Si tu as un styles-*.css, deux options :

Ajouter un <link> dans le root (une fois) vers ce CSS (chemin public du build).

Limiter les styles globaux et styler via composants (rien à ajouter côté root).

Et si je veux garder des chunks (lazy) ?

Enlève inlineDynamicImports: true. Tu obtiendras plusieurs fichiers System.register → il faudra s’assurer que SystemJS résout leurs chemins (import map additional, paths…) → plus complexe. Pour l’instant, un seul bundle = plus simple.

Je veux réduire le poids

Phase 2 : déclarer @angular/*/rxjs en external dans Rollup et les fournir via import map du root (en ESM ou System.register). On stabilise d’abord le chargement.












Installer le bon set (compatibles v4)

npm i -D rollup@^4 \
  @rollup/plugin-node-resolve@^15 \
  @rollup/plugin-commonjs@^25 \
  @rollup/plugin-terser@^0.4 \
  glob@^10


Mettre à jour la config Rollup
Dans rollup.config.mjs, importe @rollup/plugin-terser (et pas rollup-plugin-terser) :

// rollup.config.mjs
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';   // <— ICI

const input = process.env.ROLLUP_INPUT;
if (!input) throw new Error('ROLLUP_INPUT manquant');

export default {
  input,
  output: {
    file: 'dist/conciliation/mfe-concil.system.js',
    format: 'system',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    terser(),  // <— ICI
  ],
};

Si le lock est “collant”

Parfois npm garde l’ancien graphe. Dans ce cas :

rm -rf node_modules package-lock.json
npm i


puis ré-installe le set ci-dessus (étape 2).









✅ À mettre dans package.json (section "scripts")
{
  "scripts": {
    "start": "ng serve -c development",
    "build": "ng build",
    "build:dev": "ng build -c development",
    "build:prod": "ng build -c production",
    "build:local": "ng build -c local",

    "rollup:from-dist": "node -e \"const {globSync}=require('glob');const m=globSync('dist/**/browser/main-*.js')[0];if(!m)throw new Error('main-*.js introuvable');process.env.ROLLUP_INPUT=m;require('child_process').execSync('rollup -c', {stdio:'inherit'});\"",

    "bundle": "npm run build && npm run rollup:from-dist",
    "bundle:dev": "npm run build:dev && npm run rollup:from-dist",
    "bundle:prod": "npm run build:prod && npm run rollup:from-dist",
    "bundle:local": "npm run build:local && npm run rollup:from-dist"
  }
}


bundle:* = build Angular (ESM) puis re-bundle Rollup en System.register (fichier unique).

Utilise la conf existante : production, development, local. Pas besoin d’une conf nommée mfe.

📦 Dépendances de build (une seule fois)
npm i -D rollup@^4 @rollup/plugin-node-resolve@^15 @rollup/plugin-commonjs@^25 @rollup/plugin-terser@^0.4 glob@^10


Et garde rollup.config.mjs à la racine (celui avec format: "system" et inlineDynamicImports: true).