// Project/static/js/common/dateUtils.js
export function formatSimpleDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        // Format to YYYY-MM-DD
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        if (isNaN(year) || isNaN(month) || isNaN(day)) return 'Invalid Date';
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error formatting simple date:", dateString, e);
        return 'Invalid Date';
    }
}

export function formatDateDetailed(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) { // Check if date is valid
             console.warn("formatDateDetailed received invalid date string:", dateString);
            return 'Invalid Date';
        }
        // Format to "Month Day, Year, HH:MM AM/PM" e.g., "May 29, 2025, 09:30 PM"
        const options = {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        };
        return date.toLocaleString(undefined, options); // Use browser's locale for formatting
    } catch (e) {
        console.error("Error formatting detailed date:", dateString, e);
        return 'Invalid Date';
    }
}

// Add other date utility functions here if needed
