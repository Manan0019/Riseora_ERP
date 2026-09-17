import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
        <div>
          <strong>Riseora ERP</strong>
        </div>

        <div className="topbar-user">
          <span>
            {user?.fullName || user?.username}
          </span>

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

            <div className="sidebar-heading">
              Masters
            </div>

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