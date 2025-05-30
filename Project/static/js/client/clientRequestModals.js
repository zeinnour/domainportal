// Project/static/js/client/clientRequestModals.js
import { openModal, closeModal, resetModalForm, initializeModalCloseEvents } from '../common/modalUtils.js';
import { showMessage } from '../common/messageBox.js';
import * as API from './apiClientService.js';
import { fetchAllClientData } from './client_main.js'; // To refresh all data
import { getClientDomainsData, getCurrentManagingDomainId } from './clientDomainDetail.js'; // For context

// --- DOM Elements for various modals ---
// Register Domain
const registerDomainModalEl = () => document.getElementById('register-domain-modal');
const registerDomainFormEl = () => document.getElementById('register-domain-form');
const requestSslCheckboxEl = () => document.getElementById('requestSsl');
const sslDurationContainerEl = () => document.getElementById('ssl-duration-container');
const requestedDomainNameInputEl = () => document.getElementById('requestedDomainName');
const requestedDomainNameErrorEl = () => document.getElementById('requestedDomainNameError');
const requestedTldInputEl = () => document.getElementById('requestedTld');
const requestedTldErrorEl = () => document.getElementById('requestedTldError');
const registerDomainModalTitleEl = () => document.getElementById('register-domain-modal-title'); // Added
const suggestedDomainInfoEl = () => document.getElementById('suggested-domain-info'); // Added


// Renew Domain
const renewDomainModalEl = () => document.getElementById('renew-domain-modal');
const renewDomainFormEl = () => document.getElementById('renew-domain-form');
const renewalDomainIdInputEl = () => document.getElementById('renewalDomainId');
const renewalDomainNameDisplayEl = () => document.getElementById('renewalDomainNameDisplay');
const renewalRequestSslCheckboxEl = () => document.getElementById('renewalRequestSsl');
const renewalSslDurationContainerEl = () => document.getElementById('renewal-ssl-duration-container');

// Transfer-In Domain
const transferInDomainModalEl = () => document.getElementById('transfer-in-domain-modal');
const transferInDomainFormEl = () => document.getElementById('transfer-in-domain-form');
const transferInDomainNameInputEl = () => document.getElementById('transferInDomainName');
const transferInDomainNameErrorEl = () => document.getElementById('transferInDomainNameError');


// Transfer-Out Domain
const transferOutDomainModalEl = () => document.getElementById('transfer-out-domain-modal');
const transferOutDomainFormEl = () => document.getElementById('transfer-out-domain-form');
const transferOutDomainSelectEl = () => document.getElementById('transferOutDomainSelect');

// Internal Transfer Domain
const internalTransferDomainModalEl = () => document.getElementById('internal-transfer-domain-modal');
const internalTransferDomainFormEl = () => document.getElementById('internal-transfer-domain-form');
const internalTransferDomainSelectEl = () => document.getElementById('internalTransferDomainSelect');
const internalTransferToClientIdentifierInputEl = () => document.getElementById('internalTransferToClientIdentifier');
const internalTransferDomainSelectErrorEl = () => document.getElementById('internalTransferDomainSelectError');
const internalTransferToClientIdentifierErrorEl = () => document.getElementById('internalTransferToClientIdentifierError');


// Contact Update Modal
const contactUpdateModalEl = () => document.getElementById('contact-update-modal');
const contactUpdateFormEl = () => document.getElementById('contact-update-form');
const contactUpdateDomainIdInputEl = () => document.getElementById('contactUpdateDomainId');
const contactUpdateDomainNameDisplayEl = () => document.getElementById('contactUpdateDomainNameDisplay');
const contactUpdateDescriptionEl = () => document.getElementById('contactUpdateDescription');
const contactUpdateDescriptionErrorEl = () => document.getElementById('contactUpdateDescriptionError');


export function initializeRequestModals() {
    // Register Domain Modal
    const regModal = registerDomainModalEl();
    const regForm = registerDomainFormEl();
    const sslCheckbox = requestSslCheckboxEl();
    const sslContainer = sslDurationContainerEl();
    if (regModal) initializeModalCloseEvents('register-domain-modal', 'close-register-domain-modal', 'cancel-register-domain-button');
    if (regForm) regForm.addEventListener('submit', handleRegisterDomainSubmit);
    if (sslCheckbox && sslContainer) {
        sslCheckbox.addEventListener('change', function() {
            sslContainer.classList.toggle('hidden', !this.checked);
        });
    }

    // Renew Domain Modal
    const renModal = renewDomainModalEl();
    const renForm = renewDomainFormEl();
    const renSslCheckbox = renewalRequestSslCheckboxEl();
    const renSslContainer = renewalSslDurationContainerEl();
    if (renModal) initializeModalCloseEvents('renew-domain-modal', 'close-renew-domain-modal', 'cancel-renew-domain-button');
    if (renForm) renForm.addEventListener('submit', handleRenewDomainSubmit);
    if (renSslCheckbox && renSslContainer) {
        renSslCheckbox.addEventListener('change', function() {
            renSslContainer.classList.toggle('hidden', !this.checked);
        });
    }

    // Transfer-In Modal
    const transInModal = transferInDomainModalEl();
    const transInForm = transferInDomainFormEl();
    if (transInModal) initializeModalCloseEvents('transfer-in-domain-modal', 'close-transfer-in-modal', 'cancel-transfer-in-button');
    if (transInForm) transInForm.addEventListener('submit', handleTransferInSubmit);

    // Transfer-Out Modal
    const transOutModal = transferOutDomainModalEl();
    const transOutForm = transferOutDomainFormEl();
    if (transOutModal) initializeModalCloseEvents('transfer-out-domain-modal', 'close-transfer-out-modal', 'cancel-transfer-out-button');
    if (transOutForm) transOutForm.addEventListener('submit', handleTransferOutSubmit);

    // Internal Transfer Modal
    const internalTransModal = internalTransferDomainModalEl();
    const internalTransForm = internalTransferDomainFormEl();
    if (internalTransModal) initializeModalCloseEvents('internal-transfer-domain-modal', 'close-internal-transfer-modal', 'cancel-internal-transfer-button');
    if (internalTransForm) internalTransForm.addEventListener('submit', handleInternalTransferSubmit);

    // Contact Update Modal
    const contactModal = contactUpdateModalEl();
    const contactForm = contactUpdateFormEl();
    if (contactModal) initializeModalCloseEvents('contact-update-modal', 'close-contact-update-modal', 'cancel-contact-update-button');
    if (contactForm) contactForm.addEventListener('submit', handleContactUpdateSubmit);

    console.log("Client Request Modals Initialized.");
}

// --- Register Domain ---
export function openRegisterDomainModal(prefillDomainName = null, prefillTld = null) {
    const modal = registerDomainModalEl();
    const form = registerDomainFormEl();
    const sslContainer = sslDurationContainerEl();
    const domainNameInput = requestedDomainNameInputEl();
    const tldInput = requestedTldInputEl();
    const modalTitle = registerDomainModalTitleEl();
    const suggestedInfo = suggestedDomainInfoEl();

    if (modal && form && sslContainer && domainNameInput && tldInput && modalTitle && suggestedInfo) {
        resetModalForm(form, [requestedDomainNameErrorEl()?.id, requestedTldErrorEl()?.id].filter(Boolean));
        
        domainNameInput.value = ''; // Clear previous prefill
        tldInput.value = '';    // Clear previous prefill
        suggestedInfo.classList.add('hidden');
        suggestedInfo.textContent = '';
        modalTitle.textContent = 'Request New Domain Registration';


        if (prefillDomainName && prefillTld) {
            domainNameInput.value = prefillDomainName;
            tldInput.value = prefillTld;
            suggestedInfo.textContent = `Registering suggested domain: ${prefillDomainName}${prefillTld}`;
            suggestedInfo.classList.remove('hidden');
            modalTitle.textContent = 'Complete Registration for Suggested Domain';
        }
        
        if(requestSslCheckboxEl()) requestSslCheckboxEl().checked = false;
        sslContainer.classList.add('hidden');
        openModal(modal);
    } else {
        showMessage("Register domain modal components are missing.", "error");
    }
}
async function handleRegisterDomainSubmit(event) {
    event.preventDefault();
    const form = registerDomainFormEl();
    const domainNameInput = requestedDomainNameInputEl();
    const domainNameError = requestedDomainNameErrorEl();
    const tldInput = requestedTldInputEl();
    const tldError = requestedTldErrorEl();

    if(domainNameInput) domainNameInput.classList.remove('error', 'shake-animation');
    if(domainNameError) {domainNameError.classList.add('hidden'); domainNameError.textContent = '';}
    if(tldInput) tldInput.classList.remove('error', 'shake-animation');
    if(tldError) {tldError.classList.add('hidden'); tldError.textContent = '';}

    const formData = new FormData(form);
    const requestData = {
        requestedDomainName: formData.get('requestedDomainName'),
        requestedTld: formData.get('requestedTld'),
        registrationDurationYears: parseInt(formData.get('registrationDurationYears'), 10),
        requestSsl: requestSslCheckboxEl().checked,
        sslDurationYears: requestSslCheckboxEl().checked ? parseInt(formData.get('sslDurationYears'), 10) : null
    };

    let isValid = true;
    const domainNamePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    if (!requestData.requestedDomainName || !domainNamePattern.test(requestData.requestedDomainName)) {
        if(domainNameInput) domainNameInput.classList.add('error', 'shake-animation');
        if(domainNameError) { domainNameError.textContent = "Invalid domain name format (e.g., 'mycoolsite')."; domainNameError.classList.remove('hidden'); }
        if(domainNameInput) domainNameInput.focus();
        setTimeout(() => {if(domainNameInput) domainNameInput.classList.remove('shake-animation')}, 500);
        isValid = false;
    }
    if (!requestData.requestedTld || !requestData.requestedTld.startsWith('.') || requestData.requestedTld.length < 2) {
        if(tldInput) tldInput.classList.add('error', 'shake-animation');
        if(tldError) { tldError.textContent = "TLD must start with '.' (e.g., .com)."; tldError.classList.remove('hidden'); }
        if (isValid && tldInput) tldInput.focus();
        setTimeout(() => {if(tldInput) tldInput.classList.remove('shake-animation')}, 500);
        isValid = false;
    }
    if (!isValid) return;

    try {
        await API.submitRegisterDomainRequest(requestData);
        showMessage("Domain registration request submitted successfully!", "success");
        closeModal(registerDomainModalEl());
        await fetchAllClientData();
    } catch (error) {
        showMessage(`Error submitting domain registration: ${error.message}`, 'error');
    }
}

// --- Renew Domain ---
export function openRenewModalForClient(domainId, domainName) {
    const modal = renewDomainModalEl();
    const form = renewDomainFormEl();
    const idInput = renewalDomainIdInputEl();
    const nameDisplay = renewalDomainNameDisplayEl();
    const sslContainer = renewalSslDurationContainerEl();

    if (modal && form && idInput && nameDisplay && sslContainer) {
        resetModalForm(form);
        idInput.value = domainId;
        nameDisplay.textContent = domainName;
        if(renewalRequestSslCheckboxEl()) renewalRequestSslCheckboxEl().checked = false;
        sslContainer.classList.add('hidden');
        openModal(modal);
    } else {
        showMessage("Renew domain modal components are missing.", "error");
    }
}
async function handleRenewDomainSubmit(event) {
    event.preventDefault();
    const form = renewDomainFormEl();
    const domainIdToRenew = renewalDomainIdInputEl().value;
    if (!domainIdToRenew) { showMessage("Error: Domain ID for renewal is missing.", "error"); return; }

    const formData = new FormData(form);
    const requestData = {
        renewalDurationYears: parseInt(formData.get('renewalDurationYears'), 10),
        requestSsl: renewalRequestSslCheckboxEl().checked,
        sslDurationYears: renewalRequestSslCheckboxEl().checked ? parseInt(formData.get('renewalSslDurationYears'), 10) : null
    };
    try {
        const responseData = await API.submitRenewDomainRequest(domainIdToRenew, requestData);
        showMessage(`Renewal request for ${responseData.request.domainName} submitted successfully!`, "success");
        closeModal(renewDomainModalEl());
        await fetchAllClientData();
    } catch (error) {
        showMessage(`Error submitting domain renewal: ${error.message}`, 'error');
    }
}

// --- Transfer-In Domain ---
export function openTransferInModal() {
    const modal = transferInDomainModalEl();
    const form = transferInDomainFormEl();
    if(modal && form) {
        resetModalForm(form, [transferInDomainNameErrorEl()?.id].filter(Boolean));
        openModal(modal);
    } else { showMessage("Transfer-In modal components missing.", "error");}
}
async function handleTransferInSubmit(event) {
    event.preventDefault();
    const form = transferInDomainFormEl();
    const domainNameInput = transferInDomainNameInputEl();
    const domainNameError = transferInDomainNameErrorEl();

    if(domainNameInput) domainNameInput.classList.remove('error', 'shake-animation');
    if(domainNameError) {domainNameError.classList.add('hidden'); domainNameError.textContent = '';}

    const formData = new FormData(form);
    const transferData = {
        domainNameToTransfer: formData.get('transferInDomainName'),
        authCode: formData.get('transferInAuthCode') || null
    };
    const domainNamePattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!transferData.domainNameToTransfer || !domainNamePattern.test(transferData.domainNameToTransfer)) {
        if(domainNameInput) domainNameInput.classList.add('error', 'shake-animation');
        if(domainNameError) { domainNameError.textContent = "Please enter a valid full domain name (e.g., example.com)."; domainNameError.classList.remove('hidden');}
        if(domainNameInput) domainNameInput.focus();
        setTimeout(() => {if(domainNameInput) domainNameInput.classList.remove('shake-animation')}, 500);
        return;
    }
    try {
        await API.submitTransferInRequest(transferData);
        showMessage("Domain transfer-in request submitted successfully!", "success");
        closeModal(transferInDomainModalEl());
        await fetchAllClientData();
    } catch (error) {
        showMessage(`Error submitting transfer-in: ${error.message}`, 'error');
    }
}

// --- Transfer-Out Domain ---
function populateDomainDropdown(selectElement, domains, excludeDomainId = null) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">-- Select Your Domain --</option>`;
    if (domains && domains.length > 0) {
        domains.forEach(domain => {
            if (domain.id !== excludeDomainId) {
                const option = document.createElement('option');
                option.value = domain.id;
                option.textContent = domain.name;
                selectElement.appendChild(option);
            }
        });
    }
}

export function openTransferOutModal(domainIdToPreselect = null) {
    const modal = transferOutDomainModalEl();
    const form = transferOutDomainFormEl();
    const selectEl = transferOutDomainSelectEl();
    const clientDomains = getClientDomainsData();

    if (modal && form && selectEl) {
        resetModalForm(form);
        populateDomainDropdown(selectEl, clientDomains);
        if (domainIdToPreselect && selectEl) {
           selectEl.value = domainIdToPreselect;
        }
        openModal(modal);
    } else { showMessage("Transfer-Out modal components missing.", "error");}
}
async function handleTransferOutSubmit(event) {
    event.preventDefault();
    const form = transferOutDomainFormEl();
    const formData = new FormData(form);
    const transferOutData = {
        domainId: parseInt(formData.get('transferOutDomainSelect'), 10),
        destinationInfo: formData.get('transferOutDestinationInfo'),
        reason: formData.get('transferOutReason')
    };
    if (!transferOutData.domainId) { showMessage("Please select a domain.", "error"); return; }
    try {
        await API.submitTransferOutRequest(transferOutData);
        showMessage(`Request to transfer out domain submitted.`, "success");
        closeModal(transferOutDomainModalEl());
        await fetchAllClientData();
    } catch (error) {
        showMessage(`Error submitting transfer-out: ${error.message}`, 'error');
    }
}

// --- Internal Transfer ---
export function openInternalTransferModal() {
    const modal = internalTransferDomainModalEl();
    const form = internalTransferDomainFormEl();
    const selectEl = internalTransferDomainSelectEl();
    const clientDomains = getClientDomainsData();

    if (modal && form && selectEl) {
        resetModalForm(form, [internalTransferDomainSelectErrorEl()?.id, internalTransferToClientIdentifierErrorEl()?.id].filter(Boolean));
        populateDomainDropdown(selectEl, clientDomains);
        openModal(modal);
    } else { showMessage("Internal Transfer modal components missing.", "error"); }
}
async function handleInternalTransferSubmit(event) {
    event.preventDefault();
    const form = internalTransferDomainFormEl();
    const domainSelectError = internalTransferDomainSelectErrorEl();
    const clientIdentifierError = internalTransferToClientIdentifierErrorEl();

    if(domainSelectError) { domainSelectError.classList.add('hidden'); domainSelectError.textContent = ''; }
    if(clientIdentifierError) { clientIdentifierError.classList.add('hidden'); clientIdentifierError.textContent = ''; }

    const domainId = internalTransferDomainSelectEl().value;
    const targetClientIdentifier = internalTransferToClientIdentifierInputEl().value.trim();

    let isValid = true;
    if (!domainId) {
        if(domainSelectError) { domainSelectError.textContent = "Please select a domain to transfer."; domainSelectError.classList.remove('hidden'); }
        isValid = false;
    }
    if (!targetClientIdentifier) {
        if(clientIdentifierError) { clientIdentifierError.textContent = "Target client identifier is required."; clientIdentifierError.classList.remove('hidden'); }
        isValid = false;
    }
    if (!isValid) return;

    try {
        const responseData = await API.submitInternalTransferRequest({
            domainId: parseInt(domainId),
            targetClientIdentifier: targetClientIdentifier
        });
        showMessage(responseData.message, "success");
        closeModal(internalTransferDomainModalEl());
        await fetchAllClientData();
    } catch (error) {
        showMessage(`Internal Transfer Error: ${error.message}`, 'error');
        if (error.message.toLowerCase().includes("target client")) {
            if(clientIdentifierError) { clientIdentifierError.textContent = error.message; clientIdentifierError.classList.remove('hidden'); }
        } else if (error.message.toLowerCase().includes("domain not found")) {
             if(domainSelectError) { domainSelectError.textContent = error.message; domainSelectError.classList.remove('hidden'); }
        }
    }
}


// --- Contact Info Update ---
export function openContactUpdateModalForClient(domainId, domainName) {
    const modal = contactUpdateModalEl();
    const form = contactUpdateFormEl();
    const idInput = contactUpdateDomainIdInputEl();
    const nameDisplay = contactUpdateDomainNameDisplayEl();
    const descError = contactUpdateDescriptionErrorEl();

    if (modal && form && idInput && nameDisplay) {
        resetModalForm(form, [descError?.id].filter(Boolean));
        idInput.value = domainId;
        nameDisplay.textContent = domainName;
        openModal(modal);
    } else { showMessage("Contact Update modal components missing.", "error"); }
}
async function handleContactUpdateSubmit(event) {
    event.preventDefault();
    const form = contactUpdateFormEl();
    const descError = contactUpdateDescriptionErrorEl();
    if(descError) { descError.classList.add('hidden'); descError.textContent = '';}

    const contactUpdateData = {
        domainId: parseInt(contactUpdateDomainIdInputEl().value, 10),
        requestedChangesDescription: contactUpdateDescriptionEl().value.trim()
    };
    if (!contactUpdateData.domainId || !contactUpdateData.requestedChangesDescription) {
        if(descError && !contactUpdateData.requestedChangesDescription) { descError.textContent = "Description of changes is required."; descError.classList.remove('hidden');}
        else { showMessage("Domain ID and description of changes are required.", "error");}
        return;
    }
    try {
        await API.submitContactUpdateRequest(contactUpdateData);
        showMessage("Contact info update request submitted successfully!", "success");
        closeModal(contactUpdateModalEl());
        await fetchAllClientData();
    } catch (error) {
        showMessage(`Contact Update Error: ${error.message}`, 'error');
    }
}
