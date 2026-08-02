import React from 'react';
import { Row, Col, Input, Checkbox, Button, Card } from 'antd';
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
    <Card className="sga-filter-panel" style={{ marginBottom: 20, borderRadius: 12 }}>
      <form onSubmit={formik.handleSubmit}>
        <Row gutter={[12, 12]} align="middle">
          {/* Código o Descripción producto */}
          <Col xs={24} sm={12} md={8} lg={8}>
            <Input
              name="itemcode"
              placeholder="Código o Descripción producto..."
              value={formik.values.itemcode}
              onChange={formik.handleChange}
              onPressEnter={formik.handleSubmit}
              allowClear
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Col>

          {/* Ubicación o Almacén */}
          <Col xs={24} sm={12} md={8} lg={8}>
            <Input
              name="ubicacion"
              prefix={<EnvironmentOutlined style={{ color: '#1677ff' }} />}
              placeholder="Ubicación o Almacén (ej. A-01)"
              value={formik.values.ubicacion}
              onChange={formik.handleChange}
              onPressEnter={formik.handleSubmit}
              allowClear
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Col>

          {/* Checkbox solo con stock */}
          <Col xs={24} sm={8} md={8} lg={8}>
            <div style={{ padding: '4px 0' }}>
              <Checkbox
                name="con_stock"
                checked={formik.values.con_stock}
                onChange={(e) => formik.setFieldValue('con_stock', e.target.checked)}
                style={{ fontSize: '0.9rem', fontWeight: 600 }}
              >
                Solo con stock disponible
              </Checkbox>
            </div>
          </Col>

          {/* Botón Buscar - 1 Fila Completa en móviles/PDAs */}
          <Col xs={24} sm={12}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SearchOutlined />}
              loading={loading}
              size="large"
              block
              style={{
                backgroundColor: '#1677ff',
                borderColor: '#1677ff',
                fontWeight: 700,
                borderRadius: 8,
                height: 44
              }}
            >
              Buscar
            </Button>
          </Col>

          {/* Botón Limpiar - 1 Fila Completa en móviles/PDAs */}
          <Col xs={24} sm={12}>
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              size="large"
              block
              style={{
                fontWeight: 700,
                borderRadius: 8,
                height: 44
              }}
            >
              Limpiar
            </Button>
          </Col>
        </Row>
      </form>
    </Card>
  );
};
