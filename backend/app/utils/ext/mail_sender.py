import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class MailSender:
    def __init__(self,):
        pass

    def init_app(self, app):
        self.smtp_server = app.config.get("SMTP_SERVER")
        self.smtp_port = app.config.get("SMTP_PORT")
        self.sender_email = app.config.get("SENDER_EMAIL")
        
    def send_smtp_email(self, subject, body, to_recipients):
        # Configuración del servidor genérico de la empresa
        smtp_server = self.smtp_server  # O la IP del servidor
        smtp_port = self.smtp_port
        sender_email = self.sender_email # El correo genérico
        
        # Crear el mensaje
        message = MIMEMultipart()
        message["From"] = sender_email
        message["To"] = ", ".join(to_recipients)
        message["Subject"] = subject

        # Añadir el cuerpo en texto plano
        message.attach(MIMEText(body, "plain"))

        try:
            # Conexión al servidor
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.send_message(message)
                
            return {"success": True, "message": "Se ha enviado correctamente"}
        except Exception as e:
            return {"success": False, "message": f"SMTP_ERROR: No se pudo enviar el correo. Detalle: {e}"}            
        