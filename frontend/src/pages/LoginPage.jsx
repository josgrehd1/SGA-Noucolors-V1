import React, { useEffect } from 'react';
import { Card, Input, Select, Button, Row, Col, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, DatabaseOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.png';

const { Title, Text } = Typography;

const LoginSchema = Yup.object().shape({
  username: Yup.string()
    .trim()
    .min(2, 'El usuario debe tener al menos 2 caracteres')
    .required('El usuario SAP es obligatorio'),
  password: Yup.string()
    .min(3, 'La contraseña debe tener al menos 3 caracteres')
    .required('La contraseña es obligatoria'),
  company_db: Yup.string()
    .oneOf(['NouColors_D', 'KLEANTEK_PROD', 'NouColors_D_TEST'], 'Base de datos no válida')
    .required('Debe seleccionar una base de datos SAP')
});

export const LoginPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // 1. Declarar TODOS los hooks al inicio del componente (Regla de Hooks de React)
  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
      company_db: 'NouColors_D'
    },
    validationSchema: LoginSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        await login(values.username.trim(), values.password, values.company_db);
        message.success('Sesión iniciada correctamente en SAP');
        navigate('/dashboard', { replace: true });
      } catch (err) {
        message.error(err.message || 'Error al iniciar sesión en SAP');
      } finally {
        setSubmitting(false);
      }
    }
  });

  // 2. Redirección segura mediante useEffect sin romper el número de hooks
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  return (
    <div className="sga-login-page-bg">
      <Row justify="center" align="middle" style={{ width: '100%' }}>
        <Col xs={24} sm={18} md={12} lg={8} xl={6}>
          <Card
            styles={{ body: { padding: 0 } }}
            className="sga-login-card"
          >
            {/* Cabecera Corporativa NouColors (#1a202e) */}
            <div className="sga-login-header">
              <div className="sga-login-logo-box">
                <img src={logoImg} alt="NouColors" style={{ height: 36, objectFit: 'contain' }} />
              </div>
              <Title level={4} style={{ color: '#ffffff', margin: 0, fontWeight: 700 }}>
                SGA NouColors
              </Title>
              <Text className="sga-login-subtitle">
                Sistema de Gestión de Almacén
              </Text>
            </div>

            {/* Cuerpo del Formulario sobre Fondo Blanco */}
            <div style={{ padding: '24px 20px' }}>
              <form onSubmit={formik.handleSubmit}>
                <div className="sga-form-field-group">
                  <label className="sga-form-label">
                    Usuario SAP:
                  </label>
                  <Input
                    name="username"
                    autoComplete="username"
                    prefix={<UserOutlined style={{ color: '#0d6efd' }} />}
                    placeholder="Ingrese su usuario SAP..."
                    size="large"
                    value={formik.values.username}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    status={formik.touched.username && formik.errors.username ? 'error' : ''}
                  />
                  {formik.touched.username && formik.errors.username && (
                    <div className="sga-form-error-msg">{formik.errors.username}</div>
                  )}
                </div>

                <div className="sga-form-field-group">
                  <label className="sga-form-label">
                    Contraseña:
                  </label>
                  <Input.Password
                    name="password"
                    autoComplete="current-password"
                    prefix={<LockOutlined style={{ color: '#0d6efd' }} />}
                    placeholder="••••••••"
                    size="large"
                    value={formik.values.password}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    status={formik.touched.password && formik.errors.password ? 'error' : ''}
                  />
                  {formik.touched.password && formik.errors.password && (
                    <div className="sga-form-error-msg">{formik.errors.password}</div>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label className="sga-form-label">
                    Base de Datos SAP:
                  </label>
                  <Select
                    size="large"
                    style={{ width: '100%' }}
                    suffixIcon={<DatabaseOutlined style={{ color: '#0d6efd' }} />}
                    value={formik.values.company_db}
                    onChange={(val) => formik.setFieldValue('company_db', val)}
                    options={[
                      { value: 'NouColors_D', label: 'NouColors_D' },
                      { value: 'KLEANTEK_PROD', label: 'Kleantek' },
                      { value: 'NouColors_D_TEST', label: 'NouColors_D_TEST' }
                    ]}
                  />
                </div>

                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<LoginOutlined />}
                  block
                  size="large"
                  loading={formik.isSubmitting}
                  className="sga-login-btn-submit"
                >
                  Iniciar Sesión
                </Button>
              </form>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
