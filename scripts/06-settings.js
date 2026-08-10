"use strict";
// ================== FIRST-RUN SETUP WIZARD ==================
const ADULT_CALCULATOR_ACTIVITY_LABELS = {
  "1.2":"Sedentary (desk job, little exercise)",
  "1.375":"Light (1–3 workouts/week)",
  "1.55":"Moderate (3–5 workouts/week)",
  "1.725":"Very active (6–7 workouts/week or physical job)",
  "1.9":"Athlete (2-a-days or heavy labor + training)"
};
const TEEN_CALCULATOR_ACTIVITY_LABELS = {
  "1.2":"Inactive (mostly seated; minimal daily movement)",
  "1.375":"Low active (some daily walking and activity)",
  "1.55":"Low active + exercise (daily movement and 3–5 workouts/week)",
  "1.725":"Active (high daily movement and frequent exercise)",
  "1.9":"Very active (vigorous daily work or hard training)"
};
function setCalculatorActivityLabels(selectId,isTeen){
  const select=document.getElementById(selectId); if(!select) return;
  const labels=isTeen?TEEN_CALCULATOR_ACTIVITY_LABELS:ADULT_CALCULATOR_ACTIVITY_LABELS;
  Array.from(select.options).forEach(option=>{ if(labels[option.value]) option.textContent=labels[option.value]; });
}
let setupStep = 0;
const SETUP_STEPS = 8;
const setupChoice = {
  trainAction:null, unitSystem:"imperial", cw:null, gw:null, calc:null, applied:false,
  split:{mode:"rec",p:40,c:30,f:30}, schedMode:"same", schedDays:null,
  measureOn:false, waterOn:false
};
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
  setupChoice.unitSystem = currentUnitSystem();
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
    const cw=document.getElementById("suWt"), gw=document.getElementById("suGoalWt"), units=document.getElementById("suUnits");
    const system=normalizedUnitSystem(units ? units.value : setupChoice.unitSystem);
    setupChoice.unitSystem=system;
    if(cw) setupChoice.cw=cw.value===""?null:poundsFromUnit(cw.value,system);
    if(gw) setupChoice.gw=gw.value===""?null:poundsFromUnit(gw.value,system);
  }
  if (setupStep===1){
    const metric=isMetricSystem(setupChoice.unitSystem);
    const ids=metric?["suSex","suAge","suCm","suAct","suGoal"]:["suSex","suAge","suFt","suIn","suAct","suGoal"];
    if(ids.every(id=>document.getElementById(id))){
      const totalInches=metric
        ? inchesFromUnit(document.getElementById("suCm").value,"metric")
        : totalInchesFromFeetInches(document.getElementById("suFt").value,document.getElementById("suIn").value);
      const height=feetInchesFromTotalInches(totalInches);
      setupChoice.calcInputs={sex:document.getElementById("suSex").value,age:Number(document.getElementById("suAge").value)||null,
        ft:height.ft,inches:height.inches,
        act:Number(document.getElementById("suAct").value),goal:Number(document.getElementById("suGoal").value)};
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
    const range=isMetricSystem(setupChoice.unitSystem)?"23 to 318 kg":"50 to 700 lb";
    if (!cw || cw<50 || cw>700){ flashSave("Enter a current weight from "+range, true); return false; }
    if (!gw || gw<50 || gw>700){ flashSave("Enter a goal weight from "+range, true); return false; }
    cfg.unitSystem=normalizedUnitSystem(setupChoice.unitSystem);
    cfg.startWt=cw; cfg.goalWt=gw;
    const dt=todayStr();
    if (!data.weights.some(w=>w.date===dt)) data.weights.push({date:dt,time:currentTimeValue(),lbs:cw});
    cfg.lastTargetWt=cw; saveCfg(); save(); renderJourney();
  }
  if (setupStep===1){
    const x=setupChoice.calcInputs||{};
    const safe=safeMacroCalculation(x.sex,x.age,x.ft,x.inches,cfg.startWt,x.act,x.goal,setupChoice.unitSystem);
    if(!safe.ok){ setupChoice.calc=null; flashSave(safe.message, true); return false; }
    setupChoice.calc=safe.value;
    cfg.calcInputs={sex:x.sex,age:x.age,ft:x.ft,inches:x.inches,lb:cfg.startWt,act:x.act,goal:x.goal};
    saveCfg();
  }
  if (setupStep===2){
    if(!setupChoice.calc){ flashSave("Calculate your targets first", true); return false; }
    const g=setupSplitGrams();
    if(!g){ flashSave("Choose a macro split", true); return false; }
    cfg.calTarget=setupChoice.calc.cal; cfg.proTarget=g.pro; cfg.carbGoal=g.carb; cfg.fatGoal=g.fat;
    cfg.splitState=Object.assign({},setupChoice.split); cfg.lastTargetWt=cfg.startWt;
    setupChoice.applied=true; saveCfg();
  }
  if (setupStep===3){
    if(!cfg.calTarget){ flashSave("Set nutrition targets first", true); return false; }
    if(setupChoice.schedMode==="custom"){
      const days=setupChoice.schedDays||[];
      const safety=calorieScheduleSafety(days);
      if(!safety.ok){ flashSave(safety.message, true); return false; }
      const total=days.reduce((a,x)=>a+x,0), budget=cfg.calTarget*7;
      if(total>budget){ flashSave("Over weekly budget by "+(total-budget)+" calories", true); return false; }
      cfg.calSchedMode="custom"; cfg.calSchedDays=safety.values;
    } else {
      const preset=setupScheduleDays(setupChoice.schedMode);
      const safety=calorieScheduleSafety(preset);
      if(!safety.ok){ flashSave("That schedule would put a day below "+MIN_DAILY_CALORIE_LABEL+" kcal. Choose Same target every day or raise the base target.", true); return false; }
      cfg.calSchedMode=setupChoice.schedMode; cfg.calSchedDays=null;
    }
    saveCfg();
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
  const label=s.mode==="rec"?(setupChoice.calc.isTeen?"Youth starting split · 20% protein / 55% carbs / 25% fat":(isMetricSystem(setupChoice.unitSystem)?"2.0g/kg protein":"0.9g/lb protein")+" · 25% fat · carbs from the rest"):s.p+"% / "+s.c+"% / "+s.f+"%";
  document.getElementById("suSplitGrams").innerHTML=label+' → <b class="ember-text">'+g.pro+'g P</b> · <b>'+g.carb+'g C</b> · <b>'+g.fat+'g F</b>';
  const warn=document.getElementById("suSplitWarn");
  if(!setupChoice.calc.isTeen&&g.pro<cfg.startWt*0.7){ warn.textContent="This split gives only "+g.pro+"g protein. For muscle retention, choose a higher-protein split."; warn.classList.remove("hidden"); }
  else warn.classList.add("hidden");
}
function setupScheduleDays(mode){
  return calorieSchedulePreset(cfg.calTarget,mode) || [0,1,2,3,4,5,6].map(()=>cfg.calTarget);
}
function renderSetupSchedNote(){
  const note=document.getElementById("suSchedNote"), budget=cfg.calTarget*7;
  if(setupChoice.schedMode!=="custom"){
    const d=setupScheduleDays(setupChoice.schedMode), hi=Math.max(...d), lo=Math.min(...d);
    if(!calorieScheduleSafety(d).ok){ note.style.color="var(--warn)"; note.textContent="This schedule would put a day below "+MIN_DAILY_CALORIE_LABEL+" kcal. Choose Same target every day or raise the base target."; return; }
    note.style.color=""; note.textContent=setupChoice.schedMode==="same"?"Weekly budget: "+budget+" kcal ("+cfg.calTarget+" every day).":"Higher days "+hi+" kcal · lower days "+lo+" kcal · weekly total "+budget+" kcal."; return;
  }
  const days=[0,1,2,3,4,5,6].map(i=>Number(document.getElementById("suSched"+i).value)||0);
  setupChoice.schedDays=days; const total=days.reduce((a,x)=>a+x,0), diff=budget-total;
  if(!calorieScheduleSafety(days).ok){ note.style.color="var(--warn)"; note.textContent="Every day must be at least "+MIN_DAILY_CALORIE_LABEL+" kcal."; return; }
  note.style.color=diff<0?"var(--warn)":"";
  note.textContent=diff>0?"Weekly budget "+budget+" · scheduled "+total+" · remaining "+diff+" kcal.":diff<0?"Over weekly budget by "+(-diff)+" calories.":"Weekly budget "+budget+" · balanced ✓";
}
function renderSetupStep(){
  suDots();
  const body=document.getElementById("setupBody");
  document.getElementById("setupBack").style.visibility=setupStep===0?"hidden":"visible";
  document.getElementById("setupNext").textContent=setupStep===SETUP_STEPS-1?"Finish setup":"Next";
  document.getElementById("setupOverlay").scrollTop=0;

  if(setupStep===0){
    const system=normalizedUnitSystem(setupChoice.unitSystem), unit=unitWeightLabel(system), metric=isMetricSystem(system);
    body.innerHTML='<div class="card"><div class="label">Step 1 · Units &amp; bodyweight goal</div>'
      +'<div class="label" style="margin-top:10px;">Measurement system</div><select id="suUnits" aria-label="Measurement system" style="margin:6px 0 10px;"><option value="imperial">Imperial · lb, ft/in</option><option value="metric">Metric · kg, cm</option></select>'
      +'<div class="row" style="margin:0 0 12px;">'
      +'<div><div class="label">Current weight ('+unit+')</div><input type="number" id="suWt" inputmode="decimal" placeholder="e.g. '+(metric?'102':'225')+'"></div>'
      +'<div><div class="label">Goal weight ('+unit+')</div><input type="number" id="suGoalWt" inputmode="decimal" placeholder="e.g. '+(metric?'79.5':'175')+'"></div></div>'
      +'<div class="note">Enter your current weight once. BlackPyre saves it as your first weigh-in and starting baseline.</div></div>';
    const unitSelect=document.getElementById("suUnits"); unitSelect.value=system;
    document.getElementById("suWt").value=setupChoice.cw?poundsToUnit(setupChoice.cw,system,1):"";
    document.getElementById("suGoalWt").value=setupChoice.gw?poundsToUnit(setupChoice.gw,system,1):"";
    unitSelect.addEventListener("change",()=>{
      const oldSystem=system;
      const cw=document.getElementById("suWt").value, gw=document.getElementById("suGoalWt").value;
      setupChoice.cw=cw===""?null:poundsFromUnit(cw,oldSystem);
      setupChoice.gw=gw===""?null:poundsFromUnit(gw,oldSystem);
      setupChoice.unitSystem=normalizedUnitSystem(unitSelect.value);
      renderSetupStep();
    });
  }
  if(setupStep===1){
    const ci=setupChoice.calcInputs||cfg.calcInputs||{};
    const metric=isMetricSystem(setupChoice.unitSystem);
    const totalInches=ci.ft?totalInchesFromFeetInches(ci.ft,ci.inches||0):null;
    const heightFields=metric
      ? '<div><div class="label">Height (cm)</div><input type="number" id="suCm" inputmode="decimal" min="122" max="244" placeholder="cm"></div>'
      : '<div><div class="label">Height (ft)</div><input type="number" id="suFt" inputmode="numeric" min="4" max="8" placeholder="ft"></div><div><div class="label">Height (in)</div><input type="number" id="suIn" inputmode="decimal" min="0" max="11.99" placeholder="in"></div>';
    const goalOptions=SUPPORTED_GOAL_ADJUSTMENTS.map(value=>'<option value="'+value+'">'+goalRateLabel(value,setupChoice.unitSystem)+'</option>').join("");
    body.innerHTML='<div class="card"><div class="label">Step 2 · Calorie calculator</div><div class="row" style="margin:10px 0 10px;">'
      +'<div><div class="label">Sex</div><select id="suSex"><option value="m">Male</option><option value="f">Female</option></select></div><div><div class="label">Age</div><input type="number" id="suAge" inputmode="numeric" min="13" max="100" placeholder="years"></div></div>'
      +'<div class="row" style="margin-bottom:10px;">'+heightFields+'</div>'
      +'<div class="label">Activity level</div><select id="suAct" style="margin-bottom:10px;"><option value="1.2">Sedentary (desk job, little exercise)</option><option value="1.375">Light (1–3 workouts/week)</option><option value="1.55">Moderate (3–5 workouts/week)</option><option value="1.725">Very active (6–7 workouts/week or physical job)</option><option value="1.9">Athlete (2-a-days or heavy labor + training)</option></select>'
      +'<div class="label">Goal</div><select id="suGoal" style="margin-bottom:10px;">'+goalOptions+'</select>'
      +'<div class="note hidden" id="suTeenModeNote" style="margin-bottom:10px;color:var(--warn);">Ages 13–17 use a youth-specific equation and youth starting macro split. Teen activity means total daily movement, not workouts alone. Review weight-change goals with a parent or guardian and pediatrician or registered dietitian.</div><div id="suCalcPreview" style="font-size:13px;line-height:1.8;margin-top:8px;"></div><div class="note">Supports ages 13 and up. Ages 13–17 use youth-specific estimates. Results are estimates, not medical advice; consult a physician or registered dietitian before making diet or weight-change decisions, especially if you are under 18 or have a medical condition. This calculator is not designed for pregnancy or breastfeeding.</div></div>';
    document.getElementById("suSex").value=ci.sex||"m"; document.getElementById("suAge").value=ci.age||"";
    if(metric) document.getElementById("suCm").value=totalInches?inchesToUnit(totalInches,"metric",1):"";
    else { document.getElementById("suFt").value=ci.ft||""; document.getElementById("suIn").value=ci.inches||""; }
    document.getElementById("suAct").value=String(ci.act||1.55); document.getElementById("suGoal").value=String(ci.goal!=null?ci.goal:-500);
    const syncTeenMode=()=>{ const age=Number(document.getElementById("suAge").value), teen=age>=13&&age<18; document.getElementById("suGoal").disabled=false; document.getElementById("suTeenModeNote").classList.toggle("hidden",!teen); setCalculatorActivityLabels("suAct",teen); };
    document.getElementById("suAge").addEventListener("input",syncTeenMode); syncTeenMode();
    if(setupChoice.calc) document.getElementById("suCalcPreview").innerHTML=setupChoice.calc.isTeen
      ? 'Teen maintenance: <b>'+setupChoice.calc.tdee+'</b> kcal · Youth activity: <b>'+teenActivityCategoryLabel(setupChoice.calc.activityCategory)+'</b> · Selected target: <b class="ember-text">'+setupChoice.calc.cal+' kcal</b>'
      : 'Maintenance: <b>'+setupChoice.calc.tdee+'</b> kcal · Target: <b class="ember-text">'+setupChoice.calc.cal+' kcal</b>';
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
      +'<div class="row">'+[4,5,6].map((i)=>'<div><div class="label">'+["Thu","Fri","Sat"][i-4]+'</div><input type="number" id="suSched'+i+'" inputmode="numeric" min="1200" max="10000"></div>').join("")+'<div></div></div><button class="btn ghost small mt10" id="suSchedAuto" style="width:100%;">Auto-balance to weekly budget</button></div><div class="note" id="suSchedNote"></div></div>';
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
  const kg = lb*0.4536;
  const cm = (ft*12+inches)*2.54;
  const bmr = 10*kg + 6.25*cm - 5*age + (sex==="m"?5:-161);
  const tdee = bmr*activity;
  const cal = Math.round(tdee + goalAdj);
  const pro = Math.round(lb*0.9);
  const fat = Math.round(cal*0.25/9);
  const carb = Math.max(0, Math.round((cal - pro*4 - fat*9)/4));
  return { bmr:Math.round(bmr), tdee:Math.round(tdee), cal:cal, pro:pro, fat:fat, carb:carb };
}
function teenActivityCategory(activity){
  const value=Number(activity);
  if(value===1.2) return "inactive";
  if(value===1.375||value===1.55) return "low";
  if(value===1.725) return "active";
  if(value===1.9) return "very";
  return null;
}
function teenActivityCategoryLabel(category){
  return {inactive:"Inactive",low:"Low active",active:"Active",very:"Very active"}[category]||"Unknown";
}
function calcTeenMacros(sex, age, ft, inches, lb, activity, goalAdj){
  const kg=Number(lb)*0.4536, cm=(Number(ft)*12+Number(inches))*2.54;
  const category=teenActivityCategory(activity);
  const growth=Number(age)<14 ? (sex==="m"?25:30) : 20;
  const male={
    inactive:[-447.51,3.68,13.01,13.15], low:[19.12,3.68,8.62,20.28],
    active:[-388.19,3.68,12.66,20.46], very:[-671.75,3.68,15.38,23.25]
  };
  const female={
    inactive:[55.59,-22.25,8.43,17.07], low:[-297.54,-22.25,12.77,14.73],
    active:[-189.55,-22.25,11.74,18.34], very:[-709.59,-22.25,18.22,14.25]
  };
  const c=(sex==="m"?male:female)[category];
  const estimate=Math.round(c[0]+c[1]*Number(age)+c[2]*cm+c[3]*kg+growth);
  const target=Math.round(estimate+Number(goalAdj));
  return {bmr:null,tdee:estimate,cal:target,pro:Math.round(target*0.20/4),fat:Math.round(target*0.25/9),carb:Math.round(target*0.55/4),isTeen:true,formula:"DRI-2023",activityCategory:category};
}
function validateMacroCalculatorInputs(sex, age, ft, inches, lb, activity, goalAdj, system){
  const heightIn=Number(ft)*12+Number(inches);
  if (sex!=="m" && sex!=="f") return {ok:false, field:"sex", message:"Choose the sex used for the calorie estimate."};
  if (!Number.isInteger(age) || age<NUTRITION_CALCULATOR_LIMITS.minAge || age>NUTRITION_CALCULATOR_LIMITS.maxAge) return {ok:false, field:"age", message:"The calculator supports ages 13–100. It is not designed for children under 13."};
  if (!Number.isFinite(heightIn) || heightIn<NUTRITION_CALCULATOR_LIMITS.minHeightIn || heightIn>NUTRITION_CALCULATOR_LIMITS.maxHeightIn || Number(inches)<0 || Number(inches)>=12) return {ok:false, field:"height", message:isMetricSystem(system)?"Enter a height from 122 to 244 cm.":"Enter a height from 4 ft 0 in to 8 ft 0 in."};
  if (!Number.isFinite(lb) || lb<NUTRITION_CALCULATOR_LIMITS.minWeightLb || lb>NUTRITION_CALCULATOR_LIMITS.maxWeightLb) return {ok:false, field:"weight", message:isMetricSystem(system)?"Enter a weight from 23 to 318 kg.":"Enter a weight from 50 to 700 lb."};
  if (!SUPPORTED_ACTIVITY_LEVELS.includes(Number(activity))) return {ok:false, field:"activity", message:"Choose a supported activity level."};
  if (!SUPPORTED_GOAL_ADJUSTMENTS.includes(Number(goalAdj))) return {ok:false, field:"goal", message:"Choose a supported weight goal."};
  return {ok:true};
}
function safeMacroCalculation(sex, age, ft, inches, lb, activity, goalAdj, system){
  const inputs=validateMacroCalculatorInputs(sex,age,ft,inches,lb,activity,goalAdj,system);
  if(!inputs.ok) return inputs;
  if(Number(age)<18){
    const value=calcTeenMacros(sex,age,ft,inches,lb,activity,goalAdj);
    const target=calorieTargetSafety(value.cal);
    if(!target.ok) return {ok:false,field:"goal",value:value,message:value.cal<MIN_DAILY_CALORIE_TARGET?"That goal estimates "+value.cal+" kcal/day, below BlackPyre’s "+MIN_DAILY_CALORIE_LABEL+" kcal safety floor. Choose a slower goal and review it with a parent or guardian and pediatrician or registered dietitian.":target.message};
    return {ok:true,value:value};
  }
  const value=calcMacros(sex,age,ft,inches,lb,activity,goalAdj);
  const target=calorieTargetSafety(value.cal);
  if(!target.ok){
    return {ok:false, field:"goal", value:value, message:value.cal<MIN_DAILY_CALORIE_TARGET ? "That goal estimates "+value.cal+" kcal/day, below BlackPyre’s "+MIN_DAILY_CALORIE_LABEL+" kcal safety floor. Choose a slower goal or talk with a qualified clinician." : target.message};
  }
  return {ok:true, value:value};
}
function setInlineValidation(id,message){
  const el=document.getElementById(id); if(!el) return;
  el.textContent=message||""; el.classList.toggle("hidden",!message);
}
function renderMainCalculatorAgeMode(){
  const age=Number(document.getElementById("cAge").value), teen=age>=13&&age<18;
  document.getElementById("cGoal").disabled=false;
  document.getElementById("calcTeenModeNote").classList.toggle("hidden",!teen);
  setCalculatorActivityLabels("cAct",teen);
}
function showCalculatorValidationError(result){
  ["cSex","cAge","cFt","cIn","cCm","cWt","cAct","cGoal"].forEach(id=>{ const el=document.getElementById(id); if(el) el.removeAttribute("aria-invalid"); });
  setInlineValidation("calcValidationError",result&&result.message);
  const ids={sex:["cSex"],age:["cAge"],height:isMetricSystem()?["cCm"]:["cFt","cIn"],weight:["cWt"],activity:["cAct"],goal:["cGoal"]};
  (ids[result&&result.field]||[]).forEach(id=>{ const el=document.getElementById(id); if(el) el.setAttribute("aria-invalid","true"); });
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
    ? (lastCalc.isTeen ? "Youth starting split · 20% protein / 55% carbs / 25% fat" : (isMetricSystem()?"2.0g/kg protein":"0.9g/lb protein")+" · 25% fat · carbs from the rest")
    : splitState.p+"% / "+splitState.c+"% / "+splitState.f+"%";
  document.getElementById("splitGrams").innerHTML =
    label+' → <b class="ember-text">'+g.pro+'g P</b> · <b>'+g.carb+'g C</b> · <b>'+g.fat+'g F</b>';
  // protein floor sanity check
  const wt = poundsFromUnit(document.getElementById("cWt").value,currentUnitSystem()) || cfg.startWt;
  const warn = document.getElementById("splitWarn");
  if (!lastCalc.isTeen&&g.pro < wt*0.7){
    const ratio=isMetricSystem()?g.pro/(wt*LB_TO_KG):g.pro/wt;
    warn.textContent = "This split gives only "+g.pro+"g protein ("+(Math.round(ratio*100)/100)+" g/"+unitWeightLabel()+"). For muscle retention while losing weight, research supports a higher protein share.";
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
document.getElementById("calcMacrosBtn").addEventListener("click", ()=>{
  const sex = document.getElementById("cSex").value;
  const age = Number(document.getElementById("cAge").value);
  const totalInches=isMetricSystem()
    ? inchesFromUnit(document.getElementById("cCm").value,"metric")
    : totalInchesFromFeetInches(document.getElementById("cFt").value,document.getElementById("cIn").value||0);
  const height=feetInchesFromTotalInches(totalInches), ft=height.ft, inches=height.inches;
  const lb = poundsFromUnit(document.getElementById("cWt").value,currentUnitSystem());
  const act = Number(document.getElementById("cAct").value);
  const goal = Number(document.getElementById("cGoal").value);
  const safe=safeMacroCalculation(sex,age,ft,inches,lb,act,goal,currentUnitSystem());
  if(!safe.ok){
    lastCalc=null;
    document.getElementById("calcOut").classList.add("hidden");
    showCalculatorValidationError(safe);
    flashSave(safe.message,true);
    return;
  }
  showCalculatorValidationError(null);
  lastCalc = safe.value;
  cfg.calcInputs = {sex:sex, age:age, ft:ft, inches:inches, lb:lb, act:act, goal:goal};
  saveCfg();
  document.getElementById("calcOutText").innerHTML = lastCalc.isTeen
    ? 'Teen maintenance (EER): <b>'+lastCalc.tdee+'</b> kcal/day<br>Youth activity category: <b>'+teenActivityCategoryLabel(lastCalc.activityCategory)+'</b><br>Your selected target: <b class="ember-text">'+lastCalc.cal+' kcal</b>'
    : 'Maintenance (TDEE): <b>'+lastCalc.tdee+'</b> kcal/day<br>'+'Your target: <b class="ember-text">'+lastCalc.cal+' kcal</b>';
  document.getElementById("calcOut").classList.remove("hidden");
  document.getElementById("calcMacroControls").classList.remove("hidden");
  const safetyNote=document.getElementById("calcSafetyNote");
  const safetyMessage=lastCalc.isTeen
    ? "Ages 13–17 should review nutrition and weight goals with a parent or guardian and pediatrician or registered dietitian."
    : goal===-1000 ? "A "+(isMetricSystem()?"1 kg/week":"2 lb/week")+" goal is aggressive. CDC guidance favors gradual, steady loss; individual needs vary." : "";
  safetyNote.classList.toggle("hidden",!safetyMessage);
  safetyNote.textContent=safetyMessage;
  renderSplit();
  ackBtn("calcMacrosBtn", "✓ Calculated");
});
document.getElementById("applyMacrosBtn").addEventListener("click", ()=>{
  if(!lastCalc) return;
  const g = splitGrams();
  cfg.calTarget = lastCalc.cal;
  cfg.proTarget = g.pro;
  cfg.carbGoal = g.carb; cfg.fatGoal = g.fat;
  cfg.lastTargetWt = poundsFromUnit(document.getElementById("cWt").value,currentUnitSystem()) || cfg.lastTargetWt || cfg.startWt;
  cfg.splitState = Object.assign({}, splitState);
  delete cfg.adjustPromptedAt;
  saveCfg(); renderAll(); flashSave("Targets applied ✓");
  ackBtn("applyMacrosBtn", "✓ Targets applied");
});
function bindCalculatorValidationFields(){
  ["cSex","cAge","cFt","cIn","cCm","cWt","cAct","cGoal"].forEach(id=>{
    const el=document.getElementById(id);
    if(!el || el.dataset.validationBound==="1") return;
    el.dataset.validationBound="1";
    el.addEventListener("input",()=>{ showCalculatorValidationError(null); if(id==="cAge") renderMainCalculatorAgeMode(); });
  });
}
bindCalculatorValidationFields();

// ---- weight-change adjustment prompt ----
function checkWeightAdjust(newWt){
  const anchor = cfg.lastTargetWt || cfg.startWt;
  const moved = Math.abs(newWt - anchor);
  if (moved < 5) return; // meaningful change only — daily noise never triggers this
  const snooze = cfg.adjustPromptedAt;
  if (snooze!=null && Math.abs(newWt - snooze) < 2.5) return; // they said "not yet" — wait for more change
  const dir = newWt < anchor ? "down" : "up";
  const movedLabel=formatBodyWeight(moved,currentUnitSystem(),1);
  document.getElementById("adjustText").innerHTML =
    "You're <b class=\"ember-text\">"+movedLabel+" "+dir+"</b> since your targets were set ("
    +formatBodyWeight(anchor,currentUnitSystem(),1)+" → "+formatBodyWeight(newWt,currentUnitSystem(),1)+"). Your calorie needs have changed with your weight — want to recalculate?";
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
    if(isMetricSystem()) document.getElementById("cCm").value=inchesToUnit(totalInchesFromFeetInches(ci.ft,ci.inches),"metric",1);
    else { document.getElementById("cFt").value = ci.ft; document.getElementById("cIn").value = ci.inches; }
    document.getElementById("cAct").value = ci.act;
    document.getElementById("cGoal").value = ci.goal;
  }
  document.getElementById("cWt").value = poundsToUnit(wt,currentUnitSystem(),1);
  if (ci){
    // inputs are complete — run the calculation immediately
    document.getElementById("calcMacrosBtn").dispatchEvent(new Event("click", {bubbles:true}));
  }
  const cc = document.getElementById("calcMacrosBtn");
  if (cc.scrollIntoView) cc.scrollIntoView({behavior:"smooth", block:"center"});
});

// ================== SETTINGS ==================
function renderAutoProgressionSetting(){
  const btn = document.getElementById("autoProgressionToggleBtn");
  if (!btn) return;
  const on = cfg.autoProgressionOn !== false;
  btn.textContent = "Automatic progression: "+(on ? "On" : "Off");
  btn.setAttribute("aria-pressed", String(on));
  const note=document.getElementById("autoProgressionNote");
  if(note){
    const step=trainingStepDisplay();
    note.textContent="When enabled, BlackPyre may preload the next weight after every programmed set reaches its target. Standard exercises add "+step+" "+unitWeightLabel()+"; assisted exercises reduce assistance by "+step+" "+unitWeightLabel()+". Turn it off to carry the last logged weights forward unchanged.";
  }
}
function renderGoalRateOptions(select){
  if(!select) return;
  const value=select.value || String(cfg.calcInputs&&cfg.calcInputs.goal!=null?cfg.calcInputs.goal:-500);
  select.innerHTML=SUPPORTED_GOAL_ADJUSTMENTS.map(adjustment=>'<option value="'+adjustment+'">'+goalRateLabel(adjustment,currentUnitSystem())+'</option>').join("");
  select.value=SUPPORTED_GOAL_ADJUSTMENTS.includes(Number(value))?String(value):"-500";
}
function renderCalculatorUnitFields(){
  const wrap=document.getElementById("calculatorBodyFields");
  if(!wrap) return;
  const ci=cfg.calcInputs||{};
  const total=ci.ft?totalInchesFromFeetInches(ci.ft,ci.inches||0):null;
  const sorted=data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const savedCalcWt=Number(ci.lb);
  const fallbackCalcWt=sorted.length?sorted[sorted.length-1].lbs:Number(cfg.startWt)||null;
  const canonicalWeight=Number.isFinite(savedCalcWt)&&savedCalcWt>=NUTRITION_CALCULATOR_LIMITS.minWeightLb&&savedCalcWt<=NUTRITION_CALCULATOR_LIMITS.maxWeightLb?savedCalcWt:fallbackCalcWt;
  if(isMetricSystem()){
    wrap.innerHTML='<div><div class="label">Height (cm)</div><input type="number" id="cCm" aria-label="Height in centimeters" inputmode="decimal" min="122" max="244" step="any" placeholder="cm"></div>'
      +'<div><div class="label">Weight (kg)</div><input type="number" id="cWt" aria-label="Body weight in kilograms for calorie calculation" inputmode="decimal" min="23" max="318" step="any" placeholder="kg"></div>'
      +'<div class="hidden"><input id="cFt" tabindex="-1"><input id="cIn" tabindex="-1"></div>';
    document.getElementById("cCm").value=total?inchesToUnit(total,"metric",1):"";
  }else{
    wrap.innerHTML='<div><div class="label">Height (ft)</div><input type="number" id="cFt" aria-label="Height feet" inputmode="numeric" min="4" max="8" placeholder="ft"></div>'
      +'<div><div class="label">Height (in)</div><input type="number" id="cIn" aria-label="Height inches" inputmode="decimal" min="0" max="11.99" step="any" placeholder="in"></div>'
      +'<div><div class="label">Weight (lb)</div><input type="number" id="cWt" aria-label="Body weight in pounds for calorie calculation" inputmode="decimal" min="50" max="700" step="any" placeholder="lb"></div>'
      +'<div class="hidden"><input id="cCm" tabindex="-1"></div>';
    document.getElementById("cFt").value=ci.ft||"";
    document.getElementById("cIn").value=ci.inches||"";
  }
  document.getElementById("cWt").value=canonicalWeight?poundsToUnit(canonicalWeight,currentUnitSystem(),1):"";
  bindCalculatorValidationFields();
}
function renderUnitSystemSetting(){
  const metric=isMetricSystem(), unit=unitWeightLabel();
  const imperial=document.getElementById("unitImperialBtn"), metricBtn=document.getElementById("unitMetricBtn");
  imperial.setAttribute("aria-pressed",String(!metric));
  metricBtn.setAttribute("aria-pressed",String(metric));
  imperial.style.borderColor=!metric?"var(--ember)":"";
  metricBtn.style.borderColor=metric?"var(--ember)":"";
  document.getElementById("sStartWtLabel").textContent="Start weight ("+unit+")";
  document.getElementById("sGoalWtLabel").textContent="Goal weight ("+unit+")";
  document.getElementById("sStartWt").setAttribute("aria-label","Starting body weight in "+(metric?"kilograms":"pounds"));
  document.getElementById("sGoalWt").setAttribute("aria-label","Goal body weight in "+(metric?"kilograms":"pounds"));
  const basis=document.getElementById("adultProteinBasis"); if(basis) basis.textContent=metric?"~2.0 g per kg":"~0.9 g per lb";
  renderGoalRateOptions(document.getElementById("cGoal"));
  renderCalculatorUnitFields();
}
function setUnitSystem(system){
  const next=normalizedUnitSystem(system);
  if(next===currentUnitSystem()) return;
  cfg.unitSystem=next;
  saveCfg();
  lastCalc=null;
  document.getElementById("calcOut").classList.add("hidden");
  renderAll();
  flashSave("Measurements now display in "+(next==="metric"?"metric units":"Imperial units")+" ✓");
}
document.getElementById("unitImperialBtn").addEventListener("click",()=>setUnitSystem("imperial"));
document.getElementById("unitMetricBtn").addEventListener("click",()=>setUnitSystem("metric"));
function renderSettings(){
  const shown = v=>Number(v)>0 ? v : "";
  renderUnitSystemSetting();
  document.getElementById("sStartWt").value = shown(poundsToUnit(cfg.startWt,currentUnitSystem(),1));
  document.getElementById("sGoalWt").value = shown(poundsToUnit(cfg.goalWt,currentUnitSystem(),1));
  document.getElementById("sCalTarget").value = shown(cfg.calTarget);
  document.getElementById("sProTarget").value = shown(cfg.proTarget);
  document.getElementById("sCarb").value = shown(cfg.carbGoal);
  document.getElementById("sFat").value = shown(cfg.fatGoal);
  const ci = cfg.calcInputs;
  if (ci){
    document.getElementById("cSex").value = ci.sex || "m";
    document.getElementById("cAge").value = ci.age || "";
    document.getElementById("cAct").value = String(ci.act || 1.55);
    document.getElementById("cGoal").value = String(ci.goal!=null ? ci.goal : -500);
  }
  if (cfg.splitState) splitState = Object.assign({}, cfg.splitState);
  renderMainCalculatorAgeMode();
  renderSched();
  renderFoodSuggestionSettings();
  renderAutoProgressionSetting();
}
const SETTINGS_VALIDATION_FIELDS = [
  "sStartWt","sGoalWt","sCalTarget","sProTarget","sCarb","sFat","sCalSched",
  "sSched0","sSched1","sSched2","sSched3","sSched4","sSched5","sSched6"
];
function showSettingsValidationError(message,fieldIds){
  SETTINGS_VALIDATION_FIELDS.forEach(id=>document.getElementById(id).removeAttribute("aria-invalid"));
  setInlineValidation("settingsValidationError",message);
  (fieldIds||[]).forEach(id=>document.getElementById(id).setAttribute("aria-invalid","true"));
}
function rejectSettings(message,fieldIds){
  showSettingsValidationError(message,fieldIds);
  flashSave(message,true);
  return false;
}
document.getElementById("autoProgressionToggleBtn").addEventListener("click", ()=>{
  cfg.autoProgressionOn = !(cfg.autoProgressionOn !== false);
  saveCfg();
  renderAutoProgressionSetting();
  flashSave(cfg.autoProgressionOn ? "Automatic progression enabled ✓" : "Automatic progression disabled");
});
document.getElementById("saveSettingsBtn").addEventListener("click", ()=>{
  showSettingsValidationError(null,[]);
  const g = id=>Number(document.getElementById(id).value);
  let schedSaveMsg = null;
  const draft = Object.assign({}, cfg, {
    startWt: poundsFromUnit(g("sStartWt"),currentUnitSystem())||cfg.startWt, goalWt: poundsFromUnit(g("sGoalWt"),currentUnitSystem())||cfg.goalWt,
    calTarget: g("sCalTarget")||cfg.calTarget,
    proTarget: g("sProTarget")||cfg.proTarget,
    carbGoal: g("sCarb")||cfg.carbGoal, fatGoal: g("sFat")||cfg.fatGoal,
  });
  const calSafety=calorieTargetSafety(draft.calTarget);
  if(!calSafety.ok){ rejectSettings(calSafety.message,["sCalTarget"]); return; }
  if(draft.startWt && (draft.startWt<50 || draft.startWt>700)){ rejectSettings(isMetricSystem()?"Starting weight must be between 23 and 318 kg.":"Starting weight must be between 50 and 700 lb.",["sStartWt"]); return; }
  if(draft.goalWt && (draft.goalWt<50 || draft.goalWt>700)){ rejectSettings(isMetricSystem()?"Goal weight must be between 23 and 318 kg.":"Goal weight must be between 50 and 700 lb.",["sGoalWt"]); return; }
  if(![draft.proTarget,draft.carbGoal,draft.fatGoal].every(v=>Number.isFinite(Number(v)) && Number(v)>0)){ rejectSettings("Enter valid protein, carbohydrate, and fat targets.",["sProTarget","sCarb","sFat"]); return; }
  const schedMode = document.getElementById("sCalSched").value;
  if (schedMode==="custom"){
    const days = [0,1,2,3,4,5,6].map(i=>Number(document.getElementById("sSched"+i).value)||draft.calTarget);
    const safety=calorieScheduleSafety(days);
    if(!safety.ok){ schedNote(); rejectSettings(safety.message+" Schedule not saved.",["sSched"+safety.dayIndex]); return; }
    const total = days.reduce((a,x)=>a+x,0);
    const budget = draft.calTarget*7;
    if (total > budget){
      schedNote();
      rejectSettings("Over weekly budget by "+(total-budget)+" calories — schedule not saved",["sSched0","sSched1","sSched2","sSched3","sSched4","sSched5","sSched6"]);
      return; // block: never exceed the weekly budget
    }
    draft.calSchedMode = "custom";
    draft.calSchedDays = safety.values;
    if (total < budget){
      schedSaveMsg = "Saved — this week is under your normal weekly budget by "+(budget-total)+" calories";
    }
  } else {
    const days=calorieSchedulePreset(draft.calTarget,schedMode) || [0,1,2,3,4,5,6].map(()=>draft.calTarget);
    if(!calorieScheduleSafety(days).ok){ rejectSettings("That schedule would put a day below "+MIN_DAILY_CALORIE_LABEL+" kcal. Choose Same target every day or raise the base target.",["sCalTarget","sCalSched"]); return; }
    draft.calSchedMode = schedMode;
    draft.calSchedDays = null; // presets derive live from the calorie target
  }
  const sortedW2 = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  draft.lastTargetWt = sortedW2.length ? sortedW2[sortedW2.length-1].lbs : draft.lastTargetWt || draft.startWt;
  delete draft.adjustPromptedAt;
  cfg=draft;
  saveCfg(); renderAll(); flashSave(schedSaveMsg || "Settings saved ✓");
  ackBtn("saveSettingsBtn", "✓ Saved");
});
SETTINGS_VALIDATION_FIELDS.forEach(id=>{
  const el=document.getElementById(id);
  ["input","change"].forEach(type=>el.addEventListener(type,()=>showSettingsValidationError(null,[])));
});
const OFFSITE_SHARE_REMINDER_DAYS = 14;
const OFFSITE_SHARE_ATTEMPT_GRACE_DAYS = 7;
const OFFSITE_SHARE_SNOOZE_DAYS = 7;
const FIRST_LOG_BACKUP_REMINDER_DAYS = 7;
const BACKUP_DAY_MS = 86400000;
let backupStatusTimer = null;
function showBackupStatus(message){
  const toast = document.getElementById("backupStatusToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(backupStatusTimer);
  backupStatusTimer = setTimeout(()=>toast.classList.add("hidden"),4000);
}
function backupTimestampMs(value){
  if (typeof value!=="string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
function backupElapsedDays(value,nowMs){
  const then = backupTimestampMs(value);
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (then===null) return null;
  return Math.max(0,Math.floor((now-then)/BACKUP_DAY_MS));
}
function offsiteShareReminderDue(meta,nowMs){
  const m = isPlainObject(meta) ? meta : {};
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const snoozedUntil = backupTimestampMs(m.offsiteReminderSnoozedUntil);
  if (snoozedUntil!==null && snoozedUntil>now) return false;
  const completedAt = backupTimestampMs(m.lastShareCompletedAt);
  if (completedAt!==null && now-completedAt<OFFSITE_SHARE_REMINDER_DAYS*BACKUP_DAY_MS) return false;
  const attemptedAt = backupTimestampMs(m.lastShareAttemptAt);
  if (attemptedAt!==null && now-attemptedAt<OFFSITE_SHARE_ATTEMPT_GRACE_DAYS*BACKUP_DAY_MS) return false;
  if (completedAt===null){
    const firstLogAt = backupTimestampMs(m.firstMeaningfulLogAt);
    if (firstLogAt===null || now-firstLogAt<FIRST_LOG_BACKUP_REMINDER_DAYS*BACKUP_DAY_MS) return false;
  }
  return true;
}
function nativeJsonExportCapability(){
  const c = typeof window!=="undefined" ? window.Capacitor : null;
  let native=false, fsAvailable=false, shareAvailable=false, fs=null, share=null;
  try { native = !!(c && typeof c.isNativePlatform==="function" && c.isNativePlatform()); } catch(e){}
  try { fsAvailable = !!(c && typeof c.isPluginAvailable==="function" && c.isPluginAvailable("Filesystem")); } catch(e){}
  try { shareAvailable = !!(c && typeof c.isPluginAvailable==="function" && c.isPluginAvailable("Share")); } catch(e){}
  try {
    fs = c && c.Plugins ? c.Plugins.Filesystem : null;
    share = c && c.Plugins ? c.Plugins.Share : null;
  } catch(e){}
  const saveAvailable = !!(native && fsAvailable && fs
    && typeof fs.writeFile==="function"
    && typeof fs.readFile==="function");
  const canShare = !!(saveAvailable && shareAvailable && share
    && typeof share.share==="function");
  return {available:saveAvailable,shareAvailable:canShare,fs:fs,share:share};
}
async function writeNativeJson(capability,filename,text){
  const written = await capability.fs.writeFile({
    path:filename,
    data:text,
    directory:"DOCUMENTS",
    encoding:"utf8"
  });
  await protectNativeManagedFile(filename,"DOCUMENTS");
  const verified = await capability.fs.readFile({
    path:filename,
    directory:"DOCUMENTS",
    encoding:"utf8"
  });
  if (!verified || verified.data!==text){
    throw new Error("Native backup verification failed.");
  }
  const uri = written && written.uri;
  if (!uri) throw new Error("Native backup did not return a file location.");
  return {ok:true,uri:uri};
}
async function shareNativeJson(capability,nativeFile,title){
  if (!capability.shareAvailable){
    throw new Error("Native sharing is unavailable.");
  }
  return capability.share.share({
    title:title || "BlackPyre backup",
    files:[nativeFile.uri]
  });
}
function isNativeShareCancellation(error){
  const message = error && error.message ? error.message : String(error||"");
  return /cancel/i.test(message);
}
function reportBackupFailure(btnId,error){
  console.error("BlackPyre backup failed:",error);
  flashSave("Backup failed — no backup was recorded",true);
  ackBtn(btnId,"✕ Backup failed");
  return false;
}
function reportShareAfterLocalSave(btnId,error,label){
  const cancelled = isNativeShareCancellation(error);
  console.error("BlackPyre share did not complete:",error);
  if (cancelled){
    flashSave("Backup canceled. Your existing data is unchanged.",false);
    ackBtn(btnId,"↩ Backup canceled");
  } else {
    flashSave("Share failed — "+(label||"backup")+" saved to BlackPyre",true);
    ackBtn(btnId,"✕ Share failed");
  }
  return false;
}
function recordCompletedLocalBackup(shareAttempted){
  const now = new Date().toISOString();
  data.meta = data.meta || {};
  data.meta.lastBackup = todayStr();
  data.meta.logsSince = 0;
  if (shareAttempted){
    data.meta.lastShareAttemptAt = now;
    delete data.meta.offsiteReminderSnoozedUntil;
  }
  save();
  renderBackup();
  return now;
}
function recordCompletedBackupShare(result){
  data.meta = data.meta || {};
  data.meta.lastShareCompletedAt = new Date().toISOString();
  data.meta.lastShareActivityType = result && typeof result.activityType==="string" ? result.activityType : "";
  delete data.meta.offsiteReminderSnoozedUntil;
  save();
  renderBackup();
}
function snoozeOffsiteBackupReminder(days,nowMs){
  if (protectedMode){ flashSave("Reminder not changed — protected mode",true); return false; }
  const count = Number.isFinite(days) && days>0 ? days : OFFSITE_SHARE_SNOOZE_DAYS;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  data.meta = data.meta || {};
  data.meta.offsiteReminderSnoozedUntil = new Date(now+count*BACKUP_DAY_MS).toISOString();
  if (!save()) return false;
  renderBackup();
  showBackupStatus("Backup reminder postponed for "+count+" days.");
  return true;
}
let nativeBackupSavedReturnFocus=null;
function hideNativeBackupSaved(){
  const overlay=document.getElementById("nativeBackupSavedOverlay");
  if (!overlay || overlay.classList.contains("hidden")) return;
  overlay.classList.add("hidden");
  if (typeof unlockScroll==="function") unlockScroll();
  const target=nativeBackupSavedReturnFocus;
  nativeBackupSavedReturnFocus=null;
  if (target && typeof target.focus==="function") target.focus();
}
function showNativeBackupSaved(){
  const overlay=document.getElementById("nativeBackupSavedOverlay");
  const elsewhere=document.getElementById("nativeBackupElsewhereBtn");
  if (!overlay || !elsewhere) return;
  nativeBackupSavedReturnFocus=document.activeElement;
  overlay.classList.remove("hidden");
  if (typeof lockScroll==="function") lockScroll();
  elsewhere.focus();
}
function doBackup(btnId,shareAfterSave){
  if (protectedMode){
    const ok = confirm("This export contains only what BlackPyre could read — it may be incomplete and is NOT a normal backup. Your original data remains preserved on this device. Export anyway?");
    if (!ok) return false;
    const snap = protectedSnapshotStrings ? {
      cfg:JSON.parse(protectedSnapshotStrings.cfg),
      data:JSON.parse(protectedSnapshotStrings.data),
      program:JSON.parse(protectedSnapshotStrings.program)
    } : {cfg:cfg, data:data, program:program};
    const cfgPartial = scrubRetiredCredentials(Object.assign({}, snap.cfg));
    const filename = "blackpyre-PARTIAL-"+todayStr()+".json";
    const text = JSON.stringify({cfg:cfgPartial,program:snap.program,data:snap.data},null,2);
    const capability = nativeJsonExportCapability();
    if (!capability.available){
      download(filename,text);
      ackBtn(btnId,"✓ Partial export");
      return true;
    }
    return writeNativeJson(capability,filename,text)
      .then(file=>{
        if (!shareAfterSave){ ackBtn(btnId,"✓ Partial saved"); return true; }
        return shareNativeJson(capability,file,"BlackPyre partial export")
          .then(()=>{ ackBtn(btnId,"✓ Partial share completed"); return true; })
          .catch(error=>reportShareAfterLocalSave(btnId,error,"partial export"));
      })
      .catch(error=>reportBackupFailure(btnId,error));
  }

  const cfgSafe = scrubRetiredCredentials(Object.assign({},cfg));

  const backupData = JSON.parse(JSON.stringify(data));
  backupData.meta = Object.assign({},backupData.meta||{}, {
    lastBackup:todayStr(),
    logsSince:0
  });

  const filename = "blackpyre-backup-"+todayStr()+".json";
  const text = JSON.stringify({
    cfg:cfgSafe,
    program:program,
    data:backupData
  },null,2);
  const capability = nativeJsonExportCapability();
  if (!capability.available){
    download(filename,text);
    recordCompletedLocalBackup(false);
    ackBtn(btnId,"✓ Backup downloaded");
    return true;
  }

  return writeNativeJson(capability,filename,text)
    .then(file=>{
      recordCompletedLocalBackup(!!shareAfterSave);
      if (!shareAfterSave){
        ackBtn(btnId,"✓ Backup saved");
        flashSave("Backup saved inside BlackPyre. This copy is deleted if BlackPyre is uninstalled.");
        showNativeBackupSaved();
        return true;
      }
      return shareNativeJson(capability,file,"BlackPyre backup")
        .then(result=>{
          recordCompletedBackupShare(result);
          flashSave("Backup ready. Save the file somewhere you can access later.");
          ackBtn(btnId,"✓ Backup ready");
          return true;
        })
        .catch(error=>reportShareAfterLocalSave(btnId,error,"backup"));
    })
    .catch(error=>reportBackupFailure(btnId,error));
}
document.getElementById("exportDataBtn").addEventListener("click",()=>doBackup("exportDataBtn",false));
document.getElementById("shareDataBtn").addEventListener("click",()=>doBackup("shareDataBtn",true));
document.getElementById("backupNowBtn").addEventListener("click",()=>doBackup("backupNowBtn",true));
document.getElementById("backupSnoozeBtn").addEventListener("click",()=>snoozeOffsiteBackupReminder(OFFSITE_SHARE_SNOOZE_DAYS));
document.getElementById("nativeBackupDoneBtn").addEventListener("click",hideNativeBackupSaved);
document.getElementById("nativeBackupElsewhereBtn").addEventListener("click",()=>{
  hideNativeBackupSaved();
  doBackup("shareDataBtn",true);
});
function reloadAfterFullErase(){ location.reload(); }
async function eraseAllBlackPyreData(){
  if (protectedMode){
    flashSave("Erase blocked — resolve Protected mode recovery first",true);
    if (typeof openRecoveryPanel==="function" && recoveryWritesAllowed()) openRecoveryPanel();
    return false;
  }
  const first=confirm(
    "Erase ALL BlackPyre data on this device?\n\n"+
    "This permanently removes settings, logs, saved foods, programs, workout drafts, recovery snapshots, Native Vault files, and backups kept inside BlackPyre. Copies saved elsewhere are not affected."
  );
  if (!first) return false;
  const second=confirm(
    "FINAL CONFIRMATION\n\nThis cannot be undone. Have you saved any backup you want to keep somewhere outside BlackPyre?"
  );
  if (!second) return false;

  const btn=document.getElementById("eraseAllDataBtn");
  if (btn){ btn.disabled=true; btn.textContent="ERASING…"; }
  const captured=captureBlackPyreStorageForErase();
  if (!captured.ok){
    if (btn){ btn.disabled=false; btn.textContent="ERASE ALL BLACKPYRE DATA"; }
    flashSave("Erase failed — existing data was left in place",true);
    return false;
  }
  const snapshot=captured.strings;

  try {
    if (typeof waitForNativeVaultIdle==="function") await waitForNativeVaultIdle();
    if (typeof cancelRestNotification==="function") await cancelRestNotification();
    await eraseBlackPyreNativeFiles();
    const erased=commitBlackPyreStorageErase(snapshot);
    if (!erased.ok) throw erased.error||new Error("Browser storage did not verify empty.");
    try {
      if (typeof caches!=="undefined" && caches && typeof caches.keys==="function"){
        const names=await caches.keys();
        await Promise.all(names.filter(name=>/^blackpyre-/.test(name)).map(name=>caches.delete(name)));
      }
    } catch(error){}
    if (btn) btn.textContent="DATA ERASED";
    setTimeout(reloadAfterFullErase,50);
    return true;
  } catch(error){
    restoreBlackPyreStorageAfterErase(snapshot);
    if (btn){ btn.disabled=false; btn.textContent="ERASE ALL BLACKPYRE DATA"; }
    console.error("BlackPyre erase failed:",error);
    flashSave("Erase failed — existing browser data was preserved",true);
    return false;
  }
}
document.getElementById("eraseAllDataBtn").addEventListener("click",eraseAllBlackPyreData);
function exportRawRecoveryOriginals(){
  const payload = makeRawRecoveryEnvelope();
  if (!payload.ok){ flashSave("Raw recovery export unavailable", true); return false; }
  const privacyOk = confirm("This emergency file preserves exact saved strings and may contain private personal data. Store it securely and do not share it. Export raw originals?");
  if (!privacyOk) return false;
  download("blackpyre-RAW-RECOVERY-"+todayStr()+".json", JSON.stringify(payload.envelope, null, 2));
  rawRecoveryExportConfirmed = confirm("Confirm only after the raw recovery file has been saved somewhere safe. Did you save it?");
  flashSave(rawRecoveryExportConfirmed ? "Raw recovery copy confirmed ✓" : "Raw export downloaded — confirmation still required", !rawRecoveryExportConfirmed);
  return rawRecoveryExportConfirmed;
}
function exportStorageDiagnostic(){
  const payload = makeStorageDiagnosticEnvelope();
  if (!payload.ok){ flashSave(payload.reason || "Diagnostic export unavailable", true); return false; }
  const ok = confirm("This emergency diagnostic preserves exact local storage and may contain private personal logs. Store it securely and do not post it publicly. Export now?");
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
  const ok = confirm("This recovery file may contain private personal data because it preserves the original saved strings exactly. Store it securely. Export it now?");
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
function renderBackup(){
  renderStorageUse();
  const m = data.meta || {lastBackup:null, logsSince:0};
  const line = document.getElementById("backupMetaLine");
  const localDays = m.lastBackup ? Math.floor((new Date(todayStr())-new Date(m.lastBackup))/BACKUP_DAY_MS) : null;
  const localText = m.lastBackup
    ? "Last local backup: "+(localDays===0?"today":localDays+" day"+(localDays===1?"":"s")+" ago")+" · "+(m.logsSince||0)+" new logs since."
    : "Last local backup: never.";
  const completedDays = backupElapsedDays(m.lastShareCompletedAt);
  const attemptDays = backupElapsedDays(m.lastShareAttemptAt);
  const completedAt = backupTimestampMs(m.lastShareCompletedAt);
  const attemptedAt = backupTimestampMs(m.lastShareAttemptAt);
  let shareText = "No completed backup share is recorded.";
  if (completedDays!==null){
    shareText = "Last backup share completed "+(completedDays===0?"today":completedDays+" day"+(completedDays===1?"":"s")+" ago")+".";
  }
  if (attemptDays!==null && (completedAt===null || attemptedAt>completedAt)){
    shareText += " Last share attempt was "+(attemptDays===0?"today":attemptDays+" day"+(attemptDays===1?"":"s")+" ago")+" and did not record completion.";
  }
  line.textContent = localText+" "+shareText+" Keep a separate copy outside BlackPyre.";
  renderRecoveryStatus();
  const card = document.getElementById("backupCard");
  if (!offsiteShareReminderDue(m)){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  document.getElementById("backupText").textContent = "Create a backup so your BlackPyre data can be recovered if your device is lost, replaced, or damaged.";
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
        DEVICE_LOCAL_CFG_FIELDS.forEach(k=>{ if (!hasOwn(incomingCfg,k) && cfg[k]!==undefined) incomingCfg[k] = cfg[k]; });
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

    if (
      (present.data || present.program)
      && typeof resetTrainingUiAfterRestore==="function"
    ){
      resetTrainingUiAfterRestore();
    } else {
      renderDayOptions();
      renderSessionInputs();
    }

    renderAll();
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
  const v = poundsFromUnit(document.getElementById("dashWtInput").value,currentUnitSystem());
  if(!v || v<50 || v>700){ flashSave("Enter a weight from "+(isMetricSystem()?"23 to 318 kg":"50 to 700 lb"), true); return; }
  const dt = todayStr();
  data.weights = data.weights.filter(w=>w.date!==dt);
  data.weights.push({date:dt, time:currentTimeValue(), lbs:v});
  bumpLog();
  document.getElementById("dashWtInput").value="";
  if (data.weights.length===1){
    const cutting = cfg.goalWt < cfg.startWt;
    if ((cutting && v > cfg.startWt) || (!cutting && v < cfg.startWt)){
      cfg.startWt = v; saveCfg();
      flashSave("Starting line set at "+formatBodyWeight(v,currentUnitSystem(),1)+" — the journey begins today");
    }
  }
  save(); renderWeight(); renderDash(); renderTDEE(); renderProjection(); renderWeek();
  flashSave("Weight recorded ✓");
  ackBtn("dashWtBtn", "✓");
  checkWeightAdjust(v);
});
