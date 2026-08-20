import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Pagination, Row, Col, Input, Button, message, Badge } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import client from '../utils/client';
import { AlbaranList } from '../components/albaranes/AlbaranList';
import { AlbaranDetailModal } from '../components/albaranes/AlbaranDetailModal';

const { Title } = Typography;

export const AlbaranesPage = () => {
  const location = useLocation();
  const [rawAlbaranes, setRawAlbaranes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const [filters, setFilters] = useState({
    docnum: '',
    cliente: ''
  });

  const [selectedAlbaranDocEntry, setSelectedAlbaranDocEntry] = useState(null);

  useEffect(() => {
    setFilters({ docnum: '', cliente: '' });
    setPage(1);
    fetchAlbaranes();
  }, [location.key]);

  const fetchAlbaranes = async () => {
    setLoading(true);
    try {
      const params = {
        page: 1,
        per_page: 200
      };
      const res = await client.get('/albaranes', { params });
      if (res.status === 'ok') {
        setRawAlbaranes(res.albaranes || []);
      } else {
        message.error(res.message || 'Error cargando listado de albaranes');
      }
    } catch (err) {
      console.error('Error al consultar albaranes en SAP:', err);
      message.error(err.message || 'Error al consultar albaranes en SAP');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value
    }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ docnum: '', cliente: '' });
    setPage(1);
  };

  // Filtrado instantáneo en memoria (0 ms)
  const filteredAlbaranes = useMemo(() => {
    const docTerm = (filters.docnum || '').replace('#', '').trim().toLowerCase();
    const clientTerm = (filters.cliente || '').trim().toLowerCase();

    if (!docTerm && !clientTerm) {
      return rawAlbaranes;
    }

    return rawAlbaranes.filter((alb) => {
      const docNumStr = String(alb.DocNum || alb.DOCNUM || alb.DocEntry || alb.DOCENTRY || '').toLowerCase();
      const cardNameStr = String(alb.CardName || alb.CARDNAME || '').toLowerCase();
      const cardCodeStr = String(alb.CardCode || alb.CARDCODE || '').toLowerCase();

      const matchDoc = !docTerm || docNumStr.includes(docTerm);
      const matchClient = !clientTerm || cardNameStr.includes(clientTerm) || cardCodeStr.includes(clientTerm);

      return matchDoc && matchClient;
    });
  }, [rawAlbaranes, filters]);

  // Paginación en memoria
  const paginatedAlbaranes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAlbaranes.slice(start, start + pageSize);
  }, [filteredAlbaranes, page, pageSize]);

  const hasActiveFilters = Boolean(filters.docnum || filters.cliente);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#212529' }}>
          Mis Albaranes
        </Title>
        <Badge
          count={filteredAlbaranes.length}
          overflowCount={999}
          style={{ backgroundColor: '#0d6efd', fontWeight: 700 }}
          title={`${filteredAlbaranes.length} albaranes encontrados`}
        />
      </div>

      <div className="sga-filter-panel">
        <Row gutter={[12, 12]} align="top">
          <Col xs={24} sm={12} md={10}>
            <label className="sga-filter-label">
              Num Albarán
            </label>
            <Input
              placeholder="Filtrar por número de albarán..."
              value={filters.docnum}
              onChange={(e) => handleFilterChange('docnum', e.target.value)}
              allowClear
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Col>

          <Col xs={24} sm={12} md={10}>
            <label className="sga-filter-label">
              Cliente
            </label>
            <Input
              placeholder="Filtrar por código o nombre de cliente..."
              value={filters.cliente}
              onChange={(e) => handleFilterChange('cliente', e.target.value)}
              allowClear
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Col>

          <Col xs={24} sm={24} md={4} style={{ textAlign: 'right' }}>
            <div className="sga-filter-label-spacer" />
            <Button
              icon={<ClearOutlined />}
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              size="large"
              className="sga-btn-filter-secondary"
              style={{ width: '100%' }}
            >
              Limpiar
            </Button>
          </Col>
        </Row>
      </div>

      <AlbaranList
        albaranes={paginatedAlbaranes}
        loading={loading}
        onSelectAlbaran={(alb) => setSelectedAlbaranDocEntry(alb.DocEntry || alb.DOCENTRY)}
      />

      {filteredAlbaranes.length > pageSize && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Pagination
            current={page}
            total={filteredAlbaranes.length}
            pageSize={pageSize}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
          />
        </div>
      )}

      <AlbaranDetailModal
        docEntry={selectedAlbaranDocEntry}
        open={!!selectedAlbaranDocEntry}
        onClose={() => setSelectedAlbaranDocEntry(null)}
      />
    </div>
  );
};

export default AlbaranesPage;
