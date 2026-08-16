const fs = require("fs");
let server = fs.readFileSync("server.ts", "utf8");

const notifyRoomOriginal = `    // 1. Update in-memory public comments status
    if (db.publicComments && Array.isArray(db.publicComments)) {
      db.publicComments.forEach((pc: any) => {
        if (
          (pc.roomId && pc.roomId.trim().toUpperCase() === cleanId) ||
          (pc.message && pc.message.toUpperCase().includes(\`[\${cleanId}]\`))
        ) {
          pc.roomStatus = currentStatus;
        }
      });
    }`;

const notifyRoomReplacement = `    // 1. Update in-memory public comments status and save to DB
    let updated = false;
    if (db.publicComments && Array.isArray(db.publicComments)) {
      db.publicComments.forEach((pc: any) => {
        if (
          (pc.roomId && pc.roomId.trim().toUpperCase() === cleanId) ||
          (pc.message && pc.message.toUpperCase().includes(\`[\${cleanId}]\`))
        ) {
          pc.roomStatus = currentStatus;
          updated = true;
        }
      });
      if (updated) {
        saveDb();
      }
    }`;

if (server.includes(notifyRoomOriginal)) {
  server = server.replace(notifyRoomOriginal, notifyRoomReplacement);
  fs.writeFileSync("server.ts", server);
  console.log("Patched server.ts successfully");
} else {
  console.log("Original code not found in server.ts");
}
