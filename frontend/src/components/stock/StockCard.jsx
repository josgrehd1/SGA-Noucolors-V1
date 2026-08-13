import React from 'react';
import { Card, Tag, Button, Space, Typography, Tooltip, Row, Col } from 'antd';
import {
  PrinterOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  BulbOutlined,
  SwapOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

export const StockCard = ({ item, onOpenDetail, onOpenPrint }) => {
  const stock = item.QuantityOnStock || 0;
  const isAvailable = stock > 0;
  const ubicaciones = item.Ubicaciones || [];

  return (
    <Card
      className="sga-product-card"
      styles={{ body: { padding: 14 } }}
      style={{
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff'
      }}
    >
      <div>
        {/* Encabezado: Código + Grupo + Botón Imprimir + Tag Stock */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              fontFamily: 'monospace',
              color: '#1e293b',
              backgroundColor: '#f1f5f9',
              padding: '2px 8px',
              borderRadius: 6
            }}
          >
            {item.ItemCode}
          </span>

          <Space size={4}>
            <Tag color={isAvailable ? 'green' : 'red'} style={{ fontWeight: 800, borderRadius: 6, margin: 0, padding: '1px 8px', fontSize: '0.78rem' }}>
              Stock: {stock} u.
            </Tag>
            <Tooltip title="Imprimir Etiqueta ZPL">
              <Button
                type="text"
                size="small"
                icon={<PrinterOutlined style={{ color: '#3b82f6', fontSize: 15 }} />}
                onClick={() => onOpenPrint(item)}
              />
            </Tooltip>
          </Space>
        </div>

        {/* Nombre del Artículo */}
        <Title
          level={5}
          style={{ marginTop: 4, marginBottom: 6, minHeight: 38, color: '#0f172a', fontSize: '0.9rem', lineHeight: 1.35 }}
          ellipsis={{ rows: 2 }}
        >
          {item.ItemName}
        </Title>

        {item.ItemsGroupCode && (
          <Tag color="blue" style={{ borderRadius: 6, fontSize: '0.72rem', marginBottom: 8, fontWeight: 600 }}>
            {item.ItemsGroupCode}
          </Tag>
        )}

        {/* Vista previa rápida de ubicaciones */}
        <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: 8, marginBottom: 10, border: '1px solid #f1f5f9' }}>
          <Space size={4} wrap align="center">
            <EnvironmentOutlined style={{ color: '#3b82f6', fontSize: '0.8rem' }} />
            <Text style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Ubis:</Text>
            {ubicaciones.length > 0 ? (
              ubicaciones.slice(0, 2).map((u, idx) => (
                <Tag key={idx} color="cyan" style={{ fontSize: '0.7rem', padding: '0 5px', margin: 0, borderRadius: 4, fontWeight: 600 }}>
                  {u.BinCode || u.WhsCode} ({u.BINQTY || u.SNQTY || 0}u)
                </Tag>
              ))
            ) : (
              <Text type="secondary" style={{ fontSize: '0.72rem' }}>Sin asignación</Text>
            )}
            {ubicaciones.length > 2 && (
              <Tag color="default" style={{ fontSize: '0.7rem', padding: '0 4px', margin: 0, borderRadius: 4 }}>
                +{ubicaciones.length - 2}
              </Tag>
            )}
          </Space>
        </div>
      </div>

      {/* 4 Tarjetas de Acción Rápidas (Micro-Cards) */}
      <div style={{ paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
        <Row gutter={[6, 6]}>
          <Col span={12}>
            <div
              className="action-card-btn"
              onClick={() => onOpenDetail(item, 'ubis')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #dbeafe',
                backgroundColor: '#eff6ff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0
                }}
              >
                <EnvironmentOutlined />
              </div>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af' }}>Ubicaciones</div>
                <div style={{ fontSize: '0.65rem', color: '#3b82f6' }}>Estanterías</div>
              </div>
            </div>
          </Col>

          <Col span={12}>
            <div
              className="action-card-btn"
              onClick={() => onOpenDetail(item, 'whs')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #d1fae5',
                backgroundColor: '#ecfdf5',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: '#10b981',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0
                }}
              >
                <ShopOutlined />
              </div>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#065f46' }}>Almacenes</div>
                <div style={{ fontSize: '0.65rem', color: '#10b981' }}>Stock SAP</div>
              </div>
            </div>
          </Col>

          <Col span={12}>
            <div
              className="action-card-btn"
              onClick={() => onOpenDetail(item, 'nec')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #fef3c7',
                backgroundColor: '#fffbeb',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: '#f59e0b',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0
                }}
              >
                <BulbOutlined />
              </div>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400e' }}>Necesidades</div>
                <div style={{ fontSize: '0.65rem', color: '#d97706' }}>ATP & Compras</div>
              </div>
            </div>
          </Col>

          <Col span={12}>
            <div
              className="action-card-btn"
              onClick={() => onOpenDetail(item, 'mov')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #f3e8ff',
                backgroundColor: '#faf5ff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: '#8b5cf6',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0
                }}
              >
                <SwapOutlined />
              </div>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#5b21b6' }}>Movimientos</div>
                <div style={{ fontSize: '0.65rem', color: '#8b5cf6' }}>Historial</div>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </Card>
  );
};

export default StockCard;
