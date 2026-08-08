"use strict";
// ================== FIRST-RUN SETUP WIZARD ==================
let setupStep = 0;
const SETUP_STEPS = 8;
const setupChoice = {
  trainAction:null, cw:null, gw:null, calc:null, applied:false,
  split:{mode:"rec",p:40,c:30,f:30}, schedMode:"same", schedDays:null,
  measureOn:false, waterOn:false
};
const CALCULATOR_FIELD_IDS = Object.freeze({sex:"cSex",age:"cAge",ft:"cFt",inches:"cIn",lb:"cWt",activity:"cAct",goalAdj:"cGoal"});
const SETUP_CALCULATOR_FIELD_IDS = Object.freeze({sex:"suSex",age:"suAge",ft:"suFt",inches:"suIn",lb:"suWt",activity:"suAct",goalAdj:"suGoal"});
const SETTINGS_FIELD_IDS = Object.freeze({
  startWt:"sStartWt",goalWt:"sGoalWt",calTarget:"sCalTarget",proTarget:"sProTarget",carbGoal:"sCarb",fatGoal:"sFat",calSchedMode:"sCalSched",
  "calSchedDays.0":"sSched0","calSchedDays.1":"sSched1","calSchedDays.2":"sSched2","calSchedDays.3":"sSched3",
  "calSchedDays.4":"sSched4","calSchedDays.5":"sSched5","calSchedDays.6":"sSched6"
});
function calculatorAgeIsYouth(value){
  const age=finiteNutritionNumber(value);
  return Number.isInteger(age)&&age>=NUTRITION_SAFETY.minAge&&age<18;
}
function populateNutritionActivitySelect(selectId,age,noteId){
  const select=document.getElementById(selectId);
  if(!select) return;
  const selected=String(select.value||"1.55"), teen=calculatorAgeIsYouth(age);
  select.innerHTML="";
  NUTRITION_ACTIVITY_OPTIONS.forEach(option=>{
    const el=document.createElement("option");
    el.value=String(option.value);
    el.textContent=teen?option.teenLabel:option.adultLabel;
    select.appendChild(el);
  });
  select.value=NUTRITION_ACTIVITY_OPTIONS.some(option=>String(option.value)===selected)?selected:"1.55";
  const note=noteId?document.getElementById(noteId):null;
  if(note){
    note.textContent=teen?"For teens, activity means total movement across the whole day—not workouts alone.":"";
    note.classList.toggle("hidden",!teen);
  }
}
function clearAriaInvalid(fieldMap){
  Object.keys(fieldMap).forEach(key=>{ const el=document.getElementById(fieldMap[key]); if(el) el.removeAttribute("aria-invalid"); });
}
function markAriaInvalid(fieldMap,fields){
  (fields||[]).forEach(field=>{ const id=fieldMap[field], el=id?document.getElementById(id):null; if(el) el.setAttribute("aria-invalid","true"); });
}
function clearSetupCalculatorError(){
  const error=document.getElementById("suCalcError");
  if(error){ error.textContent=""; error.classList.add("hidden"); }
  clearAriaInvalid(SETUP_CALCULATOR_FIELD_IDS);
}
function showSetupCalculatorError(result){
  clearSetupCalculatorError();
  const error=document.getElementById("suCalcError");
  if(error){ error.textContent=result.message; error.classList.remove("hidden"); }
  markAriaInvalid(SETUP_CALCULATOR_FIELD_IDS,result.fields);
}
function hasAnyData(){
  return (data.weights||[]).length>0 || (data.workouts||[]).length>0 || Object.keys(data.food||{}).length>0;
}
let brandStoryMode = "onboarding";
let brandLaunchTimer = null;
const BRAND_LAUNCH_MS = 4000;
function existingInstallForBrandStory(){
  return !!(
    cfg.setupDone
    || cfg.disclaimerAccepted
    || hasAnyData()
    || (typeof cfgShowsEstablishedUse==="function" && cfgShowsEstablishedUse(cfg))
    || (typeof dataContentScore==="function" && dataContentScore(data)>0)
  );
}
function openBrandStory(mode){
  brandStoryMode = mode==="informational" ? "informational" : "onboarding";
  const overlay=document.getElementById("brandStoryOverlay");
  const close=document.getElementById("brandStoryCloseBtn");
  const action=document.getElementById("brandStoryActionBtn");
  close.classList.toggle("hidden",brandStoryMode!=="informational");
  action.textContent=brandStoryMode==="onboarding" ? "Get Started" : "Done";
  overlay.scrollTop=0;
  lockScroll();
  overlay.classList.remove("hidden");
  requestAnimationFrame(()=>{ try { overlay.focus(); } catch(e){} });
}
function finishBrandLaunch(){
  if(brandLaunchTimer!==null){ clearTimeout(brandLaunchTimer); brandLaunchTimer=null; }
  const launch=document.getElementById("brandLaunchOverlay");
  launch.classList.add("hidden");
  launch.setAttribute("aria-hidden","true");
  openBrandStory("onboarding");
}
function openBrandLaunch(){
  const launch=document.getElementById("brandLaunchOverlay");
  lockScroll();
  launch.setAttribute("aria-hidden","false");
  launch.classList.remove("hidden");
  brandLaunchTimer=setTimeout(finishBrandLaunch,BRAND_LAUNCH_MS);
}
function closeInformationalBrandStory(){
  if(brandStoryMode!=="informational") return;
  document.getElementById("brandStoryOverlay").classList.add("hidden");
  unlockScroll();
}
function openSetup(){
  setupStep = 0;
  setupChoice.measureOn = !!cfg.measureOn;
  setupChoice.waterOn = !!cfg.waterOn;
  setupChoice.schedMode = cfg.calSchedMode || "same";
  setupChoice.schedDays = Array.isArray(cfg.calSchedDays) ? cfg.calSchedDays.slice() : null;
  if (cfg.splitState) setupChoice.split = Object.assign({}, cfg.splitState);
  lockScroll();
  document.getElementById("setupOverlay").classList.remove("hidden");
  renderSetupStep();
}
function closeSetup(runAction){
  cfg.setupDone = true;
  saveCfg();
  document.getElementById("setupOverlay").classList.add("hidden");
  unlockScroll();
  renderAll();
  if (runAction && setupChoice.trainAction){
    if (typeof setProgramManagerOpen==="function") setProgramManagerOpen(true);
    activateView("work", "programToolsCard", false);
    if (setupChoice.trainAction==="build") openBuilder(false);
    if (setupChoice.trainAction==="import") document.getElementById("importFile").click();
  }
}
document.getElementById("setupSkip").addEventListener("click", ()=>closeSetup(false));
document.getElementById("setupBack").addEventListener("click", ()=>{
  if (setupStep>0){ captureSetupStep(); setupStep--; renderSetupStep(); }
});
document.getElementById("setupNext").addEventListener("click", ()=>{
  if (!validateSetupStep()) return;
  if (setupStep<SETUP_STEPS-1){ setupStep++; renderSetupStep(); }
  else closeSetup(true);
});
function captureSetupStep(){
  if (setupStep===0){
    const cw=document.getElementById("suWt"), gw=document.getElementById("suGoalWt");
    if(cw) setupChoice.cw=Number(cw.value)||null;
    if(gw) setupChoice.gw=Number(gw.value)||null;
  }
  if (setupStep===1){
    const ids=["suSex","suAge","suFt","suIn","suAct","suGoal"];
    if(ids.every(id=>document.getElementById(id))){
      setupChoice.calcInputs={sex:document.getElementById("suSex").value,age:Number(document.getElementById("suAge").value)||null,
        ft:Number(document.getElementById("suFt").value)||null,inches:Number(document.getElementById("suIn").value)||0,
        lb:cfg.startWt,act:Number(document.getElementById("suAct").value),goal:Number(document.getElementById("suGoal").value)};
    }
  }
  if (setupStep===3){
    const sel=document.getElementById("suSched"); if(sel) setupChoice.schedMode=sel.value;
    if(setupChoice.schedMode==="custom") setupChoice.schedDays=[0,1,2,3,4,5,6].map(i=>Number(document.getElementById("suSched"+i).value)||0);
  }
}
function validateSetupStep(){
  captureSetupStep();
  if (setupStep===0){
    const cw=setupChoice.cw, gw=setupChoice.gw;
    const currentCheck=validateSupportedWeight(cw,"Current weight",false);
    const goalCheck=validateSupportedWeight(gw,"Goal weight",false);
    if (!currentCheck.ok){ flashSave(currentCheck.message, true); return false; }
    if (!goalCheck.ok){ flashSave(goalCheck.message, true); return false; }
    cfg.startWt=cw; cfg.goalWt=gw;
    const dt=todayStr();
    if (!data.weights.some(w=>w.date===dt)) data.weights.push({date:dt,lbs:cw});
    cfg.lastTargetWt=cw; saveCfg(); save(); renderJourney();
  }
  if (setupStep===1){
    const x=setupChoice.calcInputs||{};
    const result=calculateNutritionTargets({sex:x.sex,age:x.age,ft:x.ft,inches:x.inches,lb:x.lb,activity:x.act,goalAdj:x.goal});
    if(!result.ok){ setupChoice.calc=null; showSetupCalculatorError(result); flashSave(result.message,true); return false; }
    clearSetupCalculatorError();
    setupChoice.calc=result.value;
    const previous=cloneJSON(cfg);
    cfg.calcInputs={sex:x.sex,age:x.age,ft:x.ft,inches:x.inches,lb:x.lb,act:x.act,goal:x.goal};
    if(!saveCfg()){ cfg=previous; setupChoice.calc=null; return false; }
  }
  if (setupStep===2){
    if(!setupChoice.calc){ flashSave("Calculate your targets first", true); return false; }
    const g=setupSplitGrams();
    if(!g){ flashSave("Choose a macro split", true); return false; }
    const checked=validateNutritionSettingsDraft({
      startWt:cfg.startWt,goalWt:cfg.goalWt,calTarget:setupChoice.calc.cal,proTarget:g.pro,carbGoal:g.carb,fatGoal:g.fat,
      calSchedMode:"same",calSchedDays:null
    });
    if(!checked.ok){ flashSave(checked.message,true); return false; }
    const previous=cloneJSON(cfg);
    cfg=Object.assign({},cfg,checked.value,{splitState:Object.assign({},setupChoice.split),lastTargetWt:cfg.startWt});
    setupChoice.applied=true;
    if(!saveCfg()){ cfg=previous; setupChoice.applied=false; return false; }
  }
  if (setupStep===3){
    if(!cfg.calTarget){ flashSave("Set nutrition targets first", true); return false; }
    const checked=validateCalorieSchedule(cfg.calTarget,setupChoice.schedMode,setupChoice.schedDays);
    if(!checked.ok){ flashSave(checked.message,true); return false; }
    const previous={mode:cfg.calSchedMode,days:Array.isArray(cfg.calSchedDays)?cfg.calSchedDays.slice():cfg.calSchedDays};
    cfg.calSchedMode=checked.mode; cfg.calSchedDays=checked.mode==="custom"?checked.days.slice():null;
    if(!saveCfg()){ cfg.calSchedMode=previous.mode; cfg.calSchedDays=previous.days; return false; }
  }
  if (setupStep===4){ cfg.measureOn=!!setupChoice.measureOn; cfg.waterOn=!!setupChoice.waterOn; saveCfg(); }
  return true;
}
function suDots(){
  const d=document.getElementById("setupDots"); d.innerHTML="";
  for(let i=0;i<SETUP_STEPS;i++){ const sp=document.createElement("span"); if(i===setupStep) sp.className="on"; d.appendChild(sp); }
}
function setupSplitGrams(){
  const r=setupChoice.calc; if(!r) return null;
  const s=setupChoice.split;
  if(s.mode==="rec") return {pro:r.pro,carb:r.carb,fat:r.fat};
  return {pro:Math.round(r.cal*s.p/100/4),carb:Math.round(r.cal*s.c/100/4),fat:Math.round(r.cal*s.f/100/9)};
}
function renderSetupSplit(){
  const wrap=document.getElementById("suSplitChips"); wrap.innerHTML="";
  SPLIT_PRESETS.forEach(pr=>{
    const b=document.createElement("button"); b.className="xbtn"; b.textContent=pr.label;
    const s=setupChoice.split;
    const active=pr.mode ? s.mode===pr.mode : (s.mode==="preset"&&s.p===pr.p&&s.c===pr.c&&s.f===pr.f);
    if(active) b.style.borderColor="var(--ember)";
    b.addEventListener("click",()=>{
      if(pr.mode==="rec") setupChoice.split={mode:"rec",p:40,c:30,f:30};
      else if(pr.mode==="custom") setupChoice.split={mode:"custom",p:s.p,c:s.c,f:s.f};
      else setupChoice.split={mode:"preset",p:pr.p,c:pr.c,f:pr.f};
      renderSetupStep();
    }); wrap.appendChild(b);
  });
  const custom=document.getElementById("suSplitCustom"); custom.classList.toggle("hidden",setupChoice.split.mode!=="custom");
  if(setupChoice.split.mode==="custom"){
    ["P","C","F"].forEach(k=>document.getElementById("suSp"+k).value=setupChoice.split[k.toLowerCase()]);
    const rebalance=(changed)=>{
      const s=setupChoice.split;
      s[changed]=clampPct(document.getElementById("suSp"+changed.toUpperCase()).value);
      if(changed==="p"){ s.f=Math.max(5,100-s.p-s.c); s.c=100-s.p-s.f; }
      if(changed==="c"){ s.f=Math.max(5,100-s.p-s.c); s.p=100-s.c-s.f; }
      if(changed==="f"){ s.c=Math.max(5,100-s.p-s.f); s.p=100-s.c-s.f; }
      renderSetupStep();
    };
    document.getElementById("suSpP").addEventListener("change",()=>rebalance("p"));
    document.getElementById("suSpC").addEventListener("change",()=>rebalance("c"));
    document.getElementById("suSpF").addEventListener("change",()=>rebalance("f"));
  }
  const g=setupSplitGrams(), s=setupChoice.split;
  const label=s.mode==="rec"?(setupChoice.calc&&setupChoice.calc.isYouth?"20% protein · 55% carbs · 25% fat":"0.9g/lb protein · 25% fat · carbs from the rest"):s.p+"% / "+s.c+"% / "+s.f+"%";
  document.getElementById("suSplitGrams").innerHTML=label+' → <b class="ember-text">'+g.pro+'g P</b> · <b>'+g.carb+'g C</b> · <b>'+g.fat+'g F</b>';
  const warn=document.getElementById("suSplitWarn");
  if(!(setupChoice.calc&&setupChoice.calc.isYouth)&&g.pro<cfg.startWt*0.7){ warn.textContent="This split gives only "+g.pro+"g protein. For muscle retention, choose a higher-protein split."; warn.classList.remove("hidden"); }
  else warn.classList.add("hidden");
}
function setupScheduleDays(mode){
  return caloriePresetDaysFor(cfg.calTarget,mode) || [0,1,2,3,4,5,6].map(()=>cfg.calTarget);
}
function renderSetupSchedNote(){
  const note=document.getElementById("suSchedNote"), budget=cfg.calTarget*7;
  if(setupChoice.schedMode!=="custom"){
    const d=setupScheduleDays(setupChoice.schedMode), hi=Math.max(...d), lo=Math.min(...d);
    const checked=validateCalorieSchedule(cfg.calTarget,setupChoice.schedMode,null);
    note.style.color=checked.ok?"":"var(--warn)";
    note.textContent=checked.ok?(setupChoice.schedMode==="same"?"Weekly budget: "+budget+" kcal ("+cfg.calTarget+" every day).":"Higher days "+hi+" kcal · lower days "+lo+" kcal · weekly total "+budget+" kcal."):checked.message; return;
  }
  const days=[0,1,2,3,4,5,6].map(i=>Number(document.getElementById("suSched"+i).value)||0);
  setupChoice.schedDays=days; const total=days.reduce((a,x)=>a+x,0), diff=budget-total, checked=validateCalorieSchedule(cfg.calTarget,"custom",days);
  note.style.color=checked.ok?"":"var(--warn)";
  note.textContent=!checked.ok?checked.message:(diff>0?"Weekly budget "+budget+" · scheduled "+total+" · remaining "+diff+" kcal.":"Weekly budget "+budget+" · balanced ✓");
}
function renderSetupStep(){
  suDots();
  const body=document.getElementById("setupBody");
  document.getElementById("setupBack").style.visibility=setupStep===0?"hidden":"visible";
  document.getElementById("setupNext").textContent=setupStep===SETUP_STEPS-1?"Finish setup":"Next";
  document.getElementById("setupOverlay").scrollTop=0;

  if(setupStep===0){
    body.innerHTML='<div class="card"><div class="label">Step 1 · Bodyweight goal</div><div class="row" style="margin:10px 0 12px;">'
      +'<div><div class="label">Current weight (lb)</div><input type="number" id="suWt" inputmode="decimal" min="50" max="700" step="any" placeholder="e.g. 225"></div>'
      +'<div><div class="label">Goal weight (lb)</div><input type="number" id="suGoalWt" inputmode="decimal" min="50" max="700" step="any" placeholder="e.g. 175"></div></div>'
      +'<div class="note">Enter your current weight once. BlackPyre saves it as your first weigh-in and starting baseline.</div></div>';
    document.getElementById("suWt").value=setupChoice.cw||""; document.getElementById("suGoalWt").value=setupChoice.gw||"";
  }
  if(setupStep===1){
    const ci=setupChoice.calcInputs||cfg.calcInputs||{};
    body.innerHTML='<div class="card"><div class="label">Step 2 · Calorie calculator</div><div class="row" style="margin:10px 0 10px;">'
      +'<div><div class="label">Sex</div><select id="suSex"><option value="m">Male</option><option value="f">Female</option></select></div><div><div class="label">Age</div><input type="number" id="suAge" inputmode="numeric" min="13" max="100" step="1" placeholder="years"></div></div>'
      +'<div class="row" style="margin-bottom:10px;"><div><div class="label">Height (ft)</div><input type="number" id="suFt" inputmode="numeric" min="4" max="8" step="1" placeholder="ft"></div><div><div class="label">Height (in)</div><input type="number" id="suIn" inputmode="numeric" min="0" max="11" step="1" placeholder="in"></div></div>'
      +'<div class="label">Activity level</div><select id="suAct" style="margin-bottom:10px;"><option value="1.2">Sedentary (desk job, little exercise)</option><option value="1.375">Light (1–3 workouts/week)</option><option value="1.55">Moderate (3–5 workouts/week)</option><option value="1.725">Very active (6–7 workouts/week or physical job)</option><option value="1.9">Athlete (2-a-days or heavy labor + training)</option></select><div class="note hidden" id="suActivityNote" style="margin-top:-4px;margin-bottom:10px;"></div>'
      +'<div class="label">Goal</div><select id="suGoal" style="margin-bottom:10px;"><option value="-1000">Lose 2 lb/week (aggressive)</option><option value="-500">Lose 1 lb/week</option><option value="-250">Lose 0.5 lb/week</option><option value="0">Maintain</option><option value="250">Gain 0.5 lb/week (lean bulk)</option></select>'
      +'<div class="note hidden" id="suCalcError" role="alert" aria-live="assertive" style="color:var(--warn);"></div><div id="suCalcPreview" role="status" aria-live="polite" style="font-size:13px;line-height:1.8;margin-top:8px;"></div><div class="note">Supports ages 13 and up. Ages 13–17 use youth-specific estimates. Results are estimates, not medical advice; consult a physician or registered dietitian before making diet or weight-change decisions, especially if you are under 18 or have a medical condition. This calculator is not designed for pregnancy or breastfeeding. BlackPyre will not save a target below 1,200 kcal/day, and that floor is not a recommendation.</div></div>';
    document.getElementById("suSex").value=ci.sex||"m"; document.getElementById("suAge").value=ci.age||""; document.getElementById("suFt").value=ci.ft||""; document.getElementById("suIn").value=ci.inches||""; document.getElementById("suAct").value=String(ci.act||1.55); document.getElementById("suGoal").value=String(ci.goal!=null?ci.goal:-500);
    populateNutritionActivitySelect("suAct",document.getElementById("suAge").value,"suActivityNote");
    if(setupChoice.calc) document.getElementById("suCalcPreview").innerHTML='Maintenance: <b>'+setupChoice.calc.tdee+'</b> kcal · Target: <b class="ember-text">'+setupChoice.calc.cal+' kcal</b>'+(setupChoice.calc.isYouth?'<br>Youth activity category: <b>'+setupChoice.calc.activityCategory+'</b>':'');
    ["suSex","suAge","suFt","suIn","suAct","suGoal"].forEach(id=>{
      const el=document.getElementById(id), eventName=el.tagName==="SELECT"?"change":"input";
      el.addEventListener(eventName,()=>{
        clearSetupCalculatorError();
        if(id==="suAge") populateNutritionActivitySelect("suAct",el.value,"suActivityNote");
      });
    });
  }
  if(setupStep===2){
    body.innerHTML='<div class="card"><div class="label">Step 3 · Macro split</div><div class="note" style="margin:8px 0 10px;">Choose the same macro split available in Settings.</div><div id="suSplitChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;"></div>'
      +'<div class="row hidden" id="suSplitCustom" style="margin-bottom:10px;"><div><div class="label">Protein %</div><input type="number" id="suSpP" inputmode="numeric"></div><div><div class="label">Carbs %</div><input type="number" id="suSpC" inputmode="numeric"></div><div><div class="label">Fat %</div><input type="number" id="suSpF" inputmode="numeric"></div></div>'
      +'<div id="suSplitGrams" style="font-size:14px;line-height:1.8;"></div><div class="note hidden" id="suSplitWarn" style="color:var(--warn);"></div></div>';
    renderSetupSplit();
  }
  if(setupStep===3){
    body.innerHTML='<div class="card"><div class="label">Step 4 · Calorie schedule</div><select id="suSched" style="margin:10px 0;"><option value="same">Same target every day</option><option value="frisat">Higher Friday & Saturday</option><option value="satsun">Higher Saturday & Sunday</option><option value="frisatsun">Higher Friday–Sunday</option><option value="custom">Custom daily targets</option></select><div id="suSchedCustom" class="hidden">'
      +'<div class="row" style="margin-bottom:8px;">'+[0,1,2,3].map((i)=>'<div><div class="label">'+["Sun","Mon","Tue","Wed"][i]+'</div><input type="number" id="suSched'+i+'" inputmode="numeric" min="1200" max="10000"></div>').join("")+'</div>'
      +'<div class="row">'+[4,5,6].map((i)=>'<div><div class="label">'+["Thu","Fri","Sat"][i-4]+'</div><input type="number" id="suSched'+i+'" inputmode="numeric" min="1200" max="10000"></div>').join("")+'<div></div></div><button class="btn ghost small mt10" id="suSchedAuto" style="width:100%;">Auto-balance to weekly budget</button></div><div class="note" id="suSchedNote" role="status" aria-live="polite"></div></div>';
    const sel=document.getElementById("suSched"); sel.value=setupChoice.schedMode||"same";
    const custom=document.getElementById("suSchedCustom"); custom.classList.toggle("hidden",sel.value!=="custom");
    if(sel.value==="custom"){
      const days=setupChoice.schedDays&&setupChoice.schedDays.length===7?setupChoice.schedDays:setupScheduleDays("same");
      [0,1,2,3,4,5,6].forEach(i=>{ const el=document.getElementById("suSched"+i); el.value=days[i]; el.addEventListener("input",renderSetupSchedNote); });
      document.getElementById("suSchedAuto").addEventListener("click",()=>{ const days=[0,1,2,3,4,5,6].map(i=>Number(document.getElementById("suSched"+i).value)||0),diff=cfg.calTarget*7-days.reduce((a,x)=>a+x,0),per=Math.floor(diff/7),b=days.map(v=>v+per); b[6]+=diff-per*7; [0,1,2,3,4,5,6].forEach(i=>document.getElementById("suSched"+i).value=b[i]); renderSetupSchedNote(); });
    }
    sel.addEventListener("change",()=>{ setupChoice.schedMode=sel.value; if(sel.value==="custom"&&!setupChoice.schedDays) setupChoice.schedDays=setupScheduleDays("same"); renderSetupStep(); });
    renderSetupSchedNote();
  }
  if(setupStep===4){
    body.innerHTML='<div class="card"><div class="label">Step 5 · Optional tracking</div><div class="note" style="margin:8px 0 12px;">You can change either option later in Settings.</div><button class="su-opt'+(setupChoice.measureOn?' sel':'')+'" id="suMeasure"><b>Body measurements</b><div class="su-sub">'+(setupChoice.measureOn?'Enabled':'Disabled')+' · waist, chest, and arm tracking</div></button><button class="su-opt'+(setupChoice.waterOn?' sel':'')+'" id="suWater"><b>Water tracking</b><div class="su-sub">'+(setupChoice.waterOn?'Enabled':'Disabled')+' · daily glass counter on Home</div></button></div>';
    document.getElementById("suMeasure").addEventListener("click",()=>{setupChoice.measureOn=!setupChoice.measureOn;renderSetupStep();});
    document.getElementById("suWater").addEventListener("click",()=>{setupChoice.waterOn=!setupChoice.waterOn;renderSetupStep();});
  }
  if(setupStep===5){
    body.innerHTML='<div class="card"><div class="label">Step 6 · Training</div><div class="note" style="margin:8px 0 12px;">BlackPyre logs your sessions against a program. Pick a path. If you choose <b>Load a program file</b>, your device’s Files picker opens as soon as onboarding finishes so you can select it.</div><div id="suTrain"></div></div>';
    const opts=[[null,"Use the loaded program",esc(program.name||"Built-in program")+" — start logging immediately"],["build","Build my own","Name your days, pick exercises — opens the builder after setup"],["import","Load a program file","From a coach, friend, or AI (.json) — Files opens when onboarding finishes"]];
    const td=document.getElementById("suTrain"); opts.forEach(o=>{const b=document.createElement("button");b.className="su-opt"+(setupChoice.trainAction===o[0]?" sel":"");b.innerHTML='<b>'+o[1]+'</b><div class="su-sub">'+o[2]+'</div>';b.addEventListener("click",()=>{setupChoice.trainAction=o[0];renderSetupStep();});td.appendChild(b);});
  }
  if(setupStep===6){
    body.innerHTML='<div class="card"><div class="label">Step 7 · Food logging</div><div class="note" style="margin-top:8px;line-height:1.75;">Search packaged foods or scan a barcode when connected. My Foods, built-in staples, and food suggestions work offline. If a product is missing, enter the nutrition label and save it for next time.</div></div>';
  }
  if(setupStep===7){
    body.innerHTML='<div class="card"><div class="label">Step 8 · Your data</div><div style="font-size:14px;line-height:1.9;margin-top:8px;">Everything you log stays <b>only on this device</b>. No account, server, or ads.<br><br>Use backup/restore to protect your data or move it to another device.<br><br>Your bodyweight goal, calculator information, macro split, schedule, and tracking choices are now saved in Settings and can be changed anytime.</div></div>';
  }
}
// disclaimer gates everything, once per install; wizard follows on fresh installs only.
// Protected mode is recovery-before-gates: neither overlay may write over unreadable data.
function afterDisclaimer(){
  if (protectedMode) return;
  if (!cfg.setupDone){
    if (hasAnyData()){ cfg.setupDone = true; saveCfg(); }
    else { openSetup(); }
  }
}
function continueFirstLaunchGates(){
  if(brandLaunchTimer!==null){ clearTimeout(brandLaunchTimer); brandLaunchTimer=null; }
  document.getElementById("brandLaunchOverlay").classList.add("hidden");
  document.getElementById("brandStoryOverlay").classList.add("hidden");
  document.getElementById("disclaimerOverlay").classList.add("hidden");
  document.getElementById("setupOverlay").classList.add("hidden");
  if(protectedMode) return;
  if(!cfg.disclaimerAccepted){
    lockScroll();
    document.getElementById("disclaimerOverlay").classList.remove("hidden");
  } else {
    unlockScroll();
    afterDisclaimer();
  }
}
function startFirstLaunchGates(){
  if(protectedMode){
    if(brandLaunchTimer!==null){ clearTimeout(brandLaunchTimer); brandLaunchTimer=null; }
    document.getElementById("brandLaunchOverlay").classList.add("hidden");
    document.getElementById("brandStoryOverlay").classList.add("hidden");
    document.getElementById("disclaimerOverlay").classList.add("hidden");
    document.getElementById("setupOverlay").classList.add("hidden");
    return;
  }
  if(!hasCompletedBrandOnboarding() && existingInstallForBrandStory()){
    markBrandOnboardingCompleted();
  }
  if(!hasCompletedBrandOnboarding()){
    openBrandLaunch();
    return;
  }
  continueFirstLaunchGates();
}
document.getElementById("brandStoryActionBtn").addEventListener("click",()=>{
  if(brandStoryMode==="informational"){
    closeInformationalBrandStory();
    return;
  }
  markBrandOnboardingCompleted();
  continueFirstLaunchGates();
});
document.getElementById("brandStoryCloseBtn").addEventListener("click",closeInformationalBrandStory);
document.getElementById("whyBlackPyreOpenBtn").addEventListener("click",()=>openBrandStory("informational"));
document.getElementById("disclaimerAgreeBtn").addEventListener("click", ()=>{
  if (protectedMode){ flashSave("Not saved — protected mode", true); return; }
  cfg.disclaimerAccepted = todayStr();
  saveCfg();
  document.getElementById("disclaimerOverlay").classList.add("hidden");
  unlockScroll();
  afterDisclaimer();
});
startFirstLaunchGates();
function resumeGatesAfterRecovery(){
  startFirstLaunchGates();
}

// ================== HELP & FAQ ==================

function renderFAQ(){
  const body = document.getElementById("faqBody");
  if (body.childNodes.length) return; // build once
  FAQ.forEach(item=>{
    if (item.sec){
      const h = document.createElement("div");
      h.className = "faq-sec"; h.textContent = item.sec;
      body.appendChild(h);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "faq-item";
    const q = document.createElement("button");
    q.className = "faq-q";
    q.innerHTML = '<span>'+item.q+'</span><span class="arrow">▾</span>';
    const a = document.createElement("div");
    a.className = "faq-a";
    a.innerHTML = item.a;
    q.addEventListener("click", ()=>{
      const open = wrap.classList.toggle("open");
      q.querySelector(".arrow").textContent = open ? "▴" : "▾";
    });
    wrap.appendChild(q); wrap.appendChild(a);
    body.appendChild(wrap);
  });
}
document.getElementById("faqOpenBtn").addEventListener("click", ()=>{
  renderFAQ();
  lockScroll();
  document.getElementById("faqOverlay").classList.remove("hidden");
  document.getElementById("faqOverlay").scrollTop = 0;
});
document.getElementById("faqCloseBtn").addEventListener("click", ()=>{
  document.getElementById("faqOverlay").classList.add("hidden");
  unlockScroll();
});

// ================== MACRO CALCULATOR ==================

function calcMacros(sex, age, ft, inches, lb, activity, goalAdj){
  const result=calculateNutritionTargets({sex:sex,age:age,ft:ft,inches:inches,lb:lb,activity:activity,goalAdj:goalAdj});
  return result.ok ? result.value : null;
}
let lastCalc = null;
let splitState = { mode:"rec", p:40, c:30, f:30 }; // mode: rec | preset | custom
const SPLIT_PRESETS = [
  {label:"Recommended", mode:"rec"},
  {label:"40/30/30", p:40, c:30, f:30},
  {label:"30/40/30", p:30, c:40, f:30},
  {label:"40/40/20", p:40, c:40, f:20},
  {label:"30/35/35", p:30, c:35, f:35},
  {label:"Custom", mode:"custom"},
];
function splitGrams(){
  if (!lastCalc) return null;
  if (splitState.mode==="rec"){
    return { pro:lastCalc.pro, carb:lastCalc.carb, fat:lastCalc.fat };
  }
  return {
    pro: Math.round(lastCalc.cal*splitState.p/100/4),
    carb: Math.round(lastCalc.cal*splitState.c/100/4),
    fat: Math.round(lastCalc.cal*splitState.f/100/9),
  };
}
function renderSplit(){
  const wrap = document.getElementById("splitChips");
  wrap.innerHTML = "";
  SPLIT_PRESETS.forEach(pr=>{
    const b = document.createElement("button");
    b.className = "xbtn";
    b.textContent = pr.label;
    const active = pr.mode ? splitState.mode===pr.mode
      : (splitState.mode==="preset" && splitState.p===pr.p && splitState.c===pr.c && splitState.f===pr.f);
    if (active) b.style.borderColor = "var(--ember)";
    b.addEventListener("click", ()=>{
      if (pr.mode==="rec"){ splitState = {mode:"rec", p:40, c:30, f:30}; }
      else if (pr.mode==="custom"){ splitState = {mode:"custom", p:splitState.p, c:splitState.c, f:splitState.f}; }
      else { splitState = {mode:"preset", p:pr.p, c:pr.c, f:pr.f}; }
      renderSplit();
    });
    wrap.appendChild(b);
  });
  document.getElementById("splitCustomRow").classList.toggle("hidden", splitState.mode!=="custom");
  if (splitState.mode==="custom"){
    document.getElementById("spP").value = splitState.p;
    document.getElementById("spC").value = splitState.c;
    document.getElementById("spF").value = splitState.f;
  }
  const g = splitGrams();
  if (!g) return;
  const label = splitState.mode==="rec"
    ? (lastCalc.isYouth ? "20% protein · 55% carbs · 25% fat" : "0.9g/lb protein · 25% fat · carbs from the rest")
    : splitState.p+"% / "+splitState.c+"% / "+splitState.f+"%";
  document.getElementById("splitGrams").innerHTML =
    label+' → <b class="ember-text">'+g.pro+'g P</b> · <b>'+g.carb+'g C</b> · <b>'+g.fat+'g F</b>';
  // protein floor sanity check
  const wt = Number(document.getElementById("cWt").value) || cfg.startWt;
  const warn = document.getElementById("splitWarn");
  if (!lastCalc.isYouth && g.pro < wt*0.7){
    warn.textContent = "This split gives only "+g.pro+"g protein ("+(Math.round(g.pro/wt*100)/100)+" g/lb). For muscle retention while losing weight, research supports a higher protein share.";
    warn.classList.remove("hidden");
  } else {
    warn.classList.add("hidden");
  }
}
// auto-balancing custom fields: edit P or C -> F absorbs; edit F -> C absorbs
function clampPct(v){ return Math.max(5, Math.min(70, Math.round(Number(v)||0))); }
document.getElementById("spP").addEventListener("input", ()=>{
  splitState.p = clampPct(document.getElementById("spP").value);
  splitState.f = Math.max(5, 100 - splitState.p - splitState.c);
  splitState.c = 100 - splitState.p - splitState.f;
  renderSplit();
});
document.getElementById("spC").addEventListener("input", ()=>{
  splitState.c = clampPct(document.getElementById("spC").value);
  splitState.f = Math.max(5, 100 - splitState.p - splitState.c);
  splitState.p = 100 - splitState.c - splitState.f;
  renderSplit();
});
document.getElementById("spF").addEventListener("input", ()=>{
  splitState.f = clampPct(document.getElementById("spF").value);
  splitState.c = Math.max(5, 100 - splitState.p - splitState.f);
  splitState.p = 100 - splitState.c - splitState.f;
  renderSplit();
});
let calculatorAckTimer=null;
function clearCalculatorInlineError(){
  const error=document.getElementById("calcError");
  error.textContent="";
  error.classList.add("hidden");
  clearAriaInvalid(CALCULATOR_FIELD_IDS);
}
function clearCalculatorResult(message,fields){
  lastCalc=null;
  if(calculatorAckTimer){ clearTimeout(calculatorAckTimer); calculatorAckTimer=null; }
  const button=document.getElementById("calcMacrosBtn");
  button.textContent="Calculate";
  button.classList.remove("acked");
  document.getElementById("calcOut").classList.add("hidden");
  document.getElementById("calcOutText").textContent="";
  document.getElementById("splitGrams").textContent="";
  document.getElementById("calcAggressiveNote").classList.add("hidden");
  clearCalculatorInlineError();
  if(message){
    const error=document.getElementById("calcError");
    error.textContent=message;
    error.classList.remove("hidden");
    markAriaInvalid(CALCULATOR_FIELD_IDS,fields);
  }
}
function acknowledgeCalculation(){
  const button=document.getElementById("calcMacrosBtn");
  if(calculatorAckTimer) clearTimeout(calculatorAckTimer);
  button.textContent="✓ Calculated";
  button.classList.add("acked");
  calculatorAckTimer=setTimeout(()=>{ button.textContent="Calculate"; button.classList.remove("acked"); },1400);
}
["cSex","cAge","cFt","cIn","cWt","cAct","cGoal"].forEach(id=>{
  const el=document.getElementById(id), eventName=el.tagName==="SELECT"?"change":"input";
  el.addEventListener(eventName,()=>{
    clearCalculatorResult();
    if(id==="cAge") populateNutritionActivitySelect("cAct",el.value,"cActivityNote");
  });
});
document.getElementById("calcMacrosBtn").addEventListener("click", ()=>{
  const sex = document.getElementById("cSex").value;
  const age = Number(document.getElementById("cAge").value);
  const ft = Number(document.getElementById("cFt").value);
  const inches = Number(document.getElementById("cIn").value||0);
  const lb = Number(document.getElementById("cWt").value);
  const act = Number(document.getElementById("cAct").value);
  const goal = Number(document.getElementById("cGoal").value);
  const result=calculateNutritionTargets({sex:sex,age:age,ft:ft,inches:inches,lb:lb,activity:act,goalAdj:goal});
  if(!result.ok){ clearCalculatorResult(result.message,result.fields); flashSave(result.message,true); return; }
  lastCalc = result.value;
  const previous=cloneJSON(cfg);
  cfg.calcInputs = {sex:sex, age:age, ft:ft, inches:inches, lb:lb, act:act, goal:goal};
  if(!saveCfg()){ cfg=previous; clearCalculatorResult("The calculation worked, but BlackPyre could not save the calculator inputs. Try again."); return; }
  clearCalculatorInlineError();
  document.getElementById("calcOutText").innerHTML =
    'Maintenance (TDEE): <b>'+lastCalc.tdee+'</b> kcal/day<br>'
    +'Your target: <b class="ember-text">'+lastCalc.cal+' kcal</b>'
    +(lastCalc.isYouth?'<br>Youth activity category: <b>'+lastCalc.activityCategory+'</b>':'');
  document.getElementById("calcOut").classList.remove("hidden");
  const aggressive=document.getElementById("calcAggressiveNote");
  aggressive.textContent=lastCalc.isYouth
    ? "A 2 lb/week goal is aggressive and may not be appropriate for you. Consider a slower goal and review it with a parent or guardian and pediatrician or registered dietitian."
    : "A 2 lb/week goal is aggressive and may not be appropriate for you. Consider a slower goal or talk with a qualified clinician.";
  aggressive.classList.toggle("hidden",goal!==-1000);
  renderSplit();
  acknowledgeCalculation();
});
document.getElementById("applyMacrosBtn").addEventListener("click", ()=>{
  if(!lastCalc) return;
  const g = splitGrams();
  const checked=validateNutritionSettingsDraft({
    startWt:cfg.startWt,goalWt:cfg.goalWt,calTarget:lastCalc.cal,proTarget:g.pro,carbGoal:g.carb,fatGoal:g.fat,
    calSchedMode:cfg.calSchedMode||"same",calSchedDays:cfg.calSchedDays
  });
  if(!checked.ok){ flashSave(checked.message,true); return; }
  const previous=cloneJSON(cfg);
  cfg=Object.assign({},cfg,checked.value,{
    lastTargetWt:Number(document.getElementById("cWt").value)||cfg.lastTargetWt||cfg.startWt,
    splitState:Object.assign({},splitState)
  });
  delete cfg.adjustPromptedAt;
  if(!saveCfg()){ cfg=previous; return; }
  renderAll(); flashSave("Targets applied ✓");
  ackBtn("applyMacrosBtn", "✓ Targets applied");
});

// ---- weight-change adjustment prompt ----
function checkWeightAdjust(newWt){
  const anchor = cfg.lastTargetWt || cfg.startWt;
  const moved = Math.abs(newWt - anchor);
  if (moved < 5) return; // meaningful change only — daily noise never triggers this
  const snooze = cfg.adjustPromptedAt;
  if (snooze!=null && Math.abs(newWt - snooze) < 2.5) return; // they said "not yet" — wait for more change
  const dir = newWt < anchor ? "down" : "up";
  document.getElementById("adjustText").innerHTML =
    "You're <b class=\"ember-text\">"+Math.round(moved*10)/10+" lb "+dir+"</b> since your targets were set ("
    +anchor+" → "+newWt+" lb). Your calorie needs have changed with your weight — want to recalculate?";
  document.getElementById("adjustOverlay").classList.remove("hidden");
  document.getElementById("adjustOverlay").dataset.wt = newWt;
}
document.getElementById("adjustNoBtn").addEventListener("click", ()=>{
  cfg.adjustPromptedAt = Number(document.getElementById("adjustOverlay").dataset.wt);
  saveCfg();
  document.getElementById("adjustOverlay").classList.add("hidden");
});
document.getElementById("adjustYesBtn").addEventListener("click", ()=>{
  const wt = Number(document.getElementById("adjustOverlay").dataset.wt);
  document.getElementById("adjustOverlay").classList.add("hidden");
  // jump to Settings with the calculator prefilled at the new weight
  activateView("settings", null, false);
  const ci = cfg.calcInputs;
  if (ci){
    document.getElementById("cSex").value = ci.sex;
    document.getElementById("cAge").value = ci.age;
    document.getElementById("cFt").value = ci.ft;
    document.getElementById("cIn").value = ci.inches;
    document.getElementById("cAct").value = ci.act;
    document.getElementById("cGoal").value = ci.goal;
  }
  document.getElementById("cWt").value = wt;
  if (ci){
    // inputs are complete — run the calculation immediately
    document.getElementById("calcMacrosBtn").dispatchEvent(new Event("click", {bubbles:true}));
  }
  const cc = document.getElementById("calcMacrosBtn");
  if (cc.scrollIntoView) cc.scrollIntoView({behavior:"smooth", block:"center"});
});

// ================== SETTINGS ==================
function clearSettingsSaveError(){
  const error=document.getElementById("settingsSaveError");
  if(error){ error.textContent=""; error.classList.add("hidden"); }
  clearAriaInvalid(SETTINGS_FIELD_IDS);
}
function showSettingsSaveError(result){
  clearSettingsSaveError();
  const error=document.getElementById("settingsSaveError");
  if(error){ error.textContent=result.message; error.classList.remove("hidden"); }
  markAriaInvalid(SETTINGS_FIELD_IDS,result.fields);
}
Object.values(SETTINGS_FIELD_IDS).forEach(id=>{
  const el=document.getElementById(id);
  if(!el) return;
  el.addEventListener(el.tagName==="SELECT"?"change":"input",clearSettingsSaveError);
});
function renderAutoProgressionSetting(){
  const btn = document.getElementById("autoProgressionToggleBtn");
  if (!btn) return;
  const on = cfg.autoProgressionOn !== false;
  btn.textContent = "Automatic progression: "+(on ? "On" : "Off");
  btn.setAttribute("aria-pressed", String(on));
}
function renderSettings(){
  const shown = v=>Number(v)>0 ? v : "";
  document.getElementById("sStartWt").value = shown(cfg.startWt);
  document.getElementById("sGoalWt").value = shown(cfg.goalWt);
  document.getElementById("sCalTarget").value = shown(cfg.calTarget);
  document.getElementById("sProTarget").value = shown(cfg.proTarget);
  document.getElementById("sCarb").value = shown(cfg.carbGoal);
  document.getElementById("sFat").value = shown(cfg.fatGoal);
  const ci = cfg.calcInputs;
  if (ci){
    document.getElementById("cSex").value = ci.sex || "m";
    document.getElementById("cAge").value = ci.age || "";
    document.getElementById("cFt").value = ci.ft || "";
    document.getElementById("cIn").value = ci.inches || "";
    document.getElementById("cAct").value = String(ci.act || 1.55);
    document.getElementById("cGoal").value = String(ci.goal!=null ? ci.goal : -500);
  }
  const sorted = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const savedCalcWeight=ci?validateSupportedWeight(ci.lb,"Calculator weight",false):{ok:false};
  document.getElementById("cWt").value = savedCalcWeight.ok ? savedCalcWeight.value : (sorted.length ? sorted[sorted.length-1].lbs : shown(cfg.startWt));
  populateNutritionActivitySelect("cAct",document.getElementById("cAge").value,"cActivityNote");
  if (cfg.splitState) splitState = Object.assign({}, cfg.splitState);
  const reviewNote=document.getElementById("targetReviewNote");
  if(reviewNote) reviewNote.classList.add("hidden");
  renderSched();
  renderFoodSuggestionSettings();
  renderAutoProgressionSetting();
}
document.getElementById("autoProgressionToggleBtn").addEventListener("click", ()=>{
  cfg.autoProgressionOn = !(cfg.autoProgressionOn !== false);
  saveCfg();
  renderAutoProgressionSetting();
  flashSave(cfg.autoProgressionOn ? "Automatic progression enabled ✓" : "Automatic progression disabled");
});
document.getElementById("saveSettingsBtn").addEventListener("click", ()=>{
  clearSettingsSaveError();
  const raw=id=>document.getElementById(id).value.trim();
  const schedMode = document.getElementById("sCalSched").value;
  const customDays=schedMode==="custom"?[0,1,2,3,4,5,6].map(i=>raw("sSched"+i)):null;
  const draft={
    startWt:raw("sStartWt")===""?cfg.startWt:raw("sStartWt"),
    goalWt:raw("sGoalWt")===""?cfg.goalWt:raw("sGoalWt"),
    calTarget:raw("sCalTarget"),proTarget:raw("sProTarget"),carbGoal:raw("sCarb"),fatGoal:raw("sFat"),
    calSchedMode:schedMode,calSchedDays:customDays
  };
  const checked=validateNutritionSettingsDraft(draft);
  if(!checked.ok){ schedNote(); showSettingsSaveError(checked); flashSave(checked.message,true); return; }
  const schedSaveMsg=checked.schedule.mode==="custom"&&checked.schedule.total<checked.schedule.budget
    ? "Saved — this week is under your normal weekly budget by "+(checked.schedule.budget-checked.schedule.total)+" calories" : null;
  const previous=cloneJSON(cfg);
  cfg=Object.assign({},cfg,checked.value);
  const sortedW2 = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  cfg.lastTargetWt = sortedW2.length ? sortedW2[sortedW2.length-1].lbs : cfg.lastTargetWt || cfg.startWt;
  delete cfg.adjustPromptedAt;
  if(!saveCfg()){ cfg=previous; showSettingsSaveError({message:"BlackPyre could not save these settings. Your previous settings are still protected; review the fields and try again.",fields:[]}); return; }
  clearSettingsSaveError();
  renderAll(); flashSave(schedSaveMsg || "Settings saved ✓");
  ackBtn("saveSettingsBtn", "✓ Saved");
});
const BACKUP_REMINDER_DAYS = 14;
const BACKUP_REMINDER_SNOOZE_DAYS = 3;
const BACKUP_DAY_MS = 86400000;

function currentBackupMeta(){
  if (!data.meta || typeof data.meta!=="object"){
    data.meta = {lastBackup:null,logsSince:0};
  }
  return data.meta;
}
function backupSafeCfg(){
  const safe = Object.assign({},cfg);
  delete safe.anthropicKey;
  delete safe.openaiKey;
  delete safe.usdaKey;
  return safe;
}
function normalBackupText(){
  return JSON.stringify({cfg:backupSafeCfg(),program:program,data:data},null,2);
}
function verifiedNormalBackupText(){
  const text = normalBackupText();
  let envelope;
  try { envelope = JSON.parse(text); }
  catch(e){ throw new Error("The backup could not be verified as JSON."); }
  const candidate = prepareRecoveryBackupEnvelope(envelope);
  if (!candidate.ok){
    throw new Error(candidate.reason || "The backup could not be verified for restore.");
  }
  return text;
}
function recordBackupAttempt(kind){
  const meta = currentBackupMeta();
  meta.lastBackupAttemptAt = new Date().toISOString();
  meta.lastBackupAttemptKind = kind;
  delete meta.backupReminderSnoozedUntil;
  return meta;
}
function recordBackupActivity(kind){
  const meta = currentBackupMeta();
  meta.lastBackup = todayStr(); // retained for older BlackPyre versions
  meta.logsSince = 0;           // retained as backward-compatible metadata only
  if (kind==="share"){
    meta.lastBackupCompletedAt = new Date().toISOString();
    meta.lastBackupCompletedKind = "share";
  }
  return meta;
}
function backupCanShareFile(file){
  try {
    return !!(
      file
      && navigator.share
      && navigator.canShare
      && navigator.canShare({files:[file]})
    );
  } catch(e){
    return false;
  }
}
function backupDownloadMessage(btnId, fallback){
  ackBtn(btnId,"✓ Download started");
  flashSave(
    (fallback ? "Sharing was unavailable, so a verified backup download started. " : "Verified backup download started. ")+
    "Check your browser or device's Downloads location."
  );
}
function backupShareMessage(btnId){
  ackBtn(btnId,"✓ Backup ready");
  flashSave("Backup ready. Confirm where you saved or shared the file.");
}
function backupFailureMessage(btnId){
  ackBtn(btnId,"✕ Backup failed");
  flashSave("Backup could not be created. Your existing data is unchanged.", true);
}
async function doBackup(btnId, shareAfterSave){
  const shareRequested = shareAfterSave===true;
  if (protectedMode){
    const ok = confirm("This export contains only what BlackPyre could read — it may be incomplete and is NOT a normal backup. Your original data remains preserved on this device. Export anyway?");
    if (!ok) return false;
    const snap = protectedSnapshotStrings ? {
      cfg:JSON.parse(protectedSnapshotStrings.cfg),
      data:JSON.parse(protectedSnapshotStrings.data),
      program:JSON.parse(protectedSnapshotStrings.program)
    } : {cfg:cfg, data:data, program:program};
    const cfgPartial = Object.assign({}, snap.cfg); delete cfgPartial.anthropicKey; delete cfgPartial.openaiKey; delete cfgPartial.usdaKey;
    const partialName = "blackpyre-PARTIAL-"+todayStr()+".json";
    const partialText = JSON.stringify({cfg:cfgPartial, program:snap.program, data:snap.data}, null, 2);
    let partialFile = null;
    if (shareRequested && typeof File==="function"){
      try { partialFile = new File([partialText],partialName,{type:"application/json"}); }
      catch(e){}
    }
    if (shareRequested && backupCanShareFile(partialFile)){
      try {
        await navigator.share({files:[partialFile],title:"BlackPyre partial recovery export",text:"BlackPyre partial recovery export"});
        ackBtn(btnId, "✓ Partial export");
        flashSave("Partial recovery export ready. Confirm where you saved or shared it.");
        return true;
      } catch(error){
        if (error && error.name==="AbortError"){
          flashSave("Partial recovery export sharing canceled. Your original data remains unchanged.");
          return false;
        }
      }
    }
    try { download(partialName,partialText); }
    catch(e){ backupFailureMessage(btnId); return false; }
    ackBtn(btnId, "✓ Partial export");
    flashSave(shareRequested
      ? "Sharing was unavailable, so the partial recovery export download started."
      : "Partial recovery export download started.");
    return true;
  }

  const filename = "blackpyre-backup-"+todayStr()+".json";
  let backupText;
  try { backupText = verifiedNormalBackupText(); }
  catch(e){
    renderBackup();
    backupFailureMessage(btnId);
    return false;
  }

  let file = null;
  if (shareRequested && typeof File==="function"){
    try {
      file = new File([backupText],filename,{type:"application/json"});
    } catch(e){}
  }

  if (shareRequested && backupCanShareFile(file)){
    recordBackupAttempt("share");
    save();
    try {
      await navigator.share({
        files:[file],
        title:"BlackPyre backup",
        text:"BlackPyre backup file"
      });
      recordBackupActivity("share");
      save();
      renderBackup();
      backupShareMessage(btnId);
      return true;
    } catch(error){
      if (error && error.name==="AbortError"){
        renderBackup();
        flashSave("Backup sharing canceled. Your existing logs and settings are unchanged.");
        return false;
      }
      // A browser share failure falls back to a normal browser download.
    }
  }

  try {
    download(filename,backupText);
  } catch(e){
    renderBackup();
    backupFailureMessage(btnId);
    return false;
  }
  recordBackupAttempt("download");
  recordBackupActivity("download");
  save();
  renderBackup();
  backupDownloadMessage(btnId,shareRequested);
  return true;
}
function remindBackupLater(){
  if (protectedMode) return false;
  const meta = currentBackupMeta();
  meta.backupReminderSnoozedUntil =
    new Date(Date.now()+BACKUP_REMINDER_SNOOZE_DAYS*BACKUP_DAY_MS).toISOString();
  save();
  renderBackup();
  flashSave("Backup reminder postponed for "+BACKUP_REMINDER_SNOOZE_DAYS+" days.");
  return true;
}
document.getElementById("exportDataBtn").addEventListener("click", ()=>doBackup("exportDataBtn",false));
document.getElementById("shareDataBtn").addEventListener("click", ()=>doBackup("shareDataBtn",true));
document.getElementById("backupNowBtn").addEventListener("click", ()=>doBackup("backupNowBtn",false));
document.getElementById("backupLaterBtn").addEventListener("click", remindBackupLater);
function exportRawRecoveryOriginals(){
  const payload = makeRawRecoveryEnvelope();
  if (!payload.ok){ flashSave("Raw recovery export unavailable", true); return false; }
  const privacyOk = confirm("This emergency file preserves exact saved strings and may contain private API keys. Store it securely and do not share it. Export raw originals?");
  if (!privacyOk) return false;
  download("blackpyre-RAW-RECOVERY-"+todayStr()+".json", JSON.stringify(payload.envelope, null, 2));
  rawRecoveryExportConfirmed = confirm("Confirm only after the raw recovery file has been saved somewhere safe. Did you save it?");
  flashSave(rawRecoveryExportConfirmed ? "Raw recovery copy confirmed ✓" : "Raw export downloaded — confirmation still required", !rawRecoveryExportConfirmed);
  return rawRecoveryExportConfirmed;
}
function exportStorageDiagnostic(){
  const payload = makeStorageDiagnosticEnvelope();
  if (!payload.ok){ flashSave(payload.reason || "Diagnostic export unavailable", true); return false; }
  const ok = confirm("This emergency diagnostic preserves exact local storage and may contain private API keys and personal logs. Store it securely and do not post it publicly. Export now?");
  if (!ok) return false;
  download("blackpyre-STORAGE-DIAGNOSTIC-"+todayStr()+".json", JSON.stringify(payload.envelope,null,2));
  flashSave("Recovery diagnostic exported ✓");
  ackBtn("exportDiagnosticBtn","✓ Exported");
  return true;
}
document.getElementById("exportDiagnosticBtn").addEventListener("click", exportStorageDiagnostic);
function exportStoredQuarantine(){
  let raw;
  try { raw = localStorage.getItem(QUARANTINE_KEY); }
  catch(e){ flashSave("Recovery copy could not be read", true); return false; }
  if (raw===null){ flashSave("No recovery copy is stored", true); return false; }
  const ok = confirm("This recovery file may contain private API keys because it preserves the original saved strings exactly. Store it securely. Export it now?");
  if (!ok) return false;
  download("blackpyre-RAW-RECOVERY-"+todayStr()+".json", raw);
  flashSave("Recovery copy exported ✓");
  return true;
}
function restoreBestSnapshotFromSettings(options){
  if (protectedMode){
    if (typeof openRecoveryPanel==="function" && recoveryWritesAllowed()) openRecoveryPanel();
    else flashSave("Snapshot restore is available through Protected mode recovery", true);
    return {ok:false,code:"protected"};
  }
  const candidate = buildLkgRecoveryCandidate();
  if (!candidate.ok){ flashSave(candidate.reason || "No validated recovery snapshot is available", true); return candidate; }
  if (!(options&&options.confirmed)){
    const ok = confirm("Restore the best validated recovery snapshot? BlackPyre will preserve the exact current state in a recovery copy before replacing anything.\n\n"+candidate.summary);
    if (!ok) return {ok:false,code:"cancelled"};
  }
  const result = performRecoveryCandidate(candidate,Object.assign({allowNormalRestore:true},options||{}));
  if (result.code==="quarantine-conflict"){
    const replace = confirm("A different recovery copy is already stored. Replace it with the exact current state before restoring this snapshot?");
    if (replace) return restoreBestSnapshotFromSettings({confirmed:true,replaceExistingQuarantine:true});
  }
  if (result.ok){
    flashSave("Recovery snapshot restored ✓");
    ackBtn("restoreSnapshotBtn","✓ Restored");
    renderBackup();
  } else if (result.code!=="cancelled") flashSave(result.reason || "Snapshot restore could not be completed", true);
  return result;
}
document.getElementById("restoreSnapshotBtn").addEventListener("click", ()=>restoreBestSnapshotFromSettings());
function renderRecoveryStatus(){
  const line = document.getElementById("recoveryStatusLine");
  const card = document.getElementById("quarantineCard");
  const best = getBestStoredLkgStatus();
  const count = validSnapshotCount();
  const restoreBtn = document.getElementById("restoreSnapshotBtn");
  const snapshotMeta = document.getElementById("snapshotMetaLine");
  if (restoreBtn) restoreBtn.disabled = !best.ok;
  if (snapshotMeta) snapshotMeta.textContent = best.ok
    ? count+" validated recovery snapshot"+(count===1?"":"s")+" stored on this device. Best snapshot: "+(best.record.savedAt ? new Date(best.record.savedAt).toLocaleString() : "date unavailable")+"."
    : "No validated recovery snapshot is available yet.";
  if (line){
    if (protectedMode) line.textContent = "Automatic recovery is paused while BlackPyre protects the original saved data.";
    else if (lkgStatus.state==="ready") line.textContent = "Automatic recovery protection: ready"+(lkgStatus.savedAt ? " · snapshot "+new Date(lkgStatus.savedAt).toLocaleString() : "")+(lkgStatus.retained ? " · populated snapshot retained" : "")+".";
    else if (lkgStatus.state==="newer") line.textContent = "Automatic recovery protection: a newer-version snapshot is present and was left untouched.";
    else line.textContent = "Automatic recovery protection: unavailable. "+(lkgStatus.message||"");
  }
  if (!card) return;
  const q = getStoredQuarantineStatus();
  const dataDetails = document.getElementById("settingsDataDetails");
  if (q.missing){ card.classList.add("hidden"); if (dataDetails && protectedMode) dataDetails.open = true; return; }
  card.classList.remove("hidden");
  if (dataDetails) dataDetails.open = true;
  const text = document.getElementById("quarantineStatusText");
  if (q.newer) text.textContent = "A recovery copy from a newer BlackPyre is stored. This version will not alter or delete it.";
  else if (q.ok) text.textContent = "Original pre-recovery data is preserved from "+(q.record.quarantinedAt ? new Date(q.record.quarantinedAt).toLocaleString() : "an earlier recovery")+". Delete it only after you are certain the recovered app is correct.";
  else text.textContent = "A recovery record exists but this version cannot fully inspect it. Export it before considering removal.";
  document.getElementById("deleteQuarantineBtn").disabled = !!q.newer || q.code==="storage-read";
}
document.getElementById("exportQuarantineBtn").addEventListener("click", exportStoredQuarantine);
document.getElementById("deleteQuarantineBtn").addEventListener("click", ()=>{
  const q = getStoredQuarantineStatus();
  if (q.newer){ flashSave("Newer recovery copy left untouched", true); return; }
  if (!confirm("Delete the stored recovery copy? This does not affect your current BlackPyre data or last-known-good snapshot.")) return;
  const result = deleteStoredQuarantine();
  flashSave(result.ok ? "Recovery copy deleted ✓" : result.reason, !result.ok);
  renderRecoveryStatus();
});
function renderStorageUse(){
  const el = document.getElementById("storageUseNote");
  if (!el) return;
  try {
    let chars = 0;
    for (let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      chars += k.length + (localStorage.getItem(k)||"").length;
    }
    const kb = (chars*2)/1024; // UTF-16 storage units, approximate by design
    el.textContent = "Browser storage used: ~"+(kb<1024 ? Math.round(kb)+" KB" : (kb/1024).toFixed(1)+" MB")+" (approximate; browsers typically allow 5\u201310 MB)";
  } catch(e){ el.textContent = ""; }
}
function validBackupTime(value, dateOnly){
  if (typeof value!=="string" || !value) return 0;
  const parsed = Date.parse(dateOnly ? value+"T12:00:00" : value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function elapsedBackupDays(time){
  return time>0 ? Math.max(0,Math.floor((Date.now()-time)/BACKUP_DAY_MS)) : 0;
}
function recordedBackupActivity(meta){
  // Completed browser activity has stronger meaning than the compatibility-only
  // date field, so it must win even when today's date parses later than now.
  const completed=validBackupTime(meta.lastBackupCompletedAt,false);
  if(completed){
    return {time:completed,kind:"share-completed"};
  }

  const attempt=validBackupTime(meta.lastBackupAttemptAt,false);
  if(attempt && meta.lastBackupAttemptKind==="download"){
    return {time:attempt,kind:"download-started"};
  }

  const legacy=validBackupTime(meta.lastBackup,true);
  return legacy ? {time:legacy,kind:"legacy"} : null;
}
function backupReminderAnchor(meta){
  const activity = recordedBackupActivity(meta);
  if (activity) return {time:activity.time,source:"backup"};

  const marker = installMarkerStatus();
  const established = marker.ok
    ? validBackupTime(marker.record.establishedAt,false)
    : 0;
  return established ? {time:established,source:"install"} : null;
}
function renderBackup(){
  renderStorageUse();

  const meta = currentBackupMeta();
  const line = document.getElementById("backupMetaLine");
  const activity = recordedBackupActivity(meta);

  if (activity){
    const days = elapsedBackupDays(activity.time);
    const age = days===0 ? "today" : days+" day"+(days===1?"":"s")+" ago";

    if (activity.kind==="share-completed"){
      line.textContent =
        "Last browser share completed: "+age+
        ". A resolved share does not guarantee durable or offsite storage; keep the file somewhere you can access later.";
    } else if (activity.kind==="download-started"){
      line.textContent =
        "Last backup download started: "+age+
        ". Your browser or device controls its configured Downloads location, and BlackPyre cannot confirm the final save; keep another copy somewhere you can access later.";
    } else {
      line.textContent =
        "Last recorded backup activity: "+age+
        ". Keep the backup file somewhere you can access later.";
    }
  } else {
    line.textContent =
      "No backup export is recorded. BlackPyre data remains on this device until you save a backup copy somewhere else.";
  }

  renderRecoveryStatus();

  const card = document.getElementById("backupCard");
  const anchor = backupReminderAnchor(meta);
  const snoozedUntil = validBackupTime(meta.backupReminderSnoozedUntil,false);
  const snoozed = snoozedUntil>Date.now();
  const due = !!(
    anchor
    && !snoozed
    && Date.now()-anchor.time >= BACKUP_REMINDER_DAYS*BACKUP_DAY_MS
  );

  if (!due){
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");
  const days = elapsedBackupDays(anchor.time);
  document.getElementById("backupText").textContent =
    anchor.source==="backup"
      ? "It has been "+days+" days since your last recorded backup activity. Export a fresh copy and save it somewhere you can access later."
      : "It has been "+days+" days since BlackPyre was established on this device and no backup activity is recorded. Export a copy and save it somewhere you can access later.";
}
function restoreBackupEnvelope(b){
  if (protectedMode){
    flashSave("Restore blocked — protected mode", true);
    return {ok:false, code:"protected"};
  }
  if (!isPlainObject(b)){
    flashSave("Restore refused — not a BlackPyre backup", true);
    return {ok:false, code:"envelope"};
  }
  if (hasOwn(b,"recoveryFormatVersion")){
    flashSave("Restore refused — recovery records are not normal backups", true);
    return {ok:false, code:"recovery-record"};
  }
  const present = {cfg:hasOwn(b,"cfg"), data:hasOwn(b,"data"), program:hasOwn(b,"program")};
  if (!present.cfg && !present.data && !present.program){
    flashSave("Restore refused — backup contains no data", true);
    return {ok:false, code:"empty"};
  }
  const current = readStorageStrings();
  if (!current.ok){
    flashSave("Restore refused — browser storage could not be read", true);
    return {ok:false, code:"storage-read"};
  }
  try {
    let incomingCfg;
    if (present.cfg){
      incomingCfg = cloneJSON(b.cfg);
      if (isPlainObject(incomingCfg)){
        AI_CFG_FIELDS.forEach(k=>{ if (!hasOwn(incomingCfg,k) && cfg[k]!==undefined) incomingCfg[k] = cfg[k]; });
      }
    } else incomingCfg = cloneJSON(cfg);

    const rawCfg = JSON.stringify(incomingCfg);
    const rawData = JSON.stringify(present.data ? b.data : data);
    const rawProgram = JSON.stringify(present.program ? b.program : program);
    const prepared = prepareState(rawCfg, rawData, rawProgram, {originalStrings:current.originals});
    if (!prepared.ok){
      flashSave(prepared.kind==="newer"
        ? "Restore refused — backup is from a newer BlackPyre"
        : "Restore refused — "+prepared.reason, true);
      return {ok:false, code:prepared.kind, reason:prepared.reason};
    }
    const committed = commitState(prepared, {writeMask:present});
    if (!committed.ok){
      if (committed.rollbackFailed){
        protectedMode = true;
        protectedModeKind = "failure";
        protectedModeReason = "A restore write failed and browser storage refused a complete rollback. Do not uninstall the app.";
        protectedModeDiagnostic = makeDiagnostic("commit","state","restore-commit-failed",protectedModeReason);
        protectedSnapshotStrings = {data:JSON.stringify(data), cfg:JSON.stringify(cfg), program:JSON.stringify(program)};
        if (typeof showProtectedBanner==="function") showProtectedBanner();
      }
      flashSave("Restore failed — current app data was not replaced", true);
      return {ok:false, code:"commit"};
    }
    applyPreparedState(prepared);
    refreshLastKnownGood("restore");
    renderDayOptions(); renderSessionInputs(); renderAll();
    flashSave("Backup restored ✓");
    ackBtn("importDataBtn", "✓ Restored");
    return {ok:true};
  } catch(err){
    flashSave("Restore refused — backup could not be prepared", true);
    return {ok:false, code:"exception"};
  }
}
document.getElementById("importDataBtn").addEventListener("click", ()=>{
  if (protectedMode){
    if (typeof openRecoveryPanel==="function" && recoveryWritesAllowed()) openRecoveryPanel();
    else flashSave("Restore blocked — protected mode", true);
    return;
  }
  document.getElementById("importDataFile").click();
});
document.getElementById("importDataFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  if (protectedMode){ flashSave("Restore blocked — protected mode", true); e.target.value=""; return; }
  const reader = new FileReader();
  reader.onload = ()=>{
    try { restoreBackupEnvelope(JSON.parse(reader.result)); }
    catch(err){ flashSave("Restore refused — file is not valid JSON", true); }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// ---- quick weigh-in on Home ----
document.getElementById("dashWtBtn").addEventListener("click", ()=>{
  const v = Number(document.getElementById("dashWtInput").value);
  if(!v || v<50 || v>700){ flashSave("Enter a weight", true); return; }
  const dt = todayStr();
  data.weights = data.weights.filter(w=>w.date!==dt);
  data.weights.push({date:dt, lbs:v});
  bumpLog();
  document.getElementById("dashWtInput").value="";
  if (data.weights.length===1){
    const cutting = cfg.goalWt < cfg.startWt;
    if ((cutting && v > cfg.startWt) || (!cutting && v < cfg.startWt)){
      cfg.startWt = v; saveCfg();
      flashSave("Starting line set at "+v+" — the journey begins today");
    }
  }
  save(); renderWeight(); renderDash(); renderTDEE(); renderProjection(); renderWeek();
  flashSave("Weight recorded ✓");
  ackBtn("dashWtBtn", "✓");
  checkWeightAdjust(v);
});
