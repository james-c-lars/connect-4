var colorZero = 'black';
var colorOne = 'red';
var colorTwo = 'blue';

function getBoard() {
    return document.querySelector('game-board');
}



class Piece {
    constructor() {
        this.element = document.createElement('span');
        this.element.setAttribute('class', 'circle');
        this.element.style.backgroundColor = colorZero;
    }

    color() {
        return this.element.style.backgroundColor;
    }

    fill(colorNum) {
        this.element.style.backgroundColor = colorNum == 1? colorOne : colorTwo;
    }
    empty() {
        this.element.style.backgroundColor = colorZero;
    }

    show() {
        this.element.style.opacity = '1.0';
    }
    hide() {
        this.element.style.opacity = '0.0';
    }
}



class Board extends HTMLElement {
    constructor() {
        super();

        // Get relevant elements
        let boardTemplate = document.getElementById('board');
        let boardContent = boardTemplate.content.cloneNode(true);
        let boardDrop = boardContent.getElementById('indicator-container');
        let boardContainer = boardContent.getElementById('pieces-container');
        this.beginButton = boardContent.getElementById('begin-button')
        this.playerOneSelect = boardContent.getElementById('player-one');
        this.playerTwoSelect = boardContent.getElementById('player-two');

        /*
         * Add the game pieces to the board
         */
        this.pieces = [];
        for(let i=0; i < 7; i++) {
            this.pieces.push([]);

            // Create column div element
            let column = document.createElement('div');
            column.setAttribute('class', 'column');
            column.setAttribute('onclick', 'getBoard().makeMove(' + i + ')')
            column.setAttribute('onmouseover', 'getBoard().showMove(' + i + ')');

            for(let j=0; j < 6; j++) {
                let piece = new Piece();

                this.pieces[i].push(piece);
                column.appendChild(piece.element);
            }
            boardContainer.appendChild(column);
        }

        /*
         * Add the indicator element at the top of the board
         */
        this.pieceIndicators = [];
        for(let i=0; i < 7; i++) {
            let piece = new Piece();

            // column schenanigans to get correct spacing
            let column = document.createElement('div');
            column.setAttribute('class', 'column');
            column.appendChild(piece.element);

            piece.hide();
            this.pieceIndicators.push(piece);
            boardDrop.appendChild(column);
        }

        // Whose turn it is
        this.turn = 1;

        // Whether the board is interactable
        // Will become interactable when the move controller says it's the human's turn
        this.enable = false;

        // Attach a DecisionTree to the board
        this.computer = new DecisionTree(this);

        // Whether the AI or a human is controlling each color
        this.control = {1:this.playerOneSelect.value, 2:this.playerTwoSelect.value};

        // Shadow root
        const shadowRoot = this.attachShadow({mode: 'open'});
        shadowRoot.appendChild(boardContent);
    }

    beginGame() {
        this.moveController();

        this.beginButton.disabled = true;
        this.playerOneSelect.disabled = true;
        this.playerTwoSelect.disabled = true;
    }

    changePlayers(playerNum) {
        if(playerNum == 1) {
            this.control[1] = this.playerOneSelect.value;
        } else {
            this.control[2] = this.playerTwoSelect.value;
        }
    }

    moveController() {
        // If a computer is going next, make its move
        if(this.control[this.turn] == 'computer') {
            this.dropPiece(this.computer.bestMove());
        }

        // If the game is over, disable the board
        if(this.computer.gameOver() != 0) {
            this.enable = false;
        }
        // If the game isn't over and it's the computer's turn, take it from the top
        else if(this.control[this.turn] == 'computer') {
            this.moveController();
        }
        // If the game isn't over and it's the human's turn, let them interact with the board
        else {
            this.enable = true;
        }
    }

    makeMove(column) {
        // If the board isn't enabled don't do anything
        if(!(this.enable)) {
            return;
        }

        // Avoid any issues with users clicking super fast
        this.enable = false;

        // Place the piece
        this.dropPiece(column);

        // Update the indicator
        this.showMove(column);

        // Let the move controller decide what happens next
        this.moveController();
    }

    dropPiece(column) {
        /*
         * Handling the updating of the visual board state
         */

        // If the column doesn't have any empty space return false
        if(this.pieces[column][5].color() != colorZero) {
            return false;
        }

        // Find the last open space in the column
        let row = 5;
        while(row > 0 && this.pieces[column][row-1].color() == colorZero) {
            row -= 1;
        }

        // Edit the piece in the board
        this.pieces[column][row].fill(this.turn);
        this.turn = 3 - this.turn;

        /*
         * Handling the computer's internal representation of the board state
         */

        this.computer.update(column);

        return true;
    }

    empty() {
        for(let i=0; i < 7; i++) {
            for(let j=0; j < 6; j++) {
                this.pieces[i][j].empty();
            }
        }
    }

    showMove(column) {
        this.pieceIndicators[column].show();
        this.pieceIndicators[column].fill(this.turn);

        for(let i=0; i < 7; i++) {
            if(i != column) {
                this.pieceIndicators[i].hide();
            }
        }
    }

    hideMoves() {
        for(let i=0; i < 7; i++) {
            this.pieceIndicators[i].hide();
        }
    }

} customElements.define('game-board', Board);