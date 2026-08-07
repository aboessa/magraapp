/**
 * Majarra Flow Automator - Background Service Worker v4.1
 * Uses Google Flow API directly for reliable aspect ratio control.
 * v4.1: Added detailed step-by-step error reporting.
 */

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// === Download filename mapping ===
const pendingFilenames = new Map();

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    const custom = pendingFilenames.get(item.id);
    if (custom) {
        suggest({ filename: custom, conflictAction: 'uniquify' });
        pendingFilenames.delete(item.id);
    }
});

chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state?.current === 'complete' || delta.state?.current === 'interrupted') {
        pendingFilenames.delete(delta.id);
    }
});

const RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';

// ── Helper: run a function in the page's MAIN world and return result ──
function runInMain(tabId, fn, args) {
    return chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: fn,
        args: args || []
    }).then(results => {
        return results?.[0]?.result ?? null;
    }).catch(e => {
        console.error('[runInMain] executeScript error:', e.message);
        return { __error: e.message };
    });
}

// === Message Handler ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // ──────────────────────────────────────────────
    // ACTION: debugPageState  (test what's available)
    // ──────────────────────────────────────────────
    if (request.action === 'debugPageState') {
        const tabId = request.tabId || (sender.tab && sender.tab.id);
        if (!tabId) { sendResponse({ error: 'no_tab' }); return true; }

        runInMain(tabId, () => {
            const projectMatch = window.location.href.match(/project\/([a-f0-9-]+)/);
            return {
                url: window.location.href,
                hasProject: !!projectMatch,
                projectId: projectMatch?.[1] || null,
                hasGrecaptcha: typeof window.grecaptcha !== 'undefined',
                hasEnterprise: typeof window.grecaptcha?.enterprise !== 'undefined',
            };
        }).then(r => sendResponse(r || { error: 'null_result' }));
        return true;
    }

    // ──────────────────────────────────────────────
    // ACTION: generateImageAPI
    // Step-by-step with detailed error codes
    // ──────────────────────────────────────────────
    if (request.action === 'generateImageAPI') {
        const tabId = request.tabId || (sender.tab && sender.tab.id);
        if (!tabId) {
            sendResponse({ success: false, error: 'ERR_NO_TAB_ID' });
            return true;
        }

        // STEP 1: Get auth token
        runInMain(tabId, async () => {
            try {
                const resp = await fetch('/fx/api/auth/session', {
                    credentials: 'include'
                });
                if (!resp.ok) return { error: 'AUTH_HTTP_' + resp.status };
                const data = await resp.json();
                if (!data.access_token) return { error: 'AUTH_NO_TOKEN', keys: Object.keys(data).join(',') };
                return { token: data.access_token };
            } catch (e) {
                return { error: 'AUTH_FETCH_EX:' + e.message };
            }
        }).then(authResult => {
            if (authResult?.__error) {
                sendResponse({ success: false, error: 'SCRIPT_ERR:' + authResult.__error });
                return;
            }
            if (authResult?.error) {
                sendResponse({ success: false, error: authResult.error });
                return;
            }
            if (!authResult?.token) {
                sendResponse({ success: false, error: 'AUTH_NULL_RESULT' });
                return;
            }

            const authToken = authResult.token;

            // STEP 2: Get project ID
            runInMain(tabId, () => {
                const m = window.location.href.match(/project\/([a-f0-9-]+)/);
                return m ? { projectId: m[1] } : { error: 'NO_PROJECT_IN_URL', url: window.location.href };
            }).then(projResult => {
                if (projResult?.error) {
                    sendResponse({ success: false, error: projResult.error + ' | ' + (projResult.url || '') });
                    return;
                }
                if (!projResult?.projectId) {
                    sendResponse({ success: false, error: 'PROJ_NULL_RESULT' });
                    return;
                }

                const projectId = projResult.projectId;

                // STEP 3: Get reCAPTCHA token
                runInMain(tabId, async (siteKey) => {
                    try {
                        try { localStorage.removeItem('_grecaptcha'); } catch (e) {}
                        if (typeof window.grecaptcha === 'undefined') {
                            return { error: 'RECAPTCHA_UNDEFINED' };
                        }
                        const enterprise = window.grecaptcha.enterprise;
                        if (!enterprise) {
                            return { error: 'RECAPTCHA_NO_ENTERPRISE', keys: Object.keys(window.grecaptcha).join(',') };
                        }
                        const token = await enterprise.execute(siteKey, { action: 'IMAGE_GENERATION' });
                        if (!token) return { error: 'RECAPTCHA_EMPTY_TOKEN' };
                        return { token };
                    } catch (e) {
                        return { error: 'RECAPTCHA_EX:' + e.message };
                    }
                }, [RECAPTCHA_SITE_KEY]).then(rcResult => {
                    if (rcResult?.__error) {
                        sendResponse({ success: false, error: 'RECAPTCHA_SCRIPT_ERR:' + rcResult.__error });
                        return;
                    }
                    if (rcResult?.error) {
                        sendResponse({ success: false, error: rcResult.error });
                        return;
                    }
                    if (!rcResult?.token) {
                        sendResponse({ success: false, error: 'RECAPTCHA_NULL_RESULT' });
                        return;
                    }

                    const rcToken = rcResult.token;

                    // STEP 4: Call the generation API
                    const promptText  = request.promptText;
                    const aspectRatio = request.aspectRatio || 'IMAGE_ASPECT_RATIO_LANDSCAPE';
                    const modelName   = request.model || 'NARWHAL';

                    const sessionId = ';' + Date.now() + Math.random().toString(36).slice(2);
                    const batchId   = Date.now().toString(36) + Math.random().toString(36).slice(2);
                    const seed      = Math.floor(Math.random() * 2147483647);

                    const ctxBase = {
                        recaptchaContext: {
                            applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB',
                            token: rcToken
                        },
                        projectId: projectId,
                        tool: 'PINHOLE',
                        sessionId: sessionId
                    };

                    const apiUrl = `https://aisandbox-pa.googleapis.com/v1/projects/${projectId}/flowMedia:batchGenerateImages`;
                    const body = JSON.stringify({
                        clientContext: { ...ctxBase },
                        mediaGenerationContext: { batchId },
                        useNewMedia: true,
                        requests: [{
                            clientContext: { ...ctxBase },
                            imageAspectRatio: aspectRatio,
                            imageInputs: [],
                            imageModelName: modelName,
                            seed: seed,
                            structuredPrompt: { parts: [{ text: promptText }] }
                        }]
                    });

                    runInMain(tabId, async (url, bodyStr, token) => {
                        try {
                            const controller = new AbortController();
                            const tm = setTimeout(() => controller.abort(), 90000);
                            const resp = await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'text/plain;charset=UTF-8',
                                    'Authorization': 'Bearer ' + token
                                },
                                body: bodyStr,
                                signal: controller.signal
                            });
                            clearTimeout(tm);
                            const text = await resp.text();
                            if (!resp.ok) return { error: 'API_HTTP_' + resp.status, detail: text.substring(0, 400) };
                            let parsed;
                            try { parsed = JSON.parse(text); } catch { return { error: 'API_JSON_PARSE', raw: text.substring(0, 200) }; }
                            return { success: true, data: parsed };
                        } catch (e) {
                            if (e.name === 'AbortError') return { error: 'API_TIMEOUT_90S' };
                            return { error: 'API_FETCH_EX:' + e.message };
                        }
                    }, [apiUrl, body, authToken]).then(apiResult => {
                        if (apiResult?.__error) {
                            sendResponse({ success: false, error: 'API_SCRIPT_ERR:' + apiResult.__error });
                            return;
                        }
                        if (apiResult?.error) {
                            sendResponse({ success: false, error: apiResult.error, detail: apiResult.detail || apiResult.raw || '' });
                            return;
                        }
                        if (!apiResult?.data) {
                            sendResponse({ success: false, error: 'API_NULL_DATA' });
                            return;
                        }

                        const data = apiResult.data;

                        // Extract mediaId
                        let mediaId = null;
                        if (data?.workflows) {
                            for (const wf of data.workflows) {
                                const mid = wf?.metadata?.primaryMediaId;
                                if (mid) { mediaId = mid; break; }
                            }
                        }
                        if (!mediaId && data?.media) {
                            for (const m of data.media) {
                                const mid = m?.name || m?.mediaId;
                                if (mid) { mediaId = mid; break; }
                            }
                        }

                        if (!mediaId) {
                            const rawKeys = Object.keys(data).join(',');
                            sendResponse({ success: false, error: 'NO_MEDIA_ID', detail: 'keys=' + rawKeys });
                            return;
                        }

                        sendResponse({ success: true, mediaId });
                    }).catch(e => sendResponse({ success: false, error: 'API_CHAIN_EX:' + e.message }));

                }).catch(e => sendResponse({ success: false, error: 'RC_CHAIN_EX:' + e.message }));
            }).catch(e => sendResponse({ success: false, error: 'PROJ_CHAIN_EX:' + e.message }));
        }).catch(e => sendResponse({ success: false, error: 'AUTH_CHAIN_EX:' + e.message }));

        return true; // async
    }

    // ──────────────────────────────────────────────
    // ACTION: downloadImageWithName
    // ──────────────────────────────────────────────
    if (request.action === 'downloadImageWithName') {
        const url            = request.url;
        const customFilename = request.filename || 'majarra_image.png';

        chrome.downloads.download({
            url,
            saveAs: false,
            conflictAction: 'uniquify'
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                pendingFilenames.set(downloadId, customFilename);
                sendResponse({ success: true, downloadId });
            }
        });
        return true;
    }

    // ──────────────────────────────────────────────
    // ACTION: downloadByMediaId
    // ──────────────────────────────────────────────
    if (request.action === 'downloadByMediaId') {
        const tabId    = request.tabId || (sender.tab && sender.tab.id);
        const mediaId  = request.mediaId;
        const filename = request.filename || 'majarra_image.png';

        if (!tabId || !mediaId) {
            sendResponse({ success: false, error: 'MISSING_PARAMS' });
            return true;
        }

        // Try to create a blob URL in MAIN world (avoids CORS)
        runInMain(tabId, async (mid) => {
            try {
                const redirectUrl = `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${mid}`;
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((res, rej) => {
                    img.onload = res;
                    img.onerror = () => rej(new Error('img_load_failed'));
                    img.src = redirectUrl;
                });
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                const blobUrl = await new Promise((res, rej) => {
                    canvas.toBlob(blob => blob ? res(URL.createObjectURL(blob)) : rej(new Error('toBlob_null')), 'image/png');
                });
                return { success: true, blobUrl, w: img.naturalWidth, h: img.naturalHeight };
            } catch (e) {
                // Return the redirect URL as direct fallback
                const fallbackUrl = `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${mid}`;
                return { success: true, blobUrl: fallbackUrl, fallback: true, fallbackErr: e.message };
            }
        }, [mediaId]).then(result => {
            if (!result?.success) {
                sendResponse({ success: false, error: result?.error || 'BLOB_SCRIPT_NULL' });
                return;
            }

            chrome.downloads.download({
                url: result.blobUrl,
                saveAs: false,
                conflictAction: 'uniquify'
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    pendingFilenames.set(downloadId, filename);
                    sendResponse({ success: true, downloadId, w: result.w, h: result.h, fallback: result.fallback });

                    // Revoke blob URL
                    if (!result.fallback && result.blobUrl.startsWith('blob:')) {
                        setTimeout(() => {
                            runInMain(tabId, (u) => URL.revokeObjectURL(u), [result.blobUrl]).catch(() => {});
                        }, 8000);
                    }
                }
            });
        }).catch(e => sendResponse({ success: false, error: 'DL_CHAIN_EX:' + e.message }));

        return true;
    }


    // Content script messages (progressUpdate, processComplete, rateLimitPause)
    // already reach sidepanel directly via chrome.runtime.sendMessage.
    // NO relay needed here - it would cause duplicate entries in the log.
    return false;
});

