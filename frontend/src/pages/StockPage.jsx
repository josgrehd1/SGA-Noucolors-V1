import React, { useState, useEffect } from 'react';
import { Typography, Pagination, message } from 'antd';
import client from '../utils/client';
import { useSocket } from '../context/SocketContext';
import { StockSearchBar } from '../components/stock/StockSearchBar';
import { StockCardGrid } from '../components/stock/StockCardGrid';
import { StockDetailModal } from '../components/stock/StockDetailModal';
import { PrintLabelModal } from '../components/stock/PrintLabelModal';

const { Title } = Typography;

export const StockPage = () => {
  const { socket } = useSocket();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [detailActiveTab, setDetailActiveTab] = useState('ubis');
  const [selectedPrintItem, setSelectedPrintItem] = useState(null);

  const [filters, setFilters] = useState({
    itemcode: '',
    ubicacion: '',
    con_stock: false
  });

  useEffect(() => {
    fetchStock(1, filters);
  }, []);

  // Suscripción a WebSockets en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleSapUpdate = (data) => {
      fetchStock(page, filters, true);
    };

    socket.on('sap_update', handleSapUpdate);
    return () => {
      socket.off('sap_update', handleSapUpdate);
    };
  }, [socket, page, filters]);

  const fetchStock = async (targetPage = 1, currentFilters = filters, isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params = {
        page: targetPage,
        per_page: 20,
        itemcode: currentFilters.itemcode,
        ubicacion: currentFilters.ubicacion,
        con_stock: currentFilters.con_stock ? 'true' : ''
      };
      const res = await client.get('/stock', { params });
      if (res.status === 'ok') {
        setItems(res.productos || []);
        setTotalCount(res.total_count || 0);
        setPage(targetPage);
      } else if (!isSilent) {
        message.error(res.message || 'Error consultando stock');
      }
    } catch (err) {
      if (!isSilent) {
        message.error(err.message || 'Error cargando productos desde SAP');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleSearch = (formikValues) => {
    setFilters(formikValues);
    fetchStock(1, formikValues);
  };

  const handleReset = () => {
    const emptyFilters = { itemcode: '', ubicacion: '', con_stock: false };
    setFilters(emptyFilters);
    fetchStock(1, emptyFilters);
  };

  const handleOpenDetail = (item, tab = 'ubis') => {
    setSelectedDetailItem(item);
    setDetailActiveTab(tab);
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 20, fontWeight: 700, color: '#212529' }}>
        Consulta de Stock
      </Title>

      <StockSearchBar
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      <StockCardGrid
        items={items}
        loading={loading}
        onOpenDetail={handleOpenDetail}
        onOpenPrint={(item) => setSelectedPrintItem(item)}
      />

      {totalCount > 20 && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Pagination
            current={page}
            total={totalCount}
            pageSize={20}
            onChange={(p) => fetchStock(p, filters)}
            showSizeChanger={false}
          />
        </div>
      )}

      <StockDetailModal
        open={!!selectedDetailItem}
        item={selectedDetailItem}
        activeTab={detailActiveTab}
        onClose={() => setSelectedDetailItem(null)}
      />

      <PrintLabelModal
        open={!!selectedPrintItem}
        item={selectedPrintItem}
        onClose={() => setSelectedPrintItem(null)}
      />
    </div>
  );
};
