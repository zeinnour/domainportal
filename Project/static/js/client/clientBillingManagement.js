// Project/static/js/client/clientBillingManagement.js
import { formatSimpleDate } from '../common/dateUtils.js';
import { showMessage } from '../common/messageBox.js'; // Corrected: showMessage is from messageBox.js
import { openModal, closeModal, resetModalForm, initializeModalCloseEvents } from '../common/modalUtils.js'; // Other modal utilities
import * as API from './apiClientService.js';
import { fetchAllClientData } from './client_main.js'; // To refresh data

// DOM Elements
const billingHistoryTableBodyEl = () => document.getElementById('billing-history-table-body');
const paymentProofModalEl = () => document.getElementById('payment-proof-modal');
const paymentProofFormEl = () => document.getElementById('payment-proof-form');
const paymentProofInvoiceIdInputEl = () => document.getElementById('paymentProofInvoiceId');
const paymentProofInvoiceNumberDisplayEl = () => document.getElementById('paymentProofInvoiceNumberDisplay');
const paymentProofAmountDisplayEl = () => document.getElementById('paymentProofAmountDisplay');
const paymentNotesTextareaEl = () => document.getElementById('paymentNotes');
const paymentNotesErrorEl = () => document.getElementById('paymentNotesError');

let clientInvoicesCache = [];
let pendingPaymentProofsCache = []; // To keep track of proofs submitted by client but not yet approved by admin

export const setClientInvoicesCache = (invoices) => { clientInvoicesCache = invoices; };
export const setPendingPaymentProofsCache = (proofs) => { pendingPaymentProofsCache = proofs; };


export function initializeClientBilling() {
    const paymentModal = paymentProofModalEl();
    const paymentForm = paymentProofFormEl();

    if (paymentModal) {
        initializeModalCloseEvents('payment-proof-modal', 'close-payment-proof-modal', 'cancel-payment-proof-button');
    }
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentProofSubmit);
    }

    // Event delegation for "Mark as Paid" buttons in the billing table
    const tableBody = billingHistoryTableBodyEl();
    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const button = event.target.closest('.mark-paid-button');
            if (button) {
                const invoiceId = button.dataset.invoiceId;
                const invoiceNumber = button.dataset.invoiceNumber;
                const invoiceAmount = button.dataset.invoiceAmount;
                if (invoiceId && invoiceNumber && invoiceAmount) {
                    openPaymentProofModal(invoiceId, invoiceNumber, invoiceAmount);
                } else {
                    showMessage("Could not retrieve invoice details for payment proof.", "error");
                }
            }
        });
    }
    console.log("Client Billing System Initialized.");
}

export function renderBillingHistoryTable() {
    const tableBody = billingHistoryTableBodyEl();
    if (!tableBody) {
        console.error("Billing history table body not found.");
        return;
    }
    tableBody.innerHTML = ''; // Clear existing

    if (!clientInvoicesCache || clientInvoicesCache.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-gray-400">No invoices found.</td></tr>';
        return;
    }

    clientInvoicesCache.forEach(invoice => {
        const row = tableBody.insertRow();
        let statusClass = '';
        switch (invoice.status.toLowerCase()) {
            case 'paid': statusClass = 'status-paid'; break;
            case 'pending payment': statusClass = 'status-pending'; break;
            case 'overdue': statusClass = 'status-failed'; break; // Using 'failed' style for overdue
            case 'cancelled': statusClass = 'status-closed'; break; // Using 'closed' style for cancelled
            default: statusClass = 'bg-gray-500 text-gray-100'; // A generic default
        }

        // Check if a payment proof is pending for this invoice
        // Note: pendingPaymentProofsCache needs to be populated from DomainRequest objects of type 'payment_proof'
        const pendingProof = pendingPaymentProofsCache.find(
            p => p.invoiceId === invoice.id && p.status === 'Pending Admin Approval'
        );

        let actionButtonHtml = '';
        if (invoice.status === 'Pending Payment' && !pendingProof) {
            actionButtonHtml = `<button class="btn btn-xs btn-success mark-paid-button" data-invoice-id="${invoice.id}" data-invoice-number="${invoice.invoice_number}" data-invoice-amount="${invoice.amount}">Submit Payment Proof</button>`;
        } else if (pendingProof) {
            actionButtonHtml = `<span class="text-xs text-yellow-400">Proof Submitted</span>`;
        } else if (invoice.status === 'Paid') {
            actionButtonHtml = `<span class="text-xs text-green-400">Paid on ${formatSimpleDate(invoice.payment_date)}</span>`;
        } else {
            // For 'Overdue', 'Cancelled', or other states without a direct action from this button
            actionButtonHtml = `<a href="#" class="text-indigo-400 hover:text-indigo-300 text-xs view-invoice-pdf-link" data-invoice-id="${invoice.id}">View PDF (Future)</a>`;
        }


        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm">${invoice.invoice_number}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">${formatSimpleDate(invoice.issue_date)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">${formatSimpleDate(invoice.due_date)}</td>
            <td class="px-4 py-3 text-sm">${invoice.description}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-right">$${parseFloat(invoice.amount).toFixed(2)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm"><span class="status-badge ${statusClass}">${invoice.status}</span></td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">${actionButtonHtml}</td>
        `;
    });
     // Add event listener for future PDF links if implemented
    document.querySelectorAll('.view-invoice-pdf-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const invoiceId = this.dataset.invoiceId;
            showMessage(`Viewing PDF for invoice ID ${invoiceId} is not yet implemented.`, 'info');
        });
    });
}

export function openPaymentProofModal(invoiceId, invoiceNumber, amount) {
    const modal = paymentProofModalEl();
    const form = paymentProofFormEl();
    const idInput = paymentProofInvoiceIdInputEl();
    const numberDisplay = paymentProofInvoiceNumberDisplayEl();
    const amountDisplay = paymentProofAmountDisplayEl();
    const notesTextarea = paymentNotesTextareaEl();
    const notesError = paymentNotesErrorEl();

    if (!modal || !form || !idInput || !numberDisplay || !amountDisplay || !notesTextarea || !notesError) {
        showMessage("Payment proof modal components are missing.", "error");
        return;
    }
    resetModalForm(form, [notesError.id]);
    idInput.value = invoiceId;
    numberDisplay.textContent = invoiceNumber;
    amountDisplay.textContent = `$${parseFloat(amount).toFixed(2)}`;
    notesTextarea.value = '';
    openModal(modal);
}

async function handlePaymentProofSubmit(event) {
    event.preventDefault();
    const invoiceId = paymentProofInvoiceIdInputEl().value;
    const notes = paymentNotesTextareaEl().value.trim();
    const notesError = paymentNotesErrorEl();
    const notesTextarea = paymentNotesTextareaEl();


    if (!notes) {
        if(notesError) {
            notesError.textContent = "Payment notes (e.g., transaction ID) are required.";
            notesError.classList.remove('hidden');
        }
        if(notesTextarea) {
            notesTextarea.classList.add('error', 'shake-animation');
            setTimeout(() => { if(notesTextarea) notesTextarea.classList.remove('shake-animation'); }, 500);
        }
        return;
    }
    if(notesError) notesError.classList.add('hidden');
    if(notesTextarea) notesTextarea.classList.remove('error');

    try {
        await API.submitPaymentProof(invoiceId, notes);
        showMessage("Payment proof submitted successfully for review!", "success");
        closeModal(paymentProofModalEl());
        // The backend creates a DomainRequest of type 'payment_proof'.
        // fetchAllClientData will retrieve this and update pending counts/alerts.
        await fetchAllClientData();
    } catch (error) {
        showMessage(`Error submitting payment proof: ${error.message}`, 'error');
    }
}