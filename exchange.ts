⚙️ Ce que fait outputHashing: "all"

Quand tu ajoutes dans ton angular.json :

"configurations": {
  "production": {
    "outputHashing": "all"
  }
}


Angular génère des fichiers avec un hash de contenu dans leur nom :

main.62be4b8f54a3b2b1.js
polyfills.38b2df32f67a91b4.js
styles.cfd4f77e9cc123a1.css
runtime.2a33f9be9f7d8b78.js


Ce hash change dès que le contenu du fichier change.