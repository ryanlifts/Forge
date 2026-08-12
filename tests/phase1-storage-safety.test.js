const {
  bootRaw,
  EXISTING_CFG,
  EMPTY_DATA,
  check,
  summary
}=require("./harness");

const CFG=JSON.stringify(
  Object.assign({},EXISTING_CFG,{schemaVersion:3})
);

const DATA=JSON.stringify(
  Object.assign({},EMPTY_DATA,{
    activeWorkoutDraft:null,
    myExercises:{}
  })
);

const PROGRAM=JSON.stringify({
  name:"Test Program",
  author:"Suite",
  days:[{
    id:"D1",
    title:"Day 1",
    exercises:[{
      name:"Bench Press",
      scheme:"3×5"
    }]
  }]
});

function externalWrite(dom,key,raw){
  dom.window.__storageOriginalMethods.setItem.call(
    dom.window.localStorage,
    key,
    raw
  );
  dom.__storageCalls.length=0;
}

const rich=Object.assign({},EMPTY_DATA,{
  activeWorkoutDraft:null,
  myExercises:{},

  workouts:Array.from({length:10},(_,i)=>({
    date:"2026-07-"+String(i+1).padStart(2,"0"),
    sets:{
      "Bench Press":[{w:135,r:5}]
    }
  })),

  food:{
    "2026-07-10":[{
      name:"Chicken",
      cal:165,
      pro:31,
      carb:0,
      fat:4,
      meal:"lunch"
    }]
  },

  weights:[
    {date:"2026-07-10",lbs:218}
  ],

  water:{
    "2026-07-10":2
  },

  measure:[
    {date:"2026-07-10",waist:40}
  ]
});

const richRaw=JSON.stringify(rich);

const D=bootRaw({
  cfg:CFG,
  data:DATA,
  program:PROGRAM
});

externalWrite(
  D,
  "forge:data",
  richRaw
);

const dataResult=D.window.eval(`
  data.water=data.water||{};
  data.water["2026-08-11"]=1;
  save();
`);

check(
  "stale data cannot erase richer persisted logs",

  dataResult===false &&

  D.window.localStorage.getItem(
    "forge:data"
  )===richRaw &&

  D.window.eval(
    "data.workouts.length"
  )===10 &&

  D.window.eval(
    "data.weights.length"
  )===1 &&

  D.window.eval(
    "data.water['2026-07-10']"
  )===2
);

const C=bootRaw({
  cfg:CFG,
  data:DATA,
  program:PROGRAM
});

const authoritativeCfg=JSON.stringify(
  Object.assign({},EXISTING_CFG,{
    schemaVersion:3,
    goalWt:160
  })
);

externalWrite(
  C,
  "forge:cfg",
  authoritativeCfg
);

check(
  "stale settings cannot overwrite newer persisted settings",

  C.window.eval(`
    cfg.goalWt=250;
    saveCfg();
  `)===false &&

  C.window.localStorage.getItem(
    "forge:cfg"
  )===authoritativeCfg &&

  C.window.eval(
    "cfg.goalWt"
  )===160
);

const P=bootRaw({
  cfg:CFG,
  data:DATA,
  program:PROGRAM
});

const authoritativeProgram=JSON.stringify({
  name:"Authoritative Program",
  author:"Suite",
  days:[{
    id:"D1",
    title:"Day 1",
    exercises:[{
      name:"Back Squat",
      scheme:"3×5"
    }]
  }]
});

externalWrite(
  P,
  "forge:program",
  authoritativeProgram
);

check(
  "stale program cannot overwrite newer persisted program",

  P.window.eval(`
    program={
      name:"Stale Program",
      days:[{
        id:"D1",
        title:"Day 1",
        exercises:[{
          name:"Bench Press"
        }]
      }]
    };

    saveProgram();
  `)===false &&

  P.window.localStorage.getItem(
    "forge:program"
  )===authoritativeProgram &&

  P.window.eval(
    "program.name"
  )==="Authoritative Program"
);

summary("Phase 1 storage safety");
