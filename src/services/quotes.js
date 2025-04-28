import axios from 'axios'

// Detect Render.com environment
const isOnRender = window.location.hostname.includes('render.com') || 
                   window.location.hostname.includes('onrender.com');

// Check if current protocol is HTTPS
const isHttps = window.location.protocol === 'https:';

// Define possible API path prefixes to try
const pathPrefixes = [
    '/api', // Standard setup - TRY THIS FIRST
    '', // No prefix (direct routes)
    '/app/api', // Potential subfolder configuration
];

// Define possible base URLs for direct access if proxy fails
// This helps bypass potential SSL/Proxy issues
const possibleBaseUrls = isOnRender ? [
    window.location.origin, // Explicit origin
    '', // Current domain (default)
] : [''];

// Configure Axios with settings to handle SSL issues
const axiosConfig = {
    timeout: 15000,  // Longer timeout for SSL handshakes
    headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
    }
};

// For Render.com, we may need to adjust SSL verification
if (isOnRender) {
    console.log('Running on Render.com, adjusting API paths');
}

// Add a delay helper for migration mode
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Flag to indicate if we're in migration mode (will be set to true after failed attempts)
let isMigrationMode = false; // Migration complete - set to false to enable searches

// Helper to try API calls with different path prefixes and base URLs
const makeApiRequest = async (endpoint, method = 'get', params = null, data = null) => {
    const errors = [];
    for (const baseUrl of possibleBaseUrls) {
        // Try each path prefix
        for (const prefix of pathPrefixes) {
            try {
                // Build the full path, ensuring we don't double up on /api
                let fullPath = endpoint;
                if (prefix && !endpoint.startsWith(prefix)) {
                    fullPath = `${prefix}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
                }
                if (baseUrl) {
                    fullPath = `${baseUrl}${fullPath}`;
                }
                
                console.log(`Trying API request: ${method.toUpperCase()} ${fullPath}`);
                
                if (method === 'get') {
                    const response = await axios.get(fullPath, { 
                        ...axiosConfig,
                        params 
                    });
                    console.log(`API call succeeded with: ${fullPath}`);
                    return response;
                }
                // Add POST support
                if (method === 'post') {
                    const response = await axios.post(fullPath, data, axiosConfig);
                    console.log(`API call succeeded with: ${fullPath}`);
                    return response;
                }
            } catch (error) {
                const errorInfo = {
                    path: `${baseUrl}${prefix}${endpoint}`,
                    status: error.response?.status,
                    message: error.message,
                    isSSL: error.message.includes('SSL')
                };
                errors.push(errorInfo);
                
                console.log(`API call failed with: ${baseUrl}${prefix}${endpoint}`, errorInfo);
                
                // If we get SSL error, log more details
                if (error.message.includes('SSL')) {
                    console.error('SSL Error detected:', error);
                }
            }
        }
    }
    
};

const getAll = async (searchTerm, page, strict, selectedValue, selectedMode, year, sortOrder, gameName) => {
    try {
        // If we're in migration mode, fail quickly with appropriate message
        if (isMigrationMode) {
            await delay(500);
            throw new Error('Search unavailable during database migration');
        }
        
        // Make the request directly to the /api endpoint
        const response = await makeApiRequest('/api', 'get', {  
            search: searchTerm || '', 
            page: page || 1,   
            strict: strict,
            channel: selectedValue || 'all',
            selectedMode: selectedMode || 'searchText',
            year: year || '',
            sort: sortOrder || 'default',
            game: gameName || 'all'
        });
        
        // If we get here, one of the attempts succeeded
        return {
            data: response.data.data || [],
            total: response.data.total || 0,
            totalQuotes: response.data.totalQuotes || 0
        };
    } catch (error) {
        console.error('Error fetching quotes:', error);
        throw error;
    }
};


const getStats = async () => {
    try {
        const response = await makeApiRequest('/stats', 'get');
        return response.data;
    } catch (error) {
        console.error('Error fetching stats:', error);
        throw error;
    }
};

const flagQuote = async (quoteData) => {
    try {
        if (isMigrationMode) {
            await delay(300);
            throw new Error('Flagging unavailable during database migration');
        }
        
        const response = await makeApiRequest('/flag', 'post', null, quoteData);
        return response.data;
    } catch (error) {
        console.error('Error flagging quote:', error);
        throw error;
    }
};

const getRandomQuotes = async () => {
    try {
        const response = await makeApiRequest('/api/random', 'get');
        if (!response.data || !response.data.quotes) {
            throw new Error('Invalid response format from random quotes endpoint');
        }
        return response.data;
    } catch (error) {
        console.error('Error fetching random quotes:', error);
        // Add more specific error handling
        if (error.message.includes('Network Error')) {
            throw new Error('Network connection failed. Please check your internet connection.');
        } else if (error.message.includes('timeout')) {
            throw new Error('Request timed out. Please try again.');
        } else {
            throw new Error('Unable to fetch random quotes. Please try again later.');
        }
    }
};

const checkDatabaseStatus = async () => {
    try {
        if (isMigrationMode) {
            await delay(300);
            throw new Error('Database status check unavailable during migration');
        }
        
        const response = await makeApiRequest('/db-status', 'get');
        return response.data;
    } catch (error) {
        console.error('Error checking database status:', error);
        throw error;
    }
};

export default {
    getAll,
    getStats,
    flagQuote,
    getRandomQuotes,
    checkDatabaseStatus
}