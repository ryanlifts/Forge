const {
  bootRaw,
  EXISTING_CFG,
  EMPTY_DATA,
  check,
  summary
}=require("./harness");

const CFG=JSON.stringify(
  Object.assign(
    {},
    EXISTING_CFG,
    {
      schemaVersion:3,
      waterOn:true
    }
  )
);

const PROGRAM=JSON.stringify({
  name:"Phase 3",
  days:[{
    id:"D1",
    title:"Day 1",
    exercises:[{
      name:"Bench Press",
      scheme:"3×5"
    }]
  }]
});

function workouts(count){
  return Array.from(
    {length:count},
    (_,i)=>({
      date:
        "2026-07-"
        +String(i+1).padStart(2,"0"),
      title:"Session "+(i+1),
      sets:{
        "Bench Press":[
          {
            w:135+i,
            r:5
          }
        ]
      }
    })
  );
}

function validData(count){
  return Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:workouts(count),
      activeWorkoutDraft:null,
      myExercises:{}
    }
  );
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

function rawRemove(dom,key){
  dom.window
    .__storageOriginalMethods
    .removeItem.call(
      dom.window.localStorage,
      key
    );
}

function snapshot(count,savedAt){
  const data=
    Object.assign(
      {},
      validData(count),
      {
        food:{
          "2026-08-10":[{
            name:"Chicken",
            cal:165,
            pro:31,
            carb:0,
            fat:4,
            meal:"lunch"
          }]
        },

        water:{
          "2026-08-10":2
        },

        weights:[
          {
            date:"2026-08-10",
            lbs:218
          }
        ],

        measure:[
          {
            date:"2026-08-10",
            waist:39
          }
        ]
      }
    );

  return JSON.stringify({
    recoveryFormatVersion:1,
    savedAt:savedAt,
    source:"phase3-test",
    strings:{
      cfg:CFG,
      data:JSON.stringify(data),
      program:PROGRAM
    },
    legacyData:null
  });
}


/* authoritative History */

const H=bootRaw({
  cfg:CFG,
  data:JSON.stringify(
    validData(10)
  ),
  program:PROGRAM
});

H.window.eval(`
  data.workouts=[];
  renderWork();
`);

check(
  "History reloads authoritative persisted workouts instead of stale empty memory",

  H.window.eval(
    "data.workouts.length"
  )===10

  && H.window.document
       .getElementById(
         "workHistoryCount"
       )
       .textContent
       .includes("10 sessions")
);


const malformed=
  validData(3);

malformed.workouts[1]={
  date:"2026-07-02",
  sets:{
    "Bench Press":[
      {
        impossible:true
      }
    ]
  }
};

rawSet(
  H,
  "forge:data",
  JSON.stringify(malformed)
);

H.window.eval(`
  data.workouts=[];
  renderWork();
`);

check(
  "one malformed saved workout cannot blank valid History",

  H.window.document
    .getElementById(
      "workHistoryCount"
    )
    .textContent
    .includes("2 sessions")

  && H.window.document
       .getElementById(
         "workHistory"
       )
       .textContent
       .includes(
         "could not be displayed safely"
       )
);


/* resume reconciliation */

const Resume=bootRaw({
  cfg:CFG,
  data:JSON.stringify(
    validData(2)
  ),
  program:PROGRAM
});

rawSet(
  Resume,
  "forge:data",
  JSON.stringify(
    validData(7)
  )
);

Resume.window.eval(
  "data.workouts=[]"
);

Resume.window.dispatchEvent(
  new Resume.window.Event(
    "pageshow"
  )
);

check(
  "foreground/pageshow reconciliation refreshes History",

  Resume.window.eval(
    "data.workouts.length"
  )===7

  && Resume.window.document
       .getElementById(
         "workHistoryCount"
       )
       .textContent
       .includes("7 sessions")
);


/* Water */

const W=bootRaw({
  cfg:CFG,
  data:JSON.stringify(
    Object.assign(
      {},
      validData(0),
      {
        water:{
          "2026-08-01":0,
          "2026-08-02":1,
          "2026-08-03":2
        }
      }
    )
  ),
  program:PROGRAM
});

const today=
  W.window.eval(
    "todayStr()"
  );

W.window.eval(`
  data.water[${JSON.stringify(today)}]=0;
  renderWater();
`);

check(
  "Water main card renders zero plural",

  W.window.document
    .getElementById(
      "waterCount"
    ).textContent==="0"

  && W.window.document
       .getElementById(
         "waterUnitToday"
       ).textContent
       ==="GLASSES TODAY"
);

W.window.eval(`
  data.water[${JSON.stringify(today)}]=1;
  renderWater();
`);

check(
  "Water main card renders exact singular",

  W.window.document
    .getElementById(
      "waterUnitToday"
    ).textContent
    ==="GLASS TODAY"
);

W.window.eval(`
  data.water[${JSON.stringify(today)}]=2;
  renderWater();
`);

check(
  "Water main card renders plural above one",

  W.window.document
    .getElementById(
      "waterUnitToday"
    ).textContent
    ==="GLASSES TODAY"
);

const waterHistory=
  W.window.document
    .getElementById(
      "waterHistory"
    ).textContent;

check(
  "Water History keeps zero and exact 0/1/2 grammar",

  waterHistory.includes(
    "0 GLASSES"
  )
  && waterHistory.includes(
    "1 GLASS"
  )
  && waterHistory.includes(
    "2 GLASSES"
  )
);


/* recovery selector */

const R=bootRaw({
  cfg:CFG,
  data:JSON.stringify(
    validData(3)
  ),
  program:PROGRAM
});

rawSet(
  R,
  "forge:lkg",
  snapshot(
    3,
    "2026-08-11T12:00:00.000Z"
  )
);

rawSet(
  R,
  "forge:lkg:previous",
  snapshot(
    2,
    "2026-08-10T12:00:00.000Z"
  )
);

rawSet(
  R,
  "forge:lkg:older",
  snapshot(
    1,
    "2026-08-09T12:00:00.000Z"
  )
);

R.window.eval(`
  selectedSettingsRecoveryKey="";
  renderRecoveryStatus();
`);

const settingsSelect=
  R.window.document
    .getElementById(
      "settingsRecoverySnapshotSelect"
    );

const optionText=
  [...settingsSelect.options]
    .map(
      option=>option.textContent
    );

check(
  "Recovery selector is compact Current Previous Older with dates only",

  optionText.length===4

  && optionText[1].startsWith(
       "Current recovery — "
     )

  && optionText[2].startsWith(
       "Previous recovery — "
     )

  && optionText[3].startsWith(
       "Older recovery — "
     )

  && !optionText
       .slice(1)
       .join(" ")
       .toLowerCase()
       .includes("workout")
);

check(
  "Recovery restore remains disabled until explicit selection",

  R.window.document
    .getElementById(
      "restoreSnapshotBtn"
    ).disabled===true
);

settingsSelect.value=
  "forge:lkg:previous";

settingsSelect.dispatchEvent(
  new R.window.Event(
    "change",
    {
      bubbles:true
    }
  )
);

const settingsDetails=
  R.window.document
    .getElementById(
      "settingsRecoverySnapshotDetails"
    );

check(
  "selected recovery opens truthful contents details",

  !settingsDetails
    .classList
    .contains("hidden")

  && settingsDetails
       .textContent
       .includes("2 workouts")

  && settingsDetails
       .textContent
       .includes("food")

  && settingsDetails
       .textContent
       .includes("water")

  && settingsDetails
       .textContent
       .includes("program")

  && settingsDetails
       .textContent
       .includes("settings")
);

check(
  "selected valid snapshot enables restore",

  R.window.document
    .getElementById(
      "restoreSnapshotBtn"
    ).disabled===false
);


/* confirmation */

R.window.eval(`
  window.__phase3Confirm="";

  confirm=(message)=>{
    window.__phase3Confirm=message;
    return false;
  };
`);

R.window.document
  .getElementById(
    "restoreSnapshotBtn"
  )
  .dispatchEvent(
    new R.window.Event(
      "click",
      {
        bubbles:true
      }
    )
  );

check(
  "snapshot confirmation explicitly says full state and current preservation",

  R.window.eval(
    "window.__phase3Confirm"
  ).includes(
    "FULL saved state"
  )

  && R.window.eval(
       "window.__phase3Confirm"
     ).includes(
       "exact current state"
     )
);


/* protected recovery */

R.window.eval(`
  protectedMode=true;
  protectedModeKind="failure";
  protectedModeReason="Phase 3 test";

  protectedModeDiagnostic={
    stage:"validation",
    part:"data",
    code:"test",
    reason:"Phase 3 test"
  };

  selectedProtectedRecoveryKey="";
  renderRecoveryPanel();
`);

check(
  "Protected recovery does not silently auto-select a generation",

  R.window.document
    .getElementById(
      "recoverySnapshotSelect"
    ).value===""

  && R.window.document
       .getElementById(
         "recoverLkgBtn"
       ).disabled===true
);

const protectedSelect=
  R.window.document
    .getElementById(
      "recoverySnapshotSelect"
    );

protectedSelect.value=
  "forge:lkg:older";

protectedSelect.dispatchEvent(
  new R.window.Event(
    "change",
    {
      bubbles:true
    }
  )
);

check(
  "Protected recovery shows details only after explicit selection",

  !R.window.document
    .getElementById(
      "recoverySnapshotDetails"
    )
    .classList
    .contains("hidden")

  && R.window.document
       .getElementById(
         "recoverySnapshotDetails"
       )
       .textContent
       .includes("1 workout")

  && R.window.document
       .getElementById(
         "recoverLkgBtn"
       ).disabled===false
);


/* no snapshots */

rawRemove(
  R,
  "forge:lkg"
);

rawRemove(
  R,
  "forge:lkg:previous"
);

rawRemove(
  R,
  "forge:lkg:older"
);

R.window.eval(`
  protectedMode=false;
  selectedSettingsRecoveryKey="";
  renderRecoveryStatus();
`);

const meta=
  R.window.document
    .getElementById(
      "snapshotMetaLine"
    ).textContent;

check(
  "no-snapshot message reports current saved data independently",

  meta.includes(
    "No validated recovery snapshots"
  )

  && meta.includes(
    "Current saved data:"
  )
);

summary(
  "PHASE 3 HISTORY + RECOVERY UI + WATER"
);
