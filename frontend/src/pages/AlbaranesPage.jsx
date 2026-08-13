import React, { useState, useEffect } from 'react';
import { Typography, Pagination, Row, Col, Input, Button, Space, message } from 'antd';
import { SearchOutlined, ClearOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import client from '../utils/client';
import { AlbaranList } from '../components/albaranes/AlbaranList';
import { AlbaranDetailModal } from '../components/albaranes/AlbaranDetailModal';

const { Title } = Typography;

const AlbaranFilterSchema = Yup.object().shape({
  docnum: Yup.string().trim(),
  cliente: Yup.string().trim()
});

export const AlbaranesPage = () => {
  const [albaranes, setAlbaranes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedAlbaranDocEntry, setSelectedAlbaranDocEntry] = useState(null);

  const filterFormik = useFormik({
    initialValues: {
      docnum: '',
      cliente: ''
    },
    validationSchema: AlbaranFilterSchema,
    onSubmit: (values) => {
      fetchAlbaranes(1, values);
    }
  });

  useEffect(() => {
    fetchAlbaranes(1, filterFormik.values);
  }, []);

  const fetchAlbaranes = async (targetPage = 1, currentFilters = filterFormik.values) => {
    setLoading(true);
    try {
      const params = {
        page: targetPage,
        per_page: 20,
        doc: currentFilters.docnum,
        cliente: currentFilters.cliente
      };
      const res = await client.get('/albaranes', { params });
      if (res.status === 'ok') {
        setAlbaranes(res.albaranes || []);
        setTotalCount(res.total_count || 0);
        setPage(targetPage);
      } else {
        message.error(res.message || 'Error cargando listado de albaranes');
      }
    } catch (err) {
      message.error(err.message || 'Error al consultar albaranes en SAP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    filterFormik.resetForm({ values: { docnum: '', cliente: '' } });
    fetchAlbaranes(1, { docnum: '', cliente: '' });
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 20, fontWeight: 700, color: '#212529' }}>
        Mis Albaranes
      </Title>

      <div className="sga-filter-panel">
        <form onSubmit={filterFormik.handleSubmit}>
          <Row gutter={[12, 12]} align="top">
            <Col xs={24} sm={12} md={9}>
              <label className="sga-filter-label">
                Num Albarán
              </label>
              <Input
                name="docnum"
                placeholder="Número de albarán..."
                value={filterFormik.values.docnum}
                onChange={filterFormik.handleChange}
                onPressEnter={filterFormik.handleSubmit}
                allowClear
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Col>

            <Col xs={24} sm={12} md={9}>
              <label className="sga-filter-label">
                Cliente
              </label>
              <Input
                name="cliente"
                placeholder="Código o nombre cliente..."
                value={filterFormik.values.cliente}
                onChange={filterFormik.handleChange}
                onPressEnter={filterFormik.handleSubmit}
                allowClear
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Col>

            <Col xs={24} sm={24} md={6} style={{ textAlign: 'right' }}>
              <div className="sga-filter-label-spacer" />
              <Space style={{ width: '100%', justify: 'end' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SearchOutlined />}
                  loading={loading}
                  size="large"
                  className="sga-btn-filter-primary"
                >
                  Buscar
                </Button>
                <Button
                  icon={<ClearOutlined />}
                  onClick={handleResetFilters}
                  size="large"
                  className="sga-btn-filter-secondary"
                >
                  Limpiar
                </Button>
              </Space>
            </Col>
          </Row>
        </form>
      </div>

      <AlbaranList
        albaranes={albaranes}
        loading={loading}
        onSelectAlbaran={(alb) => setSelectedAlbaranDocEntry(alb.DocEntry || alb.DOCENTRY)}
      />

      {totalCount > 20 && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Pagination
            current={page}
            total={totalCount}
            pageSize={20}
            onChange={(p) => fetchAlbaranes(p, filterFormik.values)}
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
