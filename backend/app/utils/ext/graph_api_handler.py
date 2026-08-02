import msal
import requests
import base64

class GraphAPIHandler:
    def __init__(self):
        # Initialize the client once during app startup
        self.client = None
        self.scopes = ["https://graph.microsoft.com/.default"]

    def init_app(self, app):
        tenant_id = app.config.get('GRAPH_TENANT_ID')
        client_id = app.config.get('GRAPH_CLIENT_ID')
        secret_value = app.config.get('GRAPH_SECRET_VALUE')

        if tenant_id and client_id and secret_value:
            try:
                self.client = msal.ConfidentialClientApplication(
                    client_id=client_id,
                    authority=f"https://login.microsoftonline.com/{tenant_id}",
                    client_credential=secret_value
                )
            except Exception as e:
                if hasattr(app, 'logger'):
                    app.logger.warning(f"No se pudo inicializar Microsoft Graph API: {e}")

    def _get_valid_token(self):
        if not self.client:
            raise Exception("Microsoft Graph API no está configurado (faltan credenciales GRAPH_* en .env)")
        
        result = self.client.acquire_token_silent(self.scopes, account=None)
        if not result:
            result = self.client.acquire_token_for_client(scopes=self.scopes)
            
        if "access_token" in result:
            return result["access_token"]
        
        raise Exception(f"TOKEN_ERROR: {result.get('error_description')}")

    def get_all_calendar_events(self, email, start_datetime, end_datetime):
        token = self._get_valid_token()
        headers = {'Authorization': f'Bearer {token}'}
        url = f"https://graph.microsoft.com/v1.0/users/{email}/calendar/calendarView"
        params = {
            'startDateTime': start_datetime,
            'endDateTime': end_datetime,
            '$top': 999,
            '$select': 'subject,start,end,location,bodyPreview'
        }
        response = requests.get(url, headers=headers, params=params)
        return response.json()