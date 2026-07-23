// BlackPyre permanent unit suite — pure calculations & parsers, run against the shipped app.
const { boot, check, summary, dstr, nextDow, EXISTING_CFG, EMPTY_DATA } = require("./harness");

(async ()=>{
const dom = boot(EXISTING_CFG, EMPTY_DATA);
const W = dom.window;
const E = (code)=>W.eval(code);

// ---------- Mifflin-St Jeor (calcMacros) ----------
// male, 42y, 5'11", 225 lb, activity 1.55, cut -500
// kg=102.06, cm=180.34 -> BMR = 10*102.06 + 6.25*180.34 - 5*42 + 5 = 1942.7 -> 1943
let r = E(`calcMacros("m", 42, 5, 11, 225, 1.55, -500)`);
check("Mifflin BMR male known-value", r.bmr===1943);
check("TDEE = BMR × activity", r.tdee===Math.round(1942.725*1.55));
check("cal = TDEE + goal adjustment", r.cal===Math.round(1942.725*1.55)-500);
check("protein = 0.9 g/lb", r.pro===Math.round(225*0.9));
check("fat = 25% of calories", r.fat===Math.round(r.cal*0.25/9));
check("carbs = remainder, never negative", r.carb===Math.round((r.cal-r.pro*4-r.fat*9)/4) && r.carb>=0);
r = E(`calcMacros("f", 30, 5, 4, 140, 1.2, 0)`);
// kg=63.504, cm=162.56 -> BMR = 635.04+1016 -150 -161 = 1340.04 -> 1340
check("Mifflin BMR female known-value", r.bmr===1340);
r = E(`calcMacros("m", 25, 6, 0, 90, 1.2, -1000)`);
check("extreme deficit: carbs floored at 0, not negative", r.carb>=0);

// ---------- Epley e1RM (parseBestSet) ----------
r = E(`parseBestSet([{w:275,r:5}])`);
check("Epley 275×5 = 320.8", Math.abs(r.e1rm - 275*(1+5/30)) < 0.001);
r = E(`parseBestSet([{w:275,r:5},{w:285,r:3},{w:225,r:12}])`);
check("best set wins across rows", Math.abs(r.e1rm - Math.max(275*(1+5/30),285*(1+3/30),225*(1+12/30))) < 0.001);
r = E(`parseBestSet("275x5, 285×3")`);
check("legacy string sets parse (both x and ×)", r && Math.abs(r.e1rm - Math.max(275*(1+5/30),285*1.1)) < 0.001);
check("reps > 30 rejected (formula breaks down)", E(`parseBestSet([{w:100,r:31}])`)===null);
check("zero/missing values rejected", E(`parseBestSet([{w:0,r:5},{r:5},{w:100}])`)===null);

// ---------- workout auto-progression ----------
check("legacy settings keep automatic progression enabled", E(`cfg.autoProgressionOn===true`));
r = E(`parseScheme("4×5")`);
check("fixed-rep scheme exposes one progression target", r.sets===4 && r.reps===5 && r.topReps===5);
r = E(`parseScheme("3x8-12")`);
check("rep-range scheme keeps start reps and top progression reps", r.sets===3 && r.reps===8 && r.topReps===12);
r = E(`prefillRows({scheme:"4×5"}, [{w:100,r:5},{w:100,r:5},{w:100,r:5}])`);
check("auto-progression requires the programmed set count", r.auto===false && r.rows[0].w===100);
r = E(`prefillRows({scheme:"4×5"}, [{w:100,r:5},{w:100,r:5},{w:100,r:5},{w:100,r:5}])`);
check("all fixed-rep sets at one weight trigger +5", r.auto===true && r.rows.every(x=>x.w===105 && x.r===5));
r = E(`prefillRows({scheme:"3×8-12"}, [{w:100,r:8},{w:100,r:8},{w:100,r:8}])`);
check("bottom of a rep range does not trigger progression", r.auto===false);
r = E(`prefillRows({scheme:"3×8-12"}, [{w:100,r:12},{w:100,r:12},{w:100,r:12}])`);
check("top of a rep range triggers +5 and resets to range start", r.auto===true && r.rows.every(x=>x.w===105 && x.r===8));
r = E(`prefillRows({scheme:"4×5"}, [{w:100,r:5},{w:100,r:5},{w:95,r:5},{w:100,r:5}])`);
check("mixed weights never auto-progress", r.auto===false);
r = E(`prefillRows({scheme:"4×5"}, [{w:0,r:5},{w:0,r:5},{w:0,r:5},{w:0,r:5}])`);
check("zero weight never auto-progresses", r.auto===false);
E(`cfg.autoProgressionOn=false`);
r = E(`prefillRows({name:"Bench Press",scheme:"4×5"}, [{w:100,r:5},{w:100,r:5},{w:100,r:5},{w:100,r:5}])`);
check("automatic progression toggle off preserves the last logged weight", r.auto===false && r.rows.every(x=>x.w===100 && x.r===5));
E(`cfg.autoProgressionOn=true`);
r = E(`prefillRows({name:"Assisted Wide Grip Pull Ups",scheme:"3×8"}, [{w:100,r:8},{w:100,r:8},{w:100,r:8}])`);
check("assisted exercises progress by reducing assistance", r.auto===true && r.autoDelta===-5 && r.rows.every(x=>x.w===95 && x.r===8));
r = E(`prefillRows({name:"Assisted Pull-Up",scheme:"3×5"}, [{w:5,r:5},{w:5,r:5},{w:5,r:5}])`);
check("assisted progression never suggests zero assistance as a saved load", r.auto===false && r.rows.every(x=>x.w===5));
check("barcode scan box is square for either barcode orientation", E(`JSON.stringify(barcodeScanBox(400,300))`)==='{"width":270,"height":270}');

// ---------- workout completion integrity (v51 exercise-level engine) ----------
r = E(`validateExerciseEntry({mode:"rows",rows:[{w:105,r:5,touched:false},{w:105,r:5,touched:false}],text:"",textTouched:false})`);
check("untouched prefilled rows are never treated as an entry", r.ok && r.value===null);
r = E(`validateExerciseEntry({mode:"rows",rows:[{w:105,r:5,touched:true},{w:105,r:5,touched:false}],text:"",textTouched:false})`);
check("only entered rows are validated and saved (partial exercises allowed)", r.ok && r.value.length===1 && r.value[0].w===105);
r = E(`validateExerciseEntry({mode:"rows",rows:[{w:"",r:5,touched:true}],text:"",textTouched:false})`);
check("entered rows missing weight are rejected with a precise row error", !r.ok && r.rowIndex===0 && /weight and reps/.test(r.message));
r = E(`validateExerciseEntry({mode:"text",rows:[],text:"20 min",textTouched:false})`);
check("untouched text-mode plans are not an entry", r.ok && r.value===null);
r = E(`validateExerciseEntry({mode:"text",rows:[],text:"20 min",textTouched:true})`);
check("explicit text-mode entries remain saveable", r.ok && r.value==="20 min");
r = E(`collectSavedSessionSets({"A":{status:"saved",saved:[{w:105,r:5}]},"B":{status:"unsaved",saved:[{w:99,r:9}],mode:"rows",rows:[],text:"",textTouched:false},"C":{status:"plan",saved:null}})`);
check("only SAVED exercises reach the session log — unsaved and plans never do", r.ok && Object.keys(r.sets).length===1 && r.sets.A[0].w===105);

// ---------- calorie schedule presets ----------
for (const mode of ["frisat","satsun","frisatsun"]){
  for (const target of [1500, 1800, 2000, 2350]){
    E(`cfg.calTarget = ${target}`);
    check(`${mode}@${target}: weekly sum preserved`, E(`presetDays("${mode}").reduce((a,x)=>a+x,0)`)===target*7);
  }
}
E(`cfg.calTarget = 1800`);
check("frisat elevates Fri+Sat only", E(`JSON.stringify(presetDays("frisat"))`)==="[1700,1700,1700,1700,1700,2050,2050]");
check("satsun elevates Sun+Sat only", E(`JSON.stringify(presetDays("satsun"))`)==="[2050,1700,1700,1700,1700,1700,2050]");
check("frisatsun elevates Fri–Sun", E(`JSON.stringify(presetDays("frisatsun"))`)==="[2000,1650,1650,1650,1650,2000,2000]");
check("unknown mode returns null (same-daily fallback)", E(`presetDays("nope")`)===null);

// ---------- calTargetFor / weeklyCalTotal / dayTargets ----------
E(`cfg.calSchedMode = "frisat"; cfg.calSchedDays = null;`);
check("scheduled Friday target", E(`calTargetFor("${nextDow(5)}")`)===2050);
check("scheduled Monday target", E(`calTargetFor("${nextDow(1)}")`)===1700);
check("weekly total under preset = budget", E(`weeklyCalTotal()`)===12600);
E(`cfg.calTarget = 2000;`); // presets derive live — no stale arrays
check("preset re-derives after target change", E(`calTargetFor("${nextDow(5)}")`)===2250 && E(`weeklyCalTotal()`)===14000);
E(`cfg.calTarget = 1800;`);
let dt = E(`dayTargets("${nextDow(5)}")`);
check("macro scaling on high day (pro)", dt.pro===Math.round(170*2050/1800));
check("macro scaling on high day (carb/fat)", dt.carb===Math.round(180*2050/1800) && dt.fat===Math.round(55*2050/1800));
E(`cfg.calSchedMode = "custom"; cfg.calSchedDays = [1000,1100,1200,1300,1400,1500,1600];`);
check("custom day applies by weekday", E(`calTargetFor("${nextDow(0)}")`)===1000 && E(`calTargetFor("${nextDow(6)}")`)===1600);
check("custom weekly total sums the days", E(`weeklyCalTotal()`)===9100);
E(`cfg.calSchedMode = "same"; cfg.calSchedDays = null;`);
check("same mode: flat target", E(`calTargetFor("${dstr(0)}")`)===1800 && E(`weeklyCalTotal()`)===12600);

// ---------- migrations ----------
check("old range cfg migrates to midpoint", (()=>{ E(`var o={calLo:1500,calHi:1700}; migrateTargets(o);`); return E("o.calTarget")===1600; })());
check("proLo/proHi migrate too", (()=>{ E(`var o2={proLo:160,proHi:180}; migrateTargets(o2);`); return E("o2.proTarget")===170; })());
check("existing exact targets never overwritten", (()=>{ E(`var o3={calTarget:1750,calLo:1000,calHi:1200}; migrateTargets(o3);`); return E("o3.calTarget")===1750; })());

// ---------- schemaVersion prepareState pipeline ----------
const schemaDataRaw = JSON.stringify({food:{},workouts:[],weights:[]});
const schemaProgramRaw = JSON.stringify({name:"Test",days:[{id:"D1",title:"Day 1",exercises:[{name:"Squat"}]}]});
let prep = E(`prepareState(${JSON.stringify(JSON.stringify({calLo:1500,calHi:1700,proLo:160,proHi:180}))}, ${JSON.stringify(schemaDataRaw)}, ${JSON.stringify(schemaProgramRaw)})`);
check("prepareState migrates legacy whole-state to schema 2", prep.ok && prep.state.cfg.schemaVersion===2 && prep.state.data.activeWorkoutDraft===null);
check("prepareState preserves migrateTargets-before-defaults ordering", prep.state.cfg.calTarget===1600 && prep.state.cfg.proTarget===170);
check("legacy migration marks settings and adds the v56 draft field", prep.changed.cfg===true && prep.changed.data===true && prep.changed.program===false);
prep = E(`prepareState(${JSON.stringify(JSON.stringify(Object.assign({}, EXISTING_CFG,{schemaVersion:2, futureField:"keep-me"})))}, ${JSON.stringify(schemaDataRaw)}, ${JSON.stringify(schemaProgramRaw)})`);
check("current schema short-circuits without migration writes", prep.ok && !prep.changed.cfg && !prep.changed.data && !prep.changed.program);
const v1Prep = E(`prepareState(${JSON.stringify(JSON.stringify(Object.assign({}, EXISTING_CFG,{schemaVersion:1})))}, ${JSON.stringify(schemaDataRaw)}, ${JSON.stringify(schemaProgramRaw)})`);
check("schema 1 migrates to schema 2 with an empty workout draft", v1Prep.ok && v1Prep.state.cfg.schemaVersion===2 && v1Prep.state.data.activeWorkoutDraft===null && v1Prep.changed.cfg && v1Prep.changed.data);
const v1Fail = E(`prepareState(${JSON.stringify(JSON.stringify(Object.assign({}, EXISTING_CFG,{schemaVersion:1})))}, ${JSON.stringify(schemaDataRaw)}, ${JSON.stringify(schemaProgramRaw)}, {forceMigrationFailureAt:2})`);
check("schema 1→2 migration failure returns no prepared state for commit", !v1Fail.ok && /1→2 failed/.test(v1Fail.reason));
const validDraftData = JSON.stringify({food:{},workouts:[],weights:[],activeWorkoutDraft:{date:"2026-07-15",day:"D1",title:"Day 1",sets:{Squat:[{w:225,r:5}]},notes:"",updatedAt:"2026-07-15T12:00:00.000Z"}});
check("valid persisted workout drafts pass whole-state validation", E(`prepareState(${JSON.stringify(JSON.stringify(Object.assign({}, EXISTING_CFG,{schemaVersion:2})))}, ${JSON.stringify(validDraftData)}, ${JSON.stringify(schemaProgramRaw)}).ok`)===true);
const badDraftData = JSON.stringify({food:{},workouts:[],weights:[],activeWorkoutDraft:{date:"2026-07-15",day:"D1",sets:{Squat:[{w:0,r:5}]}}});
check("invalid persisted workout draft sets are rejected", E(`prepareState(${JSON.stringify(JSON.stringify(Object.assign({}, EXISTING_CFG,{schemaVersion:2})))}, ${JSON.stringify(badDraftData)}, ${JSON.stringify(schemaProgramRaw)}).ok`)===false);
check("unknown settings fields survive preparation", prep.state.cfg.futureField==="keep-me");
check("current custom rest arrays remain valid", E(`prepareState(${JSON.stringify(JSON.stringify(Object.assign({}, EXISTING_CFG,{schemaVersion:2,customRests:[75,120]})))}, ${JSON.stringify(schemaDataRaw)}, ${JSON.stringify(schemaProgramRaw)}).ok`)===true);
check("newer schema is refused", E(`prepareState('${JSON.stringify({schemaVersion:99})}', ${JSON.stringify(schemaDataRaw)}, ${JSON.stringify(schemaProgramRaw)}).kind`)==="newer");
check("malformed schema type is refused", E(`prepareState('${JSON.stringify({schemaVersion:"1"})}', ${JSON.stringify(schemaDataRaw)}, ${JSON.stringify(schemaProgramRaw)}).ok`)===false);
check("unusable log structures fail validation", E(`prepareState('${JSON.stringify({schemaVersion:2})}', '${JSON.stringify({food:{},workouts:{},weights:[]})}', ${JSON.stringify(schemaProgramRaw)}).ok`)===false);
check("legacy null optional log fields normalize instead of quarantining", (()=>{ const q=E(`prepareState('${JSON.stringify({schemaVersion:2})}', '${JSON.stringify({food:{},workouts:[],weights:[],recents:null,myFoods:null,meta:null})}', ${JSON.stringify(schemaProgramRaw)})`); return q.ok && Array.isArray(q.state.data.recents) && q.state.data.meta && typeof q.state.data.myFoods==="object"; })());

// ---------- v46 recovery record parsers & diagnostics ----------
const v46CfgRaw = JSON.stringify(Object.assign({}, EXISTING_CFG, {schemaVersion:2}));
const v46LkgObj = {recoveryFormatVersion:1,savedAt:"2026-07-14T12:00:00.000Z",strings:{cfg:v46CfgRaw,data:schemaDataRaw,program:schemaProgramRaw},legacyData:null};
check("structured diagnostics identify parse stage and area", (()=>{ const x=E(`prepareState("{bad",${JSON.stringify(schemaDataRaw)},${JSON.stringify(schemaProgramRaw)})`); return !x.ok && x.diagnostic.stage==="parse" && x.diagnostic.part==="cfg" && x.diagnostic.code==="json-parse"; })());
check("structured diagnostics identify validation area", (()=>{ const x=E(`prepareState(${JSON.stringify(v46CfgRaw)},'${JSON.stringify({food:{},workouts:{},weights:[]})}',${JSON.stringify(schemaProgramRaw)})`); return !x.ok && x.diagnostic.stage==="validation" && x.diagnostic.part==="data"; })());
check("valid format-1 LKG validates through shared pipeline", E(`inspectLkgRaw(${JSON.stringify(JSON.stringify(v46LkgObj))}).ok`)===true);
check("malformed LKG record is rejected without touching primary state", E(`inspectLkgRaw("{bad").code`)==="parse");
check("newer LKG format receives newer-version protection", E(`inspectLkgRaw('${JSON.stringify({recoveryFormatVersion:2,strings:{}})}').newer`)===true);
check("current recovery format containing newer primary state is also protected", E(`inspectLkgRaw(${JSON.stringify(JSON.stringify({recoveryFormatVersion:1,savedAt:"future",strings:{cfg:JSON.stringify({schemaVersion:99}),data:schemaDataRaw,program:schemaProgramRaw},legacyData:null}))}).newer`)===true);
check("string recovery format is invalid, never coerced", E(`inspectLkgRaw('${JSON.stringify({recoveryFormatVersion:"1",strings:{}})}').code`)==="format");
const v46QObj={recoveryFormatVersion:1,quarantinedAt:"2026-07-14T12:00:00.000Z",originals:{cfg:null,data:"{bad",program:null,legacyData:"legacy"}};
check("quarantine parser accepts exact string-or-null originals", E(`inspectQuarantineRaw('${JSON.stringify(v46QObj)}').ok`)===true);
check("quarantine parser rejects non-string original payloads", E(`inspectQuarantineRaw('${JSON.stringify({recoveryFormatVersion:1,originals:{cfg:{},data:null,program:null,legacyData:null}})}').code`)==="shape");
check("quarantine parser requires every exact-original field", E(`inspectQuarantineRaw('${JSON.stringify({recoveryFormatVersion:1,originals:{cfg:null,data:null,program:null}})}').code`)==="shape");
check("recovery original equality treats omitted and null consistently", E(`sameRecoveryOriginals({cfg:null,data:"x",program:null},{cfg:undefined,data:"x",program:undefined,legacyData:null})`)===true);
check("readable recovery summary names every keep/reset decision", E(`recoverySummary({cfg:{usable:true},data:{usable:false},program:{usable:true}})`)==="Keep settings · Reset logs · Keep training program");
check("recovery records are not accepted as backup envelopes", E(`prepareRecoveryBackupEnvelope(${JSON.stringify(v46LkgObj)}).code`)==="recovery-record");
check("recovery record marker is rejected even when primary-looking members are added", E(`prepareRecoveryBackupEnvelope(${JSON.stringify(Object.assign({},v46LkgObj,{cfg:JSON.parse(v46CfgRaw)}))}).code`)==="recovery-record");
check("primary schema 2 and recovery format 1 remain separate contracts", E(`SCHEMA_VERSION===2 && RECOVERY_FORMAT_VERSION===1 && !Object.prototype.hasOwnProperty.call(DEFAULT_CFG,"schemaVersion")`)===true);

// ---------- v64 device-only rest timer record ----------
check("v64 running rest timer record validates", E(`inspectRestTimerRaw('${JSON.stringify({formatVersion:1,status:"running",endAt:2000000000000,remainingSec:90,savedAt:1999999990000})}').ok`)===true);
check("v64 paused rest timer record validates", E(`inspectRestTimerRaw('${JSON.stringify({formatVersion:1,status:"paused",remainingSec:47,savedAt:1999999990000})}').ok`)===true);
check("v65 completed rest timer record preserves its ready duration without a deadline", E(`inspectRestTimerRaw('${JSON.stringify({formatVersion:1,status:"ready",durationSec:75,savedAt:2000000000000})}').ok`)===true);
check("v64 malformed rest timer record is rejected", E(`inspectRestTimerRaw('${JSON.stringify({formatVersion:1,status:"running",endAt:"later"})}').code`)==="shape");
check("v64 newer rest timer record receives version protection", E(`inspectRestTimerRaw('${JSON.stringify({formatVersion:2,status:"running",endAt:2000000000000})}').newer`)===true);

// ---------- parseFoodsReply ----------
const straight = '{"foods":[{"name":"Chicken","cal":610,"pro":42,"carb":22,"fat":38}]}';
check("straight JSON parses", E(`parseFoodsReply(${JSON.stringify(straight)}).length`)===1);
const curly = '{\u201Cfoods\u201D:[{\u201Cname\u201D:\u201CChicken\u201D,\u201Ccal\u201D:610,\u201Cpro\u201D:42,\u201Ccarb\u201D:22,\u201Cfat\u201D:38}]}';
check("iPhone curly quotes normalized", E(`parseFoodsReply(${JSON.stringify(curly)})[0].cal`)===610);
check("code fences + prose stripped", E(`parseFoodsReply(${JSON.stringify("Sure!\n```json\n"+straight+"\n```\nEnjoy!")}).length`)===1);
check("zero-width/BOM junk stripped", E(`parseFoodsReply(${JSON.stringify("\uFEFF"+straight+"\u200B")}).length`)===1);
check("strict shape: entries missing macros dropped", E(`parseFoodsReply('{"foods":[{"name":"ok","cal":1,"pro":1,"carb":1,"fat":1},{"name":"no fat","cal":1,"pro":1,"carb":1}]}').length`)===1);
check("non-JSON throws (visible error upstream)", (()=>{ try{ E(`parseFoodsReply("no json here")`); return false; }catch(e){ return true; } })());

// ---------- streak ----------
function streakWith(dataObj){
  const d2 = boot(EXISTING_CFG, Object.assign({}, EMPTY_DATA, dataObj));
  return d2.window.eval("computeStreak()");
}
check("no logs = 0", streakWith({})===0);
const fin={}; fin[dstr(0)]=true; fin[dstr(-1)]=true;
check("empty finish-day flags alone = 0", streakWith({finished:fin})===0);
const zf={}; zf[dstr(0)]=[{name:"water",cal:0,pro:0,carb:0,fat:0,meal:"other"}];
check("zero-macro entries don't count", streakWith({food:zf})===0);
const f4={}; f4[dstr(0)]=[{name:"e",cal:140,pro:12,carb:1,fat:10,meal:"breakfast"}]; f4[dstr(-3)]=[{name:"c",cal:300,pro:40,carb:0,fat:8,meal:"dinner"}];
check("4 mixed real days = 4", streakWith({food:f4, workouts:[{date:dstr(-1),day:"D1",title:"A",sets:{"Bench Press":[{w:225,r:5}]},notes:""}], weights:[{date:dstr(-2),lbs:220}]})===4);
const f5={}; f5[dstr(-1)]=[{name:"e",cal:140,pro:12,carb:1,fat:10,meal:"breakfast"}];
check("today empty keeps yesterday's streak", streakWith({food:f5})===1);
const f6={}; [2,3,4].forEach(i=>{ f6[dstr(-i)]=[{name:"e",cal:140,pro:12,carb:1,fat:10,meal:"breakfast"}]; });
check("yesterday+today both empty = 0", streakWith({food:f6})===0);

// ---------- bar color thresholds ----------
const bar = (kind,val,target)=>E(`exactBarHTML("T", ${val}, ${target}, "u", "${kind}")`);
check("cal +99 over = not red (buffer)", !bar("cal",1899,1800).includes("over"));
check("cal +100 over = red (boundary is >=100, per original '100+ over' spec)", bar("cal",1900,1800).includes("over"));
check("protein at goal = green", bar("pro",170,170).includes("ok"));
check("protein over = still green, never red", bar("pro",220,170).includes("ok") && !bar("pro",220,170).includes("over"));
check("carbs +16 over = red", bar("carb",196,180).includes("over"));
check("fat +9 over = red", bar("fat",64,55).includes("over"));
check("under target = in-progress, not red", !bar("cal",1500,1800).includes("over"));

// ---------- date handling ----------
check("todayStr is YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(E("todayStr()")));
check("todayStr matches local date", E("todayStr()")===dstr(0));

summary("UNIT");
})().catch(e=>{ console.error(e); process.exit(1); });
