import { eventSource, event_types } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { loadWorldInfo, saveWorldInfo, setWIOriginalDataValue } from '../../../world-info.js';

const MODULE_NAME = 'st_worldinfo_images';
const EXTENSION_KEY = 'image_url';

function initSettings() {
    extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {
        enabled: true,
    };
}

let activeImagesForTurn = [];

/**
 * Comprime y convierte una imagen a Base64 para ahorrar memoria en móvil
 */
function compressAndConvertImage(file, maxWidth = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Exportar como JPEG optimizado o WebP si es compatible
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
            img.src = event.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

/**
 * Inyecta la UI limpia en la entrada de World Info
 */
function injectImageUIIntoEntry(entryElement) {
    const $editContainer = $(entryElement).closest('.world_entry_edit');
    const $entryWrapper = $(entryElement).closest('.world_entry');
    const uid = $entryWrapper.data('uid') ?? $entryWrapper.attr('uid');

    if (uid === undefined || $editContainer.find('.wi-image-container').length > 0) {
        return;
    }

    const currentWorld = $('#world_editor_select option:selected').text();
    if (!currentWorld) return;

    loadWorldInfo(currentWorld).then((data) => {
        if (!data || !data.entries || !data.entries[uid]) return;

        // Doble verificación anti-duplicado tras la carga asíncrona
        if ($editContainer.find('.wi-image-container').length > 0) return;

        const entry = data.entries[uid];
        const currentImageUrl = entry.extensions?.[EXTENSION_KEY] || '';

        const containerHtml = `
            <div class="wi-image-container" data-uid="${uid}">
                <div class="wi-image-header">
                    <i class="fa-solid fa-image"></i> Multimodal Image (Vision AI)
                </div>
                <div class="wi-image-controls">
                    <input type="text" class="text_pole wi-image-url" placeholder="URL o sube imagen..." value="${currentImageUrl}">
                    <label class="menu_button wi-image-btn fa-solid fa-upload wi-image-upload-btn" title="Subir desde el dispositivo">
                        <input type="file" accept="image/*" style="display: none;" class="wi-image-file-input">
                    </label>
                    <button type="button" class="menu_button wi-image-btn wi-image-clear-btn fa-solid fa-trash" title="Quitar imagen"></button>
                </div>
                <div class="wi-image-preview-wrapper ${currentImageUrl ? '' : 'hidden'}">
                    <img class="wi-image-preview" src="${currentImageUrl || ''}" alt="Preview" />
                </div>
            </div>
        `;

        const $container = $(containerHtml);
        const $urlInput = $container.find('.wi-image-url');
        const $fileInput = $container.find('.wi-image-file-input');
        const $previewWrapper = $container.find('.wi-image-preview-wrapper');
        const $preview = $container.find('.wi-image-preview');
        const $clearBtn = $container.find('.wi-image-clear-btn');

        const updateImage = async (url) => {
            if (!entry.extensions) entry.extensions = {};
            entry.extensions[EXTENSION_KEY] = url;

            setWIOriginalDataValue(data, uid, `extensions.${EXTENSION_KEY}`, url);
            await saveWorldInfo(currentWorld, data);

            if (url) {
                $preview.attr('src', url);
                $previewWrapper.removeClass('hidden');
            } else {
                $preview.attr('src', '');
                $previewWrapper.addClass('hidden');
            }
            $urlInput.val(url);
        };

        $urlInput.on('change', function () {
            updateImage($(this).val().trim());
        });

        $fileInput.on('change', async function (e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    toastr.info('Procesando imagen...', '', { timeOut: 1500 });
                    const compressedBase64 = await compressAndConvertImage(file);
                    await updateImage(compressedBase64);
                    toastr.success('Imagen cargada');
                } catch (err) {
                    console.error('[WI Image Error]', err);
                    toastr.error('Error al cargar la imagen');
                }
            }
            e.target.value = '';
        });

        $clearBtn.on('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            await updateImage('');
        });

        // Insertar al final del formulario de la entrada para ocupar ancho completo
        $editContainer.append($container);
    });
}

/**
 * Escucha la apertura de drawers para inyectar la UI
 */
function setupDrawerListener() {
    $(document).off('click.wi_images', '.world_entry .inline-drawer-header, .world_entry .inline-drawer-icon');
    $(document).on('click.wi_images', '.world_entry .inline-drawer-header, .world_entry .inline-drawer-icon', function () {
        const $entry = $(this).closest('.world_entry');
        setTimeout(() => {
            const $edit = $entry.find('.world_entry_edit');
            if ($edit.length) {
                injectImageUIIntoEntry($edit);
            }
        }, 80);
    });
}

// 1. Capturar imágenes de las entradas activadas
eventSource.on(event_types.WORLD_INFO_ACTIVATED, (activatedEntries) => {
    activeImagesForTurn = [];
    if (!extension_settings[MODULE_NAME]?.enabled) return;

    if (Array.isArray(activatedEntries)) {
        for (const entry of activatedEntries) {
            const img = entry.extensions?.[EXTENSION_KEY];
            if (img && typeof img === 'string' && img.trim().length > 0) {
                activeImagesForTurn.push({
                    uid: entry.uid,
                    url: img,
                });
            }
        }
    }
});

// 2. Inyectar imágenes al mensaje de usuario enviado al LLM Vision
eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (data) => {
    if (!extension_settings[MODULE_NAME]?.enabled || activeImagesForTurn.length === 0) {
        return;
    }

    if (!data || !Array.isArray(data.chat)) {
        return;
    }

    for (let i = data.chat.length - 1; i >= 0; i--) {
        const msg = data.chat[i];
        if (msg.role === 'user') {
            if (typeof msg.content === 'string') {
                msg.content = [{ type: 'text', text: msg.content }];
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

jQuery(() => {
    initSettings();
    setupDrawerListener();

    eventSource.on(event_types.WORLDINFO_UPDATED, () => {
        setupDrawerListener();
    });
});
