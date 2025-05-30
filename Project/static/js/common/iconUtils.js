// Project/static/js/common/iconUtils.js

/**
 * Creates and injects a Lucide icon into a specified HTML element.
 * @param {string} elementId - The ID of the HTML element to contain the icon.
 * @param {string} iconName - The name of the Lucide icon (e.g., 'Menu', 'LayoutDashboard').
 * @param {object} properties - An object of attributes to set on the SVG icon (e.g., { class: 'h-5 w-5' }).
 */
export const createIcon = (elementId, iconName, properties = {}) => {
    const container = document.getElementById(elementId);
    if (container && typeof lucide !== 'undefined' && lucide[iconName]) {
        const iconNode = lucide.createElement(lucide[iconName]);
        Object.keys(properties).forEach(key => {
            // Ensure 'class' is set using classList for better compatibility if needed, though setAttribute works for SVG.
            if (key === 'class') {
                properties[key].split(' ').forEach(cls => { if(cls) iconNode.classList.add(cls); });
            } else {
                iconNode.setAttribute(key, properties[key]);
            }
        });
        container.innerHTML = ''; // Clear previous content
        container.appendChild(iconNode);
    } else {
        if (!container) {
            console.warn(`IconUtils: Element with ID '${elementId}' not found for icon '${iconName}'.`);
        } else if (typeof lucide === 'undefined') {
            console.warn(`IconUtils: Lucide library not loaded. Cannot create icon '${iconName}'.`);
        } else if (!lucide[iconName]) {
            console.warn(`IconUtils: Icon name '${iconName}' not found in Lucide library.`);
        }
        // Fallback placeholder if icon creation fails but container exists
        if (container) {
            container.innerHTML = `<svg class="${properties.class || 'h-5 w-5 text-gray-400'}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`; // Placeholder: info icon
        }
    }
};

/**
 * Re-initializes all Lucide icons on the page.
 * Useful after dynamically adding content that includes data-lucide attributes.
 */
export const refreshLucideIcons = () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    } else {
        console.warn("IconUtils: Lucide library not loaded. Cannot refresh icons.");
    }
};