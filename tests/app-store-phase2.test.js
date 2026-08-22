// Phase 2 App Store privacy, deletion, package, and parity guardrails.
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {boot,EXISTING_CFG,EMPTY_DATA}=require("./harness");

let passed=0,failed=0;
const failures=[];
function check(name,condition){
  if(condition) passed++;
  else { failed++; failures.push(name); console.error("  FAIL:",name); }
}
const root=path.join(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const exists=relative=>fs.existsSync(path.join(root,relative));
const sha256=relative=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,relative))).digest("hex");

async function run(){
  const privacy=read("ios/App/App/PrivacyInfo.xcprivacy");
  const extensionPrivacy=read("ios/App/BlackPyreRestActivity/PrivacyInfo.xcprivacy");
  const privacyPage=read("privacy.html");
  const index=read("index.html");
  const ai=read("scripts/05-ai.js");
  const project=read("ios/App/App.xcodeproj/project.pbxproj");
  const bridge=read("ios/App/App/BlackPyreBridgeViewController.swift");
  check("app-level privacy manifest is bundled and declares the in-container file timestamp reason",
    /PrivacyInfo\.xcprivacy in Resources/.test(project)
    && /NSPrivacyAccessedAPICategoryFileTimestamp/.test(privacy)
    && /C617\.1/.test(privacy)
    && /<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(privacy));
  check("Live Activity extension bundles a privacy manifest with no tracking or collection",
    /C4A400062E5A000000000001 \/\* PrivacyInfo\.xcprivacy in Resources \*\//.test(project)
    && /<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/.test(extensionPrivacy)
    && /<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(extensionPrivacy));
  check("native WebKit appends BlackPyre identification without replacing the standard user agent",
    /applicationNameForUserAgent/.test(bridge)
    && /BlackPyre\/1\.0/.test(bridge)
    && !/customUserAgent/.test(bridge));
  check("native backup protection covers app backups and Native Vault files",
    /isExcludedFromBackup/.test(bridge)
    && /blackpyre-native-vault\.json/.test(bridge)
    && /eraseNativeFiles/.test(bridge)
    && /protectNativeManagedFile\(filename,"DOCUMENTS"\)/.test(read("scripts/06-settings.js")));
  check("native document management is restricted to BlackPyre-created backup prefixes",
    /documentExportPrefixes/.test(bridge)
    && /blackpyre-backup-/.test(bridge)
    && /blackpyre-PARTIAL-/.test(bridge)
    && !/name\.hasPrefix\("blackpyre-"\)/.test(bridge));

  const buildNumbers=[...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(match=>Number(match[1]));
  check("app and Live Activity configurations use App Store candidate build 5",buildNumbers.length===4&&buildNumbers.every(value=>value===5));
  check("Capacitor 8.5.0 and the secure brace-expansion override are pinned",(()=>{
    const pkg=JSON.parse(read("package.json"));
    return pkg.dependencies["@capacitor/cli"]==="8.5.0"
      && pkg.dependencies["@capacitor/core"]==="8.5.0"
      && pkg.dependencies["@capacitor/ios"]==="8.5.0"
      && pkg.dependencies["@capacitor/filesystem"]==="8.1.2"
      && pkg.dependencies["@capacitor/local-notifications"]==="8.2.1"
      && pkg.dependencies["@capacitor/share"]==="8.0.1"
      && pkg.overrides["brace-expansion"]==="5.0.9";
  })());
  check("vendored html5-qrcode remains the npm-verified 2.3.8 build",
    sha256("vendor/html5-qrcode.min.js")==="660b12437b1d747e3e68b8be0685c08cb728140110ad213f167b14b66f8b1d8e"
    && /Apache License/.test(read("vendor/html5-qrcode.LICENSE.txt")));

  const source=read("scripts/02-food.js");
  check("Open Food Facts full-text search uses the CORS-capable public route",
    /world\.openfoodfacts\.org\/cgi\/search\.pl/.test(source)
    && /search_simple=1/.test(source));
  check("offline copy correctly says AI handoffs remain available",
    /AI copy\/paste handoffs/.test(index)
    && !/connected AI features need a connection/.test(index));
  check("privacy, support, deletion, attribution, and notices are present",
    ["privacy.html","support.html","third-party-notices.html","THIRD-PARTY-NOTICES.txt",
     "BLACKPYRE-DATA-FLOW-MAP.md","BLACKPYRE-APP-PRIVACY-DRAFT.md","OPEN-FOOD-FACTS-INTEGRATION.md"].every(exists)
    && /id="eraseAllDataBtn"/.test(index)
    && /Open Database License/.test(index)
    && /privacy-ios\.html/.test(index));
  check("native privacy is iOS-specific and links to the dedicated public policy",
    /iOS App Privacy Policy/.test(privacyPage)
    &&!/browser\/PWA|Web App Privacy Policy/.test(privacyPage)
    &&/https:\/\/ryanlifts\.github\.io\/Forge\/privacy-ios\.html/.test(index));
  check("AI Quick Log copies the exact JSON-only code-block instruction",
    /Return ONLY the JSON in a single code block\. Do not include any explanation, commentary, or text before or after the JSON\./.test(ai));
  check("every named X Close control has the custom-color treatment",
    ["myFoodsCloseBtn","recentsCloseBtn","myExercisesCloseBtn","brandStoryCloseBtn","faqCloseBtn","liftCloseBtn"].every(id=>index.includes("#"+id))
    &&/#faqCloseBtn[\s\S]*border:2px solid var\(--ember\)/.test(index));

  const parityFiles=[
    "index.html","data-faq.js","sw.js","privacy.html","support.html",
    "third-party-notices.html","THIRD-PARTY-NOTICES.txt","scripts/01-storage.js",
    "scripts/02-food.js","scripts/06-settings.js"
  ];
  const generatedRoots=["www","ios/App/App/public"];
  const availableGeneratedRoots=generatedRoots.filter(directory=>exists(directory));
  const preparation=read("tools/prepare-native.sh");
  check("root, www, and native public Phase 2 targets are byte-identical",
    availableGeneratedRoots.every(directory=>parityFiles.every(file=>{
      const original=fs.readFileSync(path.join(root,file));
      return original.equals(fs.readFileSync(path.join(root,directory,file)));
    }))
    && /cp -R scripts vendor assets www\//.test(preparation)
    && /npx cap sync ios/.test(preparation));

  const erased=boot(EXISTING_CFG,Object.assign({},EMPTY_DATA,{food:{"2026-08-09":[{name:"Private",cal:100}]}}));
  erased.window.confirm=()=>true;
  erased.window.setTimeout=fn=>{ fn(); return 1; };
  erased.window.eval("reloadAfterFullErase=()=>{window.__phase2Reloaded=true;};");
  const result=await erased.window.eval("eraseAllBlackPyreData()");
  check("double-confirmed erase removes every BlackPyre storage namespace and reloads",
    result===true
    && erased.window.eval("blackPyreStorageKeys().length")===0
    && erased.window.__phase2Reloaded===true);
  erased.window.close();

  const protectedApp=boot(EXISTING_CFG,EMPTY_DATA);
  let confirms=0;
  protectedApp.window.confirm=()=>{confirms++;return true;};
  protectedApp.window.eval("protectedMode=true; protectedModeKind='newer';");
  const protectedResult=await protectedApp.window.eval("eraseAllBlackPyreData()");
  check("Protected mode blocks destructive erasure before either confirmation",
    protectedResult===false&&confirms===0&&protectedApp.window.localStorage.getItem("forge:data")!==null);
  protectedApp.window.close();

  console.log("\nAPP STORE PHASE 2: "+passed+" passed, "+failed+" failed");
  if(failed) console.log("failures:",failures.join(" | "));
  process.exit(failed?1:0);
}
run().catch(error=>{console.error(error);process.exit(1);});
