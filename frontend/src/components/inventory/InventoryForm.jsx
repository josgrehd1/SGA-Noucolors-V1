import React, { useState } from 'react';
import { Card, Input, InputNumber, Button, Row, Col, Select, message } from 'antd';
import { CheckOutlined, EnvironmentOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import client from '../../utils/client';

const InventorySchema = Yup.object().shape({
  bin_code: Yup.string()
    .trim()
    .min(2, 'La ubicación debe tener al menos 2 caracteres')
    .required('La ubicación es obligatoria'),
  item_code: Yup.string()
    .trim()
    .min(2, 'El código de producto debe tener al menos 2 caracteres')
    .required('El código de producto es obligatorio'),
  quantity: Yup.number()
    .typeError('Debe ingresar un número válido')
    .min(0, 'La cantidad no puede ser negativa')
    .required('La cantidad es obligatoria')
});

export const InventoryForm = () => {
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      bin_code: '',
      item_code: '',
      quantity: 1
    },
    validationSchema: InventorySchema,
    onSubmit: async (values, { resetForm }) => {
      setLoading(true);
      try {
        const payload = {
          BinCode: values.bin_code.trim(),
          ItemCode: values.item_code.trim(),
          CountQty: values.quantity
        };

        const res = await client.post('/docs/inventario', payload);
        if (res.status === 'ok') {
          message.success(`Inventario registrado: ${values.quantity} u. de ${values.item_code.toUpperCase()} en ${values.bin_code.toUpperCase()}`);
          resetForm();
        } else {
          message.error(res.message || 'Error registrando recuento de inventario');
        }
      } catch (err) {
        message.error(err.message || 'Error guardando recuento en SAP');
      } finally {
        setLoading(false);
      }
    }
  });

  return (
    <Card title="Recuento de Inventario en Ubicación" style={{ borderRadius: 8 }}>
      <form onSubmit={formik.handleSubmit}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Ubicación / Estantería:</label>
            <Input
              name="bin_code"
              prefix={<EnvironmentOutlined />}
              placeholder="ej. A-01-01"
              size="large"
              value={formik.values.bin_code}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              status={formik.touched.bin_code && formik.errors.bin_code ? 'error' : ''}
            />
            {formik.touched.bin_code && formik.errors.bin_code && (
              <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.bin_code}</div>
            )}
          </Col>

          <Col xs={24} sm={12} md={8}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Código de Artículo / EAN:</label>
            <Input
              name="item_code"
              prefix={<BarcodeOutlined />}
              placeholder="ej. ART-001"
              size="large"
              value={formik.values.item_code}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              status={formik.touched.item_code && formik.errors.item_code ? 'error' : ''}
            />
            {formik.touched.item_code && formik.errors.item_code && (
              <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.item_code}</div>
            )}
          </Col>

          <Col xs={24} sm={12} md={8}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Cantidad Recontada:</label>
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              size="large"
              value={formik.values.quantity}
              onChange={(val) => formik.setFieldValue('quantity', val)}
              onBlur={() => formik.setFieldTouched('quantity', true)}
              status={formik.touched.quantity && formik.errors.quantity ? 'error' : ''}
            />
            {formik.touched.quantity && formik.errors.quantity && (
              <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.quantity}</div>
            )}
          </Col>
        </Row>

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Button type="primary" htmlType="submit" icon={<CheckOutlined />} loading={loading} size="large">
            Registrar Recuento
          </Button>
        </div>
      </form>
    </Card>
  );
};
