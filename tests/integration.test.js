// BlackPyre permanent integration suite — boots the shipped app and exercises whole flows.
const { boot, bootRaw, assembleHTML, sacredCalls, allBlackPyreCalls, check, summary, dstr, wait, EXISTING_CFG, EMPTY_DATA } = require("./harness");
const fs = require("fs");
const path = require("path");
const v8 = require("v8");
const vm = require("vm");

v8.setFlagsFromString("--expose-gc");
const collectTestGarbage = vm.runInNewContext("gc");

function releaseTestWindows(instances){
  instances.forEach(instance=>{
    if(!instance)return;
    const active=instance.window;
    if(active && typeof active.close==="function")active.close();
  });
  collectTestGarbage();
}

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
const dynamicIds = new Set(["barcodeCorrectionStatus","barcodeCorrectionServing","barcodeCorrectionNutrition","barcodeCorrectionSource","addExCustomShape"]);
const missing = refs.filter(id=>!id.startsWith("su") && !dynamicIds.has(id) && !dA.getElementById(id));
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
check("web backup actions use distinct platform-appropriate labels and honest destinations",
  B.window.document.getElementById("exportDataBtn").textContent==="SAVE BACKUP"
  && B.window.document.getElementById("shareDataBtn").textContent==="SAVE BACKUP ELSEWHERE…"
  && /configured Downloads location/.test(B.window.document.getElementById("exportDataBtn").parentElement.textContent)
  && /Safari’s Downloads location/.test(B.window.document.getElementById("exportDataBtn").parentElement.textContent)
  && /browser’s Downloads/.test(B.window.document.getElementById("exportDataBtn").parentElement.textContent)
  && !/On My iPhone\s*→\s*BlackPyre/.test(B.window.document.getElementById("exportDataBtn").parentElement.textContent));


B.window.eval(`cfg.anthropicKey="sk-test-A"; cfg.openaiKey="sk-test-O"; cfg.usdaKey="usda-keep"; cfg.aiProvider="anthropic"; saveCfg();
window.__dl=null; download=(n,c)=>{window.__dl=c;}; doBackup("exportDataBtn",false);`);
check("normal backup excludes Anthropic, OpenAI, and legacy USDA keys",
  !B.window.eval("window.__dl").includes("sk-test-A")
  && !B.window.eval("window.__dl").includes("sk-test-O")
  && !B.window.eval("window.__dl").includes("usda-keep"));
check("downloaded normal backup passes the existing restore-envelope verifier",
  B.window.eval(`prepareRecoveryBackupEnvelope(JSON.parse(window.__dl)).ok`)===true);
B.window.eval(`
  const b = JSON.parse(window.__dl);
  delete b.cfg.calTarget; delete b.cfg.proTarget; b.cfg.calLo=1500; b.cfg.calHi=1700; b.cfg.proLo=160; b.cfg.proHi=180;
  migrateTargets(b.cfg);
  cfg = Object.assign({}, DEFAULT_CFG, b.cfg); migrateCfg(); saveCfg();
`);
check("old-range backup restores + migrates", B.window.eval("cfg.calTarget")===1600);
check("restore cannot revive retired direct-AI credentials", B.window.eval("cfg.anthropicKey")===undefined && B.window.eval("cfg.openaiKey")===undefined && B.window.eval("cfg.aiProvider")===undefined);

// ================= v45: schemaVersion & protected migrations =================
const V1_CFG = Object.assign({}, EXISTING_CFG, {schemaVersion:1});
const V2_CFG = Object.assign({}, EXISTING_CFG, {schemaVersion:3});
const V2_DATA = Object.assign({}, EMPTY_DATA, {myExercises:{},activeWorkoutDraft:null});
const TEST_PROGRAM = {name:"Test Program",author:"Suite",days:[{id:"D1",title:"Day 1",exercises:[{name:"Bench Press",scheme:"3×5"}]}]};
const RAW_V1_CFG = JSON.stringify(V1_CFG);
const RAW_V2_CFG = JSON.stringify(V2_CFG);
const RAW_DATA = JSON.stringify(EMPTY_DATA);
const RAW_V2_DATA = JSON.stringify(V2_DATA);
const RAW_PROGRAM = JSON.stringify(TEST_PROGRAM);

// ================= elapsed-time web backup reminder =================
const backupOldEstablishedAt =
  new Date(Date.now()-15*86400000).toISOString();
const backupOldFirstLogAt =
  new Date(Date.now()-8*86400000).toISOString();
const backupOldInstall = JSON.stringify({
  formatVersion:1,
  establishedAt:backupOldEstablishedAt,
  lastHealthyAt:backupOldEstablishedAt,
  schemaVersion:3
});
const backupReminderSeed = Object.assign({},V2_DATA,{
  meta:{lastBackup:null,logsSince:1,firstMeaningfulLogAt:backupOldFirstLogAt}
});

const FreshBackupReminder = bootRaw({
  cfg:RAW_V2_CFG,
  data:JSON.stringify(Object.assign({},EMPTY_DATA,{meta:{lastBackup:null,logsSince:0}})),
  program:RAW_PROGRAM,
  install:backupOldInstall
});
const dFreshBackupReminder = FreshBackupReminder.window.document;
check("finishing onboarding does not immediately show a backup reminder",
  dFreshBackupReminder.getElementById("backupCard").classList.contains("hidden"));
FreshBackupReminder.window.eval(`bumpLog(); renderBackup();`);
check("the first meaningful log starts the seven-day reminder clock without showing the card",
  !!FreshBackupReminder.window.eval("data.meta.firstMeaningfulLogAt")
  && dFreshBackupReminder.getElementById("backupCard").classList.contains("hidden"));

const BackupReminder = bootRaw({
  cfg:RAW_V2_CFG,
  data:JSON.stringify(backupReminderSeed),
  program:RAW_PROGRAM,
  install:backupOldInstall
});
const dBackupReminder = BackupReminder.window.document;

check("web backup reminder becomes due seven days after the first meaningful log",
  !dBackupReminder.getElementById("backupCard").classList.contains("hidden")
  && BackupReminder.window.eval("data.meta.logsSince")===1);

dBackupReminder.getElementById("backupLaterBtn").dispatchEvent(
  new BackupReminder.window.Event("click",{bubbles:true})
);
check("Remind me later stores a future snooze and hides the reminder",
  Date.parse(BackupReminder.window.eval("data.meta.backupReminderSnoozedUntil"))>Date.now()+6*86400000
  && dBackupReminder.getElementById("backupCard").classList.contains("hidden")
  && !dBackupReminder.getElementById("backupStatusToast").classList.contains("hidden")
  && dBackupReminder.getElementById("backupStatusToast").textContent==="Backup reminder postponed for 7 days.");

BackupReminder.window.eval(`
  data.meta.backupReminderSnoozedUntil =
    new Date(Date.now()-1000).toISOString();
  save();
  renderBackup();
`);
check("expired backup snooze allows the elapsed-time reminder to return",
  !dBackupReminder.getElementById("backupCard").classList.contains("hidden"));

BackupReminder.window.eval(`
  cfg.anthropicKey="secret-anthropic";
  cfg.openaiKey="secret-openai";
  cfg.usdaKey="keep-usda";
  saveCfg();
  window.__backupDownload=null;
  window.__backupMessage=null;
  download=(name,text)=>{window.__backupDownload={name,text};};
  flashSave=(message,bad)=>{window.__backupMessage={message,bad};};
  doBackup("exportDataBtn",false);
`);
const browserDownloadBackup =
  JSON.parse(BackupReminder.window.eval("window.__backupDownload.text"));

check("browser download records an attempt without inventing a completed browser action",
  !!BackupReminder.window.eval("data.meta.lastBackupAttemptAt")
  && BackupReminder.window.eval("data.meta.lastBackupAttemptKind")==="download"
  && !BackupReminder.window.eval("data.meta.lastBackupCompletedAt"));

check("browser backup download strips legacy USDA and private AI keys and uses honest ready language",
  browserDownloadBackup.cfg.usdaKey===undefined
  && browserDownloadBackup.cfg.anthropicKey===undefined
  && browserDownloadBackup.cfg.openaiKey===undefined
  && BackupReminder.window.eval("window.__backupMessage.message")==="Verified backup download started. Check your browser or device's Downloads location."
  && BackupReminder.window.eval(`prepareRecoveryBackupEnvelope(JSON.parse(window.__backupDownload.text)).ok`)===true);

BackupReminder.window.eval(`window.__backupDownload=null; window.__backupMessage=null;`);
const unsupportedShareResult = await BackupReminder.window.eval(`doBackup("shareDataBtn",true)`);
check("unsupported file sharing safely falls back to the same verified download",
  unsupportedShareResult===true
  && !!BackupReminder.window.__backupDownload
  && BackupReminder.window.eval("data.meta.lastBackupAttemptKind")==="download"
  && BackupReminder.window.eval(`prepareRecoveryBackupEnvelope(JSON.parse(window.__backupDownload.text)).ok`)===true
  && /^Sharing was unavailable, so a verified backup download started/.test(
    BackupReminder.window.eval("window.__backupMessage.message")
  ));

const ShareBackup = bootRaw({
  cfg:RAW_V2_CFG,
  data:JSON.stringify(backupReminderSeed),
  program:RAW_PROGRAM,
  install:backupOldInstall
},w=>{
  Object.defineProperty(w.navigator,"canShare",{
    configurable:true,
    value:payload=>!!(payload&&payload.files&&payload.files.length===1)
  });
  Object.defineProperty(w.navigator,"share",{
    configurable:true,
    value:async payload=>{w.__sharedBackup=payload;}
  });
});
ShareBackup.window.eval(`
  window.__backupMessage=null;
  window.__backupDownload=null;
  download=(name,text)=>{window.__backupDownload={name,text};};
  flashSave=(message,bad)=>{window.__backupMessage={message,bad};};
`);
await ShareBackup.window.eval(`doBackup("exportDataBtn",false)`);

check("BACK UP ON THIS DEVICE never opens Web Share even when file sharing is supported",
  typeof ShareBackup.window.__sharedBackup==="undefined"
  && !!ShareBackup.window.__backupDownload
  && ShareBackup.window.eval(`prepareRecoveryBackupEnvelope(JSON.parse(window.__backupDownload.text)).ok`)===true);

ShareBackup.window.eval(`window.__backupDownload=null; window.__backupMessage=null;`);
await ShareBackup.window.eval(`doBackup("shareDataBtn",true)`);

check("resolved Web Share records attempt and completed browser activity separately",
  ShareBackup.window.eval("data.meta.lastBackupAttemptKind")==="share"
  && !!ShareBackup.window.eval("data.meta.lastBackupAttemptAt")
  && ShareBackup.window.eval("data.meta.lastBackupCompletedKind")==="share"
  && !!ShareBackup.window.eval("data.meta.lastBackupCompletedAt")
  && /blackpyre-backup-/.test(ShareBackup.window.__sharedBackup.files[0].name));

check("resolved Web Share still uses non-durability backup language",
  ShareBackup.window.eval("window.__backupMessage.message")==="Backup ready. Confirm where you saved or shared the file."
  && /does not guarantee durable or offsite storage/.test(
    ShareBackup.window.document.getElementById("backupMetaLine").textContent
  ));

const FailedShareBackup = bootRaw({
  cfg:RAW_V2_CFG,
  data:JSON.stringify(backupReminderSeed),
  program:RAW_PROGRAM,
  install:backupOldInstall
},w=>{
  Object.defineProperty(w.navigator,"canShare",{configurable:true,value:()=>true});
  Object.defineProperty(w.navigator,"share",{
    configurable:true,
    value:async ()=>{throw new Error("Share service unavailable");}
  });
});
FailedShareBackup.window.eval(`
  window.__backupDownload=null;
  window.__backupMessage=null;
  download=(name,text)=>{window.__backupDownload={name,text};};
  flashSave=(message,bad)=>{window.__backupMessage={message,bad};};
`);
const failedShareResult = await FailedShareBackup.window.eval(`doBackup("shareDataBtn",true)`);
check("failed file sharing safely falls back to a verified download",
  failedShareResult===true
  && !!FailedShareBackup.window.__backupDownload
  && FailedShareBackup.window.eval("data.meta.lastBackupAttemptKind")==="download"
  && FailedShareBackup.window.eval(`prepareRecoveryBackupEnvelope(JSON.parse(window.__backupDownload.text)).ok`)===true
  && /^Sharing was unavailable, so a verified backup download started/.test(
    FailedShareBackup.window.eval("window.__backupMessage.message")
  ));

const CancelBackup = bootRaw({
  cfg:RAW_V2_CFG,
  data:JSON.stringify(Object.assign({},backupReminderSeed,{
    food:{[dstr(0)]:[{name:"Existing food",cal:100,pro:10,carb:10,fat:2,meal:"lunch"}]}
  })),
  program:RAW_PROGRAM,
  install:backupOldInstall
},w=>{
  Object.defineProperty(w.navigator,"canShare",{
    configurable:true,
    value:()=>true
  });
  Object.defineProperty(w.navigator,"share",{
    configurable:true,
    value:async ()=>{
      const error=new Error("Canceled");
      error.name="AbortError";
      throw error;
    }
  });
});
CancelBackup.window.eval(`
  window.__backupMessage=null;
  window.__backupDownload=null;
  download=(name,text)=>{window.__backupDownload={name,text};};
  flashSave=(message,bad)=>{window.__backupMessage={message,bad};};
`);
const cancelFoodBefore =
  CancelBackup.window.eval("JSON.stringify(data.food)");
await CancelBackup.window.eval(`doBackup("shareDataBtn",true)`);

check("canceled Web Share records only the attempt and does not imply data loss",
  CancelBackup.window.eval("data.meta.lastBackupAttemptKind")==="share"
  && !!CancelBackup.window.eval("data.meta.lastBackupAttemptAt")
  && !CancelBackup.window.eval("data.meta.lastBackupCompletedAt")
  && CancelBackup.window.eval("JSON.stringify(data.food)")===cancelFoodBefore
  && /canceled/.test(CancelBackup.window.eval("window.__backupMessage.message"))
  && /existing logs and settings are unchanged/.test(
    CancelBackup.window.eval("window.__backupMessage.message")
  )
  && CancelBackup.window.__backupDownload===null
  && !CancelBackup.window.document
    .getElementById("backupCard").classList.contains("hidden"));

const FailedVerificationBackup = bootRaw({
  cfg:RAW_V2_CFG,
  data:JSON.stringify(backupReminderSeed),
  program:RAW_PROGRAM,
  install:backupOldInstall
});
FailedVerificationBackup.window.eval(`
  window.__backupDownload=null;
  window.__backupMessage=null;
  download=(name,text)=>{window.__backupDownload={name,text};};
  flashSave=(message,bad)=>{window.__backupMessage={message,bad};};
  prepareRecoveryBackupEnvelope=()=>({ok:false,reason:"Verification rejected"});
`);
const failedVerificationResult = await FailedVerificationBackup.window.eval(`doBackup("exportDataBtn",false)`);
check("verification failure stops the download and reports a safe failure",
  failedVerificationResult===false
  && FailedVerificationBackup.window.__backupDownload===null
  && !FailedVerificationBackup.window.eval("data.meta.lastBackupAttemptAt")
  && FailedVerificationBackup.window.eval("window.__backupMessage.bad")===true
  && /could not be created/.test(FailedVerificationBackup.window.eval("window.__backupMessage.message")));

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
check("legacy-shaped install adds draft and exercise state then stamps schema 3", h45Calls.length===2 && h45Calls.map(c=>c.key).join(",")==="forge:data,forge:cfg" && JSON.parse(h45Calls[1].value).schemaVersion===3 && JSON.parse(H45.window.localStorage.getItem("forge:data")).activeWorkoutDraft===null);
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
check("restore scrubs retired direct-AI fields", R45.window.eval("cfg.anthropicKey")===undefined && R45.window.eval("cfg.aiProvider")===undefined);
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
check("next boot heals an unstamped interrupted commit", Healed45.window.eval("protectedMode")===false && Healed45.window.eval("cfg.schemaVersion")===3 && Healed45.window.eval("cfg.calTarget")===1600 && Healed45.window.eval("data.activeWorkoutDraft")===null && typeof Healed45.window.eval("data.myExercises")==="object");

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
check("v46 recovery behavior keeps current primary schemaVersion 3", H46.window.eval("cfg.schemaVersion")===3 && JSON.parse(H46.window.localStorage.getItem("forge:cfg")).schemaVersion===3);
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
check("recovery backup scrubs retired direct-AI fields from validated LKG", BackupRecovery.window.eval("cfg.anthropicKey")===undefined && BackupRecovery.window.eval("cfg.aiProvider")===undefined);
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
check("validated LKG and normal exports both exclude retired API keys", !JSON.parse(recoveryLkgRaw).strings.cfg.includes("sk-lkg") && !normalBackupText.includes("sk-lkg"));
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
function bootOFF(offResponder,cfgOverrides){
  return boot(
    Object.assign({},EXISTING_CFG,cfgOverrides||{}),
    Object.assign({},EMPTY_DATA,{
      myFoods:{
        "111":{
          name:"Saved thing",
          brand:"Mine",
          cal100:100,
          pro100:10,
          carb100:5,
          fat100:2
        }
      }
    }),
    w=>{
      w.__calls=[];
      w.fetch=url=>{
        w.__calls.push(url);

        if(url.includes("openfoodfacts")){
          return offResponder(url);
        }

        return Promise.resolve({
          ok:false,
          status:500,
          json:()=>Promise.resolve({})
        });
      };
    }
  );
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
check("v82 confirmed OFF 404 does not retry and opens label entry", notFoundAttempts===1 &&
  !C.window.document.getElementById("customCard").classList.contains("hidden") &&
  /not found in Open Food Facts/i.test(C.window.document.getElementById("searchErr").textContent));

let networkAttempts = 0;
C = bootOFF(()=>{
  networkAttempts++;
  return Promise.reject(new Error("offline"));
});
await scan(C,"666");
check("v82 OFF network failure retries once then opens label entry", networkAttempts===2 &&
  !C.window.document.getElementById("customCard").classList.contains("hidden") &&
  /could not be reached/i.test(C.window.document.getElementById("searchErr").textContent));

let unavailableAttempts = 0;
C = bootOFF(()=>{
  unavailableAttempts++;
  return Promise.reject(new Error("OFF unavailable"));
});
await scan(C,"777");
check("v82 unavailable Open Food Facts opens manual label entry", unavailableAttempts===2 &&
  !C.window.document.getElementById("customCard").classList.contains("hidden") &&
  !C.window.document.getElementById("searchErr").classList.contains("hidden") &&
  /could not be reached/i.test(C.window.document.getElementById("searchErr").textContent));

C = bootOFF(()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({status:"success", product:{product_name:"Bad", nutriments:{"energy-kcal_100g":"NaN-city","proteins_100g":-5}}})}));
await scan(C,"555");
check("malformed Open Food Facts nutrition opens manual label entry",
  !C.window.document.getElementById("customCard").classList.contains("hidden") &&
  /does not include usable nutrition/i.test(C.window.document.getElementById("searchErr").textContent));

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
check("partially saved programmed exercise cannot silently drop remaining sets",
  T49.window.eval(`data.workouts.length===1`)
  && /Resolve the remaining planned sets.*Bench Press/.test(
    dT49.getElementById("workoutErr").textContent
  ));
clickT49([...dT49.querySelectorAll("#exerciseInputs .xbtn")].find(b=>b.textContent==="Edit"));
clickT49(dT49.querySelector('[data-exercise="Bench Press"][data-set-remove="1"]'));
clickT49(dT49.querySelector('[data-exercise="Bench Press"][data-set-remove="2"]'));
clickT49(dT49.querySelector("#exerciseInputs .saveExBtn"));
clickT49("logWorkoutBtn");
check("resolved partial exercise logs completed and explicitly removed sets",
  T49.window.eval(`data.workouts.length===2
    && data.workouts[1].sets["Bench Press"].length===3
    && data.workouts[1].sets["Bench Press"][0].w===105
    && data.workouts[1].sets["Bench Press"][1].status==="removed"
    && data.workouts[1].sets["Bench Press"][2].status==="removed"`));
check("partial completed history cannot trigger false progression next time", T49.window.eval(`sessionState["Bench Press"].auto===false && sessionState["Bench Press"].rows.length===3 && sessionState["Bench Press"].rows[0].w===105`));

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
const sessionTypePos = workChildren.indexOf(dT50.getElementById("sessionTypeCard"));
const sessionPos = workChildren.indexOf(dT50.getElementById("trainingSessionCard"));
const toolsPos = workChildren.indexOf(dT50.getElementById("trainingToolsCard"));
const myExercisesPos = workChildren.indexOf(dT50.getElementById("myExercisesLaunchCard"));
check("Train opens with compact program identity first and the daily session ahead of utility tools", identityPos===0 && identityPos<programPos && programPos<sessionTypePos && sessionTypePos<sessionPos && sessionPos<toolsPos);
check("native-final Train uses separate static Session Type and Workout cards in order",
  sessionTypePos>-1
  && sessionTypePos+1===sessionPos
  && dT50.getElementById("sessionTypeCard").contains(dT50.getElementById("wDay"))
  && !dT50.getElementById("trainingSessionCard").contains(dT50.getElementById("wDay"))
  && dT50.getElementById("trainingSessionCard").contains(dT50.getElementById("wDate")));
check("My Exercises launch card follows Plate Math",
  toolsPos>-1 && myExercisesPos===toolsPos+1);
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
const sessionTypeTitle50=dT50.getElementById("sessionTypeCardTitle");
const workoutTitle50=dT50.getElementById("workoutCardTitle");
const plateTitle50=dT50.querySelector("#trainingToolsCard > .card-title");
const exerciseName50=dT50.querySelector("#exerciseInputs .x-head b");
const exerciseScheme50=dT50.querySelector("#exerciseInputs .exercise-prescription.scheme");
check("native-final card headings share the 16px bold Oswald hierarchy",
  [sessionTypeTitle50,workoutTitle50,plateTitle50].every(el=>
    !!el
    && T50.window.getComputedStyle(el).fontSize==="16px"
    && /Oswald/.test(T50.window.getComputedStyle(el).fontFamily)
    && Number(T50.window.getComputedStyle(el).fontWeight)>=700
  ));
check("native-final exercise names are 14px bold Oswald while schemes remain 12px",
  !!exerciseName50
  && T50.window.getComputedStyle(exerciseName50).fontSize==="14px"
  && /Oswald/.test(T50.window.getComputedStyle(exerciseName50).fontFamily)
  && Number(T50.window.getComputedStyle(exerciseName50).fontWeight)>=700
  && !!exerciseScheme50
  && T50.window.getComputedStyle(exerciseScheme50).fontSize==="12px");
check("native-final hierarchy preserves the existing smaller global labels",
  T50.window.getComputedStyle(dT50.querySelector(".label")).fontSize==="10px");

await wait(0);
releaseTestWindows([
  A,FreshBackupReminder,BackupReminder,CancelBackup,ShareBackup,T49,T49Invalid,T49Switch,T50
]);

const MyExercisesParity76=boot(
  V2_CFG,
  JSON.parse(JSON.stringify(V2_DATA)),
  null,
  TEST_PROGRAM
);
const dMyExercisesParity76=MyExercisesParity76.window.document;

const activeExerciseParity76=MyExercisesParity76.window.eval(`
  createUserExercise(
    "Active Parity Exercise",
    "reps"
  )
`);
const archivedExerciseParity76=MyExercisesParity76.window.eval(`
  createUserExercise(
    "Archived Parity Exercise",
    "text"
  )
`);
const deleteExerciseParity76=MyExercisesParity76.window.eval(`
  createUserExercise(
    "Delete Parity Exercise",
    "carry"
  )
`);

MyExercisesParity76.window.eval(`
  program.days[0].exercises.push({
    name:"Archived Parity Exercise",
    scheme:""
  });

  archiveOrDeleteUserExercise(
    ${JSON.stringify(archivedExerciseParity76.entry.id)}
  );
`);

check("My Exercises parity fixture uses the shipped create and archive lifecycle",
  activeExerciseParity76.ok
  && archivedExerciseParity76.ok
  && deleteExerciseParity76.ok
  && MyExercisesParity76.window.eval(`
    data.myExercises[
      ${JSON.stringify(activeExerciseParity76.entry.id)}
    ].deprecated===false
  `)
  && MyExercisesParity76.window.eval(`
    data.myExercises[
      ${JSON.stringify(archivedExerciseParity76.entry.id)}
    ].deprecated===true
  `));
MyExercisesParity76.window.eval(`
  activateView("work",null,false);
  Object.defineProperty(
    window,
    "scrollY",
    {configurable:true,value:432}
  );
  window.__myExercisesScrollRestore=[];
  window.scrollTo=(x,y)=>{
    window.__myExercisesScrollRestore.push({x:x,y:y});
  };
`);

const myExercisesOpener76=dMyExercisesParity76.getElementById("myExercisesManageBtn");
myExercisesOpener76.focus();
myExercisesOpener76.dispatchEvent(new MyExercisesParity76.window.Event("click",{bubbles:true}));
const myExercisesOverlay76=dMyExercisesParity76.getElementById("myExercisesOverlay");
const myExercisesHeadings76=[...dMyExercisesParity76.querySelectorAll(".my-exercise-section-title")].map(el=>el.textContent);
check("My Exercises opens as a named modal and moves focus to Close",
  !myExercisesOverlay76.classList.contains("hidden")
  && myExercisesOverlay76.getAttribute("role")==="dialog"
  && myExercisesOverlay76.getAttribute("aria-modal")==="true"
  && dMyExercisesParity76.activeElement===dMyExercisesParity76.getElementById("myExercisesCloseBtn")
  && myExercisesOpener76.getAttribute("aria-expanded")==="true");
check("My Exercises modal covers the visible Train rest dock",
  !dMyExercisesParity76.getElementById("restDock").classList.contains("hidden")
  && Number(
    MyExercisesParity76.window.getComputedStyle(
      myExercisesOverlay76
    ).zIndex
  )>
  Number(
    MyExercisesParity76.window.getComputedStyle(
      dMyExercisesParity76.getElementById("restDock")
    ).zIndex
  ));
check("My Exercises uses the shared scroll-preserving body lock",
  dMyExercisesParity76.body.classList.contains("locked"));

dMyExercisesParity76.getElementById("myExercisesCloseBtn").dispatchEvent(
  new MyExercisesParity76.window.Event("click",{bubbles:true})
);
await wait(30);

check("closing My Exercises immediately restores focus and the underlying scroll",
  myExercisesOverlay76.classList.contains("hidden")
  && dMyExercisesParity76.activeElement===myExercisesOpener76
  && myExercisesOpener76.getAttribute("aria-expanded")==="false"
  && !dMyExercisesParity76.body.classList.contains("locked")
  && MyExercisesParity76.window.eval(`
    window.__myExercisesScrollRestore.some(
      entry=>entry.x===0 && entry.y===432
    )
  `));

MyExercisesParity76.window.eval(`
  window.__myExercisesScrollRestore=[];
`);

myExercisesOpener76.focus();
myExercisesOpener76.dispatchEvent(
  new MyExercisesParity76.window.Event("click",{bubbles:true})
);

check("My Exercises reopens for lifecycle management after the scroll test",
  !myExercisesOverlay76.classList.contains("hidden")
  && dMyExercisesParity76.activeElement===
    dMyExercisesParity76.getElementById("myExercisesCloseBtn")
  && dMyExercisesParity76.body.classList.contains("locked"));

check("My Exercises manager separates active and archived exercise lists",
  myExercisesHeadings76.join("|")==="Active|Archived"
  && /Active Parity Exercise/.test(dMyExercisesParity76.getElementById("myExercisesList").textContent)
  && /Archived Parity Exercise/.test(dMyExercisesParity76.getElementById("myExercisesList").textContent));
const myExerciseRow76=name=>
  [...dMyExercisesParity76.querySelectorAll(".my-exercise-row")]
    .find(row=>row.textContent.includes(name));
const myExerciseButton76=(name,label)=>{
  const row=myExerciseRow76(name);
  return row
    ? [...row.querySelectorAll("button")]
        .find(button=>button.textContent.trim()===label)
    : null;
};
const focusStayedInMyExercises76=()=>
  myExercisesOverlay76.contains(dMyExercisesParity76.activeElement)
  && dMyExercisesParity76.activeElement===
    dMyExercisesParity76.getElementById("myExercisesCloseBtn");

MyExercisesParity76.window.prompt=()=>"Renamed Parity Exercise";
MyExercisesParity76.window.confirm=()=>true;

const renameParityButton76=
  myExerciseButton76("Active Parity Exercise","Rename");

renameParityButton76.dispatchEvent(
  new MyExercisesParity76.window.Event("click",{bubbles:true})
);

check("renaming from My Exercises keeps keyboard focus inside the modal",
  MyExercisesParity76.window.eval(`
    data.myExercises[
      ${JSON.stringify(activeExerciseParity76.entry.id)}
    ].name==="Renamed Parity Exercise"
  `)
  && focusStayedInMyExercises76());

const restoreParityButton76=
  myExerciseButton76("Archived Parity Exercise","Restore");

restoreParityButton76.dispatchEvent(
  new MyExercisesParity76.window.Event("click",{bubbles:true})
);

check("restoring from My Exercises keeps keyboard focus inside the modal",
  MyExercisesParity76.window.eval(`
    data.myExercises[
      ${JSON.stringify(archivedExerciseParity76.entry.id)}
    ].deprecated===false
  `)
  && focusStayedInMyExercises76());

const archiveParityButton76=
  myExerciseButton76("Archived Parity Exercise","Archive");

archiveParityButton76.dispatchEvent(
  new MyExercisesParity76.window.Event("click",{bubbles:true})
);

check("archiving from My Exercises keeps keyboard focus inside the modal",
  MyExercisesParity76.window.eval(`
    data.myExercises[
      ${JSON.stringify(archivedExerciseParity76.entry.id)}
    ].deprecated===true
  `)
  && focusStayedInMyExercises76());

const deleteParityButton76=
  myExerciseButton76("Delete Parity Exercise","Delete");

deleteParityButton76.dispatchEvent(
  new MyExercisesParity76.window.Event("click",{bubbles:true})
);

check("deleting from My Exercises keeps keyboard focus inside the modal",
  MyExercisesParity76.window.eval(`
    !data.myExercises[
      ${JSON.stringify(deleteExerciseParity76.entry.id)}
    ]
  `)
  && focusStayedInMyExercises76());

check("My Exercises title uses the shared 16px card-title style",
  dMyExercisesParity76.defaultView.getComputedStyle(
    dMyExercisesParity76.getElementById("myExercisesTitle")
  ).fontSize==="16px");
dMyExercisesParity76.getElementById("myExercisesCloseBtn").dispatchEvent(
  new MyExercisesParity76.window.Event("click",{bubbles:true})
);
await wait(10);
check("closing My Exercises after mutations returns focus and unlocks the page",
  myExercisesOverlay76.classList.contains("hidden")
  && dMyExercisesParity76.activeElement===myExercisesOpener76
  && myExercisesOpener76.getAttribute("aria-expanded")==="false"
  && !dMyExercisesParity76.body.classList.contains("locked"));


// ================= v76 parity physical-validation fixes =================
const SessionRemove78=boot(
  V2_CFG,
  JSON.parse(JSON.stringify(V2_DATA)),
  null,
  TEST_PROGRAM
);
const dSessionRemove78=SessionRemove78.window.document;

const removableExercise78=SessionRemove78.window.eval(`
  createUserExercise(
    "Session Removal Test",
    "lift"
  )
`);

SessionRemove78.window.eval(`
  activateView("work",null,false);
  wDaySel.value="__FREE__";

  const entry=data.myExercises[
    ${JSON.stringify(removableExercise78.entry.id)}
  ];

  extraExercises=[{
    id:entry.id,
    name:entry.name,
    shape:entry.shape,
    scheme:""
  }];

  sessionState=newExerciseNameMap();
  sessionState[entry.name]=blankShapeState(entry);

  data.activeWorkoutDraft={
    date:todayStr(),
    day:"__FREE__",
    title:"Freestyle",
    programName:program.name||"Unnamed program",
    sets:{
      "Session Removal Test":[
        {w:50,r:5}
      ]
    },
    notes:"",
    updatedAt:new Date().toISOString()
  };

  save();
  renderSessionInputs();
`);

const sessionRemoveButtons78=[
  ...dSessionRemove78.querySelectorAll(
    ".removeSessionExerciseBtn"
  )
];

const sessionRemoveToolsParity76=
  sessionRemoveButtons78[0]
    ?sessionRemoveButtons78[0].closest(".x-tools")
    :null;
const sessionRemoveVideoParity76=
  sessionRemoveToolsParity76
    ?[...sessionRemoveToolsParity76.querySelectorAll("button")]
      .find(button=>button.textContent.trim()==="Video")
    :null;

check("v90 session-added Remove stays direct while Video moves into the More menu",
  !!sessionRemoveToolsParity76
  && !!sessionRemoveVideoParity76
  && sessionRemoveVideoParity76.closest(".exercise-more-menu")
  && sessionRemoveButtons78[0].closest(".exercise-more-menu")===null);

check("v76 parity only session-added exercises receive a Remove control",
  removableExercise78.ok
  && sessionRemoveButtons78.length===1
  && /Session Removal Test/.test(
    sessionRemoveButtons78[0]
      .closest(".exercise").textContent
  ));

sessionRemoveButtons78[0].dispatchEvent(
  new SessionRemove78.window.Event(
    "click",
    {bubbles:true}
  )
);

check("v76 parity Remove clears the added exercise from the live workout",
  SessionRemove78.window.eval(`
    extraExercises.length===0
    && !sessionState["Session Removal Test"]
  `)
  && !/Session Removal Test/.test(
    dSessionRemove78
      .getElementById("exerciseInputs").textContent
  ));

check("v76 parity Remove updates the persisted active workout draft",
  SessionRemove78.window.eval(`
    data.activeWorkoutDraft===null
  `)
  && JSON.parse(
    SessionRemove78.window.localStorage
      .getItem("forge:data")
  ).activeWorkoutDraft===null);

check("v76 parity Remove does not delete the exercise from My Exercises",
  SessionRemove78.window.eval(`
    !!data.myExercises[
      ${JSON.stringify(removableExercise78.entry.id)}
    ]
  `));

check("v76 parity Save Exercise carries the accent-specific classes",
  !!saveTarget
  && saveTarget.matches(".xbtn.saveExBtn"));

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
clickT51(dT51.querySelector("#exerciseInputs .saveExBtn"));
check(
  "v78 untouched plans give immediate card-level save guidance",
  T51.window.eval(`sessionState["Bench Press"].status`)==="plan"
  && /Planned values are not logged until you edit a set/.test(
    dT51.getElementById("workoutErr").textContent
  )
  && dT51.activeElement===dT51.querySelector(
    '#exerciseInputs input[data-field="weight"]'
  )
);
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
check("v90 save-and-log path refuses to silently drop unresolved planned sets",
  T51.window.eval(`data.workouts.length===0`)
  && /Resolve the remaining planned sets.*Bench Press/.test(
    dT51.getElementById("workoutErr").textContent
  ));
clickT51([...dT51.querySelectorAll("#exerciseInputs .xbtn")].find(b=>b.textContent==="Edit"));
clickT51(dT51.querySelector('[data-exercise="Bench Press"][data-set-remove="1"]'));
clickT51(dT51.querySelector('[data-exercise="Bench Press"][data-set-remove="2"]'));
clickT51(dT51.querySelector("#exerciseInputs .saveExBtn"));
clickT51("logWorkoutBtn");
check("v90 save-and-log path logs only after every planned set is resolved",
  T51.window.eval(`data.workouts.length===1
    && data.workouts[0].sets["Bench Press"].length===3
    && data.workouts[0].sets["Bench Press"][0].w===135
    && data.workouts[0].sets["Bench Press"][1].status==="removed"
    && data.workouts[0].sets["Bench Press"][2].status==="removed"`));

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

dT51b.querySelector('.tab[data-view="work"]').dispatchEvent(new T51b.window.Event("click",{bubbles:true}));
check(
  "v90-16 entered workout values remain visible after leaving and returning to Train",
  dT51b.querySelector('#exerciseInputs input[data-field="weight"]').value==="95"
  && T51b.window.eval(`sessionState["Bench Press"].rows[0].w`)===95
);

const T9016 = boot(V2_CFG, EMPTY_DATA, null, TEST_PROGRAM);
const dT9016 = T9016.window.document;
dT9016.querySelector('.tab[data-view="work"]').dispatchEvent(new T9016.window.Event("click",{bubbles:true}));
const clearedWeight9016=dT9016.querySelector('#exerciseInputs input[data-field="weight"]');
const plannedReps9016=dT9016.querySelector('#exerciseInputs input[data-field="reps"]');
clearedWeight9016.value="95";
clearedWeight9016.dispatchEvent(new T9016.window.Event("input",{bubbles:true}));
clearedWeight9016.value="";
clearedWeight9016.dispatchEvent(new T9016.window.Event("input",{bubbles:true}));
let emptyLeavePrompts9016=0;
T9016.window.confirm=()=>{
  emptyLeavePrompts9016+=1;
  return false;
};
dT9016.querySelector('.tab[data-view="food"]').dispatchEvent(new T9016.window.Event("click",{bubbles:true}));
check(
  "v90-16 clearing the only user-entered value leaves no false unfinished exercise",
  plannedReps9016.value==="5"
  && emptyLeavePrompts9016===0
  && dT9016.getElementById("view-food").classList.contains("active")
  && T9016.window.eval(`
       sessionState["Bench Press"].rows[0].w===""
       && sessionState["Bench Press"].rows[0].r===5
       && sessionState["Bench Press"].rows[0].touched===false
       && unsavedExerciseNames().length===0
     `)
);
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
// search results still reveal normally; successful logging preserves position.
F51.window.HTMLElement.prototype.scrollIntoView = function(opts){ F51.window.__f51 = {id:this.id, className:this.className, block:opts&&opts.block}; };
F51.window.eval(`renderResults([{name:"Test Food", brand:"B", cal100:100, pro100:10, carb100:5, fat100:2}]);`);
check("v51 search results scroll into view beside the field", F51.window.eval("window.__f51 && window.__f51.id")==="resultsCard");
dF51.querySelector("#results .result").dispatchEvent(new F51.window.Event("click",{bubbles:true}));
await wait(10);
F51.window.eval(`window.__f51=null;`);
dF51.getElementById("addSelBtn").dispatchEvent(new F51.window.Event("click",{bubbles:true}));

check("v84 successful food logging preserves position and offers explicit follow-up actions",
  F51.window.eval("window.__f51")===null
  && F51.window.eval("data.food[todayStr()].length")===4
  && !dF51.getElementById("foodAddConfirmationPanel").classList.contains("hidden")
  && /ADDED TO TODAY/.test(dF51.getElementById("foodAddConfirmationMessage").textContent)
  && dF51.getElementById("foodAddUndoBtn").textContent==="UNDO"
  && dF51.getElementById("foodAddViewBtn").textContent==="VIEW ENTRY");

dF51.getElementById("foodAddViewBtn").dispatchEvent(
  new F51.window.Event("click",{bubbles:true})
);

check("v84 View entry is the explicit action that moves to the newly logged row",
  F51.window.eval("window.__f51 && /list-item/.test(window.__f51.className||'')"));

dF51.getElementById("foodAddUndoBtn").dispatchEvent(
  new F51.window.Event("click",{bubbles:true})
);

check("v84 inline Undo removes that exact newly added food",
  F51.window.eval("data.food[todayStr()].length")===3
  && dF51.getElementById("foodAddConfirmationPanel").classList.contains("hidden"));

check("food-added follow-up is limited to 30 seconds",
  F51.window.eval("FOOD_ADD_CONFIRMATION_MS")===30000);
F51.window.eval(`showFoodAddedConfirmation(todayStr(),data.food[todayStr()][0])`);
dF51.querySelector('.tab[data-view="dash"]').dispatchEvent(new F51.window.Event("click",{bubbles:true}));
check("food-added follow-up closes when leaving Food",
  dF51.getElementById("foodAddConfirmationPanel").classList.contains("hidden")
  && F51.window.eval("foodAddConfirmationTimer")===null);

check("v51 handoff behavior untouched by food changes", !!dF51.getElementById("hfPasteBtn"));

// ================= editable slider portions + stable usual-meal identity =================
const FoodEdit = boot(V2_CFG, EMPTY_DATA);
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

const UsualIdentity = boot(V2_CFG,Object.assign({},EMPTY_DATA,{food:usualFood}));
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

UsualIdentity.window.eval(`
  _lastAddT=0;
  addEntry({name:"175g Greek yogurt",cal:105,pro:18,carb:7,fat:1,meal:"breakfast"});
  renderUsual();
`);
check("usual breakfast marks the matching category Added while leaving the other item available",
  !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && dUsualIdentity.querySelectorAll("#usualItems .usualAddBtn").length===2
  && [...dUsualIdentity.querySelectorAll("#usualItems .usualItemRow")].some(row=>
    /Greek yogurt/i.test(row.textContent)
    && row.querySelector(".usualAddBtn").disabled
    && row.querySelector(".usualAddBtn").textContent==="Added"
  )
  && [...dUsualIdentity.querySelectorAll("#usualItems .usualItemRow")].some(row=>
    /Eggs/i.test(row.textContent)
    && !row.querySelector(".usualAddBtn").disabled
    && row.querySelector(".usualAddBtn").textContent==="Add"
  )
  && /Add all \(1 item\)/.test(dUsualIdentity.getElementById("usualLogBtn").textContent));

UsualIdentity.window.eval(`
  _lastAddT=0;
  addEntry({name:"4 Eggs",cal:280,pro:24,carb:2,fat:20,meal:"breakfast"});
  renderUsual();
`);
check("usual breakfast keeps the grouped recommendation visible with every item marked Added",
  !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && [...dUsualIdentity.querySelectorAll("#usualItems .usualAddBtn")].every(button=>
    button.disabled && button.textContent==="Added"
  )
  && dUsualIdentity.getElementById("usualLogBtn").disabled
  && dUsualIdentity.getElementById("usualLogBtn").textContent==="All added");

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

UsualIdentity.window.eval(`
  _lastAddT=0;
  addEntry({name:"7oz Chicken Breast",cal:320,pro:56,carb:0,fat:7,meal:"lunch"});
  renderUsual();
`);
check("usual lunch marks its logged food Added without offering a duplicate",
  !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && dUsualIdentity.querySelector("#usualItems .usualAddBtn").disabled
  && dUsualIdentity.querySelector("#usualItems .usualAddBtn").textContent==="Added"
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

UsualIdentity.window.eval(`
  _lastAddT=0;
  addEntry({name:"250g Brown Rice",cal:270,pro:6,carb:56,fat:2,meal:"dinner"});
  renderUsual();
`);
check("usual dinner marks its logged food Added without offering a duplicate",
  !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && dUsualIdentity.querySelector("#usualItems .usualAddBtn").disabled
  && dUsualIdentity.querySelector("#usualItems .usualAddBtn").textContent==="Added"
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

UsualIdentity.window.eval(`
  _lastAddT=0;
  addEntry({name:"Strawberry Protein Shake",cal:225,pro:31,carb:13,fat:5,meal:"snacks"});
  renderUsual();
`);
check("usual snacks marks its logged food Added without offering a duplicate",
  !dUsualIdentity.getElementById("usualCard").classList.contains("hidden")
  && dUsualIdentity.querySelector("#usualItems .usualAddBtn").disabled
  && dUsualIdentity.querySelector("#usualItems .usualAddBtn").textContent==="Added"
  && dUsualIdentity.getElementById("usualLogBtn").disabled);

await wait(0);
releaseTestWindows([
  F51,FoodEdit,MyExercisesParity76,SessionRemove78,T51,T51b,T51c,
  UsualIdentity
]);

// ================= individual recurring-meal Quick Log controls =================
const usualControlFood = {};
for(let i=1;i<=4;i++){
  usualControlFood[dstr(-i)] = [
    {
      name:"1 serving · Test Greek Yogurt",
      cal:102,pro:18,carb:7,fat:1,meal:"breakfast",
      amount:1,unit:"serving",grams:170,
      foodKey:"food:test greek yogurt|test dairy",
      sourceFood:{
        name:"Test Greek Yogurt",brand:"Test Dairy",
        cal100:60,pro100:10.5882352941,carb100:4.1176470588,
        fat100:0.5882352941,servingG:170,servingLabel:"170g cup"
      }
    },
    {
      name:"2 Eggs",cal:140,pro:12,carb:1,fat:10,
      meal:"breakfast"
    },
    {
      name:"150g Test Chicken Breast",
      cal:248,pro:47,carb:0,fat:5,meal:"lunch",
      amount:150,unit:"g",grams:150,
      foodKey:"food:test chicken breast|test kitchen",
      sourceFood:{
        name:"Test Chicken Breast",brand:"Test Kitchen",
        cal100:165,pro100:31,carb100:0,fat100:3.3
      }
    },
    {
      name:"200g Test Brown Rice",
      cal:222,pro:5,carb:46,fat:2,meal:"dinner",
      amount:200,unit:"g",grams:200,
      foodKey:"food:test brown rice|test kitchen",
      sourceFood:{
        name:"Test Brown Rice",brand:"Test Kitchen",
        cal100:111,pro100:2.5,carb100:23,fat100:1
      }
    },
    {
      name:"1 serving · Test Protein Shake",
      cal:230,pro:32,carb:12,fat:5,meal:"snacks",
      amount:1,unit:"serving",grams:330,
      foodKey:"food:test protein shake|test nutrition",
      sourceFood:{
        name:"Test Protein Shake",brand:"Test Nutrition",
        cal100:69.696969697,pro100:9.696969697,
        carb100:3.636363636,fat100:1.515151515,
        servingG:330,servingLabel:"1 bottle"
      }
    }
  ];
}

const UsualControls = boot(
  V2_CFG,
  Object.assign({},EMPTY_DATA,{food:usualControlFood})
);
const dUsualControls = UsualControls.window.document;
UsualControls.window.eval(`currentMeal="breakfast"; renderMealSeg(); renderFood();`);

const firstUsualAdd =
  dUsualControls.querySelector("#usualItems .usualAddBtn:not([disabled])");
firstUsualAdd.dispatchEvent(
  new UsualControls.window.Event("click",{bubbles:true})
);

check("usual meal allows one recommended food to be added independently",
  UsualControls.window.eval(`data.food[todayStr()].length`)===1
  && [...dUsualControls.querySelectorAll("#usualItems .usualItemRow")].some(row=>
    /Test Greek Yogurt/.test(row.textContent)
    && row.querySelector(".usualAddBtn").disabled
    && row.querySelector(".usualAddBtn").textContent==="Added"
  )
  && [...dUsualControls.querySelectorAll("#usualItems .usualAddBtn")].some(button=>!button.disabled));

check("individual usual-food add preserves nutrition, grams, source identity, and serving amount",
  UsualControls.window.eval(`
    (function(){
      const food=data.food[todayStr()][0];
      return food.name==="1 serving · Test Greek Yogurt"
        && food.cal===102 && food.pro===18
        && food.grams===170
        && food.amount===1 && food.unit==="serving"
        && food.foodKey==="food:test greek yogurt|test dairy"
        && food.sourceFood
        && food.sourceFood.name==="Test Greek Yogurt"
        && food.sourceFood.servingG===170;
    })()
  `));

UsualControls.window.eval(`startEditEntry(0)`);
check("individually added usual food retains slider-edit behavior",
  !dUsualControls.getElementById("calcCard").classList.contains("hidden")
  && dUsualControls.getElementById("addSelBtn").textContent==="Update entry"
  && dUsualControls.getElementById("qtyUnit").value==="serving"
  && Number(dUsualControls.getElementById("qtyAmount").value)===1);
dUsualControls.getElementById("cancelSelEditBtn").dispatchEvent(
  new UsualControls.window.Event("click",{bubbles:true})
);

dUsualControls
  .querySelector("#usualItems .usualAddBtn:not([disabled])")
  .dispatchEvent(new UsualControls.window.Event("click",{bubbles:true}));

check("usual meal allows multiple recommended foods to be added individually",
  UsualControls.window.eval(`data.food[todayStr()].length`)===2
  && [...dUsualControls.querySelectorAll("#usualItems .usualAddBtn")].every(button=>
    button.disabled && button.textContent==="Added"
  ));

const completedUsualCount =
  UsualControls.window.eval(`data.food[todayStr()].length`);
dUsualControls.getElementById("usualLogBtn").dispatchEvent(
  new UsualControls.window.Event("click",{bubbles:true})
);
check("disabled Add all cannot duplicate individually added usual foods",
  UsualControls.window.eval(`data.food[todayStr()].length`)===completedUsualCount);

const UsualPartial = boot(
  V2_CFG,
  Object.assign({},EMPTY_DATA,{food:usualControlFood})
);
const dUsualPartial = UsualPartial.window.document;
UsualPartial.window.eval(`currentMeal="breakfast"; renderMealSeg(); renderFood();`);
dUsualPartial
  .querySelector("#usualItems .usualAddBtn:not([disabled])")
  .dispatchEvent(new UsualPartial.window.Event("click",{bubbles:true}));
dUsualPartial.getElementById("usualLogBtn").dispatchEvent(
  new UsualPartial.window.Event("click",{bubbles:true})
);

check("Add all after a partial individual add adds only the remaining food",
  UsualPartial.window.eval(`
    (function(){
      const foods=data.food[todayStr()];
      return foods.length===2
        && foods.filter(food=>/Greek Yogurt/.test(food.name)).length===1
        && foods.filter(food=>/Eggs/.test(food.name)).length===1;
    })()
  `));

const UsualAllMeals = boot(
  V2_CFG,
  Object.assign({},EMPTY_DATA,{food:usualControlFood})
);
const dUsualAllMeals = UsualAllMeals.window.document;
["breakfast","lunch","dinner","snacks"].forEach(meal=>{
  UsualAllMeals.window.eval(`currentMeal=${JSON.stringify(meal)}; renderMealSeg(); renderFood();`);
  const button =
    dUsualAllMeals.querySelector("#usualItems .usualAddBtn:not([disabled])");
  button.dispatchEvent(
    new UsualAllMeals.window.Event("click",{bubbles:true})
  );
});

check("individual usual-food actions work independently for all four meal categories",
  UsualAllMeals.window.eval(`
    (function(){
      const foods=data.food[todayStr()];
      const meals=new Set(foods.map(food=>food.meal));
      return foods.length===4
        && ["breakfast","lunch","dinner","snacks"].every(meal=>meals.has(meal));
    })()
  `));

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
  V2_CFG,
  Object.assign({},EMPTY_DATA,{food:distinctRecurringFood})
);
check("usual foods do not merge unrelated products merely because they share a vague phrase",
  DistinctRecurring.window.eval(`usualFor("lunch")`)===null);

// ================= copy/paste AI handoff only =================
releaseTestWindows([
  UsualControls,UsualPartial,UsualAllMeals,DistinctRecurring
]);
const H68Cfg = Object.assign({},V2_CFG);
delete H68Cfg.foodHandoffOn;
const H68 = boot(H68Cfg,EMPTY_DATA);
const dH68 = H68.window.document;
check("AI Quick Log defaults to copy/paste handoff",
  H68.window.eval("foodHandoffEnabled()")===true
  && !dH68.getElementById("aiHandoffControls").classList.contains("hidden"));
const H68Claude = boot(Object.assign({},V2_CFG,{aiProvider:"anthropic",anthropicKey:"sk-test"}),EMPTY_DATA);
check("legacy provider settings and credentials are removed on boot",
  H68Claude.window.eval("cfg.aiProvider")===undefined
  && H68Claude.window.eval("cfg.anthropicKey")===undefined
  && !H68Claude.window.localStorage.getItem("forge:cfg").includes("sk-test"));

// ================= v60: default-on ChatGPT food handoff =================
const H60 = boot(V2_CFG, EMPTY_DATA);
const dH60 = H60.window.document;
const clickH60 = id=>dH60.getElementById(id).dispatchEvent(new H60.window.Event("click",{bubbles:true}));
check("v60 food handoff is visible by default without a key", !dH60.getElementById("aiFoodCard").classList.contains("hidden") && !dH60.getElementById("aiHandoffControls").classList.contains("hidden"));
check("v60 Settings toggle reports the default-on state accessibly", dH60.getElementById("foodHandoffToggleBtn").getAttribute("aria-pressed")==="true" && /Disable AI food handoff/.test(dH60.getElementById("foodHandoffToggleBtn").textContent));
clickH60("foodHandoffToggleBtn");
check("v60 disabling food handoff persists false and hides the no-key card", H60.window.eval("cfg.foodHandoffOn")===false && JSON.parse(H60.window.localStorage.getItem("forge:cfg")).foodHandoffOn===false && dH60.getElementById("aiFoodCard").classList.contains("hidden"));
clickH60("foodHandoffToggleBtn");
check("v60 food handoff can be restored from Settings", H60.window.eval("cfg.foodHandoffOn")===true && !dH60.getElementById("aiFoodCard").classList.contains("hidden") && dH60.getElementById("foodHandoffToggleBtn").getAttribute("aria-pressed")==="true");
const H60Api = boot(Object.assign({},V2_CFG,{aiProvider:"anthropic",anthropicKey:"sk-test",foodHandoffOn:true}),EMPTY_DATA);
check("legacy live-AI settings cannot replace the copy/paste food flow", !H60Api.window.document.getElementById("aiHandoffControls").classList.contains("hidden") && H60Api.window.eval("cfg.anthropicKey")===undefined);
const H60Off = boot(Object.assign({},V2_CFG,{aiProvider:"handoff",foodHandoffOn:false}),EMPTY_DATA);
check("disabling food handoff hides it after retired provider settings are scrubbed", H60Off.window.document.getElementById("aiFoodCard").classList.contains("hidden") && H60Off.window.eval("cfg.aiProvider")===undefined);
check("v60 keeps primary schemaVersion 3", H60.window.eval("SCHEMA_VERSION")===3);

// ================= v61: local food suggestions =================
releaseTestWindows([H68,H68Claude,H60,H60Api,H60Off]);
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
check("v61 keeps primary schemaVersion 3", S61.window.eval("SCHEMA_VERSION")===3);


// ================= v62: expanded USDA-anchored suggestion catalog =================
releaseTestWindows([S61,S61Offline,S61NoTargets,S61Full,S61Familiar]);
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
check("v62 suggestion catalog remains precached in the current service worker", (()=>{ const x=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8"); return x.includes('"./data-suggestions.js') && x.includes('const CACHE = "blackpyre-v118-unified-removal-1"'); })());
check("v62 keeps primary schemaVersion 3", C62.window.eval("SCHEMA_VERSION")===3);

// ================= ChatGPT handoff paste flow =================
releaseTestWindows([C62]);
const H = boot(Object.assign({}, EXISTING_CFG, {aiProvider:"handoff"}), EMPTY_DATA);
const dH = H.window.document;
H.window.HTMLElement.prototype.scrollIntoView = function(opts){ H.window.__aiScroll={id:this.id, className:this.className, block:opts&&opts.block}; };
const clickH = id=>dH.getElementById(id).dispatchEvent(new H.window.Event("click",{bubbles:true}));
H.window.eval(`currentMeal="dinner"; renderMealSeg();`);
dH.getElementById("aiPhotoCaption").value = "Local restaurant";
clickH("hfPasteBtn"); await wait(30);
check("paste box always visible (iOS clipboard-proof)", !dH.getElementById("hfPasteBox").classList.contains("hidden"));
check("handoff textarea uses 16px text to prevent mobile focus zoom", H.window.getComputedStyle(dH.getElementById("hfPasteText")).fontSize==="16px");
const trainNumberInput = dH.querySelector(".snum");
check("training weight and rep inputs use 16px text to prevent mobile focus zoom", !!trainNumberInput && H.window.getComputedStyle(trainNumberInput).fontSize==="16px");
dH.getElementById("hfPasteText").value = 'Here! {\u201Cfoods\u201D:[{\u201Cname\u201D:\u201CRice\u201D,\u201Ccal\u201D:260,\u201Cpro\u201D:5,\u201Ccarb\u201D:57,\u201Cfat\u201D:1}]}';
clickH("hfReviewBtn"); await wait(30);
check("curly-quote paste reaches review card", dH.querySelectorAll("#aiFoodConfirm .list-item").length===1);
check("AI review uses a clearly labeled remove-item control instead of a floating red X", dH.querySelector("#aiFoodConfirm .ai-food-remove").textContent==="Remove item");
check("review flow centers the first item instead of clipping it above the viewport", /list-item/.test(H.window.eval("window.__aiScroll && window.__aiScroll.className")||"") && H.window.eval("window.__aiScroll && window.__aiScroll.block")==="center");
const hfLogBtn = dH.querySelector("#aiFoodConfirm .ai-confirm-log");
check("review log action stays visible while reviewing", !!hfLogBtn);
check("nothing logged before confirm", H.window.eval("(data.food[todayStr()]||[]).length")===0);
hfLogBtn.dispatchEvent(new H.window.Event("click",{bubbles:true})); await wait(30);
check("handoff confirmation logs the reviewed food", H.window.eval("(data.food[todayStr()]||[]).length")===1);
check("handoff logging clears raw reply and resets the review", dH.getElementById("hfPasteText").value==="" && dH.getElementById("aiFoodConfirm").classList.contains("hidden"));
check("handoff logging clears the optional where/what context", dH.getElementById("aiPhotoCaption").value==="");
check("handoff logging returns to the top ready for another", /ready for another/i.test(dH.getElementById("aiFoodStatus").textContent) && H.window.eval("window.__aiScroll && window.__aiScroll.id")==="aiFoodCard");

const waterHistoryData=Object.assign({},EMPTY_DATA,{water:{[dstr(-2)]:1,[dstr(-1)]:7,[dstr(0)]:3},measure:[{date:dstr(-1),waist:36,chest:42,arm:15}]});
const WaterHistory=boot(Object.assign({},EXISTING_CFG,{waterOn:true,measureOn:true}),waterHistoryData);
const dWaterHistory=WaterHistory.window.document;
check("water history uses uppercase singular and plural labels in a closed dropdown", WaterHistory.window.eval("data.water[todayStr()]===3") && dWaterHistory.querySelectorAll("#waterHistory .list-item").length===3 && /1 GLASS/.test(dWaterHistory.getElementById("waterHistory").textContent) && /7 GLASSES/.test(dWaterHistory.getElementById("waterHistory").textContent) && !dWaterHistory.querySelector("#waterHistory details").open);
check("body measurements remain dated trackable history", WaterHistory.window.eval("data.measure.length===1 && data.measure[0].date==="+JSON.stringify(dstr(-1))) && dWaterHistory.querySelectorAll("#mList .list-item").length===1);

// ================= easter egg =================
releaseTestWindows([H,WaterHistory]);
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
releaseTestWindows([G]);
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
releaseTestWindows([T54]);
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
  restTimer:JSON.stringify({formatVersion:1,status:"running",endAt:CLOCK64+30000,remainingSec:30,durationSec:30,savedAt:CLOCK64})
}, w=>{ w.Date.now=()=>CLOCK64+45000; });
const relaunchedReady64 = JSON.parse(T64Expired.window.localStorage.getItem("forge:rest-timer"));
check("v65 relaunch or phone restart expiration resets to the last started duration", T64Expired.window.eval("!restRunning && !restPaused && restRemaining===0 && restReadySec===30") && T64Expired.window.document.getElementById("restDisplay").textContent==="0:30" && relaunchedReady64.status==="ready" && relaunchedReady64.durationSec===30);

// ================= v76 native-final timer duration switching =================
const TimerRunningParity76=boot(
  Object.assign({},V2_CFG,{restSec:90}),
  EMPTY_DATA,
  w=>{w.Date.now=()=>CLOCK64;},
  TEST_PROGRAM
);
const dTimerRunningParity76=TimerRunningParity76.window.document;
TimerRunningParity76.window.eval(`activateView("work",null,false)`);
dTimerRunningParity76.getElementById("restStartBtn").dispatchEvent(
  new TimerRunningParity76.window.Event("click",{bubbles:true})
);
const runningPreset30Parity76=[
  ...dTimerRunningParity76.querySelectorAll("#restPresets .xbtn")
].find(button=>button.textContent==="0:30");
runningPreset30Parity76.dispatchEvent(
  new TimerRunningParity76.window.Event("click",{bubbles:true})
);
const runningRecordParity76=JSON.parse(
  TimerRunningParity76.window.localStorage.getItem("forge:rest-timer")
);
check("native-final running timer immediately switches to the selected quick duration",
  TimerRunningParity76.window.eval(
    "restRunning && !restPaused && restRemaining===30 && restDurationSec===30 && restEndsAt===2000000030000"
  )
  && dTimerRunningParity76.getElementById("restDisplay").textContent==="0:30");
check("native-final running duration switch persists the new active deadline",
  runningRecordParity76.status==="running"
  && runningRecordParity76.remainingSec===30
  && runningRecordParity76.durationSec===30
  && runningRecordParity76.endAt===CLOCK64+30000);
TimerRunningParity76.window.eval("cancelRest()");

const TimerPausedParity76=boot(
  Object.assign({},V2_CFG,{restSec:90}),
  EMPTY_DATA,
  w=>{w.Date.now=()=>CLOCK64;},
  TEST_PROGRAM
);
const dTimerPausedParity76=TimerPausedParity76.window.document;
TimerPausedParity76.window.eval(`activateView("work",null,false)`);
dTimerPausedParity76.getElementById("restStartBtn").dispatchEvent(
  new TimerPausedParity76.window.Event("click",{bubbles:true})
);
dTimerPausedParity76.getElementById("restPauseBtn").dispatchEvent(
  new TimerPausedParity76.window.Event("click",{bubbles:true})
);
const pausedPreset120Parity76=[
  ...dTimerPausedParity76.querySelectorAll("#restPresets .xbtn")
].find(button=>button.textContent==="2:00");
pausedPreset120Parity76.dispatchEvent(
  new TimerPausedParity76.window.Event("click",{bubbles:true})
);
const pausedRecordParity76=JSON.parse(
  TimerPausedParity76.window.localStorage.getItem("forge:rest-timer")
);
check("native-final paused timer immediately switches duration while remaining paused",
  TimerPausedParity76.window.eval(
    "!restRunning && restPaused && restRemaining===120 && restDurationSec===120 && restEndsAt===0"
  )
  && dTimerPausedParity76.getElementById("restDisplay").textContent==="2:00"
  && dTimerPausedParity76.getElementById("restPauseBtn").textContent==="Resume");
check("native-final paused duration switch persists the replacement remainder",
  pausedRecordParity76.status==="paused"
  && pausedRecordParity76.remainingSec===120
  && pausedRecordParity76.durationSec===120
  && !Object.prototype.hasOwnProperty.call(pausedRecordParity76,"endAt"));
dTimerPausedParity76.getElementById("restPauseBtn").dispatchEvent(
  new TimerPausedParity76.window.Event("click",{bubbles:true})
);
check("resuming after a paused duration switch starts from the replacement duration",
  TimerPausedParity76.window.eval(
    "restRunning && !restPaused && restRemaining===120 && restEndsAt===2000000120000"
  ));
TimerPausedParity76.window.eval("cancelRest()");

const T65VisibleExpired = boot(Object.assign({},V2_CFG,{restSec:75}), EMPTY_DATA, w=>{ w.Date.now=()=>CLOCK64; }, TEST_PROGRAM);
T65VisibleExpired.window.eval(`activateView("work",null,false)`);
T65VisibleExpired.window.document.getElementById("restStartBtn").dispatchEvent(new T65VisibleExpired.window.Event("click",{bubbles:true}));
T65VisibleExpired.window.Date.now=()=>CLOCK64+76000;
T65VisibleExpired.window.eval("tickRestCountdown()");
const visibleReady65 = JSON.parse(T65VisibleExpired.window.localStorage.getItem("forge:rest-timer"));
check("v65 visible timer expiration resets to the exact last started duration", T65VisibleExpired.window.eval("!restRunning && !restPaused && restRemaining===0 && restReadySec===75") && T65VisibleExpired.window.document.getElementById("restDisplay").textContent==="1:15" && !T65VisibleExpired.window.document.getElementById("restStartBtn").classList.contains("hidden"));

const T65BackgroundExpired = boot(Object.assign({},V2_CFG,{restSec:120}), EMPTY_DATA, w=>{ w.Date.now=()=>CLOCK64; }, TEST_PROGRAM);
T65BackgroundExpired.window.eval(`activateView("work",null,false)`);
T65BackgroundExpired.window.document.getElementById("restStartBtn").dispatchEvent(new T65BackgroundExpired.window.Event("click",{bubbles:true}));
T65BackgroundExpired.window.Date.now=()=>CLOCK64+121000;
T65BackgroundExpired.window.document.dispatchEvent(new T65BackgroundExpired.window.Event("visibilitychange"));
check("v65 background or unlock expiration resets to the exact last started duration", T65BackgroundExpired.window.eval("!restRunning && !restPaused && restReadySec===120") && T65BackgroundExpired.window.document.getElementById("restDisplay").textContent==="2:00");

const timerSource65 = fs.readFileSync(path.join(__dirname,"..","scripts","04-weight.js"),"utf8");
const timerSection65 = timerSource65.slice(timerSource65.indexOf("// ================== PLATE MATH & REST TIMER"), timerSource65.indexOf("// ================== SHARE PROGRAM"));
check("v65 completed timer display no longer uses GO", !timerSection65.includes("GO!") && T65VisibleExpired.window.document.getElementById("restDisplay").textContent!=="GO!");
check("v65 expiration clears the active deadline without restarting", T65VisibleExpired.window.eval("restEndsAt===0 && restInterval===null && !restRunning") && visibleReady65.status==="ready" && !Object.prototype.hasOwnProperty.call(visibleReady65,"endAt"));

// ================= v59: audit-recommended structural protections =================
releaseTestWindows([
  T64,T64PausedReload,T64Expired,TimerRunningParity76,
  TimerPausedParity76,T65VisibleExpired,T65BackgroundExpired
]);
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
releaseTestWindows([FreshAP66,LegacyAP66,AP66]);
check("v58 vendored scanner library exists in the repo", fs.existsSync(path.join(__dirname, "..", "vendor", "html5-qrcode.min.js")));
check("v58 scanner license notice preserved alongside the library", (()=>{ const p=path.join(__dirname, "..", "vendor", "html5-qrcode.LICENSE.txt"); return fs.existsSync(p) && /Apache License/.test(fs.readFileSync(p,"utf8")); })());
const sw58 = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
check("v58 SW SHELL precaches the vendored scanner", sw58.includes('"./vendor/html5-qrcode.min.js'));
const foodSrc = fs.readFileSync(path.join(__dirname, "..", "scripts", "02-food.js"), "utf8");
check("v58 scanner loader uses the local repository path", foodSrc.includes('s.src = "vendor/html5-qrcode.min.js"'));
check("v58 no scanner code is requested from unpkg or any external origin", !/unpkg|jsdelivr|cdnjs/i.test(foodSrc) && !/s\.src\s*=\s*"https?:/.test(foodSrc));
check("v58 scanner load-failure fallback message intact", /Scanner library failed to load/.test(foodSrc));

// ================= Phase 1: extracted data payloads =================
const P = boot(EXISTING_CFG, EMPTY_DATA);
check("QUOTES loads from data-quotes.js", P.window.eval("Array.isArray(QUOTES) && QUOTES.length > 100"));
check("LOCAL_DB loads from data-foods.js", P.window.eval("Array.isArray(LOCAL_DB) && LOCAL_DB.length > 100"));
check("ALT_MAP loads from data-foods.js", P.window.eval("typeof ALT_MAP==='object' && Object.keys(ALT_MAP).length > 10"));
const currentFaqContract = P.window.eval(`(()=>{
  const questions=FAQ.filter(item=>item&&item.q);
  const sections=FAQ.filter(item=>item&&item.sec).map(item=>item.sec);
  const answer=q=>{
    const item=questions.find(entry=>entry.q===q);
    return item ? item.a : "";
  };
  const has=(q,text)=>answer(q).includes(text);
  const expectedQuestions=[
    "How do I set my calorie and macro targets?",
    "Can teenagers use the calorie and macro calculator?",
    "What is a macro split?",
    "How do I log and track my weight?",
    "Can I use accessibility features?",
    "How do I scan food?",
    "What if scanned nutrition is wrong or missing?",
    "What is My Foods?",
    "What is the fastest way to log foods I eat often?",
    "How do food suggestions work?",
    "How do I change, undo, or view a food entry?",
    "How do I log a workout?",
    "How do I learn an exercise or replace it?",
    "How does automatic progression work?",
    "How do I create or load a training program?",
    "What happens when I load a training program?",
    "How do I save or share a training program?",
    "How do I review past workouts and progress?",
    "What is estimated metabolism from my logs?",
    "Why is BlackPyre suggesting that I review my targets?",
    "What can the optional AI tools do, and what information is sent?",
    "Where is my data stored? Is it private?",
    "How do I back up or move BlackPyre to another device?",
    "How do I erase everything from BlackPyre?",
    "What is Protected mode, and what if my data disappears?",
    "What works without an internet connection?",
    "Disclaimer & terms of use"
  ];
  const faqText=JSON.stringify(FAQ).toLowerCase();
  const banned=[
    "usda","apple","iphone","ipad","android",
    "safari","chrome","google","chatgpt","openai","claude",
    "anthropic","starry","chipotle","paddleocr"
  ];

  return questions.length===27
    && JSON.stringify(questions.map(item=>item.q))===JSON.stringify(expectedQuestions)
    && JSON.stringify(sections)===JSON.stringify([
      "Getting started",
      "Food logging",
      "Training",
      "Progress & smart features",
      "Your data & recovery",
      "Legal"
    ])
    && has("How do I set my calorie and macro targets?","1,200 calories")
    && has("Can teenagers use the calorie and macro calculator?","13–17")
    && has("Can teenagers use the calorie and macro calculator?","parent or guardian")
    && has("How do I scan food?","Scan barcode")
    && has("How do I scan food?","Compare those values with the package")
    && has("How do I scan food?","Add to log")
    && has("What if scanned nutrition is wrong or missing?","Nutrition needs editing")
    && has("What if scanned nutrition is wrong or missing?","saves your correction")
    && has("What if scanned nutrition is wrong or missing?","uses it first on later scans")
    && has("How do I change, undo, or view a food entry?","Undo")
    && has("How do I change, undo, or view a food entry?","View entry")
    && has("How do I log a workout?","Save Exercise")
    && has("How do I log a workout?","protected workout draft")
    && has("How do I log a workout?","Log session")
    && has("How do I create or load a training program?","Train → Manage")
    && has("How do I create or load a training program?","training-plan format")
    && has("What happens when I load a training program?","not replaced until you confirm")
    && has("What happens when I load a training program?","completed workout history is kept")
    && has("How do I save or share a training program?","Save file")
    && has("How do I save or share a training program?","Share")
    && has("What can the optional AI tools do, and what information is sent?","Optional AI tools")
    && has("What can the optional AI tools do, and what information is sent?","BlackPyre never contacts an AI service")
    && has("What can the optional AI tools do, and what information is sent?","Selected photos stay in memory only")
    && has("Where is my data stored? Is it private?","browser/PWA site storage on this device")
    && has("Where is my data stored? Is it private?","no user account")
    && has("Where is my data stored? Is it private?","BlackPyre server")
    && has("How do I back up or move BlackPyre to another device?","Save backup")
    && !has("How do I back up or move BlackPyre to another device?","API key")
    && has("How do I erase everything from BlackPyre?","asks twice")
    && has("How do I erase everything from BlackPyre?","Protected mode")
    && has("What is Protected mode, and what if my data disappears?","pauses normal saving")
    && has("What is Protected mode, and what if my data disappears?","Do not remove the installed web app or clear its site data")
    && has("What works without an internet connection?","Saved barcodes")
    && has("What works without an internet connection?","need a connection")
    && has("Disclaimer & terms of use","not medical advice")
    && has("Disclaimer & terms of use","Exercise carries injury risk")
    && has("Disclaimer & terms of use","Verify food labels")
    && has("Disclaimer & terms of use","pregnancy")
    && has("Disclaimer & terms of use","breastfeeding")
    && !banned.some(term=>faqText.includes(term))
    && !faqText.includes("scan nutrition label")
    && !faqText.includes("nutrition-label scanning")
    && !faqText.includes("barcode scan is exact");
})()`);

check(
  "current FAQ matches the consolidated consumer-help contract",
  currentFaqContract
);


check("Phase 1 youth calculator reproduces the accepted reference vector", P.window.eval(`(()=>{const x=calculateNutritionTargets({sex:"m",age:17,ft:5,inches:8,lb:150,activity:1.55,goalAdj:-500});return x.ok&&x.value.activityCategory==="Low active"&&x.value.tdee===2970&&x.value.cal===2470&&x.value.pro===124&&x.value.carb===340&&x.value.fat===69;})()`));

const dP=P.window.document;
const setP=(id,value)=>{ const el=dP.getElementById(id); el.value=String(value); el.dispatchEvent(new P.window.Event(el.tagName==="SELECT"?"change":"input",{bubbles:true})); };
setP("cAge",17); setP("cFt",5); setP("cIn",8); setP("cWt",150); setP("cAct",1.55); setP("cGoal",-500);
check("Phase 1 Settings switches to conservative teen activity labels and all-day guidance", /Low active \+ exercise/.test(dP.getElementById("cAct").options[2].textContent) && /whole day/.test(dP.getElementById("cActivityNote").textContent));
dP.getElementById("calcMacrosBtn").dispatchEvent(new P.window.Event("click",{bubbles:true}));
check("Phase 1 valid teen calculation displays category and Recommended 20/55/25 macros", /Youth activity category: Low active/.test(dP.getElementById("calcOutText").textContent) && /20% protein · 55% carbs · 25% fat/.test(dP.getElementById("splitGrams").textContent));
setP("cAge",42); setP("cFt",5); setP("cIn",11); setP("cWt",190); setP("cAct",1.55); setP("cGoal",-500);
dP.getElementById("calcMacrosBtn").dispatchEvent(new P.window.Event("click",{bubbles:true}));
const CalculatorWeightCfg=JSON.parse(P.window.localStorage.getItem("forge:cfg"));
const CalculatorWeightReboot=boot(CalculatorWeightCfg,Object.assign({},EMPTY_DATA,{weights:[{date:dstr(0),lbs:225}]}));
check("Phase 1 full reboot restores validated 190-lb calculator weight instead of 225-lb starting/latest weight", CalculatorWeightReboot.window.document.getElementById("cWt").value==="190" && CalculatorWeightReboot.window.eval(`cfg.calcInputs.lb===190`));

const LegacyCalculatorWeight=boot(Object.assign({},EXISTING_CFG,{calcInputs:{sex:"m",age:42,ft:5,inches:11,act:1.55,goal:-500}}),Object.assign({},EMPTY_DATA,{weights:[{date:dstr(0),lbs:225}]}));
check("Phase 1 legacy calculator inputs without valid weight retain latest-weigh-in fallback", LegacyCalculatorWeight.window.document.getElementById("cWt").value==="225");

const SetupYouth=boot(null,null);
const dSetupYouth=SetupYouth.window.document;
const clickSetupYouth=id=>dSetupYouth.getElementById(id).dispatchEvent(new SetupYouth.window.Event("click",{bubbles:true}));
clickSetupYouth("disclaimerAgreeBtn");
dSetupYouth.getElementById("suWt").value="190"; dSetupYouth.getElementById("suGoalWt").value="175"; clickSetupYouth("setupNext");
const setSetupYouth=(id,value)=>{ const el=dSetupYouth.getElementById(id); el.value=String(value); el.dispatchEvent(new SetupYouth.window.Event(el.tagName==="SELECT"?"change":"input",{bubbles:true})); };
setSetupYouth("suAge",17); setSetupYouth("suSex","m"); setSetupYouth("suFt",5); setSetupYouth("suIn",8); setSetupYouth("suAct",1.55); setSetupYouth("suGoal",-500);
check("Phase 1 first-run setup uses teen activity descriptions without hiding controls", /Low active \+ exercise/.test(dSetupYouth.getElementById("suAct").options[2].textContent) && /whole day/.test(dSetupYouth.getElementById("suActivityNote").textContent) && !!dSetupYouth.getElementById("suGoal"));
clickSetupYouth("setupNext");
check("Phase 1 first-run calculation persists starting weight as calculator weight", SetupYouth.window.eval(`cfg.calcInputs.lb===190&&setupChoice.calc.activityCategory==="Low active"`));

check("local food search still finds LOCAL_DB entries", P.window.eval(`LOCAL_DB.some(f=>/chicken breast/i.test(f.n))`));
const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
check("SW precaches the five data files", ["data-quotes.js","data-foods.js","data-suggestions.js","data-faq.js","data-exercises.js"].every(f=>sw.includes('"./'+f)));
check("SW cache key matches the BlackPyre web v82 release",
  /const CACHE = "blackpyre-v118-unified-removal-1";/.test(sw));
check("Phase 1 service-worker cache remains refreshed", sw.includes('const CACHE = "blackpyre-v118-unified-removal-1"') && !sw.includes('blackpyre-phase1-nutrition-safety-1'));

await wait(0);
releaseTestWindows([
  A,AP66,B,BackupReminder,C62,CancelBackup,DistinctRecurring,F51,FoodEdit,
  FreshAP66,G,H,H60,H60Api,H60Off,H68,H68Claude,LegacyAP66,
  MyExercisesParity76,Q59,S61,S61Familiar,S61Full,S61NoTargets,
  S61Offline,SessionRemove78,ShareBackup,T49,T49Invalid,T49Switch,T50,
  T51,T51b,T51c,T54,T64,T64Expired,T64PausedReload,
  T65BackgroundExpired,T65VisibleExpired,TimerPausedParity76,
  TimerRunningParity76,UsualAllMeals,UsualControls,UsualIdentity,
  UsualPartial,V59,P,CalculatorWeightReboot,LegacyCalculatorWeight,SetupYouth
]);

const rawIndex = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const rawWeightParity76 = fs.readFileSync(
  path.join(__dirname, "..", "scripts", "04-weight.js"),
  "utf8"
);

check("v76 parity timer duration control retains its larger touch target",
  /\.rest-dock-readout\s*\{[^}]*min-width:132px[^}]*min-height:52px[^}]*touch-action:manipulation/s.test(rawIndex)
  && /\.rest-dock-caret\s*\{[^}]*width:32px[^}]*height:32px[^}]*font-size:16px/s.test(rawIndex));

check("v76 parity timer uses clearly visible open and closed chevrons",
  /rest-dock-caret" aria-hidden="true">▾</.test(rawIndex)
  && /caret\.textContent = open \? "▴" : "▾";/.test(rawWeightParity76));

check("v76 parity History has one complete outer disclosure",
  (rawIndex.match(/id="workHistoryDisclosure"/g)||[]).length===1
  && /<details class="disclosure" id="workHistoryDisclosure" open>[\s\S]*?id="workHistoryBody"[\s\S]*?id="workHistory"/.test(rawIndex)
  && /#workHistoryDisclosure:not\(\[open\]\) > \.history-disclosure-body\s*\{\s*display:none;\s*\}/.test(rawIndex));

const HistoryCollapseParity76Data=
  JSON.parse(JSON.stringify(V2_DATA));

HistoryCollapseParity76Data.workouts=[{
  date:"2026-07-29",
  day:"D1",
  title:"History Collapse Test",
  sets:{Squat:[{w:100,r:5}]},
  notes:""
}];

const HistoryCollapseParity76=boot(
  V2_CFG,
  HistoryCollapseParity76Data,
  null,
  TEST_PROGRAM
);

const dHistoryCollapseParity76=
  HistoryCollapseParity76.window.document;
const historyDisclosureParity76=
  dHistoryCollapseParity76.getElementById(
    "workHistoryDisclosure"
  );
const historyBodyParity76=
  dHistoryCollapseParity76.getElementById(
    "workHistoryBody"
  );

check("v76 parity History starts open with its complete body",
  historyDisclosureParity76.open
  && historyDisclosureParity76.contains(
    dHistoryCollapseParity76.getElementById(
      "workHistory"
    )
  ));

historyDisclosureParity76.open=false;

check("v76 parity closing History completely hides its body",
  !historyDisclosureParity76.open
  && HistoryCollapseParity76.window
    .getComputedStyle(historyBodyParity76).display==="none");

check("native-final Save Exercise uses the selected accent directly",
  /\.xbtn\.saveExBtn\s*\{[^}]*background\s*:\s*var\(--ember\)\s*!important/s.test(rawIndex));
check("native-final Train markup keeps one static Session Type card and one static Workout card",
  (rawIndex.match(/id="sessionTypeCard"/g)||[]).length===1
  && (rawIndex.match(/id="trainingSessionCard"/g)||[]).length===1
  && rawIndex.indexOf('id="sessionTypeCard"')<rawIndex.indexOf('id="trainingSessionCard"'));
check("native-final My Exercises modal is mobile-safe and statically declared",
  (rawIndex.match(/id="myExercisesOverlay"/g)||[]).length===1
  && /#myExercisesOverlay\s*\{[^}]*position:fixed[^}]*z-index:210[^}]*overflow:auto/s.test(rawIndex)
  && /\.my-exercises-overlay-shell\s*\{[^}]*max-width:560px/s.test(rawIndex));
const rawTrainParity = fs.readFileSync(
  path.join(__dirname, "..", "scripts", "03-train.js"),
  "utf8"
);
check("My Exercises uses shared scroll locking and one mutation refresh path",
  /function openMyExercisesManager\(\)[\s\S]*?lockScroll\(\)/.test(rawTrainParity)
  && /function closeMyExercisesManager\(\)[\s\S]*?unlockScroll\(\)/.test(rawTrainParity)
  && (rawTrainParity.match(/function refreshMyExercisesManager\(/g)||[]).length===1
  && !/renderLibraryOptions\(\);\s*renderSessionInputs\(\);\s*if\(builderProg\)renderBuilder\(\);\s*renderMyExercisesManager\(\);/.test(rawTrainParity));
check("data scripts load before the app scripts (raw file order)",
  ["data-quotes.js","data-foods.js","data-suggestions.js","data-faq.js","data-exercises.js"].every(f=>
    rawIndex.indexOf('src="'+f) > -1 &&
    rawIndex.indexOf('src="'+f) < rawIndex.indexOf('src="scripts/01-storage.js')));

// ================= Phase 2: sliced app scripts =================
const SLICES = ["01-storage.js","02-food.js","03-train.js","04-weight.js","05-ai.js","06-settings.js","07-boot.js"];
check("all 7 slices exist on disk", SLICES.every(f=>fs.existsSync(path.join(__dirname, "..", "scripts", f))));
check("index.html loads the 7 slices in ascending order", (()=>{
  const pos = SLICES.map(f=>rawIndex.indexOf('src="scripts/'+f));
  return pos.every(p=>p>-1) && pos.every((p,i)=>i===0 || p>pos[i-1]);
})());
check("no inline app script remains in index.html", !/<script>(?!\s*<)/.test(rawIndex.replace(/<script src="[^"]*"><\/script>/g,"")));
check("SW precaches all 7 slices", SLICES.every(f=>sw.includes('"./scripts/'+f)));

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
check("exactly the 14 approved scripts, each exactly once, in the approved order",
  scriptTags.length===14 && scriptTags.every((t,i)=>t[1].split(/[?#]/)[0]===APPROVED_ORDER[i]));
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
  "04-weight.js":"WEIGHT", "05-ai.js":"V23",
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
dD56R.querySelector("#exerciseInputs .xbtn").dispatchEvent(new D56Reload.window.Event("click",{bubbles:true}));
dD56R.querySelector('[data-exercise="Bench Press"][data-set-remove="1"]').dispatchEvent(new D56Reload.window.Event("click",{bubbles:true}));
dD56R.querySelector('[data-exercise="Bench Press"][data-set-remove="2"]').dispatchEvent(new D56Reload.window.Event("click",{bubbles:true}));
dD56R.querySelector("#exerciseInputs .saveExBtn").dispatchEvent(new D56Reload.window.Event("click",{bubbles:true}));
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
check("v56 manual food missing calories explains and focuses calories", dM56.activeElement===dM56.getElementById("mCal") && /Calories is required/.test(dM56.getElementById("saveState").textContent));

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
check("v56 offline food search skips network and shows local results immediately", O56.window.__netCalls.length===0 && dO56.getElementById("results").children.length>0 && /Open Food Facts was skipped/.test(dO56.getElementById("searchErr").textContent));
dO56.getElementById("barcodeInput").value="999999";
await O56.window.eval("runBarcode()");
check("v56 offline barcode lookup skips network and opens manual entry", O56.window.__netCalls.length===0 && !dO56.getElementById("customCard").classList.contains("hidden") && /Open Food Facts was skipped/.test(dO56.getElementById("searchErr").textContent));
dO56.getElementById("scanBtn").dispatchEvent(new O56.window.Event("click",{bubbles:true}));
await wait(5);
check("v56 offline scanner fast-fails without loading its external library", O56.window.__netCalls.length===0 && /needs a connection/.test(dO56.getElementById("scanErr").textContent) && ![...dO56.querySelectorAll('script[src]')].some(x=>/html5-qrcode/.test(x.src)));
check("offline AI handoff remains local and makes no network request", O56.window.__netCalls.length===0 && O56.window.eval("foodHandoffEnabled()")===true);

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
const A57=boot(V2_CFG,V2_DATA,null,TEST_PROGRAM);
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
check("onboarding explains food logging without obsolete credential language or fields",
  /Search packaged foods or scan a barcode when connected/.test(
    dFresh57.getElementById("setupBody").textContent
  ) &&
  /If a product is missing, enter the nutrition label/.test(
    dFresh57.getElementById("setupBody").textContent
  ) &&
  !/account or API key/i.test(dFresh57.getElementById("setupBody").textContent) &&
  dFresh57.getElementById("suUsda")===null);
dFresh57.getElementById("setupNext").click();
await wait(20);
check("keyless onboarding advances without saving a USDA credential",
  fresh57.window.eval(`setupStep===7 && !Object.prototype.hasOwnProperty.call(cfg,"usdaKey")`));

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
check(
  "controllerchange listener attached before register()",
  (() => {
    const source = fs.readFileSync(
      path.join(__dirname,"..","scripts","07-boot.js"),
      "utf8"
    );

    const listenerAt = source.indexOf(
      "navigator.serviceWorker.addEventListener(\"controllerchange\""
    );

    const registerAt = source.indexOf(
      "navigator.serviceWorker.register("
    );

    return (
      listenerAt >= 0
      && registerAt >= 0
      && listenerAt < registerAt
    );
  })()
);
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


// ================= v76: unified exercise library + exercise-defined tracking =================
const exerciseFixture76 = JSON.parse(fs.readFileSync(
  path.join(__dirname,"fixtures","exercise-model-cross-platform.json"),
  "utf8"
));
const exerciseBackup76 = exerciseFixture76.backup;
const exerciseProgram76 = {
  name:"Six Shapes",
  days:[{id:"D1",title:"All shapes",exercises:[
    {name:"Bench Press",scheme:"3×5"},
    {name:"Pull-Up",scheme:"3×8"},
    {name:"Run",scheme:""},
    {name:"Farmer Carry",scheme:""},
    {name:"Sprint Intervals",scheme:""},
    {name:"Mobility Flow",scheme:""}
  ]}]
};
const Exercise76 = boot(V2_CFG,Object.assign({},V2_DATA,{myExercises:{},activeWorkoutDraft:null}),null,exerciseProgram76);
const dExercise76 = Exercise76.window.document;

check("v76 canonical exercise payload loads before the app slices",
  Exercise76.window.eval(`Array.isArray(EXERCISE_LIBRARY) && EXERCISE_LIBRARY.length>=150 && EXERCISE_LIBRARY.length<=300`)
  && Exercise76.window.eval(`validateBuiltInExerciseLibrary()===true`));

check("v76 one program day renders all six closed tracking shapes",
  ["lift","reps","timeDist","carry","rounds","text"].every(shape=>
    dExercise76.querySelector('#exerciseInputs .exercise[data-shape="'+shape+'"]')
  ));

check("v76 new exercise programs use shapes without the retired Cardio prefix",
  !exerciseProgram76.days[0].exercises.some(ex=>/^\[Cardio\]/.test(ex.name))
  && Exercise76.window.eval(`exerciseDescriptor("Run",null).shape`)==="timeDist");

Exercise76.window.eval(`
  sessionState["Bench Press"].rows=[{w:135,r:5,touched:true}];
  sessionState["Pull-Up"].rows=[{w:"",r:8,touched:true},{w:25,r:5,touched:true}];
  sessionState["Run"].typed={hours:0,minutes:20,seconds:0,distance:2,distanceUnit:"mi",pace:"",effort:""}; sessionState["Run"].fields=sessionState["Run"].typed; sessionState["Run"].typedTouched=true;
  sessionState["Farmer Carry"].typed={count:4,lbs:80,distance:100,distanceUnit:"ft",durationMinutes:"",durationSeconds:"",recoverySeconds:"",effort:""}; sessionState["Farmer Carry"].fields=sessionState["Farmer Carry"].typed; sessionState["Farmer Carry"].typedTouched=true;
  sessionState["Sprint Intervals"].typed={intervals:8,workMinutes:0,workSeconds:20,recoverySeconds:100,distance:"",distanceUnit:"mi",effort:"hard"}; sessionState["Sprint Intervals"].fields=sessionState["Sprint Intervals"].typed; sessionState["Sprint Intervals"].typedTouched=true;
  sessionState["Mobility Flow"].typed={hours:0,minutes:20,seconds:0,note:"hips felt good"}; sessionState["Mobility Flow"].fields=sessionState["Mobility Flow"].typed; sessionState["Mobility Flow"].typedTouched=true;
`);
const saveResults76 = ["Bench Press","Pull-Up","Run","Farmer Carry","Sprint Intervals","Mobility Flow"]
  .map(name=>Exercise76.window.eval(`saveExercise(${JSON.stringify(name)}).ok`));
const draftForms76 = Exercise76.window.eval(`cloneJSON(data.activeWorkoutDraft.sets)`);
check("v76 every shape uses the unchanged Save Exercise lifecycle", saveResults76.every(Boolean)
  && dExercise76.querySelectorAll("#exerciseInputs .savedChip").length===6);
check("v76 lift and reps share the array storage form while bodyweight weight stays optional",
  Array.isArray(draftForms76["Bench Press"])
  && draftForms76["Bench Press"][0].w===135
  && Array.isArray(draftForms76["Pull-Up"])
  && !Object.prototype.hasOwnProperty.call(draftForms76["Pull-Up"][0],"w")
  && draftForms76["Pull-Up"][1].w===25);
check("v76 typed shapes store only their contract primitives",
  draftForms76["Run"].t==="timeDist"
  && draftForms76["Run"].secs===1200
  && draftForms76["Run"].dist===2
  && draftForms76["Run"].distUnit==="mi"
  && draftForms76["Farmer Carry"].t==="loadedDistance"
  && draftForms76["Farmer Carry"].count===4
  && draftForms76["Farmer Carry"].lbs===80
  && draftForms76["Farmer Carry"].dist===100
  && draftForms76["Farmer Carry"].distUnit==="ft"
  && draftForms76["Sprint Intervals"].t==="timedIntervals"
  && draftForms76["Sprint Intervals"].intervals===8
  && draftForms76["Sprint Intervals"].workSecs===20
  && draftForms76["Sprint Intervals"].recSecs===100
  && draftForms76["Sprint Intervals"].effort==="hard"
  && draftForms76["Mobility Flow"].t==="durationActivity"
  && draftForms76["Mobility Flow"].secs===1200
  && draftForms76["Mobility Flow"].note==="hips felt good");

const SaveFailure76 = boot(V2_CFG,Object.assign({},V2_DATA,{myExercises:{},activeWorkoutDraft:null}),null,TEST_PROGRAM);
SaveFailure76.window.eval(`sessionState["Bench Press"].saved=[{w:100,r:5}];sessionState["Bench Press"].status="unsaved";sessionState["Bench Press"].historyKey="Bench Press";sessionState["Bench Press"].rows=[{w:135,r:5,touched:true}];`);
const saveFailureProto76=Object.getPrototypeOf(SaveFailure76.window.localStorage),saveFailureSet76=saveFailureProto76.setItem;
saveFailureProto76.setItem=function(k,v){if(k==="forge:data")throw new Error("blocked");return saveFailureSet76.call(this,k,v);};
const saveFailureResult76=SaveFailure76.window.eval(`saveExercise("Bench Press")`);
saveFailureProto76.setItem=saveFailureSet76;
check("v76 failed draft persistence restores the prior saved exercise state",
  saveFailureResult76.ok===false
  && SaveFailure76.window.eval(`sessionState["Bench Press"].status`)==="unsaved"
  && SaveFailure76.window.eval(`sessionState["Bench Press"].saved[0].w`)===100
  && SaveFailure76.window.eval(`sessionState["Bench Press"].historyKey`)==="Bench Press"
  && SaveFailure76.window.eval(`data.activeWorkoutDraft===null`));

const Create76 = boot(V2_CFG,Object.assign({},V2_DATA,{myExercises:{},activeWorkoutDraft:null}),null,TEST_PROGRAM);
const createCollision76 = Create76.window.eval(`createUserExercise("chest press","lift")`);
const createMine76 = Create76.window.eval(`createUserExercise("Tempo Step Intervals","rounds")`);
const createdId76 = createMine76.entry && createMine76.entry.id;
const renameMine76 = Create76.window.eval(`renameUserExercise(${JSON.stringify(createdId76)},"Tempo Step Pattern")`);
check("v76 user creation rejects the global built-in name and alias union",
  createCollision76.ok===false && /conflicts/i.test(createCollision76.reason));
check("v76 user exercises persist beside built-ins with a permanent u id",
  createMine76.ok && /^u:/.test(createdId76)
  && Create76.window.eval(`data.myExercises[${JSON.stringify(createdId76)}].shape`)==="rounds");
check("v76 rename appends an immutable normalized former name and resolves old history",
  renameMine76.ok
  && renameMine76.entry.formerNames.includes("tempo step intervals")
  && Create76.window.eval(`resolveExerciseByName("Tempo Step Intervals").id`)===createdId76);
check("v76 library search covers aliases and tags and hides archived user exercises",
  Create76.window.eval(`searchExercises("chest press",20).some(x=>x.name==="Bench Press")`)
  && Create76.window.eval(`searchExercises("conditioning",80).some(x=>x.id===${JSON.stringify(createdId76)})`));

Create76.window.eval(`program.days[0].exercises.push({name:"Tempo Step Intervals",scheme:""})`);
const archived76 = Create76.window.eval(`archiveOrDeleteUserExercise(${JSON.stringify(createdId76)})`);
check("v76 referenced user exercises archive instead of hard deleting",
  archived76.ok && archived76.archived
  && Create76.window.eval(`data.myExercises[${JSON.stringify(createdId76)}].deprecated===true`)
  && !Create76.window.eval(`searchExercises("Tempo Step Pattern",80).some(x=>x.id===${JSON.stringify(createdId76)})`)
  && Create76.window.eval(`resolveExerciseByName("Tempo Step Intervals").id`)===createdId76);
const unused76 = Create76.window.eval(`createUserExercise("Disposable Test Movement","text")`);
const deleted76 = Create76.window.eval(`archiveOrDeleteUserExercise(${JSON.stringify(unused76.entry && unused76.entry.id)})`);
check("v76 unreferenced user exercises may be hard deleted", unused76.ok && deleted76.ok && deleted76.deleted);

const futureUser76 = Create76.window.eval(`createUserExercise("Future Collision","text")`);
Create76.window.eval(`renameUserExercise(${JSON.stringify(futureUser76.entry && futureUser76.entry.id)},"User-Owned Movement")`);
const futureTie76 = Create76.window.eval(`(()=>{
  const synthetic={id:"bp:future-collision-test",name:"Future Collision",shape:"text",tags:[],aliases:[],formerNames:[],muscles:{primary:["full-body"],secondary:[]},equipment:["other"],unilateral:false,bodyweight:false,deprecated:false};
  EXERCISE_LIBRARY.push(synthetic);
  const found=resolveExerciseByName("Future Collision");
  const results=searchExercises("Future Collision",20);
  const byId=exerciseById(synthetic.id);
  EXERCISE_LIBRARY.pop();
  return {
    resolvedId:found&&found.id,
    userSearch:results.some(entry=>entry.id===${JSON.stringify(futureUser76.entry && futureUser76.entry.id)}),
    builtInSearch:results.some(entry=>entry.id===synthetic.id),
    builtInById:byId&&byId.id
  };
})()`);
check("v76 future built-in naming collisions keep user resolution and safe name-based selection while retaining id access",
  futureTie76.resolvedId===futureUser76.entry.id
  && futureTie76.userSearch===true
  && futureTie76.builtInSearch===false
  && futureTie76.builtInById==="bp:future-collision-test");

check("v76 swaps only offer alternatives using the same tracking shape",
  Create76.window.eval(`swapOptionsForExercise("Bench Press","Bench Press").length>0
    && swapOptionsForExercise("Bench Press","Bench Press").every(name=>resolveExerciseByName(name).shape==="lift")`));
check("v76 legacy Cardio program names remain readable without being written for new entries",
  Create76.window.eval(`exerciseDescriptor("[Cardio] Run","20 min").shape`)==="timeDist"
  && Create76.window.eval(`findHistoryValue({"[Cardio] Run":"20 min"},exerciseDescriptor("Run",null)).value`)==="20 min"
  && [...dExercise76.getElementById("wDay").options].some(o=>o.value==="__CARDIO__"));

const alphabeticalSelect76=dExercise76.getElementById("addExSel");
dExercise76.getElementById("exerciseSearch").value="";
Exercise76.window.eval("renderLibraryOptions()");

check("v76 exercise picker keeps shape sections alphabetical and complete",
  Exercise76.window.eval(`(()=>{
    const select=document.getElementById("addExSel");
    const groups=[...select.querySelectorAll("optgroup")]
      .filter(group=>group.label!=="My library");

    const ids=groups.flatMap(group=>
      [...group.querySelectorAll("option")].map(option=>option.value)
    );

    const expectedIds=allExerciseEntries(false).map(entry=>entry.id);

    const alphabetical=groups.every(group=>{
      const names=[...group.querySelectorAll("option")]
        .map(option=>exerciseById(option.value).name);
      const sorted=names.slice().sort((a,b)=>a.localeCompare(b));
      return JSON.stringify(names)===JSON.stringify(sorted);
    });

    return alphabetical
      && ids.length===expectedIds.length
      && new Set(ids).size===expectedIds.length
      && ids.includes("bp:pull-up")
      && ids.includes("bp:chin-up");
  })()`));

dExercise76.getElementById("exerciseSearch").value="pull";
Exercise76.window.eval("renderLibraryOptions()");
const firstPull76=[...dExercise76.getElementById("addExSel").options].find(option=>option.value.startsWith("bp:"));

dExercise76.getElementById("exerciseSearch").value="chin";
Exercise76.window.eval("renderLibraryOptions()");
const firstChin76=[...dExercise76.getElementById("addExSel").options].find(option=>option.value.startsWith("bp:"));

check("v76 search surfaces Pull-Up and Chin-Up ahead of weaker matches",
  firstPull76.value==="bp:pull-up"
  && firstChin76.value==="bp:chin-up");

check("custom exercise action stays at the top of the exercise picker",
  dExercise76.getElementById("addExSel").options[0].value==="__CUSTOM__");

dExercise76.getElementById("addExSel").value="__CUSTOM__";
dExercise76.getElementById("addExSel").dispatchEvent(new Exercise76.window.Event("change",{bubbles:true}));
check("Add custom exercise reveals its name and tracking options",
  !dExercise76.getElementById("customExerciseFields").classList.contains("hidden")
  && Exercise76.window.eval(`ensureFreestyleCustomShapeSelect().id`)==="addExShape");

check("custom exercise tracking offers a plainly labeled Time option",
  Exercise76.window.eval(`EXERCISE_SHAPES.includes("duration")`)
  && [...dExercise76.getElementById("addExShape").options]
    .some(option=>option.value==="duration" && option.textContent==="Time"));

check("custom Time exercise creates a duration-only workout profile",
  Exercise76.window.eval(`(()=>{
    const created=createUserExercise("Pickup Basketball","duration");
    if(!created.ok) return false;
    const entry=data.myExercises[created.entry.id];
    const resolved=BP_WORKOUT_PROFILES.resolve(entry,{});
    const fields=BP_WORKOUT_PROFILES.fields(resolved.profile,resolved.options);
    return entry.shape==="duration"
      && entry.tags.includes("sport")
      && resolved.profile==="durationActivity"
      && resolved.options.timeOnly===true
      && fields.map(field=>field.key).join(",")==="hours,minutes,seconds";
  })()`));

check("v76 legacy cardio selector is alphabetical with Other last",
  Exercise76.window.eval(`(()=>{
    const names=[...document.getElementById("cardioType").options]
      .map(o=>o.textContent);
    const exercises=names.filter(name=>name!=="Other");
    const sorted=exercises.slice().sort((a,b)=>a.localeCompare(b));
    return JSON.stringify(exercises)===JSON.stringify(sorted)
      && names[names.length-1]==="Other";
  })()`));

dExercise76.getElementById("exerciseSearch").value="";
Exercise76.window.eval("renderLibraryOptions()");

const Unknown76 = boot(V2_CFG,Object.assign({},V2_DATA,{
  myExercises:{},
  activeWorkoutDraft:{date:dstr(0),day:"D1",title:"Future draft",sets:{"Future Shape":{t:"futureShape",payload:{keep:true}}},notes:"",updatedAt:new Date().toISOString()}
}),null,{name:"Future",days:[{id:"D1",title:"Future",exercises:[{name:"Future Shape",scheme:""}]}]});
Unknown76.window.eval(`resumeWorkoutDraft()`);
const unknownBefore76 = Unknown76.window.eval(`JSON.stringify(data.activeWorkoutDraft.sets["Future Shape"])`);
check("v76 unknown typed values render read-only with newer-version notice",
  Unknown76.window.document.querySelectorAll(".newer-shape-notice").length===1
  && /newer BlackPyre version/i.test(Unknown76.window.document.querySelector(".newer-shape-notice").textContent)
  && !Unknown76.window.document.querySelector('#exerciseInputs .exercise[data-shape="unknown"] .saveExBtn'));
check("v76 unknown typed values survive resume and render byte-for-byte",
  Unknown76.window.eval(`JSON.stringify(data.activeWorkoutDraft.sets["Future Shape"])`)===unknownBefore76);

const Draft76 = boot(exerciseBackup76.cfg,exerciseBackup76.data,null,exerciseBackup76.program);
const draftBefore76 = Draft76.window.eval(`JSON.stringify(data.activeWorkoutDraft.sets)`);
Draft76.window.eval(`resumeWorkoutDraft(); persistWorkoutDraft();`);
check("v76 drafts round-trip every supplied form through resume and re-persist",
  Draft76.window.eval(`JSON.stringify(data.activeWorkoutDraft.sets)`)===draftBefore76);

const PrepareFixture76 = boot(V2_CFG,V2_DATA,null,TEST_PROGRAM);
const preparedFixture76 = PrepareFixture76.window.eval(`prepareRecoveryBackupEnvelope(${JSON.stringify(exerciseBackup76)})`);
check("v76 the shared cross-platform fixture passes the real backup preparation pipeline",
  preparedFixture76.ok && preparedFixture76.prepared.state.cfg.schemaVersion===3
  && preparedFixture76.prepared.state.data.workouts[0].sets["Future Shape"].payload.keep===true);

const RestoreFixture76 = boot(V2_CFG,V2_DATA,null,TEST_PROGRAM);
const restoredFixture76 = RestoreFixture76.window.eval(`restoreBackupEnvelope(${JSON.stringify(exerciseBackup76)})`);
check("v76 web restore accepts mixed old and new history forms",
  restoredFixture76.ok
  && RestoreFixture76.window.eval(`data.workouts[0].sets["Pull-Up"][0].r`)===8
  && RestoreFixture76.window.eval(`data.workouts[0].sets["Run"].t`)==="timeDist"
  && RestoreFixture76.window.eval(`data.workouts[0].sets["Future Shape"].payload.keep===true`));
check("v76 restore preserves user exercise former-name identity",
  RestoreFixture76.window.eval(`resolveExerciseByName("Tempo Step Intervals").id`)==="u:cross-platform-tempo-step");

RestoreFixture76.window.eval(`window.__exerciseBackup=null; download=(name,text)=>{window.__exerciseBackup={name,text};}; doBackup("exportDataBtn");`);
const reexport76 = JSON.parse(RestoreFixture76.window.eval(`window.__exerciseBackup.text`));
check("v76 restored exercise forms export again without loss",
  JSON.stringify(reexport76.data.workouts[0].sets)===JSON.stringify(exerciseBackup76.data.workouts[0].sets)
  && JSON.stringify(reexport76.data.activeWorkoutDraft.sets)===JSON.stringify(exerciseBackup76.data.activeWorkoutDraft.sets)
  && JSON.stringify(reexport76.data.myExercises)===JSON.stringify(exerciseBackup76.data.myExercises));

const rangeMixed76 = JSON.parse(JSON.stringify(exerciseBackup76));
delete rangeMixed76.cfg.schemaVersion;
delete rangeMixed76.cfg.calTarget;
delete rangeMixed76.cfg.proTarget;
rangeMixed76.cfg.calLo=1500; rangeMixed76.cfg.calHi=1700;
rangeMixed76.cfg.proLo=160; rangeMixed76.cfg.proHi=180;
const RangeMixed76 = boot(V2_CFG,V2_DATA,null,TEST_PROGRAM);
const restoredRangeMixed76 = RangeMixed76.window.eval(`restoreBackupEnvelope(${JSON.stringify(rangeMixed76)})`);
check("v76 range-era backups migrate while retaining every new exercise form",
  restoredRangeMixed76.ok
  && RangeMixed76.window.eval(`cfg.schemaVersion`)===3
  && RangeMixed76.window.eval(`cfg.calTarget`)===1600
  && RangeMixed76.window.eval(`data.workouts[0].sets["Farmer Carry"].t`)==="carry"
  && RangeMixed76.window.eval(`data.activeWorkoutDraft.sets["Tempo Step Intervals"].t`)==="rounds");

const NewerForms76 = boot(V2_CFG,V2_DATA,null,TEST_PROGRAM);
const newerExerciseBackup76 = JSON.parse(JSON.stringify(exerciseBackup76));
newerExerciseBackup76.cfg.schemaVersion=99;
const newerRefusal76 = NewerForms76.window.eval(`restoreBackupEnvelope(${JSON.stringify(newerExerciseBackup76)})`);
check("v76 newer-version refusal protects backups containing the new exercise forms",
  !newerRefusal76.ok && NewerForms76.window.eval(`protectedMode===false`)
  && NewerForms76.window.eval(`data.workouts.length===0`));




const ManagerLabelsData76 = JSON.parse(JSON.stringify(V2_DATA));
ManagerLabelsData76.workouts = [{
  date:"2026-07-27",
  day:"__FREE__",
  title:"Freestyle",
  sets:{
    "Garage Tire Flip":{
      t:"carry",
      lbs:100,
      dist:20,
      distUnit:"ft"
    }
  },
  notes:""
}];
ManagerLabelsData76.myExercises = {
  "u:tire":{
    id:"u:tire",
    name:"Garage Tire Carry",
    shape:"carry",
    tags:["strength","carry"],
    aliases:[],
    formerNames:["garage tire flip"],
    muscles:{primary:["full-body"],secondary:[]},
    equipment:["other"],
    unilateral:false,
    bodyweight:false,
    deprecated:true
  },
  "u:unused":{
    id:"u:unused",
    name:"Unused Custom",
    shape:"text",
    tags:[],
    aliases:[],
    formerNames:[],
    muscles:{primary:["full-body"],secondary:[]},
    equipment:["other"],
    unilateral:false,
    bodyweight:false,
    deprecated:true
  }
};
ManagerLabelsData76.activeWorkoutDraft = null;

const ManagerLabels76 = boot(
  V2_CFG,
  ManagerLabelsData76,
  null,
  TEST_PROGRAM
);
const dManagerLabels76 = ManagerLabels76.window.document;

ManagerLabels76.window.eval(`renderMyExercisesManager()`);

let managerRows76 = [
  ...dManagerLabels76.querySelectorAll(
    "#myExercisesList .my-exercise-row"
  )
];

let referencedArchivedRow76 = managerRows76.find(
  row=>row.querySelector("b").textContent==="Garage Tire Carry"
);
const unusedArchivedRow76 = managerRows76.find(
  row=>row.querySelector("b").textContent==="Unused Custom"
);

let referencedArchivedButtons76 = [
  ...referencedArchivedRow76.querySelectorAll("button")
];
const unusedArchivedButtons76 = [
  ...unusedArchivedRow76.querySelectorAll("button")
];

check(
  "v76 archived referenced exercise offers Restore and history protection",
  ManagerLabels76.window.eval(
    `userExerciseReferenceCount(data.myExercises["u:tire"])===1`
  )
  && referencedArchivedButtons76.some(
    button=>button.textContent==="Restore" && !button.disabled
  )
  && referencedArchivedButtons76.some(
    button=>
      button.textContent==="Protected by history"
      && button.disabled
  )
  && !referencedArchivedButtons76.some(
    button=>button.textContent==="Delete"
  )
);

check(
  "v76 archived unused exercise offers both Restore and Delete",
  unusedArchivedButtons76.some(
    button=>button.textContent==="Restore" && !button.disabled
  )
  && unusedArchivedButtons76.some(
    button=>button.textContent==="Delete" && !button.disabled
  )
);

const restoreReferenced76 = referencedArchivedButtons76.find(
  button=>button.textContent==="Restore"
);
restoreReferenced76.dispatchEvent(
  new ManagerLabels76.window.Event("click",{bubbles:true})
);

managerRows76 = [
  ...dManagerLabels76.querySelectorAll(
    "#myExercisesList .my-exercise-row"
  )
];

referencedArchivedRow76 = managerRows76.find(
  row=>row.querySelector("b").textContent==="Garage Tire Carry"
);

referencedArchivedButtons76 = [
  ...referencedArchivedRow76.querySelectorAll("button")
];

check(
  "v76 restoring a referenced exercise makes it active and searchable again",
  ManagerLabels76.window.eval(
    `data.myExercises["u:tire"].deprecated===false`
  )
  && ManagerLabels76.window.eval(
    `searchExercises("Garage Tire",202).some(
      entry=>entry.id==="u:tire" && !entry.deprecated
    )`
  )
  && referencedArchivedButtons76.some(
    button=>button.textContent==="Archive" && !button.disabled
  )
  && !referencedArchivedButtons76.some(
    button=>button.textContent==="Restore"
  )
);


const LiveRenameData76 = JSON.parse(JSON.stringify(V2_DATA));
LiveRenameData76.myExercises = {
  "u:live-rename":{
    id:"u:live-rename",
    name:"Garage Tire Flip",
    shape:"carry",
    tags:["strength","carry"],
    aliases:[],
    formerNames:[],
    muscles:{
      primary:["full-body"],
      secondary:[]
    },
    equipment:["other"],
    unilateral:false,
    bodyweight:false,
    deprecated:false
  }
};
LiveRenameData76.activeWorkoutDraft = {
  date:"2026-07-27",
  day:"__FREE__",
  title:"Freestyle",
  sets:{
    "Garage Tire Flip":{
      t:"carry",
      lbs:100,
      dist:20,
      distUnit:"ft"
    }
  },
  notes:"",
  updatedAt:"2026-07-27T12:00:00.000Z"
};

const LiveRename76 = boot(
  V2_CFG,
  LiveRenameData76,
  null,
  TEST_PROGRAM
);

LiveRename76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;

  extraExercises=[{
    id:"u:live-rename",
    name:"Garage Tire Flip",
    shape:"carry",
    scheme:""
  }];

  const liveEntry=data.myExercises["u:live-rename"];

  sessionState={
    "Garage Tire Flip":stateFromStoredValue(
      liveEntry,
      {
        t:"carry",
        lbs:100,
        dist:20,
        distUnit:"ft"
      },
      "saved",
      "Garage Tire Flip",
      false
    )
  };

  const renamed=renameUserExercise(
    "u:live-rename",
    "Garage Tire Carry"
  );

  rekeyOpenSessionExercise(
    renamed.previousName,
    renamed.entry
  );

  renderSessionInputs();
`);

check(
  "v76 renaming an exercise in an open workout preserves visible state and rekeys its draft",
  LiveRename76.window.eval(`
    !Object.prototype.hasOwnProperty.call(
      sessionState,
      "Garage Tire Flip"
    )
    && sessionState["Garage Tire Carry"].saved.lbs===100
    && sessionState["Garage Tire Carry"].saved.dist===20
    && sessionState["Garage Tire Carry"].historyKey
      ==="Garage Tire Carry"
    && extraExercises.length===1
    && extraExercises[0].name==="Garage Tire Carry"
    && !Object.prototype.hasOwnProperty.call(
      data.activeWorkoutDraft.sets,
      "Garage Tire Flip"
    )
    && data.activeWorkoutDraft.sets[
      "Garage Tire Carry"
    ].lbs===100
    && Object.keys(
      collectSavedSessionSets(sessionState).sets
    ).join(",")==="Garage Tire Carry"
  `)
  && LiveRename76.window.document
    .querySelectorAll(
      '#exerciseInputs .exercise[data-shape="carry"]'
    ).length===1
  && /100 lb · 20 ft/.test(
    LiveRename76.window.document
      .getElementById("exerciseInputs")
      .textContent
  )
);


const SwappedBaseRenameData76 =
  JSON.parse(JSON.stringify(V2_DATA));

SwappedBaseRenameData76.myExercises = {
  "u:swapped-base":{
    id:"u:swapped-base",
    name:"Garage Sled Drag",
    shape:"carry",
    tags:["strength","carry"],
    aliases:[],
    formerNames:[],
    muscles:{
      primary:["full-body"],
      secondary:[]
    },
    equipment:["other"],
    unilateral:false,
    bodyweight:false,
    deprecated:false
  }
};
SwappedBaseRenameData76.activeWorkoutDraft=null;

const SwappedBaseRename76=boot(
  V2_CFG,
  SwappedBaseRenameData76,
  null,
  TEST_PROGRAM
);

SwappedBaseRename76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;

  extraExercises=[{
    id:"u:swapped-base",
    name:"Garage Sled Drag",
    shape:"carry",
    scheme:""
  }];

  sessionSwaps={
    "Garage Sled Drag":"Farmer Carry"
  };

  const farmer=exerciseDescriptor(
    "Farmer Carry",
    null
  );

  sessionState={
    "Farmer Carry":stateFromStoredValue(
      farmer,
      {
        t:"carry",
        lbs:90,
        dist:30,
        distUnit:"ft"
      },
      "saved",
      "Farmer Carry",
      false
    )
  };

  const renamed=renameUserExercise(
    "u:swapped-base",
    "Garage Sled Pull"
  );

  rekeyOpenSessionExercise(
    renamed.previousName,
    renamed.entry
  );

  renderSessionInputs();
`);

check(
  "v76 renaming a swapped-out extra exercise preserves the active swap and completed state",
  SwappedBaseRename76.window.eval(`
    extraExercises.length===1
    && extraExercises[0].name==="Garage Sled Pull"
    && !Object.prototype.hasOwnProperty.call(
      sessionSwaps,
      "Garage Sled Drag"
    )
    && sessionSwaps["Garage Sled Pull"]
      ==="Farmer Carry"
    && sessionList().length===1
    && sessionList()[0].name==="Farmer Carry"
    && sessionState["Farmer Carry"].saved.lbs===90
    && sessionState["Farmer Carry"].saved.dist===30
  `)
  && /Farmer Carry/.test(
    SwappedBaseRename76.window.document
      .getElementById("exerciseInputs")
      .textContent
  )
  && /90 lb · 30 ft/.test(
    SwappedBaseRename76.window.document
      .getElementById("exerciseInputs")
      .textContent
  )
);

const DeleteOpenData76 =
  JSON.parse(JSON.stringify(V2_DATA));

DeleteOpenData76.myExercises = {
  "u:delete-open":{
    id:"u:delete-open",
    name:"Disposable Open Carry",
    shape:"carry",
    tags:["strength","carry"],
    aliases:[],
    formerNames:[],
    muscles:{
      primary:["full-body"],
      secondary:[]
    },
    equipment:["other"],
    unilateral:false,
    bodyweight:false,
    deprecated:false
  }
};
DeleteOpenData76.activeWorkoutDraft=null;

const DeleteOpen76=boot(
  V2_CFG,
  DeleteOpenData76,
  null,
  TEST_PROGRAM
);

DeleteOpen76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;

  const entry=data.myExercises["u:delete-open"];

  extraExercises=[{
    id:entry.id,
    name:entry.name,
    shape:entry.shape,
    scheme:""
  }];

  sessionSwaps={
    "Disposable Open Carry":"Farmer Carry"
  };

  const farmer=exerciseDescriptor(
    "Farmer Carry",
    null
  );

  sessionState={
    "Farmer Carry":stateFromStoredValue(
      farmer,
      {
        t:"carry",
        lbs:70,
        dist:20,
        distUnit:"ft"
      },
      "saved",
      "Farmer Carry",
      false
    )
  };

  const deleted=archiveOrDeleteUserExercise(
    entry.id
  );

  renderLibraryOptions();
  renderSessionInputs();
`);

check(
  "v76 deleting an unused open custom exercise removes its transient card, swap, and state",
  DeleteOpen76.window.eval(`
    !data.myExercises["u:delete-open"]
    && extraExercises.length===0
    && Object.keys(sessionSwaps).length===0
    && Object.keys(sessionState).length===0
    && sessionList().length===0
    && !searchExercises(
      "Disposable Open Carry",
      20
    ).some(
      entry=>entry.id==="u:delete-open"
    )
  `)
  && /No exercises yet/.test(
    DeleteOpen76.window.document
      .getElementById("exerciseInputs")
      .textContent
  )
);

// ================= v76: complete custom-exercise lifecycle hardening =================
releaseTestWindows([
  Exercise76,SaveFailure76,Create76,Unknown76,Draft76,PrepareFixture76,
  RestoreFixture76,RangeMixed76,NewerForms76,ManagerLabels76
]);
function customCarryEntry76(id,name,formerNames){
  return {
    id:id,
    name:name,
    shape:"carry",
    tags:["strength","carry"],
    aliases:[],
    formerNames:formerNames||[],
    muscles:{primary:["full-body"],secondary:[]},
    equipment:["other"],
    unilateral:false,
    bodyweight:false,
    deprecated:false
  };
}
function carryValue76(lbs,dist){
  return {
    t:"carry",
    lbs:lbs,
    dist:dist,
    distUnit:"ft"
  };
}
function benchValue76(weight,reps){
  return [{w:weight,r:reps}];
}

const DeleteSwappedDraftData76=
  JSON.parse(JSON.stringify(V2_DATA));
DeleteSwappedDraftData76.myExercises={
  "u:delete-swapped":customCarryEntry76(
    "u:delete-swapped",
    "Disposable Sled Drag"
  )
};
DeleteSwappedDraftData76.activeWorkoutDraft={
  date:dstr(0),
  day:"__FREE__",
  title:"Freestyle",
  sets:{
    "Farmer Carry":carryValue76(90,30),
    "Bench Press":benchValue76(135,8)
  },
  notes:"",
  updatedAt:"2026-07-27T12:00:00.000Z"
};
const DeleteSwappedDraft76=boot(
  V2_CFG,
  DeleteSwappedDraftData76,
  null,
  TEST_PROGRAM
);
DeleteSwappedDraft76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;

  const custom=data.myExercises["u:delete-swapped"];
  const farmer=exerciseDescriptor("Farmer Carry",null);
  const bench=exerciseDescriptor("Bench Press",null);

  extraExercises=[
    {
      id:custom.id,
      name:custom.name,
      shape:custom.shape,
      scheme:""
    },
    {
      id:bench.id,
      name:bench.name,
      shape:bench.shape,
      scheme:""
    }
  ];

  sessionSwaps={
    "Disposable Sled Drag":"Farmer Carry"
  };

  sessionState={
    "Farmer Carry":stateFromStoredValue(
      farmer,
      ${JSON.stringify(carryValue76(90,30))},
      "saved",
      "Farmer Carry",
      false
    ),
    "Bench Press":stateFromStoredValue(
      bench,
      ${JSON.stringify(benchValue76(135,8))},
      "saved",
      "Bench Press",
      false
    )
  };

  window.__deleteSwappedDraft=
    archiveOrDeleteUserExercise(custom.id);

  renderLibraryOptions();
  renderSessionInputs();
`);
check(
  "v76 deleting a swapped custom base rebuilds the loaded draft and preserves unrelated saved exercises",
  DeleteSwappedDraft76.window.eval(`
    window.__deleteSwappedDraft.deleted===true
    && !data.myExercises["u:delete-swapped"]
    && extraExercises.length===1
    && extraExercises[0].name==="Bench Press"
    && Object.keys(sessionSwaps).length===0
    && !sessionState["Farmer Carry"]
    && sessionState["Bench Press"].saved[0].w===135
    && data.activeWorkoutDraft!==null
    && Object.keys(data.activeWorkoutDraft.sets).join(",")
      ==="Bench Press"
    && data.activeWorkoutDraft.sets["Bench Press"][0].r===8
  `)
  && !/Farmer Carry/.test(
    DeleteSwappedDraft76.window.document
      .getElementById("exerciseInputs")
      .textContent
  )
  && /135×8/.test(
    DeleteSwappedDraft76.window.document
      .getElementById("exerciseInputs")
      .textContent
  )
);

const DeleteLastDraftData76=
  JSON.parse(JSON.stringify(V2_DATA));
DeleteLastDraftData76.myExercises={
  "u:delete-last":customCarryEntry76(
    "u:delete-last",
    "Disposable Last Drag"
  )
};
DeleteLastDraftData76.activeWorkoutDraft={
  date:dstr(0),
  day:"__FREE__",
  title:"Freestyle",
  sets:{"Farmer Carry":carryValue76(80,20)},
  notes:"",
  updatedAt:"2026-07-27T12:00:00.000Z"
};
const DeleteLastDraft76=boot(
  V2_CFG,
  DeleteLastDraftData76,
  null,
  TEST_PROGRAM
);
DeleteLastDraft76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;

  const custom=data.myExercises["u:delete-last"];
  const farmer=exerciseDescriptor("Farmer Carry",null);

  extraExercises=[{
    id:custom.id,
    name:custom.name,
    shape:custom.shape,
    scheme:""
  }];
  sessionSwaps={
    "Disposable Last Drag":"Farmer Carry"
  };
  sessionState={
    "Farmer Carry":stateFromStoredValue(
      farmer,
      ${JSON.stringify(carryValue76(80,20))},
      "saved",
      "Farmer Carry",
      false
    )
  };

  window.__deleteLast=
    archiveOrDeleteUserExercise(custom.id);
  renderSessionInputs();
  renderWorkoutDraftCard();
`);
const DeleteLastReloadData76=JSON.parse(
  DeleteLastDraft76.window.eval(`JSON.stringify(data)`)
);
const DeleteLastReload76=boot(
  V2_CFG,
  DeleteLastReloadData76,
  null,
  TEST_PROGRAM
);
check(
  "v76 deleting the last swapped custom slot clears the saved draft so Resume cannot resurrect it",
  DeleteLastDraft76.window.eval(`
    window.__deleteLast.deleted===true
    && data.activeWorkoutDraft===null
    && sessionList().length===0
  `)
  && DeleteLastDraft76.window.document
    .getElementById("workoutDraftCard")
    .classList.contains("hidden")
  && DeleteLastReload76.window.eval(`
    data.activeWorkoutDraft===null
    && resumeWorkoutDraft()===false
  `)
);

const DeleteRollbackData76=
  JSON.parse(JSON.stringify(DeleteLastDraftData76));
DeleteRollbackData76.myExercises={
  "u:delete-rollback":customCarryEntry76(
    "u:delete-rollback",
    "Rollback Sled Drag"
  )
};
const DeleteRollback76=boot(
  V2_CFG,
  DeleteRollbackData76,
  null,
  TEST_PROGRAM
);
DeleteRollback76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;

  const custom=data.myExercises["u:delete-rollback"];
  const farmer=exerciseDescriptor("Farmer Carry",null);

  extraExercises=[{
    id:custom.id,
    name:custom.name,
    shape:custom.shape,
    scheme:""
  }];
  sessionSwaps={
    "Rollback Sled Drag":"Farmer Carry"
  };
  sessionState={
    "Farmer Carry":stateFromStoredValue(
      farmer,
      ${JSON.stringify(carryValue76(80,20))},
      "saved",
      "Farmer Carry",
      false
    )
  };

  const realSave=save;
  save=()=>false;
  window.__deleteRollback=
    archiveOrDeleteUserExercise(custom.id);
  save=realSave;
`);
check(
  "v76 failed hard deletion rolls back the custom exercise, open session, and loaded draft",
  DeleteRollback76.window.eval(`
    window.__deleteRollback.ok===false
    && !!data.myExercises["u:delete-rollback"]
    && extraExercises.length===1
    && extraExercises[0].name==="Rollback Sled Drag"
    && sessionSwaps["Rollback Sled Drag"]==="Farmer Carry"
    && sessionState["Farmer Carry"].saved.lbs===80
    && data.activeWorkoutDraft.sets["Farmer Carry"].dist===20
  `)
);

const ArchiveOpenData76=
  JSON.parse(JSON.stringify(V2_DATA));
ArchiveOpenData76.myExercises={
  "u:archive-open":customCarryEntry76(
    "u:archive-open",
    "Archive Open Carry"
  )
};
ArchiveOpenData76.activeWorkoutDraft={
  date:dstr(0),
  day:"__FREE__",
  title:"Freestyle",
  sets:{"Archive Open Carry":carryValue76(60,15)},
  notes:"",
  updatedAt:"2026-07-27T12:00:00.000Z"
};
const ArchiveOpen76=boot(
  V2_CFG,
  ArchiveOpenData76,
  null,
  TEST_PROGRAM
);
ArchiveOpen76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;

  const custom=data.myExercises["u:archive-open"];
  extraExercises=[{
    id:custom.id,
    name:custom.name,
    shape:custom.shape,
    scheme:""
  }];
  sessionState={
    "Archive Open Carry":stateFromStoredValue(
      custom,
      ${JSON.stringify(carryValue76(60,15))},
      "saved",
      "Archive Open Carry",
      false
    )
  };
  sessionSwaps={};

  window.__archiveOpen=
    archiveOrDeleteUserExercise(custom.id);
`);
check(
  "v76 archiving a referenced open custom exercise preserves its completed state and draft",
  ArchiveOpen76.window.eval(`
    window.__archiveOpen.archived===true
    && data.myExercises["u:archive-open"].deprecated===true
    && extraExercises.length===1
    && sessionState["Archive Open Carry"].saved.lbs===60
    && data.activeWorkoutDraft.sets["Archive Open Carry"].dist===15
  `)
);

const DeleteSwapTargetData76=
  JSON.parse(JSON.stringify(V2_DATA));
DeleteSwapTargetData76.myExercises={
  "u:delete-target":customCarryEntry76(
    "u:delete-target",
    "Temporary Carry Target"
  )
};
DeleteSwapTargetData76.activeWorkoutDraft=null;
const DeleteSwapTarget76=boot(
  V2_CFG,
  DeleteSwapTargetData76,
  null,
  TEST_PROGRAM
);
DeleteSwapTarget76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=false;

  const custom=data.myExercises["u:delete-target"];
  const farmer=exerciseDescriptor("Farmer Carry",null);

  extraExercises=[{
    id:farmer.id,
    name:farmer.name,
    shape:farmer.shape,
    scheme:""
  }];
  sessionSwaps={
    "Farmer Carry":"Temporary Carry Target"
  };
  sessionState={
    "Temporary Carry Target":blankShapeState(custom)
  };

  window.__deleteTarget=
    archiveOrDeleteUserExercise(custom.id);
  renderSessionInputs();
`);
check(
  "v76 deleting an unsaved custom swap target restores the original base exercise",
  DeleteSwapTarget76.window.eval(`
    window.__deleteTarget.deleted===true
    && !data.myExercises["u:delete-target"]
    && extraExercises.length===1
    && extraExercises[0].name==="Farmer Carry"
    && Object.keys(sessionSwaps).length===0
    && sessionList()[0].name==="Farmer Carry"
    && !!sessionState["Farmer Carry"]
  `)
  && /Farmer Carry/.test(
    DeleteSwapTarget76.window.document
      .getElementById("exerciseInputs")
      .textContent
  )
);

const RenameSwapTargetData76=
  JSON.parse(JSON.stringify(V2_DATA));
RenameSwapTargetData76.myExercises={
  "u:rename-target":customCarryEntry76(
    "u:rename-target",
    "Custom Carry Target"
  )
};
RenameSwapTargetData76.activeWorkoutDraft={
  date:dstr(0),
  day:"__FREE__",
  title:"Freestyle",
  sets:{"Custom Carry Target":carryValue76(75,25)},
  notes:"",
  updatedAt:"2026-07-27T12:00:00.000Z"
};
const RenameSwapTarget76=boot(
  V2_CFG,
  RenameSwapTargetData76,
  null,
  TEST_PROGRAM
);
RenameSwapTarget76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;

  const custom=data.myExercises["u:rename-target"];
  const farmer=exerciseDescriptor("Farmer Carry",null);

  extraExercises=[{
    id:farmer.id,
    name:farmer.name,
    shape:farmer.shape,
    scheme:""
  }];
  sessionSwaps={
    "Farmer Carry":"Custom Carry Target"
  };
  sessionState={
    "Custom Carry Target":stateFromStoredValue(
      custom,
      ${JSON.stringify(carryValue76(75,25))},
      "saved",
      "Custom Carry Target",
      false
    )
  };

  const renamed=renameUserExercise(
    custom.id,
    "Custom Carry Pull"
  );
  rekeyOpenSessionExercise(
    renamed.previousName,
    renamed.entry
  );
  renderSessionInputs();
`);
check(
  "v76 renaming a swapped-in custom target rekeys the swap, state, and loaded draft",
  RenameSwapTarget76.window.eval(`
    sessionSwaps["Farmer Carry"]==="Custom Carry Pull"
    && !sessionState["Custom Carry Target"]
    && sessionState["Custom Carry Pull"].saved.lbs===75
    && !data.activeWorkoutDraft.sets["Custom Carry Target"]
    && data.activeWorkoutDraft.sets["Custom Carry Pull"].dist===25
    && sessionList()[0].name==="Custom Carry Pull"
  `)
);

releaseTestWindows([
  LiveRename76,SwappedBaseRename76,DeleteOpen76,DeleteSwappedDraft76,
  DeleteLastDraft76,DeleteLastReload76,DeleteRollback76,ArchiveOpen76,
  DeleteSwapTarget76,RenameSwapTarget76
]);

const SwapSavedData76=
  JSON.parse(JSON.stringify(V2_DATA));
SwapSavedData76.activeWorkoutDraft={
  date:dstr(0),
  day:"__FREE__",
  title:"Freestyle",
  sets:{
    "Farmer Carry":carryValue76(90,30),
    "Bench Press":benchValue76(145,6)
  },
  notes:"",
  updatedAt:"2026-07-27T12:00:00.000Z"
};
const SwapSaved76=boot(
  V2_CFG,
  SwapSavedData76,
  null,
  TEST_PROGRAM
);
SwapSaved76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;
  confirm=()=>true;

  const farmer=exerciseDescriptor("Farmer Carry",null);
  const bench=exerciseDescriptor("Bench Press",null);

  extraExercises=[
    {id:farmer.id,name:farmer.name,shape:farmer.shape,scheme:""},
    {id:bench.id,name:bench.name,shape:bench.shape,scheme:""}
  ];
  sessionSwaps={};
  sessionState={
    "Farmer Carry":stateFromStoredValue(
      farmer,
      ${JSON.stringify(carryValue76(90,30))},
      "saved",
      "Farmer Carry",
      false
    ),
    "Bench Press":stateFromStoredValue(
      bench,
      ${JSON.stringify(benchValue76(145,6))},
      "saved",
      "Bench Press",
      false
    )
  };

  window.__swapSaved=applySwap(
    "Farmer Carry",
    "Farmer Carry",
    "Suitcase Carry"
  );
`);
check(
  "v76 swapping a completed exercise removes the old result from the loaded draft and preserves unrelated results",
  SwapSaved76.window.eval(`
    window.__swapSaved===true
    && sessionSwaps["Farmer Carry"]==="Suitcase Carry"
    && !sessionState["Farmer Carry"]
    && sessionState["Suitcase Carry"].saved===null
    && !data.activeWorkoutDraft.sets["Farmer Carry"]
    && data.activeWorkoutDraft.sets["Bench Press"][0].w===145
  `)
);

const SwapLastData76=JSON.parse(
  JSON.stringify(SwapSavedData76)
);
SwapLastData76.activeWorkoutDraft.sets={
  "Farmer Carry":carryValue76(90,30)
};
const SwapLast76=boot(
  V2_CFG,
  SwapLastData76,
  null,
  TEST_PROGRAM
);
SwapLast76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;
  confirm=()=>true;

  const farmer=exerciseDescriptor("Farmer Carry",null);
  extraExercises=[{
    id:farmer.id,
    name:farmer.name,
    shape:farmer.shape,
    scheme:""
  }];
  sessionSwaps={};
  sessionState={
    "Farmer Carry":stateFromStoredValue(
      farmer,
      ${JSON.stringify(carryValue76(90,30))},
      "saved",
      "Farmer Carry",
      false
    )
  };

  window.__swapLast=applySwap(
    "Farmer Carry",
    "Farmer Carry",
    "Suitcase Carry"
  );
`);
const SwapLastReloadData76=JSON.parse(
  SwapLast76.window.eval(`JSON.stringify(data)`)
);
const SwapLastReload76=boot(
  V2_CFG,
  SwapLastReloadData76,
  null,
  TEST_PROGRAM
);
check(
  "v76 swapping the last completed exercise clears the saved draft and Resume card",
  SwapLast76.window.eval(`
    window.__swapLast===true
    && data.activeWorkoutDraft===null
  `)
  && SwapLast76.window.document
    .getElementById("workoutDraftCard")
    .classList.contains("hidden")
  && SwapLastReload76.window.eval(`
    data.activeWorkoutDraft===null
    && resumeWorkoutDraft()===false
  `)
);

const SwapRollback76=boot(
  V2_CFG,
  SwapLastData76,
  null,
  TEST_PROGRAM
);
SwapRollback76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=true;
  confirm=()=>true;

  const farmer=exerciseDescriptor("Farmer Carry",null);
  extraExercises=[{
    id:farmer.id,
    name:farmer.name,
    shape:farmer.shape,
    scheme:""
  }];
  sessionSwaps={};
  sessionState={
    "Farmer Carry":stateFromStoredValue(
      farmer,
      ${JSON.stringify(carryValue76(90,30))},
      "saved",
      "Farmer Carry",
      false
    )
  };

  const realSave=save;
  save=()=>false;
  window.__swapRollback=applySwap(
    "Farmer Carry",
    "Farmer Carry",
    "Suitcase Carry"
  );
  save=realSave;
`);
check(
  "v76 failed swap persistence rolls back the swap, completed state, and draft",
  SwapRollback76.window.eval(`
    window.__swapRollback===false
    && Object.keys(sessionSwaps).length===0
    && sessionState["Farmer Carry"].saved.lbs===90
    && !sessionState["Suitcase Carry"]
    && data.activeWorkoutDraft.sets["Farmer Carry"].dist===30
  `)
);

const SwapCancelData76=
  JSON.parse(JSON.stringify(V2_DATA));
SwapCancelData76.activeWorkoutDraft=null;
const SwapCancel76=boot(
  V2_CFG,
  SwapCancelData76,
  null,
  TEST_PROGRAM
);
SwapCancel76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=false;
  confirm=()=>false;

  const farmer=exerciseDescriptor("Farmer Carry",null);
  const entered=blankShapeState(farmer);
  entered.typed={
    count:"",
    lbs:90,
    distance:30,
    distanceUnit:"ft",
    durationMinutes:"",
    durationSeconds:"",
    recoverySeconds:"",
    effort:""
  };
  entered.fields=entered.typed;
  entered.typedTouched=true;
  entered.status="unsaved";

  extraExercises=[{
    id:farmer.id,
    name:farmer.name,
    shape:farmer.shape,
    scheme:""
  }];
  sessionSwaps={};
  sessionState={"Farmer Carry":entered};

  window.__swapCancel=applySwap(
    "Farmer Carry",
    "Farmer Carry",
    "Suitcase Carry"
  );
`);
check(
  "v76 cancelling a swap with entered data preserves the current exercise",
  SwapCancel76.window.eval(`
    window.__swapCancel===false
    && Object.keys(sessionSwaps).length===0
    && sessionState["Farmer Carry"].typed.lbs===90
    && sessionState["Farmer Carry"].typed.distance===30
    && !sessionState["Suitcase Carry"]
  `)
);

const SwapShapeGuard76=boot(
  V2_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);
SwapShapeGuard76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=false;

  const farmer=exerciseDescriptor("Farmer Carry",null);
  extraExercises=[{
    id:farmer.id,
    name:farmer.name,
    shape:farmer.shape,
    scheme:""
  }];
  sessionSwaps={};
  sessionState={
    "Farmer Carry":blankShapeState(farmer)
  };

  window.__swapShapeGuard=applySwap(
    "Farmer Carry",
    "Farmer Carry",
    "Bench Press"
  );
`);
check(
  "v76 swap application itself refuses cross-shape replacements even outside the menu",
  SwapShapeGuard76.window.eval(`
    window.__swapShapeGuard===false
    && Object.keys(sessionSwaps).length===0
    && !!sessionState["Farmer Carry"]
    && !sessionState["Bench Press"]
    && /same tracking shape/i.test(
      document.getElementById("workoutErr").textContent
    )
  `)
);

const SwapCollision76=boot(
  V2_CFG,
  V2_DATA,
  null,
  TEST_PROGRAM
);
SwapCollision76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  workoutDraftLoaded=false;

  const farmer=exerciseDescriptor("Farmer Carry",null);
  const suitcase=exerciseDescriptor("Suitcase Carry",null);

  extraExercises=[
    {id:farmer.id,name:farmer.name,shape:farmer.shape,scheme:""},
    {id:suitcase.id,name:suitcase.name,shape:suitcase.shape,scheme:""}
  ];
  sessionSwaps={};
  sessionState={
    "Farmer Carry":blankShapeState(farmer),
    "Suitcase Carry":blankShapeState(suitcase)
  };

  window.__swapCollision=applySwap(
    "Farmer Carry",
    "Farmer Carry",
    "Suitcase Carry"
  );
`);
check(
  "v76 swap collisions are rejected before two session slots can share one identity",
  SwapCollision76.window.eval(`
    window.__swapCollision===false
    && Object.keys(sessionSwaps).length===0
    && !!sessionState["Farmer Carry"]
    && !!sessionState["Suitcase Carry"]
    && /already in this session/i.test(
      document.getElementById("workoutErr").textContent
    )
  `)
);

const SwapOptionsData76=
  JSON.parse(JSON.stringify(V2_DATA));
SwapOptionsData76.myExercises={
  "u:options-base":customCarryEntry76(
    "u:options-base",
    "Options Base Carry"
  )
};
SwapOptionsData76.activeWorkoutDraft=null;
const SwapOptions76=boot(
  V2_CFG,
  SwapOptionsData76,
  null,
  TEST_PROGRAM
);
SwapOptions76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";

  const custom=data.myExercises["u:options-base"];
  const suitcase=exerciseDescriptor("Suitcase Carry",null);

  extraExercises=[
    {id:custom.id,name:custom.name,shape:custom.shape,scheme:""},
    {id:suitcase.id,name:suitcase.name,shape:suitcase.shape,scheme:""}
  ];
  sessionSwaps={
    "Options Base Carry":"Farmer Carry"
  };
  sessionState={};

  window.__swapOptions=swapOptionsForExercise(
    "Options Base Carry",
    "Farmer Carry"
  );
`);
check(
  "v76 swap alternatives omit the original duplicate and exercises already used by other slots",
  SwapOptions76.window.eval(`
    !window.__swapOptions.includes("Options Base Carry")
    && !window.__swapOptions.includes("Suitcase Carry")
  `)
);

const DuplicateBaseData76=
  JSON.parse(JSON.stringify(V2_DATA));
DuplicateBaseData76.myExercises={
  "u:duplicate-base":customCarryEntry76(
    "u:duplicate-base",
    "Duplicate Base Carry"
  )
};
DuplicateBaseData76.activeWorkoutDraft=null;
const DuplicateBase76=boot(
  V2_CFG,
  DuplicateBaseData76,
  null,
  TEST_PROGRAM
);
DuplicateBase76.window.eval(`
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";

  const custom=data.myExercises["u:duplicate-base"];
  const farmer=exerciseDescriptor("Farmer Carry",null);

  extraExercises=[{
    id:custom.id,
    name:custom.name,
    shape:custom.shape,
    scheme:""
  }];
  sessionSwaps={
    "Duplicate Base Carry":"Farmer Carry"
  };
  sessionState={
    "Farmer Carry":blankShapeState(farmer)
  };

  renderLibraryOptions();
  addExSel.value=custom.id;
  document.getElementById("addExBtn").click();
`);
check(
  "v76 a swapped-away base cannot be added to the same session twice",
  DuplicateBase76.window.eval(`
    extraExercises.length===1
    && sessionContainsExerciseIdentity(
      data.myExercises["u:duplicate-base"],
      null
    )
    && /already in this session/i.test(
      document.getElementById("workoutErr").textContent
    )
  `)
);

const ProgramIdentityData76=
  JSON.parse(JSON.stringify(V2_DATA));
ProgramIdentityData76.myExercises={
  "u:program-identity":customCarryEntry76(
    "u:program-identity",
    "Current Program Carry",
    ["former program carry"]
  )
};
ProgramIdentityData76.activeWorkoutDraft=null;
const ProgramIdentity76=boot(
  V2_CFG,
  ProgramIdentityData76,
  null,
  TEST_PROGRAM
);
check(
  "v76 program identity validation rejects duplicate current/former-name references in one day",
  ProgramIdentity76.window.eval(`
    (()=>{
      try{
        validateProgramExerciseIdentities({
          name:"Duplicate identities",
          days:[{
            id:"D1",
            title:"Day 1",
            exercises:[
              {name:"Current Program Carry",scheme:""},
              {name:"Former Program Carry",scheme:""}
            ]
          }]
        });
        return false;
      }catch(error){
        return /duplicates another exercise/i.test(error.message);
      }
    })()
  `)
);

const BuilderReferenceData76=
  JSON.parse(JSON.stringify(V2_DATA));
BuilderReferenceData76.myExercises={
  "u:builder-reference":customCarryEntry76(
    "u:builder-reference",
    "Builder Reference Carry"
  )
};
BuilderReferenceData76.activeWorkoutDraft=null;
const BuilderReference76=boot(
  V2_CFG,
  BuilderReferenceData76,
  null,
  TEST_PROGRAM
);
check(
  "v76 an unsaved program-builder reference protects a custom exercise from hard deletion",
  BuilderReference76.window.eval(`
    builderProg={
      name:"Builder draft",
      days:[{
        id:"D1",
        title:"Day 1",
        exercises:[{
          name:"Builder Reference Carry",
          scheme:""
        }]
      }]
    };

    const entry=data.myExercises["u:builder-reference"];
    const refs=userExerciseReferenceCount(entry);
    const result=archiveOrDeleteUserExercise(entry.id);
    builderProg=null;

    refs===1
    && result.archived===true
    && !!data.myExercises["u:builder-reference"]
    && data.myExercises["u:builder-reference"].deprecated===true
  `)
);

const BuilderRenameData76=
  JSON.parse(JSON.stringify(V2_DATA));
BuilderRenameData76.myExercises={
  "u:builder-rename":customCarryEntry76(
    "u:builder-rename",
    "Builder Old Carry"
  )
};
BuilderRenameData76.activeWorkoutDraft=null;
const BuilderRename76=boot(
  V2_CFG,
  BuilderRenameData76,
  null,
  TEST_PROGRAM
);
check(
  "v76 renaming a custom exercise updates an open program builder reference",
  BuilderRename76.window.eval(`
    builderProg={
      name:"Builder draft",
      days:[{
        id:"D1",
        title:"Day 1",
        exercises:[{
          name:"Builder Old Carry",
          scheme:""
        }]
      }]
    };

    const renamed=renameUserExercise(
      "u:builder-rename",
      "Builder New Carry"
    );
    rekeyOpenSessionExercise(
      renamed.previousName,
      renamed.entry
    );

    const updated=
      builderProg.days[0].exercises[0].name;
    builderProg=null;

    renamed.ok===true
    && updated==="Builder New Carry"
  `)
);


// ================= v76: final identity and legacy-cardio closure =================
await wait(0);
releaseTestWindows([
  A57,AllMissing63,ArchiveOpen76,BuilderReference76,BuilderRename76,
  Create76,D56,D56Discard,D56Fail,D56Reload,DeleteLastDraft76,
  DeleteLastReload76,DeleteOpen76,DeleteRollback76,DeleteSwapTarget76,
  DeleteSwappedDraft76,Draft76,DuplicateBase76,EmptyRegression63,
  Exercise76,Fresh63,HistoryCollapseParity76,LiveRename76,M56,
  ManagerLabels76,ManualRestore63,MissingCfg63,MissingData63,
  NewerForms76,NewerInstall63,O56,P,P56,PrepareFixture76,
  PreviousWins63,ProgramIdentity76,RangeMixed76,RenameSwapTarget76,
  RestoreFixture76,Rotate63,RuntimeLoss63,SaveFailure76,SwapCancel76,
  SwapCollision76,SwapLast76,SwapLastReload76,SwapOptions76,
  SwapRollback76,SwapSaved76,SwapShapeGuard76,SwappedBaseRename76,
  T55,U56,Unknown76,fresh57
]);

const RenameProgramCollisionData76=
  JSON.parse(JSON.stringify(V2_DATA));
RenameProgramCollisionData76.myExercises={
  "u:rename-program-collision":customCarryEntry76(
    "u:rename-program-collision",
    "Old Program Carry"
  )
};
RenameProgramCollisionData76.activeWorkoutDraft=null;
const RenameProgramCollision76=boot(
  V2_CFG,
  RenameProgramCollisionData76,
  null,
  {
    name:"Rename collision",
    days:[{
      id:"D1",
      title:"Day 1",
      exercises:[
        {name:"Old Program Carry",scheme:""},
        {name:"Legacy Target Carry",scheme:""}
      ]
    }]
  }
);
const renameProgramCollisionResult76=
  RenameProgramCollision76.window.eval(`
    renameUserExercise(
      "u:rename-program-collision",
      "Legacy Target Carry"
    )
  `);
check(
  "v76 rename refuses a target name already used by an active program or open workout identity",
  renameProgramCollisionResult76.ok===false
  && /already used by active program/i.test(
    renameProgramCollisionResult76.reason
  )
  && RenameProgramCollision76.window.eval(`
    data.myExercises[
      "u:rename-program-collision"
    ].name==="Old Program Carry"
    && data.myExercises[
      "u:rename-program-collision"
    ].formerNames.length===0
    && programExerciseIdentityIssue(program)===null
  `)
);

const RenameStoredCollisionData76=
  JSON.parse(JSON.stringify(V2_DATA));
RenameStoredCollisionData76.myExercises={
  "u:rename-stored-collision":customCarryEntry76(
    "u:rename-stored-collision",
    "Old Stored Carry"
  )
};
RenameStoredCollisionData76.workouts=[{
  date:"2026-07-27",
  day:"__FREE__",
  title:"Freestyle",
  sets:{
    "Legacy Stored Carry":carryValue76(75,20)
  },
  notes:""
}];
RenameStoredCollisionData76.activeWorkoutDraft={
  date:"2026-07-28",
  day:"__FREE__",
  title:"Freestyle",
  sets:{
    "Legacy Draft Carry":carryValue76(80,25)
  },
  notes:"",
  updatedAt:"2026-07-28T12:00:00.000Z"
};
const RenameStoredCollision76=boot(
  Object.assign({},V2_CFG,{
    liftGoals:{"Legacy Goal Carry":200}
  }),
  RenameStoredCollisionData76,
  null,
  TEST_PROGRAM
);
const renameHistoryCollisionResult76=
  RenameStoredCollision76.window.eval(`
    renameUserExercise(
      "u:rename-stored-collision",
      "Legacy Stored Carry"
    )
  `);
const renameDraftCollisionResult76=
  RenameStoredCollision76.window.eval(`
    renameUserExercise(
      "u:rename-stored-collision",
      "Legacy Draft Carry"
    )
  `);
const renameGoalCollisionResult76=
  RenameStoredCollision76.window.eval(`
    renameUserExercise(
      "u:rename-stored-collision",
      "Legacy Goal Carry"
    )
  `);
check(
  "v76 rename refuses legacy target names already owned by history, drafts, or goals",
  [
    renameHistoryCollisionResult76,
    renameDraftCollisionResult76,
    renameGoalCollisionResult76
  ].every(result=>result.ok===false)
  && /workout history/i.test(renameHistoryCollisionResult76.reason)
  && /saved workout draft/i.test(renameDraftCollisionResult76.reason)
  && /training goal/i.test(renameGoalCollisionResult76.reason)
  && RenameStoredCollision76.window.eval(`
    data.myExercises[
      "u:rename-stored-collision"
    ].name==="Old Stored Carry"
    && data.myExercises[
      "u:rename-stored-collision"
    ].formerNames.length===0
  `)
);

const HistoricalCardioData76=
  JSON.parse(JSON.stringify(V2_DATA));
HistoricalCardioData76.myExercises={
  "u:historical-cardio":{
    id:"u:historical-cardio",
    name:"Hill Shuffle New",
    shape:"timeDist",
    tags:["cardio"],
    aliases:[],
    formerNames:["hill shuffle old"],
    muscles:{primary:["full-body"],secondary:[]},
    equipment:["other"],
    unilateral:false,
    bodyweight:false,
    deprecated:true
  }
};
HistoricalCardioData76.workouts=[{
  date:"2026-07-27",
  day:"CARDIO",
  title:"Cardio",
  sets:{
    "Hill Shuffle Old":"30 min · Moderate"
  },
  notes:""
}];
HistoricalCardioData76.activeWorkoutDraft=null;
const HistoricalCardio76=boot(
  V2_CFG,
  HistoricalCardioData76,
  null,
  TEST_PROGRAM
);
const dHistoricalCardio76=
  HistoricalCardio76.window.document;
HistoricalCardio76.window.eval(`startEditWorkout(0)`);
const historicalCardioOption76=[
  ...dHistoricalCardio76
    .getElementById("cardioType")
    .options
].find(option=>option.value==="Hill Shuffle Old");
dHistoricalCardio76.getElementById("cardioMin").value="45";
dHistoricalCardio76.getElementById("cardioDetail").value="Steady";
dHistoricalCardio76.getElementById("logWorkoutBtn").click();
check(
  "v76 historical Cardio editing preserves an archived or former activity name exactly",
  !!historicalCardioOption76
  && historicalCardioOption76.dataset.historyOnly==="true"
  && HistoricalCardio76.window.eval(`
    data.workouts.length===1
    && Object.keys(data.workouts[0].sets).join(",")
      ==="Hill Shuffle Old"
    && data.workouts[0].sets["Hill Shuffle Old"]
      ==="45 min · Steady"
  `)
);

const CardioFailureData76=
  JSON.parse(JSON.stringify(HistoricalCardioData76));
const CardioFailure76=boot(
  V2_CFG,
  CardioFailureData76,
  null,
  TEST_PROGRAM
);
const dCardioFailure76=CardioFailure76.window.document;
CardioFailure76.window.eval(`startEditWorkout(0)`);
dCardioFailure76.getElementById("cardioMin").value="50";
dCardioFailure76.getElementById("cardioDetail").value="Hard";
CardioFailure76.window.eval(`
  window.__realCardioSave=save;
  save=()=>false;
`);
dCardioFailure76.getElementById("logWorkoutBtn").click();
CardioFailure76.window.eval(`save=window.__realCardioSave`);
check(
  "v76 failed Cardio history persistence keeps the entered fields and original history intact",
  dCardioFailure76.getElementById("cardioMin").value==="50"
  && dCardioFailure76.getElementById("cardioDetail").value==="Hard"
  && CardioFailure76.window.eval(`
    editingWorkoutIdx===0
    && data.workouts.length===1
    && data.workouts[0].sets["Hill Shuffle Old"]
      ==="30 min · Moderate"
    && /entered cardio details were kept/i.test(
      document.getElementById("workoutErr").textContent
    )
  `)
);


// ================= v76 final integrity seal protects completed edits, draft identity,
// reserved names, prototype-like names, and unknown prior shapes =================
const ProtectedCompletedEditProgram76={
  name:"Protected completed edit",
  days:[{
    id:"D1",
    title:"Protected Day",
    exercises:[
      {name:"Bench Press",scheme:""},
      {name:"Squat",scheme:""}
    ]
  }]
};
const ProtectedCompletedEditData76=
  JSON.parse(JSON.stringify(V2_DATA));
ProtectedCompletedEditData76.activeWorkoutDraft=null;
const ProtectedCompletedEdit76=boot(
  V2_CFG,
  ProtectedCompletedEditData76,
  null,
  ProtectedCompletedEditProgram76
);
ProtectedCompletedEdit76.window.eval(`
  wDaySel.value="D1";
  activeSessionType="D1";
  workoutDraftLoaded=true;

  const bench=exerciseDescriptor("Bench Press",null);
  const squat=exerciseDescriptor("Squat",null);

  sessionState=newExerciseNameMap();

  setExerciseNameValue(
    sessionState,
    "Bench Press",
    stateFromStoredValue(
      bench,
      [{w:135,r:8}],
      "unsaved",
      "Bench Press",
      true
    )
  );

  sessionState["Bench Press"].saved=[
    {w:135,r:8}
  ];
  sessionState["Bench Press"].rows[0].w=140;
  sessionState["Bench Press"].rows[0].touched=true;

  setExerciseNameValue(
    sessionState,
    "Squat",
    stateFromStoredValue(
      squat,
      [{w:225,r:5}],
      "unsaved",
      "Squat",
      true
    )
  );

  sessionState["Squat"].saved=[
    {w:225,r:5}
  ];

  data.activeWorkoutDraft={
    date:${JSON.stringify(dstr(0))},
    day:"D1",
    title:"Protected Day",
    programName:"Protected completed edit",
    sets:{
      "Bench Press":[{w:135,r:8}],
      "Squat":[{w:225,r:5}]
    },
    notes:"",
    updatedAt:"2026-07-28T12:00:00.000Z"
  };

  window.__protectedCompletedEdit=
    saveExercise("Bench Press");
`);
check(
  "v76 saving another exercise keeps the last completed result of an exercise currently being edited",
  ProtectedCompletedEdit76.window.eval(`
    window.__protectedCompletedEdit.ok===true
    && data.activeWorkoutDraft
      .sets["Bench Press"][0].w===140
    && data.activeWorkoutDraft
      .sets["Squat"][0].w===225
    && sessionState["Squat"].status==="unsaved"
    && sessionState["Squat"].saved[0].r===5
  `)
);

const SameDayUnloadedDraftData76=
  JSON.parse(JSON.stringify(V2_DATA));
SameDayUnloadedDraftData76.activeWorkoutDraft={
  date:dstr(0),
  day:"D1",
  title:"Day 1",
  programName:TEST_PROGRAM.name,
  sets:{
    "Bench Press":[{w:100,r:5}]
  },
  notes:"keep this draft",
  updatedAt:"2026-07-28T12:00:00.000Z"
};
const SameDayUnloadedDraft76=boot(
  V2_CFG,
  SameDayUnloadedDraftData76,
  null,
  TEST_PROGRAM
);
SameDayUnloadedDraft76.window.eval(`
  wDaySel.value="D1";
  activeSessionType="D1";
  workoutDraftLoaded=false;
  window.__sameDayConfirmCount=0;
  window.confirm=()=>{
    window.__sameDayConfirmCount++;
    return false;
  };

  const bench=exerciseDescriptor("Bench Press",null);
  sessionState=newExerciseNameMap();

  const state=blankShapeState(bench);
  state.rows=[
    {
      w:150,
      r:5,
      done:false,
      touched:true
    }
  ];
  state.status="unsaved";

  setExerciseNameValue(
    sessionState,
    "Bench Press",
    state
  );

  window.__sameDayDraftSave=
    saveExercise("Bench Press");
`);
check(
  "v76 an unloaded draft cannot be silently overwritten by a new screen with the same date and day id",
  SameDayUnloadedDraft76.window.eval(`
    window.__sameDayDraftSave.ok===false
    && window.__sameDayConfirmCount===1
    && workoutDraftLoaded===false
    && data.activeWorkoutDraft.notes
      ==="keep this draft"
    && data.activeWorkoutDraft
      .sets["Bench Press"][0].w===100
    && JSON.parse(
      localStorage.getItem("forge:data")
    ).activeWorkoutDraft
      .sets["Bench Press"][0].w===100
  `)
);

const ProgramMismatchDraftData76=
  JSON.parse(JSON.stringify(V2_DATA));
ProgramMismatchDraftData76.activeWorkoutDraft={
  date:dstr(0),
  day:"D1",
  title:"Alpha Day",
  programName:"Program Alpha",
  sets:{
    "Bench Press":[{w:100,r:5}]
  },
  notes:"alpha draft",
  updatedAt:"2026-07-28T12:00:00.000Z"
};
const ProgramMismatchDraft76=boot(
  V2_CFG,
  ProgramMismatchDraftData76,
  null,
  {
    name:"Program Beta",
    days:[{
      id:"D1",
      title:"Beta Day",
      exercises:[
        {name:"Squat",scheme:"3×5"}
      ]
    }]
  }
);
ProgramMismatchDraft76.window.eval(`
  window.__programMismatchResumed=
    resumeWorkoutDraft();

  const bench=exerciseDescriptor(
    "Bench Press",
    null
  );

  sessionState["Bench Press"]=
    stateFromStoredValue(
      bench,
      [{w:105,r:5}],
      "unsaved",
      "Bench Press",
      true
    );

  sessionState["Bench Press"].saved=[
    {w:100,r:5}
  ];

  window.__programMismatchSaved=
    saveExercise("Bench Press");

  window.__programMismatchIdentity={
    day:data.activeWorkoutDraft.day,
    title:data.activeWorkoutDraft.title,
    programName:data.activeWorkoutDraft.programName
  };
`);
const dProgramMismatchDraft76=
  ProgramMismatchDraft76.window.document;
dProgramMismatchDraft76
  .getElementById("logWorkoutBtn")
  .click();
check(
  "v76 a draft from a replaced program resumes as Freestyle but saves and logs under its original identity",
  ProgramMismatchDraft76.window.eval(`
    window.__programMismatchResumed===true
    && window.__programMismatchSaved.ok===true
    && window.__programMismatchIdentity.day==="D1"
    && window.__programMismatchIdentity.title
      ==="Alpha Day"
    && window.__programMismatchIdentity.programName
      ==="Program Alpha"
    && data.workouts.length===1
    && data.workouts[0].day==="D1"
    && data.workouts[0].title==="Alpha Day"
    && data.workouts[0]
      .sets["Bench Press"][0].w===105
    && !Object.prototype.hasOwnProperty.call(
      data.workouts[0].sets,
      "Squat"
    )
  `)
  && dProgramMismatchDraft76
    .getElementById("wDay").value==="__FREE__"
);

const ReservedExerciseNames76=boot(
  V2_CFG,
  JSON.parse(JSON.stringify(V2_DATA)),
  null,
  TEST_PROGRAM
);
const reservedCreatePrefix76=
  ReservedExerciseNames76.window.eval(`
    createUserExercise(
      "[Cardio]Shadow Run",
      "timeDist"
    )
  `);
const reservedCreateOther76=
  ReservedExerciseNames76.window.eval(`
    createUserExercise(
      "Other",
      "text"
    )
  `);
const safeReservedSource76=
  ReservedExerciseNames76.window.eval(`
    createUserExercise(
      "Safe Rename Source",
      "carry"
    )
  `);
const reservedRenamePrefix76=
  ReservedExerciseNames76.window.eval(`
    renameUserExercise(
      ${JSON.stringify(safeReservedSource76.entry.id)},
      "[Cardio] Renamed Run"
    )
  `);
const reservedRenameOther76=
  ReservedExerciseNames76.window.eval(`
    renameUserExercise(
      ${JSON.stringify(safeReservedSource76.entry.id)},
      "Other"
    )
  `);
check(
  "v76 new user exercises and renames reject the retired Cardio prefix and legacy Other identity",
  reservedCreatePrefix76.ok===false
  && reservedCreateOther76.ok===false
  && reservedRenamePrefix76.ok===false
  && reservedRenameOther76.ok===false
  && /reserved/i.test(reservedCreatePrefix76.reason)
  && /reserved/i.test(reservedCreateOther76.reason)
  && ReservedExerciseNames76.window.eval(`
    data.myExercises[
      ${JSON.stringify(safeReservedSource76.entry.id)}
    ].name==="Safe Rename Source"
  `)
);

const PrototypeExerciseData76=
  JSON.parse(JSON.stringify(V2_DATA));
PrototypeExerciseData76.activeWorkoutDraft=null;
const PrototypeExercise76=boot(
  V2_CFG,
  PrototypeExerciseData76,
  null,
  TEST_PROGRAM
);
PrototypeExercise76.window.eval(`
  const created=createUserExercise(
    "__proto__",
    "lift"
  );

  window.__prototypeCreated=created;
  wDaySel.value="__FREE__";
  activeSessionType="__FREE__";
  extraExercises=[{
    id:created.entry.id,
    name:created.entry.name,
    shape:created.entry.shape,
    scheme:""
  }];

  sessionState=newExerciseNameMap();
  sessionSwaps=newExerciseNameMap();

  const state=blankShapeState(created.entry);
  state.rows=[{
    w:185,
    r:5,
    done:false,
    touched:true
  }];
  state.status="unsaved";

  setExerciseNameValue(
    sessionState,
    "__proto__",
    state
  );

  window.__prototypeSaved=
    saveExercise("__proto__");

  setLiftGoalForExercise(
    created.entry,
    225
  );
  saveCfg();

  window.__prototypeRaw={
    cfg:localStorage.getItem("forge:cfg"),
    data:localStorage.getItem("forge:data"),
    program:localStorage.getItem("forge:program")
  };
`);
check(
  "v76 a prototype-like exercise name remains an own draft and training-goal key",
  PrototypeExercise76.window.eval(`
    window.__prototypeCreated.ok===true
    && window.__prototypeSaved.ok===true
    && Object.prototype.hasOwnProperty.call(
      data.activeWorkoutDraft.sets,
      "__proto__"
    )
    && data.activeWorkoutDraft
      .sets["__proto__"][0].w===185
    && Object.prototype.hasOwnProperty.call(
      cfg.liftGoals,
      "__proto__"
    )
    && cfg.liftGoals["__proto__"]===225
    && Object.prototype.hasOwnProperty.call(
      JSON.parse(
        localStorage.getItem("forge:data")
      ).activeWorkoutDraft.sets,
      "__proto__"
    )
    && Object.prototype.hasOwnProperty.call(
      JSON.parse(
        localStorage.getItem("forge:cfg")
      ).liftGoals,
      "__proto__"
    )
  `)
);

const PrototypeExerciseReload76=bootRaw({
  cfg:PrototypeExercise76.window.eval(
    "window.__prototypeRaw.cfg"
  ),
  data:PrototypeExercise76.window.eval(
    "window.__prototypeRaw.data"
  ),
  program:PrototypeExercise76.window.eval(
    "window.__prototypeRaw.program"
  )
});
PrototypeExerciseReload76.window.eval(`
  window.__prototypeResumed=
    resumeWorkoutDraft();

  window.__prototypeResumeState={
    ownState:Object.prototype.hasOwnProperty.call(
      sessionState,
      "__proto__"
    ),
    savedWeight:sessionState["__proto__"]
      .saved[0].w,
    goal:cfg.liftGoals["__proto__"]
  };
`);
const dPrototypeExerciseReload76=
  PrototypeExerciseReload76.window.document;
dPrototypeExerciseReload76
  .getElementById("logWorkoutBtn")
  .click();
PrototypeExerciseReload76.window.eval(`
  wDaySel.value="__CARDIO__";
  activeSessionType="__CARDIO__";
  initSessionState();
  selectHistoricalCardioType("__proto__");
`);
dPrototypeExerciseReload76
  .getElementById("cardioMin").value="20";
dPrototypeExerciseReload76
  .getElementById("cardioDetail").value="steady";
dPrototypeExerciseReload76
  .getElementById("logWorkoutBtn")
  .click();
check(
  "v76 prototype-like names survive reload, Resume, general logging, dedicated Cardio logging, and JSON persistence",
  PrototypeExerciseReload76.window.eval(`
    window.__prototypeResumed===true
    && window.__prototypeResumeState.ownState===true
    && window.__prototypeResumeState.savedWeight===185
    && window.__prototypeResumeState.goal===225
    && data.workouts.length===2
    && Object.prototype.hasOwnProperty.call(
      data.workouts[0].sets,
      "__proto__"
    )
    && data.workouts[0]
      .sets["__proto__"][0].r===5
    && Object.prototype.hasOwnProperty.call(
      data.workouts[1].sets,
      "__proto__"
    )
    && data.workouts[1]
      .sets["__proto__"]
      ==="20 min · steady"
    && JSON.parse(
      localStorage.getItem("forge:data")
    ).workouts.every(workout=>
      Object.prototype.hasOwnProperty.call(
        workout.sets,
        "__proto__"
      )
    )
  `)
);

const UnknownPriorValueData76=
  JSON.parse(JSON.stringify(V2_DATA));
UnknownPriorValueData76.workouts=[{
  date:"2026-07-27",
  day:"D1",
  title:"Future Day",
  sets:{
    "Future Shape":{
      t:"futureShape",
      payload:{keep:true}
    }
  },
  notes:""
}];
UnknownPriorValueData76.activeWorkoutDraft=null;
const UnknownPriorValue76=boot(
  V2_CFG,
  UnknownPriorValueData76,
  null,
  {
    name:"Future program",
    days:[{
      id:"D1",
      title:"Future Day",
      exercises:[
        {name:"Future Shape",scheme:""}
      ]
    }]
  }
);
const dUnknownPriorValue76=
  UnknownPriorValue76.window.document;
const unknownPriorButtons76=[
  ...dUnknownPriorValue76
    .querySelectorAll("#exerciseInputs .xbtn")
].filter(button=>button.textContent.trim()==="= last");
check(
  "v76 an unknown newer-shape prior value remains visible without an unusable same-as-last action",
  unknownPriorButtons76.length===0
  && /last: .*newer BlackPyre version/i.test(
    dUnknownPriorValue76
      .getElementById("exerciseInputs")
      .textContent
  )
  && UnknownPriorValue76.window.eval(`
    data.workouts[0]
      .sets["Future Shape"].t
      ==="futureShape"
    && data.workouts[0]
      .sets["Future Shape"].payload.keep===true
  `)
);

// ================= native parity: slider-editor movement and Undo spacing =================
const parityDay = dstr(0);
const parityData = Object.assign({}, EMPTY_DATA, {
  food:{
    [parityDay]:[{
      name:"1.5 servings · Test Greek Yogurt",
      cal:153,pro:25.5,carb:12.75,fat:0,
      amount:1.5,unit:"serving",grams:255,
      meal:"breakfast",
      foodKey:"food:test greek yogurt|test dairy",
      sourceFood:{
        name:"Test Greek Yogurt",
        brand:"Test Dairy",
        cal100:60,pro100:10,carb100:5,fat100:0,
        servingG:170,
        servingLabel:"1 container"
      }
    }]
  }
});
const FoodEditorParity = boot(V2_CFG, parityData);
const dFoodEditorParity = FoodEditorParity.window.document;
FoodEditorParity.window.HTMLElement.prototype.scrollIntoView = function(opts){
  FoodEditorParity.window.__editorScrolls =
    FoodEditorParity.window.__editorScrolls || [];
  FoodEditorParity.window.__editorScrolls.push({
    id:this.id,
    behavior:opts && opts.behavior,
    block:opts && opts.block
  });
};
FoodEditorParity.window.eval("startEditEntry(0)");
const immediateEditorScrolls =
  FoodEditorParity.window.eval(
    `(window.__editorScrolls||[]).filter(x=>x.id==="calcCard").length`
  );
await wait(10);
const completedEditorScrolls =
  FoodEditorParity.window.eval(
    `(window.__editorScrolls||[]).filter(x=>x.id==="calcCard").length`
  );

check("slider food editing opens and immediately moves to the serving editor",
  !dFoodEditorParity.getElementById("calcCard").classList.contains("hidden")
  && immediateEditorScrolls>=2
  && dFoodEditorParity.getElementById("addSelBtn").textContent==="Update entry");

check("slider food editor repeats its smooth centered movement after layout settles",
  completedEditorScrolls>=4
  && FoodEditorParity.window.eval(
    `(window.__editorScrolls||[]).filter(x=>
      x.id==="calcCard"
      && x.behavior==="smooth"
      && x.block==="center"
    ).length`
  )>=4);

check("slider food editing preserves the existing amount and unit",
  dFoodEditorParity.getElementById("qtyAmount").value==="1.5"
  && dFoodEditorParity.getElementById("qtyUnit").value==="serving");

dFoodEditorParity.getElementById("qtyAmount").value="2";
dFoodEditorParity.getElementById("qtyAmount").dispatchEvent(
  new FoodEditorParity.window.Event("input",{bubbles:true})
);
dFoodEditorParity.getElementById("addSelBtn").dispatchEvent(
  new FoodEditorParity.window.Event("click",{bubbles:true})
);
check("updating from the moved slider editor replaces the row instead of duplicating it",
  FoodEditorParity.window.eval(
    `data.food[todayStr()].length===1
      && data.food[todayStr()][0].amount===2
      && data.food[todayStr()][0].unit==="serving"
      && data.food[todayStr()][0].foodKey==="food:test greek yogurt|test dairy"`
  ));

const UndoParity = boot(V2_CFG, EMPTY_DATA);
const dUndoParity = UndoParity.window.document;
UndoParity.window.eval(`offerUndo("Deleted test entry",()=>{window.__undoParity=true;})`);
check("showing Undo reserves bottom page space",
  dUndoParity.body.classList.contains("undo-toast-visible")
  && !dUndoParity.getElementById("undoToast").classList.contains("hidden"));

UndoParity.window.eval("dismissUndo()");
check("allowing or requesting Undo dismissal releases reserved bottom space",
  !dUndoParity.body.classList.contains("undo-toast-visible")
  && dUndoParity.getElementById("undoToast").classList.contains("hidden"));

UndoParity.window.eval(`offerUndo("Deleted test entry",()=>{window.__undoParity=true;})`);
dUndoParity.getElementById("undoBtn").dispatchEvent(
  new UndoParity.window.Event("click",{bubbles:true})
);
check("using Undo releases reserved bottom space",
  UndoParity.window.eval("window.__undoParity===true")
  && !dUndoParity.body.classList.contains("undo-toast-visible")
  && dUndoParity.getElementById("undoToast").classList.contains("hidden"));

const parityCss = fs.readFileSync(
  path.join(__dirname,"..","index.html"),
  "utf8"
);
check("Undo spacing covers ordinary pages and collapsed and expanded Train layouts",
  /body\.undo-toast-visible\s*\{[^}]*padding-bottom/.test(parityCss)
  && /body\.rest-dock-visible\s+#undoToast\s*\{[^}]*bottom/.test(parityCss)
  && /body\.rest-dock-visible\.undo-toast-visible\s*\{[^}]*padding-bottom/.test(parityCss)
  && /body\.rest-dock-visible\.rest-options-open\s+#undoToast\s*\{[^}]*bottom/.test(parityCss)
  && /body\.rest-dock-visible\.rest-options-open\.undo-toast-visible\s*\{[^}]*padding-bottom/.test(parityCss));


// ================= v77 training-plan interchange core integration =================

const TrainingPlanCore1B=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  TEST_PROGRAM
);

const trainingPlanFixtureCore1B=JSON.parse(
  require("fs").readFileSync(
    "tests/fixtures/training-plan-interchange-v1.json",
    "utf8"
  )
);

const core1BBeforeProgram=
  TrainingPlanCore1B.window.localStorage.getItem(
    "forge:program"
  );

const core1BBeforeData=
  TrainingPlanCore1B.window.localStorage.getItem(
    "forge:data"
  );

const preparedFixtureCore1B=
  TrainingPlanCore1B.window.eval(
    `prepareTrainingPlanImport(
      ${JSON.stringify(trainingPlanFixtureCore1B)}
    )`
  );

check(
  "v77 web fixture prepares all six tracking shapes",
  preparedFixtureCore1B.ok
  && preparedFixtureCore1B.canConfirm
  && preparedFixtureCore1B.blockers===0
  && [
    "lift",
    "reps",
    "timeDist",
    "carry",
    "rounds",
    "text"
  ].every(
    shape=>
      preparedFixtureCore1B.review.some(
        row=>row.shape===shape
      )
  )
);

check(
  "v77 web canonical Sprinting remains time-distance",
  TrainingPlanCore1B.window.eval(
    `EXERCISE_LIBRARY.length===203
      && trainingPlanEntryById("bp:sprinting").name==="Sprinting"
      && trainingPlanEntryById("bp:sprinting").shape==="timeDist"`
  )
);

check(
  "v77 explicit Sprinting identity is not converted to intervals",
  (()=>{
    const row=preparedFixtureCore1B.review.find(
      item=>item.importedName==="Sprinting"
    );

    return (
      row
      && row.exerciseId==="bp:sprinting"
      && row.shape==="timeDist"
      && row.resolutionMethod==="exact-built-in-id"
    );
  })()
);

check(
  "v77 name-only Sprinting remains canonical time-distance",
  TrainingPlanCore1B.window.eval(
    `(()=>{
      const result=prepareTrainingPlanImport({
        format:"blackpyre-training-plan",
        version:1,
        program:{
          name:"Canonical Sprint",
          days:[{
            id:"D1",
            title:"Speed",
            exercises:[{
              name:"Sprinting",
              trackingShape:"timeDist",
              prescription:{
                intervals:6,
                durationSeconds:20,
                recoverySeconds:100
              }
            }]
          }]
        }
      });

      const row=result.review[0];

      return (
        result.canConfirm
        && row.exerciseId==="bp:sprinting"
        && row.canonicalName==="Sprinting"
        && row.shape==="timeDist"
        && row.resolutionMethod==="exact-name"
        && row.warnings.length===0
        && row.prescription.intervals===6
        && row.prescription.durationSeconds===20
        && row.prescription.recoverySeconds===100
      );
    })()`
  )
);

check(
  "v77 unknown exercise remains unresolved with ranked suggestions",
  TrainingPlanCore1B.window.eval(
    `(()=>{
      const result=prepareTrainingPlanImport({
        format:"blackpyre-training-plan",
        version:1,
        program:{
          name:"Unknown Movement",
          days:[{
            id:"D1",
            title:"Day",
            exercises:[{
              name:"Sprintng",
              trackingShape:"timeDist",
              prescription:{
                durationSeconds:20
              }
            }]
          }]
        }
      });

      const row=result.review[0];

      return (
        !result.canConfirm
        && result.blockers===1
        && row.exerciseId===null
        && row.shape===null
        && row.suggestions[0].id==="bp:sprinting"
      );
    })()`
  )
);

check(
  "v77 canonical shape conflict blocks import",
  TrainingPlanCore1B.window.eval(
    `(()=>{
      const result=prepareTrainingPlanImport({
        format:"blackpyre-training-plan",
        version:1,
        program:{
          name:"Shape Conflict",
          days:[{
            id:"D1",
            title:"Day",
            exercises:[{
              exerciseId:"bp:bench-press",
              name:"Bench Press",
              trackingShape:"timeDist",
              prescription:{
                durationSeconds:300
              }
            }]
          }]
        }
      });

      return (
        !result.canConfirm
        && result.blockers===1
        && result.review[0].errors.some(
          message=>message.includes("conflicts")
        )
      );
    })()`
  )
);

check(
  "v77 legacy name-and-scheme program remains compatible",
  TrainingPlanCore1B.window.eval(
    `(()=>{
      const result=prepareTrainingPlanImport({
        name:"Legacy Program",
        days:[{
          id:"D1",
          title:"Legacy Day",
          exercises:[
            {
              name:"Bench Press",
              scheme:"3 × 8"
            },
            {
              name:"Sprinting",
              scheme:"6 × 20 sec"
            }
          ]
        }]
      });

      return (
        result.kind==="legacy"
        && result.canConfirm
        && result.review[0].shape==="lift"
        && result.review[1].shape==="timeDist"
        && result.candidate.days[0].exercises[1]
          .exerciseId==="bp:sprinting"
      );
    })()`
  )
);

check(
  "v77 interchange preparation does not mutate persisted state",
  TrainingPlanCore1B.window.localStorage.getItem(
    "forge:program"
  )===core1BBeforeProgram
  && TrainingPlanCore1B.window.localStorage.getItem(
    "forge:data"
  )===core1BBeforeData
);

check(
  "v77 exported public program round-trips through preparation",
  TrainingPlanCore1B.window.eval(
    `(()=>{
      const exported=trainingPlanInterchangeFromProgram({
        name:"Round Trip",
        author:"Suite",
        days:[{
          id:"D1",
          title:"Day",
          exercises:[
            {
              name:"Bench Press",
              scheme:"3 × 5"
            },
            {
              name:"Sprinting",
              scheme:"6 × 20 sec"
            }
          ]
        }]
      });

      const prepared=prepareTrainingPlanImport(exported);

      return (
        exported.format==="blackpyre-training-plan"
        && exported.version===1
        && prepared.canConfirm
        && prepared.review[0].exerciseId==="bp:bench-press"
        && prepared.review[1].exerciseId==="bp:sprinting"
        && prepared.review[1].shape==="timeDist"
      );
    })()`
  )
);



// ================= v77 training-plan import review Phase 2A =================

const ImportReview77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  TEST_PROGRAM
);

const importReviewDocument77=
  ImportReview77.window.document;

const validImportReview77={
  format:"blackpyre-training-plan",
  version:1,
  program:{
    name:"Review Candidate",
    days:[{
      id:"D1",
      title:"Speed and Strength",
      exercises:[
        {
          exerciseId:"bp:bench-press",
          name:"Bench Press",
          trackingShape:"lift",
          prescription:{
            sets:3,
            reps:5
          }
        },
        {
          exerciseId:"bp:sprinting",
          name:"Sprinting",
          trackingShape:"timeDist",
          prescription:{
            intervals:6,
            durationSeconds:20,
            recoverySeconds:100
          }
        }
      ]
    }]
  }
};

check(
  "v77 import review overlay exists and starts closed",
  !!importReviewDocument77.getElementById(
    "trainingPlanReviewOverlay"
  )
  && importReviewDocument77.getElementById(
    "trainingPlanReviewOverlay"
  ).classList.contains("hidden")
);

const importReviewBeforeProgram77=
  ImportReview77.window.localStorage.getItem(
    "forge:program"
  );

ImportReview77.window.eval(`
  document.getElementById("restDock")
    .classList.remove("hidden");

  window.__reviewConfirmCalls77=0;

  confirm=()=>{
    window.__reviewConfirmCalls77++;
    return false;
  };

  openTrainingPlanReview(
    prepareTrainingPlanImport(
      ${JSON.stringify(validImportReview77)}
    ),
    "review-candidate.json"
  );
`);

check(
  "v77 import review requires explicit confirmation before mutation",
  ImportReview77.window.localStorage.getItem(
    "forge:program"
  )===importReviewBeforeProgram77
  && ImportReview77.window.eval(
    `trainingPlanReviewIsOpen()`
  )
  && importReviewDocument77.body.classList.contains(
    "training-plan-review-open"
  )
);

check(
  "v77 import review suppresses the rest timer",
  ImportReview77.window.getComputedStyle(
    importReviewDocument77.getElementById(
      "restDock"
    )
  ).display==="none"
);

check(
  "v77 valid import review shows rows and enables confirmation",
  importReviewDocument77.querySelectorAll(
    "#trainingPlanReviewList .training-plan-review-item"
  ).length===2
  && importReviewDocument77.getElementById(
    "trainingPlanReviewConfirmBtn"
  ).disabled===false
  && /2 exercises ready/.test(
    importReviewDocument77.getElementById(
      "trainingPlanReviewSummary"
    ).textContent
  )
);

importReviewDocument77.getElementById(
  "trainingPlanReviewCancelBtn"
).click();

check(
  "v77 cancelling import review changes nothing",
  ImportReview77.window.localStorage.getItem(
    "forge:program"
  )===importReviewBeforeProgram77
  && !ImportReview77.window.eval(
    `trainingPlanReviewIsOpen()`
  )
  && !importReviewDocument77.body.classList.contains(
    "training-plan-review-open"
  )
);

ImportReview77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Blocked Candidate",
        days:[{
          id:"D1",
          title:"Unknown",
          exercises:[{
            name:"Sprintng",
            trackingShape:"timeDist",
            prescription:{
              durationSeconds:20
            }
          }]
        }]
      }
    }),
    "blocked.json"
  );
`);

check(
  "v77 unresolved import remains visible and blocks confirmation",
  importReviewDocument77.getElementById(
    "trainingPlanReviewConfirmBtn"
  ).disabled===true
  && importReviewDocument77.querySelectorAll(
    "#trainingPlanReviewList .is-blocked"
  ).length===1
  && /Possible matches: Sprinting/.test(
    importReviewDocument77.getElementById(
      "trainingPlanReviewList"
    ).textContent
  )
  && ImportReview77.window.localStorage.getItem(
    "forge:program"
  )===importReviewBeforeProgram77
);

ImportReview77.window.eval(`
  closeTrainingPlanReview({skipFocus:true});

  openTrainingPlanReview(
    prepareTrainingPlanImport(
      ${JSON.stringify(validImportReview77)}
    ),
    "review-candidate.json"
  );
`);

importReviewDocument77.getElementById(
  "trainingPlanReviewConfirmBtn"
).click();

check(
  "v77 confirmed review imports without a second browser confirm",
  ImportReview77.window.eval(
    `program.name`
  )==="Review Candidate"
  && JSON.parse(
    ImportReview77.window.localStorage.getItem(
      "forge:program"
    )
  ).name==="Review Candidate"
  && ImportReview77.window.eval(
    `window.__reviewConfirmCalls77`
  )===0
  && !ImportReview77.window.eval(
    `trainingPlanReviewIsOpen()`
  )
);

ImportReview77.window.eval(`
  window.__programExport77=null;

  download=(name,text)=>{
    window.__programExport77={
      name:name,
      text:text
    };
  };
`);

importReviewDocument77.getElementById(
  "exportBtn"
).click();

const publicProgramExport77=
  JSON.parse(
    ImportReview77.window.__programExport77.text
  );

check(
  "v77 Save file exports the public training-plan v1 envelope",
  publicProgramExport77.format
    ==="blackpyre-training-plan"
  && publicProgramExport77.version===1
  && publicProgramExport77.program.name
    ==="Review Candidate"
  && /-blackpyre-v1\.json$/.test(
    ImportReview77.window.__programExport77.name
  )
);



// ================= v77 training-plan review resolution Phase 2B =================

const reviewResolutionPlan77={
  format:"blackpyre-training-plan",
  version:1,
  program:{
    name:"Resolution Candidate",
    days:[{
      id:"D1",
      title:"Review Day",
      exercises:[
        {
          name:"Sprintng",
          trackingShape:"timeDist",
          prescription:{
            durationSeconds:20
          }
        },
        {
          name:"Bench Press",
          trackingShape:"lift",
          prescription:{
            sets:3,
            reps:5
          }
        }
      ]
    }]
  }
};

const MatchReview77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  TEST_PROGRAM
);

MatchReview77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport(
      ${JSON.stringify(reviewResolutionPlan77)}
    ),
    "resolution.json"
  );
`);

const matchDocument77=
  MatchReview77.window.document;

check(
  "v77 blocked review exposes match create and remove controls",
  matchDocument77.querySelectorAll(
    ".training-plan-review-resolution"
  ).length===1
  && [
    "Use match",
    "Create a custom exercise instead",
    "Remove from import"
  ].every(label=>
    [...matchDocument77.querySelectorAll(
      ".training-plan-review-resolution button"
    )].some(button=>button.textContent===label)
  )
);

const matchResult77=
  MatchReview77.window.eval(`
    matchTrainingPlanReviewExercise(
      trainingPlanReviewState.prepared.review[0],
      "bp:sprinting"
    )
  `);

check(
  "v77 explicit existing match resolves a typo without fuzzy auto-selection",
  matchResult77.ok
  && MatchReview77.window.eval(`
    trainingPlanReviewState.prepared.canConfirm
    && trainingPlanReviewState
      .prepared.review[0]
      .exerciseId==="bp:sprinting"
    && trainingPlanReviewState
      .prepared.review[0]
      .shape==="timeDist"
  `)
);

check(
  "v77 matching an existing exercise does not create library data",
  MatchReview77.window.eval(`
    Object.keys(data.myExercises||{}).length===0
  `)
  && JSON.parse(
    MatchReview77.window.localStorage.getItem(
      "forge:data"
    )
  ).myExercises
  && Object.keys(
    JSON.parse(
      MatchReview77.window.localStorage.getItem(
        "forge:data"
      )
    ).myExercises
  ).length===0
);

MatchReview77.window.eval(`
  closeTrainingPlanReview({skipFocus:true});
  openTrainingPlanReview(
    prepareTrainingPlanImport(
      ${JSON.stringify(reviewResolutionPlan77)}
    ),
    "remove.json"
  );
`);

const removeResult77=
  MatchReview77.window.eval(`
    removeTrainingPlanReviewExercise(
      trainingPlanReviewState.prepared.review[0]
    )
  `);

check(
  "v77 removing a blocked exercise allows the remaining program to continue",
  removeResult77.ok
  && MatchReview77.window.eval(`
    trainingPlanReviewState.prepared.canConfirm
    && trainingPlanReviewState
      .prepared.candidate.days[0]
      .exercises.length===1
    && trainingPlanReviewState.removed.length===1
  `)
  && /1 removed/.test(
    matchDocument77.getElementById(
      "trainingPlanReviewSummary"
    ).textContent
  )
);

const PendingReview77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  TEST_PROGRAM
);

const pendingDocument77=
  PendingReview77.window.document;

const pendingDataBefore77=
  PendingReview77.window.localStorage.getItem(
    "forge:data"
  );

const pendingProgramBefore77=
  PendingReview77.window.localStorage.getItem(
    "forge:program"
  );

PendingReview77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Pending Custom",
        days:[{
          id:"D1",
          title:"Custom Day",
          exercises:[{
            name:"Bear Crawl Flow",
            trackingShape:"text",
            prescription:{
              instructions:"Complete the full pattern."
            }
          }]
        }]
      }
    }),
    "pending.json"
  );
`);

const blankShapeResult77=
  PendingReview77.window.eval(`
    createPendingTrainingPlanExercise(
      trainingPlanReviewState.prepared.review[0],
      "Bear Crawl Flow",
      ""
    )
  `);

check(
  "v77 pending custom creation requires an explicit tracking type",
  !blankShapeResult77.ok
  && /Choose a tracking type/.test(
    blankShapeResult77.reason
  )
);

const pendingResult77=
  PendingReview77.window.eval(`
    createPendingTrainingPlanExercise(
      trainingPlanReviewState.prepared.review[0],
      "Bear Crawl Flow",
      "text"
    )
  `);

check(
  "v77 custom exercise remains pending until import confirmation",
  pendingResult77.ok
  && PendingReview77.window.eval(`
    trainingPlanReviewState.prepared.canConfirm
    && trainingPlanReviewState
      .prepared.review[0]
      .exerciseId.startsWith("pending:")
    && Object.keys(data.myExercises||{}).length===0
  `)
  && PendingReview77.window.localStorage.getItem(
    "forge:data"
  )===pendingDataBefore77
  && PendingReview77.window.localStorage.getItem(
    "forge:program"
  )===pendingProgramBefore77
);

pendingDocument77.getElementById(
  "trainingPlanReviewCancelBtn"
).click();

check(
  "v77 cancelling a pending custom import saves no exercise",
  PendingReview77.window.eval(`
    Object.keys(data.myExercises||{}).length===0
  `)
  && PendingReview77.window.localStorage.getItem(
    "forge:data"
  )===pendingDataBefore77
  && PendingReview77.window.localStorage.getItem(
    "forge:program"
  )===pendingProgramBefore77
);

PendingReview77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Confirmed Custom",
        days:[{
          id:"D1",
          title:"Custom Day",
          exercises:[{
            name:"Bear Crawl Flow",
            trackingShape:"text",
            prescription:{
              instructions:"Complete the full pattern."
            }
          }]
        }]
      }
    }),
    "confirmed-custom.json"
  );

  createPendingTrainingPlanExercise(
    trainingPlanReviewState.prepared.review[0],
    "Bear Crawl Flow",
    "text"
  );
`);

const pendingIdBeforeConfirm77=
  PendingReview77.window.eval(`
    trainingPlanReviewState
      .prepared.review[0]
      .exerciseId
  `);

const confirmPending77=
  PendingReview77.window.eval(`
    confirmTrainingPlanReview()
  `);

const confirmedCustomIds77=
  PendingReview77.window.eval(`
    Object.keys(data.myExercises||{})
  `);

check(
  "v77 confirmation assigns the stable custom ID only at commit",
  pendingIdBeforeConfirm77.startsWith("pending:")
  && confirmPending77===true
  && confirmedCustomIds77.length===1
  && confirmedCustomIds77[0].startsWith("u:")
  && JSON.parse(
    PendingReview77.window.localStorage.getItem(
      "forge:program"
    )
  ).days[0].exercises[0].exerciseId
    ===confirmedCustomIds77[0]
);

const collisionData77=JSON.parse(
  JSON.stringify(EMPTY_DATA)
);

collisionData77.myExercises={
  "u:collision-former":{
    id:"u:collision-former",
    name:"Current Custom Pattern",
    shape:"text",
    tags:[],
    aliases:["custom pattern alias"],
    formerNames:["old custom pattern"],
    muscles:{
      primary:["full-body"],
      secondary:[]
    },
    equipment:["other"],
    unilateral:false,
    bodyweight:false,
    deprecated:false
  }
};

const CollisionReview77=boot(
  EXISTING_CFG,
  collisionData77,
  null,
  TEST_PROGRAM
);

CollisionReview77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Collision Candidate",
        days:[{
          id:"D1",
          title:"Collision Day",
          exercises:[
            {
              name:"First Unknown",
              trackingShape:"text",
              prescription:{
                instructions:"First."
              }
            },
            {
              name:"Second Unknown",
              trackingShape:"text",
              prescription:{
                instructions:"Second."
              }
            }
          ]
        }]
      }
    }),
    "collision.json"
  );
`);

const aliasCollision77=
  CollisionReview77.window.eval(`
    createPendingTrainingPlanExercise(
      trainingPlanReviewState.prepared.review[0],
      "running",
      "timeDist"
    )
  `);

const formerCollision77=
  CollisionReview77.window.eval(`
    createPendingTrainingPlanExercise(
      trainingPlanReviewState.prepared.review[0],
      "old custom pattern",
      "text"
    )
  `);

const firstPendingCollision77=
  CollisionReview77.window.eval(`
    createPendingTrainingPlanExercise(
      trainingPlanReviewState.prepared.review[0],
      "Unique Pending Pattern",
      "text"
    )
  `);

const secondPendingCollision77=
  CollisionReview77.window.eval(`
    createPendingTrainingPlanExercise(
      trainingPlanReviewState.prepared.review[1],
      "Unique-Pending Pattern",
      "text"
    )
  `);

check(
  "v77 pending custom collisions include aliases former names and pending names",
  !aliasCollision77.ok
  && !formerCollision77.ok
  && firstPendingCollision77.ok
  && !secondPendingCollision77.ok
);

const DuplicateReview77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  TEST_PROGRAM
);

DuplicateReview77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Duplicate Candidate",
        days:[{
          id:"D1",
          title:"Duplicate Day",
          exercises:[
            {
              name:"Bench Press",
              trackingShape:"lift",
              prescription:{
                sets:3,
                reps:5
              }
            },
            {
              name:"Unknown Bench",
              trackingShape:"lift",
              prescription:{
                sets:3,
                reps:8
              }
            }
          ]
        }]
      }
    }),
    "duplicate.json"
  );

  matchTrainingPlanReviewExercise(
    trainingPlanReviewState.prepared.review[1],
    "bp:bench-press"
  );
`);

check(
  "v77 mapping two day entries to one exercise blocks confirmation",
  DuplicateReview77.window.eval(`
    !trainingPlanReviewState.prepared.canConfirm
    && trainingPlanReviewState
      .prepared.programErrors.length===1
  `)
  && DuplicateReview77.window.document
    .getElementById(
      "trainingPlanReviewConfirmBtn"
    ).disabled===true
);

const DataFailReview77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  TEST_PROGRAM
);

const dataFailBeforeData77=
  DataFailReview77.window.localStorage.getItem(
    "forge:data"
  );

const dataFailBeforeProgram77=
  DataFailReview77.window.localStorage.getItem(
    "forge:program"
  );

DataFailReview77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Data Failure",
        days:[{
          id:"D1",
          title:"Day",
          exercises:[{
            name:"Data Failure Custom",
            trackingShape:"text",
            prescription:{
              instructions:"Complete."
            }
          }]
        }]
      }
    }),
    "data-failure.json"
  );

  createPendingTrainingPlanExercise(
    trainingPlanReviewState.prepared.review[0],
    "Data Failure Custom",
    "text"
  );

  window.__originalSave77=save;
  save=()=>false;
`);

const dataFailConfirm77=
  DataFailReview77.window.eval(`
    confirmTrainingPlanReview()
  `);

DataFailReview77.window.eval(`
  save=window.__originalSave77;
`);

check(
  "v77 data-save failure leaves both program and exercise library unchanged",
  dataFailConfirm77===false
  && DataFailReview77.window.eval(`
    Object.keys(data.myExercises||{}).length===0
    && trainingPlanReviewIsOpen()
  `)
  && DataFailReview77.window.localStorage.getItem(
    "forge:data"
  )===dataFailBeforeData77
  && DataFailReview77.window.localStorage.getItem(
    "forge:program"
  )===dataFailBeforeProgram77
);

const ProgramFailReview77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  TEST_PROGRAM
);

const programFailBeforeData77=
  ProgramFailReview77.window.localStorage.getItem(
    "forge:data"
  );

const programFailBeforeProgram77=
  ProgramFailReview77.window.localStorage.getItem(
    "forge:program"
  );

ProgramFailReview77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Program Failure",
        days:[{
          id:"D1",
          title:"Day",
          exercises:[{
            name:"Program Failure Custom",
            trackingShape:"text",
            prescription:{
              instructions:"Complete."
            }
          }]
        }]
      }
    }),
    "program-failure.json"
  );

  createPendingTrainingPlanExercise(
    trainingPlanReviewState.prepared.review[0],
    "Program Failure Custom",
    "text"
  );

  window.__originalSaveProgram77=saveProgram;
  saveProgram=()=>false;
`);

const programFailConfirm77=
  ProgramFailReview77.window.eval(`
    confirmTrainingPlanReview()
  `);

ProgramFailReview77.window.eval(`
  saveProgram=window.__originalSaveProgram77;
`);

check(
  "v77 program-save failure rolls the newly saved exercise back",
  programFailConfirm77===false
  && ProgramFailReview77.window.eval(`
    Object.keys(data.myExercises||{}).length===0
    && trainingPlanReviewIsOpen()
    && program.name==="Test Program"
  `)
  && ProgramFailReview77.window.localStorage.getItem(
    "forge:data"
  )===programFailBeforeData77
  && ProgramFailReview77.window.localStorage.getItem(
    "forge:program"
  )===programFailBeforeProgram77
);



// ================= v77 searchable Program Builder Phase 3A =================

// Release completed jsdom documents before the final browser-heavy phases.
// The suite intentionally boots the full shipped app many times; closing old
// windows keeps the permanent integration run inside constrained CI memory.
await wait(0);
releaseTestWindows([
  A,B,BackupReminder,ShareBackup,CancelBackup,T49,T49Invalid,T49Switch,T50,
  MyExercisesParity76,SessionRemove78,T51,T51b,T51c,F51,FoodEdit,
  UsualIdentity,UsualControls,UsualPartial,UsualAllMeals,DistinctRecurring,
  H68,H68Claude,H60,H60Api,H60Off,S61,S61Offline,S61NoTargets,S61Full,
  S61Familiar,C62,H,G,T54,T64,T64PausedReload,T64Expired,
  TimerRunningParity76,TimerPausedParity76,T65VisibleExpired,
  T65BackgroundExpired,B,V59,Q59,FreshAP66,LegacyAP66,AP66,P,
  HistoryCollapseParity76,T55,D56,D56Reload,D56Fail,D56Discard,U56,M56,
  P56,O56,A57,fresh57,Fresh63,NewerInstall63,MissingData63,MissingCfg63,
  AllMissing63,PreviousWins63,EmptyRegression63,Rotate63,RuntimeLoss63,
  ManualRestore63,Exercise76,SaveFailure76,Create76,Unknown76,Draft76,
  PrepareFixture76,RestoreFixture76,RangeMixed76,NewerForms76,
  ManagerLabels76,LiveRename76,SwappedBaseRename76,DeleteOpen76,
  DeleteSwappedDraft76,DeleteLastDraft76,DeleteLastReload76,
  DeleteRollback76,ArchiveOpen76,DeleteSwapTarget76,RenameSwapTarget76,
  SwapSaved76,SwapLast76,SwapLastReload76,SwapRollback76,SwapCancel76,
  SwapShapeGuard76,SwapCollision76,SwapOptions76,DuplicateBase76,
  ProgramIdentity76,BuilderReference76,BuilderRename76,
  RenameProgramCollision76,RenameStoredCollision76,HistoricalCardio76,
  CardioFailure76,ProtectedCompletedEdit76,SameDayUnloadedDraft76,
  ProgramMismatchDraft76,ReservedExerciseNames76,PrototypeExercise76,
  PrototypeExerciseReload76,UnknownPriorValue76,FoodEditorParity,
  UndoParity,TrainingPlanCore1B,ImportReview77,MatchReview77,
  PendingReview77,CollisionReview77,DuplicateReview77,DataFailReview77,
  ProgramFailReview77
]);

const BuilderSearchData77=
  JSON.parse(JSON.stringify(EMPTY_DATA));

BuilderSearchData77.myExercises={
  "u:builder-search-former":{
    id:"u:builder-search-former",
    name:"Tempo Step Pattern",
    shape:"rounds",
    tags:["conditioning"],
    aliases:["tempo steps"],
    formerNames:["old tempo steps"],
    muscles:{
      primary:["legs"],
      secondary:[]
    },
    equipment:["step"],
    unilateral:false,
    bodyweight:true,
    deprecated:false
  }
};

const BuilderSearch77=boot(
  EXISTING_CFG,
  BuilderSearchData77,
  null,
  TEST_PROGRAM
);

BuilderSearch77.window.eval(`
  openBuilder(false);
`);

const builderSearchDocument77=
  BuilderSearch77.window.document;

let builderSearchInput77=
  builderSearchDocument77.querySelector(
    ".builderExerciseSearch"
  );

let builderSearchSelect77=
  builderSearchDocument77.querySelector(
    ".builderExerciseSelect"
  );

check(
  "v77 Program Builder exposes live exercise search",
  !!builderSearchInput77
  && !!builderSearchSelect77
  && builderSearchInput77.type==="search"
);

builderSearchInput77.value="running";

builderSearchInput77.dispatchEvent(
  new BuilderSearch77.window.Event(
    "input",
    {bubbles:true}
  )
);

check(
  "v77 Program Builder search resolves aliases",
  !!builderSearchSelect77.querySelector(
    'option[value="bp:run"]'
  )
  && [
    ...builderSearchSelect77.options
  ].filter(
    option=>
      option.value
      && option.value!=="__CUSTOM__"
  ).every(
    option=>
      option.value==="bp:run"
      || /run/i.test(option.textContent)
  )
);

builderSearchInput77.value="old tempo steps";

builderSearchInput77.dispatchEvent(
  new BuilderSearch77.window.Event(
    "input",
    {bubbles:true}
  )
);

check(
  "v77 Program Builder search resolves former custom names",
  !!builderSearchSelect77.querySelector(
    'option[value="u:builder-search-former"]'
  )
);

builderSearchInput77.value="";

builderSearchInput77.dispatchEvent(
  new BuilderSearch77.window.Event(
    "input",
    {bubbles:true}
  )
);

check(
  "v77 clearing Program Builder search restores grouped library",
  builderSearchSelect77.querySelectorAll(
    "optgroup"
  ).length>=7
  && !!builderSearchSelect77.querySelector(
    'option[value="bp:bench-press"]'
  )
  && !!builderSearchSelect77.querySelector(
    'option[value="bp:sprinting"]'
  )
  && !!builderSearchSelect77.querySelector(
    'option[value="__CUSTOM__"]'
  )
);

builderSearchSelect77.value="bp:run";

builderSearchDocument77.querySelector(
  ".builderExerciseAddButton"
).click();

check(
  "v77 Program Builder keeps canonical identity and tracking shape",
  BuilderSearch77.window.eval(`
    builderProg.days[0].exercises.length===1
    && builderProg.days[0].exercises[0]
      .exerciseId==="bp:run"
    && builderProg.days[0].exercises[0]
      .name==="Run"
    && builderProg.days[0].exercises[0]
      .trackingShape==="timeDist"
    && !Object.prototype.hasOwnProperty.call(
      builderProg.days[0].exercises[0],
      "scheme"
    )
  `)
);

builderSearchInput77=
  builderSearchDocument77.querySelector(
    ".builderExerciseSearch"
  );

builderSearchSelect77=
  builderSearchDocument77.querySelector(
    ".builderExerciseSelect"
  );

builderSearchSelect77.value="__CUSTOM__";

builderSearchSelect77.dispatchEvent(
  new BuilderSearch77.window.Event(
    "change",
    {bubbles:true}
  )
);

const builderCustomName77=
  builderSearchDocument77.querySelector(
    ".builderExerciseCustomName"
  );

const builderCustomShape77=
  builderSearchDocument77.querySelector(
    ".builderExerciseCustomShape"
  );

builderCustomName77.value=
  "Builder Interval Forge";

builderCustomShape77.value="rounds";

builderSearchDocument77.querySelector(
  ".builderExerciseAddButton"
).click();

const builderCustomId77=
  BuilderSearch77.window.eval(`
    builderProg.days[0].exercises[1]
      .exerciseId
  `);

check(
  "v77 searchable Program Builder preserves custom creation",
  builderCustomId77.startsWith("u:")
  && BuilderSearch77.window.eval(`
    builderProg.days[0].exercises[1]
      .name==="Builder Interval Forge"
    && builderProg.days[0].exercises[1]
      .trackingShape==="rounds"
    && data.myExercises[
      ${JSON.stringify(builderCustomId77)}
    ].shape==="rounds"
  `)
);

builderSearchInput77=
  builderSearchDocument77.querySelector(
    ".builderExerciseSearch"
  );

builderSearchSelect77=
  builderSearchDocument77.querySelector(
    ".builderExerciseSelect"
  );

builderSearchInput77.value=
  "Builder Interval Forge";

builderSearchInput77.dispatchEvent(
  new BuilderSearch77.window.Event(
    "input",
    {bubbles:true}
  )
);

check(
  "v77 Program Builder search includes newly saved custom exercises",
  !!builderSearchSelect77.querySelector(
    'option[value="'
    +builderCustomId77
    +'"]'
  )
);

check(
  "v77 Program Builder searching and adding does not replace active program",
  BuilderSearch77.window.eval(`
    program.name==="Test Program"
  `)
  && JSON.parse(
    BuilderSearch77.window.localStorage.getItem(
      "forge:program"
    )
  ).name==="Test Program"
);




// ================= v77 universal session replacement Phase 3B =================

const ReplaceProgram77={
  name:"Universal Replace",
  days:[{
    id:"D1",
    title:"Replacement Day",
    exercises:[
      {
        exerciseId:"bp:bench-press",
        name:"Bench Press",
        trackingShape:"lift",
        scheme:"3 × 5"
      },
      {
        exerciseId:"bp:run",
        name:"Run",
        trackingShape:"timeDist",
        scheme:"20 min"
      },
      {
        exerciseId:"bp:farmer-carry",
        name:"Farmer Carry",
        trackingShape:"carry",
        scheme:"3 × 40 ft"
      }
    ]
  }]
};

const ReplaceVisible77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  ReplaceProgram77
);

ReplaceVisible77.window.eval(`
  wDaySel.value="D1";
  activeSessionType="D1";
  extraExercises=[];
  initSessionState();
  renderSessionInputs();
`);

const ReplaceDocument77=
  ReplaceVisible77.window.document;

const ReplaceButtons77=[
  ...ReplaceDocument77.querySelectorAll(
    ".sessionReplaceBtn"
  )
];

check(
  "v77 every unsaved planned exercise has a visible Replace control",
  ReplaceButtons77.length===3
  && ReplaceButtons77.every(
    button=>button.textContent==="Replace"
  )
);

ReplaceButtons77[0].click();

const ReplaceMenu77=
  ReplaceDocument77.querySelector(
    ".session-replace-menu"
  );

check(
  "v77 Replace opens searchable full-library controls without custom creation",
  !!ReplaceMenu77
  && !!ReplaceMenu77.querySelector(
    ".sessionReplacementSearch"
  )
  && !!ReplaceMenu77.querySelector(
    ".sessionReplacementSelect"
  )
  && !ReplaceMenu77.querySelector(
    'option[value="__CUSTOM__"]'
  )
  && !/Create new exercise/i.test(
    ReplaceMenu77.textContent
  )
);

const ReplaceSearch77=
  ReplaceMenu77.querySelector(
    ".sessionReplacementSearch"
  );

const ReplaceSelect77=
  ReplaceMenu77.querySelector(
    ".sessionReplacementSelect"
  );

ReplaceSearch77.value="sprints";

ReplaceSearch77.dispatchEvent(
  new ReplaceVisible77.window.Event(
    "input",
    {bubbles:true}
  )
);

check(
  "v77 replacement search resolves aliases across tracking shapes",
  !!ReplaceSelect77.querySelector(
    'option[value="bp:sprint-intervals"]'
  )
);

const CrossShapeData77=
  JSON.parse(JSON.stringify(EMPTY_DATA));

CrossShapeData77.workouts=[{
  date:"2026-07-29",
  day:"D1",
  sets:{
    Run:{
      t:"timeDist",
      secs:1200,
      dist:2,
      distUnit:"mi"
    }
  },
  notes:""
}];

const BenchToRun77=boot(
  EXISTING_CFG,
  CrossShapeData77,
  null,
  {
    name:"Bench to Run",
    days:[{
      id:"D1",
      title:"Cross Shape",
      exercises:[{
        exerciseId:"bp:bench-press",
        name:"Bench Press",
        trackingShape:"lift",
        scheme:"3 × 5"
      }]
    }]
  }
);

const BenchProgramBefore77=
  BenchToRun77.window.localStorage.getItem(
    "forge:program"
  );

BenchToRun77.window.eval(`
  wDaySel.value="D1";
  activeSessionType="D1";
  extraExercises=[];
  initSessionState();

  sessionState["Bench Press"].rows[0]={
    w:225,
    r:5,
    done:false,
    touched:true
  };

  window.__replaceConfirmCalls77=0;

  confirm=()=>{
    window.__replaceConfirmCalls77++;
    return false;
  };

  window.__cancelBenchToRun77=
    applySessionReplacement(
      "Bench Press",
      "Bench Press",
      "bp:run"
    );
`);

check(
  "v77 cancelling replacement with entered data preserves the original editor",
  BenchToRun77.window.eval(`
    window.__cancelBenchToRun77===false
    && window.__replaceConfirmCalls77===1
    && Object.keys(sessionSwaps).length===0
    && sessionState["Bench Press"].shape==="lift"
    && sessionState["Bench Press"].rows[0].w===225
  `)
);

BenchToRun77.window.eval(`
  confirm=()=>{
    window.__replaceConfirmCalls77++;
    return true;
  };

  window.__benchToRun77=
    applySessionReplacement(
      "Bench Press",
      "Bench Press",
      "bp:run"
    );
`);

check(
  "v77 Bench Press can be replaced by Run with the target editor and history",
  BenchToRun77.window.eval(`
    window.__benchToRun77===true
    && sessionSwaps["Bench Press"]==="Run"
    && !sessionState["Bench Press"]
    && sessionState["Run"].shape==="timeDist"
    && Number(sessionState["Run"].typed.hours)===0
    && Number(sessionState["Run"].typed.minutes)===0
    && Number(sessionState["Run"].typed.seconds)===0
    && sessionList()[0].shape==="timeDist"
  `)
  && !!BenchToRun77.window.document.querySelector(
    '#exerciseInputs .exercise[data-shape="timeDist"]'
  )
  && !!BenchToRun77.window.document.querySelector(
    "#exerciseInputs .lastLine"
  )
);

check(
  "v77 cross-shape replacement transfers no incompatible entered value",
  BenchToRun77.window.eval(`
    Array.isArray(sessionState["Run"].rows)
    && sessionState["Run"].rows.length===0
    && Number(sessionState["Run"].typed.hours)===0
    && Number(sessionState["Run"].typed.minutes)===0
    && Number(sessionState["Run"].typed.seconds)===0
    && sessionState["Run"].typed.distance===""
    && sessionState["Run"].saved===null
    && sessionState["Run"].status==="plan"
  `)
);

check(
  "v77 session replacement leaves the stored program unchanged",
  BenchToRun77.window.localStorage.getItem(
    "forge:program"
  )===BenchProgramBefore77
  && BenchToRun77.window.eval(`
    program.days[0].exercises[0]
      .name==="Bench Press"
    && program.days[0].exercises[0]
      .trackingShape==="lift"
  `)
);

BenchToRun77.window.eval(`
  window.__restoreBench77=
    applySessionReplacement(
      "Bench Press",
      "Run",
      "bp:bench-press"
    );
`);

check(
  "v77 choosing the original exercise restores its original editor and scheme",
  BenchToRun77.window.eval(`
    window.__restoreBench77===true
    && Object.keys(sessionSwaps).length===0
    && sessionState["Bench Press"].shape==="lift"
    && sessionList()[0].name==="Bench Press"
    && sessionList()[0].scheme==="3 × 5"
  `)
  && !!BenchToRun77.window.document.querySelector(
    '#exerciseInputs .exercise[data-shape="lift"]'
  )
);

const RunToIntervals77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  {
    name:"Run to Intervals",
    days:[{
      id:"D1",
      title:"Intervals",
      exercises:[{
        exerciseId:"bp:run",
        name:"Run",
        trackingShape:"timeDist",
        scheme:"20 min"
      }]
    }]
  }
);

RunToIntervals77.window.eval(`
  wDaySel.value="D1";
  activeSessionType="D1";
  extraExercises=[];
  initSessionState();

  window.__runToIntervals77=
    applySessionReplacement(
      "Run",
      "Run",
      "bp:sprint-intervals"
    );
`);

check(
  "v77 Run can be replaced by Sprint Intervals with a rounds editor",
  RunToIntervals77.window.eval(`
    window.__runToIntervals77===true
    && sessionSwaps["Run"]==="Sprint Intervals"
    && sessionState["Sprint Intervals"]
      .shape==="rounds"
    && sessionList()[0].shape==="rounds"
    && sessionList()[0].scheme===""
  `)
  && !!RunToIntervals77.window.document.querySelector(
    '#exerciseInputs .exercise[data-shape="rounds"]'
  )
);

const BenchToCarry77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  {
    name:"Bench to Carry",
    days:[{
      id:"D1",
      title:"Carry",
      exercises:[{
        exerciseId:"bp:bench-press",
        name:"Bench Press",
        trackingShape:"lift",
        scheme:"3 × 5"
      }]
    }]
  }
);

BenchToCarry77.window.eval(`
  wDaySel.value="D1";
  activeSessionType="D1";
  extraExercises=[];
  initSessionState();

  window.__benchToCarry77=
    applySessionReplacement(
      "Bench Press",
      "Bench Press",
      "bp:farmer-carry"
    );
`);

check(
  "v77 Farmer Carry replacement opens the carry editor",
  BenchToCarry77.window.eval(`
    window.__benchToCarry77===true
    && sessionState["Farmer Carry"]
      .shape==="carry"
    && sessionList()[0].shape==="carry"
  `)
  && !!BenchToCarry77.window.document.querySelector(
    '#exerciseInputs .exercise[data-shape="carry"]'
  )
);

const DuplicateReplace77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  {
    name:"Duplicate Guard",
    days:[{
      id:"D1",
      title:"Duplicate Guard",
      exercises:[
        {
          exerciseId:"bp:bench-press",
          name:"Bench Press",
          trackingShape:"lift",
          scheme:"3 × 5"
        },
        {
          exerciseId:"bp:run",
          name:"Run",
          trackingShape:"timeDist",
          scheme:"20 min"
        }
      ]
    }]
  }
);

DuplicateReplace77.window.eval(`
  wDaySel.value="D1";
  activeSessionType="D1";
  extraExercises=[];
  initSessionState();

  window.__duplicateStateBefore77=
    JSON.stringify(sessionState);

  window.__duplicateReplace77=
    applySessionReplacement(
      "Bench Press",
      "Bench Press",
      "bp:run"
    );
`);

check(
  "v77 replacement blocks an exercise already in the session without mutation",
  DuplicateReplace77.window.eval(`
    window.__duplicateReplace77===false
    && Object.keys(sessionSwaps).length===0
    && JSON.stringify(sessionState)
      ===window.__duplicateStateBefore77
  `)
  && /already in this session/i.test(
    DuplicateReplace77.window.document
      .getElementById("workoutErr")
      .textContent
  )
);

const ReplacementFreedIdentity77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  {
    name:"Replacement freed identity",
    days:[{
      id:"D1",
      title:"Replacement freed identity",
      exercises:[
        {
          exerciseId:"bp:bench-press",
          name:"Bench Press",
          trackingShape:"lift",
          scheme:"3 × 5"
        },
        {
          exerciseId:"bp:run",
          name:"Run",
          trackingShape:"timeDist",
          scheme:"20 min"
        }
      ]
    }]
  }
);

ReplacementFreedIdentity77.window.confirm=
  ()=>true;

ReplacementFreedIdentity77.window.eval(`
  wDaySel.value="D1";
  activeSessionType="D1";
  extraExercises=[];
  initSessionState();

  const arnold77=
    resolveExerciseByName("Arnold Press");

  const run77=
    resolveExerciseByName("Run");

  window.__runToArnold77=
    !!arnold77
    && applySessionReplacement(
      "Run",
      "Run",
      arnold77.id
    );

  window.__freedForReplacement77=
    !!run77
    && sessionContainsReplacementIdentity(
      run77,
      "Bench Press"
    )===false;

  window.__strictAddStillBlocks77=
    !!run77
    && sessionContainsExerciseIdentity(
      run77,
      null
    )===true;

  window.__benchToRun77=
    !!run77
    && applySessionReplacement(
      "Bench Press",
      "Bench Press",
      run77.id
    );
`);

check(
  "v77 universal replacement may reuse a replaced-away identity",
  ReplacementFreedIdentity77.window.eval(`
    window.__runToArnold77===true
    && window.__freedForReplacement77===true
    && window.__strictAddStillBlocks77===true
    && window.__benchToRun77===true
    && sessionSwaps["Run"]==="Arnold Press"
    && sessionSwaps["Bench Press"]==="Run"
    && sessionList().length===2
    && sessionList()[0].name==="Run"
    && sessionList()[0].shape==="timeDist"
    && sessionList()[1].name==="Arnold Press"
    && sessionList()[1].shape==="lift"
  `)
);

const ReplaceCustomData77=
  JSON.parse(JSON.stringify(EMPTY_DATA));

ReplaceCustomData77.myExercises={
  "u:replace-custom-carry":{
    id:"u:replace-custom-carry",
    name:"Garage Sandbag Carry",
    shape:"carry",
    tags:["strength","carry"],
    aliases:["garage carry"],
    formerNames:["old garage carry"],
    muscles:{
      primary:["full-body"],
      secondary:[]
    },
    equipment:["sandbag"],
    unilateral:false,
    bodyweight:false,
    deprecated:false
  }
};

const ReplaceCustom77=boot(
  EXISTING_CFG,
  ReplaceCustomData77,
  null,
  {
    name:"Custom Replacement",
    days:[{
      id:"D1",
      title:"Custom",
      exercises:[{
        exerciseId:"bp:bench-press",
        name:"Bench Press",
        trackingShape:"lift",
        scheme:"3 × 5"
      }]
    }]
  }
);

const CustomReplacementOptions77=
  ReplaceCustom77.window.eval(`
    sessionReplacementOptions(
      "Bench Press",
      "Bench Press",
      "old garage carry"
    ).map(entry=>entry.id)
  `);

check(
  "v77 universal replacement search includes custom former-name matches",
  CustomReplacementOptions77.includes(
    "u:replace-custom-carry"
  )
);

const ReplacementRollbackData77=
  JSON.parse(JSON.stringify(EMPTY_DATA));

ReplacementRollbackData77.activeWorkoutDraft={
  date:"2026-07-30",
  day:"D1",
  title:"Rollback Day",
  programName:"Replacement Rollback",
  sets:{
    "Bench Press":[
      {w:185,r:5}
    ]
  },
  notes:"",
  updatedAt:
    "2026-07-30T12:00:00.000Z"
};

const ReplacementRollback77=boot(
  EXISTING_CFG,
  ReplacementRollbackData77,
  null,
  {
    name:"Replacement Rollback",
    days:[{
      id:"D1",
      title:"Rollback Day",
      exercises:[{
        exerciseId:"bp:bench-press",
        name:"Bench Press",
        trackingShape:"lift",
        scheme:"3 × 5"
      }]
    }]
  }
);

ReplacementRollback77.window.eval(`
  resumeWorkoutDraft();

  window.__replaceRollbackDraft77=
    JSON.stringify(data.activeWorkoutDraft);

  window.__replaceRollbackState77=
    JSON.stringify(sessionState);

  window.__originalReplaceSave77=save;
  save=()=>false;

  window.__replaceRollback77=
    applySessionReplacement(
      "Bench Press",
      "Bench Press",
      "bp:run"
    );

  save=window.__originalReplaceSave77;
`);

check(
  "v77 failed loaded-draft replacement restores the swap state result and draft",
  ReplacementRollback77.window.eval(`
    window.__replaceRollback77===false
    && Object.keys(sessionSwaps).length===0
    && JSON.stringify(sessionState)
      ===window.__replaceRollbackState77
    && JSON.stringify(data.activeWorkoutDraft)
      ===window.__replaceRollbackDraft77
    && sessionState["Bench Press"].status==="saved"
  `)
);


// ================= v77 physical warning synchronization repair =================
const PhysicalWarningTrain77=fs.readFileSync(
  "scripts/03-train.js",
  "utf8"
);

const PhysicalWarningAI77=fs.readFileSync(
  "scripts/05-ai.js",
  "utf8"
);

const PhysicalWarningApplyStart77=
  PhysicalWarningAI77.indexOf(
    "function applySessionReplacement("
  );

const PhysicalWarningSync77=
  PhysicalWarningAI77.indexOf(
    "syncVisibleSessionInputs(currentShown);",
    PhysicalWarningApplyStart77
  );

const PhysicalWarningStateLookup77=
  PhysicalWarningAI77.indexOf(
    "const currentKey=Object.keys(",
    PhysicalWarningApplyStart77
  );

check(
  "v77 replacement synchronizes visible entered values before discard warning",
  PhysicalWarningTrain77.includes(
    "function syncVisibleSessionInputs(exName)"
  )
  &&PhysicalWarningTrain77.includes(
    'document.querySelectorAll("#exerciseInputs input")'
  )
  &&PhysicalWarningTrain77.includes(
    "syncVisibleSessionInputs(ex.name);"
  )
  &&PhysicalWarningApplyStart77>=0
  &&PhysicalWarningSync77>PhysicalWarningApplyStart77
  &&PhysicalWarningStateLookup77>PhysicalWarningSync77
  &&PhysicalWarningAI77.includes(
    "normalizeExerciseName(currentShown)"
  )
);

// ================= v77 physical presentation repair 1B =================
const PhysicalBuilderSource77=fs.readFileSync(
  "scripts/03-train.js",
  "utf8"
);

const PhysicalBuilderCSS77=fs.readFileSync(
  "index.html",
  "utf8"
);

check(
  "v77 Program Builder immediately explains each exercise tracking type",
  PhysicalBuilderSource77.includes(
    "function builderTrackingPresentation(ex)"
  )
  &&PhysicalBuilderSource77.includes(
    'label:"Time + distance"'
  )
  &&PhysicalBuilderSource77.includes(
    'label:"Weight + distance"'
  )
  &&PhysicalBuilderSource77.includes(
    'label:"Rounds + work/rest"'
  )
  &&PhysicalBuilderSource77.includes(
    '"Tracks: "+presentation.label'
  )
  &&PhysicalBuilderSource77.includes(
    'toggle.textContent='
  )
  &&!PhysicalBuilderSource77.includes(
    'className = "bscheme builderExerciseScheme"'
  )
  &&PhysicalBuilderCSS77.includes(
    ".builder-tracking-chip"
  )
);

const PhysicalReplacementSource77=fs.readFileSync(
  "scripts/05-ai.js",
  "utf8"
);

const PhysicalReplacementOptionsStart77=
  PhysicalReplacementSource77.indexOf(
    "function sessionReplacementOptions("
  );

const PhysicalReplacementPopulateStart77=
  PhysicalReplacementSource77.indexOf(
    "function populateSessionReplacementSelect("
  );

const PhysicalReplacementOfferStart77=
  PhysicalReplacementSource77.indexOf(
    "function offerSessionReplacement("
  );

const PhysicalReplacementOptionsBlock77=
  PhysicalReplacementSource77.slice(
    PhysicalReplacementOptionsStart77,
    PhysicalReplacementPopulateStart77
  );

const PhysicalReplacementPopulateBlock77=
  PhysicalReplacementSource77.slice(
    PhysicalReplacementPopulateStart77,
    PhysicalReplacementOfferStart77
  );

check(
  "v77 replacement search shows same-session matches disabled instead of hiding them",
  PhysicalReplacementOptionsStart77>=0
  &&PhysicalReplacementPopulateStart77
    >PhysicalReplacementOptionsStart77
  &&!PhysicalReplacementOptionsBlock77.includes(
    "&& !sessionContainsExerciseIdentity("
  )
  &&PhysicalReplacementPopulateBlock77.includes(
    "const alreadyInSession="
  )
  &&PhysicalReplacementPopulateBlock77.includes(
    "option.disabled=alreadyInSession;"
  )
  &&PhysicalReplacementPopulateBlock77.includes(
    '" — already in this session"'
  )
  &&PhysicalReplacementPopulateBlock77.includes(
    "sessionContainsReplacementIdentity("
  )
  &&PhysicalReplacementSource77.includes(
    "sessionContainsReplacementIdentity(\n      targetEntry,"
  )
);


// ================= v77 native parity integration =================

await wait(0);
releaseTestWindows([
  BuilderSearch77,ReplaceVisible77,BenchToRun77,RunToIntervals77,
  BenchToCarry77,DuplicateReplace77,ReplacementFreedIdentity77,
  ReplaceCustom77,ReplacementRollback77
]);

// ================= v78 profile-aware exercise cards =================

const V78Index=fs.readFileSync("index.html","utf8");
const V78ServiceWorker=fs.readFileSync("sw.js","utf8");

check(
  "v78 home weight and goal metrics retain native emphasis",
  /\.big\s*\{[^}]*font-size:50px/s.test(V78Index)
  && /\.big small\s*\{[^}]*font-size:20px/s.test(V78Index)
  && (V78Index.match(/class="big(?: ember-text)?"/g)||[])
    .length===2
);

check(
  "v78 profile data and engine load before Train",
  V78Index.indexOf('src="data-exercise-card-profiles.js')>=0
  && V78Index.indexOf('src="scripts/03-card-profiles.js')
    >V78Index.indexOf('src="data-exercise-card-profiles.js')
  && V78Index.indexOf('src="scripts/03-train.js')
    >V78Index.indexOf('src="scripts/03-card-profiles.js')
);

check(
  "Phase 1 service worker keeps both profile files in the refreshed cache",
  V78ServiceWorker.includes('"./data-exercise-card-profiles.js')
  && V78ServiceWorker.includes('"./scripts/03-card-profiles.js')
  && V78ServiceWorker.includes(
    'const CACHE = "blackpyre-v118-unified-removal-1"'
  )
);

const ProfileBuilder78=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  {
    name:"Profile Builder",
    days:[{
      id:"D1",
      title:"Profiles",
      exercises:[{
        exerciseId:"bp:bench-press",
        name:"Bench Press",
        trackingShape:"lift"
      },{
        exerciseId:"bp:push-up",
        name:"Push-Up",
        trackingShape:"reps"
      }]
    }]
  }
);

const ProfileBuilderDocument78=
  ProfileBuilder78.window.document;

const ProfileMatrix78=
  ProfileBuilder78.window.eval(`
    ({
      "Bench Press":"strengthSets",
      "Push-Up":"repetitionSets",
      "Assisted Pull-Up":"repetitionSets",
      "Plank":"timedHold",
      "Run":"steadyTimeDistance",
      "Sprinting":"timedIntervals",
      "Shuttle Runs":"distanceIntervals",
      "Farmer Carry":"loadedDistance",
      "EMOM Conditioning":"conditioningRounds",
      "Yoga":"durationActivity",
      "Physical Therapy":"activityNotes"
    })
  `);

check(
  "v78 named exercise cards resolve to all practical profiles",
  ProfileBuilder78.window.eval(`
    Object.entries(${JSON.stringify(ProfileMatrix78)})
      .every(([name,profile])=>
        bpWorkoutProfileResolution({name:name}).profile===profile
      )
  `)
);

check(
  "v78 profile-aware name resolution preserves canonical and custom shapes",
  ProfileBuilder78.window.eval(`
    bpWorkoutProfileResolution({name:"Run"}).id==="bp:run"
    && bpWorkoutProfileResolution({
      name:"Unlisted Carry",
      trackingShape:"carry"
    }).profile==="loadedDistance"
  `)
);

ProfileBuilder78.window.eval("openBuilder(true)");

check(
  "v78 builder retains web search and canonical picker without a generic scheme",
  !!ProfileBuilderDocument78.querySelector(".builderExerciseSearch")
  && !!ProfileBuilderDocument78.querySelector(".builderExerciseSelect")
  && !ProfileBuilderDocument78.querySelector(".builderExerciseScheme")
  && !ProfileBuilderDocument78.querySelector(".builder-exercise-row .bscheme")
);

const ProfileSearch78=
  ProfileBuilderDocument78.querySelector(".builderExerciseSearch");
const ProfileSelect78=
  ProfileBuilderDocument78.querySelector(".builderExerciseSelect");

ProfileSearch78.value="running";
ProfileSearch78.dispatchEvent(
  new ProfileBuilder78.window.Event("input",{bubbles:true})
);

check(
  "v78 builder search keeps the v77 alias resolver and canonical IDs",
  !!ProfileSelect78.querySelector('option[value="bp:run"]')
);

ProfileSelect78.value="bp:run";
ProfileBuilderDocument78.querySelector(
  ".builderExerciseAddButton"
).click();

check(
  "v78 builder adds canonical identity and profile-aware details controls",
  ProfileBuilder78.window.eval(`
    builderProg.days[0].exercises[2].exerciseId==="bp:run"
    && builderProg.days[0].exercises[2].trackingShape==="timeDist"
  `)
  && ProfileBuilderDocument78.querySelectorAll(
    ".builder-prescription-toggle"
  ).length===3
);

ProfileBuilderDocument78.querySelector(
  '[data-builder-prescription-toggle="0:2"]'
).click();

const profileField78=key=>
  ProfileBuilderDocument78.querySelector(
    '[data-builder-prescription-field="'+key+'"]'
  );

profileField78("minutes").value="30";
profileField78("distance").value="5";
profileField78("distanceUnit").value="km";
profileField78("pace").value="easy";
profileField78("effort").value="conversational";

ProfileBuilderDocument78.querySelector(
  '[data-builder-prescription-action="apply"]'
).click();

check(
  "v78 builder saves structured practical workout details",
  ProfileBuilder78.window.eval(`
    (p=>
      p.durationSeconds===1800
      && p.distance===5
      && p.distanceUnit==="km"
      && p.pace==="easy"
      && p.effort==="conversational"
      && !Object.prototype.hasOwnProperty.call(p,"scheme")
    )(builderProg.days[0].exercises[2].prescription)
  `)
);

const ProfileRows78=
  ProfileBuilder78.window.eval(`
    ({
      strength:prefillRows({
        name:"Bench Press",
        prescription:{sets:3,reps:5,weight:185,weightUnit:"lb"}
      },null),
      repetitions:prefillRows({
        name:"Push-Up",
        prescription:{sets:3,reps:5}
      },null)
    })
  `);

check(
  "v78 structured set prescriptions prefill rows, reps, and explicit weight",
  ProfileRows78.strength.rows.length===3
  && ProfileRows78.strength.rows.every(
    row=>row.r===5 && row.w===185 && row.touched===false
  )
  && ProfileRows78.repetitions.rows.length===3
  && ProfileRows78.repetitions.rows.every(
    row=>row.r===5 && row.w==="" && row.touched===false
  )
);

check(
  "v78 session descriptors preserve structured program prescriptions",
  ProfileBuilder78.window.eval(`
    (previous=>{
      program={
        name:"Prescription session",
        days:[{
          id:"D1",
          title:"Strength",
          exercises:[{
            name:"Bench Press",
            exerciseId:"bp:bench-press",
            trackingShape:"lift",
            prescription:{sets:4,reps:6,weight:175}
          }]
        }]
      };
      wDaySel.value="D1";
      const listed=sessionList()[0];
      program=previous;
      return listed.prescription.sets===4
        && listed.prescription.reps===6
        && listed.prescription.weight===175;
    })(program)
  `)
);

check(
  "v78 repetition policies hide bodyweight and label assistance",
  ProfileBuilder78.window.eval(`
    (a=>
      a.options.weightPolicy==="optional"
      && a.options.weightLabel==="Assistance"
      && bpWorkoutProfileResolution({name:"Push-Up"})
        .options.weightPolicy==="optional"
    )(bpWorkoutProfileResolution({name:"Assisted Pull-Up"}))
  `)
);

check(
  "v78 builder mobile CSS contains controls and preserves touch sizing",
  /@media \(max-width:520px\)[\s\S]*?\.bex-add[\s\S]*?grid-template-columns:minmax\(0,1fr\)/.test(V78Index)
  && /\.builder-prescription-toggle\s*\{[^}]*min-height:44px/s.test(V78Index)
  && /\.builder-prescription-field input,[\s\S]*?min-width:0/s.test(V78Index)
);

const CanonicalImportAudit78=
  ProfileBuilder78.window.eval(`
    (()=>{
      const samples={
        strengthSets:{sets:3,reps:8,weight:100,weightUnit:"lb"},
        repetitionSets:{sets:3,reps:8},
        timedHold:{sets:3,durationSeconds:30},
        steadyTimeDistance:{durationSeconds:1200,distance:2,distanceUnit:"mi"},
        durationActivity:{durationSeconds:1200,notes:"Easy movement"},
        timedIntervals:{intervals:8,durationSeconds:20,recoverySeconds:60},
        distanceIntervals:{intervals:6,distance:50,distanceUnit:"m",recoverySeconds:60},
        loadedDistance:{trips:4,weight:80,weightUnit:"lb",distance:40,distanceUnit:"ft"},
        conditioningRounds:{rounds:5,workSeconds:60,recoverySeconds:30},
        activityNotes:{durationSeconds:1200,notes:"Complete the planned work."}
      };

      const failures=[];
      const roundTripFailures=[];

      EXERCISE_LIBRARY.forEach(entry=>{
        const profile=
          bpWorkoutProfileResolution(entry).profile;

        const documentValue={
          format:"blackpyre-training-plan",
          version:1,
          program:{
            name:"Canonical import audit",
            days:[{
              id:"D1",
              title:"Audit",
              exercises:[{
                exerciseId:entry.id,
                name:entry.name,
                trackingShape:entry.shape,
                prescription:cloneJSON(samples[profile])
              }]
            }]
          }
        };

        const prepared=
          prepareTrainingPlanImport(documentValue);

        if(!prepared.canConfirm){
          failures.push({
            id:entry.id,
            profile:profile,
            errors:prepared.review[0].errors
          });
          return;
        }

        const exported=
          trainingPlanInterchangeFromProgram(
            prepared.candidate
          );

        const roundTrip=
          prepareTrainingPlanImport(exported);

        if(!roundTrip.canConfirm){
          roundTripFailures.push({
            id:entry.id,
            profile:profile,
            errors:roundTrip.review[0].errors
          });
        }
      });

      return {
        count:EXERCISE_LIBRARY.length,
        failures:failures,
        roundTripFailures:roundTripFailures
      };
    })()
  `);

check(
  "v78 all 203 canonical exercises accept their authoritative profile prescription",
  CanonicalImportAudit78.count===203
  && CanonicalImportAudit78.failures.length===0
);

check(
  "v78 all 203 profile-aware prescriptions survive public export and re-import",
  CanonicalImportAudit78.roundTripFailures.length===0
);

await wait(0);
releaseTestWindows([ProfileBuilder78]);

const NativeParity77=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  null,
  TEST_PROGRAM
);

const NativeParityMatrix77=
  NativeParity77.window.eval(`
    (()=>{
      const expected={
        "Barbell Bench Press":
          "bp:bench-press",
        "Seated Dumbbell Shoulder Press":
          "bp:dumbbell-shoulder-press",
        "Cable Triceps Pressdown":
          "bp:triceps-pushdown",
        "Weighted Pull-Up":
          "bp:pull-up",
        "EZ Bar Curl":
          "bp:biceps-curl"
      };

      return Object.entries(expected)
        .every(([name,id])=>{
          const result=
            resolveTrainingPlanExercise({
              name:name
            });

          return (
            result.ok
            && result.entry.id===id
          );
        });
    })()
  `);

check(
  "v77 systemic resolver covers the full required AI-name matrix",
  NativeParityMatrix77===true
);

const NativeParityAmbiguous77=
  NativeParity77.window.eval(`
    (()=>{
      const result=
        resolveTrainingPlanExercise({
          name:"Chest Supported Row"
        });

      return {
        ok:result.ok,
        first:
          result.suggestions[0]
          && result.suggestions[0].id
      };
    })()
  `);

check(
  "v77 ambiguous Chest Supported Row remains blocked with the likely match first",
  NativeParityAmbiguous77.ok===false
  && NativeParityAmbiguous77.first
    ==="bp:chest-supported-dumbbell-row"
);

NativeParity77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Review UX",
        days:[{
          id:"D1",
          title:"Rows",
          exercises:[{
            name:"Chest Supported Row",
            prescription:{
              sets:3,
              reps:10
            }
          }]
        }]
      }
    }),
    "review-ux.json"
  );
`);

const NativeParityDocument77=
  NativeParity77.window.document;

const NativeParityReviewSelect77=
  NativeParityDocument77.querySelector(
    ".training-plan-review-resolution select"
  );

const NativeParityCustom77=
  NativeParityDocument77.querySelector(
    ".training-plan-review-custom"
  );

check(
  "v77 review dropdown keeps likely matches before the full library",
  !!NativeParityReviewSelect77
  && !!NativeParityReviewSelect77
    .querySelector(
      'optgroup[label="Likely matches"]'
    )
  && NativeParityReviewSelect77
    .querySelector(
      'optgroup[label="Likely matches"] option'
    ).value
      ==="bp:chest-supported-dumbbell-row"
);

check(
  "v77 custom exercise creation stays collapsed behind simple wording",
  !!NativeParityCustom77
  && NativeParityCustom77.classList
    .contains("hidden")
  && [
    ...NativeParityDocument77
      .querySelectorAll(
        ".training-plan-review-resolution button"
      )
  ].some(button=>
    button.textContent
      ==="Create a custom exercise instead"
  )
);

const NativeParityTimed77=
  NativeParity77.window.eval(`
    (()=>{
      const complete=
        prepareTrainingPlanImport({
          format:"blackpyre-training-plan",
          version:1,
          program:{
            name:"Plank Complete",
            days:[{
              id:"D1",
              title:"Core",
              exercises:[{
                name:"Plank",
                prescription:{
                  sets:3,
                  durationSeconds:60
                }
              }]
            }]
          }
        });

      const missing=
        prepareTrainingPlanImport({
          format:"blackpyre-training-plan",
          version:1,
          program:{
            name:"Plank Missing",
            days:[{
              id:"D1",
              title:"Core",
              exercises:[{
                name:"Plank",
                prescription:{sets:3}
              }]
            }]
          }
        });

      return {
        complete:complete.canConfirm,
        intervals:
          complete.review[0]
            .prescription.intervals,
        duration:
          complete.review[0]
            .prescription.durationSeconds,
        missing:missing.canConfirm,
        errors:missing.review[0].errors,
        summary:
          trainingPlanPrescriptionSummary(
            "timeDist",
            {
              intervals:8,
              durationSeconds:15,
              recoverySeconds:75
            },
            ""
          )
      };
    })()
  `);

check(
  "v77 timed prescriptions normalize and show complete information",
  NativeParityTimed77.complete===true
  && NativeParityTimed77.intervals===3
  && NativeParityTimed77.duration===60
  && NativeParityTimed77.missing===false
  && NativeParityTimed77.errors.length===1
  && NativeParityTimed77.errors[0]
    ==="Add a duration for each interval."
  && NativeParityTimed77.summary
    ==="8 intervals · 15 sec each · 75 sec recovery"
);

NativeParity77.window.eval(`
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Plank repair",
        days:[{
          id:"D1",
          title:"Core",
          exercises:[{
            name:"Plank",
            prescription:{sets:3}
          }]
        }]
      }
    }),
    "04-plank-missing-duration.json"
  );
`);

check(
  "v78 matched Plank offers duration repair instead of exercise rematching",
  !!NativeParityDocument77.querySelector(
    '[data-prescription-repair-action="duration"]'
  )
  && !NativeParityDocument77.querySelector(
    ".training-plan-review-resolution"
  )
);

NativeParityDocument77.querySelector(
  '[data-prescription-repair-field="seconds"]'
).value="45";

NativeParityDocument77.querySelector(
  '[data-prescription-repair-action="duration"]'
).click();

check(
  "v78 Plank duration repair produces an importable prescription",
  NativeParity77.window.eval(`
    trainingPlanReviewState.prepared.canConfirm
    && trainingPlanReviewState.prepared.candidate
      .days[0].exercises[0].prescription.intervals===3
    && trainingPlanReviewState.prepared.candidate
      .days[0].exercises[0].prescription.durationSeconds===45
  `)
);

NativeParity77.window.eval(`
  closeTrainingPlanReview({skipFocus:true});
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Sprinting repair",
        days:[{
          id:"D1",
          title:"Speed",
          exercises:[{
            name:"Sprinting",
            prescription:{
              intervals:6,
              durationSeconds:20,
              recoverySeconds:60,
              weight:100,
              weightUnit:"lb"
            }
          }]
        }]
      }
    }),
    "05-sprinting-unsafe-weight.json"
  );
`);

check(
  "v78 matched Sprinting offers safe incompatible-field removal",
  !!NativeParityDocument77.querySelector(
    '[data-prescription-repair-action="remove-incompatible"]'
  )
  && !NativeParityDocument77.querySelector(
    ".training-plan-review-resolution"
  )
);

NativeParityDocument77.querySelector(
  '[data-prescription-repair-action="remove-incompatible"]'
).click();

check(
  "v78 Sprinting repair preserves intervals and removes unsafe weight",
  NativeParity77.window.eval(`
    (p=>
      trainingPlanReviewState.prepared.canConfirm
      && p.intervals===6
      && p.durationSeconds===20
      && p.recoverySeconds===60
      && !Object.prototype.hasOwnProperty.call(p,"weight")
      && !Object.prototype.hasOwnProperty.call(p,"weightUnit")
    )(
      trainingPlanReviewState.prepared.candidate
        .days[0].exercises[0].prescription
    )
  `)
);

NativeParity77.window.eval(`
  closeTrainingPlanReview({skipFocus:true});
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Farmer Carry missing load",
        days:[{
          id:"D1",
          title:"Athletic Conditioning",
          exercises:[{
            name:"Farmer Carry",
            prescription:{
              sets:6,
              distance:30,
              distanceUnit:"m"
            }
          }]
        }]
      }
    }),
    "farmer-carry-missing-load.json"
  );
`);

check(
  "v78 matched Farmer Carry offers a planned-load repair",
  NativeParity77.window.eval(`
    (row=>
      !trainingPlanReviewState.prepared.canConfirm
      && row.exerciseId==="bp:farmer-carry"
      && row.repairKind==="missing-load"
      && row.errors.length===1
      && row.errors[0]==="Add the planned load."
      && row.prescription.sets===6
      && row.prescription.distance===30
      && row.prescription.distanceUnit==="m"
    )(trainingPlanReviewState.prepared.review[0])
  `)
  && !!NativeParityDocument77.querySelector(
    '[data-prescription-repair-field="weight"]'
  )
  && !!NativeParityDocument77.querySelector(
    '[data-prescription-repair-action="load"]'
  )
);

NativeParityDocument77.querySelector(
  '[data-prescription-repair-field="weight"]'
).value="80";

NativeParityDocument77.querySelector(
  '[data-prescription-repair-action="load"]'
).click();

check(
  "v78 Farmer Carry load repair preserves the canonical distance prescription",
  NativeParity77.window.eval(`
    (exercise=>
      trainingPlanReviewState.prepared.canConfirm
      && exercise.exerciseId==="bp:farmer-carry"
      && exercise.trackingShape==="carry"
      && exercise.prescription.sets===6
      && exercise.prescription.distance===30
      && exercise.prescription.distanceUnit==="m"
      && exercise.prescription.weight===80
      && exercise.prescription.weightUnit==="lb"
    )(
      trainingPlanReviewState.prepared.candidate
        .days[0].exercises[0]
    )
  `)
);

NativeParity77.window.eval(`
  closeTrainingPlanReview({skipFocus:true});
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Bike profile repair",
        days:[{
          id:"D1",
          title:"Athletic Conditioning",
          exercises:[{
            name:"Bike Intervals",
            prescription:{
              durationSeconds:1200,
              effort:"Easy"
            }
          }]
        }]
      }
    }),
    "bike-duration.json"
  );
`);

const BikeCompatibleGroup78=
  NativeParityDocument77.querySelector(
    '.training-plan-review-resolution optgroup[label="Compatible matches"]'
  );

check(
  "v78 Bike Intervals uses its timed-interval profile and offers both repair paths",
  NativeParity77.window.eval(`
    (row=>
      !trainingPlanReviewState.prepared.canConfirm
      && row.exerciseId==="bp:bike-intervals"
      && row.repairKind==="missing-interval-count"
      && row.errors.length===1
      && row.errors[0]==="Add the number of intervals."
      && row.prescription.durationSeconds===1200
      && row.prescription.effort==="Easy"
    )(trainingPlanReviewState.prepared.review[0])
  `)
  && !!NativeParityDocument77.querySelector(
    '[data-prescription-repair-action="interval-count"]'
  )
  && !!BikeCompatibleGroup78
  && [
    "bp:road-cycling",
    "bp:stationary-cycling",
    "bp:mountain-biking"
  ].every(id=>
    !!BikeCompatibleGroup78.querySelector(
      'option[value="'+id+'"]'
    )
  )
);

const BikeSteadyMatch78=
  NativeParity77.window.eval(`
    matchTrainingPlanReviewExercise(
      trainingPlanReviewState.prepared.review[0],
      "bp:stationary-cycling"
    )
  `);

check(
  "v78 incompatible interval details can marry to compatible Stationary Cycling",
  BikeSteadyMatch78.ok
  && NativeParity77.window.eval(`
    (exercise=>
      trainingPlanReviewState.prepared.canConfirm
      && exercise.exerciseId==="bp:stationary-cycling"
      && exercise.trackingShape==="timeDist"
      && exercise.prescription.durationSeconds===1200
      && exercise.prescription.effort==="Easy"
    )(
      trainingPlanReviewState.prepared.candidate
        .days[0].exercises[0]
    )
  `)
);

NativeParity77.window.eval(`
  closeTrainingPlanReview({skipFocus:true});
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Bike interval count",
        days:[{
          id:"D1",
          title:"Athletic Conditioning",
          exercises:[{
            name:"Bike Intervals",
            prescription:{
              durationSeconds:20,
              effort:"Hard"
            }
          }]
        }]
      }
    }),
    "bike-interval-count.json"
  );
`);

NativeParityDocument77.querySelector(
  '[data-prescription-repair-field="intervals"]'
).value="8";

NativeParityDocument77.querySelector(
  '[data-prescription-repair-action="interval-count"]'
).click();

check(
  "v78 Bike Intervals count repair preserves its canonical identity and details",
  NativeParity77.window.eval(`
    (exercise=>
      trainingPlanReviewState.prepared.canConfirm
      && exercise.exerciseId==="bp:bike-intervals"
      && exercise.trackingShape==="rounds"
      && exercise.prescription.intervals===8
      && exercise.prescription.durationSeconds===20
      && exercise.prescription.effort==="Hard"
    )(
      trainingPlanReviewState.prepared.candidate
        .days[0].exercises[0]
    )
  `)
);

NativeParity77.window.eval(`
  closeTrainingPlanReview({skipFocus:true});
  openTrainingPlanReview(
    prepareTrainingPlanImport({
      format:"blackpyre-training-plan",
      version:1,
      program:{
        name:"Bike custom fallback",
        days:[{
          id:"D1",
          title:"Athletic Conditioning",
          exercises:[{
            name:"Bike Intervals",
            prescription:{
              durationSeconds:1200,
              effort:"Easy"
            }
          }]
        }]
      }
    }),
    "bike-custom.json"
  );

  window.__bikeSameNameCustom78=
    createPendingTrainingPlanExercise(
      trainingPlanReviewState.prepared.review[0],
      "Bike Intervals",
      "timeDist"
    );

  window.__bikeCustom78=
    createPendingTrainingPlanExercise(
      trainingPlanReviewState.prepared.review[0],
      "Easy Bike Session",
      "timeDist"
    );
`);

check(
  "v78 incompatible imports can create a distinct compatible custom exercise",
  NativeParity77.window.eval(`
    !window.__bikeSameNameCustom78.ok
    && /conflicts/.test(
      window.__bikeSameNameCustom78.reason
    )
    && window.__bikeCustom78.ok
    && trainingPlanReviewState.prepared.canConfirm
    && trainingPlanReviewState.prepared.review[0]
      .exerciseId.startsWith("pending:")
    && trainingPlanReviewState.prepared.candidate
      .days[0].exercises[0].prescription.durationSeconds===1200
  `)
);

NativeParity77.window.eval(
  `closeTrainingPlanReview({skipFocus:true})`
);

const NativeParityAISource77=
  fs.readFileSync(
    "scripts/05-ai.js",
    "utf8"
  );

check(
  "training-plan AI handoff remains copy/paste and routes imports through review",
  NativeParityAISource77.includes(
    "extractTrainingPlanDocumentFromText(text)"
  )
  && NativeParityAISource77.includes(
    '"AI paste"'
  )
  && NativeParityAISource77.includes(
    "openTrainingPlanReview("
  )
  && !NativeParityAISource77.includes(
    "replaceActiveProgram(payloads.program)"
  )
);

const NativeParityTrainSource77=
  fs.readFileSync(
    "scripts/03-train.js",
    "utf8"
  );

check(
  "v77 resolver is systemic and contains no five-example alias patch",
  [
    "Barbell Bench Press",
    "Seated Dumbbell Shoulder Press",
    "Cable Triceps Pressdown",
    "Weighted Pull-Up",
    "EZ Bar Curl"
  ].every(
    example=>
      !NativeParityTrainSource77
        .includes(example)
  )
  && NativeParityTrainSource77.includes(
    "trainingPlanQualifierVariants"
  )
  && NativeParityTrainSource77.includes(
    "trainingPlanGenericMovementMatches"
  )
);

const NativeParityIndex77=
  fs.readFileSync(
    "index.html",
    "utf8"
  );

const NativeParityRegularText77=
  NativeParityIndex77
    .replace(/\.big\s*\{[^}]*\}/s,"")
    .replace(/\.big small\s*\{[^}]*\}/s,"");

const NativeParityOversizeFonts77=[
  ...NativeParityRegularText77.matchAll(
    /font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px/gi
  )
].filter(
  match=>Number(match[1])>16
);

check(
  "v77 normal interface text remains capped at 16px",
  NativeParityOversizeFonts77.length===0
);

// Measurement-system presentation preserves canonical history.
const Metric=boot(
  Object.assign({},EXISTING_CFG,{unitSystem:"metric",calcInputs:{sex:"m",age:42,ft:5,inches:11,lb:220.462262,act:1.55,goal:-500}}),
  {food:{},workouts:[],weights:[{date:"2026-07-02",time:"08:00",lbs:220.462262}],measure:[],meta:{lastBackup:null,logsSince:0}}
);
const dMetric=Metric.window.document;
check("metric Settings and calculator fields render",dMetric.getElementById("unitMetricBtn").getAttribute("aria-pressed")==="true"&&dMetric.getElementById("cCm").value==="180.3"&&Number(dMetric.getElementById("cWt").value)===100);
check("metric weight history renders kilograms without rewriting storage",dMetric.getElementById("wtList").textContent.includes("100 kg")&&Metric.window.eval(`data.weights[0].lbs`)===220.462262);
dMetric.getElementById("wtVal").value="95";
dMetric.getElementById("addWtBtn").dispatchEvent(new Metric.window.Event("click",{bubbles:true}));
check("metric weigh-in saves canonical pounds",Math.abs(Metric.window.eval(`data.weights.find(w=>w.date===todayStr()).lbs`)-209.439149)<0.0001);
dMetric.getElementById("unitImperialBtn").dispatchEvent(new Metric.window.Event("click",{bubbles:true}));
check("switching units changes presentation without rewriting history",Metric.window.eval(`cfg.unitSystem`)==="imperial"&&dMetric.getElementById("wtList").textContent.includes("209.4 lb")&&Math.abs(Metric.window.eval(`data.weights.find(w=>w.date===todayStr()).lbs`)-209.439149)<0.0001);
Metric.window.close();

summary("INTEGRATION");
})().catch(e=>{ console.error(e); process.exit(1); });
