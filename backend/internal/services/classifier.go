package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

var validCategories = map[string]bool{
	"question":    true,
	"correction":  true,
	"negative":    true,
	"suggestion":  true,
	"discussion":  true,
	"cooperation": true,
	"worthless":   true,
}

func BuildClassifyPrompt(commentContent, articleTitle string) string {
	return fmt.Sprintf(`你是一个留言分类助手。请将以下微信公众号文章的留言分为以下类别之一，只返回类别英文标签，不要返回其他内容：

- question: 读者提问，在问问题
- correction: 纠错质疑，指出文章错误
- negative: 负面不满，表达批评或不满
- suggestion: 建议需求，提出内容建议
- discussion: 深度讨论，有独到见解或补充
- cooperation: 合作意向，表达商务或合作意向
- worthless: 无价值，如"写得好""感谢分享"等普通留言

文章标题：%s
留言内容：%s

请只返回一个英文分类标签。`, articleTitle, commentContent)
}

func ParseCategory(raw string) string {
	cleaned := strings.TrimSpace(strings.ToLower(raw))
	if validCategories[cleaned] {
		return cleaned
	}
	return "unclassified"
}

type Classifier struct {
	APIKey  string
	BaseURL string
}

func NewClassifier(apiKey string) *Classifier {
	return &Classifier{
		APIKey:  apiKey,
		BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
	}
}

type qianwenRequest struct {
	Model    string       `json:"model"`
	Messages []qianwenMsg `json:"messages"`
}

type qianwenMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type qianwenResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (c *Classifier) Classify(commentContent, articleTitle string) (string, error) {
	prompt := BuildClassifyPrompt(commentContent, articleTitle)

	reqBody := qianwenRequest{
		Model: "qwen-turbo",
		Messages: []qianwenMsg{
			{Role: "user", Content: prompt},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "unclassified", err
	}

	req, err := http.NewRequest("POST", c.BaseURL, bytes.NewReader(jsonBody))
	if err != nil {
		return "unclassified", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "unclassified", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "unclassified", err
	}

	var result qianwenResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "unclassified", err
	}

	if len(result.Choices) == 0 {
		return "unclassified", fmt.Errorf("no choices in response")
	}

	raw := result.Choices[0].Message.Content
	return ParseCategory(raw), nil
}
