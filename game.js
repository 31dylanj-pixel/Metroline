/* =========================================================
   METROLINE
   Prototype v0.3
========================================================= */


/* =========================================================
   CANVAS
========================================================= */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const gameArea = document.getElementById("gameArea");


/* =========================================================
   UI
========================================================= */

const weekDisplay =
    document.getElementById("week");

const scoreDisplay =
    document.getElementById("score");

const waitingDisplay =
    document.getElementById("waiting");

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


/* =========================================================
   GAME STATE
========================================================= */

let width = 0;
let height = 0;

let stations = [];
let passengers = [];

let lines = [];
let trains = [];

let selectedStation = null;

let drawingLine = false;

let score = 0;
let week = 1;

let gameTime = 0;

let paused = false;
let gameOver = false;

let lastTime = 0;


/* =========================================================
   CONSTANTS
========================================================= */

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

const TRAIN_CAPACITY = 6;


/*
   IMPORTANT:

   Train speed is now measured in
   pixels per second.

   This means:

   100px section = 100 / 100 = 1 second

   300px section = 300 / 100 = 3 seconds
*/

const TRAIN_SPEED = 100;


/* =========================================================
   RESIZE
========================================================= */

function resizeCanvas() {

    const rect =
        gameArea.getBoundingClientRect();

    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    width = rect.width;
    height = rect.height;

    canvas.width =
        width * dpr;

    canvas.height =
        height * dpr;

    canvas.style.width =
        width + "px";

    canvas.style.height =
        height + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );
}


window.addEventListener(
    "resize",
    resizeCanvas
);


/* =========================================================
   HELPERS
========================================================= */

function random(min, max) {

    return Math.random() *
        (max - min) +
        min;
}


function distance(a, b) {

    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}


/* =========================================================
   CREATE STATION
========================================================= */

function createStation(
    x,
    y,
    shape
) {

    const station = {

        x,
        y,

        shape,

        passengers: [],

        pulse: 0

    };

    stations.push(
        station
    );

    return station;
}


/* =========================================================
   INITIAL NETWORK
========================================================= */

function createInitialNetwork() {

    stations = [];
    passengers = [];
    lines = [];
    trains = [];

    score = 0;
    week = 1;
    gameTime = 0;

    selectedStation = null;
    drawingLine = false;

    gameOver = false;
    paused = false;


    gameOverScreen.classList.add(
        "hidden"
    );


    /*
       EXACTLY THREE STARTING STATIONS
    */

    createStation(
        width * 0.28,
        height * 0.42,
        "circle"
    );

    createStation(
        width * 0.52,
        height * 0.67,
        "triangle"
    );

    createStation(
        width * 0.72,
        height * 0.35,
        "square"
    );


    /*
       ONE EMPTY LINE
    */

    lines.push({

        id: 0,

        color:
            LINE_COLORS[0],

        stations: [],

        loop: false

    });


    /*
       ONE TRAIN
    */

    trains.push({

        line: lines[0],

        /*
           currentIndex tells us which
           station the train is travelling
           FROM.

           Example:

           index 0
           progress 0.5

           means halfway between
           station 0 and station 1.
        */

        currentIndex: 0,

        progress: 0,

        reverse: false,

        passengers: [],

        speed: TRAIN_SPEED

    });


    lineStatus.textContent =
        "Drag from a station";

    updateUI();
}


/* =========================================================
   ADD STATION TO LINE
========================================================= */

function addStationToLine(
    station
) {

    const line =
        lines[0];


    /*
       Don't add the same station
       twice unless closing a loop.
    */

    if (
        line.stations.includes(
            station
        )
    ) {

        /*
           LOOP

           If the player drags from the
           final station back to the first,
           close the route.
        */

        if (
            line.stations.length >= 3 &&
            station ===
            line.stations[0] &&
            !line.loop
        ) {

            line.loop = true;

            lineStatus.textContent =
                "Loop line created";

            updateTrainRoute();

        }

        return;
    }


    /*
       ADD THE STATION.

       IMPORTANT:

       We DO NOT reset the train.
    */

    line.stations.push(
        station
    );


    /*
       The train simply continues
       using the updated route.
    */

    updateTrainRoute();


    lineStatus.textContent =
        `${line.stations.length} stations on line`;
}


/* =========================================================
   UPDATE TRAIN ROUTE
========================================================= */

function updateTrainRoute() {

    const line =
        lines[0];


    trains.forEach(
        train => {

            train.line =
                line;


            /*
               IMPORTANT:

               Nothing here resets:

               train.currentIndex
               train.progress
               train.reverse

               So adding a station does NOT
               teleport the train back to
               the beginning.
            */


            /*
               If the train doesn't have a
               valid current segment yet,
               initialize it.
            */

            if (
                line.stations.length >= 2 &&
                train.currentIndex >=
                line.stations.length
            ) {

                train.currentIndex =
                    line.stations.length - 2;

            }

        }
    );


    updateUI();
}


/* =========================================================
   REMOVE LINE SEGMENT
========================================================= */

function removeSegment(
    line,
    segmentIndex
) {

    if (
        line.stations.length < 2
    ) {

        return;
    }


    /*
       LOOP CLOSING SEGMENT
    */

    if (
        line.loop &&
        segmentIndex ===
        line.stations.length - 1
    ) {

        line.loop = false;

        lineStatus.textContent =
            "Loop section removed";

        updateTrainAfterRouteChange();

        return;
    }


    /*
       Remove the station AFTER the
       selected segment.
    */

    line.stations.splice(
        segmentIndex + 1,
        1
    );


    /*
       If fewer than 3 stations remain,
       a loop is impossible.
    */

    if (
        line.stations.length < 3
    ) {

        line.loop = false;

    }


    lineStatus.textContent =
        "Line section removed";


    updateTrainAfterRouteChange();
}


/* =========================================================
   TRAIN ROUTE UPDATE AFTER DELETION
========================================================= */

function updateTrainAfterRouteChange() {

    const line =
        lines[0];


    trains.forEach(
        train => {

            train.line =
                line;


            /*
               Keep train in the closest
               valid part of the route.

               Do NOT restart the train.
            */

            if (
                line.stations.length < 2
            ) {

                train.currentIndex = 0;
                train.progress = 0;

                return;

            }


            if (
                train.currentIndex >=
                line.stations.length
            ) {

                train.currentIndex =
                    line.stations.length - 1;

            }


            if (
                !line.loop &&
                train.currentIndex >=
                line.stations.length - 1
            ) {

                train.currentIndex =
                    Math.max(
                        0,
                        line.stations.length - 2
                    );

            }

        }
    );


    updateUI();
}


/* =========================================================
   POINT TO SEGMENT DISTANCE
========================================================= */

function distanceToSegment(
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


    if (
        dx === 0 &&
        dy === 0
    ) {

        return Math.hypot(
            px - ax,
            py - ay
        );

    }


    const t =
        Math.max(
            0,
            Math.min(
                1,
                (
                    (px - ax) * dx +
                    (py - ay) * dy
                ) /
                (
                    dx * dx +
                    dy * dy
                )
            )
        );


    const x =
        ax + t * dx;

    const y =
        ay + t * dy;


    return Math.hypot(
        px - x,
        py - y
    );
}


/* =========================================================
   FIND LINE SEGMENT
========================================================= */

function segmentAt(
    x,
    y
) {

    const line =
        lines[0];


    if (
        line.stations.length < 2
    ) {

        return null;

    }


    /*
       NORMAL SEGMENTS
    */

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
            distanceToSegment(
                x,
                y,
                a.x,
                a.y,
                b.x,
                b.y
            ) < 12
        ) {

            return {

                line,

                index: i

            };

        }

    }


    /*
       LOOP CLOSING SEGMENT
    */

    if (line.loop) {

        const a =
            line.stations[
                line.stations.length - 1
            ];

        const b =
            line.stations[0];


        if (
            distanceToSegment(
                x,
                y,
                a.x,
                a.y,
                b.x,
                b.y
            ) < 12
        ) {

            return {

                line,

                index:
                    line.stations.length - 1

            };

        }

    }


    return null;
}


/* =========================================================
   STATION HIT TEST
========================================================= */

function stationAt(
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


        if (
            Math.hypot(
                station.x - x,
                station.y - y
            ) < 28
        ) {

            return station;

        }

    }


    return null;
}


/* =========================================================
   POINTER POSITION
========================================================= */

function pointerPosition(
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


        const p =
            pointerPosition(
                event
            );


        /*
           RIGHT CLICK

           Delete line section.
        */

        if (
            event.button === 2
        ) {

            const segment =
                segmentAt(
                    p.x,
                    p.y
                );


            if (segment) {

                removeSegment(
                    segment.line,
                    segment.index
                );

            }

            return;
        }


        const station =
            stationAt(
                p.x,
                p.y
            );


        if (!station) {

            return;

        }


        drawingLine = true;

        selectedStation =
            station;


        station.pulse = 1;


        canvas.setPointerCapture(
            event.pointerId
        );


        lineStatus.textContent =
            "Drag to another station";

    }
);


/* =========================================================
   POINTER UP
========================================================= */

canvas.addEventListener(
    "pointerup",
    event => {

        if (!drawingLine) {

            return;

        }


        const p =
            pointerPosition(
                event
            );


        const station =
            stationAt(
                p.x,
                p.y
            );


        if (station) {

            addStationToLine(
                station
            );

        }


        drawingLine = false;

        selectedStation =
            null;


        try {

            canvas.releasePointerCapture(
                event.pointerId
            );

        } catch (_) {}


        const line =
            lines[0];


        if (line.loop) {

            lineStatus.textContent =
                "Loop line active";

        }

        else if (
            line.stations.length
        ) {

            lineStatus.textContent =
                "Drag from a station to extend";

        }

        else {

            lineStatus.textContent =
                "Drag from a station";

        }

    }
);


/* =========================================================
   CONTEXT MENU
========================================================= */

canvas.addEventListener(
    "contextmenu",
    event => {

        event.preventDefault();

    }
);


/* =========================================================
   PASSENGERS
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


    let destination;


    do {

        destination =
            stations[
                Math.floor(
                    Math.random() *
                    stations.length
                )
            ];

    } while (
        destination === origin
    );


    const passenger = {

        destination,

        age: 0

    };


    origin.passengers.push(
        passenger
    );


    passengers.push(
        passenger
    );
}


/* =========================================================
   PASSENGER ICON
========================================================= */

function drawPassengerIcon(
    ctx,
    shape,
    x,
    y,
    size
) {

    ctx.save();

    ctx.translate(
        x,
        y
    );


    ctx.fillStyle =
        "#57534e";


    if (
        shape === "circle"
    ) {

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


    else if (
        shape === "square"
    ) {

        ctx.fillRect(
            -size,
            -size,
            size * 2,
            size * 2
        );

    }


    else if (
        shape === "triangle"
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

    }


    ctx.restore();
}


/* =========================================================
   TRAIN ARRIVAL
========================================================= */

function processTrainAtStation(
    train,
    station
) {

    /*
       DROP OFF
    */

    train.passengers =
        train.passengers.filter(
            passenger => {

                if (
                    passenger.destination ===
                    station
                ) {

                    score++;


                    const index =
                        passengers.indexOf(
                            passenger
                        );


                    if (
                        index !== -1
                    ) {

                        passengers.splice(
                            index,
                            1
                        );

                    }


                    return false;

                }


                return true;

            }
        );


    /*
       BOARD PASSENGERS

       Maximum capacity = 6.
    */

    while (
        train.passengers.length <
            TRAIN_CAPACITY &&
        station.passengers.length > 0
    ) {

        const passenger =
            station.passengers.shift();


        train.passengers.push(
            passenger
        );

    }


    station.pulse = 1;


    updateUI();
}


/* =========================================================
   TRAIN UPDATE
========================================================= */

function updateTrains(
    delta
) {

    trains.forEach(
        train => {

            const line =
                train.line;


            if (
                line.stations.length < 2
            ) {

                return;

            }


            /*
               Convert milliseconds into
               seconds.
            */

            const seconds =
                delta / 1000;


            /*
               LOOP LINE
            */

            if (
                line.loop
            ) {

                updateLoopTrain(
                    train,
                    line,
                    seconds
                );

                return;

            }


            /*
               NORMAL LINE
            */

            updateNormalTrain(
                train,
                line,
                seconds
            );

        }
    );
}


/* =========================================================
   NORMAL TRAIN MOVEMENT
========================================================= */

function updateNormalTrain(
    train,
    line,
    seconds
) {

    let distanceRemaining =
        train.speed *
        seconds;


    /*
       Continue moving until all
       movement for this frame has
       been consumed.
    */

    while (
        distanceRemaining > 0
    ) {

        if (
            line.stations.length < 2
        ) {

            return;

        }


        /*
           Make sure current index
           is valid.
        */

        if (
            train.currentIndex < 0
        ) {

            train.currentIndex = 0;

        }


        if (
            train.currentIndex >=
            line.stations.length - 1
        ) {

            train.currentIndex =
                line.stations.length - 2;

            train.reverse = false;

        }


        const current =
            line.stations[
                train.currentIndex
            ];


        const nextIndex =
            train.reverse
                ? train.currentIndex - 1
                : train.currentIndex + 1;


        /*
           Reached an end.
        */

        if (
            nextIndex < 0 ||
            nextIndex >=
            line.stations.length
        ) {

            train.reverse =
                !train.reverse;


            continue;

        }


        const next =
            line.stations[
                nextIndex
            ];


        const segmentLength =
            distance(
                current,
                next
            );


        if (
            segmentLength <= 0
        ) {

            train.currentIndex =
                nextIndex;

            continue;

        }


        /*
           How far along this segment
           is the train?
        */

        const travelled =
            train.progress *
            segmentLength;


        const remaining =
            segmentLength -
            travelled;


        /*
           Can we finish this section
           during this frame?
        */

        if (
            distanceRemaining >=
            remaining
        ) {

            distanceRemaining -=
                remaining;


            train.progress = 0;


            train.currentIndex =
                nextIndex;


            /*
               Arrival!
            */

            processTrainAtStation(
                train,
                next
            );


            /*
               Reverse at the ends.
            */

            if (
                train.currentIndex === 0
            ) {

                train.reverse =
                    false;

            }


            else if (
                train.currentIndex ===
                line.stations.length - 1
            ) {

                train.reverse =
                    true;

            }

        }

        else {

            /*
               Move partway through
               the current segment.
            */

            train.progress =
                (
                    travelled +
                    distanceRemaining
                ) /
                segmentLength;


            distanceRemaining = 0;

        }

    }
}


/* =========================================================
   LOOP TRAIN MOVEMENT
========================================================= */

function updateLoopTrain(
    train,
    line,
    seconds
) {

    let distanceRemaining =
        train.speed *
        seconds;


    while (
        distanceRemaining > 0
    ) {

        if (
            line.stations.length < 3
        ) {

            line.loop = false;

            return;

        }


        /*
           Current station.
        */

        const current =
            line.stations[
                train.currentIndex %
                line.stations.length
            ];


        /*
           Always travel forward
           around the loop.
        */

        const nextIndex =
            (
                train.currentIndex + 1
            ) %
            line.stations.length;


        const next =
            line.stations[
                nextIndex
            ];


        const segmentLength =
            distance(
                current,
                next
            );


        if (
            segmentLength <= 0
        ) {

            train.currentIndex =
                nextIndex;

            train.progress = 0;

            continue;

        }


        const travelled =
            train.progress *
            segmentLength;


        const remaining =
            segmentLength -
            travelled;


        if (
            distanceRemaining >=
            remaining
        ) {

            distanceRemaining -=
                remaining;


            train.progress = 0;


            train.currentIndex =
                nextIndex;


            /*
               Arrival at station.
            */

            processTrainAtStation(
                train,
                next
            );

        }

        else {

            train.progress =
                (
                    travelled +
                    distanceRemaining
                ) /
                segmentLength;


            distanceRemaining = 0;

        }

    }
}


/* =========================================================
   TRAIN POSITION
========================================================= */

function getTrainPosition(
    train
) {

    const line =
        train.line;


    if (
        line.stations.length < 2
    ) {

        return null;

    }


    /*
       LOOP
    */

    if (
        line.loop
    ) {

        const index =
            train.currentIndex %
            line.stations.length;


        const nextIndex =
            (
                index + 1
            ) %
            line.stations.length;


        const a =
            line.stations[
                index
            ];

        const b =
            line.stations[
                nextIndex
            ];


        return {

            x:
                a.x +
                (
                    b.x - a.x
                ) *
                train.progress,

            y:
                a.y +
                (
                    b.y - a.y
                ) *
                train.progress

        };

    }


    /*
       NORMAL LINE
    */

    let index =
        train.currentIndex;


    let nextIndex =
        train.reverse
            ? index - 1
            : index + 1;


    if (
        nextIndex < 0 ||
        nextIndex >=
        line.stations.length
    ) {

        return null;

    }


    const a =
        line.stations[
            index
        ];

    const b =
        line.stations[
            nextIndex
        ];


    return {

        x:
            a.x +
            (
                b.x - a.x
            ) *
            train.progress,

        y:
            a.y +
            (
                b.y - a.y
            ) *
            train.progress

    };
}


/* =========================================================
   DRAW LINE
========================================================= */

function drawLine(
    line
) {

    if (
        line.stations.length < 2
    ) {

        return;

    }


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


    /*
       Close loop.
    */

    if (
        line.loop
    ) {

        ctx.lineTo(
            line.stations[0].x,
            line.stations[0].y
        );

    }


    ctx.strokeStyle =
        line.color;

    ctx.lineWidth = 8;

    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";

    ctx.stroke();
}


/* =========================================================
   DRAW STATION
========================================================= */

function drawStation(
    station
) {

    ctx.save();


    ctx.translate(
        station.x,
        station.y
    );


    /*
       Pulse
    */

    if (
        station.pulse > 0
    ) {

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            19 +
            station.pulse * 15,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            `rgba(37,37,37,${station.pulse * 0.15})`;

        ctx.lineWidth = 2;

        ctx.stroke();

    }


    ctx.fillStyle =
        "#f8f7f1";

    ctx.strokeStyle =
        "#282725";

    ctx.lineWidth = 3;


    if (
        station.shape ===
        "circle"
    ) {

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            12,
            0,
            Math.PI * 2
        );

        ctx.fill();
        ctx.stroke();

    }


    else if (
        station.shape ===
        "square"
    ) {

        ctx.beginPath();

        ctx.rect(
            -12,
            -12,
            24,
            24
        );

        ctx.fill();
        ctx.stroke();

    }


    else {

        ctx.beginPath();

        ctx.moveTo(
            0,
            -13
        );

        ctx.lineTo(
            13,
            11
        );

        ctx.lineTo(
            -13,
            11
        );

        ctx.closePath();

        ctx.fill();
        ctx.stroke();

    }


    ctx.restore();


    /*
       Waiting passenger icons.
    */

    const visible =
        Math.min(
            station.passengers.length,
            8
        );


    for (
        let i = 0;
        i < visible;
        i++
    ) {

        const angle =
            (
                Math.PI * 2 /
                visible
            ) * i;


        const radius = 25;


        drawPassengerIcon(
            ctx,
            station.passengers[i]
                .destination
                .shape,

            station.x +
                Math.cos(angle) *
                radius,

            station.y +
                Math.sin(angle) *
                radius,

            4
        );

    }
}


/* =========================================================
   DRAW TRAIN
========================================================= */

function drawTrain(
    train
) {

    const position =
        getTrainPosition(
            train
        );


    if (!position) {

        return;

    }


    ctx.save();


    ctx.translate(
        position.x,
        position.y
    );


    /*
       Determine train direction.
    */

    const line =
        train.line;


    let nextIndex;


    if (
        line.loop
    ) {

        nextIndex =
            (
                train.currentIndex + 1
            ) %
            line.stations.length;

    }

    else {

        nextIndex =
            train.reverse
                ? train.currentIndex - 1
                : train.currentIndex + 1;

    }


    if (
        nextIndex >= 0 &&
        nextIndex <
        line.stations.length
    ) {

        const next =
            line.stations[
                nextIndex
            ];


        const current =
            line.stations[
                train.currentIndex
            ];


        const angle =
            Math.atan2(
                next.y -
                    current.y,

                next.x -
                    current.x
            );


        ctx.rotate(
            angle
        );

    }


    /*
       Shadow
    */

    ctx.fillStyle =
        "rgba(0,0,0,0.14)";


    ctx.beginPath();

    ctx.roundRect(
        -13,
        -7,
        28,
        16,
        4
    );

    ctx.fill();


    /*
       RECTANGULAR TRAIN
    */

    ctx.fillStyle =
        train.line.color;


    ctx.beginPath();

    ctx.roundRect(
        -14,
        -8,
        28,
        16,
        4
    );

    ctx.fill();


    /*
       Passenger icons.

       6 maximum.
    */

    const passengerCount =
        Math.min(
            train.passengers.length,
            TRAIN_CAPACITY
        );


    for (
        let i = 0;
        i < passengerCount;
        i++
    ) {

        const column =
            i % 3;


        const row =
            Math.floor(
                i / 3
            );


        const x =
            -8 +
            column * 8;


        const y =
            row === 0
                ? -3.5
                : 3.5;


        drawPassengerIcon(
            ctx,
            train.passengers[i]
                .destination
                .shape,

            x,
            y,

            2.1
        );

    }


    ctx.restore();
}


/* =========================================================
   DRAW SELECTION
========================================================= */

function drawSelection() {

    if (
        !selectedStation
    ) {

        return;

    }


    ctx.beginPath();

    ctx.arc(
        selectedStation.x,
        selectedStation.y,
        23,
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


/* =========================================================
   DRAW DRAG PREVIEW
========================================================= */

function drawDragPreview() {

    if (
        !drawingLine ||
        !selectedStation
    ) {

        return;

    }


    if (
        typeof window.pointerX !==
            "number" ||
        typeof window.pointerY !==
            "number"
    ) {

        return;

    }


    ctx.beginPath();


    ctx.moveTo(
        selectedStation.x,
        selectedStation.y
    );


    ctx.lineTo(
        window.pointerX,
        window.pointerY
    );


    ctx.strokeStyle =
        "rgba(37,37,37,0.35)";

    ctx.lineWidth = 5;

    ctx.lineCap =
        "round";


    ctx.setLineDash([
        8,
        8
    ]);


    ctx.stroke();


    ctx.setLineDash([]);
}


/* =========================================================
   POINTER MOVE
========================================================= */

canvas.addEventListener(
    "pointermove",
    event => {

        const p =
            pointerPosition(
                event
            );


        window.pointerX =
            p.x;

        window.pointerY =
            p.y;

    }
);


/* =========================================================
   DRAW
========================================================= */

function draw() {

    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    /*
       Lines
    */

    lines.forEach(
        drawLine
    );


    /*
       Stations
    */

    stations.forEach(
        drawStation
    );


    /*
       Selection
    */

    drawSelection();


    /*
       Drag preview
    */

    drawDragPreview();


    /*
       Trains
    */

    trains.forEach(
        drawTrain
    );
}


/* =========================================================
   GAME UPDATE
========================================================= */

function update(
    delta
) {

    if (
        paused ||
        gameOver
    ) {

        return;

    }


    gameTime += delta;


    /*
       Passenger spawning.
    */

    const spawnInterval =
        4000;


    if (
        gameTime %
            spawnInterval <
        delta
    ) {

        spawnPassenger();

    }


    /*
       Week counter.
    */

    week =
        Math.floor(
            gameTime / 30000
        ) + 1;


    /*
       Station pulse.
    */

    stations.forEach(
        station => {

            station.pulse =
                Math.max(
                    0,
                    station.pulse -
                    delta * 0.002
                );

        }
    );


    /*
       Train movement.
    */

    updateTrains(
        delta
    );


    /*
       Overcrowding.
    */

    const overloaded =
        stations.find(
            station =>
                station.passengers
                    .length >= 12
        );


    if (
        overloaded
    ) {

        endGame();

    }


    updateUI();
}


/* =========================================================
   UI UPDATE
========================================================= */

function updateUI() {

    weekDisplay.textContent =
        week;

    scoreDisplay.textContent =
        score;


    const waiting =
        stations.reduce(
            (
                total,
                station
            ) =>
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


/* =========================================================
   GAME OVER
========================================================= */

function endGame() {

    gameOver = true;


    finalScore.textContent =
        score;


    gameOverScreen.classList.remove(
        "hidden"
    );
}


/* =========================================================
   PAUSE
========================================================= */

pauseBtn.addEventListener(
    "click",
    () => {

        if (
            gameOver
        ) {

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


/* =========================================================
   RESTART
========================================================= */

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


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(
    timestamp
) {

    if (!lastTime) {

        lastTime =
            timestamp;

    }


    const delta =
        Math.min(
            timestamp -
                lastTime,

            50
        );


    lastTime =
        timestamp;


    update(
        delta
    );


    draw();


    requestAnimationFrame(
        gameLoop
    );
}


/* =========================================================
   START
========================================================= */

resizeCanvas();

createInitialNetwork();

requestAnimationFrame(
    gameLoop
);
