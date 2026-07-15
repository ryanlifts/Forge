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

function diagnosticAreaText(){
  const d = protectedModeDiagnostic || {};
  const names = {cfg:"settings",data:"logged data",program:"training program",state:"saved state"};
  const area = names[d.part] || d.part || "saved state";
  const stage = d.stage ? "Failure stage: "+d.stage+"." : "";
  return "Affected area: "+area+". "+stage;
}
function showProtectedBanner(){
  const banner = document.getElementById("protectedBanner");
  const text = document.getElementById("protectedBannerText");
  const recoveryBtn = document.getElementById("protectedRecoveryBtn");
  if (!protectedMode){ banner.classList.add("hidden"); text.textContent=""; recoveryBtn.classList.add("hidden"); return; }
  banner.classList.remove("hidden");
  if (protectedModeKind==="newer"){
    text.textContent = "This saved data came from a newer BlackPyre version. This older copy will not change it. Close and reopen the app — or use the update notice — to load the current version. Do not uninstall the app.";
    recoveryBtn.classList.add("hidden");
  } else if (protectedModeDiagnostic && protectedModeDiagnostic.stage==="storage-read"){
    text.textContent = "BlackPyre could not safely read browser storage. No recovery write is allowed because the app cannot prove what it would preserve. Do not uninstall the app.";
    recoveryBtn.classList.add("hidden");
  } else {
    text.textContent = "BlackPyre couldn't safely use part of your saved data, so normal saving is paused. Your original data is still preserved. Open recovery to restore a validated snapshot, use a backup, or keep every readable area.";
    recoveryBtn.classList.remove("hidden");
  }
}
function setRecoveryActionStatus(message, bad){
  const el = document.getElementById("recoveryActionStatus");
  if (!el) return;
  el.textContent = message || "";
  el.style.color = bad===false ? "var(--ok)" : "var(--warn)";
}
function openRecoveryPanel(){
  if (!protectedMode || !recoveryWritesAllowed()) return false;
  renderRecoveryPanel();
  document.getElementById("recoveryOverlay").classList.remove("hidden");
  lockScroll();
  return true;
}
function closeRecoveryPanel(){
  document.getElementById("recoveryOverlay").classList.add("hidden");
  unlockScroll();
}
function renderRecoveryPanel(){
  const overlay = document.getElementById("recoveryOverlay");
  if (!protectedMode || !recoveryWritesAllowed()){
    overlay.classList.add("hidden");
    return;
  }
  document.getElementById("recoveryIssueText").textContent = protectedModeReason || "BlackPyre could not safely use part of the saved state.";
  document.getElementById("recoveryAffectedText").textContent = diagnosticAreaText()+" Do not uninstall until recovery is complete.";

  const lkg = buildLkgRecoveryCandidate();
  const lkgBtn = document.getElementById("recoverLkgBtn");
  lkgBtn.disabled = !lkg.ok;
  document.getElementById("recoveryLkgText").textContent = lkg.ok
    ? lkg.summary
    : (lkg.code==="newer" ? "A newer-version snapshot exists and this copy will not use or overwrite it." : "No validated last-known-good snapshot is available on this device.");

  const readable = buildReadableRecoveryCandidate();
  const readableBtn = document.getElementById("recoverReadableBtn");
  readableBtn.disabled = !readable.ok;
  document.getElementById("recoveryReadableText").textContent = readable.ok
    ? readable.summary+". No malformed JSON or damaged records will be guessed."
    : "BlackPyre could not build a validated readable-state candidate.";
}
function confirmRecoveryCandidate(candidate){
  return confirm("Review this recovery:\n\n"+candidate.summary+"\n\nBlackPyre will preserve the exact current originals before changing primary storage. Continue?");
}
function handleRecoveryResult(candidate, options){
  const result = performRecoveryCandidate(candidate, options||{});
  if (result.ok){
    setRecoveryActionStatus("Recovery completed and verified ✓", false);
    document.getElementById("recoveryOverlay").classList.add("hidden");
    flashSave("Recovery completed ✓");
    return result;
  }
  if (result.code==="quarantine-conflict"){
    const replace = confirm("A different recovery copy is already stored. Export it first if needed. Replace that older quarantine with the current exact originals?");
    if (replace) return handleRecoveryResult(candidate,{replaceExistingQuarantine:true});
  } else if (result.code==="quarantine-write"){
    setRecoveryActionStatus(result.reason+" Use ‘Export raw originals,’ confirm the file is safe, then try recovery again.", true);
  } else if (result.code==="quarantine-newer"){
    setRecoveryActionStatus(result.reason, true);
  } else {
    setRecoveryActionStatus(result.reason || "Recovery could not be completed safely.", true);
  }
  renderRecoveryPanel();
  return result;
}
function runRecoveryCandidate(candidate){
  if (!candidate.ok){ setRecoveryActionStatus(candidate.reason || "That recovery source is unavailable.", true); return; }
  if (!confirmRecoveryCandidate(candidate)) return;
  handleRecoveryResult(candidate,{});
}

document.getElementById("protectedRecoveryBtn").addEventListener("click", openRecoveryPanel);
document.getElementById("recoveryCloseBtn").addEventListener("click", closeRecoveryPanel);
document.getElementById("recoverLkgBtn").addEventListener("click", ()=>runRecoveryCandidate(buildLkgRecoveryCandidate()));
document.getElementById("recoverReadableBtn").addEventListener("click", ()=>runRecoveryCandidate(buildReadableRecoveryCandidate()));
document.getElementById("recoveryBackupBtn").addEventListener("click", ()=>document.getElementById("recoveryBackupFile").click());
document.getElementById("recoveryBackupFile").addEventListener("change", e=>{
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try { runRecoveryCandidate(prepareRecoveryBackupEnvelope(JSON.parse(reader.result))); }
    catch(err){ setRecoveryActionStatus("The selected file is not valid JSON.", true); }
  };
  reader.readAsText(file);
  e.target.value="";
});
document.getElementById("recoveryPartialExportBtn").addEventListener("click", ()=>doBackup("recoveryPartialExportBtn"));
document.getElementById("recoveryRawExportBtn").addEventListener("click", exportRawRecoveryOriginals);
// ================== boot ==================
showProtectedBanner();
renderRecoveryPanel();
if (protectedMode && recoveryWritesAllowed()) openRecoveryPanel();
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
// ================== UPDATE TOAST ==================
// Shows once per page session when the service worker hands control to a NEW version
// while the page already had one (i.e., a real update — never the first install).
let updateToastShown = false;   // at most one toast per page session
let updateReloaded  = false;    // tapping reload acts exactly once
function requestAppReload(){ location.reload(); } // seam: tests replace this to count reloads
function showUpdateToast(){
  if (updateToastShown) return;
  updateToastShown = true;
  document.getElementById("updateToast").classList.remove("hidden");
}
function dismissUpdateToast(){
  // session-only dismissal by design: no storage, next launch updates naturally
  document.getElementById("updateToast").classList.add("hidden");
}
function applyUpdateReload(){
  if (updateReloaded) return;
  updateReloaded = true;
  document.getElementById("updateToast").classList.add("hidden");
  requestAppReload();
}
document.getElementById("updateReloadBtn").addEventListener("click", applyUpdateReload);
document.getElementById("updateDismissBtn").addEventListener("click", dismissUpdateToast);

if ("serviceWorker" in navigator) {
  // capture BEFORE register: no controller means first install, and first install must not toast
  const hadController = !!navigator.serviceWorker.controller;
  // listener attached BEFORE register(), per spec
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{
    if (hadController && !updateReloaded) showUpdateToast();
  });
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}
