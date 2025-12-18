const fs = require("fs");
const path = require("path");

const filePath = path.join(
  process.cwd(),
  "src",
  "app",
  "api",
  "models",
  "operateur-recherche-bff.ts"
);

function main() {
  console.log(`[fix-openapi-enums] Target: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.log("[fix-openapi-enums] File not found -> nothing to do.");
    process.exit(0);
  }

  const original = fs.readFileSync(filePath, "utf8");
  const lines = original.split(/\r?\n/);

  let changed = 0;

  const out = lines.map((line) => {
    const indent = line.match(/^\s*/)?.[0] ?? "";
    const t = line.trim();

    if (t === "= '=' ," || t === "= '='," || t === "= '='") {
      changed++;
      return `${indent}Egal = '=',`;
    }

    if (t === "= '>=' ," || t === "= '>='," || t === "= '>='") {
      changed++;
      return `${indent}SuperieurOuEgal = '>=',`;
    }

    if (t === "= '<=' ," || t === "= '<='," || t === "= '<='") {
      changed++;
      return `${indent}InferieurOuEgal = '<=',`;
    }

    return line;
  });

  if (changed === 0) {
    console.log("[fix-openapi-enums] No change (already fixed or pattern not found).");
    process.exit(0);
  }

  const updated = out.join("\n");
  fs.writeFileSync(filePath, updated, "utf8");

  console.log(`[fix-openapi-enums] Done. Replacements: ${changed}`);
}

main();




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