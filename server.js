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

const server = express();
dotenv.config();

server.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

server.use(morgan('dev'));
server.use(express.json());

const PORT = process.env.PORT || 5000;

server.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Public routes
server.use("/api/auth", authRoutes);
server.use("/api/community", communityRoutes); // Community routes handle their own auth

// Protected routes
server.use("/api/favorites", checkJwt, extractUser, favoritesRoutes);
server.use("/api/notes", checkJwt, extractUser, notesRoutes);
server.use("/api/users", checkJwt, extractUser, usersRoutes);
server.use("/api/ratings", checkJwt, extractUser, ratingsRoutes);

server.use((req, res) => {
  res.status(404).json({ message: "🚫 Route not found" });
});

server.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

pgclient.connect()
    .then(() => {
        console.log('Database connected successfully');
        server.listen(PORT, () => {
            console.log(`🚀 Server listening on PORT ${PORT}`);
            console.log(`🔍 Health check: http://localhost:5000/api/health`);
            console.log(`📋 Community recipes: http://localhost:5000/api/community`);
            console.log(`🔐 Auth endpoints: http://localhost:5000/api/auth`);
        });
    })
    .catch(err => {
        console.error('Database connection failed:', err);
        process.exit(1);
    });