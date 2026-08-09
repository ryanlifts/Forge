"use strict";

const fs=require("fs");
const path=require("path");
const profileData=require("../data-exercise-card-profiles.js");
const {createEngine}=require("../scripts/03-card-profiles.js");

const engine=createEngine(profileData);
let passed=0;
let failed=0;

function check(name,condition){
  if (condition){
    passed+=1;
    console.log("PASS:",name);
  } else {
    failed+=1;
    console.error("FAIL:",name);
  }
}

function same(a,b){
  return JSON.stringify(a)===JSON.stringify(b);
}

function findMatchingBrace(text,opening){
  let depth=0;
  let state="code";
  let escaped=false;

  for (let i=opening;i<text.length;i+=1){
    const char=text[i];
    const next=text[i+1]||"";

    if (state==="line"){
      if (char==="\n") state="code";
      continue;
    }

    if (state==="block"){
      if (char==="*" && next==="/"){
        state="code";
        i+=1;
      }
      continue;
    }

    if (state==="single" || state==="double" || state==="template"){
      if (escaped){
        escaped=false;
      } else if (char==="\\"){
        escaped=true;
      } else if (
        (state==="single" && char==="'")
        || (state==="double" && char==='"')
        || (state==="template" && char==="`")
      ){
        state="code";
      }
      continue;
    }

    if (char==="/" && next==="/"){
      state="line";
      i+=1;
    } else if (char==="/" && next==="*"){
      state="block";
      i+=1;
    } else if (char==="'"){
      state="single";
    } else if (char==='"'){
      state="double";
    } else if (char==="`"){
      state="template";
    } else if (char==="{"){
      depth+=1;
    } else if (char==="}"){
      depth-=1;
      if (depth===0) return i;
    }
  }

  return -1;
}

function parseCanonicalExercises(){
  const source=fs.readFileSync(
    path.join(__dirname,"..","data-exercises.js"),
    "utf8"
  );
  const byId=new Map();

  for (let index=0;index<source.length;index+=1){
    const opening=source.indexOf("{",index);
    if (opening<0) break;
    const closing=findMatchingBrace(source,opening);
    if (closing<0) break;
    const candidate=source.slice(opening,closing+1);

    if (
      candidate.includes('"id"')
      && candidate.includes('"name"')
      && candidate.includes('"shape"')
    ){
      try {
        const parsed=JSON.parse(candidate);
        if (
          parsed
          && typeof parsed==="object"
          && parsed.id
          && parsed.name
          && parsed.shape
        ){
          byId.set(String(parsed.id),parsed);
        }
      } catch (_error) {}
    }

    index=opening;
  }

  return [...byId.values()];
}

const canonical=parseCanonicalExercises();
check("203 active canonical exercises are parsed",canonical.length===203);
check("203 profile assignments exist",Object.keys(profileData.assignments).length===203);

const exhaustive={
  assignment:true,
  allowedShape:true,
  renderer:true,
  validator:true,
  savedValue:true,
  draftSerialization:true,
  draftRestoration:true,
  editRestoration:true,
  historyFormatting:true,
  replacement:true
};
const exhaustiveProblems=[];

canonical.forEach(exercise=>{
  const assignment=profileData.assignments[String(exercise.id)];

  if (!assignment){
    exhaustive.assignment=false;
    exhaustiveProblems.push(exercise.name+": missing assignment");
    return;
  }

  const definition=profileData.profileDefinitions[assignment.profile];
  const runtime=engine.runtimeContract(assignment.profile);

  if (
    !definition
    || !Array.isArray(definition.allowedShapes)
    || !definition.allowedShapes.includes(exercise.shape)
  ){
    exhaustive.allowedShape=false;
    exhaustiveProblems.push(exercise.name+": invalid profile/shape");
  }

  if (!runtime || typeof runtime.renderer!=="string"){
    exhaustive.renderer=false;
    exhaustiveProblems.push(exercise.name+": missing renderer");
  }
  if (!runtime || typeof runtime.validator!=="string"){
    exhaustive.validator=false;
    exhaustiveProblems.push(exercise.name+": missing validator");
  }
  if (!runtime || typeof runtime.savedValueContract!=="string"){
    exhaustive.savedValue=false;
    exhaustiveProblems.push(exercise.name+": missing saved-value contract");
  }
  if (!runtime || typeof runtime.draftSerializer!=="string"){
    exhaustive.draftSerialization=false;
    exhaustiveProblems.push(exercise.name+": missing draft serializer");
  }
  if (!runtime || typeof runtime.draftRestorer!=="string"){
    exhaustive.draftRestoration=false;
    exhaustiveProblems.push(exercise.name+": missing draft restorer");
  }
  if (!runtime || typeof runtime.editRestorer!=="string"){
    exhaustive.editRestoration=false;
    exhaustiveProblems.push(exercise.name+": missing edit restorer");
  }
  if (!runtime || typeof runtime.historyFormatter!=="string"){
    exhaustive.historyFormatting=false;
    exhaustiveProblems.push(exercise.name+": missing history formatter");
  }
  if (!runtime || typeof runtime.replacementFamily!=="string"){
    exhaustive.replacement=false;
    exhaustiveProblems.push(exercise.name+": missing replacement family");
  }
});

check("all canonical exercises have assignments",exhaustive.assignment);
check("all profiles accept their canonical public shapes",exhaustive.allowedShape);
check("all canonical exercises have registered renderers",exhaustive.renderer);
check("all canonical exercises have validators",exhaustive.validator);
check("all canonical exercises have saved-value contracts",exhaustive.savedValue);
check("all canonical exercises have draft serialization",exhaustive.draftSerialization);
check("all canonical exercises have draft restoration",exhaustive.draftRestoration);
check("all canonical exercises have edit restoration",exhaustive.editRestoration);
check("all canonical exercises have history formatting",exhaustive.historyFormatting);
check("all canonical exercises have replacement rules",exhaustive.replacement);

if (exhaustiveProblems.length){
  console.error(exhaustiveProblems.join("\n"));
}

function assignmentByName(name){
  return Object.values(profileData.assignments)
    .find(item=>item.name===name);
}

const expectedProfiles={
  "Bench Press":"strengthSets",
  "Push-Up":"repetitionSets",
  "Plank":"timedHold",
  "Run":"steadyTimeDistance",
  "Yoga":"durationActivity",
  "Sprinting":"timedIntervals",
  "Shuttle Runs":"distanceIntervals",
  "Farmer Carry":"loadedDistance",
  "EMOM Conditioning":"conditioningRounds",
  "Physical Therapy":"activityNotes"
};

Object.entries(expectedProfiles).forEach(([name,profile])=>{
  const assignment=assignmentByName(name);
  check(name+" uses "+profile,assignment && assignment.profile===profile);
});

const emptyCases=[
  ["timedHold",{}],
  ["steadyTimeDistance",{}],
  ["durationActivity",{}],
  ["timedIntervals",{}],
  ["distanceIntervals",{}],
  ["loadedDistance",{}],
  ["conditioningRounds",{}],
  ["activityNotes",{}]
];

emptyCases.forEach(([profile,draft])=>{
  check(profile+" rejects an empty card",engine.validate(profile,draft).ok===false);
});

const sprintDraft=engine.prefill("timedIntervals",{
  intervals:8,
  durationSeconds:15,
  recoverySeconds:75
});
check(
  "Sprinting prescription prefills interval count, work and recovery",
  sprintDraft.intervals===8
    && sprintDraft.workMinutes===0
    && sprintDraft.workSeconds===15
    && sprintDraft.recoverySeconds===75
);
const sprintSaved=engine.validate("timedIntervals",sprintDraft);
check(
  "Sprinting valid entry saves every field",
  sprintSaved.ok
    && same(sprintSaved.value,{
      t:"timedIntervals",
      intervals:8,
      workSecs:15,
      recSecs:75
    })
);
check(
  "Sprinting draft restoration recreates the editor",
  same(
    engine.fromStored("timedIntervals",JSON.parse(JSON.stringify(sprintSaved.value))),
    sprintDraft
  )
);
check(
  "Sprinting history clearly formats completed work",
  engine.formatStored(sprintSaved.value)
    ==="8 intervals · 15 sec each · 1m 15s recovery"
);

const plankDraft=engine.prefill("timedHold",{
  sets:3,
  durationSeconds:60
});
check(
  "Plank prescription prefills three holds of 60 seconds",
  plankDraft.holds===3
    && plankDraft.holdMinutes===1
    && plankDraft.holdSeconds===0
);
const plankSaved=engine.validate("timedHold",plankDraft);
check(
  "Plank saves a timed-hold value",
  plankSaved.ok
    && plankSaved.value.t==="timedHold"
    && plankSaved.value.holds===3
    && plankSaved.value.holdSecs===60
);
check(
  "Legacy Plank time/distance history remains editable",
  engine.fromStored("timedHold",{t:"timeDist",secs:60}).holds===1
);

const runDraft=engine.prefill("steadyTimeDistance",{
  durationSeconds:1800,
  distance:5,
  distanceUnit:"km",
  pace:"easy"
});

const stationaryIntervals=engine.resolve(
  {id:"bp:stationary-cycling",shape:"timeDist"},
  {intervals:10,durationSeconds:60,recoverySeconds:60}
);
check(
  "steady cardio with timed interval prescription selects timedIntervals",
  stationaryIntervals.profile==="timedIntervals"
    && stationaryIntervals.source==="prescription-intervals"
);

const runDistanceRepeats=engine.resolve(
  {id:"bp:run",shape:"timeDist"},
  {intervals:6,distance:400,distanceUnit:"m",recoverySeconds:90}
);
check(
  "steady cardio with distance-repeat prescription selects distanceIntervals",
  runDistanceRepeats.profile==="distanceIntervals"
    && runDistanceRepeats.source==="prescription-distance-intervals"
);

check(
  "steady cardio without interval count keeps canonical profile",
  engine.resolve(
    {id:"bp:stationary-cycling",shape:"timeDist"},
    {durationSeconds:1800,distance:8,distanceUnit:"mi"}
  ).profile==="steadyTimeDistance"
);

check(
  "dedicated Sprinting assignment remains timedIntervals",
  engine.resolve(
    {id:"bp:sprinting",shape:"timeDist"},
    {durationSeconds:20}
  ).profile==="timedIntervals"
);
const runSaved=engine.validate("steadyTimeDistance",runDraft);
check(
  "Run preserves time, distance, unit and pace",
  runSaved.ok
    && runSaved.value.secs===1800
    && runSaved.value.dist===5
    && runSaved.value.distUnit==="km"
    && runSaved.value.pace==="easy"
);
check(
  "Legacy Run timeDist remains readable",
  engine.fromStored("steadyTimeDistance",{
    t:"timeDist",
    secs:1200,
    dist:2,
    distUnit:"mi"
  }).distance===2
);

const shuttleDraft=engine.prefill("distanceIntervals",{
  intervals:10,
  distance:20,
  distanceUnit:"yd",
  recoverySeconds:45
});
const shuttleSaved=engine.validate("distanceIntervals",shuttleDraft);
check(
  "Distance repeats preserve repeat count, distance and recovery",
  shuttleSaved.ok
    && shuttleSaved.value.repeats===10
    && shuttleSaved.value.dist===20
    && shuttleSaved.value.recSecs===45
);

const carryDraft=engine.prefill("loadedDistance",{
  trips:4,
  weight:80,
  distance:40,
  distanceUnit:"yd",
  durationSeconds:30,
  restSeconds:60
});
const carrySaved=engine.validate("loadedDistance",carryDraft);
check(
  "Loaded carry preserves count, load, distance, duration and recovery",
  carrySaved.ok
    && carrySaved.value.count===4
    && carrySaved.value.lbs===80
    && carrySaved.value.dist===40
    && carrySaved.value.secs===30
    && carrySaved.value.recSecs===60
);
check(
  "Legacy carry values remain readable",
  engine.fromStored("loadedDistance",{
    t:"carry",
    lbs:50,
    dist:30,
    distUnit:"yd"
  }).lbs===50
);

const roundsDraft=engine.prefill("conditioningRounds",{
  rounds:5,
  workSeconds:60,
  recoverySeconds:30,
  notes:"three movements"
});
const roundsSaved=engine.validate("conditioningRounds",roundsDraft);
check(
  "Conditioning rounds preserve rounds, work, recovery and notes",
  roundsSaved.ok
    && roundsSaved.value.rounds===5
    && roundsSaved.value.workSecs===60
    && roundsSaved.value.recSecs===30
    && roundsSaved.value.note==="three movements"
);
check(
  "Legacy rounds remain readable",
  engine.fromStored("conditioningRounds",{
    t:"rounds",
    rounds:3,
    workSecs:40,
    recSecs:20,
    note:"legacy"
  }).rounds===3
);

const yogaDraft=engine.prefill("durationActivity",{
  durationSeconds:2700,
  notes:"mobility and breathing"
});
const yogaSaved=engine.validate("durationActivity",yogaDraft);
check(
  "Duration activity preserves duration and notes",
  yogaSaved.ok
    && yogaSaved.value.secs===2700
    && yogaSaved.value.note==="mobility and breathing"
);

const customTimeResolution=engine.resolve({
  id:"u:pickup-basketball",
  name:"Pickup Basketball",
  shape:"duration"
});
const customTimeFields=engine.fields(
  customTimeResolution.profile,
  customTimeResolution.options
);
check(
  "Custom Time exercises use duration-only tracking",
  customTimeResolution.profile==="durationActivity"
    && customTimeResolution.options.timeOnly===true
    && customTimeFields.map(field=>field.key).join(",")==="hours,minutes,seconds"
    && !customTimeFields.some(field=>field.required)
);
const customTimeSaved=engine.validate("durationActivity",{
  hours:"1",
  minutes:"15",
  seconds:"0",
  note:""
});
check(
  "Custom Time duration saves in the existing duration contract",
  customTimeSaved.ok
    && customTimeSaved.value.t==="durationActivity"
    && customTimeSaved.value.secs===4500
    && !Object.prototype.hasOwnProperty.call(customTimeSaved.value,"note")
);

const therapyDraft=engine.prefill("activityNotes",{
  durationSeconds:1200,
  notes:"completed prescribed knee work"
});
const therapySaved=engine.validate("activityNotes",therapyDraft);
check(
  "Activity notes preserve optional duration and required details",
  therapySaved.ok
    && therapySaved.value.secs===1200
    && therapySaved.value.note==="completed prescribed knee work"
);
check(
  "Legacy text activity remains readable",
  engine.fromStored("activityNotes","legacy rehabilitation notes").note
    ==="legacy rehabilitation notes"
);

check(
  "Bodyweight repetition card hides weight",
  assignmentByName("Ab Wheel").options.weightPolicy==="hidden"
);
check(
  "Weighted repetition card permits optional weight",
  assignmentByName("Push-Up").options.weightPolicy==="optional"
);
check(
  "Assisted Pull-Up labels the optional value as assistance",
  assignmentByName("Assisted Pull-Up").options.weightLabel==="Assistance"
);

const bodyweightRows=engine.validateRows(
  "repetitionSets",
  [{w:"",r:12,touched:true}],
  {weightPolicy:"hidden"}
);
check(
  "Bodyweight repetition save omits weight",
  bodyweightRows.ok && same(bodyweightRows.value,[{r:12}])
);

const weightedRows=engine.validateRows(
  "strengthSets",
  [{w:225,r:5,touched:true}],
  {weightPolicy:"required"}
);
check(
  "Weighted strength save requires and preserves weight",
  weightedRows.ok && same(weightedRows.value,[{w:225,r:5}])
);

check(
  "Missing strength weight is rejected",
  engine.validateRows(
    "strengthSets",
    [{w:"",r:5,touched:true}],
    {weightPolicy:"required"}
  ).ok===false
);


const exactLegacyStrengthRow=engine.validateRows(
  "strengthSets",
  [{
    w:225,
    r:5,
    touched:true
  }],
  {weightPolicy:"required"}
);
check(
  "Flexible-set contract preserves exact legacy strength serialization",
  exactLegacyStrengthRow.ok
    && JSON.stringify(exactLegacyStrengthRow.value)
       ==='[{"w":225,"r":5}]'
);

const exactLegacyBodyweightRow=engine.validateRows(
  "repetitionSets",
  [{
    w:"",
    r:12,
    touched:true
  }],
  {weightPolicy:"hidden"}
);
check(
  "Flexible-set contract preserves exact legacy bodyweight serialization",
  exactLegacyBodyweightRow.ok
    && JSON.stringify(exactLegacyBodyweightRow.value)
       ==='[{"r":12}]'
);

const unresolvedPrescribedRows=engine.validateRows(
  "strengthSets",
  [{
    w:185,
    r:8,
    touched:false,
    prescribed:true
  }],
  {weightPolicy:"required"}
);
check(
  "Untouched prescribed set remains a plan until session completion",
  unresolvedPrescribedRows.ok===true
    && unresolvedPrescribedRows.value===null
);

const missedStrengthRows=engine.validateRows(
  "strengthSets",
  [{
    w:185,
    r:0,
    touched:true,
    prescribed:true,
    status:"missed",
    reason:"fatigue"
  }],
  {weightPolicy:"required"}
);
check(
  "Missed strength set preserves load zero reps and reason",
  missedStrengthRows.ok
    && JSON.stringify(
         missedStrengthRows.value
       )===JSON.stringify([
         {
           w:185,
           r:0,
           status:"missed",
           reason:"fatigue"
         }
       ])
);

const skippedRows=engine.validateRows(
  "strengthSets",
  [{
    w:185,
    r:8,
    touched:true,
    prescribed:true,
    status:"skipped",
    reason:"time"
  }],
  {weightPolicy:"required"}
);
check(
  "Skipped set never pretends weight or reps were completed",
  skippedRows.ok
    && JSON.stringify(
         skippedRows.value
       )===JSON.stringify([
         {
           status:"skipped",
           reason:"time"
         }
       ])
);

const removedRows=engine.validateRows(
  "repetitionSets",
  [{
    r:12,
    touched:true,
    prescribed:true,
    status:"removed"
  }],
  {weightPolicy:"hidden"}
);
check(
  "Removed-today set is a valid session outcome",
  removedRows.ok
    && JSON.stringify(
         removedRows.value
       )===JSON.stringify([
         {
           status:"removed"
         }
       ])
);

const missedBodyweightRows=engine.validateRows(
  "repetitionSets",
  [{
    r:0,
    touched:true,
    prescribed:true,
    status:"missed"
  }],
  {weightPolicy:"hidden"}
);
check(
  "Bodyweight set can record zero reps as missed",
  missedBodyweightRows.ok
    && JSON.stringify(
         missedBodyweightRows.value
       )===JSON.stringify([
         {
           r:0,
           status:"missed"
         }
       ])
);

const unusedExtraRows=engine.validateRows(
  "strengthSets",
  [
    {
      w:185,
      r:8,
      touched:true,
      prescribed:true
    },
    {
      w:185,
      r:8,
      touched:false,
      prescribed:false,
      extra:true
    }
  ],
  {weightPolicy:"required"}
);
check(
  "Untouched extra set is ignored",
  unusedExtraRows.ok
    && JSON.stringify(
         unusedExtraRows.value
       )===JSON.stringify([
         {
           w:185,
           r:8
         }
       ])
);

const completedExtraRows=engine.validateRows(
  "strengthSets",
  [
    {
      w:185,
      r:8,
      touched:true,
      prescribed:true
    },
    {
      w:185,
      r:6,
      touched:true,
      prescribed:false,
      extra:true
    }
  ],
  {weightPolicy:"required"}
);
check(
  "Completed extra set is preserved explicitly",
  completedExtraRows.ok
    && JSON.stringify(
         completedExtraRows.value
       )===JSON.stringify([
         {
           w:185,
           r:8
         },
         {
           w:185,
           r:6,
           extra:true
         }
       ])
);

check(
  "Same-profile replacement is compatible",
  engine.compatible("timedIntervals","timedIntervals")
);
check(
  "Incompatible replacement requires value clearing",
  !engine.compatible("timedIntervals","distanceIntervals")
);
check(
  "Strength-to-repetition replacement requires value clearing",
  !engine.compatible("strengthSets","repetitionSets")
);

if (failed){
  console.error(
    "\nCARD PROFILE TESTS:",
    passed+" passed,",
    failed+" failed"
  );
  process.exit(1);
}

console.log(
  "\nCARD PROFILE TESTS:",
  passed+" passed, 0 failed"
);
