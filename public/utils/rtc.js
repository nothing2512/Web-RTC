'use strict';

const inputRoomNumber = document.getElementById("roomNumber");
const createButton = document.getElementById("createButton");
const joinButton = document.getElementById("joinButton");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const audioButton = document.getElementById("audioButton");
const videoButton = document.getElementById("videoButton");
const audioIcon = document.getElementById("audioIcon");
const videoIcon = document.getElementById("videoIcon");

const iceServers = {
    'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]
};

const mediaConstraints = {
    audio: true,
    video: {
        height: 720,
        width: 1280,
        facingMode: 'environtment',
        frameRate: {
            ideal: 60,
            min: 10
        }
    }
};

let roomNumber;
let localStream;
let remoteStream;
let peer;
let isHost = false;
let isAudio = true;
let isVideo = true;

const socket = io('https://192.168.43.128:1206', {withCredentials: false});

function getMedia() {
    try {
        navigator
            .mediaDevices
            .getUserMedia(mediaConstraints)
            .then((stream) => {
                localStream = stream;
                localVideo.srcObject = stream;
            })
    } catch (e) {
        alert(e)
    }
}
getMedia()

// host
createButton.onclick = () => {
    roomNumber = inputRoomNumber.value;
    socket.emit('create_room', roomNumber);
    joinButton.disabled = true
    createButton.disabled = true
    isHost = true;
};

// user
joinButton.onclick = () => {
    roomNumber = inputRoomNumber.value;
    socket.emit('join_room', roomNumber);
    joinButton.disabled = true
    createButton.disabled = true
};

audioButton.onclick = () => {
    isAudio = !isAudio
    if (isAudio) {
        console.log("unmute")
        audioIcon.classList.remove("fa-volume-mute")
        audioIcon.classList.add("fa-volume-up")
        socket.emit('unmute', {
            room: inputRoomNumber.value,
            isHost: isHost
        })
    } else {
        console.log("mute")
        audioIcon.classList.add("fa-volume-mute")
        audioIcon.classList.remove("fa-volume-up")
        socket.emit('mute', {
            room: inputRoomNumber.value,
            isHost: isHost
        })
    }
}

videoButton.onclick = () => {
    isVideo = !isVideo
    if (isVideo) {
        getMedia()
        socket.emit("set_video", {
            room: inputRoomNumber.value,
            enable: true,
            isHost: isHost
        })
    } else {
        localStream = null;
        localVideo.srcObject = null;
        socket.emit("set_video", {
            room: inputRoomNumber.value,
            enable: false,
            isHost: isHost
        })
    }
}

// host and user
socket.on('error', message => {
    alert(message);
    joinButton.disabled = false
    createButton.disabled = false
});

// user
socket.on('joined', () => {
    socket.emit('ask_permission', roomNumber);
    console.log("joined")
});

// host
socket.on('permission_asked', options => onPermissionAsked());

async function onPermissionAsked() {
    if (isHost) {
        peer = new RTCPeerConnection(iceServers);

        localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
        peer.addEventListener('track', e => {
            if (remoteVideo.srcObject !== e.streams[0]) {
                remoteStream = e.streams[0]
                remoteVideo.srcObject = remoteStream
            }
        });

        let sdp = await peer.createOffer();
        await peer.setLocalDescription(new RTCSessionDescription(sdp));

        socket.emit('permitted', {
            type: 'offer',
            sdp: sdp,
            room: roomNumber
        });

        console.log("permission asked")
    }
}

// user
socket.on('permitted', (evt) => onPermitted(evt));

async function onPermitted(evt) {
    if (!isHost) {
        try {
            peer = new RTCPeerConnection(iceServers);

            localStream.getTracks().forEach((track) => {
                peer.addTrack(track, localStream)
            });

            peer.addEventListener('track', e => {
                if (remoteVideo.srcObject !== e.streams[0]) {
                    remoteStream = e.streams[0]
                    remoteVideo.srcObject = remoteStream
                }
            });

            await peer.setRemoteDescription(new RTCSessionDescription(evt));
            let sdp = await peer.createAnswer();
            await peer.setLocalDescription(new RTCSessionDescription(sdp));

            socket.emit('joined', {
                type: 'answer',
                sdp: sdp,
                room: roomNumber
            });
            console.log("permitted");
            peer.addEventListener('icecandidate', evt => {
                socket.emit('user_candidate', {
                    room: roomNumber,
                    candidate: evt.candidate
                })
            });
        } catch (e) {
            console.log(e)
        }
    }
}

// host
socket.on('user_joined', (evt) => onUserJoined(evt));

async function onUserJoined(evt) {
    try {
        await peer.setRemoteDescription(new RTCSessionDescription(evt));
        console.log("user joined")
    } catch (e) {
        console.log(e)
    }
}

// client
socket.on('mentor_candidate', (candidate) => onMentorCandidate(candidate));

async function onMentorCandidate(candidate) {
    console.log("Mentor Candidate");
    if (!isHost) {
        try {
            await peer.addIceCandidate(candidate)
        } catch (e) {
            console.log(e)
        }
    }
}

// host
socket.on('user_candidate', (candidate) => onUserCandidate(candidate));

async function onUserCandidate(candidate) {
    if (isHost) {
        try {
            await peer.addIceCandidate(candidate);
            peer.addEventListener('icecandidate', evt => {
                socket.emit('mentor_candidate', {
                    room: roomNumber,
                    candidate: evt.candidate
                })
            });
        } catch (e) {
            console.log(e)
        }
    }
}

socket.on('mute', (evt) => {
    if (evt.isHost !== isHost) remoteVideo.muted = true
})

socket.on('unmute', (evt) => {
    if (evt.isHost !== isHost) remoteVideo.muted = false
})

socket.on('set_video', (evt) => {
    if (evt.isHost !== isHost) {
        console.log("Y")
        if (evt.enable) remoteVideo.srcObject = remoteStream
        else remoteVideo.srcObject = null
    }
})