const express = require('express');
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
var port = process.env.PORT || 3001;
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001", "https://jdubs-personal.github.io"],
        methods: ["GET", "POST"],
    }
});

server.listen(port, function () {
    console.log("Server listening at port %d", port);
});

const ErrorMessages = Object.freeze({
    ROOM_NOT_FOUND: "Room Code not found",
    MAXIMUM_PLAYERS: "There are too many players.",
    NAME_EXISTS: "Name already exists for this room, please choose another name"
});


const imageNums = [2, 3, 4, 5, 6, 7, 8, 9, 10]
let rooms = [];

const generateRoomCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        code += letters[randomIndex];
    }
    return code;
}

const addRoom = () => {
    let roomCode;
    do {
        roomCode = generateRoomCode();
    } while (rooms.some(room => room.roomCode === roomCode));
    rooms.push({ roomCode, users: [], availableImageNums: [...imageNums] });
    return roomCode;
}

const deleteRoom = (roomCode) => {
    rooms.filter(room => room.roomCode !== roomCode);
}

const getUsersFromRoomCode = (roomCode) => {
    const room = rooms.find(room => room.roomCode === roomCode);
    if (!room) {
        throw Error(ErrorMessages.ROOM_NOT_FOUND);
    }
    return room.users;
}

const addUser = (data) => {
    const room = rooms.find(room => room.roomCode === data.room);

    let userRejoined = false;

    if (!room) {
        throw Error(ErrorMessages.ROOM_NOT_FOUND);
    }
    const users = room.users;
    if (users.length > 8) {
        throw Error(ErrorMessages.MAXIMUM_PLAYERS);
    }
    if (room.users.includes(data.username)) {

        // Check if previously logged in
        console.log(data);
        if (data.storedRoom === data.room && data.storedUsername === data.username) {
            userRejoined = true;
        } else {
            throw Error(ErrorMessages.NAME_EXISTS);
        }
    }

    if (userRejoined) {
        data.rejoin = true;
        data.imageNum = data.storedImageNum;
        return [data, room.users.length, room.users[0]]
    }

    // Sort Image Number
    const availableImageNums = room.availableImageNums;
    const imageNum = availableImageNums[Math.floor(Math.random() * availableImageNums.length)];
    room.availableImageNums = availableImageNums.filter(availableImageNum => availableImageNum !== imageNum);

    room.users.push(data.username);

    // Update data to send to client
    data.imageNum = imageNum;
    data.VIP = room.users.length === 1;
    data.rejoin = false;
    return [data, room.users.length, room.users[0]]
}

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Game init for room
    socket.on("init_game_room", () => {
        console.log('// init_game_room');
        const roomCode = addRoom();
        socket.emit("init_game_room_success", roomCode);
    })

    socket.on("vip_start_game", (roomCode) => {
        console.log("// vip_start_game");
        socket.to(roomCode).to(roomCode + "users").emit("start_game");
    })

    socket.on('send_round_questions', (playerQuestionsArray) => {
        console.log("// send_round_questions");
        playerQuestionsArray.forEach((playerQuestion) => {
            const targetSocket = playerQuestion.player.name;
            socket.to(targetSocket).emit('round_questions', playerQuestion.questions);
        })
    });

    socket.on("submit_response", (data) => {
        console.log("// submit_response");
        socket.to(data.room).emit("receive_response", data);
    })

    socket.on("cast_vote", (data) => {
        console.log("// cast_vote");
        // Data of Type Vote
        socket.to(data.room).emit("receive_vote", data);
    });

    socket.on("begin_voting", (data) => {
        console.log("// begin_voting");
        data.players.forEach((player) => {
            const targetSocket = player.name;
            socket.to(targetSocket).emit("vote", data);
        })
    })

    // Users joining gameClasses. Users join room by themselves
    socket.on("join_room", (data) => {
        console.log("// join_room");
        try {
            const [newData, playerCount, vip] = addUser(data);
            socket.to(newData.room).emit("user_joined", newData);
            socket.emit("join_successful", newData);

            // Allow start game
            if (playerCount >= 3) {
                socket.to(vip).emit("vip_ready");
            }
        } catch (error) {
            console.log(error.message);
            socket.emit("join_fail", error.message);
        }
    });

    // Allow Game to send personalised information to user
    socket.on("join_specific_room", (name) => {
        console.log("// join_specific_room");
        console.log(name);
        console.log(socket.rooms);
        socket.join(name);
        console.log(socket.rooms);
    });

    socket.on("join_specific_rooms", (names) => {
        console.log("// join_specific_rooms");
        console.log(names);
        console.log(socket.rooms);
        names.forEach(name => {
            socket.join(name);
        })
        console.log(socket.rooms);
    });

    socket.on("time_end", (roomCode) => {
        console.log("// time_end");
        socket.to(roomCode + "users").emit("receive_time_end");
    })

    socket.on("end_game", (roomCode) => {
        console.log("// end_game");
        socket.to(roomCode + "users").emit("end_game");
        deleteRoom(roomCode);
    })
})
