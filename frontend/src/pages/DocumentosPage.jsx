import React, { useState, useEffect } from 'react';
import { Typography, Pagination, Row, Col, Input, Select, AutoComplete, Button, message } from 'antd';
import { SearchOutlined, ClearOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useLocation } from 'react-router-dom';
import client from '../utils/client';
import { useSocket } from '../context/SocketContext';
import { DocumentList } from '../components/docs/DocumentList';
import { DocumentDetailModal } from '../components/docs/DocumentDetailModal';
import { SemiPrepareModal } from '../components/docs/SemiPrepareModal';

const { Title } = Typography;

const TIPOS_VENTA_OPTIONS = [
  { label: 'Todos los tipos...', value: '' },
  { label: 'Alquiler', value: 'Alquiler' },
  { label: 'Consumible', value: 'Consumible' },
  { label: 'Reparaciones', value: 'Reparaciones' },
  { label: 'Recambios', value: 'Recambios' },
  { label: 'Maquinas', value: 'Maquinas' },
  { label: 'Otros', value: 'Otros' }
];

const ESTADO_PREPARACION_OPTIONS = [
  { label: 'Todos los estados', value: '' },
  { label: '🟠 En Preparación / Semi-preparados', value: 'en_preparacion' },
  { label: '⚪ Sin Iniciar', value: 'sin_iniciar' }
];

const DocFilterSchema = Yup.object().shape({
  cliente: Yup.string().trim(),
  search_docnum: Yup.string().trim(),
  tipo_venta: Yup.string().trim(),
  estado_preparacion: Yup.string().trim()
});

export const DocumentosPage = () => {
  const { socket } = useSocket();
  const location = useLocation();
  const initialObjType = location.state?.objType || '17';
  const [objType, setObjType] = useState(initialObjType);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Estados de Autocompletado / Sugerencias en vivo
  const [customerOptions, setCustomerOptions] = useState([]);
  const [docnumOptions, setDocnumOptions] = useState([]);

  const [selectedDetailDoc, setSelectedDetailDoc] = useState(null);
  const [selectedSemiPrepareDoc, setSelectedSemiPrepareDoc] = useState(null);

  const filterFormik = useFormik({
    initialValues: {
      cliente: '',
      search_docnum: '',
      tipo_venta: '',
      estado_preparacion: ''
    },
    validationSchema: DocFilterSchema,
    onSubmit: (values) => {
      fetchDocuments(objType, 1, values);
    }
  });

  const handleSearchCustomer = async (searchText = '') => {
    const term = (searchText || '').trim().toLowerCase();

    // Sugerencias de clientes desde los documentos cargados actualmente
    const localMatches = Array.from(
      new Set(
        documents
          .map((d) => d.CARDNAME)
          .filter(Boolean)
      )
    )
      .filter((name) => !term || name.toLowerCase().includes(term))
      .slice(0, 15)
      .map((name) => ({ value: name, label: name }));

    try {
      const res = await client.get('/search/customers', { params: { term } });
      if (res.status === 'ok' && Array.isArray(res.results) && res.results.length > 0) {
        setCustomerOptions(res.results);
        return;
      }
    } catch (e) {
      console.error('Error buscando clientes:', e);
    }

    setCustomerOptions(localMatches);
  };

  const handleSearchDocnum = async (searchText = '') => {
    const term = (searchText || '').replace('#', '').trim().toLowerCase();

    // Sugerencias ÚNICAMENTE de los documentos SGA activos cargados actualmente
    const localMatches = documents
      .filter((d) => {
        const numStr = String(d.DOCNUM || d.DOCENTRY || '').toLowerCase();
        return !term || numStr.includes(term);
      })
      .slice(0, 15)
      .map((d) => {
        const num = String(d.DOCNUM || d.DOCENTRY);
        return {
          value: num,
          label: `#${num} - ${d.CARDNAME || 'Cliente'}`
        };
      });

    try {
      const isInactive = location.state?.verInactivos ? 'true' : 'false';
      const res = await client.get('/search/docnums', {
        params: { term, objtype: objType, ver_inactivos: isInactive }
      });
      if (res.status === 'ok' && Array.isArray(res.results) && res.results.length > 0) {
        setDocnumOptions(res.results);
        return;
      }
    } catch (e) {
      console.error('Error buscando números de documento SGA:', e);
    }

    setDocnumOptions(localMatches);
  };

  useEffect(() => {
    // Solo lanzar sugerencias si el usuario ya tiene un término activo en el buscador.
    // Evita peticiones API vacías en cada recarga de la lista de documentos.
    if (filterFormik.values.cliente) handleSearchCustomer(filterFormik.values.cliente);
    if (filterFormik.values.search_docnum) handleSearchDocnum(filterFormik.values.search_docnum);
  }, [objType, documents]);

  useEffect(() => {
    if (location.state?.objType) {
      setObjType(location.state.objType);
    }
  }, [location.state]);

  useEffect(() => {
    fetchDocuments(objType, 1, filterFormik.values);
  }, [objType]);

  // Suscripción a WebSockets en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleSapUpdate = (data) => {
      // Si el usuario tiene un modal abierto trabajando, no recargar el fondo para evitar parpadeos
      if (selectedDetailDoc || selectedSemiPrepareDoc) {
        return;
      }
      if (data?.type === 'sap_new_order') {
        message.info('🔄 Actualización detectada en SAP: Recargando lista de pedidos...');
      }
      fetchDocuments(objType, page, filterFormik.values);
    };

    socket.on('sap_update', handleSapUpdate);
    return () => {
      socket.off('sap_update', handleSapUpdate);
    };
  }, [socket, objType, page, filterFormik.values, selectedDetailDoc, selectedSemiPrepareDoc]);

  const fetchDocuments = async (targetObjType, targetPage = 1, currentFilters = filterFormik.values) => {
    setLoading(true);
    try {
      const params = {
        page: targetPage,
        per_page: 50,
        cliente: currentFilters.cliente,
        docnum: currentFilters.search_docnum,
        tipo_venta: currentFilters.tipo_venta,
        ver_inactivos: location.state?.verInactivos ? 'true' : 'false'
      };

      const res = await client.get(`/docs/${targetObjType}`, { params });

      if (res.status === 'ok') {
        let fetchedDocs = res.pedidos || [];

        // El backend ya calcula IS_SEMI_PREPARADO, IS_COMPLETAMENTE_PREPARADO y CUENTA_PREPARADO
        // dentro del endpoint /api/docs/<objtype>, por lo que no se necesita un batch adicional.

        const clientTerm = (currentFilters.cliente || '').trim().toLowerCase();
        const docnumTerm = (currentFilters.search_docnum || '').replace('#', '').trim().toLowerCase();
        const tipoTerm = (currentFilters.tipo_venta || '').trim().toLowerCase();
        const estadoPrepTerm = currentFilters.estado_preparacion || '';

        if (clientTerm || docnumTerm || tipoTerm || estadoPrepTerm) {
          fetchedDocs = fetchedDocs.filter((doc) => {
            const docNumStr = String(doc.DOCNUM ?? doc.DOCENTRY ?? doc.DocNum ?? doc.DocEntry ?? '').toLowerCase();
            const cardNameStr = String(doc.CARDNAME ?? doc.CardName ?? '').toLowerCase();
            const cardCodeStr = String(doc.CARDCODE ?? doc.CardCode ?? '').toLowerCase();
            const tipoStr = String(doc.TIPOVENTA ?? doc.TipoVenta ?? '').toLowerCase();
            const gestionadas = doc.CUENTA_PREPARADO || 0;

            const matchDocnum = !docnumTerm || docNumStr.includes(docnumTerm);
            const matchClient = !clientTerm || cardNameStr.includes(clientTerm) || cardCodeStr.includes(clientTerm);
            const matchTipo = !tipoTerm || tipoStr.includes(tipoTerm);
            const matchEstado = !estadoPrepTerm ||
              (estadoPrepTerm === 'en_preparacion' && (gestionadas > 0 || doc.IS_SEMI_PREPARADO)) ||
              (estadoPrepTerm === 'sin_iniciar' && gestionadas === 0 && !doc.IS_SEMI_PREPARADO);

            return matchDocnum && matchClient && matchTipo && matchEstado;
          });
        }

        setDocuments(fetchedDocs);
        setTotalCount(res.total_count || fetchedDocs.length);
        setPage(targetPage);
      } else {
        message.error(res.message || 'Error cargando documentos');
      }
    } catch (err) {
      message.error(err.message || 'Error consultando pedidos en SAP SQL Server');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    filterFormik.resetForm({ values: { cliente: '', search_docnum: '', tipo_venta: '', estado_preparacion: '' } });
    fetchDocuments(objType, 1, { cliente: '', search_docnum: '', tipo_venta: '', estado_preparacion: '' });
  };

  const getTitle = () => {
    if (location.state?.verInactivos) return 'Pedidos Inactivos';
    if (objType === '17') return 'Pedidos Abiertos';
    if (objType === '234000031') return 'Devoluciones de Venta';
    if (objType === '22') return 'Pedidos de Compra';
    if (objType === '234000032') return 'Devoluciones de Compra';
    if (objType === '1250000001') return 'Solicitudes de Traslado';
    return 'Documentos';
  };

  const handleDeactivateDocument = async (doc) => {
    try {
      const isInactiveView = location.state?.verInactivos;
      const endpoint = isInactiveView ? '/activar-pedido' : '/desactivar-pedido';
      const actionText = isInactiveView ? 'activado' : 'desactivado';

      const res = await client.post(endpoint, { docentry: doc.DOCENTRY || doc.DOCNUM });
      if (res.status === 'ok') {
        message.success(res.message || `Pedido #${doc.DOCNUM || doc.DOCENTRY} ${actionText} correctamente`);
        fetchDocuments(objType, page, filterFormik.values);
      } else {
        message.error(res.message || `Error al ${actionText} pedido`);
      }
    } catch (err) {
      message.error(err.message || 'Error en comunicación con el servidor');
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 12px' }}>
      <Title level={2} style={{ marginBottom: 16, fontWeight: 700, color: '#212529', fontSize: '1.5rem' }}>
        {getTitle()}
      </Title>

      <div className="sga-filter-panel">
        <form onSubmit={filterFormik.handleSubmit}>
          <Row gutter={[12, 12]} align="top">
            {/* Cliente Descripcion con Sugerencias Estilo Google */}
            <Col xs={24} sm={12} md={5}>
              <label className="sga-filter-label">
                Cliente Descripción
              </label>
              <AutoComplete
                options={customerOptions}
                value={filterFormik.values.cliente}
                onChange={(val) => {
                  filterFormik.setFieldValue('cliente', val || '');
                  handleSearchCustomer(val || '');
                }}
                onSelect={(val) => {
                  filterFormik.setFieldValue('cliente', val || '');
                  fetchDocuments(objType, 1, { ...filterFormik.values, cliente: val || '' });
                }}
                style={{ width: '100%' }}
                size="large"
              >
                <Input
                  placeholder="Nombre o código cliente..."
                  onPressEnter={filterFormik.handleSubmit}
                  allowClear
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </AutoComplete>
            </Col>

            {/* Num Documento con Sugerencias Estilo Google */}
            <Col xs={24} sm={12} md={4}>
              <label className="sga-filter-label">
                Num Documento
              </label>
              <AutoComplete
                options={docnumOptions}
                value={filterFormik.values.search_docnum}
                onChange={(val) => {
                  filterFormik.setFieldValue('search_docnum', val || '');
                  handleSearchDocnum(val || '');
                }}
                onSelect={(val) => {
                  filterFormik.setFieldValue('search_docnum', val || '');
                  fetchDocuments(objType, 1, { ...filterFormik.values, search_docnum: val || '' });
                }}
                style={{ width: '100%' }}
                size="large"
              >
                <Input
                  placeholder="Número..."
                  onPressEnter={filterFormik.handleSubmit}
                  allowClear
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </AutoComplete>
            </Col>

            {/* Tipo Venta */}
            <Col xs={24} sm={12} md={5}>
              <label className="sga-filter-label">
                Tipo Venta
              </label>
              <Select
                name="tipo_venta"
                value={filterFormik.values.tipo_venta}
                onChange={(val) => filterFormik.setFieldValue('tipo_venta', val)}
                size="large"
                style={{ width: '100%', borderRadius: 8 }}
                options={TIPOS_VENTA_OPTIONS}
              />
            </Col>

            {/* Estado Preparación */}
            <Col xs={24} sm={12} md={5}>
              <label className="sga-filter-label">
                Estado Preparación
              </label>
              <Select
                name="estado_preparacion"
                value={filterFormik.values.estado_preparacion}
                onChange={(val) => filterFormik.setFieldValue('estado_preparacion', val)}
                size="large"
                style={{ width: '100%', borderRadius: 8 }}
                options={ESTADO_PREPARACION_OPTIONS}
              />
            </Col>

            {/* Botones de Acción */}
            <Col xs={24} sm={24} md={5}>
              <div className="sga-filter-label-spacer" />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SearchOutlined />}
                  loading={loading}
                  size="large"
                  className="sga-btn-filter-primary"
                  style={{ flex: 1 }}
                >
                  Filtrar
                </Button>

                <Button
                  icon={<ClearOutlined />}
                  onClick={handleResetFilters}
                  size="large"
                  className="sga-btn-filter-secondary"
                  style={{ flex: 1 }}
                >
                  Limpiar
                </Button>
              </div>
            </Col>
          </Row>
        </form>
      </div>

      <DocumentList
        documents={documents}
        loading={loading}
        onOpenDetail={(doc) => setSelectedDetailDoc(doc)}
        onDeactivateDocument={handleDeactivateDocument}
      />

      {/* ── LEYENDA DE COLORES EN EL FOOTER ── */}
      <div
        style={{
          marginTop: 24,
          padding: '14px 20px',
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            {/* Azul - Disponible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#0d6efd', boxShadow: '0 0 0 2px #9ec5fe' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                <strong>🔵 Azul:</strong> Stock Disponible (Sin Iniciar)
              </span>
            </div>

            {/* Naranja - Stock Parcial */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#f97316', boxShadow: '0 0 0 2px #fed7aa' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                <strong>🟠 Naranja:</strong> Stock Parcial
              </span>
            </div>

            {/* Amarillo - Semi-preparado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#f59e0b', boxShadow: '0 0 0 2px #fcd34d' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                <strong>🟡 Amarillo:</strong> Semi-Preparado
              </span>
            </div>

            {/* Turquesa - Preparado Completo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#00bcd4', boxShadow: '0 0 0 2px #80deea' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                <strong>🟢 Turquesa:</strong> Preparado Completo (100%)
              </span>
            </div>

            {/* Rojo - Sin Stock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#ef4444', boxShadow: '0 0 0 2px #fca5a5' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                <strong>🔴 Rojo:</strong> Sin Stock
              </span>
            </div>
          </div>
        </div>
      </div>

      {totalCount > 20 && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Pagination
            current={page}
            total={totalCount}
            pageSize={20}
            onChange={(p) => fetchDocuments(objType, p, filterFormik.values)}
            showSizeChanger={false}
          />
        </div>
      )}

      <DocumentDetailModal
        open={!!selectedDetailDoc}
        document={selectedDetailDoc}
        onClose={() => setSelectedDetailDoc(null)}
        onSuccess={() => fetchDocuments(objType, page, filterFormik.values)}
        onOpenSemiPrepare={(doc) => {
          setSelectedDetailDoc(null);
          setSelectedSemiPrepareDoc(doc);
        }}
      />

      <SemiPrepareModal
        open={!!selectedSemiPrepareDoc}
        document={selectedSemiPrepareDoc}
        onClose={() => setSelectedSemiPrepareDoc(null)}
        onSuccess={() => fetchDocuments(objType, page, filterFormik.values)}
      />
    </div>
  );
};
