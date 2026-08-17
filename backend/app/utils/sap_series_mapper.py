import time
import logging
from app.data.sap_repository import SapRepository
from app.utils.extensions import sl_handler

logger = logging.getLogger(__name__)

class SapSeriesMapper:
    """
    Módulo de resolución y mapeo dinámico de Series de Numeración de SAP Business One (Service Layer)
    para la creación de documentos destino (ej. Albaranes / DeliveryNotes, ObjType 15)
    a partir de documentos origen (ej. Pedidos / Orders, ObjType 17).
    """

    # Prefijos permitidos según regla de negocio
    ALLOWED_PREFIXES = ["AUTOC", "PERSON", "TALLER"]

    # Fallbacks estáticos de respaldo para el ejercicio actual
    FALLBACK_ORDERS_SERIES = {
        5045: "AUTOC",
        5046: "TALLER",
        5047: "PERSON"
    }

    FALLBACK_DELIVERY_SERIES = {
        "AUTOC": 5011,   # AUTOC26
        "TALLER": 5012,  # TALLER26
        "PERSON": 5013   # PERSON26
    }

    # Caché en memoria con TTL de 5 minutos (300 segundos)
    CACHE_TTL = 300
    _cache_series_by_id = {}        # {series_id: (timestamp, series_dict)}
    _cache_user_series = {}         # {user_sign: (timestamp, serie_pedido)}
    _cache_doc_series_list = {}     # {obj_type_str: (timestamp, [series_list])}

    @classmethod
    def _get_master_session(cls):
        """Obtiene la cookie de sesión administradora para entidades protegidas (Users, Series)."""
        try:
            return sl_handler.ensure_master_session()
        except Exception as e:
            logger.warning(f"[SapSeriesMapper] No se pudo obtener master_session: {e}")
            return None

    @classmethod
    def get_series_info_by_id(cls, series_id: int) -> dict:
        """
        Consulta la entidad Series({id}) en SAP Service Layer usando master_session.
        Usa caché en memoria con TTL de 5 minutos y fallback estático.
        """
        if not series_id:
            return {}

        now = time.time()
        try:
            series_id_int = int(series_id)
        except (ValueError, TypeError):
            return {}

        # 1. Comprobar caché
        if series_id_int in cls._cache_series_by_id:
            ts, data = cls._cache_series_by_id[series_id_int]
            if now - ts < cls.CACHE_TTL:
                return data

        # 2. Consultar SAP Service Layer
        series_data = {}
        try:
            master_token = cls._get_master_session()
            res = SapRepository.get_data("Series", filter={"Series": series_id_int}, master_session=master_token)
            if res.get('status') == 'ok' and res.get('data'):
                raw = res['data']
                item = raw[0] if isinstance(raw, list) and len(raw) > 0 else raw
                if isinstance(item, dict):
                    series_data = {
                        "Series": item.get('Series'),
                        "Name": item.get('Name') or item.get('SeriesName') or "",
                        "Document": item.get('Document'),
                        "Locked": item.get('Locked')
                    }
        except Exception as e:
            logger.warning(f"[SapSeriesMapper] Error consultando Series({series_id_int}) en SAP: {e}")

        # 3. Fallback estático si no se obtuvo Name de SAP
        if not series_data.get("Name"):
            fallback_name = cls.FALLBACK_ORDERS_SERIES.get(series_id_int)
            if fallback_name:
                series_data = {
                    "Series": series_id_int,
                    "Name": fallback_name,
                    "Document": "17",
                    "Locked": "tNO"
                }

        # Guardar en caché
        if series_data:
            cls._cache_series_by_id[series_id_int] = (now, series_data)

        return series_data

    @classmethod
    def get_user_serie_pedido(cls, user_sign: int) -> str:
        """
        Consulta la entidad Users(user_sign) en SAP Service Layer para leer U_MAC_SeriePedido.
        Usa master_session para evitar errores 401/403 por permisos de operarios.
        """
        if user_sign is None:
            return None

        now = time.time()
        try:
            user_sign_int = int(user_sign)
        except (ValueError, TypeError):
            return None

        # 1. Comprobar caché
        if user_sign_int in cls._cache_user_series:
            ts, val = cls._cache_user_series[user_sign_int]
            if now - ts < cls.CACHE_TTL:
                return val

        # 2. Consultar SAP Service Layer con master_session
        serie_usuario = None
        try:
            master_token = cls._get_master_session()
            user_res = SapRepository.get_data("Users", id=user_sign_int, master_session=master_token)
            if user_res.get('status') == 'ok' and user_res.get('data'):
                raw_user = user_res['data']
                u_data = raw_user[0] if isinstance(raw_user, list) and len(raw_user) > 0 else raw_user
                if isinstance(u_data, dict):
                    serie_usuario = u_data.get('U_MAC_SeriePedido') or u_data.get('U_MAC_Seriepedido')
        except Exception as e:
            logger.warning(f"[SapSeriesMapper] Error consultando Users({user_sign_int}) en SAP: {e}")

        # Guardar en caché
        cls._cache_user_series[user_sign_int] = (now, serie_usuario)
        return serie_usuario

    @classmethod
    def get_active_series_for_doc(cls, dst_obj_type: int = 15) -> list:
        """
        Obtiene de SAP Service Layer todas las series activas (Locked != 'tYES')
        para un tipo de documento (ej. 15 = Albaranes).
        Usa caché en memoria con TTL de 5 minutos.
        """
        now = time.time()
        doc_key = str(dst_obj_type)

        # 1. Comprobar caché
        if doc_key in cls._cache_doc_series_list:
            ts, series_list = cls._cache_doc_series_list[doc_key]
            if now - ts < cls.CACHE_TTL and series_list:
                return series_list

        # 2. Consultar SAP Service Layer con master_session
        series_list = []
        try:
            master_token = cls._get_master_session()
            res = SapRepository.get_data(
                "Series",
                filter={"Document": doc_key},
                master_session=master_token,
                all_results=True
            )
            if res.get('status') == 'ok' and res.get('data'):
                raw_items = res['data'] if isinstance(res['data'], list) else [res['data']]
                for item in raw_items:
                    if isinstance(item, dict):
                        locked = str(item.get('Locked') or '').strip().lower()
                        if locked not in ('tyes', 'yes', 'y', 't'):
                            series_list.append({
                                "Series": item.get('Series'),
                                "Name": item.get('Name') or item.get('SeriesName') or "",
                                "Document": str(item.get('Document')),
                                "Locked": item.get('Locked')
                            })
        except Exception as e:
            logger.warning(f"[SapSeriesMapper] Error consultando series de Document='{doc_key}' en SAP: {e}")

        # Guardar en caché si se obtuvieron resultados
        if series_list:
            cls._cache_doc_series_list[doc_key] = (now, series_list)

        return series_list

    @classmethod
    def resolve_dst_series_id(cls, matched_prefix: str, dst_obj_type: int = 15) -> int:
        """
        Resuelve dinámicamente el ID de serie destino para el tipo de documento (ej. 15)
        buscando entre las series activas de SAP aquella cuyo nombre contenga el prefijo (ej. 'AUTOC').
        Si no se encuentra o falla, recurre al fallback estático.
        """
        if not matched_prefix:
            return None

        prefix_upper = str(matched_prefix).upper().strip()

        # 1. Intentar resolución dinámica contra SAP
        active_series = cls.get_active_series_for_doc(dst_obj_type=dst_obj_type)
        for s in active_series:
            s_name_upper = str(s.get('Name') or '').upper()
            if prefix_upper in s_name_upper and s.get('Series') is not None:
                try:
                    return int(s['Series'])
                except (ValueError, TypeError):
                    pass

        # 2. Fallback estático de respaldo
        if int(dst_obj_type) == 15:
            return cls.FALLBACK_DELIVERY_SERIES.get(prefix_upper)

        return None

    @classmethod
    def resolve_series_by_user_or_order(cls, doc_original: dict, dst_obj_type: int = 15) -> dict:
        """
        Dada la cabecera del pedido original (doc_original) y el tipo de documento destino (dst_obj_type=15),
        resuelve la serie destino siguiendo el orden de prioridad:
          1. Usuario creador del pedido (UserSign -> OUSR.U_MAC_SeriePedido) con master_session.
          2. Serie del pedido (Orders.Series -> Series.Name) con master_session y fallback.
          3. Evaluación de lista blanca (AUTOC, PERSON, TALLER).
          4. Búsqueda dinámica de la serie destino en SAP (Document='15') con fallback.
          5. Si es otra serie (ej. AKUA, RECAMBIOS), dst_series_id = None (serie default SAP).

        Retorna dict:
          {
            "candidate_name": str,
            "matched_prefix": str or None,
            "series_name": str,
            "dst_series_id": int or None,
            "src_type": str
          }
        """
        default_res = {
            "candidate_name": None,
            "matched_prefix": None,
            "series_name": "Default SAP",
            "dst_series_id": None,
            "src_type": "No detectado"
        }

        if not doc_original:
            return default_res

        try:
            # 1. Intentar obtener U_MAC_SeriePedido de la ficha del usuario creador (UserSign)
            user_sign = doc_original.get('UserSign')
            serie_usuario = cls.get_user_serie_pedido(user_sign) if user_sign is not None else None

            # 2. Si no hay serie de usuario, obtener la serie del pedido
            serie_pedido_name = None
            if not serie_usuario:
                # Si el documento ya trae SeriesName (ej. desde vista analítica)
                if doc_original.get('SeriesName'):
                    serie_pedido_name = doc_original.get('SeriesName')
                else:
                    # Consultar entidad Series por ID numérico
                    order_series_id = doc_original.get('Series') or doc_original.get('SERIES')
                    if order_series_id:
                        s_info = cls.get_series_info_by_id(order_series_id)
                        serie_pedido_name = s_info.get('Name')

            # 3. Determinar candidato y origen
            candidate_name = serie_usuario or serie_pedido_name or ""
            src_type = "Usuario Creador (OUSR)" if serie_usuario else ("Serie del Pedido (ORDR)" if serie_pedido_name else "No detectado")
            candidate_upper = str(candidate_name).upper().strip()

            # 4. Evaluar si contiene algún prefijo de la regla de negocio
            matched_prefix = None
            for prefix in cls.ALLOWED_PREFIXES:
                if prefix in candidate_upper:
                    matched_prefix = prefix
                    break

            # 5. Obtener ID destino si hubo coincidencia
            dst_series_id = None
            series_name = "Default SAP"

            if matched_prefix:
                dst_series_id = cls.resolve_dst_series_id(matched_prefix, dst_obj_type=dst_obj_type)
                series_name = f"{matched_prefix} (ID: {dst_series_id})" if dst_series_id else matched_prefix
            else:
                # Para cualquier otra serie (AKUA, RECAMBIOS, etc.), se deja None para asignación automática
                series_name = candidate_name if candidate_name else "Default SAP"

            logger.info(
                f"[SapSeriesMapper] Resuelto: candidato='{candidate_name}' ({src_type}), "
                f"prefijo='{matched_prefix}', dst_series_id={dst_series_id}"
            )

            return {
                "candidate_name": candidate_name,
                "matched_prefix": matched_prefix,
                "series_name": series_name,
                "dst_series_id": dst_series_id,
                "src_type": src_type
            }

        except Exception as e:
            logger.error(f"[SapSeriesMapper] Error inesperado en resolución de series: {e}", exc_info=True)
            return default_res

    @classmethod
    def map_series(cls, src_obj_type: int, src_series_id: int, dst_obj_type: int = 15) -> int:
        """
        Helper secundario para compatibilidad directa por IDs.
        """
        try:
            # Obtener nombre de la serie origen
            s_info = cls.get_series_info_by_id(src_series_id)
            s_name = s_info.get('Name', '')
            for prefix in cls.ALLOWED_PREFIXES:
                if prefix in s_name.upper():
                    return cls.resolve_dst_series_id(prefix, dst_obj_type=dst_obj_type)
            return None
        except Exception:
            return None
