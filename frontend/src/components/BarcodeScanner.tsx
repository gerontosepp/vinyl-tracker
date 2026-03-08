import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../context/useAuth';
import { scanBarcode, getProxiedImageUrl } from '../services/api';
import type { ScanResult } from '../types';

const BarcodeScanner: React.FC = () => {
  const { user } = useAuth();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  const scannerRef = React.useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isScanning) return;

    let ignore = false;

    const startScanner = async () => {
      // Check for Secure Context (HTTPS or localhost)
      const isSecure = window.isSecureContext;
      if (!isSecure) {
        if (!ignore) {
          setScanResult({
            success: false,
            message: 'Camera access requires HTTPS or localhost.',
          });
        }
        return;
      }

      // Cleanup any existing scanner connection if ref is still populated (shouldn't be if cleanup worked)
      if (scannerRef.current) {
        try {
          await scannerRef.current.clear();
        } catch {
          // Removed 'e' as it was not used
          // ignore cleanup errors
        }
        scannerRef.current = null;
      }

      if (ignore) return;

      // MANUALLY CLEAR DOM to prevent double-rendering artifacts from StrictMode
      // because scanner.clear() is async and might not have finished removing elements yet.
      const readerElement = document.getElementById('reader');
      if (readerElement) {
        readerElement.innerHTML = '';
      }

      const scanner = new Html5QrcodeScanner(
        'reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scannerRef.current = scanner;

      // Render
      try {
        scanner.render(
          async (result) => {
            if (ignore) return;

            console.log('Scanned:', result);
            // Stop scanning UI immediatey
            const currentScanner = scannerRef.current;
            if (currentScanner) {
              try {
                await currentScanner.clear();
              } catch {
                // Removed 'e' as it was not used after console.warn was removed
                // ignore clear errors
              }
              scannerRef.current = null;
            }

            setIsScanning(false);

            if (user) {
              try {
                const apiResult = await scanBarcode(result, user.username);
                setScanResult(apiResult);
              } catch (e: any) {
                const msg = e.response?.data?.message || 'Network error or backend failure';
                setScanResult({ success: false, message: msg });
              }
            }
          },
          (_error) => {
            // Scanning...
          }
        );
      } catch (err) {
        console.error('Failed to render scanner', err);
      }
    };

    // Delay slightly to allow previous cleanup to process if in strict mode loop
    const timer = setTimeout(startScanner, 100);

    return () => {
      ignore = true;
      clearTimeout(timer);
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.clear().catch((error) => console.warn('Failed to clear scanner on unmount', error));
        scannerRef.current = null;
      }
    };
  }, [user, isScanning]);

  const handleReset = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  return (
    <div className="flex flex-col items-center p-4 h-full">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Scan Vinyl Barcode
      </h2>

      {isScanning && (
        <div
          id="reader"
          className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl overflow-hidden [&_*]:dark:text-gray-200"
        ></div>
      )}

      {scanResult && (
        <div
          className={`mt-4 p-4 rounded-xl shadow-sm w-full max-w-md border ${scanResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900/50' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/50'}`}
        >
          <h3 className="font-bold">{scanResult.success ? 'Success!' : 'Error'}</h3>
          <p>{scanResult.message}</p>
          {scanResult.record && (
            <div className="mt-4 text-center">
              <img
                src={getProxiedImageUrl(scanResult.record.thumbUrl)}
                alt="Cover"
                className="w-32 h-32 mx-auto rounded-lg shadow-md object-cover"
              />
              <p className="font-semibold text-gray-900 dark:text-gray-100 mt-3">
                {scanResult.record.title}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{scanResult.record.artist}</p>
            </div>
          )}
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Scan Next
          </button>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
