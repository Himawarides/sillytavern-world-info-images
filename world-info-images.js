// World Info Images Extension for SillyTavern
// Version: 1.1.0
// Adds image URL support to World Info entries

(function() {
    'use strict';

    const MODULE_NAME = 'world-info-images';
    const extensionName = 'World Info Images';
    const extensionFolderPath = 'third-party/world-info-images';
    
    let extensionSettings = {
        enabled: true,
        includeInPrompt: true,
        imagePosition: 'after'
    };

    let imageData = {};

    // Initialize extension
    async function init() {
        console.log(`[${MODULE_NAME}] Initializing extension...`);
        
        // Load settings
        await loadSettings();
        
        // Add CSS
        addCustomCSS();
        
        // Wait for SillyTavern to be ready
        await waitForSillyTavern();
        
        // Register extension
        registerExtension();
        
        // Start monitoring
        startMonitoring();
        
        console.log(`[${MODULE_NAME}] Extension initialized successfully`);
    }

    // Wait for SillyTavern to be ready
    function waitForSillyTavern() {
        return new Promise((resolve) => {
            const checkReady = () => {
                if (window.SillyTavern || document.querySelector('#world_info_popup')) {
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }

    // Load settings from extension storage
    async function loadSettings() {
        try {
            if (typeof loadExtensionSettings === 'function') {
                extensionSettings = await loadExtensionSettings(MODULE_NAME, extensionSettings);
            } else {
                // Fallback to localStorage
                const saved = localStorage.getItem(`${MODULE_NAME}_settings`);
                if (saved) {
                    extensionSettings = { ...extensionSettings, ...JSON.parse(saved) };
                }
            }
            
            // Load image data
            const savedImageData = localStorage.getItem(`${MODULE_NAME}_imageData`);
            if (savedImageData) {
                imageData = JSON.parse(savedImageData);
            }
        } catch (error) {
            console.error(`[${MODULE_NAME}] Error loading settings:`, error);
        }
    }

    // Save settings
    function saveSettings() {
        try {
            if (typeof saveExtensionSettings === 'function') {
                saveExtensionSettings(MODULE_NAME, extensionSettings);
            } else {
                localStorage.setItem(`${MODULE_NAME}_settings`, JSON.stringify(extensionSettings));
            }
            
            localStorage.setItem(`${MODULE_NAME}_imageData`, JSON.stringify(imageData));
        } catch (error) {
            console.error(`[${MODULE_NAME}] Error saving settings:`, error);
        }
    }

    // Register extension with SillyTavern
    function registerExtension() {
        try {
            if (typeof registerExtension === 'function') {
                registerExtension(MODULE_NAME, init, null, null);
            }
        } catch (error) {
            console.warn(`[${MODULE_NAME}] Could not register with SillyTavern extension system:`, error);
        }
    }

    // Add custom CSS
    function addCustomCSS() {
        const style = document.createElement('style');
        style.id = `${MODULE_NAME}-styles`;
        style.textContent = `
            .worldinfo-image-section {
                margin: 10px 0;
                padding: 10px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
            }
            
            .worldinfo-image-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
                font-size: 13px;
                font-weight: 600;
                color: #fff;
            }
            
            .worldinfo-image-icon {
                margin-right: 6px;
                font-size: 14px;
            }
            
            .worldinfo-image-input {
                width: 100%;
                padding: 8px 12px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                color: #fff;
                font-size: 13px;
                margin-bottom: 10px;
                transition: border-color 0.2s;
            }
            
            .worldinfo-image-input:focus {
                outline: none;
                border-color: #007bff;
            }
            
            .worldinfo-image-input::placeholder {
                color: rgba(255, 255, 255, 0.5);
            }
            
            .worldinfo-image-preview {
                max-width: 100%;
                max-height: 150px;
                border-radius: 4px;
                display: block;
                margin: 0 auto 10px auto;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            
            .worldinfo-image-error {
                color: #ff6b6b;
                font-size: 12px;
                margin-top: 5px;
                padding: 5px;
                background: rgba(255, 107, 107, 0.1);
                border-radius: 4px;
            }
            
            .worldinfo-image-controls {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            
            .worldinfo-image-btn {
                padding: 6px 12px;
                background: rgba(0, 123, 255, 0.8);
                border: none;
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
            }
            
            .worldinfo-image-btn:hover {
                background: rgba(0, 123, 255, 1);
            }
            
            .worldinfo-image-btn.secondary {
                background: rgba(108, 117, 125, 0.8);
            }
            
            .worldinfo-image-btn.secondary:hover {
                background: rgba(108, 117, 125, 1);
            }
            
            .worldinfo-image-status {
                font-size: 11px;
                color: #28a745;
                margin-top: 5px;
            }
        `;
        document.head.appendChild(style);
    }

    // Start monitoring for World Info changes
    function startMonitoring() {
        // Monitor for World Info popup and entries
        const observer = new MutationObserver((mutations) => {
            if (!extensionSettings.enabled) return;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            // Check for world info entries
                            const entries = node.querySelectorAll ? node.querySelectorAll('.world_entry') : [];
                            entries.forEach(processWorldEntry);
                            
                            // Check if the node itself is a world entry
                            if (node.classList && node.classList.contains('world_entry')) {
                                processWorldEntry(node);
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also check existing entries periodically
        setInterval(checkExistingEntries, 1000);
    }

    // Check existing entries
    function checkExistingEntries() {
        if (!extensionSettings.enabled) return;
        
        const entries = document.querySelectorAll('.world_entry');
        entries.forEach(processWorldEntry);
    }

    // Process a world entry
    function processWorldEntry(entry) {
        // Skip if already processed
        if (entry.querySelector('.worldinfo-image-section')) return;
        
        // Find the content textarea
        const contentTextarea = entry.querySelector('textarea[placeholder*="What this keyword should mean"]');
        if (!contentTextarea) return;
        
        // Get entry identifier
        const entryId = getEntryIdentifier(entry);
        
        // Create image section
        const imageSection = createImageSection(entryId);
        
        // Insert after the content textarea
        contentTextarea.parentNode.insertBefore(imageSection, contentTextarea.nextSibling);
        
        console.log(`[${MODULE_NAME}] Added image section to entry: ${entryId}`);
    }

    // Get unique entry identifier
    function getEntryIdentifier(entry) {
        // Try to get UID from the entry
        const uidElement = entry.querySelector('[data-uid]');
        if (uidElement) {
            return uidElement.getAttribute('data-uid');
        }
        
        // Try to get from title/memo input
        const titleInput = entry.querySelector('input[placeholder*="Title"], input[placeholder*="Memo"]');
        if (titleInput && titleInput.value) {
            return `title_${titleInput.value.replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
        
        // Fallback to position-based ID
        const allEntries = document.querySelectorAll('.world_entry');
        const index = Array.from(allEntries).indexOf(entry);
        return `entry_${index}`;
    }

    // Create image section
    function createImageSection(entryId) {
        const section = document.createElement('div');
        section.className = 'worldinfo-image-section';
        section.setAttribute('data-entry-id', entryId);
        
        const currentImageUrl = imageData[entryId] || '';
        
        section.innerHTML = `
            <div class="worldinfo-image-header">
                <span class="worldinfo-image-icon">🖼️</span>
                <span>Image URL</span>
            </div>
            <input type="text" 
                   class="worldinfo-image-input" 
                   placeholder="Enter image URL (https://...)" 
                   value="${currentImageUrl}">
            <div class="worldinfo-image-preview-container">
                ${currentImageUrl ? `<img src="${currentImageUrl}" class="worldinfo-image-preview" alt="World Info Image">` : ''}
            </div>
            <div class="worldinfo-image-error" style="display: none;"></div>
            <div class="worldinfo-image-status" style="display: none;"></div>
            <div class="worldinfo-image-controls">
                <button class="worldinfo-image-btn secondary" data-action="clear">Clear</button>
                <button class="worldinfo-image-btn" data-action="test">Test & Save</button>
            </div>
        `;
        
        // Add event listeners
        setupImageSectionEvents(section, entryId);
        
        return section;
    }

    // Setup event listeners for image section
    function setupImageSectionEvents(section, entryId) {
        const input = section.querySelector('.worldinfo-image-input');
        const previewContainer = section.querySelector('.worldinfo-image-preview-container');
        const errorDiv = section.querySelector('.worldinfo-image-error');
        const statusDiv = section.querySelector('.worldinfo-image-status');
        const buttons = section.querySelectorAll('.worldinfo-image-btn');
        
        // Input events
        input.addEventListener('input', debounce(() => {
            const url = input.value.trim();
            if (url) {
                testAndSaveImage(entryId, url, previewContainer, errorDiv, statusDiv);
            } else {
                clearImageDisplay(previewContainer, errorDiv, statusDiv);
            }
        }, 500));
        
        // Button events
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                
                if (action === 'test') {
                    const url = input.value.trim();
                    if (url) {
                        testAndSaveImage(entryId, url, previewContainer, errorDiv, statusDiv);
                    } else {
                        showError(errorDiv, 'Please enter an image URL first.');
                    }
                } else if (action === 'clear') {
                    input.value = '';
                    clearImageData(entryId);
                    clearImageDisplay(previewContainer, errorDiv, statusDiv);
                }
            });
        });
    }

    // Test and save image
    function testAndSaveImage(entryId, url, previewContainer, errorDiv, statusDiv) {
        if (!isValidUrl(url)) {
            showError(errorDiv, 'Please enter a valid URL starting with http:// or https://');
            return;
        }
        
        // Clear previous states
        clearImageDisplay(previewContainer, errorDiv, statusDiv);
        
        // Show loading state
        statusDiv.textContent = 'Loading image...';
        statusDiv.style.display = 'block';
        
        // Test image
        const img = new Image();
        img.onload = () => {
            // Save image data
            imageData[entryId] = url;
            saveSettings();
            
            // Show preview
            previewContainer.innerHTML = `<img src="${url}" class="worldinfo-image-preview" alt="World Info Image">`;
            
            // Show success status
            statusDiv.textContent = 'Image loaded successfully!';
            statusDiv.style.color = '#28a745';
            
            console.log(`[${MODULE_NAME}] Image saved for entry ${entryId}: ${url}`);
        };
        
        img.onerror = () => {
            showError(errorDiv, 'Failed to load image. Please check the URL and try again.');
            statusDiv.style.display = 'none';
        };
        
        img.src = url;
    }

    // Clear image data
    function clearImageData(entryId) {
        delete imageData[entryId];
        saveSettings();
    }

    // Clear image display
    function clearImageDisplay(previewContainer, errorDiv, statusDiv) {
        previewContainer.innerHTML = '';
        errorDiv.style.display = 'none';
        statusDiv.style.display = 'none';
    }

    // Show error
    function showError(errorDiv, message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    // Validate URL
    function isValidUrl(url) {
        try {
            new URL(url);
            return url.startsWith('http://') || url.startsWith('https://');
        } catch {
            return false;
        }
    }

    // Debounce function
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

    // Hook into World Info processing for AI integration
    function hookWorldInfoProcessing() {
        if (!extensionSettings.includeInPrompt) return;
        
        // This would need to integrate with SillyTavern's world info processing
        // For now, we'll add a simple approach
        console.log(`[${MODULE_NAME}] World Info processing hook would be implemented here`);
    }

    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for SillyTavern extension system
    window[MODULE_NAME] = {
        init,
        extensionSettings,
        imageData,
        name: extensionName,
        version: '1.1.0'
    };

})();
