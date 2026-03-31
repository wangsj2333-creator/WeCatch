// content-script.js — WeCatch v2 content script
// Runs on mp.weixin.qq.com.
// Handles three message types:
//   FETCH_ARTICLES              → returns article list with comment counts
//   CAPTURE_COMMENTS (articleId) → fetches all comments for one article
//   FETCH_AND_CAPTURE           → full pipeline: fetch + incremental diff + classify

(function () {
  "use strict";

  const BACKEND_URL = "http://localhost:8080";
  const API_KEY = "dev-key";

  console.log("[WeCatch] content script loaded");

  // Only handle messages when on the WeChat comment management page
  const isCommentPage = () =>
    window.location.href.includes("appmsgcomment") ||
    window.location.href.includes("newappmsgmgr");

  // ── API helpers ────────────────────────────────────────────────────────────

  function baseParams() {
    const p = new URLSearchParams(location.search);
    return {
      token: p.get("token") || "",
      sendtype: p.get("sendtype") || "",
      lang: p.get("lang") || "zh_CN",
    };
  }

  function appmsgcommentUrl(extra) {
    const params = new URLSearchParams({ f: "json", ajax: "1", ...baseParams(), ...extra });
    return `https://mp.weixin.qq.com/misc/appmsgcomment?${params.toString()}`;
  }

  async function apiFetch(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  // ── Account metadata ───────────────────────────────────────────────────────

  function extractAccount() {
    const nameEl =
      document.querySelector(".weui-desktop-account__name") ||
      document.querySelector("[class*='account_name']") ||
      document.querySelector("[class*='accountName']");
    const name = nameEl ? nameEl.textContent.trim() : "";
    const fakeIdMatch = location.href.match(/[?&]fakeid=([^&]+)/);
    const wx_account_id = fakeIdMatch ? decodeURIComponent(fakeIdMatch[1]) : "";
    return { wx_account_id, name };
  }

  // ── Article list ───────────────────────────────────────────────────────────

  async function fetchArticleList() {
    let items = [];
    try {
      const json = await apiFetch(appmsgcommentUrl({
        action: "get_appmsg_comment",
        begin: "0",
        count: "50",
        sort_type: "0",
      }));
      items = json.item || [];
    } catch (e) {
      console.warn("[WeCatch] get_appmsg_comment failed, trying unread variant:", e);
    }

    if (items.length === 0) {
      const json = await apiFetch(appmsgcommentUrl({
        action: "get_unread_appmsg_comment",
        begin: "0",
        count: "50",
        sort_type: "0",
      }));
      items = json.item || [];
    }

    const validItems = items.filter((item) => item.comment_id);

    // Fetch article title for each item via list_comment (count=1 for speed)
    const results = await Promise.all(
      validItems.map(async (item) => {
        let title = "";
        try {
          const detail = await apiFetch(appmsgcommentUrl({
            action: "list_comment",
            comment_id: item.comment_id,
            begin: "0",
            count: "1",
            filtertype: "0",
            day: "0",
            type: "2",
            max_id: "0",
          }));
          const parsed = typeof detail.comment_list === "string"
            ? JSON.parse(detail.comment_list)
            : detail.comment_list;
          title = parsed?.title || detail.base_info?.title || "";
        } catch (e) {
          // title stays empty, will fall back to "(无标题)"
        }
        return {
          comment_id: item.comment_id,
          title: title || "(无标题)",
          comment_count: item.total_count ?? item.comment_num ?? 0,
        };
      })
    );

    return results;
  }

  // ── Comment capture for a single article ──────────────────────────────────

  // Fetch all top-level comments, paginating with `begin` offset.
  async function fetchAllTopLevelComments(commentId) {
    let all = [];
    let begin = 0;
    const count = 50;
    let articleMeta = null;

    while (true) {
      const json = await apiFetch(appmsgcommentUrl({
        action: "list_comment",
        comment_id: commentId,
        begin: String(begin),
        count: String(count),
        filtertype: "0",
        day: "0",
        type: "2",
        max_id: "0",
      }));

      const parsed = typeof json.comment_list === "string"
        ? JSON.parse(json.comment_list)
        : json.comment_list;
      const batch = parsed?.comment || [];

      if (!articleMeta) {
        articleMeta = {
          title: parsed?.title || json.base_info?.title || "",
          url: json.base_info?.url || parsed?.url || "",
          published_at: json.base_info?.create_time
            ? new Date(Number(json.base_info.create_time) * 1000).toISOString()
            : new Date().toISOString(),
        };
      }

      all = all.concat(batch);
      if (batch.length < count) break;
      begin += batch.length;
    }

    return { article: articleMeta, topLevelComments: all };
  }

  // Fetch all replies for a top-level comment, paginating with max_reply_id cursor.
  async function fetchAllReplies(commentId, contentId, maxReplyId) {
    const all = [];
    let cursor = maxReplyId;
    const limit = 50;

    while (true) {
      const json = await apiFetch(appmsgcommentUrl({
        action: "get_comment_reply",
        comment_id: commentId,
        content_id: String(contentId),
        limit: String(limit),
        max_reply_id: String(cursor),
        clear_unread: "0",
        fingerprint: "0",
      }));

      const batch = json.reply_list?.reply_list || [];
      all.push(...batch);

      const nextCursor = json.reply_list?.max_reply_id;
      if (batch.length < limit || !nextCursor || nextCursor <= 1) break;
      cursor = nextCursor - 1;
    }

    return all;
  }

  // Capture all comments (top-level + replies) for a single article.
  // Returns { article, comments } where comments is a flat array in v2 format.
  async function captureCommentsForArticle(commentId) {
    const { article, topLevelComments } = await fetchAllTopLevelComments(commentId);
    const comments = [];

    for (const c of topLevelComments) {
      comments.push(normaliseTopLevel(c));
      const replyTotal = c.new_reply?.reply_total_cnt || 0;
      if (replyTotal > 0) {
        const maxReplyId = c.new_reply?.max_reply_id || 1;
        const replies = await fetchAllReplies(commentId, c.content_id, maxReplyId);
        for (const r of replies) {
          comments.push(normaliseReply(r, String(c.content_id)));
        }
      }
    }

    console.log("[WeCatch] captured article:", article.title,
      "| top-level:", topLevelComments.length, "| total:", comments.length);
    return { article, comments };
  }

  // ── Normalisation ──────────────────────────────────────────────────────────

  // comment_time is passed as raw Unix integer (seconds) per v2 spec;
  // the backend converts to ISO 8601.
  function normaliseTopLevel(raw) {
    return {
      wx_comment_id: String(raw.content_id),
      reply_to_wx_id: "",
      reply_to_nickname: "",
      content: raw.content ?? "",
      nickname: raw.nick_name ?? "unknown",
      comment_time: Number(raw.post_time ?? 0),
    };
  }

  function normaliseReply(raw, parentContentId) {
    return {
      wx_comment_id: `${parentContentId}_${raw.reply_id}`,
      reply_to_wx_id: parentContentId,
      reply_to_nickname: raw.to_nick_name || "",
      content: raw.content ?? "",
      nickname: raw.nick_name ?? "unknown",
      comment_time: Number(raw.create_time ?? 0),
    };
  }

  // ── Message listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

    if (msg.type === "FETCH_ARTICLES") {
      if (!isCommentPage()) {
        sendResponse({ ok: false, error: "not on comment page" });
        return false;
      }
      const account = extractAccount();
      fetchArticleList()
        .then((articles) => sendResponse({ ok: true, data: { account, articles } }))
        .catch((err) => {
          console.error("[WeCatch] FETCH_ARTICLES error:", err);
          sendResponse({ ok: false, error: String(err) });
        });
      return true; // async response
    }

    if (msg.type === "CAPTURE_COMMENTS") {
      if (!isCommentPage()) {
        sendResponse({ ok: false, error: "not on comment page" });
        return false;
      }
      const articleId = msg.articleId;
      if (!articleId) {
        sendResponse({ ok: false, error: "articleId is required" });
        return false;
      }
      const account = extractAccount();
      captureCommentsForArticle(articleId)
        .then(({ article, comments }) =>
          sendResponse({ ok: true, data: { account, article, comments } })
        )
        .catch((err) => {
          console.error("[WeCatch] CAPTURE_COMMENTS error:", err);
          sendResponse({ ok: false, error: String(err) });
        });
      return true; // async response
    }

    if (msg.type === "FETCH_AND_CAPTURE") {
      if (!isCommentPage()) {
        sendResponse({ ok: false, error: "wx_api_error" });
        return false;
      }
      fetchAndCapture(msg)
        .then((result) => sendResponse(result))
        .catch((err) => {
          console.error("[WeCatch] FETCH_AND_CAPTURE unexpected error:", err);
          sendResponse({ ok: false, error: "wx_api_error" });
        });
      return true; // async response
    }

    return false;
  });

  // ── FETCH_AND_CAPTURE pipeline ─────────────────────────────────────────────

  // Load seen comment IDs map from chrome.storage.local.
  function loadSeenIds() {
    return new Promise((resolve) => {
      chrome.storage.local.get("wecatch_seen_ids", (data) => {
        resolve(data.wecatch_seen_ids || {});
      });
    });
  }

  // Persist updated seen IDs map to chrome.storage.local.
  function saveSeenIds(seenIds) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ wecatch_seen_ids: seenIds }, resolve);
    });
  }

  // POST comments to /api/analyze and return classified result.
  // Sends all comments for the article; backend returns them with category field.
  async function callAnalyze(account, articleMeta, comments) {
    const res = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify({ account, article: articleMeta, comments }),
    });
    if (!res.ok) throw new Error("analyze HTTP " + res.status);
    return res.json(); // { account, article, comments }
  }

  // Split an array into chunks of at most `size` elements.
  function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  // Main pipeline for FETCH_AND_CAPTURE message.
  async function fetchAndCapture(msg) {
    const account = extractAccount();

    // Step 1: fetch article list, guard against wx API failure
    let articleList;
    try {
      articleList = await fetchArticleList();
    } catch (e) {
      console.error("[WeCatch] fetchArticleList failed:", e);
      return { ok: false, error: "wx_api_error" };
    }

    // Step 2: filter by requested articleIds or keep only articles with comments
    const targetArticles = msg.articleIds
      ? articleList.filter((a) => msg.articleIds.includes(a.comment_id))
      : articleList.filter((a) => a.comment_count > 0);

    // Step 3: load seen IDs from storage
    const seenIds = await loadSeenIds();

    const resultArticles = [];
    let newTopLevelCount = 0;
    let analyzeError = null;

    for (const articleMeta of targetArticles) {
      const commentId = articleMeta.comment_id;

      // Step 4: capture all comments for this article
      let captured;
      try {
        captured = await captureCommentsForArticle(commentId);
      } catch (e) {
        console.error("[WeCatch] captureCommentsForArticle failed for", commentId, e);
        return { ok: false, error: "wx_api_error" };
      }

      const { article, comments } = captured;
      const knownIds = new Set(seenIds[commentId] || []);

      // Step 5: find new top-level comments not yet seen
      const newTopLevel = comments.filter(
        (c) => c.reply_to_wx_id === "" && !knownIds.has(c.wx_comment_id)
      );

      newTopLevelCount += newTopLevel.length;

      if (newTopLevel.length > 0) {
        // Step 6: call /api/analyze, batch by 50 top-level comments + their replies
        const BATCH_SIZE = 50;
        const topLevelChunks = chunkArray(newTopLevel, BATCH_SIZE);
        let mergedComments = [];

        try {
          for (const chunk of topLevelChunks) {
            const chunkIds = new Set(chunk.map((c) => c.wx_comment_id));
            // Include the top-level chunk plus all their replies
            const chunkComments = [
              ...chunk,
              ...comments.filter(
                (c) => c.reply_to_wx_id !== "" && chunkIds.has(c.reply_to_wx_id)
              ),
            ];
            const analyzed = await callAnalyze(account, article, chunkComments);
            mergedComments = mergedComments.concat(analyzed.comments || chunkComments);
          }
          resultArticles.push({ account, article, comments: mergedComments });
        } catch (e) {
          console.error("[WeCatch] /api/analyze failed:", e);
          analyzeError = String(e);
          // Fall back to raw data without categories
          resultArticles.push({ account, article, comments });
          newTopLevelCount = 0;
        }
      } else {
        // No new top-level comments — include raw captured data
        resultArticles.push({ account, article, comments });
      }

      // Step 7: update seen IDs (merge, never shrink)
      const allTopLevelIds = comments
        .filter((c) => c.reply_to_wx_id === "")
        .map((c) => c.wx_comment_id);
      const merged = Array.from(new Set([...Array.from(knownIds), ...allTopLevelIds]));
      seenIds[commentId] = merged;
    }

    // Step 8: persist updated seen IDs
    await saveSeenIds(seenIds);

    const response = { ok: true, data: { articles: resultArticles, newTopLevelCount } };
    if (analyzeError) response.error = analyzeError;
    return response;
  }
})();
