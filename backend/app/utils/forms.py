from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, SelectField
from wtforms.validators import DataRequired

class LoginForm(FlaskForm):
    username = StringField('Usuario', validators=[DataRequired()])
    password = PasswordField('Contraseña', validators=[DataRequired()])
    company_db = SelectField('Base de datos', choices=[
        ('NouColors_D', 'NouColors_D'),
        ('NouColors_D_TEST', 'NouColors_D_TEST'),
        ('KLEANTEK_PROD', 'KLEANTEK_PROD')
    ], default='NouColors_D')
    submit = SubmitField('Login')