// Project/static/js/common/modalUtils.js

/**
 * Opens a modal dialog.
 * @param {HTMLElement} modalElement - The modal element to open.
 */
export function openModal(modalElement) {
    if (modalElement && modalElement instanceof HTMLElement) {
        modalElement.classList.add('active'); // 'active' class should control visibility and opacity
        // Optional: Add body class to prevent scrolling
        // document.body.classList.add('modal-open');
    } else {
        console.error("ModalUtils: Invalid or null modal element provided to openModal.", modalElement);
    }
}

/**
 * Closes a modal dialog.
 * @param {HTMLElement} modalElement - The modal element to close.
 */
export function closeModal(modalElement) {
    if (modalElement && modalElement instanceof HTMLElement) {
        modalElement.classList.remove('active');
        // Optional: Remove body class
        // document.body.classList.remove('modal-open');

        // Special handling for domain transfer dropdown if it's open
        const domainTransferDropdownContent = document.getElementById('domain-transfer-dropdown-content');
        if (domainTransferDropdownContent && domainTransferDropdownContent.style.display === 'block') {
            domainTransferDropdownContent.style.display = 'none';
        }
    } else {
        console.error("ModalUtils: Invalid or null modal element provided to closeModal.", modalElement);
    }
}

/**
 * Sets up standard close behaviors for a modal.
 * - Clicking the close button.
 * - Clicking the cancel button.
 * - Clicking the backdrop.
 * @param {string} modalId - The ID of the modal backdrop.
 * @param {string} closeButtonId - The ID of the modal's main close button (e.g., 'X').
 * @param {string} cancelButtonId - (Optional) The ID of a 'Cancel' button within the modal.
 */
export function initializeModalCloseEvents(modalId, closeButtonId, cancelButtonId = null) {
    const modalElement = document.getElementById(modalId);
    const closeButton = document.getElementById(closeButtonId);

    if (!modalElement) {
        console.warn(`ModalUtils: Modal element with ID '${modalId}' not found.`);
        return;
    }
    if (!closeButton) {
        console.warn(`ModalUtils: Close button with ID '${closeButtonId}' for modal '${modalId}' not found.`);
    } else {
        closeButton.addEventListener('click', () => closeModal(modalElement));
    }

    if (cancelButtonId) {
        const cancelButton = document.getElementById(cancelButtonId);
        if (cancelButton) {
            cancelButton.addEventListener('click', () => closeModal(modalElement));
        } else {
            console.warn(`ModalUtils: Cancel button with ID '${cancelButtonId}' for modal '${modalId}' not found.`);
        }
    }

    // Close modal on backdrop click
    modalElement.addEventListener('click', (event) => {
        if (event.target === modalElement) {
            closeModal(modalElement);
        }
    });
}

/**
 * Resets a form within a modal, clearing inputs and error messages.
 * @param {HTMLFormElement} formElement - The form element to reset.
 * @param {string[]} errorElementIds - An array of IDs for error message elements to hide.
 */
export function resetModalForm(formElement, errorElementIds = []) {
    if (formElement && formElement instanceof HTMLFormElement) {
        formElement.reset();
    }
    errorElementIds.forEach(id => {
        const errorEl = document.getElementById(id);
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }
    });
    // Remove 'error' and 'shake-animation' classes from inputs within the form
    formElement.querySelectorAll('.input-field.error').forEach(input => {
        input.classList.remove('error', 'shake-animation');
    });
}

/**
 * Displays a "Not Implemented" modal.
 * Requires a modal with IDs: 'not-implemented-modal', 'not-implemented-modal-title', 'not-implemented-modal-message'
 * and close buttons 'close-not-implemented-modal', 'ok-not-implemented-button'.
 * @param {string} featureName - The name of the feature that is not implemented.
 */
export function showNotImplementedModal(featureName = "This feature") {
    const modal = document.getElementById('not-implemented-modal');
    const titleEl = document.getElementById('not-implemented-modal-title');
    const messageEl = document.getElementById('not-implemented-modal-message');

    if (!modal || !titleEl || !messageEl) {
        console.error("ModalUtils: 'Not Implemented' modal elements are missing from the DOM.");
        showMessage(`${featureName} is currently under development. Modal structure missing.`, 'info');
        return;
    }

    titleEl.textContent = `${featureName}`;
    messageEl.textContent = `${featureName} is currently under development or not yet available. Please check back later.`;
    openModal(modal);
}