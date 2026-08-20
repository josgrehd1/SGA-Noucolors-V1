import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Space, Typography, Tag, message, Spin, Select } from 'antd';
import {
  EnvironmentOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  SaveOutlined,
  ShopOutlined
} from '@ant-design/icons';
import client from '../../utils/client';

const { Text } = Typography;

export const ChangeDefaultBinModal = ({
  open,
  itemCode,
  itemName,
  whsCode = '01',
  currentBin,
  ubisList = [],
  onClose,
  onSuccess
}) => {
  const [newBin, setNewBin] = useState('');
  const [validating, setValidating] = useState(false);
  const [isValid, setIsValid] = useState(null); // null, true, false
  const [validMessage, setValidMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNewBin('');
      setIsValid(null);
      setValidMessage('');
      setValidating(false);
      setSaving(false);
    }
  }, [open, currentBin]);

  // Validar si la ubicación existe en SAP en tiempo real
  const checkBinValidity = async (bin) => {
    const cleanBin = (bin || '').trim().toUpperCase();
    if (!cleanBin) {
      setIsValid(null);
      setValidMessage('');
      setValidating(false);
      return;
    }

    setValidating(true);
    try {
      const res = await client.get(`/ubicacion-existe/${encodeURIComponent(cleanBin)}`);
      if (res.existe) {
        setIsValid(true);
        setValidMessage('Ubicación válida en SAP');
      } else {
        setIsValid(false);
        setValidMessage(res.message || 'La ubicación no existe en SAP');
      }
    } catch (err) {
      setIsValid(false);
      setValidMessage('Error comprobando ubicación en SAP');
    } finally {
      setValidating(false);
    }
  };

  const handleChangeInput = (val) => {
    const uppercaseVal = (val || '').toUpperCase();
    setNewBin(uppercaseVal);
    checkBinValidity(uppercaseVal);
  };

  const handleSave = async () => {
    const cleanBin = (newBin || '').trim().toUpperCase();
    if (!cleanBin) {
      message.warning('Por favor introduce un código de ubicación');
      return;
    }

    if (isValid === false) {
      message.error('La ubicación especificada no existe en SAP');
      return;
    }

    setSaving(true);
    try {
      const res = await client.post('/docs/change-default-bin', {
        itemcode: itemCode,
        whscode: whsCode || '01',
        new_bin: cleanBin
      });

      if (res.status === 'ok' || res.message) {
        message.success(`Ubicación por defecto actualizada a ${cleanBin} para el artículo ${itemCode}`);
        if (onSuccess) {
          onSuccess(cleanBin);
        }
        onClose();
      } else {
        message.error(res.message || 'No se pudo actualizar la ubicación por defecto');
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || 'Error en comunicación con SAP';
      message.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  // Opciones de ubicaciones disponibles
  const binOptions = (ubisList || [])
    .map((u) => {
      const code = u.BinCode || u.BINCODE || u.U_BinCode || (typeof u === 'string' ? u : '');
      return { value: code, label: code };
    })
    .filter((opt) => !!opt.value && opt.value !== 'Sin Ubi');

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontWeight: 800 }}>
          <EnvironmentOutlined style={{ color: '#0d6efd', fontSize: 20 }} />
          <span>Cambiar Ubicación Predeterminada en SAP</span>
        </div>
      }
      footer={[
        <Button key="cancel" onClick={onClose} style={{ borderRadius: 8 }}>
          Cancelar
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={!newBin || isValid === false || validating}
          onClick={handleSave}
          style={{
            borderRadius: 8,
            backgroundColor: isValid ? '#198754' : '#0d6efd',
            borderColor: isValid ? '#198754' : '#0d6efd'
          }}
        >
          Guardar en SAP
        </Button>
      ]}
      width={520}
      style={{ top: 80 }}
    >
      <div style={{ padding: '8px 0' }}>
        {/* Info del Artículo */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
              {itemCode}
            </span>
            <Tag style={{ background: '#e0f2fe', borderColor: '#bae6fd', color: '#0369a1', fontWeight: 700 }}>
              <ShopOutlined /> Alm: {whsCode}
            </Tag>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.3 }}>
            {itemName || 'Sin descripción'}
          </div>
          <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#64748b' }}>
            Ubicación estándar actual: <strong style={{ color: '#0f172a' }}>{currentBin || 'Sin Asignar'}</strong>
          </div>
        </div>

        {/* Input con Validación */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#334155', marginBottom: 6 }}>
            Nueva Ubicación Predeterminada:
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input
              placeholder="Ej: 01-10-20-00-00"
              value={newBin}
              onChange={(e) => handleChangeInput(e.target.value)}
              onPressEnter={handleSave}
              onFocus={(e) => e.target.select()}
              size="large"
              prefix={<EnvironmentOutlined style={{ color: '#9ca3af' }} />}
              suffix={
                validating ? (
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                ) : isValid === true ? (
                  <CheckCircleFilled style={{ color: '#198754', fontSize: 18 }} />
                ) : isValid === false ? (
                  <CloseCircleFilled style={{ color: '#ef4444', fontSize: 18 }} />
                ) : null
              }
              style={{
                borderRadius: 8,
                borderColor: isValid === true ? '#198754' : isValid === false ? '#ef4444' : '#d9d9d9',
                boxShadow: isValid === true ? '0 0 0 2px rgba(25, 135, 84, 0.1)' : isValid === false ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : 'none'
              }}
            />
          </div>

          {/* Mensaje de validación */}
          {validMessage && (
            <div style={{
              marginTop: 6,
              fontSize: '0.8rem',
              fontWeight: 700,
              color: isValid ? '#198754' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {isValid ? <CheckCircleFilled /> : <CloseCircleFilled />}
              {validMessage}
            </div>
          )}
        </div>

        {/* Sugerencias de ubicaciones del artículo */}
        {binOptions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
              Ubicaciones registradas con stock para seleccionar:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {binOptions.map((opt, oIdx) => (
                <Tag
                  key={oIdx}
                  onClick={() => handleChangeInput(opt.value)}
                  style={{
                    cursor: 'pointer',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    backgroundColor: '#f0fdf4',
                    borderColor: '#bbf7d0',
                    color: '#166534'
                  }}
                  title="Haz clic para seleccionar esta ubicación"
                >
                  📍 {opt.value}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
