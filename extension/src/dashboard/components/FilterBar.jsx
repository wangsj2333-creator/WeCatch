import React from 'react';
import { CATEGORIES } from '../categories';

// categoryFilter: '' = all, or a category key
// sortOrder: 'newest' | 'oldest'
export default function FilterBar({ categoryFilter, onCategoryChange, sortOrder, onSortChange }) {
  const selectStyle = {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #ccc',
    fontSize: 13,
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <select value={categoryFilter} onChange={e => onCategoryChange(e.target.value)} style={selectStyle}>
        <option value="">全部分类</option>
        {Object.entries(CATEGORIES).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      <select value={sortOrder} onChange={e => onSortChange(e.target.value)} style={selectStyle}>
        <option value="newest">最新留言</option>
        <option value="oldest">最早留言</option>
      </select>
    </div>
  );
}
