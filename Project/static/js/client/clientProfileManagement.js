// Project/static/js/client/clientProfileManagement.js
import { showMessage } from '../common/messageBox.js';
import * as API from './apiClientService.js';
import { getCurrentUserData, setCurrentUserData, updateUserWelcome } from './clientUI.js'; // For global user data

// DOM Elements
const profileViewModeEl = () => document.getElementById('profile-view-mode');
const profileEditFormEl = () => document.getElementById('profile-edit-form');
const editProfileButtonEl = () => document.getElementById('edit-profile-button');
const cancelEditProfileButtonEl = () => document.getElementById('cancel-edit-profile-button');
const profileUsernameEl = () => document.getElementById('profile-username');
const profileNameEl = () => document.getElementById('profile-name');
const profileEmailEl = () => document.getElementById('profile-email');
const profileEditUsernameInputEl = () => document.getElementById('profileEditUsername');
const profileEditNameInputEl = () => document.getElementById('profileEditName');
const profileEditEmailInputEl = () => document.getElementById('profileEditEmail');
const profileEditNameErrorEl = () => document.getElementById('profileEditNameError');
const profileEditEmailErrorEl = () => document.getElementById('profileEditEmailError');

export function initializeClientProfile() {
    const editButton = editProfileButtonEl();
    const cancelEditButton = cancelEditProfileButtonEl();
    const editForm = profileEditFormEl();

    if (editButton) editButton.addEventListener('click', () => toggleProfileEditMode(true));
    if (cancelEditButton) cancelEditButton.addEventListener('click', () => toggleProfileEditMode(false));
    if (editForm) editForm.addEventListener('submit', handleProfileUpdateSubmit);

    populateProfileView(); // Populate on init
    console.log("Client Profile Section Initialized.");
}

export function populateProfileView() {
    const userData = getCurrentUserData();
    if (userData) {
        if(profileUsernameEl()) profileUsernameEl().textContent = userData.username || 'N/A';
        if(profileNameEl()) profileNameEl().textContent = userData.name || 'N/A';
        if(profileEmailEl()) profileEmailEl().textContent = userData.email || 'N/A';
    } else {
        console.warn("Profile: User data not available for populating view.");
    }
}

export function toggleProfileEditMode(editMode) {
    const viewMode = profileViewModeEl();
    const editForm = profileEditFormEl();
    const userData = getCurrentUserData();

    if (viewMode && editForm) {
        viewMode.classList.toggle('hidden', editMode);
        editForm.classList.toggle('hidden', !editMode);
    }

    if (editMode && userData) {
        if(profileEditUsernameInputEl()) profileEditUsernameInputEl().value = userData.username || '';
        if(profileEditNameInputEl()) profileEditNameInputEl().value = userData.name || '';
        if(profileEditEmailInputEl()) profileEditEmailInputEl().value = userData.email || '';

        const nameError = profileEditNameErrorEl();
        const emailError = profileEditEmailErrorEl();
        if(nameError) nameError.classList.add('hidden');
        if(emailError) emailError.classList.add('hidden');
    }
}

async function handleProfileUpdateSubmit(event) {
    event.preventDefault();
    const nameInput = profileEditNameInputEl();
    const emailInput = profileEditEmailInputEl();
    const nameError = profileEditNameErrorEl();
    const emailError = profileEditEmailErrorEl();

    const updatedName = nameInput.value.trim();
    const updatedEmail = emailInput.value.trim();

    let isValid = true;
    if (!updatedName) {
        if(nameError) { nameError.textContent = "Full name cannot be empty."; nameError.classList.remove('hidden'); }
        isValid = false;
    } else {
        if(nameError) nameError.classList.add('hidden');
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!updatedEmail || !emailPattern.test(updatedEmail)) {
        if(emailError) { emailError.textContent = "Please enter a valid email address."; emailError.classList.remove('hidden'); }
        isValid = false;
    } else {
         if(emailError) emailError.classList.add('hidden');
    }
    if (!isValid) return;

    try {
        const responseData = await API.updateUserProfile({ name: updatedName, email: updatedEmail });
        showMessage("Profile updated successfully!", "success");

        // Update local cache of user data
        const updatedUserData = { ...getCurrentUserData(), name: updatedName, email: updatedEmail };
        setCurrentUserData(updatedUserData);
        updateUserWelcome(updatedUserData); // Update welcome message in header

        populateProfileView(); // Re-populate view mode
        toggleProfileEditMode(false); // Switch back to view mode
    } catch (error) {
        showMessage(`Error updating profile: ${error.message}`, 'error');
         if (error.message.toLowerCase().includes("email address is already in use")) {
            if(emailError) { emailError.textContent = error.message; emailError.classList.remove('hidden'); }
        }
    }
}