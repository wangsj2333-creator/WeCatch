package llm_test

import (
	"strings"
	"testing"
	"wecatch/internal/llm"
)

func TestSystemPrompt_ContainsRoleAndCategories(t *testing.T) {
	required := []string{
		"微信公众号",
		"读者提问",
		"建议需求",
		"合作意向",
		"负面不满",
		"无价值",
	}
	for _, keyword := range required {
		if !strings.Contains(llm.SystemPrompt, keyword) {
			t.Errorf("SystemPrompt missing keyword: %q", keyword)
		}
	}
}

func TestParseCategory_ValidValues(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"读者提问", "question"},
		{"建议需求", "suggestion"},
		{"合作意向", "cooperation"},
		{"负面不满", "negative"},
		{"无价值", "worthless"},
		{"  负面不满  ", "negative"}, // trim whitespace
		{"garbage", "unclassified"},  // unknown → unclassified
		{"", "unclassified"},         // empty → unclassified
	}
	for _, c := range cases {
		got := llm.ParseCategory(c.input)
		if got != c.expected {
			t.Errorf("ParseCategory(%q) = %q, want %q", c.input, got, c.expected)
		}
	}
}
