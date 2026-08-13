import React, { useState, useEffect } from 'react';
import { Modal, Card, Tag, Typography, Row, Col, Space, Spin, Empty, Button } from 'antd';
import {
  EnvironmentOutlined,
  ShopOutlined,
  BulbOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CommentOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  BoxPlotOutlined
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
        setNecesidadesData(res.calls || res.data || []);
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
      const res = await stockApi.getItemMovimientos(itemcode);
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

  const tabsConfig = [
    { key: 'ubis', label: 'Ubicaciones', icon: <EnvironmentOutlined />, count: `${ubicaciones.length} ubi`, color: '#3b82f6' },
    { key: 'whs', label: 'Almacenes', icon: <ShopOutlined />, count: `${warehouseList.length} SAP`, color: '#10b981' },
    { key: 'nec', label: 'Necesidades', icon: <BulbOutlined />, count: deficit > 0 ? `-${deficit}u` : 'ATP', color: '#f59e0b' },
    { key: 'mov', label: 'Movimientos', icon: <SwapOutlined />, count: movimientosSummary.total_movimientos || 'Hist', color: '#8b5cf6' }
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={780}
      style={{ top: 20 }}
      styles={{ body: { padding: '16px 24px 24px 24px' } }}
      title={null}
      footer={[
        <Button
          key="close"
          type="primary"
          onClick={onClose}
          block
          style={{
            borderRadius: 10,
            height: 42,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: 'none'
          }}
        >
          Cerrar Detalle
        </Button>
      ]}
    >
      {/* 1. Header Banner Premium estilo Dark Slate */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 12,
          padding: '16px 20px',
          color: '#ffffff',
          marginBottom: 16,
          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.15)'
        }}
      >
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col xs={24} sm={16}>
            <Space size={8} wrap style={{ marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  padding: '2px 10px',
                  borderRadius: 6
                }}
              >
                {item.ItemCode}
              </span>
              {item.ItemsGroupCode && (
                <Tag color="blue" style={{ borderRadius: 6, margin: 0, fontWeight: 600 }}>
                  {item.ItemsGroupCode}
                </Tag>
              )}
            </Space>
            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.3 }}>
              {item.ItemName}
            </div>
          </Col>

          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
              Stock Físico SAP
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
              {totalStock} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>u.</span>
            </div>
          </Col>
        </Row>
      </div>

      {/* 2. Bloque Resumen 4 KPIs */}
      <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block' }}>Stock Físico</Text>
            <Text strong style={{ fontSize: '0.95rem', color: '#166534', fontFamily: 'monospace' }}>{totalStock} u.</Text>
          </div>
        </Col>

        <Col span={6}>
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block' }}>Comprometido</Text>
            <Text strong style={{ fontSize: '0.95rem', color: '#1e40af', fontFamily: 'monospace' }}>{totalCommitted} u.</Text>
          </div>
        </Col>

        <Col span={6}>
          <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block' }}>En Camino</Text>
            <Text strong style={{ fontSize: '0.95rem', color: '#6b21a8', fontFamily: 'monospace' }}>{totalOrdered} u.</Text>
          </div>
        </Col>

        <Col span={6}>
          <div style={{ backgroundColor: atpNeto >= 0 ? '#f0f9ff' : '#fef2f2', border: `1px solid ${atpNeto >= 0 ? '#bae6fd' : '#fecaca'}`, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block' }}>ATP Neto</Text>
            <Text strong style={{ fontSize: '0.95rem', color: atpNeto >= 0 ? '#0369a1' : '#991b1b', fontFamily: 'monospace' }}>{atpNeto} u.</Text>
          </div>
        </Col>
      </Row>

      {/* 3. Selector de Pestañas Interactivo estilo Segmented Pill */}
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        {tabsConfig.map((tab) => {
          const isActive = selectedTab === tab.key;
          return (
            <Col span={6} key={tab.key}>
              <div
                onClick={() => setSelectedTab(tab.key)}
                style={{
                  padding: '8px 6px',
                  borderRadius: 10,
                  border: `1.5px solid ${isActive ? tab.color : '#e2e8f0'}`,
                  backgroundColor: isActive ? '#ffffff' : '#f8fafc',
                  boxShadow: isActive ? `0 4px 12px ${tab.color}20` : 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: 16, color: isActive ? tab.color : '#64748b', marginBottom: 2 }}>
                  {tab.icon}
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: isActive ? 800 : 600, color: isActive ? '#1e293b' : '#64748b' }}>
                  {tab.label}
                </div>
                <Tag color={isActive ? 'blue' : 'default'} style={{ fontSize: '0.65rem', margin: '2px 0 0 0', borderRadius: 4, padding: '0 4px' }}>
                  {tab.count}
                </Tag>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* 4. Contenedor Dinámico con Scroll */}
      <div style={{ maxHeight: '48vh', overflowY: 'auto', paddingRight: 4 }}>
        {/* Pestaña: Ubicaciones */}
        {selectedTab === 'ubis' && (
          <div>
            {ubicaciones.length === 0 ? (
              <Empty description="Sin estanterías o ubicaciones asignadas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Row gutter={[10, 10]}>
                {ubicaciones.map((ubi, idx) => (
                  <Col span={24} key={`${ubi.BinCode}_${ubi.DistNumber}_${idx}`}>
                    <Card
                      styles={{ body: { padding: 12 } }}
                      style={{
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        borderLeft: '4px solid #3b82f6',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      <Row justify="space-between" align="middle" gutter={[8, 8]}>
                        <Col xs={24} sm={14}>
                          <Space direction="vertical" size={2}>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', fontFamily: 'monospace' }}>
                              <EnvironmentOutlined style={{ marginRight: 6, color: '#3b82f6' }} />
                              {ubi.BinCode || ubi.Warehouse || ubi.WhsCode}
                            </div>
                            <Text type="secondary" style={{ fontSize: '0.78rem' }}>
                              Almacén SAP: <strong>#{ubi.WhsCode || ubi.Warehouse || '01'}</strong>
                            </Text>
                          </Space>
                        </Col>

                        <Col xs={24} sm={10} style={{ textAlign: 'right' }}>
                          <Space wrap size={[6, 6]} justify="end">
                            {ubi.DistNumber && (
                              <Tag color="gold" style={{ borderRadius: 6, fontSize: '0.78rem', fontWeight: 600 }}>
                                Lote: {ubi.DistNumber}
                              </Tag>
                            )}
                            <Tag color="green" style={{ borderRadius: 6, fontWeight: 800, fontSize: '0.85rem', padding: '2px 8px' }}>
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

        {/* Pestaña: Almacenes */}
        {selectedTab === 'whs' && (
          <div>
            <Row gutter={[10, 10]}>
              {warehouseList.map((whs) => {
                const disp = (whs.InStock || 0) - (whs.Committed || 0);
                return (
                  <Col span={24} key={whs.WarehouseCode}>
                    <Card
                      styles={{ body: { padding: 12 } }}
                      style={{
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        borderLeft: '4px solid #10b981',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      <Row justify="space-between" align="middle" gutter={[8, 8]}>
                        <Col xs={24} sm={10}>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                            <ShopOutlined style={{ marginRight: 6, color: '#10b981' }} />
                            Almacén #{whs.WarehouseCode}
                          </div>
                        </Col>

                        <Col xs={24} sm={14} style={{ textAlign: 'right' }}>
                          <Space wrap size={[6, 6]} justify="end">
                            <Tag color="blue" style={{ borderRadius: 6, fontSize: '0.78rem' }}>
                              Stock: {whs.InStock || 0} u.
                            </Tag>
                            <Tag color="orange" style={{ borderRadius: 6, fontSize: '0.78rem' }}>
                              Comprom: {whs.Committed || 0} u.
                            </Tag>
                            <Tag color={disp > 0 ? 'green' : 'red'} style={{ borderRadius: 6, fontWeight: 700, fontSize: '0.82rem' }}>
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

        {/* Pestaña: Necesidades */}
        {selectedTab === 'nec' && (
          <div>
            {/* Banner resumen de necesidad */}
            <div
              style={{
                backgroundColor: deficit > 0 ? '#fef2f2' : totalStock < totalCommitted ? '#fffbe6' : '#f0fdf4',
                border: `1px solid ${deficit > 0 ? '#fecaca' : totalStock < totalCommitted ? '#ffe58f' : '#bbf7d0'}`,
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 12
              }}
            >
              <Row justify="space-between" align="middle" gutter={[8, 8]}>
                <Col>
                  <Space size={6}>
                    {deficit > 0 ? (
                      <ExclamationCircleOutlined style={{ color: '#ef4444', fontSize: 16 }} />
                    ) : totalStock < totalCommitted ? (
                      <WarningOutlined style={{ color: '#d97706', fontSize: 16 }} />
                    ) : (
                      <CheckCircleOutlined style={{ color: '#10b981', fontSize: 16 }} />
                    )}
                    <Text strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                      Estado de Necesidad:
                    </Text>
                    {deficit > 0 ? (
                      <Tag color="red" style={{ fontWeight: 800, borderRadius: 6 }}>Déficit: {deficit} u.</Tag>
                    ) : totalStock < totalCommitted ? (
                      <Tag color="warning" style={{ fontWeight: 800, borderRadius: 6 }}>Cubierto por Compras</Tag>
                    ) : (
                      <Tag color="success" style={{ fontWeight: 800, borderRadius: 6 }}>Sin Necesidad Activa</Tag>
                    )}
                  </Space>
                </Col>

                <Col>
                  <Text style={{ fontSize: '0.82rem', color: '#64748b' }}>ATP Neto: </Text>
                  <strong style={{ fontSize: '0.88rem', color: atpNeto >= 0 ? '#0284c7' : '#dc2626', fontFamily: 'monospace' }}>
                    {atpNeto} u.
                  </strong>
                </Col>
              </Row>
            </div>

            {necesidadesLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin size="small" tip="Cargando solicitudes y necesidades..." />
              </div>
            ) : necesidadesData.length === 0 ? (
              <Empty description="No hay llamadas ni solicitudes abiertas registradas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Row gutter={[10, 10]}>
                {necesidadesData.map((nec, idx) => {
                  const isTraslado = nec.OBJTYPE === '1250000001' || nec.TIPO === 'Solicitud de Traslado';
                  const isVenta = nec.OBJTYPE === '17' || nec.TIPO === 'Pedido de Venta';
                  const isLlamada = (nec.LLAMADA && parseInt(nec.LLAMADA) > 0) || nec.TIPO === 'Llamada' || nec.OBJTYPE === 'LLAMADA' || nec.OBJTYPE === '191';
                  
                  const borderCol = isTraslado ? '#f97316' : isVenta ? '#3b82f6' : isLlamada ? '#f59e0b' : '#64748b';
                  const tagColor = isTraslado ? 'orange' : isVenta ? 'blue' : isLlamada ? 'gold' : 'default';

                  const docNum = nec.DOCNUM || nec.DocNum || nec.DOCENTRY || nec.LLAMADA || (idx + 1);
                  const cliente = nec.CARDNAME || nec.CardName || (isTraslado ? (nec.FROM_WHS && nec.TO_WHS ? `Traslado Alm. ${nec.FROM_WHS} ➔ Alm. ${nec.TO_WHS}` : 'Traslado Alm. 01 ➔ Alm. 13') : '');
                  const observaciones = nec.COMENTARIO || nec.Comments || nec.COMENTARIO_LLAMADA || '';
                  const tipoTexto = nec.TIPO || (isTraslado ? 'Solicitud de Traslado' : isVenta ? 'Pedido de Venta' : isLlamada ? 'Llamada' : 'Reserva Stock');

                  return (
                    <Col span={24} key={idx}>
                      <Card
                        styles={{ body: { padding: 12 } }}
                        style={{
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          borderLeft: `4px solid ${borderCol}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                      >
                        {/* Fila 1: Badges y Número */}
                        <Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
                          <Col>
                            <Space wrap size={[6, 6]}>
                              <Tag color={tagColor} style={{ borderRadius: 6, fontWeight: 700, margin: 0 }}>
                                {tipoTexto}
                              </Tag>
                              <Text strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                                {isLlamada && nec.LLAMADA ? `📞 #${nec.LLAMADA}` : `📄 Nº ${docNum}`}
                              </Text>
                            </Space>
                          </Col>
                          {nec.QTY > 0 && (
                            <Col>
                              <Tag color="purple" style={{ borderRadius: 6, fontWeight: 800, fontSize: '0.82rem', margin: 0 }}>
                                {nec.QTY} u.
                              </Tag>
                            </Col>
                          )}
                        </Row>

                        {/* Fila 2: Cliente / Origen-Destino */}
                        {cliente && (
                          <div style={{ padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 4, marginBottom: 4, color: '#1e293b', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                            <span style={{ color: '#64748b', marginRight: 6 }}>🏢 Cliente:</span>
                            <strong>{cliente}</strong>
                          </div>
                        )}

                        {/* Fila 3: Observaciones */}
                        {observaciones && observaciones !== '-' && (
                          <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, marginBottom: 2 }}>
                              💬 Observaciones:
                            </div>
                            <div style={{ padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: 6, color: '#334155', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                              {observaciones}
                            </div>
                          </div>
                        )}
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </div>
        )}

        {/* Pestaña: Movimientos */}
        {selectedTab === 'mov' && (
          <div>
            {movimientosSummary.total_movimientos > 0 && (
              <div style={{ marginBottom: 12, backgroundColor: '#faf5ff', padding: '10px 14px', borderRadius: 10, border: '1px solid #e9d5ff' }}>
                <Row justify="space-between" align="middle" gutter={[8, 8]}>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '0.78rem' }}>Última Compra: </Text>
                    <Text strong style={{ fontSize: '0.78rem' }}>{movimientosSummary.ultima_compra || '-'}</Text>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '0.78rem' }}>Última Salida: </Text>
                    <Text strong style={{ fontSize: '0.78rem' }}>{movimientosSummary.ultima_salida || '-'}</Text>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '0.78rem' }}>Total Movs: </Text>
                    <Tag color="purple" style={{ borderRadius: 6, fontWeight: 700, margin: 0 }}>{movimientosSummary.total_movimientos}</Tag>
                  </Col>
                </Row>
              </div>
            )}

            {movimientosLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin size="small" tip="Cargando historial de movimientos desde SAP..." />
              </div>
            ) : movimientosData.length === 0 ? (
              <Empty description="No hay movimientos registrados para este producto" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                          border: '1px solid #e2e8f0',
                          borderLeft: `4px solid ${mov.categoria === 'traslado' ? '#f97316' : isPositive ? '#10b981' : '#ef4444'}`
                        }}
                      >
                        <Row justify="space-between" align="middle" gutter={[8, 8]}>
                          <Col xs={24} sm={14}>
                            <Space direction="vertical" size={1}>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                                {mov.tipo}
                              </div>
                              <Text type="secondary" style={{ fontSize: '0.78rem' }}>
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
                                style={{ borderRadius: 6, fontWeight: 800, fontSize: '0.82rem', margin: 0 }}
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

export default StockDetailModal;
