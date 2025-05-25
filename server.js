import express from "express";
import dotenv from "dotenv";
import pgclient from './db.js';
import morgan from 'morgan';
import cors from "cors";
import communityRoutes from './routes/community.js';



const server = express();
dotenv.config();
server.use(cors());
server.use(morgan('dev'));
server.use(express.json());

const PORT = process.env.PORT || 5000;

//community routes
server.use("/api/community", communityRoutes);

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