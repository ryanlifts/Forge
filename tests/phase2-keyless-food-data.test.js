// Phase 2 focused regression suite — keyless food data, source clarity, and resilient fallbacks.
const { boot, check, summary, wait, EXISTING_CFG, EMPTY_DATA } = require("./harness");
const fs = require("fs");
const path = require("path");

(async ()=>{
const root = path.join(__dirname,"..");
const shippedFiles = [
  "index.html","data-faq.js","scripts/01-storage.js","scripts/02-food.js",
  "scripts/05-ai.js","scripts/06-settings.js","scripts/07-boot.js"
];
const shippedSource = shippedFiles.map(file=>fs.readFileSync(path.join(root,file),"utf8")).join("\n");

check("no live USDA credential or request path ships",
  !/DEFAULT_USDA_KEY|effectiveUsdaKey|searchUSDA|mapUSDA|api\.nal\.usda\.gov|api_key=/i.test(shippedSource));
check("settings and onboarding no longer expose USDA-key controls",
  !/sUsdaKey|saveUsdaBtn|suUsda|api-key-signup/i.test(shippedSource));

const migrated = boot(Object.assign({},EXISTING_CFG,{usdaKey:"legacy-device-secret"}),EMPTY_DATA);
check("legacy saved USDA credentials are scrubbed during healthy boot",
  migrated.window.eval(`!Object.prototype.hasOwnProperty.call(cfg,"usdaKey")`) &&
  !Object.prototype.hasOwnProperty.call(JSON.parse(migrated.window.localStorage.getItem("forge:cfg")),"usdaKey"));
check("settings explain the keyless source and manual fallback",
  /No account or API key is needed/.test(migrated.window.document.getElementById("settingsServicesDetails").textContent) &&
  /Open Food Facts/.test(migrated.window.document.getElementById("settingsServicesDetails").textContent) &&
  /manual entry/.test(migrated.window.document.getElementById("settingsServicesDetails").textContent));

const product = {
  code:"070470343488",
  product_name:"Mixed Berry Yogurt",
  brands:"Yoplait",
  serving_size:"170g",
  serving_quantity:170,
  nutrition_data_per:"100g",
  nutriments:{
    "energy-kcal_100g":82.35,
    "proteins_100g":2.94,
    "carbohydrates_100g":16.47,
    "fat_100g":0.88
  }
};

let searchCalls=[];
const onlineSearch = boot(EXISTING_CFG,EMPTY_DATA,w=>{
  w.fetch=url=>{
    searchCalls.push(String(url));
    return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({hits:[product]})});
  };
});
onlineSearch.window.document.getElementById("foodQuery").value="Yoplait berry";
await onlineSearch.window.eval("runSearch()");
const searchResult = [...onlineSearch.window.document.querySelectorAll("#results .result")]
  .find(result=>/Source: Open Food Facts/.test(result.textContent));
check("keyless packaged-food search uses Open Food Facts only",
  searchCalls.length===1 && /search\.openfoodfacts\.org/.test(searchCalls[0]) && !/usda/i.test(searchCalls[0]));
check("online search results visibly name Open Food Facts",
  !!searchResult);
searchResult.click();
check("selected packaged food keeps its source visible",
  /Source: Open Food Facts/.test(onlineSearch.window.document.getElementById("selPer100").textContent));

const localSearch = boot(EXISTING_CFG,Object.assign({},EMPTY_DATA,{
  myFoods:{"123":{name:"Personal oatmeal",brand:"Home",cal100:100,pro100:4,carb100:18,fat100:2}}
}),w=>{
  w.fetch=()=>Promise.reject(new Error("Open Food Facts unavailable"));
});
localSearch.window.document.getElementById("foodQuery").value="oatmeal";
await localSearch.window.eval("runSearch()");
check("saved matches remain usable when Open Food Facts is unavailable",
  /Personal oatmeal/.test(localSearch.window.document.getElementById("results").textContent) &&
  /Source: My Foods/.test(localSearch.window.document.getElementById("results").textContent));
check("text-search outage is explained without hiding local results",
  /Open Food Facts is temporarily unavailable/.test(localSearch.window.document.getElementById("searchErr").textContent));

function barcodeBoot(responder){
  const calls=[];
  const dom=boot(EXISTING_CFG,EMPTY_DATA,w=>{
    w.fetch=url=>{ calls.push(String(url)); return responder(url,calls.length); };
  });
  return {dom,calls};
}
async function lookup(ctx,code){
  ctx.dom.window.document.getElementById("barcodeInput").value=code;
  await ctx.dom.window.eval("runBarcode()");
  await wait(20);
}

const foundBarcode = barcodeBoot(()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({product})}));
await lookup(foundBarcode,"070470343488");
check("barcode lookup stays on the stable Open Food Facts v2 endpoint",
  foundBarcode.calls.length===1 && /\/api\/v2\/product\//.test(foundBarcode.calls[0]));
check("barcode result visibly names Open Food Facts",
  /Source: Open Food Facts/.test(foundBarcode.dom.window.document.getElementById("selPer100").textContent));

const missingBarcode = barcodeBoot(()=>Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({})}));
await lookup(missingBarcode,"999999999999");
check("missing barcode opens manual label entry after one request",
  missingBarcode.calls.length===1 &&
  !missingBarcode.dom.window.document.getElementById("customCard").classList.contains("hidden") &&
  /not found in Open Food Facts/.test(missingBarcode.dom.window.document.getElementById("searchErr").textContent));

const failedBarcode = barcodeBoot(()=>Promise.reject(new Error("network down")));
await lookup(failedBarcode,"888888888888");
check("temporary barcode failure retries once then opens manual entry",
  failedBarcode.calls.length===2 &&
  !failedBarcode.dom.window.document.getElementById("customCard").classList.contains("hidden") &&
  /could not be reached/.test(failedBarcode.dom.window.document.getElementById("searchErr").textContent));

const rapidAddGuard = boot(EXISTING_CFG,EMPTY_DATA);
rapidAddGuard.window.eval(`
  data.food[todayStr()]=[];
  _lastAddSig="";
  _lastAddT=0;
  const item={
    name:"1 serving · Rapid tap test",
    cal:120,
    pro:10,
    carb:12,
    fat:4,
    meal:currentMeal
  };
  addEntry(Object.assign({},item));
  addEntry(Object.assign({},item));
`);
check("ordinary rapid repeated food adds are still blocked",
  rapidAddGuard.window.eval(`
    data.food[todayStr()].length===1
  `));

const explicitDuplicate = boot(EXISTING_CFG,EMPTY_DATA);
explicitDuplicate.window.eval(`
  data.food[todayStr()]=[];
  _lastAddSig="";
  _lastAddT=0;
  addEntry({
    name:"1 serving · Explicit duplicate test",
    cal:150,
    pro:12,
    carb:15,
    fat:5,
    meal:currentMeal
  });
`);
explicitDuplicate.window.document
  .querySelector("#foodList .dup")
  .click();
await wait(20);
check("the explicit duplicate control can immediately copy an entry",
  explicitDuplicate.window.eval(`
    data.food[todayStr()].length===2
    && data.food[todayStr()][0].name
      ===data.food[todayStr()][1].name
  `));

const identicalReviewedBatch = boot(EXISTING_CFG,EMPTY_DATA);
identicalReviewedBatch.window.eval(`
  data.food[todayStr()]=[];
  _lastAddSig="";
  _lastAddT=0;
  showFoodConfirm([
    {
      name:"Identical reviewed item",
      cal:90,
      pro:5,
      carb:10,
      fat:3
    },
    {
      name:"Identical reviewed item",
      cal:90,
      pro:5,
      carb:10,
      fat:3
    }
  ]);
`);
identicalReviewedBatch.window.document
  .querySelector("#aiFoodConfirm .ai-confirm-log")
  .click();
await wait(20);
check("one reviewed AI batch preserves intentional identical items",
  identicalReviewedBatch.window.eval(`
    data.food[todayStr()].length===2
    && data.food[todayStr()].every(
      entry=>entry.name==="Identical reviewed item"
    )
  `));

migrated.window.eval(`cfg.usdaKey="should-never-export"; window.__phase2Backup=null; download=(name,text)=>{window.__phase2Backup={name,text};}; doBackup("exportDataBtn");`);
const backupText=migrated.window.eval("window.__phase2Backup.text");
check("normal backups exclude a legacy USDA credential",
  !backupText.includes("should-never-export") &&
  !Object.prototype.hasOwnProperty.call(JSON.parse(backupText).cfg,"usdaKey"));

check("FAQ accurately explains keyless sources and label verification",
  migrated.window.eval(`FAQ.some(x=>x.q==="Do I need a USDA key for food search?"&&/does not ship a USDA API key/.test(x.a)&&/Open Food Facts/.test(x.a))`) &&
  migrated.window.eval(`FAQ.some(x=>x.q==="How accurate are suggested-food calories and macros?"&&/nutrition label is the best source/.test(x.a))`));
check("service worker cache is bumped for Phase 2",/blackpyre-v89/.test(fs.readFileSync(path.join(root,"sw.js"),"utf8")));

summary("PHASE 2 KEYLESS FOOD DATA");
})().catch(error=>{
  console.error(error);
  process.exit(1);
});
