// WeCatch popup script
// Runs in the extension popup context — no build step, plain ES5-compatible JS.

const BACKEND_URL = "http://localhost:8080";

// DOM references
const statusBar   = document.getElementById("status-bar");
const btnDashboard = document.getElementById("btn-dashboard");
const btnCapture  = document.getElementById("btn-capture");
const resultArea  = document.getElementById("result-area");

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

// Read JWT + username from storage and update the status bar.
function loadAuthState(callback) {
  chrome.storage.local.get(["jwt", "username"], function (data) {
    if (data.jwt && data.username) {
      statusBar.textContent = "已登录：" + data.username;
      statusBar.classList.add("logged-in");
      callback(data.jwt);
    } else {
      statusBar.textContent = "未登录";
      statusBar.classList.remove("logged-in");
      callback(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Tab detection
// ---------------------------------------------------------------------------

// Check whether the active tab is on mp.weixin.qq.com and update capture button.
function isCommentPage(url) {
  return url.includes("mp.weixin.qq.com") && (
    url.includes("appmsgcomment") ||
    url.includes("action=list") && url.includes("comment")
  );
}

function checkActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (tab && tab.url && isCommentPage(tab.url)) {
      btnCapture.disabled = false;
      btnCapture.removeAttribute("title");
    } else {
      btnCapture.disabled = true;
      btnCapture.title = "请在留言管理页面使用";
    }
  });
}

// ---------------------------------------------------------------------------
// Result display helpers
// ---------------------------------------------------------------------------

function showResult(message, isError) {
  resultArea.textContent = message;
  resultArea.className = isError ? "error" : "success";
}

function clearResult() {
  resultArea.textContent = "";
  resultArea.className = "";
}

// ---------------------------------------------------------------------------
// Button: Open Dashboard
// ---------------------------------------------------------------------------

btnDashboard.addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// ---------------------------------------------------------------------------
// Button: Capture Comments
// ---------------------------------------------------------------------------

btnCapture.addEventListener("click", function () {
  clearResult();
  btnCapture.disabled = true;
  btnCapture.textContent = "Capturing…";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (!tab) {
      showResult("无法获取当前标签页", true);
      resetCaptureButton();
      return;
    }

    // Step 1: ask content script to scrape the page
    chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_COMMENTS" }, function (response) {
      if (chrome.runtime.lastError) {
        showResult("无法连接到内容脚本：" + chrome.runtime.lastError.message, true);
        resetCaptureButton();
        return;
      }

      if (!response || !response.ok || !response.data) {
        showResult(response && response.error ? response.error : "内容脚本未返回留言数据", true);
        resetCaptureButton();
        return;
      }

      // Step 2: POST to backend
      chrome.storage.local.get(["jwt"], function (data) {
        if (!data.jwt) {
          showResult("请先登录后再抓取留言", true);
          resetCaptureButton();
          return;
        }

        fetch(BACKEND_URL + "/api/comments/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + data.jwt
          },
          body: JSON.stringify({
            comments: response.data.comments,
            account:  response.data.account,
            article:  response.data.article
          })
        })
          .then(function (res) {
            if (!res.ok) {
              return res.text().then(function (text) {
                throw new Error("HTTP " + res.status + ": " + text);
              });
            }
            return res.json();
          })
          .then(function (json) {
            // Expected: { new_comments: N, skipped: M }
            var created = json.new_comments != null ? json.new_comments : "?";
            var skipped = json.skipped != null ? json.skipped : "?";
            showResult("捕获 " + created + " 条新留言，跳过 " + skipped + " 条重复", false);
          })
          .catch(function (err) {
            showResult("提交失败：" + err.message, true);
          })
          .finally(function () {
            resetCaptureButton();
          });
      });
    });
  });
});

// Re-enable capture button after an operation completes.
function resetCaptureButton() {
  btnCapture.textContent = "Capture Comments";
  checkActiveTab(); // re-evaluates disabled state based on current tab
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadAuthState(function (jwt) {
  // jwt unused here; auth check happens inside the capture handler
});
checkActiveTab();
