const {boot,check,summary,EXISTING_CFG}=require("./harness");
const fs=require("fs"),path=require("path");

const root=path.join(__dirname,"..");
const VERSION="web-v119-release-hardening-1";
const CACHE="blackpyre-v119-release-hardening-1";

const rawIndex=fs.readFileSync(path.join(root,"index.html"),"utf8");
const rawManifest=fs.readFileSync(path.join(root,"manifest.json"),"utf8");
const rawSw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
const rawStorage=fs.readFileSync(path.join(root,"scripts","01-storage.js"),"utf8");
const rawTrain=fs.readFileSync(path.join(root,"scripts","03-train.js"),"utf8");
const rawSettings=fs.readFileSync(path.join(root,"scripts","06-settings.js"),"utf8");
const rawBoot=fs.readFileSync(path.join(root,"scripts","07-boot.js"),"utf8");
const manifest=JSON.parse(rawManifest);

const localScripts=[...rawIndex.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
  .map(m=>m[1]).filter(src=>!/^https?:/.test(src));

check("v116 every local script URL is release-versioned",
  localScripts.length>0&&localScripts.every(src=>src.includes("?v="+VERSION)));

check("v116 release-specific Home Screen launch identity is permanent",
  manifest.id==="./"&&manifest.scope==="./"&&manifest.start_url==="./?app="+VERSION
  &&rawIndex.includes("manifest.json?v="+VERSION));

check("v116 service worker keeps network-first navigation and coherent cache family",
  rawSw.includes('const CACHE = "'+CACHE+'";')
  &&rawSw.includes('fetch(e.request,{cache:"no-store"})')
  &&rawSw.includes('"./?app='+VERSION+'"'));

check("v116 runtime diagnostic identifies the running release and both workout counts",
  rawStorage.includes("BLACKPYRE_WEB_RUNTIME_VERSION")
  &&rawStorage.includes(VERSION)
  &&rawStorage.includes("runtimeWorkoutCount")
  &&rawStorage.includes("persistedWorkoutCount")
  &&rawStorage.includes("serviceWorkerController"));

check("v116 missing duration formatter regression is permanently repaired",
  /function\s+formatDuration\s*\(/.test(rawStorage));

check("v116 History renders before unrelated top-level screens",
  rawBoot.includes('renderAllPart("training history",renderWork)')
  &&rawBoot.includes('renderAllPart("dashboard",renderDash)')
  &&rawBoot.indexOf('renderAllPart("training history",renderWork)')
    <rawBoot.indexOf('renderAllPart("dashboard",renderDash)'));

check("v116 Train helper failures are isolated from History",
  rawTrain.includes('["workout draft",renderWorkoutDraftCard]')
  &&rawTrain.includes('["personal records",renderPRs]')
  &&rawTrain.includes('["program identity",renderProgramIdentity]')
  &&rawTrain.includes('item[1]();'));

check("v116 restore path isolates session rerendering before full render",
  rawSettings.includes("post-restore session render failed")
  &&rawSettings.includes("renderAll();"));

const program={
  name:"Beginner Split (3-Day)",author:"Built by Claude",
  days:[
    {id:"D1",title:"Chest & Triceps",exercises:[{name:"Bench Press",scheme:"3×8"}]},
    {id:"D2",title:"Back & Biceps",exercises:[{name:"Seated Row",scheme:"3×8"}]},
    {id:"D3",title:"Legs & Shoulders",exercises:[{name:"Leg Press",scheme:"3×8"}]}
  ]
};

const dates=["2026-07-13","2026-07-15","2026-07-17","2026-07-20","2026-07-22",
  "2026-07-24","2026-07-24","2026-08-05","2026-08-07","2026-08-10"];

function workout(i){
  const sets={"Bench Press":[{w:100+i*5,r:10},{w:100+i*5,r:10},{w:100+i*5,r:8}]};
  if(i===7) sets["Stair Climber"]={t:"timeDist",secs:360};
  return {
    date:dates[i],day:"D"+((i%3)+1),
    title:["Chest & Triceps","Back & Biceps","Legs & Shoulders"][i%3],
    sets:sets,notes:""
  };
}

const restoredData={
  food:{"2026-07-22":[
    {name:"Food 1",cal:160,pro:30,carb:3,fat:3,meal:"lunch"},
    {name:"Food 2",cal:180,pro:12,carb:13,fat:12,meal:"lunch"},
    {name:"Food 3",cal:110,pro:0,carb:26,fat:1,meal:"snacks"},
    {name:"Food 4",cal:80,pro:0,carb:18,fat:0,meal:"snacks"}
  ]},
  workouts:Array.from({length:10},(_,i)=>workout(i)),
  weights:[
    {date:"2026-07-22",lbs:211.5},{date:"2026-08-02",lbs:210.9},
    {date:"2026-08-08",lbs:210.6},{date:"2026-08-10",time:"16:41",lbs:210.5}
  ],
  recents:[],myFoods:{},myExercises:{},meals:[],finished:{"2026-08-05":true},
  foodCounts:{},mealCounts:{},meta:{lastBackup:"2026-07-22",logsSince:8},
  activeWorkoutDraft:null
};

const cfg=Object.assign({},EXISTING_CFG,{schemaVersion:3,waterOn:false,setupDone:true});
const R=boot(cfg,restoredData,null,program);

let ok=true;
try{ ok=R.window.eval('formatDuration(360)')==="6m"; }catch(e){ ok=false; }
check("v116 time-based historical duration formatting cannot throw",ok);

ok=true;
try{ R.window.eval("renderPRs();"); }catch(e){ ok=false; }
check("v116 time-based historical workout cannot crash PR rendering",ok);

ok=true;
try{ R.window.eval("renderWork();"); }catch(e){ ok=false; }
check("v116 affected restored state renders 10 workout sessions",
  ok&&R.window.document.getElementById("workHistoryCount").textContent==="10 sessions"
  &&R.window.document.getElementById("workHistory").textContent.includes("Chest & Triceps"));

R.window.eval("data.workouts=[];renderWork();");
check("v116 stale empty runtime adopts richer persisted workout History",
  R.window.eval("data.workouts.length")===10
  &&R.window.document.getElementById("workHistoryCount").textContent==="10 sessions");

const diagnostic=R.window.eval("makeStorageDiagnosticEnvelope().envelope");
check("v116 diagnostic proves runtime identity and runtime versus persisted workout counts",
  diagnostic.runtimeVersion===VERSION&&diagnostic.runtimeWorkoutCount===10
  &&diagnostic.persistedWorkoutCount===10
  &&Object.prototype.hasOwnProperty.call(diagnostic,"serviceWorkerController"));

R.window.eval(`
  window.__c=console.error; console.error=function(){};
  window.__d=renderDash; window.__f=renderFood;
  renderDash=function(){throw new Error("synthetic dashboard failure");};
  renderFood=function(){throw new Error("synthetic food failure");};
  document.getElementById("workHistoryCount").textContent="0 sessions";
  document.getElementById("workHistory").innerHTML="<div>No sessions yet.</div>";
  renderAll();
  renderDash=window.__d; renderFood=window.__f; console.error=window.__c;
`);
check("v116 unrelated screen failures cannot hide valid workout History",
  R.window.document.getElementById("workHistoryCount").textContent==="10 sessions"
  &&!R.window.document.getElementById("workHistory").textContent.includes("No sessions yet."));

R.window.eval(`
  window.__c2=console.error; console.error=function(){};
  window.__draft=renderWorkoutDraftCard; window.__prs=renderPRs; window.__id=renderProgramIdentity;
  renderWorkoutDraftCard=function(){throw new Error("synthetic draft failure");};
  renderPRs=function(){throw new Error("synthetic PR failure");};
  renderProgramIdentity=function(){throw new Error("synthetic identity failure");};
  document.getElementById("workHistoryCount").textContent="0 sessions";
  document.getElementById("workHistory").innerHTML="<div>No sessions yet.</div>";
  renderWork();
  renderWorkoutDraftCard=window.__draft; renderPRs=window.__prs; renderProgramIdentity=window.__id;
  console.error=window.__c2;
`);
check("v116 Train helper failures cannot hide valid workout History",
  R.window.document.getElementById("workHistoryCount").textContent==="10 sessions"
  &&!R.window.document.getElementById("workHistory").textContent.includes("No sessions yet."));
R.window.close();

const emptyData={
  food:{},workouts:[],weights:[],recents:[],myFoods:{},myExercises:{},meals:[],
  finished:{},foodCounts:{},mealCounts:{},meta:{lastBackup:null,logsSince:0},
  activeWorkoutDraft:null
};
const R2=boot(cfg,emptyData,null,program);
const envelope={cfg:cfg,data:restoredData,program:program};
let restoreResult;
try{
  restoreResult=R2.window.eval("restoreBackupEnvelope("+JSON.stringify(envelope)+")");
}catch(e){
  restoreResult={ok:false};
}
const persistedAfterRestore=JSON.parse(R2.window.localStorage.getItem("forge:data"));
check("v116 normal backup restore succeeds with affected restored state",
  restoreResult&&restoreResult.ok===true);
check("v116 normal backup restore persists all 10 workouts",
  Array.isArray(persistedAfterRestore.workouts)&&persistedAfterRestore.workouts.length===10);
check("v116 normal backup restore immediately renders all 10 workouts",
  R2.window.document.getElementById("workHistoryCount").textContent==="10 sessions");
R2.window.close();

summary("V116 RUNTIME INTEGRITY + RESTORED HISTORY");
