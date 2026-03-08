import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../context/useAuth';
import {
  getCollection,
  downloadQrCodes,
  downloadQrCodesSelected,
  getProxiedImageUrl,
} from '../services/api';
import type { CollectionRelease, QrCodeItem } from '../types';
import { Download, ExternalLink, CheckSquare, Square, ArrowUp, ArrowDown, Search, X } from 'lucide-react';

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
  const [search, setSearch] = useState('');

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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)] transition-colors border border-slate-200/50 dark:border-slate-700/50">
        {/* Header / Actions */}
        <div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">My Collection</h1>

          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={handleDownloadSelected}
              disabled={selectedCount === 0 || generating}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${selectedCount > 0
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-700/50 dark:text-slate-500 cursor-not-allowed'
                }`}
            >
              <Download size={18} />
              QR Selected ({selectedCount})
            </button>
            <button
              onClick={handleDownloadAll}
              disabled={generating}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <Download size={18} />
              QR All
            </button>
          </div>
        </div>

        {/* Controls & Pagination Top (Sticky with Glassmorphism) */}
        <div className="sticky top-0 z-20 p-4 md:px-6 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-xl flex flex-wrap justify-between items-center border-b border-slate-200/50 dark:border-slate-700/50 text-sm transition-colors shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={toggleSelectAllPage}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium transition-colors"
            >
              {isAllPageSelected ? (
                <CheckSquare className="text-indigo-600 dark:text-indigo-400" size={20} />
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${showPlayedOnly
                ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800/50 text-indigo-800 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm'
                }`}
            >
              <span className="font-semibold">Played Only</span>
              {showPlayedOnly && (
                <span className="text-[10px] font-bold bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded-full">ON</span>
              )}
            </button>

            <div className="relative group flex-1 min-w-[12rem] sm:max-w-xs md:ml-4">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors"
                size={16}
              />
              <input
                type="text"
                placeholder="Search artist or title..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 pr-8 py-1.5 border border-slate-200 dark:border-slate-700/60 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 backdrop-blur-sm"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 border-l pl-4 ml-2 border-slate-200 dark:border-slate-700/60 w-full sm:w-auto mt-3 sm:mt-0 justify-between sm:justify-start">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Sort by:</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="border border-slate-200 dark:border-slate-700/60 rounded-xl py-1.5 px-3 bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 shadow-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none backdrop-blur-sm cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
              >
                <option value="artist">Band Name</option>
                <option value="listens">Listens</option>
              </select>
              <button
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-sm transition-colors"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 lg:mt-0">
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-200 dark:border-slate-700/60 rounded-xl py-1.5 px-3 bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 shadow-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none backdrop-blur-sm cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 hidden sm:block"
            >
              <option value={20}>20 / page</option>
              <option value={30}>30 / page</option>
              <option value={40}>40 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 (Max)</option>
            </select>
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 px-2.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-700 bg-transparent text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors shadow-sm"
              >
                &lt;
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 px-2.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-700 bg-transparent text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors shadow-sm"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 dark:bg-slate-900/20">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 md:gap-8">
              {[...Array(perPage || 20)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col gap-3 shadow-sm animate-pulse">
                  {/* Skeleton Cover */}
                  <div className="w-full aspect-square bg-slate-200 dark:bg-slate-700/50 rounded-xl"></div>

                  {/* Skeleton Text */}
                  <div className="flex-1 flex flex-col pt-1 gap-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded-md w-3/4"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded-md w-1/2"></div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded-md w-2/5"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 md:gap-8">
              {releases.map((release, index) => {
                const isSelected = selectedItems.has(release.id);
                const artist = release.basic_information.artists?.[0]?.name || 'Unknown';

                return (
                  <div
                    key={release.id}
                    className={`relative group bg-white dark:bg-slate-800 border rounded-2xl p-4 flex flex-col gap-3 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer animate-slide-up ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700/60 shadow-sm'}`}
                    style={{ animationDelay: `${(index % 12) * 50}ms`, opacity: 0 }}
                    onClick={() => toggleSelection(release)}
                  >
                    {/* Listen Count Badge (Top-Right) */}
                    <div className="absolute top-3 right-3 z-10 bg-slate-900/80 dark:bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm border border-white/10 font-medium">
                      {release.listen_count || 0} plays
                    </div>

                    {/* Selection Checkbox Overlay (Bottom-Right of Image) */}
                    <div className="absolute top-3 left-3 z-10 transition-transform hover:scale-105">
                      {isSelected ? (
                        <CheckSquare
                          className="text-indigo-500 dark:text-indigo-400 fill-white dark:fill-slate-900 drop-shadow-md"
                          size={24}
                        />
                      ) : (
                        <Square
                          className="text-white drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                          size={24}
                        />
                      )}
                    </div>

                    {/* Cover */}
                    <div className="w-full aspect-square bg-slate-100 dark:bg-slate-700/50 rounded-xl overflow-hidden relative shadow-inner">
                      {release.basic_information.thumb ? (
                        <img
                          src={getProxiedImageUrl(release.basic_information.thumb)}
                          alt="cover"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium gap-2">
                          <span className="text-4xl opacity-50 grayscale">💿</span>
                          No Cover
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col pt-1">
                      <h3
                        className="font-bold text-slate-900 dark:text-slate-100 truncate text-base leading-tight mb-1"
                        title={release.basic_information.title}
                      >
                        {release.basic_information.title}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate font-medium">{artist}</p>

                      <a
                        href={`https://www.discogs.com/release/${release.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 text-xs font-semibold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1.5 w-full z-20 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View on Discogs <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && releases.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center mt-8 max-w-md mx-auto animate-fade-in">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400 dark:text-slate-500 shadow-inner">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                {search ? 'No matches found' : 'Your collection is empty'}
              </h3>
              <p className="text-base text-slate-500 dark:text-slate-400">
                {search
                  ? `We couldn't find any records matching "${search}". Try adjusting your filters.`
                  : 'It looks like you haven\'t synced your Discogs collection yet, or there are no records.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Collection;
