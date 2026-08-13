import logging
from app.data.sap_repository import SapRepository

logger = logging.getLogger(__name__)

class SapSeriesMapper:

    SERIES_WHITELIST_OBJ15 = {
        "AUTOC": 5011,   # AUTOC26
        "TALLER": 5012,  # TALLER26
        "PERSON": 5013   # PERSON26
    }

    @staticmethod
    def resolve_series_by_user_or_order(doc_original: dict, dst_obj_type: int = 15) -> dict:
        """
        Dada la cabecera del pedido original (doc_original) y el tipo de documento destino (dst_obj_type=15),
        obtiene el usuario creador (UserSign -> OUSR.U_MAC_SeriePedido) o la serie del pedido,
        y evalúa la regla de lista blanca de Noucolors.
        """
        if not doc_original:
            return {"candidate_name": None, "dst_series_id": None}

        # 1. Obtener el usuario creador del pedido (UserSign)
        user_sign = doc_original.get('UserSign')
        serie_usuario = None

        if user_sign is not None:
            try:
                # Consultar entidad Users en SAP Service Layer (OUSR)
                user_res = SapRepository.get_data("Users", id=int(user_sign))
                if user_res.get('status') == 'ok' and user_res.get('data'):
                    raw_user = user_res['data']
                    u_data = raw_user[0] if isinstance(raw_user, list) and len(raw_user) > 0 else raw_user
                    if isinstance(u_data, dict):
                        serie_usuario = u_data.get('U_MAC_SeriePedido') or u_data.get('U_MAC_Seriepedido')
            except Exception as e:
                logger.warning(f"No se pudo consultar el usuario {user_sign} en SAP: {e}")

        # 2. Determinación de la serie candidata
        candidate_name = serie_usuario or doc_original.get('SeriesName') or ""
        candidate_upper = str(candidate_name).upper()

        dst_series_id = None

        # 3. Evaluación de la regla de negocio para Albaranes (ObjType 15)
        if int(dst_obj_type) == 15:
            if "AUTOC" in candidate_upper:
                dst_series_id = 5011  # AUTOC26
            elif "TALLER" in candidate_upper:
                dst_series_id = 5012  # TALLER26
            elif "PERSON" in candidate_upper:
                dst_series_id = 5013  # PERSON26
            else:
                # AKUA y resto: NO forzar 'Series' en el payload. SAP asigna NFN26 automáticamente.
                dst_series_id = None

        return {
            "candidate_name": candidate_name,
            "dst_series_id": dst_series_id
        }

    @staticmethod
    def map_series(src_obj_type: int, src_series_id: int, dst_obj_type: int = 15) -> int:
        """
        Helper secundario para compatibilidad directa por IDs.
        """
        if int(dst_obj_type) == 15:
            # Mapeo conocido por ID si fuera necesario
            id_map = {
                5045: 5011, # AUTOC
                5046: 5012, # TALLER
                5047: 5013  # PERSON
            }
            return id_map.get(int(src_series_id))
        return None
