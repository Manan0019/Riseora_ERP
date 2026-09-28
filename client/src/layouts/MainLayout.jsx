import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppIcon from "../components/AppIcon";
import riseoraLogoHori from "../assets/riseora-logo-Horizontal.png";

const navGroups = [
  { label: "Overview", key: "overview", items: [{ to: "/dashboard", label: "Dashboard", icon: "dashboard" }] },
  {
    label: "Masters", key: "masters", items: [
      { to: "/company", label: "Company", icon: "company" },
      { to: "/units", label: "Units", icon: "units" },
      { to: "/categories", label: "Item Categories", icon: "categories" },
      { to: "/items", label: "Items", icon: "items" },
      { to: "/suppliers", label: "Suppliers", icon: "suppliers" },
      { to: "/customers", label: "Customers", icon: "customers" },
    ],
  },
  {
    label: "Purchase & Inventory", key: "inventory", items: [
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
    label: "Manufacturing", key: "manufacturing", items: [
      { to: "/formulas", label: "Formula Master", icon: "formula" },
      { to: "/production", label: "Production Planning", icon: "production" },
      { to: "/production-register", label: "Production Register", icon: "register" },
    ],
  },
  {
    label: "Sales", key: "sales", items: [
      { to: "/sales", label: "Sales Invoice", icon: "sales" },
      { to: "/sales-register", label: "Sales Register", icon: "register" },
      { to: "/customer-ledger", label: "Customer Ledger", icon: "ledger" },
    ],
  },
  {
    label: "Finance", key: "finance", items: [
      { to: "/investments", label: "Investment", icon: "ledger" },
      { to: "/upad", label: "Upad", icon: "register" },
    ],
  },
  { label: "Reports", key: "reports", items: [{ to: "/reports", label: "Business Reports", icon: "reports" }] },
  { label: "System", key: "system", items: [{ to: "/settings", label: "Settings", icon: "settings" }] },
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
  "/investments": ["Investment", "Money lent, returns, interest and outstanding balances"],
  "/upad": ["Upad", "Management deduction from sales summary"],
  "/reports": ["Business Reports", "Operational and financial management reports"],
  "/settings": ["Settings", "Security, backups and application controls"],
};

function titleForPath(pathname) {
  if (pathname.startsWith("/production/") && pathname.endsWith("/work")) return "Production Work";
  return pageMeta[pathname]?.[0] || "Riseora ERP";
}

function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [tabs, setTabs] = useState(() => [{ id: 1, path: location.pathname || "/dashboard" }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [nextTabId, setNextTabId] = useState(2);

  const meta = useMemo(() => {
    if (location.pathname.startsWith("/production/") && location.pathname.endsWith("/work")) {
      return ["Production Work", "Record actual manufacturing and complete the batch"];
    }
    return pageMeta[location.pathname] || ["Riseora ERP", "Business management workspace"];
  }, [location.pathname]);

  useEffect(() => {
    setTabs((current) => current.map((tab) =>
      tab.id === activeTabId ? { ...tab, path: `${location.pathname}${location.search}` } : tab,
    ));
  }, [location.pathname, location.search, activeTabId]);

  const navigateInActiveTab = (path) => {
    setTabs((current) => current.map((tab) => tab.id === activeTabId ? { ...tab, path } : tab));
    navigate(path);
  };

  const newTab = () => {
    const id = nextTabId;
    setNextTabId((value) => value + 1);
    setTabs((current) => [...current, { id, path: "/dashboard" }]);
    setActiveTabId(id);
    navigate("/dashboard");
  };

  const switchTab = (tab) => {
    setActiveTabId(tab.id);
    navigate(tab.path || "/dashboard");
  };

  const closeTab = (event, id) => {
    event.stopPropagation();

    if (tabs.length === 1) {
      const reset = [{ ...tabs[0], path: "/dashboard" }];
      setTabs(reset);
      setActiveTabId(reset[0].id);
      navigate("/dashboard");
      return;
    }

    const index = tabs.findIndex((tab) => tab.id === id);
    const next = tabs.filter((tab) => tab.id !== id);
    setTabs(next);

    if (id === activeTabId) {
      const replacement = next[Math.max(0, Math.min(index, next.length - 1))];
      setActiveTabId(replacement.id);
      navigate(replacement.path || "/dashboard");
    }
  };

  const openNewWindow = () => {
    const url = `${window.location.origin}${location.pathname}${location.search}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.fullName || user?.username || "A")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand-wrap">
          <NavLink to="/dashboard" className="brand-link" onClick={(event) => { event.preventDefault(); navigateInActiveTab("/dashboard"); setSidebarOpen(false); }}>
            <img src={riseoraLogoHori} alt="Riseora" className="brand-logo" />
          </NavLink>
          <button type="button" className="sidebar-mobile-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>×</button>
        </div>

        <div className="sidebar-scroll">
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navGroups.map((group) => {
              const isCollapsed = collapsed[group.key];
              return (
                <section className="nav-group" key={group.key}>
                  {group.key !== "overview" && (
                    <button type="button" className="sidebar-heading" aria-expanded={!isCollapsed} onClick={() => setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }))}>
                      <span>{group.label}</span><AppIcon name="chevron" size={14} className={`heading-chevron ${isCollapsed ? "collapsed" : ""}`} />
                    </button>
                  )}
                  <div className={`nav-group-items ${isCollapsed ? "collapsed" : ""}`} aria-hidden={Boolean(isCollapsed)}>
                    <div className="nav-group-items-inner">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={(event) => { event.preventDefault(); navigateInActiveTab(item.to); setSidebarOpen(false); }}
                          className={location.pathname === item.to ? "sidebar-link active" : "sidebar-link"}
                          tabIndex={isCollapsed ? -1 : undefined}
                        >
                          <span className="sidebar-icon"><AppIcon name={item.icon} size={18} /></span>
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

        <div className="sidebar-footer"><div className="sidebar-footer-dot" /><div><strong>Riseora ERP</strong><small>Version 1.1.0 · Local business system</small></div></div>
      </aside>

      {sidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="topbar-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><AppIcon name="menu" size={21} /></button>
            <div className="page-context"><div className="page-context-title">{meta[0]}</div><div className="page-context-subtitle">{meta[1]}</div></div>
          </div>

          <div className="topbar-user">
            <div className="topbar-workspace-tools" aria-label="Workspace controls">
              <button type="button" title="New tab" onClick={newTab}><span aria-hidden="true">＋</span><span>New Tab</span></button>
              <button type="button" title="Open current page in a new Riseora window" onClick={openNewWindow}><span aria-hidden="true">□</span><span>New Window</span></button>
              <button type="button" title="Reload current page" onClick={() => window.location.reload()}><span aria-hidden="true">↻</span><span>Reload</span></button>
            </div>
            <div className="user-avatar" aria-hidden="true">{initials}</div>
            <div className="user-copy"><strong>{user?.fullName || user?.username || "Ram"}</strong><small>Administrator</small></div>
            <button type="button" className="topbar-logout" onClick={handleLogout}><AppIcon name="logout" size={17} /><span>Logout</span></button>
          </div>
        </header>

        <div className="workspace-tabs" role="tablist" aria-label="Open Riseora tabs">
          {tabs.map((tab) => (
            <button type="button" key={tab.id} className={`workspace-tab ${tab.id === activeTabId ? "active" : ""}`} onClick={() => switchTab(tab)}>
              <span>{titleForPath((tab.path || "/dashboard").split("?")[0])}</span>
              <span className="workspace-tab-close" role="button" aria-label="Close tab" onClick={(event) => closeTab(event, tab.id)}>×</span>
            </button>
          ))}
          <button type="button" className="workspace-tab-add" onClick={newTab} aria-label="New tab">＋</button>
        </div>

        <main className="content-area" spellCheck="true">
          <div className="page-transition" key={`${activeTabId}:${location.pathname}`}><Outlet /></div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
