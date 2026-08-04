// BlackPyre Phase 1 manual food-entry safety tests.
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

const click=id=>{
  D.getElementById(id).dispatchEvent(
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

check(
  "manual validation preserves unrelated permanent data",
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
