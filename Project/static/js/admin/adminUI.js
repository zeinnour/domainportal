// Project/static/js/admin/adminUI.js

import { formatSimpleDate } from '../common/dateUtils.js';
import { createIcon as createAdminIcon, refreshLucideIcons } from '../common/iconUtils.js';
import { showMessage as showAdminMessage, initializeMessageBox } from '../common/messageBox.js';
import { openModal, closeModal, initializeModalCloseEvents, resetModalForm } from '../common/modalUtils.js';

// Import functions from feature modules ONLY if adminUI itself needs to trigger them directly
// Data loading is now primarily handled by admin_main.js in conjunction with showAdminSection
import { fetchAdminDashboardSummary, fetchRecentPendingOverview } from './adminDashboard.js';
import { fetchAndDisplayPendingItems } from './adminRequestManagement.js';
import { fetchAllAdminDomains, viewAdminDomainDetails } from './adminDomainManagement.js'; // Added viewAdminDomainDetails
import { fetchAllClients, viewClientDetails } from './adminClientManagement.js'; // Added viewClientDetails
import { fetchAllAdminSupportTickets } from './adminTicketManagement.js';
import { fetchAllAdminInvoices, populateInvoiceClientFilter } from './adminInvoiceManagement.js';

// --- Global Admin UI State ---
let currentAdminUsername = 'Admin';
export const getAdminUsername = () => currentAdminUsername;

// --- DOM Elements Cache ---
const adminElements = {
    sidebar: null, menuButton: null, pageTitle: null, usernameDisplay: null, logoutLink: null,
    navItems: [], sections: {},
    adminNotesModal: null, adminNotesForm: null, adminNotesModalTitle: null,
    adminNoteTextEl: null, adminNotesRequestIdEl: null, adminNotesRequestTypeEl: null,
    adminNotesActionEl: null, eppCodeInputContainer: null, adminEppCodeTextEl: null,
    // Notification elements for admin
    adminNotificationBellButton: null,
    adminNotificationDropdownPanel: null,
    adminNotificationCountBadge: null,
    adminNotificationItemsList: null,
    adminMarkAllNotificationsReadButton: null,
};

function cacheAdminDOMElements() {
    adminElements.sidebar = document.getElementById('admin-sidebar');
    adminElements.menuButton = document.getElementById('admin-menu-button');
    adminElements.pageTitle = document.getElementById('admin-page-title');
    adminElements.usernameDisplay = document.getElementById('admin-username-display');
    adminElements.logoutLink = document.getElementById('admin-logout-link');
    adminElements.navItems = document.querySelectorAll('#admin-sidebar .nav-item');
    const sectionIds = [
        'admin-dashboard-section', 'pending-requests-section', 'all-domains-section',
        'all-clients-section', 'admin-billing-section', 'support-tickets-admin-section',
        'client-detail-admin-section', 'admin-domain-detail-section'
    ];
    sectionIds.forEach(id => {
        adminElements.sections[id.replace('-section', '')] = document.getElementById(id);
    });

    adminElements.adminNotesModal = document.getElementById('admin-notes-modal');
    adminElements.adminNotesForm = document.getElementById('admin-notes-form');
    adminElements.adminNotesModalTitle = document.getElementById('admin-notes-modal-title');
    adminElements.adminNoteTextEl = document.getElementById('adminNoteText');
    adminElements.adminNotesRequestIdEl = document.getElementById('adminNotesRequestId');
    adminElements.adminNotesRequestTypeEl = document.getElementById('adminNotesRequestType');
    adminElements.adminNotesActionEl = document.getElementById('adminNotesAction');
    adminElements.eppCodeInputContainer = document.getElementById('epp-code-input-container');
    adminElements.adminEppCodeTextEl = document.getElementById('adminEppCodeText');

    // Cache admin notification elements
    adminElements.adminNotificationBellButton = document.getElementById('admin-notification-bell-button');
    adminElements.adminNotificationDropdownPanel = document.getElementById('admin-notification-dropdown-panel');
    adminElements.adminNotificationCountBadge = document.getElementById('admin-notification-count-badge');
    adminElements.adminNotificationItemsList = document.getElementById('admin-notification-items-list');
    adminElements.adminMarkAllNotificationsReadButton = document.getElementById('admin-mark-all-notifications-read-button');

    console.log("AdminUI: DOM Elements Cached.");
}

export function initializeAdminPanelUI() {
    cacheAdminDOMElements();
    setupEventListeners();
    initializeCoreAdminIcons();
    if (adminElements.adminNotesModal) {
        initializeModalCloseEvents('admin-notes-modal', 'close-admin-notes-modal-icon');
    } else {
        console.warn("AdminUI: Admin Notes Modal itself ('admin-notes-modal') not found during init.");
    }
}

function initializeCoreAdminIcons() {
     if (typeof lucide !== 'undefined') {
            try {
                createAdminIcon('admin-dashboard-icon', 'LayoutDashboard', { class: 'mr-3 h-5 w-5' });
                createAdminIcon('pending-requests-icon', 'ListChecks', { class: 'mr-3 h-5 w-5' });
                createAdminIcon('all-domains-admin-icon', 'Globe2', { class: 'mr-3 h-5 w-5' });
                createAdminIcon('all-clients-icon', 'Users', { class: 'mr-3 h-5 w-5' });
                createAdminIcon('admin-billing-icon', 'CreditCard', { class: 'mr-3 h-5 w-5' });
                createAdminIcon('support-tickets-admin-icon', 'MessageSquareWarning', { class: 'mr-3 h-5 w-5' });
                createAdminIcon('admin-logout-icon', 'LogOut', { class: 'mr-3 h-5 w-5' });
                createAdminIcon('admin-menu-icon', 'Menu', { class: 'h-6 w-6' });
                if(document.getElementById('admin-notification-bell-icon')) createAdminIcon('admin-notification-bell-icon', 'Bell', { class: 'h-6 w-6' });


                if(document.getElementById('close-admin-notes-modal-icon')) createAdminIcon('close-admin-notes-modal-icon', 'X', { class: 'h-6 w-6' });
                if(document.getElementById('close-ticket-detail-modal-icon')) createAdminIcon('close-ticket-detail-modal-icon', 'X', { class: 'h-6 w-6'});
                if(document.getElementById('close-create-client-modal-icon')) createAdminIcon('close-create-client-modal-icon', 'X', {class: 'h-6 w-6'});
                if(document.getElementById('close-edit-client-modal-icon')) createAdminIcon('close-edit-client-modal-icon', 'X', {class: 'h-6 w-6'});
                if(document.getElementById('close-reassign-domain-modal-icon')) createAdminIcon('close-reassign-domain-modal-icon', 'X', {class: 'h-6 w-6'});
                if(document.getElementById('close-create-invoice-modal')) createAdminIcon('close-create-invoice-modal','X', {class: 'h-6 w-6'});
                if(document.getElementById('close-view-invoice-detail-modal')) createAdminIcon('close-view-invoice-detail-modal','X', {class: 'h-6 w-6'});
                if(document.getElementById('back-arrow-clients-icon')) createAdminIcon('back-arrow-clients-icon', 'ArrowLeft', {class: 'h-5 w-5 mr-2'});
                if(document.getElementById('back-arrow-domains-icon')) createAdminIcon('back-arrow-domains-icon', 'ArrowLeft', {class: 'h-5 w-5 mr-2'});
                if(document.getElementById('create-client-icon')) createAdminIcon('create-client-icon', 'UserPlus', {class: 'mr-2 h-5 w-5'});
                if(document.getElementById('edit-client-detail-icon')) createAdminIcon('edit-client-detail-icon', 'FilePenLine', {class: 'mr-2 h-4 w-4'});
                if(document.getElementById('filter-icon')) createAdminIcon('filter-icon', 'Filter', {class: 'mr-2 h-4 w-4'});
                if(document.getElementById('clear-filter-icon')) createAdminIcon('clear-filter-icon', 'XCircle', {class: 'mr-2 h-4 w-4'});
                if(document.getElementById('toggle-client-active-detail-icon')) createAdminIcon('toggle-client-active-detail-icon', 'ToggleRight', {class: 'mr-2 h-4 w-4'});
            } catch (iconError) {
                console.error("Error creating one or more lucide icons in adminUI:", iconError);
            }
        }
    refreshLucideIcons();
}

function setupEventListeners() {
    if (adminElements.menuButton && adminElements.sidebar) {
        adminElements.menuButton.addEventListener('click', () => {
            adminElements.sidebar.classList.toggle('-translate-x-full');
        });
    }
    adminElements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.id === 'admin-logout-link') return; // Logout link is handled by admin_main.js
            e.preventDefault();
            const sectionId = item.id.split('nav-')[1];
            window.location.hash = sectionId; // Update hash on nav click
                                              // The hashchange listener in admin_main.js will call showAdminSection
        });
    });
    const backToClientsBtn = document.getElementById('back-to-clients-list-button');
    if (backToClientsBtn) backToClientsBtn.addEventListener('click', () => { window.location.hash = 'all-clients'; });

    const backToDomainsBtn = document.getElementById('back-to-all-domains-button');
    if (backToDomainsBtn) backToDomainsBtn.addEventListener('click', () => { window.location.hash = 'all-domains'; });
}

export function showAdminSection(sectionKey, isInitialLoad = false) {
    console.log("AdminUI: showAdminSection called for:", sectionKey, "Initial Load:", isInitialLoad);
    Object.values(adminElements.sections).forEach(section => {
        if (section) section.classList.add('hidden');
    });

    // Handle complex section keys like client-detail-admin-123
    let baseSectionKey = sectionKey;
    let detailId = null;
    if (sectionKey.includes('-detail-admin-') || sectionKey.includes('-domain-detail-')) {
        const parts = sectionKey.split('-');
        baseSectionKey = parts.slice(0, parts.length -1).join('-'); // e.g., client-detail-admin
        detailId = parts.pop();
    }


    const targetSection = adminElements.sections[baseSectionKey.replace('-section', '')]; // Use baseSectionKey for lookup
    let pageTitleText = "Admin Panel";

    if (targetSection) {
        targetSection.classList.remove('hidden');
        const navItemForSection = document.getElementById(`nav-${baseSectionKey.replace('-admin', '').replace('-detail','')}`);
        pageTitleText = navItemForSection ? navItemForSection.textContent.trim() : "Admin Panel";

        // If it's a detail view, the title might be set by the specific detail loading function
        if (baseSectionKey.includes('-detail-')) {
             pageTitleText = adminElements.pageTitle?.textContent || pageTitleText; // Keep existing if set by detail loader
        }


        // Data loading logic for sections
        // For initialLoad = true, admin_main.js calls showAdminSection with the determined initial section.
        // Data for that specific section should be loaded here.
        // For subsequent navigations (isInitialLoad = false), this function is called by hashchange,
        // so we also load data here.
        switch (baseSectionKey) { // Use baseSectionKey for switch
            case 'admin-dashboard':
                fetchAdminDashboardSummary();
                fetchRecentPendingOverview();
                break;
            case 'pending-requests':
                // The active tab click handler in initializePendingRequestsTabs will fetch data
                // Ensure the correct tab is clicked if navigating directly via hash
                if (isInitialLoad || window.location.hash.includes('pending-requests')) { // Check if this section is explicitly targeted
                    const firstTabButton = document.querySelector('#pending-requests-section .tab-button.active') || document.querySelector('#pending-requests-section .tab-button');
                    if (firstTabButton && typeof firstTabButton.click === 'function') {
                         if (!firstTabButton.dataset.alreadyLoadedByNav) { // Avoid re-clicking if already handled
                            firstTabButton.click();
                            firstTabButton.dataset.alreadyLoadedByNav = "true"; // Mark as loaded by this nav action
                         }
                    }
                }
                break;
            case 'all-domains': fetchAllAdminDomains(); break;
            case 'all-clients': fetchAllClients(); break;
            case 'admin-billing': fetchAllAdminInvoices(); populateInvoiceClientFilter(); break;
            case 'support-tickets-admin': fetchAllAdminSupportTickets(); break;
            case 'client-detail-admin':
                if (detailId) viewClientDetails(detailId); // Call function to load client details
                else fetchAllClients(); // Fallback if no ID (though should have ID for detail)
                break;
            case 'admin-domain-detail':
                if (detailId) viewAdminDomainDetails(detailId); // Call function to load domain details
                else fetchAllAdminDomains(); // Fallback
                break;
        }
    } else {
        console.warn(`AdminUI: Section with base key "${baseSectionKey}" (from "${sectionKey}") not found. Showing dashboard.`);
        const dashboardSec = adminElements.sections['admin-dashboard'];
        if(dashboardSec) dashboardSec.classList.remove('hidden');
        pageTitleText = "Dashboard";
        fetchAdminDashboardSummary(); // Load dashboard data if defaulting
        fetchRecentPendingOverview();
    }

    if (adminElements.pageTitle) adminElements.pageTitle.textContent = pageTitleText;
    adminElements.navItems.forEach(nav => nav.classList.remove('active-admin-nav'));
    let activeNavId = `nav-${baseSectionKey}`; // Use baseSectionKey for active nav
    if (baseSectionKey === 'client-detail-admin') activeNavId = 'nav-all-clients';
    if (baseSectionKey === 'admin-domain-detail') activeNavId = 'nav-all-domains';

    const activeNavItem = document.getElementById(activeNavId);
    if(activeNavItem) activeNavItem.classList.add('active-admin-nav');

    if (window.innerWidth < 768 && adminElements.sidebar && !adminElements.sidebar.classList.contains('-translate-x-full')) {
        adminElements.sidebar.classList.add('-translate-x-full');
    }
    refreshLucideIcons();
}

export function updateAdminUserDisplay(username) {
    currentAdminUsername = username;
    if (adminElements.usernameDisplay) {
        adminElements.usernameDisplay.textContent = username;
    }
}

export function getAdminPageElement(elementName) {
    if (!adminElements.sidebar && Object.keys(adminElements.sections).length === 0) {
        console.warn("AdminUI: getAdminPageElement called before initial cache. Forcing re-cache.");
        cacheAdminDOMElements();
    }
    return adminElements[elementName] || document.getElementById(elementName);
}

export function internalRequestTypeForCardId(type) {
    return type ? type.toLowerCase().replace(/_/g, '-') : 'unknown';
}

export function renderRequestCard(request, isOverviewCard = false) {
    let detailsHtml = '';
    let title = '';
    let actionButtonsHtml = '';
    const requesterInfo = request.requester_username ? `<p><strong>Client:</strong> ${request.requester_username} (ID: ${request.userId})</p>` : (request.userId ? `<p><strong>User ID:</strong> ${request.userId}</p>`: '');
    const dataSummary = request.dataSummary || {};
    const internalReqType = internalRequestTypeForCardId(request.requestType);
    const cardId = `request-card-${isOverviewCard ? 'overview-' : ''}${internalReqType}-${request.id}`;

    switch (internalReqType) {
        case 'register':
            title = `Register: ${request.domainName}`;
            detailsHtml = `${requesterInfo}<p><strong>Duration:</strong> ${dataSummary.duration || 'N/A'} year(s)</p><p><strong>SSL:</strong> ${dataSummary.ssl_requested ? `Yes (${dataSummary.ssl_duration || 'N/A'} yr)` : 'No'}</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="register" data-action="Approved" class="btn btn-sm btn-success">Approve</button> <button data-id="${request.id}" data-type="register" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button>`;
            }
            break;
        case 'renew':
            title = `Renew: ${request.domainName}`;
            detailsHtml = `${requesterInfo}<p><strong>Duration:</strong> ${dataSummary.duration || 'N/A'} year(s)</p><p><strong>SSL:</strong> ${dataSummary.ssl_requested ? `Yes (${dataSummary.ssl_duration || 'N/A'} yr)` : 'No'}</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="renew" data-action="Approved" class="btn btn-sm btn-success">Approve</button> <button data-id="${request.id}" data-type="renew" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button>`;
            }
            break;
        case 'auto-renew-change':
            title = `Auto-Renew: ${request.domainName}`;
            const requestedStatusText = dataSummary.requested_status === true ? 'Enable' : (dataSummary.requested_status === false ? 'Disable' : 'Unknown');
            detailsHtml = `${requesterInfo}<p><strong>Request to:</strong> ${requestedStatusText} Auto-Renew</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="auto_renew_change" data-action="Approved" class="btn btn-sm btn-success">Approve</button> <button data-id="${request.id}" data-type="auto_renew_change" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button>`;
            }
            break;
        case 'lock-change':
            title = `Domain Lock: ${request.domainName}`;
            const requestedLockStatusText = dataSummary.requested_lock_status === true ? 'Lock Domain' : (dataSummary.requested_lock_status === false ? 'Unlock Domain' : 'Unknown State');
            detailsHtml = `${requesterInfo}<p><strong>Request to:</strong> ${requestedLockStatusText}</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="lock_change" data-action="Approved" class="btn btn-sm btn-success">Approve</button> <button data-id="${request.id}" data-type="lock_change" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button>`;
            }
            break;
        case 'transfer-in':
            title = `Transfer-In: ${request.domainName}`;
            detailsHtml = `${requesterInfo}<p><strong>Auth Code:</strong> ${dataSummary.auth_code_provided ? 'Provided by client' : 'Not Provided by client'}</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="transfer_in" data-action="Processing" class="btn btn-sm btn-info">Start Transfer</button> <button data-id="${request.id}" data-type="transfer_in" data-action="Info Requested" class="btn btn-sm btn-warning">Request Info</button> <button data-id="${request.id}" data-type="transfer_in" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button>`;
            } else if (request.status === 'Processing' || request.status === 'Info Requested') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="transfer_in" data-action="Completed" class="btn btn-sm btn-success">Mark Completed</button> <button data-id="${request.id}" data-type="transfer_in" data-action="Failed" class="btn btn-sm btn-danger">Mark Failed</button>`;
                if (request.status === 'Info Requested') actionButtonsHtml += ` <button data-id="${request.id}" data-type="transfer_in" data-action="Processing" class="btn btn-sm btn-info">Resume Processing</button>`;
            }
            break;
        case 'transfer-out':
            title = `Transfer-Out: ${request.domainName}`;
            detailsHtml = `${requesterInfo}
                <p><strong>Destination:</strong> ${dataSummary.destination_info || 'N/A'}</p>
                <p><strong>Reason:</strong> ${dataSummary.reason || 'N/A'}</p>
                <p><strong>EPP Sent:</strong> ${request.status === 'EPP Code Sent' || dataSummary.epp_code_provided ? 'Yes' : 'No'}</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending' || request.status === 'Awaiting Client Action') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="transfer_out" data-action="EPP Code Sent" class="btn btn-sm btn-info">Send EPP</button> <button data-id="${request.id}" data-type="transfer_out" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button>`;
            } else if (request.status === 'EPP Code Sent') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="transfer_out" data-action="Completed" class="btn btn-sm btn-success">Mark Transferred</button> <button data-id="${request.id}" data-type="transfer_out" data-action="Cancelled by Client" class="btn btn-sm btn-warning">Client Cancelled</button>`;
            }
            break;
        case 'internal-transfer-request':
            title = `Internal Transfer: ${dataSummary.domain_name || 'N/A'}`;
            detailsHtml = `
                <p><strong>Domain:</strong> ${dataSummary.domain_name || 'N/A'}</p>
                <p><strong>From Client:</strong> ${dataSummary.current_owner_username || 'N/A'} (ID: ${request.userId})</p>
                <p><strong>To Client (Identifier):</strong> ${dataSummary.target_client_identifier || 'N/A'}</p>
                <p><strong>To Client (Resolved):</strong> ${dataSummary.target_client_name || 'N/A'} (ID: ${request.requestedData?.target_client_id || 'N/A'})</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="internal_transfer_request" data-action="Approved" class="btn btn-sm btn-success">Approve</button> <button data-id="${request.id}" data-type="internal_transfer_request" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button>`;
            }
            break;
        case 'dns-change':
            title = `DNS Change: ${request.domainName}`;
            detailsHtml = `${requesterInfo}<p class="whitespace-pre-wrap"><strong>Description:</strong><br>${dataSummary.change_description || 'N/A'}</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending' || request.status === 'Needs Info') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="dns_change" data-action="Processing" class="btn btn-sm btn-info">Process</button> <button data-id="${request.id}" data-type="dns_change" data-action="Completed" class="btn btn-sm btn-success">Complete</button> <button data-id="${request.id}" data-type="dns_change" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button> ${request.status !== 'Needs Info' ? `<button data-id="${request.id}" data-type="dns_change" data-action="Needs Info" class="btn btn-sm btn-warning">Needs Info</button>` : ''}`;
            } else if (request.status === 'Processing') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="dns_change" data-action="Completed" class="btn btn-sm btn-success">Mark Completed</button> <button data-id="${request.id}" data-type="dns_change" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button>`;
            }
            break;
        case 'contact-update':
            title = `Contact Update: ${request.domainName}`;
            detailsHtml = `${requesterInfo}<p class="whitespace-pre-wrap"><strong>Changes:</strong><br>${dataSummary.changes_description || 'N/A'}</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending' || request.status === 'Needs Clarification') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="contact_update" data-action="Processing" class="btn btn-sm btn-info">Process</button> <button data-id="${request.id}" data-type="contact_update" data-action="Completed" class="btn btn-sm btn-success">Complete</button> <button data-id="${request.id}" data-type="contact_update" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button> ${request.status !== 'Needs Clarification' ? `<button data-id="${request.id}" data-type="contact_update" data-action="Needs Clarification" class="btn btn-sm btn-warning">Needs Clarification</button>` : ''}`;
            } else if (request.status === 'Processing') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="contact_update" data-action="Completed" class="btn btn-sm btn-success">Mark Completed</button> <button data-id="${request.id}" data-type="contact_update" data-action="Rejected" class="btn btn-sm btn-danger">Reject</button>`;
            }
            break;
        case 'support-ticket':
            title = `Ticket: ${request.subject || `ID ${request.id}`}`;
            detailsHtml = `${requesterInfo}
                ${request.relatedDomainName ? `<p class="text-xs"><strong>Related Domain:</strong> ${request.relatedDomainName}</p>` : ''}
                <p class="text-sm truncate mt-1">${request.message ? request.message.substring(0,80) + '...' : 'No message preview.'}</p>
            `;
            actionButtonsHtml = `<button data-id="${request.id}" data-type="support-ticket" data-action="view-ticket" class="btn btn-sm btn-info">View Ticket</button>`;
            break;
        case 'payment-proof':
            title = `Payment Proof: Invoice ${dataSummary.invoice_number || 'N/A'}`;
            detailsHtml = `${requesterInfo}
                <p><strong>Invoice Amount:</strong> $${parseFloat(dataSummary.invoice_amount || 0).toFixed(2)}</p>
                <p class="whitespace-pre-wrap"><strong>Client Notes:</strong><br>${dataSummary.payment_notes || 'N/A'}</p>`;
            if (request.status === 'Pending Admin Approval' || request.status === 'Pending') {
                actionButtonsHtml = `<button data-id="${request.id}" data-type="payment_proof" data-action="Approved" class="btn btn-sm btn-success">Approve Payment</button> <button data-id="${request.id}" data-type="payment_proof" data-action="Rejected" class="btn btn-sm btn-danger">Reject Proof</button>`;
            }
            break;
        default:
            console.warn("Unknown request type for card rendering:", internalReqType, request);
            title = `Unknown Request: ${request.domainName || request.subject || `ID ${request.id}`}`;
            detailsHtml = requesterInfo;
    }

    const card = document.createElement('div');
    card.className = 'request-card';
    card.id = cardId;
    if(isOverviewCard) card.classList.add('request-card-overview');

    let statusClass = 'status-badge ';
    const normalizedStatus = request.status ? request.status.toLowerCase().replace(/\s+/g, '-') : 'unknown';
    statusClass += `status-${normalizedStatus}`;

    card.innerHTML = `
        <h3>${title}</h3>
        ${detailsHtml}
        <p><strong>Requested:</strong> ${formatSimpleDate(request.requestDate)}</p>
        <p><strong>Status:</strong> <span class="${statusClass}">${request.status}</span></p>
        ${request.admin_notes ? `<p class="mt-1 text-xs text-gray-500"><strong>Admin Notes:</strong> ${request.admin_notes}</p>` : ''}
        <div class="actions mt-4 pt-3 border-t border-gray-700 space-x-2">
            ${actionButtonsHtml}
        </div>
    `;
    return card;
}

export function showAdminNotesModal(requestId, requestType, action, currentNotes = '') {
    const modal = getAdminPageElement('adminNotesModal');
    const modalTitle = getAdminPageElement('adminNotesModalTitle');
    const noteTextEl = getAdminPageElement('adminNoteText');
    const requestIdEl = getAdminPageElement('adminNotesRequestId');
    const requestTypeEl = getAdminPageElement('adminNotesRequestType');
    const actionEl = getAdminPageElement('adminNotesAction');
    const eppCodeContainer = getAdminPageElement('eppCodeInputContainer');
    const eppCodeTextEl = getAdminPageElement('adminEppCodeText');


    if (!modal || !modalTitle || !noteTextEl || !requestIdEl || !requestTypeEl || !actionEl || !eppCodeContainer || !eppCodeTextEl) {
        console.error("AdminUI: Admin Notes Modal elements problem.", {
            modal, modalTitle, noteTextEl, requestIdEl, requestTypeEl, actionEl, eppCodeContainer, eppCodeTextEl
        });
        showAdminMessage("Error: Cannot open admin notes modal. Required elements missing.", "error");
        return;
    }

    requestIdEl.value = requestId;
    requestTypeEl.value = requestType;
    actionEl.value = action;
    noteTextEl.value = currentNotes;
    modalTitle.textContent = `Notes for ${action.replace(/_/g, ' ')} (${requestType.replace(/_/g, ' ').replace('-', ' ')} ID: ${requestId})`;

    eppCodeContainer.classList.add('hidden');
    if (requestType === 'transfer_out' && action === 'EPP Code Sent') {
        eppCodeContainer.classList.remove('hidden');
        eppCodeTextEl.value = '';
    }
    openModal(modal);
}

export { openModal, closeModal, resetModalForm, createAdminIcon };
