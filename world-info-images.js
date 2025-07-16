/**
 * World Info Image Extension for SillyTavern
 * Allows attaching images to world info entries
 * Author: Assistant
 * Version: 1.0.0
 */

(() => {
    'use strict';

    const extensionName = 'world-info-images';
    const extensionDisplayName = 'World Info Images';
    let extensionSettings = {};
    let imageStorage = new Map(); // Store images in memory

    // Default settings
    const defaultSettings = {
        maxImageSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        imageQuality: 0.8,
        maxImageWidth: 800,
        maxImageHeight: 600
    };

    // CSS styles for the extension
    const extensionCSS = `
        .wi-image-container {
            margin: 10px 0;
            border: 1px solid var(--SmartThemeBodyColor);
            border-radius: 5px;
            padding: 10px;
            background: var(--black70a);
        }
        
        .wi-image-upload {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        
        .wi-image-upload input[type="file"] {
            flex: 1;
        }
        
        .wi-image-preview {
            max-width: 200px;
            max-height: 200px;
            border-radius: 5px;
            cursor: pointer;
            border: 1px solid var(--SmartThemeBodyColor);
        }
        
        .wi-image-preview:hover {
            opacity: 0.8;
        }
        
        .wi-image-controls {
            display: flex;
            gap: 5px;
            margin-top: 5px;
        }
        
        .wi-image-btn {
            padding: 5px 10px;
            border: 1px solid var(--SmartThemeBodyColor);
            background: var(--black50a);
            color: var(--SmartThemeBodyColor);
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .wi-image-btn:hover {
            background: var(--black70a);
        }
        
        .wi-image-modal {
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
            cursor: pointer;
        }
        
        .wi-image-modal img {
            margin: auto;
            display: block;
            max-width: 90%;
            max-height: 90%;
            margin-top: 5%;
        }
        
        .wi-image-close {
            position: absolute;
            top: 15px;
            right: 35px;
            color: #f1f1f1;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .wi-image-close:hover {
            color: #bbb;
        }
    `;

    // Utility functions
    function resizeImage(file, maxWidth, maxHeight, quality) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                let { width, height } = img;
                
                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, file.type, quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    function generateImageId() {
        return 'wi_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function createImageContainer(wiEntry) {
        const container = document.createElement('div');
        container.className = 'wi-image-container';
        
        // File input
        const uploadDiv = document.createElement('div');
        uploadDiv.className = 'wi-image-upload';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = extensionSettings.allowedTypes.join(',');
        fileInput.addEventListener('change', (e) => handleImageUpload(e, wiEntry));
        
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'wi-image-btn';
        uploadBtn.textContent = 'Upload Image';
        uploadBtn.addEventListener('click', () => fileInput.click());
        
        uploadDiv.appendChild(fileInput);
        uploadDiv.appendChild(uploadBtn);
        
        // Image display area
        const imageDisplay = document.createElement('div');
        imageDisplay.className = 'wi-image-display';
        
        container.appendChild(uploadDiv);
        container.appendChild(imageDisplay);
        
        // Load existing images
        loadImagesForEntry(wiEntry, imageDisplay);
        
        return container;
    }

    async function handleImageUpload(event, wiEntry) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!extensionSettings.allowedTypes.includes(file.type)) {
            toastr.error('Invalid file type. Please upload a valid image.');
            return;
        }
        
        // Validate file size
        if (file.size > extensionSettings.maxImageSize) {
            toastr.error('File too large. Maximum size is 5MB.');
            return;
        }
        
        try {
            // Resize image
            const resizedFile = await resizeImage(
                file,
                extensionSettings.maxImageWidth,
                extensionSettings.maxImageHeight,
                extensionSettings.imageQuality
            );
            
            // Convert to base64
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageId = generateImageId();
                const imageData = {
                    id: imageId,
                    data: e.target.result,
                    filename: file.name,
                    type: file.type
                };
                
                // Store image
                const entryKey = getEntryKey(wiEntry);
                if (!imageStorage.has(entryKey)) {
                    imageStorage.set(entryKey, []);
                }
                imageStorage.get(entryKey).push(imageData);
                
                // Refresh display
                const imageDisplay = event.target.closest('.wi-image-container').querySelector('.wi-image-display');
                loadImagesForEntry(wiEntry, imageDisplay);
                
                toastr.success('Image uploaded successfully!');
            };
            
            reader.readAsDataURL(resizedFile);
        } catch (error) {
            console.error('Error processing image:', error);
            toastr.error('Error processing image.');
        }
        
        // Clear file input
        event.target.value = '';
    }

    function getEntryKey(wiEntry) {
        // Create a unique key for the world info entry
        const uid = wiEntry.uid || wiEntry.id || '';
        const key = wiEntry.key || wiEntry.keys?.[0] || '';
        return `${uid}_${key}`;
    }

    function loadImagesForEntry(wiEntry, container) {
        const entryKey = getEntryKey(wiEntry);
        const images = imageStorage.get(entryKey) || [];
        
        container.innerHTML = '';
        
        images.forEach((imageData, index) => {
            const imageWrapper = document.createElement('div');
            imageWrapper.style.marginBottom = '10px';
            
            const img = document.createElement('img');
            img.src = imageData.data;
            img.className = 'wi-image-preview';
            img.title = imageData.filename;
            img.addEventListener('click', () => showImageModal(imageData.data));
            
            const controls = document.createElement('div');
            controls.className = 'wi-image-controls';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'wi-image-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                images.splice(index, 1);
                if (images.length === 0) {
                    imageStorage.delete(entryKey);
                }
                loadImagesForEntry(wiEntry, container);
            });
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'wi-image-btn';
            downloadBtn.textContent = 'Download';
            downloadBtn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.href = imageData.data;
                link.download = imageData.filename;
                link.click();
            });
            
            controls.appendChild(deleteBtn);
            controls.appendChild(downloadBtn);
            
            imageWrapper.appendChild(img);
            imageWrapper.appendChild(controls);
            container.appendChild(imageWrapper);
        });
    }

    function showImageModal(imageSrc) {
        const modal = document.getElementById('wi-image-modal');
        const modalImg = modal.querySelector('img');
        modalImg.src = imageSrc;
        modal.style.display = 'block';
    }

    function createImageModal() {
        const modal = document.createElement('div');
        modal.id = 'wi-image-modal';
        modal.className = 'wi-image-modal';
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'wi-image-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        const img = document.createElement('img');
        
        modal.appendChild(closeBtn);
        modal.appendChild(img);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        document.body.appendChild(modal);
    }

    function injectImageContainers() {
        // Find all world info entries
        const wiEntries = document.querySelectorAll('.world_entry');
        
        wiEntries.forEach(entryElement => {
            // Skip if already has image container
            if (entryElement.querySelector('.wi-image-container')) {
                return;
            }
            
            // Get the world info entry data
            const entryIndex = Array.from(entryElement.parentElement.children).indexOf(entryElement);
            const wiEntry = world_info?.entries?.[entryIndex];
            
            if (!wiEntry) return;
            
            // Create and inject image container
            const imageContainer = createImageContainer(wiEntry);
            
            // Find the best place to insert (after the content textarea)
            const contentTextarea = entryElement.querySelector('.world_entry_form textarea');
            if (contentTextarea) {
                const parent = contentTextarea.parentElement;
                parent.insertBefore(imageContainer, contentTextarea.nextSibling);
            }
        });
    }

    // Settings panel
    function createSettingsPanel() {
        const panel = document.createElement('div');
        panel.innerHTML = `
            <h3>World Info Images Settings</h3>
            <div class="range-block">
                <label>Max Image Size (MB):</label>
                <input type="number" id="wi-max-size" min="1" max="10" value="${extensionSettings.maxImageSize / (1024 * 1024)}" step="0.5">
            </div>
            <div class="range-block">
                <label>Max Image Width:</label>
                <input type="number" id="wi-max-width" min="100" max="2000" value="${extensionSettings.maxImageWidth}" step="50">
            </div>
            <div class="range-block">
                <label>Max Image Height:</label>
                <input type="number" id="wi-max-height" min="100" max="2000" value="${extensionSettings.maxImageHeight}" step="50">
            </div>
            <div class="range-block">
                <label>Image Quality (0.1-1.0):</label>
                <input type="number" id="wi-quality" min="0.1" max="1.0" value="${extensionSettings.imageQuality}" step="0.1">
            </div>
        `;
        
        // Add event listeners for settings
        panel.querySelector('#wi-max-size').addEventListener('change', (e) => {
            extensionSettings.maxImageSize = parseFloat(e.target.value) * 1024 * 1024;
            saveSettings();
        });
        
        panel.querySelector('#wi-max-width').addEventListener('change', (e) => {
            extensionSettings.maxImageWidth = parseInt(e.target.value);
            saveSettings();
        });
        
        panel.querySelector('#wi-max-height').addEventListener('change', (e) => {
            extensionSettings.maxImageHeight = parseInt(e.target.value);
            saveSettings();
        });
        
        panel.querySelector('#wi-quality').addEventListener('change', (e) => {
            extensionSettings.imageQuality = parseFloat(e.target.value);
            saveSettings();
        });
        
        return panel;
    }

    function loadSettings() {
        const saved = localStorage.getItem(`${extensionName}_settings`);
        if (saved) {
            extensionSettings = Object.assign({}, defaultSettings, JSON.parse(saved));
        } else {
            extensionSettings = Object.assign({}, defaultSettings);
        }
    }

    function saveSettings() {
        localStorage.setItem(`${extensionName}_settings`, JSON.stringify(extensionSettings));
    }

    // Initialize extension
    function init() {
        // Load settings
        loadSettings();
        
        // Add CSS
        const style = document.createElement('style');
        style.textContent = extensionCSS;
        document.head.appendChild(style);
        
        // Create image modal
        createImageModal();
        
        // Inject containers when world info panel is opened
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if world info entries were added
                    const addedNodes = Array.from(mutation.addedNodes);
                    if (addedNodes.some(node => node.classList?.contains('world_entry'))) {
                        setTimeout(injectImageContainers, 100);
                    }
                }
            });
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Initial injection
        setTimeout(injectImageContainers, 1000);
        
        console.log('World Info Images extension loaded');
    }

    // Extension registration
    if (typeof window.registerExtension === 'function') {
        window.registerExtension(extensionName, extensionDisplayName, init, createSettingsPanel);
    } else {
        // Fallback initialization
        document.addEventListener('DOMContentLoaded', init);
    }
})();