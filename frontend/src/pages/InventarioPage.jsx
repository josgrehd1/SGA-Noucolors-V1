import React, { useState, useEffect } from 'react';
import { Card, Input, InputNumber, Button, Row, Col, Segmented, message, Spin, Empty, Divider, Space, Modal } from 'antd';
import {
  CheckOutlined, EnvironmentOutlined, BarcodeOutlined, EyeOutlined, EyeInvisibleOutlined,
  PlusOutlined, DeleteOutlined, SaveOutlined
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import client from '../utils/client';

export const InventarioPage = () => {
  const location = useLocation();
  const [isBlindMode, setIsBlindMode] = useState(location.state?.ciego || false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState([{ id: uuidv4(), binCode: '', products: [], loading: false }]);

  useEffect(() => {
    if (location.state?.ciego !== undefined) {
      setIsBlindMode(location.state.ciego);
    }
  }, [location]);

  const addLocationCard = () => {
    setCards([...cards, { id: uuidv4(), binCode: '', products: [], loading: false }]);
  };

  const removeLocationCard = (id) => {
    setCards(cards.filter(c => c.id !== id));
  };

  const updateCardBinCode = (id, value) => {
    setCards(cards.map(c => c.id === id ? { ...c, binCode: value.toUpperCase() } : c));
  };

  const loadProductsForBin = async (id, binCode) => {
    if (!binCode.trim()) return;

    setCards(cards.map(c => c.id === id ? { ...c, loading: true } : c));
    try {
      const res = await client.get(`/get-bin-stock-info/${encodeURIComponent(binCode)}`);
      if (res.datos && Array.isArray(res.datos)) {
        const prods = res.datos.map(p => ({
          id: uuidv4(),
          itemCode: p.ItemCode,
          itemName: p.ItemName || p.ItemDescription || '',
          qty: isBlindMode ? null : p.BINQTY,
          originalQty: p.BINQTY
        }));
        
        setCards(cards.map(c => c.id === id ? { ...c, products: prods.length > 0 ? prods : [{ id: uuidv4(), itemCode: '', itemName: '', qty: null }], loading: false } : c));
      } else {
        // Empty bin
        setCards(cards.map(c => c.id === id ? { ...c, products: [{ id: uuidv4(), itemCode: '', itemName: '', qty: null }], loading: false } : c));
      }
    } catch (error) {
      console.error(error);
      message.error(`Error al cargar productos de la ubicación ${binCode}`);
      setCards(cards.map(c => c.id === id ? { ...c, products: [{ id: uuidv4(), itemCode: '', itemName: '', qty: null }], loading: false } : c));
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

  const executeSubmit = async () => {
    const payload = [];
    
    for (const card of cards) {
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
      message.warning('No hay líneas válidas (Ubicación, Artículo y Cantidad) para contabilizar.');
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
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#212529', margin: 0 }}>
          {isBlindMode ? 'Inventario Ciego' : 'Inventario'}
        </h2>

        <Space wrap>
          <Segmented
            options={[
              { label: 'Normal', value: 'normal', icon: <EyeOutlined /> },
              { label: 'Ciego', value: 'blind', icon: <EyeInvisibleOutlined /> }
            ]}
            value={isBlindMode ? 'blind' : 'normal'}
            onChange={(val) => setIsBlindMode(val === 'blind')}
            size="middle"
          />
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSubmit}
            loading={loading}
            style={{ backgroundColor: '#198754', borderColor: '#198754', fontWeight: 'bold' }}
          >
            Cargar
          </Button>
          <Button 
            type="primary" 
            icon={<EnvironmentOutlined />} 
            onClick={addLocationCard}
          >
            + Ubi
          </Button>
        </Space>
      </div>

      {isBlindMode && (
        <div style={{ marginBottom: 16, backgroundColor: '#fff3cd', border: '1px solid #ffe69c', color: '#664d03', padding: 12, borderRadius: 6, fontSize: '0.85rem' }}>
          <strong>Modo Ciego Activo:</strong> Las cantidades teóricas están ocultas. Deberás introducir la cantidad real contada.
        </div>
      )}

      <Row gutter={[16, 16]}>
        {cards.map((card, idx) => (
          <Col xs={24} md={12} xl={8} key={card.id}>
            <Card 
              style={{ borderRadius: 8, borderTop: '4px solid #0d6efd', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              styles={{ body: { padding: 16 } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontWeight: 600, color: '#495057' }}>Ubicación</label>
                <Space>
                  {card.binCode && !card.loading && (
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
                prefix={<EnvironmentOutlined style={{ color: '#0d6efd' }} />}
                placeholder="Escanear ubicación..."
                size="large"
                value={card.binCode}
                onChange={(e) => updateCardBinCode(card.id, e.target.value)}
                onPressEnter={(e) => loadProductsForBin(card.id, e.target.value)}
                onBlur={(e) => loadProductsForBin(card.id, e.target.value)}
                disabled={card.loading}
                style={{ borderRadius: 6 }}
              />

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
                          prefix={<BarcodeOutlined style={{ color: '#6c757d' }} />}
                          placeholder="Artículo"
                          size="small"
                          value={prod.itemCode}
                          onChange={(e) => updateProductRow(card.id, prod.id, 'itemCode', e.target.value)}
                        />
                      </Col>
                      <Col xs={6}>
                        <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: 2, textAlign: 'center' }}>Ctd.</div>
                        <InputNumber
                          min={0}
                          size="small"
                          style={{ width: '100%' }}
                          value={prod.qty}
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
