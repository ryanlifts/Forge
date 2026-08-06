"use strict";

const fs=require("fs");
const vm=require("vm");

let passed=0;
let failed=0;

function check(name,condition){
  if(condition){
    passed+=1;
    console.log("  PASS: "+name);
  }else{
    failed+=1;
    console.error("  FAIL: "+name);
  }
}

const food=
  fs.readFileSync(
    "scripts/02-food.js",
    "utf8"
  );

const train=
  fs.readFileSync(
    "scripts/03-train.js",
    "utf8"
  );

const html=
  fs.readFileSync(
    "index.html",
    "utf8"
  );

/* Test the real scanner review function. */

const applyStart=
  food.indexOf(
    "function applyNutritionLabelScanResult("
  );

const applyEnd=
  food.indexOf(
    "function nutritionLabelImageBase64(",
    applyStart
  );

let scannerReviewPassed=false;

if(
  applyStart!==-1
  && applyEnd>applyStart
){
  const elements={};

  function element(id){
    if(!elements[id]){
      elements[id]={
        value:"",
        classList:{
          add(){},
          remove(){}
        },
        scrollIntoView(){}
      };
    }

    return elements[id];
  }

  const context={
    document:{
      getElementById:element
    },

    window:{
      confirm(){
        return true;
      }
    },

    nutritionLabelServingMeasure(){
      return {
        amount:70,
        unit:"g"
      };
    },

    nutritionLabelStatus(){},

    servingUnitText(value){
      return value;
    },

    manualEntrySource:""
  };

  vm.createContext(context);

  vm.runInContext(
    food.slice(
      applyStart,
      applyEnd
    ),
    context
  );

  context.applyNutritionLabelScanResult(
    {
      servingLabel:"1 bar (70 g)",
      calories:100.0000004,
      protein:3.0000002,
      carbs:18.5000001,
      fat:1.499
    },
    {
      confirmOverwrite:false
    }
  );

  scannerReviewPassed=
    elements.mCal.value==="100"
    && elements.mPro.value==="3"
    && elements.mCarb.value==="19"
    && elements.mFat.value==="1";
}

check(
  "scanner review displays whole-number calories and macros",
  scannerReviewPassed
);

/* Test the actual training helper. */

const helperStart=
  train.indexOf(
    "function prepareTrainingWeightInput("
  );

const helperEnd=
  train.indexOf(
    "function newExerciseNameMap(){",
    helperStart
  );

let trainingInputPassed=false;

if(
  helperStart!==-1
  && helperEnd>helperStart
){
  const handlers={};
  const listenerOptions={};

  let selectCount=0;
  let secondTapPrevented=false;

  const input={
    value:"225",
    style:{},

    addEventListener(
      name,
      handler,
      options
    ){
      handlers[name]=handler;
      listenerOptions[name]=options;
    },

    select(){
      selectCount+=1;
    }
  };

  const context={
    window:{
      setTimeout(callback){
        callback();
      }
    },

    Date:Date
  };

  vm.createContext(context);

  vm.runInContext(
    train.slice(
      helperStart,
      helperEnd
    ),
    context
  );

  context.prepareTrainingWeightInput(
    input
  );

  handlers.focus();
  handlers.pointerup();

  handlers.touchend({
    preventDefault(){}
  });

  handlers.touchend({
    preventDefault(){
      secondTapPrevented=true;
    }
  });

  trainingInputPassed=
    input.style.touchAction
      ==="manipulation"
    && selectCount===1
    && secondTapPrevented
    && listenerOptions.touchend
    && listenerOptions
      .touchend
      .passive===false;
}

check(
  "training weight selects on first focus and blocks rapid second-tap behavior",
  trainingInputPassed
);

check(
  "training weight uses a selectable decimal-keyboard text input",
  train.includes(
    'weightInput.type="text";'
  )
  && train.includes(
    'weightInput.inputMode="decimal";'
  )
  && train.includes(
    "prepareTrainingWeightInput("
  )
);

const stepRuleStart=
  html.indexOf(
    ".step {"
  );

const stepRuleEnd=
  html.indexOf(
    "}",
    stepRuleStart
  );

const stepRule=
  stepRuleStart===-1
  || stepRuleEnd===-1
    ? ""
    : html.slice(
        stepRuleStart,
        stepRuleEnd
      );

check(
  "rapid weight step taps disable double-tap zoom without disabling page pinch zoom",
  stepRule.includes(
    "touch-action:manipulation"
  )
  && !html.includes(
    "user-scalable=no"
  )
  && !html.includes(
    "maximum-scale=1"
  )
);

const noteStart=
  html.indexOf(
    "Supports ages 13+."
  );

const noteEnd=
  html.indexOf(
    "</div>",
    noteStart
  );

const note=
  noteStart===-1
  || noteEnd===-1
    ? ""
    : html.slice(
        noteStart,
        noteEnd
      );

check(
  "calculator explanation mirrors native guidance",
  note.includes(
    "Ages 13&ndash;17 use the 2023 Dietary Reference Intake youth equation"
  )
  && note.includes(
    "20% protein / 55% carbohydrate / 25% fat"
  )
  && note.includes(
    "Moderate uses the conservative Low active youth category"
  )
  && note.includes(
    "Mifflin-St Jeor equation"
  )
  && note.includes(
    "Not for pregnancy or breastfeeding"
  )
  && note.includes(
    "below 1,200 kcal"
  )
);

check(
  "calculator sources are linked without visible website addresses",
  note.includes(
    'href="https://pubmed.ncbi.nlm.nih.gov/2305711/"'
  )
  && note.includes(
    'href="https://www.ncbi.nlm.nih.gov/books/NBK588659/"'
  )
  && note.includes(
    'href="https://www.healthychildren.org/English/ages-stages/teen/nutrition/Pages/Fads-and-Diets.aspx"'
  )
  && note.includes(
    'href="https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-type-2-diabetes/game-plan"'
  )
  && note.includes(
    'href="https://jissn.biomedcentral.com/articles/10.1186/s12970-018-0242-y"'
  )
  && !note.includes(
    ">https://"
  )
  && !note.includes(
    ">http://"
  )
);

console.log(
  "\nV84 UI POLISH: "
  +passed
  +" passed, "
  +failed
  +" failed"
);

if(failed){
  process.exitCode=1;
}
