// BlackPyre permanent integration suite — boots the shipped app and exercises whole flows.
const { boot, bootRaw, assembleHTML, sacredCalls, allBlackPyreCalls, makeNativeFilesystem, makeLocalNotifications, check, summary, dstr, wait, EXISTING_CFG, EMPTY_DATA } = require("./harness");
const fs = require("fs");
const path = require("path");

(async ()=>{
const html = assembleHTML();

// ================= fresh user =================
const A = boot(null, null);
const dA = A.window.document;
const clickA = el=>(typeof el==="string"?dA.getElementById(el):el).dispatchEvent(new A.window.Event("click",{bubbles:true}));
clickA("disclaimerAgreeBtn"); clickA("setupSkip");
check("fresh boot completes", dA.getElementById("setupOverlay").classList.contains("hidden"));

// every referenced ID exists; no duplicates (wizard su* IDs are rendered dynamically)
const jsSrc = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const refs = [...new Set([...jsSrc.matchAll(/getElementById\("([^"]+)"\)/g)].map(m=>m[1]))];
const missing = refs.filter(id=>!id.startsWith("su") && !dA.getElementById(id));
check("no missing element IDs ("+refs.length+" referenced)", missing.length===0 || (console.log("   missing:",missing),false));
const ids = [...dA.querySelectorAll("[id]")].map(e=>e.id);
check("no duplicate IDs ("+ids.length+" elements)", ids.filter((id,i)=>ids.indexOf(id)!==i).length===0);

// no fake defaults anywhere a fresh user looks
const ui = ["view-dash","view-food","view-weight","view-settings"].map(id=>dA.getElementById(id).textContent).join(" ");
check("no NaN/null/fake numbers rendered", !ui.includes("NaN") && !ui.includes("null") && !ui.includes("0 → 0"));
check("bars replaced by set-targets guidance", dA.getElementById("dashBars").textContent.includes("Settings"));
check("schedule gated without a target", dA.getElementById("sCalSched").disabled===true);
check("gold is the fresh-user accent", A.window.document.documentElement.style.getPropertyValue("--ember")==="#FBBF24");

// logging still works target-free; celebration makes no target claims
A.window.eval(`currentMeal="lunch"; renderMealSeg(); addEntry({name:"Chicken breast", cal:165, pro:31, carb:0, fat:3.6, meal:"lunch"});`);
check("food logs without targets", A.window.eval("data.food[todayStr()].length")===1);
check("kudos chip fires (Efficient protein)", dA.getElementById("foodKudos").textContent.includes("Efficient protein"));
clickA("finishDayBtn"); await wait(10);
check("finish-day makes no target claims when unset", !/targets? hit/.test(dA.getElementById("celebrate").textContent));

// targets via manual save unlock everything
const setvA=(id,v)=>{const e=dA.getElementById(id); e.value=v; e.dispatchEvent(new A.window.Event("input",{bubbles:true})); e.dispatchEvent(new A.window.Event("change",{bubbles:true}));};
// calculator acknowledges only a valid calculation
clickA("calcMacrosBtn");
check("invalid macro calculation does not show green tap feedback", !dA.getElementById("calcMacrosBtn").classList.contains("acked"));
setvA("cAge","42"); setvA("cFt","5"); setvA("cIn","11"); setvA("cWt","225");
clickA("calcMacrosBtn");
check("valid macro calculation briefly turns Calculate green", dA.getElementById("calcMacrosBtn").classList.contains("acked") && dA.getElementById("calcMacrosBtn").textContent==="✓ Calculated");
check("valid macro calculation persists its independent weight input", A.window.eval("cfg.calcInputs.lb===225"));
const AReload = boot(
  JSON.parse(A.window.localStorage.getItem("forge:cfg")),
  JSON.parse(A.window.localStorage.getItem("forge:data"))
);
check("calculator weight survives a complete app relaunch", Number(AReload.window.document.getElementById("cWt").value)===225);

setvA("sCalTarget","1800"); setvA("sProTarget","170"); setvA("sCarb","180"); setvA("sFat","55");
clickA("saveSettingsBtn");
check("manual save populates + bars appear", dA.getElementById("dashBars").textContent.includes("/ 1800 kcal"));
check("schedule enables with a real target", dA.getElementById("sCalSched").disabled===false);
setvA("sCalSched","custom");
check("custom boxes prefill at the exact target, never 0", [0,1,2,3,4,5,6].every(i=>dA.getElementById("sSched"+i).value==="1800"));
setvA("sSched5","2700");
A.window.eval(`window.__f=null; flashSave=(m,e)=>{window.__f={m,e}};`);
clickA("saveSettingsBtn");
check("over-budget custom blocked from saving", A.window.eval("cfg.calSchedMode")!=="custom" && A.window.eval("window.__f.m").includes("Over weekly budget"));
clickA("schedAutoBtn");
check("auto-balance lands exactly on budget", [0,1,2,3,4,5,6].reduce((a,i)=>a+Number(dA.getElementById("sSched"+i).value),0)===1800*7);

// ================= existing user preserved =================
const B = boot(EXISTING_CFG, { food:{}, workouts:[], weights:[{date:"2026-07-01",lbs:220}], meta:{lastBackup:null,logsSince:0} });
check("existing values intact", B.window.eval("cfg.calTarget")===1800 && B.window.eval("cfg.startWt")===225);
check("legacy settings without a calculator weight use the latest weigh-in", Number(B.window.document.getElementById("cWt").value)===220);
check("saved accent (steel) preserved", B.window.document.documentElement.style.getPropertyValue("--ember")==="#4D9DE0");
check("weight page trend + goal line render", B.window.document.getElementById("chartLabel").textContent==="Trend · 225 → 175" && B.window.document.getElementById("chart").innerHTML.includes("GOAL 175"));

// backup / restore round-trip
B.window.eval(`cfg.anthropicKey="sk-test-A"; cfg.aiProvider="anthropic"; saveCfg();
window.__dl=null; download=(n,c)=>{window.__dl=c;}; doBackup("exportDataBtn");`);
check("export excludes API keys", !B.window.eval("window.__dl").includes("sk-test-A"));
B.window.eval(`
  const b = JSON.parse(window.__dl);
  delete b.cfg.calTarget; delete b.cfg.proTarget; b.cfg.calLo=1500; b.cfg.calHi=1700; b.cfg.proLo=160; b.cfg.proHi=180;
  const keepAI={}; ["anthropicKey","openaiKey","aiProvider","aiModelAnth","aiModelOai"].forEach(k=>{ if(b.cfg[k]===undefined && cfg[k]!==undefined) keepAI[k]=cfg[k]; });
  migrateTargets(b.cfg);
  cfg = Object.assign({}, DEFAULT_CFG, b.cfg, keepAI); migrateCfg(); saveCfg();
`);
check("old-range backup restores + migrates", B.window.eval("cfg.calTarget")===1600);
check("restore preserves AI key + provider", B.window.eval("cfg.anthropicKey")==="sk-test-A" && B.window.eval("cfg.aiProvider")==="anthropic");

// ================= v45: schemaVersion & protected migrations =================
const V1_CFG = Object.assign({}, EXISTING_CFG, {schemaVersion:1});
const V3_CFG = Object.assign({}, EXISTING_CFG, {schemaVersion:3});
const V2_DATA = Object.assign({}, EMPTY_DATA, {activeWorkoutDraft:null});
const TEST_PROGRAM = {name:"Test Program",author:"Suite",days:[{id:"D1",title:"Day 1",exercises:[{name:"Bench Press",scheme:"3×5"}]}]};
const RAW_V1_CFG = JSON.stringify(V1_CFG);
const RAW_V3_CFG = JSON.stringify(V3_CFG);
const RAW_DATA = JSON.stringify(EMPTY_DATA);
const RAW_V2_DATA = JSON.stringify(V2_DATA);
const RAW_PROGRAM = JSON.stringify(TEST_PROGRAM);
const sacredBytes = dom=>({
  cfg:dom.window.localStorage.getItem("forge:cfg"),
  data:dom.window.localStorage.getItem("forge:data"),
  program:dom.window.localStorage.getItem("forge:program")
});
const sameBytes = (a,b)=>a.cfg===b.cfg && a.data===b.data && a.program===b.program;
const zeroSacredWrites = dom=>sacredCalls(dom).length===0;

// Parse failures: each present-but-unparseable key protects all three sacred keys.
let PC = bootRaw({cfg:"{broken", data:RAW_DATA, program:RAW_PROGRAM});
const pcOriginal = sacredBytes(PC);
check("unparseable settings enter protected mode with banner", PC.window.eval("protectedMode")===true && !PC.window.document.getElementById("protectedBanner").classList.contains("hidden"));
check("protected mode suppresses disclaimer and setup gates", PC.window.document.getElementById("disclaimerOverlay").classList.contains("hidden") && PC.window.document.getElementById("setupOverlay").classList.contains("hidden"));
check("unparseable settings cause zero sacred-key writes", zeroSacredWrites(PC) && sameBytes(pcOriginal,sacredBytes(PC)));

let PReadable = bootRaw({cfg:"{broken", data:JSON.stringify({food:{},workouts:[],weights:[{date:"2026-07-01",lbs:220}]}), program:JSON.stringify({name:"Readable program",days:[{id:"D1",title:"Day 1",exercises:[{name:"Squat"}]}]})});
check("protected fallback still loads other readable storage areas", PReadable.window.eval("data.weights.length")===1 && PReadable.window.eval("program.name")==="Readable program");

let PD = bootRaw({cfg:RAW_V1_CFG, data:"{broken", program:RAW_PROGRAM});
const pdOriginal = sacredBytes(PD);
check("unparseable logs protect all keys byte-for-byte", PD.window.eval("protectedMode") && zeroSacredWrites(PD) && sameBytes(pdOriginal,sacredBytes(PD)));
let PP = bootRaw({cfg:RAW_V1_CFG, data:RAW_DATA, program:"{broken"});
const ppOriginal = sacredBytes(PP);
check("unparseable program protects all keys byte-for-byte", PP.window.eval("protectedMode") && zeroSacredWrites(PP) && sameBytes(ppOriginal,sacredBytes(PP)));

let PM = bootRaw({cfg:JSON.stringify(EXISTING_CFG), data:RAW_DATA, program:RAW_PROGRAM}, w=>{ w.__BP_TEST_PREPARE_OPTIONS={forceMigrationFailure:true}; });
const pmOriginal = sacredBytes(PM);
check("forced mid-chain migration failure makes zero writes", PM.window.eval("protectedMode") && zeroSacredWrites(PM) && sameBytes(pmOriginal,sacredBytes(PM)));
let PM2 = bootRaw({cfg:RAW_V1_CFG, data:RAW_DATA, program:RAW_PROGRAM}, w=>{ w.__BP_TEST_PREPARE_OPTIONS={forceMigrationFailureAt:2}; });
const pm2Original = sacredBytes(PM2);
check("forced schema 1→2 draft migration failure makes zero writes", PM2.window.eval("protectedMode") && zeroSacredWrites(PM2) && sameBytes(pm2Original,sacredBytes(PM2)));
let PV = bootRaw({cfg:RAW_V1_CFG, data:JSON.stringify({food:{},workouts:{},weights:[]}), program:RAW_PROGRAM});
const pvOriginal = sacredBytes(PV);
check("validation rejection makes zero writes", PV.window.eval("protectedMode") && zeroSacredWrites(PV) && sameBytes(pvOriginal,sacredBytes(PV)));
let PN = bootRaw({cfg:JSON.stringify(Object.assign({},V1_CFG,{schemaVersion:99})), data:RAW_DATA, program:RAW_PROGRAM});
const pnOriginal = sacredBytes(PN);
check("newer schema enters protected mode with update guidance", PN.window.eval("protectedModeKind")==="newer" && /newer BlackPyre/i.test(PN.window.document.getElementById("protectedBannerText").textContent));
check("newer schema makes zero sacred-key writes", zeroSacredWrites(PN) && sameBytes(pnOriginal,sacredBytes(PN)));

const malformedVersions = ["1",null,-1,1.5,[],{}];
check("every malformed schemaVersion variant fails safely", malformedVersions.every(v=>{
  const Q=bootRaw({cfg:JSON.stringify(Object.assign({},V1_CFG,{schemaVersion:v})),data:RAW_DATA,program:RAW_PROGRAM});
  return Q.window.eval("protectedMode")===true && zeroSacredWrites(Q);
}));

// The save choke points visibly undo representative mutations and never touch storage.
PC.__storageCalls.length=0;
PC.window.eval(`addEntry({name:"Blocked food",cal:100,pro:10,carb:10,fat:2,meal:"lunch"});`);
await wait(15);
check("protected food mutation is visibly undone", PC.window.eval("Object.keys(data.food).length")===0);
PC.window.eval(`data.weights.push({date:todayStr(),lbs:210}); save();`);
await wait(15);
check("protected weight mutation is visibly undone", PC.window.eval("data.weights.length")===0);
PC.window.eval(`data.workouts.push({date:todayStr(),day:"D1",title:"Blocked",sets:{},notes:""}); save();`);
await wait(15);
check("protected workout mutation is visibly undone", PC.window.eval("data.workouts.length")===0);
const protectedGoal = PC.window.eval("cfg.goalWt");
PC.window.eval(`cfg.goalWt=199; saveCfg();`);
await wait(15);
check("protected settings mutation is visibly undone", PC.window.eval("cfg.goalWt")===protectedGoal);
PC.window.document.getElementById("foodSuggestionsAvoid").value="blocked-change";
PC.window.document.getElementById("saveFoodSuggestionsBtn").dispatchEvent(new PC.window.Event("click",{bubbles:true}));
check("blocked actions cannot show a false saved acknowledgement", !PC.window.document.getElementById("saveFoodSuggestionsBtn").classList.contains("acked") && /Not saved/.test(PC.window.document.getElementById("saveState").textContent));
const protectedProgram = PC.window.eval("program.name");
PC.window.eval(`program={name:"Blocked",days:[{id:"X",title:"X",exercises:[{name:"Squat"}]}]}; saveProgram();`);
await wait(15);
check("protected program mutation is visibly undone", PC.window.eval("program.name")===protectedProgram);
const blockedRestore = PC.window.eval(`restoreBackupEnvelope({cfg:${JSON.stringify(V1_CFG)}})`);
check("restore is blocked in protected mode", blockedRestore.ok===false && blockedRestore.code==="protected");
check("all protected mutation attempts still make zero writes", zeroSacredWrites(PC) && sameBytes(pcOriginal,sacredBytes(PC)));

// Protected export is deliberately partial and inert.
const protectedMetaBefore = PC.window.eval("JSON.stringify(data.meta)");
PC.window.eval(`window.confirm=()=>true; window.__partial=null; download=(n,c)=>{window.__partial={n,c};}; doBackup("exportDataBtn");`);
check("protected export uses a distinct PARTIAL filename", /blackpyre-PARTIAL-/.test(PC.window.eval("window.__partial.n")));
check("protected export does not mutate backup metadata", PC.window.eval("JSON.stringify(data.meta)")===protectedMetaBefore && zeroSacredWrites(PC));

// Healthy boot paths: one-time cfg stamp only, then no-op forever.
let Fresh45 = bootRaw({});
const freshCalls = sacredCalls(Fresh45);
check("fresh install stamps schemaVersion 3", JSON.parse(Fresh45.window.localStorage.getItem("forge:cfg")).schemaVersion===3);
check("fresh install writes a complete primary state", freshCalls.length===3 && freshCalls.map(c=>c.key).join(",")==="forge:data,forge:program,forge:cfg");
const rawV44Cfg = JSON.stringify(Object.assign({},EXISTING_CFG,{futureField:"survives"}));
let H45 = bootRaw({cfg:rawV44Cfg,data:RAW_DATA,program:RAW_PROGRAM});
const h45Calls = sacredCalls(H45);
check("legacy-shaped install adds exercise defaults then stamps schema 3", h45Calls.length===2 && h45Calls.map(c=>c.key).join(",")==="forge:data,forge:cfg" && JSON.parse(h45Calls[1].value).schemaVersion===3 && JSON.parse(H45.window.localStorage.getItem("forge:data")).activeWorkoutDraft===null && Object.keys(JSON.parse(H45.window.localStorage.getItem("forge:data")).myExercises||{}).length===0);
check("healthy migration leaves program byte-identical", H45.window.localStorage.getItem("forge:program")===RAW_PROGRAM);
check("unknown settings fields survive migration", H45.window.eval("cfg.futureField")==="survives");
let H45b = bootRaw(sacredBytes(H45));
check("second boot performs zero sacred-key writes", zeroSacredWrites(H45b));

// Real restore path: shared preparation, AI presence semantics, partial envelopes.
let R45 = boot(V1_CFG, EMPTY_DATA, null, TEST_PROGRAM);
R45.window.eval(`cfg.anthropicKey="sk-device"; cfg.aiProvider="anthropic"; cfg.foodHandoffOn=false; saveCfg();`);
R45.__storageCalls.length=0;
const beforeRangeData = R45.window.localStorage.getItem("forge:data");
const beforeRangeProgram = R45.window.localStorage.getItem("forge:program");
const rangeCfg = Object.assign({},EXISTING_CFG,{calLo:1500,calHi:1700,proLo:160,proHi:180});
delete rangeCfg.calTarget; delete rangeCfg.proTarget;
let restoreResult = R45.window.eval(`restoreBackupEnvelope({cfg:${JSON.stringify(rangeCfg)}})`);
check("range-era backup restores through shared pipeline", restoreResult.ok && R45.window.eval("cfg.calTarget")===1600 && R45.window.eval("cfg.proTarget")===170);
check("restore preserves absent device AI fields", R45.window.eval("cfg.anthropicKey")==="sk-device" && R45.window.eval("cfg.aiProvider")==="anthropic");
check("v60 restore preserves an absent food-handoff preference", R45.window.eval("cfg.foodHandoffOn")===false);
check("cfg-only partial restore leaves data and program bytes untouched", R45.window.localStorage.getItem("forge:data")===beforeRangeData && R45.window.localStorage.getItem("forge:program")===beforeRangeProgram);
const cfgBeforeDataOnly = R45.window.localStorage.getItem("forge:cfg");
const progBeforeDataOnly = R45.window.localStorage.getItem("forge:program");
const replacementData = {food:{"2026-07-14":[{name:"Restored",cal:10,pro:1,carb:1,fat:0,meal:"other"}]},workouts:[],weights:[],meta:{lastBackup:null,logsSince:0}};
restoreResult = R45.window.eval(`restoreBackupEnvelope({data:${JSON.stringify(replacementData)}})`);
check("data-only partial envelope replaces data", restoreResult.ok && R45.window.eval(`data.food["2026-07-14"][0].name`)==="Restored");
check("data-only partial envelope leaves cfg and program untouched", R45.window.localStorage.getItem("forge:cfg")===cfgBeforeDataOnly && R45.window.localStorage.getItem("forge:program")===progBeforeDataOnly);
check("successful normal restore refreshes LKG with restored persisted state", JSON.parse(JSON.parse(R45.window.localStorage.getItem("forge:lkg")).strings.data).food["2026-07-14"][0].name==="Restored");

// Bad/newer backups are refused without changing storage, runtime, or mode.
R45.__storageCalls.length=0;
const rejectBytes = sacredBytes(R45);
const rejectRuntime = R45.window.eval("JSON.stringify({cfg:cfg,data:data,program:program})");
let rejected = R45.window.eval(`restoreBackupEnvelope({cfg:${JSON.stringify(Object.assign({},V1_CFG,{schemaVersion:99}))}})`);
check("newer backup is refused without protected mode", !rejected.ok && R45.window.eval("protectedMode")===false && R45.window.document.getElementById("protectedBanner").classList.contains("hidden"));
check("newer backup refusal changes no storage or runtime", zeroSacredWrites(R45) && sameBytes(rejectBytes,sacredBytes(R45)) && R45.window.eval("JSON.stringify({cfg:cfg,data:data,program:program})")===rejectRuntime);
R45.__storageCalls.length=0;
rejected = R45.window.eval(`restoreBackupEnvelope({data:{food:{},workouts:{},weights:[]}})`);
check("invalid backup validation is refused with zero writes", !rejected.ok && zeroSacredWrites(R45) && sameBytes(rejectBytes,sacredBytes(R45)));

// A torn multi-key commit remains unstamped; the next boot reruns migration and heals it.
let T45 = boot(V1_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const tStore = T45.window.localStorage;
const tOrig = T45.window.__storageOriginalMethods;
tOrig.clear.call(tStore);
const tornCfg = JSON.stringify({setupDone:true,disclaimerAccepted:"2026-07-01",calLo:1500,calHi:1700,proLo:160,proHi:180});
const tornData = JSON.stringify({food:{},workouts:[],weights:[]});
const tornProgram = JSON.stringify({name:"Torn",days:[{exercises:[{name:"Squat"}]}]});
tOrig.setItem.call(tStore,"forge:cfg",tornCfg);
tOrig.setItem.call(tStore,"forge:data",tornData);
tOrig.setItem.call(tStore,"forge:program",tornProgram);
T45.__storageCalls.length=0;
const tProto = Object.getPrototypeOf(tStore);
const tSpySet = tProto.setItem;
let tWriteCount = 0;
tProto.setItem = function(k,v){
  tWriteCount++;
  if (tWriteCount>=3) throw new Error("simulated interruption");
  return tSpySet.call(this,k,v);
};
const tornCommit = T45.window.eval(`(()=>{const p=prepareState(${JSON.stringify(tornCfg)},${JSON.stringify(tornData)},${JSON.stringify(tornProgram)},{originalStrings:{cfg:${JSON.stringify(tornCfg)},data:${JSON.stringify(tornData)},program:${JSON.stringify(tornProgram)}}});return commitState(p,{forceWrite:{cfg:true,data:true,program:true}});})()`);
tProto.setItem = tSpySet;
check("commit order writes data and program before settings stamp", sacredCalls(T45).slice(0,2).map(c=>c.key).join(",")==="forge:data,forge:program");
check("simulated interrupted commit reports failed rollback", tornCommit.ok===false && tornCommit.rollbackFailed===true && JSON.parse(tStore.getItem("forge:cfg")).schemaVersion===undefined);
let Healed45 = bootRaw({cfg:tStore.getItem("forge:cfg"),data:tStore.getItem("forge:data"),program:tStore.getItem("forge:program")});
check("next boot heals an unstamped interrupted commit", Healed45.window.eval("protectedMode")===false && Healed45.window.eval("cfg.schemaVersion")===3 && Healed45.window.eval("cfg.calTarget")===1600 && Healed45.window.eval("data.activeWorkoutDraft")===null && Healed45.window.eval("Object.keys(data.myExercises||{}).length")===0);

// ================= v46: recovery vault, quarantine, and LKG =================
const fiveBytes = dom=>({
  cfg:dom.window.localStorage.getItem("forge:cfg"),
  data:dom.window.localStorage.getItem("forge:data"),
  program:dom.window.localStorage.getItem("forge:program"),
  lkg:dom.window.localStorage.getItem("forge:lkg"),
  quarantine:dom.window.localStorage.getItem("forge:quarantine")
});
const samePrimary = (a,b)=>a.cfg===b.cfg && a.data===b.data && a.program===b.program;
const callsFor = (dom,key)=>allBlackPyreCalls(dom).filter(c=>c.key===key);
const validQuarantineRaw = originals=>JSON.stringify({recoveryFormatVersion:1,quarantinedAt:"2026-07-14T12:00:00.000Z",diagnostic:{stage:"parse",part:"cfg",code:"json-parse",reason:"test"},originals:originals});

// Healthy v46 boot creates one validated LKG without changing current primary schema or bytes.
let H46 = bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM});
let h46LkgRaw = H46.window.localStorage.getItem("forge:lkg");
let h46Lkg = JSON.parse(h46LkgRaw);
check("v46 recovery behavior keeps current primary schemaVersion 3", H46.window.eval("cfg.schemaVersion")===3 && JSON.parse(H46.window.localStorage.getItem("forge:cfg")).schemaVersion===3);
check("v46 healthy boot creates a format-1 whole-state LKG", h46Lkg.recoveryFormatVersion===1 && ["cfg","data","program"].every(k=>typeof h46Lkg.strings[k]==="string"));
check("creating LKG does not rewrite unchanged primary keys", sacredCalls(H46).length===0 && callsFor(H46,"forge:lkg").length===1);
check("LKG final strings pass the shared prepare pipeline", H46.window.eval(`inspectLkgRaw(${JSON.stringify(h46LkgRaw)}).ok`)===true);
let H46b = bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
check("identical second boot retains LKG timestamp and writes nothing", allBlackPyreCalls(H46b).length===0 && JSON.parse(H46b.window.localStorage.getItem("forge:lkg")).savedAt===h46Lkg.savedAt);
check("Settings reports automatic recovery ready", /ready/i.test(H46b.window.document.getElementById("recoveryStatusLine").textContent));

// Each successful primary save refreshes the persisted whole-state snapshot.
H46.__storageCalls.length=0;
H46.window.eval(`data.weights.push({date:"2026-07-14",lbs:218}); save();`);
let snapAfterData = JSON.parse(H46.window.localStorage.getItem("forge:lkg"));
check("successful data save refreshes LKG from persisted storage", JSON.parse(snapAfterData.strings.data).weights[0].lbs===218 && callsFor(H46,"forge:data").length===1 && callsFor(H46,"forge:lkg").length===1);
H46.__storageCalls.length=0;
H46.window.eval(`cfg.goalWt=170; saveCfg();`);
let snapAfterCfg = JSON.parse(H46.window.localStorage.getItem("forge:lkg"));
check("successful settings save refreshes LKG", JSON.parse(snapAfterCfg.strings.cfg).goalWt===170 && callsFor(H46,"forge:cfg").length===1 && callsFor(H46,"forge:lkg").length===1);
H46.__storageCalls.length=0;
H46.window.eval(`program={name:"Recovery Program",days:[{id:"R1",title:"R1",exercises:[{name:"Squat"}]}]}; saveProgram();`);
let snapAfterProgram = JSON.parse(H46.window.localStorage.getItem("forge:lkg"));
check("successful program save refreshes LKG", JSON.parse(snapAfterProgram.strings.program).name==="Recovery Program" && callsFor(H46,"forge:program").length===1 && callsFor(H46,"forge:lkg").length===1);

// A failed primary save never replaces the prior LKG.
const failSaveLkg = H46.window.localStorage.getItem("forge:lkg");
const h46Proto = Object.getPrototypeOf(H46.window.localStorage);
const h46SpySet = h46Proto.setItem;
h46Proto.setItem = function(k,v){ if(k==="forge:data") throw new Error("primary denied"); return h46SpySet.call(this,k,v); };
const failedPrimary = H46.window.eval(`data.weights.push({date:"2026-07-15",lbs:217}); save()`);
h46Proto.setItem = h46SpySet;
check("failed primary save does not replace LKG", failedPrimary===false && H46.window.localStorage.getItem("forge:lkg")===failSaveLkg);
H46.window.eval(`data.workouts={bad:true};`);
const invalidMemoryLkg=H46.window.localStorage.getItem("forge:lkg");
const invalidMemoryRefresh=H46.window.eval(`refreshLastKnownGood("invalid-memory-test")`);
check("invalid unsaved in-memory candidate cannot replace persisted LKG", invalidMemoryRefresh.ok && invalidMemoryRefresh.unchanged && H46.window.localStorage.getItem("forge:lkg")===invalidMemoryLkg);
H46.window.eval(`data=JSON.parse(localStorage.getItem("forge:data")); normalizeDataState(data);`);

// LKG failure is secondary: live save succeeds and previous snapshot remains.
let LkgFail = bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
const lkgFailBefore = LkgFail.window.localStorage.getItem("forge:lkg");
const lfProto = Object.getPrototypeOf(LkgFail.window.localStorage), lfSpySet=lfProto.setItem;
lfProto.setItem=function(k,v){ if(k==="forge:lkg") throw new Error("snapshot denied"); return lfSpySet.call(this,k,v); };
const lkgFailSave = LkgFail.window.eval(`data.weights.push({date:"2026-07-14",lbs:216}); save()`);
lfProto.setItem=lfSpySet;
check("LKG write failure leaves primary save successful", lkgFailSave===true && JSON.parse(LkgFail.window.localStorage.getItem("forge:data")).weights[0].lbs===216);
check("LKG write failure leaves previous snapshot intact and reports unavailable", LkgFail.window.localStorage.getItem("forge:lkg")===lkgFailBefore && LkgFail.window.eval("lkgStatus.state")==="unavailable");
let LkgVerifyFail=bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:lkgFailBefore});
const lvProto=Object.getPrototypeOf(LkgVerifyFail.window.localStorage), lvSet=lvProto.setItem, lvGet=lvProto.getItem;
let lvWrote=false, lvMismatch=false;
lvProto.setItem=function(k,v){ const out=lvSet.call(this,k,v); if(k==="forge:lkg") lvWrote=true; return out; };
lvProto.getItem=function(k){ if(k==="forge:lkg" && lvWrote && !lvMismatch){ lvMismatch=true; return "{mismatch"; } return lvGet.call(this,k); };
LkgVerifyFail.window.eval(`data.weights=[{date:"2026-07-14",lbs:214}]; save();`);
lvProto.setItem=lvSet; lvProto.getItem=lvGet;
check("LKG verification failure rolls back to the previous snapshot", LkgVerifyFail.window.localStorage.getItem("forge:lkg")===lkgFailBefore && JSON.parse(LkgVerifyFail.window.localStorage.getItem("forge:data")).weights[0].lbs===214);

// A quota-caused primary failure may sacrifice LKG once, never quarantine.
const quotaQuarantine = validQuarantineRaw({cfg:"old",data:"old",program:"old",legacyData:null});
let Quota46 = bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw,quarantine:quotaQuarantine});
const qProto=Object.getPrototypeOf(Quota46.window.localStorage), qSpySet=qProto.setItem;
let qFirst=true; const qOrder=[];
qProto.setItem=function(k,v){
  qOrder.push("set:"+k);
  if(k==="forge:data" && qFirst){ qFirst=false; const e=new Error("full"); Object.defineProperty(e,"name",{value:"QuotaExceededError"}); throw e; }
  if(k==="forge:lkg"){ const e=new Error("still full"); Object.defineProperty(e,"name",{value:"QuotaExceededError"}); throw e; }
  return qSpySet.call(this,k,v);
};
const qProtoRemove=qProto.removeItem;
qProto.removeItem=function(k){ qOrder.push("remove:"+k); return Quota46.window.__storageOriginalMethods.removeItem.call(this,k); };
const quotaSaved=Quota46.window.eval(`data.weights.push({date:"2026-07-14",lbs:215}); save()`);
qProto.setItem=qSpySet; qProto.removeItem=qProtoRemove;
check("quota retry sacrifices LKG then saves live data once", quotaSaved===true && qOrder.indexOf("remove:forge:lkg")>qOrder.indexOf("set:forge:data") && JSON.parse(Quota46.window.localStorage.getItem("forge:data")).weights[0].lbs===215);
check("quota retry never sacrifices quarantine", Quota46.window.localStorage.getItem("forge:quarantine")===quotaQuarantine && !qOrder.includes("remove:forge:quarantine"));

// Bad LKG cannot poison healthy data; malformed is rebuilt, newer format is untouched.
let BadLkg = bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:"{broken"});
check("malformed LKG never protects healthy live data", BadLkg.window.eval("protectedMode")===false);
check("malformed LKG is rebuilt as a valid snapshot", BadLkg.window.eval(`inspectLkgRaw(localStorage.getItem("forge:lkg")).ok`)===true && callsFor(BadLkg,"forge:lkg").some(c=>c.method==="setItem"));
const newerLkgRaw=JSON.stringify({recoveryFormatVersion:99,savedAt:"future",strings:{}});
let NewLkg = bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:newerLkgRaw});
check("newer-format LKG is not used or overwritten", NewLkg.window.eval("protectedMode")===false && NewLkg.window.localStorage.getItem("forge:lkg")===newerLkgRaw && NewLkg.window.eval("lkgStatus.state")==="newer" && callsFor(NewLkg,"forge:lkg").length===0);
const newerStateLkgRaw=JSON.stringify({recoveryFormatVersion:1,savedAt:"future",strings:{cfg:JSON.stringify({schemaVersion:99}),data:RAW_DATA,program:RAW_PROGRAM},legacyData:null});
let NewStateLkg=bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:newerStateLkgRaw});
check("LKG carrying newer primary schema is not overwritten", NewStateLkg.window.localStorage.getItem("forge:lkg")===newerStateLkgRaw && NewStateLkg.window.eval("lkgStatus.state")==="newer" && callsFor(NewStateLkg,"forge:lkg").length===0);

// Protected boot diagnoses exact area, shows recovery before gates, and never refreshes LKG.
let DiagCfg = bootRaw({cfg:"{broken",data:RAW_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
check("v46 diagnosis identifies corrupt settings", DiagCfg.window.eval(`protectedModeDiagnostic.stage+":"+protectedModeDiagnostic.part`)==="parse:cfg");
check("corruption recovery panel appears before gates", !DiagCfg.window.document.getElementById("recoveryOverlay").classList.contains("hidden") && DiagCfg.window.document.getElementById("disclaimerOverlay").classList.contains("hidden") && DiagCfg.window.document.getElementById("setupOverlay").classList.contains("hidden"));
check("protected boot never refreshes or replaces LKG", DiagCfg.window.localStorage.getItem("forge:lkg")===h46LkgRaw && callsFor(DiagCfg,"forge:lkg").length===0);
let DiagData=bootRaw({cfg:RAW_V1_CFG,data:"{broken",program:RAW_PROGRAM,lkg:h46LkgRaw});
let DiagProgram=bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:"{broken",lkg:h46LkgRaw});
check("v46 diagnosis distinguishes logs and program", DiagData.window.eval("protectedModeDiagnostic.part")==="data" && DiagProgram.window.eval("protectedModeDiagnostic.part")==="program");
let MigrationDiag46=bootRaw({cfg:JSON.stringify(EXISTING_CFG),data:RAW_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw},w=>{w.__BP_TEST_PREPARE_OPTIONS={forceMigrationFailure:true};});
check("structured boot diagnosis identifies migration failure", MigrationDiag46.window.eval(`protectedModeDiagnostic.stage+":"+protectedModeDiagnostic.part`)==="migration:state" && MigrationDiag46.window.eval("recoveryWritesAllowed()")===true);
let BootCommitDiag46=bootRaw({cfg:JSON.stringify(EXISTING_CFG),data:RAW_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw},w=>{
  const p=Object.getPrototypeOf(w.localStorage), set=p.setItem;
  p.setItem=function(k,v){ if(k==="forge:cfg") throw new Error("boot commit denied"); return set.call(this,k,v); };
});
check("structured boot diagnosis identifies commit failure", BootCommitDiag46.window.eval(`protectedModeDiagnostic.stage+":"+protectedModeDiagnostic.code`)==="commit:boot-commit-failed" && BootCommitDiag46.window.eval("recoveryWritesAllowed()")===true);
let Newer46=bootRaw({cfg:JSON.stringify(Object.assign({},V1_CFG,{schemaVersion:99})),data:RAW_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
check("newer primary data offers no downgrade recovery", Newer46.window.document.getElementById("protectedRecoveryBtn").classList.contains("hidden") && Newer46.window.document.getElementById("recoveryOverlay").classList.contains("hidden") && Newer46.window.eval("recoveryWritesAllowed()")===false);
let StorageRead46=bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM},w=>{
  const p=Object.getPrototypeOf(w.localStorage), g=p.getItem;
  p.getItem=function(k){ if(k==="forge:cfg") throw new Error("read denied"); return g.call(this,k); };
});
check("storage-read failure offers no write-capable recovery", StorageRead46.window.eval("protectedModeDiagnostic.stage")==="storage-read" && StorageRead46.window.eval("recoveryWritesAllowed()")===false && StorageRead46.window.document.getElementById("protectedRecoveryBtn").classList.contains("hidden"));

// Last-known-good recovery quarantines exact originals first, verifies, then exits protected mode.
const lkgSourceData={food:{},workouts:[],weights:[{date:"2026-07-01",lbs:212}],meta:{lastBackup:null,logsSince:0}};
const lkgSourceCfg=Object.assign({},V1_CFG,{goalWt:168,anthropicKey:"sk-lkg",aiProvider:"anthropic"});
const lkgSourceProgram={name:"Known Good",days:[{id:"K1",title:"Known",exercises:[{name:"Deadlift"}]}]};
let LkgSource=boot(lkgSourceCfg,lkgSourceData,null,lkgSourceProgram);
const recoveryLkgRaw=LkgSource.window.localStorage.getItem("forge:lkg");
const corruptCfgRaw="{definitely-broken";
const liveDifferentData=JSON.stringify({food:{},workouts:[],weights:[{date:"2026-07-02",lbs:999}],meta:{lastBackup:null,logsSince:0}});
let RecoverLkg=bootRaw({cfg:corruptCfgRaw,data:liveDifferentData,program:RAW_PROGRAM,lkg:recoveryLkgRaw});
RecoverLkg.__storageCalls.length=0;
const recoverLkgResult=RecoverLkg.window.eval(`performRecoveryCandidate(buildLkgRecoveryCandidate(),{})`);
const recoverLkgQ=JSON.parse(RecoverLkg.window.localStorage.getItem("forge:quarantine"));
const recoverOrder=allBlackPyreCalls(RecoverLkg).map(c=>c.method+":"+c.key);
check("LKG recovery succeeds only after verified commit", recoverLkgResult.ok && RecoverLkg.window.eval("protectedMode")===false && RecoverLkg.window.eval("data.weights[0].lbs")===212 && RecoverLkg.window.eval("program.name")==="Known Good");
check("LKG recovery quarantine preserves exact original primary strings", recoverLkgQ.originals.cfg===corruptCfgRaw && recoverLkgQ.originals.data===liveDifferentData && recoverLkgQ.originals.program===RAW_PROGRAM);
check("quarantine write occurs before every primary recovery write", recoverOrder[0]==="setItem:forge:quarantine" && recoverOrder.findIndex(x=>/forge:(data|program|cfg)$/.test(x))>0);
check("successful recovery retains quarantine and refreshes LKG", RecoverLkg.window.localStorage.getItem("forge:quarantine")!==null && RecoverLkg.window.eval(`inspectLkgRaw(localStorage.getItem("forge:lkg")).ok`)===true);
check("successful recovery exposes quarantine card in Settings", !RecoverLkg.window.document.getElementById("quarantineCard").classList.contains("hidden"));

// Readable recovery keeps valid whole areas and resets only the unusable area.
let Readable46=bootRaw({cfg:RAW_V1_CFG,data:"{broken-logs",program:RAW_PROGRAM,lkg:recoveryLkgRaw});
const readableCandidate=Readable46.window.eval("buildReadableRecoveryCandidate()");
check("readable candidate states exact keep/reset outcome", readableCandidate.ok && /Keep settings/.test(readableCandidate.summary) && /Reset logs/.test(readableCandidate.summary) && /Keep training program/.test(readableCandidate.summary));
const readableResult=Readable46.window.eval("performRecoveryCandidate(buildReadableRecoveryCandidate(),{})");
check("readable recovery resets only damaged logs", readableResult.ok && Readable46.window.eval("cfg.goalWt")===175 && Readable46.window.eval("program.name")==="Test Program" && Readable46.window.eval("data.weights.length")===0);
check("readable recovery quarantines the unusable logs verbatim", JSON.parse(Readable46.window.localStorage.getItem("forge:quarantine")).originals.data==="{broken-logs");

// Recovery backup partial semantics + best validated AI source.
const liveProgramForBackup={name:"Readable Live Program",days:[{id:"LP",title:"LP",exercises:[{name:"Row"}]}]};
let BackupRecovery=bootRaw({cfg:"{broken-settings",data:RAW_DATA,program:JSON.stringify(liveProgramForBackup),lkg:recoveryLkgRaw});
const recoveryBackupData={food:{"2026-07-14":[{name:"Backup food",cal:1,pro:1,carb:0,fat:0,meal:"other"}]},workouts:[],weights:[],meta:{lastBackup:null,logsSince:0}};
const backupCandidate=BackupRecovery.window.eval(`prepareRecoveryBackupEnvelope({data:${JSON.stringify(recoveryBackupData)}})`);
check("partial recovery backup uses backup/readable/default sources exactly", backupCandidate.ok && /Use backup logs/.test(backupCandidate.summary) && /Keep readable training program/.test(backupCandidate.summary) && /Reset settings/.test(backupCandidate.summary));
const backupRecoveryResult=BackupRecovery.window.eval(`performRecoveryCandidate(prepareRecoveryBackupEnvelope({data:${JSON.stringify(recoveryBackupData)}}),{})`);
check("partial recovery backup restores data and keeps readable program", backupRecoveryResult.ok && BackupRecovery.window.eval(`data.food["2026-07-14"][0].name`)==="Backup food" && BackupRecovery.window.eval("program.name")==="Readable Live Program");
check("recovery backup preserves AI fields from validated LKG when live cfg is unreadable", BackupRecovery.window.eval("cfg.anthropicKey")==="sk-lkg" && BackupRecovery.window.eval("cfg.aiProvider")==="anthropic");
let RangeRecovery=bootRaw({cfg:"{bad",data:liveDifferentData,program:RAW_PROGRAM,lkg:recoveryLkgRaw});
const recoveryRangeCfg=Object.assign({},EXISTING_CFG,{calLo:1400,calHi:1600,proLo:150,proHi:170}); delete recoveryRangeCfg.calTarget; delete recoveryRangeCfg.proTarget;
const rangeRecoveryCandidate=RangeRecovery.window.eval(`prepareRecoveryBackupEnvelope({cfg:${JSON.stringify(recoveryRangeCfg)}})`);
check("historical range backup prepares through recovery pipeline", rangeRecoveryCandidate.ok && rangeRecoveryCandidate.prepared.state.cfg.calTarget===1500 && rangeRecoveryCandidate.prepared.state.cfg.proTarget===160 && rangeRecoveryCandidate.prepared.state.data.weights[0].lbs===999);
RangeRecovery.__storageCalls.length=0;
const newerRecoveryBackup=RangeRecovery.window.eval(`prepareRecoveryBackupEnvelope({cfg:${JSON.stringify(Object.assign({},V1_CFG,{schemaVersion:99}))}})`);
check("newer backup is refused in recovery mode before any write", !newerRecoveryBackup.ok && newerRecoveryBackup.code==="newer" && sacredCalls(RangeRecovery).length===0 && callsFor(RangeRecovery,"forge:quarantine").length===0);
const invalidRecoveryCandidateResult=RangeRecovery.window.eval(`performRecoveryCandidate({ok:true,raws:{cfg:"{bad",data:${JSON.stringify(RAW_DATA)},program:${JSON.stringify(RAW_PROGRAM)}}},{})`);
check("invalid recovery candidate fails before quarantine or primary writes", invalidRecoveryCandidateResult.code==="prepare" && sacredCalls(RangeRecovery).length===0 && callsFor(RangeRecovery,"forge:quarantine").length===0);

// Quarantine failure blocks all primary writes until raw export fallback is confirmed.
let QFail46=bootRaw({cfg:"{broken",data:RAW_DATA,program:RAW_PROGRAM,lkg:recoveryLkgRaw});
QFail46.__storageCalls.length=0;
const qfBefore=sacredBytes(QFail46), qfProto=Object.getPrototypeOf(QFail46.window.localStorage), qfSpySet=qfProto.setItem;
qfProto.setItem=function(k,v){ if(k==="forge:quarantine") throw new Error("quarantine denied"); return qfSpySet.call(this,k,v); };
const qFailResult=QFail46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{})");
qfProto.setItem=qfSpySet;
check("quarantine write failure causes zero primary recovery writes", qFailResult.code==="quarantine-write" && sameBytes(qfBefore,sacredBytes(QFail46)) && sacredCalls(QFail46).length===0);
let QVerify46=bootRaw({cfg:"{verify-bad",data:RAW_DATA,program:RAW_PROGRAM,lkg:recoveryLkgRaw});
QVerify46.__storageCalls.length=0;
const qvProto=Object.getPrototypeOf(QVerify46.window.localStorage), qvGet=qvProto.getItem;
let qvWritten=false;
const qvSet=qvProto.setItem;
qvProto.setItem=function(k,v){ if(k==="forge:quarantine") qvWritten=true; return qvSet.call(this,k,v); };
qvProto.getItem=function(k){ if(qvWritten && k==="forge:quarantine") return "{mismatch"; return qvGet.call(this,k); };
const qVerifyResult=QVerify46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{})");
qvProto.setItem=qvSet; qvProto.getItem=qvGet;
check("quarantine read-back mismatch blocks all primary writes", qVerifyResult.code==="quarantine-write" && sacredCalls(QVerify46).length===0);
const replaceVerifyOldQ=validQuarantineRaw({cfg:"older",data:"older",program:"older",legacyData:null});
let QReplaceVerify46=bootRaw({cfg:"{replace-verify-bad",data:RAW_DATA,program:RAW_PROGRAM,lkg:recoveryLkgRaw,quarantine:replaceVerifyOldQ});
const qrvProto=Object.getPrototypeOf(QReplaceVerify46.window.localStorage), qrvSet=qrvProto.setItem, qrvGet=qrvProto.getItem;
let qrvWrote=false, qrvMismatch=false;
qrvProto.setItem=function(k,v){ const out=qrvSet.call(this,k,v); if(k==="forge:quarantine") qrvWrote=true; return out; };
qrvProto.getItem=function(k){ if(k==="forge:quarantine" && qrvWrote && !qrvMismatch){ qrvMismatch=true; return "{mismatch"; } return qrvGet.call(this,k); };
const qReplaceVerifyResult=QReplaceVerify46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{replaceExistingQuarantine:true})");
qrvProto.setItem=qrvSet; qrvProto.getItem=qrvGet;
check("failed quarantine replacement restores the previous recovery copy", qReplaceVerifyResult.code==="quarantine-write" && QReplaceVerify46.window.localStorage.getItem("forge:quarantine")===replaceVerifyOldQ && sacredCalls(QReplaceVerify46).length===0);

let RawFallback46=bootRaw({cfg:"{broken-raw",data:RAW_DATA,program:RAW_PROGRAM,lkg:recoveryLkgRaw});
RawFallback46.window.eval(`window.__rawDownload=null; let confirms=[true,true]; window.confirm=()=>confirms.shift(); download=(n,c)=>{window.__rawDownload={n,c};}; exportRawRecoveryOriginals();`);
const rawDownloaded=RawFallback46.window.eval("window.__rawDownload");
const rawEnvelope=JSON.parse(rawDownloaded.c);
check("raw emergency export is distinctly named and round-trips exact strings", /RAW-RECOVERY/.test(rawDownloaded.n) && rawEnvelope.originals.cfg==="{broken-raw" && rawEnvelope.originals.data===RAW_DATA && RawFallback46.window.eval("rawRecoveryExportConfirmed")===true);
const rfProto=Object.getPrototypeOf(RawFallback46.window.localStorage), rfSpySet=rfProto.setItem;
rfProto.setItem=function(k,v){ if(k==="forge:quarantine") throw new Error("quarantine denied"); return rfSpySet.call(this,k,v); };
const rawFallbackResult=RawFallback46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{})");
rfProto.setItem=rfSpySet;
check("confirmed raw export permits explicit quarantine-storage fallback", rawFallbackResult.ok && rawFallbackResult.fallbackExport===true && RawFallback46.window.eval("protectedMode")===false);

// Existing and newer quarantines are never silently replaced.
const differentQ=validQuarantineRaw({cfg:"different",data:"different",program:"different",legacyData:null});
let QConflict46=bootRaw({cfg:"{current-bad",data:RAW_DATA,program:RAW_PROGRAM,lkg:recoveryLkgRaw,quarantine:differentQ});
QConflict46.__storageCalls.length=0;
const conflictResult=QConflict46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{})");
check("different existing quarantine requires explicit replacement", conflictResult.code==="quarantine-conflict" && QConflict46.window.localStorage.getItem("forge:quarantine")===differentQ && sacredCalls(QConflict46).length===0);
const conflictApproved=QConflict46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{replaceExistingQuarantine:true})");
check("explicit replacement quarantines current originals then recovers", conflictApproved.ok && JSON.parse(QConflict46.window.localStorage.getItem("forge:quarantine")).originals.cfg==="{current-bad");
const newerQ=JSON.stringify({recoveryFormatVersion:99,originals:{}});
let QNewer46=bootRaw({cfg:"{newer-q-bad",data:RAW_DATA,program:RAW_PROGRAM,lkg:recoveryLkgRaw,quarantine:newerQ});
QNewer46.__storageCalls.length=0;
const newerQResult=QNewer46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{replaceExistingQuarantine:true})");
check("newer-format quarantine blocks recovery and remains byte-identical", newerQResult.code==="quarantine-newer" && QNewer46.window.localStorage.getItem("forge:quarantine")===newerQ && sacredCalls(QNewer46).length===0);
check("newer-format quarantine cannot be deleted by older app", QNewer46.window.eval("deleteStoredQuarantine().code")==="newer" && QNewer46.window.localStorage.getItem("forge:quarantine")===newerQ);

// Commit and read-back failures remain protected and retain quarantine.
let CommitFail46=bootRaw({cfg:"{commit-bad",data:liveDifferentData,program:RAW_PROGRAM,lkg:recoveryLkgRaw});
const cfProto=Object.getPrototypeOf(CommitFail46.window.localStorage), cfSpySet=cfProto.setItem;
cfProto.setItem=function(k,v){ if(k==="forge:data") throw new Error("primary commit denied"); return cfSpySet.call(this,k,v); };
const commitFailResult=CommitFail46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{})");
cfProto.setItem=cfSpySet;
check("recovery commit failure remains protected and retains quarantine", commitFailResult.code==="commit" && CommitFail46.window.eval("protectedMode")===true && CommitFail46.window.localStorage.getItem("forge:quarantine")!==null);

let RollbackFail46=bootRaw({cfg:"{rollback-bad",data:liveDifferentData,program:RAW_PROGRAM,lkg:recoveryLkgRaw});
const rbProto=Object.getPrototypeOf(RollbackFail46.window.localStorage), rbSpySet=rbProto.setItem;
let rbCfgFailed=false;
rbProto.setItem=function(k,v){
  if(k==="forge:cfg" && !rbCfgFailed){ rbCfgFailed=true; throw new Error("cfg commit denied"); }
  if(rbCfgFailed && (k==="forge:data" || k==="forge:program")) throw new Error("rollback denied");
  return rbSpySet.call(this,k,v);
};
const rollbackFailResult=RollbackFail46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{})");
rbProto.setItem=rbSpySet;
check("recovery rollback failure stays protected with quarantine", rollbackFailResult.code==="commit" && rollbackFailResult.rollbackFailed===true && RollbackFail46.window.eval("protectedMode")===true && RollbackFail46.window.localStorage.getItem("forge:quarantine")!==null);

let ReadbackFail46=bootRaw({cfg:"{readback-bad",data:liveDifferentData,program:RAW_PROGRAM,lkg:recoveryLkgRaw});
const rbfProto=Object.getPrototypeOf(ReadbackFail46.window.localStorage), rbfSpySet=rbfProto.setItem, rbfGet=rbfProto.getItem;
let primaryWasWritten=false, corruptedOnce=false;
rbfProto.setItem=function(k,v){ if(["forge:data","forge:program","forge:cfg"].includes(k)) primaryWasWritten=true; return rbfSpySet.call(this,k,v); };
rbfProto.getItem=function(k){ if(primaryWasWritten && !corruptedOnce && k==="forge:data"){ corruptedOnce=true; return "{readback-corrupt"; } return rbfGet.call(this,k); };
const readbackFailResult=ReadbackFail46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{})");
rbfProto.setItem=rbfSpySet; rbfProto.getItem=rbfGet;
check("read-back validation failure never reports success", readbackFailResult.code==="readback-invalid" && ReadbackFail46.window.eval("protectedMode")===true && ReadbackFail46.window.localStorage.getItem("forge:quarantine")!==null);
const firstIncidentQ=ReadbackFail46.window.localStorage.getItem("forge:quarantine");
const retryAfterReadback=ReadbackFail46.window.eval("performRecoveryCandidate(buildLkgRecoveryCandidate(),{})");
check("same-session retry reuses the first verified quarantine instead of replacing originals", retryAfterReadback.ok && ReadbackFail46.window.localStorage.getItem("forge:quarantine")===firstIncidentQ && JSON.parse(firstIncidentQ).originals.cfg==="{readback-bad");

// Backup/export boundaries and quarantine cleanup.
let Export46=boot(V1_CFG,EMPTY_DATA,null,TEST_PROGRAM);
Export46.window.eval(`window.__normalBackup=null; download=(n,c)=>{window.__normalBackup={n,c};}; doBackup("exportDataBtn");`);
const normalBackupText=Export46.window.eval("window.__normalBackup.c");
check("normal backup contains only primary envelope and no recovery records", !normalBackupText.includes("forge:lkg") && !normalBackupText.includes("forge:quarantine") && !normalBackupText.includes("recoveryFormatVersion"));
Export46.__storageCalls.length=0;
const recoveryRecordRefusal=Export46.window.eval(`restoreBackupEnvelope(${h46LkgRaw})`);
check("normal restore refuses LKG/quarantine record formats", recoveryRecordRefusal.code==="recovery-record" && sacredCalls(Export46).length===0);
const disguisedRecoveryRefusal=Export46.window.eval(`restoreBackupEnvelope(${JSON.stringify({recoveryFormatVersion:1,cfg:V1_CFG,data:EMPTY_DATA,program:TEST_PROGRAM})})`);
check("normal restore rejects a recovery marker even with primary-looking members", disguisedRecoveryRefusal.code==="recovery-record" && sacredCalls(Export46).length===0);
RecoverLkg.__storageCalls.length=0;
RecoverLkg.window.eval(`window.__qExport=null; window.confirm=()=>true; download=(n,c)=>{window.__qExport={n,c};}; exportStoredQuarantine();`);
const qExport=RecoverLkg.window.eval("window.__qExport");
check("quarantine export is distinctly named and preserves exact originals", /RAW-RECOVERY/.test(qExport.n) && JSON.parse(qExport.c).originals.cfg===corruptCfgRaw && sacredCalls(RecoverLkg).length===0 && callsFor(RecoverLkg,"forge:lkg").length===0);
let PartialKeys46=bootRaw({cfg:JSON.stringify(Object.assign({},V1_CFG,{anthropicKey:"sk-secret-a",openaiKey:"sk-secret-o"})),data:"{bad",program:RAW_PROGRAM,lkg:recoveryLkgRaw});
PartialKeys46.window.eval(`window.__partialKeys=null; window.confirm=()=>true; download=(n,c)=>{window.__partialKeys={n,c};}; doBackup("recoveryPartialExportBtn");`);
const partialKeysText=PartialKeys46.window.eval("window.__partialKeys.c");
check("readable partial export still strips both API keys", !partialKeysText.includes("sk-secret-a") && !partialKeysText.includes("sk-secret-o"));
check("device-only LKG may retain API keys while normal exports do not", JSON.parse(recoveryLkgRaw).strings.cfg.includes("sk-lkg") && !normalBackupText.includes("sk-lkg"));
const cleanBefore=fiveBytes(RecoverLkg);
RecoverLkg.window.confirm=()=>false;
RecoverLkg.window.document.getElementById("deleteQuarantineBtn").dispatchEvent(new RecoverLkg.window.Event("click",{bubbles:true}));
check("quarantine delete UI requires explicit confirmation", RecoverLkg.window.localStorage.getItem("forge:quarantine")===cleanBefore.quarantine);
RecoverLkg.window.confirm=()=>true;
RecoverLkg.window.document.getElementById("deleteQuarantineBtn").dispatchEvent(new RecoverLkg.window.Event("click",{bubbles:true}));
const cleanAfter=fiveBytes(RecoverLkg);
check("confirmed quarantine deletion touches neither live state nor LKG", cleanAfter.quarantine===null && samePrimary(cleanBefore,cleanAfter) && cleanBefore.lkg===cleanAfter.lkg);

// Legacy fallback is represented in recovery records and never renamed or modified.
const legacyRaw=JSON.stringify({food:{},workouts:[],weights:[{date:"2026-06-01",lbs:230}],meta:{lastBackup:null,logsSince:0}});
let Legacy46=bootRaw({cfg:RAW_V1_CFG,data:null,legacyData:legacyRaw,program:RAW_PROGRAM});
const legacyLkg=JSON.parse(Legacy46.window.localStorage.getItem("forge:lkg"));
check("LKG records active legacy fallback while keeping primary data missing", legacyLkg.legacyData===legacyRaw && JSON.parse(legacyLkg.strings.data).weights[0].lbs===230 && Legacy46.window.localStorage.getItem("forge:data")===null);
check("healthy boot never modifies legacy fallback key", Legacy46.window.localStorage.getItem("ryan-cut:data")===legacyRaw && !Legacy46.__storageCalls.some(c=>c.key==="ryan-cut:data"));
let LegacyRecover46=bootRaw({cfg:"{legacy-bad",data:null,legacyData:legacyRaw,program:RAW_PROGRAM,lkg:Legacy46.window.localStorage.getItem("forge:lkg")});
const legacyRecoverResult=LegacyRecover46.window.eval("performRecoveryCandidate(buildReadableRecoveryCandidate(),{})");
const legacyQ=JSON.parse(LegacyRecover46.window.localStorage.getItem("forge:quarantine"));
check("recovery quarantine preserves active legacy fallback as evidence", legacyRecoverResult.ok && legacyQ.originals.data===null && legacyQ.originals.legacyData===legacyRaw);
check("recovery writes forge:data but never alters legacy fallback", LegacyRecover46.window.localStorage.getItem("forge:data")!==null && LegacyRecover46.window.localStorage.getItem("ryan-cut:data")===legacyRaw && !LegacyRecover46.__storageCalls.some(c=>c.key==="ryan-cut:data"));

// ================= barcode chain =================
function bootOFF(offResponder, cfgOverrides){
  return boot(Object.assign({}, EXISTING_CFG, cfgOverrides||{}),
    Object.assign({}, EMPTY_DATA, {myFoods:{"111":{name:"Saved thing", brand:"Mine", cal100:100, pro100:10, carb100:5, fat100:2}}}),
    (w)=>{ w.__calls=[]; w.fetch=(url)=>{ w.__calls.push(url);
      if (url.includes("openfoodfacts")) return offResponder(url);
      return Promise.resolve({ok:false,status:500,json:()=>Promise.resolve({})});
    };});
}
async function scan(C, code){ C.window.document.getElementById("barcodeInput").value=code; await C.window.eval("runBarcode()"); await wait(30); }
const yoplaitOFF = {
  code:"0070470343488",
  product_name:"mixed berry",
  brands:"Yoplait Original",
  serving_size:"170.0g",
  serving_quantity:170,
  nutrition_data_per:"100g",
  nutriments:{
    "energy-kcal_100g":82.3529411764706,
    "energy-kcal_serving":140,
    "proteins_100g":5,
    "carbohydrates_100g":28,
    "fat_100g":1.5,
    "proteins":5,
    "carbohydrates":28,
    "fat":1.5
  }
};
let C = bootOFF(()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({status:1,product:yoplaitOFF})}));
await scan(C,"070470343488");
check("v69 OFF v2 barcode lookup selects Yoplait product", C.window.document.getElementById("selName").textContent.includes("mixed berry") && C.window.eval("window.__calls[0]").includes("/api/v2/product/070470343488.json") && !C.window.eval("window.__calls[0]").includes("/api/v3.6/product/"));

const repairedYoplait = C.window.eval("mapOFFProduct("+JSON.stringify(yoplaitOFF)+")");
check("v69 repairs OFF serving macros mislabeled as per 100g", repairedYoplait &&
  Math.abs(repairedYoplait.cal100-82.3529411764706)<0.001 &&
  Math.abs(repairedYoplait.pro100-(5*100/170))<0.001 &&
  Math.abs(repairedYoplait.carb100-(28*100/170))<0.001 &&
  Math.abs(repairedYoplait.fat100-(1.5*100/170))<0.001);

const consistentOFF = {
  product_name:"Consistent Yogurt",
  brands:"Test",
  serving_size:"170g",
  serving_quantity:170,
  nutrition_data_per:"100g",
  nutriments:{
    "energy-kcal_100g":82.35,
    "energy-kcal_serving":140,
    "proteins_100g":2.94,
    "carbohydrates_100g":16.47,
    "fat_100g":0.88,
    "proteins":2.94,
    "carbohydrates":16.47,
    "fat":0.88
  }
};
const unchangedOFF = C.window.eval("mapOFFProduct("+JSON.stringify(consistentOFF)+")");
check("v69 leaves consistent OFF per-100g macros unchanged", unchangedOFF &&
  Math.abs(unchangedOFF.pro100-2.94)<0.001 &&
  Math.abs(unchangedOFF.carb100-16.47)<0.001 &&
  Math.abs(unchangedOFF.fat100-0.88)<0.001);

const mangoOFF = {
  code:"7500462317515",
  product_name:"Frozen Mango",
  brands:"Valle Nuevo",
  serving_size:"1 cup (140 g)",
  serving_quantity:140,
  nutrition_data_per:"100g",
  nutriments:{
    "energy-kcal_100g":8000,
    "energy-kcal_serving":11200,
    "energy-kj_100g":278.571428571429,
    "proteins_100g":0.714285714285714,
    "carbohydrates_100g":15,
    "fat_100g":0
  }
};

check("v70 impossible OFF calories require manual label review without recalculation",
  C.window.eval("offNutritionNeedsManualReview("+JSON.stringify(mangoOFF)+")")===true &&
  C.window.eval("offNutritionNeedsManualReview("+JSON.stringify(consistentOFF)+")")===false &&
  C.window.eval("offNutritionNeedsManualReview("+JSON.stringify(yoplaitOFF)+")")===false);

C = bootOFF(()=>Promise.resolve({
  ok:true,
  status:200,
  json:()=>Promise.resolve({status:1,product:mangoOFF})
}));

await scan(C,"7500462317515");
const dMango70 = C.window.document;

check("v70 corrupt mango nutrition opens manual review instead of selecting bad calories",
  !dMango70.getElementById("customCard").classList.contains("hidden") &&
  /does not make sense/i.test(dMango70.getElementById("searchErr").textContent) &&
  !dMango70.getElementById("searchErr").classList.contains("hidden"));

check("v70 manual review prefills editable product metadata but leaves nutrition blank",
  dMango70.getElementById("cfName").value==="Frozen Mango" &&
  dMango70.getElementById("cfBrand").value==="Valle Nuevo" &&
  dMango70.getElementById("cfBarcode").value==="7500462317515" &&
  dMango70.getElementById("cfServingLabel").value==="1 cup (140 g)" &&
  dMango70.getElementById("cfServG").value==="140" &&
  dMango70.getElementById("cfCal").value==="" &&
  dMango70.getElementById("cfPro").value==="" &&
  dMango70.getElementById("cfCarb").value==="" &&
  dMango70.getElementById("cfFat").value==="" &&
  !dMango70.getElementById("cfName").readOnly &&
  !dMango70.getElementById("cfBrand").readOnly &&
  !dMango70.getElementById("cfBarcode").readOnly &&
  !dMango70.getElementById("cfServingLabel").readOnly &&
  !dMango70.getElementById("cfServG").readOnly);

dMango70.getElementById("cfCal").value="90";
dMango70.getElementById("cfPro").value="1";
dMango70.getElementById("cfCarb").value="22";
dMango70.getElementById("cfFat").value="0";
dMango70.getElementById("cfSaveBtn").dispatchEvent(new C.window.Event("click",{bubbles:true}));

check("v70 confirmed label values save with brand and serving details under the barcode",
  C.window.eval(`(()=>{
    const f=data.myFoods["7500462317515"];
    return !!f &&
      f.name==="Frozen Mango" &&
      f.brand==="Valle Nuevo" &&
      f.servingG===140 &&
      f.servingLabel==="1 cup (140 g)" &&
      Math.abs(f.cal100-(90/140*100))<0.001 &&
      Math.abs(f.pro100-(1/140*100))<0.001 &&
      Math.abs(f.carb100-(22/140*100))<0.001 &&
      f.fat100===0;
  })()`));

C.window.eval("window.__calls.length=0");
await scan(C,"7500462317515");

check("v70 future scans use the saved barcode correction with zero network calls",
  C.window.eval("window.__calls.length")===0 &&
  dMango70.getElementById("selName").textContent.includes("Frozen Mango"));

const AddOnlyBarcode90 = bootOFF(
  ()=>Promise.resolve({
    ok:true,
    status:200,
    json:()=>Promise.resolve({
      status:1,
      product:yoplaitOFF
    })
  })
);

const dAddOnlyBarcode90 =
  AddOnlyBarcode90.window.document;

await scan(
  AddOnlyBarcode90,
  "070470343488"
);

check(
  "v90 online barcode review shows explicit correct and incorrect choices",
  !!dAddOnlyBarcode90
    .getElementById("barcodeConfirmBtn")
  && /Looks correct/.test(
       dAddOnlyBarcode90
         .getElementById(
           "barcodeConfirmBtn"
         )
         .textContent
     )
  && !!dAddOnlyBarcode90
    .getElementById(
      "barcodeCorrectionBtn"
    )
  && /Correct barcode data/.test(
       dAddOnlyBarcode90
         .getElementById(
           "barcodeCorrectionBtn"
         )
         .textContent
     )
  && !!dAddOnlyBarcode90
    .getElementById("addSelBtn")
);

dAddOnlyBarcode90
  .getElementById("addSelBtn")
  .dispatchEvent(
    new AddOnlyBarcode90.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "v90 Add to log does not silently confirm an online barcode",
  AddOnlyBarcode90.window.eval(
    'data.myFoods["070470343488"]===undefined'
  )
);

const ConfirmedBarcode90 = bootOFF(
  ()=>Promise.resolve({
    ok:true,
    status:200,
    json:()=>Promise.resolve({
      status:1,
      product:yoplaitOFF
    })
  })
);

const dConfirmedBarcode90 =
  ConfirmedBarcode90.window.document;

await scan(
  ConfirmedBarcode90,
  "070470343488"
);

dConfirmedBarcode90
  .getElementById("barcodeConfirmBtn")
  .dispatchEvent(
    new ConfirmedBarcode90.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "v90 Looks correct saves reviewed barcode to My Foods",
  ConfirmedBarcode90.window.eval(`
    (()=>{
      const barcode =
        "070470343488";

      const saved =
        data.myFoods[barcode];

      const stored =
        JSON.parse(
          localStorage.getItem(
            "forge:data"
          )
        );

      return (
        !!saved
        && saved.barcode===barcode
        && saved.sourceLabel==="My Foods"
        && !!stored.myFoods[barcode]
        && stored.myFoods[barcode]
             .sourceLabel==="My Foods"
        && selected
        && selected.sourceLabel==="My Foods"
      );
    })()
  `)
);

check(
  "v90 Looks correct hides the online verification warning",
  dConfirmedBarcode90
    .getElementById(
      "barcodeCorrectionReview"
    )
    .classList
    .contains("hidden")
);

ConfirmedBarcode90.window.eval(
  "window.__calls.length=0"
);

dConfirmedBarcode90
  .getElementById("barcodeInput")
  .value =
    "070470343488";

await ConfirmedBarcode90.window.eval(
  "runBarcode()"
);

await wait(30);

check(
  "v90 confirmed barcode rescans from My Foods with zero network calls",
  ConfirmedBarcode90.window.eval(
    "window.__calls.length"
  )===0
  && ConfirmedBarcode90.window.eval(
       "selected.sourceLabel"
     )==="My Foods"
  && dConfirmedBarcode90
       .getElementById(
         "barcodeCorrectionReview"
       )
       .classList
       .contains("hidden")
);

C = bootOFF(()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({})}));
await scan(C,"111");
check("saved barcode short-circuits (zero network)", C.window.eval("window.__calls.length")===0);
let retryAttempts = 0;
C = bootOFF(()=>{
  retryAttempts++;
  if (retryAttempts===1) return Promise.reject(new Error("temporary network failure"));
  return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({status:1,product:yoplaitOFF})});
});
await scan(C,"444");
check("v69 transient OFF failure retries once and succeeds", retryAttempts===2 &&
  C.window.document.getElementById("selName").textContent.includes("mixed berry") &&
  C.window.document.getElementById("customCard").classList.contains("hidden"));

let notFoundAttempts = 0;
C = bootOFF(()=>{
  notFoundAttempts++;
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({})});
});
await scan(C,"333");
check("v81 confirmed OFF 404 does not retry and opens label entry", notFoundAttempts===1 &&
  !C.window.document.getElementById("customCard").classList.contains("hidden") &&
  /not found in Open Food Facts/i.test(C.window.document.getElementById("searchErr").textContent));

let networkAttempts = 0;
C = bootOFF(()=>{
  networkAttempts++;
  return Promise.reject(new Error("offline"));
});
await scan(C,"666");
check("v81 OFF network failure retries once then opens label entry", networkAttempts===2 &&
  !C.window.document.getElementById("customCard").classList.contains("hidden") &&
  /could not be reached/i.test(C.window.document.getElementById("searchErr").textContent));

let unavailableAttempts = 0;
C = bootOFF(()=>{
  unavailableAttempts++;
  return Promise.reject(new Error("OFF unavailable"));
});
await scan(C,"777");
check("v81 unavailable database offers retry and manual label entry", unavailableAttempts===2 &&
  !C.window.document.getElementById("customCard").classList.contains("hidden") &&
  !C.window.document.getElementById("searchErr").classList.contains("hidden") &&
  /could not be reached/i.test(C.window.document.getElementById("searchErr").textContent));

C = bootOFF(()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({status:"success", product:{product_name:"Bad", nutriments:{"energy-kcal_100g":"NaN-city","proteins_100g":-5}}})}));
await scan(C,"555");
check("v81 malformed nutrition opens manual label entry", !C.window.document.getElementById("customCard").classList.contains("hidden") &&
  /does not include usable nutrition/i.test(C.window.document.getElementById("searchErr").textContent));

// ================= v49: training-session integrity =================
const priorWorkout = {date:"2026-07-01",day:"D1",title:"Day 1",sets:{"Bench Press":[{w:100,r:5},{w:100,r:5},{w:100,r:5}]},notes:""};
const T49 = boot(V3_CFG, {food:{},workouts:[priorWorkout],weights:[],meta:{lastBackup:null,logsSince:0}}, null, TEST_PROGRAM);
const dT49 = T49.window.document;
const clickT49 = el=>(typeof el==="string"?dT49.getElementById(el):el).dispatchEvent(new T49.window.Event("click",{bubbles:true}));
const plannedRows = [...dT49.querySelectorAll("#exerciseInputs .srow")];
check("previous workout values prefill as a plan awaiting Save Exercise", plannedRows.length===3 && dT49.querySelectorAll("#exerciseInputs .sdone").length===0 && !!dT49.querySelector("#exerciseInputs .saveExBtn") && plannedRows[0].querySelector('input[data-field="weight"]').value==="105");
clickT49("logWorkoutBtn");
check("untouched prefilled workout cannot create history", T49.window.eval("data.workouts.length")===1);
check("empty workout attempt explains the Save Exercise requirement", !dT49.getElementById("workoutErr").classList.contains("hidden") && /Nothing saved yet.*Save Exercise/.test(dT49.getElementById("workoutErr").textContent));
const w49 = plannedRows[0].querySelector('input[data-field="weight"]');
w49.value="105"; w49.dispatchEvent(new T49.window.Event("input",{bubbles:true}));
const chip49 = dT49.querySelector("#exerciseInputs .unsavedChip");
check("editing a value marks the exercise Unsaved", T49.window.eval(`sessionState["Bench Press"].status`)==="unsaved" && !!chip49 && chip49.style.display!=="none" && /unsaved/i.test(chip49.textContent));
clickT49(dT49.querySelector("#exerciseInputs .saveExBtn"));
check("Save Exercise validates and saves only the entered set", T49.window.eval(`sessionState["Bench Press"].status==="saved" && sessionState["Bench Press"].saved.length===1 && sessionState["Bench Press"].saved[0].w===105`));
check(
  "saved partial exercise still shows Completed with an Edit option",
  /Completed/.test(
    dT49.querySelector("#exerciseInputs .savedChip").textContent
  )
  && [...dT49.querySelectorAll("#exerciseInputs .xbtn")]
       .some(button=>button.textContent==="Edit")
);

clickT49("logWorkoutBtn");

check(
  "partially saved programmed exercise cannot silently drop the remaining sets",
  T49.window.eval("data.workouts.length")===1
  && /Resolve the remaining planned sets.*Bench Press/.test(
       dT49.getElementById("workoutErr").textContent
     )
);

const edit49=
  [...dT49.querySelectorAll("#exerciseInputs .xbtn")]
    .find(button=>button.textContent==="Edit");

clickT49(edit49);

clickT49(
  dT49.querySelector(
    '[data-exercise="Bench Press"][data-set-action="skip-remaining"]'
  )
);

clickT49(
  dT49.querySelector("#exerciseInputs .saveExBtn")
);

check(
  "remaining programmed sets can be explicitly skipped before logging",
  T49.window.eval(`
    sessionState["Bench Press"].status==="saved"
    && sessionState["Bench Press"].saved.length===3
    && sessionState["Bench Press"].saved[0].w===105
    && sessionState["Bench Press"].saved[0].r===5
    && sessionState["Bench Press"].saved[1].status==="skipped"
    && sessionState["Bench Press"].saved[2].status==="skipped"
  `)
);

clickT49("logWorkoutBtn");

check(
  "resolved workout logs completed and skipped programmed sets",
  T49.window.eval(`
    data.workouts.length===2
    && data.workouts[1].sets["Bench Press"].length===3
    && data.workouts[1].sets["Bench Press"][0].w===105
    && data.workouts[1].sets["Bench Press"][1].status==="skipped"
    && data.workouts[1].sets["Bench Press"][2].status==="skipped"
  `)
);

check(
  "incomplete prescription cannot trigger progression and outcomes do not carry forward",
  T49.window.eval(`
    sessionState["Bench Press"].auto===false
    && sessionState["Bench Press"].rows.length===3
    && sessionState["Bench Press"].rows[0].w===105
    && sessionState["Bench Press"].rows.every(
         row=>
           row.prescribed===true
           && !row.status
       )
  `)
);

const T49Invalid = boot(V3_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT49Invalid = T49Invalid.window.document;
const rIn49 = dT49Invalid.querySelector('#exerciseInputs input[data-field="reps"]');
rIn49.value="5"; rIn49.dispatchEvent(new T49Invalid.window.Event("input",{bubbles:true}));
dT49Invalid.querySelector("#exerciseInputs .saveExBtn").dispatchEvent(new T49Invalid.window.Event("click",{bubbles:true}));
check("entered set missing weight is refused by Save Exercise", T49Invalid.window.eval(`sessionState["Bench Press"].status`)!=="saved");
check("invalid entered set identifies the missing weight/reps row", /Bench Press.*weight and reps.*Set 1/.test(dT49Invalid.getElementById("workoutErr").textContent));
T49Invalid.window.confirm=()=>true; // choose "Save valid & log" — the invalid row must still block the log
dT49Invalid.getElementById("logWorkoutBtn").dispatchEvent(new T49Invalid.window.Event("click",{bubbles:true}));
check("log with only invalid unsaved work saves nothing", T49Invalid.window.eval("data.workouts.length")===0);
T49Invalid.window.confirm=()=>true;
dT49Invalid.getElementById("wDay").value="__CARDIO__";
dT49Invalid.getElementById("wDay").dispatchEvent(new T49Invalid.window.Event("change",{bubbles:true}));
dT49Invalid.getElementById("logWorkoutBtn").dispatchEvent(new T49Invalid.window.Event("click",{bubbles:true}));
check("cardio without minutes is refused with an explanation", T49Invalid.window.eval("data.workouts.length")===0 && /Enter cardio minutes/.test(dT49Invalid.getElementById("workoutErr").textContent));

const T49Switch = boot(V3_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT49Switch = T49Switch.window.document;
const touchedWeight = dT49Switch.querySelector('#exerciseInputs input[data-field="weight"]');
touchedWeight.value="135";
touchedWeight.dispatchEvent(new T49Switch.window.Event("input",{bubbles:true}));
let switchPrompts=0;
T49Switch.window.confirm=()=>{ switchPrompts++; return false; };
dT49Switch.getElementById("wDay").value="__CARDIO__";
dT49Switch.getElementById("wDay").dispatchEvent(new T49Switch.window.Event("change",{bubbles:true}));
check("canceling session-type change keeps the current workout and entered value", switchPrompts===1 && dT49Switch.getElementById("wDay").value==="D1" && T49Switch.window.eval(`sessionState["Bench Press"].rows[0].w`)===135);
T49Switch.window.confirm=()=>true;
dT49Switch.getElementById("wDay").value="__CARDIO__";
dT49Switch.getElementById("wDay").dispatchEvent(new T49Switch.window.Event("change",{bubbles:true}));
check("confirming session-type change discards the in-progress draft only", dT49Switch.getElementById("wDay").value==="__CARDIO__" && T49Switch.window.eval("Object.keys(sessionState).length")===0 && T49Switch.window.eval("data.workouts.length")===0);

// ================= v50: daily navigation + mobile consistency =================
const T50 = boot(V3_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT50 = T50.window.document;
const workChildren = [...dT50.getElementById("view-work").children];
const identityPos = workChildren.indexOf(dT50.getElementById("programIdentityCard"));
const programPos = workChildren.indexOf(dT50.getElementById("programToolsCard"));
const sessionPos = workChildren.indexOf(dT50.getElementById("trainingSessionCard"));
const toolsPos = workChildren.indexOf(dT50.getElementById("trainingToolsCard"));
check("Train opens with compact program identity first and the daily session ahead of utility tools", identityPos===0 && identityPos<programPos && programPos<sessionPos && sessionPos<toolsPos);
check("program administration is a separate hidden panel by default", dT50.getElementById("programToolsCard").tagName==="DIV" && dT50.getElementById("programToolsCard").classList.contains("hidden") && dT50.getElementById("programManageBtn").getAttribute("aria-expanded")==="false");

let topScroll=null;
T50.window.scrollTo=(x,y)=>{ topScroll={x,y}; };
dT50.querySelector('.tab[data-view="food"]').dispatchEvent(new T50.window.Event("click",{bubbles:true}));
await wait(30);
check("ordinary tab changes open the selected page at the top", dT50.getElementById("view-food").classList.contains("active") && topScroll && topScroll.x===0 && topScroll.y===0);

T50.window.HTMLElement.prototype.scrollIntoView=function(opts){ T50.window.__v50Target={id:this.id, block:opts&&opts.block}; };
dT50.getElementById("nextWorkoutBtn").dispatchEvent(new T50.window.Event("click",{bubbles:true}));
await wait(30);
check("Start next selects the next program day and lands at the session", dT50.getElementById("view-work").classList.contains("active") && dT50.getElementById("wDay").value==="D1" && T50.window.eval("window.__v50Target && window.__v50Target.id")==="trainingSessionCard" && T50.window.eval("window.__v50Target && window.__v50Target.block")==="start");

T50.window.eval("openBuilder(false)");
const editableControls=[...dT50.querySelectorAll('input:not([type="hidden"]), select, textarea')];
check("all static and dynamically rendered editable controls use at least 16px text", editableControls.length>80 && editableControls.every(el=>parseFloat(T50.window.getComputedStyle(el).fontSize)>=16));
const stepTarget=dT50.querySelector("#exerciseInputs .step");
const saveTarget=dT50.querySelector("#exerciseInputs .saveExBtn");
check("workout step controls have 44px touch targets", !!stepTarget && T50.window.getComputedStyle(stepTarget).width==="44px" && T50.window.getComputedStyle(stepTarget).height==="44px");
check("workout completion controls have 44px touch targets", !!saveTarget && T50.window.getComputedStyle(saveTarget).minHeight==="44px");

// ================= v51: exercise-level completion =================
const T51 = boot(V3_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT51 = T51.window.document;
const clickT51 = el=>(typeof el==="string"?dT51.getElementById(el):el).dispatchEvent(new T51.window.Event("click",{bubbles:true}));
function enterSet51(dom, dd, w, r){
  const wIn = dd.querySelector('#exerciseInputs input[data-field="weight"]');
  const rIn = dd.querySelector('#exerciseInputs input[data-field="reps"]');
  wIn.value=String(w); wIn.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
  rIn.value=String(r); rIn.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
}
enterSet51(T51, dT51, 135, 5);
clickT51(dT51.querySelector("#exerciseInputs .saveExBtn"));
check("v51 save: exercise saves and collapses to Completed", T51.window.eval(`sessionState["Bench Press"].status`)==="saved" && /Completed/.test(dT51.querySelector("#exerciseInputs .savedChip").textContent));
const editBtn51 = [...dT51.querySelectorAll("#exerciseInputs .xbtn")].find(b=>b.textContent==="Edit");
clickT51(editBtn51);
check("v51 edit: Edit reopens the rows and marks the exercise Unsaved", T51.window.eval(`sessionState["Bench Press"].status`)==="unsaved" && dT51.querySelector('#exerciseInputs input[data-field="weight"]').value==="135");
// logging with exactly ONE unsaved exercise must warn, listing it by name
let confirm51Msgs = [];
T51.window.confirm = (m)=>{ confirm51Msgs.push(m); return false; }; // Review exercises
clickT51("logWorkoutBtn");
check("v51 warning: even one unsaved exercise triggers the warning, by name", confirm51Msgs.length===1 && /Bench Press/.test(confirm51Msgs[0]) && /Save valid exercises & log session/.test(confirm51Msgs[0]) && /Review exercises/.test(confirm51Msgs[0]));
check("v51 review path: choosing Review logs nothing and explains next steps", T51.window.eval("data.workouts.length")===0 && /Review the unsaved exercise/.test(dT51.getElementById("workoutErr").textContent));
T51.window.confirm = (m)=>{
  confirm51Msgs.push(m);
  return true;
};

clickT51("logWorkoutBtn");

check(
  "v51 save-and-log path saves valid work but blocks unresolved programmed sets",
  T51.window.eval(`
    data.workouts.length===0
    && sessionState["Bench Press"].status==="saved"
    && sessionState["Bench Press"].saved.length===1
    && sessionState["Bench Press"].saved[0].w===135
  `)
  && /Resolve the remaining planned sets.*Bench Press/.test(
       dT51.getElementById("workoutErr").textContent
     )
);

const resolveEdit51=
  [...dT51.querySelectorAll("#exerciseInputs .xbtn")]
    .find(button=>button.textContent==="Edit");

clickT51(resolveEdit51);

clickT51(
  dT51.querySelector(
    '[data-exercise="Bench Press"][data-set-action="skip-remaining"]'
  )
);

clickT51(
  dT51.querySelector("#exerciseInputs .saveExBtn")
);

clickT51("logWorkoutBtn");

check(
  "v51 resolved programmed outcomes log without dropping work",
  T51.window.eval(`
    data.workouts.length===1
    && data.workouts[0].sets["Bench Press"].length===3
    && data.workouts[0].sets["Bench Press"][0].w===135
    && data.workouts[0].sets["Bench Press"][1].status==="skipped"
    && data.workouts[0].sets["Bench Press"][2].status==="skipped"
  `)
);

// leaving Train with unsaved work warns; canceling stays
const T51b = boot(V3_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT51b = T51b.window.document;
dT51b.querySelector('.tab[data-view="work"]').dispatchEvent(new T51b.window.Event("click",{bubbles:true}));
enterSet51(T51b, dT51b, 95, 8);
let leavePrompts = 0;
T51b.window.confirm = ()=>{ leavePrompts++; return false; };
dT51b.querySelector('.tab[data-view="food"]').dispatchEvent(new T51b.window.Event("click",{bubbles:true}));
check("v51 leave-Train warning: canceling keeps you on Train with the work intact", leavePrompts===1 && dT51b.getElementById("view-work").classList.contains("active") && T51b.window.eval(`sessionState["Bench Press"].rows[0].w`)===95);
T51b.window.confirm = ()=>true;
dT51b.querySelector('.tab[data-view="food"]').dispatchEvent(new T51b.window.Event("click",{bubbles:true}));
check("v51 leave-Train warning: confirming leaves (entries remain in memory)", dT51b.getElementById("view-food").classList.contains("active") && T51b.window.eval(`sessionState["Bench Press"].rows[0].w`)===95);

dT51b.querySelector('.tab[data-view="work"]').dispatchEvent(new T51b.window.Event("click",{bubbles:true}));

check(
  "v90-16 entered workout values remain visible after leaving and returning to Train",
  dT51b.querySelector(
    '#exerciseInputs input[data-field="weight"]'
  ).value==="95"
  && T51b.window.eval(`
       sessionState["Bench Press"].rows[0].w===95
     `)
);

const T9016 = boot(V3_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT9016 = T9016.window.document;

dT9016.querySelector(
  '.tab[data-view="work"]'
).dispatchEvent(
  new T9016.window.Event(
    "click",
    {bubbles:true}
  )
);

const clearedWeight9016=
  dT9016.querySelector(
    '#exerciseInputs input[data-field="weight"]'
  );

const plannedReps9016=
  dT9016.querySelector(
    '#exerciseInputs input[data-field="reps"]'
  );

clearedWeight9016.value="95";
clearedWeight9016.dispatchEvent(
  new T9016.window.Event(
    "input",
    {bubbles:true}
  )
);

clearedWeight9016.value="";
clearedWeight9016.dispatchEvent(
  new T9016.window.Event(
    "input",
    {bubbles:true}
  )
);

let emptyLeavePrompts9016=0;

T9016.window.confirm=()=>{
  emptyLeavePrompts9016+=1;
  return false;
};

dT9016.querySelector(
  '.tab[data-view="food"]'
).dispatchEvent(
  new T9016.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v90-16 clearing the only user-entered value leaves no false unfinished exercise",
  plannedReps9016.value==="5"
  && emptyLeavePrompts9016===0
  && dT9016
       .getElementById("view-food")
       .classList.contains("active")
  && T9016.window.eval(`
       sessionState["Bench Press"].rows[0].w===""
       && sessionState["Bench Press"].rows[0].r===5
       && sessionState["Bench Press"].rows[0].touched===false
       && unsavedExerciseNames().length===0
     `)
);

// saved-but-unlogged work also counts as meaningful for session-type switching
const T51c = boot(V3_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT51c = T51c.window.document;
enterSet51(T51c, dT51c, 115, 5);
dT51c.querySelector("#exerciseInputs .saveExBtn").dispatchEvent(new T51c.window.Event("click",{bubbles:true}));
let switch51 = 0;
T51c.window.confirm = ()=>{ switch51++; return false; };
dT51c.getElementById("wDay").value="__CARDIO__";
dT51c.getElementById("wDay").dispatchEvent(new T51c.window.Event("change",{bubbles:true}));
check("v51 saved-but-unlogged work still guards session-type switching", switch51===1 && dT51c.getElementById("wDay").value==="D1");

// ================= v51: food-flow improvements =================
const F51 = boot(V3_CFG, EMPTY_DATA);
const dF51 = F51.window.document;
F51.window.eval(`currentMeal="lunch"; renderMealSeg();`);
F51.window.eval(`addEntry({name:"Chicken", cal:165, pro:31, carb:0, fat:3.6, meal:"lunch"});`);
F51.window.eval(`addEntry({name:"Chicken", cal:165, pro:31, carb:0, fat:3.6, meal:"lunch"});`);
check("v51 duplicate guard: an identical rapid re-add is swallowed", F51.window.eval("data.food[todayStr()].length")===1);
F51.window.eval(`addEntry({name:"Rice", cal:260, pro:5, carb:57, fat:1, meal:"lunch"});`);
check("v51 duplicate guard: different foods add normally", F51.window.eval("data.food[todayStr()].length")===2);
F51.window.eval(`_lastAddT = 0; addEntry({name:"Chicken", cal:165, pro:31, carb:0, fat:3.6, meal:"lunch"});`);
check("v51 duplicate guard: the same food later is honest logging, not a duplicate", F51.window.eval("data.food[todayStr()].length")===3);
check("v51 meal selection preserved through adds", F51.window.eval("currentMeal")==="lunch");
// deletion with Undo
F51.window.eval(`removeEntry(0)`);
check("v51 undo: deletion removes the entry, offers Undo, and reserves bottom interaction space",
  F51.window.eval("data.food[todayStr()].length")===2
  && !dF51.getElementById("undoToast").classList.contains("hidden")
  && dF51.body.classList.contains("undo-toast-visible")
  && /Deleted "Chicken"/.test(dF51.getElementById("undoMsg").textContent));

dF51.getElementById("undoBtn").dispatchEvent(
  new F51.window.Event("click",{bubbles:true})
);

check("v51 undo: tapping Undo restores the entry and releases its reserved space",
  F51.window.eval(`data.food[todayStr()].length===3 && data.food[todayStr()][0].name==="Chicken"`)
  && dF51.getElementById("undoToast").classList.contains("hidden")
  && !dF51.body.classList.contains("undo-toast-visible"));
// search results still reveal normally, but logging itself preserves position.
F51.window.HTMLElement.prototype.scrollIntoView = function(opts){ F51.window.__f51 = {id:this.id, className:this.className, block:opts&&opts.block}; };
F51.window.eval(`renderResults([{name:"Test Food", brand:"B", cal100:100, pro100:10, carb100:5, fat100:2}]);`);
check("v51 search results scroll into view beside the field", F51.window.eval("window.__f51 && window.__f51.id")==="resultsCard");
dF51.querySelector("#results .result").dispatchEvent(new F51.window.Event("click",{bubbles:true}));
await wait(10);
F51.window.eval(`window.__f51=null;`);
dF51.getElementById("addSelBtn").dispatchEvent(new F51.window.Event("click",{bubbles:true}));
check("v90 logging from search preserves position and offers explicit follow-up actions",
  F51.window.eval("window.__f51")===null
  && F51.window.eval("data.food[todayStr()].length")===4
  && !dF51.getElementById("foodAddConfirmationPanel").classList.contains("hidden")
  && dF51.getElementById("foodAddUndoBtn").textContent==="Undo"
  && dF51.getElementById("foodAddViewBtn").textContent==="View entry");
check("v51 handoff behavior untouched by food changes", !!dF51.getElementById("hfPasteBtn"));


// ================= editable slider portions + stable usual-meal identity =================
const FoodEdit = boot(V3_CFG, EMPTY_DATA);
const dFoodEdit = FoodEdit.window.document;
const clickFoodEdit = id=>dFoodEdit.getElementById(id).dispatchEvent(new FoodEdit.window.Event("click",{bubbles:true}));
FoodEdit.window.eval(`
  currentMeal="breakfast"; renderMealSeg();
  selectFood({name:"Greek yogurt",brand:"Test brand",cal100:60,pro100:10,carb100:4,fat100:0.5,servingG:170,servingLabel:"170g cup"});
  qtyUnitEl.value="g"; qtyAmountEl.value=150; syncSliderToUnit(); updateCalc();
`);
clickFoodEdit("addSelBtn");
check("slider-added foods preserve the source nutrition and original amount needed for editing",
  FoodEdit.window.eval(`
    (function(){
      const f=data.food[todayStr()][0];
      return f.amount===150 && f.unit==="g" && f.grams===150
        && f.foodKey==="food:greek yogurt|test brand"
        && f.sourceFood && f.sourceFood.name==="Greek yogurt"
        && f.sourceFood.cal100===60 && f.sourceFood.servingG===170;
    })()
  `));
FoodEdit.window.eval(`startEditEntry(0)`);
check("editing a slider-added food reopens the amount slider instead of the manual form",
  !dFoodEdit.getElementById("calcCard").classList.contains("hidden")
  && dFoodEdit.getElementById("addSelBtn").textContent==="Update entry"
  && dFoodEdit.getElementById("qtyUnit").value==="g"
  && Number(dFoodEdit.getElementById("qtyAmount").value)===150
  && dFoodEdit.getElementById("mName").value==="");
dFoodEdit.getElementById("qtyAmount").value="200";
dFoodEdit.getElementById("qtyAmount").dispatchEvent(new FoodEdit.window.Event("input",{bubbles:true}));
clickFoodEdit("addSelBtn");
check("slider editing updates the existing row and recalculates nutrition without adding another log",
  FoodEdit.window.eval(`
    (function(){
      const f=data.food[todayStr()][0];
      return data.food[todayStr()].length===1 && f.name==="200g Greek yogurt"
        && f.cal===120 && f.pro===20 && f.meal==="breakfast"
        && data.foodCounts["Greek yogurt|Test brand"]===1
        && data.recents[0].lastAmt==="200" && data.recents[0].lastUnit==="g";
    })()
  `));
FoodEdit.window.eval(`_lastAddT=0; addEntry({name:"125g Greek yogurt",cal:75,pro:13,carb:5,fat:1,meal:"breakfast"}); startEditEntry(1);`);
check("pre-update slider logs can be reconstructed from Recent foods and reopen in the slider",
  dFoodEdit.getElementById("addSelBtn").textContent==="Update entry"
  && dFoodEdit.getElementById("qtyUnit").value==="g"
  && Number(dFoodEdit.getElementById("qtyAmount").value)===125);
clickFoodEdit("cancelSelEditBtn");
FoodEdit.window.eval(`_lastAddT=0; addEntry({name:"Homemade casserole",cal:400,pro:25,carb:35,fat:18,meal:"breakfast"}); startEditEntry(2);`);
check("legacy and manually entered foods still open the manual editor",
  dFoodEdit.getElementById("mName").value==="Homemade casserole"
  && dFoodEdit.getElementById("addManualBtn").textContent==="Update entry"
  && dFoodEdit.getElementById("cancelSelEditBtn").classList.contains("hidden"));

const usualFood = {};
for(let i=1;i<=5;i++){
  usualFood[dstr(-i)] = [
    {
      name:i===1
        ? "Friendly Farms Plain Non Fat Greek Yogurt"
        : "NONFAT GREEK YOGURT",
      cal:i===1?110:90, pro:i===1?19:15, carb:7, fat:1, meal:"breakfast"
    },
    {
      name:i%2 ? "2 Eggs" : "3 Eggs",
      cal:140, pro:12, carb:1, fat:10, meal:"breakfast"
    },
    {
      name:i===1 ? "8oz Grilled Chicken Breast" : "6oz Chicken Breast",
      cal:i===1?360:280, pro:i===1?62:50, carb:0, fat:8, meal:"lunch"
    },
    {
      name:i%2 ? "1 serving · Brown Rice" : "200g Brown Rice",
      cal:i===1?220:210, pro:5, carb:45, fat:2, meal:"dinner"
    },
    {
      name:i===1 ? "Vanilla Protein Shake" : "Chocolate Protein Shake",
      cal:i===1?230:210, pro:i===1?32:30, carb:12, fat:5, meal:"snacks"
    }
  ];
}
Object.assign(usualFood[dstr(-1)][0],{
  amount:1.5,
  unit:"serving",
  grams:255,
  foodKey:"food:friendly farms plain non fat greek yogurt|friendly farms",
  sourceFood:{
    name:"Friendly Farms Plain Non Fat Greek Yogurt",
    brand:"Friendly Farms",
    cal100:43.137,
    pro100:7.451,
    carb100:2.745,
    fat100:0.392,
    servingG:170,
    servingLabel:"170g cup"
  }
});

const UsualIdentity = boot(V3_CFG,Object.assign({},EMPTY_DATA,{food:usualFood}));
const dUsualIdentity = UsualIdentity.window.document;

UsualIdentity.window.eval(`currentMeal="breakfast"; renderMealSeg(); renderFood();`);
check("usual breakfast groups quantity, capitalization, and product-name variants while preserving the latest exact yogurt",
  UsualIdentity.window.eval(`
    (function(){
      const items=usualFor("breakfast");
      const yogurt=items.find(x=>/Friendly Farms/.test(x.name));
      return items.length===2 && yogurt
        && yogurt.name==="Friendly Farms Plain Non Fat Greek Yogurt"
        && yogurt.cal===110 && yogurt.pro===19;
    })()
  `));

const usualBreakfastButtons = [...dUsualIdentity.querySelectorAll("#usualItems .usual-item-add")];
const usualYogurtButton = usualBreakfastButtons.find(button=>/Friendly Farms/.test(button.getAttribute("aria-label")||""));
const usualEggButton = usualBreakfastButtons.find(button=>/Eggs/.test(button.getAttribute("aria-label")||""));
check("usual breakfast keeps foods grouped while exposing an Add action for each item and Add all",
  usualBreakfastButtons.length===2
  && usualYogurtButton && usualEggButton
  && usualYogurtButton.textContent==="Add"
  && usualEggButton.textContent==="Add"
  && /^Add all \(2 items\)$/.test(dUsualIdentity.getElementById("usualLogBtn").textContent));

UsualIdentity.window.eval(`_lastAddT=0;`);
usualYogurtButton.dispatchEvent(new UsualIdentity.window.Event("click",{bubbles:true}));
check("usual breakfast individual Add logs only the selected food and marks it Added",
  UsualIdentity.window.eval(`(data.food[todayStr()]||[]).length`)===1
  && !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && [...dUsualIdentity.querySelectorAll("#usualItems .usual-item-add")].some(button=>
    /Friendly Farms/.test(button.getAttribute("aria-label")||"")
    && button.textContent==="Added"
    && button.disabled
  )
  && [...dUsualIdentity.querySelectorAll("#usualItems .usual-item-add")].some(button=>
    /Eggs/.test(button.getAttribute("aria-label")||"")
    && button.textContent==="Add"
    && !button.disabled
  )
  && /^Add all remaining \(1 item\)$/.test(dUsualIdentity.getElementById("usualLogBtn").textContent));

check("usual breakfast individual Add preserves nutrition, portion, grams, source metadata, and slider identity",
  UsualIdentity.window.eval(`
    (function(){
      const f=(data.food[todayStr()]||[])[0];
      const edit=sliderEditDetails(f);
      return f.name==="Friendly Farms Plain Non Fat Greek Yogurt"
        && f.cal===110 && f.pro===19 && f.carb===7 && f.fat===1
        && f.amount===1.5 && f.unit==="serving" && f.grams===255
        && f.foodKey==="food:friendly farms plain non fat greek yogurt|friendly farms"
        && f.sourceFood
        && f.sourceFood.name==="Friendly Farms Plain Non Fat Greek Yogurt"
        && f.sourceFood.brand==="Friendly Farms"
        && f.sourceFood.servingG===170
        && f.sourceFood.servingLabel==="170g cup"
        && edit
        && edit.source
        && edit.source.name==="Friendly Farms Plain Non Fat Greek Yogurt"
        && edit.amount===1.5
        && edit.unit==="serving";
    })()
  `));

UsualIdentity.window.eval(`
  window.__usualEditScrollCalls=0;
  document.getElementById("calcCard").scrollIntoView=()=>{
    window.__usualEditScrollCalls++;
  };
`);

dUsualIdentity.querySelector("#foodList .edt").dispatchEvent(
  new UsualIdentity.window.Event("click",{bubbles:true})
);

await wait(10);

check("usual slider-food pencil visibly moves the screen to the slider editor",
  UsualIdentity.window.eval(`window.__usualEditScrollCalls`)>=2
  && !dUsualIdentity.getElementById("calcCard").classList.contains("hidden")
  && dUsualIdentity.getElementById("addSelBtn").textContent==="Update entry"
  && Number(dUsualIdentity.getElementById("qtyAmount").value)===1.5
  && dUsualIdentity.getElementById("qtyUnit").value==="serving");

dUsualIdentity.getElementById("cancelSelEditBtn").dispatchEvent(
  new UsualIdentity.window.Event("click",{bubbles:true})
);

check("usual breakfast duplicate prevention rejects an already-added recurring food",
  UsualIdentity.window.eval(`
    (function(){
      const yogurt=usualFor("breakfast").find(
        item=>/Friendly Farms/.test(item.name)
      );
      const before=(data.food[todayStr()]||[]).length;
      const result=addUsualFood(yogurt,"breakfast");
      return result===false
        && (data.food[todayStr()]||[]).length===before;
    })()
  `));

dUsualIdentity.getElementById("usualLogBtn")
  .dispatchEvent(new UsualIdentity.window.Event("click",{bubbles:true}));
check("usual breakfast Add all after a partial addition logs only the remaining item",
  UsualIdentity.window.eval(`
    (function(){
      const foods=data.food[todayStr()]||[];
      return foods.length===2
        && foods.filter(f=>/Friendly Farms/.test(f.name)).length===1
        && foods.filter(f=>/Eggs/.test(f.name)).length===1;
    })()
  `));
check("usual breakfast shows every food Added and disables Add all when complete",
  !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && [...dUsualIdentity.querySelectorAll("#usualItems .usual-item-add")].length===2
  && [...dUsualIdentity.querySelectorAll("#usualItems .usual-item-add")].every(
    button=>button.textContent==="Added" && button.disabled
  )
  && dUsualIdentity.getElementById("usualLogBtn").textContent==="All added"
  && dUsualIdentity.getElementById("usualLogBtn").disabled);

UsualIdentity.window.eval(`currentMeal="lunch"; renderMealSeg(); renderFood();`);
check("usual lunch is independent and preserves the latest exact chicken portion and nutrition",
  UsualIdentity.window.eval(`
    (function(){
      const items=usualFor("lunch");
      return items.length===1
        && items[0].name==="8oz Grilled Chicken Breast"
        && items[0].cal===360 && items[0].pro===62;
    })()
  `)
  && !dUsualIdentity.getElementById("usualCard").classList.contains("hidden"));

UsualIdentity.window.eval(`_lastAddT=0;`);
dUsualIdentity.querySelector("#usualItems .usual-item-add")
  .dispatchEvent(new UsualIdentity.window.Event("click",{bubbles:true}));
check("usual lunch individual Add preserves its latest exact portion and Added state",
  UsualIdentity.window.eval(`
    (function(){
      const foods=(data.food[todayStr()]||[]).filter(f=>f.meal==="lunch");
      return foods.length===1
        && foods[0].name==="8oz Grilled Chicken Breast"
        && foods[0].cal===360 && foods[0].pro===62;
    })()
  `)
  && !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && dUsualIdentity.querySelector("#usualItems .usual-item-add").textContent==="Added"
  && dUsualIdentity.querySelector("#usualItems .usual-item-add").disabled
  && dUsualIdentity.getElementById("usualLogBtn").textContent==="All added"
  && dUsualIdentity.getElementById("usualLogBtn").disabled);

UsualIdentity.window.eval(`currentMeal="dinner"; renderMealSeg(); renderFood();`);
check("usual dinner independently recognizes changed quantity prefixes and keeps the latest exact portion",
  UsualIdentity.window.eval(`
    (function(){
      const items=usualFor("dinner");
      return items.length===1
        && items[0].name==="1 serving · Brown Rice"
        && items[0].cal===220;
    })()
  `)
  && !dUsualIdentity.getElementById("usualCard").classList.contains("hidden"));

UsualIdentity.window.eval(`_lastAddT=0;`);
dUsualIdentity.querySelector("#usualItems .usual-item-add")
  .dispatchEvent(new UsualIdentity.window.Event("click",{bubbles:true}));
check("usual dinner individual Add preserves its latest exact portion and Added state",
  UsualIdentity.window.eval(`
    (function(){
      const foods=(data.food[todayStr()]||[]).filter(f=>f.meal==="dinner");
      return foods.length===1
        && foods[0].name==="1 serving · Brown Rice"
        && foods[0].cal===220;
    })()
  `)
  && !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && dUsualIdentity.querySelector("#usualItems .usual-item-add").textContent==="Added"
  && dUsualIdentity.querySelector("#usualItems .usual-item-add").disabled
  && dUsualIdentity.getElementById("usualLogBtn").textContent==="All added"
  && dUsualIdentity.getElementById("usualLogBtn").disabled);

UsualIdentity.window.eval(`currentMeal="snacks"; renderMealSeg(); renderFood();`);
check("usual snacks independently groups clear flavor variants and preserves the latest exact product nutrition",
  UsualIdentity.window.eval(`
    (function(){
      const items=usualFor("snacks");
      return items.length===1
        && items[0].name==="Vanilla Protein Shake"
        && items[0].cal===230 && items[0].pro===32;
    })()
  `)
  && !dUsualIdentity.getElementById("usualCard").classList.contains("hidden"));

UsualIdentity.window.eval(`_lastAddT=0;`);
dUsualIdentity.querySelector("#usualItems .usual-item-add")
  .dispatchEvent(new UsualIdentity.window.Event("click",{bubbles:true}));
check("usual snacks individual Add preserves its latest exact product and Added state",
  UsualIdentity.window.eval(`
    (function(){
      const foods=(data.food[todayStr()]||[]).filter(f=>f.meal==="snacks");
      return foods.length===1
        && foods[0].name==="Vanilla Protein Shake"
        && foods[0].cal===230 && foods[0].pro===32;
    })()
  `)
  && !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && dUsualIdentity.querySelector("#usualItems .usual-item-add").textContent==="Added"
  && dUsualIdentity.querySelector("#usualItems .usual-item-add").disabled
  && dUsualIdentity.getElementById("usualLogBtn").textContent==="All added"
  && dUsualIdentity.getElementById("usualLogBtn").disabled);

const distinctRecurringFood = {};
const distinctNames = [
  "Chicken Fried Rice","Shrimp Fried Rice","Vegetable Fried Rice",
  "Chicken Fried Rice","Shrimp Fried Rice","Vegetable Fried Rice"
];
for(let i=1;i<=6;i++){
  distinctRecurringFood[dstr(-i)] = [{
    name:distinctNames[i-1], cal:400, pro:20, carb:55, fat:10, meal:"lunch"
  }];
}
const DistinctRecurring = boot(
  V3_CFG,
  Object.assign({},EMPTY_DATA,{food:distinctRecurringFood})
);
check("usual foods do not merge unrelated products merely because they share a vague phrase",
  DistinctRecurring.window.eval(`usualFor("lunch")`)===null);

// ================= v68: default ChatGPT handoff provider =================
const H68Cfg = Object.assign({},V3_CFG);
delete H68Cfg.aiProvider;
delete H68Cfg.foodHandoffOn;
const H68 = boot(H68Cfg,EMPTY_DATA);
const dH68 = H68.window.document;
check("v68 missing AI provider defaults to ChatGPT handoff",
  H68.window.eval("cfg.aiProvider")==="handoff"
  && H68.window.eval("aiProvider()")==="handoff"
  && dH68.getElementById("sAiProvider").value==="handoff");
check("v68 default provider and Quick Log defaults are aligned",
  H68.window.eval("foodHandoffEnabled()")===true
  && !dH68.getElementById("aiHandoffControls").classList.contains("hidden"));
const H68Claude = boot(Object.assign({},V3_CFG,{aiProvider:"anthropic",anthropicKey:"sk-test"}),EMPTY_DATA);
check("v68 explicit Claude provider remains unchanged",
  H68Claude.window.eval("cfg.aiProvider")==="anthropic"
  && H68Claude.window.document.getElementById("sAiProvider").value==="anthropic");

// ================= v60: default-on ChatGPT food handoff =================
const H60 = boot(V3_CFG, EMPTY_DATA);
const dH60 = H60.window.document;
const clickH60 = id=>dH60.getElementById(id).dispatchEvent(new H60.window.Event("click",{bubbles:true}));
check("v60 food handoff is visible by default without a key", !dH60.getElementById("aiFoodCard").classList.contains("hidden") && !dH60.getElementById("aiHandoffControls").classList.contains("hidden"));
check("v60 Settings toggle reports the default-on state accessibly", dH60.getElementById("foodHandoffToggleBtn").getAttribute("aria-pressed")==="true" && /Disable AI food handoff/.test(dH60.getElementById("foodHandoffToggleBtn").textContent));
clickH60("foodHandoffToggleBtn");
check("v60 disabling food handoff persists false and hides the no-key card", H60.window.eval("cfg.foodHandoffOn")===false && JSON.parse(H60.window.localStorage.getItem("forge:cfg")).foodHandoffOn===false && dH60.getElementById("aiFoodCard").classList.contains("hidden"));
clickH60("foodHandoffToggleBtn");
check("v60 food handoff can be restored from Settings", H60.window.eval("cfg.foodHandoffOn")===true && !dH60.getElementById("aiFoodCard").classList.contains("hidden") && dH60.getElementById("foodHandoffToggleBtn").getAttribute("aria-pressed")==="true");
const H60Api = boot(Object.assign({},V3_CFG,{aiProvider:"anthropic",anthropicKey:"sk-test",foodHandoffOn:true}),EMPTY_DATA);
check("v60 a configured live API key keeps the live food flow", H60Api.window.document.getElementById("aiHandoffControls").classList.contains("hidden") && !H60Api.window.document.getElementById("aiFoodGoBtn").classList.contains("hidden"));
const H60Off = boot(Object.assign({},V3_CFG,{aiProvider:"handoff",foodHandoffOn:false}),EMPTY_DATA);
check("v60 disabling food handoff also hides it in handoff provider mode", H60Off.window.document.getElementById("aiFoodCard").classList.contains("hidden"));
check("v60 keeps current primary schemaVersion 3", H60.window.eval("SCHEMA_VERSION")===3);

// ================= v61: local food suggestions =================
const S61 = boot(V3_CFG, EMPTY_DATA);
const dS61 = S61.window.document;
const clickS61 = id=>dS61.getElementById(id).dispatchEvent(new S61.window.Event("click",{bubbles:true}));
check("v61 food suggestions are opt-in and hidden by default", dS61.getElementById("foodSuggestionsCard").classList.contains("hidden") && dS61.getElementById("foodSuggestionsToggleBtn").getAttribute("aria-pressed")==="false");
clickS61("foodSuggestionsToggleBtn");
check("v61 enabling suggestions persists the preference", S61.window.eval("cfg.foodSuggestionsOn")===true && JSON.parse(S61.window.localStorage.getItem("forge:cfg")).foodSuggestionsOn===true);
check("v61 enabled suggestions show three local review choices", !dS61.getElementById("foodSuggestionsCard").classList.contains("hidden") && dS61.querySelectorAll("#foodSuggestionsList button.result").length===3);
const S61Offline=boot(Object.assign({},V3_CFG,{foodSuggestionsOn:true}),EMPTY_DATA,(w)=>{
  Object.defineProperty(w.navigator,"onLine",{configurable:true,value:false});
  w.__suggestionFetches=0; w.fetch=()=>{ w.__suggestionFetches++; return Promise.reject(new Error("network should not run")); };
});
check("v61 suggestions work offline without any network request", S61Offline.window.document.querySelectorAll("#foodSuggestionsList button.result").length===3 && S61Offline.window.__suggestionFetches===0);
check("v61 suggestion summary uses today's exact remaining targets", /1800 kcal/.test(dS61.getElementById("foodSuggestionsSummary").textContent) && /170g protein/.test(dS61.getElementById("foodSuggestionsSummary").textContent));
const initialSuggestionNames61=[...dS61.querySelectorAll("#foodSuggestionsList .r-name")].map(x=>x.textContent).join("|");
clickS61("foodSuggestionsRefreshBtn");
const refreshedSuggestionNames61=[...dS61.querySelectorAll("#foodSuggestionsList .r-name")].map(x=>x.textContent).join("|");
check("v61 Refresh rotates through other high-scoring choices", initialSuggestionNames61!==refreshedSuggestionNames61 && dS61.querySelectorAll("#foodSuggestionsList button.result").length===3);
const foodCountBeforeSuggestion61=S61.window.eval("(data.food[todayStr()]||[]).length");
dS61.querySelector("#foodSuggestionsList button.result").dispatchEvent(new S61.window.Event("click",{bubbles:true}));
check("v61 tapping a suggestion opens the normal amount review without logging", !dS61.getElementById("calcCard").classList.contains("hidden") && S61.window.eval("(data.food[todayStr()]||[]).length")===foodCountBeforeSuggestion61);
check("v61 suggestion review preloads a realistic positive amount", Number(dS61.getElementById("qtyAmount").value)>0 && Number(dS61.getElementById("calcCal").textContent)>0);
clickS61("addSelBtn");
check("v61 a suggestion logs only after the existing Add action", S61.window.eval("(data.food[todayStr()]||[]).length")===foodCountBeforeSuggestion61+1);
const afterSuggestionSummary61=dS61.getElementById("foodSuggestionsSummary").textContent;
check("v61 remaining-target summary updates after the reviewed food is logged", afterSuggestionSummary61!=="1800 kcal · 170g protein · 180g carbs · 55g fat remaining");
const avoid61=dS61.getElementById("foodSuggestionsAvoid");
avoid61.value="chicken, tuna"; clickS61("saveFoodSuggestionsBtn");
check("v61 exclusion terms remove matching names from the candidate pool", S61.window.eval(`foodSuggestionCandidates().every(c=>!/chicken|tuna/i.test(c.food.name))`));
clickS61("foodSuggestionsWeightLossBtn");
check("v61 weight-loss focus is optional, accessible, and persisted", S61.window.eval("cfg.foodSuggestionsWeightLoss")===false && dS61.getElementById("foodSuggestionsWeightLossBtn").getAttribute("aria-pressed")==="false" && JSON.parse(S61.window.localStorage.getItem("forge:cfg")).foodSuggestionsWeightLoss===false);
const past61=dstr(-1); dS61.getElementById("foodDate").value=past61; dS61.getElementById("foodDate").dispatchEvent(new S61.window.Event("change",{bubbles:true}));
check("v61 next-food suggestions stay hidden while editing a historical date", dS61.getElementById("foodSuggestionsCard").classList.contains("hidden"));
const S61NoTargets=boot(Object.assign({},V3_CFG,{calTarget:0,proTarget:0,carbGoal:0,fatGoal:0,foodSuggestionsOn:true}),EMPTY_DATA);
check("v61 enabled suggestions explain that targets are required", /Set calorie and macro targets/.test(S61NoTargets.window.document.getElementById("foodSuggestionsSummary").textContent) && S61NoTargets.window.document.querySelectorAll("#foodSuggestionsList button").length===0);
const fullFood61={}; fullFood61[dstr(0)]=[{name:"Full day",cal:1800,pro:170,carb:180,fat:55,meal:"dinner"}];
const S61Full=boot(Object.assign({},V3_CFG,{foodSuggestionsOn:true}),Object.assign({},EMPTY_DATA,{food:fullFood61}));
check("v61 reached calorie target gives an honest no-force message", S61Full.window.document.querySelectorAll("#foodSuggestionsList button").length===0 && /No need to force another food|No normal food/.test(S61Full.window.document.getElementById("foodSuggestionsList").textContent));
const familiarData61=Object.assign({},EMPTY_DATA,{recents:[{name:"Ryan's lunch yogurt",brand:"Saved",cal100:60,pro100:10,carb100:4,fat100:0.5,lastAmt:200,lastUnit:"g"}],foodCounts:{"Ryan's lunch yogurt|Saved":9},mealCounts:{lunch:{"Ryan's lunch yogurt|Saved":7}}});
const S61Familiar=boot(Object.assign({},V3_CFG,{foodSuggestionsOn:true}),familiarData61);
S61Familiar.window.eval(`currentMeal="lunch"; foodSuggestionPage=0; renderMealSeg(); renderFood();`);
check("v61 familiar meal history is represented in suggestions", /Ryan's lunch yogurt/.test(S61Familiar.window.document.getElementById("foodSuggestionsList").textContent) && /Familiar lunch choice/.test(S61Familiar.window.document.getElementById("foodSuggestionsList").textContent));
check("v61 suggestion buttons remain keyboard-accessible native controls", [...S61Familiar.window.document.querySelectorAll("#foodSuggestionsList button")].every(b=>b.tagName==="BUTTON" && /Review suggestion:/.test(b.getAttribute("aria-label")||"")));
check("v61 keeps current primary schemaVersion 3", S61.window.eval("SCHEMA_VERSION")===3);


// ================= v62: expanded USDA-anchored suggestion catalog =================
const C62 = boot(Object.assign({},V3_CFG,{foodSuggestionsOn:true}), EMPTY_DATA);
const dC62 = C62.window.document;
check("v62 bundled USDA suggestion catalog loads with exactly 120 foods", C62.window.eval(`FOOD_SUGGESTION_CATALOG_VERSION==="USDA Standard Reference 28" && FOOD_SUGGESTION_CATALOG.length===120`));
check("v62 catalog display names and USDA NDB numbers are unique", C62.window.eval(`new Set(FOOD_SUGGESTION_CATALOG.map(x=>x.name)).size===120 && new Set(FOOD_SUGGESTION_CATALOG.map(x=>x.ndb)).size===120`));
check("v62 every catalog item keeps traceable source data and rational nutrition ranges", C62.window.eval(`FOOD_SUGGESTION_CATALOG.every(x=>/^\\d{5}$/.test(x.ndb) && x.usdaDescription.length>8 && x.cal100>0 && x.cal100<=900 && x.pro100>=0 && x.pro100<=100 && x.carb100>=0 && x.carb100<=100 && x.fat100>=0 && x.fat100<=100 && x.servingG>=5 && x.servingG<=500 && /g\\)/.test(x.servingLabel))`));
check("v62 catalog covers protein, plant protein, carbs, produce, snacks, and fats", C62.window.eval(`["protein","plant-protein","carb","produce","snack","fat"].every(cat=>FOOD_SUGGESTION_CATALOG.some(x=>x.category===cat))`));
check("v62 benchmark macros match the USDA source values exactly", C62.window.eval(`
  (function(){
    const by=n=>FOOD_SUGGESTION_CATALOG.find(x=>x.ndb===n);
    return JSON.stringify([by("05064").cal100,by("05064").pro100,by("05064").carb100,by("05064").fat100])===JSON.stringify([165,31.02,0,3.57])
      && JSON.stringify([by("01015").cal100,by("01015").pro100,by("01015").carb100,by("01015").fat100])===JSON.stringify([81,10.45,4.76,2.27])
      && JSON.stringify([by("01256").cal100,by("01256").pro100,by("01256").carb100,by("01256").fat100])===JSON.stringify([59,10.19,3.6,0.39])
      && JSON.stringify([by("01129").cal100,by("01129").pro100,by("01129").carb100,by("01129").fat100])===JSON.stringify([155,12.58,1.12,10.61])
      && JSON.stringify([by("09040").cal100,by("09040").pro100,by("09040").carb100,by("09040").fat100])===JSON.stringify([89,1.09,22.84,0.33]);
  })()`));
check("v62 fresh users receive the full catalog without prior food history", C62.window.eval(`foodSuggestionCandidates().length===120 && foodSuggestionCandidates().every(c=>c.source==="catalog")`));
check("v62 catalog candidates preserve USDA identity and exact serving metadata", C62.window.eval(`foodSuggestionCandidates().every(c=>c.food.brand==="USDA reference · SR28" && /^\\d{5}$/.test(c.food.suggestionNdb) && c.food.suggestionUsdaDescription && c.unit==="serving" && c.amount===1 && c.grams===c.food.servingG && c.portion===c.food.servingLabel)`));
const suggestionSection62 = fs.readFileSync(path.join(__dirname,"..","scripts","02-food.js"),"utf8").split("v62: EXPANDED USDA-ANCHORED FOOD SUGGESTIONS")[1].split("OFF product mapping")[0];
check("v62 recommendation catalog no longer depends on matching LOCAL_DB names", !/LOCAL_DB\\.find|FOOD_SUGGESTION_STARTERS/.test(suggestionSection62));
check("v62 rendered recommendations identify USDA reference choices", dC62.querySelectorAll("#foodSuggestionsList button.result").length===3 && [...dC62.querySelectorAll("#foodSuggestionsList .r-brand")].every(x=>/USDA reference/.test(x.textContent)));
const beforeReview62=C62.window.eval(`(data.food[todayStr()]||[]).length`);
C62.window.eval(`reviewFoodSuggestion(foodSuggestionCandidates().find(c=>c.food.suggestionNdb==="05064"))`);
check("v62 a catalog suggestion opens its exact listed serving for review", dC62.getElementById("qtyUnit").value==="serving" && Number(dC62.getElementById("qtyAmount").value)===1 && /4 oz cooked \(113g\)/.test(dC62.getElementById("qtyUnit").selectedOptions[0].textContent));
check("v62 review shows the USDA per-100g values and correctly scaled serving", /USDA reference · SR28/.test(dC62.getElementById("selName").textContent) && /165 kcal/.test(dC62.getElementById("selPer100").textContent) && dC62.getElementById("calcCal").textContent==="186" && dC62.getElementById("calcPro").textContent==="35");
check("v62 reviewing a broad-catalog suggestion never auto-logs it", C62.window.eval(`(data.food[todayStr()]||[]).length`)===beforeReview62);
check("v62 suggestion catalog remains precached in the current service worker", (()=>{ const x=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8"); return x.includes('"./data-suggestions.js"'); })());
check("v62 keeps current primary schemaVersion 3", C62.window.eval("SCHEMA_VERSION")===3);

// ================= ChatGPT handoff paste flow =================
const H = boot(Object.assign({}, EXISTING_CFG, {aiProvider:"handoff"}), EMPTY_DATA);
const dH = H.window.document;
H.window.HTMLElement.prototype.scrollIntoView = function(opts){ H.window.__aiScroll={id:this.id, className:this.className, block:opts&&opts.block}; };
const clickH = id=>dH.getElementById(id).dispatchEvent(new H.window.Event("click",{bubbles:true}));
H.window.eval(`currentMeal="dinner"; renderMealSeg();`);
clickH("hfPasteBtn"); await wait(30);
check("paste box always visible (iOS clipboard-proof)", !dH.getElementById("hfPasteBox").classList.contains("hidden"));
check("handoff textarea uses 16px text to prevent mobile focus zoom", H.window.getComputedStyle(dH.getElementById("hfPasteText")).fontSize==="16px");
const trainNumberInput = dH.querySelector(".snum");
check("training weight and rep inputs use 16px text to prevent mobile focus zoom", !!trainNumberInput && H.window.getComputedStyle(trainNumberInput).fontSize==="16px");
dH.getElementById("hfPasteText").value = 'Here! {\u201Cfoods\u201D:[{\u201Cname\u201D:\u201CRice\u201D,\u201Ccal\u201D:260,\u201Cpro\u201D:5,\u201Ccarb\u201D:57,\u201Cfat\u201D:1}]}';
clickH("hfReviewBtn"); await wait(30);
check("curly-quote paste reaches review card", dH.querySelectorAll("#aiFoodConfirm .list-item").length===1);
check("review flow centers the first item instead of clipping it above the viewport", /list-item/.test(H.window.eval("window.__aiScroll && window.__aiScroll.className")||"") && H.window.eval("window.__aiScroll && window.__aiScroll.block")==="center");
const hfLogBtn = dH.querySelector("#aiFoodConfirm .ai-confirm-log");
check("review log action stays visible while reviewing", !!hfLogBtn);
check("nothing logged before confirm", H.window.eval("(data.food[todayStr()]||[]).length")===0);
hfLogBtn.dispatchEvent(new H.window.Event("click",{bubbles:true})); await wait(30);
check("handoff confirmation logs the reviewed food", H.window.eval("(data.food[todayStr()]||[]).length")===1);
check("handoff logging clears raw reply and resets the review", dH.getElementById("hfPasteText").value==="" && dH.getElementById("aiFoodConfirm").classList.contains("hidden"));
check("handoff logging returns to the top ready for another", /ready for another/i.test(dH.getElementById("aiFoodStatus").textContent) && H.window.eval("window.__aiScroll && window.__aiScroll.id")==="aiFoodCard");

// ================= easter egg =================
const G = boot(EXISTING_CFG, EMPTY_DATA);
const dG = G.window.document;
const title = dG.getElementById("bpTitle");
const ev = n=>title.dispatchEvent(new G.window.Event(n,{bubbles:true}));
ev("pointerdown"); await wait(400); ev("pointerup"); await wait(2800);
check("early release: no reveal", dG.getElementById("bellaEgg").style.opacity!=="1");
ev("pointerdown"); await wait(3150);
check("3s hold reveals Bella", dG.getElementById("bellaEgg").style.opacity==="1" && dG.getElementById("bpTitleText").style.opacity==="0");
await wait(4300);
check("title dissolves back on its own", dG.getElementById("bellaEgg").style.opacity==="0" && dG.getElementById("bpTitleText").style.opacity==="1");
// Memorial integrity: tests/bella-reference.b64 is the frozen byte truth of her handwriting
// (extracted from v41, whose embed was verified byte-identical to the processed original).
// The app embeds it EXACTLY ONCE, via a CSS custom property shared by both mask prefixes.
// The reference file never changes; the image is never regenerated or re-rendered.
const bellaRef = fs.readFileSync(path.join(__dirname, "bella-reference.b64"), "utf8").trim();
const bellaCount = html.split(bellaRef).length - 1;
check("her handwriting embedded byte-identically to the frozen reference", bellaCount >= 1);
check("embed count is exactly 1 (Phase 1 dedup landed; was 2 in v41)", bellaCount === 1);

// ================= v54: manual rest + program identity =================
const T54 = boot(V3_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT54 = T54.window.document;
check("v54 current-program card identifies the loaded program and selected session", dT54.getElementById("programName").textContent===TEST_PROGRAM.name && /Selected session:/.test(dT54.getElementById("programDayName").textContent));
dT54.getElementById("wDay").value="__CARDIO__";
dT54.getElementById("wDay").dispatchEvent(new T54.window.Event("change",{bubbles:true}));
check("v54 program identity follows the selected session", /Cardio \/ Conditioning/.test(dT54.getElementById("programDayName").textContent));
dT54.getElementById("wDay").value="D1";
dT54.getElementById("wDay").dispatchEvent(new T54.window.Event("change",{bubbles:true}));
dT54.getElementById("programManageBtn").dispatchEvent(new T54.window.Event("click",{bubbles:true}));
check("v54 Manage opens a separate plan-management box", !dT54.getElementById("programToolsCard").classList.contains("hidden") && dT54.getElementById("programManageBtn").getAttribute("aria-expanded")==="true" && dT54.getElementById("programIdentityCard").isConnected);
dT54.getElementById("programManageCloseBtn").dispatchEvent(new T54.window.Event("click",{bubbles:true}));
check("v54 Close collapses plan management without hiding program identity", dT54.getElementById("programToolsCard").classList.contains("hidden") && dT54.getElementById("programManageBtn").textContent==="Manage" && !dT54.getElementById("programIdentityCard").classList.contains("hidden"));
check("v54 rest control is hidden outside Train", dT54.getElementById("restDock").classList.contains("hidden"));
T54.window.eval(`activateView("work",null,false)`);
check("v54 rest control appears only on Train and reserves bottom space", !dT54.getElementById("restDock").classList.contains("hidden") && dT54.body.classList.contains("rest-dock-visible"));
const w54=dT54.querySelector('#exerciseInputs input[data-field="weight"]');
const r54=dT54.querySelector('#exerciseInputs input[data-field="reps"]');
w54.value="100"; w54.dispatchEvent(new T54.window.Event("input",{bubbles:true}));
r54.value="5"; r54.dispatchEvent(new T54.window.Event("input",{bubbles:true}));
dT54.querySelector("#exerciseInputs .saveExBtn").dispatchEvent(new T54.window.Event("click",{bubbles:true}));
check("v54 Save Exercise never starts or resets the rest timer", T54.window.eval("restRunning===false && restPaused===false && restRemaining===0") && dT54.getElementById("restDisplay").textContent==="1:30");
dT54.getElementById("restStartBtn").dispatchEvent(new T54.window.Event("click",{bubbles:true}));
check("v54 rest timer starts only from the manual Start control", T54.window.eval("restRunning===true && restRemaining===90") && dT54.getElementById("restStartBtn").classList.contains("hidden"));
T54.window.eval(`restRemaining=47; saveExercise("Bench Press")`);
check("v54 saving an exercise while rest is running does not restart or reset it", T54.window.eval("restRunning===true && restRemaining===47"));
dT54.getElementById("restPauseBtn").dispatchEvent(new T54.window.Event("click",{bubbles:true}));
check("v54 timer supports Pause and Resume", T54.window.eval("restRunning===false && restPaused===true") && dT54.getElementById("restPauseBtn").textContent==="Resume");
const paused54=T54.window.eval("restRemaining");
dT54.getElementById("restAddBtn").dispatchEvent(new T54.window.Event("click",{bubbles:true}));
check("v54 +30 adds thirty seconds without restarting a paused timer", T54.window.eval("restPaused===true && restRemaining")===(paused54+30));
dT54.getElementById("restEndBtn").dispatchEvent(new T54.window.Event("click",{bubbles:true}));
check("v54 End clears the timer back to the selected duration", T54.window.eval("restRunning===false && restPaused===false && restRemaining===0") && dT54.getElementById("restDisplay").textContent==="1:30");
const preset120=[...dT54.querySelectorAll("#restPresets .xbtn")].find(b=>b.textContent==="2:00");
preset120.dispatchEvent(new T54.window.Event("click",{bubbles:true}));
check("v54 choosing a rest preset changes the duration without auto-starting", T54.window.eval("cfg.restSec===120 && restRunning===false") && dT54.getElementById("restDisplay").textContent==="2:00");
T54.window.eval(`activateView("food",null,false)`);
check("v54 leaving Train hides the rest control", dT54.getElementById("restDock").classList.contains("hidden") && !dT54.body.classList.contains("rest-dock-visible"));

// ================= v64: elapsed-time rest timer =================
const CLOCK64 = 2000000000000;
const T64 = boot(V3_CFG, EMPTY_DATA, w=>{ w.Date.now=()=>CLOCK64; }, TEST_PROGRAM);
const dT64 = T64.window.document;
T64.window.eval(`activateView("work",null,false)`);
dT64.getElementById("restStartBtn").dispatchEvent(new T64.window.Event("click",{bubbles:true}));
const startedTimer64 = JSON.parse(T64.window.localStorage.getItem("forge:rest-timer"));
check("v64 starting rest saves a fixed finish time outside primary state", startedTimer64.status==="running" && startedTimer64.endAt===CLOCK64+90000 && T64.window.eval("restRunning && restRemaining===90"));
T64.window.Date.now=()=>CLOCK64+45000;
T64.window.eval("reconcileRestTimer()");
check("v64 foreground reconciliation uses actual elapsed time after suspension", T64.window.eval("restRemaining===45") && dT64.getElementById("restDisplay").textContent==="0:45");
dT64.getElementById("restPauseBtn").dispatchEvent(new T64.window.Event("click",{bubbles:true}));
const pausedTimer64 = T64.window.localStorage.getItem("forge:rest-timer");
check("v64 pausing saves the exact remaining duration", JSON.parse(pausedTimer64).status==="paused" && JSON.parse(pausedTimer64).remainingSec===45);

const T64PausedReload = bootRaw({
  cfg:T64.window.localStorage.getItem("forge:cfg"),
  data:T64.window.localStorage.getItem("forge:data"),
  program:T64.window.localStorage.getItem("forge:program"),
  restTimer:pausedTimer64
}, w=>{ w.Date.now=()=>CLOCK64+45000; });
check("v64 paused rest timer survives a full app or phone restart", T64PausedReload.window.eval("restPaused && !restRunning && restRemaining===45") && T64PausedReload.window.document.getElementById("restDisplay").textContent==="0:45");
T64PausedReload.window.document.getElementById("restPauseBtn").dispatchEvent(new T64PausedReload.window.Event("click",{bubbles:true}));
const resumedTimer64 = JSON.parse(T64PausedReload.window.localStorage.getItem("forge:rest-timer"));
check("v64 resumed timer writes a new finish time from the restored remainder", resumedTimer64.status==="running" && resumedTimer64.endAt===CLOCK64+90000);
T64PausedReload.window.eval("cancelRest()");

const T64Expired = bootRaw({
  cfg:T64.window.localStorage.getItem("forge:cfg"),
  data:T64.window.localStorage.getItem("forge:data"),
  program:T64.window.localStorage.getItem("forge:program"),
  restTimer:JSON.stringify({formatVersion:1,status:"running",endAt:CLOCK64+30000,remainingSec:30,durationSec:30,savedAt:CLOCK64})
}, w=>{ w.Date.now=()=>CLOCK64+45000; });
const relaunchedReady64 = JSON.parse(T64Expired.window.localStorage.getItem("forge:rest-timer"));
check("v65 relaunch or phone restart expiration resets to the last started duration", T64Expired.window.eval("!restRunning && !restPaused && restRemaining===0 && restReadySec===30") && T64Expired.window.document.getElementById("restDisplay").textContent==="0:30" && relaunchedReady64.status==="ready" && relaunchedReady64.durationSec===30);

const T65VisibleExpired = boot(Object.assign({},V3_CFG,{restSec:75}), EMPTY_DATA, w=>{ w.Date.now=()=>CLOCK64; }, TEST_PROGRAM);
T65VisibleExpired.window.eval(`activateView("work",null,false)`);
T65VisibleExpired.window.document.getElementById("restStartBtn").dispatchEvent(new T65VisibleExpired.window.Event("click",{bubbles:true}));
T65VisibleExpired.window.Date.now=()=>CLOCK64+76000;
T65VisibleExpired.window.eval("tickRestCountdown()");
const visibleReady65 = JSON.parse(T65VisibleExpired.window.localStorage.getItem("forge:rest-timer"));
check("v65 visible timer expiration resets to the exact last started duration", T65VisibleExpired.window.eval("!restRunning && !restPaused && restRemaining===0 && restReadySec===75") && T65VisibleExpired.window.document.getElementById("restDisplay").textContent==="1:15" && !T65VisibleExpired.window.document.getElementById("restStartBtn").classList.contains("hidden"));

const T65BackgroundExpired = boot(Object.assign({},V3_CFG,{restSec:120}), EMPTY_DATA, w=>{ w.Date.now=()=>CLOCK64; }, TEST_PROGRAM);
T65BackgroundExpired.window.eval(`activateView("work",null,false)`);
T65BackgroundExpired.window.document.getElementById("restStartBtn").dispatchEvent(new T65BackgroundExpired.window.Event("click",{bubbles:true}));
T65BackgroundExpired.window.Date.now=()=>CLOCK64+121000;
T65BackgroundExpired.window.document.dispatchEvent(new T65BackgroundExpired.window.Event("visibilitychange"));
check("v65 background or unlock expiration resets to the exact last started duration", T65BackgroundExpired.window.eval("!restRunning && !restPaused && restReadySec===120") && T65BackgroundExpired.window.document.getElementById("restDisplay").textContent==="2:00");

const timerSource65 = fs.readFileSync(path.join(__dirname,"..","scripts","04-weight.js"),"utf8");
const timerSection65 = timerSource65.slice(timerSource65.indexOf("// ================== PLATE MATH & REST TIMER"), timerSource65.indexOf("// ================== SHARE PROGRAM"));
check("v65 completed timer display no longer uses GO", !timerSection65.includes("GO!") && T65VisibleExpired.window.document.getElementById("restDisplay").textContent!=="GO!");
check("v65 expiration clears the active deadline without restarting", T65VisibleExpired.window.eval("restEndsAt===0 && restInterval===null && !restRunning") && visibleReady65.status==="ready" && !Object.prototype.hasOwnProperty.call(visibleReady65,"endAt"));

// ================= native rest-timer local notifications =================
const notificationPackage = JSON.parse(fs.readFileSync(path.join(__dirname,"..","package.json"),"utf8"));
const notificationConfig = JSON.parse(fs.readFileSync(path.join(__dirname,"..","capacitor.config.json"),"utf8"));
const notificationSwiftPackage = fs.readFileSync(path.join(__dirname,"..","ios","App","CapApp-SPM","Package.swift"),"utf8");
check("native timer declares the Capacitor 8 Local Notifications dependency", /^\^?8\./.test(notificationPackage.dependencies["@capacitor/local-notifications"]||"") && /CapacitorLocalNotifications/.test(notificationSwiftPackage));
check("native timer enables sound, banner, and notification-list presentation on iOS", ["sound","banner","list"].every(v=>notificationConfig.plugins.LocalNotifications.presentationOptions.includes(v)));

const CLOCK_NOTIFY = 2100000000000;
const NotifyGranted = makeLocalNotifications({permission:"granted"});
const TN = boot(Object.assign({},V3_CFG,{restSec:60}), EMPTY_DATA, w=>{
  w.Date.now=()=>CLOCK_NOTIFY;
  NotifyGranted.install(w);
}, TEST_PROGRAM);
TN.window.eval(`activateView("work",null,false)`);
TN.window.document.getElementById("restStartBtn").dispatchEvent(new TN.window.Event("click",{bubbles:true}));
await TN.window.eval("restNotificationWork");
const scheduledNotify = NotifyGranted.calls.find(c=>c.method==="schedule");
check("native timer schedules one notification at the persisted endAt", TN.window.eval("restRunning && restEndsAt===2100000060000") && !!scheduledNotify && scheduledNotify.args.notifications.length===1 && scheduledNotify.args.notifications[0].id===TN.window.eval("REST_NOTIFICATION_ID") && scheduledNotify.args.notifications[0].schedule.at.getTime()===CLOCK_NOTIFY+60000 && scheduledNotify.args.notifications[0].sound==="default");
const notificationTimerRecord = JSON.parse(TN.window.localStorage.getItem("forge:rest-timer"));
check("native notification support leaves rest-timer format version 1 and record shape unchanged", notificationTimerRecord.formatVersion===1 && notificationTimerRecord.status==="running" && notificationTimerRecord.endAt===CLOCK_NOTIFY+60000 && !Object.keys(notificationTimerRecord).some(k=>/notif/i.test(k)));
check("native timer checks permission without prompting when it is already granted", NotifyGranted.calls.filter(c=>c.method==="checkPermissions").length===1 && NotifyGranted.calls.every(c=>c.method!=="requestPermissions"));

TN.window.Date.now=()=>CLOCK_NOTIFY+10000;
TN.window.document.getElementById("restAddBtn").dispatchEvent(new TN.window.Event("click",{bubbles:true}));
await TN.window.eval("restNotificationWork");
const notifySchedulesAfterAdd = NotifyGranted.calls.filter(c=>c.method==="schedule");
check("adding time replaces the pending notification with the extended endAt", notifySchedulesAfterAdd.length===2 && notifySchedulesAfterAdd[1].args.notifications[0].schedule.at.getTime()===CLOCK_NOTIFY+90000 && NotifyGranted.calls.some(c=>c.method==="cancel"));

TN.window.document.getElementById("restPauseBtn").dispatchEvent(new TN.window.Event("click",{bubbles:true}));
await TN.window.eval("restNotificationWork");
check("pausing cancels the pending rest notification", TN.window.eval("restPaused && !restRunning") && NotifyGranted.pending.size===0);
TN.window.document.getElementById("restPauseBtn").dispatchEvent(new TN.window.Event("click",{bubbles:true}));
await TN.window.eval("restNotificationWork");
check("resuming schedules a new notification from the restored remainder", TN.window.eval("restRunning") && NotifyGranted.pending.has(TN.window.eval("REST_NOTIFICATION_ID")) && NotifyGranted.calls.filter(c=>c.method==="schedule").length===3);
TN.window.document.getElementById("restEndBtn").dispatchEvent(new TN.window.Event("click",{bubbles:true}));
await TN.window.eval("restNotificationWork");
check("ending early cancels the pending notification and clears the timer", !TN.window.eval("restRunning||restPaused") && NotifyGranted.pending.size===0 && TN.window.localStorage.getItem("forge:rest-timer")===null);

const NotifyPrompt = makeLocalNotifications({permission:"prompt",requestResult:"granted"});
const TNPrompt = boot(Object.assign({},V3_CFG,{restSec:30}), EMPTY_DATA, w=>{
  w.Date.now=()=>CLOCK_NOTIFY;
  NotifyPrompt.install(w);
}, TEST_PROGRAM);
TNPrompt.window.eval(`activateView("work",null,false)`);
await TNPrompt.window.eval("restNotificationWork");
const notifyPromptCallsBeforeStart = NotifyPrompt.calls.length;
const notifyPromptRequestsBeforeStart = NotifyPrompt.calls.filter(c=>c.method==="requestPermissions").length;
const notifyPromptSchedulesBeforeStart = NotifyPrompt.calls.filter(c=>c.method==="schedule").length;
TNPrompt.window.document.getElementById("restStartBtn").dispatchEvent(new TNPrompt.window.Event("click",{bubbles:true}));
await TNPrompt.window.eval("restNotificationWork");
const notifyPromptStartMethods = NotifyPrompt.calls.slice(notifyPromptCallsBeforeStart).map(c=>c.method).join(",");
check("starting the timer is the user action that requests notification permission", notifyPromptRequestsBeforeStart===0 && notifyPromptSchedulesBeforeStart===0 && notifyPromptStartMethods==="checkPermissions,requestPermissions,getPending,schedule" && NotifyPrompt.pending.size===1);

const NotifyDenied = makeLocalNotifications({permission:"denied"});
const TNDenied = boot(Object.assign({},V3_CFG,{restSec:30}), EMPTY_DATA, w=>{
  w.Date.now=()=>CLOCK_NOTIFY;
  NotifyDenied.install(w);
}, TEST_PROGRAM);
TNDenied.window.eval(`activateView("work",null,false)`);
TNDenied.window.document.getElementById("restStartBtn").dispatchEvent(new TNDenied.window.Event("click",{bubbles:true}));
await TNDenied.window.eval("restNotificationWork");
check("denied permission never breaks or delays the manual timer", TNDenied.window.eval("restRunning && restRemaining===30") && NotifyDenied.calls.every(c=>c.method!=="schedule") && NotifyDenied.calls.every(c=>c.method!=="requestPermissions"));

const NotifyRestore = makeLocalNotifications({permission:"granted",pending:[{id:64065,title:"Old",body:"Old",schedule:{at:new Date(CLOCK_NOTIFY+999999)}}]});
const TNRestore = bootRaw({
  cfg:JSON.stringify(Object.assign({},V3_CFG,{restSec:45})),
  data:JSON.stringify(EMPTY_DATA),
  program:JSON.stringify(TEST_PROGRAM),
  restTimer:JSON.stringify({formatVersion:1,status:"running",endAt:CLOCK_NOTIFY+45000,remainingSec:45,durationSec:45,savedAt:CLOCK_NOTIFY})
}, w=>{
  w.Date.now=()=>CLOCK_NOTIFY;
  NotifyRestore.install(w);
});
await TNRestore.window.eval("restNotificationWork");
const restoredSchedule = NotifyRestore.calls.filter(c=>c.method==="schedule").pop();
check("relaunch replaces a stale pending notification with the persisted timer deadline", NotifyRestore.calls.some(c=>c.method==="getPending") && NotifyRestore.calls.some(c=>c.method==="cancel") && !!restoredSchedule && restoredSchedule.args.notifications[0].schedule.at.getTime()===CLOCK_NOTIFY+45000 && NotifyRestore.pending.size===1);

const NotifyRestorePrompt = makeLocalNotifications({permission:"prompt"});
const TNRestorePrompt = bootRaw({
  cfg:JSON.stringify(V3_CFG),
  data:JSON.stringify(EMPTY_DATA),
  program:JSON.stringify(TEST_PROGRAM),
  restTimer:JSON.stringify({formatVersion:1,status:"running",endAt:CLOCK_NOTIFY+45000,remainingSec:45,durationSec:45,savedAt:CLOCK_NOTIFY})
}, w=>{
  w.Date.now=()=>CLOCK_NOTIFY;
  NotifyRestorePrompt.install(w);
});
await TNRestorePrompt.window.eval("restNotificationWork");
check("relaunch never opens the notification permission prompt without a timer action", TNRestorePrompt.window.eval("restRunning") && NotifyRestorePrompt.calls.every(c=>c.method!=="requestPermissions") && NotifyRestorePrompt.calls.every(c=>c.method!=="schedule"));

const NotifyPausedRestore = makeLocalNotifications({permission:"granted",pending:[{id:64065,title:"Old",body:"Old"}]});
const TNPausedRestore = bootRaw({
  cfg:JSON.stringify(V3_CFG),
  data:JSON.stringify(EMPTY_DATA),
  program:JSON.stringify(TEST_PROGRAM),
  restTimer:JSON.stringify({formatVersion:1,status:"paused",remainingSec:20,durationSec:30,savedAt:CLOCK_NOTIFY})
}, w=>{
  w.Date.now=()=>CLOCK_NOTIFY;
  NotifyPausedRestore.install(w);
});
await TNPausedRestore.window.eval("restNotificationWork");
check("relaunch cancels stale pending notifications for paused timers", TNPausedRestore.window.eval("restPaused && !restRunning") && NotifyPausedRestore.pending.size===0 && NotifyPausedRestore.calls.some(c=>c.method==="cancel"));

const TNWeb = boot(Object.assign({},V3_CFG,{restSec:30}), EMPTY_DATA, w=>{ w.Date.now=()=>CLOCK_NOTIFY; }, TEST_PROGRAM);
TNWeb.window.eval(`activateView("work",null,false)`);
TNWeb.window.document.getElementById("restStartBtn").dispatchEvent(new TNWeb.window.Event("click",{bubbles:true}));
await TNWeb.window.eval("restNotificationWork");
check("web timer behavior remains unchanged when the native plugin is absent", TNWeb.window.eval("restRunning && restRemaining===30"));
TNWeb.window.eval("cancelRest()");

// ================= v59: audit-recommended structural protections =================
check("v59 storage-use line renders an honest approximation", (()=>{ const B = boot(EXISTING_CFG, EMPTY_DATA); const t = B.window.document.getElementById("storageUseNote").textContent; return /~\d+ (KB|MB)/.test(t) && /approximate/.test(t); })());
// (1) only 01-storage.js may write sacred storage — enforced structurally, forever
const SACRED_WRITERS = ["02-food","03-train","04-weight","05-ai","06-settings","07-boot"];
check("v59 single-writer discipline: no slice outside 01-storage touches localStorage writes",
  SACRED_WRITERS.every(f=>!/localStorage\.(setItem|removeItem|clear)\s*\(/.test(fs.readFileSync(path.join(__dirname, "..", "scripts", f+".js"), "utf8"))));

// (2) editing a historical workout never disturbs the active draft
const V59 = boot(V1_CFG, Object.assign({}, EMPTY_DATA, {
  workouts:[{date:dstr(-3), day:"D1", title:"Day 1", sets:{"Bench Press":[{w:200,r:5}]}, notes:""}],
  activeWorkoutDraft:{date:dstr(0), day:"D1", sets:{"Bench Press":[{w:225,r:3}]}, savedAt:new Date().toISOString()}
}), null, TEST_PROGRAM);
const draftBefore = V59.window.eval("JSON.stringify(data.activeWorkoutDraft)");
check("v59 draft survives boot with history present", !!V59.window.eval("data.activeWorkoutDraft"));
// enter the REAL historical edit path and change the set through the shipped flow
V59.window.eval(`startEditWorkout(0)`);
const dV59 = V59.window.document;
check("v59 edit mode loads the historical session as saved exercises", V59.window.eval(`editingWorkoutIdx===0 && sessionState["Bench Press"].status==="saved"`) && dV59.getElementById("logWorkoutBtn").textContent==="Update session");
const editBtn59 = [...dV59.querySelectorAll("#exerciseInputs .xbtn")].find(b=>b.textContent==="Edit");
editBtn59.dispatchEvent(new V59.window.Event("click",{bubbles:true}));
const w59 = dV59.querySelector('#exerciseInputs input[data-field="weight"]');
w59.value="205"; w59.dispatchEvent(new V59.window.Event("input",{bubbles:true}));
dV59.querySelector("#exerciseInputs .saveExBtn").dispatchEvent(new V59.window.Event("click",{bubbles:true}));
dV59.getElementById("logWorkoutBtn").dispatchEvent(new V59.window.Event("click",{bubbles:true}));
check("v59 the historical edit landed exactly", V59.window.eval(`data.workouts[0].sets["Bench Press"][0].w`)===205 && V59.window.eval(`editingWorkoutIdx===null`));
check("v59 editing a historical workout leaves the active draft byte-identical",
  V59.window.eval("JSON.stringify(data.activeWorkoutDraft)")===draftBefore);

// (3) LKG-sacrifice quota path, end to end
const Q59 = boot(EXISTING_CFG, EMPTY_DATA);
check("v59 healthy boot arms the recovery snapshot", Q59.window.eval(`localStorage.getItem("forge:lkg")!==null`));
const lkgBefore59 = Q59.window.eval(`JSON.parse(localStorage.getItem("forge:lkg")).savedAt`);
await wait(1100); // ensure a distinguishable rebuild timestamp
Q59.window.eval(`
  (function(){
    const proto = Object.getPrototypeOf(localStorage);
    const orig = proto.setItem;
    let thrown = false;
    proto.setItem = function(k, v){
      if (!thrown && k==="forge:data"){ thrown = true; const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; }
      return orig.call(this, k, v);
    };
    window.__restoreSet = ()=>{ proto.setItem = orig; };
  })();
  currentMeal="lunch"; renderMealSeg();
  addEntry({name:"Quota meal", cal:500, pro:40, carb:40, fat:15, meal:"lunch"});
  window.__restoreSet();
`);
check("v59 quota crunch: live save survives by sacrificing the snapshot",
  Q59.window.eval(`(data.food[todayStr()]||[]).length===1 && JSON.parse(localStorage.getItem("forge:data")).food[todayStr()].length===1`));
// the retry only succeeds if the sacrifice actually freed the slot — and the system
// then self-heals by rebuilding a fresh snapshot from the post-save healthy state
check("v59 quota crunch: snapshot is rebuilt fresh after the sacrifice (self-healing)",
  Q59.window.eval(`localStorage.getItem("forge:lkg")!==null && lkgStatus.state==="ready"`) &&
  Q59.window.eval(`JSON.parse(localStorage.getItem("forge:lkg")).savedAt`) !== lkgBefore59);

// ================= v66: optional progression + orientation-friendly barcode scanner =================
const FreshAP66 = boot(null, null);
check("v66 fresh installs default automatic progression off", FreshAP66.window.eval("cfg.autoProgressionOn===false") && JSON.parse(FreshAP66.window.localStorage.getItem("forge:cfg")).autoProgressionOn===false && FreshAP66.window.document.getElementById("autoProgressionToggleBtn").getAttribute("aria-pressed")==="false");
const LegacyAP66 = boot(EXISTING_CFG, EMPTY_DATA);
check("v66 legacy installs missing the new setting retain automatic progression on", LegacyAP66.window.eval("cfg.autoProgressionOn===true") && JSON.parse(LegacyAP66.window.localStorage.getItem("forge:cfg")).autoProgressionOn===true);
const AP66 = boot(Object.assign({}, EXISTING_CFG, {autoProgressionOn:true}), EMPTY_DATA);
const dAP66 = AP66.window.document;
check("v66 Settings includes a dedicated automatic progression toggle", !!dAP66.getElementById("settingsTrainingDetails") && dAP66.getElementById("autoProgressionToggleBtn").textContent.includes("On") && dAP66.getElementById("autoProgressionToggleBtn").getAttribute("aria-pressed")==="true");
dAP66.getElementById("autoProgressionToggleBtn").dispatchEvent(new AP66.window.Event("click",{bubbles:true}));
check("v66 progression toggle persists an explicit off setting", AP66.window.eval("cfg.autoProgressionOn===false") && JSON.parse(AP66.window.localStorage.getItem("forge:cfg")).autoProgressionOn===false && dAP66.getElementById("autoProgressionToggleBtn").getAttribute("aria-pressed")==="false");
check("v66 disabled progression carries completed weights forward unchanged", AP66.window.eval(`(()=>{const x=prefillRows({name:"Bench Press",scheme:"4×5"},[{w:100,r:5},{w:100,r:5},{w:100,r:5},{w:100,r:5}]);return !x.auto&&x.rows.every(r=>r.w===100&&r.r===5);})()`));
dAP66.getElementById("autoProgressionToggleBtn").dispatchEvent(new AP66.window.Event("click",{bubbles:true}));
check("v66 assisted progression reduces assistance and labels it clearly", AP66.window.eval(`(()=>{const x=prefillRows({name:"Assisted Wide Grip Pull Ups",scheme:"3×8"},[{w:80,r:8},{w:80,r:8},{w:80,r:8}]);return x.auto&&x.autoDelta===-5&&x.rows.every(r=>r.w===75);})()`));
const foodSrc66 = fs.readFileSync(path.join(__dirname, "..", "scripts", "02-food.js"), "utf8");
check("v66 scanner enables native BarcodeDetector with a safe fallback", foodSrc66.includes("useBarCodeDetectorIfSupported: true") && foodSrc66.includes("new window.Html5Qrcode"));
check("v66 scanner checks frames faster and uses the adaptive square crop", foodSrc66.includes("fps: 20") && foodSrc66.includes("qrbox: barcodeScanBox") && AP66.window.eval(`(()=>{const b=barcodeScanBox(320,500);return b.width===288&&b.height===288;})()`));
check("v66 scanner overlay tells users not to rotate the phone", /Keep the phone upright/.test(dAP66.getElementById("scanHint").textContent) && /horizontal or vertical/.test(dAP66.getElementById("scanHint").textContent));

// ================= v58: self-hosted barcode scanner =================
check("v58 vendored scanner library exists in the repo", fs.existsSync(path.join(__dirname, "..", "vendor", "html5-qrcode.min.js")));
check("v58 scanner license notice preserved alongside the library", (()=>{ const p=path.join(__dirname, "..", "vendor", "html5-qrcode.LICENSE.txt"); return fs.existsSync(p) && /Apache License/.test(fs.readFileSync(p,"utf8")); })());
const sw58 = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
check("v58 SW SHELL precaches the vendored scanner", sw58.includes('"./vendor/html5-qrcode.min.js"'));
const foodSrc = fs.readFileSync(path.join(__dirname, "..", "scripts", "02-food.js"), "utf8");
check("v58 scanner loader uses the local repository path", foodSrc.includes('s.src = "vendor/html5-qrcode.min.js"'));
check("v58 no scanner code is requested from unpkg or any external origin", !/unpkg|jsdelivr|cdnjs/i.test(foodSrc) && !/s\.src\s*=\s*"https?:/.test(foodSrc));
check("v58 scanner load-failure fallback message intact", /Scanner library failed to load/.test(foodSrc));

// ================= Phase 1: extracted data payloads =================
const P = boot(EXISTING_CFG, EMPTY_DATA);
check("QUOTES loads from data-quotes.js", P.window.eval("Array.isArray(QUOTES) && QUOTES.length > 100"));
check("LOCAL_DB loads from data-foods.js", P.window.eval("Array.isArray(LOCAL_DB) && LOCAL_DB.length > 100"));
check("ALT_MAP loads from data-foods.js", P.window.eval("typeof ALT_MAP==='object' && Object.keys(ALT_MAP).length > 10"));
check("local food search still finds LOCAL_DB entries", P.window.eval(`LOCAL_DB.some(f=>/chicken breast/i.test(f.n))`));
const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
check("SW precaches the five data files", ["data-quotes.js","data-foods.js","data-suggestions.js","data-faq.js","data-exercises.js"].every(f=>sw.includes('"./'+f+'"')));
check("SW cache name matches the release", /const CACHE = "blackpyre-v\d+(?:-\d+)?"/.test(sw));
check("native service-worker cache is bumped", sw.includes('const CACHE = "blackpyre-v95"'));

const nativePrep76 = fs.readFileSync(
  path.join(__dirname,"..","tools","prepare-native.sh"),
  "utf8"
);
check(
  "v76 native prep copies the canonical exercise library before Capacitor sync",
  /^\s*data-exercises\.js\s+\\$/m.test(nativePrep76)
  && nativePrep76.indexOf("data-exercises.js")
     < nativePrep76.indexOf("npx cap sync ios")
);

const rawIndex = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

check(
  "v90-15 set fields keep focus visible and Remove copy contained",
  /\.set-controls-line \.snum:focus-visible \{[^}]*position:relative;[^}]*z-index:2;[^}]*outline-offset:0;/.test(rawIndex)
  && /\.workout-set-row \.set-remove-direct \{[^}]*padding:5px 1px;[^}]*overflow:hidden;[^}]*font-size:10px;[^}]*white-space:nowrap;/.test(rawIndex)
);

check("Undo reserves bottom space and stacks above both collapsed and expanded Train timer controls",
  /body\.undo-toast-visible\s*\{\s*padding-bottom:164px;\s*\}/.test(rawIndex)
  && /body\.rest-dock-visible\.undo-toast-visible\s*\{\s*padding-bottom:232px;\s*\}/.test(rawIndex)
  && /body\.rest-dock-visible\.rest-options-open\.undo-toast-visible\s*\{\s*padding-bottom:326px;\s*\}/.test(rawIndex)
  && /body\.rest-dock-visible #undoToast\s*\{[^}]*bottom:calc\(132px \+ env\(safe-area-inset-bottom, 0px\)\);[^}]*\}/s.test(rawIndex)
  && /body\.rest-dock-visible\.rest-options-open #undoToast\s*\{[^}]*bottom:calc\(226px \+ env\(safe-area-inset-bottom, 0px\)\);[^}]*\}/s.test(rawIndex));

check("data scripts load before the app scripts (raw file order)",
  ["data-quotes.js","data-foods.js","data-suggestions.js","data-faq.js","data-exercises.js"].every(f=>
    rawIndex.indexOf('src="'+f+'"') > -1 &&
    rawIndex.indexOf('src="'+f+'"') < rawIndex.indexOf('src="scripts/01-storage.js"')));

// ================= Phase 2: sliced app scripts =================
const SLICES = ["01-storage.js","02-food.js","03-train.js","04-weight.js","05-ai.js","06-settings.js","07-boot.js"];
check("all 7 slices exist on disk", SLICES.every(f=>fs.existsSync(path.join(__dirname, "..", "scripts", f))));
check("index.html loads the 7 slices in ascending order", (()=>{
  const pos = SLICES.map(f=>rawIndex.indexOf('src="scripts/'+f+'"'));
  return pos.every(p=>p>-1) && pos.every((p,i)=>i===0 || p>pos[i-1]);
})());
check("no inline app script remains in index.html", !/<script>(?!\s*<)/.test(rawIndex.replace(/<script src="[^"]*"><\/script>/g,"")));
check("SW precaches all 7 slices", SLICES.every(f=>sw.includes('"./scripts/'+f+'"')));

// ================= Phase 2 corrections: strict mode, exact order, migration identity =================
const LOCAL_SCRIPTS = [
  "data-quotes.js",
  "data-foods.js",
  "data-suggestions.js",
  "data-faq.js",
  "data-exercises.js",
  "data-exercise-card-profiles.js",
  "scripts/01-storage.js",
  "scripts/02-food.js",
  "scripts/03-card-profiles.js",
  "scripts/03-train.js",
  "scripts/04-weight.js",
  "scripts/05-ai.js",
  "scripts/06-settings.js",
  "scripts/07-boot.js"
];
check("every local classic script begins with the strict-mode directive",
  LOCAL_SCRIPTS.every(f=>fs.readFileSync(path.join(__dirname, "..", f), "utf8").startsWith('"use strict";')));

const APPROVED_ORDER = LOCAL_SCRIPTS; // data files, then slices 01..07 — this order is load-bearing
const scriptTags = [...rawIndex.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
check(
  "exactly the 14 approved scripts, each exactly once, in the approved order",
  scriptTags.length===APPROVED_ORDER.length
    && scriptTags.every(
      (tag,index)=>tag[1]===APPROVED_ORDER[index]
    )
);
check("no local script tag uses async, defer, or type=module",
  scriptTags.every(t=>!/\basync\b|\bdefer\b|type="module"/.test(t[0])));

// TOMBSTONE — "Phase 2 migration identity" (retired v44, per approved plan).
// From v43 until v44 this suite verified that the normalized concatenation of the seven
// slices hashed to the v42 inline JS: sha256
//   63ea5e9bd80a069bdfaeb59c954bdcf521a8593da3cf200569d6719e47d53bba
// (190,324 UTF-8 bytes / 189,847 characters). It passed on every run. v44 is the first
// release that intentionally edits a slice, so the frozen hash can no longer hold; the
// full proof and method are preserved permanently in tests/PHASE2-PROOF.md. The checks
// below verify different, lasting invariants (order, strict mode, attributes, openers).
const SLICE_OPENERS = {
  "01-storage.js":"storage keys & defaults", "02-food.js":"bars", "03-train.js":"TRAIN",
  "04-weight.js":"WEIGHT", "05-ai.js":"V23: WATER",
  "06-settings.js":"FIRST-RUN SETUP WIZARD", "07-boot.js":"DASH" };
check("every slice opens with strict mode then its expected section marker",
  SLICES.every(f=>{
    const lines = fs.readFileSync(path.join(__dirname, "..", "scripts", f), "utf8").split("\n");
    return lines[0]==='"use strict";' && lines[1].startsWith("// ==") && lines[1].includes(SLICE_OPENERS[f]);
  }));
check("SW update mechanics unchanged (skipWaiting, clients.claim, cache-first shell)",
  sw.includes("skipWaiting()") && sw.includes("clients.claim()") && sw.includes("caches.open(CACHE)"));

// ================= v55: interface simplification, timer consolidation, offline clarity =================
const T55 = boot(V3_CFG, EMPTY_DATA);
const dT55 = T55.window.document;
const clickT55 = id=>dT55.getElementById(id).dispatchEvent(new T55.window.Event("click",{bubbles:true}));
check("v55 Home keeps secondary content collapsed by default",
  dT55.getElementById("homeProgressDetails").open===false && dT55.getElementById("homeCoachDetails").open===false);
check("v55 Settings opens daily targets but collapses optional service and data sections",
  dT55.getElementById("settingsGoalsDetails").open===true && dT55.getElementById("settingsServicesDetails").open===false && dT55.getElementById("settingsDataDetails").open===false);
check("v55 removes the duplicate Train rest-duration row",
  !dT55.getElementById("trainingToolsCard").querySelector("#restPresets") && dT55.getElementById("restDockOptions").contains(dT55.getElementById("restPresets")));
T55.window.eval('activateView("work",null,false)');
clickT55("restDurationBtn");
check("v55 tapping the floating duration opens quick rest choices",
  !dT55.getElementById("restDockOptions").classList.contains("hidden") && dT55.getElementById("restDurationBtn").getAttribute("aria-expanded")==="true" && dT55.body.classList.contains("rest-options-open"));
check("v55 floating timer offers the approved 30, 60, 90, and 120 second quick durations",
  ["0:30","1:00","1:30","2:00"].every(t=>[...dT55.querySelectorAll("#restPresets .xbtn")].some(b=>b.textContent===t)));
const v55Preset120=[...dT55.querySelectorAll("#restPresets .xbtn")].find(b=>b.textContent==="2:00");
v55Preset120.dispatchEvent(new T55.window.Event("click",{bubbles:true}));
check("v55 choosing a duration updates the timer and recloses the compact chooser",
  T55.window.eval("cfg.restSec===120") && dT55.getElementById("restDisplay").textContent==="2:00" && dT55.getElementById("restDockOptions").classList.contains("hidden") && !dT55.body.classList.contains("rest-options-open"));
clickT55("restStartBtn");
clickT55("restDurationBtn");

const v76RunningPreset30 =
  [...dT55.querySelectorAll(
    "#restPresets .xbtn"
  )].find(button=>
    button.textContent.trim()==="0:30"
  );

if (v76RunningPreset30){
  v76RunningPreset30.dispatchEvent(
    new T55.window.Event(
      "click",
      {bubbles:true}
    )
  );
}

const v76RunningTimerRecord =
  JSON.parse(
    T55.window.localStorage.getItem(
      "forge:rest-timer"
    )
  ) || {};

check(
  "v76 quick duration immediately replaces a running countdown",
  !!v76RunningPreset30
  && T55.window.eval(`
    restRunning
    && !restPaused
    && restRemaining===30
    && restDurationSec===30
    && cfg.restSec===30
  `)
  && dT55.getElementById(
    "restDisplay"
  ).textContent==="0:30"
  && v76RunningTimerRecord.status==="running"
  && v76RunningTimerRecord.remainingSec===30
  && v76RunningTimerRecord.durationSec===30
  && dT55.getElementById(
    "restDockOptions"
  ).classList.contains("hidden")
);

clickT55("restPauseBtn");
clickT55("restDurationBtn");

const v76PausedPreset60 =
  [...dT55.querySelectorAll(
    "#restPresets .xbtn"
  )].find(button=>
    button.textContent.trim()==="1:00"
  );

if (v76PausedPreset60){
  v76PausedPreset60.dispatchEvent(
    new T55.window.Event(
      "click",
      {bubbles:true}
    )
  );
}

const v76PausedTimerRecord =
  JSON.parse(
    T55.window.localStorage.getItem(
      "forge:rest-timer"
    )
  ) || {};

check(
  "v76 quick duration immediately replaces a paused countdown without resuming it",
  !!v76PausedPreset60
  && T55.window.eval(`
    !restRunning
    && restPaused
    && restRemaining===60
    && restDurationSec===60
    && cfg.restSec===60
  `)
  && dT55.getElementById(
    "restDisplay"
  ).textContent==="1:00"
  && dT55.getElementById(
    "restPauseBtn"
  ).textContent==="Resume"
  && v76PausedTimerRecord.status==="paused"
  && v76PausedTimerRecord.remainingSec===60
  && v76PausedTimerRecord.durationSec===60
);

clickT55("restEndBtn");

Object.defineProperty(T55.window.navigator,"onLine",{configurable:true,value:false});
T55.window.dispatchEvent(new T55.window.Event("offline"));
check("v55 offline notice explains what remains available",
  !dT55.getElementById("offlineBanner").classList.contains("hidden") && /Logging, workouts, weights/.test(dT55.getElementById("offlineBanner").textContent) && /need a connection/.test(dT55.getElementById("offlineBanner").textContent));
Object.defineProperty(T55.window.navigator,"onLine",{configurable:true,value:true});
T55.window.dispatchEvent(new T55.window.Event("online"));
check("v55 offline notice clears automatically when connection returns", dT55.getElementById("offlineBanner").classList.contains("hidden"));
const v55Originals={cfg:T55.window.localStorage.getItem("forge:cfg"),data:T55.window.localStorage.getItem("forge:data"),program:T55.window.localStorage.getItem("forge:program"),legacyData:null};
T55.window.localStorage.setItem("forge:quarantine",JSON.stringify({recoveryFormatVersion:1,quarantinedAt:"2026-07-15T12:00:00.000Z",diagnostic:{stage:"test",part:"state",code:"test",reason:"test"},originals:v55Originals}));
dT55.getElementById("settingsDataDetails").open=false;
T55.window.eval("renderRecoveryStatus()");
check("v55 Data & recovery opens automatically when a recovery copy needs attention", dT55.getElementById("settingsDataDetails").open===true && !dT55.getElementById("quarantineCard").classList.contains("hidden"));
check("v55 common compact controls retain practical touch targets",
  /\.xbtn \{[^}]*min-height:44px/.test(rawIndex) && /\.btn\.small, \.chip, \.faq-q, \.seg button \{ min-height:44px; \}/.test(rawIndex));
check(
  "v76 exercise names remain smaller than verified card headings without changing field labels",
  /\.exercise \.x-head b \{[^}]*font-size:14px[^}]*font-weight:700[^}]*overflow-wrap:anywhere/.test(rawIndex)
  && /\.card > \.label:first-child,\s*#trainingToolsCard > \.row:first-child > \.label:first-child \{[^}]*font-size:16px[^}]*font-weight:700/.test(rawIndex)
  && /\.label \{ font-size:10px; letter-spacing:\.14em;/.test(rawIndex)
  && /\.exercise \.x-head \.scheme \{[^}]*font-size:12px/.test(rawIndex)
);

check(
  "v76 My Exercises uses the 16px card-heading level while Save Exercise keeps the selected accent",
  rawIndex.includes(".my-exercises-launch-title { font-family:'Oswald',sans-serif; font-size:16px;")
  && rawIndex.includes(".xbtn.saveExBtn { background:var(--ember); border-color:var(--ember); color:#101215; font-weight:700;")
  && /\.xbtn\.saveExBtn \{[^}]*background:var\(--ember\)[^}]*border-color:var\(--ember\)[^}]*color:#101215/.test(
       rawIndex
     )
  && /\.xbtn \{[^}]*background:transparent/.test(
       rawIndex
     )
);

check(
  "v76 rest-duration dropdown has a larger visible control, chevron, and tap target",
  /\.rest-dock-readout \{[^}]*min-width:124px[^}]*min-height:52px[^}]*padding:8px 12px[^}]*border:1px solid/.test(rawIndex)
  && /\.rest-dock-caret \{[^}]*min-width:24px[^}]*min-height:24px[^}]*font-size:20px[^}]*font-weight:700/.test(rawIndex)
);

// ================= v56: persistent drafts, action safety, offline fast-fail =================
const D56 = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dD56=D56.window.document;

const wD56=
  dD56.querySelector(
    '#exerciseInputs input[data-field="weight"]'
  );

const rD56=
  dD56.querySelector(
    '#exerciseInputs input[data-field="reps"]'
  );

wD56.value="145";
wD56.dispatchEvent(
  new D56.window.Event("input",{bubbles:true})
);

rD56.value="5";
rD56.dispatchEvent(
  new D56.window.Event("input",{bubbles:true})
);

dD56.querySelector(
  "#exerciseInputs .saveExBtn"
).dispatchEvent(
  new D56.window.Event("click",{bubbles:true})
);

const draft56Raw=
  D56.window.localStorage.getItem("forge:data");

const draft56=
  JSON.parse(draft56Raw).activeWorkoutDraft;

check(
  "v56 Save Exercise persists a resumable workout draft",
  !!draft56
  && draft56.day==="D1"
  && draft56.sets["Bench Press"][0].w===145
);

check(
  "v90 partial saved draft preserves all programmed row positions",
  !!draft56.rowStates
  && Array.isArray(draft56.rowStates["Bench Press"])
  && draft56.rowStates["Bench Press"].length===3
  && draft56.rowStates["Bench Press"][0].touched===true
  && draft56.rowStates["Bench Press"][1].touched===false
  && draft56.rowStates["Bench Press"][2].touched===false
  && draft56.rowStates["Bench Press"].every(
       row=>row.prescribed===true
     )
);

check(
  "v56 saved draft refreshes last-known-good recovery",
  JSON.parse(
    JSON.parse(
      D56.window.localStorage.getItem("forge:lkg")
    ).strings.data
  ).activeWorkoutDraft.sets["Bench Press"][0].w===145
);

check(
  "v56 active draft stays out of the way while the workout is already open",
  dD56.getElementById("workoutDraftCard")
    .classList.contains("hidden")
);

const D56Reload=
  bootRaw({
    cfg:D56.window.localStorage.getItem("forge:cfg"),
    data:draft56Raw,
    program:D56.window.localStorage.getItem("forge:program"),
    lkg:D56.window.localStorage.getItem("forge:lkg")
  });

const dD56R=D56Reload.window.document;

check(
  "v56 reload offers Resume or Discard instead of losing saved exercise work",
  !dD56R.getElementById("workoutDraftCard")
    .classList.contains("hidden")
  && dD56R.getElementById("resumeWorkoutDraftBtn")
  && dD56R.getElementById("discardWorkoutDraftBtn")
);

dD56R.getElementById("resumeWorkoutDraftBtn")
  .dispatchEvent(
    new D56Reload.window.Event("click",{bubbles:true})
  );

check(
  "v90 Resume restores the saved partial exercise and its unresolved programmed rows",
  D56Reload.window.eval(`
    workoutDraftLoaded
    && sessionState["Bench Press"].status==="saved"
    && sessionState["Bench Press"].saved[0].w===145
    && sessionState["Bench Press"].rows.length===3
    && sessionState["Bench Press"].rows[0].touched===true
    && sessionState["Bench Press"].rows[1].touched===false
    && sessionState["Bench Press"].rows[2].touched===false
    && sessionState["Bench Press"].rows.every(
         row=>row.prescribed===true
       )
  `)
  && /Completed/.test(
       dD56R.getElementById("exerciseInputs").textContent
     )
);

dD56R.getElementById("logWorkoutBtn")
  .dispatchEvent(
    new D56Reload.window.Event("click",{bubbles:true})
  );

check(
  "v90 resumed partial draft cannot silently log unresolved programmed sets",
  D56Reload.window.eval(`
    data.workouts.length===0
    && data.activeWorkoutDraft!==null
  `)
  && /Resolve the remaining planned sets/.test(
       dD56R.getElementById("workoutErr").textContent
     )
);

const edit56=
  [...dD56R.querySelectorAll("#exerciseInputs .xbtn")]
    .find(button=>button.textContent==="Edit");

edit56.dispatchEvent(
  new D56Reload.window.Event("click",{bubbles:true})
);

dD56R.querySelector(
  '[data-exercise="Bench Press"][data-set-action="skip-remaining"]'
).dispatchEvent(
  new D56Reload.window.Event("click",{bubbles:true})
);

dD56R.querySelector(
  "#exerciseInputs .saveExBtn"
).dispatchEvent(
  new D56Reload.window.Event("click",{bubbles:true})
);

check(
  "v90 resolved draft updates persisted row outcomes before final logging",
  D56Reload.window.eval(`
    data.activeWorkoutDraft
    && data.activeWorkoutDraft.sets["Bench Press"].length===3
    && data.activeWorkoutDraft.sets["Bench Press"][1].status==="skipped"
    && data.activeWorkoutDraft.sets["Bench Press"][2].status==="skipped"
  `)
);

dD56R.getElementById("logWorkoutBtn")
  .dispatchEvent(
    new D56Reload.window.Event("click",{bubbles:true})
  );

check(
  "v56 successful Log Session clears the resolved draft and saves history",
  D56Reload.window.eval(`
    data.activeWorkoutDraft===null
    && data.workouts.length===1
    && data.workouts[0].sets["Bench Press"][0].w===145
    && data.workouts[0].sets["Bench Press"][1].status==="skipped"
    && data.workouts[0].sets["Bench Press"][2].status==="skipped"
  `)
  && JSON.parse(
       D56Reload.window.localStorage.getItem("forge:data")
     ).activeWorkoutDraft===null
);

const D56Fail=
  bootRaw({
    cfg:D56.window.localStorage.getItem("forge:cfg"),
    data:draft56Raw,
    program:D56.window.localStorage.getItem("forge:program")
  });

const dD56Fail=D56Fail.window.document;

dD56Fail.getElementById("resumeWorkoutDraftBtn")
  .dispatchEvent(
    new D56Fail.window.Event("click",{bubbles:true})
  );

const edit56Fail=
  [...dD56Fail.querySelectorAll("#exerciseInputs .xbtn")]
    .find(button=>button.textContent==="Edit");

edit56Fail.dispatchEvent(
  new D56Fail.window.Event("click",{bubbles:true})
);

dD56Fail.querySelector(
  '[data-exercise="Bench Press"][data-set-action="skip-remaining"]'
).dispatchEvent(
  new D56Fail.window.Event("click",{bubbles:true})
);

dD56Fail.querySelector(
  "#exerciseInputs .saveExBtn"
).dispatchEvent(
  new D56Fail.window.Event("click",{bubbles:true})
);

const d56Proto=
  Object.getPrototypeOf(D56Fail.window.localStorage);

const d56Set=d56Proto.setItem;

d56Proto.setItem=function(key,value){
  if (key==="forge:data"){
    throw new Error("blocked");
  }

  return d56Set.call(this,key,value);
};

dD56Fail.getElementById("logWorkoutBtn")
  .dispatchEvent(
    new D56Fail.window.Event("click",{bubbles:true})
  );

d56Proto.setItem=d56Set;

check(
  "v56 failed Log Session preserves the persisted and in-memory resolved draft",
  D56Fail.window.eval(`
    data.activeWorkoutDraft!==null
    && data.workouts.length===0
  `)
  && JSON.parse(
       D56Fail.window.localStorage.getItem("forge:data")
     ).activeWorkoutDraft!==null
);

const D56Discard=
  bootRaw({
    cfg:D56.window.localStorage.getItem("forge:cfg"),
    data:draft56Raw,
    program:D56.window.localStorage.getItem("forge:program")
  });

D56Discard.window.confirm=()=>true;

D56Discard.window.document
  .getElementById("discardWorkoutDraftBtn")
  .dispatchEvent(
    new D56Discard.window.Event("click",{bubbles:true})
  );

check(
  "v56 confirmed Discard removes the saved draft",
  D56Discard.window.eval("data.activeWorkoutDraft===null")
  && JSON.parse(
       D56Discard.window.localStorage.getItem("forge:data")
     ).activeWorkoutDraft===null
);

const deleteDay=dstr(0);
const deleteData={food:{},workouts:[{date:deleteDay,day:"D1",title:"Delete Me",sets:{Squat:[{w:100,r:5}]},notes:""}],weights:[{date:deleteDay,lbs:200}],measure:[{date:deleteDay,waist:36,chest:42,arm:15}],myFoods:{abc:{name:"Saved Food",brand:"Mine",cal100:100,pro100:10,carb100:5,fat100:2}},meals:[{name:"Saved Meal",items:[{name:"Food",cal:100,pro:10,carb:5,fat:2,meal:"other"}]}],meta:{lastBackup:null,logsSince:0},activeWorkoutDraft:null};
deleteData.food[deleteDay]=[{name:"Food Entry",cal:100,pro:10,carb:5,fat:2,meal:"other"}];
const U56=boot(Object.assign({},V3_CFG,{measureOn:true}),deleteData,null,TEST_PROGRAM);
const dU56=U56.window.document;
dU56.querySelector("#workHistory .delWork").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
check("v56 workout deletion offers working Undo", U56.window.eval("data.workouts.length")===0 && !dU56.getElementById("undoToast").classList.contains("hidden"));
dU56.getElementById("undoBtn").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
check("v56 Undo restores a deleted workout", U56.window.eval("data.workouts.length")===1);
dU56.querySelector("#wtList .delWt").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
dU56.getElementById("undoBtn").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
check("v56 Undo restores a deleted weigh-in", U56.window.eval("data.weights.length")===1);
dU56.querySelector("#mList .mdel").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
dU56.getElementById("undoBtn").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
check("v56 Undo restores deleted body measurements", U56.window.eval("data.measure.length")===1);
U56.window.eval("removeEntry(0)");
dU56.getElementById("undoBtn").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
check("v56 food-entry deletion uses the shared Undo service", U56.window.eval(`data.food[${JSON.stringify(deleteDay)}].length`)===1);
U56.window.eval("renderMyFoods()");
dU56.querySelector("#mfList .del").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
dU56.getElementById("undoBtn").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
check("v56 Undo restores a deleted personal food", U56.window.eval("!!data.myFoods.abc"));
U56.window.eval("deleteSavedMealAt(0)");
dU56.getElementById("undoBtn").dispatchEvent(new U56.window.Event("click",{bubbles:true}));
check("v56 Undo restores a deleted saved meal", U56.window.eval("data.meals.length")===1);

const M56=boot(V3_CFG,V2_DATA);
const dM56=M56.window.document;
dM56.getElementById("mCal").value="200";
dM56.getElementById("addManualBtn").dispatchEvent(new M56.window.Event("click",{bubbles:true}));
check("v56 manual food missing a name explains and focuses the name field", dM56.activeElement===dM56.getElementById("mName") && /food name/.test(dM56.getElementById("saveState").textContent));
dM56.getElementById("mName").value="Test food"; dM56.getElementById("mCal").value="";
dM56.getElementById("addManualBtn").dispatchEvent(new M56.window.Event("click",{bubbles:true}));
check("v56 manual food missing calories explains and focuses calories", dM56.activeElement===dM56.getElementById("mCal") && /valid calories/.test(dM56.getElementById("saveState").textContent));

const P56=boot(V3_CFG,Object.assign({},V2_DATA,{workouts:[{date:deleteDay,day:"D1",title:"History",sets:{},notes:""}]}),null,TEST_PROGRAM);
P56.window.confirm=()=>false;
let replace56=P56.window.eval(`replaceActiveProgram({name:"New Program",days:[{id:"N1",title:"New",exercises:[{name:"Squat"}]}]})`);
check("v56 canceling program replacement preserves the active program and history", replace56.cancelled && P56.window.eval("program.name")===TEST_PROGRAM.name && P56.window.eval("data.workouts.length")===1);
P56.window.confirm=()=>true;
replace56=P56.window.eval(`replaceActiveProgram({name:"New Program",days:[{id:"N1",title:"New",exercises:[{name:"Squat"}]}]})`);
check("v56 confirmed program replacement changes only the program", replace56.ok && P56.window.eval("program.name")==="New Program" && P56.window.eval("data.workouts.length")===1);

const O56=boot(Object.assign({},V3_CFG,{usdaKey:"k",anthropicKey:"sk-test",aiProvider:"anthropic"}),V2_DATA,w=>{w.__netCalls=[];w.fetch=(...a)=>{w.__netCalls.push(a);return Promise.reject(new Error("should not fetch"));};});
const dO56=O56.window.document;
Object.defineProperty(O56.window.navigator,"onLine",{configurable:true,value:false});
dO56.getElementById("foodQuery").value="chicken";
await O56.window.eval("runSearch()");
check("v56 offline food search skips network and shows local results immediately", O56.window.__netCalls.length===0 && dO56.getElementById("results").children.length>0 && /online databases were skipped/.test(dO56.getElementById("searchErr").textContent));
dO56.getElementById("barcodeInput").value="999999";
await O56.window.eval("runBarcode()");
check("v56 offline barcode lookup skips network and opens manual entry", O56.window.__netCalls.length===0 && !dO56.getElementById("customCard").classList.contains("hidden") && /online barcode lookup was skipped/.test(dO56.getElementById("searchErr").textContent));
dO56.getElementById("scanBtn").dispatchEvent(new O56.window.Event("click",{bubbles:true}));
await wait(5);
check("v56 offline scanner fast-fails without loading its external library", O56.window.__netCalls.length===0 && /needs a connection/.test(dO56.getElementById("scanErr").textContent) && ![...dO56.querySelectorAll('script[src]')].some(x=>/html5-qrcode/.test(x.src)));
await O56.window.eval(`anthropicCall([],"",10).catch(e=>{window.__offlineAI=e.message;})`);
check("v56 direct-provider AI fast-fails offline and points to handoff", O56.window.__netCalls.length===0 && /offline/.test(O56.window.__offlineAI) && /handoff/.test(O56.window.__offlineAI));

// ================= v53: mobile set-row alignment =================
check("mobile set controls stay together after checkmark removal",
  /@media \(max-width:520px\)[\s\S]*?\.srow \.slabel \{ flex:1 1 100%;/.test(rawIndex) &&
  !/@media \(max-width:520px\)[\s\S]*?\.srow > \.sdone/.test(rawIndex));

// ================= v57: accessibility completion =================
const hasAccessibleName57 = el=>{
  if (!el) return false;
  if ((el.getAttribute("aria-label")||"").trim()) return true;
  const by=(el.getAttribute("aria-labelledby")||"").trim();
  if (by && by.split(/\s+/).some(id=>{ const n=el.ownerDocument.getElementById(id); return n && n.textContent.trim(); })) return true;
  if (el.id){
    const label=el.ownerDocument.querySelector('label[for="'+el.id.replace(/"/g,'\\"')+'"]');
    if (label && label.textContent.trim()) return true;
  }
  return el.tagName==="BUTTON" && !!el.textContent.trim();
};
const A57=boot(Object.assign({},V3_CFG,{anthropicKey:"sk-test",aiProvider:"anthropic"}),V2_DATA,null,TEST_PROGRAM);
const dA57=A57.window.document;
A57.window.eval(`renderSessionInputs(); renderRecents(); renderMyFoods(); openBuilder(false); renderResults([{name:"Accessible chicken",brand:"Suite",cal100:165,pro100:31,carb100:0,fat100:3.6}]);`);
await wait(40);
let controls57=[...dA57.querySelectorAll("input,select,textarea,button")];
check("v57 every shipped and rendered form control has an accessible name", controls57.length>150 && controls57.every(hasAccessibleName57));

const tabs57=[...dA57.querySelectorAll('[role="tablist"] [role="tab"]')];
check("v57 bottom navigation exposes one named tablist with five controlled tabs", tabs57.length===5 && tabs57.every(t=>t.id && dA57.getElementById(t.getAttribute("aria-controls"))));
const homeTab57=dA57.getElementById("tab-dash"), foodTab57=dA57.getElementById("tab-food");
homeTab57.focus();
homeTab57.dispatchEvent(new A57.window.KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
await wait(10);
check("v57 arrow-key tab navigation activates and focuses the next view", dA57.activeElement===foodTab57 && foodTab57.getAttribute("aria-selected")==="true" && dA57.getElementById("view-food").getAttribute("aria-hidden")==="false");
foodTab57.dispatchEvent(new A57.window.KeyboardEvent("keydown",{key:"End",bubbles:true}));
await wait(10);
check("v57 Home and End keys move to the first and last navigation tabs", dA57.activeElement===dA57.getElementById("tab-settings") && dA57.getElementById("tab-settings").getAttribute("aria-selected")==="true");

const dialogs57=[...dA57.querySelectorAll('[role="dialog"]')];
check("v57 every full-screen panel has modal dialog semantics and a valid title", dialogs57.length>=10 && dialogs57.every(d=>d.getAttribute("aria-modal")==="true" && d.getAttribute("tabindex")==="-1" && dA57.getElementById(d.getAttribute("aria-labelledby"))));
const faqOpen57=dA57.getElementById("faqOpenBtn");
faqOpen57.focus(); faqOpen57.click(); await wait(40);
check("v57 opening Help moves focus into its dialog", dA57.activeElement===dA57.getElementById("faqCloseBtn"));
dA57.getElementById("faqCloseBtn").click(); await wait(40);
check("v57 closing Help returns focus to its opener", dA57.activeElement===faqOpen57);
const coachOpen57=dA57.getElementById("coachOpenBtn");
coachOpen57.classList.remove("hidden"); coachOpen57.focus(); coachOpen57.click(); await wait(40);
check("v57 opening Coach focuses its message field", dA57.activeElement===dA57.getElementById("coachInput"));
dA57.getElementById("coachCloseBtn").click(); await wait(40);
check("v57 closing Coach returns focus to its opener", dA57.activeElement===coachOpen57);

const result57=dA57.querySelector("#results .result");
check("v57 food search results are named native buttons", result57 && result57.tagName==="BUTTON" && hasAccessibleName57(result57));
result57.click();
check("v57 keyboard-compatible food result selection still opens the amount card", !dA57.getElementById("calcCard").classList.contains("hidden"));
A57.window.eval(`data.recents=[{name:"Recent oats",brand:"Suite",cal100:380,pro100:13,carb100:68,fat100:7}]; renderRecents();`);
await wait(20);
const recent57=dA57.querySelector("#recentsList .result");
check("v57 recent-food rows are named native buttons", recent57 && recent57.tagName==="BUTTON" && hasAccessibleName57(recent57));

A57.window.eval(`activateView("work",null,true); renderSessionInputs();`); await wait(20);
const sessionControls57=[...dA57.querySelectorAll("#exerciseInputs input, #exerciseInputs button")];
check("v57 dynamic workout fields and step controls name exercise, set, and action", sessionControls57.length>5 && sessionControls57.every(hasAccessibleName57) && sessionControls57.some(e=>/Bench Press set 1 weight/i.test(e.getAttribute("aria-label")||"")));
A57.window.eval(`openBuilder(false);`); await wait(20);
const builderSymbols57=[...dA57.querySelectorAll("#builderCard button")].filter(b=>/[↑↓✕×]/.test(b.textContent));
check("v57 program-builder symbol controls have explicit names", builderSymbols57.length>0 && builderSymbols57.every(hasAccessibleName57));

const fresh57=boot(null,null);
const dFresh57=fresh57.window.document;
fresh57.window.eval(`cfg.startWt=220; cfg.calTarget=1800; setupChoice.calc={cal:1800,pro:198,carb:153,fat:50,tdee:2300}; setupChoice.split={mode:"rec",p:40,c:30,f:30}; setupChoice.schedMode="same";`);
let setupNamed57=true;
for (let step57=0; step57<8; step57++){
  fresh57.window.eval(`setupStep=${step57}; renderSetupStep();`);
  await wait(20);
  setupNamed57 = setupNamed57 && [...dFresh57.querySelectorAll("#setupBody input,#setupBody select,#setupBody textarea,#setupBody button")].every(hasAccessibleName57);
}
check("v57 every dynamically rendered onboarding control has an accessible name", setupNamed57);

fresh57.window.eval(`setupStep=6; renderSetupStep();`);
await wait(20);
check("food onboarding explains logging without obsolete credential language or fields",
  /Search packaged foods or scan a barcode when connected/.test(dFresh57.getElementById("setupBody").textContent) &&
  /If a product is missing, enter the nutrition label/.test(dFresh57.getElementById("setupBody").textContent) &&
  !/account or API key/i.test(dFresh57.getElementById("setupBody").textContent) &&
  !dFresh57.querySelector("#setupBody input"));
dFresh57.getElementById("setupNext").click();
await wait(20);
check("v81 keyless food onboarding advances without saving a credential",
  fresh57.window.eval(`setupStep===7 && !Object.prototype.hasOwnProperty.call(cfg,"usdaKey")`) &&
  !Object.prototype.hasOwnProperty.call(JSON.parse(fresh57.window.localStorage.getItem("forge:cfg")),"usdaKey"));

check("v57 errors and save/network messages expose live status semantics", dA57.getElementById("searchErr").getAttribute("role")==="alert" && dA57.getElementById("saveState").getAttribute("role")==="status" && dA57.getElementById("offlineBanner").getAttribute("role")==="status");
A57.window.eval("renderFAQ()");
// ================= v63: missing-primary protection and rolling recovery =================
const V63_POPULATED_DATA = Object.assign({}, V2_DATA, {
  food:{"2026-07-20":[{name:"Chicken",cal:165,pro:31,carb:0,fat:3.6,meal:"dinner"}]},
  workouts:[{date:"2026-07-20",day:"D1",sets:{"Bench Press":[{w:185,r:5}]}}],
  weights:[{date:"2026-07-20",lbs:220}]
});
function makeV63Lkg(dataObj,savedAt){
  return JSON.stringify({recoveryFormatVersion:1,savedAt:savedAt||"2026-07-20T12:00:00.000Z",source:"v63-test",
    strings:{cfg:RAW_V3_CFG,data:JSON.stringify(dataObj),program:RAW_PROGRAM},legacyData:null});
}
const V63_POP_LKG = makeV63Lkg(V63_POPULATED_DATA);
const V63_EMPTY_LKG = makeV63Lkg(V2_DATA,"2026-07-21T12:00:00.000Z");

const Fresh63=bootRaw({});
check("v63 fresh boot persists all three primary keys", ["forge:cfg","forge:data","forge:program"].every(k=>Fresh63.window.localStorage.getItem(k)!==null));
check("v63 fresh boot establishes recovery marker and snapshot", Fresh63.window.eval(`installMarkerStatus().ok && inspectLkgRaw(localStorage.getItem("forge:lkg")).ok`));

const V63_NEWER_INSTALL = JSON.stringify({formatVersion:2,establishedAt:"future",lastHealthyAt:"future",schemaVersion:99});
const NewerInstall63=bootRaw({install:V63_NEWER_INSTALL});
check("v63 newer installation markers are preserved and cannot be mistaken for a fresh install", NewerInstall63.window.eval(`protectedMode && installMarkerStatus().newer`) && NewerInstall63.window.localStorage.getItem("forge:install")===V63_NEWER_INSTALL && NewerInstall63.window.localStorage.getItem("forge:data")===null);

const MissingData63=bootRaw({cfg:RAW_V3_CFG,program:RAW_PROGRAM,lkg:V63_POP_LKG});
check("v63 missing logs on an established install enters protected mode", MissingData63.window.eval(`protectedMode && protectedModeDiagnostic.stage==="missing-primary" && protectedModeDiagnostic.part==="data"`));
check("v63 missing-log protected view loads the validated snapshot", MissingData63.window.eval(`data.weights.length===1 && data.food["2026-07-20"].length===1`));
check("v63 missing logs are never silently recreated or allowed to replace LKG", MissingData63.window.localStorage.getItem("forge:data")===null && MissingData63.window.localStorage.getItem("forge:lkg")===V63_POP_LKG && callsFor(MissingData63,"forge:lkg").length===0);
check("v63 missing-primary recovery disables the destructive readable reset", MissingData63.window.document.getElementById("recoverReadableBtn").disabled===true && MissingData63.window.document.getElementById("recoverLkgBtn").disabled===false);

const MissingCfg63=bootRaw({data:JSON.stringify(V63_POPULATED_DATA),program:RAW_PROGRAM,lkg:V63_POP_LKG});
check("v63 missing settings on an established install enters protected mode", MissingCfg63.window.eval(`protectedMode && protectedModeDiagnostic.stage==="missing-primary" && protectedModeDiagnostic.part==="cfg"`));
check("v63 missing-settings protected view uses snapshot settings without writing defaults", MissingCfg63.window.eval(`cfg.calTarget===1800`) && MissingCfg63.window.localStorage.getItem("forge:cfg")===null);

const AllMissing63=bootRaw({lkg:V63_POP_LKG});
check("v63 all-primary-keys-missing incident remains recoverable", AllMissing63.window.eval(`protectedMode && data.weights.length===1 && cfg.calTarget===1800 && program.name==="Test Program"`));

const PreviousWins63=bootRaw({cfg:RAW_V3_CFG,program:RAW_PROGRAM,lkg:V63_EMPTY_LKG,lkgPrevious:V63_POP_LKG});
check("v63 populated previous snapshot outranks a newer empty current snapshot", PreviousWins63.window.eval(`getBestStoredLkgStatus().key===LKG_PREVIOUS_KEY && data.weights.length===1`));
check("v63 recovery summary reports multiple validated snapshots", /best of 2 validated snapshots/.test(PreviousWins63.window.eval(`buildLkgRecoveryCandidate().summary`)));

const EmptyRegression63=bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:V63_POP_LKG});
check("v63 present-but-empty regression cannot replace a populated snapshot", EmptyRegression63.window.localStorage.getItem("forge:lkg")===V63_POP_LKG && EmptyRegression63.window.eval(`lkgStatus.retained===true`));

const Old63=makeV63Lkg(Object.assign({},V63_POPULATED_DATA,{weights:[{date:"2026-07-19",lbs:221}]}),"2026-07-19T12:00:00.000Z");
const Rotate63=bootRaw({cfg:RAW_V3_CFG,data:JSON.stringify(V63_POPULATED_DATA),program:RAW_PROGRAM,lkg:Old63});
check("v63 healthy snapshot refresh rotates prior current into previous", Rotate63.window.localStorage.getItem("forge:lkg:previous")===Old63 && Rotate63.window.localStorage.getItem("forge:lkg")!==Old63);
const firstCurrent63=Rotate63.window.localStorage.getItem("forge:lkg");
Rotate63.window.eval(`data.weights.push({date:"2026-07-21",lbs:219}); save();`);
check("v63 second healthy snapshot keeps two rolling generations", Rotate63.window.localStorage.getItem("forge:lkg:previous")===firstCurrent63 && Rotate63.window.localStorage.getItem("forge:lkg:older")===Old63);

const RuntimeLoss63=bootRaw({cfg:RAW_V3_CFG,data:JSON.stringify(V63_POPULATED_DATA),program:RAW_PROGRAM});
const runtimeLkg63=RuntimeLoss63.window.localStorage.getItem("forge:lkg");
RuntimeLoss63.window.eval(`localStorage.removeItem(DATA_KEY); save();`);
check("v63 runtime disappearance pauses all later saving", RuntimeLoss63.window.eval(`protectedMode && protectedModeDiagnostic.part==="data"`));
check("v63 runtime disappearance leaves recovery snapshot byte-identical", RuntimeLoss63.window.localStorage.getItem("forge:lkg")===runtimeLkg63);

const ManualRestore63=bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:V63_POP_LKG});
const manualBefore63=ManualRestore63.window.localStorage.getItem("forge:data");
const manualResult63=ManualRestore63.window.eval(`performRecoveryCandidate(buildLkgRecoveryCandidate(),{allowNormalRestore:true})`);
check("v63 normal-mode snapshot restore is verified and reaffirms the established install", manualResult63.ok && ManualRestore63.window.eval(`data.weights.length===1 && installMarkerStatus().ok`));
check("v63 normal-mode snapshot restore quarantines exact prior primary data", JSON.parse(ManualRestore63.window.localStorage.getItem("forge:quarantine")).originals.data===manualBefore63);

const diagnostic63=ManualRestore63.window.eval(`makeStorageDiagnosticEnvelope()`);
check("v64 diagnostic export preserves primary, recovery, install, and temporary timer fields", diagnostic63.ok && ["forge:cfg","forge:data","forge:program","forge:lkg","forge:lkg:previous","forge:lkg:older","forge:quarantine","forge:install","forge:rest-timer"].every(k=>Object.prototype.hasOwnProperty.call(diagnostic63.envelope.strings,k)));
check("v63 Data & recovery exposes manual snapshot restore and diagnostic export", !!ManualRestore63.window.document.getElementById("restoreSnapshotBtn") && !!ManualRestore63.window.document.getElementById("exportDiagnosticBtn"));
// ================= Native vault Stage 1: verified iOS Library backup =================
function nativeVaultApiPresent(dom){
  try { return dom.window.eval(`typeof getNativeVaultStatus==="function" && typeof waitForNativeVaultIdle==="function"`); }
  catch(e){ return false; }
}
function nativeVaultStatusOf(dom){
  try { return dom.window.eval(`typeof getNativeVaultStatus==="function" ? getNativeVaultStatus() : null`); }
  catch(e){ return null; }
}
function nativeVaultField(dom,key){
  const status=nativeVaultStatusOf(dom);
  return status ? status[key] : undefined;
}
async function settleNativeVault(dom){
  try {
    if (dom.window.eval(`typeof waitForNativeVaultIdle==="function"`)) await dom.window.eval(`waitForNativeVaultIdle()`);
    else await wait(25);
  } catch(e){ await wait(25); }
}
function parseNativeVault(raw){ try { return JSON.parse(raw); } catch(e){ return null; } }
function exactNativeStrings(dom){
  const out={};
  ["forge:cfg","forge:data","forge:program","forge:lkg","forge:lkg:previous","forge:lkg:older","forge:quarantine","forge:install","ryan-cut:data"]
    .forEach(k=>{ out[k]=dom.window.localStorage.getItem(k); });
  return out;
}
function nativeVaultRecordMatches(dom,record){
  const expected=exactNativeStrings(dom);
  return !!record && record.type==="blackpyre-native-vault" && record.formatVersion===1
    && record.schemaVersion===3 && record.strings
    && Object.keys(expected).every(k=>Object.prototype.hasOwnProperty.call(record.strings,k) && record.strings[k]===expected[k]);
}

const PwaVault=bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM});
await settleNativeVault(PwaVault);
const pwaVaultStatus=nativeVaultStatusOf(PwaVault);
check("native vault exposes stable diagnostic and idle APIs", nativeVaultApiPresent(PwaVault));
check("native vault stays unavailable in the ordinary PWA", pwaVaultStatus && pwaVaultStatus.available===false && pwaVaultStatus.native===false);

const NotNativeFs=makeNativeFilesystem({native:false});
const NotNativeVault=bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM},w=>NotNativeFs.install(w));
await settleNativeVault(NotNativeVault);
check("Capacitor bridge presence alone cannot activate the vault on a web platform", NotNativeFs.calls.length===0 && nativeVaultField(NotNativeVault,"available")===false);

const MissingPluginFs=makeNativeFilesystem({available:false});
const MissingPluginVault=bootRaw({cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM},w=>MissingPluginFs.install(w));
await settleNativeVault(MissingPluginVault);
check("native mode without the Filesystem plugin leaves all app storage behavior unchanged", MissingPluginFs.calls.length===0 && nativeVaultField(MissingPluginVault,"available")===false);

const NATIVE_LEGACY_RAW=' {"food":{"2026-07-18":[{"name":"Legacy oats","cal":150,"pro":5,"carb":27,"fat":3}]},"workouts":[],"weights":[],"recents":[],"myFoods":{},"meals":[],"finished":{},"foodCounts":{},"mealCounts":{},"meta":{"lastBackup":null,"logsSince":0},"activeWorkoutDraft":null} ';
const NativeFs=makeNativeFilesystem();
const NativeVault=bootRaw({
  cfg:RAW_V3_CFG,
  data:JSON.stringify(V63_POPULATED_DATA),
  program:RAW_PROGRAM,
  legacyData:NATIVE_LEGACY_RAW,
  lkgPrevious:V63_EMPTY_LKG,
  lkgOlder:Old63,
  quarantine:JSON.stringify({recoveryFormatVersion:1,quarantinedAt:"2026-07-20T11:00:00.000Z",diagnostic:null,
    originals:{cfg:RAW_V3_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,legacyData:NATIVE_LEGACY_RAW}}),
  install:JSON.stringify({formatVersion:1,establishedAt:"2026-07-20T10:00:00.000Z",lastHealthyAt:"2026-07-20T10:00:00.000Z",schemaVersion:3})
},w=>NativeFs.install(w));
const nativeStorageCallsAfterBoot=NativeVault.__storageCalls.length;
await settleNativeVault(NativeVault);
const nativeStatus=nativeVaultStatusOf(NativeVault);
const nativePath=nativeStatus && nativeStatus.path;
const nativeRaw=nativePath && NativeFs.files.get(nativePath);
const nativeRecord=parseNativeVault(nativeRaw);
check("healthy native boot writes one verified vault file in the iOS Library directory", !!nativePath && NativeFs.files.size===1 && NativeFs.calls.some(c=>c.method==="writeFile"&&c.args.directory==="LIBRARY") && NativeFs.calls.some(c=>c.method==="readFile"&&c.args.path===nativePath));
check("native vault preserves every contracted localStorage value byte-for-byte", nativeVaultRecordMatches(NativeVault,nativeRecord) && nativeRecord && nativeRecord.strings && nativeRecord.strings["ryan-cut:data"]===NATIVE_LEGACY_RAW);
check("native vault work never writes, removes, or clears browser storage", NativeVault.__storageCalls.length===nativeStorageCallsAfterBoot);
check("successful native verification is visible through diagnostics", nativeStatus && nativeStatus.available===true && nativeStatus.verified===true && nativeStatus.state==="ready" && nativeStatus.lastSource==="boot");

const bootVaultRaw=nativeRaw;
NativeVault.window.eval(`data.weights.push({date:"2026-07-22",lbs:218}); window.__nativeDataSaveResult=save();`);
await settleNativeVault(NativeVault);
let refreshedRaw=NativeFs.files.get(nativePath), refreshedRecord=parseNativeVault(refreshedRaw);
check("a successful healthy data save refreshes the exact native vault", NativeVault.window.eval(`window.__nativeDataSaveResult===true`) && refreshedRaw!==bootVaultRaw && nativeVaultRecordMatches(NativeVault,refreshedRecord) && nativeVaultField(NativeVault,"lastSource")==="data-save");

NativeVault.window.eval(`cfg.goalWt=170; window.__nativeCfgSaveResult=saveCfg();`);
await settleNativeVault(NativeVault);
refreshedRecord=parseNativeVault(NativeFs.files.get(nativePath));
check("a successful healthy settings save refreshes the native vault", NativeVault.window.eval(`window.__nativeCfgSaveResult===true`) && refreshedRecord && refreshedRecord.strings && refreshedRecord.strings["forge:cfg"]===NativeVault.window.localStorage.getItem("forge:cfg") && nativeVaultField(NativeVault,"lastSource")==="settings-save");

NativeVault.window.eval(`program.name="Native Vault Program"; window.__nativeProgramSaveResult=saveProgram();`);
await settleNativeVault(NativeVault);
refreshedRecord=parseNativeVault(NativeFs.files.get(nativePath));
check("a successful healthy program save refreshes the native vault", NativeVault.window.eval(`window.__nativeProgramSaveResult===true`) && refreshedRecord && refreshedRecord.strings && refreshedRecord.strings["forge:program"]===NativeVault.window.localStorage.getItem("forge:program") && nativeVaultField(NativeVault,"lastSource")==="program-save");

const beforePrimaryFailureRaw=NativeFs.files.get(nativePath);
const nativeStore=NativeVault.window.localStorage;
const nativeProto=Object.getPrototypeOf(nativeStore);
const nativeSet=nativeProto.setItem;
nativeProto.setItem=function(k,v){ if(k==="forge:data") throw new Error("forced primary failure"); return nativeSet.call(this,k,v); };
NativeVault.window.eval(`data.weights.push({date:"2026-07-23",lbs:217}); window.__nativePrimaryFailureResult=save();`);
nativeProto.setItem=nativeSet;
await settleNativeVault(NativeVault);
check("a failed primary save never schedules or changes the native vault", NativeVault.window.eval(`window.__nativePrimaryFailureResult===false`) && NativeFs.files.get(nativePath)===beforePrimaryFailureRaw);

const beforeUnhealthyRaw=NativeFs.files.get(nativePath);
const nativeSet2=nativeProto.setItem;
nativeProto.setItem=function(k,v){ if(k==="forge:lkg") throw new Error("forced LKG failure"); return nativeSet2.call(this,k,v); };
NativeVault.window.eval(`data.weights.push({date:"2026-07-24",lbs:216}); window.__nativeUnhealthyResult=save();`);
nativeProto.setItem=nativeSet2;
await settleNativeVault(NativeVault);
check("a live save that cannot refresh validated recovery protection cannot replace the native vault", NativeVault.window.eval(`window.__nativeUnhealthyResult===true`) && NativeFs.files.get(nativePath)===beforeUnhealthyRaw);

const beforeNativeFailureRaw=NativeFs.files.get(nativePath);
const writeBaseline=NativeFs.counts().write;
NativeFs.control.failWrite=(args,ctx)=>ctx.writeCount===writeBaseline+1;
NativeVault.window.eval(`data.weights.push({date:"2026-07-25",lbs:215}); window.__nativeFailureSaveResult=save();`);
await settleNativeVault(NativeVault);
NativeFs.control.failWrite=null;
const failedNativeStatus=nativeVaultStatusOf(NativeVault);
check("native vault failure never turns a healthy normal app save into a failure", NativeVault.window.eval(`window.__nativeFailureSaveResult===true`) && JSON.parse(NativeVault.window.localStorage.getItem("forge:data")).weights.some(x=>x.date==="2026-07-25"));
check("failed native write retains the previous verified vault and reports the failure", NativeFs.files.get(nativePath)===beforeNativeFailureRaw && failedNativeStatus && failedNativeStatus.verified===true && failedNativeStatus.retainedPrevious===true && !!failedNativeStatus.lastError);

const beforeMismatchRaw=NativeFs.files.get(nativePath);
const mismatchWriteBaseline=NativeFs.counts().write;
let mismatchUsed=false;
NativeFs.control.transformRead=(args,data,ctx)=>{
  if(!mismatchUsed && ctx.writeCount>mismatchWriteBaseline){ mismatchUsed=true; return data+"corrupt"; }
  return data;
};
NativeVault.window.eval(`data.weights.push({date:"2026-07-26",lbs:214}); window.__nativeMismatchSaveResult=save();`);
await settleNativeVault(NativeVault);
NativeFs.control.transformRead=null;
const mismatchStatus=nativeVaultStatusOf(NativeVault);
check("read-back mismatch cannot promote corrupt bytes over the previous verified vault", NativeVault.window.eval(`window.__nativeMismatchSaveResult===true`) && mismatchUsed && NativeFs.files.get(nativePath)===beforeMismatchRaw);
check("read-back mismatch is exposed diagnostically without entering protected mode", mismatchStatus && mismatchStatus.retainedPrevious===true && !!mismatchStatus.lastError && NativeVault.window.eval(`protectedMode===false`));

NativeVault.window.eval(`data.weights.push({date:"2026-07-27",lbs:213}); save(); data.weights.push({date:"2026-07-28",lbs:212}); save();`);
await settleNativeVault(NativeVault);
const queuedRecord=parseNativeVault(NativeFs.files.get(nativePath));
check("rapid healthy saves serialize to a final vault matching the newest persisted state", nativeVaultRecordMatches(NativeVault,queuedRecord) && queuedRecord && queuedRecord.strings && JSON.parse(queuedRecord.strings["forge:data"]).weights.some(x=>x.date==="2026-07-28"));

const ExistingVaultFs=makeNativeFilesystem({files:{[nativePath]:NativeFs.files.get(nativePath)}});
const ExistingVaultFresh=bootRaw({},w=>ExistingVaultFs.install(w));
await settleNativeVault(ExistingVaultFresh);
check("Stage 2 restores a verified native vault into missing native localStorage",
  nativeVaultRecordMatches(ExistingVaultFresh,parseNativeVault(NativeFs.files.get(nativePath)))
  && nativeVaultField(ExistingVaultFresh,"restoreState")==="restored"
  && nativeVaultField(ExistingVaultFresh,"restoreVerified")===true);
check("a populated verified native vault remains byte-identical while restoring missing localStorage",
  ExistingVaultFs.files.get(nativePath)===NativeFs.files.get(nativePath)
  && nativeVaultField(ExistingVaultFresh,"restoreState")==="restored");


// ================= Native vault Stage 2: protected exact restore =================
const STAGE2_VAULT_PATH = "blackpyre-native-vault.json";
const STAGE2_RESTORE_QUARANTINE_PATH = "blackpyre-native-restore-quarantine.json";
const STAGE2_KEYS = [
  "forge:cfg",
  "forge:data",
  "forge:program",
  "forge:lkg",
  "forge:lkg:previous",
  "forge:lkg:older",
  "forge:quarantine",
  "forge:install",
  "ryan-cut:data"
];

function stage2VaultStrings(){
  return {
    "forge:cfg":RAW_V3_CFG,
    "forge:data":JSON.stringify(V63_POPULATED_DATA),
    "forge:program":RAW_PROGRAM,
    "forge:lkg":V63_POP_LKG,
    "forge:lkg:previous":V63_EMPTY_LKG,
    "forge:lkg:older":null,
    "forge:quarantine":"null",
    "forge:install":JSON.stringify({
      formatVersion:1,
      establishedAt:"2026-07-20T10:00:00.000Z",
      lastHealthyAt:"2026-07-21T10:00:00.000Z",
      schemaVersion:3
    }),
    "ryan-cut:data":NATIVE_LEGACY_RAW
  };
}
function stage2VaultRaw(options){
  const opts=options||{};
  const strings=Object.assign(stage2VaultStrings(),opts.strings||{});
  if (opts.omitStringKey) delete strings[opts.omitStringKey];
  return JSON.stringify({
    type:opts.type===undefined ? "blackpyre-native-vault" : opts.type,
    formatVersion:opts.formatVersion===undefined ? 1 : opts.formatVersion,
    schemaVersion:opts.schemaVersion===undefined ? 3 : opts.schemaVersion,
    savedAt:"2026-07-21T22:00:00.000Z",
    source:"stage2-test",
    strings:strings
  });
}
function stage2SeedFromContracted(strings,preservation){
  return {
    cfg:strings["forge:cfg"], data:strings["forge:data"], program:strings["forge:program"],
    lkg:strings["forge:lkg"], lkgPrevious:strings["forge:lkg:previous"], lkgOlder:strings["forge:lkg:older"],
    quarantine:strings["forge:quarantine"], install:strings["forge:install"], legacyData:strings["ryan-cut:data"],
    nativeRestorePreservation:preservation
  };
}
function stage2StorageSnapshot(dom){
  const out={};
  const storage=dom.window.localStorage;
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    out[key]=storage.getItem(key);
  }
  return out;
}
function stage2ContractedSnapshot(dom){
  const out={};
  STAGE2_KEYS.forEach(key=>{ out[key]=dom.window.localStorage.getItem(key); });
  return out;
}
function stage2StorageMatchesVault(dom,strings){
  return STAGE2_KEYS.every(key=>dom.window.localStorage.getItem(key)===strings[key]);
}
function stage2RestoreStatus(dom){
  const status=nativeVaultStatusOf(dom);
  return status || {};
}
function installStage2Timeline(w,fs,timeline){
  fs.install(w);

  const plugin=w.Capacitor.Plugins.Filesystem;
  ["writeFile","readFile","deleteFile","rename"].forEach(method=>{
    const original=plugin[method];
    plugin[method]=async function(args){
      timeline.push({kind:"filesystem",method:method,path:String(args.path||args.from||"")});
      return original.call(plugin,args);
    };
  });

  const proto=Object.getPrototypeOf(w.localStorage);
  const trackedSet=proto.setItem;
  const trackedRemove=proto.removeItem;
  const trackedClear=proto.clear;

  proto.setItem=function(key,value){
    timeline.push({kind:"storage",method:"setItem",key:String(key)});
    return trackedSet.call(this,key,value);
  };
  proto.removeItem=function(key){
    timeline.push({kind:"storage",method:"removeItem",key:String(key)});
    return trackedRemove.call(this,key);
  };
  proto.clear=function(){
    timeline.push({kind:"storage",method:"clear",key:null});
    return trackedClear.call(this);
  };
}


// PWA and non-native environments must retain the established protected-mode behavior
// without making any native Filesystem call.
const Stage2WebFs=makeNativeFilesystem({
  native:false,
  files:{[STAGE2_VAULT_PATH]:stage2VaultRaw()}
});
const Stage2Web=bootRaw({
  cfg:RAW_V3_CFG,
  data:'{"broken":',
  program:RAW_PROGRAM
},w=>Stage2WebFs.install(w));
await settleNativeVault(Stage2Web);
check("Stage 2 performs no restore Filesystem work outside the native app",
  Stage2WebFs.calls.length===0
  && Stage2Web.window.localStorage.getItem("forge:data")==='{"broken":'
  && Stage2Web.window.eval(`protectedMode===true`));


// Healthy native localStorage must win over a different valid native vault.
const Stage2HealthyVaultRaw=stage2VaultRaw();
const Stage2HealthyFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:Stage2HealthyVaultRaw}
});
const Stage2Healthy=bootRaw({
  cfg:RAW_V3_CFG,
  data:RAW_V2_DATA,
  program:RAW_PROGRAM
},w=>Stage2HealthyFs.install(w));
await settleNativeVault(Stage2Healthy);
check("Stage 2 never replaces healthy native primary localStorage",
  Stage2Healthy.window.localStorage.getItem("forge:cfg")===RAW_V3_CFG
  && Stage2Healthy.window.localStorage.getItem("forge:data")===RAW_V2_DATA
  && Stage2Healthy.window.localStorage.getItem("forge:program")===RAW_PROGRAM);
check("healthy native localStorage does not create a restore quarantine",
  !Stage2HealthyFs.files.has(STAGE2_RESTORE_QUARANTINE_PATH));


// A valid empty state is still healthy and must not be replaced by a populated vault.
const Stage2HealthyEmptyFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:Stage2HealthyVaultRaw}
});
const Stage2HealthyEmpty=bootRaw({
  cfg:RAW_V3_CFG,
  data:RAW_V2_DATA,
  program:RAW_PROGRAM
},w=>Stage2HealthyEmptyFs.install(w));
await settleNativeVault(Stage2HealthyEmpty);
check("Stage 2 does not replace a healthy empty state with a populated vault",
  Stage2HealthyEmpty.window.localStorage.getItem("forge:data")===RAW_V2_DATA
  && !Stage2HealthyEmptyFs.files.has(STAGE2_RESTORE_QUARANTINE_PATH));


// Missing localStorage must be quarantined and restored from the verified vault
// before defaults or onboarding can replace it.
const Stage2MissingStrings=stage2VaultStrings();
const Stage2MissingVaultRaw=stage2VaultRaw();
const Stage2MissingFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:Stage2MissingVaultRaw}
});
const Stage2MissingTimeline=[];
const Stage2Missing=bootRaw({},w=>{
  w.__storageOriginalMethods.setItem.call(w.localStorage,"third-party:key","keep-me");
  installStage2Timeline(w,Stage2MissingFs,Stage2MissingTimeline);
});
await settleNativeVault(Stage2Missing);

const Stage2MissingStatus=stage2RestoreStatus(Stage2Missing);
const Stage2QuarantineRaw=Stage2MissingFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH);
const Stage2Quarantine=parseNativeVault(Stage2QuarantineRaw);

check("Stage 2 restores missing native localStorage from a valid vault",
  stage2StorageMatchesVault(Stage2Missing,Stage2MissingStrings));
check("Stage 2 exact restore distinguishes null absence from the string null",
  Stage2Missing.window.localStorage.getItem("forge:lkg:older")===null
  && Stage2Missing.window.localStorage.getItem("forge:quarantine")==="null");
check("Stage 2 restore preserves unrelated localStorage entries",
  Stage2Missing.window.localStorage.getItem("third-party:key")==="keep-me");
check("Stage 2 writes a verified native restore quarantine containing the complete raw incident state",
  !!Stage2Quarantine
  && Stage2Quarantine.type==="blackpyre-native-restore-quarantine"
  && Stage2Quarantine.formatVersion===1
  && typeof Stage2Quarantine.quarantinedAt==="string"
  && !Number.isNaN(Date.parse(Stage2Quarantine.quarantinedAt))
  && typeof Stage2Quarantine.incidentReason==="string"
  && Stage2Quarantine.incidentReason.length>0
  && Stage2Quarantine.strings
  && Stage2Quarantine.strings["third-party:key"]==="keep-me"
  && Array.isArray(Stage2Quarantine.absentContractedKeys)
  && STAGE2_KEYS.every(key=>Stage2Quarantine.absentContractedKeys.includes(key)));

const Stage2FirstMutation=Stage2MissingTimeline.findIndex(event=>
  event.kind==="storage"
  && (event.key===null || STAGE2_KEYS.includes(event.key))
);
const Stage2QuarantineWrite=Stage2MissingTimeline.findIndex(event=>
  event.kind==="filesystem"
  && event.method==="writeFile"
  && event.path===STAGE2_RESTORE_QUARANTINE_PATH
);
const Stage2QuarantineRead=Stage2MissingTimeline.findIndex((event,index)=>
  index>Stage2QuarantineWrite
  && event.kind==="filesystem"
  && event.method==="readFile"
  && event.path===STAGE2_RESTORE_QUARANTINE_PATH
);
check("Stage 2 verifies quarantine before the first contracted localStorage mutation",
  Stage2QuarantineWrite>-1
  && Stage2QuarantineRead>Stage2QuarantineWrite
  && Stage2FirstMutation>Stage2QuarantineRead);
check("successful Stage 2 restore is reported as verified",
  Stage2MissingStatus.restoreState==="restored"
  && Stage2MissingStatus.restoreVerified===true
  && Stage2MissingStatus.quarantineVerified===true
  && !Stage2MissingStatus.restoreError);
check("Stage 2 restoration leaves the verified native vault byte-identical",
  Stage2MissingFs.files.get(STAGE2_VAULT_PATH)===Stage2MissingVaultRaw);
const Stage2CompletedQuarantine=parseNativeVault(Stage2MissingFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH));
check("successful Stage 2 restore marks its exact native quarantine completed",
  !!Stage2CompletedQuarantine && typeof Stage2CompletedQuarantine.completedAt==="string"
  && !Number.isNaN(Date.parse(Stage2CompletedQuarantine.completedAt)));


// Invalid primary localStorage must also restore from a valid vault while preserving
// its exact pre-restore bytes in native quarantine.
const Stage2InvalidOriginal={
  cfg:RAW_V3_CFG,
  data:' {"damaged": ',
  program:RAW_PROGRAM
};
const Stage2InvalidFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:stage2VaultRaw()}
});
const Stage2Invalid=bootRaw(Stage2InvalidOriginal,w=>{
  w.__storageOriginalMethods.setItem.call(w.localStorage,"unrelated","unchanged");
  Stage2InvalidFs.install(w);
});
await settleNativeVault(Stage2Invalid);
const Stage2InvalidQuarantine=parseNativeVault(
  Stage2InvalidFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH)
);
check("Stage 2 restores invalid native localStorage from a valid vault",
  stage2StorageMatchesVault(Stage2Invalid,stage2VaultStrings()));
check("Stage 2 quarantine preserves exact invalid pre-restore strings",
  !!Stage2InvalidQuarantine
  && Stage2InvalidQuarantine.strings
  && Stage2InvalidQuarantine.strings["forge:cfg"]===Stage2InvalidOriginal.cfg
  && Stage2InvalidQuarantine.strings["forge:data"]===Stage2InvalidOriginal.data
  && Stage2InvalidQuarantine.strings["forge:program"]===Stage2InvalidOriginal.program
  && Stage2InvalidQuarantine.strings.unrelated==="unchanged");


// A genuine first native launch with no BlackPyre state and no vault must retain
// the existing onboarding/default path.
const Stage2FirstInstallFs=makeNativeFilesystem();
const Stage2FirstInstall=bootRaw({},w=>Stage2FirstInstallFs.install(w));
await settleNativeVault(Stage2FirstInstall);
check("Stage 2 allows a true first native install with no vault to use onboarding",
  Stage2FirstInstall.window.eval(`protectedMode===false && cfg.setupDone!==true`)
  && typeof Stage2FirstInstall.window.localStorage.getItem("forge:cfg")==="string"
  && typeof Stage2FirstInstall.window.localStorage.getItem("forge:data")==="string"
  && typeof Stage2FirstInstall.window.localStorage.getItem("forge:program")==="string");



// ================= Native vault Stage 2: rejection and rollback paths =================
function stage2PrimaryRawMatches(dom,expected){
  return dom.window.localStorage.getItem("forge:cfg")===expected.cfg
    && dom.window.localStorage.getItem("forge:data")===expected.data
    && dom.window.localStorage.getItem("forge:program")===expected.program;
}
function stage2AllContractedAbsent(dom){
  return STAGE2_KEYS.every(key=>dom.window.localStorage.getItem(key)===null);
}
function stage2VerifiedRestoreQuarantineRaw(){
  return JSON.stringify({
    type:"blackpyre-native-restore-quarantine",
    formatVersion:1,
    quarantinedAt:"2026-07-21T21:00:00.000Z",
    incidentReason:"Earlier protected recovery incident.",
    strings:{"third-party:key":"older evidence"},
    absentContractedKeys:STAGE2_KEYS.slice()
  });
}


// A malformed vault on otherwise empty native storage is not a true first install.
// Defaults and onboarding must not replace the incident evidence.
const Stage2MalformedVaultRaw='{"type":"blackpyre-native-vault","formatVersion":1,';
const Stage2MalformedFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:Stage2MalformedVaultRaw}
});
const Stage2Malformed=bootRaw({},w=>Stage2MalformedFs.install(w));
await settleNativeVault(Stage2Malformed);
const Stage2MalformedStatus=stage2RestoreStatus(Stage2Malformed);
check("Stage 2 rejects malformed vault JSON without creating empty defaults",
  stage2AllContractedAbsent(Stage2Malformed)
  && Stage2Malformed.window.eval(`protectedMode===true`)
  && Stage2MalformedFs.files.get(STAGE2_VAULT_PATH)===Stage2MalformedVaultRaw
  && Stage2MalformedStatus.restoreState==="rejected"
  && !!Stage2MalformedStatus.restoreError);


// Unsupported or incomplete records must never be restored.
const Stage2RejectedVaultCases=[
  {
    name:"wrong vault type",
    raw:stage2VaultRaw({type:"not-blackpyre"})
  },
  {
    name:"unsupported vault formatVersion",
    raw:stage2VaultRaw({formatVersion:2})
  },
  {
    name:"wrong vault schemaVersion",
    raw:stage2VaultRaw({schemaVersion:4})
  },
  {
    name:"missing contracted vault key",
    raw:stage2VaultRaw({omitStringKey:"forge:lkg:older"})
  },
  {
    name:"non-string and non-null vault value",
    raw:stage2VaultRaw({strings:{"forge:lkg:older":42}})
  },
  {
    name:"invalid primary vault strings",
    raw:stage2VaultRaw({strings:{"forge:data":'{"damaged":'}})
  }
];

for (const rejectedCase of Stage2RejectedVaultCases){
  const original={
    cfg:RAW_V3_CFG,
    data:' {"existing-invalid": ',
    program:RAW_PROGRAM
  };
  const fs=makeNativeFilesystem({
    files:{[STAGE2_VAULT_PATH]:rejectedCase.raw}
  });
  const dom=bootRaw(original,w=>fs.install(w));
  await settleNativeVault(dom);
  const status=stage2RestoreStatus(dom);

  check("Stage 2 rejects "+rejectedCase.name,
    stage2PrimaryRawMatches(dom,original)
    && dom.window.eval(`protectedMode===true`)
    && fs.files.get(STAGE2_VAULT_PATH)===rejectedCase.raw
    && !fs.files.has(STAGE2_RESTORE_QUARANTINE_PATH)
    && status.restoreState==="rejected"
    && !!status.restoreError);
}


// An unreadable vault is not equivalent to an absent vault.
const Stage2UnreadableFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:stage2VaultRaw()}
});
Stage2UnreadableFs.control.failRead=args=>args.path===STAGE2_VAULT_PATH;
const Stage2Unreadable=bootRaw({},w=>Stage2UnreadableFs.install(w));
await settleNativeVault(Stage2Unreadable);
const Stage2UnreadableStatus=stage2RestoreStatus(Stage2Unreadable);
check("Stage 2 keeps an unreadable native vault incident protected instead of starting onboarding",
  stage2AllContractedAbsent(Stage2Unreadable)
  && Stage2Unreadable.window.eval(`protectedMode===true`)
  && Stage2UnreadableStatus.restoreState==="vault-read-failed"
  && !!Stage2UnreadableStatus.restoreError);


// A quarantine write failure must occur before any localStorage restoration.
const Stage2QuarantineFailOriginal={
  cfg:RAW_V3_CFG,
  data:' {"quarantine-write-failure": ',
  program:RAW_PROGRAM
};
const Stage2QuarantineFailFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:stage2VaultRaw()}
});
Stage2QuarantineFailFs.control.failWrite=args=>
  args.path===STAGE2_RESTORE_QUARANTINE_PATH;

const Stage2QuarantineFail=bootRaw(Stage2QuarantineFailOriginal,w=>{
  w.__storageOriginalMethods.setItem.call(w.localStorage,"unrelated","preserve-this");
  Stage2QuarantineFailFs.install(w);
});
await settleNativeVault(Stage2QuarantineFail);
const Stage2QuarantineFailStatus=stage2RestoreStatus(Stage2QuarantineFail);
check("Stage 2 quarantine write failure leaves localStorage byte-for-byte unchanged",
  stage2PrimaryRawMatches(Stage2QuarantineFail,Stage2QuarantineFailOriginal)
  && Stage2QuarantineFail.window.localStorage.getItem("unrelated")==="preserve-this"
  && Stage2QuarantineFail.window.eval(`protectedMode===true`)
  && Stage2QuarantineFailStatus.restoreState==="quarantine-failed"
  && Stage2QuarantineFailStatus.quarantineVerified===false
  && !!Stage2QuarantineFailStatus.restoreError
  && Stage2QuarantineFailFs.files.get(STAGE2_VAULT_PATH)===stage2VaultRaw());


// A quarantine read-back mismatch is also a hard stop before restoration.
const Stage2QuarantineMismatchOriginal={
  cfg:RAW_V3_CFG,
  data:' {"quarantine-mismatch": ',
  program:RAW_PROGRAM
};
const Stage2QuarantineMismatchVaultRaw=stage2VaultRaw();
const Stage2QuarantineMismatchFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:Stage2QuarantineMismatchVaultRaw}
});
let Stage2QuarantineMismatchUsed=false;
Stage2QuarantineMismatchFs.control.transformRead=(args,data)=>{
  if (!Stage2QuarantineMismatchUsed && args.path===STAGE2_RESTORE_QUARANTINE_PATH){
    Stage2QuarantineMismatchUsed=true;
    return data+"corrupt";
  }
  return data;
};
const Stage2QuarantineMismatch=bootRaw(Stage2QuarantineMismatchOriginal,w=>
  Stage2QuarantineMismatchFs.install(w)
);
await settleNativeVault(Stage2QuarantineMismatch);
const Stage2QuarantineMismatchStatus=stage2RestoreStatus(Stage2QuarantineMismatch);
check("Stage 2 quarantine verification mismatch prevents every restore mutation",
  Stage2QuarantineMismatchUsed
  && stage2PrimaryRawMatches(Stage2QuarantineMismatch,Stage2QuarantineMismatchOriginal)
  && Stage2QuarantineMismatch.window.eval(`protectedMode===true`)
  && Stage2QuarantineMismatchStatus.restoreState==="quarantine-failed"
  && Stage2QuarantineMismatchStatus.quarantineVerified===false
  && Stage2QuarantineMismatchFs.files.get(STAGE2_VAULT_PATH)===Stage2QuarantineMismatchVaultRaw);


// Completion-proof failure rolls browser storage back and leaves the exact incident reusable.
const Stage2CompletionFailFs=makeNativeFilesystem({files:{[STAGE2_VAULT_PATH]:stage2VaultRaw()}});
Stage2CompletionFailFs.control.failWrite=args=>{
  if (args.path!==STAGE2_RESTORE_QUARANTINE_PATH) return false;
  try { return typeof JSON.parse(args.data).completedAt==="string"; } catch(error){ return false; }
};
const Stage2CompletionFail=bootRaw({},w=>Stage2CompletionFailFs.install(w));
await settleNativeVault(Stage2CompletionFail);
const Stage2CompletionFailStatus=stage2RestoreStatus(Stage2CompletionFail);
const Stage2CompletionFailQuarantine=parseNativeVault(Stage2CompletionFailFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH));
check("completion-proof failure rolls back and leaves the same incident retryable",
  stage2AllContractedAbsent(Stage2CompletionFail)
  && Stage2CompletionFail.window.eval(`protectedMode===true`)
  && Stage2CompletionFailStatus.restoreState==="failed"
  && Stage2CompletionFailStatus.rollbackVerified===true
  && !!Stage2CompletionFailQuarantine
  && !Object.prototype.hasOwnProperty.call(Stage2CompletionFailQuarantine,"completedAt"));
Stage2CompletionFailFs.control.failWrite=null;
const Stage2CompletionRetry=bootRaw({},w=>Stage2CompletionFailFs.install(w));
await settleNativeVault(Stage2CompletionRetry);
check("an exact retry reuses uncompleted evidence and finishes restoration",
  nativeVaultField(Stage2CompletionRetry,"restoreState")==="restored"
  && Stage2CompletionRetry.window.eval(`protectedMode===false`)
  && stage2StorageMatchesVault(Stage2CompletionRetry,stage2VaultStrings())
  && typeof parseNativeVault(Stage2CompletionFailFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH)).completedAt==="string");

// Existing verified recovery evidence must never be silently replaced.
const Stage2ExistingQuarantineRaw=stage2VerifiedRestoreQuarantineRaw();
const Stage2ExistingQuarantineFs=makeNativeFilesystem({
  files:{
    [STAGE2_VAULT_PATH]:stage2VaultRaw(),
    [STAGE2_RESTORE_QUARANTINE_PATH]:Stage2ExistingQuarantineRaw
  }
});
const Stage2ExistingQuarantineOriginal={
  cfg:RAW_V3_CFG,
  data:' {"existing-quarantine-conflict": ',
  program:RAW_PROGRAM
};
const Stage2ExistingQuarantine=bootRaw(Stage2ExistingQuarantineOriginal,w=>
  Stage2ExistingQuarantineFs.install(w)
);
await settleNativeVault(Stage2ExistingQuarantine);
const Stage2ExistingQuarantineStatus=stage2RestoreStatus(Stage2ExistingQuarantine);
check("Stage 2 preserves an existing verified native restore quarantine",
  Stage2ExistingQuarantineFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH)===Stage2ExistingQuarantineRaw
  && stage2PrimaryRawMatches(Stage2ExistingQuarantine,Stage2ExistingQuarantineOriginal)
  && Stage2ExistingQuarantine.window.eval(`protectedMode===true`)
  && Stage2ExistingQuarantineStatus.restoreState==="quarantine-conflict");


// A null vault value must actively remove a currently present contracted key.
const Stage2NullRemovalFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:stage2VaultRaw()}
});
const Stage2NullRemoval=bootRaw({
  cfg:RAW_V3_CFG,
  data:' {"invalid-before-null-removal": ',
  program:RAW_PROGRAM,
  lkgOlder:"old-value-that-must-be-removed",
  quarantine:"old-quarantine-value"
},w=>Stage2NullRemovalFs.install(w));
await settleNativeVault(Stage2NullRemoval);
check("Stage 2 exact restoration removes keys represented by null",
  Stage2NullRemoval.window.localStorage.getItem("forge:lkg:older")===null
  && Stage2NullRemoval.window.localStorage.getItem("forge:quarantine")==="null"
  && stage2StorageMatchesVault(Stage2NullRemoval,stage2VaultStrings()));


// Force one restore write to fail. Rollback must return the exact original state.
const Stage2WriteFailVaultRaw=stage2VaultRaw();
const Stage2WriteFailStrings=stage2VaultStrings();
const Stage2WriteFailFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:Stage2WriteFailVaultRaw}
});
let Stage2WriteFailureTriggered=false;
const Stage2WriteFail=bootRaw({},w=>{
  w.__storageOriginalMethods.setItem.call(w.localStorage,"unrelated","rollback-keeps-me");
  Stage2WriteFailFs.install(w);

  const proto=Object.getPrototypeOf(w.localStorage);
  const trackedSet=proto.setItem;

  proto.setItem=function(key,value){
    if (!Stage2WriteFailureTriggered
        && String(key)==="forge:data"
        && String(value)===Stage2WriteFailStrings["forge:data"]){
      Stage2WriteFailureTriggered=true;
      throw new Error("Forced Stage 2 restore write failure");
    }
    return trackedSet.call(this,key,value);
  };
});
await settleNativeVault(Stage2WriteFail);
const Stage2WriteFailStatus=stage2RestoreStatus(Stage2WriteFail);
check("Stage 2 restore write failure rolls back the exact original localStorage state",
  Stage2WriteFailureTriggered
  && stage2AllContractedAbsent(Stage2WriteFail)
  && Stage2WriteFail.window.localStorage.getItem("unrelated")==="rollback-keeps-me"
  && Stage2WriteFail.window.eval(`protectedMode===true`)
  && Stage2WriteFailStatus.restoreState==="failed"
  && Stage2WriteFailStatus.restoreVerified===false
  && Stage2WriteFailStatus.rollbackVerified===true
  && Stage2WriteFailStatus.rollbackFailed===false
  && Stage2WriteFailFs.files.has(STAGE2_RESTORE_QUARANTINE_PATH)
  && Stage2WriteFailFs.files.get(STAGE2_VAULT_PATH)===Stage2WriteFailVaultRaw);


// Force one restored read-back value to mismatch. This must also roll back.
const Stage2ReadMismatchVaultRaw=stage2VaultRaw();
const Stage2ReadMismatchStrings=stage2VaultStrings();
const Stage2ReadMismatchFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:Stage2ReadMismatchVaultRaw}
});
let Stage2ReadMismatchArmed=false;
let Stage2ReadMismatchUsed=false;
const Stage2ReadMismatch=bootRaw({},w=>{
  w.__storageOriginalMethods.setItem.call(w.localStorage,"unrelated","readback-keeps-me");
  Stage2ReadMismatchFs.install(w);

  const proto=Object.getPrototypeOf(w.localStorage);
  const trackedSet=proto.setItem;
  const originalGet=proto.getItem;

  proto.setItem=function(key,value){
    const result=trackedSet.call(this,key,value);
    if (String(key)==="forge:data"
        && String(value)===Stage2ReadMismatchStrings["forge:data"]){
      Stage2ReadMismatchArmed=true;
    }
    return result;
  };

  proto.getItem=function(key){
    const value=originalGet.call(this,key);
    if (Stage2ReadMismatchArmed
        && !Stage2ReadMismatchUsed
        && String(key)==="forge:data"){
      Stage2ReadMismatchUsed=true;
      return String(value)+"corrupt";
    }
    return value;
  };
});
await settleNativeVault(Stage2ReadMismatch);
const Stage2ReadMismatchStatus=stage2RestoreStatus(Stage2ReadMismatch);
check("Stage 2 restore read-back mismatch triggers verified rollback",
  Stage2ReadMismatchUsed
  && stage2AllContractedAbsent(Stage2ReadMismatch)
  && Stage2ReadMismatch.window.localStorage.getItem("unrelated")==="readback-keeps-me"
  && Stage2ReadMismatch.window.eval(`protectedMode===true`)
  && Stage2ReadMismatchStatus.restoreState==="failed"
  && Stage2ReadMismatchStatus.rollbackVerified===true
  && Stage2ReadMismatchStatus.rollbackFailed===false
  && Stage2ReadMismatchFs.files.get(STAGE2_VAULT_PATH)===Stage2ReadMismatchVaultRaw);


// Force both a restore failure and a rollback failure. They must be reported separately.
const Stage2RollbackFailVaultRaw=stage2VaultRaw();
const Stage2RollbackFailStrings=stage2VaultStrings();
const Stage2RollbackFailFs=makeNativeFilesystem({
  files:{[STAGE2_VAULT_PATH]:Stage2RollbackFailVaultRaw}
});
let Stage2RollbackRestoreFailed=false;
let Stage2RollbackFailureTriggered=false;
const Stage2RollbackFail=bootRaw({},w=>{
  Stage2RollbackFailFs.install(w);

  const proto=Object.getPrototypeOf(w.localStorage);
  const trackedSet=proto.setItem;
  const trackedRemove=proto.removeItem;

  proto.setItem=function(key,value){
    if (!Stage2RollbackRestoreFailed
        && String(key)==="forge:data"
        && String(value)===Stage2RollbackFailStrings["forge:data"]){
      Stage2RollbackRestoreFailed=true;
      throw new Error("Forced restore failure before rollback failure");
    }
    return trackedSet.call(this,key,value);
  };

  proto.removeItem=function(key){
    if (Stage2RollbackRestoreFailed
        && !Stage2RollbackFailureTriggered
        && STAGE2_KEYS.includes(String(key))){
      Stage2RollbackFailureTriggered=true;
      throw new Error("Forced rollback failure");
    }
    return trackedRemove.call(this,key);
  };
});
await settleNativeVault(Stage2RollbackFail);
const Stage2RollbackFailStatus=stage2RestoreStatus(Stage2RollbackFail);
check("Stage 2 reports rollback failure separately and remains protected",
  Stage2RollbackRestoreFailed
  && Stage2RollbackFailureTriggered
  && Stage2RollbackFail.window.eval(`protectedMode===true`)
  && Stage2RollbackFailStatus.restoreState==="failed"
  && Stage2RollbackFailStatus.restoreVerified===false
  && Stage2RollbackFailStatus.rollbackVerified===false
  && Stage2RollbackFailStatus.rollbackFailed===true
  && !!Stage2RollbackFailStatus.restoreError
  && !!Stage2RollbackFailStatus.rollbackError
  && Stage2RollbackFailFs.files.has(STAGE2_RESTORE_QUARANTINE_PATH)
  && Stage2RollbackFailFs.files.get(STAGE2_VAULT_PATH)===Stage2RollbackFailVaultRaw);


// Successful restoration must finish validation, leave Protected mode, and retain
// the established user data instead of showing onboarding.
check("successful Stage 2 restoration exits Protected mode with validated established data",
  Stage2Missing.window.eval(`
    protectedMode===false
    && cfg.setupDone===true
    && data.weights.some(x=>x.date==="2026-07-20"&&x.lbs===220)
  `)
  && stage2StorageMatchesVault(Stage2Missing,Stage2MissingStrings));



// ================= Native vault Stage 2: post-restore restart exactness =================
// After a verified restore, the next ordinary native launch must not immediately
// rewrite restored metadata or replace the exact source vault.
const Stage2RestartVaultBefore =
  Stage2MissingFs.files.get(STAGE2_VAULT_PATH);

const Stage2RestartStringsBefore =
  stage2ContractedSnapshot(Stage2Missing);

const Stage2RestartPreservationBefore =
  Stage2Missing.window.localStorage.getItem(
    "blackpyre:native-restore-preservation"
  );

check("successful Stage 2 restoration records exact restart-preservation proof",
  typeof Stage2RestartPreservationBefore==="string"
  && Stage2Missing.window.eval(`
    inspectNativeRestorePreservationRaw(
      localStorage.getItem(NATIVE_RESTORE_PRESERVATION_KEY)
    ).ok
  `));

const Stage2Restart=bootRaw({
  cfg:Stage2RestartStringsBefore["forge:cfg"],
  data:Stage2RestartStringsBefore["forge:data"],
  program:Stage2RestartStringsBefore["forge:program"],
  lkg:Stage2RestartStringsBefore["forge:lkg"],
  lkgPrevious:Stage2RestartStringsBefore["forge:lkg:previous"],
  lkgOlder:Stage2RestartStringsBefore["forge:lkg:older"],
  quarantine:Stage2RestartStringsBefore["forge:quarantine"],
  install:Stage2RestartStringsBefore["forge:install"],
  legacyData:Stage2RestartStringsBefore["ryan-cut:data"],
  nativeRestorePreservation:Stage2RestartPreservationBefore
},w=>Stage2MissingFs.install(w));

await settleNativeVault(Stage2Restart);

const Stage2RestartStringsAfter =
  stage2ContractedSnapshot(Stage2Restart);

check("Stage 2 exact restore survives the next healthy native boot without metadata drift",
  STAGE2_KEYS.every(key=>
    Stage2RestartStringsAfter[key]===Stage2RestartStringsBefore[key]
  )
  && Stage2MissingFs.files.get(STAGE2_VAULT_PATH)===Stage2RestartVaultBefore
  && Stage2Restart.window.localStorage.getItem(
    "blackpyre:native-restore-preservation"
  )===Stage2RestartPreservationBefore
  && nativeVaultField(Stage2Restart,"restoreState")==="not-needed");



// Dominant path: restore, save real data, restart, then lose browser storage again.
Stage2Missing.window.eval(`data.weights.push({date:"2026-07-25",lbs:218}); save();`);
await settleNativeVault(Stage2Missing);
const Stage2RepeatPreservation=Stage2Missing.window.localStorage.getItem("blackpyre:native-restore-preservation");
const Stage2RepeatSavedStrings=stage2ContractedSnapshot(Stage2Missing);
const Stage2RepeatRestart=bootRaw(
  stage2SeedFromContracted(Stage2RepeatSavedStrings,Stage2RepeatPreservation),
  w=>Stage2MissingFs.install(w)
);
await settleNativeVault(Stage2RepeatRestart);
const Stage2RepeatLatestVault=parseNativeVault(Stage2MissingFs.files.get(STAGE2_VAULT_PATH));
check("completed quarantine proof survives normal saves and a healthy restart",
  Stage2RepeatRestart.window.eval(`protectedMode===false && data.weights.some(item=>item.date==="2026-07-25"&&item.lbs===218)`)
  && typeof parseNativeVault(Stage2MissingFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH)).completedAt==="string"
  && Stage2RepeatLatestVault.strings["forge:data"]===Stage2RepeatRestart.window.localStorage.getItem("forge:data"));
const Stage2FirstCompletedQuarantineRaw=Stage2MissingFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH);
const Stage2RepeatSecond=bootRaw({},w=>Stage2MissingFs.install(w));
await settleNativeVault(Stage2RepeatSecond);
const Stage2SecondCompletedQuarantineRaw=Stage2MissingFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH);
const Stage2SecondCompletedQuarantine=parseNativeVault(Stage2SecondCompletedQuarantineRaw);
check("a later data-loss incident replaces completed evidence and restores the latest vault",
  nativeVaultField(Stage2RepeatSecond,"restoreState")==="restored"
  && Stage2RepeatSecond.window.eval(`protectedMode===false && data.weights.some(item=>item.date==="2026-07-25"&&item.lbs===218)`)
  && Stage2SecondCompletedQuarantineRaw!==Stage2FirstCompletedQuarantineRaw
  && typeof Stage2SecondCompletedQuarantine.completedAt==="string");

// Upgrade path: old completed restore, evolved user data, old preservation, unmarked quarantine.
const Stage2LegacyQuarantineRecord=Object.assign({},Stage2CompletedQuarantine);
delete Stage2LegacyQuarantineRecord.completedAt;
const Stage2LegacyFs=makeNativeFilesystem({files:{
  [STAGE2_VAULT_PATH]:JSON.stringify(Stage2RepeatLatestVault),
  [STAGE2_RESTORE_QUARANTINE_PATH]:JSON.stringify(Stage2LegacyQuarantineRecord)
}});
const Stage2Legacy=bootRaw(
  stage2SeedFromContracted(Stage2RepeatLatestVault.strings,Stage2RepeatPreservation),
  w=>Stage2LegacyFs.install(w)
);
await settleNativeVault(Stage2Legacy);
const Stage2LegacyAfter=parseNativeVault(Stage2LegacyFs.files.get(STAGE2_RESTORE_QUARANTINE_PATH));
check("healthy upgraded device backfills completed proof after user data evolved",
  Stage2Legacy.window.eval(`protectedMode===false`)
  && typeof Stage2LegacyAfter.completedAt==="string"
  && Date.parse(Stage2LegacyAfter.completedAt)>=Date.parse(Stage2LegacyAfter.quarantinedAt));

// ================= native verified backup sharing + elapsed reminder =================
const reminderNow = Date.parse("2026-07-25T12:00:00.000Z");
const reminderLogic = boot(V3_CFG, Object.assign({},EMPTY_DATA,{meta:{lastBackup:"2026-07-25",logsSince:0}}));
const reminderCases = reminderLogic.window.eval(`(()=>{
  const now=${reminderNow};
  const firstLog8=new Date(now-8*BACKUP_DAY_MS).toISOString();
  return {
    noShareHistory:offsiteShareReminderDue({},now),
    localOnly:offsiteShareReminderDue({lastBackup:"2026-07-25",logsSince:0},now),
    firstLog6:offsiteShareReminderDue({firstMeaningfulLogAt:new Date(now-6*BACKUP_DAY_MS).toISOString()},now),
    firstLog7:offsiteShareReminderDue({firstMeaningfulLogAt:new Date(now-7*BACKUP_DAY_MS).toISOString()},now),
    completed13:offsiteShareReminderDue({lastShareCompletedAt:new Date(now-13*BACKUP_DAY_MS).toISOString()},now),
    completed14:offsiteShareReminderDue({lastShareCompletedAt:new Date(now-14*BACKUP_DAY_MS).toISOString()},now),
    attempt6:offsiteShareReminderDue({firstMeaningfulLogAt:firstLog8,lastShareAttemptAt:new Date(now-6*BACKUP_DAY_MS).toISOString()},now),
    attempt7:offsiteShareReminderDue({firstMeaningfulLogAt:firstLog8,lastShareAttemptAt:new Date(now-7*BACKUP_DAY_MS).toISOString()},now),
    snoozed:offsiteShareReminderDue({offsiteReminderSnoozedUntil:new Date(now+BACKUP_DAY_MS).toISOString()},now)
  };
})()`);
check("backup reminder waits for seven days after the first meaningful log and then uses elapsed share activity",
  reminderCases.noShareHistory===false
  && reminderCases.localOnly===false
  && reminderCases.firstLog6===false
  && reminderCases.firstLog7===true
  && reminderCases.completed13===false
  && reminderCases.completed14===true
  && reminderCases.attempt6===false
  && reminderCases.attempt7===true
  && reminderCases.snoozed===false);
check("native onboarding completion does not immediately show the backup reminder",
  reminderLogic.window.document.getElementById("backupCard").classList.contains("hidden"));
reminderLogic.window.eval(`
  data.meta.firstMeaningfulLogAt=new Date(${reminderNow}-8*BACKUP_DAY_MS).toISOString();
  renderBackup();
`);
const platformNeutralBackupGuidance = reminderLogic.window.eval(`([
  document.getElementById("backupMetaLine").textContent,
  document.getElementById("backupText").textContent
]).join(" ")`);
check("backup-share guidance is platform-neutral and still directs a separate copy",
  platformNeutralBackupGuidance.includes("outside BlackPyre")
  && !/(iCloud|\bMac\b|email)/i.test(platformNeutralBackupGuidance));
const nativeBackupDataCardCopy = reminderLogic.window.eval(`({
  local:document.getElementById("exportDataBtn").textContent,
  share:document.getElementById("shareDataBtn").textContent,
  note:document.getElementById("shareDataBtn").nextElementSibling.textContent
})`);
check("native Data card clearly separates one-tap device backup from share or save elsewhere",
  nativeBackupDataCardCopy.local==="BACK UP ON THIS DEVICE"
  && nativeBackupDataCardCopy.share==="SHARE OR SAVE ELSEWHERE…"
  && /Files → On My iPhone → BlackPyre/.test(nativeBackupDataCardCopy.note)
  && /without opening a picker/.test(nativeBackupDataCardCopy.note)
  && /deleted|lost|erased|replaced/.test(nativeBackupDataCardCopy.note));
const approvedBackupReminderCopy = reminderLogic.window.eval(`({
  title:document.querySelector("#backupCard .label").textContent,
  titleStyle:document.querySelector("#backupCard .label").getAttribute("style"),
  cardStyle:document.getElementById("backupCard").getAttribute("style"),
  text:document.getElementById("backupText").textContent,
  primary:document.getElementById("backupNowBtn").textContent,
  secondary:document.getElementById("backupSnoozeBtn").textContent
})`);
check("backup reminder uses the gold card treatment and approved controls",
  approvedBackupReminderCopy.title==="BACK UP YOUR DATA"
  && /color\s*:\s*var\(--ember\)/.test(approvedBackupReminderCopy.titleStyle)
  && /border-color\s*:\s*var\(--ember\)/.test(approvedBackupReminderCopy.cardStyle)
  && approvedBackupReminderCopy.text==="Create a backup so your BlackPyre data can be recovered if your device is lost, replaced, or damaged."
  && approvedBackupReminderCopy.primary==="Backup"
  && approvedBackupReminderCopy.secondary==="Remind me later");

const NativeBackupFiles = new Map();
const NativeBackupShares = [];
let resolveNativeBackupShare = null;
const NativeBackup = boot(
  V3_CFG,
  Object.assign({},EMPTY_DATA,{meta:{lastBackup:null,logsSince:7,firstMeaningfulLogAt:new Date(reminderNow-8*86400000).toISOString()}}),
  w=>{
    w.Capacitor = {
      getPlatform:()=>"ios",
      isNativePlatform:()=>true,
      isPluginAvailable:name=>name==="Filesystem" || name==="Share",
      Plugins:{
        Filesystem:{
          writeFile:async options=>{
            NativeBackupFiles.set(options.path,options.data);
            return {uri:"file:///Documents/"+options.path};
          },
          readFile:async options=>({data:NativeBackupFiles.get(options.path)})
        },
        Share:{
          share:options=>{
            NativeBackupShares.push(options);
            return new Promise(resolve=>{ resolveNativeBackupShare=resolve; });
          }
        }
      }
    };
  }
);
NativeBackup.window.eval(`
  cfg.anthropicKey="native-secret-a";
  cfg.openaiKey="native-secret-o";
  cfg.usdaKey="native-usda-key";
  data.meta.logsSince=7;
  window.__backupNotice=null;
  flashSave=(message,isError)=>{window.__backupNotice={message,isError:!!isError};};
`);
NativeBackup.__storageCalls.length=0;
const nativeBackupPromise = NativeBackup.window.eval(`doBackup("exportDataBtn")`);
check("native backup returns an asynchronous verified export",
  nativeBackupPromise && typeof nativeBackupPromise.then==="function");
const nativeBackupOk = await nativeBackupPromise;
const nativeBackupName = [...NativeBackupFiles.keys()].find(name=>/^blackpyre-backup-.*\.json$/.test(name));
const nativeBackupText = NativeBackupFiles.get(nativeBackupName);
const nativeBackupPayload = JSON.parse(nativeBackupText);
check("native backup writes a verified JSON file without opening the share sheet",
  nativeBackupOk===true
  && !!nativeBackupName
  && NativeBackupShares.length===0
  && NativeBackup.window.document.getElementById("exportDataBtn").textContent==="✓ Saved to BlackPyre folder"
  && NativeBackup.window.document.getElementById("exportDataBtn").classList.contains("acked"));
check("v81 native backup strips every API credential including legacy USDA keys",
  !nativeBackupText.includes("native-secret-a")
  && !nativeBackupText.includes("native-secret-o")
  && !nativeBackupText.includes("native-usda-key")
  && !Object.prototype.hasOwnProperty.call(nativeBackupPayload.cfg,"usdaKey"));
check("native backup records local completion only after verified file creation",
  NativeBackup.window.eval(`
    data.meta.lastBackup===todayStr()
    && data.meta.logsSince===0
    && !Object.prototype.hasOwnProperty.call(data.meta,"lastShareAttemptAt")
    && !Object.prototype.hasOwnProperty.call(data.meta,"lastShareCompletedAt")
    && offsiteShareReminderDue(data.meta,${reminderNow},${reminderNow}-14*BACKUP_DAY_MS)===true
  `)
  && nativeBackupPayload.data.meta.lastBackup!==null
  && nativeBackupPayload.data.meta.logsSince===0);

const nativeSharePromise = NativeBackup.window.eval(`doBackup("shareDataBtn",true)`);
await wait(5);
check("share attempt is persisted after the verified Documents backup and before completion",
  NativeBackupShares.length===1
  && NativeBackupShares[0].files[0]==="file:///Documents/"+nativeBackupName
  && NativeBackup.window.eval(`
    typeof data.meta.lastShareAttemptAt==="string"
    && !Object.prototype.hasOwnProperty.call(data.meta,"lastShareCompletedAt")
    && data.meta.lastBackup===todayStr()
    && data.meta.logsSince===0
  `));
resolveNativeBackupShare({activityType:"com.apple.UIKit.activity.Mail"});
const nativeShareOk = await nativeSharePromise;
check("completed native share records honest completion metadata and activity type",
  nativeShareOk===true
  && NativeBackup.window.eval(`
    typeof data.meta.lastShareCompletedAt==="string"
    && Date.parse(data.meta.lastShareCompletedAt)>=Date.parse(data.meta.lastShareAttemptAt)
    && data.meta.lastShareActivityType==="com.apple.UIKit.activity.Mail"
    && offsiteShareReminderDue(data.meta)===false
    && window.__backupNotice.message==="Backup ready. Save the file somewhere you can access later."
    && window.__backupNotice.isError===false
  `));

const NativeCancelFiles = new Map();
const NativeShareCancel = boot(
  V3_CFG,
  Object.assign({},EMPTY_DATA,{meta:{lastBackup:null,logsSince:4}}),
  w=>{
    w.Capacitor = {
      getPlatform:()=>"ios",
      isNativePlatform:()=>true,
      isPluginAvailable:name=>name==="Filesystem" || name==="Share",
      Plugins:{
        Filesystem:{
          writeFile:async options=>{
            NativeCancelFiles.set(options.path,options.data);
            return {uri:"file:///Documents/"+options.path};
          },
          readFile:async options=>({data:NativeCancelFiles.get(options.path)})
        },
        Share:{share:async()=>{ throw new Error("Share canceled"); }}
      }
    };
  }
);
NativeShareCancel.window.eval(`
  window.__shareCancelNotice=null;
  flashSave=(message,isError)=>{window.__shareCancelNotice={message,isError:!!isError};};
`);
const nativeCancelResult = await NativeShareCancel.window.eval(`doBackup("shareDataBtn",true)`);
check("cancelled share preserves the local backup and records only the attempt",
  nativeCancelResult===false
  && NativeCancelFiles.size===1
  && NativeShareCancel.window.eval(`
    data.meta.lastBackup===todayStr()
    && data.meta.logsSince===0
    && typeof data.meta.lastShareAttemptAt==="string"
    && !Object.prototype.hasOwnProperty.call(data.meta,"lastShareCompletedAt")
    && window.__shareCancelNotice.message==="Backup canceled. Your existing data is unchanged."
    && window.__shareCancelNotice.isError===false
    && offsiteShareReminderDue(data.meta)===false
  `));

const staleCompletedAt = new Date(Date.now()-15*86400000).toISOString();
const ReminderSnooze = boot(
  V3_CFG,
  Object.assign({},EMPTY_DATA,{meta:{lastBackup:dstr(0),logsSince:0,lastShareCompletedAt:staleCompletedAt}})
);
check("elapsed completed-share age shows the offsite reminder without requiring new logs",
  !ReminderSnooze.window.document.getElementById("backupCard").classList.contains("hidden"));
ReminderSnooze.window.document.getElementById("backupSnoozeBtn")
  .dispatchEvent(new ReminderSnooze.window.Event("click",{bubbles:true}));
check("remind-me-later persists a seven-day snooze and hides the reminder",
  ReminderSnooze.window.document.getElementById("backupCard").classList.contains("hidden")
  && !ReminderSnooze.window.document.getElementById("backupStatusToast").classList.contains("hidden")
  && ReminderSnooze.window.document.getElementById("backupStatusToast").textContent==="Backup reminder postponed for 7 days."
  && ReminderSnooze.window.eval(`
    typeof data.meta.offsiteReminderSnoozedUntil==="string"
    && Date.parse(data.meta.offsiteReminderSnoozedUntil)>Date.now()+6*BACKUP_DAY_MS
    && offsiteShareReminderDue(data.meta)===false
  `));

const NativeBackupFailure = boot(
  V3_CFG,
  Object.assign({},EMPTY_DATA,{meta:{lastBackup:null,logsSince:4}}),
  w=>{
    w.Capacitor = {
      getPlatform:()=>"ios",
      isNativePlatform:()=>true,
      isPluginAvailable:name=>name==="Filesystem" || name==="Share",
      Plugins:{
        Filesystem:{
          writeFile:async()=>{ throw new Error("disk denied"); },
          readFile:async()=>({data:""})
        },
        Share:{share:async()=>({})}
      }
    };
  }
);
NativeBackupFailure.window.eval(`
  window.__backupFailure=null;
  flashSave=(message,isError)=>{window.__backupFailure={message,isError};};
`);
NativeBackupFailure.__storageCalls.length=0;
const nativeBackupFailureResult =
  await NativeBackupFailure.window.eval(`doBackup("exportDataBtn")`);
check("failed native backup does not falsely record local or share success",
  nativeBackupFailureResult===false
  && NativeBackupFailure.window.eval(`
    data.meta.lastBackup===null
    && data.meta.logsSince===4
    && !Object.prototype.hasOwnProperty.call(data.meta,"lastShareAttemptAt")
    && !Object.prototype.hasOwnProperty.call(data.meta,"lastShareCompletedAt")
    && window.__backupFailure.message==="Backup failed — no backup was recorded"
    && window.__backupFailure.isError===true
  `)
  && sacredCalls(NativeBackupFailure).length===0);

// ================= v44: update toast =================
function bootSW(hasController){
  const fired = { listeners:{}, events:[] };
  const dom = boot(EXISTING_CFG, EMPTY_DATA, (w)=>{
    Object.defineProperty(w.navigator, "serviceWorker", { configurable:true, value:{
      controller: hasController ? {} : null,
      addEventListener: (ev,fn)=>{ (fired.listeners[ev]=fired.listeners[ev]||[]).push(fn); fired.events.push("listen:"+ev); },
      register: (u)=>{ fired.events.push("register:"+u); return Promise.resolve({}); },
      ready: Promise.resolve({})
    }});
  });
  dom.__fire = ev=>(fired.listeners[ev]||[]).forEach(f=>f());
  dom.__events = fired.events;
  return dom;
}
// listener order + registration untouched
let U = bootSW(true);
await wait(30); // registration happens on window load
check("controllerchange listener attached before register()", (()=>{
  const li = U.__events.indexOf("listen:controllerchange");
  const ri = U.__events.indexOf("register:sw.js");
  return li > -1 && ri > -1 && li < ri;
})());
const toastEl = d=>d.window.document.getElementById("updateToast");
check("no toast without an update signal", toastEl(U).classList.contains("hidden"));
// real update: controller existed, then changes
U.__fire("controllerchange");
check("controller change with a prior controller shows the toast", !toastEl(U).classList.contains("hidden"));
U.__fire("controllerchange"); U.__fire("controllerchange");
check("multiple SW events cannot duplicate or re-arm the toast", !toastEl(U).classList.contains("hidden") && U.window.eval("updateToastShown")===true);
// reload acts exactly once
U.window.eval("requestAppReload = function(){ window.__reloads = (window.__reloads||0)+1; };");
const clickU = id=>U.window.document.getElementById(id).dispatchEvent(new U.window.Event("click",{bubbles:true}));
clickU("updateReloadBtn"); clickU("updateReloadBtn");
check("tapping reload reloads exactly once", U.window.eval("window.__reloads")===1);
check("post-tap controller change cannot reload again or re-toast", (()=>{ U.__fire("controllerchange"); return U.window.eval("window.__reloads")===1 && toastEl(U).classList.contains("hidden"); })());
// dismissal: session-only, no reload
let V = bootSW(true); await wait(30);
V.__fire("controllerchange");
V.window.document.getElementById("updateDismissBtn").dispatchEvent(new V.window.Event("click",{bubbles:true}));
check("dismiss hides the toast without reloading", toastEl(V).classList.contains("hidden") && !V.window.eval("window.__reloads"));
check("dismissal is session-only (no persistent storage written)", V.window.eval(`Object.keys(localStorage).every(k=>!/toast|dismiss|update/i.test(k))`));
// first install: controller was null
let W2 = bootSW(false); await wait(30);
W2.__fire("controllerchange");
check("first service-worker installation never shows the toast", toastEl(W2).classList.contains("hidden"));


// ================= v76: typed workout model regression =================
const v76FixtureCandidates = [
  path.join(__dirname,"fixtures","exercise-model-cross-platform.json"),
  path.join(__dirname,"tests","fixtures","exercise-model-cross-platform.json")
];
const v76FixturePath = v76FixtureCandidates.find(p=>fs.existsSync(p));
if (!v76FixturePath) throw new Error("v76 cross-platform fixture not found");

const V76_FIXTURE = JSON.parse(fs.readFileSync(v76FixturePath,"utf8"));
const V76_FX_DATA = V76_FIXTURE.backup.data;
const V76_FX_WORKOUT = V76_FX_DATA.workouts[0];
const V76_FX_DRAFT = V76_FX_DATA.activeWorkoutDraft;

const clone76 = v=>JSON.parse(JSON.stringify(v));
const stable76 = v=>{
  if (Array.isArray(v)) return v.map(stable76);
  if (v && typeof v==="object"){
    return Object.fromEntries(
      Object.keys(v).sort().map(k=>[k,stable76(v[k])])
    );
  }
  return v;
};
const same76 = (a,b)=>
  JSON.stringify(stable76(a))===JSON.stringify(stable76(b));

const card76 = (doc,name)=>
  [...doc.querySelectorAll("#exerciseInputs .exercise")].find(card=>{
    const b=card.querySelector(".x-head b");
    return b && b.textContent===name;
  });

const click76 = (dom,el)=>
  el.dispatchEvent(new dom.window.Event("click",{bubbles:true}));

const input76 = (dom,el,value)=>{
  el.value=String(value);
  el.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
};

const change76 = (dom,el,value)=>{
  el.value=value;
  el.dispatchEvent(new dom.window.Event("change",{bubbles:true}));
};

// 1. Canonical exercise library must choose the correct editor on a fresh session.
const V76_PROGRAM = {
  name:"V76 Typed Program",
  author:"Suite",
  days:[{
    id:"D1",
    title:"Typed Day",
    exercises:[
      {name:"Bench Press",scheme:"3×5"},
      {name:"Pull-Up",scheme:"3×8"},
      {name:"Run",scheme:""},
      {name:"Farmer Carry",scheme:""},
      {name:"Sprint Intervals",scheme:""},
      {name:"Mobility Flow",scheme:""}
    ]
  }]
};

const T76Fresh = boot(
  V3_CFG,
  Object.assign({},EMPTY_DATA,{workouts:[],activeWorkoutDraft:null}),
  null,
  V76_PROGRAM
);

const dT76Fresh = T76Fresh.window.document;

check(
  "v76 canonical shapes choose lift/reps/timeDist/carry/rounds/text session modes",
  T76Fresh.window.eval(`
    sessionState["Bench Press"].mode==="rows"
    && sessionState["Bench Press"].rowShape==="lift"
    && sessionState["Pull-Up"].mode==="rows"
    && sessionState["Pull-Up"].rowShape==="reps"
    && sessionState["Run"].mode==="timeDist"
    && sessionState["Farmer Carry"].mode==="carry"
    && sessionState["Sprint Intervals"].mode==="rounds"
    && sessionState["Mobility Flow"].mode==="text"
  `)
);

check(
  "v76 all 203 canonical exercises produce their stored editor mode contract",
  T76Fresh.window.eval(`
    (()=>{
      const expected = {
        lift:["rows","lift"],
        reps:["rows","reps"],
        timeDist:["timeDist",null],
        carry:["carry",null],
        rounds:["rounds",null],
        text:["text",null]
      };

      return (
        EXERCISE_LIBRARY.length===203
        && EXERCISE_LIBRARY.every(
          entry=>{
            const state =
              makePlanSessionState(
                {
                  exerciseId:entry.id,
                  name:entry.name,
                  scheme:""
                },
                null
              );

            const contract =
              expected[entry.shape];

            return (
              !!contract
              && state.mode===contract[0]
              && state.rowShape===contract[1]
            );
          }
        )
      );
    })()
  `)
);

const T76Substitution = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  V76_PROGRAM
);

T76Substitution.window.eval(`
  [
    "Bench Press",
    "Pull-Up",
    "Run",
    "Farmer Carry",
    "Sprint Intervals",
    "Mobility Flow"
  ].forEach(
    name=>{
      delete sessionState[name];
      initSessionStateFor(name);
    }
  )
`);

check(
  "v76 exercise substitutions use canonical lift reps timeDist carry rounds and text editors",
  T76Substitution.window.eval(`
    sessionState["Bench Press"].mode==="rows"
    && sessionState["Bench Press"].rowShape
       ==="lift"
    && sessionState["Pull-Up"].mode==="rows"
    && sessionState["Pull-Up"].rowShape
       ==="reps"
    && sessionState["Run"].mode
       ==="timeDist"
    && sessionState["Farmer Carry"].mode
       ==="carry"
    && sessionState["Sprint Intervals"].mode
       ==="rounds"
    && sessionState["Mobility Flow"].mode
       ==="text"
  `)
);

check(
  "v78 fresh profile editors expose every practical field without a guided timer",
  [
    "hours","minutes","seconds","distance","distanceUnit","pace","effort"
  ].every(
    key=>!!card76(dT76Fresh,"Run").querySelector(
      '[data-profile-field="'+key+'"]'
    )
  )
  && card76(dT76Fresh,"Run").querySelector(
    '[data-profile-field="seconds"]'
  ).max==="59"
  && [
    "count","lbs","distance","distanceUnit",
    "durationMinutes","durationSeconds","recoverySeconds","effort"
  ].every(
    key=>!!card76(dT76Fresh,"Farmer Carry").querySelector(
      '[data-profile-field="'+key+'"]'
    )
  )
  && [
    "intervals","workMinutes","workSeconds",
    "recoverySeconds","distance","distanceUnit","effort"
  ].every(
    key=>!!card76(dT76Fresh,"Sprint Intervals").querySelector(
      '[data-profile-field="'+key+'"]'
    )
  )
  && !/start timer|pause timer|resume timer/i.test(
    card76(dT76Fresh,"Sprint Intervals").textContent
  )
);

// 2. Exact fixture semantics for reps rows: bodyweight and weighted reps can coexist.
const fixtureMixedReps76 = V76_FX_WORKOUT.sets["Pull-Up"];
const validatedMixedReps76 = JSON.parse(
  T76Fresh.window.eval(`
    JSON.stringify(
      validateExerciseEntry({
        mode:"rows",
        rowShape:"reps",
        rows:[
          {r:8,w:undefined,touched:true},
          {r:5,w:25,touched:true}
        ]
      }).value
    )
  `)
);

check(
  "v76 reps rows preserve fixture bodyweight and weighted sets exactly",
  same76(validatedMixedReps76,fixtureMixedReps76)
);

// Fresh bodyweight reps can save with no weight property.
const pullCard76 = card76(dT76Fresh,"Pull-Up");
const pullReps76 = pullCard76.querySelector('input[data-field="reps"]');
const pullWeight76 = pullCard76.querySelector('input[data-field="weight"]');

check(
  "v76 reps editor visibly treats weight as optional",
  pullWeight76.placeholder==="lb opt."
);

input76(T76Fresh,pullReps76,10);
click76(T76Fresh,pullCard76.querySelector(".saveExBtn"));

check(
  "v76 reps-only Save Exercise stores {r} without inventing weight",
  T76Fresh.window.eval(`
    sessionState["Pull-Up"].status==="saved"
    && sessionState["Pull-Up"].saved.length===1
    && sessionState["Pull-Up"].saved[0].r===10
    && !Object.prototype.hasOwnProperty.call(sessionState["Pull-Up"].saved[0],"w")
  `)
);

// 3. Draft resume: use the actual cross-platform values, plus carry/text/future
//    values from the fixture's historical workout.
const typedDraft76 = clone76(V76_FX_DRAFT);
typedDraft76.date = dstr(0);
typedDraft76.day = "__FREE__";
typedDraft76.title = "V76 Fixture Draft";
typedDraft76.programName = "Fixture";
typedDraft76.sets["Farmer Carry"] = clone76(V76_FX_WORKOUT.sets["Farmer Carry"]);
typedDraft76.sets["Mobility Flow"] = clone76(V76_FX_WORKOUT.sets["Mobility Flow"]);
typedDraft76.sets["Future Shape"] = clone76(V76_FX_WORKOUT.sets["Future Shape"]);

const typedDraftData76 = Object.assign(
  {},
  EMPTY_DATA,
  {
    workouts:[],
    activeWorkoutDraft:typedDraft76,
    myExercises:clone76(V76_FX_DATA.myExercises||{})
  }
);

const T76Draft = boot(V3_CFG,typedDraftData76,null,TEST_PROGRAM);
const dT76Draft = T76Draft.window.document;

check(
  "v76 persisted typed draft is offered for Resume",
  !dT76Draft.getElementById("workoutDraftCard").classList.contains("hidden")
);

click76(T76Draft,dT76Draft.getElementById("resumeWorkoutDraftBtn"));

check(
  "v76 draft Resume restores every stored shape without stringification",
  T76Draft.window.eval(`
    workoutDraftLoaded
    && sessionState["Pull-Up"].mode==="rows"
    && sessionState["Pull-Up"].rowShape==="reps"
    && sessionState["Run"].mode==="timeDist"
    && sessionState["Tempo Step Intervals"].mode==="rounds"
    && sessionState["Farmer Carry"].mode==="carry"
    && sessionState["Mobility Flow"].mode==="text"
    && sessionState["Future Shape"].mode==="future"
  `)
  && !dT76Draft.getElementById("exerciseInputs").textContent.includes("[object Object]")
);

const resumedFuture76 = JSON.parse(
  T76Draft.window.eval(`JSON.stringify(sessionState["Future Shape"].saved)`)
);

check(
  "v76 unknown future draft value is byte-meaning preserved and read-only",
  same76(resumedFuture76,V76_FX_WORKOUT.sets["Future Shape"])
  && /Read only/.test(card76(dT76Draft,"Future Shape").textContent)
  && ![...card76(dT76Draft,"Future Shape").querySelectorAll("button")]
      .some(b=>b.textContent==="Edit")
);

check(
  "v76 typed history formatter renders real values instead of object placeholders",
  T76Draft.window.eval(`
    formatSets(${JSON.stringify(V76_FX_WORKOUT.sets["Run"])})==="20 min · 2 mi"
    && formatSets(${JSON.stringify(V76_FX_WORKOUT.sets["Farmer Carry"])})==="80 lb · 100 ft"
    && /8 rounds/.test(formatSets(${JSON.stringify(V76_FX_WORKOUT.sets["Sprint Intervals"])}))
  `)
);

// Edit and re-save timeDist through the actual UI.
click76(
  T76Draft,
  [...card76(dT76Draft,"Run").querySelectorAll("button")]
    .find(b=>b.textContent==="Edit")
);

let runCard76 = card76(dT76Draft,"Run");
const runHours76 =
  runCard76.querySelector('[data-profile-field="hours"]');
const runMinutes76 =
  runCard76.querySelector('[data-profile-field="minutes"]');
const runSeconds76 =
  runCard76.querySelector('[data-profile-field="seconds"]');
const runDistance76 =
  runCard76.querySelector('[data-profile-field="distance"]');
const runUnit76 =
  runCard76.querySelector('[data-profile-field="distanceUnit"]');
const runPace76 =
  runCard76.querySelector('[data-profile-field="pace"]');
const runEffort76 =
  runCard76.querySelector('[data-profile-field="effort"]');

check(
  "v78 steady time/distance Edit restores all profile fields",
  !!runHours76
  && !!runMinutes76
  && !!runSeconds76
  && runSeconds76.max==="59"
  && !!runDistance76
  && !!runUnit76
  && !!runPace76
  && !!runEffort76
);

input76(T76Draft,runMinutes76,15);
input76(T76Draft,runSeconds76,50);
input76(T76Draft,runDistance76,1.5);
change76(T76Draft,runUnit76,"km");
click76(T76Draft,card76(dT76Draft,"Run").querySelector(".saveExBtn"));

const savedDraftAfterRun76 = JSON.parse(
  T76Draft.window.localStorage.getItem("forge:data")
).activeWorkoutDraft;

check(
  "v76 minutes-seconds timeDist UI saves the exact typed contract",
  same76(
    savedDraftAfterRun76.sets["Run"],
    {t:"timeDist",secs:950,dist:1.5,distUnit:"km"}
  )
);

check(
  "v76 saving a known typed draft entry does not rewrite the unknown future entry",
  same76(
    savedDraftAfterRun76.sets["Future Shape"],
    V76_FX_WORKOUT.sets["Future Shape"]
  )
);

// Carry editor: open and save unchanged fixture value.
click76(
  T76Draft,
  [...card76(dT76Draft,"Farmer Carry").querySelectorAll("button")]
    .find(b=>b.textContent==="Edit")
);

let carryCard76 = card76(dT76Draft,"Farmer Carry");

check(
  "v78 loaded-distance Edit restores all required and optional fields",
  [
    "count","lbs","distance","distanceUnit",
    "durationMinutes","durationSeconds","recoverySeconds","effort"
  ].every(
    key=>!!carryCard76.querySelector(
      '[data-profile-field="'+key+'"]'
    )
  )
);

click76(T76Draft,carryCard76.querySelector(".saveExBtn"));

check(
  "v76 carry re-save preserves fixture value exactly",
  same76(
    JSON.parse(
      T76Draft.window.eval(`JSON.stringify(sessionState["Farmer Carry"].saved)`)
    ),
    V76_FX_WORKOUT.sets["Farmer Carry"]
  )
);

// Rounds editor: no timer, just the contract fields.
click76(
  T76Draft,
  [...card76(dT76Draft,"Tempo Step Intervals").querySelectorAll("button")]
    .find(b=>b.textContent==="Edit")
);

let roundsCard76 = card76(dT76Draft,"Tempo Step Intervals");

check(
  "v78 conditioning-rounds Edit restores rounds, work, recovery and notes",
  [
    "rounds","workMinutes","workSeconds","recoverySeconds","note"
  ].every(
    key=>!!roundsCard76.querySelector(
      '[data-profile-field="'+key+'"]'
    )
  )
  && !/start timer|pause timer|resume timer/i.test(
    roundsCard76.textContent
  )
);

click76(T76Draft,roundsCard76.querySelector(".saveExBtn"));

check(
  "v76 rounds re-save preserves fixture typed value exactly",
  same76(
    JSON.parse(
      T76Draft.window.eval(`JSON.stringify(sessionState["Tempo Step Intervals"].saved)`)
    ),
    V76_FX_DRAFT.sets["Tempo Step Intervals"]
  )
);

// Reps-only draft row must still be lossless after Edit + Save.
click76(
  T76Draft,
  [...card76(dT76Draft,"Pull-Up").querySelectorAll("button")]
    .find(b=>b.textContent==="Edit")
);

let pullDraftCard76 = card76(dT76Draft,"Pull-Up");
const pullDraftWeight76 = pullDraftCard76.querySelector('input[data-field="weight"]');
const pullDraftReps76 = pullDraftCard76.querySelector('input[data-field="reps"]');

check(
  "v76 resumed reps-only row reopens with blank optional weight",
  pullDraftWeight76.value===""
  && pullDraftWeight76.placeholder==="lb opt."
  && pullDraftReps76.value==="10"
);

input76(T76Draft,pullDraftReps76,11);
click76(T76Draft,card76(dT76Draft,"Pull-Up").querySelector(".saveExBtn"));

const updatedPull76 = JSON.parse(
  T76Draft.window.eval(`JSON.stringify(sessionState["Pull-Up"].saved)`)
);

check(
  "v76 edited reps-only draft remains {r} without adding weight",
  updatedPull76.length===1
  && updatedPull76[0].r===11
  && !Object.prototype.hasOwnProperty.call(updatedPull76[0],"w")
);

// 4. Historical editor: load the fixture workout, preserve all saved shapes,
//    then perform a real Update Session with no edits.
const historyData76 = Object.assign(
  {},
  EMPTY_DATA,
  {
    workouts:[clone76(V76_FX_WORKOUT)],
    activeWorkoutDraft:null,
    myExercises:clone76(V76_FX_DATA.myExercises||{})
  }
);

const T76History = boot(V3_CFG,historyData76,null,TEST_PROGRAM);
const dT76History = T76History.window.document;

T76History.window.eval("startEditWorkout(0)");

check(
  "v76 historical Edit loads typed, text, reps, and future values losslessly",
  T76History.window.eval(`
    sessionState["Bench Press"].mode==="rows"
    && sessionState["Pull-Up"].mode==="rows"
    && sessionState["Pull-Up"].rowShape==="reps"
    && sessionState["Run"].mode==="timeDist"
    && sessionState["Farmer Carry"].mode==="carry"
    && sessionState["Sprint Intervals"].mode==="rounds"
    && sessionState["Mobility Flow"].mode==="text"
    && sessionState["Future Shape"].mode==="future"
  `)
  && !dT76History.getElementById("exerciseInputs").textContent.includes("[object Object]")
);

const collectedHistory76 = JSON.parse(
  T76History.window.eval(`JSON.stringify(collectSavedSessionSets(sessionState).sets)`)
);

check(
  "v76 historical editor collection preserves the complete fixture set map",
  same76(collectedHistory76,V76_FX_WORKOUT.sets)
);

const futureBeforeUpdate76 = clone76(V76_FX_WORKOUT.sets["Future Shape"]);

click76(T76History,dT76History.getElementById("logWorkoutBtn"));

const updatedHistory76 = JSON.parse(
  T76History.window.eval(`JSON.stringify(data.workouts[0].sets)`)
);

check(
  "v76 Update Session rewrites no untouched typed/history values",
  same76(updatedHistory76,V76_FX_WORKOUT.sets)
);

check(
  "v76 historical Update Session preserves unknown future object exactly",
  same76(updatedHistory76["Future Shape"],futureBeforeUpdate76)
);

check(
  "v76 historical update exits edit mode normally",
  T76History.window.eval("editingWorkoutIdx===null")
);



// ---------- v76 typed Save Exercise failure rollback ----------
const rollbackDraft76 = clone76(V76_FX_DRAFT);
rollbackDraft76.date = dstr(0);
rollbackDraft76.day = "__FREE__";
rollbackDraft76.title = "V76 Rollback Draft";
rollbackDraft76.programName = "Fixture";

const rollbackData76 = Object.assign(
  {},
  EMPTY_DATA,
  {
    workouts:[],
    activeWorkoutDraft:rollbackDraft76,
    myExercises:clone76(V76_FX_DATA.myExercises||{})
  }
);

const T76Rollback = boot(V3_CFG,rollbackData76,null,TEST_PROGRAM);
const dT76Rollback = T76Rollback.window.document;

click76(T76Rollback,dT76Rollback.getElementById("resumeWorkoutDraftBtn"));

const rollbackRunEdit76 =
  [...card76(dT76Rollback,"Run").querySelectorAll("button")]
    .find(b=>b.textContent==="Edit");

click76(T76Rollback,rollbackRunEdit76);

let rollbackRunCard76 = card76(dT76Rollback,"Run");
let rollbackRunMinutes76 =
  rollbackRunCard76.querySelector('input[aria-label="Run minutes"]');
let rollbackRunSeconds76 =
  rollbackRunCard76.querySelector('input[aria-label="Run seconds"]');

input76(T76Rollback,rollbackRunMinutes76,16);
input76(T76Rollback,rollbackRunSeconds76,15);

const rollbackPrimaryBefore76 =
  T76Rollback.window.localStorage.getItem("forge:data");

const rollbackLkgBefore76 =
  T76Rollback.window.localStorage.getItem("forge:lkg");

const rollbackProto76 =
  Object.getPrototypeOf(T76Rollback.window.localStorage);

const rollbackSetItem76 = rollbackProto76.setItem;

rollbackProto76.setItem = function(k,v){
  if (k==="forge:data"){
    throw new Error("v76 typed workout save denied");
  }
  return rollbackSetItem76.call(this,k,v);
};

click76(
  T76Rollback,
  card76(dT76Rollback,"Run").querySelector(".saveExBtn")
);

rollbackProto76.setItem = rollbackSetItem76;

check(
  "v78 failed profile Save Exercise keeps edited fields available for retry",
  T76Rollback.window.eval(`
    sessionState["Run"].status==="unsaved"
    && sessionState["Run"].mode==="timeDist"
    && Number(sessionState["Run"].typed.minutes)===16
    && Number(sessionState["Run"].typed.seconds)===15
  `)
);

check(
  "v76 failed typed Save Exercise restores the prior saved exercise value in memory",
  T76Rollback.window.eval(`
    sessionState["Run"].saved.t==="timeDist"
    && sessionState["Run"].saved.secs===900
  `)
);

check(
  "v76 failed typed Save Exercise restores the prior active workout draft in memory",
  T76Rollback.window.eval(`
    data.activeWorkoutDraft.sets["Run"].t==="timeDist"
    && data.activeWorkoutDraft.sets["Run"].secs===900
  `)
);

check(
  "v76 failed typed Save Exercise leaves persisted primary workout draft unchanged",
  T76Rollback.window.localStorage.getItem("forge:data")===rollbackPrimaryBefore76
);

check(
  "v76 failed typed Save Exercise does not replace the last-known-good snapshot",
  T76Rollback.window.localStorage.getItem("forge:lkg")===rollbackLkgBefore76
);

check(
  "v76 failed typed Save Exercise reports failure instead of false completion",
  !dT76Rollback.getElementById("workoutErr").classList.contains("hidden")
  && /could not be saved/i.test(
    dT76Rollback.getElementById("workoutErr").textContent
  )
  && !/Completed/.test(card76(dT76Rollback,"Run").textContent)
);



// ---------- v76 unified canonical exercise pickers ----------
const pickerUser76 =
  Object.values(V76_FX_DATA.myExercises||{})[0];

check(
  "v76 fixture supplies a saved user exercise for unified-picker coverage",
  !!pickerUser76
  && typeof pickerUser76.id==="string"
  && typeof pickerUser76.name==="string"
  && typeof pickerUser76.shape==="string"
);

const pickerData76 = Object.assign(
  {},
  EMPTY_DATA,
  {
    workouts:[],
    activeWorkoutDraft:null,
    myExercises:clone76(V76_FX_DATA.myExercises||{})
  }
);

const T76Picker = boot(
  V3_CFG,
  pickerData76,
  null,
  TEST_PROGRAM
);

const dT76Picker = T76Picker.window.document;
const freestylePicker76 =
  dT76Picker.getElementById("addExSel");

const freestyleBuiltIns76 =
  [...freestylePicker76.querySelectorAll(
    'option[data-exercise-source="builtin"]'
  )];

const freestyleUsers76 =
  [...freestylePicker76.querySelectorAll(
    'option[data-exercise-source="user"]'
  )];

check(
  "post-v76 Freestyle picker exposes all 203 canonical built-ins by display name",
  freestyleBuiltIns76.length===203
  && freestyleBuiltIns76.every(o=>
    o.value.length>0
    && o.textContent===o.value
    && o.value!=="[object Object]"
  )
);

check(
  "v76 Freestyle picker retains canonical id and shape metadata",
  freestyleBuiltIns76.some(o=>
    o.value==="Bench Press"
    && o.dataset.exerciseShape==="lift"
    && /^bp:/.test(o.dataset.exerciseId)
  )
  && freestyleBuiltIns76.some(o=>
    o.value==="Pull-Up"
    && o.dataset.exerciseShape==="reps"
    && /^bp:/.test(o.dataset.exerciseId)
  )
  && freestyleBuiltIns76.some(o=>
    o.value==="Run"
    && o.dataset.exerciseShape==="timeDist"
    && /^bp:/.test(o.dataset.exerciseId)
  )
  && freestyleBuiltIns76.some(o=>
    o.value==="Sprinting"
    && o.dataset.exerciseId==="bp:sprinting"
    && o.dataset.exerciseShape==="timeDist"
  )
  && freestyleBuiltIns76.some(o=>
    o.value==="Farmer Carry"
    && o.dataset.exerciseShape==="carry"
    && /^bp:/.test(o.dataset.exerciseId)
  )
  && freestyleBuiltIns76.some(o=>
    o.value==="Sprint Intervals"
    && o.dataset.exerciseShape==="rounds"
    && /^bp:/.test(o.dataset.exerciseId)
  )
  && freestyleBuiltIns76.some(o=>
    o.value==="Mobility Flow"
    && o.dataset.exerciseShape==="text"
    && /^bp:/.test(o.dataset.exerciseId)
  )
);

check(
  "v76 Freestyle unified picker contains no legacy [Cardio] duplicate values",
  ![...freestylePicker76.options]
    .some(o=>o.value.startsWith("[Cardio] "))
);

check(
  "v76 Freestyle picker includes restored myExercises with stored metadata",
  freestyleUsers76.length===
    Object.keys(V76_FX_DATA.myExercises||{}).length
  && freestyleUsers76.some(o=>
    o.value===pickerUser76.name
    && o.dataset.exerciseId===pickerUser76.id
    && o.dataset.exerciseShape===pickerUser76.shape
    && o.dataset.exerciseSource==="user"
  )
);

check(
  "v76 saved user exercise former names still resolve to its canonical shape",
  (pickerUser76.formerNames||[]).every(oldName=>
    T76Picker.window.eval(
      `exerciseShapeForName(${JSON.stringify(oldName)})`
    )===pickerUser76.shape
  )
);

// Add the restored user exercise through the real Freestyle picker.
dT76Picker.getElementById("wDay").value="__FREE__";
dT76Picker.getElementById("wDay").dispatchEvent(
  new T76Picker.window.Event("change",{bubbles:true})
);

freestylePicker76.value=pickerUser76.name;

dT76Picker.getElementById("addExBtn").dispatchEvent(
  new T76Picker.window.Event("click",{bubbles:true})
);

const expectedUserMode76 =
  pickerUser76.shape==="lift" || pickerUser76.shape==="reps"
    ? "rows"
    : pickerUser76.shape;

check(
  "v76 restored myExercise added from Freestyle uses its saved tracking shape",
  T76Picker.window.eval(`
    !!sessionState[${JSON.stringify(pickerUser76.name)}]
    && sessionState[${JSON.stringify(pickerUser76.name)}].mode
       ===${JSON.stringify(expectedUserMode76)}
  `)
);

// The dedicated Cardio session still exists independently.
check(
  "v76 dedicated Cardio session remains available outside unified exercise picker",
  [...dT76Picker.getElementById("wDay").options]
    .some(o=>o.value==="__CARDIO__")
  && dT76Picker.getElementById("cardioType").options.length>0
);

// Program Builder must use the exact same unified source.
T76Picker.window.eval("openBuilder(false)");

const builderPicker76 =
  [...dT76Picker.querySelectorAll("select")]
    .filter(s=>s!==freestylePicker76)
    .find(s=>
      s.querySelectorAll(
        'option[data-exercise-source="builtin"]'
      ).length===203
    );

check(
  "post-v76 Program Builder exposes all 203 canonical built-in exercise names",
  !!builderPicker76
  && builderPicker76.querySelectorAll(
    'option[data-exercise-source="builtin"]'
  ).length===203
  && [...builderPicker76.querySelectorAll(
    'option[data-exercise-source="builtin"]'
  )].every(o=>
    o.value.length>0
    && o.value!=="[object Object]"
    && o.textContent===o.value
  )
);

check(
  "v76 Program Builder includes restored myExercises",
  !!builderPicker76
  && [...builderPicker76.querySelectorAll(
    'option[data-exercise-source="user"]'
  )].some(o=>
    o.value===pickerUser76.name
    && o.dataset.exerciseId===pickerUser76.id
    && o.dataset.exerciseShape===pickerUser76.shape
  )
);

check(
  "v76 Program Builder contains no legacy [Cardio] duplicate values",
  !!builderPicker76
  && ![...builderPicker76.options]
    .some(o=>o.value.startsWith("[Cardio] "))
);




// ---------- v76 grouped exercise picker parity ----------
const Grouped76 = boot(EXISTING_CFG, EMPTY_DATA);
const dGrouped76 = Grouped76.window.document;

Grouped76.window.eval(`renderLibraryOptions()`);

const groupedPicker76 =
  dGrouped76.getElementById("addExSel");

const builtInGroups76 =
  [...groupedPicker76.querySelectorAll("optgroup")]
    .filter(group=>group.dataset.exerciseSource==="builtin");

const expectedShapeLabels76 = [
  "Weight × reps",
  "Reps (weight optional)",
  "Time / distance",
  "Weight + distance",
  "Rounds / intervals",
  "Free text"
];

check(
  "v76 Freestyle picker restores the six web-v76 exercise shape sections",
  JSON.stringify(builtInGroups76.map(group=>group.label))
    === JSON.stringify(expectedShapeLabels76)
);

check(
  "v76 Freestyle shape sections remain in canonical shape order",
  JSON.stringify(builtInGroups76.map(group=>group.dataset.exerciseShape))
    === JSON.stringify(["lift","reps","timeDist","carry","rounds","text"])
);

check(
  "v76 Freestyle shape sections contain all 202 built-ins exactly once",
  (()=>{
    const options=builtInGroups76.flatMap(group=>[...group.querySelectorAll("option")]);
    return options.length===203
      && new Set(options.map(option=>option.dataset.exerciseId)).size===203
      && options.every(option=>option.dataset.exerciseSource==="builtin");
  })()
);

check(
  "v76 Freestyle exercises are A-Z inside every shape section",
  builtInGroups76.every(group=>{
    const names=[...group.querySelectorAll("option")].map(option=>option.textContent);
    const sorted=names.slice().sort((a,b)=>a.localeCompare(b));
    return JSON.stringify(names)===JSON.stringify(sorted);
  })
);

check(
  "v76 grouped picker preserves separate My Exercises and Custom sections",
  (()=>{
    const groups=[...groupedPicker76.querySelectorAll("optgroup")];
    const custom=groups.find(group=>group.label==="Custom");
    return !groups.some(group=>group.label==="Exercise library")
      && !!custom
      && [...custom.querySelectorAll("option")].some(
        option=>option.value==="__CUSTOM__"
      );
  })()
);

const groupedTrainSource76 = fs.readFileSync(
  path.join(__dirname,"..","scripts","03-train.js"),
  "utf8"
);

check(
  "v76 Program Builder continues to use the same grouped picker helper",
  /function renderBuilder\(\)[\s\S]*?populateUnifiedExercisePicker\(sel\);/
    .test(groupedTrainSource76)
);



// ---------- v76 physical-device UX corrections ----------
const DeviceUX76 = boot(EXISTING_CFG, EMPTY_DATA);
const dDeviceUX76 = DeviceUX76.window.document;

DeviceUX76.window.eval(`
  wDaySel.value="__FREE__";
  initSessionState();
  renderSessionInputs();
  renderLibraryOptions();
`);

const devicePicker76 =
  dDeviceUX76.getElementById("addExSel");

const deviceAdd76 =
  dDeviceUX76.getElementById("addExBtn");

devicePicker76.value="Run";
deviceAdd76.click();

devicePicker76.value="Run";
deviceAdd76.click();

check(
  "v76 Freestyle rejects a duplicate same-name exercise",
  DeviceUX76.window.eval(`
    extraExercises.filter(ex=>ex.name==="Run").length===1
  `)
  && /already in the session/i.test(
    dDeviceUX76.getElementById("workoutErr").textContent
  )
);

const removeRun76 =
  [...dDeviceUX76.querySelectorAll("button")]
    .find(
      button=>
        button.getAttribute("aria-label")==="Remove Run"
    );

check(
  "v76 unsaved Freestyle extra exposes a Remove control",
  !!removeRun76
);

if (removeRun76) removeRun76.click();

check(
  "v76 Remove clears the accidental extra and its session state",
  DeviceUX76.window.eval(`
    extraExercises.every(ex=>ex.name!=="Run")
      && !sessionState["Run"]
  `)
);

devicePicker76.value="Mobility Flow";
deviceAdd76.click();

const mobilityCard76 =
  [...dDeviceUX76.querySelectorAll(".exercise")]
    .find(
      card=>card.textContent.includes("Mobility Flow")
    );

const mobilityLabel76 =
  mobilityCard76
    ? [...mobilityCard76.querySelectorAll(".slabel")]
        .find(
          label=>
            label.textContent==="Details / notes (required)"
        )
    : null;

const mobilityInput76 =
  dDeviceUX76.querySelector(
    'input[aria-label="Mobility Flow details or notes"]'
  );

check(
  "v78 Mobility Flow visibly requires duration and keeps notes optional",
  !!mobilityCard76
  && !!mobilityCard76.querySelector(
    '[data-profile-field="minutes"][aria-required="true"]'
  )
  && !!mobilityCard76.querySelector(
    '[data-profile-field="seconds"]'
  )
  && !!mobilityCard76.querySelector(
    '[data-profile-field="note"]'
  )
  && [...mobilityCard76.querySelectorAll(".slabel")]
    .some(
      label=>label.textContent==="Minutes (required)"
    )
  && [...mobilityCard76.querySelectorAll(".slabel")]
    .some(
      label=>label.textContent==="Notes (optional)"
    )
);



// ---------- v78 Program Builder mobile containment ----------
const builderTrainSource78 =
  fs.readFileSync(
    path.join(__dirname,"..","scripts","03-train.js"),
    "utf8"
  );

check(
  "v78 Program Builder add row uses its responsive layout hook",
  /addRow\.className\s*=\s*"bex bex-add";/
    .test(builderTrainSource78)
  && !builderTrainSource78.includes(
    '"flex:2 0 100%;"'
  )
  && !builderTrainSource78.includes(
    'sel.style.flex = "2";'
  )
);

check(
  "v78 Program Builder mobile add controls remain inside the viewport",
  (()=>{
    const compact=
      rawIndex.replace(/\s+/g,"");

    return (
      compact.includes(
        ".bex-add{flex-wrap:wrap;}"
      )
      && compact.includes(
        "@media(max-width:520px){.bex-add{display:grid;grid-template-columns:minmax(0,1fr);align-items:center;}"
      )
      && compact.includes(
        ".bex-add>.bexercise-search,.bex-add>select,.bex-add>input,.bex-add>.xbtn{grid-column:1;width:100%;}"
      )
    );
  })()
);

// ---------- v78 profile-aware Program Builder ----------
const BuilderProfiles78=
  boot(
    V3_CFG,
    JSON.parse(
      JSON.stringify(EMPTY_DATA)
    )
  );

BuilderProfiles78.window.eval(`
  builderProg={
    name:"Profile Builder",
    days:[{
      id:"D1",
      title:"Day 1",
      exercises:[
        {
          name:"Bench Press",
          scheme:"3×5"
        },
        {
          name:"Run"
        },
        {
          name:"Plank"
        }
      ]
    }]
  };

  builderPrescriptionOpenKey=null;
  renderBuilder();
`);

const dBuilderProfiles78=
  BuilderProfiles78.window.document;

const builderExerciseBlock78=name=>
  [...dBuilderProfiles78.querySelectorAll(
    ".builder-exercise"
  )].find(
    block=>
      block.dataset.exerciseName===name
  );

check(
  "v78 Program Builder removes every generic exercise scheme field",
  !dBuilderProfiles78.querySelector(
    ".bscheme"
  )
  && !builderTrainSource78.includes(
    'placeholder = "e.g. 4×5"'
  )
  && !builderTrainSource78.includes(
    'placeholder = "e.g. 3×8"'
  )
  && !builderTrainSource78.includes(
    "schIn"
  )
);

check(
  "v78 Program Builder adds exercises without inventing a generic scheme",
  (()=>{
    const addRow=
      dBuilderProfiles78.querySelector(
        ".bex-add"
      );

    const picker=
      addRow.querySelector("select");

    picker.value="Yoga";

    addRow
      .querySelector(".xbtn")
      .click();

    return BuilderProfiles78.window.eval(`
      (()=>{
        const exercise=
          builderProg.days[0]
            .exercises[
              builderProg.days[0]
                .exercises.length-1
            ];

        return (
          exercise.name==="Yoga"
          && !Object.prototype
            .hasOwnProperty.call(
              exercise,
              "scheme"
            )
          && !Object.prototype
            .hasOwnProperty.call(
              exercise,
              "prescription"
            )
        );
      })()
    `);
  })()
);

builderExerciseBlock78("Run")
  .querySelector(
    "[data-builder-prescription-toggle]"
  )
  .click();

const runBuilderPanel78=
  dBuilderProfiles78.querySelector(
    '.builder-prescription-editor[data-profile="steadyTimeDistance"]'
  );

check(
  "v78 Run builder details use steady time-distance fields",
  !!runBuilderPanel78
  && !!runBuilderPanel78.querySelector(
    '[data-builder-prescription-field="minutes"]'
  )
  && !!runBuilderPanel78.querySelector(
    '[data-builder-prescription-field="distance"]'
  )
  && !!runBuilderPanel78.querySelector(
    '[data-builder-prescription-field="pace"]'
  )
  && !runBuilderPanel78.querySelector(
    '[data-builder-prescription-field="sets"]'
  )
  && !runBuilderPanel78.querySelector(
    '[data-builder-prescription-field="reps"]'
  )
);

runBuilderPanel78.querySelector(
  '[data-builder-prescription-field="minutes"]'
).value="20";

runBuilderPanel78.querySelector(
  '[data-builder-prescription-field="distance"]'
).value="3";

runBuilderPanel78.querySelector(
  '[data-builder-prescription-action="apply"]'
).click();

check(
  "v78 Run builder details save a structured public prescription",
  BuilderProfiles78.window.eval(`
    (()=>{
      const exercise=
        builderProg.days[0]
          .exercises[1];

      return (
        exercise.name==="Run"
        && exercise.prescription
        && exercise.prescription
          .durationSeconds===1200
        && exercise.prescription
          .distance===3
        && exercise.prescription
          .distanceUnit==="mi"
        && !Object.prototype
          .hasOwnProperty.call(
            exercise,
            "scheme"
          )
      );
    })()
  `)
);

builderExerciseBlock78("Plank")
  .querySelector(
    "[data-builder-prescription-toggle]"
  )
  .click();

const plankBuilderPanel78=
  dBuilderProfiles78.querySelector(
    '.builder-prescription-editor[data-profile="timedHold"]'
  );

check(
  "v78 Plank builder details use hold fields without distance",
  !!plankBuilderPanel78
  && !!plankBuilderPanel78.querySelector(
    '[data-builder-prescription-field="holds"]'
  )
  && !!plankBuilderPanel78.querySelector(
    '[data-builder-prescription-field="holdSeconds"]'
  )
  && !!plankBuilderPanel78.querySelector(
    '[data-builder-prescription-field="recoverySeconds"]'
  )
  && !plankBuilderPanel78.querySelector(
    '[data-builder-prescription-field="distance"]'
  )
);

builderExerciseBlock78("Bench Press")
  .querySelector(
    "[data-builder-prescription-toggle]"
  )
  .click();

const benchBuilderPanel78=
  dBuilderProfiles78.querySelector(
    '.builder-prescription-editor[data-profile="strengthSets"]'
  );

check(
  "v78 strength builder details use sets reps and optional target weight",
  !!benchBuilderPanel78
  && benchBuilderPanel78.querySelector(
    '[data-builder-prescription-field="sets"]'
  ).value==="3"
  && benchBuilderPanel78.querySelector(
    '[data-builder-prescription-field="reps"]'
  ).value==="5"
  && !!benchBuilderPanel78.querySelector(
    '[data-builder-prescription-field="weight"]'
  )
);

// ---------- v78 structured strength prescription prefill ----------
const StructuredRowPrefill78=
  boot(
    V3_CFG,
    JSON.parse(
      JSON.stringify(EMPTY_DATA)
    )
  );

check(
  "v78 Bench Press structured prescription prefills every planned row",
  StructuredRowPrefill78.window.eval(`
    (()=>{
      const state=
        makePlanSessionState(
          {
            name:"Bench Press",
            prescription:{
              sets:4,
              reps:6,
              weight:185,
              weightUnit:"lb"
            }
          },
          null
        );

      return (
        state.mode==="rows"
        && state.profile==="strengthSets"
        && state.rows.length===4
        && state.rows.every(
          row=>
            row.r===6
            && row.w===185
            && row.touched===false
        )
        && state.auto===false
        && state.autoDelta===0
      );
    })()
  `)
);

// ---------- searchable exercise pickers + universal planned replacement ----------
const SEARCH_REPLACE_PROGRAM_76 = {
  name:"Search Replace Test",
  days:[{
    id:"D1",
    title:"Main",
    exercises:[{
      name:"Bench Press",
      scheme:"3×5"
    }]
  }]
};

const SearchReplace76 = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null,
      myExercises:{}
    }
  ),
  null,
  SEARCH_REPLACE_PROGRAM_76
);

const dSearchReplace76 =
  SearchReplace76.window.document;

SearchReplace76.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
  renderLibraryOptions();
`);

const workoutSearch76 =
  dSearchReplace76.getElementById(
    "addExSearch"
  );

const workoutPickerSearch76 =
  dSearchReplace76.getElementById(
    "addExSel"
  );

workoutSearch76.value =
  "sprint intervals";

workoutSearch76.dispatchEvent(
  new SearchReplace76.window.Event(
    "input",
    {bubbles:true}
  )
);

const searchedBuiltIns76 =
  [
    ...workoutPickerSearch76
      .querySelectorAll(
        'option[data-exercise-source="builtin"]'
      )
  ];

check(
  "searchable workout exercise picker filters the canonical library live",
  workoutSearch76.placeholder
    ==="Search exercises"
  && searchedBuiltIns76.length===1
  && searchedBuiltIns76[0].value
    ==="Sprint Intervals"
  && searchedBuiltIns76[0]
       .dataset.exerciseShape==="rounds"
);

workoutSearch76.value = "";

workoutSearch76.dispatchEvent(
  new SearchReplace76.window.Event(
    "input",
    {bubbles:true}
  )
);

check(
  "clearing workout exercise search restores all canonical and custom options",
  workoutPickerSearch76
    .querySelectorAll(
      'option[data-exercise-source="builtin"]'
    ).length===203
  && [...workoutPickerSearch76.options]
       .some(
         option=>
           option.value==="__CUSTOM__"
       )
);

SearchReplace76.window.eval(`
  builderProg={
    name:"Builder Search",
    days:[{
      id:"",
      title:"Day 1",
      exercises:[]
    }]
  };

  renderBuilder();
`);

const builderSearch76 =
  dSearchReplace76.querySelector(
    ".bexercise-search"
  );

const builderPickerSearch76 =
  builderSearch76
    ? builderSearch76
        .closest(".bex")
        .querySelector("select")
    : null;

if (builderSearch76){
  builderSearch76.value =
    "farmer carry";

  builderSearch76.dispatchEvent(
    new SearchReplace76.window.Event(
      "input",
      {bubbles:true}
    )
  );
}

check(
  "Program Builder uses the same searchable canonical exercise picker",
  !!builderSearch76
  && !!builderPickerSearch76
  && [
       ...builderPickerSearch76
         .querySelectorAll(
           'option[data-exercise-source="builtin"]'
         )
     ].length===1
  && builderPickerSearch76.value
    ==="Farmer Carry"
);

function exerciseCardByName76(
  doc,
  name
){
  return [
    ...doc.querySelectorAll(
      "#exerciseInputs .exercise"
    )
  ].find(card=>{
    const heading =
      card.querySelector(".x-head b");

    return (
      heading
      && heading.textContent===name
    );
  }) || null;
}

let replacementCard76 =
  exerciseCardByName76(
    dSearchReplace76,
    "Bench Press"
  );

let replaceButton76 =
  replacementCard76
    ? [...replacementCard76
        .querySelectorAll("button")]
        .find(
          button=>
            button.textContent==="Replace"
        )
    : null;

if (replaceButton76){
  replaceButton76.click();
}

let replacementSearch76 =
  replacementCard76
    ? replacementCard76.querySelector(
        'input[data-replacement-search="Bench Press"]'
      )
    : null;

let replacementSelect76 =
  replacementCard76
    ? replacementCard76.querySelector(
        'select[data-replacement-select="Bench Press"]'
      )
    : null;

let replacementApply76 =
  replacementCard76
    ? replacementCard76.querySelector(
        'button[data-replacement-apply="Bench Press"]'
      )
    : null;

if (
  replacementSearch76
  && replacementSelect76
  && replacementApply76
){
  replacementSearch76.value="Run";

  replacementSearch76.dispatchEvent(
    new SearchReplace76.window.Event(
      "input",
      {bubbles:true}
    )
  );

  replacementSelect76.value="Run";
  replacementApply76.click();
}

check(
  "every planned exercise exposes searchable replacement and Run uses time-distance fields",
  !!replaceButton76
  && SearchReplace76.window.eval(`
       sessionSwaps["Bench Press"]==="Run"
       && sessionState["Run"].mode
          ==="timeDist"
     `)
  && !!dSearchReplace76.querySelector(
       'input[aria-label="Run minutes"]'
     )
  && !!dSearchReplace76.querySelector(
       'input[aria-label="Run seconds"]'
     )
);

replacementCard76 =
  exerciseCardByName76(
    dSearchReplace76,
    "Run"
  );

replaceButton76 =
  replacementCard76
    ? [...replacementCard76
        .querySelectorAll("button")]
        .find(
          button=>
            button.textContent==="Replace"
        )
    : null;

if (replaceButton76){
  replaceButton76.click();
}

replacementSearch76 =
  replacementCard76
    ? replacementCard76.querySelector(
        'input[data-replacement-search="Bench Press"]'
      )
    : null;

replacementSelect76 =
  replacementCard76
    ? replacementCard76.querySelector(
        'select[data-replacement-select="Bench Press"]'
      )
    : null;

replacementApply76 =
  replacementCard76
    ? replacementCard76.querySelector(
        'button[data-replacement-apply="Bench Press"]'
      )
    : null;

if (
  replacementSearch76
  && replacementSelect76
  && replacementApply76
){
  replacementSearch76.value =
    "Sprint Intervals";

  replacementSearch76.dispatchEvent(
    new SearchReplace76.window.Event(
      "input",
      {bubbles:true}
    )
  );

  replacementSelect76.value =
    "Sprint Intervals";

  replacementApply76.click();
}

check(
  "replacing again with Sprint Intervals uses the rounds editor",
  SearchReplace76.window.eval(`
    sessionSwaps["Bench Press"]
      ==="Sprint Intervals"
    && sessionState["Sprint Intervals"]
         .mode==="rounds"
  `)
  && !!exerciseCardByName76(
       dSearchReplace76,
       "Sprint Intervals"
     )
);

const DUPLICATE_REPLACE_PROGRAM_76 = {
  name:"Duplicate Replace Test",
  days:[{
    id:"D1",
    title:"Main",
    exercises:[
      {
        name:"Bench Press",
        scheme:"3×5"
      },
      {
        name:"Run",
        scheme:"20 min"
      }
    ]
  }]
};

const DuplicateReplace76 = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null,
      myExercises:{}
    }
  ),
  null,
  DUPLICATE_REPLACE_PROGRAM_76
);

const duplicateReplaceResult76 =
  JSON.parse(
    DuplicateReplace76.window.eval(`
      JSON.stringify(
        applySessionExerciseReplacement(
          "Bench Press",
          "Bench Press",
          "Run"
        )
      )
    `)
  );

check(
  "exercise replacement refuses duplicate exercises without changing the session",
  duplicateReplaceResult76.ok===false
  && /already in this session/i.test(
       duplicateReplaceResult76.reason
     )
  && DuplicateReplace76.window.eval(`
       Object.keys(sessionSwaps).length===0
       && !!sessionState["Bench Press"]
       && !!sessionState["Run"]
     `)
);

// ---------- v76 persistent custom exercises ----------
const T76Custom = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {workouts:[],activeWorkoutDraft:null,myExercises:{}}
  ),
  null,
  TEST_PROGRAM
);

const dT76Custom = T76Custom.window.document;

dT76Custom.getElementById("wDay").value="__FREE__";
dT76Custom.getElementById("wDay").dispatchEvent(
  new T76Custom.window.Event("change",{bubbles:true})
);

const customPicker76 =
  dT76Custom.getElementById("addExSel");

customPicker76.value="__CUSTOM__";
customPicker76.dispatchEvent(
  new T76Custom.window.Event("change",{bubbles:true})
);

const customName76 =
  dT76Custom.getElementById("addExCustom");

const customShape76 =
  dT76Custom.getElementById("addExCustomShape");

check(
  "v76 Type my own exposes an explicit six-shape tracking selector",
  !!customShape76
  && customShape76.options.length===6
  && !customShape76.classList.contains("hidden")
);

customName76.value="Garage Shuttle";
customShape76.value="rounds";

dT76Custom.getElementById("addExBtn").dispatchEvent(
  new T76Custom.window.Event("click",{bubbles:true})
);

const customEntries76 = JSON.parse(
  T76Custom.window.eval(`JSON.stringify(data.myExercises)`)
);

const garageEntry76 =
  Object.values(customEntries76)
    .find(x=>x.name==="Garage Shuttle");

check(
  "v76 Freestyle custom creation persists a valid u: exercise record",
  !!garageEntry76
  && /^u:/.test(garageEntry76.id)
  && garageEntry76.shape==="rounds"
  && Array.isArray(garageEntry76.tags)
  && Array.isArray(garageEntry76.aliases)
  && Array.isArray(garageEntry76.formerNames)
  && Array.isArray(garageEntry76.equipment)
  && garageEntry76.muscles
  && Array.isArray(garageEntry76.muscles.primary)
  && Array.isArray(garageEntry76.muscles.secondary)
  && garageEntry76.unilateral===false
  && garageEntry76.bodyweight===false
  && garageEntry76.deprecated===false
);

check(
  "v76 persisted custom exercise immediately uses its selected tracking mode",
  T76Custom.window.eval(`
    sessionState["Garage Shuttle"].mode==="rounds"
    && exerciseShapeForName("Garage Shuttle")==="rounds"
  `)
);

check(
  "v76 persisted custom exercise is immediately available in My Exercises picker",
  [...dT76Custom.getElementById("addExSel").options]
    .some(o=>
      o.value==="Garage Shuttle"
      && o.dataset.exerciseSource==="user"
      && o.dataset.exerciseShape==="rounds"
    )
);

const persistedCustomData76 =
  JSON.parse(T76Custom.window.localStorage.getItem("forge:data"));

check(
  "v76 custom exercise survives in persisted primary data",
  Object.values(persistedCustomData76.myExercises||{})
    .some(x=>
      x.name==="Garage Shuttle"
      && x.shape==="rounds"
    )
);

const T76CustomReload = boot(
  V3_CFG,
  persistedCustomData76,
  null,
  TEST_PROGRAM
);

check(
  "v76 persisted custom exercise survives reload with its tracking shape",
  T76CustomReload.window.eval(
    `exerciseShapeForName("Garage Shuttle")==="rounds"`
  )
  && [...T76CustomReload.window.document
      .getElementById("addExSel").options]
      .some(o=>
        o.value==="Garage Shuttle"
        && o.dataset.exerciseShape==="rounds"
      )
);

// Built-in name collision must not create a duplicate user record.
const collisionBefore76 =
  T76CustomReload.window.eval(
    "Object.keys(data.myExercises).length"
  );

const collisionResult76 =
  JSON.parse(
    T76CustomReload.window.eval(`
      JSON.stringify(createUserExercise("Bench Press","lift"))
    `)
  );

check(
  "v76 custom creation refuses built-in name collisions",
  collisionResult76.ok===false
  && /already exists/i.test(collisionResult76.reason)
  && T76CustomReload.window.eval(
    "Object.keys(data.myExercises).length"
  )===collisionBefore76
);

// Alias/former-name collision must also be rejected.
const aliasCollisionData76 = Object.assign(
  {},
  EMPTY_DATA,
  {
    workouts:[],
    activeWorkoutDraft:null,
    myExercises:clone76(V76_FX_DATA.myExercises||{})
  }
);

const T76AliasCollision = boot(
  V3_CFG,
  aliasCollisionData76,
  null,
  TEST_PROGRAM
);

const aliasCollisionCount76 =
  T76AliasCollision.window.eval(
    "Object.keys(data.myExercises).length"
  );

const aliasCollisionResult76 =
  JSON.parse(
    T76AliasCollision.window.eval(`
      JSON.stringify(
        createUserExercise("Tempo Step Intervals","rounds")
      )
    `)
  );

check(
  "v76 custom creation refuses saved-user former-name collisions",
  aliasCollisionResult76.ok===false
  && /already exists/i.test(aliasCollisionResult76.reason)
  && T76AliasCollision.window.eval(
    "Object.keys(data.myExercises).length"
  )===aliasCollisionCount76
);

// Failed persistence must undo the newly created entry.
const T76CustomFail = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {workouts:[],activeWorkoutDraft:null,myExercises:{}}
  ),
  null,
  TEST_PROGRAM
);

const failStore76 =
  T76CustomFail.window.localStorage;

const failDataBefore76 =
  failStore76.getItem("forge:data");

const failProto76 =
  Object.getPrototypeOf(failStore76);

const failSet76 =
  failProto76.setItem;

failProto76.setItem=function(k,v){
  if (k==="forge:data"){
    throw new Error("v76 custom exercise save denied");
  }
  return failSet76.call(this,k,v);
};

const failedCreate76 =
  JSON.parse(
    T76CustomFail.window.eval(`
      JSON.stringify(
        createUserExercise("Failure Shuttle","carry")
      )
    `)
  );

failProto76.setItem=failSet76;

check(
  "v76 failed custom exercise save rolls myExercises back in memory",
  failedCreate76.ok===false
  && T76CustomFail.window.eval(
    'exerciseModelEntryForName("Failure Shuttle")===null'
  )
  && T76CustomFail.window.eval(
    "Object.keys(data.myExercises).length===0"
  )
);

check(
  "v76 failed custom exercise save leaves persisted primary data unchanged",
  failStore76.getItem("forge:data")===failDataBefore76
);

// Manage My Exercises core: stable rename, archive/restore, reference
// protection, permanent deletion, and failed-save rollback.
const manageExercise76 = {
  id:"u:garage-shuttle",
  name:"Garage Shuttle",
  shape:"rounds",
  tags:[],
  aliases:[],
  formerNames:[],
  muscles:{primary:[],secondary:[]},
  equipment:[],
  unilateral:false,
  bodyweight:false,
  deprecated:false
};

const manageValue76 = {
  t:"rounds",
  rounds:4,
  workSecs:30,
  recSecs:20,
  note:""
};

const manageData76 = Object.assign(
  {},
  EMPTY_DATA,
  {
    workouts:[
      {
        date:"2026-07-20",
        day:"D1",
        title:"Garage history",
        sets:{"Garage Shuttle":clone76(manageValue76)},
        notes:""
      }
    ],
    activeWorkoutDraft:{
      date:"2026-07-29",
      day:"D1",
      title:"Garage draft",
      sets:{"Garage Shuttle":clone76(manageValue76)},
      notes:""
    },
    myExercises:{
      "u:garage-shuttle":clone76(manageExercise76)
    }
  }
);

const manageProgram76 = {
  name:"Garage Program",
  days:[
    {
      id:"D1",
      title:"Garage Day",
      exercises:[
        {name:"Garage Shuttle",scheme:"4 rounds"}
      ]
    }
  ]
};

const T76Manage = boot(
  V3_CFG,
  manageData76,
  null,
  manageProgram76
);

const dT76Manage = T76Manage.window.document;

const manageList76 = JSON.parse(
  T76Manage.window.eval(`
    JSON.stringify(listUserExercisesForManagement())
  `)
);

const manageRefsBefore76 =
  manageList76[0] &&
  manageList76[0].references;

check(
  "v76 My Exercises core lists custom exercises and detects program, history, and draft references",
  manageList76.length===1
  && manageList76[0].entry.id==="u:garage-shuttle"
  && manageRefsBefore76.protected===true
  && manageRefsBefore76.counts.program===1
  && manageRefsBefore76.counts.history===1
  && manageRefsBefore76.counts.draft===1
);

const manageRename76 = JSON.parse(
  T76Manage.window.eval(`
    JSON.stringify(
      renameUserExercise(
        "u:garage-shuttle",
        "Driveway Shuttle"
      )
    )
  `)
);

const renamedEntry76 = JSON.parse(
  T76Manage.window.eval(`
    JSON.stringify(data.myExercises["u:garage-shuttle"])
  `)
);

check(
  "v76 custom exercise rename preserves stable u: id, shape, and prior canonical name",
  manageRename76.ok===true
  && renamedEntry76.id==="u:garage-shuttle"
  && renamedEntry76.name==="Driveway Shuttle"
  && renamedEntry76.shape==="rounds"
  && renamedEntry76.formerNames.includes("garage shuttle")
);

check(
  "v76 rename leaves program, history, and draft values intact while both names keep resolving",
  T76Manage.window.eval(`
    program.days[0].exercises[0].name==="Garage Shuttle"
    && Object.prototype.hasOwnProperty.call(
      data.workouts[0].sets,
      "Garage Shuttle"
    )
    && Object.prototype.hasOwnProperty.call(
      data.activeWorkoutDraft.sets,
      "Garage Shuttle"
    )
    && exerciseShapeForName("Garage Shuttle")==="rounds"
    && exerciseShapeForName("Driveway Shuttle")==="rounds"
  `)
);

const renamedPersisted76 =
  JSON.parse(T76Manage.window.localStorage.getItem("forge:data"));

check(
  "v76 renamed exercise persists and immediately replaces its picker label",
  renamedPersisted76.myExercises["u:garage-shuttle"].name
    ==="Driveway Shuttle"
  && [...dT76Manage.getElementById("addExSel").options]
    .some(o=>
      o.value==="Driveway Shuttle"
      && o.dataset.exerciseId==="u:garage-shuttle"
      && o.dataset.exerciseShape==="rounds"
    )
  && ![...dT76Manage.getElementById("addExSel").options]
    .some(o=>o.value==="Garage Shuttle")
);

const manageCollision76 = JSON.parse(
  T76Manage.window.eval(`
    JSON.stringify(
      renameUserExercise(
        "u:garage-shuttle",
        "Bench Press"
      )
    )
  `)
);

check(
  "v76 custom exercise rename refuses canonical library collisions without mutation",
  manageCollision76.ok===false
  && /already exists/i.test(manageCollision76.reason)
  && T76Manage.window.eval(`
    data.myExercises["u:garage-shuttle"].name
      ==="Driveway Shuttle"
    && data.myExercises["u:garage-shuttle"].shape
      ==="rounds"
  `)
);

const manageArchive76 = JSON.parse(
  T76Manage.window.eval(`
    JSON.stringify(
      setUserExerciseArchived(
        "u:garage-shuttle",
        true
      )
    )
  `)
);

check(
  "v76 referenced custom exercise can be archived non-destructively and leaves both names resolvable",
  manageArchive76.ok===true
  && T76Manage.window.eval(`
    data.myExercises["u:garage-shuttle"].deprecated===true
    && exerciseShapeForName("Driveway Shuttle")==="rounds"
    && exerciseShapeForName("Garage Shuttle")==="rounds"
  `)
  && ![...dT76Manage.getElementById("addExSel").options]
    .some(o=>o.value==="Driveway Shuttle")
);

check(
  "v76 archived exercise state persists without changing id or tracking shape",
  JSON.parse(
    T76Manage.window.localStorage.getItem("forge:data")
  ).myExercises["u:garage-shuttle"].deprecated===true
  && JSON.parse(
    T76Manage.window.localStorage.getItem("forge:data")
  ).myExercises["u:garage-shuttle"].id
    ==="u:garage-shuttle"
  && JSON.parse(
    T76Manage.window.localStorage.getItem("forge:data")
  ).myExercises["u:garage-shuttle"].shape
    ==="rounds"
);

const manageRestore76 = JSON.parse(
  T76Manage.window.eval(`
    JSON.stringify(
      setUserExerciseArchived(
        "u:garage-shuttle",
        false
      )
    )
  `)
);

check(
  "v76 archived custom exercise restores to My Exercises with the same identity and shape",
  manageRestore76.ok===true
  && T76Manage.window.eval(`
    data.myExercises["u:garage-shuttle"].deprecated===false
    && data.myExercises["u:garage-shuttle"].id
      ==="u:garage-shuttle"
    && data.myExercises["u:garage-shuttle"].shape
      ==="rounds"
  `)
  && [...dT76Manage.getElementById("addExSel").options]
    .some(o=>
      o.value==="Driveway Shuttle"
      && o.dataset.exerciseId==="u:garage-shuttle"
    )
);

const protectedDataBefore76 =
  T76Manage.window.localStorage.getItem("forge:data");

const protectedDelete76 = JSON.parse(
  T76Manage.window.eval(`
    JSON.stringify(
      deleteUserExercisePermanently(
        "u:garage-shuttle"
      )
    )
  `)
);

check(
  "v76 permanent deletion refuses any exercise referenced by program, history, or active draft",
  protectedDelete76.ok===false
  && protectedDelete76.protected===true
  && protectedDelete76.references.counts.program===1
  && protectedDelete76.references.counts.history===1
  && protectedDelete76.references.counts.draft===1
  && T76Manage.window.localStorage.getItem("forge:data")
    ===protectedDataBefore76
  && T76Manage.window.eval(`
    !!data.myExercises["u:garage-shuttle"]
  `)
);

const unusedCreate76 = JSON.parse(
  T76Manage.window.eval(`
    JSON.stringify(
      createUserExercise(
        "Unused Carry",
        "carry"
      )
    )
  `)
);

const unusedDelete76 = unusedCreate76.ok
  ? JSON.parse(
      T76Manage.window.eval(`
        JSON.stringify(
          deleteUserExercisePermanently(
            ${JSON.stringify(
              unusedCreate76.entry &&
              unusedCreate76.entry.id
            )}
          )
        )
      `)
    )
  : {ok:false};

check(
  "v76 genuinely unused custom exercise can be permanently deleted",
  unusedCreate76.ok===true
  && unusedDelete76.ok===true
  && T76Manage.window.eval(`
    exerciseModelEntryForName("Unused Carry")===null
  `)
  && !Object.values(
    JSON.parse(
      T76Manage.window.localStorage.getItem("forge:data")
    ).myExercises||{}
  ).some(entry=>entry.name==="Unused Carry")
);

const manageFailEntry76 = {
  id:"u:rollback-carry",
  name:"Rollback Carry",
  shape:"carry",
  tags:[],
  aliases:[],
  formerNames:[],
  muscles:{primary:[],secondary:[]},
  equipment:[],
  unilateral:false,
  bodyweight:false,
  deprecated:false
};

const T76ManageFail = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null,
      myExercises:{
        "u:rollback-carry":clone76(manageFailEntry76)
      }
    }
  ),
  null,
  TEST_PROGRAM
);

const manageFailStore76 =
  T76ManageFail.window.localStorage;

const manageFailDataBefore76 =
  manageFailStore76.getItem("forge:data");

const manageFailProto76 =
  Object.getPrototypeOf(manageFailStore76);

const manageFailSet76 =
  manageFailProto76.setItem;

manageFailProto76.setItem=function(key,value){
  if (key==="forge:data"){
    throw new Error(
      "v76 exercise management save denied"
    );
  }

  return manageFailSet76.call(this,key,value);
};

const failedRenameManage76 = JSON.parse(
  T76ManageFail.window.eval(`
    JSON.stringify(
      renameUserExercise(
        "u:rollback-carry",
        "Changed Carry"
      )
    )
  `)
);

manageFailProto76.setItem=manageFailSet76;

check(
  "v76 failed management save rolls rename and formerNames back in memory",
  failedRenameManage76.ok===false
  && T76ManageFail.window.eval(`
    data.myExercises["u:rollback-carry"].name
      ==="Rollback Carry"
    && data.myExercises["u:rollback-carry"].shape
      ==="carry"
    && data.myExercises["u:rollback-carry"].formerNames.length
      ===0
  `)
);

check(
  "v76 failed management save leaves persisted primary data byte-identical",
  manageFailStore76.getItem("forge:data")
    ===manageFailDataBefore76
);

// Visible Manage My Exercises interface.
const manageUiButton76 =
  dT76Manage.getElementById("manageMyExercisesBtn");

check(
  "v76 Train places Manage My Exercises in its own titled card after Plate Math",
  !!manageUiButton76
  && !!manageUiButton76.closest("#myExercisesLaunchCard")
  && manageUiButton76.closest("#myExercisesLaunchCard").previousElementSibling.id==="trainingToolsCard"
  && manageUiButton76.closest("#myExercisesLaunchCard").firstElementChild===manageUiButton76.closest("#myExercisesLaunchCard").querySelector(".my-exercises-launch-title")
  && manageUiButton76.closest("#myExercisesLaunchCard").querySelector(".my-exercises-launch-title").textContent==="My Exercises"
  && manageUiButton76.closest("#myExercisesLaunchCard").querySelector(".my-exercises-launch-title").classList.contains("label")
  && manageUiButton76.classList.contains("small")
  && manageUiButton76.style.width==="100%"
);

const sessionTypeCard76 =
  dT76Manage.getElementById(
    "sessionTypeCard"
  );

const workoutCard76 =
  dT76Manage.getElementById(
    "trainingSessionCard"
  );

const sessionTypeControl76 =
  dT76Manage.getElementById("wDay");

const workoutDate76 =
  dT76Manage.getElementById("wDate");

check(
  "v76 static Session Type card preserves the existing workout controls",
  !!sessionTypeCard76
  && !!workoutCard76
  && sessionTypeCard76.nextElementSibling
    ===workoutCard76
  && sessionTypeCard76.firstElementChild.id
    ==="sessionTypeCardTitle"
  && sessionTypeCard76.firstElementChild.textContent
    ==="Session Type"
  && sessionTypeCard76.firstElementChild.getAttribute(
    "role"
  )==="heading"
  && sessionTypeControl76.parentElement
    ===sessionTypeCard76
  && sessionTypeControl76.getAttribute(
    "aria-labelledby"
  )==="sessionTypeCardTitle"
  && workoutCard76.firstElementChild.id
    ==="workoutCardTitle"
  && workoutCard76.firstElementChild.textContent
    ==="Workout"
  && workoutCard76.firstElementChild.getAttribute(
    "role"
  )==="heading"
  && workoutCard76.contains(workoutDate76)
  && !sessionTypeCard76.contains(workoutDate76)
  && Array.from(
    workoutCard76.querySelectorAll(".label")
  ).some(label=>
    label.textContent.trim()==="Date"
  )
  && /Add exercise to this session/.test(
    workoutCard76.textContent
  )
  && /Notes \(optional\)/.test(
    workoutCard76.textContent
  )
  && dT76Manage.querySelectorAll("#wDay").length===1
  && dT76Manage.querySelectorAll("#wDate").length===1
);

manageUiButton76.dispatchEvent(
  new T76Manage.window.Event(
    "click",
    {bubbles:true}
  )
);

const manageUiOverlay76 =
  dT76Manage.getElementById("myExercisesOverlay");

check(
  "v76 Manage My Exercises opens as an accessible modal with a close control",
  !!manageUiOverlay76
  && !manageUiOverlay76.classList.contains("hidden")
  && manageUiOverlay76.getAttribute("role")==="dialog"
  && manageUiOverlay76.getAttribute("aria-modal")==="true"
  && manageUiOverlay76.getAttribute("aria-hidden")==="false"
  && !!dT76Manage.getElementById("myExercisesCloseBtn")
);

let manageUiCard76 =
  manageUiOverlay76.querySelector(
    '[data-exercise-id="u:garage-shuttle"]'
  );

check(
  "v76 manager shows stable identity, locked tracking shape, former names, and references",
  !!manageUiCard76
  && /u:garage-shuttle/.test(manageUiCard76.textContent)
  && /Tracking:.*Rounds.*locked/i.test(
    manageUiCard76.textContent
  )
  && /garage shuttle/i.test(manageUiCard76.textContent)
  && /program reference/i.test(manageUiCard76.textContent)
  && /history reference/i.test(manageUiCard76.textContent)
  && /saved-draft reference/i.test(
    manageUiCard76.textContent
  )
  && manageUiCard76.querySelectorAll("select").length===0
);

let manageUiDelete76 =
  manageUiCard76.querySelector(
    '[data-action="delete"]'
  );

check(
  "v76 referenced exercise presents disabled protected deletion and an available archive action",
  manageUiDelete76.disabled===true
  && manageUiDelete76.textContent==="Protected"
  && !!manageUiCard76.querySelector(
    '[data-action="archive"]'
  )
);

let manageUiName76 =
  manageUiCard76.querySelector('input[type="text"]');

manageUiName76.value = "UI Shuttle";

manageUiCard76.querySelector(
  '[data-action="rename"]'
).dispatchEvent(
  new T76Manage.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v76 manager rename keeps the same id and shape while adding the previous name",
  T76Manage.window.eval(`
    data.myExercises["u:garage-shuttle"].id
      ==="u:garage-shuttle"
    && data.myExercises["u:garage-shuttle"].name
      ==="UI Shuttle"
    && data.myExercises["u:garage-shuttle"].shape
      ==="rounds"
    && data.myExercises["u:garage-shuttle"].formerNames
      .includes("driveway shuttle")
  `)
  && [...dT76Manage.getElementById("addExSel").options]
    .some(o=>
      o.value==="UI Shuttle"
      && o.dataset.exerciseId==="u:garage-shuttle"
      && o.dataset.exerciseShape==="rounds"
    )
);

T76Manage.window.confirm = ()=>true;

manageUiCard76 =
  manageUiOverlay76.querySelector(
    '[data-exercise-id="u:garage-shuttle"]'
  );

manageUiCard76.querySelector(
  '[data-action="archive"]'
).dispatchEvent(
  new T76Manage.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v76 manager archives referenced exercises non-destructively and removes them from pickers",
  T76Manage.window.eval(`
    data.myExercises["u:garage-shuttle"].deprecated===true
    && exerciseShapeForName("UI Shuttle")==="rounds"
    && exerciseShapeForName("Garage Shuttle")==="rounds"
  `)
  && ![...dT76Manage.getElementById("addExSel").options]
    .some(o=>o.value==="UI Shuttle")
);

manageUiCard76 =
  manageUiOverlay76.querySelector(
    '[data-exercise-id="u:garage-shuttle"]'
  );

check(
  "v76 archived exercises remain visible in management with Restore and Protected controls",
  manageUiCard76.classList.contains("archived")
  && /Archived/.test(manageUiCard76.textContent)
  && !!manageUiCard76.querySelector(
    '[data-action="restore"]'
  )
  && manageUiCard76.querySelector(
    '[data-action="delete"]'
  ).disabled===true
);

manageUiCard76.querySelector(
  '[data-action="restore"]'
).dispatchEvent(
  new T76Manage.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v76 manager restores an archived exercise with its original id and tracking shape",
  T76Manage.window.eval(`
    data.myExercises["u:garage-shuttle"].deprecated===false
    && data.myExercises["u:garage-shuttle"].id
      ==="u:garage-shuttle"
    && data.myExercises["u:garage-shuttle"].shape
      ==="rounds"
  `)
  && [...dT76Manage.getElementById("addExSel").options]
    .some(o=>
      o.value==="UI Shuttle"
      && o.dataset.exerciseId==="u:garage-shuttle"
    )
);

const manageUiUnused76 = JSON.parse(
  T76Manage.window.eval(`
    JSON.stringify(
      createUserExercise(
        "UI Unused Exercise",
        "text"
      )
    )
  `)
);

T76Manage.window.eval(
  "renderMyExercisesManager()"
);

const manageUiUnusedCard76 =
  manageUiUnused76.ok
    ? manageUiOverlay76.querySelector(
        '[data-exercise-id="'
        +manageUiUnused76.entry.id
        +'"]'
      )
    : null;

check(
  "v76 manager identifies genuinely unused exercises and enables permanent deletion",
  manageUiUnused76.ok===true
  && !!manageUiUnusedCard76
  && /Unused.*permanent deletion/i.test(
    manageUiUnusedCard76.textContent
  )
  && manageUiUnusedCard76.querySelector(
    '[data-action="delete"]'
  ).disabled===false
);

manageUiUnusedCard76.querySelector(
  '[data-action="delete"]'
).dispatchEvent(
  new T76Manage.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v76 manager permanently deletes only the confirmed unused exercise",
  T76Manage.window.eval(`
    !data.myExercises[
      ${JSON.stringify(
        manageUiUnused76.entry
        && manageUiUnused76.entry.id
      )}
    ]
    && !!data.myExercises["u:garage-shuttle"]
  `)
  && !manageUiOverlay76.querySelector(
    '[data-exercise-id="'
    +manageUiUnused76.entry.id
    +'"]'
  )
);

dT76Manage.getElementById(
  "myExercisesCloseBtn"
).dispatchEvent(
  new T76Manage.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v76 Manage My Exercises closes cleanly and returns focus to its trigger",
  manageUiOverlay76.classList.contains("hidden")
  && manageUiOverlay76.getAttribute("aria-hidden")==="true"
  && dT76Manage.activeElement===manageUiButton76
);

const manageUiStyles76 =
  dT76Manage.getElementById(
    "myExercisesManagerStyles"
  ).textContent;

check(
  "v76 manager retains mobile-safe scrolling, safe-area padding, and 44px action targets",
  /overflow:auto/.test(manageUiStyles76)
  && /safe-area-inset-top/.test(manageUiStyles76)
  && /safe-area-inset-bottom/.test(manageUiStyles76)
  && /min-height:44px/.test(manageUiStyles76)
  && /max-width:420px/.test(manageUiStyles76)
  && /\.myex-title\{[^}]*font-size:16px/.test(manageUiStyles76)
  && /\.myex-name\{[^}]*font-size:14px/.test(manageUiStyles76)
);

// Program Builder custom creation uses the same persistent shape contract.
const T76BuilderCustom = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {workouts:[],activeWorkoutDraft:null,myExercises:{}}
  ),
  null,
  TEST_PROGRAM
);

const dT76BuilderCustom =
  T76BuilderCustom.window.document;

T76BuilderCustom.window.eval("openBuilder(false)");

const builderSelectCustom76 =
  [...dT76BuilderCustom.querySelectorAll("select")]
    .find(s=>
      [...s.options].some(o=>o.value==="__CUSTOM__")
      && s!==dT76BuilderCustom.getElementById("addExSel")
    );

const builderRowCustom76 =
  builderSelectCustom76 &&
  builderSelectCustom76.closest(".bex");

const builderNameCustom76 =
  builderRowCustom76 &&
  builderRowCustom76.querySelector(".bname");

const builderShapeCustom76 =
  builderRowCustom76 &&
  builderRowCustom76.querySelector(".bshape");

const builderAddCustom76 =
  builderRowCustom76 &&
  [...builderRowCustom76.querySelectorAll("button")]
    .find(b=>/Add/.test(b.textContent));

check(
  "v76 Program Builder custom row includes the same six-shape selector",
  !!builderSelectCustom76
  && !!builderNameCustom76
  && !!builderShapeCustom76
  && builderShapeCustom76.options.length===6
);

builderSelectCustom76.value="__CUSTOM__";
builderSelectCustom76.dispatchEvent(
  new T76BuilderCustom.window.Event("change",{bubbles:true})
);

builderNameCustom76.value="Builder Carry Test";
builderShapeCustom76.value="carry";

builderAddCustom76.dispatchEvent(
  new T76BuilderCustom.window.Event("click",{bubbles:true})
);

check(
  "v76 Program Builder custom creation persists selected shape and program reference",
  T76BuilderCustom.window.eval(`
    exerciseShapeForName("Builder Carry Test")==="carry"
    && Object.values(data.myExercises)
         .some(x=>x.name==="Builder Carry Test" && x.shape==="carry")
    && builderProg.days.some(
         d=>d.exercises.some(e=>e.name==="Builder Carry Test")
       )
  `)
);



// ================= v76 history scalability + AI training range =================
const dayAgo76 = n=>{
  const d = new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate()-n);

  return d.getFullYear()
    +"-"+String(d.getMonth()+1).padStart(2,"0")
    +"-"+String(d.getDate()).padStart(2,"0");
};

const historyScaleWorkouts76 = Array.from({length:60},(_,i)=>({
  date:dayAgo76(i),
  day:"D1",
  title:"Scale Session "+(i+1),
  sets:{"Bench Press":[{w:100+i,r:5}]},
  notes:""
}));

const H76Scale = boot(
  V3_CFG,
  {
    food:{},
    workouts:historyScaleWorkouts76,
    weights:[],
    meta:{lastBackup:null,logsSince:0},
    myExercises:{}
  },
  null,
  TEST_PROGRAM
);

const dH76Scale = H76Scale.window.document;

check(
  "v76 History section is collapsed by default",
  dH76Scale.getElementById("workHistoryPanel")
  && dH76Scale.getElementById("workHistoryPanel").open===false
);

check(
  "v76 History initially renders only 25 workout rows without trimming stored history",
  dH76Scale.querySelectorAll("#workHistory .workSession").length===25
  && H76Scale.window.eval("data.workouts.length")===60
  && dH76Scale.getElementById("workHistoryCount").textContent==="60 sessions"
);

check(
  "v76 individual workout history rows start collapsed and show date/title",
  dH76Scale.querySelector("#workHistory .workSession")
  && dH76Scale.querySelector("#workHistory .workSession").open===false
  && /Scale Session/.test(
    dH76Scale.querySelector("#workHistory .workSession summary").textContent
  )
);

dH76Scale.querySelector("#workHistoryMore").click();

check(
  "v76 History Load older reveals the next 25 without changing stored history",
  dH76Scale.querySelectorAll("#workHistory .workSession").length===50
  && H76Scale.window.eval("data.workouts.length")===60
);

dH76Scale.querySelector("#workHistoryMore").click();

check(
  "v76 History can reveal all stored sessions and removes Load older when complete",
  dH76Scale.querySelectorAll("#workHistory .workSession").length===60
  && !dH76Scale.querySelector("#workHistoryMore")
  && H76Scale.window.eval("data.workouts.length")===60
);

const aiRangeWorkouts76 = [
  {
    date:dayAgo76(2),
    day:"D1",
    title:"Recent",
    sets:{"Bench Press":[{w:205,r:5}]},
    notes:""
  },
  {
    date:dayAgo76(45),
    day:"D1",
    title:"Mid",
    sets:{"Bench Press":[{w:195,r:5}]},
    notes:""
  },
  {
    date:dayAgo76(200),
    day:"__FREE__",
    title:"Old",
    sets:{
      "Bench Press":[{w:175,r:5}],
      "Future Shape":{
        t:"futureShape",
        payload:{keep:true}
      }
    },
    notes:"historic"
  }
];

const H76AI = boot(
  V3_CFG,
  {
    food:{},
    workouts:aiRangeWorkouts76,
    weights:[],
    meta:{lastBackup:null,logsSince:0},
    myExercises:{}
  },
  null,
  TEST_PROGRAM
);

const dH76AI = H76AI.window.document;
const aiRangeSel76 = dH76AI.getElementById("aiTrainingRange");

check(
  "v76 AI Coach exposes five training-history ranges with 4 weeks default",
  !!aiRangeSel76
  && [...aiRangeSel76.options].map(o=>o.value).join(",")==="4w,3m,6m,1y,all"
  && aiRangeSel76.value==="4w"
  && !!dH76AI.getElementById("aiTrainingJsonShareBtn")
  && !!dH76AI.getElementById("aiTrainingJsonCopyBtn")
  && !dH76AI.getElementById("aiTrainingJsonBtn")
);

check(
  "v76 AI training range filters report/export history without deleting stored workouts",
  H76AI.window.eval('aiTrainingWorkouts("4w").length')===1
  && H76AI.window.eval('aiTrainingWorkouts("3m").length')===2
  && H76AI.window.eval('aiTrainingWorkouts("6m").length')===2
  && H76AI.window.eval('aiTrainingWorkouts("1y").length')===3
  && H76AI.window.eval('aiTrainingWorkouts("all").length')===3
  && H76AI.window.eval("data.workouts.length")===3
);

const aiReport4w76 = H76AI.window.eval('aiReport("4w")');
const aiReportAll76 = H76AI.window.eval('aiReport("all")');

check(
  "v76 AI report follows selected range and all-history summary includes historic exercises",
  /## Training \(last 4 weeks\)/.test(aiReport4w76)
  && /1 session in selected range/.test(aiReport4w76)
  && /## Training \(all history\)/.test(aiReportAll76)
  && /3 sessions in selected range/.test(aiReportAll76)
  && /Future Shape/.test(aiReportAll76)
);

const aiExportAll76 = H76AI.window.eval('aiTrainingExport("all")');

check(
  "v76 All-history Training JSON exports every exact workout and preserves unknown future objects",
  aiExportAll76.workoutCount===3
  && aiExportAll76.workouts.length===3
  && JSON.stringify(
    aiExportAll76.workouts
      .find(w=>w.sets && w.sets["Future Shape"])
      .sets["Future Shape"]
  )==='{"t":"futureShape","payload":{"keep":true}}'
  && H76AI.window.eval("data.workouts.length")===3
);



// ================= v76 training JSON native share + exact copy =================
const trainingShareDataBefore76 =
  H76AI.window.eval(
    "JSON.stringify(data.workouts)"
  );

H76AI.window.eval(`
  window.__trainingShareCapture = {
    write:null,
    share:null,
    ack:null,
    notice:null
  };

  nativePlatformForTrainingJson = ()=>true;

  nativeJsonExportCapability = ()=>({
    available:true,
    shareAvailable:true
  });

  writeNativeJson = async (
    capability,
    filename,
    text
  )=>{
    window.__trainingShareCapture.write = {
      capability:capability,
      filename:filename,
      text:text
    };

    return {
      ok:true,
      uri:"file:///Documents/"+filename
    };
  };

  shareNativeJson = async (
    capability,
    nativeFile,
    title
  )=>{
    window.__trainingShareCapture.share = {
      capability:capability,
      nativeFile:nativeFile,
      title:title
    };

    return {
      activityType:
        "com.apple.DocumentManagerUICore.SaveToFiles"
    };
  };

  ackBtn = (
    id,
    text
  )=>{
    window.__trainingShareCapture.ack = {
      id:id,
      text:text
    };
  };

  flashSave = (
    message,
    isError
  )=>{
    window.__trainingShareCapture.notice = {
      message:message,
      isError:!!isError
    };
  };
`);

const nativeTrainingShareOk76 =
  await H76AI.window.eval(
    'shareTrainingJson("all")'
  );

const nativeTrainingShareCapture76 =
  H76AI.window.eval(
    "window.__trainingShareCapture"
  );

const nativeTrainingSharedPayload76 =
  JSON.parse(
    nativeTrainingShareCapture76.write.text
  );

check(
  "v76 native Training JSON writes verified exact All-history JSON before opening the share sheet",
  nativeTrainingShareOk76===true
  && /^blackpyre-training-all-.*\.json$/.test(
       nativeTrainingShareCapture76.write.filename
     )
  && nativeTrainingSharedPayload76.type
       ==="blackpyre-ai-training-export"
  && nativeTrainingSharedPayload76.range==="all"
  && nativeTrainingSharedPayload76.workoutCount===3
  && nativeTrainingSharedPayload76.workouts.length===3
  && JSON.stringify(
       nativeTrainingSharedPayload76.workouts
         .find(
           w=>w.sets
             && w.sets["Future Shape"]
         )
         .sets["Future Shape"]
     )==='{"t":"futureShape","payload":{"keep":true}}'
  && nativeTrainingShareCapture76.share.nativeFile.uri
       ==="file:///Documents/"
         +nativeTrainingShareCapture76.write.filename
  && nativeTrainingShareCapture76.share.title
       ==="BlackPyre training history"
  && nativeTrainingShareCapture76.ack.id
       ==="aiTrainingJsonShareBtn"
  && /Share complete/.test(
       nativeTrainingShareCapture76.ack.text
     )
  && H76AI.window.eval(
       "JSON.stringify(data.workouts)"
     )===trainingShareDataBefore76
);

H76AI.window.eval(`
  window.__trainingShareCapture.ack = null;
  window.__trainingShareCapture.notice = null;

  shareNativeJson = async ()=>{
    throw new Error("Share canceled");
  };
`);

const nativeTrainingShareCancelled76 =
  await H76AI.window.eval(
    'shareTrainingJson("all")'
  );

const nativeTrainingCancelCapture76 =
  H76AI.window.eval(
    "window.__trainingShareCapture"
  );

check(
  "v76 canceled Training JSON share reports cancellation without false completion or workout mutation",
  nativeTrainingShareCancelled76===false
  && nativeTrainingCancelCapture76.ack.id
       ==="aiTrainingJsonShareBtn"
  && /canceled/i.test(
       nativeTrainingCancelCapture76.ack.text
     )
  && nativeTrainingCancelCapture76.notice.isError===false
  && /no external destination/i.test(
       nativeTrainingCancelCapture76.notice.message
     )
  && H76AI.window.eval(
       "JSON.stringify(data.workouts)"
     )===trainingShareDataBefore76
);

H76AI.window.eval(`
  window.__copiedTrainingJson = null;
  window.__trainingShareCapture.ack = null;
  window.__trainingShareCapture.notice = null;

  copyExactTrainingJsonText = async text=>{
    window.__copiedTrainingJson = text;
    return true;
  };
`);

const copyTrainingJsonOk76 =
  await H76AI.window.eval(
    'copyTrainingJson("all")'
  );

const copiedTrainingJson76 =
  JSON.parse(
    H76AI.window.eval(
      "window.__copiedTrainingJson"
    )
  );

const copiedTrainingCapture76 =
  H76AI.window.eval(
    "window.__trainingShareCapture"
  );

check(
  "v76 Copy training JSON places exact selected-range JSON on the clipboard without mutation",
  copyTrainingJsonOk76===true
  && copiedTrainingJson76.type
       ==="blackpyre-ai-training-export"
  && copiedTrainingJson76.range==="all"
  && copiedTrainingJson76.workoutCount===3
  && copiedTrainingJson76.workouts.length===3
  && JSON.stringify(
       copiedTrainingJson76.workouts
         .find(
           w=>w.sets
             && w.sets["Future Shape"]
         )
         .sets["Future Shape"]
     )==='{"t":"futureShape","payload":{"keep":true}}'
  && copiedTrainingCapture76.ack.id
       ==="aiTrainingJsonCopyBtn"
  && /JSON copied/.test(
       copiedTrainingCapture76.ack.text
     )
  && /paste into any AI/i.test(
       copiedTrainingCapture76.notice.message
     )
  && H76AI.window.eval(
       "JSON.stringify(data.workouts)"
     )===trainingShareDataBefore76
);



// A successful restore must sever transient references to the old training
// screen. This permanently reproduces the physical-device defect where an
// old resumed draft remained marked as loaded, hid the restored draft card,
// left My Exercises stale, and erased the restored draft on a session switch.
const restoreResetOldProgram76 = {
  name:"Before Restore",
  days:[
    {
      id:"D1",
      title:"Old Day",
      exercises:[
        {
          name:"Bench Press",
          scheme:"3×5"
        }
      ]
    }
  ]
};

const restoreResetOldDraft76 = {
  date:"2026-07-28",
  day:"D1",
  title:"Old loaded draft",
  sets:{
    "Bench Press":[
      {
        w:135,
        r:5
      }
    ]
  },
  notes:"old live workout state",
  updatedAt:"2026-07-28T12:00:00.000Z"
};

const restoreResetInitialData76 = Object.assign(
  {},
  clone76(EMPTY_DATA),
  {
    workouts:[],
    myExercises:{},
    activeWorkoutDraft:clone76(
      restoreResetOldDraft76
    ),
    meta:{
      lastBackup:null,
      logsSince:0
    }
  }
);

const RestoreReset76 = boot(
  V3_CFG,
  restoreResetInitialData76,
  null,
  restoreResetOldProgram76
);

const dRestoreReset76 =
  RestoreReset76.window.document;

const oldDraftResumed76 =
  RestoreReset76.window.eval(
    "resumeWorkoutDraft()"
  );

check(
  "v76 restore regression begins with an old loaded workout draft",
  oldDraftResumed76===true
  && RestoreReset76.window.eval(
       "workoutDraftLoaded"
     )===true
  && RestoreReset76.window.eval(`
       sessionState["Bench Press"].status
         ==="saved"
       && sessionState["Bench Press"].saved[0].w
         ===135
     `)
);

const restoreResetResult76 =
  RestoreReset76.window.eval(
    `restoreBackupEnvelope(
      ${JSON.stringify(V76_FIXTURE.backup)}
    )`
  );

const restoreResetStoredImmediately76 =
  JSON.parse(
    RestoreReset76.window.localStorage.getItem(
      "forge:data"
    )
  );

const restoreResetPickerHasCustom76 =
  [
    ...dRestoreReset76
      .getElementById("addExSel")
      .options
  ].some(
    option =>
      option.value==="Tempo Step Pattern"
  );

check(
  "v76 successful restore clears stale loaded-session state",
  restoreResetResult76.ok===true
  && RestoreReset76.window.eval(
       "workoutDraftLoaded"
     )===false
  && RestoreReset76.window.eval(`
       !sessionState["Bench Press"]
       || sessionState["Bench Press"].status
         !=="saved"
       || sessionState["Bench Press"].saved==null
     `)
);

check(
  "v76 successful restore immediately exposes restored draft and custom exercise",
  same76(
       RestoreReset76.window.eval(
         "JSON.parse(JSON.stringify(data.activeWorkoutDraft))"
       ),
       V76_FX_DRAFT
     )
  && same76(
       restoreResetStoredImmediately76.activeWorkoutDraft,
       V76_FX_DRAFT
     )
  && !dRestoreReset76
       .getElementById("workoutDraftCard")
       .classList.contains("hidden")
  && restoreResetPickerHasCustom76
);

let restoreResetConfirmCalls76 = 0;

RestoreReset76.window.confirm = ()=>{
  restoreResetConfirmCalls76++;
  return true;
};

const restoreResetDaySelect76 =
  dRestoreReset76.getElementById("wDay");

restoreResetDaySelect76.value = "__FREE__";

restoreResetDaySelect76.dispatchEvent(
  new RestoreReset76.window.Event(
    "change",
    {
      bubbles:true
    }
  )
);

const restoreResetStoredAfterSwitch76 =
  JSON.parse(
    RestoreReset76.window.localStorage.getItem(
      "forge:data"
    )
  );

check(
  "v76 switching session type after restore cannot discard the restored draft",
  restoreResetConfirmCalls76===0
  && same76(
       RestoreReset76.window.eval(
         "JSON.parse(JSON.stringify(data.activeWorkoutDraft))"
       ),
       V76_FX_DRAFT
     )
  && same76(
       restoreResetStoredAfterSwitch76.activeWorkoutDraft,
       V76_FX_DRAFT
     )
);

const restoredDraftResumed76 =
  RestoreReset76.window.eval(
    "resumeWorkoutDraft()"
  );

check(
  "v76 restored draft remains resumable with exact typed values",
  restoredDraftResumed76===true
  && RestoreReset76.window.eval(
       "workoutDraftLoaded"
     )===true
  && same76(
       RestoreReset76.window.eval(
         'sessionState["Pull-Up"].saved'
       ),
       V76_FX_DRAFT.sets["Pull-Up"]
     )
  && same76(
       RestoreReset76.window.eval(
         'sessionState["Run"].saved'
       ),
       V76_FX_DRAFT.sets["Run"]
     )
  && same76(
       RestoreReset76.window.eval(
         'sessionState["Tempo Step Intervals"].saved'
       ),
       V76_FX_DRAFT.sets[
         "Tempo Step Intervals"
       ]
     )
  && RestoreReset76.window.eval(
       'sessionState["Tempo Step Intervals"].mode'
     )==="rounds"
);

// ================= post-v76: reviewed training-plan import and public I/O =================
const TRAINING_PLAN_REVIEW_FIXTURE =
  JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "fixtures",
        "training-plan-interchange-v1.json"
      ),
      "utf8"
    )
  );

const ReviewCancel = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dReviewCancel =
  ReviewCancel.window.document;

const reviewCancelOpen =
  ReviewCancel.window.eval(
    `openTrainingPlanReview(
      ${JSON.stringify(TRAINING_PLAN_REVIEW_FIXTURE)},
      {successMessage:"Program loaded ✓"}
    )`
  );

check(
  "training-plan review opens without changing the current program",
  reviewCancelOpen.ok===true
  && !dReviewCancel
       .getElementById("trainingPlanReviewOverlay")
       .classList.contains("hidden")
  && dReviewCancel.body.classList.contains("locked")
  && ReviewCancel.window.eval("program.name")
     ===TEST_PROGRAM.name
  && dReviewCancel
       .getElementById("trainingPlanReviewConfirmBtn")
       .disabled===false
  && /Prescription: 6 intervals · 20 sec each · 100 sec recovery/.test(
       dReviewCancel
         .getElementById("trainingPlanReviewList")
         .textContent
     )
);

dReviewCancel
  .getElementById("trainingPlanReviewCancelBtn")
  .dispatchEvent(
    new ReviewCancel.window.Event(
      "click",
      {bubbles:true}
    )
  );

await wait(10);

check(
  "canceling training-plan review leaves active data untouched",
  dReviewCancel
    .getElementById("trainingPlanReviewOverlay")
    .classList.contains("hidden")
  && !dReviewCancel.body.classList.contains("locked")
  && ReviewCancel.window.eval("program.name")
     ===TEST_PROGRAM.name
  && ReviewCancel.window.eval(
       "data.workouts.length"
     )===0
);

const ReviewCanonicalSprint = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dReviewCanonicalSprint =
  ReviewCanonicalSprint.window.document;

ReviewCanonicalSprint.window.eval(`
  openTrainingPlanReview({
    format:"blackpyre-training-plan",
    version:1,
    program:{
      name:"Canonical Sprint Timing",
      days:[{
        id:"D1",
        title:"Speed",
        exercises:[{
          name:"Sprinting",
          trackingShape:"lift",
          scheme:"6 × 20 sec",
          prescription:{
            sets:6,
            reps:1
          }
        }]
      }]
    }
  })
`);

const canonicalSprintReviewText =
  dReviewCanonicalSprint
    .getElementById(
      "trainingPlanReviewList"
    )
    .textContent;

check(
  "training-plan review automatically repairs Sprinting tracking metadata when 6 × 20 sec is clear",
  /Adjusted to Sprinting's time tracking: 6 intervals of 20 seconds\./
    .test(canonicalSprintReviewText)
  && !/Sprint Intervals/.test(
       canonicalSprintReviewText
     )
  && !dReviewCanonicalSprint
       .querySelector(
         '.training-plan-prescription-editor[data-review-key="0:0"]'
       )
  && dReviewCanonicalSprint
       .getElementById(
         "trainingPlanReviewConfirmBtn"
       )
       .disabled===false
  && ReviewCanonicalSprint.window.eval(`
       trainingPlanReviewState
         .prepared
         .canConfirm
         ===true
     `)
);

check(
  "Sprinting adjustment preserves canonical identity and 6 intervals of 20 seconds",
  ReviewCanonicalSprint.window.eval(`
    (()=>{
      const state =
        trainingPlanReviewState;

      const row =
        state.prepared.review[0];

      const exercise =
        state.prepared
          .candidate
          .days[0]
          .exercises[0];

      return (
        state.prepared.blockers===0
        && row.exerciseId==="bp:sprinting"
        && row.shape==="timeDist"
        && exercise.exerciseId
           ==="bp:sprinting"
        && exercise.name==="Sprinting"
        && exercise.prescription.intervals
           ===6
        && exercise.prescription.durationSeconds
           ===20
        && !Object.prototype.hasOwnProperty.call(
             exercise.prescription,
             "sets"
           )
        && !Object.prototype.hasOwnProperty.call(
             exercise.prescription,
             "reps"
           )
      );
    })()
  `)
);

const ReviewUnknown = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dReviewUnknown =
  ReviewUnknown.window.document;

ReviewUnknown.window.eval(`
  openTrainingPlanReview({
    name:"Manual Resolution",
    days:[{
      id:"D1",
      title:"Speed",
      exercises:[{
        name:"Sprintng",
        scheme:"6 × 20 sec"
      }]
    }]
  })
`);

const unknownSelect =
  dReviewUnknown.querySelector(
    '#trainingPlanReviewList select[data-review-key="0:0"]'
  );

check(
  "unknown imported exercise blocks confirmation and offers manual choices",
  !!unknownSelect
  && unknownSelect.value===""
  && [
       ...unknownSelect.options
     ].some(
       option=>option.value==="bp:sprinting"
     )
  && dReviewUnknown
       .getElementById("trainingPlanReviewConfirmBtn")
       .disabled===true
  && ReviewUnknown.window.eval(
       "trainingPlanReviewState.prepared.candidate"
     )===null
);

unknownSelect.value = "bp:sprinting";

unknownSelect.dispatchEvent(
  new ReviewUnknown.window.Event(
    "change",
    {bubbles:true}
  )
);

check(
  "manual mapping resolves unknown Sprinting without fuzzy auto-selection",
  dReviewUnknown
    .getElementById("trainingPlanReviewConfirmBtn")
    .disabled===false
  && ReviewUnknown.window.eval(
       "trainingPlanReviewState.prepared.canConfirm"
     )===true
  && ReviewUnknown.window.eval(`
       trainingPlanReviewState
         .prepared
         .candidate
         .days[0]
         .exercises[0]
         .exerciseId
         ==="bp:sprinting"
     `)
  && ReviewUnknown.window.eval(`
       trainingPlanReviewState
         .prepared
         .candidate
         .days[0]
         .exercises[0]
         .prescription
         .durationSeconds
         ===20
     `)
);

const ReviewConfirm = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dReviewConfirm =
  ReviewConfirm.window.document;

ReviewConfirm.window.eval(`
  window.__trainingPlanBrowserConfirmCalls=0;
  confirm=()=>{
    window.__trainingPlanBrowserConfirmCalls++;
    return false;
  };

  openTrainingPlanReview(
    ${JSON.stringify(TRAINING_PLAN_REVIEW_FIXTURE)},
    {successMessage:"Program loaded ✓"}
  );
`);

dReviewConfirm
  .getElementById("trainingPlanReviewConfirmBtn")
  .dispatchEvent(
    new ReviewConfirm.window.Event(
      "click",
      {bubbles:true}
    )
  );

await wait(10);

const confirmedStoredProgram =
  JSON.parse(
    ReviewConfirm.window.localStorage.getItem(
      "forge:program"
    )
  );

check(
  "review confirmation imports exactly once without a second browser confirm",
  ReviewConfirm.window.eval(
    "window.__trainingPlanBrowserConfirmCalls"
  )===0
  && ReviewConfirm.window.eval("program.name")
     ==="Interchange Shape Coverage"
  && confirmedStoredProgram.name
     ==="Interchange Shape Coverage"
  && confirmedStoredProgram.days[0]
       .exercises.some(
         exercise=>
           exercise.exerciseId==="bp:sprinting"
           && exercise.prescription
           && exercise.prescription.durationSeconds===20
       )
  && dReviewConfirm
       .getElementById("trainingPlanReviewOverlay")
       .classList.contains("hidden")
);


const CUSTOM_EXERCISE_REVIEW_FIXTURE = {
  name:"Custom Exercise Import",
  days:[{
    id:"D1",
    title:"Speed",
    exercises:[{
      name:"Progressive Accelerations",
      scheme:"3 × 10 sec"
    }]
  }]
};

function customReviewControls(doc){

  const toggle = doc.querySelector(
    'button[data-custom-toggle-key="0:0"]'
  );

  if (
    toggle
    && !doc.querySelector(
      'input[data-custom-review-key="0:0"]'
    )
  ){
    toggle.dispatchEvent(
      new doc.defaultView.Event(
        "click",
        {bubbles:true}
      )
    );
  }


  return {
    name:doc.querySelector(
      'input[data-custom-review-key="0:0"]'
    ),
    shape:doc.querySelector(
      'select[data-custom-shape-key="0:0"]'
    ),
    use:doc.querySelector(
      'button[data-custom-use-key="0:0"]'
    )
  };
}

const ReviewCustomCancel = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null,
      myExercises:{}
    }
  ),
  null,
  TEST_PROGRAM
);

const dReviewCustomCancel =
  ReviewCustomCancel.window.document;

const customCancelDataBefore =
  ReviewCustomCancel.window.localStorage
    .getItem("forge:data");

ReviewCustomCancel.window.eval(`
  openTrainingPlanReview(
    ${JSON.stringify(CUSTOM_EXERCISE_REVIEW_FIXTURE)}
  );
`);

const cancelCustomControls =
  customReviewControls(dReviewCustomCancel);

check(
  "unknown import offers pending custom-exercise controls",
  !!cancelCustomControls.name
  && cancelCustomControls.name.value
     ==="Progressive Accelerations"
  && !!cancelCustomControls.shape
  && cancelCustomControls.shape.value===""
  && !!cancelCustomControls.use
  && !!cancelCustomControls.name
       .getAttribute("aria-label")
  && !!cancelCustomControls.shape
       .getAttribute("aria-label")
  && dReviewCustomCancel
       .getElementById(
         "trainingPlanReviewConfirmBtn"
       )
       .disabled===true
);

cancelCustomControls.shape.value="rounds";

cancelCustomControls.use.dispatchEvent(
  new ReviewCustomCancel.window.Event(
    "click",
    {bubbles:true}
  )
);

const cancelPendingId =
  ReviewCustomCancel.window.eval(`
    Object.values(
      trainingPlanReviewState.customExercises
    )[0].id
  `);

check(
  "pending custom exercise resolves review without early persistence",
  /^u:progressive-accelerations/.test(
    cancelPendingId
  )
  && ReviewCustomCancel.window.eval(`
       trainingPlanReviewState
         .prepared
         .canConfirm===true
       && trainingPlanReviewState
            .prepared
            .candidate
            .days[0]
            .exercises[0]
            .exerciseId
          ===${JSON.stringify(cancelPendingId)}
       && trainingPlanReviewState
            .prepared
            .review[0]
            .shape==="rounds"
       && Object.values(data.myExercises||{})
            .every(
              entry=>
                entry.name!=="Progressive Accelerations"
            )
     `)
  && ReviewCustomCancel.window.localStorage
       .getItem("forge:data")
     ===customCancelDataBefore
);

dReviewCustomCancel
  .getElementById("trainingPlanReviewCancelBtn")
  .dispatchEvent(
    new ReviewCustomCancel.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "canceling review discards pending custom exercise",
  ReviewCustomCancel.window.eval(`
    trainingPlanReviewState===null
    && trainingPlanPendingExerciseEntries.length===0
    && Object.values(data.myExercises||{})
         .every(
           entry=>
             entry.name!=="Progressive Accelerations"
         )
  `)
  && ReviewCustomCancel.window.localStorage
       .getItem("forge:data")
     ===customCancelDataBefore
  && ReviewCustomCancel.window.eval("program.name")
     ===TEST_PROGRAM.name
);

const ReviewCustomConfirm = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null,
      myExercises:{}
    }
  ),
  null,
  TEST_PROGRAM
);

const dReviewCustomConfirm =
  ReviewCustomConfirm.window.document;

ReviewCustomConfirm.window.eval(`
  openTrainingPlanReview(
    ${JSON.stringify(CUSTOM_EXERCISE_REVIEW_FIXTURE)}
  );
`);

const confirmCustomControls =
  customReviewControls(dReviewCustomConfirm);

confirmCustomControls.shape.value="rounds";

confirmCustomControls.use.dispatchEvent(
  new ReviewCustomConfirm.window.Event(
    "click",
    {bubbles:true}
  )
);

const confirmedCustomId =
  ReviewCustomConfirm.window.eval(`
    Object.values(
      trainingPlanReviewState.customExercises
    )[0].id
  `);

dReviewCustomConfirm
  .getElementById("trainingPlanReviewConfirmBtn")
  .dispatchEvent(
    new ReviewCustomConfirm.window.Event(
      "click",
      {bubbles:true}
    )
  );

const confirmedCustomData =
  JSON.parse(
    ReviewCustomConfirm.window.localStorage
      .getItem("forge:data")
  );

const confirmedCustomProgram =
  JSON.parse(
    ReviewCustomConfirm.window.localStorage
      .getItem("forge:program")
  );

check(
  "confirming review saves custom exercise and program together",
  confirmedCustomData
    .myExercises[confirmedCustomId]
    .name==="Progressive Accelerations"
  && confirmedCustomData
       .myExercises[confirmedCustomId]
       .shape==="rounds"
  && confirmedCustomProgram.name
     ==="Custom Exercise Import"
  && confirmedCustomProgram
       .days[0]
       .exercises[0]
       .exerciseId===confirmedCustomId
  && confirmedCustomProgram
       .days[0]
       .exercises[0]
       .name==="Progressive Accelerations"
  && ReviewCustomConfirm.window.eval(`
       exerciseShapeForName(
         "Progressive Accelerations"
       )==="rounds"
       && trainingPlanPendingExerciseEntries.length===0
     `)
);

const ReviewCustomSwitch = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null,
      myExercises:{}
    }
  ),
  null,
  TEST_PROGRAM
);

const dReviewCustomSwitch =
  ReviewCustomSwitch.window.document;

ReviewCustomSwitch.window.eval(`
  openTrainingPlanReview(
    ${JSON.stringify(CUSTOM_EXERCISE_REVIEW_FIXTURE)}
  );
`);

const switchControls =
  customReviewControls(dReviewCustomSwitch);

switchControls.shape.value="rounds";

switchControls.use.dispatchEvent(
  new ReviewCustomSwitch.window.Event(
    "click",
    {bubbles:true}
  )
);

const switchSelect =
  dReviewCustomSwitch.querySelector(
    'select[data-review-key="0:0"]'
  );

const sprintIntervalsOption =
  [...switchSelect.options]
    .find(option=>
      option.textContent
        .startsWith("Sprint Intervals ·")
    );

switchSelect.value =
  sprintIntervalsOption
    ? sprintIntervalsOption.value
    : "";

switchSelect.dispatchEvent(
  new ReviewCustomSwitch.window.Event(
    "change",
    {bubbles:true}
  )
);

check(
  "choosing an existing exercise discards the unused pending custom exercise",
  !!sprintIntervalsOption
  && ReviewCustomSwitch.window.eval(`
       Object.keys(
         trainingPlanReviewState.customExercises
       ).length===0
       && trainingPlanPendingExerciseEntries.length===0
       && trainingPlanReviewState
            .prepared
            .candidate
            .days[0]
            .exercises[0]
            .exerciseId
          ==="bp:sprint-intervals"
     `)
);

const ReviewCustomDataFailure = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null,
      myExercises:{}
    }
  ),
  null,
  TEST_PROGRAM
);

const dReviewCustomDataFailure =
  ReviewCustomDataFailure.window.document;

ReviewCustomDataFailure.window.eval(`
  openTrainingPlanReview(
    ${JSON.stringify(CUSTOM_EXERCISE_REVIEW_FIXTURE)}
  );
`);

const dataFailureControls =
  customReviewControls(
    dReviewCustomDataFailure
  );

dataFailureControls.shape.value="rounds";

dataFailureControls.use.dispatchEvent(
  new ReviewCustomDataFailure.window.Event(
    "click",
    {bubbles:true}
  )
);

ReviewCustomDataFailure.window.eval(`
  save=()=>false;
`);

dReviewCustomDataFailure
  .getElementById("trainingPlanReviewConfirmBtn")
  .dispatchEvent(
    new ReviewCustomDataFailure.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "custom-exercise save failure leaves active program unchanged",
  ReviewCustomDataFailure.window.eval("program.name")
     ===TEST_PROGRAM.name
  && ReviewCustomDataFailure.window.eval(`
       Object.values(data.myExercises||{})
         .every(
           entry=>
             entry.name!=="Progressive Accelerations"
         )
     `)
  && !dReviewCustomDataFailure
       .getElementById(
         "trainingPlanReviewOverlay"
       )
       .classList.contains("hidden")
  && /custom exercises could not be saved/i.test(
       dReviewCustomDataFailure
         .getElementById(
           "trainingPlanReviewError"
         )
         .textContent
     )
);

const ReviewCustomProgramFailure = boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null,
      myExercises:{}
    }
  ),
  null,
  TEST_PROGRAM
);

const dReviewCustomProgramFailure =
  ReviewCustomProgramFailure.window.document;

ReviewCustomProgramFailure.window.eval(`
  openTrainingPlanReview(
    ${JSON.stringify(CUSTOM_EXERCISE_REVIEW_FIXTURE)}
  );
`);

const programFailureControls =
  customReviewControls(
    dReviewCustomProgramFailure
  );

programFailureControls.shape.value="rounds";

programFailureControls.use.dispatchEvent(
  new ReviewCustomProgramFailure.window.Event(
    "click",
    {bubbles:true}
  )
);

ReviewCustomProgramFailure.window.eval(`
  saveProgram=()=>false;
`);

dReviewCustomProgramFailure
  .getElementById("trainingPlanReviewConfirmBtn")
  .dispatchEvent(
    new ReviewCustomProgramFailure.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "program save failure rolls pending custom exercise back",
  ReviewCustomProgramFailure.window.eval("program.name")
     ===TEST_PROGRAM.name
  && ReviewCustomProgramFailure.window.eval(`
       Object.values(data.myExercises||{})
         .every(
           entry=>
             entry.name!=="Progressive Accelerations"
         )
     `)
  && !dReviewCustomProgramFailure
       .getElementById(
         "trainingPlanReviewOverlay"
       )
       .classList.contains("hidden")
  && /No custom exercises were kept/i.test(
       dReviewCustomProgramFailure
         .getElementById(
           "trainingPlanReviewError"
         )
         .textContent
     )
);

const ReviewSaveFailure = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dReviewSaveFailure =
  ReviewSaveFailure.window.document;

ReviewSaveFailure.window.eval(`
  saveProgram=()=>false;

  openTrainingPlanReview(
    ${JSON.stringify(TRAINING_PLAN_REVIEW_FIXTURE)}
  );
`);

dReviewSaveFailure
  .getElementById("trainingPlanReviewConfirmBtn")
  .dispatchEvent(
    new ReviewSaveFailure.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "training-plan save failure rolls back and keeps review open",
  ReviewSaveFailure.window.eval("program.name")
     ===TEST_PROGRAM.name
  && !dReviewSaveFailure
       .getElementById("trainingPlanReviewOverlay")
       .classList.contains("hidden")
  && /could not be saved/i.test(
       dReviewSaveFailure
         .getElementById("trainingPlanReviewError")
         .textContent
     )
);

const FileReview = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dFileReview =
  FileReview.window.document;

FileReview.window.FileReader = class {
  readAsText(file){
    this.result = file.contents;
    this.onload();
  }
};

Object.defineProperty(
  dFileReview.getElementById("importFile"),
  "files",
  {
    configurable:true,
    value:[{
      contents:
        JSON.stringify(
          TRAINING_PLAN_REVIEW_FIXTURE
        )
    }]
  }
);

dFileReview
  .getElementById("importFile")
  .dispatchEvent(
    new FileReview.window.Event(
      "change",
      {bubbles:true}
    )
  );

check(
  "program file load routes to review before replacement",
  !dFileReview
    .getElementById("trainingPlanReviewOverlay")
    .classList.contains("hidden")
  && FileReview.window.eval("program.name")
     ===TEST_PROGRAM.name
);

const PasteReview = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dPasteReview =
  PasteReview.window.document;

Object.defineProperty(
  PasteReview.window.navigator,
  "clipboard",
  {
    configurable:true,
    value:{
      readText:async()=>(
        "Here is the program:\n```json\n"
        +JSON.stringify(
          TRAINING_PLAN_REVIEW_FIXTURE
        )
        +"\n```"
      )
    }
  }
);

dPasteReview
  .getElementById("pasteProgBtn")
  .dispatchEvent(
    new PasteReview.window.Event(
      "click",
      {bubbles:true}
    )
  );

await wait(20);

check(
  "pasted AI program routes to review before replacement",
  !dPasteReview
    .getElementById("trainingPlanReviewOverlay")
    .classList.contains("hidden")
  && PasteReview.window.eval("program.name")
     ===TEST_PROGRAM.name
);

const ExportReview = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dExportReview =
  ExportReview.window.document;

ExportReview.window.eval(`
  program=
    prepareTrainingPlanImport(
      ${JSON.stringify(TRAINING_PLAN_REVIEW_FIXTURE)}
    ).candidate;

  window.__trainingPlanDownload=null;

  download=(name,content)=>{
    window.__trainingPlanDownload={
      name:name,
      content:content
    };
  };
`);

dExportReview
  .getElementById("exportBtn")
  .dispatchEvent(
    new ExportReview.window.Event(
      "click",
      {bubbles:true}
    )
  );

const exportedTrainingPlan =
  JSON.parse(
    ExportReview.window.eval(
      "window.__trainingPlanDownload.content"
    )
  );

check(
  "Save file exports the public versioned interchange instead of internal storage",
  exportedTrainingPlan.format
     ==="blackpyre-training-plan"
  && exportedTrainingPlan.version===1
  && exportedTrainingPlan.program.name
     ==="Interchange Shape Coverage"
  && /-training-plan\.json$/.test(
       ExportReview.window.eval(
         "window.__trainingPlanDownload.name"
       )
     )
);

const NativeSaveReview77 = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dNativeSaveReview77 =
  NativeSaveReview77.window.document;

NativeSaveReview77.window.eval(`
  program=
    prepareTrainingPlanImport(
      ${JSON.stringify(TRAINING_PLAN_REVIEW_FIXTURE)}
    ).candidate;

  window.__nativePlanSave77={
    writes:[],
    shares:[],
    browserDownload:false
  };

  nativePlatformForTrainingPlanSave=
    ()=>true;

  nativeJsonExportCapability=
    ()=>({
      available:true,
      shareAvailable:true
    });

  writeNativeJson=
    async (capability,name,text)=>{
      window.__nativePlanSave77.writes.push({
        name:name,
        text:text
      });

      return {
        ok:true,
        uri:"file:///Documents/"+name
      };
    };

  shareNativeJson=
    async (capability,file,title)=>{
      window.__nativePlanSave77.shares.push({
        file:file,
        title:title
      });

      return {};
    };

  download=()=>{
    window.__nativePlanSave77.browserDownload=true;
  };
`);

dNativeSaveReview77
  .getElementById("exportBtn")
  .dispatchEvent(
    new NativeSaveReview77.window.Event(
      "click",
      {bubbles:true}
    )
  );

await wait(30);

const nativePlanSave77 =
  NativeSaveReview77.window.eval(
    "window.__nativePlanSave77"
  );

const nativeSavedPlan77 =
  JSON.parse(
    nativePlanSave77.writes[0].text
  );

check(
  "Save file opens the native destination sheet with the public training-plan file",
  nativePlanSave77.writes.length===1
  && nativePlanSave77.shares.length===1
  && nativePlanSave77.browserDownload===false
  && nativeSavedPlan77.format
       ==="blackpyre-training-plan"
  && nativeSavedPlan77.version===1
  && /-training-plan\.json$/.test(
       nativePlanSave77.writes[0].name
     )
  && nativePlanSave77.shares[0].file.uri
       ===(
         "file:///Documents/"
         +nativePlanSave77.writes[0].name
       )
  && nativePlanSave77.shares[0].title
       ==="Save BlackPyre training plan"
  && /Choose Save to Files and select a folder/.test(
       dNativeSaveReview77
         .getElementById("saveState")
         .textContent
     )
  && /Save completed/.test(
       dNativeSaveReview77
         .getElementById("exportBtn")
         .textContent
     )
);

const NativeSaveCancel77 = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dNativeSaveCancel77 =
  NativeSaveCancel77.window.document;

NativeSaveCancel77.window.eval(`
  window.__nativePlanCancel77={
    writes:0,
    browserDownload:false
  };

  nativePlatformForTrainingPlanSave=
    ()=>true;

  nativeJsonExportCapability=
    ()=>({
      available:true,
      shareAvailable:true
    });

  writeNativeJson=
    async (capability,name,text)=>{
      window.__nativePlanCancel77.writes++;

      return {
        ok:true,
        uri:"file:///Documents/"+name
      };
    };

  shareNativeJson=
    async ()=>{
      const error =
        new Error("Share canceled");

      error.name="AbortError";
      throw error;
    };

  download=()=>{
    window.__nativePlanCancel77.browserDownload=true;
  };
`);

dNativeSaveCancel77
  .getElementById("exportBtn")
  .dispatchEvent(
    new NativeSaveCancel77.window.Event(
      "click",
      {bubbles:true}
    )
  );

await wait(30);

const nativePlanCancel77 =
  NativeSaveCancel77.window.eval(
    "window.__nativePlanCancel77"
  );

check(
  "Save file cancellation never reports a false completed save",
  nativePlanCancel77.writes===1
  && nativePlanCancel77.browserDownload===false
  && /Save canceled/.test(
       dNativeSaveCancel77
         .getElementById("exportBtn")
         .textContent
     )
  && !/Save completed/.test(
       dNativeSaveCancel77
         .getElementById("exportBtn")
         .textContent
     )
);

const ShareReview = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dShareReview =
  ShareReview.window.document;

ShareReview.window.eval(`
  program=
    prepareTrainingPlanImport(
      ${JSON.stringify(TRAINING_PLAN_REVIEW_FIXTURE)}
    ).candidate;

  window.__trainingPlanShareDownload=null;

  download=(name,content)=>{
    window.__trainingPlanShareDownload={
      name:name,
      content:content
    };
  };

  try {
    Object.defineProperty(
      navigator,
      "share",
      {
        configurable:true,
        value:undefined
      }
    );

    Object.defineProperty(
      navigator,
      "canShare",
      {
        configurable:true,
        value:undefined
      }
    );
  } catch(error){}
`);

dShareReview
  .getElementById("shareBtn")
  .dispatchEvent(
    new ShareReview.window.Event(
      "click",
      {bubbles:true}
    )
  );

await wait(20);

const sharedTrainingPlan =
  JSON.parse(
    ShareReview.window.eval(
      "window.__trainingPlanShareDownload.content"
    )
  );

check(
  "Share fallback uses the same public versioned interchange",
  sharedTrainingPlan.format
     ==="blackpyre-training-plan"
  && sharedTrainingPlan.version===1
  && sharedTrainingPlan.program.days.length===2
);

const AIReview = boot(
  Object.assign(
    {},
    V3_CFG,
    {
      anthropicKey:"sk-test",
      aiProvider:"anthropic"
    }
  ),
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dAIReview =
  AIReview.window.document;

const extractedPublicPlan =
  AIReview.window.eval(`
    extractAIPayloads(
      ${JSON.stringify(
        "```json\n"
        +JSON.stringify(
          TRAINING_PLAN_REVIEW_FIXTURE
        )
        +"\n```"
      )}
    ).program
  `);

check(
  "AI payload extraction recognizes the public training-plan wrapper",
  extractedPublicPlan.format
     ==="blackpyre-training-plan"
  && extractedPublicPlan.version===1
);

check(
  "Coach instructions teach the public format and forbid invented exercise IDs",
  AIReview.window.eval(`
    coachSystem().includes(
      '"format":"blackpyre-training-plan"'
    )
    && coachSystem().includes(
      "Do not invent exerciseId"
    )
    && coachSystem().includes(
      "unknown exercise names require review"
    )
  `)
);

AIReview.window.eval(`
  addCoachBubble(
    "ai",
    "I built a reviewed training plan.",
    {
      program:
        ${JSON.stringify(TRAINING_PLAN_REVIEW_FIXTURE)}
    }
  );
`);

const coachProgramButton =
  [
    ...dAIReview.querySelectorAll(
      "#coachMsgs button.act"
    )
  ].find(
    button=>
      /Review program/.test(button.textContent)
  );

check(
  "Coach program proposal exposes a review action",
  !!coachProgramButton
);

if (coachProgramButton){
  coachProgramButton.dispatchEvent(
    new AIReview.window.Event(
      "click",
      {bubbles:true}
    )
  );
}

check(
  "Coach program action opens review instead of replacing immediately",
  !!coachProgramButton
  && !dAIReview
       .getElementById("trainingPlanReviewOverlay")
       .classList.contains("hidden")
  && AIReview.window.eval("program.name")
     ===TEST_PROGRAM.name
);

const allReviewControls =
  [
    ...dAIReview
      .getElementById("trainingPlanReviewOverlay")
      .querySelectorAll(
        "input,select,textarea,button"
      )
  ];

check(
  "training-plan review controls all have accessible names",
  allReviewControls.length>=3
  && allReviewControls.every(control=>{
    if (
      control.getAttribute("aria-label")
      && control.getAttribute("aria-label").trim()
    ) return true;

    if (
      control.getAttribute("aria-labelledby")
      && control.getAttribute("aria-labelledby").trim()
    ) return true;

    return control.tagName==="BUTTON"
      && !!control.textContent.trim();
  })
);



// ================= v77: plain-language program creation and loading =================
const Guidance77 = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dGuidance77 =
  Guidance77.window.document;

check(
  "v77 each Program Manager guide appears directly beneath its matching button",
  dGuidance77
    .getElementById("createAIPlanBtn")
    .nextElementSibling
    .id==="aiPlanHelperCard"
  && dGuidance77
       .getElementById("aiPlanHelperCard")
       .nextElementSibling
       .id==="loadPlanHelpBtn"
  && dGuidance77
       .getElementById("loadPlanHelpBtn")
       .nextElementSibling
       .id==="loadPlanHelpCard"
);

check(
  "v77 Program Manager explains all three program-creation paths",
  /Build a program in BlackPyre/.test(
    dGuidance77
      .getElementById("programManagerIntro")
      .textContent
  )
  && /BlackPyre Coach/.test(
       dGuidance77
         .getElementById("programManagerIntro")
         .textContent
     )
  && /training plan file/.test(
       dGuidance77
         .getElementById("programManagerIntro")
         .textContent
     )
  && dGuidance77
       .getElementById("createAIPlanBtn")
       .textContent.trim()==="Create a plan with AI"
  && dGuidance77
       .getElementById("loadPlanHelpBtn")
       .textContent.trim()==="How to load a plan"
  && dGuidance77
       .getElementById("importBtn")
       .textContent.trim()==="Load program"
);

dGuidance77
  .getElementById("view-work")
  .classList.add("active");

dGuidance77
  .getElementById("restDock")
  .classList.remove("hidden");

dGuidance77.body.classList.add(
  "rest-dock-visible"
);

dGuidance77
  .getElementById("createAIPlanBtn")
  .dispatchEvent(
    new Guidance77.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "v77 AI-plan helper opens and collects the required plain-language information",
  !dGuidance77
    .getElementById("aiPlanHelperCard")
    .classList.contains("hidden")
  && [
       "aiPlanGoal",
       "aiPlanDays",
       "aiPlanEquipment",
       "aiPlanLength",
       "aiPlanExperience",
       "aiPlanLimits",
       "aiPlanPreferences"
     ].every(id=>!!dGuidance77.getElementById(id))
  && dGuidance77
       .getElementById("copyAIPlanInstructionsBtn")
       .textContent.trim()==="Copy instructions for AI"
);

check(
  "v77 primary footer supports keyboard viewport compensation",
  /\.tabbar\s*\{[^}]*transform:translateY\(var\(--keyboard-footer-offset, 0px\)\);/s.test(
    rawIndex
  )
);

Guidance77.window.eval(`
  aiPlanKeyboardViewportBaseline = 844;

  Object.defineProperty(
    window,
    "innerHeight",
    {
      configurable:true,
      value:500
    }
  );

  updateAIPlanKeyboardFooterOffset();
`);

check(
  "v77 AI helper keeps the primary footer at the physical screen bottom",
  dGuidance77.documentElement.style
    .getPropertyValue(
      "--keyboard-footer-offset"
    )==="344px"
);

check(
  "v77 AI-plan helper suppresses the rest timer while open",
  dGuidance77
    .getElementById("restDock")
    .classList.contains("hidden")
  && !dGuidance77.body.classList.contains(
       "rest-dock-visible"
     )
);

dGuidance77
  .getElementById("createAIPlanBtn")
  .dispatchEvent(
    new Guidance77.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "v77 closing the AI helper clears footer keyboard compensation",
  dGuidance77.documentElement.style
    .getPropertyValue(
      "--keyboard-footer-offset"
    )===""
);

check(
  "v77 closing the AI-plan helper restores the Train rest timer",
  dGuidance77
    .getElementById("aiPlanHelperCard")
    .classList.contains("hidden")
  && !dGuidance77
        .getElementById("restDock")
        .classList.contains("hidden")
  && dGuidance77.body.classList.contains(
       "rest-dock-visible"
     )
);

const guidanceTrainSource77 =
  require("fs").readFileSync(
    "scripts/03-train.js",
    "utf8"
  );

const guidanceCopyMessage77 =
  "Paste these instructions into an AI. "
  +"When it finishes, download the .json file, "
  +"return to BlackPyre, and choose Load program.";

check(
  "v77 AI-copy confirmation gives one accurate next step",
  dGuidance77
    .getElementById("aiPlanCopyStatus")
    .textContent.trim()===guidanceCopyMessage77
  && (
       guidanceTrainSource77.match(
         /Paste these instructions into an AI\./g
       ) || []
     ).length===2
  && (
       guidanceTrainSource77.match(
         /When it finishes, download the \.json file,/g
       ) || []
     ).length===2
  && (
       guidanceTrainSource77.match(
         /return to BlackPyre, and choose Load program\./g
       ) || []
     ).length===2
  && !/ChatGPT or another AI/.test(
       guidanceTrainSource77
     )
  && !/do not need to add anything else/.test(
       guidanceTrainSource77
     )
);

const guidancePrompt77 =
  Guidance77.window.eval(`
    blackpyreTrainingPlanAIPrompt({
      goal:"Get stronger",
      days:"4",
      equipment:"Barbell and dumbbells",
      length:"45 minutes",
      experience:"Intermediate",
      limits:"No overhead pressing",
      preferences:"Sprinting and rowing"
    })
  `);

check(
  "v77 copied AI prompt uses the real public format and version",
  guidancePrompt77.includes(
    '"format":"blackpyre-training-plan"'
  )
  && guidancePrompt77.includes('"version":1')
  && /Return valid JSON only/.test(guidancePrompt77)
  && /complete program wrapper/i.test(guidancePrompt77)
);

check(
  "v77 copied AI prompt forbids invented IDs and silent strength conversion",
  guidancePrompt77.includes(
    "Do not invent exerciseId values"
  )
  && guidancePrompt77.includes(
       "Do not treat every exercise as sets, reps, and weight"
     )
  && guidancePrompt77.includes(
       "Do not silently convert an unknown exercise into a strength exercise"
     )
  && guidancePrompt77.includes(
       "unknown exercise names require review"
     )
);

check(
  "v77 copied AI prompt preserves the user's program request",
  /Main goal: Get stronger/.test(guidancePrompt77)
  && /Days per week: 4/.test(guidancePrompt77)
  && /Equipment: Barbell and dumbbells/.test(
       guidancePrompt77
     )
  && /Workout length: 45 minutes/.test(
       guidancePrompt77
     )
  && /Experience: Intermediate/.test(
       guidancePrompt77
     )
  && /Injuries or limits: No overhead pressing/.test(
       guidancePrompt77
     )
  && /Preferred training style or activities: Sprinting and rowing/.test(
       guidancePrompt77
     )
);

check(
  "v77 external AI helper and BlackPyre Coach share the importer format contract",
  Guidance77.window.eval(`
    coachSystem().includes(
      blackpyreTrainingPlanFormatInstructions()
    )
  `)
);

const CoachNoKey77 = boot(
  Object.assign(
    {},
    V3_CFG,
    {
      aiProvider:"handoff",
      anthropicKey:"",
      openaiKey:""
    }
  ),
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dCoachNoKey77 =
  CoachNoKey77.window.document;

dCoachNoKey77
  .getElementById("coachPlanBtn")
  .click();

check(
  "v77 BlackPyre Coach opens a clear no-key path",
  !dCoachNoKey77
     .getElementById("coachOverlay")
     .classList.contains("hidden")
  && !dCoachNoKey77
        .getElementById("coachAccessNote")
        .classList.contains("hidden")
  && /needs an AI API key/.test(
       dCoachNoKey77
         .getElementById("coachAccessNote")
         .textContent
     )
  && /Settings → Food database & AI/.test(
       dCoachNoKey77
         .getElementById("coachAccessNote")
         .textContent
     )
  && /Create a plan with AI/.test(
       dCoachNoKey77
         .getElementById("coachAccessNote")
         .textContent
     )
  && dCoachNoKey77
       .getElementById("coachInput")
       .disabled
  && dCoachNoKey77
       .getElementById("coachSendBtn")
       .disabled
);

dCoachNoKey77
  .getElementById("coachCloseBtn")
  .click();

check(
  "v77 load guide uses the actual native navigation and confirmation flow",
  /Open Train/.test(
    dGuidance77
      .getElementById("loadPlanHelpCard")
      .textContent.replace(/\\s+/g," ")
  )
  && /Tap Manage/.test(
       dGuidance77
         .getElementById("loadPlanHelpCard")
         .textContent.replace(/\\s+/g," ")
     )
  && /Tap Load program/.test(
       dGuidance77
         .getElementById("loadPlanHelpCard")
         .textContent.replace(/\\s+/g," ")
     )
  && /Review the program/.test(
       dGuidance77
         .getElementById("loadPlanHelpCard")
         .textContent.replace(/\\s+/g," ")
     )
  && /Tap Confirm/.test(
       dGuidance77
         .getElementById("loadPlanHelpCard")
         .textContent.replace(/\\s+/g," ")
     )
  && /Completed workout history is not erased/.test(
       dGuidance77
         .getElementById("loadPlanHelpCard")
         .textContent
     )
);

const ReadyMessage77 = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

ReadyMessage77.window.eval(`
  openTrainingPlanReview(
    ${JSON.stringify(TRAINING_PLAN_REVIEW_FIXTURE)}
  )
`);

check(
  "v77 ready-to-review status uses plain language",
  /This training plan is ready to review/.test(
    ReadyMessage77.window.document
      .getElementById("trainingPlanReviewSummary")
      .textContent
  )
);

const MatchMessage77 = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

MatchMessage77.window.eval(`
  openTrainingPlanReview({
    name:"Needs Exercise Match",
    days:[{
      id:"D1",
      title:"Training",
      exercises:[{
        name:"Unknown Dragon Movement",
        scheme:"3 × 8"
      }]
    }]
  })
`);

check(
  "v77 exercise-match status uses plain language",
  /This file needs a few exercise matches before it can be loaded/.test(
    MatchMessage77.window.document
      .getElementById("trainingPlanReviewSummary")
      .textContent
  )
);

const RejectionMessage77 = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dRejection77 =
  RejectionMessage77.window.document;

RejectionMessage77.window.FileReader = class {
  readAsText(file){
    this.result = file.contents;
    this.onload();
  }
};

Object.defineProperty(
  dRejection77.getElementById("importFile"),
  "files",
  {
    configurable:true,
    value:[{
      contents:JSON.stringify({
        format:"not-blackpyre",
        version:1,
        program:{
          name:"Rejected",
          days:[]
        }
      })
    }]
  }
);

dRejection77
  .getElementById("importFile")
  .dispatchEvent(
    new RejectionMessage77.window.Event(
      "change",
      {bubbles:true}
    )
  );

check(
  "v77 rejected file shows a plain message and useful next step",
  dRejection77
    .getElementById("programErr")
    .textContent
    ===RejectionMessage77.window.eval(
      "blackpyreTrainingPlanRejectionMessage()"
    )
  && /Create a plan with AI/.test(
       dRejection77
         .getElementById("programErr")
         .textContent
     )
  && /export the plan from another copy of BlackPyre/.test(
       dRejection77
         .getElementById("programErr")
         .textContent
     )
);

// ================= post-v76: suppress timer during training-plan review =================
const ReviewTimerDock = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dReviewTimerDock =
  ReviewTimerDock.window.document;

ReviewTimerDock.window.eval(
  'activateView("work",null,false)'
);

dReviewTimerDock
  .getElementById("restStartBtn")
  .dispatchEvent(
    new ReviewTimerDock.window.Event(
      "click",
      {bubbles:true}
    )
  );

ReviewTimerDock.window.eval(`
  openTrainingPlanReview(
    ${JSON.stringify(TRAINING_PLAN_REVIEW_FIXTURE)}
  )
`);

check(
  "training-plan review hides the rest timer and removes its reserved space",
  dReviewTimerDock
    .getElementById("restDock")
    .classList.contains("hidden")
  && !dReviewTimerDock.body.classList.contains(
       "rest-dock-visible"
     )
  && !dReviewTimerDock.body.classList.contains(
       "rest-options-open"
     )
);

check(
  "hidden review timer continues running without being reset",
  ReviewTimerDock.window.eval(
    "restRunning===true && restPaused===false"
  )
  && JSON.parse(
       ReviewTimerDock.window.localStorage.getItem(
         "forge:rest-timer"
       )
     ).status==="running"
);

dReviewTimerDock
  .getElementById("trainingPlanReviewCancelBtn")
  .dispatchEvent(
    new ReviewTimerDock.window.Event(
      "click",
      {bubbles:true}
    )
  );

await wait(10);

check(
  "closing training-plan review restores the Train timer dock",
  !dReviewTimerDock
    .getElementById("restDock")
    .classList.contains("hidden")
  && dReviewTimerDock.body.classList.contains(
       "rest-dock-visible"
     )
  && !dReviewTimerDock.body.classList.contains(
       "rest-options-open"
     )
  && ReviewTimerDock.window.eval(
       "restRunning===true"
     )
);

ReviewTimerDock.window.eval("cancelRest()");


// ================= v77 minimal missing-duration repair =================

const ManualPlankRepair77 = boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  TEST_PROGRAM
);

const dManualPlankRepair77 =
  ManualPlankRepair77.window.document;

const manualPlankStorageBefore77 =
  ManualPlankRepair77.window.eval(`
    JSON.stringify(
      Object.keys(localStorage)
        .sort()
        .map(key=>[
          key,
          localStorage.getItem(key)
        ])
    )
  `);

const manualPlankExerciseId77 =
  ManualPlankRepair77.window.eval(`
    exerciseModelEntryForName("Plank").id
  `);

ManualPlankRepair77.window.eval(`
  openTrainingPlanReview({
    format:"blackpyre-training-plan",
    version:1,
    program:{
      name:"Manual Plank Repair",
      days:[{
        id:"D1",
        title:"Core",
        exercises:[{
          name:"Unsupported Core Hold 77",
          trackingShape:"lift",
          prescription:{
            sets:3,
            reps:1
          }
        }]
      }]
    }
  })
`);

const manualPlankSelect77 =
  dManualPlankRepair77.querySelector(
    'select[data-review-key="0:0"]'
  );

check(
  "v77 manual Plank test finds the canonical Plank selection",
  !!manualPlankExerciseId77
  && !!manualPlankSelect77
  && Array.from(
       manualPlankSelect77.options
     ).some(
       option=>
         option.value===manualPlankExerciseId77
     )
);

manualPlankSelect77.value =
  manualPlankExerciseId77;

manualPlankSelect77.dispatchEvent(
  new ManualPlankRepair77.window.Event(
    "change",
    {bubbles:true}
  )
);

const manualPlankEditor77 =
  dManualPlankRepair77.querySelector(
    '.training-plan-prescription-editor[data-review-key="0:0"]'
  );

const manualPlankFieldNames77 =
  manualPlankEditor77
    ? Array.from(
        manualPlankEditor77.querySelectorAll(
          "[data-prescription-field]"
        )
      )
        .map(
          element=>
            element.dataset.prescriptionField
        )
        .sort()
    : [];

check(
  "v77 manual Plank match asks only for sets and time per set",
  !!manualPlankEditor77
  && /How long is each plank\?/.test(
       manualPlankEditor77.textContent
     )
  && /The imported plan says 3 sets, but it does not include a duration\./
       .test(
         manualPlankEditor77.textContent
       )
  && JSON.stringify(
       manualPlankFieldNames77
     )===JSON.stringify([
       "durationMinutes",
       "durationSeconds",
       "intervals"
     ])
  && manualPlankEditor77
       .querySelector(
         '[data-prescription-field="intervals"]'
       )
       .value==="3"
  && !manualPlankEditor77
       .querySelector(
         '[data-prescription-field="distance"]'
       )
  && !manualPlankEditor77
       .querySelector(
         '[data-prescription-field="recoverySeconds"]'
       )
  && !manualPlankEditor77
       .querySelector(
         '[data-prescription-field="restSeconds"]'
       )
  && !manualPlankEditor77
       .querySelector(
         '[data-prescription-field="notes"]'
       )
  && !dManualPlankRepair77
       .querySelector(
         'select[data-review-key="0:0"]'
       )
  && dManualPlankRepair77
       .getElementById(
         "trainingPlanReviewConfirmBtn"
       )
       .disabled===true
);

manualPlankEditor77.querySelector(
  '[data-prescription-action="apply"]'
).click();

check(
  "v77 Plank repair stays blocked until time per set is entered",
  dManualPlankRepair77
    .getElementById(
      "trainingPlanReviewConfirmBtn"
    )
    .disabled===true
  && /Enter the time for each set\./.test(
       manualPlankEditor77
         .querySelector(
           ".training-plan-review-inline-error"
         )
         .textContent
     )
  && ManualPlankRepair77.window.eval(`
       !trainingPlanReviewState
          .prescriptionOverrides["0:0"]
     `)
);

const manualPlankSeconds77 =
  manualPlankEditor77.querySelector(
    '[data-prescription-field="durationSeconds"]'
  );

manualPlankSeconds77.value = "45";

manualPlankEditor77.querySelector(
  '[data-prescription-action="apply"]'
).click();

check(
  "v77 Plank duration repair preserves three sets, canonical identity, and only compatible fields",
  ManualPlankRepair77.window.eval(`
    (()=>{
      const state =
        trainingPlanReviewState;

      const exercise =
        state.prepared
          .candidate
          .days[0]
          .exercises[0];

      const prescription =
        exercise.prescription;

      const model =
        exerciseModelEntryForId(
          exercise.exerciseId
        );

      return (
        state.prepared.canConfirm
        && state.prepared.blockers===0
        && exercise.exerciseId
           ===${JSON.stringify(manualPlankExerciseId77)}
        && exercise.name==="Plank"
        && model
        && model.shape==="timeDist"
        && prescription.intervals===3
        && prescription.durationSeconds===45
        && !Object.prototype.hasOwnProperty.call(
             prescription,
             "sets"
           )
        && !Object.prototype.hasOwnProperty.call(
             prescription,
             "reps"
           )
        && Object.keys(
             state.prescriptionOverrides["0:0"]
           ).sort().join(",")
           ==="durationSeconds,intervals"
      );
    })()
  `)
  && dManualPlankRepair77
       .getElementById(
         "trainingPlanReviewConfirmBtn"
       )
       .disabled===false
  && !dManualPlankRepair77
       .querySelector(
         '.training-plan-prescription-editor[data-review-key="0:0"]'
       )
  && /Adjusted to Plank's time tracking: 3 sets of 45 seconds\./
       .test(
         dManualPlankRepair77
           .getElementById(
             "trainingPlanReviewList"
           )
           .textContent
       )
  && ManualPlankRepair77.window.eval(`
       JSON.stringify(
         Object.keys(localStorage)
           .sort()
           .map(key=>[
             key,
             localStorage.getItem(key)
           ])
       )
     `)===manualPlankStorageBefore77
);

dManualPlankRepair77
  .getElementById(
    "trainingPlanReviewCancelBtn"
  )
  .click();

check(
  "v77 canceling repaired Plank import preserves the current program and data",
  ManualPlankRepair77.window.eval(`
    trainingPlanReviewState===null
    && program.name
       ===${JSON.stringify(TEST_PROGRAM.name)}
  `)
  && ManualPlankRepair77.window.eval(`
       JSON.stringify(
         Object.keys(localStorage)
           .sort()
           .map(key=>[
             key,
             localStorage.getItem(key)
           ])
       )
     `)===manualPlankStorageBefore77
  && dManualPlankRepair77
       .getElementById(
         "trainingPlanReviewOverlay"
       )
       .classList.contains("hidden")
);



// ================= v77 alias and compact review UX =================

const AliasCompactReview77 = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dAliasCompactReview77 =
  AliasCompactReview77.window.document;

AliasCompactReview77.window.eval(`
  openTrainingPlanReview({
    name:"Alias Review",
    days:[{
      id:"D1",
      title:"Upper Body",
      exercises:[
        {
          name:"Barbell Bench Press",
          scheme:"5 × 5"
        },
        {
          name:"Seated Dumbbell Shoulder Press",
          scheme:"3 × 10"
        },
        {
          name:"Cable Triceps Pressdown",
          scheme:"3 × 12"
        },
        {
          name:"Weighted Pull-Up",
          scheme:"4 × 6"
        },
        {
          name:"EZ Bar Curl",
          scheme:"3 × 12"
        },
        {
          name:"Chest Supported Row",
          scheme:"3 × 12"
        }
      ]
    }]
  })
`);

const aliasCompactDetails77 =
  dAliasCompactReview77.querySelectorAll(
    ".training-plan-custom-exercise-details"
  );

const aliasCompactSelects77 =
  dAliasCompactReview77.querySelectorAll(
    'select[data-review-key]'
  );

check(
  "v77 review safely auto-matches five common names and leaves only the ambiguous row unresolved",
  (()=>{
    const reviewData77 =
      JSON.parse(JSON.stringify(EMPTY_DATA));

    reviewData77.myExercises = {};
    reviewData77.activeWorkoutDraft = null;

    const reviewApp77 = boot(
      EXISTING_CFG,
      reviewData77,
      null,
      TEST_PROGRAM
    );

    const reviewPlan77 = {
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Resolver review regression",
        days:[{
          id:"D1",
          title:"Review",
          exercises:[
            {
              name:"Barbell Bench Press",
              prescription:{sets:5,reps:5}
            },
            {
              name:"Seated Dumbbell Shoulder Press",
              prescription:{sets:3,reps:10}
            },
            {
              name:"Cable Triceps Pressdown",
              prescription:{sets:3,reps:12}
            },
            {
              name:"Weighted Pull-Up",
              prescription:{sets:4,reps:6}
            },
            {
              name:"EZ Bar Curl",
              prescription:{sets:3,reps:12}
            },
            {
              name:"Chest Supported Row",
              prescription:{sets:3,reps:10}
            }
          ]
        }]
      }
    };

    const rows = JSON.parse(
      reviewApp77.window.eval(`
        JSON.stringify(
          prepareTrainingPlanImport(
            ${JSON.stringify(reviewPlan77)}
          ).review.map(row=>({
            importedName:row.importedName,
            exerciseId:row.exerciseId,
            suggestions:row.suggestions
          }))
        )
      `)
    );

    return (
      rows.length===6
      && rows
           .slice(0,5)
           .map(row=>row.exerciseId)
           .join("|")
         ===[
           "bp:bench-press",
           "bp:dumbbell-shoulder-press",
           "bp:triceps-pushdown",
           "bp:pull-up",
           "bp:biceps-curl"
         ].join("|")
      && rows[5].exerciseId===null
      && rows[5].suggestions.length>0
      && rows[5].suggestions[0].id
         ==="bp:chest-supported-dumbbell-row"
    );
  })()
);

const CompleteTimedSummary77 = boot(
  V3_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);

const dCompleteTimedSummary77 =
  CompleteTimedSummary77.window.document;

CompleteTimedSummary77.window.eval(`
  openTrainingPlanReview({
    format:"blackpyre-training-plan",
    version:1,
    program:{
      name:"Complete Timed Summary",
      days:[{
        id:"D1",
        title:"Conditioning",
        exercises:[{
          name:"Sprinting",
          scheme:"8 intervals",
          trackingShape:"timeDist",
          prescription:{
            intervals:8,
            durationSeconds:15,
            recoverySeconds:75
          }
        }]
      }]
    }
  })
`);

const completeTimedSummaryText77 =
  dCompleteTimedSummary77
    .getElementById(
      "trainingPlanReviewList"
    )
    .textContent;

check(
  "v77 timed review summary shows intervals, duration, and recovery",
  /Prescription: 8 intervals · 15 sec each · 75 sec recovery/
    .test(
      completeTimedSummaryText77
    )
  && /Matched to Sprinting\./.test(
       completeTimedSummaryText77
     )
  && CompleteTimedSummary77.window.eval(`
       (()=>{
         const prepared =
           trainingPlanReviewState.prepared;

         const exercise =
           prepared.candidate
             .days[0]
             .exercises[0];

         return (
           prepared.canConfirm
           && prepared.blockers===0
           && exercise.exerciseId
              ==="bp:sprinting"
           && exercise.prescription.intervals
              ===8
           && exercise.prescription.durationSeconds
              ===15
           && exercise.prescription.recoverySeconds
              ===75
         );
       })()
     `)
  && dCompleteTimedSummary77
       .getElementById(
         "trainingPlanReviewConfirmBtn"
       )
       .disabled===false
);


// BLACKPYRE_V77_SYSTEMIC_RESOLVER_REPAIR — review UX and full flow
const systemicResolverData77 =
  JSON.parse(JSON.stringify(EMPTY_DATA));
systemicResolverData77.myExercises = {};
systemicResolverData77.activeWorkoutDraft = null;

const SystemicResolverReview77 = boot(
  EXISTING_CFG,
  systemicResolverData77,
  null,
  TEST_PROGRAM
);

const dSystemicResolverReview77 =
  SystemicResolverReview77.window.document;

const systemicResolverProgramBefore77 =
  SystemicResolverReview77.window.eval(
    "JSON.stringify(program)"
  );

const systemicResolverDataBefore77 =
  SystemicResolverReview77.window.eval(
    "JSON.stringify(data)"
  );

const SYSTEMIC_RESOLVER_REVIEW_PLAN_77 = {
  format:"blackpyre-training-plan",
  version:1,
  program:{
    name:"Systemic Resolver Review",
    days:[{
      id:"D1",
      title:"Review",
      exercises:[
        {
          name:"Barbell Bench Press",
          prescription:{sets:5,reps:5}
        },
        {
          name:"Seated Dumbbell Shoulder Press",
          prescription:{sets:3,reps:10}
        },
        {
          name:"Cable Triceps Pressdown",
          prescription:{sets:3,reps:12}
        },
        {
          name:"Weighted Pull-Up",
          prescription:{sets:4,reps:6}
        },
        {
          name:"EZ Bar Curl",
          prescription:{sets:3,reps:12}
        },
        {
          name:"Chest Supported Row",
          prescription:{sets:3,reps:10}
        },
        {
          exerciseId:"bp:sprinting",
          name:"Sprinting",
          trackingShape:"timeDist",
          scheme:"8 intervals",
          prescription:{
            intervals:8,
            durationSeconds:15,
            recoverySeconds:75
          }
        }
      ]
    }]
  }
};

SystemicResolverReview77.window.eval(`
  openTrainingPlanReview(
    ${JSON.stringify(SYSTEMIC_RESOLVER_REVIEW_PLAN_77)}
  )
`);

const systemicResolverRows77 = JSON.parse(
  SystemicResolverReview77.window.eval(`
    JSON.stringify(
      trainingPlanReviewState.prepared.review.map(row=>({
        importedName:row.importedName,
        exerciseId:row.exerciseId,
        shape:row.shape,
        suggestions:row.suggestions
      }))
    )
  `)
);

check(
  "v77 systemic resolver handles normal AI-generated naming variations",
  systemicResolverRows77
    .slice(0,5)
    .map(row=>row.exerciseId)
    .join("|")
  ===[
    "bp:bench-press",
    "bp:dumbbell-shoulder-press",
    "bp:triceps-pushdown",
    "bp:pull-up",
    "bp:biceps-curl"
  ].join("|")
);

check(
  "v77 ambiguous equipment reduction remains blocked with ranked choices",
  systemicResolverRows77[5].exerciseId===null
  && systemicResolverRows77[5].suggestions[0].id
     ==="bp:chest-supported-dumbbell-row"
  && dSystemicResolverReview77
       .getElementById("trainingPlanReviewConfirmBtn")
       .disabled===true
);

const systemicCustomToggle77 =
  dSystemicResolverReview77.querySelector(
    'button[data-custom-toggle-key="0:5"]'
  );

check(
  "v77 unresolved exercise keeps custom creation collapsed by default",
  !!systemicCustomToggle77
  && systemicCustomToggle77.textContent
     ==="Create a custom exercise instead"
  && systemicCustomToggle77.getAttribute(
       "aria-expanded"
     )==="false"
  && !dSystemicResolverReview77.querySelector(
       '.training-plan-custom-exercise-editor'
     )
);

systemicCustomToggle77.dispatchEvent(
  new SystemicResolverReview77.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v77 custom exercise form expands only after the small control is used",
  !!dSystemicResolverReview77.querySelector(
    '.training-plan-custom-exercise-editor'
  )
  && !!dSystemicResolverReview77.querySelector(
    'input[data-custom-review-key="0:5"]'
  )
);

const systemicResolverReviewText77 =
  dSystemicResolverReview77
    .getElementById("trainingPlanReviewList")
    .textContent;

check(
  "v77 review prefers the complete structured timed prescription",
  /Prescription: 8 intervals · 15 sec each · 75 sec recovery/
    .test(systemicResolverReviewText77)
  && !/Prescription: 8 intervals(?:\s|$)/
       .test(
         systemicResolverReviewText77.replace(
           "Prescription: 8 intervals · 15 sec each · 75 sec recovery",
           ""
         )
       )
);

check(
  "v77 unresolved review uses common language instead of internal terms",
  /Choose the matching BlackPyre exercise\./
    .test(systemicResolverReviewText77)
  && /Needs attention:/.test(
       systemicResolverReviewText77
     )
  && !/No canonical BlackPyre exercise is selected/
       .test(systemicResolverReviewText77)
  && !/Blocking:/.test(systemicResolverReviewText77)
);

dSystemicResolverReview77
  .getElementById("trainingPlanReviewCancelBtn")
  .dispatchEvent(
    new SystemicResolverReview77.window.Event(
      "click",
      {bubbles:true}
    )
  );

await wait(10);

check(
  "v77 cancel after systemic review preserves the current program and data",
  SystemicResolverReview77.window.eval(
    "JSON.stringify(program)"
  )===systemicResolverProgramBefore77
  && SystemicResolverReview77.window.eval(
       "JSON.stringify(data)"
     )===systemicResolverDataBefore77
  && SystemicResolverReview77.window.eval(
       "trainingPlanReviewState===null"
     )===true
);


// ================= v90 flexible prescribed-set outcomes =================

const FLEXIBLE_SET_PROGRAM_90={
  name:"Flexible Set Test",
  days:[{
    id:"D1",
    title:"Strength",
    exercises:[{
      name:"Bench Press",
      scheme:"4×8"
    }]
  }]
};

const FlexSets90=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  FLEXIBLE_SET_PROGRAM_90
);

const dFlexSets90=FlexSets90.window.document;

FlexSets90.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
`);

check(
  "v90-10 programmed strength rows expose compact outcomes bulk controls and Add set",
  FlexSets90.window.eval(`
    sessionState["Bench Press"].rows.length===4
    && sessionState["Bench Press"].rows.every(
         row=>row.prescribed===true
       )
  `)
  && dFlexSets90.querySelectorAll(
       '[data-exercise="Bench Press"][data-set-action="done"]'
     ).length===0
  && dFlexSets90.querySelectorAll(
       '[data-exercise="Bench Press"][data-set-outcome="true"]'
     ).length===4
  && !!dFlexSets90.querySelector(
       '[data-exercise="Bench Press"][data-set-action="skip-remaining"]'
     )
  && !!dFlexSets90.querySelector(
       '[data-exercise="Bench Press"][data-set-action="remove-remaining"]'
     )
  && !!dFlexSets90.querySelector(
       '[data-exercise="Bench Press"][data-set-action="add-set"]'
     )
);

FlexSets90.window.eval(`
  sessionState["Bench Press"]
    .rows
    .slice(0,3)
    .forEach(row=>{
      row.w=185;
      row.r=8;
      row.touched=true;
    });

  sessionState["Bench Press"].rows[3].w=185;
  renderSessionInputs();
`);

const zeroReps90=
  [...dFlexSets90.querySelectorAll(
    '[data-exercise="Bench Press"][data-field="reps"]'
  )].find(
    field=>field.dataset.row==="3"
  );

zeroReps90.value="0";

zeroReps90.dispatchEvent(
  new FlexSets90.window.Event("input",{bubbles:true})
);

check(
  "v90-12 entering zero reps does not create Missed",
  FlexSets90.window.eval(`
    sessionState["Bench Press"].rows[3].status!=="missed"
    && sessionState["Bench Press"].rows[3].r===0
  `)
);

const reason90=
  dFlexSets90.querySelector(
    '[data-exercise="Bench Press"][data-row="3"][data-set-reason="true"]'
  );

reason90.value="fatigue";

reason90.dispatchEvent(
  new FlexSets90.window.Event("change",{bubbles:true})
);

const flexSave90=
  FlexSets90.window.eval(
    'saveExercise("Bench Press")'
  );

check(
  "v90-12 zero reps require actual reps or Remove",
  flexSave90.ok===false
  && /reps you actually completed/i.test(
       dFlexSets90
         .getElementById("workoutErr")
         .textContent
     )
  && /Remove/i.test(
       dFlexSets90
         .getElementById("workoutErr")
         .textContent
     )
  && FlexSets90.window.eval(`
       sessionState["Bench Press"]
         .rows[3]
         .status!=="missed"
     `)
);

check(
  "v90-12 legacy Missed history remains readable by History and Coach",
  /Set 1: 185×0 · Missed · Fatigue/.test(
    FlexSets90.window.eval(`
      formatSets([
        {
          w:185,
          r:0,
          status:"missed",
          reason:"fatigue"
        }
      ])
    `)
  )
  && /Missed/.test(
       FlexSets90.window.eval(`
         aiSafeWorkoutValue([
           {
             w:185,
             r:0,
             status:"missed",
             reason:"fatigue"
           }
         ])
       `)
     )
);

check(
  "v90-12 zero numeric entry has no visible Missed or Failed label",
  ![
    ...dFlexSets90.querySelectorAll(
      "#exerciseInputs .srow .sx"
    )
  ].some(
    element=>
      /Missed|Failed/i.test(
        element.textContent || ""
      )
  )
);

check(
  "v90 missed programmed work blocks progression and status does not carry forward",
  FlexSets90.window.eval(`
    (()=>{
      cfg.autoProgressionOn=true;

      const next=
        prefillRows(
          {
            name:"Bench Press",
            scheme:"4×8"
          },
          [
            {w:185,r:8},
            {w:185,r:8},
            {w:185,r:8},
            {
              w:185,
              r:0,
              status:"missed",
              reason:"fatigue"
            }
          ]
        );

      return (
        next.auto===false
        && next.rows.length===4
        && next.rows[3].r===8
        && next.rows[3].w===185
        && next.rows.every(
             row=>
               row.prescribed===true
               && !row.status
           )
      );
    })()
  `)
);

const RemoveSets90=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  FLEXIBLE_SET_PROGRAM_90
);

const dRemoveSets90=RemoveSets90.window.document;

RemoveSets90.window.eval(`
  wDaySel.value="D1";
  initSessionState();

  sessionState["Bench Press"]
    .rows
    .slice(0,2)
    .forEach(row=>{
      row.w=185;
      row.r=8;
      row.touched=true;
    });

  renderSessionInputs();
`);

dRemoveSets90.querySelector(
  '[data-exercise="Bench Press"][data-set-action="remove-remaining"]'
).dispatchEvent(
  new RemoveSets90.window.Event("click",{bubbles:true})
);

check(
  "v90 Remove remaining today records only-session removal and leaves program unchanged",
  RemoveSets90.window.eval(`
    sessionState["Bench Press"].rows[2].status==="removed"
    && sessionState["Bench Press"].rows[3].status==="removed"
    && program.days[0].exercises[0].scheme==="4×8"
  `)
  && RemoveSets90.window.eval(
       'saveExercise("Bench Press").ok'
     )===true
);

const SkipSets90=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  FLEXIBLE_SET_PROGRAM_90
);

const dSkipSets90=SkipSets90.window.document;

SkipSets90.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
`);

dSkipSets90.querySelector(
  '[data-exercise="Bench Press"][data-set-action="skip-remaining"]'
).dispatchEvent(
  new SkipSets90.window.Event("click",{bubbles:true})
);

check(
  "v90 whole programmed exercise can be skipped today without changing program",
  SkipSets90.window.eval(`
    sessionState["Bench Press"].rows.every(
      row=>
        row.status==="skipped"
        && row.touched===true
    )
    && program.days[0].exercises[0].scheme==="4×8"
  `)
);

const ExtraSet90=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  FLEXIBLE_SET_PROGRAM_90
);

const dExtraSet90=ExtraSet90.window.document;

ExtraSet90.window.eval(`
  wDaySel.value="D1";
  initSessionState();

  sessionState["Bench Press"]
    .rows
    .forEach(row=>{
      row.w=185;
      row.r=8;
      row.touched=true;
    });

  renderSessionInputs();
`);

dExtraSet90.querySelector(
  '[data-exercise="Bench Press"][data-set-action="add-set"]'
).dispatchEvent(
  new ExtraSet90.window.Event("click",{bubbles:true})
);

check(
  "v90 Add set creates session-only extra work without changing program",
  ExtraSet90.window.eval(`
    sessionState["Bench Press"].rows.length===5
    && sessionState["Bench Press"].rows[4].extra===true
    && sessionState["Bench Press"].rows[4].prescribed===false
    && program.days[0].exercises[0].scheme==="4×8"
  `)
);

check(
  "v90 untouched extra set is ignored rather than logged as fake work",
  ExtraSet90.window.eval(`
    (()=>{
      const result=
        validateExerciseEntry(
          sessionState["Bench Press"]
        );

      return (
        result.ok
        && result.value.length===4
      );
    })()
  `)
);

ExtraSet90.window.eval(`
  sessionState["Bench Press"].rows[4].w=185;
  sessionState["Bench Press"].rows[4].r=6;
  sessionState["Bench Press"].rows[4].touched=true;
`);

check(
  "v90 completed extra set is retained explicitly",
  ExtraSet90.window.eval(`
    (()=>{
      const result=
        validateExerciseEntry(
          sessionState["Bench Press"]
        );

      return (
        result.ok
        && result.value.length===5
        && result.value[4].w===185
        && result.value[4].r===6
        && result.value[4].extra===true
      );
    })()
  `)
);

check(
  "v90 extra set does not block progression after all required sets were completed",
  ExtraSet90.window.eval(`
    (()=>{
      cfg.autoProgressionOn=true;

      const next=
        prefillRows(
          {
            name:"Bench Press",
            scheme:"4×8"
          },
          [
            {w:185,r:8},
            {w:185,r:8},
            {w:185,r:8},
            {w:185,r:8},
            {
              w:185,
              r:4,
              extra:true
            }
          ]
        );

      return (
        next.auto===true
        && next.rows.length===4
        && next.rows.every(
             row=>
               row.w===190
               && row.r===8
           )
      );
    })()
  `)
);

const BodyweightSets90=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  {
    name:"Bodyweight Flexible Sets",
    days:[{
      id:"D1",
      title:"Bodyweight",
      exercises:[{
        name:"Push-Up",
        scheme:"3×10"
      }]
    }]
  }
);

const dBodyweightSets90=BodyweightSets90.window.document;

BodyweightSets90.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
`);

const bodyweightReps90=
  dBodyweightSets90.querySelector(
    '[data-exercise="Push-Up"][data-row="0"][data-field="reps"]'
  );

bodyweightReps90.value="10";

bodyweightReps90.dispatchEvent(
  new BodyweightSets90.window.Event(
    "input",
    {bubbles:true}
  )
);

dBodyweightSets90.querySelector(
  '[data-exercise="Push-Up"][data-set-action="skip-remaining"]'
).dispatchEvent(
  new BodyweightSets90.window.Event("click",{bubbles:true})
);

check(
  "v90-10 bodyweight set records shown reps and remaining sets skipped",
  BodyweightSets90.window.eval(`
    (()=>{
      const result=
        validateExerciseEntry(
          sessionState["Push-Up"]
        );

      return (
        result.ok
        && result.value[0].r===10
        && result.value[1].status==="skipped"
        && result.value[2].status==="skipped"
      );
    })()
  `)
);

check(
  "v90 storage accepts completed missed skipped removed and extra rows",
  FlexSets90.window.eval(`
    validSetRows([
      {w:185,r:8},
      {
        w:185,
        r:0,
        status:"missed",
        reason:"fatigue"
      },
      {
        status:"skipped",
        reason:"time"
      },
      {
        status:"removed"
      },
      {
        w:185,
        r:6,
        extra:true
      }
    ])
    && !validSetRows([
      {
        status:"mystery"
      }
    ])
  `)
);

const flexibleFaq90=
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "data-faq.js"
    ),
    "utf8"
  );

check(
  "v90-12 FAQ explains actual work, Remove, Undo, and final resolution",
  /Save Exercise/.test(flexibleFaq90)
  && /actually did/.test(flexibleFaq90)
  && /Zero is not a special command/.test(flexibleFaq90)
  && /<b>Remove<\/b>/.test(flexibleFaq90)
  && /<b>Undo<\/b>/.test(flexibleFaq90)
  && /\+ Add set/.test(flexibleFaq90)
  && /every programmed set/.test(flexibleFaq90)
  && /do not count as completed prescription/.test(flexibleFaq90)
);



// ================= v90-10 universal non-row outcomes =================

const UniversalOutcome90=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  {
    name:"Universal Outcome",
    days:[{
      id:"D1",
      title:"Mixed",
      exercises:[
        {name:"Run"},
        {name:"Plank"},
        {name:"Sprinting"},
        {name:"Farmer Carry"},
        {name:"EMOM Conditioning"},
        {name:"Physical Therapy"}
      ]
    }]
  }
);

const dUniversalOutcome90=
  UniversalOutcome90.window.document;

UniversalOutcome90.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
`);

[
  "Run",
  "Plank",
  "Sprinting",
  "Farmer Carry",
  "EMOM Conditioning",
  "Physical Therapy"
].forEach(name=>{
  const control=
    dUniversalOutcome90.querySelector(
      '[data-exercise-outcome-control="'
        +name
        +'"]'
    );

  check(
    "v90-10 "+name+" supports exercise-level outcomes",
    !!control
    && [...control.options].some(
         option=>option.value==="missed"
       )
    && [...control.options].some(
         option=>option.value==="skipped"
       )
    && [...control.options].some(
         option=>option.value==="removed"
       )
  );
});

const runOutcome90=
  dUniversalOutcome90.querySelector(
    '[data-exercise-outcome-control="Run"]'
  );

runOutcome90.value="skipped";

runOutcome90.dispatchEvent(
  new UniversalOutcome90.window.Event(
    "change",
    {bubbles:true}
  )
);

const runReason90=
  dUniversalOutcome90.querySelector(
    '[aria-label="Run optional outcome reason"]'
  );

runReason90.value="time";

runReason90.dispatchEvent(
  new UniversalOutcome90.window.Event(
    "change",
    {bubbles:true}
  )
);

check(
  "v90-10 non-row outcome saves and formats",
  UniversalOutcome90.window.eval(`
    (()=>{
      const result=
        saveExercise("Run");

      const saved=
        sessionState["Run"].saved;

      return (
        result.ok
        && saved.t==="exerciseOutcome"
        && saved.status==="skipped"
        && saved.reason==="time"
        && validStoredExerciseValue(saved)
        && formatSets(saved)==="Skipped · Time"
      );
    })()
  `)
);

dUniversalOutcome90
  .getElementById("logWorkoutBtn")
  .dispatchEvent(
    new UniversalOutcome90.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "v90-10 untouched planned non-row exercises cannot silently disappear",
  UniversalOutcome90.window.eval(
    "data.workouts.length===0"
  )
  && /Plank|Sprinting|Farmer Carry|EMOM Conditioning|Physical Therapy/.test(
       dUniversalOutcome90
         .getElementById(
           "workoutErr"
         )
         .textContent
     )
);



// ================= v90-11 simple removal UX =================

const SIMPLE_REMOVE_90_11={
  name:"Simple Removal",
  days:[{
    id:"D1",
    title:"Workout",
    exercises:[
      {
        name:"Bench Press",
        scheme:"3×5"
      },
      {
        name:"Run"
      }
    ]
  }]
};

const SimpleRemove9011=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  SIMPLE_REMOVE_90_11
);

const dSimpleRemove9011=
  SimpleRemove9011.window.document;

SimpleRemove9011.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
`);

const legacyModeButtons9011=
  [
    ...dSimpleRemove9011.querySelectorAll(
      "#exerciseInputs button.xbtn"
    )
  ].filter(
    button=>
      button.textContent==="Aa"
      || button.textContent==="#"
  );

check(
  "v90-11 Aa and # are hidden",
  legacyModeButtons9011.every(
    button=>button.hidden===true
  )
);

check(
  "v90-11 sets have direct Remove buttons",
  dSimpleRemove9011.querySelectorAll(
    '[data-exercise="Bench Press"][data-set-remove]'
  ).length===3
);

check(
  "v90-11 old set outcome controls are hidden",
  [
    ...dSimpleRemove9011.querySelectorAll(
      '[data-exercise="Bench Press"][data-set-outcome="true"]'
    )
  ].every(
    control=>control.hidden===true
  )
);

const firstRemove9011=
  dSimpleRemove9011.querySelector(
    '[data-exercise="Bench Press"][data-set-remove="0"]'
  );

firstRemove9011.dispatchEvent(
  new SimpleRemove9011.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v90-11 Remove hides the normal set and exposes Undo",
  SimpleRemove9011.window.eval(`
    sessionState["Bench Press"].rows[0].status==="removed"
  `)
  && !!dSimpleRemove9011.querySelector(
       '[data-set-undo="0"]'
     )
);

dSimpleRemove9011.querySelector(
  '[data-set-undo="0"]'
).dispatchEvent(
  new SimpleRemove9011.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v90-11 set Undo restores the set",
  SimpleRemove9011.window.eval(`
    sessionState["Bench Press"].rows[0].status===""
  `)
  && !!dSimpleRemove9011.querySelector(
       '[data-exercise="Bench Press"][data-set-remove="0"]'
     )
);

check(
  "v90-11 whole exercise outcome select is hidden",
  dSimpleRemove9011.querySelector(
    '[data-exercise-outcome-control="Bench Press"]'
  ).hidden===true
);

check(
  "v90-11 planned exercises have direct Remove exercise",
  !!dSimpleRemove9011.querySelector(
       '[data-exercise-remove-today="Bench Press"]'
     )
  && !!dSimpleRemove9011.querySelector(
       '[data-exercise-remove-today="Run"]'
     )
);

check(
  "v90-11 secondary tools use a true three-dot button",
  [
    ...dSimpleRemove9011.querySelectorAll(
      ".exercise-more-toggle"
    )
  ].every(
    button=>button.textContent==="•••"
  )
);

const runRemove9011=
  dSimpleRemove9011.querySelector(
    '[data-exercise-remove-today="Run"]'
  );

runRemove9011.dispatchEvent(
  new SimpleRemove9011.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v90-11 non-row Remove exercise offers Undo",
  SimpleRemove9011.window.eval(`
    sessionState["Run"].exerciseOutcome==="removed"
  `)
  && !!dSimpleRemove9011.querySelector(
       '[data-exercise-removal-undo="Run"]'
     )
);

dSimpleRemove9011.querySelector(
  '[data-exercise-removal-undo="Run"]'
).dispatchEvent(
  new SimpleRemove9011.window.Event(
    "click",
    {bubbles:true}
  )
);

check(
  "v90-11 exercise Undo restores non-row exercise",
  SimpleRemove9011.window.eval(`
    sessionState["Run"].exerciseOutcome===""
  `)
);

check(
  "v90-11 removal does not modify the program",
  SimpleRemove9011.window.eval(`
    program.days[0].exercises.length===2
    && program.days[0].exercises[0].name==="Bench Press"
    && program.days[0].exercises[0].scheme==="3×5"
    && program.days[0].exercises[1].name==="Run"
  `)
);



// ============================================================
// v90-12 — record actual work or Remove
// ============================================================

const RECORD_REMOVE_90_12={
  name:"Record or Remove",
  days:[{
    id:"D1",
    title:"Workout",
    exercises:[
      {
        name:"Bench Press",
        scheme:"3×5"
      },
      {
        name:"Run"
      }
    ]
  }]
};

const RecordRemove9012=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  RECORD_REMOVE_90_12
);

const dRecordRemove9012=
  RecordRemove9012.window.document;

RecordRemove9012.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
`);

const firstRemove9012=
  dRecordRemove9012.querySelector(
    '[data-exercise="Bench Press"]'
      +'[data-set-remove="0"]'
  );

const firstValueRow9012=
  firstRemove9012
    ? firstRemove9012.closest(
        ".srow"
      )
    : null;

const firstValueRowIndex9012=
  firstValueRow9012
    ? [...firstValueRow9012.parentNode.children]
        .indexOf(firstValueRow9012)
    : -1;

check(
  "v90-13 Remove shares the set value row",
  !!firstRemove9012
  && !!firstValueRow9012
  && firstValueRow9012
       .classList
       .contains("srow")
  && firstValueRow9012
       .querySelector(
         "[data-set-remove]"
       )
);

check(
  "v90-13 Set Weight Reps and Remove remain on one row",
  !!firstValueRow9012
  && firstValueRow9012.classList.contains(
       "workout-set-row"
     )
  && !!firstValueRow9012
       .querySelector(
         '[data-field="weight"]'
       )
  && !!firstValueRow9012
       .querySelector(
         '[data-field="reps"]'
       )
  && !!firstValueRow9012
       .querySelector(
         '[data-set-remove="0"]'
       )
  && firstValueRow9012.querySelectorAll(
       ".set-controls-line > button.step"
     ).length===4
);

const more9012=
  dRecordRemove9012.querySelector(
    "details.exercise-more"
  );

if (more9012){
  more9012.open=true;

  dRecordRemove9012.body.dispatchEvent(
    new RecordRemove9012.window.MouseEvent(
      "click",
      {bubbles:true}
    )
  );
}

check(
  "v90-12 tapping elsewhere closes the three-dot menu",
  !!more9012
  && more9012.open===false
);

/*
 * Test Remove/Undo while the workout card is still in
 * the normal editable state.
 */
if (firstRemove9012){
  firstRemove9012.dispatchEvent(
    new RecordRemove9012.window.Event(
      "click",
      {bubbles:true}
    )
  );
}

const firstUndo9012=
  dRecordRemove9012.querySelector(
    '[data-set-undo="0"]'
  );

check(
  "v90-13 explicit set Remove produces in-place Undo",
  !!firstRemove9012
  && RecordRemove9012.window.eval(`
       sessionState["Bench Press"]
         .rows[0]
         .status==="removed"
     `)
  && !!firstUndo9012
  && [...firstUndo9012.closest(
         ".exercise"
       ).children].indexOf(
         firstUndo9012.closest(
           ".removed-set-undo-row"
         )
       )===firstValueRowIndex9012
);

if (firstUndo9012){
  firstUndo9012.dispatchEvent(
    new RecordRemove9012.window.Event(
      "click",
      {bubbles:true}
    )
  );
}

check(
  "v90-12 set Undo restores the removed set",
  RecordRemove9012.window.eval(`
    sessionState["Bench Press"]
      .rows[0]
      .status===""
  `)
  && !!dRecordRemove9012.querySelector(
       '[data-exercise="Bench Press"]'
         +'[data-set-remove="0"]'
     )
);

const visibleLegacyControls9012=
  [
    ...dRecordRemove9012.querySelectorAll(
      '#exerciseInputs '
        +'select[data-set-outcome="true"],'
        +'#exerciseInputs '
        +'select.exercise-outcome-select,'
        +'#exerciseInputs '
        +'[data-set-action="skip-remaining"]'
    )
  ]
  .filter(
    element=>{
      if (
        element.hidden
        || element.getAttribute(
             "aria-hidden"
           )==="true"
      ){
        return false;
      }

      return (
        RecordRemove9012.window
          .getComputedStyle(element)
          .display!=="none"
      );
    }
  );

check(
  "v90-12 fresh workout exposes no Missed or Skipped controls",
  visibleLegacyControls9012.length===0
);


/*
 * Separate fresh instance for zero and actual-rep behavior.
 */
const Actual9012=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  RECORD_REMOVE_90_12
);

const dActual9012=
  Actual9012.window.document;

Actual9012.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
`);

const zeroWeight9012=
  dActual9012.querySelector(
    '[data-exercise="Bench Press"]'
      +'[data-row="0"]'
      +'[data-field="weight"]'
  );

const zeroReps9012=
  dActual9012.querySelector(
    '[data-exercise="Bench Press"]'
      +'[data-row="0"]'
      +'[data-field="reps"]'
  );

if (
  zeroWeight9012
  && zeroReps9012
){
  zeroWeight9012.value="185";

  zeroWeight9012.dispatchEvent(
    new Actual9012.window.Event(
      "input",
      {bubbles:true}
    )
  );

  zeroReps9012.value="0";

  zeroReps9012.dispatchEvent(
    new Actual9012.window.Event(
      "input",
      {bubbles:true}
    )
  );
}

check(
  "v90-13 typing zero does not create Missed and shows inline guidance",
  !!zeroWeight9012
  && !!zeroReps9012
  && Actual9012.window.eval(`
       sessionState["Bench Press"]
         .rows[0]
         .r===0
       && sessionState["Bench Press"]
         .rows[0]
         .status!=="missed"
     `)
  && !!zeroReps9012.closest(".srow")
       .querySelector(".set-zero-help:not([hidden])")
  && /Enter the reps you completed, or Remove this set\./i.test(
       zeroReps9012.closest(".srow")
         .querySelector(".set-zero-help").textContent
     )
);

const zeroHelp9014=
  zeroReps9012.closest(".srow")
    .querySelector(".set-zero-help");

const repPlus9014=
  [...zeroReps9012.closest(".srow")
    .querySelectorAll("button.step")]
    .find(button=>
      /Increase .* repetitions by 1/i.test(
        button.getAttribute("aria-label") || ""
      )
    );

const repMinus9014=
  [...zeroReps9012.closest(".srow")
    .querySelectorAll("button.step")]
    .find(button=>
      /Decrease .* repetitions by 1/i.test(
        button.getAttribute("aria-label") || ""
      )
    );

if (repPlus9014){
  repPlus9014.dispatchEvent(
    new Actual9012.window.Event(
      "click",
      {bubbles:true}
    )
  );
}

check(
  "v90-14 increasing from zero hides inline guidance",
  !!zeroHelp9014
  && !!repPlus9014
  && zeroHelp9014.hidden===true
  && Actual9012.window.eval(`
       sessionState["Bench Press"].rows[0].r===1
     `)
);

if (repMinus9014){
  repMinus9014.dispatchEvent(
    new Actual9012.window.Event(
      "click",
      {bubbles:true}
    )
  );
}

check(
  "v90-14 decreasing to zero restores inline guidance",
  !!zeroHelp9014
  && !!repMinus9014
  && zeroHelp9014.hidden===false
  && Actual9012.window.eval(`
       sessionState["Bench Press"].rows[0].r===0
     `)
);

const INTERVAL_HEADER_90_13={
  name:"Intervals and long headers",
  days:[{
    id:"D1",
    title:"Workout",
    exercises:[{
      name:"Stationary Cycling",
      scheme:"10 intervals · 60 seconds work · 60 seconds recovery with a deliberately long instruction that must wrap inside the card",
      prescription:{
        intervals:10,
        durationSeconds:60,
        recoverySeconds:60
      }
    }]
  }]
};

const IntervalHeader9013=boot(
  V3_CFG,
  Object.assign({},EMPTY_DATA,{workouts:[],activeWorkoutDraft:null}),
  null,
  INTERVAL_HEADER_90_13
);
const dIntervalHeader9013=IntervalHeader9013.window.document;
IntervalHeader9013.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
`);
const intervalCard9013=dIntervalHeader9013.querySelector(".exercise");
const intervalHead9013=intervalCard9013.querySelector(".x-head");
const intervalPrescription9013=intervalCard9013.querySelector(
  ".exercise-prescription"
);
check(
  "v90-13 Stationary Cycling interval prescription uses timed interval card",
  IntervalHeader9013.window.eval(`
    sessionState["Stationary Cycling"].profile==="timedIntervals"
    && sessionState["Stationary Cycling"].typed.intervals===10
    && sessionState["Stationary Cycling"].typed.workMinutes===1
    && sessionState["Stationary Cycling"].typed.workSeconds===0
    && sessionState["Stationary Cycling"].typed.recoverySeconds===60
  `)
  && !!intervalCard9013.querySelector('[data-profile-field="intervals"]')
);
check(
  "v90-13 long prescription is below name and actions stay in top row",
  !!intervalHead9013.querySelector(".exercise-name")
  && !!intervalHead9013.querySelector(".x-tools")
  && !intervalHead9013.querySelector(".scheme")
  && !!intervalPrescription9013
  && intervalPrescription9013.parentNode===intervalCard9013
  && intervalPrescription9013.previousElementSibling===intervalHead9013
  && !!intervalHead9013.querySelector(".exercise-more-toggle")
);

const zeroSave9012=
  zeroWeight9012
  && zeroReps9012
    ? Actual9012.window.eval(
        'saveExercise("Bench Press")'
      )
    : {ok:false};

const zeroErr9012=
  dActual9012.getElementById(
    "workoutErr"
  );

check(
  "v90-12 saving zero reps asks for actual reps or Remove",
  zeroSave9012
  && zeroSave9012.ok===false
  && !!zeroErr9012
  && /reps you actually completed/i.test(
       zeroErr9012.textContent
     )
  && /Remove/i.test(
       zeroErr9012.textContent
     )
);


/*
 * Another fresh instance proves fewer actual reps save
 * normally with no label.
 */
const LowerReps9012=boot(
  V3_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:[],
      activeWorkoutDraft:null
    }
  ),
  null,
  RECORD_REMOVE_90_12
);

const dLowerReps9012=
  LowerReps9012.window.document;

LowerReps9012.window.eval(`
  wDaySel.value="D1";
  initSessionState();
  renderSessionInputs();
`);

const lowerWeight9012=
  dLowerReps9012.querySelector(
    '[data-exercise="Bench Press"]'
      +'[data-row="0"]'
      +'[data-field="weight"]'
  );

const lowerReps9012=
  dLowerReps9012.querySelector(
    '[data-exercise="Bench Press"]'
      +'[data-row="0"]'
      +'[data-field="reps"]'
  );

if (
  lowerWeight9012
  && lowerReps9012
){
  lowerWeight9012.value="185";

  lowerWeight9012.dispatchEvent(
    new LowerReps9012.window.Event(
      "input",
      {bubbles:true}
    )
  );

  lowerReps9012.value="3";

  lowerReps9012.dispatchEvent(
    new LowerReps9012.window.Event(
      "input",
      {bubbles:true}
    )
  );
}

const lowerSave9012=
  lowerWeight9012
  && lowerReps9012
    ? LowerReps9012.window.eval(
        'saveExercise("Bench Press")'
      )
    : {ok:false};

check(
  "v90-12 fewer-than-planned reps save as normal actual work",
  lowerSave9012
  && lowerSave9012.ok===true
  && LowerReps9012.window.eval(`
       Array.isArray(
         sessionState["Bench Press"].saved
       )
       && sessionState["Bench Press"]
            .saved.length===1
       && sessionState["Bench Press"]
            .saved[0].w===185
       && sessionState["Bench Press"]
            .saved[0].r===3
       && !sessionState["Bench Press"]
             .saved[0].status
     `)
);

check(
  "v90-12 lower actual reps receive no Missed or Failed label",
  !/Missed|Failed/i.test(
    [
      ...dLowerReps9012
        .querySelectorAll(
          "#exerciseInputs .srow .sx"
        )
    ]
    .map(
      element=>
        element.textContent || ""
    )
    .join(" ")
  )
);

check(
  "v90-12 historical Missed rows remain valid and readable",
  LowerReps9012.window.eval(`
    validSetRows([
      {
        w:185,
        r:0,
        status:"missed",
        reason:"fatigue"
      }
    ])
  `)===true
  && /Missed/i.test(
       LowerReps9012.window.eval(`
         formatSets([
           {
             w:185,
             r:0,
             status:"missed",
             reason:"fatigue"
           }
         ])
       `)
     )
);


summary("INTEGRATION");
})().catch(e=>{ console.error(e); process.exit(1); });
