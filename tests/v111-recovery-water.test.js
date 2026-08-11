const {boot,check,summary,EXISTING_CFG}=require("./harness");
const fs=require("fs"),path=require("path");
const rawIndex=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const program={
  name:"Recovery Test",
  author:"Suite",
  days:[
    {
      id:"D1",
      title:"Day 1",
      exercises:[
        {
          name:"Bench Press",
          scheme:"3×5"
        }
      ]
    }
  ]
};
function w(n){return {date:"2026-08-0"+(n+1),day:"D1",title:"W"+(n+1),sets:{"Bench Press":[{w:135,r:5}]},notes:""};}
const R=boot(Object.assign({},EXISTING_CFG,{schemaVersion:3,waterOn:true}),{food:{},workouts:[w(0)],weights:[],water:{"2026-08-01":1},measure:[],recents:[],myFoods:{},myExercises:{},meals:[],meta:{lastBackup:null,logsSince:1},activeWorkoutDraft:null},null,program);
R.window.eval(`data.workouts=[${[0,1,2].map(i=>'('+JSON.stringify({date:'2026-08-0'+(i+1),day:'D1',title:'Older '+i,sets:{'Bench Press':[{w:135,r:5}]},notes:''})+')').join(',')}];data.water={"2026-08-08":1};save();data.workouts=[${[0,1,2,3].map(i=>'('+JSON.stringify({date:'2026-08-0'+(i+1),day:'D1',title:'Previous '+i,sets:{'Bench Press':[{w:135,r:5}]},notes:''})+')').join(',')}];data.water={"2026-08-09":2};save();data.workouts=[];data.water={"2026-08-10":3};save();renderRecoveryStatus();`);
const counts=R.window.eval(`Object.fromEntries(getStoredLkgStatuses().filter(s=>s.ok).map(s=>[s.tier,s.prepared.state.data.workouts.length]))`);
check("v111 snapshot generations expose 0 current, 4 previous, 3 older workouts",counts.current===0&&counts.previous===4&&counts.older===3);
const options=[...R.window.document.getElementById("snapshotRecoverySelect").options].map(o=>o.textContent);
check("v111 Settings still exposes Current Previous Older without crowding the dropdown with workout counts",options.some(x=>/^Current recovery — /.test(x))&&options.some(x=>/^Previous recovery — /.test(x))&&options.some(x=>/^Older recovery — /.test(x))&&options.every(x=>!/workout/i.test(x)));
const before=R.window.localStorage.getItem("forge:data");
const result=R.window.eval(`restoreSnapshotFromSettingsKey(LKG_PREVIOUS_KEY,{confirmed:true})`);
check("v111 explicitly selected Previous snapshot restores four workouts",result.ok&&R.window.eval("data.workouts.length")===4);
check("v111 selected restore quarantines exact prior primary",JSON.parse(R.window.localStorage.getItem("forge:quarantine")).originals.data===before);
const W=boot(Object.assign({},EXISTING_CFG,{schemaVersion:3,waterOn:true}),{food:{},workouts:[],weights:[],water:{"2026-08-08":0,"2026-08-09":1,"2026-08-10":2},measure:[],recents:[],myFoods:{},myExercises:{},meals:[],meta:{lastBackup:null,logsSince:0},activeWorkoutDraft:null},null,program);
W.window.eval("renderWater()");
const vals=[...W.window.document.querySelectorAll(".water-history-value")].map(x=>x.textContent.trim());
check("v111 rendered water history is 2 GLASSES 1 GLASS 0 GLASSES",JSON.stringify(vals)===JSON.stringify(["2 GLASSES","1 GLASS","0 GLASSES"]));
check("v111 CSS forces water history uppercase",/#waterHistory \.list-item > span:last-child[^}]*text-transform:uppercase/s.test(rawIndex));
R.window.close();W.window.close();summary("V111 RECOVERY + WATER");
