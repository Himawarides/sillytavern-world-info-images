// SillyTavern World Info Images Extension
// Adds image URL support to World Info entries

import { extension_settings, getContext, saveSettingsDebounced } from '../../../extensions.js';
import { eventSource, event_types } from '../../../script.js';

const extensionName = 'world-info-images';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Default settings
const defaultSettings = {
    enabled: true,
    showPreviews: true,
    includeInPrompt: true,
    imagePosition: 'after'
};

// Initialize extension settings
if (!extension_settings[extensionName]) {
    extension_settings[extensionName] = defaultSettings;
}

let settings = extension_settings[extensionName];

// Storage for image URLs
let worldInfoImages = {};

// Load image data from extension settings
function loadImageData() {
    if (extension_settings[extensionName].imageData) {
        worldInfoImages = extension_settings[extensionName].imageData;
    }
}

// Save image data to extension settings
function saveImageData() {
    extension_settings[extensionName].imageData = worldInfoImages;
    saveSettingsDebounced();
}

// Add CSS styles for the extension
function addStyles() {
    const style = document.createElement('style');
    style.id = 'world-info-images-style';
    style.textContent = `
        .world-info-image-container {
            margin: 8px 0;
            padding: 8px;
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 4px;
            background-color: var(--SmartThemeBlurTintColor);
        }
        
        .world-info-image-label {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 4px;
            color: var(--SmartThemeBodyColor);
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .world-info-image-input {
            width: 100%;
            padding: 4px 8px;
            background-color: var(--SmartThemeInputColor);
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 4px;
            color: var(--SmartThemeBodyColor);
            font-size: 12px;
            margin-bottom: 8px;
        }
        
        .world-info-image-preview {
            max-width: 100%;
            max-height: 150px;
            border-radius: 4px;
            display: block;
            margin: 0 auto;
            border: 1px solid var(--SmartThemeBorderColor);
        }
        
        .world-info-image-preview-container {
            text-align: center;
            margin: 8px 0;
        }
        
        .world-info-image-error {
            color: var(--SmartThemeQuotColor);
            font-size: 11px;
            margin-top: 4px;
        }
        
        .world-info-image-controls {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        
        .world-info-image-btn {
            padding: 4px 8px;
            background-color: var(--SmartThemeButtonColor);
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 4px;
            color: var(--SmartThemeBodyColor);
            cursor: pointer;
            font-size: 11px;
            transition: background-color 0.2s;
        }
        
        .world-info-image-btn:hover {
            background-color: var(--SmartThemeButtonHoverColor);
        }
    `;
    document.head.appendChild(style);
}

// Get unique identifier for world info entry
function getEntryId(entry) {
    // Try to find the UID from the entry's data attributes or input fields
    const uidInput = entry.querySelector('input[name="uid"]');
    if (uidInput && uidInput.value) {
        return uidInput.value;
    }
    
    // Fallback to using the entry's position in the list
    const entryList = entry.closest('.world_entries_list');
    if (entryList) {
        const entries = entryList.querySelectorAll('.world_entry');
        return `entry_${Array.from(entries).indexOf(entry)}`;
    }
    
    return null;
}

// Create image container for world info entry
function createImageContainer(entryId) {
    const container = document.createElement('div');
    container.className = 'world-info-image-container';
    container.dataset.entryId = entryId;
    
    const currentImageUrl = worldInfoImages[entryId] || '';
    
    container.innerHTML = `
        <div class="world-info-image-label">
            <span>🖼️</span>
            <span>Image URL</span>
        </div>
        <input type="text" 
               class="world-info-image-input" 
               placeholder="Enter image URL (https://...)" 
               value="${currentImageUrl}">
        <div class="world-info-image-preview-container">
            ${currentImageUrl && settings.showPreviews ? `<img src="${currentImageUrl}" class="world-info-image-preview" alt="World Info Image">` : ''}
        </div>
        <div class="world-info-image-error" style="display: none;"></div>
        <div class="world-info-image-controls">
            <button class="world-info-image-btn test-btn">Test Image</button>
            <button class="world-info-image-btn clear-btn">Clear</button>
        </div>
    `;
    
    // Add event listeners
    const input = container.querySelector('.world-info-image-input');
    const testBtn = container.querySelector('.test-btn');
    const clearBtn = container.querySelector('.clear-btn');
    
    input.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        updateImageData(entryId, url);
    });
    
    testBtn.addEventListener('click', () => testImage(entryId));
    clearBtn.addEventListener('click', () => clearImage(entryId));
    
    return container;
}

// Update image data
function updateImageData(entryId, url) {
    if (url) {
        worldInfoImages[entryId] = url;
    } else {
        delete worldInfoImages[entryId];
    }
    saveImageData();
    
    if (settings.showPreviews) {
        updateImagePreview(entryId, url);
    }
}

// Update image preview
function updateImagePreview(entryId, url) {
    const container = document.querySelector(`[data-entry-id="${entryId}"]`);
    if (!container) return;
    
    const previewContainer = container.querySelector('.world-info-image-preview-container');
    const errorDiv = container.querySelector('.world-info-image-error');
    
    errorDiv.style.display = 'none';
    
    if (url) {
        const img = document.createElement('img');
        img.className = 'world-info-image-preview';
        img.alt = 'World Info Image';
        
        img.onload = () => {
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
        };
        
        img.onerror = () => {
            previewContainer.innerHTML = '';
            errorDiv.textContent = 'Failed to load image. Please check the URL.';
            errorDiv.style.display = 'block';
        };
        
        img.src = url;
    } else {
        previewContainer.innerHTML = '';
    }
}

// Test image function
function testImage(entryId) {
    const container = document.querySelector(`[data-entry-id="${entryId}"]`);
    const input = container.querySelector('.world-info-image-input');
    const url = input.value.trim();
    
    if (!url) {
        toastr.warning('Please enter an image URL first.');
        return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        toastr.error('Please enter a valid URL starting with http:// or https://');
        return;
    }
    
    updateImageData(entryId, url);
    toastr.success('Image URL saved! Check the preview above.');
}

// Clear image function
function clearImage(entryId) {
    const container = document.querySelector(`[data-entry-id="${entryId}"]`);
    const input = container.querySelector('.world-info-image-input');
    input.value = '';
    updateImageData(entryId, '');
    toastr.info('Image cleared.');
}

// Add image controls to world info entries
function addImageControlsToEntries() {
    if (!settings.enabled) return;
    
    const worldEntries = document.querySelectorAll('.world_entry');
    
    worldEntries.forEach(entry => {
        const entryId = getEntryId(entry);
        if (!entryId) return;
        
        // Check if image controls already exist
        if (entry.querySelector('.world-info-image-container')) return;
        
        // Find the content textarea
        const contentArea = entry.querySelector('.world_entry_form_control');
        if (!contentArea) return;
        
        // Create and insert image container
        const imageContainer = createImageContainer(entryId);
        contentArea.parentNode.insertBefore(imageContainer, contentArea.nextSibling);
    });
}

// Hook into world info processing to include images in prompts
function hookWorldInfoProcessing() {
    // Listen for world info activation events
    eventSource.on(event_types.WORLD_INFO_ACTIVATED, (data) => {
        if (!settings.includeInPrompt) return;
        
        // Process each activated world info entry
        data.entries.forEach(entry => {
            const entryId = entry.uid || entry.id;
            if (worldInfoImages[entryId]) {
                const imageUrl = worldInfoImages[entryId];
                const imageText = `[Image: ${imageUrl}]`;
                
                // Add image reference to the entry content
                if (settings.imagePosition === 'before') {
                    entry.content = `${imageText}\n${entry.content}`;
                } else {
                    entry.content = `${entry.content}\n${imageText}`;
                }
            }
        });
    });
}

// Create settings UI
function createSettingsUI() {
    const settingsHtml = `
        <div class="world-info-images-settings">
            <h4>World Info Images Extension</h4>
            <label class="checkbox_label">
                <input type="checkbox" id="world-info-images-enabled" ${settings.enabled ? 'checked' : ''}>
                <span>Enable extension</span>
            </label>
            <label class="checkbox_label">
                <input type="checkbox" id="world-info-images-previews" ${settings.showPreviews ? 'checked' : ''}>
                <span>Show image previews</span>
            </label>
            <label class="checkbox_label">
                <input type="checkbox" id="world-info-images-include" ${settings.includeInPrompt ? 'checked' : ''}>
                <span>Include images in AI prompts</span>
            </label>
            <div class="margin-bot-10px">
                <label for="world-info-images-position">Image position in prompt:</label>
                <select id="world-info-images-position">
                    <option value="before" ${settings.imagePosition === 'before' ? 'selected' : ''}>Before content</option>
                    <option value="after" ${settings.imagePosition === 'after' ? 'selected' : ''}>After content</option>
                </select>
            </div>
        </div>
    `;
    
    return settingsHtml;
}

// Initialize settings event listeners
function initializeSettings() {
    $('#world-info-images-enabled').on('change', function() {
        settings.enabled = this.checked;
        saveSettingsDebounced();
    });
    
    $('#world-info-images-previews').on('change', function() {
        settings.showPreviews = this.checked;
        saveSettingsDebounced();
    });
    
    $('#world-info-images-include').on('change', function() {
        settings.includeInPrompt = this.checked;
        saveSettingsDebounced();
    });
    
    $('#world-info-images-position').on('change', function() {
        settings.imagePosition = this.value;
        saveSettingsDebounced();
    });
}

// Main initialization function
function init() {
    console.log('Initializing World Info Images extension...');
    
    // Load saved image data
    loadImageData();
    
    // Add styles
    addStyles();
    
    // Hook into world info processing
    hookWorldInfoProcessing();
    
    // Monitor for world info UI changes
    const observer = new MutationObserver(() => {
        addImageControlsToEntries();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Initial check for existing world info entries
    setTimeout(addImageControlsToEntries, 1000);
    
    console.log('World Info Images extension initialized');
}

// Extension entry point
jQuery(async () => {
    // Add settings to the extensions panel
    if (typeof addExtensionControl !== 'undefined') {
        addExtensionControl(extensionName, createSettingsUI(), initializeSettings);
    }
    
    // Initialize the extension
    init();
});

// Export for SillyTavern
export { init };
