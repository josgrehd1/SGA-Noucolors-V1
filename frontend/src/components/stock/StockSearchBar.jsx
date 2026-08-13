import React from 'react';
import { Row, Col, Input, Checkbox, Button, Card, Space, Tooltip } from 'antd';
import { SearchOutlined, ClearOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';

const StockSearchSchema = Yup.object().shape({
  itemcode: Yup.string().trim(),
  ubicacion: Yup.string().trim(),
  con_stock: Yup.boolean()
});

export const StockSearchBar = ({ filters, onSearch, onReset, loading }) => {
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      itemcode: filters.itemcode || '',
      ubicacion: filters.ubicacion || '',
      con_stock: filters.con_stock || false
    },
    validationSchema: StockSearchSchema,
    onSubmit: (values) => {
      onSearch(values);
    }
  });

  const handleClear = () => {
    formik.resetForm({
      values: { itemcode: '', ubicacion: '', con_stock: false }
    });
    onReset();
  };

  return (
    <Card className="sga-filter-panel" styles={{ body: { padding: '14px 18px' } }}>
      <form onSubmit={formik.handleSubmit}>
        <Row gutter={[12, 12]} align="middle">
          {/* Buscar por Código / Nombre */}
          <Col xs={24} sm={12} md={7} lg={7}>
            <Input
              name="itemcode"
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Buscar por código o nombre..."
              value={formik.values.itemcode}
              onChange={formik.handleChange}
              onPressEnter={formik.handleSubmit}
              allowClear
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Col>

          {/* Buscar por Ubicación / Almacén */}
          <Col xs={24} sm={12} md={6} lg={6}>
            <Input
              name="ubicacion"
              prefix={<EnvironmentOutlined style={{ color: '#3b82f6' }} />}
              placeholder="Ubicación / Almacén (ej. A-01)"
              value={formik.values.ubicacion}
              onChange={formik.handleChange}
              onPressEnter={formik.handleSubmit}
              allowClear
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Col>

          {/* Checkbox Solo con stock */}
          <Col xs={24} sm={12} md={5} lg={5}>
            <Checkbox
              name="con_stock"
              checked={formik.values.con_stock}
              onChange={(e) => {
                formik.setFieldValue('con_stock', e.target.checked);
                formik.handleSubmit();
              }}
              style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}
            >
              Solo con stock
            </Checkbox>
          </Col>

          {/* Botones Compactos Inline */}
          <Col xs={24} sm={12} md={6} lg={6} style={{ textAlign: 'right' }}>
            <Space size={8} wrap justify="end">
              <Button
                type="primary"
                htmlType="submit"
                icon={<SearchOutlined />}
                loading={loading}
                size="large"
                className="sga-btn-filter-primary"
                style={{ padding: '0 18px' }}
              >
                Buscar
              </Button>

              {(formik.values.itemcode || formik.values.ubicacion || formik.values.con_stock) && (
                <Tooltip title="Limpiar filtros">
                  <Button
                    icon={<ClearOutlined />}
                    onClick={handleClear}
                    size="large"
                    className="sga-btn-filter-secondary"
                  >
                    Limpiar
                  </Button>
                </Tooltip>
              )}
            </Space>
          </Col>
        </Row>
      </form>
    </Card>
  );
};

export default StockSearchBar;
