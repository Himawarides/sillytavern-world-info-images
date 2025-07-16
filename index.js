import { saveSettingsDebounced } from "../../../../../script.js"; // Fixed path (up 5 levels)
import { extension_settings, getContext } from "../../extensions.js";
import { eventSource, event_types } from "../../../../../script.js"; // Fixed path

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
    Object.assign(extension_settings[extensionName], { 
        ...defaultSettings, 
        ...extension_settings[extensionName],
        imageData: extension_settings[extensionName].imageData || {}
    });
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

// Create image controls (with safer HTML)
function createImageControls(entryId) {
    const container = document.createElement('div');
    container.className = 'world-info-image-container';
    container.dataset.entryId = entryId;
    
    const savedUrl = getSavedImageUrl(entryId);
    const escapedUrl = savedUrl ? savedUrl.replace(/"/g, '&quot;') : '';
    
    container.innerHTML = `
        <div class="world-info-image-header">
            <span>🖼️</span>
            <span>Image URL</span>
        </div>
        <input type="text" 
               class="world-info-image-input" 
               placeholder="Enter image URL (https://example.com/image.jpg)"
               value="${escapedUrl}">
        <div class="world-info-image-preview-container">
            ${savedUrl && extension_settings[extensionName].showPreviews ? 
                `<img src="${escapedUrl}" class="world-info-image-preview" alt="World Info Image">` : 
                ''}
        </div>
        <div class="world-info-image-error"></div>
        <div class="world-info-image-controls">
            <button class="world-info-image-btn" data-action="test">Test Image</button>
            <button class="world-info-image-btn" data-action="clear">Clear</button>
        </div>
    `;
    
    setupImageControlEvents(container, entryId);
    return container;
}

// ... (rest of your functions remain mostly the same) ...

// Main initialization (with better error handling)
function init() {
    try {
        console.debug('[WorldInfoImages] Initializing...');
        loadSettings();
        addStyles();
        
        if (eventSource && event_types) {
            hookWorldInfoProcessing();
        } else {
            console.warn('[WorldInfoImages] Event system unavailable - some features disabled');
        }
        
        startUIMonitoring();
        console.log('[WorldInfoImages] Loaded successfully');
    } catch (error) {
        console.error('[WorldInfoImages] Init error:', error);
    }
}

// Extension entry point (with improved readiness check)
jQuery(async () => {
    console.log('[WorldInfoImages] Starting load...');
    
    // Core dependency check
    const requiredGlobals = ['getContext', 'saveSettingsDebounced', 'eventSource'];
    const missingDeps = requiredGlobals.filter(g => !window[g]);
    
    if (missingDeps.length) {
        console.error(`[WorldInfoImages] Missing dependencies: ${missingDeps.join(', ')}`);
        return;
    }

    try {
        // Wait for world info to initialize
        let attempts = 0;
        while (!document.querySelector('.world_entry') && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        init();
        
        if (window.addExtensionControls) {
            addExtensionControls(extensionName, getSettingsHtml(), initializeSettingsUI);
        }
    } catch (error) {
        console.error('[WorldInfoImages] Load failed:', error);
    }
});
