import { saveSettingsDebounced } from "../../../script.js";
import { extension_settings, getContext } from "../../extensions.js";
import { eventSource, event_types } from "../../../script.js";

// Extension info
const extensionName = 'world-info-images';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Default settings
const defaultSettings = {
    enabled: true,
    showPreviews: true,
    includeInPrompt: true
};

// Load settings
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
}

// Save settings
function saveSettings() {
    saveSettingsDebounced();
}

// Add CSS styles
function addStyles() {
    // Remove existing styles if they exist
    const existingStyles = document.getElementById('world-info-images-styles');
    if (existingStyles) {
        existingStyles.remove();
    }
    
    const style = document.createElement('style');
    style.id = 'world-info-images-styles';
    style.textContent = `
        .world-info-image-container {
            margin: 10px 0;
            padding: 10px;
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 8px;
            background-color: var(--SmartThemeBlurTintColor);
        }
        
        .world-info-image-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-weight: bold;
            color: var(--SmartThemeBodyColor);
            font-size: 14px;
        }
        
        .world-info-image-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 4px;
            background-color: var(--SmartThemeInputColor);
            color: var(--SmartThemeBodyColor);
            font-size: 13px;
            margin-bottom: 10px;
        }
        
        .world-info-image-input:focus {
            outline: none;
            border-color: var(--SmartThemeQuotColor);
        }
        
        .world-info-image-preview {
            max-width: 100%;
            max-height: 200px;
            border-radius: 4px;
            display: block;
            margin: 10px auto;
            border: 1px solid var(--SmartThemeBorderColor);
        }
        
        .world-info-image-error {
            color: #ff6b6b;
            font-size: 12px;
            margin-top: 5px;
            display: none;
        }
        
        .world-info-image-controls {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }
        
        .world-info-image-btn {
            padding: 6px 12px;
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 4px;
            background-color: var(--SmartThemeButtonColor);
            color: var(--SmartThemeBodyColor);
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }
        
        .world-info-image-btn:hover {
            background-color: var(--SmartThemeButtonHoverColor);
        }
        
        .world-info-image-btn:active {
            transform: translateY(1px);
        }
    `;
    document.head.appendChild(style);
}

// Get world info entry ID
function getWorldInfoEntryId(container) {
    try {
        // Look for the UID in various places
        const uidInput = container.querySelector('input[name="uid"]');
        if (uidInput && uidInput.value) {
            return uidInput.value;
        }
        
        // Try to find it in data attributes
        if (container.dataset.uid) {
            return container.dataset.uid;
        }
        
        // Look for it in the world info structure
        const worldInfoList = container.closest('#world_info');
        if (worldInfoList) {
            const entries = worldInfoList.querySelectorAll('.world_entry');
            const index = Array.from(entries).indexOf(container);
            if (index !== -1) {
                return `entry_${index}`;
            }
        }
        
        // Generate a fallback ID based on some unique property
        const textArea = container.querySelector('textarea');
        if (textArea) {
            return `entry_${textArea.id || Math.random().toString(36).substr(2, 9)}`;
        }
        
        return `entry_${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
        console.error('Error getting world info entry ID:', error);
        return `entry_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Create image controls
function createImageControls(entryId) {
    const container = document.createElement('div');
    container.className = 'world-info-image-container';
    container.dataset.entryId = entryId;
    
    const savedUrl = getSavedImageUrl(entryId);
    
    container.innerHTML = `
        <div class="world-info-image-header">
            <span>🖼️</span>
            <span>Image URL</span>
        </div>
        <input type="text" 
               class="world-info-image-input" 
               placeholder="Enter image URL (https://example.com/image.jpg)"
               value="${savedUrl || ''}">
        <div class="world-info-image-preview-container">
            ${savedUrl && extension_settings[extensionName].showPreviews ? 
                `<img src="${savedUrl}" class="world-info-image-preview" alt="World Info Image">` : 
                ''}
        </div>
        <div class="world-info-image-error"></div>
        <div class="world-info-image-controls">
            <button class="world-info-image-btn" data-action="test">Test Image</button>
            <button class="world-info-image-btn" data-action="clear">Clear</button>
        </div>
    `;
    
    // Add event listeners
    setupImageControlEvents(container, entryId);
    
    return container;
}

// Setup event listeners for image controls
function setupImageControlEvents(container, entryId) {
    const input = container.querySelector('.world-info-image-input');
    const testBtn = container.querySelector('[data-action="test"]');
    const clearBtn = container.querySelector('[data-action="clear"]');
    
    // Input change handler
    input.addEventListener('input', debounce((e) => {
        const url = e.target.value.trim();
        saveImageUrl(entryId, url);
        if (extension_settings[extensionName].showPreviews) {
            updatePreview(container, url);
        }
    }, 500));
    
    // Test button
    testBtn.addEventListener('click', () => {
        const url = input.value.trim();
        if (!url) {
            showError(container, 'Please enter an image URL first');
            return;
        }
        if (!isValidUrl(url)) {
            showError(container, 'Please enter a valid URL starting with http:// or https://');
            return;
        }
        testImage(container, url);
    });
    
    // Clear button
    clearBtn.addEventListener('click', () => {
        input.value = '';
        saveImageUrl(entryId, '');
        clearPreview(container);
        clearError(container);
    });
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function showError(container, message) {
    const errorDiv = container.querySelector('.world-info-image-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function clearError(container) {
    const errorDiv = container.querySelector('.world-info-image-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

function updatePreview(container, url) {
    const previewContainer = container.querySelector('.world-info-image-preview-container');
    if (!previewContainer) return;
    
    clearError(container);
    
    if (url && isValidUrl(url)) {
        const img = document.createElement('img');
        img.className = 'world-info-image-preview';
        img.alt = 'World Info Image';
        
        img.onload = () => {
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
        };
        
        img.onerror = () => {
            previewContainer.innerHTML = '';
            showError(container, 'Failed to load image. Please check the URL.');
        };
        
        img.src = url;
    } else {
        previewContainer.innerHTML = '';
    }
}

function clearPreview(container) {
    const previewContainer = container.querySelector('.world-info-image-preview-container');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
}

function testImage(container, url) {
    const img = new Image();
    img.onload = () => {
        updatePreview(container, url);
        clearError(container);
        // Check if toastr is available
        if (typeof toastr !== 'undefined') {
            toastr.success('Image loaded successfully!');
        }
    };
    img.onerror = () => {
        clearPreview(container);
        showError(container, 'Failed to load image. Please check the URL.');
        // Check if toastr is available
        if (typeof toastr !== 'undefined') {
            toastr.error('Failed to load image');
        }
    };
    img.src = url;
}

// Image data storage
function getSavedImageUrl(entryId) {
    const imageData = extension_settings[extensionName].imageData || {};
    return imageData[entryId] || '';
}

function saveImageUrl(entryId, url) {
    if (!extension_settings[extensionName].imageData) {
        extension_settings[extensionName].imageData = {};
    }
    
    if (url) {
        extension_settings[extensionName].imageData[entryId] = url;
    } else {
        delete extension_settings[extensionName].imageData[entryId];
    }
    
    saveSettings();
}

// Add controls to world info entries
function addImageControlsToEntries() {
    try {
        if (!extension_settings[extensionName].enabled) return;
        
        const worldInfoEntries = document.querySelectorAll('.world_entry');
        
        worldInfoEntries.forEach(entry => {
            const entryId = getWorldInfoEntryId(entry);
            if (!entryId) return;
            
            // Skip if already has image controls
            if (entry.querySelector('.world-info-image-container')) return;
            
            // Find a good place to insert the controls
            const textareaContainer = entry.querySelector('.world_entry_form_control')?.parentElement;
            if (!textareaContainer) return;
            
            const imageControls = createImageControls(entryId);
            textareaContainer.appendChild(imageControls);
        });
    } catch (error) {
        console.error('Error adding image controls:', error);
    }
}

// Hook into world info processing
function hookWorldInfoProcessing() {
    try {
        // Listen for world info events
        eventSource.on(event_types.WORLD_INFO_ACTIVATED, (data) => {
            if (!extension_settings[extensionName].includeInPrompt) return;
            
            // Process activated entries
            if (data.entries) {
                data.entries.forEach(entry => {
                    const entryId = entry.uid || entry.id;
                    const imageUrl = getSavedImageUrl(entryId);
                    
                    if (imageUrl) {
                        // Add image to entry content
                        const imageReference = `[Image: ${imageUrl}]`;
                        entry.content = `${entry.content}\n${imageReference}`;
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error hooking world info processing:', error);
    }
}

// Monitor for UI changes
function startUIMonitoring() {
    try {
        const observer = new MutationObserver(() => {
            addImageControlsToEntries();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Initial check with delay
        setTimeout(() => {
            addImageControlsToEntries();
        }, 1000);
    } catch (error) {
        console.error('Error starting UI monitoring:', error);
    }
}

// Settings HTML
function getSettingsHtml() {
    return `
        <div class="world-info-images-settings">
            <h4>World Info Images Settings</h4>
            <div class="margin-bot-10px">
                <label class="checkbox_label">
                    <input type="checkbox" id="world_info_images_enabled" ${extension_settings[extensionName].enabled ? 'checked' : ''}>
                    <span>Enable World Info Images</span>
                </label>
            </div>
            <div class="margin-bot-10px">
                <label class="checkbox_label">
                    <input type="checkbox" id="world_info_images_previews" ${extension_settings[extensionName].showPreviews ? 'checked' : ''}>
                    <span>Show image previews</span>
                </label>
            </div>
            <div class="margin-bot-10px">
                <label class="checkbox_label">
                    <input type="checkbox" id="world_info_images_include" ${extension_settings[extensionName].includeInPrompt ? 'checked' : ''}>
                    <span>Include images in AI prompts</span>
                </label>
            </div>
        </div>
    `;
}

// Initialize settings UI
function initializeSettingsUI() {
    try {
        $('#world_info_images_enabled').on('change', function() {
            extension_settings[extensionName].enabled = this.checked;
            saveSettings();
        });
        
        $('#world_info_images_previews').on('change', function() {
            extension_settings[extensionName].showPreviews = this.checked;
            saveSettings();
        });
        
        $('#world_info_images_include').on('change', function() {
            extension_settings[extensionName].includeInPrompt = this.checked;
            saveSettings();
        });
    } catch (error) {
        console.error('Error initializing settings UI:', error);
    }
}

// Main initialization
function init() {
    try {
        console.log('Initializing World Info Images extension...');
        
        loadSettings();
        addStyles();
        hookWorldInfoProcessing();
        startUIMonitoring();
        
        console.log('World Info Images extension loaded successfully');
    } catch (error) {
        console.error('Error initializing World Info Images extension:', error);
        throw error;
    }
}

// Extension entry point
jQuery(async () => {
    try {
        console.log('World Info Images extension starting...');
        
        // Wait for SillyTavern to be ready
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for SillyTavern to be ready'));
            }, 10000); // 10 second timeout
            
            if (typeof getContext === 'function') {
                clearTimeout(timeout);
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (typeof getContext === 'function') {
                        clearInterval(checkInterval);
                        clearTimeout(timeout);
                        resolve();
                    }
                }, 100);
            }
        });
        
        // Initialize the extension
        init();
        
        // Add to extensions menu if possible
        if (typeof addExtensionControls === 'function') {
            addExtensionControls(extensionName, getSettingsHtml(), initializeSettingsUI);
        }
        
        console.log('World Info Images extension setup complete');
        
    } catch (error) {
        console.error('Failed to load World Info Images extension:', error);
        // Don't re-throw the error to prevent it from propagating
    }
});

export { init };
