import React, { useState, useEffect } from 'react';
import { Modal, Button, InputNumber, Typography, Tag, Divider, Row, Col, Space } from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

const { Text } = Typography;

export const MultiBinDistributionModal = ({
  open,
  onClose,
  itemCode,
  itemName,
  totalQty,
  primaryBin,
  primaryAvailable,
  allBinsWithStock, // [{ bincode, onhandqty, binabs }]
  onConfirm
}) => {
  const [allocations, setAllocations] = useState({});

  useEffect(() => {
    if (open) {
      // 1. Asignar por defecto el stock disponible de la ubicación principal
      const initPrimaryQty = Math.min(primaryAvailable || 0, totalQty || 0);
      const initialMap = {
        [primaryBin]: initPrimaryQty
      };

      let remaining = Math.max(0, (totalQty || 0) - initPrimaryQty);

      // 2. Repartir automáticamente el restante entre las demás ubicaciones con stock
      (allBinsWithStock || []).forEach(b => {
        if (b.bincode !== primaryBin && (b.onhandqty || 0) > 0) {
          if (remaining > 0) {
            const take = Math.min(remaining, b.onhandqty);
            initialMap[b.bincode] = take;
            remaining -= take;
          } else {
            initialMap[b.bincode] = 0;
          }
        }
      });

      setAllocations(initialMap);
    }
  }, [open, itemCode, totalQty, primaryBin, primaryAvailable, allBinsWithStock]);

  const handleQtyChange = (bincode, val) => {
    setAllocations(prev => ({
      ...prev,
      [bincode]: val === null ? 0 : Number(val)
    }));
  };

  const handleQuickFillRemaining = (bincode, maxAvail) => {
    // Calcular cuánto falta por cubrir sin contar esta ubicación
    const otherSum = Object.entries(allocations)
      .filter(([k]) => k !== bincode)
      .reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
    
    const needed = Math.max(0, totalQty - otherSum);
    const toFill = Math.min(needed, maxAvail);

    setAllocations(prev => ({
      ...prev,
      [bincode]: toFill
    }));
  };

  // Calcular totales
  const totalAssigned = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const remainingQty = totalQty - totalAssigned;
  const isComplete = Math.abs(remainingQty) < 0.0001;

  const handleSave = () => {
    if (!isComplete) return;

    // Convertir el mapa de asignaciones a la lista final de ubicaciones con cantidad > 0
    const finalAllocations = Object.entries(allocations)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([bincode, qty]) => ({
        bincode,
        quantity: Number(qty)
      }));

    if (finalAllocations.length === 0) return;

    onConfirm(finalAllocations);
    onClose();
  };

  // Combinar lista de ubicaciones asegurando que la principal aparezca primero
  const binsList = [];
  if (primaryBin) {
    binsList.push({
      bincode: primaryBin,
      onhandqty: primaryAvailable || 0,
      isPrimary: true
    });
  }

  (allBinsWithStock || []).forEach(b => {
    if (b.bincode && b.bincode !== primaryBin && (b.onhandqty || 0) > 0) {
      binsList.push({
        bincode: b.bincode,
        onhandqty: b.onhandqty,
        isPrimary: false
      });
    }
  });

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <AppstoreOutlined style={{ color: '#d97706', fontSize: '1.25rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
              Reparto de Stock Multi-Ubicación
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
              Indica la cantidad a extraer de cada estantería disponible
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={620}
      footer={[
        <Button key="cancel" onClick={onClose} size="large" style={{ borderRadius: 8, fontWeight: 600 }}>
          Cancelar
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleSave}
          disabled={!isComplete}
          size="large"
          style={{
            backgroundColor: isComplete ? '#10b981' : '#9ca3af',
            borderColor: isComplete ? '#10b981' : '#9ca3af',
            borderRadius: 8,
            fontWeight: 800,
            padding: '0 24px',
            boxShadow: isComplete ? '0 4px 12px rgba(16, 185, 129, 0.3)' : undefined
          }}
        >
          Confirmar Reparto ({totalAssigned}/{totalQty} uds)
        </Button>
      ]}
      style={{ top: 20 }}
      styles={{ body: { padding: '8px 0' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Resumen del Artículo (Tarjeta Compacta Responsive) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Text type="secondary" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, display: 'block' }}>
                Artículo a Preparar:
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem', margin: 0 }}>
                  {itemCode}
                </Tag>
                <Text strong style={{ fontSize: '0.92rem', color: '#0f172a' }} className="text-truncate">
                  {itemName}
                </Text>
              </div>
            </div>

            <div style={{ textAlign: 'right', background: '#ffffff', padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <Text type="secondary" style={{ fontSize: '0.72rem', display: 'block', fontWeight: 600 }}>Total Pedido:</Text>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563eb' }}>{totalQty} <span style={{ fontSize: '0.8rem' }}>uds</span></span>
            </div>
          </div>
        </div>

        {/* Lista de Ubicaciones con Stock Disponibles */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 2px' }}>
            <Text strong style={{ color: '#334155', fontSize: '0.88rem' }}>
              <EnvironmentOutlined style={{ marginRight: 6, color: '#0284c7' }} /> Ubicaciones con Stock Físico:
            </Text>
            <Text type="secondary" style={{ fontSize: '0.78rem' }}>
              {binsList.length} ubicaciones encontradas
            </Text>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '42vh', overflowY: 'auto', paddingRight: 2 }}>
            {binsList.map((b) => {
              const currentVal = allocations[b.bincode] ?? 0;
              const isSelected = currentVal > 0;

              return (
                <div
                  key={b.bincode}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '12px 14px',
                    background: b.isPrimary ? '#fffdf5' : (isSelected ? '#f0fdf4' : '#ffffff'),
                    border: `1.5px solid ${b.isPrimary ? '#fcd34d' : (isSelected ? '#86efac' : '#e2e8f0')}`,
                    borderRadius: 10,
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.03)' : 'none'
                  }}
                >
                  <Row gutter={[12, 10]} align="middle">
                    {/* Columna Izquierda: Ubicación y Stock Disponible */}
                    <Col xs={24} sm={13}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'monospace', color: '#1e293b' }}>
                          📍 {b.bincode}
                        </span>
                        {b.isPrimary && (
                          <Tag color="warning" style={{ fontWeight: 800, fontSize: '0.72rem', borderRadius: 4 }}>
                            Apartada / Principal
                          </Tag>
                        )}
                      </div>
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Stock en ubicación:</span>
                        <Tag style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontWeight: 700, color: '#334155', borderRadius: 4 }}>
                          {b.onhandqty} uds
                        </Tag>
                      </div>
                    </Col>

                    {/* Columna Derecha: Selector Numérico Touch + Botón Rellenar Restante */}
                    <Col xs={24} sm={11}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <div style={{ flex: 1, maxWidth: 150 }}>
                          <InputNumber
                            min={0}
                            max={b.onhandqty}
                            step={1}
                            value={currentVal}
                            onChange={(val) => handleQtyChange(b.bincode, val)}
                            size="large"
                            style={{
                              width: '100%',
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: '1rem',
                              borderColor: currentVal > 0 ? '#10b981' : '#cbd5e1'
                            }}
                            addonAfter="uds"
                          />
                        </div>
                        {!b.isPrimary && b.onhandqty > 0 && (
                          <Button
                            type="dashed"
                            size="middle"
                            icon={<ThunderboltOutlined />}
                            onClick={() => handleQuickFillRemaining(b.bincode, b.onhandqty)}
                            title="Rellenar lo que falta para completar el pedido"
                            style={{
                              borderRadius: 8,
                              borderColor: '#93c5fd',
                              color: '#2563eb',
                              fontWeight: 700,
                              height: 40,
                              padding: '0 10px'
                            }}
                          >
                            Restante
                          </Button>
                        )}
                      </div>
                    </Col>
                  </Row>
                </div>
              );
            })}
          </div>
        </div>

        {/* Barra de Validación de Suma Total Responsive */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            padding: '12px 16px',
            background: isComplete ? '#f0fdf4' : '#fef2f2',
            border: `1.5px solid ${isComplete ? '#86efac' : '#fca5a5'}`,
            borderRadius: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isComplete ? (
              <CheckCircleOutlined style={{ color: '#16a34a', fontSize: '1.2rem' }} />
            ) : (
              <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: '1.2rem' }} />
            )}
            <Text strong style={{ color: isComplete ? '#166534' : '#991b1b', fontSize: '0.9rem' }}>
              {isComplete ? (
                'Reparto Completo y Cuadrado'
              ) : remainingQty > 0 ? (
                `Faltan ${remainingQty} uds por asignar`
              ) : (
                `Exceso de ${Math.abs(remainingQty)} uds asignadas`
              )}
            </Text>
          </div>

          <div>
            <Text strong style={{ fontSize: '1.05rem', color: isComplete ? '#166534' : '#991b1b' }}>
              Asignado: {totalAssigned} / {totalQty} uds
            </Text>
          </div>
        </div>
      </div>
    </Modal>
  );
};
