const fs = require("fs");
let code = fs.readFileSync("mG_dump.js", "utf8");

// 1. Add handlers
const handlers = `
  const amIReady = m?.players?.find(p => p.username === r?.username)?.isReady || false;
  const toggleReady = () => {
    if (o && m && r) {
      o.emit("toggle_ready", { roomId: m.id, username: r.username, isReady: !amIReady });
    }
  };
  const kickPlayer = (targetUsername) => {
    if (o && m && r && isHost && window.confirm("ต้องการเตะผู้เล่นนี้ออกจากห้อง?")) {
      o.emit("kick_player", { roomId: m.id, targetUsername, hostUsername: r.username });
    }
  };
  const allReady = m?.players?.every(p => (m.hostUsername ? p.username === m.hostUsername : false) || p.id === m.hostId || p.isReady) || false;
`;

let isHostIdx = code.indexOf("const isHost=");
let isHostEnd = code.indexOf(";", isHostIdx) + 1;
code = code.substring(0, isHostEnd) + handlers + code.substring(isHostEnd);

// 2. Replace player map
const oldPlayerMap = `m.players.map((player,idx)=>u.jsxDEV("div",{className:"flex items-center justify-between bg-stone-900 border border-stone-800 rounded-xl p-3",children:[u.jsxDEV("div",{className:"flex items-center gap-3",children:[u.jsxDEV("div",{className:"w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs",children:idx+1}),u.jsxDEV("span",{className:"font-bold text-stone-200 text-sm",children:[player.username,((m.hostUsername?player.username===m.hostUsername:!1)||player.id===m.hostId||idx===0)&&u.jsxDEV("span",{className:"ml-2 text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold",children:"หัวหน้าห้อง"})]})]},void 0,!0),u.jsxDEV("span",{className:"w-2.5 h-2.5 rounded-full bg-emerald-500"})]},(player.id||player.username||"p")+"_"+idx,!1))`;

const newPlayerMap = `m.players.map((player,idx)=>{
  const isPlayerHost = (m.hostUsername?player.username===m.hostUsername:!1)||player.id===m.hostId||idx===0;
  const isMe = player.username === r?.username;
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
      (isHost && !isPlayerHost) && u.jsxDEV("button", {onClick: () => kickPlayer(player.username), className: "ml-2 text-[10px] bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 px-2 py-1 rounded transition-colors", children: "เตะออก"}, void 0, !0)
    ]}, void 0, !0)
  ]},(player.id||player.username||"p")+"_"+idx,!1);
})`;

code = code.replace(oldPlayerMap, newPlayerMap);

// 3. Replace bottom buttons
const oldButtons = `isHost?u.jsxDEV("button",{onClick:O,className:"flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-600/25 transition-all text-sm flex items-center justify-center gap-2",children:[u.jsxDEV(mS,{className:"w-4 h-4"}),"เริ่มการแข่งขันทันที"]},void 0,!0):u.jsxDEV("div",{className:"flex-1 bg-stone-950 border border-stone-800 text-stone-500 py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2",children:[u.jsxDEV(pm,{className:"w-4 h-4 animate-spin"}),"รอหัวหน้าห้องกดเริ่มเกม..."]},void 0,!0)`;

const newButtons = `isHost ? u.jsxDEV("button",{onClick:O, disabled: (!allReady && m.players.length > 1), className:"flex-1 " + ((allReady || m.players.length === 1) ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25" : "bg-stone-700 text-stone-400 cursor-not-allowed") + " font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2",children:[u.jsxDEV("span",{className:"text-base"},void 0,!0),(!allReady && m.players.length > 1) ? "รอผู้เล่นพร้อม..." : "เริ่มการแข่งขันทันที"]},void 0,!0) 
: u.jsxDEV("button",{onClick: toggleReady, className:"flex-1 " + (amIReady ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/25" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25") + " text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2",children: amIReady ? "ยกเลิกพร้อม" : "พร้อมแล้ว!"},void 0,!0)`;

code = code.replace(oldButtons, newButtons);

fs.writeFileSync("mG_dump_final.js", code);
console.log("Patched mG successfully.");
