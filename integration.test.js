// BlackPyre permanent integration suite — boots the shipped app and exercises whole flows.
const { boot, check, summary, dstr, wait, EXISTING_CFG, EMPTY_DATA } = require("./harness");
const fs = require("fs");
const path = require("path");
const { assembleHTML } = require("./harness");

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

// Phase 2 migration identity: strip the strict directives ADDED to slices 02-07 (01's is
// original), concatenate in order, and the result must hash to the v42 inline JS exactly.
// This hash freezes the migration. The first APPROVED post-v43 change to any slice must
// retire this check in the same commit, with the plan/report saying so — never silently.
const crypto = require("crypto");
const V42_SHA256 = "63ea5e9bd80a069bdfaeb59c954bdcf521a8593da3cf200569d6719e47d53bba";
const STRICT = '"use strict";\n';
const normalized = SLICES.map((f,i)=>{
  const t = fs.readFileSync(path.join(__dirname, "..", "scripts", f), "utf8");
  return i===0 ? t : t.slice(STRICT.length);
}).join("");
check("Phase 2 migration identity: normalized slice concatenation === v42 original (sha256)",
  crypto.createHash("sha256").update(normalized, "utf8").digest("hex") === V42_SHA256);

summary("INTEGRATION");
})().catch(e=>{ console.error(e); process.exit(1); });
