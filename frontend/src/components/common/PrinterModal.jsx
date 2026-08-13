import React from 'react';
import { Modal, Select, Button, message } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../context/AuthContext';

const PrinterSchema = Yup.object().shape({
  printer_ip: Yup.string()
    .trim()
    .required('Debe seleccionar una impresora Zebra activa')
});

export const PrinterModal = ({ open, onClose }) => {
  const { activePrinter, printersList, setActivePrinter } = useAuth();

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      printer_ip: activePrinter || ''
    },
    validationSchema: PrinterSchema,
    onSubmit: (values) => {
      setActivePrinter(values.printer_ip);
      message.success('Impresora activa guardada en caché local');
      onClose();
    }
  });

  return (
    <Modal
      title={
        <span>
          <PrinterOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          Seleccionar Impresora Zebra Activa (Formik)
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <form onSubmit={formik.handleSubmit}>
        <div className="sga-form-field-group">
          <label className="sga-form-label">
            Impresora Zebra Asignada:
          </label>
          <Select
            style={{ width: '100%' }}
            size="large"
            placeholder="Seleccione impresora de la lista"
            value={formik.values.printer_ip || undefined}
            onChange={(val) => formik.setFieldValue('printer_ip', val)}
            onBlur={() => formik.setFieldTouched('printer_ip', true)}
            status={formik.touched.printer_ip && formik.errors.printer_ip ? 'error' : ''}
            options={printersList.map((p) => ({ label: `${p.value} (${p.key})`, value: p.key }))}
          />
          {formik.touched.printer_ip && formik.errors.printer_ip && (
            <div className="sga-form-error-msg">
              {formik.errors.printer_ip}
            </div>
          )}
        </div>

        <div className="sga-form-actions-right">
          <Button style={{ marginRight: 8 }} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit">
            Guardar en Caché Local
          </Button>
        </div>
      </form>
    </Modal>
  );
};
