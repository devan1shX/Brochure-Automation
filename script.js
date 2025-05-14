// script.js (Your client-side JavaScript)
document.addEventListener('DOMContentLoaded', () => {
    // ... (all your existing code before the downloadPdfButton listener) ...
    const csvFileInput = document.getElementById('csvFileInput');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const recordIndicator = document.getElementById('recordIndicator');
    const downloadPdfButton = document.getElementById('downloadPdfButton');

    const trlNumDisplay = document.getElementById('trlNumDisplay');
    const techTitleDisplay = document.getElementById('techTitleDisplay');
    const innovatorsDisplay = document.getElementById('innovatorsDisplay');
    const docketDisplay = document.getElementById('docketDisplay'); // Keep this if still displayed elsewhere
    const patentStatusDisplay = document.getElementById('patentStatusDisplay');
    const descriptionDisplay = document.getElementById('descriptionDisplay');

    const featuresUl = document.querySelector('.features .list-content ul');
    const advantagesUl = document.querySelector('.advantages .list-content ul');
    const useCasesUl = document.querySelector('.use-cases .list-content ul');
    const techSpecsUl = document.querySelector('.Theme .technological-specs .list-content ul');
    const domainUl = document.querySelector('.Theme .domain .list-content ul');
    const themeListUl = document.querySelector('.Theme .theme .list-content ul');

    const a4Sheet = document.querySelector('.a4-sheet');
    const mainContentElement = document.querySelector('.main-content');
    const boldTooltip = document.getElementById('bold-tooltip');
    const makeBoldButton = document.getElementById('makeBoldButton');

    const featuresImagesContainer = document.getElementById('featuresImagesContainer');
    const endOfDocumentImagesContainer = document.getElementById('endOfDocumentImagesContainer');

    const qrLinkInput = document.getElementById('qrLinkInput');
    const generateQrButton = document.getElementById('generateQrButton');
    const qrCodeContainer = document.getElementById('qrCodeContainer');

    const imageUploadInput = document.getElementById('imageUploadInput');

    let csvData = [];
    let currentRecordIndex = -1;
    let uploadedImagesPerRow = {}; // Stores DataURLs for uploaded images, keyed by record index
    let removedCsvImageUrlsForRow = {}; // Stores original CSV image URLs that were removed, keyed by record index

    // This list should match the headers in the CSV file you are loading.
    const NEW_CSV_HEADERS = [
        "Title", "Theme", "Domain", "PatentStatus", "TRLLevel", "Innovators",
        "DetailedDescription", "Advantages", "Applications", "UseCases",
        "RelatedLinks", "TechnicalSpecifications", "Images"
    ];

    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = [];
            let currentVal = '';
            let inQuotes = false;
            for (let char of lines[i]) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentVal.trim());
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim());

            if (values.length === headers.length) {
                const entry = {};
                headers.forEach((header, index) => {
                    let value = values[index];
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1).replace(/""/g, '"');
                    }
                    entry[header] = value;
                });
                data.push(entry);
            } else {
                console.warn(`Skipping line ${i + 1} due to mismatch in expected columns (${headers.length}) vs actual (${values.length}): ${lines[i]}`);
            }
        }
        return data;
    }

    function createEditableListItem(ulElement, itemText, isPlaceholder = false) {
        const li = document.createElement('li');
        const editableSpan = document.createElement('span');
        editableSpan.setAttribute('contenteditable', 'true');
        editableSpan.textContent = itemText;
        li.appendChild(editableSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-list-item-btn';
        deleteBtn.innerHTML = '&#x1F5D1;'; // Unicode for trash can icon
        deleteBtn.setAttribute('aria-label', 'Delete item');
        deleteBtn.title = 'Delete item';
        li.appendChild(deleteBtn);

        ulElement.appendChild(li);
        if (isPlaceholder) {
            li.classList.add('placeholder-item');
        }
        return li;
    }

    function populateList(ulElement, dataString) {
        if (!ulElement) {
            console.warn("populateList called with undefined ulElement for data:", dataString);
            return;
        }
        ulElement.innerHTML = '';
        const defaultTextForItem = ulElement.dataset.defaultText || "New item - edit here";

        const items = (dataString && dataString.trim() !== "" && dataString.toUpperCase() !== "N/A") ?
                        dataString.split(';').map(item => item.trim()).filter(item => item) :
                        [];

        if (items.length > 0) {
            items.forEach(itemText => createEditableListItem(ulElement, itemText));
        } else {
            createEditableListItem(ulElement, defaultTextForItem, true);
        }
    }

    function createImageElementWrapper(imageUrl, isCsvImage) {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-item-wrapper';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = "Technology Image";
        img.onerror = function() {
            console.error("Error loading image:", imageUrl);
            // this.style.display = 'none'; // Or show a placeholder in the wrapper
            this.alt = `Failed to load: ${imageUrl.substring(0,50)}...`;
            // The wrapper's background will act as a placeholder
        };

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.innerHTML = '&times;'; // 'x' symbol
        removeBtn.title = 'Remove Image';
        removeBtn.onclick = (event) => {
            event.stopPropagation(); // Prevent triggering other listeners if any
            handleRemoveImage(imageUrl, isCsvImage);
        };

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        return wrapper;
    }

    function handleRemoveImage(imageUrl, isCsvImage) {
        if (currentRecordIndex < 0 || currentRecordIndex >= csvData.length) return;

        if (isCsvImage) {
            if (!removedCsvImageUrlsForRow[currentRecordIndex]) {
                removedCsvImageUrlsForRow[currentRecordIndex] = [];
            }
            if (!removedCsvImageUrlsForRow[currentRecordIndex].includes(imageUrl)) {
                removedCsvImageUrlsForRow[currentRecordIndex].push(imageUrl);
            }
        } else { // It's an uploaded image
            if (uploadedImagesPerRow[currentRecordIndex]) {
                uploadedImagesPerRow[currentRecordIndex] = uploadedImagesPerRow[currentRecordIndex].filter(url => url !== imageUrl);
            }
        }
        // Re-render the current record to reflect changes including image layout
        displayRecord(currentRecordIndex);
    }


    function displayRecord(index) {
        // Clear dynamic content areas
        if (featuresImagesContainer) featuresImagesContainer.innerHTML = '';
        if (endOfDocumentImagesContainer) endOfDocumentImagesContainer.innerHTML = '';
        if (qrCodeContainer) qrCodeContainer.innerHTML = ''; // Also clear QR if it's specific per record

        if (csvData.length === 0 || index < 0 || index >= csvData.length) {
            trlNumDisplay.textContent = 'N/A';
            techTitleDisplay.textContent = 'Technology Title';
            innovatorsDisplay.textContent = 'N/A';
            docketDisplay.textContent = 'N/A';
            patentStatusDisplay.textContent = 'N/A';
            descriptionDisplay.textContent = 'N/A';

            if(featuresUl) populateList(featuresUl, null);
            if(advantagesUl) populateList(advantagesUl, null);
            if(useCasesUl) populateList(useCasesUl, null);
            if(techSpecsUl) populateList(techSpecsUl, null);
            if(domainUl) populateList(domainUl, null);
            if(themeListUl) populateList(themeListUl, null);

            if (recordIndicator) recordIndicator.textContent = (csvData.length === 0 && currentRecordIndex === -1) ? "No data loaded" : "No record to display";
            if (prevButton) prevButton.disabled = true;
            if (nextButton) nextButton.disabled = true;
            if (downloadPdfButton) downloadPdfButton.disabled = true;
            currentRecordIndex = -1; // Ensure currentRecordIndex is also reset
            return;
        }
        const record = csvData[index];

        trlNumDisplay.textContent = record.TRLLevel || 'N/A';
        techTitleDisplay.textContent = record.Title || 'Technology Title';
        innovatorsDisplay.textContent = record.Innovators ? record.Innovators.split(';').map(s => s.trim()).join(', ') : 'N/A';

        docketDisplay.textContent = record.Docket || 'N/A';
        patentStatusDisplay.textContent = record.PatentStatus || 'N/A';
        descriptionDisplay.textContent = record.DetailedDescription || 'N/A';

        if(featuresUl) populateList(featuresUl, record.Advantages);
        if(advantagesUl) populateList(advantagesUl, record.Applications);
        if(useCasesUl) populateList(useCasesUl, record.UseCases);
        if(techSpecsUl) populateList(techSpecsUl, record.TechnicalSpecifications);
        if(domainUl) populateList(domainUl, record.Domain);
        if(themeListUl) populateList(themeListUl, record.Theme);

        // Process CSV images
        const csvImageUrlsFromRecord = (record.Images || '')
            .split(',')
            .map(url => url.trim())
            .filter(url => url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('./') || url.startsWith('/')));

        const urlsToRemoveForThisRecord = removedCsvImageUrlsForRow[index] || [];
        const filteredCsvImages = csvImageUrlsFromRecord
            .filter(url => !urlsToRemoveForThisRecord.includes(url))
            .map(url => ({ url: url, isCsv: true }));

        // Process uploaded images
        const uploadedImageObjects = (uploadedImagesPerRow[index] || [])
            .map(url => ({ url: url, isCsv: false }));

        const combinedImageObjects = [...filteredCsvImages, ...uploadedImageObjects];

        if (combinedImageObjects.length > 0) {
            if (combinedImageObjects.length < 4) {
                if(featuresImagesContainer) {
                    combinedImageObjects.forEach(imgObj => {
                        featuresImagesContainer.appendChild(createImageElementWrapper(imgObj.url, imgObj.isCsv));
                    });
                }
            } else {
                if(endOfDocumentImagesContainer) {
                    combinedImageObjects.forEach(imgObj => {
                        endOfDocumentImagesContainer.appendChild(createImageElementWrapper(imgObj.url, imgObj.isCsv));
                    });
                }
            }
        }

        if (recordIndicator) recordIndicator.textContent = `Record ${index + 1} of ${csvData.length}`;
        currentRecordIndex = index;

        if (prevButton) prevButton.disabled = index === 0;
        if (nextButton) nextButton.disabled = index === csvData.length - 1;
        if (downloadPdfButton) downloadPdfButton.disabled = false;
    }

    csvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    csvData = parseCSV(e.target.result);
                    uploadedImagesPerRow = {}; // Reset uploaded images
                    removedCsvImageUrlsForRow = {}; // Reset removed CSV image tracking
                    if (csvData.length > 0) {
                        currentRecordIndex = 0;
                        displayRecord(currentRecordIndex);
                    } else {
                        csvData = []; // Ensure it's an empty array
                        currentRecordIndex = -1;
                        displayRecord(-1); // Update UI to reflect no data
                        alert("No valid data found in CSV or CSV is empty.");
                    }
                } catch (error) {
                    console.error("Error parsing CSV:", error);
                    if (recordIndicator) recordIndicator.textContent = "Error parsing CSV file.";
                    alert("Could not parse CSV file. Please check the format. Ensure text fields with commas are enclosed in double quotes.");
                    csvData = [];
                    currentRecordIndex = -1;
                    displayRecord(-1);
                }
            };
            reader.readAsText(file);
        }
    });

    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', async (event) => {
            if (currentRecordIndex < 0 || currentRecordIndex >= csvData.length) {
                alert("Please load a CSV and select a record before uploading images.");
                event.target.value = '';
                return;
            }
            const files = Array.from(event.target.files);
            if (!files.length) return;

            // Replace previous uploads for this record with new ones
            uploadedImagesPerRow[currentRecordIndex] = [];
            const fileReadPromises = files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (err) => reject(err);
                    reader.readAsDataURL(file);
                });
            });
            try {
                const dataUrls = await Promise.all(fileReadPromises);
                uploadedImagesPerRow[currentRecordIndex] = dataUrls;
                displayRecord(currentRecordIndex); // Refresh to show new images
            } catch (error) {
                console.error("Error reading uploaded images:", error);
                alert("There was an error processing uploaded images.");
            }
            event.target.value = ''; // Reset file input
        });
    }

    if (mainContentElement) {
        mainContentElement.addEventListener('click', function(event) {
            const target = event.target;
            if (target.classList.contains('add-list-item-btn')) {
                event.preventDefault();
                const targetUlSelector = target.dataset.listTargetSelector;
                const ulElement = mainContentElement.querySelector(targetUlSelector);
                if (ulElement) {
                    const defaultTextForNewItem = ulElement.dataset.defaultText || "New item - edit here";
                    let textForNewItem = "Edit this item..."; // Default if not replacing placeholder

                    // Check if the list is empty or only contains a placeholder
                    if (ulElement.children.length === 0 ||
                        (ulElement.children.length === 1 && ulElement.firstElementChild.classList.contains('placeholder-item'))) {
                        ulElement.innerHTML = ''; // Clear placeholder or empty list
                        textForNewItem = defaultTextForNewItem; // Use default text for the first real item
                    }
                    const newItemLi = createEditableListItem(ulElement, textForNewItem, false);
                    const spanToFocus = newItemLi.querySelector('span[contenteditable="true"]');
                    if (spanToFocus) {
                        spanToFocus.focus();
                        const range = document.createRange();
                        const sel = window.getSelection();
                        if(sel){
                            range.selectNodeContents(spanToFocus);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }
                }
            }
            else if (target.classList.contains('delete-list-item-btn') || target.closest('.delete-list-item-btn')) {
                event.preventDefault();
                const actualButton = target.classList.contains('delete-list-item-btn') ? target : target.closest('.delete-list-item-btn');
                const listItem = actualButton.closest('li');
                if (listItem) {
                    const ulElement = listItem.parentNode;
                    const defaultTextForEmptyList = ulElement.dataset.defaultText || "New item - edit here";
                    listItem.remove();
                    if (ulElement.children.length === 0) {
                        createEditableListItem(ulElement, defaultTextForEmptyList, true);
                    }
                }
            }
        });
    }

    if (prevButton) {
        prevButton.addEventListener('click', () => {
            if (currentRecordIndex > 0) {
                displayRecord(currentRecordIndex - 1);
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            if (currentRecordIndex < csvData.length - 1) {
                displayRecord(currentRecordIndex + 1);
            }
        });
    }

    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            if (csvData.length === 0 || currentRecordIndex < 0 || currentRecordIndex >= csvData.length) {
                alert("Please load data from a CSV file and ensure a record is selected.");
                return;
            }
            const element = document.querySelector('.a4-sheet');
            const controlsContainer = document.querySelector('.controls-container');

            if (!element) {
                alert("Error: The printable element '.a4-sheet' was not found.");
                return;
            }
            if (controlsContainer) controlsContainer.style.display = 'none';
            if (boldTooltip) boldTooltip.style.display = 'none';

            // Hide remove buttons before printing
            const removeImageButtons = element.querySelectorAll('.remove-image-btn');
            removeImageButtons.forEach(btn => btn.style.display = 'none');

            element.scrollLeft = 0;
            element.scrollTop = 0;

            const elementScrollHeightPx = element.scrollHeight;
            const elementOffsetWidthPx = element.offsetWidth;
            const pxToMmFactor = 25.4 / 96.0;
            const pdfPageHeightMm = elementScrollHeightPx * pxToMmFactor;
            const pdfPageWidthMm = 210;

            const currentRecord = csvData[currentRecordIndex];

            // MODIFICATION START: Use Title for filename
            const titleValue = currentRecord.Title || 'Untitled_Technology'; // Use Title, fallback if empty
            // MODIFICATION END

            const sanitizeForFilename = (name) => String(name).replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\s+/g, '_');

            // MODIFICATION START: Sanitize titleValue for filename
            const sanitizedIdentifier = sanitizeForFilename(titleValue);
            // MODIFICATION END

            const newFilename = `${sanitizedIdentifier}.pdf`;

            const opt = {
                margin: 0,
                filename: newFilename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    width: elementOffsetWidthPx,
                    height: elementScrollHeightPx,
                    scrollX: 0,
                    scrollY: 0,
                    onclone: (doc) => {
                        const editables = doc.querySelectorAll('[contenteditable="true"]');
                        editables.forEach(el => {
                            el.style.outline = 'none';
                            el.style.backgroundColor = '';
                        });
                        const addBtns = doc.querySelectorAll('.add-list-item-btn');
                        addBtns.forEach(btn => btn.style.display = 'none');
                        const delBtns = doc.querySelectorAll('.delete-list-item-btn');
                        delBtns.forEach(btn => btn.style.display = 'none');
                        const removeImgBtns = doc.querySelectorAll('.remove-image-btn'); // ensure they are hidden in clone too
                        removeImgBtns.forEach(btn => btn.style.display = 'none');

                    }
                },
                jsPDF: {
                    unit: 'mm',
                    format: [pdfPageWidthMm, pdfPageHeightMm],
                    orientation: 'portrait'
                }
            };

            if (typeof html2pdf === 'function') {
                html2pdf().from(element).set(opt).save().then(() => {
                    if (controlsContainer) controlsContainer.style.display = 'flex';
                     removeImageButtons.forEach(btn => btn.style.display = ''); // Show buttons again
                }).catch(err => {
                    console.error("Error generating PDF:", err);
                    if (controlsContainer) controlsContainer.style.display = 'flex';
                    removeImageButtons.forEach(btn => btn.style.display = ''); // Show buttons again
                    alert("Error generating PDF: " + err.message);
                });
            } else {
                alert("PDF generation library (html2pdf) not loaded. Please check your HTML file for the script include.");
                if (controlsContainer) controlsContainer.style.display = 'flex';
                removeImageButtons.forEach(btn => btn.style.display = ''); // Show buttons again
            }
        });
    }


    if (a4Sheet && boldTooltip && makeBoldButton) {
        a4Sheet.addEventListener('mouseup', (e) => {
            if (e.target === boldTooltip || boldTooltip.contains(e.target) ||
                (makeBoldButton && e.target === makeBoldButton) ) {
                return;
            }
            const selection = window.getSelection();
            if (selection && selection.toString().trim() !== '') {
                let container = selection.anchorNode;
                let isEditableInSheet = false;
                if (container) {
                    if (container.nodeType !== Node.ELEMENT_NODE) {
                        container = container.parentNode;
                    }
                    if (container) {
                        while (container && container !== document.body) {
                            if (container.isContentEditable && a4Sheet.contains(container)) {
                                isEditableInSheet = true;
                                break;
                            }
                            container = container.parentNode;
                        }
                    }
                }
                if (isEditableInSheet) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    let top = rect.top + window.scrollY - boldTooltip.offsetHeight - 5;
                    let left = rect.left + window.scrollX + (rect.width / 2) - (boldTooltip.offsetWidth / 2);

                    if (top < window.scrollY) top = rect.bottom + window.scrollY + 5;
                    if (left < window.scrollX) left = window.scrollX + 5;
                    if (left + boldTooltip.offsetWidth > window.innerWidth + window.scrollX) {
                        left = window.innerWidth + window.scrollX - boldTooltip.offsetWidth - 5;
                    }

                    boldTooltip.style.left = `${left}px`;
                    boldTooltip.style.top = `${top}px`;
                    boldTooltip.style.display = 'flex';
                } else {
                    boldTooltip.style.display = 'none';
                }
            } else {
                boldTooltip.style.display = 'none';
            }
        });

        makeBoldButton.addEventListener('click', () => {
            document.execCommand('bold', false, null);
            const selection = window.getSelection();
            if (selection) selection.removeAllRanges();
            boldTooltip.style.display = 'none';
        });

        document.addEventListener('mousedown', (e) => {
            if (boldTooltip && boldTooltip.style.display === 'flex') {
                 if (!boldTooltip.contains(e.target) && e.target !== makeBoldButton) {
                    let currentSelection = window.getSelection();
                     if (!currentSelection || currentSelection.isCollapsed || currentSelection.toString().trim() === '') {
                         boldTooltip.style.display = 'none';
                    }
                 }
            }
        });
         document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (boldTooltip && boldTooltip.style.display === 'flex' && (!selection || selection.isCollapsed || selection.toString().trim() === '')) {
                boldTooltip.style.display = 'none';
            }
        });
    }

    displayRecord(-1); // Initial call to set up the UI correctly (e.g. disabled buttons)

    if (generateQrButton && qrLinkInput && qrCodeContainer) {
        generateQrButton.addEventListener('click', () => {
            const linkText = qrLinkInput.value.trim();
            if (linkText === "") {
                alert("Please enter a website link to generate a QR code.");
                qrLinkInput.focus();
                return;
            }
            // Clear previous QR code if generating a new one in the general section
            // If QR codes were record-specific, this clearing would be in displayRecord
            qrCodeContainer.innerHTML = '';

            const singleQrItemDiv = document.createElement('div');
            singleQrItemDiv.className = 'qr-code-item';
            try {
                if (typeof QRCode === 'function') {
                    new QRCode(singleQrItemDiv, {
                        text: linkText,
                        width: 120,
                        height: 120,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                    qrCodeContainer.appendChild(singleQrItemDiv);
                    qrLinkInput.value = '';
                } else {
                    alert("QR Code library not loaded. Please check your HTML file.");
                }
            } catch (error) {
                console.error("Error generating QR Code:", error);
                alert("Could not generate QR code. Please check the link or console for errors.");
            }
        });
    } else {
        console.warn("QR Code generator input, button, or container element not found. QR functionality might be disabled.");
    }
});
