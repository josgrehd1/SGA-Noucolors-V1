import os
import logging
from logging.handlers import TimedRotatingFileHandler
import warnings
from urllib3.exceptions import InsecureRequestWarning
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_compress import Compress
from flask_session import Session

from app.utils.extensions import sl_handler, graph_handler, mail_sender, err_handler, socketio
from app.version import APP_VERSION
from binaries import register_binaries

def create_app():
    register_binaries()
    app = Flask(__name__)
    Compress(app)
    app.config.from_object('config.Config')
    warnings.simplefilter('ignore', InsecureRequestWarning)

    # Configuración de CORS para cliente React (Vite en http://localhost:5173)
    CORS(app, supports_credentials=True, origins=app.config.get('CORS_ORIGINS', ["http://localhost:5173", "http://127.0.0.1:5173"]))

    # Configuración de Sesión
    Session(app)

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
    graph_handler.init_app(app)
    mail_sender.init_app(app)
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

    return app
