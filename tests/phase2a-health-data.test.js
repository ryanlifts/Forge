// Phase 2a Apple Health contract, privacy-boundary, and failure-isolation guardrails.
const fs=require("fs");
const path=require("path");
const {boot,EXISTING_CFG,EMPTY_DATA,wait,dstr}=require("./harness");

let passed=0,failed=0;
const failures=[];
function check(name,condition){
  if(condition) passed++;
  else { failed++; failures.push(name); console.error("  FAIL:",name); }
}
const root=path.join(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

function makeHealthPlugins(options){
  const opts=options||{};
  const control={denied:opts.denied||null,noData:opts.noData||null,writeGranted:opts.writeGranted!==false};
  const writes=[];
  const workoutWrites=[];
  const cache={raw:opts.initialRaw===undefined?null:opts.initialRaw};
  const BlackPyreData={
    async readHealthCache(){ return {raw:cache.raw}; },
    async writeHealthCache(args){ cache.raw=String(args.raw); writes.push(cache.raw); return {written:true,protected:true}; }
  };
  const HealthPlugin={
    async isHealthAvailable(){ return {available:true}; },
    async checkHealthPermissions(){ return {permissions:{WRITE_WORKOUTS:control.writeGranted}}; },
    async requestHealthPermissions(){ return {permissions:{WRITE_WORKOUTS:true}}; },
    async queryAggregated(args){
      if(control.denied===args.dataType) throw new Error("Authorization denied");
      if(control.noData===args.dataType) return {aggregatedData:[]};
      const values={"active-calories":612,"steps":8431,"sleep":438*60,"resting-heart-rate":57,hrv:44};
      return {aggregatedData:[{startDate:Date.now(),endDate:Date.now(),value:values[args.dataType]}]};
    },
    async queryLatestSample(args){
      if(control.denied===args.dataType) throw new Error("Authorization denied");
      if(control.noData===args.dataType) return {timestamp:Date.now(),unit:""};
      const values={weight:100.4,"resting-heart-rate":57,hrv:44};
      return {value:values[args.dataType],timestamp:Date.now(),unit:"",metadata:{sourceName:"Test Health Source"}};
    },
    async queryWorkouts(){
      if(control.denied==="workouts") throw new Error("Authorization denied");
      if(control.noData==="workouts") return {workouts:[]};
      return {workouts:[{id:"health-workout-id",startDate:"2026-08-12T15:00:00.000Z",endDate:"2026-08-12T15:42:00.000Z",duration:2520,sourceName:"Test Watch",heartRate:[{bpm:120},{bpm:140},{bpm:166}]}]};
    },
    async saveWorkout(args){
      workoutWrites.push(args);
      if(!control.writeGranted) throw new Error("Authorization denied");
      return {success:true,id:"written-health-id"};
    },
    async openAppleHealthSettings(){ return {}; }
  };
  function install(window){
    window.Capacitor={
      isNativePlatform:()=>true,
      isPluginAvailable:name=>name==="BlackPyreData"||name==="HealthPlugin",
      Plugins:{BlackPyreData,HealthPlugin}
    };
  }
  return {install,writes,workoutWrites,cache,control};
}

async function run(){
  const contract=read("HEALTH-DATA-CONTRACT.md");
  const healthSource=read("scripts/08-health.js");
  const bridge=read("ios/App/App/BlackPyreBridgeViewController.swift");
  const info=read("ios/App/App/Info.plist");
  const entitlements=read("ios/App/App/App.entitlements");
  const project=read("ios/App/App.xcodeproj/project.pbxproj");
  const pkg=JSON.parse(read("package.json"));
  const lock=JSON.parse(read("package-lock.json"));

  check("contract fixes a separate version-1 aggregate-only cache boundary",
    /healthFormatVersion`: integer, exactly `1`/.test(contract)
    &&/Raw samples, routes, beat-by-beat heart-rate curves, and step timelines are forbidden/.test(contract)
    &&/must never be written to `forge:data`/.test(contract));
  check("HealthKit plugin is exact-pinned with its license and verified registry integrity",
    pkg.dependencies["@flomentumsolutions/capacitor-health-extended"]==="0.8.3"
    &&lock.packages["node_modules/@flomentumsolutions/capacitor-health-extended"].integrity==="sha512-gA/DtCvWreSDCykX7ZvFQHJlHTc+dH9yJO69T1dQ+qlU9XaKQ0wEXhDJg6XHaxc78RbtnKjT/4Kvz0QChZM6pw=="
    &&/MIT License/.test(read("vendor/capacitor-health-extended.LICENSE.txt")));
  check("native project enables HealthKit and provides read and write purpose strings",
    /com\.apple\.developer\.healthkit/.test(entitlements)
    &&/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements/.test(project)
    &&/NSHealthShareUsageDescription/.test(info)&&/NSHealthUpdateUsageDescription/.test(info));
  check("native bridge stores a separate protected cache and full erase owns it",
    /blackpyre-health-cache\.json/.test(bridge)
    &&/isExcludedFromBackup/.test(bridge)
    &&/readHealthCache/.test(bridge)&&/writeHealthCache/.test(bridge)
    &&/libraryNames/.test(bridge)&&/for file in files where Self\.isManaged/.test(bridge));

  const all=makeHealthPlugins();
  const app=boot(Object.assign({},EXISTING_CFG),EMPTY_DATA,w=>all.install(w));
  await wait(25);
  const connected=await app.window.eval("connectAppleHealth()");
  await wait(10);
  const cache=JSON.parse(all.cache.raw);
  check("all approved reads round-trip through the contract",
    connected===undefined
    &&cache.healthFormatVersion===1
    &&cache.daily[app.window.eval("todayStr()")].bodyWeightKg.value===100.4
    &&cache.daily[app.window.eval("todayStr()")].activeEnergyKcal===612
    &&cache.daily[app.window.eval("todayStr()")].steps===8431
    &&cache.daily[app.window.eval("todayStr()")].sleepMinutes===438
    &&cache.daily[app.window.eval("todayStr()")].restingHeartRateBpm===57
    &&cache.daily[app.window.eval("todayStr()")].heartRateVariabilityMs===44
    &&cache.workoutHeartRate["health-workout-id"].averageBpm===142
    &&cache.workoutHeartRate["health-workout-id"].maximumBpm===166);
  check("HealthKit sleep seconds are converted to contract minutes",cache.daily[app.window.eval("todayStr()")].sleepMinutes===438);
  check("persisted workout health data is aggregate-only",
    !/heartRate\s*\"?:\s*\[|route\s*\"?:\s*\[|samples\s*\"?:\s*\[/.test(all.cache.raw)
    &&Object.keys(cache.workoutHeartRate["health-workout-id"]).sort().join(",")==="averageBpm,durationSeconds,endAt,maximumBpm,sourceName,startAt");
  check("validator rejects raw sample, route, and extra payload fields",
    app.window.eval(`(()=>{
      const a=makeEmptyHealthCache(); a.daily["2026-08-12"]={steps:1,samples:[1]};
      const b=makeEmptyHealthCache(); b.workoutHeartRate.x={startAt:"2026-08-12T15:00:00.000Z",endAt:"2026-08-12T15:01:00.000Z",durationSeconds:60,averageBpm:100,maximumBpm:120,route:[]};
      const c=makeEmptyHealthCache(); c.rawSamples=[];
      return !inspectHealthCache(a).ok&&!inspectHealthCache(b).ok&&!inspectHealthCache(c).ok;
    })()`));

  app.window.download=(filename,text)=>{ app.window.__healthBackup=String(text); };
  app.window.eval("healthCache.daily['2026-08-12']={activeEnergyKcal:999}; doBackup('exportDataBtn',false);");
  const lkg=app.window.eval("refreshLastKnownGood('phase2a-test')");
  const vault=app.window.eval("captureNativeVaultCandidate('phase2a-test')");
  const rawRecovery=app.window.eval("makeRawRecoveryEnvelope()");
  const diagnostic=app.window.eval("makeStorageDiagnosticEnvelope()");
  const boundaryText=[app.window.__healthBackup,JSON.stringify(lkg),vault.raw,JSON.stringify(rawRecovery),JSON.stringify(diagnostic)].join("\n");
  check("health cache is absent from backup, LKG, Native Vault, recovery, and diagnostics",
    !boundaryText.includes("blackpyre:health-cache")
    &&!boundaryText.includes("healthFormatVersion")
    &&!boundaryText.includes("activeEnergyKcal"));
  check("Health cache uses no primary schema bump",
    app.window.eval("SCHEMA_VERSION")===3&&app.window.eval("HEALTH_FORMAT_VERSION")===1);

  const before=app.window.eval("computeTDEE()");
  app.window.eval("healthCache.daily[todayStr()].activeEnergyKcal=4444");
  const after=app.window.eval("computeTDEE()");
  check("active energy cannot alter the logged-trend TDEE calculation",JSON.stringify(before)===JSON.stringify(after));

  const exact={id:"bpw-test",title:"Basketball",startedAt:"2026-08-12T15:00:00.000Z",endedAt:"2026-08-12T15:30:00.000Z",durationSeconds:1800,sets:{}};
  const planned={id:"bpw-plan",title:"Plan",durationSeconds:1800,sets:{}};
  app.window.eval("cfg.healthOn=true; cfg.healthWorkoutWriteOn=true;");
  const wrote=await app.window.eval("writeWorkoutToAppleHealth("+JSON.stringify(exact)+")");
  const skipped=await app.window.eval("writeWorkoutToAppleHealth("+JSON.stringify(planned)+")");
  check("only a real completed session with exact actual duration is eligible for write-back",
    wrote.ok===true&&skipped.ineligible===true&&all.workoutWrites.length===1
    &&!Object.prototype.hasOwnProperty.call(all.workoutWrites[0],"calories")
    &&!Object.prototype.hasOwnProperty.call(all.workoutWrites[0],"distance")
    &&!Object.prototype.hasOwnProperty.call(all.workoutWrites[0],"heartRate"));
  const timed=app.window.eval("completedWorkoutTiming(todayStr(),1800)");
  const historical=app.window.eval("completedWorkoutTiming('2026-01-01',1800)");
  const tooShort=app.window.eval("completedWorkoutTiming(todayStr(),59)");
  const tooLong=app.window.eval("completedWorkoutTiming(todayStr(),43201)");
  check("write-back timing accepts only same-day durations from 1 minute through 12 hours",
    timed&&timed.durationSeconds===1800&&historical===null&&tooShort===null&&tooLong===null);
  check("time-only exercise duration controls Health write-back instead of draft elapsed time",
    app.window.eval("workoutSessionStartedAt=new Date(Date.now()-958000).toISOString(); explicitWorkoutDurationSeconds({Walking:{t:'durationActivity',secs:60}})")===60
    &&app.window.eval("completedWorkoutTiming(todayStr(),explicitWorkoutDurationSeconds({Walking:{t:'durationActivity',secs:60}})).durationSeconds")===60);
  check("mixed or strength-only sessions cannot invent a Health workout duration",
    app.window.eval("explicitWorkoutDurationSeconds({Squat:[{w:225,r:5}]})")===null
    &&app.window.eval("explicitWorkoutDurationSeconds({Walking:{t:'durationActivity',secs:60},Squat:[{w:225,r:5}]})")===null
    &&app.window.eval("completedWorkoutTiming(todayStr(),null)")===null);
  check("removed and skipped programmed exercises do not invalidate recorded walking time",
    app.window.eval(`explicitWorkoutDurationSeconds({
      "Back Squat":[{status:"removed"},{status:"removed"},{status:"removed"}],
      "Bench Press":[{status:"skipped"},{status:"missed"}],
      "Plank":{t:"exerciseOutcome",status:"removed"},
      "Walk":{t:"timeDist",secs:120}
    })`)===120);
  check("explicit interval duration includes only recorded work and between-interval recovery",
    app.window.eval("explicitWorkoutDurationSeconds({Intervals:{t:'timedIntervals',intervals:3,workSecs:30,recSecs:15}})")===120);
  check("workout activity mapping distinguishes running sports and strength sessions",
    app.window.eval("appleHealthActivityType({title:'Outdoor Run',sets:{}})")==="running"
    &&app.window.eval("appleHealthActivityType({title:'Basketball',sets:{}})")==="other"
    &&app.window.eval("appleHealthActivityType({title:'Full Body A',sets:{Squat:'3x5'}})")==="strength-training");
  app.window.close();

  const denied=makeHealthPlugins({denied:"steps",noData:"sleep"});
  const denialApp=boot(Object.assign({},EXISTING_CFG),EMPTY_DATA,w=>denied.install(w));
  await wait(25);
  await denialApp.window.eval("connectAppleHealth()");
  const deniedCache=JSON.parse(denied.cache.raw);
  check("permission denial and absent data degrade independently by signal",
    deniedCache.permissions.steps==="denied"
    &&deniedCache.permissions.sleep==="no-data"
    &&deniedCache.permissions.activeEnergy==="available"
    &&deniedCache.permissions.bodyWeight==="available"
    &&deniedCache.permissions.workoutHeartRate==="available");
  denialApp.window.close();

  const denialCases=[
    ["bodyWeight","weight"],
    ["activeEnergy","active-calories"],
    ["steps","steps"],
    ["sleep","sleep"],
    ["restingHeartRate","resting-heart-rate"],
    ["heartRateVariability","hrv"],
    ["workoutHeartRate","workouts"]
  ];
  let independentDenials=true;
  for(const [permissionKey,dataType] of denialCases){
    const mock=makeHealthPlugins({denied:dataType});
    const deniedApp=boot(Object.assign({},EXISTING_CFG),EMPTY_DATA,w=>mock.install(w));
    await wait(10);
    await deniedApp.window.eval("connectAppleHealth()");
    const record=JSON.parse(mock.cache.raw);
    independentDenials=independentDenials&&record.permissions[permissionKey]==="denied"
      &&denialCases.filter(row=>row[0]!==permissionKey).every(row=>record.permissions[row[0]]==="available");
    deniedApp.window.close();
  }
  check("each read denial degrades independently while every other read remains available",independentDenials);

  let independentNoData=true;
  for(const [permissionKey,dataType] of denialCases){
    const mock=makeHealthPlugins({noData:dataType});
    const noDataApp=boot(Object.assign({},EXISTING_CFG),EMPTY_DATA,w=>mock.install(w));
    await wait(10);
    await noDataApp.window.eval("connectAppleHealth()");
    const record=JSON.parse(mock.cache.raw);
    independentNoData=independentNoData&&record.permissions[permissionKey]==="no-data"
      &&denialCases.filter(row=>row[0]!==permissionKey).every(row=>record.permissions[row[0]]==="available");
    noDataApp.window.close();
  }
  check("each absent read degrades independently while every other read remains available",independentNoData);

  const revoked=makeHealthPlugins();
  const revokedApp=boot(Object.assign({},EXISTING_CFG),EMPTY_DATA,w=>revoked.install(w));
  await wait(10);
  await revokedApp.window.eval("connectAppleHealth()");
  revoked.control.denied="steps";
  revoked.control.writeGranted=false;
  await revokedApp.window.eval("syncAppleHealth({request:false})");
  const revokedCache=JSON.parse(revoked.cache.raw);
  const revokedToday=revokedCache.daily[revokedApp.window.eval("todayStr()")];
  check("mid-life read revocation removes the stale value without affecting other signals",
    revokedCache.permissions.steps==="denied"
    &&revokedToday.steps===undefined
    &&revokedToday.activeEnergyKcal===612
    &&revokedToday.sleepMinutes===438);
  check("mid-life workout-write revocation is detected independently",
    revokedCache.permissions.workoutWrite==="denied"
    &&revokedCache.permissions.workoutHeartRate==="available");
  revokedApp.window.close();

  check("source guidance and privacy disclosures are shipped",
    /Check the Health app and the original device's app/.test(read("index.html"))
    &&/never included in BlackPyre backup or recovery files/.test(read("privacy.html"))
    &&/Active energy is displayed separately/.test(read("privacy.html")));
  check("Health access control gives the real Apple Health app path instead of opening ordinary app settings",
    /Apple Health app → tap your profile picture → Privacy → Apps → BlackPyre/.test(read("index.html"))
    &&/showAppleHealthAccessInstructions/.test(healthSource)
    &&! /plugin\.openAppleHealthSettings/.test(healthSource));
  check("Health cache cannot be stored in browser primary namespaces",
    !/localStorage\.(?:setItem|getItem)\([^\n]*HEALTH_CACHE/.test(healthSource)
    &&!/HEALTH_CACHE_KEY/.test(read("scripts/01-storage.js")));

  console.log("\nPHASE 2A HEALTH DATA: "+passed+" passed, "+failed+" failed");
  if(failed) console.log("failures:",failures.join(" | "));
  process.exit(failed?1:0);
}
run().catch(error=>{ console.error(error); process.exit(1); });
