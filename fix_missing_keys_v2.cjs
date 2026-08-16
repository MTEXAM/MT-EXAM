const fs = require("fs");

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");
  let fixedCount = 0;

  // Find all u.jsxDEV(tag, props) calls that are inside .map callback and lack a 3rd arg key
  // We can loop until no more missing keys are found or replace iteratively.

  let changed = true;
  while (changed) {
    changed = false;

    // Find first .map(...) that has u.jsxDEV lacking a key
    const reg = /\.map\(\s*(\([^\)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*/g;
    let m;
    while ((m = reg.exec(content)) !== null) {
      let mapPos = m.index;
      let argsStr = m[1];
      let snippet = content.substring(mapPos, mapPos + 2500);

      let jsxPos = snippet.indexOf("u.jsxDEV(");
      if (jsxPos === -1) continue;

      let absJsxPos = mapPos + jsxPos;
      let jsxStr = content.substring(absJsxPos);

      // Parse u.jsxDEV call
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
        let keyArg = parts[2];
        if (!keyArg || keyArg === "void 0" || keyArg === "undefined") {
          // Found a missing key!
          // Determine index var
          let keyVar = null;
          let newHeader = null;

          if (argsStr.startsWith("(") && argsStr.endsWith(")")) {
            let inner = argsStr.substring(1, argsStr.length - 1).split(",").map(s => s.trim());
            if (inner.length >= 2 && inner[1]) {
              keyVar = inner[1];
            } else if (inner.length === 1 && inner[0]) {
              keyVar = "ak_idx";
              newHeader = `(${inner[0]}, ak_idx) =>`;
            }
          } else if (/^[a-zA-Z0-9_$]+$/.test(argsStr)) {
            keyVar = "ak_idx";
            newHeader = `(${argsStr}, ak_idx) =>`;
          }

          if (!keyVar) keyVar = "ak_idx";

          let tagArg = parts[0];
          let propsArg = parts[1];
          let isStaticArg = parts[3] || "!1";
          let sourceArg = parts[4] || `void 0`;
          let selfArg = parts[5] || `void 0`;

          let keyExpr = `"k_ak_"+${keyVar}`;
          let newJsxCall = `u.jsxDEV(${tagArg}, ${propsArg}, ${keyExpr}, ${isStaticArg}, ${sourceArg}, ${selfArg})`;

          let oldJsxCall = content.substring(absJsxPos, endJsxPos);

          content = content.substring(0, absJsxPos) + newJsxCall + content.substring(endJsxPos);

          if (newHeader) {
            let oldHeaderStr = m[0]; // e.g. ".map(Ce => "
            let headerPos = content.lastIndexOf(oldHeaderStr, absJsxPos);
            if (headerPos !== -1) {
              content = content.substring(0, headerPos) + `.map(${newHeader} ` + content.substring(headerPos + oldHeaderStr.length);
            }
          }

          fixedCount++;
          changed = true;
          break; // Break inner loop and restart outer loop
        }
      }
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`[${filePath}] Fixed ${fixedCount} JSX calls missing key prop.`);
}

fixFile("assets/index-BezkRbwM.js");
fixFile("dist/assets/index-BezkRbwM.js");
