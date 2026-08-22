const fs=require("fs");

let passed=0;
let failed=0;
function check(name,condition){
  if(condition){ passed+=1; console.log("PASS:",name); }
  else { failed+=1; console.error("FAIL:",name); }
}

const plist=fs.readFileSync("ios/App/App/Info.plist","utf8");
const project=fs.readFileSync("ios/App/App.xcodeproj/project.pbxproj","utf8");
const bridge=fs.readFileSync("ios/App/App/BlackPyreBridgeViewController.swift","utf8");
const attributes=fs.readFileSync("ios/App/App/RestTimerActivityAttributes.swift","utf8");
const widget=fs.readFileSync("ios/App/BlackPyreRestActivity/BlackPyreRestActivity.swift","utf8");
const widgetPlist=fs.readFileSync("ios/App/BlackPyreRestActivity/Info.plist","utf8");
const timer=fs.readFileSync("scripts/04-weight.js","utf8");
const prepareNative=fs.readFileSync("tools/prepare-native.sh","utf8");

check("app declares Live Activity support",/<key>NSSupportsLiveActivities<\/key>\s*<true\/>/.test(plist));
check("widget extension uses the WidgetKit extension point",/com\.apple\.widgetkit-extension/.test(widgetPlist));
check("Live Activity extension is embedded in the app",/BlackPyreRestActivity\.appex in Embed App Extensions/.test(project));
check("extension bundle is nested under the app bundle",/PRODUCT_BUNDLE_IDENTIFIER = com\.blackpyre\.app\.resttimer;/.test(project));
const deploymentTargets=[...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map(match=>match[1].trim());
check("app and extension share the iOS 16.1 minimum",deploymentTargets.length===6&&deploymentTargets.every(value=>value==="16.1"));
check("extension starts at the ActivityKit minimum",/BlackPyreRestActivity[\s\S]*?IPHONEOS_DEPLOYMENT_TARGET = 16\.1;/.test(project));
check("shared rest timer attributes are defined",/struct RestTimerActivityAttributes: ActivityAttributes/.test(attributes));
check("native bridge registers the rest activity plugin",/registerPluginInstance\(blackPyreRestActivityPlugin\)/.test(bridge));
check("plugin respects Live Activity authorization",/ActivityAuthorizationInfo\(\)\.areActivitiesEnabled/.test(bridge));
check("plugin requests, updates, and ends activities",/Activity\.request/.test(bridge) && /\.update\(using: state\)/.test(bridge) && /\.end\(using: nil, dismissalPolicy: \.immediate\)/.test(bridge));
check("Lock Screen surface uses a system countdown",/Text\(timerInterval: Date\.now\.\.\.state\.endAt, countsDown: true\)/.test(widget));
check("expired Live Activity state cannot create an invalid countdown range",/state\.isPaused \|\| state\.endAt <= Date\.now/.test(widget));
check("Dynamic Island supplies expanded compact and minimal regions",/DynamicIsland \{/.test(widget) && /compactLeading:/.test(widget) && /compactTrailing:/.test(widget) && /minimal:/.test(widget));
check("expanded Dynamic Island centers the flame and countdown together",/DynamicIslandExpandedRegion\(\.center\)\s*\{\s*HStack[\s\S]*?Image\(systemName: "flame\.fill"\)[\s\S]*?timerText\(for: context\.state\)/.test(widget));
check("minimal Dynamic Island prioritizes a readable countdown beside other activities",/minimal:\s*\{\s*timerText\(for: context\.state\)[\s\S]*?font\(\.system\(size: 13/.test(widget));
check("compact Dynamic Island keeps flame and countdown condensed together",/compactLeading:\s*\{\s*HStack[\s\S]*?Image\(systemName: "flame\.fill"\)[\s\S]*?timerText\(for: context\.state\)[\s\S]*?compactTrailing:\s*\{\s*EmptyView\(\)/.test(widget));
check("running and paused states sync to native",/status:"running"/.test(timer) && /status:"paused"/.test(timer) && /plugin\.sync\(snapshot\)/.test(timer));
check("finished and cancelled timers dismiss native activity",/(finishRestCountdown\(\)[\s\S]*?endRestActivity\(\))/.test(timer) && /(cancelRest\(\)[\s\S]*?endRestActivity\(\))/.test(timer));
check("rest activity failures never break the web timer",/could not sync the rest Live Activity/.test(timer) && /could not end the rest Live Activity/.test(timer));
const generatedTimerPaths=["www/scripts/04-weight.js","ios/App/App/public/scripts/04-weight.js"];
const generatedTimersExist=generatedTimerPaths.every(file=>fs.existsSync(file));
check("native preparation copies root scripts through www into the iOS public bundle",
  /cp -R scripts vendor assets www\//.test(prepareNative)
  &&/npx cap sync ios/.test(prepareNative));
check("generated root www and native timer sources are byte-identical when present",
  !generatedTimersExist
  ||generatedTimerPaths.every(file=>timer===fs.readFileSync(file,"utf8")));

console.log(`\nLIVE ACTIVITY REST TIMER: ${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
