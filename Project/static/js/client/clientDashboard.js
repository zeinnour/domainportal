// Project/static/js/client/clientDashboard.js
import { fetchPendingRequestCounts, fetchClientRecentActivity } from './apiClientService.js';
import { showMessage } from '../common/messageBox.js';
import { createClientIcon as createIcon } from './clientUI.js'; // Use aliased createIcon
import { formatDateDetailed, formatSimpleDate } from '../common/dateUtils.js'; // Corrected import name
import { ALERT_EXPIRY_DAYS } from './config.js';
// Removed unused import: getCurrentManagingDomainId
import { viewDomainDetails, getClientDomainsData } from './clientDomainDetail.js'; // For alert click
import { showClientSection } from './clientUI.js';

// DOM Elements
const totalDomainsEl = () => document.getElementById('total-domains');
const activeDomainsEl = () => document.getElementById('active-domains');
const expiringSoonEl = () => document.getElementById('expiring-soon');
const expiredDomainsEl = () => document.getElementById('expired-domains');
const alertsListEl = () => document.getElementById('alerts-list');
const recentActivityListEl = () => document.getElementById('recent-activity-list');


export function initializeClientDashboard() {
    // Data fetching is usually triggered by the main load or when switching to the dashboard section
    console.log("Client Dashboard Initialized.");
    // Event listeners for stat cards are handled in clientUI.js
}

export function updateDashboardStats() {
    const domainsData = getClientDomainsData(); // Assumes this getter exists in clientDomainDetail or similar
    if (!domainsData) {
        console.warn("Dashboard: Domains data not available for stats update.");
        return;
    }
    if(totalDomainsEl()) totalDomainsEl().textContent = domainsData.length;
    if(activeDomainsEl()) activeDomainsEl().textContent = domainsData.filter(d => d.status === 'Active').length;
    if(expiringSoonEl()) expiringSoonEl().textContent = domainsData.filter(d => d.status === 'Expiring Soon').length; // Or calculate dynamically
    if(expiredDomainsEl()) expiredDomainsEl().textContent = domainsData.filter(d => d.status === 'Expired').length;
}

export async function loadDashboardData() { // Called when dashboard is shown or on initial load
    try {
        const [countsData, activityData] = await Promise.all([
            fetchPendingRequestCounts(),
            fetchClientRecentActivity()
        ]);
        updateDashboardAlerts(countsData || {});
        renderClientRecentActivity(Array.isArray(activityData) ? activityData : []);
        updateDashboardStats(); // Needs domain data, ensure it's loaded before this or passed
    } catch (error) {
        showMessage("Error loading dashboard data. Some information may be missing.", "error");
        console.error("Dashboard load error:", error);
    }
}


export function renderClientRecentActivity(activities) {
    const activityList = recentActivityListEl();
    if (!activityList) {
        console.warn("Recent activity list element not found for client dashboard.");
        return;
    }
    activityList.innerHTML = ''; // Clear previous
    if (activities && activities.length > 0) {
        activities.forEach(activity => {
            const li = document.createElement('li');
            li.className = 'text-sm p-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-750 transition-colors duration-150 rounded';

            let iconName = 'Info'; // Default icon
            if (activity.item_type === 'domain_request' || activity.item_type?.startsWith('register') || activity.item_type?.startsWith('renew') || activity.item_type?.startsWith('transfer')) iconName = 'Globe';
            else if (activity.item_type?.includes('ticket')) iconName = 'MessageSquare';
            if (activity.description.toLowerCase().includes('replied')) iconName = 'Reply';
            if (activity.description.toLowerCase().includes('approved') || activity.description.toLowerCase().includes('paid') || activity.description.toLowerCase().includes('completed')) iconName = 'CheckCircle2';
            if (activity.description.toLowerCase().includes('rejected') || activity.description.toLowerCase().includes('failed')) iconName = 'XCircle';

            const iconId = `activity-icon-${activity.item_type || 'general'}-${activity.item_id || Math.random().toString(36).substr(2,5)}`;

            li.innerHTML = `
                <div class="flex items-center">
                    <span id="${iconId}" class="mr-3 flex-shrink-0 text-purple-400"></span>
                    <div>
                        <p class="font-medium text-gray-200">${activity.description}</p>
                        <p class="text-xs text-gray-500">${formatDateDetailed(activity.date)}</p> 
                    </div>
                </div>
            `; // Corrected usage of formatDateDetailed
            activityList.appendChild(li);
            createIcon(iconId, iconName, { class: 'h-5 w-5'});
        });
    } else {
        activityList.innerHTML = '<li class="text-sm text-gray-400 p-2">No recent activity to display.</li>';
    }
}

export function updateDashboardAlerts(clientCounts = {}) {
    const listEl = alertsListEl();
    const domainsData = getClientDomainsData();
    if (!listEl) return;
    listEl.innerHTML = ''; // Clear previous
    let hasAlerts = false;
    const today = new Date();
    const alertExpiryLimitDate = new Date();
    alertExpiryLimitDate.setDate(today.getDate() + ALERT_EXPIRY_DAYS);

    if (domainsData && domainsData.length > 0) {
        const expiringDomains = domainsData.filter(domain => {
            if (!domain.expDate) return false;
            const expiryDate = new Date(domain.expDate);
            return expiryDate <= alertExpiryLimitDate && domain.status !== 'Expired';
        });
        if (expiringDomains.length > 0) {
            hasAlerts = true;
            expiringDomains.forEach(domain => {
                const expiryDate = new Date(domain.expDate);
                const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                let alertItemClasses = 'flex items-center p-3 mb-2 text-sm rounded-lg alert-item-clickable transition-opacity';
                let iconName = 'CalendarClock';
                let messagePrefix = "Expiring Soon: ";
                if (daysUntilExpiry <= 0) {
                    alertItemClasses += ' bg-red-100 text-red-700'; iconName = 'AlertTriangle'; messagePrefix = "Expired: ";
                } else if (daysUntilExpiry <= 30) {
                    alertItemClasses += ' bg-red-100 text-red-700'; iconName = 'AlertTriangle';
                } else {
                    alertItemClasses += ' bg-yellow-100 text-yellow-700';
                }
                let alertMessage = `${messagePrefix}<strong>${domain.name}</strong> ${daysUntilExpiry > 0 ? `in ${daysUntilExpiry} day(s)` : `on ${formatSimpleDate(domain.expDate)}`}. Click to manage.`;
                if (daysUntilExpiry <= 0) alertMessage = `${messagePrefix}<strong>${domain.name}</strong> expired on ${formatSimpleDate(domain.expDate)}. Click to manage.`;

                const alertDiv = document.createElement('div');
                alertDiv.className = alertItemClasses;
                alertDiv.onclick = () => viewDomainDetails(domain.id); // viewDomainDetails should be imported and handle navigation

                const iconContainer = document.createElement('span');
                iconContainer.className = 'mr-3 flex-shrink-0';
                const iconId = `alert-icon-exp-${domain.id}-${Math.random().toString(36).substr(2, 9)}`;
                iconContainer.id = iconId;
                alertDiv.appendChild(iconContainer);

                const messageSpan = document.createElement('span');
                messageSpan.innerHTML = alertMessage;
                alertDiv.appendChild(messageSpan);
                listEl.appendChild(alertDiv);
                createIcon(iconId, iconName, { class: 'h-5 w-5' });
            });
        }
    }

    const requestTypesMap = {
        registrations: { messageSingular: 'new domain registration request', messagePlural: 'new domain registration requests', icon: 'MailPlus', section: 'domains', alertClass: 'bg-blue-100 text-blue-700' },
        renewals: { messageSingular: 'domain renewal request', messagePlural: 'domain renewal requests', icon: 'MailCheck', section: 'domains', alertClass: 'bg-blue-100 text-blue-700' },
        auto_renew_changes: { messageSingular: 'auto-renew change request', messagePlural: 'auto-renew change requests', icon: 'MailWarning', section: 'domains', alertClass: 'bg-blue-100 text-blue-700' },
        lock_changes: { messageSingular: 'domain lock change request', messagePlural: 'domain lock change requests', icon: 'LockKeyhole', section: 'domains', alertClass: 'bg-yellow-100 text-yellow-700' },
        open_support_tickets: { messageSingular: 'open support ticket', messagePlural: 'open support tickets', icon: 'MessageCircleQuestion', section: 'support', alertClass: 'bg-purple-100 text-purple-700' },
        pending_transfers_in: { messageSingular: 'domain transfer-in request', messagePlural: 'domain transfer-in requests', icon: 'ArrowRightLeft', section: 'domains', alertClass: 'bg-orange-100 text-orange-700' },
        pending_transfers_out: { messageSingular: 'domain transfer-out request', messagePlural: 'domain transfer-out requests', icon: 'LogOut', section: 'domains', alertClass: 'bg-red-100 text-red-700' },
        pending_dns_changes: { messageSingular: 'DNS change request', messagePlural: 'DNS change requests', icon: 'Settings2', section: 'domains', alertClass: 'bg-teal-100 text-teal-700' },
        pending_contact_updates: { messageSingular: 'contact info update request', messagePlural: 'contact info update requests', icon: 'UserCog', section: 'domains', alertClass: 'bg-pink-100 text-pink-700' },
        pending_payment_proofs: { messageSingular: 'payment proof awaiting review', messagePlural: 'payment proofs awaiting review', icon: 'FileCheck', section: 'billing', alertClass: 'bg-green-100 text-green-700' },
        pending_internal_transfers: { messageSingular: 'internal domain transfer request', messagePlural: 'internal domain transfer requests', icon: 'Replace', section: 'domains', alertClass: 'bg-indigo-100 text-indigo-700'}
     };

     for (const key in clientCounts) {
        if (clientCounts[key] > 0 && requestTypesMap[key]) {
            hasAlerts = true;
            const reqType = requestTypesMap[key];
            const count = clientCounts[key];

            const alertDiv = document.createElement('div');
            alertDiv.className = `flex items-center p-3 mb-2 text-sm rounded-lg alert-item-clickable transition-opacity ${reqType.alertClass}`;
            alertDiv.onclick = () => showClientSection(reqType.section); // showClientSection should be imported

            const iconContainer = document.createElement('span');
            iconContainer.className = 'mr-3 flex-shrink-0';
            const iconId = `alert-icon-req-${key}-${Math.random().toString(36).substr(2, 9)}`;
            iconContainer.id = iconId;
            alertDiv.appendChild(iconContainer);

            const messageSpan = document.createElement('span');
            messageSpan.textContent = `You have ${count} ${count === 1 ? reqType.messageSingular : reqType.messagePlural} pending. Click to view.`;
            alertDiv.appendChild(messageSpan);

            listEl.appendChild(alertDiv);
            createIcon(iconId, reqType.icon, { class: 'h-5 w-5'});
        }
      }

    if (!hasAlerts) {
        const noAlertsP = document.createElement('p');
        noAlertsP.className = 'flex items-center p-3 text-sm rounded-lg bg-green-100 text-green-700'; // Adjusted for dark theme
        const iconContainer = document.createElement('span');
        iconContainer.className = 'mr-3 flex-shrink-0';
        const iconId = `no-alert-icon-${Math.random().toString(36).substr(2, 9)}`;
        iconContainer.id = iconId;
        noAlertsP.appendChild(iconContainer);
        const messageSpan = document.createElement('span');
        messageSpan.textContent = 'No current alerts or pending requests.';
        noAlertsP.appendChild(messageSpan);
        listEl.appendChild(noAlertsP);
        createIcon(iconId, 'ShieldCheck', { class: 'h-5 w-5' });
    }
}
