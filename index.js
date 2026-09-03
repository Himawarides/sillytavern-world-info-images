import { eventSource, event_types } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { loadWorldInfo, saveWorldInfo, setWIOriginalDataValue } from '../../../world-info.js';

const MODULE_NAME = 'st_worldinfo_images';
const IMAGES_KEY = 'images';
const FILES_KEY = 'attached_files';

function initSettings() {
    extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {
        enabled: true,
        detail_level: 'high',
    };
}

let activeImagesForTurn = [];
let activeFilesForTurn = [];

/**
 * Lee archivo de imagen a Base64 sin compresión destructiva
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
 * Lee archivo de texto plano (.txt, .md, .json, .csv, etc.)
 */
function fileToText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

/**
 * Extrae texto de un archivo PDF en el navegador
 */
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    
    // Si SillyTavern o el entorno tiene pdfjsLib cargado
    if (window.pdfjsLib) {
        try {
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => item.str).join(' ');
                fullText += `--- Página ${i} ---\n${pageText}\n\n`;
            }
            return fullText.trim();
        } catch (e) {
            console.warn('[WI Attachments] Error al parsear PDF con pdfjs:', e);
        }
    }

    // Extractor nativo ligero de respaldo para flujos de texto PDF
    const textDecoder = new TextDecoder('utf-8');
    const rawString = textDecoder.decode(new Uint8Array(arrayBuffer));
    const textMatches = [];
    const regex = /\((.*?)\)\s*T[jJ]/g;
    let match;
    while ((match = regex.exec(rawString)) !== null) {
        textMatches.push(match[1]);
    }

    if (textMatches.length > 0) {
        return textMatches.join(' ').replace(/\\([()\\])/g, '$1');
    }

    return `[Documento PDF: ${file.name} - Adjuntado para contexto]`;
}

function getEntryImages(entry) {
    if (!entry.extensions) return [];
    if (Array.isArray(entry.extensions[IMAGES_KEY])) {
        return entry.extensions[IMAGES_KEY];
    }
    if (typeof entry.extensions.image_url === 'string' && entry.extensions.image_url.trim()) {
        return [entry.extensions.image_url.trim()];
    }
    return [];
}

function getEntryFiles(entry) {
    if (!entry.extensions || !Array.isArray(entry.extensions[FILES_KEY])) {
        return [];
    }
    return entry.extensions[FILES_KEY];
}

function showImageModal(src) {
    const overlay = $(`
        <div class="wi-image-modal-overlay">
            <img class="wi-image-modal-img" src="${src}" alt="Full Quality Preview">
        </div>
    `);
    overlay.on('click', function () {
        overlay.fadeOut(150, function () { overlay.remove(); });
    });
    $('body').append(overlay);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'fa-file-pdf';
    if (['json', 'js', 'html', 'css'].includes(ext)) return 'fa-file-code';
    if (['csv', 'tsv'].includes(ext)) return 'fa-file-csv';
    return 'fa-file-lines';
}

function injectAttachmentsUIIntoEntry(entryElement) {
    const $entry = $(entryElement);
    const uid = $entry.closest('.world_entry').data('uid');
    
    if ($entry.find('.wi-attachments-container').length > 0 || uid === undefined) {
        return;
    }

    const currentWorld = $('#world_editor_select option:selected').text();
    if (!currentWorld) return;

    loadWorldInfo(currentWorld).then(data => {
        if (!data || !data.entries || !data.entries[uid]) return;

        const entry = data.entries[uid];
        let images = getEntryImages(entry);
        let files = getEntryFiles(entry);

        const containerHtml = `
            <div class="wi-attachments-container">
                <!-- SECCIÓN IMÁGENES -->
                <div class="wi-att-section">
                    <div class="wi-att-header">
                        <div class="wi-att-header-left">
                            <i class="fa-solid fa-images"></i> <span>Imágenes Vision AI</span>
                            <span class="wi-quality-badge" title="Enviadas en modo High Detail"><i class="fa-solid fa-sparkles"></i> High Detail</span>
                        </div>
                        <span class="wi-badge wi-img-badge">${images.length} imagen(es)</span>
                    </div>
                    <div class="wi-att-controls">
                        <input type="text" class="text_pole wi-image-url-input" placeholder="Pegar URL de imagen...">
                        <button class="menu_button wi-image-add-url-btn fa-solid fa-plus" title="Añadir URL"></button>
                        <label class="menu_button fa-solid fa-upload wi-image-upload-btn" title="Subir imágenes">
                            <input type="file" accept="image/*" multiple style="display: none;" class="wi-image-file-input">
                        </label>
                    </div>
                    <div class="wi-image-gallery"></div>
                </div>

                <!-- SECCIÓN ARCHIVOS / PDF / TXT -->
                <div class="wi-att-section" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                    <div class="wi-att-header">
                        <div class="wi-att-header-left">
                            <i class="fa-solid fa-paperclip"></i> <span>Archivos y Documentos (.pdf, .txt, .md, .json)</span>
                        </div>
                        <span class="wi-badge wi-file-badge">${files.length} archivo(s)</span>
                    </div>
                    <div class="wi-att-controls">
                        <label class="menu_button fa-solid fa-file-arrow-up wi-file-upload-btn" style="width: 100%;" title="Subir archivos de texto o PDF">
                            &nbsp;<span>Adjuntar Archivo (.pdf, .txt, .md, .json, .csv)</span>
                            <input type="file" accept=".pdf,.txt,.md,.markdown,.json,.csv,.text" multiple style="display: none;" class="wi-doc-file-input">
                        </label>
                    </div>
                    <div class="wi-file-list"></div>
                </div>
            </div>
        `;

        const $container = $(containerHtml);
        const $urlInput = $container.find('.wi-image-url-input');
        const $addUrlBtn = $container.find('.wi-image-add-url-btn');
        const $imgFileInput = $container.find('.wi-image-file-input');
        const $docFileInput = $container.find('.wi-doc-file-input');
        const $gallery = $container.find('.wi-image-gallery');
        const $fileList = $container.find('.wi-file-list');
        const $imgBadge = $container.find('.wi-img-badge');
        const $fileBadge = $container.find('.wi-file-badge');

        const renderGallery = () => {
            $gallery.empty();
            $imgBadge.text(`${images.length} imagen(es)`);

            images.forEach((imgSrc, index) => {
                const card = $(`
                    <div class="wi-image-card" title="Toca para ver en tamaño completo">
                        <img src="${imgSrc}" alt="WI Image ${index + 1}" />
                        <button class="wi-image-delete-btn fa-solid fa-xmark" title="Eliminar" data-index="${index}"></button>
                    </div>
                `);

                card.on('click', function (e) {
                    if ($(e.target).hasClass('wi-image-delete-btn')) return;
                    showImageModal(imgSrc);
                });

                card.find('.wi-image-delete-btn').on('click', async function (e) {
                    e.stopPropagation();
                    images.splice(index, 1);
                    await saveChanges();
                });

                $gallery.append(card);
            });
        };

        const renderFileList = () => {
            $fileList.empty();
            $fileBadge.text(`${files.length} archivo(s)`);

            files.forEach((fileObj, index) => {
                const iconClass = getFileIcon(fileObj.name);
                const item = $(`
                    <div class="wi-file-item">
                        <div class="wi-file-info" title="${fileObj.name}">
                            <i class="fa-solid ${iconClass}"></i>
                            <span class="wi-file-name">${fileObj.name}</span>
                            <span class="wi-file-size">(${formatBytes(fileObj.size || 0)})</span>
                        </div>
                        <button class="wi-file-delete-btn fa-solid fa-trash" title="Eliminar archivo" data-index="${index}"></button>
                    </div>
                `);

                item.find('.wi-file-delete-btn').on('click', async function (e) {
                    e.preventDefault();
                    files.splice(index, 1);
                    await saveChanges();
                });

                $fileList.append(item);
            });
        };

        const saveChanges = async () => {
            if (!entry.extensions) entry.extensions = {};
            entry.extensions[IMAGES_KEY] = images;
            entry.extensions[FILES_KEY] = files;
            delete entry.extensions.image_url;

            setWIOriginalDataValue(data, uid, `extensions.${IMAGES_KEY}`, images);
            setWIOriginalDataValue(data, uid, `extensions.${FILES_KEY}`, files);
            await saveWorldInfo(currentWorld, data);
            renderGallery();
            renderFileList();
        };

        // Acciones de imágenes
        const handleAddUrl = async () => {
            const url = $urlInput.val().trim();
            if (url) {
                images.push(url);
                $urlInput.val('');
                await saveChanges();
            }
        };

        $addUrlBtn.on('click', (e) => { e.preventDefault(); handleAddUrl(); });
        $urlInput.on('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } });

        $imgFileInput.on('change', async function (e) {
            const uploaded = Array.from(e.target.files || []);
            for (const file of uploaded) {
                const base64 = await fileToBase64(file);
                images.push(base64);
            }
            await saveChanges();
            e.target.value = '';
        });

        // Acciones de documentos (.pdf, .txt, .md, .json, .csv)
        $docFileInput.on('change', async function (e) {
            const uploaded = Array.from(e.target.files || []);
            for (const file of uploaded) {
                try {
                    let content = '';
                    if (file.name.toLowerCase().endsWith('.pdf')) {
                        content = await extractTextFromPDF(file);
                    } else {
                        content = await fileToText(file);
                    }

                    files.push({
                        name: file.name,
                        size: file.size,
                        content: content,
                    });
                } catch (err) {
                    console.error('[WI Attachments] Error al leer archivo:', err);
                }
            }
            await saveChanges();
            e.target.value = '';
        });

        renderGallery();
        renderFileList();
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
                        injectAttachmentsUIIntoEntry($node.hasClass('world_entry_edit') ? $node : $node.find('.world_entry_edit'));
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
 * 1. Capturar entradas activadas de World Info (imágenes y archivos)
 */
eventSource.on(event_types.WORLD_INFO_ACTIVATED, (activatedEntries) => {
    activeImagesForTurn = [];
    activeFilesForTurn = [];
    if (!extension_settings[MODULE_NAME]?.enabled) return;

    if (Array.isArray(activatedEntries)) {
        for (const entry of activatedEntries) {
            // Recoger imágenes
            const imgs = getEntryImages(entry);
            for (const imgUrl of imgs) {
                activeImagesForTurn.push({
                    uid: entry.uid,
                    url: imgUrl,
                });
            }

            // Recoger archivos de texto / PDF
            const attachedFiles = getEntryFiles(entry);
            for (const fileObj of attachedFiles) {
                activeFilesForTurn.push({
                    uid: entry.uid,
                    name: fileObj.name,
                    content: fileObj.content,
                });
            }
        }
    }
});

/**
 * 2. Inyectar imágenes (Vision) y contenido de archivos (Documentos) en el prompt
 */
eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (data) => {
    if (!extension_settings[MODULE_NAME]?.enabled) {
        return;
    }

    if (!data || !Array.isArray(data.chat)) {
        return;
    }

    const detailLevel = extension_settings[MODULE_NAME]?.detail_level || 'high';

    // A) Si hay documentos adjuntos activados, insertarlos en el contexto
    if (activeFilesForTurn.length > 0) {
        const fileContextBlocks = activeFilesForTurn.map(f => `[Documento adjunto: "${f.name}"]\n${f.content}`).join('\n\n');
        
        // Inyectar en el primer mensaje de sistema o al inicio de la conversación
        const sysMsg = data.chat.find(m => m.role === 'system');
        if (sysMsg) {
            if (typeof sysMsg.content === 'string') {
                sysMsg.content += `\n\n### Documentos de referencia adjuntos:\n${fileContextBlocks}`;
            }
        } else {
            data.chat.unshift({
                role: 'system',
                content: `### Documentos de referencia adjuntos:\n${fileContextBlocks}`,
            });
        }
    }

    // B) Si hay imágenes activadas, inyectarlas en el último mensaje de usuario en modo Vision
    if (activeImagesForTurn.length > 0) {
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
                                detail: detailLevel,
                            },
                        });
                    }
                }
                break;
            }
        }
    }
});

jQuery(async () => {
    initSettings();
    setupMutationObserver();

    eventSource.on(event_types.WORLDINFO_UPDATED, () => {
        setupMutationObserver();
    });

    console.log('[WI Attachments] Extensión de Imágenes y Documentos cargada con éxito.');
});
