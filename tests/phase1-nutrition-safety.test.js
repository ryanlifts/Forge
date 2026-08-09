// Phase 1 focused regression suite — nutrition safety and honest log-derived estimates.
const { boot, check, summary, dstr, EXISTING_CFG, EMPTY_DATA } = require("./harness");
const fs=require("fs");
const path=require("path");

(()=>{
const dom=boot(EXISTING_CFG,EMPTY_DATA);
const W=dom.window;
const D=W.document;
const E=code=>W.eval(code);
const setv=(id,value)=>{
  const el=D.getElementById(id);
  el.value=String(value);
  el.dispatchEvent(new W.Event("input",{bubbles:true}));
  el.dispatchEvent(new W.Event("change",{bubbles:true}));
};
const click=id=>D.getElementById(id).dispatchEvent(new W.Event("click",{bubbles:true}));

const nativePrep=fs.readFileSync(path.join(__dirname,"..","tools","prepare-native.sh"),"utf8");
check("native preparation packages Phase 1 source before Capacitor sync",
  nativePrep.includes("index.html")
  && nativePrep.includes("data-faq.js")
  && /cp -R scripts vendor assets www\//.test(nativePrep)
  && nativePrep.indexOf("data-faq.js")<nativePrep.indexOf("npx cap sync ios")
  && nativePrep.indexOf("cp -R scripts")<nativePrep.indexOf("npx cap sync ios")
);

check("self-directed calorie floor is 1,200 kcal",E("MIN_DAILY_CALORIE_TARGET")===1200);
check("1,200 kcal boundary is accepted",E("calorieTargetSafety(1200).ok")===true);
check("1,199 kcal is rejected",E("calorieTargetSafety(1199).ok")===false);
check("non-numeric calorie targets are rejected",E("calorieTargetSafety('nope').ok")===false);

check("calculator accepts a supported adult input set",E("safeMacroCalculation('m',42,5,11,225,1.55,-500).ok")===true);
check("calculator accepts a supported teen input set",E("safeMacroCalculation('m',17,5,8,150,1.55,-500).ok")===true);
check("calculator rejects ages below 13",E("safeMacroCalculation('m',12,5,8,150,1.55,-500).ok")===false);
check("teen Moderate maps conservatively to Low active",E("teenActivityCategory(1.55)")==="low");
check("teen high-movement options map to Active and Very active",E("teenActivityCategory(1.725)")==="active" && E("teenActivityCategory(1.9)")==="very");
check("teen calculator uses the 2023 Low active youth equation",E("calcTeenMacros('m',17,5,8,150,1.55,-500).tdee")===2970);
check("teen calculator applies the selected goal adjustment",E("calcTeenMacros('m',17,5,8,150,1.55,-500).cal")===2470);
check("teen recommended split starts at 20/55/25",E(`(()=>{const x=calcTeenMacros('m',17,5,8,150,1.55,-500);return x.pro===124&&x.carb===340&&x.fat===69;})()`));
check("teen calculator retains loss, maintenance, and gain goals",E(`[-1000,-500,-250,0,250].every(g=>safeMacroCalculation('m',17,5,8,150,1.55,g).ok)`));
check("calculator rejects inches outside 0–11",E("safeMacroCalculation('m',42,5,12,225,1.55,-500).ok")===false);
check("calculator rejects weight outside 50–700 lb",E("safeMacroCalculation('m',42,5,11,49,1.55,-500).ok")===false);
check("calculator blocks a mathematically valid result below the floor",E("safeMacroCalculation('m',25,6,0,90,1.2,-1000).ok")===false);

E("window.__phase1Flash=null; flashSave=(m,e)=>{window.__phase1Flash={m,e}};");
setv("cAge",25); setv("cFt",6); setv("cIn",0); setv("cWt",90); setv("cAct",1.2); setv("cGoal",-1000);
click("calcMacrosBtn");
check("unsafe calculation clears stale output",E("lastCalc===null") && D.getElementById("calcOut").classList.contains("hidden"));
check("unsafe calculation never gets green registered-tap feedback",!D.getElementById("calcMacrosBtn").classList.contains("acked"));
check("unsafe calculation gives a specific floor message",E("window.__phase1Flash.e===true && /1,200/.test(window.__phase1Flash.m)"));
check("unsafe calculation shows the floor message beside the calculator",!D.getElementById("calcValidationError").classList.contains("hidden") && /1,200/.test(D.getElementById("calcValidationError").textContent));

setv("cAge",12); setv("cFt",5); setv("cIn",8); setv("cWt",150); setv("cAct",1.55); setv("cGoal",-500);
click("calcMacrosBtn");
check("under-13 calculation shows a visible age explanation",!D.getElementById("calcValidationError").classList.contains("hidden") && /13/.test(D.getElementById("calcValidationError").textContent));

setv("cAge",17); setv("cFt",5); setv("cIn",8); setv("cWt",150); setv("cAct",1.55); setv("cGoal",-500);
click("calcMacrosBtn");
check("teen calculation succeeds with registered-tap feedback",E("lastCalc!==null && lastCalc.isTeen===true") && D.getElementById("calcMacrosBtn").classList.contains("acked"));
check("teen guidance is visible without disabling the goal",!D.getElementById("calcTeenModeNote").classList.contains("hidden") && D.getElementById("cGoal").disabled===false);
check("teen activity choices explain total-movement categories",D.querySelector('#cAct option[value="1.55"]').textContent.includes("Low active + exercise") && D.querySelector('#cAct option[value="1.725"]').textContent.startsWith("Active"));
check("teen result names the youth activity category",/Youth activity category:\s*Low active/.test(D.getElementById("calcOutText").textContent));
check("teen calculation retains macro and Apply controls",!D.getElementById("calcOut").classList.contains("hidden") && !D.getElementById("calcMacroControls").classList.contains("hidden") && !D.getElementById("applyMacrosBtn").disabled);
check("a valid teen calculation clears the prior inline error",D.getElementById("calcValidationError").classList.contains("hidden"));

setv("cAge",42); setv("cFt",5); setv("cIn",11); setv("cWt",225); setv("cAct",1.55); setv("cGoal",-500);
check("adult activity labels return when age changes",D.querySelector('#cAct option[value="1.55"]').textContent.includes("Moderate (3–5 workouts/week)"));
click("calcMacrosBtn");
check("valid calculation retains green registered-tap feedback",D.getElementById("calcMacrosBtn").classList.contains("acked") && E("lastCalc!==null"));
check("valid calculation persists its calculator weight",E("cfg.calcInputs.lb")===225);
E(`data.weights=[{date:"${dstr(-1)}",lbs:190}]; renderSettings();`);
check("calculator restores its saved weight instead of the latest weigh-in",Number(D.getElementById("cWt").value)===225);
E("delete cfg.calcInputs.lb; renderSettings();");
check("legacy calculator settings without weight fall back to the latest weigh-in",Number(D.getElementById("cWt").value)===190);
setv("cWt",225); click("calcMacrosBtn");

E("setupStep=1; setupChoice.calcInputs={sex:'m',age:17,ft:5,inches:8,act:1.55,goal:-500}; renderSetupStep();");
check("setup wizard shows conservative teen activity descriptions",D.querySelector('#suAct option[value="1.55"]').textContent.includes("Low active + exercise") && D.querySelector('#suAct option[value="1.725"]').textContent.startsWith("Active"));
setv("suAge",42);
check("setup wizard restores adult activity descriptions",D.querySelector('#suAct option[value="1.55"]').textContent.includes("Moderate (3–5 workouts/week)"));
E("setupStep=1; setupChoice.calcInputs={sex:'m',age:17,ft:5,inches:8,act:1.55,goal:-500}; setupChoice.cw=150; cfg.startWt=150; validateSetupStep();");
check("setup wizard persists starting weight as calculator weight",E("cfg.calcInputs.lb")===150);

check("seven safe schedule days are accepted",E("calorieScheduleSafety([1200,1200,1200,1200,1200,1200,1200]).ok")===true);
check("one under-floor schedule day rejects the whole schedule",E("calorieScheduleSafety([1200,1200,1200,1199,1200,1200,1200]).ok")===false);
check("a 1,200 base cannot use a lower-day preset",E("calorieScheduleSafety(calorieSchedulePreset(1200,'frisat')).ok")===false);
check("a 1,350 base can use every preset safely",E("['frisat','satsun','frisatsun'].every(m=>calorieScheduleSafety(calorieSchedulePreset(1350,m)).ok)")===true);

E("cfg.calTarget=1800; cfg.calSchedMode='same'; cfg.calSchedDays=null; renderSettings();");
setv("sCalTarget",1199);
click("saveSettingsBtn");
check("manual under-floor save preserves the stored target",E("cfg.calTarget")===1800);
check("manual under-floor save is visibly rejected",E("window.__phase1Flash.e===true && /1,200/.test(window.__phase1Flash.m)"));
check("manual under-floor save explains the problem beside Save settings",!D.getElementById("settingsValidationError").classList.contains("hidden") && /1,200/.test(D.getElementById("settingsValidationError").textContent) && D.getElementById("sCalTarget").getAttribute("aria-invalid")==="true");

setv("sCalTarget",1800); setv("sCalSched","custom"); setv("sSched0",1199);
click("saveSettingsBtn");
check("custom under-floor day cannot overwrite the saved schedule",E("cfg.calSchedMode")!=="custom");
check("custom under-floor day is explained and identified inline",!D.getElementById("settingsValidationError").classList.contains("hidden") && /Schedule not saved/.test(D.getElementById("settingsValidationError").textContent) && D.getElementById("sSched0").getAttribute("aria-invalid")==="true");

check("adaptive estimate requires at least 10 sufficiently logged days at 14 days",E("adaptiveTDEERequiredCalorieDays(14)")===10);
check("adaptive estimate scales the log requirement to 70 percent",E("adaptiveTDEERequiredCalorieDays(28)")===20);
check("safe adaptive target proposal preserves the configured goal adjustment",E("adaptiveTargetProposal(2400,-500).target")===1900);
check("adaptive target proposal below 1,200 is blocked",E("adaptiveTargetProposal(1500,-500).ok")===false);

const weightDates=[dstr(-15),dstr(-10),dstr(-5),dstr(-1)];
const foodDates=Array.from({length:10},(_,i)=>dstr(-15+i));
E(`data.weights=${JSON.stringify(weightDates.map((date,i)=>({date,lbs:200-i*0.5})))}; data.food={};`);
for(const date of foodDates) E(`data.food[${JSON.stringify(date)}]=[{name:"Complete day",cal:2000,pro:150,carb:200,fat:60}];`);
E("cfg.calcInputs={sex:'m',age:42,ft:5,inches:11,act:1.55,goal:-500}; renderTDEE();");
check("qualified 14-day history produces a bounded trend estimate",E("lastTDEE!==null && lastTDEE.days===10 && lastTDEE.spanDays===14")===true);
const storedBefore=E("JSON.stringify(cfg)");
const proposed=E("lastTDEE.proposal.target");
click("tdeeApplyBtn");
check("reviewing a log-derived target does not mutate saved settings",E("JSON.stringify(cfg)")===storedBefore);
check("review action places the suggestion in Settings",Number(D.getElementById("sCalTarget").value)===proposed);
check("review action requires an explicit later save",E("window.__phase1Flash.m").includes("Save settings"));

E("data.food={}; renderTDEE();");
check("sparse food history hides the estimate",E("lastTDEE===null") && D.getElementById("tdeeCard").classList.contains("hidden"));

summary("PHASE 1 NUTRITION SAFETY");
})()
