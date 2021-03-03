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
        let boardTemplate = document.getElementById('template-board');
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
            column.setAttribute('onclick', 'getBoard().humanMove(' + i + ')')
            column.setAttribute('onmouseover', 'getBoard().colOnMouseOver(' + i + ')');

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
        this.computer = new Worker('./scripts/computer.js');

        // Whether the AI or a human is controlling each color
        this.control = {1:this.playerOneSelect.value, 2:this.playerTwoSelect.value};

        // Shadow root
        const shadowRoot = this.attachShadow({mode: 'open'});
        shadowRoot.appendChild(boardContent);
    }

    beginGame() {
        if(this.control[this.turn] == 'human') {
            this.enable = true;
        } else {
            this.id = this.thinkingIndicator();
            this.computerMove();
        }

        this.playerOneSelect.disabled = true;
        this.playerTwoSelect.disabled = true;

        this.beginButton.setAttribute('onclick', 'getBoard().resetGame()');
        this.beginButton.textContent = 'Reset Game';
    }

    resetGame() {
        this.enable = false;
        this.empty();
        this.hideMoves();
        this.turn = 1;
        clearInterval(this.id);
        this.computer.terminate();
        this.computer = new Worker('./scripts/computer.js');

        this.playerOneSelect.disabled = false;
        this.playerTwoSelect.disabled = false;

        this.beginButton.setAttribute('onclick', 'getBoard().beginGame()');
        this.beginButton.textContent = 'Begin Game';
    }

    changePlayers(playerNum) {
        if(playerNum == 1) {
            this.control[1] = this.playerOneSelect.value;
        } else {
            this.control[2] = this.playerTwoSelect.value;
        }
    }

    computerMove() {
        this.computer.onmessage = function (message) {
            let gameOver = message.data.gameOver;
            let bestMove = message.data.bestMove;

            getBoard().dropPiece(bestMove);

            // If the game is over, disable the board
            if(gameOver != 0) {
                getBoard().enable = false;
                clearInterval(getBoard().id);
                getBoard().hideMoves();
            } else if(getBoard().control[getBoard().turn] == 'human') {
                clearInterval(getBoard().id);
                getBoard().hideMoves();

                getBoard().enable = true;
            } else {
                getBoard().computerMove();
            }
        }

        this.computer.postMessage({type:'makeMove'});
    }

    humanMove(column) {
        // If the board isn't enabled don't do anything
        if(!(this.enable)) {
            return;
        }

        // Avoid any issues with users clicking super fast
        this.enable = false;

        // Place the piece
        this.dropPiece(column);


        this.id = this.thinkingIndicator();

        // Update computer
        this.computer.onmessage = function (message) {
            let gameOver = message.data.gameOver;

            // If the game is over, disable the board
            if(gameOver != 0) {
                getBoard().enable = false;
                clearInterval(getBoard().id);
                getBoard().hideMoves();
            } else if(getBoard().control[getBoard().turn] == 'human') {
                clearInterval(getBoard().id);
                getBoard().hideMoves();

                getBoard().enable = true;
            } else {
                getBoard().computerMove();
            }
        }

        this.computer.postMessage({type:'update', column:column});
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

        return true;
    }

    empty() {
        for(let i=0; i < 7; i++) {
            for(let j=0; j < 6; j++) {
                this.pieces[i][j].empty();
            }
        }
    }

    thinkingIndicator() {
        // Code to iterate through the move previews
        // i goes from -6 to 5, then starts over again at -6
        let i = -6;
        let intervalID = setInterval(function() {
            getBoard().showMove(6 - Math.abs(i));       // 6 - |i| so that the piece starts on the left side
            i++;
            if(i > 5) {
                i=-6;
            }
        }, 250);

        return intervalID;
    }

    colOnMouseOver(column) {
        if(this.enable) {
            this.showMove(column);
            return true;
        }
        return false;
    }

    boardOnMouseOut() {
        if(this.enable) {
            this.hideMoves();
            return true;
        }
        return false;
    }

    showMove(column) {
        this.pieceIndicators[column].fill(this.turn);
        this.pieceIndicators[column].show();

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