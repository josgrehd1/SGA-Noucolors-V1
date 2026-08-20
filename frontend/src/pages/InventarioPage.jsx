import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, InputNumber, Button, Row, Col, Segmented, message, Spin, Divider, Space, Modal, Tag, Tooltip } from 'antd';
import {
  CheckOutlined, EnvironmentOutlined, BarcodeOutlined, EyeOutlined, EyeInvisibleOutlined,
  PlusOutlined, DeleteOutlined, SaveOutlined, CheckCircleFilled, CloseCircleFilled,
  LoadingOutlined, ScanOutlined, WarningOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import client from '../utils/client';

export const InventarioPage = () => {
  const location = useLocation();
  const [isBlindMode, setIsBlindMode] = useState(location.state?.ciego || false);
  const [loading, setLoading] = useState(false);
  const scanInputRefs = useRef({});
  const [cards, setCards] = useState([
    { id: uuidv4(), binCode: '', binStatus: null, binMsg: '', scanInput: '', products: [], loading: false }
  ]);

  useEffect(() => {
    if (location.state?.ciego !== undefined) {
      setIsBlindMode(location.state.ciego);
    }
  }, [location]);

  const addLocationCard = () => {
    setCards(prev => [
      ...prev,
      { id: uuidv4(), binCode: '', binStatus: null, binMsg: '', scanInput: '', products: [], loading: false }
    ]);
  };

  const removeLocationCard = (id) => {
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const updateCardBinCode = (id, value) => {
    // Normalizar automáticamente si el lector de código de barras envía '/' en vez de '-'
    const normalized = value.toUpperCase().replace(/\//g, '-');
    setCards(prev => prev.map(c => c.id === id ? { ...c, binCode: normalized, binStatus: null, binMsg: '' } : c));
  };

  const loadProductsForBin = async (id, binCode) => {
    const cleanBin = (binCode || '').trim().toUpperCase().replace(/\//g, '-');
    if (!cleanBin) {
      setCards(prev => prev.map(c => c.id === id ? { ...c, binStatus: null, binMsg: '', products: [], loading: false } : c));
      return;
    }

    setCards(prev => prev.map(c => c.id === id ? { ...c, loading: true, binStatus: 'validating' } : c));
    try {
      // 1. Validar estrictamente si la ubicación existe en SAP
      const checkRes = await client.get(`/ubicacion-existe/${encodeURIComponent(cleanBin)}`);
      if (!checkRes.existe) {
        const errorMsg = checkRes.message || `La ubicación '${cleanBin}' no existe en SAP`;
        message.error(errorMsg);
        setCards(prev => prev.map(c => c.id === id ? {
          ...c,
          binStatus: 'invalid',
          binMsg: errorMsg,
          products: [],
          loading: false
        } : c));
        return;
      }

      // 2. Si la ubicación existe, cargar los artículos presentes en ella
      const res = await client.get(`/get-bin-stock-info/${encodeURIComponent(cleanBin)}`);
      let prods = [];
      if (res.datos && Array.isArray(res.datos) && res.datos.length > 0) {
        prods = res.datos.map(p => ({
          id: uuidv4(),
          itemCode: p.ItemCode,
          itemName: p.ItemName || p.ItemDescription || '',
          qty: null, // Conteo ciego por defecto: forzar a introducir el número real
          originalQty: Number(p.BINQTY ?? 0),
          isNew: false,
          justScanned: false
        }));
      }

      setCards(prev => prev.map(c => c.id === id ? {
        ...c,
        binStatus: 'valid',
        binMsg: 'Ubicación válida en SAP',
        products: prods,
        loading: false
      } : c));

      // Enfocar automáticamente el input de escaneo de artículos
      setTimeout(() => {
        scanInputRefs.current[id]?.focus();
      }, 150);
    } catch (error) {
      console.error(error);
      const errMsg = error?.response?.data?.message || `Error al validar ubicación ${cleanBin}`;
      message.error(errMsg);
      setCards(prev => prev.map(c => c.id === id ? {
        ...c,
        binStatus: 'invalid',
        binMsg: errMsg,
        products: [],
        loading: false
      } : c));
    }
  };

  // 3. Optimización para pistola/escáner rápido
  const handleScanProduct = async (cardId, scanValue) => {
    const cleanScan = (scanValue || '').trim().toUpperCase().replace(/\//g, '-');
    if (!cleanScan) {
      // Re-enfocar de todos modos
      scanInputRefs.current[cardId]?.focus();
      return;
    }

    // Asegurar foco continuo en el input de escaneo
    const focusScanner = () => {
      setTimeout(() => {
        scanInputRefs.current[cardId]?.focus();
      }, 50);
    };

    // Buscar si el producto ya existe en la lista de la tarjeta
    const currentCard = cards.find(c => c.id === cardId);
    if (!currentCard) return;

    // Verificar si coincide con el itemCode directamente
    const existingIndex = currentCard.products.findIndex(p => p.itemCode.toUpperCase() === cleanScan);

    if (existingIndex >= 0) {
      // Incrementar cantidad (+1) o inicializar a 1 si estaba vacía
      setCards(prev => prev.map(c => {
        if (c.id === cardId) {
          const updatedProds = [...c.products];
          const target = updatedProds[existingIndex];
          const nextQty = target.qty === null || target.qty === undefined ? 1 : Number(target.qty) + 1;
          updatedProds[existingIndex] = { ...target, qty: nextQty, justScanned: true };
          return { ...c, scanInput: '', products: updatedProds };
        }
        return c;
      }));

      message.success(`+1 en ${cleanScan}`);
      focusScanner();

      // Remover highlight tras 1s
      setTimeout(() => {
        setCards(prev => prev.map(c => {
          if (c.id === cardId) {
            return {
              ...c,
              products: c.products.map(p => p.itemCode.toUpperCase() === cleanScan ? { ...p, justScanned: false } : p)
            };
          }
          return c;
        }));
      }, 1000);
      return;
    }

    // Si no coincide directo, consultar en SAP para resolver EAN o añadir deslocalizado
    try {
      const res = await client.get('/producto-existe', { params: { 'prod-search': cleanScan } });
      if (res.existe) {
        const realCode = (res.real_itemcode || cleanScan).toUpperCase();
        const itemName = res.itemname || res.productos?.[0]?.ItemName || 'Artículo deslocalizado';

        // Re-verificar si el realCode resuelto coincide con alguno existente
        const matchedIndex = currentCard.products.findIndex(p => p.itemCode.toUpperCase() === realCode);

        if (matchedIndex >= 0) {
          setCards(prev => prev.map(c => {
            if (c.id === cardId) {
              const updatedProds = [...c.products];
              const target = updatedProds[matchedIndex];
              const nextQty = target.qty === null || target.qty === undefined ? 1 : Number(target.qty) + 1;
              updatedProds[matchedIndex] = { ...target, qty: nextQty, justScanned: true };
              return { ...c, scanInput: '', products: updatedProds };
            }
            return c;
          }));
          message.success(`+1 en ${realCode}`);
        } else {
          // Añadir como artículo deslocalizado nuevo
          const newProd = {
            id: uuidv4(),
            itemCode: realCode,
            itemName: itemName,
            qty: 1,
            originalQty: 0,
            isNew: true,
            justScanned: true
          };

          setCards(prev => prev.map(c => {
            if (c.id === cardId) {
              return { ...c, scanInput: '', products: [newProd, ...c.products] };
            }
            return c;
          }));
          message.info(`Artículo deslocalizado añadido: ${realCode} (Ctd: 1)`);
        }
      } else {
        message.error(`El código '${cleanScan}' no existe en SAP`);
      }
    } catch {
      message.error(`Error verificando artículo ${cleanScan}`);
    } finally {
      focusScanner();
    }
  };

  const updateProductQty = (cardId, prodId, val) => {
    setCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          products: c.products.map(p => p.id === prodId ? { ...p, qty: val } : p)
        };
      }
      return c;
    }));
  };

  const setZeroToUncounted = (cardId) => {
    setCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          products: c.products.map(p => p.qty === null || p.qty === undefined ? { ...p, qty: 0 } : p)
        };
      }
      return c;
    }));
    message.info('Líneas no contadas fijadas a 0 (Merma)');
  };

  const removeProductRow = (cardId, prodId) => {
    setCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return { ...c, products: c.products.filter(p => p.id !== prodId) };
      }
      return c;
    }));
  };

  const executeSubmit = async () => {
    const payload = [];
    
    for (const card of cards) {
      if (card.binStatus !== 'valid') continue;
      const bin = card.binCode.trim();
      if (!bin) continue;

      for (const prod of card.products) {
        const item = prod.itemCode.trim();
        // Solo enviar líneas donde se haya realizado recuento explícito (número >= 0)
        if (prod.qty !== null && prod.qty !== undefined && prod.qty !== '') {
          const qty = parseFloat(prod.qty);
          if (item && !isNaN(qty) && qty >= 0) {
            payload.push({
              BinCode: bin,
              ItemCode: item,
              CountQty: qty,
              IsBlind: isBlindMode
            });
          }
        }
      }
    }

    if (payload.length === 0) {
      message.warning('No hay líneas recontadas (introduce cantidades en los artículos).');
      return;
    }

    setLoading(true);
    try {
      const res = await client.post('/docs/inventario', payload);
      if (res.status === 'ok') {
        message.success(res.message || 'Inventario registrado masivamente con éxito.');
        setCards([{ id: uuidv4(), binCode: '', binStatus: null, binMsg: '', scanInput: '', products: [], loading: false }]);
      } else {
        message.error(res.message || 'Error registrando recuento de inventario');
      }
    } catch (err) {
      message.error(err.message || 'Error guardando recuento en SAP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    Modal.confirm({
      title: '¿Confirmar carga de recuento de inventario?',
      content: 'Se enviarán las cantidades recontadas a SAP para ajustar las existencias físicas. ¿Deseas continuar?',
      okText: 'Sí, cargar en SAP',
      cancelText: 'Cancelar',
      onOk: executeSubmit
    });
  };

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1300, margin: '0 auto' }}>
      {/* Header & Acciones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            Recuento de Inventario
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>
            {isBlindMode 
              ? 'Modo Ciego: Las cantidades teóricas están ocultas para garantizar un recuento físico imparcial.' 
              : 'Modo Estándar: Muestra las existencias teóricas registradas en SAP como referencia.'}
          </p>
        </div>

        <Space wrap size="middle">
          <Segmented
            options={[
              { label: 'Inventario Estándar', value: 'normal', icon: <EyeOutlined /> },
              { label: 'Inventario Ciego', value: 'blind', icon: <EyeInvisibleOutlined /> }
            ]}
            value={isBlindMode ? 'blind' : 'normal'}
            onChange={(val) => setIsBlindMode(val === 'blind')}
            size="large"
            style={{ fontWeight: 600 }}
          />
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSubmit}
            loading={loading}
            size="large"
            style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', fontWeight: 700, borderRadius: 8, height: 42 }}
          >
            Cargar SAP
          </Button>
          <Button 
            type="primary" 
            icon={<EnvironmentOutlined />} 
            onClick={addLocationCard}
            size="large"
            style={{ borderRadius: 8, fontWeight: 600, height: 42 }}
          >
            + Ubicación
          </Button>
        </Space>
      </div>

      {/* Grid de Tarjetas de Ubicación */}
      <Row gutter={[16, 16]}>
        {cards.map((card) => {
          const totalProds = card.products.length;
          const countedProds = card.products.filter(p => p.qty !== null && p.qty !== undefined && p.qty !== '').length;
          const isAllCounted = totalProds > 0 && countedProds === totalProds;

          return (
            <Col xs={24} md={12} xl={8} key={card.id}>
              <Card 
                style={{
                  borderRadius: 10,
                  borderTop: card.binStatus === 'valid' 
                    ? (isAllCounted ? '4px solid #16a34a' : '4px solid #0d6efd')
                    : card.binStatus === 'invalid' ? '4px solid #ef4444' : '4px solid #94a3b8',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
                styles={{ body: { padding: '16px 14px' } }}
              >
                {/* Cabecera de Ubicación */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <EnvironmentOutlined style={{ color: card.binStatus === 'valid' ? '#16a34a' : '#64748b' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Ubicación</span>
                    {totalProds > 0 && (
                      <Tag color={isAllCounted ? 'success' : 'processing'} style={{ borderRadius: 6, fontWeight: 700, fontSize: '0.74rem' }}>
                        {countedProds}/{totalProds} recontados
                      </Tag>
                    )}
                  </div>

                  {cards.length > 1 && (
                    <Button 
                      size="small" 
                      danger 
                      icon={<DeleteOutlined />} 
                      onClick={() => removeLocationCard(card.id)} 
                      type="text"
                    />
                  )}
                </div>

                {/* Input de Ubicación */}
                <Input
                  prefix={<EnvironmentOutlined style={{ color: card.binStatus === 'valid' ? '#16a34a' : card.binStatus === 'invalid' ? '#ef4444' : '#64748b' }} />}
                  suffix={
                    card.loading ? (
                      <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                    ) : card.binStatus === 'valid' ? (
                      <CheckCircleFilled style={{ color: '#16a34a', fontSize: 18 }} />
                    ) : card.binStatus === 'invalid' ? (
                      <CloseCircleFilled style={{ color: '#ef4444', fontSize: 18 }} />
                    ) : null
                  }
                  placeholder="Escanear ubicación (ej. 01-10-00-00)..."
                  size="large"
                  value={card.binCode}
                  onChange={(e) => updateCardBinCode(card.id, e.target.value)}
                  onPressEnter={(e) => loadProductsForBin(card.id, e.target.value)}
                  onBlur={(e) => loadProductsForBin(card.id, e.target.value)}
                  disabled={card.loading}
                  style={{
                    borderRadius: 8,
                    borderColor: card.binStatus === 'valid' ? '#16a34a' : card.binStatus === 'invalid' ? '#ef4444' : '#d9d9d9',
                    boxShadow: card.binStatus === 'valid' ? '0 0 0 2px rgba(22, 163, 74, 0.1)' : card.binStatus === 'invalid' ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
                  }}
                />

                {card.binStatus === 'invalid' && card.binMsg && (
                  <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CloseCircleFilled /> {card.binMsg}
                  </div>
                )}

                {card.loading && (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <Spin tip="Cargando artículos de la ubicación..." />
                  </div>
                )}

                {/* Zona de Escaneo Rápido de Producto */}
                {card.binStatus === 'valid' && !card.loading && (
                  <div style={{ marginTop: 14 }}>
                    <Input
                      ref={(el) => { scanInputRefs.current[card.id] = el; }}
                      prefix={<ScanOutlined style={{ color: '#0d6efd', fontSize: 16 }} />}
                      placeholder="Pistola / Escanear producto o EAN (+1)..."
                      size="large"
                      value={card.scanInput || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().replace(/\//g, '-');
                        setCards(prev => prev.map(c => c.id === card.id ? { ...c, scanInput: val } : c));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault();
                          handleScanProduct(card.id, card.scanInput);
                        }
                      }}
                      onPressEnter={(e) => {
                        e.preventDefault();
                        handleScanProduct(card.id, e.target.value);
                      }}
                      style={{
                        borderRadius: 8,
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #93c5fd'
                      }}
                    />

                    {/* Acciones Rápidas */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                        Artículos en {card.binCode}:
                      </span>
                      {card.products.some(p => p.qty === null || p.qty === undefined) && (
                        <Button 
                          size="small" 
                          type="link" 
                          onClick={() => setZeroToUncounted(card.id)}
                          style={{ padding: 0, fontSize: '0.76rem', color: '#d97706', fontWeight: 700 }}
                        >
                          Fijar 0 a no encontrados
                        </Button>
                      )}
                    </div>

                    {/* Lista de Artículos (Read-only ID + Conteo) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
                      {card.products.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: '0.82rem' }}>
                          Ubicación vacía en SAP. Escanea productos con la pistola para añadirlos a este inventario.
                        </div>
                      ) : (
                        card.products.map((prod) => {
                          const isCounted = prod.qty !== null && prod.qty !== undefined && prod.qty !== '';
                          const isZero = isCounted && Number(prod.qty) === 0;
                          const hasDiscrepancy = !isBlindMode && isCounted && Number(prod.qty) !== prod.originalQty;

                          return (
                            <div 
                              key={prod.id}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: prod.justScanned 
                                  ? '2px solid #22c55e' 
                                  : isCounted 
                                    ? (isZero ? '1px solid #fde68a' : '1px solid #bbf7d0') 
                                    : '1px solid #e2e8f0',
                                backgroundColor: prod.justScanned 
                                  ? '#dcfce7' 
                                  : isCounted 
                                    ? (isZero ? '#fffbeb' : '#f0fdf4') 
                                    : '#ffffff',
                                transition: 'all 0.25s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8
                              }}
                            >
                              {/* Identidad del Producto (Read-only / No editable) */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                  <BarcodeOutlined style={{ color: '#475569', fontSize: 13 }} />
                                  <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                                    {prod.itemCode}
                                  </strong>

                                  {prod.isNew && (
                                    <Tag color="orange" style={{ fontSize: '0.68rem', borderRadius: 4, margin: 0, padding: '0 4px', fontWeight: 700 }}>
                                      Deslocalizado
                                    </Tag>
                                  )}

                                  {!isBlindMode && (
                                    <Tag color="default" style={{ fontSize: '0.68rem', borderRadius: 4, margin: 0, padding: '0 4px', color: '#64748b' }}>
                                      Teórico: {prod.originalQty} u.
                                    </Tag>
                                  )}
                                </div>

                                <div style={{ fontSize: '0.76rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={prod.itemName}>
                                  {prod.itemName || 'Sin descripción'}
                                </div>
                              </div>

                              {/* Columna de Conteo y Acciones */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <div style={{ textAlign: 'center' }}>
                                  <InputNumber
                                    min={0}
                                    size="middle"
                                    placeholder="0"
                                    value={prod.qty}
                                    onFocus={(e) => e.target.select()}
                                    onClick={(e) => e.target.select()}
                                    onChange={(val) => updateProductQty(card.id, prod.id, val)}
                                    style={{
                                      width: 68,
                                      borderRadius: 6,
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      borderColor: isCounted ? (isZero ? '#f59e0b' : '#16a34a') : '#cbd5e1'
                                    }}
                                  />
                                </div>

                                {/* Botón rápido Fijar 0 / Merma si está vacío */}
                                {!isCounted && (
                                  <Tooltip title="Marcar 0 (No encontrado / Merma)">
                                    <Button
                                      size="small"
                                      onClick={() => updateProductQty(card.id, prod.id, 0)}
                                      style={{
                                        borderRadius: 6,
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '0 6px',
                                        color: '#d97706',
                                        borderColor: '#fde68a',
                                        backgroundColor: '#fffbeb'
                                      }}
                                    >
                                      0 u.
                                    </Button>
                                  </Tooltip>
                                )}

                                {prod.isNew && (
                                  <Button 
                                    type="text" 
                                    danger 
                                    size="small" 
                                    icon={<DeleteOutlined />} 
                                    onClick={() => removeProductRow(card.id, prod.id)}
                                    style={{ padding: 0 }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

export default InventarioPage;
