const XLSX = require('xlsx');
const fs = require('fs');

// --- Configuration ---
const inputFilePath = "tech_data_2.xlsx";
const outputCsvFilePath = "tech_final.csv"; 

const allOriginalColumnHeadersInOrder = [
    "Timestamp", "FullName", "Organization", "Email", "Title",
    "Description", "Genre", "Theme", "Domain", "PatentStatus",
    "TRLLevel", "ConceptObserved", "ProofOfConcept", "PrototypeDeveloped",
    "PrototypeTestedLab", "TestedRealWorld", "WorksAsIntended",
    "IntegratedWithSystems", "UsedByEndUsers", "SafetyAssessments",
    "ScalingPlans", "Innovators", "Overview", "DetailedDescription",
    "Advantages", "Applications", "UseCases", "RelatedLinks",
    "TechnicalSpecifications", "Images"
];

const desiredOutputHeaders = [
    "Title", "Theme", "Domain", "PatentStatus", "TRLLevel", "Innovators",
    "DetailedDescription", "Advantages", "Applications", "UseCases",
    "RelatedLinks", "TechnicalSpecifications", "Images"
];

// "RelatedLinks" remains in this list as it needs special multi-item processing.
// "Images" is correctly excluded from this list as per your previous request.
const columnsToReformatForMultiItems = [
    "Theme", "Domain", "Innovators", "Advantages", "Applications",
    "UseCases", "RelatedLinks", "TechnicalSpecifications" 
];

const dataInColumnsToForceQuote = [
    "Theme", "Domain", "Innovators", "Advantages", "Applications",
    "UseCases", "RelatedLinks", "Images", "TechnicalSpecifications"
];

/**
 * Revised function to format multi-item cells.
 * Handles "RelatedLinks" as a special case to extract only URLs.
 * @param {any} cellValue - The value from the cell.
 * @param {string} currentHeader - The header name of the current column being processed.
 * @returns {string} - The transformed string.
 */
function formatMultiItemCell(cellValue, currentHeader) {
    if (cellValue === null || typeof cellValue === 'undefined' || String(cellValue).trim() === '') {
        return '';
    }
    let s = String(cellValue);
    s = s.replace(/\r\n/g, '\n'); // Normalize line endings

    let items;
    // Split into potential items first
    if (s.includes(';')) {
        items = s.split(';')
                 .map(item => item.replace(/\n/g, ' ').trim()) 
                 .filter(item => item.length > 0);
    } else {
        items = s.split('\n')
                 .map(item => item.trim())
                 .filter(item => item.length > 0);
    }
    
    // Special handling for "RelatedLinks" to extract only URLs
    if (currentHeader === "RelatedLinks") {
        const urls = items.map(item => {
            // Regex to find URLs (http, https)
            const urlMatch = item.match(/https?:\/\/[^\s]+/gi);
            return urlMatch ? urlMatch[0] : null; // Take the first URL found in the item
        }).filter(url => url !== null); // Filter out items where no URL was found
        return urls.join(' ; ');
    } else {
        // For other multi-item columns, join items as before
        return items.join(' ; ');
    }
}

function manuallyGenerateCsvString(aoa, dataHeadersToForceQuote, allHeadersInOutputOrder) {
    return aoa.map((rowArray, rowIndex) => {
        return rowArray.map((cellValue, colIndex) => {
            let cellString = (cellValue === null || typeof cellValue === 'undefined') ? '' : String(cellValue);
            const headerNameForCurrentColumn = allHeadersInOutputOrder[colIndex];

            let applyForcedQuoting = false;
            let applyStandardQuoting = false;

            if (rowIndex > 0) { // This is a data row
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

function selectAndFormatExcelData() {
    console.log(`Attempting to read Excel file: ${inputFilePath}`);

    try {
        if (!fs.existsSync(inputFilePath)) {
            console.error(`Error: The input file "${inputFilePath}" was not found.`);
            return;
        }

        const workbook = XLSX.readFile(inputFilePath);
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
            console.error("Error: The workbook has no sheets.");
            return;
        }
        console.log(`Reading data from sheet: "${firstSheetName}"`);
        const worksheet = workbook.Sheets[firstSheetName];
        const allDataAoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (allDataAoa.length === 0) {
            console.error("Error: The sheet is empty.");
            return;
        }
        
        const originalExcelHeaders = allDataAoa[0];
        if (originalExcelHeaders.length !== allOriginalColumnHeadersInOrder.length) {
            console.warn(
                `Warning: Excel file has ${originalExcelHeaders.length} columns, ` +
                `'allOriginalColumnHeadersInOrder' has ${allOriginalColumnHeadersInOrder.length}. ` +
                `Verify 'allOriginalColumnHeadersInOrder'.`
            );
        }

        const selectedColumnIndices = desiredOutputHeaders.map(desiredHeader => {
            const index = allOriginalColumnHeadersInOrder.indexOf(desiredHeader);
            if (index === -1) {
                throw new Error(`Configuration error: Header "${desiredHeader}" not found in 'allOriginalColumnHeadersInOrder'.`);
            }
            return index;
        });
        
        const dataRows = allDataAoa.slice(1);
        const processedAndFilteredRows = dataRows.map(originalRow => {
            const newSelectedRow = [];
            selectedColumnIndices.forEach((originalColIndex, i) => {
                let cellValue = (originalColIndex < originalRow.length) ? originalRow[originalColIndex] : '';
                const currentDesiredHeader = desiredOutputHeaders[i];
                
                // Pass currentDesiredHeader to formatMultiItemCell
                if (columnsToReformatForMultiItems.includes(currentDesiredHeader)) {
                    cellValue = formatMultiItemCell(cellValue, currentDesiredHeader);
                }
                newSelectedRow.push(cellValue);
            });
            return newSelectedRow;
        });

        const outputAoa = [desiredOutputHeaders, ...processedAndFilteredRows];
        
        const csvOutputString = manuallyGenerateCsvString(outputAoa, dataInColumnsToForceQuote, desiredOutputHeaders);

        fs.writeFileSync(outputCsvFilePath, csvOutputString);
        console.log(`Successfully selected, formatted, and saved data. Output: ${outputCsvFilePath}`);

    } catch (error) {
        console.error("An error occurred during the process:");
        console.error(error.message);
    }
}

selectAndFormatExcelData();