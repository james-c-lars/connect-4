var foresight = 10000;

/**
 * Manages the tree of BoardNodes
 */
class DecisionTree {

    /**
     * Constructs a DecisionTree from a Board element.
     * @param {Board} board 
     */
    constructor(board) {
        this.root = new BoardNode();
        this.turn = board.turn;

        // Constructing the board state of our root node
        for(let col=0; col < 7; col++) {
            for(let row=0; row < 6; row++) {
                if(board.pieces[col][row] == colorOne) {
                    this.root.ghostBoard[col][row] = 1;
                } else if(board.pieces[col][row] == colorTwo) {
                    this.root.ghostBoard[col][row] = 2;
                } else {
                    this.root.ghostBoard[col][row] = 0;
                }
            }
        }

        this.generateNodes(foresight);
    }

    /**
     * Returns the number of nodes in the decision tree
     * 
     * @param {Number} node 
     */
    size(node) {
        let s = 1;
        for(let i=0; i < node.children.length; i++) {
            s += this.size(node.children[i]);
        }
        return s;
    }

    /**
     * Returns 0 if no one has won the game, or the number corresponding to who won
     * 
     * @returns {Number}
     */
    gameOver() {
        if(this.root.oneScore == Number.MAX_SAFE_INTEGER) {
            return 1;
        }
        if(this.root.twoScore == Number.MAX_SAFE_INTEGER) {
            return 2;
        }

        return 0;
    }

    /**
     * Updates the current board state based on the column in which a piece was dropped
     * 
     * @param {Number} column 
     */
    update(column) {
        let newRoot = null;
        for(let i=0; i < this.root.children.length; i++) {
            if(this.root.children[i].lastMove == column) {
                newRoot = this.root.children[i];
                break;
            }
        }
        this.root = newRoot;

        this.generateNodes(foresight);
        console.log('Tree size: ' + this.size(this.root));
    }

    /**
     * Returns what the best move is in the given position
     * 
     * @returns {Number}
     */
    bestMove() {
        let bestMove = -1;
        let maxValue = Number.MIN_SAFE_INTEGER;

        for(let i=0; i < this.root.children.length; i++) {
            let value = this.moveValue(this.root.children[i]);
            if(value >= maxValue) {
                bestMove = this.root.children[i].lastMove;
                maxValue = value;
            }
        }

        return bestMove;
    }

    /**
     * Finds what the value of a given board state is
     * 
     * @param {BoardNode} node 
     * @returns {Number}
     */
    moveValue(node) {
        // Base case, return the value of the board for the last person who moved
        if(node.children.length == 0) {
            return node.turn == 2 ? node.oneScore - node.twoScore : node.twoScore - node.oneScore;
        }

        // Otherwise find the scores of the children
        let childScores = []
        for(let i=0; i < node.children.length; i++) {
            childScores.push(this.moveValue(node.children[i]));
        }

        // Find the best of the scores
        let max = Math.max.apply(this, childScores);

        // And return it's negative (as the parent will be considering from the opposite perspective)
        return -max;
    }

    /**
     * Expands the tree count number of times
     * 
     * @param {Number} count 
     */
    generateNodes(count) {
        // We will iterate through this queue and add more nodes to the end
        let queue = this.getLeaves(this.root);
        
        for(let i=0; i < count && i < queue.length; i++) {
            // If the node is a won board state

            // Generate some new board states
            let newNodes = queue[i].generateChildren();

            // Append the new board states to the queue
            for(let j=0; j < newNodes.length; j++) {
                queue.push(newNodes[j]);
            }
        }
    }

    /**
     * This returns the leaves under node
     * 
     * @param {BoardNode} node
     * @returns {Array<BoardNode}
     */
    getLeaves(node) {
        // Base case if this node is a leaf
        if(node.children.length == 0) {
            return [node];
        }

        // Otherwise recursively call this function and get the leaves in one list
        let leaves = [];
        for(let i=0; i < node.children.length; i++) {
            let subLeaves = this.getLeaves(node.children[i]);
            for(let j=0; j < subLeaves.length; j++) {
                leaves.push(subLeaves[j]);
            }
        }

        return leaves;
    }
}



/**
 * A BoardNode contains a single possible board state. You can simulate a move with a BoardNode and see the resulting evaluation.
 */
class BoardNode {
    
    /**
     * Constructs an empty BoardNode, If passed a preexisting BoardNode, will become a copy of it.
     * 
     * @param {BoardNode} copy 
     */
    constructor(copy=null) {
        if(copy === null) {
            this.ghostBoard = [];
            for(let i=0; i < 7; i++) {
                this.ghostBoard.push([]);
                for(let j=0; j < 6; j++) {
                    this.ghostBoard[i][j] = 0;
                }
            }

            this.turn = 1;
            this.oneScore = 0;
            this.twoScore = 0;
            this.lastMove = null;
            this.children = [];
        } else {
            this.ghostBoard = [];
            for(let i=0; i < 7; i++) {
                this.ghostBoard.push([]);
                for(let j=0; j < 6; j++) {
                    this.ghostBoard[i][j] = copy.ghostBoard[i][j];
                }
            }
    
            this.turn = copy.turn;
            this.oneScore = copy.oneScore;
            this.twoScore = copy.twoScore;
            this.lastMove = copy.lastMove;
            this.children = [];
        }
    }

    /**
     * Returns the score associated with the passed Number
     * @param {Number} num 
     * @returns {Number}
     */
    getScore(num) {
        return num == 1? this.oneScore - this.twoScore : this.twoScore - this.oneScore;
    }

    /**
     * Updates the internal board state using the column a piece was dropped in. Returns whether the operation was successful.
     * 
     * @param {Number} column 
     * @returns {boolean}
     */
    dropPiece(column) {
        // If the column doesn't have any empty space return false
        if(this.ghostBoard[column][5] != 0) {
            return false;
        }

        // Find the last open space in the column
        let row = 5;
        while(row > 0 && this.ghostBoard[column][row-1] == 0) {
            row -= 1;
        }

        // Edit the piece in the board
        this.ghostBoard[column][row] = this.turn;
        this.turn = 3 - this.turn;

        this.lastMove = column;

        this.evaluate();
        return true;
    }

    /**
     * Generates the subsequent board states leading from this one, stores them, and returns them
     * 
     * @returns {Array<BoardNode>}
     */
    generateChildren() {
        this.children = [];

        if(this.oneScore == Number.MAX_SAFE_INTEGER || this.twoScore == Number.MAX_SAFE_INTEGER) {
            return this.children;
        }

        for(let col=0; col < 7; col++) {
            let child = new BoardNode(this);

            // If the move is invalid, dropPiece will return false
            if(child.dropPiece(col)) {
                this.children.push(child);
            }
        }

        return this.children;
    }

    /**
     * Takes a count of pieces in a set of four. Updates the BoardNode's score variables and returns true if a connect four was found.
     * 
     * @param {Array<Number>} count 
     * @returns {boolean}
     */
    score(count) {
        // If there are no 2 pieces to interfere with a possible 1 connect four
        if(count[1] != 0 && count[2] == 0) {
            if(count[1] == 4) {
                this.oneScore = Number.MAX_SAFE_INTEGER;
                this.twoScore = 0;

                // The game is over
                return true;
            } else {
                this.oneScore += Math.pow(10, count[1] - 1);
            }
        }
        // If there are no 1 pieces to interfere with a possible 2 connect four
        else if(count[1] == 0 && count[2] != 0) {
            if(count[2] == 4) {
                this.oneScore = 0;
                this.twoScore = Number.MAX_SAFE_INTEGER;

                // The game is over
                return true;
            } else {
                this.twoScore += Math.pow(10, count[2] - 1);
            }
        }

        // The game is not over
        return false;
    }

    /**
     * Evaluates the board state and updates the score variables using the score function.
     */
    evaluate() {
        this.oneScore = 0;
        this.twoScore = 0;

        let count;

        /*
         * First check horizontal sets of four
         */
        for(let row=0; row < 6; row++) {

            // There are four sets of four pieces per row
            // For each set of four, score it
            for(let col=0; col < 4; col++) {
                count = [0,0,0];

                // Update count
                for(let i=0; i < 4; i++) {
                    count[this.ghostBoard[col+i][row]] += 1;
                }

                // Score the count
                if(this.score(count)) return;
            }
        }

        /*
         * Then check vertical sets of four
         */
        for(let col=0; col < 7; col++) {

            // There are three sets of four pieces per column
            // For each subsequent set of four, score it
            for(let row=0; row < 3; row++) {
                count = [0,0,0];

                // Update count
                for(let i=0; i < 4; i++) {
                    count[this.ghostBoard[col][row+i]] += 1;
                }

                // Score the count
                if(this.score(count)) return;
            }
        }

        /*
         * Then check positive diagonal sets of four
         */
        for(let col=0; col < 4; col++) {

            // For each subsequent set of four, score it
            for(let row=0; row < 3; row++) {
                count = [0,0,0];

                // Update count
                for(let i=0; i < 4; i++) {
                    count[this.ghostBoard[col+i][row+i]] += 1;
                }

                // Score the count
                if(this.score(count)) return;
            }
        }

        /*
         * Finally check negative diagonal sets of four
         */
        for(let col=0; col < 4; col++) {

            // For each subsequent set of four, score it
            for(let row=3; row < 5; row++) {
                count = [0,0,0];

                // Update count
                for(let i=0; i < 4; i++) {
                    count[this.ghostBoard[col+i][row-i]] += 1;
                }

                // Score the count
                if(this.score(count)) return;
            }
        }
    }
}