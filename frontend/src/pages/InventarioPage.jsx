import React, { useState } from 'react';
import { Card, Input, InputNumber, Button, Row, Col, Segmented, message } from 'antd';
import { CheckOutlined, EnvironmentOutlined, BarcodeOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import client from '../utils/client';

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

export const InventarioPage = () => {
  const [isBlindMode, setIsBlindMode] = useState(false);
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
          CountQty: values.quantity,
          IsBlind: isBlindMode
        };

        const res = await client.post('/docs/inventario', payload);
        if (res.status === 'ok') {
          message.success(`Inventario ${isBlindMode ? 'Ciego' : 'Normal'} registrado: ${values.quantity} u. de ${values.item_code.toUpperCase()} en ${values.bin_code.toUpperCase()}`);
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
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#212529', margin: 0 }}>
          {isBlindMode ? 'Inventario Ciego' : 'Recuento de Inventario'}
        </h2>

        {/* Conmutador Inventario Normal vs Inventario Ciego */}
        <Segmented
          options={[
            { label: 'Inventario Normal', value: 'normal', icon: <EyeOutlined /> },
            { label: 'Inventario Ciego', value: 'blind', icon: <EyeInvisibleOutlined /> }
          ]}
          value={isBlindMode ? 'blind' : 'normal'}
          onChange={(val) => setIsBlindMode(val === 'blind')}
          size="large"
        />
      </div>

      <Card style={{ borderRadius: 8, boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)' }}>
        {isBlindMode && (
          <div style={{ marginBottom: 16, backgroundColor: '#fff3cd', border: '1px solid #ffe69c', color: '#664d03', padding: 12, borderRadius: 6, fontSize: '0.85rem' }}>
            <strong>Modo Inventario Ciego Activo:</strong> El recuento se registra a ciegas sin mostrar las existencias teóricas actuales de SAP para evitar sesgos operacionales.
          </div>
        )}

        <form onSubmit={formik.handleSubmit}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, color: '#495057' }}>Ubicación / Estantería:</label>
              <Input
                name="bin_code"
                prefix={<EnvironmentOutlined style={{ color: '#0d6efd' }} />}
                placeholder="ej. A-01-01"
                size="large"
                value={formik.values.bin_code}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                status={formik.touched.bin_code && formik.errors.bin_code ? 'error' : ''}
              />
              {formik.touched.bin_code && formik.errors.bin_code && (
                <div style={{ color: '#dc3545', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.bin_code}</div>
              )}
            </Col>

            <Col xs={24} sm={12} md={8}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, color: '#495057' }}>Código de Artículo / EAN:</label>
              <Input
                name="item_code"
                prefix={<BarcodeOutlined style={{ color: '#0d6efd' }} />}
                placeholder="ej. ART-001"
                size="large"
                value={formik.values.item_code}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                status={formik.touched.item_code && formik.errors.item_code ? 'error' : ''}
              />
              {formik.touched.item_code && formik.errors.item_code && (
                <div style={{ color: '#dc3545', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.item_code}</div>
              )}
            </Col>

            <Col xs={24} sm={12} md={8}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, color: '#495057' }}>Cantidad Recontada:</label>
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
                <div style={{ color: '#dc3545', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.quantity}</div>
              )}
            </Col>
          </Row>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<CheckOutlined />}
              loading={loading}
              size="large"
              style={{ backgroundColor: isBlindMode ? '#ffc107' : '#0d6efd', borderColor: isBlindMode ? '#ffc107' : '#0d6efd', color: isBlindMode ? '#212529' : '#ffffff', fontWeight: 700 }}
            >
              {isBlindMode ? 'Guardar Recuento Ciego' : 'Registrar Recuento'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
