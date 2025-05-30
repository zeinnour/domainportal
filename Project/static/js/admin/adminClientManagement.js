// Project/static/js/admin/adminClientManagement.js
import { getAllClientsAdmin, createClientAdmin, editClientAdmin, toggleClientActiveStatusAdmin, getClientDetailsAdmin } from './apiAdminService.js';
import { showMessage as showAdminMessage } from '../common/messageBox.js';
import { openModal, closeModal, resetModalForm } from '../common/modalUtils.js';
import { formatSimpleDate } from '../common/dateUtils.js';
import { showAdminSection, getAdminPageElement, createAdminIcon } from './adminUI.js';
import { openAdminTicketDetailModal }from './adminTicketManagement.js';

// DOM Elements (using getters)
const allClientsTableBodyEl = () => document.getElementById('all-clients-table-body');
const createClientModalEl = () => document.getElementById('create-client-modal');
const createClientFormEl = () => document.getElementById('create-client-form');
const editClientModalEl = () => document.getElementById('edit-client-modal');
const editClientFormEl = () => document.getElementById('edit-client-form');
const editClientIdInputEl = () => document.getElementById('editClientId');
const editClientUsernameDisplayInputEl = () => document.getElementById('editClientUsernameDisplay');
const editClientNameInputEl = () => document.getElementById('editClientName');
const editClientEmailInputEl = () => document.getElementById('editClientEmail');
const editClientPasswordInputEl = () => document.getElementById('editClientPassword');
const editClientConfirmPasswordInputEl = () => document.getElementById('editClientConfirmPassword');

const clientDetailNameEl = () => document.getElementById('client-detail-name');
const clientDetailUsernameEl = () => document.getElementById('client-detail-username');
const clientDetailEmailEl = () => document.getElementById('client-detail-email');
const clientDetailActiveStatusEl = () => document.getElementById('client-detail-active-status');
const clientDetailDomainCountEl = () => document.getElementById('client-detail-domain-count');
const clientDetailDomainsTableBodyEl = () => document.querySelector('#client-detail-domains-table tbody');
const clientDetailDomainsPlaceholderEl = () => document.getElementById('client-detail-domains-placeholder');
const clientDetailRequestCountEl = () => document.getElementById('client-detail-request-count');
const clientDetailRequestsTableBodyEl = () => document.querySelector('#client-detail-requests-table tbody');
const clientDetailRequestsPlaceholderEl = () => document.getElementById('client-detail-requests-placeholder');
const clientDetailTicketCountEl = () => document.getElementById('client-detail-ticket-count');
const clientDetailTicketsTableBodyEl = () => document.querySelector('#client-detail-tickets-table tbody');
const clientDetailTicketsPlaceholderEl = () => document.getElementById('client-detail-tickets-placeholder');
const toggleClientActiveDetailTextEl = () => document.getElementById('toggle-client-active-detail-text');

let allClientsDataCache = [];

export function initializeClientManagement() {
    const tableBody = allClientsTableBodyEl();
    if (tableBody) {
        tableBody.addEventListener('click', function(event){
            const targetButton = event.target.closest('button');
            if (!targetButton) return;

            const clientId = targetButton.dataset.clientId;
            if (!clientId) return;

            if (targetButton.classList.contains('view-client-details-button')) {
                window.location.hash = `client-detail-admin-${clientId}`;
            } else if (targetButton.classList.contains('open-edit-client-button')) {
                openEditClientModal(clientId);
            } else if (targetButton.classList.contains('toggle-client-active-button')) {
                adminToggleClientActiveStatus(clientId);
            }
        });
    }

    const openCreateClientBtn = document.getElementById('open-create-client-modal-button');
    if (openCreateClientBtn) {
        openCreateClientBtn.addEventListener('click', openCreateClientModal);
    }

    const openEditClientDetailBtn = getAdminPageElement('open-edit-client-from-detail-button');
    if (openEditClientDetailBtn) {
        openEditClientDetailBtn.addEventListener('click', () => {
            const clientId = openEditClientDetailBtn.dataset.clientId;
            if (clientId) {
                openEditClientModal(clientId);
            } else {
                console.warn("Client ID not found on edit button from detail page.");
            }
        });
    }

    const toggleActiveDetailBtn = getAdminPageElement('toggle-client-active-from-detail-button');
    if (toggleActiveDetailBtn) {
        toggleActiveDetailBtn.addEventListener('click', () => {
            const clientId = toggleActiveDetailBtn.dataset.clientId;
            if (clientId) {
                adminToggleClientActiveStatus(clientId);
            } else {
                console.warn("Client ID not found on toggle active button from detail page.");
            }
        });
    }
    console.log("Admin Client Management Initialized (with table interactions and button listeners)");
}

export async function fetchAllClients() {
    const tableBody = allClientsTableBodyEl();
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 placeholder-text">Loading clients...</td></tr>`;
    try {
        allClientsDataCache = await getAllClientsAdmin() || [];
        if (tableBody) renderAllClientsTable(allClientsDataCache);
    } catch (error) {
        console.error("Error fetching all clients:", error);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 error-text">Error loading clients.</td></tr>`;
        showAdminMessage(`Error loading clients: ${error.message}`, 'error');
    }
}

export function renderAllClientsTable(clients) {
    const tableBody = allClientsTableBodyEl();
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!clients || clients.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4 placeholder-text">No clients found.</td></tr>';
        return;
    }
    clients.forEach(client => {
        const row = tableBody.insertRow();
        row.className = 'hover:bg-gray-700 transition-colors duration-150';
        let statusBadgeClass = 'status-badge ';
        statusBadgeClass += client.is_active ? 'status-active' : 'status-closed';

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-100">${client.id}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">${client.username}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">${client.name}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">${client.email || 'N/A'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">${client.domain_count || 0}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span class="${statusBadgeClass}">${client.is_active ? 'Active' : 'Inactive'}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-1">
                <button class="btn btn-xs btn-info view-client-details-button" data-client-id="${client.id}">View</button>
                <button class="btn btn-xs btn-secondary open-edit-client-button" data-client-id="${client.id}">Edit</button>
                <button class="btn btn-xs ${client.is_active ? 'btn-warning' : 'btn-success'} toggle-client-active-button" data-client-id="${client.id}">
                    ${client.is_active ? 'Deactivate' : 'Activate'}
                </button>
            </td>
        `;
    });
}

export async function viewClientDetails(clientId) {
    const nameEl = clientDetailNameEl();
    const usernameEl = clientDetailUsernameEl();
    const emailEl = clientDetailEmailEl();
    const activeStatusEl = clientDetailActiveStatusEl();
    // ... (rest of element getters)
    if (nameEl) { nameEl.textContent = 'Loading...'; nameEl.dataset.clientId = clientId; }
    // ... (rest of loading states)
    try {
        const data = await getClientDetailsAdmin(clientId);
        // ... (rest of success population logic)
    } catch (error) {
        console.error("Error fetching client details:", error);
        showAdminMessage(`Error loading client details: ${error.message}`, 'error');
        if (nameEl) nameEl.textContent = 'Error';
    }
}

export function initializeCreateClientModal() {
    const modal = createClientModalEl();
    const form = createClientFormEl();
    if (modal) {
        const closeButton = document.getElementById('close-create-client-modal');
        const cancelButton = document.getElementById('cancel-create-client-button');
        if(closeButton) closeButton.addEventListener('click', () => closeModal(modal));
        if(cancelButton) cancelButton.addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    }
    if (form) {
        form.addEventListener('submit', handleCreateClientFormSubmit);
    }
}
async function handleCreateClientFormSubmit(event) {
    event.preventDefault();
    const form = createClientFormEl();
    const errorSpanIds = ['newClientUsernameError', 'newClientNameError', 'newClientEmailError', 'newClientPasswordError', 'newClientConfirmPasswordError'];
    errorSpanIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });

    const formData = new FormData(form);
    const clientData = Object.fromEntries(formData.entries());

    let preCheckIsValid = true;
    if (!clientData.username.trim()) { document.getElementById('newClientUsernameError').textContent = "Username is required."; document.getElementById('newClientUsernameError').classList.remove('hidden'); preCheckIsValid = false; }
    // ... (other basic client-side checks if desired) ...
    if (!preCheckIsValid) return;

    try {
        const responseData = await createClientAdmin(clientData);
        showAdminMessage("Client created successfully!", "success");
        closeModal(createClientModalEl());
        await fetchAllClients();
    } catch (error) {
        console.error("Client Creation Submit - Caught Error Object:", error); // Log the entire caught object
        
        const fieldErrors = error.errors; // Directly access the 'errors' property from the thrown object

        if (fieldErrors && typeof fieldErrors === 'object' && Object.keys(fieldErrors).length > 0) {
            console.log("Processing backend validation errors:", fieldErrors);
            for (const fieldName in fieldErrors) {
                const errorMessages = fieldErrors[fieldName];
                const errorElId = `newClient${fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_([a-z])/g, g => g[1].toUpperCase())}Error`;
                const errorEl = document.getElementById(errorElId);
                
                console.log(`Field: ${fieldName}, ErrorElId: ${errorElId}, Found Element:`, errorEl, `Messages:`, errorMessages);

                if (errorEl && errorMessages && errorMessages.length > 0) {
                    errorEl.textContent = Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages; 
                    errorEl.classList.remove('hidden');
                    console.log(`Displayed error for ${fieldName}: ${errorEl.textContent}`);
                } else if (errorMessages && errorMessages.length > 0) {
                    console.warn(`Error element ID '${errorElId}' not found for field '${fieldName}'. Displaying as generic message.`);
                    const errorMessage = Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages;
                    showAdminMessage(`${fieldName.replace(/_/g, " ")}: ${errorMessage}`, 'error');
                }
            }
        } else if (error && error.message) {
            showAdminMessage(error.message, 'error'); // General error message
        } else {
            showAdminMessage('An unknown error occurred while creating the client.', 'error');
        }
    }
}
export function openCreateClientModal() {
    const form = createClientFormEl();
    if (form) {
        resetModalForm(form, ['newClientUsernameError', 'newClientNameError', 'newClientEmailError', 'newClientPasswordError', 'newClientConfirmPasswordError']);
    }
    const modal = createClientModalEl();
    if (modal) openModal(modal);
}

export function initializeEditClientModal() {
    // ... (Keep as is)
    const modal = editClientModalEl();
    const form = editClientFormEl();
    if (modal) {
        const closeButton = document.getElementById('close-edit-client-modal');
        const cancelButton = document.getElementById('cancel-edit-client-button');
        if(closeButton) closeButton.addEventListener('click', () => closeModal(modal));
        if(cancelButton) cancelButton.addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    }
    if (form) {
        form.addEventListener('submit', handleEditClientFormSubmit);
    }
}
async function handleEditClientFormSubmit(event) {
    event.preventDefault();
    const form = editClientFormEl();
    const clientId = editClientIdInputEl().value;
    // ... (clear previous errors) ...
    const errorFieldsIds = ['editClientNameError', 'editClientEmailError', 'editClientPasswordError', 'editClientConfirmPasswordError'];
    errorFieldsIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });

    const formData = new FormData(form);
    const clientDataToUpdate = { name: formData.get('name'), email: formData.get('email')};
    // ... (password logic) ...
    const newPassword = formData.get('password');
    if (newPassword) clientDataToUpdate.password = newPassword;


    try {
        const responseData = await editClientAdmin(clientId, clientDataToUpdate);
        showAdminMessage("Client updated successfully!", "success");
        closeModal(editClientModalEl());
        await fetchAllClients();
        // ... (refresh detail view if open) ...
    } catch (error) {
        console.error("Client Edit Submit - Caught Error Object:", error);
        const fieldErrors = error.errors;
        if (error && fieldErrors && typeof fieldErrors === 'object' && Object.keys(fieldErrors).length > 0) {
            console.log("Processing backend validation errors (edit):", fieldErrors);
            for (const fieldName in fieldErrors) {
                const errorMessages = fieldErrors[fieldName];
                let errorElId = '';
                if (fieldName === 'name') errorElId = 'editClientNameError';
                else if (fieldName === 'email') errorElId = 'editClientEmailError';
                else if (fieldName === 'password') errorElId = 'editClientPasswordError';
                else if (fieldName === 'confirm_password') errorElId = 'editClientConfirmPasswordError';

                const errorEl = document.getElementById(errorElId);
                 if (errorEl && errorMessages && errorMessages.length > 0) {
                    errorEl.textContent = Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages; 
                    errorEl.classList.remove('hidden');
                } else if (errorMessages && errorMessages.length > 0) {
                    const errorMessage = Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages;
                    showAdminMessage(`${fieldName.replace(/_/g, " ")}: ${errorMessage}`, 'error');
                }
            }
        } else if (error && error.message) {
            showAdminMessage(error.message, 'error');
        } else {
            showAdminMessage('An unknown error occurred while updating the client.', 'error');
        }
    }
}
export function openEditClientModal(clientId) {
    // ... (Keep as is)
    const client = allClientsDataCache.find(c => c.id === parseInt(clientId));
    if (!client) {
        showAdminMessage("Could not find client data to edit.", "error");
        return;
    }
    const form = editClientFormEl();
    resetModalForm(form, ['editClientNameError', 'editClientEmailError', 'editClientPasswordError', 'editClientConfirmPasswordError']);

    if(editClientIdInputEl()) editClientIdInputEl().value = client.id;
    if(editClientUsernameDisplayInputEl()) editClientUsernameDisplayInputEl().value = client.username;
    if(editClientNameInputEl()) editClientNameInputEl().value = client.name;
    if(editClientEmailInputEl()) editClientEmailInputEl().value = client.email;
    if(editClientPasswordInputEl()) editClientPasswordInputEl().value = '';
    if(editClientConfirmPasswordInputEl()) editClientConfirmPasswordInputEl().value = '';

    const modal = editClientModalEl();
    if(modal) openModal(modal);
}

export async function adminToggleClientActiveStatus(clientId) {
    // ... (Keep as is)
    if (!clientId) {
        showAdminMessage("Client ID missing for status toggle.", "error");
        return;
    }
    const client = allClientsDataCache.find(c => c.id === parseInt(clientId));
    const actionText = client && client.is_active ? "deactivate" : "activate";

    if (!confirm(`Are you sure you want to ${actionText} client ${client ? client.username : `ID ${clientId}`}?`)) {
        return;
    }
    try {
        const responseData = await toggleClientActiveStatusAdmin(clientId);
        showAdminMessage(responseData.message, "success");
        await fetchAllClients();

        const clientDetailSection = getAdminPageElement('client-detail-admin-section');
        const currentDetailClientId = getAdminPageElement('client-detail-name')?.dataset.clientId;
        if (clientDetailSection && !clientDetailSection.classList.contains('hidden') && currentDetailClientId === clientId.toString()) {
            viewClientDetails(clientId);
        }
    } catch (error) {
        console.error("Error toggling client active status:", error);
        showAdminMessage(`Error: ${error.message}`, 'error');
    }
}
