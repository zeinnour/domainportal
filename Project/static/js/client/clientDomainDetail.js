// Project/static/js/client/clientDomainDetail.js
import { formatSimpleDate } from '../common/dateUtils.js';
import { showMessage, createClientIcon as createIcon, showClientSection } from './clientUI.js'; // clientUI re-exports these
import { openRenewModalForClient, openTransferOutModal, openContactUpdateModalForClient } from './clientRequestModals.js';
import { openAddDnsRecordModal } from './clientDnsManagement.js';
import { submitLockChangeRequest } from './apiClientService.js';
import { fetchAllClientData } from './client_main.js'; // To refresh all data after actions

// DOM Elements for Domain Detail Section
const detailDomainNameEl = () => document.getElementById('detail-domain-name');
const detailRegDateEl = () => document.getElementById('detail-reg-date');
const detailExpDateEl = () => document.getElementById('detail-exp-date');
const detailAutoRenewStatusEl = () => document.getElementById('detail-auto-renew-status');
const detailDomainStatusEl = () => document.getElementById('detail-domain-status');
const detailDomainLockStatusEl = () => document.getElementById('detail-domain-lock-status');
const toggleLockButtonTextEl = () => document.getElementById('toggle-lock-button-text');
const requestDomainLockButtonEl = () => document.getElementById('request-domain-lock-button');
const renewDomainFromDetailButtonEl = () => document.getElementById('renew-domain-from-detail-button');
const requestTransferOutDetailButtonEl = () => document.getElementById('request-transfer-out-detail-button');
// Corrected declaration for requestDnsChangesButtonEl:
const requestDnsChangesButtonEl = () => document.getElementById('request-dns-changes-button'); // Comment moved or integrated.
const requestContactInfoUpdateButtonEl = () => document.getElementById('request-contact-info-update-button');
const openAddDnsRecordModalButtonEl = () => document.getElementById('open-add-dns-record-modal-button');
const dnsRecordsTableBodyInnerEl = () => document.querySelector('#dns-records-table tbody');
const dnsStatusTextElementEl = () => document.getElementById('detail-dns-request-status');


// Global state for this module (or potentially a shared client state module)
let currentManagingDomainId = null;
let clientDomainsData = [];
let pendingLockChangeRequests = [];
let pendingDnsChangeRequests = [];
let pendingAutoRenewRequests = [];

export const getCurrentManagingDomainId = () => currentManagingDomainId;
export const setCurrentManagingDomainId = (id) => { currentManagingDomainId = id; };
export const getClientDomainsData = () => clientDomainsData;
export const setClientDomainsData = (data) => { clientDomainsData = Array.isArray(data) ? data : []; };
export const getPendingLockRequests = () => pendingLockChangeRequests;
export const setPendingLockRequests = (data) => { pendingLockChangeRequests = Array.isArray(data) ? data : []; };
export const getPendingDnsRequests = () => pendingDnsChangeRequests;
export const setPendingDnsRequests = (data) => { pendingDnsChangeRequests = Array.isArray(data) ? data : []; };
export const getPendingAutoRenewRequests = () => pendingAutoRenewRequests;
export const setPendingAutoRenewRequests = (data) => { pendingAutoRenewRequests = Array.isArray(data) ? data : [];};


export function initializeDomainDetailPage() {
    const renewBtn = renewDomainFromDetailButtonEl();
    const lockBtn = requestDomainLockButtonEl();
    const transferOutBtn = requestTransferOutDetailButtonEl();
    const contactUpdateBtn = requestContactInfoUpdateButtonEl();
    const openAddDnsBtn = openAddDnsRecordModalButtonEl();
    const oldDnsChangeBtn = requestDnsChangesButtonEl();

    if (renewBtn) renewBtn.addEventListener('click', handleRenewFromDetail);
    if (lockBtn) lockBtn.addEventListener('click', handleDomainLockToggle);
    if (transferOutBtn) transferOutBtn.addEventListener('click', handleTransferOutFromDetail);
    if (contactUpdateBtn) contactUpdateBtn.addEventListener('click', handleContactUpdateFromDetail);
    if (openAddDnsBtn) openAddDnsBtn.addEventListener('click', handleOpenAddDnsModal);

    // If you keep the oldDnsChangeBtn, decide its functionality:
    if (oldDnsChangeBtn) {
        oldDnsChangeBtn.addEventListener('click', () => {
            // Assuming showNotImplementedModal is correctly available (e.g. imported from common/modalUtils directly or re-exported by clientUI)
            // For direct import: import { showNotImplementedModal } from '../common/modalUtils.js';
            // If re-exported by clientUI (as commonShowNotImplementedModal as showNotImplementedModal):
            // import { showNotImplementedModal } from './clientUI.js';
            // For now, assuming it's globally available or correctly imported elsewhere where clientUI is set up.
            // This will call the aliased version commonShowNotImplementedModal if it's the one in scope.
            if (typeof showNotImplementedModal !== 'undefined') { // Check if function exists
                 showNotImplementedModal("Legacy DNS Assistance");
            } else if (typeof commonShowNotImplementedModal !== 'undefined') { // Check for the aliased version
                 commonShowNotImplementedModal("Legacy DNS Assistance");
            } else {
                showMessage("This DNS feature (legacy) is not currently available.", "info");
            }
        });
    }

    console.log("Client Domain Detail Page Initialized.");
}

export function viewDomainDetails(domainId) {
    setCurrentManagingDomainId(domainId);
    const domain = clientDomainsData.find(d => d.id === domainId);

    if (!domain) {
        showMessage("Could not find details for the selected domain.", "error");
        showClientSection('domains'); // Go back to list if domain not found
        return;
    }

    // Populate basic domain info
    const nameEl = detailDomainNameEl();
    const regDateEl = detailRegDateEl();
    const expDateEl = detailExpDateEl();
    const autoRenewStatusEl = detailAutoRenewStatusEl();
    const domainStatusEl = detailDomainStatusEl();

    if(nameEl) nameEl.textContent = domain.name;
    if(regDateEl) regDateEl.textContent = formatSimpleDate(domain.regDate);
    if(expDateEl) expDateEl.textContent = formatSimpleDate(domain.expDate);
    if(autoRenewStatusEl) autoRenewStatusEl.textContent = domain.autoRenew ? 'Enabled' : 'Disabled';
    if(domainStatusEl) domainStatusEl.textContent = domain.status;

    // Handle Lock Status display and button
    const pendingLockReq = pendingLockChangeRequests.find(req => req.domainId === domain.id && (req.status === 'Pending Admin Approval' || req.status === 'Pending'));
    const lockStatusDisplay = detailDomainLockStatusEl();
    const lockButtonText = toggleLockButtonTextEl();
    const lockButton = requestDomainLockButtonEl();

    if (lockStatusDisplay) {
        let lockStatusText = domain.is_locked ? 'Locked' : 'Unlocked';
        if (pendingLockReq && pendingLockReq.requestedData) {
            const requestedAction = pendingLockReq.requestedData.requestedLockStatus ? 'Lock' : 'Unlock';
            lockStatusText += ` (Request to ${requestedAction} Pending)`;
        }
        lockStatusDisplay.textContent = lockStatusText;
    }
    if (lockButtonText) {
        lockButtonText.textContent = domain.is_locked ? 'Request Unlock' : 'Request Lock';
        if (pendingLockReq && pendingLockReq.requestedData) {
            const requestedAction = pendingLockReq.requestedData.requestedLockStatus ? 'Lock' : 'Unlock';
            lockButtonText.textContent = `Request to ${requestedAction} Pending`;
        }
    }
    if (lockButton) {
        lockButton.disabled = !!pendingLockReq;
        lockButton.classList.toggle('opacity-50', !!pendingLockReq);
        lockButton.classList.toggle('cursor-not-allowed', !!pendingLockReq);
    }

    // Handle DNS Records and Add Record Button state
    const pendingDnsReq = pendingDnsChangeRequests.find(req => req.domainId === domain.id && (req.status === 'Pending Admin Approval' || req.status === 'Pending'));
    const openAddDnsButton = openAddDnsRecordModalButtonEl();
    const dnsStatusText = dnsStatusTextElementEl();

    if (pendingDnsReq) {
        if (openAddDnsButton) {
            openAddDnsButton.disabled = true;
            openAddDnsButton.classList.add('opacity-50', 'cursor-not-allowed');
            const iconId = `dns-pending-icon-${domain.id}`;
            openAddDnsButton.innerHTML = `<span id="${iconId}"></span> DNS Change Pending`;
            createIcon(iconId, 'Loader2', { class: 'mr-2 h-4 w-4 animate-spin' });
        }
        if (dnsStatusText) { dnsStatusText.textContent = " (DNS Change Request Pending)"; dnsStatusText.classList.remove('hidden'); }
    } else {
        if (openAddDnsButton) {
            openAddDnsButton.disabled = false;
            openAddDnsButton.classList.remove('opacity-50', 'cursor-not-allowed');
            const iconId = `dns-add-icon-${domain.id}`;
            openAddDnsButton.innerHTML = `<span id="${iconId}"></span> Add Record`;
            createIcon(iconId, 'PlusCircle', { class: 'mr-2 h-4 w-4' });
        }
        if (dnsStatusText) { dnsStatusText.textContent = ""; dnsStatusText.classList.add('hidden'); }
    }

    renderStaticDnsRecords(domain);
    showClientSection('domainDetail');
}

function renderStaticDnsRecords(domain) {
    const tableBody = dnsRecordsTableBodyInnerEl();
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const records = [
        { id: `static-1-${domain.id}`, type: "A", host: "@", value: (domain.name === 'example.com' ? '1.2.3.4' : '192.168.1.100'), ttl: "3600", priority: null },
        { id: `static-2-${domain.id}`, type: "CNAME", host: "www", value: domain.name, ttl: "3600", priority: null },
        { id: `static-3-${domain.id}`, type: "MX", host: "@", value: `10 mail.${domain.name}`, ttl: "3600", priority: "10" }
    ];
    const dnsPlaceholder = document.getElementById('dns-records-placeholder');

    if (records.length === 0) {
        if (dnsPlaceholder) dnsPlaceholder.classList.remove('hidden');
    } else {
        if (dnsPlaceholder) dnsPlaceholder.classList.add('hidden');
        records.forEach(rec => {
            const row = tableBody.insertRow();
            row.dataset.recordId = rec.id;
            row.dataset.recordType = rec.type;
            row.dataset.recordHost = rec.host;
            row.dataset.recordValue = rec.value;
            row.dataset.recordTtl = rec.ttl;
            if (rec.priority) row.dataset.recordPriority = rec.priority;

            row.innerHTML = `
                <td class="px-3 py-2">${rec.type}</td>
                <td class="px-3 py-2">${rec.host}</td>
                <td class="px-3 py-2">${rec.value}</td>
                <td class="px-3 py-2">${rec.ttl}</td>
                <td class="px-3 py-2 space-x-1">
                    <button class="btn btn-xs btn-secondary edit-dns-record-button" data-record-id="${rec.id}"><span id="edit-dns-icon-${rec.id}"></span>Edit</button>
                    <button class="btn btn-xs btn-danger delete-dns-record-button" data-record-id="${rec.id}"><span id="delete-dns-icon-${rec.id}"></span>Delete</button>
                </td>
            `;
            createIcon(`edit-dns-icon-${rec.id}`, 'FilePenLine', { class: 'inline h-3 w-3 mr-1' });
            createIcon(`delete-dns-icon-${rec.id}`, 'Trash2', { class: 'inline h-3 w-3 mr-1' });
        });
    }
}

function handleRenewFromDetail() {
    if (currentManagingDomainId) {
        const domain = clientDomainsData.find(d => d.id === currentManagingDomainId);
        if (domain) openRenewModalForClient(domain.id, domain.name);
    }
}

async function handleDomainLockToggle() {
    if (!currentManagingDomainId) {
        showMessage("No domain selected to manage lock status.", "error");
        return;
    }
    const domain = clientDomainsData.find(d => d.id === currentManagingDomainId);
    if (!domain) {
        showMessage("Domain details not found for lock toggle.", "error");
        return;
    }

    const requestedLockStatus = !domain.is_locked;
    const actionText = requestedLockStatus ? "lock" : "unlock";
    const lockButton = requestDomainLockButtonEl();
    const lockButtonText = toggleLockButtonTextEl();

    if (lockButton) lockButton.disabled = true;
    if (lockButtonText) lockButtonText.textContent = `Requesting ${actionText}...`;

    try {
        await submitLockChangeRequest(currentManagingDomainId, requestedLockStatus);
        showMessage(`Request to ${actionText} domain ${domain.name} submitted.`, "success");
        await fetchAllClientData(null); // Fetch all data, which will trigger re-render if section is active
        viewDomainDetails(currentManagingDomainId); // Explicitly refresh the current view
    } catch (error) {
        showMessage(`Error requesting domain ${actionText}: ${error.message}`, "error");
        // Re-enable button and refresh view to original state on error
        if (lockButton) lockButton.disabled = false;
        viewDomainDetails(currentManagingDomainId);
    }
}

function handleTransferOutFromDetail() {
    if (currentManagingDomainId) {
        openTransferOutModal(currentManagingDomainId);
    }
}

function handleContactUpdateFromDetail() {
     if (currentManagingDomainId) {
        const domain = clientDomainsData.find(d => d.id === currentManagingDomainId);
        if (domain) openContactUpdateModalForClient(domain.id, domain.name);
    }
}

function handleOpenAddDnsModal() {
    if (currentManagingDomainId) {
        const domain = clientDomainsData.find(d => d.id === currentManagingDomainId);
        if (domain) openAddDnsRecordModal(domain.id, domain.name);
    }
}