import { saveSettingsDebounced } from "../../../../script.js"; // Fixed import path
import { extension_settings, getContext } from "../../extensions.js";
import { eventSource, event_types } from "../../../../script.js"; // Fixed import path

// Extension info
const extensionName = 'world-info-images';

// Default settings
const defaultSettings = {
    enabled: true,
    showPreviews: true,
    includeInPrompt: true
};

// Load settings
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(extension_settings[extensionName], { ...defaultSettings, ...extension_settings[extensionName] });
}

// Add CSS styles
function addStyles() {
    const styleId = 'world-info-images-styles';
    let style = document.getElementById(styleId);
    
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    
    style.textContent = `
        .world-info-image-container {
            margin: 10px 0;
            padding: 10px;
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 8px;
            background-color: var(--SmartThemeBlurTintColor);
        }
        /* ... (keep your existing styles) ... */
    `;
}

// Get world info entry ID (optimized)
function getWorldInfoEntryId(container) {
    return container.querySelector('input[name="uid"]')?.value || 
           container.dataset.uid || 
           container.closest('.world_entry')?.id || 
           `entry_${Math.random().toString(36).slice(2, 11)}`;
}

// ... (rest of your functions remain mostly the same) ...

// Hook into world info processing (with safeguards)
function hookWorldInfoProcessing() {
    try {
        if (!eventSource || !event_types) {
            console.warn('WorldInfoImages: eventSource not available');
            return;
        }

        eventSource.on(event_types.WORLD_INFO_ACTIVATED, (data) => {
            if (!extension_settings[extensionName].includeInPrompt || !data.entries) return;
            
            data.entries.forEach(entry => {
                const entryId = entry.uid || entry.id;
                const imageUrl = getSavedImageUrl(entryId);
                if (imageUrl) {
                    entry.content = `${entry.content}\n[Image: ${imageUrl}]`;
                }
            });
        });
    } catch (error) {
        console.error('WorldInfoImages: Error in hook:', error);
    }
}

// Main initialization (with better error handling)
function init() {
    try {
        console.debug('Initializing WorldInfoImages...');
        loadSettings();
        addStyles();
        
        if (eventSource && event_types) {
            hookWorldInfoProcessing();
        } else {
            console.warn('WorldInfoImages: Event system not available');
        }
        
        startUIMonitoring();
        console.log('WorldInfoImages loaded');
    } catch (error) {
        console.error('WorldInfoImages init error:', error);
    }
}

// Extension entry point (with improved readiness check)
jQuery(async () => {
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();
    
    async function waitForDependencies() {
        while (Date.now() - startTime < maxWaitTime) {
            if (typeof getContext === 'function' && 
                typeof saveSettingsDebounced === 'function') {
                return true;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        throw new Error('WorldInfoImages: Dependency timeout');
    }

    try {
        await waitForDependencies();
        init();
        
        // Add settings UI if possible
        if (window.addExtensionControls) {
            addExtensionControls(extensionName, getSettingsHtml(), initializeSettingsUI);
        }
    } catch (error) {
        console.error('WorldInfoImages failed to load:', error);
    }
});

export { init };
