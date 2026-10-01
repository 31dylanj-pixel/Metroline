/* =========================================================
   MINI METRO PROTOTYPE
   CORE VERSION
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

const PASSENGER_SPAWN_TIME = 4;

const STATION_RADIUS = 16;

const STATION_MIN_DISTANCE = 105;

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

    stationFill: "#f8fafc",

    stationOutline: "#111827",

    passenger: "#111827"

};


/* =========================================================
   GAME STATE
   ========================================================= */

let stations = [];

let lines = [];

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

let nextLineId = 1;

let nextLineColorIndex = 0;


/* =========================================================
   DRAWING / DRAGGING STATE
   ========================================================= */

let draggingRail = false;

let railStartStation = null;

let pointerX = 0;

let pointerY = 0;


/* =========================================================
   CANVAS RESIZE
   ========================================================= */

function resizeCanvas() {

    const rect =
        gameArea.getBoundingClientRect();

    canvas.width =
        rect.width;

    canvas.height =
        rect.height;

    repositionStations();

    draw();

}


/* =========================================================
   KEEP STATIONS IN RELATIVE POSITIONS
   ========================================================= */

function repositionStations() {

    stations.forEach(station => {

        station.x =
            station.relativeX *
            canvas.width;

        station.y =
            station.relativeY *
            canvas.height;

    });

}


/* =========================================================
   CREATE STATION
   ========================================================= */

function createStation(
    type,
    x,
    y
) {

    const station = {

        id: nextStationId++,

        type,

        x,

        y,

        relativeX:
            x / canvas.width,

        relativeY:
            y / canvas.height,

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
   RANDOM STATION
   ========================================================= */

function spawnRandomStation() {

    if (
        stations.length >=
        MAX_STATIONS
    ) {
        return;
    }

    const types = [
        "circle",
        "triangle",
        "square"
    ];

    let attempts = 0;

    while (
        attempts < 100
    ) {

        attempts++;

        const margin = 65;

        const x =
            margin +
            Math.random() *
            (
                canvas.width -
                margin * 2
            );

        const y =
            margin +
            Math.random() *
            (
                canvas.height -
                margin * 2
            );


        let tooClose = false;

        for (
            const station of stations
        ) {

            const distance =
                Math.hypot(
                    station.x - x,
                    station.y - y
                );

            if (
                distance <
                STATION_MIN_DISTANCE
            ) {

                tooClose = true;

                break;

            }

        }

        if (tooClose) {
            continue;
        }


        const type =
            types[
                Math.floor(
                    Math.random() *
                    types.length
                )
            ];


        const station =
            createStation(
                type,
                x,
                y
            );


        station.pulse = 1;

        updateUI();

        return;

    }

}


/* =========================================================
   FIND STATION UNDER POINTER
   ========================================================= */

function getStationAt(
    x,
    y
) {

    for (
        let i = stations.length - 1;
        i >= 0;
        i--
    ) {

        const station =
            stations[i];

        const distance =
            Math.hypot(
                station.x - x,
                station.y - y
            );

        if (
            distance <=
            STATION_RADIUS + 10
        ) {

            return station;

        }

    }

    return null;

}


/* =========================================================
   CREATE LINE
   ========================================================= */

function createLine(
    firstStation,
    secondStation
) {

    const colors = [

        COLORS.line1,

        COLORS.line2,

        COLORS.line3,

        COLORS.line4,

        COLORS.line5

    ];


    const line = {

        id: nextLineId++,

        color:
            colors[
                nextLineColorIndex %
                colors.length
            ],

        stations: [

            firstStation,

            secondStation

        ],

        loop: false

    };


    nextLineColorIndex++;

    lines.push(line);

    updateUI();

}


/* =========================================================
   ADD STATION TO EXISTING LINE
   ========================================================= */

function addStationToLine(
    line,
    station
) {

    if (!line) {
        return;
    }

    if (
        line.stations.includes(
            station
        )
    ) {
        return;
    }


    line.stations.push(
        station
    );

    line.loop = false;

    updateUI();

}


/* =========================================================
   HANDLE RAIL DRAG
   ========================================================= */

canvas.addEventListener(
    "pointerdown",
    event => {

        if (
            paused ||
            gameEnded
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


        const station =
            getStationAt(
                pointerX,
                pointerY
            );


        if (!station) {
            return;
        }


        draggingRail = true;

        railStartStation =
            station;


        canvas.setPointerCapture(
            event.pointerId
        );


        draw();

    }
);


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


        if (!draggingRail) {
            return;
        }


        draw();

    }
);


canvas.addEventListener(
    "pointerup",
    event => {

        if (!draggingRail) {
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
);


/* =========================================================
   CONNECT STATIONS
   ========================================================= */

function connectStations(
    start,
    end
) {

    /*
       First check whether the starting station
       belongs to an existing line.
    */

    let existingLine =
        lines.find(
            line =>
                line.stations[
                    line.stations.length - 1
                ] === start
        );


    /*
       Also allow dragging from the beginning
       of a line.
    */

    if (!existingLine) {

        existingLine =
            lines.find(
                line =>
                    line.stations[0] === start
            );

    }


    /*
       If there is no line here,
       create a completely new one.
    */

    if (!existingLine) {

        createLine(
            start,
            end
        );

        return;

    }


    /*
       Add the destination station to
       the end of the existing line.
    */

    addStationToLine(
        existingLine,
        end
    );

}


/* =========================================================
   RIGHT CLICK = REMOVE RAIL SECTION
   ========================================================= */

canvas.addEventListener(
    "contextmenu",
    event => {

        event.preventDefault();

        if (
            paused ||
            gameEnded
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


        removeRailAt(
            x,
            y
        );

    }
);


/* =========================================================
   POINT → SEGMENT DISTANCE
   ========================================================= */

function pointToSegmentDistance(
    px,
    py,
    x1,
    y1,
    x2,
    y2
) {

    const dx =
        x2 - x1;

    const dy =
        y2 - y1;


    if (
        dx === 0 &&
        dy === 0
    ) {

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
                (
                    dx * dx +
                    dy * dy
                )
            )
        );


    const closestX =
        x1 + t * dx;

    const closestY =
        y1 + t * dy;


    return Math.hypot(
        px - closestX,
        py - closestY
    );

}


/* =========================================================
   REMOVE RAIL
   ========================================================= */

function removeRailAt(
    x,
    y
) {

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


            const distance =
                pointToSegmentDistance(
                    x,
                    y,
                    a.x,
                    a.y,
                    b.x,
                    b.y
                );


            if (
                distance < 12
            ) {

                /*
                   Remove the section and everything
                   after it from this line.
                */

                line.stations =
                    line.stations.slice(
                        0,
                        i + 1
                    );


                if (
                    line.stations.length <
                    2
                ) {

                    lines.splice(
                        lines.indexOf(line),
                        1
                    );

                }


                updateUI();

                draw();

                return;

            }

        }

    }

}


/* =========================================================
   SPAWN PASSENGER
   ========================================================= */

function spawnPassenger() {

    if (
        stations.length < 2
    ) {
        return;
    }


    const origin =
        stations[
            Math.floor(
                Math.random() *
                stations.length
            )
        ];


    const possibleDestinations =
        stations.filter(
            station =>
                station !== origin
        );


    if (
        !possibleDestinations.length
    ) {
        return;
    }


    const destination =
        possibleDestinations[
            Math.floor(
                Math.random() *
                possibleDestinations.length
            )
        ];


    const passenger = {

        id:
            nextPassengerId++,

        origin,

        destination,

        type:
            destination.type

    };


    origin.passengers.push(
        passenger
    );


    updateUI();

}


/* =========================================================
   DRAW SHAPE
   ========================================================= */

function drawShape(
    type,
    x,
    y,
    size,
    fill,
    stroke,
    lineWidth = 2
) {

    ctx.save();

    ctx.translate(
        x,
        y
    );


    ctx.fillStyle =
        fill;

    ctx.strokeStyle =
        stroke;

    ctx.lineWidth =
        lineWidth;


    ctx.beginPath();


    if (
        type === "circle"
    ) {

        ctx.arc(
            0,
            0,
            size,
            0,
            Math.PI * 2
        );

    }


    else if (
        type === "triangle"
    ) {

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

    }


    else if (
        type === "square"
    ) {

        ctx.rect(
            -size,
            -size,
            size * 2,
            size * 2
        );

    }


    ctx.fill();

    ctx.stroke();

    ctx.restore();

}


/* =========================================================
   DRAW STATION
   ========================================================= */

function drawStation(
    station
) {

    ctx.save();


    /*
       New station pulse.
    */

    if (
        station.pulse > 0
    ) {

        ctx.beginPath();

        ctx.arc(
            station.x,
            station.y,
            STATION_RADIUS +
                station.pulse * 24,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            getStationColor(
                station.type
            );

        ctx.lineWidth = 3;

        ctx.globalAlpha =
            station.pulse;

        ctx.stroke();

    }


    /*
       Main station shape.
    */

    drawShape(

        station.type,

        station.x,

        station.y,

        STATION_RADIUS,

        COLORS.stationFill,

        getStationColor(
            station.type
        ),

        5

    );


    /*
       Draw waiting passengers around
       the station.
    */

    drawWaitingPassengers(
        station
    );


    ctx.restore();

}


/* =========================================================
   DRAW WAITING PASSENGERS
   ========================================================= */

function drawWaitingPassengers(
    station
) {

    const count =
        station.passengers.length;


    if (!count) {
        return;
    }


    /*
       Arrange passengers in a small
       arc around the station.
    */

    const radius = 30;

    const angleStep =
        Math.min(
            0.55,
            Math.PI /
                Math.max(count, 1)
        );


    const startAngle =
        -(
            angleStep *
            (count - 1)
        ) /
        2;


    station.passengers.forEach(
        (passenger, index) => {

            const angle =
                startAngle +
                index *
                angleStep;


            const x =
                station.x +
                Math.cos(angle) *
                radius;

            const y =
                station.y +
                Math.sin(angle) *
                radius;


            /*
               Small dark destination icon.
            */

            drawShape(

                passenger.type,

                x,

                y,

                5,

                getStationColor(
                    passenger.type
                ),

                COLORS.passenger,

                1.5

            );

        }
    );


    /*
       If there are many passengers,
       show the exact count too.
    */

    if (
        count > 5
    ) {

        ctx.fillStyle =
            COLORS.passenger;

        ctx.font =
            "700 11px Poppins, sans-serif";

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";


        ctx.fillText(

            `+${count - 5}`,

            station.x,

            station.y + 42

        );

    }

}


/* =========================================================
   GET STATION COLOR
   ========================================================= */

function getStationColor(
    type
) {

    return (
        COLORS[type] ||
        "#ffffff"
    );

}


/* =========================================================
   DRAW RAILS
   ========================================================= */

function drawLines() {

    for (
        const line of lines
    ) {

        if (
            line.stations.length <
            2
        ) {
            continue;
        }


        ctx.save();

        ctx.strokeStyle =
            line.color;

        ctx.lineWidth = 7;

        ctx.lineCap =
            "round";

        ctx.lineJoin =
            "round";


        ctx.beginPath();


        const first =
            line.stations[0];


        ctx.moveTo(
            first.x,
            first.y
        );


        for (
            let i = 1;
            i <
                line.stations.length;
            i++
        ) {

            const station =
                line.stations[i];

            ctx.lineTo(
                station.x,
                station.y
            );

        }


        ctx.stroke();

        ctx.restore();

    }

}


/* =========================================================
   DRAW DRAG PREVIEW
   ========================================================= */

function drawRailPreview() {

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
        getStationColor(
            railStartStation.type
        );

    ctx.lineWidth = 7;

    ctx.globalAlpha =
        0.45;

    ctx.lineCap =
        "round";


    ctx.setLineDash([
        10,
        8
    ]);


    ctx.stroke();


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


    /*
       Rails first.
    */

    drawLines();


    /*
       Drag preview above rails.
    */

    drawRailPreview();


    /*
       Stations above rails.
    */

    stations.forEach(
        station =>
            drawStation(
                station
            )
    );

}


/* =========================================================
   WEEK PROGRESS BAR
   ========================================================= */

function updateWeekProgress() {

    const percentage =
        Math.max(
            0,
            Math.min(
                100,
                weekProgress * 100
            )
        );


    /*
       Look for an existing progress bar.
    */

    let bar =
        document.getElementById(
            "weekProgressBar"
        );


    /*
       If it doesn't exist, create the
       entire UI next to the week display.
    */

    if (!bar) {

        bar =
            document.createElement(
                "div"
            );

        bar.id =
            "weekProgressBar";


        const fill =
            document.createElement(
                "div"
            );

        fill.id =
            "weekProgressFill";


        bar.appendChild(
            fill
        );


        /*
           Try to place it beside the week.
        */

        if (
            weekEl &&
            weekEl.parentElement
        ) {

            weekEl.parentElement.appendChild(
                bar
            );

        } else {

            document.body.prepend(
                bar
            );

        }

    }


    const fill =
        document.getElementById(
            "weekProgressFill"
        );


    if (fill) {

        fill.style.width =
            `${percentage}%`;

    }

}


/* =========================================================
   WEEK UPDATE
   ========================================================= */

function updateWeek(
    seconds
) {

    weekProgress +=
        seconds /
        WEEK_DURATION;


    if (
        weekProgress >= 1
    ) {

        weekProgress = 0;

        week++;

        /*
           A new station appears when
           the week actually changes.
        */

        spawnRandomStation();

    }


    if (weekEl) {

        weekEl.textContent =
            week;

    }


    updateWeekProgress();

}


/* =========================================================
   UPDATE UI
   ========================================================= */

function updateUI() {

    if (scoreEl) {

        scoreEl.textContent =
            score;

    }


    let waiting = 0;


    stations.forEach(
        station => {

            waiting +=
                station.passengers.length;

        }
    );


    if (waitingEl) {

        waitingEl.textContent =
            waiting;

    }


    if (stationCountEl) {

        stationCountEl.textContent =
            stations.length;

    }


    /*
       No trains yet.
    */

    if (trainCountEl) {

        trainCountEl.textContent =
            "0";

    }


    if (lineCountEl) {

        lineCountEl.textContent =
            lines.length;

    }


    if (lineStatusEl) {

        if (
            lines.length === 0
        ) {

            lineStatusEl.textContent =
                "No rails";

        } else {

            lineStatusEl.textContent =
                `${lines.length} active`;

        }

    }


    if (weekEl) {

        weekEl.textContent =
            week;

    }


    updateWeekProgress();

}


/* =========================================================
   GAME OVER
   ========================================================= */

function checkGameOver() {

    let waiting = 0;


    stations.forEach(
        station => {

            waiting +=
                station.passengers.length;

        }
    );


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
   MAIN GAME LOOP
   ========================================================= */

function gameLoop(
    now
) {

    const seconds =
        Math.min(
            (
                now -
                lastTime
            ) / 1000,
            0.1
        );


    lastTime = now;


    if (
        !paused &&
        !gameEnded
    ) {

        /*
           Advance the week.
        */

        updateWeek(
            seconds
        );


        /*
           Spawn passengers.
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
           Animate newly spawned station.
        */

        stations.forEach(
            station => {

                if (
                    station.pulse > 0
                ) {

                    station.pulse -=
                        seconds *
                        0.7;

                    if (
                        station.pulse < 0
                    ) {

                        station.pulse = 0;

                    }

                }

            }
        );


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

            if (gameEnded) {
                return;
            }


            paused =
                !paused;


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

    passengers = [];

    nextStationId = 1;

    nextPassengerId = 1;

    nextLineId = 1;

    nextLineColorIndex = 0;

    draggingRail = false;

    railStartStation = null;


    if (gameOver) {

        gameOver.style.display =
            "none";

    }


    if (pauseBtn) {

        pauseBtn.textContent =
            "Pause";

    }


    /*
       IMPORTANT:
       There are NO rails at startup.
    */

    createInitialStations();


    updateUI();

    draw();

}


/* =========================================================
   RESTART BUTTON
   ========================================================= */

if (restartBtn) {

    restartBtn.addEventListener(
        "click",
        restartGame
    );

}


/* =========================================================
   PLAY AGAIN
   ========================================================= */

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
