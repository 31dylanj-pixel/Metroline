/* =========================================================
   METROLINE
   Prototype v0.1
========================================================= */


/* ================================
   CANVAS
================================ */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const gameArea = document.getElementById("gameArea");


/* ================================
   UI
================================ */

const weekDisplay = document.getElementById("week");
const scoreDisplay = document.getElementById("score");
const waitingDisplay = document.getElementById("waiting");

const stationCountDisplay =
    document.getElementById("stationCount");

const trainCountDisplay =
    document.getElementById("trainCount");

const lineCountDisplay =
    document.getElementById("lineCount");

const lineStatus =
    document.getElementById("lineStatus");

const pauseBtn =
    document.getElementById("pauseBtn");

const restartBtn =
    document.getElementById("restartBtn");

const gameOverScreen =
    document.getElementById("gameOver");

const finalScore =
    document.getElementById("finalScore");

const playAgain =
    document.getElementById("playAgain");


/* ================================
   GAME STATE
================================ */

let width = 0;
let height = 0;

let stations = [];
let passengers = [];

let lines = [];
let trains = [];

let selectedStation = null;

let score = 0;
let week = 1;

let gameTime = 0;

let paused = false;
let gameOver = false;

let lastTime = 0;


/* ================================
   COLORS
================================ */

const LINE_COLORS = [
    "#e85d4a",
    "#3c82c4",
    "#54a36b",
    "#8b68bd",
    "#d69b35"
];

const SHAPES = [
    "circle",
    "triangle",
    "square"
];


/* ================================
   RESIZE
================================ */

function resizeCanvas() {

    const rect = gameArea.getBoundingClientRect();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = rect.width;
    height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}


window.addEventListener("resize", resizeCanvas);


/* ================================
   DISTANCE
================================ */

function distance(a, b) {

    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}


/* ================================
   RANDOM
================================ */

function random(min, max) {

    return Math.random() * (max - min) + min;
}


/* ================================
   CREATE STATION
================================ */

function createStation() {

    const padding = 70;

    let station;

    let attempts = 0;

    do {

        station = {
            x: random(padding, width - padding),
            y: random(padding, height - padding),

            shape:
                SHAPES[
                    Math.floor(
                        Math.random() * SHAPES.length
                    )
                ],

            passengers: [],

            pulse: 0
        };

        attempts++;

    } while (
        stations.some(
            s => distance(s, station) < 110
        ) &&
        attempts < 100
    );

    stations.push(station);

    return station;
}


/* ================================
   INITIAL NETWORK
================================ */

function createInitialNetwork() {

    stations = [];
    passengers = [];
    lines = [];
    trains = [];

    score = 0;
    week = 1;
    gameTime = 0;

    selectedStation = null;

    gameOver = false;
    paused = false;

    gameOverScreen.classList.add("hidden");

    for (let i = 0; i < 7; i++) {

        createStation();

    }

    /*
       Start with two connected stations
       so the player immediately has
       something moving.
    */

    lines.push({
        id: 0,

        color: LINE_COLORS[0],

        stations: [
            stations[0],
            stations[1]
        ]
    });

    trains.push({
        line: lines[0],

        index: 0,

        progress: 0,

        speed: 0.00012,

        passengers: []
    });

    updateUI();
}


/* ================================
   ADD LINE CONNECTION
================================ */

function connectStations(a, b) {

    if (a === b) return;

    /*
       Check whether this connection
       already exists.
    */

    const exists = lines.some(line => {

        for (let i = 0; i < line.stations.length - 1; i++) {

            const s1 = line.stations[i];
            const s2 = line.stations[i + 1];

            if (
                (s1 === a && s2 === b) ||
                (s1 === b && s2 === a)
            ) {
                return true;
            }
        }

        return false;
    });

    if (exists) return;


    /*
       Add the connection to Line 1
       for the prototype.
    */

    const line = lines[0];

    if (!line.stations.includes(a)) {

        line.stations.push(a);

    }

    if (!line.stations.includes(b)) {

        line.stations.push(b);

    }

    /*
       If there are enough stations,
       create a second train occasionally.
    */

    if (
        line.stations.length >= 4 &&
        trains.length < 2
    ) {

        trains.push({
            line: line,

            index: 0,

            progress: 0,

            speed: 0.00012,

            passengers: []
        });
    }

    lineStatus.textContent =
        `${line.stations.length} stations connected`;

    updateUI();
}


/* ================================
   STATION HIT TEST
================================ */

function stationAt(x, y) {

    for (let i = stations.length - 1; i >= 0; i--) {

        const station = stations[i];

        if (
            Math.hypot(
                station.x - x,
                station.y - y
            ) < 24
        ) {

            return station;

        }
    }

    return null;
}


/* ================================
   POINTER INPUT
================================ */

canvas.addEventListener("pointerdown", event => {

    if (paused || gameOver) return;

    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const station = stationAt(x, y);

    if (!station) {

        selectedStation = null;

        return;
    }


    if (!selectedStation) {

        selectedStation = station;

        station.pulse = 1;

        lineStatus.textContent =
            "Now choose another station";

        return;
    }


    connectStations(
        selectedStation,
        station
    );

    station.pulse = 1;

    selectedStation = null;

});


/* ================================
   SPAWN PASSENGER
================================ */

function spawnPassenger() {

    if (stations.length < 2) return;

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
        destination === origin
    );


    const passenger = {

        destination: destination,

        age: 0,

        color: "#57534e"
    };


    origin.passengers.push(passenger);

    passengers.push(passenger);
}


/* ================================
   PASSENGER BOARDING
================================ */

function processTrainAtStation(train, station) {

    /*
       Drop off passengers whose
       destination is this station.
    */

    train.passengers =
        train.passengers.filter(passenger => {

            if (
                passenger.destination === station
            ) {

                score++;

                return false;

            }

            return true;

        });


    /*
       Pick up waiting passengers.

       Train capacity:
       6 passengers for now.
    */

    while (
        train.passengers.length < 6 &&
        station.passengers.length > 0
    ) {

        const passenger =
            station.passengers.shift();

        train.passengers.push(passenger);

    }


    station.pulse = 1;

    updateUI();
}


/* ================================
   TRAIN UPDATE
================================ */

function updateTrains(delta) {

    trains.forEach(train => {

        const line = train.line;

        if (line.stations.length < 2) {
            return;
        }


        train.progress +=
            train.speed * delta;


        if (train.progress >= 1) {

            train.progress = 0;

            train.index++;


            /*
               Reverse direction when
               reaching the end.
            */

            if (
                train.index >=
                line.stations.length - 1
            ) {

                train.index =
                    line.stations.length - 1;

                train.reverse = true;

            }


            if (
                train.index <= 0
            ) {

                train.index = 0;

                train.reverse = false;

            }


            const station =
                line.stations[train.index];

            processTrainAtStation(
                train,
                station
            );

        }


        /*
           Direction
        */

        if (train.reverse) {

            train.index--;

            if (train.index < 0) {

                train.index = 0;

                train.reverse = false;

            }

        }

    });

}


/* ================================
   GET TRAIN POSITION
================================ */

function getTrainPosition(train) {

    const line = train.line;

    if (line.stations.length < 2) {

        return null;

    }


    let index = train.index;

    let nextIndex =
        train.reverse
            ? index - 1
            : index + 1;


    if (
        nextIndex < 0 ||
        nextIndex >= line.stations.length
    ) {

        return null;

    }


    const a =
        line.stations[index];

    const b =
        line.stations[nextIndex];


    const t = train.progress;


    return {

        x:
            a.x +
            (b.x - a.x) * t,

        y:
            a.y +
            (b.y - a.y) * t

    };

}


/* ================================
   DRAW LINE
================================ */

function drawLine(line) {

    if (line.stations.length < 2) return;


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


    ctx.strokeStyle = line.color;

    ctx.lineWidth = 8;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.stroke();
}


/* ================================
   DRAW STATION SHAPE
================================ */

function drawShape(
    station,
    size = 12
) {

    ctx.save();

    ctx.translate(
        station.x,
        station.y
    );


    ctx.fillStyle = "#f8f7f1";

    ctx.strokeStyle = "#282725";

    ctx.lineWidth = 3;


    if (station.shape === "circle") {

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            size,
            0,
            Math.PI * 2
        );

        ctx.fill();
        ctx.stroke();

    }


    else if (
        station.shape === "square"
    ) {

        ctx.beginPath();

        ctx.rect(
            -size,
            -size,
            size * 2,
            size * 2
        );

        ctx.fill();
        ctx.stroke();

    }


    else if (
        station.shape === "triangle"
    ) {

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
        ctx.stroke();

    }


    ctx.restore();
}


/* ================================
   DRAW PASSENGERS
================================ */

function drawPassengers(station) {

    const count =
        Math.min(
            station.passengers.length,
            8
        );


    for (let i = 0; i < count; i++) {

        const angle =
            (Math.PI * 2 / count) * i;

        const radius = 22;

        const x =
            station.x +
            Math.cos(angle) * radius;

        const y =
            station.y +
            Math.sin(angle) * radius;


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            4,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "#57534e";

        ctx.fill();

    }

}


/* ================================
   DRAW TRAINS
================================ */

function drawTrains() {

    trains.forEach(train => {

        const position =
            getTrainPosition(train);

        if (!position) return;


        ctx.save();

        ctx.translate(
            position.x,
            position.y
        );


        /*
           Small shadow
        */

        ctx.beginPath();

        ctx.arc(
            2,
            3,
            10,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "rgba(0,0,0,0.15)";

        ctx.fill();


        /*
           Train body
        */

        ctx.beginPath();

        ctx.roundRect(
            -10,
            -7,
            20,
            14,
            5
        );

        ctx.fillStyle =
            train.line.color;

        ctx.fill();


        /*
           Windows
        */

        ctx.fillStyle =
            "#f8f7f1";

        ctx.fillRect(
            -5,
            -3,
            4,
            4
        );

        ctx.fillRect(
            2,
            -3,
            4,
            4
        );


        ctx.restore();

    });

}


/* ================================
   DRAW SELECTION
================================ */

function drawSelection() {

    if (!selectedStation) return;


    ctx.beginPath();

    ctx.arc(
        selectedStation.x,
        selectedStation.y,
        22,
        0,
        Math.PI * 2
    );

    ctx.strokeStyle =
        "#252525";

    ctx.lineWidth = 2;

    ctx.setLineDash([
        4,
        5
    ]);

    ctx.stroke();

    ctx.setLineDash([]);

}


/* ================================
   DRAW
================================ */

function draw() {

    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    /*
       Metro lines
    */

    lines.forEach(drawLine);


    /*
       Stations
    */

    stations.forEach(station => {

        /*
           Pulse animation
        */

        if (station.pulse > 0) {

            ctx.beginPath();

            ctx.arc(
                station.x,
                station.y,
                17 + station.pulse * 15,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                `rgba(37,37,37,${station.pulse * 0.15})`;

            ctx.lineWidth = 2;

            ctx.stroke();

        }


        drawShape(station);

        drawPassengers(station);

    });


    drawSelection();

    drawTrains();

}


/* ================================
   GAME UPDATE
================================ */

function update(delta) {

    if (paused || gameOver) return;


    gameTime += delta;


    /*
       Passenger spawning

       Starts slow and gradually
       becomes faster.
    */

    const spawnInterval =
        Math.max(
            1600,
            4000 - week * 180
        );


    if (
        gameTime %
        spawnInterval <
        delta
    ) {

        spawnPassenger();

    }


    /*
       New station every ~18 seconds.
    */

    if (
        gameTime > 0 &&
        Math.floor(gameTime / 18000) >
        stations.length - 7
    ) {

        createStation();

    }


    /*
       Week progression.
    */

    const newWeek =
        Math.floor(
            gameTime / 30000
        ) + 1;


    if (newWeek !== week) {

        week = newWeek;

        /*
           Occasionally add a station.
        */

        createStation();

    }


    /*
       Station pulses fade.
    */

    stations.forEach(station => {

        station.pulse =
            Math.max(
                0,
                station.pulse -
                delta * 0.002
            );

    });


    /*
       Passenger aging.
    */

    passengers.forEach(passenger => {

        passenger.age += delta;

    });


    /*
       Trains.
    */

    updateTrains(delta);


    /*
       Overcrowding.

       Prototype threshold:
       12 passengers at a station.
    */

    const overloaded =
        stations.find(
            station =>
                station.passengers.length >= 12
        );


    if (overloaded) {

        endGame();

    }


    updateUI();

}


/* ================================
   UI UPDATE
================================ */

function updateUI() {

    weekDisplay.textContent =
        week;

    scoreDisplay.textContent =
        score;

    const waiting =
        stations.reduce(
            (total, station) =>
                total +
                station.passengers.length,
            0
        );

    waitingDisplay.textContent =
        waiting;

    stationCountDisplay.textContent =
        stations.length;

    trainCountDisplay.textContent =
        trains.length;

    lineCountDisplay.textContent =
        lines.length;

}


/* ================================
   GAME OVER
================================ */

function endGame() {

    gameOver = true;

    finalScore.textContent =
        score;

    gameOverScreen.classList.remove(
        "hidden"
    );

}


/* ================================
   PAUSE
================================ */

pauseBtn.addEventListener(
    "click",
    () => {

        if (gameOver) return;

        paused = !paused;

        pauseBtn.textContent =
            paused
                ? "Resume"
                : "Pause";

    }
);


/* ================================
   RESTART
================================ */

function restartGame() {

    createInitialNetwork();

    pauseBtn.textContent =
        "Pause";

}


restartBtn.addEventListener(
    "click",
    restartGame
);


playAgain.addEventListener(
    "click",
    restartGame
);


/* ================================
   GAME LOOP
================================ */

function gameLoop(timestamp) {

    if (!lastTime) {
        lastTime = timestamp;
    }


    const delta =
        Math.min(
            timestamp - lastTime,
            50
        );


    lastTime = timestamp;


    update(delta);

    draw();


    requestAnimationFrame(
        gameLoop
    );

}


/* ================================
   START
================================ */

resizeCanvas();

createInitialNetwork();

requestAnimationFrame(
    gameLoop
);
