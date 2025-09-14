Étapes concrètes

Installer les mêmes libs via npm

npm i bootstrap@5 jquery jquery-ui-dist bootstrap-table @popperjs/core \
      axios socket.io-client tempusdominus-bootstrap-4 moment
npm i -D @types/jquery


angular.json
Ajoute CSS avant styles.css et scripts (ordre important) :

"styles": [
  "node_modules/bootstrap/dist/css/bootstrap.min.css",
  "node_modules/bootstrap-table/dist/bootstrap-table.min.css",
  "node_modules/tempusdominus-bootstrap-4/build/css/tempusdominus-bootstrap-4.min.css",
  "src/styles.css"
],
"scripts": [
  "node_modules/jquery/dist/jquery.min.js",
  "node_modules/jquery-ui-dist/jquery-ui.min.js",
  "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js",
  "node_modules/bootstrap-table/dist/bootstrap-table.min.js",
  "node_modules/moment/min/moment.min.js",
  "node_modules/tempusdominus-bootstrap-4/build/js/tempusdominus-bootstrap-4.min.js",
  "node_modules/axios/dist/axios.min.js",
  "node_modules/socket.io-client/dist/socket.io.min.js"
]


Redémarre ng serve après modification.