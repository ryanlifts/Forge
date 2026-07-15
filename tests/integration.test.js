// BlackPyre permanent integration suite — boots the shipped app and exercises whole flows.
const { boot, bootRaw, assembleHTML, sacredCalls, check, summary, dstr, wait, EXISTING_CFG, EMPTY_DATA } = require("./harness");
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

// ================= ChatGPT handoff paste flow =================
const H = boot(Object.assign({}, EXISTING_CFG, {aiProvider:"handoff"}), EMPTY_DATA);
const dH = H.window.document;
const clickH = id=>dH.getElementById(id).dispatchEvent(new H.window.Event("click",{bubbles:true}));
H.window.eval(`currentMeal="dinner"; renderMealSeg();`);
clickH("hfPasteBtn"); await wait(30);
check("paste box always visible (iOS clipboard-proof)", !dH.getElementById("hfPasteBox").classList.contains("hidden"));
dH.getElementById("hfPasteText").value = 'Here! {\u201Cfoods\u201D:[{\u201Cname\u201D:\u201CRice\u201D,\u201Ccal\u201D:260,\u201Cpro\u201D:5,\u201Ccarb\u201D:57,\u201Cfat\u201D:1}]}';
clickH("hfReviewBtn"); await wait(20);
check("curly-quote paste reaches review card", dH.querySelectorAll("#aiFoodConfirm .list-item").length===1);
check("nothing logged before confirm", H.window.eval("(data.food[todayStr()]||[]).length")===0);

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
