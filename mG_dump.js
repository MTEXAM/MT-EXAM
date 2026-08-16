mG=({currentUser:r,subjects:e,onRequireLogin:n,onExamStateChange:i})=>{
  const[o,c]=k.useState(null),
       [m,f]=k.useState(null),
       [B,g]=k.useState(""),
       [N,y]=k.useState("all"),
       [E,T]=k.useState(10),
       [R,W]=k.useState(null),
       [Y,ae]=k.useState(!1),
       [Ve,Re]=k.useState(120),
       [Ue,xe]=k.useState(null),
       [reviewList,setReviewList]=k.useState([]),
       [reviewFilter,setReviewFilter]=k.useState("all");
  const questionLocalStartTimeRef=k.useRef(Date.now());
  const prevQIndexRef=k.useRef(-1);
  const prevStatusRef=k.useRef("");

  k.useEffect(()=>(i&&i((m==null?void 0:m.status)==="playing"),()=>{i&&i(!1)}),[m==null?void 0:m.status,i]);

  const currentQ=(m&&m.questions&&m.currentQuestionIndex!==undefined)?m.questions[m.currentQuestionIndex]:null;

  const cleanOptionPrefix=(text)=>{
    if(!text)return"";
    return text.replace(/^(\([A-Ea-e1-5ก-ฮ]\)|[A-Ea-e1-5ก-ฮ]\s*[\.\)\-:]|[A-Ea-e]\s+)\s*/,"").trim()||text;
  };

  const randomizedChoices=k.useMemo(()=>{
    if(!currentQ||!Array.isArray(currentQ.options))return[];
    const raw=currentQ.options.map((te,fe)=>{
      const clean=cleanOptionPrefix(te);
      return{text:clean,originalIndex:fe,isCorrect:fe===currentQ.correctAnswer};
    });
    const sh=[...raw];
    for(let te=sh.length-1;te>0;te--){
      const fe=Math.floor(Math.random()*(te+1));
      [sh[te],sh[fe]]=[sh[fe],sh[te]];
    }
    return sh;
  },[m==null?void 0:m.id,m==null?void 0:m.currentQuestionIndex,currentQ==null?void 0:currentQ.id]);

  k.useEffect(()=>{
    if(!r)return;
    const te=cb();
    c(te);
    te.on("room_state",fe=>{
      f(fe);
      W(null);
    });
    te.on("error",fe=>{
      W(fe.message);
    });
    return()=>{
      te.disconnect();
    };
  },[r]);
  k.useEffect(()=>{
    if(!m||m.status!=="playing"){
      prevQIndexRef.current=-1;
      prevStatusRef.current=m?m.status:"";
      return;
    }
    const isNewQuestion=prevQIndexRef.current!==m.currentQuestionIndex||prevStatusRef.current!=="playing";
    if(isNewQuestion){
      prevQIndexRef.current=m.currentQuestionIndex;
      prevStatusRef.current="playing";
      xe(null);
      let sElapsed=0;
      if(m.serverTime&&m.questionStartTime&&m.questionStartTime>0){
        sElapsed=Math.max(0,(m.serverTime-m.questionStartTime)/1000);
      }
      questionLocalStartTimeRef.current=Date.now()-(sElapsed*1000);
      const initRemaining=Math.max(0,Math.ceil(120-sElapsed));
      Re(initRemaining);
    }
  },[m==null?void 0:m.status,m==null?void 0:m.currentQuestionIndex,m==null?void 0:m.questionStartTime,m==null?void 0:m.serverTime]);
  k.useEffect(()=>{
    if(!m||m.status!=="playing")return;
    const te=setInterval(()=>{
      const elapsed=Math.max(0,(Date.now()-questionLocalStartTimeRef.current)/1000);
      const remaining=Math.max(0,Math.ceil(120-elapsed));
      Re(remaining);
      remaining===0&&((m.hostUsername&&r?m.hostUsername===r.username:!1)||(m.players&&m.players[0]&&r?m.players[0].username===r.username:!1)||m.hostId===(o==null?void 0:o.id))&&(o==null||o.emit("next_question",m.id));
    },250);
    return()=>clearInterval(te);
  },[m==null?void 0:m.id,m==null?void 0:m.status,m==null?void 0:m.hostId,o]);
  k.useEffect(()=>{
    const fe=new URLSearchParams(window.location.search).get("room");
    fe&&r&&o&&!m?(o.emit("join_room",{roomId:fe,username:r.username}),window.history.replaceState({},document.title,window.location.pathname)):fe&&!r&&n();
  },[r,o]);
  const Je=()=>{
    const te="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let fe="";
    for(let we=0;we<6;we++)fe+=te.charAt(Math.floor(Math.random()*te.length));
    return fe;
  };

  const G=()=>{
    if(!r)return n();
    if(!o)return;
    if(m){
      o.emit("leave_room",{roomId:m.id,username:r.username});
    }
    setReviewList([]);
    setReviewFilter("all");
    xe(null);
    W(null);
    const te=Je();
    o.emit("create_room",{roomId:te,hostId:o.id,username:r.username,subject:N,limit:E});
  };

  const S=()=>{
    if(!r)return n();
    if(!o||!B.trim())return;
    if(m){
      o.emit("leave_room",{roomId:m.id,username:r.username});
    }
    setReviewList([]);
    setReviewFilter("all");
    xe(null);
    W(null);
    o.emit("join_room",{roomId:B.toUpperCase().trim(),username:r.username});
  };

  const I=()=>{
    if(!m)return;
    const fe=`มาแข่งทดสอบความรู้เทคนิคการแพทย์กัน! คลิก: ${window.location.origin}${window.location.pathname}?room=${m.id} สมัครสมาชิกหรือเข้าสู่ระบบก่อนเริ่มแข่งกับเพื่อน`;
    navigator.clipboard.writeText(fe);
    ae(!0);
    setTimeout(()=>ae(!1),2e3);
  };

  const O=()=>{
    !o||!m||(setReviewList([]),o.emit("start_game",m.id));
  };

  const H=(te,fe)=>{
    if(!o||!m||Ue!==null)return;
    const currentQuestion=m.questions[m.currentQuestionIndex];
    if(!currentQuestion)return;
    xe(fe);
    const isCorrect=!!te.isCorrect;
    const elapsedSeconds=Math.max(0.1,Number(((Date.now()-questionLocalStartTimeRef.current)/1000).toFixed(1)));
    let points=0;
    if(isCorrect){
      points=100;
      if(elapsedSeconds>5){
        points-=Math.floor(elapsedSeconds-5);
      }
      points=Math.max(30,points);
    }
    const reviewItem={
      questionIndex:m.currentQuestionIndex,
      questionText:currentQuestion.question,
      subject:currentQuestion.subject,
      options:currentQuestion.options,
      selectedChoiceText:te.text,
      selectedOriginalIndex:te.originalIndex,
      correctAnswerIndex:currentQuestion.correctAnswer,
      correctAnswerText:cleanOptionPrefix(currentQuestion.options[currentQuestion.correctAnswer]||""),
      isCorrect:isCorrect,
      timeSpent:elapsedSeconds,
      pointsEarned:points,
      answered:true
    };
    setReviewList(prev=>{
      const exists=prev.findIndex(p=>p.questionIndex===m.currentQuestionIndex);
      if(exists!==-1){
        const updated=[...prev];
        updated[exists]=reviewItem;
        return updated;
      }
      return[...prev,reviewItem];
    });
    o.emit("submit_answer",{roomId:m.id,username:r==null?void 0:r.username,isCorrect:isCorrect,clientTimeSpent:elapsedSeconds});
  };
  const M=()=>{
    if(o&&m&&r){
      o.emit("leave_room",{roomId:m.id,username:r.username});
    }
    f(null);
    g("");
    W(null);
    xe(null);
    setReviewList([]);
    setReviewFilter("all");
  };

    const myLiveScore=k.useMemo(()=>{return reviewList.reduce((acc,cur)=>acc+(cur.pointsEarned||0),0);},[reviewList]);
  const completeReviewList=k.useMemo(()=>{
    if(!m||!Array.isArray(m.questions))return reviewList;
    return m.questions.map((q,idx)=>{
      const found=reviewList.find(p=>p.questionIndex===idx);
      if(found)return found;
      return{
        questionIndex:idx,
        questionText:q.question,
        subject:q.subject,
        options:q.options,
        selectedChoiceText:"ไม่ได้ตอบ (หมดเวลา)",
        selectedOriginalIndex:-1,
        correctAnswerIndex:q.correctAnswer,
        correctAnswerText:cleanOptionPrefix(q.options[q.correctAnswer]||""),
        isCorrect:false,
        timeSpent:120,
        pointsEarned:0,
        answered:false
      };
    });
  },[m==null?void 0:m.status,m==null?void 0:m.questions,reviewList]);

  if(!r)return u.jsxDEV("div",{className:"flex flex-col items-center justify-center py-20",children:[u.jsxDEV(ah,{className:"w-12 h-12 text-stone-500 mb-4"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:170,columnNumber:9},void 0),u.jsxDEV("h2",{className:"text-xl font-bold text-stone-200 mb-2",children:"เข้าสู่ระบบเพื่อเข้าแข่งขัน"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:171,columnNumber:9},void 0),u.jsxDEV("p",{className:"text-stone-400 mb-6 text-sm",children:"คุณต้องเข้าสู่ระบบก่อนจึงจะสามารถสร้างห้องหรือเข้าร่วมแข่งขันได้"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:172,columnNumber:9},void 0),u.jsxDEV("button",{onClick:n,className:"bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold transition-colors",children:"เข้าสู่ระบบ / สมัครสมาชิก"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:173,columnNumber:9},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:169,columnNumber:7},void 0);

  if(!m)return u.jsxDEV("div",{className:"w-full max-w-4xl mx-auto space-y-6",children:u.jsxDEV("div",{className:"bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden",children:[u.jsxDEV("div",{className:"absolute top-0 right-0 p-8 opacity-5",children:u.jsxDEV(yf,{className:"w-48 h-48"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:188,columnNumber:13},void 0)},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:187,columnNumber:11},void 0),u.jsxDEV("div",{className:"relative z-10",children:[u.jsxDEV("h2",{className:"text-2xl font-extrabold text-white mb-2 flex items-center gap-2",children:[u.jsxDEV(yf,{className:"w-6 h-6 text-indigo-400"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:193,columnNumber:15},void 0),"แข่งขันกับเพื่อน"]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:192,columnNumber:13},void 0),u.jsxDEV("p",{className:"text-stone-400 text-sm mb-8",children:"ท้าประลองความรู้แบบ Real-time กับเพื่อนๆ โจทย์เดียวกัน สลับช้อยส์อิสระ พร้อมระบบคิดคะแนนตามความเร็ว"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:194,columnNumber:13},void 0),R&&u.jsxDEV("div",{className:"bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-2xl mb-6 text-sm flex items-center gap-2",children:[u.jsxDEV(Iy,{className:"w-5 h-5 shrink-0"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:197,columnNumber:17},void 0),R]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:196,columnNumber:15},void 0),u.jsxDEV("div",{className:"grid md:grid-cols-2 gap-6",children:[u.jsxDEV("div",{className:"bg-stone-950/60 border border-stone-800/80 rounded-2xl p-6 flex flex-col justify-between space-y-6",children:[u.jsxDEV("div",{className:"space-y-4",children:[u.jsxDEV("h3",{className:"text-lg font-bold text-stone-200 flex items-center gap-2",children:[u.jsxDEV(Vm,{className:"w-5 h-5 text-indigo-400"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:205,columnNumber:23},void 0),"สร้างห้องแข่งขัน"]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:204,columnNumber:21},void 0),u.jsxDEV("div",{children:[u.jsxDEV("label",{className:"block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2",children:"วิชาที่ต้องการทดสอบ"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:208,columnNumber:23},void 0),u.jsxDEV("select",{value:N,onChange:te=>y(te.target.value),className:"w-full bg-stone-900 border border-stone-700 text-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500",children:[u.jsxDEV("option",{value:"all",children:"รวมทุกวิชา (สุ่มข้อสอบ)"},"subj_all",!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:210,columnNumber:25},void 0),...e.map((te,teIdx)=>u.jsxDEV("option",{value:te,children:te},"subj_"+te+"_"+teIdx,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:211,columnNumber:38},void 0))]},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:209,columnNumber:23},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:207,columnNumber:21},void 0),u.jsxDEV("div",{children:[u.jsxDEV("label",{className:"block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2",children:"จำนวนข้อ"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:216,columnNumber:23},void 0),u.jsxDEV("div",{className:"flex gap-2",children:[5,10,15,20].map((te,teIdx)=>u.jsxDEV("button",{type:"button",onClick:()=>T(te),className:`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${E===te?"bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20":"bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-300"}`,children:[te," ข้อ"]},"limit_"+te+"_"+teIdx,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:218,columnNumber:27},void 0))},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:217,columnNumber:23},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:215,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:203,columnNumber:19},void 0),u.jsxDEV("button",{onClick:G,className:"w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2",children:[u.jsxDEV(mS,{className:"w-5 h-5"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:225,columnNumber:23},void 0),"สร้างห้องและเริ่มเชิญเพื่อน"]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:224,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:202,columnNumber:17},void 0),u.jsxDEV("div",{className:"bg-stone-950/60 border border-stone-800/80 rounded-2xl p-6 flex flex-col justify-between space-y-6",children:[u.jsxDEV("div",{className:"space-y-4",children:[u.jsxDEV("h3",{className:"text-lg font-bold text-stone-200 flex items-center gap-2",children:[u.jsxDEV(lm,{className:"w-5 h-5 text-emerald-400"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:233,columnNumber:23},void 0),"เข้าร่วมห้องด้วยรหัส"]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:232,columnNumber:21},void 0),u.jsxDEV("p",{className:"text-stone-400 text-xs",children:"กรอกรหัสห้อง 6 หลัก ที่ได้รับจากเพื่อนเพื่อเข้าร่วมการแข่งขัน"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:234,columnNumber:21},void 0),u.jsxDEV("div",{children:[u.jsxDEV("label",{className:"block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2",children:"รหัสห้อง (Room Code)"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:236,columnNumber:23},void 0),u.jsxDEV("input",{type:"text",value:B,onChange:te=>g(te.target.value.toUpperCase()),placeholder:"เช่น 4X8B9Q",maxLength:8,className:"w-full bg-stone-900 border border-stone-700 text-stone-100 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest uppercase outline-none focus:border-emerald-500 transition-colors"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:237,columnNumber:23},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:235,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:231,columnNumber:19},void 0),u.jsxDEV("button",{onClick:S,disabled:!B.trim(),className:"w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2",children:[u.jsxDEV(Vm,{className:"w-5 h-5"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:243,columnNumber:23},void 0),"เข้าร่วมห้องแข่งขัน"]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:242,columnNumber:21},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:230,columnNumber:17},void 0)]},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:201,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:191,columnNumber:11},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:186,columnNumber:9},void 0)},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:185,columnNumber:7},void 0);

  if(m.status==="waiting"){
    const isHost=(m.hostUsername&&r?m.hostUsername===r.username:!1)||(m.players&&m.players[0]&&r?m.players[0].username===r.username:!1)||((o==null?void 0:o.id)===m.hostId);
    return u.jsxDEV("div",{className:"w-full max-w-2xl mx-auto space-y-6",children:u.jsxDEV("div",{className:"bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6",children:[u.jsxDEV("div",{className:"flex items-center justify-between border-b border-stone-800 pb-4",children:[u.jsxDEV("div",{children:[u.jsxDEV("span",{className:"text-xs font-bold text-indigo-400 uppercase tracking-wider",children:"ห้องแข่งขัน"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:256,columnNumber:17},void 0),u.jsxDEV("h3",{className:"text-2xl font-black text-white font-mono tracking-wider",children:m.id},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:257,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:255,columnNumber:15},void 0),u.jsxDEV("button",{onClick:I,className:"flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-200 px-4 py-2 rounded-xl text-sm font-semibold transition-all border border-stone-700",children:[Y?u.jsxDEV(tv,{className:"w-4 h-4 text-emerald-400"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:260,columnNumber:21},void 0):u.jsxDEV(tH,{className:"w-4 h-4"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:260,columnNumber:71},void 0),Y?"คัดลอกลิงก์แล้ว!":"แชร์ลิงก์ให้เพื่อน"]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:259,columnNumber:15},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:254,columnNumber:13},void 0),u.jsxDEV("div",{className:"bg-stone-950/60 border border-stone-800/80 rounded-2xl p-4 space-y-3",children:[u.jsxDEV("div",{className:"flex items-center justify-between text-xs text-stone-400 font-medium",children:[u.jsxDEV("span",{children:["วิชา: ",u.jsxDEV("span",{className:"text-stone-200 font-bold",children:m.subject==="all"?"รวมทุกวิชา":m.subject},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:267,columnNumber:30},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:267,columnNumber:17},void 0),u.jsxDEV("span",{children:["จำนวน: ",u.jsxDEV("span",{className:"text-stone-200 font-bold",children:[m.questions.length," ข้อ"]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:268,columnNumber:32},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:268,columnNumber:17},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:266,columnNumber:15},void 0),u.jsxDEV("div",{className:"h-px bg-stone-800"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:270,columnNumber:15},void 0),u.jsxDEV("div",{className:"flex items-center justify-between",children:[u.jsxDEV("div",{className:"flex items-center gap-2 text-sm font-bold text-stone-300",children:[u.jsxDEV(lm,{className:"w-4 h-4 text-indigo-400"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:273,columnNumber:19},void 0),u.jsxDEV("span",{children:["ผู้เล่นในห้อง (",m.players.length,")"]})]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:272,columnNumber:17},void 0),u.jsxDEV("span",{className:"text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 animate-pulse",children:"กำลังรอเริ่มแข่งขัน"})]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:271,columnNumber:15},void 0),u.jsxDEV("div",{className:"space-y-2 pt-2",children:m.players.map((player,idx)=>u.jsxDEV("div",{className:"flex items-center justify-between bg-stone-900 border border-stone-800 rounded-xl p-3",children:[u.jsxDEV("div",{className:"flex items-center gap-3",children:[u.jsxDEV("div",{className:"w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs",children:idx+1}),u.jsxDEV("span",{className:"font-bold text-stone-200 text-sm",children:[player.username,((m.hostUsername?player.username===m.hostUsername:!1)||player.id===m.hostId||idx===0)&&u.jsxDEV("span",{className:"ml-2 text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold",children:"หัวหน้าห้อง"})]})]},void 0,!0),u.jsxDEV("span",{className:"w-2.5 h-2.5 rounded-full bg-emerald-500"})]},(player.id||player.username||"p")+"_"+idx,!1))},void 0,!1)]},void 0,!0),u.jsxDEV("div",{className:"flex gap-3 pt-2",children:[u.jsxDEV("button",{onClick:M,className:"flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold py-3 px-4 rounded-xl transition-all text-sm",children:"ออกจากห้อง"},void 0,!1),isHost?u.jsxDEV("button",{onClick:O,className:"flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-600/25 transition-all text-sm flex items-center justify-center gap-2",children:[u.jsxDEV(mS,{className:"w-4 h-4"}),"เริ่มการแข่งขันทันที"]},void 0,!0):u.jsxDEV("div",{className:"flex-1 bg-stone-950 border border-stone-800 text-stone-500 py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2",children:[u.jsxDEV(pm,{className:"w-4 h-4 animate-spin"}),"รอหัวหน้าห้องกดเริ่มเกม..."]},void 0,!0)]},void 0,!0)]},void 0,!0)},void 0,!1);
  }

  if(m.status==="finished"){
    const sortedPlayers=[...m.players].sort((a,b)=>b.score-a.score);
    const myPlayer=m.players.find(p=>p.username===r.username);
    const myRank=sortedPlayers.findIndex(p=>p.username===r.username)+1;
    const totalQuestions=completeReviewList.length||m.questions.length;
    const correctCount=completeReviewList.filter(item=>item.isCorrect).length;
    const accuracyPercent=totalQuestions>0?Math.round((correctCount/totalQuestions)*100):0;
    const totalTime=completeReviewList.reduce((acc,cur)=>acc+(cur.timeSpent||0),0);
    const avgTime=totalQuestions>0?(totalTime/totalQuestions).toFixed(1):"0.0";

    const filteredReviews=completeReviewList.filter(item=>{
      if(reviewFilter==="correct")return item.isCorrect;
      if(reviewFilter==="incorrect")return !item.isCorrect;
      return true;
    });

    return u.jsxDEV("div",{className:"w-full max-w-4xl mx-auto space-y-6 pb-12",children:[
      u.jsxDEV("div",{className:"bg-stone-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden",children:[
        u.jsxDEV("div",{className:"text-center max-w-md mx-auto mb-8",children:[
          u.jsxDEV(KC,{className:"w-16 h-16 text-amber-400 mx-auto mb-3 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]"},void 0,!1),
          u.jsxDEV("h2",{className:"text-2xl sm:text-3xl font-black text-white mb-2",children:"สรุปผลการแข่งขัน"},void 0,!1),
          u.jsxDEV("p",{className:"text-stone-400 text-sm",children:["วิชา: ",m.subject==="all"?"รวมทุกวิชา":m.subject," • ",totalQuestions," ข้อ"]} ,void 0,!0)
        ]},void 0,!0),

        u.jsxDEV("div",{className:"mb-8",children:[
          u.jsxDEV("h3",{className:"text-sm font-bold text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-2",children:[
            u.jsxDEV(yH,{className:"w-4 h-4 text-amber-400"}),
            "อันดับคะแนนผู้เข้าแข่งขัน"
          ]},void 0,!0),
          u.jsxDEV("div",{className:"space-y-2.5",children:sortedPlayers.map((player,idx)=>{
            const isMe=player.username===r.username;
            const rankStyles=[
              "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/40 text-amber-300",
              "bg-gradient-to-r from-slate-400/15 via-slate-400/5 to-transparent border-slate-400/40 text-slate-300",
              "bg-gradient-to-r from-amber-700/15 via-amber-700/5 to-transparent border-amber-700/40 text-amber-400"
            ];
            const defaultStyle="bg-stone-950/80 border-stone-800 text-stone-300";
            return u.jsxDEV("div",{className:`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all ${idx<3?rankStyles[idx]:defaultStyle} ${isMe?"ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/10":""}`,children:[
              u.jsxDEV("div",{className:"flex items-center gap-3.5",children:[
                u.jsxDEV("div",{className:`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-sm ${idx===0?"bg-amber-400 text-stone-950 shadow-md shadow-amber-400/30":idx===1?"bg-slate-300 text-stone-950":idx===2?"bg-amber-700 text-white":"bg-stone-800 text-stone-400"}`,children:idx+1}),
                u.jsxDEV("div",{children:[
                  u.jsxDEV("div",{className:"flex items-center gap-2",children:[
                    u.jsxDEV("span",{className:`font-bold text-sm sm:text-base ${isMe?"text-white":"text-stone-200"}`,children:player.username}),
                    isMe&&u.jsxDEV("span",{className:"bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-[10px] px-2 py-0.5 rounded-full font-bold",children:"คุณ"})
                  ]},void 0,!0),
                  u.jsxDEV("div",{className:"text-xs text-stone-500",children:idx===0?"🏆 ชนะเลิศอันดับ 1":idx===1?"🥈 รองชนะเลิศอันดับ 1":idx===2?"🥉 รองชนะเลิศอันดับ 2":`อันดับที่ ${idx+1}`})
                ]},void 0,!0)
              ]},void 0,!0),
              u.jsxDEV("div",{className:"text-right",children:[
                u.jsxDEV("div",{className:"text-lg sm:text-xl font-black text-white font-mono",children:[player.score," pt"]},void 0,!0),
                u.jsxDEV("div",{className:"text-[10px] text-stone-400",children:"คะแนนสะสม"})
              ]},void 0,!0)
            ]},(player.id||player.username||"sp")+"_"+idx,!1);
          })},void 0,!1)
        ]},void 0,!0),

        u.jsxDEV("div",{className:"grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8",children:[
          u.jsxDEV("div",{className:"bg-stone-950/70 border border-stone-800 rounded-2xl p-4 text-center",children:[
            u.jsxDEV("div",{className:"text-xs text-stone-400 mb-1",children:"อันดับของคุณ"}),
            u.jsxDEV("div",{className:"text-2xl font-black text-amber-400",children:[myRank," / ",sortedPlayers.length]}),
            u.jsxDEV("div",{className:"text-[10px] text-stone-500 mt-0.5",children:"Ranking"})
          ]},void 0,!0),
          u.jsxDEV("div",{className:"bg-stone-950/70 border border-stone-800 rounded-2xl p-4 text-center",children:[
            u.jsxDEV("div",{className:"text-xs text-stone-400 mb-1",children:"คะแนนรวม"}),
            u.jsxDEV("div",{className:"text-2xl font-black text-emerald-400 font-mono",children:[(myPlayer==null?void 0:myPlayer.score)||0," pt"]}),
            u.jsxDEV("div",{className:"text-[10px] text-stone-500 mt-0.5",children:"Total Score"})
          ]},void 0,!0),
          u.jsxDEV("div",{className:"bg-stone-950/70 border border-stone-800 rounded-2xl p-4 text-center",children:[
            u.jsxDEV("div",{className:"text-xs text-stone-400 mb-1",children:"ตอบถูกต้อง"}),
            u.jsxDEV("div",{className:"text-2xl font-black text-indigo-400",children:[correctCount," / ",totalQuestions]}),
            u.jsxDEV("div",{className:"text-[10px] text-indigo-400/80 font-bold mt-0.5",children:[`(${accuracyPercent}%)`]})
          ]},void 0,!0),
          u.jsxDEV("div",{className:"bg-stone-950/70 border border-stone-800 rounded-2xl p-4 text-center",children:[
            u.jsxDEV("div",{className:"text-xs text-stone-400 mb-1",children:"เวลาเฉลี่ย/ข้อ"}),
            u.jsxDEV("div",{className:"text-2xl font-black text-amber-300 font-mono",children:[avgTime,"s"]}),
            u.jsxDEV("div",{className:"text-[10px] text-stone-500 mt-0.5",children:"Avg Time"})
          ]},void 0,!0)
        ]},void 0,!0),

        u.jsxDEV("div",{className:"flex flex-col sm:flex-row gap-3 pt-2 border-t border-stone-800",children:[
          u.jsxDEV("button",{onClick:G,className:"flex-1 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2",children:[
            u.jsxDEV(mS,{className:"w-5 h-5"}),
            "สร้างห้องแข่งขันใหม่"
          ]},void 0,!0),
          u.jsxDEV("button",{onClick:M,className:"flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold py-3.5 px-6 rounded-2xl border border-stone-700 transition-all flex items-center justify-center gap-2",children:[
            u.jsxDEV(Dc,{className:"w-5 h-5"}),
            "กลับไปหน้าเลือกห้อง / หน้าหลัก"
          ]},void 0,!0)
        ]},void 0,!0)
      ]},void 0,!0),

      u.jsxDEV("div",{className:"space-y-4",children:[
        u.jsxDEV("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:px-6",children:[
          u.jsxDEV("div",{children:[
            u.jsxDEV("h3",{className:"text-lg font-bold text-white flex items-center gap-2",children:[
              u.jsxDEV(XR,{className:"w-5 h-5 text-indigo-400"}),
              "ตรวจทานข้อสอบและเฉลยละเอียด"
            ]},void 0,!0),
            u.jsxDEV("p",{className:"text-xs text-stone-400",children:"ตรวจสอบคำตอบที่คุณเลือก เปรียบเทียบกับเฉลยที่ถูกต้องตามฐานข้อมูล"})
          ]},void 0,!0),
          u.jsxDEV("div",{className:"flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800 self-start sm:self-auto",children:[
            u.jsxDEV("button",{onClick:()=>setReviewFilter("all"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reviewFilter==="all"?"bg-indigo-600 text-white":"text-stone-400 hover:text-stone-200"}`,children:["ทั้งหมด (",totalQuestions,")"]},void 0,!0),
            u.jsxDEV("button",{onClick:()=>setReviewFilter("correct"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reviewFilter==="correct"?"bg-emerald-600 text-white":"text-stone-400 hover:text-emerald-400"}`,children:["ตอบถูก (",correctCount,")"]},void 0,!0),
            u.jsxDEV("button",{onClick:()=>setReviewFilter("incorrect"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reviewFilter==="incorrect"?"bg-rose-600 text-white":"text-stone-400 hover:text-rose-400"}`,children:["ตอบผิด (",totalQuestions-correctCount,")"]},void 0,!0)
          ]},void 0,!0)
        ]},void 0,!0),

        u.jsxDEV("div",{className:"space-y-4",children:filteredReviews.map((item,itemIdx)=>{
          return u.jsxDEV("div",{className:`bg-stone-900 border rounded-3xl p-5 sm:p-6 transition-all ${item.isCorrect?"border-emerald-500/30":"border-rose-500/30"}`,children:[
            u.jsxDEV("div",{className:"flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/80 pb-3 mb-4",children:[
              u.jsxDEV("div",{className:"flex items-center gap-2.5",children:[
                u.jsxDEV("span",{className:`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${item.isCorrect?"bg-emerald-500/20 text-emerald-300 border border-emerald-500/30":"bg-rose-500/20 text-rose-300 border border-rose-500/30"}`,children:item.questionIndex+1}),
                u.jsxDEV("span",{className:"text-xs font-bold text-stone-400 bg-stone-950 px-2.5 py-1 rounded-full border border-stone-800",children:item.subject})
              ]},void 0,!0),
              u.jsxDEV("div",{className:"flex items-center gap-2",children:[
                u.jsxDEV("span",{className:`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${item.isCorrect?"bg-emerald-500/20 text-emerald-300 border border-emerald-500/30":item.answered?"bg-rose-500/20 text-rose-300 border border-rose-500/30":"bg-amber-500/20 text-amber-300 border border-amber-500/30"}`,children:[
                  item.isCorrect?u.jsxDEV(zF,{className:"w-3.5 h-3.5"}):u.jsxDEV(Iy,{className:"w-3.5 h-3.5"}),
                  item.isCorrect?`ตอบถูก (+${item.pointsEarned} pt)`:item.answered?"ตอบผิด (0 pt)":"หมดเวลา (0 pt)"
                ]},void 0,!0),
                u.jsxDEV("span",{className:"text-xs font-mono font-bold text-stone-400 bg-stone-950 px-2.5 py-1 rounded-full border border-stone-800 flex items-center gap-1",children:[
                  u.jsxDEV(pm,{className:"w-3.5 h-3.5 text-stone-500"}),
                  `${item.timeSpent} วินาที`
                ]},void 0,!0)
              ]},void 0,!0)
            ]},void 0,!0),

            u.jsxDEV("h4",{className:"text-base sm:text-lg font-semibold text-stone-100 leading-relaxed whitespace-pre-wrap mb-5",children:item.questionText},void 0,!1),

            u.jsxDEV("div",{className:"space-y-2.5",children:item.options.map((optRaw,optIdx)=>{
              const optClean=cleanOptionPrefix(optRaw);
              const isCorrectAnswer=optIdx===item.correctAnswerIndex;
              const isUserChoice=optIdx===item.selectedOriginalIndex;

              let cardStyle="bg-stone-950/60 border-stone-800 text-stone-400";
              let badge=null;

              if(isCorrectAnswer&&isUserChoice){
                cardStyle="bg-emerald-950/70 border-emerald-500 text-emerald-200 font-semibold shadow-lg shadow-emerald-950/40";
                badge=u.jsxDEV("span",{className:"ml-auto text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1",children:[u.jsxDEV(zF,{className:"w-3.5 h-3.5"}),"คำตอบของคุณ (ถูกต้อง)"]},void 0,!0);
              }else if(isCorrectAnswer){
                cardStyle="bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold";
                badge=u.jsxDEV("span",{className:"ml-auto text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1",children:[u.jsxDEV(zF,{className:"w-3.5 h-3.5"}),"เฉลยที่ถูกต้อง"]},void 0,!0);
              }else if(isUserChoice){
                cardStyle="bg-rose-950/60 border-rose-500 text-rose-200 font-semibold";
                badge=u.jsxDEV("span",{className:"ml-auto text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1",children:[u.jsxDEV(Iy,{className:"w-3.5 h-3.5"}),"คำตอบของคุณ"]},void 0,!0);
              }

              return u.jsxDEV("div",{className:`w-full p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center gap-3 ${cardStyle}`,children:[
                u.jsxDEV("div",{className:`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCorrectAnswer?"bg-emerald-500 text-stone-950":isUserChoice?"bg-rose-500 text-white":"bg-stone-800 text-stone-400"}`,children:["A","B","C","D","E"][optIdx]||(optIdx+1)}),
                u.jsxDEV("div",{className:"text-sm sm:text-base leading-snug flex-1",children:optClean}),
                badge
              ]},"opt_"+(item.questionIndex!==undefined?item.questionIndex:0)+"_"+optIdx,!1);
            })},void 0,!1)
          ]},"rev_"+(item.questionIndex!==undefined?item.questionIndex:itemIdx)+"_"+itemIdx,!1);
        })},void 0,!1)
      ]},void 0,!0)
    ]},void 0,!0);
  }

  const j=m.questions[m.currentQuestionIndex],
        He=m.players.find(te=>te.username===r.username),
        tt=(m.hostUsername&&r?m.hostUsername===r.username:!1)||(m.players&&m.players[0]&&r?m.players[0].username===r.username:!1)||((o==null?void 0:o.id)===m.hostId);

  return u.jsxDEV("div",{className:"w-full max-w-4xl mx-auto space-y-6",children:[
    u.jsxDEV("div",{className:"flex justify-between items-center bg-stone-900 border border-stone-800 px-6 py-4 rounded-2xl",children:[
      u.jsxDEV("div",{className:"flex items-center gap-4",children:[
        u.jsxDEV("div",{className:"text-stone-400 text-sm font-semibold",children:[
          "ข้อที่ ",
          u.jsxDEV("span",{className:"text-white text-lg",children:[m.currentQuestionIndex+1," / ",m.questions.length]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:381,columnNumber:72},void 0)
        ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:381,columnNumber:11},void 0),
        u.jsxDEV("div",{className:"w-px h-6 bg-stone-800"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:382,columnNumber:11},void 0),
        u.jsxDEV("div",{className:"text-sm font-bold text-amber-400",children:[
          "คะแนน: ",
          myLiveScore
        ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:383,columnNumber:11},void 0)
      ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:380,columnNumber:9},void 0),
      u.jsxDEV("div",{className:`flex items-center gap-2 font-mono font-bold text-lg ${Ve<=10?"text-rose-500 animate-pulse":"text-emerald-400"}`,children:[
        u.jsxDEV(pm,{className:"w-5 h-5"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:386,columnNumber:11},void 0),
        Math.floor(Ve/60),
        ":",
        (Ve%60).toString().padStart(2,"0")
      ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:385,columnNumber:9},void 0)
    ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:379,columnNumber:7},void 0),
    u.jsxDEV("div",{className:"grid md:grid-cols-4 gap-6",children:[
      u.jsxDEV("div",{className:"md:col-span-3 space-y-4",children:[
        u.jsxDEV("div",{className:"bg-stone-900 border border-stone-800 rounded-3xl p-6 md:p-8",children:[
          u.jsxDEV("h3",{className:"text-lg md:text-xl font-semibold text-stone-100 leading-relaxed whitespace-pre-wrap mb-8",children:j.question},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:394,columnNumber:14},void 0),
          u.jsxDEV("div",{className:"space-y-3",children:randomizedChoices.map((te,fe)=>{
            const we=Ue===fe;
            return u.jsxDEV("button",{onClick:()=>H(te,fe),disabled:He==null?void 0:He.hasAnsweredCurrent,className:`w-full text-left p-4 rounded-2xl border-2 transition-all ${we?"bg-indigo-600/20 border-indigo-500 text-indigo-300":He!=null&&He.hasAnsweredCurrent?"bg-stone-950 border-stone-800 text-stone-500 opacity-50":"bg-stone-950 border-stone-800 hover:border-stone-600 text-stone-300"}`,children:u.jsxDEV("div",{className:"flex gap-3",children:[u.jsxDEV("div",{className:"w-6 shrink-0 font-bold text-stone-500",children:[["A","B","C","D","E"][fe],"."]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:413,columnNumber:24},void 0),u.jsxDEV("div",{children:te.text},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:414,columnNumber:24},void 0)]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:412,columnNumber:22},void 0)},"choice_"+(m?m.currentQuestionIndex:0)+"_"+fe,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:401,columnNumber:20},void 0);
          })},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:397,columnNumber:14},void 0)
        ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:393,columnNumber:11},void 0),
        (He==null?void 0:He.hasAnsweredCurrent)&&u.jsxDEV("div",{className:"bg-stone-900/50 p-4 rounded-2xl text-center text-sm text-stone-400 animate-pulse flex items-center justify-center gap-2 border border-stone-800",children:[
          u.jsxDEV(pm,{className:"w-4 h-4"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:424,columnNumber:15},void 0),
          " กำลังรอผู้เล่นคนอื่นตอบ..."
        ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:423,columnNumber:13},void 0)
      ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:392,columnNumber:9},void 0),
      u.jsxDEV("div",{className:"space-y-4",children:[
        u.jsxDEV("div",{className:"bg-stone-900 border border-stone-800 rounded-2xl p-4",children:[
          u.jsxDEV("h4",{className:"font-bold text-stone-300 mb-3 text-sm flex items-center gap-2",children:[
            u.jsxDEV(lm,{className:"w-4 h-4 text-indigo-400"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:432,columnNumber:15},void 0),
            "สถานะผู้เล่น"
          ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:431,columnNumber:13},void 0),
          u.jsxDEV("div",{className:"space-y-2",children:m.players.map((te,teIdx)=>u.jsxDEV("div",{className:"flex items-center justify-between bg-stone-950 rounded-xl p-2.5 border border-stone-800/50",children:[
            u.jsxDEV("div",{className:"text-xs font-semibold text-stone-300 truncate",children:te.username},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:438,columnNumber:19},void 0),
            u.jsxDEV("div",{children:te.hasAnsweredCurrent?u.jsxDEV(zF,{className:"w-4 h-4 text-emerald-500"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:440,columnNumber:45},void 0):u.jsxDEV("div",{className:"w-4 h-4 rounded-full border-2 border-stone-700"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:440,columnNumber:100},void 0)},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:439,columnNumber:19},void 0)
          ]},(te.id||te.username||"pl")+"_"+teIdx,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:437,columnNumber:17},void 0))},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:435,columnNumber:13},void 0)
        ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:430,columnNumber:11},void 0),
        tt&&u.jsxDEV("button",{onClick:()=>o==null?void 0:o.emit("end_game",m.id),className:"w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2",children:[
          u.jsxDEV(Iy,{className:"w-4 h-4"},void 0,!1,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:452,columnNumber:15},void 0),
          " จบการแข่งขันก่อนกำหนด"
        ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:448,columnNumber:13},void 0)
      ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:429,columnNumber:9},void 0)
    ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:391,columnNumber:7},void 0)
  ]},void 0,!0,{fileName:"/app/applet/src/components/MultiplayerView.tsx",lineNumber:378,columnNumber:5},void 0);
}