// Project/static/js/client/clientTicketManagement.js
import { openModal, closeModal, resetModalForm, initializeModalCloseEvents } from '../common/modalUtils.js';
import { showMessage, createClientIcon as createIcon } from './clientUI.js';
import { formatDateDetailed, formatSimpleDate } from '../common/dateUtils.js'; // Corrected import name
import * as API from './apiClientService.js';
import { fetchAllClientData } from './client_main.js';
import { getClientDomainsData } from './clientDomainDetail.js';
import { getCurrentUserData } from './clientUI.js';


// DOM Elements
const supportTicketModalEl = () => document.getElementById('support-ticket-modal');
const supportTicketFormEl = () => document.getElementById('support-ticket-form');
const ticketRelatedDomainSelectEl = () => document.getElementById('ticketRelatedDomain');
const existingTicketsListEl = () => document.getElementById('existing-tickets-list');

// Client Ticket Detail Modal Elements
const clientTicketDetailModalEl = () => document.getElementById('client-ticket-detail-modal');
const clientTicketDetailModalTitleSpanEl = () => document.getElementById('client-ticket-detail-modal-title');
const clientTicketIdDisplaySpanEl = () => document.getElementById('client-ticket-id-display');
const clientTicketSubjectDisplaySpanEl = () => document.getElementById('client-ticket-subject-display');
const clientTicketStatusBadgeSpanEl = () => document.getElementById('client-ticket-status-badge');
const clientTicketRequestDateDisplaySpanEl = () => document.getElementById('client-ticket-request-date-display');
const clientTicketInitialMessageDisplayPEl = () => document.getElementById('client-ticket-initial-message-display');
const clientTicketRepliesContainerDivEl = () => document.getElementById('client-ticket-replies-container');
const clientTicketReplyFormEl = () => document.getElementById('client-ticket-reply-form');
const clientReplyTicketIdInputEl = () => document.getElementById('clientReplyTicketId');
const clientReplyMessageTextareaEl = () => document.getElementById('clientReplyMessage');

let allClientTicketsCache = [];
export const setAllClientTicketsCache = (tickets) => { allClientTicketsCache = tickets; };

export function initializeClientTicketSystem() {
    // Create New Ticket Modal
    const ticketModal = supportTicketModalEl();
    const ticketForm = supportTicketFormEl();
    if (ticketModal) initializeModalCloseEvents('support-ticket-modal', 'close-support-ticket-modal', 'cancel-support-ticket-button');
    if (ticketForm) ticketForm.addEventListener('submit', handleNewTicketSubmit);

    // Ticket Detail Modal
    const detailModal = clientTicketDetailModalEl();
    const detailReplyForm = clientTicketReplyFormEl();
    if (detailModal) initializeModalCloseEvents('client-ticket-detail-modal', 'close-client-ticket-detail-modal'); // No cancel button, just X
    if (detailReplyForm) detailReplyForm.addEventListener('submit', handleTicketReplySubmit);

    // Event delegation for opening ticket details from the list
    const ticketsList = existingTicketsListEl();
    if (ticketsList) {
        ticketsList.addEventListener('click', function(event) {
            const clickedCard = event.target.closest('.ticket-card');
            if (clickedCard && clickedCard.dataset.ticketId) {
                openClientTicketDetailModal(clickedCard.dataset.ticketId);
            }
        });
    }
    console.log("Client Ticket System Initialized.");
}

export function openSupportTicketModal() {
    const modal = supportTicketModalEl();
    const form = supportTicketFormEl();
    if (modal && form) {
        resetModalForm(form);
        populateTicketDomainDropdown();
        openModal(modal);
    } else {
        showMessage("Support ticket modal components are missing.", "error");
    }
}

function populateTicketDomainDropdown() {
    const selectEl = ticketRelatedDomainSelectEl();
    const clientDomains = getClientDomainsData();
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">-- Select Domain if Applicable --</option>';
    if (clientDomains && clientDomains.length > 0) {
        clientDomains.forEach(domain => {
            const option = document.createElement('option');
            option.value = domain.id;
            option.textContent = domain.name;
            selectEl.appendChild(option);
        });
    }
}

async function handleNewTicketSubmit(event) {
    event.preventDefault();
    const form = supportTicketFormEl();
    const formData = new FormData(form);
    const ticketData = {
        subject: formData.get('ticketSubject'),
        message: formData.get('ticketMessage'),
        related_domain_id: formData.get('ticketRelatedDomain') ? parseInt(formData.get('ticketRelatedDomain')) : null
    };
    if (!ticketData.subject.trim() || !ticketData.message.trim()) {
        showMessage("Subject and message are required for the ticket.", "error"); return;
    }
    try {
        await API.submitNewTicket(ticketData);
        showMessage("Support ticket submitted successfully!", "success");
        closeModal(supportTicketModalEl());
        await fetchAllClientData(); // Refreshes tickets and potentially other data
    } catch (error) {
        showMessage(`Error submitting ticket: ${error.message}`, "error");
    }
}

export async function fetchAndDisplayClientTickets() {
    const listEl = existingTicketsListEl();
    if (!listEl) return;
    listEl.innerHTML = '<p class="text-sm text-gray-400">Loading your tickets...</p>';
    // allClientTicketsCache should be populated by fetchAllClientData in client_main.js
    if (allClientTicketsCache.length === 0) {
        listEl.innerHTML = '<p class="text-sm text-gray-400">You currently have no support tickets.</p>';
        return;
    }
    listEl.innerHTML = ''; // Clear loading/previous
    allClientTicketsCache.forEach(ticket => {
        const ticketCard = document.createElement('div');
        ticketCard.className = 'ticket-card'; // Styles defined in client_style.css
        ticketCard.dataset.ticketId = ticket.id;

        let statusColorClass = 'status-badge ';
        switch(ticket.status.toLowerCase()) {
            case 'open': statusColorClass += 'status-open'; break;
            case 'in progress': statusColorClass += 'status-in-progress'; break;
            case 'resolved': statusColorClass += 'status-resolved'; break;
            case 'closed': statusColorClass += 'status-closed'; break;
            default: statusColorClass += 'bg-gray-500 text-gray-100';
        }
        ticketCard.innerHTML = `
            <div class="flex justify-between items-start">
                <h4 class="ticket-subject">${ticket.subject}</h4>
                <span class="${statusColorClass}">${ticket.status}</span>
            </div>
            <p class="ticket-details">Ticket ID: #${ticket.id} | Requested: ${formatSimpleDate(ticket.requestDate)}</p>
            <p class="ticket-message-preview">${ticket.message.substring(0, 150)}${ticket.message.length > 150 ? '...' : ''}</p>
            ${ticket.relatedDomainName ? `<p class="text-xs text-gray-500 mt-1">Related Domain: ${ticket.relatedDomainName}</p>` : ''}
        `;
        listEl.appendChild(ticketCard);
    });
}

export function openClientTicketDetailModal(ticketId) {
    const ticket = allClientTicketsCache.find(t => t.id === parseInt(ticketId));
    if (!ticket) {
        showMessage("Could not find ticket details.", "error");
        return;
    }

    const modal = clientTicketDetailModalEl();
    if (!modal) { showMessage("Ticket detail modal components missing.", "error"); return; }

    if(clientReplyTicketIdInputEl()) clientReplyTicketIdInputEl().value = ticket.id;
    if(clientReplyMessageTextareaEl()) clientReplyMessageTextareaEl().value = ''; // Clear previous reply

    if(clientTicketDetailModalTitleSpanEl()) clientTicketDetailModalTitleSpanEl().textContent = `Support Ticket #${ticket.id}`;
    if(clientTicketIdDisplaySpanEl()) clientTicketIdDisplaySpanEl().textContent = ticket.id;
    if(clientTicketSubjectDisplaySpanEl()) clientTicketSubjectDisplaySpanEl().textContent = ticket.subject;
    if(clientTicketStatusBadgeSpanEl()) {
        clientTicketStatusBadgeSpanEl().textContent = ticket.status;
        clientTicketStatusBadgeSpanEl().className = `status-badge status-${ticket.status.toLowerCase().replace(/\s+/g, '-')}`;
    }
    if(clientTicketRequestDateDisplaySpanEl()) clientTicketRequestDateDisplaySpanEl().textContent = formatDateDetailed(ticket.requestDate); // Corrected usage
    if(clientTicketInitialMessageDisplayPEl()) clientTicketInitialMessageDisplayPEl().textContent = ticket.message;

    const repliesContainer = clientTicketRepliesContainerDivEl();
    const currentUser = getCurrentUserData(); // Get current user for author display

    if (repliesContainer) {
        repliesContainer.innerHTML = ''; // Clear previous
        if (ticket.replies && ticket.replies.length > 0) {
            ticket.replies.forEach(reply => {
                const replyDiv = document.createElement('div');
                const isClientReplyByCurrentUser = reply.author_role === 'client' && currentUser && reply.author_username === currentUser.username;
                const isAdminReply = reply.author_role === 'admin';

                replyDiv.className = `client-ticket-reply ${isClientReplyByCurrentUser ? 'client-reply' : (isAdminReply ? 'admin-reply' : 'other-client-reply')}`;
                // ^^^ You might need more specific CSS for 'other-client-reply' if it's possible and needs different styling.
                // Your original CSS only had .client-reply and .admin-reply.

                let authorText = reply.author_username;
                if (isClientReplyByCurrentUser) authorText = 'You';
                else if (isAdminReply) authorText = reply.author_username || 'Support Team';


                // Adjust flex direction for alignment
                let flexClass = '';
                if (isClientReplyByCurrentUser) {
                    flexClass = 'flex-row-reverse'; // Client's own messages on the right
                } else {
                    flexClass = ''; // Admin/other messages on the left
                }

                replyDiv.innerHTML = `
                    <div class="flex justify-between items-center ${flexClass}">
                        <span class="client-ticket-reply-author">${authorText}</span>
                        <span class="client-ticket-reply-timestamp">${formatDateDetailed(reply.timestamp)}</span> </div>
                    <p class="client-ticket-reply-message mt-1 ${isClientReplyByCurrentUser ? 'text-right' : 'text-left'}">${reply.message}</p>
                `;
                repliesContainer.appendChild(replyDiv);
            });
            repliesContainer.scrollTop = repliesContainer.scrollHeight;
        } else {
            repliesContainer.innerHTML = '<p class="placeholder-text">No replies yet.</p>';
        }
    }
    openModal(modal);
}

async function handleTicketReplySubmit(event) {
    event.preventDefault();
    const ticketId = clientReplyTicketIdInputEl().value;
    const message = clientReplyMessageTextareaEl().value.trim();
    if (!message) {
        showMessage("Reply message cannot be empty.", "error"); return;
    }
    try {
        await API.submitTicketReply(ticketId, message);
        showMessage("Reply posted successfully!", "success");
        if(clientReplyMessageTextareaEl()) clientReplyMessageTextareaEl().value = ''; // Clear textarea
        await fetchAllClientData(); // Refresh ticket data
        openClientTicketDetailModal(ticketId); // Re-open/refresh the modal with new reply
    } catch (error) {
        showMessage(`Error posting reply: ${error.message}`, "error");
    }
}
