import React, { useState, useEffect } from 'react';
import { Card, Input, InputNumber, Button, Row, Col, Space, Typography, Tag, Spin, message, Alert } from 'antd';
import {
  SwapOutlined,
  EnvironmentOutlined,
  BarcodeOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  ShopOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import client from '../../utils/client';

const { Text } = Typography;

const TransferSchema = Yup.object().shape({
  bin_from: Yup.string()
    .trim()
    .min(2, 'Ubicación de origen requerida')
    .required('Ubicación de origen obligatoria'),
  bin_to: Yup.string()
    .trim()
    .min(2, 'Ubicación de destino requerida')
    .notOneOf([Yup.ref('bin_from')], 'Destino no puede ser igual al origen')
    .required('Ubicación de destino obligatoria'),
  item_code: Yup.string()
    .trim()
    .min(2, 'El código de artículo es obligatorio')
    .required('Código de artículo obligatorio'),
  quantity: Yup.number()
    .typeError('Debe ingresar un número válido')
    .min(1, 'La cantidad mínima es 1')
    .required('La cantidad es obligatoria')
});

export const TransferForm = () => {
  const [loading, setLoading] = useState(false);

  // Estados de validación en tiempo real
  const [validatingBinFrom, setValidatingBinFrom] = useState(false);
  const [binFromStatus, setBinFromStatus] = useState(null); // { valid: bool, whs: string, stock: number, msg: string }

  const [validatingBinTo, setValidatingBinTo] = useState(false);
  const [binToStatus, setBinToStatus] = useState(null); // { valid: bool, whs: string, msg: string }

  const [validatingItem, setValidatingItem] = useState(false);
  const [itemStatus, setItemStatus] = useState(null); // { valid: bool, itemCode: string, itemName: string, msg: string }

  const formik = useFormik({
    initialValues: {
      bin_from: '',
      bin_to: '',
      item_code: '',
      quantity: 1
    },
    validationSchema: TransferSchema,
    onSubmit: async (values, { resetForm }) => {
      // Verificación estricta previa al envío
      if (binFromStatus && !binFromStatus.valid) {
        message.error(binFromStatus.msg || 'La ubicación de origen no es válida.');
        return;
      }
      if (binToStatus && !binToStatus.valid) {
        message.error(binToStatus.msg || 'La ubicación de destino no es válida.');
        return;
      }
      if (itemStatus && !itemStatus.valid) {
        message.error(itemStatus.msg || 'El artículo no es válido en SAP.');
        return;
      }

      setLoading(true);
      try {
        const payload = {
          BinFrom: values.bin_from.trim().toUpperCase(),
          BinTo: values.bin_to.trim().toUpperCase(),
          ItemCode: (itemStatus?.itemCode || values.item_code).trim().toUpperCase(),
          Quantity: values.quantity
        };

        const res = await client.post('/docs/traslado', payload);
        if (res.status === 'ok') {
          message.success(`Traslado completado: ${values.quantity} u. de ${payload.ItemCode} desde ${payload.BinFrom} hacia ${payload.BinTo}`);
          resetForm();
          setBinFromStatus(null);
          setBinToStatus(null);
          setItemStatus(null);
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

  // 1. Validar Ubicación de Origen
  const validateBinFrom = async (binCode, itemCode, qty) => {
    const cleanBin = (binCode || '').trim().toUpperCase();
    if (!cleanBin) {
      setBinFromStatus(null);
      return;
    }

    setValidatingBinFrom(true);
    try {
      const cleanItem = (itemCode || '').trim().toUpperCase();
      const checkRes = await client.get(`/ubicacion-existe/${encodeURIComponent(cleanBin)}`, {
        params: {
          itemcode: cleanItem || undefined,
          qty: qty || undefined
        }
      });

      if (checkRes.existe) {
        const stockDisp = checkRes.stock_disponible !== null && checkRes.stock_disponible !== undefined
          ? Number(checkRes.stock_disponible)
          : null;
        const whs = checkRes.bin_whscode || cleanBin.split('-')[0] || '01';
        let msg = `Alm. #${whs}`;
        let hasSufficientStock = true;

        if (cleanItem && stockDisp !== null) {
          const reqQty = Number(qty || formik.values.quantity || 1);
          if (stockDisp <= 0) {
            hasSufficientStock = false;
            msg = `Alm. #${whs} | Sin stock (0 u. en ubicación)`;
          } else if (stockDisp < reqQty) {
            hasSufficientStock = false;
            msg = `Alm. #${whs} | Stock insuficiente (${stockDisp} u. disp. / se piden ${reqQty} u.)`;
          } else {
            msg += ` | Stock en ubi: ${stockDisp} u.`;
          }
        }

        setBinFromStatus({
          valid: true,
          hasStock: hasSufficientStock,
          whs: whs,
          stock: stockDisp,
          msg: msg
        });
      } else {
        setBinFromStatus({
          valid: false,
          hasStock: false,
          whs: null,
          stock: 0,
          msg: checkRes.message || `La ubicación '${cleanBin}' no existe en SAP`
        });
      }
    } catch (err) {
      setBinFromStatus({
        valid: false,
        hasStock: false,
        whs: null,
        stock: 0,
        msg: 'Error consultando ubicación de origen'
      });
    } finally {
      setValidatingBinFrom(false);
    }
  };

  // 2. Validar Ubicación de Destino
  const validateBinTo = async (binCode) => {
    const cleanBin = (binCode || '').trim().toUpperCase();
    if (!cleanBin) {
      setBinToStatus(null);
      return;
    }

    setValidatingBinTo(true);
    try {
      const checkRes = await client.get(`/ubicacion-existe/${encodeURIComponent(cleanBin)}`);
      if (checkRes.existe) {
        const whs = checkRes.bin_whscode || cleanBin.split('-')[0] || '01';
        setBinToStatus({
          valid: true,
          whs: whs,
          msg: `Alm. #${whs} (Válida)`
        });
      } else {
        setBinToStatus({
          valid: false,
          whs: null,
          msg: checkRes.message || `La ubicación '${cleanBin}' no existe en SAP`
        });
      }
    } catch (err) {
      setBinToStatus({
        valid: false,
        whs: null,
        msg: 'Error consultando ubicación de destino'
      });
    } finally {
      setValidatingBinTo(false);
    }
  };

  // 3. Validar Artículo / Código de Barras
  const validateItemCode = async (searchVal) => {
    const cleanSearch = (searchVal || '').trim().toUpperCase();
    if (!cleanSearch) {
      setItemStatus(null);
      return;
    }

    setValidatingItem(true);
    try {
      const res = await client.get('/producto-existe', {
        params: { 'prod-search': cleanSearch }
      });

      if (res.existe) {
        const realCode = res.real_itemcode || cleanSearch;
        const name = res.itemname || (res.productos?.[0]?.ItemName) || 'Artículo identificado';
        setItemStatus({
          valid: true,
          itemCode: realCode,
          itemName: name,
          msg: `${realCode} - ${name}`
        });

        // Si ya hay ubicación de origen introducida, revalidar stock para este artículo
        if (formik.values.bin_from) {
          validateBinFrom(formik.values.bin_from, realCode, formik.values.quantity);
        }
      } else {
        setItemStatus({
          valid: false,
          itemCode: null,
          itemName: null,
          msg: `El artículo o código '${cleanSearch}' no existe en SAP`
        });
      }
    } catch (err) {
      setItemStatus({
        valid: false,
        itemCode: null,
        itemName: null,
        msg: 'Error comprobando artículo en SAP'
      });
    } finally {
      setValidatingItem(false);
    }
  };

  const isInterWhs = binFromStatus?.whs && binToStatus?.whs && binFromStatus.whs !== binToStatus.whs;
  const isIntraWhs = binFromStatus?.whs && binToStatus?.whs && binFromStatus.whs === binToStatus.whs;
  const isBinFromOk = binFromStatus?.valid && binFromStatus?.hasStock !== false;

  return (
    <Card
      styles={{ body: { padding: '16px 14px' } }}
      style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: '#eff6ff',
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0
        }}>
          <SwapOutlined />
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
          Traslado Directo de Stock
        </div>
      </div>

      {/* Banner de Enrutamiento Inteligente */}
      {(binFromStatus?.whs || binToStatus?.whs) && (
        <div style={{
          backgroundColor: isInterWhs ? '#eff6ff' : '#f8fafc',
          border: `1px solid ${isInterWhs ? '#bfdbfe' : '#e2e8f0'}`,
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <ShopOutlined style={{ color: isInterWhs ? '#2563eb' : '#64748b', fontSize: 15 }} />
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap' }}>
              Movimiento:
            </span>
            {isInterWhs ? (
              <Tag color="blue" style={{ fontWeight: 700, borderRadius: 6, margin: 0, fontSize: '0.74rem' }}>
                Entre Almacenes (Alm. #{binFromStatus.whs} ➔ Alm. #{binToStatus.whs})
              </Tag>
            ) : isIntraWhs ? (
              <Tag color="cyan" style={{ fontWeight: 700, borderRadius: 6, margin: 0, fontSize: '0.74rem' }}>
                Reubicación Interna (Alm. #{binFromStatus.whs})
              </Tag>
            ) : (
              <Tag color="default" style={{ borderRadius: 6, margin: 0, fontSize: '0.74rem' }}>
                Pendiente de asignación
              </Tag>
            )}
          </div>

          {itemStatus?.itemName && (
            <div style={{ fontSize: '0.76rem', color: '#475569', wordBreak: 'break-word' }}>
              📦 <strong style={{ color: '#1e293b' }}>{itemStatus.itemCode}</strong>: {itemStatus.itemName}
            </div>
          )}
        </div>
      )}

      <form onSubmit={formik.handleSubmit}>
        <Row gutter={[12, 12]}>
          {/* 1. Ubicación de Origen */}
          <Col xs={24} sm={12} md={6}>
            <label className="sga-form-label" style={{ display: 'block', marginBottom: 5, fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
              1. Ubicación Origen:
            </label>
            <Input
              name="bin_from"
              prefix={<EnvironmentOutlined style={{ color: isBinFromOk ? '#16a34a' : binFromStatus ? '#dc2626' : '#9ca3af' }} />}
              suffix={
                validatingBinFrom ? (
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                ) : isBinFromOk ? (
                  <CheckCircleFilled style={{ color: '#16a34a', fontSize: 17 }} />
                ) : binFromStatus ? (
                  <CloseCircleFilled style={{ color: '#dc2626', fontSize: 17 }} />
                ) : null
              }
              placeholder="ej. 01-10-00-00"
              size="large"
              value={formik.values.bin_from}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                formik.setFieldValue('bin_from', val);
              }}
              onBlur={() => validateBinFrom(formik.values.bin_from, itemStatus?.itemCode || formik.values.item_code, formik.values.quantity)}
              onPressEnter={() => validateBinFrom(formik.values.bin_from, itemStatus?.itemCode || formik.values.item_code, formik.values.quantity)}
              style={{
                borderRadius: 8,
                borderColor: isBinFromOk ? '#16a34a' : binFromStatus ? '#dc2626' : '#d9d9d9',
                boxShadow: isBinFromOk ? '0 0 0 2px rgba(22, 163, 74, 0.1)' : binFromStatus ? '0 0 0 2px rgba(220, 38, 38, 0.1)' : 'none'
              }}
            />
            {binFromStatus?.msg && (
              <div style={{ marginTop: 4, fontSize: '0.75rem', fontWeight: 600, color: isBinFromOk ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                {isBinFromOk ? <CheckCircleFilled /> : <CloseCircleFilled />}
                {binFromStatus.msg}
              </div>
            )}
            {formik.touched.bin_from && formik.errors.bin_from && (
              <div className="sga-form-error-msg">{formik.errors.bin_from}</div>
            )}
          </Col>

          {/* 2. Ubicación de Destino */}
          <Col xs={24} sm={12} md={6}>
            <label className="sga-form-label" style={{ display: 'block', marginBottom: 5, fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
              2. Ubicación Destino:
            </label>
            <Input
              name="bin_to"
              prefix={<EnvironmentOutlined style={{ color: binToStatus?.valid ? '#16a34a' : binToStatus?.valid === false ? '#dc2626' : '#9ca3af' }} />}
              suffix={
                validatingBinTo ? (
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                ) : binToStatus?.valid ? (
                  <CheckCircleFilled style={{ color: '#16a34a', fontSize: 17 }} />
                ) : binToStatus?.valid === false ? (
                  <CloseCircleFilled style={{ color: '#dc2626', fontSize: 17 }} />
                ) : null
              }
              placeholder="ej. 13-05-00-00"
              size="large"
              value={formik.values.bin_to}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                formik.setFieldValue('bin_to', val);
              }}
              onBlur={() => validateBinTo(formik.values.bin_to)}
              onPressEnter={() => validateBinTo(formik.values.bin_to)}
              style={{
                borderRadius: 8,
                borderColor: binToStatus?.valid ? '#16a34a' : binToStatus?.valid === false ? '#dc2626' : '#d9d9d9',
                boxShadow: binToStatus?.valid ? '0 0 0 2px rgba(22, 163, 74, 0.1)' : binToStatus?.valid === false ? '0 0 0 2px rgba(220, 38, 38, 0.1)' : 'none'
              }}
            />
            {binToStatus?.msg && (
              <div style={{ marginTop: 4, fontSize: '0.75rem', fontWeight: 600, color: binToStatus.valid ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                {binToStatus.valid ? <CheckCircleFilled /> : <CloseCircleFilled />}
                {binToStatus.msg}
              </div>
            )}
            {formik.touched.bin_to && formik.errors.bin_to && (
              <div className="sga-form-error-msg">{formik.errors.bin_to}</div>
            )}
          </Col>

          {/* 3. Código Artículo / EAN */}
          <Col xs={24} sm={12} md={6}>
            <label className="sga-form-label" style={{ display: 'block', marginBottom: 5, fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
              3. Artículo / EAN:
            </label>
            <Input
              name="item_code"
              prefix={<BarcodeOutlined style={{ color: itemStatus?.valid ? '#16a34a' : itemStatus?.valid === false ? '#dc2626' : '#9ca3af' }} />}
              suffix={
                validatingItem ? (
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                ) : itemStatus?.valid ? (
                  <CheckCircleFilled style={{ color: '#16a34a', fontSize: 17 }} />
                ) : itemStatus?.valid === false ? (
                  <CloseCircleFilled style={{ color: '#dc2626', fontSize: 17 }} />
                ) : null
              }
              placeholder="ej. ART-001 / EAN"
              size="large"
              value={formik.values.item_code}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                formik.setFieldValue('item_code', val);
              }}
              onBlur={() => validateItemCode(formik.values.item_code)}
              onPressEnter={() => validateItemCode(formik.values.item_code)}
              style={{
                borderRadius: 8,
                borderColor: itemStatus?.valid ? '#16a34a' : itemStatus?.valid === false ? '#dc2626' : '#d9d9d9',
                boxShadow: itemStatus?.valid ? '0 0 0 2px rgba(22, 163, 74, 0.1)' : itemStatus?.valid === false ? '0 0 0 2px rgba(220, 38, 38, 0.1)' : 'none'
              }}
            />
            {itemStatus?.msg && (
              <div style={{ marginTop: 4, fontSize: '0.75rem', fontWeight: 600, color: itemStatus.valid ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {itemStatus.valid ? <CheckCircleFilled /> : <CloseCircleFilled />}
                <span title={itemStatus.msg}>{itemStatus.msg}</span>
              </div>
            )}
            {formik.touched.item_code && formik.errors.item_code && (
              <div className="sga-form-error-msg">{formik.errors.item_code}</div>
            )}
          </Col>

          {/* 4. Cantidad */}
          <Col xs={24} sm={12} md={6}>
            <label className="sga-form-label" style={{ display: 'block', marginBottom: 5, fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
              4. Cantidad:
            </label>
            <InputNumber
              min={1}
              style={{ width: '100%', borderRadius: 8 }}
              size="large"
              value={formik.values.quantity}
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.target.select()}
              onChange={(val) => {
                formik.setFieldValue('quantity', val);
                if (formik.values.bin_from && (itemStatus?.itemCode || formik.values.item_code)) {
                  validateBinFrom(formik.values.bin_from, itemStatus?.itemCode || formik.values.item_code, val);
                }
              }}
              onBlur={() => formik.setFieldTouched('quantity', true)}
              status={formik.touched.quantity && formik.errors.quantity ? 'error' : ''}
            />
            {formik.touched.quantity && formik.errors.quantity && (
              <div className="sga-form-error-msg">{formik.errors.quantity}</div>
            )}
          </Col>
        </Row>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SwapOutlined />}
            loading={loading}
            size="large"
            className="sga-transfer-submit-btn"
            disabled={
              validatingBinFrom || validatingBinTo || validatingItem ||
              !isBinFromOk || !binToStatus?.valid || !itemStatus?.valid ||
              !formik.values.bin_from || !formik.values.bin_to || !formik.values.item_code ||
              (binFromStatus?.stock !== null && binFromStatus?.stock !== undefined && binFromStatus.stock < Number(formik.values.quantity || 1))
            }
            style={{
              borderRadius: 8,
              height: 44,
              fontWeight: 700,
              fontSize: '0.9rem',
              padding: '0 28px',
              backgroundColor: isBinFromOk && binToStatus?.valid && itemStatus?.valid ? '#0d6efd' : '#94a3b8',
              borderColor: isBinFromOk && binToStatus?.valid && itemStatus?.valid ? '#0d6efd' : '#94a3b8'
            }}
          >
            Ejecutar Traslado
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default TransferForm;
