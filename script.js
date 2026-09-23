"use strict";

const welcome = document.querySelector("dialog.welcome");
const playing = document.querySelector("dialog.playing");
const final = document.querySelector("dialog.final");
const over = document.querySelector("dialog.over");

const startButton = document.querySelector("button#start");
const restartButton = document.querySelector("button#restart");

const message = document.querySelector("#message");
const status = document.querySelector("#status");
const visualizer = document.querySelector("#audio-visualizer");

const iosAudio = document.querySelector("#ios-audio");

const mp3 = fetch("res/35%20Lost%20Woods.mp3").then(res => res.arrayBuffer());
const finalMp3 = fetch("res/OOT_Secret.wav").then(res => res.arrayBuffer());
const overMp3 = fetch("res/73 Game Over.mp3").then(res => res.arrayBuffer());
let audioCtx, audioSource, audioGain, audioAnalyser, audioAnalyserData, finalSource, overSource;


const initialView = [-27.62, 153.16], initialZoom = 15;


const startingPoint = [-27.66698615358153, 153.19394886528173];
const finalPoint = [-27.66682221044028, 153.19215779521755];
const path = [
    startingPoint,
    [-27.66752539730453, 153.193841528621],
    [-27.667684556810915, 153.19488476762743],
    [-27.667789138375777, 153.19496263197766],
    [-27.66789128843237, 153.19498676692794],
    [-27.668501795901555, 153.1950298318408],
    [-27.668544521107286, 153.19495738644747],
    [-27.668722688517082, 153.1948608466463],
    [-27.668824837701035, 153.1948608466463],
    [-27.669064758400182, 153.19491186121306],
    [-27.669318942606292, 153.1948796812794],
    [-27.669858191254114, 153.1945632452643],
    [-27.670411690402553, 153.19435139403384],
    [-27.670409314875712, 153.19409931788627],
    [-27.669832060323717, 153.19316878146907],
    [-27.669373580255662, 153.1934959441287],
    [-27.66698137584867, 153.19394378153987],
    [-27.66686734692292, 153.19307224166786],
    finalPoint
];

const inRadius = 20;
const outRadius = 40;
const gameOverTimeout = 30;
const gameAbortRadius = 200;

const DEBUG = false;

let state = "initial";
let waypoint = 0;
let leftPathSince = null;


let map = L.map('map').setView(initialView, initialZoom);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

L.circle(startingPoint, inRadius, { color: 'red' }).addTo(map);


if (DEBUG) {
    L.polyline(path, { color: 'red' }).addTo(map);
}
if (DEBUG) {
    map.on("click", (e) => {
        console.log(`[${e.latlng.lat}, ${e.latlng.lng}]`);

        let setView = lc.options.setView;
        try {
            lc.options.setView = false;
            map.fire("locationfound", e);
        } finally {
            lc.options.setView = setView;
        }
    });
}


let lc = L.control.locate({
    setView: "untilPanOrZoom",
    flyTo: true,
    clickBehavior: { inView: 'setView', outOfView: 'inView', inViewNotFollowing: 'inView' },
    showPopup: false
}).addTo(map);


welcome.showModal();


map.on("locationfound", (e) => {
    let player = turf.point([e.latlng.lng, e.latlng.lat]);
    let start = turf.point(startingPoint.toReversed());
    let finish = turf.point(finalPoint.toReversed());

    // GPS granted and working
    if (state == "walk-to-start") {
        let distance = turf.distance(player, start, { units: "m" });
        status.textContent = `: ${distance.toFixed(0)}m`;

        if (distance <= inRadius) {
            // Player reached starting point
            startAudio();
            state = "playing";
            waypoint = 0;
            message.textContent = "Find your way through Lost Woods without getting lost"
            status.textContent = "";
        }
    }

    if (state == "playing") {
        // At each moment, only consider a slice of the path close to the current waypoint,
        // so we can support paths that loop back on themselves while still guiding the player
        // along the intended sequence of waypoints.
        let pathSlice = [Math.max(0, waypoint - 3), waypoint + 5];
        let currentPath = turf.lineString(path.slice(pathSlice[0], pathSlice[1]).map(p => p.toReversed()));
        let nearestPoint = turf.nearestPointOnLine(currentPath, player, { units: "m" });

        waypoint = Math.max(waypoint, pathSlice[0] + nearestPoint.properties.segmentIndex);

        setAudioVolume(nearestPoint.properties.pointDistance);
        if (DEBUG) {
            status.textContent = `: ${nearestPoint.properties.pointDistance.toFixed(0)}m`;
        }

        if (waypoint >= path.length - 3) {
            // Only check for final when close to the last waypoint
            let distance = turf.distance(player, finish, { units: "m" });

            if (distance <= inRadius) {
                // Player reached final point
                state = "final";
                playing.close();
                final.showModal();
                playFinalAudio();
            }
        }

        if (nearestPoint.properties.pointDistance <= outRadius) {
            leftPathSince = null;
        } else {
            let now = Date.now();
            if (leftPathSince == null) {
                leftPathSince = now;
            }

            if (nearestPoint.properties.pointDistance > gameAbortRadius || now - leftPathSince > gameOverTimeout * 1000) {
                // Game over
                state = "over";
                playing.close();
                over.showModal();
                playOverAudio();
            }
        }
    }
});


startButton.addEventListener("click", () => {
    welcome.close();
    playing.show();

    state = "walk-to-start";

    message.textContent = "Please walk to the starting position shown in red on the map";
    status.textContent = "";

    lc.start();
});

restartButton.addEventListener("click", () => {
    over.close();
    welcome.showModal();

    state = "initial";
});


document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        pauseAudio();
    } else {
        resumeAudio();
    }
});


async function startAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();

        iosAudio.play();
    }

    audioSource = audioCtx.createBufferSource();
    audioGain = audioCtx.createGain();
    audioAnalyser = audioCtx.createAnalyser();
    audioAnalyserData = new Float32Array(audioAnalyser.fftSize);

    let buffer = await mp3;
    audioSource.buffer = await audioCtx.decodeAudioData(buffer.slice(0));
    audioSource.loop = true;
    audioSource.loopStart = 2.035;
    audioSource.loopEnd = 32.925;

    audioSource.connect(audioGain);
    audioGain.connect(audioAnalyser);
    audioAnalyser.connect(audioCtx.destination);

    let finalBuffer = await finalMp3;
    finalSource = audioCtx.createBufferSource();
    finalSource.buffer = await audioCtx.decodeAudioData(finalBuffer.slice(0));
    finalSource.connect(audioCtx.destination);

    let overBuffer = await overMp3;
    overSource = audioCtx.createBufferSource();
    overSource.buffer = await audioCtx.decodeAudioData(overBuffer.slice(0));
    overSource.connect(audioCtx.destination);

    audioSource.start();
};

async function setAudioVolume(distance) {
    let now = audioCtx.currentTime;
    let then = now + 2;

    audioGain.gain.cancelScheduledValues(now);
    audioGain.gain.setValueAtTime(audioGain.gain.value, now);

    if (distance <= inRadius) {
        audioGain.gain.linearRampToValueAtTime(1, then);
    } else if (distance <= outRadius) {
        let level = Math.pow(1 - (distance - inRadius) / (outRadius - inRadius), 2);
        audioGain.gain.linearRampToValueAtTime(level, then);
    } else {
        audioGain.gain.linearRampToValueAtTime(0, then);
    }
}

async function pauseAudio() {
    if (audioCtx) {
        await audioCtx.suspend();
    }
}

async function resumeAudio() {
    if (audioCtx) {
        await audioCtx.resume();
    }
}

async function playFinalAudio() {
    audioSource.stop();
    finalSource.start();
}

async function playOverAudio() {
    audioSource.stop();
    overSource.start();
}


function drawVisualizer() {
    const w = visualizer.clientWidth, h = visualizer.clientHeight;
    visualizer.width = w;
    visualizer.height = h;

    let ctx = visualizer.getContext("2d");

    if (state == "playing") {
        ctx.fillStyle = "#404040";
        ctx.fillRect(0, 0, w, h);

        if (audioAnalyser) {
            audioAnalyser.getFloatTimeDomainData(audioAnalyserData);

            ctx.lineWidth = 1;
            ctx.strokeStyle = "#b95cb9";
            ctx.beginPath();

            const step = w / audioAnalyserData.length;
            let x = step;

            ctx.moveTo(0, h / 2);

            for (let i = 1; i < audioAnalyserData.length; i++) {
                const amplify = 2.5;
                const v = amplify * audioAnalyserData[i];
                const y = (1 + v) * (h / 2);

                ctx.lineTo(x, y);

                x += step;
            }

            ctx.lineTo(w, h / 2);
            ctx.stroke();
        }
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    requestAnimationFrame(drawVisualizer);
}

drawVisualizer();