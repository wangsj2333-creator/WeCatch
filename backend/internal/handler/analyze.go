package handler

import (
	"encoding/json"
	"net/http"
	"time"
	"wecatch/internal/llm"
	"wecatch/internal/tree"
)

type AccountPayload struct {
	WxAccountID string `json:"wx_account_id"`
	Name        string `json:"name"`
}

type ArticlePayload struct {
	Title       string `json:"title"`
	URL         string `json:"url"`
	PublishedAt string `json:"published_at"`
}

type AnalyzeRequest struct {
	Account  AccountPayload    `json:"account"`
	Article  ArticlePayload    `json:"article"`
	Comments []tree.RawComment `json:"comments"`
}

type CommentResponse struct {
	WxCommentID     string `json:"wx_comment_id"`
	ReplyToWxID     string `json:"reply_to_wx_id"`
	ReplyToNickname string `json:"reply_to_nickname"`
	Content         string `json:"content"`
	Nickname        string `json:"nickname"`
	CommentTime     string `json:"comment_time"`    // ISO 8601
	Category        string `json:"category,omitempty"` // top-level only; omitted for replies
	ParentPreview   string `json:"parent_content_preview"` // always present; empty string for top-level
}

type AnalyzeResponse struct {
	Account  AccountPayload    `json:"account"`
	Article  ArticlePayload    `json:"article"`
	Comments []CommentResponse `json:"comments"`
}

func TruncateRunes(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n])
}

func NewAnalyzeHandler(analyzer *llm.Analyzer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req AnalyzeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		threads := tree.Build(req.Comments)

		// Build lookup for parent preview
		contentByID := make(map[string]string)
		for _, c := range req.Comments {
			contentByID[c.WxCommentID] = c.Content
		}

		// Classify each thread
		categoryByID := make(map[string]string)
		for _, th := range threads {
			cat := analyzer.ClassifyThread(req.Article.Title, th)
			categoryByID[th.Top.WxCommentID] = cat
		}

		// Build response comments
		var comments []CommentResponse
		for _, c := range req.Comments {
			cr := CommentResponse{
				WxCommentID:     c.WxCommentID,
				ReplyToWxID:     c.ReplyToWxID,
				ReplyToNickname: c.ReplyToNickname,
				Content:         c.Content,
				Nickname:        c.Nickname,
				CommentTime:     time.Unix(c.CommentTime, 0).UTC().Format(time.RFC3339),
			}
			if c.ReplyToWxID == "" {
				cr.Category = categoryByID[c.WxCommentID]
			} else {
				parent := contentByID[c.ReplyToWxID]
				cr.ParentPreview = TruncateRunes(parent, 50)
			}
			comments = append(comments, cr)
		}

		resp := AnalyzeResponse{
			Account:  req.Account,
			Article:  req.Article,
			Comments: comments,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
