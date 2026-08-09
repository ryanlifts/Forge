// BlackPyre brand-message and first-launch onboarding regression suite.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { boot, EXISTING_CFG, EMPTY_DATA } = require("./harness");

let passed=0, failed=0;
const failures=[];
function check(name,condition){
  if(condition) passed++;
  else { failed++; failures.push(name); console.error("  FAIL:",name); }
}
function hash(value){ return crypto.createHash("sha256").update(value).digest("hex"); }

const root=path.join(__dirname,"..");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const bootSource=fs.readFileSync(path.join(root,"scripts/07-boot.js"),"utf8");
const settingsSource=fs.readFileSync(path.join(root,"scripts/06-settings.js"),"utf8");

check("standard motto replaces the former header and setup motto",
  (index.match(/Burn away the old\. Forge what comes next\./g)||[]).length>=2
  && !/Burn the guesswork\. Forge your body\./.test(index));

check("Why BlackPyre contains the required Black, Pyre, and BlackPyre progression",
  /id="brandStoryTitle">Why BlackPyre\?/.test(index)
  && /id="brandStoryBlackTitle">Black<\/h2>/.test(index)
  && /id="brandStoryPyreTitle">Pyre<\/h2>/.test(index)
  && /id="brandStoryCombinedTitle">BlackPyre<\/h2>/.test(index)
  && /The fire is the transformation\.<br>The discipline is what keeps it burning\./.test(index)
  && /Burn away the old\.<br>Forge what comes next\./.test(index));

check("launch and story branding mirror the standard app header",
  /id="brandLaunchOverlay"/.test(index)
  && (index.match(/class="brand-presentation-title"/g)||[]).length===2
  && (index.match(/class="brand-presentation-motto">Burn away the old\. Forge what comes next\.<\/div>/g)||[]).length===2
  && /\.brand-presentation-title\{[^}]*font-family:'Oswald'[^}]*font-size:clamp\(42px, 14vw, 68px\)/s.test(index)
  && /\.brand-presentation-motto\{[^}]*font-family:'IBM Plex Mono'[^}]*font-size:clamp\(10px, 2\.8vw, 13px\)/s.test(index));

check("Why heading and paired closing statements have the requested hierarchy",
  /\.brand-story-title\{[^}]*font-size:clamp\(26px, 7vw, 34px\)/s.test(index)
  && /class="brand-story-finale"/.test(index)
  && (index.match(/class="brand-story-final brand-story-/g)||[]).length===2
  && /\.brand-story-finale\{[^}]*background:linear-gradient\(135deg,var\(--ember\),var\(--ember-deep\)\)[^}]*color:#16100B/s.test(index)
  && /\.brand-story-final\{[^}]*font:inherit[^}]*font-size:14px/s.test(index));

check("the Why BlackPyre header carries Bella's unchanged long-press interaction",
  /id="brandStoryBrandTitleText"/.test(index)
  && /id="brandStoryBellaEgg"/.test(index)
  && /Mirror Bella's protected title interaction on the Why BlackPyre header\./.test(bootSource)
  && /setTimeout\(brandEggShow, EGG_HOLD_MS\)/.test(bootSource));

check("opening presentation remains visible for exactly four seconds",
  /const BRAND_LAUNCH_MS = 4000;/.test(fs.readFileSync(path.join(root,"scripts/06-settings.js"),"utf8")));

check("onboarding guidance is concise, age-inclusive, and medically responsible",
  /Supports ages 13 and up\./.test(settingsSource)
  && !/Supports ages 13–100\./.test(settingsSource)
  && /not medical advice; consult a physician or registered dietitian/.test(settingsSource)
  && /Step 7 · Food logging/.test(settingsSource)
  && !/Step 7 · Food database/.test(settingsSource));

check("training onboarding clearly explains the post-setup file picker",
  /Files picker opens as soon as onboarding finishes/.test(settingsSource)
  && /Files opens when onboarding finishes/.test(settingsSource));

check("food shortcuts and Help & FAQ use the accent outline",
  /id="recentsOpenBtn"/.test(index)
  && /id="myFoodsOpenBtn"/.test(index)
  && /id="faqOpenBtn"/.test(index)
  && (index.match(/btn ghost small accent-outline/g)||[]).length>=3
  && /\.btn\.ghost\.accent-outline \{ border-color:var\(--ember\); \}/.test(index));

check("handoff wording is provider-neutral and contains no API-key setup",
  /Paste AI reply &amp; review/.test(index)
  && /AI food handoff/.test(index)
  && !/ChatGPT food handoff|ChatGPT handoff — no key|Paste ChatGPT/.test(index)
  && !/No account or API key is needed|API key|Live AI provider/.test(index));

const bellaCss=(index.match(/#bellaEgg\{.*?\.bar \.fill\.over \{ background:var\(--warn\); \}/s)||[])[0]||"";
const bellaTitle=(index.match(/<h1 id="bpTitle".*?<\/h1>/s)||[])[0]||"";
const bellaBehavior=(bootSource.match(/\/\/ ================== EASTER EGG ==================.*?\n\}\)\(\);/s)||[])[0]||"";
check("protected Bella artwork and styling are byte-identical", hash(bellaCss)==="8bbf69f36efccd9f21e016f5068379978d92109c16c88bd719046f6976adbf04");
check("protected Bella header element is byte-identical", hash(bellaTitle)==="dd5708dbc17e957db57393ed493dd89a3449c190801cd3ef9c2de1fabb77e9b8");
check("protected Bella interaction behavior is byte-identical", hash(bellaBehavior)==="a28f9634bf252206f8399086f8cc0dd94ff169e0e16c2007cd491e55c288610d");

const fresh=boot(null,null);
const freshDoc=fresh.window.document;
check("a true first launch opens the brief BlackPyre presentation first",
  !freshDoc.getElementById("brandLaunchOverlay").classList.contains("hidden")
  && freshDoc.getElementById("brandStoryOverlay").classList.contains("hidden")
  && freshDoc.getElementById("disclaimerOverlay").classList.contains("hidden")
  && freshDoc.getElementById("setupOverlay").classList.contains("hidden"));

fresh.window.eval("finishBrandLaunch()");
check("the brief presentation advances to Why BlackPyre before existing setup gates",
  freshDoc.getElementById("brandLaunchOverlay").classList.contains("hidden")
  && !freshDoc.getElementById("brandStoryOverlay").classList.contains("hidden")
  && freshDoc.getElementById("brandStoryActionBtn").textContent==="Get Started");

freshDoc.getElementById("brandStoryActionBtn").click();
check("Get Started stores a separate completion flag and advances to the existing gates",
  fresh.window.localStorage.getItem("forge:brand-onboarding")==="1"
  && freshDoc.getElementById("brandStoryOverlay").classList.contains("hidden")
  && !freshDoc.getElementById("disclaimerOverlay").classList.contains("hidden")
  && freshDoc.getElementById("setupOverlay").classList.contains("hidden"));

const existing=boot(EXISTING_CFG,EMPTY_DATA);
const existingDoc=existing.window.document;
check("an existing populated installation is safely grandfathered without forced onboarding",
  existing.window.localStorage.getItem("forge:brand-onboarding")==="1"
  && existingDoc.getElementById("brandStoryOverlay").classList.contains("hidden")
  && existingDoc.getElementById("setupOverlay").classList.contains("hidden"));

const protectedBefore=["forge:cfg","forge:data","forge:program"].map(key=>existing.window.localStorage.getItem(key));
existingDoc.getElementById("whyBlackPyreOpenBtn").click();
check("Settings About opens the same explanation in informational mode",
  !existingDoc.getElementById("brandStoryOverlay").classList.contains("hidden")
  && !existingDoc.getElementById("brandStoryCloseBtn").classList.contains("hidden")
  && existingDoc.getElementById("brandStoryActionBtn").textContent==="Done");
existingDoc.getElementById("brandStoryActionBtn").click();
const protectedAfter=["forge:cfg","forge:data","forge:program"].map(key=>existing.window.localStorage.getItem(key));
check("later informational viewing changes no settings, profile, logs, or program data",
  JSON.stringify(protectedAfter)===JSON.stringify(protectedBefore)
  && existingDoc.getElementById("brandStoryOverlay").classList.contains("hidden"));

fresh.window.close();
existing.window.close();
console.log(`\nBRAND ONBOARDING: ${passed} passed, ${failed} failed`);
if(failed) console.log("failures:",failures.join(" | "));
process.exit(failed?1:0);
