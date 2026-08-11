import React, { useState, useEffect } from 'react';
import { Modal, Card, Tag, Typography, Button, Row, Col, Space, Input, InputNumber, Select, Tooltip, Spin, Empty, message } from 'antd';
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

  // Carga dinámica de líneas de detalle
  const [loadingLines, setLoadingLines] = useState(false);
  const [detailLines, setDetailLines] = useState([]);

  // Líneas ya confirmadas en NC_SGAWEB_DOCS (preparación parcial)
  const [lineasPreparadas, setLineasPreparadas] = useState([]);

  // Estado para preparar cantidades por línea
  const [preparedQtys, setPreparedQtys] = useState({});
  const [selectedBins, setSelectedBins] = useState({});
  const [scannedItems, setScannedItems] = useState({});

  // Modal para cambiar ubicación por defecto
  const [binModalVisible, setBinModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newBinCode, setNewBinCode] = useState('');
  const [savingBin, setSavingBin] = useState(false);

  // Carga las líneas de detalle del pedido
  useEffect(() => {
    if (open && document) {
      const docEntry = document.DOCENTRY || document.DocEntry || document.DOCNUM;
      const objType = document.OBJTYPE || document.ObjType || '17';
      if (docEntry) {
        setLoadingLines(true);
        // Cargar líneas de detalle y líneas ya preparadas en paralelo
        Promise.all([
          client.get('/docs/detalle', { params: { docentry: docEntry, objtype: objType } }),
          client.get(`/docs/preparadas/${docEntry}`)
        ])
          .then(([resDetalle, resPrep]) => {
            if (resDetalle.status === 'ok' && Array.isArray(resDetalle.info) && resDetalle.info.length > 0) {
              setDetailLines(resDetalle.info);
            } else if (resDetalle.status === 'ok' && Array.isArray(resDetalle.lineas) && resDetalle.lineas.length > 0) {
              setDetailLines(resDetalle.lineas);
            } else if (Array.isArray(document.LINEAS) && document.LINEAS.length > 0) {
              setDetailLines(document.LINEAS);
            } else {
              setDetailLines([]);
            }

            // Cargar estado de líneas preparadas
            if (resPrep.status === 'ok' && Array.isArray(resPrep.lineas)) {
              setLineasPreparadas(resPrep.lineas);
              // Pre-rellenar cantidades con las ya confirmadas
              const qtysFromPrep = {};
              resPrep.lineas.forEach(lp => {
                const lineNum = lp.U_PedidoLine;
                if (lineNum !== undefined) {
                  qtysFromPrep[lineNum] = (qtysFromPrep[lineNum] || 0) + (lp.U_Quantity || 0);
                }
              });
              setPreparedQtys(prev => ({ ...prev, ...qtysFromPrep }));
            } else {
              setLineasPreparadas([]);
            }
          })
          .catch((err) => {
            console.error('Error al consultar detalle del pedido:', err);
            setDetailLines(document.LINEAS || []);
            setLineasPreparadas([]);
          })
          .finally(() => {
            setLoadingLines(false);
          });
      } else {
        setDetailLines(document.LINEAS || []);
        setLineasPreparadas([]);
      }
    } else {
      setDetailLines([]);
      setLineasPreparadas([]);
    }
  }, [open, document]);

  if (!document) return null;

  const lineas = detailLines.length > 0 ? detailLines : (document.LINEAS || []);

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

  const handleConfirmLine = async (idx, line) => {
    const scanned = scannedItems[idx] || '';
    const targetBin = selectedBins[idx] || null;
    const qty = preparedQtys[idx] ?? (line.CTD_PREPARADA || 0);

    if (scanned.trim().toUpperCase() !== (line.ITEMCODE || '').toUpperCase()) {
      message.error(`El artículo escaneado no coincide con ${line.ITEMCODE}`);
      return;
    }

    if (!qty || qty <= 0) {
      message.error(`Por favor, indique una cantidad preparada mayor a 0 para ${line.ITEMCODE}`);
      return;
    }

    // Ubicación obligatoria — el operario debe seleccionarla
    if (!targetBin || !targetBin.trim()) {
      message.error(`Debes seleccionar una ubicación para confirmar la línea ${line.ITEMCODE}`);
      return;
    }

    // El backend (confirmar_mov_stock) ya valida que la ubicación existe y tiene stock suficiente
    try {
      const payload = {
        U_ItemCode: line.ITEMCODE,
        U_BinFrom: targetBin,
        U_Quantity: qty,
        U_PedidoEntry: document.DOCENTRY || document.DOCNUM,
        U_PedidoLine: line.LINENUM ?? line.LINE_NUM ?? idx,
        U_ObjType: String(document.OBJTYPE || '17'),
        U_Estado: 'O'
      };
      const res = await client.post('/confirmar-mov-stock', payload);
      if (res.status === 'ok') {
        message.success(res.message || `Línea ${line.ITEMCODE} registrada correctamente en ubicación ${targetBin}`);
        // Actualizar el estado local en React inmediatamente (UI instantánea)
        const lineNum = line.LINENUM ?? line.LINE_NUM ?? idx;
        const newPrepLine = {
          U_PedidoEntry: document.DOCENTRY || document.DOCNUM,
          U_PedidoLine: lineNum,
          U_ItemCode: line.ITEMCODE,
          U_Quantity: qty,
          U_BinFrom: targetBin,
          U_Estado: 'O'
        };
        setLineasPreparadas(prev => {
          const filtered = prev.filter(lp =>
            !(String(lp.U_PedidoLine) === String(lineNum) &&
              (lp.U_ItemCode || '').toUpperCase() === (line.ITEMCODE || '').toUpperCase())
          );
          return [...filtered, newPrepLine];
        });

        // Recargar líneas preparadas del servidor (sin sobreescribir si la respuesta viene vacía)
        const docEntry = document.DOCENTRY || document.DOCNUM;
        client.get(`/docs/preparadas/${docEntry}`).then(resPrep => {
          if (resPrep.status === 'ok' && Array.isArray(resPrep.lineas) && resPrep.lineas.length > 0) {
            setLineasPreparadas(resPrep.lineas);
          }
        }).catch(() => {});
        if (onSuccess) onSuccess();
      } else {
        message.error(res.message || 'Error registrando movimiento de stock');
      }
    } catch (err) {
      message.error(err.message || 'Error al guardar confirmación de línea');
    }
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
        {/* ── BARRA DE PROGRESO DE PREPARACIÓN ── */}
        {lineas.length > 0 && (
          <div style={{
            backgroundColor: lineasPreparadas.length === lineas.length ? '#d1fae5' : '#fff7ed',
            border: `1px solid ${lineasPreparadas.length === lineas.length ? '#6ee7b7' : '#fed7aa'}`,
            borderRadius: 8,
            padding: '8px 16px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: lineasPreparadas.length === lineas.length ? '#065f46' : '#92400e' }}>
              {lineasPreparadas.length === lineas.length
                ? `✅ Todas las líneas confirmadas (${lineas.length}/${lineas.length})`
                : `📦 ${lineasPreparadas.length} de ${lineas.length} líneas confirmadas`
              }
            </span>
          </div>
        )}
        {/* ── CONTENEDOR DE TARJETAS DE LÍNEAS ── */}
        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
          {loadingLines ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" tip="Consultando líneas de artículo y stock disponible en SAP..." />
            </div>
          ) : lineas.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '40px 0', borderRadius: 12 }}>
              <Empty description="No se encontraron artículos/líneas para gestionar en este pedido" />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {lineas.map((line, idx) => {
              const total = line.QUANTITY || 0;
              const preparada = preparedQtys[idx] ?? (line.CTD_PREPARADA || 0);
              const isStockOk = String(line.STOCK_OK || '').toUpperCase() === 'OK';
              const defaultBin = line.BIN_STD || 'Sin Ubi';
              const whsCode = line.WHSCODE || '01';

              // Verificar si la línea ya tiene preparación confirmada
              const lineNum = line.LINENUM ?? line.LINE_NUM ?? idx;
              const linePreparada = lineasPreparadas.find(lp =>
                String(lp.U_PedidoLine) === String(lineNum) &&
                (lp.U_ItemCode || '').toUpperCase() === (line.ITEMCODE || '').toUpperCase()
              );
              const isLineConfirmed = !!linePreparada;
              const ctdConfirmada = linePreparada ? linePreparada.U_Quantity : 0;

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
              }).filter((opt) => !!opt.value && opt.value !== 'Sin Ubi');

              // El operario SIEMPRE debe seleccionar la ubicación explícitamente (sin valor por defecto)
              const currentBin = selectedBins[idx] || null;

              // Solo se considera verificada si el operario la ha seleccionado activamente
              const isBinVerified = !!currentBin;

              return (
                <Col xs={24} sm={24} md={12} key={`${line.ITEMCODE}_${idx}`}>
                  <Card
                    styles={{ body: { padding: 16 } }}
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${isLineConfirmed ? '#6ee7b7' : '#e5e7eb'}`,
                      borderTop: `4px solid ${isLineConfirmed ? '#10b981' : isStockOk ? '#0d6efd' : '#dc3545'}`,
                      boxShadow: isLineConfirmed ? '0 4px 12px rgba(16, 185, 129, 0.12)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
                      height: '100%',
                      backgroundColor: isLineConfirmed ? '#f0fdf4' : '#ffffff'
                    }}
                  >
                    {/* 1. BADGES DE ENCABEZADO (ITEMCODE | Alm | Ubi Defecto Edit | Estado) */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

                      {/* Badge de estado: Confirmada / Pendiente */}
                      {isLineConfirmed ? (
                        <span style={{
                          backgroundColor: '#10b981',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          padding: '3px 10px',
                          borderRadius: 20,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap'
                        }}>
                          <CheckCircleFilled style={{ fontSize: 13 }} /> Confirmada {ctdConfirmada} ud.
                        </span>
                      ) : (
                        <span style={{
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          padding: '3px 10px',
                          borderRadius: 20,
                          whiteSpace: 'nowrap'
                        }}>
                          ⬜ Pendiente
                        </span>
                      )}
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
                        2. Seleccionar Ubicación <span style={{ color: '#dc3545', fontWeight: 700 }}>*</span>
                        {!isBinVerified && <span style={{ color: '#dc3545', fontSize: '0.75rem', marginLeft: 6 }}>Obligatorio</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Select
                            showSearch
                            allowClear
                            placeholder={binOptions.length > 0 ? 'Selecciona o escribe una ubicación...' : 'Escribe el código de ubicación...'}
                            value={currentBin || undefined}
                            onChange={(val) => setSelectedBins({ ...selectedBins, [idx]: val || null })}
                            size="large"
                            style={{
                              width: '100%',
                              borderRadius: 8,
                            }}
                            options={binOptions}
                            filterOption={(input, option) =>
                              (option?.value || '').toUpperCase().includes(input.toUpperCase())
                            }
                            notFoundContent={
                              <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>
                                No hay ubicaciones con stock. Puedes escribir el código manualmente.
                              </span>
                            }
                          />
                        </div>

                        {isBinVerified && (
                          <CheckCircleFilled style={{ color: '#198754', fontSize: 24, flexShrink: 0 }} />
                        )}

                        <Button
                          icon={<PrinterOutlined />}
                          onClick={() => handlePrintBinLabel(currentBin)}
                          disabled={!currentBin}
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
          )}
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
