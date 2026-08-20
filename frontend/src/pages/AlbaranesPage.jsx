import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Pagination, Row, Col, Input, Select, Button, message, Badge, Tag } from 'antd';
import { ClearOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import client from '../utils/client';
import { useAuth } from '../context/AuthContext';
import { AlbaranList } from '../components/albaranes/AlbaranList';
import { AlbaranDetailModal } from '../components/albaranes/AlbaranDetailModal';

const { Title } = Typography;

export const AlbaranesPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isSuper = user?.is_super || user?.nivel === 'S';

  const [rawAlbaranes, setRawAlbaranes] = useState([]);
  const [operariosList, setOperariosList] = useState([]);
  const [clientesValorados, setClientesValorados] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const [filters, setFilters] = useState({
    docnum: '',
    cliente: '',
    operario_id: ''
  });

  const [selectedAlbaranDocEntry, setSelectedAlbaranDocEntry] = useState(null);

  // Mapa de ID de operario -> Nombre para mostrar en tarjetas
  const operariosMap = useMemo(() => {
    const map = {};
    operariosList.forEach((op) => {
      map[op.id] = op.name || op.user;
    });
    return map;
  }, [operariosList]);

  useEffect(() => {
    setFilters({ docnum: '', cliente: '', operario_id: '' });
    setPage(1);
    fetchAlbaranes('');
    fetchClientesValorados();
    if (isSuper) {
      fetchOperarios();
    }
  }, [location.key, isSuper]);

  const fetchClientesValorados = async () => {
    try {
      const res = await client.get('/albaranes/clientes-valorados');
      if (res.status === 'ok' && res.clientes_valorados) {
        setClientesValorados(new Set(res.clientes_valorados.map(c => String(c).trim().toUpperCase())));
      }
    } catch (err) {
      console.warn('No se pudo precargar clientes valorados:', err);
    }
  };

  const fetchOperarios = async () => {
    try {
      const res = await client.get('/albaranes/operarios');
      if (res.status === 'ok') {
        setOperariosList(res.operarios || []);
      }
    } catch (err) {
      console.warn('No se pudo cargar lista de operarios:', err);
    }
  };

  const fetchAlbaranes = async (overrideOperarioId = undefined) => {
    setLoading(true);
    try {
      const currentOpId = overrideOperarioId !== undefined ? overrideOperarioId : filters.operario_id;
      const params = {
        page: 1,
        per_page: 200,
        operario_id: currentOpId || undefined
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

    if (field === 'operario_id') {
      fetchAlbaranes(value);
    }
  };

  const handleResetFilters = () => {
    setFilters({ docnum: '', cliente: '', operario_id: '' });
    setPage(1);
    fetchAlbaranes('');
  };

  // Filtrado instantáneo en memoria para número y cliente
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
  }, [rawAlbaranes, filters.docnum, filters.cliente]);

  // Paginación en memoria
  const paginatedAlbaranes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAlbaranes.slice(start, start + pageSize);
  }, [filteredAlbaranes, page, pageSize]);

  const hasActiveFilters = Boolean(filters.docnum || filters.cliente || filters.operario_id);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#212529' }}>
            {isSuper ? 'Gestión de Albaranes' : 'Mis Albaranes'}
          </Title>
          <Badge
            count={filteredAlbaranes.length}
            overflowCount={999}
            style={{ backgroundColor: '#0d6efd', fontWeight: 700 }}
            title={`${filteredAlbaranes.length} albaranes encontrados`}
          />
        </div>

        {isSuper && (
          <Tag color="gold" icon={<CrownOutlined />} style={{ padding: '4px 10px', fontSize: '0.85rem', borderRadius: 6, fontWeight: 600 }}>
            Modo Supervisor (Vista Global de Operarios)
          </Tag>
        )}
      </div>

      <div className="sga-filter-panel">
        <Row gutter={[12, 12]} align="top">
          {/* 1. Selector de Operario (Exclusivo para Supervisor) */}
          {isSuper && (
            <Col xs={24} sm={12} md={7}>
              <label className="sga-filter-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserOutlined style={{ color: '#0d6efd' }} /> Operario / Creador
              </label>
              <Select
                showSearch
                style={{ width: '100%' }}
                size="large"
                placeholder="Todos los operarios"
                value={filters.operario_id || ''}
                onChange={(val) => handleFilterChange('operario_id', val)}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={[
                  { label: '👥 Todos los operarios', value: '' },
                  ...operariosList.map((op) => ({
                    label: `${op.name} (${op.user || op.id})`,
                    value: op.id
                  }))
                ]}
              />
            </Col>
          )}

          {/* 2. Filtro por Número de Albarán */}
          <Col xs={24} sm={12} md={isSuper ? 7 : 10}>
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

          {/* 3. Filtro por Cliente */}
          <Col xs={24} sm={12} md={isSuper ? 7 : 10}>
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

          {/* 4. Botón Limpiar */}
          <Col xs={24} sm={12} md={isSuper ? 3 : 4} style={{ textAlign: 'right' }}>
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
        operariosMap={operariosMap}
        clientesValoradosSet={clientesValorados}
        isSuper={isSuper}
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
