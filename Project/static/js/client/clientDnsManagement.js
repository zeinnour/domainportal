// Project/static/js/client/clientDnsManagement.js
import { openModal, closeModal, resetModalForm, initializeModalCloseEvents } from '../common/modalUtils.js';
import { showMessage, createClientIcon as createIcon } from './clientUI.js';
import { submitDnsChangeRequest } from './apiClientService.js';
import { fetchAllClientData } from './client_main.js';
import { getCurrentManagingDomainId, getClientDomainsData, viewDomainDetails } from './clientDomainDetail.js'; // For context

// --- DOM Elements for DNS Modals ---
// Add DNS Record Modal
const addDnsRecordModalEl = () => document.getElementById('add-dns-record-modal');
const addDnsRecordFormEl = () => document.getElementById('add-dns-record-form');
const addDnsRecordDomainIdInputEl = () => document.getElementById('addDnsRecordDomainId');
const addDnsRecordDomainNameDisplayEl = () => document.getElementById('addDnsRecordDomainNameDisplay');
const dnsRecordTypeSelectEl = () => document.getElementById('dnsRecordType');
const dnsRecordPriorityContainerEl = () => document.getElementById('dnsRecordPriorityContainer');
const dnsRecordPriorityInputEl = () => document.getElementById('dnsRecordPriority');


// Edit DNS Record Modal
const editDnsRecordModalEl = () => document.getElementById('edit-dns-record-modal');
const editDnsRecordFormEl = () => document.getElementById('edit-dns-record-form');
const editDnsRecordDomainIdInputEl = () => document.getElementById('editDnsRecordDomainId');
const editDnsRecordDomainNameDisplayEl = () => document.getElementById('editDnsRecordDomainNameDisplay');
const editDnsRecordOriginalIdInputEl = () => document.getElementById('editDnsRecordOriginalId');
const editDnsRecordTypeSelectEl = () => document.getElementById('editDnsRecordType');
const editDnsRecordHostInputEl = () => document.getElementById('editDnsRecordHost');
const editDnsRecordValueInputEl = () => document.getElementById('editDnsRecordValue');
const editDnsRecordTTLInputEl = () => document.getElementById('editDnsRecordTTL');
const editDnsRecordPriorityInputEl = () => document.getElementById('editDnsRecordPriority');
const editDnsRecordPriorityContainerEl = () => document.getElementById('editDnsRecordPriorityContainer');

// Confirm Delete DNS Record Modal
const confirmDeleteDnsRecordModalEl = () => document.getElementById('confirm-delete-dns-record-modal');
const deleteDnsRecordSummaryEl = () => document.getElementById('delete-dns-record-summary');
const deleteDnsRecordDomainIdInputEl = () => document.getElementById('deleteDnsRecordDomainId');
const deleteDnsRecordIdentifierInputEl = () => document.getElementById('deleteDnsRecordIdentifier');

export function initializeDnsManagementModals() {
    // Add DNS Record Modal
    const addModal = addDnsRecordModalEl();
    const addForm = addDnsRecordFormEl();
    const typeSelect = dnsRecordTypeSelectEl();
    const priorityContainer = dnsRecordPriorityContainerEl();

    if (addModal) {
        initializeModalCloseEvents('add-dns-record-modal', 'close-add-dns-record-modal', 'cancel-add-dns-record-button');
    }
    if (addForm) {
        addForm.addEventListener('submit', handleAddDnsRecordSubmit);
    }
    if (typeSelect && priorityContainer) {
        typeSelect.addEventListener('change', function() {
            const selectedType = this.value;
            priorityContainer.classList.toggle('hidden', !(selectedType === 'MX' || selectedType === 'SRV'));
        });
    }

    // Edit DNS Record Modal
    const editModal = editDnsRecordModalEl();
    const editForm = editDnsRecordFormEl();
    const editTypeSelect = editDnsRecordTypeSelectEl();
    const editPriorityContainer = editDnsRecordPriorityContainerEl();

    if(editModal) {
        initializeModalCloseEvents('edit-dns-record-modal', 'close-edit-dns-record-modal', 'cancel-edit-dns-record-button');
    }
    if(editForm) {
        editForm.addEventListener('submit', handleEditDnsRecordSubmit);
    }
    if(editTypeSelect && editPriorityContainer) {
        editTypeSelect.addEventListener('change', function() {
            editPriorityContainer.classList.toggle('hidden', !(this.value === 'MX' || this.value === 'SRV'));
        });
    }


    // Confirm Delete DNS Record Modal
    const deleteModal = confirmDeleteDnsRecordModalEl();
    if (deleteModal) {
        initializeModalCloseEvents('confirm-delete-dns-record-modal', 'close-confirm-delete-dns-record-modal', 'cancel-delete-dns-record-button');
        const submitDeleteButton = document.getElementById('confirm-delete-dns-record-submit-button');
        if (submitDeleteButton) {
            submitDeleteButton.addEventListener('click', handleDeleteDnsRecordSubmit);
        }
    }

    // Event delegation for Edit/Delete buttons on DNS records table (in domain detail view)
    const dnsRecordsTableBody = document.querySelector('#dns-records-table tbody'); // Or pass from domainDetail
    if (dnsRecordsTableBody) {
        dnsRecordsTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const editButton = target.closest('.edit-dns-record-button');
            const deleteButton = target.closest('.delete-dns-record-button');
            const domainId = getCurrentManagingDomainId();
            const domainsData = getClientDomainsData();
            const domain = domainsData.find(d => d.id === domainId);

            if (!domain) return;

            if (editButton) {
                const row = editButton.closest('tr');
                if (row) openEditDnsRecordModal(domain, row);
            } else if (deleteButton) {
                const row = deleteButton.closest('tr');
                if (row) openDeleteDnsConfirmModal(domain, row);
            }
        });
    }
    console.log("Client DNS Management Modals Initialized.");
}

export function openAddDnsRecordModal(domainId, domainName) {
    const modal = addDnsRecordModalEl();
    const form = addDnsRecordFormEl();
    const domainIdInput = addDnsRecordDomainIdInputEl();
    const domainNameDisplay = addDnsRecordDomainNameDisplayEl();
    const priorityContainer = dnsRecordPriorityContainerEl();

    if (!modal || !form || !domainIdInput || !domainNameDisplay || !priorityContainer) {
        showMessage("Error: Add DNS Record modal components not found.", "error");
        return;
    }
    resetModalForm(form, ['dnsRecordTypeError', 'dnsRecordHostError', 'dnsRecordValueError']);
    domainIdInput.value = domainId;
    domainNameDisplay.textContent = domainName;
    priorityContainer.classList.add('hidden');
    const priorityInput = dnsRecordPriorityInputEl();
    if(priorityInput) priorityInput.value = ''; // Explicitly clear

    openModal(modal);
}

async function handleAddDnsRecordSubmit(event) {
    event.preventDefault();
    const form = addDnsRecordFormEl();
    const domainId = addDnsRecordDomainIdInputEl().value;
    ['dnsRecordTypeError', 'dnsRecordHostError', 'dnsRecordValueError'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.textContent = ''; el.classList.add('hidden'); }
    });

    const recordType = document.getElementById('dnsRecordType').value;
    const recordHost = document.getElementById('dnsRecordHost').value.trim();
    const recordValue = document.getElementById('dnsRecordValue').value.trim();
    const recordTTL = parseInt(document.getElementById('dnsRecordTTL').value, 10) || 3600;
    let recordPriority = (recordType === 'MX' || recordType === 'SRV') ? (parseInt(document.getElementById('dnsRecordPriority').value, 10) || null) : null;

    let isValid = true;
    if (!recordType) { document.getElementById('dnsRecordTypeError').textContent = "Type is required."; document.getElementById('dnsRecordTypeError').classList.remove('hidden'); isValid = false; }
    if (!recordHost) { document.getElementById('dnsRecordHostError').textContent = "Host is required."; document.getElementById('dnsRecordHostError').classList.remove('hidden'); isValid = false; }
    if (!recordValue) { document.getElementById('dnsRecordValueError').textContent = "Value is required."; document.getElementById('dnsRecordValueError').classList.remove('hidden'); isValid = false; }
    if (!isValid) return;

    const recordData = { type: recordType, host: recordHost, value: recordValue, ttl: recordTTL };
    if (recordPriority !== null) recordData.priority = recordPriority;

    const dnsChangePayload = { domainId: parseInt(domainId), recordsToAdd: [recordData] };

    try {
        await submitDnsChangeRequest(dnsChangePayload);
        showMessage("DNS record addition request submitted!", "success");
        closeModal(addDnsRecordModalEl());
        await fetchAllClientData(); // Refreshes pending requests and potentially domain details
        // If domain detail section is active, refresh it to show pending status
        const activeDomainDetailSection = document.getElementById('domain-detail-section');
        if(activeDomainDetailSection && !activeDomainDetailSection.classList.contains('hidden') && getCurrentManagingDomainId() == domainId) {
            viewDomainDetails(parseInt(domainId));
        }
    } catch (error) {
        showMessage(`Error submitting DNS add request: ${error.message}`, 'error');
    }
}

function openEditDnsRecordModal(domain, recordRow) {
    const modal = editDnsRecordModalEl();
    const form = editDnsRecordFormEl();
    if (!modal || !form) { showMessage("Edit DNS modal elements missing.", "error"); return; }

    resetModalForm(form, ['editDnsRecordTypeError', 'editDnsRecordHostError', 'editDnsRecordValueError']);

    if(editDnsRecordDomainIdInputEl()) editDnsRecordDomainIdInputEl().value = domain.id;
    if(editDnsRecordDomainNameDisplayEl()) editDnsRecordDomainNameDisplayEl().textContent = domain.name;
    if(editDnsRecordOriginalIdInputEl()) editDnsRecordOriginalIdInputEl().value = recordRow.dataset.recordId || `static-edit-${Date.now()}`; // Placeholder ID if not dynamic
    if(editDnsRecordTypeSelectEl()) editDnsRecordTypeSelectEl().value = recordRow.dataset.recordType || 'A';
    if(editDnsRecordHostInputEl()) editDnsRecordHostInputEl().value = recordRow.dataset.recordHost || '';
    if(editDnsRecordValueInputEl()) editDnsRecordValueInputEl().value = recordRow.dataset.recordValue || '';
    if(editDnsRecordTTLInputEl()) editDnsRecordTTLInputEl().value = recordRow.dataset.recordTtl || '3600';

    const priority = recordRow.dataset.recordPriority;
    const type = recordRow.dataset.recordType;
    const priorityContainer = editDnsRecordPriorityContainerEl();
    const priorityInput = editDnsRecordPriorityInputEl();

    if(priorityContainer) priorityContainer.classList.toggle('hidden', !(type === 'MX' || type === 'SRV'));
    if(priorityInput) priorityInput.value = (type === 'MX' || type === 'SRV') && priority ? priority : '';

    openModal(modal);
}

async function handleEditDnsRecordSubmit(event) {
    event.preventDefault();
    const domainId = editDnsRecordDomainIdInputEl().value;
    const originalRecordId = editDnsRecordOriginalIdInputEl().value; // Important for identifying which record is being edited if backend needs it
    ['editDnsRecordTypeError', 'editDnsRecordHostError', 'editDnsRecordValueError'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.textContent = ''; el.classList.add('hidden'); }
    });

    const updatedRecord = {
        type: editDnsRecordTypeSelectEl().value,
        host: editDnsRecordHostInputEl().value.trim(),
        value: editDnsRecordValueInputEl().value.trim(),
        ttl: parseInt(editDnsRecordTTLInputEl().value, 10) || 3600,
        priority: null // Will be set if applicable
    };
    if (updatedRecord.type === 'MX' || updatedRecord.type === 'SRV') {
        updatedRecord.priority = parseInt(editDnsRecordPriorityInputEl().value, 10) || null; // Provide null if empty or invalid
    }

    let isValid = true;
    if (!updatedRecord.type) { document.getElementById('editDnsRecordTypeError').textContent = "Type is required."; document.getElementById('editDnsRecordTypeError').classList.remove('hidden'); isValid = false; }
    if (!updatedRecord.host) { document.getElementById('editDnsRecordHostError').textContent = "Host is required."; document.getElementById('editDnsRecordHostError').classList.remove('hidden'); isValid = false; }
    if (!updatedRecord.value) { document.getElementById('editDnsRecordValueError').textContent = "Value is required."; document.getElementById('editDnsRecordValueError').classList.remove('hidden'); isValid = false; }
    if (!isValid) return;

    // For client-side, sending a descriptive change request is more common than specific record edits.
    // The backend would parse this description.
    const originalRow = document.querySelector(`#dns-records-table tbody tr[data-record-id="${originalRecordId}"]`);
    const originalDetails = originalRow ? `Original: Type: ${originalRow.dataset.recordType}, Host: ${originalRow.dataset.recordHost}, Value: ${originalRow.dataset.recordValue}` : "Original record details not found on page.";
    const changeDescription = `Client requests to EDIT DNS record (Ref ID: ${originalRecordId}).\n${originalDetails}\nTo Become: Type: ${updatedRecord.type}, Host: ${updatedRecord.host}, Value: ${updatedRecord.value}, TTL: ${updatedRecord.ttl}${updatedRecord.priority !== null ? ', Priority: ' + updatedRecord.priority : ''}`;

    const dnsChangePayload = { domainId: parseInt(domainId), changeDescription: changeDescription };

    try {
        await submitDnsChangeRequest(dnsChangePayload);
        showMessage("DNS record edit request submitted!", "success");
        closeModal(editDnsRecordModalEl());
        await fetchAllClientData();
        const activeDomainDetailSection = document.getElementById('domain-detail-section');
        if(activeDomainDetailSection && !activeDomainDetailSection.classList.contains('hidden') && getCurrentManagingDomainId() == domainId) {
            viewDomainDetails(parseInt(domainId));
        }
    } catch (error) {
        showMessage(`Error submitting DNS edit request: ${error.message}`, 'error');
    }
}

function openDeleteDnsConfirmModal(domain, recordRow) {
    const modal = confirmDeleteDnsRecordModalEl();
    if (!modal) { showMessage("Delete DNS confirmation modal missing.", "error"); return; }

    if(deleteDnsRecordDomainIdInputEl()) deleteDnsRecordDomainIdInputEl().value = domain.id;
    if(deleteDnsRecordIdentifierInputEl()) deleteDnsRecordIdentifierInputEl().value = recordRow.dataset.recordId; // Or a unique identifier for the record
    if(deleteDnsRecordSummaryEl()) {
        deleteDnsRecordSummaryEl().innerHTML = `<strong>Type:</strong> ${recordRow.dataset.recordType}<br><strong>Host:</strong> ${recordRow.dataset.recordHost}<br><strong>Value:</strong> ${recordRow.dataset.recordValue}`;
    }
    openModal(modal);
}

async function handleDeleteDnsRecordSubmit() {
    const domainId = deleteDnsRecordDomainIdInputEl().value;
    const recordIdentifier = deleteDnsRecordIdentifierInputEl().value;
    const summaryText = deleteDnsRecordSummaryEl().innerHTML.replace(/<br>/g, '\n').replace(/<strong>(.*?)<\/strong>/g, '$1');

    const changeDescription = `Client requests to DELETE DNS record (Ref ID: ${recordIdentifier}):\n${summaryText}`;
    const dnsChangePayload = { domainId: parseInt(domainId), changeDescription: changeDescription };

    try {
        await submitDnsChangeRequest(dnsChangePayload);
        showMessage("DNS record deletion request submitted!", "success");
        closeModal(confirmDeleteDnsRecordModalEl());
        await fetchAllClientData();
        const activeDomainDetailSection = document.getElementById('domain-detail-section');
        if(activeDomainDetailSection && !activeDomainDetailSection.classList.contains('hidden') && getCurrentManagingDomainId() == domainId) {
            viewDomainDetails(parseInt(domainId));
        }
    } catch (error) {
        showMessage(`Error submitting DNS delete request: ${error.message}`, 'error');
    }
}