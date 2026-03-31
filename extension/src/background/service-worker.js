const BACKEND_URL = 'http://localhost:8080';
const API_KEY = 'dev-key';
const ALARM_NAME = 'wecatch-poll';
const DEFAULT_INTERVAL = 5; // minutes

// ─────────────────────────────────────────
// Alarm helpers
// ─────────────────────────────────────────

async function getInterval() {
  const { wecatch_interval } = await chrome.storage.local.get('wecatch_interval');
  return wecatch_interval ?? DEFAULT_INTERVAL;
}

async function ensureAlarm() {
  const interval = await getInterval();
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: interval });
    console.log(`[wecatch] alarm created, period=${interval}min`);
  }
}

async function resetAlarm(interval) {
  await chrome.storage.local.set({ wecatch_interval: interval });
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: interval });
  console.log(`[wecatch] alarm reset, period=${interval}min`);
}

// ─────────────────────────────────────────
// Lifecycle: install + startup
// ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await ensureAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await ensureAlarm();
});

// ─────────────────────────────────────────
// Alarm handler
// ─────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  // Rebuild alarm if somehow lost (safety net)
  await ensureAlarm();

  // Capturing lock: skip if already running
  const { wecatch_is_capturing } = await chrome.storage.local.get('wecatch_is_capturing');
  if (wecatch_is_capturing) {
    console.log('[wecatch] alarm fired but capture lock is set, skipping');
    return;
  }

  console.log('[wecatch] alarm fired');

  // Set capturing lock
  await chrome.storage.local.set({ wecatch_is_capturing: true });
  try {
    // Find WeChat backend tab
    const tabs = await chrome.tabs.query({ url: 'https://mp.weixin.qq.com/*' });
    if (tabs.length === 0) {
      console.log('[wecatch] no WeChat tab found');
      broadcastMessage({ type: 'NO_WX_TAB' });
      return;
    }

    const tab = tabs[0];
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: 'FETCH_AND_CAPTURE' });
    } catch (e) {
      if (e.message && e.message.includes('Could not establish connection')) {
        broadcastMessage({ type: 'CAPTURE_ERROR', error: 'content_script_not_injected' });
        return;
      }
      throw e;
    }

    if (!response || !response.ok) {
      broadcastMessage({ type: 'CAPTURE_ERROR', error: response?.error || 'unknown' });
      return;
    }

    const { articles, newTopLevelCount } = response.data;
    const lastRun = new Date().toISOString();

    await chrome.storage.local.set({
      wecatch_articles: articles,
      wecatch_last_run: lastRun,
      wecatch_last_new_count: newTopLevelCount,
    });

    if (response.data.error) {
      console.warn('[wecatch] capture completed with analyze error:', response.data.error);
      broadcastMessage({ type: 'CAPTURE_ERROR', error: response.data.error });
    } else {
      broadcastMessage({ type: 'POLL_DONE', lastRun, newCount: newTopLevelCount });
    }
  } finally {
    await chrome.storage.local.set({ wecatch_is_capturing: false });
  }
});

// ─────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SET_INTERVAL') {
    resetAlarm(msg.interval)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'GET_STATUS') {
    handleGetStatus()
      .then(status => sendResponse(status))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (msg.type === 'START_CAPTURE') {
    handleCapture(msg.articleIds)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (msg.type === 'OPEN_WX_TAB') {
    chrome.tabs.create({ url: 'https://mp.weixin.qq.com' });
    return false;
  }
});

async function handleGetStatus() {
  const { wecatch_last_run, wecatch_last_new_count } = await chrome.storage.local.get([
    'wecatch_last_run',
    'wecatch_last_new_count',
  ]);

  const alarm = await chrome.alarms.get(ALARM_NAME);

  return {
    lastRun: wecatch_last_run ?? null,
    newCount: wecatch_last_new_count ?? null,
    nextAlarmTime: alarm ? alarm.scheduledTime : null,
  };
}

// ─────────────────────────────────────────
// Broadcast helper
// ─────────────────────────────────────────

function broadcastMessage(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Side panel may not be open — ignore connection errors
  });
}

// ─────────────────────────────────────────
// Legacy capture flow (preserved for Sprint 1 compatibility)
// ─────────────────────────────────────────

async function handleCapture(articleIds) {
  console.log('handleCapture articleIds:', articleIds);
  const results = [];

  for (let i = 0; i < articleIds.length; i++) {
    chrome.runtime.sendMessage({
      type: 'PROGRESS',
      current: i + 1,
      total: articleIds.length,
    });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const raw = await chrome.tabs.sendMessage(tab.id, {
      type: 'CAPTURE_COMMENTS',
      articleId: articleIds[i],
    });

    const resp = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify(raw.data),
    });
    if (!resp.ok) {
      throw new Error(`backend error: ${resp.status}`);
    }
    const data = await resp.json();
    results.push(data);
  }

  chrome.runtime.sendMessage({ type: 'CAPTURE_DONE', total: results.length });
}
