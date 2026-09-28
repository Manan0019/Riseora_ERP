import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppIcon from "../components/AppIcon";
import riseoraLogoHori from "../assets/riseora-logo-Horizontal.png";

const WORKSPACE_STORAGE_KEY = "riseora.workspace.tabs.v1";

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

function safeWorkspacePath(path) {
  const value = String(path || "").trim();
  if (!value || value === "/" || value.startsWith("/login")) return "/dashboard";
  return value.startsWith("/") ? value : `/${value}`;
}

function titleForPath(pathname) {
  const cleanPath = safeWorkspacePath(pathname).split("?")[0];
  if (cleanPath.startsWith("/production/") && cleanPath.endsWith("/work")) return "Production Work";
  return pageMeta[cleanPath]?.[0] || "Riseora ERP";
}

function loadWorkspace(initialPath) {
  const fallback = {
    tabs: [{ id: 1, path: safeWorkspacePath(initialPath), revision: 0 }],
    activeTabId: 1,
    nextTabId: 2,
  };

  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const tabs = Array.isArray(parsed?.tabs)
      ? parsed.tabs
          .filter((tab) => Number.isInteger(Number(tab?.id)) && typeof tab?.path === "string")
          .slice(0, 30)
          .map((tab) => ({
            id: Number(tab.id),
            path: safeWorkspacePath(tab.path),
            revision: Number(tab.revision || 0),
          }))
      : [];

    if (tabs.length === 0) return fallback;

    let activeTabId = Number(parsed?.activeTabId);
    if (!tabs.some((tab) => tab.id === activeTabId)) {
      activeTabId = tabs[0].id;
    }

    const requestedPath = safeWorkspacePath(initialPath);
    const syncedTabs = tabs.map((tab) =>
      tab.id === activeTabId ? { ...tab, path: requestedPath } : tab,
    );

    const maxId = Math.max(...syncedTabs.map((tab) => tab.id));
    const nextTabId = Math.max(Number(parsed?.nextTabId || 0), maxId + 1);

    return { tabs: syncedTabs, activeTabId, nextTabId };
  } catch {
    return fallback;
  }
}

function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentLocationPath = safeWorkspacePath(`${location.pathname}${location.search}`);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [initialWorkspace] = useState(() => loadWorkspace(currentLocationPath));
  const [tabs, setTabs] = useState(initialWorkspace.tabs);
  const [activeTabId, setActiveTabId] = useState(initialWorkspace.activeTabId);
  const [nextTabId, setNextTabId] = useState(initialWorkspace.nextTabId);
  const [contextMenu, setContextMenu] = useState(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];

  const meta = useMemo(() => {
    if (location.pathname.startsWith("/production/") && location.pathname.endsWith("/work")) {
      return ["Production Work", "Record actual manufacturing and complete the batch"];
    }
    return pageMeta[location.pathname] || ["Riseora ERP", "Business management workspace"];
  }, [location.pathname]);

  useEffect(() => {
    setTabs((current) => {
      let changed = false;
      const next = current.map((tab) => {
        if (tab.id !== activeTabId || tab.path === currentLocationPath) return tab;
        changed = true;
        return { ...tab, path: currentLocationPath };
      });
      return changed ? next : current;
    });
  }, [currentLocationPath, activeTabId]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ tabs, activeTabId, nextTabId }),
      );
    } catch {
      // Workspace persistence is a convenience only; navigation must keep working without it.
    }
  }, [tabs, activeTabId, nextTabId]);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const close = () => setContextMenu(null);
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const navigateInActiveTab = (path) => {
    const targetPath = safeWorkspacePath(path);
    setTabs((current) => current.map((tab) =>
      tab.id === activeTabId ? { ...tab, path: targetPath } : tab,
    ));
    navigate(targetPath);
  };

  const openPathInNewTab = (path = "/dashboard") => {
    const targetPath = safeWorkspacePath(path);
    const id = nextTabId;

    setNextTabId(id + 1);
    setTabs((current) => [...current, { id, path: targetPath, revision: 0 }]);
    setActiveTabId(id);
    setContextMenu(null);
    navigate(targetPath);
  };

  const switchTab = (tab) => {
    setActiveTabId(tab.id);
    setContextMenu(null);
    navigate(tab.path || "/dashboard");
  };

  const closeTab = (event, id) => {
    event.stopPropagation();

    if (tabs.length === 1) {
      const reset = [{ ...tabs[0], path: "/dashboard", revision: Number(tabs[0].revision || 0) + 1 }];
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

  const openNewWindow = (path = activeTab?.path || currentLocationPath) => {
    const targetPath = safeWorkspacePath(path);
    const url = `${window.location.origin}${targetPath}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setContextMenu(null);
  };

  const reloadTab = (tabId = activeTabId) => {
    const target = tabs.find((tab) => tab.id === tabId) || activeTab;
    if (!target) return;

    setTabs((current) => current.map((tab) =>
      tab.id === target.id
        ? { ...tab, revision: Number(tab.revision || 0) + 1 }
        : tab,
    ));

    if (target.id !== activeTabId) {
      setActiveTabId(target.id);
      navigate(target.path || "/dashboard");
    }

    setContextMenu(null);
  };

  const handleContextMenu = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    const pathElement = target.closest("[data-workspace-path]");
    const rawPath = pathElement?.getAttribute("data-workspace-path");
    const rawTabId = pathElement?.getAttribute("data-workspace-tab-id");
    const rawTitle = pathElement?.getAttribute("data-workspace-title");
    const path = safeWorkspacePath(rawPath || activeTab?.path || currentLocationPath);
    const targetTabId = Number(rawTabId);

    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 246;
    const menuHeight = 178;
    const x = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8));
    const y = Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8));

    setContextMenu({
      x,
      y,
      path,
      tabId: Number.isInteger(targetTabId) && targetTabId > 0 ? targetTabId : activeTabId,
      title: rawTitle || titleForPath(path),
    });
  };

  const handleLogout = async () => {
    try {
      window.sessionStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } catch {
      // Ignore storage-only errors during logout.
    }
    await logout();
    navigate("/login");
  };

  const initials = (user?.fullName || user?.username || "A")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const pageKey = `${activeTabId}:${Number(activeTab?.revision || 0)}:${location.pathname}${location.search}`;

  return (
    <div className="app-shell" onContextMenu={handleContextMenu}>
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand-wrap">
          <NavLink
            to="/dashboard"
            data-workspace-path="/dashboard"
            data-workspace-title="Dashboard"
            className="brand-link"
            onClick={(event) => {
              event.preventDefault();
              navigateInActiveTab("/dashboard");
              setSidebarOpen(false);
            }}
          >
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
                    <button
                      type="button"
                      className="sidebar-heading"
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }))}
                    >
                      <span>{group.label}</span>
                      <AppIcon name="chevron" size={14} className={`heading-chevron ${isCollapsed ? "collapsed" : ""}`} />
                    </button>
                  )}
                  <div className={`nav-group-items ${isCollapsed ? "collapsed" : ""}`} aria-hidden={Boolean(isCollapsed)}>
                    <div className="nav-group-items-inner">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          data-workspace-path={item.to}
                          data-workspace-title={item.label}
                          onClick={(event) => {
                            event.preventDefault();
                            navigateInActiveTab(item.to);
                            setSidebarOpen(false);
                          }}
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

        <div className="sidebar-footer">
          <div className="sidebar-footer-dot" />
          <div><strong>Riseora ERP</strong><small>Version 1.1.0 · Local business system</small></div>
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
            <button type="button" className="topbar-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              <AppIcon name="menu" size={21} />
            </button>
            <div className="page-context">
              <div className="page-context-title">{meta[0]}</div>
              <div className="page-context-subtitle">{meta[1]}</div>
            </div>
          </div>

          <div className="topbar-user">
            <div className="topbar-workspace-tools" aria-label="Workspace controls">
              <button type="button" title="New tab" onClick={() => openPathInNewTab("/dashboard")}>
                <span aria-hidden="true">＋</span><span>New Tab</span>
              </button>
              <button type="button" title="Open current page in a new Riseora window" onClick={() => openNewWindow()}>
                <span aria-hidden="true">□</span><span>New Window</span>
              </button>
              <button type="button" title="Reload only the current Riseora tab" onClick={() => reloadTab(activeTabId)}>
                <span aria-hidden="true">↻</span><span>Reload</span>
              </button>
            </div>
            <div className="user-avatar" aria-hidden="true">{initials}</div>
            <div className="user-copy"><strong>{user?.fullName || user?.username || "Ram"}</strong><small>Administrator</small></div>
            <button type="button" className="topbar-logout" onClick={handleLogout}>
              <AppIcon name="logout" size={17} /><span>Logout</span>
            </button>
          </div>
        </header>

        <div className="workspace-tabs" role="tablist" aria-label="Open Riseora tabs">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              data-workspace-path={tab.path}
              data-workspace-tab-id={tab.id}
              data-workspace-title={titleForPath(tab.path)}
              className={`workspace-tab ${tab.id === activeTabId ? "active" : ""}`}
              onClick={() => switchTab(tab)}
            >
              <span className="workspace-tab-label">{titleForPath(tab.path)}</span>
              <span
                className="workspace-tab-close"
                role="button"
                tabIndex={0}
                aria-label="Close tab"
                title="Close tab"
                onClick={(event) => closeTab(event, tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") closeTab(event, tab.id);
                }}
              >
                ×
              </span>
            </button>
          ))}
          <button type="button" className="workspace-tab-add" onClick={() => openPathInNewTab("/dashboard")} aria-label="New tab" title="New tab">＋</button>
        </div>

        <main className="content-area" spellCheck="true">
          <div className="page-transition" key={pageKey}><Outlet /></div>
        </main>
      </div>

      {contextMenu && (
        <div
          className="workspace-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="workspace-context-menu-title" title={contextMenu.title}>{contextMenu.title}</div>
          <button type="button" role="menuitem" onClick={() => openPathInNewTab(contextMenu.path)}>
            <span className="workspace-context-menu-icon" aria-hidden="true">＋</span>
            Open in New Tab
          </button>
          <button type="button" role="menuitem" onClick={() => openNewWindow(contextMenu.path)}>
            <span className="workspace-context-menu-icon" aria-hidden="true">□</span>
            Open in New Window
          </button>
          <div className="workspace-context-menu-separator" />
          <button type="button" role="menuitem" onClick={() => reloadTab(contextMenu.tabId)}>
            <span className="workspace-context-menu-icon" aria-hidden="true">↻</span>
            Reload Tab
          </button>
        </div>
      )}
    </div>
  );
}

export default MainLayout;
