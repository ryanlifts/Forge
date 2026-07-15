"use strict";
// ================== storage keys & defaults ==================
const DATA_KEY = "forge:data", CFG_KEY = "forge:cfg", PROG_KEY = "forge:program";

const DEFAULT_CFG = { startWt:0, goalWt:0, calTarget:0, proTarget:0, carbGoal:0, fatGoal:0, accent:"gold" };
const ACCENT_KEYS = ["ember","steel","emerald","crimson","violet","gold","pink"];

const DEFAULT_PROGRAM = {
  name: "Full Body Foundations (3-Day)",
  author: "Built by Claude",
  days: [
    { id:"D1", title:"Full Body A", exercises:[
      {name:"Back Squat",scheme:"3×5"},{name:"Bench Press",scheme:"3×5"},
      {name:"Seated Cable Row",scheme:"3×10"},{name:"Plank",scheme:"3×30-60s"}]},
    { id:"D2", title:"Full Body B", exercises:[
      {name:"Romanian Deadlift",scheme:"3×8"},{name:"Overhead Press",scheme:"3×8"},
      {name:"Lat Pulldown",scheme:"3×10"},{name:"Biceps Curl",scheme:"3×12"}]},
    { id:"D3", title:"Full Body C", exercises:[
      {name:"Deadlift",scheme:"3×5"},{name:"Dumbbell Bench Press",scheme:"3×10"},
      {name:"Dumbbell Row",scheme:"3×10"},{name:"Lateral Raise",scheme:"3×15"}]},
  ],
};

const EXERCISE_LIBRARY = [
  "Bench Press","Incline Bench Press","Decline Bench Press","Dumbbell Bench Press","Dumbbell Incline Press",
  "Overhead Press","Dumbbell Shoulder Press","Push-Up","Dips","Chest Fly","Cable Crossover",
  "Barbell Row","Dumbbell Row","T-Bar Row","Seated Cable Row","Pull-Up","Chin-Up","Lat Pulldown",
  "Face Pull","Rear Delt Fly","Shrug","Lateral Raise","Front Raise",
  "Biceps Curl","Hammer Curl","Preacher Curl","Cable Curl",
  "Triceps Pushdown","Overhead Triceps Extension","Skullcrusher","Close-Grip Bench Press",
  "Back Squat","Box Squat","Front Squat","Goblet Squat","Hack Squat","Leg Press","Bulgarian Split Squat",
  "Walking Lunge","Reverse Lunge","Step-Up",
  "Deadlift","Trap Bar Deadlift","Romanian Deadlift","Sumo Deadlift","Good Morning","Hip Thrust","Glute Bridge",
  "Back Extension","Leg Curl","Leg Extension","Calf Raise","Seated Calf Raise","Spanish Squat / TKE",
  "Plank","Side Plank","Hanging Leg Raise","Cable Crunch","Ab Wheel","Russian Twist","Farmer Carry","Suitcase Carry",
];

const CARDIO_TYPES = [
  "Walk","Incline Walk","Run","Jog","Sprint Intervals","Cycling","Rowing","Swimming","Stairmaster","Elliptical",
  "Jump Rope","HIIT Circuit","Basketball","Soccer","Tennis/Pickleball","Hiking","Rucking","Sled Push/Pull","Battle Ropes","Other",
];

// local whole foods — per 100g: cal, protein, carbs, fat

const DEFAULT_USDA_KEY = "8xMjfBYwxcNbli7OVr7Gb394962FbJQvqDMDmLqi"; // shared community key — add your own in Settings for guaranteed speed
function effectiveUsdaKey(){ return (cfg.usdaKey && cfg.usdaKey.trim()) || DEFAULT_USDA_KEY; }


// ================== helpers (pure) ==================
function loadJSON(key, fallback){
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch(e){}
  return fallback;
}
function todayStr(){
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function fmtDate(iso){ const p=iso.split("-"); return p[1]+"/"+p[2]+"/"+p[0].slice(2); }
function esc(s){ const d=document.createElement("div"); d.textContent=String(s); return d.innerHTML; }
function toGrams(amt, unit, servingG){
  if (unit==="g") return amt;
  if (unit==="oz") return amt*28.35;
  if (unit==="lb") return amt*453.6;
  if (unit==="ml") return amt;            // ~1 g/ml for most foods/liquids
  if (unit==="floz") return amt*29.57;    // ~1 g/ml
  if (unit==="serving") return amt*(servingG||100);
  return amt;
}
function scaleMacro(per100, grams){ return per100*grams/100; }
function validateProgram(p){
  if(!p || typeof p!=="object") throw new Error("Not a program file");
  if(!p.days || !Array.isArray(p.days) || !p.days.length) throw new Error("Missing days array");
  p.days.forEach((d,i)=>{
    if(!d.title) d.title = "Day "+(i+1);
    if(!d.id) d.id = "D"+(i+1);
    if(!Array.isArray(d.exercises)) throw new Error("Day "+(i+1)+" missing exercises");
    d.exercises.forEach(ex=>{ if(!ex.name) throw new Error("Exercise missing name in day "+(i+1)); });
  });
  return p;
}
function download(filename, text){
  const blob = new Blob([text], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ================== state ==================
let data = loadJSON(DATA_KEY, null) || loadJSON("ryan-cut:data", null) || { food:{}, workouts:[], weights:[], recents:[] };
if(!data.recents) data.recents = []; if(!data.myFoods) data.myFoods = {}; if(!data.meals) data.meals = []; if(!data.finished) data.finished = {}; if(!data.foodCounts) data.foodCounts = {}; if(!data.mealCounts) data.mealCounts = {}; if(!data.meta) data.meta = {lastBackup:null, logsSince:0};
// migrate old range targets (calLo/calHi, proLo/proHi) to exact targets — must run on the RAW
// object before defaults merge in, or the default calTarget masks the user's real numbers
function migrateTargets(obj){
  if (!obj) return;
  if (!Number.isFinite(obj.calTarget) && Number.isFinite(obj.calLo) && Number.isFinite(obj.calHi)) obj.calTarget = Math.round((obj.calLo+obj.calHi)/2);
  if (!Number.isFinite(obj.proTarget) && Number.isFinite(obj.proLo) && Number.isFinite(obj.proHi)) obj.proTarget = Math.round((obj.proLo+obj.proHi)/2);
}
const _rawCfg = loadJSON(CFG_KEY, {});
migrateTargets(_rawCfg);
let cfg = Object.assign({}, DEFAULT_CFG, _rawCfg);
function migrateCfg(){
  ["startWt","goalWt","calTarget","proTarget","carbGoal","fatGoal"].forEach(k=>{
    const v = Number(cfg[k]);
    cfg[k] = Number.isFinite(v) && v>0 ? v : 0;
  });
  if (cfg.calSchedMode==="weekend") cfg.calSchedMode = "frisat";
  if (!cfg.calSchedMode) cfg.calSchedMode = "same";
  if (!ACCENT_KEYS.includes(cfg.accent)) cfg.accent = "gold";
}
migrateCfg();
// exact calorie target for a given date (schedule-aware); presets always rebalance to the same weekly total
// days are Sun..Sat (JS getDay order)
function presetDays(mode){
  const b = cfg.calTarget;
  if (mode==="frisat")    return [b-100, b-100, b-100, b-100, b-100, b+250, b+250]; // 5×(−100) = 2×(+250)
  if (mode==="satsun")    return [b+250, b-100, b-100, b-100, b-100, b-100, b+250];
  if (mode==="frisatsun") return [b+200, b-150, b-150, b-150, b-150, b+200, b+200]; // 4×(−150) = 3×(+200)
  return null;
}
function schedDays(){
  const m = cfg.calSchedMode || "same";
  if (m==="custom") return (Array.isArray(cfg.calSchedDays) && cfg.calSchedDays.length===7) ? cfg.calSchedDays : null;
  return presetDays(m); // presets derive live from calTarget — never stale
}
function calTargetFor(ds){
  const base = Number(cfg.calTarget)||0;
  if (base<=0) return 0;
  const days = schedDays();
  if (!days) return base;
  const dow = new Date(ds+"T12:00:00").getDay();
  const v = Number(days[dow]);
  return Number.isFinite(v) && v>0 ? v : base;
}
function weeklyCalTotal(){
  const base = Number(cfg.calTarget)||0;
  if (base<=0) return 0;
  const days = schedDays();
  return days ? days.reduce((a,x)=>a+(Number(x)||0),0) : base*7;
}
function nutritionTargetsReady(){
  return [cfg.calTarget,cfg.proTarget,cfg.carbGoal,cfg.fatGoal].every(v=>Number.isFinite(Number(v)) && Number(v)>0);
}
// the user schedules calories only; each day's macros scale from the base ratios
function dayTargets(ds){
  if (!nutritionTargetsReady()) return {cal:0, pro:0, carb:0, fat:0};
  const cal = calTargetFor(ds);
  const k = cal/cfg.calTarget;
  return { cal:cal, pro:Math.round(cfg.proTarget*k), carb:Math.round(cfg.carbGoal*k), fat:Math.round(cfg.fatGoal*k) };
}
let program = loadJSON(PROG_KEY, DEFAULT_PROGRAM);
try { validateProgram(program); } catch(e){ program = DEFAULT_PROGRAM; }
let selected = null;
let extraExercises = [];

function save(){
  try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); flashSave("Saved ✓"); }
  catch(e){ flashSave("Save failed", true); }
}
function saveCfg(){ try{ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }catch(e){} }
function saveProgram(){ try{ localStorage.setItem(PROG_KEY, JSON.stringify(program)); }catch(e){} }

let lockScrollY = 0;
function lockScroll(){
  lockScrollY = window.scrollY || 0;
  document.body.classList.add("locked");
}
function unlockScroll(){
  document.body.classList.remove("locked");
  window.scrollTo(0, lockScrollY);
}
function ackBtn(id, label){
  const b = typeof id==="string" ? document.getElementById(id) : id;
  if (!b || b.dataset.acking) return;
  b.dataset.acking = "1";
  const origText = b.textContent;
  b.textContent = label || "✓ Saved";
  b.classList.add("acked");
  b.disabled = true;
  setTimeout(()=>{
    b.textContent = origText;
    b.classList.remove("acked");
    b.disabled = false;
    delete b.dataset.acking;
  }, 1400);
}
let saveTimer;
function flashSave(msg, bad){
  const el = document.getElementById("saveState");
  el.textContent = msg; el.style.color = bad ? "var(--warn)" : "var(--dim)";
  clearTimeout(saveTimer); saveTimer = setTimeout(()=>{ el.textContent=""; }, 1500);
}

// ================== tabs ==================
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-"+btn.dataset.view).classList.add("active");
    renderAll();
  });
});

