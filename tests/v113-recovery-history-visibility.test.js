const {boot,check,summary,EXISTING_CFG}=require("./harness");
const fs=require("fs"),path=require("path");

const rawIndex=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const rawStorage=fs.readFileSync(path.join(__dirname,"..","scripts","01-storage.js"),"utf8");
const rawTrain=fs.readFileSync(path.join(__dirname,"..","scripts","03-train.js"),"utf8");
const rawSettings=fs.readFileSync(path.join(__dirname,"..","scripts","06-settings.js"),"utf8");
const rawSw=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8");

const program={
  name:"Recovery Visibility",
  author:"Suite",
  days:[
    {id:"D1",title:"Chest & Triceps",exercises:[{name:"Bench Press",scheme:"3×5"}]},
    {id:"D2",title:"Back & Biceps",exercises:[{name:"Seated Row",scheme:"3×8"}]},
    {id:"D3",title:"Legs & Shoulders",exercises:[{name:"Leg Press",scheme:"3×8"}]}
  ]
};

function workout(i){
  return {
    date:"2026-07-"+String(10+i).padStart(2,"0"),
    day:"D"+((i%3)+1),
    title:"Saved Workout "+(i+1),
    sets:{
      "Bench Press":[{w:100+i*5,r:8},{w:100+i*5,r:8},{w:100+i*5,r:8}]
    },
    notes:""
  };
}

const originalData={
  food:{
    "2026-07-22":[
      {name:"Food 1",cal:100,pro:10,carb:10,fat:2,meal:"lunch"},
      {name:"Food 2",cal:200,pro:20,carb:20,fat:4,meal:"lunch"},
      {name:"Food 3",cal:110,pro:0,carb:26,fat:1,meal:"snacks"},
      {name:"Food 4",cal:80,pro:0,carb:18,fat:0,meal:"snacks"}
    ]
  },
  workouts:Array.from({length:10},(_,i)=>workout(i)),
  weights:[
    {date:"2026-07-22",lbs:211.5},
    {date:"2026-08-02",lbs:210.9},
    {date:"2026-08-08",lbs:210.6},
    {date:"2026-08-10",time:"16:41",lbs:210.5}
  ],
  recents:[],
  myFoods:{},
  myExercises:{},
  meals:[],
  finished:{},
  foodCounts:{},
  mealCounts:{},
  meta:{lastBackup:null,logsSince:0},
  activeWorkoutDraft:null
};

const R=boot(
  Object.assign({},EXISTING_CFG,{schemaVersion:3,waterOn:false}),
  originalData,
  null,
  program
);

R.window.eval("renderWork();renderRecoveryStatus();");

let primary=R.window.eval("currentPrimaryDataStatus()");
check(
  "v113 primary-data health reports 10 workouts 4 weigh-ins and 4 food entries",
  primary.ok&&primary.workouts===10&&primary.weights===4&&primary.foodEntries===4
);

check(
  "v113 History renders all persisted workouts",
  /10 sessions/.test(R.window.document.getElementById("workHistoryCount").textContent)
  &&/Saved Workout 10/.test(R.window.document.getElementById("workHistory").textContent)
);

R.window.eval("data.workouts=[];renderWork();");
check(
  "v113 stale runtime automatically adopts richer persisted workout history for display",
  R.window.eval("data.workouts.length")===10
  &&/10 sessions/.test(R.window.document.getElementById("workHistoryCount").textContent)
);

R.window.eval(`
  const __realInspectLkgRaw=inspectLkgRaw;
  localStorage.setItem(LKG_KEY,JSON.stringify({
    recoveryFormatVersion:1,
    savedAt:"2026-08-10T22:38:42.095Z",
    source:"test",
    strings:{
      cfg:localStorage.getItem(CFG_KEY),
      data:localStorage.getItem(DATA_KEY),
      program:localStorage.getItem(PROG_KEY)
    },
    legacyData:null
  }));
  localStorage.setItem(LKG_PREVIOUS_KEY,"__THROW__");
  localStorage.setItem(LKG_OLDER_KEY,localStorage.getItem(LKG_KEY));
  inspectLkgRaw=function(raw){
    if(raw==="__THROW__") throw new Error("synthetic isolated inspection failure");
    return __realInspectLkgRaw(raw);
  };
`);

const statuses=R.window.eval("getStoredLkgStatuses()");
check(
  "v113 one broken recovery generation cannot hide the other recovery generations",
  statuses.length===3
  &&statuses[0].ok===true
  &&statuses[1].ok===false
  &&statuses[2].ok===true
);

R.window.eval("renderRecoveryStatus();");
const recoveryText=R.window.document.getElementById("snapshotMetaLine").textContent;
const recoveryOptions=[...R.window.document.getElementById("snapshotRecoverySelect").options].map(o=>o.textContent);

check(
  "v113 Settings still exposes the selected healthy recovery content",
  /Contains: 10 workouts · 4 weigh-ins · food · program · settings/.test(recoveryText)
);

check(
  "v113 Settings still exposes healthy snapshot generations when another generation fails",
  recoveryOptions.some(x=>/^Current recovery — /.test(x)&&!/workout/.test(x))
  &&recoveryOptions.some(x=>/^Older recovery — /.test(x)&&!/workout/.test(x))
  &&recoveryOptions.some(x=>/^Previous recovery — unavailable$/.test(x))
);

check(
  "v113 full critical runtime family and cache are version-busted",
  /blackpyre-v122-assisted-pr-1/.test(rawSw)
  &&/scripts\/01-storage\.js\?v=web-v122-assisted-pr-1/.test(rawIndex)
  &&/scripts\/03-train\.js\?v=web-v122-assisted-pr-1/.test(rawIndex)
  &&/scripts\/06-settings\.js\?v=web-v122-assisted-pr-1/.test(rawIndex)
);

check(
  "v113 source contains per-generation recovery isolation and safe history fallback",
  /return defs\.map\(d=>\{/.test(rawStorage)
  &&/refreshRicherPersistedDataForDisplay/.test(rawStorage)
  &&/try \{ formatted=formatSets/.test(rawTrain)
  &&/Current saved data:/.test(rawSettings)
);

R.window.close();
summary("V113 RECOVERY + HISTORY VISIBILITY");
