import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './MultiSelectDropdown.css';

/**
 * Searchable multi-select dropdown for visit customer picking (and similar lists).
 * value = array of option values; onChange receives the next array.
 */
export default function MultiSelectDropdown({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select customers…',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No matching options',
  disabled = false,
  label,
}) {
  const id = useId();
  const listId = `${id}-list`;
  const root = useRef(null);
  const panel = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState(null);
  const selected = useMemo(() => new Set(value.map(String)), [value]);
  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return options;
    return options.filter((opt) => {
      const hay = `${opt.label || ''} ${opt.meta || ''} ${opt.hint || ''}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [options, query]);
  const selectedOptions = options.filter((opt) => selected.has(String(opt.value)));
  const allVisibleSelected = filtered.length > 0 && filtered.every((opt) => selected.has(String(opt.value)));

  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const flip = below < 240 && above > below;
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(rect.width, 420) - 8)),
        width: Math.min(Math.max(rect.width, 320), window.innerWidth - 16),
        maxHeight: Math.max(160, Math.min(360, flip ? above : below)),
        ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      });
    };
    const outside = (event) => {
      if (!root.current?.contains(event.target) && !panel.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  const emit = (next) => onChange?.(Array.from(new Set(next.map(String))));

  const toggle = (optValue) => {
    const key = String(optValue);
    if (selected.has(key)) emit(value.filter((v) => String(v) !== key));
    else emit([...value, key]);
  };

  const toggleVisible = () => {
    if (allVisibleSelected) {
      const drop = new Set(filtered.map((o) => String(o.value)));
      emit(value.filter((v) => !drop.has(String(v))));
    } else {
      emit([...value, ...filtered.map((o) => String(o.value))]);
    }
  };

  const summary = selectedOptions.length === 0
    ? placeholder
    : selectedOptions.length === 1
      ? selectedOptions[0].label
      : `${selectedOptions.length} customers selected`;

  return (
    <div className={`msd${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}`} ref={root}>
      {label && <span className="msd__label">{label}</span>}
      <button
        type="button"
        className="msd__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => { if (!disabled) { setOpen((v) => !v); setQuery(''); } }}
      >
        <span className="msd__trigger-main">
          <span className="msd__trigger-icon" aria-hidden="true">⌕</span>
          <span className={`msd__trigger-text${selectedOptions.length ? '' : ' is-placeholder'}`}>{summary}</span>
        </span>
        <span className="msd__trigger-meta">
          {selectedOptions.length > 0 && <b>{selectedOptions.length}</b>}
          <span className="msd__chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {selectedOptions.length > 0 && (
        <div className="msd__chips" aria-label="Selected customers">
          {selectedOptions.map((opt) => (
            <span key={opt.value} className="msd__chip">
              <i aria-hidden="true">{(opt.label || '?').trim().slice(0, 1).toUpperCase()}</i>
              {opt.label}
              <button type="button" aria-label={`Remove ${opt.label}`} onClick={() => toggle(opt.value)}>×</button>
            </span>
          ))}
          <button type="button" className="msd__clear" onClick={() => emit([])}>Clear all</button>
        </div>
      )}

      {open && position && createPortal(
        <div
          ref={panel}
          className="msd__panel"
          style={{
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            top: position.top,
            bottom: position.bottom,
          }}
          role="listbox"
          id={listId}
          aria-multiselectable="true"
        >
          <div className="msd__panel-head">
            <input
              autoFocus
              className="msd__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
            <div className="msd__panel-actions">
              <span>{filtered.length} shown · {selectedOptions.length} selected</span>
              <button type="button" onClick={toggleVisible} disabled={!filtered.length}>
                {allVisibleSelected ? 'Deselect shown' : 'Select all shown'}
              </button>
            </div>
          </div>
          <div className="msd__options">
            {!filtered.length && <p className="msd__empty">{emptyLabel}</p>}
            {filtered.map((opt) => {
              const key = String(opt.value);
              const checked = selected.has(key);
              return (
                <button
                  type="button"
                  key={key}
                  role="option"
                  aria-selected={checked}
                  className={`msd__option${checked ? ' is-selected' : ''}`}
                  onClick={() => toggle(opt.value)}
                >
                  <span className={`msd__check${checked ? ' is-on' : ''}`} aria-hidden="true">{checked ? '✓' : ''}</span>
                  <span className="msd__avatar" aria-hidden="true">{(opt.label || '?').trim().slice(0, 1).toUpperCase()}</span>
                  <span className="msd__copy">
                    <strong>{opt.label}</strong>
                    {opt.meta && <small>{opt.meta}</small>}
                    {opt.hint && <em>{opt.hint}</em>}
                  </span>
                  <b>{checked ? 'Selected' : 'Select'}</b>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
