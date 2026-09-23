const icons = {
  dashboard: ["M3 3h7v7H3z", "M14 3h7v4h-7z", "M14 11h7v10h-7z", "M3 14h7v7H3z"],
  company: ["M4 21h16", "M6 21V7l6-4 6 4v14", "M9 10h1", "M14 10h1", "M9 14h1", "M14 14h1"],
  units: ["M4 19V5", "M4 5h16", "M8 5v4", "M12 5v2", "M16 5v4", "M20 5v14H4"],
  categories: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  items: ["M6 4h12l2 4-8 4-8-4z", "M4 8v10l8 3 8-3V8", "M12 12v9"],
  suppliers: ["M3 7h11v10H3z", "M14 10h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4", "M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4"],
  customers: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  purchase: ["M3 3h2l2.4 10.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6", "M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2", "M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2"],
  register: ["M5 3h14v18H5z", "M8 7h8", "M8 11h8", "M8 15h5"],
  ledger: ["M4 3h16v18H4z", "M8 3v18", "M12 8h5", "M12 12h5", "M12 16h3"],
  opening: ["M12 3v12", "M7 10l5 5 5-5", "M5 21h14"],
  adjustment: ["M4 7h10", "M11 4l3 3-3 3", "M20 17H10", "M13 14l-3 3 3 3"],
  stock: ["M12 2l9 5-9 5-9-5z", "M3 7v10l9 5 9-5V7", "M12 12v10"],
  formula: ["M9 3h6", "M10 3v5l-5 9a3 3 0 0 0 2.6 4h8.8A3 3 0 0 0 19 17l-5-9V3", "M8 15h8"],
  production: ["M3 21V9l5 3V9l5 3V7l8 4v10z", "M17 4h2v5", "M7 17h2", "M12 17h2", "M17 17h2"],
  sales: ["M6 2h12v20H6z", "M9 6h6", "M9 10h6", "M9 14h3", "M9 18h6"],
  reports: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-3v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 5 15.4a1.7 1.7 0 0 0-1.56-1.03H3v-3h.44A1.7 1.7 0 0 0 5 10.34a1.7 1.7 0 0 0-.34-1.88L4.6 8.4l2.12-2.12.06.06A1.7 1.7 0 0 0 8.66 6a1.7 1.7 0 0 0 1.03-1.56V4h3v.44A1.7 1.7 0 0 0 13.72 6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21v3h-.56A1.7 1.7 0 0 0 19.4 15z"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  chevron: ["M9 18l6-6-6-6"],
  logout: ["M10 17l5-5-5-5", "M15 12H3", "M21 19V5a2 2 0 0 0-2-2h-6"],
  refresh: ["M20 6v6h-6", "M4 18v-6h6", "M5.5 9a7 7 0 0 1 11.9-2.6L20 12", "M4 12l2.6 5.6A7 7 0 0 0 18.5 15"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  alert: ["M12 9v4", "M12 17h.01", "M10.3 3.7 2-1 2 1 8 14A2 2 0 0 1 20.6 21H3.4a2 2 0 0 1-1.7-3.3z"],
  check: ["M5 12l4 4L19 6"],
  info: ["M12 8h.01", "M11 12h1v5h1"],
  warning: ["M12 9v4", "M12 17h.01", "M10.3 3.7 2-1 2 1 8 14A2 2 0 0 1 20.6 21H3.4a2 2 0 0 1-1.7-3.3z"],
};

function AppIcon({ name, size = 18, className = "" }) {
  const paths = icons[name] || icons.dashboard;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
}

export default AppIcon;
