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
import OpeningStock from "./pages/OpeningStock";
import OpeningBalances from "./pages/OpeningBalances";
import StockAdjustment from "./pages/StockAdjustment";
import Formulas from "./pages/Formulas";
import Production from "./pages/Production";
import ProductionRegister from "./pages/ProductionRegister";
import ProductionWork from "./pages/ProductionWork";
import Sales from "./pages/Sales";
import SalesRegister from "./pages/SalesRegister";
import SalesInvoicePrint from "./pages/SalesInvoicePrint";
import CustomerLedger from "./pages/CustomerLedger";
import SupplierLedger from "./pages/SupplierLedger";
import Reports from "./pages/Reports";
import ReportPrint from "./pages/ReportPrint";

import MainLayout from "./layouts/MainLayout";

import { useAuth } from "./context/AuthContext";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-boot-screen">
        <div className="app-boot-mark">R</div>
        <div className="app-boot-title">Riseora ERP</div>
        <div className="app-boot-subtitle">Preparing your workspace...</div>
        <div className="app-boot-loader"><span /></div>
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
          path="/sales/:id/invoice-print"
          element={user ? <SalesInvoicePrint /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/reports/print"
          element={user ? <ReportPrint /> : <Navigate to="/login" replace />}
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

          <Route path="reports" element={<Reports />} />

          <Route path="*" element={<Navigate to="/" replace />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
