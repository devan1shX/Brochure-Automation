// script.js (Your client-side JavaScript)
document.addEventListener('DOMContentLoaded', () => {
    // --- Excel Preprocessing Configuration ---
    const ALL_ORIGINAL_EXCEL_HEADERS_IN_ORDER = [
        "Timestamp", "FullName", "Organization", "Email", "Title",
        "Description", "Genre", "Theme", "Domain", "PatentStatus",
        "TRLLevel", "ConceptObserved", "ProofOfConcept", "PrototypeDeveloped",
        "PrototypeTestedLab", "TestedRealWorld", "WorksAsIntended",
        "IntegratedWithSystems", "UsedByEndUsers", "SafetyAssessments",
        "ScalingPlans", "Innovators", "Overview", "DetailedDescription",
        "Advantages", "Applications", "UseCases", "RelatedLinks",
        "TechnicalSpecifications", "Images"
    ];

    const DESIRED_OUTPUT_CSV_HEADERS = [
        "Title", "Theme", "Domain", "PatentStatus", "TRLLevel", "Innovators",
        "DetailedDescription", "Advantages", "Applications", "UseCases",
        "RelatedLinks", "TechnicalSpecifications", "Images"
    ];

    const EXCEL_COLUMNS_TO_REFORMAT_FOR_MULTI_ITEMS = [
        "Theme", "Domain", "Innovators", "Advantages", "Applications",
        "UseCases", "RelatedLinks", "TechnicalSpecifications"
    ];

    const EXCEL_DATA_IN_COLUMNS_TO_FORCE_QUOTE = [
        "Theme", "Domain", "Innovators", "Advantages", "Applications",
        "UseCases", "RelatedLinks", "Images", "TechnicalSpecifications"
    ];

    // --- DOM Elements ---
    const csvFileInput = document.getElementById('csvFileInput');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const recordIndicator = document.getElementById('recordIndicator');
    const downloadPdfButton = document.getElementById('downloadPdfButton');

    const trlNumDisplay = document.getElementById('trlNumDisplay');
    const techTitleDisplay = document.getElementById('techTitleDisplay');
    const innovatorsDisplay = document.getElementById('innovatorsDisplay');
    const docketDisplay = document.getElementById('docketDisplay');
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

    // --- State Variables ---
    let csvData = [];
    let currentRecordIndex = -1;
    let uploadedImagesPerRow = {};
    let removedCsvImageUrlsForRow = {};

    // --- Helper function to capture edits from DOM to csvData ---
    function captureCurrentEdits() {
        if (currentRecordIndex < 0 || currentRecordIndex >= csvData.length) {
            return; 
        }
        const record = csvData[currentRecordIndex];

        if (techTitleDisplay) record.Title = techTitleDisplay.textContent;
        if (trlNumDisplay) record.TRLLevel = trlNumDisplay.textContent;
        
        // Capture docket, patent status, and description
        if (docketDisplay) record.Docket = docketDisplay.textContent === 'N/A' && !record.hasOwnProperty('Docket') ? '' : docketDisplay.textContent;
        if (patentStatusDisplay) record.PatentStatus = patentStatusDisplay.textContent;
        if (descriptionDisplay) record.DetailedDescription = descriptionDisplay.textContent;

        // Capture innovators (parse from comma-separated display to semicolon-separated storage)
        if (innovatorsDisplay && innovatorsDisplay.textContent !== 'N/A') {
            record.Innovators = innovatorsDisplay.textContent.split(',').map(s => s.trim()).filter(s => s).join(';');
        } else if (innovatorsDisplay && innovatorsDisplay.textContent === 'N/A') {
             record.Innovators = ""; // Treat N/A display as empty
        }


        const captureListContent = (ulElement) => {
            if (!ulElement) return ""; 
            const items = [];
            const liSpans = ulElement.querySelectorAll('li span[contenteditable="true"]');
            if (liSpans.length === 0 && ulElement.children.length === 1 && ulElement.firstElementChild && ulElement.firstElementChild.classList.contains('placeholder-item')) {
                 // Handles case where populateList might have added a placeholder that wasn't edited (e.g. by an add then immediate delete on an empty list)
                 return ""; // No actual user items
            }
            liSpans.forEach(span => {
                items.push(span.textContent.trim());
            });

            if (items.length === 1 && ulElement.firstElementChild && ulElement.firstElementChild.classList.contains('placeholder-item')) {
                const placeholderDefaultText = ulElement.dataset.defaultText || "New item - edit here";
                if (items[0] === placeholderDefaultText) {
                    return ""; // Unedited placeholder means empty
                }
            }
            return items.filter(item => item).join(';'); // Filter out empty strings from items before joining
        };

        if (featuresUl) record.Advantages = captureListContent(featuresUl);
        if (advantagesUl) record.Applications = captureListContent(advantagesUl);
        if (useCasesUl) record.UseCases = captureListContent(useCasesUl);
        if (techSpecsUl) record.TechnicalSpecifications = captureListContent(techSpecsUl);
        if (domainUl) record.Domain = captureListContent(domainUl);
        if (themeListUl) record.Theme = captureListContent(themeListUl);

        csvData[currentRecordIndex] = record;
    }

    // --- Excel Preprocessing Functions (Adapted for browser) ---
    function formatMultiItemCellForExcel(cellValue, currentHeader) {
        if (cellValue === null || typeof cellValue === 'undefined' || String(cellValue).trim() === '') {
            return '';
        }
        let s = String(cellValue);
        s = s.replace(/\r\n/g, '\n'); 

        let items;
        if (s.includes(';')) {
            items = s.split(';')
                .map(item => item.replace(/\n/g, ' ').trim())
                .filter(item => item.length > 0);
        } else {
            items = s.split('\n')
                .map(item => item.trim())
                .filter(item => item.length > 0);
        }

        if (currentHeader === "RelatedLinks") {
            const urls = items.map(item => {
                const urlMatch = item.match(/https?:\/\/[^\s]+/gi);
                return urlMatch ? urlMatch[0] : null;
            }).filter(url => url !== null);
            return urls.join(' ; ');
        } else {
            return items.join(' ; ');
        }
    }

    function manuallyGenerateCsvStringForExcel(aoa, dataHeadersToForceQuote, allHeadersInOutputOrder) {
        return aoa.map((rowArray, rowIndex) => {
            return rowArray.map((cellValue, colIndex) => {
                let cellString = (cellValue === null || typeof cellValue === 'undefined') ? '' : String(cellValue);
                const headerNameForCurrentColumn = allHeadersInOutputOrder[colIndex];
                let applyForcedQuoting = false;
                let applyStandardQuoting = false;

                if (rowIndex > 0) { 
                    if (dataHeadersToForceQuote.includes(headerNameForCurrentColumn)) {
                        applyForcedQuoting = true;
                    }
                }
                if (cellString.includes(',') || cellString.includes('\n') || cellString.includes('"')) {
                    applyStandardQuoting = true;
                }
                if (applyForcedQuoting || applyStandardQuoting) {
                    cellString = cellString.replace(/"/g, '""');
                    return `"${cellString}"`;
                }
                return cellString;
            }).join(',');
        }).join('\n');
    }

    function processExcelToCsvString(excelFileData) {
        try {
            if (typeof XLSX === 'undefined') {
                alert("XLSX library (SheetJS) is not loaded. Please ensure it's included in your HTML.");
                console.error("XLSX library not found.");
                return null;
            }
            const workbook = XLSX.read(excelFileData, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];

            if (!firstSheetName) {
                alert("Error: The Excel workbook has no sheets.");
                return null;
            }
            const worksheet = workbook.Sheets[firstSheetName];
            const allDataAoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            if (allDataAoa.length === 0) {
                alert("Error: The Excel sheet is empty.");
                return null;
            }
            
            // const originalExcelHeadersFromFile = allDataAoa[0]; // Headers from file
            // Using ALL_ORIGINAL_EXCEL_HEADERS_IN_ORDER for mapping consistency
            const selectedColumnIndicesInOriginalOrder = DESIRED_OUTPUT_CSV_HEADERS.map(desiredHeader => {
                const index = ALL_ORIGINAL_EXCEL_HEADERS_IN_ORDER.indexOf(desiredHeader);
                if (index === -1) {
                    throw new Error(`Configuration error for Excel processing: Header "${desiredHeader}" not found in 'ALL_ORIGINAL_EXCEL_HEADERS_IN_ORDER'. Please check your configuration and ensure your Excel file structure matches.`);
                }
                return index;
            });

            const dataRows = allDataAoa.slice(1);
            const processedAndFilteredRows = dataRows.map(originalRowArray => {
                const newSelectedRow = [];
                DESIRED_OUTPUT_CSV_HEADERS.forEach((desiredHeader, i) => {
                    const originalColIndexToFetch = selectedColumnIndicesInOriginalOrder[i];
                    let cellValue = (originalColIndexToFetch < originalRowArray.length) ? originalRowArray[originalColIndexToFetch] : '';

                    if (EXCEL_COLUMNS_TO_REFORMAT_FOR_MULTI_ITEMS.includes(desiredHeader)) {
                        cellValue = formatMultiItemCellForExcel(cellValue, desiredHeader);
                    }
                    newSelectedRow.push(cellValue);
                });
                return newSelectedRow;
            });

            const outputAoa = [DESIRED_OUTPUT_CSV_HEADERS, ...processedAndFilteredRows];
            const csvOutputString = manuallyGenerateCsvStringForExcel(outputAoa, EXCEL_DATA_IN_COLUMNS_TO_FORCE_QUOTE, DESIRED_OUTPUT_CSV_HEADERS);
            return csvOutputString;
        } catch (error) {
            alert("An error occurred during Excel processing: " + error.message);
            console.error("An error occurred during Excel processing:", error);
            return null;
        }
    }

    // --- CSV Parsing ---
    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

        if (JSON.stringify(headers) !== JSON.stringify(DESIRED_OUTPUT_CSV_HEADERS)) {
            console.warn("Warning: CSV headers from data (" + headers.join() + ") do not perfectly match DESIRED_OUTPUT_CSV_HEADERS ("+ DESIRED_OUTPUT_CSV_HEADERS.join() +"). Data might not display as expected if column names differ.", headers, DESIRED_OUTPUT_CSV_HEADERS);
        }

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
                console.warn(`Skipping line ${i + 1} in CSV parsing due to column count mismatch.`);
            }
        }
        return data;
    }
    
    // --- UI Update Functions ---
    function createEditableListItem(ulElement, itemText, isPlaceholder = false) {
        const li = document.createElement('li');
        const editableSpan = document.createElement('span');
        editableSpan.setAttribute('contenteditable', 'true');
        editableSpan.textContent = itemText;
        li.appendChild(editableSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-list-item-btn';
        deleteBtn.innerHTML = '&#x1F5D1;';
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
        if (!ulElement) return;
        ulElement.innerHTML = '';
        const defaultTextForItem = ulElement.dataset.defaultText || "New item - edit here";
        const items = (dataString && dataString.trim() !== "" && dataString.toUpperCase() !== "N/A") 
            ? dataString.split(';').map(item => item.trim()).filter(item => item) 
            : [];

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
        img.onerror = function () {
            this.alt = `Failed to load: ${imageUrl.substring(0, 50)}...`;
            this.style.border = "1px solid red"; // Indicate error
        };
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove Image';
        removeBtn.onclick = (event) => {
            event.stopPropagation();
            captureCurrentEdits(); // Capture edits before removing image and re-displaying
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
        } else {
            if (uploadedImagesPerRow[currentRecordIndex]) {
                uploadedImagesPerRow[currentRecordIndex] = uploadedImagesPerRow[currentRecordIndex].filter(url => url !== imageUrl);
            }
        }
        displayRecord(currentRecordIndex);
    }

    function displayRecord(index) {
        if (featuresImagesContainer) featuresImagesContainer.innerHTML = '';
        if (endOfDocumentImagesContainer) endOfDocumentImagesContainer.innerHTML = '';
        if (qrCodeContainer) qrCodeContainer.innerHTML = '';

        if (csvData.length === 0 || index < 0 || index >= csvData.length) {
            trlNumDisplay.textContent = 'N/A';
            techTitleDisplay.textContent = 'Technology Title';
            innovatorsDisplay.textContent = 'N/A';
            docketDisplay.textContent = 'N/A';
            patentStatusDisplay.textContent = 'N/A';
            descriptionDisplay.textContent = 'N/A';
            [featuresUl, advantagesUl, useCasesUl, techSpecsUl, domainUl, themeListUl].forEach(ul => {
                if (ul) populateList(ul, null);
            });
            if (recordIndicator) recordIndicator.textContent = (csvData.length === 0 && currentRecordIndex === -1) ? "No data loaded" : "No record to display";
            if (prevButton) prevButton.disabled = true;
            if (nextButton) nextButton.disabled = true;
            if (downloadPdfButton) downloadPdfButton.disabled = true;
            currentRecordIndex = -1;
            return;
        }
        const record = csvData[index];

        trlNumDisplay.textContent = record.TRLLevel || 'N/A';
        techTitleDisplay.textContent = record.Title || 'Technology Title';
        innovatorsDisplay.textContent = record.Innovators ? record.Innovators.split(';').map(s => s.trim()).filter(s=>s).join(', ') : 'N/A';
        if (innovatorsDisplay.textContent === "") innovatorsDisplay.textContent = 'N/A';


        docketDisplay.textContent = record.Docket || 'N/A';
        patentStatusDisplay.textContent = record.PatentStatus || 'N/A';
        descriptionDisplay.textContent = record.DetailedDescription || 'N/A';

        if (featuresUl) populateList(featuresUl, record.Advantages);
        if (advantagesUl) populateList(advantagesUl, record.Applications);
        if (useCasesUl) populateList(useCasesUl, record.UseCases);
        if (techSpecsUl) populateList(techSpecsUl, record.TechnicalSpecifications);
        if (domainUl) populateList(domainUl, record.Domain);
        if (themeListUl) populateList(themeListUl, record.Theme);

        const csvImageUrlsFromRecord = (record.Images || '')
            .split(',')
            .map(url => url.trim())
            .filter(url => url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('./') || url.startsWith('/')));
        const urlsToRemoveForThisRecord = removedCsvImageUrlsForRow[index] || [];
        const filteredCsvImages = csvImageUrlsFromRecord
            .filter(url => !urlsToRemoveForThisRecord.includes(url))
            .map(url => ({ url: url, isCsv: true }));
        const uploadedImageObjects = (uploadedImagesPerRow[index] || [])
            .map(url => ({ url: url, isCsv: false }));
        const combinedImageObjects = [...filteredCsvImages, ...uploadedImageObjects];

        if (combinedImageObjects.length > 0) {
            const targetContainer = combinedImageObjects.length < 4 ? featuresImagesContainer : endOfDocumentImagesContainer;
            if (targetContainer) {
                combinedImageObjects.forEach(imgObj => {
                    targetContainer.appendChild(createImageElementWrapper(imgObj.url, imgObj.isCsv));
                });
            }
        }

        if (recordIndicator) recordIndicator.textContent = `Record ${index + 1} of ${csvData.length}`;
        currentRecordIndex = index;
        if (prevButton) prevButton.disabled = index === 0;
        if (nextButton) nextButton.disabled = index === csvData.length - 1;
        if (downloadPdfButton) downloadPdfButton.disabled = false;
    }

    // --- Event Listeners ---
    csvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            const fileName = file.name.toLowerCase();
            const processCsvText = (csvText) => {
                try {
                    csvData = parseCSV(csvText);
                    uploadedImagesPerRow = {};
                    removedCsvImageUrlsForRow = {};
                    if (csvData.length > 0) {
                        currentRecordIndex = 0;
                        displayRecord(currentRecordIndex);
                    } else {
                        csvData = []; currentRecordIndex = -1; displayRecord(-1);
                        alert("No valid data found or file is empty after processing.");
                    }
                } catch (error) {
                    console.error("Error parsing CSV data:", error);
                    if (recordIndicator) recordIndicator.textContent = "Error processing CSV data.";
                    alert("Could not process CSV data. " + error.message);
                    csvData = []; currentRecordIndex = -1; displayRecord(-1);
                }
            };

            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                reader.onload = (e) => {
                    const csvTextFromExcel = processExcelToCsvString(e.target.result);
                    if (csvTextFromExcel) {
                        processCsvText(csvTextFromExcel);
                    } else {
                        csvData = []; currentRecordIndex = -1; displayRecord(-1);
                        if (recordIndicator) recordIndicator.textContent = "Failed to process Excel file.";
                    }
                };
                reader.onerror = () => { if (recordIndicator) recordIndicator.textContent = "Error reading file."; alert('Failed to read the Excel file.');};
                reader.readAsArrayBuffer(file);
            } else if (fileName.endsWith('.csv')) {
                reader.onload = (e) => processCsvText(e.target.result);
                reader.onerror = () => {if (recordIndicator) recordIndicator.textContent = "Error reading file."; alert('Failed to read the CSV file.');};
                reader.readAsText(file);
            } else {
                alert("Unsupported file type. Please upload a CSV or Excel file.");
            }
        }
        event.target.value = ''; 
    });

    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', async (event) => {
            if (currentRecordIndex < 0 || currentRecordIndex >= csvData.length) {
                alert("Please load data and select a record before uploading images.");
                event.target.value = ''; return;
            }
            const files = Array.from(event.target.files);
            if (!files.length) return;
            
            captureCurrentEdits(); // Capture edits before adding new images

            // It's better to add to existing uploaded images for the row, rather than replacing all.
            // However, current logic replaces. To stick to "don't change settings", I'll keep replacement.
            // If appending is desired, this part needs to change:
            // uploadedImagesPerRow[currentRecordIndex] = uploadedImagesPerRow[currentRecordIndex] || []; 
            uploadedImagesPerRow[currentRecordIndex] = []; // Current logic: replaces

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
                // uploadedImagesPerRow[currentRecordIndex].push(...dataUrls); // If appending
                uploadedImagesPerRow[currentRecordIndex] = dataUrls; // Current logic: replaces
                displayRecord(currentRecordIndex);
            } catch (error) {
                alert("Error processing uploaded images.");
            }
            event.target.value = '';
        });
    }

    if (mainContentElement) {
        mainContentElement.addEventListener('click', function (event) {
            const target = event.target;
            if (target.classList.contains('add-list-item-btn')) {
                event.preventDefault();
                captureCurrentEdits(); // Capture edits before modifying list structure
                const targetUlSelector = target.dataset.listTargetSelector;
                const ulElement = mainContentElement.querySelector(targetUlSelector);
                if (ulElement) {
                    const defaultTextForNewItem = ulElement.dataset.defaultText || "New item - edit here";
                    let textForNewItem = "Edit this item...";
                    if (ulElement.children.length === 0 || (ulElement.children.length === 1 && ulElement.firstElementChild.classList.contains('placeholder-item'))) {
                        ulElement.innerHTML = ''; 
                        textForNewItem = defaultTextForNewItem;
                    }
                    const newItemLi = createEditableListItem(ulElement, textForNewItem, false);
                    const spanToFocus = newItemLi.querySelector('span[contenteditable="true"]');
                    if (spanToFocus) {
                        spanToFocus.focus();
                        // Select text for easy editing (optional)
                        // const range = document.createRange();
                        // const sel = window.getSelection();
                        // if (sel) {
                        // range.selectNodeContents(spanToFocus);
                        // sel.removeAllRanges();
                        // sel.addRange(range);
                        // }
                    }
                }
            } else if (target.classList.contains('delete-list-item-btn') || target.closest('.delete-list-item-btn')) {
                event.preventDefault();
                captureCurrentEdits(); // Capture edits before modifying list structure
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
                captureCurrentEdits(); // Capture edits of the current record before navigating
                displayRecord(currentRecordIndex - 1);
            } else if (currentRecordIndex === 0) { // If on the first record, still capture its edits
                 captureCurrentEdits();
                 // prevButton should be disabled, but as a safeguard if logic changes
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            if (currentRecordIndex < csvData.length - 1) {
                captureCurrentEdits(); // Capture edits of the current record before navigating
                displayRecord(currentRecordIndex + 1);
            } else if (currentRecordIndex === csvData.length - 1) { // If on the last record
                captureCurrentEdits();
                // nextButton should be disabled
            }
        });
    }

    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            if (csvData.length === 0 || currentRecordIndex < 0 || currentRecordIndex >= csvData.length) {
                alert("Please load data and select a record."); return;
            }
            captureCurrentEdits(); // Ensure latest edits are in PDF
            
            const element = document.querySelector('.a4-sheet');
            const controlsContainer = document.querySelector('.controls-container');
            if (!element) { alert("Printable element not found."); return; }

            if (controlsContainer) controlsContainer.style.display = 'none';
            if (boldTooltip) boldTooltip.style.display = 'none';
            const removeImageButtons = element.querySelectorAll('.remove-image-btn');
            removeImageButtons.forEach(btn => btn.style.display = 'none');
            
            // Temporarily remove contenteditable attribute for cleaner PDF
            const editableElements = element.querySelectorAll('[contenteditable="true"]');
            editableElements.forEach(el => el.setAttribute('data-was-editable', 'true'));
            editableElements.forEach(el => el.removeAttribute('contenteditable'));


            element.scrollLeft = 0; element.scrollTop = 0;
            const elementScrollHeightPx = element.scrollHeight;
            const elementOffsetWidthPx = element.offsetWidth;
            const pxToMmFactor = 25.4 / 96.0;
            const pdfPageHeightMm = elementScrollHeightPx * pxToMmFactor;
            const pdfPageWidthMm = 210;
            const currentRecord = csvData[currentRecordIndex];
            const titleValue = currentRecord.Title || 'Untitled_Technology';
            const sanitizeForFilename = (name) => String(name).replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\s+/g, '_');
            const newFilename = `${sanitizeForFilename(titleValue)}.pdf`;

            const opt = {
                margin: 0, filename: newFilename, image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2, useCORS: true, logging: false, letterRendering: true,
                    width: elementOffsetWidthPx, height: elementScrollHeightPx,
                    scrollX: 0, scrollY: 0,
                    onclone: (doc) => {
                        doc.querySelectorAll('[contenteditable="true"]').forEach(el => { el.style.outline = 'none'; el.style.backgroundColor = '';});
                        doc.querySelectorAll('.add-list-item-btn, .delete-list-item-btn, .remove-image-btn').forEach(btn => btn.style.display = 'none');
                    }
                },
                jsPDF: { unit: 'mm', format: [pdfPageWidthMm, pdfPageHeightMm], orientation: 'portrait' }
            };

            if (typeof html2pdf === 'function') {
                html2pdf().from(element).set(opt).save().then(() => {
                    if (controlsContainer) controlsContainer.style.display = 'flex';
                    removeImageButtons.forEach(btn => btn.style.display = '');
                    editableElements.forEach(el => el.setAttribute('contenteditable', 'true')); // Restore
                }).catch(err => {
                    if (controlsContainer) controlsContainer.style.display = 'flex';
                    removeImageButtons.forEach(btn => btn.style.display = '');
                    editableElements.forEach(el => el.setAttribute('contenteditable', 'true')); // Restore
                    alert("Error generating PDF: " + err.message);
                });
            } else {
                alert("PDF generation library (html2pdf) not loaded.");
                if (controlsContainer) controlsContainer.style.display = 'flex';
                removeImageButtons.forEach(btn => btn.style.display = '');
                editableElements.forEach(el => el.setAttribute('contenteditable', 'true')); // Restore
            }
        });
    }

    // --- Bold Tooltip & QR Code (Largely unchanged, ensure no conflicts) ---
    if (a4Sheet && boldTooltip && makeBoldButton) {
        a4Sheet.addEventListener('mouseup', (e) => {
            if (e.target === boldTooltip || boldTooltip.contains(e.target) || (makeBoldButton && e.target === makeBoldButton)) {
                return;
            }
            const selection = window.getSelection();
            if (selection && selection.toString().trim() !== '') {
                let container = selection.anchorNode;
                let isEditableInSheet = false;
                if (container) {
                    if (container.nodeType !== Node.ELEMENT_NODE) container = container.parentNode;
                    if (container) {
                        while (container && container !== document.body) {
                            if (container.isContentEditable && a4Sheet.contains(container)) {
                                isEditableInSheet = true; break;
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
            if (boldTooltip && boldTooltip.style.display === 'flex' && !boldTooltip.contains(e.target) && e.target !== makeBoldButton) {
                let currentSelection = window.getSelection();
                if (!currentSelection || currentSelection.isCollapsed || currentSelection.toString().trim() === '') {
                    boldTooltip.style.display = 'none';
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

    if (generateQrButton && qrLinkInput && qrCodeContainer) {
        generateQrButton.addEventListener('click', () => {
            const linkText = qrLinkInput.value.trim();
            if (linkText === "") { alert("Please enter a link for QR code."); qrLinkInput.focus(); return; }
            qrCodeContainer.innerHTML = '';
            const singleQrItemDiv = document.createElement('div');
            singleQrItemDiv.className = 'qr-code-item';
            try {
                if (typeof QRCode === 'function') {
                    new QRCode(singleQrItemDiv, {
                        text: linkText, width: 120, height: 120,
                        colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H
                    });
                    qrCodeContainer.appendChild(singleQrItemDiv);
                    qrLinkInput.value = '';
                } else { alert("QR Code library not loaded."); }
            } catch (error) { console.error("Error generating QR Code:", error); alert("Could not generate QR code."); }
        });
    } else { console.warn("QR Code elements not found."); }

    // --- Initial UI Setup ---
    displayRecord(-1);
});
