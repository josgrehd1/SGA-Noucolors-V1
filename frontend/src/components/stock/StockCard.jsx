import React from 'react';
import { Card, Tag, Button, Space, Typography, Tooltip, Row, Col } from 'antd';
import {
  PrinterOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  BulbOutlined,
  SwapOutlined,
  EditOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

export const StockCard = ({ item, onOpenDetail, onOpenPrint }) => {
  const stock = item.QuantityOnStock || 0;
  const isAvailable = stock > 0;
  const ubicaciones = item.Ubicaciones || [];

  return (
    <Card className="sga-product-card" styles={{ body: { padding: 14 } }}>
      <div>
        {/* Encabezado: Código + Grupo + Botón Imprimir + Tag Stock */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="sga-item-code-badge">
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
        <Title level={5} className="sga-product-title" ellipsis={{ rows: 2 }}>
          {item.ItemName}
        </Title>

        {item.ItemsGroupCode && (
          <Tag color="blue" style={{ borderRadius: 6, fontSize: '0.72rem', marginBottom: 8, fontWeight: 600 }}>
            {item.ItemsGroupCode}
          </Tag>
        )}

        {/* Vista previa rápida de ubicaciones */}
        <div className="sga-location-preview-box">
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

      {/* 5 Tarjetas de Acción Rápidas (Micro-Cards) */}
      <div style={{ paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
        <Row gutter={[6, 6]}>
          <Col span={12}>
            <div
              className="action-card-btn sga-action-microcard"
              onClick={() => onOpenDetail(item, 'ubis')}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: '#f1f5f9',
                  color: '#0d6efd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0
                }}
              >
                <EnvironmentOutlined />
              </div>
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>Ubicaciones</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Estanterías</div>
              </div>
            </div>
          </Col>

          <Col span={12}>
            <div
              className="action-card-btn sga-action-microcard"
              onClick={() => onOpenDetail(item, 'whs')}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: '#f1f5f9',
                  color: '#0d6efd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0
                }}
              >
                <ShopOutlined />
              </div>
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>Almacenes</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Stock SAP</div>
              </div>
            </div>
          </Col>

          <Col span={12}>
            <div
              className="action-card-btn sga-action-microcard"
              onClick={() => onOpenDetail(item, 'default_bin')}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0
                }}
              >
                <EditOutlined />
              </div>
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>Ubi Defecto</div>
                <div style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 600 }}>Predeterminada</div>
              </div>
            </div>
          </Col>

          <Col span={12}>
            <div
              className="action-card-btn sga-action-microcard"
              onClick={() => onOpenDetail(item, 'nec')}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: '#f1f5f9',
                  color: '#0d6efd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0
                }}
              >
                <BulbOutlined />
              </div>
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>Necesidades</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>ATP & Compras</div>
              </div>
            </div>
          </Col>

          <Col span={24}>
            <div
              className="action-card-btn sga-action-microcard"
              onClick={() => onOpenDetail(item, 'mov')}
              style={{ justifyContent: 'center' }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: '#f1f5f9',
                  color: '#0d6efd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0
                }}
              >
                <SwapOutlined />
              </div>
              <div style={{ lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginRight: 6 }}>Movimientos</span>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>(Historial de entradas y salidas)</span>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </Card>
  );
};

export default StockCard;
