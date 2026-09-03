import { eventSource, event_types } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { loadWorldInfo, saveWorldInfo, setWIOriginalDataValue } from '../../../world-info.js';

const MODULE_NAME = 'st_worldinfo_images';
const EXTENSION_KEY = 'images';

function initSettings() {
    extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {
        enabled: true,
        detail_level: 'high', // 'high' garantiza máxima fidelidad en OpenAI/Claude/Gemini/OpenRouter
    };
}

let activeImagesForTurn = [];

/**
 * Lee el archivo conservando la resolución original completa
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function getEntryImages(entry) {
    if (!entry.extensions) return [];
    if (Array.isArray(entry.extensions[EXTENSION_KEY])) {
        return entry.extensions[EXTENSION_KEY];
    }
    if (typeof entry.extensions.image_url === 'string' && entry.extensions.image_url.trim()) {
        return [entry.extensions.image_url.trim()];
    }
    return [];
}

/**
 * Muestra la imagen a tamaño completo al pulsar sobre su miniatura
 */
function showImageModal(src) {
    const overlay = $(`
        <div class="wi-image-modal-overlay">
            <img class="wi-image-modal-img" src="${src}" alt="Full Quality Preview">
        </div>
    `);

    overlay.on('click', function () {
        overlay.fadeOut(150, function () {
            overlay.remove();
        });
    });

    $('body').append(overlay);
}

function injectImageUIIntoEntry(entryElement) {
    const $entry = $(entryElement);
    const uid = $entry.closest('.world_entry').data('uid');
    
    if ($entry.find('.wi-image-container').length > 0 || uid === undefined) {
        return;
    }

    const currentWorld = $('#world_editor_select option:selected').text();
    if (!currentWorld) return;

    loadWorldInfo(currentWorld).then(data => {
        if (!data || !data.entries || !data.entries[uid]) return;

        const entry = data.entries[uid];
        let images = getEntryImages(entry);

        const containerHtml = `
            <div class="wi-image-container">
                <div class="wi-image-header">
                    <div class="wi-image-header-left">
                        <i class="fa-solid fa-images"></i> <span>Imágenes Vision AI</span>
                        <span class="wi-image-quality-badge" title="Las imágenes se envían con resolución de alta definición (High Detail)"><i class="fa-solid fa-sparkles"></i> High Detail</span>
                    </div>
                    <span class="wi-image-count-badge">${images.length} imagen(es)</span>
                </div>
                <div class="wi-image-controls">
                    <input type="text" class="text_pole wi-image-url-input" placeholder="Pegar URL de imagen...">
                    <button class="menu_button wi-image-add-url-btn fa-solid fa-plus" title="Añadir URL"></button>
                    <label class="menu_button fa-solid fa-upload wi-image-upload-btn" title="Subir imágenes en alta calidad">
                        <input type="file" accept="image/*" multiple style="display: none;" class="wi-image-file-input">
                    </label>
                </div>
                <div class="wi-image-gallery"></div>
            </div>
        `;

        const $container = $(containerHtml);
        const $urlInput = $container.find('.wi-image-url-input');
        const $addUrlBtn = $container.find('.wi-image-add-url-btn');
        const $fileInput = $container.find('.wi-image-file-input');
        const $gallery = $container.find('.wi-image-gallery');
        const $badge = $container.find('.wi-image-count-badge');

        const renderGallery = () => {
            $gallery.empty();
            $badge.text(`${images.length} imagen(es)`);

            images.forEach((imgSrc, index) => {
                const card = $(`
                    <div class="wi-image-card" title="Toca para ver en tamaño completo">
                        <img src="${imgSrc}" alt="WI Image ${index + 1}" />
                        <button class="wi-image-delete-btn fa-solid fa-xmark" title="Eliminar" data-index="${index}"></button>
                    </div>
                `);

                // Abrir visor en grande al pulsar en la imagen
                card.on('click', function (e) {
                    if ($(e.target).hasClass('wi-image-delete-btn')) return;
                    showImageModal(imgSrc);
                });

                // Eliminar miniatura
                card.find('.wi-image-delete-btn').on('click', async function (e) {
                    e.stopPropagation();
                    images.splice(index, 1);
                    await saveChanges();
                });

                $gallery.append(card);
            });
        };

        const saveChanges = async () => {
            if (!entry.extensions) entry.extensions = {};
            entry.extensions[EXTENSION_KEY] = images;
            delete entry.extensions.image_url;

            setWIOriginalDataValue(data, uid, `extensions.${EXTENSION_KEY}`, images);
            await saveWorldInfo(currentWorld, data);
            renderGallery();
        };

        const handleAddUrl = async () => {
            const url = $urlInput.val().trim();
            if (url) {
                images.push(url);
                $urlInput.val('');
                await saveChanges();
            }
        };

        $addUrlBtn.on('click', (e) => {
            e.preventDefault();
            handleAddUrl();
        });

        $urlInput.on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrl();
            }
        });

        $fileInput.on('change', async function (e) {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
                for (const file of files) {
                    const base64 = await fileToBase64(file);
                    images.push(base64);
                }
                await saveChanges();
            }
            e.target.value = '';
        });

        renderGallery();
        $entry.append($container);
    });
}

function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const $node = $(node);
                    if ($node.hasClass('world_entry_edit') || $node.find('.world_entry_edit').length) {
                        injectImageUIIntoEntry($node.hasClass('world_entry_edit') ? $node : $node.find('.world_entry_edit'));
                    }
                }
            }
        }
    });

    const targetNode = document.getElementById('world_popup_entries_list');
    if (targetNode) {
        observer.observe(targetNode, { childList: true, subtree: true });
    }
}

eventSource.on(event_types.WORLD_INFO_ACTIVATED, (activatedEntries) => {
    activeImagesForTurn = [];
    if (!extension_settings[MODULE_NAME]?.enabled) return;

    if (Array.isArray(activatedEntries)) {
        for (const entry of activatedEntries) {
            const imgs = getEntryImages(entry);
            if (imgs.length > 0) {
                for (const imgUrl of imgs) {
                    activeImagesForTurn.push({
                        uid: entry.uid,
                        comment: entry.comment || 'World Info',
                        url: imgUrl,
                    });
                }
            }
        }
    }
});

eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (data) => {
    if (!extension_settings[MODULE_NAME]?.enabled || activeImagesForTurn.length === 0) {
        return;
    }

    if (!data || !Array.isArray(data.chat)) {
        return;
    }

    const detailLevel = extension_settings[MODULE_NAME]?.detail_level || 'high';

    for (let i = data.chat.length - 1; i >= 0; i--) {
        const msg = data.chat[i];
        if (msg.role === 'user') {
            if (typeof msg.content === 'string') {
                msg.content = [
                    { type: 'text', text: msg.content }
                ];
            }

            if (Array.isArray(msg.content)) {
                for (const item of activeImagesForTurn) {
                    msg.content.push({
                        type: 'image_url',
                        image_url: {
                            url: item.url,
                            detail: detailLevel, // <--- ALTA CALIDAD FORZADA
                        },
                    });
                }
            }
            break;
        }
    }
});

jQuery(async () => {
    initSettings();
    setupMutationObserver();

    eventSource.on(event_types.WORLDINFO_UPDATED, () => {
        setupMutationObserver();
    });
});
