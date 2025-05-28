import express from "express";
import dotenv from "dotenv";
import pgclient from './db.js';
import morgan from 'morgan';
import cors from "cors";
import communityRoutes from './routes/community.js';
import favoritesRoutes from './routes/favorites.js';
import notesRoutes from './routes/notes.js'
import usersRoutes from './routes/users.js';
import ratingsRoutes from './routes/ratings.js'
import { checkJwt, extractUser } from './middleware/auth0.js';

const server = express();
dotenv.config();

// CORS configuration
server.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

server.use(morgan('dev'));
server.use(express.json());

const PORT = process.env.PORT || 5000;

// Health check endpoint
server.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Community routes - handle authentication inside the routes
server.use("/api/community", communityRoutes);

// Protected routes - all require authentication
server.use("/api/favorites", checkJwt, extractUser, favoritesRoutes);
server.use("/api/notes", checkJwt, extractUser, notesRoutes);
server.use("/api/users", checkJwt, extractUser, usersRoutes);
server.use("/api/ratings", checkJwt, extractUser, ratingsRoutes);

// 404 handler
server.use((req, res) => {
  res.status(404).json({ message: "🚫 Route not found" });
});

// Global error handler
server.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

pgclient.connect()
    .then(() => {
        console.log('✅ Database connected successfully');
        server.listen(PORT, () => {
            console.log(`🚀 Server listening on PORT ${PORT}`);
            console.log(`🔍 Health check: http://localhost:5000/api/health`);
            console.log(`📋 Community recipes: http://localhost:5000/api/community`);
        });
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    });