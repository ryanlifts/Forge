// BlackPyre web v85 manual food regression after label-scanner removal.
const {
  boot,
  check,
  summary,
  EXISTING_CFG,
  EMPTY_DATA
} = require("./harness");

const fs = require("fs");

const App = boot(
  EXISTING_CFG,
  EMPTY_DATA
);

const W = App.window;
const D = W.document;
const E = code=>W.eval(code);

check(
  "web nutrition-label scanner controls are absent",
  !D.getElementById("labelScanBtn")
  && !D.getElementById("labelScanFile")
  && !D.getElementById("labelScanStatus")
);

check(
  "barcode controls remain",
  !!D.getElementById("scanBtn")
  && !!D.getElementById("barcodeInput")
  && !!D.getElementById("barcodeBtn")
);

const serving = E(`buildServingFood({
  name:"Protein bar",
  brand:"Test",
  servingLabel:"1 bar (52 g)",
  servingAmount:52,
  servingUnit:"g",
  calories:200,
  protein:15,
  carbs:23,
  fat:7,
  sourceLabel:"Manual"
})`);

check(
  "manual package-label food still builds",
  serving.ok===true
  && serving.food.nutritionBasis==="serving"
  && serving.food.servingG===52
  && serving.food.calServing===200
  && serving.food.proServing===15
  && serving.food.carbServing===23
  && serving.food.fatServing===7
);

const servingOnly = E(`buildServingFood({
  name:"Homemade meal",
  servingLabel:"1 serving",
  servingUnit:"serving",
  calories:300,
  protein:20,
  carbs:30,
  fat:10,
  sourceLabel:"Manual"
})`);

check(
  "manual serving-only foods remain supported",
  servingOnly.ok===true
  && servingOnly.food.servingOnly===true
  && servingOnly.food.calServing===300
);

check(
  "manual entry controls remain",
  !!D.getElementById("mName")
  && !!D.getElementById("mServingLabel")
  && !!D.getElementById("mServingAmount")
  && !!D.getElementById("mServingUnit")
  && !!D.getElementById("mCal")
  && !!D.getElementById("mPro")
  && !!D.getElementById("mCarb")
  && !!D.getElementById("mFat")
);

const foodSource =
  fs.readFileSync(
    "scripts/02-food.js",
    "utf8"
  );

check(
  "PaddleOCR and label scanner implementation are absent",
  !/nutritionLabel|labelScan|PaddleOCR|paddleocr|NUTRITION_LABEL|PP-OCR/.test(
    foodSource
  )
);

summary(
  "PHASE 2.1 UNIFIED FOOD SLIDER"
);
