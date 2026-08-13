const fs=require("fs");
const path=require("path");
const {boot,check,summary,EXISTING_CFG}=require("./harness");

const root=path.join(__dirname,"..");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const train=fs.readFileSync(path.join(root,"scripts","03-train.js"),"utf8");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");

const match=train.match(/function exerciseRemovedFromToday\(st\)\{[\s\S]*?\n\}/);
const exerciseRemoved=match
  ? Function(match[0]+"; return exerciseRemovedFromToday;")()
  : null;

check("v117 removal state receives the selected accent-color outline",
  /\.removed-exercise-card\s*\{[^}]*border:2px solid var\(--ember\)/.test(index)
  &&/\.removed-exercise-card \.removed-set-copy/.test(index));

check("v117 non-row removed exercises use the exact shared removal bar",
  train.includes('const removedExerciseBar=makeRemovalUndoBar(')
  &&train.includes('"exerciseRemovalUndo",')
  &&train.includes('removedExerciseBar.classList.add("removed-exercise-card")'));

check("v117 removed state recognizes typed and fully removed row exercises",
  typeof exerciseRemoved==="function"
  &&exerciseRemoved({exerciseOutcome:"removed"})===true
  &&exerciseRemoved({rows:[{prescribed:true,status:"removed"},{prescribed:true,status:"removed"}]})===true
  &&exerciseRemoved({rows:[{prescribed:true,status:"removed"},{prescribed:true,status:""}]})===false);

check("v117 removed exercises no longer render a second Remove exercise control",
  train.includes("&& !exerciseRemovedFromToday(st)"));

check("v117 set-based whole-exercise removal uses the same accent card",
  train.includes('removedExerciseBar.classList.add("removed-exercise-card")'));

const app=boot(
  Object.assign({},EXISTING_CFG,{schemaVersion:3}),
  {food:{},workouts:[],weights:[],water:{},measure:[],recents:[],myFoods:{},myExercises:{},meals:[],meta:{lastBackup:null,logsSince:0},activeWorkoutDraft:null},
  null,
  {name:"Removal parity",days:[{id:"D1",title:"Day 1",exercises:[{name:"Bench Press",scheme:"3×5"},{name:"Plank",scheme:"3×30 sec"}]}]}
);
app.window.eval('wDaySel.value="D1";initSessionState();renderSessionInputs();');
app.window.document.querySelector('[data-exercise-remove-today="Plank"]').click();
app.window.document.querySelector('[data-exercise-remove-today="Bench Press"]').click();
const plankBar=app.window.document.querySelector('[data-exercise-removal-undo="Plank"]').closest(".removed-set-undo-row");
const benchBar=app.window.document.querySelector('[data-exercise-rows-undo="Bench Press"]').closest(".removed-set-undo-row");
check("v118 Plank and set-based exercises render the identical removal box and font classes",
  plankBar.className===benchBar.className
  &&plankBar.querySelector(".removed-set-copy").className===benchBar.querySelector(".removed-set-copy").className
  &&plankBar.querySelector(".removed-set-copy").textContent===benchBar.querySelector(".removed-set-copy").textContent);
app.window.close();

check("v117 deployment identity is coherent",
  sw.includes('const CACHE = "blackpyre-v118-unified-removal-1"')
  &&index.includes("web-v118-unified-removal-1"));

summary("V117 REMOVAL STATE");
