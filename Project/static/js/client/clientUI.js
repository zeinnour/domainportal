// Project/static/js/client/clientUI.js
import { createIcon, refreshLucideIcons } from '../common/iconUtils.js';
import { showMessage, initializeMessageBox as initCommonMessageBox } from '../common/messageBox.js';
import {
    openModal,
    closeModal,
    initializeModalCloseEvents,
    resetModalForm,
    showNotImplementedModal as commonShowNotImplementedModal
} from '../common/modalUtils.js';

// Imports for other client modules
import {
    initializeClientDashboard,
    loadDashboardData,
    updateDashboardStats,
    renderClientRecentActivity,
    updateDashboardAlerts
} from './clientDashboard.js';
import { initializeDomainTable, renderDomainsTable, updateBulkActionVisibility } from './clientDomainTable.js';
import { initializeDomainDetailPage, viewDomainDetails, setCurrentManagingDomainId } from './clientDomainDetail.js';
import { initializeDnsManagementModals, openAddDnsRecordModal } from './clientDnsManagement.js';
import { initializeRequestModals, openRegisterDomainModal, openRenewModalForClient, openTransferInModal, openTransferOutModal, openInternalTransferModal, openContactUpdateModalForClient } from './clientRequestModals.js';
import { initializeClientTicketSystem, fetchAndDisplayClientTickets, openSupportTicketModal, openClientTicketDetailModal } from './clientTicketManagement.js';
import { initializeClientBilling, renderBillingHistoryTable, openPaymentProofModal } from './clientBillingManagement.js';
import { initializeClientProfile, populateProfileView, toggleProfileEditMode } from './clientProfileManagement.js';
import * as API from './apiClientService.js';
import { formatDateDetailed, formatSimpleDate } from '../common/dateUtils.js'; // Corrected import


// --- Global Client UI State & Elements Cache ---
let currentUserData = null;
export const getCurrentUserData = () => currentUserData;
export const setCurrentUserData = (data) => { currentUserData = data; };

const clientElements = {
    sidebar: null,
    menuButton: null,
    pageTitle: null,
    welcomeUserText: null,
    navItems: [],
    sections: {},
    notImplementedModal: null,
    userAvatarImg: null,
    logoutLink: null,
    // For notifications (ensure these match your HTML)
    notificationBellButton: null,
    notificationDropdownPanel: null,
    notificationCountBadge: null,
    notificationItemsList: null,
    markAllNotificationsReadButton: null,
};

function cacheClientDOMElements() {
    clientElements.sidebar = document.getElementById('sidebar');
    clientElements.menuButton = document.getElementById('menu-button');
    clientElements.pageTitle = document.getElementById('page-title');
    clientElements.welcomeUserText = document.getElementById('welcome-user-text');
    clientElements.navItems = document.querySelectorAll('#sidebar .nav-item');
    clientElements.userAvatarImg = document.getElementById('user-avatar-img');
    clientElements.logoutLink = document.getElementById('logout-link');

    const sectionIds = ['dashboard-section', 'domains-section', 'profile-section', 'billing-section', 'support-section', 'domain-detail-section'];
    sectionIds.forEach(id => {
        clientElements.sections[id.replace('-section', '')] = document.getElementById(id);
    });
    clientElements.notImplementedModal = document.getElementById('not-implemented-modal');

    // Cache notification elements
    clientElements.notificationBellButton = document.getElementById('notification-bell-button');
    clientElements.notificationDropdownPanel = document.getElementById('notification-dropdown-panel');
    clientElements.notificationCountBadge = document.getElementById('notification-count-badge');
    clientElements.notificationItemsList = document.getElementById('notification-items-list');
    clientElements.markAllNotificationsReadButton = document.getElementById('mark-all-notifications-read-button');
}

export function initializeClientPanelUIFramework() {
    cacheClientDOMElements();
    initCommonMessageBox('message-box', 'message-text', 'close-message-box');
    setupBaseEventListeners();
    initializeCoreClientIcons();
    refreshLucideIcons();
}

function initializeCoreClientIcons() {
    if (typeof lucide !== 'undefined') {
        createIcon('dashboard-icon', 'LayoutDashboard', { class: 'mr-3 h-5 w-5 text-indigo-300 group-hover:text-white' });
        createIcon('domains-icon', 'Globe2', { class: 'mr-3 h-5 w-5 text-indigo-300 group-hover:text-white' });
        createIcon('profile-icon', 'UserCircle', { class: 'mr-3 h-5 w-5 text-indigo-300 group-hover:text-white' });
        createIcon('billing-icon', 'CreditCard', { class: 'mr-3 h-5 w-5 text-indigo-300 group-hover:text-white' });
        createIcon('support-icon', 'LifeBuoy', { class: 'mr-3 h-5 w-5 text-indigo-300 group-hover:text-white' });
        createIcon('logout-icon', 'LogOut', { class: 'mr-3 h-5 w-5 text-indigo-300 group-hover:text-white' });
        if(document.getElementById('menu-icon')) createIcon('menu-icon', 'Menu', { class: 'h-6 w-6' });
        if(document.getElementById('notification-bell-icon')) createIcon('notification-bell-icon', 'Bell', { class: 'h-6 w-6' });


        if(document.getElementById('total-domains-icon')) createIcon('total-domains-icon', 'Globe2', { class: 'h-6 w-6 text-indigo-500' });
        if(document.getElementById('active-domains-icon')) createIcon('active-domains-icon', 'CheckCircle', { class: 'h-6 w-6 text-green-500' });
        if(document.getElementById('expiring-soon-icon')) createIcon('expiring-soon-icon', 'AlertTriangle', { class: 'h-6 w-6 text-yellow-500' });
        if(document.getElementById('expired-domains-icon')) createIcon('expired-domains-icon', 'XCircle', { class: 'h-6 w-6 text-red-500' });
        if(document.getElementById('alerts-section-icon')) createIcon('alerts-section-icon', 'BellRing', { class: 'h-6 w-6 text-yellow-500 mr-3'});
        if(document.getElementById('register-domain-icon')) createIcon('register-domain-icon', 'PlusCircle', { class: 'h-5 w-5 mr-2' });
        if(document.getElementById('transfer-domain-icon')) createIcon('transfer-domain-icon', 'ArrowRightLeft', { class: 'h-5 w-5 mr-2' });
        if(document.getElementById('renew-all-icon')) createIcon('renew-all-icon', 'RefreshCw', { class: 'h-5 w-5 mr-2' });
        if(document.getElementById('open-ticket-icon')) createIcon('open-ticket-icon', 'MessageSquarePlus', { class: 'h-5 w-5 mr-2' });
        if(document.getElementById('back-arrow-icon')) createIcon('back-arrow-icon', 'ArrowLeft', { class: 'h-5 w-5 mr-2' });
        if(document.getElementById('renew-domain-detail-icon')) createIcon('renew-domain-detail-icon', 'RefreshCw', { class: 'h-5 w-5 mr-2' });
        if(document.getElementById('add-payment-icon')) createIcon('add-payment-icon', 'PlusCircle', { class: 'h-5 w-5 mr-1' });
        if(document.getElementById('create-ticket-icon')) createIcon('create-ticket-icon', 'MessageSquarePlus', { class: 'h-5 w-5 mr-2' });

        const modalCloseIconsMap = {
            'close-register-modal-icon': 'X', 'close-renew-modal-icon': 'X',
            'close-ticket-modal-icon': 'X', 'close-client-ticket-detail-modal-icon': 'X',
            'close-transfer-in-modal-icon': 'X', 'close-transfer-out-modal-icon': 'X',
            'close-internal-transfer-modal-icon': 'X',
            'close-add-dns-record-modal': 'X', 'close-edit-dns-record-modal': 'X',
            'close-confirm-delete-dns-record-modal': 'X',
            'close-contact-update-modal-icon': 'X',
            'close-not-implemented-modal-icon': 'X',
            'close-payment-proof-modal': 'X'
        };
        for (const id in modalCloseIconsMap) {
            if (document.getElementById(id)) {
                createIcon(id, modalCloseIconsMap[id], { class: 'h-6 w-6' });
            }
        }
        if(document.getElementById('dns-request-icon')) createIcon('dns-request-icon', 'Settings2', { class: 'h-5 w-5 mr-2' });
        if(document.getElementById('contact-update-icon')) createIcon('contact-update-icon', 'UserCog', { class: 'h-5 w-5 mr-2' });
        if(document.getElementById('domain-lock-icon')) createIcon('domain-lock-icon', 'Lock', { class: 'h-5 w-5 mr-2' });
    } else {
        console.warn("ClientUI: Lucide library not loaded. Icons may not render.");
    }
}

function setupBaseEventListeners() {
    if (clientElements.menuButton && clientElements.sidebar) {
        clientElements.menuButton.addEventListener('click', () => {
            clientElements.sidebar.classList.toggle('-translate-x-full');
        });
    }

    clientElements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.id === 'logout-link') return; // Logout link is handled by client_main.js
            e.preventDefault();
            const sectionId = item.id.split('nav-')[1];
            window.location.hash = sectionId; // THIS IS THE KEY CHANGE: Update hash on nav click
                                              // The hashchange listener in client_main.js will call showClientSection
        });
    });

    document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.hash = 'domains'; // Navigate to domains section by hash
        });
    });

    const backToDomainsButton = document.getElementById('back-to-domains');
    if (backToDomainsButton) {
        backToDomainsButton.addEventListener('click', () => {
            window.location.hash = 'domains'; // Navigate by hash
        });
    }

    const transferDropdownButton = document.getElementById('domain-transfer-dropdown-button');
    const transferDropdownContent = document.getElementById('domain-transfer-dropdown-content');
    if (transferDropdownButton && transferDropdownContent) {
        transferDropdownButton.addEventListener('click', (event) => {
            event.stopPropagation();
            transferDropdownContent.style.display = transferDropdownContent.style.display === 'block' ? 'none' : 'block';
        });
    }
    document.addEventListener('click', (event) => {
        if (transferDropdownContent && transferDropdownContent.style.display === 'block' &&
            !transferDropdownButton.contains(event.target) &&
            !transferDropdownContent.contains(event.target)) {
            transferDropdownContent.style.display = 'none';
        }
    });


    if(clientElements.notImplementedModal) {
        initializeModalCloseEvents('not-implemented-modal', 'close-not-implemented-modal-icon', 'ok-not-implemented-button');
    }

    document.body.addEventListener('click', function(event) {
        const target = event.target.closest('button, a');
        if (!target || !target.id) return;

        switch(target.id) {
            case 'open-register-domain-modal-button': openRegisterDomainModal(); break;
            case 'open-transfer-in-modal-button':
                event.preventDefault(); openTransferInModal();
                if(transferDropdownContent) transferDropdownContent.style.display = 'none';
                break;
            case 'open-transfer-out-modal-button':
                event.preventDefault(); openTransferOutModal();
                 if(transferDropdownContent) transferDropdownContent.style.display = 'none';
                break;
            case 'open-internal-transfer-modal-button':
                event.preventDefault(); openInternalTransferModal();
                 if(transferDropdownContent) transferDropdownContent.style.display = 'none';
                break;
            case 'open-support-ticket-modal-button':
            case 'open-new-support-ticket-modal-button':
                openSupportTicketModal();
                break;
            case 'add-payment-method-button':
                commonShowNotImplementedModal("Add Payment Method");
                break;
        }
    });
}

export function showClientSection(sectionName, isInitialLoad = false) {
    console.log("ClientUI: showClientSection now displaying:", sectionName, "Initial Load:", isInitialLoad);
    Object.values(clientElements.sections).forEach(section => {
        if (section) section.classList.add('hidden');
    });

    const targetSectionKey = sectionName.replace('-section', '');
    const targetSection = clientElements.sections[targetSectionKey];
    let title = sectionName.charAt(0).toUpperCase() + sectionName.slice(1).replace('Detail', ' Details');
    if (targetSectionKey === 'domainDetail') { // Handle cases like 'domainDetail-123'
        const parts = sectionName.split('-');
        if (parts.length > 1 && parts[0] === 'domainDetail' && !isNaN(parseInt(parts[1]))) {
            title = "Manage Domain";
            // setCurrentManagingDomainId(parseInt(parts[1])); // This should be handled by viewDomainDetails if called
        } else {
            title = "Manage Domain"; // Default for generic domainDetail
        }
    } else if (targetSectionKey === 'profile') {
        title = "User Profile";
    }


    if (targetSection) {
        targetSection.classList.remove('hidden');
        if (clientElements.pageTitle) clientElements.pageTitle.textContent = title;

        // Specific actions when a section is shown (especially if not initial load, or if data needs refresh)
        // The `isInitialLoad` flag helps differentiate between direct navigation and initial page setup.
        if (sectionName === 'dashboard' && getCurrentUserData()) { // Always load dashboard data if shown
            loadDashboardData();
        } else if (sectionName === 'domains') {
            renderDomainsTable();
        } else if (sectionName === 'support') {
            fetchAndDisplayClientTickets();
        } else if (sectionName === 'profile') {
            populateProfileView();
        } else if (sectionName === 'billing') {
            renderBillingHistoryTable();
        } else if (sectionName.startsWith('domainDetail-')) {
            const domainId = parseInt(sectionName.split('-')[1]);
            if (!isNaN(domainId)) {
                viewDomainDetails(domainId);
            }
        }

    } else {
        console.warn(`ClientUI: Section element for "${targetSectionKey}" (from "${sectionName}") not found. Defaulting to dashboard.`);
        const dashboardSec = clientElements.sections['dashboard'];
        if(dashboardSec) dashboardSec.classList.remove('hidden');
        if (clientElements.pageTitle) clientElements.pageTitle.textContent = "Dashboard";
        if (getCurrentUserData()) { // Load dashboard data if defaulting
             loadDashboardData();
        }
    }


    clientElements.navItems.forEach(item => item.classList.remove('active-nav'));
    // Make nav item active based on the section name, handling detail views
    let activeNavId = `nav-${targetSectionKey.startsWith('domainDetail') ? 'domains' : targetSectionKey}`;
    const activeNavItem = document.getElementById(activeNavId);
    if (activeNavItem) activeNavItem.classList.add('active-nav');

    if (window.innerWidth < 768 && clientElements.sidebar && !clientElements.sidebar.classList.contains('-translate-x-full')) {
        clientElements.sidebar.classList.add('-translate-x-full');
    }
    refreshLucideIcons();
}

export function updateUserWelcome(userData) {
    setCurrentUserData(userData);
    if (clientElements.welcomeUserText && userData) {
        clientElements.welcomeUserText.textContent = `Welcome, ${userData.name || userData.username}!`;
    }
}

export {
    createIcon as createClientIcon,
    showMessage,
    openModal,
    closeModal,
    initializeModalCloseEvents,
    resetModalForm,
    commonShowNotImplementedModal as showNotImplementedModal
};
// Removed re-export of formatDateDisplay and formatSimpleDate as they are directly imported where needed.
// export { formatDateDetailed, formatSimpleDate } from '../common/dateUtils.js'; // This line was causing the error
