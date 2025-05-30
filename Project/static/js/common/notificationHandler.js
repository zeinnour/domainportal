// Project/static/js/common/notificationHandler.js

import { createIcon, refreshLucideIcons } from './iconUtils.js'; // Assuming iconUtils.js is in the same common folder
import { formatSimpleDate } from './dateUtils.js'; // Assuming dateUtils.js is in the same common folder

// --- Configuration ---
const API_BASE_URL = '/api'; // General API base
const NOTIFICATIONS_API_URL = `${API_BASE_URL}/notifications`;
const MARK_READ_API_URL = `${API_BASE_URL}/notifications/mark-read`;
const POLLING_INTERVAL = 30000; // 30 seconds for polling new notifications

// --- State ---
let notificationBellButton = null;
let notificationDropdownPanel = null;
let notificationCountBadge = null;
let notificationItemsList = null;
let markAllNotificationsReadButton = null;
let viewAllNotificationsLink = null; // For future use

let isPanelOpen = false;
let notificationPollingIntervalId = null;
let currentUnreadCount = 0;

/**
 * Initializes the notification system for a given panel (client or admin).
 * @param {string} bellButtonId - ID of the notification bell button.
 * @param {string} bellIconId - ID of the SVG/span container for the bell icon itself.
 * @param {string} dropdownPanelId - ID of the notification dropdown panel.
 * @param {string} countBadgeId - ID of the unread count badge.
 * @param {string} itemsListId - ID of the UL element for notification items.
 * @param {string} markAllReadButtonId - ID of the "Mark all as read" button.
 * @param {string} viewAllLinkId - ID of the "View all notifications" link.
 */
export function initializeNotificationSystem(
    bellButtonId,
    bellIconId, // For dynamically creating the icon
    dropdownPanelId,
    countBadgeId,
    itemsListId,
    markAllReadButtonId,
    viewAllLinkId
) {
    notificationBellButton = document.getElementById(bellButtonId);
    notificationDropdownPanel = document.getElementById(dropdownPanelId);
    notificationCountBadge = document.getElementById(countBadgeId);
    notificationItemsList = document.getElementById(itemsListId);
    markAllNotificationsReadButton = document.getElementById(markAllReadButtonId);
    viewAllNotificationsLink = document.getElementById(viewAllLinkId); // Store for future

    if (!notificationBellButton || !notificationDropdownPanel || !notificationCountBadge || !notificationItemsList || !markAllNotificationsReadButton) {
        console.error("NotificationHandler: One or more essential notification elements not found. System will not initialize.", {
            bellButtonId, dropdownPanelId, countBadgeId, itemsListId, markAllReadButtonId
        });
        return;
    }

    // Create the bell icon dynamically
    if (bellIconId && document.getElementById(bellIconId)) {
        createIcon(bellIconId, 'Bell', { class: 'h-6 w-6' }); // Ensure lucide is available
    } else if (bellIconId) {
        console.warn(`NotificationHandler: Bell icon container with ID '${bellIconId}' not found.`);
    }


    notificationBellButton.addEventListener('click', toggleNotificationPanel);
    markAllNotificationsReadButton.addEventListener('click', handleMarkAllRead);

    // Close dropdown if clicked outside
    document.addEventListener('click', (event) => {
        if (isPanelOpen &&
            !notificationDropdownPanel.contains(event.target) &&
            !notificationBellButton.contains(event.target)) {
            closeNotificationPanel();
        }
    });

    fetchNotifications(); // Initial fetch
    startNotificationPolling();

    console.log(`Notification system initialized for ${bellButtonId.startsWith('admin-') ? 'Admin' : 'Client'} Panel.`);
}

/**
 * Toggles the visibility of the notification panel.
 */
function toggleNotificationPanel() {
    isPanelOpen = !isPanelOpen;
    notificationDropdownPanel.classList.toggle('hidden', !isPanelOpen);
    if (isPanelOpen) {
        fetchNotifications(); // Refresh when opened
    }
}

/**
 * Closes the notification panel.
 */
function closeNotificationPanel() {
    isPanelOpen = false;
    if (notificationDropdownPanel) {
        notificationDropdownPanel.classList.add('hidden');
    }
}

/**
 * Fetches notifications from the server.
 */
async function fetchNotifications() {
    if (!notificationItemsList) return;
    notificationItemsList.innerHTML = '<li class="p-3 text-center text-gray-500 text-sm">Loading notifications...</li>';

    try {
        const response = await fetch(NOTIFICATIONS_API_URL, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const data = await response.json();
        renderNotifications(data.notifications || []);
        updateUnreadCount(data.unread_count || 0);
    } catch (error) {
        console.error("NotificationHandler: Error fetching notifications:", error);
        if (notificationItemsList) {
            notificationItemsList.innerHTML = '<li class="p-3 text-center text-red-400 text-sm">Could not load notifications.</li>';
        }
        updateUnreadCount(0); // Reset count on error
    }
}

/**
 * Renders the fetched notifications in the dropdown.
 * @param {Array<object>} notifications - Array of notification objects.
 */
function renderNotifications(notifications) {
    if (!notificationItemsList) return;
    notificationItemsList.innerHTML = ''; // Clear previous items

    if (notifications.length === 0) {
        notificationItemsList.innerHTML = '<li class="p-3 text-center text-gray-500 text-sm">No new notifications.</li>';
        return;
    }

    notifications.forEach(notification => {
        const li = document.createElement('li');
        li.className = `p-3 hover:bg-gray-700 cursor-pointer ${notification.is_read ? 'opacity-70' : 'font-semibold'}`;
        li.dataset.notificationId = notification.id;
        li.addEventListener('click', () => handleNotificationClick(notification));

        let iconName = 'Info';
        let iconColor = 'text-sky-400'; // Default

        // Determine icon and color based on notification_type
        if (notification.notification_type) {
            if (notification.notification_type.includes('ticket_reply') || notification.notification_type.includes('ticket_status')) {
                iconName = 'MessageSquare';
                iconColor = 'text-purple-400';
            } else if (notification.notification_type.includes('invoice')) {
                iconName = 'FileText';
                iconColor = 'text-green-400';
            } else if (notification.notification_type.includes('domain_expiry')) {
                iconName = 'CalendarClock';
                iconColor = 'text-yellow-400';
            } else if (notification.notification_type.includes('request_update') || notification.notification_type.includes('new_request')) {
                iconName = 'BellRing'; // Or specific icons per request type
                iconColor = 'text-indigo-400';
                if (notification.message.toLowerCase().includes('approved') || notification.message.toLowerCase().includes('completed')) {
                    iconName = 'CheckCircle2'; iconColor = 'text-green-400';
                } else if (notification.message.toLowerCase().includes('rejected') || notification.message.toLowerCase().includes('failed')) {
                    iconName = 'XCircle'; iconColor = 'text-red-400';
                }
            }
        }


        const iconContainerId = `notif-icon-${notification.id}`;

        li.innerHTML = `
            <div class="flex items-start space-x-3">
                <span id="${iconContainerId}" class="mt-1 flex-shrink-0 ${iconColor}"></span>
                <div>
                    <p class="text-sm ${notification.is_read ? 'text-gray-400' : 'text-gray-100'}">${notification.message}</p>
                    <p class="text-xs text-gray-500">${formatSimpleDate(notification.timestamp)}</p>
                </div>
            </div>
        `;
        notificationItemsList.appendChild(li);
        createIcon(iconContainerId, iconName, { class: 'h-4 w-4' });
    });
    refreshLucideIcons(); // Ensure newly added icons are rendered
}

/**
 * Updates the unread notification count badge.
 * @param {number} count - The number of unread notifications.
 */
function updateUnreadCount(count) {
    currentUnreadCount = count;
    if (notificationCountBadge) {
        notificationCountBadge.textContent = count > 9 ? '9+' : count.toString();
        notificationCountBadge.classList.toggle('hidden', count === 0);
    }
}

/**
 * Handles clicking on a single notification item.
 * Marks it as read and navigates if a link is present.
 * @param {object} notification - The clicked notification object.
 */
async function handleNotificationClick(notification) {
    if (!notification.is_read) {
        try {
            const response = await fetch(MARK_READ_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                body: JSON.stringify({ ids: [notification.id] })
            });
            if (!response.ok) throw new Error('Failed to mark as read');
            const data = await response.json();
            updateUnreadCount(data.unread_count);
            // Visually mark as read in the list immediately
            const clickedLi = notificationItemsList.querySelector(`li[data-notification-id="${notification.id}"]`);
            if (clickedLi) {
                clickedLi.classList.add('opacity-70');
                clickedLi.classList.remove('font-semibold');
                const messageP = clickedLi.querySelector('.text-gray-100');
                if(messageP) messageP.classList.replace('text-gray-100', 'text-gray-400');
            }
        } catch (error) {
            console.error("NotificationHandler: Error marking notification as read:", error);
        }
    }

    if (notification.link && notification.link !== '#') {
        // For SPA-like navigation, you might need a more sophisticated router.
        // For now, simple window navigation.
        // If link is relative (e.g. '#some-section'), it will work with hash-based routing.
        if (notification.link.startsWith('#')) {
            window.location.hash = notification.link;
            // If using a JS router, you'd call its navigate method here.
            // e.g., router.navigate(notification.link.substring(1));
            // For now, we assume showClientSection or showAdminSection will be triggered by hash change.
        } else {
            window.location.href = notification.link;
        }
    }
    closeNotificationPanel();
}

/**
 * Handles the "Mark all as read" button click.
 */
async function handleMarkAllRead() {
    if (currentUnreadCount === 0) return; // No unread notifications

    try {
        const response = await fetch(MARK_READ_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
            body: JSON.stringify({ ids: 'all' }) // Special keyword for backend
        });
        if (!response.ok) throw new Error('Failed to mark all as read');
        const data = await response.json();
        updateUnreadCount(data.unread_count);
        // Visually mark all as read
        notificationItemsList.querySelectorAll('li').forEach(li => {
            li.classList.add('opacity-70');
            li.classList.remove('font-semibold');
            const messageP = li.querySelector('.text-gray-100');
            if(messageP) messageP.classList.replace('text-gray-100', 'text-gray-400');
        });
    } catch (error) {
        console.error("NotificationHandler: Error marking all notifications as read:", error);
    }
}

/**
 * Starts polling for new notifications.
 */
function startNotificationPolling() {
    if (notificationPollingIntervalId) {
        clearInterval(notificationPollingIntervalId);
    }
    notificationPollingIntervalId = setInterval(async () => {
        try {
            const response = await fetch(NOTIFICATIONS_API_URL, { credentials: 'include' });
            if (!response.ok) return; // Silently fail polling or log minimally
            const data = await response.json();
            if (data.unread_count !== currentUnreadCount) {
                updateUnreadCount(data.unread_count);
                if (isPanelOpen) { // Refresh list if panel is open and count changed
                    renderNotifications(data.notifications || []);
                }
            }
        } catch (error) {
            console.warn("NotificationHandler: Polling error -", error.message);
        }
    }, POLLING_INTERVAL);
}

/**
 * Stops polling for new notifications.
 */
export function stopNotificationPolling() {
    if (notificationPollingIntervalId) {
        clearInterval(notificationPollingIntervalId);
        notificationPollingIntervalId = null;
    }
}

// Cleanup on page unload (optional, good practice)
window.addEventListener('beforeunload', stopNotificationPolling);
