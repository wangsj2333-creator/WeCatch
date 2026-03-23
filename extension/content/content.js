// content.js — WeCatch content script
// Runs on mp.weixin.qq.com. On popup request, fetches comment data in two steps:
// 1. get_unread_appmsg_comment → list of articles with comment thread IDs
// 2. list_comment (per article) → actual comment content

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

  // ── Comment fetch (two-step) ───────────────────────────────────────────────

  async function fetchAllComments() {
    // Step 1: get list of articles that have comments
    const listJson = await apiFetch(appmsgcommentUrl({
      action: "get_unread_appmsg_comment",
      begin: "0",
      count: "50",
      sort_type: "0",
    }));

    const items = listJson.item || [];
    if (items.length === 0) return [];

    // Step 2: for each article, fetch its comments
    const results = await Promise.all(
      items.map(async (item) => {
        if (!item.comment_id) return [];
        try {
          const json = await apiFetch(appmsgcommentUrl({
            action: "list_comment",
            comment_id: item.comment_id,
            begin: "0",
            count: "50",
            filtertype: "0",
            day: "0",
            type: "2",
            max_id: "0",
          }));
          // comment_list is a JSON-encoded string
          const parsed = typeof json.comment_list === "string"
            ? JSON.parse(json.comment_list)
            : json.comment_list;
          return parsed?.comment || json.reply_list?.reply_list || [];
        } catch (e) {
          console.warn("[WeCatch] failed to fetch comments for", item.comment_id, e);
          return [];
        }
      })
    );

    return results.flat();
  }

  // ── Normalisation ──────────────────────────────────────────────────────────

  function normaliseComment(raw) {
    const id = String(raw.id ?? raw.comment_id ?? raw.fake_id ?? raw.content_id ?? Date.now());
    const content = raw.content ?? "";
    const nickname = raw.nick_name ?? raw.nickname ?? raw.author ?? "unknown";
    const ts = raw.post_time ?? raw.create_time ?? raw.comment_time ?? raw.time;
    const comment_time = ts
      ? new Date(Number(ts) * 1000).toISOString()
      : new Date().toISOString();
    return { wx_comment_id: id, content, nickname, comment_time };
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
    if (message.type !== "CAPTURE_COMMENTS") return false;

    fetchAllComments()
      .then((rawComments) => {
        console.log("[WeCatch] fetched", rawComments.length, "comments");
        if (rawComments.length === 0) {
          sendResponse({ ok: false, error: "No comments found" });
          return;
        }
        const comments = rawComments.map(normaliseComment);
        const account = extractAccount();
        const article = {
          title: document.title || "",
          url: location.href,
          published_at: new Date().toISOString(),
        };
        sendResponse({ ok: true, data: { account, article, comments } });
      })
      .catch((err) => {
        console.error("[WeCatch] error:", err);
        sendResponse({ ok: false, error: String(err) });
      });

    return true; // keep channel open for async sendResponse
  });
})();
