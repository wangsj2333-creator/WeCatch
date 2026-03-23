import React from 'react';
import { CATEGORY_LABELS, VALUABLE_CATEGORIES, type CommentCategory } from '../types';

const C = {
  primary: '#2D4B3E',
  primaryLight: '#DDE6E1',
  surface: '#EDF1EF',
  border: '#BFC9C3',
  muted: '#56635B',
};

interface Props {
  selected: string;
  onChange: (category: string) => void;
}

export function CategoryFilter({ selected, onChange }: Props) {
  const buttons: Array<{ key: string; label: string }> = [
    { key: '', label: '全部有价值' },
    ...VALUABLE_CATEGORIES.map((cat) => ({ key: cat, label: CATEGORY_LABELS[cat] })),
    { key: 'worthless', label: '无价值' },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {buttons.map(({ key, label }) => {
        const isActive = selected === key;
        const isWorthless = key === 'worthless';
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: isActive ? 700 : 600,
              cursor: 'pointer',
              border: isActive ? 'none' : `1px solid ${C.border}`,
              background: isActive
                ? C.primary
                : isWorthless
                ? '#fff'
                : '#fff',
              color: isActive
                ? '#fff'
                : isWorthless
                ? C.muted
                : C.muted,
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
