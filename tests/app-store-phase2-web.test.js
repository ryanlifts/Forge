// Phase 2 web privacy, deletion, Open Food Facts, and release guardrails.
const fs=require("fs");
const path=require("path");
const {boot,EXISTING_CFG,EMPTY_DATA}=require("./harness");

let passed=0,failed=0;
function check(name,condition){
  if(condition) passed++;
  else { failed++; console.error("  FAIL:",name); }
}
const root=path.join(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

async function run(){
  const index=read("index.html");
  const food=read("scripts/02-food.js");
  const ai=read("scripts/05-ai.js");
  const settings=read("scripts/06-settings.js");
  const sw=read("sw.js");
  const webPrivacy=read("privacy.html");
  const iosPrivacy=read("privacy-ios.html");
  check("Open Food Facts search has no retired CGI fallback",
    /search\.openfoodfacts\.org\/search/.test(food)&&!/cgi\/search\.pl/.test(food));
  check("offline copy keeps AI handoffs available",
    /AI copy\/paste handoffs/.test(index)&&!/connected AI features need a connection/.test(index));
  check("privacy, support, deletion, attribution, and notices ship",
    ["privacy.html","privacy-ios.html","support.html","third-party-notices.html","THIRD-PARTY-NOTICES.txt"].every(file=>fs.existsSync(path.join(root,file)))
    && /id="eraseAllDataBtn"/.test(index)&&/Open Database License/.test(index)&&/privacy\.html/.test(index));
  check("service worker precaches the public release pages",
    /blackpyre-v116-runtime-integrity-1/.test(sw)&&/privacy\.html/.test(sw)&&/privacy-ios\.html/.test(sw)&&/support\.html/.test(sw)&&/third-party-notices\.html/.test(sw));
  check("web and iOS privacy policies are explicitly product-specific",
    /Web App Privacy Policy/.test(webPrivacy)&&!/iPhone|Native Vault|iOS App Privacy Policy/.test(webPrivacy)
    &&/iOS App Privacy Policy/.test(iosPrivacy)&&!/browser\/PWA|Web App Privacy Policy/.test(iosPrivacy));
  check("AI Quick Log copies the exact JSON-only code-block instruction",
    /Return ONLY the JSON in a single code block\. Do not include any explanation, commentary, or text before or after the JSON\./.test(ai));
  check("every named X Close control has the custom-color treatment",
    ["myFoodsCloseBtn","recentsCloseBtn","myExercisesCloseBtn","brandStoryCloseBtn","faqCloseBtn","liftCloseBtn"].every(id=>index.includes("#"+id))
    &&/#faqCloseBtn[\s\S]*border:2px solid var\(--ember\)/.test(index));
  check("retired provider credentials are not presented in recovery warnings",
    !/private API keys/.test(settings));

  const labelEdit=boot(EXISTING_CFG,EMPTY_DATA);
  labelEdit.window.eval(`activeFoodEntryMode="label"; openCustomForm("12345678",{name:"Test",servingG:100},true);`);
  check("nutrition-needs-editing opens the correction form from label review mode",
    !labelEdit.window.document.getElementById("customCard").classList.contains("hidden")
    &&labelEdit.window.document.getElementById("cfBarcode").value==="12345678");
  labelEdit.window.close();

  const erased=boot(EXISTING_CFG,Object.assign({},EMPTY_DATA,{food:{"2026-08-09":[{name:"Private",cal:100}]}}));
  let confirms=0;
  erased.window.confirm=()=>{confirms++;return true;};
  erased.window.setTimeout=fn=>{fn();return 1;};
  erased.window.eval("reloadAfterFullErase=()=>{window.__phase2Reloaded=true;};");
  const result=await erased.window.eval("eraseAllBlackPyreData()");
  check("double-confirmed erase removes every BlackPyre namespace and reloads",
    result===true&&confirms===2&&erased.window.eval("blackPyreStorageKeys().length")===0&&erased.window.__phase2Reloaded===true);
  erased.window.close();

  const protectedApp=boot(EXISTING_CFG,EMPTY_DATA);
  confirms=0;
  protectedApp.window.confirm=()=>{confirms++;return true;};
  protectedApp.window.eval("protectedMode=true; protectedModeKind='newer';");
  const protectedResult=await protectedApp.window.eval("eraseAllBlackPyreData()");
  check("Protected mode blocks erasure before confirmation",
    protectedResult===false&&confirms===0&&protectedApp.window.localStorage.getItem("forge:data")!==null);
  protectedApp.window.close();

  console.log("\nAPP STORE PHASE 2 WEB: "+passed+" passed, "+failed+" failed");
  process.exit(failed?1:0);
}
run().catch(error=>{console.error(error);process.exit(1);});
