export interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

export interface Account {
  id: number;
  wx_account_id: string;
  name: string;
  last_captured_at?: string | null;
  created_at: string;
}

export interface Article {
  id: number;
  account_id: number;
  title: string;
  url: string;
  published_at: string;
  created_at: string;
}

export type CommentCategory =
  | 'question'
  | 'correction'
  | 'negative'
  | 'suggestion'
  | 'discussion'
  | 'cooperation'
  | 'worthless'
  | 'unclassified';

export type CommentStatus = 'pending' | 'replied' | 'ignored';

export interface Comment {
  id: number;
  article_id: number;
  wx_comment_id: string;
  reply_to_wx_id: string;
  reply_to_nickname: string;
  content: string;
  nickname: string;
  comment_time: string;
  category: CommentCategory;
  status: CommentStatus;
  created_at: string;
}

export const CATEGORY_LABELS: Record<CommentCategory, string> = {
  question: '读者提问',
  correction: '纠错质疑',
  negative: '负面不满',
  suggestion: '建议需求',
  discussion: '深度讨论',
  cooperation: '合作意向',
  worthless: '无价值',
  unclassified: '未分类',
};

export const STATUS_LABELS: Record<CommentStatus, string> = {
  pending: '待处理',
  replied: '已回复',
  ignored: '已忽略',
};

export const VALUABLE_CATEGORIES: CommentCategory[] = [
  'question', 'correction', 'negative', 'suggestion', 'discussion', 'cooperation',
];
