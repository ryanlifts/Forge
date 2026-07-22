// BlackPyre permanent integration suite — boots the shipped app and exercises whole flows.
const { boot, bootRaw, assembleHTML, sacredCalls, allBlackPyreCalls, check, summary, dstr, wait, EXISTING_CFG, EMPTY_DATA } = require("./harness");
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
const V2_CFG = Object.assign({}, EXISTING_CFG, {schemaVersion:2});
const V2_DATA = Object.assign({}, EMPTY_DATA, {activeWorkoutDraft:null});
const TEST_PROGRAM = {name:"Test Program",author:"Suite",days:[{id:"D1",title:"Day 1",exercises:[{name:"Bench Press",scheme:"3×5"}]}]};
const RAW_V1_CFG = JSON.stringify(V1_CFG);
const RAW_V2_CFG = JSON.stringify(V2_CFG);
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
PC.window.document.getElementById("sUsdaKey").value="blocked-key";
PC.window.document.getElementById("saveUsdaBtn").dispatchEvent(new PC.window.Event("click",{bubbles:true}));
check("blocked actions cannot show a false saved acknowledgement", !PC.window.document.getElementById("saveUsdaBtn").classList.contains("acked") && /Not saved/.test(PC.window.document.getElementById("saveState").textContent));
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
check("fresh install stamps schemaVersion 2", JSON.parse(Fresh45.window.localStorage.getItem("forge:cfg")).schemaVersion===2);
check("fresh install writes a complete primary state", freshCalls.length===3 && freshCalls.map(c=>c.key).join(",")==="forge:data,forge:program,forge:cfg");
const rawV44Cfg = JSON.stringify(Object.assign({},EXISTING_CFG,{futureField:"survives"}));
let H45 = bootRaw({cfg:rawV44Cfg,data:RAW_DATA,program:RAW_PROGRAM});
const h45Calls = sacredCalls(H45);
check("legacy-shaped install adds the draft field then stamps schema 2", h45Calls.length===2 && h45Calls.map(c=>c.key).join(",")==="forge:data,forge:cfg" && JSON.parse(h45Calls[1].value).schemaVersion===2 && JSON.parse(H45.window.localStorage.getItem("forge:data")).activeWorkoutDraft===null);
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
check("next boot heals an unstamped interrupted commit", Healed45.window.eval("protectedMode")===false && Healed45.window.eval("cfg.schemaVersion")===2 && Healed45.window.eval("cfg.calTarget")===1600 && Healed45.window.eval("data.activeWorkoutDraft")===null);

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
let H46 = bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM});
let h46LkgRaw = H46.window.localStorage.getItem("forge:lkg");
let h46Lkg = JSON.parse(h46LkgRaw);
check("v46 recovery behavior keeps current primary schemaVersion 2", H46.window.eval("cfg.schemaVersion")===2 && JSON.parse(H46.window.localStorage.getItem("forge:cfg")).schemaVersion===2);
check("v46 healthy boot creates a format-1 whole-state LKG", h46Lkg.recoveryFormatVersion===1 && ["cfg","data","program"].every(k=>typeof h46Lkg.strings[k]==="string"));
check("creating LKG does not rewrite unchanged primary keys", sacredCalls(H46).length===0 && callsFor(H46,"forge:lkg").length===1);
check("LKG final strings pass the shared prepare pipeline", H46.window.eval(`inspectLkgRaw(${JSON.stringify(h46LkgRaw)}).ok`)===true);
let H46b = bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
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
let LkgFail = bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
const lkgFailBefore = LkgFail.window.localStorage.getItem("forge:lkg");
const lfProto = Object.getPrototypeOf(LkgFail.window.localStorage), lfSpySet=lfProto.setItem;
lfProto.setItem=function(k,v){ if(k==="forge:lkg") throw new Error("snapshot denied"); return lfSpySet.call(this,k,v); };
const lkgFailSave = LkgFail.window.eval(`data.weights.push({date:"2026-07-14",lbs:216}); save()`);
lfProto.setItem=lfSpySet;
check("LKG write failure leaves primary save successful", lkgFailSave===true && JSON.parse(LkgFail.window.localStorage.getItem("forge:data")).weights[0].lbs===216);
check("LKG write failure leaves previous snapshot intact and reports unavailable", LkgFail.window.localStorage.getItem("forge:lkg")===lkgFailBefore && LkgFail.window.eval("lkgStatus.state")==="unavailable");
let LkgVerifyFail=bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:lkgFailBefore});
const lvProto=Object.getPrototypeOf(LkgVerifyFail.window.localStorage), lvSet=lvProto.setItem, lvGet=lvProto.getItem;
let lvWrote=false, lvMismatch=false;
lvProto.setItem=function(k,v){ const out=lvSet.call(this,k,v); if(k==="forge:lkg") lvWrote=true; return out; };
lvProto.getItem=function(k){ if(k==="forge:lkg" && lvWrote && !lvMismatch){ lvMismatch=true; return "{mismatch"; } return lvGet.call(this,k); };
LkgVerifyFail.window.eval(`data.weights=[{date:"2026-07-14",lbs:214}]; save();`);
lvProto.setItem=lvSet; lvProto.getItem=lvGet;
check("LKG verification failure rolls back to the previous snapshot", LkgVerifyFail.window.localStorage.getItem("forge:lkg")===lkgFailBefore && JSON.parse(LkgVerifyFail.window.localStorage.getItem("forge:data")).weights[0].lbs===214);

// A quota-caused primary failure may sacrifice LKG once, never quarantine.
const quotaQuarantine = validQuarantineRaw({cfg:"old",data:"old",program:"old",legacyData:null});
let Quota46 = bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw,quarantine:quotaQuarantine});
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
let BadLkg = bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:"{broken"});
check("malformed LKG never protects healthy live data", BadLkg.window.eval("protectedMode")===false);
check("malformed LKG is rebuilt as a valid snapshot", BadLkg.window.eval(`inspectLkgRaw(localStorage.getItem("forge:lkg")).ok`)===true && callsFor(BadLkg,"forge:lkg").some(c=>c.method==="setItem"));
const newerLkgRaw=JSON.stringify({recoveryFormatVersion:99,savedAt:"future",strings:{}});
let NewLkg = bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:newerLkgRaw});
check("newer-format LKG is not used or overwritten", NewLkg.window.eval("protectedMode")===false && NewLkg.window.localStorage.getItem("forge:lkg")===newerLkgRaw && NewLkg.window.eval("lkgStatus.state")==="newer" && callsFor(NewLkg,"forge:lkg").length===0);
const newerStateLkgRaw=JSON.stringify({recoveryFormatVersion:1,savedAt:"future",strings:{cfg:JSON.stringify({schemaVersion:99}),data:RAW_DATA,program:RAW_PROGRAM},legacyData:null});
let NewStateLkg=bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:newerStateLkgRaw});
check("LKG carrying newer primary schema is not overwritten", NewStateLkg.window.localStorage.getItem("forge:lkg")===newerStateLkgRaw && NewStateLkg.window.eval("lkgStatus.state")==="newer" && callsFor(NewStateLkg,"forge:lkg").length===0);

// Protected boot diagnoses exact area, shows recovery before gates, and never refreshes LKG.
let DiagCfg = bootRaw({cfg:"{broken",data:RAW_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
check("v46 diagnosis identifies corrupt settings", DiagCfg.window.eval(`protectedModeDiagnostic.stage+":"+protectedModeDiagnostic.part`)==="parse:cfg");
check("corruption recovery panel appears before gates", !DiagCfg.window.document.getElementById("recoveryOverlay").classList.contains("hidden") && DiagCfg.window.document.getElementById("disclaimerOverlay").classList.contains("hidden") && DiagCfg.window.document.getElementById("setupOverlay").classList.contains("hidden"));
check("protected boot never refreshes or replaces LKG", DiagCfg.window.localStorage.getItem("forge:lkg")===h46LkgRaw && callsFor(DiagCfg,"forge:lkg").length===0);
let DiagData=bootRaw({cfg:RAW_V1_CFG,data:"{broken",program:RAW_PROGRAM,lkg:h46LkgRaw});
let DiagProgram=bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:"{broken",lkg:h46LkgRaw});
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
let StorageRead46=bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM},w=>{
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
function bootOFF(offResponder){
  return boot(Object.assign({}, EXISTING_CFG, {usdaKey:"k"}),
    Object.assign({}, EMPTY_DATA, {myFoods:{"111":{name:"Saved thing", brand:"Mine", cal100:100, pro100:10, carb100:5, fat100:2}}}),
    (w)=>{ w.__calls=[]; w.fetch=(url)=>{ w.__calls.push(url);
      if (url.includes("openfoodfacts")) return offResponder(url);
      if (url.includes("usda")) return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({foods:[{description:"USDA Fallback Bar", brandOwner:"USDA Co", servingSize:50, servingSizeUnit:"g", foodNutrients:[{nutrientId:1008,value:400},{nutrientId:1003,value:30},{nutrientId:1005,value:40},{nutrientId:1004,value:12}]}]})});
      return Promise.resolve({ok:false,status:500,json:()=>Promise.resolve({})});
    };});
}
async function scan(C, code){ C.window.document.getElementById("barcodeInput").value=code; await C.window.eval("runBarcode()"); await wait(30); }
let C = bootOFF(()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({status:"success", product:{code:"222", product_name:"Greek Yogurt", brands:"BrandX", serving_size:"170 g", serving_quantity:170, nutriments:{"energy-kcal_100g":59,"proteins_100g":10,"carbohydrates_100g":3.6,"fat_100g":0.4}}})}));
await scan(C,"222");
check("OFF v3.6 found → selected", C.window.document.getElementById("selName").textContent.includes("Greek Yogurt") && C.window.eval("window.__calls[0]").includes("/api/v3.6/product/"));
C = bootOFF(()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({})}));
await scan(C,"111");
check("saved barcode short-circuits (zero network)", C.window.eval("window.__calls.length")===0);
C = bootOFF(()=>Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({})}));
await scan(C,"333");
check("OFF 404 → USDA fallback", C.window.document.getElementById("selName").textContent.includes("USDA Fallback Bar"));
C = bootOFF(()=>Promise.reject(new Error("offline")));
await scan(C,"666");
check("OFF network failure → USDA (chain never dead-ends)", C.window.document.getElementById("selName").textContent.includes("USDA Fallback Bar"));
C = bootOFF(()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({status:"success", product:{product_name:"Bad", nutriments:{"energy-kcal_100g":"NaN-city","proteins_100g":-5}}})}));
await scan(C,"555");
check("malformed nutrition rejected → USDA", C.window.document.getElementById("selName").textContent.includes("USDA Fallback Bar"));

// ================= v49: training-session integrity =================
const priorWorkout = {date:"2026-07-01",day:"D1",title:"Day 1",sets:{"Bench Press":[{w:100,r:5},{w:100,r:5},{w:100,r:5}]},notes:""};
const T49 = boot(V2_CFG, {food:{},workouts:[priorWorkout],weights:[],meta:{lastBackup:null,logsSince:0}}, null, TEST_PROGRAM);
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
check("saved exercise shows Completed with an Edit option", /Completed/.test(dT49.querySelector("#exerciseInputs .savedChip").textContent) && [...dT49.querySelectorAll("#exerciseInputs .xbtn")].some(b=>b.textContent==="Edit"));
clickT49("logWorkoutBtn");
check("logging saves only the genuinely saved set", T49.window.eval(`data.workouts.length===2 && data.workouts[1].sets["Bench Press"].length===1 && data.workouts[1].sets["Bench Press"][0].w===105`));
check("partial saved history cannot trigger false progression next time", T49.window.eval(`sessionState["Bench Press"].auto===false && sessionState["Bench Press"].rows.length===1 && sessionState["Bench Press"].rows[0].w===105`));

const T49Invalid = boot(V2_CFG, EMPTY_DATA, null, TEST_PROGRAM);
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

const T49Switch = boot(V2_CFG, EMPTY_DATA, null, TEST_PROGRAM);
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
const T50 = boot(V2_CFG, EMPTY_DATA, null, TEST_PROGRAM);
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
const T51 = boot(V2_CFG, EMPTY_DATA, null, TEST_PROGRAM);
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
T51.window.confirm = (m)=>{ confirm51Msgs.push(m); return true; }; // Save valid & log
clickT51("logWorkoutBtn");
check("v51 save-and-log path: valid unsaved work is saved then logged, never silently dropped", T51.window.eval(`data.workouts.length===1 && data.workouts[0].sets["Bench Press"].length===1 && data.workouts[0].sets["Bench Press"][0].w===135`));

// leaving Train with unsaved work warns; canceling stays
const T51b = boot(V2_CFG, EMPTY_DATA, null, TEST_PROGRAM);
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
// saved-but-unlogged work also counts as meaningful for session-type switching
const T51c = boot(V2_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT51c = T51c.window.document;
enterSet51(T51c, dT51c, 115, 5);
dT51c.querySelector("#exerciseInputs .saveExBtn").dispatchEvent(new T51c.window.Event("click",{bubbles:true}));
let switch51 = 0;
T51c.window.confirm = ()=>{ switch51++; return false; };
dT51c.getElementById("wDay").value="__CARDIO__";
dT51c.getElementById("wDay").dispatchEvent(new T51c.window.Event("change",{bubbles:true}));
check("v51 saved-but-unlogged work still guards session-type switching", switch51===1 && dT51c.getElementById("wDay").value==="D1");

// ================= v51: food-flow improvements =================
const F51 = boot(V2_CFG, EMPTY_DATA);
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
check("v51 undo: deletion removes the entry and offers Undo", F51.window.eval("data.food[todayStr()].length")===2 && !dF51.getElementById("undoToast").classList.contains("hidden") && /Deleted "Chicken"/.test(dF51.getElementById("undoMsg").textContent));
dF51.getElementById("undoBtn").dispatchEvent(new F51.window.Event("click",{bubbles:true}));
check("v51 undo: tapping Undo restores the entry at its original position", F51.window.eval(`data.food[todayStr()].length===3 && data.food[todayStr()][0].name==="Chicken"`) && dF51.getElementById("undoToast").classList.contains("hidden"));
// search results into view + post-log return
F51.window.HTMLElement.prototype.scrollIntoView = function(opts){ F51.window.__f51 = {id:this.id, block:opts&&opts.block}; };
F51.window.eval(`renderResults([{name:"Test Food", brand:"B", cal100:100, pro100:10, carb100:5, fat100:2}]);`);
check("v51 search results scroll into view beside the field", F51.window.eval("window.__f51 && window.__f51.id")==="resultsCard");
dF51.querySelector("#results .result").dispatchEvent(new F51.window.Event("click",{bubbles:true}));
dF51.getElementById("addSelBtn").dispatchEvent(new F51.window.Event("click",{bubbles:true}));
check("v51 logging from search returns to the search box for the next entry", F51.window.eval("window.__f51 && window.__f51.id")==="foodQuery" && F51.window.eval("data.food[todayStr()].length")===4);
check("v51 handoff behavior untouched by food changes", !!dF51.getElementById("hfPasteBtn"));

// ================= v60: default-on ChatGPT food handoff =================
const H60 = boot(V2_CFG, EMPTY_DATA);
const dH60 = H60.window.document;
const clickH60 = id=>dH60.getElementById(id).dispatchEvent(new H60.window.Event("click",{bubbles:true}));
check("v60 food handoff is visible by default without a key", !dH60.getElementById("aiFoodCard").classList.contains("hidden") && !dH60.getElementById("aiHandoffControls").classList.contains("hidden"));
check("v60 Settings toggle reports the default-on state accessibly", dH60.getElementById("foodHandoffToggleBtn").getAttribute("aria-pressed")==="true" && /Disable ChatGPT food handoff/.test(dH60.getElementById("foodHandoffToggleBtn").textContent));
clickH60("foodHandoffToggleBtn");
check("v60 disabling food handoff persists false and hides the no-key card", H60.window.eval("cfg.foodHandoffOn")===false && JSON.parse(H60.window.localStorage.getItem("forge:cfg")).foodHandoffOn===false && dH60.getElementById("aiFoodCard").classList.contains("hidden"));
clickH60("foodHandoffToggleBtn");
check("v60 food handoff can be restored from Settings", H60.window.eval("cfg.foodHandoffOn")===true && !dH60.getElementById("aiFoodCard").classList.contains("hidden") && dH60.getElementById("foodHandoffToggleBtn").getAttribute("aria-pressed")==="true");
const H60Api = boot(Object.assign({},V2_CFG,{aiProvider:"anthropic",anthropicKey:"sk-test",foodHandoffOn:true}),EMPTY_DATA);
check("v60 a configured live API key keeps the live food flow", H60Api.window.document.getElementById("aiHandoffControls").classList.contains("hidden") && !H60Api.window.document.getElementById("aiFoodGoBtn").classList.contains("hidden"));
const H60Off = boot(Object.assign({},V2_CFG,{aiProvider:"handoff",foodHandoffOn:false}),EMPTY_DATA);
check("v60 disabling food handoff also hides it in handoff provider mode", H60Off.window.document.getElementById("aiFoodCard").classList.contains("hidden"));
check("v60 FAQ explains the default-on toggle", H60.window.eval(`FAQ.some(x=>x.q==="What is ChatGPT handoff mode?"&&/on by default/i.test(x.a)&&/Settings/.test(x.a))`));
check("v60 keeps primary schemaVersion 2", H60.window.eval("SCHEMA_VERSION")===2);

// ================= v61: local food suggestions =================
const S61 = boot(V2_CFG, EMPTY_DATA);
const dS61 = S61.window.document;
const clickS61 = id=>dS61.getElementById(id).dispatchEvent(new S61.window.Event("click",{bubbles:true}));
check("v61 food suggestions are opt-in and hidden by default", dS61.getElementById("foodSuggestionsCard").classList.contains("hidden") && dS61.getElementById("foodSuggestionsToggleBtn").getAttribute("aria-pressed")==="false");
clickS61("foodSuggestionsToggleBtn");
check("v61 enabling suggestions persists the preference", S61.window.eval("cfg.foodSuggestionsOn")===true && JSON.parse(S61.window.localStorage.getItem("forge:cfg")).foodSuggestionsOn===true);
check("v61 enabled suggestions show three local review choices", !dS61.getElementById("foodSuggestionsCard").classList.contains("hidden") && dS61.querySelectorAll("#foodSuggestionsList button.result").length===3);
const S61Offline=boot(Object.assign({},V2_CFG,{foodSuggestionsOn:true}),EMPTY_DATA,(w)=>{
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
const S61NoTargets=boot(Object.assign({},V2_CFG,{calTarget:0,proTarget:0,carbGoal:0,fatGoal:0,foodSuggestionsOn:true}),EMPTY_DATA);
check("v61 enabled suggestions explain that targets are required", /Set calorie and macro targets/.test(S61NoTargets.window.document.getElementById("foodSuggestionsSummary").textContent) && S61NoTargets.window.document.querySelectorAll("#foodSuggestionsList button").length===0);
const fullFood61={}; fullFood61[dstr(0)]=[{name:"Full day",cal:1800,pro:170,carb:180,fat:55,meal:"dinner"}];
const S61Full=boot(Object.assign({},V2_CFG,{foodSuggestionsOn:true}),Object.assign({},EMPTY_DATA,{food:fullFood61}));
check("v61 reached calorie target gives an honest no-force message", S61Full.window.document.querySelectorAll("#foodSuggestionsList button").length===0 && /No need to force another food|No normal food/.test(S61Full.window.document.getElementById("foodSuggestionsList").textContent));
const familiarData61=Object.assign({},EMPTY_DATA,{recents:[{name:"Ryan's lunch yogurt",brand:"Saved",cal100:60,pro100:10,carb100:4,fat100:0.5,lastAmt:200,lastUnit:"g"}],foodCounts:{"Ryan's lunch yogurt|Saved":9},mealCounts:{lunch:{"Ryan's lunch yogurt|Saved":7}}});
const S61Familiar=boot(Object.assign({},V2_CFG,{foodSuggestionsOn:true}),familiarData61);
S61Familiar.window.eval(`currentMeal="lunch"; foodSuggestionPage=0; renderMealSeg(); renderFood();`);
check("v61 familiar meal history is represented in suggestions", /Ryan's lunch yogurt/.test(S61Familiar.window.document.getElementById("foodSuggestionsList").textContent) && /Familiar lunch choice/.test(S61Familiar.window.document.getElementById("foodSuggestionsList").textContent));
check("v61 suggestion buttons remain keyboard-accessible native controls", [...S61Familiar.window.document.querySelectorAll("#foodSuggestionsList button")].every(b=>b.tagName==="BUTTON" && /Review suggestion:/.test(b.getAttribute("aria-label")||"")));
check("v61 FAQ fully explains local suggestions, review-before-log, visibility limits, and allergy limits", S61.window.eval(`FAQ.some(x=>x.q==="How do food suggestions work?"&&/one food at a time/.test(x.a)&&/works offline/.test(x.a)&&/does not call USDA or an AI/.test(x.a)&&/nothing logs until/.test(x.a)&&/allergy/i.test(x.a)) && FAQ.some(x=>x.q==="Why aren't food suggestions showing?"&&/today's date/.test(x.a)&&/calorie and macro targets/.test(x.a)&&/individual foods/.test(x.a))`));
check("v61 keeps primary schemaVersion 2", S61.window.eval("SCHEMA_VERSION")===2);


// ================= v62: expanded USDA-anchored suggestion catalog =================
const C62 = boot(Object.assign({},V2_CFG,{foodSuggestionsOn:true}), EMPTY_DATA);
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
check("v62 FAQ explains USDA sourcing, exact servings, and real-world variation", C62.window.eval(`FAQ.some(x=>x.q==="How accurate are suggested-food calories and macros?"&&/per 100 grams/.test(x.a)&&/exact gram weight/.test(x.a)&&/NDB number/.test(x.a)&&/brand/.test(x.a)) && FAQ.some(x=>x.q==="How do food suggestions work?"&&/120 common foods/.test(x.a)&&/familiar foods receive a bonus but are not required/.test(x.a)&&/does not call USDA or an AI/.test(x.a))`));
check("v64 suggestion catalog remains precached in the current service worker", (()=>{ const x=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8"); return x.includes('"./data-suggestions.js"') && x.includes('const CACHE = "blackpyre-v64"'); })());
check("v62 keeps primary schemaVersion 2", C62.window.eval("SCHEMA_VERSION")===2);

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
const T54 = boot(V2_CFG, EMPTY_DATA, null, TEST_PROGRAM);
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
const T64 = boot(V2_CFG, EMPTY_DATA, w=>{ w.Date.now=()=>CLOCK64; }, TEST_PROGRAM);
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
  restTimer:JSON.stringify({formatVersion:1,status:"running",endAt:CLOCK64+30000,remainingSec:30,savedAt:CLOCK64})
}, w=>{ w.Date.now=()=>CLOCK64+45000; });
check("v64 an expired timer returns as GO after restart and clears its temporary record", T64Expired.window.eval("restFinished && !restRunning && restRemaining===0") && T64Expired.window.document.getElementById("restDisplay").textContent==="GO!" && T64Expired.window.localStorage.getItem("forge:rest-timer")===null);

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
check("FAQ loads from data-faq.js", P.window.eval("Array.isArray(FAQ) && FAQ.length > 10"));
check("FAQ explains exercise-level Save/Completed/Edit flow", P.window.eval(`FAQ.some(x=>x.q&&/Unsaved, Completed/.test(x.q)&&/Save Exercise/.test(x.a)&&/Log session/.test(x.a))`));
check("FAQ no longer instructs per-set checkmarks", P.window.eval(`!FAQ.some(x=>x.a&&(x.a.includes("tap <b>✓</b>")||x.a.includes("Checking ✓")))`));
check("FAQ states full auto-progression requirements", P.window.eval(`FAQ.some(x=>x.q==="What does '+5 auto' mean?"&&x.a.includes("programmed number of sets")&&x.a.includes("top</b> of a range"))`));
check("FAQ documents food deletion Undo", P.window.eval(`FAQ.some(x=>x.a&&x.a.includes("six-second <b>Undo</b>"))`));
check("FAQ documents protected mode and recovery", P.window.eval(`FAQ.some(x=>x.q==="What are Protected mode and recovery?"&&/last-known-good snapshot/.test(x.a)&&/do not uninstall/.test(x.a))`));
check("FAQ documents the update toast", P.window.eval(`FAQ.some(x=>x.q&&/updates work/.test(x.q)&&/Use it now/.test(x.a)&&/Later/.test(x.a))`));
check("FAQ states the rest timer is manual and Save Exercise never starts it", P.window.eval(`FAQ.some(x=>x.q==="What's plate math and the rest timer?"&&/never starts automatically/.test(x.a)&&/Saving an exercise does not start/.test(x.a)&&x.a.includes("Pause/Resume"))`));
check("v56 FAQ explains durable workout drafts and Resume/Discard", P.window.eval(`FAQ.some(x=>x.q==="How do I log a workout?"&&/workout draft/.test(x.a)&&x.a.includes("Resume")&&x.a.includes("Discard"))`));
check("v56 FAQ documents shared Undo across routine deletions", P.window.eval(`FAQ.some(x=>x.q==="I logged something wrong — can I fix it?"&&/weigh-ins/.test(x.a)&&/measurements/.test(x.a)&&/personal foods/.test(x.a))`));
check("v56 FAQ documents confirmed program replacement", P.window.eval(`FAQ.some(x=>x.q==="How do programs work?"&&/current and incoming names/.test(x.a)&&/workout history stays intact/.test(x.a))`));
check("v56 FAQ documents offline fast-fail and handoff availability", P.window.eval(`FAQ.some(x=>x.q==="What works when BlackPyre says Offline?"&&/immediately shows local matches/.test(x.a)&&/ChatGPT handoff/.test(x.a))`));

check("FAQ uses current program identity and Manage labels", P.window.eval(`FAQ.some(x=>x.q==="How do programs work?"&&x.a.includes("Current program")&&x.a.includes("Manage")&&x.a.includes("Save file")&&x.a.includes("Share"))`));
check("FAQ no longer sends users to the retired Program tools label", P.window.eval(`!FAQ.some(x=>x.a&&x.a.includes("Program tools"))`));
check("FAQ privacy and storage copy distinguish local data, network requests, and approximate usage", P.window.eval(`FAQ.some(x=>x.q==="Where is my data stored? Is it private?"&&/on this device/.test(x.a)&&/Local food suggestions/.test(x.a)&&/Online food searches/.test(x.a)&&/Optional AI features/.test(x.a)) && FAQ.some(x=>x.q==="How much storage is BlackPyre using?"&&/Settings → Data &amp; recovery/.test(x.a)&&/approximate browser-storage/.test(x.a)&&/Back up before clearing/.test(x.a))`));
check("local food search still finds LOCAL_DB entries", P.window.eval(`LOCAL_DB.some(f=>/chicken breast/i.test(f.n))`));
const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
check("SW precaches the four data files", ["data-quotes.js","data-foods.js","data-suggestions.js","data-faq.js"].every(f=>sw.includes('"./'+f+'"')));
check("SW cache name matches the release", /const CACHE = "blackpyre-v\d+"/.test(sw));
check("v64 service-worker cache is bumped", sw.includes('const CACHE = "blackpyre-v64"'));
const rawIndex = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
check("data scripts load before the app scripts (raw file order)",
  ["data-quotes.js","data-foods.js","data-suggestions.js","data-faq.js"].every(f=>
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
const LOCAL_SCRIPTS = ["data-quotes.js","data-foods.js","data-suggestions.js","data-faq.js"].concat(SLICES.map(f=>"scripts/"+f));
check("every local classic script begins with the strict-mode directive",
  LOCAL_SCRIPTS.every(f=>fs.readFileSync(path.join(__dirname, "..", f), "utf8").startsWith('"use strict";')));

const APPROVED_ORDER = LOCAL_SCRIPTS; // data files, then slices 01..07 — this order is load-bearing
const scriptTags = [...rawIndex.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
check("exactly the 11 approved scripts, each exactly once, in the approved order",
  scriptTags.length===11 && scriptTags.every((t,i)=>t[1]===APPROVED_ORDER[i]));
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
  "04-weight.js":"WEIGHT", "05-ai.js":"USDA SEARCH",
  "06-settings.js":"FIRST-RUN SETUP WIZARD", "07-boot.js":"DASH" };
check("every slice opens with strict mode then its expected section marker",
  SLICES.every(f=>{
    const lines = fs.readFileSync(path.join(__dirname, "..", "scripts", f), "utf8").split("\n");
    return lines[0]==='"use strict";' && lines[1].startsWith("// ==") && lines[1].includes(SLICE_OPENERS[f]);
  }));
check("SW update mechanics unchanged (skipWaiting, clients.claim, cache-first shell)",
  sw.includes("skipWaiting()") && sw.includes("clients.claim()") && sw.includes("caches.open(CACHE)"));

// ================= v55: interface simplification, timer consolidation, offline clarity =================
const T55 = boot(V2_CFG, EMPTY_DATA);
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
check("v55 FAQ documents consolidated timer, collapsed sections, and offline behavior",
  T55.window.eval(`FAQ.some(x=>x.q==="What's plate math and the rest timer?"&&/floating timer/.test(x.a)&&/tap the displayed duration/.test(x.a)) && FAQ.some(x=>x.q==="Why are parts of Home and Settings collapsed?") && FAQ.some(x=>x.q==="What works when BlackPyre says Offline?")`));


// ================= v56: persistent drafts, action safety, offline fast-fail =================
const D56 = boot(V2_CFG, V2_DATA, null, TEST_PROGRAM);
const dD56 = D56.window.document;
const wD56=dD56.querySelector('#exerciseInputs input[data-field="weight"]');
const rD56=dD56.querySelector('#exerciseInputs input[data-field="reps"]');
wD56.value="145"; wD56.dispatchEvent(new D56.window.Event("input",{bubbles:true}));
rD56.value="5"; rD56.dispatchEvent(new D56.window.Event("input",{bubbles:true}));
dD56.querySelector("#exerciseInputs .saveExBtn").dispatchEvent(new D56.window.Event("click",{bubbles:true}));
const draft56Raw=D56.window.localStorage.getItem("forge:data");
const draft56=JSON.parse(draft56Raw).activeWorkoutDraft;
check("v56 Save Exercise persists a resumable workout draft", !!draft56 && draft56.day==="D1" && draft56.sets["Bench Press"][0].w===145);
check("v56 saved draft refreshes last-known-good recovery", JSON.parse(JSON.parse(D56.window.localStorage.getItem("forge:lkg")).strings.data).activeWorkoutDraft.sets["Bench Press"][0].w===145);
check("v56 active draft stays out of the way while the workout is already open", dD56.getElementById("workoutDraftCard").classList.contains("hidden"));
const D56Reload=bootRaw({cfg:D56.window.localStorage.getItem("forge:cfg"),data:draft56Raw,program:D56.window.localStorage.getItem("forge:program"),lkg:D56.window.localStorage.getItem("forge:lkg")});
const dD56R=D56Reload.window.document;
check("v56 reload offers Resume or Discard instead of losing saved exercise work", !dD56R.getElementById("workoutDraftCard").classList.contains("hidden") && dD56R.getElementById("resumeWorkoutDraftBtn") && dD56R.getElementById("discardWorkoutDraftBtn"));
dD56R.getElementById("resumeWorkoutDraftBtn").dispatchEvent(new D56Reload.window.Event("click",{bubbles:true}));
check("v56 Resume restores the exercise as Completed", D56Reload.window.eval(`workoutDraftLoaded && sessionState["Bench Press"].status==="saved" && sessionState["Bench Press"].saved[0].w===145`) && /Completed/.test(dD56R.getElementById("exerciseInputs").textContent));
dD56R.getElementById("logWorkoutBtn").dispatchEvent(new D56Reload.window.Event("click",{bubbles:true}));
check("v56 successful Log Session clears the draft and saves history", D56Reload.window.eval(`data.activeWorkoutDraft===null && data.workouts.length===1 && data.workouts[0].sets["Bench Press"][0].w===145`) && JSON.parse(D56Reload.window.localStorage.getItem("forge:data")).activeWorkoutDraft===null);

const D56Fail=bootRaw({cfg:D56.window.localStorage.getItem("forge:cfg"),data:draft56Raw,program:D56.window.localStorage.getItem("forge:program")});
D56Fail.window.document.getElementById("resumeWorkoutDraftBtn").dispatchEvent(new D56Fail.window.Event("click",{bubbles:true}));
const d56Proto=Object.getPrototypeOf(D56Fail.window.localStorage), d56Set=d56Proto.setItem;
d56Proto.setItem=function(k,v){ if(k==="forge:data") throw new Error("blocked"); return d56Set.call(this,k,v); };
D56Fail.window.document.getElementById("logWorkoutBtn").dispatchEvent(new D56Fail.window.Event("click",{bubbles:true}));
d56Proto.setItem=d56Set;
check("v56 failed Log Session preserves the persisted and in-memory draft", D56Fail.window.eval(`data.activeWorkoutDraft!==null && data.workouts.length===0`) && JSON.parse(D56Fail.window.localStorage.getItem("forge:data")).activeWorkoutDraft!==null);
const D56Discard=bootRaw({cfg:D56.window.localStorage.getItem("forge:cfg"),data:draft56Raw,program:D56.window.localStorage.getItem("forge:program")});
D56Discard.window.confirm=()=>true;
D56Discard.window.document.getElementById("discardWorkoutDraftBtn").dispatchEvent(new D56Discard.window.Event("click",{bubbles:true}));
check("v56 confirmed Discard removes the saved draft", D56Discard.window.eval("data.activeWorkoutDraft===null") && JSON.parse(D56Discard.window.localStorage.getItem("forge:data")).activeWorkoutDraft===null);

const deleteDay=dstr(0);
const deleteData={food:{},workouts:[{date:deleteDay,day:"D1",title:"Delete Me",sets:{Squat:[{w:100,r:5}]},notes:""}],weights:[{date:deleteDay,lbs:200}],measure:[{date:deleteDay,waist:36,chest:42,arm:15}],myFoods:{abc:{name:"Saved Food",brand:"Mine",cal100:100,pro100:10,carb100:5,fat100:2}},meals:[{name:"Saved Meal",items:[{name:"Food",cal:100,pro:10,carb:5,fat:2,meal:"other"}]}],meta:{lastBackup:null,logsSince:0},activeWorkoutDraft:null};
deleteData.food[deleteDay]=[{name:"Food Entry",cal:100,pro:10,carb:5,fat:2,meal:"other"}];
const U56=boot(Object.assign({},V2_CFG,{measureOn:true}),deleteData,null,TEST_PROGRAM);
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

const M56=boot(V2_CFG,V2_DATA);
const dM56=M56.window.document;
dM56.getElementById("mCal").value="200";
dM56.getElementById("addManualBtn").dispatchEvent(new M56.window.Event("click",{bubbles:true}));
check("v56 manual food missing a name explains and focuses the name field", dM56.activeElement===dM56.getElementById("mName") && /food name/.test(dM56.getElementById("saveState").textContent));
dM56.getElementById("mName").value="Test food"; dM56.getElementById("mCal").value="";
dM56.getElementById("addManualBtn").dispatchEvent(new M56.window.Event("click",{bubbles:true}));
check("v56 manual food missing calories explains and focuses calories", dM56.activeElement===dM56.getElementById("mCal") && /calories greater than 0/.test(dM56.getElementById("saveState").textContent));

const P56=boot(V2_CFG,Object.assign({},V2_DATA,{workouts:[{date:deleteDay,day:"D1",title:"History",sets:{},notes:""}]}),null,TEST_PROGRAM);
P56.window.confirm=()=>false;
let replace56=P56.window.eval(`replaceActiveProgram({name:"New Program",days:[{id:"N1",title:"New",exercises:[{name:"Squat"}]}]})`);
check("v56 canceling program replacement preserves the active program and history", replace56.cancelled && P56.window.eval("program.name")===TEST_PROGRAM.name && P56.window.eval("data.workouts.length")===1);
P56.window.confirm=()=>true;
replace56=P56.window.eval(`replaceActiveProgram({name:"New Program",days:[{id:"N1",title:"New",exercises:[{name:"Squat"}]}]})`);
check("v56 confirmed program replacement changes only the program", replace56.ok && P56.window.eval("program.name")==="New Program" && P56.window.eval("data.workouts.length")===1);

const O56=boot(Object.assign({},V2_CFG,{usdaKey:"k",anthropicKey:"sk-test",aiProvider:"anthropic"}),V2_DATA,w=>{w.__netCalls=[];w.fetch=(...a)=>{w.__netCalls.push(a);return Promise.reject(new Error("should not fetch"));};});
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
const A57=boot(Object.assign({},V2_CFG,{anthropicKey:"sk-test",aiProvider:"anthropic"}),V2_DATA,null,TEST_PROGRAM);
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
check("v57 errors and save/network messages expose live status semantics", dA57.getElementById("searchErr").getAttribute("role")==="alert" && dA57.getElementById("saveState").getAttribute("role")==="status" && dA57.getElementById("offlineBanner").getAttribute("role")==="status");
A57.window.eval("renderFAQ()");
check("v57 FAQ documents keyboard and screen-reader support", /keyboard or screen reader/i.test(dA57.getElementById("faqBody").textContent));


// ================= v63: missing-primary protection and rolling recovery =================
const V63_POPULATED_DATA = Object.assign({}, V2_DATA, {
  food:{"2026-07-20":[{name:"Chicken",cal:165,pro:31,carb:0,fat:3.6,meal:"dinner"}]},
  workouts:[{date:"2026-07-20",day:"D1",sets:{"Bench Press":[{w:185,r:5}]}}],
  weights:[{date:"2026-07-20",lbs:220}]
});
function makeV63Lkg(dataObj,savedAt){
  return JSON.stringify({recoveryFormatVersion:1,savedAt:savedAt||"2026-07-20T12:00:00.000Z",source:"v63-test",
    strings:{cfg:RAW_V2_CFG,data:JSON.stringify(dataObj),program:RAW_PROGRAM},legacyData:null});
}
const V63_POP_LKG = makeV63Lkg(V63_POPULATED_DATA);
const V63_EMPTY_LKG = makeV63Lkg(V2_DATA,"2026-07-21T12:00:00.000Z");

const Fresh63=bootRaw({});
check("v63 fresh boot persists all three primary keys", ["forge:cfg","forge:data","forge:program"].every(k=>Fresh63.window.localStorage.getItem(k)!==null));
check("v63 fresh boot establishes recovery marker and snapshot", Fresh63.window.eval(`installMarkerStatus().ok && inspectLkgRaw(localStorage.getItem("forge:lkg")).ok`));

const V63_NEWER_INSTALL = JSON.stringify({formatVersion:2,establishedAt:"future",lastHealthyAt:"future",schemaVersion:99});
const NewerInstall63=bootRaw({install:V63_NEWER_INSTALL});
check("v63 newer installation markers are preserved and cannot be mistaken for a fresh install", NewerInstall63.window.eval(`protectedMode && installMarkerStatus().newer`) && NewerInstall63.window.localStorage.getItem("forge:install")===V63_NEWER_INSTALL && NewerInstall63.window.localStorage.getItem("forge:data")===null);

const MissingData63=bootRaw({cfg:RAW_V2_CFG,program:RAW_PROGRAM,lkg:V63_POP_LKG});
check("v63 missing logs on an established install enters protected mode", MissingData63.window.eval(`protectedMode && protectedModeDiagnostic.stage==="missing-primary" && protectedModeDiagnostic.part==="data"`));
check("v63 missing-log protected view loads the validated snapshot", MissingData63.window.eval(`data.weights.length===1 && data.food["2026-07-20"].length===1`));
check("v63 missing logs are never silently recreated or allowed to replace LKG", MissingData63.window.localStorage.getItem("forge:data")===null && MissingData63.window.localStorage.getItem("forge:lkg")===V63_POP_LKG && callsFor(MissingData63,"forge:lkg").length===0);
check("v63 missing-primary recovery disables the destructive readable reset", MissingData63.window.document.getElementById("recoverReadableBtn").disabled===true && MissingData63.window.document.getElementById("recoverLkgBtn").disabled===false);

const MissingCfg63=bootRaw({data:JSON.stringify(V63_POPULATED_DATA),program:RAW_PROGRAM,lkg:V63_POP_LKG});
check("v63 missing settings on an established install enters protected mode", MissingCfg63.window.eval(`protectedMode && protectedModeDiagnostic.stage==="missing-primary" && protectedModeDiagnostic.part==="cfg"`));
check("v63 missing-settings protected view uses snapshot settings without writing defaults", MissingCfg63.window.eval(`cfg.calTarget===1800`) && MissingCfg63.window.localStorage.getItem("forge:cfg")===null);

const AllMissing63=bootRaw({lkg:V63_POP_LKG});
check("v63 all-primary-keys-missing incident remains recoverable", AllMissing63.window.eval(`protectedMode && data.weights.length===1 && cfg.calTarget===1800 && program.name==="Test Program"`));

const PreviousWins63=bootRaw({cfg:RAW_V2_CFG,program:RAW_PROGRAM,lkg:V63_EMPTY_LKG,lkgPrevious:V63_POP_LKG});
check("v63 populated previous snapshot outranks a newer empty current snapshot", PreviousWins63.window.eval(`getBestStoredLkgStatus().key===LKG_PREVIOUS_KEY && data.weights.length===1`));
check("v63 recovery summary reports multiple validated snapshots", /best of 2 validated snapshots/.test(PreviousWins63.window.eval(`buildLkgRecoveryCandidate().summary`)));

const EmptyRegression63=bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:V63_POP_LKG});
check("v63 present-but-empty regression cannot replace a populated snapshot", EmptyRegression63.window.localStorage.getItem("forge:lkg")===V63_POP_LKG && EmptyRegression63.window.eval(`lkgStatus.retained===true`));

const Old63=makeV63Lkg(Object.assign({},V63_POPULATED_DATA,{weights:[{date:"2026-07-19",lbs:221}]}),"2026-07-19T12:00:00.000Z");
const Rotate63=bootRaw({cfg:RAW_V2_CFG,data:JSON.stringify(V63_POPULATED_DATA),program:RAW_PROGRAM,lkg:Old63});
check("v63 healthy snapshot refresh rotates prior current into previous", Rotate63.window.localStorage.getItem("forge:lkg:previous")===Old63 && Rotate63.window.localStorage.getItem("forge:lkg")!==Old63);
const firstCurrent63=Rotate63.window.localStorage.getItem("forge:lkg");
Rotate63.window.eval(`data.weights.push({date:"2026-07-21",lbs:219}); save();`);
check("v63 second healthy snapshot keeps two rolling generations", Rotate63.window.localStorage.getItem("forge:lkg:previous")===firstCurrent63 && Rotate63.window.localStorage.getItem("forge:lkg:older")===Old63);

const RuntimeLoss63=bootRaw({cfg:RAW_V2_CFG,data:JSON.stringify(V63_POPULATED_DATA),program:RAW_PROGRAM});
const runtimeLkg63=RuntimeLoss63.window.localStorage.getItem("forge:lkg");
RuntimeLoss63.window.eval(`localStorage.removeItem(DATA_KEY); save();`);
check("v63 runtime disappearance pauses all later saving", RuntimeLoss63.window.eval(`protectedMode && protectedModeDiagnostic.part==="data"`));
check("v63 runtime disappearance leaves recovery snapshot byte-identical", RuntimeLoss63.window.localStorage.getItem("forge:lkg")===runtimeLkg63);

const ManualRestore63=bootRaw({cfg:RAW_V2_CFG,data:RAW_V2_DATA,program:RAW_PROGRAM,lkg:V63_POP_LKG});
const manualBefore63=ManualRestore63.window.localStorage.getItem("forge:data");
const manualResult63=ManualRestore63.window.eval(`performRecoveryCandidate(buildLkgRecoveryCandidate(),{allowNormalRestore:true})`);
check("v63 normal-mode snapshot restore is verified and reaffirms the established install", manualResult63.ok && ManualRestore63.window.eval(`data.weights.length===1 && installMarkerStatus().ok`));
check("v63 normal-mode snapshot restore quarantines exact prior primary data", JSON.parse(ManualRestore63.window.localStorage.getItem("forge:quarantine")).originals.data===manualBefore63);

const diagnostic63=ManualRestore63.window.eval(`makeStorageDiagnosticEnvelope()`);
check("v64 diagnostic export preserves primary, recovery, install, and temporary timer fields", diagnostic63.ok && ["forge:cfg","forge:data","forge:program","forge:lkg","forge:lkg:previous","forge:lkg:older","forge:quarantine","forge:install","forge:rest-timer"].every(k=>Object.prototype.hasOwnProperty.call(diagnostic63.envelope.strings,k)));
check("v63 Data & recovery exposes manual snapshot restore and diagnostic export", !!ManualRestore63.window.document.getElementById("restoreSnapshotBtn") && !!ManualRestore63.window.document.getElementById("exportDiagnosticBtn"));
check("v63 FAQ explains missing-key protection and rolling snapshots", ManualRestore63.window.eval(`FAQ.some(x=>x.q==="What happens if saved data unexpectedly disappears?"&&/saving is paused/i.test(x.a)&&/rolling/i.test(x.a))`));

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

summary("INTEGRATION");
})().catch(e=>{ console.error(e); process.exit(1); });
