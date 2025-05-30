// Project/static/js/client/domainSuggestionTool.js
import { openModal, closeModal, resetModalForm, initializeModalCloseEvents } from '../common/modalUtils.js';
import { showMessage } from '../common/messageBox.js';
import { createClientIcon } from './clientUI.js'; // Assuming clientUI re-exports createIcon
import { fetchDomainSuggestions } from './apiClientService.js'; // Import the actual API service function
import { openRegisterDomainModal } from './clientRequestModals.js'; // For the "Register" button

// DOM Elements for Domain Suggestion Tool Modal
const suggestionToolModalEl = () => document.getElementById('domain-suggestion-tool-modal');
const suggestionFormEl = () => document.getElementById('domain-suggestion-form');
const keywordsInputEl = () => document.getElementById('domainKeywords');
const keywordsErrorEl = () => document.getElementById('domainKeywordsError');
const suggestionsListEl = () => document.getElementById('domain-suggestions-list');
const suggestionLoadingEl = () => document.getElementById('domain-suggestion-loading');

export function initializeDomainSuggestionTool() {
    const openButton = document.getElementById('open-domain-suggestion-tool-button');
    const modal = suggestionToolModalEl();
    const form = suggestionFormEl();

    if (openButton) {
        openButton.addEventListener('click', () => {
            if (modal && form) {
                resetModalForm(form, [keywordsErrorEl()?.id].filter(Boolean));
                if (suggestionsListEl()) {
                    suggestionsListEl().innerHTML = '<p class="text-sm text-gray-500">Enter keywords to see suggestions.</p>';
                }
                if (suggestionLoadingEl()) {
                    suggestionLoadingEl().classList.add('hidden');
                }
                openModal(modal);
            } else {
                showMessage("Domain suggestion tool modal components are missing.", "error");
            }
        });
    }

    if (modal) {
        initializeModalCloseEvents('domain-suggestion-tool-modal', 'close-domain-suggestion-tool-modal');
    }

    if (form) {
        form.addEventListener('submit', handleDomainSuggestionSubmit);
    }

    if (document.getElementById('close-domain-suggestion-tool-modal')?.querySelector('svg[data-lucide="x"]')) {
        // Icon already exists
    } else if (document.getElementById('close-domain-suggestion-tool-modal')) {
         createClientIcon('close-domain-suggestion-tool-modal', 'X', { class: 'h-6 w-6' });
    }
     if (document.getElementById('domain-suggestion-icon')?.querySelector('svg[data-lucide="lightbulb"]')) {
        // Icon already exists
    } else if (document.getElementById('domain-suggestion-icon')) {
         createClientIcon('domain-suggestion-icon', 'Lightbulb', { class: 'h-5 w-5 mr-2' });
    }


    console.log("Domain Suggestion Tool Initialized.");
}

async function handleDomainSuggestionSubmit(event) {
    event.preventDefault();
    const keywordsInput = keywordsInputEl();
    const keywordsError = keywordsErrorEl();
    const suggestionsList = suggestionsListEl();
    const loadingIndicator = suggestionLoadingEl();

    if (!keywordsInput || !keywordsError || !suggestionsList || !loadingIndicator) {
        showMessage("Error: UI elements for domain suggestion are missing.", "error");
        return;
    }

    const keywords = keywordsInput.value.trim();
    keywordsError.classList.add('hidden');
    keywordsError.textContent = '';

    if (!keywords) {
        keywordsError.textContent = "Please enter keywords or a domain prefix.";
        keywordsError.classList.remove('hidden');
        keywordsInput.focus();
        return;
    }

    suggestionsList.innerHTML = ''; 
    loadingIndicator.classList.remove('hidden');

    try {
        const response = await fetchDomainSuggestions(keywords); // Use actual API call
        if (response && response.suggestions) {
            renderSuggestions(response.suggestions);
        } else if (response && response.error) {
            showMessage(`Error fetching suggestions: ${response.error}`, "error");
            suggestionsList.innerHTML = `<p class="text-sm text-red-400">Error: ${response.error}</p>`;
        } 
        else {
            renderSuggestions([]); // Render empty state if no suggestions or unexpected response
        }
    } catch (error) {
        showMessage(`Error fetching domain suggestions: ${error.message}`, "error");
        suggestionsList.innerHTML = '<p class="text-sm text-red-400">Could not load suggestions. Please try again.</p>';
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

function renderSuggestions(suggestions) {
    const suggestionsList = suggestionsListEl();
    if (!suggestionsList) return;

    suggestionsList.innerHTML = ''; 

    if (!suggestions || suggestions.length === 0) {
        suggestionsList.innerHTML = '<p class="text-sm text-gray-400">No suggestions found for your keywords. Try different terms.</p>';
        return;
    }

    suggestions.forEach(suggestion => {
        const li = document.createElement('div');
        li.className = 'flex justify-between items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-medium text-gray-100';
        nameSpan.textContent = suggestion.name;

        const availabilityDiv = document.createElement('div');
        availabilityDiv.className = 'flex items-center space-x-3';

        const priceSpan = document.createElement('span');
        priceSpan.className = 'text-sm text-gray-400';
        priceSpan.textContent = suggestion.price; // Price from backend
        
        const statusSpan = document.createElement('span');
        statusSpan.className = `text-xs font-semibold px-2 py-1 rounded-full ${suggestion.available ? 'bg-green-500 text-green-100' : 'bg-red-500 text-red-100'}`;
        statusSpan.textContent = suggestion.available ? 'Available' : 'Taken (Locally)';

        const actionButton = document.createElement('button');
        actionButton.className = `btn btn-xs ${suggestion.available ? 'btn-primary' : 'btn-secondary disabled:opacity-50'}`;
        actionButton.textContent = suggestion.available ? 'Register' : 'Info';
        if (!suggestion.available) {
            actionButton.title = `${suggestion.name} is already registered or pending with our service.`;
             // Keep button enabled to show info, or disable if no action.
        }
        actionButton.onclick = () => {
            if (suggestion.available) {
                const parts = suggestion.name.split('.');
                const domainPart = parts.slice(0, -1).join('.');
                const tldPart = "." + parts.slice(-1).join('.');
                openRegisterDomainModal(domainPart, tldPart); // Pre-fill registration modal
                closeModal(suggestionToolModalEl()); 
            } else {
                showMessage(`${suggestion.name} is already registered or a request is pending with our service.`, 'info');
            }
        };

        availabilityDiv.appendChild(priceSpan);
        availabilityDiv.appendChild(statusSpan);
        availabilityDiv.appendChild(actionButton);

        li.appendChild(nameSpan);
        li.appendChild(availabilityDiv);
        suggestionsList.appendChild(li);
    });
}
