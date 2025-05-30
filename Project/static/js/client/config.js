// Project/static/js/client/config.js

export const API_BASE_URL = '/api'; // Common API prefix for client-side calls
export const AUTH_STATUS_URL = `${API_BASE_URL}/auth/status`;
export const LOGOUT_URL = `${API_BASE_URL}/auth/logout`;

// Domain related
export const DOMAINS_URL = `${API_BASE_URL}/domains`;
export const DOMAIN_REQUESTS_URL = `${API_BASE_URL}/domain-requests`; // Base for various domain actions

// User/Profile related
export const USER_PROFILE_URL = `${API_BASE_URL}/user/profile`;

// Ticket related
export const SUPPORT_TICKETS_URL = `${API_BASE_URL}/support-tickets`;

// Billing related
export const INVOICES_URL = `${API_BASE_URL}/invoices`;

// Client specific dashboard/data
export const CLIENT_PENDING_COUNTS_URL = `${API_BASE_URL}/client/pending-request-counts`;
export const CLIENT_PENDING_LOCK_URL = `${API_BASE_URL}/client/pending-lock-requests`;
export const CLIENT_PENDING_DNS_URL = `${API_BASE_URL}/client/pending-dns-requests`;
export const CLIENT_RECENT_ACTIVITY_URL = `${API_BASE_URL}/client/recent-activity`;

// Constants for alert types or other shared values can go here if needed
export const ALERT_EXPIRY_DAYS = 60; // Days before expiry to show alert

