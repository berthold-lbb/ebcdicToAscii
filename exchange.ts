#!/usr/bin/env node
/**
 * Fix invalid TypeScript enum members generated from OpenAPI values like '=', '>=', '<='
 * Usage:
 *   node scripts/fix-openapi-enums.js "src/app/api"
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || "src/app/api";

// Enums à corriger (tu peux en ajouter d'autres si besoin)
const ENUM_FIXES = [
  {
    enumName: "OperateurRechercheBff",
    replacements: [
      { fromKey: "=", toKey: "Egal", value: "=" },
      { fromKey: ">=", toKey: "SuperieurOuEgal", value: ">=" },
      { fromKey: "<=", toKey: "InferieurOuEgal", value: "<=" },
    ],
  },
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Remplace seulement à l’intérieur du bloc: export enum XXX { ... }
function patchEnumBlock(content, enumName, replacements) {
  const enumStart = new RegExp(`export\\s+enum\\s+${escapeRegExp(enumName)}\\s*\\{`, "m");
  const startMatch = content.match(enumStart);
  if (!startMatch) return { changed: false, content };

  const startIndex = startMatch.index;
  const braceIndex = content.indexOf("{", startIndex);
  if (braceIndex < 0) return { changed: false, content };

  // Trouver la fin du bloc enum (brace matching simple)
  let i = braceIndex;
  let depth = 0;
  for (; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return { changed: false, content };

  const before = content.slice(0, braceIndex + 1);
  const block = content.slice(braceIndex + 1, i);
  const after = content.slice(i);

  let newBlock = block;
  let blockChanged = false;

  // Cas généré typique:
  //   = '=',
  //   >= = '>=',
  //   <= = '<=',
  //
  // On remplace uniquement les membres invalides par des identifiants valides
  for (const r of replacements) {
    // ex:   = '='
    const pattern1 = new RegExp(
      `(^\\s*)${escapeRegExp(r.fromKey)}\\s*=\\s*['"]${escapeRegExp(r.value)}['"]\\s*,?\\s*$`,
      "m"
    );

    // ex:   '>= ' ??? (au cas où)
    const pattern2 = new RegExp(
      `(^\\s*)['"]${escapeRegExp(r.fromKey)}['"]\\s*=\\s*['"]${escapeRegExp(r.value)}['"]\\s*,?\\s*$`,
      "m"
    );

    const replacementLine = `$1${r.toKey} = '${r.value}',`;

    if (pattern1.test(newBlock)) {
      newBlock = newBlock.replace(pattern1, replacementLine);
      blockChanged = true;
    } else if (pattern2.test(newBlock)) {
      newBlock = newBlock.replace(pattern2, replacementLine);
      blockChanged = true;
    }
  }

  // Nettoyage: assure une virgule finale propre (optionnel, mais safe)
  // (on laisse TypeScript gérer; pas obligatoire)

  if (!blockChanged) return { changed: false, content };

  const newContent = before + newBlock + after;
  return { changed: true, content: newContent };
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`[fix-openapi-enums] Folder not found: ${ROOT}`);
    process.exit(1);
  }

  const files = walk(ROOT).filter((f) => f.endsWith(".ts"));
  let changedFiles = 0;

  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    let content = original;
    let changed = false;

    for (const fix of ENUM_FIXES) {
      const res = patchEnumBlock(content, fix.enumName, fix.replacements);
      if (res.changed) {
        content = res.content;
        changed = true;
      }
    }

    if (changed && content !== original) {
      fs.writeFileSync(file, content, "utf8");
      changedFiles++;
      console.log(`[fix-openapi-enums] patched: ${file}`);
    }
  }

  console.log(`[fix-openapi-enums] done. changedFiles=${changedFiles}`);
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