/* =========================================================
   MINI METRO PROTOTYPE
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

const gameOver = document.getElementById("gameOver");
const finalScore = document.getElementById("finalScore");
const playAgain = document.getElementById("playAgain");


/* =========================================================
   SETTINGS
   ========================================================= */

const WEEK_DURATION = 30;

const TRAIN_SPEED = 100;

const TRAIN_CAPACITY = 6;

const PASSENGER_SPAWN_TIME = 4;

const BOARDING_TIME_PER_PASSENGER = 0.45;

const STATION_RADIUS = 15;

const STATION_MIN_DISTANCE = 100;

const MAX_STATIONS = 15;

const MAX_WAITING = 12;


/* =========================================================
   COLORS
   ========================================================= */

const COLORS = {
    circle: "#4da3ff",
    triangle: "#f2c94c",
    square: "#e76f51",

    line1: "#e85d4a",
    line2: "#4da3ff",
    line3: "#a66cff",
    line4: "#43c59e",
    line5: "#f2c94c",

    station: "#111827",
    stationInner: "#f8fafc",

    passenger: "#111827",

    train: "#f8fafc",
    trainOutline: "#111827",
    trainWindow: "#94a3b8"
};


/* =========================================================
   GAME STATE
   ========================================================= */

let stations = [];
let lines = [];
let trains = [];
let passengers = [];

let score = 0;

let week = 1;

let weekProgress = 0;

let passengerSpawnTimer = 0;

let paused = false;

let gameEnded = false;

let lastTime = performance.now();

let nextStationId = 1;
let nextPassengerId = 1;
let nextTrainId = 1;
let nextLineId = 1;

let dragging = false;
let dragStartStation = null;

let trainBeingDragged = null;
let trainDragOffset = { x: 0, y: 0 };

let selectedLineForTrain = null;

let nextLineColorIndex = 0;


/* =========================================================
   RESIZE
   ========================================================= */

function resizeCanvas() {

    const rect = gameArea.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;

    repositionStations();

    draw();
}


function repositionStations() {

    if (!stations.length) return;

    /*
       Keep stations proportional to the game area when
       the browser resizes.
    */

    stations.forEach(station => {

        station.x = station.relativeX * canvas.width;
        station.y = station.relativeY * canvas.height;

    });

}


/* =========================================================
   STATION CREATION
   ========================================================= */

function createStation(type, x, y) {

    const station = {

        id: nextStationId++,

        type,

        x,
        y,

        relativeX: x / canvas.width,
        relativeY: y / canvas.height,

        passengers: [],

        pulse: 0

    };

    stations.push(station);

    return station;
}


/* =========================================================
   INITIAL STATIONS
   ========================================================= */

function createInitialStations() {

    stations = [];

    createStation(
        "circle",
        canvas.width * 0.28,
        canvas.height * 0.42
    );

    createStation(
        "triangle",
        canvas.width * 0.52,
        canvas.height * 0.67
    );

    createStation(
        "square",
        canvas.width * 0.72,
        canvas.height * 0.35
    );

}


/* =========================================================
   RANDOM STATIONS
   ========================================================= */

function spawnRandomStation() {

    if (stations.length >= MAX_STATIONS) return;

    const types = [
        "circle",
        "triangle",
        "square"
    ];

    let attempts = 0;

    while (attempts < 100) {

        attempts++;

        const margin = 70;

        const x =
            margin +
            Math.random() *
            (canvas.width - margin * 2);

        const y =
            margin +
            Math.random() *
            (canvas.height - margin * 2);

        let tooClose = false;

        for (const station of stations) {

            const dx = station.x - x;
            const dy = station.y - y;

            const distance = Math.sqrt(
                dx * dx + dy * dy
            );

            if (distance < STATION_MIN_DISTANCE) {

                tooClose = true;
                break;

            }

        }

        if (tooClose) continue;

        const type =
            types[Math.floor(Math.random() * types.length)];

        const station = createStation(type, x, y);

        station.pulse = 1;

        updateUI();

        return station;
    }

}


/* =========================================================
   LINE CREATION
   ========================================================= */

function createLine() {

    const colors = [
        COLORS.line1,
        COLORS.line2,
        COLORS.line3,
        COLORS.line4,
        COLORS.line5
    ];

    const color =
        colors[nextLineColorIndex % colors.length];

    nextLineColorIndex++;

    const line = {

        id: nextLineId++,

        stations: [],

        loop: false,

        color

    };

    lines.push(line);

    updateUI();

    return line;
}


/* =========================================================
   ADD STATION TO LINE
   ========================================================= */

function addStationToLine(line, station) {

    if (!line) return;

    if (line.stations.includes(station)) return;

    /*
       New stations are added to the end of the line.
       Existing train positions are NOT reset.
    */

    line.stations.push(station);

    /*
       If a train is sitting at the old endpoint, keep it there.
       It will naturally continue when the new section is added.
    */

    updateUI();

    draw();
}


/* =========================================================
   LOOP
   ========================================================= */

function closeLineLoop(line) {

    if (!line) return;

    if (line.stations.length < 3) return;

    line.loop = true;

    draw();
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
            <= STATION_RADIUS + 10
        ) {

            return station;

        }

    }

    return null;
}


/* =========================================================
   FIND TRAIN
   ========================================================= */

function getTrainAt(x, y) {

    for (let i = trains.length - 1; i >= 0; i--) {

        const train = trains[i];

        const dx = train.x - x;
        const dy = train.y - y;

        if (
            Math.abs(dx) < 18 &&
            Math.abs(dy) < 12
        ) {

            return train;

        }

    }

    return null;
}


/* =========================================================
   MOUSE / POINTER EVENTS
   ========================================================= */

canvas.addEventListener("pointerdown", event => {

    if (gameEnded) return;

    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    /*
       First check whether the player grabbed a train.
    */

    const train = getTrainAt(x, y);

    if (train && train.waitingForPlacement) {

        trainBeingDragged = train;

        trainDragOffset.x = train.x - x;
        trainDragOffset.y = train.y - y;

        canvas.setPointerCapture(event.pointerId);

        return;
    }


    /*
       Otherwise check for a station.
    */

    const station = getStationAt(x, y);

    if (!station) return;

    dragging = true;

    dragStartStation = station;

    canvas.setPointerCapture(event.pointerId);

});


canvas.addEventListener("pointermove", event => {

    if (gameEnded) return;

    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;


    /*
       Train placement.
    */

    if (trainBeingDragged) {

        trainBeingDragged.x =
            x + trainDragOffset.x;

        trainBeingDragged.y =
            y + trainDragOffset.y;

        draw();

        return;
    }


    if (!dragging) return;

    draw();

    /*
       Preview the line being drawn.
    */

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(
        dragStartStation.x,
        dragStartStation.y
    );

    ctx.lineTo(x, y);

    ctx.strokeStyle = COLORS.line1;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.45;
    ctx.lineCap = "round";

    ctx.stroke();

    ctx.restore();

});


canvas.addEventListener("pointerup", event => {

    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;


    /*
       Train placement.
    */

    if (trainBeingDragged) {

        const station = getStationAt(x, y);

        if (station) {

            placeTrainOnLine(
                trainBeingDragged,
                station
            );

        }

        trainBeingDragged.waitingForPlacement = true;

        trainBeingDragged = null;

        draw();

        return;
    }


    if (!dragging) return;

    dragging = false;

    const endStation = getStationAt(x, y);

    if (!endStation) {

        dragStartStation = null;

        draw();

        return;
    }

    /*
       If there is already a line containing the
       starting station, extend that line.
    */

    let line = lines.find(
        l => l.stations.includes(dragStartStation)
    );


    /*
       If there is no line, create one.
    */

    if (!line) {

        line = createLine();

        addStationToLine(
            line,
            dragStartStation
        );

    }


    /*
       Dragging back to the first station creates a loop.
    */

    if (
        endStation === line.stations[0] &&
        line.stations.length >= 3
    ) {

        closeLineLoop(line);

    } else {

        addStationToLine(
            line,
            endStation
        );

    }


    dragStartStation = null;

    draw();

});


/* =========================================================
   RIGHT CLICK = DELETE SECTION
   ========================================================= */

canvas.addEventListener("contextmenu", event => {

    event.preventDefault();

    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    removeLineSection(x, y);

});


/* =========================================================
   DISTANCE TO LINE SEGMENT
   ========================================================= */

function pointToSegmentDistance(
    px,
    py,
    x1,
    y1,
    x2,
    y2
) {

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {

        return Math.hypot(
            px - x1,
            py - y1
        );

    }

    const t =
        Math.max(
            0,
            Math.min(
                1,
                (
                    (px - x1) * dx +
                    (py - y1) * dy
                ) /
                (dx * dx + dy * dy)
            )
        );

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return Math.hypot(
        px - closestX,
        py - closestY
    );

}


/* =========================================================
   DELETE LINE SECTION
   ========================================================= */

function removeLineSection(x, y) {

    for (const line of lines) {

        const stationList = line.stations;

        for (let i = 0; i < stationList.length - 1; i++) {

            const a = stationList[i];
            const b = stationList[i + 1];

            const distance = pointToSegmentDistance(
                x,
                y,
                a.x,
                a.y,
                b.x,
                b.y
            );

            if (distance < 12) {

                /*
                   Remove the connection by removing the
                   second station from this line.

                   This keeps the prototype's line model simple.
                */

                stationList.splice(i + 1, 1);

                line.loop = false;

                updateUI();

                draw();

                return;
            }

        }


        /*
           Check the closing section of a loop.
        */

        if (line.loop && stationList.length >= 3) {

            const a =
                stationList[stationList.length - 1];

            const b =
                stationList[0];

            const distance = pointToSegmentDistance(
                x,
                y,
                a.x,
                a.y,
                b.x,
                b.y
            );

            if (distance < 12) {

                line.loop = false;

                draw();

                return;
            }

        }

    }

}


/* =========================================================
   TRAIN CREATION
   ========================================================= */

function createTrain() {

    const train = {

        id: nextTrainId++,

        line: null,

        currentIndex: 0,

        progress: 0,

        reverse: false,

        passengers: [],

        x: 0,

        y: 0,

        angle: 0,

        waitingForPlacement: true,

        boarding: false,

        boardingTimer: 0,

        boardingStation: null

    };

    trains.push(train);

    updateUI();

    return train;
}


/* =========================================================
   PLACE TRAIN ON LINE
   ========================================================= */

function placeTrainOnLine(train, station) {

    /*
       Find a line that contains this station.
    */

    const possibleLines =
        lines.filter(
            line => line.stations.includes(station)
        );

    if (!possibleLines.length) {

        return;

    }

    /*
       If multiple lines use this station, choose the
       first one for now.
    */

    const line = possibleLines[0];

    train.line = line;

    train.waitingForPlacement = false;

    train.currentIndex =
        line.stations.indexOf(station);

    train.progress = 0;

    train.reverse = false;

    train.x = station.x;

    train.y = station.y;

    /*
       Find the direction of travel.
    */

    updateTrainPosition(train);

    updateUI();

}


/* =========================================================
   GET TRAIN TARGET SEGMENT
   ========================================================= */

function getTrainSegment(train) {

    const line = train.line;

    if (!line || line.stations.length < 2) {

        return null;

    }

    let nextIndex;

    if (train.reverse) {

        nextIndex = train.currentIndex - 1;

        if (nextIndex < 0) {

            if (line.loop) {

                nextIndex =
                    line.stations.length - 1;

            } else {

                return null;

            }

        }

    } else {

        nextIndex = train.currentIndex + 1;

        if (
            nextIndex >= line.stations.length
        ) {

            if (line.loop) {

                nextIndex = 0;

            } else {

                return null;

            }

        }

    }

    return {

        from:
            line.stations[train.currentIndex],

        to:
            line.stations[nextIndex],

        nextIndex

    };

}


/* =========================================================
   TRAIN POSITION
   ========================================================= */

function updateTrainPosition(train) {

    const segment = getTrainSegment(train);

    if (!segment) {

        const station =
            train.line.stations[train.currentIndex];

        if (station) {

            train.x = station.x;
            train.y = station.y;

        }

        return;

    }

    const from = segment.from;
    const to = segment.to;

    train.x =
        from.x +
        (to.x - from.x) *
        train.progress;

    train.y =
        from.y +
        (to.y - from.y) *
        train.progress;

    train.angle =
        Math.atan2(
            to.y - from.y,
            to.x - from.x
        );

    /*
       If travelling backwards, point the train
       in the opposite direction.
    */

    if (train.reverse) {

        train.angle += Math.PI;

    }

}


/* =========================================================
   MOVE TRAIN
   ========================================================= */

function moveTrain(train, seconds) {

    if (
        !train.line ||
        train.line.stations.length < 2 ||
        train.waitingForPlacement
    ) {

        return;

    }


    /*
       Boarding takes priority over movement.
    */

    if (train.boarding) {

        train.boardingTimer -= seconds;

        if (train.boardingTimer <= 0) {

            finishBoarding(train);

        }

        updateTrainPosition(train);

        return;

    }


    let remainingDistance =
        TRAIN_SPEED * seconds;


    /*
       One update can cross several stations.
       This is useful when the game lags.
    */

    while (remainingDistance > 0) {

        const segment = getTrainSegment(train);

        if (!segment) {

            /*
               At the end of a normal line,
               reverse direction.
            */

            train.reverse = !train.reverse;

            continue;

        }

        const from = segment.from;
        const to = segment.to;

        const segmentLength =
            Math.hypot(
                to.x - from.x,
                to.y - from.y
            );

        if (segmentLength === 0) {

            train.currentIndex =
                segment.nextIndex;

            train.progress = 0;

            continue;

        }


        const distanceRemainingOnSegment =
            segmentLength *
            (1 - train.progress);


        if (
            remainingDistance <
            distanceRemainingOnSegment
        ) {

            train.progress +=
                remainingDistance /
                segmentLength;

            remainingDistance = 0;

        } else {

            remainingDistance -=
                distanceRemainingOnSegment;

            /*
               Arrived at the next station.
            */

            train.currentIndex =
                segment.nextIndex;

            train.progress = 0;

            updateTrainPosition(train);

            handleTrainArrival(
                train,
                train.line.stations[
                    train.currentIndex
                ]
            );

            /*
               A boarding event can stop the train
               immediately.
            */

            if (train.boarding) {

                break;

            }

        }

    }


    updateTrainPosition(train);

}


/* =========================================================
   TRAIN ARRIVAL
   ========================================================= */

function handleTrainArrival(train, station) {

    if (!station) return;

    /*
       First unload passengers whose destination
       is this station.
    */

    const remaining = [];

    for (const passenger of train.passengers) {

        if (passenger.destination === station) {

            score += 10;

            continue;

        }

        remaining.push(passenger);

    }

    train.passengers = remaining;


    /*
       Then begin boarding.

       IMPORTANT:
       We do NOT instantly add everyone.
       The train waits and boards passengers
       one at a time.
    */

    startBoarding(train, station);

}


/* =========================================================
   START BOARDING
   ========================================================= */

function startBoarding(train, station) {

    if (
        train.passengers.length >=
        TRAIN_CAPACITY
    ) {

        return;

    }

    const available =
        station.passengers.filter(
            passenger =>
                passenger.destination !== station &&
                !train.passengers.some(
                    p => p.id === passenger.id
                )
        );


    if (!available.length) {

        return;

    }


    train.boarding = true;

    train.boardingStation = station;

    train.boardingTimer =
        BOARDING_TIME_PER_PASSENGER;

}


/* =========================================================
   FINISH ONE PASSENGER BOARDING
   ========================================================= */

function finishBoarding(train) {

    const station =
        train.boardingStation;

    if (!station) {

        train.boarding = false;

        return;

    }


    /*
       If the train became full, stop boarding.
    */

    if (
        train.passengers.length >=
        TRAIN_CAPACITY
    ) {

        train.boarding = false;

        train.boardingStation = null;

        return;

    }


    const passengerIndex =
        station.passengers.findIndex(
            passenger =>
                passenger.destination !== station
        );


    if (passengerIndex === -1) {

        train.boarding = false;

        train.boardingStation = null;

        return;

    }


    /*
       Actually move the passenger from the station
       onto the train.
    */

    const passenger =
        station.passengers.splice(
            passengerIndex,
            1
        )[0];

    train.passengers.push(passenger);

    updateUI();


    /*
       Continue boarding another passenger.
    */

    if (
        train.passengers.length <
            TRAIN_CAPACITY &&
        station.passengers.some(
            passenger =>
                passenger.destination !== station
        )
    ) {

        train.boardingTimer =
            BOARDING_TIME_PER_PASSENGER;

    } else {

        train.boarding = false;

        train.boardingStation = null;

    }

}


/* =========================================================
   PASSENGER SPAWNING
   ========================================================= */

function spawnPassenger() {

    if (stations.length < 2) return;

    const station =
        stations[
            Math.floor(
                Math.random() *
                stations.length
            )
        ];


    const possibleDestinations =
        stations.filter(
            s => s !== station
        );


    if (!possibleDestinations.length) return;


    const destination =
        possibleDestinations[
            Math.floor(
                Math.random() *
                possibleDestinations.length
            )
        ];


    const passenger = {

        id: nextPassengerId++,

        origin: station,

        destination,

        type: destination.type,

        age: 0

    };


    station.passengers.push(
        passenger
    );

    updateUI();

}


/* =========================================================
   PASSENGER DESTINATION ICON
   ========================================================= */

function drawPassengerIcon(
    type,
    x,
    y,
    size
) {

    ctx.save();

    ctx.translate(x, y);

    ctx.fillStyle = COLORS.passenger;

    ctx.strokeStyle = COLORS.passenger;

    ctx.lineWidth = 1.5;


    if (type === "circle") {

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            size,
            0,
            Math.PI * 2
        );

        ctx.fill();

    }


    if (type === "triangle") {

        ctx.beginPath();

        ctx.moveTo(
            0,
            -size
        );

        ctx.lineTo(
            size,
            size
        );

        ctx.lineTo(
            -size,
            size
        );

        ctx.closePath();

        ctx.fill();

    }


    if (type === "square") {

        ctx.fillRect(
            -size,
            -size,
            size * 2,
            size * 2
        );

    }

    ctx.restore();

}


/* =========================================================
   DRAW STATION
   ========================================================= */

function drawStation(station) {

    ctx.save();

    ctx.translate(
        station.x,
        station.y
    );


    /*
       Pulse when a new station appears.
    */

    if (station.pulse > 0) {

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            STATION_RADIUS +
            station.pulse * 20,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            getStationColor(station.type);

        ctx.lineWidth = 3;

        ctx.globalAlpha =
            station.pulse;

        ctx.stroke();

    }


    ctx.fillStyle =
        COLORS.stationInner;

    ctx.strokeStyle =
        getStationColor(station.type);

    ctx.lineWidth = 5;


    ctx.beginPath();


    if (station.type === "circle") {

        ctx.arc(
            0,
            0,
            STATION_RADIUS,
            0,
            Math.PI * 2
        );

    }


    if (station.type === "triangle") {

        ctx.moveTo(
            0,
            -STATION_RADIUS
        );

        ctx.lineTo(
            STATION_RADIUS,
            STATION_RADIUS
        );

        ctx.lineTo(
            -STATION_RADIUS,
            STATION_RADIUS
        );

        ctx.closePath();

    }


    if (station.type === "square") {

        ctx.rect(
            -STATION_RADIUS,
            -STATION_RADIUS,
            STATION_RADIUS * 2,
            STATION_RADIUS * 2
        );

    }


    ctx.fill();

    ctx.stroke();


    /*
       Waiting passenger count.
    */

    if (station.passengers.length > 0) {

        ctx.fillStyle = "#111827";

        ctx.font =
            "700 11px Poppins, sans-serif";

        ctx.textAlign = "center";

        ctx.textBaseline = "middle";

        ctx.fillText(
            station.passengers.length,
            0,
            STATION_RADIUS + 20
        );

    }


    ctx.restore();

}


/* =========================================================
   STATION COLOR
   ========================================================= */

function getStationColor(type) {

    return COLORS[type] || "#ffffff";

}


/* =========================================================
   DRAW LINES
   ========================================================= */

function drawLines() {

    for (const line of lines) {

        if (line.stations.length < 2) {
            continue;
        }


        ctx.save();

        ctx.strokeStyle =
            line.color;

        ctx.lineWidth = 6;

        ctx.lineCap = "round";

        ctx.lineJoin = "round";


        ctx.beginPath();

        const first =
            line.stations[0];

        ctx.moveTo(
            first.x,
            first.y
        );


        for (
            let i = 1;
            i < line.stations.length;
            i++
        ) {

            const station =
                line.stations[i];

            ctx.lineTo(
                station.x,
                station.y
            );

        }


        if (line.loop) {

            ctx.lineTo(
                first.x,
                first.y
            );

        }


        ctx.stroke();

        ctx.restore();

    }

}


/* =========================================================
   DRAW TRAINS
   ========================================================= */

function drawTrain(train) {

    if (train.waitingForPlacement) {

        /*
           Unplaced train sits at the top-left
           waiting for the player.
        */

        return;

    }


    ctx.save();

    ctx.translate(
        train.x,
        train.y
    );

    ctx.rotate(
        train.angle
    );


    /*
       Train body.
    */

    ctx.fillStyle =
        COLORS.train;

    ctx.strokeStyle =
        COLORS.trainOutline;

    ctx.lineWidth = 2;


    ctx.beginPath();

    ctx.roundRect(
        -18,
        -9,
        36,
        18,
        5
    );

    ctx.fill();

    ctx.stroke();


    /*
       FRONT / HEAD
       The triangle points in the actual direction
       the train is travelling.
    */

    ctx.fillStyle =
        COLORS.trainOutline;

    ctx.beginPath();

    ctx.moveTo(
        18,
        0
    );

    ctx.lineTo(
        11,
        -5
    );

    ctx.lineTo(
        11,
        5
    );

    ctx.closePath();

    ctx.fill();


    /*
       Passenger windows/icons.
    */

    const count =
        train.passengers.length;

    if (count > 0) {

        const spacing =
            24 / Math.max(count, 1);

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const passenger =
                train.passengers[i];

            drawPassengerIcon(
                passenger.type,
                -10 +
                i * spacing,
                0,
                2.7
            );

        }

    }


    /*
       Boarding indicator.
    */

    if (train.boarding) {

        ctx.strokeStyle =
            "#111827";

        ctx.lineWidth = 2;

        ctx.setLineDash([
            3,
            3
        ]);

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            22,
            0,
            Math.PI * 2
        );

        ctx.stroke();

    }


    ctx.restore();

}


/* =========================================================
   DRAW WAITING TRAIN
   ========================================================= */

function drawWaitingTrain(train, index) {

    const x = 60 + index * 65;

    const y = 55;

    ctx.save();

    ctx.translate(
        x,
        y
    );

    ctx.fillStyle =
        COLORS.train;

    ctx.strokeStyle =
        COLORS.trainOutline;

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.roundRect(
        -18,
        -9,
        36,
        18,
        5
    );

    ctx.fill();

    ctx.stroke();


    /*
       Head points right while waiting.
    */

    ctx.fillStyle =
        COLORS.trainOutline;

    ctx.beginPath();

    ctx.moveTo(
        18,
        0
    );

    ctx.lineTo(
        11,
        -5
    );

    ctx.lineTo(
        11,
        5
    );

    ctx.closePath();

    ctx.fill();

    ctx.restore();

}


/* =========================================================
   DRAW
   ========================================================= */

function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawLines();


    for (const station of stations) {

        drawStation(station);

    }


    for (const train of trains) {

        drawTrain(train);

    }


    /*
       Draw unplaced trains in the upper-left
       so the player knows they are available.
    */

    let waitingIndex = 0;

    for (const train of trains) {

        if (train.waitingForPlacement) {

            drawWaitingTrain(
                train,
                waitingIndex
            );

            waitingIndex++;

        }

    }


    /*
       Draw line preview.
    */

    if (
        dragging &&
        dragStartStation
    ) {

        /*
           Pointer movement already draws this
           preview directly.
        */

    }

}


/* =========================================================
   WEEK SYSTEM
   ========================================================= */

function updateWeek(seconds) {

    weekProgress +=
        seconds / WEEK_DURATION;

    if (weekProgress >= 1) {

        weekProgress = 0;

        advanceWeek();

    }

    updateWeekProgressUI();

}


/* =========================================================
   ADVANCE WEEK
   ========================================================= */

function advanceWeek() {

    week++;

    /*
       Spawn a station every week after Week 1.
    */

    if (week > 1) {

        spawnRandomStation();

    }


    /*
       Show the weekly reward / choice.
    */

    showWeekChoice();

    updateUI();

}


/* =========================================================
   WEEK CHOICE
   ========================================================= */

function showWeekChoice() {

    paused = true;

    let choice = document.getElementById(
        "weekChoice"
    );


    /*
       Create the panel dynamically so you don't
       need to rewrite the HTML immediately.
    */

    if (!choice) {

        choice =
            document.createElement("div");

        choice.id = "weekChoice";

        choice.innerHTML = `

            <div class="week-choice-card">

                <div class="week-choice-label">
                    WEEK COMPLETE
                </div>

                <h2>
                    Week ${week}
                </h2>

                <p>
                    Choose your new resource.
                </p>

                <div class="week-choice-buttons">

                    <button id="addLineChoice">
                        + Add Line
                    </button>

                    <button id="addTrainChoice">
                        + Add Train
                    </button>

                </div>

            </div>

        `;

        document.body.appendChild(choice);


        document
            .getElementById("addLineChoice")
            .addEventListener(
                "click",
                () => {

                    createLine();

                    hideWeekChoice();

                }
            );


        document
            .getElementById("addTrainChoice")
            .addEventListener(
                "click",
                () => {

                    createTrain();

                    hideWeekChoice();

                }
            );

    } else {

        choice.style.display =
            "flex";

    }


    choice.querySelector("h2").textContent =
        `Week ${week}`;

}


/* =========================================================
   HIDE WEEK CHOICE
   ========================================================= */

function hideWeekChoice() {

    const choice =
        document.getElementById(
            "weekChoice"
        );

    if (choice) {

        choice.style.display =
            "none";

    }

    paused = false;

}


/* =========================================================
   WEEK PROGRESS UI
   ========================================================= */

function updateWeekProgressUI() {

    let progressBar =
        document.getElementById(
            "weekProgressBar"
        );


    /*
       If the HTML doesn't have one yet,
       create it beside the week automatically.
    */

    if (!progressBar) {

        const weekParent =
            weekEl.parentElement;

        if (!weekParent) return;

        progressBar =
            document.createElement(
                "div"
            );

        progressBar.id =
            "weekProgressBar";

        progressBar.innerHTML = `
            <div id="weekProgressFill"></div>
        `;

        weekParent.appendChild(
            progressBar
        );

    }


    const fill =
        document.getElementById(
            "weekProgressFill"
        );

    if (fill) {

        fill.style.width =
            `${Math.min(
                weekProgress * 100,
                100
            )}%`;

    }

}


/* =========================================================
   SCORE / UI
   ========================================================= */

function updateUI() {

    if (scoreEl) {

        scoreEl.textContent =
            score;

    }


    let waiting = 0;

    for (const station of stations) {

        waiting +=
            station.passengers.length;

    }


    if (waitingEl) {

        waitingEl.textContent =
            waiting;

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


    if (weekEl) {

        weekEl.textContent =
            week;

    }


    if (lineStatusEl) {

        if (lines.length === 0) {

            lineStatusEl.textContent =
                "No lines";

        } else {

            lineStatusEl.textContent =
                `${lines.length} active`;

        }

    }


    updateWeekProgressUI();

}


/* =========================================================
   GAME OVER
   ========================================================= */

function checkGameOver() {

    let waiting = 0;

    for (const station of stations) {

        waiting +=
            station.passengers.length;

    }


    if (
        waiting >= MAX_WAITING &&
        !gameEnded
    ) {

        gameEnded = true;

        paused = true;

        if (finalScore) {

            finalScore.textContent =
                score;

        }

        if (gameOver) {

            gameOver.style.display =
                "flex";

        }

    }

}


/* =========================================================
   GAME LOOP
   ========================================================= */

function gameLoop(now) {

    const seconds =
        Math.min(
            (now - lastTime) / 1000,
            0.1
        );

    lastTime = now;


    if (
        !paused &&
        !gameEnded
    ) {

        /*
           Week progression.
        */

        updateWeek(seconds);


        /*
           Passenger spawning.
        */

        passengerSpawnTimer +=
            seconds;

        if (
            passengerSpawnTimer >=
            PASSENGER_SPAWN_TIME
        ) {

            passengerSpawnTimer = 0;

            spawnPassenger();

        }


        /*
           Move trains.
        */

        for (const train of trains) {

            moveTrain(
                train,
                seconds
            );

        }


        /*
           Station pulse.
        */

        for (const station of stations) {

            if (station.pulse > 0) {

                station.pulse -=
                    seconds * 0.7;

                if (station.pulse < 0) {

                    station.pulse = 0;

                }

            }

        }


        checkGameOver();

    }


    draw();

    requestAnimationFrame(
        gameLoop
    );

}


/* =========================================================
   PAUSE
   ========================================================= */

if (pauseBtn) {

    pauseBtn.addEventListener(
        "click",
        () => {

            if (gameEnded) return;

            paused = !paused;

            pauseBtn.textContent =
                paused
                    ? "Resume"
                    : "Pause";

        }
    );

}


/* =========================================================
   RESTART
   ========================================================= */

function restartGame() {

    score = 0;

    week = 1;

    weekProgress = 0;

    passengerSpawnTimer = 0;

    paused = false;

    gameEnded = false;

    stations = [];

    lines = [];

    trains = [];

    passengers = [];

    nextStationId = 1;

    nextPassengerId = 1;

    nextTrainId = 1;

    nextLineId = 1;

    nextLineColorIndex = 0;


    if (gameOver) {

        gameOver.style.display =
            "none";

    }


    if (pauseBtn) {

        pauseBtn.textContent =
            "Pause";

    }


    createInitialStations();


    /*
       Start with one line and one train.
    */

    const line =
        createLine();

    addStationToLine(
        line,
        stations[0]
    );

    addStationToLine(
        line,
        stations[1]
    );

    addStationToLine(
        line,
        stations[2]
    );


    const train =
        createTrain();

    train.line = line;

    train.waitingForPlacement = false;

    train.currentIndex = 0;

    train.progress = 0;

    train.reverse = false;

    updateTrainPosition(train);


    updateUI();

    draw();

}


if (restartBtn) {

    restartBtn.addEventListener(
        "click",
        restartGame
    );

}


if (playAgain) {

    playAgain.addEventListener(
        "click",
        restartGame
    );

}


/* =========================================================
   START
   ========================================================= */

window.addEventListener(
    "resize",
    resizeCanvas
);

resizeCanvas();

restartGame();

requestAnimationFrame(
    gameLoop
);
