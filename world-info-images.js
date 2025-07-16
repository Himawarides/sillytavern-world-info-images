// World Info Images Extension for SillyTavern
// Adds image URL support to World Info entries

(function() {
    'use strict';

    const MODULE_NAME = 'world-info-images';
    const UPDATE_INTERVAL = 500; // Check for UI updates every 500ms

    let extensionSettings = {
        enabled: true,
        includeInPrompt: true,
        imagePosition: 'after' // 'before' or 'after' content
    };

    // Storage for image URLs per world info entry
    let imageData = {};

    // Initialize the extension
    function init() {
        // Load settings
        loadSettings();
        
        // Add CSS styles
        addStyles();
        
        // Start monitoring for World Info UI
        startUIMonitoring();
        
        // Register settings
        registerSettings();
        
        console.log(`[${MODULE_NAME}] Extension initialized`);
    }

    // Load extension settings
    function loadSettings() {
        const saved = localStorage.getItem(`${MODULE_NAME}_settings`);
        if (saved) {
            extensionSettings = { ...extensionSettings, ...JSON.parse(saved) };
        }
        
        const savedImageData = localStorage.getItem(`${MODULE_NAME}_imageData`);
        if (savedImageData) {
            imageData = JSON.parse(savedImageData);
        }
    }

    // Save extension settings
    function saveSettings() {
        localStorage.setItem(`${MODULE_NAME}_settings`, JSON.stringify(extensionSettings));
        localStorage.setItem(`${MODULE_NAME}_imageData`, JSON.stringify(imageData));
    }

    // Add required CSS styles
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .worldinfo-image-container {
                margin: 8px 0;
                padding: 8px;
                border: 1px solid #444;
                border-radius: 4px;
                background-color: #2a2a2a;
            }
            
            .worldinfo-image-input {
                width: 100%;
                padding: 4px 8px;
                background-color: #333;
                border: 1px solid #555;
                border-radius: 4px;
                color: #fff;
                font-size: 12px;
                margin-bottom: 8px;
            }
            
            .worldinfo-image-preview {
                max-width: 100%;
                max-height: 200px;
                border-radius: 4px;
                display: block;
                margin: 0 auto;
            }
            
            .worldinfo-image-error {
                color: #ff6b6b;
                font-size: 11px;
                margin-top: 4px;
            }
            
            .worldinfo-image-controls {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            
            .worldinfo-image-btn {
                padding: 4px 8px;
                background-color: #444;
                border: 1px solid #666;
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 11px;
            }
            
            .worldinfo-image-btn:hover {
                background-color: #555;
            }
        `;
        document.head.appendChild(style);
    }

    // Start monitoring for World Info UI changes
    function startUIMonitoring() {
        setInterval(() => {
            if (extensionSettings.enabled) {
                addImageControlsToWorldInfo();
            }
        }, UPDATE_INTERVAL);
    }

    // Add image controls to World Info entries
    function addImageControlsToWorldInfo() {
        const worldInfoEntries = document.querySelectorAll('.world_entry');
        
        worldInfoEntries.forEach(entry => {
            const entryId = getEntryId(entry);
            if (!entryId) return;
            
            // Check if image controls already exist
            if (entry.querySelector('.worldinfo-image-container')) return;
            
            // Find the content area
            const contentArea = entry.querySelector('.world_entry_form_control');
            if (!contentArea) return;
            
            // Create image container
            const imageContainer = createImageContainer(entryId);
            
            // Insert after the content area
            contentArea.parentNode.insertBefore(imageContainer, contentArea.nextSibling);
        });
    }

    // Get unique entry ID
    function getEntryId(entry) {
        // Try to find a unique identifier for the entry
        const titleInput = entry.querySelector('input[placeholder*="Title"], input[placeholder*="Memo"]');
        if (titleInput) {
            return titleInput.value || `entry_${Array.from(entry.parentNode.children).indexOf(entry)}`;
        }
        return `entry_${Array.from(entry.parentNode.children).indexOf(entry)}`;
    }

    // Create image container HTML
    function createImageContainer(entryId) {
        const container = document.createElement('div');
        container.className = 'worldinfo-image-container';
        
        const currentImageUrl = imageData[entryId] || '';
        
        container.innerHTML = `
            <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px; color: #ccc;">
                📷 Image URL
            </div>
            <input type="text" 
                   class="worldinfo-image-input" 
                   placeholder="Enter image URL (https://...)" 
                   value="${currentImageUrl}"
                   data-entry-id="${entryId}">
            <div class="worldinfo-image-preview-container">
                ${currentImageUrl ? `<img src="${currentImageUrl}" class="worldinfo-image-preview" alt="World Info Image">` : ''}
            </div>
            <div class="worldinfo-image-error" style="display: none;"></div>
            <div class="worldinfo-image-controls">
                <button class="worldinfo-image-btn" onclick="worldInfoImagesExt.testImage('${entryId}')">Test Image</button>
                <button class="worldinfo-image-btn" onclick="worldInfoImagesExt.clearImage('${entryId}')">Clear</button>
            </div>
        `;
        
        // Add event listener for input changes
        const input = container.querySelector('.worldinfo-image-input');
        input.addEventListener('blur', (e) => {
            const url = e.target.value.trim();
            updateImageData(entryId, url);
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = e.target.value.trim();
                updateImageData(entryId, url);
            }
        });
        
        return container;
    }

    // Update image data
    function updateImageData(entryId, url) {
        if (url) {
            imageData[entryId] = url;
        } else {
            delete imageData[entryId];
        }
        saveSettings();
        updateImagePreview(entryId, url);
    }

    // Update image preview
    function updateImagePreview(entryId, url) {
        const container = document.querySelector(`[data-entry-id="${entryId}"]`).closest('.worldinfo-image-container');
        const previewContainer = container.querySelector('.worldinfo-image-preview-container');
        const errorDiv = container.querySelector('.worldinfo-image-error');
        
        errorDiv.style.display = 'none';
        
        if (url) {
            const img = document.createElement('img');
            img.className = 'worldinfo-image-preview';
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
        const input = document.querySelector(`[data-entry-id="${entryId}"]`);
        const url = input.value.trim();
        
        if (!url) {
            alert('Please enter an image URL first.');
            return;
        }
        
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            alert('Please enter a valid URL starting with http:// or https://');
            return;
        }
        
        updateImageData(entryId, url);
        alert('Image tested! Check the preview above.');
    }

    // Clear image function
    function clearImage(entryId) {
        const input = document.querySelector(`[data-entry-id="${entryId}"]`);
        input.value = '';
        updateImageData(entryId, '');
    }

    // Register extension settings
    function registerSettings() {
        // Add to SillyTavern settings if the API is available
        if (typeof registerExtensionSettings === 'function') {
            registerExtensionSettings(MODULE_NAME, {
                enabled: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable World Info Images extension'
                },
                includeInPrompt: {
                    type: 'boolean',
                    default: true,
                    description: 'Include image URLs in prompts sent to AI'
                },
                imagePosition: {
                    type: 'select',
                    options: ['before', 'after'],
                    default: 'after',
                    description: 'Position of image in relation to World Info content'
                }
            });
        }
    }

    // Hook into SillyTavern's World Info processing
    function hookWorldInfoProcessing() {
        // This would require deeper integration with SillyTavern's core
        // For now, we'll use a simple approach that modifies the content
        if (extensionSettings.includeInPrompt) {
            // Monitor for chat generation and inject image URLs
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                const result = originalFetch.apply(this, args);
                
                // If this is a chat completion request, modify the world info
                if (args[0] && args[0].includes && (args[0].includes('/generate') || args[0].includes('/chat'))) {
                    result.then(response => {
                        // This is a simplified approach - in a real implementation,
                        // you'd need to hook into SillyTavern's World Info processing
                        injectImagesIntoWorldInfo();
                    });
                }
                
                return result;
            };
        }
    }

    // Inject images into World Info content
    function injectImagesIntoWorldInfo() {
        // This function would modify the World Info content to include image URLs
        // Implementation depends on SillyTavern's internal API
        console.log('[World Info Images] Injecting images into World Info content');
        
        // For each stored image, we would modify the corresponding World Info entry
        Object.keys(imageData).forEach(entryId => {
            const imageUrl = imageData[entryId];
            if (imageUrl) {
                // Find the world info entry and modify its content
                // This is a placeholder - actual implementation would depend on SillyTavern's API
                console.log(`[World Info Images] Entry ${entryId} has image: ${imageUrl}`);
            }
        });
    }

    // Export functions for button onclick handlers
    window.worldInfoImagesExt = {
        testImage: testImage,
        clearImage: clearImage
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for SillyTavern extension system
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            init: init,
            name: MODULE_NAME,
            version: '1.0.0',
            description: 'Adds image URL support to World Info entries'
        };
    }

})();
