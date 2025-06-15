const XLSX = require("xlsx");
const fs = require("fs");

const inputFilePath = "tech_data_2.xlsx";
const outputCsvFilePath = "tech_final.csv";

const allOriginalColumnHeadersInOrder = [
  "Timestamp",
  "FullName",
  "Organization",
  "Email",
  "Title",
  "Description",
  "Genre",
  "Theme",
  "Domain",
  "PatentStatus",
  "TRLLevel",
  "ConceptObserved",
  "ProofOfConcept",
  "PrototypeDeveloped",
  "PrototypeTestedLab",
  "TestedRealWorld",
  "WorksAsIntended",
  "IntegratedWithSystems",
  "UsedByEndUsers",
  "SafetyAssessments",
  "ScalingPlans",
  "Innovators",
  "Overview",
  "DetailedDescription",
  "Advantages",
  "Applications",
  "UseCases",
  "RelatedLinks",
  "TechnicalSpecifications",
  `Images
I   nstructions:
    You may either upload image files or provide direct URLs that visually represent the technology.
    Uploading Files:
    Upload one or more clear and high-quality images that best illustrate the innovation, its components, or its application.`,
];

const desiredOutputHeaders = [
  "Title",
  "Theme",
  "Domain",
  "PatentStatus",
  "TRLLevel",
  "Innovators",
  "DetailedDescription",
  "Advantages",
  "Applications",
  "UseCases",
  "RelatedLinks",
  "TechnicalSpecifications",
  "Images",
];

const columnsToReformatForMultiItems = [
  "Theme",
  "Domain",
  "Innovators",
  "Advantages",
  "Applications",
  "UseCases",
  "RelatedLinks",
  "TechnicalSpecifications",
  "Images",
];

const dataInColumnsToForceQuote = [
  "Theme",
  "Domain",
  "Innovators",
  "Advantages",
  "Applications",
  "UseCases",
  "RelatedLinks",
  "Images",
  "TechnicalSpecifications",
];

/**
 * @param {any} cellValue - The value from the cell.
 * @param {string} currentHeader - The header name of the current column.
 * @returns {string} - The transformed string.
 */
function formatMultiItemCell(cellValue, currentHeader) {
  if (
    cellValue === null ||
    typeof cellValue === "undefined" ||
    String(cellValue).trim() === ""
  ) {
    return "";
  }
  const s = String(cellValue).replace(/\r\n/g, "\n");

  if (currentHeader.trim().startsWith("Images")) {
    const urlArray = s.split(",");
    const directLinks = urlArray
      .map((url) => {
        url = url.trim();
        if (!url) return null;

        const regex = /(?:open\?id=|\/d\/)([a-zA-Z0-9_-]{25,})/;
        const match = url.match(regex);
        const fileId = match ? match[1] : null;

        if (fileId) {
          return `https://drive.google.com/uc?export=view&id=${fileId}`;
        }
        if (url.startsWith("http")) {
          return url;
        }
        return null;
      })
      .filter((link) => link !== null);
    return directLinks.join(" ; ");
  }

  let items;
  if (s.includes(";")) {
    items = s
      .split(";")
      .map((item) => item.replace(/\n/g, " ").trim())
      .filter(Boolean);
  } else {
    items = s
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (currentHeader === "RelatedLinks") {
    const urls = items
      .map((item) => (item.match(/https?:\/\/[^\s]+/gi) || [null])[0])
      .filter(Boolean);
    return urls.join(" ; ");
  }

  return items.join(" ; ");
}

function manuallyGenerateCsvString(
  aoa,
  dataHeadersToForceQuote,
  allHeadersInOutputOrder
) {
  return aoa
    .map((rowArray, rowIndex) => {
      return rowArray
        .map((cellValue, colIndex) => {
          let cellString =
            cellValue === null || typeof cellValue === "undefined"
              ? ""
              : String(cellValue);
          // Match based on the start of the header name for flexibility
          const headerNameForCurrentColumn = allHeadersInOutputOrder[colIndex]
            .trim()
            .split("\n")[0];
          const desiredHeaderToCompare = desiredOutputHeaders.find(
            (h) => h.trim().split("\n")[0] === headerNameForCurrentColumn
          );

          let applyForcedQuoting =
            rowIndex > 0 &&
            dataHeadersToForceQuote.includes(desiredHeaderToCompare);
          let applyStandardQuoting =
            cellString.includes(",") ||
            cellString.includes("\n") ||
            cellString.includes('"');

          if (applyForcedQuoting || applyStandardQuoting) {
            return `"${cellString.replace(/"/g, '""')}"`;
          }

          return cellString;
        })
        .join(",");
    })
    .join("\n");
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
    const allDataAoa = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    if (allDataAoa.length === 0) {
      console.error("Error: The sheet is empty.");
      return;
    }

    const originalExcelHeaders = allDataAoa[0].map((h) => h.trim());

    const selectedColumnIndices = desiredOutputHeaders.map((desiredHeader) => {
      const headerToFind = desiredHeader.trim().split("\n")[0]; 
      const index = originalExcelHeaders.findIndex((h) =>
        h.trim().startsWith(headerToFind)
      );

      if (index === -1) {
        const fallbackIndex = allOriginalColumnHeadersInOrder.findIndex((h) =>
          h.trim().startsWith(headerToFind)
        );
        if (fallbackIndex === -1) {
          throw new Error(
            `Configuration error: Header starting with "${headerToFind}" not found.`
          );
        }
        return fallbackIndex;
      }
      return index;
    });

    const dataRows = allDataAoa.slice(1);
    const processedAndFilteredRows = dataRows.map((originalRow) => {
      const newSelectedRow = [];
      selectedColumnIndices.forEach((originalColIndex, i) => {
        let cellValue =
          originalColIndex < originalRow.length
            ? originalRow[originalColIndex]
            : "";
        const currentDesiredHeader = desiredOutputHeaders[i];

        if (columnsToReformatForMultiItems.includes(currentDesiredHeader)) {
          cellValue = formatMultiItemCell(cellValue, currentDesiredHeader);
        }
        newSelectedRow.push(cellValue);
      });
      return newSelectedRow;
    });

    const outputAoa = [
      desiredOutputHeaders.map((h) => h.split("\n")[0]),
      ...processedAndFilteredRows,
    ];

    const csvOutputString = manuallyGenerateCsvString(
      outputAoa,
      dataInColumnsToForceQuote,
      desiredOutputHeaders.map((h) => h.split("\n")[0])
    );

    fs.writeFileSync(outputCsvFilePath, csvOutputString);
    console.log(
      `Successfully selected, formatted, and saved data. Output: ${outputCsvFilePath}`
    );
  } catch (error) {
    console.error("An error occurred during the process:", error);
    console.error(error.stack);
  }
}

selectAndFormatExcelData();
