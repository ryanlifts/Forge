// BlackPyre web runtime freshness, history preservation, and stale-write protection.
const {boot,bootRaw,EXISTING_CFG,EMPTY_DATA,check,summary}=require("./harness");
const fs=require("fs");
const path=require("path");

(async()=>{
  const root=path.join(__dirname,"..");
  const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  const waterSource=fs.readFileSync(path.join(root,"scripts","05-ai.js"),"utf8");

  const asset="web-v121-food-catalog-1";
  const cache="blackpyre-v121-food-catalog-1";

  check("critical web runtimes use unique cache-busting URLs",
    index.includes('scripts/01-storage.js?v='+asset)
    && index.includes('scripts/03-train.js?v='+asset)
    && index.includes('scripts/05-ai.js?v='+asset)
    && index.includes('scripts/07-boot.js?v='+asset)
    && sw.includes('"./scripts/01-storage.js?v='+asset+'"')
    && sw.includes('"./scripts/03-train.js?v='+asset+'"')
    && sw.includes('"./scripts/05-ai.js?v='+asset+'"')
    && sw.includes('"./scripts/07-boot.js?v='+asset+'"')
    && sw.includes('const CACHE = "'+cache+'";'));

  check("water history source keeps uppercase singular and plural labels",
    /Number\(data\.water\[date\]\)===1\?'GLASS':'GLASSES'/.test(waterSource));

  const program={
    name:"History Safety",
    author:"BlackPyre regression",
    days:[{
      id:"D1",
      title:"History Day",
      exercises:[{
        name:"Bench Press",
        scheme:"1 × 5",
        prescription:{sets:1,reps:5}
      }]
    }]
  };

  const currentCfg=Object.assign({},EXISTING_CFG,{
    schemaVersion:3,
    waterOn:true,
    measureOn:true
  });

  // A newly logged workout must appear in History immediately, not only after reload.
  const immediateData=JSON.parse(JSON.stringify(EMPTY_DATA));
  immediateData.meta={lastBackup:null,logsSince:0};
  const Immediate=boot(currentCfg,immediateData,null,program);
  const dImmediate=Immediate.window.document;
  const row=dImmediate.querySelector("#exerciseInputs .srow");

  check("history regression fixture opens one programmed strength row",
    !!row && dImmediate.querySelectorAll("#exerciseInputs .srow").length===1);

  function setInput(dom,el,value){
    el.value=String(value);
    el.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
    el.dispatchEvent(new dom.window.Event("change",{bubbles:true}));
  }

  setInput(Immediate,row.querySelector('input[data-field="weight"]'),135);
  setInput(Immediate,row.querySelector('input[data-field="reps"]'),5);

  dImmediate.querySelector("#exerciseInputs .saveExBtn")
    .dispatchEvent(new Immediate.window.Event("click",{bubbles:true}));

  dImmediate.getElementById("logWorkoutBtn")
    .dispatchEvent(new Immediate.window.Event("click",{bubbles:true}));

  const immediateHistory=dImmediate.getElementById("workHistory").textContent;

  check("newly logged workout appears in History immediately",
    Immediate.window.eval("data.workouts.length")===1
    && /History Day/.test(immediateHistory)
    && /Bench Press/.test(immediateHistory)
    && /135/.test(immediateHistory)
    && /5/.test(immediateHistory)
    && dImmediate.getElementById("workHistoryCount").textContent==="1 session");

  check("newly logged workout is persisted before immediate History rendering",
    JSON.parse(Immediate.window.localStorage.getItem("forge:data")).workouts.length===1);

  Immediate.window.close();

  // Representative older saved state: every user-history collection must survive.
  const date="2026-08-01";
  const legacyData={
    food:{
      [date]:[{
        name:"Chicken breast",
        cal:165,
        pro:31,
        carb:0,
        fat:3.6,
        meal:"lunch"
      }]
    },
    workouts:[{
      date,
      day:"D1",
      title:"History Day",
      sets:{"Bench Press":[{w:135,r:5}]},
      notes:"preserve workout"
    }],
    weights:[{date,lbs:220}],
    water:{[date]:3},
    measure:[{date,waist:36,chest:42,arm:15}],
    recents:[],
    myFoods:{
      savedOats:{
        name:"Oats",
        brand:"Saved",
        cal100:389,
        pro100:16.9,
        carb100:66.3,
        fat100:6.9
      }
    },
    myExercises:{},
    meals:[],
    meta:{lastBackup:null,logsSince:1},
    activeWorkoutDraft:{
      date:"2026-08-02",
      day:"D1",
      title:"History Day",
      sets:{"Bench Press":[{w:140,r:5}]},
      notes:"preserve active draft"
    }
  };

  const legacyCfg=Object.assign({},EXISTING_CFG,{
    schemaVersion:1,
    waterOn:true,
    measureOn:true
  });

  function savedFoodsCore(map){
    const out={};
    Object.keys(map||{}).sort().forEach(key=>{
      const f=map[key]||{};
      out[key]={
        name:f.productName || f.name,
        brand:f.brandName || f.brand || "",
        cal100:f.cal100,
        pro100:f.pro100,
        carb100:f.carb100,
        fat100:f.fat100
      };
    });
    return out;
  }

  function protectedCore(value){
    return {
      food:value.food,
      workouts:value.workouts,
      weights:value.weights,
      water:value.water,
      measure:value.measure,
      myFoods:savedFoodsCore(value.myFoods),
      activeWorkoutDraft:value.activeWorkoutDraft
    };
  }

  const expectedCore=protectedCore(legacyData);
  const expectedProgram=JSON.stringify(program);

  const Upgrade=boot(legacyCfg,legacyData,null,program);
  const upgraded=JSON.parse(Upgrade.window.eval("JSON.stringify(data)"));

  check("representative older saved state preserves every history collection during upgrade boot",
    JSON.stringify(protectedCore(upgraded))===JSON.stringify(expectedCore));

  check("training program survives representative older-state upgrade boot",
    Upgrade.window.eval("JSON.stringify(program)")===expectedProgram);

  const Reload=bootRaw({
    cfg:Upgrade.window.localStorage.getItem("forge:cfg"),
    data:Upgrade.window.localStorage.getItem("forge:data"),
    program:Upgrade.window.localStorage.getItem("forge:program")
  });
  const reloaded=JSON.parse(Reload.window.eval("JSON.stringify(data)"));

  check("upgraded history survives a full reload",
    JSON.stringify(protectedCore(reloaded))===JSON.stringify(expectedCore));

  check("training program survives the full reload",
    Reload.window.eval("JSON.stringify(program)")===expectedProgram);

  check("normal save succeeds before recovery-snapshot preservation check",
    Reload.window.eval("save()")===true);

  const lkgRaw=Reload.window.localStorage.getItem("forge:lkg");
  let lkgData=null;

  if(lkgRaw){
    try{
      const record=JSON.parse(lkgRaw);
      if(record&&record.strings&&typeof record.strings.data==="string"){
        lkgData=JSON.parse(record.strings.data);
      }
    }catch(_error){}
  }

  check("last-known-good recovery snapshot preserves all history collections",
    !!lkgData
    && JSON.stringify(protectedCore(lkgData))===JSON.stringify(expectedCore));

  Reload.window.eval(`
    window.__historyBackupText=null;
    download=(name,text)=>{window.__historyBackupText=text;};
    flashSave=()=>{};
  `);

  await Reload.window.eval('doBackup("exportDataBtn",false)');

  const backupText=Reload.window.eval("window.__historyBackupText");
  const backup=backupText ? JSON.parse(backupText) : null;

  check("normal backup contains every protected history collection and the training program",
    !!backup
    && JSON.stringify(protectedCore(backup.data))===JSON.stringify(expectedCore)
    && JSON.stringify(backup.program)===expectedProgram
    && Reload.window.eval(
      "prepareRecoveryBackupEnvelope(JSON.parse(window.__historyBackupText)).ok"
    )===true);

  const Restored=boot(backup.cfg,backup.data,null,backup.program);
  const restored=JSON.parse(Restored.window.eval("JSON.stringify(data)"));

  check("validated backup restore preserves every history collection",
    JSON.stringify(protectedCore(restored))===JSON.stringify(expectedCore));

  check("validated backup restore preserves the training program",
    Restored.window.eval("JSON.stringify(program)")===expectedProgram);

  // Reproduce the actual release-blocker shape: an old open copy has empty
  // training history, another copy has newer rich data, then the old copy
  // tries to save water. The stale copy must be blocked before any overwrite.
  const staleSeed={
    food:{},
    workouts:[],
    weights:[],
    water:{"2026-08-10":1},
    measure:[],
    recents:[],
    myFoods:{},
    myExercises:{},
    meals:[],
    meta:{lastBackup:null,logsSince:0},
    activeWorkoutDraft:null
  };

  const richData=JSON.parse(JSON.stringify(staleSeed));
  richData.workouts=[
    {date:"2026-07-20",day:"D1",title:"Older Workout 1",sets:{"Bench Press":[{w:125,r:5}]},notes:""},
    {date:"2026-07-27",day:"D1",title:"Older Workout 2",sets:{"Bench Press":[{w:130,r:5}]},notes:""},
    {date:"2026-08-03",day:"D1",title:"Older Workout 3",sets:{"Bench Press":[{w:135,r:5}]},notes:""},
    {date:"2026-08-10",day:"D1",title:"TODAYS WORKOUT",sets:{"Bench Press":[{w:140,r:5}]},notes:"must survive"}
  ];

  const Stale=boot(currentCfg,staleSeed,null,program);
  const staleStorage=Stale.window.localStorage;
  Stale.window.__storageOriginalMethods.setItem.call(
    staleStorage,
    "forge:data",
    JSON.stringify(richData)
  );

  Stale.window.document.getElementById("waterPlus")
    .dispatchEvent(new Stale.window.Event("click",{bubbles:true}));

  const protectedAfterWater=JSON.parse(staleStorage.getItem("forge:data"));
  const memoryAfterWater=JSON.parse(Stale.window.eval("JSON.stringify(data)"));

  check("stale water save cannot wipe newer complete training history",
    protectedAfterWater.workouts.length===4
    && protectedAfterWater.workouts[3].title==="TODAYS WORKOUT"
    && memoryAfterWater.workouts.length===4
    && memoryAfterWater.water["2026-08-10"]===1);

  check("stale primary-data conflict enters explicit protected mode",
    Stale.window.eval('protectedMode===true && protectedModeKind==="stale-primary"')
    && /newer saved data/i.test(
      Stale.window.document.getElementById("protectedBannerText").textContent
    ));

  // The same guard protects settings and the training program from stale copies.
  const CfgStale=boot(currentCfg,EMPTY_DATA,null,program);
  const externalCfg=Object.assign({},currentCfg,{accent:"pink"});
  CfgStale.window.__storageOriginalMethods.setItem.call(
    CfgStale.window.localStorage,
    "forge:cfg",
    JSON.stringify(externalCfg)
  );
  CfgStale.window.eval('cfg.accent="steel"; window.__staleCfgSave=saveCfg();');
  const cfgAfter=JSON.parse(CfgStale.window.localStorage.getItem("forge:cfg"));

  check("stale settings save cannot overwrite newer settings",
    CfgStale.window.eval("window.__staleCfgSave")===false
    && cfgAfter.accent==="pink"
    && CfgStale.window.eval('cfg.accent==="pink"'));

  const ProgramStale=boot(currentCfg,EMPTY_DATA,null,program);
  const newerProgram=JSON.parse(JSON.stringify(program));
  newerProgram.name="NEWER TRAINING PROGRAM";
  ProgramStale.window.__storageOriginalMethods.setItem.call(
    ProgramStale.window.localStorage,
    "forge:program",
    JSON.stringify(newerProgram)
  );
  ProgramStale.window.eval(
    'program.name="STALE TRAINING PROGRAM"; window.__staleProgramSave=saveProgram();'
  );
  const programAfter=JSON.parse(
    ProgramStale.window.localStorage.getItem("forge:program")
  );

  check("stale training-program save cannot overwrite newer program data",
    ProgramStale.window.eval("window.__staleProgramSave")===false
    && programAfter.name==="NEWER TRAINING PROGRAM"
    && ProgramStale.window.eval('program.name==="NEWER TRAINING PROGRAM"'));

  Upgrade.window.close();
  Reload.window.close();
  Restored.window.close();
  Stale.window.close();
  CfgStale.window.close();
  ProgramStale.window.close();

  summary("WEB RUNTIME + HISTORY SAFETY");
})().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
