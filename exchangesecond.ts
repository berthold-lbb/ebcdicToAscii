Les libs NPM à avoir


Un angular.json complet avec :


un build MFE UMD (single-spa)


un build standalone (main.ts classique)


ng serve qui sert la version standalone




Le webpack.extra.cjs pour le MFE



1️⃣ Librairies à installer
# microfrontend
npm i single-spa single-spa-angular

# builder webpack Angular 20
npm i -D @angular/webpack-builder


2️⃣ angular.json avec MFE + Standalone
Je pars sur un projet nommé conciliation
(et je suppose que tu as deux entrées dans src :


main.single-spa.ts pour le microfrontend


main.ts pour l’app standalone classique).


{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "projects": {
    "conciliation": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "schematics": {
        "@schematics/angular:component": {
          "style": "scss",
          "standalone": false
        },
        "@schematics/angular:directive": {
          "standalone": false
        },
        "@schematics/angular:pipe": {
          "standalone": false
        }
      },
      "architect": {
        /* ---------- 1) BUILD MICROFRONTEND (UMD, single-spa) ---------- */
        "build": {
          "builder": "@angular/webpack-builder:application",
          "options": {
            "outputPath": "dist/conciliation",
            "index": "src/index.html",
            "main": "src/main.single-spa.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "inlineStyleLanguage": "scss",
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ],
            "styles": [
              "src/styles.scss"
            ],
            "scripts": [],
            "customWebpackConfig": {
              "path": "./webpack.extra.cjs"
            }
          },
          "configurations": {
            "production": {
              "optimization": true,
              "outputHashing": "all",
              "sourceMap": false,
              "namedChunks": false,
              "extractLicenses": true,
              "buildOptimizer": true,
              "baseHref": "http://localhost:4510/"
            },
            "development": {
              "optimization": false,
              "outputHashing": "none",
              "sourceMap": true,
              "namedChunks": true,
              "extractLicenses": false,
              "buildOptimizer": false,
              "baseHref": "http://localhost:4510/"
            }
          },
          "defaultConfiguration": "development"
        },

        /* ---------- 2) BUILD STANDALONE (main.ts classique) ---------- */
        "build-standalone": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist/conciliation-standalone",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "inlineStyleLanguage": "scss",
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ],
            "styles": [
              "src/styles.scss"
            ],
            "scripts": []
          },
          "configurations": {
            "production": {
              "optimization": true,
              "outputHashing": "all",
              "sourceMap": false,
              "namedChunks": false,
              "extractLicenses": true,
              "buildOptimizer": true,
              "baseHref": "/"
            },
            "development": {
              "optimization": false,
              "outputHashing": "none",
              "sourceMap": true,
              "namedChunks": true,
              "extractLicenses": false,
              "buildOptimizer": false,
              "baseHref": "/"
            }
          },
          "defaultConfiguration": "development"
        },

        /* ---------- 3) SERVE : on sert la version standalone ---------- */
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": {
            "buildTarget": "conciliation:build-standalone:development",
            "port": 4200,
            "host": "localhost",
            "ssl": false
          },
          "configurations": {
            "production": {
              "buildTarget": "conciliation:build-standalone:production"
            },
            "development": {
              "buildTarget": "conciliation:build-standalone:development"
            }
          },
          "defaultConfiguration": "development"
        },

        /* (optionnel) un serve spécial pour debugger le bundle MFE */
        "serve-mfe": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": {
            "buildTarget": "conciliation:build:development",
            "port": 4510,
            "host": "localhost",
            "ssl": false
          },
          "configurations": {
            "production": {
              "buildTarget": "conciliation:build:production"
            },
            "development": {
              "buildTarget": "conciliation:build:development"
            }
          },
          "defaultConfiguration": "development"
        },

        /* ---------- 4) TESTS ---------- */
        "test": {
          "builder": "@angular-devkit/build-angular:karma",
          "options": {
            "polyfills": ["zone.js/testing"],
            "tsConfig": "tsconfig.spec.json",
            "karmaConfig": "karma.conf.js",
            "inlineStyleLanguage": "scss",
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ],
            "styles": [
              "src/styles.scss"
            ],
            "scripts": []
          }
        }
      }
    }
  },
  "defaultProject": "conciliation",
  "cli": {
    "analytics": false
  }
}

Comment l’utiliser


Build microfrontend UMD pour le root
ng build conciliation --configuration production

→ sort dans dist/conciliation en UMD (chargé par ton root via SystemJS).


Servir l’application standalone (sans root)
ng serve

ou
ng serve conciliation

→ utilise build-standalone avec main.ts, dispo sur http://localhost:4200.


Optionnel : servir la version MFE pour debug
ng run conciliation:serve-mfe

→ build MFE et la sert sur http://localhost:4510.



3️⃣ webpack.extra.cjs (pour le build MFE UMD)
On garde la même logique que tout à l’heure :
// webpack.extra.cjs
const singleSpaAngularWebpack =
  require('single-spa-angular/lib/webpack').default;

module.exports = (config, options) => {
  // 1) Config de base générée par single-spa-angular
  const singleSpaWebpackConfig = singleSpaAngularWebpack(config, options);

  // 2) Externals (comme dans ton ancien extra-webpack.config.js)
  singleSpaWebpackConfig.externals = singleSpaWebpackConfig.externals || [];
  singleSpaWebpackConfig.externals.push(/@espace-csp\/store/);

  // 3) UMD pour le root (équivalent à libraryName / libraryTarget)
  singleSpaWebpackConfig.output = {
    ...(singleSpaWebpackConfig.output || {}),
    library: {
      name: 'conciliation',
      type: 'umd'
    },
    umdNamedDefine: true
  };

  return singleSpaWebpackConfig;
};


À vérifier de ton côté


Tu as bien src/main.single-spa.ts (entrée MFE)


Tu as bien src/main.ts qui bootstrap l’app de façon “normale” (standalone ou AppModule)


Le nom du projet dans angular.json est bien le même que dans package.json (ici conciliation)


Si tu veux, tu peux m’envoyer le contenu de ton main.ts actuel et je te le mets au propre pour Angular 20 (avec bootstrapApplication ou en mode AppModule).
