package handler_test

import (
	"testing"
	"unicode/utf8"
	"wecatch/internal/handler"
)

func TestTruncate_ShortString(t *testing.T) {
	got := handler.TruncateRunes("hello", 50)
	if got != "hello" {
		t.Fatalf("unexpected: %q", got)
	}
}

func TestTruncate_LongString(t *testing.T) {
	input := "这是一条很长的留言内容，超过了五十个字符的限制，应该被截断到五十个Unicode码点处理"
	got := handler.TruncateRunes(input, 50)
	if utf8.RuneCountInString(got) > 50 {
		t.Fatalf("expected ≤50 runes, got %d", utf8.RuneCountInString(got))
	}
}
