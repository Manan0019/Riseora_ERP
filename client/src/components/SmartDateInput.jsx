import { useEffect, useRef, useState } from "react";

function partsFromIso(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { day: "", month: "", year: "" };
  return { day: match[3], month: match[2], year: match[1] };
}

function normalizeTwoDigits(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 2);
  if (!digits) return "";
  return digits.length === 1 ? `0${digits}` : digits;
}

function isoFromParts(day, month, year, min, max) {
  if (!/^\d{2}$/.test(day) || !/^\d{2}$/.test(month) || !/^\d{4}$/.test(year)) {
    return null;
  }

  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }

  const iso = `${year}-${month}-${day}`;
  if (min && iso < String(min)) return null;
  if (max && iso > String(max)) return null;
  return iso;
}

function parsePastedDate(text) {
  const source = String(text || "").trim();
  if (!source) return null;

  const iso = source.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return {
      day: String(iso[3]).padStart(2, "0"),
      month: String(iso[2]).padStart(2, "0"),
      year: iso[1],
    };
  }

  const indian = source.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (indian) {
    return {
      day: String(indian[1]).padStart(2, "0"),
      month: String(indian[2]).padStart(2, "0"),
      year: indian[3],
    };
  }

  const digits = source.replace(/\D/g, "");
  if (digits.length === 8) {
    return {
      day: digits.slice(0, 2),
      month: digits.slice(2, 4),
      year: digits.slice(4, 8),
    };
  }

  return null;
}

function syntheticEvent(name, value) {
  const target = { name, value, type: "date" };
  return { target, currentTarget: target };
}

export default function SmartDateInput({
  value = "",
  onChange,
  onBlur,
  onFocus,
  name,
  id,
  className = "form-control",
  disabled = false,
  required = false,
  min,
  max,
  autoFocus = false,
  tabIndex,
  style,
  title,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}) {
  const initial = partsFromIso(value);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [invalid, setInvalid] = useState(false);

  const rootRef = useRef(null);
  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);
  const focusedRef = useRef(false);
  const lastEmittedRef = useRef(String(value || ""));

  const syncFromValue = (nextValue) => {
    const parts = partsFromIso(nextValue);
    setDay(parts.day);
    setMonth(parts.month);
    setYear(parts.year);
    setInvalid(false);
    lastEmittedRef.current = String(nextValue || "");
  };

  useEffect(() => {
    if (!focusedRef.current && String(value || "") !== lastEmittedRef.current) {
      syncFromValue(value);
    }
  }, [value]);

  const emit = (nextDay, nextMonth, nextYear, { clearIncomplete = false } = {}) => {
    const allBlank = !nextDay && !nextMonth && !nextYear;
    if (allBlank) {
      setInvalid(false);
      if (lastEmittedRef.current !== "") {
        lastEmittedRef.current = "";
        onChange?.(syntheticEvent(name, ""));
      }
      return;
    }

    const nextIso = isoFromParts(nextDay, nextMonth, nextYear, min, max);
    if (nextIso) {
      setInvalid(false);
      if (lastEmittedRef.current !== nextIso) {
        lastEmittedRef.current = nextIso;
        onChange?.(syntheticEvent(name, nextIso));
      }
      return;
    }

    const complete = nextDay.length === 2 && nextMonth.length === 2 && nextYear.length === 4;
    setInvalid(complete);

    if (clearIncomplete && lastEmittedRef.current !== "") {
      lastEmittedRef.current = "";
      onChange?.(syntheticEvent(name, ""));
    }
  };

  const applyParts = (nextDay, nextMonth, nextYear, options) => {
    setDay(nextDay);
    setMonth(nextMonth);
    setYear(nextYear);
    emit(nextDay, nextMonth, nextYear, options);
  };

  const handleDayChange = (event) => {
    let digits = event.target.value.replace(/\D/g, "");

    if (digits.length >= 8) {
      const parsed = parsePastedDate(digits.slice(0, 8));
      if (parsed) {
        applyParts(parsed.day, parsed.month, parsed.year, { clearIncomplete: true });
        yearRef.current?.focus();
        yearRef.current?.select();
        return;
      }
    }

    digits = digits.slice(0, 2);
    if (digits.length === 1 && Number(digits) >= 4) {
      digits = `0${digits}`;
    }

    applyParts(digits, month, year, { clearIncomplete: true });
    if (digits.length === 2) {
      window.requestAnimationFrame(() => {
        monthRef.current?.focus();
        monthRef.current?.select();
      });
    }
  };

  const handleMonthChange = (event) => {
    let digits = event.target.value.replace(/\D/g, "").slice(0, 2);
    if (digits.length === 1 && Number(digits) >= 2) {
      digits = `0${digits}`;
    }

    applyParts(day, digits, year, { clearIncomplete: true });
    if (digits.length === 2) {
      window.requestAnimationFrame(() => {
        yearRef.current?.focus();
        yearRef.current?.select();
      });
    }
  };

  const handleYearChange = (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
    applyParts(day, month, digits, { clearIncomplete: true });
  };

  const handlePaste = (event) => {
    const parsed = parsePastedDate(event.clipboardData?.getData("text"));
    if (!parsed) return;
    event.preventDefault();
    applyParts(parsed.day, parsed.month, parsed.year, { clearIncomplete: true });
    window.requestAnimationFrame(() => yearRef.current?.focus());
  };

  const handleSegmentFocus = (event) => {
    if (!focusedRef.current) {
      focusedRef.current = true;
      onFocus?.(syntheticEvent(name, String(value || "")));
    }
    event.target.select?.();
  };

  const handleSegmentBlur = () => {
    window.setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) return;
      focusedRef.current = false;

      const normalizedDay = normalizeTwoDigits(day);
      const normalizedMonth = normalizeTwoDigits(month);
      if (normalizedDay !== day) setDay(normalizedDay);
      if (normalizedMonth !== month) setMonth(normalizedMonth);

      emit(normalizedDay, normalizedMonth, year, { clearIncomplete: true });
      onBlur?.(syntheticEvent(name, lastEmittedRef.current));
    }, 0);
  };

  const handleDayKeyDown = (event) => {
    if ((event.key === "ArrowRight" && event.currentTarget.selectionStart === day.length) || event.key === "/") {
      event.preventDefault();
      monthRef.current?.focus();
    }
  };

  const handleMonthKeyDown = (event) => {
    if (event.key === "Backspace" && !month) {
      event.preventDefault();
      dayRef.current?.focus();
      return;
    }
    if ((event.key === "ArrowRight" && event.currentTarget.selectionStart === month.length) || event.key === "/") {
      event.preventDefault();
      yearRef.current?.focus();
    }
    if (event.key === "ArrowLeft" && event.currentTarget.selectionStart === 0) {
      event.preventDefault();
      dayRef.current?.focus();
    }
  };

  const handleYearKeyDown = (event) => {
    if (event.key === "Backspace" && !year) {
      event.preventDefault();
      monthRef.current?.focus();
      return;
    }
    if (event.key === "ArrowLeft" && event.currentTarget.selectionStart === 0) {
      event.preventDefault();
      monthRef.current?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      id={id}
      className={`${className || ""} smart-date-input${invalid ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}`.trim()}
      style={style}
      title={title}
      aria-label={ariaLabel || "Date"}
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid ? "true" : undefined}
      aria-disabled={disabled ? "true" : undefined}
    >
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="smart-date-part smart-date-day"
        value={day}
        onChange={handleDayChange}
        onFocus={handleSegmentFocus}
        onBlur={handleSegmentBlur}
        onKeyDown={handleDayKeyDown}
        onPaste={handlePaste}
        placeholder="DD"
        maxLength={8}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        aria-label="Day"
        autoComplete="off"
      />
      <span className="smart-date-separator" aria-hidden="true">/</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="smart-date-part smart-date-month"
        value={month}
        onChange={handleMonthChange}
        onFocus={handleSegmentFocus}
        onBlur={handleSegmentBlur}
        onKeyDown={handleMonthKeyDown}
        onPaste={handlePaste}
        placeholder="MM"
        maxLength={2}
        disabled={disabled}
        aria-label="Month"
        autoComplete="off"
      />
      <span className="smart-date-separator" aria-hidden="true">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="smart-date-part smart-date-year"
        value={year}
        onChange={handleYearChange}
        onFocus={handleSegmentFocus}
        onBlur={handleSegmentBlur}
        onKeyDown={handleYearKeyDown}
        onPaste={handlePaste}
        placeholder="YYYY"
        maxLength={4}
        disabled={disabled}
        aria-label="Year"
        autoComplete="off"
      />
    </div>
  );
}
