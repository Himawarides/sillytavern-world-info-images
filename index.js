import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { loadWorldInfo, saveWorldInfo, setWIOriginalDataValue } from '../../../world-info.js';

const MODULE_NAME = 'st_worldinfo_images';
const EXTENSION_KEY = 'image_url';

// Inicializar configuración por defecto
function initSettings() {
    extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {
        enabled: true,
        inject_mode: 'last_user_message', // 'last_user_message' o 'system'
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
 * Inyecta el campo de imagen en la plantilla del editor de entradas de World Info
 */
function injectImageUIIntoEntry(entryElement) {
    const $entry = $(entryElement);
    const uid = $entry.closest('.world_entry').data('uid');
    
    // Evitar duplicados
    if ($entry.find('.wi-image-container').length > 0 || uid === undefined) {
        return;
    }

    const currentWorld = $('#world_editor_select option:selected').text();
    if (!currentWorld) return;

    // Obtener los datos actuales de la entrada
    loadWorldInfo(currentWorld).then(data => {
        if (!data || !data.entries || !data.entries[uid]) return;

        const entry = data.entries[uid];
        const currentImageUrl = entry.extensions?.[EXTENSION_KEY] || '';

        const containerHtml = `
            <div class="wi-image-container">
                <div class="wi-image-header">
                    <i class="fa-solid fa-image"></i> Multimodal Entry Image (Vision AI)
                </div>
                <div class="wi-image-controls">
                    <input type="text" class="text_pole wi-image-url" placeholder="https://example.com/image.png o sube un archivo" value="${currentImageUrl}">
                    <label class="menu_button fa-solid fa-upload wi-image-upload-btn" title="Subir imagen local">
                        <input type="file" accept="image/*" style="display: none;" class="wi-image-file-input">
                    </label>
                    <button class="menu_button wi-image-clear-btn fa-solid fa-trash" title="Eliminar imagen"></button>
                </div>
                <div class="wi-image-preview-wrapper">
                    <img class="wi-image-preview ${currentImageUrl ? '' : 'hidden'}" src="${currentImageUrl || ''}" alt="Preview" />
                </div>
            </div>
        `;

        const $container = $(containerHtml);
        const $urlInput = $container.find('.wi-image-url');
        const $fileInput = $container.find('.wi-image-file-input');
        const $preview = $container.find('.wi-image-preview');
        const $clearBtn = $container.find('.wi-image-clear-btn');

        // Guardar valor
        const updateImage = async (url) => {
            if (!entry.extensions) entry.extensions = {};
            entry.extensions[EXTENSION_KEY] = url;
            
            setWIOriginalDataValue(data, uid, `extensions.${EXTENSION_KEY}`, url);
            await saveWorldInfo(currentWorld, data);

            if (url) {
                $preview.attr('src', url).removeClass('hidden');
            } else {
                $preview.attr('src', '').addClass('hidden');
            }
            $urlInput.val(url);
        };

        $urlInput.on('change input', function () {
            updateImage($(this).val().trim());
        });

        $fileInput.on('change', async function (e) {
            const file = e.target.files[0];
            if (file) {
                const base64 = await fileToBase64(file);
                await updateImage(base64);
            }
            e.target.value = '';
        });

        $clearBtn.on('click', async function (e) {
            e.preventDefault();
            await updateImage('');
        });

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
 * Observador para detectar cuándo se abre el drawer de edición de una entrada
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
            const img = entry.extensions?.[EXTENSION_KEY];
            if (img && typeof img === 'string' && img.trim().length > 0) {
                console.log(`[WI Images] Imagen activada para entrada UID ${entry.uid}:`, img.substring(0, 50) + '...');
                activeImagesForTurn.push({
                    uid: entry.uid,
                    comment: entry.comment || 'World Info',
                    url: img,
                });
            }
        }
    }
});

/**
 * 2. Inyectar imágenes en la llamada a la API Multimodal antes de enviar
 */
eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (data) => {
    if (!extension_settings[MODULE_NAME]?.enabled || activeImagesForTurn.length === 0) {
        return;
    }

    if (!data || !Array.isArray(data.chat)) {
        return;
    }

    console.log(`[WI Images] Inyectando ${activeImagesForTurn.length} imagen(es) de World Info en el prompt multimodal`);

    // Buscar el último mensaje de usuario en el chat completion prompt
    for (let i = data.chat.length - 1; i >= 0; i--) {
        const msg = data.chat[i];
        if (msg.role === 'user') {
            // Si el contenido es un string simple, convertirlo a formato de bloques de contenido multimodal
            if (typeof msg.content === 'string') {
                msg.content = [
                    { type: 'text', text: msg.content }
                ];
            }

            // Si ya es un array de bloques, anexar las imágenes
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

// Inicialización de la extensión
jQuery(async () => {
    initSettings();
    setupMutationObserver();

    // Re-vincular observador si se recarga la lista de World Info
    eventSource.on(event_types.WORLDINFO_UPDATED, () => {
        setupMutationObserver();
    });

    console.log('[WI Images] Extensión de Imágenes para World Info cargada con éxito.');
});