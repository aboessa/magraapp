const f={QUEUE_NEXT:"queue:next",PROCESSING_COMPLETE:"processing:complete",PROCESSING_STOP:"processing:stop",PROCESSING_TERMINATE:"processing:terminate",TASK_START:"task:start",TASK_COMPLETED:"task:completed",TASK_ERROR:"task:error",TASK_SKIPPED:"task:skipped",DAILY_LIMIT_FALLBACK:"task:daily_limit_fallback",OVERLAY_SHOW:"overlay:show",OVERLAY_HIDE:"overlay:hide",OVERLAY_MESSAGE:"overlay:message",OVERLAY_PAUSING:"overlay:pausing",OVERLAY_ERROR_BANNER:"overlay:error_banner",OVERLAY_ERROR_BANNER_CLEAR:"overlay:error_banner_clear",PAGE_ZOOM_CHANGED:"page:zoom_changed",COUNTDOWN_START:"countdown:start",PROGRESS_UPDATE:"progress:update"},ie=new Map;function dn(e,t){return ie.has(e)||ie.set(e,new Set),ie.get(e).add(t),()=>qt(e,t)}function io(e,t){const n=o=>{qt(e,n),t(o)};dn(e,n)}function qt(e,t){const n=ie.get(e);n&&(n.delete(t),n.size===0&&ie.delete(e))}function ao(e,t){const n=ie.get(e);if(!(!n||n.size===0))for(const o of n)try{o(t)}catch(r){console.error(`❌ EventBus: handler error for event "${e}":`,r)}}function so(e){ie.delete(e)}function lo(){ie.clear()}function co(){const e={};for(const[t,n]of ie.entries())e[t]=n.size;return e}console.log("✅ EventBus module loaded");const Ge=Object.freeze(Object.defineProperty({__proto__:null,EVENTS:f,clear:so,clearAll:lo,debugListeners:co,emit:ao,off:qt,on:dn,once:io},Symbol.toStringTag,{value:"Module"}));function p(e){return new Promise(t=>setTimeout(t,e))}function L(e,t=document){try{return document.evaluate(e,t,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue}catch(n){return console.error("❌ XPath evaluation error:",n,`
XPath:`,e),null}}async function gt(e,t=5e3){const n=Date.now();for(;Date.now()-n<t;){const o=document.querySelector(e);if(o)return o;await p(100)}return null}function H(){document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",keyCode:27,bubbles:!0,cancelable:!0,composed:!0}))}function un(e){const t=e.getBoundingClientRect();return{x:t.left+t.width/2,y:t.top+t.height/2}}console.log("✅ DomUtils module loaded");let x=null,Tt=null,j=null;function fn(e,t=null,n=null){x=e,Tt=t,j=n,console.log("✅ StateManager EventBus wired")}let Ye=!1,Ke=null,Ut=null,ee=!1,de=!1,F=0,V=[],A={autoDownload:!0,delayBetweenPrompts:8e3,delayMin:15,delayMax:30,flowVideoCount:"1",flowModel:"default",flowAspectRatio:"landscape",imageDownloadQuality:"1K",videoDownloadQuality:"720p"},Nt=!1,Le=null,Oe=null,zt=null,v=[],ae=0,pn=null,mn=5e3,gn=null,hn=null,Se=null,bn=3,wn=0,yn=new Set;const qe="flowAutomationState",En={PROMPT_POLICY_ERROR_POPUP_XPATH:"//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and not(.//*[contains(., '5')])]",QUEUE_FULL_POPUP_XPATH:"//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and .//*[contains(., '5')]]"};function ge(){return{isUserLoggedIn:Ye,subscriptionStatus:Ke,userId:Ut,isProcessing:ee,isPausing:de,currentPromptIndex:F,prompts:V,settings:A,isCurrentPromptProcessed:Nt,lastAppliedSettings:Le,lastAppliedMode:Oe,fallbackModel:zt,taskList:v,currentTaskIndex:ae,tileScanInterval:pn,scanIntervalMs:mn,currentProcessingPrompt:gn,currentTaskStartTime:hn,countdownInterval:Se,maxRetries:bn,currentRetries:wn,preSubmitTileIds:yn}}function W(e){if(e.isUserLoggedIn!==void 0&&(Ye=e.isUserLoggedIn),e.subscriptionStatus!==void 0&&(Ke=e.subscriptionStatus),e.userId!==void 0&&(Ut=e.userId),e.isProcessing!==void 0){const t=ee;ee=e.isProcessing,t!==ee&&chrome.runtime.sendMessage({action:"automationStateChanged",isRunning:ee}).catch(()=>{})}e.isPausing!==void 0&&(de=e.isPausing),e.currentPromptIndex!==void 0&&(F=e.currentPromptIndex),e.prompts!==void 0&&(V=e.prompts),e.settings!==void 0&&(A=e.settings),e.isCurrentPromptProcessed!==void 0&&(Nt=e.isCurrentPromptProcessed),e.lastAppliedSettings!==void 0&&(Le=e.lastAppliedSettings),e.lastAppliedMode!==void 0&&(Oe=e.lastAppliedMode),e.fallbackModel!==void 0&&(zt=e.fallbackModel),e.taskList!==void 0&&(v=e.taskList),e.currentTaskIndex!==void 0&&(ae=e.currentTaskIndex),e.tileScanInterval!==void 0&&(pn=e.tileScanInterval),e.scanIntervalMs!==void 0&&(mn=e.scanIntervalMs),e.currentProcessingPrompt!==void 0&&(gn=e.currentProcessingPrompt),e.currentTaskStartTime!==void 0&&(hn=e.currentTaskStartTime),e.countdownInterval!==void 0&&(Se=e.countdownInterval),e.maxRetries!==void 0&&(bn=e.maxRetries),e.currentRetries!==void 0&&(wn=e.currentRetries),e.preSubmitTileIds!==void 0&&(yn=e.preSubmitTileIds)}function uo(){return A}function fo(e){A={...A,...e}}function po(){return v}function mo(e,t){v[e]&&(v[e]={...v[e],...t})}function go(){return v[F]||null}function ho(e){return v.find(t=>t.index===e)||null}function bo(){return v.find(e=>e.status==="current")||null}async function ye(){const e={status:ee?"running":"paused",isProcessing:ee,prompts:V.map(t=>t),currentIndex:F,totalPrompts:V.length,processedCount:F,currentPrompt:V[F]||"",settings:A,startTime:Date.now(),lastUpdate:Date.now(),taskList:v,currentTaskIndex:ae};return new Promise(t=>{chrome.storage.local.set({[qe]:e},()=>{t(e)})})}async function De(){return new Promise(e=>{chrome.storage.local.get(qe,t=>{const n=t[qe];e(n||null)})})}async function Sn(){return new Promise(e=>{chrome.storage.local.remove(qe,()=>{e()})})}(async function(){const t=await De();t&&t.status==="paused"&&(V=t.prompts||[],F=t.currentIndex||0,A=t.settings||A,v=t.taskList||[],ae=t.currentTaskIndex||0,ee=!1,console.log(`📋 Restored ${v.length} tasks from storage`),chrome.runtime.sendMessage({action:"stateRestored",state:t}).catch(()=>{}),v.length>0&&v.forEach(n=>st(n)))})();function Xe(e,t,n){return e&&e.settings&&e.settings[t]!==void 0?e.settings[t]:n[t]}function wo(e,t){let n=Xe(e,"delayMin",t),o=Xe(e,"delayMax",t);if(n===void 0||o===void 0){const a=Xe(e,"delayBetweenPrompts",t)||8;n=a/1e3,o=a/1e3}n>o&&([n,o]=[o,n]);const r=n+Math.random()*(o-n);return Math.round(r*1e3)}function at(){Se&&(clearInterval(Se),Se=null)}function yo(e){const t=Math.floor(e/1e3),n=Math.floor(t/60),o=t%60;return n>0?`${n}m ${o}s`:`${o}s`}function Eo(e,t){at();let n=e;const o=Date.now(),r=(e/1e3).toFixed(1);x&&x.emit(f.OVERLAY_MESSAGE,`⏱️ Waiting ${r}s before ${t}...`),Se=setInterval(()=>{const i=Date.now()-o;if(n=e-i,n<=0){at(),x&&x.emit(f.OVERLAY_MESSAGE,`▶️ Starting ${t}...`);return}const a=(n/1e3).toFixed(1);x&&x.emit(f.OVERLAY_MESSAGE,`⏱️ Waiting ${a}s before ${t}...`)},100)}function ht(){return new Promise(e=>{let t=0;const n=3,o=1e3;function r(){chrome.runtime.sendMessage({action:"getAuthState"},i=>{if(chrome.runtime.lastError){if(t<n){t++,setTimeout(r,o);return}e({isLoggedIn:!1,subscriptionStatus:null,error:"Could not verify authentication state"});return}i?(Ye=i.isLoggedIn,Ke=i.subscriptionStatus,e(i)):t<n?(t++,setTimeout(r,o)):e({isLoggedIn:!1,subscriptionStatus:null,error:"No response from background script"})})}r()})}chrome.runtime.sendMessage({action:"getAuthState"},e=>{e&&(Ye=e.isLoggedIn,Ke=e.subscriptionStatus)});chrome.runtime.onMessage.addListener(function(e,t,n){const o={received:!0};if(e.action==="startProcessing")return ht().then(r=>{if(!r.isLoggedIn){const i=r.error||"Authentication required. Please sign in first.";chrome.runtime.sendMessage({action:"error",error:i}),n({...o,error:i});return}if(ee)n({...o,error:"Already processing"});else{if(A={...A,...e.settings,flowVideoCount:e.settings.flowVideoCount||A.flowVideoCount,flowModel:e.settings.flowModel||A.flowModel,flowAspectRatio:e.settings.flowAspectRatio||A.flowAspectRatio},W({isProcessing:!0}),F=0,Le=null,Oe=null,e.useUnifiedQueue&&e.queueTasks)console.log("🎯 Using UNIFIED QUEUE system"),v=e.queueTasks.map(i=>{var a;return{queueTaskId:i.id,index:i.index,prompt:i.prompt,type:i.type,status:"pending",expectedVideos:parseInt((a=i.settings)==null?void 0:a.count,10)||1,foundVideos:0,videoUrls:[],settings:i.settings,referenceImages:i.referenceImages||null}}),V=v.map(i=>i.prompt),console.log(`✅ Created ${v.length} tasks from unified queue (${v.filter(i=>i.type==="createvideo").length} video, ${v.filter(i=>i.type==="createimage").length} image)`);else{console.log("⚠️ Using LEGACY task system"),V=e.prompts;const i=e.taskSettings||[],a=e.processingMode||"createvideo",l=e.imagePairs||[];a==="image"&&l.length>0?(v=l.map((u,c)=>{var d;return{index:c+1,prompt:u.prompt,image:u.image,type:"image-to-video",status:"pending",expectedVideos:parseInt((d=u.settings)==null?void 0:d.count,10)||1,foundVideos:0,videoUrls:[],settings:u.settings}}),console.log(`✅ Created ${v.length} image-to-video tasks (legacy)`)):(v=V.map((u,c)=>{const d=i[c]||{videoCount:A.flowVideoCount,model:A.flowModel,aspectRatio:A.flowAspectRatio};return{index:c+1,prompt:u,type:"createvideo",status:"pending",expectedVideos:parseInt(d.count,10)||1,foundVideos:0,videoUrls:[],settings:d}}),console.log(`✅ Created ${v.length} createvideo tasks (legacy)`))}ae=0,ye(),x?(x.emit(f.QUEUE_NEXT),n({...o,started:!0})):(console.error("❌ EventBus not initialized — cannot start processing"),W({isProcessing:!1}),ye(),chrome.runtime.sendMessage({action:"error",error:"Extension not fully initialized. Please refresh the Flow page and try again."}),n({...o,error:"Extension not initialized. Please refresh the page."}))}}).catch(r=>{chrome.runtime.sendMessage({action:"error",error:"Authentication verification failed. Please try again."}),n({...o,error:"Authentication verification failed"})}),!0;if(e.action==="resumeProcessing")return De().then(r=>{r&&r.status==="paused"?(V=r.prompts||[],F=r.currentIndex||0,A=r.settings||A,v=r.taskList||[],ae=r.currentTaskIndex||0,W({isProcessing:!0}),de=!1,chrome.runtime.sendMessage({action:"setPageZoom",zoomFactor:.75}).catch(()=>{}),x&&x.emit(f.PAGE_ZOOM_CHANGED,{zoom:.75}),console.log(`▶️ Resuming Flow from prompt ${F+1}/${V.length}`),console.log(`📋 Restored ${v.length} tasks`),ye(),v.forEach(i=>st(i)),x?(x.emit(f.QUEUE_NEXT),n({...o,resumed:!0})):(console.error("❌ EventBus not initialized — cannot resume processing"),W({isProcessing:!1}),n({...o,error:"Extension not initialized. Please refresh the page."}))):n({...o,error:"No paused state to resume"})}),!0;if(e.action==="resumeAfterCacheClean")return De().then(r=>{var i;r&&(r.status==="running"||r.status==="paused")&&((i=r.prompts)==null?void 0:i.length)>0?(V=r.prompts||[],F=r.currentIndex||0,A=r.settings||A,v=r.taskList||[],ae=r.currentTaskIndex||0,ee=!0,de=!1,Le=null,Oe=null,chrome.runtime.sendMessage({action:"setPageZoom",zoomFactor:.75}).catch(()=>{}),x&&x.emit(f.PAGE_ZOOM_CHANGED,{zoom:.75}),ye(),v.forEach(a=>st(a)),console.log(`🔄 resumeAfterCacheClean: restored ${v.length} tasks, resuming from index ${F}`),x?(x.emit(f.QUEUE_NEXT),n({...o,resumed:!0})):(console.error("❌ EventBus not initialized — cannot resume after cache clean"),W({isProcessing:!1}),n({...o,error:"Extension not initialized. Please refresh the page."}))):(console.warn("⚠️ resumeAfterCacheClean: no valid saved state found — cannot auto-resume"),n({...o,error:"No valid saved state"}))}),!0;if(e.action==="stopProcessing")x&&x.emit(f.PROCESSING_STOP),at(),W({isProcessing:!1}),de=!0,chrome.runtime.sendMessage({action:"resetPageZoom"}).catch(()=>{}),x&&x.emit(f.PAGE_ZOOM_CHANGED,{zoom:1}),ye(),Nt?(de=!1,x&&x.emit(f.OVERLAY_HIDE),chrome.runtime.sendMessage({action:"updateStatus",status:"Processing paused. Click Resume to continue."})):(x&&x.emit(f.OVERLAY_PAUSING),chrome.runtime.sendMessage({action:"updateStatus",status:"Flow will pause after current prompt completes..."})),n(o);else if(e.action==="terminateProcessing")chrome.runtime.sendMessage({action:"resetPageZoom"}).catch(()=>{}),x&&x.emit(f.PAGE_ZOOM_CHANGED,{zoom:1}),W({isProcessing:!1}),de=!1,V=[],F=0,v=[],ae=0,Le=null,Oe=null,zt=null,Sn(),x&&(x.emit(f.PROCESSING_TERMINATE),x.emit(f.OVERLAY_HIDE)),n({...o,terminated:!0});else{if(e.action==="getStoredState")return De().then(r=>{n({...o,state:r})}),!0;if(e.action==="authStateChanged")Ye=e.isLoggedIn,Ke=e.subscriptionStatus,Ut=e.userId,n({success:!0});else if(e.action==="getContentEditorTarget")if(j){const r=j.getTargetVideoSrc();n({success:!0,target:r})}else n({success:!1,target:null});else if(e.action==="getContentEditorTiles")if(j){const r=j.getProjectTiles();n({success:!0,tiles:r})}else n({success:!1,tiles:[]});else if(e.action==="clickContentEditorTile")if(j){const r=j.clickProjectTile(e.tileId);n({success:r})}else n({success:!1});else if(e.action==="runContentEditorSequence"){if(!j)return n({received:!0,error:"ContentEditorAutomation not available"}),!0;if(j.isEditorRunning())return n({received:!0,error:"Already running"}),!0;const r=e.tasks||[],i=!0;return j.runEditorSequence(r,(a,l,u)=>{chrome.runtime.sendMessage({action:"contentEditorProgress",taskId:a,status:l,error:u||null}).catch(()=>{})},{stealthMode:i}).then(()=>{chrome.runtime.sendMessage({action:"contentEditorComplete"}).catch(()=>{})}).catch(a=>{chrome.runtime.sendMessage({action:"contentEditorError",error:(a==null?void 0:a.message)||String(a)}).catch(()=>{})}),n({received:!0,started:!0}),!0}else if(e.action==="stopContentEditorSequence")j&&j.stopEditorSequence(),n({received:!0,stopped:!0});else if(e.action==="activateContentDownloader")Tt?(Tt.toggle(),n({received:!0,toggled:!0})):(console.warn("⚠️ activateContentDownloader: ContentDownloadManager not wired"),n({received:!0,toggled:!1,error:"ContentDownloadManager not available"}));else if(e.action==="clickNewProjectButton"){try{let r=L("//button[.//i[normalize-space()='add_2']]");r||(r=Array.from(document.querySelectorAll("button")).find(i=>{var a;return((a=i.querySelector("i"))==null?void 0:a.textContent.trim())==="add_2"})||null),r?(console.log("✅ New project button found. Clicking..."),r.click(),n({success:!0})):(console.warn("⚠️ New project button not found"),n({success:!1,error:"Button not found"}))}catch(r){console.error("❌ Error clicking new project button:",r),n({success:!1,error:r.message})}return!0}else n(o)}});document.addEventListener("visibilitychange",()=>{document.hidden||setTimeout(()=>{ht().then(e=>{chrome.runtime.sendMessage({action:"authStateRefreshed",authState:e}).catch(()=>{})})},500)});window.addEventListener("focus",()=>{setTimeout(()=>{ht().then(e=>{chrome.runtime.sendMessage({action:"authStateRefreshed",authState:e}).catch(()=>{})})},500)});function st(e){e.queueTaskId&&chrome.runtime.sendMessage({action:"queueTaskUpdate",taskId:e.queueTaskId,updates:{status:e.status}}).catch(()=>{})}console.log("✅ State Manager module loaded");const bt=Object.freeze(Object.defineProperty({__proto__:null,SELECTORS:En,STORAGE_KEY:qe,clearCountdownTimer:at,clearStateFromStorage:Sn,formatTime:yo,getCurrentTask:go,getCurrentTaskByStatus:bo,getEffectiveSetting:Xe,getRandomDelay:wo,getSettings:uo,getState:ge,getTaskByIndex:ho,getTaskList:po,init:fn,loadStateFromStorage:De,saveStateToStorage:ye,sendTaskUpdate:st,setState:W,startCountdown:Eo,updateSettings:fo,updateTask:mo,verifyAuthenticationState:ht},Symbol.toStringTag,{value:"Module"}));let oe=null;const Bt=/(^|[^A-Za-z0-9._()\-])@([A-Za-z0-9][A-Za-z0-9._\-]*(?:\s*\([A-Za-z0-9._\-]+\)[A-Za-z0-9._\-]*)*)/g,So=700,xo=6e3,vo=1e4,To=4e3;function xn(e){return String(e||"").trim().replace(/\s*\(\s*/g,"(").replace(/\s*\)\s*/g,")")}function Et(e){return xn(e).toLowerCase()}function ko(e){oe=e,console.log("✅ TextInjector initialized")}function _e(e,t=[]){return new Promise(n=>{chrome.runtime.sendMessage({action:"executeInMainWorld",funcBody:e,args:t},o=>{chrome.runtime.lastError?n({success:!1,error:chrome.runtime.lastError.message}):n(o||{success:!1,error:"No response"})})})}const Io=120;async function _o(e,t={}){var n;try{const o=document.querySelector('[data-slate-editor="true"]');if(!o)return console.error('🔴 Flow Slate editor [data-slate-editor="true"] not found'),!1;const i=((n=(oe?oe():{}).settings)==null?void 0:n.stealthMode)||!1;if(((t==null?void 0:t.referenceMode)||null)==="tag"&&typeof e=="string"&&e.includes("@")){if(console.log("🏷️ Tag mode: Injecting prompt via interactive @ mention picker..."),await $o(o,e,i))return console.log("✅ Tag mode interactive injection complete"),!0;const u=oe?oe():{};if(!u.isProcessing&&!u.isPausing)return console.log("⏸️ Tag injection interrupted — processing stopped"),!1;console.warn("⚠️ Tag mode interactive path failed — falling back to standard text injection")}return i?e.length>Io?(console.log(`🥷 Stealth Mode: Long prompt (${e.length} chars) — using human-like paste simulation...`),await qo(o,e)?(console.log("✅ Text pasted with human-like behavior (Slate.js)"),!0):(console.log("⏸️ Paste was interrupted or failed"),!1)):(console.log(`🥷 Stealth Mode: Short prompt (${e.length} chars) — using human-like typing...`),await zo(o,e)?(console.log("✅ Text typed with human-like behavior (Slate.js)"),!0):(console.log("⏸️ Typing was interrupted"),!1)):await Vt(o,e)}catch(o){return console.error("❌ Error injecting text into Slate.js editor:",o),!1}}function lt(){const e=oe?oe():{};return!e.isProcessing&&!e.isPausing}function Ao(e){const t=[];let n=0;Bt.lastIndex=0;let o;for(;(o=Bt.exec(e))!==null;){const r=o[1]||"",i=o[2]||"",a=o.index+r.length,l=a+1+i.length;n<a&&t.push({type:"text",value:e.slice(n,a)}),t.push({type:"tag",value:i}),n=l}return n<e.length&&t.push({type:"text",value:e.slice(n)}),t}async function Po(e){e.focus(),e.click(),await p(120);const t=window.getSelection(),n=document.createRange();n.selectNodeContents(e),t.removeAllRanges(),t.addRange(n),await p(80),e.dispatchEvent(new InputEvent("beforeinput",{bubbles:!0,cancelable:!0,inputType:"insertText",data:""})),await p(120)}async function kt(e,t,n){if(!t)return!0;if(lt())return!1;e.focus();const o=window.getSelection(),r=document.createRange();return r.selectNodeContents(e),r.collapse(!1),o.removeAllRanges(),o.addRange(r),e.dispatchEvent(new InputEvent("beforeinput",{bubbles:!0,cancelable:!0,inputType:"insertText",data:t})),await p(n?90+Math.random()*130:50),!0}function Ht(e,t,n,o,r={}){e.dispatchEvent(new KeyboardEvent(t,{key:n,code:o,bubbles:!0,cancelable:!0,composed:!0,...r}))}async function Mo(e){return e.focus(),Ht(e,"keydown","@","Digit2",{shiftKey:!0}),Ht(e,"keyup","@","Digit2",{shiftKey:!0}),gt('[role="dialog"][data-state="open"]',So)}function Wt(e,t){const n=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value");n!=null&&n.set?n.set.call(e,t):e.value=t,e.dispatchEvent(new Event("input",{bubbles:!0}))}async function Co(e,t,n){e.focus(),Wt(e,"");let o="";for(let r=0;r<t.length;r++){if(lt())return!1;o+=t[r],Wt(e,o),await p(n?70+Math.random()*90:35)}return!0}function Ro(e){const t=Et(e);if(!t)return null;const n=document.querySelectorAll('[data-testid="virtuoso-item-list"] img[alt]');for(const o of n)if(Et(o.getAttribute("alt")||"")===t)return o;for(const o of n){const r=Et(o.getAttribute("alt")||"");if(r&&r.endsWith(`/${t}`))return o}return null}async function Lo(e,t){const n=Date.now();for(;Date.now()-n<t;){const o=Ro(e);if(o)return o;await p(120)}return null}async function Oo(e){const t=Date.now();for(;Date.now()-t<e;){if(!document.querySelector('[role="dialog"][data-state="open"]'))return!0;await p(100)}return!1}async function Do(e,t,n){const o=xn(t);let r=await Mo(e);if(!r){if(!await kt(e,"@",n))return!1;r=await gt('[role="dialog"][data-state="open"]',xo)}if(!r)return console.warn(`⚠️ Tag mention picker did not open for @${o}`),!1;const i=r.querySelector('input[type="text"]');if(!i)return console.warn(`⚠️ Tag mention search input not found for @${o}`),H(),await p(120),!1;if(!await Co(i,o,n))return!1;const l=await Lo(o,vo);if(!l)return console.warn(`⚠️ No mention picker result found for @${o}`),H(),await p(140),!1;const u=l.parentElement;return u?(u.click(),await Oo(To)||(H(),await p(100)),await p(n?90+Math.random()*130:55),!0):(console.warn(`⚠️ Mention picker result row missing for @${o}`),H(),await p(140),!1)}async function $o(e,t,n){const o=Ao(t||"");if(o.length===0)return Vt(e,t||"");await Po(e);for(const r of o){if(lt())return!1;if(r.type==="text"){if(!await kt(e,r.value,n))return!1;continue}if(r.type==="tag"&&!await Do(e,r.value,n)&&(console.warn(`⚠️ Falling back to plain token text for @${r.value}`),!await kt(e,`@${r.value}`,n)))return!1}return lt()?!1:(await p(180),!0)}async function Vt(e,t){e.click(),e.focus(),await p(150),e.dispatchEvent(new KeyboardEvent("keydown",{bubbles:!0,cancelable:!0,key:"a",code:"KeyA",ctrlKey:!0,keyCode:65})),await p(80),e.dispatchEvent(new InputEvent("beforeinput",{bubbles:!0,cancelable:!0,inputType:"insertText",data:t})),await p(400);const n=e.textContent.trim();return n===t||n.includes(t.substring(0,20))?(console.log("✅ Text injected successfully into Slate.js Flow editor"),!0):(console.warn("⚠️ Text injection may have failed. Got:",JSON.stringify(n.substring(0,50))),!0)}async function qo(e,t){const n=300+Math.random()*600;console.log(`🥷 Paste simulation: thinking pause ${Math.round(n)}ms...`),await p(n),e.click(),e.focus(),await p(150+Math.random()*100),e.dispatchEvent(new KeyboardEvent("keydown",{bubbles:!0,cancelable:!0,key:"a",code:"KeyA",ctrlKey:!0,keyCode:65})),await p(80+Math.random()*80),e.dispatchEvent(new KeyboardEvent("keydown",{bubbles:!0,cancelable:!0,key:"v",code:"KeyV",ctrlKey:!0,keyCode:86})),await p(50+Math.random()*50),e.dispatchEvent(new InputEvent("beforeinput",{bubbles:!0,cancelable:!0,inputType:"insertText",data:t})),await p(300+Math.random()*200);const o=e.textContent.trim(),r=t.trim();return o===r||o.includes(r.substring(0,30))?(console.log("✅ Paste simulation: SUCCESS"),!0):(console.warn("⚠️ Paste simulation failed — falling back to fast inject"),await Vt(e,t))}const Uo={a:["q","w","s","z"],b:["v","g","h","n"],c:["x","d","f","v"],d:["s","e","r","f","c"],e:["w","r","d"],f:["d","r","t","g","v"],g:["f","t","y","h","b"],h:["g","y","u","j","n"],i:["u","o","k"],j:["h","u","i","k","n"],k:["j","i","o","l"],l:["k","o","p"],m:["n","j","k"],n:["b","h","j","m"],o:["i","p","l","k"],p:["o","l"],q:["w","a"],r:["e","t","f"],s:["a","w","e","d","z"],t:["r","y","g"],u:["y","i","h","j"],v:["c","f","g","b"],w:["q","e","s"],x:["z","s","d","c"],y:["t","u","g","h"],z:["a","s"]},No=new Set(["th","he","in","er","an","re","on","en","at","es","ti","or"]);async function zo(e,t){var i,a;const n=await _e(`
    const el = document.querySelector('[data-slate-editor="true"]');
    if (!el) return 'error:Editor not found';

    const fiberKey = Object.keys(el).find(k =>
      k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
    );
    if (!fiberKey) return 'error:React fiber not found on editor element';

    let node = el[fiberKey];
    let editor = null;
    for (let i = 0; i < 100; i++) {
      if (!node) break;
      const p = node.memoizedProps;
      if (p && p.editor && typeof p.editor.apply === 'function' && p.editor.children) {
        editor = p.editor;
        break;
      }
      node = node.return;
    }
    if (!editor) return 'error:Slate editor not found in fiber tree';

    // Store on window for subsequent per-character calls
    window.__flowSlateEditor = editor;

    // Clear any existing text
    const existing = editor.children[0]?.children[0]?.text || '';
    if (existing.length > 0) {
      editor.apply({ type: 'remove_text', path: [0, 0], offset: 0, text: existing });
    }
    return 'ok';
  `);if(!n.success||(i=n.result)!=null&&i.startsWith("error:")){const l=n.error||((a=n.result)==null?void 0:a.replace("error:",""))||"Unknown error";return console.error("❌ Stealth Typing init failed:",l),!1}console.log("✅ Stealth Typing: Slate editor initialized via MAIN world fiber"),await p(200);let o="";console.log(`🥷 Stealth Typing: "${t.substring(0,40)}${t.length>40?"...":""}"`);for(let l=0;l<t.length;l++){const u=oe?oe():{};if(!u.isProcessing&&!u.isPausing)return console.log("⏸️ Stealth Typing: interrupted — processing stopped"),!1;const c=t[l],d=c.toLowerCase();if(/[a-z]/.test(d)&&Math.random()<.03){const T=Uo[d]||[d],E=T[Math.floor(Math.random()*T.length)];await _e(`
        const editor = window.__flowSlateEditor;
        if (editor) {
          const offset = editor.children[0]?.children[0]?.text?.length || 0;
          editor.apply({ type: 'insert_text', path: [0, 0], offset, text: args[0] });
        }
      `,[E]),await p(80+Math.random()*60),await p(150+Math.random()*250),await _e(`
        const editor = window.__flowSlateEditor;
        if (editor) {
          const t = editor.children[0]?.children[0]?.text || '';
          if (t.length > 0) {
            editor.apply({ type: 'remove_text', path: [0, 0], offset: t.length - 1, text: t[t.length - 1] });
          }
        }
      `),await p(60+Math.random()*50)}await _e(`
      const editor = window.__flowSlateEditor;
      if (editor) {
        const offset = editor.children[0]?.children[0]?.text?.length || 0;
        editor.apply({ type: 'insert_text', path: [0, 0], offset, text: args[0] });
      }
    `,[c]);const s=o+d;let g;No.has(s)?g=50+Math.random()*40:c===" "?g=120+Math.random()*150:c===","||c==="."?g=150+Math.random()*200:g=80+Math.random()*120;const w=l-t.lastIndexOf(" ",l);w>5&&(g+=w*2),Math.random()<.03&&(g+=400+Math.random()*800),o=d,await p(g)}await p(400);const r=await _e(`
    const editor = window.__flowSlateEditor;
    return editor ? (editor.children[0]?.children[0]?.text || '') : '';
  `);if(r.success){const l=r.result||"";l===t?console.log("✅ Stealth Typing: SUCCESS — text matches exactly"):(console.warn("⚠️ Stealth Typing: mismatch. Got:     ",JSON.stringify(l.substring(0,60))),console.warn("⚠️ Stealth Typing: Expected:",JSON.stringify(t.substring(0,60))))}return!0}console.log("✅ TextInjector module loaded");let It=null;function Vo(e){It=e,console.log("✅ SubmitHandler initialized")}function Fo(e,t=[]){return new Promise(n=>{chrome.runtime.sendMessage({action:"executeInMainWorld",funcBody:e,args:t},o=>{chrome.runtime.lastError?n({success:!1,error:chrome.runtime.lastError.message}):n(o||{success:!1,error:"No response"})})})}async function Go(){var e;try{return((e=(It?It():{}).settings)==null?void 0:e.stealthMode)||!1?await Yo():vn()}catch(t){return console.error("❌ Error in clickSubmit:",t),!1}}async function Yo(){var t,n;console.log("🥷 Stealth Mode: Triggering submit via React fiber onClick (MAIN world)...");const e=await Fo(`
    // Find submit button: arrow_forward icon + span with text
    const buttons = Array.from(document.querySelectorAll('button'));
    const submitBtn = buttons.find(btn => {
      const hasArrowForward = btn.querySelector('i')?.textContent.trim() === 'arrow_forward';
      const hasSpanText     = btn.querySelector('span')?.textContent.trim().length > 0;
      return hasArrowForward && hasSpanText;
    });
    if (!submitBtn) return 'error:Submit button not found';

    // Walk fiber tree to find onClick prop
    const fiberKey = Object.keys(submitBtn).find(k =>
      k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
    );
    if (!fiberKey) return 'error:React fiber not found on submit button';

    let node = submitBtn[fiberKey];
    let onClick = null;
    for (let i = 0; i < 50; i++) {
      if (!node) break;
      const p = node.memoizedProps;
      if (p && typeof p.onClick === 'function') {
        onClick = p.onClick;
        break;
      }
      node = node.return;
    }
    if (!onClick) return 'error:onClick prop not found in fiber tree';

    const editor = document.querySelector('[data-slate-editor="true"]');
    editor?.focus();

    // Call React handler with a plain object — isTrusted:true passes Flow's event validation.
    // Real Event objects have non-configurable isTrusted=false; plain objects have no such restriction.
    onClick({
      isTrusted: true,
      type: 'click',
      bubbles: true,
      cancelable: true,
      target: submitBtn,
      currentTarget: submitBtn,
      nativeEvent: { isTrusted: true, type: 'click', target: submitBtn },
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    return 'ok';
  `);if(!e.success||(t=e.result)!=null&&t.startsWith("error:")){const o=e.error||((n=e.result)==null?void 0:n.replace("error:",""))||"Unknown error";return console.error("❌ Stealth submit failed:",o),console.warn("⚠️ Falling back to DOM click for submit..."),vn()}return console.log("✅ Stealth submit triggered via React onClick prop (zero DOM events)"),!0}function vn(){var a;const t=Array.from(document.querySelectorAll("button")).find(l=>{var d,s;const u=((d=l.querySelector("i"))==null?void 0:d.textContent.trim())==="arrow_forward",c=((s=l.querySelector("span"))==null?void 0:s.textContent.trim().length)>0;return u&&c});if(!t)return console.warn("⚠️ Submit button not found"),!1;const n=Object.keys(t).find(l=>l.startsWith("__reactFiber")||l.startsWith("__reactInternalInstance"));if(!n)return console.warn("⚠️ React fiber not found on submit button"),!1;let o=t[n],r=null;for(let l=0;l<50&&o;l++){if((a=o.memoizedProps)!=null&&a.onClick){r=o.memoizedProps.onClick;break}o=o.return}if(!r)return console.warn("⚠️ onClick not found in fiber tree"),!1;const i=document.querySelector('[data-slate-editor="true"]');return i==null||i.focus(),r({isTrusted:!0,type:"click",bubbles:!0,cancelable:!0,target:t,currentTarget:t,nativeEvent:{isTrusted:!0,type:"click",target:t},isDefaultPrevented:()=>!1,isPropagationStopped:()=>!1,preventDefault:()=>{},stopPropagation:()=>{}}),console.log("✅ Submit button clicked via fiber onClick"),!0}console.log("✅ SubmitHandler module loaded");function Xt(e){const{x:t,y:n}=un(e),o={bubbles:!0,cancelable:!0,pointerId:1,pointerType:"mouse",isPrimary:!0,clientX:t,clientY:n};e.dispatchEvent(new PointerEvent("pointerdown",o)),e.dispatchEvent(new PointerEvent("pointerup",o))}function te(e){const{x:t,y:n}=un(e),o={bubbles:!0,cancelable:!0,clientX:t,clientY:n,button:0};e.dispatchEvent(new MouseEvent("mousedown",o)),e.dispatchEvent(new MouseEvent("mouseup",o)),e.dispatchEvent(new MouseEvent("click",o))}function je(e){return e.getAttribute("data-state")==="active"?!1:(te(e),!0)}function Ko(e){const t=e.getBoundingClientRect(),n=(Math.random()-.5)*t.width*.6,o=(Math.random()-.5)*t.height*.6,r=t.left+t.width/2+n,i=t.top+t.height/2+o;console.log(`🎯 Stealth click at (${Math.round(r)}, ${Math.round(i)}) — offset (${Math.round(n)}px, ${Math.round(o)}px)`);const a={bubbles:!0,cancelable:!0,view:window,clientX:r,clientY:i,screenX:window.screenX+r,screenY:window.screenY+i,button:0};e.dispatchEvent(new PointerEvent("pointerdown",{...a,isPrimary:!0,buttons:1})),e.dispatchEvent(new MouseEvent("mousedown",{...a,buttons:1})),e.dispatchEvent(new PointerEvent("pointerup",{...a,isPrimary:!0,buttons:0})),e.dispatchEvent(new MouseEvent("mouseup",{...a,buttons:0})),e.dispatchEvent(new PointerEvent("click",{...a,isPrimary:!0})),e.dispatchEvent(new MouseEvent("click",a))}console.log("✅ ClickHelper module loaded");let Ue=null,_t=null;function jo(e,t){Ue=e,_t=t,console.log("✅ SettingsApplicator initialized")}const Bo={default:"Veo 3.1 - Fast",veo3_fast:"Veo 3.1 - Fast",veo3_quality:"Veo 3.1 - Quality",veo2_fast:"Veo 2 - Fast",veo2_quality:"Veo 2 - Quality",veo3_fast_low:"Veo 3.1 - Fast",nano_banana_pro:"Nano Banana Pro",nano_banana2:"Nano Banana 2",nano_banana:"Nano Banana 2"};function Ho(e,t){return!e||!t?!1:e.count===t.count&&e.model===t.model&&e.aspectRatio===t.aspectRatio&&e.taskType===t.taskType&&e.videoSubMode===t.videoSubMode}async function Wo(e="createvideo",t={}){try{const n=Ue?Ue():{};if(!n.isProcessing&&!n.isPausing)return console.log("⏸️ Settings application cancelled — processing stopped"),!1;const o=(t==null?void 0:t.count)||"1",r=(t==null?void 0:t.model)||"default",i=(t==null?void 0:t.aspectRatio)||"landscape",a=(t==null?void 0:t.videoSubMode)||"frames",l=e==="createimage",u=l?"image":"videocam",c=l?"Image":"Video",d={count:o,model:r,aspectRatio:i,taskType:e,videoSubMode:a};if(n.lastAppliedSettings&&Ho(d,n.lastAppliedSettings))return console.log("⏩ Settings unchanged from previous task — SKIPPING (~5s saved)"),!0;console.log(`⚙️ Applying settings: type=${e}, count=${o}, model=${r}, ratio=${i}, subMode=${l?"n/a":a}`);const s=L("//button[@aria-haspopup='menu' and .//div[@data-type='button-overlay'] and text()[normalize-space() != '']]");if(!s)return console.warn("⚠️ Main settings trigger button not found"),!1;if(Xt(s),console.log("✅ Step 1: Opened main control panel"),await p(600),!document.querySelector('[role="menu"][data-state="open"]'))return console.warn("⚠️ Control panel menu did not open"),!1;const w=L(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${u}']]`);if(w?je(w)?(console.log(`✅ Step 2: Selected output type: ${c}`),await p(400)):console.log(`⏩ Step 2: Output type already: ${c}`):console.warn(`⚠️ Output type tab "${c}" not found`),Be())return H(),!1;if(l)console.log("⏩ Step 3: Skipped (image task — no sub-mode)");else{const $=a==="ingredients"?"chrome_extension":"crop_free",I=a==="ingredients"?"Ingredients":"Frames",Y=L(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${$}']]`);Y?je(Y)?(console.log(`✅ Step 3: Selected video sub-mode: ${I}`),await p(300)):console.log(`⏩ Step 3: Sub-mode already: ${I}`):console.warn(`⚠️ Sub-mode tab "${I}" not found`)}if(Be())return H(),!1;const T={landscape:{icon:"crop_16_9",label:"Landscape"},widescreen:{icon:"crop_landscape",label:"Widescreen"},square:{icon:"crop_square",label:"Square"},tallscreen:{icon:"crop_portrait",label:"Tall"},portrait:{icon:"crop_9_16",label:"Portrait"}},E=T[i]||T.landscape,O=E.icon,D=E.label,U=L(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${O}']]`);if(U?je(U)?(console.log(`✅ Step 4: Selected aspect ratio: ${D}`),await p(300)):console.log(`⏩ Step 4: Aspect ratio already: ${D}`):console.warn(`⚠️ Aspect ratio tab "${D}" not found`),Be())return H(),!1;const P=`x${o}`,N=L(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and normalize-space(text())='${P}']`);if(N?je(N)?(console.log(`✅ Step 5: Selected count: ${P}`),await p(300)):console.log(`⏩ Step 5: Count already: ${P}`):console.warn(`⚠️ Count tab "${P}" not found`),Be())return H(),!1;const B=Bo[r]||(l?"Nano Banana Pro":"Veo 3.1 - Fast"),ne=L("//div[@role='menu' and @data-state='open']//button[@aria-haspopup='menu' and .//div[@data-type='button-overlay']]");if(!ne)console.warn("⚠️ Model dropdown trigger not found inside control panel");else{Xt(ne),console.log("✅ Step 6a: Opened model dropdown"),await p(500);const $=L(`//div[@role='menuitem']//button[.//span[contains(normalize-space(text()),'${B}')]]`);$?($.click(),console.log(`✅ Step 6b: Selected model: ${B}`),await p(400)):(console.warn(`⚠️ Model option "${B}" not found`),H(),await p(300))}return H(),await p(600),console.log("✅ Step 7: Control panel closed"),_t&&(_t({lastAppliedSettings:d,lastAppliedMode:e}),console.log("💾 Settings cached for next task comparison")),!0}catch(n){return console.error("❌ Error applying unified Flow settings:",n),H(),!1}}function Be(){const e=Ue?Ue():{};return!e.isProcessing&&!e.isPausing}console.log("✅ SettingsApplicator module loaded");let Ne=null;const Xo=500,Qt=3e3,Tn=8e3,Qo=15e3,Zo=8e3,Jo=300,er=5e3;function tr(e){Ne=e,console.log("✅ ImageUploader initialized")}function wt(){var t;return((t=(Ne?Ne():{}).settings)==null?void 0:t.stealthMode)===!0}function nr(e){return Math.round(e*(.7+Math.random()*.6))}async function re(e){const t=wt()?nr(e):e;return p(t)}function ct(e){wt()?Ko(e):e.click()}async function kn(e,t){const n=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;if(wt()){const o=100+Math.random()*300;console.log(`🥷 Stealth: Input think pause ${Math.round(o)}ms before setting "${t}"...`),await p(o)}e.focus(),n.call(e,t),e.dispatchEvent(new Event("input",{bubbles:!0}))}async function or(){const e=document.querySelectorAll("button");let t=null;for(const n of e){const o=n.querySelector("i.google-symbols");if(o&&o.textContent.trim()==="close"&&n.querySelector("span")){t=n;break}}return t?(ct(t),console.log("🧹 ImageUploader Pre-flight: Clicked clear-references button — all attached references cleared"),await re(300),!0):(console.log("✅ ImageUploader Pre-flight: No attached references found — input area is clean"),!1)}async function rr(e){if(!e||e.length===0)return console.warn("⚠️ ImageUploader.uploadAllImages: No images provided"),!1;console.log(`📤 ImageUploader Phase 1: Batch-checking ${e.length} file(s) in library (single picker session)...`);const t=e.map((a,l)=>a.name||`reference_${l+1}.jpg`),n=await sr(t),o=e.length-n.size;let r=!1,i=0;for(let a=0;a<e.length;a++){if(_n())return console.log("⏸️ ImageUploader: Processing stopped during file injection"),!1;const l=e[a],u=t[a],c=l.mimeType||"image/jpeg";if(n.has(u)){console.log(`⏩ ImageUploader Phase 1 [${a+1}/${e.length}]: "${u}" already in library — skipping upload`);continue}console.log(`📤 ImageUploader Phase 1 [${a+1}/${e.length}]: "${u}" not in library — uploading...`);const d=document.querySelector('input[type="file"][accept*="image"]');if(!d)return console.warn(`⚠️ ImageUploader Phase 1: File input not found for "${u}"`),!1;const s=dr(l.data,u,c);if(!s)return console.warn(`⚠️ ImageUploader Phase 1: Failed to convert "${u}" to File object`),!1;const g=new DataTransfer;g.items.add(s),d.files=g.files,d.dispatchEvent(new Event("change",{bubbles:!0})),console.log(`✅ ImageUploader Phase 1 [${a+1}/${e.length}]: "${u}" injected (${(s.size/1024).toFixed(1)} KB)`),r=!0,i++,i<o&&await re(Xo)}return r?(console.log(`⏳ ImageUploader Phase 1 complete — waiting ${Qt/1e3}s for uploads to settle...`),await p(Qt)):console.log("⏩ ImageUploader Phase 1 complete — all images already in library, no settle wait needed"),!0}async function ir(e,t="ingredients"){if(!e||e.length===0)return console.warn("⚠️ ImageUploader.attachAllImages: No images provided"),!1;console.log(`🔗 ImageUploader Phase 2: Attaching ${e.length} image(s) as references [${t}]...`);for(let n=0;n<e.length;n++){if(_n())return console.log("⏸️ ImageUploader: Processing stopped during reference attachment"),!1;const r=e[n].name||`reference_${n+1}.jpg`,i=n;if(console.log(`🔗 ImageUploader Phase 2 [${n+1}/${e.length}]: Attaching "${r}" [${t}${t==="frames"?`/${i===0?"Start":"End"}`:""}]...`),!await ar(r,t,i))return console.error(`❌ ImageUploader Phase 2: Failed to attach "${r}"`),!1;console.log(`✅ ImageUploader Phase 2 [${n+1}/${e.length}]: "${r}" attached successfully`)}return console.log(`✅ ImageUploader Phase 2 complete — all ${e.length} image(s) attached`),!0}async function ar(e,t,n){const o=wt(),r=lr(t,n);if(!r)return console.warn(`⚠️ ImageUploader: ${t==="frames"?`Frames ${n===0?"Start":"End"} frame div`:"add_2 button"} trigger not found`),!1;ct(r),console.log(`✅ ImageUploader: Clicked trigger (${t}${t==="frames"?`/${n===0?"Start":"End"}`:""})`);const i=await gt('[role="dialog"][data-state="open"]',Tn);if(!i)return console.warn("⚠️ ImageUploader: Asset picker popover did not open"),!1;console.log("✅ ImageUploader: Asset picker popover opened"),await re(400);const a=i.querySelector('input[type="text"]');if(!a)return console.warn("⚠️ ImageUploader: Search input not found in popover"),Ee(),!1;await kn(a,e),console.log(`🔍 ImageUploader: Searching for "${e}"${o?" (stealth paste)":""}...`);const l=await In(e,Qo);if(!l)return console.warn(`⚠️ ImageUploader: Search result for "${e}" not found (upload may not have completed yet)`),Ee(),!1;console.log(`✅ ImageUploader: Found search result for "${e}"`);const u=l.parentElement;return u?(o&&await p(150+Math.random()*200),ct(u),console.log(`✅ ImageUploader: Clicked result row for "${e}"`),await cr(Zo)?console.log("✅ ImageUploader: Popover closed — image attached as reference"):(console.warn("⚠️ ImageUploader: Popover did not close after clicking result — forcing close"),Ee(),await re(300)),await re(500),!0):(console.warn("⚠️ ImageUploader: Result row parent not found"),Ee(),!1)}async function sr(e){const t=new Set;if(!e||e.length===0)return t;const n=L("//button[.//i[normalize-space(text())='add_2']]");if(!n)return console.warn("⚠️ ImageUploader library check: add_2 trigger not found — assuming all images need upload"),t;ct(n);const o=await gt('[role="dialog"][data-state="open"]',Tn);if(!o)return console.warn("⚠️ ImageUploader library check: Popover did not open — assuming all images need upload"),t;await re(300);const r=o.querySelector('input[type="text"]');if(!r)return console.warn("⚠️ ImageUploader library check: Search input not found — closing picker"),Ee(),t;for(let i=0;i<e.length;i++){const a=e[i];await kn(r,a),console.log(`🔍 ImageUploader library check [${i+1}/${e.length}]: Searching for "${a}"...`),await re(300),await In(a,er)?(console.log(`✅ ImageUploader library check [${i+1}/${e.length}]: "${a}" found in library`),t.add(a)):console.log(`📭 ImageUploader library check [${i+1}/${e.length}]: "${a}" not in library — will upload`),i<e.length-1&&await re(200)}return Ee(),await re(400),console.log(`📊 ImageUploader library check complete: ${t.size}/${e.length} already in library`),t}function lr(e,t){return L(e==="frames"?`//div[@aria-haspopup='dialog' and normalize-space(text())='${t===0?"Start":"End"}']`:"//button[.//i[normalize-space(text())='add_2']]")}async function In(e,t){const n=Date.now();for(;Date.now()-n<t;){const o=document.querySelector(`[data-testid="virtuoso-item-list"] img[alt="${e}"]`);if(o)return o;await p(Jo)}return null}async function cr(e){const t=Date.now();for(;Date.now()-t<e;){if(!document.querySelector('[role="dialog"][data-state="open"]'))return!0;await p(200)}return!1}function Ee(){document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",keyCode:27,bubbles:!0,cancelable:!0,composed:!0}))}function dr(e,t,n){try{let o=e,r=n;if(e.startsWith("data:")){const[l,u]=e.split(",");o=u;const c=l.match(/:(.*?);/);c&&(r=c[1])}const i=atob(o),a=new Uint8Array(i.length);for(let l=0;l<i.length;l++)a[l]=i.charCodeAt(l);return new File([a],t,{type:r})}catch(o){return console.error("❌ ImageUploader: base64ToFile conversion failed:",o),null}}function _n(){const e=Ne?Ne():{};return!e.isProcessing&&!e.isPausing}console.log("✅ ImageUploader module loaded");function Ae(e,t){return[...e.querySelectorAll("i")].some(n=>n.textContent.trim()===t)}const An=[{type:"POLICY_VIOLATION",label:"Prompt flagged by content policy",detect:e=>Ae(e,"warning")?[...e.querySelectorAll("a[href]")].some(n=>{const o=n.getAttribute("href")||"";return o.includes("/faq")||o.includes("/policies")||o.includes("policy")}):!1},{type:"DAILY_LIMIT_MODEL_FALLBACK",label:"Daily generation limit reached — switching to Nano Banana 2",detect:e=>!Ae(e,"warning")||!Ae(e,"refresh")?!1:e.textContent.includes("Nano Banana")},{type:"GENERATION_FAILED",label:"Generation failed — Flow encountered an error",detect:e=>Ae(e,"warning")?Ae(e,"refresh"):!1}],Pn=[];function ur(e,t){const n=[];return document.querySelectorAll("[data-tile-id]").forEach(o=>{const r=o.getAttribute("data-tile-id");if(!(!r||e!=null&&e.has(r)||t!=null&&t.has(r)||o.querySelector('video[src*="media.getMediaUrlRedirect"]')||o.querySelector('img[src*="media.getMediaUrlRedirect"]'))){for(const a of An)if(a.detect(o)){t==null||t.add(r),n.push({tileId:r,type:a.type,label:a.label}),console.warn(`⚠️ ErrorScanner: tile ${r} — ${a.label}`);break}}}),{errorCount:n.length,errors:n}}function fr(){for(const e of Pn)if(e.detect())return console.error(`❌ ErrorScanner: global error — ${e.label} (severity: ${e.severity})`),{found:!0,type:e.type,label:e.label,severity:e.severity};return{found:!1,type:null,label:null,severity:null}}console.log(`✅ ErrorScanner module loaded — ${An.length} tile pattern(s), ${Pn.length} global pattern(s)`);let G=null,Qe=null,ze=null,b=null,y=null,Ze=null,Je=null,dt=[],At=!1;function Mn({getState:e,setState:t,getSelectors:n,eventBus:o,stateManager:r}){G=e,Qe=t,ze=n,b=o,y=r,o.on(f.PROCESSING_TERMINATE,()=>{Ie(),fe(),Ft()}),console.log("✅ MonitoringExport initialized")}function pr(){const e=new Set;return document.querySelectorAll("[data-tile-id]").forEach(t=>{const n=t.getAttribute("data-tile-id");n&&e.add(n)}),console.log(`📸 Tile snapshot: ${e.size} existing tile(s)`),e}function Cn(e){const t=!!e.querySelector('video[src*="media.getMediaUrlRedirect"]'),n=!!e.querySelector('img[src*="media.getMediaUrlRedirect"]');return t||n}function Rn(e){return!!e.querySelector("video")}function Ln(e){const t=[],n=new Set;return document.querySelectorAll("[data-tile-id]").forEach(o=>{const r=o.getAttribute("data-tile-id");!r||n.has(r)||(n.add(r),!(e&&e.has(r))&&Cn(o)&&t.push({tileId:r,tileEl:o,isVideo:Rn(o)}))}),t}function mr(e,t){const n=[...e.querySelectorAll('button[role="menuitem"], button')];if(n.length===0)return null;const o=n.map(i=>{var c;const l=((c=i.querySelectorAll("span")[0])==null?void 0:c.textContent.trim())||i.textContent.trim(),u=i.getAttribute("aria-disabled")!=="true";return{btn:i,label:l,enabled:u}}),r=o.filter(i=>i.enabled);if(t){const i=o.find(a=>a.label===t);if(i){if(i.enabled)return console.log(`⬇️ Download quality: "${i.label}" (selected)`),i.btn;console.warn(`⚠️ "${t}" is locked (aria-disabled). Falling back to best available.`)}else console.warn(`⚠️ Quality "${t}" not found in sub-menu. Falling back.`)}if(r.length>0){const i=r[r.length-1];return console.log(`⬇️ Download quality fallback: "${i.label}" (best available)`),i.btn}return console.warn("⚠️ All quality options disabled — clicking first button as last resort"),n[0]}async function On(e,t=null){try{const n=e.querySelector('video[src*="media.getMediaUrlRedirect"]')||e.querySelector('img[src*="media.getMediaUrlRedirect"]');if(!n)return console.warn("⚠️ No media element found in tile for download"),!1;const o=n.getBoundingClientRect(),r=o.left+o.width/2,i=o.top+o.height/2;n.dispatchEvent(new MouseEvent("mouseenter",{bubbles:!0,clientX:r,clientY:i})),n.dispatchEvent(new MouseEvent("mousemove",{bubbles:!0,clientX:r,clientY:i})),await p(400),n.dispatchEvent(new MouseEvent("contextmenu",{bubbles:!0,cancelable:!0,clientX:r,clientY:i,button:2})),await p(600);const a=document.querySelector('[data-radix-menu-content][data-state="open"]');if(!a)return console.warn("⚠️ Context menu did not open for tile download"),!1;const l=[...a.querySelectorAll('[role="menuitem"]')].find(s=>{var g;return((g=s.querySelector("i"))==null?void 0:g.textContent.trim())==="download"});if(!l)return console.warn("⚠️ Download menuitem not found in context menu"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;l.click(),await p(600);const u=[...document.querySelectorAll('[data-radix-menu-content][data-state="open"]')],c=u.find(s=>s!==a)||u[u.length-1];if((!c||c===a)&&!([...document.querySelectorAll("[data-radix-popper-content-wrapper]")].flatMap(g=>[...g.querySelectorAll('[role="menuitem"]')]).length>0?document.querySelector("[data-radix-popper-content-wrapper]:last-of-type"):null))return console.warn("⚠️ Quality sub-menu did not open"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;const d=mr(c,t);return d?(d.click(),await p(300),console.log("✅ Download triggered via UI"),!0):(console.warn("⚠️ No quality button found in sub-menu"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1)}catch(n){return console.error("❌ Error in downloadTileViaUI:",n),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1}}async function gr(){if(!At){for(At=!0;dt.length>0;){const{tileEl:e,targetQuality:t,label:n}=dt.shift();console.log(`⬇️ Download runner: processing "${n}" (quality: ${t??"default"})`),await On(e,t),await p(500)}Ft(),console.log("✅ Download runner: queue empty, state reset")}}const Zt={image:{stall:3e4,zeroTiles:6e4},video:{stall:9e4,zeroTiles:18e4}};async function Dn(){var t,n,o,r,i,a,l,u,c,d;const e=G?G():{};if(!(!e.isProcessing&&!e.isPausing))try{const s=(t=e.taskList)==null?void 0:t.find(I=>I.status==="current");if(!s)return;s.foundVideos||(s.foundVideos=0),s.processedTileIds||(s.processedTileIds=new Set),s._scanStartedAt||(s._scanStartedAt=Date.now(),b==null||b.emit(f.OVERLAY_ERROR_BANNER_CLEAR));const g=s.type==="createimage",{stall:w,zeroTiles:T}=g?Zt.image:Zt.video,E=e.preSubmitTileIds||new Set,O=Ln(E);let D=!1;for(const{tileId:I,tileEl:Y,isVideo:J}of O){if(s.processedTileIds.has(I))continue;s.processedTileIds.add(I),s.foundVideos+=1,s._lastFoundAt=Date.now(),D=!0;const S=J?"Video":"Image";if(console.log(`✅ New ${S} detected: tile ${I} (${s.foundVideos}/${s.expectedVideos})`),b==null||b.emit(f.OVERLAY_MESSAGE,`✅ ${S} ${s.foundVideos}/${s.expectedVideos} for Task ${s.index}`),chrome.runtime.sendMessage({action:"updateStatus",status:`${S} ${s.foundVideos}/${s.expectedVideos} captured for Task ${s.index}`}),((n=e.settings)==null?void 0:n.autoDownload)!==!1){const _=J?"videoDownloadQuality":"imageDownloadQuality",he=((o=s.settings)==null?void 0:o[_])||((r=e.settings)==null?void 0:r[_])||(J?"720p":"1K");dt.push({tileEl:Y,targetQuality:he,label:`${S} ${I}`}),gr()}(i=y==null?void 0:y.sendTaskUpdate)==null||i.call(y,s)}const{errorCount:U,errors:P}=ur(E,s.processedTileIds);if(U>0){if(P.every(_=>_.type==="DAILY_LIMIT_MODEL_FALLBACK")){console.warn(`🍌 Task ${s.index}: ALL tile errors are DAILY_LIMIT_MODEL_FALLBACK — triggering Nano Banana 2 fallback`),Ie(),fe(),b==null||b.emit(f.OVERLAY_MESSAGE,`⚠️ Nano Banana Pro daily limit reached — switching to Nano Banana 2 and retrying Task ${s.index}...`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${s.index}: Nano Banana Pro limit hit — switching to Nano Banana 2`}),b==null||b.emit(f.DAILY_LIMIT_FALLBACK,{task:s,taskIndex:e.currentPromptIndex,fallbackModel:"nano_banana2"});return}s.foundVideos+=U,s._lastFoundAt=Date.now(),D=!0;for(const _ of P)console.warn(`⚠️ Tile error counted for task ${s.index}: [${_.type}] ${_.label} (tile ${_.tileId})`);const Y=s.foundVideos,J=s.expectedVideos,S=P.reduce((_,he)=>(_[he.label]=(_[he.label]||0)+1,_),{}),K=Object.entries(S).map(([_,he])=>`• ${he}× ${_}`);b==null||b.emit(f.OVERLAY_ERROR_BANNER,{lines:K,taskIndex:s.index}),b==null||b.emit(f.OVERLAY_MESSAGE,`⚠️ ${U} tile error(s) — ${Y}/${J} resolved`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${s.index}: ${U} error tile(s) — ${JSON.stringify(S)} — ${Y}/${J} resolved`}),(a=y==null?void 0:y.sendTaskUpdate)==null||a.call(y,s)}const N=fr();if(N.found){if(console.error(`❌ Global error: [${N.type}] ${N.label} (severity: ${N.severity})`),b==null||b.emit(f.OVERLAY_MESSAGE,`❌ ${N.label}`),N.severity==="skip_task"&&s.status==="current"){s.status="error",(l=y==null?void 0:y.sendTaskUpdate)==null||l.call(y,s),He(s,e.currentPromptIndex);return}if(N.severity==="pause_processing"){b==null||b.emit(f.PROCESSING_STOP);return}if(N.severity==="terminate"){b==null||b.emit(f.PROCESSING_TERMINATE);return}}const B=Date.now(),ne=s.expectedVideos-s.foundVideos,$=g?"image":"video";if(s.foundVideos>=s.expectedVideos&&s.status==="current"){s.status="processed";const I=s.type==="createimage"?"image(s)":"video(s)";console.log(`✅ Task ${s.index} COMPLETE (${s.foundVideos}/${s.expectedVideos} ${I})`),(u=y==null?void 0:y.sendTaskUpdate)==null||u.call(y,s),He(s,e.currentPromptIndex);return}if(s.foundVideos>0&&s._lastFoundAt&&B-s._lastFoundAt>w&&s.status==="current"){s.status="processed",console.warn(`⚠️ Task ${s.index}: stall timeout — ${s.foundVideos}/${s.expectedVideos} ${$}(s) (${ne} failed)`),b==null||b.emit(f.OVERLAY_MESSAGE,`⚠️ Task ${s.index}: ${s.foundVideos}/${s.expectedVideos} ${$}s — ${ne} failed. Continuing...`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${s.index}: partial (${s.foundVideos}/${s.expectedVideos} ${$}s). Moving on.`}),(c=y==null?void 0:y.sendTaskUpdate)==null||c.call(y,s),He(s,e.currentPromptIndex);return}if(s.foundVideos===0&&s._scanStartedAt&&B-s._scanStartedAt>T&&s.status==="current"){s.status="error";const I=(T/6e4).toFixed(1);console.error(`❌ Task ${s.index}: zero ${$}s after ${I} min. All ${s.expectedVideos} generations failed.`),b==null||b.emit(f.OVERLAY_MESSAGE,`❌ Task ${s.index}: no ${$}s generated after ${I} min. Skipping...`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${s.index}: all ${s.expectedVideos} ${$}(s) failed (${I}min). Skipping.`}),(d=y==null?void 0:y.sendTaskUpdate)==null||d.call(y,s),He(s,e.currentPromptIndex);return}if(s.foundVideos>0&&s._lastFoundAt&&!D){const I=Math.round((B-s._lastFoundAt)/1e3),Y=Math.round((w-(B-s._lastFoundAt))/1e3);I>0&&I%30<5&&console.log(`⏳ Task ${s.index} [${$}]: waiting for ${ne} more — stalled ${I}s, timeout in ${Y}s`)}}catch(s){console.error("❌ Error in periodicTileScanner:",s)}}function hr(){Ie();const e=G?G():{};if(!e.isProcessing&&!e.isPausing)return;const t=e.scanIntervalMs||5e3;console.log(`🔍 Starting tile scanner (every ${t/1e3}s)`),Ze=setInterval(Dn,t)}function Ie(){Ze&&(clearInterval(Ze),Ze=null,console.log("🛑 Tile scanner stopped"))}function Ft(){dt=[],At=!1}function $n(){try{const e=ze?ze():{};return!!L(e.QUEUE_FULL_POPUP_XPATH)}catch(e){return console.warn("⚠️ Error checking for queue full:",e),!1}}function Gt(){try{const e=ze?ze():{};return!!L(e.PROMPT_POLICY_ERROR_POPUP_XPATH)}catch(e){return console.warn("⚠️ Error checking for policy error:",e),!1}}async function br(){await p(2e3);for(let e=0;e<10;e++){if($n())return console.warn("⚠️ Queue is full!"),"QUEUE_FULL";if(Gt())return console.warn("⚠️ Prompt violates policy!"),"POLICY_PROMPT";await p(1e3)}return null}function wr(){fe(),console.log("🔍 Starting error monitoring..."),Je=setInterval(async()=>{var t,n,o,r;const e=G?G():{};if(!e.isProcessing&&!e.isPausing){fe();return}if(Gt()){console.error("❌ Policy error detected during generation!"),fe(),Ie();const i=(t=e.taskList)==null?void 0:t[e.currentPromptIndex];i&&(i.status="error",(n=y==null?void 0:y.sendTaskUpdate)==null||n.call(y,i)),b==null||b.emit(f.OVERLAY_MESSAGE,"⚠️ Policy violation detected. Skipping this prompt..."),chrome.runtime.sendMessage({action:"updateStatus",status:`Policy violation on prompt: "${(r=(o=e.prompts)==null?void 0:o[e.currentPromptIndex])==null?void 0:r.substring(0,30)}..."`}),setTimeout(()=>{(G?G():{}).isProcessing&&(Qe==null||Qe({isCurrentPromptProcessed:!0}),i&&(b==null||b.emit(f.TASK_COMPLETED,{task:i,taskIndex:e.currentPromptIndex})))},3e3)}},2e3)}function fe(){Je&&(clearInterval(Je),Je=null,console.log("🛑 Error monitoring stopped"))}function He(e,t){(G?G():{}).isCurrentPromptProcessed||(Ie(),fe(),setTimeout(()=>{const o=G?G():{};(o.isProcessing||o.isPausing)&&(b==null||b.emit(f.TASK_COMPLETED,{task:e,taskIndex:t}))},500))}console.log("✅ MonitoringExport module loaded (workflow layer, tile-based scanner — video/image/future)");const qn=Object.freeze(Object.defineProperty({__proto__:null,checkForErrorsAfterSubmit:br,checkForPromptPolicyError:Gt,checkForQueueFull:$n,downloadTileViaUI:On,init:Mn,isTileCompleted:Cn,isTileVideo:Rn,periodicTileScanner:Dn,resetDownloadQueue:Ft,scanForNewlyCompletedTiles:Ln,snapshotExistingTileIds:pr,startErrorMonitoring:wr,startTileScanner:hr,stopErrorMonitoring:fe,stopTileScanner:Ie},Symbol.toStringTag,{value:"Module"}));let C=null,R=null,m=null,M=null,q=null;function yr({getState:e,setState:t,eventBus:n,monitoring:o,stateManager:r}){C=e,R=t,m=n,M=o,q=r,n.on(f.DAILY_LIMIT_FALLBACK,({task:i,taskIndex:a,fallbackModel:l})=>{console.warn(`🔄 DAILY_LIMIT_FALLBACK received — switching all tasks to model: ${l}`);const u=C==null?void 0:C();if(!u)return;R==null||R({fallbackModel:l});const c=u.taskList.map(d=>d.status==="pending"||d.status==="current"?{...d,settings:{...d.settings,model:l},processedTileIds:new Set,foundVideos:0,_scanStartedAt:null,_lastFoundAt:null,status:d.index===i.index?"pending":d.status}:d);R==null||R({taskList:c,lastAppliedSettings:null}),console.log(`✅ Model patched to "${l}" on ${c.filter(d=>d.status==="pending"||d.status==="current").length} task(s)`),setTimeout(()=>{const d=C==null?void 0:C();if(!(d!=null&&d.isProcessing)&&!(d!=null&&d.isPausing))return;const s=d.taskList.find(g=>g.index===i.index);s&&(console.log(`🔁 Re-running Task ${s.index} with fallback model "${l}"...`),m==null||m.emit(f.OVERLAY_MESSAGE,`🔁 Retrying Task ${s.index} with Nano Banana 2...`),Yt(s,a))},2e3)}),console.log("✅ TaskRunner initialized")}async function Er(e){if(!e)return{ok:!0,referenceImages:null};try{const t=await chrome.runtime.sendMessage({action:"getQueueTaskReferenceImages",taskId:e});return t!=null&&t.success?{ok:!0,referenceImages:t.referenceImages||null}:{ok:!1,error:(t==null?void 0:t.error)||"Could not load task reference images"}}catch(t){return{ok:!1,error:(t==null?void 0:t.message)||String(t)}}}async function Yt(e,t){var D,U,P,N,B,ne,$,I,Y,J;if(!e){console.error("❌ TaskRunner: No task provided"),m==null||m.emit(f.TASK_ERROR,{task:null,reason:"no_task"});return}const n=e.prompt,o=e.type==="createimage",r=o?"createimage":"createvideo",i=o?"image":"video";R==null||R({currentProcessingPrompt:n,currentTaskStartTime:Date.now()});const a=`Processing ${r} task ${e.index}: "${n==null?void 0:n.substring(0,30)}${(n==null?void 0:n.length)>30?"...":""}"`;console.log(`📌 Task ${e.index} started`),m==null||m.emit(f.OVERLAY_MESSAGE,a);const l=(D=C==null?void 0:C())==null?void 0:D.fallbackModel;l&&((U=e.settings)==null?void 0:U.model)!==l&&(console.log(`🔄 Applying fallback model override: ${((P=e.settings)==null?void 0:P.model)??"default"} → ${l}`),e={...e,settings:{...e.settings,model:l}});try{const S=Array.from(document.querySelectorAll("button")).find(K=>{var _;return((_=K.querySelector("span.content"))==null?void 0:_.textContent.trim())==="Agent"});(S==null?void 0:S.getAttribute("aria-pressed"))==="true"&&(console.warn("⚠️ Agent mode is enabled — disabling before automation..."),S.click(),await p(600),console.log("✅ Agent mode disabled"))}catch(S){console.warn("⚠️ Agent mode check failed:",S.message)}if(console.log(`⚙️ Step 0/4: Applying settings for Task ${e.index} (${r})...`),m==null||m.emit(f.OVERLAY_MESSAGE,`Step 0/4: Applying settings for ${r}...`),await Wo(e.type||"createvideo",e.settings||{}))console.log(`✅ Settings applied: ${r}, ${((N=e.settings)==null?void 0:N.count)||"1"} ${i}(s), ${((B=e.settings)==null?void 0:B.model)||"default"}, ${((ne=e.settings)==null?void 0:ne.aspectRatio)||"landscape"}`);else{const S=C==null?void 0:C();if(!(S!=null&&S.isProcessing)&&!(S!=null&&S.isPausing)){console.log("⏸️ Processing stopped during settings application");return}console.warn("⚠️ Failed to apply settings, continuing anyway...")}await p(500);let c=e.referenceImages||null;if(e.queueTaskId){const S=await Er(e.queueTaskId);if(S.ok)c=S.referenceImages||null;else if(c)console.warn(`⚠️ Reference fetch failed for task ${e.index}; using in-memory fallback: ${S.error}`);else{console.error(`❌ Failed to fetch reference images for task ${e.index}: ${S.error}`),m==null||m.emit(f.TASK_ERROR,{task:e,taskIndex:t,reason:"reference_fetch_failed"});return}}const d=(c==null?void 0:c.mode)||null,s=(($=c==null?void 0:c.images)==null?void 0:$.filter(Boolean))||[];if(s.length>0){if(console.log(`🧹 Step 1.5 pre-flight: Clearing any existing attached references for Task ${e.index}...`),m==null||m.emit(f.OVERLAY_MESSAGE,"Step 1.5/4: Clearing previous references..."),await or(),console.log(`🖼️ Step 1.5a/4: Checking/uploading ${s.length} file(s) into Flow [${d}] for Task ${e.index}...`),m==null||m.emit(f.OVERLAY_MESSAGE,`Step 1.5/4: Uploading ${s.length} reference image(s) to Flow library...`),!await rr(s)){const K=C==null?void 0:C();if(!(K!=null&&K.isProcessing)&&!(K!=null&&K.isPausing)){console.log("⏸️ Processing stopped during file injection");return}console.error("❌ File injection failed — triggering retry"),m==null||m.emit(f.TASK_ERROR,{task:e,taskIndex:t,reason:"image_upload_failed"});return}if(d==="tag")console.log("🏷️ Step 1.5b/4: TAG mode detected — skipping pre-attach; inline @mentions will attach references in Step 2"),m==null||m.emit(f.OVERLAY_MESSAGE,"Step 1.5/4: Reference images uploaded. Will attach via @mentions...");else{if(console.log(`🔗 Step 1.5b/4: Attaching ${s.length} image(s) as references [${d}]...`),m==null||m.emit(f.OVERLAY_MESSAGE,`Step 1.5/4: Attaching ${s.length} reference image(s)...`),!await ir(s,d)){const _=C==null?void 0:C();if(!(_!=null&&_.isProcessing)&&!(_!=null&&_.isPausing)){console.log("⏸️ Processing stopped during reference attachment");return}console.error("❌ Reference attachment failed — triggering retry"),m==null||m.emit(f.TASK_ERROR,{task:e,taskIndex:t,reason:"image_attach_failed"});return}console.log(`✅ All ${s.length} reference image(s) [${d}] uploaded and attached`)}await p(500)}if(console.log(`📝 Step 2/4: Injecting prompt for Task ${e.index}...`),m==null||m.emit(f.OVERLAY_MESSAGE,"Step 2/4: Adding prompt..."),!await _o(n,{referenceMode:d,referenceImages:s})){console.error("❌ Text injection failed — triggering retry"),m==null||m.emit(f.TASK_ERROR,{task:e,taskIndex:t,reason:"inject_failed"});return}if(await p(1e3),q==null||q.updateTask(t,{status:"current"}),m==null||m.emit(f.TASK_START,{task:((I=q==null?void 0:q.getCurrentTask)==null?void 0:I.call(q))??e,taskIndex:t}),console.log(`📋 Task ${e.index} status: current`),console.log(`🚀 Step 3/4: Submitting Task ${e.index}...`),m==null||m.emit(f.OVERLAY_MESSAGE,"Step 3/4: Submitting..."),M!=null&&M.snapshotExistingTileIds){const S=M.snapshotExistingTileIds();R==null||R({preSubmitTileIds:S}),console.log(`📸 Pre-submit tile snapshot: ${S.size} existing tile(s)`)}if(!await Go()){console.error("❌ Submit failed — triggering retry"),m==null||m.emit(f.TASK_ERROR,{task:e,taskIndex:t,reason:"submit_failed"});return}console.log(`✅ Submitted prompt: "${n}"`),console.log("🔍 Step 4/4: Monitoring for completion...");const T=o?"Step 4/4: Monitoring image generation...":"Step 4/4: Monitoring video generation...";m==null||m.emit(f.OVERLAY_MESSAGE,T);const E=M!=null&&M.checkForErrorsAfterSubmit?await M.checkForErrorsAfterSubmit():null;if(E==="QUEUE_FULL")return console.warn("⚠️ Queue full — waiting 30 seconds before retry..."),m==null||m.emit(f.OVERLAY_MESSAGE,"Queue is full. Waiting 30 seconds before retry..."),await p(3e4),Yt(e,t);if(E==="POLICY_PROMPT"){console.error("❌ Prompt violates policy — skipping"),m==null||m.emit(f.OVERLAY_MESSAGE,"⚠️ Policy violation detected. Skipping this prompt..."),q==null||q.updateTask(t,{status:"error"}),q==null||q.sendTaskUpdate(e),m==null||m.emit(f.TASK_SKIPPED,{task:e,taskIndex:t,reason:"policy_violation"}),chrome.runtime.sendMessage({action:"updateStatus",status:`Policy violation on prompt: "${n==null?void 0:n.substring(0,30)}..."`}),await p(3e3),R==null||R({isCurrentPromptProcessed:!0}),m==null||m.emit(f.TASK_COMPLETED,{task:e,taskIndex:t});return}console.log("✅ No errors detected, starting tile scanner..."),(Y=M==null?void 0:M.startTileScanner)==null||Y.call(M),(J=M==null?void 0:M.startErrorMonitoring)==null||J.call(M);const O=o?"Generating images... scanning for images":"Generating flow... scanning for videos";console.log(`⏳ ${O}`),m==null||m.emit(f.OVERLAY_MESSAGE,O),R==null||R({currentRetries:0})}console.log("✅ TaskRunner module loaded");let h=null,z=null,k=null,$e=null;const Pt=3,Sr=5e3,xr=15e3;function vr({stateManager:e,eventBus:t,monitoring:n}){h=e,z=t,k=n,t.on(f.QUEUE_NEXT,()=>ut()),t.on(f.TASK_START,kr),t.on(f.TASK_COMPLETED,zn),t.on(f.TASK_SKIPPED,Ir),t.on(f.TASK_ERROR,_r),t.on(f.PROCESSING_STOP,Jt),t.on(f.PROCESSING_TERMINATE,Jt),console.log("✅ QueueController initialized")}function ut(){var r;const e=h.getState();h.setState({isCurrentPromptProcessed:!1});const t=e.taskList.length>0?e.taskList.length:e.prompts.length;if(!e.isProcessing||e.currentPromptIndex>=t){h.setState({isProcessing:!1}),Nn(),z.emit(f.OVERLAY_HIDE),e.currentPromptIndex>=t&&(chrome.runtime.sendMessage({action:"updateStatus",status:"All flow prompts completed successfully!"}),chrome.runtime.sendMessage({action:"resetPageZoom"}).catch(()=>{}),z.emit(f.PAGE_ZOOM_CHANGED,{zoom:1}),(r=h.clearStateFromStorage)==null||r.call(h),z.emit(f.PROCESSING_COMPLETE));return}const n=e.prompts[e.currentPromptIndex]||"",o=n.length>30?n.substring(0,30)+"...":n;z.emit(f.OVERLAY_SHOW,`Processing Flow: "${o}"`),e.currentPromptIndex===0&&(chrome.runtime.sendMessage({action:"setPageZoom",zoomFactor:.75}).catch(()=>{}),z.emit(f.PAGE_ZOOM_CHANGED,{zoom:.75})),chrome.storage.local.get("quotaStatus",i=>{var l,u,c;const a=i.quotaStatus||{canContinue:!0,isPaid:!1};if(a.isPaid){en();return}if(!a.canContinue){h.setState({isProcessing:!1}),z.emit(f.OVERLAY_HIDE);const d=(l=h.getCurrentTask)==null?void 0:l.call(h);d&&((u=h.updateTask)==null||u.call(h,e.currentPromptIndex,{status:"error"}),(c=h.sendTaskUpdate)==null||c.call(h,d)),chrome.runtime.sendMessage({action:"error",error:"Your quota has been depleted. Please upgrade to continue."});return}en()})}async function Tr(){var c,d,s,g,w,T;const e=h.getState();if(!e.isCurrentPromptProcessed)return;(c=k==null?void 0:k.stopTileScanner)==null||c.call(k);const t=e.currentPromptIndex+1,n=e.taskList.length>0?e.taskList.length:e.prompts.length;if(h.setState({currentPromptIndex:t}),Nn(),(d=h.saveStateToStorage)==null||d.call(h),!h.getState().isProcessing){(s=k==null?void 0:k.stopTileScanner)==null||s.call(k),(g=k==null?void 0:k.stopErrorMonitoring)==null||g.call(k),h.setState({isPausing:!1}),z.emit(f.OVERLAY_HIDE),chrome.runtime.sendMessage({action:"updateStatus",status:"Processing paused. Click Resume to continue."});return}const r=((w=e.settings)==null?void 0:w.autoClearCache)??!1,i=((T=e.settings)==null?void 0:T.autoClearCacheInterval)??50;if(r&&t>0&&t%i===0&&t<n){console.log(`🗑️ Auto-clear cache milestone: task ${t}/${n} — sending clearFlowCache (fire-and-forget)`),z.emit(f.OVERLAY_MESSAGE,`🧹 Clearing Flow cache (milestone: task ${t}/${n})...`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${t} complete — clearing Flow cache for performance...`}),chrome.runtime.sendMessage({action:"clearFlowCache"},E=>{chrome.runtime.lastError});return}if(t>=n){console.log("✅ All tasks done — skipping inter-task countdown"),ut();return}const a=h.getState(),l=a.taskList.length>0&&a.currentPromptIndex<a.taskList.length?a.taskList[a.currentPromptIndex]:null,u=h.getRandomDelay?h.getRandomDelay(l,a.settings):xr;z.emit(f.COUNTDOWN_START,{ms:u,label:"next prompt"}),$e=setTimeout(()=>{$e=null,h.getState().isProcessing&&ut()},u)}function Un(){var t,n,o;const e=h.getState();if(e.currentRetries<Pt){h.setState({currentRetries:e.currentRetries+1});const i=`Retry ${h.getState().currentRetries}/${Pt}: Waiting for Flow Labs interface...`;z.emit(f.OVERLAY_MESSAGE,i),chrome.runtime.sendMessage({action:"updateStatus",status:i}),setTimeout(ut,Sr)}else{z.emit(f.OVERLAY_HIDE);const r=(t=h.getCurrentTask)==null?void 0:t.call(h);r&&((n=h.updateTask)==null||n.call(h,e.currentPromptIndex,{status:"error"}),(o=h.sendTaskUpdate)==null||o.call(h,r)),chrome.runtime.sendMessage({action:"error",error:"Unable to find Flow Labs interface elements after multiple attempts. Make sure you are on the correct page."}),h.setState({isProcessing:!1})}}function Nn(){const e=h.getState(),t=Math.min(e.currentPromptIndex,e.prompts.length);(e.isProcessing||e.isPausing)&&z.emit(f.PROGRESS_UPDATE,{currentIndex:t}),chrome.runtime.sendMessage({action:"updateProgress",currentPrompt:t<e.prompts.length?e.prompts[t]:"",processed:t,total:e.prompts.length})}function kr({task:e}){e!=null&&e.queueTaskId&&chrome.runtime.sendMessage({action:"taskStatusUpdate",taskId:e.queueTaskId,status:"current"}).catch(()=>{})}function zn({task:e,taskIndex:t}){var o,r,i,a;const n=h.getState();n.isCurrentPromptProcessed||(console.log(`✅ Queue: Task ${e==null?void 0:e.index} completed — moving to next`),e!=null&&e.queueTaskId&&chrome.runtime.sendMessage({action:"taskStatusUpdate",taskId:e.queueTaskId,status:"processed"}).catch(()=>{}),z.emit(f.OVERLAY_MESSAGE,`✅ All outputs captured for Task ${e==null?void 0:e.index}`),chrome.runtime.sendMessage({action:"updateStatus",status:`All outputs captured for prompt: "${(r=(o=n.prompts)==null?void 0:o[n.currentPromptIndex])==null?void 0:r.substring(0,30)}..."`}),h.setState({isCurrentPromptProcessed:!0,currentProcessingPrompt:null}),(i=k==null?void 0:k.stopTileScanner)==null||i.call(k),(a=k==null?void 0:k.stopErrorMonitoring)==null||a.call(k),setTimeout(()=>{const l=h.getState();(l.isProcessing||l.isPausing)&&Tr()},1e3))}function Ir({task:e,taskIndex:t}){e!=null&&e.queueTaskId&&chrome.runtime.sendMessage({action:"taskStatusUpdate",taskId:e.queueTaskId,status:"processed"}).catch(()=>{}),zn({task:e,taskIndex:t})}function _r({task:e,taskIndex:t,reason:n}){console.warn(`⚠️ Queue: Task ${e==null?void 0:e.index} error — reason: ${n}`),h.getState().currentRetries>=Pt-1&&(e!=null&&e.queueTaskId)&&chrome.runtime.sendMessage({action:"taskStatusUpdate",taskId:e.queueTaskId,status:"error"}).catch(()=>{}),Un()}function Jt(){var e;$e!==null&&(clearTimeout($e),$e=null,console.log("⏹️ QueueController: inter-task delay cancelled")),(e=h.clearCountdownTimer)==null||e.call(h)}function en(){var n;const e=h.getState(),t=(n=h.getCurrentTask)==null?void 0:n.call(h);if(!t){console.error("❌ QueueController: No task at current index"),Un();return}Yt(t,e.currentPromptIndex)}console.log("✅ QueueController module loaded");let Vn=null,tn=null,Ve=null,Mt=null,Z=1;function Ar(e,t){e.getState,e.setState,Vn=e.clearCountdownTimer,tn=e,t.on(f.OVERLAY_SHOW,n=>Dr(n)),t.on(f.OVERLAY_HIDE,()=>$r()),t.on(f.OVERLAY_MESSAGE,n=>nn(n)),t.on(f.OVERLAY_PAUSING,()=>qr()),t.on(f.OVERLAY_ERROR_BANNER,n=>Ur(n)),t.on(f.OVERLAY_ERROR_BANNER_CLEAR,()=>Yn()),t.on(f.PAGE_ZOOM_CHANGED,({zoom:n})=>{Pr(n)}),t.on(f.COUNTDOWN_START,({ms:n,label:o})=>{tn.startCountdown(n,o)}),t.on(f.PROGRESS_UPDATE,({currentIndex:n})=>{nn(void 0)}),console.log("✅ OverlayManager module initialized")}function Pr(e){Z=e||1;const t=Z>0?1/Z:1;["flow-status-toast","flow-click-notice","flow-click-blocker","flow-glow-top","flow-glow-bottom","flow-glow-left","flow-glow-right"].forEach(o=>{const r=document.getElementById(o);r&&(r.style.zoom=t)})}function Fn(){if(document.getElementById("flow-overlay-styles"))return;const e=document.createElement("style");e.id="flow-overlay-styles",e.textContent=`
    /* ── Edge glow animations ── */
    @keyframes flowGlowPulse {
      0%, 100% { opacity: 0.55; }
      50%       { opacity: 1;    }
    }
    @keyframes flowGlowPulseAmber {
      0%, 100% { opacity: 0.45; }
      50%       { opacity: 0.9;  }
    }

    /* ── Toast slide-up ── */
    @keyframes flowToastIn {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    @keyframes flowToastOut {
      from { opacity: 1; transform: translateY(0)    scale(1);    }
      to   { opacity: 0; transform: translateY(10px) scale(0.97); }
    }

    /* ── Click notice fade ── */
    @keyframes flowNoticeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
    @keyframes flowNoticeOut {
      from { opacity: 1; }
      to   { opacity: 0; }
    }

    /* ── Pausing spinner ── */
    @keyframes flowSpin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .flow-spin { animation: flowSpin 1s linear infinite; }

    /* ── Glow edge bars ── */
    .flow-glow-edge {
      position: fixed;
      z-index: 999999997;
      pointer-events: none;
      transition: background 0.6s ease, opacity 0.4s ease;
    }
    .flow-glow-top    { top: 0;    left: 0; right: 0;  height: 1px; }
    .flow-glow-bottom { bottom: 0; left: 0; right: 0;  height: 1px; }
    .flow-glow-left   { top: 0;    left: 0; bottom: 0; width:  1px; }
    .flow-glow-right  { top: 0;    right:0; bottom: 0; width:  1px; }

    .flow-glow-running {
      background: transparent;
      box-shadow: 0 0 22px 8px rgba(59,130,246,0.7), 0 0 50px 16px rgba(59,130,246,0.3);
      animation: flowGlowPulse 2s ease-in-out infinite;
    }

    .flow-glow-pausing {
      background: transparent;
      box-shadow: 0 0 22px 8px rgba(245,158,11,0.7), 0 0 50px 16px rgba(245,158,11,0.3);
      animation: flowGlowPulseAmber 1.4s ease-in-out infinite;
    }
  `,document.head.appendChild(e)}function Mr(){if(document.getElementById("flow-glow-top"))return;const e=[{id:"flow-glow-top",cls:"flow-glow-top"},{id:"flow-glow-bottom",cls:"flow-glow-bottom"},{id:"flow-glow-left",cls:"flow-glow-left"},{id:"flow-glow-right",cls:"flow-glow-right"}],t=Z>0?1/Z:1;for(const{id:n,cls:o}of e){const r=document.createElement("div");r.id=n,r.className=`flow-glow-edge ${o} flow-glow-running`,r.style.zoom=t,document.body.appendChild(r)}}function Cr(){["flow-glow-top","flow-glow-bottom","flow-glow-left","flow-glow-right"].forEach(e=>{var t;return(t=document.getElementById(e))==null?void 0:t.remove()})}function Rr(e){const t=e==="pausing"?"flow-glow-pausing":"flow-glow-running",n=e==="pausing"?"flow-glow-running":"flow-glow-pausing";["flow-glow-top","flow-glow-bottom","flow-glow-left","flow-glow-right"].forEach(o=>{const r=document.getElementById(o);r&&(r.classList.remove(n),r.classList.add(t))})}function Lr(){if(document.getElementById("flow-click-blocker"))return;const e=document.createElement("div");e.id="flow-click-blocker",e.style.cssText=`
    position: fixed;
    inset: 0;
    z-index: 999999998;
    background: transparent;
    cursor: not-allowed;
  `,e.style.zoom=Z>0?1/Z:1,e.addEventListener("click",Gn),document.body.appendChild(e)}function Or(){const e=document.getElementById("flow-click-blocker");e&&(e.removeEventListener("click",Gn),e.remove())}function Gn(){let e=document.getElementById("flow-click-notice");e?(e.style.animation="none",e.offsetHeight,e.style.animation="flowNoticeIn 0.2s ease forwards"):(e=document.createElement("div"),e.id="flow-click-notice",e.style.cssText=`
      position: fixed;
      top: 18px;
      left: 0;
      right: 0;
      margin-left: auto;
      margin-right: auto;
      width: fit-content;
      z-index: 999999999;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(8px);
      color: #e2e8f0;
      font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 500;
      padding: 7px 14px;
      border-radius: 20px;
      border: 1px solid rgba(99,102,241,0.35);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 7px;
      white-space: nowrap;
      pointer-events: none;
      animation: flowNoticeIn 0.2s ease forwards;
    `,e.innerHTML=`
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Automation in progress — interaction blocked
    `,e.style.zoom=Z>0?1/Z:1,document.body.appendChild(e)),clearTimeout(Mt),Mt=setTimeout(()=>{const t=document.getElementById("flow-click-notice");t&&(t.style.animation="flowNoticeOut 0.3s ease forwards",setTimeout(()=>t==null?void 0:t.remove(),300))},1800)}function yt(e,t="status"){Fn();let n=document.getElementById("flow-status-toast");const o=!n;o&&(n=document.createElement("div"),n.id="flow-status-toast",n.style.cssText=`
      position: fixed;
      bottom: 20px;
      left: 0;
      right: 0;
      margin-left: auto;
      margin-right: auto;
      width: fit-content;
      max-width: 480px;
      min-width: 200px;
      z-index: 999999999;
      font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif;
      font-size: 12.5px;
      font-weight: 500;
      padding: 9px 16px;
      border-radius: 22px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
      pointer-events: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      animation: flowToastIn 0.25s cubic-bezier(0.25,0.8,0.25,1) forwards;
    `,n.style.zoom=Z>0?1/Z:1,document.body.appendChild(n));const r={status:{bg:"rgba(15, 23, 42, 0.90)",border:"rgba(99,102,241,0.30)",color:"#e2e8f0",dot:"#6366f1"},error:{bg:"rgba(30, 10, 5, 0.92)",border:"rgba(234,88,12,0.35)",color:"#fed7aa",dot:"#f97316"},pausing:{bg:"rgba(30, 20, 5, 0.92)",border:"rgba(245,158,11,0.35)",color:"#fde68a",dot:"#f59e0b"}},i=r[t]||r.status;n.style.background=i.bg,n.style.border=`1px solid ${i.border}`,n.style.color=i.color,n.style.backdropFilter="blur(10px)",o||(n.style.animation="none",n.offsetHeight,n.style.animation="flowToastIn 0.2s cubic-bezier(0.25,0.8,0.25,1) forwards");const a=`<span style="
    width:7px; height:7px; border-radius:50%;
    background:${i.dot}; flex-shrink:0;
    box-shadow: 0 0 6px ${i.dot};
  "></span>`,l=t==="pausing"?`
    <svg class="flow-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"
         stroke="${i.dot}" stroke-width="2.5" stroke-linecap="round">
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9
               m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>`:a;n.innerHTML=`${l}<span style="overflow:hidden;text-overflow:ellipsis">${e}</span>`,clearTimeout(Ve),t==="status"&&(Ve=setTimeout(()=>Kt(),8e3))}function Kt(){clearTimeout(Ve);const e=document.getElementById("flow-status-toast");e&&(e.style.animation="flowToastOut 0.25s ease forwards",setTimeout(()=>e==null?void 0:e.remove(),260))}function Dr(e){Fn(),Mr(),Lr(),e&&yt(e,"status")}function $r(){var e;Vn(),Cr(),Or(),Kt(),(e=document.getElementById("flow-click-notice"))==null||e.remove(),clearTimeout(Mt)}function nn(e){e&&document.getElementById("flow-glow-top")&&yt(e,"status")}function qr(){Rr("pausing"),yt("Pausing — waiting for current task to finish...","pausing"),clearTimeout(Ve)}function Ur({lines:e=[],taskIndex:t="?"}={}){if(!document.getElementById("flow-glow-top"))return;Yn();const n=e.length>0?e[0]:"Some generations failed",o=`⚠ Task ${t}: ${n}${e.length>1?` (+${e.length-1} more)`:""}`;yt(o,"error"),clearTimeout(Ve)}function Yn(){Kt()}console.log("✅ OverlayManager module loaded");let le=!1,Q=new Set,xe=null,ft=null,Kn="1K",jn="720p",pe=!1,X=!1,ce=!1,Ce=[],ve=null;const Fe="cdm-control-panel",Ct="cdm-styles",Te="cdm-tile-overlay",ue=e=>new Promise(t=>setTimeout(t,e));function Nr(e){const t=!!e.querySelector('video[src*="media.getMediaUrlRedirect"]'),n=!!e.querySelector('img[src*="media.getMediaUrlRedirect"]');return t||n}function Bn(e){return!!e.querySelector("video")}function me(){const e=[],t=new Set;return document.querySelectorAll("[data-tile-id]").forEach(n=>{const o=n.getAttribute("data-tile-id");!o||t.has(o)||(t.add(o),Nr(n)&&e.push({tileId:o,tileEl:n,isVideo:Bn(n)}))}),e}function zr(){if(document.getElementById(Ct))return;const e=document.createElement("style");e.id=Ct,e.textContent=`
    /* ── Tile checkbox overlay ──────────────────── */
    /* isolation: isolate on the tile itself creates a self-contained stacking
       context — all z-index values inside the tile are scoped within it, so
       the selection ring never paints over sibling page elements (e.g. textarea) */
    [data-tile-id].cdm-isolated {
      isolation: isolate;
    }
    .cdm-tile-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 9999;
      pointer-events: none;
    }
    .cdm-tile-overlay.cdm-active {
      pointer-events: all;
      cursor: pointer;
    }
    .cdm-checkbox-wrap {
      position: absolute;
      top: 8px; left: 8px;
      width: 22px; height: 22px;
      z-index: 10001;
      display: flex; align-items: center; justify-content: center;
    }
    .cdm-checkbox {
      width: 18px; height: 18px;
      border-radius: 5px;
      border: 2px solid rgba(255,255,255,0.85);
      background: rgba(15,23,42,0.55);
      backdrop-filter: blur(4px);
      appearance: none; -webkit-appearance: none;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
      flex-shrink: 0;
    }
    .cdm-checkbox:checked {
      background: #6366f1;
      border-color: #6366f1;
    }
    .cdm-checkbox:checked::after {
      content: '';
      display: block;
      margin: 2px auto 0 auto;
      width: 5px; height: 9px;
      border-right: 2px solid white;
      border-bottom: 2px solid white;
      transform: rotate(45deg);
    }
    .cdm-checkbox:hover { transform: scale(1.1); border-color: #a5b4fc; }
    .cdm-tile-selected-ring {
      position: absolute;
      inset: 0;
      border: 3px solid #6366f1;
      border-radius: 8px;
      pointer-events: none;
      box-shadow: inset 0 0 0 1px #a5b4fc;
    }
    .cdm-tile-badge {
      position: absolute;
      top: 8px; right: 8px;
      background: rgba(15,23,42,0.70);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      color: #e2e8f0;
      font-family: 'Google Sans', sans-serif;
      pointer-events: none;
      letter-spacing: 0.3px;
    }

    /* ── Control panel ──────────────────────────── */
    @keyframes cdmPanelIn {
      0%   { opacity:0; transform: translateY(16px) scale(0.97); }
      100% { opacity:1; transform: translateY(0)    scale(1); }
    }
    #cdm-control-panel {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      border-radius: 20px;
      padding: 14px 18px;
      min-width: 360px;
      max-width: 92vw;
      min-height: 120px;
      width: 580px;
      box-sizing: border-box;
      resize: none;
      overflow: hidden;
      font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif;
      animation: cdmPanelIn 0.3s cubic-bezier(0.25,0.8,0.25,1) forwards;
      display: flex;
      flex-direction: column;
      gap: 10px;
      user-select: none;
      transition: background 0.25s, border-color 0.25s, box-shadow 0.25s, color 0.25s;
    }

    /* ── DARK theme (default) ───────────────────── */
    #cdm-control-panel.cdm-dark {
      background: linear-gradient(145deg, rgba(15,23,42,0.97), rgba(30,41,59,0.95));
      backdrop-filter: blur(24px);
      border: 1px solid rgba(99,102,241,0.35);
      color: #e2e8f0;
      box-shadow:
        0 24px 60px rgba(0,0,0,0.55),
        0 8px 20px rgba(99,102,241,0.18),
        inset 0 1px 0 rgba(255,255,255,0.07);
    }
    #cdm-control-panel.cdm-dark .cdm-panel-title { color: #e2e8f0; }
    #cdm-control-panel.cdm-dark .cdm-stats       { color: #94a3b8; }
    #cdm-control-panel.cdm-dark .cdm-stat-chip   {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.09);
      color: #cbd5e1;
    }
    #cdm-control-panel.cdm-dark .cdm-stat-chip.cdm-selected {
      background: rgba(99,102,241,0.18);
      border-color: rgba(99,102,241,0.35);
      color: #a5b4fc;
    }
    #cdm-control-panel.cdm-dark .cdm-btn-secondary {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: #cbd5e1;
    }
    #cdm-control-panel.cdm-dark .cdm-btn-secondary:hover {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.22);
      color: #e2e8f0;
    }
    #cdm-control-panel.cdm-dark .cdm-quality-label { color: #64748b; }
    #cdm-control-panel.cdm-dark .cdm-quality-select {
      background-color: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: #e2e8f0;
    }
    #cdm-control-panel.cdm-dark .cdm-quality-select:hover { border-color: rgba(99,102,241,0.5); }
    #cdm-control-panel.cdm-dark #cdm-progress-bar-track { background: rgba(255,255,255,0.08); }
    #cdm-control-panel.cdm-dark #cdm-progress-label     { color: #94a3b8; }

    /* ── LIGHT theme ──────────────────────────────── */
    #cdm-control-panel.cdm-light {
      background: linear-gradient(145deg, rgba(239,246,255,0.97), rgba(219,234,254,0.95));
      backdrop-filter: blur(24px);
      border: 1px solid rgba(99,102,241,0.25);
      color: #1e3a5f;
      box-shadow:
        0 24px 60px rgba(59,130,246,0.12),
        0 8px 20px rgba(99,102,241,0.10),
        inset 0 1px 0 rgba(255,255,255,0.80);
    }
    #cdm-control-panel.cdm-light .cdm-panel-title { color: #1e3a5f; }
    #cdm-control-panel.cdm-light .cdm-panel-title-icon {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
    }
    #cdm-control-panel.cdm-light .cdm-stats       { color: #475569; }
    #cdm-control-panel.cdm-light .cdm-stat-chip   {
      background: rgba(99,102,241,0.08);
      border: 1px solid rgba(99,102,241,0.18);
      color: #334155;
    }
    #cdm-control-panel.cdm-light .cdm-stat-chip.cdm-selected {
      background: rgba(99,102,241,0.15);
      border-color: rgba(99,102,241,0.35);
      color: #4338ca;
    }
    #cdm-control-panel.cdm-light .cdm-btn-secondary {
      background: rgba(255,255,255,0.70);
      border: 1px solid rgba(99,102,241,0.20);
      color: #334155;
    }
    #cdm-control-panel.cdm-light .cdm-btn-secondary:hover {
      background: rgba(255,255,255,0.90);
      border-color: rgba(99,102,241,0.40);
      color: #1e293b;
    }
    #cdm-control-panel.cdm-light .cdm-quality-label { color: #64748b; }
    #cdm-control-panel.cdm-light .cdm-quality-select {
      background-color: rgba(255,255,255,0.75);
      border: 1px solid rgba(99,102,241,0.20);
      color: #1e293b;
    }
    #cdm-control-panel.cdm-light .cdm-quality-select:hover { border-color: rgba(99,102,241,0.45); }
    #cdm-control-panel.cdm-light #cdm-progress-bar-track { background: rgba(99,102,241,0.12); }
    #cdm-control-panel.cdm-light #cdm-progress-label     { color: #475569; }
    #cdm-control-panel.cdm-light #cdm-close-btn {
      background: rgba(239,68,68,0.10);
      border: 1px solid rgba(239,68,68,0.22);
      color: #dc2626;
    }
    #cdm-control-panel.cdm-light #cdm-close-btn:hover {
      background: rgba(239,68,68,0.20);
      color: #b91c1c;
    }
    /* Drag cursor anywhere on the panel except interactive elements */
    #cdm-control-panel {
      cursor: grab;
    }
    #cdm-control-panel button,
    #cdm-control-panel select,
    #cdm-control-panel input,
    #cdm-control-panel label,
    #cdm-control-panel a,
    #cdm-resize-handle {
      cursor: auto;
    }
    #cdm-control-panel button { cursor: pointer; }
    #cdm-control-panel select { cursor: pointer; }
    #cdm-control-panel input[type="checkbox"] { cursor: pointer; }
    /* Resize handle — bottom-right corner */
    #cdm-resize-handle {
      position: absolute;
      bottom: 0; right: 0;
      width: 32px; height: 32px;
      cursor: nwse-resize;
      z-index: 10;
      display: flex; align-items: flex-end; justify-content: flex-end;
      padding: 6px;
      border-bottom-right-radius: 20px;
      background: linear-gradient(135deg, transparent 40%, rgba(99,102,241,0.18) 100%);
      transition: background 0.2s;
    }
    #cdm-resize-handle::before {
      content: '';
      position: absolute;
      bottom: 0; right: 0;
      width: 0; height: 0;
      border-style: solid;
      border-width: 0 0 12px 12px;
      border-color: transparent transparent rgba(99,102,241,0.5) transparent;
      border-bottom-right-radius: 20px;
      pointer-events: none;
      transition: border-color 0.2s;
    }
    #cdm-resize-handle svg {
      opacity: 0.55;
      transition: opacity 0.15s, transform 0.15s;
      filter: drop-shadow(0 0 3px rgba(99,102,241,0.6));
    }
    #cdm-resize-handle:hover {
      background: linear-gradient(135deg, transparent 30%, rgba(99,102,241,0.32) 100%);
    }
    #cdm-resize-handle:hover::before {
      border-color: transparent transparent rgba(139,92,246,0.85) transparent;
    }
    #cdm-resize-handle:hover svg {
      opacity: 1;
      transform: scale(1.2);
    }
    /* During drag/resize — disable pointer events inside the page */
    body.cdm-dragging * { pointer-events: none !important; }
    body.cdm-dragging #cdm-control-panel { pointer-events: all !important; cursor: grabbing !important; }
    body.cdm-resizing { cursor: nwse-resize !important; }
    body.cdm-resizing * { pointer-events: none !important; }
    body.cdm-resizing #cdm-control-panel { pointer-events: all !important; }

    /* ── Panel top row ─────────────────────────── */
    #cdm-control-panel .cdm-panel-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
    }
    #cdm-control-panel .cdm-panel-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700;
      color: #e2e8f0; letter-spacing: -0.2px;
    }
    #cdm-control-panel .cdm-panel-title-icon {
      width: 26px; height: 26px; border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(99,102,241,0.4);
    }
    #cdm-close-btn {
      width: 26px; height: 26px; border-radius: 8px;
      background: rgba(248,113,113,0.15);
      border: 1px solid rgba(248,113,113,0.25);
      color: #fca5a5; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; line-height: 1;
      transition: background 0.15s, color 0.15s, border-color 0.15s; flex-shrink: 0;
    }
    #cdm-close-btn:hover { background: rgba(248,113,113,0.30); color: #fecaca; }

    /* ── Stats row ─────────────────────────────── */
    #cdm-control-panel .cdm-stats {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px;
      flex-wrap: wrap;
    }
    #cdm-control-panel .cdm-stat-chip {
      border-radius: 6px; padding: 2px 8px;
      font-size: 11px; font-weight: 600;
    }

    /* ── Controls row ──────────────────────────── */
    #cdm-control-panel .cdm-controls {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    /* Select / Deselect all button */
    .cdm-btn-secondary {
      border-radius: 10px; padding: 6px 12px;
      font-size: 11px; font-weight: 600;
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
      font-family: inherit;
    }

    /* Quality selects */
    .cdm-quality-group {
      display: flex; align-items: center; gap: 6px;
    }
    .cdm-quality-label {
      font-size: 10px; font-weight: 600;
      letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap;
    }
    .cdm-quality-select {
      appearance: none; -webkit-appearance: none;
      border-radius: 8px; padding: 5px 26px 5px 10px;
      font-size: 11px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      transition: border-color 0.15s;
    }
    .cdm-quality-select option { background: #1e293b; color: #e2e8f0; }

    /* Download button */
    #cdm-download-btn {
      margin-left: auto;
      display: flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none; border-radius: 10px;
      padding: 7px 16px;
      font-size: 12px; font-weight: 700; color: white;
      cursor: pointer; font-family: inherit;
      box-shadow: 0 4px 12px rgba(99,102,241,0.35);
      transition: all 0.2s; white-space: nowrap;
    }
    #cdm-download-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(99,102,241,0.45);
    }
    #cdm-download-btn:active:not(:disabled) { transform: scale(0.97); }
    #cdm-download-btn:disabled {
      opacity: 0.5; cursor: not-allowed; transform: none;
    }

    /* ── Progress bar ──────────────────────────── */
    #cdm-progress-wrap {
      display: none;
      flex-direction: column; gap: 6px;
    }
    #cdm-progress-wrap.cdm-visible { display: flex; }
    #cdm-progress-label {
      font-size: 11px; color: #94a3b8; font-weight: 500;
    }
    #cdm-progress-bar-track {
      width: 100%; height: 4px;
      background: rgba(255,255,255,0.08);
      border-radius: 2px; overflow: hidden;
    }
    #cdm-progress-bar-fill {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    /* Pause / Stop controls row — visible only during download */
    #cdm-download-controls {
      display: none;
      align-items: center; gap: 8px;
    }
    #cdm-download-controls.cdm-visible { display: flex; }
    /* Pause button — amber */
    #cdm-pause-btn {
      display: flex; align-items: center; gap: 5px;
      background: rgba(245,158,11,0.15);
      border: 1px solid rgba(245,158,11,0.35);
      color: #fbbf24;
      border-radius: 10px; padding: 5px 12px;
      font-size: 11px; font-weight: 700;
      cursor: pointer; font-family: inherit;
      transition: all 0.15s; white-space: nowrap;
    }
    #cdm-pause-btn:hover {
      background: rgba(245,158,11,0.28);
      border-color: rgba(245,158,11,0.55);
      color: #fde68a;
    }
    #cdm-pause-btn.cdm-paused {
      background: rgba(99,102,241,0.18);
      border-color: rgba(99,102,241,0.40);
      color: #a5b4fc;
    }
    #cdm-pause-btn.cdm-paused:hover {
      background: rgba(99,102,241,0.30);
      color: #c7d2fe;
    }
    /* Stop button — red */
    #cdm-stop-btn {
      display: flex; align-items: center; gap: 5px;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.30);
      color: #f87171;
      border-radius: 10px; padding: 5px 12px;
      font-size: 11px; font-weight: 700;
      cursor: pointer; font-family: inherit;
      transition: all 0.15s; white-space: nowrap;
    }
    #cdm-stop-btn:hover {
      background: rgba(239,68,68,0.25);
      border-color: rgba(239,68,68,0.55);
      color: #fca5a5;
    }
    /* Paused status label */
    #cdm-paused-badge {
      display: none;
      font-size: 10px; font-weight: 700;
      color: #fbbf24;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      animation: cdmPausedPulse 1.2s ease-in-out infinite;
    }
    #cdm-paused-badge.cdm-visible { display: inline; }
    @keyframes cdmPausedPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }

    /* ── Custom scrollbar (shown when panel is resized smaller) ─── */
    #cdm-control-panel::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    #cdm-control-panel::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.04);
      border-radius: 10px;
    }
    #cdm-control-panel::-webkit-scrollbar-thumb {
      background: rgba(99,102,241,0.45);
      border-radius: 10px;
      transition: background 0.2s;
    }
    #cdm-control-panel::-webkit-scrollbar-thumb:hover {
      background: rgba(99,102,241,0.75);
    }
    #cdm-control-panel::-webkit-scrollbar-corner {
      background: transparent;
    }
    /* Firefox */
    #cdm-control-panel {
      scrollbar-width: thin;
      scrollbar-color: rgba(99,102,241,0.45) rgba(255,255,255,0.04);
    }

    /* ── Spinner for download btn ──────────────── */
    @keyframes cdmSpin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .cdm-spinner {
      width: 12px; height: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: cdmSpin 0.7s linear infinite;
      flex-shrink: 0;
    }
  `,document.head.appendChild(e)}function Vr(){if(document.getElementById(Fe))return;const e=document.createElement("div");e.id=Fe,e.innerHTML=`
    <!-- Top row: title + close -->
    <div class="cdm-panel-top">
      <div class="cdm-panel-title">
        <div class="cdm-panel-title-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
        </div>
        <span>Content Download Manager</span>
      </div>
      <button id="cdm-close-btn" title="Close">✕</button>
    </div>

    <!-- Stats row -->
    <div class="cdm-stats" id="cdm-stats">
      <span class="cdm-stat-chip" id="cdm-total-chip">0 tiles</span>
      <span class="cdm-stat-chip cdm-selected" id="cdm-selected-chip">0 selected</span>
    </div>

    <!-- Controls row -->
    <div class="cdm-controls">
      <button class="cdm-btn-secondary" id="cdm-select-all-btn">Select All</button>
      <button class="cdm-btn-secondary" id="cdm-deselect-all-btn">Deselect All</button>
      <button class="cdm-btn-secondary" id="cdm-select-images-btn">Images Only</button>
      <button class="cdm-btn-secondary" id="cdm-select-videos-btn">Videos Only</button>

      <div class="cdm-quality-group">
        <span class="cdm-quality-label">🖼</span>
        <select class="cdm-quality-select" id="cdm-image-quality">
          <option value="1K">1K — Original</option>
          <option value="2K">2K — Upscaled</option>
          <option value="4K">4K — Upscaled</option>
        </select>
      </div>

      <div class="cdm-quality-group">
        <span class="cdm-quality-label">🎬</span>
        <select class="cdm-quality-select" id="cdm-video-quality">
          <option value="270p">270p — GIF</option>
          <option value="720p" selected>720p — Original</option>
          <option value="1080p">1080p — Upscaled</option>
          <option value="4K">4K — Upscaled</option>
        </select>
      </div>

      <button id="cdm-download-btn" disabled>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        <span id="cdm-download-label">Download (0)</span>
      </button>
    </div>

    <!-- Progress bar (hidden until download starts) -->
    <div id="cdm-progress-wrap">
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="cdm-progress-label" style="flex:1;">Downloading 0 / 0…</span>
        <span id="cdm-paused-badge">⏸ Paused</span>
      </div>
      <div id="cdm-progress-bar-track"><div id="cdm-progress-bar-fill"></div></div>
      <!-- Pause / Stop controls — shown during active download -->
      <div id="cdm-download-controls">
        <button id="cdm-pause-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          <span id="cdm-pause-label">Pause</span>
        </button>
        <button id="cdm-stop-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          <span>Stop</span>
        </button>
      </div>
    </div>

    <!-- Resize handle — bottom-right corner -->
    <div id="cdm-resize-handle" title="Drag to resize">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round">
        <line x1="13" y1="1" x2="1"  y2="13"/>
        <line x1="13" y1="6" x2="6"  y2="13"/>
        <line x1="13" y1="10" x2="10" y2="13"/>
      </svg>
    </div>
  `,document.body.appendChild(e),Fr(),Yr(e),Kr(e)}function Fr(){var e,t,n,o,r,i,a,l,u,c;(e=document.getElementById("cdm-close-btn"))==null||e.addEventListener("click",jt),(t=document.getElementById("cdm-select-all-btn"))==null||t.addEventListener("click",()=>{me().forEach(({tileId:d,tileEl:s})=>{et(d,s)}),se()}),(n=document.getElementById("cdm-deselect-all-btn"))==null||n.addEventListener("click",()=>{[...Q].forEach(d=>{const s=document.querySelector(`[data-tile-id="${d}"]`);s&&tt(d,s)}),Q.clear(),se()}),(o=document.getElementById("cdm-select-images-btn"))==null||o.addEventListener("click",()=>{me().forEach(({tileId:d,tileEl:s,isVideo:g})=>{g?tt(d,s):et(d,s)}),se()}),(r=document.getElementById("cdm-select-videos-btn"))==null||r.addEventListener("click",()=>{me().forEach(({tileId:d,tileEl:s,isVideo:g})=>{g?et(d,s):tt(d,s)}),se()}),(i=document.getElementById("cdm-image-quality"))==null||i.addEventListener("change",d=>{Kn=d.target.value}),(a=document.getElementById("cdm-video-quality"))==null||a.addEventListener("change",d=>{jn=d.target.value}),(l=document.getElementById("cdm-download-btn"))==null||l.addEventListener("click",ei),(u=document.getElementById("cdm-pause-btn"))==null||u.addEventListener("click",Wn),(c=document.getElementById("cdm-stop-btn"))==null||c.addEventListener("click",Jr)}const Gr=["button","select","input","textarea","label","a","#cdm-resize-handle","[data-no-drag]"].join(", ");function Yr(e){let t,n,o,r;function i(l){const u=l.clientX-t,c=l.clientY-n;let d=o+u,s=r+c;d=Math.max(0,Math.min(window.innerWidth-e.offsetWidth,d)),s=Math.max(0,Math.min(window.innerHeight-e.offsetHeight,s)),e.style.left=d+"px",e.style.top=s+"px",e.style.bottom="auto",e.style.transform="none"}function a(){e.style.cursor="grab",document.body.classList.remove("cdm-dragging"),document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",a)}e.addEventListener("mousedown",l=>{if(l.target.closest(Gr))return;l.preventDefault();const u=e.getBoundingClientRect();o=u.left,r=u.top,t=l.clientX,n=l.clientY,e.style.left=o+"px",e.style.top=r+"px",e.style.bottom="auto",e.style.transform="none",e.style.cursor="grabbing",document.body.classList.add("cdm-dragging"),document.addEventListener("mousemove",i),document.addEventListener("mouseup",a)})}function Kr(e){const t=e.querySelector("#cdm-resize-handle");if(!t)return;const n=360,o=120;let r,i,a,l,u,c;function d(g){const w=g.clientX-r,T=g.clientY-i,E=Math.max(n,Math.min(window.innerWidth-u,a+w)),O=Math.max(o,Math.min(window.innerHeight-c,l+T));e.style.width=E+"px",e.style.height=O+"px"}function s(){document.body.classList.remove("cdm-resizing"),document.removeEventListener("mousemove",d),document.removeEventListener("mouseup",s)}t.addEventListener("mousedown",g=>{g.preventDefault(),g.stopPropagation();const w=e.getBoundingClientRect();r=g.clientX,i=g.clientY,a=w.width,l=w.height,u=w.left,c=w.top,e.style.left=w.left+"px",e.style.top=w.top+"px",e.style.bottom="auto",e.style.transform="none",e.style.width=w.width+"px",e.style.height=w.height+"px",e.style.overflow="auto",document.body.classList.add("cdm-resizing"),document.addEventListener("mousemove",d),document.addEventListener("mouseup",s)})}function se(){const t=me().length,n=Q.size,o=document.getElementById("cdm-total-chip"),r=document.getElementById("cdm-selected-chip"),i=document.getElementById("cdm-download-btn"),a=document.getElementById("cdm-download-label");o&&(o.textContent=`${t} tile${t!==1?"s":""}`),r&&(r.textContent=`${n} selected`),i&&(i.disabled=n===0||pe),a&&(a.textContent=pe?"Downloading…":`Download (${n})`)}function Hn(e,t){const n=t.querySelector("."+Te);if(n)return n;window.getComputedStyle(t).position==="static"&&(t.style.position="relative"),t.style.isolation="isolate",t.classList.add("cdm-isolated");const r=document.createElement("div");r.className=Te+" cdm-active",r.setAttribute("data-cdm-tile",e);const i=document.createElement("div");i.className="cdm-checkbox-wrap";const a=document.createElement("input");a.type="checkbox",a.className="cdm-checkbox",a.setAttribute("data-tile-cb",e),a.checked=Q.has(e),a.addEventListener("change",c=>{c.stopPropagation(),a.checked?et(e,t):tt(e,t),se()}),r.addEventListener("click",c=>{c.target!==a&&(a.checked=!a.checked,a.dispatchEvent(new Event("change")))}),i.appendChild(a),r.appendChild(i);const l=Bn(t),u=document.createElement("div");return u.className="cdm-tile-badge",u.textContent=l?"🎬 VIDEO":"🖼 IMAGE",r.appendChild(u),t.appendChild(r),r}function et(e,t){Q.add(e);const n=t.querySelector(`[data-tile-cb="${e}"]`);n&&(n.checked=!0);let o=t.querySelector(".cdm-tile-selected-ring");if(!o){o=document.createElement("div"),o.className="cdm-tile-selected-ring";const r=t.querySelector("."+Te);r&&r.appendChild(o)}}function tt(e,t){Q.delete(e);const n=t.querySelector(`[data-tile-cb="${e}"]`);n&&(n.checked=!1);const o=t.querySelector(".cdm-tile-selected-ring");o&&o.remove()}function jr(){me().forEach(({tileId:e,tileEl:t})=>{Hn(e,t)}),se()}function Br(){document.querySelectorAll("."+Te).forEach(e=>e.remove()),document.querySelectorAll("[data-cdm-tile-pos]").forEach(e=>{e.style.position="",e.removeAttribute("data-cdm-tile-pos")})}function Hr(){return document.querySelector("[data-virtuoso-scroller]")||document.querySelector('[class*="tileGrid"], [class*="tile-grid"], [class*="TileGrid"]')||document.querySelector("main")||document.body}function Wr(){var t;if(xe)return;xe=new MutationObserver(n=>{!le||!n.some(r=>[...r.addedNodes].some(i=>{var a;return!(i.nodeType!==Node.ELEMENT_NODE||(a=i.classList)!=null&&a.contains(Te)||i.id===Fe||i.id===Ct)}))||(clearTimeout(ft),ft=setTimeout(()=>{le&&(me().forEach(({tileId:r,tileEl:i})=>{i.querySelector("."+Te)||Hn(r,i)}),se())},200))});const e=Hr();xe.observe(e,{childList:!0,subtree:!0}),console.log("[CDM] Observer attached to",e.tagName,((t=e.className)==null?void 0:t.slice(0,60))||"")}function Xr(){clearTimeout(ft),ft=null,xe&&(xe.disconnect(),xe=null)}function Qr(e,t){const n=[...e.querySelectorAll('button[role="menuitem"], button')];if(n.length===0)return null;const o=n.map(i=>{var c;const l=((c=i.querySelectorAll("span")[0])==null?void 0:c.textContent.trim())||i.textContent.trim(),u=i.getAttribute("aria-disabled")!=="true";return{btn:i,label:l,enabled:u}}),r=o.filter(i=>i.enabled);if(t){const i=o.find(a=>a.label===t);if(i&&i.enabled)return i.btn}return r.length>0?r[r.length-1].btn:n[0]||null}async function Zr(e,t){try{const n=e.querySelector('video[src*="media.getMediaUrlRedirect"]')||e.querySelector('img[src*="media.getMediaUrlRedirect"]');if(!n)return console.warn("[CDM] No media element in tile"),!1;const o=n.getBoundingClientRect(),r=o.left+o.width/2,i=o.top+o.height/2;n.dispatchEvent(new MouseEvent("mouseenter",{bubbles:!0,clientX:r,clientY:i})),n.dispatchEvent(new MouseEvent("mousemove",{bubbles:!0,clientX:r,clientY:i})),await ue(400),n.dispatchEvent(new MouseEvent("contextmenu",{bubbles:!0,cancelable:!0,clientX:r,clientY:i,button:2})),await ue(600);const a=document.querySelector('[data-radix-menu-content][data-state="open"]');if(!a)return console.warn("[CDM] Context menu did not open"),!1;const l=[...a.querySelectorAll('[role="menuitem"]')].find(s=>{var g;return((g=s.querySelector("i"))==null?void 0:g.textContent.trim())==="download"});if(!l)return console.warn("[CDM] Download menuitem not found"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;l.click(),await ue(600);const u=[...document.querySelectorAll('[data-radix-menu-content][data-state="open"]')],c=u.find(s=>s!==a)||u[u.length-1];if(!c||c===a)return console.warn("[CDM] Quality sub-menu did not open"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;const d=Qr(c,t);return d?(d.click(),await ue(300),!0):(console.warn("[CDM] No quality button in sub-menu"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1)}catch(n){return console.error("[CDM] downloadTileViaUI error:",n),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1}}function Wn(){X=!X;const e=document.getElementById("cdm-pause-btn"),t=document.getElementById("cdm-pause-label"),n=document.getElementById("cdm-paused-badge");e&&e.classList.toggle("cdm-paused",X),t&&(t.textContent=X?"Resume":"Pause");const o=e==null?void 0:e.querySelector("svg");o&&(o.innerHTML=X?'<polygon points="5,3 19,12 5,21" fill="currentColor"/>':'<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>'),n&&n.classList.toggle("cdm-visible",X);const r=document.getElementById("cdm-progress-label");r&&X?r.style.opacity="0.5":r&&(r.style.opacity="")}function Jr(){pe&&(ce=!0,X&&Wn())}async function ei(){if(pe||Q.size===0)return;pe=!0,X=!1,ce=!1,Ce=me().filter(g=>Q.has(g.tileId)).map(g=>({tileId:g.tileId,tileEl:g.tileEl,isVideo:g.isVideo,quality:g.isVideo?jn:Kn}));const t=Ce.length;let n=0;const o=document.getElementById("cdm-progress-wrap"),r=document.getElementById("cdm-progress-label"),i=document.getElementById("cdm-progress-bar-fill"),a=document.getElementById("cdm-download-btn"),l=document.getElementById("cdm-download-controls"),u=document.getElementById("cdm-pause-btn"),c=document.getElementById("cdm-pause-label");o&&o.classList.add("cdm-visible"),r&&(r.textContent=`Downloading 0 / ${t}…`),i&&(i.style.width="0%"),l&&l.classList.add("cdm-visible"),u&&u.classList.remove("cdm-paused"),c&&(c.textContent="Pause"),a&&(a.disabled=!0,a.innerHTML=`
      <div class="cdm-spinner"></div>
      <span>Downloading…</span>
    `);for(const g of Ce){if(ce){console.log("[CDM] Download stopped by user");break}for(;X&&!ce;)await ue(150);if(ce){console.log("[CDM] Download stopped while paused");break}console.log(`[CDM] Downloading tile ${g.tileId} (quality: ${g.quality})`),g.tileEl.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"}),await ue(350),await Zr(g.tileEl,g.quality),n++,r&&(r.textContent=`Downloading ${n} / ${t}…`),i&&(i.style.width=`${Math.round(n/t*100)}%`),await ue(400)}const d=ce;pe=!1,X=!1,ce=!1,Ce=[],l&&l.classList.remove("cdm-visible"),u&&u.classList.remove("cdm-paused"),c&&(c.textContent="Pause");const s=document.getElementById("cdm-paused-badge");s&&s.classList.remove("cdm-visible"),r&&(r.style.opacity=""),d?(r&&(r.textContent=`⛔ Stopped after ${n} / ${t}`),i&&(i.style.width=`${Math.round(n/t*100)}%`)):(r&&(r.textContent=`✅ Downloaded ${n} / ${t} complete`),i&&(i.style.width="100%")),a&&(a.innerHTML=`
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
      </svg>
      <span id="cdm-download-label">Download (${Q.size})</span>
    `,a.disabled=Q.size===0),console.log(`[CDM] Download run complete: ${n}/${t} (stopped=${d})`),setTimeout(()=>{o&&o.classList.remove("cdm-visible")},3e3)}function Rt(e){const t=document.getElementById(Fe);t&&(t.classList.toggle("cdm-dark",!!e),t.classList.toggle("cdm-light",!e))}function ti(){try{chrome.storage.local.get(["darkMode"],e=>{Rt(e.darkMode!==!1)})}catch{Rt(!0)}}function ni(){if(!ve){ve=(e,t)=>{t!=="local"||!("darkMode"in e)||Rt(e.darkMode.newValue!==!1)};try{chrome.storage.onChanged.addListener(ve)}catch{}}}function oi(){if(ve){try{chrome.storage.onChanged.removeListener(ve)}catch{}ve=null}}function Xn(){le||(le=!0,console.log("[CDM] Activating Content Download Manager"),zr(),Vr(),ti(),ni(),jr(),Wr(),se())}function jt(){if(!le)return;le=!1,console.log("[CDM] Deactivating Content Download Manager"),Xr(),oi(),Br();const e=document.getElementById(Fe);e&&e.remove(),Q.clear(),pe=!1,Ce=[]}function ri(){le?jt():Xn()}function ii(){return le}console.log("✅ ContentDownloadManager module loaded");const ai=Object.freeze(Object.defineProperty({__proto__:null,activate:Xn,deactivate:jt,isActive:ii,toggle:ri},Symbol.toStringTag,{value:"Module"}));let nt=!1,ot=!1,Lt=!0,St=null,We,rt=null,Ot=null,it=null,be=null,on=null;function pt(){const e=[...document.querySelectorAll('video[src*="media.getMediaUrlRedirect"]'),...document.querySelectorAll('img[src*="media.getMediaUrlRedirect"]')],t=e.filter(n=>!n.closest("[data-tile-id]"));return t.length>0?t:e}function si(){return pt().filter(e=>e.tagName==="VIDEO")}function rn(e){try{return new URL(e,window.location.origin).searchParams.get("name")||e}catch{return e}}function Qn(e){return e?String(e).trim().replace(/^fe_id_/i,"").toLowerCase():null}function an(e){const t=new Set,n=[];for(const o of e||[])!o||t.has(o)||(t.add(o),n.push(o));return n}function li(){const e=window.location.href.match(/\/edit\/([\w-]+)/i);return e?e[1]:null}function Dt(){if(document.querySelector('[id^="history-step-fe_id_"]'))return;const e=L("//button[.//i[normalize-space()='history']]");e&&te(e)}function ci(){const e=[...document.querySelectorAll('[id^="history-step-fe_id_"]')],t=[];for(const n of e){const o=n.querySelector('[data-tile-id] img[src*="media.getMediaUrlRedirect"]')||n.querySelector('img[src*="media.getMediaUrlRedirect"]');if(!o)continue;const r=o.src||o.getAttribute("src")||"";if(!r)continue;const i=(n.id||"").match(/^history-step-(fe_id_.+)$/i);t.push({src:r,editId:i?i[1]:null,normalizedEditId:Qn(i?i[1]:null),isActive:n.matches('[aria-current="true"], [aria-selected="true"], [data-state="active"], .active, .selected')})}return t}function ke(){const e=pt(),t=e.some(c=>c.tagName==="IMG"),n=e.some(c=>c.tagName==="VIDEO");if(!!document.querySelector(".konvajs-content")||t&&!n||e.length===0){Dt();const c=ci();if(c.length>0){const d=Qn(li()),s=d?c.findIndex(P=>P.normalizedEditId===d):-1,g=s>=0?c[s]:null,w=c.findIndex(P=>P.isActive),T=c.find(P=>P.isActive),E=g||T||c[0];let O=c;(s>=0?s:w)===0&&c.length>1&&(O=[...c].reverse());const U=an(O.map(P=>P.src));return E.src&&!U.includes(E.src)&&U.push(E.src),{src:E.src,name:rn(E.src),kind:"image",sequence:U}}}if(e.length===0)return null;const r=e[e.length-1],i=r.src||r.getAttribute("src")||"",a=r.tagName==="IMG"?"image":"video",l=rn(i);if(a==="video"){const c=si().map(d=>d.src||d.getAttribute("src")||"").filter(Boolean);return{src:i,name:l,kind:a,segments:c}}const u=an(e.filter(c=>c.tagName==="IMG").map(c=>c.src||c.getAttribute("src")||""));return i&&!u.includes(i)&&u.push(i),{src:i,name:l,kind:a,sequence:u}}function di(){return ke()}function ui(){const e=L("(//button[.//i[normalize-space()='arrow_forward'] and not(@disabled) and not(@aria-disabled='true')])[last()]");return e||L("(//button[.//i[normalize-space()='arrow_forward']])[last()]")}async function fi(e=6e3){const t=Date.now();for(;Date.now()-t<e;){const n=ui();if(n&&!n.disabled&&n.getAttribute("aria-disabled")!=="true")return n;await p(100)}return null}function Zn(e,t=[]){return new Promise((n,o)=>{chrome.runtime.sendMessage({action:"executeInMainWorld",funcBody:e,args:t},r=>{chrome.runtime.lastError?o(new Error(chrome.runtime.lastError.message)):r!=null&&r.success?n(r.result):o(new Error((r==null?void 0:r.error)||"executeInMainWorld failed"))})})}const pi=120;function mi(e){return Zn(`
    var text = args[0];
    var el = document.evaluate(
      "//*[@data-scroll-state]//*[@data-slate-editor='true']",
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    if (!el) throw new Error('Editor element not found');

    var fiberKey = Object.keys(el).find(function(k) {
      return k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance');
    });
    if (!fiberKey) throw new Error('No React fiber key on editor element');

    var node = el[fiberKey];
    var slate = null;
    while (node) {
      var p = node.memoizedProps;
      if (p && p.editor && typeof p.editor.insertText === 'function') { slate = p.editor; break; }
      node = node.return;
    }
    if (!slate) throw new Error('Slate editor not found in fiber tree');

    var lastIdx = slate.children.length - 1;
    var lastChild = slate.children[lastIdx];
    var lastOffset = (lastChild && lastChild.children && lastChild.children[0])
      ? (lastChild.children[0].text || '').length : 0;
    slate.select({
      anchor: { path: [0, 0], offset: 0 },
      focus:  { path: [lastIdx, 0], offset: lastOffset }
    });
    slate.insertText(text);
    return true;
  `,[e])}function gi(e){return Zn(`
    var text = String(args[0] || '');
    var pasteThreshold = Number(args[1] || 120);

    function wait(ms) {
      return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    function findEditorEl() {
      var byScrollState = document.evaluate(
        "//*[@data-scroll-state]//*[@data-slate-editor='true']",
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
      ).singleNodeValue;
      if (byScrollState) return byScrollState;

      var byPlaceholder = document.evaluate(
        "//*[@data-slate-editor='true'][.//*[@data-slate-placeholder='true']]",
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
      ).singleNodeValue;
      if (byPlaceholder) return byPlaceholder;

      var all = document.querySelectorAll('[data-slate-editor="true"]');
      return all[1] || all[0] || null;
    }

    function getSlateEditor(el) {
      var fiberKey = Object.keys(el).find(function(k) {
        return k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance');
      });
      if (!fiberKey) throw new Error('No React fiber key on editor element');

      var node = el[fiberKey];
      while (node) {
        var p = node.memoizedProps;
        if (p && p.editor && typeof p.editor.insertText === 'function') return p.editor;
        node = node.return;
      }
      throw new Error('Slate editor not found in fiber tree');
    }

    function selectAll(slate) {
      var lastIdx = slate.children.length - 1;
      var lastChild = slate.children[lastIdx];
      var lastOffset = (lastChild && lastChild.children && lastChild.children[0])
        ? (lastChild.children[0].text || '').length
        : 0;
      slate.select({
        anchor: { path: [0, 0], offset: 0 },
        focus:  { path: [lastIdx, 0], offset: lastOffset }
      });
    }

    return (async function() {
      var el = findEditorEl();
      if (!el) throw new Error('Editor element not found');
      var slate = getSlateEditor(el);

      if (text.length > pasteThreshold) {
        // Human-like paste path for long prompts.
        await wait(300 + Math.random() * 600);
        el.focus();
        el.click();
        await wait(120 + Math.random() * 140);
        selectAll(slate);
        await wait(80 + Math.random() * 90);

        try {
          var dt = new DataTransfer();
          dt.setData('text/plain', text);
          dt.setData('text/html', '<span>' + text.replace(/\\n/g, '<br>') + '</span>');
          var pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
          });
          el.dispatchEvent(pasteEvent);
          await wait(250 + Math.random() * 220);

          var result = (el.textContent || '').trim();
          var expected = text.trim();
          if (!expected || result === expected || result.includes(expected.substring(0, Math.min(30, expected.length)))) {
            return true;
          }
        } catch (_) {
          // Fall through to direct insert fallback.
        }

        selectAll(slate);
        slate.insertText(text);
        return true;
      }

      // Human-like typing path for shorter prompts.
      await wait(120 + Math.random() * 180);
      el.focus();
      el.click();
      await wait(100 + Math.random() * 120);
      selectAll(slate);
      slate.insertText('');

      for (var i = 0; i < text.length; i++) {
        slate.insertText(text[i]);
        await wait(30 + Math.random() * 95);
      }

      return true;
    })();
  `,[e,pi])}function hi(e){return Lt?gi(e):mi(e)}const Pe={completion:18e4,scan:3e3};function bi(){const e=document.querySelectorAll("i");for(const t of e){if(t.textContent.trim()!=="videocam")continue;const n=t.parentElement;if(!n)continue;const o=n.querySelectorAll("*");for(const r of o){if(r===t)continue;const a=r.textContent.trim().match(/^(\d{1,3})%$/);if(a)return parseInt(a[1],10)}}return null}function mt(){return[...document.querySelectorAll(".konvajs-content canvas")].filter(e=>!e.closest("[data-tile-id]"))}function $t(){return[...document.querySelectorAll('[style*="--blur-amount"]')].filter(t=>!t.closest("[data-tile-id]")).some(t=>{const o=(t.getAttribute("style")||"").match(/--blur-amount:\s*([\d.]+)px/i);return o?parseFloat(o[1])>0:!1})}function wi(){return mt().length>0&&!$t()}function yi(){return mt().length>0||!!L("//button[.//i[normalize-space()='history']]")}function Ei(){var a;const e=document.querySelector('video[src*="media.getMediaUrlRedirect"], img[src*="media.getMediaUrlRedirect"]'),t=(e==null?void 0:e.closest("div"))||((a=document.querySelector("button video[src], button img[src]"))==null?void 0:a.closest("div"))||null;if(!t)return null;const n=[...t.querySelectorAll("i")];return n.some(l=>l.textContent.trim()==="warning")?[...t.querySelectorAll("a[href]")].some(l=>{const u=l.getAttribute("href")||"";return u.includes("/faq")||u.includes("/policies")||u.includes("policy")})?{type:"POLICY_VIOLATION",label:"Prompt flagged by content policy"}:n.some(l=>l.textContent.trim()==="refresh")?{type:"GENERATION_FAILED",label:"Generation failed — Flow encountered an error"}:{type:"UNKNOWN_ERROR",label:"Generation error detected"}:null}function we(e,t={}){chrome.runtime.sendMessage({action:"contentEditorMonitoring",status:e,...t}).catch(()=>{})}function Re(){rt&&(clearInterval(rt),rt=null),Ot=null,it=null}function Si(){return new Promise((e,t)=>{const n=pt(),o=n.length;it=n.length>0?n[n.length-1].src||n[n.length-1].getAttribute("src"):null;const r=mt(),i=new Set(r);let a=$t();Ot=Date.now(),console.log(`🔍 Content Editor monitor started (pre-submit count: ${o}, last src: ${it?"exists":"none"})`),we("processing",{progress:0}),rt=setInterval(()=>{try{const l=bi();if(l!==null){we("progress",{progress:l});return}$t()&&(a=!0);const u=pt(),c=u.length,d=c>0?u[c-1].src||u[c-1].getAttribute("src"):null;if(c>o||d&&d.includes("media.getMediaUrlRedirect")&&d!==it){console.log(`✅ Content Editor generation complete — media nodes ${o} → ${c}`),Re(),setTimeout(()=>{yi()&&Dt(),we("completed",{target:ke()}),e()},140);return}const s=mt(),g=s.length!==r.length||s.some(E=>!i.has(E));if(wi()&&(a||g)){console.log("✅ Content Editor generation complete — image canvas rendered"),Re(),setTimeout(()=>{Dt(),we("completed",{target:ke()}),e()},140);return}const w=Ei();if(w){console.error(`❌ Content Editor generation error: [${w.type}] ${w.label}`),we("error",{error:w.label,errorType:w.type}),Re(),t(new Error(w.label));return}const T=Date.now()-Ot;if(T>Pe.completion){console.error(`❌ Content Editor generation timeout (${Pe.completion/1e3}s)`),we("timeout",{error:`Generation timed out after ${Math.round(T/1e3)}s`}),Re(),t(new Error(`Generation timed out after ${Math.round(T/1e3)}s`));return}if(T>0&&Math.floor(T/1e3)%30<Pe.scan/1e3){const E=Math.round((Pe.completion-T)/1e3);console.log(`⏳ Content Editor: waiting for generation... ${Math.round(T/1e3)}s elapsed, timeout in ${E}s`)}}catch(l){console.error("❌ Content Editor monitor tick error:",l)}},Pe.scan)})}const sn={full:[0,0,1,1],left_half:[0,0,.5,1],right_half:[.5,0,1,1],top_half:[0,0,1,.5],bottom_half:[0,.5,1,1],center:[.25,.25,.75,.75],left_third:[0,0,.33,1],center_third:[.33,0,.67,1],right_third:[.67,0,1,1],top_third:[0,0,1,.33],bottom_third:[0,.67,1,1],top_left:[0,0,.5,.5],top_right:[.5,0,1,.5],bottom_left:[0,.5,.5,1],bottom_right:[.5,.5,1,1]},xi=8e3,Jn=2e4,xt=4,vi=2500,Ti=600,ki=850,Ii=1100,vt=10,_i=1e3;function Ai(){const e=L("(//button[.//i[normalize-space()='select'] and not(@disabled) and not(@aria-disabled='true')])[last()]");return e||L("(//button[.//i[normalize-space()='select']])[last()]")}function ln(e){if(!e)return!1;if(e.getAttribute("aria-pressed")==="true"||e.getAttribute("aria-checked")==="true")return!0;const o=(e.getAttribute("data-state")||"").toLowerCase();return o==="on"||o==="checked"||o==="active"}async function Pi(e){const t=Ai();if(!t)throw new Error(`Select tool button not found in ${e}`);ln(t)||(t.focus(),await p(100),t.dispatchEvent(new KeyboardEvent("keydown",{key:" ",code:"Space",keyCode:32,bubbles:!0,cancelable:!0})),t.dispatchEvent(new KeyboardEvent("keyup",{key:" ",code:"Space",keyCode:32,bubbles:!0,cancelable:!0})),ln(t)||te(t))}function Mi(){return document.querySelector('input[type="file"][accept*="image"]')}function Ci(e){if(!e)return!1;const t=getComputedStyle(e),n=e.getBoundingClientRect();return t.display!=="none"&&t.visibility!=="hidden"&&t.opacity!=="0"&&n.width>6&&n.height>6}function Ri(){const t=[...document.querySelectorAll("button")].filter(n=>n.disabled||n.getAttribute("aria-disabled")==="true"||!Ci(n)?!1:[...n.querySelectorAll("i")].some(o=>(o.textContent||"").trim()==="add_2"));return t.length>0?t[t.length-1]:null}function eo(){return[...document.querySelectorAll('[role="dialog"][data-state="open"]')].find(t=>t.querySelector('input[type="text"]'))||null}async function Li(e=xi){const t=Date.now();for(;Date.now()-t<e;){const n=eo();if(n)return n;await p(150)}return null}function cn(e,t){const n=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;e.focus(),n.call(e,t),e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0}))}async function Oi(e,t=Jn){const n=Date.now(),o=(e||"").trim().toLowerCase();for(;Date.now()-n<t;){const r=[...document.querySelectorAll('[data-testid="virtuoso-item-list"] img')],i=r.find(l=>(l.getAttribute("alt")||"").trim().toLowerCase()===o);if(i)return i;const a=r.find(l=>(l.getAttribute("alt")||"").toLowerCase().includes(o));if(a)return a;if(r.length>0)return r[0];await p(200)}return null}function Di(e){return(e==null?void 0:e.closest('button, [role="button"]'))||(e==null?void 0:e.parentElement)||e}async function $i(e){let t=null;for(let n=1;n<=xt;n++)try{let o=eo();if(!o){const l=Ri();if(!l)throw new Error("Image library add_2 button not found");if(te(l),o=await Li(),!o)throw new Error("Image library dialog did not open")}const r=o.querySelector('input[type="text"]');if(!r)throw new Error("Image library search input not found");cn(r,""),await p(120),cn(r,e||""),await p(250);const i=await Oi(e||"",Jn);if(!i)throw new Error(`Uploaded image not available in library yet: ${e||"unknown file"}`);await p(Ti);const a=Di(i);te(a),await p(ki);return}catch(o){t=o,n<xt&&(console.warn(`⏳ Image library result pending for "${e}" — retry ${n+1}/${xt}`),await p(vi))}throw t||new Error(`Uploaded image not available in library yet: ${e||"unknown file"}`)}function qi(e,t,n="image/jpeg"){if(!e||typeof e!="string")return null;const o=e.split(",");if(o.length<2)return null;const r=o[1],i=atob(r),a=new Uint8Array(i.length);for(let l=0;l<i.length;l++)a[l]=i.charCodeAt(l);return new File([a],t||`upload_${Date.now()}.jpg`,{type:n})}async function Ui(e){const t=(e||[]).filter(i=>i&&typeof i.data=="string"&&i.data.startsWith("data:"));t.length>vt&&console.warn(`⚠️ Image edit upload capped at ${vt}; received ${t.length}`);const n=t.slice(0,vt);if(n.length===0)return;const o=Mi();if(!o)throw new Error("Image upload input not found in image edit mode");const r=new DataTransfer;for(let i=0;i<n.length;i++){const a=n[i],l=qi(a.data,a.name||`upload_${i+1}.jpg`,a.mimeType||"image/jpeg");if(!l)throw new Error(`Failed to prepare upload file: ${a.name||`upload_${i+1}`}`);r.items.add(l)}o.files=r.files,o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}));for(const i of n)await $i(i.name||"")}function Ni(){const e=[...document.querySelectorAll(".konvajs-content canvas")].filter(o=>!o.closest("[data-tile-id]")),t=[...document.querySelectorAll("canvas")].filter(o=>!o.closest("[data-tile-id]")),n=[e,t];for(const o of n){const r=o.find(i=>{const a=getComputedStyle(i),l=i.getBoundingClientRect();return a.display!=="none"&&a.visibility!=="hidden"&&a.pointerEvents!=="none"&&l.width>4&&l.height>4});if(r)return r}return null}async function zi(e=5e3){const t=Date.now();for(;Date.now()-t<e;){const n=Ni();if(n)return n;await p(100)}throw new Error("Remove selection canvas not found (timed out waiting for it to appear)")}async function Vi(e){const t=sn[e]||sn.full,[n,o,r,i]=t,a=await zi(),l=a.getBoundingClientRect(),u=l.left+l.width*n,c=l.top+l.height*o,d=l.left+l.width*r,s=l.top+l.height*i;function g(E,O,D){a.dispatchEvent(new PointerEvent(E,{bubbles:!0,cancelable:!0,pointerId:1,pointerType:"mouse",isPrimary:!0,clientX:O,clientY:D,buttons:E==="pointerup"?0:1,button:0}))}function w(E,O,D){a.dispatchEvent(new MouseEvent(E,{bubbles:!0,cancelable:!0,clientX:O,clientY:D,buttons:E==="mouseup"?0:1,button:0}))}g("pointermove",u,c),g("pointerdown",u,c),w("mousemove",u,c),w("mousedown",u,c),await p(50);const T=10;for(let E=1;E<=T;E++){const O=u+(d-u)*(E/T),D=c+(s-c)*(E/T);g("pointermove",O,D),w("mousemove",O,D),await p(20)}g("pointerup",d,s),w("mouseup",d,s),w("click",d,s)}async function Fi(e,t="",n=[]){Array.isArray(n)&&n.length>0&&(await Ui(n),await p(Ii)),t&&(await Pi("image edit mode"),await Vi(t||"full"),await p(250)),await hi(e),await p(_i);const o=await fi(6e3);if(!o)throw new Error("Submit button not ready for image edit task");te(o),await p(800),await Si()}const to=/labs\.google\/fx(?:\/[a-z]{2}(?:-[a-z]{2,})?)?\/tools\/flow\/project\/[\w-]+\/edit\/[\w-]+/i;function no(){return to.test(window.location.href)}function Gi(){const e=window.location.href;return/labs\.google\/fx(?:\/[a-z]{2}(?:-[a-z]{2,})?)?\/tools\/flow\/project\/[\w-]+/i.test(e)&&!to.test(e)}function Me(){if(no()){const e=ke(),t=e?`${e.kind}:${e.src}`:null;(be!=="edit"||t!==We)&&(be="edit",We=t,chrome.runtime.sendMessage({action:"contentEditorTargetChanged",target:e}).catch(()=>{}))}else if(Gi()){const e=ro(),t=e.map(n=>`${n.tileId}:${n.kind}:${n.src}`).join("|");(be!=="project"||t!==on)&&(be="project",on=t,We=null,chrome.runtime.sendMessage({action:"contentEditorProjectTiles",tiles:e}).catch(()=>{}))}else be!=="other"&&(be="other",We=null,chrome.runtime.sendMessage({action:"contentEditorTargetChanged",target:null}).catch(()=>{}))}function oo(){if(St)return;St=new MutationObserver(Me),St.observe(document.body,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["src"]});const e=history.pushState.bind(history),t=history.replaceState.bind(history);history.pushState=function(...n){e(...n),Me()},history.replaceState=function(...n){t(...n),Me()},window.addEventListener("popstate",Me),Me()}function ro(){const e=document.querySelectorAll("[data-tile-id]"),t=[],n=new Set;return e.forEach(o=>{var c;if((c=o.parentElement)!=null&&c.closest("[data-tile-id]"))return;const r=o.getAttribute("data-tile-id");if(!r||n.has(r))return;n.add(r);const i=o.querySelector('video[src*="media.getMediaUrlRedirect"], img[src*="media.getMediaUrlRedirect"]');if(!i)return;const a=i.src||i.getAttribute("src")||"",l=i.tagName==="IMG"?"image":"video";let u="";try{u=new URL(a,window.location.origin).searchParams.get("name")||""}catch{u=a}t.push({tileId:r,src:a,name:u,kind:l})}),t}function Yi(e){const t=document.querySelector(`[data-tile-id="${e}"]`);if(!t)return!1;const n=t.querySelector('a[href*="/edit/"]');if(n)return te(n),!0;const o=t.querySelector("button");if(o)return te(o),!0;const r=t.querySelector('[role="button"]');return r?(te(r),!0):(te(t),!0)}async function Ki(e,t,n={}){if(nt){console.warn("⚠️ Content Editor already running");return}if(!no())throw new Error("Not on a Flow project edit page. Open a media project in Flow first.");const o=ke();if(!o||o.kind!=="image")throw new Error("Flow Image Content Editor supports only image targets. Select an image tile first.");if((e||[]).some(r=>(r==null?void 0:r.type)!=="image_edit"))throw new Error("Flow Image Content Editor supports only image_edit tasks.");nt=!0,ot=!1,Lt=!0,console.log(`🎬 Content Editor: starting ${e.length} task(s) [stealth=${Lt}]`);for(let r=0;r<e.length;r++){if(ot){console.log("🛑 Content Editor: stopped by user");break}const i=e[r];t(i.id,"running");try{if(i.type==="image_edit"){const a=i.imageUseSelection?i.removeZone||"full":"";await Fi(i.prompt||"",a,i.imageUploads||[])}else throw new Error("Flow Image Content Editor supports only image_edit tasks.");t(i.id,"done"),console.log(`✅ Content Editor task ${r+1}/${e.length} done: ${i.type}`),r<e.length-1&&!ot&&await p(1200)}catch(a){console.error(`❌ Content Editor task ${r+1} failed:`,a.message),t(i.id,"error",a.message)}}nt=!1,console.log("✅ Content Editor: sequence complete")}function ji(){ot=!0,Re()}function Bi(){return nt}const Hi=Object.freeze(Object.defineProperty({__proto__:null,clickProjectTile:Yi,getProjectTiles:ro,getTargetMediaSrc:ke,getTargetVideoSrc:di,initTargetWatcher:oo,isEditorRunning:Bi,runEditorSequence:Ki,stopEditorSequence:ji},Symbol.toStringTag,{value:"Module"}));ko(ge);Vo(ge);jo(ge,W);tr(ge);Mn({getState:ge,setState:W,getSelectors:()=>En,eventBus:Ge,stateManager:bt});yr({getState:ge,setState:W,eventBus:Ge,monitoring:qn,stateManager:bt});vr({stateManager:bt,eventBus:Ge,monitoring:qn});Ar(bt,Ge);oo();fn(Ge,ai,Hi);chrome.runtime.sendMessage({action:"contentScriptReady"}).catch(()=>{});console.log("✅ Flow Automation bootstrap complete — all modules wired");console.log("📦 Layers: core | interactions (+ imageUploader + contentEditorAutomation) | workflow | ui (+ contentDownloadManager)");
