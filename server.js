import express from "express";
import dotenv, { configDotenv } from 'dotenv';
import dotenv from "dotenv";
import pgclient from './db.js';
import morgan from 'morgan';


const server = express();
dotenv.config();
server.use(cors());
server.use(morga('dev'));
server.use(express.json());

const PORT = process.env.PORT || 5000;

//community routes
server.use("/api/community", communityRoutes);


// not found route
app.use((req, res) => {
    res.json({ message: "🚫 Route not found" });
})


pgclient.connect()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Listening on PORT ${PORT}`);

        });
    });