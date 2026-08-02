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
      styles={{ body: { padding: 16 } }}
      style={{
        borderRadius: 14,
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <div>
        {/* Encabezado: Código + Grupo + Botón Imprimir + Tag Stock */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text type="primary" style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'monospace' }}>
            {item.ItemCode}
          </Text>

          <Space size={6}>
            <Tag color={isAvailable ? 'green' : 'red'} style={{ fontWeight: 700, borderRadius: 6, margin: 0, padding: '2px 8px' }}>
              Stock: {stock} u.
            </Tag>
            <Tooltip title="Imprimir Etiqueta ZPL">
              <Button
                type="text"
                size="small"
                icon={<PrinterOutlined style={{ color: '#1677ff', fontSize: 16 }} />}
                onClick={() => onOpenPrint(item)}
              />
            </Tooltip>
          </Space>
        </div>

        {/* Nombre del Artículo */}
        <Title
          level={5}
          style={{ marginTop: 2, marginBottom: 8, minHeight: 40, color: '#1f2937', fontSize: '0.95rem' }}
          ellipsis={{ rows: 2 }}
        >
          {item.ItemName}
        </Title>

        {item.ItemsGroupCode && (
          <Tag color="blue" style={{ borderRadius: 6, fontSize: '0.75rem', marginBottom: 10 }}>
            {item.ItemsGroupCode}
          </Tag>
        )}

        {/* Vista previa rápida de ubicaciones */}
        <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 8, marginBottom: 12, border: '1px solid #e2e8f0' }}>
          <Space size={4} wrap align="center">
            <EnvironmentOutlined style={{ color: '#1890ff', fontSize: '0.85rem' }} />
            <Text style={{ fontSize: '0.78rem', fontWeight: 600 }}>Ubicaciones:</Text>
            {ubicaciones.length > 0 ? (
              ubicaciones.slice(0, 2).map((u, idx) => (
                <Tag key={idx} color="cyan" style={{ fontSize: '0.72rem', padding: '0 6px', margin: 0, borderRadius: 4 }}>
                  {u.BinCode || u.WhsCode} ({u.BINQTY || u.SNQTY || 0}u)
                </Tag>
              ))
            ) : (
              <Text type="secondary" style={{ fontSize: '0.75rem' }}>Sin estantería asignada</Text>
            )}
            {ubicaciones.length > 2 && (
              <Tag color="default" style={{ fontSize: '0.72rem', padding: '0 4px', margin: 0, borderRadius: 4 }}>
                +{ubicaciones.length - 2}
              </Tag>
            )}
          </Space>
        </div>
      </div>

      {/* 4 Tarjetas de Acción Rápidas (Micro-Cards) */}
      <div style={{ paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        <Row gutter={[8, 8]}>
          <Col span={12}>
            <div
              className="action-card-btn"
              onClick={() => onOpenDetail(item, 'ubis')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid #e6f4ff',
                backgroundColor: '#f0f5ff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: '#1677ff',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  flexShrink: 0
                }}
              >
                <EnvironmentOutlined />
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1677ff' }}>Ubicaciones</div>
                <div style={{ fontSize: '0.68rem', color: '#69b1ff' }}>Estanterías</div>
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
                gap: 8,
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid #f6ffed',
                backgroundColor: '#f6ffed',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: '#52c41a',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  flexShrink: 0
                }}
              >
                <ShopOutlined />
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#389e0d' }}>Almacenes</div>
                <div style={{ fontSize: '0.68rem', color: '#73d13d' }}>Stock SAP</div>
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
                gap: 8,
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid #fffbe6',
                backgroundColor: '#fffbe6',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: '#faad14',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  flexShrink: 0
                }}
              >
                <BulbOutlined />
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d48806' }}>Necesidades</div>
                <div style={{ fontSize: '0.68rem', color: '#ffc53d' }}>ATP & Compras</div>
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
                gap: 8,
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid #f9f0ff',
                backgroundColor: '#f9f0ff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: '#722ed1',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  flexShrink: 0
                }}
              >
                <SwapOutlined />
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#531dab' }}>Movimientos</div>
                <div style={{ fontSize: '0.68rem', color: '#9254de' }}>Historial</div>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </Card>
  );
};
