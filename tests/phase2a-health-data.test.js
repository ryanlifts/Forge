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
  const writes=[];
  const workoutWrites=[];
  const cache={raw:opts.initialRaw===undefined?null:opts.initialRaw};
  const BlackPyreData={
    async readHealthCache(){ return {raw:cache.raw}; },
    async writeHealthCache(args){ cache.raw=String(args.raw); writes.push(cache.raw); return {written:true,protected:true}; }
  };
  const HealthPlugin={
    async isHealthAvailable(){ return {available:true}; },
    async requestHealthPermissions(){ return {permissions:{WRITE_WORKOUTS:true}}; },
    async queryAggregated(args){
      if(opts.denied===args.dataType) throw new Error("Authorization denied");
      if(opts.noData===args.dataType) return {aggregatedData:[]};
      const values={"active-calories":612,"steps":8431,"sleep":438};
      return {aggregatedData:[{startDate:Date.now(),endDate:Date.now(),value:values[args.dataType]}]};
    },
    async queryLatestSample(args){
      if(opts.denied===args.dataType) throw new Error("Authorization denied");
      if(opts.noData===args.dataType) return {timestamp:Date.now(),unit:""};
      const values={weight:100.4,"resting-heart-rate":57,hrv:44};
      return {value:values[args.dataType],timestamp:Date.now(),unit:"",metadata:{sourceName:"Test Health Source"}};
    },
    async queryWorkouts(){
      if(opts.denied==="workouts") throw new Error("Authorization denied");
      if(opts.noData==="workouts") return {workouts:[]};
      return {workouts:[{id:"health-workout-id",startDate:"2026-08-12T15:00:00.000Z",endDate:"2026-08-12T15:42:00.000Z",duration:2520,sourceName:"Test Watch",heartRate:[{bpm:120},{bpm:140},{bpm:166}]}]};
    },
    async saveWorkout(args){ workoutWrites.push(args); return {success:true,id:"written-health-id"}; },
    async openAppleHealthSettings(){ return {}; }
  };
  function install(window){
    window.Capacitor={
      isNativePlatform:()=>true,
      isPluginAvailable:name=>name==="BlackPyreData"||name==="HealthPlugin",
      Plugins:{BlackPyreData,HealthPlugin}
    };
  }
  return {install,writes,workoutWrites,cache};
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

  check("source guidance and privacy disclosures are shipped",
    /Check the Health app and the original device's app/.test(read("index.html"))
    &&/never included in BlackPyre backup or recovery files/.test(read("privacy.html"))
    &&/Active energy is displayed separately/.test(read("privacy.html")));
  check("Health cache cannot be stored in browser primary namespaces",
    !/localStorage\.(?:setItem|getItem)\([^\n]*HEALTH_CACHE/.test(healthSource)
    &&!/HEALTH_CACHE_KEY/.test(read("scripts/01-storage.js")));

  console.log("\nPHASE 2A HEALTH DATA: "+passed+" passed, "+failed+" failed");
  if(failed) console.log("failures:",failures.join(" | "));
  process.exit(failed?1:0);
}
run().catch(error=>{ console.error(error); process.exit(1); });
