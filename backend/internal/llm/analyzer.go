package llm

import (
	"strings"
	"wecatch/internal/tree"
)

// SystemPrompt defines the model's role and classification rules.
const SystemPrompt = `你是一个微信公众号留言分类助手。

请根据留言内容，从以下类别中选择最符合的一个，只回答类别名称，不要添加任何解释：

- 读者提问：读者对文章内容、观点或相关知识提出的疑问
- 建议需求：对文章选题、内容深度或产品功能提出的改进建议或新需求
- 合作意向：涉及商务合作、广告投放、资源互换等意图
- 负面不满：对内容、产品或服务表达不满、批评、抱怨
- 无价值：闲聊、无意义表情、广告骚扰，或与以上类别均无关的内容`

var categoryMap = map[string]string{
	"读者提问": "question",
	"建议需求": "suggestion",
	"合作意向": "cooperation",
	"负面不满": "negative",
	"无价值":  "worthless",
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
	raw, err := a.client.Classify(SystemPrompt, prompt)
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
	return sb.String()
}
