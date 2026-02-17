import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';

const Collection: React.FC = () => {
    const navigate = useNavigate();

    // Redirect to scan/dashboard or do nothing if scan clicked here
    // For now, redirect to dashboard with scan active
    const handleScan = () => {
        navigate('/', { state: { scan: true } });
    };

    return (
        <Layout onScanClick={handleScan}>
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <h1 className="text-3xl font-bold mb-4">Your Collection</h1>
                <p className="text-gray-500 max-w-md">
                    Complete collection browsing is coming soon.
                    For now, check your recent listens on the Dashboard.
                </p>
            </div>
        </Layout>
    );
};

export default Collection;
