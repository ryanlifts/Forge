"use strict";
// ================== storage keys & defaults ==================
const DATA_KEY = "forge:data", CFG_KEY = "forge:cfg", PROG_KEY = "forge:program";
const SCHEMA_VERSION = 1;
const AI_CFG_FIELDS = ["anthropicKey","openaiKey","aiProvider","aiModelAnth","aiModelOai"];

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
function hasOwn(obj, key){ return Object.prototype.hasOwnProperty.call(obj, key); }
function isPlainObject(v){
  if (!v || Object.prototype.toString.call(v)!=="[object Object]") return false;
  const p = Object.getPrototypeOf(v);
  return p===Object.prototype || p===null;
}
function cloneJSON(v){ return JSON.parse(JSON.stringify(v)); }
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
  if(!p || typeof p!=="object" || Array.isArray(p)) throw new Error("Not a program file");
  if(!p.days || !Array.isArray(p.days) || !p.days.length) throw new Error("Missing days array");
  p.days.forEach((d,i)=>{
    if(!d || typeof d!=="object" || Array.isArray(d)) throw new Error("Invalid day "+(i+1));
    if(!d.title) d.title = "Day "+(i+1);
    if(!d.id) d.id = "D"+(i+1);
    if(!Array.isArray(d.exercises)) throw new Error("Day "+(i+1)+" missing exercises");
    d.exercises.forEach(ex=>{ if(!ex || typeof ex!=="object" || Array.isArray(ex) || !ex.name) throw new Error("Exercise missing name in day "+(i+1)); });
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

// ================== migrations & prepared state ==================
function makeDefaultData(){ return { food:{}, workouts:[], weights:[], recents:[] }; }
function normalizeDataState(obj){
  const out = obj || makeDefaultData();
  if(!out.food) out.food = {};
  if(!out.workouts) out.workouts = [];
  if(!out.weights) out.weights = [];
  if(!out.recents) out.recents = [];
  if(!out.myFoods) out.myFoods = {};
  if(!out.meals) out.meals = [];
  if(!out.finished) out.finished = {};
  if(!out.foodCounts) out.foodCounts = {};
  if(!out.mealCounts) out.mealCounts = {};
  if(!out.meta) out.meta = {lastBackup:null, logsSince:0};
  return out;
}
// migrate old range targets (calLo/calHi, proLo/proHi) to exact targets — must run on the RAW
// object before defaults merge in, or the default calTarget masks the user's real numbers
function migrateTargets(obj){
  if (!obj) return;
  if (!Number.isFinite(obj.calTarget) && Number.isFinite(obj.calLo) && Number.isFinite(obj.calHi)) obj.calTarget = Math.round((obj.calLo+obj.calHi)/2);
  if (!Number.isFinite(obj.proTarget) && Number.isFinite(obj.proLo) && Number.isFinite(obj.proHi)) obj.proTarget = Math.round((obj.proLo+obj.proHi)/2);
}
function migrateCfgObject(obj){
  ["startWt","goalWt","calTarget","proTarget","carbGoal","fatGoal"].forEach(k=>{
    const v = Number(obj[k]);
    obj[k] = Number.isFinite(v) && v>0 ? v : 0;
  });
  if (obj.calSchedMode==="weekend") obj.calSchedMode = "frisat";
  if (!obj.calSchedMode) obj.calSchedMode = "same";
  if (!ACCENT_KEYS.includes(obj.accent)) obj.accent = "gold";
  return obj;
}
function migrateCfg(){ migrateCfgObject(cfg); }
function parseStatePart(raw, label){
  if (raw===null || raw===undefined) return {ok:true, missing:true, value:undefined};
  try { return {ok:true, missing:false, value:JSON.parse(raw)}; }
  catch(e){ return {ok:false, reason:label+" could not be parsed."}; }
}
function validateDataShape(obj){
  if (!isPlainObject(obj)) throw new Error("Saved logs are not an object.");
  const objectFields = ["food","water","finished","myFoods","foodCounts","mealCounts","meta"];
  objectFields.forEach(k=>{ if (hasOwn(obj,k) && obj[k] && !isPlainObject(obj[k])) throw new Error("Saved logs field "+k+" has an unusable shape."); });
  const arrayFields = ["workouts","weights","measure","recents","meals"];
  arrayFields.forEach(k=>{ if (hasOwn(obj,k) && obj[k] && !Array.isArray(obj[k])) throw new Error("Saved logs field "+k+" has an unusable shape."); });
  if (isPlainObject(obj.food)) Object.keys(obj.food).forEach(day=>{ if (!Array.isArray(obj.food[day])) throw new Error("A saved food day is not a list."); });
}
function validateCfgShape(obj){
  if (!isPlainObject(obj)) throw new Error("Saved settings are not an object.");
  if (obj.schemaVersion!==SCHEMA_VERSION) throw new Error("Settings were not migrated to the current schema.");
  ["calSchedDays"].forEach(k=>{ if (hasOwn(obj,k) && obj[k]!==null && !Array.isArray(obj[k])) throw new Error("Saved settings field "+k+" has an unusable shape."); });
  ["calcInputs","splitState","liftGoals"].forEach(k=>{ if (hasOwn(obj,k) && obj[k]!==null && !isPlainObject(obj[k])) throw new Error("Saved settings field "+k+" has an unusable shape."); });
  if (hasOwn(obj,"customRests") && obj.customRests!==null && !Array.isArray(obj.customRests) && !isPlainObject(obj.customRests)) throw new Error("Saved settings field customRests has an unusable shape.");
}
function safeProtectedState(parsed){
  let safeCfg = Object.assign({}, DEFAULT_CFG);
  if (parsed.cfg && isPlainObject(parsed.cfg.value)){
    safeCfg = Object.assign({}, DEFAULT_CFG, cloneJSON(parsed.cfg.value));
    migrateCfgObject(safeCfg);
  }
  if (!hasOwn(safeCfg,"schemaVersion")) safeCfg.schemaVersion = SCHEMA_VERSION;

  let safeData = makeDefaultData();
  if (parsed.data && isPlainObject(parsed.data.value)){
    try { validateDataShape(parsed.data.value); safeData = cloneJSON(parsed.data.value); } catch(e){}
  }
  normalizeDataState(safeData);

  let safeProgram = cloneJSON(DEFAULT_PROGRAM);
  if (parsed.program && isPlainObject(parsed.program.value)){
    try { safeProgram = validateProgram(cloneJSON(parsed.program.value)); } catch(e){}
  }
  return {cfg:safeCfg, data:safeData, program:safeProgram};
}
function failedPreparation(reason, kind, parsed, originals){
  return {ok:false, reason:reason, kind:kind||"failure", state:safeProtectedState(parsed||{}), originalStrings:originals};
}
function prepareState(rawCfg, rawData, rawProgram, options){
  const opts = options || {};
  const originals = opts.originalStrings || {cfg:rawCfg, data:rawData, program:rawProgram};
  const parsed = {};
  parsed.cfg = parseStatePart(rawCfg, "Saved settings");
  parsed.data = parseStatePart(rawData, "Saved logs");
  parsed.program = parseStatePart(rawProgram, "Saved program");
  const parseFailure = [parsed.cfg,parsed.data,parsed.program].find(part=>!part.ok);
  if (parseFailure) return failedPreparation(parseFailure.reason, "failure", parsed, originals);

  if (!parsed.cfg.missing && !isPlainObject(parsed.cfg.value)) return failedPreparation("Saved settings are not an object.", "failure", parsed, originals);
  if (!parsed.data.missing && !isPlainObject(parsed.data.value)) return failedPreparation("Saved logs are not an object.", "failure", parsed, originals);
  if (!parsed.program.missing && !isPlainObject(parsed.program.value)) return failedPreparation("Saved program is not an object.", "failure", parsed, originals);

  const rawCfgObj = parsed.cfg.missing ? {} : cloneJSON(parsed.cfg.value);
  const hasVersion = hasOwn(rawCfgObj, "schemaVersion");
  const version = hasVersion ? rawCfgObj.schemaVersion : 0;
  if (!Number.isInteger(version) || version<0){
    return failedPreparation("schemaVersion is invalid.", "failure", parsed, originals);
  }
  if (version>SCHEMA_VERSION){
    return failedPreparation("This data was written by a newer BlackPyre version.", "newer", parsed, originals);
  }

  const state = {
    cfg:rawCfgObj,
    data:parsed.data.missing ? makeDefaultData() : cloneJSON(parsed.data.value),
    program:parsed.program.missing ? cloneJSON(DEFAULT_PROGRAM) : cloneJSON(parsed.program.value)
  };
  const changed = {cfg:false, data:false, program:false};
  try {
    let current = version;
    while (current<SCHEMA_VERSION){
      if (current===0){
        if (opts.forceMigrationFailure) throw new Error("Migration step 0→1 failed.");
        migrateTargets(state.cfg); // raw object, before defaults — ordering is load-bearing
        state.cfg = Object.assign({}, DEFAULT_CFG, state.cfg);
        migrateCfgObject(state.cfg);
        state.cfg.schemaVersion = 1; // stamp only after the complete step succeeds
        changed.cfg = true;
        current = 1;
      } else {
        throw new Error("No migration path from schema "+current+".");
      }
    }
    if (version===SCHEMA_VERSION){
      state.cfg = Object.assign({}, DEFAULT_CFG, state.cfg);
      migrateCfgObject(state.cfg);
    }
    validateCfgShape(state.cfg);
    validateDataShape(state.data);
    state.program = validateProgram(state.program);
    if (opts.forceValidationFailure) throw new Error("Validation was forced to fail.");
    normalizeDataState(state.data);

    const finalStrings = {
      cfg:JSON.stringify(state.cfg),
      data:JSON.stringify(state.data),
      program:JSON.stringify(state.program)
    };
    if (opts.forceSerializationFailure) throw new Error("Serialization was forced to fail.");
    return {ok:true, state:state, finalStrings:finalStrings, originalStrings:originals, changed:changed, sourceVersion:version};
  } catch(e){
    return failedPreparation(e && e.message ? e.message : "Saved data could not be prepared safely.", "failure", parsed, originals);
  }
}
function commitState(prepared, options){
  if (!prepared || !prepared.ok) return {ok:false, reason:"State was not prepared."};
  const opts = options || {};
  const force = opts.forceWrite || {};
  const writeMask = opts.writeMask || null;
  const keyInfo = [
    {part:"data", key:DATA_KEY},
    {part:"program", key:PROG_KEY},
    {part:"cfg", key:CFG_KEY} // schema stamp last: interrupted migrations remain unstamped
  ];
  const written = [];
  try {
    keyInfo.forEach(info=>{
      const shouldWrite = writeMask ? !!writeMask[info.part] : (!!force[info.part] || !!prepared.changed[info.part]);
      if (!shouldWrite) return;
      const before = prepared.originalStrings[info.part];
      const after = prepared.finalStrings[info.part];
      if (before===after) return;
      localStorage.setItem(info.key, after);
      written.push(info);
    });
    return {ok:true, written:written.map(x=>x.part)};
  } catch(e){
    let rollbackFailed = false;
    for (let i=written.length-1;i>=0;i--){
      const info = written[i];
      try {
        const before = prepared.originalStrings[info.part];
        if (before===null || before===undefined) localStorage.removeItem(info.key);
        else localStorage.setItem(info.key, before);
      } catch(rollbackErr){ rollbackFailed = true; }
    }
    return {ok:false, reason:"Storage commit failed.", rollbackFailed:rollbackFailed, error:e};
  }
}
function readStorageStrings(){
  try {
    const originals = {
      cfg:localStorage.getItem(CFG_KEY),
      data:localStorage.getItem(DATA_KEY),
      program:localStorage.getItem(PROG_KEY)
    };
    let dataForRead = originals.data;
    if (dataForRead===null){
      const legacy = localStorage.getItem("ryan-cut:data");
      if (legacy!==null) dataForRead = legacy; // preserve the pre-forge fallback without renaming keys
    }
    return {ok:true, originals:originals, inputs:{cfg:originals.cfg, data:dataForRead, program:originals.program}};
  } catch(e){ return {ok:false, reason:"Browser storage could not be read."}; }
}

// ================== state ==================
let protectedMode = false;
let protectedModeKind = null;
let protectedModeReason = "";
let protectedSnapshotStrings = null;
let protectedResyncPending = false;
let protectedResyncing = false;

const _bootRead = readStorageStrings();
let _bootPrepared;
if (_bootRead.ok){
  const testOptions = (typeof window!=="undefined" && window.__BP_TEST_PREPARE_OPTIONS) || {};
  _bootPrepared = prepareState(_bootRead.inputs.cfg, _bootRead.inputs.data, _bootRead.inputs.program,
    Object.assign({}, testOptions, {originalStrings:_bootRead.originals}));
} else {
  _bootPrepared = failedPreparation(_bootRead.reason, "failure", {}, {cfg:null,data:null,program:null});
}
let _bootState = _bootPrepared.state;
if (_bootPrepared.ok){
  const committed = commitState(_bootPrepared);
  if (!committed.ok){
    protectedMode = true;
    protectedModeKind = "failure";
    protectedModeReason = committed.rollbackFailed
      ? "BlackPyre could not finish updating browser storage, and the browser also refused a full rollback. Do not uninstall the app."
      : "BlackPyre could not finish updating browser storage. Your previous saved values were restored where the browser allowed it.";
  }
} else {
  protectedMode = true;
  protectedModeKind = _bootPrepared.kind;
  protectedModeReason = _bootPrepared.reason;
}
let data = _bootState.data;
let cfg = _bootState.cfg;
let program = _bootState.program;
if (protectedMode){
  protectedSnapshotStrings = {
    data:JSON.stringify(data), cfg:JSON.stringify(cfg), program:JSON.stringify(program)
  };
}
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
let selected = null;
let extraExercises = [];

function applyPreparedState(prepared){
  data = prepared.state.data;
  cfg = prepared.state.cfg;
  program = prepared.state.program;
}
function restoreProtectedSnapshot(){
  if (!protectedMode || !protectedSnapshotStrings) return;
  data = JSON.parse(protectedSnapshotStrings.data);
  cfg = JSON.parse(protectedSnapshotStrings.cfg);
  program = JSON.parse(protectedSnapshotStrings.program);
}
function rerenderProtectedState(){
  if (!protectedMode || protectedResyncing) return;
  protectedResyncing = true;
  try {
    restoreProtectedSnapshot();
    if (typeof renderDayOptions==="function") renderDayOptions();
    if (typeof renderSessionInputs==="function") renderSessionInputs();
    if (typeof renderAll==="function") renderAll();
  } finally { protectedResyncing = false; }
}
function blockProtectedWrite(){
  if (!protectedMode) return false;
  restoreProtectedSnapshot();
  if (!protectedResyncPending){
    protectedResyncPending = true;
    setTimeout(()=>{
      protectedResyncPending = false;
      rerenderProtectedState();
      flashSave("Not saved — protected mode", true);
    }, 0);
  }
  flashSave("Not saved — protected mode", true);
  return true;
}
function save(){
  if (blockProtectedWrite()) return false;
  try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); flashSave("Saved ✓"); return true; }
  catch(e){ flashSave("Save failed", true); return false; }
}
function saveCfg(){
  if (blockProtectedWrite()) return false;
  try{ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); return true; }catch(e){ flashSave("Save failed", true); return false; }
}
function saveProgram(){
  if (blockProtectedWrite()) return false;
  try{ localStorage.setItem(PROG_KEY, JSON.stringify(program)); return true; }catch(e){ flashSave("Save failed", true); return false; }
}

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
  if (protectedMode && protectedResyncPending){ flashSave("Not saved — protected mode", true); return; }
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
  if (protectedMode && protectedResyncPending && msg!=="Not saved — protected mode"){
    msg = "Not saved — protected mode"; bad = true;
  }
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

