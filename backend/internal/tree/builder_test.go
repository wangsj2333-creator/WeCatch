package tree_test

import (
	"testing"
	"wecatch/internal/tree"
)

func TestBuild_SingleTopLevel(t *testing.T) {
	comments := []tree.RawComment{
		{WxCommentID: "1", ReplyToWxID: "", Content: "hello"},
	}
	threads := tree.Build(comments)
	if len(threads) != 1 {
		t.Fatalf("expected 1 thread, got %d", len(threads))
	}
	if threads[0].Top.WxCommentID != "1" {
		t.Fatalf("unexpected top comment id")
	}
	if len(threads[0].Replies) != 0 {
		t.Fatalf("expected no replies")
	}
}

func TestBuild_WithReplies(t *testing.T) {
	comments := []tree.RawComment{
		{WxCommentID: "1", ReplyToWxID: "", Content: "top"},
		{WxCommentID: "2", ReplyToWxID: "1", Content: "reply1"},
		{WxCommentID: "3", ReplyToWxID: "1", Content: "reply2"},
	}
	threads := tree.Build(comments)
	if len(threads) != 1 {
		t.Fatalf("expected 1 thread, got %d", len(threads))
	}
	if len(threads[0].Replies) != 2 {
		t.Fatalf("expected 2 replies, got %d", len(threads[0].Replies))
	}
}

func TestBuild_MultipleTopLevel(t *testing.T) {
	comments := []tree.RawComment{
		{WxCommentID: "1", ReplyToWxID: "", Content: "top1"},
		{WxCommentID: "2", ReplyToWxID: "", Content: "top2"},
		{WxCommentID: "3", ReplyToWxID: "1", Content: "reply to top1"},
	}
	threads := tree.Build(comments)
	if len(threads) != 2 {
		t.Fatalf("expected 2 threads, got %d", len(threads))
	}
}
