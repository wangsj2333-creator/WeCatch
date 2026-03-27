package llm

import (
	"strings"
	"wecatch/internal/tree"
)

var categoryMap = map[string]string{
	"读者提问": "question",
	"建议需求": "suggestion",
	"合作意向": "cooperation",
	"负面不满": "negative",
}

func ParseCategory(raw string) string {
	s := strings.TrimSpace(raw)
	if key, ok := categoryMap[s]; ok {
		return key
	}
	return "unclassified"
}

// Analyzer classifies comment threads using the LLM client.
type Analyzer struct {
	client *Client
}

func NewAnalyzer(client *Client) *Analyzer {
	return &Analyzer{client: client}
}

// ClassifyThread sends a full thread (top + replies) to Qianwen.
// Returns a category string for the top-level comment only.
func (a *Analyzer) ClassifyThread(articleTitle string, thread tree.Thread) string {
	prompt := buildPrompt(articleTitle, thread)
	raw, err := a.client.Classify(prompt)
	if err != nil {
		return "unclassified"
	}
	return ParseCategory(raw)
}

func buildPrompt(articleTitle string, thread tree.Thread) string {
	var sb strings.Builder
	sb.WriteString("文章标题：" + articleTitle + "\n\n")
	sb.WriteString("留言：" + thread.Top.Content + "\n")
	for _, r := range thread.Replies {
		sb.WriteString("回复：" + r.Content + "\n")
	}
	sb.WriteString("\n请判断这条留言属于以下哪个类别，只回答类别名称：\n")
	sb.WriteString("读者提问 / 建议需求 / 合作意向 / 负面不满")
	return sb.String()
}
