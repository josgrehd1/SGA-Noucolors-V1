import os
import logging
from logging.handlers import TimedRotatingFileHandler
import warnings
from urllib3.exceptions import InsecureRequestWarning
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
from flask_compress import Compress
from flask_session import Session
import mimetypes

# Forzar MIME types correctos (Windows a veces mapea .js a text/plain)
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

from app.utils.extensions import sl_handler, err_handler, socketio
from app.version import APP_VERSION
from binaries import register_binaries

# Ruta al build compilado del frontend React
FRONTEND_DIST = os.path.join(os.path.abspath(os.path.dirname(__file__)), '..', '..', 'frontend', 'dist')

def create_app():
    register_binaries()
    app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path='/')
    Compress(app)
    app.config.from_object('config.Config')
    warnings.simplefilter('ignore', InsecureRequestWarning)

    # Configuración de CORS para cliente React (Vite en http://localhost:5173)
    CORS(app, supports_credentials=True, origins=app.config.get('CORS_ORIGINS', ["http://localhost:5173", "http://127.0.0.1:5173"]))

    # Configuración de Sesión
    Session(app)

    # Filtros Jinja2 para Documentos y Albaranes PDF
    from datetime import datetime

    @app.template_filter('format_date')
    def format_date(value):
        if not value:
            return ""
        try:
            date_str = str(value).split('T')[0]
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            return date_obj.strftime('%d/%m/%Y')
        except (ValueError, TypeError, IndexError):
            return value

    @app.template_filter('format_currency')
    def format_currency(value):
        try:
            return "{:,.2f}".format(float(value)).replace(",", "X").replace(".", ",").replace("X", ".")
        except (ValueError, TypeError):
            return value

    # Logging
    log_dir = os.path.join(app.root_path, 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    formatter = logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s')
    handler_general = TimedRotatingFileHandler(
        os.path.join(log_dir, 'access.log'), when="midnight", interval=1, backupCount=30, encoding='utf-8'
    )
    handler_general.setFormatter(formatter)
    handler_general.setLevel(logging.INFO)
    app.logger.addHandler(handler_general)

    # Inicialización de extensiones
    sl_handler.init_app(app)
    err_handler.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*")

    @socketio.on('connect')
    def handle_connect():
        app.logger.info(f"Cliente WebSocket conectado. Transmitiendo versión: {APP_VERSION}")
        socketio.emit('version_check', {'version': APP_VERSION})

    # Captura Global Fluida de Errores y Logging Detallado
    @app.errorhandler(Exception)
    def handle_global_exception(e):
        payload_data = None
        try:
            payload_data = request.get_json(silent=True) or request.form.to_dict()
        except Exception:
            pass

        # Loguear de forma fluida y detallada en app/logs/sga_errors.log
        err_handler.log_error(e, context="Flask Global ErrorHandler", payload=payload_data)

        response_data = {
            'status': 'error',
            'message': str(e),
            'formatted_error': err_handler.get_error(e)
        }
        status_code = getattr(e, 'code', 500)
        return jsonify(response_data), status_code if isinstance(status_code, int) else 500

    # Registrar Blueprint Unificado
    from .routes.api import api_bp
    app.register_blueprint(api_bp)

    # Servir frontend React compilado (SPA catch-all)
    # Todas las rutas que no sean /api/* retornan el index.html del build de React
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        dist = FRONTEND_DIST
        # Intentar servir el archivo estático si existe (JS, CSS, imágenes, etc.)
        if path and os.path.exists(os.path.join(dist, path)):
            return send_from_directory(dist, path)
        # Para todas las rutas de React Router, devolver index.html
        index_path = os.path.join(dist, 'index.html')
        if os.path.exists(index_path):
            return send_file(index_path)
        # Si no existe build, informar al desarrollador
        return jsonify({
            'error': 'Frontend no compilado. Ejecuta: cd frontend && npm run build'
        }), 404

    # Iniciar Monitor en segundo plano para detección de nuevos pedidos en SAP (1 solo hilo global)
    if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        from app.services.sap_sync_monitor import SapSyncMonitor
        SapSyncMonitor.start_monitor(app, interval_seconds=20)

    return app
