// NOTE Possible optimization by having NonLeafNode only check a single piece for a win

const bytesPerBoard = 14;
const bytesPerBoardN = BigInt(bytesPerBoard);

class BigByteArray {
    static ARRAY_SIZE = 0xffffffffn - (0xffffffffn % BigInt(bytesPerBoard));

    constructor(length) {
        this.length = length;
        this._arrays = [];

        while(length > BigByteArray.ARRAY_SIZE) {
            this._arrays.push(new Uint8Array(Number(BigByteArray.ARRAY_SIZE)));
            length -= BigByteArray.ARRAY_SIZE;
        }
        this._arrays.push(new Uint8Array(Number(length)));

        this._currArray = 0;
        this._index = 0;
    }

    jumpTo(index) {
        this._currArray = 0;
        while(this._currArray < this._arrays.length && index >= this._arrays[this._currArray].length) {
            index -= BigInt(this._arrays[this._currArray].length);
            this._currArray++;
        }
        this._index = Number(index);
    }

    jumpAhead(index) {
        index += BigInt(this._index);
        while(this._currArray < this._arrays.length && index >= this._arrays[this._currArray].length) {
            index -= BigInt(this._arrays[this._currArray].length);
            this._currArray++;
        }
        this._index = Number(index);
    }

    ended() {
        return this._currArray >= this._arrays.length || (this._currArray == this._arrays.length - 1 && this._index >= this._arrays[this._currArray].length);
    }

    nextBoard() {
        if(this._index >= this._arrays[this._currArray].length) {
            this._index = 0;
            this._currArray++;

            if(this._currArray >= this._arrays.length) {
                throw `Read past the end of a BigByteArray of length ${this.length}`;
            }
        }

        if(this._index + bytesPerBoard > this._arrays[this._currArray].length) {
            throw `The spacing got messed up somehow.\n` +
                  `length:${this.length}, index:${this._index}, currArray:${this._currArray}, currArrayLen:${this._arrays[this._currArray].length}`
        }

        let view = this._arrays[this._currArray].subarray(this._index, this._index + bytesPerBoard);
        this._index += bytesPerBoard;
        return view;
    }

    trim(offset, length) {
        if(length + offset > this.length) {
            throw `Tried to trim a BigByteArray of length:${this.length} with offset:${offset} and length:${length}`;
        }

        this.length = length;

        /*
         * Trimming from the start of the arrays using offset
         */

        // Getting the offset in terms of arrays and index
        let arrayOffset = 0;

        while(offset >= this._arrays[arrayOffset].length) {
            offset -= BigInt(this._arrays[arrayOffset].length);
            arrayOffset++;
        }

        let indexOffset = Number(offset);

        // Trimming from the front of the arrays
        this._arrays.splice(0, arrayOffset)
        // Trimming the front of the indices
        this._arrays[0] = this._arrays[0].subarray(indexOffset);

        /*
         * Trimming from the end of the arrays using length
         */

        // Getting the length in terms of arrays and index
        let arrayLength = 0;

        while(arrayLength < this._arrays.length && length >= this._arrays[arrayLength].length) {
            length -= BigInt(this._arrays[arrayLength].length);
            arrayLength++;
        }

        let indexLength = Number(length);

        // Trimming from the end of the arrays
        this._arrays.splice(arrayLength+1);
        // Trimming the end of the indices
        if(indexLength != 0) {
            // If any further indices are needed trim up to that point
            this._arrays[arrayLength] = this._arrays[arrayLength].subarray(0, indexLength);
        } else {
            // If no further indices are needed, trim the whole array
            this._arrays.splice(arrayLength);
        }

        /*
         * Repairing the internal pointers to the current board
         */
        // If the pointer was cut from the beginning
        this._currArray -= arrayOffset;
        if(this._currArray < 0) {
            this._currArray = 0;
            this._index = 0;
        } else if(this._currArray == 0) {
            this._index -= indexOffset;
            if(this._index < 0) {
                this._index = 0;
            }
        } else if(this._currArray == arrayLength) {
            this._index -= indexLength;
        }
    }
}

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

        this.treeArrays = [];

        // Create the root array of a single blank board node
        // Index shows where we left off generating boards in the array
        // We will generate the single needed node, so we set index to 
        // the length of the array
        this.lastArray = new BigByteArray(bytesPerBoardN);
        this.treeArrays.push(this.lastArray);

        // Create the next array of its 7 children
        this.currentArray = new BigByteArray(7n * bytesPerBoardN);
        this.treeArrays.push(this.currentArray);

        // Push a piece to a different column of each of the children
        for(let i=0; i < 7; i++) {
            let view = this.currentArray.nextBoard();

            view[i] = 1;
            view[i + 7] = 1;
        }

        this.pause = true;

        // Avoiding the assertion by making the previous level ended
        this.lastArray.nextBoard();
        this.deepenTree();
        this.generateBoards();
    }

    deepenTree() {
        if(!this.lastArray.ended()) throw "A new tree level was created despite the last level being unfinished";

        // We want there to be room for 7 children of each board node in the current view
        let newArray = new BigByteArray(this.currentArray.length * 7n);
        this.treeArrays.push(newArray);

        this.lastArray = this.currentArray;
        this.currentArray = newArray;

        this.lastArray.jumpTo(0n);
    }

    trimTree(columnChosen) {
        // We want to trim the tree when a column is chosen for a move
        if(this.treeArrays.length <= 2) throw "Tree isn't big enough to trim";

        // The current board state can be removed
        this.treeArrays.splice(0, 1);

        let currentStart = BigInt(columnChosen) * bytesPerBoardN;
        let currentLength = bytesPerBoardN;
        for(let i=0; i < this.treeArrays.length; i++) {
            // We want to replace the current view of the array with a view containing
            // only the remaining section of the tree
            this.treeArrays[i].trim(currentStart, currentLength);

            // This segment of the tree in the next array will grow by 7 times
            currentStart *= 7n;
            currentLength *= 7n;
        }

        this.lastArray = this.treeArrays[this.treeArrays.length - 2];
        this.currentArray = this.treeArrays[this.treeArrays.length - 1];

        // Updating whose turn it is
        this.turn = !this.turn;
    }

    generateBoards() {
        // Create a series of 6 bit maps for the different pieces
        let bitMaps = new Uint8Array(new ArrayBuffer(6));
        for(let i=0; i < 6; i++) {
            bitMaps[i] = 1 << i;
        }

        while(!this.lastArray.ended()) {
            let lastBoard = this.lastArray.nextBoard();
            if(this.nonLeafBoard(lastBoard, bitMaps)) {
                /*
                 * We now can generate the child nodes in currentArray
                 */
                for(let i=0; i < 7; i++) {
                    let currBoard = this.currentArray.nextBoard();
                    // If a piece can be dropped in the column
                    if(lastBoard[i] < 6) {
                        // Copy the current board state over
                        currBoard.set(lastBoard);

                        // Drop the piece down the corresponding column
                        if(this.turn == (this.treeArrays.length & 1)) {
                            currBoard[i + 7] += bitMaps[currBoard[i]];
                        }
                        currBoard[i]++;
                    }
                }
            } else {
                this.currentArray.jumpAhead(7n * bytesPerBoardN);
            }
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