"use strict";
// BlackPyre data payload — classic script, loaded before the main app script.
// Shares the global scope by design (no ES modules). See ARCHITECTURE.md.

const FAQ = [
  {sec:"Getting started"},

  {q:"How do I set my calorie and macro targets?", a:"Use the setup wizard when you first install BlackPyre, or open <b>Settings → Calorie &amp; macro calculator</b>. Enter your information, calculate, review the result, choose a macro split, and apply it. Results are estimates. BlackPyre will not suggest or save a self-directed daily target below <b>1,200 calories</b>."},

  {q:"Can teenagers use the calorie and macro calculator?", a:"Yes, for ages <b>13–17</b>. BlackPyre uses a youth-specific energy equation and keeps the same goal, macro, and scheduling controls. Growth and training needs can change quickly, so weight-change and macro goals should be reviewed with a parent or guardian and a qualified health professional."},

  {q:"What is a macro split?", a:"It is the percentage of your calories that comes from protein, carbohydrates, and fat. <b>Recommended</b> gives you a starting point based on the calculator. You can also choose another preset or create a custom split. Treat every result as a starting estimate, not a medical prescription."},

  {q:"How do I log and track my weight?", a:"Record today’s weight from <b>Home</b>, or use the <b>Weight</b> tab to enter today or a past date. Try to weigh under similar conditions and pay more attention to the trend over time than to one reading."},

  {q:"Can I use accessibility features?", a:"Yes. BlackPyre provides labeled controls, keyboard support where appropriate, screen-reader-friendly dialogs and navigation, visible focus, and zoom support."},


  {sec:"Food logging"},

  {q:"How do I scan food?", a:"Use <b>Scan barcode</b> for a packaged food, or type the barcode and tap <b>Look up</b>. BlackPyre checks <b>My Foods</b> first. For a fresh online result, the verification panel shows the scanned serving and nutrition. Compare those values with the package, then choose <b>Nutrition matches package</b> or <b>Nutrition needs editing</b>. A match saves the barcode to My Foods but does not log the meal. <b>Nothing is logged until you review it and tap Add to log.</b>"},

  {q:"What if scanned nutrition is wrong or missing?", a:"Choose <b>Nutrition needs editing</b> to open the correction form. Enter the serving, calories, and macros from the package and save it. BlackPyre saves your correction to <b>My Foods</b> and uses it first on later scans of the same barcode. If a barcode is not found, enter the package information manually and save it if you want to reuse it. The package label is the best source for packaged-food nutrition."},

  {q:"What is My Foods?", a:"<b>My Foods</b> is your personal food library. Save foods you use often, including homemade foods or products you entered manually. Saved foods can be edited or deleted, and a barcode can be added so future scans find the food locally."},

  {q:"What is the fastest way to log foods I eat often?", a:"Use <b>Recent foods</b>, your usual-meal card, a saved meal, or <b>Copy yesterday</b>. These reuse foods and amounts you have logged before so you do not have to search for everything again."},

  {q:"How do food suggestions work?", a:"Food suggestions are optional and off by default. When enabled, BlackPyre compares reference foods and foods you already use with the calories and macros you have left, then offers individual choices. Suggestions are estimates, not allergy or medical-safety advice. For packaged foods, check the package label."},

  {q:"How do I change, undo, or view a food entry?", a:"After choosing a food, adjust the amount with the <b>slider or amount field</b>. Calories and macros recalculate as the amount changes. Foods entered manually use the same amount-review controls, and you can enter a food without scanning anything. Foods without a known gram or liquid measurement can still scale by servings. Nothing is logged until you tap <b>Add to log</b>. After adding a food, BlackPyre keeps your place and briefly shows <b>Undo</b> and <b>View entry</b> for 30 seconds. Undo removes that exact new entry. View entry moves to it only when you ask. To correct an older entry, tap its edit control and update the values."},


  {sec:"Training"},

  {q:"How do I log a workout?", a:"Open <b>Train</b>, choose the session, and record what actually happened. Enter the normal exercise values and tap <b>Save Exercise</b>; saved exercises become part of the protected workout draft. If the plan says 8 reps and you complete 5, enter 5 — BlackPyre records what you actually did. Zero is not a special command. If you did not perform a set, tap <b>Remove</b>; the set is taken out of today’s workout and <b>Undo</b> is available. Use <b>+ Add set</b> for extra work, or <b>Remove exercise</b> to stop an exercise for this workout. The <b>•••</b> button holds secondary tools such as last workout values, video, and replacement. Before <b>Log session</b>, every programmed set and exercise still has to be resolved. Removing work applies only to this workout and does not change the training program."},

  {q:"How do I learn an exercise or replace it?", a:"Use <b>Video</b> when available for movement help. Use the replacement control to choose another suitable exercise for the current session. For a permanent program change, edit the program from <b>Train → Manage</b>."},

  {q:"How does automatic progression work?", a:"Automatic progression is optional in <b>Settings → Training</b>. When enabled, BlackPyre looks at the last workout and the programmed target. It only preloads a progression when all required programmed sets were actually completed at the target. <b>Missed, Skipped, or Removed</b> programmed sets do not count as completed prescription. A partial set uses the repetitions you actually completed. Extra sets are recorded but do not replace unfinished programmed work. Missed, skipped, and removed choices apply only to that workout and do not carry into the next session."},

  {q:"How do I create or load a training program?", a:"Open <b>Train → Manage</b>. You can build a program yourself, ask the optional coaching tools to propose one, or load a BlackPyre training-plan file. Programs created elsewhere must use BlackPyre’s training-plan format to import correctly."},

  {q:"What happens when I load a training program?", a:"BlackPyre reviews the file before replacing anything. Exercises it recognizes are matched automatically. For an unknown exercise, you can match it to an existing exercise, create a custom exercise, or remove it. <b>Your current program is not replaced until you confirm</b>, and completed workout history is kept."},

  {q:"How do I save or share a training program?", a:"Open <b>Train → Manage</b> and use <b>Save file</b> or <b>Share</b>. BlackPyre creates a training-plan file that can be reviewed and loaded later. A person receiving the file still has to review and confirm it before their current program changes."},

  {q:"How do I review past workouts and progress?", a:"Workout history is available on the <b>Train</b> tab and is grouped by month. You can open previous sessions, edit mistakes, and review exercise progress. The PR board and exercise charts show your best recorded performances and changes over time."},


  {sec:"Progress & smart features"},

  {q:"What is estimated metabolism from my logs?", a:"After enough food logging and weigh-ins, BlackPyre can estimate your daily energy use from your recorded intake and weight trend. It rejects sparse or implausible results. The estimate is not a medical measurement, and a suggested target does not change your settings until you review and save it."},

  {q:"Why is BlackPyre suggesting that I review my targets?", a:"As your weight changes, your estimated calorie needs can change too. BlackPyre may suggest reopening the calculator after a meaningful change. Nothing updates automatically; you decide whether to recalculate and save new targets."},

  {q:"What can the optional AI tools do, and what information is sent?", a:"Optional AI tools can help estimate foods, discuss your progress, or create training programs through copy/paste handoffs. BlackPyre never contacts an AI service. You choose what to copy, share, or paste into your own AI app. Selected photos stay in memory only for the handoff and raw replies are cleared after review. Review every result before saving it. AI food estimates are estimates."},


  {sec:"Your data & recovery"},

  {q:"Where is my data stored? Is it private?", a:"Your settings, logs, program, saved foods, and recovery data are stored in BlackPyre’s browser/PWA site storage on this device. BlackPyre has no user account or central BlackPyre database that can read your personal log. Online food searches send only the search or barcode request to the online food service. BlackPyre never transmits your logs, prompts, reports, or photos to an AI service; you control any copy, paste, or share handoff."},

  {q:"How do I back up or move BlackPyre to another device?", a:"Open <b>Settings → Data &amp; recovery</b>. <b>Save backup</b> quickly creates a verified file in your browser or device’s Downloads location. <b>Save backup elsewhere</b> opens supported share/save choices. Keep a second copy somewhere you will still control if this browser, installed PWA, or device is removed. On another device, install BlackPyre and restore that backup."},

  {q:"What is Protected mode, and what if my data disappears?", a:"If BlackPyre cannot safely read established saved data, it pauses normal saving instead of replacing it with empty information. <b>Do not remove the installed web app or clear its site data.</b> Open recovery and choose a validated recovery snapshot or one of your own backups. BlackPyre preserves the original saved information while recovery is being handled."},

  {q:"What works without an internet connection?", a:"Your saved foods, manual food logging, local suggestions, workouts, workout drafts, weights, measurements, water, programs, AI handoff prompts, backups, and recovery features continue to work. Saved barcodes can still load local foods. Only new online food searches and unknown barcode lookups need a connection."},


  {sec:"Legal"},

  {q:"Disclaimer & terms of use", a:"BlackPyre is an informational logging and planning tool, not medical advice and not a substitute for qualified medical, nutrition, or training care. Calorie, macro, metabolism, food, and training information are estimates and can contain errors. Exercise carries injury risk. Stop if you experience pain, dizziness, shortness of breath, or other concerning symptoms. Verify food labels when accuracy matters, especially for allergies or medical diets. The calculator is not designed for pregnancy, breastfeeding, or anyone under age 13. By continuing to use BlackPyre, you accept responsibility for how you use its information and features."}
];
