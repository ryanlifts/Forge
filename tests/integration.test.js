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
const TEST_PROGRAM = {name:"Test Program",author:"Suite",days:[{id:"D1",title:"Day 1",exercises:[{name:"Bench Press",scheme:"3×5"}]}]};
const RAW_V1_CFG = JSON.stringify(V1_CFG);
const RAW_DATA = JSON.stringify(EMPTY_DATA);
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
check("fresh install stamps schemaVersion 1", JSON.parse(Fresh45.window.localStorage.getItem("forge:cfg")).schemaVersion===1);
check("fresh install writes only stamped settings", freshCalls.length===1 && freshCalls[0].method==="setItem" && freshCalls[0].key==="forge:cfg");
const rawV44Cfg = JSON.stringify(Object.assign({},EXISTING_CFG,{futureField:"survives"}));
let H45 = bootRaw({cfg:rawV44Cfg,data:RAW_DATA,program:RAW_PROGRAM});
const h45Calls = sacredCalls(H45);
check("v44-shaped install gains only the schema stamp", h45Calls.length===1 && h45Calls[0].key==="forge:cfg" && JSON.parse(h45Calls[0].value).schemaVersion===1);
check("healthy migration leaves logs and program byte-identical", H45.window.localStorage.getItem("forge:data")===RAW_DATA && H45.window.localStorage.getItem("forge:program")===RAW_PROGRAM);
check("unknown settings fields survive migration", H45.window.eval("cfg.futureField")==="survives");
let H45b = bootRaw(sacredBytes(H45));
check("second boot performs zero sacred-key writes", zeroSacredWrites(H45b));

// Real restore path: shared preparation, AI presence semantics, partial envelopes.
let R45 = boot(V1_CFG, EMPTY_DATA, null, TEST_PROGRAM);
R45.window.eval(`cfg.anthropicKey="sk-device"; cfg.aiProvider="anthropic"; saveCfg();`);
R45.__storageCalls.length=0;
const beforeRangeData = R45.window.localStorage.getItem("forge:data");
const beforeRangeProgram = R45.window.localStorage.getItem("forge:program");
const rangeCfg = Object.assign({},EXISTING_CFG,{calLo:1500,calHi:1700,proLo:160,proHi:180});
delete rangeCfg.calTarget; delete rangeCfg.proTarget;
let restoreResult = R45.window.eval(`restoreBackupEnvelope({cfg:${JSON.stringify(rangeCfg)}})`);
check("range-era backup restores through shared pipeline", restoreResult.ok && R45.window.eval("cfg.calTarget")===1600 && R45.window.eval("cfg.proTarget")===170);
check("restore preserves absent device AI fields", R45.window.eval("cfg.anthropicKey")==="sk-device" && R45.window.eval("cfg.aiProvider")==="anthropic");
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
check("next boot heals an unstamped interrupted commit", Healed45.window.eval("protectedMode")===false && Healed45.window.eval("cfg.schemaVersion")===1 && Healed45.window.eval("cfg.calTarget")===1600);

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
let H46 = bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:RAW_PROGRAM});
let h46LkgRaw = H46.window.localStorage.getItem("forge:lkg");
let h46Lkg = JSON.parse(h46LkgRaw);
check("v46 healthy boot keeps primary schemaVersion 1", H46.window.eval("cfg.schemaVersion")===1 && JSON.parse(H46.window.localStorage.getItem("forge:cfg")).schemaVersion===1);
check("v46 healthy boot creates a format-1 whole-state LKG", h46Lkg.recoveryFormatVersion===1 && ["cfg","data","program"].every(k=>typeof h46Lkg.strings[k]==="string"));
check("creating LKG does not rewrite unchanged primary keys", sacredCalls(H46).length===0 && callsFor(H46,"forge:lkg").length===1);
check("LKG final strings pass the shared prepare pipeline", H46.window.eval(`inspectLkgRaw(${JSON.stringify(h46LkgRaw)}).ok`)===true);
let H46b = bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
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
let LkgFail = bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
const lkgFailBefore = LkgFail.window.localStorage.getItem("forge:lkg");
const lfProto = Object.getPrototypeOf(LkgFail.window.localStorage), lfSpySet=lfProto.setItem;
lfProto.setItem=function(k,v){ if(k==="forge:lkg") throw new Error("snapshot denied"); return lfSpySet.call(this,k,v); };
const lkgFailSave = LkgFail.window.eval(`data.weights.push({date:"2026-07-14",lbs:216}); save()`);
lfProto.setItem=lfSpySet;
check("LKG write failure leaves primary save successful", lkgFailSave===true && JSON.parse(LkgFail.window.localStorage.getItem("forge:data")).weights[0].lbs===216);
check("LKG write failure leaves previous snapshot intact and reports unavailable", LkgFail.window.localStorage.getItem("forge:lkg")===lkgFailBefore && LkgFail.window.eval("lkgStatus.state")==="unavailable");
let LkgVerifyFail=bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:RAW_PROGRAM,lkg:lkgFailBefore});
const lvProto=Object.getPrototypeOf(LkgVerifyFail.window.localStorage), lvSet=lvProto.setItem, lvGet=lvProto.getItem;
let lvWrote=false, lvMismatch=false;
lvProto.setItem=function(k,v){ const out=lvSet.call(this,k,v); if(k==="forge:lkg") lvWrote=true; return out; };
lvProto.getItem=function(k){ if(k==="forge:lkg" && lvWrote && !lvMismatch){ lvMismatch=true; return "{mismatch"; } return lvGet.call(this,k); };
LkgVerifyFail.window.eval(`data.weights=[{date:"2026-07-14",lbs:214}]; save();`);
lvProto.setItem=lvSet; lvProto.getItem=lvGet;
check("LKG verification failure rolls back to the previous snapshot", LkgVerifyFail.window.localStorage.getItem("forge:lkg")===lkgFailBefore && JSON.parse(LkgVerifyFail.window.localStorage.getItem("forge:data")).weights[0].lbs===214);

// A quota-caused primary failure may sacrifice LKG once, never quarantine.
const quotaQuarantine = validQuarantineRaw({cfg:"old",data:"old",program:"old",legacyData:null});
let Quota46 = bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw,quarantine:quotaQuarantine});
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
let BadLkg = bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:RAW_PROGRAM,lkg:"{broken"});
check("malformed LKG never protects healthy live data", BadLkg.window.eval("protectedMode")===false);
check("malformed LKG is rebuilt as a valid snapshot", BadLkg.window.eval(`inspectLkgRaw(localStorage.getItem("forge:lkg")).ok`)===true && callsFor(BadLkg,"forge:lkg").some(c=>c.method==="setItem"));
const newerLkgRaw=JSON.stringify({recoveryFormatVersion:99,savedAt:"future",strings:{}});
let NewLkg = bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:RAW_PROGRAM,lkg:newerLkgRaw});
check("newer-format LKG is not used or overwritten", NewLkg.window.eval("protectedMode")===false && NewLkg.window.localStorage.getItem("forge:lkg")===newerLkgRaw && NewLkg.window.eval("lkgStatus.state")==="newer" && callsFor(NewLkg,"forge:lkg").length===0);
const newerStateLkgRaw=JSON.stringify({recoveryFormatVersion:1,savedAt:"future",strings:{cfg:JSON.stringify({schemaVersion:99}),data:RAW_DATA,program:RAW_PROGRAM},legacyData:null});
let NewStateLkg=bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:RAW_PROGRAM,lkg:newerStateLkgRaw});
check("LKG carrying newer primary schema is not overwritten", NewStateLkg.window.localStorage.getItem("forge:lkg")===newerStateLkgRaw && NewStateLkg.window.eval("lkgStatus.state")==="newer" && callsFor(NewStateLkg,"forge:lkg").length===0);

// Protected boot diagnoses exact area, shows recovery before gates, and never refreshes LKG.
let DiagCfg = bootRaw({cfg:"{broken",data:RAW_DATA,program:RAW_PROGRAM,lkg:h46LkgRaw});
check("v46 diagnosis identifies corrupt settings", DiagCfg.window.eval(`protectedModeDiagnostic.stage+":"+protectedModeDiagnostic.part`)==="parse:cfg");
check("corruption recovery panel appears before gates", !DiagCfg.window.document.getElementById("recoveryOverlay").classList.contains("hidden") && DiagCfg.window.document.getElementById("disclaimerOverlay").classList.contains("hidden") && DiagCfg.window.document.getElementById("setupOverlay").classList.contains("hidden"));
check("protected boot never refreshes or replaces LKG", DiagCfg.window.localStorage.getItem("forge:lkg")===h46LkgRaw && callsFor(DiagCfg,"forge:lkg").length===0);
let DiagData=bootRaw({cfg:RAW_V1_CFG,data:"{broken",program:RAW_PROGRAM,lkg:h46LkgRaw});
let DiagProgram=bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:"{broken",lkg:h46LkgRaw});
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
let StorageRead46=bootRaw({cfg:RAW_V1_CFG,data:RAW_DATA,program:RAW_PROGRAM},w=>{
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
const T49 = boot(V1_CFG, {food:{},workouts:[priorWorkout],weights:[],meta:{lastBackup:null,logsSince:0}}, null, TEST_PROGRAM);
const dT49 = T49.window.document;
const clickT49 = el=>(typeof el==="string"?dT49.getElementById(el):el).dispatchEvent(new T49.window.Event("click",{bubbles:true}));
const plannedRows = [...dT49.querySelectorAll("#exerciseInputs .srow")];
check("previous workout values prefill as an unchecked plan", plannedRows.length===3 && plannedRows.every(r=>!r.querySelector(".sdone").classList.contains("on")) && plannedRows[0].querySelector('input[data-field="weight"]').value==="105");
clickT49("logWorkoutBtn");
check("untouched prefilled workout cannot create history", T49.window.eval("data.workouts.length")===1);
check("empty workout attempt explains the completion requirement", !dT49.getElementById("workoutErr").classList.contains("hidden") && /Mark at least one set complete/.test(dT49.getElementById("workoutErr").textContent));
clickT49(plannedRows[0].querySelector(".sdone"));
clickT49("logWorkoutBtn");
check("logging saves only the genuinely completed set", T49.window.eval(`data.workouts.length===2 && data.workouts[1].sets["Bench Press"].length===1 && data.workouts[1].sets["Bench Press"][0].w===105`));
check("partial completed history cannot trigger false progression next time", T49.window.eval(`sessionState["Bench Press"].auto===false && sessionState["Bench Press"].rows.length===1 && sessionState["Bench Press"].rows[0].w===105`));

const T49Invalid = boot(V1_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT49Invalid = T49Invalid.window.document;
dT49Invalid.querySelector("#exerciseInputs .sdone").dispatchEvent(new T49Invalid.window.Event("click",{bubbles:true}));
dT49Invalid.getElementById("logWorkoutBtn").dispatchEvent(new T49Invalid.window.Event("click",{bubbles:true}));
check("checked set missing weight is refused", T49Invalid.window.eval("data.workouts.length")===0);
check("invalid completed set identifies the missing weight/reps row", /Bench Press.*weight and reps.*Set 1/.test(dT49Invalid.getElementById("workoutErr").textContent));
T49Invalid.window.confirm=()=>true;
dT49Invalid.getElementById("wDay").value="__CARDIO__";
dT49Invalid.getElementById("wDay").dispatchEvent(new T49Invalid.window.Event("change",{bubbles:true}));
dT49Invalid.getElementById("logWorkoutBtn").dispatchEvent(new T49Invalid.window.Event("click",{bubbles:true}));
check("cardio without minutes is refused with an explanation", T49Invalid.window.eval("data.workouts.length")===0 && /Enter cardio minutes/.test(dT49Invalid.getElementById("workoutErr").textContent));

const T49Switch = boot(V1_CFG, EMPTY_DATA, null, TEST_PROGRAM);
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

// ================= Phase 1: extracted data payloads =================
const P = boot(EXISTING_CFG, EMPTY_DATA);
check("QUOTES loads from data-quotes.js", P.window.eval("Array.isArray(QUOTES) && QUOTES.length > 100"));
check("LOCAL_DB loads from data-foods.js", P.window.eval("Array.isArray(LOCAL_DB) && LOCAL_DB.length > 100"));
check("ALT_MAP loads from data-foods.js", P.window.eval("typeof ALT_MAP==='object' && Object.keys(ALT_MAP).length > 10"));
check("FAQ loads from data-faq.js", P.window.eval("Array.isArray(FAQ) && FAQ.length > 10"));
check("local food search still finds LOCAL_DB entries", P.window.eval(`LOCAL_DB.some(f=>/chicken breast/i.test(f.n))`));
const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
check("SW precaches the three data files", ["data-quotes.js","data-foods.js","data-faq.js"].every(f=>sw.includes('"./'+f+'"')));
check("SW cache name matches the release", /const CACHE = "blackpyre-v\d+"/.test(sw));
const rawIndex = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
check("data scripts load before the app scripts (raw file order)",
  ["data-quotes.js","data-foods.js","data-faq.js"].every(f=>
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
const LOCAL_SCRIPTS = ["data-quotes.js","data-foods.js","data-faq.js"].concat(SLICES.map(f=>"scripts/"+f));
check("every local classic script begins with the strict-mode directive",
  LOCAL_SCRIPTS.every(f=>fs.readFileSync(path.join(__dirname, "..", f), "utf8").startsWith('"use strict";')));

const APPROVED_ORDER = LOCAL_SCRIPTS; // data files, then slices 01..07 — this order is load-bearing
const scriptTags = [...rawIndex.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
check("exactly the 10 approved scripts, each exactly once, in the approved order",
  scriptTags.length===10 && scriptTags.every((t,i)=>t[1]===APPROVED_ORDER[i]));
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
