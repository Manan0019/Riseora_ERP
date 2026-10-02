import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppIcon from "../components/AppIcon";
import riseoraLogoHori from "../assets/riseora-logo-Horizontal.png";
import { WorkspaceTabProvider } from "../context/WorkspaceTabContext";
import Dashboard from "../pages/Dashboard";
import Company from "../pages/Company";
import Units from "../pages/Units";
import Categories from "../pages/Categories";
import Items from "../pages/Items";
import Suppliers from "../pages/Suppliers";
import Customers from "../pages/Customers";
import Settings from "../pages/Settings";
import Purchases from "../pages/Purchases";
import Stock from "../pages/Stock";
import PurchaseRegister from "../pages/PurchaseRegister";
import OpeningStock from "../pages/OpeningStock";
import OpeningBalances from "../pages/OpeningBalances";
import StockAdjustment from "../pages/StockAdjustment";
import Formulas from "../pages/Formulas";
import Production from "../pages/Production";
import ProductionRegister from "../pages/ProductionRegister";
import ProductionWork from "../pages/ProductionWork";
import Sales from "../pages/Sales";
import SalesRegister from "../pages/SalesRegister";
import CustomerLedger from "../pages/CustomerLedger";
import SupplierLedger from "../pages/SupplierLedger";
import Reports from "../pages/Reports";
import Investments from "../pages/Investments";
import Upad from "../pages/Upad";

const WORKSPACE_STORAGE_KEY = "riseora.workspace.tabs.v2";
const TAB_SLEEP_MS = 30 * 60 * 1000;
const TAB_SLEEP_CHECK_MS = 60 * 1000;

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
  "/investments": ["Investment", "Borrowed funds, simple interest, returns and outstanding balances"],
  "/upad": ["Upad", "Management deduction from sales summary"],
  "/reports": ["Business Reports", "Operational and financial management reports"],
  "/settings": ["Settings", "Security, backups and application controls"],
};

function WorkspaceRoutes({ location }) {
  return (
    <Routes location={location}>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="company" element={<Company />} />
      <Route path="units" element={<Units />} />
      <Route path="categories" element={<Categories />} />
      <Route path="items" element={<Items />} />
      <Route path="suppliers" element={<Suppliers />} />
      <Route path="customers" element={<Customers />} />
      <Route path="settings" element={<Settings />} />
      <Route path="purchases" element={<Purchases />} />
      <Route path="stock" element={<Stock />} />
      <Route path="purchase-register" element={<PurchaseRegister />} />
      <Route path="opening-stock" element={<OpeningStock />} />
      <Route path="opening-balances" element={<OpeningBalances />} />
      <Route path="stock-adjustment" element={<StockAdjustment />} />
      <Route path="formulas" element={<Formulas />} />
      <Route path="production" element={<Production />} />
      <Route path="production/:id/work" element={<ProductionWork />} />
      <Route path="production-register" element={<ProductionRegister />} />
      <Route path="sales" element={<Sales />} />
      <Route path="sales-register" element={<SalesRegister />} />
      <Route path="customer-ledger" element={<CustomerLedger />} />
      <Route path="supplier-ledger" element={<SupplierLedger />} />
      <Route path="investments" element={<Investments />} />
      <Route path="upad" element={<Upad />} />
      <Route path="reports" element={<Reports />} />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );
}

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
  const now = Date.now();
  const fallback = {
    tabs: [{
      id: 1,
      path: safeWorkspacePath(initialPath),
      revision: 0,
      lastUsedAt: now,
      sleeping: false,
      dirty: false,
      scrollY: 0,
    }],
    activeTabId: 1,
    nextTabId: 2,
  };

  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const restored = Array.isArray(parsed?.tabs)
      ? parsed.tabs
          .filter((tab) => Number.isInteger(Number(tab?.id)) && typeof tab?.path === "string")
          .slice(0, 30)
          .map((tab) => ({
            id: Number(tab.id),
            path: safeWorkspacePath(tab.path),
            revision: Number(tab.revision || 0),
            lastUsedAt: Number(tab.lastUsedAt || now),
            sleeping: true,
            dirty: false,
            scrollY: Number(tab.scrollY || 0),
          }))
      : [];

    if (restored.length === 0) return fallback;

    let activeTabId = Number(parsed?.activeTabId);
    if (!restored.some((tab) => tab.id === activeTabId)) {
      activeTabId = restored[0].id;
    }

    /*
     * A full Electron/browser reload cannot preserve arbitrary React component
     * state. Keep the tab list, but restore only the active page immediately.
     * Other restored tabs start asleep and reload only when selected.
     */
    const requestedPath = safeWorkspacePath(initialPath);
    const tabs = restored.map((tab) => ({
      ...tab,
      path: tab.id === activeTabId ? requestedPath : tab.path,
      sleeping: tab.id !== activeTabId,
      dirty: false,
      lastUsedAt: now,
    }));

    const maxId = Math.max(...tabs.map((tab) => tab.id));
    const nextTabId = Math.max(Number(parsed?.nextTabId || 0), maxId + 1);

    return { tabs, activeTabId, nextTabId };
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

  const activeTabIdRef = useRef(initialWorkspace.activeTabId);
  const nextTabIdRef = useRef(initialWorkspace.nextTabId);
  const pendingNavigationRef = useRef(null);
  const scrollRestoreFrameRef = useRef(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];

  const meta = useMemo(() => {
    const activePathname = safeWorkspacePath(activeTab?.path || currentLocationPath).split("?")[0];
    if (activePathname.startsWith("/production/") && activePathname.endsWith("/work")) {
      return ["Production Work", "Record actual manufacturing and complete the batch"];
    }
    return pageMeta[activePathname] || ["Riseora ERP", "Business management workspace"];
  }, [activeTab?.path, currentLocationPath]);

  /*
   * IMPORTANT:
   * BrowserRouter has one global URL, but Riseora has many live workspace tabs.
   * Never let a URL change caused by switching tabs overwrite the OLD active
   * tab's path. pendingNavigationRef binds that URL transition to the intended
   * tab, eliminating the race that was destroying Purchase/Sales form state.
   */
  useEffect(() => {
    const pending = pendingNavigationRef.current;

    if (pending && pending.path === currentLocationPath) {
      pendingNavigationRef.current = null;

      setTabs((current) => current.map((tab) =>
        tab.id === pending.tabId && tab.path !== currentLocationPath
          ? { ...tab, path: currentLocationPath }
          : tab,
      ));

      return;
    }

    /*
     * A child page can still use react-router's navigate()/setSearchParams().
     * Treat those as navigation INSIDE the currently active Riseora tab.
     */
    const targetTabId = activeTabIdRef.current;
    setTabs((current) => current.map((tab) =>
      tab.id === targetTabId && tab.path !== currentLocationPath
        ? {
            ...tab,
            path: currentLocationPath,
            scrollY: 0,
            lastUsedAt: Date.now(),
          }
        : tab,
    ));
  }, [currentLocationPath]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    nextTabIdRef.current = nextTabId;
  }, [nextTabId]);

  /*
   * Persist the tab strip and navigation metadata. Arbitrary React form state
   * deliberately stays in memory while the app is running; it is not written
   * into the business database.
   */
  useEffect(() => {
    try {
      const serializableTabs = tabs.map((tab) => ({
        id: tab.id,
        path: tab.path,
        revision: Number(tab.revision || 0),
        lastUsedAt: Number(tab.lastUsedAt || Date.now()),
        scrollY: Number(tab.scrollY || 0),
      }));

      window.sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ tabs: serializableTabs, activeTabId, nextTabId }),
      );
    } catch {
      // Workspace persistence is a convenience only; navigation must keep working without it.
    }
  }, [tabs, activeTabId, nextTabId]);

  /*
   * Chrome-style memory saver:
   * - untouched/clean inactive tabs can sleep after 30 minutes;
   * - tabs that contain user input are protected and stay mounted;
   * - waking a sleeping tab remounts ONLY that page.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const currentActiveId = activeTabIdRef.current;

      setTabs((current) => {
        let changed = false;

        const next = current.map((tab) => {
          if (
            tab.id === currentActiveId ||
            tab.sleeping ||
            tab.dirty ||
            now - Number(tab.lastUsedAt || now) < TAB_SLEEP_MS
          ) {
            return tab;
          }

          changed = true;
          return { ...tab, sleeping: true };
        });

        return changed ? next : current;
      });
    }, TAB_SLEEP_CHECK_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRestoreFrameRef.current) {
      window.cancelAnimationFrame(scrollRestoreFrameRef.current);
    }

    const top = Math.max(0, Number(activeTab?.scrollY || 0));
    scrollRestoreFrameRef.current = window.requestAnimationFrame(() => {
      window.scrollTo({ top, left: 0, behavior: "auto" });
    });

    return () => {
      if (scrollRestoreFrameRef.current) {
        window.cancelAnimationFrame(scrollRestoreFrameRef.current);
      }
    };
  }, [activeTabId, activeTab?.revision]);

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

  const blurCurrentEditor = () => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) {
      focused.blur();
    }
  };

  const syncBrowserLocation = (tabId, path, { replace = false } = {}) => {
    const targetPath = safeWorkspacePath(path);

    if (targetPath === currentLocationPath) {
      pendingNavigationRef.current = null;
      return;
    }

    pendingNavigationRef.current = { tabId, path: targetPath };
    navigate(targetPath, { replace });
  };

  const markTabDirty = (tabId) => {
    setTabs((current) => current.map((tab) =>
      tab.id === tabId && !tab.dirty
        ? { ...tab, dirty: true }
        : tab,
    ));
  };

  const markTabClean = (tabId) => {
    setTabs((current) => current.map((tab) =>
      tab.id === tabId && tab.dirty
        ? { ...tab, dirty: false }
        : tab,
    ));
  };

  const navigateInActiveTab = (path) => {
    const targetPath = safeWorkspacePath(path);
    const tabId = activeTabIdRef.current;
    const now = Date.now();

    blurCurrentEditor();

    setTabs((current) => current.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            path: targetPath,
            sleeping: false,
            dirty: tab.path === targetPath ? tab.dirty : false,
            lastUsedAt: now,
            scrollY: 0,
          }
        : tab,
    ));

    syncBrowserLocation(tabId, targetPath);
  };

  const openPathInNewTab = (path = "/dashboard") => {
    const targetPath = safeWorkspacePath(path);
    const id = nextTabIdRef.current;
    const previousActiveId = activeTabIdRef.current;
    const now = Date.now();
    const currentScrollY = window.scrollY;

    blurCurrentEditor();

    nextTabIdRef.current = id + 1;
    setNextTabId(id + 1);

    setTabs((current) => [
      ...current.map((tab) =>
        tab.id === previousActiveId
          ? { ...tab, lastUsedAt: now, scrollY: currentScrollY }
          : tab,
      ),
      {
        id,
        path: targetPath,
        revision: 0,
        lastUsedAt: now,
        sleeping: false,
        dirty: false,
        scrollY: 0,
      },
    ]);

    activeTabIdRef.current = id;
    setActiveTabId(id);
    setContextMenu(null);
    syncBrowserLocation(id, targetPath);
  };

  const switchTab = (tab) => {
    const targetId = Number(tab.id);
    const previousActiveId = activeTabIdRef.current;
    const now = Date.now();
    const currentScrollY = window.scrollY;

    if (targetId === previousActiveId) {
      setContextMenu(null);
      return;
    }

    blurCurrentEditor();

    setTabs((current) => current.map((entry) => {
      if (entry.id === previousActiveId) {
        return {
          ...entry,
          lastUsedAt: now,
          scrollY: currentScrollY,
        };
      }

      if (entry.id === targetId) {
        return {
          ...entry,
          sleeping: false,
          lastUsedAt: now,
        };
      }

      return entry;
    }));

    activeTabIdRef.current = targetId;
    setActiveTabId(targetId);
    setContextMenu(null);
    syncBrowserLocation(targetId, tab.path || "/dashboard");
  };

  const closeTab = (event, id) => {
    event.stopPropagation();

    const tabId = Number(id);
    const currentTabs = tabs;

    if (currentTabs.length === 1) {
      const now = Date.now();
      const reset = [{
        ...currentTabs[0],
        path: "/dashboard",
        revision: Number(currentTabs[0].revision || 0) + 1,
        sleeping: false,
        dirty: false,
        lastUsedAt: now,
        scrollY: 0,
      }];

      setTabs(reset);
      activeTabIdRef.current = reset[0].id;
      setActiveTabId(reset[0].id);
      syncBrowserLocation(reset[0].id, "/dashboard");
      return;
    }

    const index = currentTabs.findIndex((tab) => tab.id === tabId);
    const next = currentTabs.filter((tab) => tab.id !== tabId);

    if (tabId !== activeTabIdRef.current) {
      setTabs(next);
      return;
    }

    const replacement = next[Math.max(0, Math.min(index, next.length - 1))];
    const now = Date.now();

    setTabs(next.map((tab) =>
      tab.id === replacement.id
        ? { ...tab, sleeping: false, lastUsedAt: now }
        : tab,
    ));

    activeTabIdRef.current = replacement.id;
    setActiveTabId(replacement.id);
    syncBrowserLocation(replacement.id, replacement.path || "/dashboard");
  };

  const openNewWindow = (path = activeTab?.path || currentLocationPath) => {
    const targetPath = safeWorkspacePath(path);
    const url = `${window.location.origin}${targetPath}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setContextMenu(null);
  };

  const reloadTab = (tabId = activeTabIdRef.current) => {
    const targetId = Number(tabId);
    const target = tabs.find((tab) => tab.id === targetId) || activeTab;
    if (!target) return;

    const previousActiveId = activeTabIdRef.current;
    const now = Date.now();
    const currentScrollY = window.scrollY;

    blurCurrentEditor();

    setTabs((current) => current.map((tab) => {
      if (tab.id === previousActiveId && previousActiveId !== targetId) {
        return { ...tab, lastUsedAt: now, scrollY: currentScrollY };
      }

      if (tab.id === targetId) {
        return {
          ...tab,
          revision: Number(tab.revision || 0) + 1,
          sleeping: false,
          dirty: false,
          lastUsedAt: now,
          scrollY: 0,
        };
      }

      return tab;
    }));

    if (targetId !== previousActiveId) {
      activeTabIdRef.current = targetId;
      setActiveTabId(targetId);
      syncBrowserLocation(targetId, target.path || "/dashboard");
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
          <div><strong>Riseora ERP</strong><small>Version 1.1.1 · Local business system</small></div>
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
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const tabStateTitle = tab.sleeping
              ? "Sleeping — click to reload this tab only"
              : tab.dirty
                ? "Kept awake because this tab contains local changes"
                : "Awake";

            return (
              <button
                type="button"
                key={tab.id}
                data-workspace-path={tab.path}
                data-workspace-tab-id={tab.id}
                data-workspace-title={titleForPath(tab.path)}
                className={`workspace-tab${isActive ? " active" : ""}${tab.sleeping ? " is-sleeping" : ""}${tab.dirty ? " is-dirty" : ""}`}
                onClick={() => switchTab(tab)}
                title={`${titleForPath(tab.path)} · ${tabStateTitle}`}
              >
                <span className="workspace-tab-label">{titleForPath(tab.path)}</span>

                {tab.sleeping ? (
                  <span className="workspace-tab-state workspace-tab-state-sleep" aria-label="Sleeping">Zz</span>
                ) : tab.dirty ? (
                  <span className="workspace-tab-state workspace-tab-state-dirty" aria-label="Local changes">●</span>
                ) : null}

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
            );
          })}
          <button
            type="button"
            className="workspace-tab-add"
            onClick={() => openPathInNewTab("/dashboard")}
            aria-label="New tab"
            title="New tab"
          >
            ＋
          </button>
        </div>

        <main className="content-area" spellCheck="true">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const shouldMount = isActive || !tab.sleeping;

            return (
              <div
                key={tab.id}
                className={`page-transition workspace-page-host ${isActive ? "is-active" : ""}${tab.sleeping ? " is-sleeping" : ""}`}
                aria-hidden={!isActive}
                onInputCapture={() => {
                  if (isActive) markTabDirty(tab.id);
                }}
                onChangeCapture={() => {
                  if (isActive) markTabDirty(tab.id);
                }}
              >
                {shouldMount ? (
                  <WorkspaceTabProvider
                    tabId={tab.id}
                    active={isActive}
                    sleeping={Boolean(tab.sleeping)}
                    dirty={Boolean(tab.dirty)}
                    markDirty={() => markTabDirty(tab.id)}
                    markClean={() => markTabClean(tab.id)}
                    reload={() => reloadTab(tab.id)}
                  >
                    <div
                      key={`${tab.id}:${Number(tab.revision || 0)}`}
                      className="workspace-page-instance"
                    >
                      <WorkspaceRoutes location={tab.path || "/dashboard"} />
                    </div>
                  </WorkspaceTabProvider>
                ) : (
                  <div className="workspace-sleep-placeholder" aria-hidden="true">
                    Sleeping
                  </div>
                )}
              </div>
            );
          })}
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
