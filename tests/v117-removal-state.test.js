const fs=require("fs");
const path=require("path");
const {check,summary}=require("./harness");

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

check("v117 non-row removed exercises use the unified copy and card",
  train.includes('"exercise-outcome-card simple-exercise-removal removed-exercise-card"')
  &&train.includes('? "Exercise removed from today"'));

check("v117 removed state recognizes typed and fully removed row exercises",
  typeof exerciseRemoved==="function"
  &&exerciseRemoved({exerciseOutcome:"removed"})===true
  &&exerciseRemoved({rows:[{prescribed:true,status:"removed"},{prescribed:true,status:"removed"}]})===true
  &&exerciseRemoved({rows:[{prescribed:true,status:"removed"},{prescribed:true,status:""}]})===false);

check("v117 removed exercises no longer render a second Remove exercise control",
  train.includes("&& !exerciseRemovedFromToday(st)"));

check("v117 set-based whole-exercise removal uses the same accent card",
  train.includes('removedExerciseBar.classList.add("removed-exercise-card")'));

check("v117 deployment identity is coherent",
  sw.includes('const CACHE = "blackpyre-v117-removal-state-1"')
  &&index.includes("web-v117-removal-state-1"));

summary("V117 REMOVAL STATE");
