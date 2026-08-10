"use strict";
// ================== bars ==================
function exactBarHTML(label, value, target, unit, kind){
  if (!Number.isFinite(Number(target)) || Number(target)<=0) return "";
  const max = target*1.25;
  const pct = Math.min(100,(value/max)*100);
  const tp = Math.min(100,(target/max)*100);
  const over = value - target;
  let cls = "mid", color = "var(--progress)";                         // below target = in-progress gold
  if (value >= target){
    cls = "ok"; color = "var(--ok)";                                  // target reached = green
    if (kind!=="pro"){
      const redAt = kind==="cal" ? 100 : kind==="carb" ? 15 : 8;      // allowed buffer above target
      if (over >= redAt){ cls = "over"; color = "var(--warn)"; }       // past buffer = red
    }
  }
  return '<div class="bar-head"><span class="label" style="margin:0;">'+label+'</span>'
    +'<span class="bar-val" style="color:'+color+'">'+Math.round(value)+' <span class="t">/ '+target+' '+unit+'</span></span></div>'
    +'<div class="bar"><div class="band" style="left:'+tp+'%; width:2px;"></div>'
    +'<div class="fill '+cls+'" style="width:'+pct+'%;"></div></div>';
}
const MEALS = ["breakfast","lunch","dinner","snacks"];
const MEAL_LABEL = {breakfast:"Breakfast", lunch:"Lunch", dinner:"Dinner", snacks:"Snacks", other:"Uncategorized"};

function defaultMeal(){
  const h = new Date().getHours() + new Date().getMinutes()/60;
  if (h < 10.5) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 20.5) return "dinner";
  return "snacks";
}
let currentMeal = defaultMeal();
function renderMealSeg(){
  document.querySelectorAll("#mealSeg button").forEach(b=>{
    b.classList.toggle("on", b.dataset.meal===currentMeal);
  });
}
document.querySelectorAll("#mealSeg button").forEach(b=>b.addEventListener("click", ()=>{
  currentMeal = b.dataset.meal;
  foodSuggestionPage = 0;
  renderMealSeg(); renderFood();
}));
document.getElementById("recentsOpenBtn").addEventListener("click", ()=>{
  renderRecents();
  lockScroll();
  document.getElementById("recentsOverlay").classList.remove("hidden");
  document.getElementById("recentsOverlay").scrollTop = 0;
});
document.getElementById("recentsCloseBtn").addEventListener("click", ()=>{
  document.getElementById("recentsOverlay").classList.add("hidden");
  unlockScroll();
});

const foodDateEl = document.getElementById("foodDate");
foodDateEl.value = todayStr();
foodDateEl.addEventListener("change", ()=>{ cancelEditFood(); foodSuggestionPage=0; renderFood(); });

function daySums(dateStr){
  const list = data.food[dateStr]||[];
  const s = {cal:0,pro:0,carb:0,fat:0};
  list.forEach(f=>{ s.cal+=Number(f.cal||0); s.pro+=Number(f.pro||0); s.carb+=Number(f.carb||0); s.fat+=Number(f.fat||0); });
  return s;
}
function allBarsHTML(s, ds){
  if (!nutritionTargetsReady()){
    return '<div class="note" style="font-size:12px; margin:0;">Set targets in Settings.</div>';
  }
  const d = ds || todayStr();
  const t = dayTargets(d);
  return exactBarHTML("Calories", s.cal, t.cal, "kcal", "cal")
    + exactBarHTML("Protein", s.pro, t.pro, "g", "pro")
    + exactBarHTML("Carbs", s.carb, t.carb, "g", "carb")
    + exactBarHTML("Fat", s.fat, t.fat, "g", "fat");
}


// ================== v62: EXPANDED USDA-ANCHORED FOOD SUGGESTIONS ==================
// Deterministic and private: suggestions rank the bundled USDA reference catalog
// alongside foods already stored in BlackPyre. No live database or AI call is made.
// Nothing is logged until the user reviews the normal amount card and taps Add.
let foodSuggestionPage = 0;

function foodSuggestionsEnabled(){ return cfg.foodSuggestionsOn===true; }
function foodSuggestionWeightLossEnabled(){ return cfg.foodSuggestionsWeightLoss!==false; }
function foodSuggestionAvoidTerms(){
  return String(cfg.foodSuggestionsAvoid||"").toLowerCase().split(/[,\n]/)
    .map(x=>x.trim()).filter(x=>x.length>1);
}
function foodSuggestionCategory(cal, pro, carb, fat, fallback){
  if (fallback) return fallback;
  const c = Math.max(1, Number(cal)||0);
  if ((Number(pro)||0)*4/c >= 0.34) return "protein";
  if ((Number(carb)||0)*4/c >= 0.58) return "carb";
  if ((Number(fat)||0)*9/c >= 0.58) return "fat";
  return "balanced";
}
function makeFoodSuggestionCandidate(food, amount, unit, grams, portion, source, category){
  const g = Number(grams);
  if (!food || !Number.isFinite(g) || g<=0) return null;
  const cal = scaleMacro(Number(food.cal100)||0,g);
  const pro = scaleMacro(Number(food.pro100)||0,g);
  const carb = scaleMacro(Number(food.carb100)||0,g);
  const fat = scaleMacro(Number(food.fat100)||0,g);
  if (!Number.isFinite(cal) || cal<=0) return null;
  const key = food.name+"|"+(food.brand||"");
  return {
    food:food, amount:amount, unit:unit, grams:g, portion:portion,
    source:source, category:foodSuggestionCategory(cal,pro,carb,fat,category),
    cal:cal, pro:pro, carb:carb, fat:fat,
    familiar:Number((data.foodCounts||{})[key]||0),
    mealFamiliar:Number(((data.mealCounts||{})[currentMeal]||{})[key]||0),
  };
}
function foodSuggestionCandidates(){
  const out = [];
  (data.recents||[]).forEach(r=>{
    let amount = Number(r.lastAmt), unit = r.lastUnit || "";
    let grams = 0, portion = "";
    if (amount>0 && ["g","oz","lb","ml","floz","serving"].includes(unit) && (unit!=="serving" || Number(r.servingG)>0)){
      grams = toGrams(amount, unit, r.servingG);
      portion = amount+" "+(unit==="serving" ? "serving"+(amount===1?"":"s") : unit);
    } else if (Number(r.servingG)>0){
      amount=1; unit="serving"; grams=Number(r.servingG);
      portion = r.servingLabel ? "1 serving ("+r.servingLabel+")" : "1 serving";
    }
    const c = makeFoodSuggestionCandidate(r,amount,unit,grams,portion,"recent",null);
    if (c) out.push(c);
  });
  Object.keys(data.myFoods||{}).forEach(k=>{
    const f=data.myFoods[k];
    if (!f || !(Number(f.servingG)>0)) return;
    const portion=f.servingLabel ? "1 serving ("+f.servingLabel+")" : "1 serving";
    const c=makeFoodSuggestionCandidate(f,1,"serving",Number(f.servingG),portion,"saved",null);
    if (c) out.push(c);
  });
  FOOD_SUGGESTION_CATALOG.forEach(st=>{
    const food={
      name:st.name, brand:"USDA reference · SR28",
      cal100:st.cal100, pro100:st.pro100, carb100:st.carb100, fat100:st.fat100,
      servingG:st.servingG, servingLabel:st.servingLabel,
      suggestionNdb:st.ndb, suggestionUsdaDescription:st.usdaDescription
    };
    const c=makeFoodSuggestionCandidate(food,1,"serving",st.servingG,st.servingLabel,"catalog",st.category);
    if (c) out.push(c);
  });
  const avoids=foodSuggestionAvoidTerms();
  const best=new Map();
  out.forEach(c=>{
    const hay=(c.food.name+" "+(c.food.brand||"")).toLowerCase();
    if (avoids.some(t=>hay.includes(t))) return;
    const key=String(c.food.name).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const old=best.get(key);
    if (!old || c.familiar+c.mealFamiliar > old.familiar+old.mealFamiliar || (c.source!=="catalog" && old.source==="catalog")) best.set(key,c);
  });
  return [...best.values()];
}
function scoreFoodSuggestion(c, rem){
  const calRoom=Math.max(1,rem.cal);
  const desired=Math.min(450,Math.max(120,calRoom*0.45));
  const calFit=Math.max(0,1-Math.abs(c.cal-desired)/Math.max(desired,1));
  let score=calFit*24;
  if (c.cal<=rem.cal) score+=18;
  else score-=Math.min(70,(c.cal-rem.cal)*0.38);
  if (rem.pro>0) score+=Math.min(1,c.pro/rem.pro)*38;
  else if (c.pro>=15) score+=6;
  if (rem.carb>0) score+=Math.min(1,c.carb/rem.carb)*9;
  if (rem.fat>0) score+=Math.min(1,c.fat/rem.fat)*7;
  score-=Math.max(0,c.carb-rem.carb)*0.45;
  score-=Math.max(0,c.fat-rem.fat)*1.15;
  score+=Math.min(15,Math.log2(c.familiar+1)*5);
  score+=Math.min(12,c.mealFamiliar*2.5);
  if (foodSuggestionWeightLossEnabled()){
    const proteinShare=(c.pro*4)/Math.max(c.cal,1);
    score+=Math.min(22,proteinShare*48);
    if (c.category==="produce") score+=12;
    if (c.cal<=250) score+=5;
    if (c.cal>rem.cal) score-=18;
  }
  return score;
}
function rankedFoodSuggestions(rem){
  return foodSuggestionCandidates()
    .filter(c=>c.cal<=Math.max(rem.cal+100,rem.cal*1.2))
    .map(c=>Object.assign(c,{score:scoreFoodSuggestion(c,rem)}))
    .sort((a,b)=>b.score-a.score || b.mealFamiliar-a.mealFamiliar || b.familiar-a.familiar || a.cal-b.cal);
}
function chooseFoodSuggestions(ranked){
  if (!ranked.length) return [];
  const pool=ranked.slice(0,Math.min(24,ranked.length));
  const start=(foodSuggestionPage*3)%pool.length;
  const rotated=pool.slice(start).concat(pool.slice(0,start));
  const picked=[], cats=new Set();
  rotated.forEach(c=>{
    if (picked.length>=3 || cats.has(c.category)) return;
    picked.push(c); cats.add(c.category);
  });
  rotated.forEach(c=>{ if (picked.length<3 && !picked.includes(c)) picked.push(c); });
  return picked.slice(0,3);
}
function foodSuggestionReason(c, rem){
  if (c.mealFamiliar>0) return "Familiar "+currentMeal+" choice";
  if (c.familiar>1) return "A food you log often";
  if (rem.pro>0 && c.pro>=Math.min(20,rem.pro*0.35)) return "Helps close your protein gap";
  if (foodSuggestionWeightLossEnabled() && c.category==="produce") return "More food volume for fewer calories";
  if (foodSuggestionWeightLossEnabled() && c.cal<=250 && c.pro>=10) return "Protein-forward, calorie-conscious option";
  if (rem.carb>0 && c.carb>=Math.min(25,rem.carb*0.35)) return "Helps fill your remaining carbs";
  return "Fits today's remaining targets";
}
function reviewFoodSuggestion(c){
  selectFood(c.food);
  const opt=[...qtyUnitEl.options].some(o=>o.value===c.unit) ? c.unit : "g";
  qtyUnitEl.value=opt;
  qtyAmountEl.value=opt===c.unit ? c.amount : Math.round(c.grams);
  syncSliderToUnit(); updateCalc();
}
function renderFoodSuggestions(){
  const card=document.getElementById("foodSuggestionsCard");
  const summary=document.getElementById("foodSuggestionsSummary");
  const list=document.getElementById("foodSuggestionsList");
  if (!foodSuggestionsEnabled() || foodDateEl.value!==todayStr()){
    card.classList.add("hidden"); list.innerHTML=""; return;
  }
  card.classList.remove("hidden");
  if (!nutritionTargetsReady()){
    summary.textContent="Set calorie and macro targets in Settings first.";
    list.innerHTML='<div class="note">Suggestions need your daily targets so they can fit the rest of your day.</div>';
    return;
  }
  const used=daySums(foodDateEl.value), t=dayTargets(foodDateEl.value);
  const rem={cal:Math.max(0,t.cal-used.cal),pro:Math.max(0,t.pro-used.pro),carb:Math.max(0,t.carb-used.carb),fat:Math.max(0,t.fat-used.fat)};
  summary.textContent=Math.round(rem.cal)+" kcal · "+Math.round(rem.pro)+"g protein · "+Math.round(rem.carb)+"g carbs · "+Math.round(rem.fat)+"g fat remaining";
  if (rem.cal<60){
    list.innerHTML='<div class="note">Your calorie target is reached or nearly reached'+(rem.pro>0?' while '+Math.round(rem.pro)+'g protein remains. No normal food can close that gap without adding calories.':'. No need to force another food.')+'</div>';
    return;
  }
  const picked=chooseFoodSuggestions(rankedFoodSuggestions(rem));
  if (!picked.length){
    list.innerHTML='<div class="note">No suggestion fits the remaining targets and your exclusion list. Adjust the exclusions or log normally.</div>';
    return;
  }
  list.innerHTML="";
  picked.forEach(c=>{
    const b=document.createElement("button");
    b.type="button"; b.className="result";
    b.setAttribute("aria-label","Review suggestion: "+c.food.name+", "+c.portion);
    b.innerHTML='<div class="r-name">'+esc(c.food.name)+' <span style="color:var(--dim); font-weight:400;">· '+esc(c.portion)+'</span></div>'
      +'<div class="r-brand">'+esc(foodSuggestionReason(c,rem)+(c.source==="catalog" ? " · USDA reference" : ""))+'</div>'
      +'<div class="r-macros">'+Math.round(c.cal)+' kcal · '+Math.round(c.pro)+'P / '+Math.round(c.carb)+'C / '+Math.round(c.fat)+'F · tap to review</div>';
    b.addEventListener("click",()=>reviewFoodSuggestion(c));
    list.appendChild(b);
  });
}
function renderFoodSuggestionSettings(){
  const on=foodSuggestionsEnabled(), wl=foodSuggestionWeightLossEnabled();
  const toggle=document.getElementById("foodSuggestionsToggleBtn");
  toggle.textContent=on ? "Disable food suggestions" : "Enable food suggestions";
  toggle.setAttribute("aria-pressed",String(on));
  document.getElementById("foodSuggestionsSettings").classList.toggle("hidden",!on);
  const wlBtn=document.getElementById("foodSuggestionsWeightLossBtn");
  wlBtn.textContent="Weight-loss focus: "+(wl?"On":"Off");
  wlBtn.setAttribute("aria-pressed",String(wl));
  document.getElementById("foodSuggestionsAvoid").value=cfg.foodSuggestionsAvoid||"";
}
document.getElementById("foodSuggestionsRefreshBtn").addEventListener("click",()=>{ foodSuggestionPage++; renderFoodSuggestions(); });
document.getElementById("foodSuggestionsToggleBtn").addEventListener("click",()=>{
  cfg.foodSuggestionsOn=!foodSuggestionsEnabled();
  saveCfg(); foodSuggestionPage=0; renderFoodSuggestionSettings(); renderFoodSuggestions();
  flashSave(cfg.foodSuggestionsOn ? "Food suggestions enabled ✓" : "Food suggestions hidden");
});
document.getElementById("foodSuggestionsWeightLossBtn").addEventListener("click",()=>{
  cfg.foodSuggestionsWeightLoss=!foodSuggestionWeightLossEnabled();
  saveCfg(); foodSuggestionPage=0; renderFoodSuggestionSettings(); renderFoodSuggestions();
  flashSave("Weight-loss focus "+(cfg.foodSuggestionsWeightLoss?"on ✓":"off"));
});
document.getElementById("saveFoodSuggestionsBtn").addEventListener("click",()=>{
  cfg.foodSuggestionsAvoid=document.getElementById("foodSuggestionsAvoid").value.trim();
  saveCfg(); foodSuggestionPage=0; renderFoodSuggestions();
  ackBtn("saveFoodSuggestionsBtn","✓ Saved"); flashSave("Suggestion preferences saved ✓");
});

// --- OFF product mapping ---
function mapOFFProduct(p){
  if (!p || typeof p!=="object") return null;
  const nu = p.nutriments || {};
  const vals = [nu["energy-kcal_100g"], nu["proteins_100g"], nu["carbohydrates_100g"], nu["fat_100g"]].map(Number);
  const name = String(p.product_name || "").trim();
  if (!name || vals.some(v=>!Number.isFinite(v) || v<0)) return null;
  const serving = Number(p.serving_quantity);
  const servingOk = Number.isFinite(serving) && serving>0 && serving<=1000;
  let [cal100,pro100,carb100,fat100] = vals;

  // Some OFF records are tagged per 100g even though their entered macros
  // are label-serving values. Repair only when the independent calorie
  // fields strongly confirm that exact inconsistency.
  const nutritionBasis = String(p.nutrition_data_per || "").trim().toLowerCase();
  const calServing = Number(nu["energy-kcal_serving"]);
  const enteredMacros = [nu.proteins,nu.carbohydrates,nu.fat].map(Number);
  const macroCalories = (pro,carb,fat)=>pro*4+carb*4+fat*9;
  const relativeGap = (a,b)=>Math.abs(a-b)/Math.max(Math.abs(b),1);

  if (
    nutritionBasis==="100g" &&
    servingOk &&
    Math.abs(serving-100)>=20 &&
    Number.isFinite(calServing) && calServing>0 &&
    enteredMacros.every(v=>Number.isFinite(v) && v>=0) &&
    relativeGap(cal100*serving/100,calServing)<=0.1 &&
    relativeGap(macroCalories(pro100,carb100,fat100),cal100)>0.35 &&
    relativeGap(macroCalories(enteredMacros[0],enteredMacros[1],enteredMacros[2]),calServing)<=0.2
  ){
    pro100=enteredMacros[0]*100/serving;
    carb100=enteredMacros[1]*100/serving;
    fat100=enteredMacros[2]*100/serving;
  }

  return {
    name:name,
    brand:String(p.brands || "Generic").trim() || "Generic",
    cal100:cal100, pro100:pro100, carb100:carb100, fat100:fat100,
    servingG:servingOk ? serving : null,
    servingLabel:p.serving_size || p.quantity || null,
    barcode:
      p.code
        ? normalizeBarcodeIdentity(p.code)
        : null,
    sourceLabel:"Open Food Facts",
  };
}

// --- OFF search: Search-a-licious only; no retired legacy endpoint fallback ---
function fetchWithTimeout(url, ms){
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=>reject(new Error("timeout")), ms);
    fetch(url).then(r=>{ clearTimeout(t); resolve(r); }, e=>{ clearTimeout(t); reject(e); });
  });
}
async function searchOFF(q){
  const fields = "code,product_name,brands,nutriments,serving_size,serving_quantity,nutrition_data_per";
  const res = await fetchWithTimeout("https://search.openfoodfacts.org/search?q="+encodeURIComponent(q)+"&page_size=15&fields="+fields, 8000);
  if (!res.ok) throw new Error("Open Food Facts search unavailable");
  const json = await res.json();
  return (json.hits||[]).map(mapOFFProduct).filter(Boolean);
}

function foodSourceLabel(food){
  if (!food) return "";
  if (food.sourceLabel) return String(food.sourceLabel);
  if (String(food.brand||"").startsWith("Built-in")) return "Built-in";
  return "";
}

// --- search ---
const searchBtn = document.getElementById("searchBtn");
searchBtn.addEventListener("click", runSearch);
document.getElementById("foodQuery").addEventListener("keydown", e=>{ if(e.key==="Enter") runSearch(); });

async function runSearch(){
  const q = document.getElementById("foodQuery").value.trim();
  const errEl = document.getElementById("searchErr");
  errEl.classList.add("hidden");
  if(!q) return;
  searchBtn.disabled = true; searchBtn.textContent = "Searching…";
  const resultsEl = document.getElementById("results");
  resultsEl.innerHTML = "";

  const tokens = q.toLowerCase().split(/\s+/).filter(t=>t.length>2);
  const scoreName = (name)=>tokens.reduce((s,t)=>s+(name.toLowerCase().includes(t)?1:0),0);
  // personal foods first
  const myHits = Object.keys(data.myFoods||{}).map(code=>data.myFoods[code])
    .map(f=>({f:f, score:scoreName(f.name)})).filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score).slice(0,4)
    .map(x=>Object.assign({},x.f,{sourceLabel:"My Foods"}));
  const localHits = LOCAL_DB.map(f=>{
      return {f:f, score:scoreName(f.n)};
    })
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,4)
    .map(x=>({ name:x.f.n, brand:"Built-in · whole food", cal100:x.f.cal, pro100:x.f.pro, carb100:x.f.carb, fat100:x.f.fat, servingG:null, servingLabel:null, sourceLabel:"Built-in" }));

  if (isOffline()){
    renderResults([...myHits, ...localHits]);
    errEl.textContent = "Offline — showing saved and built-in foods; online databases were skipped.";
    errEl.classList.remove("hidden");
    searchBtn.disabled = false; searchBtn.textContent = "Search food database";
    return;
  }

  let offHits = [];
  try {
    offHits = await searchOFF(q);
  } catch(e) {
    errEl.textContent = localHits.length || myHits.length
      ? "Open Food Facts is temporarily unavailable — showing saved and built-in matches. You can also enter label values manually."
      : "Open Food Facts is temporarily unavailable. Check your connection or enter the package label manually.";
    errEl.classList.remove("hidden");
  }

  renderResults([...myHits, ...localHits, ...offHits]);
  searchBtn.disabled = false; searchBtn.textContent = "Search food database";
}


// ================== FOOD ENTRY MODE ISOLATION ==================

let activeFoodEntryMode = "idle";

function normalizedServingUnit(value){
  return ["serving","g","ml","oz","floz"].includes(value)
    ? value
    : "serving";
}

function servingMeasureKind(unit){
  if (["g","oz"].includes(unit)) return "solid";
  if (["ml","floz"].includes(unit)) return "volume";
  return "serving";
}

function servingUnitText(unit){
  if (unit==="floz") return "fl oz";
  if (unit==="ml") return "mL";
  return unit;
}

function servingValuesFromFood(food){
  const base =
    Number(food && food.servingG)>0
      ? Number(food.servingG)
      : 100;

  const fromStored = key=>{
    const value = Number(food && food[key]);
    return Number.isFinite(value)
      ? value
      : null;
  };

  const calculated = key=>
    scaleMacro(
      Number(food && food[key])||0,
      base
    );

  return {
    cal:
      fromStored("calServing")
      ?? calculated("cal100"),
    pro:
      fromStored("proServing")
      ?? calculated("pro100"),
    carb:
      fromStored("carbServing")
      ?? calculated("carb100"),
    fat:
      fromStored("fatServing")
      ?? calculated("fat100")
  };
}

function meaningfulSavedFoodBrand(food){
  const brand =
    String(
      food
      && (
        food.brandName
        || food.brand
      )
      || ""
    ).trim();

  if (!brand) return "";

  if (
    /^(?:generic|manual|my foods?|built-in)$/i
      .test(brand)
  ){
    return "";
  }

  return brand;
}

function savedFoodProductName(food){
  return String(
    food
    && (
      food.productName
      || food.name
    )
    || ""
  ).trim();
}

function prepareReusableFoodName(food){
  const prepared =
    Object.assign({},food);

  const brand =
    meaningfulSavedFoodBrand(prepared);

  const product =
    savedFoodProductName(prepared);

  if (!product){
    return prepared;
  }

  if (!brand){
    prepared.name=product;
    return prepared;
  }

  const display =
    brand+" — "+product;

  prepared.productName=product;
  prepared.brandName=brand;
  prepared.name=display;

  // Prevent existing display paths from appending brand twice.
  prepared.brand="";

  return prepared;
}

function migrateSavedMyFoodNames(){
  if (
    !data
    || !data.myFoods
    || typeof data.myFoods!=="object"
  ){
    return false;
  }

  let changed=false;

  Object.keys(data.myFoods)
    .forEach(key=>{
      const current =
        data.myFoods[key];

      if (
        !current
        || typeof current!=="object"
      ){
        return;
      }

      const prepared =
        prepareReusableFoodName(current);

      if (
        JSON.stringify(prepared)
        !==JSON.stringify(current)
      ){
        data.myFoods[key]=prepared;
        changed=true;
      }
    });

  if (changed){
    save();
  }

  return changed;
}

function buildServingFood(values){
  const source = values || {};

  const name =
    String(source.name||"").trim();

  const brand =
    String(source.brand||"").trim();

  const unit =
    normalizedServingUnit(
      String(source.servingUnit||"serving")
    );

  const amount =
    Number(source.servingAmount);

  const caloriesRaw =
    source.calories;

  const calories =
    Number(caloriesRaw);

  const protein =
    Number(source.protein||0);

  const carbs =
    Number(source.carbs||0);

  const fat =
    Number(source.fat||0);

  if (!name){
    return {
      ok:false,
      field:"name",
      message:"Enter the food name"
    };
  }

  if (
    caloriesRaw===""
    || caloriesRaw===null
    || caloriesRaw===undefined
    ||
    !Number.isFinite(calories)
    || calories<0
  ){
    return {
      ok:false,
      field:"calories",
      message:"Enter valid calories; 0 is allowed"
    };
  }

  if (
    ![protein,carbs,fat].every(value=>
      Number.isFinite(value)
      && value>=0
    )
  ){
    return {
      ok:false,
      field:"macros",
      message:"Calories and macros must be valid non-negative numbers"
    };
  }

  if (
    unit!=="serving"
    && (
      !Number.isFinite(amount)
      || amount<=0
    )
  ){
    return {
      ok:false,
      field:"servingAmount",
      message:"Enter the measured serving amount or choose Serving only"
    };
  }

  const base =
    unit==="serving"
      ? 100
      : toGrams(
          amount,
          unit,
          null
        );

  if (
    !Number.isFinite(base)
    || base<=0
  ){
    return {
      ok:false,
      field:"servingAmount",
      message:"The serving measurement could not be calculated"
    };
  }

  const label =
    String(source.servingLabel||"").trim()
    || (
      unit==="serving"
        ? "1 serving"
        : amount+" "+servingUnitText(unit)
    );

  const kind =
    servingMeasureKind(unit);

  return {
    ok:true,
    food:{
      name:name,
      brand:brand || "Manual",
      cal100:calories/base*100,
      pro100:protein/base*100,
      carb100:carbs/base*100,
      fat100:fat/base*100,
      servingG:base,
      servingLabel:label,
      nutritionBasis:"serving",
      calServing:calories,
      proServing:protein,
      carbServing:carbs,
      fatServing:fat,
      servingAmount:
        unit==="serving"
          ? null
          : amount,
      servingUnit:unit,
      measureKind:kind,
      servingOnly:unit==="serving",
      sourceLabel:
        String(source.sourceLabel||"Manual")
    }
  };
}

function foodListMacroText(food){
  if (
    food
    && food.nutritionBasis==="serving"
  ){
    const values =
      servingValuesFromFood(food);

    return (
      Math.round(values.cal)
      +" kcal · "
      +r1(values.pro)
      +"g P / "
      +r1(values.carb)
      +"g C / "
      +r1(values.fat)
      +"g F per serving"
    );
  }

  return (
    Math.round(Number(food && food.cal100)||0)
    +" kcal · "
    +r1(food && food.pro100)
    +"g P / "
    +r1(food && food.carb100)
    +"g C / "
    +r1(food && food.fat100)
    +"g F per 100g"
  );
}

// --- camera barcode scanning (lazy-loads scanner library on first use) ---
// A square scan box keeps both horizontal and 90-degree barcodes inside the decoded crop.
function barcodeScanBox(viewfinderWidth, viewfinderHeight){
  const minSide = Math.min(Number(viewfinderWidth)||0, Number(viewfinderHeight)||0);
  const side = Math.max(120, Math.min(380, Math.floor(minSide*0.9)));
  return {width:side, height:side};
}
let scanner = null, scannerLibLoading = null;
function loadScannerLib(){
  if (window.Html5Qrcode) return Promise.resolve();
  if (scannerLibLoading) return scannerLibLoading;
  scannerLibLoading = new Promise((resolve, reject)=>{
    const s = document.createElement("script");
    // v58: vendored locally (verified against the npm registry shasum for 2.3.8) —
    // no third-party code at runtime, and the scanner library works offline via the SW shell.
    s.src = "vendor/html5-qrcode.min.js";
    s.onload = resolve;
    s.onerror = ()=>reject(new Error("Scanner library failed to load"));
    document.head.appendChild(s);
  });
  return scannerLibLoading;
}
document.getElementById("scanBtn").addEventListener("click", async ()=>{
  const overlay = document.getElementById("scanOverlay");
  const scanErr = document.getElementById("scanErr");
  scanErr.classList.add("hidden");
  overlay.classList.remove("hidden");
  if (isOffline() && !window.Html5Qrcode){
    scanErr.textContent = "The barcode scanner needs a connection the first time it loads. Type the barcode instead, or reconnect and try again.";
    scanErr.classList.remove("hidden");
    return;
  }
  try {
    await loadScannerLib();
    const formats = [
      window.Html5QrcodeSupportedFormats.EAN_13, window.Html5QrcodeSupportedFormats.EAN_8,
      window.Html5QrcodeSupportedFormats.UPC_A, window.Html5QrcodeSupportedFormats.UPC_E,
    ];
    scanner = new window.Html5Qrcode("scanRegion", {
      formatsToSupport: formats,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });
    await scanner.start(
      { facingMode: "environment" },
      { fps: 20, qrbox: barcodeScanBox },
      async (decoded)=>{
        await stopScanner();
        document.getElementById("barcodeInput").value = decoded;
        runBarcode();
      },
      ()=>{} // per-frame misses are normal; ignore
    );
  } catch(e){
    scanErr.textContent = "Camera unavailable ("+(e.message||"permission denied")+"). Type the barcode number instead.";
    scanErr.classList.remove("hidden");
  }
});
async function stopScanner(){
  try { if (scanner){ await scanner.stop(); scanner.clear(); } } catch(e){}
  scanner = null;
  document.getElementById("scanOverlay").classList.add("hidden");
}
document.getElementById("scanCancelBtn").addEventListener("click", stopScanner);

// --- barcode ---
document.getElementById("barcodeBtn").addEventListener("click", runBarcode);
document.getElementById("barcodeInput").addEventListener("keydown", e=>{ if(e.key==="Enter") runBarcode(); });
async function lookupOFFBarcode(code, fields){
  const url = "https://world.openfoodfacts.org/api/v2/product/"+encodeURIComponent(code)+".json?fields="+fields;

  for (let attempt=0; attempt<2; attempt++){
    try {
      const res = await fetchWithTimeout(url, 10000);

      if (res.status===404) return {state:"not-found", product:null};

      if (!res.ok){
        const transient = res.status===408 || res.status===429 || res.status>=500;
        if (transient && attempt===0) continue;
        return {state:"unavailable", product:null};
      }

      const json = await res.json();
      return {state:"ok", product:json && json.product};
    } catch(e){
      if (attempt===0) continue;
    }
  }

  return {state:"unavailable", product:null};
}


function offNutritionNeedsManualReview(p){
  if (!p || typeof p!=="object") return false;
  const nu = p.nutriments || {};
  const cal100 = Number(nu["energy-kcal_100g"]);

  // Do not recalculate or silently replace database nutrition.
  // Only stop an unmistakably impossible value: even pure fat is about
  // 900 kcal per 100 g, so more than 1000 kcal per 100 g requires review.
  return Number.isFinite(cal100) && cal100>1000;
}

async function runBarcode(){
  const rawCode =
    document
      .getElementById("barcodeInput")
      .value
      .trim();

  const code =
    normalizeBarcodeIdentity(rawCode);
  const errEl = document.getElementById("searchErr");
  errEl.classList.add("hidden");
  document.getElementById("customCard").classList.add("hidden");
  if(!code) return;
  // personal library first
  if (data.myFoods && data.myFoods[code]){
    selectFood(Object.assign({},data.myFoods[code],{sourceLabel:"My Foods"}));
    return;
  }
  if (isOffline()){
    openCustomForm(code);
    errEl.textContent = "Offline — online barcode lookup was skipped. Add the label details manually, or reconnect and try again.";
    errEl.classList.remove("hidden");
    return;
  }

  const btn = document.getElementById("barcodeBtn");
  btn.disabled = true; btn.textContent = "…";

  try {
    // Open Food Facts API v2 product schema (includes nutriments used by mapOFFProduct)
    const fields = "code,product_name,brands,quantity,serving_size,serving_quantity,nutrition_data_per,nutriments";
    const result = await lookupOFFBarcode(code, fields);

    if (result.state==="unavailable"){
      openCustomForm(code);
      errEl.textContent = "Open Food Facts could not be reached. Enter the package label below, or check your connection and tap Look up again.";
      errEl.classList.remove("hidden");
    } else if (result.state==="not-found"){
      openCustomForm(code);
      errEl.textContent = "That barcode was not found in Open Food Facts. Enter the package label below and BlackPyre will remember it on this device.";
      errEl.classList.remove("hidden");
    } else {
      const product = result.product;

      if (offNutritionNeedsManualReview(product)){
        const serving = Number(product && product.serving_quantity);
        openCustomForm(code, {
          name:String((product && product.product_name) || "").trim(),
          brand:String((product && product.brands) || "").trim(),
          barcode:code,
          servingG:Number.isFinite(serving) && serving>0 && serving<=1000 ? serving : "",
          servingLabel:String((product && (product.serving_size || product.quantity)) || "").trim()
        }, true);
        errEl.textContent = "This product's database nutrition does not make sense. Enter the calories and macros from the package label below. BlackPyre will save your correction for this barcode.";
        errEl.classList.remove("hidden");
      } else {
        const h = mapOFFProduct(product);
        if (h) selectFood(h);
        else {
          openCustomForm(code);
          errEl.textContent = "This product does not include usable nutrition. Enter the values from the package label below.";
          errEl.classList.remove("hidden");
        }
      }
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Look up";
  }
}

// --- personal barcode library ---
const CUSTOM_FOOD_NOTE = "Copy these from the nutrition label. Next time you scan this barcode, your entry comes up instantly.";
let pendingBarcode = null;

function openCustomForm(code, prefill, reviewWarning){
  if (
    ["search","manual","cleared"]
      .includes(activeFoodEntryMode)
  ){
    return;
  }

  pendingBarcode = String(code || "").replace(/\D/g,"");
  const values = prefill || {};

  document.getElementById("cfName").value = values.name || "";
  document.getElementById("cfBrand").value = values.brand || "";
  document.getElementById("cfBarcode").value = values.barcode || pendingBarcode;
  document.getElementById("cfServingLabel").value = values.servingLabel || "";
  document.getElementById("cfServG").value = values.servingG || "";

  ["cfCal","cfPro","cfCarb","cfFat"].forEach(id=>{
    document.getElementById(id).value="";
  });

  document.getElementById("customNote").textContent = reviewWarning
    ? "The online nutrition values appear incorrect. Check the package label and enter the calories and macros yourself. All prefilled product details remain editable."
    : CUSTOM_FOOD_NOTE;

  document.getElementById("customCard").classList.remove("hidden");
  const cc = document.getElementById("customCard");
  if (cc.scrollIntoView) cc.scrollIntoView({behavior:"smooth", block:"center"});
}

document.getElementById("cfSaveBtn").addEventListener("click", ()=>{
  const name = document.getElementById("cfName").value.trim();
  const brand = document.getElementById("cfBrand").value.trim();
  const barcode = document.getElementById("cfBarcode").value.trim().replace(/\D/g,"");
  const servingLabel = document.getElementById("cfServingLabel").value.trim();
  const servG = Number(document.getElementById("cfServG").value);
  const calRaw = document.getElementById("cfCal").value;
  const cal = Number(calRaw);

  if(
    !name
    || !barcode
    || !Number.isFinite(servG)
    || servG<=0
    || calRaw===""
    || !Number.isFinite(cal)
    || cal<0
  ){
    flashSave("Need name, barcode, serving size, and valid calories; 0 is allowed", true);
    return;
  }

  const pro = Number(document.getElementById("cfPro").value||0);
  const carb = Number(document.getElementById("cfCarb").value||0);
  const fat = Number(document.getElementById("cfFat").value||0);

  const food = {
    name:name,
    brand:brand || "My foods",
    cal100:cal/servG*100,
    pro100:pro/servG*100,
    carb100:carb/servG*100,
    fat100:fat/servG*100,
    servingG:servG,
    servingLabel:servingLabel || servG+"g",
    barcode:barcode,
    sourceLabel:"My Foods",
  };

  if(!data.myFoods) data.myFoods = {};
  data.myFoods[barcode] = food;
  save();

  ["cfName","cfBrand","cfBarcode","cfServingLabel","cfServG","cfCal","cfPro","cfCarb","cfFat"].forEach(id=>{
    document.getElementById(id).value="";
  });

  document.getElementById("customNote").textContent = CUSTOM_FOOD_NOTE;
  document.getElementById("customCard").classList.add("hidden");
  pendingBarcode = null;
  selectFood(food);
  flashSave("Saved to your foods ✓");
});

function renderResults(hits){
  if (
    ["barcode","manual","cleared"]
      .includes(activeFoodEntryMode)
  ){
    return;
  }

  const resultsEl = document.getElementById("results");
  const card = document.getElementById("resultsCard");
  if (hits.length===0){
    resultsEl.innerHTML = '<div style="padding:16px; font-size:13px; color:var(--dim);">No matches. Try fewer words — brand + one keyword works best.</div>';
  } else {
    resultsEl.innerHTML = "";
    hits.forEach(h=>{
      const div = document.createElement("button");
      div.type = "button";
      div.className = "result";
      div.setAttribute("aria-label", "Select "+h.name+(h.brand ? " by "+h.brand : ""));
      const source = foodSourceLabel(h);
      div.innerHTML = '<div class="r-name">'+esc(h.name)+'</div>'
        +'<div class="r-brand">'+esc(h.brand)+(source?' · Source: '+esc(source):'')+'</div>'
        +'<div class="r-macros">'+esc(foodListMacroText(h))
        +(h.servingLabel?' · serving: '+esc(h.servingLabel):'')+'</div>';
      div.addEventListener("click", ()=>selectFood(h));
      resultsEl.appendChild(div);
    });
  }
  card.classList.remove("hidden");
  // v51: bring results into view next to the search field instead of leaving them below the fold
  try { card.scrollIntoView({behavior:"smooth", block:"nearest"}); } catch(e){}
}
function r1(x){ return Math.round(Number(x||0)*10)/10; }

// --- select + slider calc ---
const qtyAmountEl = document.getElementById("qtyAmount");
const qtySliderEl = document.getElementById("qtySlider");
const qtyUnitEl = document.getElementById("qtyUnit");

function sliderConfigFor(unit){
  if (unit==="g") return {max:500, step:5};
  if (unit==="oz") return {max:16, step:0.25};
  if (unit==="lb") return {max:3, step:0.05};
  if (unit==="ml") return {max:1000, step:10};
  if (unit==="floz") return {max:32, step:0.5};
  if (unit==="serving") return {max:5, step:0.25};
  return {max:500, step:5};
}

function revealFoodSliderEditor(){
  const card = document.getElementById("calcCard");
  if (!card || !card.scrollIntoView) return;

  const reveal = ()=>{
    try {
      card.scrollIntoView({behavior:"smooth",block:"center"});
    } catch(e){
      try { card.scrollIntoView(); } catch(ignore){}
    }
  };

  // WKWebView can finish layout after the tap handler completes. Reveal once
  // now and once after that layout cycle so Edit visibly moves to the slider.
  reveal();
  setTimeout(reveal,0);
}

function foodSelectionOptions(food){
  if (
    food
    && food.nutritionBasis==="serving"
  ){
    const options = [
      [
        "serving",
        "serving ("
          +(food.servingLabel||"1 serving")
          +")"
      ]
    ];

    if (food.measureKind==="solid"){
      options.push(
        ["g","grams"],
        ["oz","ounces"],
        ["lb","pounds"]
      );
    } else if (food.measureKind==="volume"){
      options.push(
        ["ml","ml"],
        ["floz","fl oz"]
      );
    }

    return options;
  }

  const options = [
    ["g","grams"],
    ["oz","ounces"],
    ["lb","pounds"],
    ["ml","ml"],
    ["floz","fl oz"]
  ];

  if (food && food.servingG){
    options.unshift([
      "serving",
      "serving ("
        +(food.servingLabel||food.servingG+"g")
        +")"
    ]);
  }

  return options;
}

function foodSelectionSummary(food){
  const source =
    foodSourceLabel(food);

  if (
    food
    && food.nutritionBasis==="serving"
  ){
    const values =
      servingValuesFromFood(food);

    return (
      "per serving: "
      +Math.round(values.cal)
      +" kcal · "
      +r1(values.pro)
      +"g P · "
      +r1(values.carb)
      +"g C · "
      +r1(values.fat)
      +"g F"
      +(food.servingLabel
        ? " · "+food.servingLabel
        : "")
      +(source
        ? " · Source: "+source
        : "")
    );
  }

  return (
    "per 100g: "
    +Math.round(food.cal100)
    +" kcal · "
    +r1(food.pro100)
    +"g P · "
    +r1(food.carb100)
    +"g C · "
    +r1(food.fat100)
    +"g F"
    +(source
      ? " · Source: "+source
      : "")
  );
}

function normalizeBarcodeIdentity(value){
  const digits =
    String(value||"")
      .replace(/\D/g,"");

  if (
    digits.length===13
    && digits.startsWith("0")
  ){
    return digits.slice(1);
  }

  return digits;
}

function setBarcodeCorrectionField(id,value){
  const field =
    document.getElementById(id);

  if (!field){
    return;
  }

  if (
    value===null
    || value===undefined
    || value===""
  ){
    field.value="";
    return;
  }

  const number =
    Number(value);

  field.value =
    Number.isFinite(number)
      ? String(number)
      : String(value);
}

function openBarcodeCorrection(food){
  if (!food){
    return;
  }

  const barcode =
    normalizeBarcodeIdentity(
      food.barcode
      || food.lookupBarcode
      || food.code
    );

  if (!barcode){
    return;
  }

  openCustomForm(barcode);

  const servingG =
    Number(food.servingG);

  const servingValues =
    servingValuesFromFood(food);

  setBarcodeCorrectionField(
    "cfName",
    food.productName
      || food.name
      || ""
  );

  setBarcodeCorrectionField(
    "cfBrand",
    food.brandName
      || food.brand
      || ""
  );

  setBarcodeCorrectionField(
    "cfBarcode",
    barcode
  );

  setBarcodeCorrectionField(
    "cfServG",
    Number.isFinite(servingG)
    && servingG>0
      ? servingG
      : ""
  );

  setBarcodeCorrectionField(
    "cfServingLabel",
    food.servingLabel
      || ""
  );

  setBarcodeCorrectionField(
    "cfCal",
    Math.round(
      Number(servingValues.cal)||0
    )
  );

  setBarcodeCorrectionField(
    "cfPro",
    r1(servingValues.pro)
  );

  setBarcodeCorrectionField(
    "cfCarb",
    r1(servingValues.carb)
  );

  setBarcodeCorrectionField(
    "cfFat",
    r1(servingValues.fat)
  );

  const card =
    document.getElementById("customCard");

  if (
    card
    && typeof card.scrollIntoView==="function"
  ){
    card.scrollIntoView({
      block:"start"
    });
  }
}

function syncBarcodeCorrectionReview(food){
  const calculator=document.getElementById("calcCard");
  if (!calculator) return;

  let panel=document.getElementById("barcodeCorrectionReview");
  if (!panel){
    panel=document.createElement("div");
    panel.id="barcodeCorrectionReview";
    panel.setAttribute("role","note");
    panel.setAttribute("aria-labelledby","barcodeCorrectionTitle");
    panel.setAttribute("aria-describedby","barcodeCorrectionMessage");
    panel.style.cssText="margin:12px 0 10px;padding:12px;border:2px solid var(--ember);border-radius:12px;background:rgba(var(--ember-rgb),.08);";

    const title=document.createElement("div");
    title.id="barcodeCorrectionTitle";
    title.className="barcode-review-title";
    title.textContent="VERIFY BARCODE NUTRITION";

    const status=document.createElement("div");
    status.id="barcodeCorrectionStatus";
    status.className="barcode-review-status";
    status.textContent="NOT YET VERIFIED";

    const servingLabel=document.createElement("div");
    servingLabel.className="barcode-review-label";
    servingLabel.textContent="SCANNED SERVING";

    const serving=document.createElement("div");
    serving.id="barcodeCorrectionServing";
    serving.className="barcode-review-serving";

    const nutrition=document.createElement("div");
    nutrition.id="barcodeCorrectionNutrition";
    nutrition.className="barcode-review-nutrition";

    const source=document.createElement("div");
    source.id="barcodeCorrectionSource";
    source.className="note";
    source.style.margin="0 0 12px";

    const message=document.createElement("div");
    message.id="barcodeCorrectionMessage";
    message.textContent="Compare these scanned values with the package label before logging.";
    message.style.cssText="font-size:13px;line-height:1.5;color:var(--text);";

    const confirmButton=document.createElement("button");
    confirmButton.id="barcodeConfirmBtn";
    confirmButton.type="button";
    confirmButton.textContent="NUTRITION MATCHES PACKAGE";
    confirmButton.className="btn barcode-confirm-action";
    confirmButton.style.cssText="width:100%;margin-top:10px;";
    confirmButton.setAttribute("aria-describedby","barcodeCorrectionMessage");

    const button=document.createElement("button");
    button.id="barcodeCorrectionBtn";
    button.type="button";
    button.textContent="NUTRITION NEEDS EDITING";
    button.className="btn barcode-correct-action";
    button.style.cssText="width:100%;margin-top:8px;";
    button.setAttribute("aria-describedby","barcodeCorrectionMessage");

    [title,status,servingLabel,serving,nutrition,source,message,confirmButton,button]
      .forEach(element=>panel.appendChild(element));
    const nutritionLine=document.getElementById("calcLine");
    if (nutritionLine && nutritionLine.parentNode===calculator) calculator.insertBefore(panel,nutritionLine);
    else calculator.appendChild(panel);
  }

  const barcode=normalizeBarcodeIdentity(food&&(food.barcode||food.lookupBarcode||food.code));
  const eligible=!!(food&&food.sourceLabel==="Open Food Facts"&&barcode);
  panel.classList.toggle("hidden",!eligible);

  const scannedValues=food ? servingValuesFromFood(food) : null;
  const serving=document.getElementById("barcodeCorrectionServing");
  const nutrition=document.getElementById("barcodeCorrectionNutrition");
  const source=document.getElementById("barcodeCorrectionSource");
  if (serving) serving.textContent=food
    ? String(food.servingLabel||(Number(food.servingG)>0?food.servingG+" G":"1 SERVING")).toUpperCase()
    : "";
  if (nutrition) nutrition.textContent=scannedValues
    ? Math.round(Number(scannedValues.cal)||0)+" KCAL · "+r1(scannedValues.pro)+"G PROTEIN · "+r1(scannedValues.carb)+"G CARBS · "+r1(scannedValues.fat)+"G FAT"
    : "";
  if (source) source.textContent=food ? "SOURCE: OPEN FOOD FACTS" : "";

  const confirmButton=document.getElementById("barcodeConfirmBtn");
  const button=document.getElementById("barcodeCorrectionBtn");
  if (!confirmButton||!button) return;
  confirmButton.onclick=eligible?()=>confirmBarcodeFood(food):null;
  button.onclick=eligible?()=>openBarcodeCorrection(food):null;
}

function rememberConfirmedBarcodeFood(food){
  if (
    !food
    || food.sourceLabel!=="Open Food Facts"
  ){
    return false;
  }

  const barcode =
    normalizeBarcodeIdentity(
      food.barcode
      || food.lookupBarcode
      || food.code
    );

  if (!barcode){
    return false;
  }

  if (
    !data.myFoods
    || typeof data.myFoods!=="object"
  ){
    data.myFoods={};
  }

  const hadPrevious =
    Object.prototype.hasOwnProperty.call(
      data.myFoods,
      barcode
    );

  const previous =
    data.myFoods[barcode];

  const saved =
    Object.assign(
      {},
      food,
      {
        barcode:barcode,
        sourceLabel:"My Foods"
      }
    );

  data.myFoods[barcode]=saved;

  if (save()===false){
    if (hadPrevious){
      data.myFoods[barcode]=previous;
    } else {
      delete data.myFoods[barcode];
    }

    return false;
  }

  return saved;
}

function confirmBarcodeFood(food){
  const saved =
    rememberConfirmedBarcodeFood(food);

  if (!saved){
    flashSave(
      "Could not save this barcode",
      true
    );
    return;
  }

  selected =
    Object.assign({},saved);

  selectFood(selected);

  flashSave(
    "Barcode saved to My Foods ✓"
  );
}

function selectFood(h){
  selected = h;

  document.getElementById("selName").textContent =
    h.name
    +(
      h.brand
      && h.brand!=="Generic"
      && !String(h.brand).startsWith("Built-in")
        ? " — "+h.brand
        : ""
    );

  document.getElementById("selPer100").textContent =
    foodSelectionSummary(h);

  qtyUnitEl.innerHTML="";

  const options =
    foodSelectionOptions(h);

  options.forEach(pair=>{
    const option =
      document.createElement("option");

    option.value=pair[0];
    option.textContent=pair[1];

    qtyUnitEl.appendChild(option);
  });

  if (
    h.nutritionBasis==="serving"
    || h.servingG
  ){
    qtyUnitEl.value="serving";
    qtyAmountEl.value=1;
  } else {
    qtyAmountEl.value=100;
  }

  syncSliderToUnit();

  document
    .getElementById("calcCard")
    .classList
    .remove("hidden");

  updateCalc();
  revealFoodSliderEditor();


  syncBarcodeCorrectionReview(h);
}

function syncSliderToUnit(){
  const c = sliderConfigFor(qtyUnitEl.value);
  qtySliderEl.max = c.max; qtySliderEl.step = c.step;
  qtySliderEl.value = Math.min(Number(qtyAmountEl.value)||0, c.max);
}
qtyUnitEl.addEventListener("change", ()=>{
  // sensible default when switching units
  const u = qtyUnitEl.value;
  qtyAmountEl.value = u==="g" ? 100 : u==="oz" ? 4 : u==="lb" ? 0.5 : u==="ml" ? 240 : u==="floz" ? 8 : 1;
  syncSliderToUnit(); updateCalc();
});
qtyAmountEl.addEventListener("input", ()=>{ qtySliderEl.value = Math.min(Number(qtyAmountEl.value)||0, Number(qtySliderEl.max)); updateCalc(); });
qtySliderEl.addEventListener("input", ()=>{ qtyAmountEl.value = qtySliderEl.value; updateCalc(); });

function currentGrams(){
  return toGrams(parseFloat(qtyAmountEl.value)||0, qtyUnitEl.value, selected ? selected.servingG : null);
}
function selectedNutritionForAmount(food,grams,amount,unit){
  const servingBased=!!(food&&food.nutritionBasis==="serving");

  if(servingBased&&unit==="serving"){
    const serving=servingValuesFromFood(food);
    return {
      cal:Math.round(serving.cal*amount),
      pro:r1(serving.pro*amount),
      carb:r1(serving.carb*amount),
      fat:r1(serving.fat*amount)
    };
  }

  return {
    cal:Math.round(scaleMacro(food.cal100,grams)),
    pro:servingBased
      ? r1(scaleMacro(food.pro100,grams))
      : Math.round(scaleMacro(food.pro100,grams)),
    carb:servingBased
      ? r1(scaleMacro(food.carb100,grams))
      : Math.round(scaleMacro(food.carb100,grams)),
    fat:servingBased
      ? r1(scaleMacro(food.fat100,grams))
      : Math.round(scaleMacro(food.fat100,grams))
  };
}

function updateCalc(){
  if(!selected) return;

  const nutrition=selectedNutritionForAmount(
    selected,
    currentGrams(),
    Number(qtyAmountEl.value),
    qtyUnitEl.value
  );

  document.getElementById("calcCal").textContent=nutrition.cal;
  document.getElementById("calcPro").textContent=nutrition.pro;
  document.getElementById("calcCarb").textContent=nutrition.carb;
  document.getElementById("calcFat").textContent=nutrition.fat;
}

function normalizedFoodIdentityPart(value){
  return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function sourceFoodKey(food){
  if (!food) return "";
  const barcode = String(food.barcode||food.code||"").replace(/\D/g,"");
  if (barcode) return "barcode:"+barcode;
  if (food.suggestionNdb) return "usda:"+String(food.suggestionNdb);
  const name = normalizedFoodIdentityPart(food.name);
  if (!name) return "";
  return "food:"+name+"|"+normalizedFoodIdentityPart(food.brand);
}
function compactSourceFood(food){
  if (!food || !food.name) return null;
  const out = {
    name:String(food.name), brand:String(food.brand||""),
    cal100:Number(food.cal100)||0, pro100:Number(food.pro100)||0,
    carb100:Number(food.carb100)||0, fat100:Number(food.fat100)||0
  };
  if (Number(food.servingG)>0) out.servingG = Number(food.servingG);
  if (food.servingLabel) out.servingLabel = String(food.servingLabel);
  if (food.nutritionBasis) out.nutritionBasis = String(food.nutritionBasis);
  if (Number.isFinite(Number(food.calServing))) out.calServing = Number(food.calServing);
  if (Number.isFinite(Number(food.proServing))) out.proServing = Number(food.proServing);
  if (Number.isFinite(Number(food.carbServing))) out.carbServing = Number(food.carbServing);
  if (Number.isFinite(Number(food.fatServing))) out.fatServing = Number(food.fatServing);
  if (Number(food.servingAmount)>0) out.servingAmount = Number(food.servingAmount);
  if (food.servingUnit) out.servingUnit = String(food.servingUnit);
  if (food.measureKind) out.measureKind = String(food.measureKind);
  if (food.servingOnly===true) out.servingOnly = true;
  if (food.barcode||food.code) out.barcode = String(food.barcode||food.code);
  if (food.suggestionNdb) out.suggestionNdb = String(food.suggestionNdb);
  if (food.suggestionUsdaDescription) out.suggestionUsdaDescription = String(food.suggestionUsdaDescription);
  if (food.sourceLabel) out.sourceLabel = String(food.sourceLabel);
  return out;
}
function sliderEntryFromSelection(){
  if (!selected) return null;
  const g = currentGrams();
  const amount = Number(qtyAmountEl.value);
  const unit = qtyUnitEl.value;
  if (!Number.isFinite(amount) || amount<=0 || !Number.isFinite(g) || g<=0) return null;
  const amountLabel = String(qtyAmountEl.value);
  const label = unit==="serving"
    ? amountLabel+" serving"+(amount===1?"":"s")+" · "+selected.name
    : amountLabel+unit+" "+selected.name;
  const sourceFood = compactSourceFood(selected);
  const nutrition = selectedNutritionForAmount(
    selected,
    g,
    amount,
    unit
  );

  return {
    name:label,
    cal:nutrition.cal,
    pro:nutrition.pro,
    carb:nutrition.carb,
    fat:nutrition.fat,
    amount:amount,
    unit:unit,
    grams:g,
    foodKey:sourceFoodKey(selected),
    sourceFood:sourceFood
  };
}
function updateRecentPortion(item, amount, unit){
  if (!item) return;
  const list = data.recents||[];
  const idx = list.findIndex(r=>r.name===item.name && (r.brand||"")===(item.brand||""));
  const recent = Object.assign({}, idx>=0 ? list[idx] : item, item, {lastAmt:amount,lastUnit:unit});
  if (idx>=0) list.splice(idx,1);
  list.unshift(recent);
  data.recents = list.slice(0,20);
}

const FOOD_ADD_CONFIRMATION_MS=30000;
let foodAddConfirmationRef=null;
let foodAddConfirmationTimer=null;

function ensureFoodAddConfirmation(){
  let panel =
    document.getElementById(
      "foodAddConfirmationPanel"
    );

  if (panel){
    return panel;
  }

  panel =
    document.createElement("div");

  panel.id =
    "foodAddConfirmationPanel";

  panel.className =
    "hidden";

  panel.setAttribute(
    "role",
    "status"
  );

  panel.setAttribute(
    "aria-live",
    "polite"
  );

  panel.style.cssText =
    "margin:0 0 12px;"
    +"padding:12px;"
    +"border:1px solid var(--ok);"
    +"border-radius:12px;"
    +"background:var(--panel);";

  const message =
    document.createElement("div");

  message.id =
    "foodAddConfirmationMessage";

  message.style.cssText =
    "margin-bottom:9px;";

  const actions =
    document.createElement("div");

  actions.style.cssText =
    "display:flex;"
    +"gap:8px;";

  const undo =
    document.createElement("button");

  undo.id =
    "foodAddUndoBtn";

  undo.type =
    "button";

  undo.className =
    "btn ghost small";

  undo.textContent =
    "UNDO";

  undo.style.flex =
    "1";

  const view =
    document.createElement("button");

  view.id =
    "foodAddViewBtn";

  view.type =
    "button";

  view.className =
    "btn ghost small";

  view.textContent =
    "VIEW ENTRY";

  view.style.flex =
    "1";

  actions.appendChild(undo);
  actions.appendChild(view);

  panel.appendChild(message);
  panel.appendChild(actions);

  const calculator =
    document.getElementById("calcCard");

  if (
    calculator
    && calculator.parentNode
  ){
    calculator.parentNode.insertBefore(
      panel,
      calculator.nextSibling
    );
  }

  return panel;
}

function hideFoodAddedConfirmation(){
  clearTimeout(foodAddConfirmationTimer);
  foodAddConfirmationTimer=null;
  foodAddConfirmationRef=null;

  const panel =
    document.getElementById(
      "foodAddConfirmationPanel"
    );

  if (panel){
    panel.classList.add("hidden");
  }

  const undo =
    document.getElementById(
      "foodAddUndoBtn"
    );

  const view =
    document.getElementById(
      "foodAddViewBtn"
    );

  if (undo){
    undo.onclick=null;
  }

  if (view){
    view.onclick=null;
  }
}

function showFoodAddedConfirmation(
  dateStr,
  entry
){
  const panel =
    ensureFoodAddConfirmation();

  if (!panel){
    return;
  }

  const ref = {
    date:dateStr,
    entry:entry
  };

  foodAddConfirmationRef=ref;

  const message =
    document.getElementById(
      "foodAddConfirmationMessage"
    );

  if (message){
    message.textContent =
      dateStr===todayStr()
        ? "✓ ADDED TO TODAY’S LOG"
        : "✓ ADDED TO "+fmtDate(dateStr).toUpperCase();
  }

  const undo =
    document.getElementById(
      "foodAddUndoBtn"
    );

  const view =
    document.getElementById(
      "foodAddViewBtn"
    );

  if (undo){
    undo.onclick=()=>{
      if (
        !foodAddConfirmationRef
        || foodAddConfirmationRef!==ref
      ){
        return;
      }

      const list =
        data.food[dateStr] || [];

      const index =
        list.indexOf(entry);

      if (index<0){
        hideFoodAddedConfirmation();
        return;
      }

      const removed =
        list.splice(index,1)[0];

      if (save()===false){
        list.splice(
          Math.min(index,list.length),
          0,
          removed
        );

        if (
          foodDateEl.value===dateStr
        ){
          renderFood();
        }

        renderDash();

        flashSave(
          "Could not undo that food entry",
          true
        );

        return;
      }

      if (
        foodDateEl.value===dateStr
      ){
        renderFood();
      }

      renderDash();
      renderBackup();

      hideFoodAddedConfirmation();

      flashSave(
        "Food entry removed"
      );
    };
  }

  if (view){
    view.onclick=()=>{
      const list =
        data.food[dateStr] || [];

      const index =
        list.indexOf(entry);

      if (index<0){
        hideFoodAddedConfirmation();
        return;
      }

      if (
        foodDateEl.value!==dateStr
      ){
        foodDateEl.value=dateStr;
        renderFood();
      }

      const editButton =
        document.querySelector(
          '#foodList .edt[data-i="'
          +index
          +'"]'
        );

      const row =
        editButton
        && editButton.closest
          ? editButton.closest(
              ".list-item"
            )
          : null;

      if (
        row
        && row.scrollIntoView
      ){
        row.scrollIntoView({
          behavior:"smooth",
          block:"center"
        });
      }
    };
  }

  panel.classList.remove("hidden");
  clearTimeout(foodAddConfirmationTimer);
  foodAddConfirmationTimer=setTimeout(
    hideFoodAddedConfirmation,
    FOOD_ADD_CONFIRMATION_MS
  );
}

document.getElementById("addSelBtn").addEventListener("click", ()=>{
  if(!selected) return;

  const entry =
    sliderEntryFromSelection();

  if (!entry){
    flashSave(
      "Enter an amount greater than 0",
      true
    );
    return;
  }

  const amt =
    qtyAmountEl.value;

  const unit =
    qtyUnitEl.value;

  const logDate =
    foodDateEl.value;

  const addButton =
    document.getElementById(
      "addSelBtn"
    );

  // On iOS the tapped button retains focus. Hiding its parent while it is
  // still focused can cause WKWebView to reposition the page. Release that
  // focus before resetting the completed entry.
  if (
    document.activeElement===addButton
    && addButton
    && typeof addButton.blur==="function"
  ){
    try {
      addButton.blur();
    } catch(e){}
  }

  let added=false;

  if (
    editFoodIdx!=null
    && editFoodMode==="slider"
    && (
      data.food[foodDateEl.value]
      || []
    )[editFoodIdx]
  ){
    entry.meal =
      data.food[
        foodDateEl.value
      ][editFoodIdx].meal
      || currentMeal;

    data.food[
      foodDateEl.value
    ][editFoodIdx] =
      entry;

    updateRecentPortion(
      selected,
      amt,
      unit
    );

    save();
    renderFood();
    renderDash();

    ackBtn(
      "addSelBtn",
      "✓ Updated"
    );

    hideFoodAddedConfirmation();
    cancelEditFood();
  } else {
    added =
      addEntry(entry)!==false;

    if (added){
      pushRecent(
        Object.assign(
          {},
          selected,
          {
            lastAmt:amt,
            lastUnit:unit
          }
        )
      );
    }
  }

  document
    .getElementById("calcCard")
    .classList
    .add("hidden");

  document
    .getElementById("resultsCard")
    .classList
    .add("hidden");

  document
    .getElementById("foodQuery")
    .value="";

  document
    .getElementById("barcodeInput")
    .value="";

  selected=null;

  if (added){
    showFoodAddedConfirmation(
      logDate,
      entry
    );
  }

  // Deliberately do not scroll or focus another field here.
  // The user stays where they were and chooses whether to continue
  // entering food or explicitly View entry.
});

// --- recents ---
function pushRecent(item, meal){
  if(!data.foodCounts) data.foodCounts = {};
  if(!data.mealCounts) data.mealCounts = {};
  const m = meal || currentMeal;
  const key = item.name+"|"+(item.brand||"");
  data.foodCounts[key] = (data.foodCounts[key]||0)+1;
  if(!data.mealCounts[m]) data.mealCounts[m] = {};
  data.mealCounts[m][key] = (data.mealCounts[m][key]||0)+1;
  data.recents = (data.recents||[]).filter(r=>r.name!==item.name || r.brand!==item.brand);
  data.recents.unshift(item);
  data.recents = data.recents.slice(0,20);
  save(); renderRecents();
}
function renderRecents(){
  const btn = document.getElementById("recentsOpenBtn");
  const el = document.getElementById("recentsList");
  const counts = data.foodCounts||{};
  let list = (data.recents||[])
    .slice()
    .sort((a,b)=>(counts[b.name+"|"+(b.brand||"")]||0)-(counts[a.name+"|"+(a.brand||"")]||0))
    .slice(0,30);
  if (typeof recentsFilter!=="undefined" && recentsFilter){
    list = list.filter(r=>r.name.toLowerCase().includes(recentsFilter));
  }
  if(!list.length){ btn.classList.add("hidden"); return; }
  btn.classList.remove("hidden");
  el.innerHTML = "";
  list.forEach(r=>{
    const n = counts[r.name+"|"+(r.brand||"")]||1;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "result";
    row.setAttribute("aria-label", "Select recent food "+r.name);
    row.innerHTML = '<div class="r-name">'+esc(r.name)+'</div>'
      +'<div class="r-macros">'+esc(foodListMacroText(r))
      +(r.lastAmt?' · last: '+esc(r.lastAmt)+' '+esc(r.lastUnit||''):'')
      +' · logged '+n+'×</div>';
    row.addEventListener("click", ()=>{
      document.getElementById("recentsOverlay").classList.add("hidden");
      unlockScroll();
      selectFood(r);
      if(r.lastAmt){ qtyUnitEl.value = r.lastUnit || qtyUnitEl.value; syncSliderToUnit(); qtyAmountEl.value = r.lastAmt; qtySliderEl.value = Math.min(Number(r.lastAmt)||0, Number(qtySliderEl.max)); updateCalc(); }
    });
    el.appendChild(row);
  });
}

// --- manual + entries ---
let editFoodIdx = null;
let editFoodMode = null;
function cancelEditFood(){
  editFoodIdx = null;
  editFoodMode = null;

  document.getElementById("addManualBtn").textContent =
    "Update entry";

  document
    .getElementById("addManualBtn")
    .classList
    .add("hidden");

  document
    .getElementById("manualUseBtn")
    .classList
    .remove("hidden");

  document
    .getElementById("manualSaveChooseBtn")
    .classList
    .remove("hidden");

  document
    .getElementById("cancelEditFoodBtn")
    .classList
    .add("hidden");

  document.getElementById("addSelBtn").textContent =
    "Add to log";

  document
    .getElementById("cancelSelEditBtn")
    .classList
    .add("hidden");
}
function sourceFoodFromEntry(entry){
  const source = entry && entry.sourceFood;
  if (!source || !source.name || !(Number(source.cal100)>0)) return null;
  return Object.assign({},source);
}
function parseLoggedPortionName(name){
  const value = String(name||"").trim();
  let match = value.match(/^(\d+(?:\.\d+)?)\s+servings?\s*[·•-]\s*(.+)$/i);
  if (match) return {amount:Number(match[1]),unit:"serving",baseName:match[2].trim()};
  match = value.match(/^(\d+(?:\.\d+)?)\s*(g|oz|lb|ml|floz)\s+(.+)$/i);
  if (match) return {amount:Number(match[1]),unit:match[2].toLowerCase(),baseName:match[3].trim()};
  return null;
}
function legacySliderEditSource(entry){
  const parsed = parseLoggedPortionName(entry&&entry.name);
  if (!parsed || !(parsed.amount>0)) return null;
  const wantedName = normalizedFoodIdentityPart(parsed.baseName);
  if (!wantedName) return null;
  const candidates = [];
  (data.recents||[]).forEach(food=>{
    if (normalizedFoodIdentityPart(food&&food.name)===wantedName) candidates.push(food);
  });
  Object.keys(data.myFoods||{}).forEach(key=>{
    const food = data.myFoods[key];
    if (normalizedFoodIdentityPart(food&&food.name)===wantedName) candidates.push(food);
  });
  const usable = candidates.filter(food=>{
    if (!food || !(Number(food.cal100)>0)) return false;
    if (parsed.unit==="serving" && !(Number(food.servingG)>0)) return false;
    return toGrams(parsed.amount,parsed.unit,food.servingG)>0;
  });
  if (!usable.length) return null;
  usable.sort((a,b)=>{
    const score = food=>{
      const grams = toGrams(parsed.amount,parsed.unit,food.servingG);
      return Math.abs(Math.round(scaleMacro(food.cal100,grams))-Number(entry.cal||0))
        + Math.abs(Math.round(scaleMacro(food.pro100,grams))-Number(entry.pro||0))*2
        + Math.abs(Math.round(scaleMacro(food.carb100,grams))-Number(entry.carb||0))
        + Math.abs(Math.round(scaleMacro(food.fat100,grams))-Number(entry.fat||0))*2;
    };
    return score(a)-score(b);
  });
  return {source:Object.assign({},usable[0]),amount:parsed.amount,unit:parsed.unit};
}
function sliderEditDetails(entry){
  const source = sourceFoodFromEntry(entry);
  if (source){
    return {
      source:source,
      amount:Number(entry.amount)>0 ? Number(entry.amount) : null,
      unit:String(entry.unit||"")
    };
  }
  return legacySliderEditSource(entry);
}
function clearManualFoodInputs(){
  [
    "mName",
    "mBrand",
    "mServingLabel",
    "mServingAmount",
    "mCal",
    "mPro",
    "mCarb",
    "mFat"
  ].forEach(id=>{
    document.getElementById(id).value="";
  });

  document.getElementById("mServingUnit").value =
    "serving";

}
function startEditEntry(i){
  const f = (data.food[foodDateEl.value]||[])[i];
  if(!f) return;
  const sliderDetails = sliderEditDetails(f);
  cancelEditFood();
  clearManualFoodInputs();
  if (f.meal){ currentMeal = f.meal; renderMealSeg(); renderFood(); }
  if (sliderDetails && sliderDetails.source){
    editFoodIdx = i;
    editFoodMode = "slider";
    selectFood(sliderDetails.source);
    const unit = String(sliderDetails.unit||"");
    if ([...qtyUnitEl.options].some(o=>o.value===unit)) qtyUnitEl.value = unit;
    qtyAmountEl.value = Number(sliderDetails.amount)>0
      ? sliderDetails.amount
      : (unit==="g" && Number(f.grams)>0 ? f.grams : qtyAmountEl.value);
    syncSliderToUnit(); updateCalc();
    document.getElementById("addSelBtn").textContent = "Update entry";
    document.getElementById("cancelSelEditBtn").classList.remove("hidden");
    revealFoodSliderEditor();
    return;
  }
  document.getElementById("mName").value = f.name;
  document.getElementById("mBrand").value = "";
  document.getElementById("mServingLabel").value = "";
  document.getElementById("mServingAmount").value = "";
  document.getElementById("mServingUnit").value = "serving";
  document.getElementById("mCal").value = f.cal;
  document.getElementById("mPro").value = f.pro||"";
  document.getElementById("mCarb").value = f.carb||"";
  document.getElementById("mFat").value = f.fat||"";

  editFoodIdx = i;
  editFoodMode = "manual";

  const btn =
    document.getElementById("addManualBtn");

  btn.textContent = "Update entry";
  btn.classList.remove("hidden");

  document
    .getElementById("manualUseBtn")
    .classList
    .add("hidden");

  document
    .getElementById("manualSaveChooseBtn")
    .classList
    .add("hidden");

  document
    .getElementById("cancelEditFoodBtn")
    .classList
    .remove("hidden");

  if (btn.scrollIntoView){
    btn.scrollIntoView({
      behavior:"smooth",
      block:"center"
    });
  }
}
document.getElementById("cancelEditFoodBtn").addEventListener("click", ()=>{
  clearManualFoodInputs();
  cancelEditFood();
});
document.getElementById("cancelSelEditBtn").addEventListener("click", ()=>{
  cancelEditFood();
  document.getElementById("calcCard").classList.add("hidden");
  selected = null;
});
document.getElementById("addManualBtn").addEventListener("click", ()=>{
  const nameInput = document.getElementById("mName");
  const calInput = document.getElementById("mCal");
  const n = nameInput.value.trim();
  const calRaw = calInput.value;
  const c = Number(calInput.value);
  if(!n){
    flashSave("Enter a food name before adding this entry", true);
    nameInput.focus();
    if (nameInput.scrollIntoView) nameInput.scrollIntoView({behavior:"smooth", block:"center"});
    return;
  }
  if(calRaw==="" || !Number.isFinite(c) || c<0){
    flashSave("Enter valid calories before adding this entry; 0 is allowed", true);
    calInput.focus();
    if (calInput.scrollIntoView) calInput.scrollIntoView({behavior:"smooth", block:"center"});
    return;
  }
  const entry = {
    name:n, cal:c,
    pro:Number(document.getElementById("mPro").value||0),
    carb:Number(document.getElementById("mCarb").value||0),
    fat:Number(document.getElementById("mFat").value||0),
  };
  if (editFoodIdx!=null && editFoodMode==="manual" && (data.food[foodDateEl.value]||[])[editFoodIdx]){
    entry.meal = data.food[foodDateEl.value][editFoodIdx].meal || currentMeal;
    data.food[foodDateEl.value][editFoodIdx] = entry;
    save(); renderFood(); renderDash();
    ackBtn("addManualBtn", "✓ Updated");
    cancelEditFood();
  } else {
    addEntry(entry);
    ackBtn("addManualBtn", "✓ Added");
  }
  clearManualFoodInputs();
});

function manualServingFoodFromInputs(){
  const result =
    buildServingFood({
      name:
        document
          .getElementById("mName")
          .value,
      brand:
        document
          .getElementById("mBrand")
          .value,
      servingLabel:
        document
          .getElementById("mServingLabel")
          .value,
      servingAmount:
        document
          .getElementById("mServingAmount")
          .value,
      servingUnit:
        document
          .getElementById("mServingUnit")
          .value,
      calories:
        document
          .getElementById("mCal")
          .value,
      protein:
        document
          .getElementById("mPro")
          .value,
      carbs:
        document
          .getElementById("mCarb")
          .value,
      fat:
        document
          .getElementById("mFat")
          .value,
      sourceLabel:"Manual"
    });

  if (!result.ok){
    const fieldMap = {
      name:"mName",
      calories:"mCal",
      servingAmount:"mServingAmount",
      macros:"mPro"
    };

    const id =
      fieldMap[result.field];

    flashSave(
      result.message,
      true
    );

    if (id){
      const input =
        document.getElementById(id);

      input.focus();

      if (input.scrollIntoView){
        input.scrollIntoView({
          behavior:"smooth",
          block:"center"
        });
      }
    }

    return null;
  }

  return result.food;
}

function openManualFoodAmountSlider(saveReusable){
  let food =
    manualServingFoodFromInputs();

  if (!food) return false;

  if (saveReusable){
    if (!data.myFoods){
      data.myFoods={};
    }

    const key =
      "manual_"
      +Date.now()
      +"_"
      +Math.random()
        .toString(36)
        .slice(2,8);

    food.sourceLabel="My Foods";

    food.brand =
      document
        .getElementById("mBrand")
        .value
        .trim()
      || "My foods";

    food =
      prepareReusableFoodName(food);

    data.myFoods[key]=food;

    const saved =
      save();

    if (saved===false){
      delete data.myFoods[key];
      return false;
    }
  }

  clearManualFoodInputs();
  cancelEditFood();
  selectFood(food);

  flashSave(
    saveReusable
      ? "Saved — choose how much you had"
      : "Food ready — choose how much you had"
  );

  return true;
}

document
  .getElementById("manualUseBtn")
  .addEventListener("click",()=>{
    openManualFoodAmountSlider(false);
  });

document
  .getElementById("manualSaveChooseBtn")
  .addEventListener("click",()=>{
    openManualFoodAmountSlider(true);
  });

function bumpLog(){
  if(!data.meta) data.meta = {lastBackup:null, logsSince:0};
  if(!data.meta.firstMeaningfulLogAt) data.meta.firstMeaningfulLogAt = new Date().toISOString();
  data.meta.logsSince = (data.meta.logsSince||0)+1;
}
let _lastAddSig = "", _lastAddT = 0;
function addEntry(entry, options){
  const d = foodDateEl.value;
  const opts = options || {};
  if(!entry.meal) entry.meal = currentMeal;
  // Repeated taps or delayed responses must not log an ordinary Add action
  // twice. Explicit duplicate controls and reviewed multi-item batches may
  // intentionally contain identical entries and opt out of this one guard.
  const sig = d+"|"+(entry.name||"")+"|"+entry.cal+"|"+entry.meal;
  const now = Date.now();
  if (!opts.allowDuplicate && sig===_lastAddSig && (now-_lastAddT)<900){
    flashSave("Already added — not logging it twice", true);
    return false;
  }
  if (!opts.allowDuplicate){
    _lastAddSig = sig;
    _lastAddT = now;
  }
  if(!data.food[d]) data.food[d]=[];
  data.food[d].push(entry);
  bumpLog();
  save(); renderFood(); renderDash(); renderBackup();
  foodKudos(entry);
  return true;
}
function removeEntry(i){
  const d = foodDateEl.value;
  const entry = data.food[d] && data.food[d][i];
  if (!entry) return;
  data.food[d].splice(i,1);
  cancelEditFood();
  if (!save()){
    data.food[d].splice(Math.min(i,data.food[d].length),0,entry);
    renderFood(); renderDash();
    return;
  }
  renderFood(); renderDash();
  offerUndo('Deleted "'+entry.name+'"', ()=>{
    if(!data.food[d]) data.food[d] = [];
    data.food[d].splice(Math.min(i,data.food[d].length),0,entry);
    save(); renderFood(); renderDash();
    flashSave("Restored ✓");
  });
}

function renderFood(){
  const d = foodDateEl.value;
  const s = daySums(d);
  document.getElementById("totalsLabel").textContent = "Totals · "+fmtDate(d);
  document.getElementById("foodBars").innerHTML = allBarsHTML(s, d);
  const list = data.food[d]||[];
  const el = document.getElementById("foodList");
  if(list.length===0){
    el.innerHTML = '<div style="padding:18px; font-size:13px; color:var(--dim);">Nothing logged for this date yet.</div>';
  } else {
    const groups = [currentMeal, "other"];
    let html = "";
    groups.forEach(g=>{
      const idxs = [];
      list.forEach((f,i)=>{ if((f.meal||"other")===g) idxs.push(i); });
      if(!idxs.length) return;
      const gc = idxs.reduce((s,i)=>s+Number(list[i].cal||0),0);
      const gp = idxs.reduce((s,i)=>s+Number(list[i].pro||0),0);
      html += '<div class="mealhead"><span class="mh-name">'+MEAL_LABEL[g]+'</span>'
        +'<span class="mh-tot">'+Math.round(gc)+' kcal · '+Math.round(gp)+'g P</span></div>';
      idxs.forEach(i=>{
        const f = list[i];
        html += '<div class="list-item">'
          +'<div style="flex:1; min-width:0;"><div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">'+esc(f.name)+'</div>'
          +'<div style="color:var(--dim); font-size:11px;">'+Math.round(f.cal)+' kcal · '+Math.round(f.pro)+'P / '+Math.round(f.carb||0)+'C / '+Math.round(f.fat||0)+'F</div></div>'
          +'<button class="del edt" data-i="'+i+'" aria-label="Edit" style="color:var(--dim);">✎</button>'
          +'<button class="del dup" data-i="'+i+'" aria-label="Duplicate" style="color:var(--dim);">⧉</button>'
          +'<button class="del" data-i="'+i+'" aria-label="Remove">✕</button></div>';
      });
    });
    el.innerHTML = html;
    el.querySelectorAll(".del:not(.dup):not(.edt)").forEach(b=>b.addEventListener("click",()=>removeEntry(Number(b.dataset.i))));
    el.querySelectorAll(".edt").forEach(b=>b.addEventListener("click",()=>startEditEntry(Number(b.dataset.i))));
    el.querySelectorAll(".dup").forEach(b=>b.addEventListener("click",()=>{
      const f = list[Number(b.dataset.i)];
      addEntry(
        Object.assign({}, f),
        {allowDuplicate:true}
      ); // explicit duplicate action keeps the original meal
    }));
  }
  renderRecents();
  renderUsual();
  renderFoodSuggestions();
}

// ================== BLACKPYRE FOOD ENTRY CLEAR CONTROLS ==================

function foodElementDescriptor(element){
  if (!element) return "";

  return [
    element.id,
    element.name,
    element.placeholder,
    element.getAttribute("aria-label")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function foodSearchInputElement(){
  const preferred = [
    "foodSearch",
    "foodSearchInput",
    "searchFood",
    "foodQuery",
    "searchInput"
  ];

  for (const id of preferred){
    const element =
      document.getElementById(id);

    if (element) return element;
  }

  return [
    ...document.querySelectorAll("input")
  ].find(element=>{
    const descriptor =
      foodElementDescriptor(element);

    return (
      descriptor.includes("search")
      && descriptor.includes("food")
      && !descriptor.includes("barcode")
    );
  }) || null;
}

function barcodeInputElement(){
  const button =
    document.getElementById("barcodeBtn");

  const row =
    button
    && button.closest(".row");

  const rowInput =
    row
    && row.querySelector("input");

  if (rowInput) return rowInput;

  return [
    ...document.querySelectorAll("input")
  ].find(element=>
    /\b(?:barcode|upc)\b/i.test(
      foodElementDescriptor(element)
    )
  ) || null;
}

function foodSearchResultsElement(){
  for (const id of [
    "foodResults",
    "results",
    "searchResults"
  ]){
    const element =
      document.getElementById(id);

    if (element) return element;
  }

  return [
    ...document.querySelectorAll("[id]")
  ].find(element=>
    /food.*result|result.*food/i.test(
      element.id
    )
  ) || null;
}

function hideFoodElement(id){
  const element =
    document.getElementById(id);

  if (element){
    element.classList.add("hidden");
  }
}

function clearFoodElementText(id){
  const element =
    document.getElementById(id);

  if (!element) return;

  element.textContent="";
  element.classList.add("hidden");
}

function resetFoodSelectionState(){
  selected=null;

  hideFoodElement("calcCard");
  hideFoodElement("cancelSelEditBtn");

  const addButton =
    document.getElementById("addSelBtn");

  if (addButton){
    addButton.textContent="Add to log";
  }
}

function clearFoodSearchState(
  preserveMode
){
  const input =
    foodSearchInputElement();

  if (input){
    input.value="";
  }

  const results =
    foodSearchResultsElement();

  if (results){
    results.innerHTML="";
    results.classList.add("hidden");
  }

  clearFoodElementText("searchErr");

  if (!preserveMode){
    activeFoodEntryMode="cleared";
  }
}

function clearBarcodeState(
  preserveMode
){
  const input =
    barcodeInputElement();

  if (input){
    input.value="";
  }

  try {
    pendingBarcode=null;
  } catch(error){}

  const customCard =
    document.getElementById("customCard");

  if (customCard){
    customCard.classList.add("hidden");
  }

  [
    "cfName",
    "cfBrand",
    "cfBarcode",
    "cfServingLabel",
    "cfServG",
    "cfCal",
    "cfPro",
    "cfCarb",
    "cfFat"
  ].forEach(id=>{
    const element =
      document.getElementById(id);

    if (element){
      element.value="";
    }
  });

  clearFoodElementText("searchErr");

  if (!preserveMode){
    activeFoodEntryMode="cleared";
  }
}

function clearManualFoodEntryState(
  preserveMode
){
  clearManualFoodInputs();
  cancelEditFood();
  resetFoodSelectionState();

  if (!preserveMode){
    activeFoodEntryMode="cleared";
  }
}

function clearAllFoodEntryState(){
  activeFoodEntryMode="cleared";

  clearFoodSearchState(true);
  clearBarcodeState(true);
  clearManualFoodEntryState(true);

  clearFoodElementText("searchErr");
}

function createFoodClearButton(
  id,
  label,
  handler
){
  if (document.getElementById(id)){
    return document.getElementById(id);
  }

  const button =
    document.createElement("button");

  button.type="button";
  button.id=id;
  button.className="xbtn small";
  button.textContent=label;
  button.addEventListener(
    "click",
    handler
  );

  return button;
}

function insertAfterElement(
  reference,
  element
){
  if (
    !reference
    || !reference.parentNode
  ){
    return;
  }

  reference.parentNode.insertBefore(
    element,
    reference.nextSibling
  );
}

function installFoodEntryClearControls(){
  const search =
    foodSearchInputElement();

  if (search){
    const button =
      createFoodClearButton(
        "foodSearchClearBtn",
        "Clear food search",
        ()=>clearFoodSearchState(false)
      );

    button.style.marginLeft="6px";

    const row =
      search.closest(".row");

    if (row){
      row.appendChild(button);
    } else {
      insertAfterElement(
        search,
        button
      );
    }
  }

  const barcode =
    barcodeInputElement();

  if (barcode){
    const button =
      createFoodClearButton(
        "barcodeClearBtn",
        "Clear barcode",
        ()=>clearBarcodeState(false)
      );

    button.style.marginLeft="6px";

    const row =
      barcode.closest(".row");

    if (row){
      row.appendChild(button);
    } else {
      insertAfterElement(
        barcode,
        button
      );
    }
  }

  const manualCard =
    document.getElementById(
      "manualFoodCard"
    );

  if (manualCard){
    const button =
      createFoodClearButton(
        "manualFoodClearBtn",
        "Clear manual entry",
        ()=>clearManualFoodEntryState(false)
      );

    button.style.width="100%";
    button.style.marginTop="10px";

    manualCard.appendChild(button);
  }

  if (
    manualCard
    && !document.getElementById(
      "clearAllFoodEntryBtn"
    )
  ){
    const button =
      createFoodClearButton(
        "clearAllFoodEntryBtn",
        "Clear all food entry",
        clearAllFoodEntryState
      );

    button.style.width="100%";
    button.style.margin="10px 0";

    manualCard.parentNode.insertBefore(
      button,
      manualCard
    );
  }
}

function switchFoodEntryMode(mode){
  if (activeFoodEntryMode===mode){
    return;
  }

  activeFoodEntryMode=mode;

  if (mode==="search"){
    clearBarcodeState(true);
    clearManualFoodEntryState(true);
  } else if (mode==="barcode"){
    clearFoodSearchState(true);
    clearManualFoodEntryState(true);
  } else if (mode==="manual"){
    clearFoodSearchState(true);
    clearBarcodeState(true);
  }

  activeFoodEntryMode=mode;
}

function installFoodEntryModeIsolation(){
  const search =
    foodSearchInputElement();

  if (search){
    search.addEventListener(
      "input",
      ()=>{
        if (search.value.trim()){
          switchFoodEntryMode("search");
        }
      },
      true
    );
  }

  const barcode =
    barcodeInputElement();

  if (barcode){
    barcode.addEventListener(
      "input",
      ()=>{
        if (barcode.value.trim()){
          switchFoodEntryMode("barcode");
        }
      },
      true
    );
  }

  const barcodeButton =
    document.getElementById(
      "barcodeBtn"
    );

  if (barcodeButton){
    barcodeButton.addEventListener(
      "click",
      ()=>{
        switchFoodEntryMode("barcode");
      },
      true
    );
  }

  const manualCard =
    document.getElementById(
      "manualFoodCard"
    );

  if (manualCard){
    manualCard.addEventListener(
      "input",
      event=>{
        if (
          event.target
          && event.target.matches(
            "input, select, textarea"
          )
        ){
          switchFoodEntryMode("manual");
        }
      },
      true
    );
  }
}

migrateSavedMyFoodNames();
installFoodEntryClearControls();
installFoodEntryModeIsolation();
