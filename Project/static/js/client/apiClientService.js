// Project/static/js/client/apiClientService.js
import * as C_API from './config.js'; // C_API for Client API constants
import { showMessage } from '../common/messageBox.js';

/**
 * Generic fetch wrapper for client API calls.
 * @param {string} url - The full API URL.
 * @param {object} options - Fetch options (method, headers, body, etc.).
 * @returns {Promise<any>} - The JSON response from the API.
 * @throws {Error} - If the API call fails or returns an error.
 */
async function fetchClientAPI(url, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        credentials: 'include',
    };

    try {
        const response = await fetch(url, config);
        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errorMsg = responseData.error || responseData.message || `HTTP error ${response.status}`;
            console.error(`Client API Error (${url}): ${errorMsg}`, responseData);
            throw new Error(errorMsg);
        }
        return responseData;
    } catch (error) {
        console.error(`Fetch Client API Error (${url}):`, error);
        // showMessage(`API Request Failed: ${error.message}`, 'error'); // Optionally show direct error
        throw error;
    }
}

// --- Authentication ---
export async function checkAuthStatus() {
    return fetchClientAPI(C_API.AUTH_STATUS_URL);
}
export async function logoutUser() {
    return fetchClientAPI(C_API.LOGOUT_URL, { method: 'POST' });
}

// --- Data Fetching ---
export async function fetchClientDomains() {
    return fetchClientAPI(C_API.DOMAINS_URL);
}
export async function fetchPendingRequestCounts() {
    return fetchClientAPI(C_API.CLIENT_PENDING_COUNTS_URL);
}
export async function fetchClientTickets() {
    return fetchClientAPI(C_API.SUPPORT_TICKETS_URL);
}
export async function fetchPendingLockRequests() {
    return fetchClientAPI(C_API.CLIENT_PENDING_LOCK_URL);
}
export async function fetchClientInvoices() {
    return fetchClientAPI(C_API.INVOICES_URL);
}
export async function fetchPendingDnsRequests() {
    return fetchClientAPI(C_API.CLIENT_PENDING_DNS_URL);
}
export async function fetchClientRecentActivity() {
    return fetchClientAPI(C_API.CLIENT_RECENT_ACTIVITY_URL);
}


// --- Domain Requests ---
export async function submitRegisterDomainRequest(requestData) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/register`, { method: 'POST', body: JSON.stringify(requestData) });
}
export async function submitRenewDomainRequest(domainId, requestData) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/renew/${domainId}`, { method: 'POST', body: JSON.stringify(requestData) });
}
export async function submitBulkRenewRequest(payload) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/bulk-renew`, { method: 'POST', body: JSON.stringify(payload) });
}
export async function submitAutoRenewChange(domainId, requestedStatus) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/auto-renew-change/${domainId}`, { method: 'POST', body: JSON.stringify({ requestedAutoRenewStatus: requestedStatus }) });
}
export async function submitLockChangeRequest(domainId, requestedLockStatus) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/lock-change/${domainId}`, { method: 'POST', body: JSON.stringify({ requestedLockStatus }) });
}
export async function submitDnsChangeRequest(dnsChangePayload) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/dns-change`, { method: 'POST', body: JSON.stringify(dnsChangePayload) });
}
export async function submitContactUpdateRequest(contactUpdateData) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/contact-update`, { method: 'POST', body: JSON.stringify(contactUpdateData) });
}
export async function submitTransferInRequest(transferData) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/transfer`, { method: 'POST', body: JSON.stringify(transferData) });
}
export async function submitTransferOutRequest(transferOutData) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/transfer-out`, { method: 'POST', body: JSON.stringify(transferOutData) });
}
export async function submitInternalTransferRequest(internalTransferData) {
    return fetchClientAPI(`${C_API.DOMAIN_REQUESTS_URL}/internal-transfer`, { method: 'POST', body: JSON.stringify(internalTransferData) });
}

// --- Domain Suggestion Tool ---
export async function fetchDomainSuggestions(keywords) {
    const queryParams = new URLSearchParams({ keywords: keywords }).toString();
    return fetchClientAPI(`${C_API.API_BASE_URL}/domain-suggestions?${queryParams}`);
}


// --- Profile ---
export async function updateUserProfile(profileData) {
    return fetchClientAPI(C_API.USER_PROFILE_URL, { method: 'PUT', body: JSON.stringify(profileData) });
}

// --- Support Tickets ---
export async function submitNewTicket(ticketData) {
    return fetchClientAPI(C_API.SUPPORT_TICKETS_URL, { method: 'POST', body: JSON.stringify(ticketData) });
}
export async function submitTicketReply(ticketId, message) {
    return fetchClientAPI(`${C_API.SUPPORT_TICKETS_URL}/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ message }) });
}

// --- Billing ---
export async function submitPaymentProof(invoiceId, notes) {
    return fetchClientAPI(`${C_API.INVOICES_URL}/${invoiceId}/mark-paid`, { method: 'POST', body: JSON.stringify({ paymentNotes: notes }) });
}
