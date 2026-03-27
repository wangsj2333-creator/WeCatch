import * as XLSX from 'xlsx';
import { CATEGORIES } from './categories';

export function exportToExcel(articles) {
  const rows = [];
  for (const article of articles) {
    for (const c of article.comments) {
      rows.push({
        '公众号名称': article.account.name,
        '文章标题': article.article.title,
        '留言者昵称': c.nickname,
        '留言内容': c.content,
        '分类': c.category ? CATEGORIES[c.category] : '',
        '是否为回复': c.reply_to_wx_id ? '是' : '否',
        '父留言摘要': c.parent_content_preview || '',
        '留言时间': c.comment_time,
      });
    }
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '留言');
  XLSX.writeFile(wb, 'wecatch-comments.xlsx');
}
