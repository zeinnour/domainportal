// Project/static/js/admin/adminDomainManagement.js
import { getAllAdminDomains, getDomainDetailsAdmin, reassignDomainOwnerAdmin, getAllClientsAdmin as fetchAllClientsForDropdown } from './apiAdminService.js'; // Renamed import for clarity
import { showMessage as showAdminMessage } from '../common/messageBox.js';
import { openModal, closeModal, resetModalForm } from '../common/modalUtils.js';
import { formatSimpleDate } from '../common/dateUtils.js';
import { showAdminSection, getAdminPageElement, createAdminIcon } from './adminUI.js';
import { openAdminTicketDetailModal } from './adminTicketManagement.js';
import { fetchAllClients } from './adminClientManagement.js'; // <<< ADDED THIS IMPORT for refreshing client list views

// DOM Elements
const allDomainsTableBodyEl = () => document.getElementById('all-domains-table-body');
const domainFiltersFormEl = () => document.getElementById('domain-filters-form');
const domainSearchTermInputEl = () => document.getElementById('domain-search-term');
const domainStatusFilterSelectEl = () => document.getElementById('domain-status-filter');
const domainClientFilterSelectEl = () => document.getElementById('domain-client-filter');
const clearDomainFiltersButtonEl = () => document.getElementById('clear-domain-filters-button');

const adminDomainDetailNameEl = () => document.getElementById('admin-domain-detail-name');
const adminDomainDetailStatusEl = () => document.getElementById('admin-domain-detail-status');
const adminDomainDetailOwnerNameEl = () => document.getElementById('admin-domain-detail-owner-name');
const adminDomainDetailOwnerUsernameEl = () => document.getElementById('admin-domain-detail-owner-username');
const adminDomainDetailRegDateEl = () => document.getElementById('admin-domain-detail-reg-date');
const adminDomainDetailExpDateEl = () => document.getElementById('admin-domain-detail-exp-date');
const adminDomainDetailAutoRenewEl = () => document.getElementById('admin-domain-detail-auto-renew');
const adminDomainDetailRequestCountEl = () => document.getElementById('admin-domain-detail-request-count');
const adminDomainDetailRequestsTableBodyEl = () => document.querySelector('#admin-domain-detail-requests-table tbody');
const adminDomainDetailRequestsPlaceholderEl = () => document.getElementById('admin-domain-detail-requests-placeholder');
const adminDomainDetailTicketCountEl = () => document.getElementById('admin-domain-detail-ticket-count');
const adminDomainDetailTicketsTableBodyEl = () => document.querySelector('#admin-domain-detail-tickets-table tbody');
const adminDomainDetailTicketsPlaceholderEl = () => document.getElementById('admin-domain-detail-tickets-placeholder');

const reassignDomainModalEl = () => document.getElementById('reassign-domain-modal');
const reassignDomainFormEl = () => document.getElementById('reassign-domain-form');
const reassignDomainIdInputEl = () => document.getElementById('reassignDomainId');
const reassignDomainNameDisplayEl = () => document.getElementById('reassignDomainNameDisplay');
const reassignCurrentOwnerDisplayEl = () => document.getElementById('reassignCurrentOwnerDisplay');
const reassignNewOwnerSelectEl = () => document.getElementById('reassignNewOwnerSelect');
const reassignNewOwnerErrorEl = () => document.getElementById('reassignNewOwnerError');

let allClientsCacheForDropdown = []; // Separate cache for dropdown population

export function initializeDomainManagement() {
    initializeDomainFilters();
    initializeDomainTableInteractions();
    initializeReassignDomainModal();
    console.log("Admin Domain Management Initialized (Filters & Table Interactions)");
}


function initializeDomainTableInteractions() {
    const tableBody = allDomainsTableBodyEl();
    if (tableBody) {
        tableBody.addEventListener('click', function(event) {
            const targetButton = event.target.closest('button');
            const targetLink = event.target.closest('a');

            if (targetButton) {
                const domainId = targetButton.dataset.domainId;
                if (!domainId) return;

                if (targetButton.classList.contains('view-admin-domain-details-button')) {
                    // viewAdminDomainDetails(domainId); // Direct call might be redundant if hash changes
                    window.location.hash = `admin-domain-detail-${domainId}`;
                } else if (targetButton.classList.contains('open-reassign-domain-button')) {
                    const domainName = targetButton.dataset.domainName;
                    const currentOwnerUsername = targetButton.dataset.currentOwnerUsername;
                    openReassignDomainModal(domainId, domainName, currentOwnerUsername);
                }
            } else if (targetLink && targetLink.classList.contains('view-admin-domain-details-button')) {
                event.preventDefault();
                const domainId = targetLink.dataset.domainId;
                if (domainId) {
                    // viewAdminDomainDetails(domainId);
                    window.location.hash = `admin-domain-detail-${domainId}`;
                }
            }
        });
    }
}


export async function initializeDomainFilters() {
    const form = domainFiltersFormEl();
    const clearButton = clearDomainFiltersButtonEl();

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const filters = {
                search_term: domainSearchTermInputEl().value.trim(),
                status: domainStatusFilterSelectEl().value,
                client_id: domainClientFilterSelectEl().value
            };
            await fetchAllAdminDomains(filters);
        });
    }
    if (clearButton) {
        clearButton.addEventListener('click', async () => {
            if (form) form.reset();
            await fetchAllAdminDomains();
        });
    }
    await populateDomainClientFilter();
}

export async function populateDomainClientFilter() {
    const selectEl = domainClientFilterSelectEl();
    if (!selectEl) return;
    try {
        if (allClientsCacheForDropdown.length === 0) { // Use the renamed cache variable
            allClientsCacheForDropdown = await fetchAllClientsForDropdown() || []; // Use renamed API service function
        }
        const currentSelectedClientId = selectEl.value;
        selectEl.innerHTML = '<option value="">All Clients</option><option value="0">Unassigned</option>'; // Added Unassigned
        allClientsCacheForDropdown.forEach(client => {
            if (client.role === 'client') { // Ensure only actual clients are listed
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = `${client.name} (${client.username})`;
                selectEl.appendChild(option);
            }
        });
        if (currentSelectedClientId) {
            selectEl.value = currentSelectedClientId;
        }
    } catch (error) {
        console.error("Error populating domain client filter:", error);
        showAdminMessage("Could not load clients for domain filter.", "error");
    }
}

export async function fetchAllAdminDomains(filters = {}) {
    const tableBody = allDomainsTableBodyEl();
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 placeholder-text">Loading all domains...</td></tr>`;
    try {
        const domains = await getAllAdminDomains(filters);
        renderAllDomainsTable(domains);
        if (Object.keys(filters).length === 0) { // Only repopulate client filter if no filters applied initially
            // await populateDomainClientFilter(); // This might be redundant if called in initializeDomainFilters
        }
    } catch (error) {
        console.error("Error fetching all domains for admin:", error);
        if(tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 error-text">Error loading domains. ${error.message}</td></tr>`;
        showAdminMessage(`Error loading domains: ${error.message}`, 'error');
    }
}

export function renderAllDomainsTable(domains) {
    const tableBody = allDomainsTableBodyEl();
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!domains || domains.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center p-4 placeholder-text">No domains found matching your criteria.</td></tr>';
        return;
    }
    domains.forEach(domain => {
        const row = tableBody.insertRow();
        row.className = 'hover:bg-gray-700 transition-colors duration-150';
        let statusBadgeClass = 'status-badge ';
        const normalizedStatus = domain.status ? domain.status.toLowerCase().replace(/\s+/g, '-') : 'unknown';
        statusBadgeClass += `status-${normalizedStatus}`;
        const clientUsername = domain.owner_username || (domain.userId ? `User ID: ${domain.userId}` : 'Unassigned');
        const clientDisplayName = domain.ownerName && domain.ownerName !== "N/A (Unassigned)" ? `${domain.ownerName} (${clientUsername})` : clientUsername;

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-100">${domain.id}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                <a href="#admin-domain-detail-${domain.id}" class="text-indigo-400 hover:text-indigo-300 view-admin-domain-details-button" data-domain-id="${domain.id}">${domain.name}</a>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">${clientDisplayName}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">${formatSimpleDate(domain.regDate)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">${formatSimpleDate(domain.expDate)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span class="${statusBadgeClass}">${domain.status || 'N/A'}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">${domain.autoRenew ? 'Enabled' : 'Disabled'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-1">
                <button class="btn btn-xs btn-info view-admin-domain-details-button" data-domain-id="${domain.id}">Details</button>
                <button class="btn btn-xs btn-purple open-reassign-domain-button"
                        data-domain-id="${domain.id}"
                        data-domain-name="${domain.name}"
                        data-current-owner-username="${clientDisplayName}">Reassign</button>
            </td>
        `;
    });
}

export async function viewAdminDomainDetails(domainId) {
    const nameEl = adminDomainDetailNameEl();
    const statusEl = adminDomainDetailStatusEl();
    const ownerNameEl = adminDomainDetailOwnerNameEl();
    const ownerUsernameEl = adminDomainDetailOwnerUsernameEl();
    const regDateEl = adminDomainDetailRegDateEl();
    const expDateEl = adminDomainDetailExpDateEl();
    const autoRenewEl = adminDomainDetailAutoRenewEl();
    const reqCountEl = adminDomainDetailRequestCountEl();
    const reqTableBodyEl = adminDomainDetailRequestsTableBodyEl();
    const reqPlaceholderEl = adminDomainDetailRequestsPlaceholderEl();
    const ticketCountEl = adminDomainDetailTicketCountEl();
    const ticketTableBodyEl = adminDomainDetailTicketsTableBodyEl();
    const ticketPlaceholderEl = adminDomainDetailTicketsPlaceholderEl();

    if(nameEl) nameEl.textContent = 'Loading...';
    if(statusEl) statusEl.textContent = '...';
    if(ownerNameEl) ownerNameEl.textContent = '...';
    if(ownerUsernameEl) ownerUsernameEl.textContent = '...';
    if(regDateEl) regDateEl.textContent = '...';
    if(expDateEl) expDateEl.textContent = '...';
    if(autoRenewEl) autoRenewEl.textContent = '...';

    if(reqTableBodyEl) reqTableBodyEl.innerHTML = '';
    if(reqPlaceholderEl) { reqPlaceholderEl.textContent = 'Loading requests...'; reqPlaceholderEl.classList.remove('hidden'); }
    if(reqCountEl) reqCountEl.textContent = '...';

    if(ticketTableBodyEl) ticketTableBodyEl.innerHTML = '';
    if(ticketPlaceholderEl) { ticketPlaceholderEl.textContent = 'Loading tickets...'; ticketPlaceholderEl.classList.remove('hidden'); }
    if(ticketCountEl) ticketCountEl.textContent = '...';

    // showAdminSection will be handled by hash change
    // showAdminSection(`admin-domain-detail-${domainId}`); // This was removed to rely on hash

    try {
        const data = await getDomainDetailsAdmin(domainId);
        if(data.domain_info) {
            const domain = data.domain_info;
            if(nameEl) nameEl.textContent = domain.name || 'N/A';
            if(statusEl) {
                statusEl.textContent = domain.status || 'N/A';
                statusEl.className = `status-badge status-${(domain.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}`;
            }
            if(ownerNameEl) ownerNameEl.textContent = domain.ownerName || 'N/A';
            if(ownerUsernameEl) ownerUsernameEl.textContent = domain.owner_username || 'N/A';
            if(regDateEl) regDateEl.textContent = formatSimpleDate(domain.regDate);
            if(expDateEl) expDateEl.textContent = formatSimpleDate(domain.expDate);
            if(autoRenewEl) autoRenewEl.textContent = domain.autoRenew ? 'Enabled' : 'Disabled';

            // Update page title after fetching details
            const pageTitle = getAdminPageElement('admin-page-title');
            if (pageTitle) pageTitle.textContent = `Domain Details: ${domain.name}`;
        }

        if(reqTableBodyEl && reqPlaceholderEl && reqCountEl) {
            reqTableBodyEl.innerHTML = '';
            if(data.requests && data.requests.length > 0) {
                reqCountEl.textContent = data.requests.length;
                reqPlaceholderEl.classList.add('hidden');
                data.requests.forEach(req => {
                    const row = reqTableBodyEl.insertRow();
                    row.innerHTML = `
                        <td class="px-3 py-2 whitespace-nowrap text-sm">#${req.id}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">${req.requestType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">${formatSimpleDate(req.requestDate)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm"><span class="status-badge status-${req.status.toLowerCase().replace(/\s+/g, '-')}">${req.status}</span></td>
                    `;
                });
            } else {
                reqCountEl.textContent = 0;
                reqPlaceholderEl.textContent = 'No related requests found.'; reqPlaceholderEl.classList.remove('hidden');
            }
        }

        if(ticketTableBodyEl && ticketPlaceholderEl && ticketCountEl) {
            ticketTableBodyEl.innerHTML = '';
            if(data.tickets && data.tickets.length > 0) {
                ticketCountEl.textContent = data.tickets.length;
                ticketPlaceholderEl.classList.add('hidden');
                data.tickets.forEach(ticket => {
                    const row = ticketTableBodyEl.insertRow();
                    row.innerHTML = `
                        <td class="px-3 py-2 whitespace-nowrap text-sm">#${ticket.id}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">${ticket.subject}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">${formatSimpleDate(ticket.requestDate)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm"><span class="status-badge status-${ticket.status.toLowerCase().replace(/\s+/g, '-')}">${ticket.status}</span></td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm"> <button class="btn btn-xs btn-info view-ticket-detail-button" data-ticket-id="${ticket.id}">View/Reply</button> </td>
                    `;
                    row.querySelector('.view-ticket-detail-button').addEventListener('click', function() {
                        openAdminTicketDetailModal(this.dataset.ticketId);
                    });
                });
            } else {
                ticketCountEl.textContent = 0;
                ticketPlaceholderEl.textContent = 'No related tickets found.'; ticketPlaceholderEl.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error("Error fetching admin domain details:", error);
        showAdminMessage(`Error loading domain details: ${error.message}`, 'error');
        if(nameEl) nameEl.textContent = 'Error';
    }
}

export async function initializeReassignDomainModal() {
    const modal = reassignDomainModalEl();
    const form = reassignDomainFormEl();
    if (modal) {
        const closeButton = document.getElementById('close-reassign-domain-modal');
        const cancelButton = document.getElementById('cancel-reassign-domain-button');
        if(closeButton) closeButton.addEventListener('click', () => closeModal(modal));
        if(cancelButton) cancelButton.addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    }
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const domainId = reassignDomainIdInputEl().value;
            const newUserId = reassignNewOwnerSelectEl().value;
            const errorEl = reassignNewOwnerErrorEl();

            if (!newUserId) {
                if (errorEl) { errorEl.textContent = "Please select a new owner."; errorEl.classList.remove('hidden'); }
                return;
            }
            if (errorEl) errorEl.classList.add('hidden');

            try {
                const responseData = await reassignDomainOwnerAdmin(domainId, newUserId);
                showAdminMessage(responseData.message, "success");
                closeModal(reassignDomainModalEl());
                await fetchAllAdminDomains(); // Refresh the domains list
                await fetchAllClients(); // <<< This was the call causing 'fetchAllClients is not defined'

                // Refresh client detail view if it's open for either the old or new owner
                const clientDetailSection = getAdminPageElement('client-detail-admin-section');
                if (clientDetailSection && !clientDetailSection.classList.contains('hidden')) {
                    const currentOpenClientId = getAdminPageElement('client-detail-name').dataset.clientId;
                    // We need the old owner's ID to check if their view needs refreshing.
                    // This info isn't directly available here after reassign.
                    // A simpler approach is to always refresh if any client detail view is open.
                    // Or, if responseData includes old/new owner IDs, use that.
                    // For now, let's assume we might need to refresh the current client if they are new owner.
                    if (currentOpenClientId === newUserId.toString()) {
                         const { viewClientDetails: refreshClientView } = await import('./adminClientManagement.js');
                         refreshClientView(currentOpenClientId);
                    }
                    // Ideally, we'd also refresh the old owner's view if that was open.
                }
            } catch (error) {
                console.error("Error reassigning domain:", error);
                showAdminMessage(`Error: ${error.message}`, 'error');
                if (errorEl) { errorEl.textContent = error.message; errorEl.classList.remove('hidden'); }
            }
        });
    }
}

export async function openReassignDomainModal(domainId, domainName, currentOwnerUsername) {
    const modal = reassignDomainModalEl();
    const idInput = reassignDomainIdInputEl();
    const nameDisplay = reassignDomainNameDisplayEl();
    const currentOwnerDisplay = reassignCurrentOwnerDisplayEl();
    const errorEl = reassignNewOwnerErrorEl();

    if (!modal || !idInput || !nameDisplay || !currentOwnerDisplay || !errorEl) {
        console.error("Reassign domain modal elements missing.");
        showAdminMessage("Error opening reassign domain form.", "error");
        return;
    }
    resetModalForm(reassignDomainFormEl(), ['reassignNewOwnerError']);
    idInput.value = domainId;
    nameDisplay.textContent = domainName;
    currentOwnerDisplay.textContent = currentOwnerUsername || 'N/A (Unassigned)';
    await populateReassignClientDropdown(currentOwnerUsername);
    openModal(modal);
}

async function populateReassignClientDropdown(currentOwnerUsernameToExclude) {
    const newOwnerSelect = reassignNewOwnerSelectEl();
    if (!newOwnerSelect) return;
    try {
        if (allClientsCacheForDropdown.length === 0) { // Use specific cache for this dropdown
            allClientsCacheForDropdown = await fetchAllClientsForDropdown() || [];
        }
        newOwnerSelect.innerHTML = '<option value="">-- Select a Client --</option>';
        allClientsCacheForDropdown.forEach(client => {
            if (client.role === 'client' && client.is_active) {
                const clientIdentifier = `${client.name} (${client.username})`;
                // Exclude current owner if provided and matches
                if (currentOwnerUsernameToExclude &&
                    (clientIdentifier === currentOwnerUsernameToExclude ||
                     client.username === currentOwnerUsernameToExclude.split(' (')[0] || // Handle case where only username is passed
                     (client.id && client.id.toString() === currentOwnerUsernameToExclude) // Handle if ID is passed
                     )) {
                    return;
                }
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = clientIdentifier;
                newOwnerSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Error populating clients for reassignment:", error);
        showAdminMessage("Could not load clients for reassignment.", "error");
        if (reassignNewOwnerErrorEl()) { reassignNewOwnerErrorEl().textContent = "Could not load client list."; reassignNewOwnerErrorEl().classList.remove('hidden');}
    }
}
