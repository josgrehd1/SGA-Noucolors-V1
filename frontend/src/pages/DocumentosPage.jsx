import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Pagination, Row, Col, Input, Select, AutoComplete, Button, message, Badge } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import client from '../utils/client';
import { useSocket } from '../context/SocketContext';
import { DocumentList } from '../components/docs/DocumentList';
import { DocumentDetailModal } from '../components/docs/DocumentDetailModal';
import { SemiPrepareModal } from '../components/docs/SemiPrepareModal';

const { Title, Text } = Typography;

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

export const DocumentosPage = () => {
  const { socket } = useSocket();
  const location = useLocation();
  const initialObjType = location.state?.objType || '17';
  const [objType, setObjType] = useState(initialObjType);

  // Datos en memoria cargados de SAP
  const [rawDocuments, setRawDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  // Estados de filtros instantáneos en memoria
  const [filters, setFilters] = useState({
    cliente: '',
    search_docnum: '',
    tipo_venta: '',
    estado_preparacion: ''
  });

  const [selectedDetailDoc, setSelectedDetailDoc] = useState(null);
  const [selectedSemiPrepareDoc, setSelectedSemiPrepareDoc] = useState(null);

  // Carga inicial y sincronización al cambiar ubicación o tipo de documento
  useEffect(() => {
    const nextObjType = location.state?.objType || '17';
    setObjType(nextObjType);
    // Limpiar todos los filtros al cambiar de sección o menú
    setFilters({
      cliente: '',
      search_docnum: '',
      tipo_venta: '',
      estado_preparacion: ''
    });
    setPage(1);
    fetchDocuments(nextObjType);
  }, [location.state?.objType, location.state?.verInactivos, location.key]);

  // Petición principal a SAP
  const fetchDocuments = async (targetObjType) => {
    const currentObjType = targetObjType || objType || '17';
    setLoading(true);
    try {
      const isVerInactivos = Boolean(location.state?.verInactivos);
      const params = {
        page: 1,
        per_page: 200,
        ver_inactivos: isVerInactivos ? 'true' : 'false'
      };

      const res = await client.get(`/docs/${currentObjType}`, { params });

      if (res.status === 'ok') {
        const fetched = res.pedidos || [];
        setRawDocuments(fetched);
      } else {
        message.error(res.message || 'Error cargando documentos');
      }
    } catch (err) {
      console.error('Error consultando pedidos en SAP:', err);
      message.error(err.message || 'Error consultando pedidos en SAP SQL Server');
    } finally {
      setLoading(false);
    }
  };

  // Suscripción a WebSockets en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleSapUpdate = (data) => {
      // Si el usuario tiene un modal abierto trabajando, no interrumpir
      if (selectedDetailDoc || selectedSemiPrepareDoc) {
        return;
      }
      if (data?.type === 'sap_new_order') {
        message.info('🔄 Actualización detectada en SAP: Sincronizando pedidos...');
      }
      fetchDocuments(objType);
    };

    socket.on('sap_update', handleSapUpdate);
    return () => {
      socket.off('sap_update', handleSapUpdate);
    };
  }, [socket, objType, selectedDetailDoc, selectedSemiPrepareDoc]);

  // Manejo de cambios en los filtros (Instantáneo en memoria)
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value
    }));
    setPage(1); // Volver a la primera página al cambiar cualquier filtro
  };

  const handleResetFilters = () => {
    setFilters({
      cliente: '',
      search_docnum: '',
      tipo_venta: '',
      estado_preparacion: ''
    });
    setPage(1);
  };

  // --------------------------------------------------------------------------
  // FILTRADO INSTANTÁNEO EN MEMORIA (0 ms de latencia)
  // --------------------------------------------------------------------------
  const filteredDocuments = useMemo(() => {
    const clientTerm = (filters.cliente || '').trim().toLowerCase();
    const docnumTerm = (filters.search_docnum || '').replace('#', '').trim().toLowerCase();
    const tipoTerm = (filters.tipo_venta || '').trim().toLowerCase();
    const estadoPrepTerm = filters.estado_preparacion || '';

    if (!clientTerm && !docnumTerm && !tipoTerm && !estadoPrepTerm) {
      return rawDocuments;
    }

    return rawDocuments.filter((doc) => {
      const docNumStr = String(doc.DOCNUM ?? doc.DOCENTRY ?? doc.DocNum ?? doc.DocEntry ?? '').toLowerCase();
      const cardNameStr = String(doc.CARDNAME ?? doc.CardName ?? '').toLowerCase();
      const cardCodeStr = String(doc.CARDCODE ?? doc.CardCode ?? '').toLowerCase();
      const tipoStr = String(doc.TIPOVENTA ?? doc.TipoVenta ?? '').toLowerCase();
      const totalLineas = doc.LINEAS?.length || (doc.DocumentLines?.length || 0);
      const gestionadas = Number(doc.CUENTA_PREPARADO) || 0;
      const isPurchase = String(doc.OBJTYPE || doc.ObjType) === '22';
      const isTransfer = String(doc.OBJTYPE || doc.ObjType) === '1250000001' || String(doc.OBJTYPE || doc.ObjType) === '67';
      const isSemiPropio = !isPurchase && !isTransfer && (
        Boolean(doc.IS_SEMI_PREPARADO) ||
        (doc.SGA_PREPARADAS && doc.SGA_PREPARADAS.length > 0) ||
        (gestionadas > 0 && gestionadas < totalLineas)
      );

      const matchDocnum = !docnumTerm || docNumStr.includes(docnumTerm);
      const matchClient = !clientTerm || cardNameStr.includes(clientTerm) || cardCodeStr.includes(clientTerm);
      const matchTipo = !tipoTerm || tipoStr.includes(tipoTerm);
      const matchEstado = !estadoPrepTerm ||
        (estadoPrepTerm === 'en_preparacion' && (isSemiPropio || doc.IS_SEMI_PREPARADO || gestionadas > 0)) ||
        (estadoPrepTerm === 'sin_iniciar' && !isSemiPropio && !doc.IS_SEMI_PREPARADO && gestionadas === 0);

      return matchDocnum && matchClient && matchTipo && matchEstado;
    });
  }, [rawDocuments, filters]);

  // Paginación instantánea en cliente
  const paginatedDocuments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDocuments.slice(start, start + pageSize);
  }, [filteredDocuments, page, pageSize]);

  // --------------------------------------------------------------------------
  // OPCIONES DE AUTOCOMPLETADO INSTANTÁNEAS (Desde la caché en memoria)
  // --------------------------------------------------------------------------
  const customerOptions = useMemo(() => {
    const term = (filters.cliente || '').trim().toLowerCase();
    const uniqueNames = Array.from(
      new Set(rawDocuments.map((d) => d.CARDNAME).filter(Boolean))
    );
    return uniqueNames
      .filter((name) => !term || name.toLowerCase().includes(term))
      .slice(0, 15)
      .map((name) => ({ value: name, label: name }));
  }, [rawDocuments, filters.cliente]);

  const docnumOptions = useMemo(() => {
    const term = (filters.search_docnum || '').replace('#', '').trim().toLowerCase();
    return rawDocuments
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
  }, [rawDocuments, filters.search_docnum]);

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
      const isInactiveView = Boolean(location.state?.verInactivos);
      const endpoint = isInactiveView ? '/activar-pedido' : '/desactivar-pedido';
      const actionText = isInactiveView ? 'activado' : 'desactivado';
      const docId = doc.DOCENTRY || doc.DOCNUM;

      const res = await client.post(endpoint, { docentry: docId });
      if (res.status === 'ok') {
        message.success(res.message || `Pedido #${doc.DOCNUM || doc.DOCENTRY} ${actionText} correctamente`);
        setRawDocuments((prev) => prev.filter((d) => (d.DOCENTRY || d.DOCNUM) !== docId));
        fetchDocuments(objType);
      } else {
        message.error(res.message || `Error al ${actionText} pedido`);
      }
    } catch (err) {
      message.error(err.message || 'Error en comunicación con el servidor');
    }
  };

  const hasActiveFilters = Boolean(
    filters.cliente || filters.search_docnum || filters.tipo_venta || filters.estado_preparacion
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 12px' }}>
      {/* Cabecera de Página con Título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#212529', fontSize: '1.5rem' }}>
          {getTitle()}
        </Title>
        <Badge
          count={filteredDocuments.length}
          overflowCount={999}
          style={{ backgroundColor: '#0d6efd', fontWeight: 700 }}
          title={`${filteredDocuments.length} pedidos encontrados`}
        />
      </div>

      {/* Panel de Filtros Instantáneos */}
      <div className="sga-filter-panel">
        <Row gutter={[12, 12]} align="top">
          {/* Cliente Descripción con Sugerencias Instantáneas */}
          <Col xs={24} sm={12} md={5}>
            <label className="sga-filter-label">
              Cliente Descripción
            </label>
            <AutoComplete
              options={customerOptions}
              value={filters.cliente}
              onChange={(val) => handleFilterChange('cliente', val || '')}
              onSelect={(val) => handleFilterChange('cliente', val || '')}
              style={{ width: '100%' }}
              size="large"
            >
              <Input
                placeholder="Filtrar cliente o código..."
                allowClear
                size="large"
                style={{ borderRadius: 8 }}
              />
            </AutoComplete>
          </Col>

          {/* Num Documento con Sugerencias Instantáneas */}
          <Col xs={24} sm={12} md={4}>
            <label className="sga-filter-label">
              Num Documento
            </label>
            <AutoComplete
              options={docnumOptions}
              value={filters.search_docnum}
              onChange={(val) => handleFilterChange('search_docnum', val || '')}
              onSelect={(val) => handleFilterChange('search_docnum', val || '')}
              style={{ width: '100%' }}
              size="large"
            >
              <Input
                placeholder="Ej: 1024..."
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
              value={filters.tipo_venta}
              onChange={(val) => handleFilterChange('tipo_venta', val)}
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
              value={filters.estado_preparacion}
              onChange={(val) => handleFilterChange('estado_preparacion', val)}
              size="large"
              style={{ width: '100%', borderRadius: 8 }}
              options={ESTADO_PREPARACION_OPTIONS}
            />
          </Col>

          {/* Botón Limpiar */}
          <Col xs={24} sm={24} md={5}>
            <div className="sga-filter-label-spacer" />
            <Button
              icon={<ClearOutlined />}
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              size="large"
              className="sga-btn-filter-secondary"
              style={{ width: '100%' }}
            >
              Limpiar Filtros
            </Button>
          </Col>
        </Row>
      </div>

      {/* Lista de Documentos Filtrada */}
      <DocumentList
        documents={paginatedDocuments}
        loading={loading}
        onOpenDetail={(doc) => setSelectedDetailDoc(doc)}
        onDeactivateDocument={handleDeactivateDocument}
        isInactiveView={Boolean(location.state?.verInactivos)}
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

      {/* Paginación Instantánea */}
      {filteredDocuments.length > pageSize && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Pagination
            current={page}
            total={filteredDocuments.length}
            pageSize={pageSize}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
          />
        </div>
      )}

      {/* Modales de Detalle y Semi-preparación */}
      <DocumentDetailModal
        open={!!selectedDetailDoc}
        document={selectedDetailDoc}
        onClose={() => setSelectedDetailDoc(null)}
        onSuccess={() => fetchDocuments(objType, false)}
        onOpenSemiPrepare={(doc) => {
          setSelectedDetailDoc(null);
          setSelectedSemiPrepareDoc(doc);
        }}
      />

      <SemiPrepareModal
        open={!!selectedSemiPrepareDoc}
        document={selectedSemiPrepareDoc}
        onClose={() => setSelectedSemiPrepareDoc(null)}
        onSuccess={() => fetchDocuments(objType, false)}
      />
    </div>
  );
};

export default DocumentosPage;
