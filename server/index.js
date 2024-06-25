const express = require('express');
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
    }
});

const rooms= [{ roomCode: "LUCK", users: [] }]

let isVIP = true;

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Game init for room
    socket.on("init_game_room", (roomCode) => {
        socket.join(roomCode);
        isVIP = true;
        console.log(roomCode);
    })

    socket.on("vip_start_game", (roomCode) => {
        console.log(`Emitting to roomCode: ${roomCode}`);
        socket.to(roomCode).emit("start_game");
    })

    // Users joining games
    socket.on("join_room", (data) => {
        const room = rooms.find(room => room.roomCode === data.room);
        if (!room) {
            // Error
            console.log("Something went wrong.");
            return;
        }
        room.users.push(data.username);
        socket.join(data.room);
        socket.to(data.room).emit("user_joined", data);
        data.VIP = isVIP;
        socket.emit("join_successful", data);
        isVIP = false;
        console.log(`${data.username} joined room ${data.room}`)
    });

    // Test
    socket.on("send_message", (data) => {
        socket.broadcast.emit("receive_message", data);
    })
})

server.listen(3001, () => {
    console.log("SERVER IS RUNNING");
})



