import React, { useState } from 'react';
import { Card, Input, InputNumber, Select, Button, Row, Col, message } from 'antd';
import { PrinterOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import client from '../../utils/client';
import { useAuth } from '../../context/AuthContext';

const BinLabelSchema = Yup.object().shape({
  bincode: Yup.string()
    .trim()
    .min(2, 'La ubicación debe tener al menos 2 caracteres')
    .required('El código de ubicación es obligatorio'),
  printer_id: Yup.string().required('Seleccione una impresora Zebra'),
  copies: Yup.number()
    .typeError('Debe ingresar un número válido')
    .min(1, 'Mínimo 1 copia')
    .max(99, 'Máximo 99 copias')
    .required('El número de copias es obligatorio')
});

export const BinLabelPrinter = () => {
  const { activePrinter, printersList } = useAuth();
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      bincode: '',
      copies: 1,
      printer_id: activePrinter || ''
    },
    validationSchema: BinLabelSchema,
    onSubmit: async (values, { resetForm }) => {
      setLoading(true);
      try {
        const res = await client.post('/print/bin', {
          bin: values.bincode.trim(),
          copies: values.copies,
          printer_id: values.printer_id
        });
        if (res.status === 'ok') {
          message.success(`Etiqueta de ubicación ${values.bincode.toUpperCase()} enviada a imprimir`);
          resetForm();
        } else {
          message.error(res.message || 'Error imprimiendo etiqueta de ubicación');
        }
      } catch (err) {
        message.error(err.message || 'Error en el servicio de impresión ZPL');
      } finally {
        setLoading(false);
      }
    }
  });

  return (
    <Card title="Impresión de Etiquetas de Ubicación / Estanterías ZPL" style={{ borderRadius: 8 }}>
      <form onSubmit={formik.handleSubmit}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Código de Ubicación:</label>
            <Input
              name="bincode"
              prefix={<EnvironmentOutlined />}
              placeholder="ej. A-01-01"
              size="large"
              value={formik.values.bincode}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              status={formik.touched.bincode && formik.errors.bincode ? 'error' : ''}
            />
            {formik.touched.bincode && formik.errors.bincode && (
              <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.bincode}</div>
            )}
          </Col>

          <Col xs={24} sm={12} md={8}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Impresora Zebra:</label>
            <Select
              style={{ width: '100%' }}
              size="large"
              placeholder="Seleccione impresora Zebra"
              value={formik.values.printer_id || undefined}
              onChange={(val) => formik.setFieldValue('printer_id', val)}
              onBlur={() => formik.setFieldTouched('printer_id', true)}
              status={formik.touched.printer_id && formik.errors.printer_id ? 'error' : ''}
              options={printersList.map((p) => ({ label: `${p.value} (${p.key})`, value: p.key }))}
            />
            {formik.touched.printer_id && formik.errors.printer_id && (
              <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.printer_id}</div>
            )}
          </Col>

          <Col xs={24} sm={12} md={8}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Número de Copias:</label>
            <InputNumber
              min={1}
              max={99}
              style={{ width: '100%' }}
              size="large"
              value={formik.values.copies}
              onChange={(val) => formik.setFieldValue('copies', val)}
              onBlur={() => formik.setFieldTouched('copies', true)}
              status={formik.touched.copies && formik.errors.copies ? 'error' : ''}
            />
            {formik.touched.copies && formik.errors.copies && (
              <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: 4 }}>{formik.errors.copies}</div>
            )}
          </Col>
        </Row>

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Button type="primary" htmlType="submit" icon={<PrinterOutlined />} loading={loading} size="large">
            Imprimir Etiqueta Ubicación
          </Button>
        </div>
      </form>
    </Card>
  );
};
