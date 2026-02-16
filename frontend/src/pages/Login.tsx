import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [discogsToken, setDiscogsToken] = useState('');
    const [error, setError] = useState('');
    const { login, isLoading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;
        setError('');

        try {
            await login(username, discogsToken);
            navigate('/');
        } catch (err) {
            setError('Login failed. Please check your username.');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
                <h1 className="text-2xl font-bold mb-4 text-center">Vinyl Tracker Login</h1>
                {error && (
                    <div className="bg-red-100 text-red-700 p-2 mb-4 rounded text-sm text-center">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded p-2"
                            placeholder="Enter your username"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Discogs Token</label>
                        <input
                            type="password"
                            value={discogsToken}
                            onChange={(e) => setDiscogsToken(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded p-2"
                            placeholder="Enter your Discogs Personal Access Token"
                        />
                    </div>
                    {/* In a real app, password field here */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
                    >
                        {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
