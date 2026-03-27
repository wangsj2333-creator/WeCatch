const BACKEND_URL = 'http://localhost:8080';
const API_KEY = 'dev-key';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_CAPTURE') {
    handleCapture(msg.articleIds)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function handleCapture(articleIds) {
  console.log('handleCapture articleIds:', articleIds);
  const results = [];

  for (let i = 0; i < articleIds.length; i++) {
    // Push progress to popup
    chrome.runtime.sendMessage({
      type: 'PROGRESS',
      current: i + 1,
      total: articleIds.length,
    });

    // Ask content script to fetch this article's comments
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const raw = await chrome.tabs.sendMessage(tab.id, {
      type: 'CAPTURE_COMMENTS',
      articleId: articleIds[i],
    });

    // Send to backend
    console.log('[wecatch] sending to backend:', JSON.stringify(raw.data));
    const resp = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify(raw.data),
    });
    console.log('[wecatch] backend status:', resp.status);
    const responseText = await resp.text();
    console.log('[wecatch] backend response:', responseText);
    if (!resp.ok) {
      throw new Error(`backend error: ${resp.status}`);
    }
    const data = JSON.parse(responseText);
    results.push(data);
  }

  // Store results in session storage
  await chrome.storage.session.set({ wecatchResults: results });

  // Notify popup: done
  chrome.runtime.sendMessage({ type: 'CAPTURE_DONE', total: results.length });
}
