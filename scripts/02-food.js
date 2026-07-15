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
foodDateEl.addEventListener("change", ()=>{ cancelEditFood(); renderFood(); });

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

// --- OFF product mapping ---
function mapOFFProduct(p){
  if (!p || typeof p!=="object") return null;
  const nu = p.nutriments || {};
  const vals = [nu["energy-kcal_100g"], nu["proteins_100g"], nu["carbohydrates_100g"], nu["fat_100g"]].map(Number);
  const name = String(p.product_name || "").trim();
  if (!name || vals.some(v=>!Number.isFinite(v) || v<0)) return null;
  const serving = Number(p.serving_quantity);
  return {
    name:name,
    brand:String(p.brands || "Generic").trim() || "Generic",
    cal100:vals[0], pro100:vals[1], carb100:vals[2], fat100:vals[3],
    servingG:Number.isFinite(serving) && serving>0 ? serving : null,
    servingLabel:p.serving_size || p.quantity || null,
  };
}

// --- OFF search: modern endpoint first, legacy fallback ---
function fetchWithTimeout(url, ms){
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=>reject(new Error("timeout")), ms);
    fetch(url).then(r=>{ clearTimeout(t); resolve(r); }, e=>{ clearTimeout(t); reject(e); });
  });
}
async function searchOFF(q){
  const fields = "product_name,brands,nutriments,serving_size,serving_quantity";
  // 1) modern search API
  try {
    const res = await fetchWithTimeout("https://search.openfoodfacts.org/search?q="+encodeURIComponent(q)+"&page_size=15&fields="+fields, 8000);
    const json = await res.json();
    const hits = (json.hits||[]).map(mapOFFProduct).filter(Boolean);
    if (hits.length) return hits;
  } catch(e){ /* fall through */ }
  // 2) legacy search API
  const res2 = await fetchWithTimeout("https://world.openfoodfacts.org/cgi/search.pl?search_terms="+encodeURIComponent(q)
    +"&search_simple=1&action=process&json=1&page_size=15&sort_by=unique_scans_n&fields="+fields, 10000);
  const json2 = await res2.json();
  return (json2.products||[]).map(mapOFFProduct).filter(Boolean);
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
    .sort((a,b)=>b.score-a.score).slice(0,4).map(x=>x.f);
  const localHits = LOCAL_DB.map(f=>{
      return {f:f, score:scoreName(f.n)};
    })
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,4)
    .map(x=>({ name:x.f.n, brand:"Built-in · whole food", cal100:x.f.cal, pro100:x.f.pro, carb100:x.f.carb, fat100:x.f.fat, servingG:null, servingLabel:null }));

  if (isOffline()){
    renderResults([...myHits, ...localHits]);
    errEl.textContent = "Offline — showing saved and built-in foods; online databases were skipped.";
    errEl.classList.remove("hidden");
    searchBtn.disabled = false; searchBtn.textContent = "Search food database";
    return;
  }

  let usdaHits = [], offHits = [];
  try { usdaHits = await searchUSDA(q); } catch(e){ /* USDA optional */ }
  try {
    offHits = await searchOFF(q);
  } catch(e) {
    if (localHits.length===0 && myHits.length===0 && usdaHits.length===0){
      errEl.textContent = "Couldn't reach the food databases — check connection. Built-in foods and manual entry still work.";
      errEl.classList.remove("hidden");
    }
  }

  renderResults([...myHits, ...localHits, ...usdaHits, ...offHits]);
  searchBtn.disabled = false; searchBtn.textContent = "Search food database";
}

// --- camera barcode scanning (lazy-loads scanner library on first use) ---
let scanner = null, scannerLibLoading = null;
function loadScannerLib(){
  if (window.Html5Qrcode) return Promise.resolve();
  if (scannerLibLoading) return scannerLibLoading;
  scannerLibLoading = new Promise((resolve, reject)=>{
    const s = document.createElement("script");
    s.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
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
    scanner = new window.Html5Qrcode("scanRegion");
    const formats = [
      window.Html5QrcodeSupportedFormats.EAN_13, window.Html5QrcodeSupportedFormats.EAN_8,
      window.Html5QrcodeSupportedFormats.UPC_A, window.Html5QrcodeSupportedFormats.UPC_E,
    ];
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 260, height: 140 }, formatsToSupport: formats },
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
async function runBarcode(){
  const code = document.getElementById("barcodeInput").value.trim().replace(/\D/g,"");
  const errEl = document.getElementById("searchErr");
  errEl.classList.add("hidden");
  document.getElementById("customCard").classList.add("hidden");
  if(!code) return;
  // personal library first
  if (data.myFoods && data.myFoods[code]){
    selectFood(data.myFoods[code]);
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
    // Open Food Facts API v3.6 product schema (v3 product-by-barcode endpoint)
    const fields = "code,product_name,brands,quantity,serving_size,serving_quantity,nutriments";
    const res = await fetchWithTimeout("https://world.openfoodfacts.org/api/v3.6/product/"+encodeURIComponent(code)+".json?fields="+fields, 10000);
    if (!res.ok){ await tryUSDABarcode(code); }
    else {
      const json = await res.json();
      const h = mapOFFProduct(json && json.product);
      if (h) selectFood(h);
      else await tryUSDABarcode(code);
    }
  } catch(e){
    // Network/malformed OFF responses still continue through USDA, then manual entry.
    await tryUSDABarcode(code);
  }
  btn.disabled = false; btn.textContent = "Look up";
}

async function tryUSDABarcode(code){
  if (effectiveUsdaKey()){
    try {
      const hits = await searchUSDA(code); // USDA matches UPC/GTIN in query
      if (hits.length){ selectFood(hits[0]); return; }
    } catch(e){}
  }
  openCustomForm(code);
}

// --- personal barcode library ---
let pendingBarcode = null;
function openCustomForm(code){
  pendingBarcode = code;
  document.getElementById("customCard").classList.remove("hidden");
  const cc = document.getElementById("customCard");
  if (cc.scrollIntoView) cc.scrollIntoView({behavior:"smooth", block:"center"});
}
document.getElementById("cfSaveBtn").addEventListener("click", ()=>{
  const name = document.getElementById("cfName").value.trim();
  const servG = Number(document.getElementById("cfServG").value);
  const cal = Number(document.getElementById("cfCal").value);
  if(!name || !servG || !cal){ flashSave("Need name, serving size, calories", true); return; }
  const pro = Number(document.getElementById("cfPro").value||0);
  const carb = Number(document.getElementById("cfCarb").value||0);
  const fat = Number(document.getElementById("cfFat").value||0);
  const food = {
    name: name, brand: "My foods",
    cal100: cal/servG*100, pro100: pro/servG*100, carb100: carb/servG*100, fat100: fat/servG*100,
    servingG: servG, servingLabel: servG+"g",
  };
  if(!data.myFoods) data.myFoods = {};
  if(pendingBarcode) data.myFoods[pendingBarcode] = food;
  save();
  ["cfName","cfServG","cfCal","cfPro","cfCarb","cfFat"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("customCard").classList.add("hidden");
  pendingBarcode = null;
  selectFood(food);
  flashSave("Saved to your foods ✓");
});

function renderResults(hits){
  const resultsEl = document.getElementById("results");
  const card = document.getElementById("resultsCard");
  if (hits.length===0){
    resultsEl.innerHTML = '<div style="padding:16px; font-size:13px; color:var(--dim);">No matches. Try fewer words — brand + one keyword works best.</div>';
  } else {
    resultsEl.innerHTML = "";
    hits.forEach(h=>{
      const div = document.createElement("div");
      div.className = "result";
      div.innerHTML = '<div class="r-name">'+esc(h.name)+'</div>'
        +'<div class="r-brand">'+esc(h.brand)+'</div>'
        +'<div class="r-macros">per 100g: '+Math.round(h.cal100)+' kcal · '+r1(h.pro100)+'P / '+r1(h.carb100)+'C / '+r1(h.fat100)+'F'
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

function selectFood(h){
  selected = h;
  document.getElementById("selName").textContent = h.name + (h.brand && h.brand!=="Generic" && !String(h.brand).startsWith("Built-in") ? " — "+h.brand : "");
  document.getElementById("selPer100").textContent =
    "per 100g: "+Math.round(h.cal100)+" kcal · "+r1(h.pro100)+"g P · "+r1(h.carb100)+"g C · "+r1(h.fat100)+"g F";
  qtyUnitEl.innerHTML = "";
  const opts = [["g","grams"],["oz","ounces"],["lb","pounds"],["ml","ml"],["floz","fl oz"]];
  if (h.servingG) opts.unshift(["serving", "serving ("+(h.servingLabel||h.servingG+"g")+")"]);
  opts.forEach(pair=>{ const o=document.createElement("option"); o.value=pair[0]; o.textContent=pair[1]; qtyUnitEl.appendChild(o); });
  qtyAmountEl.value = h.servingG ? 1 : 100;
  syncSliderToUnit();
  document.getElementById("calcCard").classList.remove("hidden");
  updateCalc();
  const cc = document.getElementById("calcCard");
  if (cc.scrollIntoView) cc.scrollIntoView({behavior:"smooth", block:"center"});
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
function updateCalc(){
  if(!selected) return;
  const g = currentGrams();
  document.getElementById("calcCal").textContent = Math.round(scaleMacro(selected.cal100,g));
  document.getElementById("calcPro").textContent = Math.round(scaleMacro(selected.pro100,g));
  document.getElementById("calcCarb").textContent = Math.round(scaleMacro(selected.carb100,g));
  document.getElementById("calcFat").textContent = Math.round(scaleMacro(selected.fat100,g));
}

document.getElementById("addSelBtn").addEventListener("click", ()=>{
  if(!selected) return;
  const g = currentGrams();
  const amt = qtyAmountEl.value, unit = qtyUnitEl.value;
  const label = unit==="serving" ? amt+" serving · "+selected.name : amt+unit+" "+selected.name;
  addEntry({
    name: label,
    cal: Math.round(scaleMacro(selected.cal100,g)),
    pro: Math.round(scaleMacro(selected.pro100,g)),
    carb: Math.round(scaleMacro(selected.carb100,g)),
    fat: Math.round(scaleMacro(selected.fat100,g)),
  });
  pushRecent(Object.assign({}, selected, {lastAmt:amt, lastUnit:unit}));
  document.getElementById("calcCard").classList.add("hidden");
  document.getElementById("resultsCard").classList.add("hidden");
  document.getElementById("foodQuery").value = "";
  document.getElementById("barcodeInput").value = "";
  selected = null;
  // v51: return to the search box ready for the next entry (meal selection is preserved)
  try { document.getElementById("foodQuery").scrollIntoView({behavior:"smooth", block:"center"}); } catch(e){}
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
    const row = document.createElement("div");
    row.className = "result";
    row.innerHTML = '<div class="r-name">'+esc(r.name)+'</div>'
      +'<div class="r-macros">'+Math.round(r.cal100)+' kcal · '+r1(r.pro100)+'g P per 100g'
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
function cancelEditFood(){
  editFoodIdx = null;
  document.getElementById("addManualBtn").textContent = "Add entry";
  document.getElementById("cancelEditFoodBtn").classList.add("hidden");
}
function startEditEntry(i){
  const f = (data.food[foodDateEl.value]||[])[i];
  if(!f) return;
  document.getElementById("mName").value = f.name;
  document.getElementById("mCal").value = f.cal;
  document.getElementById("mPro").value = f.pro||"";
  document.getElementById("mCarb").value = f.carb||"";
  document.getElementById("mFat").value = f.fat||"";
  if (f.meal){ currentMeal = f.meal; renderMealSeg(); renderFood(); }
  editFoodIdx = i;
  const btn = document.getElementById("addManualBtn");
  btn.textContent = "Update entry";
  document.getElementById("cancelEditFoodBtn").classList.remove("hidden");
  if (btn.scrollIntoView) btn.scrollIntoView({behavior:"smooth", block:"center"});
}
document.getElementById("cancelEditFoodBtn").addEventListener("click", ()=>{
  ["mName","mCal","mPro","mCarb","mFat"].forEach(id=>document.getElementById(id).value="");
  cancelEditFood();
});
document.getElementById("addManualBtn").addEventListener("click", ()=>{
  const nameInput = document.getElementById("mName");
  const calInput = document.getElementById("mCal");
  const n = nameInput.value.trim();
  const c = Number(calInput.value);
  if(!n){
    flashSave("Enter a food name before adding this entry", true);
    nameInput.focus();
    if (nameInput.scrollIntoView) nameInput.scrollIntoView({behavior:"smooth", block:"center"});
    return;
  }
  if(!Number.isFinite(c) || c<=0){
    flashSave("Enter calories greater than 0 before adding this entry", true);
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
  if (editFoodIdx!=null && (data.food[foodDateEl.value]||[])[editFoodIdx]){
    entry.meal = data.food[foodDateEl.value][editFoodIdx].meal || currentMeal;
    data.food[foodDateEl.value][editFoodIdx] = entry;
    save(); renderFood(); renderDash();
    ackBtn("addManualBtn", "✓ Updated");
    cancelEditFood();
  } else {
    addEntry(entry);
    ackBtn("addManualBtn", "✓ Added");
  }
  ["mName","mCal","mPro","mCarb","mFat"].forEach(id=>document.getElementById(id).value="");
});

function bumpLog(){
  if(!data.meta) data.meta = {lastBackup:null, logsSince:0};
  data.meta.logsSince = (data.meta.logsSince||0)+1;
}
let _lastAddSig = "", _lastAddT = 0;
function addEntry(entry){
  const d = foodDateEl.value;
  if(!entry.meal) entry.meal = currentMeal;
  // v51: repeated taps / delayed responses can fire the same add twice — swallow exact repeats within 900ms
  const sig = d+"|"+(entry.name||"")+"|"+entry.cal+"|"+entry.meal;
  const now = Date.now();
  if (sig===_lastAddSig && (now-_lastAddT)<900){ flashSave("Already added \u2014 not logging it twice", true); return; }
  _lastAddSig = sig; _lastAddT = now;
  if(!data.food[d]) data.food[d]=[];
  data.food[d].push(entry);
  bumpLog();
  save(); renderFood(); renderDash(); renderBackup();
  foodKudos(entry);
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
      addEntry(Object.assign({}, f)); // keeps original meal
    }));
  }
  renderRecents();
  renderUsual();
}

