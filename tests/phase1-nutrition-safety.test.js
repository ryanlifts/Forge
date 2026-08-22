// BlackPyre Phase 1 nutrition-safety regression suite — shipped web app behavior.
const { boot, check, summary, dstr, EXISTING_CFG, EMPTY_DATA } = require("./harness");
const fs = require("fs");

(async ()=>{
const dom=boot(EXISTING_CFG,EMPTY_DATA);
const W=dom.window, D=W.document, E=code=>W.eval(code);
const click=id=>D.getElementById(id).dispatchEvent(new W.Event("click",{bubbles:true}));
const setv=(id,value)=>{ const el=D.getElementById(id); el.value=String(value); el.dispatchEvent(new W.Event("input",{bubbles:true})); el.dispatchEvent(new W.Event("change",{bubbles:true})); };

check("shared safety contract exposes the authoritative product limits", E(`NUTRITION_SAFETY.minDailyCalories===1200 && NUTRITION_SAFETY.maxDailyCalories===10000 && NUTRITION_SAFETY.minAge===13 && NUTRITION_SAFETY.maxAge===100 && NUTRITION_SAFETY.minHeightInches===48 && NUTRITION_SAFETY.maxHeightInches===96 && NUTRITION_SAFETY.minWeightLb===50 && NUTRITION_SAFETY.maxWeightLb===700`));
check("daily-calorie floor accepts 1,200 and rejects 1,199", E(`validateDailyCalories(1200).ok && !validateDailyCalories(1199).ok`));
check("daily-calorie ceiling accepts 10,000 and rejects 10,001", E(`validateDailyCalories(10000).ok && !validateDailyCalories(10001).ok`));
check("calculator age boundaries are inclusive and outside ages reject", E(`validateNutritionCalculatorInput({sex:"m",age:13,ft:4,inches:0,lb:150,activity:1.2,goalAdj:0}).ok && validateNutritionCalculatorInput({sex:"f",age:100,ft:8,inches:0,lb:150,activity:1.2,goalAdj:0}).ok && !validateNutritionCalculatorInput({sex:"m",age:12,ft:6,inches:0,lb:150,activity:1.2,goalAdj:0}).ok && !validateNutritionCalculatorInput({sex:"m",age:101,ft:6,inches:0,lb:150,activity:1.2,goalAdj:0}).ok`));
check("calculator accepts the exact 48- and 96-inch height boundaries", E(`validateNutritionCalculatorInput({sex:"m",age:30,ft:4,inches:0,lb:150,activity:1.2,goalAdj:0}).ok && validateNutritionCalculatorInput({sex:"m",age:30,ft:8,inches:0,lb:150,activity:1.2,goalAdj:0}).ok`));
check("calculator rejects an inches field outside 0-11", E(`!validateNutritionCalculatorInput({sex:"m",age:30,ft:5,inches:12,lb:150,activity:1.2,goalAdj:0}).ok`));
check("weight validation accepts 50-700 lb and rejects outside values", E(`validateSupportedWeight(50,"Weight",false).ok && validateSupportedWeight(700,"Weight",false).ok && !validateSupportedWeight(49.9,"Weight",false).ok && !validateSupportedWeight(700.1,"Weight",false).ok`));
check("calculator accepts only the five supported activity multipliers", E(`NUTRITION_SAFETY.activityMultipliers.every(activity=>validateNutritionCalculatorInput({sex:"m",age:30,ft:6,inches:0,lb:180,activity:activity,goalAdj:0}).ok) && !validateNutritionCalculatorInput({sex:"m",age:30,ft:6,inches:0,lb:180,activity:1.4,goalAdj:0}).ok`));
check("calculator accepts only the five supported goal adjustments", E(`NUTRITION_SAFETY.goalAdjustments.every(goalAdj=>validateNutritionCalculatorInput({sex:"m",age:30,ft:6,inches:0,lb:250,activity:1.9,goalAdj:goalAdj}).ok) && !validateNutritionCalculatorInput({sex:"m",age:30,ft:6,inches:0,lb:250,activity:1.9,goalAdj:-750}).ok`));

let result=E(`calculateNutritionTargets({sex:"m",age:42,ft:5,inches:11,lb:225,activity:1.55,goalAdj:-500})`);
check("validated calculator retains the exact Mifflin-St Jeor and macro math", result.ok && result.value.bmr===1943 && result.value.tdee===3011 && result.value.cal===2511 && result.value.pro===203 && result.value.fat===70 && result.value.carb===267);
result=E(`calculateNutritionTargets({sex:"m",age:17,ft:5,inches:8,lb:150,activity:1.55,goalAdj:-500})`);
check("17-year-old reference vector uses Low active and returns 2,970 maintenance, 2,470 target, and 20/55/25 macros", result.ok && result.value.isYouth && result.value.activityCategory==="Low active" && result.value.tdee===2970 && result.value.cal===2470 && result.value.pro===124 && result.value.carb===340 && result.value.fat===69);
check("13-year-old female youth equation adds 30 kcal for growth", E(`(()=>{const x={sex:"f",age:13,activity:1.2};const kg=120*0.4536,cm=62*2.54,y=youthEnergyMaintenance(x,kg,cm);return y.growth===30&&y.maintenance===Math.round(55.59-22.25*13+8.43*cm+17.07*kg+30);})()`));
check("13-year-old male youth equation adds 25 kcal for growth", E(`(()=>{const x={sex:"m",age:13,activity:1.2};const kg=120*0.4536,cm=62*2.54,y=youthEnergyMaintenance(x,kg,cm);return y.growth===25&&y.maintenance===Math.round(-447.51+3.68*13+13.01*cm+13.15*kg+25);})()`));
check("ages 14–17 youth equations add 20 kcal for growth", E(`youthEnergyMaintenance({sex:"m",age:14,activity:1.725},140*0.4536,66*2.54).growth===20 && youthEnergyMaintenance({sex:"f",age:17,activity:1.9},140*0.4536,66*2.54).growth===20`));
check("teen 1.2 maps to Inactive", E(`nutritionActivityOption(1.2).youthKey==="inactive"&&nutritionActivityOption(1.2).youthCategory==="Inactive"`));
check("teen 1.375 maps to Low active", E(`nutritionActivityOption(1.375).youthKey==="lowActive"&&nutritionActivityOption(1.375).youthCategory==="Low active"`));
check("teen Moderate 1.55 conservatively maps to Low active", E(`nutritionActivityOption(1.55).youthKey==="lowActive"&&nutritionActivityOption(1.55).youthCategory==="Low active"`));
check("teen 1.725 maps to Active", E(`nutritionActivityOption(1.725).youthKey==="active"&&nutritionActivityOption(1.725).youthCategory==="Active"`));
check("teen 1.9 maps to Very active", E(`nutritionActivityOption(1.9).youthKey==="veryActive"&&nutritionActivityOption(1.9).youthCategory==="Very active"`));
result=E(`calculateNutritionTargets({sex:"m",age:25,ft:6,inches:0,lb:90,activity:1.2,goalAdj:-1000})`);
check("under-floor calculations reject without clamping and use the required explanation", !result.ok && result.estimatedCalories<1200 && result.message===`That goal estimates ${result.estimatedCalories} kcal/day, below BlackPyre’s 1,200 kcal safety floor. Choose a slower goal or talk with a qualified clinician.`);
result=E(`calculateNutritionTargets({sex:"f",age:13,ft:4,inches:0,lb:50,activity:1.2,goalAdj:-1000})`);
check("teen under-floor calculation uses parent-or-guardian and pediatric guidance without clamping", !result.ok && result.estimatedCalories<1200 && result.message===`That goal estimates ${result.estimatedCalories} kcal/day, below BlackPyre’s 1,200 kcal safety floor. Choose a slower goal and review it with a parent or guardian and pediatrician or registered dietitian.`);
check("preset schedule math is exact and preserves the weekly total", E(`JSON.stringify(caloriePresetDaysFor(1800,"frisat"))==="[1700,1700,1700,1700,1700,2050,2050]" && JSON.stringify(caloriePresetDaysFor(1800,"satsun"))==="[2050,1700,1700,1700,1700,1700,2050]" && JSON.stringify(caloriePresetDaysFor(1800,"frisatsun"))==="[2000,1650,1650,1650,1650,2000,2000]" && ["frisat","satsun","frisatsun"].every(mode=>caloriePresetDaysFor(1800,mode).reduce((a,x)=>a+x,0)===12600)`));
check("an under-floor preset is rejected with Same-or-raise guidance", E(`(()=>{const x=validateCalorieSchedule(1250,"frisatsun",null);return !x.ok && /Same target every day/.test(x.message) && /raise the base target/.test(x.message)})()`));
check("an over-maximum preset is rejected with Same-or-lower guidance", E(`(()=>{const x=validateCalorieSchedule(9900,"frisat",null);return !x.ok && /Same target every day/.test(x.message) && /lower the base target/.test(x.message)})()`));
check("custom schedules require exactly seven days", E(`!validateCalorieSchedule(1800,"custom",[1800,1800]).ok`));
check("every custom day independently enforces the calorie floor", E(`!validateCalorieSchedule(1800,"custom",[1199,1800,1800,1800,1800,1800,1800]).ok`));
check("a safe custom week may remain below its budget", E(`(()=>{const x=validateCalorieSchedule(1800,"custom",[1700,1700,1700,1700,1700,1700,1700]);return x.ok && x.total<x.budget})()`));
check("a custom week cannot exceed its budget", E(`!validateCalorieSchedule(1800,"custom",[1900,1800,1800,1800,1800,1800,1800]).ok`));
check("manual macro targets must all be finite and greater than zero", E(`!validateNutritionSettingsDraft({startWt:225,goalWt:175,calTarget:1800,proTarget:0,carbGoal:180,fatGoal:55,calSchedMode:"same"}).ok && !validateNutritionSettingsDraft({startWt:225,goalWt:175,calTarget:1800,proTarget:170,carbGoal:Infinity,fatGoal:55,calSchedMode:"same"}).ok`));
check("manual target validation rejects a calorie target below 1,200", E(`!validateNutritionSettingsDraft({startWt:225,goalWt:175,calTarget:1199,proTarget:170,carbGoal:180,fatGoal:55,calSchedMode:"same"}).ok`));

const legacyCfg=Object.assign({},EXISTING_CFG,{calTarget:1199});
const legacy=boot(legacyCfg,EMPTY_DATA);
check("migration preserves an existing unsafe value instead of silently rewriting it", legacy.window.eval(`cfg.calTarget`)===1199 && JSON.parse(legacy.window.localStorage.getItem("forge:cfg")).calTarget===1199);

const html=fs.readFileSync("index.html","utf8"), faq=fs.readFileSync("data-faq.js","utf8"), sw=fs.readFileSync("sw.js","utf8");
check("static UI carries 13–100 bounds, assertive errors, pregnancy scope, and estimate wording",
  /id="cAge"[^>]*min="13"[^>]*max="100"/.test(html)
  && /id="calcError"[^>]*role="alert"[^>]*aria-live="assertive"/.test(html)
  && /id="calcOut"[^>]*aria-live="polite"/.test(html)
  && /pregnan(?:cy|t)|breastfeeding/i.test(html)
  && /Estimated metabolism from your logs/.test(html));
check("youth calculation assets remain current and the FAQ release cache is active",
  !/3,?273|2,?773/.test(
    html
    +fs.readFileSync("scripts/01-storage.js","utf8")
    +fs.readFileSync("scripts/06-settings.js","utf8")
  )
  && /blackpyre-v121-food-catalog-1/.test(sw)
  && !/blackpyre-v78-native-parity-7|blackpyre-phase1-nutrition-safety-[12]/.test(sw));

setv("cAge",42); setv("cFt",5); setv("cIn",11); setv("cWt",190); setv("cAct",1.55); setv("cGoal",-500);
click("calcMacrosBtn");
check("valid Settings calculation renders results, saves all inputs including its own weight, and shows valid-only success feedback", !D.getElementById("calcOut").classList.contains("hidden") && D.getElementById("calcMacrosBtn").textContent==="✓ Calculated" && JSON.parse(W.localStorage.getItem("forge:cfg")).calcInputs.age===42 && JSON.parse(W.localStorage.getItem("forge:cfg")).calcInputs.lb===190);
const validStored=W.localStorage.getItem("forge:cfg");
setv("cAge",12); click("calcMacrosBtn");
check("invalid calculation clears stale output and result, removes success state, and does not persist invalid inputs", D.getElementById("calcOut").classList.contains("hidden") && E(`lastCalc===null`) && D.getElementById("calcMacrosBtn").textContent==="Calculate" && !D.getElementById("calcMacrosBtn").classList.contains("acked") && D.getElementById("calcError").textContent==="The calculator supports ages 13–100. It is not designed for children under 13." && W.localStorage.getItem("forge:cfg")===validStored);
check("calculator rejection is assertive and marks the related field invalid", D.getElementById("calcError").getAttribute("role")==="alert" && D.getElementById("calcError").getAttribute("aria-live")==="assertive" && D.getElementById("cAge").getAttribute("aria-invalid")==="true");
setv("cAge",17);
check("editing a calculator input clears stale inline feedback and aria-invalid", D.getElementById("calcError").classList.contains("hidden") && !D.getElementById("calcError").textContent && !D.getElementById("cAge").hasAttribute("aria-invalid"));
check("Settings switches to the exact teen activity descriptions and explains whole-day movement", Array.from(D.getElementById("cAct").options).map(x=>x.textContent).join("|")==="Inactive (mostly seated; minimal daily movement)|Low active (some daily walking and activity)|Low active + exercise (daily movement and 3–5 workouts/week)|Active (high daily movement and frequent exercise)|Very active (vigorous daily work or hard training)" && /whole day/.test(D.getElementById("cActivityNote").textContent));
setv("cFt",5); setv("cIn",8); setv("cWt",150); setv("cAct",1.55); setv("cGoal",-500); click("calcMacrosBtn");
check("valid teen result displays the resolved youth activity category", /Youth activity category: Low active/.test(D.getElementById("calcOutText").textContent));
check("teen Recommended split displays 20/55/25 and the reference grams", /20% protein · 55% carbs · 25% fat/.test(D.getElementById("splitGrams").textContent) && /124g P/.test(D.getElementById("splitGrams").textContent) && /340g C/.test(D.getElementById("splitGrams").textContent) && /69g F/.test(D.getElementById("splitGrams").textContent));
const teenStored=W.localStorage.getItem("forge:cfg");
setv("cAge",18);
check("editing a valid calculator input invalidates stale output without persisting the draft", D.getElementById("calcOut").classList.contains("hidden") && E(`lastCalc===null`) && D.getElementById("calcMacrosBtn").textContent==="Calculate" && W.localStorage.getItem("forge:cfg")===teenStored);
check("Settings restores the exact adult activity descriptions at age 18", Array.from(D.getElementById("cAct").options).map(x=>x.textContent).join("|")==="Sedentary (desk job, little exercise)|Light (1–3 workouts/week)|Moderate (3–5 workouts/week)|Very active (6–7 workouts/week or physical job)|Athlete (2-a-days or heavy labor + training)" && D.getElementById("cActivityNote").classList.contains("hidden"));

const reboot=boot(JSON.parse(validStored),Object.assign({},EMPTY_DATA,{weights:[{date:dstr(0),lbs:225}]}));
check("calculator weight survives a full reboot independently from a 225-lb starting weight and latest weigh-in", reboot.window.document.getElementById("cWt").value==="190");
const legacyLatest=boot(Object.assign({},EXISTING_CFG,{calcInputs:{sex:"m",age:42,ft:5,inches:11,act:1.55,goal:-500}}),Object.assign({},EMPTY_DATA,{weights:[{date:dstr(0),lbs:225}]}));
check("legacy calculator inputs without a valid weight fall back to the latest weigh-in", legacyLatest.window.document.getElementById("cWt").value==="225");
const legacyStart=boot(Object.assign({},EXISTING_CFG,{startWt:210,calcInputs:{sex:"m",age:42,ft:5,inches:11,act:1.55,goal:-500}}),EMPTY_DATA);
check("legacy calculator inputs without a weigh-in fall back to starting weight", legacyStart.window.document.getElementById("cWt").value==="210");

const beforeInvalid=W.localStorage.getItem("forge:cfg");
setv("sCalTarget",1199); click("saveSettingsBtn");
check("failed manual validation preserves both in-memory and persisted settings", E(`cfg.calTarget===1800`) && W.localStorage.getItem("forge:cfg")===beforeInvalid);
check("failed manual calorie save shows a persistent inline error and marks the calorie field", !D.getElementById("settingsSaveError").classList.contains("hidden") && /1,200/.test(D.getElementById("settingsSaveError").textContent) && D.getElementById("sCalTarget").getAttribute("aria-invalid")==="true");
setv("sCalTarget",1800); setv("sProTarget",0); click("saveSettingsBtn");
check("any invalid manual macro marks all three macro fields", ["sProTarget","sCarb","sFat"].every(id=>D.getElementById(id).getAttribute("aria-invalid")==="true"));
setv("sProTarget",170); setv("sCalSched","custom"); [0,1,2,3,4,5,6].forEach(i=>setv("sSched"+i,1800)); setv("sSched3",1199); click("saveSettingsBtn");
check("unsafe custom schedule marks only the exact rejected day", D.getElementById("sSched3").getAttribute("aria-invalid")==="true" && [0,1,2,4,5,6].every(i=>!D.getElementById("sSched"+i).hasAttribute("aria-invalid")));
[0,1,2,3,4,5,6].forEach(i=>setv("sSched"+i,i===0?1900:1800)); click("saveSettingsBtn");
const overBudgetMarks=[0,1,2,3,4,5,6].every(i=>D.getElementById("sSched"+i).getAttribute("aria-invalid")==="true");
setv("sCalTarget",1250); setv("sCalSched","frisatsun"); click("saveSettingsBtn");
check("over-budget custom and unsafe preset errors identify every required schedule control", overBudgetMarks && D.getElementById("sCalTarget").getAttribute("aria-invalid")==="true" && D.getElementById("sCalSched").getAttribute("aria-invalid")==="true");

setv("sCalTarget",2000); setv("sCalSched","custom"); [0,1,2,3,4,5,6].forEach(i=>setv("sSched"+i,1800));
check("schedule preview uses the unsaved calorie target currently displayed in Settings", /Weekly budget 14000/.test(D.getElementById("schedTotalNote").textContent) && /remaining 1400/.test(D.getElementById("schedTotalNote").textContent));
click("schedAutoBtn");
check("schedule auto-balance uses the draft weekly budget instead of the previously saved target", [0,1,2,3,4,5,6].every(i=>D.getElementById("sSched"+i).value==="2000") && /balanced/.test(D.getElementById("schedTotalNote").textContent));

setv("sCalSched","same"); setv("sCalTarget",1900); setv("sProTarget",175); setv("sCarb",190); setv("sFat",60);
const proto=Object.getPrototypeOf(W.localStorage), originalSet=proto.setItem, beforeFailure=W.localStorage.getItem("forge:cfg");
proto.setItem=function(key,value){ if(key==="forge:cfg") throw new Error("denied"); return originalSet.call(this,key,value); };
click("saveSettingsBtn");
proto.setItem=originalSet;
check("failed persistence rolls memory back while retaining draft fields for retry", E(`cfg.calTarget===1800 && cfg.proTarget===170`) && W.localStorage.getItem("forge:cfg")===beforeFailure && D.getElementById("sCalTarget").value==="1900" && D.getElementById("sProTarget").value==="175");

function estimateData(calories,foodCount,weights){
  const food={};
  for(let i=14;i>=1 && Object.keys(food).length<foodCount;i--) food[dstr(-i)]=[{name:"Logged day",cal:calories,pro:150,carb:180,fat:60,meal:"dinner"}];
  return {food:food,workouts:[],weights:weights||[-14,-10,-5,0].map(offset=>({date:dstr(offset),lbs:200})),meta:{lastBackup:null,logsSince:0}};
}
const estimateCfg=Object.assign({},EXISTING_CFG,{calcInputs:{sex:"m",age:40,ft:6,inches:0,act:1.55,goal:-500}});
const estimate=boot(estimateCfg,estimateData(2000,14));
result=estimate.window.eval(`computeLogTDEEEstimate()`);
check("eligible logs produce the least-squares TDEE estimate and preserve recognized goal adjustment", result.ok && result.tdee===2000 && result.days===14 && result.spanDays===14 && result.requiredDays===10 && result.goalAdjustment===-500 && result.proposal===1500);
const estimateBeforeCfg=JSON.stringify(estimate.window.eval(`cfg`)), estimateBeforeStored=estimate.window.localStorage.getItem("forge:cfg");
estimate.window.document.getElementById("tdeeApplyBtn").dispatchEvent(new estimate.window.Event("click",{bubbles:true}));
check("estimate action is review-only and fills proportionally scaled fields without saving", JSON.stringify(estimate.window.eval(`cfg`))===estimateBeforeCfg && estimate.window.localStorage.getItem("forge:cfg")===estimateBeforeStored && estimate.window.document.getElementById("settingsGoalsDetails").open && estimate.window.document.getElementById("sCalTarget").value==="1500" && estimate.window.document.getElementById("sProTarget").value==="142" && /Nothing has been saved yet/.test(estimate.window.document.getElementById("targetReviewNote").textContent));

const sparse=boot(estimateCfg,estimateData(2000,9));
check("estimate rejects food coverage below max(10, ceil(span × 70%)) and excludes today", sparse.window.eval(`computeLogTDEEEstimate().code`)==="food-coverage");
const unstableWeights=[{date:dstr(-14),lbs:200},{date:dstr(-10),lbs:202},{date:dstr(-5),lbs:205},{date:dstr(0),lbs:207}];
const unstable=boot(estimateCfg,estimateData(2000,14,unstableWeights));
check("estimate rejects a weight trend faster than 3 lb per week", unstable.window.eval(`computeLogTDEEEstimate().code`)==="trend-range");
const unsafeProposal=boot(estimateCfg,estimateData(1300,14));
check("plausible estimate with unsafe proposal stays visible but disables review semantically with explanation", unsafeProposal.window.eval(`computeLogTDEEEstimate().ok`)===true && !unsafeProposal.window.document.getElementById("tdeeCard").classList.contains("hidden") && unsafeProposal.window.document.getElementById("tdeeApplyBtn").disabled && unsafeProposal.window.document.getElementById("tdeeApplyBtn").getAttribute("aria-disabled")==="true" && /1,200/.test(unsafeProposal.window.document.getElementById("tdeeExplanation").textContent));

summary("PHASE 1 NUTRITION SAFETY");
})().catch(error=>{ console.error(error); process.exit(1); });
