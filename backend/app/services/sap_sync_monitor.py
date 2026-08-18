import threading
import time
import logging
from app.utils.extensions import notify_sap_update, sl_handler
from app.data.sap_repository import SapRepository

logger = logging.getLogger("sap_sync_monitor")

class SapSyncMonitor:
    """
    Monitor centralizado en segundo plano multi-empresa.
    Realiza una consulta OData/SQL ultra-rápida (TOP 1) cada N segundos
    para cada base de datos activa donde haya operarios conectados.
    Si detecta un nuevo pedido o cambio en la numeración de SAP,
    emite un evento WebSocket 'sap_update' para sincronizar a los operarios al instante.
    """
    _instance = None
    _started = False

    def __init__(self, app=None, interval_seconds=4):
        self.app = app
        self.interval_seconds = interval_seconds
        self.active_dbs = set()  # 100% Dinámico: solo monitoriza la(s) base(s) de datos elegida(s) por el usuario en pantalla
        self.db_states = {}  # { company_db: {"last_max_docentry": int, "last_count": int, "last_update": str} }
        self.running = False
        self.thread = None

    @classmethod
    def start_monitor(cls, app, interval_seconds=4):
        if cls._started and cls._instance:
            return cls._instance
        cls._started = True
        monitor = cls(app, interval_seconds)
        monitor.start()
        cls._instance = monitor
        return monitor

    @classmethod
    def register_active_db(cls, company_db):
        """Registra dinámicamente una base de datos cuando un usuario interactúa o inicia sesión en ella."""
        if cls._instance and company_db:
            if company_db not in cls._instance.active_dbs:
                logger.info(f"[SapSyncMonitor] 🏢 Base de datos añadida a monitorización: {company_db}")
            cls._instance.active_dbs.add(company_db)

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True, name="SapSyncMonitorThread")
        self.thread.start()
        logger.info(f"[SapSyncMonitor] 🚀 Monitor en segundo plano iniciado (Intervalo: {self.interval_seconds}s)")

    def stop(self):
        self.running = False

    def _run_loop(self):
        # Pausa inicial breve
        time.sleep(3)
        
        while self.running:
            try:
                if self.app:
                    with self.app.app_context():
                        self._check_all_dbs()
                else:
                    self._check_all_dbs()
            except Exception as e:
                logger.debug(f"[SapSyncMonitor] Verificación periódica ignorada por error temporal: {e}")
            
            time.sleep(self.interval_seconds)

    def _check_all_dbs(self):
        for db in list(self.active_dbs):
            try:
                self._check_db_updates(db)
            except Exception as e:
                logger.debug(f"[SapSyncMonitor] Error consultando DB {db}: {e}")

    def _check_db_updates(self, company_db):
        # Obtener sesión técnica para la base de datos específica
        master_token = sl_handler.ensure_master_session(company_db=company_db)
        if not master_token:
            return

        # 1. Consulta ultra-ligera: TOP 1 de la vista analítica de pedidos SGA
        res_view = SapRepository.get_data_from_view(
            view_name="NC_SGA_SOLICITUDES_CAB_B1SLQuery",
            orderby="DOCENTRY",
            order_direction="desc",
            page=1,
            per_page=1,
            master_session=master_token
        )

        current_count = res_view.get('count', 0) if res_view.get('status') == 'ok' else 0
        items_view = res_view.get('data', []) if res_view.get('status') == 'ok' else []
        current_max_docentry = items_view[0].get('DOCENTRY') if items_view else None

        # 2. Consulta rápida a la entidad Orders de SAP para detectar el último pedido creado
        res_orders = SapRepository.get_data(
            resource="Orders",
            selection=["DocEntry", "DocNum", "UpdateDate", "UpdateTime"],
            orderby="DocEntry",
            order_direction="desc",
            page=1,
            per_page=1,
            master_session=master_token
        )
        items_orders = res_orders.get('data', []) if res_orders.get('status') == 'ok' else []
        latest_order = items_orders[0] if items_orders else {}
        order_docentry = latest_order.get('DocEntry')
        order_update = f"{latest_order.get('UpdateDate')}_{latest_order.get('UpdateTime')}"

        state = self.db_states.get(company_db)

        # Inicialización de línea base en la primera lectura de esta DB
        if state is None:
            self.db_states[company_db] = {
                "last_max_docentry": current_max_docentry,
                "last_count": current_count,
                "last_order_docentry": order_docentry,
                "last_order_update": order_update
            }
            logger.info(f"[SapSyncMonitor] Línea base fijada para [{company_db}]: Max DocEntry={current_max_docentry}, Total={current_count}, Last Order={order_docentry}")
            return

        last_max = state.get("last_max_docentry")
        last_count = state.get("last_count")
        last_order_de = state.get("last_order_docentry")
        last_order_upd = state.get("last_order_update")

        # Detección de cambios: nuevo pedido en SAP, cambio en SGA o actualización de fecha/hora
        is_changed = False
        if order_docentry and order_docentry != last_order_de:
            is_changed = True
        elif current_max_docentry and current_max_docentry != last_max:
            is_changed = True
        elif current_count != last_count:
            is_changed = True
        elif order_update and order_update != last_order_upd and last_order_upd != "None_None":
            is_changed = True

        if is_changed:
            logger.info(
                f"[SapSyncMonitor] ⚡ Nuevo pedido o cambio detectado en SAP [{company_db}]: "
                f"Order DocEntry {last_order_de} -> {order_docentry} | Total SGA: {last_count} -> {current_count}. Notificando WebSockets..."
            )
            self.db_states[company_db] = {
                "last_max_docentry": current_max_docentry,
                "last_count": current_count,
                "last_order_docentry": order_docentry,
                "last_order_update": order_update
            }
            
            # Emitir evento WebSocket a todos los clientes conectados
            notify_sap_update(
                event_type="sap_new_order",
                details={
                    "company_db": company_db,
                    "docentry": order_docentry or current_max_docentry,
                    "total_count": current_count,
                    "source": "sap_background_monitor"
                }
            )
