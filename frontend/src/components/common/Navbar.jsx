import React from 'react';
import { Row, Col, Button, Dropdown, Space, Switch } from 'antd';
import { PrinterOutlined, UserOutlined, LogoutOutlined, DownOutlined, MenuOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo.png';

const companyNameMap = {
  'NouColors_D': 'COMERCIAL NOUCOLORS S.L.',
  'KLEANTEK_PROD': 'KLEANTEK S.L.',
  'NouColors_D_TEST': 'NOUCOLORS (TEST)'
};

export const Navbar = ({ onToggleSidebar, onOpenPrinterModal }) => {
  const { user, logout, activePrinter, printersList, activePdfPrinter, pdfPrintersList, testPrintEnabled, setTestPrintEnabled } = useAuth();
  const navigate = useNavigate();

  const activeZebraName = printersList.find((p) => p.key === activePrinter || p.ip === activePrinter)?.name || printersList.find((p) => p.key === activePrinter)?.value || 'Zebra: Sin asignar';
  const activePdfName = pdfPrintersList.find((p) => p.key === activePdfPrinter || p.ip === activePdfPrinter)?.name || 'Albaranes: Sin asignar';
  const displayCompanyName = companyNameMap[user?.company_db] || user?.company_db || 'COMERCIAL NOUCOLORS S.L.';

  const isTestDb = Boolean(user?.company_db && (user.company_db.toUpperCase().includes('TEST') || user.company_db === 'NouColors_D_TEST'));

  const ventasMenu = {
    items: [
      { key: 'pedido-venta', label: 'Pedido Venta', onClick: () => navigate('/docs', { state: { objType: '17' } }) },
      { key: 'devolucion-venta', label: 'Devolución Venta', onClick: () => navigate('/docs', { state: { objType: '234000031' } }) },
      { key: 'albaranes', label: 'Mis Albaranes', onClick: () => navigate('/albaranes') },
      { key: 'inactivos', label: 'Pedidos Inactivos', onClick: () => navigate('/docs', { state: { objType: '17', verInactivos: true } }) }
    ]
  };

  const comprasMenu = {
    items: [
      { key: 'pedido-compra', label: 'Pedido Compra', onClick: () => navigate('/docs', { state: { objType: '22' } }) },
      { key: 'devolucion-compra', label: 'Devolución Compra', onClick: () => navigate('/docs', { state: { objType: '234000032' } }) }
    ]
  };

  const trasladosMenu = {
    items: [
      { key: 'trasladar-stock', label: 'Trasladar Stock', onClick: () => navigate('/traslado') },
      { key: 'solicitud-traslado', label: 'Gest. Sol. Traslado', onClick: () => navigate('/docs', { state: { objType: '1250000001' } }) }
    ]
  };

  const stockMenu = {
    items: [
      { key: 'consulta-stock', label: 'Consulta Stock', onClick: () => navigate('/stock') },
      { key: 'imprimir-etiquetas', label: 'Imprimir Etiquetas', onClick: () => navigate('/etiquetas') }
    ]
  };

  const userMenuItems = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '4px 8px' }}>
          <strong>{user?.username}</strong>
          <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Empresa: {displayCompanyName}</div>
        </div>
      )
    },
    ...(isTestDb ? [
      { type: 'divider' },
      {
        key: 'test-print-toggle',
        icon: <PrinterOutlined style={{ color: testPrintEnabled ? '#10b981' : '#64748b' }} />,
        label: (
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '2px 0', minWidth: 190 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: testPrintEnabled ? '#065f46' : '#64748b' }}>
              Impresión (TEST)
            </span>
            <Switch
              size="small"
              checked={testPrintEnabled}
              onChange={(checked) => setTestPrintEnabled(checked)}
              checkedChildren="ON"
              unCheckedChildren="OFF"
              style={{ backgroundColor: testPrintEnabled ? '#10b981' : '#cbd5e1' }}
            />
          </div>
        )
      }
    ] : []),
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesión',
      danger: true,
      onClick: logout
    }
  ];

  return (
    <header className="sga-header-nav">
      <Row justify="space-between" align="middle" style={{ width: '100%', flexWrap: 'nowrap' }}>

        {/* Marca e Identidad NouColors */}
        <Col flex="auto">
          <Space size="small" align="center" style={{ flexWrap: 'nowrap' }}>
            {user && (
              <Button
                type="text"
                icon={<MenuOutlined style={{ color: '#ffffff', fontSize: '1.25rem' }} />}
                onClick={onToggleSidebar}
                className="sga-hamburger-btn"
              />
            )}

            <div
              className="brand-logo-box"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(user ? '/dashboard' : '/login')}
            >
              <img src={logoImg} alt="NouColors Logo" style={{ height: 28, objectFit: 'contain' }} />
            </div>

            <div className="sga-header-brand-text" style={{ paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.2)', lineHeight: 1.2 }}>
              <div className="sga-brand-title">SGA</div>
              <div className="sga-brand-subtitle">
                {displayCompanyName}
              </div>
            </div>

            {/* Menús de Navegación si está autenticado (Desktop) */}
            {user && (
              <div className="sga-desktop-nav" style={{ marginLeft: 16 }}>
                <Dropdown menu={ventasMenu} trigger={['hover']}>
                  <Button type="text" className="sga-nav-dropdown-btn">
                    Ventas <DownOutlined style={{ fontSize: '0.7rem' }} />
                  </Button>
                </Dropdown>

                <Dropdown menu={comprasMenu} trigger={['hover']}>
                  <Button type="text" className="sga-nav-dropdown-btn">
                    Compras <DownOutlined style={{ fontSize: '0.7rem' }} />
                  </Button>
                </Dropdown>

                <Dropdown menu={trasladosMenu} trigger={['hover']}>
                  <Button type="text" className="sga-nav-dropdown-btn">
                    Traslados <DownOutlined style={{ fontSize: '0.7rem' }} />
                  </Button>
                </Dropdown>

                <Button
                  type="text"
                  className="sga-nav-dropdown-btn"
                  onClick={() => navigate('/inventario')}
                >
                  Inventario
                </Button>

                <Dropdown menu={stockMenu} trigger={['hover']}>
                  <Button type="text" className="sga-nav-dropdown-btn">
                    Stock <DownOutlined style={{ fontSize: '0.7rem' }} />
                  </Button>
                </Dropdown>
              </div>
            )}
          </Space>
        </Col>

        {/* Acciones de Usuario e Impresora Activa */}
        {user && (
          <Col>
            <Space size="small" align="center">
              <Button
                type="default"
                icon={<PrinterOutlined />}
                onClick={onOpenPrinterModal}
                className="sga-printer-btn sga-printer-btn-styled"
                title={`🏷️ ${activeZebraName}\n📄 ${activePdfName}`}
              >
                <span className="sga-printer-text">
                  {activePrinter ? activeZebraName.replace('Impresora ', '') : 'Impresoras'}
                </span>
              </Button>

              <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
                <Button
                  type="primary"
                  shape="circle"
                  icon={<UserOutlined />}
                  className="sga-user-avatar-btn"
                />
              </Dropdown>
            </Space>
          </Col>
        )}
      </Row>
    </header>
  );
};
