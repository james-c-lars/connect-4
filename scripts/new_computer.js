const bytesPerBoard = 14;
const maxDepth = 11;

/**
 * Manages the tree of BoardNodes
 */
class DecisionTree {
    /*
     * The bytes are arranged like so
     * First 7 bytes are the heights of each column 0-6
     * Next 7 bytes are the pieces in those columns
     * The bottom of the column is at 2^0, not 2^5
     */

    constructor() {
        // turn represents who moved last
        // false means player 0, true means player 1
        this.turn = false;

        this.treeViews = [];

        // Create the root array of a single blank board node
        // Index shows where we left off generating boards in the array
        // We will generate the single needed node, so we set index to 
        // the length of the array
        this.index = bytesPerBoard;
        let lastBuffer = new ArrayBuffer(bytesPerBoard);
        this.lastView = new Uint8Array(lastBuffer);
        this.treeViews.push(this.lastView);

        // Create the next array of its 7 children
        let currentBuffer = new ArrayBuffer(bytesPerBoard * 7);
        this.currentView = new Uint8Array(currentBuffer);
        this.treeViews.push(this.currentView);

        // Push a piece to a different column of each of the children
        for(let i=0; i < 7; i++) {
            let baseByte = bytesPerBoard * i + i;

            this.currentView[baseByte] = 1; 
            this.currentView[baseByte + 7] = 1;
        }

        this.pause = true;

        this.deepenTree();
        this.generateBoards();
    }

    deepenTree() {
        if(this.index < this.lastView.length) throw "A new tree level was created despite the last level being unfinished";
        if(this.treeViews.length >= 11) throw "A tree deeper than 11 levels can't be created";

        // We want there to be room for 7 children of each board node in the current view
        let newBuffer = new ArrayBuffer(this.currentView.length * 7);
        let newView = new Uint8Array(newBuffer);
        this.treeViews.push(newView);

        this.lastView = this.currentView;
        this.currentView = newView;

        this.index = 0;
    }

    trimTree(columnChosen) {
        // We want to trim the tree when a column is chosen for a move
        if(this.treeViews.length <= 2) throw "Tree isn't big enough to trim";

        // The current board state can be removed
        this.treeViews.splice(0, 1);

        let currentStart = columnChosen * bytesPerBoard;
        let currentLength = bytesPerBoard;
        for(let i=0; i < this.treeViews.length - 2; i++) {
            // We want to replace the current view of the array with a view containing
            // only the remaining section of the tree
            this.treeViews[i] = this.treeViews[i].subarray(currentStart, currentStart + currentLength);

            // This segment of the tree in the next array will grow by 7 times
            currentStart *= 7;
            currentLength *= 7;
        }

        let i = this.treeViews.length - 2;
        // Dealing with the last view
        // We want to update lastView and lastIndex
        this.treeViews[i] = this.treeViews[i].subarray(currentStart, currentStart + currentLength);
        this.lastView = this.treeViews[i];
        this.index = Math.max(this.index - currentStart, 0);

        currentStart *= 7;
        currentLength *= 7;
        i++;

        // Dealing with the current view
        // We want to update currentView and currentIndex
        this.treeViews[i] = this.treeViews[i].subarray(currentStart, currentStart + currentLength);
        this.currentView = this.treeViews[i];

        // Updating whose turn it is
        this.turn = !this.turn;
    }

    generateBoards() {
        // Create a series of 6 bit maps for the different pieces
        let bitMaps = new Uint8Array(new ArrayBuffer(6));
        for(let i=0; i < 6; i++) {
            bitMaps[i] = 1 << i;
        }

        while(this.index < this.lastView.length) {
            let currBoard = this.lastView.subarray(this.index, this.index + bytesPerBoard);
            if(this.nonLeafBoard(currBoard, bitMaps)) {
                /*
                 * We now can generate the child nodes in currentView
                 */
                for(let i=0; i < 7; i++) {
                    // If a piece can be dropped in the column
                    if(this.lastView[this.index+i] < 6) {
                        // Copy the current board state over
                        let baseIndex = this.index * 7 + i * bytesPerBoard;
                        this.currentView.set(currBoard, baseIndex);

                        baseIndex += i;
                        // Drop the piece down the corresponding column
                        if(this.turn == (this.treeViews.length & 1)) {
                            this.currentView[baseIndex + 7] += bitMaps[this.currentView[baseIndex]];
                        }
                        this.currentView[baseIndex]++;
                    }
                }
            }
            this.index += bytesPerBoard;
        }
    }

    /*
     * Helper function for generateBoards
     */
    nonLeafBoard(boardArray, bitMaps) {
        /*
         * Check to see if the board being considered is "null"
         */
        let empty = true;
        for(let i=0; i < 7; i++) {
            if(boardArray[i] !== 0) {
                empty = false;
                break;
            }
        }
        if(empty) {
            return false;
        }

        /*
        * Check to see if the board being considered is won
        */
        // First check to see if the cols have 4 in a row
        for(let i=0; i < 7; i++) {
            // Iterating over a single column
            let inARow = 1;
            let last = (boardArray[i + 7] & bitMaps[0]) > 0;
            for(let j=1; j < boardArray[i]; j++) {
                // If the current piece is matches the last piece
                if(((boardArray[i + 7] & bitMaps[j]) > 0) == last) {
                    inARow++;
                    if(inARow > 3) return false;

                } else {
                    inARow = 1;
                    last = !last;
                }
            }
        }
        // Then check to see if the rows have 4 in a row
        for(let j=0; j < 6; j++) {
            // Iterating over a single row
            let inARow = 0;
            let last = null;
            for(let i=0; i < 7; i++) {
                // If the row has a piece in this column
                if(boardArray[i] > j) {
                    // If the piece matches the last piece in the row
                    let curr = (boardArray[i + 7] & bitMaps[j]) > 0;
                    if(curr === last) {
                        inARow++;
                        if(inARow > 3) return false;
                    } else {
                        inARow = 1;
                        last = curr;
                    }
                } else {
                    inARow = 0;
                    last = null;
                }
            }
        }
        // Next see if the descending diagonals have 4 in a row
        for(let x=3; x < 9; x++) {
            let j = Math.min(x, 5);
            let i = x - j;

            let inARow = 0;
            let last = null;
            while(i < 7 && j >= 0) {
                // If the row has a piece in this column
                if(boardArray[i] > j) {
                    // If the piece matches the last piece in the row
                    let curr = (boardArray[i + 7] & bitMaps[j]) > 0;
                    if(curr === last) {
                        inARow++;
                        if(inARow > 3) return false;
                    } else {
                        inARow = 1;
                        last = curr;
                    }
                } else {
                    inARow = 0;
                    last = null;
                }

                i++;
                j--;
            }
        }
        //Finally we see if the ascending diagonals have 4 in a row
        for(let x=3; x < 9; x++) {
            let i = Math.max(x - 5, 0);
            let j = Math.max(5 - x, 0);

            let inARow = 0;
            let last = null;
            while(i < 7 && j < 6) {
                // If the row has a piece in this column
                if(boardArray[i] > j) {
                    // If the piece matches the last piece in the row
                    let curr = (boardArray[i + 7] & bitMaps[j]) > 0;
                    if(curr === last) {
                        inARow++;
                        if(inARow > 3) return false;
                    } else {
                        inARow = 1;
                        last = curr;
                    }
                } else {
                    inARow = 0;
                    last = null;
                }

                i++;
                j++;
            }
        }

        // The board has passed all checks and is valid
        return true;
    }
}




/*
 * Worker functionality
 */

var tree = new DecisionTree();

onmessage = function (message) {
    let operation = message.data.type;

    if(operation == 'update') {
        let column = message.data.column;
        tree.update(column);
        postMessage( {gameOver: tree.gameOver()} );
    }
    else if (operation == 'makeMove') {
        let bestMove = tree.bestMove();
        tree.update(bestMove);

        postMessage( {gameOver: tree.gameOver(), bestMove: bestMove} );
    } else {
        console.error('computer got unknown operation in message' + message);
    }
}