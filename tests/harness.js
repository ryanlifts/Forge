// BlackPyre test harness — boots the real app in jsdom.
// Phase-2 ready: any <script src="..."> or <link rel="stylesheet" href="..."> pointing at a
// local repo file is inlined before boot, so the harness tests exactly what ships,
// whether the app is one file or sliced.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function assembleHTML(){
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  // tolerant of attribute order and extras (defer, media, crossorigin, ...);
  // only local repo files are inlined — external URLs pass through untouched
  html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g, (m, src)=>{
    if (/^https?:/.test(src)) return m;
    const p = path.join(ROOT, src);
    return fs.existsSync(p) ? "<script>\n" + fs.readFileSync(p, "utf8") + "\n</script>" : m;
  });
  html = html.replace(/<link\b[^>]*>/g, (m)=>{
    if (!/rel="stylesheet"/.test(m)) return m;
    const href = (m.match(/href="([^"]+)"/)||[])[1];
    if (!href || /^https?:/.test(href)) return m;
    const p = path.join(ROOT, href);
    return fs.existsSync(p) ? "<style>\n" + fs.readFileSync(p, "utf8") + "\n</style>" : m;
  });
  return html;
}

function boot(cfgObj, dataObj, hooks){
  const html = assembleHTML();
  return new JSDOM(html, { runScripts:"dangerously", url:"https://example.com/", pretendToBeVisual:true,
    beforeParse(w){
      if (cfgObj) w.localStorage.setItem("forge:cfg", JSON.stringify(cfgObj));
      if (dataObj) w.localStorage.setItem("forge:data", JSON.stringify(dataObj));
      w.URL.createObjectURL = ()=>"blob:x"; w.URL.revokeObjectURL = ()=>{};
      w.scrollTo = ()=>{}; // jsdom doesn't implement it; the app's calls are cosmetic
      if (hooks) hooks(w);
    }});
}

// standard fixtures
const EXISTING_CFG = { setupDone:true, disclaimerAccepted:"2026-07-01", startWt:225, goalWt:175,
  calTarget:1800, proTarget:170, carbGoal:180, fatGoal:55, calSchedMode:"same", accent:"steel" };
const EMPTY_DATA = { food:{}, workouts:[], weights:[], meta:{lastBackup:null, logsSince:0} };

// tiny check framework
let pass=0, fail=0, failures=[];
function check(name, cond){
  if (cond) pass++;
  else { fail++; failures.push(name); console.log("  FAIL:", name); }
}
function summary(suite){
  console.log(`\n${suite}: ${pass} passed, ${fail} failed`);
  if (fail>0) console.log("failures:", failures.join(" | "));
  process.exit(fail>0 ? 1 : 0);
}
function dstr(offset){
  const d = new Date(); d.setDate(d.getDate()+offset);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function nextDow(target){ // next date string falling on JS getDay()===target
  for (let i=0;i<7;i++){ const ds=dstr(i); if (new Date(ds+"T12:00:00").getDay()===target) return ds; }
}
const wait = ms=>new Promise(r=>setTimeout(r,ms));

module.exports = { boot, assembleHTML, check, summary, dstr, nextDow, wait, EXISTING_CFG, EMPTY_DATA };
