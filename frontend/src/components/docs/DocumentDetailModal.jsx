import React, { useState, useEffect, useRef } from 'react';
import { Modal, Card, Tag, Typography, Button, Row, Col, Space, Input, InputNumber, Select, Tooltip, Spin, Empty, message, Collapse } from 'antd';
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
  CheckOutlined,
  BulbOutlined,
  CommentOutlined
} from '@ant-design/icons';
import client from '../../utils/client';
import { MultiBinDistributionModal } from './MultiBinDistributionModal';

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
  const objType = document?.OBJTYPE || document?.ObjType || '17';
  const isPurchase = String(objType) === '22';
  const isTransfer = String(objType) === '1250000001' || String(objType) === '67';

  // Carga dinámica de líneas de detalle
  const [loadingLines, setLoadingLines] = useState(false);
  const [detailLines, setDetailLines] = useState([]);

  // Líneas ya confirmadas en NC_SGAWEB_DOCS (preparación parcial)
  const [lineasPreparadas, setLineasPreparadas] = useState([]);

  // Estado para preparar cantidades por línea
  const [preparedQtys, setPreparedQtys] = useState({});
  const [selectedBins, setSelectedBins] = useState({});
  const [selectedBinsTo, setSelectedBinsTo] = useState({});
  const [scannedItems, setScannedItems] = useState({});

  // Estado para Modal de Reparto Multi-Ubicación
  const [multiBinModal, setMultiBinModal] = useState({
    open: false,
    idx: null,
    line: null,
    itemCode: '',
    itemName: '',
    totalQty: 0,
    primaryBin: '',
    primaryAvailable: 0,
    allBinsWithStock: []
  });

  const hasChangesRef = useRef(false);

  useEffect(() => {
    if (open) {
      hasChangesRef.current = false;
    }
  }, [open]);

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
            let loadedLines = [];
            if (resDetalle.status === 'ok' && Array.isArray(resDetalle.info) && resDetalle.info.length > 0) {
              loadedLines = resDetalle.info;
            } else if (resDetalle.status === 'ok' && Array.isArray(resDetalle.lineas) && resDetalle.lineas.length > 0) {
              loadedLines = resDetalle.lineas;
            } else if (Array.isArray(document.LINEAS) && document.LINEAS.length > 0) {
              loadedLines = document.LINEAS;
            } else {
              loadedLines = [];
            }
            setDetailLines(loadedLines);

            const prepList = (resPrep.status === 'ok' && Array.isArray(resPrep.lineas)) ? resPrep.lineas : [];
            setLineasPreparadas(prepList);

            // Pre-rellenar estados de confirmación para que persistan al salir y volver a entrar
            const initialQtys = {};
            const initialScanned = {};
            const initialBins = {};
            const initialBinsTo = {};

            loadedLines.forEach((line, idx) => {
              const lineNum = line.LINENUM ?? line.LINE_NUM ?? idx;
              const itemCode = (line.ITEMCODE || '').trim().toUpperCase();

              // Buscar si la línea ya fue confirmada previamente en SAP / NC_SGAWEB_DOCS
              const prep = prepList.find(lp => {
                const lpLine = lp.U_PedidoLine;
                const lpItem = (lp.U_ItemCode || '').trim().toUpperCase();
                return (
                  (String(lpLine) === String(lineNum) || String(lpLine) === String(idx)) &&
                  (lpItem === itemCode || !lpItem)
                ) || (lpItem === itemCode && lpItem !== '');
              });

              if (prep) {
                initialQtys[idx] = prep.U_Quantity ?? line.CTD_PREPARADA ?? 0;
                initialScanned[idx] = line.ITEMCODE || '';
                initialBins[idx] = prep.U_BinFrom || '';
                initialBinsTo[idx] = prep.U_BinTo || '';
              } else {
                // Inicialmente siempre 0. El operario indica la cantidad o pulsa el icono del rayo ⚡ para autorellenar.
                initialQtys[idx] = (line.CTD_PREPARADA && line.CTD_PREPARADA > 0) ? line.CTD_PREPARADA : 0;
                if (line.BIN_DESTINO || line.U_BinTo) {
                  initialBinsTo[idx] = line.BIN_DESTINO || line.U_BinTo;
                }
              }
            });

            setPreparedQtys(initialQtys);
            setScannedItems(initialScanned);
            setSelectedBins(initialBins);
            setSelectedBinsTo(initialBinsTo);
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
      setPreparedQtys({});
      setScannedItems({});
      setSelectedBins({});
      setSelectedBinsTo({});
    }
  }, [open, document]);

  if (!document) return null;

  const lineas = detailLines.length > 0 ? detailLines : (document.LINEAS || []);

  const getLinePreparedQty = (line, idx) => {
    const lineNum = line.LINENUM ?? line.LINE_NUM ?? idx;
    const itemCode = (line.ITEMCODE || '').trim().toUpperCase();
    const matchingPreps = lineasPreparadas.filter(lp => {
      const lpLine = lp.U_PedidoLine;
      const lpItem = (lp.U_ItemCode || '').trim().toUpperCase();
      return (
        (String(lpLine) === String(lineNum) || String(lpLine) === String(idx)) &&
        (lpItem === itemCode || !lpItem)
      ) || (lpItem === itemCode && lpItem !== '');
    });
    if (matchingPreps.length > 0) {
      return matchingPreps.reduce((sum, lp) => sum + (Number(lp.U_Quantity) || 0), 0);
    }
    return Number(line.CTD_PREPARADA) || 0;
  };

  // Línea confirmada al 100% solo si la cantidad preparada cubre el total pedido
  const isLineFullyConfirmed = (line, idx) => {
    const reqQty = Number(line.QUANTITY) || 0;
    const prepQty = getLinePreparedQty(line, idx);
    return reqQty > 0 && prepQty >= reqQty;
  };

  // Línea con alguna preparación
  const isLineWithAnyPrep = (line, idx) => {
    return getLinePreparedQty(line, idx) > 0;
  };

  const handleClose = () => {
    if (hasChangesRef.current && onSuccess) {
      onSuccess();
    }
    onClose();
  };

  const isAllConfirmed = lineas.length > 0 && lineas.every((line, idx) => isLineFullyConfirmed(line, idx));
  const hasPartialPrep = lineas.some((line, idx) => isLineWithAnyPrep(line, idx)) && !isAllConfirmed;
  const hasAnyConfirmed = lineas.some((line, idx) => {
    const q = preparedQtys[idx] ?? 0;
    return q > 0 || lineasPreparadas.some(lp => String(lp.U_PedidoLine) === String(line.LINENUM ?? idx) && Number(lp.U_Quantity) > 0);
  });

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

  const handleFinalizar = async (esParcial = false) => {
    setFinishing(true);
    try {
      const objType = document.OBJTYPE || '17';
      const url = `/finalizar-preparacion/${objType}/${document.DOCENTRY}${esParcial ? '?parcial=true' : ''}`;
      const res = await client.post(url);
      if (res.status === 'ok' || res.message) {
        message.success(res.message || `Preparación ${esParcial ? 'parcial ' : ''}del pedido #${document.DOCNUM || document.DOCENTRY} finalizada con éxito en SAP (Albarán creado)`);
        hasChangesRef.current = true;
        handleClose();
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
      message.error(`Debes seleccionar la ubicación ${isTransfer ? 'de origen' : ''} para confirmar la línea ${line.ITEMCODE}`);
      return;
    }

    const targetBinTo = selectedBinsTo[idx] || null;
    if (isTransfer && (!targetBinTo || !targetBinTo.trim())) {
      message.error(`Debes indicar la ubicación de destino para confirmar la línea ${line.ITEMCODE}`);
      return;
    }

    // Parsear lista de ubicaciones con existencias para este artículo
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

    const primaryUbiObj = ubisList.find(u => getBinCode(u) === targetBin);
    const primaryAvailable = primaryUbiObj ? getBinQty(primaryUbiObj) : 0;

    // Si la cantidad a preparar supera el stock disponible en la ubicación seleccionada y hay más ubicaciones con stock (solo en ventas)
    if (!isTransfer && qty > primaryAvailable && ubisList.length > 1) {
      const formattedBins = ubisList.map(u => ({
        bincode: getBinCode(u),
        onhandqty: getBinQty(u),
        binabs: u.binabs || u.BinAbs
      }));

      setMultiBinModal({
        open: true,
        idx,
        line,
        itemCode: line.ITEMCODE,
        itemName: line.ITEMNAME || '',
        totalQty: qty,
        primaryBin: targetBin,
        primaryAvailable: primaryAvailable,
        allBinsWithStock: formattedBins
      });
      return;
    }

    // El backend (confirmar_mov_stock) ya valida que la ubicación existe y tiene stock suficiente
    try {
      const payload = {
        U_ItemCode: line.ITEMCODE,
        U_BinFrom: targetBin,
        U_BinTo: isTransfer ? targetBinTo : '',
        U_Quantity: qty,
        U_PedidoEntry: document.DOCENTRY || document.DOCNUM,
        U_PedidoLine: line.LINENUM ?? line.LINE_NUM ?? idx,
        U_ObjType: String(document.OBJTYPE || (isTransfer ? '1250000001' : isPurchase ? '22' : '17')),
        U_Estado: 'O'
      };
      const res = await client.post('/confirmar-mov-stock', payload);
      if (res.status === 'ok') {
        message.success(res.message || `Línea ${line.ITEMCODE} registrada correctamente${isTransfer ? ` (${targetBin} ➔ ${targetBinTo})` : ` en ubicación ${targetBin}`}`);
        // Actualizar el estado local en React inmediatamente (UI instantánea)
        const lineNum = line.LINENUM ?? line.LINE_NUM ?? idx;
        const newPrepLine = {
          U_PedidoEntry: document.DOCENTRY || document.DOCNUM,
          U_PedidoLine: lineNum,
          U_ItemCode: line.ITEMCODE,
          U_Quantity: qty,
          U_BinFrom: targetBin,
          U_BinTo: isTransfer ? targetBinTo : '',
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
        hasChangesRef.current = true;
      } else {
        message.error(res.message || 'Error registrando movimiento de stock');
      }
    } catch (err) {
      message.error(err.message || 'Error al guardar confirmación de línea');
    }
  };

  const handleMultiBinConfirm = async (allocations) => {
    const { idx, line, totalQty } = multiBinModal;
    if (!line) return;

    try {
      const payload = {
        U_ItemCode: line.ITEMCODE,
        U_BinFrom: allocations[0]?.bincode || '',
        U_Quantity: totalQty,
        U_PedidoEntry: document.DOCENTRY || document.DOCNUM,
        U_PedidoLine: line.LINENUM ?? line.LINE_NUM ?? idx,
        U_ObjType: String(document.OBJTYPE || '17'),
        U_Estado: 'O',
        U_BinAllocations: allocations
      };

      const res = await client.post('/confirmar-mov-stock', payload);
      if (res.status === 'ok') {
        const binSummary = allocations.map(a => `${a.quantity} u. en ${a.bincode}`).join(' + ');
        message.success(`Reparto multi-ubicación registrado para ${line.ITEMCODE} (${binSummary})`);

        // Actualizar estado local
        const lineNum = line.LINENUM ?? line.LINE_NUM ?? idx;
        const newPrepLine = {
          U_PedidoEntry: document.DOCENTRY || document.DOCNUM,
          U_PedidoLine: lineNum,
          U_ItemCode: line.ITEMCODE,
          U_Quantity: totalQty,
          U_BinFrom: allocations[0]?.bincode || '',
          U_Estado: 'O'
        };
        setLineasPreparadas(prev => {
          const filtered = prev.filter(lp =>
            !(String(lp.U_PedidoLine) === String(lineNum) &&
              (lp.U_ItemCode || '').toUpperCase() === (line.ITEMCODE || '').toUpperCase())
          );
          return [...filtered, newPrepLine];
        });

        // Recargar del backend
        const docEntry = document.DOCENTRY || document.DOCNUM;
        client.get(`/docs/preparadas/${docEntry}`).then(resPrep => {
          if (resPrep.status === 'ok' && Array.isArray(resPrep.lineas) && resPrep.lineas.length > 0) {
            setLineasPreparadas(resPrep.lineas);
          }
        }).catch(() => {});
        hasChangesRef.current = true;
      } else {
        message.error(res.message || 'Error registrando reparto multi-ubicación');
      }
    } catch (err) {
      message.error(err.message || 'Error en comunicación con SAP');
    }
  };

  return (
    <Modal
        title={
          <div className="sga-modal-header-container">
            {/* Título Exacto Proyecto Original: Detalle Pedido {DOCNUM} ({CARDNAME}) */}
            <div className="sga-modal-header-title">
              Detalle Pedido {document.DOCNUM || document.DOCENTRY} ({document.CARDNAME || 'Sin Asignar'})
            </div>

            {/* Barra de Acciones del Encabezado (Num Bultos, Imp, Semi, Finalizar / Entrega Parcial, Volver) */}
            <div className="sga-modal-header-actions">
              {/* Input Num Bultos + Botón Imp */}
              <div className="sga-bultos-container">
                <span className="sga-bultos-label">
                  Num Bultos
                </span>
                <div className="sga-bultos-group">
                  <div className="sga-bultos-icon">
                    📦
                  </div>
                  <InputNumber
                    min={1}
                    max={99}
                    value={bultos}
                    onChange={(v) => setBultos(v || 1)}
                    className="sga-bultos-input"
                  />
                  <Button
                    type="primary"
                    loading={printingBultos}
                    onClick={handlePrintBultos}
                    className="sga-bultos-btn-print"
                  >
                    Imp
                  </Button>
                </div>
              </div>

              {/* Botón Semi */}
              {!isPurchase && !isTransfer && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleSemiPreparar}
                  className="sga-btn-modal-semi"
                >
                  Semi
                </Button>
              )}

              {/* Botón Entrega Parcial (para pedidos semi-preparados o con líneas confirmadas) */}
              {!isPurchase && !isTransfer && !isAllConfirmed && (hasPartialPrep || hasAnyConfirmed) && (
                <Tooltip title="Generar albarán de entrega parcial en SAP solo con las líneas confirmadas">
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={finishing}
                    onClick={() => handleFinalizar(true)}
                    className="sga-btn-modal-parcial"
                  >
                    Entrega Parcial
                  </Button>
                </Tooltip>
              )}

              {/* Botón Finalizar Completo (100%) */}
              <Tooltip title={!isAllConfirmed ? "Debes confirmar todas las líneas al 100% para finalizar completamente" : "Generar albarán de entrega completo en SAP"}>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={finishing}
                  onClick={() => handleFinalizar(false)}
                  disabled={!isAllConfirmed}
                  className="sga-btn-modal-finalizar"
                  style={{
                    backgroundColor: isAllConfirmed ? '#198754' : '#e5e7eb',
                    borderColor: isAllConfirmed ? '#198754' : '#d1d5db',
                    color: isAllConfirmed ? '#fff' : '#9ca3af',
                    cursor: isAllConfirmed ? 'pointer' : 'not-allowed'
                  }}
                >
                  Finalizar
                </Button>
              </Tooltip>

              {/* Botón Volver */}
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={handleClose}
                className="sga-btn-modal-volver"
              >
                Volver
              </Button>
            </div>
          </div>
        }
        open={open}
        onCancel={handleClose}
        width={780}
        footer={null}
        styles={{ body: { padding: '14px' } }}
      >
        {/* ── BARRA DE PROGRESO DE PREPARACIÓN ── */}
        {lineas.length > 0 && (
          <div
            className="sga-modal-status-banner"
            style={{
              backgroundColor: isAllConfirmed ? '#d1fae5' : (hasPartialPrep ? '#fffbeb' : '#fff7ed'),
              border: `1px solid ${isAllConfirmed ? '#6ee7b7' : (hasPartialPrep ? '#fcd34d' : '#fed7aa')}`,
              color: isAllConfirmed ? '#065f46' : (hasPartialPrep ? '#b45309' : '#92400e')
            }}
          >
            <span>
              {isAllConfirmed
                ? `✅ Todas las líneas confirmadas al 100% (${lineas.length}/${lineas.length}) - Listo para Finalizar`
                : hasPartialPrep
                  ? `🟠 Pedido Semi-Preparado / En Curso (${lineas.filter((l, i) => isLineFullyConfirmed(l, i)).length} de ${lineas.length} líneas completas)`
                  : `📦 0 de ${lineas.length} líneas confirmadas (Completa la preparación para habilitar Finalizar)`
              }
            </span>
          </div>
        )}
        {/* ── CONTENEDOR DE TARJETAS DE LÍNEAS ── */}
        <div className="sga-modal-lines-scroll">
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
              const isStockOk = String(line.STOCK_OK || '').toUpperCase() === 'OK';
              const defaultBin = line.BIN_STD || 'Sin Ubi';
              const whsCode = line.WHSCODE || '01';

              // Verificar si la línea ya tiene preparación confirmada
              const ctdConfirmada = getLinePreparedQty(line, idx);
              const preparada = preparedQtys[idx] ?? (ctdConfirmada > 0 ? ctdConfirmada : total);
              const isLineComplete = isLineFullyConfirmed(line, idx);
              const isLinePartial = isLineWithAnyPrep(line, idx) && !isLineComplete;
              const isLineConfirmed = isLineComplete || isLinePartial;

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
                      border: `1px solid ${isLineComplete ? '#6ee7b7' : isLinePartial ? '#fcd34d' : '#e5e7eb'}`,
                      borderTop: `4px solid ${isLineComplete ? '#10b981' : isLinePartial ? '#f59e0b' : isStockOk ? '#0d6efd' : '#dc3545'}`,
                      boxShadow: isLineComplete ? '0 4px 12px rgba(16, 185, 129, 0.12)' : isLinePartial ? '0 4px 12px rgba(245, 158, 11, 0.12)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
                      height: '100%',
                      backgroundColor: isLineComplete ? '#f0fdf4' : isLinePartial ? '#fffdf5' : '#ffffff'
                    }}
                  >
                    {/* 1. BADGES DE ENCABEZADO (ITEMCODE | Alm | Ubi Defecto Edit | Estado) */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className="sga-badge-itemcode">
                          {line.ITEMCODE}
                        </span>

                        <span className="sga-badge-whs">
                          <ShopOutlined style={{ marginRight: 4 }} /> Alm: {whsCode}
                        </span>

                        <span className="sga-badge-bin-default" title="Ubicación por defecto en SAP (Informativo)">
                          <EnvironmentOutlined /> {defaultBin}
                        </span>
                      </div>

                      {/* Badge de estado: Confirmada Completa / Semi-Preparada / Pendiente */}
                      {isLineComplete ? (
                        <span className="sga-badge-confirmed">
                          <CheckCircleFilled style={{ fontSize: 13 }} /> Confirmada {ctdConfirmada} ud.
                        </span>
                      ) : (isLinePartial && !isPurchase) ? (
                        <span style={{
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fcd34d',
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <CheckCircleFilled style={{ fontSize: 13, color: '#f59e0b' }} /> Semi-Prep ({ctdConfirmada}/{total} ud.)
                        </span>
                      ) : (
                        <span className="sga-badge-pending">
                          ⬜ Pendiente
                        </span>
                      )}
                    </div>

                    {/* 2. NOMBRE DEL ARTÍCULO */}
                    <div className="sga-item-title">
                      {line.ITEMNAME || 'Sin descripción'}
                    </div>

                    {/* 2.1 NECESIDADES MOVIDO ABAJO */}

                    {/* 3. CAJA CANTIDAD PREPARADA / TOTAL (ESTILO ORIGINAL AZUL) */}
                    <div className="sga-qty-box">
                      <div className="sga-qty-label">
                        CANTIDAD PREPARADA / TOTAL
                      </div>

                      <div className="sga-qty-row">
                        <div className="sga-qty-input-box">
                          <InputNumber
                            min={0}
                            max={total}
                            value={preparada}
                            onChange={(val) => setPreparedQtys({ ...preparedQtys, [idx]: val || 0 })}
                            controls={false}
                            bordered={false}
                            className="sga-qty-input"
                          />
                        </div>

                        <span className="sga-qty-divider">/</span>

                        <span className="sga-qty-total">
                          {total}
                        </span>

                        <span className="sga-qty-unit">uds</span>

                        <Tooltip title="Completar cantidad total">
                          <ThunderboltOutlined
                            onClick={() => handleAutoFillQty(idx, total)}
                            className="sga-qty-autofill-btn"
                          />
                        </Tooltip>
                      </div>
                    </div>

                    {/* 4. STOCK DISPONIBLE POR UBICACIÓN / SERIE */}
                    <div className="sga-stock-section">
                      <div className="sga-stock-title">
                        📦 STOCK DISPONIBLE POR SERIE / UBICACIÓN
                      </div>

                      <div className="sga-stock-table-header">
                        <span>Ubicación / Nº Serie</span>
                        <span>Cant.</span>
                      </div>

                      {ubisList.length > 0 ? (
                        ubisList.map((u, uIdx) => {
                          const code = getBinCode(u);
                          const qty = getBinQty(u);
                          return (
                            <div key={uIdx} className="sga-stock-table-row">
                              <span className="sga-stock-code">
                                {code || 'General'}
                              </span>
                              <span className="sga-stock-qty">
                                {qty}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="sga-stock-empty">
                          Sin ubicaciones registradas con stock
                        </div>
                      )}
                    </div>

                    {/* 5. PASO 1: Escanear Artículo */}
                    <div className="sga-step-box">
                      <div className="sga-step-title">
                        1. Escanear Artículo
                      </div>
                      <div className="sga-step-row">
                        <div className="sga-step-input-wrap">
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
                                    className="sga-btn-autofill-item"
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

                    {/* 6. PASO 2: Seleccionar Ubicación (Origen y Destino si es Solicitud de Traslado) */}
                    {!isTransfer ? (
                      <div style={{ marginBottom: 16 }}>
                        <div className="sga-step-title">
                          2. Seleccionar Ubicación {isPurchase ? '(Destino)' : '(Origen)'} <span className="sga-step-required">*</span>
                          {!isBinVerified && <span className="sga-step-tag-mandatory">Obligatorio</span>}
                        </div>
                        <div className="sga-step-row">
                          <div className="sga-step-input-wrap">
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
                    ) : (
                      <div style={{ marginBottom: 16 }}>
                        {/* 2a. Ubicación de Origen */}
                        <div style={{ marginBottom: 12 }}>
                          <div className="sga-step-title">
                            2a. Seleccionar Ubicación Origen <span className="sga-step-required">*</span>
                            {!isBinVerified && <span className="sga-step-tag-mandatory">Obligatorio</span>}
                          </div>
                          <div className="sga-step-row">
                            <div className="sga-step-input-wrap">
                              <Select
                                showSearch
                                allowClear
                                placeholder={binOptions.length > 0 ? 'Selecciona ubicación origen...' : 'Escribe ubicación origen...'}
                                value={currentBin || undefined}
                                onChange={(val) => setSelectedBins({ ...selectedBins, [idx]: val || null })}
                                size="large"
                                style={{ width: '100%', borderRadius: 8 }}
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

                        {/* 2b. Ubicación de Destino */}
                        <div>
                          <div className="sga-step-title">
                            2b. Seleccionar Ubicación Destino <span className="sga-step-required">*</span>
                            {!selectedBinsTo[idx] && <span className="sga-step-tag-mandatory">Obligatorio</span>}
                          </div>
                          <div className="sga-step-row">
                            <div className="sga-step-input-wrap">
                              <Input
                                prefix={<EnvironmentOutlined style={{ color: '#0d6efd' }} />}
                                placeholder="Escanear o escribir ubicación destino..."
                                value={selectedBinsTo[idx] || ''}
                                onChange={(e) => setSelectedBinsTo({ ...selectedBinsTo, [idx]: e.target.value.toUpperCase() })}
                                size="large"
                                style={{
                                  borderRadius: 8,
                                  borderColor: selectedBinsTo[idx] ? '#198754' : '#d9d9d9'
                                }}
                              />
                            </div>
                            {selectedBinsTo[idx] && (
                              <CheckCircleFilled style={{ color: '#198754', fontSize: 24, flexShrink: 0 }} />
                            )}
                            <Button
                              icon={<PrinterOutlined />}
                              onClick={() => handlePrintBinLabel(selectedBinsTo[idx])}
                              disabled={!selectedBinsTo[idx]}
                              size="large"
                              style={{ borderRadius: 8, borderColor: '#d9d9d9', flexShrink: 0 }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6.5 NECESIDADES DE PEDIDOS DE COMPRA (SOLICITUDES TRASLADO, VENTAS, LLAMADAS) */}
                    {Array.isArray(line.NECESIDADES) && line.NECESIDADES.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <Collapse
                          size="small"
                          items={[{
                            key: '1',
                            label: (
                              <span style={{ fontWeight: 600, color: '#4b5563' }}>
                                <BulbOutlined /> Necesidades ({line.NECESIDADES.length})
                              </span>
                            ),
                            children: (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {line.NECESIDADES.map((nec, nIdx) => {
                                  const isTraslado = nec.OBJTYPE === '1250000001' || nec.TIPO === 'Solicitud de Traslado';
                                  const isVenta = nec.OBJTYPE === '17' || nec.TIPO === 'Pedido de Venta';
                                  const docNum = nec.DOCNUM || nec.DocNum || nec.DOCENTRY || nec.LLAMADA || (nIdx + 1);
                                  const fromWhs = nec.FROM_WHS || nec.FromWarehouse || '01';
                                  const toWhs = nec.TO_WHS || nec.ToWarehouse || '13';
                                  const cliente = nec.CARDNAME || nec.CardName || (isTraslado ? `Traslado Alm. ${fromWhs} ➔ Alm. ${toWhs}` : '');
                                  const observaciones = nec.COMENTARIO || nec.Comments || nec.COMENTARIO_LLAMADA || '';

                                  return (
                                    <div key={nIdx} className="sga-nec-item">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 700, color: isTraslado ? '#d97706' : isVenta ? '#2563eb' : '#b45309' }}>
                                          📄 {nec.TIPO || 'Reserva'} Nº {docNum}
                                        </span>
                                        {nec.QTY > 0 && <Tag color="purple" style={{ margin: 0, fontSize: '0.72rem' }}>{nec.QTY} u.</Tag>}
                                      </div>

                                      {cliente && (
                                        <div className="sga-nec-client">
                                          <span style={{ color: '#64748b', marginRight: 4 }}>🏢 Cliente:</span>
                                          <strong>{cliente}</strong>
                                        </div>
                                      )}

                                      {observaciones && observaciones !== '-' && (
                                        <div className="sga-nec-comments">
                                          <span style={{ color: '#64748b', fontWeight: 600, marginRight: 4 }}>💬 Observaciones:</span>
                                          <span style={{ color: '#334155' }}>{observaciones}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          }]}
                        />
                      </div>
                    )}

                    {/* 7. BOTÓN CONFIRMAR LÍNEA */}
                    <Button
                      type={isLineConfirmed ? "default" : "primary"}
                      icon={<CheckOutlined />}
                      onClick={() => handleConfirmLine(idx, line)}
                      block
                      size="large"
                      className={isLineConfirmed ? "sga-btn-confirm-line-confirmed" : "sga-btn-confirm-line"}
                      style={isLineConfirmed ? {
                        backgroundColor: '#10b981',
                        borderColor: '#10b981',
                        color: '#ffffff',
                        fontWeight: 700,
                        borderRadius: 8
                      } : undefined}
                    >
                      {isLineConfirmed ? '✅ Línea Confirmada (Guardar cambios)' : 'Confirmar'}
                    </Button>
                  </Card>
                </Col>
              );
            })}
          </Row>
          )}
        </div>

        {/* Modal Interactivo de Reparto Multi-Ubicación */}
        <MultiBinDistributionModal
          open={multiBinModal.open}
          onClose={() => setMultiBinModal(prev => ({ ...prev, open: false }))}
          itemCode={multiBinModal.itemCode}
          itemName={multiBinModal.itemName}
          totalQty={multiBinModal.totalQty}
          primaryBin={multiBinModal.primaryBin}
          primaryAvailable={multiBinModal.primaryAvailable}
          allBinsWithStock={multiBinModal.allBinsWithStock}
          onConfirm={handleMultiBinConfirm}
        />
      </Modal>
  );
};
