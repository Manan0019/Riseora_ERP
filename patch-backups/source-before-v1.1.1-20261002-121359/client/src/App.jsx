import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import SalesInvoicePrint from "./pages/SalesInvoicePrint";
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
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/sales/:id/invoice-print" element={user ? <SalesInvoicePrint /> : <Navigate to="/login" replace />} />
        <Route path="/reports/print" element={user ? <ReportPrint /> : <Navigate to="/login" replace />} />
        <Route path="/*" element={user ? <MainLayout /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
