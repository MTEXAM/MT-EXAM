const fs = require("fs");

function checkFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");

  const reg = /\.map\(\s*(\([^\)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*/g;
  let m;
  let missing = [];

  while ((m = reg.exec(content)) !== null) {
    let mapPos = m.index;
    let snippet = content.substring(mapPos, mapPos + 800);
    let jsxPos = snippet.indexOf("u.jsxDEV(");
    if (jsxPos !== -1) {
      let jsxStr = snippet.substring(jsxPos);
      let depth = 0;
      let parts = [];
      let current = "";
      let inStr = false;
      let strChar = "";

      for (let i = "u.jsxDEV(".length; i < jsxStr.length; i++) {
        let ch = jsxStr[i];
        if (inStr) {
          current += ch;
          if (ch === strChar && jsxStr[i - 1] !== "\\") {
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

      let keyArg = parts[2];
      if (!keyArg || keyArg === "void 0" || keyArg === "undefined") {
        missing.push({ pos: mapPos, snippet: snippet.substring(0, 150), keyArg, args: m[1] });
      }
    }
  }

  console.log(`[${filePath}] Total missing keys found: ${missing.length}`);
  missing.forEach((item, idx) => {
    console.log(`\n--- [#${idx + 1}] Pos ${item.pos} (Args: ${item.args}, KeyArg: ${item.keyArg}) ---`);
    console.log(item.snippet);
  });
}

checkFile("assets/index-BezkRbwM.js");
