import React, { useState, useEffect } from 'react';
import { Modal, Card, Input, InputNumber, Button, Tag, Typography, Row, Col, Space, Alert, message } from 'antd';
import { SwapOutlined, CheckOutlined, BoxPlotOutlined, EnvironmentOutlined } from '@ant-design/icons';
import client from '../../utils/client';

const { Title, Text } = Typography;

export const SemiPrepareModal = ({ open, document, onClose, onSuccess }) => {
  const [targetBin, setTargetBin] = useState('BIN_SEMI');
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (document && document.LINEAS) {
      const initialQtys = {};
      document.LINEAS.forEach((line, index) => {
        // Inicializa con la cantidad disponible en stock o la cantidad pedida
        const total = line.QUANTITY || 0;
        initialQtys[index] = total;
      });
      setQuantities(initialQtys);
    }
  }, [document]);

  if (!document) return null;

  const handleQtyChange = (index, val) => {
    setQuantities((prev) => ({
      ...prev,
      [index]: val || 0
    }));
  };

  const handleConfirm = async () => {
    if (!targetBin.trim()) {
      message.warning('Ingrese la ubicación destino de semi-preparación');
      return;
    }

    setLoading(true);
    try {
      const preparedLines = (document.LINEAS || [])
        .map((line, index) => ({
          itemcode: line.ITEMCODE,
          quantity: quantities[index] ?? (line.QUANTITY || 0)
        }))
        .filter((l) => l.quantity > 0);

      if (preparedLines.length === 0) {
        message.warning('Debe asignar al menos una cantidad mayor a 0 para semi-preparar');
        setLoading(false);
        return;
      }

      const payload = {
        target_bin: targetBin.trim().toUpperCase(),
        lineas: preparedLines
      };

      const docentry = document.DOCENTRY || document.DocEntry;
      const res = await client.post(`/semipreparar-stock/${docentry}`, payload);

      if (res.status === 'ok' || res.message) {
        message.success(`Pedido #${document.DOCNUM || docentry} semi-preparado trasladado a ubicación ${targetBin.trim().toUpperCase()}`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        message.error(res.message || 'Error al semi-preparar el pedido');
      }
    } catch (err) {
      message.error(err.message || 'Error registrando semi-preparación en SAP Service Layer');
    } finally {
      setLoading(false);
    }
  };

  const lineas = document.LINEAS || [];

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
            <SwapOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
            Semi-Preparar Pedido #{document.DOCNUM || document.DocNum}
          </Title>
          <Text type="secondary" style={{ fontSize: '0.85rem' }}>
            Seleccione la ubicación destino para el traslado de los artículos semi-preparados
          </Text>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={740}
      footer={[
        <Button key="cancel" onClick={onClose} style={{ borderRadius: 6 }}>
          Cancelar
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckOutlined />}
          loading={loading}
          onClick={handleConfirm}
          style={{ backgroundColor: '#ffc107', borderColor: '#ffc107', color: '#000', fontWeight: 700, borderRadius: 6 }}
        >
          Confirmar Semi-Preparación
        </Button>
      ]}
    >
      <div style={{ marginTop: 14 }}>
        {/* Selector / Input de Ubicación Destino */}
        <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#d48806', marginBottom: 6 }}>
            <EnvironmentOutlined style={{ marginRight: 4 }} /> Ubicación Destino de Semi-Preparado (ej: BIN_SEMI / UB-SEMI-01):
          </label>
          <Input
            value={targetBin}
            onChange={(e) => setTargetBin(e.target.value)}
            placeholder="Ingrese código de ubicación destino..."
            size="large"
            style={{ borderRadius: 8, fontWeight: 700, textTransform: 'uppercase' }}
          />
        </div>

        {/* Lista de Líneas de Pedido a Semi-Preparar */}
        <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
          <Row gutter={[12, 12]}>
            {lineas.map((line, idx) => {
              const reqQty = line.QUANTITY || 0;
              const isStockOk = String(line.STOCK_OK || '').toUpperCase() === 'OK';
              return (
                <Col span={24} key={`${line.ITEMCODE}_${idx}`}>
                  <Card
                    styles={{ body: { padding: 14 } }}
                    style={{
                      borderRadius: 10,
                      border: '1px solid #f0f0f0',
                      borderLeft: `4px solid ${isStockOk ? '#fa8c16' : '#ff4d4f'}`,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                    }}
                  >
                    <Row justify="space-between" align="middle" gutter={[8, 8]}>
                      <Col xs={24} sm={14}>
                        <Space direction="vertical" size={2}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937' }}>
                            <BoxPlotOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
                            {line.ITEMCODE}
                          </div>
                          <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                            {line.ITEMNAME || 'Sin descripción'}
                          </Text>
                        </Space>
                      </Col>

                      <Col xs={24} sm={10} style={{ textAlign: 'right' }}>
                        <Space size={8} align="center">
                          <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600, fontSize: '0.8rem' }}>
                            Pedida: {reqQty} u.
                          </Tag>

                          <div style={{ textAlign: 'left' }}>
                            <Text type="secondary" style={{ fontSize: '0.7rem', display: 'block' }}>
                              A Trasladar:
                            </Text>
                            <InputNumber
                              min={0}
                              max={reqQty}
                              value={quantities[idx] ?? reqQty}
                              onChange={(val) => handleQtyChange(idx, val)}
                              style={{ width: 90, borderRadius: 6, fontWeight: 700 }}
                            />
                          </div>
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      </div>
    </Modal>
  );
};
