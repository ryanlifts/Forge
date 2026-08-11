const {boot,check,summary,EXISTING_CFG}=require("./harness");
const fs=require("fs"),path=require("path");

const rawIndex=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const rawSettings=fs.readFileSync(path.join(__dirname,"..","scripts","06-settings.js"),"utf8");
const rawSw=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8");

const program={
  name:"Recovery Summary",
  author:"Suite",
  days:[
    {id:"D1",title:"Day 1",exercises:[{name:"Bench Press",scheme:"3×5"}]}
  ]
};

function workout(i){
  return {
    date:"2026-08-"+String(1+i).padStart(2,"0"),
    day:"D1",
    title:"Workout "+(i+1),
    sets:{"Bench Press":[{w:100+i*5,r:8}]},
    notes:""
  };
}

const data={
  food:{
    "2026-08-10":[
      {name:"Food",cal:100,pro:10,carb:10,fat:2,meal:"lunch"}
    ]
  },
  workouts:[workout(0),workout(1)],
  weights:[
    {date:"2026-08-08",lbs:210.6},
    {date:"2026-08-10",lbs:210.5}
  ],
  water:{"2026-08-10":3},
  measure:[{date:"2026-08-10",waist:36}],
  recents:[],
  myFoods:{"123":{"name":"Saved food","cal100":100,"pro100":10,"carb100":10,"fat100":2,"servingG":100,"servingLabel":"100g"}},
  myExercises:{},
  meals:[],
  finished:{},
  foodCounts:{},
  mealCounts:{},
  meta:{lastBackup:null,logsSince:0},
  activeWorkoutDraft:null
};

const R=boot(
  Object.assign({},EXISTING_CFG,{schemaVersion:3,waterOn:true}),
  data,
  null,
  program
);

R.window.eval(`
  function __v114Snapshot(rawData,savedAt){
    return JSON.stringify({
      recoveryFormatVersion:1,
      savedAt:savedAt,
      source:"test",
      strings:{
        cfg:localStorage.getItem(CFG_KEY),
        data:JSON.stringify(rawData),
        program:localStorage.getItem(PROG_KEY)
      },
      legacyData:null
    });
  }

  localStorage.setItem(
    LKG_KEY,
    __v114Snapshot(JSON.parse(localStorage.getItem(DATA_KEY)),"2026-08-10T22:10:00.000Z")
  );

  const previous=JSON.parse(localStorage.getItem(DATA_KEY));
  previous.workouts=[previous.workouts[0]];
  previous.weights=[];
  previous.food={};
  previous.myFoods={};
  previous.water={};
  previous.measure=[];
  localStorage.setItem(
    LKG_PREVIOUS_KEY,
    __v114Snapshot(previous,"2026-08-10T22:09:00.000Z")
  );

  localStorage.setItem(
    LKG_OLDER_KEY,
    __v114Snapshot(JSON.parse(localStorage.getItem(DATA_KEY)),"2026-08-10T22:08:00.000Z")
  );

  renderRecoveryStatus();
`);

const select=R.window.document.getElementById("snapshotRecoverySelect");
let options=[...select.options].map(o=>o.textContent);

check(
  "v114 recovery dropdown stays compact and does not list data counts",
  options.length===3
  &&options.every(text=>!/workout|weigh|food|water|measurement|program|setting/i.test(text))
  &&options.some(text=>/^Current recovery — /.test(text))
  &&options.some(text=>/^Previous recovery — /.test(text))
  &&options.some(text=>/^Older recovery — /.test(text))
);

check(
  "v114 selected snapshot summary shows broad recovery contents outside the dropdown",
  /Contains: 2 workouts · 2 weigh-ins · food · water · measurements · program · settings/.test(
    R.window.document.getElementById("snapshotMetaLine").textContent
  )
);

R.window.eval(`
  document.getElementById("snapshotRecoverySelect").value=LKG_PREVIOUS_KEY;
  document.getElementById("snapshotRecoverySelect").dispatchEvent(new Event("change"));
`);

check(
  "v114 changing the selected recovery updates the compact content summary",
  /Contains: 1 workout · program · settings/.test(
    R.window.document.getElementById("snapshotMetaLine").textContent
  )
  &&!/weigh-in|food|water|measurements/.test(
    R.window.document.getElementById("snapshotMetaLine").textContent
  )
);

let confirmation="";
R.window.confirm=(message)=>{ confirmation=String(message||""); return false; };
R.window.eval("restoreSnapshotFromSettingsKey(LKG_PREVIOUS_KEY)");

check(
  "v114 restore confirmation explains that the full BlackPyre state is restored",
  /full saved BlackPyre state/.test(confirmation)
  &&/training, food, weight, water, measurements, program, and settings/.test(confirmation)
  &&/preserve the exact current state/.test(confirmation)
);

check(
  "v114 recovery summary source covers all major saved-data categories",
  /snapshotContentSummary/.test(rawSettings)
  &&/myFoods/.test(rawSettings)
  &&/activeWorkoutDraft/.test(rawSettings)
  &&/measurements/.test(rawSettings)
  &&/hasWater/.test(rawSettings)
);

check(
  "v114 runtime family and cache are version-busted",
  /blackpyre-v115-update-delivery-1/.test(rawSw)
  &&/scripts\/01-storage\.js\?v=web-v115-update-delivery-1/.test(rawIndex)
  &&/scripts\/03-train\.js\?v=web-v115-update-delivery-1/.test(rawIndex)
  &&/scripts\/05-ai\.js\?v=web-v115-update-delivery-1/.test(rawIndex)
  &&/scripts\/06-settings\.js\?v=web-v115-update-delivery-1/.test(rawIndex)
  &&/scripts\/07-boot\.js\?v=web-v115-update-delivery-1/.test(rawIndex)
);

check(
  "v114 dropdown label source remains deliberately short",
  /snapshotTierLabel\(status\.tier\)\+" — "\+snapshotSavedLabel\(status\)/.test(rawSettings)
  &&!/snapshotTierLabel\(status\.tier\)\+" — "\+snapshotWorkoutCount\(status\)/.test(rawSettings)
);

R.window.close();
summary("V114 RECOVERY SNAPSHOT SUMMARY");
