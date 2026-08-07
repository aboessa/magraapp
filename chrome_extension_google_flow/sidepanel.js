/**
 * Majarra Flow Automator - Side Panel JS v4.2
 * Features: Pause/Resume, Stop, Start-from-#, Color-coded log
 */

const statusDot    = document.getElementById('statusDot');
const loadPromptsBtn = document.getElementById('loadPromptsBtn');
const uploadFileBtn  = document.getElementById('uploadFileBtn');
const fileInput      = document.getElementById('fileInput');
const promptsInput   = document.getElementById('promptsInput');
const queueCount     = document.getElementById('queueCount');
const startFromInput = document.getElementById('startFromInput');
const startFromHint  = document.getElementById('startFromHint');
const startBtn       = document.getElementById('startBtn');
const pauseBtn       = document.getElementById('pauseBtn');
const stopBtn        = document.getElementById('stopBtn');
const logArea        = document.getElementById('logArea');
const progressBar    = document.getElementById('progressBar');
const statusBadge    = document.getElementById('statusBadge');

let activeTabId  = null;
let isPaused     = false;
let isRunning    = false;

// ── Logging ─────────────────────────────────────────────
function log(msg, type = 'ok') {
    const div = document.createElement('div');
    div.className = type;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logArea.appendChild(div);
    logArea.scrollTop = logArea.scrollHeight;
    // Keep log from growing too large
    while (logArea.children.length > 400) {
        logArea.removeChild(logArea.firstChild);
    }
}

function setStatusBadge(text, type = '') {
    statusBadge.textContent = text;
    statusBadge.className = 'status-badge ' + type;
}

// ── Connection check ─────────────────────────────────────
async function checkConnection() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url?.includes('labs.google/fx')) {
            activeTabId = tab.id;
            statusDot.classList.add('connected');
        } else {
            // Also check any labs.google tab (sidepanel may not be on active tab)
            const tabs = await chrome.tabs.query({ url: 'https://labs.google/fx/*' });
            const flowTab = tabs.find(t => t.url.includes('/tools/flow/'));
            if (flowTab) {
                activeTabId = flowTab.id;
                statusDot.classList.add('connected');
            } else {
                activeTabId = null;
                statusDot.classList.remove('connected');
            }
        }
    } catch (e) {
        activeTabId = null;
        statusDot.classList.remove('connected');
    }
}
setInterval(checkConnection, 2000);
checkConnection();

// ── Prompt count / start-from hint ───────────────────────
function updateQueueDisplay() {
    const lines = getPromptLines();
    const total = lines.length;
    queueCount.textContent = `${total} برومبت`;
    startFromInput.max = total;
    startFromHint.textContent = `من ${total}`;

    // Auto-clamp startFrom value
    const cur = parseInt(startFromInput.value) || 1;
    if (cur > total && total > 0) startFromInput.value = total;
}

function getPromptLines() {
    return promptsInput.value.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
}

promptsInput.addEventListener('input', updateQueueDisplay);
startFromInput.addEventListener('change', () => {
    const v = parseInt(startFromInput.value) || 1;
    const max = parseInt(startFromInput.max) || 9999;
    if (v < 1) startFromInput.value = 1;
    if (v > max) startFromInput.value = max;
});

// ── Load preset prompts ───────────────────────────────────
loadPromptsBtn.addEventListener('click', () => {
    if (window.MAJARRA_PROMPTS_PRESET) {
        promptsInput.value = window.MAJARRA_PROMPTS_PRESET;
        updateQueueDisplay();
        log(`✅ تم تحميل 209 برومبت من كنز مجرة بنجاح!`, 'ok');
    } else {
        log(`❌ لم يتم العثور على البرومبتات المسبقة.`, 'error');
    }
});

// ── Upload file ───────────────────────────────────────────
if (uploadFileBtn && fileInput) {
    uploadFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        log(`📄 جاري قراءة الملف: ${file.name}...`, 'info');
        const reader = new FileReader();
        reader.onload = (event) => {
            promptsInput.value = event.target.result;
            updateQueueDisplay();
            const count = getPromptLines().length;
            log(`✅ تم رفع الملف بنجاح! ${count} برومبت.`, 'ok');
        };
        reader.onerror = () => log(`❌ خطأ في قراءة الملف.`, 'error');
        reader.readAsText(file);
    });
}

// ── Inject content script ────────────────────────────────
async function ensureContentScriptInjected(tabId) {
    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['flowContentScript.js'] });
        await new Promise(r => setTimeout(r, 300));
    } catch (e) {
        console.warn('Script injection notice:', e.message);
    }
}

// ── Set UI to running mode ───────────────────────────────
function setRunningUI() {
    isRunning = true;
    isPaused  = false;
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'block';
    stopBtn.style.display  = 'block';
    pauseBtn.className     = 'btn-pause';
    pauseBtn.textContent   = '⏸ إيقاف مؤقت';
    setStatusBadge('⚡ جارٍ التوليد...', 'running');
}

function setPausedUI() {
    isPaused = true;
    pauseBtn.className   = 'btn-pause resumed';
    pauseBtn.textContent = '▶ استمرار';
    setStatusBadge('⏸ موقوف مؤقتاً - اضغط استمرار', 'paused');
}

function setResumedUI() {
    isPaused = false;
    pauseBtn.className   = 'btn-pause';
    pauseBtn.textContent = '⏸ إيقاف مؤقت';
    setStatusBadge('⚡ جارٍ التوليد...', 'running');
}

function setIdleUI() {
    isRunning = false;
    isPaused  = false;
    startBtn.style.display = 'block';
    pauseBtn.style.display = 'none';
    stopBtn.style.display  = 'none';
    setStatusBadge('جاهز', '');
}

// ── START Button ─────────────────────────────────────────
startBtn.addEventListener('click', async () => {
    await checkConnection();
    if (!activeTabId) {
        log('❌ يرجى فتح صفحة Google Flow أولاً!', 'error');
        return;
    }

    const allPrompts = getPromptLines();
    if (allPrompts.length === 0) {
        log('❌ لا توجد برومبتات للمعالجة.', 'error');
        return;
    }

    // Apply start-from offset
    const startFrom = Math.max(1, parseInt(startFromInput.value) || 1);
    const prompts   = allPrompts.slice(startFrom - 1);

    if (prompts.length === 0) {
        log(`❌ لا يوجد برومبتات بعد الرقم ${startFrom}.`, 'error');
        return;
    }

    const settings = {
        delay:       parseInt(document.getElementById('delayInput').value) || 12,
        aspectRatio: document.getElementById('ratioSelect').value,
        model:       document.getElementById('modelSelect').value,
        autoDownload: document.getElementById('autoDownload').checked,
        startFrom:   startFrom,
        totalAll:    allPrompts.length
    };

    progressBar.style.width = '0%';
    setRunningUI();

    if (startFrom > 1) {
        log(`▶ بدء من البرومبت رقم ${startFrom} (متبقي ${prompts.length} برومبت)`, 'info');
    } else {
        log(`🚀 بدء أتمتة ${prompts.length} برومبت...`, 'info');
    }

    await ensureContentScriptInjected(activeTabId);

    chrome.tabs.sendMessage(activeTabId, {
        action: 'startProcessing',
        prompts,
        settings
    }, (response) => {
        if (chrome.runtime.lastError) {
            log(`⚠️ محاولة إعادة الاتصال...`, 'warn');
            setTimeout(() => {
                chrome.tabs.sendMessage(activeTabId, {
                    action: 'startProcessing',
                    prompts,
                    settings
                }, (r2) => {
                    if (chrome.runtime.lastError) {
                        log(`❌ يرجى عمل Refresh (F5) لصفحة Google Flow.`, 'error');
                        setIdleUI();
                    }
                });
            }, 500);
        }
    });
});

// ── PAUSE / RESUME Button ────────────────────────────────
pauseBtn.addEventListener('click', () => {
    if (!activeTabId) return;

    if (!isPaused) {
        // Pause
        chrome.tabs.sendMessage(activeTabId, { action: 'pauseProcessing' });
        setPausedUI();
        log('⏸ تم الإيقاف المؤقت - اضغط "استمرار" عندما تكون جاهزاً.', 'warn');
    } else {
        // Resume
        chrome.tabs.sendMessage(activeTabId, { action: 'resumeProcessing' });
        setResumedUI();
        log('▶ تم الاستمرار.', 'ok');
    }
});

// ── STOP Button (full abort) ─────────────────────────────
stopBtn.addEventListener('click', () => {
    if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { action: 'stopProcessing' });
    }
    setIdleUI();
    log('⏹ تم الإيقاف الكامل.', 'warn');

    // Update startFrom to last processed (approximate from progress bar)
    // Will be updated precisely via progressUpdate messages
});

// ── Messages from content script ─────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'progressUpdate') {
        const idx     = msg.index;
        const total   = msg.total;
        const status  = msg.status || '';
        const startF  = parseInt(startFromInput.value) || 1;
        const absIdx  = startF - 1 + idx;      // absolute index in full list
        const allTotal = parseInt(document.getElementById('delayInput')
            .closest('.settings')?.parentElement
            ?.querySelector('#queueCount')?.textContent) || total;

        // Progress bar based on current batch progress
        const pct = total > 0 ? Math.round(((idx + 1) / total) * 100) : 0;
        progressBar.style.width = `${pct}%`;

        // Determine log type
        let type = 'ok';
        if (status.includes('❌') || status.includes('خطأ') || status.includes('فشل')) type = 'error';
        else if (status.includes('⚠️') || status.includes('⏳') || status.includes('انتظار') || status.includes('مؤقت')) type = 'warn';
        else if (status.includes('🔍') || status.includes('📐') || status.includes('API') || status.includes('⬇️')) type = 'info';

        log(status, type);

        // When paused by rate limit, update UI
        if (status.includes('كوتا') || status.includes('429')) {
            if (!isPaused) setPausedUI();
        }
        // When resumed after wait
        if (status.includes('إعادة المحاولة بعد') || (status.includes('🔄') && !status.includes('كوتا'))) {
            if (isPaused) setResumedUI();
        }

    } else if (msg.action === 'rateLimitPause') {
        // Content script signals a rate-limit pause
        setPausedUI();
        log(`⏳ توقف تلقائي بسبب كوتا Google - ستستمر بعد ${msg.waitSec || '?'} ثانية.`, 'warn');

    } else if (msg.action === 'processComplete') {
        setIdleUI();
        progressBar.style.width = '100%';
        log('🎉 اكتملت أتمتة جميع البرومبتات بنجاح!', 'ok');
        setStatusBadge('✅ اكتمل!', 'done');
    }
});
