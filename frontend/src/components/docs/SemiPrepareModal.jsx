import React, { useState, useEffect } from 'react';
import { Modal, Card, Input, InputNumber, Button, Tag, Typography, Row, Col, Space, Alert, Empty, Spin, message, Tooltip } from 'antd';
import {
  SwapOutlined,
  CheckOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  BoxPlotOutlined,
  EnvironmentOutlined,
  WarningOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import client from '../../utils/client';

const { Title, Text } = Typography;

export const SemiPrepareModal = ({ open, document, onClose, onSuccess }) => {
  const [targetBin, setTargetBin] = useState('01-PDTE');
  const [isBinValid, setIsBinValid] = useState(null);
  const [validatingBin, setValidatingBin] = useState(false);
  const [binMsg, setBinMsg] = useState('');
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

            // Inicializar todas las cantidades en 0 por defecto para que el operario solo indique las que traslada
            const initialQtys = {};
            loaded.forEach((line, index) => {
              initialQtys[index] = 0;
            });
            setQuantities(initialQtys);
          })
          .catch((err) => {
            console.error('Error cargando detalle para semi-preparación:', err);
            const fallback = document.LINEAS || [];
            setLines(fallback);
            const initialQtys = {};
            fallback.forEach((line, index) => {
              initialQtys[index] = 0;
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

  const executeSemiPrepare = async (preparedLines) => {
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

  const handleConfirm = () => {
    if (!targetBin.trim()) {
      message.warning('Debes indicar la ubicación destino para depositar el material semi-preparado');
      return;
    }

    const preparedLines = lines
      .map((line, index) => ({
        itemcode: line.ITEMCODE,
        itemname: line.ITEMNAME,
        quantity: quantities[index] ?? 0,
        whscode: line.WHSCODE || '01',
        bin_std: line.BIN_STD || 'Sin Ubi'
      }))
      .filter((l) => l.quantity > 0);

    if (preparedLines.length === 0) {
      message.warning('No hay ningún artículo con cantidad mayor a 0 para trasladar. Asigna cantidad a los artículos con stock.');
      return;
    }

    const destBin = targetBin.trim().toUpperCase();

    Modal.confirm({
      title: '¿Confirmar Semi-Preparación del Pedido?',
      width: 550,
      okText: 'Sí, trasladar a SAP',
      cancelText: 'Volver y revisar',
      okButtonProps: {
        style: { backgroundColor: '#fa8c16', borderColor: '#fa8c16', fontWeight: 700 }
      },
      content: (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 12, padding: '8px 12px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: '0.85rem' }}>
            <span>Ubicación destino intermedia: </span>
            <strong style={{ color: '#ea580c' }}>📍 {destBin}</strong>
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, color: '#374151' }}>
            Artículos y cantidades seleccionadas ({preparedLines.length}):
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 8, backgroundColor: '#fafafa' }}>
            {preparedLines.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderBottom: idx === preparedLines.length - 1 ? 'none' : '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  borderRadius: 6,
                  marginBottom: 4
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ backgroundColor: '#0d6efd', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                      {item.itemcode}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      (Alm: {item.whscode})
                    </span>
                  </div>
                  {item.itemname && (
                    <div style={{ fontSize: '0.78rem', color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.itemname}
                    </div>
                  )}
                </div>
                <Tag color="orange" style={{ fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
                  {item.quantity} u.
                </Tag>
              </div>
            ))}
          </div>
        </div>
      ),
      onOk: () => executeSemiPrepare(preparedLines.map(l => ({ itemcode: l.itemcode, quantity: l.quantity })))
    });
  };

  // Contadores de stock para aviso al operario
  const totalLinesCount = lines.length;
  const outOfStockLinesCount = lines.filter(l => String(l.STOCK_OK || '').toUpperCase() !== 'OK').length;
  const inStockLinesCount = totalLinesCount - outOfStockLinesCount;
  const activeSelectedQtyCount = Object.values(quantities).reduce((acc, q) => acc + (q > 0 ? 1 : 0), 0);

  const handleTargetBinChange = async (val) => {
    const uppercaseVal = (val || '').toUpperCase();
    setTargetBin(uppercaseVal);
    const clean = uppercaseVal.trim();
    if (!clean) {
      setIsBinValid(null);
      setBinMsg('');
      setValidatingBin(false);
      return;
    }
    setValidatingBin(true);
    try {
      const res = await client.get(`/ubicacion-existe/${encodeURIComponent(clean)}`);
      if (res.existe) {
        setIsBinValid(true);
        setBinMsg('Ubicación destino válida');
      } else {
        setIsBinValid(false);
        setBinMsg(res.message || 'La ubicación no existe en SAP');
      }
    } catch {
      setIsBinValid(false);
      setBinMsg('Error comprobando ubicación');
    } finally {
      setValidatingBin(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ paddingBottom: 6 }}>
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
          disabled={loadingLines || activeSelectedQtyCount === 0 || isBinValid === false || validatingBin}
          onClick={handleConfirm}
          className="sga-semiprep-btn-submit"
          style={{
            backgroundColor: activeSelectedQtyCount > 0 && isBinValid !== false ? '#fa8c16' : '#d9d9d9',
            borderColor: activeSelectedQtyCount > 0 && isBinValid !== false ? '#fa8c16' : '#d9d9d9',
            fontWeight: 700,
            borderRadius: 6
          }}
        >
          Confirmar ({activeSelectedQtyCount} {activeSelectedQtyCount === 1 ? 'artículo' : 'artículos'})
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
            onChange={(e) => handleTargetBinChange(e.target.value)}
            placeholder="Código de ubicación destino (ej: 01-PDTE, BIN_SEMI, MESA-01)..."
            size="large"
            className="sga-semiprep-target-input"
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
              fontWeight: 600,
              borderColor: isBinValid === true ? '#198754' : isBinValid === false ? '#ef4444' : '#d9d9d9',
              boxShadow: isBinValid === true ? '0 0 0 2px rgba(25, 135, 84, 0.1)' : isBinValid === false ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
            }}
          />
          {binMsg && (
            <div style={{
              marginTop: 4,
              fontSize: '0.8rem',
              fontWeight: 700,
              color: isBinValid ? '#198754' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {isBinValid ? <CheckCircleFilled /> : <CloseCircleFilled />}
              {binMsg}
            </div>
          )}
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
                              <Space.Compact>
                                <InputNumber
                                  min={0}
                                  max={reqQty}
                                  value={currentQty}
                                  onFocus={(e) => e.target.select()}
                                  onClick={(e) => e.target.select()}
                                  onChange={(val) => handleQtyChange(idx, val)}
                                  className="sga-semiprep-qty-input"
                                  style={{
                                    width: 75,
                                    borderRadius: '6px 0 0 6px',
                                    borderColor: currentQty > 0 ? '#fa8c16' : '#d9d9d9',
                                    fontWeight: 700
                                  }}
                                />
                                <Tooltip title={`Rellenar todo (${reqQty} u.)`}>
                                  <Button
                                    icon={<ThunderboltOutlined />}
                                    onClick={() => handleQtyChange(idx, reqQty)}
                                    style={{
                                      borderRadius: '0 6px 6px 0',
                                      backgroundColor: '#fff7ed',
                                      borderColor: currentQty > 0 ? '#fa8c16' : '#d9d9d9',
                                      color: '#ea580c'
                                    }}
                                  />
                                </Tooltip>
                              </Space.Compact>
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
