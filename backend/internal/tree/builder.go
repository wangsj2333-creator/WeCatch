package tree

type RawComment struct {
	WxCommentID     string `json:"wx_comment_id"`
	ReplyToWxID     string `json:"reply_to_wx_id"`
	ReplyToNickname string `json:"reply_to_nickname"`
	Content         string `json:"content"`
	Nickname        string `json:"nickname"`
	CommentTime     int64  `json:"comment_time"`
}

type Thread struct {
	Top     RawComment
	Replies []RawComment
}

func Build(comments []RawComment) []Thread {
	index := make(map[string]*Thread)
	var order []string

	for _, c := range comments {
		if c.ReplyToWxID == "" {
			cp := c
			index[c.WxCommentID] = &Thread{Top: cp}
			order = append(order, c.WxCommentID)
		}
	}
	for _, c := range comments {
		if c.ReplyToWxID != "" {
			if t, ok := index[c.ReplyToWxID]; ok {
				t.Replies = append(t.Replies, c)
			}
		}
	}

	result := make([]Thread, 0, len(order))
	for _, id := range order {
		result = append(result, *index[id])
	}
	return result
}
