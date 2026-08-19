from app.data.sap_repository import SapRepository

class SearchService:
    """
    Servicio de Búsquedas y Autocompletado de Clientes, Proveedores, Productos y Oportunidades.
    """

    @staticmethod
    def search_customers(query=''):
        q = str(query).strip() if query else ''
        if q:
            filter_spec = {
                "multiple": {"CardCode": q, "AliasName": q, "CardName": q},
                "CardType__or": ["C", "L"],
                "Valid": "tYES"
            }
        else:
            filter_spec = {"CardType__or": ["C", "L"], "Valid": "tYES"}

        info = SapRepository.get_data(
            resource="BusinessPartners", 
            filter=filter_spec, 
            selection=["CardCode", "CardName"], 
            orderby="CardName",
            per_page=15
        )
        if info.get('status') == 'ok':
            return [{"value": x["CardName"], "label": f"{x['CardCode']} - {x['CardName']}"} for x in info.get('data', [])]
        return []

    @staticmethod
    def search_docnums(query='', objtype='17', ver_inactivos=False):
        q = str(query).replace('#', '').strip() if query else ''
        sap_filter = {"OBJTYPE": str(objtype)}

        if str(objtype) == "17" and not ver_inactivos:
            sap_filter["U_NC_INC_PRDMX"] = "Y"
        elif ver_inactivos:
            sap_filter["U_NC_INC_PRDMX"] = "N"

        if q:
            if q.isdigit():
                sap_filter["DOCNUM"] = int(q)
            else:
                sap_filter["CARDNAME__contains"] = q

        info = SapRepository.get_data_from_view(
            view_name="NC_SGA_SOLICITUDES_CAB_B1SLQuery",
            filter=sap_filter,
            orderby="DOCNUM",
            order_direction="desc",
            per_page=15
        )
        if info.get('status') == 'ok':
            return [{"value": str(x.get("DOCNUM", "")), "label": f"#{x.get('DOCNUM')} - {x.get('CARDNAME')}"} for x in info.get('data', [])]
        return []

    @staticmethod
    def search_bins(term=''):
        q = str(term).strip().upper() if term else ''
        sap_filter = {"BinCode__contains": q} if q else {}
        info = SapRepository.get_data(
            resource="BinLocations",
            filter=sap_filter,
            selection=["BinCode", "AbsEntry"],
            orderby="BinCode",
            per_page=15,
            inline_count=False
        )
        if info.get('status') == 'ok':
            return [{"value": x["BinCode"], "label": x["BinCode"]} for x in info.get('data', [])]
        return []

    @staticmethod
    def search_items(term=''):
        q = str(term).strip().upper() if term else ''
        sap_filter = {"Valid": "tYES", "InventoryItem": "tYES"}
        if q:
            sap_filter["ItemCode__contains"] = q
        info = SapRepository.get_data(
            resource="Items",
            filter=sap_filter,
            selection=["ItemCode", "ItemName"],
            orderby="ItemCode",
            per_page=15,
            inline_count=False
        )
        if info.get('status') == 'ok':
            return [{"value": x["ItemCode"], "label": f"{x['ItemCode']} — {x['ItemName']}"} for x in info.get('data', [])]
        return []
