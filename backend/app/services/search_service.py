from app.data.sap_repository import SapRepository

class SearchService:
    """
    Servicio de Búsquedas y Autocompletado de Clientes, Proveedores, Productos y Oportunidades.
    """

    @staticmethod
    def search_customers(query=''):
        info = SapRepository.get_data(
            resource="BusinessPartners", 
            filter={"multiple": {"CardCode": query, "AliasName": query, "CardName": query}, "CardType__or": ["C", "L"], "Valid": "tYES"}, 
            selection=["CardCode", "CardName"], 
            orderby="CardName"
        )
        if info.get('status') == 'ok':
            return [{"id": x["CardCode"], "text": f"{x['CardCode']} - {x['CardName']}"} for x in info.get('data', [])]
        return []

    @staticmethod
    def search_suppliers(query=''):
        info = SapRepository.get_data(
            resource="BusinessPartners", 
            filter={"multiple": {"CardCode": query, "AliasName": query, "CardName": query}, "CardType": "S", "Valid": "tYES"}, 
            selection=["CardCode", "CardName"], 
            orderby="CardName"
        )
        if info.get('status') == 'ok':
            return [{"id": x["CardCode"], "text": f"{x['CardCode']} - {x['CardName']}"} for x in info.get('data', [])]
        return []

    @staticmethod
    def search_products(query=''):
        info = SapRepository.get_data(
            resource="Items", 
            filter={"ItemName__contains": str.upper(query), "SalesItem": "tYES", "Valid": "tYES"}, 
            selection=["ItemCode", "ItemName"], 
            orderby="ItemName"
        )
        if info.get('status') == 'ok':
            return [{"id": x["ItemCode"], "text": f"{x['ItemCode']} - {x['ItemName']}"} for x in info.get('data', [])]
        return []

    @staticmethod
    def search_opportunities(query=''):
        info = SapRepository.get_data(
            resource="SalesOpportunities", 
            filter={"multiple": {"SequentialNo": query, "OpportunityName": query}}, 
            selection=["SequentialNo", "OpportunityName"], 
            orderby="SequentialNo", 
            order_direction="desc"
        )
        if info.get('status') == 'ok':
            return [{"id": x["SequentialNo"], "text": f"{x['SequentialNo']} - {x['OpportunityName']}"} for x in info.get('data', [])]
        return []
