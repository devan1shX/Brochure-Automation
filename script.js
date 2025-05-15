// script.js (Revised for table display and removal of prev/next)
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
        "TechnicalSpecifications", "Images", "QRCodes"
    ];

    const DESIRED_OUTPUT_CSV_HEADERS = [
        "Title", "Theme", "Domain", "PatentStatus", "TRLLevel", "Innovators",
        "DetailedDescription", "Advantages", "Applications", "UseCases",
        "RelatedLinks", "TechnicalSpecifications", "Images", "QRCodes"
    ];

    const EXCEL_COLUMNS_TO_REFORMAT_FOR_MULTI_ITEMS = [
        "Theme", "Domain", "Innovators", "Advantages", "Applications",
        "UseCases", "RelatedLinks", "TechnicalSpecifications", "QRCodes"
    ];

    const EXCEL_DATA_IN_COLUMNS_TO_FORCE_QUOTE = [
        "Theme", "Domain", "Innovators", "Advantages", "Applications",
        "UseCases", "RelatedLinks", "Images", "TechnicalSpecifications", "QRCodes"
    ];

    // --- DOM Elements ---
    const csvFileInput = document.getElementById('csvFileInput');
    // const prevButton = document.getElementById('prevButton'); // REMOVED
    // const nextButton = document.getElementById('nextButton'); // REMOVED
    // const recordIndicator = document.getElementById('recordIndicator'); // REMOVED
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

    const recordsTableContainer = document.getElementById('recordsTableContainer'); // NEW
    const recordsTablePlaceholder = document.getElementById('recordsTablePlaceholder'); // NEW

    // --- State Variables ---
    let csvData = [];
    let currentRecordIndex = -1;
    let uploadedImagesPerRow = {};
    let removedCsvImageUrlsForRow = {};

    // --- Helper function to capture edits from DOM to csvData ---
    function captureCurrentEdits() {
        if (currentRecordIndex < 0 || currentRecordIndex >= csvData.length || !csvData[currentRecordIndex]) {
            return;
        }
        const record = csvData[currentRecordIndex];

        if (techTitleDisplay) record.Title = techTitleDisplay.textContent;
        if (trlNumDisplay) record.TRLLevel = trlNumDisplay.textContent;
        if (docketDisplay) record.Docket = docketDisplay.textContent === 'N/A' && !record.hasOwnProperty('Docket') ? '' : docketDisplay.textContent;
        if (patentStatusDisplay) record.PatentStatus = patentStatusDisplay.textContent;
        if (descriptionDisplay) record.DetailedDescription = descriptionDisplay.innerHTML; // Keep innerHTML for bold

        if (innovatorsDisplay) {
            if (innovatorsDisplay.textContent !== 'N/A' && innovatorsDisplay.textContent.trim() !== "") {
                record.Innovators = innovatorsDisplay.textContent.split(',').map(s => s.trim()).filter(s => s).join(';');
            } else {
                record.Innovators = "";
            }
        }

        const captureListContent = (ulElement) => {
            if (!ulElement) return "";
            const items = [];
            const liSpans = ulElement.querySelectorAll('li span[contenteditable="true"]');
            if (liSpans.length === 0 && ulElement.children.length === 1 && ulElement.firstElementChild && ulElement.firstElementChild.classList.contains('placeholder-item')) {
                return "";
            }
            liSpans.forEach(span => {
                items.push(span.innerHTML.trim()); // Use innerHTML
            });

            if (items.length === 1 && ulElement.firstElementChild && ulElement.firstElementChild.classList.contains('placeholder-item')) {
                const placeholderDefaultText = ulElement.dataset.defaultText || "New item - edit here";
                if (ulElement.firstElementChild.textContent.trim() === placeholderDefaultText) {
                    return "";
                }
            }
            return items.filter(item => item).join(';');
        };

        if (featuresUl) record.Advantages = captureListContent(featuresUl);
        if (advantagesUl) record.Applications = captureListContent(advantagesUl);
        if (useCasesUl) record.UseCases = captureListContent(useCasesUl);
        if (techSpecsUl) record.TechnicalSpecifications = captureListContent(techSpecsUl);
        if (domainUl) record.Domain = captureListContent(domainUl);
        if (themeListUl) record.Theme = captureListContent(themeListUl);

        if (qrCodeContainer) {
            const qrItems = qrCodeContainer.querySelectorAll('.qr-code-item');
            const qrLinks = [];
            qrItems.forEach(item => {
                if (item.dataset.link) {
                    qrLinks.push(item.dataset.link);
                }
            });
            record.QRCodes = qrLinks.join(';');
        } else {
            if (record && !record.hasOwnProperty('QRCodes')) {
                record.QRCodes = "";
            }
        }
    }

    // --- Excel Preprocessing Functions ---
    function formatMultiItemCellForExcel(cellValue, currentHeader) {
        if (cellValue === null || typeof cellValue === 'undefined' || String(cellValue).trim() === '') {
            return '';
        }
        let s = String(cellValue).replace(/\r\n/g, '\n');
        let items;
        if (s.includes(';')) {
            items = s.split(';').map(item => item.replace(/\n/g, ' ').trim()).filter(item => item.length > 0);
        } else {
            items = s.split('\n').map(item => item.trim()).filter(item => item.length > 0);
        }
        if (currentHeader === "RelatedLinks") {
            return items.map(item => (item.match(/https?:\/\/[^\s]+/gi) || [item])[0]).filter(url => url).join(' ; ');
        }
        return items.join(' ; ');
    }

    function manuallyGenerateCsvStringForExcel(aoa, dataHeadersToForceQuote, allHeadersInOutputOrder) {
        return aoa.map((rowArray, rowIndex) => {
            return rowArray.map((cellValue, colIndex) => {
                let cellString = (cellValue === null || typeof cellValue === 'undefined') ? '' : String(cellValue);
                const headerNameForCurrentColumn = allHeadersInOutputOrder[colIndex];
                let applyForcedQuoting = (rowIndex > 0 && dataHeadersToForceQuote.includes(headerNameForCurrentColumn));
                let applyStandardQuoting = (cellString.includes(',') || cellString.includes('\n') || cellString.includes('"'));
                if (applyForcedQuoting || applyStandardQuoting) {
                    return `"${cellString.replace(/"/g, '""')}"`;
                }
                return cellString;
            }).join(',');
        }).join('\n');
    }

    function processExcelToCsvString(excelFileData) {
        try {
            if (typeof XLSX === 'undefined') {
                alert("XLSX library (SheetJS) is not loaded."); console.error("XLSX library not found."); return null;
            }
            const workbook = XLSX.read(excelFileData, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
                alert("Error: The Excel workbook has no sheets."); return null;
            }
            const worksheet = workbook.Sheets[firstSheetName];
            const allDataAoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            if (!allDataAoa || allDataAoa.length === 0) {
                alert("Error: The Excel sheet is empty or unreadable."); return null;
            }

            const colIndicesForDesiredHeaders = DESIRED_OUTPUT_CSV_HEADERS.map(desiredHeader => {
                const indexInMasterList = ALL_ORIGINAL_EXCEL_HEADERS_IN_ORDER.indexOf(desiredHeader);
                return indexInMasterList;
            });

            const dataRows = allDataAoa.slice(1);
            const processedAndFilteredRows = dataRows.map(originalRowArray => {
                const newSelectedRow = [];
                DESIRED_OUTPUT_CSV_HEADERS.forEach((desiredHeader, i) => {
                    const originalColIndexToFetch = colIndicesForDesiredHeaders[i];
                    let cellValue = '';
                    if (originalColIndexToFetch !== -1 && originalColIndexToFetch < originalRowArray.length) {
                        cellValue = originalRowArray[originalColIndexToFetch];
                    }
                    if (EXCEL_COLUMNS_TO_REFORMAT_FOR_MULTI_ITEMS.includes(desiredHeader)) {
                        cellValue = formatMultiItemCellForExcel(cellValue, desiredHeader);
                    }
                    newSelectedRow.push(cellValue);
                });
                return newSelectedRow;
            });

            const outputAoa = [DESIRED_OUTPUT_CSV_HEADERS, ...processedAndFilteredRows];
            return manuallyGenerateCsvStringForExcel(outputAoa, EXCEL_DATA_IN_COLUMNS_TO_FORCE_QUOTE, DESIRED_OUTPUT_CSV_HEADERS);
        } catch (error) {
            alert("An error occurred during Excel processing: " + error.message);
            console.error("Excel processing error:", error, error.stack);
            return null;
        }
    }

    // --- CSV Parsing ---
    function parseCSV(csvText) {
        try {
            const lines = csvText.trim().split('\n');
            if (lines.length === 0) return [];

            const headersFromCsv = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            let headersToUse = headersFromCsv;
            // Warning if headers don't match (optional, kept from original)
            // if (JSON.stringify(headersFromCsv) !== JSON.stringify(DESIRED_OUTPUT_CSV_HEADERS)) {
            //     console.warn("Warning: CSV headers from file do not perfectly match DESIRED_OUTPUT_CSV_HEADERS. Data objects will be keyed by file headers.");
            // }

            const data = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

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

                if (values.length === headersToUse.length) {
                    const entry = {};
                    headersToUse.forEach((header, index) => {
                        let value = values[index];
                        if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
                            value = value.substring(1, value.length - 1).replace(/""/g, '"');
                        }
                        entry[header] = value;
                    });
                    data.push(entry);
                } else {
                    console.warn(`Skipping line ${i + 1} in CSV: column count mismatch. Expected ${headersToUse.length}, got ${values.length}. Line: "${lines[i]}"`);
                }
            }
            return data;
        } catch (error) {
            alert("An error occurred during CSV parsing: " + error.message);
            console.error("CSV parsing error:", error, error.stack);
            return [];
        }
    }

    // --- UI Update Functions ---
    function createEditableListItem(ulElement, itemText, isPlaceholder = false) {
        if (!ulElement) return null;
        const li = document.createElement('li');
        const editableSpan = document.createElement('span');
        editableSpan.setAttribute('contenteditable', 'true');
        editableSpan.innerHTML = itemText;
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
            this.style.border = "1px solid red"; this.style.minHeight = '50px'; this.src = '';
        };
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove Image';
        removeBtn.onclick = (event) => {
            event.stopPropagation(); handleRemoveImage(imageUrl, isCsvImage);
        };
        wrapper.appendChild(img); wrapper.appendChild(removeBtn);
        return wrapper;
    }

    function handleRemoveImage(imageUrl, isCsvImage) {
        if (currentRecordIndex < 0 || currentRecordIndex >= csvData.length) return;
        captureCurrentEdits();
        if (isCsvImage) {
            if (!removedCsvImageUrlsForRow[currentRecordIndex]) removedCsvImageUrlsForRow[currentRecordIndex] = [];
            if (!removedCsvImageUrlsForRow[currentRecordIndex].includes(imageUrl)) removedCsvImageUrlsForRow[currentRecordIndex].push(imageUrl);
        } else {
            if (uploadedImagesPerRow[currentRecordIndex]) uploadedImagesPerRow[currentRecordIndex] = uploadedImagesPerRow[currentRecordIndex].filter(url => url !== imageUrl);
        }
        displayRecord(currentRecordIndex);
    }

    function displayRecordsInTable(records) { // NEW FUNCTION
        if (!recordsTableContainer) return;
        recordsTableContainer.innerHTML = ''; // Clear previous table

        if (!records || records.length === 0) {
            if (recordsTablePlaceholder) {
                recordsTablePlaceholder.textContent = "No records to display in table.";
                recordsTablePlaceholder.style.display = 'block';
            }
            return;
        }
        if (recordsTablePlaceholder) recordsTablePlaceholder.style.display = 'none';


        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        const tableHeaders = ["Tech Title", "Innovator(s)", "TRL"];
        const headerRow = document.createElement('tr');
        tableHeaders.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        records.forEach((record, index) => {
            const tr = document.createElement('tr');
            tr.dataset.recordIndex = index;

            const title = record.Title || 'N/A';
            const innovators = record.Innovators ? record.Innovators.split(';').map(s => s.trim()).filter(s=>s).join(', ') : 'N/A';
            const trl = record.TRLLevel || 'N/A';

            const rowData = [title, innovators, trl];

            rowData.forEach(cellData => {
                const td = document.createElement('td');
                // Truncate long text directly here, or rely on CSS text-overflow
                td.textContent = cellData; // CSS will handle ellipsis
                td.title = cellData; // Show full text on hover
                tr.appendChild(td);
            });

            tr.addEventListener('click', () => {
                if (currentRecordIndex !== -1 && currentRecordIndex < csvData.length) {
                    captureCurrentEdits();
                }

                const currentlySelectedInTable = table.querySelector('tr.selected-record');
                if (currentlySelectedInTable) {
                    currentlySelectedInTable.classList.remove('selected-record');
                }
                tr.classList.add('selected-record');

                currentRecordIndex = parseInt(tr.dataset.recordIndex, 10);
                displayRecord(currentRecordIndex);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        recordsTableContainer.appendChild(table);
    }


    function displayRecord(index) {
        if (featuresImagesContainer) featuresImagesContainer.innerHTML = '';
        if (endOfDocumentImagesContainer) endOfDocumentImagesContainer.innerHTML = '';
        if (qrCodeContainer) qrCodeContainer.innerHTML = '';

        if (csvData.length === 0 || index < 0 || index >= csvData.length || !csvData[index]) {
            if (trlNumDisplay) trlNumDisplay.textContent = 'N/A';
            if (techTitleDisplay) techTitleDisplay.textContent = 'Technology Title';
            if (innovatorsDisplay) innovatorsDisplay.textContent = 'N/A';
            if (docketDisplay) docketDisplay.textContent = 'N/A';
            if (patentStatusDisplay) patentStatusDisplay.textContent = 'N/A';
            if (descriptionDisplay) descriptionDisplay.innerHTML = 'N/A';

            [featuresUl, advantagesUl, useCasesUl, techSpecsUl, domainUl, themeListUl].forEach(ul => {
                if (ul) populateList(ul, null);
            });

            if (downloadPdfButton) downloadPdfButton.disabled = true;
            // currentRecordIndex = -1; // Already set or will be set by caller

            // Clear selection in table if one exists
            if (recordsTableContainer) {
                const table = recordsTableContainer.querySelector('table');
                if (table) {
                    const currentlySelectedRow = table.querySelector('tr.selected-record');
                    if (currentlySelectedRow) {
                        currentlySelectedRow.classList.remove('selected-record');
                    }
                }
            }
            return;
        }

        const record = csvData[index];
        if (trlNumDisplay) trlNumDisplay.textContent = record.TRLLevel || 'N/A';
        if (techTitleDisplay) techTitleDisplay.textContent = record.Title || 'Technology Title';

        if (innovatorsDisplay) {
            const innovatorsText = record.Innovators ? record.Innovators.split(';').map(s => s.trim()).filter(s => s).join(', ') : 'N/A';
            innovatorsDisplay.textContent = innovatorsText === "" || innovatorsText === "N/A" ? 'N/A' : innovatorsText;
        }

        if (docketDisplay) docketDisplay.textContent = record.Docket || 'N/A';
        if (patentStatusDisplay) patentStatusDisplay.textContent = record.PatentStatus || 'N/A';
        if (descriptionDisplay) descriptionDisplay.innerHTML = record.DetailedDescription || 'N/A';

        if (featuresUl) populateList(featuresUl, record.Advantages);
        if (advantagesUl) populateList(advantagesUl, record.Applications);
        if (useCasesUl) populateList(useCasesUl, record.UseCases);
        if (techSpecsUl) populateList(techSpecsUl, record.TechnicalSpecifications);
        if (domainUl) populateList(domainUl, record.Domain);
        if (themeListUl) populateList(themeListUl, record.Theme);

        const csvImageUrlsFromRecord = (record.Images || '').split(',').map(url => url.trim()).filter(url => url && (url.startsWith('http') || url.startsWith('./') || url.startsWith('/')));
        const urlsToRemoveForThisRecord = removedCsvImageUrlsForRow[index] || [];
        const filteredCsvImages = csvImageUrlsFromRecord.filter(url => !urlsToRemoveForThisRecord.includes(url)).map(url => ({ url, isCsv: true }));
        const uploadedImageObjects = (uploadedImagesPerRow[index] || []).map(url => ({ url, isCsv: false }));
        const combinedImageObjects = [...filteredCsvImages, ...uploadedImageObjects];

        if (combinedImageObjects.length > 0) {
            const targetContainer = combinedImageObjects.length < 4 ? featuresImagesContainer : endOfDocumentImagesContainer;
            if (targetContainer) {
                targetContainer.innerHTML = '';
                combinedImageObjects.forEach(imgObj => targetContainer.appendChild(createImageElementWrapper(imgObj.url, imgObj.isCsv)));
            }
        }

        if (qrCodeContainer && record.QRCodes) {
            const qrLinks = record.QRCodes.split(';').map(s => s.trim()).filter(s => s);
            if (qrLinks.length > 0) {
                qrLinks.forEach(link => {
                    if (typeof QRCode === 'function') {
                        const itemDiv = document.createElement('div'); itemDiv.className = 'qr-code-item'; itemDiv.dataset.link = link;
                        try { new QRCode(itemDiv, { text: link, width: 80, height: 80, colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.H }); }
                        catch (e) { console.error("QR Gen Error:", e); itemDiv.textContent = "QR Err"; }
                        const btn = document.createElement('button'); btn.className = 'remove-qr-btn'; btn.innerHTML = '&times;'; btn.title = `Remove ${link}`;
                        btn.onclick = (e) => {
                            e.stopPropagation(); captureCurrentEdits();
                            const rec = csvData[currentRecordIndex];
                            rec.QRCodes = (rec.QRCodes || '').split(';').map(s => s.trim()).filter(s => s && s !== link).join(';');
                            displayRecord(currentRecordIndex);
                        };
                        itemDiv.appendChild(btn); qrCodeContainer.appendChild(itemDiv);
                    } else { const p = document.createElement('p'); p.textContent = `QR: ${link.substring(0, 15)}... (lib missing)`; qrCodeContainer.appendChild(p); }
                });
            }
        }

        currentRecordIndex = index; // ensure currentRecordIndex is set
        if (downloadPdfButton) downloadPdfButton.disabled = (index < 0 || csvData.length === 0);

        // Ensure the selected row is highlighted in the table
        if (recordsTableContainer) {
            const table = recordsTableContainer.querySelector('table');
            if (table) {
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    if (parseInt(row.dataset.recordIndex, 10) === index) {
                        row.classList.add('selected-record');
                    } else {
                        row.classList.remove('selected-record');
                    }
                });
            }
        }
    }

    // --- Event Listeners ---
    if (csvFileInput) {
        csvFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                const fileName = file.name.toLowerCase();
                const processCsvTextData = (csvText) => {
                    try {
                        csvData = parseCSV(csvText);
                        uploadedImagesPerRow = {}; removedCsvImageUrlsForRow = {};
                        if (csvData.length > 0) {
                            displayRecordsInTable(csvData); // NEW: Populate table
                            if (recordsTablePlaceholder) recordsTablePlaceholder.style.display = 'none';
                            currentRecordIndex = -1; // No record selected by default
                            displayRecord(-1);       // Clear template
                        } else {
                            currentRecordIndex = -1;
                            displayRecord(-1);
                            if (recordsTableContainer) recordsTableContainer.innerHTML = '';
                            if (recordsTablePlaceholder) {
                                recordsTablePlaceholder.textContent = "No valid data found or file is empty.";
                                recordsTablePlaceholder.style.display = 'block';
                            }
                           // alert("No valid data found or file is empty after processing CSV text."); // Alert is optional if placeholder updates
                        }
                    } catch (error) {
                        console.error("Error in processCsvTextData:", error, error.stack);
                        alert("Could not process CSV data: " + error.message);
                        currentRecordIndex = -1; displayRecord(-1);
                        if (recordsTableContainer) recordsTableContainer.innerHTML = '';
                        if (recordsTablePlaceholder) {
                             recordsTablePlaceholder.textContent = "Error processing data.";
                             recordsTablePlaceholder.style.display = 'block';
                        }
                    }
                };

                if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                    reader.onload = (e) => {
                        const csvTextFromExcel = processExcelToCsvString(e.target.result);
                        if (csvTextFromExcel) {
                            processCsvTextData(csvTextFromExcel);
                        } else {
                            currentRecordIndex = -1; displayRecord(-1);
                            if (recordsTableContainer) recordsTableContainer.innerHTML = '';
                            if (recordsTablePlaceholder) {
                                recordsTablePlaceholder.textContent = "Failed to process Excel file.";
                                recordsTablePlaceholder.style.display = 'block';
                            }
                            // alert("Failed to process Excel file."); // Alert is optional
                        }
                    };
                    reader.onerror = (e) => {
                        alert('Failed to read Excel file.'); console.error("File read error (Excel):", e);
                        currentRecordIndex = -1; displayRecord(-1);
                        if (recordsTableContainer) recordsTableContainer.innerHTML = '';
                        if (recordsTablePlaceholder) { recordsTablePlaceholder.textContent = "Failed to read file."; recordsTablePlaceholder.style.display = 'block';}
                    };
                    reader.readAsArrayBuffer(file);
                } else if (fileName.endsWith('.csv')) {
                    reader.onload = (e) => processCsvTextData(e.target.result);
                    reader.onerror = (e) => {
                        alert('Failed to read CSV file.'); console.error("File read error (CSV):", e);
                        currentRecordIndex = -1; displayRecord(-1);
                        if (recordsTableContainer) recordsTableContainer.innerHTML = '';
                        if (recordsTablePlaceholder) { recordsTablePlaceholder.textContent = "Failed to read file."; recordsTablePlaceholder.style.display = 'block';}
                    };
                    reader.readAsText(file);
                } else {
                    alert("Unsupported file type. Please upload a CSV or Excel file.");
                    currentRecordIndex = -1; displayRecord(-1);
                     if (recordsTableContainer) recordsTableContainer.innerHTML = '';
                     if (recordsTablePlaceholder) { recordsTablePlaceholder.textContent = "Unsupported file type."; recordsTablePlaceholder.style.display = 'block';}
                }
            } else { // No file selected
                 currentRecordIndex = -1; displayRecord(-1);
                 if (recordsTableContainer) recordsTableContainer.innerHTML = '';
                 if (recordsTablePlaceholder) { recordsTablePlaceholder.textContent = "No data loaded. Upload a file to see records."; recordsTablePlaceholder.style.display = 'block';}
            }
            if (event.target) event.target.value = ''; // Reset file input
        });
    } else { console.error("csvFileInput element not found!"); }


    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', async (event) => {
            if (currentRecordIndex < 0 || currentRecordIndex >= csvData.length) {
                alert("Please load data and select a record first."); if (event.target) event.target.value = ''; return;
            }
            const files = Array.from(event.target.files);
            if (!files.length) { if (event.target) event.target.value = ''; return; }

            captureCurrentEdits();
            let existingUploaded = uploadedImagesPerRow[currentRecordIndex] || [];
            try {
                const newDataUrls = await Promise.all(files.map(file => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = err => reject(err);
                    reader.readAsDataURL(file);
                })));
                uploadedImagesPerRow[currentRecordIndex] = [...existingUploaded, ...newDataUrls];
                displayRecord(currentRecordIndex);
            } catch (error) { console.error("Img upload error:", error); alert("Error processing some images."); }
            if (event.target) event.target.value = '';
        });
    }

    if (mainContentElement) {
        mainContentElement.addEventListener('click', function (event) {
            const target = event.target;
            if (target.classList.contains('add-list-item-btn')) {
                event.preventDefault(); if (currentRecordIndex < 0) { alert("Select a record first."); return; }
                captureCurrentEdits();
                const ulElement = mainContentElement.querySelector(target.dataset.listTargetSelector);
                if (ulElement) {
                    const defaultText = ulElement.dataset.defaultText || "New item - edit here";
                    let text = (ulElement.children.length === 0 || (ulElement.children.length === 1 && ulElement.firstElementChild?.classList.contains('placeholder-item'))) ? (ulElement.innerHTML = '', defaultText) : "Edit this item...";
                    const newItemLi = createEditableListItem(ulElement, text, false);
                    if (newItemLi) newItemLi.querySelector('span[contenteditable="true"]')?.focus();
                }
            } else if (target.classList.contains('delete-list-item-btn') || target.closest('.delete-list-item-btn')) {
                event.preventDefault(); if (currentRecordIndex < 0) { alert("Select a record first."); return; }
                captureCurrentEdits();
                const listItem = (target.classList.contains('delete-list-item-btn') ? target : target.closest('.delete-list-item-btn'))?.closest('li');
                if (listItem) {
                    const ulElement = listItem.parentNode; listItem.remove();
                    if (ulElement && ulElement.children.length === 0) createEditableListItem(ulElement, ulElement.dataset.defaultText || "New item - edit here", true);
                }
            }
        });
    }

    // REMOVED Prev/Next button listeners

    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            if (currentRecordIndex < 0 || !csvData[currentRecordIndex]) { alert("Please select a record to download."); return; }
            captureCurrentEdits(); // Ensure latest edits are captured
            const element = document.querySelector('.a4-sheet');
            if (!element) { alert("Printable element .a4-sheet not found."); return; }
            const controlsContainer = document.querySelector('.controls-container');

            const shiftAmountPx = 0; const originalTransform = element.style.transform;
            if (controlsContainer) controlsContainer.style.display = 'none';
            if (boldTooltip) boldTooltip.style.display = 'none';

            const interactiveButtons = element.querySelectorAll('.remove-image-btn, .delete-list-item-btn, .remove-qr-btn, .add-list-item-btn');
            const btnOriginalDisplay = Array.from(interactiveButtons).map(btn => ({ el: btn, display: btn.style.display }));
            interactiveButtons.forEach(btn => btn.style.display = 'none');

            const editables = Array.from(element.querySelectorAll('[contenteditable="true"]'));
            editables.forEach(el => { el.setAttribute('data-was-editable', 'true'); el.removeAttribute('contenteditable'); });

            element.style.transform = `translateX(${shiftAmountPx}px)`;
            element.scrollLeft = 0; element.scrollTop = 0;

            const opt = {
                margin: [0, 0, 0, 0], filename: `${(csvData[currentRecordIndex].Title || 'Untitled').replace(/[^a-z0-9]/gi, '_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2, useCORS: true, logging: false, letterRendering: true, width: element.offsetWidth, height: element.scrollHeight, scrollX: 0, scrollY: 0,
                    onclone: (doc) => {
                        doc.querySelectorAll('[data-was-editable="true"]').forEach(el => { el.style.outline = 'none'; el.style.backgroundColor = ''; });
                        doc.querySelectorAll('.remove-image-btn, .delete-list-item-btn, .remove-qr-btn, .add-list-item-btn').forEach(btn => btn.style.display = 'none');
                    }
                },
                jsPDF: { unit: 'mm', format: [210, (element.scrollHeight * 25.4 / 96.0)], orientation: 'portrait' } // Dynamic height
            };
            const revertUI = () => {
                element.style.transform = originalTransform;
                if (controlsContainer) controlsContainer.style.display = '';
                btnOriginalDisplay.forEach(item => item.el.style.display = item.display);
                editables.forEach(el => { if (el.getAttribute('data-was-editable') === 'true') el.setAttribute('contenteditable', 'true'); el.removeAttribute('data-was-editable'); });
            };

            if (typeof html2pdf === 'function') {
                html2pdf().from(element).set(opt).save().then(revertUI).catch(err => { revertUI(); console.error("PDF err:", err); alert("PDF error: " + err.message); });
            } else { revertUI(); alert("html2pdf library not loaded."); }
        });
    }

    if (a4Sheet && boldTooltip && makeBoldButton) {
        a4Sheet.addEventListener('mouseup', (e) => {
            if (boldTooltip.contains(e.target) || (makeBoldButton && e.target === makeBoldButton)) return;
            const selection = window.getSelection();
            if (selection && selection.toString().trim() !== '') {
                let container = selection.anchorNode; let isEditableInSheet = false;
                if (container) {
                    let temp = (container.nodeType === Node.ELEMENT_NODE) ? container : container.parentNode;
                    while (temp && temp !== document.body && temp !== a4Sheet.parentNode) {
                        if (temp.isContentEditable && a4Sheet.contains(temp)) { isEditableInSheet = true; break; }
                        temp = temp.parentNode;
                    }
                }
                if (isEditableInSheet) {
                    const rect = selection.getRangeAt(0).getBoundingClientRect();
                    let top = rect.top + window.scrollY - boldTooltip.offsetHeight - 5;
                    if (top < window.scrollY) top = rect.bottom + window.scrollY + 5;
                    let left = rect.left + window.scrollX + (rect.width / 2) - (boldTooltip.offsetWidth / 2);
                    left = Math.max(window.scrollX + 5, Math.min(left, window.scrollX + window.innerWidth - boldTooltip.offsetWidth - 5));
                    boldTooltip.style.left = `${left}px`; boldTooltip.style.top = `${top}px`; boldTooltip.style.display = 'flex';
                } else { boldTooltip.style.display = 'none'; }
            } else { boldTooltip.style.display = 'none'; }
        });
        makeBoldButton.addEventListener('click', () => { document.execCommand('bold', false, null); boldTooltip.style.display = 'none'; });
        document.addEventListener('mousedown', (e) => {
            if (boldTooltip.style.display === 'flex' && !boldTooltip.contains(e.target)) {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed || sel.toString().trim() === '') boldTooltip.style.display = 'none';
            }
        });
        document.addEventListener('selectionchange', () => {
            const sel = window.getSelection();
            if (boldTooltip.style.display === 'flex' && (!sel || sel.isCollapsed || sel.toString().trim() === '')) boldTooltip.style.display = 'none';
        });
    }

    if (generateQrButton && qrLinkInput && qrCodeContainer) {
        generateQrButton.addEventListener('click', () => {
            if (currentRecordIndex < 0 || !csvData[currentRecordIndex]) { alert("Select a record first."); return; }
            const linkText = qrLinkInput.value.trim(); if (linkText === "") { alert("Enter link."); qrLinkInput.focus(); return; }
            captureCurrentEdits();
            const record = csvData[currentRecordIndex];
            let links = record.QRCodes ? record.QRCodes.split(';').map(s => s.trim()).filter(s => s) : [];
            if (links.includes(linkText)) { alert("Link exists."); qrLinkInput.select(); return; }
            links.push(linkText); record.QRCodes = links.join(';');
            displayRecord(currentRecordIndex); qrLinkInput.value = '';
        });
    } else { console.warn("Some QR elements missing (button, input, or container)."); }

    // --- Initial UI Setup ---
    displayRecord(-1); // Clear template, disable PDF button
    if (recordsTablePlaceholder) {
        recordsTablePlaceholder.textContent = "No data loaded. Upload a file to see records.";
        recordsTablePlaceholder.style.display = 'block';
    }
});