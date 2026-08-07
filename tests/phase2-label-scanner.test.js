// BlackPyre Phase 2.1 unified manual / label food-slider regression suite.
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

const labelLines = [
  "Nutrition Facts",
  "8 servings per container",
  "Serving size 2/3 cup (55g)",
  "Amount per serving",
  "Calories 230",
  "Total Fat 8g 10%",
  "Saturated Fat 1g 5%",
  "Total Carbohydrate 37g 13%",
  "Protein 3g"
];

const App = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const d = App.window.document;
const E = expression=>
  App.window.eval(expression);

const parsed = E(
  "parseNutritionLabelLines("
  +JSON.stringify(labelLines)
  +")"
);

check(
  "label extracts serving description",
  parsed.servingLabel==="2/3 cup (55g)"
);

check(
  "label extracts calories and macros",
  parsed.calories===230
  && parsed.fat===8
  && parsed.carbs===37
  && parsed.protein===3
);

const solidMeasure = E(
  'nutritionLabelServingMeasure("1 oz (28 g)")'
);

check(
  "label parser prefers metric gram amount",
  solidMeasure.amount===28
  && solidMeasure.unit==="g"
);

const liquidMeasure = E(
  'nutritionLabelServingMeasure("12 fl oz (355 mL)")'
);

check(
  "label parser prefers metric liquid amount",
  liquidMeasure.amount===355
  && liquidMeasure.unit==="ml"
);

const beforeScanFood = E(
  "JSON.stringify(data.food)"
);

const scanApplied = E(
  "applyNutritionLabelScanResult("
  +JSON.stringify(parsed)
  +",{confirmOverwrite:false})"
);

check(
  "label scan fills unified manual serving fields",
  scanApplied===true
  && d.getElementById("mServingLabel").value
    ==="2/3 cup (55g)"
  && d.getElementById("mServingAmount").value==="55"
  && d.getElementById("mServingUnit").value==="g"
);

check(
  "label scan fills calories and macros",
  d.getElementById("mCal").value==="230"
  && d.getElementById("mPro").value==="3"
  && d.getElementById("mCarb").value==="37"
  && d.getElementById("mFat").value==="8"
);

check(
  "label scan still requires user-entered food name",
  d.getElementById("mName").value===""
);

check(
  "label scan logs nothing automatically",
  E("JSON.stringify(data.food)")===beforeScanFood
);

d.getElementById("mName").value =
  "Test cereal";

d.getElementById("mBrand").value =
  "Test brand";

click(
  App.window,
  "manualUseBtn"
);

check(
  "scanned food opens amount slider at one serving",
  !d
    .getElementById("calcCard")
    .classList
    .contains("hidden")
  && d.getElementById("qtyUnit").value==="serving"
  && Number(d.getElementById("qtyAmount").value)===1
);

check(
  "one scanned serving matches package nutrition",
  d.getElementById("calcCal").textContent==="230"
  && d.getElementById("calcPro").textContent==="3"
  && d.getElementById("calcCarb").textContent==="37"
  && d.getElementById("calcFat").textContent==="8"
);

input(
  App.window,
  "qtyAmount",
  "0.5"
);

check(
  "half scanned serving scales automatically",
  d.getElementById("calcCal").textContent==="115"
  && d.getElementById("calcPro").textContent==="1.5"
  && d.getElementById("calcCarb").textContent==="18.5"
  && d.getElementById("calcFat").textContent==="4"
);

input(
  App.window,
  "qtyAmount",
  "1.5"
);

check(
  "one-and-a-half scanned servings preserve decimal macros",
  d.getElementById("calcCal").textContent==="345"
  && d.getElementById("calcPro").textContent==="4.5"
  && d.getElementById("calcCarb").textContent==="55.5"
  && d.getElementById("calcFat").textContent==="12"
);

input(
  App.window,
  "qtyAmount",
  "0.5"
);

check(
  "slider review still logs nothing before Add to log",
  E("JSON.stringify(data.food)")===beforeScanFood
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
  && /Added to today/.test(
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

check(
  "scanner stays hidden without native plugin",
  App.window.document
    .getElementById("labelScanBtn")
    .classList
    .contains("hidden")
);

const Native = boot(
  EXISTING_CFG,
  EMPTY_DATA,
  window=>{
    const plugin = {
      async recognize(){
        return {
          lines:labelLines.map(text=>({
            text:text,
            confidence:0.99
          }))
        };
      }
    };

    window.Capacitor = {
      Plugins:{},
      isNativePlatform:()=>true,
      isPluginAvailable:name=>
        name==="NutritionLabelScanner",
      registerPlugin:name=>
        name==="NutritionLabelScanner"
          ? plugin
          : null
    };
  }
);

check(
  "native plugin reveals scanner button",
  Native.window.eval(
    "nutritionLabelScannerCapability().available"
  )===true
  && !Native.window.document
    .getElementById("labelScanBtn")
    .classList
    .contains("hidden")
);

const Curved = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const curvedParsed = Curved.window.eval(
  "parseNutritionLabelLines("
  +JSON.stringify([
    {
      text:"Serving size",
      confidence:0.91,
      x:0.57,
      y:0.76,
      width:0.25,
      height:0.05,
      pass:"original"
    },
    {
      text:"1 bottle",
      confidence:0.96,
      x:0.59,
      y:0.69,
      width:0.19,
      height:0.05,
      pass:"contrast"
    },
    {
      text:"Calories per serving",
      confidence:0.88,
      x:0.55,
      y:0.54,
      width:0.30,
      height:0.07,
      pass:"original"
    },
    {
      text:"10",
      confidence:0.94,
      x:0.88,
      y:0.55,
      width:0.07,
      height:0.08,
      pass:"inverted"
    },
    {
      text:"Total Fat 0g",
      confidence:0.91,
      x:0.53,
      y:0.42,
      width:0.25,
      height:0.04,
      pass:"contrast"
    },
    {
      text:"Total Carbohydrate 0g",
      confidence:0.90,
      x:0.53,
      y:0.32,
      width:0.36,
      height:0.04,
      pass:"contrast"
    },
    {
      text:"Protein 0g",
      confidence:0.89,
      x:0.53,
      y:0.22,
      width:0.20,
      height:0.04,
      pass:"contrast"
    },
    {
      text:"Calories per serving",
      confidence:0.72,
      x:0.551,
      y:0.541,
      width:0.30,
      height:0.07,
      pass:"inverted"
    }
  ])
  +")"
);

check(
  "curved dark label joins serving size with bottle description",
  curvedParsed.servingLabel==="1 bottle"
);

check(
  "curved label geometry joins Calories with separated value",
  curvedParsed.calories===10
);

check(
  "curved zero-calorie macros remain valid zero values",
  curvedParsed.fat===0
  && curvedParsed.carbs===0
  && curvedParsed.protein===0
  && curvedParsed.nutrientCount===4
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
  "food logging installs individual and clear-all controls",
  !!clearDocument.getElementById("foodSearchClearBtn")
  && !!clearDocument.getElementById("barcodeClearBtn")
  && !!clearDocument.getElementById("labelScanClearBtn")
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
  .getElementById("labelScanStatus")
  .textContent =
    "Old scan result";

clearDocument
  .getElementById("labelScanStatus")
  .classList
  .remove("hidden");

clearDocument
  .getElementById("clearAllFoodEntryBtn")
  .click();

check(
  "clear all removes search barcode scan and manual state",
  (!clearSearch || clearSearch.value==="")
  && (!clearBarcode || clearBarcode.value==="")
  && clearDocument.getElementById("mName").value===""
  && clearDocument.getElementById("mCal").value===""
  && clearDocument
    .getElementById("labelScanStatus")
    .classList
    .contains("hidden")
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

const RepeatLabelScan = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const repeatWindow =
  RepeatLabelScan.window;

const repeatDocument =
  repeatWindow.document;

repeatDocument.getElementById("mName").value =
  "Pretzels";

repeatDocument.getElementById("mServingLabel").value =
  "1 oz (28 g)";

repeatDocument.getElementById("mServingAmount").value =
  "28";

repeatDocument.getElementById("mServingUnit").value =
  "g";

repeatDocument.getElementById("mCal").value =
  "110";

repeatDocument.getElementById("mPro").value =
  "3";

repeatDocument.getElementById("mCarb").value =
  "23";

repeatDocument.getElementById("mFat").value =
  "1";

repeatWindow.eval(
  'activeFoodEntryMode="label"'
);

repeatDocument
  .getElementById("labelScanBtn")
  .dispatchEvent(
    new repeatWindow.Event(
      "click",
      {bubbles:true}
    )
  );

check(
  "repeat label scan clears an earlier measured serving",
  repeatDocument.getElementById("mServingLabel").value===""
  && repeatDocument.getElementById("mServingAmount").value===""
  && repeatDocument.getElementById("mServingUnit").value==="serving"
);

check(
  "repeat label scan clears earlier manual nutrition values",
  repeatDocument.getElementById("mName").value===""
  && repeatDocument.getElementById("mCal").value===""
  && repeatDocument.getElementById("mPro").value===""
  && repeatDocument.getElementById("mCarb").value===""
  && repeatDocument.getElementById("mFat").value===""
);

const LetterZero = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const letterZeroParsed =
  LetterZero.window.eval(
    "parseNutritionLabelLines("
    +JSON.stringify([
      {
        text:"Calories per serving",
        confidence:0.94,
        x:0.55,
        y:0.54,
        width:0.29,
        height:0.07,
        pass:"original"
      },
      {
        text:"1O",
        confidence:0.91,
        x:0.87,
        y:0.55,
        width:0.08,
        height:0.08,
        pass:"contrast"
      },
      {
        text:"Serving size",
        confidence:0.94,
        x:0.55,
        y:0.76,
        width:0.24,
        height:0.05,
        pass:"original"
      },
      {
        text:"1 bottle",
        confidence:0.95,
        x:0.57,
        y:0.69,
        width:0.20,
        height:0.05,
        pass:"contrast"
      }
    ])
    +")"
  );

check(
  "calorie OCR converts letter O to zero",
  letterZeroParsed.calories===10
);

const SplitCalories = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const splitParsed =
  SplitCalories.window.eval(
    "parseNutritionLabelLines("
    +JSON.stringify([
      {
        text:"Calories per serving",
        confidence:0.94,
        x:0.53,
        y:0.54,
        width:0.30,
        height:0.07,
        pass:"original"
      },
      {
        text:"1",
        confidence:0.95,
        x:0.875,
        y:0.55,
        width:0.028,
        height:0.08,
        pass:"original"
      },
      {
        text:"0",
        confidence:0.93,
        x:0.907,
        y:0.55,
        width:0.030,
        height:0.08,
        pass:"contrast"
      },
      {
        text:"Serving size",
        confidence:0.94,
        x:0.54,
        y:0.76,
        width:0.24,
        height:0.05,
        pass:"original"
      },
      {
        text:"1 bottle",
        confidence:0.95,
        x:0.56,
        y:0.69,
        width:0.20,
        height:0.05,
        pass:"contrast"
      }
    ])
    +")"
  );

check(
  "calorie OCR joins adjacent 1 and 0 boxes",
  splitParsed.calories===10
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

const CalorieCandidate = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const candidateParsed =
  CalorieCandidate.window.eval(
    "parseNutritionLabelLines("
    +JSON.stringify([
      {
        text:"Calories per serving",
        confidence:0.97,
        x:0.52,
        y:0.54,
        width:0.31,
        height:0.07,
        pass:"original-rank1"
      },
      {
        text:"1",
        confidence:0.96,
        x:0.88,
        y:0.55,
        width:0.06,
        height:0.08,
        pass:"original-rank1"
      },
      {
        text:"10",
        confidence:0.78,
        x:0.875,
        y:0.548,
        width:0.09,
        height:0.085,
        pass:"calorie-contrast-0-rank2"
      },
      {
        text:"Serving size",
        confidence:0.95,
        x:0.54,
        y:0.76,
        width:0.24,
        height:0.05,
        pass:"original-rank1"
      },
      {
        text:"1 bottle",
        confidence:0.95,
        x:0.56,
        y:0.69,
        width:0.20,
        height:0.05,
        pass:"contrast-rank1"
      }
    ])
    +")"
  );

check(
  "calorie crop candidate beats incomplete single digit",
  candidateParsed.calories===10
);

const LetterZeroCandidate = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const letterZeroParsedV87 =
  LetterZeroCandidate.window.eval(
    "parseNutritionLabelLines("
    +JSON.stringify([
      {
        text:"Calories",
        confidence:0.95,
        x:0.55,
        y:0.54,
        width:0.24,
        height:0.07,
        pass:"original-rank1"
      },
      {
        text:"1O",
        confidence:0.88,
        x:0.86,
        y:0.55,
        width:0.09,
        height:0.08,
        pass:"calorie-inverted-0-rank2"
      }
    ])
    +")"
  );

check(
  "calorie OCR treats letter O as zero",
  letterZeroParsedV87.calories===10
);

const RepeatScan = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const repeatDocumentV87_2 =
  RepeatScan.window.document;

repeatDocumentV87_2.getElementById("mName").value =
  "Pretzels";

repeatDocumentV87_2.getElementById("mServingLabel").value =
  "1 oz (28 g)";

repeatDocumentV87_2.getElementById("mServingAmount").value =
  "28";

repeatDocumentV87_2.getElementById("mServingUnit").value =
  "g";

repeatDocumentV87_2.getElementById("mCal").value =
  "110";

RepeatScan.window.eval(
  "beginNutritionLabelScan()"
);

check(
  "repeat label scan clears pretzel serving data",
  repeatDocumentV87_2.getElementById("mName").value===""
  && repeatDocumentV87_2.getElementById("mServingLabel").value===""
  && repeatDocumentV87_2.getElementById("mServingAmount").value===""
  && repeatDocumentV87_2.getElementById("mServingUnit").value==="serving"
  && repeatDocumentV87_2.getElementById("mCal").value===""
);

const ServingGarbageV88 = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const servingGarbageParsedV88 =
  ServingGarbageV88.window.eval(
    "parseNutritionLabelLines("
    +JSON.stringify([
      {
        text:"Serving size",
        confidence:0.96,
        x:0.52,
        y:0.74,
        width:0.24,
        height:0.05,
        pass:"original-rank1"
      },
      {
        text:"IUUWI",
        confidence:0.91,
        x:0.53,
        y:0.67,
        width:0.18,
        height:0.06,
        pass:"contrast-rank1"
      },
      {
        text:"Calories",
        confidence:0.96,
        x:0.52,
        y:0.53,
        width:0.21,
        height:0.07,
        pass:"original-rank1"
      },
      {
        text:"10",
        confidence:0.91,
        x:0.86,
        y:0.54,
        width:0.09,
        height:0.08,
        pass:"calorie-contrast-0-rank1"
      }
    ])
    +")"
  );

check(
  "garbage serving OCR is rejected",
  servingGarbageParsedV88.servingLabel===""
);

const ServingCorrectionV88 = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const servingCorrectionParsedV88 =
  ServingCorrectionV88.window.eval(
    "parseNutritionLabelLines("
    +JSON.stringify([
      {
        text:"Serving size",
        confidence:0.96,
        x:0.52,
        y:0.74,
        width:0.24,
        height:0.05,
        pass:"original-rank1"
      },
      {
        text:"I bottle",
        confidence:0.82,
        x:0.53,
        y:0.67,
        width:0.20,
        height:0.06,
        pass:"contrast-rank2"
      }
    ])
    +")"
  );

check(
  "clear serving OCR substitution becomes 1 bottle",
  servingCorrectionParsedV88.servingLabel==="1 bottle"
);

const ServingGeometryV88 = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const servingGeometryParsedV88 =
  ServingGeometryV88.window.eval(
    "parseNutritionLabelLines("
    +JSON.stringify([
      {
        text:"Serving size",
        confidence:0.97,
        x:0.50,
        y:0.74,
        width:0.25,
        height:0.05,
        pass:"original-rank1"
      },
      {
        text:"IUUWI",
        confidence:0.94,
        x:0.52,
        y:0.67,
        width:0.18,
        height:0.06,
        pass:"original-rank1"
      },
      {
        text:"1 bottle",
        confidence:0.79,
        x:0.53,
        y:0.66,
        width:0.21,
        height:0.06,
        pass:"inverted-rank2"
      }
    ])
    +")"
  );

check(
  "plausible serving candidate beats garbage candidate",
  servingGeometryParsedV88.servingLabel==="1 bottle"
);

const ServingMeasuredV88 = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

check(
  "measured serving descriptions remain accepted",
  ServingMeasuredV88.window.eval(
    "nutritionLabelNormalizeServingDescription('1 oz (28 g)')"
  )==="1 oz (28 g)"
  && ServingMeasuredV88.window.eval(
    "nutritionLabelNormalizeServingDescription('12 fl. oz.')"
  )==="12 fl oz"
);

const root = path.join(
  __dirname,
  ".."
);

const swift = fs.readFileSync(
  path.join(
    root,
    "ios",
    "App",
    "App",
    "AppDelegate.swift"
  ),
  "utf8"
);

check(
  "Swift plugin retains Capacitor and Apple Vision OCR",
  /CAPBridgedPlugin/.test(swift)
  && /registerPluginInstance/.test(swift)
  && /VNRecognizeTextRequest/.test(swift)
  && /recognitionLevel\s*=\s*\.accurate/.test(swift)
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
  && /Scan nutrition label/.test(faq)
  && /Correct barcode data/.test(faq)
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
  "unified food-slider candidate advances cache to v89",
  sw.includes(
    'const CACHE = "blackpyre-v90-4"'
  )
);

console.log(
  "\nPHASE 2.1 UNIFIED FOOD SLIDER: "
  +passed+" passed, "
  +failed+" failed"
);

if (failed){
  console.error(
    "failures: "+failures.join(" | ")
  );

  process.exit(1);
}
