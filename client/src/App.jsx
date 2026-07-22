import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PosPage from './pages/PosPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import StockPage from './pages/StockPage.jsx';
import ExpiryPage from './pages/ExpiryPage.jsx';
import ReorderPage from './pages/ReorderPage.jsx';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import AuditPage from './pages/AuditPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="pos" element={<PosPage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="catalogo" element={<ProtectedRoute roles={['admin', 'gerente']}><CatalogPage /></ProtectedRoute>} />
        <Route path="stock" element={<StockPage />} />
        <Route path="vencimientos" element={<ExpiryPage />} />
        <Route path="reposicion" element={<ProtectedRoute roles={['admin', 'gerente']}><ReorderPage /></ProtectedRoute>} />
        <Route path="ordenes-compra" element={<ProtectedRoute roles={['admin', 'gerente']}><PurchaseOrdersPage /></ProtectedRoute>} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="reportes" element={<ProtectedRoute roles={['admin', 'gerente']}><ReportsPage /></ProtectedRoute>} />
        <Route path="configuracion" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
        <Route path="usuarios" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="auditoria" element={<ProtectedRoute roles={['admin', 'gerente']}><AuditPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}
