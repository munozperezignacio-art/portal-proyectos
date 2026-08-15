let xlsxPromise;
let jsPdfPromise;
let mammothPromise;

export const loadSpreadsheetEngine = () => {
  xlsxPromise ||= import('xlsx');
  return xlsxPromise;
};

export const loadPdfEngine = async () => {
  jsPdfPromise ||= import('jspdf');
  const module = await jsPdfPromise;
  return module.jsPDF;
};

export const loadWordTextEngine = async () => {
  mammothPromise ||= import('mammoth/mammoth.browser');
  const module = await mammothPromise;
  return module.default || module;
};
