// Project/static/js/admin/config.js

export const API_BASE_URL_ADMIN = '/api/admin';
export const API_BASE_URL_CLIENT_AUTH = '/api/auth'; // For shared auth routes if any
// Project/static/js/admin/config.js
const API_BASE_URL = '/api/admin'; // Specific base URL for admin APIs

export function getApiBaseUrl() {
    return API_BASE_URL;
}
