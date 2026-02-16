import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { scanBarcode } from '../services/api';
import type { ScanResult } from '../types';

const BarcodeScanner: React.FC = () => {
    const { user } = useAuth();
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [isScanning, setIsScanning] = useState(true);

    useEffect(() => {
        if (!isScanning) return;

        // Check for Secure Context (HTTPS or localhost)
        const isSecure = window.isSecureContext;
        if (!isSecure) {
            setScanResult({
                success: false,
                message: "Camera access requires HTTPS or localhost. If you are using an IP address, the camera might be blocked by your browser."
            });
            // We still try to render, but it likely won't work
        }

        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
        );

        scanner.render(
            async (result) => {
                // Success callback
                console.log("Scanned:", result);
                scanner.clear(); // Stop scanning temporarily
                setIsScanning(false);

                if (user) {
                    try {
                        const apiResult = await scanBarcode(result, user.username);
                        setScanResult(apiResult);
                    } catch (e: any) {
                        const msg = e.response?.data?.message || "Network error or backend failure";
                        setScanResult({ success: false, message: msg });
                    }
                }
            },
            (_error) => {
                // Error callback (scanning in progress)
                // console.warn(error);
            }
        );

        return () => {
            scanner.clear().catch(error => console.error("Failed to clear scanner", error));
        };
    }, [user, isScanning]);

    const handleReset = () => {
        setScanResult(null);
        setIsScanning(true);
    };

    return (
        <div className="flex flex-col items-center p-4">
            <h2 className="text-xl font-bold mb-4">Scan Vinyl Barcode</h2>

            {isScanning && <div id="reader" className="w-full max-w-md"></div>}

            {scanResult && (
                <div className={`mt-4 p-4 rounded ${scanResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <h3 className="font-bold">{scanResult.success ? 'Success!' : 'Error'}</h3>
                    <p>{scanResult.message}</p>
                    {scanResult.record && (
                        <div className="mt-2 text-center">
                            <img src={scanResult.record.thumbUrl} alt="Cover" className="w-32 h-32 mx-auto rounded shadow" />
                            <p className="font-semibold mt-2">{scanResult.record.title}</p>
                            <p className="text-sm">{scanResult.record.artist}</p>
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
