"use strict";
// ================== USDA SEARCH ==================
function mapUSDA(f){
  // Handles branded (labelNutrients + servingSize) and standard (per-100g foodNutrients)
  const getNut = (id)=> {
    const n = (f.foodNutrients||[]).find(x=>x.nutrientId===id || (x.nutrient&&x.nutrient.id===id));
    return n ? Number(n.value!=null?n.value:(n.amount||0)) : 0;
  };
  let cal100 = getNut(1008), pro100 = getNut(1003), carb100 = getNut(1005), fat100 = getNut(1004);
  if (!cal100 && f.labelNutrients && f.servingSize){
    const g = Number(f.servingSize); // grams for most branded
    const l = f.labelNutrients;
    const per = (v)=> v&&v.value!=null ? Number(v.value)/g*100 : 0;
    cal100 = per(l.calories); pro100 = per(l.protein); carb100 = per(l.carbohydrates); fat100 = per(l.fat);
  }
  if (!cal100) return null;
  return {
    name: f.description || f.lowercaseDescription || "Unknown",
    brand: f.brandName || f.brandOwner || "USDA",
    cal100:cal100, pro100:pro100, carb100:carb100, fat100:fat100,
    servingG: f.servingSize && (String(f.servingSizeUnit||"").toLowerCase().indexOf("g")===0 || String(f.servingSizeUnit||"").toLowerCase()==="ml") ? Number(f.servingSize) : null,
    servingLabel: f.servingSize ? f.servingSize+(f.servingSizeUnit||"g") : null,
  };
}
async function searchUSDA(q){
  if (!effectiveUsdaKey()) return [];
  const res = await fetchWithTimeout("https://api.nal.usda.gov/fdc/v1/foods/search?api_key="+encodeURIComponent(effectiveUsdaKey())
    +"&query="+encodeURIComponent(q)+"&pageSize=10&dataType=Branded,Foundation,SR%20Legacy", 8000);
  const json = await res.json();
  return (json.foods||[]).map(mapUSDA).filter(Boolean);
}
// ================== V23: WATER / QUOTES / ACCENTS / SWAPS ==================
// ---------- water tracking (optional) ----------
function renderWater(){
  const card = document.getElementById("waterCard");
  card.classList.toggle("hidden", !cfg.waterOn);
  if (!cfg.waterOn) return;
  if (!data.water) data.water = {};
  document.getElementById("waterCount").textContent = data.water[todayStr()] || 0;
}
document.getElementById("waterToggleBtn").addEventListener("click", ()=>{
  cfg.waterOn = !cfg.waterOn;
  saveCfg();
  document.getElementById("waterToggleBtn").textContent = cfg.waterOn ? "Disable water tracking" : "Enable water tracking";
  ackBtn("waterToggleBtn", cfg.waterOn ? "✓ Enabled" : "✓ Disabled");
  renderWater();
});
document.getElementById("waterPlus").addEventListener("click", ()=>{
  if (!data.water) data.water = {};
  data.water[todayStr()] = (data.water[todayStr()]||0) + 1;
  save(); renderWater();
});
document.getElementById("waterMinus").addEventListener("click", ()=>{
  if (!data.water) data.water = {};
  data.water[todayStr()] = Math.max(0, (data.water[todayStr()]||0) - 1);
  save(); renderWater();
});

// ---------- motivation page ----------
// ---------- accent colors ----------
const ACCENTS = {
  ember:   {name:"Ember",   c:"#FF7A3D", deep:"#E8571F", rgb:"255,122,61"},
  steel:   {name:"Steel",   c:"#4D9DE0", deep:"#2E6FB0", rgb:"77,157,224"},
  emerald: {name:"Emerald", c:"#34D399", deep:"#0E9F6E", rgb:"52,211,153"},
  crimson: {name:"Crimson", c:"#F43F5E", deep:"#BE123C", rgb:"244,63,94"},
  violet:  {name:"Violet",  c:"#A78BFA", deep:"#7C3AED", rgb:"167,139,250"},
  gold:    {name:"Gold",    c:"#FBBF24", deep:"#D97706", rgb:"251,191,36"},
  pink:    {name:"Pink",    c:"#F472B6", deep:"#DB2777", rgb:"244,114,182"},
};
function applyAccent(){
  const a = ACCENTS[cfg.accent] || ACCENTS.gold;
  const r = document.documentElement.style;
  r.setProperty("--ember", a.c);
  r.setProperty("--ember-deep", a.deep);
  r.setProperty("--ember-rgb", a.rgb);
}
function renderAccentRow(){
  const row = document.getElementById("accentRow");
  row.innerHTML = "";
  Object.keys(ACCENTS).forEach(key=>{
    const a = ACCENTS[key];
    const b = document.createElement("button");
    b.setAttribute("aria-label", a.name);
    b.title = a.name;
    b.style.cssText = "width:36px; height:36px; border-radius:50%; cursor:pointer; background:linear-gradient(135deg,"+a.c+","+a.deep+");"
      + "border:3px solid " + ((ACCENTS[cfg.accent] ? cfg.accent : "gold")===key ? "var(--text)" : "transparent") + ";";
    b.addEventListener("click", ()=>{
      cfg.accent = key;
      saveCfg();
      applyAccent();
      renderAccentRow();
      flashSave(a.name + " ✓");
    });
    row.appendChild(b);
  });
}

// ---------- session exercise swaps + form videos ----------
let sessionSwaps = {}; // original program name -> substituted name
function sessionList(){
  return currentDayExercises().concat(extraExercises).map(ex=>
    sessionSwaps[ex.name] ? {name:sessionSwaps[ex.name], scheme:ex.scheme, __orig:ex.name} : ex);
}
function openFormVideo(name){
  window.open("https://www.youtube.com/results?search_query="+encodeURIComponent(name.replace("[Cardio] ","")+" proper form how to"), "_blank");
}
function offerSwap(origName, currentShown, container){
  const base = origName;
  const opts = (ALT_MAP[base]||[]).filter(a=>a!==currentShown);
  if (currentShown!==base) opts.unshift(base+" (original)");
  const menu = document.createElement("div");
  menu.style.cssText = "margin:6px 0 10px; display:flex; flex-direction:column; gap:6px;";
  opts.forEach(o=>{
    const label = o;
    const target = o.endsWith(" (original)") ? base : o;
    const b = document.createElement("button");
    b.className = "xbtn";
    b.textContent = "\u21C4 " + label;
    b.addEventListener("click", ()=>{
      const shownOld = sessionSwaps[base] || base;
      delete sessionState[shownOld];
      if (target===base) delete sessionSwaps[base];
      else sessionSwaps[base] = target;
      initSessionStateFor(target===base ? base : target);
      renderSessionInputs();
    });
    menu.appendChild(b);
  });
  const cancel = document.createElement("button");
  cancel.className = "xbtn";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", ()=>menu.remove());
  menu.appendChild(cancel);
  container.appendChild(menu);
}
function initSessionStateFor(exName){
  const v = wDaySel.value;
  const last = (v!=="__FREE__" && v!=="__CARDIO__") ? lastSessionFor(v) : null;
  // prefill the swapped-in exercise from ITS OWN history anywhere, not just this day
  let lastVal = last && last.sets ? last.sets[exName.replace("[Cardio] ","")] : null;
  if (!lastVal){
    const hist = data.workouts.slice().reverse().find(w=>w.sets && w.sets[exName.replace("[Cardio] ","")]);
    if (hist) lastVal = hist.sets[exName.replace("[Cardio] ","")];
  }
  const pf = prefillRows({name:exName, scheme:""}, lastVal);
  sessionState[exName] = exName.indexOf("[Cardio] ")===0
    ? {mode:"text", rows:[], text:"", auto:false}
    : {mode:"rows", rows:pf.rows, text:"", auto:pf.auto};
}

// ---------- recents search ----------
let recentsFilter = "";
document.getElementById("recentsSearch").addEventListener("input", ()=>{
  recentsFilter = document.getElementById("recentsSearch").value.trim().toLowerCase();
  renderRecents();
});

// ---------- warm journey messaging ----------
function renderJourneyMsg(){
  const el = document.getElementById("journeyMsg");
  el.classList.add("hidden");
  if (!cfg.goalWt || !cfg.startWt || cfg.goalWt===cfg.startWt) return;
  const sorted = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  if (!sorted.length) return;
  const cur = sorted[sorted.length-1].lbs;
  const cutting = cfg.goalWt < cfg.startWt;
  const spanDays = (new Date(sorted[sorted.length-1].date) - new Date(sorted[0].date))/86400000;
  const wrongDir = cutting ? cur > cfg.startWt : cur < cfg.startWt;
  const downOverall = cutting ? Math.round((cfg.startWt-cur)*10)/10 : Math.round((cur-cfg.startWt)*10)/10;
  // recent drift: last 7 days moving against the goal while still ahead overall
  const weekAgoIdx = sorted.findIndex(w=>(new Date(sorted[sorted.length-1].date)-new Date(w.date))/86400000 <= 7);
  const weekDelta = weekAgoIdx>=0 ? cur - sorted[weekAgoIdx].lbs : 0;
  const drifting = cutting ? weekDelta > 1 : weekDelta < -1;

  if (wrongDir && spanDays < 14){
    el.textContent = "You showed up and weighed in — that's the habit that wins. Early numbers bounce around; yours will settle. Keep stacking days.";
    el.classList.remove("hidden");
  } else if (wrongDir){
    el.textContent = "New starting line, same destination. Today's number is just where this stretch begins — every meal logged and every rep from here counts. You've got this.";
    el.classList.remove("hidden");
  } else if (drifting && downOverall > 1){
    el.textContent = "One rough stretch doesn't erase your work — you're still "+downOverall+" lb "+(cutting?"down":"up")+" overall. Champions have bad weeks; they don't have bad months. Tighten up and go.";
    el.classList.remove("hidden");
  }
}

// ================== USUAL MEAL PATTERN DETECTION ==================
function usualFor(meal){
  // look back 14 days (excluding today): items logged for this meal on most of those days
  const dayNames = []; // array of Set(name) per day that has this meal
  for(let i=1;i<=14;i++){
    const d = new Date(); d.setDate(d.getDate()-i);
    const ds = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const entries = (data.food[ds]||[]).filter(f=>(f.meal||"other")===meal);
    if (entries.length) dayNames.push(new Set(entries.map(f=>f.name)));
  }
  if (dayNames.length < 4) return null;
  const counts = {};
  dayNames.forEach(set=>set.forEach(n=>{ counts[n] = (counts[n]||0)+1; }));
  const threshold = Math.max(3, Math.ceil(dayNames.length*0.5));
  const names = Object.keys(counts).filter(n=>counts[n]>=threshold)
    .sort((a,b)=>counts[b]-counts[a]).slice(0,6);
  if (names.length < 2) return null;
  // template each from its most recent logged instance (any date, this meal)
  const items = [];
  names.forEach(n=>{
    for(let i=0;i<=14;i++){
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
      const hit = (data.food[ds]||[]).slice().reverse().find(f=>f.name===n && (f.meal||"other")===meal);
      if (hit){ items.push({name:hit.name, cal:hit.cal, pro:hit.pro, carb:hit.carb||0, fat:hit.fat||0, meal:meal}); break; }
    }
  });
  if (items.length < 2) return null;
  return items;
}
function renderUsual(){
  const card = document.getElementById("usualCard");
  // only for today, only when a pattern exists, only when not already mostly logged
  if (foodDateEl.value !== todayStr()){ card.classList.add("hidden"); return; }
  const items = usualFor(currentMeal);
  if (!items){ card.classList.add("hidden"); return; }
  const todayNames = new Set((data.food[todayStr()]||[]).filter(f=>(f.meal||"other")===currentMeal).map(f=>f.name));
  const remaining = items.filter(it=>!todayNames.has(it.name));
  if (remaining.length===0 || remaining.length < Math.ceil(items.length/2)){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  document.getElementById("usualMealName").textContent = currentMeal;
  const total = Math.round(remaining.reduce((a,x)=>a+Number(x.cal||0),0));
  const pro = Math.round(remaining.reduce((a,x)=>a+Number(x.pro||0),0));
  document.getElementById("usualItems").innerHTML = remaining.map(it=>esc(it.name)).join(" · ")
    + '<div style="color:var(--dim); font-size:11px; margin-top:4px;">'+total+' kcal · '+pro+'g protein · your typical portions</div>';
  const btn = document.getElementById("usualLogBtn");
  btn.textContent = "Log usual "+currentMeal+" ("+remaining.length+" item"+(remaining.length===1?"":"s")+")";
  btn.onclick = ()=>{
    remaining.forEach(it=>addEntry(Object.assign({}, it)));
    ackBtn("usualLogBtn", "✓ Logged "+remaining.length);
    flashSave("Usual "+currentMeal+" logged ✓");
  };
}

// ================== CALORIE SCHEDULE UI ==================
function schedBudget(){ return cfg.calTarget*7; }
function schedReadInputs(){ return [0,1,2,3,4,5,6].map(i=>Number(document.getElementById("sSched"+i).value)||0); }
function schedTargetsOk(){ return Number.isFinite(cfg.calTarget) && cfg.calTarget>0; }
function schedNote(){
  const mode = document.getElementById("sCalSched").value;
  const note = document.getElementById("schedTotalNote");
  const budget = schedBudget();
  if (mode==="same"){ note.style.color=""; note.textContent = "Weekly budget: "+budget+" kcal ("+cfg.calTarget+" every day)."; return; }
  if (mode!=="custom"){
    const d = presetDays(mode);
    const hi = Math.max.apply(null,d), lo = Math.min.apply(null,d);
    note.style.color="";
    note.textContent = "Higher days "+hi+" kcal · lower days "+lo+" kcal · weekly total unchanged at "+budget+" kcal.";
    return;
  }
  const total = schedReadInputs().reduce((a,x)=>a+x,0);
  const diff = budget - total;
  if (diff > 0){
    note.style.color="";
    note.textContent = "Weekly budget "+budget+" · scheduled "+total+" · remaining "+diff+" kcal (≈"+Math.round(diff/7)+"/day if spread across the week).";
  } else if (diff < 0){
    note.style.color = "var(--warn)";
    note.textContent = "Over weekly budget by "+(-diff)+" calories. Lower one or more days or change your base calorie target.";
  } else {
    note.style.color="";
    note.textContent = "Weekly budget "+budget+" · scheduled "+total+" · balanced ✓";
  }
}
function renderSched(){
  const ok = schedTargetsOk();
  document.getElementById("sCalSched").disabled = !ok;
  document.getElementById("schedDisabledNote").classList.toggle("hidden", ok);
  if (!ok){ document.getElementById("schedCustom").classList.add("hidden"); document.getElementById("schedTotalNote").textContent=""; return; }
  const mode = cfg.calSchedMode || "same";
  document.getElementById("sCalSched").value = mode;
  document.getElementById("schedCustom").classList.toggle("hidden", mode!=="custom");
  if (mode==="custom"){
    const days = (Array.isArray(cfg.calSchedDays) && cfg.calSchedDays.length===7) ? cfg.calSchedDays : [0,1,2,3,4,5,6].map(()=>cfg.calTarget);
    [0,1,2,3,4,5,6].forEach(i=>{ document.getElementById("sSched"+i).value = days[i]; });
  }
  schedNote();
}
document.getElementById("sCalSched").addEventListener("change", ()=>{
  const mode = document.getElementById("sCalSched").value;
  document.getElementById("schedCustom").classList.toggle("hidden", mode!=="custom");
  if (mode==="custom"){
    // prefill: every box starts at an exact daily target, never 0 — from the schedule you're leaving
    const seed = presetDays(cfg.calSchedMode) ||
      ((cfg.calSchedMode==="custom" && Array.isArray(cfg.calSchedDays) && cfg.calSchedDays.length===7) ? cfg.calSchedDays : [0,1,2,3,4,5,6].map(()=>cfg.calTarget));
    [0,1,2,3,4,5,6].forEach(i=>{ document.getElementById("sSched"+i).value = seed[i]; });
  }
  schedNote();
});
[0,1,2,3,4,5,6].forEach(i=>{
  document.getElementById("sSched"+i).addEventListener("input", schedNote);
});
document.getElementById("schedAutoBtn").addEventListener("click", ()=>{
  // user-triggered: spread the gap evenly so the week lands exactly on budget
  const days = schedReadInputs();
  const diff = schedBudget() - days.reduce((a,x)=>a+x,0);
  const per = Math.floor(diff/7);
  const balanced = days.map(d=>d+per);
  balanced[6] += diff - per*7; // rounding remainder
  [0,1,2,3,4,5,6].forEach(i=>{ document.getElementById("sSched"+i).value = balanced[i]; });
  schedNote();
});

// ================== POSITIVE FOOD FEEDBACK ==================
let kudosTimer = null;
function foodKudos(entry){
  const pro = Number(entry.pro)||0, cal = Number(entry.cal)||0;
  let msg = null;
  if (pro >= 20 && cal > 0 && cal/pro <= 12) msg = "✓ Efficient protein";
  else if (pro >= 20) msg = "✓ Strong protein source";
  else if (pro >= Math.max(15, Math.round(cfg.proTarget*0.15))) msg = "✓ Helps hit protein goal";
  if (!msg) return;
  const el = document.getElementById("foodKudos");
  el.textContent = msg;
  el.classList.remove("hidden");
  if (kudosTimer) clearTimeout(kudosTimer);
  kudosTimer = setTimeout(()=>el.classList.add("hidden"), 3500);
}

// ================== AI ENGINE (bring-your-own-key) ==================
const AI_DEFAULT_MODELS = { anthropic:"claude-sonnet-4-6", openai:"gpt-4o" };
function aiProvider(){ return cfg.aiProvider || "anthropic"; }
function aiModelFor(p){
  const override = p==="openai" ? cfg.aiModelOai : cfg.aiModelAnth;
  return (override && override.trim()) ? override.trim() : AI_DEFAULT_MODELS[p];
}
function hasAIKey(){
  const p = aiProvider();
  if (p==="openai") return !!(cfg.openaiKey && cfg.openaiKey.trim());
  if (p==="anthropic") return !!(cfg.anthropicKey && cfg.anthropicKey.trim());
  return false; // handoff mode: no live API
}
function isHandoff(){ return aiProvider()==="handoff"; }

document.getElementById("sAiProvider").addEventListener("change", ()=>{
  cfg.aiProvider = document.getElementById("sAiProvider").value;
  saveCfg();
  renderAIGates();
});
document.getElementById("saveAiBtn").addEventListener("click", ()=>{
  cfg.aiProvider = document.getElementById("sAiProvider").value;
  cfg.anthropicKey = document.getElementById("sAnthropicKey").value.trim();
  cfg.openaiKey = document.getElementById("sOpenaiKey").value.trim();
  const m = document.getElementById("sAiModel").value.trim();
  if (cfg.aiProvider==="openai") cfg.aiModelOai = m;
  else if (cfg.aiProvider==="anthropic") cfg.aiModelAnth = m;
  saveCfg();
  renderAIGates();
  ackBtn("saveAiBtn", "✓ Saved");
  flashSave(isHandoff() ? "Handoff mode ready ✓" : (hasAIKey() ? "AI Coach unlocked ✓" : "Saved — add a key to go live"));
});

function renderAIGates(){
  const p = aiProvider();
  document.getElementById("sAiProvider").value = p;
  document.getElementById("sAnthropicKey").value = cfg.anthropicKey || "";
  document.getElementById("sOpenaiKey").value = cfg.openaiKey || "";
  document.getElementById("aiKeyAnthRow").classList.toggle("hidden", p!=="anthropic");
  document.getElementById("aiKeyOaiRow").classList.toggle("hidden", p!=="openai");
  document.getElementById("aiModelRow").classList.toggle("hidden", p==="handoff");
  document.getElementById("aiHandoffNote").classList.toggle("hidden", p!=="handoff");
  const mEl = document.getElementById("sAiModel");
  if (p!=="handoff"){
    mEl.placeholder = "default: " + AI_DEFAULT_MODELS[p];
    mEl.value = (p==="openai" ? cfg.aiModelOai : cfg.aiModelAnth) || "";
  }
  // food card: live for API modes, handoff variant otherwise
  document.getElementById("aiFoodCard").classList.toggle("hidden", !hasAIKey() && !isHandoff());
  document.getElementById("aiHandoffControls").classList.toggle("hidden", !isHandoff());
  document.getElementById("aiFoodGoBtn").classList.toggle("hidden", isHandoff());
  document.getElementById("aiPhotoBtn").classList.toggle("hidden", isHandoff());
  // coach chat: live API only; handoff points at Copy report
  document.getElementById("coachOpenBtn").classList.toggle("hidden", isHandoff());
  const note = document.getElementById("coachKeyNote");
  if (isHandoff()){
    note.classList.remove("hidden");
    note.textContent = "Handoff mode: tap Copy report and paste it into ChatGPT — it contains everything your coach needs, including how to send a program back.";
  } else if (hasAIKey()){ note.classList.add("hidden"); }
  else {
    note.classList.remove("hidden");
    note.textContent = "Chat needs a one-time API key — add it in Settings → AI Coach. Or choose ChatGPT handoff mode there to work key-free. Copy report always works.";
  }
  renderCheckin();
}

async function anthropicCall(messages, system, maxTokens){
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: aiModelFor("anthropic"), max_tokens: maxTokens || 3000, system: system, messages: messages }),
  });
  if (!res.ok){
    if (res.status===401 || res.status===403) throw new Error("Your Anthropic key was rejected — check it in Settings.");
    if (res.status===429) throw new Error("Rate limited — wait a few seconds and try again.");
    throw new Error("The AI service returned an error ("+res.status+"). Try again.");
  }
  const j = await res.json();
  return (j.content||[]).map(b=>b.type==="text"?b.text:"").join("");
}

async function openaiCall(messages, system, maxTokens){
  const msgs = [{role:"system", content:system}].concat(messages.map(m=>{
    if (Array.isArray(m.content)){
      return { role:m.role, content:m.content.map(b=>
        b.type==="image"
          ? { type:"image_url", image_url:{ url:"data:"+b.source.media_type+";base64,"+b.source.data } }
          : { type:"text", text:b.text }) };
    }
    return { role:m.role, content:m.content };
  }));
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type":"application/json", "authorization":"Bearer "+cfg.openaiKey },
    body: JSON.stringify({ model: aiModelFor("openai"), max_tokens: maxTokens || 3000, messages: msgs }),
  });
  if (!res.ok){
    if (res.status===401 || res.status===403) throw new Error("Your OpenAI key was rejected — check it in Settings.");
    if (res.status===429) throw new Error("Rate limited — wait a few seconds and try again.");
    throw new Error("The AI service returned an error ("+res.status+"). Try again.");
  }
  const j = await res.json();
  return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
}

function aiCall(messages, system, maxTokens){
  return aiProvider()==="openai" ? openaiCall(messages, system, maxTokens) : anthropicCall(messages, system, maxTokens);
}

// ---------- payload extraction from AI replies ----------
function extractAIPayloads(text){
  const out = { display: text, program: null, targets: null };
  const blocks = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/g;
  let m;
  while((m = re.exec(text)) !== null) blocks.push({raw:m[0], body:m[1]});
  blocks.forEach(b=>{
    try {
      const j = JSON.parse(b.body);
      if (j && Array.isArray(j.days)){ out.program = j; out.display = out.display.replace(b.raw, "").trim(); }
      else if (j && j.bpTargets){ out.targets = j.bpTargets; out.display = out.display.replace(b.raw, "").trim(); }
    } catch(e){ /* not JSON — leave it visible */ }
  });
  return out;
}

// ================== COACH CHAT ==================
let coachHistory = [];
function coachSystem(){
  return "You are the user's personal fitness coach inside the BlackPyre app. Be direct, specific, and evidence-based — no generic filler. Their live data follows.\n\n"
    + aiReport()
    + "\n\n---\nResponse contract:\n"
    + "- If you propose a new or edited training program, include EXACTLY ONE ```json code block containing the COMPLETE program: {\"name\":..., \"days\":[{\"id\":\"D1\",\"title\":...,\"exercises\":[{\"name\":...,\"scheme\":...}]}]}. Keep exercise names the user is progressing on unchanged so their history stays connected. Schemes like \"4×5\" power the app's auto-progression.\n"
    + "- If you propose new nutrition targets, include a ```json block: {\"bpTargets\":{\"calTarget\":...,\"proTarget\":...,\"carbGoal\":...,\"fatGoal\":...}} — exact daily numbers, not ranges.\n"
    + "- Otherwise reply in plain prose. Keep replies under 300 words unless asked for detail.";
}
function openCoach(prefillSend){
  lockScroll();
  document.getElementById("coachOverlay").classList.remove("hidden");
  if (!coachHistory.length){
    addCoachBubble("ai", "Hey — I have your full BlackPyre data in front of me: weight trend, nutrition, lift progression, and your current program. Ask me anything, or try:\n\n• How is my progress?\n• Adjust my program — [what's bugging you]\n• Why has my weight stalled?\n• Should I change my calories?", null);
  }
  if (prefillSend){
    document.getElementById("coachInput").value = prefillSend;
    sendCoach();
  }
}
document.getElementById("coachOpenBtn").addEventListener("click", ()=>{
  if (!hasAIKey()){
    flashSave("Add your AI key in Settings first", true);
    renderAIGates();
    return;
  }
  openCoach();
});
document.getElementById("coachCloseBtn").addEventListener("click", ()=>{
  document.getElementById("coachOverlay").classList.add("hidden");
  unlockScroll();
});
function addCoachBubble(role, text, payloads){
  const wrap = document.getElementById("coachMsgs");
  const div = document.createElement("div");
  div.className = "cmsg " + (role==="user" ? "user" : "ai");
  div.textContent = text;
  if (payloads && payloads.program){
    const b = document.createElement("button");
    b.className = "act";
    b.textContent = "Load program: " + (payloads.program.name || "Updated program");
    b.addEventListener("click", ()=>{
      try {
        program = validateProgram(payloads.program);
        saveProgram();
        extraExercises = [];
        renderDayOptions(); initSessionState(); renderSessionInputs(); renderWork(); renderDash(); renderNextWorkout();
        b.textContent = "✓ Loaded — it's your active program";
        b.disabled = true;
        flashSave("Program loaded ✓");
      } catch(e){ flashSave("Program invalid: "+e.message, true); }
    });
    div.appendChild(b);
  }
  if (payloads && payloads.targets){
    const t = payloads.targets;
    const b = document.createElement("button");
    b.className = "act";
    // accept exact keys; tolerate legacy range keys from older prompts by averaging
    const calT = typeof t.calTarget==="number" ? t.calTarget : (typeof t.calLo==="number" && typeof t.calHi==="number" ? Math.round((t.calLo+t.calHi)/2) : null);
    const proT = typeof t.proTarget==="number" ? t.proTarget : (typeof t.proLo==="number" && typeof t.proHi==="number" ? Math.round((t.proLo+t.proHi)/2) : null);
    b.textContent = "Apply targets: " + (calT||"?") + " kcal";
    b.addEventListener("click", ()=>{
      if (calT!=null){ cfg.calTarget = calT; }
      if (proT!=null) cfg.proTarget = proT;
      ["carbGoal","fatGoal"].forEach(k=>{ if (typeof t[k]==="number") cfg[k] = t[k]; });
      const sortedW = data.weights.slice().sort((a,b2)=>a.date.localeCompare(b2.date));
      cfg.lastTargetWt = sortedW.length ? sortedW[sortedW.length-1].lbs : cfg.lastTargetWt;
      delete cfg.adjustPromptedAt;
      saveCfg(); renderAll();
      b.textContent = "✓ Applied — bars updated";
      b.disabled = true;
      flashSave("Targets applied ✓");
    });
    div.appendChild(b);
  }
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}
async function sendCoach(){
  const inp = document.getElementById("coachInput");
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = "";
  addCoachBubble("user", msg, null);
  coachHistory.push({role:"user", content: msg});
  const typing = document.getElementById("coachTyping");
  typing.classList.remove("hidden");
  document.getElementById("coachSendBtn").disabled = true;
  try {
    const reply = await aiCall(coachHistory, coachSystem(), 3000);
    coachHistory.push({role:"assistant", content: reply});
    const p = extractAIPayloads(reply);
    addCoachBubble("ai", p.display || "Here you go:", p);
    cfg.lastCoachDate = todayStr();
    saveCfg();
    renderCheckin();
  } catch(e){
    addCoachBubble("ai", "" + e.message, null);
  }
  typing.classList.add("hidden");
  document.getElementById("coachSendBtn").disabled = false;
}
document.getElementById("coachSendBtn").addEventListener("click", sendCoach);

// ================== WEEKLY CHECK-IN ==================
function renderCheckin(){
  const card = document.getElementById("checkinCard");
  if (!hasAIKey() || !hasAnyData()){ card.classList.add("hidden"); return; }
  const last = cfg.lastCoachDate;
  const days = last ? Math.floor((new Date(todayStr()) - new Date(last))/86400000) : 999;
  card.classList.toggle("hidden", days < 7);
}
document.getElementById("checkinBtn").addEventListener("click", ()=>{
  openCoach("Give me my weekly review — assess my week, call out what needs fixing, and tell me what to focus on next week.");
});

// ================== PASTE PROGRAM FROM AI ==================
document.getElementById("pasteProgBtn").addEventListener("click", async ()=>{
  let text = "";
  try {
    if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText();
  } catch(e){ /* permission denied */ }
  if (!text) text = prompt("Paste the AI's reply (or just the JSON program) here:") || "";
  if (!text.trim()) return;
  let prog = null;
  const p = extractAIPayloads(text);
  if (p.program) prog = p.program;
  if (!prog){
    try { const j = JSON.parse(text.trim()); if (j && Array.isArray(j.days)) prog = j; } catch(e){}
  }
  if (!prog){
    const m = text.match(/\{[\s\S]*"days"[\s\S]*\}/);
    if (m){ try { const j = JSON.parse(m[0]); if (Array.isArray(j.days)) prog = j; } catch(e){} }
  }
  if (!prog){ flashSave("No program found in that text", true); return; }
  try {
    program = validateProgram(prog);
    saveProgram();
    extraExercises = [];
    renderDayOptions(); initSessionState(); renderSessionInputs(); renderWork(); renderDash(); renderNextWorkout();
    ackBtn("pasteProgBtn", "✓ Loaded: "+(program.name||"program"));
    flashSave("Program loaded ✓");
  } catch(e){ flashSave("Program invalid: "+e.message, true); }
});

// ================== AI FOOD LOGGING (text + photo) ==================
const FOOD_AI_SYSTEM = 'You are a nutrition estimator. Given a meal description or photo, respond with ONLY a JSON object, no prose, no code fences: {"foods":[{"name":"...","cal":0,"pro":0,"carb":0,"fat":0}]} — one entry per distinct food, realistic portion estimates, calories as kcal, macros in grams. If you cannot identify any food, return {"foods":[]}.';
function parseFoodsReply(text){
  let t = String(text||"")
    // smart/curly quotes from iPhone & ChatGPT copying -> straight quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    // zero-width & BOM junk -> gone; non-breaking spaces -> normal spaces
    .replace(/[\u200B\u200C\u200D\uFEFF\u2060]/g, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  t = t.trim();
  const j = JSON.parse(t);
  if (!j || !Array.isArray(j.foods)) throw new Error("bad shape");
  // strict shape: name + numeric cal/pro/carb/fat on every kept entry
  return j.foods.filter(f=>f && typeof f.name==="string" && f.name.trim()
      && ["cal","pro","carb","fat"].every(k=>Number.isFinite(Number(f[k]))))
    .map(f=>({
      name:String(f.name).trim(), cal:Number(f.cal), pro:Number(f.pro), carb:Number(f.carb), fat:Number(f.fat),
    }));
}
function aiFoodStatus(msg, isErr){
  const el = document.getElementById("aiFoodStatus");
  if (!msg){ el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.textContent = msg;
  el.style.color = isErr ? "var(--warn)" : "var(--dim)";
}
function scrollAiFoodIntoView(el, block){
  if (!el || typeof el.scrollIntoView!=="function") return;
  requestAnimationFrame(()=>{
    try { el.scrollIntoView({behavior:"smooth", block:block||"start"}); } catch(e){}
  });
}
function showFoodConfirm(foods){
  const el = document.getElementById("aiFoodConfirm");
  el.classList.remove("hidden");
  el.innerHTML = "";
  if (!foods.length){
    el.innerHTML = '<div class="note">The AI could not identify any food there. Try describing it, or use manual entry.</div>';
    return;
  }
  const items = foods.slice();
  const list = document.createElement("div");
  const add = document.createElement("button");
  add.className = "btn ghost small mt10 ai-confirm-log";
  add.style.width = "100%";
  function redraw(){
    list.innerHTML = "";
    items.forEach((f,i)=>{
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = '<div style="flex:1; min-width:0;"><div style="font-weight:500;">'+esc(f.name)+'</div>'
        +'<div style="color:var(--dim); font-size:11px;">'+Math.round(f.cal)+' kcal · '+Math.round(f.pro)+'P / '+Math.round(f.carb)+'C / '+Math.round(f.fat)+'F (estimate)</div></div>';
      const x = document.createElement("button");
      x.className = "del"; x.textContent = "✕"; x.setAttribute("aria-label","Remove");
      x.addEventListener("click", ()=>{ items.splice(i,1); redraw(); });
      row.appendChild(x);
      list.appendChild(row);
    });
    add.textContent = "✓ Log " + items.length + " item" + (items.length===1?"":"s") + " to " + currentMeal;
    add.disabled = items.length===0;
  }
  redraw();
  el.appendChild(list);
  const totals = document.createElement("div");
  totals.className = "note";
  totals.textContent = "Estimates — edit anything after logging with ✎.";
  el.appendChild(totals);
  add.addEventListener("click", ()=>{
    const loggedCount = items.length;
    items.forEach(f=>addEntry(Object.assign({}, f)));
    el.classList.add("hidden");
    if (isHandoff()){
      hfCloseParseBox();
      aiFoodStatus("Logged "+loggedCount+" ✓ — ready for another.");
      scrollAiFoodIntoView(document.getElementById("aiFoodCard"), "start");
    } else {
      aiFoodStatus(null);
    }
    flashSave("Logged "+loggedCount+" ✓");
  });
  el.appendChild(add);
  // Keep the first reviewed item comfortably inside the viewport instead of
  // pinning the confirmation container against the top edge on mobile.
  scrollAiFoodIntoView(list.firstElementChild || el, "center");
}
document.getElementById("aiFoodGoBtn").addEventListener("click", async ()=>{
  const q = document.getElementById("aiFoodText").value.trim();
  if (!q) return;
  aiFoodStatus("Estimating…");
  document.getElementById("aiFoodConfirm").classList.add("hidden");
  document.getElementById("aiFoodGoBtn").disabled = true;
  try {
    const reply = await aiCall([{role:"user", content:q}], FOOD_AI_SYSTEM, 1200);
    const foods = parseFoodsReply(reply);
    aiFoodStatus(null);
    showFoodConfirm(foods);
    document.getElementById("aiFoodText").value = "";
  } catch(e){
    aiFoodStatus(""+(e.message||"Could not estimate that"), true);
  }
  document.getElementById("aiFoodGoBtn").disabled = false;
});
document.getElementById("aiPhotoBtn").addEventListener("click", ()=>{ photoMode = "api"; document.getElementById("aiPhotoFile").click(); });
document.getElementById("aiPhotoFile").addEventListener("change", async (ev)=>{
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  if (photoMode==="handoff"){ hfSetPhoto(file); return; }
  aiFoodStatus("Reading photo…");
  document.getElementById("aiFoodConfirm").classList.add("hidden");
  try {
    const b64 = await downscaleImage(file, 1024);
    aiFoodStatus("Coach is looking at your plate…");
    const reply = await aiCall([{role:"user", content:[
      {type:"image", source:{type:"base64", media_type:"image/jpeg", data:b64}},
      {type:"text", text:"Identify the foods in this meal photo and estimate portions and macros."
        + (document.getElementById("aiPhotoCaption").value.trim() ? " Context from the user: " + document.getElementById("aiPhotoCaption").value.trim() + " — use it to identify the restaurant/dish and improve accuracy." : "")},
    ]}], FOOD_AI_SYSTEM, 1200);
    const foods = parseFoodsReply(reply);
    aiFoodStatus(null);
    showFoodConfirm(foods);
    document.getElementById("aiPhotoCaption").value = "";
  } catch(e){
    aiFoodStatus(""+(e.message||"Could not read that photo"), true);
  }
});
function downscaleImage(file, maxDim){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = ()=>{
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width*scale);
        c.height = Math.round(img.height*scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.8).split(",")[1]);
      } catch(e){ reject(e); }
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error("Could not open that image")); };
    img.src = url;
  });
}

// ================== CHATGPT HANDOFF MODE (no API key) ==================
let photoMode = "api"; // which flow the file input feeds
function handoffFoodPrompt(){
  const desc = document.getElementById("aiFoodText").value.trim();
  const cap = document.getElementById("aiPhotoCaption").value.trim();
  return "Act as a nutrition estimator. "
    + (desc ? "The meal: " + desc + ". " : "Identify the foods in the attached meal photo. ")
    + (cap ? "Context: " + cap + ". " : "")
    + "Estimate realistic portions and reply with ONLY this JSON, no prose, no code fences: "
    + '{"foods":[{"name":"...","cal":0,"pro":0,"carb":0,"fat":0}]} '
    + "— one entry per distinct food, calories in kcal, protein/carbs/fat in grams.";
}
document.getElementById("hfCopyFoodBtn").addEventListener("click", ()=>{
  const txt = handoffFoodPrompt();
  const done = ()=>{ ackBtn("hfCopyFoodBtn", "✓ Copied (text only)"); };
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(()=>{ fallbackCopy(txt); done(); });
  } else { fallbackCopy(txt); done(); }
});
document.getElementById("hfShareBtn").addEventListener("click", ()=>{
  photoMode = "handoff";
  document.getElementById("aiPhotoFile").click();
});

// staged handoff photo: memory-only, never stored, explicitly cleared
let hfPhoto = null;
let hfPhotoUrl = null;
function hfSetPhoto(file){
  hfClearPhoto(true);
  hfPhoto = file;
  try { hfPhotoUrl = URL.createObjectURL(file); document.getElementById("hfPhotoThumb").src = hfPhotoUrl; } catch(e){}
  document.getElementById("hfPhotoStatus").textContent = "Photo selected — now share to ChatGPT or attach it manually.";
  document.getElementById("hfPhotoStage").classList.remove("hidden");
  aiFoodStatus(null);
}
function hfClearPhoto(silent){
  if (hfPhotoUrl){ try { URL.revokeObjectURL(hfPhotoUrl); } catch(e){} }
  hfPhoto = null; hfPhotoUrl = null;
  document.getElementById("hfPhotoThumb").removeAttribute("src");
  document.getElementById("hfPhotoStage").classList.add("hidden");
  document.getElementById("aiPhotoFile").value = "";
  if (!silent) aiFoodStatus(null);
}
async function hfCopyPromptOnly(ackId){
  const txt = handoffFoodPrompt();
  if (navigator.clipboard && navigator.clipboard.writeText){
    try { await navigator.clipboard.writeText(txt); } catch(e){ fallbackCopy(txt); }
  } else fallbackCopy(txt);
  if (ackId) ackBtn(ackId, "✓ Copied (text only)");
}
document.getElementById("hfCopy2Btn").addEventListener("click", async ()=>{
  await hfCopyPromptOnly("hfCopy2Btn");
  aiFoodStatus("Prompt copied (text only — the photo is NOT copied). Attach the photo in ChatGPT yourself, then paste its reply back here.");
});
document.getElementById("hfClearBtn").addEventListener("click", ()=>{
  hfClearPhoto();
  aiFoodStatus("Photo cleared.");
});
document.getElementById("hfShareGoBtn").addEventListener("click", async ()=>{
  if (!hfPhoto) return;
  const promptTxt = handoffFoodPrompt();
  if (navigator.share && navigator.canShare && navigator.canShare({files:[hfPhoto]})){
    try {
      await navigator.share({ files:[hfPhoto], title:"BlackPyre food estimate", text: promptTxt });
      hfClearPhoto(true); // successful share: photo's job is done
      aiFoodStatus("Shared ✓ — when ChatGPT replies, tap Paste reply.");
      return;
    } catch(e){
      if (e && e.name==="AbortError"){
        hfClearPhoto(true);
        aiFoodStatus("Share cancelled — photo cleared.");
        return;
      }
      // real failure: fall through to explicit fallback, keep the photo visible
    }
  }
  await hfCopyPromptOnly(null);
  aiFoodStatus("Prompt copied. ChatGPT may not accept photos from this share sheet. Open ChatGPT and attach the photo manually, then paste its reply back here.", true);
});
document.getElementById("hfPasteBtn").addEventListener("click", async ()=>{
  // always show the visible paste box — clipboard access is unreliable in home-screen apps
  const box = document.getElementById("hfPasteBox");
  const ta = document.getElementById("hfPasteText");
  box.classList.remove("hidden");
  document.getElementById("aiFoodConfirm").classList.add("hidden");
  let clip = "";
  try {
    if (navigator.clipboard && navigator.clipboard.readText) clip = await navigator.clipboard.readText();
  } catch(e){ /* permission denied — user pastes manually */ }
  if (clip && clip.trim()) ta.value = clip; // prefill for verification, still shown
  aiFoodStatus("Paste reply below, then tap Review estimate.");
  try { ta.focus(); } catch(e){}
});
function hfCloseParseBox(){
  document.getElementById("hfPasteText").value = ""; // raw response discarded — never stored
  document.getElementById("hfPasteBox").classList.add("hidden");
}
document.getElementById("hfPasteCancelBtn").addEventListener("click", ()=>{
  hfCloseParseBox();
  aiFoodStatus(null);
});
document.getElementById("hfReviewBtn").addEventListener("click", ()=>{
  const raw = document.getElementById("hfPasteText").value;
  if (!raw.trim()){
    aiFoodStatus("The box is empty — paste ChatGPT's reply into it first.", true);
    return;
  }
  try {
    const foods = parseFoodsReply(raw);
    hfCloseParseBox();
    aiFoodStatus("Estimate ready — review before logging.");
    showFoodConfirm(foods);
    document.getElementById("aiFoodText").value = "";
    hfClearPhoto(true); // result imported — the photo's flow is complete
  } catch(e){
    aiFoodStatus("Could not read that JSON. Copy ChatGPT's whole response and try again.", true);
  }
});


// ================== AI COACH REPORT ==================
function aiReport(){
  const today = todayStr();
  const sorted = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const cur = sorted.length ? sorted[sorted.length-1].lbs : cfg.startWt;
  const sl = weightSlope(28);
  const rate = sl ? Math.round(sl.slope*7*10)/10 : null;
  const tdee = (typeof computeTDEE==="function") ? computeTDEE() : null;

  // nutrition adherence: last 14 days
  const days = [];
  for(let i=13;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    days.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"));
  }
  const logged = days.filter(d=>(data.food[d]||[]).length>0);
  const fullDays = logged.map(d=>daySums(d)).filter(x=>x.cal>500);
  const avgCal = fullDays.length ? Math.round(fullDays.reduce((a,x)=>a+x.cal,0)/fullDays.length) : null;
  const avgPro = fullDays.length ? Math.round(fullDays.reduce((a,x)=>a+x.pro,0)/fullDays.length) : null;
  const proHit = logged.filter(d=>daySums(d).pro>=dayTargets(d).pro).length;

  // training: last 28 days
  const cut28 = new Date(Date.now()-28*86400000);
  const cutStr = cut28.getFullYear()+"-"+String(cut28.getMonth()+1).padStart(2,"0")+"-"+String(cut28.getDate()).padStart(2,"0");
  const recent = data.workouts.filter(w=>w.date>=cutStr);
  const strengthS = recent.filter(w=>w.day!=="CARDIO").length;
  const cardioS = recent.filter(w=>w.day==="CARDIO").length;

  // per-lift progression: every program exercise with history
  const liftLines = [];
  program.days.forEach(d=>d.exercises.forEach(ex=>{
    const name = ex.name.replace("[Cardio] ","");
    const hist = liftHistory(name);
    if (!hist.length) return;
    const last3 = hist.slice(-3).map(p=>fmtDate(p.date)+": ~"+Math.round(p.y));
    const goal = (cfg.liftGoals||{})[name];
    liftLines.push("- **"+name+"** ("+(ex.scheme||"no scheme")+"): est-1RM trend "+last3.join(" → ")
      +(goal ? " · goal "+goal : ""));
  }));

  const L = [];
  L.push("# BlackPyre Progress Report — "+fmtDate(today));
  L.push("");
  L.push("You are my fitness coach. Below is my real logged data from the BlackPyre app. Please:");
  L.push("1. Assess my rate of progress toward my goal — too fast, too slow, or on track.");
  L.push("2. Flag anything in my nutrition adherence that needs fixing.");
  L.push("3. Review my lift progression and suggest specific training adjustments.");
  L.push("4. If my program should change, return a COMPLETE updated program as a JSON code block in the exact format shown at the bottom (same structure, keep exercise names I'm progressing on unchanged so my history stays connected). I will load it directly into the app.");
  L.push("5. Be direct — no generic advice.");
  L.push("");
  L.push("## Goal & weight");
  L.push("- Start: "+cfg.startWt+" lb · Current: "+cur+" lb · Goal: "+cfg.goalWt+" lb");
  L.push(rate!=null ? "- Trend (last 28 days): "+(rate>0?"+":"")+rate+" lb/week" : "- Trend: not enough weigh-ins yet ("+sorted.length+" recorded)");
  if (tdee && tdee.tdee) L.push("- Measured TDEE from my actual logs: ~"+tdee.tdee+" kcal/day");
  L.push("");
  L.push("## Nutrition (last 14 days)");
  L.push("- Daily targets (exact): "+cfg.calTarget+" kcal"+(cfg.calSchedMode!=="same"?" (scheduled by day; weekly total "+weeklyCalTotal()+")":"")+" · protein "+cfg.proTarget+"g · carbs "+cfg.carbGoal+"g · fat "+cfg.fatGoal+"g");
  L.push(logged.length ? "- Logged "+logged.length+" of 14 days · avg "+ (avgCal!=null ? avgCal+" kcal, "+avgPro+"g protein" : "insufficient full days") + " · protein target hit "+proHit+"/"+logged.length+" days" : "- No food logged in the last 14 days");
  L.push("");
  L.push("## Training (last 28 days)");
  L.push("- "+strengthS+" strength sessions, "+cardioS+" cardio sessions · program: \""+(program.name||"unnamed")+"\" ("+program.days.length+" days/rotation)");
  if (liftLines.length){ L.push("- Lift progression (best estimated 1RM per session):"); liftLines.forEach(x=>L.push("  "+x)); }
  else L.push("- No strength sessions logged against the current program yet.");
  L.push("");
  L.push("## My current program (edit this and return the full updated JSON)");
  L.push("```json");
  L.push(JSON.stringify(program, null, 2));
  L.push("```");
  L.push("");
  L.push("Program format rules: top level {name, days:[...]}; each day {id:\"D1\", title, exercises:[{name, scheme}]}; schemes like \"4×5\" or \"3×8-12\" power the app's prefill and auto-progression; cardio entries are named \"[Cardio] Type\" with a duration as the scheme.");
  return L.join("\n");
}
document.getElementById("aiDownloadBtn").addEventListener("click", ()=>{
  download("blackpyre-report-"+todayStr()+".md", aiReport());
  ackBtn("aiDownloadBtn", "✓ Downloaded");
});
document.getElementById("aiCopyBtn").addEventListener("click", ()=>{
  const txt = aiReport();
  const done = ()=>ackBtn("aiCopyBtn", "✓ Copied — paste into any AI");
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(()=>{ fallbackCopy(txt); done(); });
  } else { fallbackCopy(txt); done(); }
});
function fallbackCopy(txt){
  const ta = document.createElement("textarea");
  ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch(e){}
  document.body.removeChild(ta);
}

// ================== ANALYTICS ==================
// --- generic line chart (dates -> values) with optional goal line ---
function lineChartSVG(pts, goal){
  const w=640, h=230, pad=40;
  if (!pts.length) return '<div class="note">Not enough data yet.</div>';
  const ys = pts.map(p=>p.y).concat(goal?[goal]:[]);
  const minY = Math.min.apply(null, ys)-10, maxY = Math.max.apply(null, ys)+10;
  const t0 = new Date(pts[0].date).getTime();
  const t1 = Math.max(new Date(pts[pts.length-1].date).getTime(), t0+1);
  const x = d => pad + ((new Date(d).getTime()-t0)/(t1-t0)) * (w-pad*2);
  const y = v => h-pad-((v-minY)/(maxY-minY))*(h-pad*2);
  let grid=""; for(let i=0;i<5;i++){const gy=pad+(i/4)*(h-pad*2); grid+='<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+gy+'" y2="'+gy+'" stroke="var(--border)" stroke-width="1"/>';}
  const line = pts.length>1 ? '<polyline points="'+pts.map(p=>x(p.date)+","+y(p.y)).join(" ")+'" fill="none" stroke="url(#lg2)" stroke-width="3" stroke-linecap="round"/>' : "";
  const dots = pts.map(p=>'<circle cx="'+x(p.date)+'" cy="'+y(p.y)+'" r="4.5" fill="var(--panel)" stroke="var(--ember)" stroke-width="2.5"/>'
    +'<text x="'+x(p.date)+'" y="'+(y(p.y)-11)+'" text-anchor="middle" font-size="10" fill="var(--text)" font-family="IBM Plex Mono">'+Math.round(p.y)+'</text>').join("");
  const goalLine = goal ? '<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+y(goal)+'" y2="'+y(goal)+'" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="6 5"/>'
    +'<text x="'+(w-pad)+'" y="'+(y(goal)-7)+'" text-anchor="end" font-size="11" fill="var(--ok)" font-family="IBM Plex Mono">GOAL '+goal+'</text>' : "";
  return '<svg viewBox="0 0 '+w+' '+h+'"><defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="var(--ember-deep)"/><stop offset="100%" stop-color="var(--ember)"/></linearGradient></defs>'
    +grid+goalLine+line+dots+'</svg>';
}

// --- per-lift chart overlay ---
let liftOverlayEx = null;
function liftHistory(exName){
  const byDate = {};
  data.workouts.forEach(s=>{
    const v = s.sets[exName];
    if (!v) return;
    const b = parseBestSet(v);
    if (b && (!byDate[s.date] || b.e1rm>byDate[s.date])) byDate[s.date] = b.e1rm;
  });
  return Object.keys(byDate).sort().map(d=>({date:d, y:byDate[d]}));
}
function openLiftChart(exName){
  liftOverlayEx = exName;
  document.getElementById("liftTitle").textContent = exName;
  const goal = (cfg.liftGoals||{})[exName] || null;
  const pts = liftHistory(exName);
  document.getElementById("liftChart").innerHTML = lineChartSVG(pts, goal);
  document.getElementById("liftGoalInput").value = goal || "";
  const best = pts.length ? Math.round(Math.max.apply(null, pts.map(p=>p.y))) : 0;
  document.getElementById("liftGoalNote").textContent = goal
    ? "Current best: ~"+best+" est. 1RM · "+Math.max(0, goal-best)+" lb to go"
    : "Set a goal to draw a target line on the chart.";
  if (document.getElementById("liftOverlay").classList.contains("hidden")){
    lockScroll();
    document.getElementById("liftOverlay").scrollTop = 0;
  }
  document.getElementById("liftOverlay").classList.remove("hidden");
}
document.getElementById("liftCloseBtn").addEventListener("click", ()=>{
  document.getElementById("liftOverlay").classList.add("hidden");
  unlockScroll();
});
document.getElementById("liftGoalSave").addEventListener("click", ()=>{
  const v = Number(document.getElementById("liftGoalInput").value);
  if(!cfg.liftGoals) cfg.liftGoals = {};
  if (v>0) cfg.liftGoals[liftOverlayEx] = v; else delete cfg.liftGoals[liftOverlayEx];
  saveCfg();
  ackBtn("liftGoalSave", "✓ Goal set");
  openLiftChart(liftOverlayEx);
});

// --- weekly review ---
function renderWeek(){
  const card = document.getElementById("weekCard");
  const now = new Date();
  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(now); d.setDate(d.getDate()-i);
    days.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"));
  }
  const logged = days.filter(d=>(data.food[d]||[]).length>0);
  const sessions = data.workouts.filter(w=>days.indexOf(w.date)>=0).length;
  const wIn = data.weights.filter(w=>days.indexOf(w.date)>=0).sort((a,b)=>a.date.localeCompare(b.date));
  if (!logged.length && !sessions && wIn.length<2){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  const fullDays = logged.map(d=>daySums(d)).filter(x=>x.cal>500);
  const avgCal = fullDays.length ? Math.round(fullDays.reduce((s,x)=>s+x.cal,0)/fullDays.length) : null;
  const proDays = logged.filter(d=>daySums(d).pro>=dayTargets(d).pro).length;
  let html = "";
  if (avgCal!=null){
    const weekAvgT = Math.round(weeklyCalTotal()/7);
    const inBand = Math.abs(avgCal-weekAvgT) <= 100;
    html += 'Avg calories: <b style="color:'+(inBand?'var(--ok)':'var(--text)')+'">'+avgCal+'</b> <span style="color:var(--dim)">/ '+weekAvgT+'</span><br>';
  }
  if (logged.length) html += 'Protein target hit: <b>'+proDays+' of '+logged.length+'</b> logged days<br>';
  html += 'Sessions: <b>'+sessions+'</b> this week<br>';
  if (wIn.length>=2){
    const dw = Math.round((wIn[wIn.length-1].lbs - wIn[0].lbs)*10)/10;
    html += 'Weight: <b style="color:'+(dw<=0?'var(--ok)':'var(--text)')+'">'+(dw>0?'+':'')+dw+' lb</b> this week';
  }
  document.getElementById("weekBody").innerHTML = html;
}

// --- goal projection ---
function weightSlope(daysBack){
  const cutoff = new Date(Date.now() - daysBack*86400000);
  const cutStr = cutoff.getFullYear()+"-"+String(cutoff.getMonth()+1).padStart(2,"0")+"-"+String(cutoff.getDate()).padStart(2,"0");
  const wts = data.weights.filter(w=>w.date>=cutStr).sort((a,b)=>a.date.localeCompare(b.date));
  if (wts.length<4) return null;
  const span = (new Date(wts[wts.length-1].date) - new Date(wts[0].date))/86400000;
  if (span<10) return null;
  const t0 = new Date(wts[0].date).getTime();
  const pts = wts.map(w=>({x:(new Date(w.date).getTime()-t0)/86400000, y:w.lbs}));
  const n=pts.length, sx=pts.reduce((s,p)=>s+p.x,0), sy=pts.reduce((s,p)=>s+p.y,0);
  const sxx=pts.reduce((s,p)=>s+p.x*p.x,0), sxy=pts.reduce((s,p)=>s+p.x*p.y,0);
  const den = n*sxx-sx*sx;
  if (!den) return null;
  return { slope:(n*sxy-sx*sy)/den, current: wts[wts.length-1].lbs };
}
function renderProjection(){
  const el = document.getElementById("projLine");
  const r = weightSlope(35);
  if (!r){ el.classList.add("hidden"); return; }
  const rate = Math.round(r.slope*7*10)/10; // lb/week
  const toGo = cfg.goalWt - r.current;      // negative when cutting
  el.classList.remove("hidden");
  if (Math.abs(rate) < 0.15){
    el.textContent = "Trend: holding steady — not enough movement to project a goal date.";
    return;
  }
  if ((toGo<0 && rate>=0) || (toGo>0 && rate<=0)){
    el.textContent = "Trending "+(rate>0?"+":"")+rate+" lb/week right now — but you are here, logging, which is how every turnaround starts. Refocus this week; the trend follows the work.";
    return;
  }
  const weeks = toGo/rate;
  if (weeks > 104){
    el.textContent = "Trending "+(rate>0?"+":"")+rate+" lb/week — over ~2 years to goal at this rate.";
    return;
  }
  const eta = new Date(Date.now() + weeks*7*86400000);
  const fmt = eta.toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"});
  el.innerHTML = 'At your current rate (<b>'+(rate>0?'+':'')+rate+' lb/week</b>), you reach <b class="ember-text">'+cfg.goalWt+' lb around '+fmt+'</b>.';
}

// --- body measurements (optional) ---
function renderMeasureToggle(){
  document.getElementById("measureToggleBtn").textContent = cfg.measureOn ? "Disable body measurements" : "Enable body measurements";
  document.getElementById("measureCard").classList.toggle("hidden", !cfg.measureOn);
}
document.getElementById("measureToggleBtn").addEventListener("click", ()=>{
  cfg.measureOn = !cfg.measureOn;
  saveCfg();
  renderMeasureToggle();
  ackBtn("measureToggleBtn", cfg.measureOn ? "✓ Enabled" : "✓ Disabled");
  renderMeasure();
});
document.getElementById("mSaveBtn").addEventListener("click", ()=>{
  const waist = Number(document.getElementById("mWaist").value)||null;
  const chest = Number(document.getElementById("mChest").value)||null;
  const arm = Number(document.getElementById("mArm").value)||null;
  if (!waist && !chest && !arm){ flashSave("Enter at least one", true); return; }
  if (!data.measure) data.measure = [];
  const dt = todayStr();
  data.measure = data.measure.filter(m=>m.date!==dt);
  data.measure.push({date:dt, waist:waist, chest:chest, arm:arm});
  ["mWaist","mChest","mArm"].forEach(id=>document.getElementById(id).value="");
  save(); renderMeasure();
  ackBtn("mSaveBtn", "✓ Saved");
});
function renderMeasure(){
  if (!cfg.measureOn) return;
  const el = document.getElementById("mList");
  const list = (data.measure||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  if (!list.length){ el.innerHTML = ""; return; }
  el.innerHTML = list.map((m,i)=>{
    const prev = list[i+1];
    const delta = (cur, pre)=> (cur!=null && pre!=null) ? ' <span style="color:'+(cur<pre?'var(--ok)':'var(--dim)')+'; font-size:10px;">('+(cur-pre>0?'+':'')+Math.round((cur-pre)*10)/10+')</span>' : '';
    return '<div class="list-item"><span style="flex:1; color:var(--dim);">'+fmtDate(m.date)+'</span>'
      +'<span style="flex:3; text-align:right; font-size:12px;">'
      +(m.waist!=null?('W '+m.waist+delta(m.waist, prev&&prev.waist)+'  '):'')
      +(m.chest!=null?('C '+m.chest+delta(m.chest, prev&&prev.chest)+'  '):'')
      +(m.arm!=null?('A '+m.arm+delta(m.arm, prev&&prev.arm)):'')
      +'</span>'
      +'<button class="del mdel" data-d="'+m.date+'" aria-label="Delete">✕</button></div>';
  }).join("");
  el.querySelectorAll(".mdel").forEach(b=>b.addEventListener("click",()=>{
    data.measure = data.measure.filter(m=>m.date!==b.dataset.d);
    save(); renderMeasure();
  }));
}

