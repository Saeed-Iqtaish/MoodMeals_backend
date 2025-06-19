import express from "express";
import dotenv from "dotenv";
import pgclient from './db.js';
import morgan from 'morgan';
import cors from "cors";
import authRoutes from './routes/auth.js';
import communityRoutes from './routes/community.js';
import favoritesRoutes from './routes/favorites.js';
import notesRoutes from './routes/notes.js'
import usersRoutes from './routes/users.js';
import ratingsRoutes from './routes/ratings.js'
import { checkJwt, extractUser } from './middleware/auth.js';

dotenv.config();

console.log('Starting MoodMeals Backend...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);

const server = express();
const PORT = process.env.PORT;

const corsOptions = {
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'https://moodmealsfrontend-production.up.railway.app',
    'https://moodmealsbackend-production.up.railway.app',
    /\.railway\.app$/
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

server.use(cors(corsOptions));
server.use(morgan('combined'));
server.use(express.json({ limit: '10mb' }));
server.use(express.urlencoded({ extended: true, limit: '10mb' }));

server.get("/", (req, res) => {
  res.json({ 
    status: "MoodMeals API is running", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT
  });
});

server.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

try {
  server.use("/api/auth", authRoutes);
  server.use("/api/community", communityRoutes);
  server.use("/api/favorites", checkJwt, extractUser, favoritesRoutes);
  server.use("/api/notes", checkJwt, extractUser, notesRoutes);
  server.use("/api/users", checkJwt, extractUser, usersRoutes);
  server.use("/api/ratings", checkJwt, extractUser, ratingsRoutes);
  console.log('Routes registered successfully');
} catch (error) {
  console.error('Error registering routes:', error);
}

server.use("/api/*", (req, res) => {
  res.status(404).json({ 
    message: "API Route not found",
    path: req.originalUrl
  });
});

server.use("*", (req, res) => {
  res.status(404).json({ 
    message: "Route not found",
    path: req.originalUrl
  });
});

server.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

async function startServer() {
  try {
    const requiredVars = ['DATABASE_URL'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    console.log('🔗 Testing database connection...');
    
    const client = await pgclient.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    console.log('Database connected successfully');
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on PORT ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Health: /api/health`);
      console.log(`Community: /api/community`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();