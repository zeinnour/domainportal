// Project/static/js/common/messageBox.js

let messageBoxElement;
let messageTextElement;
let closeButtonElement;
let currentTimeoutId = null;

/**
 * Initializes the message box elements. Call this once on DOMContentLoaded.
 * @param {string} boxId - The ID of the main message box container.
 * @param {string} textId - The ID of the element displaying the message text.
 * @param {string} closeId - The ID of the close button for the message box.
 */
export function initializeMessageBox(boxId, textId, closeId) {
    messageBoxElement = document.getElementById(boxId);
    messageTextElement = document.getElementById(textId);
    closeButtonElement = document.getElementById(closeId);

    if (!messageBoxElement || !messageTextElement || !closeButtonElement) {
        console.error("MessageBox: One or more essential elements not found. Messages may not display correctly.");
        return;
    }

    closeButtonElement.addEventListener('click', hideMessage);
}

/**
 * Displays a message to the user.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('info', 'success', 'error').
 * @param {number} duration - How long the message should be visible (in milliseconds).
 */
export function showMessage(message, type = 'info', duration = 5000) {
    if (!messageTextElement || !messageBoxElement) {
        console.warn("MessageBox: Elements not initialized. Falling back to alert.");
        alert(`${type.toUpperCase()}: ${message}`);
        return;
    }

    // Clear any existing timeout to prevent premature hiding
    if (currentTimeoutId) {
        clearTimeout(currentTimeoutId);
        currentTimeoutId = null;
    }

    messageTextElement.textContent = message;

    // Base classes for visibility and transition
    const baseClasses = "fixed bottom-5 right-5 p-4 rounded-lg shadow-lg transition-opacity duration-300 max-w-sm z-50";
    messageBoxElement.className = baseClasses; // Reset classes

    // Type-specific classes
    if (type === 'error') {
        messageBoxElement.classList.add('bg-red-700', 'text-red-100', 'border', 'border-red-500');
    } else if (type === 'success') {
        messageBoxElement.classList.add('bg-green-700', 'text-green-100', 'border', 'border-green-500');
    } else { // 'info' or default
        messageBoxElement.classList.add('bg-sky-700', 'text-sky-100', 'border', 'border-sky-500');
    }

    // Make visible
    messageBoxElement.style.visibility = 'visible';
    messageBoxElement.classList.remove('opacity-0'); // Show with opacity transition

    // Set timeout to hide
    currentTimeoutId = setTimeout(() => {
        hideMessage();
    }, duration);
}

/**
 * Hides the message box.
 */
export function hideMessage() {
    if (messageBoxElement) {
        messageBoxElement.classList.add('opacity-0');
        // Wait for opacity transition to finish before setting visibility to hidden
        setTimeout(() => {
            if (messageBoxElement.classList.contains('opacity-0')) { // Check if still intended to be hidden
                messageBoxElement.style.visibility = 'hidden';
            }
        }, 300); // Duration should match CSS transition
    }
    if (currentTimeoutId) {
        clearTimeout(currentTimeoutId);
        currentTimeoutId = null;
    }
}