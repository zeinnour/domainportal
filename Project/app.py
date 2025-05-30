from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session, Blueprint
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, SelectField, FloatField, DateField, TextAreaField
from wtforms.validators import DataRequired, Length, Email, EqualTo, ValidationError, Optional, NumberRange
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import or_
import os
from dotenv import load_dotenv
import datetime
from datetime import timezone, timedelta
import re
from flask_mail import Mail, Message
import traceback
import jinja2
from namecheapapi import DomainAPI
# Load environment variables from .env file
load_dotenv()

# ---- App Initialization and Configuration ----
app = Flask(__name__)

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a_very_secret_key_that_should_be_set_in_env_CHANGE_ME')
basedir = os.path.abspath(os.path.dirname(__file__))
DATABASE_FILE_PATH = os.path.join(basedir, 'domain_portal.db')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + DATABASE_FILE_PATH
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SAMESITE'] = "Lax"
app.config['SESSION_COOKIE_SECURE'] = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
app.config['REMEMBER_COOKIE_SECURE'] = os.getenv('REMEMBER_COOKIE_SECURE', 'False').lower() == 'true'

app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'False').lower() == 'true'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = (
    os.getenv('MAIL_DEFAULT_SENDER_NAME', 'DomainHub Notifications'),
    os.getenv('MAIL_DEFAULT_SENDER_EMAIL', 'noreply@example.com')
)
app.config['MAIL_DEBUG'] = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'

ADMIN_EMAIL_RECIPIENTS_STR = os.getenv('ADMIN_EMAIL_RECIPIENTS', 'admin@example.com')
ADMIN_EMAIL_RECIPIENTS = [email.strip() for email in ADMIN_EMAIL_RECIPIENTS_STR.split(',') if email.strip()]

# Namecheap API Configuration from .env
NAMECHEAP_API_USER = os.getenv('NAMECHEAP_API_USER')
NAMECHEAP_API_KEY = os.getenv('NAMECHEAP_API_KEY')
NAMECHEAP_CLIENT_IP = os.getenv('NAMECHEAP_CLIENT_IP')
NAMECHEAP_SANDBOX = os.getenv('NAMECHEAP_SANDBOX', 'False').lower() == 'true'


# ---- Extension Initializations ----
db = SQLAlchemy(app)
mail = Mail(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login_page'
login_manager.login_message_category = 'info'
login_manager.session_protection = "strong"

# ---- Blueprint Definitions ----
API_PREFIX = '/api'
api_bp = Blueprint('api', __name__, url_prefix=API_PREFIX)
admin_bp = Blueprint('admin_api', __name__, url_prefix=f'{API_PREFIX}/admin')

# ---- Database Models ----
# (Models User, Domain, DomainRequest, TicketReply, SupportTicket, Invoice, Notification)
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='client')
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    domains = db.relationship('Domain', backref='owner', lazy=True)
    ticket_replies = db.relationship('TicketReply', backref='author', lazy='dynamic', foreign_keys='TicketReply.user_id')
    invoices = db.relationship('Invoice', backref='client', lazy='dynamic')
    notifications = db.relationship('Notification', backref='user', lazy='dynamic', foreign_keys='Notification.user_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

    def to_dict(self, include_domain_count=False):
        data = {
            'id': self.id,
            'username': self.username,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active
        }
        if include_domain_count:
            data['domain_count'] = len(self.domains)
        return data

class Domain(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    status = db.Column(db.String(50), nullable=False, default='Pending Registration')
    registration_date = db.Column(db.Date, nullable=True, default=datetime.date.today)
    expiry_date = db.Column(db.Date, nullable=True)
    auto_renew = db.Column(db.Boolean, default=False, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    is_locked = db.Column(db.Boolean, default=True, nullable=False)
    invoices = db.relationship('Invoice', backref='domain_item', lazy='dynamic')


    def __repr__(self):
        return f'<Domain {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'status': self.status,
            'regDate': self.registration_date.isoformat() if self.registration_date else None,
            'expDate': self.expiry_date.isoformat() if self.expiry_date else None,
            'autoRenew': self.auto_renew,
            'is_locked': self.is_locked,
            'userId': self.user_id,
            'ownerName': self.owner.name if self.owner else "N/A (Unassigned)",
            'owner_username': self.owner.username if self.owner else "N/A"
        }

class DomainRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    domain_name = db.Column(db.String(255), nullable=True)
    domain_id = db.Column(db.Integer, db.ForeignKey('domain.id'), nullable=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoice.id'), nullable=True)
    request_type = db.Column(db.String(50), nullable=False)
    requested_data = db.Column(db.JSON, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='Pending Admin Approval')
    request_date = db.Column(db.DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    admin_notes = db.Column(db.Text, nullable=True)
    user = db.relationship('User', backref='domain_requests')
    domain = db.relationship('Domain', backref='requests')
    invoice = db.relationship('Invoice', backref='payment_proof_requests')


    def to_dict(self):
        data_summary = {}
        domain_display_name = self.domain_name or (self.domain.name if self.domain else 'N/A')

        if self.requested_data:
            if self.request_type == 'register':
                data_summary['duration'] = self.requested_data.get('registrationDurationYears')
                data_summary['ssl_requested'] = self.requested_data.get('requestSsl')
                data_summary['ssl_duration'] = self.requested_data.get('sslDurationYears')
            elif self.request_type == 'renew':
                data_summary['duration'] = self.requested_data.get('renewalDurationYears')
                data_summary['ssl_requested'] = self.requested_data.get('requestSsl')
                data_summary['ssl_duration'] = self.requested_data.get('sslDurationYears')
            elif self.request_type == 'transfer_in':
                data_summary['auth_code_provided'] = bool(self.requested_data.get('authCode'))
            elif self.request_type == 'transfer_out':
                data_summary['destination_info'] = self.requested_data.get('destinationInfo')
                data_summary['reason'] = self.requested_data.get('reason')
                data_summary['epp_code_provided'] = bool(self.requested_data.get('epp_code') or self.requested_data.get('epp_code_provided_by_admin'))
            elif self.request_type == 'dns_change':
                data_summary['change_description'] = self.requested_data.get('changeDescription')
                if self.requested_data.get('records_to_add'):
                    data_summary['records_to_add_count'] = len(self.requested_data.get('records_to_add', []))
            elif self.request_type == 'contact_update':
                data_summary['changes_description'] = self.requested_data.get('requested_changes_description')
            elif self.request_type == 'auto_renew_change':
                data_summary['requested_status'] = self.requested_data.get('requestedAutoRenewStatus')
            elif self.request_type == 'lock_change':
                data_summary['requested_lock_status'] = self.requested_data.get('requestedLockStatus')
            elif self.request_type == 'payment_proof':
                data_summary['invoice_number'] = self.invoice.invoice_number if self.invoice else 'N/A'
                data_summary['invoice_amount'] = self.invoice.amount if self.invoice else 'N/A'
                data_summary['payment_notes'] = self.requested_data.get('paymentNotes', 'N/A')
                domain_display_name = f"Invoice {data_summary['invoice_number']}" if data_summary['invoice_number'] != 'N/A' else "a payment"
            elif self.request_type == 'internal_transfer_request':
                data_summary['domain_name'] = domain_display_name
                data_summary['current_owner_username'] = self.user.username
                data_summary['target_client_identifier'] = self.requested_data.get('target_client_identifier')
                target_client_id = self.requested_data.get('target_client_id')
                target_client = db.session.get(User, target_client_id) if target_client_id else None
                data_summary['target_client_name'] = target_client.name if target_client else 'N/A'


        return {
            'id': self.id,
            'userId': self.user_id,
            'requester_username': self.user.username if self.user else None,
            'userName': self.user.name if self.user else None,
            'domainName': domain_display_name,
            'domainId': self.domain_id,
            'invoiceId': self.invoice_id,
            'requestType': self.request_type,
            'requestedData': self.requested_data,
            'dataSummary': data_summary,
            'status': self.status,
            'requestDate': self.request_date.isoformat() if self.request_date else None,
            'admin_notes': self.admin_notes
        }

class TicketReply(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('support_ticket.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'user_id': self.user_id,
            'author_username': self.author.username if self.author else 'System',
            'author_role': self.author.role if self.author else 'system',
            'message': self.message,
            'timestamp': self.timestamp.isoformat()
        }

class SupportTicket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    related_domain_id = db.Column(db.Integer, db.ForeignKey('domain.id'), nullable=True)
    status = db.Column(db.String(50), nullable=False, default='Open')
    request_date = db.Column(db.DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    last_updated = db.Column(db.DateTime, default=lambda: datetime.datetime.now(timezone.utc), onupdate=lambda: datetime.datetime.now(timezone.utc))
    priority = db.Column(db.String(50), default='Normal')
    admin_notes = db.Column(db.Text, nullable=True)

    user = db.relationship('User', backref='support_tickets')
    related_domain = db.relationship('Domain', backref='support_tickets')
    replies = db.relationship('TicketReply', backref='ticket', lazy='dynamic', order_by="TicketReply.timestamp", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'requester_username': self.user.username if self.user else None,
            'userName': self.user.name if self.user else None,
            'subject': self.subject,
            'message': self.message,
            'relatedDomainId': self.related_domain_id,
            'relatedDomainName': self.related_domain.name if self.related_domain else None,
            'status': self.status,
            'priority': self.priority,
            'admin_notes': self.admin_notes,
            'requestDate': self.request_date.isoformat() if self.request_date else None,
            'lastUpdated': self.last_updated.isoformat() if self.last_updated else None,
            'requestType': 'support-ticket', # Consistent with DomainRequest for overview cards
            'replies': [reply.to_dict() for reply in self.replies.all()]
        }

class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    domain_id = db.Column(db.Integer, db.ForeignKey('domain.id'), nullable=True)
    description = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    issue_date = db.Column(db.Date, nullable=False, default=datetime.date.today)
    due_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='Pending Payment')
    payment_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'user_id': self.user_id,
            'client_name': self.client.name if self.client else 'N/A',
            'client_username': self.client.username if self.client else 'N/A',
            'domain_id': self.domain_id,
            'domain_name': self.domain_item.name if self.domain_item else 'N/A',
            'description': self.description,
            'amount': self.amount,
            'issue_date': self.issue_date.isoformat() if self.issue_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'notes': self.notes
        }

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    link = db.Column(db.String(255), nullable=True)
    notification_type = db.Column(db.String(50), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'message': self.message,
            'is_read': self.is_read,
            'timestamp': self.timestamp.isoformat(),
            'link': self.link,
            'notification_type': self.notification_type
        }

# ---- Forms ----
class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=80)])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

class ProfileUpdateForm(FlaskForm):
    name = StringField('Full Name', validators=[DataRequired(), Length(max=100)])
    email = StringField('Email', validators=[DataRequired(), Email(), Length(max=120)])
    submit = SubmitField('Save Changes')

class CreateClientForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=3, max=80)])
    name = StringField('Full Name', validators=[DataRequired(), Length(max=100)])
    email = StringField('Email', validators=[DataRequired(), Email(), Length(max=120)])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=8, message="Password must be at least 8 characters long.")])
    confirm_password = PasswordField('Confirm Password', validators=[DataRequired(), EqualTo('password', message='Passwords must match.')])
    submit = SubmitField('Create Client')

    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('That username is already taken. Please choose a different one.')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user:
            raise ValidationError('That email address is already registered. Please choose a different one.')

class EditClientForm(FlaskForm):
    name = StringField('Full Name', validators=[DataRequired(), Length(max=100)])
    email = StringField('Email', validators=[DataRequired(), Email(), Length(max=120)])
    password = PasswordField('New Password', validators=[Optional(), Length(min=8, message="Password must be at least 8 characters.")])
    confirm_password = PasswordField('Confirm New Password', validators=[EqualTo('password', message='Passwords must match if new password is set.')])

    def __init__(self, original_email, client_id_being_edited, *args, **kwargs):
        super(EditClientForm, self).__init__(*args, **kwargs)
        self.original_email = original_email
        self.client_id_being_edited = client_id_being_edited


    def validate_email(self, email):
        if email.data != self.original_email:
            user = User.query.filter(User.email == email.data, User.id != self.client_id_being_edited).first()
            if user:
                raise ValidationError('That email address is already registered by another user.')

class CreateInvoiceForm(FlaskForm):
    user_id = SelectField('Client', coerce=int, validators=[DataRequired(message="Client selection is required.")])
    domain_id = SelectField('Related Domain (Optional)', coerce=int, validators=[Optional()])
    description = StringField('Description', validators=[DataRequired(), Length(max=255)])
    amount = FloatField('Amount', validators=[DataRequired(), NumberRange(min=0.01)])
    issue_date = DateField('Issue Date', format='%Y-%m-%d', validators=[DataRequired()], default=datetime.date.today)
    due_date = DateField('Due Date', format='%Y-%m-%d', validators=[DataRequired()])
    status = SelectField('Status', choices=[
        ('Pending Payment', 'Pending Payment'),
        ('Paid', 'Paid'),
        ('Overdue', 'Overdue'),
        ('Cancelled', 'Cancelled')
    ], validators=[DataRequired()], default='Pending Payment')
    notes = TextAreaField('Notes (Optional)')
    submit = SubmitField('Create Invoice')

    def __init__(self, *args, **kwargs):
        super(CreateInvoiceForm, self).__init__(*args, **kwargs)
        self.user_id.choices = []
        self.domain_id.choices = []


    def validate_user_id(self, field):
        if field.data == 0: # Assuming 0 is the placeholder value like "-- Select Client --"
            raise ValidationError("Please select a valid client.")
        elif field.data is None and self.user_id.flags.required: # Should not happen if coerce=int and DataRequired
            raise ValidationError("Client selection is required.")


# ---- User Loader for Flask-Login ----
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# ---- Custom Unauthorized Handler for Flask-Login ----
@login_manager.unauthorized_handler
def unauthorized():
    # Check if the request is an XHR (AJAX) request or prefers JSON response
    if request.blueprint == 'api' or request.blueprint == 'admin_api' or \
       (request.accept_mimetypes.accept_json and \
        not request.accept_mimetypes.accept_html) or \
       request.path.startswith(API_PREFIX +'/'): # Catch all /api/ paths
        app.logger.warning(f"Unauthorized API access attempt to {request.path}")
        return jsonify(error="Unauthorized", message="Authentication required."), 401
    # Otherwise, redirect to the login page as default
    return redirect(url_for('login_page'))


# ---- Helper function to create Notifications ----
def create_notification(user_id, message, link=None, notification_type=None):
    if user_id:
        notification = Notification(
            user_id=user_id,
            message=message,
            link=link,
            notification_type=notification_type
        )
        db.session.add(notification)

# ---- Email Sending Function ----
def send_system_email(recipients, subject, template_name, **kwargs):
    if not recipients:
        app.logger.error(f"Attempted to send email with no recipient for subject '{subject}'")
        return False
    if isinstance(recipients, str): recipients = [recipients]
    kwargs.setdefault('portal_url', url_for('home_page', _external=True))
    kwargs.setdefault('current_year', datetime.datetime.now(timezone.utc).year)
    kwargs.setdefault('subject', subject)
    
    full_template_name = f"email/{template_name}.html"

    try:
        msg = Message(subject, recipients=recipients, html=render_template(full_template_name, **kwargs))
        mail.send(msg)
        app.logger.info(f"Email sent to {', '.join(recipients)} with subject '{subject}' using template {full_template_name}")
        return True
    except jinja2.exceptions.TemplateNotFound:
        app.logger.error(f"Jinja2 TemplateNotFound: Could not find email template '{full_template_name}' for subject '{subject}'")
        return False
    except Exception as e:
        app.logger.error(f"Error sending email to {', '.join(recipients)} for subject '{subject}' using template '{full_template_name}': {str(e)}")
        app.logger.exception("Full traceback for email sending error:")
        return False

# ---- Helper function for client request notifications ----
def notify_client_of_request_submission(client_user, request_type_display, item_description, details_html_str, request_obj):
    if client_user and client_user.email:
        send_system_email(
            recipients=[client_user.email],
            subject=f"{request_type_display} Request Received: {item_description}",
            template_name="new_request_submitted_client_email",
            client_name=client_user.name,
            request_type=request_type_display,
            item_description=item_description,
            details_html=details_html_str
        )
    if request_obj.id: # Ensure request_obj has an ID after commit
        create_notification(
            user_id=client_user.id,
            message=f"Your {request_type_display.lower()} request for '{item_description}' has been submitted.",
            link=f"#request-{request_obj.id}", # This link might need adjustment based on how client UI handles it
            notification_type=f"{request_obj.request_type}_submitted"
        )

# ---- HTML Routes ----
@app.route('/')
def home_page():
    if current_user.is_authenticated:
        if current_user.role == 'admin': return render_template('admin_panel.html')
        else: return render_template('client_panel.html')
    return redirect(url_for('login_page'))

@app.route('/login', methods=['GET', 'POST'])
def login_page():
    if current_user.is_authenticated: return redirect(url_for('home_page'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and user.check_password(form.password.data):
            if not user.is_active and user.role == 'client':
                flash('Your account has been deactivated. Please contact support.', 'danger')
                return redirect(url_for('login_page'))
            login_user(user, remember=True)
            app.logger.info(f"User {user.username} logged in successfully.")
            return redirect(url_for('home_page'))
        else:
            flash('Login Unsuccessful. Please check username and password.', 'danger')
            app.logger.warning(f"Failed login attempt for username: {form.username.data}")
    return render_template('login.html', title='Login', form=form)

@app.route('/logout')
@login_required
def logout():
    app.logger.info(f"User {current_user.username} logging out.")
    logout_user()
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login_page'))

@app.route('/dashboard/admin')
@login_required
def admin_dashboard_page():
    if current_user.role != 'admin':
        flash('Access denied. You are not an admin.', 'danger')
        return redirect(url_for('home_page'))
    return render_template('admin_panel.html')

# ---- General API Routes (api_bp) ----
@api_bp.route('/auth/status')
@login_required 
def auth_status():
    return jsonify({'logged_in': True, 'user': current_user.to_dict() if current_user else None})

@api_bp.route('/auth/logout', methods=['POST'])
@login_required 
def api_logout_route():
    logout_user()
    session.clear()
    return jsonify({'message': 'Logout successful'}), 200

@api_bp.route('/notifications', methods=['GET'])
@login_required
def get_user_notifications():
    notifications = Notification.query.filter_by(user_id=current_user.id)\
                                     .order_by(Notification.timestamp.desc())\
                                     .limit(20).all()
    unread_count = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({'notifications': [n.to_dict() for n in notifications], 'unread_count': unread_count})

@api_bp.route('/notifications/mark-read', methods=['POST'])
@login_required
def mark_notifications_read():
    data = request.get_json()
    notification_ids = data.get('ids', [])
    if not notification_ids: 
        notifications_to_update = Notification.query.filter_by(user_id=current_user.id, is_read=False).all()
    elif notification_ids == 'all':
        notifications_to_update = Notification.query.filter_by(user_id=current_user.id, is_read=False).all()
    else:
        if not isinstance(notification_ids, list):
            return jsonify({'error': 'IDs must be a list or "all".'}), 400
        notifications_to_update = Notification.query.filter(Notification.id.in_(notification_ids), Notification.user_id == current_user.id).all()
    
    for notification in notifications_to_update:
        notification.is_read = True
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error committing notification read status: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update notification status.'}), 500
        
    unread_count = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({'message': 'Notifications marked as read.', 'unread_count': unread_count}), 200

# Client API Routes (prefixed with API_PREFIX)
@app.route(f'{API_PREFIX}/domains')
@login_required
def get_client_domains():
    if current_user.role == 'client':
        domains = Domain.query.filter_by(user_id=current_user.id).all()
        return jsonify([domain.to_dict() for domain in domains])
    return jsonify({'error': 'Unauthorized'}), 403

@app.route(f'{API_PREFIX}/client/pending-request-counts')
@login_required
def get_pending_request_counts():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    counts = {
        'registrations': DomainRequest.query.filter_by(user_id=current_user.id, request_type='register', status='Pending Admin Approval').count(),
        'renewals': DomainRequest.query.filter_by(user_id=current_user.id, request_type='renew', status='Pending Admin Approval').count(),
        'auto_renew_changes': DomainRequest.query.filter_by(user_id=current_user.id, request_type='auto_renew_change', status='Pending Admin Approval').count(),
        'lock_changes': DomainRequest.query.filter_by(user_id=current_user.id, request_type='lock_change', status='Pending Admin Approval').count(),
        'open_support_tickets': SupportTicket.query.filter(SupportTicket.user_id == current_user.id, SupportTicket.status.in_(['Open', 'In Progress'])).count(),
        'pending_transfers_in': DomainRequest.query.filter_by(user_id=current_user.id, request_type='transfer_in', status='Pending Admin Approval').count(),
        'pending_transfers_out': DomainRequest.query.filter_by(user_id=current_user.id, request_type='transfer_out', status='Pending Admin Approval').count(),
        'pending_dns_changes': DomainRequest.query.filter_by(user_id=current_user.id, request_type='dns_change', status='Pending Admin Approval').count(),
        'pending_contact_updates': DomainRequest.query.filter_by(user_id=current_user.id, request_type='contact_update', status='Pending Admin Approval').count(),
        'pending_payment_proofs': DomainRequest.query.filter_by(user_id=current_user.id, request_type='payment_proof', status='Pending Admin Approval').count(),
        'pending_internal_transfers': DomainRequest.query.filter_by(user_id=current_user.id, request_type='internal_transfer_request', status='Pending Admin Approval').count(),
    }
    return jsonify(counts)

@app.route(f'{API_PREFIX}/client/pending-lock-requests')
@login_required
def get_client_pending_lock_requests():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    reqs = DomainRequest.query.filter_by(user_id=current_user.id,request_type='lock_change',status='Pending Admin Approval').all()
    return jsonify([req.to_dict() for req in reqs])

@app.route(f'{API_PREFIX}/client/pending-dns-requests')
@login_required
def get_client_pending_dns_requests():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    reqs = DomainRequest.query.filter_by(user_id=current_user.id,request_type='dns_change',status='Pending Admin Approval').all()
    return jsonify([req.to_dict() for req in reqs])

@app.route(f'{API_PREFIX}/client/recent-activity')
@login_required
def get_client_recent_activity():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    notifications = Notification.query.filter_by(user_id=current_user.id)\
                                     .order_by(Notification.timestamp.desc())\
                                     .limit(7).all()
    activities = [{
        'type': n.notification_type or 'General Update',
        'description': n.message,
        'date': n.timestamp.isoformat(),
        'item_id': n.id,
        'item_type': n.notification_type
    } for n in notifications]
    return jsonify(activities)


@app.route(f'{API_PREFIX}/invoices', methods=['GET'])
@login_required
def get_client_invoices():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    invoices = Invoice.query.filter_by(user_id=current_user.id).order_by(Invoice.issue_date.desc()).all()
    return jsonify([inv.to_dict() for inv in invoices])

@app.route(f'{API_PREFIX}/invoices/<int:invoice_id>/mark-paid', methods=['POST'])
@login_required
def mark_invoice_as_paid_request(invoice_id):
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user.id).first_or_404()
    if invoice.status != 'Pending Payment': return jsonify({'error': f'Invoice status: {invoice.status}'}), 400
    existing_req = DomainRequest.query.filter_by(user_id=current_user.id, invoice_id=invoice.id, request_type='payment_proof', status='Pending Admin Approval').first()
    if existing_req: return jsonify({'error': 'Payment proof already pending.'}), 409
    data = request.get_json()
    payment_notes = data.get('paymentNotes', '')
    new_req = DomainRequest(user_id=current_user.id, invoice_id=invoice.id, request_type='payment_proof', requested_data={'paymentNotes': payment_notes, 'invoice_number': invoice.invoice_number, 'amount': invoice.amount}, status='Pending Admin Approval')
    _handle_new_client_request("Payment Proof Submission", f"Invoice {invoice.invoice_number}", f"<p>Notes: {payment_notes}</p>", new_req)
    return jsonify({'message': 'Payment proof submitted.', 'request': new_req.to_dict()}), 201

def _handle_new_client_request(request_type_str, item_desc, details_html_str, domain_request_obj):
    db.session.add(domain_request_obj)
    db.session.commit() # Commit to get ID for notification link
    notify_client_of_request_submission(
        current_user,
        request_type_str,
        item_desc,
        details_html_str,
        domain_request_obj
    )
    db.session.commit() # Commit notification

@app.route(f'{API_PREFIX}/domain-requests/register', methods=['POST'])
@login_required
def request_domain_registration():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    if not data or not data.get('requestedDomainName') or not data.get('requestedTld') or not data.get('registrationDurationYears'):
        return jsonify({'error': 'Missing required fields'}), 400
    full_domain_name = data['requestedDomainName'].strip().lower() + data['requestedTld'].strip().lower()
    if Domain.query.filter_by(name=full_domain_name).first() or \
       DomainRequest.query.filter_by(domain_name=full_domain_name, status='Pending Admin Approval').first():
        return jsonify({'error': f"Domain '{full_domain_name}' unavailable or request pending."}), 409
    
    new_request = DomainRequest(user_id=current_user.id, domain_name=full_domain_name, request_type='register', requested_data=data)
    details_html = f"<p>Duration: {data.get('registrationDurationYears')} year(s)</p>" + \
                   (f"<p>SSL Requested: Yes ({data.get('sslDurationYears')} year(s))</p>" if data.get('requestSsl') else "<p>SSL Requested: No</p>")
    _handle_new_client_request("Domain Registration", full_domain_name, details_html, new_request)
    return jsonify({'message': 'Request submitted!', 'request': new_request.to_dict()}), 201

@app.route(f'{API_PREFIX}/domain-requests/renew/<int:domain_id>', methods=['POST'])
@login_required
def request_domain_renewal(domain_id):
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    domain = Domain.query.filter_by(id=domain_id, user_id=current_user.id).first_or_404()
    data = request.get_json()
    if not data or not data.get('renewalDurationYears'): return jsonify({'error': 'Missing duration'}), 400
    
    new_request = DomainRequest(user_id=current_user.id, domain_id=domain.id, domain_name=domain.name, request_type='renew', requested_data=data)
    details_html = f"<p>Duration: {data.get('renewalDurationYears')} year(s)</p>" + \
                   (f"<p>SSL Requested: Yes ({data.get('sslDurationYears')} year(s))</p>" if data.get('requestSsl') else "<p>SSL Requested: No</p>")
    _handle_new_client_request("Domain Renewal", domain.name, details_html, new_request)
    return jsonify({'message': f'Renewal request for {domain.name} submitted!', 'request': new_request.to_dict()}), 201

@app.route(f'{API_PREFIX}/domain-requests/auto-renew-change/<int:domain_id>', methods=['POST'])
@login_required
def request_auto_renew_change(domain_id):
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    domain = Domain.query.filter_by(id=domain_id, user_id=current_user.id).first_or_404()
    data = request.get_json()
    if data is None or 'requestedAutoRenewStatus' not in data: return jsonify({'error': 'Missing status'}), 400
    requested_status = data.get('requestedAutoRenewStatus')
    if not isinstance(requested_status, bool): return jsonify({'error': 'Status must be boolean'}), 400
    
    new_request = DomainRequest(user_id=current_user.id, domain_id=domain.id, domain_name=domain.name, request_type='auto_renew_change', requested_data=data)
    details_html = f"<p>Requested to: {'Enable' if requested_status else 'Disable'} Auto-Renew</p>"
    _handle_new_client_request("Auto-Renew Change", domain.name, details_html, new_request)
    return jsonify({'message': 'Request submitted!', 'request': new_request.to_dict()}), 201

@app.route(f'{API_PREFIX}/domain-requests/lock-change/<int:domain_id>', methods=['POST'])
@login_required
def request_domain_lock_change(domain_id):
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    domain = Domain.query.filter_by(id=domain_id, user_id=current_user.id).first_or_404()
    data = request.get_json()
    if data is None or 'requestedLockStatus' not in data: return jsonify({'error': 'Missing status'}), 400
    requested_status = data.get('requestedLockStatus')
    if not isinstance(requested_status, bool): return jsonify({'error': 'Status must be boolean'}), 400
    if domain.is_locked == requested_status: return jsonify({'error': f'Domain already {("locked" if requested_status else "unlocked")}.'}), 409

    new_request = DomainRequest(user_id=current_user.id, domain_id=domain.id, domain_name=domain.name, request_type='lock_change', requested_data=data)
    action_str = "Lock" if requested_status else "Unlock"
    details_html = f"<p>Requested Action: {action_str} Domain</p>"
    _handle_new_client_request(f"Domain {action_str} Request", domain.name, details_html, new_request)
    return jsonify({'message': f'Request to {action_str.lower()} submitted!', 'request': new_request.to_dict()}), 201

@app.route(f'{API_PREFIX}/domain-requests/transfer', methods=['POST']) # Transfer-In
@login_required
def request_domain_transfer_in():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    if not data or not data.get('domainNameToTransfer'): return jsonify({'error': 'Domain name required.'}), 400
    new_request = DomainRequest(user_id=current_user.id, domain_name=data['domainNameToTransfer'], request_type='transfer_in', requested_data=data)
    details_html = f"<p>Auth Code Provided: {'Yes' if data.get('authCode') else 'No'}</p>"
    _handle_new_client_request("Domain Transfer-In", data['domainNameToTransfer'], details_html, new_request)
    return jsonify({'message': 'Request submitted.', 'request': new_request.to_dict()}), 201

@app.route(f'{API_PREFIX}/domain-requests/transfer-out', methods=['POST'])
@login_required
def request_domain_transfer_out():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    domain_id = data.get('domainId')
    if not domain_id: return jsonify({'error': 'Domain ID required.'}), 400
    domain = Domain.query.filter_by(id=domain_id, user_id=current_user.id).first_or_404()
    new_request = DomainRequest(user_id=current_user.id, domain_id=domain.id, domain_name=domain.name, request_type='transfer_out', requested_data=data)
    details_html = f"<p>Destination: {data.get('destinationInfo', 'N/A')}</p><p>Reason: {data.get('reason', 'N/A')}</p>"
    _handle_new_client_request("Domain Transfer-Out", domain.name, details_html, new_request)
    return jsonify({'message': 'Request submitted.', 'request': new_request.to_dict()}), 201

@app.route(f'{API_PREFIX}/domain-requests/internal-transfer', methods=['POST'])
@login_required
def request_internal_domain_transfer():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    domain_id = data.get('domainId')
    target_id = data.get('targetClientIdentifier')
    if not domain_id or not target_id: return jsonify({'error': 'Domain and target client required.'}), 400
    domain = Domain.query.filter_by(id=domain_id, user_id=current_user.id).first_or_404()
    target_client = User.query.filter(or_(User.username == target_id, User.email == target_id), User.role == 'client', User.is_active == True).first()
    if not target_client: return jsonify({'error': 'Target client not found or inactive.'}), 404
    if target_client.id == current_user.id: return jsonify({'error': 'Cannot transfer to yourself.'}), 400
    if DomainRequest.query.filter_by(domain_id=domain.id, request_type='internal_transfer_request', status='Pending Admin Approval').first():
        return jsonify({'error': 'Request already pending.'}), 409
    
    req_data = data.copy()
    req_data.update({
        'original_owner_id': current_user.id, 'original_owner_username': current_user.username,
        'target_client_id': target_client.id, 'target_client_name': target_client.name
    })
    new_request = DomainRequest(user_id=current_user.id, domain_id=domain.id, domain_name=domain.name, request_type='internal_transfer_request', requested_data=req_data)
    details_html = f"<p>Requested transfer to client: {target_id}</p>"
    _handle_new_client_request("Internal Domain Transfer", domain.name, details_html, new_request)
    return jsonify({'message': 'Request submitted.', 'request': new_request.to_dict()}), 201

@app.route(f'{API_PREFIX}/domain-requests/dns-change', methods=['POST'])
@login_required
def request_dns_change():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    domain_id = data.get('domainId')
    desc = data.get('changeDescription')
    records = data.get('recordsToAdd')
    if not domain_id or not (desc or (records and isinstance(records, list) and records)):
        return jsonify({'error': 'Domain ID and description or records required.'}), 400
    domain = Domain.query.filter_by(id=domain_id, user_id=current_user.id).first_or_404()
    if DomainRequest.query.filter_by(domain_id=domain_id, request_type='dns_change', status='Pending Admin Approval').first():
        return jsonify({'error': 'Request already pending.'}), 409
    
    payload = {}
    if desc and desc.strip(): payload['changeDescription'] = desc.strip()
    if records and isinstance(records, list) and records:
        valid_records = [r for r in records if r.get('type') and r.get('host') and r.get('value')]
        if valid_records: payload['records_to_add'] = valid_records
        elif not payload.get('changeDescription'): return jsonify({'error': 'No valid records or description.'}), 400
    
    new_request = DomainRequest(user_id=current_user.id, domain_id=domain.id, domain_name=domain.name, request_type='dns_change', requested_data=payload)
    details_html = ""
    if payload.get('changeDescription'): details_html += f"<p>Description: {payload['changeDescription']}</p>"
    if payload.get('records_to_add'):
        details_html += "<p>Records:</p><ul>" + "".join([f"<li>{r['type']} {r['host']} -> {r['value']}</li>" for r in payload['records_to_add']]) + "</ul>"
    _handle_new_client_request("DNS Change", domain.name, details_html if details_html else "DNS update requested.", new_request)
    return jsonify({'message': 'Request submitted.', 'request': new_request.to_dict()}), 201

@app.route(f'{API_PREFIX}/domain-requests/contact-update', methods=['POST'])
@login_required
def request_contact_update():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    domain_id = data.get('domainId')
    desc = data.get('requestedChangesDescription')
    if not domain_id or not desc: return jsonify({'error': 'Domain ID and description required.'}), 400
    domain = Domain.query.filter_by(id=domain_id, user_id=current_user.id).first_or_404()
    
    new_request = DomainRequest(user_id=current_user.id, domain_id=domain.id, domain_name=domain.name, request_type='contact_update', requested_data={'requested_changes_description': desc})
    _handle_new_client_request("Contact Info Update", domain.name, f"<p>Changes: {desc}</p>", new_request)
    return jsonify({'message': 'Request submitted.', 'request': new_request.to_dict()}), 201

@app.route(f'{API_PREFIX}/domain-requests/bulk-renew', methods=['POST'])
@login_required
def request_bulk_renew():
    if current_user.role != 'client': return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    domain_ids = data.get('domain_ids')
    duration = data.get('renewal_duration_years', 1)
    if not domain_ids or not isinstance(domain_ids, list): return jsonify({'error': 'domain_ids list required'}), 400
    
    results, submitted_details = {'success': [], 'errors': []}, []
    temp_requests_to_notify = []

    for d_id in domain_ids:
        domain = Domain.query.filter_by(id=d_id, user_id=current_user.id).first()
        if domain:
            req_data = {'renewalDurationYears': duration}
            new_req = DomainRequest(user_id=current_user.id, domain_id=domain.id, domain_name=domain.name, request_type='renew', requested_data=req_data)
            db.session.add(new_req)
            temp_requests_to_notify.append(new_req)
            results['success'].append({'domain_id': d_id, 'domain_name': domain.name, 'message': 'Request added to batch.'})
            submitted_details.append(f"<li>{domain.name} ({duration} year(s))</li>")
        else:
            results['errors'].append({'domain_id': d_id, 'error': 'Not found or not owned.'})
    
    if temp_requests_to_notify:
        db.session.commit() # Commit requests to get IDs
        for req_obj in temp_requests_to_notify:
            create_notification(current_user.id, f"Renewal request for '{req_obj.domain_name}' submitted.", link=f"#request-{req_obj.id}", notification_type='renew_submitted')
        
        send_system_email([current_user.email], "Bulk Domain Renewal Request Submitted", "new_request_submitted_client_email", client_name=current_user.name, request_type="Bulk Renewal", item_description=f"{len(submitted_details)} domain(s)", details_html=f"<ul>{''.join(submitted_details)}</ul>")
        db.session.commit() # Commit notifications

    status_code = 207 if results['errors'] else 201
    msg = "Bulk renewal processed." if status_code == 207 else "Requests submitted."
    return jsonify({'message': msg, 'results': results}), status_code

@app.route(f'{API_PREFIX}/user/profile', methods=['PUT'])
@login_required
def update_user_profile():
    data = request.get_json()
    if not data: return jsonify({'error': 'No data'}), 400
    name, email = data.get('name'), data.get('email')
    if not name or not name.strip(): return jsonify({'error': 'Name empty'}), 400
    email_val = email.strip() if email else None
    if not email_val or not re.fullmatch(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email_val):
        return jsonify({'error': 'Invalid email'}), 400
    if User.query.filter(User.email == email_val, User.id != current_user.id).first():
        return jsonify({'error': 'Email in use'}), 409
    current_user.name, current_user.email = name.strip(), email_val
    db.session.commit()
    return jsonify({'message': 'Profile updated!', 'user': current_user.to_dict()}), 200

# ---- Client Support Ticket Routes ----
@api_bp.route('/support-tickets', methods=['GET'])
@login_required
def get_client_tickets():
    if current_user.role != 'client':
        return jsonify({'error': 'Unauthorized'}), 403
    tickets = SupportTicket.query.filter_by(user_id=current_user.id)\
                                 .order_by(SupportTicket.last_updated.desc()).all()
    return jsonify([ticket.to_dict() for ticket in tickets])

@api_bp.route('/support-tickets', methods=['POST'])
@login_required
def create_client_ticket():
    if current_user.role != 'client':
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    subject = data.get('subject')
    message_text = data.get('message')
    related_domain_id = data.get('related_domain_id')

    if not subject or not subject.strip() or not message_text or not message_text.strip():
        return jsonify({'error': 'Subject and message are required.'}), 400

    if related_domain_id:
        domain = Domain.query.filter_by(id=related_domain_id, user_id=current_user.id).first()
        if not domain:
            return jsonify({'error': 'Related domain not found or not owned by you.'}), 404
    
    new_ticket = SupportTicket(
        user_id=current_user.id,
        subject=subject.strip(),
        message=message_text.strip(),
        related_domain_id=related_domain_id if related_domain_id else None,
        status='Open'
    )
    db.session.add(new_ticket)
    db.session.commit() # Commit to get ID

    # Notify client
    create_notification(
        current_user.id, 
        f"Your support ticket #{new_ticket.id} ('{new_ticket.subject}') has been created.",
        link=f"#ticket-{new_ticket.id}", # Link for client panel
        notification_type="new_ticket_client"
    )
    # Notify admin
    if ADMIN_EMAIL_RECIPIENTS:
        send_system_email(
            ADMIN_EMAIL_RECIPIENTS,
            f"New Support Ticket #{new_ticket.id} from {current_user.username}",
            "new_ticket_admin_email",
            ticket_id=new_ticket.id,
            client_name=current_user.name,
            client_username=current_user.username,
            ticket_subject=new_ticket.subject,
            ticket_message=new_ticket.message,
            related_domain_name=new_ticket.related_domain.name if new_ticket.related_domain else None
        )
    # Create notification for admin users (if you have a system for this)
    admin_users = User.query.filter_by(role='admin', is_active=True).all()
    for admin in admin_users:
        create_notification(
            admin.id,
            f"New ticket #{new_ticket.id} ('{new_ticket.subject}') from {current_user.username}.",
            link=f"#support-tickets-admin", # Link for admin panel
            notification_type="new_ticket_admin"
        )
    db.session.commit()
    return jsonify({'message': 'Support ticket created successfully.', 'ticket': new_ticket.to_dict()}), 201

@api_bp.route('/support-tickets/<int:ticket_id>/reply', methods=['POST'])
@login_required
def client_reply_to_ticket(ticket_id):
    ticket = SupportTicket.query.filter_by(id=ticket_id, user_id=current_user.id).first_or_404()
    data = request.get_json()
    message_text = data.get('message')
    if not message_text or not message_text.strip():
        return jsonify({'error': 'Reply message cannot be empty.'}), 400

    reply = TicketReply(ticket_id=ticket.id, user_id=current_user.id, message=message_text.strip())
    db.session.add(reply)
    ticket.last_updated = datetime.datetime.now(timezone.utc)
    if ticket.status == 'Resolved' or ticket.status == 'Closed': # Re-open if client replies to resolved/closed
        ticket.status = 'In Progress'
    
    db.session.commit() # Commit to get reply ID

    # Notify admin of client's reply
    if ADMIN_EMAIL_RECIPIENTS:
        send_system_email(
            ADMIN_EMAIL_RECIPIENTS,
            f"Client Reply to Ticket #{ticket.id}: {ticket.subject}",
            "ticket_reply_admin_email",
            ticket_id=ticket.id,
            client_name=current_user.name,
            client_username=current_user.username,
            ticket_subject=ticket.subject,
            reply_message=reply.message
        )
    admin_users = User.query.filter_by(role='admin', is_active=True).all()
    for admin in admin_users:
        create_notification(
            admin.id,
            f"Client {current_user.username} replied to ticket #{ticket.id} ('{ticket.subject}').",
            link=f"#support-tickets-admin", # Link for admin panel
            notification_type="ticket_reply_admin"
        )
    db.session.commit()
    return jsonify({'message': 'Reply posted successfully.', 'reply': reply.to_dict(), 'ticket_status': ticket.status}), 201

# ---- Domain Suggestion API Endpoint ----
@api_bp.route('/domain-suggestions', methods=['GET'])
@login_required
def get_domain_suggestions():
    if current_user.role != 'client':
        return jsonify({'error': 'Unauthorized'}), 403

    keywords = request.args.get('keywords', '').strip().lower()
    if not keywords:
        return jsonify({'error': 'Keywords are required.'}), 400

    if not all([NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_CLIENT_IP]):
        app.logger.error("Namecheap API credentials not configured for domain suggestion.")
        return jsonify({'error': 'Registrar API not configured. Showing local suggestions only.', 
                        'suggestions': perform_local_suggestion_check(keywords, True)})
    try:
        # Instantiate using the imported 'api' (lowercase) directly as the class
        # and pass parameters exactly as Namecheap API expects.
        nc_api_instance = DomainAPI( 
            api_user=NAMECHEAP_API_USER,    # Changed to snake_case
            api_key=NAMECHEAP_API_KEY,     # Changed to snake_case
            username=NAMECHEAP_API_USER,   # Changed to snake_case (UserName might also map to username)
            client_ip=NAMECHEAP_CLIENT_IP, # Changed to snake_case
            sandbox=NAMECHEAP_SANDBOX      # sandbox is usually lowercase in Python libs
        )
        app.logger.info("Successfully instantiated Namecheap API client using imported 'api'.")

    except Exception as e: 
        app.logger.error(f"Error instantiating Namecheap API client (using 'api'): {e}", exc_info=True)
        return jsonify({'error': 'Failed to initialize registrar API client.', 
                        'suggestions': perform_local_suggestion_check(keywords, True)})


    cleaned_keywords = keywords
    common_tlds_to_strip = ['.com', '.net', '.org', '.co', '.io', '.dev', '.app', '.shop', '.store', '.xyz', '.online', '.tech', '.site', '.info', '.biz', '.us', '.ca', '.uk']
    for tld in common_tlds_to_strip:
        if cleaned_keywords.endswith(tld):
            cleaned_keywords = cleaned_keywords[:-len(tld)]
            break 

    cleaned_keywords = cleaned_keywords.replace('.', '')
    if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', cleaned_keywords) and not re.match(r'^[a-z0-9]$', cleaned_keywords):
        if cleaned_keywords and not cleaned_keywords.replace('-', ''):
             return jsonify({'error': 'Keywords cannot consist only of hyphens.'}), 400
        elif cleaned_keywords:
            return jsonify({'error': 'Keywords contain invalid characters for a domain name part.'}), 400
    
    if not cleaned_keywords:
        return jsonify({'suggestions': []})

    tlds_for_suggestions = [
        '.com', '.net', '.org', '.io', '.co', '.dev', '.app', '.xyz',
        '.online', '.tech', '.site', '.store', '.shop', '.info', '.biz',
        '.me', '.ai' 
    ]
    suggestions_generated_names = set()

    for tld in tlds_for_suggestions:
        suggestions_generated_names.add(f"{cleaned_keywords}{tld}")

    prefixes = ["my", "get", "the", "go"]
    suffixes = ["online", "now", "hq", "app", "store"]
    
    if len(cleaned_keywords) > 2:
        for prefix in prefixes:
            suggestions_generated_names.add(f"{prefix}{cleaned_keywords}.com")
        for suffix in suffixes:
            suggestions_generated_names.add(f"{cleaned_keywords}{suffix}.com")
        
        split_point = len(cleaned_keywords) // 2
        if '-' not in cleaned_keywords and len(cleaned_keywords) > 5 and split_point > 1 and split_point < len(cleaned_keywords) -1:
             hyphenated = f"{cleaned_keywords[:split_point]}-{cleaned_keywords[split_point:]}"
             suggestions_generated_names.add(f"{hyphenated}.com")

    suggestions_list_to_check = list(suggestions_generated_names)[:20] 

    final_suggestions = []
    placeholder_prices = {
        '.com': "$12.99", '.net': "$10.99", '.org': "$9.99", '.io': "$39.99", 
        '.co': "$25.99", '.dev': "$14.99", '.app': "$19.99", '.xyz': "$1.99",
        '.online': "$5.99", '.tech': "$7.99", '.site': "$3.99", '.store': "$8.99",
        '.shop': "$6.99", '.info': "$11.99", '.biz': "$13.99", '.me': "$7.99", '.ai': "$69.99",
    }

    locally_checked_suggestions = []
    for name_to_check_locally in suggestions_list_to_check:
        domain_exists_local = Domain.query.filter_by(name=name_to_check_locally).first()
        request_exists_local = DomainRequest.query.filter_by(
            domain_name=name_to_check_locally, 
            request_type='register', 
            status='Pending Admin Approval'
        ).first()
        is_available_locally = not domain_exists_local and not request_exists_local
        locally_checked_suggestions.append({'name': name_to_check_locally, 'available_locally': is_available_locally})

    domains_for_namecheap_check = [s['name'] for s in locally_checked_suggestions if s['available_locally']]
    
    namecheap_availability_results = {}
    if domains_for_namecheap_check:
        try:
            nc_results_dict = nc_api_instance.domains_check(domains_for_namecheap_check) 
            namecheap_availability_results = nc_results_dict
        except Exception as e:
            app.logger.error(f"Namecheap API error during domain check: {e}", exc_info=True)
            for domain_name_errored in domains_for_namecheap_check:
                 namecheap_availability_results[domain_name_errored] = None 

    for s_info in locally_checked_suggestions:
        suggested_name = s_info['name']
        is_available_final = False 
        status_detail = "Taken (Locally)"

        if s_info['available_locally']:
            nc_status = namecheap_availability_results.get(suggested_name)
            if nc_status is True: 
                is_available_final = True
                status_detail = "Available"
            elif nc_status is False: 
                is_available_final = False
                status_detail = "Taken (Registrar)"
            else: 
                is_available_final = False 
                status_detail = "Availability Check Error"
        
        tld_part = "." + suggested_name.split('.')[-1] if '.' in suggested_name else ".com"
        price = placeholder_prices.get(tld_part, "$14.99")

        final_suggestions.append({
            'name': suggested_name,
            'available': is_available_final,
            'price': price if is_available_final else "N/A",
            'status_detail': status_detail 
        })
    
    final_suggestions.sort(key=lambda x: (not x['available'], x['name']))
    return jsonify({'suggestions': final_suggestions})

def perform_local_suggestion_check(keywords, fallback_mode=False):
    cleaned_keywords = keywords 
    tlds_for_suggestions = ['.com', '.net', '.org']
    suggestions_generated = [f"{cleaned_keywords}{tld}" for tld in tlds_for_suggestions]
    
    final_suggestions = []
    placeholder_prices = {'.com': "$12.99", '.net': "$10.99", '.org': "$9.99"}

    for suggested_name in suggestions_generated:
        domain_exists = Domain.query.filter_by(name=suggested_name).first()
        request_exists = DomainRequest.query.filter_by(domain_name=suggested_name, request_type='register', status='Pending Admin Approval').first()
        is_available_locally = not domain_exists and not request_exists
        
        tld_part = "." + suggested_name.split('.')[-1] if '.' in suggested_name else ".com"
        price = placeholder_prices.get(tld_part, "$11.99")

        final_suggestions.append({
            'name': suggested_name,
            'available': is_available_locally,
            'price': price if is_available_locally else "N/A",
            'status_detail': "Locally Available" if is_available_locally else "Taken (Locally)"
        })
    final_suggestions.sort(key=lambda x: (not x['available'], x['name']))
    if fallback_mode: 
        for suggestion in final_suggestions:
            suggestion['status_detail'] = "Local Check Only - " + suggestion['status_detail']
    return final_suggestions


# ---- Definition of update_request_status_generic ----
def update_request_status_generic(request_id, model_class, new_status, admin_notes=None, additional_data=None):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    item = db.session.get(model_class, request_id)
    if not item:
        return jsonify({'error': f'{model_class.__name__} ID {request_id} not found'}), 404

    app.logger.info(f"Admin {current_user.username} updating status for {model_class.__name__} ID {request_id} from '{item.status}' to '{new_status}'. Notes: {admin_notes}")
    
    try:
        item.status = new_status
        if admin_notes is not None:
            item.admin_notes = admin_notes

        client_to_notify = getattr(item, 'user', None) or getattr(item, 'client', None)
        item_description_for_email = "your request"
        notification_message_for_client = None
        email_template_name = None 
        email_subject = "Update on your request"
        req_type_display = "Request" 

        if isinstance(item, DomainRequest):
            item_description_for_email = item.domain_name or (item.domain.name if item.domain else 'the relevant item')
            req_type_display = item.request_type.replace('_', ' ').title()
            if item.request_type == 'payment_proof' and item.invoice:
                item_description_for_email = f"Invoice {item.invoice.invoice_number} ({item.invoice.description})"
            
            if item.request_type == 'payment_proof':
                if new_status == 'Approved':
                    email_subject = f"Payment Confirmed for Invoice {item.invoice.invoice_number if item.invoice else 'N/A'}"
                    email_template_name = 'payment_proof_approved_email'
                    notification_message_for_client = f"Your payment proof for Invoice {item.invoice.invoice_number if item.invoice else 'N/A'} has been approved."
                elif new_status == 'Rejected':
                    email_subject = f"Update on Payment Proof for Invoice {item.invoice.invoice_number if item.invoice else 'N/A'}"
                    email_template_name = 'payment_proof_rejected_email'
                    notification_message_for_client = f"Your payment proof for Invoice {item.invoice.invoice_number if item.invoice else 'N/A'} was rejected."
            elif new_status in ['Approved', 'Completed', 'EPP Code Sent', 'Processing']:
                email_subject = f"Request Update: {item_description_for_email} - {new_status}"
                email_template_name = 'request_approval_email'
                notification_message_for_client = f"Your request for {item_description_for_email} ({req_type_display}) is now {new_status}."
                if new_status == 'EPP Code Sent' and additional_data and additional_data.get('epp_code'):
                    notification_message_for_client += f" EPP Code: {additional_data.get('epp_code')}"
            elif new_status in ['Rejected', 'Failed', 'Cancelled by Client']:
                email_subject = f"Request Update: {item_description_for_email} - {new_status}"
                email_template_name = 'request_rejected_email'
                notification_message_for_client = f"Your request for {item_description_for_email} ({req_type_display}) was {new_status.lower()}."
                if admin_notes: notification_message_for_client += f" Reason: {admin_notes}"
        
        elif isinstance(item, SupportTicket):
            item.last_updated = datetime.datetime.now(timezone.utc)
            item_description_for_email = f"Ticket #{item.id}: {item.subject}"
            email_subject = f"Support Ticket Update: {item_description_for_email}"
            notification_message_for_client = f"Your support ticket #{item.id} ({item.subject}) has been updated to: {new_status}."
            if new_status in ['Resolved', 'Closed']:
                email_template_name = 'request_approved_email' # Can reuse for generic approval/completion
            elif new_status == 'In Progress' and client_to_notify and client_to_notify.email:
                 email_template_name = 'ticket_reply_client_email' 
                 additional_data = additional_data or {} 
                 additional_data['reply_message'] = additional_data.get('reply_message', f"The status of your ticket has been updated to: {new_status} by our team.")
                 additional_data['replier_name'] = additional_data.get('replier_name', "Support Team")


        if isinstance(item, DomainRequest):
            if item.request_type == 'register' and new_status == 'Approved':
                domain = Domain.query.filter_by(name=item.domain_name).first()
                if not domain:
                    reg_date = datetime.date.today(); exp_duration_str = item.requested_data.get('registrationDurationYears', "1")
                    try: exp_duration_int = int(exp_duration_str)
                    except (ValueError, TypeError): exp_duration_int = 1
                    exp_date = reg_date + datetime.timedelta(days=365 * exp_duration_int)
                    domain = Domain(name=item.domain_name, user_id=item.user_id, status='Active', registration_date=reg_date, expiry_date=exp_date, auto_renew=item.requested_data.get('autoRenew', False))
                    db.session.add(domain); db.session.flush(); item.domain_id = domain.id
                item.status = 'Completed'
            elif item.request_type == 'renew' and new_status == 'Approved':
                domain = db.session.get(Domain, item.domain_id)
                if domain:
                    current_expiry = domain.expiry_date or datetime.date.today()
                    renewal_duration_str = item.requested_data.get('renewalDurationYears', "1")
                    try: renewal_duration_int = int(renewal_duration_str)
                    except (ValueError, TypeError): renewal_duration_int = 1
                    domain.expiry_date = current_expiry + datetime.timedelta(days=365 * renewal_duration_int)
                    domain.status, item.status = 'Active', 'Completed'
                else: item.status, item.admin_notes = 'Failed', (item.admin_notes or "") + "\nError: Domain not found."
            elif item.request_type == 'payment_proof' and new_status == 'Approved':
                invoice = db.session.get(Invoice, item.invoice_id)
                if invoice: invoice.status, invoice.payment_date, item.status = 'Paid', datetime.date.today(), 'Completed'; app.logger.info(f"Invoice {invoice.invoice_number} Paid.")
                else: item.status, item.admin_notes = 'Failed', (item.admin_notes or "") + "\nError: Invoice not found."
            elif item.request_type == 'transfer_in' and new_status == 'Completed':
                domain = Domain.query.filter_by(name=item.domain_name).first()
                if not domain:
                    reg_date = datetime.date.today(); exp_date = reg_date + datetime.timedelta(days=365)
                    domain = Domain(name=item.domain_name, user_id=item.user_id, status='Active', registration_date=reg_date, expiry_date=exp_date, auto_renew=False)
                    db.session.add(domain); db.session.flush(); item.domain_id = domain.id
                else: domain.user_id, domain.status, item.domain_id = item.user_id, 'Active', domain.id
            elif item.request_type == 'transfer_out':
                if new_status == 'EPP Code Sent' and additional_data and 'epp_code' in additional_data:
                    if item.requested_data: item.requested_data['epp_code_provided_by_admin'] = additional_data['epp_code']
                    else: item.requested_data = {'epp_code_provided_by_admin': additional_data['epp_code']}
                elif new_status == 'Completed':
                    domain = db.session.get(Domain, item.domain_id);
                    if domain: domain.status = 'Transferred Out'
            elif item.request_type in ['dns_change', 'contact_update'] and new_status == 'Approved':
                item.status = 'Completed'
            elif item.request_type == 'auto_renew_change' and new_status == 'Approved':
                domain_to_update = db.session.get(Domain, item.domain_id)
                if domain_to_update:
                    requested_auto_renew = item.requested_data.get('requestedAutoRenewStatus')
                    if isinstance(requested_auto_renew, bool): domain_to_update.auto_renew, item.status = requested_auto_renew, 'Completed'
                    else: item.status, item.admin_notes = 'Failed', (item.admin_notes or "") + "\nError: Invalid auto-renew status."
                else: item.status, item.admin_notes = 'Failed', (item.admin_notes or "") + "\nError: Domain not found."
            elif item.request_type == 'lock_change' and new_status == 'Approved':
                domain_to_update = db.session.get(Domain, item.domain_id)
                if domain_to_update:
                    requested_lock_status = item.requested_data.get('requestedLockStatus')
                    if isinstance(requested_lock_status, bool): domain_to_update.is_locked, item.status = requested_lock_status, 'Completed'
                    else: item.status, item.admin_notes = 'Failed', (item.admin_notes or "") + "\nError: Invalid lock status."
                else: item.status, item.admin_notes = 'Failed', (item.admin_notes or "") + "\nError: Domain not found."
            elif item.request_type == 'internal_transfer_request' and new_status == 'Approved':
                domain_to_transfer = db.session.get(Domain, item.domain_id)
                target_client_id = item.requested_data.get('target_client_id')
                target_client = db.session.get(User, target_client_id) if target_client_id else None
                if domain_to_transfer and target_client:
                    if domain_to_transfer.user_id == item.user_id: domain_to_transfer.user_id, item.status = target_client.id, 'Completed'
                    else: item.status, item.admin_notes = 'Failed', (item.admin_notes or "") + "\nError: Domain not owned by requester."
                else: item.status, item.admin_notes = 'Failed', (item.admin_notes or "") + "\nError: Domain or target client not found."

        db.session.commit() 
        app.logger.info(f"Successfully committed status update for {model_class.__name__} ID {request_id} to '{item.status}'.")
        
        if client_to_notify and notification_message_for_client:
            email_context = {'client_name': client_to_notify.name, 'item_description': item_description_for_email, 'admin_notes': admin_notes, 'request_type_display': req_type_display}
            if isinstance(item, DomainRequest) and item.request_type == 'payment_proof' and item.invoice: email_context['invoice_number'] = item.invoice.invoice_number
            if isinstance(item, DomainRequest) and item.request_type == 'transfer_out' and new_status == 'EPP Code Sent' and additional_data and additional_data.get('epp_code'): email_context['epp_code'] = additional_data.get('epp_code')
            
            if isinstance(item, SupportTicket) and new_status == 'In Progress' and additional_data and 'reply_message' in additional_data:
                email_context['reply_message'] = additional_data.get('reply_message')
                email_context['replier_name'] = additional_data.get('replier_name', "Support Team")
                email_context['ticket_id'] = item.id
                email_context['ticket_subject'] = item.subject


            if client_to_notify.email and email_template_name:
                send_system_email([client_to_notify.email], email_subject, email_template_name, **email_context)
            
            link_anchor = f"request-{item.id}" if isinstance(item, DomainRequest) else f"ticket-{item.id}"
            notif_type = f"{item.request_type}_status_update" if isinstance(item, DomainRequest) else "ticket_status_update"
            create_notification(client_to_notify.id, notification_message_for_client, link=f"#{link_anchor}", notification_type=notif_type)
            db.session.commit()

        return jsonify({'message': f'{model_class.__name__} ID {request_id} status updated to {item.status}.', 'item': item.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"CRITICAL error in update_request_status_generic for {model_class.__name__} ID {request_id} to status '{new_status}': {str(e)}", exc_info=True)
        return jsonify({'error': f'Server error processing request: {str(e)}'}), 500

# ---- Admin API Routes (admin_bp) ----
@admin_bp.route('/dashboard-summary')
@login_required
def admin_dashboard_summary_route():
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    summary = {
        'pending_registrations': DomainRequest.query.filter_by(request_type='register', status='Pending Admin Approval').count(),
        'pending_renewals': DomainRequest.query.filter_by(request_type='renew', status='Pending Admin Approval').count(),
        'pending_auto_renew_changes': DomainRequest.query.filter_by(request_type='auto_renew_change', status='Pending Admin Approval').count(),
        'pending_lock_changes': DomainRequest.query.filter_by(request_type='lock_change', status='Pending Admin Approval').count(),
        'open_support_tickets': SupportTicket.query.filter(SupportTicket.status.in_(['Open', 'In Progress'])).count(),
        'pending_transfers_in': DomainRequest.query.filter_by(request_type='transfer_in', status='Pending Admin Approval').count(),
        'pending_transfers_out': DomainRequest.query.filter_by(request_type='transfer_out', status='Pending Admin Approval').count(),
        'pending_internal_transfers': DomainRequest.query.filter_by(request_type='internal_transfer_request', status='Pending Admin Approval').count(),
        'pending_dns_changes': DomainRequest.query.filter_by(request_type='dns_change', status='Pending Admin Approval').count(),
        'pending_contact_updates': DomainRequest.query.filter_by(request_type='contact_update', status='Pending Admin Approval').count(),
        'pending_payment_proofs': DomainRequest.query.filter_by(request_type='payment_proof', status='Pending Admin Approval').count(),
        'total_managed_domains': Domain.query.count(),
        'total_clients': User.query.filter_by(role='client').count()
    }
    return jsonify(summary)

@admin_bp.route('/requests/recent-pending')
@login_required
def get_admin_recent_pending_requests_overview():
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    recent_domain_requests = DomainRequest.query.filter(DomainRequest.status.in_(['Pending Admin Approval', 'Pending'])).order_by(DomainRequest.request_date.desc()).limit(5).all()
    recent_tickets = SupportTicket.query.filter(SupportTicket.status.in_(['Open', 'In Progress'])).order_by(SupportTicket.request_date.desc()).limit(5).all()
    combined_items_raw = recent_domain_requests + recent_tickets
    combined_items_dict = [item.to_dict() for item in combined_items_raw]
    combined_items_dict.sort(key=lambda x: x.get('requestDate', ''), reverse=True)
    return jsonify(combined_items_dict[:5])

@admin_bp.route('/requests/<string:request_category>/pending')
@login_required
def get_admin_pending_requests(request_category):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    js_to_db_request_type_map = {
        'registrations': 'register', 'renewals': 'renew', 'auto-renew': 'auto_renew_change',
        'lock-change': 'lock_change', 'transfers-in': 'transfer_in', 'transfers-out': 'transfer_out',
        'internal-transfers': 'internal_transfer_request', 'dns-changes': 'dns_change',
        'contact-updates': 'contact_update', 'payment-proofs': 'payment_proof'
    }
    actual_request_type = js_to_db_request_type_map.get(request_category, request_category)
    app.logger.info(f"Fetching pending requests for category '{request_category}', mapped to type '{actual_request_type}'")
    query = DomainRequest.query.filter_by(status='Pending Admin Approval', request_type=actual_request_type)
    requests_data = query.order_by(DomainRequest.request_date.desc()).all()
    return jsonify([req.to_dict() for req in requests_data])

@admin_bp.route('/requests/<string:request_type_path>/<int:request_id>/status', methods=['PUT'])
@login_required
def update_request_status_route(request_type_path, request_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    new_status = data.get('status')
    admin_notes = data.get('admin_notes')
    additional_data = data
    
    path_to_model_map = {
        'registrations': DomainRequest, 'renewals': DomainRequest,
        'auto-renew-changes': DomainRequest, 'lock-changes': DomainRequest,
        'transfers-in': DomainRequest, 'transfers-out': DomainRequest,
        'internal-transfers': DomainRequest, 
        'dns-changes': DomainRequest, 'contact-updates': DomainRequest,
        'payment-proofs': DomainRequest, 'support-tickets': SupportTicket
    }
    
    model_class_to_use = path_to_model_map.get(request_type_path)

    if not model_class_to_use:
        app.logger.error(f"Unknown request_type_path for status update: {request_type_path}")
        return jsonify({'error': f'Invalid request category for status update: {request_type_path}'}), 400
            
    return update_request_status_generic(request_id, model_class_to_use, new_status, admin_notes, additional_data)

@admin_bp.route('/requests/support-tickets/all')
@login_required
def get_admin_all_support_tickets():
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    tickets = SupportTicket.query.order_by(SupportTicket.last_updated.desc()).all()
    return jsonify([ticket.to_dict() for ticket in tickets])

@admin_bp.route('/support-tickets/<int:ticket_id>/details', methods=['GET'])
@login_required
def get_admin_single_ticket_details(ticket_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    ticket = db.session.get(SupportTicket, ticket_id)
    if not ticket:
        return jsonify({'error': 'Ticket not found'}), 404
    return jsonify(ticket.to_dict())

@admin_bp.route('/all-domains')
@login_required
def get_admin_all_domains():
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    query = db.session.query(Domain).join(User, Domain.user_id == User.id, isouter=True)
    search_term, status_filter, client_id_filter = request.args.get('search_term'), request.args.get('status'), request.args.get('client_id')
    if search_term: query = query.filter(or_(Domain.name.ilike(f"%{search_term}%"), User.username.ilike(f"%{search_term}%"), User.name.ilike(f"%{search_term}%")))
    if status_filter: query = query.filter(Domain.status == status_filter)
    if client_id_filter:
        try:
            client_id = int(client_id_filter)
            if client_id == 0: query = query.filter(Domain.user_id.is_(None))
            else: query = query.filter(Domain.user_id == client_id)
        except ValueError: pass
    domains = query.order_by(Domain.name).all()
    return jsonify([domain.to_dict() for domain in domains])

@admin_bp.route('/clients')
@login_required
def get_admin_all_clients():
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    clients = User.query.filter_by(role='client').order_by(User.name).all()
    return jsonify([client.to_dict(include_domain_count=True) for client in clients])

@admin_bp.route('/clients/create', methods=['POST'])
@login_required
def admin_create_client():
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    app.logger.info(f"Admin Create Client - Received data: {data}")
    form = CreateClientForm(data=data, meta={'csrf': False})
    if form.validate():
        app.logger.info("Admin Create Client - Form validation successful.")
        try:
            new_client = User(username=form.username.data, name=form.name.data, email=form.email.data, role='client', is_active=True)
            new_client.set_password(form.password.data)
            db.session.add(new_client)
            db.session.commit()
            app.logger.info(f"Admin Create Client - Client '{new_client.username}' created successfully.")
            return jsonify({'message': 'Client created!', 'client': new_client.to_dict()}), 201
        except Exception as e: db.session.rollback(); app.logger.error(f"Admin Create Client - Error during client creation: {e}", exc_info=True); return jsonify({'error': 'Server error.'}), 500
    else:
        app.logger.warning(f"Admin Create Client - Form validation failed: {form.errors}")
        return jsonify({'error': 'Validation failed', 'errors': form.errors}), 400

@admin_bp.route('/clients/<int:client_id>/edit', methods=['PUT'])
@login_required
def admin_edit_client(client_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    client = db.session.get(User, client_id)
    if not client or client.role != 'client': return jsonify({'error': 'Client not found'}), 404
    data = request.get_json()
    form = EditClientForm(original_email=client.email, data=data, meta={'csrf': False}, client_id_being_edited=client.id)
    if form.validate():
        try:
            client.name, client.email = form.name.data, form.email.data
            if form.password.data: client.set_password(form.password.data)
            db.session.commit()
            return jsonify({'message': 'Client updated!', 'client': client.to_dict(include_domain_count=True)}), 200
        except Exception as e: db.session.rollback(); app.logger.error(f"Err updating client {client_id}: {e}"); return jsonify({'error': 'Server error.'}), 500
    return jsonify({'error': 'Validation failed', 'errors': form.errors}), 400

@admin_bp.route('/clients/<int:client_id>/toggle-active', methods=['POST'])
@login_required
def admin_toggle_client_active_status(client_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    client = db.session.get(User, client_id)
    if not client or client.role != 'client': return jsonify({'error': 'Client not found'}), 404
    try:
        client.is_active = not client.is_active
        db.session.commit()
        status_txt = "activated" if client.is_active else "deactivated"
        return jsonify({'message': f'Client {status_txt}.', 'client': client.to_dict(include_domain_count=True)}), 200
    except Exception as e: db.session.rollback(); app.logger.error(f"Err toggling client {client_id}: {e}"); return jsonify({'error': 'Server error.'}), 500

@admin_bp.route('/client/<int:client_id>/details')
@login_required
def get_admin_client_details(client_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    client = db.session.get(User, client_id)
    if not client or client.role != 'client': return jsonify({'error': 'Client not found'}), 404
    return jsonify({
        'profile': client.to_dict(),
        'domains': [d.to_dict() for d in Domain.query.filter_by(user_id=client.id).all()],
        'requests': [r.to_dict() for r in DomainRequest.query.filter_by(user_id=client.id).all()],
        'tickets': [t.to_dict() for t in SupportTicket.query.filter_by(user_id=client.id).all()]
    })

@admin_bp.route('/domain/<int:domain_id>/details')
@login_required
def get_admin_domain_details(domain_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    domain = db.session.get(Domain, domain_id)
    if not domain: return jsonify({'error': 'Domain not found'}), 404
    return jsonify({
        'domain_info': domain.to_dict(),
        'requests': [r.to_dict() for r in DomainRequest.query.filter_by(domain_id=domain.id).all()],
        'tickets': [t.to_dict() for t in SupportTicket.query.filter_by(related_domain_id=domain.id).all()]
    })

@admin_bp.route('/domains/<int:domain_id>/reassign', methods=['POST'])
@login_required
def admin_reassign_domain_owner(domain_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    domain = db.session.get(Domain, domain_id)
    if not domain: return jsonify({'error': 'Domain not found'}), 404
    data = request.get_json()
    new_user_id = data.get('new_user_id')
    if new_user_id is None: return jsonify({'error': 'New user ID required.'}), 400
    new_owner = db.session.get(User, new_user_id)
    if not new_owner or new_owner.role != 'client': return jsonify({'error': 'New owner not found or not client.'}), 404
    try:
        old_owner = domain.owner.username if domain.owner else "N/A"
        domain.user_id = new_owner.id
        db.session.commit()
        return jsonify({'message': f'Domain reassigned from {old_owner} to {new_owner.username}.', 'domain': domain.to_dict()}), 200
    except Exception as e: db.session.rollback(); app.logger.error(f"Err reassigning domain {domain_id}: {e}"); return jsonify({'error': 'Server error.'}), 500

@admin_bp.route('/domains/<int:domain_id>/unassign', methods=['POST'])
@login_required
def admin_unassign_domain(domain_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    domain = db.session.get(Domain, domain_id)
    if not domain: return jsonify({'error': 'Domain not found'}), 404
    if domain.user_id is None: return jsonify({'error': 'Domain already unassigned.'}), 400
    try:
        old_owner = domain.owner.username
        domain.user_id = None
        db.session.commit()
        return jsonify({'message': f'Domain unassigned from {old_owner}.', 'domain': domain.to_dict()}), 200
    except Exception as e: db.session.rollback(); app.logger.error(f"Err unassigning domain {domain_id}: {e}"); return jsonify({'error': 'Server error.'}), 500

@admin_bp.route('/invoices', methods=['GET'])
@login_required
def get_all_invoices():
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    query = Invoice.query.join(User, Invoice.user_id == User.id)
    client_id, status, search_term = request.args.get('client_id'), request.args.get('status'), request.args.get('search_term')
    if client_id: query = query.filter(Invoice.user_id == client_id)
    if status: query = query.filter(Invoice.status == status)
    if search_term: query = query.filter(or_(Invoice.invoice_number.ilike(f"%{search_term}%"), Invoice.description.ilike(f"%{search_term}%"), User.name.ilike(f"%{search_term}%"), User.username.ilike(f"%{search_term}%")))
    invoices = query.order_by(Invoice.issue_date.desc()).all()
    return jsonify([inv.to_dict() for inv in invoices])

@admin_bp.route('/invoices/create', methods=['POST'])
@login_required
def admin_create_invoice():
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    data_from_json = request.get_json()
    app.logger.info(f"Admin Create Invoice - Received JSON: {data_from_json}")

    if 'domain_id' in data_from_json and data_from_json.get('domain_id') is None:
        data_from_json['domain_id'] = "0" 
        app.logger.info(f"Admin Create Invoice - Converted domain_id: None to '0' for WTForms.")

    form = CreateInvoiceForm(data=data_from_json, meta={'csrf': False})
    form.user_id.choices = [(0, '-- Select Client --')] + [(u.id, f"{u.name} ({u.username})") for u in User.query.filter_by(role='client', is_active=True).all()]
    form.domain_id.choices = [(0, 'N/A - General Invoice')] + [(d.id, d.name) for d in Domain.query.all()]

    if form.validate():
        app.logger.info("Admin Create Invoice - Form validation successful.")
        try:
            last_inv = Invoice.query.order_by(Invoice.id.desc()).first()
            inv_num = f"INV-{datetime.date.today().year}-{(last_inv.id + 1) if last_inv else 1:04d}"
            
            domain_id_val_for_db = form.domain_id.data
            if domain_id_val_for_db == 0: domain_id_val_for_db = None
            app.logger.info(f"Admin Create Invoice - Processed domain_id for DB: {domain_id_val_for_db} (from form data: {form.domain_id.data})")

            new_inv = Invoice(invoice_number=inv_num, user_id=form.user_id.data, domain_id=domain_id_val_for_db, description=form.description.data, amount=form.amount.data, issue_date=form.issue_date.data, due_date=form.due_date.data, status=form.status.data, notes=form.notes.data)
            db.session.add(new_inv)
            db.session.commit()
            app.logger.info(f"Admin Create Invoice - Invoice {new_inv.invoice_number} committed to DB.")

            client = db.session.get(User, new_inv.user_id)
            if client and client.email:
                send_system_email([client.email], f"New Invoice: {new_inv.invoice_number}", "new_invoice_generated_email", client_name=client.name, invoice_number=new_inv.invoice_number, invoice_description=new_inv.description, invoice_amount=f"{new_inv.amount:.2f}", invoice_due_date=new_inv.due_date.strftime('%d %b, %Y'))
            create_notification(client.id, f"New invoice {new_inv.invoice_number} for ${new_inv.amount:.2f} has been generated.", link=f"#invoice-{new_inv.id}", notification_type='new_invoice')
            db.session.commit()
            return jsonify({'message': 'Invoice created!', 'invoice': new_inv.to_dict()}), 201
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Admin Create Invoice - Error during invoice creation: {e}", exc_info=True)
            return jsonify({'error': 'Server error during invoice creation: ' + str(e)}), 500
    else:
        app.logger.warning(f"Admin Create Invoice - Form validation failed: {form.errors}")
        return jsonify({'error': 'Validation failed', 'errors': form.errors}), 400


@admin_bp.route('/invoices/<int:invoice_id>/details', methods=['GET'])
@login_required
def get_admin_invoice_details(invoice_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice: return jsonify({'error': 'Invoice not found'}), 404
    return jsonify(invoice.to_dict())

@admin_bp.route('/invoices/<int:invoice_id>/mark-paid', methods=['POST'])
@login_required
def admin_mark_invoice_paid(invoice_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice: return jsonify({'error': 'Invoice not found'}), 404
    invoice.status, invoice.payment_date = 'Paid', datetime.date.today()
    proof_req = DomainRequest.query.filter_by(invoice_id=invoice.id, request_type='payment_proof', status='Pending Admin Approval').first()
    if proof_req: proof_req.status, proof_req.admin_notes = 'Completed', (proof_req.admin_notes or "") + "\nApproved by admin."
    db.session.commit()
    return jsonify({'message': 'Invoice marked Paid.', 'invoice': invoice.to_dict()}), 200

@admin_bp.route('/invoices/<int:invoice_id>/cancel', methods=['POST'])
@login_required
def admin_cancel_invoice(invoice_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice: return jsonify({'error': 'Invoice not found'}), 404
    if invoice.status == 'Paid': return jsonify({'error': 'Cannot cancel paid invoice.'}), 400
    invoice.status = 'Cancelled'
    proof_req = DomainRequest.query.filter_by(invoice_id=invoice.id, request_type='payment_proof', status='Pending Admin Approval').first()
    if proof_req: proof_req.status, proof_req.admin_notes = 'Rejected', (proof_req.admin_notes or "") + "\nInvoice cancelled."
    db.session.commit()
    return jsonify({'message': 'Invoice cancelled.', 'invoice': invoice.to_dict()}), 200

@admin_bp.route('/support-tickets/<int:ticket_id>/reply', methods=['POST'])
@login_required
def admin_reply_to_ticket(ticket_id):
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    ticket = db.session.get(SupportTicket, ticket_id)
    if not ticket: return jsonify({'error': 'Ticket not found'}), 404
    data = request.get_json()
    message_text = data.get('message')
    if not message_text or not message_text.strip(): return jsonify({'error': 'Reply cannot be empty'}), 400

    reply = TicketReply(ticket_id=ticket.id, user_id=current_user.id, message=message_text.strip())
    db.session.add(reply)
    ticket.last_updated = datetime.datetime.now(timezone.utc)
    if ticket.status == 'Open': ticket.status = 'In Progress'
    
    if ticket.user:
        create_notification(ticket.user.id, f"Admin replied to your ticket #{ticket.id}: '{ticket.subject}'.", link=f"#ticket-{ticket.id}", notification_type='ticket_reply_client')
        if ticket.user.email:
            send_system_email([ticket.user.email], f"Update on Ticket #{ticket.id}", "ticket_reply_client_email", client_name=ticket.user.name, ticket_id=ticket.id, ticket_subject=ticket.subject, reply_message=reply.message, replier_name=current_user.name)
    
    db.session.commit()
    return jsonify({'message': 'Reply posted.', 'reply': reply.to_dict(), 'ticket_status': ticket.status}), 201

# ---- Blueprint Registrations ----
# Must come AFTER all routes are defined on the blueprints
app.register_blueprint(api_bp)
app.register_blueprint(admin_bp)

# Placeholder functions for scheduled tasks
def send_domain_expiry_reminders():
    with app.app_context():
        app.logger.info("Scheduler: Checking domains nearing expiry...")
        # ... (logic as before) ...
        app.logger.info("Scheduler: Domain expiry check complete.")

def send_invoice_overdue_reminders():
    with app.app_context():
        app.logger.info("Scheduler: Checking overdue invoices...")
        # ... (logic as before) ...
        app.logger.info("Scheduler: Overdue invoice check complete.")

# Database Creation Utility
def create_db():
    with app.app_context():
        print(f"Attempting to create database at: {DATABASE_FILE_PATH}")
        if os.path.exists(DATABASE_FILE_PATH):
            print(f"Database file {DATABASE_FILE_PATH} already exists. Deleting for a fresh start...")
            try:
                os.remove(DATABASE_FILE_PATH)
                print("Old database file deleted.")
            except OSError as e:
                print(f"Error deleting old database file: {e}. Please check permissions or close other connections.")
                return

        db.create_all()
        print("Database tables created (or verified).")

        if os.path.exists(DATABASE_FILE_PATH):
            print(f"Database file {DATABASE_FILE_PATH} now exists.")
            print(f"File size: {os.path.getsize(DATABASE_FILE_PATH)} bytes.")
        else:
            print(f"ERROR: Database file {DATABASE_FILE_PATH} was NOT created.")
            return

        if not User.query.filter_by(username='admin').first():
            admin_user = User(username='admin', name='Administrator', role='admin', email='admin@example.com', is_active=True)
            admin_user.set_password('ChangeMeStrongPassword123!')
            db.session.add(admin_user)
            print("Default admin user prepared.")
        else:
            print("Admin user already exists.")

        if not User.query.filter_by(username='client1').first():
            client_user = User(username='client1', name='Test Client One', role='client', email='client1@example.com', is_active=True)
            client_user.set_password('clientPass123')
            db.session.add(client_user)
            client_user2 = User(username='client2', name='Another Client', role='client', email='client2@example.com', is_active=True)
            client_user2.set_password('clientPass456')
            db.session.add(client_user2)
            client_user3 = User(username='client3', name='Sample Client Three', role='client', email='client3@example.com', is_active=True)
            client_user3.set_password('clientPass789')
            db.session.add(client_user3)
            print("Default client users (client1, client2, client3) prepared.")
        else:
            print("Client users already exist.")
        
        try:
            db.session.commit()
            print("Admin and client users committed.")
        except Exception as e:
            db.session.rollback()
            print(f"Error committing users: {e}")
            return

        client1_from_db = User.query.filter_by(username='client1').first()
        client3_from_db = User.query.filter_by(username='client3').first()
        admin_user_for_reply = User.query.filter_by(username='admin').first()

        if client1_from_db and admin_user_for_reply and client3_from_db:
            d1 = Domain(name='example.com', status='Active', expiry_date=datetime.date(2025, 12, 31), auto_renew=True, owner=client1_from_db, registration_date=datetime.date(2023,1,10), is_locked=True)
            d2 = Domain(name='anotherdomain.net', status='Expiring Soon', expiry_date=datetime.date(2025, 7, 15), owner=client1_from_db, registration_date=datetime.date(2022,6,20), is_locked=False)
            d3 = Domain(name='testexpired.org', status='Expired', expiry_date=datetime.date(2024, 1, 1), owner=client1_from_db, registration_date=datetime.date(2021,3,5), is_locked=True)
            d4 = Domain(name='unassigned-sample.com', status='Active', expiry_date=datetime.date(2026, 1, 1), owner=admin_user_for_reply, registration_date=datetime.date(2023, 5, 5), is_locked=True)
            d5 = Domain(name='ownerless-sample.org', status='Active', expiry_date=datetime.date(2027,1,1), user_id=None, registration_date=datetime.date(2023,6,1), is_locked=False)
            d6_for_transfer = Domain(name='transferme.com', status='Active', expiry_date=datetime.date(2026, 6, 1), owner=client1_from_db, registration_date=datetime.date(2023,6,1), is_locked=True)
            db.session.add_all([d1, d2, d3, d4, d5, d6_for_transfer])
            try:
                db.session.commit()
                print("Sample domains committed.")
            except Exception as e: db.session.rollback(); print(f"Error committing domains: {e}"); return

            d1 = Domain.query.filter_by(name='example.com').first() 
            d2 = Domain.query.filter_by(name='anotherdomain.net').first()
            d6_for_transfer = Domain.query.filter_by(name='transferme.com').first()

            inv1 = Invoice(invoice_number='INV-2024-001', user_id=client1_from_db.id, domain_id=d1.id if d1 else None, description=f'Domain Renewal - {d1.name if d1 else "example.com"}', amount=15.99, issue_date=datetime.date.today() - timedelta(days=10), due_date=datetime.date.today() + timedelta(days=20), status='Pending Payment')
            inv2 = Invoice(invoice_number='INV-2024-002', user_id=client1_from_db.id, domain_id=d2.id if d2 else None, description=f'New Reg - {d2.name if d2 else "anotherdomain.net"}', amount=12.50, issue_date=datetime.date.today() - timedelta(days=40), due_date=datetime.date.today() - timedelta(days=10), status='Paid', payment_date=datetime.date.today() - timedelta(days=5))
            inv3 = Invoice(invoice_number='INV-2024-003', user_id=client1_from_db.id, description='Web Hosting - Basic Plan', amount=25.00, issue_date=datetime.date.today() - timedelta(days=5), due_date=datetime.date.today() + timedelta(days=25), status='Pending Payment')
            db.session.add_all([inv1, inv2, inv3])
            try:
                db.session.commit()
                print("Sample invoices committed.")
            except Exception as e: db.session.rollback(); print(f"Error committing invoices: {e}"); return

            inv1 = Invoice.query.filter_by(invoice_number='INV-2024-001').first()

            req_data_list = [
                DomainRequest(user_id=client1_from_db.id, domain_name="newsite.dev", request_type="register", requested_data={"registrationDurationYears": 1, "requestSsl": True, "sslDurationYears": 1}),
                DomainRequest(user_id=client1_from_db.id, domain_id=d1.id if d1 else None, domain_name=d1.name if d1 else "example.com", request_type="renew", requested_data={"renewalDurationYears": 2}),
                SupportTicket(user_id=client1_from_db.id, subject="Issue with example.com DNS", message="Please help, I cannot update my DNS.", related_domain_id=d1.id if d1 else None),
                DomainRequest(user_id=client1_from_db.id, domain_name="transfermeplease.com", request_type="transfer_in", requested_data={"auth_code": "testcode"}),
                DomainRequest(user_id=client1_from_db.id, domain_id=d1.id if d1 else None, domain_name=d1.name if d1 else 'example.com', request_type="transfer_out", requested_data={'reason': 'moving'}),
                DomainRequest(user_id=client1_from_db.id, domain_id=d6_for_transfer.id if d6_for_transfer else None, domain_name=d6_for_transfer.name if d6_for_transfer else 'transferme.com', request_type='internal_transfer_request', requested_data={'target_client_identifier': 'client3', 'target_client_id': client3_from_db.id, 'target_client_name': client3_from_db.name}),
                DomainRequest(user_id=client1_from_db.id, domain_id=d2.id if d2 else None, domain_name=d2.name if d2 else 'anotherdomain.net', request_type='dns_change', requested_data={'changeDescription': 'Update MX records'}),
                DomainRequest(user_id=client1_from_db.id, domain_id=d1.id if d1 else None, domain_name=d1.name if d1 else 'example.com', request_type='contact_update', requested_data={'changes_description': 'New phone number'}),
                DomainRequest(user_id=client1_from_db.id, invoice_id=inv1.id if inv1 else None, request_type='payment_proof', requested_data={'paymentNotes': 'Paid via transfer'}),
                DomainRequest(user_id=client1_from_db.id, domain_id=d1.id if d1 else None, domain_name=d1.name if d1 else 'example.com', request_type='auto_renew_change', requested_data={'requestedAutoRenewStatus': False}),
                DomainRequest(user_id=client1_from_db.id, domain_id=d2.id if d2 else None, domain_name=d2.name if d2 else 'anotherdomain.net', request_type='lock_change', requested_data={'requestedLockStatus': False})
            ]
            db.session.add_all(req_data_list)
            try:
                db.session.commit()
                print("Sample domain requests, tickets, etc. committed.")
            except Exception as e: db.session.rollback(); print(f"Error committing requests/tickets: {e}"); return
                
            ticket1_from_db = SupportTicket.query.filter_by(subject="Issue with example.com DNS").first()
            if ticket1_from_db and admin_user_for_reply:
                reply1 = TicketReply(ticket_id=ticket1_from_db.id, user_id=admin_user_for_reply.id, message="Admin reply to DNS issue.")
                db.session.add(reply1); ticket1_from_db.last_updated = datetime.datetime.now(timezone.utc)
                try:
                    db.session.commit()
                    print(f"Sample reply for ticket ID: {ticket1_from_db.id} committed.")
                except Exception as e: db.session.rollback(); print(f"Error committing ticket reply: {e}")
        else:
            print("Failed to fetch users for detailed sample data population.")
        print("Database setup complete. All sample data processed.")


# Test Email Route
@app.route('/test-email')
@login_required
def test_email_route():
    if current_user.role != 'admin': return jsonify({'error': 'Unauthorized'}), 403
    test_recipient = app.config.get('MAIL_USERNAME')
    if not test_recipient: return jsonify({'error': 'MAIL_USERNAME not configured.'}), 500
    subject = "DomainHub Test Email"
    html_body = render_template("email/test_email_template.html", admin_name=current_user.name, timestamp=datetime.datetime.now(timezone.utc).isoformat())
    try:
        msg = Message(subject, recipients=[test_recipient], html=html_body)
        mail.send(msg)
        app.logger.info(f"Test email sent to {test_recipient}")
        return jsonify({'message': f'Test email sent to {test_recipient}.'}), 200
    except Exception as e:
        app.logger.exception("Exception sending test email:")
        return jsonify({'error': f'Exception: {str(e)}'}), 500

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == 'create_database':
        create_db()
    else:
        app.run(debug=(os.getenv('FLASK_DEBUG', 'True').lower() == 'true'))

