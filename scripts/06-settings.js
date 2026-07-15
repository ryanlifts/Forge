"use strict";
// ================== FIRST-RUN SETUP WIZARD ==================
let setupStep = 0;
const SETUP_STEPS = 8;
const setupChoice = {
  trainAction:null, cw:null, gw:null, calc:null, applied:false,
  split:{mode:"rec",p:40,c:30,f:30}, schedMode:"same", schedDays:null,
  measureOn:false, waterOn:false
};
function hasAnyData(){
  return (data.weights||[]).length>0 || (data.workouts||[]).length>0 || Object.keys(data.food||{}).length>0;
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
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    document.querySelector('.tab[data-view="work"]').classList.add("active");
    document.getElementById("view-work").classList.add("active");
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
    if (!cw || cw<50 || cw>700){ flashSave("Enter your current weight", true); return false; }
    if (!gw || gw<50 || gw>700){ flashSave("Enter a goal weight", true); return false; }
    cfg.startWt=cw; cfg.goalWt=gw;
    const dt=todayStr();
    if (!data.weights.some(w=>w.date===dt)) data.weights.push({date:dt,lbs:cw});
    cfg.lastTargetWt=cw; saveCfg(); save(); renderJourney();
  }
  if (setupStep===1){
    const x=setupChoice.calcInputs||{};
    if(!x.age || !x.ft){ flashSave("Fill age and height", true); return false; }
    setupChoice.calc=calcMacros(x.sex,x.age,x.ft,x.inches,cfg.startWt,x.act,x.goal);
    cfg.calcInputs={sex:x.sex,age:x.age,ft:x.ft,inches:x.inches,act:x.act,goal:x.goal};
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
      if(days.length!==7 || days.some(v=>!Number.isFinite(v)||v<=0)){ flashSave("Fill all seven daily calorie targets", true); return false; }
      const total=days.reduce((a,x)=>a+x,0), budget=cfg.calTarget*7;
      if(total>budget){ flashSave("Over weekly budget by "+(total-budget)+" calories", true); return false; }
      cfg.calSchedMode="custom"; cfg.calSchedDays=days.slice();
    } else { cfg.calSchedMode=setupChoice.schedMode; cfg.calSchedDays=null; }
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
  const label=s.mode==="rec"?"0.9g/lb protein · 25% fat · carbs from the rest":s.p+"% / "+s.c+"% / "+s.f+"%";
  document.getElementById("suSplitGrams").innerHTML=label+' → <b class="ember-text">'+g.pro+'g P</b> · <b>'+g.carb+'g C</b> · <b>'+g.fat+'g F</b>';
  const warn=document.getElementById("suSplitWarn");
  if(g.pro<cfg.startWt*0.7){ warn.textContent="This split gives only "+g.pro+"g protein. For muscle retention, choose a higher-protein split."; warn.classList.remove("hidden"); }
  else warn.classList.add("hidden");
}
function setupScheduleDays(mode){
  const b=cfg.calTarget;
  if(mode==="frisat") return [b-100,b-100,b-100,b-100,b-100,b+250,b+250];
  if(mode==="satsun") return [b+250,b-100,b-100,b-100,b-100,b-100,b+250];
  if(mode==="frisatsun") return [b+200,b-150,b-150,b-150,b-150,b+200,b+200];
  return [b,b,b,b,b,b,b];
}
function renderSetupSchedNote(){
  const note=document.getElementById("suSchedNote"), budget=cfg.calTarget*7;
  if(setupChoice.schedMode!=="custom"){
    const d=setupScheduleDays(setupChoice.schedMode), hi=Math.max(...d), lo=Math.min(...d);
    note.style.color=""; note.textContent=setupChoice.schedMode==="same"?"Weekly budget: "+budget+" kcal ("+cfg.calTarget+" every day).":"Higher days "+hi+" kcal · lower days "+lo+" kcal · weekly total "+budget+" kcal."; return;
  }
  const days=[0,1,2,3,4,5,6].map(i=>Number(document.getElementById("suSched"+i).value)||0);
  setupChoice.schedDays=days; const total=days.reduce((a,x)=>a+x,0), diff=budget-total;
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
    body.innerHTML='<div class="card"><div class="label">Step 1 · Bodyweight goal</div><div class="row" style="margin:10px 0 12px;">'
      +'<div><div class="label">Current weight (lb)</div><input type="number" id="suWt" inputmode="decimal" placeholder="e.g. 225"></div>'
      +'<div><div class="label">Goal weight (lb)</div><input type="number" id="suGoalWt" inputmode="decimal" placeholder="e.g. 175"></div></div>'
      +'<div class="note">Enter your current weight once. BlackPyre saves it as your first weigh-in and starting baseline.</div></div>';
    document.getElementById("suWt").value=setupChoice.cw||""; document.getElementById("suGoalWt").value=setupChoice.gw||"";
  }
  if(setupStep===1){
    const ci=setupChoice.calcInputs||cfg.calcInputs||{};
    body.innerHTML='<div class="card"><div class="label">Step 2 · Calorie calculator</div><div class="row" style="margin:10px 0 10px;">'
      +'<div><div class="label">Sex</div><select id="suSex"><option value="m">Male</option><option value="f">Female</option></select></div><div><div class="label">Age</div><input type="number" id="suAge" inputmode="numeric" placeholder="years"></div></div>'
      +'<div class="row" style="margin-bottom:10px;"><div><div class="label">Height (ft)</div><input type="number" id="suFt" inputmode="numeric" placeholder="ft"></div><div><div class="label">Height (in)</div><input type="number" id="suIn" inputmode="numeric" placeholder="in"></div></div>'
      +'<div class="label">Activity level</div><select id="suAct" style="margin-bottom:10px;"><option value="1.2">Sedentary (desk job, little exercise)</option><option value="1.375">Light (1–3 workouts/week)</option><option value="1.55">Moderate (3–5 workouts/week)</option><option value="1.725">Very active (6–7 workouts/week or physical job)</option><option value="1.9">Athlete (2-a-days or heavy labor + training)</option></select>'
      +'<div class="label">Goal</div><select id="suGoal" style="margin-bottom:10px;"><option value="-1000">Lose 2 lb/week (aggressive)</option><option value="-500">Lose 1 lb/week</option><option value="-250">Lose 0.5 lb/week</option><option value="0">Maintain</option><option value="250">Gain 0.5 lb/week (lean bulk)</option></select>'
      +'<div id="suCalcPreview" style="font-size:13px;line-height:1.8;margin-top:8px;"></div><div class="note">Uses the same Mifflin-St Jeor calculator and goal choices as Settings.</div></div>';
    document.getElementById("suSex").value=ci.sex||"m"; document.getElementById("suAge").value=ci.age||""; document.getElementById("suFt").value=ci.ft||""; document.getElementById("suIn").value=ci.inches||""; document.getElementById("suAct").value=String(ci.act||1.55); document.getElementById("suGoal").value=String(ci.goal!=null?ci.goal:-500);
    if(setupChoice.calc) document.getElementById("suCalcPreview").innerHTML='Maintenance: <b>'+setupChoice.calc.tdee+'</b> kcal · Target: <b class="ember-text">'+setupChoice.calc.cal+' kcal</b>';
  }
  if(setupStep===2){
    body.innerHTML='<div class="card"><div class="label">Step 3 · Macro split</div><div class="note" style="margin:8px 0 10px;">Choose the same macro split available in Settings.</div><div id="suSplitChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;"></div>'
      +'<div class="row hidden" id="suSplitCustom" style="margin-bottom:10px;"><div><div class="label">Protein %</div><input type="number" id="suSpP" inputmode="numeric"></div><div><div class="label">Carbs %</div><input type="number" id="suSpC" inputmode="numeric"></div><div><div class="label">Fat %</div><input type="number" id="suSpF" inputmode="numeric"></div></div>'
      +'<div id="suSplitGrams" style="font-size:14px;line-height:1.8;"></div><div class="note hidden" id="suSplitWarn" style="color:var(--warn);"></div></div>';
    renderSetupSplit();
  }
  if(setupStep===3){
    body.innerHTML='<div class="card"><div class="label">Step 4 · Calorie schedule</div><select id="suSched" style="margin:10px 0;"><option value="same">Same target every day</option><option value="frisat">Higher Friday & Saturday</option><option value="satsun">Higher Saturday & Sunday</option><option value="frisatsun">Higher Friday–Sunday</option><option value="custom">Custom daily targets</option></select><div id="suSchedCustom" class="hidden">'
      +'<div class="row" style="margin-bottom:8px;">'+[0,1,2,3].map((i)=>'<div><div class="label">'+["Sun","Mon","Tue","Wed"][i]+'</div><input type="number" id="suSched'+i+'" inputmode="numeric"></div>').join("")+'</div>'
      +'<div class="row">'+[4,5,6].map((i)=>'<div><div class="label">'+["Thu","Fri","Sat"][i-4]+'</div><input type="number" id="suSched'+i+'" inputmode="numeric"></div>').join("")+'<div></div></div><button class="btn ghost small mt10" id="suSchedAuto" style="width:100%;">Auto-balance to weekly budget</button></div><div class="note" id="suSchedNote"></div></div>';
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
    body.innerHTML='<div class="card"><div class="label">Step 6 · Training</div><div class="note" style="margin:8px 0 12px;">BlackPyre logs your sessions against a program. Pick a path:</div><div id="suTrain"></div></div>';
    const opts=[[null,"Use the loaded program",esc(program.name||"Built-in program")+" — start logging immediately"],["build","Build my own","Name your days, pick exercises — opens the builder after setup"],["import","Load a program file","From a coach, friend, or AI (.json) — opens the file picker after setup"]];
    const td=document.getElementById("suTrain"); opts.forEach(o=>{const b=document.createElement("button");b.className="su-opt"+(setupChoice.trainAction===o[0]?" sel":"");b.innerHTML='<b>'+o[1]+'</b><div class="su-sub">'+o[2]+'</div>';b.addEventListener("click",()=>{setupChoice.trainAction=o[0];renderSetupStep();});td.appendChild(b);});
  }
  if(setupStep===6){
    body.innerHTML='<div class="card"><div class="label">Step 7 · Food database</div><div class="note" style="margin:8px 0 12px;">Food search and barcode lookup work out of the box. Optionally add your own free USDA key for guaranteed speed.</div><a href="https://fdc.nal.usda.gov/api-key-signup.html" target="_blank" style="color:var(--ember);font-size:13px;">Get a free USDA key →</a><div class="row mt10" style="align-items:flex-end;"><div style="flex:1;"><div class="label">Paste key (or skip)</div><input id="suUsda" placeholder="Your API key"></div><button class="xbtn" id="suUsdaSave" style="flex:0 0 auto;">Save</button></div></div>';
    if(cfg.usdaKey) document.getElementById("suUsda").value=cfg.usdaKey;
    document.getElementById("suUsdaSave").addEventListener("click",()=>{const k=document.getElementById("suUsda").value.trim();if(!k){flashSave("Paste a key first",true);return;}cfg.usdaKey=k;saveCfg();ackBtn("suUsdaSave","✓ Saved");});
  }
  if(setupStep===7){
    body.innerHTML='<div class="card"><div class="label">Step 8 · Your data</div><div style="font-size:14px;line-height:1.9;margin-top:8px;">Everything you log stays <b>only on this device</b>. No account, server, or ads.<br><br>Use backup/restore to protect your data or move it to another device.<br><br>Your bodyweight goal, calculator information, macro split, schedule, and tracking choices are now saved in Settings and can be changed anytime.</div></div>';
  }
}
// disclaimer gates everything, once per install; wizard follows on fresh installs only
function afterDisclaimer(){
  if (!cfg.setupDone){
    if (hasAnyData()){ cfg.setupDone = true; saveCfg(); }
    else { openSetup(); }
  }
}
document.getElementById("disclaimerAgreeBtn").addEventListener("click", ()=>{
  cfg.disclaimerAccepted = todayStr();
  saveCfg();
  document.getElementById("disclaimerOverlay").classList.add("hidden");
  unlockScroll();
  afterDisclaimer();
});
if (!cfg.disclaimerAccepted){
  lockScroll();
  document.getElementById("disclaimerOverlay").classList.remove("hidden");
} else {
  afterDisclaimer();
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
    ? "0.9g/lb protein · 25% fat · carbs from the rest"
    : splitState.p+"% / "+splitState.c+"% / "+splitState.f+"%";
  document.getElementById("splitGrams").innerHTML =
    label+' → <b class="ember-text">'+g.pro+'g P</b> · <b>'+g.carb+'g C</b> · <b>'+g.fat+'g F</b>';
  // protein floor sanity check
  const wt = Number(document.getElementById("cWt").value) || cfg.startWt;
  const warn = document.getElementById("splitWarn");
  if (g.pro < wt*0.7){
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
document.getElementById("calcMacrosBtn").addEventListener("click", ()=>{
  const sex = document.getElementById("cSex").value;
  const age = Number(document.getElementById("cAge").value);
  const ft = Number(document.getElementById("cFt").value);
  const inches = Number(document.getElementById("cIn").value||0);
  const lb = Number(document.getElementById("cWt").value);
  const act = Number(document.getElementById("cAct").value);
  const goal = Number(document.getElementById("cGoal").value);
  if(!age || !ft || !lb) { flashSave("Fill age, height, weight", true); return; }
  lastCalc = calcMacros(sex, age, ft, inches, lb, act, goal);
  cfg.calcInputs = {sex:sex, age:age, ft:ft, inches:inches, act:act, goal:goal};
  saveCfg();
  document.getElementById("calcOutText").innerHTML =
    'Maintenance (TDEE): <b>'+lastCalc.tdee+'</b> kcal/day<br>'
    +'Your target: <b class="ember-text">'+lastCalc.cal+' kcal</b>';
  document.getElementById("calcOut").classList.remove("hidden");
  renderSplit();
});
document.getElementById("applyMacrosBtn").addEventListener("click", ()=>{
  if(!lastCalc) return;
  const g = splitGrams();
  cfg.calTarget = lastCalc.cal;
  cfg.proTarget = g.pro;
  cfg.carbGoal = g.carb; cfg.fatGoal = g.fat;
  cfg.lastTargetWt = Number(document.getElementById("cWt").value) || cfg.lastTargetWt || cfg.startWt;
  cfg.splitState = Object.assign({}, splitState);
  delete cfg.adjustPromptedAt;
  saveCfg(); renderAll(); flashSave("Targets applied ✓");
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
  document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelector('.tab[data-view="settings"]').classList.add("active");
  document.getElementById("view-settings").classList.add("active");
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
  document.getElementById("cWt").value = sorted.length ? sorted[sorted.length-1].lbs : shown(cfg.startWt);
  if (cfg.splitState) splitState = Object.assign({}, cfg.splitState);
  renderSched();
}
document.getElementById("saveSettingsBtn").addEventListener("click", ()=>{
  const g = id=>Number(document.getElementById(id).value);
  let schedSaveMsg = null;
  cfg = Object.assign({}, cfg, {
    startWt: g("sStartWt")||cfg.startWt, goalWt: g("sGoalWt")||cfg.goalWt,
    calTarget: g("sCalTarget")||cfg.calTarget,
    proTarget: g("sProTarget")||cfg.proTarget,
    carbGoal: g("sCarb")||cfg.carbGoal, fatGoal: g("sFat")||cfg.fatGoal,
  });
  const schedMode = document.getElementById("sCalSched").value;
  if (schedMode==="custom"){
    const days = [0,1,2,3,4,5,6].map(i=>Number(document.getElementById("sSched"+i).value)||cfg.calTarget);
    const total = days.reduce((a,x)=>a+x,0);
    const budget = cfg.calTarget*7;
    if (total > budget){
      schedNote();
      flashSave("Over weekly budget by "+(total-budget)+" calories — schedule not saved", true);
      return; // block: never exceed the weekly budget
    }
    cfg.calSchedMode = "custom";
    cfg.calSchedDays = days;
    if (total < budget){
      schedSaveMsg = "Saved — this week is under your normal weekly budget by "+(budget-total)+" calories";
    }
  } else {
    cfg.calSchedMode = schedMode;
    cfg.calSchedDays = null; // presets derive live from the calorie target
  }
  const sortedW2 = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  cfg.lastTargetWt = sortedW2.length ? sortedW2[sortedW2.length-1].lbs : cfg.lastTargetWt || cfg.startWt;
  delete cfg.adjustPromptedAt;
  saveCfg(); renderAll(); flashSave(schedSaveMsg || "Settings saved ✓");
  ackBtn("saveSettingsBtn", "✓ Saved");
});
function doBackup(btnId){
  data.meta.lastBackup = todayStr();
  data.meta.logsSince = 0;
  const cfgSafe = Object.assign({}, cfg); delete cfgSafe.anthropicKey; delete cfgSafe.openaiKey;
  download("blackpyre-backup-"+todayStr()+".json", JSON.stringify({cfg:cfgSafe, program:program, data:data}, null, 2));
  save(); renderBackup();
  ackBtn(btnId, "✓ Backup downloaded");
}
document.getElementById("exportDataBtn").addEventListener("click", ()=>doBackup("exportDataBtn"));
document.getElementById("backupNowBtn").addEventListener("click", ()=>doBackup("backupNowBtn"));
function renderBackup(){
  const m = data.meta || {lastBackup:null, logsSince:0};
  const line = document.getElementById("backupMetaLine");
  if (m.lastBackup){
    const days = Math.floor((new Date(todayStr()) - new Date(m.lastBackup))/86400000);
    line.textContent = "Last backup: "+(days===0?"today":days+" day"+(days===1?"":"s")+" ago")+" · "+(m.logsSince||0)+" new logs since. Keep the file somewhere safe (email, cloud drive).";
  } else {
    line.textContent = "Last backup: never. Your data lives only on this device — back it up occasionally.";
  }
  const card = document.getElementById("backupCard");
  const due = (!m.lastBackup && (m.logsSince||0)>=10)
    || (m.lastBackup && Math.floor((new Date(todayStr()) - new Date(m.lastBackup))/86400000)>=14 && (m.logsSince||0)>=10);
  if (!due){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  document.getElementById("backupText").innerHTML = m.lastBackup
    ? "It's been a while since your last backup and you've logged <b>"+m.logsSince+"</b> entries since. Your data lives only on this device — one tap protects it."
    : "You've logged <b>"+m.logsSince+"</b> entries and never backed up. Your data lives only on this device — one tap protects it.";
}
document.getElementById("importDataBtn").addEventListener("click", ()=>document.getElementById("importDataFile").click());
document.getElementById("importDataFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try {
      const b = JSON.parse(reader.result);
      if(b.data) data = b.data;
      if(!data.recents) data.recents = []; if(!data.myFoods) data.myFoods = {}; if(!data.meals) data.meals = []; if(!data.finished) data.finished = {}; if(!data.foodCounts) data.foodCounts = {}; if(!data.mealCounts) data.mealCounts = {}; if(!data.meta) data.meta = {lastBackup:null, logsSince:0};
      if(b.cfg){
        const keepAI = {};
        ["anthropicKey","openaiKey","aiProvider","aiModelAnth","aiModelOai"].forEach(k=>{
          if (b.cfg[k]===undefined && cfg[k]!==undefined) keepAI[k] = cfg[k];
        });
        migrateTargets(b.cfg);
        cfg = Object.assign({}, DEFAULT_CFG, b.cfg, keepAI);
        migrateCfg();
      }
      if(b.program) program = validateProgram(b.program);
      save(); saveCfg(); saveProgram();
      renderDayOptions(); renderSessionInputs(); renderAll();
      flashSave("Backup restored ✓");
      ackBtn("importDataBtn", "✓ Restored");
    } catch(err){ flashSave("Restore failed", true); }
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

