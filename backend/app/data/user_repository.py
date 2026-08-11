from app.data.sap_repository import SapRepository

class UserRepository:
    """
    Repositorio de datos para operarios y usuarios SAP Business One.
    """

    @staticmethod
    def find_user_by_code(username, master_session=None):
        info = SapRepository.get_data(
            resource="Users", 
            selection=["InternalKey", "UserCode", "eMail"], 
            filter={"UserCode": username},
            master_session=master_session
        )
        if info.get('status') == 'ok' and info.get('data'):
            return info['data'][0]
        return None

    @staticmethod
    def get_employee_info(usercode, master_session=None):
        info = SapRepository.get_data(
            resource="EmployeesInfo",
            selection=["EmployeeID", "SalesPersonCode", "U_BXPDfPrn", "U_U_MAC_Nivel"],
            filter={"ApplicationUserID": usercode},
            master_session=master_session
        )
        if info.get('status') == 'ok' and info.get('data'):
            return info['data'][0]
        return {}

    @staticmethod
    def authenticate_employee_by_udf(username, password, master_session=None):
        """
        Autentica al operario buscando en EmployeesInfo (OHEM) por el campo U_MAC_User
        y validando el campo U_MAC_Pass (Acceso Indirecto).
        """
        if not username or not password:
            return None

        u_str = str(username).strip()
        p_str = str(password).strip()

        # Búsqueda directa en SAP por U_MAC_User (probando exacto y en mayúsculas)
        FIELDS = ["EmployeeID", "SalesPersonCode", "FirstName", "LastName", "U_BXPDfPrn",
                  "U_MAC_User", "U_MAC_Pass", "U_U_MAC_Nivel", "Active"]

        info = SapRepository.get_data(
            resource="EmployeesInfo",
            selection=FIELDS,
            filter={"U_MAC_User": u_str},
            master_session=master_session
        )

        if info.get('status') == 'ok' and not info.get('data'):
            info = SapRepository.get_data(
                resource="EmployeesInfo",
                selection=FIELDS,
                filter={"U_MAC_User": u_str.upper()},
                master_session=master_session
            )

        if info.get('status') == 'ok' and info.get('data'):
            for emp in info['data']:
                stored_pass = str(emp.get('U_MAC_Pass', '') or '').strip()
                if stored_pass == p_str:
                    first = (emp.get('FirstName') or '').strip()
                    last = (emp.get('LastName') or '').strip()
                    full_name = f"{first} {last}".strip() or emp.get('U_MAC_User') or username
                    return {
                        'EmployeeID': emp.get('EmployeeID', 0),
                        'SalesPersonCode': emp.get('SalesPersonCode'),
                        'U_BXPDfPrn': emp.get('U_BXPDfPrn', ''),
                        'U_MAC_User': emp.get('U_MAC_User', username),
                        'FullName': full_name,
                        'Nivel': emp.get('U_U_MAC_Nivel') or ''
                    }
        return None
