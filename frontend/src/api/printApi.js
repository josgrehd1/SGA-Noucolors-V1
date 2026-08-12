import client from '../utils/client';

export const printApi = {
  getPrinters: () =>
    client.get('/print/printers'),

  printProduct: (payload) =>
    client.post('/print/product', payload),

  printBin: (payload) =>
    client.post('/print/bin', payload),

  printBultos: (payload) =>
    client.post('/print/bultos', payload)
};

export default printApi;
