// content.js — WeCatch content script
// Runs on mp.weixin.qq.com.
// Handles two message types:
//   FETCH_ARTICLES  → returns list of articles with comment counts
//   CAPTURE_COMMENTS (with selectedCommentIds) → fetches and returns comments grouped by article

(function () {
  "use strict";

  console.log("[WeCatch] content script loaded");

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

  // ── Article list fetch ─────────────────────────────────────────────────────

  async function fetchArticleList() {
    // Try the general (non-unread) action first; fall back to unread variant
    let items = [];
    try {
      const json = await apiFetch(appmsgcommentUrl({
        action: "get_appmsg_comment",
        begin: "0",
        count: "50",
        sort_type: "0",
      }));
      items = json.item || [];
      if (items.length > 0) console.log("[WeCatch] get_appmsg_comment item[0]:", JSON.stringify(items[0]));
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
      if (items.length > 0) console.log("[WeCatch] get_unread_appmsg_comment item[0]:", JSON.stringify(items[0]));
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
          title = detail.title || "";
        } catch (e) {
          // title stays empty, will fall back to "(无标题)" in popup
        }
        return {
          comment_id: item.comment_id,
          title: title || "(无标题)",
          comment_count: item.total_count ?? item.comment_num ?? 0,
          create_time: item.create_time || 0,
        };
      })
    );

    return results;
  }

  // ── Comments fetch for selected articles ──────────────────────────────────

  async function fetchCommentsByArticle(selectedCommentIds) {
    const groups = await Promise.all(
      selectedCommentIds.map(async (commentId) => {
        try {
          const json = await apiFetch(appmsgcommentUrl({
            action: "list_comment",
            comment_id: commentId,
            begin: "0",
            count: "50",
            filtertype: "0",
            day: "0",
            type: "2",
            max_id: "0",
          }));

          console.log("[WeCatch] list_comment top-level keys:", Object.keys(json));
          if (json.base_info) console.log("[WeCatch] list_comment base_info:", JSON.stringify(json.base_info));

          const parsed = typeof json.comment_list === "string"
            ? JSON.parse(json.comment_list)
            : json.comment_list;
          const topLevelComments = parsed?.comment || json.reply_list?.reply_list || [];
          if (topLevelComments.length > 0) console.log("[WeCatch] list_comment comment[0]:", JSON.stringify(topLevelComments[0]));

          // Flatten top-level comments + their replies, preserving parent reference
          const rawComments = [];
          for (const c of topLevelComments) {
            rawComments.push({ raw: c, parentContentId: null });
            const replies = c.reply?.reply_list || c.new_reply?.reply_list || [];
            for (const r of replies) {
              rawComments.push({ raw: r, parentContentId: c.content_id });
            }
          }

          // Extract article metadata from the response or fall back to item data
          const article = {
            title: json.base_info?.title || json.title || "",
            url: json.base_info?.url || json.url || "",
            published_at: json.base_info?.create_time
              ? new Date(Number(json.base_info.create_time) * 1000).toISOString()
              : new Date().toISOString(),
          };

          return { article, comments: rawComments.map(({ raw, parentContentId }) => normaliseComment(raw, parentContentId)) };
        } catch (e) {
          console.warn("[WeCatch] failed to fetch comments for", commentId, e);
          return null;
        }
      })
    );

    return groups.filter(Boolean);
  }

  // ── Normalisation ──────────────────────────────────────────────────────────

  function normaliseComment(raw, parentContentId) {
    // content_id is the globally unique ID for each comment across all articles
    const id = String(raw.content_id ?? raw.id ?? raw.fake_id ?? Date.now());
    const content = raw.content ?? "";
    const nickname = raw.nick_name ?? raw.nickname ?? raw.author ?? "unknown";
    const ts = raw.post_time ?? raw.create_time ?? raw.comment_time ?? raw.time;
    const comment_time = ts
      ? new Date(Number(ts) * 1000).toISOString()
      : new Date().toISOString();
    // If parentContentId is provided, this comment is a reply to that comment
    const reply_to_wx_id = parentContentId ? String(parentContentId) : "";
    return { wx_comment_id: id, reply_to_wx_id, content, nickname, comment_time };
  }

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

  // ── Message listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

    // ── FETCH_ARTICLES: return article list for popup to display ──────────
    if (message.type === "FETCH_ARTICLES") {
      const account = extractAccount();
      fetchArticleList()
        .then((articles) => {
          sendResponse({ ok: true, data: { account, articles } });
        })
        .catch((err) => {
          console.error("[WeCatch] FETCH_ARTICLES error:", err);
          sendResponse({ ok: false, error: String(err) });
        });
      return true;
    }

    // ── CAPTURE_COMMENTS: fetch comments for selected articles ────────────
    if (message.type === "CAPTURE_COMMENTS") {
      const selectedCommentIds = message.selectedCommentIds || [];
      if (selectedCommentIds.length === 0) {
        sendResponse({ ok: false, error: "No articles selected" });
        return false;
      }

      const account = extractAccount();
      fetchCommentsByArticle(selectedCommentIds)
        .then((groups) => {
          const totalComments = groups.reduce((sum, g) => sum + g.comments.length, 0);
          console.log("[WeCatch] fetched", groups.length, "articles,", totalComments, "comments");
          if (groups.length === 0) {
            sendResponse({ ok: false, error: "No comments found" });
            return;
          }
          const articleGroups = groups.map((g) => ({
            article: g.article,
            comments: g.comments,
          }));
          sendResponse({ ok: true, data: { account, articleGroups } });
        })
        .catch((err) => {
          console.error("[WeCatch] CAPTURE_COMMENTS error:", err);
          sendResponse({ ok: false, error: String(err) });
        });
      return true;
    }

    return false;
  });
})();
