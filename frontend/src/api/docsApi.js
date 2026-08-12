import client from '../utils/client';

export const docsApi = {
  getDocuments: (params) =>
    client.get('/docs', { params }),

  getDocumentDetail: (docType, docEntry) =>
    client.get(`/docs/${docType}/${docEntry}`),

  semiPreparar: (docEntry, payload) =>
    client.post(`/semipreparar-stock/${docEntry}`, payload),

  finalizarPreparacion: (docEntry, payload) =>
    client.post(`/docs/finalizar-preparacion/${docEntry}`, payload),

  getAlbaranes: (params) =>
    client.get('/albaranes', { params }),

  getAlbaranDetail: (docEntry) =>
    client.get(`/albaranes/${docEntry}`),

  imprimirAlbaranPdf: (docEntry) =>
    client.post(`/albaranes/${docEntry}/imprimir`)
};

export default docsApi;
