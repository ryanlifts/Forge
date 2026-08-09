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
check("web app ships no direct AI endpoint, credential field, provider link, or live-chat control",
  !/api\.openai\.com|api\.anthropic\.com|sOpenaiKey|sAnthropicKey|sAiProvider|sAiModel|saveAiBtn|platform\.openai\.com|console\.anthropic\.com|coachOverlay|coachOpenBtn/.test(shippedSource));

const migrated = boot(Object.assign({},EXISTING_CFG,{usdaKey:"legacy-device-secret"}),EMPTY_DATA);
check("legacy saved USDA credentials are scrubbed during healthy boot",
  migrated.window.eval(`!Object.prototype.hasOwnProperty.call(cfg,"usdaKey")`) &&
  !Object.prototype.hasOwnProperty.call(JSON.parse(migrated.window.localStorage.getItem("forge:cfg")),"usdaKey"));
const retiredAI = boot(Object.assign({},EXISTING_CFG,{
  aiProvider:"anthropic",anthropicKey:"legacy-a",openaiKey:"legacy-o",aiModelAnth:"legacy-model"
}),EMPTY_DATA);
const retiredStoredCfg = JSON.parse(retiredAI.window.localStorage.getItem("forge:cfg"));
check("legacy direct-AI credentials and provider settings are scrubbed from runtime and storage",
  ["aiProvider","anthropicKey","openaiKey","aiModelAnth"].every(key=>
    !Object.prototype.hasOwnProperty.call(retiredAI.window.eval("cfg"),key)
    && !Object.prototype.hasOwnProperty.call(retiredStoredCfg,key)));
check("copy/paste food handoff remains available after direct AI removal",
  !retiredAI.window.document.getElementById("aiFoodCard").classList.contains("hidden")
  && !retiredAI.window.document.getElementById("aiHandoffControls").classList.contains("hidden"));
check("settings explain the food source and manual fallback without obsolete setup language",
  !/No account or API key is needed/.test(migrated.window.document.getElementById("settingsServicesDetails").textContent) &&
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


const readyBarcodeCorrectionProductV84 = {
  code:"0847644005066",
  product_name:"CLEAN",
  brands:"READY",
  serving_size:"1 bar (52 g)",
  serving_quantity:52,
  nutrition_data_per:"100g",
  nutriments:{
    "energy-kcal_100g":200,
    "energy-kcal_serving":104,
    "proteins_100g":15,
    "carbohydrates_100g":23,
    "fat_100g":7,
    proteins:15,
    carbohydrates:23,
    fat:7
  }
};

const readyBarcodeCorrectionV84 =
  barcodeBoot(
    ()=>Promise.resolve({
      ok:true,
      status:200,
      json:()=>Promise.resolve({
        status:1,
        product:
          readyBarcodeCorrectionProductV84
      })
    })
  );

const readyBarcodeConfirmationV91 =
  barcodeBoot(
    ()=>Promise.resolve({
      ok:true,
      status:200,
      json:()=>Promise.resolve({
        status:1,
        product:
          readyBarcodeCorrectionProductV84
      })
    })
  );

await lookup(
  readyBarcodeConfirmationV91,
  "0847644005066"
);

const readyConfirmationDocumentV91 =
  readyBarcodeConfirmationV91
    .dom
    .window
    .document;

const readyConfirmationButtonV91 =
  readyConfirmationDocumentV91
    .getElementById("barcodeConfirmBtn");

check(
  "barcode verification actions have separate highlighted treatments",
  readyConfirmationButtonV91
    .classList
    .contains("barcode-confirm-action")
  && readyConfirmationDocumentV91
    .getElementById("barcodeCorrectionBtn")
    .classList
    .contains("barcode-correct-action")
);

readyConfirmationButtonV91.click();

check(
  "Looks correct saves the barcode, closes verification, and keeps logging controls",
  readyBarcodeConfirmationV91
    .dom
    .window
    .eval(
      `!!data.myFoods["847644005066"]
      && data.myFoods["847644005066"].sourceLabel==="My Foods"
      && selected.sourceLabel==="My Foods"`
    )
  && readyConfirmationDocumentV91
    .getElementById("barcodeCorrectionReview")
    .classList
    .contains("hidden")
  && !readyConfirmationDocumentV91
    .getElementById("calcCard")
    .classList
    .contains("hidden")
  && !readyConfirmationDocumentV91
    .getElementById("qtySlider")
    .classList
    .contains("hidden")
  && !readyConfirmationDocumentV91
    .getElementById("addSelBtn")
    .classList
    .contains("hidden")
);

const zeroNutritionBarcodeV91 =
  barcodeBoot(
    ()=>Promise.resolve({
      ok:true,
      status:200,
      json:()=>Promise.resolve({
        status:1,
        product:{
          code:"000000000091",
          product_name:"Zero nutrition test",
          brands:"Test",
          serving_size:"1 serving (100 g)",
          serving_quantity:100,
          nutrition_data_per:"100g",
          nutriments:{
            "energy-kcal_100g":0,
            "proteins_100g":0,
            "carbohydrates_100g":0,
            "fat_100g":0
          }
        }
      })
    })
  );

await lookup(
  zeroNutritionBarcodeV91,
  "000000000091"
);

zeroNutritionBarcodeV91
  .dom
  .window
  .document
  .getElementById("barcodeConfirmBtn")
  .click();

check(
  "Looks correct accepts zero calories and macros and closes verification",
  zeroNutritionBarcodeV91
    .dom
    .window
    .eval(
      `!!data.myFoods["000000000091"]
      && data.myFoods["000000000091"].cal100===0
      && data.myFoods["000000000091"].pro100===0
      && data.myFoods["000000000091"].carb100===0
      && data.myFoods["000000000091"].fat100===0`
    )
  && zeroNutritionBarcodeV91
    .dom
    .window
    .document
    .getElementById("barcodeCorrectionReview")
    .classList
    .contains("hidden")
);

await lookup(
  readyBarcodeCorrectionV84,
  "0847644005066"
);

const readyCorrectionDocumentV84 =
  readyBarcodeCorrectionV84
    .dom
    .window
    .document;

const readyCorrectionPanelV84 =
  readyCorrectionDocumentV84
    .getElementById(
      "barcodeCorrectionReview"
    );

check(
  "leading-zero EAN and UPC use one canonical barcode identity",
  readyBarcodeCorrectionV84.calls.length===1
  && /\/847644005066\.json/.test(
    readyBarcodeCorrectionV84.calls[0]
  )
  && readyBarcodeCorrectionV84
    .dom
    .window
    .eval(
      `normalizeBarcodeIdentity(
        selected
        && selected.barcode
      )`
    )==="847644005066"
);

check(
  "fresh Open Food Facts result prominently requires package verification",
  !!readyCorrectionPanelV84
  && !readyCorrectionPanelV84
    .classList
    .contains("hidden")
  && /Verify barcode nutrition/.test(
    readyCorrectionDocumentV84
      .getElementById(
        "barcodeCorrectionTitle"
      )
      .textContent
  )
  && readyCorrectionPanelV84
    .style
    .cssText
    .includes("var(--amber)")
  && readyCorrectionPanelV84
    .nextSibling===
      readyCorrectionDocumentV84
        .getElementById("calcLine")
  && readyCorrectionDocumentV84
    .getElementById(
      "barcodeCorrectionBtn"
    )
    .textContent==="Correct barcode data"
);

check(
  "inconsistent OFF fixture remains reviewable instead of inventing package values",
  Number(
    readyCorrectionDocumentV84
      .getElementById("calcCal")
      .textContent
  )===104
);

check(
  "fresh OFF warning explains that the slider total is database-calculated and may be wrong",
  /serving total below is calculated from database values and may be wrong/.test(
    readyCorrectionDocumentV84
      .getElementById("barcodeCorrectionMessage")
      .textContent
  )
);

readyCorrectionDocumentV84
  .getElementById(
    "barcodeCorrectionBtn"
  )
  .click();

check(
  "barcode correction keeps serving identity but leaves unverified nutrition blank",
  readyCorrectionDocumentV84
    .getElementById("cfBarcode")
    .value==="847644005066"
  && readyCorrectionDocumentV84
    .getElementById("cfServG")
    .value==="52"
  && readyCorrectionDocumentV84
    .getElementById("cfServingLabel")
    .value==="1 bar (52 g)"
  && readyCorrectionDocumentV84
    .getElementById("cfCal")
    .value===""
  && readyCorrectionDocumentV84
    .getElementById("cfPro")
    .value===""
  && readyCorrectionDocumentV84
    .getElementById("cfCarb")
    .value===""
  && readyCorrectionDocumentV84
    .getElementById("cfFat")
    .value===""
  && /currently calculates 1 bar \(52 g\) as 104 kcal/.test(
    readyCorrectionDocumentV84
      .getElementById("customNote")
      .textContent
  )
  && /not confirmed package values/.test(
    readyCorrectionDocumentV84
      .getElementById("customNote")
      .textContent
  )
);

readyCorrectionDocumentV84
  .getElementById("cfCal")
  .value="200";

readyCorrectionDocumentV84
  .getElementById("cfPro")
  .value="15";

readyCorrectionDocumentV84
  .getElementById("cfCarb")
  .value="23";

readyCorrectionDocumentV84
  .getElementById("cfFat")
  .value="7";

readyCorrectionDocumentV84
  .getElementById("cfSaveBtn")
  .click();

check(
  "package correction saves under canonical UPC with exact serving nutrition",
  readyBarcodeCorrectionV84
    .dom
    .window
    .eval(
      `(()=>{
        const saved=
          data.myFoods[
            "847644005066"
          ];

        if (!saved){
          return false;
        }

        const serving=
          servingValuesFromFood(saved);

        return saved.servingG===52
          && Math.abs(serving.cal-200)<0.01
          && Math.abs(serving.pro-15)<0.01
          && Math.abs(serving.carb-23)<0.01
          && Math.abs(serving.fat-7)<0.01;
      })()`
    )===true
);

readyBarcodeCorrectionV84.calls.length=0;

await lookup(
  readyBarcodeCorrectionV84,
  "0847644005066"
);

check(
  "later UPC or EAN scan uses saved correction without network or OFF warning",
  readyBarcodeCorrectionV84.calls.length===0
  && readyCorrectionPanelV84
    .classList
    .contains("hidden")
  && readyBarcodeCorrectionV84
    .dom
    .window
    .eval(
      `(()=>{
        const serving=
          servingValuesFromFood(selected);

        return selected.sourceLabel==="My Foods"
          && Math.abs(serving.cal-200)<0.01
          && Math.abs(serving.pro-15)<0.01
          && Math.abs(serving.carb-23)<0.01
          && Math.abs(serving.fat-7)<0.01;
      })()`
    )===true
);

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

check("service worker cache is bumped for the current release",/blackpyre-v101/.test(fs.readFileSync(path.join(root,"sw.js"),"utf8")));


const ServingReviewCorrection = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const servingReviewCorrectionDoc =
  ServingReviewCorrection.window.document;

servingReviewCorrectionDoc.getElementById("cfName").value=
  "CLEAN";
servingReviewCorrectionDoc.getElementById("cfBrand").value=
  "READY";
servingReviewCorrectionDoc.getElementById("cfBarcode").value=
  "847644005066";
servingReviewCorrectionDoc.getElementById("cfServingLabel").value=
  "1 bar (52 g)";
servingReviewCorrectionDoc.getElementById("cfServG").value=
  "52";
servingReviewCorrectionDoc.getElementById("cfCal").value=
  "200";
servingReviewCorrectionDoc.getElementById("cfPro").value=
  "15";
servingReviewCorrectionDoc.getElementById("cfCarb").value=
  "23";
servingReviewCorrectionDoc.getElementById("cfFat").value=
  "7";

servingReviewCorrectionDoc.getElementById("cfSaveBtn")
  .dispatchEvent(
    new ServingReviewCorrection.window.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "barcode correction stores package nutrition as an explicit serving basis",
  ServingReviewCorrection.window.eval(`
    data.myFoods["847644005066"]
    && data.myFoods["847644005066"].nutritionBasis==="serving"
    && data.myFoods["847644005066"].calServing===200
    && data.myFoods["847644005066"].proServing===15
    && data.myFoods["847644005066"].carbServing===23
    && data.myFoods["847644005066"].fatServing===7
  `)
);

check(
  "serving-based selected review shows package values instead of normalized 100g values",
  servingReviewCorrectionDoc.getElementById("selEditCal100").value==="200"
  && servingReviewCorrectionDoc.getElementById("selEditPro100").value==="15"
  && servingReviewCorrectionDoc.getElementById("selEditCarb100").value==="23"
  && servingReviewCorrectionDoc.getElementById("selEditFat100").value==="7"
  && /Calories \/ serving/.test(
    servingReviewCorrectionDoc
      .getElementById("selEditCal100")
      .previousElementSibling
      .textContent
  )
  && servingReviewCorrectionDoc.getElementById("calcCal").textContent==="200"
);

const LegacyBarcodeServing = boot(
  EXISTING_CFG,
  Object.assign({},EMPTY_DATA,{
    myFoods:{
      "847644005066":{
        name:"CLEAN",
        brand:"READY",
        cal100:200/52*100,
        pro100:15/52*100,
        carb100:23/52*100,
        fat100:7/52*100,
        servingG:52,
        servingLabel:"1 bar (52 g)",
        barcode:"847644005066",
        sourceLabel:"My Foods"
      }
    }
  })
);

check(
  "legacy saved barcode nutrition upgrades to serving basis without changing package values",
  LegacyBarcodeServing.window.eval(`
    data.myFoods["847644005066"].nutritionBasis==="serving"
    && Math.round(data.myFoods["847644005066"].calServing)===200
    && Math.round(data.myFoods["847644005066"].proServing)===15
    && Math.round(data.myFoods["847644005066"].carbServing)===23
    && Math.round(data.myFoods["847644005066"].fatServing)===7
  `)
);

LegacyBarcodeServing.window.eval(`
  selectFood(data.myFoods["847644005066"]);
`);

check(
  "upgraded saved barcode displays the original package serving nutrition",
  LegacyBarcodeServing.window.document
    .getElementById("selEditCal100").value==="200"
  && LegacyBarcodeServing.window.document
    .getElementById("selEditPro100").value==="15"
  && LegacyBarcodeServing.window.document
    .getElementById("selEditCarb100").value==="23"
  && LegacyBarcodeServing.window.document
    .getElementById("selEditFat100").value==="7"
  && LegacyBarcodeServing.window.document
    .getElementById("calcCal").textContent==="200"
);

servingReviewCorrectionDoc.getElementById("selEditCal100").value=
  "210";

servingReviewCorrectionDoc.getElementById("selEditCal100")
  .dispatchEvent(
    new ServingReviewCorrection.window.Event(
      "input",
      {bubbles:true}
    )
  );

check(
  "editing calories per serving updates the serving total while normalized math stays internal",
  servingReviewCorrectionDoc.getElementById("calcCal").textContent==="210"
  && Math.abs(
    ServingReviewCorrection.window.eval(
      "reviewedSelectedFood(false).cal100"
    )
    -(210/52*100)
  )<0.001
);


const NativeParityFreshBarcode = barcodeBoot(
  ()=>Promise.resolve({
    ok:true,
    status:200,
    json:()=>Promise.resolve({
      product:{
        code:"0847644005066",
        product_name:"CLEAN",
        brands:"READY",
        serving_size:"1 bar (52 g)",
        serving_quantity:52,
        nutrition_data_per:"100g",
        nutriments:{
          "energy-kcal_100g":200,
          "energy-kcal_serving":104,
          "proteins_100g":15,
          "carbohydrates_100g":23,
          "fat_100g":7
        }
      }
    })
  })
);

await lookup(
  NativeParityFreshBarcode,
  "847644005066"
);

const nativeFreshDoc=
  NativeParityFreshBarcode.dom.window.document;

check(
  "fresh OFF barcode defaults to one package serving like native",
  nativeFreshDoc.getElementById("qtyAmount").value==="1"
  && nativeFreshDoc.getElementById("qtyUnit").value==="serving"
  && /1 bar \(52 g\)/.test(
    nativeFreshDoc
      .getElementById("qtyUnit")
      .selectedOptions[0]
      .textContent
  )
);

check(
  "fresh OFF barcode hides prominent editable database nutrition like native",
  nativeFreshDoc
    .getElementById("selEditName")
    .classList.contains("hidden")
  && nativeFreshDoc
    .getElementById("selEditCal100")
    .closest(".row")
    .classList.contains("hidden")
  && nativeFreshDoc
    .getElementById("selEditCarb100")
    .closest(".row")
    .classList.contains("hidden")
);

check(
  "fresh OFF barcode keeps database reference small and calculated serving visible",
  /per 100g: 200 kcal/.test(
    nativeFreshDoc.getElementById("selPer100").textContent
  )
  && nativeFreshDoc.getElementById("calcCal").textContent==="104"
  && nativeFreshDoc.getElementById("calcPro").textContent==="8"
  && nativeFreshDoc.getElementById("calcCarb").textContent==="12"
  && nativeFreshDoc.getElementById("calcFat").textContent==="4"
);

let nativeLocalNetworkCalls=0;

const NativeParityLocalBarcode = boot(
  EXISTING_CFG,
  Object.assign({},EMPTY_DATA,{
    myFoods:{
      "old-noncanonical-key":{
        name:"CLEAN",
        brand:"READY",
        cal100:200/52*100,
        pro100:15/52*100,
        carb100:23/52*100,
        fat100:7/52*100,
        servingG:52,
        servingLabel:"1 bar (52 g)",
        nutritionBasis:"serving",
        calServing:200,
        proServing:15,
        carbServing:23,
        fatServing:7,
        servingAmount:52,
        servingUnit:"g",
        measureKind:"solid",
        servingOnly:false,
        barcode:"0847644005066",
        sourceLabel:"My Foods"
      }
    }
  }),
  window=>{
    window.fetch=()=>{
      nativeLocalNetworkCalls++;
      return Promise.reject(
        new Error("network should not be called")
      );
    };
  }
);

NativeParityLocalBarcode.window.document
  .getElementById("barcodeInput").value=
  "847644005066";

await NativeParityLocalBarcode.window.eval(
  "runBarcode()"
);

await wait(20);

const nativeLocalDoc=
  NativeParityLocalBarcode.window.document;

check(
  "saved barcode object identity resolves locally before network",
  nativeLocalNetworkCalls===0
  && NativeParityLocalBarcode.window.eval(
    "selected && selected.sourceLabel"
  )==="My Foods"
);

check(
  "corrected local barcode returns one serving with corrected package nutrition",
  nativeLocalDoc.getElementById("qtyAmount").value==="1"
  && nativeLocalDoc.getElementById("qtyUnit").value==="serving"
  && nativeLocalDoc.getElementById("calcCal").textContent==="200"
  && nativeLocalDoc.getElementById("calcPro").textContent==="15"
  && nativeLocalDoc.getElementById("calcCarb").textContent==="23"
  && nativeLocalDoc.getElementById("calcFat").textContent==="7"
);

check(
  "corrected local barcode also uses compact native-like review",
  nativeLocalDoc
    .getElementById("selEditName")
    .classList.contains("hidden")
  && nativeLocalDoc
    .getElementById("selEditCal100")
    .closest(".row")
    .classList.contains("hidden")
);

summary("PHASE 2 KEYLESS FOOD DATA");
})().catch(error=>{
  console.error(error);
  process.exit(1);
});
