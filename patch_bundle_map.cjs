const fs = require("fs");
let code = fs.readFileSync("public/assets/index-BezkRbwM.js", "utf8");

const newPlayerMap = `m.players.map((player,idx)=>{
  const isPlayerHost = (m.hostUsername?player.username===m.hostUsername:!1)||player.id===m.hostId||idx===0;
  return u.jsxDEV("div",{className:"flex items-center justify-between bg-stone-900 border border-stone-800 rounded-xl p-3",children:[
    u.jsxDEV("div",{className:"flex items-center gap-3",children:[
      u.jsxDEV("div",{className:"w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs",children:idx+1}),
      u.jsxDEV("div",{className:"flex flex-col",children:[
        u.jsxDEV("span",{className:"font-bold text-stone-200 text-sm flex items-center gap-2",children:[
          player.username,
          isPlayerHost && u.jsxDEV("span",{className:"text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold",children:"หัวหน้าห้อง"})
        ]}),
        (!isPlayerHost) && u.jsxDEV("span",{className:"text-[10px] font-semibold mt-0.5 " + (player.isReady ? "text-emerald-400" : "text-amber-400"),children:player.isReady ? "✅ พร้อมแล้ว" : "⏳ กำลังเตรียมพร้อม..."})
      ]})
    ]},void 0,!0),
    u.jsxDEV("div", {className: "flex items-center gap-2", children: [
      u.jsxDEV("span",{className:"w-2.5 h-2.5 rounded-full " + (isPlayerHost || player.isReady ? "bg-emerald-500" : "bg-amber-500")}),
      (isHost && !isPlayerHost) && u.jsxDEV("button", {onClick: () => { if(o && window.confirm("ต้องการเตะผู้เล่นนี้ออกจากห้อง?")) o.emit("kick_player", { roomId: m.id, targetUsername: player.username, hostUsername: r.username }); }, className: "ml-2 text-[10px] bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 px-2 py-1 rounded transition-colors cursor-pointer relative z-10", children: "เตะออก"}, void 0, !0)
    ]}, void 0, !0)
  ]},"wait_p_"+(player.id||player.username||idx),!1);
})`;

let startIdx = code.indexOf("m.players.map((player,idx)");
let endIdx = code.indexOf("void 0))", startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  let full = code.substring(startIdx, endIdx + 8);
  code = code.replace(full, newPlayerMap);
  fs.writeFileSync("public/assets/index-BezkRbwM.js", code);
  console.log("Player map replaced.");
} else {
  console.log("Not found.", startIdx, endIdx);
}
