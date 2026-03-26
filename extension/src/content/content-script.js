// content-script.js — WeCatch v2 content script
// Runs on mp.weixin.qq.com.
// Handles two message types:
//   FETCH_ARTICLES              → returns article list with comment counts
//   CAPTURE_COMMENTS (articleId) → fetches all comments for one article

(function () {
  "use strict";

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

    return false;
  });
})();
