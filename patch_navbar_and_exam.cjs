const fs = require("fs");

function patchNavbarAndExamView(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");

  // 1. Patch Navbar
  let navTarget = `u.jsxDEV("div",{className:"flex items-center flex-wrap gap-1.5 my-1 md:my-0 relative",children:[r&&u.jsxDEV(u.Fragment,{children:[`;
  let navPos = content.indexOf(navTarget);

  if (navPos !== -1) {
    let insertSnippet = `u.jsxDEV("button",{onClick:(X)=>{X.preventDefault();window.openExamUploadModal();},className:"px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-800/80 flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-emerald-900/30"},"k_nav_upload",!1,children:["📤 [อัพโหลดข้อสอบ]"]),u.jsxDEV("button",{onClick:(X)=>{X.preventDefault();window.openFAQModal();},className:"px-2.5 py-1.5 bg-stone-950 hover:bg-stone-800 text-amber-300 text-xs font-semibold rounded-lg border border-amber-800/60 flex items-center gap-1 transition-colors cursor-pointer"},"k_nav_faq",!1,children:["❓ คำถามที่พบบ่อย"]),(r==null?void 0:r.role)==="admin"?u.jsxDEV("button",{onClick:()=>e("admin"),className:"px-2.5 py-1.5 bg-amber-500 text-stone-950 hover:bg-amber-400 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-amber-500/20"},"k_nav_admin_tab",!1,children:["👑 จัดการแอดมิน"]):u.jsxDEV("button",{onClick:()=>i("admin_login"),className:"px-2.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 text-xs font-bold rounded-lg border border-purple-800/80 flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-purple-900/30"},"k_nav_admin_side",!1,children:["🔑 ฝั่งแอดมิน"]),`;
    let replaceNav = `u.jsxDEV("div",{className:"flex items-center flex-wrap gap-1.5 my-1 md:my-0 relative",children:[${insertSnippet}r&&u.jsxDEV(u.Fragment,{children:[`;
    content = content.replace(navTarget, replaceNav);
    console.log(`[${filePath}] Navbar patched successfully.`);
  } else {
    console.log(`[${filePath}] Navbar target not found.`);
  }

  // 2. Patch ExamView top toolbar
  let examTarget = `!E&&!$e&&u.jsxDEV("div",{className:"bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-6",children:[`;
  let examPos = content.indexOf(examTarget);

  if (examPos !== -1) {
    let examInsertSnippet = `u.jsxDEV("div",{className:"bg-stone-950/80 border border-amber-500/30 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-inner"},"k_exam_top_toolbar",!1,children:[u.jsxDEV("div",{className:"flex items-center gap-2 text-xs text-amber-300 font-semibold"},"k_e_h",!1,children:["⚡ ทางด่วนระบบ:"]),u.jsxDEV("div",{className:"flex flex-wrap items-center gap-2"},"k_e_btns",!1,children:[u.jsxDEV("button",{onClick:(X)=>{X.preventDefault();window.openExamUploadModal();},className:"px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-900/30"},"k_e_up",!1,children:["📤 [อัพโหลดข้อสอบ]"]),u.jsxDEV("button",{onClick:(X)=>{X.preventDefault();window.openFAQModal();},className:"px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"},"k_e_faq",!1,children:["❓ คำถามที่พบบ่อย"]),(e==null?void 0:e.role)==="admin"?u.jsxDEV("button",{onClick:()=>m("admin"),className:"px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20"},"k_e_ad1",!1,children:["👑 ศูนย์ควบคุมแอดมิน"]):u.jsxDEV("button",{onClick:()=>m("admin_login"),className:"px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-purple-900/30"},"k_e_ad2",!1,children:["🔑 เข้าสู่ระบบฝั่งแอดมิน"])])]),`;
    let replaceExam = `!E&&!$e&&u.jsxDEV("div",{className:"bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-6",children:[${examInsertSnippet}`;
    content = content.replace(examTarget, replaceExam);
    console.log(`[${filePath}] ExamView patched successfully.`);
  } else {
    console.log(`[${filePath}] ExamView target not found.`);
  }

  fs.writeFileSync(filePath, content);
}

patchNavbarAndExamView("assets/index-BezkRbwM.js");
patchNavbarAndExamView("dist/assets/index-BezkRbwM.js");
