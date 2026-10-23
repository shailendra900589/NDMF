import { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './SearchableSelect.css';

function textOf(value) {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textOf).join('');
  return isValidElement(value) ? textOf(value.props.children) : '';
}
function readOptions(children, group = '', disabled = false) {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return [];
    if (child.type === 'option') {
      const label = textOf(child.props.children);
      return [{ value: String(child.props.value ?? label), label, group, disabled: disabled || !!child.props.disabled }];
    }
    return readOptions(child.props.children, child.type === 'optgroup' ? child.props.label : group, disabled || !!child.props.disabled);
  });
}
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

/** Native select-compatible values/form validation with a searchable, keyboard-accessible popup. */
export default function SearchableSelect({ children, value, defaultValue, onChange, disabled = false, required = false, name, id, className = '', style, onBlur, onFocus, ...props }) {
  const generated = useId();
  const inputId = id || `select-${generated}`;
  const listId = `${inputId}-options`;
  const options = useMemo(() => readOptions(children), [children]);
  const [internal, setInternal] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const current = String(value ?? internal);
  const selected = options.find(option => option.value === current);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [invalid, setInvalid] = useState(false);
  const [label, setLabel] = useState('');
  const [position, setPosition] = useState(null);
  const root = useRef(null), input = useRef(null), popup = useRef(null), native = useRef(null);
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
  const filtered = options.filter(option => tokens.every(token => normalize(`${option.label} ${option.group}`).includes(token)));
  const enabled = filtered.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
  const activeIndex = enabled.includes(active) ? active : enabled[0] ?? -1;

  useEffect(() => {
    const sibling = root.current?.previousElementSibling;
    const element = sibling?.tagName === 'LABEL' ? sibling : root.current?.closest('label');
    if (element) setLabel([...element.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim() || element.textContent.trim());
  }, []);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { if (!required || (selected && current !== '')) setInvalid(false); }, [required, current, selected?.value]);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = event => {
      if (event?.target?.nodeType && popup.current?.contains(event.target)) return;
      const rect = input.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const flip = below < 200 && above > below;
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: Math.min(rect.width, window.innerWidth - 16),
        maxHeight: Math.max(90, Math.min(300, flip ? above : below)), ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) });
    };
    const outside = event => { if (!root.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false); };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, listId]);

  const begin = () => { if (!disabled) { setQuery(''); setActive(options.findIndex(option => option.value === current && !option.disabled)); setOpen(true); } };
  const choose = option => {
    if (!option || option.disabled) return;
    setInternal(option.value); setOpen(false); setQuery(''); setInvalid(false);
    if (native.current) native.current.value = option.value;
    if (option.value !== current) onChange?.({ target: native.current || { value: option.value, name }, currentTarget: native.current || { value: option.value, name } });
  };
  const keyDown = event => {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key) || (open && ['Home', 'End'].includes(event.key))) {
      event.preventDefault();
      if (event.key === 'Escape') { setOpen(false); return; }
      if (!open) { begin(); return; }
      if (event.key === 'Enter') { choose(filtered[activeIndex]); return; }
      if (event.key === 'Home') { setActive(enabled[0] ?? -1); return; }
      if (event.key === 'End') { setActive(enabled.at(-1) ?? -1); return; }
      const step = event.key === 'ArrowUp' ? -1 : 1;
      const next = enabled.indexOf(activeIndex) + step;
      setActive(enabled[Math.max(0, Math.min(enabled.length - 1, next))] ?? -1);
    }
  };
  return <div ref={root} className={`search-select ${disabled ? 'is-disabled' : ''} ${className}`} style={style}>
    <input {...props} ref={input} id={inputId} role="combobox" type="text" autoComplete="off" disabled={disabled}
      aria-label={props['aria-label'] || label || undefined} aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-autocomplete="list" aria-required={required} aria-invalid={invalid || undefined}
      aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      value={open ? query : selected?.label || ''} placeholder={open ? 'Type to search…' : 'Select an option'}
      onFocus={event => { begin(); onFocus?.(event); }} onClick={() => { if (!open) begin(); }}
      onChange={event => { setQuery(event.target.value); setActive(-1); if (!open) setOpen(true); }}
      onKeyDown={keyDown} onBlur={event => { setOpen(false); onBlur?.(event); }} />
    <button type="button" className="search-select__toggle" tabIndex={-1} disabled={disabled}
      aria-label={`${open ? 'Close' : 'Open'} ${label || 'dropdown'} options`} onMouseDown={event => event.preventDefault()}
      onClick={() => { if (open) setOpen(false); else { input.current?.focus(); begin(); } }}>
      <span aria-hidden="true">{open ? '⌃' : '⌄'}</span>
    </button>
    <select ref={native} className="search-select__native" aria-hidden="true" tabIndex={-1} name={name} value={current}
      disabled={disabled} required={required} onChange={event => choose(options.find(option => option.value === event.target.value))}
      onInvalid={event => { event.preventDefault(); setInvalid(true); input.current?.focus(); begin(); }}>
      {children}
    </select>
    {invalid && <small className="search-select__error" role="alert">Please select an option.</small>}
    {open && position && typeof document !== 'undefined' && createPortal(<div ref={popup} className="search-select__popup" style={position}>
      <div className="search-select__count" role="status">{filtered.length} of {options.length} options · type to filter</div>
      <div id={listId} role="listbox" aria-label={label || props['aria-label'] || 'Options'}>
        {filtered.map((option, index) => <div key={`${option.value}-${index}`}>
          {option.group && filtered[index - 1]?.group !== option.group && <div className="search-select__group">{option.group}</div>}
          <div id={`${listId}-${index}`} role="option" aria-selected={option.value === current} aria-disabled={option.disabled || undefined}
            className={`search-select__option ${index === activeIndex ? 'is-active' : ''} ${option.disabled ? 'is-disabled' : ''}`}
            onMouseDown={event => event.preventDefault()} onMouseMove={() => !option.disabled && setActive(index)} onClick={() => choose(option)}>
            <span>{option.label || 'None'}</span>{option.value === current && <span aria-hidden="true">✓</span>}
          </div>
        </div>)}
        {!filtered.length && <p className="search-select__empty">No matching options. Try another name, ID or location.</p>}
      </div>
    </div>, document.body)}
  </div>;
}
