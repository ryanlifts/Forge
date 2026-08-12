const fs=require("fs");

let passed=0;
let failed=0;

function check(name,condition){
  if(condition){
    passed+=1;
    console.log("PASS:",name);
  }else{
    failed+=1;
    console.error("FAIL:",name);
  }
}

function luminance(hex){
  const channels=(hex.match(/../g)||[]).map(value=>parseInt(value,16)/255).map(value=>
    value<=0.04045 ? value/12.92 : Math.pow((value+0.055)/1.055,2.4)
  );
  return 0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2];
}

function contrast(first,second){
  const a=luminance(first);
  const b=luminance(second);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}

const project=fs.readFileSync("ios/App/App.xcodeproj/project.pbxproj","utf8");
const plist=fs.readFileSync("ios/App/App/Info.plist","utf8");
const bridge=fs.readFileSync("ios/App/App/BlackPyreBridgeViewController.swift","utf8");
const index=fs.readFileSync("index.html","utf8");

check("native target remains iPhone only",/TARGETED_DEVICE_FAMILY = 1;/.test(project));
check("native target remains portrait only",/<key>UISupportedInterfaceOrientations<\/key>[\s\S]*?<string>UIInterfaceOrientationPortrait<\/string>/.test(plist));
check("safe-area insets protect the app chrome",/safe-area-inset-top/.test(index) && /safe-area-inset-bottom/.test(index));
check("focus-visible treatment remains present",/:focus-visible/.test(index));
check("My Foods opens without summoning the keyboard",/id="myFoodsOverlay"[^>]*data-initial-focus="self"/.test(index));
check("Recent Foods opens without summoning the keyboard",/id="recentsOverlay"[^>]*data-initial-focus="self"/.test(index));
check("Reduce Motion disables transitions and celebration animation",/@media \(prefers-reduced-motion: reduce\)[^{]*\{[^}]*\* \{ transition:none !important; \}[^}]*\.cel-title \{ animation:none; \}/.test(index));
check("native bridge observes Dynamic Type changes",/UIContentSizeCategory\.didChangeNotification/.test(bridge));
check("native bridge derives scaling from Apple UIFontMetrics and the active view traits",/UIFontMetrics\(forTextStyle: \.body\)\.scaledValue/.test(bridge) && /compatibleWith: traitCollection/.test(bridge));
check("native bridge applies Dynamic Type to WebView text",/bpBaseFontSize/.test(bridge) && /bpDynamicType/.test(bridge));
check("native bridge scales text rather than zooming the page",/style\.setProperty\('font-size'/.test(bridge) && !/webView\?\.pageZoom/.test(bridge));
check("dynamically rendered text inherits the selected size",/MutationObserver/.test(bridge) && /addedNodes/.test(bridge));
check("Dynamic Type injection waits for the real BlackPyre document",/WKUserScript\([\s\S]*?injectionTime: \.atDocumentEnd/.test(bridge));
check("native bridge reapplies Dynamic Type after Capacitor finishes loading",/deadline: \.now\(\) \+ 2\.0/.test(bridge));
check("Dynamic Type scaling is bounded against unusable extremes",/min\(max\(1 \+ \(\(rawScale - 1\) \* 0\.45\), 0\.9\), 1\.6\)/.test(bridge));
check("editable controls retain the anti-zoom 16px floor",/input, select, textarea \{[\s\S]*?font-family:inherit; font-size:16px !important;/.test(index));
check("primary text contrast exceeds WCAG AA",contrast("EDEEF0","101215")>=4.5 && contrast("EDEEF0","191C21")>=4.5);
check("secondary text contrast exceeds WCAG AA",contrast("8A919C","101215")>=4.5 && contrast("8A919C","191C21")>=4.5);
check("accent, warning, and success contrast exceed WCAG AA",contrast("FBBF24","101215")>=4.5 && contrast("F87171","101215")>=4.5 && contrast("4ADE80","101215")>=4.5);

console.log(`\nPHASE 3 RELEASE QA: ${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
