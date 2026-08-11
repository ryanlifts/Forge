const {boot,check,summary,EXISTING_CFG}=require("./harness");
const fs=require("fs"),path=require("path");
const rawIndex=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const rawWater=fs.readFileSync(path.join(__dirname,"..","scripts","05-ai.js"),"utf8");
const rawSw=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8");

const program={
  name:"Water Card Test",
  author:"Suite",
  days:[{id:"D1",title:"Day 1",exercises:[{name:"Bench Press",scheme:"3×5"}]}]
};
const data={
  food:{},workouts:[],weights:[],water:{},measure:[],recents:[],
  myFoods:{},myExercises:{},meals:[],
  meta:{lastBackup:null,logsSince:0},activeWorkoutDraft:null
};
const W=boot(
  Object.assign({},EXISTING_CFG,{schemaVersion:3,waterOn:true}),
  data,
  null,
  program
);

function show(n){
  W.window.eval(`data.water[todayStr()]=${n};renderWater();`);
  return {
    count:W.window.document.getElementById("waterCount").textContent.trim(),
    unit:W.window.document.getElementById("waterUnit").textContent.trim()
  };
}

let shown=show(0);
check("v112 main Water card renders 0 GLASSES TODAY",
  shown.count==="0"&&shown.unit==="GLASSES TODAY");

shown=show(1);
check("v112 main Water card renders 1 GLASS TODAY",
  shown.count==="1"&&shown.unit==="GLASS TODAY");

shown=show(2);
check("v112 main Water card renders 2 GLASSES TODAY",
  shown.count==="2"&&shown.unit==="GLASSES TODAY");

W.window.eval(`
  const unit=document.getElementById("waterUnit");
  unit.removeAttribute("id");
  unit.textContent="glasses today";
  data.water[todayStr()]=1;
  renderWater();
`);
check("v112 runtime repairs older lowercase/plural Water-card markup",
  W.window.document.getElementById("waterUnit").textContent.trim()==="GLASS TODAY");

check("v112 shipped Water-card markup is uppercase and has a dedicated unit element",
  /id="waterUnit"[^>]*>GLASSES TODAY<\/small>/.test(rawIndex)
  && !/<small[^>]*>glasses today<\/small>/.test(rawIndex));

check("v112 renderWater derives singular only for exactly one",
  /waterToday===1\?"GLASS TODAY":"GLASSES TODAY"/.test(rawWater));

check("v112 water runtime repairs older markup through the adjacent unit element",
  /getElementById\("waterUnit"\)\|\|waterCount\.nextElementSibling/.test(rawWater));

check("v112 cache and critical runtime family are version-busted",
  /blackpyre-v113-recovery-history-1/.test(rawSw)
  && /scripts\/05-ai\.js\?v=web-v113-recovery-history-1/.test(rawIndex)
  && /scripts\/05-ai\.js\?v=web-v113-recovery-history-1/.test(rawSw));

W.window.close();
summary("V112 WATER CARD");
