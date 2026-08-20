import React, { useState, useEffect, useRef } from 'react';
import { Modal, Card, Tag, Typography, Button, Row, Col, Space, Input, InputNumber, Select, Tooltip, Spin, Empty, message, Collapse, Popconfirm } from 'antd';
import {
  SwapOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  PrinterOutlined,
  ShopOutlined,
  EditOutlined,
  ThunderboltOutlined,
  ArrowLeftOutlined,
  BarcodeOutlined,
  CheckOutlined,
  BulbOutlined,
  CommentOutlined,
  DeleteOutlined,
  LockFilled,
  MessageOutlined
} from '@ant-design/icons';
import client from '../../utils/client';
import { MultiBinDistributionModal } from './MultiBinDistributionModal';
import { ChangeDefaultBinModal } from '../stock/ChangeDefaultBinModal';

const { Text } = Typography;

// Helper de normalización robusta de líneas para soportar vistas SQL y Service Layer
const normalizeLine = (line) => {
  if (!line) return {};
  const itemCode = line.ITEMCODE || line.ItemCode || line.item_code || '';
  const itemName = line.ITEMNAME || line.ItemDescription || line.ItemName || line.item_name || 'Sin descripción';
  const quantity = Number(line.QUANTITY ?? line.Quantity ?? line.quantity ?? line.CountQty ?? 0);
  const lineNum = line.LINENUM ?? line.LineNum ?? line.LINE_NUM ?? line.line_num ?? 0;
  const whsCode = line.WHSCODE || line.WhsCode || line.whs_code || line.WarehouseCode || '01';
  const binStd = line.BIN_STD || line.BinStd || line.bin_std || line.U_BinCode || 'Sin Ubi';
  const ctdPrep = Number(line.CTD_PREPARADA ?? line.CtdPreparada ?? line.U_Quantity ?? 0);
  const stockOk = line.STOCK_OK || line.StockOk || (line.StockStatus === 'OK' ? 'OK' : '');
  
  let ubis = line.UBICACIONES || line.Ubicaciones || [];
  if (typeof ubis === 'string') {
    try {
      ubis = JSON.parse(ubis);
    } catch {
      ubis = [];
    }
  }

  return {
    ...line,
    ITEMCODE: itemCode,
    ItemCode: itemCode,
    ITEMNAME: itemName,
    ItemDescription: itemName,
    ItemName: itemName,
    QUANTITY: quantity,
    Quantity: quantity,
    LINENUM: lineNum,
    LineNum: lineNum,
    WHSCODE: whsCode,
    WhsCode: whsCode,
    BIN_STD: binStd,
    BinStd: binStd,
    STOCK_OK: stockOk,
    CTD_PREPARADA: ctdPrep,
    UBICACIONES: Array.isArray(ubis) ? ubis : [],
    Ubicaciones: Array.isArray(ubis) ? ubis : []
  };
};

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
  const objType = String(document?.OBJTYPE || document?.ObjType || '17');
  const isSalesReturn = objType === '234000031';
  const isPurchase = objType === '22';
  const isPurchaseReturn = objType === '234000032';
  const isTransfer = objType === '1250000001' || objType === '67';
  const isReturn = isSalesReturn || isPurchaseReturn;
  const isInbound = isPurchase || isSalesReturn;

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

  // Estado para validación en tiempo real de artículos (ItemCode, BarCode, U_Tipoproducto)
  const [itemValidationStatus, setItemValidationStatus] = useState({});
  const [binToValidationStatus, setBinToValidationStatus] = useState({});

  // Estado para Modal de Cambio de Ubicación Predeterminada
  const [changeBinModal, setChangeBinModal] = useState({
    open: false,
    line: null,
    idx: null,
    itemCode: '',
    itemName: '',
    whsCode: '01',
    currentBin: '',
    ubisList: []
  });

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

  // Carga inmediata y sincronización de líneas de detalle del pedido
  useEffect(() => {
    if (open && document) {
      const docEntry = document.DOCENTRY || document.DocEntry || document.DOCNUM;
      const rawInitial = Array.isArray(document.LINEAS) && document.LINEAS.length > 0
        ? document.LINEAS
        : (Array.isArray(document.DocumentLines) && document.DocumentLines.length > 0 ? document.DocumentLines : []);

      const initialLines = rawInitial.map(normalizeLine);

      // 1. Mostrar líneas de inmediato desde la memoria
      setDetailLines(initialLines);

      const initialQtys = {};
      const initialScanned = {};
      const initialBins = {};
      const initialBinsTo = {};

      initialLines.forEach((line, idx) => {
        initialQtys[idx] = (line.CTD_PREPARADA && line.CTD_PREPARADA > 0) ? line.CTD_PREPARADA : 0;
        if (line.BIN_DESTINO || line.U_BinTo) {
          initialBinsTo[idx] = line.BIN_DESTINO || line.U_BinTo;
        }
      });

      setPreparedQtys(initialQtys);
      setScannedItems(initialScanned);
      setSelectedBins(initialBins);
      setSelectedBinsTo(initialBinsTo);
      setLoadingLines(initialLines.length === 0 && Boolean(docEntry));

      // 2. Traer el detalle completo con ubicaciones de SAP y preparadas (muy rápido)
      if (docEntry) {
        const objTypeVal = document.OBJTYPE || document.ObjType || '17';
        Promise.all([
          client.get('/docs/detalle', { params: { docentry: docEntry, objtype: objTypeVal } }),
          client.get(`/docs/preparadas/${docEntry}`)
        ])
          .then(([resDetalle, resPrep]) => {
            let loaded = [];
            if (resDetalle && resDetalle.status === 'ok') {
              const raw = resDetalle.info || resDetalle.lineas || [];
              if (raw.length > 0) {
                loaded = raw.map(normalizeLine);
                setDetailLines(loaded);
              }
            }
            if (loaded.length === 0) {
              loaded = initialLines;
            }

            const prepList = (resPrep && resPrep.status === 'ok' && Array.isArray(resPrep.lineas)) ? resPrep.lineas : [];
            setLineasPreparadas(prepList);

            if (prepList.length > 0 || loaded.length > 0) {
              const updatedQtys = {};
              const updatedScanned = {};
              const updatedBins = {};
              const updatedBinsTo = {};

              loaded.forEach((line, idx) => {
                const lineNum = line.LINENUM ?? line.LINE_NUM ?? idx;
                const itemCode = (line.ITEMCODE || '').trim().toUpperCase();

                const prep = prepList.find(lp => {
                  const lpLine = lp.U_PedidoLine;
                  const lpItem = (lp.U_ItemCode || '').trim().toUpperCase();
                  return (
                    (String(lpLine) === String(lineNum) || String(lpLine) === String(idx)) &&
                    (lpItem === itemCode || !lpItem)
                  ) || (lpItem === itemCode && lpItem !== '');
                });

                if (prep) {
                  updatedQtys[idx] = prep.U_Quantity ?? line.CTD_PREPARADA ?? 0;
                  updatedScanned[idx] = line.ITEMCODE || '';
                  updatedBins[idx] = prep.U_BinFrom || '';
                  updatedBinsTo[idx] = prep.U_BinTo || '';
                } else {
                  updatedQtys[idx] = (line.CTD_PREPARADA && line.CTD_PREPARADA > 0) ? line.CTD_PREPARADA : 0;
                  if (line.BIN_DESTINO || line.U_BinTo) {
                    updatedBinsTo[idx] = line.BIN_DESTINO || line.U_BinTo;
                  }
                }
              });

              setPreparedQtys(updatedQtys);
              setScannedItems(updatedScanned);
              setSelectedBins(updatedBins);
              setSelectedBinsTo(updatedBinsTo);
            }
          })
          .catch((err) => {
            console.error('Error sincronizando detalle del pedido:', err);
          })
          .finally(() => {
            setLoadingLines(false);
          });
      }
    } else {
      setDetailLines([]);
      setLineasPreparadas([]);
      setPreparedQtys({});
      setScannedItems({});
      setSelectedBins({});
      setSelectedBinsTo({});
      setLoadingLines(false);
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
    setItemValidationStatus((prev) => ({
      ...prev,
      [idx]: { isValid: true, isChecking: false, errorMsg: '' }
    }));
  };

  const handleOpenChangeDefaultBin = (line, idx) => {
    let ubis = [];
    if (Array.isArray(line.UBICACIONES)) {
      ubis = line.UBICACIONES;
    } else if (typeof line.UBICACIONES === 'string') {
      try {
        ubis = JSON.parse(line.UBICACIONES);
      } catch {
        ubis = [];
      }
    }
    setChangeBinModal({
      open: true,
      line,
      idx,
      itemCode: line.ITEMCODE,
      itemName: line.ITEMNAME,
      whsCode: line.WHSCODE || '01',
      currentBin: line.BIN_STD || 'Sin Ubi',
      ubisList: ubis
    });
  };

  const handleDefaultBinSuccess = (newBin) => {
    if (changeBinModal.idx !== null) {
      const targetIdx = changeBinModal.idx;
      setDetailLines((prev) =>
        prev.map((l, i) => (i === targetIdx ? { ...l, BIN_STD: newBin } : l))
      );
      hasChangesRef.current = true;
    }
  };

  const handleItemScanChange = async (idx, line, value) => {
    const cleanVal = (value || '').trim();
    setScannedItems((prev) => ({ ...prev, [idx]: value }));

    if (!cleanVal) {
      setItemValidationStatus((prev) => ({
        ...prev,
        [idx]: { isValid: null, isChecking: false, errorMsg: '' }
      }));
      return;
    }

    // 1. Comprobación directa inmediata por ItemCode
    if (cleanVal.toUpperCase() === (line.ITEMCODE || '').toUpperCase()) {
      setItemValidationStatus((prev) => ({
        ...prev,
        [idx]: { isValid: true, isChecking: false, errorMsg: '' }
      }));
      return;
    }

    // 2. Consultar al backend si coincide con ItemCode, BarCode o U_Tipoproducto del artículo
    setItemValidationStatus((prev) => ({
      ...prev,
      [idx]: { isValid: null, isChecking: true, errorMsg: '' }
    }));

    try {
      const res = await client.get('/producto-existe', {
        params: {
          'prod-search': cleanVal,
          'prod-expect': line.ITEMCODE
        }
      });

      if (res.matched || res.existe) {
        // Auto-sustituir con el código real del artículo
        const realCode = res.real_itemcode || line.ITEMCODE;
        setScannedItems((prev) => ({ ...prev, [idx]: realCode }));
        setItemValidationStatus((prev) => ({
          ...prev,
          [idx]: { isValid: true, isChecking: false, errorMsg: '' }
        }));
        message.success(`Artículo verificado: ${realCode}`);
      } else {
        setItemValidationStatus((prev) => ({
          ...prev,
          [idx]: { isValid: false, isChecking: false, errorMsg: res.message || 'Código incorrecto' }
        }));
      }
    } catch (e) {
      setItemValidationStatus((prev) => ({
        ...prev,
        [idx]: { isValid: false, isChecking: false, errorMsg: 'Error validando código' }
      }));
    }
  };

  const handleBinToChange = async (idx, val, targetWhs) => {
    const cleanVal = (val || '').toUpperCase();
    setSelectedBinsTo(prev => ({ ...prev, [idx]: cleanVal }));

    if (!cleanVal.trim()) {
      setBinToValidationStatus(prev => ({ ...prev, [idx]: null }));
      return;
    }

    setBinToValidationStatus(prev => ({ ...prev, [idx]: { isChecking: true } }));
    try {
      const res = await client.get(`/ubicacion-existe/${encodeURIComponent(cleanVal.trim())}?whscode=${encodeURIComponent(targetWhs || '')}`);
      if (res.existe) {
        setBinToValidationStatus(prev => ({
          ...prev,
          [idx]: { isValid: true, isChecking: false, errorMsg: '' }
        }));
      } else {
        setBinToValidationStatus(prev => ({
          ...prev,
          [idx]: { isValid: false, isChecking: false, errorMsg: res.message || `La ubicación no pertenece al almacén #${targetWhs}` }
        }));
      }
    } catch (e) {
      setBinToValidationStatus(prev => ({
        ...prev,
        [idx]: { isValid: false, isChecking: false, errorMsg: 'Error validando ubicación' }
      }));
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

  const docFromWhs = document?.FROM_WHS || document?.FromWarehouse || detailLines[0]?.FROM_WHS || detailLines[0]?.FromWarehouse || '01';
  const docToWhs = document?.TO_WHS || document?.ToWarehouse || detailLines[0]?.WHSCODE || detailLines[0]?.ToWarehouse || '13';
  const isInterWhsTransfer = isTransfer && docFromWhs && docToWhs && String(docFromWhs).toUpperCase() !== String(docToWhs).toUpperCase();
  const transferHeaderComments = document?.COMMENTS || document?.COMENTARIO || document?.Comments || '';

  return (
    <Modal
        title={
          <div className="sga-modal-header-container">
            {/* Título adaptado al tipo de documento */}
            <div className="sga-modal-header-title">
              {isTransfer ? (
                isInterWhsTransfer ? (
                  <span>🔄 Traslado Entre Almacenes #{document.DOCNUM || document.DOCENTRY} (Alm. #{docFromWhs} ➔ Alm. #{docToWhs})</span>
                ) : (
                  <span>📦 Traslado Interno #{document.DOCNUM || document.DOCENTRY} (Almacén #{docFromWhs})</span>
                )
              ) : isPurchase ? (
                <span>📥 Pedido de Compra #{document.DOCNUM || document.DOCENTRY} ({document.CARDNAME || 'Proveedor'})</span>
              ) : isSalesReturn ? (
                <span>📥 Devolución de Venta #{document.DOCNUM || document.DOCENTRY} ({document.CARDNAME || 'Cliente'})</span>
              ) : isPurchaseReturn ? (
                <span>📤 Devolución de Compra #{document.DOCNUM || document.DOCENTRY} ({document.CARDNAME || 'Proveedor'})</span>
              ) : (
                <span>Detalle Pedido {document.DOCNUM || document.DOCENTRY} ({document.CARDNAME || 'Sin Asignar'})</span>
              )}
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
                    controls={false}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.target.select()}
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

              {/* Botón Semi (Solo para pedidos de venta estándar) */}
              {!isPurchase && !isTransfer && !isReturn && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleSemiPreparar}
                  className="sga-btn-modal-semi"
                >
                  Semi
                </Button>
              )}

              {/* Botón Entrega Parcial (para pedidos semi-preparados o con líneas confirmadas en venta) */}
              {!isPurchase && !isTransfer && !isReturn && !isAllConfirmed && (hasPartialPrep || hasAnyConfirmed) && (
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

        {/* Banner informativo de Traslado (si aplica) */}
        {isTransfer && (
          <div style={{
            backgroundColor: isInterWhsTransfer ? '#fff7ed' : '#eff6ff',
            border: `1px solid ${isInterWhsTransfer ? '#fed7aa' : '#bfdbfe'}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 10,
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 800, color: isInterWhsTransfer ? '#c2410c' : '#1d4ed8' }}>
                {isInterWhsTransfer ? (
                  <span>🔄 Solicitud de Traslado Entre Almacenes: <Tag color="orange" style={{ margin: '0 4px', fontWeight: 800 }}>Origen: Alm. #{docFromWhs}</Tag> ➔ <Tag color="blue" style={{ margin: '0 4px', fontWeight: 800 }}>Destino: Alm. #{docToWhs}</Tag></span>
                ) : (
                  <span>📦 Traslado Interno dentro del mismo almacén: <Tag color="blue" style={{ margin: '0 4px', fontWeight: 800 }}>Almacén #{docFromWhs}</Tag></span>
                )}
              </div>
              {transferHeaderComments && (
                <div style={{ color: '#334155', fontWeight: 600 }}>
                  💬 Asunto / Comentarios: <em>"{transferHeaderComments}"</em>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── CONTENEDOR DE TARJETAS DE LÍNEAS ── */}
        <div className="sga-modal-lines-scroll">
          {loadingLines ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 12, color: '#64748b', fontSize: '0.9rem' }}>
                Consultando líneas de artículo y stock disponible en SAP...
              </div>
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
              const lineFromWhs = line.FROM_WHS || line.FromWarehouse || docFromWhs;
              const lineToWhs = line.WHSCODE || line.ToWarehouse || docToWhs;

              // Verificar si la línea ya tiene preparación confirmada
              const ctdConfirmada = getLinePreparedQty(line, idx);
              const preparada = preparedQtys[idx] ?? (ctdConfirmada > 0 ? ctdConfirmada : total);
              const isLineComplete = isLineFullyConfirmed(line, idx);
              const isLinePartial = isLineWithAnyPrep(line, idx) && !isLineComplete;
              const isLineConfirmed = isLineComplete || isLinePartial;

              // Preparaciones previas registradas en NC_SGAWEB_DOCS para esta línea
              const sgaPrepForLine = (lineasPreparadas || []).filter(p =>
                String(p.U_ItemCode || '').toUpperCase() === String(line.ITEMCODE || '').toUpperCase() &&
                (p.U_PedidoLine == null || Number(p.U_PedidoLine) === (line.LINENUM != null ? Number(line.LINENUM) : idx))
              );

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

              // Verificación de Escaneo de Artículo (ItemCode, BarCode, U_Tipoproducto)
              const itemVal = itemValidationStatus[idx];
              const scannedVal = (scannedItems[idx] || '').trim().toUpperCase();
              const isItemVerified = itemVal?.isValid === true || (scannedVal.length > 0 && scannedVal === (line.ITEMCODE || '').toUpperCase());
              const isItemInvalid = itemVal?.isValid === false;

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

                        {isTransfer ? (
                          <span className="sga-badge-whs" style={{ backgroundColor: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' }}>
                            <ShopOutlined style={{ marginRight: 4 }} /> {lineFromWhs} ➔ {lineToWhs}
                          </span>
                        ) : (
                          <span className="sga-badge-whs">
                            <ShopOutlined style={{ marginRight: 4 }} /> Alm: {whsCode}
                          </span>
                        )}

                        <span
                          className="sga-badge-bin-default"
                          title="Haz clic para cambiar la ubicación predeterminada en SAP"
                          onClick={() => handleOpenChangeDefaultBin(line, idx)}
                          style={{ cursor: 'pointer' }}
                        >
                          <EnvironmentOutlined /> {defaultBin} <EditOutlined style={{ fontSize: '0.7rem', marginLeft: 3, opacity: 0.8 }} />
                        </span>
                      </div>

                      {/* Badge de estado: Confirmada Completa / Semi-Preparada / Pendiente */}
                      {isLineComplete ? (
                        <span className="sga-badge-confirmed">
                          <CheckCircleFilled style={{ fontSize: 13 }} /> Confirmada {ctdConfirmada} ud.
                        </span>
                      ) : (isLinePartial && !isInbound && !isReturn) ? (
                        <span style={{
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fcd34d',
                          color: '#b45309',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <CheckCircleOutlined style={{ fontSize: 13 }} /> Parcial: {ctdConfirmada}/{total}
                        </span>
                      ) : (
                        <span className="sga-badge-pending">
                          ⬜ Pendiente
                        </span>
                      )}
                    </div>

                    <div className="sga-item-title">
                      {line.ITEMNAME || 'Sin descripción'}
                    </div>

                    {/* 3. ALERTAS DE PREPARACIÓN PARCIAL (Si existen en NC_SGAWEB_DOCS) */}
                    {sgaPrepForLine.length > 0 && (
                      <div className="sga-alert-sga-prep">
                        <div className="sga-alert-sga-prep-title">
                          <CheckCircleOutlined /> Preparaciones previas registradas:
                        </div>
                        {sgaPrepForLine.map((p, pIdx) => (
                          <div key={pIdx} className="sga-alert-sga-prep-item">
                            <span>
                              Lote/Doc: <strong>#{p.DocEntry}</strong> | De: <strong>{p.U_BinFrom || 'N/A'}</strong> ➜ A: <strong>{p.U_BinTo || '01-PDTE'}</strong> | Cantidad: <strong>{p.U_Quantity} ud.</strong>
                            </span>
                            <Popconfirm
                              title="¿Eliminar esta preparación?"
                              description="Se liberará el stock asignado a este pedido."
                              onConfirm={() => handleDeleteSgaPrep(p.DocEntry)}
                              okText="Sí, eliminar"
                              cancelText="Cancelar"
                              okButtonProps={{ danger: true }}
                            >
                              <Button
                                size="small"
                                danger
                                type="link"
                                icon={<DeleteOutlined />}
                                style={{ padding: 0 }}
                              >
                                Borrar
                              </Button>
                            </Popconfirm>
                          </div>
                        ))}
                      </div>
                    )}

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
                                {itemVal?.isChecking ? (
                                  <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                                ) : isItemVerified ? (
                                  <CheckOutlined style={{ color: '#198754', fontWeight: 800, fontSize: 16 }} />
                                ) : isItemInvalid ? (
                                  <CloseCircleFilled style={{ color: '#ef4444', fontSize: 16 }} />
                                ) : null}
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
                            placeholder="Escanear ItemCode, Código de barras o Tipo..."
                            value={scannedItems[idx] || ''}
                            onChange={(e) => handleItemScanChange(idx, line, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.target.select()}
                            size="large"
                            style={{
                              borderRadius: 8,
                              borderColor: isItemVerified ? '#198754' : isItemInvalid ? '#ef4444' : '#d9d9d9',
                              boxShadow: isItemVerified ? '0 0 0 2px rgba(25, 135, 84, 0.1)' : isItemInvalid ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
                            }}
                          />
                        </div>

                        {isItemVerified && (
                          <CheckCircleFilled style={{ color: '#198754', fontSize: 24, flexShrink: 0 }} />
                        )}
                        {isItemInvalid && (
                          <CloseCircleFilled style={{ color: '#ef4444', fontSize: 24, flexShrink: 0 }} />
                        )}

                        <Button
                          icon={<PrinterOutlined />}
                          onClick={() => handlePrintItemLabel(line)}
                          size="large"
                          style={{ borderRadius: 8, borderColor: '#d9d9d9', flexShrink: 0 }}
                        />
                      </div>
                      {isItemInvalid && (
                        <div style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CloseCircleFilled /> {itemVal?.errorMsg || `El código no coincide con ${line.ITEMCODE}`}
                        </div>
                      )}
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
                      /* Modo Solicitud de Traslado: Origen y Destino */
                      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* 2a. Ubicación de Origen */}
                        <div>
                          <div className="sga-step-title">
                            2a. Seleccionar Ubicación Origen (Almacén #{lineFromWhs}) <span className="sga-step-required">*</span>
                            {!currentBin && <span className="sga-step-tag-mandatory">Obligatorio</span>}
                          </div>
                          <div className="sga-step-row">
                            <div className="sga-step-input-wrap">
                              <Select
                                showSearch
                                allowClear
                                placeholder={binOptions.length > 0 ? `Selecciona ubicación origen (Alm. #${lineFromWhs})...` : `Escribe ubicación origen (Alm. #${lineFromWhs})...`}
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
                                    No hay ubicaciones con stock en Alm. #{lineFromWhs}. Puedes escribir el código manualmente.
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
                            2b. Seleccionar Ubicación Destino (Almacén #{lineToWhs}) <span className="sga-step-required">*</span>
                            {!selectedBinsTo[idx] && <span className="sga-step-tag-mandatory">Obligatorio</span>}
                          </div>
                          <div className="sga-step-row">
                            <div className="sga-step-input-wrap">
                              <Input
                                prefix={<EnvironmentOutlined style={{ color: binToValidationStatus[idx]?.isValid ? '#198754' : binToValidationStatus[idx]?.isValid === false ? '#ef4444' : '#0d6efd' }} />}
                                suffix={
                                  binToValidationStatus[idx]?.isChecking ? (
                                    <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                                  ) : binToValidationStatus[idx]?.isValid ? (
                                    <CheckCircleFilled style={{ color: '#198754', fontSize: 18 }} />
                                  ) : binToValidationStatus[idx]?.isValid === false ? (
                                    <CloseCircleFilled style={{ color: '#ef4444', fontSize: 18 }} />
                                  ) : null
                                }
                                placeholder={`Escanear o escribir ubicación destino en Alm. #${lineToWhs}...`}
                                value={selectedBinsTo[idx] || ''}
                                onChange={(e) => handleBinToChange(idx, e.target.value, lineToWhs)}
                                size="large"
                                style={{
                                  borderRadius: 8,
                                  borderColor: binToValidationStatus[idx]?.isValid ? '#198754' : binToValidationStatus[idx]?.isValid === false ? '#ef4444' : selectedBinsTo[idx] ? '#198754' : '#d9d9d9',
                                  boxShadow: binToValidationStatus[idx]?.isValid ? '0 0 0 2px rgba(25, 135, 84, 0.1)' : binToValidationStatus[idx]?.isValid === false ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
                                }}
                              />
                            </div>
                            <Button
                              icon={<PrinterOutlined />}
                              onClick={() => handlePrintBinLabel(selectedBinsTo[idx])}
                              disabled={!selectedBinsTo[idx]}
                              size="large"
                              style={{ borderRadius: 8, borderColor: '#d9d9d9', flexShrink: 0 }}
                            />
                          </div>
                          {binToValidationStatus[idx]?.isValid === false && (
                            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.78rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CloseCircleFilled /> {binToValidationStatus[idx]?.errorMsg}
                            </div>
                          )}
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
                              <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.88rem' }}>
                                <BulbOutlined style={{ color: '#0d6efd', marginRight: 6 }} /> Necesidades ({line.NECESIDADES.length})
                              </span>
                            ),
                            children: (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {line.NECESIDADES.map((nec, nIdx) => {
                                  const isTraslado = nec.OBJTYPE === '1250000001' || nec.TIPO === 'Solicitud de Traslado';
                                  const isLlamada = (nec.LLAMADA && parseInt(nec.LLAMADA) > 0) || nec.TIPO === 'Llamada' || nec.OBJTYPE === 'LLAMADA' || nec.OBJTYPE === '191';
                                  const docNum = nec.DOCNUM || nec.DocNum || nec.DOCENTRY || nec.LLAMADA || (nIdx + 1);
                                  const fromWhs = nec.FROM_WHS || nec.FromWarehouse || '01';
                                  const toWhs = nec.TO_WHS || nec.ToWarehouse || '13';
                                  const cliente = nec.CARDNAME || nec.CardName || (isTraslado ? `Traslado Alm. ${fromWhs} ➔ Alm. ${toWhs}` : '');
                                  const observaciones = nec.COMENTARIO || nec.Comments || nec.COMENTARIO_LLAMADA || '';
                                  const cantVal = Number(nec.QTY ?? nec.CANTIDAD ?? nec.QUANTITY ?? 0);
                                  const compVal = Number(nec.COMPROMETIDO ?? nec.COMMITTED ?? nec.Committed ?? cantVal);
                                  const rawDate = nec.DOCDATE || nec.DocDate || nec.FECHA || nec.TaxDate || '';
                                  const fecha = rawDate ? String(rawDate).split('T')[0] : '';
                                  const llamadaNum = nec.LLAMADA || (isLlamada ? docNum : null);
                                  const llamadaEstado = nec.ESTADO_LLAMADA || nec.STATUS || nec.U_Estado || nec.ASUNTO_LLAMADA || '';
                                  const titlePrefix = isTraslado ? 'Traslado' : isLlamada ? 'Llamada' : 'Pedido';

                                  return (
                                    <div
                                      key={nIdx}
                                      style={{
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        padding: '12px 14px',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                                      }}
                                    >
                                      {/* Fila 1: Título y Badges */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
                                          {titlePrefix} {docNum}
                                        </span>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                          <span style={{
                                            backgroundColor: '#475569',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: 6
                                          }}>
                                            Cant: {cantVal.toFixed(1)}
                                          </span>
                                          <span style={{
                                            backgroundColor: '#f59e0b',
                                            color: '#000000',
                                            fontWeight: 800,
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: 6,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4
                                          }}>
                                            <LockFilled style={{ fontSize: '0.7rem' }} /> Comp: {compVal.toFixed(1)}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Fila 2: Fecha */}
                                      {fecha && (
                                        <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span>📅</span>
                                          <span>Fecha: <strong style={{ color: '#1e293b' }}>{fecha}</strong></span>
                                        </div>
                                      )}

                                      {/* Fila 3: Llamada */}
                                      {llamadaNum && (
                                        <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span>⚙️</span>
                                          <span>Llamada: <strong style={{ color: '#1e293b' }}>{llamadaNum}{llamadaEstado ? ` (${llamadaEstado})` : ''}</strong></span>
                                        </div>
                                      )}

                                      {/* Fila 4: Cliente */}
                                      {cliente && (
                                        <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span>🏢</span>
                                          <span>Cliente: <strong style={{ color: '#1e293b' }}>{cliente}</strong></span>
                                        </div>
                                      )}

                                      {/* Fila 5: Observaciones */}
                                      {observaciones && observaciones !== '-' && (
                                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                                          <div style={{ color: '#0284c7', fontSize: '0.82rem', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <MessageOutlined style={{ color: '#0284c7' }} /> Observaciones:
                                          </div>
                                          <div style={{
                                            backgroundColor: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 8,
                                            padding: '10px 12px',
                                            color: '#1e293b',
                                            fontSize: '0.82rem',
                                            lineHeight: 1.5,
                                            whiteSpace: 'pre-line'
                                          }}>
                                            {observaciones}
                                          </div>
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

        {/* Modal para cambiar la ubicación predeterminada en SAP */}
        <ChangeDefaultBinModal
          open={changeBinModal.open}
          itemCode={changeBinModal.itemCode}
          itemName={changeBinModal.itemName}
          whsCode={changeBinModal.whsCode}
          currentBin={changeBinModal.currentBin}
          ubisList={changeBinModal.ubisList}
          onClose={() => setChangeBinModal(prev => ({ ...prev, open: false }))}
          onSuccess={handleDefaultBinSuccess}
        />
      </Modal>
  );
};
