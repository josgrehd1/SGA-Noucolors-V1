from app.utils.extensions import sl_handler

class SapRepository:
    """
    Capa de Repositorio de Datos.
    EXCLUSIVO: Responsable de traducir las consultas a OData /b1s/v2/ 
    y consultar las Vistas de Microsoft SQL Server de SAP Business One.
    """
    
    @staticmethod
    def get_data(resource, id=None, filter=None, selection=None, orderby=None, order_direction=None, page=None, per_page=None, expand=None, all_results=False, master_session=None, inline_count=True):
        """
        Ejecuta peticiones GET /b1s/v2/{resource} o GET /b1s/v2/{resource}({id})
        aprovechando los operadores OData: $select, $filter, $orderby, $top, $skip, $expand.
        """
        return sl_handler.get_data(
            resource=resource,
            id=id,
            filter=filter,
            selection=selection,
            orderby=orderby,
            order_direction=order_direction,
            page=page,
            per_page=per_page,
            expand=expand,
            all_results=all_results,
            master_session=master_session,
            inline_count=inline_count
        )

    @staticmethod
    def get_data_from_view(view_name, filter=None, selection=None, orderby=None, order_direction=None, page=None, per_page=None, all_results=False, master_session=None):
        """
        Consulta Vistas Analíticas de Microsoft SQL Server en SAP Service Layer.
        ej. NC_STOCK_UBICACION_B1SLQuery, NC_SGA_SOLICITUDES_CAB_B1SLQuery, etc.
        """
        return sl_handler.get_data_from_view(
            view_name=view_name,
            filter=filter,
            selection=selection,
            orderby=orderby,
            order_direction=order_direction,
            page=page,
            per_page=per_page,
            all_results=all_results,
            master_session=master_session
        )

    @staticmethod
    def post(resource, payload, master_session=None):
        """
        Ejecuta peticiones POST /b1s/v2/{resource} para crear entidades en SAP (StockTransfers, DeliveryNotes, etc.)
        """
        return sl_handler.post(resource=resource, payload=payload, master_session=master_session)

    @staticmethod
    def update(resource, id, payload, master_session=None):
        """
        Ejecuta peticiones PATCH /b1s/v2/{resource}({id}) para actualizar campos en SAP (ej: U_Estado en NC_SGAWEB_DOCS).
        """
        return sl_handler.update(resource=resource, id=id, payload=payload, master_session=master_session)

    @staticmethod
    def delete(resource, id, master_session=None):
        """
        Ejecuta peticiones DELETE /b1s/v2/{resource}({id}).
        """
        return sl_handler.delete(resource=resource, id=id, master_session=master_session)

    @staticmethod
    def parse_sap_error(res):
        """
        Extrae y limpia el mensaje de error OData devuelto por SAP Service Layer.
        """
        try:
            err_json = res.json()
            if isinstance(err_json, dict) and 'error' in err_json:
                msg = err_json['error'].get('message', {})
                if isinstance(msg, dict):
                    return msg.get('value', res.text)
                return str(msg)
            return res.text
        except Exception:
            return res.text if hasattr(res, 'text') else str(res)
