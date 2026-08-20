import React, { useState, useEffect } from 'react';
import { Card, Input, InputNumber, Button, Row, Col, Segmented, message, Spin, Empty, Divider, Space, Modal } from 'antd';
import {
  CheckOutlined, EnvironmentOutlined, BarcodeOutlined, EyeOutlined, EyeInvisibleOutlined,
  PlusOutlined, DeleteOutlined, SaveOutlined, CheckCircleFilled, CloseCircleFilled, LoadingOutlined
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import client from '../utils/client';

export const InventarioPage = () => {
  const location = useLocation();
  const [isBlindMode, setIsBlindMode] = useState(location.state?.ciego || false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState([{ id: uuidv4(), binCode: '', binStatus: null, binMsg: '', products: [], loading: false }]);

  useEffect(() => {
    if (location.state?.ciego !== undefined) {
      setIsBlindMode(location.state.ciego);
    }
  }, [location]);

  const addLocationCard = () => {
    setCards([...cards, { id: uuidv4(), binCode: '', binStatus: null, binMsg: '', products: [], loading: false }]);
  };

  const removeLocationCard = (id) => {
    setCards(cards.filter(c => c.id !== id));
  };

  const updateCardBinCode = (id, value) => {
    setCards(cards.map(c => c.id === id ? { ...c, binCode: value.toUpperCase(), binStatus: null, binMsg: '' } : c));
  };

  const loadProductsForBin = async (id, binCode) => {
    const cleanBin = (binCode || '').trim().toUpperCase();
    if (!cleanBin) {
      setCards(cards.map(c => c.id === id ? { ...c, binStatus: null, binMsg: '', products: [], loading: false } : c));
      return;
    }

    setCards(cards.map(c => c.id === id ? { ...c, loading: true, binStatus: 'validating' } : c));
    try {
      // 1. Validar estrictamente si la ubicación existe en SAP
      const checkRes = await client.get(`/ubicacion-existe/${encodeURIComponent(cleanBin)}`);
      if (!checkRes.existe) {
        const errorMsg = checkRes.message || `La ubicación '${cleanBin}' no existe en SAP`;
        message.error(errorMsg);
        setCards(cards.map(c => c.id === id ? {
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
          qty: isBlindMode ? null : p.BINQTY,
          originalQty: p.BINQTY
        }));
      } else {
        // Ubicación válida pero vacía en SAP: añadir 1 fila en blanco para registrar productos
        prods = [{ id: uuidv4(), itemCode: '', itemName: '', qty: null }];
      }

      setCards(cards.map(c => c.id === id ? {
        ...c,
        binStatus: 'valid',
        binMsg: 'Ubicación válida en SAP',
        products: prods,
        loading: false
      } : c));
    } catch (error) {
      console.error(error);
      const errMsg = error?.response?.data?.message || `Error al validar ubicación ${cleanBin}`;
      message.error(errMsg);
      setCards(cards.map(c => c.id === id ? {
        ...c,
        binStatus: 'invalid',
        binMsg: errMsg,
        products: [],
        loading: false
      } : c));
    }
  };

  const addProductRow = (cardId) => {
    setCards(cards.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          products: [...c.products, { id: uuidv4(), itemCode: '', itemName: '', qty: null }]
        };
      }
      return c;
    }));
  };

  const removeProductRow = (cardId, prodId) => {
    setCards(cards.map(c => {
      if (c.id === cardId) {
        return { ...c, products: c.products.filter(p => p.id !== prodId) };
      }
      return c;
    }));
  };

  const updateProductRow = (cardId, prodId, field, value) => {
    setCards(cards.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          products: c.products.map(p => {
            if (p.id === prodId) {
              return { ...p, [field]: field === 'itemCode' ? value.toUpperCase() : value };
            }
            return p;
          })
        };
      }
      return c;
    }));
  };

  const validateProductRow = async (cardId, prodId, itemCode) => {
    const clean = (itemCode || '').trim().toUpperCase();
    if (!clean) return;

    try {
      const res = await client.get('/producto-existe', { params: { 'prod-search': clean } });
      if (res.existe) {
        const realCode = res.real_itemcode || clean;
        const name = res.itemname || (res.productos?.[0]?.ItemName) || '';
        setCards(cards => cards.map(c => {
          if (c.id === cardId) {
            return {
              ...c,
              products: c.products.map(p => {
                if (p.id === prodId) {
                  return { ...p, itemCode: realCode, itemName: name, itemValid: true };
                }
                return p;
              })
            };
          }
          return c;
        }));
      } else {
        message.warning(`El artículo '${clean}' no existe en SAP`);
        setCards(cards => cards.map(c => {
          if (c.id === cardId) {
            return {
              ...c,
              products: c.products.map(p => {
                if (p.id === prodId) {
                  return { ...p, itemName: 'Artículo no encontrado', itemValid: false };
                }
                return p;
              })
            };
          }
          return c;
        }));
      }
    } catch {
      // Ignore network error on quick typing
    }
  };

  const executeSubmit = async () => {
    const payload = [];
    
    for (const card of cards) {
      if (card.binStatus !== 'valid') continue;
      const bin = card.binCode.trim();
      if (!bin) continue;

      for (const prod of card.products) {
        const item = prod.itemCode.trim();
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

    if (payload.length === 0) {
      message.warning('No hay líneas válidas con ubicación confirmada para contabilizar.');
      return;
    }

    setLoading(true);
    try {
      const res = await client.post('/docs/inventario', payload);
      if (res.status === 'ok') {
        message.success(res.message || 'Inventario registrado masivamente con éxito.');
        // Reset state
        setCards([{ id: uuidv4(), binCode: '', products: [], loading: false }]);
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
      title: '¿Confirmar carga de inventario?',
      content: 'Se enviarán las cantidades introducidas a SAP. ¿Estás seguro de continuar?',
      okText: 'Sí, cargar',
      cancelText: 'Cancelar',
      onOk: executeSubmit
    });
  };

  // Switch to blind mode causes re-render of qty if needed
  useEffect(() => {
    setCards(prev => prev.map(c => ({
      ...c,
      products: c.products.map(p => ({
        ...p,
        qty: isBlindMode ? null : (p.qty !== null ? p.qty : p.originalQty)
      }))
    })));
  }, [isBlindMode]);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#212529', margin: 0 }}>
            Recuento de Inventario
          </h2>
          <p style={{ margin: 0, color: '#6c757d', fontSize: '0.85rem' }}>
            {isBlindMode 
              ? 'Modo Ciego: Las cantidades teóricas están ocultas para auditoría imparcial.' 
              : 'Modo Estándar: Muestra las existencias teóricas registradas en SAP.'}
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
            style={{ backgroundColor: '#198754', borderColor: '#198754', fontWeight: 700, borderRadius: 8 }}
          >
            Cargar SAP
          </Button>
          <Button 
            type="primary" 
            icon={<EnvironmentOutlined />} 
            onClick={addLocationCard}
            size="large"
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            + Ubicación
          </Button>
        </Space>
      </div>

      {isBlindMode ? (
        <div style={{ marginBottom: 16, backgroundColor: '#fffbe6', border: '1px solid #ffe58f', color: '#d46b08', padding: '10px 16px', borderRadius: 8, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <EyeInvisibleOutlined style={{ fontSize: 18 }} />
          <span><strong>Modo Ciego Activado:</strong> Las cantidades registradas en SAP permanecerán ocultas durante el recuento físico para evitar sesgos.</span>
        </div>
      ) : (
        <div style={{ marginBottom: 16, backgroundColor: '#e6f4ff', border: '1px solid #91caff', color: '#0958d9', padding: '10px 16px', borderRadius: 8, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <EyeOutlined style={{ fontSize: 18 }} />
          <span><strong>Modo Estándar:</strong> Al escanear una ubicación, se rellenarán automáticamente los artículos con su stock teórico actual en SAP.</span>
        </div>
      )}

      <Row gutter={[16, 16]}>
        {cards.map((card, idx) => (
          <Col xs={24} md={12} xl={8} key={card.id}>
            <Card 
              style={{
                borderRadius: 8,
                borderTop: card.binStatus === 'valid' ? '4px solid #198754' : card.binStatus === 'invalid' ? '4px solid #ef4444' : '4px solid #0d6efd',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
              styles={{ body: { padding: 16 } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontWeight: 600, color: '#495057' }}>Ubicación</label>
                <Space>
                  {card.binCode && card.binStatus === 'valid' && !card.loading && (
                    <Button 
                      size="small" 
                      type="dashed" 
                      icon={<PlusOutlined />} 
                      onClick={() => addProductRow(card.id)}
                      title="Añadir línea de artículo"
                    />
                  )}
                  {cards.length > 1 && (
                    <Button 
                      size="small" 
                      danger 
                      icon={<DeleteOutlined />} 
                      onClick={() => removeLocationCard(card.id)} 
                      type="text"
                    />
                  )}
                </Space>
              </div>

              <Input
                prefix={<EnvironmentOutlined style={{ color: card.binStatus === 'valid' ? '#198754' : card.binStatus === 'invalid' ? '#ef4444' : '#0d6efd' }} />}
                suffix={
                  card.loading ? (
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                  ) : card.binStatus === 'valid' ? (
                    <CheckCircleFilled style={{ color: '#198754', fontSize: 18 }} />
                  ) : card.binStatus === 'invalid' ? (
                    <CloseCircleFilled style={{ color: '#ef4444', fontSize: 18 }} />
                  ) : null
                }
                placeholder="Escanear ubicación..."
                size="large"
                value={card.binCode}
                onChange={(e) => updateCardBinCode(card.id, e.target.value)}
                onPressEnter={(e) => loadProductsForBin(card.id, e.target.value)}
                onBlur={(e) => loadProductsForBin(card.id, e.target.value)}
                disabled={card.loading}
                style={{
                  borderRadius: 6,
                  borderColor: card.binStatus === 'valid' ? '#198754' : card.binStatus === 'invalid' ? '#ef4444' : '#d9d9d9',
                  boxShadow: card.binStatus === 'valid' ? '0 0 0 2px rgba(25, 135, 84, 0.1)' : card.binStatus === 'invalid' ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
                }}
              />

              {card.binStatus === 'invalid' && card.binMsg && (
                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CloseCircleFilled /> {card.binMsg}
                </div>
              )}

              {card.loading && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Spin tip="Cargando artículos..." />
                </div>
              )}

              {!card.loading && card.products.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Divider style={{ margin: '12px 0', borderColor: '#e9ecef' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#6c757d', marginBottom: 8 }}>
                    Productos en {card.binCode}
                  </div>
                  
                  {card.products.map((prod, pIdx) => (
                    <Row gutter={8} key={prod.id} style={{ marginBottom: 8, alignItems: 'center' }}>
                      <Col xs={16}>
                        {prod.itemName && <div style={{ fontSize: '0.75rem', color: '#6c757d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{prod.itemName}</div>}
                        <Input
                          prefix={<BarcodeOutlined style={{ color: prod.itemValid === true ? '#16a34a' : prod.itemValid === false ? '#dc2626' : '#6c757d' }} />}
                          placeholder="Artículo / EAN"
                          size="small"
                          value={prod.itemCode}
                          onChange={(e) => updateProductRow(card.id, prod.id, 'itemCode', e.target.value)}
                          onBlur={(e) => validateProductRow(card.id, prod.id, e.target.value)}
                          onPressEnter={(e) => validateProductRow(card.id, prod.id, e.target.value)}
                          style={{
                            borderColor: prod.itemValid === true ? '#16a34a' : prod.itemValid === false ? '#dc2626' : undefined
                          }}
                        />
                      </Col>
                      <Col xs={6}>
                        <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: 2, textAlign: 'center' }}>Ctd.</div>
                        <InputNumber
                          min={0}
                          size="small"
                          style={{ width: '100%' }}
                          value={prod.qty}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.target.select()}
                          onChange={(val) => updateProductRow(card.id, prod.id, 'qty', val)}
                          placeholder="0"
                        />
                      </Col>
                      <Col xs={2} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2 }}>
                        {card.products.length > 1 && (
                          <Button 
                            type="text" 
                            danger 
                            size="small" 
                            icon={<DeleteOutlined />} 
                            onClick={() => removeProductRow(card.id, prod.id)}
                            style={{ padding: 0 }}
                          />
                        )}
                      </Col>
                    </Row>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
