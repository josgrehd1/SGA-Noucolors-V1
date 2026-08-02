import os
import sys
import traceback
import logging
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
from flask import request, session

class ErrorHandler:
    def __init__(self):
        self.error_logger = None

    def init_app(self, app):
        log_dir = os.path.join(app.root_path, 'logs')
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)

        error_log_path = os.path.join(log_dir, 'sga_errors.log')
        
        handler = TimedRotatingFileHandler(
            error_log_path,
            when="midnight",
            interval=1,
            backupCount=30,
            encoding='utf-8'
        )
        handler.setLevel(logging.ERROR)
        
        formatter = logging.Formatter('%(message)s')
        handler.setFormatter(formatter)
        
        logger = logging.getLogger('sga_error_logger')
        logger.setLevel(logging.ERROR)
        if not logger.handlers:
            logger.addHandler(handler)
            
        self.error_logger = logger

    def log_error(self, exception, context="General", payload=None):
        """
        Registra un error detallado y formateado de forma fluida en sga_errors.log
        """
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        user = session.get('sap_user') or session.get('sap_username') or 'Anónimo'
        company = session.get('company_db') or 'N/A'
        
        try:
          endpoint = request.path if request else 'CLI/Background'
          method = request.method if request else 'N/A'
          client_ip = request.remote_addr if request else '127.0.0.1'
        except Exception:
          endpoint = 'Desconocido'
          method = 'N/A'
          client_ip = '127.0.0.1'

        tb = traceback.format_exc() if sys.exc_info()[0] else 'Sin traza de excepción'

        log_entry = (
            f"\n{'='*90}\n"
            f"  [FECHA / HORA] : {timestamp}\n"
            f"  [CONTEXTO]     : {context}\n"
            f"  [ENDPOINT]     : {method} {endpoint}\n"
            f"  [IP CLIENTE]   : {client_ip}\n"
            f"  [USUARIO SAP]  : {user} (BD: {company})\n"
            f"  [MENSAJE ERROR]: {str(exception)}\n"
        )

        if payload:
            log_entry += f"  [PAYLOAD DATA] : {payload}\n"

        log_entry += (
            f"  [DETALLE TRAZA]:\n{tb.strip()}\n"
            f"{'='*90}\n"
        )

        if self.error_logger:
            self.error_logger.error(log_entry)
        else:
            print(log_entry)

    def get_error(self, exception):
        exc_type, exc_value, exc_traceback = sys.exc_info()
        if exc_traceback:
            lista_errores = traceback.extract_tb(exc_traceback)
            ultimo_error = lista_errores[-1]
            archivo = os.path.basename(ultimo_error.filename)
            linea = ultimo_error.lineno
            funcion = ultimo_error.name
            return f"Error en {archivo} -> {funcion}() [Línea {linea}]: {str(exception)}"
        return str(exception)
    
    def handle_res_error(self, res):
        try:
            error_detail = res.json().get('error', {}).get('message', {}).get('value', 'Error desconocido')
            return f"Error SAP: {error_detail}"
        except Exception:
            return f"Error en respuesta SAP (Código HTTP {res.status_code})"