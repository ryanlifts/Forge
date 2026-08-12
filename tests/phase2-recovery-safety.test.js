const {
  bootRaw,
  EXISTING_CFG,
  EMPTY_DATA,
  check,
  summary
}=require("./harness");

const cfg=Object.assign(
  {},
  EXISTING_CFG,
  {
    schemaVersion:3,
    goalWt:168,
    unitSystem:"metric",
    accent:"violet",
    foodHandoffOn:false,
    autoProgressionOn:true,
    foodSuggestionsOn:true
  }
);

const customExercise={
  id:"u:recovery-carry",
  name:"Recovery Carry",
  shape:"carry",
  tags:["carry"],
  aliases:[],
  formerNames:[],
  muscles:{primary:[],secondary:[]},
  equipment:["dumbbell"],
  unilateral:false,
  bodyweight:false,
  deprecated:false
};

function workout(n){
  return {
    date:
      "2026-07-"+
      String(n).padStart(2,"0"),
    title:"Workout "+n,
    sets:{
      "Bench Press":[
        {w:135+n,r:5}
      ]
    }
  };
}

function fullData(count){
  return Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:
        Array.from(
          {length:count},
          (_,i)=>workout(i+1)
        ),

      activeWorkoutDraft:{
        date:"2026-08-11",
        day:"D1",
        sets:{
          "Bench Press":[
            {w:155,r:5}
          ]
        }
      },

      weights:[
        {date:"2026-08-01",lbs:219},
        {date:"2026-08-08",lbs:216.5}
      ],

      food:{
        "2026-08-10":[
          {
            name:"Chicken breast",
            cal:165,
            pro:31,
            carb:0,
            fat:3.6,
            meal:"lunch"
          }
        ]
      },

      water:{
        "2026-08-10":6,
        "2026-08-11":2
      },

      measure:[
        {
          date:"2026-08-01",
          waist:39.5,
          chest:44
        }
      ],

      myFoods:{
        "recovery-food":{
          name:"Recovery Meal",
          cal:500,
          pro:40,
          carb:50,
          fat:15
        }
      },

      myExercises:{
        "u:recovery-carry":
          customExercise
      },

      personalRecords:{
        benchPress:{
          value:225,
          unit:"lb",
          date:"2026-08-05"
        }
      },

      futureUserRecords:[
        {
          type:"future-record",
          value:"preserve-me"
        }
      ],

      recents:[
        "Chicken breast"
      ],

      meta:{
        lastBackup:
          "2026-08-10T20:00:00.000Z",
        logsSince:7
      }
    }
  );
}

const program={
  name:"Recovered Full Program",
  author:"Recovery Suite",
  days:[
    {
      id:"D1",
      title:"Strength",
      exercises:[
        {
          name:"Bench Press",
          scheme:"3×5"
        }
      ]
    },
    {
      id:"D2",
      title:"Conditioning",
      exercises:[
        {
          name:"Run",
          scheme:"20 min"
        }
      ]
    }
  ]
};

const sparseCfg=Object.assign(
  {},
  EXISTING_CFG,
  {
    schemaVersion:3,
    accent:"gold"
  }
);

const sparseData=Object.assign(
  {},
  EMPTY_DATA,
  {
    activeWorkoutDraft:null,
    myExercises:{}
  }
);

const sparseProgram={
  name:"Sparse Program",
  days:[
    {
      id:"D1",
      title:"Day 1",
      exercises:[
        {
          name:"Squat",
          scheme:"3×5"
        }
      ]
    }
  ]
};

const CFG=JSON.stringify(cfg);
const PROGRAM=JSON.stringify(program);
const SPARSE_CFG=JSON.stringify(sparseCfg);
const SPARSE_DATA=JSON.stringify(sparseData);
const SPARSE_PROGRAM=
  JSON.stringify(sparseProgram);

function snapshot(count,date){
  return JSON.stringify({
    recoveryFormatVersion:1,
    savedAt:date,
    source:"test",
    strings:{
      cfg:CFG,
      data:JSON.stringify(
        fullData(count)
      ),
      program:PROGRAM
    },
    legacyData:null
  });
}

function rawSet(dom,key,value){
  dom.window
    .__storageOriginalMethods
    .setItem.call(
      dom.window.localStorage,
      key,
      value
    );
}

const current=snapshot(
  10,
  "2026-08-11T12:00:00.000Z"
);

const previous=snapshot(
  9,
  "2026-08-10T12:00:00.000Z"
);

const older=snapshot(
  8,
  "2026-08-09T12:00:00.000Z"
);


/* generation selection */

const G=bootRaw({
  cfg:SPARSE_CFG,
  data:SPARSE_DATA,
  program:SPARSE_PROGRAM
});

rawSet(G,"forge:lkg",current);
rawSet(
  G,
  "forge:lkg:previous",
  previous
);
rawSet(
  G,
  "forge:lkg:older",
  older
);

const c=G.window.eval(
  `buildSelectedLkgRecoveryCandidate(
    "forge:lkg"
  )`
);

const p=G.window.eval(
  `buildSelectedLkgRecoveryCandidate(
    "forge:lkg:previous"
  )`
);

const o=G.window.eval(
  `buildSelectedLkgRecoveryCandidate(
    "forge:lkg:older"
  )`
);

check(
  "Current Previous Older selectable",
  c.ok &&
  p.ok &&
  o.ok &&
  c.lkgTier==="current" &&
  p.lkgTier==="previous" &&
  o.lkgTier==="older"
);

check(
  "selected generation stays exact",
  c.prepared.state.data.workouts.length===10 &&
  p.prepared.state.data.workouts.length===9 &&
  o.prepared.state.data.workouts.length===8
);


/* invalid generation isolation */

rawSet(
  G,
  "forge:lkg",
  "{broken-current"
);

check(
  "bad Current does not hide Previous",
  G.window.eval(`
    !buildSelectedLkgRecoveryCandidate(
      "forge:lkg"
    ).ok
    &&
    buildSelectedLkgRecoveryCandidate(
      "forge:lkg:previous"
    ).ok
  `)
);

rawSet(G,"forge:lkg",current);

const store=G.window.localStorage;
const proto=Object.getPrototypeOf(store);
const originalGet=proto.getItem;

proto.getItem=function(key){
  if(key==="forge:lkg:previous"){
    throw new Error(
      "simulated read failure"
    );
  }

  return originalGet.call(
    this,
    key
  );
};

const statuses=
  G.window.eval(
    `getStoredLkgStatuses()`
  );

proto.getItem=originalGet;

check(
  "one read failure does not collapse snapshots",
  statuses.length===3 &&
  statuses[0].ok===true &&
  statuses[1].ok===false &&
  statuses[1].code==="storage-read" &&
  statuses[2].ok===true
);


/* selected full-state snapshot restore */

const R=bootRaw({
  cfg:SPARSE_CFG,
  data:SPARSE_DATA,
  program:SPARSE_PROGRAM
});

rawSet(
  R,
  "forge:lkg:previous",
  previous
);

const before={
  cfg:R.window.localStorage.getItem(
    "forge:cfg"
  ),
  data:R.window.localStorage.getItem(
    "forge:data"
  ),
  program:
    R.window.localStorage.getItem(
      "forge:program"
    )
};

const restored=
  R.window.eval(`
    performRecoveryCandidate(
      buildSelectedLkgRecoveryCandidate(
        "forge:lkg:previous"
      ),
      {
        allowNormalRestore:true,
        replaceExistingQuarantine:true
      }
    )
  `);

check(
  "selected snapshot restore succeeds",
  restored.ok===true
);

check(
  "snapshot restores full BlackPyre state",
  R.window.eval(`
    data.workouts.length===9
    && data.activeWorkoutDraft
    && data.activeWorkoutDraft.day==="D1"
    && data.weights.length===2
    && data.food["2026-08-10"][0].name
         ==="Chicken breast"
    && data.water["2026-08-10"]===6
    && data.measure[0].waist===39.5
    && data.myFoods["recovery-food"].name
         ==="Recovery Meal"
    && data.myExercises[
         "u:recovery-carry"
       ].name==="Recovery Carry"
    && data.personalRecords
         .benchPress.value===225
    && data.futureUserRecords[0].value
         ==="preserve-me"
    && program.name
         ==="Recovered Full Program"
    && program.days.length===2
    && cfg.goalWt===168
    && cfg.unitSystem==="metric"
    && cfg.accent==="violet"
  `)
);

const quarantine=
  JSON.parse(
    R.window.localStorage.getItem(
      "forge:quarantine"
    )
  );

check(
  "pre-restore state preserved exactly",
  quarantine.originals.cfg
    ===before.cfg &&
  quarantine.originals.data
    ===before.data &&
  quarantine.originals.program
    ===before.program
);


/* affected-user export / restore */

const E=bootRaw({
  cfg:CFG,
  data:JSON.stringify(
    fullData(10)
  ),
  program:PROGRAM
});

E.window.eval(`
  window.__exported=null;

  download=(name,content)=>{
    window.__exported=content;
  };

  doBackup(
    "exportDataBtn"
  );
`);

const exported=
  JSON.parse(
    E.window.eval(
      `window.__exported`
    )
  );

check(
  "export contains complete BlackPyre state",
  exported.cfg &&
  exported.data &&
  exported.program &&
  exported.data.workouts.length===10 &&
  exported.data.activeWorkoutDraft &&
  exported.data.weights.length===2 &&
  exported.data.food["2026-08-10"] &&
  exported.data.water["2026-08-10"]===6 &&
  exported.data.measure.length===1 &&
  exported.data.myFoods["recovery-food"] &&
  exported.data.myExercises[
    "u:recovery-carry"
  ] &&
  exported.data.personalRecords &&
  exported.data.futureUserRecords &&
  exported.program.days.length===2
);

rawSet(E,"forge:cfg",SPARSE_CFG);
rawSet(E,"forge:data",SPARSE_DATA);
rawSet(
  E,
  "forge:program",
  SPARSE_PROGRAM
);

const restoreExport=
  E.window.eval(
    `restoreBackupEnvelope(
      ${JSON.stringify(exported)}
    )`
  );

check(
  "full-state export restores successfully",
  restoreExport.ok===true
);

check(
  "affected-user restore returns every category",
  E.window.eval(`
    data.workouts.length===10
    && data.activeWorkoutDraft
    && data.weights.length===2
    && data.food["2026-08-10"][0].name
         ==="Chicken breast"
    && data.water["2026-08-10"]===6
    && data.measure[0].waist===39.5
    && data.myFoods["recovery-food"]
    && data.myExercises[
         "u:recovery-carry"
       ]
    && data.personalRecords
         .benchPress.value===225
    && data.futureUserRecords[0].value
         ==="preserve-me"
    && program.name
         ==="Recovered Full Program"
    && cfg.goalWt===168
  `)
);

check(
  "unknown future user records survive recovery",
  E.window.eval(`
    data.futureUserRecords[0].type
      ==="future-record"
    &&
    data.futureUserRecords[0].value
      ==="preserve-me"
  `)
);

check(
  "invalid snapshot key rejected",
  E.window.eval(`
    buildSelectedLkgRecoveryCandidate(
      "forge:lkg:not-real"
    ).code==="snapshot-key"
  `)
);

summary(
  "PHASE 2 FULL-STATE RECOVERY SAFETY"
);
