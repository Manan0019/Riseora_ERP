import { useMemo, useState } from "react";

export function useSortableRows(rows, defaultKey = "", defaultDirection = "asc") {
  const [sort, setSort] = useState({ key: defaultKey, direction: defaultDirection });
  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const left = a[sort.key]; const right = b[sort.key];
      if (left == null || left === "") return right == null || right === "" ? 0 : 1;
      if (right == null || right === "") return -1;
      const x = Number(left); const y = Number(right);
      const comparison = Number.isFinite(x) && Number.isFinite(y) ? x - y :
        String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "desc" ? -comparison : comparison;
    });
    return copy;
  }, [rows, sort]);
  function toggle(key) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  }
  return { sortedRows, sort, toggle };
}

export default function SortableTh({ field, sort, onSort, children, ...props }) {
  return <th {...props} aria-sort={sort.key === field ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
    <button type="button" className="table-sort-button" onClick={() => onSort(field)} title={`Sort by ${typeof children === "string" ? children : field}`}>
      <span>{children}</span><span className="table-sort-indicator" aria-hidden="true">{sort.key === field ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>
  </th>;
}
