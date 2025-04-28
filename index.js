import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import quoteModel from './models/postgres.js';
import axios from 'axios';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import analyticsModel from './models/analytics.js';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('ERROR: Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`- ${envVar}`));
  console.error('Please create a .env file with these variables.');
  process.exit(1);
}

// Check database URL format
const dbUrlPattern = /^postgres(ql)?:\/\/.+:.+@.+:\d+\/.+$/i;
if (!dbUrlPattern.test(process.env.DATABASE_URL)) {
  console.warn('WARNING: DATABASE_URL may be incorrectly formatted.');
  console.warn('Expected format: postgres://username:password@hostname:port/database');
  console.warn(`Got: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);
}

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======= OPTIMIZED CONNECTION HANDLING =======
// Configure connection and security in a single middleware to prevent conflicts
app.use((req, res, next) => {
  // Set connection and security headers in one place
  res.set({
    // Connection optimization
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=60', // Reduced from 120s to 60s
    
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  });
  
  // Only add HSTS in production environments
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Conditionally set cache headers for static assets
  if (req.path.startsWith('/assets/') || req.path.includes('.')) {
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours for static assets
  }
  
  next();
});

// ======= RATE LIMITING WITH OPTIMIZED SETTINGS =======
// Apply rate limiting with more reasonable limits
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (reduced from 15)
  max: 200, // Increased from 100 to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
  skip: (req) => req.path === '/' || req.path.startsWith('/assets/')
});

// Apply speed limiting only to the most sensitive endpoints
const speedLimiter = slowDown({
  windowMs: 5 * 60 * 1000, // 5 minutes
  delayAfter: 50, // Increased from 30
  delayMs: (hits) => Math.min(500, hits * 50), // Cap delay at 500ms
  skip: (req) => {
    return req.path === '/' || 
           req.path.startsWith('/assets/') || 
           req.method === 'GET' && !req.path.includes('/api');
  }
});

// Apply rate limiting and speed limiting more selectively
app.use('/api', apiLimiter);
app.use('/api/flag', speedLimiter); // Only apply speed limiting to sensitive endpoints

// ======= OPTIMIZED CORS =======
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'If-None-Match'],
  maxAge: 86400 // 24 hours in seconds
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '250kb' })); // Limit payload size

// ======= STREAMLINED STATIC FILE SERVING =======
app.use(express.static(path.resolve(__dirname, 'dist')));

// ======= REDUCED LOGGING =======
// Only log essential information to reduce overhead
morgan.token('method-path', (req) => `${req.method} ${req.path}`);
morgan.token('response-info', (req, res) => `${res.statusCode} - ${res.getHeader('content-length') || 0}b`);
app.use(morgan(':method-path :response-info :response-time ms', {
  skip: (req) => req.path.startsWith('/assets/')
}));

// ======= SECURITY FILTER =======
// Block suspicious requests without heavy processing
app.use((req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const requestPath = req.path || '';
  
  // Simplified pattern matching for better performance
  if (
    /sqlmap|nikto|nmap|acunetix|burpsuite|ZAP/i.test(userAgent) ||
    /wp-|xmlrpc|admin|\.php|\.asp/i.test(requestPath)
  ) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Prevent HTTP parameter pollution more efficiently
  if (req.query) {
    for (const key in req.query) {
      if (Array.isArray(req.query[key])) {
        req.query[key] = req.query[key][0];
      }
    }
  }
  
  next();
});

// Add console logs at the start of the file to check routes loading

// Cache for game titles
let cachedGameList = null;

// Load game titles into cache on startup
async function loadGameTitles() {
    try {
        const result = await quoteModel.getGameList();
        cachedGameList = result;
        console.log(`Loaded ${cachedGameList.length} game titles into cache`);
    } catch (error) {
        console.error('Error loading game titles into cache:', error);
        cachedGameList = []; // Initialize as empty array if query fails
    }
}

// Load game titles immediately
loadGameTitles().then(() => {
    console.log('Game titles cache initialized');
}).catch(err => {
    console.error('Failed to initialize game titles cache:', err);
});

app.get('/api', async (req, res) => {
    // Input validation and sanitization
    let searchTerm = req.query.search || '';
    let selectedValue = req.query.channel || 'all';
    let year = req.query.year || '';
    let sortOrder = req.query.sort || 'default';
    let page = parseInt(req.query.page) || 1;
    let exactPhrase = req.query.strict === 'true';
    let gameName = req.query.game || 'all';

    if (req.query.gameName) {
        try {
            // Decode and basic sanitization
            const decodedGame = decodeURIComponent(req.query.gameName)
                .replace(/['";]/g, '') // Remove quotes and semicolons
                .replace(/\+/g, ' ')
                .trim();
            
            if (decodedGame && decodedGame !== 'all') {
                // For additional security, you could validate against your known game list
                gameName = decodedGame;
            }
        } catch (e) {
            console.error("Error decoding game name:", e);
            gameName = "all";
        }
    }
    
    // Always search in text, not title
    const searchPath = "text";

    try {
        // Add rate limiting check
        // ... (add rate limiting code here if needed)
        
        const startTime = Date.now();
        const result = await quoteModel.search({
            searchTerm,
            searchPath,
            gameName,
            selectedValue,
            year,
            sortOrder,
            page,
            exactPhrase
        });
        const totalTime = Date.now() - startTime;

        // Set security headers
        res.set({
            'X-Response-Time': `${totalTime}ms`,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none'",
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
        });

        res.json({
            data: result.data,
            total: result.total,
            totalQuotes: result.totalQuotes,
            queryTime: result.queryTime,
            totalTime: totalTime
        });
    } catch (error) {
        console.error('Search error:', error);
        console.error('Search parameters:', {
            searchTerm,
            selectedValue,
            year,
            sortOrder,
            gameName,
            searchPath
        });
        res.status(500).json({ 
            error: 'Search failed',
            details: 'An error occurred while processing your request' // Don't expose actual error details
        });
    }
});

app.get('/stats', async (req, res) => {
    try {
        const stats = await quoteModel.getStats();
        res.json({ data: stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Add new endpoint for flagging quotes
app.post('/api/flag', async (req, res) => {
    try {
        // Validate and sanitize input
        const sanitizeInput = (input) => {
            if (!input) return "N/A";
            // Basic sanitization - remove potential script tags and other harmful content
            return input.toString()
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/['";`]/g, '') // Remove quotes and backticks
                .slice(0, 1000); // Limit length
        };
        
        // Extract and sanitize fields
        const quote = sanitizeInput(req.body.quote);
        const searchTerm = sanitizeInput(req.body.searchTerm);
        const timestamp = req.body.timestamp ? parseFloat(req.body.timestamp) : null;
        
        // Validate videoId format (YouTube IDs are 11 chars)
        const videoId = /^[a-zA-Z0-9_-]{11}$/.test(req.body.videoId) ? 
                        req.body.videoId : "invalid";
        
        const title = sanitizeInput(req.body.title);
        const channel = sanitizeInput(req.body.channel);
        const reason = sanitizeInput(req.body.reason);
        const pageUrl = sanitizeInput(req.body.pageUrl);
        
        // Check for spam or abuse patterns
        const hasSuspiciousContent = (input) => {
            const spamPatterns = [
                /\b(viagra|cialis|casino|porn|sex|xxx)\b/i,
                /\b(click here|free money|you won|lottery)\b/i,
                /(https?:\/\/|www\.)/i // Links are often spam
            ];
            
            return spamPatterns.some(pattern => pattern.test(input));
        };
        
        if (hasSuspiciousContent(reason) || hasSuspiciousContent(quote)) {
            return res.status(400).json({ error: 'Potential spam detected' });
        }
        
        // Create Discord webhook message
        const webhookMessage = {
            embeds: [{
                title: "🚩 Quote Flagged",
                color: 15158332, // Red color
                fields: [
                    {
                        name: "Search Term",
                        value: searchTerm,
                        inline: true
                    },
                    {
                        name: "Channel",
                        value: channel,
                        inline: true
                    },
                    {
                        name: "Video Title",
                        value: title,
                        inline: true
                    },
                    {
                        name: "Quote",
                        value: quote,
                        inline: false
                    },
                    {
                        name: "Timestamp",
                        value: timestamp 
                            ? `[${timestamp}](https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestamp) - 1})` 
                            : "N/A",
                        inline: true
                    },
                    {
                        name: "Feedback",
                        value: reason 
                            ? `⋯${reason}⋯` 
                            : "No feedback provided",
                        inline: false
                    },
                    {
                        name: "Page URL",
                        value: pageUrl && pageUrl !== 'N/A' 
                            ? pageUrl 
                            : "N/A",
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: "Quote Flagging System"
                }
            }]
        };
        
        // Send to Discord webhook
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) {
            throw new Error('Discord webhook URL not configured');
        }

        await axios.post(webhookUrl, webhookMessage);
        
        // Set security headers
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store'
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error flagging quote:', error);
        res.status(500).json({ error: 'Failed to flag quote' });
    }
});

app.get('/api/random', async (req, res) => {
    try {
        const result = await quoteModel.getRandom();
        res.json({ quotes: result });
    } catch (error) {
        console.error('Error fetching random quotes:', error);
        res.status(500).json({ error: 'Failed to fetch random quotes' });
    }
});

app.get('/api/games', (req, res) => {
    try {
        // Set cache headers - cache for 1 hour on client side
        res.set({
            'Cache-Control': 'public, max-age=3600',
            'ETag': `"${cachedGameList.length}"` // Simple ETag based on number of games
        });
        
        res.json({ games: cachedGameList });
    } catch (error) {
        console.error('Error serving game titles:', error);
        res.status(500).json({ error: 'Failed to fetch game titles' });
    }
});

// Health check endpoint for monitoring and diagnostics
app.get('/health', async (req, res) => {
    const health = {
        uptime: process.uptime(),
        timestamp: Date.now(),
        memory: process.memoryUsage(),
        status: 'UP'
    };
    
    try {
        // Check database connectivity
        const dbHealthy = await quoteModel.checkHealth();
        health.database = dbHealthy ? 'connected' : 'disconnected';
        
        if (!dbHealthy) {
            health.status = 'DEGRADED';
            return res.status(200).json(health);
        }
        
        res.json(health);
    } catch (error) {
        health.status = 'DOWN';
        health.error = 'Service unavailable';
        health.database = 'error';
        res.status(500).json(health);
    }
});

// Database status endpoint - for monitoring in beta version
app.get('/api/db-status', async (req, res) => {
  console.log('⚠️ Database status check requested from: ' + req.ip);
  console.log('👉 Request URL path: ' + req.path);
  console.log('👉 Full request URL: ' + req.originalUrl);
  console.log('👉 Request headers:', req.headers);
  
  try {
    console.log('🔍 Attempting to check database health...');
    const healthStatus = await quoteModel.checkHealth();
    console.log('✅ Database health check complete:', healthStatus.healthy ? 'HEALTHY' : 'UNHEALTHY');
    
    const response = {
      status: healthStatus.healthy ? 'connected' : 'error',
      message: healthStatus.healthy 
        ? `Connected to PostgreSQL (${healthStatus.responseTime} response time)` 
        : `Error connecting to PostgreSQL: ${healthStatus.error}`,
      details: healthStatus,
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Sending DB status response:', response.status);
    res.json(response);
  } catch (error) {
    console.error('❌ Error checking database status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check database status: ' + error.message,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// Add a test endpoint that's simpler to check if Express routing is working correctly
app.get('/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ status: 'ok', message: 'Test endpoint working' });
});

// Add a global error handler with connection error recovery
app.use((err, req, res, next) => {
    console.error('Unhandled application error:', err.stack);
    
    // Check if it's a database connection error
    const isDbConnectionError = 
        err.message && (
            err.message.includes('database') || 
            err.message.includes('connection') || 
            err.message.includes('PostgreSQL')
        );
    
    if (isDbConnectionError) {
        // Try to reconnect immediately
        setTimeout(async () => {
            try {
                await quoteModel.checkHealth();
                console.log('Database reconnection successful after error');
            } catch (e) {
                console.error('Failed to reconnect to database:', e.message);
            }
        }, 1000);
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong' 
            : err.message
    });
});

const errorHandler = (error, req, res, next) => {
    console.error(error.message);
    if (error.name === 'CastError') {
        return res.status(400).send({ error: 'malformatted id' });
    } else if (error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
    }
    next(error);
};

app.use(errorHandler);
// SPA fallback for React Router with CSP header
app.get('*', (req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'  https://www.youtube.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' https://img.youtube.com https://www.youtube.com data:; " +
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; " +
    "object-src 'none'"
  );
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

// Create server with optimized settings
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available endpoints:');
    console.log('- /api (search)');
    console.log('- /api/random (random quotes)');
    console.log('- /api/games (game list)');
    console.log('- /api/flag (flag quotes)');
    console.log('- /health (health check)');
    console.log('- /stats (statistics)');
});

// Configure server timeouts
server.keepAliveTimeout = 120000; // 120 seconds - longer than browsers typically use
server.headersTimeout = 125000; // 125 seconds - slightly longer than keepAliveTimeout
server.timeout = 300000; // 5 minutes for long-running requests

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// --- Analytics endpoint ---
app.post('/analytics', async (req, res) => {
    try {
      console.log('POST /analytics hit', req.body);
  
      // Check database connection first
      const isConnected = await analyticsModel.checkConnection();
      if (!isConnected) {
        console.error('Analytics database connection failed');
        return res.status(500).json({ error: 'Database connection failed' });
      }
  
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.error('Invalid request body:', req.body);
        return res.status(400).json({ error: 'Invalid request body' });
      }
  
      // Store the analytics event
      await analyticsModel.storeEvent(req.body);
      res.status(204).end();
    } catch (error) {
      console.error('Error in analytics endpoint:', error);
      res.status(500).json({ 
        error: 'Failed to store analytics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
  
  

