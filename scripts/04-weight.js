"use strict";
// ================== WEIGHT ==================
document.getElementById("wtDate").value = todayStr();
document.getElementById("addWtBtn").addEventListener("click", ()=>{
  const v = Number(document.getElementById("wtVal").value);
  const dt = document.getElementById("wtDate").value;
  if(!v || v<50 || v>700) return;
  data.weights = data.weights.filter(w=>w.date!==dt);
  data.weights.push({date:dt, lbs:v});
  bumpLog();
  document.getElementById("wtVal").value="";
  if (data.weights.length===1){
    const cutting = cfg.goalWt < cfg.startWt;
    if ((cutting && v > cfg.startWt) || (!cutting && v < cfg.startWt)){
      cfg.startWt = v; saveCfg();
      flashSave("Starting line set at "+v+" — the journey begins today");
    }
  }
  save(); renderWeight(); renderDash(); renderProjection(); renderWeek();
  if (dt===todayStr()) checkWeightAdjust(v);
});

function renderWeight(){
  const goals = Number(cfg.startWt)>0 && Number(cfg.goalWt)>0;
  document.getElementById("chartLabel").textContent = goals ? ("Trend · "+cfg.startWt+" → "+cfg.goalWt) : "Trend";
  const sorted = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const w=640,h=230,pad=38;
  const all=(goals?[{date:"start",lbs:cfg.startWt}]:[]).concat(sorted);
  if (!all.length){
    document.getElementById("chart").innerHTML = '<svg viewBox="0 0 '+w+' '+h+'">'
      +'<text x="'+(w/2)+'" y="'+(h/2)+'" text-anchor="middle" font-size="12" fill="var(--dim)" font-family="IBM Plex Mono">Record a weigh-in to start the chart</text></svg>';
    document.getElementById("wtListCard").classList.add("hidden");
    return;
  }
  const lbsList = all.map(p=>p.lbs);
  const gLo = goals ? Math.min(cfg.goalWt,cfg.startWt) : Math.min.apply(null,lbsList);
  const gHi = goals ? Math.max(cfg.goalWt,cfg.startWt) : Math.max.apply(null,lbsList);
  const minY=Math.min(gLo,Math.min.apply(null,lbsList))-5;
  const maxY=Math.max(gHi,Math.max.apply(null,lbsList))+5;
  const y=v=>h-pad-((v-minY)/(maxY-minY))*(h-pad*2);
  const n=Math.max(all.length-1,1);
  const x=i=>pad+(i/n)*(w-pad*2);
  const pts=all.map((p,i)=>x(i)+","+y(p.lbs)).join(" ");
  let grid=""; for(let i=0;i<5;i++){const gy=pad+(i/4)*(h-pad*2); grid+='<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+gy+'" y2="'+gy+'" stroke="var(--border)" stroke-width="1"/>';}
  const dots=all.map((p,i)=>'<circle cx="'+x(i)+'" cy="'+y(p.lbs)+'" r="4.5" fill="var(--panel)" stroke="var(--ember)" stroke-width="2.5"/>'
    +'<text x="'+x(i)+'" y="'+(y(p.lbs)-11)+'" text-anchor="middle" font-size="10" fill="var(--text)" font-family="IBM Plex Mono">'+p.lbs+'</text>').join("");
  document.getElementById("chart").innerHTML =
  '<svg viewBox="0 0 '+w+' '+h+'">'
    +'<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="var(--ember-deep)"/><stop offset="100%" stop-color="var(--ember)"/></linearGradient>'
    +'<linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(var(--ember-rgb),.25)"/><stop offset="100%" stop-color="rgba(var(--ember-rgb),0)"/></linearGradient></defs>'
    +grid
    +(goals ? '<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+y(cfg.goalWt)+'" y2="'+y(cfg.goalWt)+'" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="6 5"/>'
    +'<text x="'+(w-pad)+'" y="'+(y(cfg.goalWt)-7)+'" text-anchor="end" font-size="11" fill="var(--ok)" font-family="IBM Plex Mono">GOAL '+cfg.goalWt+'</text>' : "")
    +(all.length>1?('<polygon points="'+pts+' '+x(all.length-1)+','+(h-pad)+' '+x(0)+','+(h-pad)+'" fill="url(#fg)"/>'
      +'<polyline points="'+pts+'" fill="none" stroke="url(#lg)" stroke-width="3" stroke-linecap="round"/>'):"")
    +dots
  +'</svg>';
  const card=document.getElementById("wtListCard");
  if(sorted.length===0){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  document.getElementById("wtList").innerHTML=sorted.slice().reverse().map(wp=>
    '<div class="list-item"><span style="flex:1; color:var(--dim);">'+fmtDate(wp.date)+'</span>'
    +'<span style="flex:1; text-align:right; font-weight:600;">'+wp.lbs+' lb</span>'
    +'<button class="del delWt" data-d="'+wp.date+'" aria-label="Delete">✕</button></div>'
  ).join("");
  document.getElementById("wtList").querySelectorAll(".delWt").forEach(b=>b.addEventListener("click",()=>{
    data.weights=data.weights.filter(w=>w.date!==b.dataset.d); save(); renderWeight(); renderDash();
  }));
}

// ================== MOTIVATION ==================

const TIPS = [
  "Protein first: build every meal around the protein source, then fill in the rest. It protects muscle on a cut and keeps you full.",
  "Weigh in daily, judge weekly. A single day's scale number is mostly water — the 7-day average is the truth.",
  "The best diet is the one you can still be doing in 6 months. Sustainable beats optimal.",
  "Sleep is a training variable. Under 7 hours measurably drops strength, recovery, and willpower around food.",
  "Hitting your protein minimum on a rough eating day still counts as a win. Never let one bad meal become a bad week.",
  "Progressive overload is the whole game: add a rep or 5 lbs before you add exercises.",
  "Log your sets during rest periods, not after the workout — accuracy dies fast from memory.",
  "Warm-up sets are practice reps. Same bar speed and setup as your work sets, just lighter.",
  "If a joint hurts, change the exercise, not the goal. There's always a pain-free variation that trains the same muscle.",
  "Walking is the most underrated fat-loss tool: 8-10k steps burns real calories without eating into recovery.",
  "Pre-log your food in the morning. Deciding once beats negotiating with yourself all day.",
  "Water before meals, protein at every meal, vegetables at most: three habits that cover 80% of diet quality.",
  "A deload week every 6-8 weeks isn't lost progress — it's when accumulated fatigue clears and PRs get unlocked.",
  "Grip the floor with your feet on squats and deadlifts. Full-body tension starts at the ground.",
  "Cardio doesn't kill gains; zero recovery does. Keep easy cardio easy and it only helps.",
  "Restaurant survival: protein entrée, double vegetables, sauce on the side. You can eat out and stay on target.",
  "Strength is a skill. Frequent, crisp practice with good bar speed beats occasional all-out grinders.",
  "The scale up 2 lbs overnight? Salt, carbs, and stress hold water. Fat gain requires ~7,000 surplus calories — you didn't eat that.",
  "Film your heavy sets from the side. The camera catches depth and back position your ego won't.",
  "Hungry before bed on a cut? Casein-heavy foods — Greek yogurt, cottage cheese — digest slowly and protect overnight recovery.",
  "Same lifts, same order, same rest times week to week — change too many variables and you can't tell what's working.",
  "Motivation gets you started; systems keep you going. That's why you log.",
];
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function showCelebration(title, prLines, statsText){
  document.getElementById("celTitle").textContent = title;
  const prEl = document.getElementById("celPR");
  if (prLines && prLines.length){ prEl.innerHTML = prLines.map(esc).join("<br>"); prEl.classList.remove("hidden"); }
  else prEl.classList.add("hidden");
  document.getElementById("celStats").textContent = statsText || "";
  const qu = pick(QUOTES);
  document.getElementById("celQuote").textContent = "\u201C"+qu.q+"\u201D";
  document.getElementById("celAttr").textContent = "— "+qu.a;
  document.getElementById("celTip").textContent = "" + pick(TIPS);
  document.getElementById("celebrate").classList.remove("hidden");
}
document.getElementById("celCloseBtn").addEventListener("click", ()=>document.getElementById("celebrate").classList.add("hidden"));

// ================== e1RM / PR ENGINE ==================
function parseBestSet(val){
  // best estimated 1RM from structured rows [{w,r}] or a legacy string like "275x5, 285×3"
  let best = null;
  const consider = (w,r)=>{
    if (!w || !r || r>30) return;
    const e = w*(1+r/30); // Epley
    if (!best || e>best.e1rm) best = {w:w, r:r, e1rm:e};
  };
  if (Array.isArray(val)){
    val.forEach(s=>consider(Number(s.w), Number(s.r)));
    return best;
  }
  const re = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+)/g;
  let m;
  while((m = re.exec(String(val))) !== null){
    consider(parseFloat(m[1]), parseInt(m[2],10));
  }
  return best;
}
function bestHistorical(exName, excludeIdx){
  let best = null;
  data.workouts.forEach((s,i)=>{
    if (i===excludeIdx) return;
    const str = s.sets[exName];
    if(!str) return;
    const b = parseBestSet(str);
    if (b && (!best || b.e1rm>best.e1rm)) best = b;
  });
  return best;
}
function allPRs(){
  const map = {};
  data.workouts.forEach(s=>{
    Object.keys(s.sets).forEach(ex=>{
      const b = parseBestSet(s.sets[ex]);
      if (b && (!map[ex] || b.e1rm>map[ex].e1rm)) map[ex] = Object.assign({date:s.date}, b);
    });
  });
  return map;
}
function renderPRs(){
  const map = allPRs();
  const names = Object.keys(map);
  const card = document.getElementById("prCard");
  if(!names.length){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  names.sort((a,b)=>map[b].e1rm-map[a].e1rm);
  document.getElementById("prList").innerHTML = names.slice(0,8).map(ex=>
    '<div class="list-item" style="cursor:pointer;" data-ex="'+esc(ex)+'"><span style="flex:2;">'+esc(ex)+' <span style="color:var(--dim); font-size:10px;"></span></span>'
    +'<span style="flex:1.4; text-align:right; color:var(--dim);">'+map[ex].w+'×'+map[ex].r+'</span>'
    +'<span style="flex:1; text-align:right; font-weight:600; color:var(--ember);">~'+Math.round(map[ex].e1rm)+'</span></div>'
  ).join("");
  document.getElementById("prList").querySelectorAll("[data-ex]").forEach(row=>
    row.addEventListener("click", ()=>openLiftChart(row.dataset.ex)));
}
function lastSessionFor(dayId){
  let best = null;
  data.workouts.forEach(s=>{
    if (s.day!==dayId) return;
    if (!best || s.date>=best.date) best = s; // >= so later entries win same-day ties
  });
  return best;
}

// ================== ADAPTIVE TDEE ==================
function computeTDEE(){
  const today = new Date();
  const cutoff = new Date(today.getTime() - 28*86400000);
  const cutStr = cutoff.getFullYear()+"-"+String(cutoff.getMonth()+1).padStart(2,"0")+"-"+String(cutoff.getDate()).padStart(2,"0");
  const wts = data.weights.filter(w=>w.date>=cutStr).sort((a,b)=>a.date.localeCompare(b.date));
  if (wts.length<4) return null;
  const spanDays = (new Date(wts[wts.length-1].date) - new Date(wts[0].date))/86400000;
  if (spanDays<10) return null;
  const tStr = todayStr();
  const calDays = Object.keys(data.food).filter(d=>d>=wts[0].date && d<=wts[wts.length-1].date && d<tStr)
    .map(d=>daySums(d).cal).filter(c=>c>800);
  if (calDays.length<7) return null;
  const avgCal = calDays.reduce((s,c)=>s+c,0)/calDays.length;
  // least-squares slope of weight in lb/day
  const t0 = new Date(wts[0].date).getTime();
  const pts = wts.map(w=>({x:(new Date(w.date).getTime()-t0)/86400000, y:w.lbs}));
  const n = pts.length;
  const sx = pts.reduce((s,p)=>s+p.x,0), sy = pts.reduce((s,p)=>s+p.y,0);
  const sxx = pts.reduce((s,p)=>s+p.x*p.x,0), sxy = pts.reduce((s,p)=>s+p.x*p.y,0);
  const denom = n*sxx - sx*sx;
  if (!denom) return null;
  const slope = (n*sxy - sx*sy)/denom; // lb per day
  const tdee = avgCal - slope*3500;
  return { tdee:Math.round(tdee), avgCal:Math.round(avgCal), weeklyChange:Math.round(slope*7*10)/10, days:calDays.length };
}
let lastTDEE = null;
function renderTDEE(){
  const card = document.getElementById("tdeeCard");
  lastTDEE = computeTDEE();
  if(!lastTDEE){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  document.getElementById("tdeeText").innerHTML =
    'Measured TDEE: <b class="ember-text">'+lastTDEE.tdee+' kcal/day</b><br>'
    +'Based on '+lastTDEE.days+' logged days, avg '+lastTDEE.avgCal+' kcal, trending '
    +(lastTDEE.weeklyChange<=0? lastTDEE.weeklyChange : "+"+lastTDEE.weeklyChange)+' lb/week';
}
document.getElementById("tdeeApplyBtn").addEventListener("click", ()=>{
  if(!lastTDEE) return;
  const currentDeficit = cfg.calTarget - lastTDEE.tdee; // negative = deficit intent preserved? use target rate instead:
  // preserve the user's current intended rate: assume they want the same deficit they originally set vs formula; simplest robust move: keep a 500 deficit if losing, else maintain
  const losing = cfg.goalWt < cfg.startWt;
  const target = lastTDEE.tdee + (losing ? -500 : 0);
  cfg.calTarget = target;
  const sortedW = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  cfg.lastTargetWt = sortedW.length ? sortedW[sortedW.length-1].lbs : cfg.lastTargetWt || cfg.startWt;
  delete cfg.adjustPromptedAt;
  saveCfg(); renderAll(); flashSave("Targets recalibrated ✓");
  ackBtn("tdeeApplyBtn", "✓ Recalibrated");
});

// ================== STREAK ==================
function computeStreak(){
  let streak = 0;
  const d = new Date();
  for(let i=0;i<365;i++){
    const ds = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const foodOK = (data.food[ds]||[]).some(f=>Number(f.cal)>0 || Number(f.pro)>0 || Number(f.carb)>0 || Number(f.fat)>0);
    const logged = foodOK || data.workouts.some(w=>w.date===ds) || data.weights.some(w=>w.date===ds);
    if (logged) streak++;
    else if (i>0) break; // today not logged yet doesn't break the streak
    d.setDate(d.getDate()-1);
  }
  return streak;
}

// ================== FINISH DAY ==================
document.getElementById("finishDayBtn").addEventListener("click", ()=>{
  const t = todayStr();
  if(!data.finished) data.finished = {};
  data.finished[t] = true;
  save();
  const s = daySums(t);
  const ready = nutritionTargetsReady();
  const dt = dayTargets(todayStr());
  const inCal = ready && s.cal <= dt.cal + 100; // exact target with the practical buffer
  const inPro = ready && s.pro >= dt.pro;
  const streak = computeStreak();
  const stats = Math.round(s.cal)+" kcal · "+Math.round(s.pro)+"g protein"
    +(inCal&&inPro ? " — both targets hit" : inPro ? " — protein target hit" : "")
    +(streak>1 ? "  ·  "+streak+"-day streak" : "");
  showCelebration("Day Forged", null, stats);
  renderDash();
});

// ================== QUICK LOG: copy yesterday & meals ==================
document.getElementById("copyYesterdayBtn").addEventListener("click", ()=>{
  const d = new Date(foodDateEl.value+"T12:00:00");
  d.setDate(d.getDate()-1);
  const yd = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const list = data.food[yd]||[];
  if(!list.length){ flashSave("Nothing logged yesterday", true); return; }
  const cur = foodDateEl.value;
  if(!data.food[cur]) data.food[cur]=[];
  list.forEach(f=>data.food[cur].push(Object.assign({},f)));
  save(); renderFood(); renderDash();
  flashSave("Copied "+list.length+" items ✓");
  ackBtn("copyYesterdayBtn", "✓ Copied "+list.length);
});
document.getElementById("saveMealBtn").addEventListener("click", ()=>{
  const list = data.food[foodDateEl.value]||[];
  if(!list.length){ flashSave("Log some food first", true); return; }
  const name = prompt("Name this meal (e.g. My breakfast):");
  if(!name) return;
  if(!data.meals) data.meals=[];
  data.meals = data.meals.filter(m=>m.name!==name);
  data.meals.push({name:name, items:list.map(f=>Object.assign({},f))});
  data.meals = data.meals.slice(-12);
  save(); renderMeals();
  flashSave("Meal saved ✓");
  ackBtn("saveMealBtn", "✓ Meal saved");
});
function renderMeals(){
  const el = document.getElementById("mealChips");
  const meals = data.meals||[];
  el.innerHTML = "";
  meals.forEach((m,i)=>{
    const cal = m.items.reduce((s,f)=>s+Number(f.cal||0),0);
    const b = document.createElement("button");
    b.className="chip";
    b.textContent = m.name+" ("+Math.round(cal)+" kcal)";
    b.addEventListener("click", ()=>{
      const cur = foodDateEl.value;
      if(!data.food[cur]) data.food[cur]=[];
      m.items.forEach(f=>data.food[cur].push(Object.assign({},f)));
      save(); renderFood(); renderDash();
      flashSave("Added "+m.name+" ✓");
    });
    b.addEventListener("contextmenu",(e)=>{
      e.preventDefault();
      if(confirm("Delete meal '"+m.name+"'?")){ data.meals.splice(i,1); save(); renderMeals(); }
    });
    el.appendChild(b);
  });
}

// ================== PLATE MATH & REST TIMER ==================
function plateMath(target, bar){
  const perSide = (target-bar)/2;
  if (perSide<0) return "Lighter than the bar";
  const plates = [45,35,25,10,5,2.5];
  let rem = perSide; const out = [];
  plates.forEach(p=>{ const n = Math.floor(rem/p); if(n>0){ out.push(n+"×"+p); rem = Math.round((rem-n*p)*100)/100; } });
  return out.length ? out.join(" + ")+" per side"+(rem>0?" (+"+rem+" left)":"") : "Empty bar";
}
function updatePlates(){
  const t = Number(document.getElementById("plateTarget").value);
  const b = Number(document.getElementById("plateBar").value);
  document.getElementById("plateOut").textContent = t ? plateMath(t,b) : "";
}
document.getElementById("plateTarget").addEventListener("input", updatePlates);
document.getElementById("plateBar").addEventListener("change", updatePlates);

let restInterval = null, restRunning = false, restPaused = false, restFinished = false;
let restRemaining = 0;
function fmtRest(sec){ return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0"); }
function selectedRestSeconds(){ return Math.max(10, Math.round(Number(cfg.restSec)||90)); }
function paintRestDock(){
  const disp = document.getElementById("restDisplay");
  const start = document.getElementById("restStartBtn");
  const pause = document.getElementById("restPauseBtn");
  const add = document.getElementById("restAddBtn");
  const end = document.getElementById("restEndBtn");
  if (!disp || !start || !pause || !add || !end) return;
  disp.textContent = restFinished ? "GO!" : fmtRest((restRunning||restPaused) ? restRemaining : selectedRestSeconds());
  disp.style.color = restFinished || ((restRunning||restPaused) && restRemaining<=10) ? "var(--ok)" : "var(--text)";
  start.classList.toggle("hidden", restRunning || restPaused);
  pause.classList.toggle("hidden", !(restRunning || restPaused));
  add.classList.toggle("hidden", !(restRunning || restPaused));
  end.classList.toggle("hidden", !(restRunning || restPaused));
  pause.textContent = restPaused ? "Resume" : "Pause";
}
function runRestCountdown(){
  clearInterval(restInterval);
  restRunning = true;
  restPaused = false;
  restFinished = false;
  paintRestDock();
  restInterval = setInterval(()=>{
    restRemaining -= 1;
    if (restRemaining<=0){
      restRemaining = 0;
      clearInterval(restInterval);
      restInterval = null;
      restRunning = false;
      restPaused = false;
      restFinished = true;
    }
    paintRestDock();
  }, 1000);
}
function startRest(seconds){
  restRemaining = Math.max(1, Math.round(Number(seconds)||selectedRestSeconds()));
  runRestCountdown();
}
function pauseRest(){
  if (restRunning){
    clearInterval(restInterval);
    restInterval = null;
    restRunning = false;
    restPaused = true;
    paintRestDock();
    return;
  }
  if (restPaused) runRestCountdown();
}
function addRest(seconds){
  if (!(restRunning || restPaused)) return;
  restRemaining += Math.max(1, Math.round(Number(seconds)||30));
  restFinished = false;
  paintRestDock();
}
function cancelRest(){
  clearInterval(restInterval);
  restInterval = null;
  restRunning = false;
  restPaused = false;
  restFinished = false;
  restRemaining = 0;
  paintRestDock();
}
document.getElementById("restStartBtn").addEventListener("click", ()=>startRest(selectedRestSeconds()));
document.getElementById("restPauseBtn").addEventListener("click", pauseRest);
document.getElementById("restAddBtn").addEventListener("click", ()=>addRest(30));
document.getElementById("restEndBtn").addEventListener("click", cancelRest);
function renderRestPresets(){
  // migrate old single custom to list
  if (cfg.customRestSec && !cfg.customRests){ cfg.customRests = [cfg.customRestSec]; delete cfg.customRestSec; saveCfg(); }
  if (!cfg.customRests) cfg.customRests = [];
  const wrap = document.getElementById("restPresets");
  wrap.innerHTML = "";
  const addChip = (p, removable)=>{
    const holder = document.createElement("span");
    holder.style.cssText = "display:inline-flex; align-items:center; gap:2px;";
    const b = document.createElement("button");
    b.className = "xbtn";
    b.textContent = fmtRest(p);
    if (p===selectedRestSeconds()) b.style.borderColor = "var(--ember)";
    b.addEventListener("click", ()=>{
      cfg.restSec = p; saveCfg();
      renderRestPresets();
      if (!(restRunning||restPaused)) paintRestDock();
    });
    holder.appendChild(b);
    if (removable){
      const x = document.createElement("button");
      x.className = "xbtn"; x.textContent = "✕";
      x.style.cssText = "color:var(--warn); padding:8px 6px;";
      x.setAttribute("aria-label","Remove preset");
      x.addEventListener("click", ()=>{
        cfg.customRests = cfg.customRests.filter(c=>c!==p);
        if (cfg.restSec===p) cfg.restSec = 90;
        saveCfg();
        renderRestPresets();
        if (!(restRunning||restPaused)) paintRestDock();
      });
      holder.appendChild(x);
    }
    wrap.appendChild(holder);
  };
  [90,120,180].forEach(p=>addChip(p, false));
  cfg.customRests.forEach(p=>{ if([90,120,180].indexOf(p)===-1) addChip(p, true); });
  paintRestDock();
}
document.getElementById("restCustomBtn").addEventListener("click", ()=>{
  document.getElementById("restCustomRow").classList.toggle("hidden");
});
document.getElementById("restCustomSet").addEventListener("click", ()=>{
  const v = Math.round(Number(document.getElementById("restCustomInput").value));
  if (!v || v<10 || v>1800){ flashSave("10–1800 seconds", true); return; }
  if (!cfg.customRests) cfg.customRests = [];
  if (cfg.customRests.indexOf(v)===-1 && [90,120,180].indexOf(v)===-1){
    cfg.customRests.push(v);
    cfg.customRests = cfg.customRests.slice(-4); // keep it tidy
  }
  cfg.restSec = v;
  saveCfg();
  document.getElementById("restCustomRow").classList.add("hidden");
  document.getElementById("restCustomInput").value = "";
  renderRestPresets();
  if (!(restRunning||restPaused)) paintRestDock();
});

// ================== SHARE PROGRAM ==================
document.getElementById("shareBtn").addEventListener("click", async ()=>{
  const json = JSON.stringify(program,null,2);
  const fname = (program.name||"blackpyre-program").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".json";
  try {
    if (navigator.canShare && window.File){
      const file = new File([json], fname, {type:"application/json"});
      if (navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:program.name});
        return;
      }
    }
    if (navigator.share){ await navigator.share({title:program.name, text:json}); return; }
  } catch(e){ /* user cancelled or unsupported */ }
  download(fname, json); // fallback
});

