import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./SearchableSelect.css";

function asText(value) {
  return String(value ?? "");
}

function defaultGetValue(option) {
  return option?.id;
}

function defaultGetLabel(option) {
  if (!option) return "";
  if (option.label != null) return asText(option.label);
  if (option.name != null && option.code != null) return `${option.code} - ${option.name}`;
  return asText(option.name ?? option.code ?? option.id ?? "");
}

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Search...",
  disabled = false,
  getOptionValue = defaultGetValue,
  getOptionLabel = defaultGetLabel,
  getOptionMeta = () => "",
  getOptionSearchText,
  emptyMessage = "No matching records.",
  maxResults = 60,
  allowClear = true,
  ariaLabel,
  inputClassName = "",
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState({});

  const normalizedValue = asText(value);

  const selectedOption = useMemo(
    () => options.find((option) => asText(getOptionValue(option)) === normalizedValue) || null,
    [options, getOptionValue, normalizedValue],
  );

  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : "";

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [selectedLabel, open]);

  const effectiveSearch = useMemo(() => {
    const trimmed = query.trim();
    if (selectedOption && trimmed === selectedLabel) return "";
    return trimmed.toLowerCase();
  }, [query, selectedLabel, selectedOption]);

  const filteredOptions = useMemo(() => {
    if (!effectiveSearch) return options.slice(0, maxResults);

    const matches = options.filter((option) => {
      const label = getOptionLabel(option);
      const meta = getOptionMeta(option);
      const extra = getOptionSearchText ? getOptionSearchText(option) : "";
      return `${label} ${meta} ${extra}`.toLowerCase().includes(effectiveSearch);
    });

    return matches.slice(0, maxResults);
  }, [options, effectiveSearch, maxResults, getOptionLabel, getOptionMeta, getOptionSearchText]);

  const moreCount = useMemo(() => {
    if (!effectiveSearch) return Math.max(0, options.length - filteredOptions.length);
    const total = options.reduce((count, option) => {
      const label = getOptionLabel(option);
      const meta = getOptionMeta(option);
      const extra = getOptionSearchText ? getOptionSearchText(option) : "";
      return `${label} ${meta} ${extra}`.toLowerCase().includes(effectiveSearch) ? count + 1 : count;
    }, 0);
    return Math.max(0, total - filteredOptions.length);
  }, [options, filteredOptions.length, effectiveSearch, getOptionLabel, getOptionMeta, getOptionSearchText]);

  const updateMenuPosition = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportSpaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = Math.min(320, Math.max(88, filteredOptions.length * 48 + 24));
    const openAbove = viewportSpaceBelow < menuHeight && rect.top > viewportSpaceBelow;

    setMenuStyle({
      position: "fixed",
      left: `${Math.max(8, rect.left)}px`,
      width: `${Math.max(220, rect.width)}px`,
      top: openAbove ? "auto" : `${rect.bottom + 4}px`,
      bottom: openAbove ? `${window.innerHeight - rect.top + 4}px` : "auto",
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const reposition = () => updateMenuPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, filteredOptions.length]);

  useEffect(() => {
    setHighlightedIndex((current) =>
      filteredOptions.length === 0 ? 0 : Math.min(current, filteredOptions.length - 1),
    );
  }, [filteredOptions.length]);

  const choose = (option) => {
    const nextValue = option ? asText(getOptionValue(option)) : "";
    onChange?.(nextValue, option || null);
    setQuery(option ? getOptionLabel(option) : "");
    setOpen(false);
    setHighlightedIndex(0);
  };

  const openMenu = (event) => {
    if (disabled) return;
    setOpen(true);
    setHighlightedIndex(0);
    window.requestAnimationFrame(updateMenuPosition);
    event?.currentTarget?.select?.();
  };

  const closeAndRestore = () => {
    setOpen(false);
    setQuery(selectedLabel);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        window.requestAnimationFrame(updateMenuPosition);
      } else if (filteredOptions.length) {
        setHighlightedIndex((current) => (current + 1) % filteredOptions.length);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        window.requestAnimationFrame(updateMenuPosition);
      } else if (filteredOptions.length) {
        setHighlightedIndex((current) =>
          current <= 0 ? filteredOptions.length - 1 : current - 1,
        );
      }
      return;
    }

    if (event.key === "Enter") {
      if (!open) {
        event.preventDefault();
        setOpen(true);
        window.requestAnimationFrame(updateMenuPosition);
        return;
      }
      if (filteredOptions[highlightedIndex]) {
        event.preventDefault();
        choose(filteredOptions[highlightedIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestore();
    }
  };

  const menu = open && !disabled ? (
    <div className="searchable-select-menu" style={menuStyle} role="listbox">
      {filteredOptions.length === 0 ? (
        <div className="searchable-select-empty">{emptyMessage}</div>
      ) : (
        filteredOptions.map((option, index) => {
          const optionValue = asText(getOptionValue(option));
          const active = index === highlightedIndex;
          const selected = optionValue === normalizedValue;
          const meta = getOptionMeta(option);
          return (
            <button
              type="button"
              key={optionValue || `${getOptionLabel(option)}-${index}`}
              className={`searchable-select-option${active ? " is-active" : ""}${selected ? " is-selected" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="option"
              aria-selected={selected}
            >
              <span className="searchable-select-option-label">{getOptionLabel(option)}</span>
              {meta ? <span className="searchable-select-option-meta">{meta}</span> : null}
            </button>
          );
        })
      )}
      {moreCount > 0 && (
        <div className="searchable-select-more">
          {moreCount} more match{moreCount === 1 ? "" : "es"}. Keep typing to narrow the list.
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className={`searchable-select ${disabled ? "is-disabled" : ""}`} ref={rootRef}>
      <input
        ref={inputRef}
        type="text"
        className={`form-control searchable-select-input ${inputClassName}`.trim()}
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-label={ariaLabel || placeholder}
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={openMenu}
        onClick={() => {
          if (!disabled && !open) {
            setOpen(true);
            window.requestAnimationFrame(updateMenuPosition);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlightedIndex(0);
          window.requestAnimationFrame(updateMenuPosition);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(closeAndRestore, 100)}
      />

      <span className="searchable-select-search-icon" aria-hidden="true">⌕</span>

      {allowClear && normalizedValue && !disabled && (
        <button
          type="button"
          className="searchable-select-clear"
          aria-label="Clear selection"
          title="Clear selection"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => choose(null)}
        >
          ×
        </button>
      )}

      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
