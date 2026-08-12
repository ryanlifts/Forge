const {
  bootRaw,
  EXISTING_CFG,
  EMPTY_DATA,
  check,
  summary
}=require("./harness");

const CFG=
  Object.assign(
    {},
    EXISTING_CFG,
    {
      schemaVersion:3,
      setupDone:true,
      goalWt:168,
      unitSystem:"imperial",
      accent:"violet",
      waterOn:true,
      measureOn:true,
      foodHandoffOn:false,
      autoProgressionOn:true,
      foodSuggestionsOn:true,
      foodSuggestionsWeightLoss:false,
      foodSuggestionsAvoid:"shellfish"
    }
  );

const CUSTOM_EXERCISE={
  id:"u:recovery-carry",
  name:"Recovery Carry",
  shape:"carry",
  tags:["carry"],
  aliases:[],
  formerNames:[],
  muscles:{
    primary:[],
    secondary:[]
  },
  equipment:[
    "dumbbell"
  ],
  unilateral:false,
  bodyweight:false,
  deprecated:false
};

function workouts(count){
  return Array.from(
    {length:count},
    (_,i)=>({
      date:
        "2026-07-"
        +String(i+1).padStart(2,"0"),

      title:
        "Workout "+(i+1),

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

const DATA=
  Object.assign(
    {},
    EMPTY_DATA,
    {
      workouts:
        workouts(10),

      activeWorkoutDraft:{
        date:"2026-08-11",
        day:"D1",
        sets:{
          "Bench Press":[
            {
              w:155,
              r:5
            }
          ]
        }
      },

      weights:[
        {
          date:"2026-08-01",
          time:"07:30",
          lbs:219
        },
        {
          date:"2026-08-08",
          time:"07:35",
          lbs:216.5
        }
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
          name:"Ryan Recovery Meal",
          cal:500,
          pro:40,
          carb:50,
          fat:15
        }
      },

      myExercises:{
        "u:recovery-carry":
          CUSTOM_EXERCISE
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

const PROGRAM={
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


/* ========================================
   ESTABLISHED APP BEFORE UPDATE
   ======================================== */

const Before=
  bootRaw({
    cfg:
      JSON.stringify(CFG),

    data:
      JSON.stringify(DATA),

    program:
      JSON.stringify(PROGRAM)
  });

check(
  "representative established state boots healthy",

  Before.window.eval(
    "protectedMode===false"
  )
);

check(
  "pre-update workout history is present",

  Before.window.eval(
    "data.workouts.length===10"
  )
);

check(
  "pre-update workout draft is present",

  Before.window.eval(`
    data.activeWorkoutDraft
    && data.activeWorkoutDraft.day==="D1"
    && data.activeWorkoutDraft.sets[
         "Bench Press"
       ][0].w===155
  `)
);

check(
  "pre-update weight history is present",

  Before.window.eval(`
    data.weights.length===2
    && data.weights[1].lbs===216.5
  `)
);

check(
  "pre-update food history is present",

  Before.window.eval(`
    data.food["2026-08-10"]
    && data.food["2026-08-10"][0].name
         ==="Chicken breast"
  `)
);

check(
  "pre-update water history is present",

  Before.window.eval(`
    data.water["2026-08-10"]===6
    && data.water["2026-08-11"]===2
  `)
);

check(
  "pre-update measurements are present",

  Before.window.eval(`
    data.measure.length===1
    && data.measure[0].waist===39.5
  `)
);

check(
  "pre-update My Foods are present",

  Before.window.eval(`
    data.myFoods["recovery-food"]
    && data.myFoods[
         "recovery-food"
       ].name==="Ryan Recovery Meal"
  `)
);

check(
  "pre-update custom exercises are present",

  Before.window.eval(`
    data.myExercises[
      "u:recovery-carry"
    ]
    && data.myExercises[
         "u:recovery-carry"
       ].name==="Recovery Carry"
  `)
);

check(
  "pre-update personal records are present",

  Before.window.eval(`
    data.personalRecords
    && data.personalRecords
         .benchPress.value===225
  `)
);

check(
  "pre-update future user-generated records are present",

  Before.window.eval(`
    Array.isArray(
      data.futureUserRecords
    )
    && data.futureUserRecords[0].value
         ==="preserve-me"
  `)
);

check(
  "pre-update program is present",

  Before.window.eval(`
    program.name==="Recovered Full Program"
    && program.days.length===2
  `)
);

check(
  "pre-update settings are present",

  Before.window.eval(`
    cfg.goalWt===168
    && cfg.unitSystem==="imperial"
    && cfg.accent==="violet"
    && cfg.foodHandoffOn===false
    && cfg.autoProgressionOn===true
    && cfg.foodSuggestionsOn===true
  `)
);


/*
  These are the exact persisted primary bytes
  an installed user's device would retain while
  the application bundle itself is updated.
*/

const BEFORE_CFG=
  Before.window.localStorage
    .getItem(
      "forge:cfg"
    );

const BEFORE_DATA=
  Before.window.localStorage
    .getItem(
      "forge:data"
    );

const BEFORE_PROGRAM=
  Before.window.localStorage
    .getItem(
      "forge:program"
    );


/* ========================================
   SIMULATED NORMAL APP UPDATE
   ======================================== */

const After=
  bootRaw({
    cfg:BEFORE_CFG,
    data:BEFORE_DATA,
    program:BEFORE_PROGRAM
  });

check(
  "post-update launch remains healthy",

  After.window.eval(
    "protectedMode===false"
  )
);

check(
  "normal native update-like launch leaves cfg byte-identical",

  After.window.localStorage
    .getItem(
      "forge:cfg"
    )===BEFORE_CFG
);

check(
  "normal native update-like launch leaves data byte-identical",

  After.window.localStorage
    .getItem(
      "forge:data"
    )===BEFORE_DATA
);

check(
  "normal native update-like launch leaves program byte-identical",

  After.window.localStorage
    .getItem(
      "forge:program"
    )===BEFORE_PROGRAM
);


/* ========================================
   POST-UPDATE CATEGORY SURVIVAL
   ======================================== */

check(
  "update preserves workout history",

  After.window.eval(`
    data.workouts.length===10
    && data.workouts[0]
         .sets["Bench Press"][0].r===5
  `)
);

check(
  "update preserves active workout draft",

  After.window.eval(`
    data.activeWorkoutDraft
    && data.activeWorkoutDraft.day==="D1"
    && data.activeWorkoutDraft
         .sets["Bench Press"][0].w===155
  `)
);

check(
  "update preserves weight history",

  After.window.eval(`
    data.weights.length===2
    && data.weights[1].lbs===216.5
  `)
);

check(
  "update preserves food history",

  After.window.eval(`
    data.food["2026-08-10"]
    && data.food["2026-08-10"][0].name
         ==="Chicken breast"
  `)
);

check(
  "update preserves water history",

  After.window.eval(`
    data.water["2026-08-10"]===6
    && data.water["2026-08-11"]===2
  `)
);

check(
  "update preserves measurements",

  After.window.eval(`
    data.measure.length===1
    && data.measure[0].waist===39.5
  `)
);

check(
  "update preserves My Foods",

  After.window.eval(`
    data.myFoods["recovery-food"]
    && data.myFoods[
         "recovery-food"
       ].name==="Ryan Recovery Meal"
  `)
);

check(
  "update preserves custom exercises",

  After.window.eval(`
    data.myExercises[
      "u:recovery-carry"
    ]
    && data.myExercises[
         "u:recovery-carry"
       ].name==="Recovery Carry"
  `)
);

check(
  "update preserves personal records",

  After.window.eval(`
    data.personalRecords
    && data.personalRecords
         .benchPress.value===225
  `)
);

check(
  "update preserves future user-generated records",

  After.window.eval(`
    Array.isArray(
      data.futureUserRecords
    )
    && data.futureUserRecords[0].type
         ==="future-record"
    && data.futureUserRecords[0].value
         ==="preserve-me"
  `)
);

check(
  "update preserves program",

  After.window.eval(`
    program.name==="Recovered Full Program"
    && program.days.length===2
    && program.days[0]
         .exercises[0].name
         ==="Bench Press"
  `)
);

check(
  "update preserves settings and preferences",

  After.window.eval(`
    cfg.goalWt===168
    && cfg.unitSystem==="imperial"
    && cfg.accent==="violet"
    && cfg.foodHandoffOn===false
    && cfg.autoProgressionOn===true
    && cfg.foodSuggestionsOn===true
  `)
);

summary(
  "PHASE 4 NATIVE UPDATE SAFETY"
);
