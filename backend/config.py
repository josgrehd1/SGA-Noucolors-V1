import os
from dotenv import load_dotenv

# Cargar variables del archivo .env al inicio
base_dir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(base_dir, '.env'))

class Config:
    """
    Configuración de Seguridad cargada dinámicamente desde variables de entorno (.env).
    """
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default_fallback_secret_key_sga_2026')
    FLASK_ENV = os.environ.get('FLASK_ENV', 'development')
    FLASK_DEBUG = os.environ.get('FLASK_DEBUG', '1') == '1'
    PORT = int(os.environ.get('PORT', 5000))

    # Configuración de Sesión
    SESSION_TYPE = 'filesystem'
    SESSION_FILE_DIR = os.path.join(base_dir, 'flask_session')
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 24 * 30  # 30 días de persistencia
    SESSION_USE_SIGNER = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # SAP Service Layer Config (SQL Server)
    SAP_SL_URL = os.environ.get('SAP_SL_URL', 'https://192.168.1.156:50000/b1s/v2/')
    SAP_SERVER = os.environ.get('SAP_SERVER', '192.168.1.156')
    SAP_PORT = int(os.environ.get('SAP_PORT', 50000))

    # Credenciales Master de SAP
    SAP_MASTER_USER = os.environ.get('SAP_MASTER_USER', 'manager')
    SAP_MASTER_PASSWORD = os.environ.get('SAP_MASTER_PASSWORD', '')

    # CORS Config para cliente React (Vite)
    cors_raw = os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
    CORS_ORIGINS = [origin.strip() for origin in cors_raw.split(',') if origin.strip()]
