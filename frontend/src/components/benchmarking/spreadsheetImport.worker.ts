import { decodeSpreadsheet } from './spreadsheetImport';
self.onmessage = (event: MessageEvent<{ name: string; data: ArrayBuffer }>) => {
  try {
    self.postMessage({ workbook: decodeSpreadsheet(event.data.name, event.data.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unable to read spreadsheet.' });
  }
};
