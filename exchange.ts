const fs = require("fs");
const path = require("path");

const filePath = path.join(
  process.cwd(),
  "src/app/api/models/operateur-recherche-bff.ts"
);

if (!fs.existsSync(filePath)) {
  console.log("[fix-openapi-enums] File not found");
  process.exit(0);
}

let content = fs.readFileSync(filePath, "utf8");

const before = content;

content = content
  .replace("_ = '=',", "Egal = '=',")
  .replace("_ = '>=',", "SuperieurOuEgal = '>=',")
  .replace("_ = '<=',", "InferieurOuEgal = '<=',");

if (content === before) {
  console.log("[fix-openapi-enums] No change needed");
  process.exit(0);
}

fs.writeFileSync(filePath, content, "utf8");
console.log("[fix-openapi-enums] Enum fixed successfully");





"generate.concil-bff": "ng-openapi-gen -i src/assets/openapi/api-csp-conciliation_bff_v1.yaml -o src/app/api && node scripts/fix-openapi-enums.js src/app/api"



csp-concilliation-spa-migration/
├─ package.json
├─ angular.json
├─ tsconfig.json
├─ scripts/
│  └─ fix-openapi-enums.js   ✅ ICI
├─ src/
│  └─ app/
│     └─ api/
│        ├─ fn/
│        └─ models/
│           └─ operateur-recherche-bff.ts  👈 cible