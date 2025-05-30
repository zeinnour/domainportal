// Project/static/js/admin/apiAdminService.js
import { getApiBaseUrl } from './config.js';

const ADMIN_API_BASE_URL = getApiBaseUrl(); // This is '/api/admin'
const GENERAL_API_BASE_URL = '/api'; // For shared routes like auth

async function fetchAdminAPI(path, method = 'GET', body = null, isFormData = false) {
    const options = {
        method: method,
        headers: {},
        credentials: 'include'
    };

    if (body) {
        if (isFormData) {
            options.body = body;
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    try {
        // Use ADMIN_API_BASE_URL for admin-specific paths
        const fullPath = path.startsWith('/') ? path : `/${path}`; // Ensure path starts with /
        const response = await fetch(ADMIN_API_BASE_URL + fullPath, options);


        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { 
                    message: `HTTP error ${response.status}. Response not valid JSON. Path: ${ADMIN_API_BASE_URL + fullPath}`, 
                    error: `HTTP error ${response.status}. Response not valid JSON. Path: ${ADMIN_API_BASE_URL + fullPath}`,
                    errors: {} 
                };
            }
            
            console.error(`API Error (${ADMIN_API_BASE_URL + fullPath}):`, errorData.message || errorData.error || `HTTP error ${response.status}`, errorData.errors || {});
            
            const customError = { 
                message: errorData.error || errorData.message || `HTTP error ${response.status}`,
                status: response.status,
                errors: errorData.errors || {}
            };
            throw customError;
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return { success: true, message: (await response.text()) || response.statusText || "Operation successful" };
        }

    } catch (error) {
        console.error(`Fetch Admin API Error caught in outer catch (${ADMIN_API_BASE_URL + path}):`, error);
        if (error && error.status !== undefined && error.message !== undefined) {
            throw error;
        } else {
            throw {
                message: error.message || `Network error or an unexpected issue occurred. Path: ${ADMIN_API_BASE_URL + path}`,
                status: 0, 
                errors: {}
            };
        }
    }
}

// --- Auth ---
export async function checkAuthStatus() { // Admin specific auth check if needed, or use general one
    // This uses the general /api/auth/status endpoint
    try {
        const response = await fetch(`${GENERAL_API_BASE_URL}/auth/status`, { credentials: 'include' }); 
        if (!response.ok) {
             const errorText = await response.text();
            console.error(`Auth status check failed with status: ${response.status} - ${errorText}`);
            throw new Error(`Auth status check failed: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error in checkAuthStatus (apiAdminService):", error.message);
        throw { 
            message: error.message || "Authentication check failed.", 
            status: error.status || 0,
            errors: {} 
        };
    }
}

export async function logoutUser() { // <<< NEWLY ADDED/ENSURED EXPORT
    // This uses the general /api/auth/logout endpoint
    try {
        const response = await fetch(`${GENERAL_API_BASE_URL}/auth/logout`, { 
            method: 'POST',
            credentials: 'include' 
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Logout failed with status: ${response.status} - ${errorText}`);
            throw new Error(`Logout failed: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error in logoutUser (apiAdminService):", error.message);
        throw {
            message: error.message || "Logout operation failed.",
            status: error.status || 0,
            errors: {}
        };
    }
}


// --- Dashboard ---
export async function getAdminDashboardSummary() {
    return fetchAdminAPI('/dashboard-summary');
}
export async function getRecentPendingOverview() {
    return fetchAdminAPI('/requests/recent-pending');
}

// --- Pending Requests ---
export async function getPendingRequests(requestCategory) {
    return fetchAdminAPI(`/requests/${requestCategory}/pending`);
}

export async function getAllAdminSupportTickets() { // Corrected name
    return fetchAdminAPI('/requests/support-tickets/all');
}


// --- Client Management ---
export async function getAllClientsAdmin() {
    return fetchAdminAPI('/clients');
}
export async function createClientAdmin(clientData) {
    return fetchAdminAPI('/clients/create', 'POST', clientData);
}
export async function editClientAdmin(clientId, clientData) {
    return fetchAdminAPI(`/clients/${clientId}/edit`, 'PUT', clientData);
}
export async function toggleClientActiveStatusAdmin(clientId) {
    return fetchAdminAPI(`/clients/${clientId}/toggle-active`, 'POST');
}
export async function getClientDetailsAdmin(clientId) {
    return fetchAdminAPI(`/client/${clientId}/details`);
}

// --- Domain Management ---
export async function getAllAdminDomains(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return fetchAdminAPI(`/all-domains${queryParams ? '?' + queryParams : ''}`);
}
export async function getDomainDetailsAdmin(domainId) {
    return fetchAdminAPI(`/domain/${domainId}/details`);
}
export async function reassignDomainOwnerAdmin(domainId, newUserId) {
    return fetchAdminAPI(`/domains/${domainId}/reassign`, 'POST', { new_user_id: newUserId });
}


// --- Request Status Updates ---
export async function updateRequestStatusAdmin(requestType, requestId, status, adminNotes, additionalData = {}) {
    let endpointPath = requestType; 

    const typeToPathSegmentMap = {
        'register': 'registrations',
        'renew': 'renewals',
        'auto_renew_change': 'auto-renew-changes',
        'lock_change': 'lock-changes',
        'transfer_in': 'transfers-in',
        'transfer_out': 'transfers-out',
        'internal_transfer_request': 'internal-transfers',
        'dns_change': 'dns-changes',
        'contact_update': 'contact-updates',
        'payment_proof': 'payment-proofs',
        'support-ticket': 'support-tickets'
    };

    if (typeToPathSegmentMap[requestType]) {
        endpointPath = typeToPathSegmentMap[requestType];
    } else {
        console.warn(`Admin API: No explicit path segment mapping for requestType '${requestType}', using it directly.`);
    }

    const payload = { status, admin_notes: adminNotes, ...additionalData };
    return fetchAdminAPI(`/requests/${endpointPath}/${requestId}/status`, 'PUT', payload);
}


// --- Invoice Management ---
export async function getAllAdminInvoices(filters = {}) { // Corrected name
    const queryParams = new URLSearchParams(filters).toString();
    return fetchAdminAPI(`/invoices${queryParams ? '?' + queryParams : ''}`);
}

export async function createInvoiceAdmin(invoiceData) {
    return fetchAdminAPI('/invoices/create', 'POST', invoiceData);
}

export async function getInvoiceDetailsAdmin(invoiceId) {
    return fetchAdminAPI(`/invoices/${invoiceId}/details`);
}

export async function markInvoicePaidAdmin(invoiceId) {
    return fetchAdminAPI(`/invoices/${invoiceId}/mark-paid`, 'POST');
}

export async function cancelInvoiceAdmin(invoiceId) {
    return fetchAdminAPI(`/invoices/${invoiceId}/cancel`, 'POST');
}

// --- Support Ticket Replies (Admin) ---
export async function adminReplyToTicket(ticketId, message) { // Corrected name
    return fetchAdminAPI(`/support-tickets/${ticketId}/reply`, 'POST', { message });
}
// --- Support Ticket Details (Admin) ---
export async function getAdminTicketDetails(ticketId) {
    // Assuming your backend has a route like GET /api/admin/support-tickets/<ticket_id>/details
    // If not, this route needs to be created in app.py under admin_bp
    return fetchAdminAPI(`/support-tickets/${ticketId}/details`); 
}
