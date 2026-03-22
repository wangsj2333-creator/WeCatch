package services

import "testing"

func TestBuildClassifyPrompt(t *testing.T) {
	prompt := BuildClassifyPrompt("这篇文章写错了吧，第三段的数据明显不对", "2024年经济数据分析")
	if prompt == "" {
		t.Error("prompt should not be empty")
	}
}

func TestParseCategory_Valid(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"question", "question"},
		{"correction", "correction"},
		{"negative", "negative"},
		{"suggestion", "suggestion"},
		{"discussion", "discussion"},
		{"cooperation", "cooperation"},
		{"worthless", "worthless"},
	}
	for _, tt := range tests {
		result := ParseCategory(tt.input)
		if result != tt.expected {
			t.Errorf("ParseCategory(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestParseCategory_Invalid(t *testing.T) {
	result := ParseCategory("unknown_category")
	if result != "unclassified" {
		t.Errorf("expected unclassified for invalid input, got %q", result)
	}
}
