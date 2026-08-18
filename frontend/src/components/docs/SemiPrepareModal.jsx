import React, { useState, useEffect } from 'react';
import { Modal, Card, Input, InputNumber, Button, Tag, Typography, Row, Col, Space, Alert, Empty, Spin, message, Tooltip } from 'antd';
import { SwapOutlined, CheckOutlined, BoxPlotOutlined, EnvironmentOutlined, WarningOutlined, ThunderboltOutlined } from '@ant-design/icons';
import client from '../../utils/client';

const { Title, Text } = Typography;

export const SemiPrepareModal = ({ open, document, onClose, onSuccess }) => {
  const [targetBin, setTargetBin] = useState('01-PDTE');
  const [quantities, setQuantities] = useState({});
  const [lines, setLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cargar líneas y verificar stock disponible al abrir el modal
  useEffect(() => {
    if (open && document) {
      const docEntry = document.DOCENTRY || document.DocEntry || document.DOCNUM;
      const objType = document.OBJTYPE || document.ObjType || '17';

      if (docEntry) {
        setLoadingLines(true);
        client.get('/docs/detalle', { params: { docentry: docEntry, objtype: objType } })
          .then((res) => {
            let loaded = [];
            if (res.status === 'ok' && Array.isArray(res.info) && res.info.length > 0) {
              loaded = res.info;
            } else if (res.status === 'ok' && Array.isArray(res.lineas) && res.lineas.length > 0) {
              loaded = res.lineas;
            } else if (Array.isArray(document.LINEAS) && document.LINEAS.length > 0) {
              loaded = document.LINEAS;
            }
            setLines(loaded);

            // Inicializar cantidades inteligentes basadas en disponibilidad de stock
            const initialQtys = {};
            loaded.forEach((line, index) => {
              const reqQty = line.QUANTITY || 0;
              const isStockOk = String(line.STOCK_OK || '').toUpperCase() === 'OK';
              // Si no hay stock disponible, asignar 0 por defecto para evitar errores en el traslado de SAP
              initialQtys[index] = isStockOk ? reqQty : 0;
            });
            setQuantities(initialQtys);
          })
          .catch((err) => {
            console.error('Error cargando detalle para semi-preparación:', err);
            const fallback = document.LINEAS || [];
            setLines(fallback);
            const initialQtys = {};
            fallback.forEach((line, index) => {
              const isStockOk = String(line.STOCK_OK || '').toUpperCase() === 'OK';
              initialQtys[index] = isStockOk ? (line.QUANTITY || 0) : 0;
            });
            setQuantities(initialQtys);
          })
          .finally(() => {
            setLoadingLines(false);
          });
      } else {
        setLines(document.LINEAS || []);
      }
    } else {
      setLines([]);
      setQuantities({});
    }
  }, [open, document]);

  if (!document) return null;

  const handleQtyChange = (index, val) => {
    setQuantities((prev) => ({
      ...prev,
      [index]: val || 0
    }));
  };

  const handleAutoFillAllAvailable = () => {
    const newQtys = {};
    lines.forEach((line, index) => {
      const isStockOk = String(line.STOCK_OK || '').toUpperCase() === 'OK';
      newQtys[index] = isStockOk ? (line.QUANTITY || 0) : 0;
    });
    setQuantities(newQtys);
    message.info('Cantidades ajustadas automáticamente según disponibilidad de stock');
  };

  const handleConfirm = async () => {
    if (!targetBin.trim()) {
      message.warning('Debes indicar la ubicación destino para depositar el material semi-preparado');
      return;
    }

    const preparedLines = lines
      .map((line, index) => ({
        itemcode: line.ITEMCODE,
        quantity: quantities[index] ?? 0
      }))
      .filter((l) => l.quantity > 0);

    if (preparedLines.length === 0) {
      message.warning('No hay ningún artículo con cantidad mayor a 0 para trasladar. Asigna cantidad a los artículos con stock.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        target_bin: targetBin.trim().toUpperCase(),
        lineas: preparedLines
      };

      const docentry = document.DOCENTRY || document.DocEntry || document.DOCNUM;
      const res = await client.post(`/semipreparar-stock/${docentry}`, payload);

      if (res.status === 'ok' || res.message) {
        message.success(`Pedido #${document.DOCNUM || docentry} semi-preparado trasladado a ubicación ${targetBin.trim().toUpperCase()}`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        message.error(res.message || 'Error al semi-preparar el pedido');
      }
    } catch (err) {
      message.error(err.message || 'Error registrando traslado de semi-preparación en SAP');
    } finally {
      setSubmitting(false);
    }
  };

  // Contadores de stock para aviso al operario
  const totalLinesCount = lines.length;
  const outOfStockLinesCount = lines.filter(l => String(l.STOCK_OK || '').toUpperCase() !== 'OK').length;
  const inStockLinesCount = totalLinesCount - outOfStockLinesCount;
  const activeSelectedQtyCount = Object.values(quantities).reduce((acc, q) => acc + (q > 0 ? 1 : 0), 0);

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
            <SwapOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
            Semi-Preparar Pedido #{document.DOCNUM || document.DocNum} ({document.CARDNAME || 'Cliente'})
          </Title>
          <Text type="secondary" style={{ fontSize: '0.85rem' }}>
            Traslada los artículos disponibles desde sus estanterías hacia una ubicación intermedia de preparación
          </Text>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={760}
      footer={[
        <Button key="cancel" onClick={onClose} style={{ borderRadius: 6 }}>
          Cancelar
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckOutlined />}
          loading={submitting}
          disabled={loadingLines || activeSelectedQtyCount === 0}
          onClick={handleConfirm}
          className="sga-semiprep-btn-submit"
          style={{
            backgroundColor: activeSelectedQtyCount > 0 ? '#fa8c16' : '#d9d9d9',
            borderColor: activeSelectedQtyCount > 0 ? '#fa8c16' : '#d9d9d9',
            fontWeight: 700,
            borderRadius: 6
          }}
        >
          Confirmar Semi-Preparación ({activeSelectedQtyCount} {activeSelectedQtyCount === 1 ? 'artículo' : 'artículos'})
        </Button>
      ]}
    >
      <div style={{ marginTop: 14 }}>
        {/* Banner Informativo si faltan artículos con stock */}
        {outOfStockLinesCount > 0 && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined style={{ color: '#d97706' }} />}
            message={
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                {outOfStockLinesCount} de {totalLinesCount} {totalLinesCount === 1 ? 'artículo' : 'artículos'} sin stock suficiente en almacén
              </span>
            }
            description={
              <div style={{ fontSize: '0.82rem', color: '#78350f' }}>
                Las líneas sin stock se han establecido en <strong>0 uds</strong> para que puedas trasladar únicamente el material disponible ({inStockLinesCount} {inStockLinesCount === 1 ? 'artículo' : 'artículos'}).
              </div>
            }
            style={{ marginBottom: 14, borderRadius: 8, backgroundColor: '#fffbeb', borderColor: '#fde68a' }}
          />
        )}

        {/* Selector / Input de Ubicación Destino */}
        <div className="sga-semiprep-target-box" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label className="sga-semiprep-target-label" style={{ fontWeight: 700, fontSize: '0.85rem', color: '#374151' }}>
              <EnvironmentOutlined style={{ marginRight: 4, color: '#0d6efd' }} /> Ubicación Destino Intermedia:
            </label>
            {inStockLinesCount > 0 && (
              <Button
                size="small"
                type="link"
                icon={<ThunderboltOutlined />}
                onClick={handleAutoFillAllAvailable}
                style={{ padding: 0, fontSize: '0.8rem', fontWeight: 600 }}
              >
                Auto-completar stock disponible
              </Button>
            )}
          </div>
          <Input
            value={targetBin}
            onChange={(e) => setTargetBin(e.target.value)}
            placeholder="Código de ubicación destino (ej: 01-PDTE, BIN_SEMI, MESA-01)..."
            size="large"
            className="sga-semiprep-target-input"
            style={{ borderRadius: 8, fontWeight: 600 }}
          />
        </div>

        {/* Lista de Líneas de Pedido a Semi-Preparar */}
        <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
          {loadingLines ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin tip="Comprobando artículos y existencias en SAP..." />
            </div>
          ) : lines.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '30px 0', borderRadius: 10 }}>
              <Empty description="No se encontraron artículos en este pedido para semi-preparar" />
            </Card>
          ) : (
            <Row gutter={[12, 12]}>
              {lines.map((line, idx) => {
                const reqQty = line.QUANTITY || 0;
                const isStockOk = String(line.STOCK_OK || '').toUpperCase() === 'OK';
                const currentQty = quantities[idx] ?? 0;
                const defaultBin = line.BIN_STD || 'Sin Ubi';
                const whsCode = line.WHSCODE || '01';

                return (
                  <Col span={24} key={`${line.ITEMCODE}_${idx}`}>
                    <Card
                      styles={{ body: { padding: 14 } }}
                      style={{
                        borderRadius: 10,
                        border: `1px solid ${isStockOk ? '#fed7aa' : '#fee2e2'}`,
                        borderLeft: `5px solid ${isStockOk ? '#fa8c16' : '#ef4444'}`,
                        backgroundColor: isStockOk ? '#ffffff' : '#fef2f2',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <Row justify="space-between" align="middle" gutter={[8, 8]}>
                        <Col xs={24} sm={14}>
                          <Space direction="vertical" size={2}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>
                                <BoxPlotOutlined style={{ marginRight: 4, color: isStockOk ? '#fa8c16' : '#ef4444' }} />
                                {line.ITEMCODE}
                              </span>
                              <Tag color={isStockOk ? 'green' : 'red'} style={{ margin: 0, fontWeight: 700, fontSize: '0.72rem' }}>
                                {isStockOk ? 'En Stock' : 'Sin Stock'}
                              </Tag>
                              <Tag style={{ margin: 0, fontSize: '0.72rem' }}>
                                Alm: {whsCode} | {defaultBin}
                              </Tag>
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
                              <Text type="secondary" style={{ fontSize: '0.7rem', display: 'block', fontWeight: 600 }}>
                                A Trasladar:
                              </Text>
                              <InputNumber
                                min={0}
                                max={reqQty}
                                value={currentQty}
                                onChange={(val) => handleQtyChange(idx, val)}
                                className="sga-semiprep-qty-input"
                                style={{
                                  width: 80,
                                  borderRadius: 6,
                                  borderColor: currentQty > 0 ? '#fa8c16' : '#d9d9d9',
                                  fontWeight: 700
                                }}
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
          )}
        </div>
      </div>
    </Modal>
  );
};
