// Permanent release-decision guardrails for the native iOS package.
const {boot,check,summary,EXISTING_CFG,EMPTY_DATA}=require("./harness");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const shippedFiles=[
  "index.html","data-faq.js","sw.js",
  ...fs.readdirSync(path.join(root,"scripts")).filter(name=>name.endsWith(".js")).map(name=>"scripts/"+name)
];
const source=shippedFiles.map(read).join("\n");

check("native package has no direct AI endpoint, credential field, provider link, or live-chat control",
  !/api\.openai\.com|api\.anthropic\.com|sOpenaiKey|sAnthropicKey|sAiProvider|sAiModel|saveAiBtn|platform\.openai\.com|console\.anthropic\.com|coachOverlay|coachOpenBtn/.test(source));

const retired=boot(Object.assign({},EXISTING_CFG,{
  aiProvider:"anthropic",anthropicKey:"legacy-a",openaiKey:"legacy-o",aiModelAnth:"legacy-model"
}),EMPTY_DATA);
const stored=JSON.parse(retired.window.localStorage.getItem("forge:cfg"));
check("legacy direct-AI credentials and provider settings are scrubbed from native runtime and storage",
  ["aiProvider","anthropicKey","openaiKey","aiModelAnth"].every(key=>
    !Object.prototype.hasOwnProperty.call(retired.window.eval("cfg"),key)
    && !Object.prototype.hasOwnProperty.call(stored,key)));
check("native copy/paste food handoff remains available",
  !retired.window.document.getElementById("aiFoodCard").classList.contains("hidden")
  && !retired.window.document.getElementById("aiHandoffControls").classList.contains("hidden"));

const fontFiles=[
  "assets/fonts/fonts.css","assets/fonts/Oswald-Variable.ttf",
  "assets/fonts/IBMPlexMono-Regular.ttf","assets/fonts/IBMPlexMono-Medium.ttf",
  "assets/fonts/IBMPlexMono-SemiBold.ttf","assets/fonts/OFL-Oswald.txt",
  "assets/fonts/OFL-IBMPlexMono.txt"
];
check("native fonts and their licenses are bundled locally",
  fontFiles.every(file=>fs.existsSync(path.join(root,file))&&fs.statSync(path.join(root,file)).size>100));
check("native HTML and service worker use only bundled fonts",
  /assets\/fonts\/fonts\.css/.test(read("index.html"))
  && !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(source)
  && fontFiles.slice(0,5).every(file=>read("sw.js").includes("./"+file)));

const plist=read("ios/App/App/Info.plist");
check("camera permission accurately covers barcode and optional meal-photo use",
  /uses your camera to scan food barcodes/.test(plist)
  && /take a meal photo for an AI handoff you send yourself/.test(plist));
check("native target is iPhone-only and portrait-only with no armv7 requirement",
  !/armv7|UISupportedInterfaceOrientations~ipad|Landscape/.test(plist)
  && (plist.match(/UIInterfaceOrientationPortrait/g)||[]).length===1);
const project=read("ios/App/App.xcodeproj/project.pbxproj");
const families=[...project.matchAll(/TARGETED_DEVICE_FAMILY = ([^;]+);/g)].map(match=>match[1].trim());
check("app and Live Activity configurations all target iPhone only",families.length===4&&families.every(value=>value==="1"));

summary("NATIVE RELEASE DECISIONS");
