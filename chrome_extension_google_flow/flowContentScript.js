/**
 * Majarra Flow Content Script v4.2
 * Uses Flow API directly for reliable aspect ratio control.
 * v4.2: Pause/Resume/Stop support + start-from-# offset.
 *
 * Prompt format: "Prompt text | filepath.webp | 1600x1200 (4:3)"
 */

if (window.__MAJARRA_CONTENT_SCRIPT_LOADED_V42__) {
    console.log('⚡ Majarra v4.2 already loaded');
} else {
window.__MAJARRA_CONTENT_SCRIPT_LOADED_V42__ = true;
console.log('🚀 Majarra Flow Content Script v4.2 (API + Pause/Resume) Active');

const sleep = ms => new Promise(r => setTimeout(r, ms));

let isProcessing = false;
let currentPrompts = [];
let currentSettings = {};
let promptIndex = 0;

// === Aspect Ratio Mapping ===
// Maps prompt size info to the Google Flow API enum values
const RATIO_MAP = {
    '16:9': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
    '4:3':  'IMAGE_ASPECT_RATIO_LANDSCAPE',   // Closest horizontal match
    '1:1':  'IMAGE_ASPECT_RATIO_SQUARE',
    '3:4':  'IMAGE_ASPECT_RATIO_PORTRAIT',
    '9:16': 'IMAGE_ASPECT_RATIO_PORTRAIT',     // Closest vertical match
};

// Model name mapping from sidepanel select values to API names
const MODEL_MAP = {
    'nano2':    'NARWHAL',
    'nanoPro':  'GEM_PIX_2',
    'NARWHAL':  'NARWHAL',
    'GEM_PIX_2':'GEM_PIX_2',
};

// === Message Listener ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startProcessing') {
        if (isProcessing) { sendResponse({ success: false, reason: 'already_running' }); return; }
        isProcessing = true;
        isPaused     = false;
        currentPrompts   = message.prompts;
        currentSettings  = message.settings || {};
        promptIndex = 0;
        showToast('🚀 بدأت الأتمتة (وضع API المباشر)!');
        setEdgeGlow('running');
        runLoop();
        sendResponse({ success: true });
    } else if (message.action === 'pauseProcessing') {
        isPaused = true;
        setEdgeGlow('pausing');
        showToast('⏸ إيقاف مؤقت...');
        sendResponse({ success: true });
    } else if (message.action === 'resumeProcessing') {
        isPaused = false;
        setEdgeGlow('running');
        showToast('▶ استمرار!');
        sendResponse({ success: true });
    } else if (message.action === 'stopProcessing') {
        isProcessing = false;
        isPaused     = false;
        showToast('⏹ تم الإيقاف');
        setEdgeGlow('off');
        sendResponse({ success: true });
    }
    return true;
});

// === Wait while paused (without exiting loop) ===
async function waitWhilePaused() {
    while (isPaused && isProcessing) {
        await sleep(500);
    }
}

// === Parse Prompt Line ===
function parsePromptLine(line) {
    const parts = line.split('|').map(p => p.trim());
    const promptText = parts[0] || '';
    const filePath   = parts[1] || '';
    const sizeInfo   = parts[2] || '';

    // Build download path
    let downloadPath = `majarra_images/${filePath || ('image_' + Date.now() + '.png')}`;
    if (!downloadPath.match(/\.(webp|png|jpg|jpeg)$/i)) {
        downloadPath += '.png';
    }

    // Extract ratio from sizeInfo: "1600x1200 (4:3)" → "4:3"
    let ratio = 'IMAGE_ASPECT_RATIO_LANDSCAPE'; // default
    const ratioMatch = sizeInfo.match(/\((\d+:\d+)\)/);
    if (ratioMatch) {
        ratio = RATIO_MAP[ratioMatch[1]] || 'IMAGE_ASPECT_RATIO_LANDSCAPE';
    }

    // If sidepanel override is set (not "auto"), use it
    const settingRatio = currentSettings.aspectRatio;
    if (settingRatio && settingRatio !== 'auto') {
        ratio = RATIO_MAP[settingRatio] || ratio;
    }

    return { promptText, filePath, downloadPath, sizeInfo, ratio };
}

// === Main Processing Loop ===
async function runLoop() {
    const total = currentPrompts.length;

    while (isProcessing && promptIndex < total) {
        const { promptText, downloadPath, ratio, sizeInfo } = parsePromptLine(currentPrompts[promptIndex]);
        const idx = promptIndex;
        const displayName = downloadPath.split('/').pop();
        const modelName = MODEL_MAP[currentSettings.model] || 'NARWHAL';

        // Show ratio being used
        const ratioDisplay = sizeInfo || ratio;
        updateProgress(idx, total, `📐 [${idx+1}/${total}] نسبة الأبعاد: ${ratioDisplay}`);
        await sleep(300);

        // === STEP 0: Debug check on first prompt only ===
        if (idx === 0) {
            const dbg = await sendToBg('debugPageState', {});
            updateProgress(idx, total, `🔍 projectId=${dbg?.projectId || 'N/A'} | reCAPTCHA=${dbg?.hasEnterprise ? '✅' : '❌'}`);
            await sleep(500);
            if (!dbg?.hasProject) {
                updateProgress(idx, total, `❌ افتح مشروع Flow (labs.google/.../project/xxx) أولاً!`);
                isProcessing = false; setEdgeGlow('off');
                safeSend({ action: 'processComplete' }); return;
            }
            if (!dbg?.hasEnterprise) {
                updateProgress(idx, total, `⚠️ reCAPTCHA غير محمّل - انتظر ثوانٍ...`);
                await sleep(4000);
            }
        }

        // === STEP 1: Generate via API with smart retry ===
        updateProgress(idx, total, `🚀 [${idx+1}/${total}] توليد... (${ratio})`);

        let genResult = null;
        let rateLimitHits = 0;
        const rateLimitWaits = [60, 120, 180]; // seconds to wait on each 429
        let retries = 0;
        const maxRetries = 3;

        while (retries <= maxRetries && isProcessing) {
            genResult = await sendToBg('generateImageAPI', {
                promptText: promptText,
                aspectRatio: ratio,
                model: modelName
            });

            if (genResult?.success) break;

            const errMsg = genResult?.error || 'NO_RESPONSE';
            const detail = genResult?.detail ? ` | ${genResult.detail.substring(0, 60)}` : '';

            // === Handle 429 Rate Limit specially ===
            if (errMsg.includes('429') || errMsg.includes('EXHAUSTED')) {
                const waitSec = rateLimitWaits[rateLimitHits] || 180;
                rateLimitHits++;
                setEdgeGlow('pausing');
                isPaused = true; // Auto-pause
                // Notify sidepanel
                safeSend({ action: 'rateLimitPause', waitSec });
                // Countdown display
                for (let s = waitSec; s > 0 && isProcessing; s--) {
                    updateProgress(idx, total,
                        `⏳ [${idx+1}/${total}] كوتا Google ممتلئة - انتظار ${s}ث... (أو اضغط استمرار الآن)`);
                    await sleep(1000);
                    // If user manually resumed, skip the wait
                    if (!isPaused) { s = 0; break; }
                }
                isPaused = false;
                setEdgeGlow('running');
                if (!isProcessing) break;
                updateProgress(idx, total, `🔄 [${idx+1}/${total}] إعادة المحاولة بعد الانتظار...`);
                continue;
            }

            // Fatal errors - stop immediately
            if (errMsg.includes('NO_AUTH') || errMsg.includes('AUTH_HTTP') ||
                errMsg.includes('NO_PROJECT') || errMsg.includes('RECAPTCHA_UNDEFINED') ||
                errMsg.includes('AUTH_NULL')) {
                updateProgress(idx, total, `❌ [${idx+1}/${total}] خطأ حرج: ${errMsg}`);
                isProcessing = false; break;
            }

            // Other errors - retry with short wait
            updateProgress(idx, total, `⚠️ [${idx+1}/${total}] ${errMsg}${detail}`);
            retries++;
            if (retries <= maxRetries) {
                updateProgress(idx, total, `🔄 [${idx+1}/${total}] إعادة محاولة (${retries}/${maxRetries})...`);
                await sleep(5000 * retries);
            }
        }

        if (genResult?.success && genResult.mediaId) {
            updateProgress(idx, total, `✅ [${idx+1}/${total}] تم التوليد! mediaId: ${genResult.mediaId.substring(0, 20)}...`);

            // === STEP 2: Download with custom filename ===
            if (currentSettings.autoDownload !== false) {
                await sleep(1500); // Give the image time to be fully processed

                updateProgress(idx, total, `⬇️ [${idx+1}/${total}] تنزيل: ${displayName}`);

                const dlResult = await sendToBg('downloadByMediaId', {
                    mediaId: genResult.mediaId,
                    filename: downloadPath
                });

                if (dlResult?.success) {
                    updateProgress(idx, total, `💾 [${idx+1}/${total}] ✅ تم حفظ: ${displayName}`);
                } else {
                    // Fallback: try direct URL download
                    const directUrl = `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${genResult.mediaId}`;
                    const dlResult2 = await sendToBg('downloadImageWithName', {
                        url: directUrl,
                        filename: downloadPath
                    });

                    if (dlResult2?.success) {
                        updateProgress(idx, total, `💾 [${idx+1}/${total}] ✅ تم حفظ (بديل): ${displayName}`);
                    } else {
                        updateProgress(idx, total, `⚠️ [${idx+1}/${total}] فشل التنزيل: ${dlResult2?.error || 'unknown'}`);
                    }
                }
            }
        } else {
            const errDetail = genResult?.error || 'unknown';
            const apiDetail = genResult?.detail ? ` | ${genResult.detail.substring(0, 100)}` : '';
            updateProgress(idx, total, `❌ [${idx+1}/${total}] فشل التوليد: ${errDetail}${apiDetail}`);
        }

        promptIndex++;

        // Delay between prompts - respects pause
        if (isProcessing && promptIndex < total) {
            const delay = (currentSettings.delay || 12) * 1000;
            updateProgress(promptIndex, total, `⏱️ انتظار ${currentSettings.delay || 12} ثوانٍ...`);
            const delayEnd = Date.now() + delay;
            while (Date.now() < delayEnd && isProcessing) {
                await waitWhilePaused();
                if (!isProcessing) break;
                await sleep(500);
            }
        }
    }

    isProcessing = false;
    setEdgeGlow('off');
    showToast('🎉 اكتملت كل البرومبتات!');
    safeSend({ action: 'processComplete' });
}

// === Helpers ===

function sendToBg(action, data) {
    return new Promise(resolve => {
        safeSend({ action, ...data }, res => resolve(res || { success: false }));
    });
}

function updateProgress(index, total, status) {
    safeSend({ action: 'progressUpdate', index, total, status });
}

function safeSend(msg, cb) {
    try {
        if (chrome.runtime?.id) {
            chrome.runtime.sendMessage(msg, res => {
                if (chrome.runtime.lastError) { /* ignore */ }
                if (cb) cb(res);
            });
        }
    } catch (e) { /* extension invalidated */ }
}

// === Overlays ===

function showToast(message) {
    let t = document.getElementById('majarra-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'majarra-toast';
        t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(6,9,26,.95);color:#00D6F5;padding:10px 24px;border-radius:10px;z-index:999999;font-size:13px;border:1px solid #00D6F5;box-shadow:0 8px 30px rgba(0,0,0,.5);backdrop-filter:blur(8px);direction:rtl;font-family:system-ui,sans-serif;';
        document.body.appendChild(t);
    }
    t.textContent = message;
    t.style.display = 'block';
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { t.style.display = 'none'; }, 4000);
}

function setEdgeGlow(state) {
    let g = document.getElementById('majarra-glow');
    if (!g) {
        g = document.createElement('div');
        g.id = 'majarra-glow';
        g.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999998;transition:box-shadow .6s;';
        const s = document.createElement('style');
        s.textContent = '@keyframes mG{0%,100%{opacity:.6}50%{opacity:1}} #majarra-glow.on{animation:mG 2s ease-in-out infinite} @keyframes mP{0%,100%{opacity:.5}50%{opacity:1}} #majarra-glow.pausing{animation:mP 1s ease-in-out infinite}';
        document.head.appendChild(s);
        document.body.appendChild(g);
    }
    if (state === 'running') {
        g.className = 'on';
        g.style.boxShadow = 'inset 0 0 25px 6px rgba(0,214,245,.4)';
    } else if (state === 'pausing') {
        g.className = 'pausing';
        g.style.boxShadow = 'inset 0 0 25px 6px rgba(255,165,0,.5)'; // orange for waiting
    } else {
        g.className = '';
        g.style.boxShadow = 'none';
    }
}

} // end guard
