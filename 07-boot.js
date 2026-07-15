"use strict";
// ================== DASH ==================
function renderJourney(){
  const el = document.getElementById("journey");
  if (!cfg.goalWt || !cfg.startWt || cfg.goalWt===cfg.startWt){ el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  const sorted = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const cur = sorted.length ? sorted[sorted.length-1].lbs : cfg.startWt;
  let pct = (cfg.startWt - cur) / (cfg.startWt - cfg.goalWt); // works cutting or gaining
  pct = Math.max(0, Math.min(1, pct));
  document.getElementById("jyFill").style.width = (pct*100)+"%";
  document.getElementById("jyDot").style.left = (pct*100)+"%";
  document.getElementById("jyNow").textContent = (pct>=1 ? "✓ " : "") + cur + " lb";
  document.getElementById("jyStart").textContent = cfg.startWt + " start";
  document.getElementById("jyGoal").textContent = cfg.goalWt + " goal";
  renderJourneyMsg();
}
function renderDash(){
  renderJourney();
  const sorted=data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const hasStart = Number(cfg.startWt)>0;
  const hasGoal = Number(cfg.goalWt)>0;
  const cur=sorted.length?sorted[sorted.length-1].lbs:(hasStart?cfg.startWt:null);
  let moved=0, toGo=0, pct=0;
  if (cur!=null && hasStart && hasGoal && cfg.startWt!==cfg.goalWt){
    const total=Math.abs(cfg.startWt-cfg.goalWt);
    moved=cfg.startWt>cfg.goalWt ? cfg.startWt-cur : cur-cfg.startWt;
    toGo=Math.abs(cur-cfg.goalWt);
    pct=Math.max(0,Math.min(100,(moved/total)*100));
  }
  document.getElementById("dashWt").textContent=cur==null?"—":cur;
  document.getElementById("dashWtNote").textContent=(cur==null||!hasStart||!hasGoal)
    ? "Set your bodyweight goal in Settings"
    : (moved>0?((cfg.startWt>cfg.goalWt?"−":"+")+moved.toFixed(1)+" lb · "):"Baseline · ")+toGo.toFixed(1)+" to go";
  document.getElementById("dashPct").textContent=pct.toFixed(0);
  document.getElementById("dashPctFill").style.width=pct+"%";
  const t=todayStr(), s=daySums(t);
  document.getElementById("dashDateLabel").textContent="Today · "+fmtDate(t);
  document.getElementById("dashBars").innerHTML=allBarsHTML(s);
  const dt = dayTargets(t);
  const calLeft = Math.max(0, dt.cal - s.cal);
  const proLeft = Math.max(0, dt.pro - s.pro);
  document.getElementById("dashRemaining").textContent = !nutritionTargetsReady()
    ? "Set targets in Settings."
    : (calLeft>0||proLeft>0) ? ("Remaining today: "+Math.round(calLeft)+" kcal · "+Math.round(proLeft)+"g protein") : "Targets hit ✓";
  const lastArr=data.workouts.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const last=lastArr[0];
  const el=document.getElementById("dashLast");
  if(last){
    const dayObj = program.days.find(p=>p.id===last.day);
    const title = last.title || (dayObj?dayObj.title:last.day);
    el.innerHTML='<div style="font-weight:600; color:var(--ember);">'+fmtDate(last.date)+' — '+esc(title)+'</div>'
      +'<div style="margin-top:8px; line-height:1.7;">'+Object.keys(last.sets).map(ex=>'<div>'+esc(ex)+': <span style="color:var(--text)">'+esc(formatSets(last.sets[ex]))+'</span></div>').join("")+'</div>';
  } else {
    el.textContent="No sessions yet. Head to Train and log your first one.";
  }
}

document.getElementById("saveUsdaBtn").addEventListener("click", ()=>{
  cfg.usdaKey = document.getElementById("sUsdaKey").value.trim();
  saveCfg(); flashSave(cfg.usdaKey ? "USDA key saved ✓" : "USDA key cleared");
  ackBtn("saveUsdaBtn", cfg.usdaKey ? "✓ Key saved" : "✓ Cleared");
});

function renderNextWorkout(){
  const btn = document.getElementById("nextWorkoutBtn");
  const nd = nextProgramDay();
  if (!nd){ btn.classList.add("hidden"); return; }
  btn.textContent = "Start next: "+(nd.id?nd.id+" · ":"")+nd.title;
  btn.classList.remove("hidden");
}
function renderAll(){ renderDash(); renderFood(); renderWork(); renderWeight(); renderSettings(); renderMeals(); renderPRs(); renderTDEE(); renderNextWorkout(); renderWeek(); renderProjection(); renderMeasureToggle(); renderMeasure(); renderWater(); renderAccentRow(); renderBackup();
  const st = computeStreak();
  const sl = document.getElementById("streakLine");
  if (st>=2){ sl.textContent = ""+st+"-day logging streak — keep the chain alive"; sl.classList.remove("hidden"); }
  else sl.classList.add("hidden");
  document.getElementById("sUsdaKey").value = cfg.usdaKey||"";
  document.getElementById("waterToggleBtn").textContent = cfg.waterOn ? "Disable water tracking" : "Enable water tracking";
  renderAIGates();
}


// Select an existing numeric value on tap/focus so the next keystroke replaces it.
// Delegation covers fields created later by dynamic renders; date/text/select/textarea are excluded.
function selectNumericOnFocus(e){
  const el = e.target;
  if (!el || el.tagName!=="INPUT" || el.type!=="number" || el.disabled || el.readOnly) return;
  if (el.value==="") return;
  requestAnimationFrame(()=>{
    try { el.select(); } catch(err){}
  });
}
document.addEventListener("focusin", selectNumericOnFocus);
document.addEventListener("pointerup", e=>{
  const el=e.target;
  if (!el || el.tagName!=="INPUT" || el.type!=="number" || el.value==="") return;
  e.preventDefault();
  requestAnimationFrame(()=>{ try { el.select(); } catch(err){} });
});

// ================== EASTER EGG ==================
// press and hold the BlackPyre title for 3 seconds — it dissolves into Bella's handwriting, then returns
const EGG_HOLD_MS = 3000;   // hold to reveal
const EGG_SHOW_MS = 4000;   // how long she stays
let eggTimer = null, eggBackTimer = null, eggActive = false;
function eggShow(){
  if (eggActive) return;
  eggActive = true;
  document.getElementById("bpTitleText").style.opacity = "0";
  document.getElementById("bellaEgg").style.opacity = "1";
  eggBackTimer = setTimeout(eggHide, EGG_SHOW_MS);
}
function eggHide(){
  document.getElementById("bellaEgg").style.opacity = "0";
  document.getElementById("bpTitleText").style.opacity = "1";
  if (eggBackTimer){ clearTimeout(eggBackTimer); eggBackTimer = null; }
  setTimeout(()=>{ eggActive = false; }, 750); // after the dissolve completes
}
function eggArm(){
  if (eggActive) return;
  eggDisarm();
  eggTimer = setTimeout(eggShow, EGG_HOLD_MS);
}
function eggDisarm(){
  if (eggTimer){ clearTimeout(eggTimer); eggTimer = null; }
}
(function(){
  const t = document.getElementById("bpTitle");
  t.addEventListener("pointerdown", eggArm);
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>t.addEventListener(ev, eggDisarm));
  t.addEventListener("contextmenu", e=>e.preventDefault()); // iOS long-press callout
})();

// ================== boot ==================
renderDayOptions();
renderCardioOptions();
renderLibraryOptions();
applyAccent();
initSessionState();
renderSessionInputs();
renderMealSeg();
renderRestPresets();
renderAll();

// PWA service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}
