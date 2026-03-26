package llm_test

import (
	"testing"
	"wecatch/internal/llm"
)

func TestParseCategory_ValidValues(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"question", "question"},
		{"negative", "negative"},
		{"worthless", "worthless"},
		{"QUESTION", "question"},     // case insensitive
		{"  question  ", "question"}, // trim whitespace
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
