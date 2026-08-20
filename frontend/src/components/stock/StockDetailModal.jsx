import React, { useState, useEffect } from 'react';
import { Modal, Card, Tag, Typography, Row, Col, Space, Spin, Empty, Button, Input, Select, message } from 'antd';
import {
  EnvironmentOutlined,
  ShopOutlined,
  BulbOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CommentOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  EditOutlined,
  SaveOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  BoxPlotOutlined,
  LockFilled,
  MessageOutlined
} from '@ant-design/icons';
import stockApi from '../../api/stockApi';
import client from '../../utils/client';

const { Title, Text } = Typography;

export const StockDetailModal = ({ open, item, activeTab = 'ubis', onClose }) => {
  const [selectedTab, setSelectedTab] = useState(activeTab);

  const [necesidadesData, setNecesidadesData] = useState([]);
  const [necesidadesLoading, setNecesidadesLoading] = useState(false);
  const [movimientosSummary, setMovimientosSummary] = useState({});
  const [movimientosData, setMovimientosData] = useState([]);
  const [movimientosLoading, setMovimientosLoading] = useState(false);

  // Estado para gestión de Ubicación Predeterminada
  const [selectedWhsForBin, setSelectedWhsForBin] = useState('01');
  const [newDefaultBinInput, setNewDefaultBinInput] = useState('');
  const [validatingBin, setValidatingBin] = useState(false);
  const [isBinValid, setIsBinValid] = useState(null);
  const [binValidMsg, setBinValidMsg] = useState('');
  const [savingDefaultBin, setSavingDefaultBin] = useState(false);

  // Sincronizar selectedTab cuando cambia la pestaña activa desde fuera
  useEffect(() => {
    if (open) {
      setSelectedTab(activeTab || 'ubis');
      setNewDefaultBinInput('');
      setIsBinValid(null);
      setBinValidMsg('');
      setSelectedWhsForBin('01');
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

  const handleNewDefaultBinChange = async (val) => {
    const uppercaseVal = (val || '').toUpperCase();
    setNewDefaultBinInput(uppercaseVal);
    const clean = uppercaseVal.trim();
    if (!clean) {
      setIsBinValid(null);
      setBinValidMsg('');
      setValidatingBin(false);
      return;
    }

    setValidatingBin(true);
    try {
      const res = await client.get(`/ubicacion-existe/${encodeURIComponent(clean)}`);
      if (res.existe) {
        setIsBinValid(true);
        setBinValidMsg('Ubicación válida en SAP');
      } else {
        setIsBinValid(false);
        setBinValidMsg(res.message || 'La ubicación no existe en SAP');
      }
    } catch {
      setIsBinValid(false);
      setBinValidMsg('Error comprobando ubicación en SAP');
    } finally {
      setValidatingBin(false);
    }
  };

  const handleSaveDefaultBinFromStock = async () => {
    const cleanBin = (newDefaultBinInput || '').trim().toUpperCase();
    if (!cleanBin) {
      message.warning('Por favor introduce un código de ubicación');
      return;
    }
    if (isBinValid === false) {
      message.error('La ubicación especificada no existe en SAP');
      return;
    }

    setSavingDefaultBin(true);
    try {
      const res = await client.post('/docs/change-default-bin', {
        itemcode: item.ItemCode,
        whscode: selectedWhsForBin || '01',
        new_bin: cleanBin
      });
      if (res.status === 'ok' || res.message) {
        message.success(`Ubicación por defecto actualizada a ${cleanBin} para ${item.ItemCode} en almacén #${selectedWhsForBin}`);
        setNewDefaultBinInput('');
        setIsBinValid(null);
        setBinValidMsg('');
      } else {
        message.error(res.message || 'Error actualizando ubicación por defecto');
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || 'Error en comunicación con SAP';
      message.error(errMsg);
    } finally {
      setSavingDefaultBin(false);
    }
  };

  if (!item) return null;

  const ubicaciones = item.Ubicaciones || [];
  const warehouseList = (item.ItemWarehouseInfoCollection || []).filter(
    (whs) => (whs.InStock || 0) > 0 || (whs.Committed || 0) > 0 || (whs.Ordered || 0) > 0
  );

  const totalStock = item.QuantityOnStock || 0;
  const totalCommitted = item.QuantityOrderedByCustomers || 0;
  const totalOrdered = item.QuantityOrderedFromVendors || 0;
  const atpNeto = totalStock - totalCommitted + totalOrdered;
  const deficit = totalCommitted > (totalStock + totalOrdered) ? (totalCommitted - (totalStock + totalOrdered)) : 0;

  const tabsConfig = [
    { key: 'ubis', label: 'Ubicaciones', icon: <EnvironmentOutlined />, count: `${ubicaciones.length} ubi`, color: '#0d6efd' },
    { key: 'whs', label: 'Almacenes', icon: <ShopOutlined />, count: `${warehouseList.length} alm`, color: '#0d6efd' },
    { key: 'default_bin', label: 'Ubi Defecto', icon: <EditOutlined />, count: 'SAP', color: '#0d6efd' },
    { key: 'nec', label: 'Necesidades', icon: <BulbOutlined />, count: deficit > 0 ? `-${deficit}u` : 'ATP', color: '#0d6efd' },
    { key: 'mov', label: 'Movimientos', icon: <SwapOutlined />, count: movimientosSummary.total_movimientos || 'Hist', color: '#0d6efd' }
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
      <div className="sga-modal-banner-header">
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col xs={24} sm={16}>
            <Space size={8} wrap style={{ marginBottom: 4 }}>
              <span className="sga-item-code-badge" style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}>
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

      {/* 2. Bloque Resumen 4 KPIs en Gris Neutro */}
      <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <div className="sga-kpi-card">
            <Text type="secondary" style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', color: '#64748b' }}>Stock Físico</Text>
            <Text strong style={{ fontSize: '0.95rem', color: '#334155', fontFamily: 'monospace' }}>{totalStock} u.</Text>
          </div>
        </Col>

        <Col span={6}>
          <div className="sga-kpi-card">
            <Text type="secondary" style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', color: '#64748b' }}>Comprometido</Text>
            <Text strong style={{ fontSize: '0.95rem', color: '#334155', fontFamily: 'monospace' }}>{totalCommitted} u.</Text>
          </div>
        </Col>

        <Col span={6}>
          <div className="sga-kpi-card">
            <Text type="secondary" style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', color: '#64748b' }}>En Camino</Text>
            <Text strong style={{ fontSize: '0.95rem', color: '#334155', fontFamily: 'monospace' }}>{totalOrdered} u.</Text>
          </div>
        </Col>

        <Col span={6}>
          <div className="sga-kpi-card sga-kpi-card-atp">
            <Text type="secondary" style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', color: '#0f172a' }}>ATP Neto</Text>
            <Text strong style={{ fontSize: '1rem', fontWeight: 900, color: atpNeto < 0 ? '#dc2626' : '#0f172a', fontFamily: 'monospace' }}>{atpNeto} u.</Text>
          </div>
        </Col>
      </Row>

      {/* 3. Selector de Pestañas Interactivo */}
      <Row gutter={[6, 6]} style={{ marginBottom: 16 }}>
        {tabsConfig.map((tab) => {
          const isActive = selectedTab === tab.key;
          return (
            <Col xs={12} sm={4} style={{ flex: '1 1 0', minWidth: 100 }} key={tab.key}>
              <div
                onClick={() => setSelectedTab(tab.key)}
                className={`sga-segmented-pill ${isActive ? 'sga-segmented-pill-active' : 'sga-segmented-pill-inactive'}`}
                style={{
                  border: `1.5px solid ${isActive ? '#0d6efd' : '#e2e8f0'}`,
                  boxShadow: isActive ? '0 3px 10px rgba(13, 110, 253, 0.12)' : 'none',
                  padding: '8px 4px'
                }}
              >
                <div style={{ fontSize: 16, color: isActive ? '#0d6efd' : '#64748b', marginBottom: 2 }}>
                  {tab.icon}
                </div>
                <div style={{ fontSize: '0.76rem', fontWeight: isActive ? 800 : 600, color: isActive ? '#0d6efd' : '#64748b', whiteSpace: 'nowrap' }}>
                  {tab.label}
                </div>
                <Tag style={{ fontSize: '0.62rem', margin: '2px 0 0 0', borderRadius: 4, padding: '0 4px', background: isActive ? '#e7f1ff' : '#f1f5f9', color: isActive ? '#0d6efd' : '#64748b', border: 'none', fontWeight: 700 }}>
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
                      className="sga-nec-card-box"
                      styles={{ body: { padding: 12 } }}
                      style={{ borderLeft: '4px solid #3b82f6' }}
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
            {warehouseList.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Este producto no tiene existencias ni movimientos en ningún almacén"
                style={{ margin: '24px 0' }}
              />
            ) : (
              <Row gutter={[10, 10]}>
                {warehouseList.map((whs) => {
                  const disp = (whs.InStock || 0) - (whs.Committed || 0);
                  return (
                    <Col span={24} key={whs.WarehouseCode}>
                      <Card
                        className="sga-nec-card-box"
                        styles={{ body: { padding: 12 } }}
                        style={{ borderLeft: '4px solid #10b981' }}
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
            )}
          </div>
        )}

        {/* Pestaña: Ubicación Predeterminada */}
        {selectedTab === 'default_bin' && (
          <div>
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', marginBottom: 2 }}>
                <EditOutlined style={{ marginRight: 6, color: '#0d6efd' }} />
                Configurar Ubicación Predeterminada del Artículo en SAP
              </div>
              <Text type="secondary" style={{ fontSize: '0.78rem' }}>
                Establece la ubicación estándar en la que SAP registrará automáticamente las entradas y preparaciones de este artículo.
              </Text>
            </div>

            <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: 6 }}>
                  1. Seleccionar Almacén:
                </label>
                <Select
                  value={selectedWhsForBin}
                  onChange={(val) => setSelectedWhsForBin(val)}
                  style={{ width: '100%', borderRadius: 8 }}
                  size="large"
                  options={
                    warehouseList.length > 0
                      ? warehouseList.map(w => ({ value: w.WarehouseCode, label: `Almacén #${w.WarehouseCode}` }))
                      : [{ value: '01', label: 'Almacén #01 (Principal)' }]
                  }
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: 6 }}>
                  2. Nueva Ubicación Predeterminada:
                </label>
                <Input
                  placeholder="Ej: 01-10-20-00-00"
                  value={newDefaultBinInput}
                  onChange={(e) => handleNewDefaultBinChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  size="large"
                  prefix={<EnvironmentOutlined style={{ color: '#9ca3af' }} />}
                  suffix={
                    validatingBin ? (
                      <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                    ) : isBinValid === true ? (
                      <CheckCircleFilled style={{ color: '#198754', fontSize: 18 }} />
                    ) : isBinValid === false ? (
                      <CloseCircleFilled style={{ color: '#ef4444', fontSize: 18 }} />
                    ) : null
                  }
                  style={{
                    borderRadius: 8,
                    borderColor: isBinValid === true ? '#198754' : isBinValid === false ? '#ef4444' : '#d9d9d9',
                    boxShadow: isBinValid === true ? '0 0 0 2px rgba(25, 135, 84, 0.1)' : isBinValid === false ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
                  }}
                />
                {binValidMsg && (
                  <div style={{
                    marginTop: 6,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: isBinValid ? '#198754' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {isBinValid ? <CheckCircleFilled /> : <CloseCircleFilled />}
                    {binValidMsg}
                  </div>
                )}
              </div>

              {/* Ubicaciones disponibles del artículo para hacer clic */}
              {ubicaciones.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                    Ubicaciones actuales del artículo para seleccionar rápido:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ubicaciones.map((u, uIdx) => {
                      const code = u.BinCode || u.Warehouse;
                      return (
                        <Tag
                          key={uIdx}
                          onClick={() => handleNewDefaultBinChange(code)}
                          style={{
                            cursor: 'pointer',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            backgroundColor: '#f0fdf4',
                            borderColor: '#bbf7d0',
                            color: '#166534'
                          }}
                        >
                          📍 {code} ({u.BINQTY || u.SNQTY || 0} u.)
                        </Tag>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={savingDefaultBin}
                disabled={!newDefaultBinInput || isBinValid === false || validatingBin}
                onClick={handleSaveDefaultBinFromStock}
                block
                size="large"
                style={{
                  borderRadius: 8,
                  backgroundColor: isBinValid ? '#198754' : '#0d6efd',
                  borderColor: isBinValid ? '#198754' : '#0d6efd',
                  fontWeight: 700
                }}
              >
                Guardar Ubicación Predeterminada en SAP
              </Button>
            </Card>
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
                  const isLlamada = (nec.LLAMADA && parseInt(nec.LLAMADA) > 0) || nec.TIPO === 'Llamada' || nec.OBJTYPE === 'LLAMADA' || nec.OBJTYPE === '191';
                  const docNum = nec.DOCNUM || nec.DocNum || nec.DOCENTRY || nec.LLAMADA || (idx + 1);
                  const fromWhs = nec.FROM_WHS || nec.FromWarehouse || '01';
                  const toWhs = nec.TO_WHS || nec.ToWarehouse || '13';
                  const cliente = nec.CARDNAME || nec.CardName || (isTraslado ? `Traslado Alm. ${fromWhs} ➔ Alm. ${toWhs}` : '');
                  const observaciones = nec.COMENTARIO || nec.Comments || nec.COMENTARIO_LLAMADA || '';
                  const cantVal = Number(nec.QTY ?? nec.CANTIDAD ?? nec.QUANTITY ?? 0);
                  const compVal = Number(nec.COMPROMETIDO ?? nec.COMMITTED ?? nec.Committed ?? cantVal);
                  const rawDate = nec.DOCDATE || nec.DocDate || nec.FECHA || nec.TaxDate || '';
                  const fecha = rawDate ? String(rawDate).split('T')[0] : '';
                  const llamadaNum = nec.LLAMADA || (isLlamada ? docNum : null);
                  const llamadaEstado = nec.ESTADO_LLAMADA || nec.STATUS || nec.U_Estado || nec.ASUNTO_LLAMADA || '';
                  const titlePrefix = isTraslado ? 'Traslado' : isLlamada ? 'Llamada' : 'Pedido';

                  return (
                    <Col span={24} key={idx}>
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          padding: '12px 14px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                        }}
                      >
                        {/* Fila 1: Título y Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
                            {titlePrefix} {docNum}
                          </span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{
                              backgroundColor: '#475569',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: 6
                            }}>
                              Cant: {cantVal.toFixed(1)}
                            </span>
                            <span style={{
                              backgroundColor: '#f59e0b',
                              color: '#000000',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: 6,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <LockFilled style={{ fontSize: '0.7rem' }} /> Comp: {compVal.toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Fila 2: Fecha */}
                        {fecha && (
                          <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>📅</span>
                            <span>Fecha: <strong style={{ color: '#1e293b' }}>{fecha}</strong></span>
                          </div>
                        )}

                        {/* Fila 3: Llamada */}
                        {llamadaNum && (
                          <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>⚙️</span>
                            <span>Llamada: <strong style={{ color: '#1e293b' }}>{llamadaNum}{llamadaEstado ? ` (${llamadaEstado})` : ''}</strong></span>
                          </div>
                        )}

                        {/* Fila 4: Cliente */}
                        {cliente && (
                          <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🏢</span>
                            <span>Cliente: <strong style={{ color: '#1e293b' }}>{cliente}</strong></span>
                          </div>
                        )}

                        {/* Fila 5: Observaciones */}
                        {observaciones && observaciones !== '-' && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ color: '#0284c7', fontSize: '0.82rem', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <MessageOutlined style={{ color: '#0284c7' }} /> Observaciones:
                            </div>
                            <div style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 8,
                              padding: '10px 12px',
                              color: '#1e293b',
                              fontSize: '0.82rem',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-line'
                            }}>
                              {observaciones}
                            </div>
                          </div>
                        )}
                      </div>
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
              <div style={{ marginBottom: 12, backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <Row justify="space-between" align="middle" gutter={[8, 8]}>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '0.78rem', color: '#64748b' }}>Última Compra: </Text>
                    <Text strong style={{ fontSize: '0.78rem', color: '#334155' }}>{movimientosSummary.ultima_compra || '-'}</Text>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '0.78rem', color: '#64748b' }}>Última Salida: </Text>
                    <Text strong style={{ fontSize: '0.78rem', color: '#334155' }}>{movimientosSummary.ultima_salida || '-'}</Text>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: '0.78rem', color: '#64748b' }}>Total Movs: </Text>
                    <Tag style={{ borderRadius: 6, fontWeight: 700, margin: 0, backgroundColor: '#e2e8f0', color: '#334155', border: '1px solid #cbd5e1' }}>
                      {movimientosSummary.total_movimientos}
                    </Tag>
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
                        className="sga-nec-card-box"
                        styles={{ body: { padding: 12 } }}
                        style={{ borderLeft: `4px solid ${mov.categoria === 'traslado' ? '#f97316' : isPositive ? '#10b981' : '#ef4444'}` }}
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
