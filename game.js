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


/*
    These are assigned ONCE.

    A line keeps its own color forever.
*/

const LINE_COLORS = [
    "#ef4444", // Red
    "#3b82f6", // Blue
    "#14b8a6", // Teal
    "#f97316", // Orange
    "#22c55e", // Green
    "#eab308"  // Yellow
];

const LINE_COLOR_NAMES = [
    "Red",
    "Blue",
    "Teal",
    "Orange",
    "Green",
    "Yellow"
];

let unlockedLineCount = 1;
let selectedLineColorIndex = 0;

function updateLineStatus() {
    if (!lineStatusEl) return;

    let html = "";

    for (let i = 0; i < LINE_COLORS.length; i++) {
        const unlocked = i < unlockedLineCount;

        const used = lines.some(
            line => line.colorIndex === i
        );

        const selected = selectedLineColorIndex === i;

        html += `
            <span
                class="
                    line-dot
                    ${unlocked ? "unlocked" : "locked"}
                    ${used ? "used" : ""}
                    ${selected ? "selected" : ""}
                "
                style="--line-color:${LINE_COLORS[i]}"
                title="${LINE_COLOR_NAMES[i]}"
                data-line-index="${i}"
            ></span>
        `;
    }

    lineStatusEl.innerHTML = html;

    const dots = lineStatusEl.querySelectorAll(".line-dot");

    dots.forEach(dot => {
        dot.addEventListener("click", () => {
            const index = Number(dot.dataset.lineIndex);

            if (index >= unlockedLineCount) {
                return;
            }

            selectedLineColorIndex = index;

            updateLineStatus();
        });
    });
}

function getLineColorName(index) {
    return LINE_COLOR_NAMES[index] || "Unknown";
}

/* =========================================================
   GAME STATE
========================================================= */

let stations = [];
let lines = [];
let passengers = [];
let trains = [];

let score = 0;
let week = 1;

let weeklyChoiceOpen = false;

const MAX_LINE_UNLOCKS = LINE_COLORS.length;

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

let draggingTrain = null;

let pointerX = 0;
let pointerY = 0;


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
   RESIZE
========================================================= */

function resizeCanvas() {

    const rect =
        gameArea.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;

    draw();
}


/* =========================================================
   INITIALIZE
========================================================= */

function initGame() {

    stations = [];
    lines = [];
    passengers = [];
    trains = [];

    score = 0;
    week = 1;

    paused = false;
    gameOver = false;
    weeklyChoiceOpen = false;

    weekTimer = 0;
    passengerTimer = 0;

    stationSpawnTimer = 0;
    nextStationSpawn =
        randomStationSpawnTime();

    unlockedLineCount = 1;
    selectedLineColorIndex = 0;

    draggingRail = false;
    railStartStation = null;

    draggingTrain = null;


    createWeekProgressBar();


    const w = canvas.width;
    const h = canvas.height;


    /* Initial stations */

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


    /* One train in depot */

    trains.push(createDepotTrain());

    updateStats();
    updateWeekProgress();

    draw();
}


/* =========================================================
   WEEK BAR
========================================================= */

function createWeekProgressBar() {

    if (
        !weekEl ||
        document.getElementById(
            "weekProgressWrap"
        )
    ) {
        return;
    }

    weekProgressWrap =
        document.createElement("span");

    weekProgressWrap.id =
        "weekProgressWrap";

    weekProgressWrap.innerHTML = `
        <span id="weekProgressBar">
            <span id="weekProgressFill"></span>
        </span>

        <span id="weekProgressPercent">
            0%
        </span>
    `;

    weekEl.insertAdjacentElement(
        "afterend",
        weekProgressWrap
    );

    weekProgressFill =
        document.getElementById(
            "weekProgressFill"
        );

    weekProgressPercent =
        document.getElementById(
            "weekProgressPercent"
        );
}


function updateWeekProgress() {

    if (!weekProgressFill) return;

    const progress =
        Math.min(
            weekTimer / WEEK_DURATION,
            1
        );

    const percent =
        Math.floor(progress * 100);

    weekProgressFill.style.width =
        `${percent}%`;

    if (weekProgressPercent) {

        weekProgressPercent.textContent =
            `${percent}%`;
    }
}

function addWeeklyTrain() {
    const train = createDepotTrain();

    trains.push(train);

    updateStats();
    draw();
}

function addAdditionalTrain() {
    const train = createDepotTrain();

    trains.push(train);

    updateStats();
    draw();
}
/* =========================================================
   RANDOM STATION TIMER
========================================================= */

function randomStationSpawnTime() {

    return (
        STATION_SPAWN_MIN +
        Math.random() *
        (
            STATION_SPAWN_MAX -
            STATION_SPAWN_MIN
        )
    );
}


/* =========================================================
   SPAWN STATION
========================================================= */

function spawnRandomStation() {

    if (
        stations.length >= MAX_STATIONS
    ) {
        return;
    }


    const types = [
        "circle",
        "triangle",
        "square"
    ];

    const padding = 55;


    for (
        let attempt = 0;
        attempt < 100;
        attempt++
    ) {

        const x =
            padding +
            Math.random() *
            (
                canvas.width -
                padding * 2
            );

        const y =
            padding +
            Math.random() *
            (
                canvas.height -
                padding * 2
            );


        let valid = true;


        for (const station of stations) {

            const distance =
                Math.hypot(
                    station.x - x,
                    station.y - y
                );

            if (
                distance <
                STATION_MIN_DISTANCE
            ) {

                valid = false;
                break;
            }
        }


        if (!valid) continue;


        stations.push({
            id:
                Date.now() +
                Math.random(),

            type:
                types[
                    Math.floor(
                        Math.random() *
                        types.length
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

    if (
        stations.length < 2
    ) {
        return;
    }


    const available =
        stations.filter(
            station =>
                station.waiting.length <
                MAX_WAITING
        );


    if (
        available.length === 0
    ) {
        return;
    }


    const origin =
        available[
            Math.floor(
                Math.random() *
                available.length
            )
        ];


    const destinations =
        stations.filter(
            station =>
                station !== origin
        );


    if (
        destinations.length === 0
    ) {
        return;
    }


    const destination =
        destinations[
            Math.floor(
                Math.random() *
                destinations.length
            )
        ];


    const passenger = {
        id:
            Date.now() +
            Math.random(),

        origin,
        destination
    };


    origin.waiting.push(
        passenger
    );

    passengers.push(
        passenger
    );


    updateStats();
}


/* =========================================================
   MAIN UPDATE
========================================================= */

function update(dt) {
    if (paused || gameOver || weeklyChoiceOpen) {
       return;
    }

    /* WEEK */

    weekTimer += dt;

    if (weekTimer >= WEEK_DURATION) {
       weekTimer = 0;
   
       finishWeek();
   
       return;
    }


    updateWeekProgress();

    updatePassengers(dt);
    updateTrains(dt);


    /* STATION SPAWN */

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


    /* PASSENGERS */

    passengerTimer += dt;

    if (
        passengerTimer >=
        PASSENGER_SPAWN_TIME
    ) {

        passengerTimer = 0;

        spawnPassenger();
    }


    /* TRAINS */

    updateTrains(dt);


    /* GAME OVER */

    const totalWaiting =
        stations.reduce(
            (sum, station) =>
                sum +
                station.waiting.length,
            0
        );


    if (
        totalWaiting >=
        MAX_WAITING
    ) {

        endGame();
    }


    updateStats();
}

function finishWeek() {
    // Automatic weekly reward
    addWeeklyTrain();

    // Pause the game and ask the player what they want
    openWeeklyChoice();

    updateStats();
    draw();
}
/* =========================================================
   TRAIN UPDATE
========================================================= */

function updateTrains(dt) {

    for (const train of trains) {

        /*
            Depot trains don't move.
        */

        if (
            !train.placed ||
            !train.line
        ) {
            continue;
        }


        /*
            Boarding pauses the train.
        */

        if (train.boarding) {

             train.boardingTimer -= dt;
         
             if (train.boardingTimer > 0) {
                 continue;
             }
         
             boardNextPassenger(train);
         
             if (train.boarding) {
                 continue;
             }
         
             // Boarding finished.
             // Continue moving this same frame.
         }


        const line =
            train.line;


        if (
            line.stations.length < 2
        ) {
            continue;
        }


        let remainingDistance =
            TRAIN_SPEED * dt;


        /*
            Continue using the remaining
            distance even after reaching
            a station.

            This is what makes the train
            smoothly reverse instead of
            teleporting.
        */

        while (
            remainingDistance > 0
        ) {

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


            const length =
                Math.hypot(
                    dx,
                    dy
                );


            if (length <= 0) {
                break;
            }


            let distanceToStation;


            if (
                train.direction === 1
            ) {

                distanceToStation =
                    length *
                    (
                        1 -
                        train.progress
                    );

            } else {

                distanceToStation =
                    length *
                    train.progress;
            }


            const movement =
                Math.min(
                    remainingDistance,
                    distanceToStation
                );


            train.progress +=
                train.direction *
                (
                    movement /
                    length
                );


            remainingDistance -=
                movement;


            updateTrainPosition(
                train
            );


            /*
                ARRIVED.
            */

            if (
                movement >=
                distanceToStation -
                0.0001
            ) {

                arriveAtStation(
                    train
                );


                /*
                    Boarding means stop here.
                */

                if (
                    train.boarding
                ) {
                    break;
                }
            }
        }


        updateTrainPosition(
            train
        );
    }
}

function createDepotTrain() {
    return {
        id: Date.now() + Math.random(),

        placed: false,
        inDepot: true,

        x: 65,
        y: 70,

        line: null,

        segmentIndex: 0,
        progress: 0,
        direction: 1,

        passengers: [],

        boarding: false,
        boardingTimer: 0,
        boardingStation: null,

        angle: 0
    };
}
/* =========================================================
   GET TRAIN SEGMENT
========================================================= */

function getTrainSegment(train) {

    if (!train.line) {
        return null;
    }


    const line =
        train.line;


    const from =
        line.stations[
            train.segmentIndex
        ];

    const to =
        line.stations[
            train.segmentIndex + 1
        ];


    if (
        !from ||
        !to
    ) {
        return null;
    }


    return {
        from,
        to
    };
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


    const a =
        segment.from;

    const b =
        segment.to;


    train.x =
        a.x +
        (
            b.x -
            a.x
        ) *
        train.progress;


    train.y =
        a.y +
        (
            b.y -
            a.y
        ) *
        train.progress;


    updateTrainAngle(
        train
    );
}

function resetTrainsOnInvalidLines() {
    trains.forEach(train => {

         if (!train.placed || !train.line) {
              return;
          }
      
          const lineExists = lines.some(
              line => line.id === train.line.id
          );
      
          if (!lineExists) {
              train.placed = false;
              train.inDepot = true;
      
              train.x = 65;
              train.y = 70;
      
              train.line = null;
      
              train.segmentIndex = 0;
              train.progress = 0;
              train.direction = 1;
      
              train.passengers = [];
      
              train.boarding = false;
              train.boardingTimer = 0;
              train.boardingStation = null;
      
              return;
          }

        const currentLine = lines.find(
            line => line.id === train.line.id
        );

        if (!currentLine) {

            train.placed = false;
            train.inDepot = true;

            train.x = 65;
            train.y = 70;

            train.line = null;

            train.segmentIndex = 0;
            train.progress = 0;
            train.direction = 1;

            train.passengers = [];

            train.boarding = false;
            train.boardingTimer = 0;
            train.boardingStation = null;

            train.angle = 0;
        }
    });
}

/* =========================================================
   TRAIN ANGLE
========================================================= */

function updateTrainAngle(train) {

    const segment =
        getTrainSegment(train);


    if (!segment) {
        return;
    }


    const angle =
        Math.atan2(
            segment.to.y -
                segment.from.y,

            segment.to.x -
                segment.from.x
        );


    train.angle =
        train.direction === 1
            ? angle
            : angle + Math.PI;
}


/* =========================================================
   ARRIVE AT STATION
========================================================= */

function arriveAtStation(train) {

    const line =
        train.line;


    let station;


    if (
        train.direction === 1
    ) {

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


    if (!station) {
        return;
    }


    /*
        Snap exactly onto the station.
    */

    train.x =
        station.x;

    train.y =
        station.y;


    /*
        Drop off passengers.
    */

    unloadPassengers(
        train,
        station
    );


    /*
        Boarding.
    */

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
        FULL ROUTE REVERSAL.

        Forward:

        A → B → C → D

        At D:

        D → C → B → A

        At A:

        A → B → C → D
    */

    if (
        train.direction === 1
    ) {

        if (
            train.segmentIndex >=
            line.stations.length - 2
        ) {

            /*
                At final station.
            */

            train.direction = -1;

            train.progress = 1;

        } else {

            /*
                Move to next segment.
            */

            train.segmentIndex++;

            train.progress = 0;
        }

    } else {

        if (
            train.segmentIndex <= 0
        ) {

            /*
                At first station.
            */

            train.direction = 1;

            train.progress = 0;

        } else {

            /*
                Move backward one segment.
            */

            train.segmentIndex--;

            train.progress = 1;
        }
    }


    updateTrainAngle(
        train
    );

    updateStats();
}


/* =========================================================
   UNLOAD
========================================================= */

function unloadPassengers(
    train,
    station
) {

    const remaining = [];


    for (
        const passenger of
        train.passengers
    ) {

        if (
            passenger.destination ===
            station
        ) {

            score++;

        } else {

            remaining.push(
                passenger
            );
        }
    }


    train.passengers =
        remaining;
}


/* =========================================================
   BOARD
========================================================= */

function boardNextPassenger(
    train
) {

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

        train.boardingStation =
            null;

        return;
    }


    if (
        station.waiting.length === 0
    ) {

        train.boarding = false;

        train.boardingStation =
            null;

        return;
    }


    const passenger =
        station.waiting.shift();


    const index =
        passengers.indexOf(
            passenger
        );


    if (index !== -1) {

        passengers.splice(
            index,
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

        train.boardingStation =
            null;
    }


    updateStats();
}


/* =========================================================
   CREATE LINE
========================================================= */

function createLine(firstStation, secondStation) {
    if (unlockedLineCount <= 0) {
        return;
    }

    const availableColors = [];

    for (let i = 0; i < unlockedLineCount; i++) {
        const alreadyUsed = lines.some(
            line => line.colorIndex === i
        );

        if (!alreadyUsed) {
            availableColors.push(i);
        }
    }

    if (availableColors.length === 0) {
        updateLineStatus();
        return;
    }

    let colorIndex = selectedLineColorIndex;

    if (
        colorIndex >= unlockedLineCount ||
        lines.some(line => line.colorIndex === colorIndex)
    ) {
        colorIndex = availableColors[0];
    }

    const line = {
        id: Date.now() + Math.random(),

        color: LINE_COLORS[colorIndex],

        colorIndex: colorIndex,

        stations: [
            firstStation,
            secondStation
        ]
    };

    lines.push(line);

    selectedLineColorIndex = colorIndex;

    updateStats();
    updateLineStatus();
    draw();
}


function openWeeklyChoice() {
    weeklyChoiceOpen = true;

    const overlay = document.createElement("div");

    overlay.id = "weeklyChoice";

    const nextColorIndex = unlockedLineCount;
    const hasLineAvailable =
        nextColorIndex < MAX_LINE_UNLOCKS;

    const nextColor =
        LINE_COLORS[nextColorIndex];

    const nextColorName =
        getLineColorName(nextColorIndex);

    overlay.innerHTML = `
        <div class="weekly-choice-card">

            <div class="weekly-choice-kicker">
                WEEK ${week} COMPLETE
            </div>

            <h2>Network Expansion</h2>

            <p class="weekly-choice-description">
                Your weekly train has been added.
                Choose your next upgrade.
            </p>

            <div class="weekly-choice-options">

                ${
                    hasLineAvailable
                    ? `
                        <button
                            class="weekly-choice-option"
                            id="unlockLineChoice"
                        >
                            <span
                                class="choice-icon"
                                style="--choice-color:${nextColor};"
                            ></span>

                            <span>
                                <strong>
                                    Unlock New Line
                                </strong>

                                <small>
                                    ${nextColorName} line
                                </small>
                            </span>
                        </button>
                    `
                    : ""
                }

                <button
                    class="weekly-choice-option"
                    id="additionalTrainChoice"
                >
                    <span class="choice-train-icon">
                        🚆
                    </span>

                    <span>
                        <strong>
                            Additional Train
                        </strong>

                        <small>
                            Add another train to your fleet
                        </small>
                    </span>
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    const lineButton =
        document.getElementById("unlockLineChoice");

    if (lineButton) {
        lineButton.addEventListener("click", () => {
            unlockNextLine();
            completeWeeklyChoice();
        });
    }

    const trainButton =
        document.getElementById("additionalTrainChoice");

    trainButton.addEventListener("click", () => {
        addAdditionalTrain();
        completeWeeklyChoice();
    });
}

function completeWeeklyChoice() {
    week++;

    closeWeeklyChoice();

    weeklyChoiceOpen = false;

    updateStats();
    updateWeekProgress();
    draw();
}

function closeWeeklyChoice() {
    const overlay =
        document.getElementById("weeklyChoice");

    if (overlay) {
        overlay.remove();
    }

    weeklyChoiceOpen = false;
}

function unlockNextLine() {
    if (unlockedLineCount >= MAX_LINE_UNLOCKS) {
        return;
    }

    unlockedLineCount++;

    selectedLineColorIndex =
        unlockedLineCount - 1;

    updateLineStatus();
    updateStats();
    draw();
}

/* =========================================================
   EXTEND LINE
========================================================= */

function connectStations(
    firstStation,
    secondStation
) {

    if (
        !firstStation ||
        !secondStation
    ) {
        return;
    }


    if (
        firstStation ===
        secondStation
    ) {
        return;
    }


    /*
        Check whether we're extending
        an existing line.
    */

    for (
        const line of lines
    ) {

        const firstIndex =
            line.stations.indexOf(
                firstStation
            );


        const secondIndex =
            line.stations.indexOf(
                secondStation
            );


        if (
            firstIndex === -1 ||
            secondIndex !== -1
        ) {
            continue;
        }


        /*
            EXTEND AT BEGINNING
        */

        if (
            firstIndex === 0
        ) {

            const oldFirst =
                line.stations[0];


            line.stations.unshift(
                secondStation
            );


            /*
                Existing train route indexes
                shift by one.
            */

            for (
                const train of trains
            ) {

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
                    ) < 3;


                if (atOldFirst) {

                    /*
                        Train is at the old
                        first station.

                        Send it toward the
                        newly added station.
                    */

                    train.segmentIndex = 0;

                    train.progress = 1;

                    train.direction = -1;

                } else {

                    train.segmentIndex++;
                }


                updateTrainPosition(
                    train
                );
            }


            updateStats();
            draw();

            return;
        }


        /*
            EXTEND AT END
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


            for (
                const train of trains
            ) {

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
                    ) < 3;


                if (atOldLast) {

                    /*
                        Continue onto the
                        newly added station.
                    */

                    train.segmentIndex =
                        line.stations.length - 2;

                    train.progress = 0;

                    train.direction = 1;
                }


                updateTrainPosition(
                    train
                );
            }


            updateStats();
            draw();

            return;
        }
    }


    /*
        Don't duplicate an existing
        segment.
    */

    for (
        const line of lines
    ) {

        for (
            let i = 0;
            i <
            line.stations.length - 1;
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
        New line = new permanent color.
    */

    createLine(
        firstStation,
        secondStation
    );
}

function findLineForTrainAtStation(station) {
    const matchingLines = lines.filter(line =>
        line.stations.includes(station)
    );

    if (matchingLines.length === 0) {
        return null;
    }

    // If the currently selected line uses this station,
    // use that line.
    const selectedLine = matchingLines.find(
        line =>
            line.colorIndex === selectedLineColorIndex
    );

    if (selectedLine) {
        return selectedLine;
    }

    // If there is only one possible line,
    // use it.
    if (matchingLines.length === 1) {
        return matchingLines[0];
    }

    // Otherwise use the first matching line.
    return matchingLines[0];
}

/* =========================================================
   PLACE TRAIN
========================================================= */

function placeTrain(
    train,
    x,
    y
) {

    const station =
        getStationAt(
            x,
            y
        );


    /*
        DROPPED ON STATION
    */

    if (station) {

        const line = findLineForTrainAtStation(station);
        train.line = line;


        train.placed = true;
        train.inDepot = false;

        train.x =
            station.x;

        train.y =
            station.y;


        /*
            ONLY attach to the line that
            actually contains this station.
        */


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


        updateStats();
        draw();

        return;
    }


    /*
        DROPPED ON RAIL
    */

    const closest =
        findClosestPointOnAnyLine(
            x,
            y
        );


    if (closest) {

        train.placed = true;
        train.inDepot = false;


        /*
            THIS is the exact line that
            was selected.

            No searching for another line.
        */

        train.line =
            closest.line;


        train.segmentIndex =
            closest.index;

        train.progress =
            closest.progress;

        train.direction = 1;


        train.x =
            closest.x;

        train.y =
            closest.y;


        train.boarding = false;
        train.boardingStation = null;


        updateTrainAngle(
            train
        );


        updateStats();
        draw();

        return;
    }


    /*
        INVALID DROP:
        Return to depot.
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
   SET TRAIN AT STATION
========================================================= */

function setTrainAtStation(
    train,
    station,
    line
) {

    const index =
        line.stations.indexOf(
            station
        );


    /*
        FIRST STATION
    */

    if (
        index === 0
    ) {

        train.segmentIndex = 0;

        train.progress = 0;

        train.direction = 1;
    }


    /*
        LAST STATION
    */

    else if (
        index ===
        line.stations.length - 1
    ) {

        train.segmentIndex =
            line.stations.length - 2;

        train.progress = 1;

        train.direction = -1;
    }


    /*
        MIDDLE STATION
    */

    else {

        train.segmentIndex =
            index;

        train.progress = 0;

        train.direction = 1;
    }


    updateTrainPosition(
        train
    );
}


/* =========================================================
   FIND CLOSEST RAIL
========================================================= */

function findClosestPointOnAnyLine(
    x,
    y
) {

    let closest = null;

    let closestDistance =
        Infinity;


    for (
        const line of lines
    ) {

        for (
            let i = 0;
            i <
            line.stations.length - 1;
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

                    progress:
                        result.progress,

                    x:
                        result.x,

                    y:
                        result.y
                };
            }
        }
    }


    /*
        25px placement radius.
    */

    if (
        closest &&
        closestDistance <= 25
    ) {

        return closest;
    }


    return null;
}


/* =========================================================
   CLOSEST POINT ON SEGMENT
========================================================= */

function closestPointOnSegment(
    px,
    py,
    ax,
    ay,
    bx,
    by
) {

    const dx =
        bx - ax;

    const dy =
        by - ay;


    const lengthSquared =
        dx * dx +
        dy * dy;


    if (
        lengthSquared === 0
    ) {

        return {

            x: ax,

            y: ay,

            progress: 0,

            distance:
                Math.hypot(
                    px - ax,
                    py - ay
                )
        };
    }


    let t =
        (
            (px - ax) * dx +
            (py - ay) * dy
        ) /
        lengthSquared;


    t =
        Math.max(
            0,
            Math.min(
                1,
                t
            )
        );


    const x =
        ax +
        dx * t;

    const y =
        ay +
        dy * t;


    return {

        x,
        y,

        progress: t,

        distance:
            Math.hypot(
                px - x,
                py - y
            )
    };
}


/* =========================================================
   INPUT
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


        const pos =
            getCanvasPosition(
                event
            );


        pointerX = pos.x;
        pointerY = pos.y;


        /*
            RIGHT CLICK:
            remove rail.
        */

        if (
            event.button === 2
        ) {

            removeRailAt(
                pointerX,
                pointerY
            );

            return;
        }


        /*
            Check depot train.
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


            draw();

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


/* =========================================================
   POINTER MOVE
========================================================= */

canvas.addEventListener(
    "pointermove",
    event => {

        const pos =
            getCanvasPosition(
                event
            );


        pointerX = pos.x;
        pointerY = pos.y;


        /*
            DRAGGING TRAIN
        */

        if (
            draggingTrain
        ) {

            draggingTrain.x =
                pointerX;

            draggingTrain.y =
                pointerY;


            draw();

            return;
        }


        /*
            DRAWING RAIL
        */

        if (
            draggingRail
        ) {

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

        const pos =
            getCanvasPosition(
                event
            );


        pointerX = pos.x;
        pointerY = pos.y;


        /*
            TRAIN DROP
        */

        if (
            draggingTrain
        ) {

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


        /*
            RAIL DROP
        */

        if (
            draggingRail
        ) {

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


/* =========================================================
   DISABLE CONTEXT MENU
========================================================= */

canvas.addEventListener(
    "contextmenu",
    event => {
        event.preventDefault();
    }
);


/* =========================================================
   POSITION
========================================================= */

function getCanvasPosition(
    event
) {

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

function getStationAt(
    x,
    y
) {

    for (
        let i =
            stations.length - 1;
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

function getDepotTrainAt(
    x,
    y
) {

    for (
        const train of trains
    ) {

        if (
            !train.inDepot
        ) {
            continue;
        }


        /*
            Large, easy-to-hit area.
        */

        if (
            x >= 20 &&
            x <= 110 &&
            y >= 25 &&
            y <= 115
        ) {

            return train;
        }
    }


    return null;
}


/* =========================================================
   REMOVE RAIL
========================================================= */

function removeRailAt(
    x,
    y
) {

    for (
        let li =
            lines.length - 1;
        li >= 0;
        li--
    ) {

        const line =
            lines[li];


        for (
            let i = 0;
            i <
            line.stations.length - 1;
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


            if (
                closest.distance < 12
            ) {

                /*
                    If only two stations,
                    remove entire line.
                */

                if (
                    line.stations.length <= 2
                ) {

                    for (
                        const train of trains
                    ) {

                        if (
                            train.line ===
                            line
                        ) {

                            train.line =
                                null;

                            train.segmentIndex = 0;

                            train.progress = 0;

                            train.direction = 1;
                        }
                    }


                    lines.splice(
                        li,
                        1
                    );

                } else {

                    /*
                        Split the line.

                        BOTH resulting pieces
                        keep the ORIGINAL color.
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
                        
                            colorIndex:
                                line.colorIndex,
                        
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
                        
                            colorIndex:
                                line.colorIndex,
                        
                            stations:
                                rightStations
                        });
                    }


                    /*
                        Any train whose original
                        line was split is detached.
                    */

                    for (
                        const train of trains
                    ) {

                        if (
                            train.line === line
                        ) {

                            train.line =
                                null;
                        }
                    }
                }
                resetTrainsOnInvalidLines();

                updateStats();
                draw();

                return true;
            }
        }
    }


    return false;
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

    drawTrainPlacementPreview();

    drawDepot();
}


/* =========================================================
   DRAW LINES
========================================================= */

function drawLines() {

    for (
        const line of lines
    ) {

        if (
            line.stations.length < 2
        ) {
            continue;
        }


        /*
            One single stroke for the
            ENTIRE line.

            No per-segment recoloring.
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


    /*
        While dragging a train over a rail,
        highlight THAT EXACT LINE.
    */

    if (
        draggingTrain
    ) {

        const target =
            findClosestPointOnAnyLine(
                pointerX,
                pointerY
            );


        if (target) {

            const line =
                target.line;


            ctx.save();

            ctx.beginPath();

            ctx.moveTo(
                line.stations[0].x,
                line.stations[0].y
            );


            for (
                let i = 1;
                i <
                line.stations.length;
                i++
            ) {

                ctx.lineTo(
                    line.stations[i].x,
                    line.stations[i].y
                );
            }


            ctx.strokeStyle =
                line.color;

            ctx.globalAlpha =
                0.22;

            ctx.lineWidth =
                16;

            ctx.lineCap =
                "round";

            ctx.lineJoin =
                "round";

            ctx.stroke();

            ctx.restore();
        }
    }
}


/* =========================================================
   RAIL PREVIEW
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
   TRAIN PLACEMENT PREVIEW
========================================================= */

function drawTrainPlacementPreview() {

    if (
        !draggingTrain
    ) {
        return;
    }


    /*
        First check for station.
    */

    const station =
        getStationAt(
            pointerX,
            pointerY
        );


    if (station) {

        ctx.save();


        /*
            Placement ring.
        */

        ctx.beginPath();

        ctx.arc(
            station.x,
            station.y,
            27,
            0,
            Math.PI * 2
        );


        ctx.strokeStyle =
            "rgba(22,24,28,0.35)";

        ctx.lineWidth = 2;

        ctx.setLineDash([
            5,
            5
        ]);

        ctx.stroke();


        /*
            Ghost train.
        */

        ctx.globalAlpha =
            0.45;


        drawTrainShape(
            station.x,
            station.y,
            0,
            1.15
        );


        ctx.restore();

        return;
    }


    /*
        Otherwise check for rail.
    */

    const rail =
        findClosestPointOnAnyLine(
            pointerX,
            pointerY
        );


    if (rail) {

        ctx.save();


        /*
            Placement circle.
        */

        ctx.beginPath();

        ctx.arc(
            rail.x,
            rail.y,
            22,
            0,
            Math.PI * 2
        );


        ctx.strokeStyle =
            rail.line.color;

        ctx.lineWidth = 3;

        ctx.globalAlpha =
            0.75;


        ctx.stroke();


        /*
            Ghost train aligned with
            the selected rail.
        */

        const a =
            rail.line.stations[
                rail.index
            ];

        const b =
            rail.line.stations[
                rail.index + 1
            ];


        const angle =
            Math.atan2(
                b.y - a.y,
                b.x - a.x
            );


        ctx.globalAlpha =
            0.45;


        drawTrainShape(
            rail.x,
            rail.y,
            angle,
            1.15
        );


        ctx.restore();

        return;
    }


    /*
        No valid placement:
        show the train at the cursor
        with lower opacity.
    */

    ctx.save();

    ctx.globalAlpha =
        0.25;


    drawTrainShape(
        pointerX,
        pointerY,
        0,
        1.15
    );


    ctx.restore();
}


/* =========================================================
   DRAW STATIONS
========================================================= */

function drawStations() {

    for (
        const station of stations
    ) {

        drawStationShape(
            station.x,
            station.y,
            station.type
        );


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


    if (
        type === "circle"
    ) {

        ctx.arc(
            x,
            y,
            STATION_RADIUS,
            0,
            Math.PI * 2
        );

    } else if (
        type === "triangle"
    ) {

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
            (
                Math.PI * 2 /
                maxVisible
            ) * i;


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


    ctx.beginPath();


    if (
        type === "circle"
    ) {

        ctx.arc(
            x,
            y,
            size,
            0,
            Math.PI * 2
        );

    } else if (
        type === "triangle"
    ) {

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
   TRAINS
========================================================= */

function drawTrains() {

    for (
        const train of trains
    ) {

        /*
            Dragged train gets drawn
            separately as a ghost.
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
            train.placed
                ? 1
                : 1.15
        );


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


    ctx.rotate(
        angle
    );


    const width =
        34 * scale;

    const height =
        15 * scale;


    /*
        Body.
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
        width / 2 -
            6 * scale,
        -height / 2
    );


    ctx.lineTo(
        width / 2,
        0
    );


    ctx.lineTo(
        width / 2 -
            6 * scale,
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


        drawDestinationIcon(
            -8 + i * 3,
            0,
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
        trains.find(
            t => t.inDepot
        );


    if (!train) {
        return;
    }


    /*
        Don't draw duplicate train while
        dragging.
    */

    if (
        train === draggingTrain
    ) {
        return;
    }


    ctx.save();


    /*
        Larger depot.
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
        Train.
    */

    drawTrainShape(
        65,
        70,
        0,
        1.25
    );


    /*
        Label.
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
        weekEl.textContent = week;
    }

    if (scoreEl) {
        scoreEl.textContent = score;
    }

    if (waitingEl) {
        waitingEl.textContent = passengers.length;
    }

    if (stationCountEl) {
        stationCountEl.textContent = stations.length;
    }

    if (trainCountEl) {
        trainCountEl.textContent = trains.length;
    }

    if (lineCountEl) {
        lineCountEl.textContent = lines.length;
    }

    updateLineStatus();
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

            paused =
                !paused;


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
   START
========================================================= */

window.addEventListener(
    "resize",
    resizeCanvas
);


resizeCanvas();

initGame();

requestAnimationFrame(
    gameLoop
);
