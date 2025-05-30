// Project/static/js/admin/adminTicketManagement.js
import { showMessage as showAdminMessage } from '../common/messageBox.js';
import { 
    getAllAdminSupportTickets, 
    adminReplyToTicket, 
    updateRequestStatusAdmin,
    getAdminTicketDetails // <<< ADDED IMPORT
} from './apiAdminService.js';
import { openModal, closeModal, resetModalForm } from '../common/modalUtils.js';
import { formatSimpleDate, formatDateDetailed } from '../common/dateUtils.js';
import { createAdminIcon, getAdminPageElement } from './adminUI.js';

// ... (DOM Element getters - remain the same)
const allSupportTicketsListEl = () => document.getElementById('all-support-tickets-list');
const ticketDetailModalEl = () => document.getElementById('admin-ticket-detail-modal');
const ticketDetailModalTitleEl = () => document.getElementById('ticket-detail-modal-title');
const ticketDetailIdEl = () => document.getElementById('ticket-detail-id');
const ticketDetailSubjectEl = () => document.getElementById('ticket-detail-subject');
const ticketDetailClientNameEl = () => document.getElementById('ticket-detail-client-name');
const ticketDetailClientUsernameEl = () => document.getElementById('ticket-detail-client-username');
const ticketDetailRequestDateEl = () => document.getElementById('ticket-detail-request-date');
const ticketDetailStatusBadgeEl = () => document.getElementById('ticket-detail-status-badge');
const ticketDetailPriorityEl = () => document.getElementById('ticket-detail-priority');
const ticketDetailInitialMessageEl = () => document.getElementById('ticket-detail-initial-message');
const ticketRepliesContainerEl = () => document.getElementById('ticket-replies-container');
const adminTicketReplyFormEl = () => document.getElementById('admin-ticket-reply-form');
const adminReplyTicketIdInputEl = () => document.getElementById('adminReplyTicketId');
const adminReplyMessageTextareaEl = () => document.getElementById('adminReplyMessage');

const ticketDetailMarkResolvedButtonEl = () => document.getElementById('ticket-detail-mark-resolved-button');
const ticketDetailCloseButtonEl = () => document.getElementById('ticket-detail-close-button');
const ticketDetailReopenButtonEl = () => document.getElementById('ticket-detail-reopen-button');


let currentOpenTicketId = null;
let allAdminTicketsCache = [];

export async function fetchAllAdminSupportTickets() {
    const listEl = allSupportTicketsListEl();
    if (!listEl) return;
    listEl.innerHTML = `<p class="placeholder-text col-span-full">Loading support tickets...</p>`;
    try {
        allAdminTicketsCache = await getAllAdminSupportTickets(); 
        renderAllSupportTickets(allAdminTicketsCache);
    } catch (error) {
        console.error("Error fetching admin support tickets:", error);
        if(listEl) listEl.innerHTML = `<p class="error-text col-span-full">Error loading tickets: ${error.message}</p>`;
        showAdminMessage(`Error loading support tickets: ${error.message}`, "error");
    }
}

function renderAllSupportTickets(tickets) {
    // ... (this function remains the same) ...
    const listEl = allSupportTicketsListEl();
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!tickets || tickets.length === 0) {
        listEl.innerHTML = `<p class="placeholder-text col-span-full">No support tickets found.</p>`;
        return;
    }

    tickets.forEach(ticket => {
        const card = document.createElement('div');
        card.className = 'request-card support-ticket-card'; 
        card.dataset.ticketId = ticket.id;

        let statusBadgeClass = 'status-badge ';
        const normalizedStatus = ticket.status ? ticket.status.toLowerCase().replace(/\s+/g, '-') : 'unknown';
        statusBadgeClass += `status-${normalizedStatus}`;

        card.innerHTML = `
            <h3>#${ticket.id}: ${ticket.subject}</h3>
            <p><strong>Client:</strong> ${ticket.userName || ticket.requester_username} (ID: ${ticket.userId})</p>
            <p><strong>Requested:</strong> ${formatSimpleDate(ticket.requestDate)}</p>
            <p><strong>Last Updated:</strong> ${formatSimpleDate(ticket.lastUpdated)}</p>
            <p><strong>Priority:</strong> ${ticket.priority || 'Normal'}</p>
            <p><strong>Status:</strong> <span class="${statusBadgeClass}">${ticket.status}</span></p>
            <div class="actions mt-4 pt-3 border-t border-gray-700">
                <button class="btn btn-sm btn-info view-ticket-details-button" data-ticket-id="${ticket.id}">View/Reply</button>
            </div>
        `;
        card.querySelector('.view-ticket-details-button').addEventListener('click', function() {
            openAdminTicketDetailModal(this.dataset.ticketId); 
        });
        listEl.appendChild(card);
    });
}

function populateTicketDetailModal(ticketData) { // Helper function to populate modal
    if (!ticketData) return;

    if (ticketDetailModalTitleEl()) ticketDetailModalTitleEl().textContent = `Support Ticket #${ticketData.id}`;
    if (ticketDetailIdEl()) ticketDetailIdEl().textContent = ticketData.id;
    if (ticketDetailSubjectEl()) ticketDetailSubjectEl().textContent = ticketData.subject;
    if (ticketDetailClientNameEl()) ticketDetailClientNameEl().textContent = ticketData.userName || 'N/A';
    if (ticketDetailClientUsernameEl()) ticketDetailClientUsernameEl().textContent = ticketData.requester_username || 'N/A';
    if (ticketDetailRequestDateEl()) ticketDetailRequestDateEl().textContent = formatDateDetailed(ticketData.requestDate);
    
    const statusBadge = ticketDetailStatusBadgeEl();
    if (statusBadge) {
        statusBadge.textContent = ticketData.status;
        statusBadge.className = `status-badge status-${ticketData.status.toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (ticketDetailPriorityEl()) ticketDetailPriorityEl().textContent = ticketData.priority || 'Normal';
    if (ticketDetailInitialMessageEl()) ticketDetailInitialMessageEl().textContent = ticketData.message;

    const repliesContainer = ticketRepliesContainerEl();
    if (repliesContainer) {
        repliesContainer.innerHTML = '';
        if (ticketData.replies && ticketData.replies.length > 0) {
            ticketData.replies.forEach(reply => {
                const replyDiv = document.createElement('div');
                replyDiv.className = `ticket-reply ${reply.author_role === 'admin' ? 'admin-reply' : 'client-reply'}`;
                replyDiv.innerHTML = `
                    <p class="ticket-reply-author">${reply.author_username} (${reply.author_role}) <span class="ticket-reply-timestamp">${formatDateDetailed(reply.timestamp)}</span></p>
                    <p class="ticket-reply-message">${reply.message}</p>
                `;
                repliesContainer.appendChild(replyDiv);
            });
        } else {
            repliesContainer.innerHTML = '<p class="placeholder-text text-sm">No replies yet.</p>';
        }
    }

    if (adminReplyTicketIdInputEl()) adminReplyTicketIdInputEl().value = ticketData.id;
    const form = adminTicketReplyFormEl();
    if (form) resetModalForm(form);

    updateTicketStatusButtons(ticketData.status);
}


export async function openAdminTicketDetailModal(ticketId) {
    currentOpenTicketId = ticketId;
    const modal = ticketDetailModalEl();
    
    let ticketData = allAdminTicketsCache.find(t => t.id.toString() === ticketId.toString());

    if (!ticketData) {
        console.warn(`Ticket data for ID ${ticketId} not found in admin cache. Fetching individually...`);
        try {
            ticketData = await getAdminTicketDetails(ticketId); // Fetch if not in cache
            if (!ticketData) { // Still not found after fetch
                 showAdminMessage(`Error: Could not load details for ticket ID ${ticketId}.`, "error");
                 console.error(`Ticket data for ID ${ticketId} not found after attempting individual fetch.`);
                 return;
            }
            // Optionally, update the cache if desired, though this might lead to partial cache issues
            // For simplicity, we'll just use the fetched data for this modal instance.
        } catch (fetchError) {
            showAdminMessage(`Error fetching ticket details: ${fetchError.message}`, "error");
            console.error(`Error fetching ticket details for ID ${ticketId}:`, fetchError);
            return;
        }
    }
    
    populateTicketDetailModal(ticketData); // Use helper to populate
    if (modal) openModal(modal);
}

// ... (updateTicketStatusButtons, handleAdminTicketReplyFormSubmit, handleTicketStatusChange, initializeAdminTicketSystem remain the same)
function updateTicketStatusButtons(status) {
    const resolvedBtn = ticketDetailMarkResolvedButtonEl();
    const closeBtn = ticketDetailCloseButtonEl();
    const reopenBtn = ticketDetailReopenButtonEl();

    if(resolvedBtn) resolvedBtn.classList.toggle('hidden', status === 'Resolved' || status === 'Closed');
    if(closeBtn) closeBtn.classList.toggle('hidden', status === 'Closed');
    if(reopenBtn) reopenBtn.classList.toggle('hidden', status !== 'Closed' && status !== 'Resolved');
}


async function handleAdminTicketReplyFormSubmit(event) {
    event.preventDefault();
    const ticketId = adminReplyTicketIdInputEl().value;
    const message = adminReplyMessageTextareaEl().value.trim();

    if (!message) {
        showAdminMessage("Reply message cannot be empty.", "warning");
        return;
    }

    try {
        const response = await adminReplyToTicket(ticketId, message); 
        showAdminMessage("Reply sent successfully!", "success");
        if (adminReplyMessageTextareaEl()) adminReplyMessageTextareaEl().value = '';
        
        await fetchAllAdminSupportTickets(); // Refresh the main list to update cache
        openAdminTicketDetailModal(ticketId); // Re-open/refresh modal with new reply using the updated cache
        updateTicketStatusButtons(response.ticket_status);


    } catch (error) {
        console.error("Error sending admin reply:", error);
        showAdminMessage(`Error sending reply: ${error.message}`, "error");
    }
}

async function handleTicketStatusChange(newStatus) {
    if (!currentOpenTicketId) return;
    if (!confirm(`Are you sure you want to change ticket #${currentOpenTicketId} status to "${newStatus}"?`)) return;

    try {
        await updateRequestStatusAdmin('support-ticket', currentOpenTicketId, newStatus, `Status changed to ${newStatus} by admin.`);
        showAdminMessage(`Ticket #${currentOpenTicketId} status updated to ${newStatus}.`, "success");
        
        await fetchAllAdminSupportTickets(); // Refresh the main list
        openAdminTicketDetailModal(currentOpenTicketId); 
        updateTicketStatusButtons(newStatus);

    } catch (error) {
        console.error(`Error updating ticket ${currentOpenTicketId} status to ${newStatus}:`, error);
        showAdminMessage(`Failed to update ticket status: ${error.message}`, "error");
    }
}


export function initializeAdminTicketSystem() {
    const modal = ticketDetailModalEl();
    if (modal) {
        const closeButton = document.getElementById('close-ticket-detail-modal');
        if(closeButton) closeButton.addEventListener('click', () => { closeModal(modal); currentOpenTicketId = null; });
        modal.addEventListener('click', (e) => { if (e.target === modal) {closeModal(modal); currentOpenTicketId = null;} });
    }

    const form = adminTicketReplyFormEl();
    if (form) {
        form.addEventListener('submit', handleAdminTicketReplyFormSubmit);
    }

    const markResolvedBtn = ticketDetailMarkResolvedButtonEl();
    if(markResolvedBtn) markResolvedBtn.addEventListener('click', () => handleTicketStatusChange('Resolved'));
    
    const closeBtn = ticketDetailCloseButtonEl();
    if(closeBtn) closeBtn.addEventListener('click', () => handleTicketStatusChange('Closed'));

    const reopenBtn = ticketDetailReopenButtonEl();
    if(reopenBtn) reopenBtn.addEventListener('click', () => handleTicketStatusChange('Open'));

    console.log("Admin Ticket System Initialized.");
}
