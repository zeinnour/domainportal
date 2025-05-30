// Project/static/js/admin/adminRequestManagement.js
import { getPendingRequests, updateRequestStatusAdmin } from './apiAdminService.js';
import { showMessage as showAdminMessage } from '../common/messageBox.js';
import { closeModal } from '../common/modalUtils.js';
import { renderRequestCard, internalRequestTypeForCardId, getAdminPageElement, showAdminNotesModal } from './adminUI.js';

// Import functions for refreshing *other* sections IF a request type implies it
import { fetchAllAdminDomains } from './adminDomainManagement.js';
import { fetchAllClients, viewClientDetails } from './adminClientManagement.js';
import { fetchAllAdminSupportTickets, openAdminTicketDetailModal } from './adminTicketManagement.js';
import { fetchAllAdminInvoices } from './adminInvoiceManagement.js';

const tabButtons = () => document.querySelectorAll('#pending-requests-section .tab-button');
const tabContents = () => document.querySelectorAll('#pending-requests-section .tab-content');

// adminNotesElements are primarily interacted with via showAdminNotesModal (in adminUI)
// and the form handlers below which get elements via getAdminPageElement.

export function initializePendingRequestsTabs() {
    const buttons = tabButtons();
    const contents = tabContents();

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const targetTabId = button.dataset.tabTarget;
            contents.forEach(content => {
                content.classList.toggle('active', content.id === targetTabId);
            });

            const activeListElement = document.getElementById(targetTabId.replace('-tab', '-list'));
            let tabUrlSegment = targetTabId.replace('pending-', '').replace('-tab', '');
            let requestCategoryForApi;

            switch (tabUrlSegment) {
                case 'registrations': requestCategoryForApi = 'register'; break;
                case 'renewals': requestCategoryForApi = 'renew'; break;
                case 'auto-renew': requestCategoryForApi = 'auto_renew_change'; break;
                case 'lock-change': requestCategoryForApi = 'lock_change'; break;
                case 'transfers-in': requestCategoryForApi = 'transfer_in'; break;
                case 'transfers-out': requestCategoryForApi = 'transfer_out'; break;
                case 'internal-transfers': requestCategoryForApi = 'internal_transfer_request'; break;
                case 'dns-changes': requestCategoryForApi = 'dns_change'; break;
                case 'contact-updates': requestCategoryForApi = 'contact_update'; break;
                case 'payment-proofs': requestCategoryForApi = 'payment_proof'; break;
                default:
                    console.warn("Unhandled tab segment for API call:", tabUrlSegment);
                    requestCategoryForApi = tabUrlSegment;
            }
            const activeMessage = `No pending ${tabUrlSegment.replace(/-/g, ' ')} requests.`;
            if (activeListElement) {
                fetchAndDisplayPendingItems(requestCategoryForApi, activeListElement, activeMessage);
            }
        });
    });
    const initiallyActiveTab = document.querySelector('#pending-requests-section .tab-button.active');
    if (initiallyActiveTab && typeof initiallyActiveTab.click === 'function') {
        if (!initiallyActiveTab.dataset.alreadyLoadedByInit) {
            initiallyActiveTab.click();
            initiallyActiveTab.dataset.alreadyLoadedByInit = "true";
        }
    } else if (buttons.length > 0 && typeof buttons[0].click === 'function') {
         if (!buttons[0].dataset.alreadyLoadedByInit) {
            buttons[0].click();
            buttons[0].dataset.alreadyLoadedByInit = "true";
        }
    }
}

export async function fetchAndDisplayPendingItems(requestCategoryForApi, listElement, noItemsMessage) {
    if (!listElement) { console.warn(`List element for ${requestCategoryForApi} not found.`); return; }
    listElement.innerHTML = `<p class="placeholder-text col-span-full">Loading ${requestCategoryForApi.replace(/_/g, ' ').replace(/-/g, ' ')} requests...</p>`;
    listElement.dataset.noItemsMessage = noItemsMessage;

    try {
        const items = await getPendingRequests(requestCategoryForApi);
        listElement.innerHTML = '';
        if (items && items.length > 0) {
            items.forEach(item => {
                const cardElement = renderRequestCard(item, false);
                cardElement.querySelectorAll('.actions button').forEach(button => {
                    button.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const requestId = button.dataset.id;
                        const reqTypeFromButton = button.dataset.type;
                        const action = button.dataset.action;
                        const currentRequestData = items.find(i => i.id.toString() === requestId);

                        if (reqTypeFromButton === 'support-ticket' && action === 'view-ticket') {
                            openAdminTicketDetailModal(requestId);
                        } else {
                            // showAdminNotesModal is imported from adminUI.js
                            showAdminNotesModal(requestId, reqTypeFromButton, action, currentRequestData ? currentRequestData.admin_notes || '' : '');
                        }
                    });
                });
                listElement.appendChild(cardElement);
            });
        } else {
            listElement.innerHTML = `<p class="placeholder-text col-span-full">${noItemsMessage}</p>`;
        }
    } catch (error) {
        console.error(`Error fetching ${requestCategoryForApi} requests:`, error);
        if(listElement) listElement.innerHTML = `<p class="error-text col-span-full">Error loading ${requestCategoryForApi.replace(/_/g, ' ').replace(/-/g, ' ')} requests.</p>`;
        showAdminMessage(`Error loading requests: ${error.message}`, 'error');
    }
}

async function processRequestStatusUpdate(requestId, type, newStatus, notes, eppCode) {
    try {
        // Corrected argument order: (requestType, requestId, status, adminNotes, additionalData)
        const responseData = await updateRequestStatusAdmin(type, requestId, newStatus, notes, { epp_code: eppCode });
        showAdminMessage(`Request ID ${requestId} (${type.replace(/_/g, ' ')}) status updated to ${responseData.item.status}.`, 'success');

        const nonPendingStatuses = ['Completed', 'Rejected', 'Failed', 'Resolved', 'Closed', 'Cancelled by Client', 'EPP Code Sent', 'Approved']; // Added 'Approved'
        const itemProcessedAndShouldBeRemoved = nonPendingStatuses.includes(responseData.item.status);
        const activeTabButton = document.querySelector('#pending-requests-section .tab-button.active');

        if (activeTabButton) {
            let tabTargetExpectedSegment = type;
            const tabSegmentMap = {
                'register': 'registrations', 'renew': 'renewals', 'auto_renew_change': 'auto-renew',
                'lock_change': 'lock-change', 'transfer_in': 'transfers-in', 'transfer_out': 'transfers-out',
                'internal_transfer_request': 'internal-transfers', 'dns_change': 'dns-changes',
                'contact_update': 'contact-updates', 'payment_proof': 'payment-proofs'
            };
            if (tabSegmentMap[type]) tabTargetExpectedSegment = tabSegmentMap[type];

            if (activeTabButton.dataset.tabTarget.includes(tabTargetExpectedSegment)) {
                if (itemProcessedAndShouldBeRemoved) {
                    const cardIdInTab = `request-card-${internalRequestTypeForCardId(type)}-${requestId}`;
                    const cardElementInTab = document.getElementById(cardIdInTab);
                    if (cardElementInTab) {
                        cardElementInTab.classList.add('removing');
                        setTimeout(() => {
                            cardElementInTab.remove();
                            const listElement = cardElementInTab.parentElement;
                            if (listElement && listElement.children.length === 0) {
                                const noItemsMsgText = listElement.dataset.noItemsMessage || `No more pending ${type.replace(/_/g, ' ')} requests.`;
                                listElement.innerHTML = `<p class="placeholder-text col-span-full">${noItemsMsgText}</p>`;
                            }
                        }, 300);
                    }
                } else {
                     if (typeof activeTabButton.click === 'function') activeTabButton.click(); // Refresh tab if item not removed
                }
            }
        }

        if (type === 'support-ticket') {
            fetchAllAdminSupportTickets();
            const adminTicketDetailModal = getAdminPageElement('admin-ticket-detail-modal');
            const adminReplyTicketIdEl = getAdminPageElement('adminReplyTicketId');
            if (adminTicketDetailModal && adminTicketDetailModal.classList.contains('active') && adminReplyTicketIdEl && adminReplyTicketIdEl.value === requestId.toString()) {
                openAdminTicketDetailModal(requestId);
            }
        }
        const completedStatuses = ['Approved', 'Completed'];
        if (completedStatuses.includes(responseData.item.status)) {
            if (['register', 'renew', 'transfer_in', 'transfer_out', 'internal_transfer_request'].includes(type)) {
                fetchAllAdminDomains();
            }
            if (type === 'internal_transfer_request') {
                fetchAllClients();
            }
            if (type === 'payment_proof') {
                fetchAllAdminInvoices();
                const clientDetailSectionVisible = getAdminPageElement('client-detail-admin-section') && !getAdminPageElement('client-detail-admin-section').classList.contains('hidden');
                if (clientDetailSectionVisible && responseData.item.userId) {
                     const clientDetailNameEl = getAdminPageElement('client-detail-name');
                     const currentClientDetailId = clientDetailNameEl?.dataset.clientId;
                     if (currentClientDetailId && parseInt(currentClientDetailId) === responseData.item.userId) {
                         viewClientDetails(responseData.item.userId);
                     }
                }
            }
        }
        return true; 
    } catch (error) {
        console.error(`Error updating ${type} request ID ${requestId}:`, error);
        showAdminMessage(`Error updating request: ${error.message}`, 'error');
        return false;
    }
}

export async function handleAdminNotesFormSubmit(event) {
    event.preventDefault(); 
    const noteTextEl = getAdminPageElement('adminNoteText');
    const requestIdEl = getAdminPageElement('adminNotesRequestId');
    const requestTypeEl = getAdminPageElement('adminNotesRequestType');
    const actionEl = getAdminPageElement('adminNotesAction');
    const eppCodeContainer = getAdminPageElement('epp-code-input-container');
    const eppCodeTextEl = getAdminPageElement('adminEppCodeText');
    const adminNotesModal = getAdminPageElement('admin-notes-modal');

    const notes = noteTextEl.value.trim();
    const eppCode = (eppCodeContainer && !eppCodeContainer.classList.contains('hidden') && eppCodeTextEl && eppCodeTextEl.value.trim() !== "") ? eppCodeTextEl.value.trim() : null;
    
    // Corrected argument order: (requestId, type, newStatus, notes, eppCode)
    const success = await processRequestStatusUpdate(requestIdEl.value, requestTypeEl.value, actionEl.value, notes, eppCode);
    if (adminNotesModal) closeModal(adminNotesModal);
    return success; 
}

export async function handleSkipAdminNotes() {
    const requestIdEl = getAdminPageElement('adminNotesRequestId');
    const requestTypeEl = getAdminPageElement('adminNotesRequestType');
    const actionEl = getAdminPageElement('adminNotesAction');
    const eppCodeContainer = getAdminPageElement('epp-code-input-container');
    const eppCodeTextEl = getAdminPageElement('adminEppCodeText');
    const adminNotesModal = getAdminPageElement('admin-notes-modal');

    const eppCode = (eppCodeContainer && !eppCodeContainer.classList.contains('hidden') && eppCodeTextEl && eppCodeTextEl.value.trim() !== "") ? eppCodeTextEl.value.trim() : null;
    
    // Corrected argument order: (requestId, type, newStatus, notes, eppCode)
    const success = await processRequestStatusUpdate(requestIdEl.value, requestTypeEl.value, actionEl.value, '', eppCode);
    if (adminNotesModal) closeModal(adminNotesModal);
    return success;
}
