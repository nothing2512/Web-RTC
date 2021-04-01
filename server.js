'use strict'

const express = require("express")
const SocketIo = require("socket.io")
const https = require("https")
const fs = require("fs")

/**
 * Start Http Server
 * @type {*|Express}
 */
const app = express()
app.use(express.static("public"))

app.get("/", function(req, res) {
    res.render("public/index.html")
})

const server = https.createServer({
    key: fs.readFileSync("key.pem"),
    cert: fs.readFileSync("cert.pem"),
    passphrase: "local"
}, app).listen(1206, function() {
    console.log("Server Started")
})

/**
 * Start Socket IO
 */
const io = SocketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

io.on('connection', function(socket) {
    console.log("socket created")

    /**
     * Basic Socket Io
     */
    io.on('connection', function(client) {
        console.log("User joined with id: ", client.id)
        socket.to(client.id).emit('id', client.id)
    })

    socket.on('notification', (args) => {
        for (let to of args.to) socket.to(to).emit('notification', args.data)
    });

    socket.on('read_pointer', (args) => {
        for (let to of args.to) socket.to(to).emit('read_pointer', args.id)
    });

    socket.on('chat', (args) => {
        for (let to of args.to) socket.to(to).emit('chat', data)
    });

    /**
     * Rtc Connection
     */
    socket.on('create_room', roomNumber => {
        const rooms = socket.adapter.rooms.get(roomNumber);
        if (rooms === undefined) {
            socket.join(roomNumber);
            socket.emit("created")
        }
        else socket.emit('error', 'Room has been created by another user');
    });

    socket.on('join_room', (roomNumber) => {
        const rooms = socket.adapter.rooms.get(roomNumber);

        if (rooms === undefined) {
            socket.emit('error', "Room not found")
        } else if (rooms.size === 1) {
            socket.join(roomNumber);
            socket.emit('joined')
        } else {
            socket.emit('error', "Room is full")
        }
    });

    socket.on('ask_permission', (roomNumber) => {
        socket.broadcast.to(roomNumber).emit('permission_asked')
    });

    socket.on('candidate', (evt) => {
        socket.broadcast.to(evt.room).emit('answer', evt)
    });

    socket.on('permitted', (evt) => {
        socket.broadcast.to(evt.room).emit('permitted', evt.sdp)
    });

    socket.on('joined', (evt) => {
        socket.broadcast.to(evt.room).emit('user_joined', evt.sdp)
    });

    socket.on('test', (evt) => {
        socket.broadcast.to(evt.room).emit('test', evt.stream)
    });

    socket.on('user_candidate', (evt) => {
        socket.broadcast.to(evt.room).emit('user_candidate', evt.candidate)
    });

    socket.on('mentor_candidate', (evt) => {
        socket.broadcast.to(evt.room).emit('mentor_candidate', evt.candidate)
    });

    socket.on('set_video', (evt) => {
        socket.broadcast.to(evt.room).emit('set_video', evt)
    })

    socket.on('mute', (evt) => {
        socket.broadcast.to(evt.room).emit('mute', evt)
    });

    socket.on('unmute', (evt) => {
        socket.broadcast.to(evt.room).emit('unmute', evt)
    });

    const leaveRoom = (room) => {
        socket.leave(room)
    };

    socket.on('disconnect', leaveRoom);
    io.on('disconnect', leaveRoom)
})