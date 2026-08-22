"use strict";
// ================== WEIGHT ==================
function currentTimeValue(){
  const now=new Date();
  return String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
}
function validWeighInTime(value){ return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value||"")); }
function formatWeighInTime(value){
  if(!validWeighInTime(value)) return "";
  const parts=String(value).split(":");
  return new Date(2000,0,1,Number(parts[0]),Number(parts[1])).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
}
function weighInDateTimeLabel(entry){
  const time=formatWeighInTime(entry&&entry.time);
  return fmtDate(entry.date)+(time?" · "+time:"");
}
document.getElementById("wtDate").value = todayStr();
document.getElementById("wtTime").value = currentTimeValue();
document.getElementById("addWtBtn").addEventListener("click", ()=>{
  const v = poundsFromUnit(document.getElementById("wtVal").value,currentUnitSystem());
  const dt = document.getElementById("wtDate").value;
  const tm = document.getElementById("wtTime").value;
  if(!v || v<50 || v>700 || !validWeighInTime(tm)) return;
  data.weights = data.weights.filter(w=>w.date!==dt);
  data.weights.push({date:dt, time:tm, lbs:v});
  bumpLog();
  document.getElementById("wtVal").value="";
  if (data.weights.length===1){
    const cutting = cfg.goalWt < cfg.startWt;
    if ((cutting && v > cfg.startWt) || (!cutting && v < cfg.startWt)){
      cfg.startWt = v; saveCfg();
      flashSave("Starting line set at "+formatBodyWeight(v,currentUnitSystem(),1)+" — the journey begins today");
    }
  }
  save(); renderWeight(); renderDash(); renderProjection(); renderWeek();
  if (dt===todayStr()) checkWeightAdjust(v);
});

function renderWeight(){
  const metric=isMetricSystem(), unit=unitWeightLabel();
  document.getElementById("wtValLabel").textContent="Weight ("+unit+")";
  document.getElementById("wtVal").placeholder=metric?"e.g. 82":"e.g. 180";
  document.getElementById("wtVal").setAttribute("aria-label","Body weight in "+(metric?"kilograms":"pounds"));
  const goals = Number(cfg.startWt)>0 && Number(cfg.goalWt)>0;
  document.getElementById("chartLabel").textContent = goals ? ("Trend · "+(isMetricSystem()?(formatBodyWeight(cfg.startWt,currentUnitSystem(),1)+" → "+formatBodyWeight(cfg.goalWt,currentUnitSystem(),1)):(cfg.startWt+" → "+cfg.goalWt))) : "Trend";
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
    +'<text x="'+x(i)+'" y="'+(y(p.lbs)-11)+'" text-anchor="middle" font-size="10" fill="var(--text)" font-family="IBM Plex Mono">'+poundsToUnit(p.lbs,currentUnitSystem(),1)+'</text>').join("");
  document.getElementById("chart").innerHTML =
  '<svg viewBox="0 0 '+w+' '+h+'">'
    +'<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="var(--ember-deep)"/><stop offset="100%" stop-color="var(--ember)"/></linearGradient>'
    +'<linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(var(--ember-rgb),.25)"/><stop offset="100%" stop-color="rgba(var(--ember-rgb),0)"/></linearGradient></defs>'
    +grid
    +(goals ? '<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+y(cfg.goalWt)+'" y2="'+y(cfg.goalWt)+'" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="6 5"/>'
    +'<text x="'+(w-pad)+'" y="'+(y(cfg.goalWt)-7)+'" text-anchor="end" font-size="11" fill="var(--ok)" font-family="IBM Plex Mono">GOAL '+poundsToUnit(cfg.goalWt,currentUnitSystem(),1)+' '+unitWeightLabel()+'</text>' : "")
    +(all.length>1?('<polygon points="'+pts+' '+x(all.length-1)+','+(h-pad)+' '+x(0)+','+(h-pad)+'" fill="url(#fg)"/>'
      +'<polyline points="'+pts+'" fill="none" stroke="url(#lg)" stroke-width="3" stroke-linecap="round"/>'):"")
    +dots
  +'</svg>';
  const card=document.getElementById("wtListCard");
  if(sorted.length===0){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  document.getElementById("wtList").innerHTML=sorted.slice().reverse().map(wp=>
    '<div class="list-item"><span style="flex:1; color:var(--dim);">'+weighInDateTimeLabel(wp)+'</span>'
    +'<span style="flex:1; text-align:right; font-weight:600;">'+formatBodyWeight(wp.lbs,currentUnitSystem(),1)+'</span>'
    +'<button class="del delWt" data-d="'+wp.date+'" aria-label="Delete">✕</button></div>'
  ).join("");
  document.getElementById("wtList").querySelectorAll(".delWt").forEach(b=>b.addEventListener("click",()=>{
    const i = data.weights.findIndex(w=>w.date===b.dataset.d);
    if (i<0) return;
    const removed = data.weights[i];
    data.weights.splice(i,1);
    if (!save()){ data.weights.splice(i,0,removed); renderWeight(); renderDash(); return; }
    renderWeight(); renderDash(); renderProjection(); renderWeek();
    offerUndo("Deleted weigh-in from "+weighInDateTimeLabel(removed), ()=>{
      data.weights.splice(Math.min(i,data.weights.length),0,removed);
      save(); renderWeight(); renderDash(); renderProjection(); renderWeek();
      flashSave("Weigh-in restored ✓");
    });
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
function parseBestAssistance(val){
  if(!Array.isArray(val))return null;
  let best=null;
  val.forEach(row=>{
    const lbs=Number(row&&row.w),reps=Number(row&&row.r);
    if(!(lbs>0)||!(reps>0))return;
    if(!best||lbs<best.w||(lbs===best.w&&reps>best.r))best={w:lbs,r:reps};
  });
  return best;
}
function prSessionAllowedForExercise(exName,session){
  const key="legacy:"+normalizeExerciseName(exName);
  const reset=Number(cfg.prResetAt&&cfg.prResetAt[key]);
  if(!(reset>0))return true;
  const recorded=Date.parse(session&&((session.prRecordedAt)||(session.endedAt))||"")||0;
  return recorded>reset;
}
function bestHistorical(exName, excludeIdx){
  if(isAssistedExercise(exName)){
    let best=null;
    data.workouts.forEach((session,index)=>{
      if(index===excludeIdx||!prSessionAllowedForExercise(exName,session))return;
      const candidate=parseBestAssistance(session.sets[exName]);
      if(candidate&&(!best||candidate.w<best.w||(candidate.w===best.w&&candidate.r>best.r)))best=candidate;
    });
    return best;
  }
  let best = null;
  data.workouts.forEach((s,i)=>{
    if (i===excludeIdx||!prSessionAllowedForExercise(exName,s)) return;
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
      const prKey="legacy:"+normalizeExerciseName(ex);
      if((cfg.prHidden&&cfg.prHidden[prKey])||!prSessionAllowedForExercise(ex,s))return;
      const assisted=isAssistedExercise(ex);
      const b = assisted ? parseBestAssistance(s.sets[ex]) : parseBestSet(s.sets[ex]);
      if (b && (!map[ex] || (assisted ? b.w<map[ex].w||(b.w===map[ex].w&&b.r>map[ex].r) : b.e1rm>map[ex].e1rm))) map[ex] = Object.assign({date:s.date,assisted:assisted}, b);
    });
  });
  return map;
}
function renderPRs(){
  const map = allPRs();
  const names = Object.keys(map);
  const card = document.getElementById("prCard");
  const restore=document.getElementById("restorePRsBtn");
  const hasPriorState=!!((cfg.prHidden&&Object.keys(cfg.prHidden).length)||(cfg.prResetAt&&Object.keys(cfg.prResetAt).length));
  if(restore){restore.classList.toggle("hidden",!hasPriorState);restore.textContent="Restore previous PRs";}
  if(!names.length&&!hasPriorState){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  names.sort((a,b)=>map[b].e1rm-map[a].e1rm);
  document.getElementById("prList").innerHTML = names.slice(0,8).map(ex=>
    '<div class="list-item" style="cursor:pointer;" data-ex="'+esc(ex)+'"><span style="flex:2;">'+esc(ex)+' <span style="color:var(--dim); font-size:10px;"></span></span>'
    +'<span style="flex:1.4; text-align:right; color:var(--dim);">'+(map[ex].assisted?'Least assistance':poundsToUnit(map[ex].w,currentUnitSystem(),1)+'×'+map[ex].r)+'</span>'
    +'<span style="flex:1; text-align:right; font-weight:600; color:var(--ember);">'+(map[ex].assisted?poundsToUnit(map[ex].w,currentUnitSystem(),1)+' '+unitWeightLabel()+' · '+map[ex].r+' reps':'~'+poundsToUnit(map[ex].e1rm,currentUnitSystem(),1)+' '+unitWeightLabel())+'</span></div>'
  ).join("");
  document.getElementById("prList").querySelectorAll("[data-ex]").forEach(row=>
    row.addEventListener("click", ()=>openLiftChart(row.dataset.ex,"legacy:"+normalizeExerciseName(row.dataset.ex))));
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
const ADAPTIVE_TDEE_LOOKBACK_DAYS = 28;
const ADAPTIVE_TDEE_MIN_WEIGHT_ENTRIES = 4;
const ADAPTIVE_TDEE_MIN_SPAN_DAYS = 14;
const ADAPTIVE_TDEE_MIN_CALORIE_DAYS = 10;
const ADAPTIVE_TDEE_MIN_CALORIE_COVERAGE = 0.70;
const ADAPTIVE_TDEE_MAX_ABS_WEEKLY_CHANGE = 3;
function adaptiveTDEERequiredCalorieDays(spanDays){
  return Math.max(ADAPTIVE_TDEE_MIN_CALORIE_DAYS,Math.ceil(Number(spanDays)*ADAPTIVE_TDEE_MIN_CALORIE_COVERAGE));
}
function adaptiveTargetProposal(tdee, goalAdjustment){
  const estimate=Number(tdee), adjustment=SUPPORTED_GOAL_ADJUSTMENTS.includes(Number(goalAdjustment)) ? Number(goalAdjustment) : 0;
  if(!Number.isFinite(estimate) || estimate<MIN_DAILY_CALORIE_TARGET || estimate>MAX_DAILY_CALORIE_TARGET) return {ok:false, target:null, message:"The log-derived estimate is outside BlackPyre’s supported range."};
  const target=Math.round(estimate+adjustment);
  const safety=calorieTargetSafety(target);
  return {ok:safety.ok, target:target, message:safety.ok?"":safety.message};
}
function computeTDEE(){
  const today = new Date();
  const cutoff = new Date(today.getTime() - ADAPTIVE_TDEE_LOOKBACK_DAYS*86400000);
  const cutStr = cutoff.getFullYear()+"-"+String(cutoff.getMonth()+1).padStart(2,"0")+"-"+String(cutoff.getDate()).padStart(2,"0");
  const wts = data.weights.filter(w=>w.date>=cutStr && Number.isFinite(Number(w.lbs)) && Number(w.lbs)>=NUTRITION_CALCULATOR_LIMITS.minWeightLb && Number(w.lbs)<=NUTRITION_CALCULATOR_LIMITS.maxWeightLb).sort((a,b)=>a.date.localeCompare(b.date));
  if (wts.length<ADAPTIVE_TDEE_MIN_WEIGHT_ENTRIES) return null;
  const spanDays = (new Date(wts[wts.length-1].date) - new Date(wts[0].date))/86400000;
  if (spanDays<ADAPTIVE_TDEE_MIN_SPAN_DAYS) return null;
  const tStr = todayStr();
  const calDays = Object.keys(data.food).filter(d=>d>=wts[0].date && d<=wts[wts.length-1].date && d<tStr)
    .map(d=>daySums(d).cal).filter(c=>c>800);
  const requiredDays=adaptiveTDEERequiredCalorieDays(spanDays);
  if (calDays.length<requiredDays) return null;
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
  const weeklyChange=Math.round(slope*7*10)/10;
  if(!Number.isFinite(tdee) || Math.abs(weeklyChange)>ADAPTIVE_TDEE_MAX_ABS_WEEKLY_CHANGE || !adaptiveTargetProposal(tdee,0).ok) return null;
  return { tdee:Math.round(tdee), avgCal:Math.round(avgCal), weeklyChange:weeklyChange, days:calDays.length, requiredDays:requiredDays, spanDays:Math.round(spanDays) };
}
let lastTDEE = null;
function renderTDEE(){
  const card = document.getElementById("tdeeCard");
  lastTDEE = computeTDEE();
  if(!lastTDEE){ card.classList.add("hidden"); return; }
  const configuredAdjustment=Number(cfg.calcInputs&&cfg.calcInputs.goal);
  const fallbackAdjustment=cfg.goalWt&&cfg.startWt&&cfg.goalWt<cfg.startWt ? -500 : 0;
  lastTDEE.goalAdjustment=SUPPORTED_GOAL_ADJUSTMENTS.includes(configuredAdjustment) ? configuredAdjustment : fallbackAdjustment;
  lastTDEE.proposal=adaptiveTargetProposal(lastTDEE.tdee,lastTDEE.goalAdjustment);
  card.classList.remove("hidden");
  document.getElementById("tdeeText").innerHTML =
    'Estimated TDEE from your logs: <b class="ember-text">'+lastTDEE.tdee+' kcal/day</b><br>'
    +'Based on '+lastTDEE.days+' sufficiently logged days across '+lastTDEE.spanDays+' days, avg '+lastTDEE.avgCal+' kcal, trending '
    +(()=>{ const change=poundsToUnit(lastTDEE.weeklyChange,currentUnitSystem(),2); return (change<=0?change:"+"+change)+' '+unitWeightLabel()+'/week'; })()
    +(lastTDEE.proposal.ok?'<br>Suggested target to review: <b>'+lastTDEE.proposal.target+' kcal/day</b>':'');
  const btn=document.getElementById("tdeeApplyBtn");
  btn.disabled=!lastTDEE.proposal.ok;
  btn.setAttribute("aria-disabled",String(!lastTDEE.proposal.ok));
  const note=document.getElementById("tdeeSafetyText");
  note.textContent=lastTDEE.proposal.ok
    ? "This is a trend-based estimate, not a measurement or medical prescription. Review it in Settings before saving."
    : "BlackPyre will not suggest this target because it would fall below the "+MIN_DAILY_CALORIE_LABEL+" kcal safety floor.";
  note.style.color=lastTDEE.proposal.ok?"":"var(--warn)";
}
document.getElementById("tdeeApplyBtn").addEventListener("click", ()=>{
  if(!lastTDEE || !lastTDEE.proposal || !lastTDEE.proposal.ok){ flashSave("No safe target is available to review.",true); return; }
  const target=lastTDEE.proposal.target;
  const priorCal=Number(cfg.calTarget);
  activateView("settings",null,false);
  document.getElementById("settingsGoalsDetails").open=true;
  document.getElementById("sCalTarget").value=target;
  if(priorCal>0){
    const ratio=target/priorCal;
    if(Number(cfg.proTarget)>0) document.getElementById("sProTarget").value=Math.max(1,Math.round(cfg.proTarget*ratio));
    if(Number(cfg.carbGoal)>0) document.getElementById("sCarb").value=Math.max(1,Math.round(cfg.carbGoal*ratio));
    if(Number(cfg.fatGoal)>0) document.getElementById("sFat").value=Math.max(1,Math.round(cfg.fatGoal*ratio));
  }
  const field=document.getElementById("sCalTarget");
  if(field.scrollIntoView) field.scrollIntoView({behavior:"smooth",block:"center"});
  flashSave("Review the suggested target, then tap Save settings to apply it.");
  ackBtn("tdeeApplyBtn", "✓ Ready to review");
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
      deleteSavedMealAt(i);
    });
    el.appendChild(b);
  });
}

// ================== PLATE MATH & REST TIMER ==================
function plateMath(target, bar, system){
  const perSide = (target-bar)/2;
  if (perSide<0) return "Lighter than the bar";
  const plates = isMetricSystem(system) ? [25,20,15,10,5,2.5,1.25] : [45,35,25,10,5,2.5];
  let rem = perSide; const out = [];
  plates.forEach(p=>{ const n = Math.floor(rem/p); if(n>0){ out.push(n+"×"+p); rem = Math.round((rem-n*p)*100)/100; } });
  return out.length ? out.join(" + ")+" per side"+(rem>0?" (+"+rem+" left)":"") : "Empty bar";
}
function updatePlates(){
  const t = Number(document.getElementById("plateTarget").value);
  const b = Number(document.getElementById("plateBar").value);
  document.getElementById("plateOut").textContent = t ? plateMath(t,b,currentUnitSystem()) : "";
}
function renderPlateUnits(){
  const target=document.getElementById("plateTarget"), bar=document.getElementById("plateBar");
  if(!target||!bar) return;
  const metric=isMetricSystem(), previous=Number(bar.value);
  target.placeholder=metric?"Target weight, e.g. 100":"Target weight, e.g. 275";
  target.setAttribute("aria-label","Target loaded weight in "+(metric?"kilograms":"pounds"));
  const values=metric?[[20,"20 kg"],[15,"15 kg"],[10,"10 kg"]]:[[45,"45 lb"],[35,"35 lb"],[15,"15 lb"]];
  bar.innerHTML=values.map(item=>'<option value="'+item[0]+'">'+item[1]+'</option>').join("");
  if(values.some(item=>item[0]===previous)) bar.value=String(previous);
  updatePlates();
}
document.getElementById("plateTarget").addEventListener("input", updatePlates);
document.getElementById("plateBar").addEventListener("change", updatePlates);

let restInterval = null, restRunning = false, restPaused = false;
let restRemaining = 0, restEndsAt = 0, restDurationSec = 0, restReadySec = 0, restStateRestored = false;
const REST_NOTIFICATION_ID = 64065;
let restNotificationWork = Promise.resolve();
let restActivityWork = Promise.resolve();
function fmtRest(sec){ return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0"); }
function restActivityCapability(){
  const c = window.Capacitor;
  let native = false, plugin = null;
  try { native = !!(c && typeof c.isNativePlatform==="function" && c.isNativePlatform()); } catch(e){}
  try { plugin = c && c.Plugins ? c.Plugins.BlackPyreRestActivity : null; } catch(e){}
  return {available:!!(native && plugin), plugin:plugin};
}
function queueRestActivity(task){
  restActivityWork = restActivityWork.catch(()=>{}).then(task);
  return restActivityWork;
}
function syncRestActivity(){
  const snapshot = restRunning
    ? {status:"running", endAt:restEndsAt, remainingSec:restRemaining}
    : restPaused
      ? {status:"paused", endAt:0, remainingSec:restRemaining}
      : null;
  if (!snapshot) return endRestActivity();
  return queueRestActivity(async ()=>{
    const capability = restActivityCapability();
    if (!capability.available) return {available:false};
    try {
      return await capability.plugin.sync(snapshot);
    } catch(e){
      console.warn("BlackPyre could not sync the rest Live Activity:", e);
      return {available:true, error:true};
    }
  });
}
function endRestActivity(){
  return queueRestActivity(async ()=>{
    const capability = restActivityCapability();
    if (!capability.available) return {available:false};
    try {
      return await capability.plugin.end();
    } catch(e){
      console.warn("BlackPyre could not end the rest Live Activity:", e);
      return {available:true, error:true};
    }
  });
}
function restNotificationCapability(){
  const c = window.Capacitor;
  let native = false, available = false, plugin = null;
  try { native = !!(c && typeof c.isNativePlatform==="function" && c.isNativePlatform()); } catch(e){}
  try { available = !!(c && typeof c.isPluginAvailable==="function" && c.isPluginAvailable("LocalNotifications")); } catch(e){}
  try { plugin = c && c.Plugins ? c.Plugins.LocalNotifications : null; } catch(e){}
  return {available:!!(native && available && plugin), plugin:plugin};
}
function queueRestNotification(task){
  restNotificationWork = restNotificationWork.catch(()=>{}).then(task);
  return restNotificationWork;
}
async function clearPendingRestNotification(plugin){
  const pending = await plugin.getPending();
  const matches = pending && Array.isArray(pending.notifications)
    ? pending.notifications.filter(n=>Number(n && n.id)===REST_NOTIFICATION_ID)
    : [];
  if (matches.length){
    await plugin.cancel({notifications:[{id:REST_NOTIFICATION_ID}]});
  }
  return matches.length;
}
async function restNotificationPermission(plugin, allowRequest){
  let status = await plugin.checkPermissions();
  let state = status && status.display;
  if (allowRequest && (state==="prompt" || state==="prompt-with-rationale")){
    status = await plugin.requestPermissions();
    state = status && status.display;
  }
  return state==="granted";
}
function cancelRestNotification(){
  return queueRestNotification(async ()=>{
    const capability = restNotificationCapability();
    if (!capability.available) return {available:false, cancelled:false};
    try {
      const cancelled = await clearPendingRestNotification(capability.plugin);
      return {available:true, cancelled:!!cancelled};
    } catch(e){
      console.warn("BlackPyre could not cancel the rest notification:", e);
      return {available:true, cancelled:false, error:true};
    }
  });
}
function scheduleRestNotification(endAt, allowPermissionRequest){
  const expectedEndAt = Number(endAt);
  return queueRestNotification(async ()=>{
    const capability = restNotificationCapability();
    if (!capability.available) return {available:false, granted:false, scheduled:false};
    try {
      const granted = await restNotificationPermission(capability.plugin, !!allowPermissionRequest);
      if (!granted){
        await clearPendingRestNotification(capability.plugin);
        return {available:true, granted:false, scheduled:false};
      }
      await clearPendingRestNotification(capability.plugin);
      if (!restRunning || restEndsAt!==expectedEndAt || expectedEndAt<=Date.now()){
        return {available:true, granted:true, scheduled:false};
      }
      await capability.plugin.schedule({notifications:[{
        id:REST_NOTIFICATION_ID,
        title:"Rest complete",
        body:"Your rest timer is finished.",
        schedule:{at:new Date(expectedEndAt)},
        sound:"default",
        extra:{blackpyreType:"rest-timer"}
      }]});
      return {available:true, granted:true, scheduled:true};
    } catch(e){
      console.warn("BlackPyre could not schedule the rest notification:", e);
      return {available:true, granted:false, scheduled:false, error:true};
    }
  });
}
function reconcileRestNotification(){
  if (restRunning && restEndsAt>Date.now()) return scheduleRestNotification(restEndsAt, false);
  return cancelRestNotification();
}
function selectedRestSeconds(){ return Math.max(10, Math.round(Number(cfg.restSec)||90)); }
function normalizedRestSeconds(value, fallback){
  const seconds = Math.round(Number(value));
  return Number.isFinite(seconds) && seconds>0 ? seconds : Math.max(1, Math.round(Number(fallback)||selectedRestSeconds()));
}
function readyRestSeconds(){ return normalizedRestSeconds(restReadySec, selectedRestSeconds()); }
function savedRestDuration(record){ return normalizedRestSeconds(record && record.durationSec, record && record.remainingSec); }
function setRestOptionsOpen(open){
  const box = document.getElementById("restDockOptions");
  const btn = document.getElementById("restDurationBtn");
  if (!box || !btn) return;
  box.classList.toggle("hidden", !open);
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  const caret = btn.querySelector(".rest-dock-caret");
  if (caret) caret.textContent = open ? "⌃" : "⌄";
  document.body.classList.toggle("rest-options-open", !!open && !document.getElementById("restDock").classList.contains("hidden"));
  if (!open){
    const custom = document.getElementById("restCustomRow");
    const customBtn = document.getElementById("restCustomBtn");
    if (custom) custom.classList.add("hidden");
    if (customBtn) customBtn.setAttribute("aria-expanded","false");
  }
}
function paintRestDock(){
  const disp = document.getElementById("restDisplay");
  const start = document.getElementById("restStartBtn");
  const pause = document.getElementById("restPauseBtn");
  const add = document.getElementById("restAddBtn");
  const end = document.getElementById("restEndBtn");
  if (!disp || !start || !pause || !add || !end) return;
  disp.textContent = fmtRest((restRunning||restPaused) ? restRemaining : readyRestSeconds());
  disp.style.color = (restRunning||restPaused) && restRemaining<=10 ? "var(--ok)" : "var(--text)";
  start.classList.toggle("hidden", restRunning || restPaused);
  pause.classList.toggle("hidden", !(restRunning || restPaused));
  add.classList.toggle("hidden", !(restRunning || restPaused));
  end.classList.toggle("hidden", !(restRunning || restPaused));
  pause.textContent = restPaused ? "Resume" : "Pause";
}
function stopRestInterval(){
  clearInterval(restInterval);
  restInterval = null;
}
function persistRestTimer(){
  if (restRunning){
    writeRestTimerState({status:"running", endAt:restEndsAt, remainingSec:restRemaining, durationSec:restDurationSec, savedAt:Date.now()});
  } else if (restPaused){
    writeRestTimerState({status:"paused", remainingSec:restRemaining, durationSec:restDurationSec, savedAt:Date.now()});
  }
  syncRestActivity();
}
function finishRestCountdown(){
  const completedDuration = normalizedRestSeconds(restDurationSec, restReadySec);
  stopRestInterval();
  restRunning = false;
  restPaused = false;
  restRemaining = 0;
  restEndsAt = 0;
  restDurationSec = completedDuration;
  restReadySec = completedDuration;
  writeRestTimerState({status:"ready", durationSec:completedDuration, savedAt:Date.now()});
  endRestActivity();
  paintRestDock();
}
function syncRestFromClock(){
  if (!restRunning) return false;
  restRemaining = Math.max(0, Math.ceil((restEndsAt-Date.now())/1000));
  if (restRemaining<=0){
    finishRestCountdown();
    return false;
  }
  return true;
}
function tickRestCountdown(){
  if (syncRestFromClock()) paintRestDock();
}
function armRestInterval(){
  stopRestInterval();
  restInterval = setInterval(tickRestCountdown, 1000);
}
function runRestCountdown(){
  stopRestInterval();
  if (restRemaining<=0){
    finishRestCountdown();
    return;
  }
  restEndsAt = Date.now() + (restRemaining*1000);
  restRunning = true;
  restPaused = false;
  persistRestTimer();
  paintRestDock();
  armRestInterval();
  scheduleRestNotification(restEndsAt, true).then(result=>{
    if (result && result.available && !result.granted && !result.error){
      flashSave("Rest timer started — notifications are off", true);
    }
  });
}
function startRest(seconds){
  restDurationSec = normalizedRestSeconds(seconds, selectedRestSeconds());
  restReadySec = restDurationSec;
  restRemaining = restDurationSec;
  runRestCountdown();
}
function pauseRest(){
  if (restRunning){
    if (!syncRestFromClock()) return;
    stopRestInterval();
    restRunning = false;
    restPaused = true;
    restEndsAt = 0;
    persistRestTimer();
    paintRestDock();
    cancelRestNotification();
    return;
  }
  if (restPaused) runRestCountdown();
}
function addRest(seconds){
  if (!(restRunning || restPaused)) return;
  const added = Math.max(1, Math.round(Number(seconds)||30));
  if (restRunning){
    if (!syncRestFromClock()) return;
    restRemaining += added;
    restEndsAt += added*1000;
  } else {
    restRemaining += added;
  }
  persistRestTimer();
  paintRestDock();
  if (restRunning) scheduleRestNotification(restEndsAt, false);
}
function cancelRest(){
  stopRestInterval();
  restRunning = false;
  restPaused = false;
  restRemaining = 0;
  restEndsAt = 0;
  restDurationSec = 0;
  restReadySec = selectedRestSeconds();
  clearRestTimerState();
  endRestActivity();
  paintRestDock();
  cancelRestNotification();
}
function restoreRestTimerState(){
  if (restStateRestored) return;
  restStateRestored = true;
  const saved = readRestTimerState();
  if (!saved.ok){
    cancelRestNotification();
    endRestActivity();
    return;
  }
  restDurationSec = savedRestDuration(saved.record);
  restReadySec = restDurationSec;
  if (saved.record.status==="running"){
    restEndsAt = saved.record.endAt;
    restRunning = true;
    restPaused = false;
    if (!syncRestFromClock()){
      cancelRestNotification();
      return;
    }
    armRestInterval();
    reconcileRestNotification();
    syncRestActivity();
  } else if (saved.record.status==="paused") {
    restRemaining = Math.max(1, Math.round(saved.record.remainingSec));
    restRunning = false;
    restPaused = true;
    restEndsAt = 0;
    syncRestActivity();
  } else {
    restRemaining = 0;
    restRunning = false;
    restPaused = false;
    restEndsAt = 0;
    endRestActivity();
  }
  if (!restRunning) cancelRestNotification();
}
function reconcileRestTimer(){
  if (restRunning) tickRestCountdown();
  else if (restPaused) paintRestDock();
}
document.addEventListener("visibilitychange", ()=>{ if (!document.hidden) reconcileRestTimer(); });
window.addEventListener("pageshow", reconcileRestTimer);
window.addEventListener("focus", reconcileRestTimer);
document.getElementById("restDurationBtn").addEventListener("click", ()=>{
  const box = document.getElementById("restDockOptions");
  setRestOptionsOpen(box.classList.contains("hidden"));
});
document.getElementById("restStartBtn").addEventListener("click", ()=>{ setRestOptionsOpen(false); startRest(readyRestSeconds()); });
document.getElementById("restPauseBtn").addEventListener("click", pauseRest);
document.getElementById("restAddBtn").addEventListener("click", ()=>addRest(30));
document.getElementById("restEndBtn").addEventListener("click", cancelRest);
function applyRestDurationSelection(seconds){
  const next = normalizedRestSeconds(
    seconds,
    selectedRestSeconds()
  );

  cfg.restSec = next;
  saveCfg();
  restReadySec = next;

  if (restRunning){
    restDurationSec = next;
    restRemaining = next;
    restEndsAt = Date.now() + (next*1000);

    persistRestTimer();
    scheduleRestNotification(
      restEndsAt,
      false
    );

    return "running";
  }

  if (restPaused){
    restDurationSec = next;
    restRemaining = next;
    restEndsAt = 0;

    persistRestTimer();
    cancelRestNotification();

    return "paused";
  }

  restDurationSec = 0;
  restRemaining = 0;
  restEndsAt = 0;

  clearRestTimerState();
  cancelRestNotification();

  return "ready";
}

function renderRestPresets(){
  restoreRestTimerState();
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
      applyRestDurationSelection(p);
      renderRestPresets();
      setRestOptionsOpen(false);
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
        if (!(restRunning||restPaused)){
          restReadySec = selectedRestSeconds();
          restDurationSec = 0;
          clearRestTimerState();
          cancelRestNotification();
        }
        renderRestPresets();
        if (!(restRunning||restPaused)) paintRestDock();
      });
      holder.appendChild(x);
    }
    wrap.appendChild(holder);
  };
  const fixed = [30,60,90,120];
  fixed.forEach(p=>addChip(p, false));
  const extras = cfg.customRests.slice();
  const selected = selectedRestSeconds();
  if (fixed.indexOf(selected)===-1 && extras.indexOf(selected)===-1) extras.push(selected);
  extras.forEach(p=>{ if(fixed.indexOf(p)===-1) addChip(p, true); });
  paintRestDock();
}
document.getElementById("restCustomBtn").addEventListener("click", ()=>{
  const row = document.getElementById("restCustomRow");
  const opening = row.classList.contains("hidden");
  row.classList.toggle("hidden", !opening);
  document.getElementById("restCustomBtn").setAttribute("aria-expanded", opening ? "true" : "false");
});
document.getElementById("restCustomSet").addEventListener("click", ()=>{
  const v = Math.round(Number(document.getElementById("restCustomInput").value));
  if (!v || v<10 || v>1800){ flashSave("10–1800 seconds", true); return; }
  if (!cfg.customRests) cfg.customRests = [];
  if (cfg.customRests.indexOf(v)===-1 && [30,60,90,120].indexOf(v)===-1){
    cfg.customRests.push(v);
    cfg.customRests = cfg.customRests.slice(-4); // keep it tidy
  }
  cfg.restSec = v;
  saveCfg();
  if (!(restRunning||restPaused)){
    restReadySec = v;
    restDurationSec = 0;
    clearRestTimerState();
    cancelRestNotification();
  }
  document.getElementById("restCustomRow").classList.add("hidden");
  document.getElementById("restCustomInput").value = "";
  renderRestPresets();
  if (!(restRunning||restPaused)) paintRestDock();
  setRestOptionsOpen(false);
});

// ================== SHARE PUBLIC TRAINING PLAN ==================
document.getElementById("shareBtn").addEventListener("click", async ()=>{
  const publicPlan =
    trainingPlanInterchangeFromProgram(program);

  const json =
    JSON.stringify(publicPlan,null,2);

  const fname =
    blackpyreTrainingPlanFilename(program.name);

  try {
    if (navigator.canShare && window.File){
      const file =
        new File(
          [json],
          fname,
          {type:"application/json"}
        );

      if (navigator.canShare({files:[file]})){
        await navigator.share({
          files:[file],
          title:program.name
        });
        return;
      }
    }

    if (navigator.share){
      await navigator.share({
        title:program.name,
        text:json
      });
      return;
    }
  } catch(e){
    // User cancellation and unsupported share targets use fallback.
  }

  download(fname,json);
});
