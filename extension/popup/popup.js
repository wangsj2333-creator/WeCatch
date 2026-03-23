// WeCatch popup script
// Phase 1 (on open): fetch article list from content script and render checkboxes.
// Phase 2 (on capture): send selected articles to content script, POST results to backend.

const BACKEND_URL = "http://localhost:8080";

// DOM references
const statusBar        = document.getElementById("status-bar");
const btnDashboard     = document.getElementById("btn-dashboard");
const btnCapture       = document.getElementById("btn-capture");
const resultArea       = document.getElementById("result-area");
const articleSection   = document.getElementById("article-section");
const articleList      = document.getElementById("article-list");
const articleLoading   = document.getElementById("article-loading");
const articleTitle     = document.getElementById("article-section-title");
const chkSelectAll     = document.getElementById("chk-select-all");

// Article data fetched in phase 1
var fetchedArticles = [];

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

function loadAuthState(callback) {
  chrome.storage.local.get(["jwt", "username"], function (data) {
    if (data.jwt) {
      statusBar.textContent = "已登录" + (data.username ? "：" + data.username : "");
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

function isWeChatMPPage(url) {
  return url && url.includes("mp.weixin.qq.com");
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
// Article list rendering
// ---------------------------------------------------------------------------

function renderArticleList(articles) {
  fetchedArticles = articles;
  articleLoading.style.display = "none";

  if (articles.length === 0) {
    var empty = document.createElement("div");
    empty.style.cssText = "padding:14px 12px;font-size:13px;color:#888;text-align:center;";
    empty.textContent = "暂无有留言的文章";
    articleList.appendChild(empty);
    articleTitle.textContent = "0 篇";
    btnCapture.disabled = true;
    return;
  }

  articleTitle.textContent = articles.length + " 篇";

  articles.forEach(function (article) {
    var item = document.createElement("div");
    item.className = "article-item";

    var chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = true;
    chk.dataset.commentId = article.comment_id;
    chk.addEventListener("change", updateSelectAll);

    var text = document.createElement("div");
    text.className = "article-item-text";

    var title = document.createElement("div");
    title.className = "article-title";
    title.textContent = article.title;

    var count = document.createElement("div");
    count.className = "article-count";
    count.textContent = article.comment_count + " 条留言";

    text.appendChild(title);
    text.appendChild(count);
    item.appendChild(chk);
    item.appendChild(text);

    // clicking the row also toggles the checkbox
    item.addEventListener("click", function (e) {
      if (e.target !== chk) {
        chk.checked = !chk.checked;
        updateSelectAll();
      }
    });

    articleList.appendChild(item);
  });

  // Explicitly sync button state with actual checkbox state
  updateSelectAll();
}

function updateSelectAll() {
  var checkboxes = articleList.querySelectorAll("input[type='checkbox']");
  var checked = Array.from(checkboxes).filter(function (c) { return c.checked; });
  chkSelectAll.checked = checked.length === checkboxes.length;
  chkSelectAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
  btnCapture.disabled = checked.length === 0;
}

function getSelectedCommentIds() {
  var checkboxes = articleList.querySelectorAll("input[type='checkbox']:checked");
  return Array.from(checkboxes).map(function (c) { return c.dataset.commentId; });
}

// ---------------------------------------------------------------------------
// Phase 1: load article list when popup opens on a WeChat MP page
// ---------------------------------------------------------------------------

function loadArticleList(tab) {
  articleSection.style.display = "block";

  chrome.tabs.sendMessage(tab.id, { type: "FETCH_ARTICLES" }, function (response) {
    if (chrome.runtime.lastError || !response || !response.ok) {
      articleLoading.textContent = "加载失败：" + (
        (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || "未知错误"
      );
      return;
    }
    renderArticleList(response.data.articles || []);
  });
}

// ---------------------------------------------------------------------------
// Button: Open Dashboard
// ---------------------------------------------------------------------------

btnDashboard.addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// ---------------------------------------------------------------------------
// Select-all checkbox
// ---------------------------------------------------------------------------

chkSelectAll.addEventListener("change", function () {
  var checkboxes = articleList.querySelectorAll("input[type='checkbox']");
  checkboxes.forEach(function (c) { c.checked = chkSelectAll.checked; });
  btnCapture.disabled = !chkSelectAll.checked;
});

// ---------------------------------------------------------------------------
// Button: Capture selected articles
// ---------------------------------------------------------------------------

btnCapture.addEventListener("click", function () {
  clearResult();
  var selectedIds = getSelectedCommentIds();
  if (selectedIds.length === 0) {
    showResult("请至少选择一篇文章", true);
    return;
  }

  btnCapture.disabled = true;
  btnCapture.textContent = "抓取中…";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab) {
      showResult("无法获取当前标签页", true);
      resetCaptureButton();
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      type: "CAPTURE_COMMENTS",
      selectedCommentIds: selectedIds
    }, function (response) {
      if (chrome.runtime.lastError) {
        showResult("无法连接内容脚本：" + chrome.runtime.lastError.message, true);
        resetCaptureButton();
        return;
      }

      if (!response || !response.ok || !response.data) {
        showResult(response && response.error ? response.error : "内容脚本未返回数据", true);
        resetCaptureButton();
        return;
      }

      // POST each article group to backend
      chrome.storage.local.get(["jwt"], function (data) {
        if (!data.jwt) {
          showResult("请先登录后再抓取留言", true);
          resetCaptureButton();
          return;
        }

        var articleGroups = response.data.articleGroups;
        var account = response.data.account;
        var totalNew = 0;
        var totalSkipped = 0;

        function postNext(index) {
          if (index >= articleGroups.length) {
            showResult("捕获 " + totalNew + " 条新留言，跳过 " + totalSkipped + " 条重复", false);
            resetCaptureButton();
            // Auto-open dashboard after short delay
            setTimeout(function () {
              chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
            }, 1200);
            return;
          }

          var group = articleGroups[index];
          fetch(BACKEND_URL + "/api/comments/batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + data.jwt
            },
            body: JSON.stringify({
              comments: group.comments,
              account:  account,
              article:  group.article
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
              totalNew     += json.new_comments != null ? json.new_comments : 0;
              totalSkipped += json.skipped      != null ? json.skipped      : 0;
              postNext(index + 1);
            })
            .catch(function (err) {
              showResult("提交失败（第 " + (index + 1) + " 篇）：" + err.message, true);
              resetCaptureButton();
            });
        }

        postNext(0);
      });
    });
  });
});

function resetCaptureButton() {
  btnCapture.textContent = "抓取选中文章";
  var selectedIds = getSelectedCommentIds();
  btnCapture.disabled = selectedIds.length === 0;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadAuthState(function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (tab && isWeChatMPPage(tab.url)) {
      loadArticleList(tab);
    }
  });
});
