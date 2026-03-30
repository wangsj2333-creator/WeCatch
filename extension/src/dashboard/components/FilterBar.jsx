import React, { useState, useRef, useEffect } from 'react';
import { CATEGORIES } from '../categories';

function Dropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = options.find(o => o.key === value);

  return (
    <div className="dropdown" ref={ref}>
      <button className="dropdown-trigger" onClick={() => setOpen(o => !o)}>
        {current?.label}
        <span className="dropdown-arrow">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="dropdown-menu">
          {options.map(({ key, label }) => (
            <div
              key={key}
              className={`dropdown-item${value === key ? ' active' : ''}`}
              onClick={() => { onChange(key); setOpen(false); }}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CATEGORY_OPTIONS = [
  { key: '', label: '全部分类' },
  ...Object.entries(CATEGORIES).map(([key, label]) => ({ key, label })),
];

const SORT_OPTIONS = [
  { key: 'newest', label: '最新留言' },
  { key: 'oldest', label: '最早留言' },
];

export default function FilterBar({ categoryFilter, onCategoryChange, sortOrder, onSortChange }) {
  return (
    <div className="filter-bar">
      <Dropdown value={categoryFilter} onChange={onCategoryChange} options={CATEGORY_OPTIONS} />
      <Dropdown value={sortOrder} onChange={onSortChange} options={SORT_OPTIONS} />
    </div>
  );
}
