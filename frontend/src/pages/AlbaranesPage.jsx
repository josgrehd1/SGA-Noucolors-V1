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

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 8,
          padding: '16px',
          marginBottom: 20,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
          border: '1px solid #dee2e6'
        }}
      >
        <form onSubmit={filterFormik.handleSubmit}>
          <Row gutter={[16, 16]} align="bottom">
            <Col xs={24} sm={12} md={8}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#6c757d', marginBottom: 4 }}>
                Num Albarán
              </label>
              <Input
                name="docnum"
                placeholder="Número de albarán..."
                value={filterFormik.values.docnum}
                onChange={filterFormik.handleChange}
                onPressEnter={filterFormik.handleSubmit}
                allowClear
              />
            </Col>

            <Col xs={24} sm={12} md={8}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#6c757d', marginBottom: 4 }}>
                Cliente
              </label>
              <Input
                name="cliente"
                placeholder="Código o nombre cliente..."
                value={filterFormik.values.cliente}
                onChange={filterFormik.handleChange}
                onPressEnter={filterFormik.handleSubmit}
                allowClear
              />
            </Col>

            <Col xs={24} sm={24} md={8} style={{ textAlign: 'right' }}>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SearchOutlined />}
                  loading={loading}
                  style={{ backgroundColor: '#0d6efd', borderColor: '#0d6efd', fontWeight: 600 }}
                >
                  Buscar
                </Button>
                <Button icon={<ClearOutlined />} onClick={handleResetFilters} style={{ fontWeight: 600 }}>
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
