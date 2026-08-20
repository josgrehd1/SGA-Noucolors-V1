import React, { useState } from 'react';
import { Modal, Input, InputNumber, Select, Button, message } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import client from '../../utils/client';
import { useAuth } from '../../context/AuthContext';

const PrintLabelSchema = Yup.object().shape({
  printer_id: Yup.string().required('Seleccione una impresora Zebra'),
  copies: Yup.number()
    .typeError('Debe ingresar un número válido')
    .min(1, 'Mínimo 1 copia')
    .max(99, 'Máximo 99 copias')
    .required('El número de copias es obligatorio'),
  serial_number: Yup.string().nullable()
});

export const PrintLabelModal = ({ open, item, onClose }) => {
  const { activePrinter, printersList } = useAuth();
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      copies: 1,
      printer_id: activePrinter || '',
      serial_number: ''
    },
    validationSchema: PrintLabelSchema,
    onSubmit: async (values) => {
      if (!item) return;
      setLoading(true);
      try {
        const payload = {
          product_id: item.ItemCode,
          product_name: item.ItemName,
          copies: values.copies,
          printer_id: values.printer_id,
          serial_number: values.serial_number
        };

        const res = await client.post('/print/product', payload);
        if (res.status === 'ok') {
          message.success(`Etiqueta de ${item.ItemCode} enviada a imprimir (${values.copies} copias)`);
          onClose();
        } else {
          message.error(res.message || 'Error al imprimir etiqueta');
        }
      } catch (err) {
        message.error(err.message || 'Error conectando con el servicio de impresión Zebra');
      } finally {
        setLoading(false);
      }
    }
  });

  if (!item) return null;

  return (
    <Modal
      title={
        <span>
          <PrinterOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          Imprimir Etiqueta ZPL - {item.ItemCode}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <form onSubmit={formik.handleSubmit}>
        <div className="sga-form-field-group">
          <label className="sga-form-label">Artículo:</label>
          <Input value={`${item.ItemCode} - ${item.ItemName}`} disabled />
        </div>

        <div className="sga-form-field-group">
          <label className="sga-form-label">Nº Serie / Lote (Opcional):</label>
          <Input
            name="serial_number"
            placeholder="Ingrese número de serie o lote si aplica"
            value={formik.values.serial_number}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
        </div>

        <div className="sga-form-field-group">
          <label className="sga-form-label">Impresora Zebra:</label>
          <Select
            style={{ width: '100%' }}
            value={formik.values.printer_id || undefined}
            onChange={(val) => formik.setFieldValue('printer_id', val)}
            onBlur={() => formik.setFieldTouched('printer_id', true)}
            status={formik.touched.printer_id && formik.errors.printer_id ? 'error' : ''}
            options={printersList.map((p) => ({ label: `${p.value} (${p.key})`, value: p.key }))}
            placeholder="Seleccione impresora Zebra"
          />
          {formik.touched.printer_id && formik.errors.printer_id && (
            <div className="sga-form-error-msg">{formik.errors.printer_id}</div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="sga-form-label">Número de Copias:</label>
          <InputNumber
            min={1}
            max={99}
            style={{ width: '100%' }}
            value={formik.values.copies}
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.target.select()}
            onChange={(val) => formik.setFieldValue('copies', val)}
            onBlur={() => formik.setFieldTouched('copies', true)}
            status={formik.touched.copies && formik.errors.copies ? 'error' : ''}
          />
          {formik.touched.copies && formik.errors.copies && (
            <div className="sga-form-error-msg">{formik.errors.copies}</div>
          )}
        </div>

        <div className="sga-form-actions-right">
          <Button style={{ marginRight: 8 }} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<PrinterOutlined />}>
            Imprimir Etiquetas
          </Button>
        </div>
      </form>
    </Modal>
  );
};
