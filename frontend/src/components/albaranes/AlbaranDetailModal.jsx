import React, { useState, useEffect, useRef } from 'react';
import { Modal, Typography, Button, Spin, message } from 'antd';
import { PrinterOutlined, FilePdfOutlined } from '@ant-design/icons';
import client from '../../utils/client';
import { useAuth } from '../../context/AuthContext';
import { AlbaranDocumentReport } from './AlbaranDocumentReport';

const { Title, Text } = Typography;

export const AlbaranDetailModal = ({ docEntry, open, onClose }) => {
  const { activePdfPrinter } = useAuth();
  const [albaran, setAlbaran] = useState(null);
  const [loading, setLoading] = useState(false);
  const [printingServer, setPrintingServer] = useState(false);

  const printAreaRef = useRef(null);

  useEffect(() => {
    if (docEntry && open) {
      fetchDetalle(docEntry);
    } else {
      setAlbaran(null);
    }
  }, [docEntry, open]);

  const fetchDetalle = async (id) => {
    setLoading(true);
    try {
      const res = await client.get(`/albaranes/${id}`);
      if (res.status === 'ok') {
        setAlbaran(res.albaran);
      } else {
        message.error(res.message || 'No se pudieron cargar los detalles del albarán');
      }
    } catch (err) {
      message.error(err.message || 'Error consultando albarán en SAP');
    } finally {
      setLoading(false);
    }
  };

  // Generador de documento HTML limpio y estandarizado en 1 SOLA PÁGINA A4
  const generateStandaloneHtml = () => {
    if (!printAreaRef.current) return '';
    const reportHtml = printAreaRef.current.innerHTML;
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Albarán de Entrega #${albaran?.DocNum || docEntry}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 10mm 6mm 10mm;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      height: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1e293b;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .sga-albaran-sheet {
      width: 100%;
      max-width: 210mm;
      min-height: 275mm;
      height: 100%;
      margin: 0 auto;
      padding: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .sga-alb-header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    .sga-alb-header-table td {
      vertical-align: top;
      padding: 0;
      border: none;
    }
    .sga-alb-logo {
      max-width: 195px;
      height: auto;
    }
    .sga-alb-company-info {
      text-align: right;
      font-size: 8.5px;
      color: #475569;
      line-height: 1.35;
    }
    .sga-alb-header-info-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 2px;
      margin-bottom: 8px;
    }
    .sga-alb-header-info-table td {
      border: none;
      padding: 0;
      vertical-align: top;
      font-size: 10.5px;
      line-height: 1.4;
    }
    .sga-alb-section-title {
      font-size: 10.5px;
      font-weight: 700;
      color: #1d2433;
      border-bottom: 2px solid #1d2433;
      padding-bottom: 2px;
      margin-bottom: 4px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      display: block;
    }
    .sga-alb-main-text {
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 1px;
    }
    .sga-alb-muted-text {
      color: #475569;
    }
    .sga-alb-content-body {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }
    .sga-alb-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 2px;
      margin-bottom: 8px;
    }
    .sga-alb-table th {
      background-color: #1d2433 !important;
      color: #ffffff !important;
      font-size: 9.5px;
      font-weight: 700;
      padding: 4px 8px;
      text-align: left;
      border: 1px solid #1d2433;
    }
    .sga-alb-table td {
      padding: 4px 8px;
      vertical-align: middle;
      border-bottom: 1px solid #f1f5f9;
    }
    .sga-alb-row-striped:nth-child(even) {
      background-color: #f8fafc;
    }
    .sga-alb-item-title {
      font-weight: 700;
      color: #1d2433;
      font-size: 10.5px;
      margin-bottom: 1px;
    }
    .sga-alb-item-code {
      color: #64748b;
      font-size: 9px;
    }
    .sga-alb-item-notes {
      color: #334155;
      font-size: 9px;
      margin-top: 1px;
      padding-left: 6px;
      border-left: 2px solid #cbd5e1;
    }
    .sga-alb-info-row {
      background-color: #f8fafc;
      border-bottom: 1px solid #e2e8f0 !important;
    }
    .sga-alb-info-tag {
      display: inline-block;
      min-width: 40px;
      font-weight: 700;
      color: #0f172a;
    }
    .sga-alb-bottom-section {
      margin-top: auto;
      padding-top: 6px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sga-alb-important-box {
      border-top: 1.5px solid #1d2433;
      padding-top: 3px;
      margin-bottom: 6px;
    }
    .sga-alb-important-title {
      font-weight: 700;
      font-size: 9px;
      color: #1d2433;
      margin-bottom: 1px;
      letter-spacing: 0.3px;
    }
    .sga-alb-important-desc {
      font-style: italic;
      margin: 0;
      font-size: 8px;
      color: #475569;
      text-align: justify;
      line-height: 1.3;
    }
    .sga-alb-boxes-flex {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 10px;
      margin-top: 4px;
      width: 100%;
    }
    .sga-alb-signature-box {
      width: 35%;
      display: flex;
      flex-direction: column;
    }
    .sga-alb-payment-box {
      width: 65%;
      display: flex;
      flex-direction: column;
    }
    .sga-alb-box-header {
      background-color: #1d2433;
      color: #ffffff;
      text-align: center;
      padding: 3px 5px;
      font-weight: 700;
      font-size: 9px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .sga-alb-box-body {
      border: 1px solid #1d2433;
      border-top: none;
      background-color: #ffffff;
      padding: 5px 8px;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-size: 9px;
    }
    .sga-alb-signature-body {
      color: #94a3b8;
      text-align: center;
      font-weight: 600;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      letter-spacing: 1px;
    }
    .sga-alb-payment-line {
      margin-bottom: 2px;
      color: #1e293b;
      font-size: 9px;
      line-height: 1.3;
    }
    .sga-alb-payment-line strong {
      font-weight: 700;
      color: #1e293b;
    }
    .sga-alb-payment-line:last-child {
      margin-bottom: 0;
    }
    .sga-alb-legal-footer {
      text-align: center;
      font-size: 7.5px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
      margin-top: 6px;
      line-height: 1.25;
    }
    .sga-alb-page-number {
      text-align: center;
      font-size: 8.5px;
      color: #64748b;
      margin-top: 2px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  ${reportHtml}
</body>
</html>`;
  };

  // Impresión nativa del navegador / Guardar en PDF en 1 SOLA PÁGINA
  const handlePrintBrowser = () => {
    const html = generateStandaloneHtml();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 300);
  };

  // Impresión de Albarán por Socket IP / Red
  const handlePrintServer = async () => {
    if (!docEntry) return;
    setPrintingServer(true);
    try {
      const res = await client.post(`/albaranes/${docEntry}/imprimir`, {
        printer_ip: activePdfPrinter || undefined,
        copies: 2
      });
      if (res.status === 'ok') {
        message.success(res.message || 'Albarán enviado a la impresora de red');
      } else {
        message.error(res.message || 'Error imprimiendo albarán');
      }
    } catch (err) {
      message.error(err.message || 'Error en la petición de impresión');
    } finally {
      setPrintingServer(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      title={
        albaran ? (
          <div>
            <Title level={4} style={{ margin: 0, color: '#1d2433' }}>
              Albarán de Entrega #{albaran.DocNum}
            </Title>
            <Text type="secondary">{albaran.CardName} ({albaran.CardCode})</Text>
          </div>
        ) : 'Detalle de Albarán'
      }
      open={open}
      onCancel={onClose}
      width={860}
      style={{ top: 20 }}
      footer={[
        <Button key="close" onClick={onClose} style={{ borderRadius: 6 }}>
          Cerrar
        </Button>,
        <Button
          key="print_browser"
          type="primary"
          icon={<FilePdfOutlined />}
          onClick={handlePrintBrowser}
          style={{ backgroundColor: '#1d2433', borderColor: '#1d2433', borderRadius: 6, fontWeight: 600 }}
        >
          Guardar PDF
        </Button>,
        <Button
          key="print_server"
          icon={<PrinterOutlined />}
          loading={printingServer}
          onClick={handlePrintServer}
          style={{ borderRadius: 6 }}
        >
          Imprimir
        </Button>
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" tip="Cargando albarán desde SAP..." />
        </div>
      ) : albaran ? (
        /* Reporte Oficial A4 Unificado (Vista única y estandarizada) */
        <div style={{ maxHeight: '76vh', overflowY: 'auto', padding: '10px 14px', background: '#f1f5f9', borderRadius: 8 }}>
          <div ref={printAreaRef}>
            <AlbaranDocumentReport albaran={albaran} />
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 20 }}>No hay datos disponibles</div>
      )}
    </Modal>
  );
};

export default AlbaranDetailModal;
