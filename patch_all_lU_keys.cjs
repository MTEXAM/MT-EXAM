const fs = require("fs");

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");

  let lUStart = content.indexOf("lU=({questions:");
  if (lUStart === -1) {
    console.log("lU not found in", filePath);
    return;
  }
  let lUEnd = content.indexOf("i2=k.createContext", lUStart);
  if (lUEnd === -1) lUEnd = lUStart + 150000;

  let lUBody = content.substring(lUStart, lUEnd);
  let originalLUBody = lUBody;

  // Let's find every u.jsxDEV inside map in lUBody and make its key parameter bulletproof
  const reg = /\.map\(\s*(\([^\)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*/g;
  let m;
  let count = 0;

  // Collect map positions
  let maps = [];
  while ((m = reg.exec(lUBody)) !== null) {
    maps.push({ index: m.index, argsStr: m[1], raw: m[0] });
  }

  // Backwards iteration
  for (let i = maps.length - 1; i >= 0; i--) {
    let item = maps[i];
    let mapPos = item.index;
    let snippet = lUBody.substring(mapPos, mapPos + 2500);

    let jsxPos = snippet.indexOf("u.jsxDEV(");
    if (jsxPos === -1) continue;

    let absJsxPos = mapPos + jsxPos;
    let jsxStr = lUBody.substring(absJsxPos);

    let depth = 0;
    let parts = [];
    let current = "";
    let inStr = false;
    let strChar = "";
    let endJsxPos = -1;

    for (let j = "u.jsxDEV(".length; j < jsxStr.length; j++) {
      let ch = jsxStr[j];
      if (inStr) {
        current += ch;
        if (ch === strChar && jsxStr[j - 1] !== "\\") {
          inStr = false;
        }
      } else {
        if (ch === '"' || ch === "'" || ch === "`") {
          inStr = true;
          strChar = ch;
          current += ch;
        } else if (ch === "(" || ch === "{" || ch === "[") {
          depth++;
          current += ch;
        } else if (ch === ")" || ch === "}" || ch === "]") {
          if (depth === 0 && ch === ")") {
            parts.push(current.trim());
            endJsxPos = absJsxPos + j + 1;
            break;
          }
          depth--;
          current += ch;
        } else if (ch === "," && depth === 0) {
          parts.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }

    if (parts.length >= 2) {
      // Get key argument (3rd arg, parts[2])
      let keyArg = parts[2];
      let callbackArgsStr = item.argsStr; // e.g. "(V,pe)", "V", "(Qn,Hs)"

      let elemVar = "v";
      let idxVar = "idx";

      if (callbackArgsStr.startsWith("(") && callbackArgsStr.endsWith(")")) {
        let inner = callbackArgsStr.substring(1, callbackArgsStr.length - 1).split(",").map(s => s.trim());
        if (inner[0]) elemVar = inner[0];
        if (inner[1]) idxVar = inner[1];
      } else {
        elemVar = callbackArgsStr.trim();
      }

      // Construct a safe key expression
      // If keyArg already exists, wrap it with fallback: (existingKeyArg) || ("lu_k_" + idxVar)
      let safeKeyExpr = "";
      if (!keyArg || keyArg === "void 0" || keyArg === "undefined") {
        safeKeyExpr = `"lu_k_${i}_"+${idxVar}`;
      } else {
        safeKeyExpr = `(${keyArg})||("lu_k_${i}_"+${idxVar})`;
      }

      let tagArg = parts[0];
      let propsArg = parts[1];
      let isStaticArg = parts[3] || "!1";
      let sourceArg = parts[4] || `void 0`;
      let selfArg = parts[5] || `void 0`;

      let newJsxCall = `u.jsxDEV(${tagArg}, ${propsArg}, ${safeKeyExpr}, ${isStaticArg}, ${sourceArg}, ${selfArg})`;

      lUBody = lUBody.substring(0, absJsxPos) + newJsxCall + lUBody.substring(endJsxPos);
      count++;
    }
  }

  content = content.substring(0, lUStart) + lUBody + content.substring(lUEnd);
  fs.writeFileSync(filePath, content);
  console.log(`[${filePath}] Successfully patched ${count} JSX keys in lU component.`);
}

patchFile("assets/index-BezkRbwM.js");
if (fs.existsSync("dist/assets/index-BezkRbwM.js")) {
  patchFile("dist/assets/index-BezkRbwM.js");
}
