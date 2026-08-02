import React, { useState, useEffect } from 'react';
import { Modal, Card, Tag, Typography, Descriptions, Row, Col, Space, Spin, Empty, Button } from 'antd';
import {
  EnvironmentOutlined,
  ShopOutlined,
  BulbOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CommentOutlined,
  CloseOutlined
} from '@ant-design/icons';
import client from '../../utils/client';

const { Title, Text } = Typography;

export const StockDetailModal = ({ open, item, activeTab = 'ubis', onClose }) => {
  const [necesidadesData, setNecesidadesData] = useState([]);
  const [necesidadesLoading, setNecesidadesLoading] = useState(false);

  const [movimientosSummary, setMovimientosSummary] = useState({});
  const [movimientosData, setMovimientosData] = useState([]);
  const [movimientosLoading, setMovimientosLoading] = useState(false);

  useEffect(() => {
    if (open && item && item.ItemCode) {
      if (activeTab === 'nec' && necesidadesData.length === 0) {
        fetchNecesidades(item.ItemCode);
      } else if (activeTab === 'mov' && movimientosData.length === 0) {
        fetchMovimientos(item.ItemCode);
      }
    }
  }, [open, item, activeTab]);

  const fetchNecesidades = async (itemcode) => {
    setNecesidadesLoading(true);
    try {
      const res = await client.get(`/stock/${encodeURIComponent(itemcode)}/necesidades`);
      if (res.status === 'ok') {
        setNecesidadesData(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching necesidades:', err);
    } finally {
      setNecesidadesLoading(false);
    }
  };

  const fetchMovimientos = async (itemcode) => {
    setMovimientosLoading(true);
    try {
      const res = await client.get(`/stock/${encodeURIComponent(itemcode)}/movimientos`);
      if (res.status === 'ok') {
        setMovimientosSummary(res.summary || {});
        setMovimientosData(res.movements || []);
      }
    } catch (err) {
      console.error('Error fetching movimientos:', err);
    } finally {
      setMovimientosLoading(false);
    }
  };

  if (!item) return null;

  const ubicaciones = item.Ubicaciones || [];
  const warehouseList = item.ItemWarehouseInfoCollection || [];

  const totalStock = item.QuantityOnStock || 0;
  const totalCommitted = item.QuantityOrderedByCustomers || 0;
  const totalOrdered = item.QuantityOrderedFromVendors || 0;
  const atpNeto = totalStock - totalCommitted + totalOrdered;
  const deficit = totalCommitted > (totalStock + totalOrdered) ? (totalCommitted - (totalStock + totalOrdered)) : 0;

  const sectionConfig = {
    ubis: { title: 'Ubicaciones en Estanterías', icon: <EnvironmentOutlined />, color: '#1677ff', bg: '#e6f4ff' },
    whs: { title: 'Desglose por Almacenes SAP', icon: <ShopOutlined />, color: '#52c41a', bg: '#f6ffed' },
    nec: { title: 'Análisis de Necesidades y Compras', icon: <BulbOutlined />, color: '#faad14', bg: '#fffbe6' },
    mov: { title: 'Histórico de Movimientos', icon: <SwapOutlined />, color: '#722ed1', bg: '#f9f0ff' }
  };

  const currentConfig = sectionConfig[activeTab] || sectionConfig.ubis;

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>{item.ItemCode}</Title>
          <Text type="secondary">{item.ItemName}</Text>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="close" type="primary" onClick={onClose} block style={{ borderRadius: 8, height: 40, fontWeight: 700 }}>
          Cerrar
        </Button>
      ]}
    >
      {/* Resumen Superior KPI */}
      <Descriptions bordered size="small" style={{ margin: '12px 0 16px 0' }} column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Grupo de Artículos">{item.ItemsGroupCode || '-'}</Descriptions.Item>
        <Descriptions.Item label="Stock Total SAP">
          <Tag color="green" style={{ fontWeight: 700, fontSize: '0.88rem', borderRadius: 6 }}>
            {totalStock} u.
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Comprometido (Ventas)">{totalCommitted} u.</Descriptions.Item>
        <Descriptions.Item label="En Camino (Compras)">{totalOrdered} u.</Descriptions.Item>
      </Descriptions>

      {/* Encabezado Banner de Sección Específica (Sin menú de pestañas) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: currentConfig.bg,
          border: `1px solid ${currentConfig.color}44`,
          borderRadius: 10,
          padding: '10px 14px',
          marginBottom: 14
        }}
      >
        <span style={{ fontSize: 18, color: currentConfig.color, display: 'flex' }}>
          {currentConfig.icon}
        </span>
        <span style={{ fontWeight: 800, color: '#1f2937', fontSize: '0.92rem' }}>
          {currentConfig.title}
        </span>
      </div>

      {/* Contenido según la Micro-Tarjeta seleccionada */}
      <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
        {activeTab === 'ubis' && (
          <div>
            {ubicaciones.length === 0 ? (
              <Empty description="Sin ubicaciones registradas en estanterías" />
            ) : (
              <Row gutter={[12, 12]}>
                {ubicaciones.map((ubi, idx) => (
                  <Col span={24} key={`${ubi.BinCode}_${ubi.DistNumber}_${idx}`}>
                    <Card
                      styles={{ body: { padding: 14 } }}
                      style={{
                        borderRadius: 10,
                        border: '1px solid #f0f0f0',
                        borderLeft: '4px solid #1677ff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <Row justify="space-between" align="middle" gutter={[8, 8]}>
                        <Col xs={24} sm={14}>
                          <Space direction="vertical" size={2}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937' }}>
                              <EnvironmentOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                              {ubi.BinCode || ubi.Warehouse || ubi.WhsCode}
                            </div>
                            <Text type="secondary" style={{ fontSize: '0.8rem' }}>
                              Almacén: {ubi.WhsCode || ubi.Warehouse || '01'}
                            </Text>
                          </Space>
                        </Col>

                        <Col xs={24} sm={10} style={{ textAlign: 'right' }}>
                          <Space wrap size={[6, 6]} justify="end">
                            {ubi.DistNumber && (
                              <Tag color="gold" style={{ borderRadius: 6, fontSize: '0.8rem' }}>
                                Lote: {ubi.DistNumber}
                              </Tag>
                            )}
                            <Tag color="green" style={{ borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', padding: '2px 8px' }}>
                              {ubi.BINQTY || ubi.SNQTY || 0} u.
                            </Tag>
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </div>
        )}

        {activeTab === 'whs' && (
          <div>
            <Row gutter={[12, 12]}>
              {warehouseList.map((whs) => {
                const disp = (whs.InStock || 0) - (whs.Committed || 0);
                return (
                  <Col span={24} key={whs.WarehouseCode}>
                    <Card
                      styles={{ body: { padding: 14 } }}
                      style={{
                        borderRadius: 10,
                        border: '1px solid #f0f0f0',
                        borderLeft: '4px solid #52c41a',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <Row justify="space-between" align="middle" gutter={[8, 8]}>
                        <Col xs={24} sm={12}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937' }}>
                            <ShopOutlined style={{ marginRight: 6, color: '#52c41a' }} />
                            Almacén #{whs.WarehouseCode}
                          </div>
                        </Col>

                        <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                          <Space wrap size={[6, 6]} justify="end">
                            <Tag color="blue" style={{ borderRadius: 6, fontSize: '0.8rem' }}>
                              Stock: {whs.InStock || 0} u.
                            </Tag>
                            <Tag color="orange" style={{ borderRadius: 6, fontSize: '0.8rem' }}>
                              Comprom: {whs.Committed || 0} u.
                            </Tag>
                            <Tag color={disp > 0 ? 'green' : 'red'} style={{ borderRadius: 6, fontWeight: 700, fontSize: '0.8rem' }}>
                              Disp: {disp} u.
                            </Tag>
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>
        )}

        {activeTab === 'nec' && (
          <div>
            <Card
              styles={{ body: { padding: 12 } }}
              style={{ backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 12, border: '1px solid #e2e8f0' }}
            >
              <Row justify="space-between" align="middle" gutter={[8, 8]}>
                <Col>
                  <Text strong style={{ fontSize: '0.85rem' }}>Estado de Necesidad: </Text>
                  {deficit > 0 ? (
                    <Tag color="red" style={{ fontWeight: 700, borderRadius: 6 }}>🔴 Déficit: {deficit} u.</Tag>
                  ) : totalStock < totalCommitted ? (
                    <Tag color="warning" style={{ fontWeight: 700, borderRadius: 6 }}>🟡 Cubierto por Compras</Tag>
                  ) : (
                    <Tag color="success" style={{ fontWeight: 700, borderRadius: 6 }}>🟢 Sin Necesidad</Tag>
                  )}
                </Col>
                <Col>
                  <Text strong style={{ fontSize: '0.85rem' }}>ATP Neto: </Text>
                  <Tag color={atpNeto >= 0 ? 'blue' : 'red'} style={{ fontWeight: 700, borderRadius: 6 }}>
                    {atpNeto} u.
                  </Tag>
                </Col>
              </Row>
            </Card>

            {necesidadesLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin size="small" tip="Consultando necesidades en SAP..." />
              </div>
            ) : necesidadesData.length === 0 ? (
              <Empty description="No hay llamadas o incidencias de necesidad registradas para este producto" />
            ) : (
              <Row gutter={[12, 12]}>
                {necesidadesData.map((nec, idx) => (
                  <Col span={24} key={idx}>
                    <Card
                      styles={{ body: { padding: 12 } }}
                      style={{ borderRadius: 10, border: '1px solid #f0f0f0', borderLeft: '4px solid #faad14' }}
                    >
                      <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>
                        <BulbOutlined style={{ marginRight: 6, color: '#faad14' }} />
                        Llamada / Solicitud #{nec.LLAMADA || idx + 1}
                      </div>
                      <Text type="secondary" style={{ fontSize: '0.82rem', display: 'block' }}>
                        <CommentOutlined style={{ marginRight: 4 }} />
                        {nec.COMENTARIO || nec.COMMENTS || 'Sin detalles'}
                      </Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </div>
        )}

        {activeTab === 'mov' && (
          <div>
            {movimientosSummary.total_movimientos > 0 && (
              <div style={{ marginBottom: 12, backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <Row justify="space-between" align="middle" gutter={[8, 8]}>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '0.78rem' }}>Última Compra: </Text>
                    <Text strong style={{ fontSize: '0.78rem' }}>{movimientosSummary.ultima_compra}</Text>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '0.78rem' }}>Última Salida: </Text>
                    <Text strong style={{ fontSize: '0.78rem' }}>{movimientosSummary.ultima_salida}</Text>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '0.78rem' }}>Total Movs: </Text>
                    <Tag color="purple" style={{ borderRadius: 6, fontWeight: 700 }}>{movimientosSummary.total_movimientos}</Tag>
                  </Col>
                </Row>
              </div>
            )}

            {movimientosLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin size="small" tip="Cargando historial de movimientos desde SAP..." />
              </div>
            ) : movimientosData.length === 0 ? (
              <Empty description="No hay movimientos registrados para este producto" />
            ) : (
              <Row gutter={[10, 10]}>
                {movimientosData.map((mov, idx) => {
                  const isPositive = mov.cantidad > 0;
                  return (
                    <Col span={24} key={idx}>
                      <Card
                        styles={{ body: { padding: 12 } }}
                        style={{
                          borderRadius: 10,
                          border: '1px solid #f0f0f0',
                          borderLeft: `4px solid ${mov.categoria === 'traslado' ? '#fa8c16' : isPositive ? '#52c41a' : '#ff4d4f'}`
                        }}
                      >
                        <Row justify="space-between" align="middle" gutter={[8, 8]}>
                          <Col xs={24} sm={14}>
                            <Space direction="vertical" size={1}>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1f2937' }}>
                                {mov.tipo}
                              </div>
                              <Text type="secondary" style={{ fontSize: '0.8rem' }}>
                                {mov.origen_destino}
                              </Text>
                              {mov.comentario && mov.comentario !== '-' && (
                                <Text type="secondary" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                                  "{mov.comentario}"
                                </Text>
                              )}
                            </Space>
                          </Col>

                          <Col xs={24} sm={10} style={{ textAlign: 'right' }}>
                            <Space direction="vertical" size={2} align="end">
                              <Tag
                                color={mov.categoria === 'traslado' ? 'orange' : isPositive ? 'success' : 'error'}
                                icon={isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                style={{ borderRadius: 6, fontWeight: 700, fontSize: '0.82rem' }}
                              >
                                {isPositive ? `+${mov.cantidad}` : mov.cantidad} u.
                              </Tag>
                              <Text type="secondary" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                {mov.fecha}
                              </Text>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
