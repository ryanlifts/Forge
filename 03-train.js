"use strict";
// ================== TRAIN ==================
const wDaySel = document.getElementById("wDay");
document.getElementById("wDate").value = todayStr();

function renderDayOptions(){
  wDaySel.innerHTML = "";
  program.days.forEach(p=>{
    const o=document.createElement("option"); o.value=p.id; o.textContent=(p.id?p.id+" · ":"")+p.title;
    wDaySel.appendChild(o);
  });
  const c=document.createElement("option"); c.value="__CARDIO__"; c.textContent="Cardio / Conditioning";
  wDaySel.appendChild(c);
  const f=document.createElement("option"); f.value="__FREE__"; f.textContent="Freestyle (build from library)";
  wDaySel.appendChild(f);
}
function renderCardioOptions(){
  const sel = document.getElementById("cardioType");
  sel.innerHTML = "";
  CARDIO_TYPES.forEach(c=>{ const o=document.createElement("option"); o.value=c; o.textContent=c; sel.appendChild(o); });
}
function renderLibraryOptions(){
  const sel = document.getElementById("addExSel");
  sel.innerHTML = "";
  const og1 = document.createElement("optgroup"); og1.label="Strength";
  EXERCISE_LIBRARY.forEach(x=>{ const o=document.createElement("option"); o.value=x; o.textContent=x; og1.appendChild(o); });
  const og2 = document.createElement("optgroup"); og2.label="Cardio";
  CARDIO_TYPES.forEach(x=>{ const o=document.createElement("option"); o.value="[Cardio] "+x; o.textContent=x; og2.appendChild(o); });
  const og3 = document.createElement("optgroup"); og3.label="Custom";
  const oc = document.createElement("option"); oc.value="__CUSTOM__"; oc.textContent="Type my own…"; og3.appendChild(oc);
  sel.appendChild(og1); sel.appendChild(og2); sel.appendChild(og3);
}

wDaySel.addEventListener("change", ()=>{ if (typeof editingWorkoutIdx!=="undefined" && editingWorkoutIdx!=null) endWorkoutEdit(true); extraExercises=[]; initSessionState(); renderSessionInputs(); });

function currentDayExercises(){
  const v = wDaySel.value;
  if (v==="__CARDIO__" || v==="__FREE__") return [];
  const day = program.days.find(p=>p.id===v);
  return day ? day.exercises : [];
}

// ---------- set-row engine ----------
let sessionState = {}; // exName -> {mode:"rows"|"text", rows:[{w,r,done}], text:""}

function toRows(val){
  // converts a stored sets value (array or legacy string) into editable rows
  if (Array.isArray(val)) return val.map(s=>({w:s.w, r:s.r, done:false}));
  if (typeof val === "string"){
    const rows = [];
    const re = /(\d+(?:\.\d+)?)\s*[x\u00d7]\s*(\d+)/g;
    let m;
    while((m = re.exec(val)) !== null){
      rows.push({w:parseFloat(m[1]), r:parseInt(m[2],10), done:false});
    }
    return rows;
  }
  return [];
}
function formatSets(val){
  if (Array.isArray(val)) return val.map(s=>s.w+"\u00d7"+s.r).join(", ");
  return String(val);
}
function parseScheme(scheme){
  // "4\u00d75" or "3x8-12" -> {sets:4, reps:5} (reps = lower bound of a range)
  if (!scheme) return null;
  const m = String(scheme).match(/(\d+)\s*[x\u00d7]\s*(\d+)/);
  return m ? {sets:parseInt(m[1],10), reps:parseInt(m[2],10)} : null;
}
function prefillRows(ex, lastVal){
  const sch = parseScheme(ex.scheme);
  if (lastVal){
    const rows = toRows(lastVal);
    if (rows.length){
      // auto-progression: all reps hit target and weights uniform -> suggest +5
      let auto = false;
      if (sch && rows.every(r=>r.r>=sch.reps)){
        const w0 = rows[0].w;
        if (rows.every(r=>r.w===w0) && w0>0){
          rows.forEach(r=>{ r.w = w0+5; r.r = sch.reps; });
          auto = true;
        }
      }
      return {rows:rows, auto:auto};
    }
  }
  // no history: build empty rows from scheme
  const n = sch ? sch.sets : 3;
  const rows = [];
  for(let i=0;i<n;i++) rows.push({w:"", r: sch?sch.reps:"", done:false});
  return {rows:rows, auto:false};
}
function initSessionState(){
  sessionState = {};
  sessionSwaps = {};
  const v = wDaySel.value;
  if (v==="__CARDIO__") return;
  const last = (v!=="__FREE__") ? lastSessionFor(v) : null;
  sessionList().forEach(ex=>{
    const isCardio = ex.name.indexOf("[Cardio] ")===0;
    if (isCardio){
      sessionState[ex.name] = {mode:"text", rows:[], text:"", auto:false};
    } else {
      const pf = prefillRows(ex, last && last.sets ? last.sets[ex.name.replace("[Cardio] ","")] : null);
      sessionState[ex.name] = {mode:"rows", rows:pf.rows, text:"", auto:pf.auto};
    }
  });
}

function renderSessionInputs(){
  const v = wDaySel.value;
  const strengthBlock = document.getElementById("strengthBlock");
  const cardioBlock = document.getElementById("cardioBlock");
  if (v==="__CARDIO__"){
    strengthBlock.classList.add("hidden"); cardioBlock.classList.remove("hidden");
    return;
  }
  strengthBlock.classList.remove("hidden"); cardioBlock.classList.add("hidden");
  const last = (v!=="__FREE__") ? lastSessionFor(v) : null;
  const list = sessionList();
  const container = document.getElementById("exerciseInputs");
  container.innerHTML = "";
  if (!list.length){
    container.innerHTML = '<div class="note" style="margin-bottom:14px;">No exercises yet \u2014 add from the library below.</div>';
    return;
  }
  list.forEach(ex=>{
    if (!sessionState[ex.name]) {
      const pf = prefillRows(ex, last && last.sets ? last.sets[ex.name.replace("[Cardio] ","")] : null);
      sessionState[ex.name] = ex.name.indexOf("[Cardio] ")===0
        ? {mode:"text", rows:[], text:"", auto:false}
        : {mode:"rows", rows:pf.rows, text:"", auto:pf.auto};
    }
    const st = sessionState[ex.name];
    const prevVal = last && last.sets ? last.sets[ex.name.replace("[Cardio] ","")] : null;
    const div = document.createElement("div");
    div.className = "exercise";
    const head = document.createElement("div");
    head.className = "x-head";
    head.innerHTML = '<span><b>'+esc(ex.name.replace("[Cardio] ",""))+'</b>'
      +(ex.scheme?' <span class="scheme">\u00b7 '+esc(ex.scheme)+'</span>':'')
      +(st.auto?' <span class="autoUp">+5 auto</span>':'')+'</span>';
    const tools = document.createElement("div");
    tools.className = "x-tools";
    if (prevVal){
      const sameBtn = document.createElement("button");
      sameBtn.className = "xbtn"; sameBtn.textContent = "= last";
      sameBtn.title = "Log same as last time";
      sameBtn.addEventListener("click", ()=>{
        st.mode = "rows";
        st.rows = toRows(prevVal).map(r=>({w:r.w, r:r.r, done:true}));
        st.auto = false;
        renderSessionInputs();
      });
      tools.appendChild(sameBtn);
    }
    const vBtn = document.createElement("button");
    vBtn.className = "xbtn"; vBtn.textContent = "Video";
    vBtn.title = "How to do this - video";
    vBtn.addEventListener("click", ()=>openFormVideo(ex.name));
    tools.appendChild(vBtn);
    const origName = ex.__orig || ex.name;
    if (ALT_MAP[origName] || ex.__orig){
      const swBtn = document.createElement("button");
      swBtn.className = "xbtn"; swBtn.textContent = "\u21C4";
      swBtn.title = "Swap for an alternative";
      swBtn.addEventListener("click", ()=>{
        const existing = div.querySelector(".swapmenu");
        if (existing) { existing.remove(); return; }
        const holder = document.createElement("div");
        holder.className = "swapmenu";
        div.insertBefore(holder, div.children[1] || null);
        offerSwap(origName, ex.name, holder);
      });
      tools.appendChild(swBtn);
    }
    const tBtn = document.createElement("button");
    tBtn.className = "xbtn"; tBtn.textContent = st.mode==="rows" ? "Aa" : "#";
    tBtn.title = "Toggle text entry";
    tBtn.addEventListener("click", ()=>{
      if (st.mode==="rows"){
        st.text = st.rows.filter(r=>r.w&&r.r).map(r=>r.w+"x"+r.r).join(", ");
        st.mode = "text";
      } else {
        st.rows = toRows(st.text);
        if(!st.rows.length) st.rows = [{w:"",r:"",done:false}];
        st.mode = "rows";
      }
      renderSessionInputs();
    });
    tools.appendChild(tBtn);
    head.appendChild(tools);
    div.appendChild(head);
    if (prevVal){
      const lastLine = document.createElement("div");
      lastLine.style.cssText = "color:var(--dim); font-size:11px; margin-bottom:6px;";
      lastLine.textContent = "last: "+formatSets(prevVal);
      div.appendChild(lastLine);
    }

    if (st.mode==="text"){
      const inp = document.createElement("input");
      inp.placeholder = ex.name.indexOf("[Cardio] ")===0 ? "e.g. 20 min, 2 mi" : "e.g. 275x5, 275x5, 275x4";
      inp.value = st.text;
      inp.addEventListener("input", ()=>{ st.text = inp.value; });
      div.appendChild(inp);
    } else {
      st.rows.forEach((row, ri)=>{
        const rdiv = document.createElement("div");
        rdiv.className = "srow";
        rdiv.innerHTML = '<span class="slabel">Set '+(ri+1)+'</span>';
        const mkStep = (txt, fn)=>{ const b=document.createElement("button"); b.className="step"; b.textContent=txt; b.addEventListener("click", fn); return b; };
        const wIn = document.createElement("input");
        wIn.type="number"; wIn.className="snum"; wIn.inputMode="decimal"; wIn.placeholder="lb"; wIn.value=row.w;
        wIn.addEventListener("input", ()=>{ row.w = wIn.value===""?"":Number(wIn.value); });
        const rIn = document.createElement("input");
        rIn.type="number"; rIn.className="snum"; rIn.inputMode="numeric"; rIn.placeholder="reps"; rIn.value=row.r;
        rIn.addEventListener("input", ()=>{ row.r = rIn.value===""?"":Number(rIn.value); });
        rdiv.appendChild(mkStep("\u22125", ()=>{ row.w = Math.max(0,(Number(row.w)||0)-5); wIn.value=row.w; }));
        rdiv.appendChild(wIn);
        rdiv.appendChild(mkStep("+5", ()=>{ row.w = (Number(row.w)||0)+5; wIn.value=row.w; }));
        const x = document.createElement("span"); x.className="sx"; x.textContent="\u00d7"; rdiv.appendChild(x);
        rdiv.appendChild(mkStep("\u22121", ()=>{ row.r = Math.max(0,(Number(row.r)||0)-1); rIn.value=row.r; }));
        rdiv.appendChild(rIn);
        rdiv.appendChild(mkStep("+1", ()=>{ row.r = (Number(row.r)||0)+1; rIn.value=row.r; }));
        const done = document.createElement("button");
        done.className = "sdone"+(row.done?" on":""); done.textContent = "\u2713";
        done.setAttribute("aria-label","Mark set done");
        done.addEventListener("click", ()=>{
          row.done = !row.done;
          done.className = "sdone"+(row.done?" on":"");
          if (row.done) startRest(cfg.restSec||90);
        });
        rdiv.appendChild(done);
        div.appendChild(rdiv);
      });
      const addRow = document.createElement("button");
      addRow.className = "xbtn"; addRow.textContent = "+ Add set";
      addRow.style.marginTop = "2px";
      addRow.addEventListener("click", ()=>{
        const filled = st.rows.slice().reverse().find(r=>Number(r.w)>0);
        const prev = filled || st.rows[st.rows.length-1];
        st.rows.push(prev ? {w:prev.w, r:prev.r, done:false} : {w:"", r:"", done:false});
        renderSessionInputs();
      });
      div.appendChild(addRow);
    }
    container.appendChild(div);
  });
}

document.getElementById("addExSel").addEventListener("change", ()=>{
  document.getElementById("addExCustom").classList.toggle("hidden", document.getElementById("addExSel").value!=="__CUSTOM__");
});
document.getElementById("addExBtn").addEventListener("click", ()=>{
  let name = document.getElementById("addExSel").value;
  if (name==="__CUSTOM__"){
    name = document.getElementById("addExCustom").value.trim();
    if (!name){ flashSave("Type the exercise name", true); return; }
    document.getElementById("addExCustom").value = "";
    document.getElementById("addExCustom").classList.add("hidden");
    document.getElementById("addExSel").selectedIndex = 0;
  }
  extraExercises.push({name:name, scheme:""});
  renderSessionInputs();
});

document.getElementById("logWorkoutBtn").addEventListener("click", ()=>{
  const v = wDaySel.value;
  const date = document.getElementById("wDate").value;
  const notes = document.getElementById("wNotes").value.trim();

  if (v==="__CARDIO__"){
    const type = document.getElementById("cardioType").value;
    const min = document.getElementById("cardioMin").value;
    const detail = document.getElementById("cardioDetail").value.trim();
    if(!min) return;
    const sets = {}; sets[type] = min+" min"+(detail?" \u00b7 "+detail:"");
    const cObj = {date:date, day:"CARDIO", title:"Cardio", sets:sets, notes:notes};
    const wasCardioEdit = editingWorkoutIdx!=null;
    if (wasCardioEdit){ data.workouts[editingWorkoutIdx] = cObj; }
    else { data.workouts.push(cObj); bumpLog(); }
    document.getElementById("cardioMin").value=""; document.getElementById("cardioDetail").value="";
    save(); renderWork(); renderDash(); renderBackup();
    if (wasCardioEdit){
      endWorkoutEdit();
      ackBtn("logWorkoutBtn", "\u2713 Session updated");
      flashSave("Session updated \u2713");
    } else {
      showCelebration("Cardio Banked", null, type+" \u00b7 "+min+" min");
    }
    return;
  }
  const sets = {};
  Object.keys(sessionState).forEach(exName=>{
    const st = sessionState[exName];
    const key = exName.replace("[Cardio] ","");
    if (st.mode==="text"){
      if (st.text.trim()) sets[key] = st.text.trim();
    } else {
      const rows = st.rows.filter(r=>Number(r.w)>0 && Number(r.r)>0).map(r=>({w:Number(r.w), r:Number(r.r)}));
      if (rows.length) sets[key] = rows;
    }
  });
  if(Object.keys(sets).length===0) return;
  // PR detection BEFORE pushing the new session
  const prLines = [];
  Object.keys(sets).forEach(ex=>{
    const nb = parseBestSet(sets[ex]);
    if(!nb) return;
    const hist = bestHistorical(ex, editingWorkoutIdx!=null ? editingWorkoutIdx : -1);
    if (hist && nb.e1rm > hist.e1rm + 0.5){
      prLines.push("\ud83c\udfc6 PR: "+ex+" "+nb.w+"\u00d7"+nb.r+" (est 1RM "+Math.round(nb.e1rm)+", was "+Math.round(hist.e1rm)+")");
    }
  });
  const day = program.days.find(p=>p.id===v);
  const wasEdit = editingWorkoutIdx!=null;
  if (wasEdit){
    const orig = data.workouts[editingWorkoutIdx];
    data.workouts[editingWorkoutIdx] = {date:date, day:orig.day, title:orig.title, sets:sets, notes:notes};
  } else {
    data.workouts.push({date:date, day:v, title: v==="__FREE__" ? "Freestyle" : (day?day.title:v), sets:sets, notes:notes});
    bumpLog();
  }
  extraExercises=[];
  initSessionState();
  renderSessionInputs();
  document.getElementById("wNotes").value="";
  save(); renderWork(); renderDash(); renderNextWorkout(); renderBackup();
  if (wasEdit){
    endWorkoutEdit();
    ackBtn("logWorkoutBtn", "\u2713 Session updated");
    flashSave("Session updated \u2713"+(prLines.length?" \u00b7 PR!":""));
    return;
  }
  const streak = computeStreak();
  showCelebration(prLines.length ? "PR FORGED" : "Session Forged", prLines,
    Object.keys(sets).length+" exercises logged"+(streak>1?"  \u00b7  \ud83d\udd25 "+streak+"-day streak":""));
});

function renderWork(){
  renderPRs();
  document.getElementById("programName").textContent = program.name || "Unnamed program";
  const el = document.getElementById("workHistory");
  if(data.workouts.length===0){
    el.innerHTML = '<div style="padding:18px; font-size:13px; color:var(--dim);">No sessions yet.</div>';
    return;
  }
  const sorted = data.workouts.map((s,idx)=>Object.assign({},s,{idx})).sort((a,b)=>b.date.localeCompare(a.date));
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const groups = {};
  const order = [];
  sorted.forEach(s=>{
    const key = s.date.slice(0,7);
    if (!groups[key]){ groups[key] = []; order.push(key); }
    groups[key].push(s);
  });
  const curKey = todayStr().slice(0,7);
  el.innerHTML = order.map(key=>{
    const list = groups[key];
    const label = MONTHS[Number(key.slice(5,7))-1]+" "+key.slice(0,4);
    const openAttr = key===curKey ? " open" : "";
    const body = list.map(s=>{
      const dayObj = program.days.find(p=>p.id===s.day);
      const title = s.title || (dayObj?dayObj.title:s.day);
      const setsHTML = Object.keys(s.sets).map(ex=>'<div>'+esc(ex)+': <span style="color:var(--text)">'+esc(formatSets(s.sets[ex]))+'</span></div>').join("");
      return '<div style="padding:14px 16px; border-bottom:1px solid var(--border); font-size:12px;">'
        +'<div style="display:flex; justify-content:space-between;">'
        +'<span style="font-weight:600; color:var(--ember);">'+fmtDate(s.date)+' — '+esc(title)+'</span>'
        +'<button class="del edtWork" data-i="'+s.idx+'" aria-label="Edit" style="color:var(--dim); margin-right:2px;">✎</button>'
        +'<button class="del delWork" data-i="'+s.idx+'" aria-label="Delete">✕</button></div>'
        +'<div style="color:var(--dim); margin-top:6px; line-height:1.7;">'+setsHTML
        +(s.notes?'<div style="color:var(--ember); margin-top:3px;">Note: '+esc(s.notes)+'</div>':'')
        +'</div></div>';
    }).join("");
    return '<details'+openAttr+' style="border-bottom:1px solid var(--border);">'
      +'<summary style="padding:12px 16px; cursor:pointer; font-family:\'Oswald\',sans-serif; font-weight:600; font-size:13px; letter-spacing:.05em; text-transform:uppercase; color:var(--text); list-style:none; display:flex; justify-content:space-between;">'
      +'<span>'+label+'</span><span style="color:var(--dim); font-size:11px;">'+list.length+' session'+(list.length===1?'':'s')+'</span></summary>'
      +body+'</details>';
  }).join("");
  el.querySelectorAll(".delWork").forEach(b=>b.addEventListener("click",()=>{
    data.workouts.splice(Number(b.dataset.i),1); save(); renderWork(); renderDash();
  }));
  el.querySelectorAll(".edtWork").forEach(b=>b.addEventListener("click",()=>startEditWorkout(Number(b.dataset.i))));
}

// ---------- workout edit mode ----------
let editingWorkoutIdx = null;
function endWorkoutEdit(skipRender){
  editingWorkoutIdx = null;
  document.getElementById("logWorkoutBtn").textContent = "Log session";
  document.getElementById("cancelEditWorkBtn").classList.add("hidden");
  if (!skipRender){ extraExercises=[]; initSessionState(); renderSessionInputs(); }
}
function startEditWorkout(i){
  const sess = data.workouts[i];
  if (!sess) return;
  editingWorkoutIdx = i;
  document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".view").forEach(vv=>vv.classList.remove("active"));
  document.querySelector('.tab[data-view="work"]').classList.add("active");
  document.getElementById("view-work").classList.add("active");
  document.getElementById("wDate").value = sess.date;
  document.getElementById("wNotes").value = sess.notes||"";
  if (sess.day === "CARDIO"){
    wDaySel.value = "__CARDIO__";
    renderSessionInputs();
    const type = Object.keys(sess.sets)[0];
    const valStr = String(sess.sets[type]||"");
    const m = valStr.match(/(\d+(?:\.\d+)?)\s*min(?:\s*·\s*(.*))?/);
    const typeSel = document.getElementById("cardioType");
    if ([...typeSel.options].some(o=>o.value===type)) typeSel.value = type;
    document.getElementById("cardioMin").value = m ? m[1] : "";
    document.getElementById("cardioDetail").value = (m && m[2]) ? m[2] : "";
  } else {
    const dayObj = program.days.find(d=>d.id===sess.day);
    wDaySel.value = dayObj ? sess.day : "__FREE__";
    const dayNames = dayObj ? dayObj.exercises.map(e=>e.name.replace("[Cardio] ","")) : [];
    extraExercises = Object.keys(sess.sets).filter(k=>dayNames.indexOf(k)===-1).map(k=>({name:k, scheme:""}));
    sessionState = {};
    const allNames = (dayObj ? dayObj.exercises.map(e=>e.name) : []).concat(extraExercises.map(e=>e.name));
    allNames.forEach(exName=>{
      const key = exName.replace("[Cardio] ","");
      const val = sess.sets[key];
      if (val==null){
        sessionState[exName] = exName.indexOf("[Cardio] ")===0
          ? {mode:"text", rows:[], text:"", auto:false}
          : {mode:"rows", rows:[{w:"",r:"",done:false}], text:"", auto:false};
      } else if (Array.isArray(val)){
        sessionState[exName] = {mode:"rows", rows:val.map(r=>({w:r.w, r:r.r, done:true})), text:"", auto:false};
      } else {
        const rows = toRows(val);
        sessionState[exName] = rows.length
          ? {mode:"rows", rows:rows.map(r=>({w:r.w, r:r.r, done:true})), text:"", auto:false}
          : {mode:"text", rows:[], text:String(val), auto:false};
      }
    });
    renderSessionInputs();
  }
  document.getElementById("logWorkoutBtn").textContent = "Update session";
  document.getElementById("cancelEditWorkBtn").classList.remove("hidden");
  const lb = document.getElementById("logWorkoutBtn");
  if (lb.scrollIntoView) lb.scrollIntoView({behavior:"smooth", block:"center"});
}
document.getElementById("cancelEditWorkBtn").addEventListener("click", ()=>{
  document.getElementById("wNotes").value = "";
  document.getElementById("wDate").value = todayStr();
  endWorkoutEdit();
});

// ---------- My Foods ----------
let mfEditKey = null;
function mfResetForm(){
  mfEditKey = null;
  ["mfName","mfServG","mfCal","mfPro","mfCarb","mfFat","mfBarcode"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("mfFormLabel").textContent = "Create a food";
  document.getElementById("mfSaveBtn").textContent = "Save food";
  document.getElementById("mfCancelBtn").classList.add("hidden");
}
function openMyFoods(){
  renderMyFoods(); renderMFMeals();
  lockScroll();
  document.getElementById("myFoodsOverlay").classList.remove("hidden");
  document.getElementById("myFoodsOverlay").scrollTop = 0;
}
function closeMyFoods(){
  document.getElementById("myFoodsOverlay").classList.add("hidden");
  unlockScroll();
}
document.getElementById("myFoodsOpenBtn").addEventListener("click", openMyFoods);
document.getElementById("myFoodsCloseBtn").addEventListener("click", ()=>{ mfResetForm(); closeMyFoods(); });
document.getElementById("mfCancelBtn").addEventListener("click", mfResetForm);
document.getElementById("mfSaveBtn").addEventListener("click", ()=>{
  const name = document.getElementById("mfName").value.trim();
  const servG = Number(document.getElementById("mfServG").value);
  const cal = Number(document.getElementById("mfCal").value);
  if(!name || !servG || !cal){ flashSave("Need name, serving size, calories", true); return; }
  const pro = Number(document.getElementById("mfPro").value||0);
  const carb = Number(document.getElementById("mfCarb").value||0);
  const fat = Number(document.getElementById("mfFat").value||0);
  const food = { name:name, brand:"My foods",
    cal100: cal/servG*100, pro100: pro/servG*100, carb100: carb/servG*100, fat100: fat/servG*100,
    servingG: servG, servingLabel: servG+"g" };
  const bc = document.getElementById("mfBarcode").value.replace(/\D/g,"");
  const key = bc || mfEditKey || ("cf_"+Date.now());
  const wasEdit = mfEditKey!=null;
  if (mfEditKey && key!==mfEditKey) delete data.myFoods[mfEditKey];
  data.myFoods[key] = food;
  save();
  ackBtn("mfSaveBtn", wasEdit ? "✓ Updated" : "✓ Saved");
  mfResetForm();
  renderMyFoods();
});
function renderMyFoods(){
  const el = document.getElementById("mfList");
  const keys = Object.keys(data.myFoods||{});
  if (!keys.length){
    el.innerHTML = '<div style="padding:16px; font-size:13px; color:var(--dim);">Nothing saved yet. Create one above — or scan an unknown barcode and it lands here automatically.</div>';
    return;
  }
  el.innerHTML = "";
  keys.sort((a,b)=>(data.myFoods[a].name||"").localeCompare(data.myFoods[b].name||"")).forEach(key=>{
    const f = data.myFoods[key];
    const g = f.servingG||100;
    const perServ = Math.round((f.cal100||0)*g/100);
    const row = document.createElement("div");
    row.className = "list-item";
    const body = document.createElement("div");
    body.style.cssText = "flex:1; min-width:0; cursor:pointer;";
    body.innerHTML = '<div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">'+esc(f.name)+'</div>'
      +'<div style="color:var(--dim); font-size:11px;">'+perServ+' kcal / '+g+'g'+(/^\d{6,}$/.test(key)?' · UPC '+key:'')+'</div>';
    body.addEventListener("click", ()=>{ mfResetForm(); closeMyFoods(); selectFood(f); });
    row.appendChild(body);
    const eBtn = document.createElement("button");
    eBtn.className = "del"; eBtn.style.color = "var(--dim)"; eBtn.textContent = "✎"; eBtn.setAttribute("aria-label","Edit");
    eBtn.addEventListener("click", ()=>{
      mfEditKey = key;
      document.getElementById("mfName").value = f.name;
      document.getElementById("mfServG").value = g;
      document.getElementById("mfCal").value = Math.round((f.cal100||0)*g/100);
      document.getElementById("mfPro").value = Math.round((f.pro100||0)*g/100*10)/10;
      document.getElementById("mfCarb").value = Math.round((f.carb100||0)*g/100*10)/10;
      document.getElementById("mfFat").value = Math.round((f.fat100||0)*g/100*10)/10;
      document.getElementById("mfBarcode").value = /^\d{6,}$/.test(key) ? key : "";
      document.getElementById("mfFormLabel").textContent = "Edit food";
      document.getElementById("mfSaveBtn").textContent = "Update food";
      document.getElementById("mfCancelBtn").classList.remove("hidden");
      document.getElementById("myFoodsOverlay").scrollTop = 0;
    });
    row.appendChild(eBtn);
    const dBtn = document.createElement("button");
    dBtn.className = "del"; dBtn.textContent = "✕"; dBtn.setAttribute("aria-label","Delete");
    dBtn.addEventListener("click", ()=>{
      delete data.myFoods[key];
      if (mfEditKey===key) mfResetForm();
      save(); renderMyFoods();
    });
    row.appendChild(dBtn);
    el.appendChild(row);
  });
}
function renderMFMeals(){
  const el = document.getElementById("mfMeals");
  const meals = data.meals||[];
  if (!meals.length){
    el.innerHTML = '<div style="padding:16px; font-size:13px; color:var(--dim);">No saved meals yet — on the Food page, log a day then tap "Save today as a meal".</div>';
    return;
  }
  el.innerHTML = "";
  meals.forEach((m,i)=>{
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = '<div style="flex:1;"><div style="font-weight:500;">'+esc(m.name)+'</div>'
      +'<div style="color:var(--dim); font-size:11px;">'+m.items.length+' item'+(m.items.length===1?'':'s')+' · '+Math.round(m.items.reduce((sum,x)=>sum+Number(x.cal||0),0))+' kcal</div></div>';
    const rBtn = document.createElement("button");
    rBtn.className = "del"; rBtn.style.color = "var(--dim)"; rBtn.textContent = "✎"; rBtn.setAttribute("aria-label","Rename");
    rBtn.addEventListener("click", ()=>{
      const nn = prompt("Meal name:", m.name);
      if (nn && nn.trim()){ m.name = nn.trim(); save(); renderMFMeals(); renderMeals(); }
    });
    row.appendChild(rBtn);
    const dBtn = document.createElement("button");
    dBtn.className = "del"; dBtn.textContent = "✕"; dBtn.setAttribute("aria-label","Delete");
    dBtn.addEventListener("click", ()=>{ data.meals.splice(i,1); save(); renderMFMeals(); renderMeals(); });
    row.appendChild(dBtn);
    el.appendChild(row);
  });
}
document.getElementById("saveToMyFoodsBtn").addEventListener("click", ()=>{
  mfResetForm();
  document.getElementById("mfName").value = document.getElementById("mName").value.trim();
  document.getElementById("mfServG").value = 100;
  document.getElementById("mfCal").value = document.getElementById("mCal").value;
  document.getElementById("mfPro").value = document.getElementById("mPro").value;
  document.getElementById("mfCarb").value = document.getElementById("mCarb").value;
  document.getElementById("mfFat").value = document.getElementById("mFat").value;
  openMyFoods();
});

// ---- program builder ----
let builderProg = null;
function openBuilder(fromCurrent){
  builderProg = fromCurrent
    ? JSON.parse(JSON.stringify(program))
    : {name:"My Program", days:[{id:"D1", title:"Day 1", exercises:[]}]};
  document.getElementById("bName").value = builderProg.name || "";
  document.getElementById("bErr").classList.add("hidden");
  document.getElementById("builderCard").classList.remove("hidden");
  renderBuilder();
  const bc = document.getElementById("builderCard");
  if (bc.scrollIntoView) bc.scrollIntoView({behavior:"smooth", block:"start"});
}
document.getElementById("editProgBtn").addEventListener("click", ()=>openBuilder(true));
document.getElementById("newProgBtn").addEventListener("click", ()=>openBuilder(false));
document.getElementById("bCancelBtn").addEventListener("click", ()=>{
  builderProg = null;
  document.getElementById("builderCard").classList.add("hidden");
});
document.getElementById("bAddDayBtn").addEventListener("click", ()=>{
  builderProg.days.push({id:"", title:"Day "+(builderProg.days.length+1), exercises:[]});
  renderBuilder();
});
document.getElementById("bSaveBtn").addEventListener("click", ()=>{
  const errEl = document.getElementById("bErr");
  errEl.classList.add("hidden");
  builderProg.name = document.getElementById("bName").value.trim() || "My Program";
  const bad = builderProg.days.findIndex(d=>!d.exercises.length);
  if (builderProg.days.length===0){ errEl.textContent="Add at least one day."; errEl.classList.remove("hidden"); return; }
  if (bad>=0){ errEl.textContent='"'+(builderProg.days[bad].title||("Day "+(bad+1)))+'" has no exercises yet.'; errEl.classList.remove("hidden"); return; }
  builderProg.days.forEach((d,i)=>{ d.id = "D"+(i+1); if(!d.title) d.title = "Day "+(i+1); });
  try {
    program = validateProgram(JSON.parse(JSON.stringify(builderProg)));
  } catch(e){ errEl.textContent = e.message; errEl.classList.remove("hidden"); return; }
  saveProgram();
  builderProg = null;
  document.getElementById("builderCard").classList.add("hidden");
  extraExercises = [];
  renderDayOptions(); initSessionState(); renderSessionInputs(); renderWork(); renderDash();
  flashSave("Program saved ✓");
});

function renderBuilder(){
  const wrap = document.getElementById("bDays");
  wrap.innerHTML = "";
  builderProg.days.forEach((day, di)=>{
    const dd = document.createElement("div");
    dd.className = "bday";
    // day header: title + tools
    const head = document.createElement("div");
    head.className = "row";
    head.style.marginBottom = "10px";
    const tIn = document.createElement("input");
    tIn.value = day.title || "";
    tIn.placeholder = "Day name (e.g. Push, Lower A)";
    tIn.addEventListener("input", ()=>{ day.title = tIn.value; });
    head.appendChild(tIn);
    const dup = document.createElement("button");
    dup.className = "xbtn"; dup.textContent = "⧉"; dup.title = "Duplicate day";
    dup.style.flex = "0 0 auto";
    dup.addEventListener("click", ()=>{
      day.title = tIn.value;
      const copy = JSON.parse(JSON.stringify(day));
      copy.title = (copy.title||"Day")+" copy";
      builderProg.days.splice(di+1, 0, copy);
      renderBuilder();
    });
    head.appendChild(dup);
    const del = document.createElement("button");
    del.className = "xbtn"; del.textContent = "✕"; del.title = "Remove day";
    del.style.flex = "0 0 auto"; del.style.color = "var(--warn)";
    del.addEventListener("click", ()=>{ builderProg.days.splice(di,1); renderBuilder(); });
    head.appendChild(del);
    dd.appendChild(head);
    // exercises
    day.exercises.forEach((ex, xi)=>{
      const row = document.createElement("div");
      row.className = "bex";
      const nIn = document.createElement("input");
      nIn.className = "bname"; nIn.value = ex.name; nIn.placeholder = "Exercise";
      nIn.addEventListener("input", ()=>{ ex.name = nIn.value; });
      const sIn = document.createElement("input");
      sIn.className = "bscheme"; sIn.value = ex.scheme||""; sIn.placeholder = "e.g. 4×5";
      sIn.addEventListener("input", ()=>{ ex.scheme = sIn.value; });
      const up = document.createElement("button");
      up.className = "xbtn"; up.textContent = "↑";
      up.addEventListener("click", ()=>{
        if (xi>0){ day.exercises.splice(xi-1,0,day.exercises.splice(xi,1)[0]); renderBuilder(); }
      });
      const dn = document.createElement("button");
      dn.className = "xbtn"; dn.textContent = "↓";
      dn.addEventListener("click", ()=>{
        if (xi<day.exercises.length-1){ day.exercises.splice(xi+1,0,day.exercises.splice(xi,1)[0]); renderBuilder(); }
      });
      const rm = document.createElement("button");
      rm.className = "xbtn"; rm.textContent = "✕"; rm.style.color = "var(--warn)";
      rm.addEventListener("click", ()=>{ day.exercises.splice(xi,1); renderBuilder(); });
      row.appendChild(nIn); row.appendChild(sIn); row.appendChild(up); row.appendChild(dn); row.appendChild(rm);
      dd.appendChild(row);
    });
    // add-exercise row: library select + custom entry
    const addRow = document.createElement("div");
    addRow.className = "bex";
    const sel = document.createElement("select");
    const og1 = document.createElement("optgroup"); og1.label = "Strength";
    EXERCISE_LIBRARY.forEach(x=>{ const o=document.createElement("option"); o.value=x; o.textContent=x; og1.appendChild(o); });
    const og2 = document.createElement("optgroup"); og2.label = "Cardio";
    CARDIO_TYPES.forEach(x=>{ const o=document.createElement("option"); o.value="[Cardio] "+x; o.textContent=x; og2.appendChild(o); });
    const ogC = document.createElement("optgroup"); ogC.label = "Custom";
    const oc = document.createElement("option"); oc.value="__CUSTOM__"; oc.textContent="Type my own…"; ogC.appendChild(oc);
    sel.appendChild(og1); sel.appendChild(og2); sel.appendChild(ogC);
    sel.style.flex = "2";
    const custom = document.createElement("input");
    custom.placeholder = "Custom exercise name"; custom.className = "bname hidden";
    sel.addEventListener("change", ()=>{ custom.classList.toggle("hidden", sel.value!=="__CUSTOM__"); });
    const schIn = document.createElement("input");
    schIn.className = "bscheme"; schIn.placeholder = "e.g. 3×8";
    const addBtn = document.createElement("button");
    addBtn.className = "xbtn"; addBtn.textContent = "＋ Add";
    addBtn.addEventListener("click", ()=>{
      const name = sel.value==="__CUSTOM__" ? custom.value.trim() : sel.value;
      if (!name) return;
      day.exercises.push({name:name, scheme:schIn.value.trim()});
      renderBuilder();
    });
    addRow.appendChild(sel); addRow.appendChild(custom); addRow.appendChild(schIn); addRow.appendChild(addBtn);
    dd.appendChild(addRow);
    wrap.appendChild(dd);
  });
}

// ---- next workout suggestion ----
function nextProgramDay(){
  if (!program.days.length) return null;
  const inProgram = data.workouts
    .filter(s=>program.days.some(d=>d.id===s.day))
    .sort((a,b)=>a.date.localeCompare(b.date));
  if (!inProgram.length) return program.days[0];
  const lastDay = inProgram[inProgram.length-1].day;
  const idx = program.days.findIndex(d=>d.id===lastDay);
  return program.days[(idx+1) % program.days.length];
}
document.getElementById("nextWorkoutBtn").addEventListener("click", ()=>{
  const nd = nextProgramDay();
  if (!nd) return;
  document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelector('.tab[data-view="work"]').classList.add("active");
  document.getElementById("view-work").classList.add("active");
  wDaySel.value = nd.id;
  extraExercises = [];
  initSessionState();
  renderSessionInputs();
});

// ---- program import/export ----
document.getElementById("importBtn").addEventListener("click", ()=>document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  const errEl = document.getElementById("programErr");
  errEl.classList.add("hidden");
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try {
      program = validateProgram(JSON.parse(reader.result));
      saveProgram();
      extraExercises=[];
      renderDayOptions(); renderSessionInputs(); renderWork();
      flashSave("Program loaded ✓");
    } catch(err){
      errEl.textContent = "Couldn't load that file: "+err.message;
      errEl.classList.remove("hidden");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});
document.getElementById("exportBtn").addEventListener("click", ()=>{
  download((program.name||"blackpyre-program").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".json", JSON.stringify(program,null,2));
  ackBtn("exportBtn", "✓ Downloaded");
});

