import React, { useState, useEffect } from 'react';
import { Typography, Pagination, Row, Col, Input, Select, Button, message } from 'antd';
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

const DocFilterSchema = Yup.object().shape({
  cliente: Yup.string().trim(),
  search_docnum: Yup.string().trim(),
  tipo_venta: Yup.string().trim()
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

  const [selectedDetailDoc, setSelectedDetailDoc] = useState(null);
  const [selectedSemiPrepareDoc, setSelectedSemiPrepareDoc] = useState(null);

  const filterFormik = useFormik({
    initialValues: {
      cliente: '',
      search_docnum: '',
      tipo_venta: ''
    },
    validationSchema: DocFilterSchema,
    onSubmit: (values) => {
      fetchDocuments(objType, 1, values);
    }
  });

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
      console.log('[WebSocket Event Received] Actualizando vista de documentos...', data);
      fetchDocuments(objType, page, filterFormik.values);
    };

    socket.on('sap_update', handleSapUpdate);
    return () => {
      socket.off('sap_update', handleSapUpdate);
    };
  }, [socket, objType, page, filterFormik.values]);

  const fetchDocuments = async (targetObjType, targetPage = 1, currentFilters = filterFormik.values) => {
    setLoading(true);
    try {
      const params = {
        page: targetPage,
        per_page: 20,
        cliente: currentFilters.cliente,
        docnum: currentFilters.search_docnum,
        tipo_venta: currentFilters.tipo_venta,
        ver_inactivos: location.state?.verInactivos ? 'true' : 'false'
      };
      const res = await client.get(`/docs/${targetObjType}`, { params });
      if (res.status === 'ok') {
        setDocuments(res.pedidos || []);
        setTotalCount(res.total_count || 0);
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
    filterFormik.resetForm({ values: { cliente: '', search_docnum: '', tipo_venta: '' } });
    fetchDocuments(objType, 1, { cliente: '', search_docnum: '', tipo_venta: '' });
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

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 12px' }}>
      <Title level={2} style={{ marginBottom: 16, fontWeight: 700, color: '#212529', fontSize: '1.5rem' }}>
        {getTitle()}
      </Title>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: '16px',
          marginBottom: 20,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
          border: '1px solid #dee2e6'
        }}
      >
        <form onSubmit={filterFormik.handleSubmit}>
          <Row gutter={[12, 12]} align="bottom">
            {/* Cliente Descripcion */}
            <Col xs={24} sm={12} md={8}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#6c757d', marginBottom: 4 }}>
                Cliente Descripcion
              </label>
              <Input
                name="cliente"
                placeholder="Seleccionar cliente o buscar..."
                value={filterFormik.values.cliente}
                onChange={filterFormik.handleChange}
                onPressEnter={filterFormik.handleSubmit}
                allowClear
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Col>

            {/* Num Documento */}
            <Col xs={24} sm={12} md={8}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#6c757d', marginBottom: 4 }}>
                Num Documento
              </label>
              <Input
                name="search_docnum"
                placeholder="Número de documento..."
                value={filterFormik.values.search_docnum}
                onChange={filterFormik.handleChange}
                onPressEnter={filterFormik.handleSubmit}
                allowClear
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Col>

            {/* Tipo Venta */}
            <Col xs={24} sm={12} md={8}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#6c757d', marginBottom: 4 }}>
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

            {/* Botones de Acción (Filtrar y Limpiar en Filas Independientes para Móviles) */}
            <Col xs={24} sm={12}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SearchOutlined />}
                loading={loading}
                block
                size="large"
                style={{ backgroundColor: '#1677ff', borderColor: '#1677ff', fontWeight: 700, borderRadius: 8, height: 44 }}
              >
                Filtrar
              </Button>
            </Col>

            <Col xs={24} sm={12}>
              <Button
                icon={<ClearOutlined />}
                onClick={handleResetFilters}
                block
                size="large"
                style={{ fontWeight: 700, borderRadius: 8, height: 44 }}
              >
                Limpiar
              </Button>
            </Col>
          </Row>
        </form>
      </div>

      <DocumentList
        documents={documents}
        loading={loading}
        onOpenDetail={(doc) => setSelectedDetailDoc(doc)}
      />

      {totalCount > 20 && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
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
