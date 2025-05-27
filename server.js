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
server.use(cors());
server.use(morgan('dev'));
server.use(express.json());

const PORT = process.env.PORT || 5000;

//community routes
server.use("/api/community", communityRoutes);

//favorites routes
server.use("/api/favorites", checkJwt, extractUser, favoritesRoutes);

//notes routes
server.use("/api/notes", checkJwt, extractUser, notesRoutes);

//users routes
server.use("/api/users", checkJwt, extractUser, usersRoutes);

//ratings routes
server.use("/api/ratings", checkJwt, extractUser, ratingsRoutes);

//ratings rouutes
server.use("/api/ratings", ratingsRoutes);

// not found route
server.use((req, res) => {
    res.json({ message: "🚫 Route not found" });
})

pgclient.connect()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Listening on PORT ${PORT}`);
        });
    });
