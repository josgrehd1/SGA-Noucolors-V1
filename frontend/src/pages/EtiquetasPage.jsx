import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Input,
  InputNumber,
  Select,
  Button,
  Row,
  Col,
  Segmented,
  Table,
  Tag,
  Space,
  Typography,
  message,
  Divider,
  Empty,
  Tooltip,
  Modal,
  Spin
} from 'antd';
import {
  PrinterOutlined,
  BarcodeOutlined,
  EnvironmentOutlined,
  SearchOutlined,
  ClearOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  AppstoreOutlined,
  ShopOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import client from '../utils/client';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

export const EtiquetasPage = () => {
  const { activePrinter, printersList, setActivePrinter } = useAuth();

  // Tipo de etiqueta: 'products' | 'bins'
  const [printType, setPrintType] = useState('products');

  // Filtros de búsqueda
  const [searchItem, setSearchItem] = useState('');
  const [searchBin, setSearchBin] = useState('');
  const [selectedPrinter, setSelectedPrinter] = useState(activePrinter || '');

  // Estados de resultados y carga
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [printingId, setPrintingId] = useState(null);
  const [bulkPrinting, setBulkPrinting] = useState(false);

  // Resultados para Productos
  const [productResults, setProductResults] = useState([]);
  const [selectedProductKeys, setSelectedProductKeys] = useState([]);
  const [productCopies, setProductCopies] = useState({});

  // Resultados para Ubicaciones
  const [binResults, setBinResults] = useState([]);
  const [binCopies, setBinCopies] = useState({});

  const itemInputRef = useRef(null);
  const binInputRef = useRef(null);

  // Estados de validación en tiempo real
  const [itemValidation, setItemValidation] = useState(null); // { status: 'validating'|'valid'|'invalid', realCode, name, msg }
  const [binProdValidation, setBinProdValidation] = useState(null); // { status: 'validating'|'valid'|'invalid', whs, msg }
  const [binPrintValidation, setBinPrintValidation] = useState(null); // { status: 'validating'|'valid'|'invalid', whs, msg }

  // Sincronizar impresora activa desde el contexto
  useEffect(() => {
    if (activePrinter && !selectedPrinter) {
      setSelectedPrinter(activePrinter);
    }
  }, [activePrinter]);

  // Autofocus al cambiar de tipo
  useEffect(() => {
    setTimeout(() => {
      if (printType === 'products') {
        itemInputRef.current?.focus();
      } else {
        binInputRef.current?.focus();
      }
    }, 150);
  }, [printType]);

  // Verificación en tiempo real de artículo
  const verifyItemCode = async (rawCode) => {
    const clean = (rawCode || '').trim().toUpperCase().replace(/\//g, '-');
    if (!clean) {
      setItemValidation(null);
      return;
    }

    setItemValidation({ status: 'validating', msg: 'Verificando en SAP...' });
    try {
      const res = await client.get('/producto-existe', { params: { 'prod-search': clean } });
      if (res.existe) {
        const real = (res.real_itemcode || clean).toUpperCase();
        const name = res.itemname || res.productos?.[0]?.ItemName || 'Artículo identificado';
        setItemValidation({
          status: 'valid',
          realCode: real,
          name: name,
          msg: `${real} - ${name}`
        });
      } else {
        setItemValidation({
          status: 'invalid',
          realCode: null,
          name: null,
          msg: `El artículo o código '${clean}' no existe en SAP`
        });
      }
    } catch {
      setItemValidation({
        status: 'invalid',
        realCode: null,
        name: null,
        msg: 'Error consultando artículo en SAP'
      });
    }
  };

  // Verificación en tiempo real de ubicación (en modo productos)
  const verifyBinProd = async (rawBin) => {
    const clean = (rawBin || '').trim().toUpperCase().replace(/\//g, '-');
    if (!clean) {
      setBinProdValidation(null);
      return;
    }

    setBinProdValidation({ status: 'validating', msg: 'Verificando ubicación...' });
    try {
      const res = await client.get(`/ubicacion-existe/${encodeURIComponent(clean)}`);
      if (res.existe) {
        const whs = res.bin_whscode || clean.split('-')[0] || '01';
        setBinProdValidation({
          status: 'valid',
          whs: whs,
          msg: `Alm. #${whs} (Válida en SAP)`
        });
      } else {
        setBinProdValidation({
          status: 'invalid',
          whs: null,
          msg: res.message || `La ubicación '${clean}' no existe en SAP`
        });
      }
    } catch {
      setBinProdValidation({
        status: 'invalid',
        whs: null,
        msg: 'Error consultando ubicación en SAP'
      });
    }
  };

  // Verificación en tiempo real de ubicación (en modo ubicaciones)
  const verifyBinPrint = async (rawBin) => {
    const clean = (rawBin || '').trim().toUpperCase().replace(/\//g, '-');
    if (!clean) {
      setBinPrintValidation(null);
      return;
    }

    setBinPrintValidation({ status: 'validating', msg: 'Verificando ubicación...' });
    try {
      const res = await client.get(`/ubicacion-existe/${encodeURIComponent(clean)}`);
      if (res.existe) {
        const whs = res.bin_whscode || clean.split('-')[0] || '01';
        setBinPrintValidation({
          status: 'valid',
          whs: whs,
          msg: `Alm. #${whs} (Válida en SAP)`
        });
      } else {
        setBinPrintValidation({
          status: 'invalid',
          whs: null,
          msg: res.message || `La ubicación '${clean}' no existe en SAP`
        });
      }
    } catch {
      setBinPrintValidation({
        status: 'invalid',
        whs: null,
        msg: 'Error consultando ubicación en SAP'
      });
    }
  };

  // 1. Búsqueda de Productos
  const handleSearchProducts = async () => {
    const cleanItem = (searchItem || '').trim().toUpperCase().replace(/\//g, '-');
    const cleanBin = (searchBin || '').trim().toUpperCase().replace(/\//g, '-');

    if (!cleanItem && !cleanBin) {
      message.warning('Introduce un código de artículo, descripción o ubicación para buscar.');
      return;
    }

    // Si la ubicación está introducida y es inválida, no buscar
    if (binProdValidation && binProdValidation.status === 'invalid') {
      message.error(binProdValidation.msg);
      return;
    }

    setLoadingSearch(true);
    try {
      // Si se especificó ubicación pero no artículo, traer los artículos de esa ubicación
      if (cleanBin && !cleanItem) {
        const binStockRes = await client.get(`/get-bin-stock-info/${encodeURIComponent(cleanBin)}`);
        if (binStockRes.datos && Array.isArray(binStockRes.datos) && binStockRes.datos.length > 0) {
          const mapped = binStockRes.datos.map((p, idx) => ({
            key: p.ItemCode || `prod-${idx}`,
            ItemCode: p.ItemCode,
            ItemName: p.ItemName || p.ItemDescription || 'Sin descripción',
            BinCode: cleanBin,
            Stock: Number(p.BINQTY ?? 0),
            OnHand: Number(p.OnHand ?? p.BINQTY ?? 0)
          }));
          setProductResults(mapped);
          const initCopies = {};
          mapped.forEach(m => { initCopies[m.ItemCode] = 1; });
          setProductCopies(initCopies);
          message.success(`Se encontraron ${mapped.length} artículos en la ubicación ${cleanBin}`);
          return;
        }
      }

      // Búsqueda estándar por artículo / stock
      const res = await client.get('/stock', {
        params: {
          itemcode: itemValidation?.realCode || cleanItem || undefined,
          ubicacion: cleanBin || undefined,
          per_page: 50
        }
      });

      if (res.status === 'ok' && res.productos) {
        const mapped = res.productos.map(p => ({
          key: p.ItemCode,
          ItemCode: p.ItemCode,
          ItemName: p.ItemName,
          BinCode: p.UbiDefecto || p.Ubicacion || cleanBin || '-',
          Stock: Number(p.StockAlmacen ?? p.Stock ?? 0),
          OnHand: Number(p.StockAlmacen ?? p.Stock ?? 0)
        }));
        setProductResults(mapped);
        const initCopies = {};
        mapped.forEach(m => { initCopies[m.ItemCode] = 1; });
        setProductCopies(initCopies);

        if (mapped.length === 0) {
          message.info('No se encontraron artículos con los criterios especificados.');
        } else {
          message.success(`Se encontraron ${mapped.length} artículos coincidentes.`);
        }
      } else {
        setProductResults([]);
        message.info('No se encontraron productos.');
      }
    } catch (err) {
      message.error(err.message || 'Error buscando artículos');
    } finally {
      setLoadingSearch(false);
    }
  };

  // 2. Búsqueda y Validación de Ubicaciones
  const handleSearchBins = async () => {
    const cleanBin = (searchBin || '').trim().toUpperCase().replace(/\//g, '-');
    if (!cleanBin) {
      message.warning('Introduce un código de ubicación para buscar.');
      return;
    }

    setLoadingSearch(true);
    try {
      const res = await client.get(`/ubicacion-existe/${encodeURIComponent(cleanBin)}`);
      if (res.existe) {
        const whs = res.bin_whscode || cleanBin.split('-')[0] || '01';
        const binItem = {
          key: cleanBin,
          BinCode: cleanBin,
          Warehouse: whs,
          StockTotal: res.stock_disponible ?? 0
        };

        setBinPrintValidation({
          status: 'valid',
          whs: whs,
          msg: `Alm. #${whs} (Válida en SAP)`
        });

        // Si ya está en la lista no duplicar
        if (!binResults.some(b => b.BinCode === cleanBin)) {
          setBinResults([binItem, ...binResults]);
          setBinCopies(prev => ({ ...prev, [cleanBin]: 1 }));
        }
        message.success(`Ubicación ${cleanBin} verificada correctamente.`);
        setSearchBin('');
      } else {
        setBinPrintValidation({
          status: 'invalid',
          whs: null,
          msg: res.message || `La ubicación '${cleanBin}' no existe en SAP`
        });
        message.error(res.message || `La ubicación '${cleanBin}' no existe en SAP`);
      }
    } catch (err) {
      message.error('Error comprobando ubicación en SAP');
    } finally {
      setLoadingSearch(false);
    }
  };

  // 3. Imprimir Etiqueta de Producto Individual
  const handlePrintSingleProduct = async (product) => {
    if (!selectedPrinter) {
      message.warning('Selecciona una impresora Zebra antes de imprimir.');
      return;
    }

    const copies = productCopies[product.ItemCode] || 1;
    setPrintingId(product.ItemCode);
    try {
      const payload = {
        product_id: product.ItemCode,
        product_name: product.ItemName,
        copies: copies,
        printer_id: selectedPrinter
      };

      const res = await client.post('/print/product', payload);
      if (res.status === 'ok') {
        message.success(`Etiqueta de ${product.ItemCode} enviada (${copies} ${copies === 1 ? 'copia' : 'copias'})`);
      } else {
        message.error(res.message || 'Error enviando etiqueta a impresora');
      }
    } catch (err) {
      message.error(err.message || 'Error en el servicio de impresión');
    } finally {
      setPrintingId(null);
    }
  };

  // 4. Imprimir Selección Masiva de Productos
  const handlePrintBulkProducts = async () => {
    if (!selectedPrinter) {
      message.warning('Selecciona una impresora Zebra antes de imprimir.');
      return;
    }
    if (selectedProductKeys.length === 0) {
      message.warning('Selecciona al menos un artículo para imprimir.');
      return;
    }

    const selectedItems = productResults.filter(p => selectedProductKeys.includes(p.key));
    const totalLabels = selectedItems.reduce((acc, p) => acc + (productCopies[p.ItemCode] || 1), 0);

    Modal.confirm({
      title: '¿Confirmar impresión masiva?',
      content: `Se enviarán a la impresora ${selectedItems.length} artículos distintos (Total: ${totalLabels} etiquetas).`,
      okText: 'Sí, imprimir todo',
      cancelText: 'Cancelar',
      onOk: async () => {
        setBulkPrinting(true);
        let successCount = 0;
        for (const item of selectedItems) {
          try {
            const copies = productCopies[item.ItemCode] || 1;
            await client.post('/print/product', {
              product_id: item.ItemCode,
              product_name: item.ItemName,
              copies: copies,
              printer_id: selectedPrinter
            });
            successCount++;
          } catch {
            // Continuar con los demás
          }
        }
        setBulkPrinting(false);
        message.success(`Impresión completada: ${successCount} de ${selectedItems.length} productos lanzados`);
      }
    });
  };

  // 5. Imprimir Etiqueta de Ubicación
  const handlePrintBin = async (binItem) => {
    if (!selectedPrinter) {
      message.warning('Selecciona una impresora Zebra antes de imprimir.');
      return;
    }

    const copies = binCopies[binItem.BinCode] || 1;
    setPrintingId(binItem.BinCode);
    try {
      const res = await client.post('/print/bin', {
        bin: binItem.BinCode,
        copies: copies,
        printer_id: selectedPrinter
      });
      if (res.status === 'ok') {
        message.success(`Etiqueta de ubicación ${binItem.BinCode} enviada (${copies} ${copies === 1 ? 'copia' : 'copias'})`);
      } else {
        message.error(res.message || 'Error enviando etiqueta de ubicación');
      }
    } catch (err) {
      message.error(err.message || 'Error en el servicio de impresión');
    } finally {
      setPrintingId(null);
    }
  };

  // Columnas para la tabla de Productos
  const productColumns = [
    {
      title: 'Artículo / SKU',
      dataIndex: 'ItemCode',
      key: 'ItemCode',
      width: 170,
      render: (code) => (
        <Space size={4}>
          <BarcodeOutlined style={{ color: '#0d6efd' }} />
          <strong style={{ color: '#0f172a' }}>{code}</strong>
        </Space>
      )
    },
    {
      title: 'Descripción',
      dataIndex: 'ItemName',
      key: 'ItemName',
      ellipsis: true,
      render: (name) => <span style={{ color: '#334155' }}>{name}</span>
    },
    {
      title: 'Ubicación',
      dataIndex: 'BinCode',
      key: 'BinCode',
      width: 150,
      render: (bin) => (
        bin && bin !== '-' ? (
          <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
            {bin}
          </Tag>
        ) : (
          <span style={{ color: '#94a3b8' }}>-</span>
        )
      )
    },
    {
      title: 'Stock',
      dataIndex: 'Stock',
      key: 'Stock',
      width: 100,
      align: 'center',
      render: (stock) => (
        <span style={{ fontWeight: 700, color: stock > 0 ? '#16a34a' : '#94a3b8' }}>
          {stock} u.
        </span>
      )
    },
    {
      title: 'Ctd. Etiquetas',
      key: 'copies',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <InputNumber
          min={1}
          max={99}
          size="middle"
          value={productCopies[record.ItemCode] || 1}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.target.select()}
          onChange={(val) => setProductCopies({ ...productCopies, [record.ItemCode]: val || 1 })}
          style={{ width: 70, borderRadius: 6, textAlign: 'center', fontWeight: 700 }}
        />
      )
    },
    {
      title: 'Acción',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          loading={printingId === record.ItemCode}
          onClick={() => handlePrintSingleProduct(record)}
          size="middle"
          style={{
            borderRadius: 6,
            fontWeight: 600,
            backgroundColor: '#0d6efd',
            borderColor: '#0d6efd'
          }}
        >
          Imprimir
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1300, margin: '0 auto' }}>
      {/* Título & Selector de Impresora Principal */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PrinterOutlined style={{ fontSize: 22, color: '#0d6efd' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
              Centro de Impresión de Etiquetas ZPL
            </h2>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>
            Genera e imprime etiquetas Zebra térmicas para artículos, paquetes y estanterías.
          </p>
        </div>

        {/* Selector de Impresora Ancho y No Truncado */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#ffffff',
          padding: '8px 14px',
          borderRadius: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0'
        }}>
          <PrinterOutlined style={{ color: selectedPrinter ? '#16a34a' : '#94a3b8', fontSize: 18 }} />
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Impresora Zebra Activa
            </div>
            <Select
              style={{ minWidth: 260, maxWidth: 380 }}
              value={selectedPrinter || undefined}
              placeholder="Seleccionar impresora Zebra..."
              onChange={(val) => {
                setSelectedPrinter(val);
                if (setActivePrinter) setActivePrinter(val);
              }}
              options={printersList.map((p) => ({
                label: `${p.value || p.name || p.key} (${p.key})`,
                value: p.key
              }))}
              variant="borderless"
              popupMatchSelectWidth={false}
              styles={{ popup: { root: { minWidth: 300 } } }}
            />
          </div>
        </div>
      </div>

      {/* Tarjeta de Control & Búsqueda */}
      <Card
        styles={{ body: { padding: '16px 18px' } }}
        style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          {/* Selector de Tipo: Productos vs Ubicaciones */}
          <Segmented
            options={[
              { label: 'Etiquetas de Productos', value: 'products', icon: <BarcodeOutlined /> },
              { label: 'Etiquetas de Ubicaciones / Estanterías', value: 'bins', icon: <EnvironmentOutlined /> }
            ]}
            value={printType}
            onChange={(val) => {
              setPrintType(val);
              setProductResults([]);
              setBinResults([]);
            }}
            size="large"
            style={{ fontWeight: 700, backgroundColor: '#f1f5f9' }}
          />

          <Space>
            <Button
              icon={<ClearOutlined />}
              onClick={() => {
                setSearchItem('');
                setSearchBin('');
                setProductResults([]);
                setBinResults([]);
              }}
              size="middle"
            >
              Limpiar
            </Button>
          </Space>
        </div>

        {/* 1. Formulario Dinámico: PRODUCTOS */}
        {printType === 'products' && (
          <Row gutter={[14, 14]} align="top">
            <Col xs={24} sm={14} md={12}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: '0.82rem', color: '#334155', height: 18, lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Código de Artículo / EAN / Descripción:
              </label>
              <Input
                ref={itemInputRef}
                prefix={<BarcodeOutlined style={{ color: itemValidation?.status === 'valid' ? '#16a34a' : itemValidation?.status === 'invalid' ? '#ef4444' : '#0d6efd' }} />}
                suffix={
                  itemValidation?.status === 'validating' ? (
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                  ) : itemValidation?.status === 'valid' ? (
                    <CheckCircleFilled style={{ color: '#16a34a', fontSize: 17 }} />
                  ) : itemValidation?.status === 'invalid' ? (
                    <CloseCircleFilled style={{ color: '#ef4444', fontSize: 17 }} />
                  ) : null
                }
                placeholder="Escanear o escribir artículo (ej. AKURB320002)..."
                size="large"
                value={searchItem}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/\//g, '-');
                  setSearchItem(val);
                  if (itemValidation) setItemValidation(null);
                }}
                onBlur={() => verifyItemCode(searchItem)}
                onPressEnter={() => {
                  verifyItemCode(searchItem);
                  handleSearchProducts();
                }}
                style={{
                  borderRadius: 8,
                  height: 40,
                  borderColor: itemValidation?.status === 'valid' ? '#16a34a' : itemValidation?.status === 'invalid' ? '#ef4444' : '#d9d9d9',
                  boxShadow: itemValidation?.status === 'valid' ? '0 0 0 2px rgba(22, 163, 74, 0.1)' : itemValidation?.status === 'invalid' ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
                }}
                allowClear
              />
              <div style={{ minHeight: 20, marginTop: 4 }}>
                {itemValidation?.msg && (
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: itemValidation.status === 'valid' ? '#16a34a' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {itemValidation.status === 'valid' ? <CheckCircleFilled /> : <CloseCircleFilled />}
                    <span title={itemValidation.msg}>{itemValidation.msg}</span>
                  </div>
                )}
              </div>
            </Col>

            <Col xs={24} sm={10} md={8}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: '0.82rem', color: '#64748b', height: 18, lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Filtrar por Ubicación (Opcional):
              </label>
              <Input
                prefix={<EnvironmentOutlined style={{ color: binProdValidation?.status === 'valid' ? '#16a34a' : binProdValidation?.status === 'invalid' ? '#ef4444' : '#64748b' }} />}
                suffix={
                  binProdValidation?.status === 'validating' ? (
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                  ) : binProdValidation?.status === 'valid' ? (
                    <CheckCircleFilled style={{ color: '#16a34a', fontSize: 17 }} />
                  ) : binProdValidation?.status === 'invalid' ? (
                    <CloseCircleFilled style={{ color: '#ef4444', fontSize: 17 }} />
                  ) : null
                }
                placeholder="ej. 01-10-00-00 (Para listar balda)"
                size="large"
                value={searchBin}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/\//g, '-');
                  setSearchBin(val);
                  if (binProdValidation) setBinProdValidation(null);
                }}
                onBlur={() => verifyBinProd(searchBin)}
                onPressEnter={() => {
                  verifyBinProd(searchBin);
                  handleSearchProducts();
                }}
                style={{
                  borderRadius: 8,
                  height: 40,
                  borderColor: binProdValidation?.status === 'valid' ? '#16a34a' : binProdValidation?.status === 'invalid' ? '#ef4444' : '#d9d9d9',
                  boxShadow: binProdValidation?.status === 'valid' ? '0 0 0 2px rgba(22, 163, 74, 0.1)' : binProdValidation?.status === 'invalid' ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
                }}
                allowClear
              />
              <div style={{ minHeight: 20, marginTop: 4 }}>
                {binProdValidation?.msg && (
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: binProdValidation.status === 'valid' ? '#16a34a' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {binProdValidation.status === 'valid' ? <CheckCircleFilled /> : <CloseCircleFilled />}
                    {binProdValidation.msg}
                  </div>
                )}
              </div>
            </Col>

            <Col xs={24} md={4}>
              <div style={{ height: 18, marginBottom: 6 }} />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                loading={loadingSearch}
                onClick={handleSearchProducts}
                size="large"
                block
                style={{
                  borderRadius: 8,
                  height: 40,
                  fontWeight: 700,
                  backgroundColor: '#0d6efd',
                  borderColor: '#0d6efd'
                }}
              >
                Buscar
              </Button>
              <div style={{ minHeight: 20, marginTop: 4 }} />
            </Col>
          </Row>
        )}

        {/* 2. Formulario Dinámico: UBICACIONES */}
        {printType === 'bins' && (
          <Row gutter={[14, 14]} align="top">
            <Col xs={24} sm={16} md={18}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: '0.82rem', color: '#334155', height: 18, lineHeight: '18px' }}>
                Código de Ubicación a Imprimir:
              </label>
              <Input
                ref={binInputRef}
                prefix={<EnvironmentOutlined style={{ color: binPrintValidation?.status === 'valid' ? '#16a34a' : binPrintValidation?.status === 'invalid' ? '#ef4444' : '#16a34a' }} />}
                suffix={
                  binPrintValidation?.status === 'validating' ? (
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                  ) : binPrintValidation?.status === 'valid' ? (
                    <CheckCircleFilled style={{ color: '#16a34a', fontSize: 17 }} />
                  ) : binPrintValidation?.status === 'invalid' ? (
                    <CloseCircleFilled style={{ color: '#ef4444', fontSize: 17 }} />
                  ) : null
                }
                placeholder="Escanear o escribir ubicación (ej. 01-10-00-00 o 01-PDTE)..."
                size="large"
                value={searchBin}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/\//g, '-');
                  setSearchBin(val);
                  if (binPrintValidation) setBinPrintValidation(null);
                }}
                onBlur={() => verifyBinPrint(searchBin)}
                onPressEnter={handleSearchBins}
                style={{
                  borderRadius: 8,
                  height: 40,
                  borderColor: binPrintValidation?.status === 'valid' ? '#16a34a' : binPrintValidation?.status === 'invalid' ? '#ef4444' : '#d9d9d9',
                  boxShadow: binPrintValidation?.status === 'valid' ? '0 0 0 2px rgba(22, 163, 74, 0.1)' : binPrintValidation?.status === 'invalid' ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
                }}
                allowClear
              />
              <div style={{ minHeight: 20, marginTop: 4 }}>
                {binPrintValidation?.msg && (
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: binPrintValidation.status === 'valid' ? '#16a34a' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {binPrintValidation.status === 'valid' ? <CheckCircleFilled /> : <CloseCircleFilled />}
                    {binPrintValidation.msg}
                  </div>
                )}
              </div>
            </Col>

            <Col xs={24} sm={8} md={6}>
              <div style={{ height: 18, marginBottom: 6 }} />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                loading={loadingSearch}
                onClick={handleSearchBins}
                size="large"
                block
                style={{
                  borderRadius: 8,
                  height: 40,
                  fontWeight: 700,
                  backgroundColor: '#16a34a',
                  borderColor: '#16a34a'
                }}
              >
                Añadir Ubicación
              </Button>
              <div style={{ minHeight: 20, marginTop: 4 }} />
            </Col>
          </Row>
        )}
      </Card>

      {/* Resultados de Productos */}
      {printType === 'products' && (
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Space>
                <AppstoreOutlined style={{ color: '#0d6efd' }} />
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                  Artículos Encontrados ({productResults.length})
                </span>
              </Space>

              {selectedProductKeys.length > 0 && (
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  loading={bulkPrinting}
                  onClick={handlePrintBulkProducts}
                  size="middle"
                  style={{ borderRadius: 6, fontWeight: 700, backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  Imprimir Seleccionados ({selectedProductKeys.length})
                </Button>
              )}
            </div>
          }
          styles={{ body: { padding: 0 } }}
          style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}
        >
          <Table
            dataSource={productResults}
            columns={productColumns}
            rowSelection={{
              selectedRowKeys: selectedProductKeys,
              onChange: (keys) => setSelectedProductKeys(keys)
            }}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Usa el buscador superior para encontrar artículos o escanear un código de barras."
                />
              )
            }}
            size="middle"
          />
        </Card>
      )}

      {/* Resultados de Ubicaciones */}
      {printType === 'bins' && (
        <Card
          title={
            <Space>
              <EnvironmentOutlined style={{ color: '#16a34a' }} />
              <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                Etiquetas de Ubicación Listas para Imprimir ({binResults.length})
              </span>
            </Space>
          }
          styles={{ body: { padding: '16px' } }}
          style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          {binResults.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Introduce o escanea el código de una ubicación arriba para añadirla a la lista de impresión."
            />
          ) : (
            <Row gutter={[14, 14]}>
              {binResults.map((b) => (
                <Col xs={24} sm={12} md={8} key={b.BinCode}>
                  <div style={{
                    border: '1px solid #bbf7d0',
                    backgroundColor: '#f0fdf4',
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <EnvironmentOutlined style={{ color: '#16a34a', fontSize: 16 }} />
                        <strong style={{ fontSize: '1.05rem', color: '#1e293b' }}>{b.BinCode}</strong>
                      </div>
                      <Tag color="green" style={{ fontWeight: 700, borderRadius: 6, margin: 0 }}>
                        Alm. #{b.Warehouse}
                      </Tag>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      📦 Formato: Etiqueta de Estantería / Bin ZPL
                    </div>

                    <Divider style={{ margin: '4px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>Copias:</span>
                        <InputNumber
                          min={1}
                          max={99}
                          value={binCopies[b.BinCode] || 1}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.target.select()}
                          onChange={(val) => setBinCopies({ ...binCopies, [b.BinCode]: val || 1 })}
                          style={{ width: 65, borderRadius: 6, textAlign: 'center', fontWeight: 700 }}
                        />
                      </div>

                      <Button
                        type="primary"
                        icon={<PrinterOutlined />}
                        loading={printingId === b.BinCode}
                        onClick={() => handlePrintBin(b)}
                        style={{
                          borderRadius: 6,
                          fontWeight: 700,
                          backgroundColor: '#16a34a',
                          borderColor: '#16a34a'
                        }}
                      >
                        Imprimir
                      </Button>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      )}
    </div>
  );
};

export default EtiquetasPage;
