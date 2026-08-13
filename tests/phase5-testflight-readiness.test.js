const fs=require("fs");

let passed=0;
let failed=0;
function check(name,condition){
  if(condition){ passed+=1; console.log("PASS: "+name); }
  else{ failed+=1; console.error("FAIL: "+name); }
}

const project=fs.readFileSync("ios/App/App.xcodeproj/project.pbxproj","utf8");
const plist=fs.readFileSync("ios/App/App/Info.plist","utf8");
const packet=fs.readFileSync("BLACKPYRE-PHASE-05-INTERNAL-TESTFLIGHT.md","utf8");

check("TestFlight version is 1.0",/MARKETING_VERSION = 1\.0;/.test(project));
check("first TestFlight build is 2",/CURRENT_PROJECT_VERSION = 2;/.test(project)&&/First build:\*\* 2/.test(packet));
check("app bundle identifier is stable",/PRODUCT_BUNDLE_IDENTIFIER = com\.blackpyre\.app;/.test(project));
check("Live Activity bundle identifier is stable",/PRODUCT_BUNDLE_IDENTIFIER = com\.blackpyre\.app\.resttimer;/.test(project));
check("app remains iPhone only",/TARGETED_DEVICE_FAMILY = 1;/.test(project));
check("minimum iOS remains 16.1",/IPHONEOS_DEPLOYMENT_TARGET = 16\.1;/.test(project));
check("automatic signing remains enabled",/CODE_SIGN_STYLE = Automatic;/.test(project));
check("export compliance declaration remains explicit",/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(plist));
check("app record values are prepared",/BLACKPYRE-IOS-1/.test(packet)&&/English \(U\.S\.\)/.test(packet));
check("internal test group and first tester are prepared",/BlackPyre Internal/.test(packet)&&/First tester:\*\* Ryan/.test(packet));
check("TestFlight lifecycle covers update preservation",/update-in-place data-preservation check/i.test(packet));
check("private feedback address remains direct entry",/feedback email must be entered directly/i.test(packet));

console.log(`\nPHASE 5 TESTFLIGHT READINESS: ${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
