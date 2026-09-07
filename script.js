const welcome = document.querySelector("dialog.welcome");
const playing = document.querySelector("dialog.playing");
const final = document.querySelector("dialog.final");
const over = document.querySelector("dialog.over");

const startButton = document.querySelector("button#start");
const restartButton = document.querySelector("button#restart");

const message = document.querySelector("#message");
const status = document.querySelector("#status");

const mp3 = fetch("res/35%20Lost%20Woods.mp3").then(res => res.arrayBuffer());
let audioCtx;


const initialView = [-27.62, 153.16], initialZoom = 15;


const startingPoint = [-27.66698615358153, 153.19394886528173];
const finalPoint = [-27.668499435630004, 153.19502699184514];
const path = [
    startingPoint,
    [-27.66752539730453, 153.193841528621],
    [-27.667684556810915, 153.19488476762743],
    [-27.667789138375777, 153.19496263197766],
    [-27.66789128843237, 153.19498676692794],
    finalPoint
];

const radius = 20;

let state = "initial";


let map = L.map('map').setView(initialView, initialZoom);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

L.circle(startingPoint, radius, { color: 'red' }).addTo(map);

// DEBUG
if (true) {
    L.polyline(path, { color: 'red' }).addTo(map);

    map.on("click", (e) => {
        console.log(`[${e.latlng.lat}, ${e.latlng.lng}]`);
    });
}


let lc = L.control.locate({
    setView: "always",
    flyTo: true,
    clickBehavior: { inView: 'setView', outOfView: 'inView', inViewNotFollowing: 'inView' },
    showPopup: false
}).addTo(map);

lc.start();


welcome.showModal();


map.on("locationfound", (e) => {
    // GPS granted and working
    if (state == "walk-to-start") {
        let distance = map.distance(e.latlng, startingPoint);
        status.textContent = `: ${distance.toFixed(0)}m`;

        if (distance <= radius) {
            // Player reached starting point
            startAudio();
            state = "playing";
            message.textContent = "Find your way through Lost Woods without getting lost"
            status.textContent = "";
        }
    }

    // TODO: calculate distance to path, set audio volume, detect end game and game over
    if (state == "playing") {
        let distance = map.distance(e.latlng, finalPoint);

        if (distance <= radius) {
            // Player reached final point
            stopAudio();
            state = "final";
            playing.close();
            final.showModal();
        }

        let turfPoint = turf.point([e.latlng.lng, e.latlng.lat]);
        let turfPath = turf.lineString(path.map(p => p.toReversed()));
        let nearestPoint = turf.nearestPointOnLine(turfPath, turfPoint, { units: "m" });

        status.textContent = `: ${nearestPoint.properties.dist.toFixed(0)}m`;
    }
});


startButton.addEventListener("click", () => {
    welcome.close();
    playing.show();
    state = "walk-to-start";
    message.textContent = "Please walk to the starting position shown in red on the map";
    status.textContent = "";
});


async function startAudio() {
    audioCtx = new AudioContext();
    let source = audioCtx.createBufferSource();

    source.buffer = await audioCtx.decodeAudioData(await mp3);
    source.connect(audioCtx.destination);
    source.loop = true;
    source.loopStart = 2.035;
    source.loopEnd = 32.925;

    source.start();
};

async function stopAudio() {
    await audioCtx.close();
    audioCtx = null;
}