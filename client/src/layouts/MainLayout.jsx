import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import riseoraLogo from "../assets/riseora-logo.jpeg";

function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/dashboard" className="brand-link">
          <img src={riseoraLogo} alt="Riseora" className="brand-logo" />
        </NavLink>

        <div className="topbar-user">
          <span>{user?.fullName || user?.username}</span>

          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Dashboard
            </NavLink>

            <div className="sidebar-heading">Masters</div>

            <NavLink
              to="/company"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Company
            </NavLink>

            <NavLink
              to="/units"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Units
            </NavLink>

            <NavLink
              to="/categories"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Item Categories
            </NavLink>

            <NavLink
              to="/items"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Items
            </NavLink>

            <NavLink
              to="/suppliers"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Suppliers
            </NavLink>

            <NavLink
              to="/customers"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Customers
            </NavLink>

            <div className="sidebar-heading">Purchase & Inventory</div>

            <NavLink
              to="/purchases"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Purchases
            </NavLink>

            <NavLink
              to="/stock"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Current Stock
            </NavLink>

            <div className="sidebar-heading">System</div>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Settings
            </NavLink>
          </nav>
        </aside>

        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;