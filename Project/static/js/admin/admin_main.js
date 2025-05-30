// Project/static/js/admin/admin_main.js
import { initializeMessageBox, showMessage as showAdminMessage } from '../common/messageBox.js';
import { refreshLucideIcons } from '../common/iconUtils.js';
import { initializeAdminPanelUI, updateAdminUserDisplay, getAdminPageElement, showAdminSection } from './adminUI.js';
import { checkAuthStatus, logoutUser } from './apiAdminService.js';
import { initializeNotificationSystem } from '../common/notificationHandler.js';

// Import initializers from feature modules
import { initializeAdminDashboard, fetchAdminDashboardSummary, fetchRecentPendingOverview } from './adminDashboard.js';
import { initializePendingRequestsTabs, handleAdminNotesFormSubmit, handleSkipAdminNotes } from './adminRequestManagement.js';
import { initializeDomainManagement } from './adminDomainManagement.js';
import { initializeClientManagement, initializeCreateClientModal, initializeEditClientModal } from './adminClientManagement.js';
import { initializeAdminTicketSystem } from './adminTicketManagement.js';
import { initializeAdminBilling, initializeInvoiceFilters, initializeCreateInvoiceModalAdmin, initializeViewInvoiceDetailModalAdmin } from './adminInvoiceManagement.js';

let adminInitialLoadComplete = false; // Use a different variable name to avoid conflict if both scripts were ever on the same page (unlikely here)

async function verifyAdminSessionAndLoadMain() {
    console.log("AdminMain: Verifying admin session with backend...");
    try {
        const verificationData = await checkAuthStatus();
        console.log("AdminMain: Admin session verified by backend:", verificationData);

        if (!verificationData.logged_in || !verificationData.user || verificationData.user.role !== 'admin') {
            console.error("AdminMain: User not logged in as admin. Role:", verificationData.user ? verificationData.user.role : "N/A");
            window.location.href = '/login';
            return;
        }

        updateAdminUserDisplay(verificationData.user.username);
        initializeAdminPanelUI();

        initializeNotificationSystem(
            'admin-notification-bell-button',
            'admin-notification-bell-icon',
            'admin-notification-dropdown-panel',
            'admin-notification-count-badge',
            'admin-notification-items-list',
            'admin-mark-all-notifications-read-button',
            'admin-view-all-notifications-link'
        );

        initializeAdminDashboard();
        initializePendingRequestsTabs();
        initializeDomainManagement();
        initializeClientManagement();
        initializeAdminTicketSystem();
        initializeAdminBilling();
        initializeInvoiceFilters();
        initializeCreateInvoiceModalAdmin();
        initializeViewInvoiceDetailModalAdmin();
        initializeCreateClientModal();
        initializeEditClientModal();

        // Initial data load for dashboard (only if dashboard is the target section)
        // The section display logic below will handle loading data for the correct initial section.

        const adminNotesForm = getAdminPageElement('admin-notes-form');
        const skipAdminNotesButton = getAdminPageElement('skip-admin-notes-button');

        if (adminNotesForm) {
            adminNotesForm.addEventListener('submit', async (event) => {
                const success = await handleAdminNotesFormSubmit(event);
                if (success) {
                    await fetchAdminDashboardSummary(); // Refresh dashboard after any request update
                    await fetchRecentPendingOverview();
                }
            });
        } else {
            console.warn("AdminMain: Admin notes form ('admin-notes-form') not found.");
        }

        if (skipAdminNotesButton) {
            skipAdminNotesButton.addEventListener('click', async () => {
                const success = await handleSkipAdminNotes();
                if (success) {
                    await fetchAdminDashboardSummary(); // Refresh dashboard
                    await fetchRecentPendingOverview();
                }
            });
        } else {
            console.warn("AdminMain: Skip admin notes button ('skip-admin-notes-button') not found.");
        }

        // Determine initial section from URL hash, or default to admin-dashboard
        let initialAdminSection = 'admin-dashboard';
        if (window.location.hash) {
            const hashSection = window.location.hash.substring(1);
            // Basic validation: ensure it's one of our known admin sections
            const knownAdminSections = [
                'admin-dashboard', 'pending-requests', 'all-domains',
                'all-clients', 'admin-billing', 'support-tickets-admin',
                'client-detail-admin', 'admin-domain-detail'
            ];
            // Also check for sections like 'client-detail-admin-123'
            const baseHashSection = hashSection.split('-')[0] + (hashSection.split('-')[1] ? '-' + hashSection.split('-')[1] : ''); // e.g. 'client-detail-admin'
             if (knownAdminSections.includes(hashSection) || knownAdminSections.includes(baseHashSection) ) {
                 initialAdminSection = hashSection;
            }
        }
        console.log("AdminMain: Initial section to load:", initialAdminSection);
        // The `showAdminSection` function in `adminUI.js` handles fetching data for the specific section shown.
        // We pass `true` for `isInitialLoad` to allow it to make decisions about initial data fetches.
        showAdminSection(initialAdminSection, true);


        adminInitialLoadComplete = true;
        console.log("AdminMain: Admin Panel Modules Initialized and initial data loaded for target section.");

    } catch (error) {
        console.error("AdminMain: Error during admin session verification or initial load:", error);
        showAdminMessage(`Session Error: ${error.message}. Redirecting to login.`, 'error');
    }
}

function setupGlobalEventListeners() {
    const adminLogoutLink = getAdminPageElement('admin-logout-link');
    if (adminLogoutLink) {
        adminLogoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await logoutUser();
                showAdminMessage('Logged out successfully.', 'success');
                window.location.href = '/login';
            } catch (error) {
                showAdminMessage(`Logout failed: ${error.message}`, 'error');
            }
        });
    } else {
        console.warn("AdminMain: Admin logout link not found.");
    }

    // Listen for hash changes to update the section
    window.addEventListener('hashchange', () => {
        if (adminInitialLoadComplete) {
            let sectionFromHash = window.location.hash.substring(1);
            if (!sectionFromHash || sectionFromHash.startsWith('nav-')) { // Fallback if hash is empty or just nav item
                sectionFromHash = 'admin-dashboard';
            }
            // Ensure the section key is valid before calling showAdminSection
            // This check can be more robust by comparing against a list of valid section keys
            const validAdminSectionPrefixes = ['admin-dashboard', 'pending-requests', 'all-domains', 'all-clients', 'admin-billing', 'support-tickets-admin', 'client-detail-admin', 'admin-domain-detail'];
            const baseSection = sectionFromHash.split('-')[0] + (sectionFromHash.includes('detail') ? '-detail-admin' : (sectionFromHash.includes('tickets') ? '-tickets-admin' : ''));


            if (getAdminPageElement(sectionFromHash + '-section') || validAdminSectionPrefixes.some(prefix => sectionFromHash.startsWith(prefix))) {
                 console.log("AdminMain: Hash changed to:", sectionFromHash);
                 showAdminSection(sectionFromHash); // isInitialLoad is false by default
            } else {
                console.warn("AdminMain: Invalid section in hash:", sectionFromHash, "defaulting to dashboard.");
                showAdminSection('admin-dashboard');
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("AdminMain: DOMContentLoaded - Admin Panel Main Script Loaded (Modular)");
    initializeMessageBox('admin-message-box', 'admin-message-text', 'admin-close-message-box');
    refreshLucideIcons();
    verifyAdminSessionAndLoadMain();
    setupGlobalEventListeners();
});
