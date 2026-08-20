import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography } from 'antd';
import {
  RiseOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  AppstoreOutlined,
  TagsOutlined,
  FileTextOutlined,
  RollbackOutlined,
  InboxOutlined,
  ImportOutlined,
  SendOutlined,
  UnorderedListOutlined,
  EyeInvisibleOutlined,
  SearchOutlined,
  PrinterOutlined,
  SolutionOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

/* ── Definición del menú en datos (misma estructura que main.jinja2) ── */
const menuGroups = [
  {
    title: 'Ventas',
    icon: <RiseOutlined />,
    color: '#1677ff',
    bgLight: '#e6f4ff',
    items: [
      { label: 'Albarán', icon: <FileTextOutlined />, color: '#1677ff', bgLight: '#e6f4ff', path: '/docs', state: { objType: '17' } },
      { label: 'Devolución', icon: <RollbackOutlined />, color: '#ff4d4f', bgLight: '#fff1f0', path: '/docs', state: { objType: '234000031' } },
    ],
  },
  {
    title: 'Compras',
    icon: <ShoppingCartOutlined />,
    color: '#52c41a',
    bgLight: '#f6ffed',
    items: [
      { label: 'Entrada', icon: <InboxOutlined />, color: '#52c41a', bgLight: '#f6ffed', path: '/docs', state: { objType: '22' } },
      { label: 'Devolución', icon: <ImportOutlined />, color: '#faad14', bgLight: '#fffbe6', path: '/docs', state: { objType: '234000032' } },
    ],
  },
  {
    title: 'Traslados',
    icon: <SwapOutlined />,
    color: '#13c2c2',
    bgLight: '#e6fffb',
    items: [
      { label: 'Traslado', icon: <SendOutlined />, color: '#13c2c2', bgLight: '#e6fffb', path: '/traslado' },
      { label: 'Sol. Traslado', icon: <SolutionOutlined />, color: '#8c8c8c', bgLight: '#fafafa', path: '/docs', state: { objType: '1250000001' } },
    ],
  },
  {
    title: 'Inventario',
    icon: <AppstoreOutlined />,
    color: '#262626',
    bgLight: '#f5f5f5',
    items: [
      { label: 'Inventario', icon: <UnorderedListOutlined />, color: '#262626', bgLight: '#f5f5f5', path: '/inventario' },
    ],
  },
  {
    title: 'Stock e Impresión',
    icon: <TagsOutlined />,
    color: '#8c8c8c',
    bgLight: '#fafafa',
    items: [
      { label: 'Consulta', icon: <SearchOutlined />, color: '#1677ff', bgLight: '#e6f4ff', path: '/stock' },
      { label: 'Etiquetas', icon: <PrinterOutlined />, color: '#8c8c8c', bgLight: '#fafafa', path: '/etiquetas' },
    ],
  },
];

/* ── Botón individual del dashboard ── */
const DashboardButton = ({ label, icon, color, bgLight, onClick }) => (
  <div
    className="dashboard-btn"
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 115,
      padding: '16px 12px',
      borderRadius: 12,
      border: '1px solid #f0f0f0',
      backgroundColor: '#fff',
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* Indicador superior de color */}
    <div
      className="active-indicator"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 4,
        backgroundColor: color,
        opacity: 0,
        transition: 'opacity 0.2s ease',
      }}
    />
    {/* Icono circular */}
    <div
      style={{
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        backgroundColor: bgLight,
        color: color,
        fontSize: 22,
        marginBottom: 8,
        transition: 'transform 0.2s ease',
      }}
    >
      {icon}
    </div>
    <span style={{ fontWeight: 600, color: '#434343', fontSize: '0.9rem', textAlign: 'center' }}>{label}</span>
  </div>
);

/* ── Grupo de tarjetas ── */
const DashboardGroup = ({ title, icon, color, bgLight, items, navigate }) => (
  <Col xs={24} md={12} lg={8}>
    <Card
      styles={{ body: { padding: 12 } }}
      style={{
        borderRadius: 16,
        border: 'none',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        height: '100%',
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: 8,
              backgroundColor: bgLight,
              color: color,
              borderRadius: 10,
              display: 'inline-flex',
              fontSize: 18,
            }}
          >
            {icon}
          </span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#262626' }}>{title}</span>
        </div>
      }
    >
      <Row gutter={[8, 8]}>
        {items.map((item) => (
          <Col span={12} key={item.label}>
            <DashboardButton
              label={item.label}
              icon={item.icon}
              color={item.color}
              bgLight={item.bgLight}
              onClick={() => navigate(item.path, { state: item.state || {} })}
            />
          </Col>
        ))}
      </Row>
    </Card>
  </Col>
);

/* ── Página Dashboard ── */
export const DashboardPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <Text type="secondary" strong style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.05em' }}>
          NouColors - Gestión de Almacén
        </Text>
        <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
          Panel Principal
        </Title>
      </div>

      <Row gutter={[16, 16]}>
        {menuGroups.map((group) => (
          <DashboardGroup key={group.title} {...group} navigate={navigate} />
        ))}
      </Row>
    </div>
  );
};
