// Project/static/js/admin/adminInvoiceManagement.js
import { showMessage as showAdminMessage } from '../common/messageBox.js';
import {
    getAllAdminInvoices, // <<< CORRECTED IMPORT NAME
    createInvoiceAdmin,
    getInvoiceDetailsAdmin,
    markInvoicePaidAdmin,
    cancelInvoiceAdmin,
    getAllClientsAdmin as fetchAllClientsForInvoiceFilter, // Used for populating client dropdown
    getAllAdminDomains as fetchAllDomainsForInvoiceFilter  // Used for populating domain dropdown
} from './apiAdminService.js';
import { openModal, closeModal, resetModalForm } from '../common/modalUtils.js';
import { formatSimpleDate } from '../common/dateUtils.js';
import { getAdminPageElement, createAdminIcon } from './adminUI.js';


const allInvoicesTableBodyEl = () => document.getElementById('all-invoices-table-body');
const invoiceFiltersFormEl = () => document.getElementById('invoice-filters-form');
const invoiceSearchTermInputEl = () => document.getElementById('invoice-search-term');
const invoiceStatusFilterSelectEl = () => document.getElementById('invoice-status-filter');
const invoiceClientFilterSelectEl = () => document.getElementById('invoice-client-filter');
const clearInvoiceFiltersButtonEl = () => document.getElementById('clear-invoice-filters-button');

const createInvoiceModalEl = () => document.getElementById('create-invoice-modal');
const createInvoiceFormEl = () => document.getElementById('create-invoice-form');
const newInvoiceClientSelectEl = () => document.getElementById('newInvoiceClient');
const newInvoiceDomainSelectEl = () => document.getElementById('newInvoiceDomain');
const newInvoiceIssueDateEl = () => document.getElementById('newInvoiceIssueDate');
const newInvoiceDueDateEl = () => document.getElementById('newInvoiceDueDate');

const viewInvoiceDetailModalEl = () => document.getElementById('view-invoice-detail-modal');
const detailInvoiceNumberEl = () => document.getElementById('detail-invoice-number');
const detailInvoiceStatusEl = () => document.getElementById('detail-invoice-status');
const detailInvoiceClientNameEl = () => document.getElementById('detail-invoice-client-name');
const detailInvoiceClientUsernameEl = () => document.getElementById('detail-invoice-client-username');
const detailInvoiceAmountEl = () => document.getElementById('detail-invoice-amount');
const detailInvoiceIssueDateEl = () => document.getElementById('detail-invoice-issue-date');
const detailInvoiceDueDateEl = () => document.getElementById('detail-invoice-due-date');
const detailInvoicePaymentDateEl = () => document.getElementById('detail-invoice-payment-date');
const detailInvoiceDomainNameEl = () => document.getElementById('detail-invoice-domain-name');
const detailInvoiceDescriptionEl = () => document.getElementById('detail-invoice-description');
const detailInvoiceNotesEl = () => document.getElementById('detail-invoice-notes');


export function initializeAdminBilling() {
    initializeInvoiceFilters();
    initializeInvoiceTableInteractions();
    initializeCreateInvoiceModalAdmin();
    initializeViewInvoiceDetailModalAdmin();
    console.log("Admin Billing Initialized (with table and create button interactions)");
}

export async function initializeInvoiceFilters() {
    const form = invoiceFiltersFormEl();
    const clearButton = clearInvoiceFiltersButtonEl();

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const filters = {
                search_term: invoiceSearchTermInputEl().value.trim(),
                status: invoiceStatusFilterSelectEl().value,
                client_id: invoiceClientFilterSelectEl().value
            };
            await fetchAllAdminInvoices(filters);
        });
    }
    if (clearButton) {
        clearButton.addEventListener('click', async () => {
            if (form) form.reset();
            await fetchAllAdminInvoices(); // Fetch all without filters
        });
    }
    await populateInvoiceClientFilter(); // Populate client filter on init
}

export async function populateInvoiceClientFilter() {
    const selectEl = invoiceClientFilterSelectEl();
    if (!selectEl) {
        console.warn("Invoice client filter select element not found.");
        return;
    }
    try {
        const clients = await fetchAllClientsForInvoiceFilter() || [];
        const currentSelectedClientId = selectEl.value; // Preserve selection if any
        selectEl.innerHTML = '<option value="">All Clients</option>';
        clients.forEach(client => {
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
        console.error("Error populating invoice client filter:", error);
        showAdminMessage("Could not load clients for invoice filter.", "error");
    }
}


function initializeInvoiceTableInteractions() {
    const tableBody = allInvoicesTableBodyEl();
    if (tableBody) {
        tableBody.addEventListener('click', async function(event) {
            const targetButton = event.target.closest('button');
            if (!targetButton) return;

            const invoiceId = targetButton.dataset.invoiceId;
            if (!invoiceId) return;

            if (targetButton.classList.contains('view-invoice-details-button')) {
                openViewInvoiceDetailModal(invoiceId);
            } else if (targetButton.classList.contains('mark-invoice-paid-button')) {
                if (confirm(`Are you sure you want to mark invoice #${invoiceId} as Paid?`)) {
                    try {
                        await markInvoicePaidAdmin(invoiceId);
                        showAdminMessage(`Invoice #${invoiceId} marked as Paid.`, "success");
                        fetchAllAdminInvoices(); // Refresh table
                    } catch (error) {
                        showAdminMessage(`Error marking invoice paid: ${error.message}`, "error");
                    }
                }
            } else if (targetButton.classList.contains('cancel-invoice-button')) {
                 if (confirm(`Are you sure you want to cancel invoice #${invoiceId}? This cannot be undone.`)) {
                    try {
                        await cancelInvoiceAdmin(invoiceId);
                        showAdminMessage(`Invoice #${invoiceId} has been cancelled.`, "success");
                        fetchAllAdminInvoices(); // Refresh table
                    } catch (error) {
                        showAdminMessage(`Error cancelling invoice: ${error.message}`, "error");
                    }
                }
            }
        });
    }
}


export async function fetchAllAdminInvoices(filters = {}) {
    const tableBody = allInvoicesTableBodyEl();
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 placeholder-text">Loading invoices...</td></tr>`;
    try {
        const invoices = await getAllAdminInvoices(filters); // <<< CORRECTED FUNCTION CALL
        renderAllInvoicesTable(invoices);
    } catch (error) {
        console.error("Error fetching all invoices for admin:", error);
        if(tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 error-text">Error loading invoices: ${error.message}</td></tr>`;
        showAdminMessage(`Error loading invoices: ${error.message}`, 'error');
    }
}

function renderAllInvoicesTable(invoices) {
    const tableBody = allInvoicesTableBodyEl();
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!invoices || invoices.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center p-4 placeholder-text">No invoices found matching your criteria.</td></tr>';
        return;
    }

    invoices.forEach(invoice => {
        const row = tableBody.insertRow();
        row.className = 'hover:bg-gray-700 transition-colors duration-150';
        let statusBadgeClass = 'status-badge ';
        const normalizedStatus = invoice.status ? invoice.status.toLowerCase().replace(/\s+/g, '-') : 'unknown';
        statusBadgeClass += `status-${normalizedStatus}`;

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-100">${invoice.invoice_number}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">${invoice.client_name || 'N/A'} (${invoice.client_username || 'N/A'})</td>
            <td class="px-4 py-3 text-sm text-gray-300 truncate max-w-xs">${invoice.description}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-right">$${parseFloat(invoice.amount).toFixed(2)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">${formatSimpleDate(invoice.issue_date)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">${formatSimpleDate(invoice.due_date)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span class="${statusBadgeClass}">${invoice.status}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-1">
                <button class="btn btn-xs btn-info view-invoice-details-button" data-invoice-id="${invoice.id}">Details</button>
                ${invoice.status === 'Pending Payment' || invoice.status === 'Overdue' ? `<button class="btn btn-xs btn-success mark-invoice-paid-button" data-invoice-id="${invoice.id}">Mark Paid</button>` : ''}
                ${invoice.status !== 'Paid' && invoice.status !== 'Cancelled' ? `<button class="btn btn-xs btn-danger cancel-invoice-button" data-invoice-id="${invoice.id}">Cancel</button>` : ''}
            </td>
        `;
    });
}

export function initializeCreateInvoiceModalAdmin() {
    const modal = createInvoiceModalEl();
    const form = createInvoiceFormEl();
    if (modal) {
        const openButton = document.getElementById('open-create-invoice-modal-button');
        const closeButton = document.getElementById('close-create-invoice-modal');
        const cancelButton = document.getElementById('cancel-create-invoice-button');

        if(openButton) openButton.addEventListener('click', async () => {
            resetModalForm(form, ['newInvoiceClientError', 'newInvoiceDescriptionError', 'newInvoiceAmountError', 'newInvoiceIssueDateError', 'newInvoiceDueDateError']);
            await populateInvoiceModalDropdowns();
            openModal(modal);
        });
        if(closeButton) closeButton.addEventListener('click', () => closeModal(modal));
        if(cancelButton) cancelButton.addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    }
    if (form) {
        form.addEventListener('submit', handleCreateInvoiceFormSubmit);
    }
}

async function populateInvoiceModalDropdowns() {
    const clientSelect = newInvoiceClientSelectEl();
    const domainSelect = newInvoiceDomainSelectEl();

    if (clientSelect) {
        try {
            const clients = await fetchAllClientsForInvoiceFilter() || [];
            clientSelect.innerHTML = '<option value="0">-- Select Client --</option>';
            clients.forEach(client => {
                if (client.role === 'client' && client.is_active) {
                    const option = document.createElement('option');
                    option.value = client.id;
                    option.textContent = `${client.name} (${client.username})`;
                    clientSelect.appendChild(option);
                }
            });
        } catch (error) {
            console.error("Error populating clients in invoice modal:", error);
            showAdminMessage("Could not load clients for invoice.", "error");
        }
    }

    if (domainSelect) {
        try {
            const domains = await fetchAllDomainsForInvoiceFilter() || []; // Assuming this fetches all domains
            domainSelect.innerHTML = '<option value="0">N/A - General Invoice</option>';
            domains.forEach(domain => {
                const option = document.createElement('option');
                option.value = domain.id;
                option.textContent = domain.name + (domain.ownerName !== "N/A (Unassigned)" ? ` (${domain.ownerName})` : ' (Unassigned)');
                domainSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error populating domains in invoice modal:", error);
            showAdminMessage("Could not load domains for invoice.", "error");
        }
    }

    // Set default dates
    const issueDateEl = newInvoiceIssueDateEl();
    const dueDateEl = newInvoiceDueDateEl();
    if (issueDateEl) issueDateEl.valueAsDate = new Date();
    if (dueDateEl) {
        const today = new Date();
        dueDateEl.valueAsDate = new Date(today.setDate(today.getDate() + 30)); // Default due in 30 days
    }
}


async function handleCreateInvoiceFormSubmit(event) {
    event.preventDefault();
    const form = createInvoiceFormEl();
    const errorFields = ['newInvoiceClientError', 'newInvoiceDescriptionError', 'newInvoiceAmountError', 'newInvoiceIssueDateError', 'newInvoiceDueDateError'];
    errorFields.forEach(id => { const el = document.getElementById(id); if(el) {el.textContent = ''; el.classList.add('hidden');}});

    const formData = new FormData(form);
    const invoiceData = {
        user_id: formData.get('user_id'),
        domain_id: formData.get('domain_id') === "0" ? null : formData.get('domain_id'), // Send null if "N/A"
        description: formData.get('description'),
        amount: formData.get('amount'),
        issue_date: formData.get('issue_date'),
        due_date: formData.get('due_date'),
        status: formData.get('status'),
        notes: formData.get('notes')
    };

    try {
        await createInvoiceAdmin(invoiceData);
        showAdminMessage("Invoice created successfully!", "success");
        closeModal(createInvoiceModalEl());
        await fetchAllAdminInvoices(); // Refresh table
        await import('./adminDashboard.js').then(module => module.fetchAdminDashboardSummary()); // Refresh dashboard stats
    } catch (error) {
        console.error("Error creating invoice:", error);
        if (error.errors && typeof error.errors === 'object') {
            for (const fieldName in error.errors) {
                // Construct errorElId or use a general message
                let errorElId;
                if (fieldName === 'user_id') errorElId = 'newInvoiceClientError';
                // Add more mappings if needed
                const errorEl = document.getElementById(errorElId);
                if (errorEl) {
                    errorEl.textContent = Array.isArray(error.errors[fieldName]) ? error.errors[fieldName].join(', ') : error.errors[fieldName];
                    errorEl.classList.remove('hidden');
                } else {
                    showAdminMessage(`${fieldName}: ${Array.isArray(error.errors[fieldName]) ? error.errors[fieldName].join(', ') : error.errors[fieldName]}`, 'error');
                }
            }
        } else {
            showAdminMessage(`Error creating invoice: ${error.message || 'Unknown error'}`, 'error');
        }
    }
}

export function initializeViewInvoiceDetailModalAdmin() {
    const modal = viewInvoiceDetailModalEl();
    if(modal) {
        const okButton = document.getElementById('ok-view-invoice-detail-button');
        const closeButton = document.getElementById('close-view-invoice-detail-modal');
        if(okButton) okButton.addEventListener('click', () => closeModal(modal));
        if(closeButton) closeButton.addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    }
}

async function openViewInvoiceDetailModal(invoiceId) {
    const modal = viewInvoiceDetailModalEl();
    if (!modal) return;
    
    // Clear previous details
    if(detailInvoiceNumberEl()) detailInvoiceNumberEl().textContent = 'Loading...';
    // ... clear other detail elements ...

    try {
        const invoice = await getInvoiceDetailsAdmin(invoiceId);
        if(detailInvoiceNumberEl()) detailInvoiceNumberEl().textContent = invoice.invoice_number;
        if(detailInvoiceStatusEl()) {
            detailInvoiceStatusEl().textContent = invoice.status;
            detailInvoiceStatusEl().className = `status-badge status-${invoice.status.toLowerCase().replace(/\s+/g, '-')}`;
        }
        if(detailInvoiceClientNameEl()) detailInvoiceClientNameEl().textContent = invoice.client_name;
        if(detailInvoiceClientUsernameEl()) detailInvoiceClientUsernameEl().textContent = invoice.client_username;
        if(detailInvoiceAmountEl()) detailInvoiceAmountEl().textContent = parseFloat(invoice.amount).toFixed(2);
        if(detailInvoiceIssueDateEl()) detailInvoiceIssueDateEl().textContent = formatSimpleDate(invoice.issue_date);
        if(detailInvoiceDueDateEl()) detailInvoiceDueDateEl().textContent = formatSimpleDate(invoice.due_date);
        if(detailInvoicePaymentDateEl()) detailInvoicePaymentDateEl().textContent = invoice.payment_date ? formatSimpleDate(invoice.payment_date) : 'N/A';
        if(detailInvoiceDomainNameEl()) detailInvoiceDomainNameEl().textContent = invoice.domain_name || 'N/A';
        if(detailInvoiceDescriptionEl()) detailInvoiceDescriptionEl().textContent = invoice.description;
        if(detailInvoiceNotesEl()) detailInvoiceNotesEl().textContent = invoice.notes || 'N/A';

        openModal(modal);
    } catch (error) {
        console.error("Error fetching invoice details:", error);
        showAdminMessage(`Error loading invoice details: ${error.message}`, "error");
    }
}
