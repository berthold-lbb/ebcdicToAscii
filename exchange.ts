Pensé pendant24s

Parfait Kaneki. Voici un angular.json prêt pour Angular 20, en ESM (par défaut avec le builder application), avec un baseHref pointant sur http://localhost:4510/ et en reprenant l’esprit de tes anciennes configs (outputPath, budgets, ssl, CommonJS autorisé, styles externes, etc.).

Remarque : Angular 20 émet ESM nativement — pas besoin d’option spéciale. Il suffit d’utiliser le builder @angular-devkit/build-angular:application.

{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "projects": {
    "conciliation": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "schematics": {
        "@schematics/angular:application": { "strict": true },
        "@schematics/angular:component": { "style": "scss" }
      },
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist/csp-conciliation/spa",
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
              "src/styles.scss",
              "node_modules/@dsd/library/dist/library/library.css",
              "node_modules/@dsd/library/dist/themes/css/dsd-theme-ag-grid.css"
            ],
            "scripts": [],
            "allowedCommonJsDependencies": [
              "moment-timezone"
            ],

            /* ====== IMPORTANT pour ton contexte ====== */
            "baseHref": "http://localhost:4510/",
            "deployUrl": "/",
            /* ========================================= */

            "outputHashing": "all",
            "optimization": true,
            "sourceMap": false,
            "namedChunks": false,
            "vendorChunk": false,
            "extractLicenses": true
          },
          "configurations": {
            "production": {
              "fileReplacements": [
                {
                  "replace": "src/environments/environment.ts",
                  "with": "src/environments/environment.prod.ts"
                }
              ],
              "budgets": [
                { "type": "initial", "maximumWarning": "600kb", "maximumError": "1mb" },
                { "type": "anyComponentStyle", "maximumWarning": "6kb", "maximumError": "10kb" }
              ]
            },
            "development": {
              "optimization": false,
              "sourceMap": true,
              "namedChunks": true,
              "vendorChunk": true,
              "extractLicenses": false,
              "outputHashing": "none"
            }
          },
          "defaultConfiguration": "production"
        },

        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": {
            "browserTarget": "conciliation:build:development",

            /* SSL local comme ton ancien setup */
            "ssl": true,
            "sslKey": ".cert/private-key.pem",
            "sslCert": ".cert/cert.pem",

            "host": "localhost",
            "port": 4510
          },
          "configurations": {
            "production": { "browserTarget": "conciliation:build:production" },
            "development": { "browserTarget": "conciliation:build:development" }
          },
          "defaultConfiguration": "development"
        },

        "test": {
          "builder": "@angular-devkit/build-angular:karma",
          "options": {
            "polyfills": ["zone.js/testing"],
            "tsConfig": "tsconfig.spec.json",
            "assets": ["src/favicon.ico", "src/assets"],
            "styles": ["src/styles.scss"],
            "scripts": []
          }
        },

        "lint": {
          "builder": "@angular-eslint/builder:lint",
          "options": { "lintFilePatterns": ["src/**/*.ts", "src/**/*.html"] }
        }
      }
    }
  },
  "cli": {
    "analytics": false,
    "cache": { "enabled": false }
  }
}

À faire côté root (rappel ultra-court)

Dans ton index.ejs, dans l’import map déjà présente (type systemjs-importmap), pointe vers le fichier ESM généré par ce build (le main-*.js dans dist/csp-conciliation/spa/browser/) :

<script type="systemjs-importmap">
{
  "imports": {
    "mfe-concil": "https://localhost:4510/dist/csp-conciliation/spa/browser/main-XXXX.js"
  }
}
</script>


Et garde dans root-config.ts :

registerApplication({
  name: 'mfe-concil',
  app: () => System.import('mfe-concil'),
  activeWhen: (loc) => loc.pathname.startsWith('/conciliation')
});
start();
