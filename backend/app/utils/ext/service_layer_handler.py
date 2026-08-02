# pyrefly: ignore [missing-import]
from flask import current_app, jsonify, session
import requests
import socket

class ServiceLayerHandler:
    def __init__(self):
        self.url_base = None
        self.company = None

    def init_app(self, app):
        self.url_base = app.config.get('SAP_SL_URL', 'https://192.168.1.156:50000/b1s/v2/')
        self.company = app.config.get('COMPANY_DB', 'NOUCOLORS')
        self.server = app.config.get('SAP_SERVER', '192.168.1.156')
        self.port = app.config.get('SAP_PORT', 50000)

    def login(self, username, password, company_db=None):
        url_base = self.url_base or (current_app.config.get('SAP_SL_URL') if current_app else 'https://192.168.1.156:50000/b1s/v2/')
        db = company_db or (session.get('company_db') if session else None) or (current_app.config.get('COMPANY_DB') if current_app else 'NOUCOLORS')
        url = f"{url_base.rstrip('/')}/Login"
        payload = {
            "CompanyDB": db,
            "UserName": username,
            "Password": password
        }
        try:
            res = requests.post(url, json=payload, verify=False, timeout=10)
            if res.status_code == 200:
                data = res.json()
                session_id = data.get('SessionId')
                if session_id and session:
                    session['sap_session'] = session_id
                    session['sap_user'] = username
                    session['sap_username'] = username
                    session['sap_password'] = password
                    session['company_db'] = db
                return {"status": "ok", "session_id": session_id, "data": data}
            else:
                err_msg = f"Error SAP ({res.status_code})"
                try:
                    err_json = res.json()
                    if isinstance(err_json, dict):
                        err_msg = err_json.get('error', {}).get('message', {}).get('value') or err_json.get('error', {}).get('message') or err_msg
                except Exception:
                    if res.text:
                        err_msg = res.text[:200]
                return {"status": "error", "message": err_msg}
        except Exception as e:
            return {"status": "error", "message": f"Error de conexión con SAP Service Layer ({url_base}): {str(e)}"}

    def logout(self):
        url_base = self.url_base or (current_app.config.get('SAP_SL_URL') if current_app else 'https://192.168.1.156:50000/b1s/v2/')
        url = f"{url_base.rstrip('/')}/Logout"
        sap_cookie = session.get('sap_session') if session else None
        if sap_cookie:
            try:
                requests.post(url, cookies={"B1SESSION": sap_cookie}, verify=False, timeout=5)
            except Exception:
                pass

    def _execute_request(self, method, url, payload=None, params=None, replace_collection=False, master_session=None):
        """Método interno para centralizar peticiones con re-logueo automático."""
        sap_cookie = master_session if master_session else (session.get('sap_session') if session else None)

        headers = {
            "Content-Type": "application/json",
            "B1S-ReplaceCollectionsOnPatch": f"{str(replace_collection).lower()}",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
        }
        
        kwargs = {
            "url": url,
            "headers": headers,
            "cookies": {"B1SESSION": sap_cookie} if sap_cookie else {},
            "verify": False,
            "timeout": 10
        }
        if method in ('POST', 'PATCH'):
            kwargs["json"] = payload
        if params:
            kwargs["params"] = params

        res = requests.request(method, **kwargs)

        if res.status_code == 401 or (res.status_code not in (200, 201, 204) and "301" in res.text):
            user = (session.get('sap_user') or session.get('sap_username')) if session else None
            password = session.get('sap_password') if session else None
            
            if user and password:
                company_db = (session.get('company_db') if session else None) or self.company
                login_res = self.login(user, password, company_db=company_db)
                
                if login_res.get("status") == "ok":
                    kwargs["cookies"] = {"B1SESSION": session.get('sap_session')}
                    res = requests.request(method, **kwargs)
        
        return res

    def post(self, resource, payload, master_session=None):
        url = f"{self.url_base}/{resource}"
        return self._execute_request('POST', url, payload=payload, master_session=master_session)
    
    def update(self, resource, payload, id, replace_collection=False):
        id = f"'{id}'" if type(id) == str else id
        url = f"{self.url_base}/{resource}({id})"
        return self._execute_request('PATCH', url, payload=payload, replace_collection=replace_collection)
    
    def close_document(self, resource, id):
        id = f"'{id}'" if type(id) == str else id
        url = f"{self.url_base}/{resource}({id})/Close"
        return self._execute_request('POST', url)
    
    def cancel_document(self, resource, id):
        id = f"'{id}'" if type(id) == str else id
        url = f"{self.url_base}/{resource}({id})/Cancel"
        return self._execute_request('POST', url)
    
    def reopen_document(self, resource, id):
        id = f"'{id}'" if type(id) == str else id
        url = f"{self.url_base}/{resource}({id})/Reopen"
        return self._execute_request('POST', url)
    
    def delete_document(self, resource, id):
        id = f"'{id}'" if type(id) == str else id
        url = f"{self.url_base}/{resource}({id})"
        return self._execute_request('DELETE', url)

    def _execute_get_data(self, url, all_results=False, is_crossjoin=False, specific_val=None, is_view=False, master_session=None):
        all_data_list = []
        current_url = url
        url_base_adj = f"{self.url_base}/{'view.svc/' if is_view else ''}"

        try:
            while True:
                res = self._execute_request(method='GET', url=current_url, master_session=master_session)
                if res.status_code != 200:
                    err_val = 'Unknown Error'
                    try:
                        err_val = res.json().get('error', {}).get('message', {}).get('value', 'Unknown Error')
                    except Exception:
                        pass
                    return {
                        "status": "error",
                        "initial_url": url, 
                        "message": err_val
                    }

                data = res.json()
                data_list = data.get('value', [data])
                
                if is_crossjoin:
                    data_list = [{k: v for fields in item.values() if isinstance(fields, dict) for k, v in fields.items()} for item in data_list]

                all_data_list.extend(data_list)

                next_link = data.get('odata.nextLink')
                if all_results and next_link:
                    current_url = f"{url_base_adj}/{next_link.replace('%20', ' ')}"
                else:
                    break

            count = data.get('odata.count', len(all_data_list))

            if specific_val:
                val_result = all_data_list[0].get(specific_val) if all_data_list else None
                return {"status": "ok", "initial_url": url, "count": count, "data": val_result}
                
            return {"status": "ok", "initial_url": url, "count": count, "data": all_data_list}

        except Exception as e:
            return {"status": "error", "initial_url": url, "message": str(e)}

    def get_data_from_query(self, query_name, all_results=False, master_session=None, **params):
        url = f"{self.url_base}/SQLQueries('{query_name}')/List"
        return self._execute_get_data(url, all_results=all_results, master_session=master_session)

    def get_data(self, resource, id=None, filter=None, selection=None, orderby=None, order_direction=None, page=None, per_page=None, expand=None, all_results=False, master_session=None):
        if not self.url_base:
            self.url_base = current_app.config.get('SAP_SL_URL', 'https://192.168.1.156:50000/b1s/v2/')

        if id is not None:
            formatted_id = f"'{id}'" if isinstance(id, str) else id
            url = f"{self.url_base.rstrip('/')}/{resource}({formatted_id})"
            if expand:
                expand_str = ",".join(expand) if isinstance(expand, list) else expand
                url += f"?$expand={expand_str}"
            res = self._execute_request('GET', url, master_session=master_session)
            if res.status_code != 200:
                err_val = 'Unknown Error'
                try:
                    err_val = res.json().get('error', {}).get('message', {}).get('value', 'Unknown Error')
                except Exception:
                    pass
                return {"status": "error", "message": err_val}
            return {"status": "ok", "data": [res.json()]}

        url = f"{self.url_base.rstrip('/')}/{resource}"
        query_params = []

        if selection:
            query_params.append(f"$select={','.join(selection)}")
        if filter:
            filter_str = self._build_filter_str(filter)
            if filter_str:
                query_params.append(f"$filter={filter_str}")
        if orderby:
            direction = f" {order_direction}" if order_direction else ""
            query_params.append(f"$orderby={orderby}{direction}")
        if page and per_page:
            skip = (page - 1) * per_page
            query_params.append(f"$top={per_page}")
            query_params.append(f"$skip={skip}")
        if expand:
            query_params.append(f"$expand={','.join(expand)}")

        query_params.append("$inlinecount=allpages")

        if query_params:
            url += f"?{'&'.join(query_params)}"

        return self._execute_get_data(url, all_results=all_results, master_session=master_session)

    def get_data_from_view(self, view_name, filter=None, selection=None, orderby=None, order_direction=None, page=None, per_page=None, all_results=False):
        if not self.url_base:
            self.url_base = current_app.config.get('SAP_SL_URL', 'https://192.168.1.156:50000/b1s/v2/')

        url = f"{self.url_base.rstrip('/')}/view.svc/{view_name}"
        query_params = []

        if selection:
            query_params.append(f"$select={','.join(selection)}")
        if filter:
            filter_str = self._build_filter_str(filter)
            if filter_str:
                query_params.append(f"$filter={filter_str}")
        if orderby:
            direction = f" {order_direction}" if order_direction else ""
            query_params.append(f"$orderby={orderby}{direction}")
        if page and per_page:
            skip = (page - 1) * per_page
            query_params.append(f"$top={per_page}")
            query_params.append(f"$skip={skip}")

        query_params.append("$inlinecount=allpages")

        if query_params:
            url += f"?{'&'.join(query_params)}"

        return self._execute_get_data(url, all_results=all_results, is_view=True)

    def _build_filter_str(self, filter_dict):
        clauses = []
        for key, val in filter_dict.items():
            if val is None or val == '':
                continue
            if key.endswith('__contains'):
                field = key[:-10]
                clauses.append(f"contains({field}, '{val}')")
            elif key.endswith('__in'):
                field = key[:-4]
                if isinstance(val, list) and val:
                    or_items = []
                    for x in val:
                        v_val = x if isinstance(x, (int, float)) else f"'{x}'"
                        or_items.append(f"{field} eq {v_val}")
                    clauses.append(f"({' or '.join(or_items)})")
            elif key.endswith('__between'):
                field = key[:-9]
                if isinstance(val, list) and len(val) == 2:
                    clauses.append(f"{field} ge '{val[0]}' and {field} le '{val[1]}'")
            else:
                formatted_val = val if isinstance(val, (int, float)) else f"'{val}'"
                clauses.append(f"{key} eq {formatted_val}")
        return " and ".join(clauses)