import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, Spin } from 'antd';
import esES from 'antd/locale/es_ES';

import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/common/Navbar';
import { SidebarNav } from './components/common/SidebarNav';
import { PrinterModal } from './components/common/PrinterModal';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StockPage } from './pages/StockPage';
import { InventarioPage } from './pages/InventarioPage';
import { TrasladoPage } from './pages/TrasladoPage';
import { DocumentosPage } from './pages/DocumentosPage';
import { AlbaranesPage } from './pages/AlbaranesPage';
import { EtiquetasPage } from './pages/EtiquetasPage';

import './styles/main.css';

const { Content } = Layout;

// Guard de rutas protegidas
const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Verificando sesión en SAP..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Layout global del sistema (Header visible únicamente cuando hay usuario autenticado)
const MainAppLayout = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {user && (
        <>
          <Navbar
            onToggleSidebar={() => setSidebarOpen(true)}
            onOpenPrinterModal={() => setPrinterModalOpen(true)}
          />

          <SidebarNav
            visible={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <PrinterModal
            open={printerModalOpen}
            onClose={() => setPrinterModalOpen(false)}
          />
        </>
      )}

      <Content style={{ backgroundColor: '#f8f9fa' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />

          <Route
            path="/stock"
            element={
              <RequireAuth>
                <StockPage />
              </RequireAuth>
            }
          />

          <Route
            path="/docs"
            element={
              <RequireAuth>
                <DocumentosPage />
              </RequireAuth>
            }
          />

          <Route
            path="/albaranes"
            element={
              <RequireAuth>
                <AlbaranesPage />
              </RequireAuth>
            }
          />

          <Route
            path="/inventario"
            element={
              <RequireAuth>
                <InventarioPage />
              </RequireAuth>
            }
          />

          <Route
            path="/traslado"
            element={
              <RequireAuth>
                <TrasladoPage />
              </RequireAuth>
            }
          />

          <Route
            path="/etiquetas"
            element={
              <RequireAuth>
                <EtiquetasPage />
              </RequireAuth>
            }
          />

          <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </Content>
    </Layout>
  );
};

export function App() {
  return (
    <ConfigProvider locale={esES}>
      <SocketProvider>
        <AuthProvider>
          <Router>
            <MainAppLayout />
          </Router>
        </AuthProvider>
      </SocketProvider>
    </ConfigProvider>
  );
}

export default App;
