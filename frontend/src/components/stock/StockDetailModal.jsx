import React, { useState, useEffect } from 'react';
import { Modal, Card, Tag, Typography, Descriptions, Row, Col, Space, Spin, Empty, Button } from 'antd';
import {
  EnvironmentOutlined,
  ShopOutlined,
  BulbOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CommentOutlined
} from '@ant-design/icons';
import stockApi from '../../api/stockApi';

const { Title, Text } = Typography;

export const StockDetailModal = ({ open, item, activeTab = 'ubis', onClose }) => {
  const [selectedTab, setSelectedTab] = useState(activeTab);

  const [necesidadesData, setNecesidadesData] = useState([]);
  const [necesidadesLoading, setNecesidadesLoading] = useState(false);

  const [movimientosSummary, setMovimientosSummary] = useState({});
  const [movimientosData, setMovimientosData] = useState([]);
  const [movimientosLoading, setMovimientosLoading] = useState(false);

  // Sincronizar selectedTab cuando cambia la pestaña activa desde fuera
  useEffect(() => {
    if (open) {
      setSelectedTab(activeTab || 'ubis');
    }
  }, [open, activeTab]);

  // Cargar datos dinámicos al cambiar a pestañas de necesidades o movimientos
  useEffect(() => {
    if (open && item && item.ItemCode) {
      if (selectedTab === 'nec' && necesidadesData.length === 0) {
        fetchNecesidades(item.ItemCode);
      } else if (selectedTab === 'mov' && movimientosData.length === 0) {
        fetchMovimientos(item.ItemCode);
      }
    }
  }, [open, item, selectedTab]);

  const fetchNecesidades = async (itemcode) => {
    setNecesidadesLoading(true);
    try {
      const res = await stockApi.getItemNecesidades(itemcode);
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
      width={760}
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

      {/* 4 Tarjetas Selectoras Interactivas (Tipo Carta) */}
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <div
            onClick={() => setSelectedTab('ubis')}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              border: `1.5px solid ${selectedTab === 'ubis' ? '#1677ff' : '#e5e7eb'}`,
              backgroundColor: selectedTab === 'ubis' ? '#e6f4ff' : '#ffffff',
              boxShadow: selectedTab === 'ubis' ? '0 4px 12px rgba(22, 119, 255, 0.15)' : 'none',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <EnvironmentOutlined style={{ fontSize: 18, color: '#1677ff', marginBottom: 2 }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: selectedTab === 'ubis' ? '#1677ff' : '#374151' }}>
              Ubicaciones
            </div>
            <Tag color="blue" style={{ fontSize: '0.65rem', margin: '2px 0 0 0', borderRadius: 4 }}>
              {ubicaciones.length} ubi
            </Tag>
          </div>
        </Col>

        <Col span={6}>
          <div
            onClick={() => setSelectedTab('whs')}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              border: `1.5px solid ${selectedTab === 'whs' ? '#52c41a' : '#e5e7eb'}`,
              backgroundColor: selectedTab === 'whs' ? '#f6ffed' : '#ffffff',
              boxShadow: selectedTab === 'whs' ? '0 4px 12px rgba(82, 196, 26, 0.15)' : 'none',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <ShopOutlined style={{ fontSize: 18, color: '#52c41a', marginBottom: 2 }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: selectedTab === 'whs' ? '#389e0d' : '#374151' }}>
              Almacenes
            </div>
            <Tag color="green" style={{ fontSize: '0.65rem', margin: '2px 0 0 0', borderRadius: 4 }}>
              {warehouseList.length} SAP
            </Tag>
          </div>
        </Col>

        <Col span={6}>
          <div
            onClick={() => setSelectedTab('nec')}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              border: `1.5px solid ${selectedTab === 'nec' ? '#faad14' : '#e5e7eb'}`,
              backgroundColor: selectedTab === 'nec' ? '#fffbe6' : '#ffffff',
              boxShadow: selectedTab === 'nec' ? '0 4px 12px rgba(250, 173, 20, 0.15)' : 'none',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <BulbOutlined style={{ fontSize: 18, color: '#faad14', marginBottom: 2 }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: selectedTab === 'nec' ? '#d48806' : '#374151' }}>
              Necesidades
            </div>
            <Tag color={deficit > 0 ? 'red' : 'gold'} style={{ fontSize: '0.65rem', margin: '2px 0 0 0', borderRadius: 4 }}>
              {deficit > 0 ? `-${deficit}u` : 'ATP'}
            </Tag>
          </div>
        </Col>

        <Col span={6}>
          <div
            onClick={() => setSelectedTab('mov')}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              border: `1.5px solid ${selectedTab === 'mov' ? '#722ed1' : '#e5e7eb'}`,
              backgroundColor: selectedTab === 'mov' ? '#f9f0ff' : '#ffffff',
              boxShadow: selectedTab === 'mov' ? '0 4px 12px rgba(114, 46, 209, 0.15)' : 'none',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <SwapOutlined style={{ fontSize: 18, color: '#722ed1', marginBottom: 2 }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: selectedTab === 'mov' ? '#531dab' : '#374151' }}>
              Movimientos
            </div>
            <Tag color="purple" style={{ fontSize: '0.65rem', margin: '2px 0 0 0', borderRadius: 4 }}>
              {movimientosSummary.total_movimientos || 'Hist'}
            </Tag>
          </div>
        </Col>
      </Row>

      {/* Contenido en Tarjetas Visuales segun la Tarjeta seleccionada */}
      <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
        {selectedTab === 'ubis' && (
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
                        border: '1px solid #e5e7eb',
                        borderLeft: '4px solid #1677ff',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
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
                            <Tag color="green" style={{ borderRadius: 6, fontWeight: 700, fontSize: '0.88rem', padding: '2px 10px' }}>
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

        {selectedTab === 'whs' && (
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
                        border: '1px solid #e5e7eb',
                        borderLeft: '4px solid #52c41a',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
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
                            <Tag color={disp > 0 ? 'green' : 'red'} style={{ borderRadius: 6, fontWeight: 700, fontSize: '0.85rem' }}>
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

        {selectedTab === 'nec' && (
          <div>
            <Card
              styles={{ body: { padding: 12 } }}
              style={{ backgroundColor: '#fffbe6', borderRadius: 10, marginBottom: 12, border: '1px solid #ffe58f' }}
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
                      style={{ borderRadius: 10, border: '1px solid #e5e7eb', borderLeft: '4px solid #faad14' }}
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

        {selectedTab === 'mov' && (
          <div>
            {movimientosSummary.total_movimientos > 0 && (
              <div style={{ marginBottom: 12, backgroundColor: '#f9f0ff', padding: 10, borderRadius: 10, border: '1px solid #d3adf7' }}>
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
                          border: '1px solid #e5e7eb',
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
