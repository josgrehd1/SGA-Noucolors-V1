from flask_socketio import SocketIO
from .ext.print_handler import PrintHandler
from .ext.service_layer_handler import ServiceLayerHandler
from .ext.error_handler import ErrorHandler
from .ext.graph_api_handler import GraphAPIHandler
from .ext.mail_sender import MailSender

sl_handler = ServiceLayerHandler()
err_handler = ErrorHandler()
graph_handler = GraphAPIHandler()
mail_sender = MailSender()
print_handler = PrintHandler()

# Instancia de WebSockets
socketio = SocketIO(cors_allowed_origins="*", async_mode="threading")

def notify_sap_update(event_type="general", details=None):
    """
    Difunde un evento en tiempo real a todos los navegadores/dispositivos conectados vía WebSockets.
    """
    try:
        socketio.emit('sap_update', {
            'type': event_type,
            'details': details or {}
        })
    except Exception as e:
        print(f"[WebSocket Error] Could not broadcast sap_update: {e}")
