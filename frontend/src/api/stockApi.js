import client from '../utils/client';

export const stockApi = {
  getStock: (params) =>
    client.get('/stock', { params }),

  getItemNecesidades: (itemCode) =>
    client.get(`/stock/${encodeURIComponent(itemCode)}/necesidades`),

  searchBins: (term) =>
    client.get('/search/bins', { params: { term } }),

  searchItems: (term) =>
    client.get('/search/items', { params: { term } }),

  trasladarStock: (payload) =>
    client.post('/stock/traslado', payload),

  contabilizarInventario: (payload) =>
    client.post('/stock/inventario', payload)
};

export default stockApi;
