const fs = require("fs");

const content = fs.readFileSync("assets/index-BezkRbwM.js", "utf8");

const reg = /\.map\(\s*(\([^\)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*/g;
let m;
let count = 0;

while ((m = reg.exec(content)) !== null) {
  let mapPos = m.index;
  let snippet = content.substring(mapPos, mapPos + 600);
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
      count++;
      console.log(`\n================== [#${count}] Map Pos: ${mapPos} ==================`);
      console.log("MAP ARGS:", m[1]);
      console.log("FULL MAP RETURN SNIPPET:\n" + content.substring(mapPos, mapPos + 350));
    }
  }
}
