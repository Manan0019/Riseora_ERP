import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppIcon from "../components/AppIcon";
import riseoraLogoHori from "../assets/riseora-logo-Horizontal.jpeg";

const navGroups = [
  {
    label: "Overview",
    key: "overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    label: "Masters",
    key: "masters",
    items: [
      { to: "/company", label: "Company", icon: "company" },
      { to: "/units", label: "Units", icon: "units" },
      { to: "/categories", label: "Item Categories", icon: "categories" },
      { to: "/items", label: "Items", icon: "items" },
      { to: "/suppliers", label: "Suppliers", icon: "suppliers" },
      { to: "/customers", label: "Customers", icon: "customers" },
    ],
  },
  {
    label: "Purchase & Inventory",
    key: "inventory",
    items: [
      { to: "/purchases", label: "Purchase Entry", icon: "purchase" },
      { to: "/purchase-register", label: "Purchase Register", icon: "register" },
      { to: "/supplier-ledger", label: "Supplier Ledger", icon: "ledger" },
      { to: "/opening-stock", label: "Opening Stock", icon: "opening" },
      { to: "/opening-balances", label: "Opening Balances", icon: "opening" },
      { to: "/stock-adjustment", label: "Stock Adjustment", icon: "adjustment" },
      { to: "/stock", label: "Current Stock", icon: "stock" },
    ],
  },
  {
    label: "Manufacturing",
    key: "manufacturing",
    items: [
      { to: "/formulas", label: "Formula Master", icon: "formula" },
      { to: "/production", label: "Production Planning", icon: "production" },
      { to: "/production-register", label: "Production Register", icon: "register" },
    ],
  },
  {
    label: "Sales",
    key: "sales",
    items: [
      { to: "/sales", label: "Sales Invoice", icon: "sales" },
      { to: "/sales-register", label: "Sales Register", icon: "register" },
      { to: "/customer-ledger", label: "Customer Ledger", icon: "ledger" },
    ],
  },
  {
    label: "Reports",
    key: "reports",
    items: [{ to: "/reports", label: "Business Reports", icon: "reports" }],
  },
  {
    label: "System",
    key: "system",
    items: [{ to: "/settings", label: "Settings", icon: "settings" }],
  },
];

const pageMeta = {
  "/dashboard": ["Dashboard", "Business overview"],
  "/company": ["Company", "Business profile and statutory details"],
  "/units": ["Units", "Measurement units used across inventory"],
  "/categories": ["Item Categories", "Organize raw material, packaging and finished goods"],
  "/items": ["Items", "Manage inventory and product masters"],
  "/suppliers": ["Suppliers", "Supplier master and commercial details"],
  "/customers": ["Customers", "Customer master and credit settings"],
  "/purchases": ["Purchase Entry", "Record material and packaging purchases"],
  "/purchase-register": ["Purchase Register", "Review posted purchase transactions"],
  "/supplier-ledger": ["Supplier Ledger", "Payables, payments and supplier balances"],
  "/opening-stock": ["Opening Stock", "Initialize inventory quantity and value"],
  "/opening-balances": ["Opening Balances", "Initialize customer and supplier balances"],
  "/stock-adjustment": ["Stock Adjustment", "Record controlled inventory corrections"],
  "/stock": ["Current Stock", "Live quantities, costing and inventory value"],
  "/formulas": ["Formula Master", "Manufacturing standards and formula versions"],
  "/production": ["Production Planning", "Plan and start manufacturing batches"],
  "/production-register": ["Production Register", "Batch history, costing and yield"],
  "/sales": ["Sales Invoice", "Create customer invoices and collect payments"],
  "/sales-register": ["Sales Register", "Sales, profitability, returns and refunds"],
  "/customer-ledger": ["Customer Ledger", "Receivables, payments and running balances"],
  "/reports": ["Business Reports", "Operational and financial management reports"],
  "/settings": ["Settings", "Security, backups and application controls"],
};

function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  const meta = useMemo(() => {
    if (location.pathname.startsWith("/production/") && location.pathname.endsWith("/work")) {
      return ["Production Work", "Record actual manufacturing and complete the batch"];
    }
    return pageMeta[location.pathname] || ["Riseora ERP", "Business management workspace"];
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.fullName || user?.username || "A")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand-wrap">
          <NavLink to="/dashboard" className="brand-link" onClick={() => setSidebarOpen(false)}>
            <img src={riseoraLogoHori} alt="Riseora" className="brand-logo" />
          </NavLink>
          <button
            type="button"
            className="sidebar-mobile-close"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="sidebar-scroll">
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navGroups.map((group) => {
              const isCollapsed = collapsed[group.key];
              return (
                <section className="nav-group" key={group.key}>
                  {group.key !== "overview" && (
                    <button
                      type="button"
                      className="sidebar-heading"
                      aria-expanded={!isCollapsed}
                      onClick={() =>
                        setCollapsed((current) => ({
                          ...current,
                          [group.key]: !current[group.key],
                        }))
                      }
                    >
                      <span>{group.label}</span>
                      <AppIcon
                        name="chevron"
                        size={14}
                        className={`heading-chevron ${isCollapsed ? "collapsed" : ""}`}
                      />
                    </button>
                  )}

                  <div
                    className={`nav-group-items ${isCollapsed ? "collapsed" : ""}`}
                    aria-hidden={Boolean(isCollapsed)}
                  >
                    <div className="nav-group-items-inner">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            isActive ? "sidebar-link active" : "sidebar-link"
                          }
                          tabIndex={isCollapsed ? -1 : undefined}
                        >
                          <span className="sidebar-icon">
                            <AppIcon name={item.icon} size={18} />
                          </span>
                          <span className="sidebar-label">{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-dot" />
          <div>
            <strong>Riseora ERP</strong>
            <small>Local business system</small>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <AppIcon name="menu" size={21} />
            </button>

            <div className="page-context">
              <div className="page-context-title">{meta[0]}</div>
              <div className="page-context-subtitle">{meta[1]}</div>
            </div>
          </div>

          <div className="topbar-user">
            <div className="user-avatar" aria-hidden="true">{initials}</div>
            <div className="user-copy">
              <strong>{user?.fullName || user?.username || "Ram"}</strong>
              <small>Administrator</small>
            </div>
            <button type="button" className="topbar-logout" onClick={handleLogout}>
              <AppIcon name="logout" size={17} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="content-area">
          <div className="page-transition" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
