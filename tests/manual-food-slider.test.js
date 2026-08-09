// BlackPyre manual serving, slider, saved-food, clear-state, and post-add regression suite.
const {
  boot,
  EXISTING_CFG,
  EMPTY_DATA
} = require("./harness");

const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition){
  if (condition){
    passed++;
  } else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name);
  }
}

function click(window, id){
  window.document
    .getElementById(id)
    .dispatchEvent(
      new window.Event(
        "click",
        {bubbles:true}
      )
    );
}

function input(window, id, value){
  const element =
    window.document.getElementById(id);

  element.value=value;

  element.dispatchEvent(
    new window.Event(
      "input",
      {bubbles:true}
    )
  );
}

const App = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const d = App.window.document;
const E = expression=>
  App.window.eval(expression);

const beforeManualFood = E(
  "JSON.stringify(data.food)"
);

d.getElementById("mName").value="Test cereal";
d.getElementById("mBrand").value="Test brand";
d.getElementById("mServingLabel").value="2/3 cup (55g)";
d.getElementById("mServingAmount").value="55";
d.getElementById("mServingUnit").value="g";
d.getElementById("mCal").value="230";
d.getElementById("mPro").value="3";
d.getElementById("mCarb").value="37";
d.getElementById("mFat").value="8";

click(App.window,"manualUseBtn");

check(
  "manual measured food opens amount slider at one serving",
  !d.getElementById("calcCard").classList.contains("hidden")
  && d.getElementById("qtyUnit").value==="serving"
  && Number(d.getElementById("qtyAmount").value)===1
);

check(
  "one manual serving matches entered nutrition",
  d.getElementById("calcCal").textContent==="230"
  && d.getElementById("calcPro").textContent==="3"
  && d.getElementById("calcCarb").textContent==="37"
  && d.getElementById("calcFat").textContent==="8"
);

input(App.window,"qtyAmount","0.5");

check(
  "half manual serving scales automatically",
  d.getElementById("calcCal").textContent==="115"
  && d.getElementById("calcPro").textContent==="1.5"
  && d.getElementById("calcCarb").textContent==="18.5"
  && d.getElementById("calcFat").textContent==="4"
);

input(App.window,"qtyAmount","1.5");

check(
  "one-and-a-half manual servings preserve decimal macros",
  d.getElementById("calcCal").textContent==="345"
  && d.getElementById("calcPro").textContent==="4.5"
  && d.getElementById("calcCarb").textContent==="55.5"
  && d.getElementById("calcFat").textContent==="12"
);

input(App.window,"qtyAmount","0.5");

check(
  "manual slider review still logs nothing before Add to log",
  E("JSON.stringify(data.food)")===beforeManualFood
);

App.window.eval(`
  window.__postAddScrolls=0;
  window.__postAddTarget=null;

  HTMLElement.prototype.scrollIntoView=function(opts){
    window.__postAddScrolls++;

    window.__postAddTarget={
      id:this.id || "",
      className:this.className || "",
      block:opts && opts.block
    };
  };
`);

click(
  App.window,
  "addSelBtn"
);

check(
  "Add to log preserves precise fractional macros",
  E("Object.values(data.food).flat().length")===1
  && E("Object.values(data.food).flat()[0].cal")===115
  && E("Object.values(data.food).flat()[0].pro")===1.5
  && E("Object.values(data.food).flat()[0].carb")===18.5
  && E("Object.values(data.food).flat()[0].fat")===4
);

check(
  "Add to log preserves the user's position and shows inline confirmation",
  E("window.__postAddScrolls")===0
  && !d
    .getElementById(
      "foodAddConfirmationPanel"
    )
    .classList
    .contains("hidden")
  && /ADDED TO TODAY/.test(
    d
      .getElementById(
        "foodAddConfirmationMessage"
      )
      .textContent
  )
);

click(
  App.window,
  "foodAddViewBtn"
);

check(
  "View entry scrolls only after the user asks",
  E("window.__postAddScrolls")===1
  && /list-item/.test(
    E(
      "window.__postAddTarget"
      +" && window.__postAddTarget.className"
    )
  )
);

click(
  App.window,
  "foodAddUndoBtn"
);

check(
  "inline Undo removes the exact food entry",
  E(
    "Object.values(data.food)"
    +".flat().length"
  )===0
  && d
    .getElementById(
      "foodAddConfirmationPanel"
    )
    .classList
    .contains("hidden")
);

const ManualServing = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const msd = ManualServing.window.document;

msd.getElementById("mName").value =
  "Homemade soup";

msd.getElementById("mServingLabel").value =
  "1 bowl";

msd.getElementById("mServingUnit").value =
  "serving";

msd.getElementById("mCal").value="300";
msd.getElementById("mPro").value="20";
msd.getElementById("mCarb").value="30";
msd.getElementById("mFat").value="10";

click(
  ManualServing.window,
  "manualUseBtn"
);

check(
  "manual serving-only food opens normal slider",
  msd.getElementById("qtyUnit").value==="serving"
  && Number(msd.getElementById("qtyAmount").value)===1
);

check(
  "serving-only food exposes no fake weight or liquid units",
  [...msd.getElementById("qtyUnit").options]
    .map(option=>option.value)
    .join(",")==="serving"
);

input(
  ManualServing.window,
  "qtyAmount",
  "2"
);

check(
  "manual serving-only food scales to two servings",
  msd.getElementById("calcCal").textContent==="600"
  && msd.getElementById("calcPro").textContent==="40"
  && msd.getElementById("calcCarb").textContent==="60"
  && msd.getElementById("calcFat").textContent==="20"
);

check(
  "manual food logs nothing before Add to log",
  ManualServing.window.eval(
    "Object.values(data.food).flat().length"
  )===0
);

const ManualSolid = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const msolid = ManualSolid.window.document;

msolid.getElementById("mName").value =
  "Protein bar";

msolid.getElementById("mServingLabel").value =
  "1 bar (55 g)";

msolid.getElementById("mServingAmount").value="55";
msolid.getElementById("mServingUnit").value="g";
msolid.getElementById("mCal").value="220";
msolid.getElementById("mPro").value="20";
msolid.getElementById("mCarb").value="25";
msolid.getElementById("mFat").value="8";

click(
  ManualSolid.window,
  "manualUseBtn"
);

check(
  "manual solid food exposes serving and weight units",
  [...msolid.getElementById("qtyUnit").options]
    .map(option=>option.value)
    .join(",")==="serving,g,oz,lb"
);

msolid.getElementById("qtyUnit").value="g";

msolid.getElementById("qtyUnit").dispatchEvent(
  new ManualSolid.window.Event(
    "change",
    {bubbles:true}
  )
);

input(
  ManualSolid.window,
  "qtyAmount",
  "27.5"
);

check(
  "manual gram amount scales from serving nutrition",
  msolid.getElementById("calcCal").textContent==="110"
  && msolid.getElementById("calcPro").textContent==="10"
);

const ManualDrink = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const mdrink = ManualDrink.window.document;

mdrink.getElementById("mName").value =
  "Sports drink";

mdrink.getElementById("mServingLabel").value =
  "1 bottle (355 mL)";

mdrink.getElementById("mServingAmount").value="355";
mdrink.getElementById("mServingUnit").value="ml";
mdrink.getElementById("mCal").value="180";
mdrink.getElementById("mPro").value="0";
mdrink.getElementById("mCarb").value="45";
mdrink.getElementById("mFat").value="0";

click(
  ManualDrink.window,
  "manualUseBtn"
);

check(
  "manual drink exposes serving and liquid units",
  [...mdrink.getElementById("qtyUnit").options]
    .map(option=>option.value)
    .join(",")==="serving,ml,floz"
);

mdrink.getElementById("qtyUnit").value="ml";

mdrink.getElementById("qtyUnit").dispatchEvent(
  new ManualDrink.window.Event(
    "change",
    {bubbles:true}
  )
);

input(
  ManualDrink.window,
  "qtyAmount",
  "177.5"
);

check(
  "manual liquid amount scales automatically",
  mdrink.getElementById("calcCal").textContent==="90"
  && mdrink.getElementById("calcCarb").textContent==="22.5"
);

const Saved = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const savedDoc = Saved.window.document;

savedDoc.getElementById("mName").value =
  "Saved muffin";

savedDoc.getElementById("mServingLabel").value =
  "1 muffin";

savedDoc.getElementById("mServingUnit").value =
  "serving";

savedDoc.getElementById("mCal").value="250";
savedDoc.getElementById("mPro").value="5";
savedDoc.getElementById("mCarb").value="40";
savedDoc.getElementById("mFat").value="8";

click(
  Saved.window,
  "manualSaveChooseBtn"
);

check(
  "Save and choose amount creates reusable My Food",
  Saved.window.eval(
    "Object.values(data.myFoods).some(food=>"
    +"food.name==='Saved muffin'"
    +"&& food.nutritionBasis==='serving'"
    +"&& food.servingLabel==='1 muffin'"
    +"&& food.calServing===250)"
  )===true
);

check(
  "saved manual food opens slider at one serving",
  savedDoc.getElementById("qtyUnit").value==="serving"
  && savedDoc.getElementById("calcCal").textContent==="250"
);

check(
  "saving reusable food still does not log it",
  Saved.window.eval(
    "Object.values(data.food).flat().length"
  )===0
);

check(
  "legacy direct-manual control is hidden from normal entry",
  savedDoc
    .getElementById("addManualBtn")
    .classList
    .contains("hidden")
);

const ExistingHistory = boot(
  EXISTING_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      food:{
        "2026-08-02":[
          {
            name:"Legacy manual item",
            cal:300,
            pro:20,
            carb:30,
            fat:10,
            meal:"lunch"
          }
        ]
      }
    }
  )
);

ExistingHistory.window.eval(
  'foodDateEl.value="2026-08-02"; startEditEntry(0);'
);

check(
  "older direct manual history remains editable",
  !ExistingHistory.window.document
    .getElementById("addManualBtn")
    .classList
    .contains("hidden")
  && ExistingHistory.window.document
    .getElementById("mCal")
    .value==="300"
);

const MyFoods = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const mfd = MyFoods.window.document;

mfd.getElementById("mfName").value =
  "Reusable drink";

mfd.getElementById("mfServingLabel").value =
  "1 can (355 mL)";

mfd.getElementById("mfServG").value="355";
mfd.getElementById("mfServingUnit").value="ml";
mfd.getElementById("mfCal").value="140";
mfd.getElementById("mfPro").value="0";
mfd.getElementById("mfCarb").value="35";
mfd.getElementById("mfFat").value="0";

click(
  MyFoods.window,
  "mfSaveBtn"
);

check(
  "My Foods manual creator uses the same serving model",
  MyFoods.window.eval(
    "Object.values(data.myFoods).some(food=>"
    +"food.name==='Reusable drink'"
    +"&& food.servingUnit==='ml'"
    +"&& food.servingAmount===355"
    +"&& food.calServing===140)"
  )===true
);

const ClearState = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const clearWindow =
  ClearState.window;

const clearDocument =
  clearWindow.document;

const clearSearch =
  clearWindow.eval(
    "foodSearchInputElement()"
  );

const clearBarcode =
  clearWindow.eval(
    "barcodeInputElement()"
  );

check(
  "food logging installs search barcode manual and clear-all controls",
  !!clearDocument.getElementById("foodSearchClearBtn")
  && !!clearDocument.getElementById("barcodeClearBtn")
  && !!clearDocument.getElementById("manualFoodClearBtn")
  && !!clearDocument.getElementById("clearAllFoodEntryBtn")
);

if (clearSearch){
  clearSearch.value="chicken";
}

if (clearBarcode){
  clearBarcode.value="012345678901";
}

clearDocument.getElementById("mName").value =
  "Old manual food";

clearDocument.getElementById("mCal").value =
  "400";

clearDocument
  .getElementById("clearAllFoodEntryBtn")
  .click();

check(
  "clear all removes search barcode and manual state",
  (!clearSearch || clearSearch.value==="")
  && (!clearBarcode || clearBarcode.value==="")
  && clearDocument.getElementById("mName").value===""
  && clearDocument.getElementById("mCal").value===""
);

if (clearBarcode){
  clearBarcode.value="999999999999";

  clearBarcode.dispatchEvent(
    new clearWindow.Event(
      "input",
      {bubbles:true}
    )
  );
}

if (clearSearch){
  clearSearch.value="apple";

  clearSearch.dispatchEvent(
    new clearWindow.Event(
      "input",
      {bubbles:true}
    )
  );
}

check(
  "starting food search clears stale barcode state",
  !clearBarcode
  || clearBarcode.value===""
);

const BrandFirstFood = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const brandDocument =
  BrandFirstFood.window.document;

brandDocument.getElementById("mName").value =
  "Soda";

brandDocument.getElementById("mBrand").value =
  "Starry Zero Sugar";

brandDocument.getElementById("mServingLabel").value =
  "1 bottle";

brandDocument.getElementById("mServingUnit").value =
  "serving";

brandDocument.getElementById("mCal").value =
  "10";

brandDocument.getElementById("mPro").value =
  "0";

brandDocument.getElementById("mCarb").value =
  "0";

brandDocument.getElementById("mFat").value =
  "0";

click(
  BrandFirstFood.window,
  "manualSaveChooseBtn"
);

check(
  "brand-first saved food combines brand and product",
  BrandFirstFood.window.eval(
    "Object.values(data.myFoods).some(food=>"
    +"food.name==='Starry Zero Sugar — Soda'"
    +"&& food.brandName==='Starry Zero Sugar'"
    +"&& food.productName==='Soda')"
  )===true
);

check(
  "brand-first saved food appears correctly in amount slider",
  brandDocument
    .getElementById("selName")
    .textContent
    .includes("Starry Zero Sugar — Soda")
);

const MigratedBrandFood = boot(
  EXISTING_CFG,
  Object.assign(
    {},
    EMPTY_DATA,
    {
      myFoods:{
        old_starry:{
          name:"Soda",
          brand:"Starry Zero Sugar",
          cal100:10,
          pro100:0,
          carb100:0,
          fat100:0,
          servingG:100,
          servingLabel:"1 bottle"
        }
      }
    }
  )
);

check(
  "existing saved food migrates to brand-first display",
  MigratedBrandFood.window.eval(
    "data.myFoods.old_starry.name"
  )==="Starry Zero Sugar — Soda"
);

const root = path.join(
  __dirname,
  ".."
);

const index = fs.readFileSync(
  path.join(root,"index.html"),
  "utf8"
);

check(
  "shipped UI contains unified manual serving controls",
  /id="manualUseBtn"/.test(index)
  && /id="manualSaveChooseBtn"/.test(index)
  && /id="mServingUnit"/.test(index)
  && /id="mfServingUnit"/.test(index)
);

const faq = fs.readFileSync(
  path.join(root,"data-faq.js"),
  "utf8"
);

// BLACKPYRE CURRENT FAQ CONTRACT

check(
  "current consolidated native FAQ is valid",
  (faq.match(/\{q:"/g) || []).length === 26

  && /How do I set my calorie and macro targets\?/.test(faq)
  && /Can teenagers use the calorie and macro calculator\?/.test(faq)

  && /How do I scan food\?/.test(faq)
  && /Scan barcode/.test(faq)
  && /What if scanned nutrition is wrong or missing\?/.test(faq)
  && /correction form/.test(faq)
  && /Nothing is logged until you review it/.test(faq)

  && /How do I change, undo, or view a food entry\?/.test(faq)
  && /slider or amount field/.test(faq)
  && /Undo/.test(faq)
  && /View entry/.test(faq)

  && /How do I log a workout\?/.test(faq)
  && /Save Exercise/.test(faq)
  && /Log session/.test(faq)

  && /How do I create or load a training program\?/.test(faq)
  && /What happens when I load a training program\?/.test(faq)
  && /not replaced until you confirm/.test(faq)
  && /completed workout history is kept/.test(faq)

  && /Where is my data stored\? Is it private\?/.test(faq)
  && /How do I back up or move BlackPyre to another device\?/.test(faq)
  && /Protected mode/.test(faq)
  && /What works without an internet connection\?/.test(faq)

  && /Disclaimer & terms of use/.test(faq)

  && !/(Open Food Facts|USDA|Apple|iPhone|iPad|Android|Safari|Chrome|Google|ChatGPT|OpenAI|Claude|Anthropic|Starry|Chipotle)/i.test(faq)
);

const sw = fs.readFileSync(
  path.join(root,"sw.js"),
  "utf8"
);

check(
  "manual food-slider candidate uses the current cache",
  sw.includes(
    'const CACHE = "blackpyre-v103"'
  )
);

console.log(
  "\nMANUAL FOOD SLIDER: "
  +passed+" passed, "
  +failed+" failed"
);

if (failed){
  console.error(
    "failures: "+failures.join(" | ")
  );

  process.exit(1);
}
