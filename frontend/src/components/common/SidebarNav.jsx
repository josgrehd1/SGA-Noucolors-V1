import React from 'react';
import { Drawer, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  RiseOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  AppstoreOutlined,
  TagsOutlined,
  HomeOutlined
} from '@ant-design/icons';

export const SidebarNav = ({ visible, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <HomeOutlined />,
      label: 'Panel Principal'
    },
    {
      key: 'ventas-group',
      icon: <RiseOutlined />,
      label: 'Ventas',
      children: [
        { key: 'pedidos-venta', label: 'Pedido Venta' },
        { key: 'devoluciones-venta', label: 'Devolución Venta' },
        { key: 'albaranes', label: 'Mis Albaranes' },
        { key: 'inactivos', label: 'Pedidos Inactivos' }
      ]
    },
    {
      key: 'compras-group',
      icon: <ShoppingCartOutlined />,
      label: 'Compras',
      children: [
        { key: 'pedidos-compra', label: 'Pedido Compra' },
        { key: 'devoluciones-compra', label: 'Devolución Compra' }
      ]
    },
    {
      key: 'traslados-group',
      icon: <SwapOutlined />,
      label: 'Traslados',
      children: [
        { key: 'traslado', label: 'Trasladar Stock' },
        { key: 'solicitud-traslado', label: 'Gest. Sol. Traslado' }
      ]
    },
    {
      key: 'operaciones-group',
      icon: <AppstoreOutlined />,
      label: 'Operaciones de Stock',
      children: [
        { key: 'inventario', label: 'Inventario' },
        { key: 'inv-ciego', label: 'Inv. Ciego' }
      ]
    },
    {
      key: 'stock-group',
      icon: <TagsOutlined />,
      label: 'Stock e Impresión',
      children: [
        { key: 'stock', label: 'Consulta Stock' },
        { key: 'etiquetas', label: 'Imprimir Etiquetas' }
      ]
    }
  ];

  const handleMenuClick = ({ key }) => {
    const routeMap = {
      '/dashboard': () => navigate('/dashboard'),
      'pedidos-venta': () => navigate('/docs', { state: { objType: '17' } }),
      'devoluciones-venta': () => navigate('/docs', { state: { objType: '234000031' } }),
      'albaranes': () => navigate('/albaranes'),
      'inactivos': () => navigate('/docs', { state: { objType: '17', verInactivos: true } }),
      'pedidos-compra': () => navigate('/docs', { state: { objType: '22' } }),
      'devoluciones-compra': () => navigate('/docs', { state: { objType: '234000032' } }),
      'traslado': () => navigate('/traslado'),
      'solicitud-traslado': () => navigate('/docs', { state: { objType: '1250000001' } }),
      'inventario': () => navigate('/inventario'),
      'inv-ciego': () => navigate('/inventario', { state: { ciego: true } }),
      'stock': () => navigate('/stock'),
      'etiquetas': () => navigate('/etiquetas')
    };

    if (routeMap[key]) {
      routeMap[key]();
    }
    onClose();
  };

  return (
    <Drawer
      title="SGA NouColors"
      placement="left"
      onClose={onClose}
      open={visible}
      styles={{ body: { padding: 0 } }}
      width={280}
    >
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        defaultOpenKeys={['ventas-group', 'compras-group', 'traslados-group', 'operaciones-group', 'stock-group']}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ height: '100%', borderRight: 0 }}
      />
    </Drawer>
  );
};
