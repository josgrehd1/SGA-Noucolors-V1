import React, { useState } from 'react';
import { Modal, Card, Tag, Typography, Button, Row, Col, Space, Input, InputNumber, Select, Tooltip, message } from 'antd';
import {
  SwapOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  PrinterOutlined,
  ShopOutlined,
  EditOutlined,
  ThunderboltOutlined,
  ArrowLeftOutlined,
  BarcodeOutlined,
  CheckOutlined
} from '@ant-design/icons';
import client from '../../utils/client';

const { Text } = Typography;

// Helper robusto para obtener el código de ubicación independiente de mayúsculas/minúsculas de la vista SAP
const getBinCode = (u) => {
  if (typeof u === 'string') return u;
  if (!u) return '';
  return u.bincode || u.BinCode || u.BINCODE || u.bin_code || u.code || u.WhsCode || u.WHSCODE || '';
};

// Helper robusto para obtener la cantidad en ubicación
const getBinQty = (u) => {
  if (typeof u === 'string') return 0;
  if (!u) return 0;
  return u.onhandqty ?? u.BINQTY ?? u.SNQTY ?? u.on_hand_qty ?? u.qty ?? u.count ?? u.Cantidad ?? 0;
};

export const DocumentDetailModal = ({ open, document, onClose, onSuccess, onOpenSemiPrepare }) => {
  const [bultos, setBultos] = useState(1);
  const [printingBultos, setPrintingBultos] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Estado para preparar cantidades por línea
  const [preparedQtys, setPreparedQtys] = useState({});
  const [selectedBins, setSelectedBins] = useState({});
  const [scannedItems, setScannedItems] = useState({});

  // Modal para cambiar ubicación por defecto
  const [binModalVisible, setBinModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newBinCode, setNewBinCode] = useState('');
  const [savingBin, setSavingBin] = useState(false);

  if (!document) return null;

  const lineas = document.LINEAS || [];

  const handlePrintBultos = async () => {
    setPrintingBultos(true);
    try {
      const res = await client.post('/print/bultos', {
        entryPedido: document.DOCENTRY || document.DOCNUM,
        numBultos: bultos
      });
      if (res.status === 'ok') {
        message.success(res.message || `${bultos} etiqueta(s) de bulto enviada(s) a la impresora`);
      } else {
        message.error(res.message || 'Error imprimiendo etiquetas de bulto');
      }
    } catch (err) {
      message.error(err.message || 'Error enviando petición de impresión de bultos');
    } finally {
      setPrintingBultos(false);
    }
  };

  const handleSemiPreparar = () => {
    onClose();
    if (onOpenSemiPrepare) {
      onOpenSemiPrepare(document);
    }
  };

  const handleFinalizar = async () => {
    setFinishing(true);
    try {
      const objType = document.OBJTYPE || '17';
      const res = await client.post(`/finalizar-preparacion/${objType}/${document.DOCENTRY}`);
      if (res.status === 'ok' || res.message) {
        message.success(res.message || `Preparación del pedido #${document.DOCNUM || document.DOCENTRY} finalizada con éxito en SAP`);
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(res.message || 'Error al finalizar preparación del pedido');
      }
    } catch (err) {
      message.error(err.message || 'Error en comunicación con SAP Service Layer');
    } finally {
      setFinishing(false);
    }
  };

  const handlePrintItemLabel = async (line) => {
    try {
      const res = await client.post('/print/articulo', {
        itemcode: line.ITEMCODE,
        itemname: line.ITEMNAME
      });
      message.success(`Etiqueta enviada para artículo ${line.ITEMCODE}`);
    } catch (err) {
      message.info(`Imprimiendo etiqueta de artículo ${line.ITEMCODE}`);
    }
  };

  const handlePrintBinLabel = async (bincode) => {
    try {
      const res = await client.post('/print/ubicacion', { bincode });
      message.success(`Etiqueta enviada para ubicación ${bincode}`);
    } catch (err) {
      message.info(`Imprimiendo etiqueta de ubicación ${bincode}`);
    }
  };

  const handleAutoFillQty = (idx, totalQty) => {
    setPreparedQtys((prev) => ({
      ...prev,
      [idx]: totalQty
    }));
  };

  const handleAutoFillItemCode = (idx, itemCode) => {
    setScannedItems((prev) => ({
      ...prev,
      [idx]: itemCode
    }));
  };

  const handleOpenChangeBinModal = (line) => {
    setEditingItem(line);
    setNewBinCode(line.BIN_STD || '');
    setBinModalVisible(true);
  };

  const handleSaveDefaultBin = async () => {
    if (!editingItem || !newBinCode.trim()) {
      message.warning('Ingrese un código de ubicación válido');
      return;
    }
    setSavingBin(true);
    try {
      const res = await client.post('/docs/change-default-bin', {
        whscode: editingItem.WHSCODE || '01',
        itemcode: editingItem.ITEMCODE,
        new_bin: newBinCode.trim()
      });
      if (res.status === 'ok') {
        message.success(`Ubicación por defecto actualizada a ${newBinCode}`);
        editingItem.BIN_STD = newBinCode.trim();
        setBinModalVisible(false);
      } else {
        message.error(res.message || 'Error actualizando ubicación por defecto');
      }
    } catch (err) {
      message.error(err.message || 'Error al guardar la ubicación por defecto');
    } finally {
      setSavingBin(false);
    }
  };

  const handleConfirmLine = (idx, line) => {
    const scanned = scannedItems[idx] || '';
    const targetBin = selectedBins[idx] || line.BIN_STD;

    if (scanned.trim().toUpperCase() !== (line.ITEMCODE || '').toUpperCase()) {
      message.error(`El artículo escaneado no coincide con ${line.ITEMCODE}`);
      return;
    }

    message.success(`Línea ${line.ITEMCODE} verificada correctamente en ubicación ${targetBin}`);
  };

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 6 }}>
            {/* Título Exacto Proyecto Original: Detalle Pedido {DOCNUM} ({CARDNAME}) */}
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>
              Detalle Pedido {document.DOCNUM || document.DOCENTRY} ({document.CARDNAME || 'Sin Asignar'})
            </div>

            {/* Barra de Acciones del Encabezado (Num Bultos, Imp, Semi, Finalizar, Volver) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8 }}>
              {/* Input Num Bultos + Botón Imp */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6c757d', marginBottom: 2 }}>
                  Num Bultos
                </span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #d9d9d9',
                      borderRight: 'none',
                      borderRadius: '6px 0 0 6px',
                      padding: '4px 8px',
                      fontSize: 13,
                      color: '#6c757d'
                    }}
                  >
                    📦
                  </div>
                  <InputNumber
                    min={1}
                    max={99}
                    value={bultos}
                    onChange={(v) => setBultos(v || 1)}
                    style={{
                      width: 55,
                      borderRadius: 0,
                      textAlign: 'center',
                      fontWeight: 700
                    }}
                  />
                  <Button
                    type="primary"
                    loading={printingBultos}
                    onClick={handlePrintBultos}
                    style={{
                      borderRadius: '0 6px 6px 0',
                      backgroundColor: '#0d6efd',
                      borderColor: '#0d6efd',
                      fontWeight: 700,
                      padding: '0 10px'
                    }}
                  >
                    Imp
                  </Button>
                </div>
              </div>

              {/* Botón Semi */}
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSemiPreparar}
                style={{
                  backgroundColor: '#ffc107',
                  borderColor: '#ffc107',
                  color: '#000',
                  fontWeight: 700,
                  borderRadius: 6
                }}
              >
                Semi
              </Button>

              {/* Botón Finalizar */}
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={finishing}
                onClick={handleFinalizar}
                style={{
                  backgroundColor: '#198754',
                  borderColor: '#198754',
                  color: '#fff',
                  fontWeight: 700,
                  borderRadius: 6
                }}
              >
                Finalizar
              </Button>

              {/* Botón Volver */}
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={onClose}
                style={{
                  borderColor: '#0d6efd',
                  color: '#0d6efd',
                  fontWeight: 600,
                  borderRadius: 6
                }}
              >
                Volver
              </Button>
            </div>
          </div>
        }
        open={open}
        onCancel={onClose}
        width={780}
        footer={null}
        styles={{ body: { padding: '16px' } }}
      >
        {/* ── CONTENEDOR DE TARJETAS DE LÍNEAS ── */}
        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
          <Row gutter={[16, 16]}>
            {lineas.map((line, idx) => {
              const total = line.QUANTITY || 0;
              const preparada = preparedQtys[idx] ?? (line.CTD_PREPARADA || 0);
              const isStockOk = String(line.STOCK_OK || '').toUpperCase() === 'OK';
              const defaultBin = line.BIN_STD || 'Sin Ubi';
              const whsCode = line.WHSCODE || '01';

              let ubisList = [];
              if (Array.isArray(line.UBICACIONES)) {
                ubisList = line.UBICACIONES;
              } else if (typeof line.UBICACIONES === 'string') {
                try {
                  ubisList = JSON.parse(line.UBICACIONES);
                } catch (e) {
                  ubisList = [];
                }
              }

              // Verificación de Escaneo de Artículo
              const scannedVal = (scannedItems[idx] || '').trim().toUpperCase();
              const isItemVerified = scannedVal === (line.ITEMCODE || '').toUpperCase();

              // Opciones del selector de ubicaciones (Solo el código de ubicación limpio)
              const binOptions = ubisList.map((u) => {
                const code = getBinCode(u);
                return {
                  value: code,
                  label: code
                };
              }).filter((opt) => !!opt.value);

              if (binOptions.length === 0 && defaultBin && defaultBin !== 'Sin Ubi') {
                binOptions.push({
                  value: defaultBin,
                  label: defaultBin
                });
              }

              const currentBin = selectedBins[idx] || binOptions[0]?.value || defaultBin;

              // Verificación de Ubicación Seleccionada
              const isBinVerified = !!currentBin && (
                binOptions.some((opt) => opt.value.toUpperCase() === currentBin.toUpperCase()) ||
                currentBin.toUpperCase() === defaultBin.toUpperCase()
              );

              return (
                <Col xs={24} sm={24} md={12} key={`${line.ITEMCODE}_${idx}`}>
                  <Card
                    styles={{ body: { padding: 16 } }}
                    style={{
                      borderRadius: 14,
                      border: '1px solid #e5e7eb',
                      borderTop: `4px solid ${isStockOk ? '#0d6efd' : '#dc3545'}`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                      height: '100%'
                    }}
                  >
                    {/* 1. BADGES DE ENCABEZADO (ITEMCODE | Alm | Ubi Defecto Edit) */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      <span
                        style={{
                          backgroundColor: '#e5e7eb',
                          color: '#1f2937',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          fontSize: '0.82rem',
                          padding: '3px 10px',
                          borderRadius: 20
                        }}
                      >
                        {line.ITEMCODE}
                      </span>

                      <span
                        style={{
                          backgroundColor: '#e5e7eb',
                          color: '#4b5563',
                          fontSize: '0.8rem',
                          padding: '3px 10px',
                          borderRadius: 20
                        }}
                      >
                        <ShopOutlined style={{ marginRight: 4 }} /> Alm: {whsCode}
                      </span>

                      <span
                        onClick={() => handleOpenChangeBinModal(line)}
                        style={{
                          backgroundColor: '#e0edff',
                          color: '#0d6efd',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          padding: '3px 10px',
                          borderRadius: 20,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <EnvironmentOutlined /> {defaultBin} <EditOutlined style={{ fontSize: '0.75rem' }} />
                      </span>
                    </div>

                    {/* 2. NOMBRE DEL ARTÍCULO */}
                    <div style={{ fontWeight: 800, color: '#111827', fontSize: '1rem', marginBottom: 14, lineHeight: 1.3 }}>
                      {line.ITEMNAME || 'Sin descripción'}
                    </div>

                    {/* 3. CAJA CANTIDAD PREPARADA / TOTAL (ESTILO ORIGINAL AZUL) */}
                    <div
                      style={{
                        backgroundColor: '#dbeafe',
                        borderRadius: 12,
                        padding: '12px 16px',
                        textAlign: 'center',
                        marginBottom: 16
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: '#4b5563',
                          letterSpacing: '0.5px',
                          marginBottom: 6,
                          textTransform: 'uppercase'
                        }}
                      >
                        CANTIDAD PREPARADA / TOTAL
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <div
                          style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 8,
                            padding: '2px 14px',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)'
                          }}
                        >
                          <InputNumber
                            min={0}
                            max={total}
                            value={preparada}
                            onChange={(val) => setPreparedQtys({ ...preparedQtys, [idx]: val || 0 })}
                            controls={false}
                            bordered={false}
                            style={{
                              width: 50,
                              fontSize: '1.6rem',
                              fontWeight: 800,
                              color: '#0d6efd',
                              textAlign: 'center'
                            }}
                          />
                        </div>

                        <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1d4ed8' }}>/</span>

                        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1d4ed8' }}>
                          {total}
                        </span>

                        <span style={{ fontSize: '1rem', color: '#1d4ed8', fontWeight: 600 }}>uds</span>

                        <Tooltip title="Completar cantidad total">
                          <ThunderboltOutlined
                            onClick={() => handleAutoFillQty(idx, total)}
                            style={{
                              fontSize: 20,
                              color: '#0d6efd',
                              cursor: 'pointer',
                              marginLeft: 4
                            }}
                          />
                        </Tooltip>
                      </div>
                    </div>

                    {/* 4. STOCK DISPONIBLE POR UBICACIÓN / SERIE */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4b5563', marginBottom: 6 }}>
                        📦 STOCK DISPONIBLE POR SERIE / UBICACIÓN
                      </div>

                      <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 4, marginBottom: 4, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>
                        <span>Ubicación / Nº Serie</span>
                        <span>Cant.</span>
                      </div>

                      {ubisList.length > 0 ? (
                        ubisList.map((u, uIdx) => {
                          const code = getBinCode(u);
                          const qty = getBinQty(u);
                          return (
                            <div
                              key={uIdx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '4px 0',
                                fontSize: '0.82rem',
                                borderBottom: '1px dashed #f3f4f6'
                              }}
                            >
                              <span style={{ fontWeight: 600, color: '#1f2937' }}>
                                {code || 'General'}
                              </span>
                              <span style={{ fontWeight: 700, color: '#0d6efd' }}>
                                {qty}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic', padding: '4px 0' }}>
                          Sin ubicaciones registradas con stock
                        </div>
                      )}
                    </div>

                    {/* 5. PASO 1: Escanear Artículo */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        1. Escanear Artículo
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Input
                            prefix={<BarcodeOutlined style={{ color: '#9ca3af' }} />}
                            suffix={
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {isItemVerified && (
                                  <CheckOutlined style={{ color: '#198754', fontWeight: 800, fontSize: 16 }} />
                                )}
                                <Tooltip title="Autorellenar artículo para gestión rápida">
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<SwapOutlined style={{ color: '#ffffff', fontSize: 14 }} />}
                                    onClick={() => handleAutoFillItemCode(idx, line.ITEMCODE)}
                                    style={{
                                      backgroundColor: '#6c757d',
                                      borderRadius: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '2px 6px'
                                    }}
                                  />
                                </Tooltip>
                              </div>
                            }
                            placeholder="Escanear código de barras..."
                            value={scannedItems[idx] || ''}
                            onChange={(e) => setScannedItems({ ...scannedItems, [idx]: e.target.value })}
                            size="large"
                            style={{
                              borderRadius: 8,
                              borderColor: isItemVerified ? '#198754' : '#d9d9d9'
                            }}
                          />
                        </div>

                        {isItemVerified && (
                          <CheckCircleFilled style={{ color: '#198754', fontSize: 24, flexShrink: 0 }} />
                        )}

                        <Button
                          icon={<PrinterOutlined />}
                          onClick={() => handlePrintItemLabel(line)}
                          size="large"
                          style={{ borderRadius: 8, borderColor: '#d9d9d9', flexShrink: 0 }}
                        />
                      </div>
                    </div>

                    {/* 6. PASO 2: Seleccionar Ubicación */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        2. Seleccionar Ubicacion
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Select
                            showSearch
                            placeholder="Seleccionar ubicación..."
                            value={currentBin}
                            onChange={(val) => setSelectedBins({ ...selectedBins, [idx]: val })}
                            size="large"
                            style={{ width: '100%', borderRadius: 8 }}
                            options={binOptions}
                            suffixIcon={
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {isBinVerified && (
                                  <CheckOutlined style={{ color: '#198754', fontWeight: 800, fontSize: 16 }} />
                                )}
                              </div>
                            }
                          />
                        </div>

                        {isBinVerified && (
                          <CheckCircleFilled style={{ color: '#198754', fontSize: 24, flexShrink: 0 }} />
                        )}

                        <Button
                          icon={<PrinterOutlined />}
                          onClick={() => handlePrintBinLabel(currentBin)}
                          size="large"
                          style={{ borderRadius: 8, borderColor: '#d9d9d9', flexShrink: 0 }}
                        />
                      </div>
                    </div>

                    {/* 7. BOTÓN CONFIRMAR LÍNEA */}
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => handleConfirmLine(idx, line)}
                      block
                      size="large"
                      style={{
                        backgroundColor: '#0066ff',
                        borderColor: '#0066ff',
                        fontWeight: 700,
                        borderRadius: 8,
                        height: 44,
                        boxShadow: '0 4px 10px rgba(0, 102, 255, 0.25)'
                      }}
                    >
                      Confirmar
                    </Button>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      </Modal>

      {/* ── MODAL CAMBIAR UBICACIÓN POR DEFECTO ── */}
      <Modal
        title="Nueva Ubicación por Defecto"
        open={binModalVisible}
        onCancel={() => setBinModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setBinModalVisible(false)}>
            Cancelar
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={savingBin}
            onClick={handleSaveDefaultBin}
            style={{ backgroundColor: '#0d6efd', borderColor: '#0d6efd' }}
          >
            Guardar Cambios
          </Button>
        ]}
      >
        {editingItem && (
          <div>
            <p style={{ fontSize: '0.88rem', color: '#6c757d', marginBottom: 16 }}>
              Vas a cambiar la ubicación por defecto del artículo <strong>{editingItem.ITEMNAME}</strong> en el almacén <strong>{editingItem.WHSCODE || '01'}</strong>.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                Código de la Nueva Ubicación
              </label>
              <Input
                placeholder="Ej: 01-10-19-01-02"
                value={newBinCode}
                onChange={(e) => setNewBinCode(e.target.value)}
                size="large"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
