import React from 'react';
import { CATEGORIES } from '../categories';

// All categories shown in filter UI. worthless is included but unchecked by default.
export default function FilterBar({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {Object.entries(CATEGORIES).map(([key, label]) => (
        <label key={key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={active.includes(key)}
            onChange={() => onChange(key)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
