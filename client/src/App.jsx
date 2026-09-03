import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Company from "./pages/Company";
import Units from "./pages/Units";
import Categories from "./pages/Categories";
import Suppliers from "./pages/Suppliers";
import Customers from "./pages/Customers";

import MainLayout from "./layouts/MainLayout";

function App() {
  const user = localStorage.getItem("riseora_user");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            user ? (
              <MainLayout />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route
            index
            element={<Navigate to="/dashboard" replace />}
          />

          <Route
            path="dashboard"
            element={<Dashboard />}
          />

          <Route
            path="company"
            element={<Company />}
          />

          <Route
            path="units"
            element={<Units />}
          />

          <Route
            path="categories"
            element={<Categories />}
          />

          <Route
            path="suppliers"
            element={<Suppliers />}
          />

          <Route
            path="customers"
            element={<Customers />}
          />
        </Route>

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;