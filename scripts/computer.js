/*
    Global Variables
*/

var haltComputation = true;

// Operation count will serve to take our long computations and break them into chunks of this many operations
// This will allow us to use javascript's event loop to manage incoming messages since long computations will be more broken up
const maxOperations = 100000;
let operationCount = maxOperations;
const operationDelay = 50;

// For managing the amount of memory used for typed arrays
let allocatedMemory = 0;
const maxMemory = 256 * 1024 * 1024;


// var totalEvals = 0;

/*
* The bytes are arranged like so
* First 7 bytes are the heights of each column 0-6
* Next 7 bytes are the pieces in those columns
* The bottom of the column is the least significant bit (at 2^0, not 2^5)
*/

const bytesPerBoard = 14;
let maxDepth = 10;
const nullConst = 0xff;
const wonConst = 0xfe;

// Create a series of 6 bit maps for the different pieces
const pieceBitMaps = new Uint8Array(new ArrayBuffer(6));
for(let i=0; i < 6; i++) {
    pieceBitMaps[i] = 1 << i;
}

function printBoard(boardArray, offset) {
    let printString = "";
    for(let j=0; j < 6; j++) {
        let rowString = "";
        for(let i=0; i < 7; i++) {
            if(boardArray[offset + i] > j) {
                if((boardArray[offset + i + 7] & pieceBitMaps[j]) > 0) {
                    rowString += '|1';
                } else {
                    rowString += '|0';
                }
            } else {
                rowString += '| ';
            }
        }
        printString = rowString + '|\n' + printString;
    }

    console.log(printString);
}

var debug = false;

function computeIfWon(boardArray, offset, col) {
    const row = boardArray[offset + col] - 1;

    let inARow = 1;
    const color = (boardArray[offset + col + 7] & pieceBitMaps[row]) > 0;

    // Checking vertically
    if(row >= 3) {
        for(let i=row-1; i >= 0; i--) {
            if(color == (boardArray[offset + col + 7] & pieceBitMaps[i]) > 0) {
                inARow++;
            } else {
                break;
            }
            if(inARow === 4) {
                boardArray[offset] = wonConst;
                boardArray[offset + 1] = Number(color);

                // if(debug) console.log("Vertical");

                return true;
            }
        }
    }
    // if(debug) console.log("Not vertical - " + inARow);

    // Checking horizontally
    inARow = 1;
    for(let i=col-1; i >= 0; i--) {
        if( (boardArray[offset + i] > row) &&
            (color == (boardArray[offset + i + 7] & pieceBitMaps[row]) > 0) ) {
            inARow++;
        } else {
            break;
        }
        if(inARow === 4) {
            boardArray[offset] = wonConst;
            boardArray[offset + 1] = Number(color);

            // if(debug) console.log("Horizontal 1");

            return true;
        }
    }
    // if(debug) console.log("Not horizontal 1 - " + inARow);
    for(let i=col+1; i < 7; i++) {
        if( (boardArray[offset + i] > row) &&
            (color == (boardArray[offset + i + 7] & pieceBitMaps[row]) > 0) ) {
            inARow++;
        } else {
            break;
        }
        if(inARow === 4) {
            boardArray[offset] = wonConst;
            boardArray[offset + 1] = Number(color);

            // if(debug) console.log("Horizontal 2");

            return true;
        }
    }
    // if(debug) console.log("Not horizontal 2 - " + inARow);

    // Checking positive slope diagonal
    inARow = 1;
    let i = col - 1;
    let j = row - 1;
    while(i >= 0 && j >= 0) {
        if( (boardArray[offset + i] > j) &&
            (color == (boardArray[offset + i + 7] & pieceBitMaps[j]) > 0) ) {
            inARow++;
        } else {
            break;
        }
        if(inARow === 4) {
            boardArray[offset] = wonConst;
            boardArray[offset + 1] = Number(color);

            // if(debug) console.log("Positive 1");

            return true;
        }

        i--;
        j--;
    }
    // if(debug) console.log("Not positive 1 - " + inARow);
    i = col + 1;
    j = row + 1;
    while(i < 7 && j < 6) {
        if( (boardArray[offset + i] > j) &&
            (color == (boardArray[offset + i + 7] & pieceBitMaps[j]) > 0) ) {
            inARow++;
        } else {
            break;
        }
        if(inARow === 4) {
            boardArray[offset] = wonConst;
            boardArray[offset + 1] = Number(color);

            // if(debug) console.log("Positive 2");

            return true;
        }

        i++;
        j++;
    }
    // if(debug) console.log("Not positive 2 - " + inARow);
    
    // Checking negative slope diagonal
    inARow = 1;
    i = col - 1;
    j = row + 1;
    while(i >= 0 && j < 6) {
        if( (boardArray[offset + i] > j) &&
            (color == (boardArray[offset + i + 7] & pieceBitMaps[j]) > 0) ) {
            inARow++;
        } else {
            break;
        }
        if(inARow === 4) {
            boardArray[offset] = wonConst;
            boardArray[offset + 1] = Number(color);

            // if(debug) console.log("Negative 1");

            return true;
        }

        i--;
        j++;
    }
    // if(debug) console.log("Not negative 1 - " + inARow);
    i = col + 1;
    j = row - 1;
    while(i < 7 && j >= 0) {
        if( (boardArray[offset + i] > j) &&
            (color == (boardArray[offset + i + 7] & pieceBitMaps[j]) > 0) ) {
            inARow++;
        } else {
            break;
        }
        if(inARow === 4) {
            boardArray[offset] = wonConst;
            boardArray[offset + 1] = Number(color);

            // if(debug) console.log("Negative 2");

            return true;
        }

        i++;
        j--;
    }
    // if(debug) console.log("Not negative 2 - " + inARow);

    return false;
}

function scorePieces(zeroCount, oneCount) {
    // If there are no 1 pieces to interfere with a possible 0 connect four
    if(zeroCount != 0 && oneCount == 0) {
        return -Math.pow(100, zeroCount - 1);
    }
    // If there are no 0 pieces to interfere with a possible 1 connect four
    else if(zeroCount == 0 && oneCount != 0) {
        return Math.pow(100, oneCount - 1);
    }

    return 0;
}

function evaluateBoard(boardArray, offset) {
    if(boardArray[offset] === wonConst) {
        if(boardArray[offset + 1] > 0) {
            return Number.POSITIVE_INFINITY;
        } else {
            return Number.NEGATIVE_INFINITY;
        }
    }

    let score = 0;

    let zeroCount;
    let oneCount;

    /*
     * First check horizontal sets of four
     */
    for(let row=0; row < 6; row++) {

        // There are four sets of four pieces per row
        // For each set of four, score it
        for(let col=0; col < 4; col++) {
            zeroCount = 0;
            oneCount = 0;

            // Update count
            for(let i=0; i < 4; i++) {
                if(boardArray[offset + col + i] > row) {
                    if((boardArray[offset + col + i + 7] & pieceBitMaps[row]) > 0) {
                        oneCount++;
                    } else {
                        zeroCount++;
                    }
                }
            }

            // Score the count
            score += scorePieces(zeroCount, oneCount);
        }
    }

    /*
     * Then check vertical sets of four
     */
    for(let col=0; col < 7; col++) {

        // There are three sets of four pieces per column
        // For each subsequent set of four, score it
        for(let row=0; row < 3; row++) {
            zeroCount = 0;
            oneCount = 0;

            // Update count
            for(let i=0; i < 4; i++) {
                if(boardArray[offset + col] > row + i) {
                    if((boardArray[offset + col + 7] & pieceBitMaps[row + i]) > 0) {
                        oneCount++;
                    } else {
                        zeroCount++;
                    }
                }
            }

            // Score the count
            score += scorePieces(zeroCount, oneCount);
        }
    }

    /*
     * Then check positive diagonal sets of four
     */
    for(let col=0; col < 4; col++) {

        // For each subsequent set of four, score it
        for(let row=0; row < 3; row++) {
            zeroCount = 0;
            oneCount = 0;

            // Update count
            for(let i=0; i < 4; i++) {
                if(boardArray[offset + col + i] > row + i) {
                    if((boardArray[offset + col + i + 7] & pieceBitMaps[row + i]) > 0) {
                        oneCount++;
                    } else {
                        zeroCount++;
                    }
                }
            }

            // Score the count
            score += scorePieces(zeroCount, oneCount);
        }
    }

    /*
     * Finally check negative diagonal sets of four
     */
    for(let col=0; col < 4; col++) {

        // For each subsequent set of four, score it
        for(let row=3; row < 6; row++) {
            zeroCount = 0;
            oneCount = 0;

            // Update count
            for(let i=0; i < 4; i++) {
                if(boardArray[offset + col + i] > row - i) {
                    if((boardArray[offset + col + i + 7] & pieceBitMaps[row - i]) > 0) {
                        oneCount++;
                    } else {
                        zeroCount++;
                    }
                }
            }

            // Score the count
            score += scorePieces(zeroCount, oneCount);
        }
    }

    return score;
}

function isChildlessBoard(boardArray, offset) {
    return boardArray[offset] === nullConst || boardArray[offset] === wonConst;
}

function isParentBoard(boardArray, offset) {
    return boardArray[offset] !== nullConst && boardArray[offset] !== wonConst;
}



class TriangleNode {
    constructor(board, turn) {
        this.layers = [board, new Uint8Array(bytesPerBoard * 7)];
        allocatedMemory += bytesPerBoard * 7;
        this.turns = [turn, !turn];

        this.childNodes = {};

        // Used to keep track of where computation has left off
        this.creationIndex = 0;
        this.deepenIndex = 0;

        // These two values are used to decide if a premature split should happen
        // i.e. should the triangle node create childNodes rather than adding another layer to itself
        this.childlessBoards = 0;
        this.split = null;

        this.complete = false;
    }

    deepenNode() {
        const latestLayer = this.layers[this.layers.length - 1];
        const oldLayer = this.layers[this.layers.length - 2];


        if(Object.keys(this.childNodes).length > 0 && this.deepenIndex === latestLayer.length) {
            return [true, []];
        }

        if(this.creationIndex < oldLayer.length) {
            console.error("Previous layer wasn't complete before node was deepened");
        }

        if(this.split === null) {
            this.split = this.childlessBoards / (latestLayer.length / bytesPerBoard) > 0.5;
        }

        if(this.split || this.layers.length >= maxDepth) {
            // We need to create new triangle nodes rather than continuing with the current one
            const children = [];

            while(this.deepenIndex < latestLayer.length) {
                if(isParentBoard(latestLayer, this.deepenIndex)) {
                    const node = new TriangleNode(new Uint8Array(latestLayer.buffer, latestLayer.byteOffset + this.deepenIndex, bytesPerBoard), this.turns[this.turns.length - 1]);

                    this.childNodes[this.deepenIndex] = node;
                    children.push(node);
                }
                this.deepenIndex += bytesPerBoard;

                operationCount--;
                if(operationCount <= 0 || allocatedMemory >= maxMemory) {
                    return [this.deepenIndex >= latestLayer.length, children];
                }
            }

            this.complete = true;

            return [true, children];

        } else {
            // Otherwise we want to just add a layer to the current node
            this.layers.push(new Uint8Array(latestLayer.length * 7));
            allocatedMemory += latestLayer.length * 7;
            this.turns.push(!this.turns[this.turns.length - 1]);

            operationCount--;

            this.creationIndex = 0;
            this.childlessBoards = 0;
            this.split = null;

            return [true, [this]];
        }
    }

    generateBoards() {
        const latestLayer = this.layers[this.layers.length - 1];
        const oldLayer = this.layers[this.layers.length - 2];
        const turn = this.turns[this.turns.length - 1];

        if(this.complete) {
            console.error("generateBoards called on a complete node");
        }

        // if(this.creationIndex >= oldLayer.length) {
        //     throw "Layer already completed when generateBoards called";
        // }

        let latestIndex = this.creationIndex * 7;
        while(this.creationIndex < oldLayer.length) {
            if(isParentBoard(oldLayer, this.creationIndex)) {
                /*
                 * We now can generate the child nodes in currentArray
                 */
                for(let i=0; i < 7; i++) {
                    // If a piece can be dropped in the column
                    if(oldLayer[i + this.creationIndex] < 6) {
                        // Copy the current board state over
                        latestLayer.set(oldLayer.subarray(this.creationIndex, this.creationIndex + bytesPerBoard), latestIndex);

                        // Drop the piece down the corresponding column
                        if(turn) {
                            latestLayer[i + 7 + latestIndex] += pieceBitMaps[latestLayer[i + latestIndex]];
                        }
                        latestLayer[i + latestIndex]++;

                        // Determine if the game was won
                        computeIfWon(latestLayer, latestIndex, i);

                    } else {
                        latestLayer[latestIndex] = nullConst;
                        this.childlessBoards += 1;
                    }

                    latestIndex += bytesPerBoard;
                }
            } else {
                this.childlessBoards += 7;

                // Setting the children to null
                for(let i=0; i < 7; i++) {
                    latestLayer[latestIndex] = nullConst;
                    latestIndex += bytesPerBoard;
                }
            }

            this.creationIndex += bytesPerBoard;

            operationCount--;
            if(operationCount <= 0) {
                return this.creationIndex >= oldLayer.length;
            }
        }

        return true;
    }

    /**
     * Should only be called on the root node
     */
    trimNode(columnChosen) {
        // We want to trim the tree when a column is chosen for a move
        if(this.layers.length === 2 && this.complete) {
            // Time for the root to transition to a child node
            const childIndex = columnChosen * bytesPerBoard;

            if(this.layers[1][childIndex] !== wonConst) {

                if(!(childIndex in this.childNodes)) {
                    throw "Invalid column to drop a piece in: " + columnChosen;
                }

                const nextRoot = this.childNodes[childIndex];
    
                // Dereferencing the other children
                for(let key in this.childNodes) {
                    delete this.childNodes[key];
                }
    
                return nextRoot;

            }            

            // If there is no other child board to transition to we are entering a deadend
            // Either a won board, or an invalid board
        }

        // Otherwise we're expecting to trim within the node
        if(this.layers.length === 2 && this.creationIndex < this.layers[0].length) {
            throw "Second layer is unfinished when trim attempted";
        }

        if(this.layers.length === 1) {
            throw "Trying to trim a node with a single layer";
        }

        // The current board state can be removed
        this.layers.splice(0, 1);
        this.turns.splice(0, 1);

        let currentStart = columnChosen * bytesPerBoard;
        let currentLength = bytesPerBoard;
        for(let i=0; i < this.layers.length; i++) {
            // We want to replace the current view of the array with a view containing
            // only the remaining section of the tree
            let trimmedLayer = this.layers[i].slice(currentStart, currentStart + currentLength);
            delete this.layers[i];
            this.layers[i] = trimmedLayer;

            // This segment of the tree in the next array will grow by 7 times
            currentStart *= 7;
            currentLength *= 7;
        }

        currentStart /= 7;
        currentLength /= 7;

        this.creationIndex = Math.max(0, this.creationIndex - currentStart / 7);
        this.deepenIndex = Math.max(0, this.deepenIndex - currentStart);
        this.childlessBoards /= 7;

        const newChildNodes = {};
        for(let key in this.childNodes) {
            if(Number(key) >= currentStart && Number(key) < currentStart + currentLength) {
                newChildNodes[Number(key) - currentStart] = this.childNodes[key];
            } else {
                delete this.childNodes[key];
            }
        }

        this.childNodes = newChildNodes;

        return this;
    }

    getTwoDeepestLayers(layer) {
        // A side effect of this function is that it's also used to recalculate how much memory is currently being used
        for(let i=1; i<this.layers.length; i++) {
            allocatedMemory += this.layers[i].length;
        }

        if(Object.keys(this.childNodes).length === 0) {
            let almostDeepest = [this];
            if(this.layers.length === 2) {
                almostDeepest = [];
            }
            return [layer + this.layers.length - 1, [this], almostDeepest];
        }

        let deepestLayer = -1;
        let deepestNodes = [];
        let almostDeepestNodes = [];
        for(let child in this.childNodes) {
            let [childDeepestLayer, childDeepestNodes, childAlmostDeepestNodes] = this.childNodes[child].getTwoDeepestLayers(layer + this.layers.length - 1);

            if(childDeepestLayer > deepestLayer) {
                if(childDeepestLayer === deepestLayer + 1) {
                    // We can shift the deepestNodes into being the almostDeepestNodes
                    for(let node of deepestNodes) {
                        childAlmostDeepestNodes.push(node);
                    }
                }
                // If a new deepest layer has been found, it overwrites the previous deepest layer
                deepestLayer = childDeepestLayer;
                deepestNodes = childDeepestNodes;
                almostDeepestNodes = childAlmostDeepestNodes;

            } else if(childDeepestLayer === deepestLayer) {
                // If the deepest layer has been matched, the nodes on that layer can be added to our array
                for(let node of childDeepestNodes) {
                    deepestNodes.push(node);
                }
                for(let node of childAlmostDeepestNodes) {
                    almostDeepestNodes.push(node);
                }
            } else if(childDeepestLayer + 1 === deepestLayer) {
                for(let node of childDeepestNodes) {
                    almostDeepestNodes.push(node);
                }
            }
        }

        if(layer + this.layers.length === deepestLayer) {
            almostDeepestNodes.push(this);
        }

        return [deepestLayer, deepestNodes, almostDeepestNodes];
    }
    
    alphaBetaScoreNode(layer, offset, alpha, beta) {
        if(this.layers[layer][offset] === nullConst) {
            throw "scoreNode called on null node";
        }
        if(this.layers[layer][offset] === wonConst) {
            // totalEvals++;
            return evaluateBoard(this.layers[layer], offset);
        }

        // If this node is in the last layer
        if(layer + 1 == this.layers.length) {
            // If this node connects to a different triangle node
            if(offset in this.childNodes) {
                return this.childNodes[offset].alphaBetaScoreNode(0, 0, alpha, beta);
            } else {
                // totalEvals++;
                return evaluateBoard(this.layers[layer], offset);
            }
        }

        // If this node's children are in the last layer and the children haven't been generated yet
        if(layer + 2 == this.layers.length && offset >= this.creationIndex) {
            // totalEvals++;
            return evaluateBoard(this.layers[layer], offset);
        }

        // At this point we can be sure that the board has a layer beneath it in this node
        let nextOffset = offset * 7;

        // Explore nodes from the center out
        // This is due to center piece placement tending to be better than edge placement
        // If stronger moves are evaluated first than alpha beta pruning is more effective
        const exploreOrdering = [42, 56, 28, 70, 14, 84, 0];

        if(this.turns[layer]) {
            // Minimizing player

            // Whether there is a valid child under this node
            let validChild = false;


            for(let i of exploreOrdering) {
                let childFirstByte = this.layers[layer + 1][nextOffset + i];

                // If the child is a null node skip it
                if(childFirstByte === nullConst) {
                    continue;
                }
                
                let result = this.alphaBetaScoreNode(layer + 1, nextOffset + i, alpha, beta);
                validChild = true;

                if(result < beta) {
                    beta = result;
                }

                if(beta <= alpha) {
                    return beta;
                }
            }

            if(validChild) {
                return beta;
            }
        } else {
            // Maximizing player

            // Whether there is a valid child under this node
            let validChild = false;


            for(let i of exploreOrdering) {
                let childFirstByte = this.layers[layer + 1][nextOffset + i];

                // If the child is a null node skip it
                if(childFirstByte === nullConst) {
                    continue;
                }
                
                let result = this.alphaBetaScoreNode(layer + 1, nextOffset + i, alpha, beta);
                validChild = true;

                if(result > alpha) {
                    alpha = result;
                }

                if(alpha >= beta) {
                    return alpha
                }
            }

            if(validChild) {
                return alpha;
            }
        }

        // If there are no legal moves it is a draw
        return 0;
    }
}

/**
 * Manages the tree of BoardNodes
 */
class DecisionTree {

    constructor() {
        // turn represents who moved last
        // false means player 0, true means player 1
        this.turn = false;

        this.root = new TriangleNode(new Uint8Array(bytesPerBoard), this.turn);
        this.root.generateBoards();

        // deepestLayer is an array of the nodes that are currently being operated on
        //      (either deepened or generated)
        // nextDeepestLayer is an array of the nodes that have been created by tree deepening
        //      it will become deepestLayer once current deepening of deepestLayer has ceased
        // deepestLayerIndex is the index of where the operation currently is within the deepestLayer array
        this.deepestLayer = [this.root];
        this.nextDeepestLayer = [];
        this.deepestLayerIndex = 0;

        // Whether we're in a stage of generating boards or deepening the tree
        this.generating = false;

        // Whether we have finished computations
        this.complete = false;

        // depth is the last fully deepened layer
        this.depth = 2;

        // Move scores gets updated whenever a layer finishes generating
        this.moveScores = {};

        // The number of moves made in the game
        this.move = 0;
    }

    deepenTree() {
        if(this.deepestLayer.length === 0) {
            console.log("deepestLayer is empty, deepening ceasing");
            this.complete = true;
            postMessage({complete: true, notComputing: true});
            return;
        }
        
        if(haltComputation) {
            console.log('Halted before deepening');
            postMessage({notComputing: true});
            return;
        }

        console.log('Deepening', this.depth, allocatedMemory, this.deepestLayer.length, this.nextDeepestLayer.length);
        if(allocatedMemory >= maxMemory) {
            haltComputation = true;
            console.log("Halted due to memory usage");
            postMessage({notComputing: true});
            return;
        }

        while(this.deepestLayerIndex < this.deepestLayer.length) {
            let node = this.deepestLayer[this.deepestLayerIndex];

            // deepNode could just be node again, or it could be the new children of node
            const [complete, children] = node.deepenNode();
            for(let deepNode of children) {
                this.nextDeepestLayer.push(deepNode);
            }
            if(complete) {
                this.deepestLayerIndex++;

                operationCount--;
                if(operationCount <= 0) {
                    break;
                }
            } else {
                break;
            }

        }

        operationCount = maxOperations;
        if(haltComputation) {
            return;
        }
        if(this.deepestLayerIndex >= this.deepestLayer.length) {
            this.deepestLayer = this.nextDeepestLayer;
            this.nextDeepestLayer = [];
            this.deepestLayerIndex = 0;
            this.depth++;
            postMessage({depth: this.depth});

            this.generating = true;
            setTimeout(() => this.generateBoards(), operationDelay);
        } else {
            setTimeout(() => this.deepenTree(), operationDelay);
        }
    }

    generateBoards() {
        if(this.deepestLayer.length === 0) {
            console.log("deepestLayer is empty, generation ceasing");
            this.complete = true;
            postMessage({complete: true, notComputing: true});
            return;
        }

        if(haltComputation) {
            console.log('Halted before generating');
            postMessage({notComputing: true});
            return;
        }

        console.log('Generating', this.depth, this.deepestLayer.length, this.nextDeepestLayer.length);

        while(this.deepestLayerIndex < this.deepestLayer.length) {
            let node = this.deepestLayer[this.deepestLayerIndex];

            // If the node finished completing the generation
            if(node.generateBoards()) {
                this.deepestLayerIndex++;
            } else {
                // If it didn't, it means the operation count was finished
                break;
            }
        }

        operationCount = maxOperations;
        if(this.deepestLayerIndex >= this.deepestLayer.length) {
            this.deepestLayerIndex = 0;
            this.moveScores = this.getAlphaBetaScores();
            postMessage({moveScores: this.moveScores});

            // We can move onto deepening
            this.generating = false;
            setTimeout(() => this.deepenTree(), operationDelay);
        } else {
            // We want to continue generating
            setTimeout(() => this.generateBoards(), operationDelay);
        }
    }

    trimTree(columnChosen) {
        console.log('generating:', this.generating, 'allocated memory:', allocatedMemory, 'turn', this.turn, 'deepest length:', this.deepestLayer.length, 'next deepest length:', this.nextDeepestLayer.length, 'index:', this.deepestLayerIndex);
        this.root = this.root.trimNode(columnChosen);
        this.depth--;
        this.move++;

        let gameStatus = this.gameOver();
        if(gameStatus['status']) {
            haltComputation = true;
            postMessage({notComputing: true});
            console.log("Halting due to finished game, winner:", gameStatus['winner']);
            return;
        }

        // Updating who just went
        this.turn = !this.turn;
        this.moveScores = this.getAlphaBetaScores();

        if(this.complete) {
            return;
        }

        // Restoring the deepestLayer, nextDeepestLayer, deepestLayerIndex, and allocatedMemory
        //try {
        this.restoreComputationInfo();
        // } catch(err) {
        //     console.error(err);
        //     haltComputation = true;
        //     postMessage({notComputing: true});
        //     console.log('generating:', this.generating, 'allocated memory:', allocatedMemory, 'turn', this.turn, 'deepest length:', this.deepestLayer.length, 'next deepest length:', this.nextDeepestLayer.length, 'index:', this.deepestLayerIndex);
        //     return;
        // }

        console.log('generating:', this.generating, 'allocated memory:', allocatedMemory, 'turn', this.turn, 'deepest length:', this.deepestLayer.length, 'next deepest length:', this.nextDeepestLayer.length, 'index:', this.deepestLayerIndex);

        // Restarting computation if computation has been halted
        if(haltComputation) {
            haltComputation = false;
            postMessage({notComputing: false});
            if(this.generating) {
                setTimeout(() => this.generateBoards(), operationDelay);
            } else {
                setTimeout(() => this.deepenTree(), operationDelay);
            }
        }
    }

    getAlphaBetaScores() {
        let scores = {};
        for(let i=0; i < 7; i++) {
            let offset = i * bytesPerBoard;

            if(this.root.layers[1][offset] !== nullConst) {
                if(this.root.layers[1][offset] === wonConst) {
                    if(this.root.layers[1][offset + 1] === 1) {
                        scores[i] = Number.POSITIVE_INFINITY;
                    } else {
                        scores[i] = Number.NEGATIVE_INFINITY;
                    }
                } else {
                    scores[i] = this.root.alphaBetaScoreNode(1, offset, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
                }

                if(this.root.turns[0]) {
                    scores[i] = -scores[i];
                }
            }
        }

        return scores;
    }

    restoreComputationInfo() {
        // We want to recalculate how much memory is being used
        allocatedMemory = 0;

        // Called after a tree trim
        // Used to recalculate where we left off with tree growth
        let [newDepth, bottomLayer, secondToBottomLayer] = this.root.getTwoDeepestLayers(1);


        let newDeepestLayer;
        let newNextDeepestLayer;
        if(newDepth === this.depth) {
            // The next deepest layer was completely trimmed off
            newDeepestLayer = bottomLayer;
            newNextDeepestLayer = [];
        } else {
            // There is still a next deepest layer
            newDeepestLayer = secondToBottomLayer;
            newNextDeepestLayer = bottomLayer;
        }

        // We now have our two arrays, we now need to calculate the new this.deepestLayerIndex
        // newDeepestLayer will be a contiguous subarray of deepestLayer
        // We can calculate the position of newDeepestLayer in deepestLayer by using the first element of newDeepestLayer
        // It is guaranteed that this element is in deepestLayer and it's position along with the length of newDeepestLayer defines where it is in deepestLayer
        let start = this.deepestLayer.indexOf(newDeepestLayer[0]);

        if(start === -1) {
            throw "issue with deepest layer index";
        }

        let newIndex = this.deepestLayerIndex - start;
        this.deepestLayerIndex = Math.max(0, newIndex);

        // Finalizing the process by switching over to the new arrays
        this.deepestLayer = newDeepestLayer;
        this.nextDeepestLayer = newNextDeepestLayer;

        
        console.log('After restoration:', allocatedMemory, 'Depth:', this.depth, 'Real Depth:', newDepth);
    }

    getValidMoves() {
        let moves = [];
        for(let i=0; i < 7 * bytesPerBoard; i += bytesPerBoard) {
            if(this.root.layers[1][i] === nullConst) {
                moves.push(false);
            } else {
                moves.push(true);
            }
        }

        return moves;
    }

    gameOver() {
        if(this.root.layers[0][0] === wonConst) {
            if(this.root.layers[0][1] === 1) {
                return {
                    status: true,
                    winner: 1
                }
            } else {
                return {
                    status: true,
                    winner: 0
                }
            }
        } else if(this.getValidMoves().every(move => !move)) {
            // Draw
            return {
                status: true,
                winner: -1
            }
        }

        return {
            status: false
        }
    }
}




/*
 * Worker functionality
 */

var tree;
reset();

function move(col) {
    if(!tree.getValidMoves()[col]) {
        console.error("move() called on invalid column");
        return;
    }

    tree.trimTree(col);

    let gameStatus = tree.gameOver();
    if(gameStatus['status']) {
        if(gameStatus['winner'] >= 0) {
            console.log('Won game: ' + tree.root.layers[0][1]);
        } else {
            console.log('Draw')
        }
    } else if(tree.root.layers[0][0] === nullConst) {
        throw 'Entered invalid board state';
    } else {
        printBoard(tree.root.layers[0], 0);
    }
}

function reset() {
    delete tree;
    tree = new DecisionTree();
    allocatedMemory = 0;
    haltComputation = false;
    tree.deepenTree();
}

function evaluate() {
    //console.log(tree.getMoveScores());
    console.log(tree.moveScores);
}

onmessage = function (message) {
    let operation = message.data.type;

    if(operation === 'update') {
        let column = message.data.column;
        tree.trimTree(column);

        let gameOver = tree.gameOver();
        let returnMessage = {
            gameOver: tree.gameOver(),
            moveScores: tree.moveScores,
            move: tree.move,
            depth: tree.depth
        }

        // We want to only do this if the game isn't over
        // Otherwise we risk an error in getValidMoves about trying to access layer 1
        if(!gameOver.status) {
            returnMessage['validMoves'] = tree.getValidMoves();
        }

        postMessage(returnMessage);

    } else if(operation === 'reset') {
        reset();
    } else if(operation === 'dump') {
        postMessage({
            tree: tree
        })
    } else {
        console.error('computer got unknown operation in message:', message);
    }
}