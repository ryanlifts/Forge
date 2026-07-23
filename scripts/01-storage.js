"use strict";
// ================== storage keys & defaults ==================
const DATA_KEY = "forge:data", CFG_KEY = "forge:cfg", PROG_KEY = "forge:program";
const LKG_KEY = "forge:lkg", LKG_PREVIOUS_KEY = "forge:lkg:previous", LKG_OLDER_KEY = "forge:lkg:older";
const QUARANTINE_KEY = "forge:quarantine", INSTALL_KEY = "forge:install";
const REST_TIMER_KEY = "forge:rest-timer";
const SCHEMA_VERSION = 2, RECOVERY_FORMAT_VERSION = 1;
const REST_TIMER_FORMAT_VERSION = 1;
const AI_CFG_FIELDS = ["anthropicKey","openaiKey","aiProvider","aiModelAnth","aiModelOai","foodHandoffOn"];

const DEFAULT_CFG = { startWt:0, goalWt:0, calTarget:0, proTarget:0, carbGoal:0, fatGoal:0, accent:"gold", autoProgressionOn:true, foodSuggestionsOn:false, foodSuggestionsWeightLoss:true, foodSuggestionsAvoid:"" };
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

// ================== device-only rest timer state ==================
// The rest timer is intentionally separate from the three primary user-state keys.
// It is short-lived UI state, not backup/recovery data, and must not force a primary
// save or LKG rotation every second. A fixed end timestamp lets iOS suspend the page
// without stopping elapsed time; the record also survives a full app/phone restart.
function inspectRestTimerRaw(raw){
  if (raw===null || raw===undefined) return {ok:false, code:"missing"};
  let record;
  try { record = JSON.parse(raw); }
  catch(e){ return {ok:false, code:"parse"}; }
  if (!isPlainObject(record)) return {ok:false, code:"shape"};
  const version = record.formatVersion;
  if (!Number.isInteger(version) || version<1) return {ok:false, code:"format"};
  if (version>REST_TIMER_FORMAT_VERSION) return {ok:false, newer:true, code:"newer", record:record};
  if (version!==REST_TIMER_FORMAT_VERSION || !["running","paused","ready"].includes(record.status)) return {ok:false, code:"shape"};
  if (Object.prototype.hasOwnProperty.call(record,"durationSec") && !(Number.isFinite(record.durationSec) && record.durationSec>0)) return {ok:false, code:"shape"};
  if (record.status==="running" && !(Number.isFinite(record.endAt) && record.endAt>0)) return {ok:false, code:"shape"};
  if (record.status==="paused" && !(Number.isFinite(record.remainingSec) && record.remainingSec>0)) return {ok:false, code:"shape"};
  if (record.status==="ready" && !(Number.isFinite(record.durationSec) && record.durationSec>0)) return {ok:false, code:"shape"};
  return {ok:true, record:record};
}
function readRestTimerState(){
  try { return inspectRestTimerRaw(localStorage.getItem(REST_TIMER_KEY)); }
  catch(e){ return {ok:false, code:"storage-read"}; }
}
function writeRestTimerState(state){
  const current = readRestTimerState();
  if (current.newer) return false;
  const record = Object.assign({formatVersion:REST_TIMER_FORMAT_VERSION}, state||{});
  const checked = inspectRestTimerRaw(JSON.stringify(record));
  if (!checked.ok) return false;
  const raw = JSON.stringify(record);
  try {
    localStorage.setItem(REST_TIMER_KEY, raw);
    return localStorage.getItem(REST_TIMER_KEY)===raw;
  } catch(e){ return false; }
}
function clearRestTimerState(){
  const current = readRestTimerState();
  if (current.newer) return false;
  try {
    localStorage.removeItem(REST_TIMER_KEY);
    return localStorage.getItem(REST_TIMER_KEY)===null;
  } catch(e){ return false; }
}

// ================== migrations & prepared state ==================
function makeDefaultData(){ return { food:{}, workouts:[], weights:[], recents:[], activeWorkoutDraft:null }; }
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
  if(!hasOwn(out,"activeWorkoutDraft")) out.activeWorkoutDraft = null;
  return out;
}
function dataContentScore(obj){
  if (!isPlainObject(obj)) return 0;
  let score = 0;
  ["workouts","weights","measure","recents","meals"].forEach(k=>{ if (Array.isArray(obj[k])) score += obj[k].length; });
  if (isPlainObject(obj.food)) Object.keys(obj.food).forEach(day=>{ if (Array.isArray(obj.food[day])) score += obj.food[day].length; });
  if (isPlainObject(obj.water)) score += Object.keys(obj.water).filter(k=>Number(obj.water[k])>0).length;
  ["myFoods","finished","foodCounts","mealCounts"].forEach(k=>{ if (isPlainObject(obj[k])) score += Object.keys(obj[k]).length; });
  if (obj.activeWorkoutDraft) score += 1;
  return score;
}
function cfgShowsEstablishedUse(obj){
  if (!isPlainObject(obj)) return false;
  return !!(obj.setupDone || obj.disclaimerAccepted || Number(obj.startWt)>0 || Number(obj.goalWt)>0 || Number(obj.calTarget)>0);
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
  // Preserve the historic behavior for existing installs while allowing an explicit opt-out.
  obj.autoProgressionOn = obj.autoProgressionOn !== false;
  return obj;
}
// Retained (not dead): the permanent suite's range-era restore simulation exercises this
// wrapper directly. The live app path uses migrateCfgObject via the prepare/commit pipeline.
function migrateCfg(){ migrateCfgObject(cfg); }
function makeDiagnostic(stage, part, code, reason){
  return {stage:stage||"unknown", part:part||"state", code:code||"failure", reason:reason||"Saved data could not be prepared safely."};
}
function parseStatePart(raw, label, part){
  if (raw===null || raw===undefined) return {ok:true, missing:true, value:undefined, part:part};
  try { return {ok:true, missing:false, value:JSON.parse(raw), part:part}; }
  catch(e){ return {ok:false, reason:label+" could not be parsed.", diagnostic:makeDiagnostic("parse",part,"json-parse",label+" could not be parsed.")}; }
}
function validateDataShape(obj){
  if (!isPlainObject(obj)) throw new Error("Saved logs are not an object.");
  const objectFields = ["food","water","finished","myFoods","foodCounts","mealCounts","meta","activeWorkoutDraft"];
  objectFields.forEach(k=>{ if (hasOwn(obj,k) && obj[k] && !isPlainObject(obj[k])) throw new Error("Saved logs field "+k+" has an unusable shape."); });
  const arrayFields = ["workouts","weights","measure","recents","meals"];
  arrayFields.forEach(k=>{ if (hasOwn(obj,k) && obj[k] && !Array.isArray(obj[k])) throw new Error("Saved logs field "+k+" has an unusable shape."); });
  if (isPlainObject(obj.food)) Object.keys(obj.food).forEach(day=>{ if (!Array.isArray(obj.food[day])) throw new Error("A saved food day is not a list."); });
  if (obj.activeWorkoutDraft!=null){
    const d = obj.activeWorkoutDraft;
    if (!isPlainObject(d) || typeof d.date!=="string" || typeof d.day!=="string" || !isPlainObject(d.sets)) throw new Error("Saved workout draft has an unusable shape.");
    Object.keys(d.sets).forEach(name=>{
      const val = d.sets[name];
      if (!Array.isArray(val) && typeof val!=="string") throw new Error("Saved workout draft exercise has an unusable shape.");
      if (Array.isArray(val) && val.some(row=>!isPlainObject(row) || !(Number(row.w)>0) || !(Number(row.r)>0))) throw new Error("Saved workout draft set has an unusable shape.");
    });
  }
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
function failedPreparation(reason, kind, parsed, originals, diagnostic){
  const diag = diagnostic || makeDiagnostic("prepare","state",kind==="newer"?"newer-version":"failure",reason);
  return {ok:false, reason:reason, kind:kind||"failure", diagnostic:diag, state:safeProtectedState(parsed||{}), originalStrings:originals};
}
function prepareState(rawCfg, rawData, rawProgram, options){
  const opts = options || {};
  const originals = opts.originalStrings || {cfg:rawCfg, data:rawData, program:rawProgram};
  const parsed = {};
  parsed.cfg = parseStatePart(rawCfg, "Saved settings", "cfg");
  parsed.data = parseStatePart(rawData, "Saved logs", "data");
  parsed.program = parseStatePart(rawProgram, "Saved program", "program");
  const parseFailure = [parsed.cfg,parsed.data,parsed.program].find(part=>!part.ok);
  if (parseFailure) return failedPreparation(parseFailure.reason, "failure", parsed, originals, parseFailure.diagnostic);

  if (!parsed.cfg.missing && !isPlainObject(parsed.cfg.value)) return failedPreparation("Saved settings are not an object.", "failure", parsed, originals, makeDiagnostic("validation","cfg","not-object","Saved settings are not an object."));
  if (!parsed.data.missing && !isPlainObject(parsed.data.value)) return failedPreparation("Saved logs are not an object.", "failure", parsed, originals, makeDiagnostic("validation","data","not-object","Saved logs are not an object."));
  if (!parsed.program.missing && !isPlainObject(parsed.program.value)) return failedPreparation("Saved program is not an object.", "failure", parsed, originals, makeDiagnostic("validation","program","not-object","Saved program is not an object."));

  const rawCfgObj = parsed.cfg.missing ? {} : cloneJSON(parsed.cfg.value);
  const hasVersion = hasOwn(rawCfgObj, "schemaVersion");
  const version = hasVersion ? rawCfgObj.schemaVersion : 0;
  if (!Number.isInteger(version) || version<0){
    return failedPreparation("schemaVersion is invalid.", "failure", parsed, originals, makeDiagnostic("schema","cfg","invalid-schema-version","schemaVersion is invalid."));
  }
  if (version>SCHEMA_VERSION){
    return failedPreparation("This data was written by a newer BlackPyre version.", "newer", parsed, originals, makeDiagnostic("schema","cfg","newer-schema-version","This data was written by a newer BlackPyre version."));
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
      } else if (current===1){
        if (opts.forceMigrationFailureAt===2) throw new Error("Migration step 1→2 failed.");
        if (!hasOwn(state.data,"activeWorkoutDraft")){
          state.data.activeWorkoutDraft = null;
          changed.data = true;
        }
        state.cfg.schemaVersion = 2; // whole-state draft contract; stamp after the step succeeds
        changed.cfg = true;
        current = 2;
      } else {
        throw new Error("No migration path from schema "+current+".");
      }
    }
    if (version===SCHEMA_VERSION){
      state.cfg = Object.assign({}, DEFAULT_CFG, state.cfg);
      migrateCfgObject(state.cfg);
    }
  } catch(e){
    const reason = e && e.message ? e.message : "Saved data migration failed.";
    return failedPreparation(reason, "failure", parsed, originals, makeDiagnostic("migration","state","migration-failed",reason));
  }

  try { validateCfgShape(state.cfg); }
  catch(e){ return failedPreparation(e.message, "failure", parsed, originals, makeDiagnostic("validation","cfg","invalid-cfg",e.message)); }
  try { validateDataShape(state.data); }
  catch(e){ return failedPreparation(e.message, "failure", parsed, originals, makeDiagnostic("validation","data","invalid-data",e.message)); }
  try { state.program = validateProgram(state.program); }
  catch(e){ return failedPreparation(e.message, "failure", parsed, originals, makeDiagnostic("validation","program","invalid-program",e.message)); }
  if (opts.forceValidationFailure){
    return failedPreparation("Validation was forced to fail.", "failure", parsed, originals, makeDiagnostic("validation","state","forced-validation-failure","Validation was forced to fail."));
  }
  normalizeDataState(state.data);

  try {
    const finalStrings = {
      cfg:JSON.stringify(state.cfg),
      data:JSON.stringify(state.data),
      program:JSON.stringify(state.program)
    };
    if (opts.forceSerializationFailure) throw new Error("Serialization was forced to fail.");
    return {ok:true, state:state, finalStrings:finalStrings, originalStrings:originals, changed:changed, sourceVersion:version};
  } catch(e){
    const reason = e && e.message ? e.message : "Saved data could not be serialized safely.";
    return failedPreparation(reason, "failure", parsed, originals, makeDiagnostic("serialization","state","serialization-failed",reason));
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
    const legacyData = localStorage.getItem("ryan-cut:data");
    let dataForRead = originals.data;
    let dataSource = "primary";
    if (dataForRead===null && legacyData!==null){
      dataForRead = legacyData; // preserve the pre-forge fallback without renaming keys
      dataSource = "legacy";
    }
    return {ok:true, originals:originals, inputs:{cfg:originals.cfg, data:dataForRead, program:originals.program}, legacyData:legacyData, dataSource:dataSource};
  } catch(e){ return {ok:false, reason:"Browser storage could not be read.", diagnostic:makeDiagnostic("storage-read","state","storage-read-failed","Browser storage could not be read.")}; }
}
// ================== recovery vault ==================
let activeRecoveryQuarantineRaw = null; // retained only while retrying one protected recovery incident
function currentSchemaCfg(){ return Object.assign({}, DEFAULT_CFG, {schemaVersion:SCHEMA_VERSION}); }
function recoveryRecordVersion(obj){ return isPlainObject(obj) ? obj.recoveryFormatVersion : undefined; }
function inspectLkgRaw(raw){
  if (raw===null || raw===undefined) return {ok:false, missing:true, code:"missing"};
  let record;
  try { record = JSON.parse(raw); }
  catch(e){ return {ok:false, code:"parse", reason:"The last-known-good record is unreadable."}; }
  if (!isPlainObject(record)) return {ok:false, code:"shape", reason:"The last-known-good record has an unusable shape."};
  const v = recoveryRecordVersion(record);
  if (!Number.isInteger(v) || v<1) return {ok:false, code:"format", reason:"The last-known-good recovery format is invalid."};
  if (v>RECOVERY_FORMAT_VERSION) return {ok:false, newer:true, code:"newer", record:record, reason:"The last-known-good record came from a newer BlackPyre."};
  if (v!==RECOVERY_FORMAT_VERSION || !isPlainObject(record.strings)) return {ok:false, code:"shape", reason:"The last-known-good record has an unusable shape."};
  if (!["cfg","data","program"].every(k=>typeof record.strings[k]==="string")) return {ok:false, code:"shape", reason:"The last-known-good record is incomplete."};
  if (record.legacyData!==null && record.legacyData!==undefined && typeof record.legacyData!=="string") return {ok:false, code:"shape", reason:"The last-known-good legacy reference is invalid."};
  const prepared = prepareState(record.strings.cfg, record.strings.data, record.strings.program,
    {originalStrings:{cfg:record.strings.cfg,data:record.strings.data,program:record.strings.program}});
  if (!prepared.ok){
    if (prepared.kind==="newer") return {ok:false, newer:true, code:"newer-state", reason:"The last-known-good snapshot contains newer primary data and was left untouched.", record:record};
    return {ok:false, code:"state", reason:"The last-known-good state no longer validates.", record:record};
  }
  return {ok:true, record:record, prepared:prepared};
}
function inspectQuarantineRaw(raw){
  if (raw===null || raw===undefined) return {ok:false, missing:true, code:"missing"};
  let record;
  try { record = JSON.parse(raw); }
  catch(e){ return {ok:false, code:"parse", reason:"The quarantine record is unreadable."}; }
  if (!isPlainObject(record)) return {ok:false, code:"shape", reason:"The quarantine record has an unusable shape."};
  const v = recoveryRecordVersion(record);
  if (!Number.isInteger(v) || v<1) return {ok:false, code:"format", reason:"The quarantine recovery format is invalid."};
  if (v>RECOVERY_FORMAT_VERSION) return {ok:false, newer:true, code:"newer", record:record, reason:"The quarantine came from a newer BlackPyre."};
  if (v!==RECOVERY_FORMAT_VERSION || !isPlainObject(record.originals)) return {ok:false, code:"shape", reason:"The quarantine record is incomplete."};
  if (!["cfg","data","program","legacyData"].every(k=>hasOwn(record.originals,k))) return {ok:false, code:"shape", reason:"The quarantine record is incomplete."};
  const vals = [record.originals.cfg,record.originals.data,record.originals.program,record.originals.legacyData];
  if (vals.some(vv=>vv!==null && vv!==undefined && typeof vv!=="string")) return {ok:false, code:"shape", reason:"The quarantine originals are invalid."};
  return {ok:true, record:record};
}
function getStoredLkgStatus(){
  try { return inspectLkgRaw(localStorage.getItem(LKG_KEY)); }
  catch(e){ return {ok:false, code:"storage-read", reason:"Browser storage would not allow BlackPyre to read its recovery snapshot."}; }
}
function getStoredQuarantineStatus(){
  try { return inspectQuarantineRaw(localStorage.getItem(QUARANTINE_KEY)); }
  catch(e){ return {ok:false, code:"storage-read", reason:"Browser storage would not allow BlackPyre to read quarantine."}; }
}
function getStoredLkgStatuses(){
  const defs = [
    {key:LKG_KEY, tier:"current"},
    {key:LKG_PREVIOUS_KEY, tier:"previous"},
    {key:LKG_OLDER_KEY, tier:"older"}
  ];
  try {
    return defs.map(d=>Object.assign({key:d.key,tier:d.tier}, inspectLkgRaw(localStorage.getItem(d.key))));
  } catch(e){
    return [{ok:false,code:"storage-read",reason:"Browser storage would not allow BlackPyre to read its recovery snapshots."}];
  }
}
function snapshotDataScore(status){
  return status && status.ok && status.prepared ? dataContentScore(status.prepared.state.data) : 0;
}
function getBestStoredLkgStatus(){
  const statuses = getStoredLkgStatuses();
  const valid = statuses.filter(x=>x.ok);
  if (!valid.length){
    const current = statuses.find(x=>x.key===LKG_KEY) || statuses[0];
    return current || {ok:false,missing:true,code:"missing"};
  }
  valid.sort((a,b)=>{
    const contentClass = (snapshotDataScore(b)>0?1:0)-(snapshotDataScore(a)>0?1:0);
    if (contentClass) return contentClass;
    const bt = Date.parse((b.record&&b.record.savedAt)||0)||0;
    const at = Date.parse((a.record&&a.record.savedAt)||0)||0;
    return bt-at;
  });
  return valid[0];
}
function validSnapshotCount(){ return getStoredLkgStatuses().filter(x=>x.ok).length; }
function installMarkerStatus(){
  try {
    const raw = localStorage.getItem(INSTALL_KEY);
    if (raw===null) return {ok:false,missing:true};
    const record = JSON.parse(raw);
    if (!isPlainObject(record) || !Number.isInteger(record.formatVersion) || record.formatVersion<1) return {ok:false,code:"shape"};
    if (record.formatVersion>1) return {ok:false,newer:true,code:"newer",record:record};
    if (typeof record.establishedAt!=="string" || typeof record.lastHealthyAt!=="string" || !Number.isInteger(record.schemaVersion)) return {ok:false,code:"shape"};
    return {ok:true,record:record};
  } catch(e){ return {ok:false,code:"read"}; }
}
function markEstablishedInstall(){
  if (protectedMode) return {ok:false,code:"protected"};
  let old = null;
  try { old = installMarkerStatus(); } catch(e){}
  if (old && old.newer) return {ok:false,code:"newer"};
  const now = new Date().toISOString();
  const record = {formatVersion:1, establishedAt:old&&old.ok&&old.record.establishedAt ? old.record.establishedAt : now,
    lastHealthyAt:now, schemaVersion:SCHEMA_VERSION};
  try {
    const raw = JSON.stringify(record);
    localStorage.setItem(INSTALL_KEY,raw);
    return localStorage.getItem(INSTALL_KEY)===raw ? {ok:true,record:record} : {ok:false,code:"verify"};
  } catch(e){ return {ok:false,code:"write"}; }
}
function parseCfgForEvidence(raw){
  if (raw===null || raw===undefined) return null;
  try { const obj=JSON.parse(raw); return isPlainObject(obj)?obj:null; } catch(e){ return null; }
}
function detectUnexpectedPrimaryLoss(read){
  if (!read || !read.ok) return null;
  const marker = installMarkerStatus();
  const snapshots = getStoredLkgStatuses();
  const hasSnapshot = snapshots.some(x=>x.ok);
  const quarantine = getStoredQuarantineStatus();
  const cfgObj = parseCfgForEvidence(read.originals.cfg);
  const established = marker.ok || marker.newer || hasSnapshot || quarantine.ok || cfgShowsEstablishedUse(cfgObj);
  if (read.originals.data===null && read.legacyData===null && established){
    return {part:"data", reason:"Saved logs are missing from an established BlackPyre installation. Saving is paused so recovery snapshots cannot be replaced by empty defaults."};
  }
  if (read.originals.cfg===null && (marker.ok || hasSnapshot || read.originals.data!==null)){
    return {part:"cfg", reason:"Saved settings are missing from an established BlackPyre installation. Saving is paused until the validated state is reviewed."};
  }
  return null;
}
function missingPrimaryPreparation(read, incident){
  const parsed = {
    cfg:parseStatePart(read.inputs.cfg,"Saved settings","cfg"),
    data:parseStatePart(read.inputs.data,"Saved logs","data"),
    program:parseStatePart(read.inputs.program,"Saved program","program")
  };
  let state = safeProtectedState(parsed);
  const best = getBestStoredLkgStatus();
  if (best.ok && best.prepared){
    if (read.originals.data===null && read.legacyData===null) state.data = cloneJSON(best.prepared.state.data);
    if (read.originals.cfg===null) state.cfg = cloneJSON(best.prepared.state.cfg);
    if (read.originals.program===null) state.program = cloneJSON(best.prepared.state.program);
  }
  const diagnostic = makeDiagnostic("missing-primary",incident.part,"unexpected-missing-key",incident.reason);
  return {ok:false,reason:incident.reason,kind:"failure",diagnostic:diagnostic,state:state,originalStrings:read.originals};
}
function sameLkgPayload(record, prepared, read){
  if (!record || !record.strings) return false;
  const legacy = read.dataSource==="legacy" ? read.legacyData : null;
  return record.strings.cfg===prepared.finalStrings.cfg
    && record.strings.data===prepared.finalStrings.data
    && record.strings.program===prepared.finalStrings.program
    && (record.legacyData===undefined ? null : record.legacyData)===legacy;
}
function noteLkgProblem(message){
  lkgStatus = {state:"unavailable", message:message || "Automatic recovery protection is unavailable."};
  if (!lkgWarningShown){
    lkgWarningShown = true;
    // Defer one tick so a caller's immediate “Saved” acknowledgement cannot hide the warning.
    setTimeout(()=>{ if (!protectedMode && typeof flashSave==="function") flashSave("Saved, but recovery snapshot could not refresh", true); },0);
  }
}
function refreshLastKnownGood(source){
  if (protectedMode) return {ok:false, code:"protected"};
  const read = readStorageStrings();
  if (!read.ok){ noteLkgProblem(read.reason); return {ok:false, code:"storage-read"}; }
  const missingIncident = detectUnexpectedPrimaryLoss(read);
  if (missingIncident){
    protectUnexpectedPrimaryLoss(missingIncident);
    return {ok:false,code:"missing-primary"};
  }
  const prepared = prepareState(read.inputs.cfg, read.inputs.data, read.inputs.program, {originalStrings:read.originals});
  if (!prepared.ok){ noteLkgProblem("Persisted state did not validate for a recovery snapshot."); return {ok:false, code:"invalid-state"}; }
  let existingRaw, previousRaw, olderRaw;
  try {
    existingRaw = localStorage.getItem(LKG_KEY);
    previousRaw = localStorage.getItem(LKG_PREVIOUS_KEY);
    olderRaw = localStorage.getItem(LKG_OLDER_KEY);
  } catch(e){ noteLkgProblem("Browser storage would not allow recovery snapshot access."); return {ok:false, code:"storage-read"}; }
  const existing = inspectLkgRaw(existingRaw);
  if (existing.newer){
    lkgStatus = {state:"newer", message:"A newer BlackPyre recovery snapshot is present and was left untouched."};
    return {ok:false, code:"newer"};
  }
  if (existing.ok && sameLkgPayload(existing.record, prepared, read)){
    lkgStatus = {state:"ready", savedAt:existing.record.savedAt, snapshots:validSnapshotCount(), message:"Automatic recovery protection is ready."};
    return {ok:true, unchanged:true, record:existing.record};
  }

  // Never let a valid snapshot containing user records be replaced by an empty/default state.
  // Intentional individual deletions keep the primary data key present; a missing key is handled
  // above, while this guard also catches a present-but-suddenly-empty regression.
  const candidateScore = dataContentScore(prepared.state.data);
  const populated = getStoredLkgStatuses().filter(x=>x.ok && snapshotDataScore(x)>0);
  if (candidateScore===0 && populated.length){
    const best = getBestStoredLkgStatus();
    lkgStatus = {state:"ready",savedAt:best.record.savedAt,snapshots:validSnapshotCount(),retained:true,
      message:"A populated recovery snapshot was retained instead of replacing it with an empty state."};
    return {ok:true,retained:true,record:best.record};
  }

  const record = {
    recoveryFormatVersion:RECOVERY_FORMAT_VERSION,
    savedAt:new Date().toISOString(),
    source:source||"healthy",
    strings:{cfg:prepared.finalStrings.cfg, data:prepared.finalStrings.data, program:prepared.finalStrings.program},
    legacyData:read.dataSource==="legacy" ? read.legacyData : null
  };
  const raw = JSON.stringify(record);
  const previous = inspectLkgRaw(previousRaw);
  try {
    // Rotate oldest first. A failed write is rolled back; the current snapshot is written last.
    if (existing.ok){
      if (!previous.newer && previous.ok && previousRaw!==existingRaw) localStorage.setItem(LKG_OLDER_KEY,previousRaw);
      if (!previous.newer && previousRaw!==existingRaw) localStorage.setItem(LKG_PREVIOUS_KEY,existingRaw);
    }
    localStorage.setItem(LKG_KEY, raw);
    if (localStorage.getItem(LKG_KEY)!==raw) throw new Error("Recovery snapshot read-back did not match.");
    lkgStatus = {state:"ready", savedAt:record.savedAt, snapshots:validSnapshotCount(), message:"Automatic recovery protection is ready."};
    return {ok:true, record:record};
  } catch(e){
    let rollbackFailed = false;
    try {
      [[LKG_KEY,existingRaw],[LKG_PREVIOUS_KEY,previousRaw],[LKG_OLDER_KEY,olderRaw]].forEach(pair=>{
        if (pair[1]===null) localStorage.removeItem(pair[0]); else localStorage.setItem(pair[0],pair[1]);
      });
    } catch(rollbackError){ rollbackFailed = true; }
    noteLkgProblem("The live save succeeded, but browser storage could not refresh automatic recovery protection.");
    return {ok:false, code:"write", rollbackFailed:rollbackFailed, error:e};
  }
}
function isQuotaError(e){
  return !!e && (e.name==="QuotaExceededError" || e.name==="NS_ERROR_DOM_QUOTA_REACHED" || e.code===22 || e.code===1014);
}
function sacrificeLkgForPrimarySave(){
  let raw;
  try { raw = localStorage.getItem(LKG_KEY); } catch(e){ return false; }
  if (raw===null) return false;
  const status = inspectLkgRaw(raw);
  if (status.newer) return false;
  try {
    localStorage.removeItem(LKG_KEY);
    lkgStatus = {state:"unavailable", message:"The recovery snapshot was removed to make room for live data and must be rebuilt."};
    return true;
  } catch(e){ return false; }
}
function writePrimaryString(key, value){
  try { localStorage.setItem(key, value); return {ok:true, retried:false}; }
  catch(e){
    if (isQuotaError(e) && sacrificeLkgForPrimarySave()){
      try { localStorage.setItem(key, value); return {ok:true, retried:true}; }
      catch(retryError){ return {ok:false, error:retryError}; }
    }
    return {ok:false, error:e};
  }
}
function probeCfgPart(raw){
  if (raw===null || raw===undefined) return {usable:false, reason:"Settings were missing."};
  const p = prepareState(raw, JSON.stringify(makeDefaultData()), JSON.stringify(DEFAULT_PROGRAM));
  return p.ok ? {usable:true, value:p.state.cfg, raw:p.finalStrings.cfg} : {usable:false, reason:p.reason};
}
function probeDataPart(raw){
  if (raw===null || raw===undefined) return {usable:false, reason:"Logs were missing."};
  const p = prepareState(JSON.stringify(currentSchemaCfg()), raw, JSON.stringify(DEFAULT_PROGRAM));
  return p.ok ? {usable:true, value:p.state.data, raw:p.finalStrings.data} : {usable:false, reason:p.reason};
}
function probeProgramPart(raw){
  if (raw===null || raw===undefined) return {usable:false, reason:"The program was missing."};
  const p = prepareState(JSON.stringify(currentSchemaCfg()), JSON.stringify(makeDefaultData()), raw);
  return p.ok ? {usable:true, value:p.state.program, raw:p.finalStrings.program} : {usable:false, reason:p.reason};
}
function getReadableLiveParts(read){
  const r = read || readStorageStrings();
  if (!r.ok) return {ok:false, reason:r.reason};
  return {
    ok:true,
    read:r,
    cfg:probeCfgPart(r.inputs.cfg),
    data:probeDataPart(r.inputs.data),
    program:probeProgramPart(r.inputs.program)
  };
}
function recoverySummary(parts, labels){
  const names = labels || {cfg:"settings",data:"logs",program:"training program"};
  return ["cfg","data","program"].map(k=>(parts[k].usable ? "Keep " : "Reset ")+names[k]).join(" · ");
}
function buildReadableRecoveryCandidate(){
  const read = readStorageStrings();
  if (!read.ok) return {ok:false, code:"storage-read", reason:read.reason};
  const parts = getReadableLiveParts(read);
  const cfgObj = parts.cfg.usable ? cloneJSON(parts.cfg.value) : currentSchemaCfg();
  const dataObj = parts.data.usable ? cloneJSON(parts.data.value) : makeDefaultData();
  const programObj = parts.program.usable ? cloneJSON(parts.program.value) : cloneJSON(DEFAULT_PROGRAM);
  let raws;
  try { raws = {cfg:JSON.stringify(cfgObj),data:JSON.stringify(dataObj),program:JSON.stringify(programObj)}; }
  catch(e){ return {ok:false, code:"serialization", reason:"The readable recovery candidate could not be serialized."}; }
  const prepared = prepareState(raws.cfg, raws.data, raws.program, {originalStrings:read.originals});
  if (!prepared.ok) return {ok:false, code:"prepare", reason:prepared.reason};
  return {ok:true, source:"readable", raws:raws, prepared:prepared, parts:parts, summary:recoverySummary(parts)};
}
function buildLkgRecoveryCandidate(){
  const lkg = getBestStoredLkgStatus();
  if (!lkg.ok) return {ok:false, code:lkg.code, reason:lkg.reason || "No validated last-known-good snapshot is available."};
  const read = readStorageStrings();
  if (!read.ok) return {ok:false, code:"storage-read", reason:read.reason};
  const raws = {cfg:lkg.record.strings.cfg,data:lkg.record.strings.data,program:lkg.record.strings.program};
  const prepared = prepareState(raws.cfg,raws.data,raws.program,{originalStrings:read.originals});
  if (!prepared.ok) return {ok:false, code:"prepare", reason:prepared.reason};
  const count = validSnapshotCount();
  return {ok:true, source:"lkg", raws:raws, prepared:prepared, lkg:lkg.record, lkgKey:lkg.key,
    summary:"Restore settings, logs, and training program from "+(lkg.record.savedAt ? new Date(lkg.record.savedAt).toLocaleString() : "the validated snapshot")+
      (count>1 ? " (best of "+count+" validated snapshots)." : ".")};
}
function bestValidatedDeviceCfg(parts, lkg){
  if (parts && parts.cfg && parts.cfg.usable) return cloneJSON(parts.cfg.value);
  if (lkg && lkg.ok) return cloneJSON(lkg.prepared.state.cfg);
  return null;
}
function prepareRecoveryBackupEnvelope(b){
  if (!isPlainObject(b)) return {ok:false, code:"envelope", reason:"This is not a BlackPyre backup."};
  if (hasOwn(b,"recoveryFormatVersion")) return {ok:false, code:"recovery-record", reason:"Recovery records cannot be imported as backups."};
  const present = {cfg:hasOwn(b,"cfg"),data:hasOwn(b,"data"),program:hasOwn(b,"program")};
  if (!present.cfg && !present.data && !present.program){
    return {ok:false, code:"empty", reason:"The backup contains no state."};
  }
  const read = readStorageStrings();
  if (!read.ok) return {ok:false, code:"storage-read", reason:read.reason};
  const parts = getReadableLiveParts(read);
  const lkg = getBestStoredLkgStatus();
  const bestCfg = bestValidatedDeviceCfg(parts,lkg);
  let cfgObj, dataObj, programObj;
  try {
    if (present.cfg){
      cfgObj = cloneJSON(b.cfg);
      if (isPlainObject(cfgObj) && bestCfg){
        AI_CFG_FIELDS.forEach(k=>{ if (!hasOwn(cfgObj,k) && bestCfg[k]!==undefined) cfgObj[k]=bestCfg[k]; });
      }
    } else {
      cfgObj = parts.cfg.usable ? cloneJSON(parts.cfg.value) : currentSchemaCfg();
      if (!parts.cfg.usable && bestCfg){
        AI_CFG_FIELDS.forEach(k=>{ if (bestCfg[k]!==undefined) cfgObj[k]=bestCfg[k]; });
      }
    }
    dataObj = present.data ? cloneJSON(b.data) : (parts.data.usable ? cloneJSON(parts.data.value) : makeDefaultData());
    programObj = present.program ? cloneJSON(b.program) : (parts.program.usable ? cloneJSON(parts.program.value) : cloneJSON(DEFAULT_PROGRAM));
  } catch(e){ return {ok:false, code:"clone", reason:"The backup could not be copied safely."}; }
  let raws;
  try {
    raws = {cfg:JSON.stringify(cfgObj),data:JSON.stringify(dataObj),program:JSON.stringify(programObj)};
    if (raws.cfg===undefined || raws.data===undefined || raws.program===undefined) throw new Error("Missing value");
  } catch(e){ return {ok:false, code:"serialization", reason:"The backup could not be serialized safely."}; }
  const prepared = prepareState(raws.cfg,raws.data,raws.program,{originalStrings:read.originals});
  if (!prepared.ok) return {ok:false, code:prepared.kind, reason:prepared.reason};
  const choices = {
    cfg:{usable:present.cfg || parts.cfg.usable},
    data:{usable:present.data || parts.data.usable},
    program:{usable:present.program || parts.program.usable}
  };
  const sourceText = ["cfg","data","program"].map(k=>{
    const name={cfg:"settings",data:"logs",program:"training program"}[k];
    if (present[k]) return "Use backup "+name;
    if (parts[k].usable) return "Keep readable "+name;
    return "Reset "+name;
  }).join(" · ");
  return {ok:true, source:"backup", raws:raws, prepared:prepared, present:present, parts:parts, summary:sourceText, choices:choices};
}
function recoveryWritesAllowed(){
  if (!protectedMode) return false;
  if (protectedModeKind==="newer") return false;
  return !(protectedModeDiagnostic && protectedModeDiagnostic.stage==="storage-read");
}
function exactRecoveryOriginals(read){
  return {cfg:read.originals.cfg,data:read.originals.data,program:read.originals.program,
    legacyData:read.dataSource==="legacy" ? read.legacyData : null};
}
function sameRecoveryOriginals(a,b){
  return !!a && !!b && ["cfg","data","program","legacyData"].every(k=>(a[k]===undefined?null:a[k])===(b[k]===undefined?null:b[k]));
}
function ensureQuarantine(read, options){
  const opts = options || {};
  const originals = exactRecoveryOriginals(read);
  let existingRaw;
  try { existingRaw = localStorage.getItem(QUARANTINE_KEY); }
  catch(e){ return {ok:false, code:"quarantine-read", reason:"BlackPyre could not read the quarantine vault."}; }
  const existing = inspectQuarantineRaw(existingRaw);
  if (existing.newer) return {ok:false, code:"quarantine-newer", reason:"A newer BlackPyre quarantine is present and cannot be replaced by this version."};
  // A failed recovery may have changed primary bytes. During that same incident, retain and reuse
  // the first verified quarantine rather than inviting replacement of the true originals.
  if (activeRecoveryQuarantineRaw && existingRaw===activeRecoveryQuarantineRaw && existing.ok){
    return {ok:true, reused:true, record:existing.record};
  }
  if (existing.ok && sameRecoveryOriginals(existing.record.originals, originals)){
    activeRecoveryQuarantineRaw = existingRaw;
    return {ok:true, reused:true, record:existing.record};
  }
  if (existingRaw!==null && !opts.replaceExistingQuarantine) return {ok:false, code:"quarantine-conflict", reason:"A different recovery copy is already stored on this device."};
  const record = {recoveryFormatVersion:RECOVERY_FORMAT_VERSION, quarantinedAt:new Date().toISOString(),
    diagnostic:protectedModeDiagnostic || makeDiagnostic("recovery","state","protected",protectedModeReason), originals:originals};
  const raw = JSON.stringify(record);
  try {
    localStorage.setItem(QUARANTINE_KEY,raw);
    if (localStorage.getItem(QUARANTINE_KEY)!==raw) throw new Error("Quarantine read-back mismatch");
    activeRecoveryQuarantineRaw = raw;
    return {ok:true, record:record};
  } catch(e){
    let rollbackFailed = false;
    try {
      if (existingRaw===null) localStorage.removeItem(QUARANTINE_KEY);
      else localStorage.setItem(QUARANTINE_KEY,existingRaw);
    } catch(rollbackError){ rollbackFailed = true; }
    if (rawRecoveryExportConfirmed) return {ok:true, fallbackExport:true, rollbackFailed:rollbackFailed, record:record};
    return {ok:false, code:"quarantine-write", rollbackFailed:rollbackFailed, reason:"BlackPyre could not store and verify the quarantine copy. Export the raw recovery file before trying again.", error:e};
  }
}
function markRecoveryFailure(reason, diagnostic){
  protectedMode = true;
  protectedModeKind = "failure";
  protectedModeReason = reason || "Recovery could not be completed safely.";
  protectedModeDiagnostic = diagnostic || makeDiagnostic("recovery","state","recovery-failed",protectedModeReason);
  if (typeof showProtectedBanner==="function") showProtectedBanner();
  if (typeof renderRecoveryPanel==="function") renderRecoveryPanel();
}
function performRecoveryCandidate(candidate, options){
  const opts = options || {};
  const normalSnapshotRestore = !protectedMode && !!opts.allowNormalRestore;
  if (!normalSnapshotRestore && !recoveryWritesAllowed()) return {ok:false, code:"blocked", reason:"Recovery writes are not allowed for this protected state."};
  if (!candidate || !candidate.ok || !candidate.raws) return {ok:false, code:"candidate", reason:"The recovery candidate is not ready."};
  const read = readStorageStrings();
  if (!read.ok) return {ok:false, code:"storage-read", reason:read.reason};
  const prepared = prepareState(candidate.raws.cfg,candidate.raws.data,candidate.raws.program,{originalStrings:read.originals});
  if (!prepared.ok) return {ok:false, code:"prepare", reason:prepared.reason};
  const quarantined = ensureQuarantine(read,opts);
  if (!quarantined.ok) return quarantined;
  const committed = commitState(prepared,{writeMask:{cfg:true,data:true,program:true}});
  if (!committed.ok){
    markRecoveryFailure(committed.rollbackFailed
      ? "Recovery storage failed and the browser refused a complete rollback. The quarantine remains available."
      : "Recovery storage failed. The quarantine remains available and no success was recorded.",
      makeDiagnostic("recovery-commit","state","commit-failed","Recovery storage failed."));
    return {ok:false, code:"commit", rollbackFailed:committed.rollbackFailed};
  }
  const verifyRead = readStorageStrings();
  if (!verifyRead.ok){
    markRecoveryFailure("Recovery was written, but browser storage could not be read back for verification.", verifyRead.diagnostic);
    return {ok:false, code:"readback"};
  }
  const exact = verifyRead.originals.cfg===prepared.finalStrings.cfg
    && verifyRead.originals.data===prepared.finalStrings.data
    && verifyRead.originals.program===prepared.finalStrings.program;
  const verified = prepareState(verifyRead.inputs.cfg,verifyRead.inputs.data,verifyRead.inputs.program,{originalStrings:verifyRead.originals});
  if (!exact || !verified.ok){
    markRecoveryFailure("Recovery was written, but the saved result did not pass read-back validation. The quarantine remains available.",
      makeDiagnostic("recovery-readback","state","readback-invalid","The recovered state did not verify."));
    return {ok:false, code:"readback-invalid"};
  }
  applyPreparedState(verified);
  protectedMode = false;
  protectedModeKind = null;
  protectedModeReason = "";
  protectedModeDiagnostic = null;
  protectedSnapshotStrings = null;
  rawRecoveryExportConfirmed = false;
  activeRecoveryQuarantineRaw = null;
  const recoverySnapshot = refreshLastKnownGood("recovery");
  if (recoverySnapshot.ok) markEstablishedInstall();
  if (typeof showProtectedBanner==="function") showProtectedBanner();
  if (typeof renderRecoveryPanel==="function") renderRecoveryPanel();
  if (typeof renderDayOptions==="function") renderDayOptions();
  if (typeof renderSessionInputs==="function") renderSessionInputs();
  if (typeof renderAll==="function") renderAll();
  if (typeof resumeGatesAfterRecovery==="function") resumeGatesAfterRecovery();
  return {ok:true, quarantined:!quarantined.fallbackExport, fallbackExport:!!quarantined.fallbackExport};
}
function makeRawRecoveryEnvelope(){
  const read = readStorageStrings();
  if (!read.ok) return {ok:false, reason:read.reason};
  return {ok:true, envelope:{recoveryFormatVersion:RECOVERY_FORMAT_VERSION, type:"blackpyre-raw-recovery",
    exportedAt:new Date().toISOString(), diagnostic:protectedModeDiagnostic || null, originals:exactRecoveryOriginals(read)}};
}
function makeStorageDiagnosticEnvelope(){
  const keys = [CFG_KEY,DATA_KEY,PROG_KEY,"ryan-cut:data",LKG_KEY,LKG_PREVIOUS_KEY,LKG_OLDER_KEY,QUARANTINE_KEY,INSTALL_KEY,REST_TIMER_KEY];
  const strings = {};
  try { keys.forEach(k=>{ strings[k]=localStorage.getItem(k); }); }
  catch(e){ return {ok:false,reason:"Browser storage could not be read for diagnostics."}; }
  return {ok:true,envelope:{type:"blackpyre-storage-diagnostic",formatVersion:1,exportedAt:new Date().toISOString(),
    schemaVersion:SCHEMA_VERSION,recoveryFormatVersion:RECOVERY_FORMAT_VERSION,protectedMode:protectedMode,
    diagnostic:protectedModeDiagnostic||null,strings:strings}};
}
function deleteStoredQuarantine(){
  const status = getStoredQuarantineStatus();
  if (status.newer) return {ok:false, code:"newer", reason:"A newer-version quarantine cannot be deleted by this BlackPyre."};
  if (status.code==="storage-read") return {ok:false, code:"storage-read", reason:"BlackPyre cannot verify this quarantine safely enough to delete it."};
  try { localStorage.removeItem(QUARANTINE_KEY); activeRecoveryQuarantineRaw = null; return {ok:true}; }
  catch(e){ return {ok:false, code:"storage", reason:"Browser storage would not delete the quarantine."}; }
}
// ================== state ==================
let protectedMode = false;
let protectedModeKind = null;
let protectedModeReason = "";
let protectedModeDiagnostic = null;
let protectedSnapshotStrings = null;
let protectedResyncPending = false;
let protectedResyncing = false;
let rawRecoveryExportConfirmed = false;
let lkgWarningShown = false;
let lkgStatus = {state:"checking", message:"Checking automatic recovery protection…"};
let saveTimer;

function protectUnexpectedPrimaryLoss(incident){
  // Rebuild the protected view from persisted readable parts and the best validated snapshot.
  // A save attempt may already have changed memory, so never present that unsaved mutation as recovered data.
  try {
    const read = readStorageStrings();
    if (read.ok){
      const safe = missingPrimaryPreparation(read,incident);
      if (safe && safe.state){ data=safe.state.data; cfg=safe.state.cfg; program=safe.state.program; }
    }
  } catch(e){}
  protectedMode = true;
  protectedModeKind = "failure";
  protectedModeReason = incident.reason;
  protectedModeDiagnostic = makeDiagnostic("missing-primary",incident.part,"unexpected-missing-key",incident.reason);
  try {
    protectedSnapshotStrings = {data:JSON.stringify(data),cfg:JSON.stringify(cfg),program:JSON.stringify(program)};
  } catch(e){}
  if (typeof showProtectedBanner==="function") showProtectedBanner();
  if (typeof renderRecoveryPanel==="function") renderRecoveryPanel();
}

const _bootRead = readStorageStrings();
let _bootPrepared;
if (_bootRead.ok){
  const missingIncident = detectUnexpectedPrimaryLoss(_bootRead);
  if (missingIncident){
    _bootPrepared = missingPrimaryPreparation(_bootRead,missingIncident);
  } else {
    const testOptions = (typeof window!=="undefined" && window.__BP_TEST_PREPARE_OPTIONS) || {};
    _bootPrepared = prepareState(_bootRead.inputs.cfg, _bootRead.inputs.data, _bootRead.inputs.program,
      Object.assign({}, testOptions, {originalStrings:_bootRead.originals}));
  }
} else {
  _bootPrepared = failedPreparation(_bootRead.reason, "failure", {}, {cfg:null,data:null,program:null}, _bootRead.diagnostic);
}
let _bootState = _bootPrepared.state;
if (_bootPrepared.ok){
  // A legacy fallback remains evidence at its original key. Migrations may normalize
  // the in-memory copy and LKG, but boot never promotes it into forge:data implicitly.
  const bootMarker = installMarkerStatus();
  const trulyFresh = _bootRead.ok && _bootRead.originals.cfg===null && _bootRead.originals.data===null
    && _bootRead.originals.program===null && _bootRead.legacyData===null
    && !bootMarker.ok && !bootMarker.newer && validSnapshotCount()===0 && getStoredQuarantineStatus().missing;
  const bootCommitOptions = _bootRead.ok && _bootRead.dataSource==="legacy" && _bootRead.originals.data===null
    ? {writeMask:{cfg:_bootPrepared.changed.cfg, data:false, program:_bootPrepared.changed.program}}
    : (trulyFresh ? {writeMask:{cfg:true,data:true,program:true}} : undefined);
  const committed = commitState(_bootPrepared, bootCommitOptions);
  if (!committed.ok){
    protectedMode = true;
    protectedModeKind = "failure";
    protectedModeReason = committed.rollbackFailed
      ? "BlackPyre could not finish updating browser storage, and the browser also refused a full rollback. Do not uninstall the app."
      : "BlackPyre could not finish updating browser storage. Your previous saved values were restored where the browser allowed it.";
    protectedModeDiagnostic = makeDiagnostic("commit","state","boot-commit-failed",protectedModeReason);
  }
} else {
  protectedMode = true;
  protectedModeKind = _bootPrepared.kind;
  protectedModeReason = _bootPrepared.reason;
  protectedModeDiagnostic = _bootPrepared.diagnostic;
}
let data = _bootState.data;
let cfg = _bootState.cfg;
let program = _bootState.program;
if (protectedMode){
  protectedSnapshotStrings = {
    data:JSON.stringify(data), cfg:JSON.stringify(cfg), program:JSON.stringify(program)
  };
} else {
  const bootSnapshot = refreshLastKnownGood("boot");
  if (bootSnapshot.ok) markEstablishedInstall();
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
      if (typeof flashSave==="function") flashSave("Not saved — protected mode", true);
    }, 0);
  }
  if (typeof flashSave==="function") flashSave("Not saved — protected mode", true);
  return true;
}
function blockUnexpectedPrimaryLossBeforeWrite(){
  const read = readStorageStrings();
  if (!read.ok) return false; // the primary write will still fail safely if storage itself is unavailable
  const incident = detectUnexpectedPrimaryLoss(read);
  if (!incident) return false;
  protectUnexpectedPrimaryLoss(incident);
  blockProtectedWrite();
  return true;
}
function save(){
  if (blockProtectedWrite() || blockUnexpectedPrimaryLossBeforeWrite()) return false;
  let raw;
  try { raw = JSON.stringify(data); }
  catch(e){ flashSave("Save failed", true); return false; }
  const written = writePrimaryString(DATA_KEY, raw);
  if (!written.ok){ flashSave("Save failed", true); return false; }
  const snapshot = refreshLastKnownGood("data-save");
  if (snapshot.ok){ markEstablishedInstall(); flashSave("Saved ✓"); }
  return true;
}
function saveCfg(){
  if (blockProtectedWrite() || blockUnexpectedPrimaryLossBeforeWrite()) return false;
  let raw;
  try { raw = JSON.stringify(cfg); }
  catch(e){ flashSave("Save failed", true); return false; }
  const written = writePrimaryString(CFG_KEY, raw);
  if (!written.ok){ flashSave("Save failed", true); return false; }
  const snapshot = refreshLastKnownGood("settings-save");
  if (snapshot.ok) markEstablishedInstall();
  return true;
}
function saveProgram(){
  if (blockProtectedWrite() || blockUnexpectedPrimaryLossBeforeWrite()) return false;
  let raw;
  try { raw = JSON.stringify(program); }
  catch(e){ flashSave("Save failed", true); return false; }
  const written = writePrimaryString(PROG_KEY, raw);
  if (!written.ok){ flashSave("Save failed", true); return false; }
  const snapshot = refreshLastKnownGood("program-save");
  if (snapshot.ok) markEstablishedInstall();
  return true;
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
function flashSave(msg, bad){
  if (protectedMode && protectedResyncPending && msg!=="Not saved — protected mode"){
    msg = "Not saved — protected mode"; bad = true;
  }
  const el = document.getElementById("saveState");
  el.textContent = msg; el.style.color = bad ? "var(--warn)" : "var(--dim)";
  clearTimeout(saveTimer); saveTimer = setTimeout(()=>{ el.textContent=""; }, 1500);
}

// One six-second Undo service for routine log/library deletions.
let pendingUndoAction = null, pendingUndoTimer = null;
function dismissUndo(){
  const toast = document.getElementById("undoToast");
  if (toast) toast.classList.add("hidden");
  if (pendingUndoTimer) clearTimeout(pendingUndoTimer);
  pendingUndoTimer = null;
  pendingUndoAction = null;
}
function offerUndo(message, action){
  const toast = document.getElementById("undoToast");
  const msg = document.getElementById("undoMsg");
  if (!toast || !msg || typeof action!=="function") return;
  if (pendingUndoTimer) clearTimeout(pendingUndoTimer);
  pendingUndoAction = action;
  msg.textContent = message;
  toast.classList.remove("hidden");
  pendingUndoTimer = setTimeout(dismissUndo, 6000);
}
document.getElementById("undoBtn").addEventListener("click", ()=>{
  if (!pendingUndoAction) return;
  const action = pendingUndoAction;
  pendingUndoAction = null;
  if (pendingUndoTimer) clearTimeout(pendingUndoTimer);
  pendingUndoTimer = null;
  document.getElementById("undoToast").classList.add("hidden");
  action();
});
function isOffline(){ return navigator.onLine===false; }

// ================== ACCESSIBILITY ==================
const ACCESSIBLE_DYNAMIC_NAMES = {
  suWt:"Current body weight in pounds", suGoalWt:"Goal body weight in pounds",
  suSex:"Sex used for calorie calculation", suAge:"Age in years", suFt:"Height feet", suIn:"Height inches",
  suAct:"Activity level", suGoal:"Weight goal rate", suSpP:"Protein percentage",
  suSpC:"Carbohydrate percentage", suSpF:"Fat percentage", suSched:"Calorie schedule mode",
  suSched0:"Sunday calorie target", suSched1:"Monday calorie target", suSched2:"Tuesday calorie target",
  suSched3:"Wednesday calorie target", suSched4:"Thursday calorie target", suSched5:"Friday calorie target",
  suSched6:"Saturday calorie target", suUsda:"USDA API key"
};
function associatedLabelText(el){
  if (!el || !el.id) return "";
  const label = document.querySelector('label[for="'+el.id.replace(/"/g,"\\\"")+'"]');
  return label ? label.textContent.trim() : "";
}
function accessibleNamePresent(el){
  if (!el) return false;
  if ((el.getAttribute("aria-label")||"").trim()) return true;
  const by = (el.getAttribute("aria-labelledby")||"").trim();
  if (by && by.split(/\s+/).some(id=>{ const n=document.getElementById(id); return n && n.textContent.trim(); })) return true;
  if (associatedLabelText(el)) return true;
  if (el.tagName==="BUTTON") return !!el.textContent.trim();
  return false;
}
function humanizeControlId(id){
  return String(id||"")
    .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
    .replace(/[_-]+/g," ")
    .replace(/^s /,"Settings ")
    .trim()
    .replace(/^./,c=>c.toUpperCase());
}
function exerciseNameFor(el){
  const direct = el && el.dataset ? el.dataset.exercise : "";
  if (direct) return direct.replace("[Cardio] ","");
  const card = el && el.closest ? el.closest(".exercise") : null;
  const head = card ? card.querySelector(".x-head b") : null;
  return head ? head.textContent.trim() : "Exercise";
}
function setNumberFor(el){
  if (el && el.dataset && el.dataset.row!==undefined) return Number(el.dataset.row)+1;
  const row = el && el.closest ? el.closest(".srow") : null;
  const label = row ? row.querySelector(".slabel") : null;
  const m = label && label.textContent.match(/\d+/);
  return m ? Number(m[0]) : null;
}
function inferredControlName(el){
  if (!el) return "";
  if (el.id && ACCESSIBLE_DYNAMIC_NAMES[el.id]) return ACCESSIBLE_DYNAMIC_NAMES[el.id];
  if (el.dataset && el.dataset.exercise && el.dataset.field){
    const setNo = setNumberFor(el);
    return exerciseNameFor(el)+(setNo ? " set "+setNo : "")+" "+(el.dataset.field==="weight" ? "weight in pounds" : "repetitions");
  }
  if (el.classList && el.classList.contains("bname")){
    return el.closest(".bday") && el.closest(".row") ? "Program day name" : "Exercise name";
  }
  if (el.classList && el.classList.contains("bscheme")) return "Exercise sets and repetitions scheme";
  if (el.tagName==="SELECT" && el.closest && el.closest(".bex")) return "Exercise library";
  if (el.tagName==="BUTTON"){
    const title=(el.getAttribute("title")||"").trim();
    if (title) return title;
    const text=el.textContent.trim();
    const ex=exerciseNameFor(el), setNo=setNumberFor(el), where=setNo ? " for "+ex+" set "+setNo : "";
    if (text==="−5" || text==="-5") return "Decrease weight by 5 pounds"+where;
    if (text==="+5") return "Increase weight by 5 pounds"+where;
    if (text==="−1" || text==="-1") return "Decrease repetitions by 1"+where;
    if (text==="+1") return "Increase repetitions by 1"+where;
    if (text==="↑") return "Move exercise up";
    if (text==="↓") return "Move exercise down";
    if (text==="✕" || text==="×") return "Remove item";
    if (text==="⧉") return "Duplicate item";
    if (text==="✎") return "Edit item";
  }
  const ph=(el.getAttribute && el.getAttribute("placeholder")||"").trim();
  if (ph && !/^(g|lb|in|min|kcal|years|ft|reps)$/i.test(ph) && !/^e\.g\./i.test(ph)) return ph;
  if (el.id) return humanizeControlId(el.id);
  if (el.tagName==="SELECT") return "Choose an option";
  if (el.tagName==="TEXTAREA") return "Text entry";
  if (el.tagName==="INPUT") return "Input field";
  return "Control";
}
function enhanceAccessibleControls(root){
  const scope = root && root.querySelectorAll ? root : document;
  const controls=[];
  if (root && root.matches && root.matches("input,select,textarea,button")) controls.push(root);
  scope.querySelectorAll("input,select,textarea,button").forEach(el=>controls.push(el));
  controls.forEach(el=>{
    if (el.tagName==="BUTTON" && !el.getAttribute("type")) el.setAttribute("type","button");
    if (!accessibleNamePresent(el)) el.setAttribute("aria-label", inferredControlName(el));
  });
}
function initAccessibleDialogs(){
  const dialogs=[...document.querySelectorAll('[role="dialog"]')];
  const returnFocus=new WeakMap();
  function isOpen(d){ return d && !d.classList.contains("hidden"); }
  function focusDialog(d){
    if (!isOpen(d)) return;
    const active=document.activeElement;
    if (active && active!==document.body && !d.contains(active)) returnFocus.set(d,active);
    const preferred=d.dataset.initialFocus;
    let target=preferred==="self" ? d : (preferred ? document.getElementById(preferred) : null);
    if (!target || target.disabled || target.classList.contains("hidden")){
      target=d.querySelector('button:not(.hidden):not([disabled]), input:not(.hidden):not([type="hidden"]):not([disabled]), select:not(.hidden):not([disabled]), textarea:not(.hidden):not([disabled])') || d;
    }
    requestAnimationFrame(()=>{ try { target.focus(); } catch(e){} });
  }
  function restoreDialogFocus(d){
    const target=returnFocus.get(d); returnFocus.delete(d);
    requestAnimationFrame(()=>{
      if (dialogs.some(isOpen)) return;
      if (target && document.contains(target) && !target.closest(".hidden")){
        try { target.focus(); } catch(e){}
      }
    });
  }
  dialogs.forEach(d=>{
    let wasOpen=isOpen(d);
    const observer=new MutationObserver(()=>{
      const open=isOpen(d);
      if (open && !wasOpen) focusDialog(d);
      else if (!open && wasOpen) restoreDialogFocus(d);
      wasOpen=open;
    });
    observer.observe(d,{attributes:true,attributeFilter:["class"]});
    if (wasOpen) focusDialog(d);
  });
}
enhanceAccessibleControls(document);
const accessibleControlObserver=new MutationObserver(records=>{
  records.forEach(record=>record.addedNodes.forEach(node=>{
    if (node.nodeType===1) enhanceAccessibleControls(node);
  }));
});
accessibleControlObserver.observe(document.body,{childList:true,subtree:true});
initAccessibleDialogs();

// ================== NETWORK STATUS ==================
function renderNetworkStatus(){
  const banner = document.getElementById("offlineBanner");
  if (!banner) return;
  const offline = navigator.onLine===false;
  banner.classList.toggle("hidden", !offline);
  document.body.classList.toggle("is-offline", offline);
}
window.addEventListener("online", renderNetworkStatus);
window.addEventListener("offline", renderNetworkStatus);

// ================== tabs ==================
function positionView(targetId){
  requestAnimationFrame(()=>{
    const target = targetId ? document.getElementById(targetId) : null;
    if (target && typeof target.scrollIntoView==="function"){
      try { target.scrollIntoView({behavior:"smooth", block:"start"}); } catch(e){}
      return;
    }
    try { window.scrollTo(0,0); } catch(e){}
  });
}
function activateView(viewName, targetId, shouldRender){
  const tab = document.querySelector('.tab[data-view="'+viewName+'"]');
  const view = document.getElementById("view-"+viewName);
  if (!tab || !view) return false;
  document.querySelectorAll(".tab").forEach(b=>{
    const active=b===tab;
    b.classList.toggle("active",active);
    b.setAttribute("aria-selected",String(active));
    b.tabIndex=active ? 0 : -1;
  });
  document.querySelectorAll(".view").forEach(v=>{
    const active=v===view;
    v.classList.toggle("active",active);
    v.setAttribute("aria-hidden",String(!active));
  });
  const restDock = document.getElementById("restDock");
  if (restDock) restDock.classList.toggle("hidden", viewName!=="work");
  document.body.classList.toggle("rest-dock-visible", viewName==="work");
  if (viewName!=="work" && typeof setRestOptionsOpen==="function") setRestOptionsOpen(false);
  if (shouldRender!==false && typeof renderAll==="function") renderAll();
  positionView(targetId);
  return true;
}
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    // v51: leaving Train with unsaved exercise work warns before moving on
    const current = document.querySelector(".tab.active");
    if (current && current.dataset.view==="work" && btn.dataset.view!=="work"
        && typeof unsavedExerciseNames==="function" && unsavedExerciseNames().length){
      const pretty = unsavedExerciseNames().map(n=>n.replace("[Cardio] ","")).join(", ");
      if (!confirm("Unsaved exercise work: "+pretty+".\n\nLeave Train anyway? (Only exercises already saved are protected as a workout draft.)")) return;
    }
    activateView(btn.dataset.view, null, true);
  });
});
const primaryTabs=[...document.querySelectorAll('.tab[role="tab"]')];
primaryTabs.forEach((btn,index)=>{
  btn.addEventListener("keydown",e=>{
    let next=index;
    if (e.key==="ArrowRight" || e.key==="ArrowDown") next=(index+1)%primaryTabs.length;
    else if (e.key==="ArrowLeft" || e.key==="ArrowUp") next=(index-1+primaryTabs.length)%primaryTabs.length;
    else if (e.key==="Home") next=0;
    else if (e.key==="End") next=primaryTabs.length-1;
    else return;
    e.preventDefault();
    primaryTabs[next].focus();
    primaryTabs[next].click();
  });
});

