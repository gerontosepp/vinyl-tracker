import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/ToastContext';
import {
  getCollection,
  downloadQrCodes,
  downloadQrCodesSelected,
  getProxiedImageUrl,
} from '../services/api';
import type { CollectionRelease, QrCodeItem } from '../types';
import {
  Download,
  ExternalLink,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
  Search,
  X,
} from 'lucide-react';
import { getErrorMessage } from '../utils/error';
 
const isCanceledRequest = (error: unknown): boolean => {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_CANCELED')
  );
};
 
const Collection: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadStatus, setLoadStatus] = useState('');
 
  // Persistent Selection State: Store map of ID -> QrCodeItem to keep track of details
  const [selectedItems, setSelectedItems] = useState<Map<number, QrCodeItem>>(new Map());
 
  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (search !== debouncedSearch) {
        setDebouncedSearch(search);
        setPage(1); // Reset page to 1 on new search
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [search, debouncedSearch]);
 
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
    const controller = new AbortController();
 
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const minPlays = showPlayedOnly ? 1 : 0;
        const data = await getCollection(
          user.username,
          page,
          perPage,
          minPlays,
          sort,
          sortOrder,
          debouncedSearch,
          { signal: controller.signal }
        );
        setReleases(data.releases);
        if (data.pagination) {
          setTotalPages(data.pagination.pages);
          const loadedAt = new Intl.DateTimeFormat('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date());
          setLoadStatus(`${data.pagination.items} entries • ${loadedAt}`);
        } else {
          const loadedAt = new Intl.DateTimeFormat('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date());
          setLoadStatus(`${data.releases.length} entries • ${loadedAt}`);
        }
      } catch (error: unknown) {
        if (isCanceledRequest(error)) {
          return;
        }
        const message = getErrorMessage(error, 'Failed to fetch collection');
        showToast(message, 'error');
        setLoadStatus('Error loading');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    fetchData();
 
    return () => {
      controller.abort();
    };
  }, [user, page, perPage, showPlayedOnly, sort, sortOrder, debouncedSearch, showToast]);
 
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
  const isAllPageSelected = useMemo(
    () => releases.length > 0 && releases.every((r) => selectedItems.has(r.id)),
    [releases, selectedItems]
  );
  const selectedCount = useMemo(() => selectedItems.size, [selectedItems]);
 
  // QR Code Generation
  const handleDownloadSelected = async () => {
    if (selectedCount === 0) return;
    setGenerating(true);
    try {
      const items = Array.from(selectedItems.values());
      const blob = await downloadQrCodesSelected(items);
      downloadBlob(blob, 'selected_qr_codes.pdf');
      showToast('QR codes generated successfully', 'success');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to generate QR codes.');
      showToast(message, 'error');
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
      showToast('QR codes generated successfully', 'success');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to generate QR codes.');
      showToast(message, 'error');
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)] transition-colors border border-slate-200/50 dark:border-slate-600">
        {/* Header / Actions */}
        <div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-600 flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            My Collection
          </h1>
 
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={handleDownloadSelected}
              disabled={selectedCount === 0 || generating}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                selectedCount > 0
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
        <div className="sticky top-0 z-20 p-4 md:px-6 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-xl flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 border-b border-slate-200/50 dark:border-slate-600 text-sm transition-colors shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            {/* Search Bar - Full width on very small screens */}
            <div className="relative group w-full sm:w-64 order-1 sm:order-none shrink-0">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors"
                size={16}
              />
              <input
                type="text"
                placeholder="Search collection..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 pr-8 py-1.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 backdrop-blur-sm"
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
 
            {/* Filter Buttons & Sort - Scroll horizontally on small screens */}
            <div className="flex items-center gap-3 order-2 sm:order-none overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full sm:w-auto">
              <button
                onClick={toggleSelectAllPage}
                className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium transition-colors shrink-0"
              >
                {isAllPageSelected ? (
                  <CheckSquare className="text-indigo-600 dark:text-indigo-400" size={18} />
                ) : (
                  <Square size={18} />
                )}
                <span className="whitespace-nowrap">Select Page</span>
              </button>
 
              <button
                onClick={() => {
                  setShowPlayedOnly(!showPlayedOnly);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 shrink-0 ${
                  showPlayedOnly
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800/50 text-indigo-800 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm'
                }`}
              >
                <span className="font-semibold whitespace-nowrap">Played Only</span>
                {showPlayedOnly && (
                  <span className="text-[10px] font-bold bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded-full">
                    ON
                  </span>
                )}
              </button>
 
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mr-1 ml-1" />
 
              {/* Sort Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                  Sort:
                </span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                  className="border border-slate-200 dark:border-slate-600 rounded-xl py-1.5 px-2.5 bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 shadow-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none backdrop-blur-sm cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                >
                  <option value="artist">Band Name</option>
                  <option value="listens">Listens</option>
                </select>
                <button
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-sm transition-colors"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                </button>
              </div>
            </div>
          </div>
 
          <div className="flex items-center justify-between xl:justify-end gap-4 w-full xl:w-auto shrink-0 order-3 border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-200 dark:border-slate-600 mt-1 xl:mt-0">
            {!loading && loadStatus && (
              <div
                className={`hidden 2xl:inline-flex items-center gap-2 text-xs font-medium max-w-[18rem] truncate ${
                  loadStatus.includes('Error')
                    ? 'text-red-600 dark:text-red-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
                role="status"
                aria-live="polite"
                title={`Discogs-Status: ${loadStatus}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    loadStatus.includes('Error')
                      ? 'bg-red-500 dark:bg-red-400'
                      : 'bg-emerald-500 dark:bg-emerald-400'
                  }`}
                />
                <span className="truncate">Discogs: {loadStatus}</span>
              </div>
            )}
 
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-200 dark:border-slate-600 rounded-xl py-1.5 px-3 bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 shadow-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none backdrop-blur-sm cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 hidden sm:block"
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 dark:bg-slate-900/20 relative">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 md:gap-8">
              {[...Array(perPage || 20)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl p-4 flex flex-col gap-3 shadow-sm animate-pulse"
                >
                  <div className="w-full aspect-square bg-slate-200 dark:bg-slate-700/50 rounded-xl"></div>
                  <div className="flex-1 flex flex-col pt-1 gap-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded-md w-3/4"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded-md w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* --- DESKTOP DATA GRID --- */}
              <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-600 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-4 w-12 text-center">
                        <button
                          onClick={toggleSelectAllPage}
                          className="hover:text-indigo-500 transition-colors"
                        >
                          {isAllPageSelected ? (
                            <CheckSquare size={16} className="text-indigo-500" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-4 w-16">Cover</th>
                      <th className="px-4 py-4">Band Name</th>
                      <th className="px-4 py-4">Album Title</th>
                      <th className="px-4 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                        Year
                      </th>
                      <th className="px-4 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                        Plays
                      </th>
                      <th className="px-4 py-4 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {releases.map((release) => {
                      const isSelected = selectedItems.has(release.id);
                      const artist = release.basic_information.artists?.[0]?.name || 'Unknown';
                      return (
                        <tr
                          key={release.id}
                          onClick={() => toggleSelection(release)}
                          className={`group transition-all duration-200 cursor-pointer ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                        >
                          <td className="px-4 py-3 text-center">
                            {isSelected ? (
                              <CheckSquare
                                className="text-indigo-500 dark:text-indigo-400 mx-auto"
                                size={18}
                              />
                            ) : (
                              <Square
                                className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 mx-auto transition-colors"
                                size={18}
                              />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-button">
                              {release.basic_information.thumb ? (
                                <img
                                  src={getProxiedImageUrl(release.basic_information.thumb)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs opacity-50">
                                  💿
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                            {artist}
                          </td>
                          <td
                            className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[200px]"
                            title={release.basic_information.title}
                          >
                            {release.basic_information.title}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">
                            {release.basic_information.year || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
                              {release.listen_count || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={`https://www.discogs.com/release/${release.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all inline-flex"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={16} />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
 
              {/* --- MOBILE CARDS (Hidden on >=md) --- */}
              <div className="grid md:hidden grid-cols-2 gap-4 pb-4">
                {releases.map((release, index) => {
                  const isSelected = selectedItems.has(release.id);
                  const artist = release.basic_information.artists?.[0]?.name || 'Unknown';
 
                  return (
                    <div
                      key={release.id}
                      className={`relative group bg-white dark:bg-slate-800 border rounded-2xl p-3 flex flex-col gap-2 transition-all duration-300 shadow-sm cursor-pointer animate-slide-up ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-600'}`}
                      style={{ animationDelay: `${(index % 12) * 50}ms`, opacity: 0 }}
                      onClick={() => toggleSelection(release)}
                    >
                      <div className="absolute top-2 right-2 z-10 bg-slate-900/80 dark:bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md font-bold shadow-sm">
                        {release.listen_count || 0} plays
                      </div>
 
                      <div className="absolute top-2 left-2 z-10 transition-transform hover:scale-105">
                        {isSelected ? (
                          <CheckSquare
                            className="text-indigo-500 dark:text-indigo-400 fill-white dark:fill-slate-900 drop-shadow-md"
                            size={20}
                          />
                        ) : (
                          <Square
                            className="text-white drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            size={20}
                          />
                        )}
                      </div>
 
                      <div className="w-full aspect-square bg-slate-100 dark:bg-slate-700/50 rounded-xl overflow-hidden relative shadow-inner">
                        {release.basic_information.thumb ? (
                          <img
                            src={getProxiedImageUrl(release.basic_information.thumb)}
                            alt="cover"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-medium gap-1">
                            <span className="text-3xl opacity-50 grayscale">💿</span>
                          </div>
                        )}
                      </div>
 
                      <div className="flex-1 min-w-0 flex flex-col pt-1">
                        <h3
                          className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm leading-tight mb-0.5"
                          title={release.basic_information.title}
                        >
                          {release.basic_information.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
                          {artist} • {release.basic_information.year || '—'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
 
          {!loading && releases.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center mt-8 max-w-md mx-auto animate-fade-in">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400 dark:text-slate-500 shadow-inner">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                {search ? 'No matches found' : 'Your collection is empty'}
              </h3>
              <p className="text-base text-slate-500 dark:text-slate-400">
                {search
                  ? `We couldn't find any records matching "${search}". Try adjusting your filters.`
                  : "It looks like you haven't synced your Discogs collection yet, or there are no records."}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
 
export default Collection;
