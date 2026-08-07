import os
import json

base_dir = r"f:\Projects\cartoonapp\chrome_extension_google_flow"
os.makedirs(base_dir, exist_ok=True)
os.makedirs(os.path.join(base_dir, "icons"), exist_ok=True)

manifest = {
  "manifest_version": 3,
  "name": "Majarra Flow Automator - مجرة",
  "description": "أتمتة توليد صور مجرة التعليمية على Google Flow - Bulk Image Generation",
  "version": "3.0.0",
  "permissions": ["activeTab", "storage", "sidePanel", "tabs", "scripting", "downloads"],
  "host_permissions": ["https://labs.google/*"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["https://labs.google/fx/tools/flow/*", "https://labs.google/fx/*/tools/flow/*"],
    "js": ["flowContentScript.js"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_title": "Majarra Flow Automator",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  },
  "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
  "side_panel": { "default_path": "sidepanel.html" }
}

with open(os.path.join(base_dir, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

background_js = """
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'executeInMainWorld') {
        chrome.scripting.executeScript({
            target: { tabId: request.tabId },
            world: 'MAIN',
            func: new Function('return (' + request.funcBody + ').apply(null, arguments)'),
            args: request.args || []
        }).then(results => {
            if (results && results[0]) {
                sendResponse({ success: true, result: results[0].result });
            } else {
                sendResponse({ success: false });
            }
        }).catch(err => {
            console.error(err);
            sendResponse({ success: false, error: err.toString() });
        });
        return true; 
    }
    
    if (request.action === 'downloadImage') {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename
        }, (downloadId) => {
            sendResponse({ success: true, downloadId });
        });
        return true;
    }
    
    // Relay from sidepanel to content script
    if (request.target === 'contentScript') {
        chrome.tabs.sendMessage(request.tabId, request, response => {
            sendResponse(response);
        });
        return true;
    }
});
"""

with open(os.path.join(base_dir, "background.js"), "w", encoding="utf-8") as f:
    f.write(background_js)

flow_content_script_js = """
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let isProcessing = false;
let currentPrompts = [];
let currentSettings = {};
let promptIndex = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startProcessing') {
        isProcessing = true;
        currentPrompts = message.prompts;
        currentSettings = message.settings;
        promptIndex = 0;
        showToast("Started processing...");
        setEdgeGlow('running');
        processNextPrompt();
        sendResponse({ success: true });
    } else if (message.action === 'stopProcessing') {
        isProcessing = false;
        showToast("Stopped processing.");
        setEdgeGlow('stopped');
        sendResponse({ success: true });
    }
});

async function processNextPrompt() {
    if (!isProcessing || promptIndex >= currentPrompts.length) {
        isProcessing = false;
        setEdgeGlow('stopped');
        showToast("All prompts completed!");
        chrome.runtime.sendMessage({ action: 'processComplete' });
        return;
    }

    const currentPromptData = currentPrompts[promptIndex];
    // prompt data format: text | filepath | size(ratio)
    const parts = currentPromptData.split('|');
    const promptText = parts[0].trim();
    
    showToast(`Processing prompt ${promptIndex + 1}/${currentPrompts.length}`);
    updateSidePanelProgress(promptIndex, currentPrompts.length, `Injecting prompt...`);

    // 1. Set Aspect Ratio (simplified logic, assumes settings panel is accessible)
    // await setAspectRatio(currentSettings.aspectRatio);

    // 2. Inject text
    await injectText(promptText);

    // 3. Take snapshot of tiles
    const oldTiles = getTileIds();

    // 4. Click Submit
    await clickSubmit();

    // 5. Wait for new tile
    updateSidePanelProgress(promptIndex, currentPrompts.length, `Waiting for generation...`);
    const newTileId = await waitForNewTile(oldTiles);

    if (newTileId && currentSettings.autoDownload) {
        updateSidePanelProgress(promptIndex, currentPrompts.length, `Downloading...`);
        // 6. Download via context menu
        await downloadTile(newTileId);
    }
    
    promptIndex++;
    await sleep(currentSettings.delay * 1000);
    processNextPrompt();
}

async function injectText(text) {
    const editor = document.querySelector('[data-slate-editor="true"]');
    if (!editor) return;
    
    editor.click();
    editor.focus();
    await sleep(150);
    
    editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a', code: 'KeyA', ctrlKey: true, keyCode: 65 }));
    await sleep(80);
    
    editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
    await sleep(400);
}

async function clickSubmit() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'executeInMainWorld',
            tabId: null, // the background script will use sender.tab.id if we don't pass it, actually wait, we need tabId. We will fix background to use sender tab
            funcBody: `function() {
                const buttons = Array.from(document.querySelectorAll('button'));
                const submitBtn = buttons.find(btn => {
                  const hasArrowForward = btn.querySelector('i')?.textContent.trim() === 'arrow_forward';
                  const hasSpanText = btn.querySelector('span')?.textContent.trim().length > 0;
                  return hasArrowForward && hasSpanText;
                });
                if (!submitBtn) return false;
                
                const fiberKey = Object.keys(submitBtn).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
                let node = submitBtn[fiberKey];
                let onClick = null;
                for (let i = 0; i < 50 && node; i++) {
                  if (node.memoizedProps?.onClick) { onClick = node.memoizedProps.onClick; break; }
                  node = node.return;
                }
                if (onClick) {
                    onClick({
                      isTrusted: true, type: 'click', bubbles: true, cancelable: true,
                      target: submitBtn, currentTarget: submitBtn,
                      nativeEvent: { isTrusted: true, type: 'click', target: submitBtn },
                      isDefaultPrevented: () => false, isPropagationStopped: () => false,
                      preventDefault: () => {}, stopPropagation: () => {}
                    });
                    return true;
                }
                return false;
            }`
        }, (response) => {
            resolve(response?.success);
        });
    });
}

function getTileIds() {
    return Array.from(document.querySelectorAll('[data-tile-id]')).map(el => el.getAttribute('data-tile-id'));
}

async function waitForNewTile(oldTiles) {
    let retries = 120; // up to 2 minutes
    while (retries > 0 && isProcessing) {
        const currentTiles = getTileIds();
        const newTiles = currentTiles.filter(id => !oldTiles.includes(id));
        
        for (const tileId of newTiles) {
            const tileEl = document.querySelector(`[data-tile-id="${tileId}"]`);
            if (tileEl) {
                const media = tileEl.querySelector('img[src*="media.getMediaUrlRedirect"], video[src*="media.getMediaUrlRedirect"]');
                if (media) return tileId; // Finished generating
            }
        }
        await sleep(1000);
        retries--;
    }
    return null;
}

async function downloadTile(tileId) {
    const tileEl = document.querySelector(`[data-tile-id="${tileId}"]`);
    if (!tileEl) return;
    
    // Right click
    tileEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }));
    await sleep(500);
    
    const menu = document.querySelector('[data-radix-menu-content][data-state="open"]');
    if (!menu) return;
    
    const downloadItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(item => item.textContent.toLowerCase().includes('download') || item.querySelector('i')?.textContent.includes('download'));
    if (downloadItem) {
        downloadItem.click();
        await sleep(500);
        // Maybe handle quality submenu if it appears
    }
}

function updateSidePanelProgress(index, total, statusText) {
    chrome.runtime.sendMessage({
        action: 'progressUpdate',
        index: index,
        total: total,
        status: statusText
    });
}

function showToast(message) {
    let toast = document.getElementById('majarra-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'majarra-toast';
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#06091A;color:#00D6F5;padding:10px 20px;border-radius:8px;z-index:999999;font-family:monospace;border:1px solid #00D6F5;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
}

function setEdgeGlow(state) {
    let glow = document.getElementById('majarra-glow');
    if (!glow) {
        glow = document.createElement('div');
        glow.id = 'majarra-glow';
        glow.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:999998;transition:box-shadow 0.5s ease;';
        document.body.appendChild(glow);
    }
    if (state === 'running') {
        glow.style.boxShadow = 'inset 0 0 20px 5px #00D6F5';
    } else if (state === 'paused') {
        glow.style.boxShadow = 'inset 0 0 20px 5px #FFD34D';
    } else {
        glow.style.boxShadow = 'none';
    }
}

// Intercept background script messages and attach tabId for executeInMainWorld
const originalSendMessage = chrome.runtime.sendMessage;
chrome.runtime.sendMessage = function(message, callback) {
    if (message.action === 'executeInMainWorld' && !message.tabId) {
        // We can't get our own tabId easily in content script synchronously, but background can use sender.tab.id
    }
    return originalSendMessage.apply(this, arguments);
};
"""

with open(os.path.join(base_dir, "flowContentScript.js"), "w", encoding="utf-8") as f:
    f.write(flow_content_script_js)

sidepanel_html = """
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>Majarra Flow Automator</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
        body {
            background-color: #06091A;
            color: white;
            font-family: 'Tajawal', sans-serif;
            margin: 0;
            padding: 15px;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
        }
        h2 { color: #00D6F5; margin-top: 0; text-align: center; font-size: 1.2rem; }
        .status-dot { height: 10px; width: 10px; background-color: red; border-radius: 50%; display: inline-block; margin-right: 5px; }
        .connected { background-color: #00ff00; }
        .header { display: flex; align-items: center; justify-content: center; margin-bottom: 15px; }
        
        button {
            background: linear-gradient(90deg, #00D6F5, #0056b3);
            border: none;
            color: white;
            padding: 10px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            font-family: 'Tajawal', sans-serif;
            margin-bottom: 10px;
            transition: opacity 0.2s;
        }
        button:hover { opacity: 0.8; }
        button#stopBtn { background: #dc3545; display: none; }
        
        textarea {
            background-color: #0a0e29;
            color: #FFD34D;
            border: 1px solid #00D6F5;
            border-radius: 5px;
            padding: 10px;
            font-family: monospace;
            resize: vertical;
            height: 150px;
            margin-bottom: 10px;
            direction: ltr;
            text-align: left;
        }
        
        .settings {
            background-color: #0a0e29;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 10px;
            border: 1px solid #333;
            font-size: 0.9rem;
        }
        .setting-row { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; }
        select, input { background: #06091A; color: white; border: 1px solid #00D6F5; padding: 4px; border-radius: 3px; font-family: inherit; }
        
        .progress-container { width: 100%; background-color: #333; border-radius: 5px; margin-bottom: 10px; overflow: hidden; }
        .progress-bar { width: 0%; height: 10px; background-color: #00D6F5; transition: width 0.3s; }
        
        .log {
            flex-grow: 1;
            background-color: #000;
            color: #00ff00;
            font-family: monospace;
            font-size: 0.8rem;
            padding: 10px;
            border-radius: 5px;
            overflow-y: auto;
            direction: ltr;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="status-dot" id="statusDot"></span>
        <h2>🚀 مجرة Flow Automator v3</h2>
    </div>
    
    <button id="loadPromptsBtn">📂 تحميل كنز برومبتات مجرة (209 برومبت)</button>
    <div style="display:flex; justify-content:space-between; font-size: 0.8rem; margin-bottom: 5px;">
        <span>البرومبتات:</span>
        <span id="queueCount">0 برومبت</span>
    </div>
    <textarea id="promptsInput" placeholder="Enter prompts here... (Prompt | filepath | size)"></textarea>
    
    <div class="settings">
        <div class="setting-row">
            <label>Delay (sec):</label>
            <input type="number" id="delayInput" value="8" min="1" style="width: 50px;">
        </div>
        <div class="setting-row">
            <label>Aspect Ratio:</label>
            <select id="ratioSelect">
                <option value="auto">Auto from prompt</option>
                <option value="16:9">16:9 (Landscape)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="3:4">3:4 (Portrait)</option>
                <option value="9:16">9:16 (Tall)</option>
            </select>
        </div>
        <div class="setting-row">
            <label>Model:</label>
            <select id="modelSelect">
                <option value="nano2">Nano Banana 2</option>
                <option value="nanoPro">Nano Banana Pro</option>
            </select>
        </div>
        <div class="setting-row">
            <label>Auto Download:</label>
            <input type="checkbox" id="autoDownload" checked>
        </div>
    </div>
    
    <button id="startBtn">▶️ بدء الأتمتة التلقائية</button>
    <button id="stopBtn">⏹️ إيقاف</button>
    
    <div class="progress-container">
        <div class="progress-bar" id="progressBar"></div>
    </div>
    
    <div class="log" id="logArea"></div>

    <script src="IMAGE_PROMPTS_PRESET.js"></script>
    <script>
        const statusDot = document.getElementById('statusDot');
        const loadPromptsBtn = document.getElementById('loadPromptsBtn');
        const promptsInput = document.getElementById('promptsInput');
        const queueCount = document.getElementById('queueCount');
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const logArea = document.getElementById('logArea');
        const progressBar = document.getElementById('progressBar');
        
        let activeTabId = null;
        
        function log(msg) {
            logArea.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`;
            logArea.scrollTop = logArea.scrollHeight;
        }

        async function checkConnection() {
            try {
                let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.url.includes('labs.google/fx')) {
                    activeTabId = tab.id;
                    statusDot.classList.add('connected');
                } else {
                    activeTabId = null;
                    statusDot.classList.remove('connected');
                }
            } catch (e) {
                activeTabId = null;
                statusDot.classList.remove('connected');
            }
        }
        
        setInterval(checkConnection, 2000);
        checkConnection();
        
        promptsInput.addEventListener('input', () => {
            const lines = promptsInput.value.split('\\n').filter(l => l.trim().length > 0);
            queueCount.textContent = `${lines.length} برومبت`;
        });
        
        loadPromptsBtn.addEventListener('click', () => {
            if (window.MAJARRA_PROMPTS_PRESET) {
                promptsInput.value = window.MAJARRA_PROMPTS_PRESET;
                promptsInput.dispatchEvent(new Event('input'));
                log("Loaded default prompts.");
            } else {
                log("Error: Preset not found.");
            }
        });
        
        startBtn.addEventListener('click', () => {
            if (!activeTabId) {
                log("Error: Please open Google Flow tab first.");
                return;
            }
            const prompts = promptsInput.value.split('\\n').filter(l => l.trim().length > 0);
            if (prompts.length === 0) {
                log("Error: No prompts to process.");
                return;
            }
            
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            progressBar.style.width = '0%';
            
            const settings = {
                delay: parseInt(document.getElementById('delayInput').value) || 8,
                aspectRatio: document.getElementById('ratioSelect').value,
                model: document.getElementById('modelSelect').value,
                autoDownload: document.getElementById('autoDownload').checked
            };
            
            log("Starting automation...");
            chrome.tabs.sendMessage(activeTabId, {
                action: 'startProcessing',
                prompts: prompts,
                settings: settings
            });
        });
        
        stopBtn.addEventListener('click', () => {
            if (activeTabId) {
                chrome.tabs.sendMessage(activeTabId, { action: 'stopProcessing' });
            }
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            log("Automation stopped.");
        });
        
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === 'progressUpdate') {
                const percent = ((msg.index) / msg.total) * 100;
                progressBar.style.width = `${percent}%`;
                log(`[${msg.index + 1}/${msg.total}] ${msg.status}`);
            } else if (msg.action === 'processComplete') {
                startBtn.style.display = 'block';
                stopBtn.style.display = 'none';
                progressBar.style.width = '100%';
                log("All done!");
            }
        });
    </script>
</body>
</html>
"""

with open(os.path.join(base_dir, "sidepanel.html"), "w", encoding="utf-8") as f:
    f.write(sidepanel_html)

# Read the prompts and create IMAGE_PROMPTS_PRESET.js
with open(r"f:\\Projects\\cartoonapp\\IMAGE_PROMPTS.txt", "r", encoding="utf-8") as f:
    prompts_content = f.read()

# escape backticks and dollar signs for template literal or use JSON stringify
prompts_js = f"window.MAJARRA_PROMPTS_PRESET = {json.dumps(prompts_content)};"

with open(os.path.join(base_dir, "IMAGE_PROMPTS_PRESET.js"), "w", encoding="utf-8") as f:
    f.write(prompts_js)
    
# Fix background.js handling of tabId
background_js_fixed = background_js.replace("target: { tabId: request.tabId },", "target: { tabId: request.tabId || sender.tab.id },")

with open(os.path.join(base_dir, "background.js"), "w", encoding="utf-8") as f:
    f.write(background_js_fixed)

print("All files created successfully.")
