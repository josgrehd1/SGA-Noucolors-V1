import React from 'react';
import { Modal, Select, Button, message, Space, Tag, Divider, Row, Col } from 'antd';
import { PrinterOutlined, BarcodeOutlined, FilePdfOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../context/AuthContext';

const PrinterSchema = Yup.object().shape({
  printer_ip: Yup.string()
    .trim()
    .required('Seleccione una impresora de etiquetas Zebra'),
  pdf_printer_ip: Yup.string()
    .trim()
    .required('Seleccione una impresora de albaranes / PDF')
});

export const PrinterModal = ({ open, onClose }) => {
  const {
    activePrinter,
    setActivePrinter,
    printersList,
    activePdfPrinter,
    setActivePdfPrinter,
    pdfPrintersList,
    fetchPrinters
  } = useAuth();

  React.useEffect(() => {
    if (open && fetchPrinters) {
      fetchPrinters();
    }
  }, [open]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      printer_ip: activePrinter || (printersList[0]?.key || ''),
      pdf_printer_ip: activePdfPrinter || (pdfPrintersList[0]?.key || '')
    },
    validationSchema: PrinterSchema,
    onSubmit: (values) => {
      setActivePrinter(values.printer_ip);
      setActivePdfPrinter(values.pdf_printer_ip);
      message.success('Configuración de impresoras guardada correctamente');
      onClose();
    }
  });

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PrinterOutlined style={{ color: '#0d6efd', fontSize: 20 }} />
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
            Configuración de Impresoras del Puesto
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={540}
      footer={null}
      styles={{ body: { paddingTop: 10 } }}
    >
      <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 16 }}>
        Selecciona las impresoras asignadas a tu puesto de trabajo. Las órdenes de impresión se enviarán directamente por IP vía Socket.
      </p>

      <form onSubmit={formik.handleSubmit}>
        {/* 1. Impresora de Etiquetas (Zebra / ZPL) */}
        <div style={{
          border: '1px solid #bfdbfe',
          backgroundColor: '#eff6ff',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarcodeOutlined style={{ color: '#0d6efd', fontSize: 16 }} />
              <strong style={{ color: '#1e3a8a', fontSize: '0.9rem' }}>
                1. Impresora de Etiquetas (Zebra / ZPL)
              </strong>
            </div>
            {formik.values.printer_ip && (
              <Tag color="blue" style={{ fontWeight: 600, margin: 0 }}>
                IP: {formik.values.printer_ip}
              </Tag>
            )}
          </div>

          <Select
            style={{ width: '100%' }}
            size="large"
            placeholder="Seleccione impresora Zebra..."
            value={formik.values.printer_ip || undefined}
            onChange={(val) => formik.setFieldValue('printer_ip', val)}
            onBlur={() => formik.setFieldTouched('printer_ip', true)}
            status={formik.touched.printer_ip && formik.errors.printer_ip ? 'error' : ''}
            options={printersList.map((p) => ({
              label: `${p.name || p.value} (${p.ip || p.key})`,
              value: p.key
            }))}
          />
          {formik.touched.printer_ip && formik.errors.printer_ip && (
            <div className="sga-form-error-msg" style={{ marginTop: 4 }}>{formik.errors.printer_ip}</div>
          )}
        </div>

        {/* 2. Impresora de Albaranes / Documentos (PDF Direct Socket) */}
        <div style={{
          border: '1px solid #bbf7d0',
          backgroundColor: '#f0fdf4',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FilePdfOutlined style={{ color: '#16a34a', fontSize: 16 }} />
              <strong style={{ color: '#14532d', fontSize: '0.9rem' }}>
                2. Impresora de Albaranes (PDF / Socket IP)
              </strong>
            </div>
            {formik.values.pdf_printer_ip && (
              <Tag color="green" style={{ fontWeight: 600, margin: 0 }}>
                IP: {formik.values.pdf_printer_ip}
              </Tag>
            )}
          </div>

          <Select
            style={{ width: '100%' }}
            size="large"
            placeholder="Seleccione impresora de albaranes..."
            value={formik.values.pdf_printer_ip || undefined}
            onChange={(val) => formik.setFieldValue('pdf_printer_ip', val)}
            onBlur={() => formik.setFieldTouched('pdf_printer_ip', true)}
            status={formik.touched.pdf_printer_ip && formik.errors.pdf_printer_ip ? 'error' : ''}
            options={pdfPrintersList.map((p) => ({
              label: `${p.name || p.value} (${p.ip || p.key})`,
              value: p.key
            }))}
          />
          {formik.touched.pdf_printer_ip && formik.errors.pdf_printer_ip && (
            <div className="sga-form-error-msg" style={{ marginTop: 4 }}>{formik.errors.pdf_printer_ip}</div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button onClick={onClose} style={{ borderRadius: 6 }}>
            Cancelar
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<CheckCircleFilled />}
            style={{ borderRadius: 6, fontWeight: 700, backgroundColor: '#0d6efd', borderColor: '#0d6efd' }}
          >
            Guardar Configuración
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PrinterModal;
