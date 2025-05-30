// Project/static/js/client/client_main.js
import { initializeClientPanelUIFramework, showClientSection, updateUserWelcome, setCurrentUserData, getCurrentUserData } from './clientUI.js';
import { initializeMessageBox, showMessage, hideMessage } from '../common/messageBox.js';
import { refreshLucideIcons } from '../common/iconUtils.js';
import * as API from './apiClientService.js';
import { initializeNotificationSystem } from '../common/notificationHandler.js';

// Feature module initializers and specific functions.
import { initializeClientDashboard, loadDashboardData } from './clientDashboard.js';
import { initializeDomainTable, renderDomainsTable } from './clientDomainTable.js';
import {
    initializeDomainDetailPage,
    setClientDomainsData,
    setPendingLockRequests,
    setPendingDnsRequests,
    setPendingAutoRenewRequests,
    viewDomainDetails,
    getCurrentManagingDomainId
} from './clientDomainDetail.js';
import { initializeDnsManagementModals } from './clientDnsManagement.js';
import { initializeRequestModals } from './clientRequestModals.js';
import { initializeClientTicketSystem, fetchAndDisplayClientTickets, setAllClientTicketsCache } from './clientTicketManagement.js';
import { initializeClientBilling, renderBillingHistoryTable, setClientInvoicesCache, setPendingPaymentProofsCache } from './clientBillingManagement.js';
import { initializeClientProfile, populateProfileView } from './clientProfileManagement.js';
import { initializeDomainSuggestionTool } from './domainSuggestionTool.js'; // Added import

let initialLoadComplete = false;

export async function fetchAllClientData(sectionToDisplay = null) {
    console.log("fetchAllClientData called for section:", sectionToDisplay);
    if (!getCurrentUserData()) {
        console.warn("User data not available. Skipping fetchAllClientData.");
        return;
    }
    try {
        const [
            domainsData,
            clientAlertCounts,
            ticketsData,
            pendingLockData,
            invoicesData,
            pendingDnsData,
            recentActivityData,
        ] = await Promise.all([
            API.fetchClientDomains(),
            API.fetchPendingRequestCounts().catch(() => ({})),
            API.fetchClientTickets(),
            API.fetchPendingLockRequests(),
            API.fetchClientInvoices(),
            API.fetchPendingDnsRequests(),
            API.fetchClientRecentActivity().catch(() => ([])),
        ]);

        setClientDomainsData(Array.isArray(domainsData) ? domainsData : []);
        setAllClientTicketsCache(Array.isArray(ticketsData) ? ticketsData : []);
        setPendingLockRequests(Array.isArray(pendingLockData) ? pendingLockData : []);
        setClientInvoicesCache(Array.isArray(invoicesData) ? invoicesData : []);
        setPendingDnsRequests(Array.isArray(pendingDnsData) ? pendingDnsData : []);
        setPendingPaymentProofsCache([]); // Placeholder

        const allDomainRequests = []; // Placeholder
        const autoRenewReqs = allDomainRequests.filter(req => req.requestType === 'auto_renew_change' && req.status === 'Pending Admin Approval');
        setPendingAutoRenewRequests(autoRenewReqs);

        // Determine which section to show after data load
        let finalSectionToShow = 'dashboard'; // Default to dashboard

        if (sectionToDisplay) { // If a section was explicitly requested (e.g., from hash)
            finalSectionToShow = sectionToDisplay;
        } else if (window.location.hash) { // Check hash on initial load if no explicit section
            const hashSection = window.location.hash.substring(1);
            // Basic validation: ensure it's one of our known sections (without '-section' suffix)
            const knownSections = ['dashboard', 'domains', 'profile', 'billing', 'support', 'domainDetail'];
            if (knownSections.includes(hashSection)) {
                finalSectionToShow = hashSection;
            }
        }
        
        console.log("Final section to show after data fetch:", finalSectionToShow);
        showClientSection(finalSectionToShow, true); // Pass true for isInitialLoad

        // Conditionally load data for the section being shown if it's not the default dashboard
        // The showClientSection will call loadDashboardData if finalSectionToShow is 'dashboard'
        // For other sections, we might need to explicitly call their data loading/rendering functions here
        // if they weren't already covered by showClientSection's internal logic for isInitialLoad=false.
        // However, showClientSection in clientUI.js already has logic to call specific render functions
        // when isInitialLoad is false. For initial load, we rely on it showing the correct section,
        // and subsequent navigations will trigger the specific data loads.

        // The key is that showClientSection is now called with the correct section determined from hash or default.

    } catch (error) {
        console.error("Client Panel: Error in fetchAllClientData:", error);
        showMessage(`Error loading portal data: ${error.message}. Please try refreshing.`, "error");
        // Error display for tables
        const domainsTableBody = document.getElementById('domains-table-body');
        if(domainsTableBody) domainsTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">Error loading domains.</td></tr>`;
        const billingHistoryTableBody = document.getElementById('billing-history-table-body');
        if(billingHistoryTableBody) billingHistoryTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">Error loading invoices.</td></tr>`;
    }
}


async function checkAuthAndInitialize() {
    if (initialLoadComplete) {
        console.warn("checkAuthAndInitialize: Initial load already complete. Skipping.");
        return;
    }
    console.log("checkAuthAndInitialize called for the first time.");
    hideMessage();

    try {
        const authData = await API.checkAuthStatus();
        if (authData.logged_in === true && authData.user) {
            console.log("User is logged in. User data:", authData.user);
            setCurrentUserData(authData.user);
            updateUserWelcome(authData.user);
            initializeClientPanelUIFramework();

            // Initialize feature-specific modules
            initializeClientDashboard();
            initializeDomainTable();
            initializeDomainDetailPage();
            initializeDnsManagementModals();
            initializeRequestModals();
            initializeClientTicketSystem();
            initializeClientBilling();
            initializeClientProfile();
            initializeDomainSuggestionTool(); // Added initialization

            initializeNotificationSystem(
                'notification-bell-button',
                'notification-bell-icon',
                'notification-dropdown-panel',
                'notification-count-badge',
                'notification-items-list',
                'mark-all-notifications-read-button',
                'view-all-notifications-link'
            );

            // Determine initial section from URL hash, or default to dashboard
            let initialSection = 'dashboard';
            if (window.location.hash) {
                const hashSection = window.location.hash.substring(1);
                const knownSections = ['dashboard', 'domains', 'profile', 'billing', 'support', 'domainDetail'];
                 // Also check for sections like 'domainDetail-123' if that's a pattern
                const baseHashSection = hashSection.split('-')[0]; // e.g. 'domainDetail' from 'domainDetail-123'
                if (knownSections.includes(hashSection) || knownSections.includes(baseHashSection)) {
                    initialSection = hashSection; // Use full hash if it's complex (like domainDetail-ID)
                }
            }
            console.log("Initial section to load:", initialSection);
            await fetchAllClientData(initialSection); // Pass the determined section

            initialLoadComplete = true;
            console.log("Client panel initial load complete.");
        } else {
            showMessage("Your session may have expired. Please log in.", "error");
            window.location.href = '/login';
        }
    } catch (error) {
        showMessage("A critical error occurred during session check. Please try logging in.", "error");
        console.error("Session check error:", error);
        window.location.href = '/login';
    }
}

function setupGlobalEventListeners() {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await API.logoutUser();
                showMessage("Logout successful.", "success");
                setCurrentUserData(null);
                window.location.href = '/login';
            } catch (error) {
                showMessage(error.message || "Logout failed.", "error");
            }
        });
    }
    const renewSelectedBtn = document.getElementById('renew-selected-domains-button');
    if (renewSelectedBtn) {
        renewSelectedBtn.addEventListener('click', () => {
            showClientSection('domains');
            showMessage("Please select domains from the list below to renew using the 'Renew Selected' button above the table.", "info");
        });
    }

    // Listen for hash changes to update the section (for back/forward browser buttons)
    window.addEventListener('hashchange', () => {
        if (initialLoadComplete) { // Only if initial load is done
            let sectionFromHash = window.location.hash.substring(1);
            if (!sectionFromHash) {
                sectionFromHash = 'dashboard'; // Default to dashboard if hash is empty
            }
            console.log("Hash changed to:", sectionFromHash);
            showClientSection(sectionFromHash);
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("Client Panel Main Script Loaded (Modular)");
    initializeMessageBox('message-box', 'message-text', 'close-message-box');
    refreshLucideIcons();
    checkAuthAndInitialize();
    setupGlobalEventListeners();
});

