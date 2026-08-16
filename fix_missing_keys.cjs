const fs = require("fs");

function fixKeysInFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log("File not found:", filePath);
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let changesCount = 0;

  // Regex matching `.map(`
  const reg = /\.map\(\s*(\([^\)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*/g;
  let m;

  let matches = [];
  while ((m = reg.exec(content)) !== null) {
    matches.push({ index: m.index, argsStr: m[1], rawMatch: m[0] });
  }

  // Iterate backwards
  for (let i = matches.length - 1; i >= 0; i--) {
    let item = matches[i];
    let mapPos = item.index;
    let snippet = content.substring(mapPos, mapPos + 2500);

    let jsxPos = snippet.indexOf("u.jsxDEV(");
    if (jsxPos === -1) continue;

    let absJsxPos = mapPos + jsxPos;

    // Parse u.jsxDEV arguments
    let jsxStr = content.substring(absJsxPos);
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

    if (parts.length < 2) continue;

    let keyArg = parts[2];
    // Check if key argument is missing or void 0
    if (!keyArg || keyArg === "void 0" || keyArg === "undefined") {
      let callbackArgsStr = item.argsStr; // e.g. "(V, pe)", "an", "([Bn, an])", "ye"
      let keyVar = null;
      let newCallbackHeader = null;

      if (callbackArgsStr.startsWith("(") && callbackArgsStr.endsWith(")")) {
        let inner = callbackArgsStr.substring(1, callbackArgsStr.length - 1).split(",").map(s => s.trim());
        if (inner.length >= 2 && inner[1]) {
          keyVar = inner[1];
        } else if (inner.length === 1 && inner[0]) {
          keyVar = "auto_k_idx";
          newCallbackHeader = `(${inner[0]}, auto_k_idx) =>`;
        }
      } else if (/^[a-zA-Z0-9_$]+$/.test(callbackArgsStr)) {
        keyVar = "auto_k_idx";
        newCallbackHeader = `(${callbackArgsStr}, auto_k_idx) =>`;
      }

      if (!keyVar) keyVar = "auto_k_idx";

      let keyExpr = `"k_auto_"+${keyVar}`;

      let tagArg = parts[0];
      let propsArg = parts[1];
      let isStaticArg = parts[3] || "!1";
      let sourceArg = parts[4] || `void 0`;
      let selfArg = parts[5] || `void 0`;

      let newJsxCall = `u.jsxDEV(${tagArg}, ${propsArg}, ${keyExpr}, ${isStaticArg}, ${sourceArg}, ${selfArg})`;

      let oldJsxCall = content.substring(absJsxPos, endJsxPos);
      content = content.substring(0, absJsxPos) + newJsxCall + content.substring(endJsxPos);

      if (newCallbackHeader) {
        let oldHeader = item.rawMatch;
        let mapHeaderPos = content.lastIndexOf(oldHeader, absJsxPos);
        if (mapHeaderPos !== -1) {
          let newHeader = `.map(${newCallbackHeader} `;
          content = content.substring(0, mapHeaderPos) + newHeader + content.substring(mapHeaderPos + oldHeader.length);
        }
      }

      changesCount++;
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`[${filePath}] Successfully patched ${changesCount} missing keys.`);
}

fixKeysInFile("assets/index-BezkRbwM.js");
fixKeysInFile("dist/assets/index-BezkRbwM.js");
