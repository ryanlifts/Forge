// BlackPyre Phase 1 complete food-entry safety tests.
const {
  boot,
  check,
  summary,
  EXISTING_CFG,
  EMPTY_DATA
} = require("./harness");

(async ()=>{
const seed=JSON.parse(JSON.stringify(EMPTY_DATA));

seed.food={};
seed.myFoods={};
seed.savedMeals=[{
  name:"Protected meal",
  items:[{name:"Existing food",cal:100,pro:5,carb:10,fat:3}]
}];
seed.workouts=[{
  date:"2026-07-20",
  type:"Strength",
  sets:{"Bench Press":[{"w":135,"r":5}]}
}];
seed.weights=[{date:"2026-07-20",lbs:200}];

const dom=boot(EXISTING_CFG,seed);
const W=dom.window;
const D=W.document;
const E=code=>W.eval(code);

const click=target=>{
  const element=typeof target==="string"
    ? D.getElementById(target)
    : target;

  element.dispatchEvent(
    new W.Event("click",{bubbles:true})
  );
};

const setv=(id,value)=>{
  const element=D.getElementById(id);
  element.value=String(value);
  element.dispatchEvent(
    new W.Event("input",{bubbles:true})
  );
  element.dispatchEvent(
    new W.Event("change",{bubbles:true})
  );
};

check(
  "manual-food validator rejects missing, malformed, infinite, negative, and unsafe values",
  E(`[
    validateFoodNutritionDraft({name:"",cal:100,pro:1,carb:1,fat:1}),
    validateFoodNutritionDraft({name:"Food",cal:"",pro:1,carb:1,fat:1}),
    validateFoodNutritionDraft({name:"Food",cal:"bad",pro:1,carb:1,fat:1}),
    validateFoodNutritionDraft({name:"Food",cal:100,pro:Infinity,carb:1,fat:1}),
    validateFoodNutritionDraft({name:"Food",cal:100,pro:-1,carb:1,fat:1}),
    validateFoodNutritionDraft({name:"Food",cal:10001,pro:1,carb:1,fat:1})
  ].every(result=>!result.ok)`)
);

check(
  "manual-food validator accepts explicitly entered zero macros",
  E(`validateFoodNutritionDraft({
    name:"Zero macro food",
    cal:100,
    pro:0,
    carb:0,
    fat:0
  }).ok`)
);

const originalData=E(`JSON.stringify(data)`);

setv("mCal",200);
setv("mPro",10);
setv("mCarb",20);
setv("mFat",5);
click("addManualBtn");

check(
  "missing manual name explains, focuses, and does not mutate data",
  D.activeElement===D.getElementById("mName")
  && /food name/.test(D.getElementById("saveState").textContent)
  && E(`JSON.stringify(data)`)===originalData
);

setv("mName","Manual safety food");
D.getElementById("mCal").value="";
click("addManualBtn");

check(
  "missing calories preserves the draft and focuses calories",
  D.activeElement===D.getElementById("mCal")
  && /calories greater than 0/.test(
    D.getElementById("saveState").textContent
  )
  && D.getElementById("mName").value==="Manual safety food"
  && E(`JSON.stringify(data)`)===originalData
);

setv("mCal",200);
D.getElementById("mPro").value="";
click("addManualBtn");

check(
  "blank protein is blocked instead of silently becoming zero",
  D.activeElement===D.getElementById("mPro")
  && D.getElementById("mName").value==="Manual safety food"
  && E(`JSON.stringify(data)`)===originalData
);

setv("mPro",-1);
click("addManualBtn");

check(
  "negative macro values are blocked transactionally",
  D.activeElement===D.getElementById("mPro")
  && /negative/.test(D.getElementById("saveState").textContent)
  && E(`JSON.stringify(data)`)===originalData
);

setv("mPro",10);
const actionLabel=D.getElementById("addManualBtn").textContent;
click("addManualBtn");

check(
  "valid manual food logs only through Add to log",
  actionLabel==="Add to log"
  && E(`data.food[todayStr()].length`)===1
  && E(`data.food[todayStr()][0].name`)==="Manual safety food"
  && E(`data.food[todayStr()][0].pro`)===10
);

E(`startEditEntry(0)`);
setv("mCal",225);
setv("mPro",12);
setv("mCarb",22);
setv("mFat",6);
click("addManualBtn");

check(
  "editing the manual entry updates it without creating a duplicate",
  E(`data.food[todayStr()].length`)===1
  && E(`data.food[todayStr()][0].cal`)===225
  && E(`data.food[todayStr()][0].pro`)===12
);

const duplicate={
  name:"Duplicate boundary",
  cal:150,
  pro:5,
  carb:20,
  fat:4
};

E(`addEntry(${JSON.stringify(duplicate)})`);
const firstLength=E(`data.food[todayStr()].length`);
E(`addEntry(${JSON.stringify(duplicate)})`);

check(
  "rapid duplicate food adds remain blocked",
  E(`data.food[todayStr()].length`)===firstLength
);

E(`_lastAddT=Date.now()-1000`);
E(`addEntry(${JSON.stringify(duplicate)})`);

check(
  "the same food can still be logged intentionally later",
  E(`data.food[todayStr()].length`)===firstLength+1
);


const beforeExternal=E(`data.food[todayStr()].length`);

E(`selectFood({
  name:"Database product",
  brand:"Open Food Facts",
  cal100:200,
  pro100:4,
  carb100:30,
  fat100:8,
  servingG:50,
  servingLabel:"1 package (50 g)"
})`);

check(
  "external database food opens editable review without logging",
  E(`data.food[todayStr()].length`)===beforeExternal
  && D.getElementById("selEditName").value==="Database product"
  && D.getElementById("selEditCal100").value==="200"
  && !D.getElementById("calcCard").classList.contains("hidden")
);

setv("selEditName","Corrected database product");
setv("selEditCal100",240);
setv("selEditPro100",-1);
click("addSelBtn");

check(
  "invalid external review remains editable and does not log",
  E(`data.food[todayStr()].length`)===beforeExternal
  && !D.getElementById("calcCard").classList.contains("hidden")
  && !D.getElementById("selReviewError").classList.contains("hidden")
  && D.activeElement===D.getElementById("selEditPro100")
);

setv("selEditPro100",6);
setv("selEditCarb100",32);
setv("selEditFat100",9);
click("addSelBtn");

check(
  "corrected external nutrition is preserved in the logged entry",
  E(`data.food[todayStr()].length`)===beforeExternal+1
  && /Corrected database product/.test(
    E(`data.food[todayStr()].at(-1).name`)
  )
  && E(`data.food[todayStr()].at(-1).cal`)===120
  && E(`data.food[todayStr()].at(-1).sourceFood.cal100`)===240
);

const beforeBarcodeFoods=E(`JSON.stringify(data.myFoods)`);
const beforeBarcodeLog=E(`data.food[todayStr()].length`);

E(`switchFoodEntryMode("barcode"); openCustomForm("012345678905")`);
setv("cfName","Barcode correction");
setv("cfBarcode","012345678905");
setv("cfServG",50);
setv("cfCal",200);
setv("cfPro",5);
setv("cfCarb",30);
D.getElementById("cfFat").value="";
click("cfSaveBtn");

check(
  "invalid barcode correction does not partially save",
  E(`JSON.stringify(data.myFoods)`)===beforeBarcodeFoods
  && E(`data.food[todayStr()].length`)===beforeBarcodeLog
  && !D.getElementById("customCard").classList.contains("hidden")
);

setv("cfFat",10);
click("cfSaveBtn");

check(
  "valid barcode correction saves safely and opens review without logging",
  !!E(`data.myFoods["012345678905"]`)
  && E(`data.myFoods["012345678905"].cal100`)===400
  && E(`data.food[todayStr()].length`)===beforeBarcodeLog
  && D.getElementById("selEditName").value==="Barcode correction"
);

const beforeMyFoodsCount=E(`Object.keys(data.myFoods).length`);

setv("mfName","Reusable food");
setv("mfServG",100);
setv("mfCal",300);
setv("mfPro",10);
setv("mfCarb",40);
D.getElementById("mfFat").value="";
click("mfSaveBtn");

check(
  "invalid My Foods nutrition does not partially save",
  E(`Object.keys(data.myFoods).length`)===beforeMyFoodsCount
  && D.activeElement===D.getElementById("mfFat")
);

setv("mfFat",8);
click("mfSaveBtn");

check(
  "valid My Foods nutrition saves through strict validation",
  E(`Object.keys(data.myFoods).length`)===beforeMyFoodsCount+1
  && E(`Object.values(data.myFoods).some(
    food=>food.name==="Reusable food"
      && food.cal100===300
      && food.fat100===8
  )`)
);

const beforeAI=E(`data.food[todayStr()].length`);

E(`showFoodConfirm([{
  name:"AI meal",
  cal:500,
  pro:25,
  carb:50,
  fat:20
}])`);

check(
  "AI estimate is editable and remains unlogged during review",
  E(`data.food[todayStr()].length`)===beforeAI
  && !!D.querySelector("#aiFoodConfirm .list-item")
  && !!D.querySelector(".ai-food-name")
  && /^Add to log/.test(
    D.querySelector(".ai-confirm-log").textContent
  )
);

E(`showFoodConfirm([
  {name:"Valid AI item",cal:200,pro:10,carb:20,fat:5},
  {name:"Invalid AI item",cal:300,pro:-1,carb:30,fat:10}
])`);

click(D.querySelector(".ai-confirm-log"));

check(
  "invalid AI batch blocks every item without partial logging",
  E(`data.food[todayStr()].length`)===beforeAI
  && !D.querySelector(".ai-food-review-error").classList.contains("hidden")
  && D.activeElement===D.querySelectorAll(".ai-food-pro")[1]
);

E(`showFoodConfirm([{
  name:"AI meal",
  cal:500,
  pro:25,
  carb:50,
  fat:20
}])`);

const aiName=D.querySelector(".ai-food-name");
const aiCal=D.querySelector(".ai-food-cal");
const aiPro=D.querySelector(".ai-food-pro");
const aiCarb=D.querySelector(".ai-food-carb");
const aiFat=D.querySelector(".ai-food-fat");

[
  [aiName,"Edited AI meal"],
  [aiCal,"450"],
  [aiPro,"30"],
  [aiCarb,"40"],
  [aiFat,"18"]
].forEach(([element,value])=>{
  element.value=value;
  element.dispatchEvent(
    new W.Event("input",{bubbles:true})
  );
});

click(D.querySelector(".ai-confirm-log"));

check(
  "edited AI values log only after Add to log",
  E(`data.food[todayStr()].length`)===beforeAI+1
  && E(`data.food[todayStr()].at(-1).name`)==="Edited AI meal"
  && E(`data.food[todayStr()].at(-1).cal`)===450
  && E(`data.food[todayStr()].at(-1).pro`)===30
  && E(`data.food[todayStr()].at(-1).source`)===
    "AI-reviewed estimate"
);

check(
  "food-entry validation preserves unrelated permanent data",
  E(`data.workouts.length`)===1
  && E(`data.weights.length`)===1
  && E(`data.savedMeals.length`)===1
  && E(`data.savedMeals[0].name`)==="Protected meal"
);

summary("PHASE 1 FOOD ENTRY SAFETY");
})().catch(error=>{
  console.error(error);
  process.exit(1);
});
