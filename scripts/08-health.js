"use strict";
// ================== APPLE HEALTH / DEVICE-ONLY CACHE ==================
const HEALTH_FORMAT_VERSION = 1;
const HEALTH_CACHE_KEY = "blackpyre:health-cache";
const HEALTH_CACHE_FILE = "blackpyre-health-cache.json";
const HEALTH_DAILY_LIMIT = 400;
const HEALTH_WORKOUT_LIMIT = 250;
const HEALTH_WRITEBACK_LIMIT = 500;
const HEALTH_PERMISSION_KEYS = [
  "bodyWeight","activeEnergy","steps","sleep","restingHeartRate",
  "heartRateVariability","workoutHeartRate","workoutWrite"
];
const HEALTH_DAILY_FIELDS = {
  bodyWeight:"bodyWeightKg",
  activeEnergy:"activeEnergyKcal",
  steps:"steps",
  sleep:"sleepMinutes",
  restingHeartRate:"restingHeartRateBpm",
  heartRateVariability:"heartRateVariabilityMs"
};
const HEALTH_READ_PERMISSIONS = [
  "READ_WEIGHT","READ_ACTIVE_CALORIES","READ_STEPS","READ_SLEEP",
  "READ_RESTING_HEART_RATE","READ_HRV","READ_WORKOUTS","READ_HEART_RATE"
];
const HEALTH_ALL_PERMISSIONS = HEALTH_READ_PERMISSIONS.concat(["WRITE_WORKOUTS"]);

let healthCache = makeEmptyHealthCache();
let healthCacheLoaded = false;
let healthSyncing = false;

function makeEmptyHealthCache(){
  const permissions={};
  HEALTH_PERMISSION_KEYS.forEach(key=>permissions[key]="unknown");
  return {
    healthFormatVersion:HEALTH_FORMAT_VERSION,
    cacheKey:HEALTH_CACHE_KEY,
    updatedAt:new Date(0).toISOString(),
    permissions:permissions,
    daily:{},
    workoutHeartRate:{},
    writeBack:{}
  };
}
function validHealthPermissionState(value){
  return ["unknown","available","unavailable","no-data","denied","error","written"].includes(value);
}
function finiteHealthNumber(value,min,integer){
  const n=Number(value);
  return Number.isFinite(n) && n>=min && (!integer || Number.isInteger(n));
}
function validHealthIso(value){
  return typeof value==="string" && Number.isFinite(Date.parse(value));
}
function inspectHealthCache(value){
  if(!isPlainObject(value)) return {ok:false,code:"shape"};
  if(value.healthFormatVersion!==HEALTH_FORMAT_VERSION || value.cacheKey!==HEALTH_CACHE_KEY) return {ok:false,code:"format"};
  if(!validHealthIso(value.updatedAt) || !isPlainObject(value.permissions) || !isPlainObject(value.daily)
    || !isPlainObject(value.workoutHeartRate) || !isPlainObject(value.writeBack)) return {ok:false,code:"shape"};
  if(!HEALTH_PERMISSION_KEYS.every(key=>validHealthPermissionState(value.permissions[key]))) return {ok:false,code:"permissions"};
  if(Object.keys(value).some(key=>!["healthFormatVersion","cacheKey","updatedAt","permissions","daily","workoutHeartRate","writeBack"].includes(key))) return {ok:false,code:"raw-root"};
  if(Object.keys(value.permissions).some(key=>!HEALTH_PERMISSION_KEYS.includes(key))) return {ok:false,code:"permission-extra"};

  for(const day of Object.keys(value.daily)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isPlainObject(value.daily[day])) return {ok:false,code:"daily"};
    const record=value.daily[day];
    if(Object.keys(record).some(key=>!["bodyWeightKg","activeEnergyKcal","steps","sleepMinutes","restingHeartRateBpm","heartRateVariabilityMs"].includes(key))) return {ok:false,code:"raw-daily"};
    if(Object.prototype.hasOwnProperty.call(record,"bodyWeightKg")){
      const weight=record.bodyWeightKg;
      if(!isPlainObject(weight) || !finiteHealthNumber(weight.value,1,false)
        || (weight.observedAt!==undefined && !validHealthIso(weight.observedAt))
        || (weight.sourceName!==undefined && typeof weight.sourceName!=="string")
        || Object.keys(weight).some(key=>!["value","observedAt","sourceName"].includes(key))) return {ok:false,code:"weight"};
    }
    if(record.activeEnergyKcal!==undefined && !finiteHealthNumber(record.activeEnergyKcal,0,false)) return {ok:false,code:"energy"};
    if(record.steps!==undefined && !finiteHealthNumber(record.steps,0,true)) return {ok:false,code:"steps"};
    if(record.sleepMinutes!==undefined && !finiteHealthNumber(record.sleepMinutes,0,false)) return {ok:false,code:"sleep"};
    if(record.restingHeartRateBpm!==undefined && !finiteHealthNumber(record.restingHeartRateBpm,1,false)) return {ok:false,code:"rhr"};
    if(record.heartRateVariabilityMs!==undefined && !finiteHealthNumber(record.heartRateVariabilityMs,1,false)) return {ok:false,code:"hrv"};
  }

  for(const id of Object.keys(value.workoutHeartRate)){
    const record=value.workoutHeartRate[id];
    if(!id || !isPlainObject(record) || !validHealthIso(record.startAt) || !validHealthIso(record.endAt)
      || !finiteHealthNumber(record.durationSeconds,1,false)
      || !finiteHealthNumber(record.averageBpm,1,false) || !finiteHealthNumber(record.maximumBpm,1,false)
      || record.maximumBpm<record.averageBpm
      || (record.sourceName!==undefined && typeof record.sourceName!=="string")
      || Object.keys(record).some(key=>!["startAt","endAt","durationSeconds","averageBpm","maximumBpm","sourceName"].includes(key))) return {ok:false,code:"workout"};
  }

  for(const id of Object.keys(value.writeBack)){
    const record=value.writeBack[id];
    if(!id || !isPlainObject(record)
      || !["pending","written","denied","ineligible","error"].includes(record.status)
      || !validHealthIso(record.attemptedAt)
      || (record.healthWorkoutId!==undefined && typeof record.healthWorkoutId!=="string")
      || Object.keys(record).some(key=>!["status","attemptedAt","healthWorkoutId"].includes(key))) return {ok:false,code:"writeback"};
  }
  return {ok:true,record:value};
}
function trimHealthMap(map,limit,dateGetter){
  const keys=Object.keys(map);
  if(keys.length<=limit) return;
  keys.sort((a,b)=>String(dateGetter(map[a],a)||"").localeCompare(String(dateGetter(map[b],b)||"")));
  keys.slice(0,keys.length-limit).forEach(key=>delete map[key]);
}
function trimHealthCache(cache){
  trimHealthMap(cache.daily,HEALTH_DAILY_LIMIT,(record,key)=>key);
  trimHealthMap(cache.workoutHeartRate,HEALTH_WORKOUT_LIMIT,record=>record.startAt);
  trimHealthMap(cache.writeBack,HEALTH_WRITEBACK_LIMIT,record=>record.attemptedAt);
  return cache;
}
function healthNativeDataCapability(){
  const c=typeof window!=="undefined" ? window.Capacitor : null;
  let native=false,available=false,plugin=null;
  try { native=!!(c && typeof c.isNativePlatform==="function" && c.isNativePlatform()); } catch(e){}
  try { available=!!(c && typeof c.isPluginAvailable==="function" && c.isPluginAvailable("BlackPyreData")); } catch(e){}
  try { plugin=c && c.Plugins ? c.Plugins.BlackPyreData : null; } catch(e){}
  return {
    native:native,
    available:!!(native && available && plugin
      && typeof plugin.readHealthCache==="function"
      && typeof plugin.writeHealthCache==="function"),
    plugin:plugin
  };
}
function healthPlatformCapability(){
  const c=typeof window!=="undefined" ? window.Capacitor : null;
  let native=false,available=false,plugin=null;
  try { native=!!(c && typeof c.isNativePlatform==="function" && c.isNativePlatform()); } catch(e){}
  try { available=!!(c && typeof c.isPluginAvailable==="function" && c.isPluginAvailable("HealthPlugin")); } catch(e){}
  try { plugin=c && c.Plugins ? c.Plugins.HealthPlugin : null; } catch(e){}
  return {
    native:native,
    available:!!(native && available && plugin
      && typeof plugin.isHealthAvailable==="function"
      && typeof plugin.checkHealthPermissions==="function"
      && typeof plugin.requestHealthPermissions==="function"
      && typeof plugin.queryAggregated==="function"
      && typeof plugin.queryLatestSample==="function"
      && typeof plugin.queryWorkouts==="function"
      && typeof plugin.saveWorkout==="function"),
    plugin:plugin
  };
}
async function loadHealthCache(){
  const capability=healthNativeDataCapability();
  healthCacheLoaded=true;
  if(!capability.available){
    healthCache=makeEmptyHealthCache();
    return healthCache;
  }
  try {
    const result=await capability.plugin.readHealthCache();
    if(!result || result.raw===null || result.raw===undefined){
      healthCache=makeEmptyHealthCache();
      return healthCache;
    }
    const checked=inspectHealthCache(JSON.parse(result.raw));
    healthCache=checked.ok ? checked.record : makeEmptyHealthCache();
  } catch(e){
    healthCache=makeEmptyHealthCache();
    HEALTH_PERMISSION_KEYS.forEach(key=>healthCache.permissions[key]="error");
  }
  return healthCache;
}
async function persistHealthCache(){
  const checked=inspectHealthCache(trimHealthCache(healthCache));
  if(!checked.ok) throw new Error("BlackPyre refused an invalid health cache.");
  const capability=healthNativeDataCapability();
  if(!capability.available) throw new Error("Device-only health storage is unavailable.");
  const raw=JSON.stringify(checked.record);
  const result=await capability.plugin.writeHealthCache({raw:raw});
  if(!result || result.written!==true || result.protected!==true) throw new Error("Health cache protection was not verified.");
  return true;
}
function localDayFromTimestamp(value){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())) return todayStr();
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}
function startOfLocalDay(day){
  const parts=String(day).split("-").map(Number);
  return new Date(parts[0],parts[1]-1,parts[2],0,0,0,0);
}
function healthDayRecord(day){
  if(!isPlainObject(healthCache.daily[day])) healthCache.daily[day]={};
  return healthCache.daily[day];
}
function clearCachedHealthSignal(permissionKey){
  const field=HEALTH_DAILY_FIELDS[permissionKey];
  if(field){
    Object.keys(healthCache.daily).forEach(day=>{
      const record=healthCache.daily[day];
      if(isPlainObject(record)){
        delete record[field];
        if(!Object.keys(record).length) delete healthCache.daily[day];
      }
    });
  }
  if(permissionKey==="workoutHeartRate") healthCache.workoutHeartRate={};
}
function clearAllCachedHealthReads(){
  HEALTH_PERMISSION_KEYS.filter(key=>key!=="workoutWrite").forEach(clearCachedHealthSignal);
}
function sumAggregatedValues(result){
  const rows=result && Array.isArray(result.aggregatedData) ? result.aggregatedData : [];
  const values=rows.map(row=>Number(row&&row.value)).filter(Number.isFinite);
  return values.length ? values.reduce((sum,value)=>sum+value,0) : null;
}
function latestAggregatedValue(result){
  const rows=result && Array.isArray(result.aggregatedData) ? result.aggregatedData : [];
  const valid=rows.filter(row=>Number.isFinite(Number(row&&row.value)));
  return valid.length ? Number(valid[valid.length-1].value) : null;
}
function healthQueryState(error){
  const text=String(error&&error.message||error||"").toLowerCase();
  return /denied|not authorized|authorization/.test(text) ? "denied" : (/no sample|no data|not found/.test(text) ? "no-data" : "error");
}
async function queryDailyAggregate(plugin,permissionKey,dataType,day,valueKey,mode){
  const start=startOfLocalDay(day);
  const end=new Date(Math.min(Date.now(),start.getTime()+86400000));
  try {
    const result=await plugin.queryAggregated({
      startDate:start.toISOString(),endDate:end.toISOString(),dataType:dataType,bucket:"day"
    });
    const value=mode==="latest" ? latestAggregatedValue(result) : sumAggregatedValues(result);
    if(value===null){
      clearCachedHealthSignal(permissionKey);
      healthCache.permissions[permissionKey]="no-data";
      return;
    }
    const record=healthDayRecord(day);
    const normalized=dataType==="sleep" ? value/60 : value;
    record[valueKey]=valueKey==="steps" ? Math.max(0,Math.round(normalized)) : Math.max(0,Math.round(normalized*10)/10);
    healthCache.permissions[permissionKey]="available";
  } catch(error){
    clearCachedHealthSignal(permissionKey);
    healthCache.permissions[permissionKey]=healthQueryState(error);
  }
}
async function queryLatestHealthValue(plugin,permissionKey,dataType,valueKey,minValue,maxAgeDays){
  try {
    const result=await plugin.queryLatestSample({dataType:dataType});
    const value=Number(result&&result.value);
    if(!Number.isFinite(value) || value<minValue){
      clearCachedHealthSignal(permissionKey);
      healthCache.permissions[permissionKey]="no-data";
      return;
    }
    const observed=Number(result.timestamp);
    const observedAt=Number.isFinite(observed)
      ? new Date(observed>100000000000 ? observed : observed*1000).toISOString()
      : new Date().toISOString();
    if(Number.isFinite(maxAgeDays) && Date.now()-Date.parse(observedAt)>maxAgeDays*86400000){
      clearCachedHealthSignal(permissionKey);
      healthCache.permissions[permissionKey]="no-data";
      return;
    }
    const day=localDayFromTimestamp(observedAt);
    const record=healthDayRecord(day);
    if(valueKey==="bodyWeightKg"){
      record.bodyWeightKg={
        value:Math.round(value*100)/100,
        observedAt:observedAt,
        sourceName:String(result&&result.metadata&&result.metadata.sourceName||"Apple Health")
      };
    }else{
      record[valueKey]=Math.round(value*10)/10;
    }
    healthCache.permissions[permissionKey]="available";
  } catch(error){
    clearCachedHealthSignal(permissionKey);
    healthCache.permissions[permissionKey]=healthQueryState(error);
  }
}
function aggregateWorkoutHeartRate(workout){
  const samples=workout && Array.isArray(workout.heartRate) ? workout.heartRate : [];
  const rates=samples.map(sample=>Number(sample&&sample.bpm)).filter(value=>Number.isFinite(value)&&value>0);
  if(!rates.length) return null;
  const startAt=new Date(workout.startDate).toISOString();
  const endAt=new Date(workout.endDate).toISOString();
  const duration=Number(workout.duration)>0 ? Number(workout.duration) : (Date.parse(endAt)-Date.parse(startAt))/1000;
  if(!(duration>0)) return null;
  return {
    startAt:startAt,
    endAt:endAt,
    durationSeconds:Math.round(duration),
    averageBpm:Math.round((rates.reduce((sum,value)=>sum+value,0)/rates.length)*10)/10,
    maximumBpm:Math.round(Math.max.apply(null,rates)*10)/10,
    sourceName:String(workout.sourceName||"Apple Health")
  };
}
async function queryWorkoutHeartRate(plugin){
  const end=new Date();
  const start=new Date(end.getTime()-45*86400000);
  try {
    const result=await plugin.queryWorkouts({
      startDate:start.toISOString(),endDate:end.toISOString(),
      includeHeartRate:true,includeRoute:false,includeSteps:false
    });
    const workouts=result&&Array.isArray(result.workouts) ? result.workouts : [];
    let found=0;
    workouts.forEach((workout,index)=>{
      const aggregate=aggregateWorkoutHeartRate(workout);
      if(!aggregate) return;
      const id=String(workout.id||aggregate.startAt+"#"+index);
      healthCache.workoutHeartRate[id]=aggregate;
      found++;
    });
    if(!found) clearCachedHealthSignal("workoutHeartRate");
    healthCache.permissions.workoutHeartRate=found ? "available" : "no-data";
  } catch(error){
    clearCachedHealthSignal("workoutHeartRate");
    healthCache.permissions.workoutHeartRate=healthQueryState(error);
  }
}
async function refreshWorkoutWritePermission(plugin){
  try {
    const result=await plugin.checkHealthPermissions({permissions:["WRITE_WORKOUTS"]});
    const granted=!!(result&&result.permissions&&result.permissions.WRITE_WORKOUTS===true);
    healthCache.permissions.workoutWrite=granted
      ? (healthCache.permissions.workoutWrite==="written" ? "written" : "available")
      : "denied";
  } catch(error){
    healthCache.permissions.workoutWrite=healthQueryState(error);
  }
}
async function syncAppleHealth(options){
  const opts=options||{};
  if(healthSyncing) return false;
  const capability=healthPlatformCapability();
  if(!capability.available){
    clearAllCachedHealthReads();
    HEALTH_PERMISSION_KEYS.forEach(key=>healthCache.permissions[key]="unavailable");
    renderHealth();
    return false;
  }
  healthSyncing=true;
  renderHealth();
  try {
    const availability=await capability.plugin.isHealthAvailable();
    if(!availability || availability.available!==true){
      clearAllCachedHealthReads();
      HEALTH_PERMISSION_KEYS.forEach(key=>healthCache.permissions[key]="unavailable");
      return false;
    }
    if(opts.request===true){
      try {
        const result=await capability.plugin.requestHealthPermissions({permissions:HEALTH_ALL_PERMISSIONS});
        const permissions=result&&result.permissions||{};
        if(permissions.WRITE_WORKOUTS===false) healthCache.permissions.workoutWrite="denied";
      } catch(error){
        const state=healthQueryState(error);
        clearAllCachedHealthReads();
        HEALTH_PERMISSION_KEYS.forEach(key=>healthCache.permissions[key]=state);
        return false;
      }
    }
    const day=todayStr();
    await Promise.all([
      queryLatestHealthValue(capability.plugin,"bodyWeight","weight","bodyWeightKg",1,14),
      queryDailyAggregate(capability.plugin,"activeEnergy","active-calories",day,"activeEnergyKcal","sum"),
      queryDailyAggregate(capability.plugin,"steps","steps",day,"steps","sum"),
      queryDailyAggregate(capability.plugin,"sleep","sleep",day,"sleepMinutes","sum"),
      queryDailyAggregate(capability.plugin,"restingHeartRate","resting-heart-rate",day,"restingHeartRateBpm","latest"),
      queryDailyAggregate(capability.plugin,"heartRateVariability","hrv",day,"heartRateVariabilityMs","latest"),
      queryWorkoutHeartRate(capability.plugin),
      refreshWorkoutWritePermission(capability.plugin)
    ]);
    healthCache.updatedAt=new Date().toISOString();
    await persistHealthCache();
    return true;
  } finally {
    healthSyncing=false;
    renderHealth();
  }
}
function latestHealthWeight(){
  const rows=Object.keys(healthCache.daily).sort().reverse();
  for(const day of rows){
    const weight=healthCache.daily[day]&&healthCache.daily[day].bodyWeightKg;
    if(weight&&finiteHealthNumber(weight.value,1,false)) return Object.assign({day:day},weight);
  }
  return null;
}
function healthHeartRateForWorkoutRecord(record){
  if(!record||!validHealthIso(record.startedAt)||!validHealthIso(record.endedAt)) return null;
  const start=Date.parse(record.startedAt),end=Date.parse(record.endedAt);
  let best=null,bestOverlap=0;
  Object.values(healthCache.workoutHeartRate).forEach(candidate=>{
    const candidateStart=Date.parse(candidate.startAt),candidateEnd=Date.parse(candidate.endAt);
    const overlap=Math.max(0,Math.min(end,candidateEnd)-Math.max(start,candidateStart));
    if(overlap>bestOverlap){ best=candidate; bestOverlap=overlap; }
  });
  return bestOverlap>=60000 ? best : null;
}
function formatHealthMetric(value,suffix,digits){
  const n=Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined,{maximumFractionDigits:digits||0})+(suffix||"") : "Not available";
}
function healthMetricHtml(label,value){
  return '<div class="health-metric"><div class="label">'+esc(label)+'</div><strong>'+esc(value)+'</strong></div>';
}
function healthStatusSummary(){
  const states=HEALTH_PERMISSION_KEYS.map(key=>healthCache.permissions[key]);
  const available=states.filter(state=>state==="available"||state==="written").length;
  const denied=states.filter(state=>state==="denied").length;
  const errors=states.filter(state=>state==="error").length;
  if(healthSyncing) return "Syncing each Apple Health signal…";
  if(denied) return available+" available · "+denied+" denied · other signals still work.";
  if(errors) return available+" available · "+errors+" could not be read.";
  if(available) return available+" health signal"+(available===1?"":"s")+" available.";
  return "Connected, but no recent Apple Health data is available yet.";
}
function renderHealth(){
  const native=healthPlatformCapability().native;
  const enabled=cfg.healthOn===true;
  const card=document.getElementById("healthSummaryCard");
  if(card) card.classList.toggle("hidden",!native||!enabled);

  const settingsStatus=document.getElementById("healthSettingsStatus");
  if(settingsStatus) settingsStatus.textContent=!native
    ? "Apple Health is available only in the native iPhone app."
    : (!enabled ? "Apple Health is not connected." : healthStatusSummary());

  const connect=document.getElementById("healthConnectBtn");
  const sync=document.getElementById("healthSyncBtn");
  const manage=document.getElementById("healthManageBtn");
  const write=document.getElementById("healthWorkoutWriteBtn");
  if(connect){
    connect.classList.toggle("hidden",!native||enabled);
    connect.disabled=healthSyncing;
  }
  if(sync){
    sync.classList.toggle("hidden",!native||!enabled);
    sync.disabled=healthSyncing;
    sync.textContent=healthSyncing?"SYNCING…":"SYNC APPLE HEALTH";
  }
  if(manage) manage.classList.toggle("hidden",!native||!enabled);
  if(write){
    write.classList.toggle("hidden",!native||!enabled);
    const on=cfg.healthWorkoutWriteOn!==false;
    write.textContent="WORKOUT SHARING: "+(on?"ON":"OFF");
    write.setAttribute("aria-pressed",on?"true":"false");
  }

  const today=healthCache.daily[todayStr()]||{};
  const body=document.getElementById("healthSummaryBody");
  if(body){
    body.innerHTML=[
      healthMetricHtml("Active energy",formatHealthMetric(today.activeEnergyKcal," kcal",0)),
      healthMetricHtml("Steps",formatHealthMetric(today.steps,"",0)),
      healthMetricHtml("Sleep",formatHealthMetric(today.sleepMinutes," min",0)),
      healthMetricHtml("Resting HR",formatHealthMetric(today.restingHeartRateBpm," bpm",0)),
      healthMetricHtml("HRV",formatHealthMetric(today.heartRateVariabilityMs," ms",0))
    ].join("");
  }
  const updated=document.getElementById("healthSummaryUpdated");
  if(updated) updated.textContent=healthSyncing ? "Syncing…" : (
    healthCache.updatedAt===new Date(0).toISOString()
      ? "No sync completed yet."
      : "Last synced "+new Date(healthCache.updatedAt).toLocaleString()
  );
  const comparison=document.getElementById("healthTdeeComparison");
  if(comparison){
    const tdee=typeof computeTDEE==="function" ? computeTDEE() : null;
    comparison.textContent=Number.isFinite(Number(today.activeEnergyKcal))
      ? "Apple Health active energy today: "+Math.round(today.activeEnergyKcal)+" kcal"
        +(tdee?" · BlackPyre logged-trend TDEE: "+tdee.tdee+" kcal/day":"")
        +". These are separate signals and are never blended."
      : "Active energy is not available today. BlackPyre's logged-trend TDEE remains independent.";
  }

  const suggestion=document.getElementById("healthWeightSuggestion");
  if(suggestion){
    const weight=latestHealthWeight();
    const recent=weight && Date.now()-Date.parse(weight.observedAt||weight.day+"T12:00:00")<=14*86400000;
    suggestion.classList.toggle("hidden",!enabled||!recent);
    if(enabled&&recent){
      const display=isMetricSystem() ? weight.value : weight.value*2.2046226218;
      suggestion.textContent="Apple Health: "+display.toFixed(1)+" "+unitWeightLabel()+" · "+fmtDate(weight.day)+". The field is prefilled for your review; tap Record to add it to BlackPyre.";
      const input=document.getElementById("wtVal");
      if(input && !input.value) input.value=String(Math.round(display*10)/10);
    }
  }
}
function newBlackPyreWorkoutId(){
  try { if(crypto&&typeof crypto.randomUUID==="function") return "bpw-"+crypto.randomUUID(); } catch(e){}
  return "bpw-"+Date.now()+"-"+Math.random().toString(36).slice(2,12);
}
function eligibleHealthWorkout(record){
  if(!record || typeof record.id!=="string" || !record.id || !validHealthIso(record.startedAt)
    || !validHealthIso(record.endedAt) || !finiteHealthNumber(record.durationSeconds,1,false)) return false;
  const actual=(Date.parse(record.endedAt)-Date.parse(record.startedAt))/1000;
  return actual>0 && Math.abs(actual-Number(record.durationSeconds))<=5;
}
function appleHealthActivityType(record){
  const text=String((record&&record.title)||"")+" "+Object.keys(record&&record.sets||{}).join(" ");
  if(/run|jog|sprint/i.test(text)) return "running";
  if(/walk/i.test(text)) return "walking";
  if(/cycl|bike/i.test(text)) return "cycling";
  if(/hike/i.test(text)) return "hiking";
  if(/yoga/i.test(text)) return "yoga";
  if(/climb/i.test(text)) return "climbing";
  if(/cardio|row|swim|football|basketball|conditioning/i.test(text)) return "other";
  return "strength-training";
}
async function writeWorkoutToAppleHealth(record){
  if(cfg.healthOn!==true || cfg.healthWorkoutWriteOn===false) return {ok:false,skipped:true};
  if(!eligibleHealthWorkout(record)){
    if(record&&record.id){
      healthCache.writeBack[record.id]={status:"ineligible",attemptedAt:new Date().toISOString()};
      healthCache.updatedAt=new Date().toISOString();
      try { await persistHealthCache(); } catch(e){}
    }
    return {ok:false,ineligible:true};
  }
  if(!healthCacheLoaded) await loadHealthCache();
  const capability=healthPlatformCapability();
  if(!capability.available) return {ok:false,unavailable:true};
  const attemptedAt=new Date().toISOString();
  healthCache.writeBack[record.id]={status:"pending",attemptedAt:attemptedAt};
  try {
    const result=await capability.plugin.saveWorkout({
      activityType:appleHealthActivityType(record),
      startDate:record.startedAt,
      endDate:record.endedAt,
      metadata:{BlackPyreWorkoutID:record.id}
    });
    if(!result || result.success!==true) throw new Error("Apple Health did not confirm the workout.");
    healthCache.writeBack[record.id]={
      status:"written",attemptedAt:attemptedAt,
      healthWorkoutId:String(result.id||"")
    };
    healthCache.permissions.workoutWrite="written";
    healthCache.updatedAt=new Date().toISOString();
    await persistHealthCache();
    renderHealth();
    return {ok:true};
  } catch(error){
    const state=healthQueryState(error);
    healthCache.writeBack[record.id]={status:state==="denied"?"denied":"error",attemptedAt:attemptedAt};
    healthCache.permissions.workoutWrite=state;
    healthCache.updatedAt=new Date().toISOString();
    try { await persistHealthCache(); } catch(e){}
    renderHealth();
    return {ok:false,error:error};
  }
}
async function connectAppleHealth(){
  cfg.healthOn=true;
  if(cfg.healthWorkoutWriteOn===undefined) cfg.healthWorkoutWriteOn=true;
  saveCfg();
  renderHealth();
  const ok=await syncAppleHealth({request:true});
  flashSave(ok?"Apple Health connected ✓":"Apple Health connected — some signals are not available",!ok);
}
function showAppleHealthAccessInstructions(){
  const instructions=document.getElementById("healthAccessInstructions");
  const button=document.getElementById("healthManageBtn");
  if(!instructions||!button) return;
  const show=instructions.classList.contains("hidden");
  instructions.classList.toggle("hidden",!show);
  button.setAttribute("aria-expanded",show?"true":"false");
  button.textContent=show?"HIDE ACCESS INSTRUCTIONS":"HOW TO MANAGE HEALTH ACCESS";
  if(show&&typeof instructions.scrollIntoView==="function") instructions.scrollIntoView({block:"nearest"});
}
function setAppleHealthWorkoutSharing(){
  cfg.healthWorkoutWriteOn=cfg.healthWorkoutWriteOn===false;
  saveCfg();
  renderHealth();
  flashSave("Apple Health workout sharing "+(cfg.healthWorkoutWriteOn===false?"off":"on"));
}

document.getElementById("healthConnectBtn").addEventListener("click",connectAppleHealth);
document.getElementById("healthSyncBtn").addEventListener("click",()=>syncAppleHealth({request:false}));
document.getElementById("healthSummarySyncBtn").addEventListener("click",()=>syncAppleHealth({request:false}));
document.getElementById("healthManageBtn").addEventListener("click",showAppleHealthAccessInstructions);
document.getElementById("healthWorkoutWriteBtn").addEventListener("click",setAppleHealthWorkoutSharing);

loadHealthCache().then(()=>{
  renderHealth();
  if(cfg.healthOn===true) syncAppleHealth({request:false});
});
