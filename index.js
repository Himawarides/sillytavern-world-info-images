import { eventSource, event_types } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { loadWorldInfo, saveWorldInfo, setWIOriginalDataValue } from '../../../world-info.js';

const MODULE_NAME = 'st_worldinfo_images';
const EXTENSION_KEY = 'images'; // Almacena un array de strings (URLs o Data URLs en base64)

function initSettings() {
    extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {
        enabled: true,
    };
}

let activeImagesForTurn = [];

/**
 * Convierte un archivo a base64 Data URL
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * Normaliza las imágenes de una entrada (por compatibilidad con versiones previas)
 */
function getEntryImages(entry) {
    if (!entry.extensions) return [];
    
    // Si ya existe el array 'images'
    if (Array.isArray(entry.extensions[EXTENSION_KEY])) {
        return entry.extensions[EXTENSION_KEY];
    }
    
    // Compatibilidad si venía de 'image_url' como string individual
    if (typeof entry.extensions.image_url === 'string' && entry.extensions.image_url.trim()) {
        return [entry.extensions.image_url.trim()];
    }

    return [];
}

/**
 * Inyecta la interfaz de múltiples imágenes en la entrada de World Info
 */
function injectImageUIIntoEntry(entryElement) {
    const $entry = $(entryElement);
    const uid = $entry.closest('.world_entry').data('uid');
    
    // Evitar duplicar controles si ya se inyectó
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
                    <span><i class="fa-solid fa-images"></i> Imágenes Multimodales (Vision AI)</span>
                    <span class="wi-image-count-badge">${images.length} imagen(es)</span>
                </div>
                <div class="wi-image-controls">
                    <input type="text" class="text_pole wi-image-url-input" placeholder="Pegar URL de imagen y presionar Enter...">
                    <button class="menu_button wi-image-add-url-btn fa-solid fa-plus" title="Añadir URL"></button>
                    <label class="menu_button fa-solid fa-upload wi-image-upload-btn" title="Subir imágenes (puedes elegir varias)">
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

        // Función para renderizar las miniaturas
        const renderGallery = () => {
            $gallery.empty();
            $badge.text(`${images.length} imagen(es)`);

            images.forEach((imgSrc, index) => {
                const card = $(`
                    <div class="wi-image-card">
                        <img src="${imgSrc}" alt="WI Image ${index + 1}" />
                        <button class="wi-image-delete-btn fa-solid fa-xmark" title="Eliminar imagen" data-index="${index}"></button>
                    </div>
                `);

                card.find('.wi-image-delete-btn').on('click', async function (e) {
                    e.preventDefault();
                    images.splice(index, 1);
                    await saveChanges();
                });

                $gallery.append(card);
            });
        };

        // Guardar cambios en el Lorebook
        const saveChanges = async () => {
            if (!entry.extensions) entry.extensions = {};
            entry.extensions[EXTENSION_KEY] = images;
            
            // Eliminar clave antigua si existía
            delete entry.extensions.image_url;

            setWIOriginalDataValue(data, uid, `extensions.${EXTENSION_KEY}`, images);
            await saveWorldInfo(currentWorld, data);
            renderGallery();
        };

        // Añadir por URL
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

        // Añadir por archivo local (soporta múltiples a la vez)
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

        // Insertar después del campo de contenido
        const contentField = $entry.find('textarea[name="content"]').closest('div');
        if (contentField.length) {
            contentField.after($container);
        } else {
            $entry.append($container);
        }
    });
}

/**
 * Observador para detectar cuándo se abre el drawer de edición
 */
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

/**
 * 1. Escuchar activación de entradas de World Info
 */
eventSource.on(event_types.WORLD_INFO_ACTIVATED, (activatedEntries) => {
    activeImagesForTurn = [];
    if (!extension_settings[MODULE_NAME]?.enabled) return;

    if (Array.isArray(activatedEntries)) {
        for (const entry of activatedEntries) {
            const imgs = getEntryImages(entry);
            if (imgs.length > 0) {
                console.log(`[WI Images] Entrada UID ${entry.uid} activó ${imgs.length} imagen(es)`);
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

/**
 * 2. Inyectar todas las imágenes activadas en el prompt multimodal
 */
eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (data) => {
    if (!extension_settings[MODULE_NAME]?.enabled || activeImagesForTurn.length === 0) {
        return;
    }

    if (!data || !Array.isArray(data.chat)) {
        return;
    }

    console.log(`[WI Images] Inyectando ${activeImagesForTurn.length} imagen(es) totales de World Info en el prompt multimodal`);

    // Inyectar en el último mensaje de usuario
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
                        },
                    });
                }
            }
            break;
        }
    }
});

// Inicialización
jQuery(async () => {
    initSettings();
    setupMutationObserver();

    eventSource.on(event_types.WORLDINFO_UPDATED, () => {
        setupMutationObserver();
    });

    console.log('[WI Images] Extensión de Múltiples Imágenes para World Info cargada con éxito.');
});
