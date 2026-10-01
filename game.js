/* =========================================================
   MINI METRO STYLE GAME
   ========================================================= */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const gameArea = document.getElementById("gameArea");

const weekEl = document.getElementById("week");
const scoreEl = document.getElementById("score");
const waitingEl = document.getElementById("waiting");
const stationCountEl = document.getElementById("stationCount");
const trainCountEl = document.getElementById("trainCount");
const lineCountEl = document.getElementById("lineCount");
const lineStatusEl = document.getElementById("lineStatus");

const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

const gameOverEl = document.getElementById("gameOver");
const finalScoreEl = document.getElementById("finalScore");
const playAgainBtn = document.getElementById("playAgain");


/* =========================================================
   CONFIG
   ========================================================= */

const STATION_RADIUS = 16;

const STATION_MIN_DISTANCE = 105;
const MAX_STATIONS = 18;

const MAX_WAITING = 12;

const TRAIN_SPEED = 100;
const TRAIN_CAPACITY = 6;

const BOARDING_TIME_PER_PASSENGER = 0.45;

const WEEK_DURATION = 30;

// Stations spawn independently of the week.
const STATION_SPAWN_MIN = 8;
const STATION_SPAWN_MAX = 10;

const PASSENGER_SPAWN_TIME = 4;


/* =========================================================
   COLORS
   ========================================================= */

const COLORS = {
    background: "#eef2f5",

    stationFill: "#ffffff",
    stationStroke: "#1c1f24",

    rail: "#30343b",

    train: "#16181c",
    trainWindow: "#eef2f5",

    passenger: "#20242a",

    text: "#17191d",
    muted: "#6b7280"
};


/* =========================================================
   GAME STATE
   ========================================================= */

let stations = [];
let lines = [];
let passengers = [];
let trains = [];

let score = 0;
let week = 1;

let paused = false;
let gameOver = false;

let lastTime = performance.now();

let weekTimer = 0;

let passengerTimer = 0;

let stationSpawnTimer = 0;
let nextStationSpawn = randomStationSpawnTime();


/* =========================================================
   INPUT STATE
   ========================================================= */

let draggingRail = false;
let railStartStation = null;
let pointerX = 0;
let pointerY = 0;

let draggingTrain = null;


/* =========================================================
   CANVAS
   ========================================================= */

function resizeCanvas() {

    const rect = gameArea.getBoundingClientRect();

    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw();
}

window.addEventListener("resize", resizeCanvas);


/* =========================================================
   WEEK PROGRESS BAR
   ========================================================= */

let weekProgressWrap = null;
let weekProgressFill = null;
let weekProgressPercent = null;

function createWeekProgressBar() {

    if (!weekEl || document.getElementById("weekProgressWrap")) {
        return;
    }

    weekProgressWrap = document.createElement("span");

    weekProgressWrap.id = "weekProgressWrap";

    weekProgressWrap.innerHTML = `
        <span id="weekProgressBar">
            <span id="weekProgressFill"></span>
        </span>
        <span id="weekProgressPercent">0%</span>
    `;

    weekEl.insertAdjacentElement("afterend", weekProgressWrap);

    weekProgressFill =
        document.getElementById("weekProgressFill");

    weekProgressPercent =
        document.getElementById("weekProgressPercent");
}


/* =========================================================
   STATION SPAWN TIMER
   ========================================================= */

function randomStationSpawnTime() {

    return STATION_SPAWN_MIN +
        Math.random() *
        (STATION_SPAWN_MAX - STATION_SPAWN_MIN);
}


/* =========================================================
   INITIAL STATIONS
   ========================================================= */

function createInitialStations() {

    stations = [];

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    stations.push({
        id: 1,
        type: "circle",
        x: w * 0.28,
        y: h * 0.50,
        waiting: []
    });

    stations.push({
        id: 2,
        type: "triangle",
        x: w * 0.50,
        y: h * 0.30,
        waiting: []
    });

    stations.push({
        id: 3,
        type: "square",
        x: w * 0.72,
        y: h * 0.55,
        waiting: []
    });
}


/* =========================================================
   TRAIN
   ========================================================= */

function createInitialTrain() {

    trains = [];

    trains.push({
        id: 1,

        placed: false,
        inDepot: true,

        x: 65,
        y: 65,

        line: null,

        currentIndex: 0,
        progress: 0,

        reverse: false,

        passengers: [],

        boarding: false,
        boardingTimer: 0,

        angle: 0
    });
}


/* =========================================================
   STATION SPAWNING
   ========================================================= */

function spawnRandomStation() {

    if (stations.length >= MAX_STATIONS) {
        return;
    }

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const types = [
        "circle",
        "triangle",
        "square"
    ];

    for (let attempt = 0; attempt < 100; attempt++) {

        const x =
            45 +
            Math.random() *
            Math.max(1, w - 90);

        const y =
            80 +
            Math.random() *
            Math.max(1, h - 125);

        let valid = true;

        for (const station of stations) {

            const dx = station.x - x;
            const dy = station.y - y;

            const distance =
                Math.sqrt(dx * dx + dy * dy);

            if (distance < STATION_MIN_DISTANCE) {

                valid = false;
                break;
            }
        }

        if (!valid) {
            continue;
        }

        stations.push({
            id: Date.now() + Math.random(),

            type:
                types[
                    Math.floor(
                        Math.random() * types.length
                    )
                ],

            x,
            y,

            waiting: []
        });

        updateStats();
        draw();

        return;
    }
}


/* =========================================================
   PASSENGERS
   ========================================================= */

function spawnPassenger() {

    if (stations.length < 2) {
        return;
    }

    if (passengers.length >= MAX_WAITING) {
        return;
    }

    const origin =
        stations[
            Math.floor(
                Math.random() * stations.length
            )
        ];

    let destination;

    do {

        destination =
            stations[
                Math.floor(
                    Math.random() * stations.length
                )
            ];

    } while (
        destination === origin &&
        stations.length > 1
    );

    const passenger = {
        id: Date.now() + Math.random(),

        origin,
        destination,

        type: destination.type
    };

    passengers.push(passenger);

    origin.waiting.push(passenger);

    updateStats();
}


/* =========================================================
   STATION SHAPES
   ========================================================= */

function drawStationShape(type, x, y, size) {

    ctx.beginPath();

    if (type === "circle") {

        ctx.arc(
            x,
            y,
            size,
            0,
            Math.PI * 2
        );
    }

    else if (type === "triangle") {

        ctx.moveTo(
            x,
            y - size
        );

        ctx.lineTo(
            x + size,
            y + size
        );

        ctx.lineTo(
            x - size,
            y + size
        );

        ctx.closePath();
    }

    else if (type === "square") {

        ctx.rect(
            x - size,
            y - size,
            size * 2,
            size * 2
        );
    }

    ctx.fillStyle = COLORS.stationFill;

    ctx.fill();

    ctx.lineWidth = 3;

    ctx.strokeStyle = COLORS.stationStroke;

    ctx.stroke();
}


/* =========================================================
   PASSENGER DESTINATION ICON
   ========================================================= */

function drawPassengerIcon(type, x, y, size) {

    ctx.beginPath();

    if (type === "circle") {

        ctx.arc(
            x,
            y,
            size,
            0,
            Math.PI * 2
        );
    }

    else if (type === "triangle") {

        ctx.moveTo(
            x,
            y - size
        );

        ctx.lineTo(
            x + size,
            y + size
        );

        ctx.lineTo(
            x - size,
            y + size
        );

        ctx.closePath();
    }

    else if (type === "square") {

        ctx.rect(
            x - size,
            y - size,
            size * 2,
            size * 2
        );
    }

    ctx.fillStyle = COLORS.passenger;

    ctx.fill();
}


/* =========================================================
   DRAW STATIONS
   ========================================================= */

function drawStations() {

    for (const station of stations) {

        drawStationShape(
            station.type,
            station.x,
            station.y,
            STATION_RADIUS
        );

        drawWaitingPassengers(station);
    }
}


/* =========================================================
   DRAW WAITING PASSENGERS
   ========================================================= */

function drawWaitingPassengers(station) {

    const waiting = station.waiting;

    const maxVisible = Math.min(
        waiting.length,
        10
    );

    for (let i = 0; i < maxVisible; i++) {

        const passenger = waiting[i];

        const angle =
            (Math.PI * 2 / maxVisible) * i
            - Math.PI / 2;

        const distance = 28;

        const x =
            station.x +
            Math.cos(angle) * distance;

        const y =
            station.y +
            Math.sin(angle) * distance;

        drawPassengerIcon(
            passenger.type,
            x,
            y,
            5
        );
    }

    if (waiting.length > maxVisible) {

        ctx.fillStyle = COLORS.text;

        ctx.font = "bold 10px Poppins, sans-serif";

        ctx.textAlign = "center";

        ctx.fillText(
            `+${waiting.length - maxVisible}`,
            station.x,
            station.y + 34
        );
    }
}


/* =========================================================
   DRAW LINES
   ========================================================= */

function drawLines() {

    for (const line of lines) {

        if (line.stations.length < 2) {
            continue;
        }

        ctx.beginPath();

        ctx.moveTo(
            line.stations[0].x,
            line.stations[0].y
        );

        for (let i = 1; i < line.stations.length; i++) {

            ctx.lineTo(
                line.stations[i].x,
                line.stations[i].y
            );
        }

        ctx.strokeStyle = line.color;

        ctx.lineWidth = 7;

        ctx.lineCap = "round";

        ctx.lineJoin = "round";

        ctx.stroke();
    }
}


/* =========================================================
   LINE COLORS
   ========================================================= */

const LINE_COLORS = [
    "#3b82f6",
    "#ef4444",
    "#8b5cf6",
    "#10b981",
    "#f59e0b"
];


/* =========================================================
   CREATE LINE
   ========================================================= */

function createLine(firstStation, secondStation) {

    const line = {

        id: Date.now() + Math.random(),

        color:
            LINE_COLORS[
                lines.length %
                LINE_COLORS.length
            ],

        stations: [
            firstStation,
            secondStation
        ]
    };

    lines.push(line);

    tryAssignWaitingTrains();

    updateStats();

    draw();
}


/* =========================================================
   CONNECT STATIONS
   ========================================================= */

function connectStations(firstStation, secondStation) {

    if (!firstStation || !secondStation) {
        return;
    }

    if (firstStation === secondStation) {
        return;
    }

    // Try extending an existing line.
    for (const line of lines) {

        const firstIndex =
            line.stations.indexOf(firstStation);

        const secondIndex =
            line.stations.indexOf(secondStation);

        if (
            firstIndex !== -1 &&
            secondIndex === -1
        ) {

            if (
                firstIndex === 0 ||
                firstIndex === line.stations.length - 1
            ) {

                if (firstIndex === 0) {

                    line.stations.unshift(
                        secondStation
                    );
                }

                else {

                    line.stations.push(
                        secondStation
                    );
                }

                tryAssignWaitingTrains();

                updateStats();

                draw();

                return;
            }
        }
    }

    // If both are already connected, do nothing.
    for (const line of lines) {

        for (let i = 0; i < line.stations.length - 1; i++) {

            if (
                (
                    line.stations[i] === firstStation &&
                    line.stations[i + 1] === secondStation
                ) ||
                (
                    line.stations[i] === secondStation &&
                    line.stations[i + 1] === firstStation
                )
            ) {
                return;
            }
        }
    }

    createLine(
        firstStation,
        secondStation
    );
}


/* =========================================================
   FIND STATION
   ========================================================= */

function getStationAt(x, y) {

    for (let i = stations.length - 1; i >= 0; i--) {

        const station = stations[i];

        const dx = station.x - x;
        const dy = station.y - y;

        if (
            Math.sqrt(dx * dx + dy * dy)
            <= STATION_RADIUS + 8
        ) {
            return station;
        }
    }

    return null;
}


/* =========================================================
   RAIL PREVIEW
   ========================================================= */

function drawRailPreview() {

    if (!draggingRail || !railStartStation) {
        return;
    }

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(
        railStartStation.x,
        railStartStation.y
    );

    ctx.lineTo(
        pointerX,
        pointerY
    );

    ctx.strokeStyle = "rgba(30, 34, 40, 0.45)";

    ctx.lineWidth = 6;

    ctx.setLineDash([
        10,
        8
    ]);

    ctx.lineCap = "round";

    ctx.stroke();

    ctx.restore();
}


/* =========================================================
   CLOSEST LINE POINT
   ========================================================= */

function closestLinePoint(x, y) {

    let closest = null;
    let closestDistance = Infinity;

    for (const line of lines) {

        for (
            let i = 0;
            i < line.stations.length - 1;
            i++
        ) {

            const a = line.stations[i];
            const b = line.stations[i + 1];

            const dx = b.x - a.x;
            const dy = b.y - a.y;

            const lengthSquared =
                dx * dx + dy * dy;

            if (lengthSquared === 0) {
                continue;
            }

            let t =
                (
                    (x - a.x) * dx +
                    (y - a.y) * dy
                ) / lengthSquared;

            t = Math.max(
                0,
                Math.min(1, t)
            );

            const px = a.x + dx * t;
            const py = a.y + dy * t;

            const distX = x - px;
            const distY = y - py;

            const distance =
                Math.sqrt(
                    distX * distX +
                    distY * distY
                );

            if (distance < closestDistance) {

                closestDistance = distance;

                closest = {
                    line,
                    index: i,
                    progress: t,
                    x: px,
                    y: py
                };
            }
        }
    }

    return closest;
}


/* =========================================================
   PLACE TRAIN
   ========================================================= */

function placeTrain(train, x, y) {

    const station = getStationAt(x, y);

    if (station) {

        train.inDepot = false;
        train.placed = true;

        train.x = station.x;
        train.y = station.y;

        train.line = findLineContainingStation(
            station
        );

        train.currentIndex =
            train.line
                ? train.line.stations.indexOf(station)
                : 0;

        train.progress = 0;

        train.reverse = false;

        train.angle = 0;

        updateStats();

        return;
    }

    const closest = closestLinePoint(x, y);

    if (
        closest &&
        closestDistanceToPoint(
            x,
            y,
            closest.x,
            closest.y
        ) < 24
    ) {

        train.inDepot = false;
        train.placed = true;

        train.line = closest.line;

        train.currentIndex =
            closest.index;

        train.progress =
            closest.progress;

        train.x = closest.x;
        train.y = closest.y;

        updateTrainAngle(train);

        updateStats();

        return;
    }

    // Invalid drop: return to depot.
    train.inDepot = true;
    train.placed = false;

    train.x = 65;
    train.y = 65;

    train.line = null;

    updateStats();
}


function closestDistanceToPoint(
    x1,
    y1,
    x2,
    y2
) {

    const dx = x1 - x2;
    const dy = y1 - y2;

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


/* =========================================================
   FIND TRAIN LINE
   ========================================================= */

function findLineContainingStation(station) {

    for (const line of lines) {

        if (
            line.stations.includes(station)
        ) {
            return line;
        }
    }

    return null;
}


/* =========================================================
   ASSIGN WAITING TRAINS
   ========================================================= */

function tryAssignWaitingTrains() {

    for (const train of trains) {

        if (
            !train.placed ||
            train.line
        ) {
            continue;
        }

        let closestStation = null;
        let closestDistance = Infinity;

        for (const station of stations) {

            const distance =
                closestDistanceToPoint(
                    train.x,
                    train.y,
                    station.x,
                    station.y
                );

            if (distance < closestDistance) {

                closestDistance = distance;

                closestStation = station;
            }
        }

        if (
            closestStation &&
            closestDistance < 25
        ) {

            const line =
                findLineContainingStation(
                    closestStation
                );

            if (line) {

                train.line = line;

                train.currentIndex =
                    line.stations.indexOf(
                        closestStation
                    );

                train.progress = 0;

                train.reverse = false;
            }
        }
    }
}


/* =========================================================
   TRAIN ANGLE
   ========================================================= */

function updateTrainAngle(train) {

    if (!train.line) {
        return;
    }

    const line = train.line;

    if (
        line.stations.length < 2
    ) {
        return;
    }

    let index =
        train.currentIndex;

    if (
        train.reverse
    ) {

        index =
            Math.max(
                0,
                index - 1
            );
    }

    if (
        index >= line.stations.length - 1
    ) {

        index =
            line.stations.length - 2;
    }

    const a =
        line.stations[index];

    const b =
        line.stations[index + 1];

    if (!a || !b) {
        return;
    }

    let angle =
        Math.atan2(
            b.y - a.y,
            b.x - a.x
        );

    if (train.reverse) {
        angle += Math.PI;
    }

    train.angle = angle;
}


/* =========================================================
   DRAW TRAIN
   ========================================================= */

function drawTrainShape(
    x,
    y,
    angle,
    scale = 1
) {

    ctx.save();

    ctx.translate(x, y);
    ctx.rotate(angle);

    const width = 30 * scale;
    const height = 13 * scale;

    // Train body.
    ctx.fillStyle = COLORS.train;

    ctx.beginPath();

    ctx.roundRect(
        -width / 2,
        -height / 2,
        width - 5 * scale,
        height,
        3 * scale
    );

    ctx.fill();

    // Pointed front.
    ctx.beginPath();

    ctx.moveTo(
        width / 2 - 5 * scale,
        -height / 2
    );

    ctx.lineTo(
        width / 2,
        0
    );

    ctx.lineTo(
        width / 2 - 5 * scale,
        height / 2
    );

    ctx.closePath();

    ctx.fillStyle = COLORS.train;

    ctx.fill();

    // Windows.
    ctx.fillStyle = COLORS.trainWindow;

    ctx.fillRect(
        -width / 2 + 5 * scale,
        -3.5 * scale,
        5 * scale,
        7 * scale
    );

    ctx.fillRect(
        1 * scale,
        -3.5 * scale,
        5 * scale,
        7 * scale
    );

    ctx.restore();
}


/* =========================================================
   DRAW TRAINS
   ========================================================= */

function drawTrains() {

    for (const train of trains) {

        if (train.inDepot) {
            continue;
        }

        drawTrainShape(
            train.x,
            train.y,
            train.angle
        );

        if (train.boarding) {

            ctx.beginPath();

            ctx.arc(
                train.x,
                train.y,
                21,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                "rgba(30, 34, 40, 0.25)";

            ctx.lineWidth = 2;

            ctx.stroke();
        }
    }
}


/* =========================================================
   DRAW TRAIN DEPOT
   ========================================================= */

function drawDepot() {

    const train =
        trains.find(
            t => t.inDepot
        );

    if (!train) {
        return;
    }

    ctx.save();

    ctx.fillStyle =
        "rgba(255,255,255,0.82)";

    ctx.strokeStyle =
        "rgba(28,31,36,0.16)";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.roundRect(
        18,
        18,
        150,
        78,
        14
    );

    ctx.fill();
    ctx.stroke();

    drawTrainShape(
        58,
        53,
        0,
        1.1
    );

    ctx.fillStyle = COLORS.text;

    ctx.font =
        "600 11px Poppins, sans-serif";

    ctx.textAlign = "left";

    ctx.fillText(
        "AVAILABLE TRAIN",
        82,
        48
    );

    ctx.fillStyle = COLORS.muted;

    ctx.font =
        "10px Poppins, sans-serif";

    ctx.fillText(
        "Drag onto a station",
        82,
        66
    );

    ctx.fillText(
        "or an existing rail",
        82,
        81
    );

    ctx.restore();
}


/* =========================================================
   TRAIN HIT TEST
   ========================================================= */

function getDepotTrainAt(x, y) {

    for (const train of trains) {

        if (!train.inDepot) {
            continue;
        }

        if (
            x >= 30 &&
            x <= 85 &&
            y >= 35 &&
            y <= 70
        ) {
            return train;
        }
    }

    return null;
}


/* =========================================================
   TRAIN MOVEMENT
   ========================================================= */

function updateTrains(dt) {

    for (const train of trains) {

        if (
            !train.placed ||
            !train.line
        ) {
            continue;
        }

        const line = train.line;

        if (
            line.stations.length < 2
        ) {
            continue;
        }

        // Boarding happens in real time.
        if (train.boarding) {

            train.boardingTimer -= dt;

            if (
                train.boardingTimer <= 0
            ) {

                boardNextPassenger(train);

            }

            continue;
        }

        let remainingDistance =
            TRAIN_SPEED * dt;

        while (
            remainingDistance > 0
        ) {

            const segment =
                getTrainSegment(train);

            if (!segment) {

                // End of line.
                train.reverse =
                    !train.reverse;

                const newSegment =
                    getTrainSegment(train);

                if (!newSegment) {
                    break;
                }

                continue;
            }

            const dx =
                segment.to.x -
                segment.from.x;

            const dy =
                segment.to.y -
                segment.from.y;

            const segmentLength =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );

            if (
                segmentLength <= 0
            ) {
                break;
            }

            let distanceRemaining;

            if (!train.reverse) {

                distanceRemaining =
                    segmentLength *
                    (1 - train.progress);
            }

            else {

                distanceRemaining =
                    segmentLength *
                    train.progress;
            }

            const movement =
                Math.min(
                    remainingDistance,
                    distanceRemaining
                );

            const progressChange =
                movement /
                segmentLength;

            if (!train.reverse) {

                train.progress +=
                    progressChange;
            }

            else {

                train.progress -=
                    progressChange;
            }

            remainingDistance -= movement;

            updateTrainPosition(train);

            if (
                movement >=
                distanceRemaining - 0.0001
            ) {

                arriveAtStation(
                    train,
                    segment
                );
            }
        }

        updateTrainPosition(train);
    }
}


/* =========================================================
   TRAIN SEGMENT
   ========================================================= */

function getTrainSegment(train) {

    const line = train.line;

    if (!line) {
        return null;
    }

    if (!train.reverse) {

        if (
            train.currentIndex >=
            line.stations.length - 1
        ) {
            return null;
        }

        return {
            from:
                line.stations[
                    train.currentIndex
                ],

            to:
                line.stations[
                    train.currentIndex + 1
                ]
        };
    }

    else {

        if (
            train.currentIndex <= 0
        ) {
            return null;
        }

        return {
            from:
                line.stations[
                    train.currentIndex
                ],

            to:
                line.stations[
                    train.currentIndex - 1
                ]
        };
    }
}


/* =========================================================
   TRAIN POSITION
   ========================================================= */

function updateTrainPosition(train) {

    const segment =
        getTrainSegment(train);

    if (!segment) {
        return;
    }

    train.x =
        segment.from.x +
        (
            segment.to.x -
            segment.from.x
        ) *
        train.progress;

    train.y =
        segment.from.y +
        (
            segment.to.y -
            segment.from.y
        ) *
        train.progress;

    updateTrainAngle(train);
}


/* =========================================================
   ARRIVE AT STATION
   ========================================================= */

function arriveAtStation(
    train,
    segment
) {

    let station;

    if (!train.reverse) {

        station = segment.to;

        train.currentIndex++;

    }

    else {

        station = segment.to;

        train.currentIndex--;
    }

    train.progress = 0;

    train.x = station.x;
    train.y = station.y;

    unloadPassengers(
        train,
        station
    );

    if (
        train.passengers.length <
        TRAIN_CAPACITY &&
        station.waiting.length > 0
    ) {

        train.boarding = true;

        train.boardingTimer =
            BOARDING_TIME_PER_PASSENGER;

    }

    updateTrainAngle(train);

    updateStats();
}


/* =========================================================
   UNLOAD
   ========================================================= */

function unloadPassengers(
    train,
    station
) {

    const before =
        train.passengers.length;

    train.passengers =
        train.passengers.filter(
            passenger => {

                if (
                    passenger.destination ===
                    station
                ) {

                    score++;

                    return false;
                }

                return true;
            }
        );

    if (
        train.passengers.length !==
        before
    ) {

        updateStats();
    }
}


/* =========================================================
   BOARD NEXT PASSENGER
   ========================================================= */

function boardNextPassenger(train) {

    if (
        train.passengers.length >=
        TRAIN_CAPACITY
    ) {

        train.boarding = false;

        return;
    }

    const station =
        getTrainStation(
            train
        );

    if (!station) {

        train.boarding = false;

        return;
    }

    if (
        station.waiting.length === 0
    ) {

        train.boarding = false;

        return;
    }

    const passenger =
        station.waiting.shift();

    const passengerIndex =
        passengers.indexOf(passenger);

    if (passengerIndex !== -1) {

        passengers.splice(
            passengerIndex,
            1
        );
    }

    train.passengers.push(
        passenger
    );

    if (
        train.passengers.length <
            TRAIN_CAPACITY &&
        station.waiting.length > 0
    ) {

        train.boardingTimer =
            BOARDING_TIME_PER_PASSENGER;

    }

    else {

        train.boarding = false;
    }

    updateStats();
}


/* =========================================================
   GET TRAIN STATION
   ========================================================= */

function getTrainStation(train) {

    if (!train.line) {
        return null;
    }

    if (
        train.currentIndex < 0 ||
        train.currentIndex >=
            train.line.stations.length
    ) {
        return null;
    }

    return train.line.stations[
        train.currentIndex
    ];
}


/* =========================================================
   POINTER DOWN
   ========================================================= */

canvas.addEventListener(
    "pointerdown",
    event => {

        if (
            paused ||
            gameOver
        ) {
            return;
        }

        const rect =
            canvas.getBoundingClientRect();

        pointerX =
            event.clientX -
            rect.left;

        pointerY =
            event.clientY -
            rect.top;

        // Check the train depot first.
        const depotTrain =
            getDepotTrainAt(
                pointerX,
                pointerY
            );

        if (depotTrain) {

            draggingTrain =
                depotTrain;

            canvas.setPointerCapture(
                event.pointerId
            );

            return;
        }

        // Otherwise start drawing a rail.
        const station =
            getStationAt(
                pointerX,
                pointerY
            );

        if (station) {

            draggingRail = true;

            railStartStation =
                station;

            canvas.setPointerCapture(
                event.pointerId
            );

            draw();
        }
    }
);


/* =========================================================
   POINTER MOVE
   ========================================================= */

canvas.addEventListener(
    "pointermove",
    event => {

        const rect =
            canvas.getBoundingClientRect();

        pointerX =
            event.clientX -
            rect.left;

        pointerY =
            event.clientY -
            rect.top;

        if (draggingTrain) {

            draggingTrain.x =
                pointerX;

            draggingTrain.y =
                pointerY;

            draw();

            return;
        }

        if (draggingRail) {

            draw();
        }
    }
);


/* =========================================================
   POINTER UP
   ========================================================= */

canvas.addEventListener(
    "pointerup",
    event => {

        if (draggingTrain) {

            placeTrain(
                draggingTrain,
                pointerX,
                pointerY
            );

            draggingTrain = null;

            draw();

            return;
        }

        if (draggingRail) {

            const endStation =
                getStationAt(
                    pointerX,
                    pointerY
                );

            if (
                endStation &&
                endStation !==
                    railStartStation
            ) {

                connectStations(
                    railStartStation,
                    endStation
                );
            }

            draggingRail = false;

            railStartStation = null;

            draw();
        }
    }
);


/* =========================================================
   RIGHT CLICK — DELETE RAIL SECTION
   ========================================================= */

canvas.addEventListener(
    "contextmenu",
    event => {

        event.preventDefault();

        if (
            paused ||
            gameOver
        ) {
            return;
        }

        const rect =
            canvas.getBoundingClientRect();

        const x =
            event.clientX -
            rect.left;

        const y =
            event.clientY -
            rect.top;

        removeRailAt(x, y);
    }
);


/* =========================================================
   REMOVE RAIL
   ========================================================= */

function removeRailAt(x, y) {

    const closest =
        closestLinePoint(x, y);

    if (
        !closest ||
        closestDistanceToPoint(
            x,
            y,
            closest.x,
            closest.y
        ) > 18
    ) {
        return;
    }

    const line =
        closest.line;

    const index =
        closest.index;

    if (
        line.stations.length <= 2
    ) {

        const lineIndex =
            lines.indexOf(line);

        if (lineIndex !== -1) {

            lines.splice(
                lineIndex,
                1
            );
        }

    }

    else if (
        index === 0
    ) {

        line.stations.shift();

    }

    else {

        line.stations.splice(
            index + 1
        );
    }

    // Make sure the train doesn't reference
    // a line that no longer exists.
    for (const train of trains) {

        if (
            train.line === line &&
            !lines.includes(line)
        ) {

            train.line = null;
        }
    }

    updateStats();

    draw();
}


/* =========================================================
   UPDATE GAME
   ========================================================= */

function update(dt) {

    if (
        paused ||
        gameOver
    ) {
        return;
    }

    // -----------------------------------------
    // WEEK
    // -----------------------------------------

    weekTimer += dt;

    if (
        weekTimer >= WEEK_DURATION
    ) {

        weekTimer -= WEEK_DURATION;

        week++;

        updateStats();
    }

    // -----------------------------------------
    // STATION SPAWNING
    // -----------------------------------------

    stationSpawnTimer += dt;

    if (
        stationSpawnTimer >=
        nextStationSpawn
    ) {

        spawnRandomStation();

        stationSpawnTimer = 0;

        nextStationSpawn =
            randomStationSpawnTime();
    }

    // -----------------------------------------
    // PASSENGERS
    // -----------------------------------------

    passengerTimer += dt;

    if (
        passengerTimer >=
        PASSENGER_SPAWN_TIME
    ) {

        passengerTimer = 0;

        spawnPassenger();
    }

    // -----------------------------------------
    // TRAIN
    // -----------------------------------------

    updateTrains(dt);

    // -----------------------------------------
    // GAME OVER
    // -----------------------------------------

    const waiting =
        passengers.length;

    if (
        waiting >= MAX_WAITING
    ) {

        endGame();
    }
}


/* =========================================================
   WEEK BAR
   ========================================================= */

function updateWeekProgress() {

    if (!weekProgressFill) {
        return;
    }

    const percentage =
        Math.min(
            100,
            (
                weekTimer /
                WEEK_DURATION
            ) * 100
        );

    weekProgressFill.style.width =
        `${percentage}%`;

    if (weekProgressPercent) {

        weekProgressPercent.textContent =
            `${Math.floor(percentage)}%`;
    }
}


/* =========================================================
   DRAW EVERYTHING
   ========================================================= */

function draw() {

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(
        0,
        0,
        w,
        h
    );

    // Background.
    ctx.fillStyle =
        COLORS.background;

    ctx.fillRect(
        0,
        0,
        w,
        h
    );

    drawLines();

    drawStations();

    drawTrains();

    // Draw dragged train.
    if (draggingTrain) {

        drawTrainShape(
            draggingTrain.x,
            draggingTrain.y,
            0
        );
    }

    drawDepot();

    drawRailPreview();

    updateWeekProgress();
}


/* =========================================================
   STATS
   ========================================================= */

function updateStats() {

    if (scoreEl) {
        scoreEl.textContent =
            score;
    }

    if (weekEl) {
        weekEl.textContent =
            `Week ${week}`;
    }

    if (waitingEl) {
        waitingEl.textContent =
            passengers.length;
    }

    if (stationCountEl) {
        stationCountEl.textContent =
            stations.length;
    }

    if (trainCountEl) {
        trainCountEl.textContent =
            trains.length;
    }

    if (lineCountEl) {
        lineCountEl.textContent =
            lines.length;
    }

    if (lineStatusEl) {

        if (lines.length === 0) {

            lineStatusEl.textContent =
                "Drag between stations to build a rail";

        }

        else if (
            trains.some(
                train =>
                    train.placed &&
                    train.line
            )
        ) {

            lineStatusEl.textContent =
                "Train running";

        }

        else {

            lineStatusEl.textContent =
                "Drag the train onto a rail";
        }
    }
}


/* =========================================================
   GAME OVER
   ========================================================= */

function endGame() {

    gameOver = true;

    if (finalScoreEl) {

        finalScoreEl.textContent =
            score;
    }

    if (gameOverEl) {

        gameOverEl.classList.add(
            "show"
        );
    }
}


/* =========================================================
   RESTART
   ========================================================= */

function restartGame() {

    score = 0;

    week = 1;

    weekTimer = 0;

    passengerTimer = 0;

    stationSpawnTimer = 0;

    nextStationSpawn =
        randomStationSpawnTime();

    passengers = [];

    lines = [];

    draggingRail = false;

    railStartStation = null;

    draggingTrain = null;

    gameOver = false;

    paused = false;

    createInitialStations();

    createInitialTrain();

    if (gameOverEl) {

        gameOverEl.classList.remove(
            "show"
        );
    }

    updateStats();

    draw();
}


/* =========================================================
   BUTTONS
   ========================================================= */

if (pauseBtn) {

    pauseBtn.addEventListener(
        "click",
        () => {

            paused = !paused;

            pauseBtn.textContent =
                paused
                    ? "Resume"
                    : "Pause";
        }
    );
}


if (restartBtn) {

    restartBtn.addEventListener(
        "click",
        restartGame
    );
}


if (playAgainBtn) {

    playAgainBtn.addEventListener(
        "click",
        restartGame
    );
}


/* =========================================================
   GAME LOOP
   ========================================================= */

function gameLoop(now) {

    const dt =
        Math.min(
            (now - lastTime) / 1000,
            0.05
        );

    lastTime = now;

    update(dt);

    draw();

    requestAnimationFrame(
        gameLoop
    );
}


/* =========================================================
   START
   ========================================================= */

createWeekProgressBar();

resizeCanvas();

createInitialStations();

createInitialTrain();

updateStats();

draw();

requestAnimationFrame(
    gameLoop
);
