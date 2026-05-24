import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '../../i18n/context';
import type { JokerInstance } from '../../engine/types';
import { getAllJokers, searchJokers, JOKER_STATE_INPUTS } from '../../engine/joker-data';
import { JokerBadge } from '../shared/JokerBadge';

interface JokerInputProps {
  jokers: JokerInstance[];
  onAdd: (jokerId: string) => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  stateOverrides: Record<number, number>;
  onStateChange: (index: number, value: number) => void;
}

export function JokerInput({
  jokers, onAdd, onRemove, onReorder,
  stateOverrides, onStateChange,
}: JokerInputProps) {
  const { t } = useI18n();
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search query (200ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(rawQuery), 200);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const allJokers = useMemo(() => getAllJokers(), []);
  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return allJokers.slice(0, 30);
    return searchJokers(debouncedQuery).slice(0, 30);
  }, [debouncedQuery, allJokers]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered]);

  const selectJoker = useCallback((jokerId: string) => {
    onAdd(jokerId);
    setRawQuery('');
    setDebouncedQuery('');
    setShowDropdown(false);
    inputRef.current?.focus();
  }, [onAdd]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown || filtered.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => (prev + 1) % filtered.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => (prev - 1 + filtered.length) % filtered.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIndex]) {
          selectJoker(filtered[highlightIndex].id);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  }, [showDropdown, filtered, highlightIndex, selectJoker]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (showDropdown && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, showDropdown]);

  return (
    <div>
      <h3 className="section h3">
        {t.sections.jokers} ({jokers.length}/7)
      </h3>

      {/* Joker list */}
      {jokers.length > 0 ? (
        <div className="joker-list">
          {jokers.map((j, i) => {
            const stateInput = JOKER_STATE_INPUTS[j.id];
            return (
              <div key={`${j.id}_${i}`} className="joker-row">
                <div className="joker-row__controls">
                  {i > 0 && (
                    <button
                      className="joker-reorder-btn"
                      onClick={() => onReorder(i, i - 1)}
                      aria-label="Move up"
                    >↑</button>
                  )}
                  {i < jokers.length - 1 && (
                    <button
                      className="joker-reorder-btn"
                      onClick={() => onReorder(i, i + 1)}
                      aria-label="Move down"
                    >↓</button>
                  )}
                  <JokerBadge joker={j} index={i} onRemove={onRemove} />
                </div>
                {stateInput && (
                  <div className="joker-row__state">
                    <span className="joker-row__state-label">
                      {stateInput.label}
                    </span>
                    <input
                      type="number"
                      className="joker-row__state-input"
                      step="any"
                      value={stateOverrides[i] ?? stateInput.defaultValue}
                      aria-label={`${stateInput.label} value`}
                      onChange={e => onStateChange(i, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="joker-list-empty">
          No jokers added. Search below to add one.
        </div>
      )}

      {/* Add joker */}
      {jokers.length < 7 && (
        <div className="joker-search">
          <input
            ref={inputRef}
            type="text"
            className="joker-search-input"
            placeholder={t.states.searchPlaceholder}
            aria-label="Search jokers"
            aria-autocomplete="list"
            aria-activedescendant={showDropdown && filtered[highlightIndex]
              ? `joker-option-${filtered[highlightIndex].id}`
              : undefined}
            role="combobox"
            value={rawQuery}
            onChange={e => { setRawQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            onKeyDown={handleKeyDown}
          />
          {showDropdown && (
            <div
              className="joker-search-dropdown"
              ref={listRef}
              role="listbox"
            >
              {filtered.map((j, i) => (
                <div
                  key={j.id}
                  id={`joker-option-${j.id}`}
                  role="option"
                  aria-selected={i === highlightIndex}
                  className={
                    i === highlightIndex
                      ? 'joker-search-item joker-search-item--highlight'
                      : 'joker-search-item'
                  }
                  onMouseDown={() => selectJoker(j.id)}
                  onMouseEnter={() => setHighlightIndex(i)}
                >
                  <span>{t.jokerNames[j.id] ?? j.name}</span>
                  <span className="joker-search-item__rarity">
                    {t.rarities[j.rarity]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
