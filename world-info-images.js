/**
 * World Info Image Extension for SillyTavern
 * Allows attaching images to world info entries
 * Author: Assistant
 * Version: 1.1.0
 */

(function() {
    'use strict';

    const extensionName = 'world-info-images';
    const extensionDisplayName = 'World Info Images';
    let extensionSettings = {};
    let imageStorage = new Map();
    let isInjected = false;

    // Default settings
    const defaultSettings = {
        maxImageSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        imageQuality: 0.8,
        maxImageWidth: 400,
        maxImageHeight: 300
    };

    // CSS styles
    const extensionCSS = `
        .wi-image-section {
            margin-top: 10px;
            padding: 10px;
            border: 1px solid #444;
            border-radius: 5px;
            background-color: rgba(0,0,0,0.2);
        }
        
        .wi-image-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .wi-image-title {
            font-weight: bold;
            color: #fff;
            font-size: 14px;
        }
        
        .wi-upload-btn {
            background: #4a4a4a;
            color: #fff;
            border: 1px solid #666;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .wi-upload-btn:hover {
            background: #555;
        }
        
        .wi-hidden-input {
            display: none;
        }
        
        .wi-image-gallery {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
        }
        
        .wi-image-item {
            position: relative;
            display: inline-block;
        }
        
        .wi-image-thumb {
            width: 80px;
            height: 80px;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid #666;
            cursor: pointer;
        }
        
        .wi-image-thumb:hover {
            opacity: 0.8;
        }
        
        .wi-image-delete {
            position: absolute;
            top: -5px;
            right: -5px;
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .wi-image-delete:hover {
            background: #ff6666;
        }
        
        .wi-modal {
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
        }
        
        .wi-modal-content {
            margin: auto;
            display: block;
            max-width: 90%;
            max-height: 90%;
            margin-top: 5%;
        }
        
        .wi-modal-close {
            position: absolute;
            top: 20px;
            right: 35px;
            color: #fff;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .wi-modal-close:hover {
            color: #ccc;
        }
        
        .wi-no-images {
            color: #888;
            font-style: italic;
            font-size: 12px;
        }
    `;

    // Utility functions
    function log(message) {
        console.log(`[${extensionName}] ${message}`);
    }

    function resizeImage(file, maxWidth, maxHeight, quality) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                let { width, height } = img;
                
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
        return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function getEntryId(entryElement) {
        // Try to find a unique identifier for the world info entry
        const uidInput = entryElement.querySelector('input[name="uid"]');
        if (uidInput) return uidInput.value;
        
        const keyInput = entryElement.querySelector('input[name="key"]');
        if (keyInput) return keyInput.value;
        
        // Fallback to position in DOM
        const entries = document.querySelectorAll('.world_entry');
        return Array.from(entries).indexOf(entryElement).toString();
    }

    function createImageSection(entryElement) {
        const entryId = getEntryId(entryElement);
        
        const section = document.createElement('div');
        section.className = 'wi-image-section';
        section.setAttribute('data-entry-id', entryId);
        
        const header = document.createElement('div');
        header.className = 'wi-image-header';
        
        const title = document.createElement('div');
        title.className = 'wi-image-title';
        title.textContent = 'Images';
        
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'wi-upload-btn';
        uploadBtn.textContent = 'Upload Image';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.className = 'wi-hidden-input';
        fileInput.accept = extensionSettings.allowedTypes.join(',');
        
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => handleImageUpload(e, entryId, section));
        
        header.appendChild(title);
        header.appendChild(uploadBtn);
        
        const gallery = document.createElement('div');
        gallery.className = 'wi-image-gallery';
        
        section.appendChild(header);
        section.appendChild(fileInput);
        section.appendChild(gallery);
        
        updateImageGallery(entryId, gallery);
        
        return section;
    }

    async function handleImageUpload(event, entryId, section) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        if (!extensionSettings.allowedTypes.includes(file.type)) {
            if (typeof toastr !== 'undefined') {
                toastr.error('Invalid file type. Please upload an image.');
            } else {
                alert('Invalid file type. Please upload an image.');
            }
            return;
        }
        
        if (file.size > extensionSettings.maxImageSize) {
            if (typeof toastr !== 'undefined') {
                toastr.error('File too large. Maximum size is 5MB.');
            } else {
                alert('File too large. Maximum size is 5MB.');
            }
            return;
        }
        
        try {
            const resizedFile = await resizeImage(
                file,
                extensionSettings.maxImageWidth,
                extensionSettings.maxImageHeight,
                extensionSettings.imageQuality
            );
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = {
                    id: generateImageId(),
                    data: e.target.result,
                    filename: file.name,
                    type: file.type,
                    timestamp: Date.now()
                };
                
                if (!imageStorage.has(entryId)) {
                    imageStorage.set(entryId, []);
                }
                imageStorage.get(entryId).push(imageData);
                
                const gallery = section.querySelector('.wi-image-gallery');
                updateImageGallery(entryId, gallery);
                
                if (typeof toastr !== 'undefined') {
                    toastr.success('Image uploaded successfully!');
                }
            };
            
            reader.readAsDataURL(resizedFile);
        } catch (error) {
            log('Error processing image: ' + error);
            if (typeof toastr !== 'undefined') {
                toastr.error('Error processing image.');
            }
        }
        
        event.target.value = '';
    }

    function updateImageGallery(entryId, gallery) {
        const images = imageStorage.get(entryId) || [];
        gallery.innerHTML = '';
        
        if (images.length === 0) {
            const noImages = document.createElement('div');
            noImages.className = 'wi-no-images';
            noImages.textContent = 'No images uploaded';
            gallery.appendChild(noImages);
            return;
        }
        
        images.forEach((imageData, index) => {
            const item = document.createElement('div');
            item.className = 'wi-image-item';
            
            const img = document.createElement('img');
            img.src = imageData.data;
            img.className = 'wi-image-thumb';
            img.title = imageData.filename;
            img.addEventListener('click', () => showImageModal(imageData.data));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'wi-image-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete image';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                images.splice(index, 1);
                if (images.length === 0) {
                    imageStorage.delete(entryId);
                }
                updateImageGallery(entryId, gallery);
            });
            
            item.appendChild(img);
            item.appendChild(deleteBtn);
            gallery.appendChild(item);
        });
    }

    function showImageModal(imageSrc) {
        const modal = document.getElementById('wi-image-modal');
        if (!modal) return;
        
        const modalImg = modal.querySelector('.wi-modal-content');
        modalImg.src = imageSrc;
        modal.style.display = 'block';
    }

    function createImageModal() {
        if (document.getElementById('wi-image-modal')) return;
        
        const modal = document.createElement('div');
        modal.id = 'wi-image-modal';
        modal.className = 'wi-modal';
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'wi-modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        const img = document.createElement('img');
        img.className = 'wi-modal-content';
        
        modal.appendChild(closeBtn);
        modal.appendChild(img);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        document.body.appendChild(modal);
    }

    function injectImageSections() {
        const entries = document.querySelectorAll('.world_entry');
        
        entries.forEach(entry => {
            // Skip if already has image section
            if (entry.querySelector('.wi-image-section')) return;
            
            // Try to find the best insertion point
            let insertPoint = null;
            
            // Look for common world info elements
            const content = entry.querySelector('.world_entry_form_content, .world_entry_content, textarea');
            if (content) {
                insertPoint = content.parentElement;
            }
            
            // Fallback to the entry itself
            if (!insertPoint) {
                insertPoint = entry;
            }
            
            const imageSection = createImageSection(entry);
            insertPoint.appendChild(imageSection);
        });
    }

    function observeForWorldInfo() {
        const observer = new MutationObserver((mutations) => {
            let shouldInject = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            if (node.classList?.contains('world_entry') || 
                                node.querySelector?.('.world_entry')) {
                                shouldInject = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldInject) {
                setTimeout(injectImageSections, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        return observer;
    }

    function loadSettings() {
        const saved = localStorage.getItem(`${extensionName}_settings`);
        if (saved) {
            extensionSettings = { ...defaultSettings, ...JSON.parse(saved) };
        } else {
            extensionSettings = { ...defaultSettings };
        }
    }

    function saveSettings() {
        localStorage.setItem(`${extensionName}_settings`, JSON.stringify(extensionSettings));
    }

    function getSettings() {
        return extensionSettings;
    }

    function init() {
        if (isInjected) return;
        
        log('Initializing extension...');
        
        loadSettings();
        
        // Add CSS
        const style = document.createElement('style');
        style.textContent = extensionCSS;
        document.head.appendChild(style);
        
        // Create modal
        createImageModal();
        
        // Start observing
        observeForWorldInfo();
        
        // Initial injection
        setTimeout(() => {
            injectImageSections();
        }, 2000);
        
        isInjected = true;
        log('Extension initialized successfully');
    }

    // SillyTavern extension registration
    const manifest = {
        name: extensionDisplayName,
        version: '1.1.0',
        description: 'Attach images to world info entries',
        author: 'Assistant',
        init: init,
        getSettings: getSettings
    };

    // Try different registration methods
    if (typeof jQuery !== 'undefined') {
        jQuery(document).ready(function() {
            if (typeof window.registerExtension === 'function') {
                window.registerExtension(extensionName, manifest);
            } else {
                init();
            }
        });
    } else if (typeof window.registerExtension === 'function') {
        window.registerExtension(extensionName, manifest);
    } else {
        // Fallback
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    // Global access for debugging
    window.worldInfoImages = {
        init: init,
        inject: injectImageSections,
        storage: imageStorage,
        settings: extensionSettings
    };

    log('Extension loaded');
})();
