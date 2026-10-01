const STATION_RADIUS = 16;
const STATION_MIN_DISTANCE = 105;
const MAX_STATIONS = 18;
const MAX_WAITING = 12;

const TRAIN_SPEED = 100;
const TRAIN_CAPACITY = 6;
const BOARDING_TIME_PER_PASSENGER = 0.45;

const WEEK_DURATION = 30;

const STATION_SPAWN_MIN = 8;
const STATION_SPAWN_MAX = 10;

const PASSENGER_SPAWN_TIME = 4;

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
   LINE COLORS
   ========================================================= */

const LINE_COLORS = [
    "#3b82f6",
    "#ef4444",
    "#8b5cf6",
    "#10b981",
    "#f59e0b"
];

let nextLineColorIndex = 0;


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

let draggingRail = false;
let railStartStation = null;

let pointerX = 0;
let pointerY = 0;

let draggingTrain = null;


/* =========================================================
   DOM
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

let weekProgressWrap = null;
let weekProgressFill = null;
let weekProgressPercent = null;


/* =========================================================
   INITIAL SETUP
   ========================================================= */

function resizeCanvas() {
    const rect = gameArea.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;

    draw();
}


function initGame() {

    stations = [];
    lines = [];
    passengers = [];
    trains = [];

    score = 0;
    week = 1;

    paused = false;
    gameOver = false;

    weekTimer = 0;
    passengerTimer = 0;

    stationSpawnTimer = 0;
    nextStationSpawn = randomStationSpawnTime();

    nextLineColorIndex = 0;

    draggingRail = false;
    railStartStation = null;

    draggingTrain = null;

    createWeekProgressBar();

    const w = canvas.width;
    const h = canvas.height;

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

    trains.push({
        id: 1,

        placed: false,
        inDepot: true,

        x: 65,
        y: 70,

        line: null,

        // Segment-based movement
        segmentIndex: 0,
        progress: 0,
        direction: 1,

        passengers: [],

        boarding: false,
        boardingTimer: 0,
        boardingStation: null,

        angle: 0
    });

    updateStats();
    updateWeekProgress();

    draw();
}


/* =========================================================
   WEEK PROGRESS
   ========================================================= */

function createWeekProgressBar() {

    if (!weekEl || document.getElementById("weekProgressWrap")) return;

    weekProgressWrap = document.createElement("span");

    weekProgressWrap.id = "weekProgressWrap";

    weekProgressWrap.innerHTML = `
        <span id="weekProgressBar">
            <span id="weekProgressFill"></span>
        </span>

        <span id="weekProgressPercent">0%</span>
    `;

    weekEl.insertAdjacentElement(
        "afterend",
        weekProgressWrap
    );

    weekProgressFill =
        document.getElementById("weekProgressFill");

    weekProgressPercent =
        document.getElementById("weekProgressPercent");
}


function updateWeekProgress() {

    if (!weekProgressFill) return;

    const progress =
        Math.min(weekTimer / WEEK_DURATION, 1);

    const percent =
        Math.floor(progress * 100);

    weekProgressFill.style.width =
        `${percent}%`;

    if (weekProgressPercent) {
        weekProgressPercent.textContent =
            `${percent}%`;
    }
}


/* =========================================================
   RANDOM STATION TIMER
   ========================================================= */

function randomStationSpawnTime() {

    return STATION_SPAWN_MIN +
        Math.random() *
        (STATION_SPAWN_MAX - STATION_SPAWN_MIN);
}


/* =========================================================
   STATION SPAWNING
   ========================================================= */

function spawnRandomStation() {

    if (stations.length >= MAX_STATIONS) return;

    const types = [
        "circle",
        "triangle",
        "square"
    ];

    const padding = 55;

    for (let attempt = 0; attempt < 100; attempt++) {

        const x =
            padding +
            Math.random() *
            (canvas.width - padding * 2);

        const y =
            padding +
            Math.random() *
            (canvas.height - padding * 2);

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

        if (!valid) continue;

        stations.push({
            id: Date.now() + Math.random(),
            type: types[Math.floor(Math.random() * types.length)],
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

    if (stations.length < 2) return;

    const available =
        stations.filter(station => {
            return station.waiting.length < MAX_WAITING;
        });

    if (available.length === 0) return;

    const origin =
        available[
            Math.floor(Math.random() * available.length)
        ];

    const possibleDestinations =
        stations.filter(station => {
            return station !== origin;
        });

    if (possibleDestinations.length === 0) return;

    const destination =
        possibleDestinations[
            Math.floor(
                Math.random() *
                possibleDestinations.length
            )
        ];

    const passenger = {
        id: Date.now() + Math.random(),
        origin,
        destination
    };

    origin.waiting.push(passenger);
    passengers.push(passenger);

    updateStats();
}


/* =========================================================
   UPDATE LOOP
   ========================================================= */

function update(dt) {

    if (paused || gameOver) return;

    /* -------------------------
       WEEK
    ------------------------- */

    weekTimer += dt;

    if (weekTimer >= WEEK_DURATION) {

        weekTimer -= WEEK_DURATION;

        week++;

        updateStats();
    }

    updateWeekProgress();


    /* -------------------------
       RANDOM STATIONS
    ------------------------- */

    stationSpawnTimer += dt;

    if (stationSpawnTimer >= nextStationSpawn) {

        spawnRandomStation();

        stationSpawnTimer = 0;

        nextStationSpawn =
            randomStationSpawnTime();
    }


    /* -------------------------
       PASSENGERS
    ------------------------- */

    passengerTimer += dt;

    if (passengerTimer >= PASSENGER_SPAWN_TIME) {

        passengerTimer = 0;

        spawnPassenger();
    }


    /* -------------------------
       TRAINS
    ------------------------- */

    updateTrains(dt);


    /* -------------------------
       GAME OVER
    ------------------------- */

    const totalWaiting =
        stations.reduce(
            (sum, station) =>
                sum + station.waiting.length,
            0
        );

    if (totalWaiting >= MAX_WAITING) {
        endGame();
    }

    updateStats();
}


/* =========================================================
   TRAIN MOVEMENT
   ========================================================= */

/*
    Each train moves along a segment.

    Example:

    A ---- B ---- C ---- D

    segmentIndex = 0
    progress = 0.5

    means the train is halfway between A and B.

    direction = 1
        A → B

    direction = -1
        B → A

    At the end of the line, the direction flips.
    The train NEVER teleports back to the beginning.
*/

function updateTrains(dt) {

    for (const train of trains) {

        if (!train.placed) continue;
        if (!train.line) continue;

        if (train.boarding) {

            train.boardingTimer -= dt;

            if (train.boardingTimer <= 0) {
                boardNextPassenger(train);
            }

            continue;
        }

        if (train.line.stations.length < 2) {
            continue;
        }

        let remainingDistance =
            TRAIN_SPEED * dt;


        while (remainingDistance > 0) {

            const segment =
                getTrainSegment(train);

            if (!segment) {
                break;
            }

            const dx =
                segment.to.x -
                segment.from.x;

            const dy =
                segment.to.y -
                segment.from.y;

            const segmentLength =
                Math.sqrt(dx * dx + dy * dy);

            if (segmentLength <= 0) {
                break;
            }


            const distanceToStation =
                train.direction === 1
                    ? segmentLength *
                      (1 - train.progress)
                    : segmentLength *
                      train.progress;


            const movement =
                Math.min(
                    remainingDistance,
                    distanceToStation
                );


            const progressChange =
                movement / segmentLength;


            train.progress +=
                train.direction *
                progressChange;


            remainingDistance -= movement;


            updateTrainPosition(train);


            /*
                We reached the next station.
            */

            if (
                movement >=
                distanceToStation - 0.0001
            ) {

                arriveAtStation(train);

                /*
                    If passengers are boarding,
                    stop moving until boarding finishes.
                */

                if (train.boarding) {
                    break;
                }
            }
        }

        updateTrainPosition(train);
    }
}


/* =========================================================
   GET CURRENT TRAIN SEGMENT
   ========================================================= */

function getTrainSegment(train) {

    if (!train.line) return null;

    const line = train.line;

    const from =
        line.stations[train.segmentIndex];

    const to =
        line.stations[train.segmentIndex + 1];

    if (!from || !to) {
        return null;
    }

    return {
        from,
        to
    };
}


/* =========================================================
   UPDATE TRAIN POSITION
   ========================================================= */

function updateTrainPosition(train) {

    const segment =
        getTrainSegment(train);

    if (!segment) return;

    const a = segment.from;
    const b = segment.to;

    train.x =
        a.x +
        (b.x - a.x) *
        train.progress;

    train.y =
        a.y +
        (b.y - a.y) *
        train.progress;

    updateTrainAngle(train);
}


/* =========================================================
   TRAIN ANGLE
   ========================================================= */

function updateTrainAngle(train) {

    const segment =
        getTrainSegment(train);

    if (!segment) return;

    const dx =
        segment.to.x -
        segment.from.x;

    const dy =
        segment.to.y -
        segment.from.y;

    let angle =
        Math.atan2(dy, dx);

    if (train.direction === -1) {
        angle += Math.PI;
    }

    train.angle = angle;
}


/* =========================================================
   TRAIN ARRIVAL
   ========================================================= */

function arriveAtStation(train) {

    const line = train.line;

    let station;

    if (train.direction === 1) {

        station =
            line.stations[
                train.segmentIndex + 1
            ];

    } else {

        station =
            line.stations[
                train.segmentIndex
            ];
    }

    if (!station) return;


    /* Snap exactly onto station */

    train.x = station.x;
    train.y = station.y;


    /* Unload passengers */

    unloadPassengers(
        train,
        station
    );


    /* Start boarding */

    if (
        train.passengers.length <
            TRAIN_CAPACITY &&
        station.waiting.length > 0
    ) {

        train.boarding = true;

        train.boardingStation =
            station;

        train.boardingTimer =
            BOARDING_TIME_PER_PASSENGER;

    } else {

        train.boarding = false;
        train.boardingStation = null;
    }


    /*
        Prepare the next segment.

        IMPORTANT:
        We do NOT reset the train.

        At the end:

        A → B → C → D
                      ↓
        A ← B ← C ← D

        It reverses smoothly.
    */

    if (train.direction === 1) {

        if (
            train.segmentIndex >=
            line.stations.length - 2
        ) {

            /*
                We reached the final station.

                Stay on the final segment,
                but reverse direction.
            */

            train.direction = -1;

            train.progress = 1;

        } else {

            train.segmentIndex++;

            train.progress = 0;
        }

    } else {

        if (train.segmentIndex <= 0) {

            /*
                We reached the first station.

                Reverse and travel forward again.
            */

            train.direction = 1;

            train.progress = 0;

        } else {

            train.segmentIndex--;

            train.progress = 1;
        }
    }


    updateTrainAngle(train);

    updateStats();
}


/* =========================================================
   UNLOAD PASSENGERS
   ========================================================= */

function unloadPassengers(
    train,
    station
) {

    const remaining = [];

    for (const passenger of train.passengers) {

        if (
            passenger.destination === station
        ) {

            score++;

        } else {

            remaining.push(passenger);
        }
    }

    train.passengers = remaining;
}


/* =========================================================
   BOARD PASSENGER
   ========================================================= */

function boardNextPassenger(train) {

    const station =
        train.boardingStation;

    if (!station) {

        train.boarding = false;
        return;
    }


    if (
        train.passengers.length >=
        TRAIN_CAPACITY
    ) {

        train.boarding = false;
        train.boardingStation = null;

        return;
    }


    if (station.waiting.length === 0) {

        train.boarding = false;
        train.boardingStation = null;

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

    } else {

        train.boarding = false;
        train.boardingStation = null;
    }


    updateStats();
}


/* =========================================================
   TRAIN PLACEMENT
   ========================================================= */

function placeTrain(
    train,
    x,
    y
) {

    const station =
        getStationAt(x, y);

    if (station) {

        const line =
            lines.find(l =>
                l.stations.includes(station)
            );


        train.placed = true;
        train.inDepot = false;

        train.x = station.x;
        train.y = station.y;

        train.line = line || null;

        train.boarding = false;
        train.boardingStation = null;


        if (line) {

            setTrainAtStation(
                train,
                station,
                line
            );

        } else {

            train.segmentIndex = 0;
            train.progress = 0;
            train.direction = 1;
            train.angle = 0;
        }


        tryAssignWaitingTrains();

        updateStats();
        draw();

        return;
    }


    /*
        Try placing train directly onto
        an existing rail.
    */

    const closest =
        findClosestPointOnAnyLine(
            x,
            y
        );


    if (closest) {

        train.placed = true;
        train.inDepot = false;

        train.line = closest.line;

        train.segmentIndex =
            closest.index;

        train.progress =
            closest.progress;

        train.direction = 1;

        train.x = closest.x;
        train.y = closest.y;

        train.boarding = false;
        train.boardingStation = null;

        updateTrainAngle(train);

        updateStats();
        draw();

        return;
    }


    /*
        Invalid drop:
        return train to depot.
    */

    train.x = 65;
    train.y = 70;

    train.placed = false;
    train.inDepot = true;

    train.line = null;

    train.boarding = false;
    train.boardingStation = null;

    updateStats();
    draw();
}


/* =========================================================
   PUT TRAIN AT STATION
   ========================================================= */

function setTrainAtStation(
    train,
    station,
    line
) {

    const index =
        line.stations.indexOf(station);

    if (index <= 0) {

        train.segmentIndex = 0;
        train.progress = 0;
        train.direction = 1;

    } else if (
        index >=
        line.stations.length - 1
    ) {

        train.segmentIndex =
            line.stations.length - 2;

        train.progress = 1;
        train.direction = -1;

    } else {

        train.segmentIndex = index;
        train.progress = 0;
        train.direction = 1;
    }


    updateTrainPosition(train);
}


/* =========================================================
   FIND CLOSEST LINE POINT
   ========================================================= */

function findClosestPointOnAnyLine(
    x,
    y
) {

    let closest = null;
    let closestDistance = Infinity;


    for (const line of lines) {

        for (
            let i = 0;
            i < line.stations.length - 1;
            i++
        ) {

            const a =
                line.stations[i];

            const b =
                line.stations[i + 1];


            const result =
                closestPointOnSegment(
                    x,
                    y,
                    a.x,
                    a.y,
                    b.x,
                    b.y
                );


            if (
                result.distance <
                closestDistance
            ) {

                closestDistance =
                    result.distance;

                closest = {
                    line,
                    index: i,
                    progress: result.progress,
                    x: result.x,
                    y: result.y
                };
            }
        }
    }


    if (
        closest &&
        closestDistance < 25
    ) {
        return closest;
    }

    return null;
}


function closestPointOnSegment(
    px,
    py,
    ax,
    ay,
    bx,
    by
) {

    const dx = bx - ax;
    const dy = by - ay;

    const lengthSquared =
        dx * dx + dy * dy;

    if (lengthSquared === 0) {

        const distance =
            Math.hypot(
                px - ax,
                py - ay
            );

        return {
            x: ax,
            y: ay,
            progress: 0,
            distance
        };
    }


    let t =
        (
            (px - ax) * dx +
            (py - ay) * dy
        ) /
        lengthSquared;


    t = Math.max(
        0,
        Math.min(1, t)
    );


    const x =
        ax + dx * t;

    const y =
        ay + dy * t;


    return {
        x,
        y,
        progress: t,
        distance: Math.hypot(
            px - x,
            py - y
        )
    };
}


/* =========================================================
   AUTO ASSIGN TRAINS
   ========================================================= */

function tryAssignWaitingTrains() {

    for (const train of trains) {

        if (!train.placed) continue;

        if (train.line) continue;

        const station =
            getStationAt(
                train.x,
                train.y
            );

        if (!station) continue;


        const line =
            lines.find(l =>
                l.stations.includes(station)
            );

        if (!line) continue;


        train.line = line;

        setTrainAtStation(
            train,
            station,
            line
        );

        updateTrainAngle(train);
    }
}


/* =========================================================
   LINE CREATION
   ========================================================= */

function createLine(
    firstStation,
    secondStation
) {

    const line = {

        id:
            Date.now() +
            Math.random(),

        /*
            IMPORTANT:
            This color is stored permanently
            on this line.

            It will NOT be recalculated later.
        */

        color:
            LINE_COLORS[
                nextLineColorIndex %
                LINE_COLORS.length
            ],

        stations: [
            firstStation,
            secondStation
        ]
    };


    nextLineColorIndex++;


    lines.push(line);

    tryAssignWaitingTrains();

    updateStats();
    draw();
}


/* =========================================================
   CONNECT / EXTEND LINES
   ========================================================= */

function connectStations(
    firstStation,
    secondStation
) {

    if (!firstStation) return;
    if (!secondStation) return;

    if (
        firstStation ===
        secondStation
    ) {
        return;
    }


    /*
        Try extending an existing line.
    */

    for (const line of lines) {

        const firstIndex =
            line.stations.indexOf(
                firstStation
            );

        const secondIndex =
            line.stations.indexOf(
                secondStation
            );


        if (
            firstIndex !== -1 &&
            secondIndex === -1
        ) {

            /*
                Extend at beginning.
            */

            if (firstIndex === 0) {

                const oldFirst =
                    line.stations[0];

                line.stations.unshift(
                    secondStation
                );


                /*
                    Repair train segment indexes.

                    If a train was sitting at
                    the old first station,
                    make it travel toward the
                    new station.
                */

                for (const train of trains) {

                    if (
                        train.line !== line
                    ) {
                        continue;
                    }


                    const atOldFirst =
                        Math.hypot(
                            train.x -
                                oldFirst.x,
                            train.y -
                                oldFirst.y
                        ) < 2;


                    if (atOldFirst) {

                        train.segmentIndex = 0;
                        train.progress = 1;
                        train.direction = -1;

                    } else {

                        train.segmentIndex++;
                    }


                    updateTrainPosition(train);
                }


                tryAssignWaitingTrains();

                updateStats();
                draw();

                return;
            }


            /*
                Extend at end.
            */

            if (
                firstIndex ===
                line.stations.length - 1
            ) {

                const oldLast =
                    line.stations[
                        line.stations.length - 1
                    ];


                line.stations.push(
                    secondStation
                );


                for (const train of trains) {

                    if (
                        train.line !== line
                    ) {
                        continue;
                    }


                    const atOldLast =
                        Math.hypot(
                            train.x -
                                oldLast.x,
                            train.y -
                                oldLast.y
                        ) < 2;


                    if (atOldLast) {

                        train.segmentIndex =
                            line.stations.length - 2;

                        train.progress = 0;
                        train.direction = 1;

                    }


                    updateTrainPosition(train);
                }


                tryAssignWaitingTrains();

                updateStats();
                draw();

                return;
            }
        }
    }


    /*
        Don't create duplicate rail segments.
    */

    for (const line of lines) {

        for (
            let i = 0;
            i < line.stations.length - 1;
            i++
        ) {

            const a =
                line.stations[i];

            const b =
                line.stations[i + 1];


            if (
                (
                    a === firstStation &&
                    b === secondStation
                ) ||
                (
                    a === secondStation &&
                    b === firstStation
                )
            ) {
                return;
            }
        }
    }


    /*
        Otherwise create a brand-new line.
    */

    createLine(
        firstStation,
        secondStation
    );
}


/* =========================================================
   REMOVE RAIL
   ========================================================= */

function removeRailAt(x, y) {

    for (let li = lines.length - 1; li >= 0; li--) {

        const line = lines[li];

        for (
            let i = 0;
            i < line.stations.length - 1;
            i++
        ) {

            const a =
                line.stations[i];

            const b =
                line.stations[i + 1];


            const closest =
                closestPointOnSegment(
                    x,
                    y,
                    a.x,
                    a.y,
                    b.x,
                    b.y
                );


            if (closest.distance < 12) {

                /*
                    Remove the entire line if
                    it only contains two stations.
                */

                if (
                    line.stations.length <= 2
                ) {

                    for (const train of trains) {

                        if (
                            train.line === line
                        ) {

                            train.line = null;
                            train.segmentIndex = 0;
                            train.progress = 0;
                            train.direction = 1;
                        }
                    }


                    lines.splice(li, 1);

                } else {

                    /*
                        For now, remove the segment
                        by splitting the line.

                        Left side stays as the original
                        line color.
                    */

                    const leftStations =
                        line.stations.slice(
                            0,
                            i + 1
                        );

                    const rightStations =
                        line.stations.slice(
                            i + 1
                        );


                    lines.splice(
                        li,
                        1
                    );


                    if (
                        leftStations.length >= 2
                    ) {

                        lines.push({
                            id:
                                Date.now() +
                                Math.random(),

                            color:
                                line.color,

                            stations:
                                leftStations
                        });
                    }


                    if (
                        rightStations.length >= 2
                    ) {

                        lines.push({
                            id:
                                Date.now() +
                                Math.random(),

                            color:
                                line.color,

                            stations:
                                rightStations
                        });
                    }


                    /*
                        Trains that were on the
                        removed line need to be detached.
                    */

                    for (const train of trains) {

                        if (
                            train.line === line
                        ) {

                            train.line = null;
                        }
                    }
                }


                updateStats();
                draw();

                return true;
            }
        }
    }

    return false;
}


/* =========================================================
   INPUT
   ========================================================= */

canvas.addEventListener(
    "pointerdown",
    event => {

        if (paused || gameOver) return;

        const pos =
            getCanvasPosition(event);

        pointerX = pos.x;
        pointerY = pos.y;


        /*
            Right-click:
            delete rail.
        */

        if (event.button === 2) {

            removeRailAt(
                pointerX,
                pointerY
            );

            return;
        }


        /*
            Check depot train first.
        */

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


        /*
            Start rail drawing.
        */

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


canvas.addEventListener(
    "pointermove",
    event => {

        const pos =
            getCanvasPosition(event);

        pointerX = pos.x;
        pointerY = pos.y;


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


canvas.addEventListener(
    "pointerup",
    event => {

        const pos =
            getCanvasPosition(event);

        pointerX = pos.x;
        pointerY = pos.y;


        if (draggingTrain) {

            const train =
                draggingTrain;

            draggingTrain = null;

            placeTrain(
                train,
                pointerX,
                pointerY
            );

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


canvas.addEventListener(
    "contextmenu",
    event => {
        event.preventDefault();
    }
);


/* =========================================================
   CANVAS POSITION
   ========================================================= */

function getCanvasPosition(event) {

    const rect =
        canvas.getBoundingClientRect();

    return {
        x:
            event.clientX -
            rect.left,

        y:
            event.clientY -
            rect.top
    };
}


/* =========================================================
   STATION HIT TEST
   ========================================================= */

function getStationAt(x, y) {

    for (
        let i = stations.length - 1;
        i >= 0;
        i--
    ) {

        const station =
            stations[i];

        const distance =
            Math.hypot(
                x - station.x,
                y - station.y
            );


        if (
            distance <=
            STATION_RADIUS + 8
        ) {
            return station;
        }
    }

    return null;
}


/* =========================================================
   DEPOT TRAIN HIT TEST
   ========================================================= */

function getDepotTrainAt(x, y) {

    for (const train of trains) {

        if (!train.inDepot) continue;

        /*
            Larger hitbox than the actual train.
        */

        if (
            x >= 25 &&
            x <= 105 &&
            y >= 30 &&
            y <= 110
        ) {
            return train;
        }
    }

    return null;
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


    ctx.fillStyle =
        COLORS.background;

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawLines();

    drawLinePreview();

    drawStations();

    drawTrains();

    drawDepot();
}


/* =========================================================
   DRAW LINES
   ========================================================= */

function drawLines() {

    for (const line of lines) {

        if (
            line.stations.length < 2
        ) {
            continue;
        }


        /*
            IMPORTANT:
            The entire line is drawn using
            its stored permanent color.
        */

        ctx.beginPath();

        ctx.moveTo(
            line.stations[0].x,
            line.stations[0].y
        );


        for (
            let i = 1;
            i < line.stations.length;
            i++
        ) {

            ctx.lineTo(
                line.stations[i].x,
                line.stations[i].y
            );
        }


        ctx.strokeStyle =
            line.color;

        ctx.lineWidth = 7;

        ctx.lineCap =
            "round";

        ctx.lineJoin =
            "round";

        ctx.stroke();
    }
}


/* =========================================================
   DRAW LINE PREVIEW
   ========================================================= */

function drawLinePreview() {

    if (
        !draggingRail ||
        !railStartStation
    ) {
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


    ctx.strokeStyle =
        "rgba(48,52,59,0.35)";

    ctx.lineWidth = 5;

    ctx.setLineDash([
        8,
        8
    ]);

    ctx.lineCap =
        "round";

    ctx.stroke();

    ctx.restore();
}


/* =========================================================
   DRAW STATIONS
   ========================================================= */

function drawStations() {

    for (const station of stations) {

        drawStationShape(
            station.x,
            station.y,
            station.type
        );


        /*
            Draw waiting passengers.
        */

        if (
            station.waiting.length > 0
        ) {

            drawWaitingPassengers(
                station
            );
        }
    }
}


/* =========================================================
   STATION SHAPE
   ========================================================= */

function drawStationShape(
    x,
    y,
    type
) {

    ctx.save();

    ctx.fillStyle =
        COLORS.stationFill;

    ctx.strokeStyle =
        COLORS.stationStroke;

    ctx.lineWidth = 3;


    ctx.beginPath();


    if (type === "circle") {

        ctx.arc(
            x,
            y,
            STATION_RADIUS,
            0,
            Math.PI * 2
        );

    } else if (type === "triangle") {

        const size =
            STATION_RADIUS * 1.2;

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

    } else {

        const size =
            STATION_RADIUS;

        ctx.rect(
            x - size,
            y - size,
            size * 2,
            size * 2
        );
    }


    ctx.fill();
    ctx.stroke();

    ctx.restore();
}


/* =========================================================
   WAITING PASSENGERS
   ========================================================= */

function drawWaitingPassengers(
    station
) {

    const maxVisible =
        Math.min(
            station.waiting.length,
            6
        );


    for (
        let i = 0;
        i < maxVisible;
        i++
    ) {

        const passenger =
            station.waiting[i];

        const angle =
            (Math.PI * 2 / maxVisible) *
            i;

        const radius = 25;


        const x =
            station.x +
            Math.cos(angle) *
            radius;

        const y =
            station.y +
            Math.sin(angle) *
            radius;


        drawDestinationIcon(
            x,
            y,
            passenger.destination.type,
            4
        );
    }
}


/* =========================================================
   DESTINATION ICON
   ========================================================= */

function drawDestinationIcon(
    x,
    y,
    type,
    size = 5
) {

    ctx.save();

    ctx.fillStyle =
        COLORS.passenger;

    ctx.strokeStyle =
        COLORS.passenger;

    ctx.lineWidth = 1.5;


    ctx.beginPath();


    if (type === "circle") {

        ctx.arc(
            x,
            y,
            size,
            0,
            Math.PI * 2
        );

    } else if (type === "triangle") {

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

    } else {

        ctx.rect(
            x - size,
            y - size,
            size * 2,
            size * 2
        );
    }


    ctx.fill();

    ctx.restore();
}


/* =========================================================
   DRAW TRAINS
   ========================================================= */

function drawTrains() {

    for (const train of trains) {

        /*
            Don't draw the depot copy while
            the train is being dragged.
        */

        if (
            train === draggingTrain
        ) {
            continue;
        }


        if (
            !train.placed &&
            !train.inDepot
        ) {
            continue;
        }


        drawTrainShape(
            train.x,
            train.y,
            train.angle,
            train.placed ? 1 : 1.15
        );


        /*
            Passenger destination icons
            inside the train.
        */

        if (
            train.placed &&
            train.passengers.length > 0
        ) {

            drawTrainPassengers(
                train
            );
        }
    }
}


/* =========================================================
   TRAIN SHAPE
   ========================================================= */

function drawTrainShape(
    x,
    y,
    angle,
    scale = 1
) {

    ctx.save();

    ctx.translate(
        x,
        y
    );

    ctx.rotate(angle);


    const width =
        34 * scale;

    const height =
        15 * scale;


    /*
        Main rectangular body.
    */

    ctx.fillStyle =
        COLORS.train;

    ctx.beginPath();

    ctx.roundRect(
        -width / 2,
        -height / 2,
        width - 6 * scale,
        height,
        3 * scale
    );

    ctx.fill();


    /*
        Pointed front.
    */

    ctx.beginPath();

    ctx.moveTo(
        width / 2 - 6 * scale,
        -height / 2
    );

    ctx.lineTo(
        width / 2,
        0
    );

    ctx.lineTo(
        width / 2 - 6 * scale,
        height / 2
    );

    ctx.closePath();

    ctx.fillStyle =
        COLORS.train;

    ctx.fill();


    /*
        Windows.
    */

    ctx.fillStyle =
        COLORS.trainWindow;

    ctx.fillRect(
        -width / 2 +
            5 * scale,
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
   TRAIN PASSENGERS
   ========================================================= */

function drawTrainPassengers(
    train
) {

    ctx.save();

    ctx.translate(
        train.x,
        train.y
    );

    ctx.rotate(
        train.angle
    );


    const visible =
        Math.min(
            train.passengers.length,
            TRAIN_CAPACITY
        );


    for (
        let i = 0;
        i < visible;
        i++
    ) {

        const passenger =
            train.passengers[i];

        const x =
            -8 +
            i * 3;

        const y = 0;


        drawDestinationIcon(
            x,
            y,
            passenger.destination.type,
            2
        );
    }


    ctx.restore();
}


/* =========================================================
   DEPOT
   ========================================================= */

function drawDepot() {

    const train =
        trains.find(t =>
            t.inDepot
        );


    if (!train) return;

    /*
        Don't draw the train inside the
        depot while it is being dragged.
    */

    if (
        train === draggingTrain
    ) {
        return;
    }


    ctx.save();


    /*
        BIGGER DEPOT BOX
    */

    ctx.fillStyle =
        "rgba(255,255,255,0.88)";

    ctx.strokeStyle =
        "rgba(28,31,36,0.16)";

    ctx.lineWidth = 1;


    ctx.beginPath();

    ctx.roundRect(
        18,
        18,
        220,
        105,
        16
    );

    ctx.fill();
    ctx.stroke();


    /*
        Train
    */

    drawTrainShape(
        65,
        70,
        0,
        1.25
    );


    /*
        Text
    */

    ctx.fillStyle =
        COLORS.text;

    ctx.font =
        "600 12px Poppins, sans-serif";

    ctx.textAlign =
        "left";

    ctx.fillText(
        "AVAILABLE TRAIN",
        105,
        55
    );


    ctx.fillStyle =
        COLORS.muted;

    ctx.font =
        "10px Poppins, sans-serif";

    ctx.fillText(
        "Drag onto a station",
        105,
        75
    );

    ctx.fillText(
        "or an existing rail",
        105,
        91
    );


    ctx.restore();
}


/* =========================================================
   STATS
   ========================================================= */

function updateStats() {

    if (weekEl) {
        weekEl.textContent =
            `Week ${week}`;
    }

    if (scoreEl) {
        scoreEl.textContent =
            score;
    }


    const waiting =
        stations.reduce(
            (sum, station) =>
                sum +
                station.waiting.length,
            0
        );


    if (waitingEl) {
        waitingEl.textContent =
            waiting;
    }


    if (stationCountEl) {
        stationCountEl.textContent =
            stations.length;
    }


    if (trainCountEl) {

        const placedTrains =
            trains.filter(
                train => train.placed
            ).length;

        trainCountEl.textContent =
            placedTrains;
    }


    if (lineCountEl) {
        lineCountEl.textContent =
            lines.length;
    }


    if (lineStatusEl) {

        lineStatusEl.textContent =
            lines.length === 0
                ? "No lines"
                : `${lines.length} line${
                    lines.length === 1
                        ? ""
                        : "s"
                } active`;
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
        () => {

            initGame();

            if (pauseBtn) {
                pauseBtn.textContent =
                    "Pause";
            }

            if (gameOverEl) {
                gameOverEl.classList.remove(
                    "show"
                );
            }
        }
    );
}


if (playAgainBtn) {

    playAgainBtn.addEventListener(
        "click",
        () => {

            initGame();

            if (pauseBtn) {
                pauseBtn.textContent =
                    "Pause";
            }

            if (gameOverEl) {
                gameOverEl.classList.remove(
                    "show"
                );
            }
        }
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
   RESIZE
   ========================================================= */

window.addEventListener(
    "resize",
    resizeCanvas
);


/* =========================================================
   START
   ========================================================= */

resizeCanvas();
initGame();

requestAnimationFrame(
    gameLoop
);
