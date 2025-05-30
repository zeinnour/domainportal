// Project/static/js/client/clientDomainTable.js
import { formatSimpleDate } from '../common/dateUtils.js';
import { showMessage } from '../common/messageBox.js';
import { viewDomainDetails, getClientDomainsData, getPendingAutoRenewRequests, getPendingLockRequests } from './clientDomainDetail.js'; // Depends on clientDomainDetail for data
import { openRenewModalForClient } from './clientRequestModals.js';
import { submitAutoRenewChange, submitBulkRenewRequest } from './apiClientService.js';
import { fetchAllClientData } from './client_main.js'; // To refresh all data after actions

// DOM Elements
const domainsTableBodyEl = () => document.getElementById('domains-table-body');
const selectAllDomainsCheckboxEl = () => document.getElementById('select-all-domains-checkbox');
const bulkRenewActionButtonEl = () => document.getElementById('bulk-renew-action-button');

let localDomainsData = [];
let localPendingAutoRenewRequests = [];

export function initializeDomainTable() {
    const tableBody = domainsTableBodyEl();
    const selectAllCheckbox = selectAllDomainsCheckboxEl();
    const bulkRenewButton = bulkRenewActionButtonEl();

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            document.querySelectorAll('.domain-checkbox').forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateBulkActionVisibility();
        });
    }

    if (tableBody) {
        tableBody.addEventListener('change', (event) => {
            if (event.target.classList.contains('domain-checkbox')) {
                updateBulkActionVisibility();
            } else if (event.target.dataset.action === 'toggle-auto-renew') { // Assuming a data-action attribute
                const domainId = parseInt(event.target.dataset.domainId, 10);
                handleAutoRenewToggle(event, domainId, event.target.checked);
            }
        });
    }
    if (bulkRenewButton) {
        bulkRenewButton.addEventListener('click', handleBulkRenew);
    }
    console.log("Client Domain Table Initialized.");
}

export function setLocalDomainDataForTable(domains, pendingAutoRenew) {
    localDomainsData = domains;
    localPendingAutoRenewRequests = pendingAutoRenew;
}


export function renderDomainsTable() {
    const tableBody = domainsTableBodyEl();
    if (!tableBody) {
        console.error("Domains table body not found for rendering.");
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    const currentDomains = getClientDomainsData(); // Get fresh data
    const pendingAutoRenewReqs = getPendingAutoRenewRequests();


    if (!currentDomains || currentDomains.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-gray-400">No domains found for your account.</td></tr>';
        return;
    }

    currentDomains.forEach(domain => {
        const row = tableBody.insertRow();
        row.className = 'hover:bg-gray-700 transition-colors duration-150';
        let statusClass = '';
        switch (domain.status) {
            case 'Active': statusClass = 'bg-green-600 text-green-100'; break;
            case 'Expiring Soon': statusClass = 'bg-yellow-500 text-yellow-100'; break;
            case 'Expired': statusClass = 'bg-red-600 text-red-100'; break;
            default: statusClass = 'bg-gray-500 text-gray-100'; break;
        }

        const pendingAutoRenewReq = pendingAutoRenewReqs.find(
            req => req.domainId === domain.id && (req.status === 'Pending Admin Approval' || req.status === 'Pending')
        );

        let autoRenewIsChecked = domain.autoRenew;
        let autoRenewIsDisabled = false;
        let autoRenewStatusText = "";
        let autoRenewLabelClass = "auto-renew-label relative inline-flex items-center cursor-pointer";

        if (pendingAutoRenewReq && pendingAutoRenewReq.requestedData) {
            autoRenewIsChecked = pendingAutoRenewReq.requestedData.requestedAutoRenewStatus;
            autoRenewIsDisabled = true;
            autoRenewStatusText = "(request pending)";
            autoRenewLabelClass += " pending-request";
        }

        row.innerHTML = `
            <td class="px-2 py-3 whitespace-nowrap text-sm"><input type="checkbox" data-domain-id="${domain.id}" data-domain-name="${domain.name}" class="domain-checkbox form-checkbox h-4 w-4 text-indigo-500 border-gray-600 rounded focus:ring-indigo-400 bg-gray-700"></td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">${domain.name}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">${formatSimpleDate(domain.regDate)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">${formatSimpleDate(domain.expDate)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${domain.status}</span></td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
                <div class="flex items-center">
                    <label class="${autoRenewLabelClass}">
                        <input type="checkbox" value="" class="sr-only peer" ${autoRenewIsChecked ? 'checked' : ''} ${autoRenewIsDisabled ? 'disabled' : ''} data-domain-id="${domain.id}" data-action="toggle-auto-renew">
                        <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                    <span class="request-status-text ml-2 text-xs ${!pendingAutoRenewReq ? 'hidden' : ''}">${autoRenewStatusText}</span>
                </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                <button class="text-indigo-400 hover:text-indigo-300 manage-domain-btn" data-domain-id="${domain.id}">Manage</button>
                <button class="text-green-400 hover:text-green-300 renew-domain-btn" data-domain-id="${domain.id}" data-domain-name="${domain.name}">Renew</button>
            </td>`;

        row.querySelector('.manage-domain-btn').addEventListener('click', () => viewDomainDetails(domain.id));
        row.querySelector('.renew-domain-btn').addEventListener('click', () => openRenewModalForClient(domain.id, domain.name));
    });
    updateBulkActionVisibility();
}


export function updateBulkActionVisibility() {
    const bulkRenewButton = bulkRenewActionButtonEl();
    if (bulkRenewButton) {
        const selectedCheckboxes = document.querySelectorAll('.domain-checkbox:checked');
        bulkRenewButton.classList.toggle('hidden', selectedCheckboxes.length === 0);
    }
}

async function handleAutoRenewToggle(event, domainId, requestedStatus) {
    const checkbox = event.target;
    const labelElement = checkbox.closest('label');
    const statusTextElement = labelElement ? labelElement.nextElementSibling : null;
    const currentDomains = getClientDomainsData();
    const domain = currentDomains.find(d => d.id === domainId);

    if (!domain) {
        showMessage("Error: Domain data not found for auto-renew toggle.", "error");
        if (checkbox) checkbox.checked = !requestedStatus; // Revert UI
        return;
    }
    const actualCurrentStatusInSystem = domain.autoRenew;

    if (checkbox) checkbox.disabled = true;
    if (labelElement) labelElement.classList.add('pending-request');
    if (statusTextElement) {
        statusTextElement.textContent = "(requesting...)";
        statusTextElement.classList.remove('hidden');
    }

    try {
        const responseData = await submitAutoRenewChange(domainId, requestedStatus);
        showMessage(`Request to ${requestedStatus ? 'enable' : 'disable'} auto-renew for ${responseData.request.domainName} submitted.`, "success");
        await fetchAllClientData(); // Refresh all data including pending requests and domain list
    } catch (error) {
        showMessage(`Error submitting auto-renew request: ${error.message}`, 'error');
        if (checkbox) { // Revert UI on error
            checkbox.checked = actualCurrentStatusInSystem;
            checkbox.disabled = false;
        }
        if (labelElement) labelElement.classList.remove('pending-request');
        if (statusTextElement) {
            statusTextElement.textContent = ""; // Clear status text
            statusTextElement.classList.add('hidden');
        }
        // No need to manually update pending list here, fetchAllClientData will refresh everything
        renderDomainsTable(); // Re-render with original state if error
    }
}

async function handleBulkRenew() {
    const selectedDomainIds = Array.from(document.querySelectorAll('.domain-checkbox:checked'))
                                    .map(cb => parseInt(cb.dataset.domainId, 10));
    if (selectedDomainIds.length === 0) {
        showMessage("No domains selected for renewal.", "error");
        return;
    }

    const renewalDurationYears = 1; // Default or could be from a modal
    const requestSsl = false;       // Default or could be from a modal

    try {
        const responseData = await submitBulkRenewRequest({
            domain_ids: selectedDomainIds,
            renewal_duration_years: renewalDurationYears,
            request_ssl: requestSsl // This field might not be used by backend for bulk
        });

        let message = responseData.message || `${selectedDomainIds.length} renewal requests processed.`;
        if (responseData.errors && responseData.errors.length > 0) {
            message += ` Some errors occurred: ${responseData.errors.map(e => e.domain_name ? `${e.domain_name}: ${e.error}`: `ID ${e.domain_id}: ${e.error}`).join(', ')}`;
            showMessage(message, "error");
        } else {
            showMessage(message, "success");
        }

        const selectAllCheckbox = selectAllDomainsCheckboxEl();
        if(selectAllCheckbox) selectAllCheckbox.checked = false;
        document.querySelectorAll('.domain-checkbox:checked').forEach(cb => cb.checked = false);
        updateBulkActionVisibility();
        await fetchAllClientData(); // Refresh all data
    } catch (error) {
        showMessage(`Bulk Renewal Error: ${error.message}`, "error");
    }
}