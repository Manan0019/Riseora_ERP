import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Company from "./pages/Company";
import Units from "./pages/Units";
import Categories from "./pages/Categories";
import Items from "./pages/Items";
import Suppliers from "./pages/Suppliers";
import Customers from "./pages/Customers";
import Settings from "./pages/Settings";
import Purchases from "./pages/Purchases";
import Stock from "./pages/Stock";
import PurchaseRegister from "./pages/PurchaseRegister";

import MainLayout from "./layouts/MainLayout";

import { useAuth } from "./context/AuthContext";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div>Loading Riseora ERP...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <Login />}
        />

        <Route
          path="/"
          element={user ? <MainLayout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
