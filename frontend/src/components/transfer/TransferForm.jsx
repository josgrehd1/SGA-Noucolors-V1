import React, { useState } from 'react';
import { Card, Input, InputNumber, Button, Row, Col, message } from 'antd';
import { SwapOutlined, EnvironmentOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import client from '../../utils/client';

const TransferSchema = Yup.object().shape({
  bin_from: Yup.string()
    .trim()
    .min(2, 'Ubicación de origen requiere al menos 2 caracteres')
    .required('Ubicación de origen obligatoria'),
  bin_to: Yup.string()
    .trim()
    .min(2, 'Ubicación de destino requiere al menos 2 caracteres')
    .notOneOf([Yup.ref('bin_from')], 'Destino no puede ser igual al origen')
    .required('Ubicación de destino obligatoria'),
  item_code: Yup.string()
    .trim()
    .min(2, 'El código de producto debe tener al menos 2 caracteres')
    .required('Código de artículo obligatorio'),
  quantity: Yup.number()
    .typeError('Debe ingresar un número válido')
    .min(1, 'La cantidad mínima es 1')
    .required('La cantidad es obligatoria')
});

export const TransferForm = () => {
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      bin_from: '',
      bin_to: '',
      item_code: '',
      quantity: 1
    },
    validationSchema: TransferSchema,
    onSubmit: async (values, { resetForm }) => {
      setLoading(true);
      try {
        const payload = {
          BinFrom: values.bin_from.trim(),
          BinTo: values.bin_to.trim(),
          ItemCode: values.item_code.trim(),
          Quantity: values.quantity
        };

        const res = await client.post('/docs/traslado', payload);
        if (res.status === 'ok') {
          message.success(`Traslado realizado: ${values.quantity} u. de ${values.item_code.toUpperCase()} de ${values.bin_from.toUpperCase()} a ${values.bin_to.toUpperCase()}`);
          resetForm();
        } else {
          message.error(res.message || 'Error realizando traslado de stock en SAP');
        }
      } catch (err) {
        message.error(err.message || 'Error en la petición de traslado');
      } finally {
        setLoading(false);
      }
    }
  });

  return (
    <Card title="Traslado Directo de Stock entre Ubicaciones" style={{ borderRadius: 8 }}>
      <form onSubmit={formik.handleSubmit}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Ubicación Origen:</label>
            <Input
              name="bin_from"
              prefix={<EnvironmentOutlined style={{ color: '#ff4d4f' }} />}
              placeholder="ej. A-01-01"
              size="large"
              value={formik.values.bin_from}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              status={formik.touched.bin_from && formik.errors.bin_from ? 'error' : ''}
            />
            {formik.touched.bin_from && formik.errors.bin_from && (
              <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.bin_from}</div>
            )}
          </Col>

          <Col xs={24} sm={12} md={6}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Ubicación Destino:</label>
            <Input
              name="bin_to"
              prefix={<EnvironmentOutlined style={{ color: '#52c41a' }} />}
              placeholder="ej. B-02-05"
              size="large"
              value={formik.values.bin_to}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              status={formik.touched.bin_to && formik.errors.bin_to ? 'error' : ''}
            />
            {formik.touched.bin_to && formik.errors.bin_to && (
              <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.bin_to}</div>
            )}
          </Col>

          <Col xs={24} sm={12} md={6}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Código Artículo / EAN:</label>
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

          <Col xs={24} sm={12} md={6}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Cantidad:</label>
            <InputNumber
              min={1}
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
          <Button type="primary" htmlType="submit" icon={<SwapOutlined />} loading={loading} size="large">
            Ejecutar Traslado Directo
          </Button>
        </div>
      </form>
    </Card>
  );
};
