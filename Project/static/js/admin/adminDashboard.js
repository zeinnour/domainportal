// Project/static/js/admin/adminDashboard.js
import { getAdminDashboardSummary, getRecentPendingOverview } from './apiAdminService.js';
import { showMessage as showAdminMessage } from '../common/messageBox.js';
import { renderRequestCard, showAdminSection, showAdminNotesModal } from './adminUI.js'; // Added showAdminNotesModal
import { openAdminTicketDetailModal } from './adminTicketManagement.js';

const adminRecentPendingOverviewListEl = () => document.getElementById('admin-recent-pending-overview-list');

export async function fetchAdminDashboardSummary() {
    try {
        const summary = await getAdminDashboardSummary();
        requestAnimationFrame(() => {
            renderAdminDashboardStats(summary);
        });
    } catch (error) {
        console.error("Error fetching admin dashboard summary:", error);
        showAdminMessage("Could not load dashboard summary.", "error");
    }
}

export async function fetchRecentPendingOverview() {
    const listEl = adminRecentPendingOverviewListEl();
    if (!listEl) {
        console.warn("Admin recent pending overview list element not found.");
        return;
    }
    listEl.innerHTML = `<p class="placeholder-text col-span-full">Loading recent items...</p>`;
    try {
        const items = await getRecentPendingOverview(); // This should return a mix of requests and tickets
        listEl.innerHTML = '';
        if (items && items.length > 0) {
            items.slice(0, 5).forEach(item => { // Show top 5
                const cardElement = renderRequestCard(item, true); // true for isOverviewCard

                // Attach listeners for overview cards' ACTION BUTTONS
                cardElement.querySelectorAll('.actions button').forEach(button => {
                     button.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent card's main click listener if any
                        const requestId = button.dataset.id;
                        const reqTypeFromButton = button.dataset.type;
                        const action = button.dataset.action; // e.g., 'Approved', 'Rejected', 'view-ticket'

                        if (reqTypeFromButton === 'support-ticket' && action === 'view-ticket') {
                            openAdminTicketDetailModal(requestId);
                        } else if (action === 'Approved' || action === 'Rejected' || action === 'EPP Code Sent' || action === 'Processing' || action === 'Info Requested' || action === 'Completed' || action === 'Failed' || action === 'Needs Info' || action === 'Needs Clarification' || action === 'Cancelled by Client') {
                            // For actions that require notes (Approve, Reject, etc.)
                            const currentRequestData = items.find(i => i.id.toString() === requestId && i.requestType === reqTypeFromButton);
                            showAdminNotesModal(requestId, reqTypeFromButton, action, currentRequestData ? currentRequestData.admin_notes || '' : '');
                        } else {
                            // Fallback or other specific actions for overview cards if needed
                            console.warn(`Overview card button action '${action}' for type '${reqTypeFromButton}' not explicitly handled for direct action.`);
                            // Default navigation for other button types if any
                            navigateToRequestSection(reqTypeFromButton);
                        }
                    });
                });

                 // Make the whole card clickable to navigate for non-ticket items (if no action button was clicked)
                if (item.requestType !== 'support-ticket') {
                    cardElement.style.cursor = 'pointer';
                    cardElement.addEventListener('click', (e) => {
                        // Only navigate if the click was directly on the card, not on a button within it
                        if (e.target.closest('button')) {
                            return;
                        }
                        navigateToRequestSection(item.requestType);
                    });
                }
                listEl.appendChild(cardElement);
            });
        } else {
            listEl.innerHTML = `<p class="placeholder-text col-span-full">No recent pending items.</p>`;
        }
    } catch (error) {
        console.error("Error fetching recent pending overview:", error);
        if(listEl) listEl.innerHTML = `<p class="error-text col-span-full">Error loading recent items.</p>`;
        showAdminMessage("Could not load recent pending items.", "error");
    }
}

// Helper function to navigate to the correct pending requests tab
function navigateToRequestSection(requestType) {
    let targetTabId;
    const typeToTabMap = {
        'register': 'pending-registrations-tab',
        'renew': 'pending-renewals-tab',
        'auto_renew_change': 'pending-auto-renew-tab',
        'lock_change': 'pending-lock-change-tab',
        'transfer_in': 'pending-transfers-in-tab',
        'transfer_out': 'pending-transfers-out-tab',
        'internal_transfer_request': 'pending-internal-transfers-tab',
        'dns_change': 'pending-dns-changes-tab',
        'contact_update': 'pending-contact-updates-tab',
        'payment_proof': 'pending-payment-proofs-tab',
        // Add other mappings if necessary
    };
    targetTabId = typeToTabMap[requestType] || `pending-${requestType.replace(/_/g, '-')}-tab`;

    if (targetTabId) {
        showAdminSection('pending-requests'); // Navigate to the main "Pending Requests" section
        setTimeout(() => { // Ensure DOM is updated before trying to click the tab
            const tabButton = document.querySelector(`#pending-requests-section .tab-button[data-tab-target="${targetTabId}"]`);
            if (tabButton) {
                tabButton.click(); // Activate the specific tab
            } else {
                console.warn(`Tab button for target '${targetTabId}' not found.`);
            }
        }, 0);
    }
}


function renderAdminDashboardStats(summary) {
    const statsMap = {
        'admin-pending-registrations-count': summary.pending_registrations,
        'admin-pending-renewals-count': summary.pending_renewals,
        'admin-open-tickets-count': summary.open_support_tickets,
        'admin-pending-transfers-in-count': summary.pending_transfers_in,
        'admin-pending-transfers-out-count': summary.pending_transfers_out,
        'admin-pending-internal-transfers-count': summary.pending_internal_transfers,
        'admin-pending-dns-count': summary.pending_dns_changes,
        'admin-pending-contact-updates-count': summary.pending_contact_updates,
        'admin-pending-payment-proofs-count': summary.pending_payment_proofs,
        'admin-total-domains-count': summary.total_managed_domains,
        'admin-total-clients-count': summary.total_clients,
        'admin-pending-auto-renew-changes-count': summary.pending_auto_renew_changes,
        'admin-pending-lock-changes-count': summary.pending_lock_changes,
    };

    for (const id in statsMap) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = statsMap[id] === undefined ? 'N/A' : statsMap[id];
        } else {
            console.warn(`AdminDashboard: Element with ID '${id}' not found for stats.`);
        }
    }
}

export function initializeAdminDashboard() {
    console.log("Admin Dashboard Initialized - Fetching initial data...");
    // Data fetching is now handled by showAdminSection when dashboard is displayed
    // fetchAdminDashboardSummary();
    // fetchRecentPendingOverview();
}
