import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../context/AuthContext';
import { getCollection, downloadQrCodes, downloadQrCodesSelected, getProxiedImageUrl } from '../services/api';
import type { CollectionRelease, QrCodeItem } from '../types';
import { Download, ExternalLink, CheckSquare, Square, ArrowUp, ArrowDown } from 'lucide-react';

const Collection: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Pagination State
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [releases, setReleases] = useState<CollectionRelease[]>([]);

  // Loading State
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Persistent Selection State: Store map of ID -> QrCodeItem to keep track of details
  const [selectedItems, setSelectedItems] = useState<Map<number, QrCodeItem>>(new Map());

  const handleScan = () => {
    navigate('/', { state: { scan: true } });
  };

  // Filter State
  const [showPlayedOnly, setShowPlayedOnly] = useState(false);

  // Sort State
  const [sort, setSort] = useState('artist');
  const [sortOrder, setSortOrder] = useState('asc');

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const minPlays = showPlayedOnly ? 1 : 0;
        const data = await getCollection(user.username, page, perPage, minPlays, sort, sortOrder);
        setReleases(data.releases);
        if (data.pagination) {
          setTotalPages(data.pagination.pages);
        }
      } catch (error) {
        console.error('Failed to fetch collection', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, page, perPage, showPlayedOnly, sort, sortOrder]);

  // Selection Logic
  const toggleSelection = (release: CollectionRelease) => {
    const id = release.id;
    setSelectedItems((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(id)) {
        newMap.delete(id);
      } else {
        const artist =
          release.basic_information.artists.length > 0
            ? release.basic_information.artists[0].name
            : 'Unknown Artist';
        newMap.set(id, {
          id: release.id,
          title: release.basic_information.title,
          artist: artist,
        });
      }
      return newMap;
    });
  };

  const toggleSelectAllPage = () => {
    const allSelected = releases.every((r) => selectedItems.has(r.id));

    setSelectedItems((prev) => {
      const newMap = new Map(prev);
      if (allSelected) {
        releases.forEach((r) => newMap.delete(r.id));
      } else {
        releases.forEach((r) => {
          const artist =
            r.basic_information.artists.length > 0
              ? r.basic_information.artists[0].name
              : 'Unknown Artist';
          newMap.set(r.id, {
            id: r.id,
            title: r.basic_information.title,
            artist: artist,
          });
        });
      }
      return newMap;
    });
  };

  // Derived Selection State for UI
  const isAllPageSelected = releases.length > 0 && releases.every((r) => selectedItems.has(r.id));
  const selectedCount = selectedItems.size;

  // QR Code Generation
  const handleDownloadSelected = async () => {
    if (selectedCount === 0) return;
    setGenerating(true);
    try {
      const items = Array.from(selectedItems.values());
      const blob = await downloadQrCodesSelected(items);
      downloadBlob(blob, 'selected_qr_codes.pdf');
    } catch (e) {
      console.error(e);
      alert('Failed to generate QR codes.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!user) return;
    if (!window.confirm('Generate QR codes for your ENTIRE collection? This may take a while.'))
      return;
    setGenerating(true);
    try {
      const blob = await downloadQrCodes(user.username);
      downloadBlob(blob, 'collection_qr_codes.pdf');
    } catch (e) {
      console.error(e);
      alert('Failed to generate QR codes.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Layout onScanClick={handleScan}>
      <div className="bg-white rounded-xl shadow-sm flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)]">
        {/* Header / Actions */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold">My Collection</h1>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={handleDownloadSelected}
              disabled={selectedCount === 0 || generating}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCount > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              <Download size={16} />
              QR Selected ({selectedCount})
            </button>
            <button
              onClick={handleDownloadAll}
              disabled={generating}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              <Download size={16} />
              QR All
            </button>
          </div>
        </div>

        {/* Controls & Pagination Top */}
        <div className="p-4 bg-gray-50 flex flex-wrap justify-between items-center border-b border-gray-100 text-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={toggleSelectAllPage}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              {isAllPageSelected ? (
                <CheckSquare className="text-blue-600" size={20} />
              ) : (
                <Square size={20} />
              )}
              Select Page
            </button>

            <button
              onClick={() => {
                setShowPlayedOnly(!showPlayedOnly);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${showPlayedOnly
                  ? 'bg-blue-100 border-blue-200 text-blue-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
              <span className="font-medium">Played Only</span>
              {showPlayedOnly && (
                <span className="text-xs bg-blue-200 px-1.5 rounded-full">ON</span>
              )}
            </button>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 border-l pl-4 ml-2 border-gray-200">
              <span className="text-gray-500 hidden sm:inline">Sort by:</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded p-1.5 bg-white"
              >
                <option value="artist">Band Name</option>
                <option value="listens">Listens</option>
              </select>
              <button
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="p-2 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-600"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="border border-gray-300 rounded p-1"
            >
              <option value={20}>20 / page</option>
              <option value={30}>30 / page</option>
              <option value={40}>40 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 (Max)</option>
            </select>
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 px-2 border rounded hover:bg-white disabled:opacity-50"
              >
                &lt;
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 px-2 border rounded hover:bg-white disabled:opacity-50"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-full text-gray-400">
              Loading collection...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {releases.map((release) => {
                const isSelected = selectedItems.has(release.id);
                const artist = release.basic_information.artists?.[0]?.name || 'Unknown';

                return (
                  <div
                    key={release.id}
                    className={`relative group bg-white border rounded-xl p-4 flex gap-4 transition-all hover:shadow-md ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    onClick={() => toggleSelection(release)}
                  >
                    {/* Listen Count Badge (Top-Right) */}
                    <div className="absolute top-3 right-3 z-10 bg-gray-900/80 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                      {release.listen_count || 0} plays
                    </div>

                    {/* Selection Checkbox Overlay (Bottom-Right) */}
                    <div className="absolute bottom-3 right-3 z-10">
                      {isSelected ? (
                        <CheckSquare
                          className="text-blue-600 fill-white bg-white rounded"
                          size={24}
                        />
                      ) : (
                        <Square
                          className="text-gray-300 group-hover:text-gray-400 bg-white/80 rounded"
                          size={24}
                        />
                      )}
                    </div>

                    {/* Cover */}
                    <div className="w-20 h-20 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden">
                      {release.basic_information.thumb ? (
                        <img
                          src={getProxiedImageUrl(release.basic_information.thumb)}
                          alt="cover"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          No Cover
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center pr-20">
                      <h3
                        className="font-bold text-gray-900 truncate"
                        title={release.basic_information.title}
                      >
                        {release.basic_information.title}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">{artist}</p>

                      {/* Open in Discogs Link (stops selection toggle) */}
                      <a
                        href={`https://www.discogs.com/release/${release.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 text-xs text-blue-500 hover:underline flex items-center gap-1 w-fit z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View on Discogs <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && releases.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              No records found in your collection yet.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Collection;
