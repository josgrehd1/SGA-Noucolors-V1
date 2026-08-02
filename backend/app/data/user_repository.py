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
            selection=["EmployeeID", "SalesPersonCode", "U_BXPDfPrn"],
            filter={"ApplicationUserID": usercode},
            master_session=master_session
        )
        if info.get('status') == 'ok' and info.get('data'):
            return info['data'][0]
        return {}
