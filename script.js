const dialog = document.querySelector("dialog");
const message = dialog.querySelector("p");
const startButton = dialog.querySelector("button#start");

const mp3 = fetch("res/35%20Lost%20Woods.mp3").then(res => res.arrayBuffer());


let state = "initial";


let map = L.map('map').setView([-27.500, 153.00], 10);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let lc = L.control.locate({
    setView: "always",
    flyTo: true,
    clickBehavior: { inView: 'setView', outOfView: 'inView', inViewNotFollowing: 'inView' },
    showPopup: false
}).addTo(map);

lc.start();


map.on("load", () => {
    console.log("Map loaded");
    state = "waiting-gps";
    message.innerText = "Waiting for GPS... please allow access to your location"
});

map.on("locationfound", (e) => {
    console.log("Location found");
    state = "ready";
    message.innerText = "Ready to start!";
});



startButton.addEventListener("click", async () => {
    let audioCtx = new AudioContext();
    let source = audioCtx.createBufferSource();

    source.buffer = await audioCtx.decodeAudioData(await mp3);
    source.connect(audioCtx.destination);
    source.loop = true;
    source.loopStart = 2.035;
    source.loopEnd = 32.925;

    source.start();
});