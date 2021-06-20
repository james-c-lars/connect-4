var colorOne = '#b30000';
var colorTwo = '#000099';

function getBoard(index) {
    return Board.boardList[index];
}



class Piece extends HTMLElement{
    constructor() {
        super();
    }

    connectedCallback() {
        if(!this.getAttribute('class')) {
            this.setAttribute('class', 'blank-piece');
        }
    }

    color() {
        return this.style.getPropertyValue('--piece-color');
    }

    filled() {
        return this.getAttribute('class').split(' ').includes('full-piece');
    }

    fill(colorNum) {
        this.style.setProperty('--piece-color', colorNum == 1? colorOne : colorTwo);
        this.setAttribute('class', 'full-piece');
    }
    empty() {
        this.setAttribute('class', 'blank-piece');
    }

    instantFill(colorNum) {
        this.style.setProperty('--piece-color', colorNum == 1? colorOne : colorTwo);
        this.setAttribute('class', 'full-piece no-transition');
    }

    instantEmpty() {
        this.setAttribute('class', 'blank-piece no-transition');
    }

    show() {
        this.style.setProperty('opacity', '1');
    }
    hide() {
        this.style.setProperty('opacity', '0');
    }
} customElements.define('game-piece', Piece);



class Board extends HTMLElement {
    static boardCount = 0;
    static boardList = [];

    constructor() {
        super();

        this.index = Board.boardCount++;
        Board.boardList.push(this);

        // Get relevant elements
        let boardTemplate = document.getElementById('template-board');
        let boardContent = boardTemplate.content.cloneNode(true);
        let boardDrop = boardContent.querySelector('.indicator-container');
        let boardContainer = boardContent.querySelector('.piece-container');

        this.beginButton = boardContent.querySelector('.begin-button')
        this.playerOneSelect = boardContent.querySelector('.player-one');
        this.playerTwoSelect = boardContent.querySelector('.player-two');

        boardContainer.onmouseout = () => this.boardOnMouseOut();
        this.beginButton.onclick = () => this.beginGame();
        this.playerOneSelect.onchange = () => this.changePlayers(1);
        this.playerTwoSelect.onchange = () => this.changePlayers(2);

        /*
         * Add the game pieces to the board
         */
        this.pieces = [];
        for(let i=0; i < 7; i++) {
            this.pieces.push([]);

            // Create column div element
            let column = document.createElement('div');
            column.setAttribute('class', 'column');
            column.onclick = () => this.humanMove(i);
            column.onmouseover = () => this.colOnMouseOver(i);

            for(let j=0; j < 6; j++) {
                let piece = new Piece();

                this.pieces[i].push(piece);
                column.appendChild(piece);
            }
            boardContainer.appendChild(column);
        }

        // Whose turn it is
        this.turn = 1;

        /*
         * Add the indicator element at the top of the board
         */
        this.pieceIndicator = new Piece();
        this.pieceIndicator.instantFill(this.turn);
        this.pieceIndicator.hide();
        this.pieceIndicator.style.setProperty('transition', 'transform 300ms 0ms ease');
        this.pieceIndicator.style.setProperty('box-shadow', '0 0 0 0 black');
        boardDrop.appendChild(this.pieceIndicator);

        // Whether the board is interactable
        // Will become interactable when the move controller says it's the human's turn
        this.enable = true;

        // Attach a DecisionTree to the board
        this.computer = new Worker('./scripts/computer.js');

        // Whether the AI or a human is controlling each color
        this.control = {1:this.playerOneSelect.value, 2:this.playerTwoSelect.value};

        // Shadow root
        const shadowRoot = this.attachShadow({mode: 'open'});
        shadowRoot.appendChild(boardContent);
    }

    // beginGame() {
    //     if(this.control[this.turn] == 'human') {
    //         this.enable = true;
    //     } else {
    //         this.id = this.thinkingIndicator();
    //         this.computerMove();
    //     }

    //     this.playerOneSelect.disabled = true;
    //     this.playerTwoSelect.disabled = true;

    //     this.beginButton.setAttribute('onclick', 'getBoard().resetGame()');
    //     this.beginButton.textContent = 'Reset Game';
    // }

    // resetGame() {
    //     this.enable = false;
    //     this.empty();
    //     this.hideMoves();
    //     this.turn = 1;
    //     clearInterval(this.id);
    //     this.computer.terminate();
    //     this.computer = new Worker('./scripts/computer.js');

    //     this.playerOneSelect.disabled = false;
    //     this.playerTwoSelect.disabled = false;

    //     this.beginButton.setAttribute('onclick', 'getBoard().beginGame()');
    //     this.beginButton.textContent = 'Begin Game';
    // }

    // changePlayers(playerNum) {
    //     if(playerNum == 1) {
    //         this.control[1] = this.playerOneSelect.value;
    //     } else {
    //         this.control[2] = this.playerTwoSelect.value;
    //     }
    // }

    // computerMove() {
    //     this.computer.onmessage = function (message) {
    //         let gameOver = message.data.gameOver;
    //         let bestMove = message.data.bestMove;

    //         getBoard().dropPiece(bestMove);

    //         // If the game is over, disable the board
    //         if(gameOver != 0) {
    //             getBoard().enable = false;
    //             clearInterval(getBoard().id);
    //             getBoard().hideMoves();
    //         } else if(getBoard().control[getBoard().turn] == 'human') {
    //             clearInterval(getBoard().id);
    //             getBoard().hideMoves();

    //             getBoard().enable = true;
    //         } else {
    //             getBoard().computerMove();
    //         }
    //     }

    //     this.computer.postMessage({type:'makeMove'});
    // }

    // humanMove(column) {
    //     // If the board isn't enabled don't do anything
    //     if(!(this.enable)) {
    //         return;
    //     }

    //     // Avoid any issues with users clicking super fast
    //     this.enable = false;

    //     // Place the piece
    //     this.dropPiece(column);


    //     this.id = this.thinkingIndicator();

    //     // Update computer
    //     this.computer.onmessage = function (message) {
    //         let gameOver = message.data.gameOver;

    //         // If the game is over, disable the board
    //         if(gameOver != 0) {
    //             getBoard().enable = false;
    //             clearInterval(getBoard().id);
    //             getBoard().hideMoves();
    //         } else if(getBoard().control[getBoard().turn] == 'human') {
    //             clearInterval(getBoard().id);
    //             getBoard().hideMoves();

    //             getBoard().enable = true;
    //         } else {
    //             getBoard().computerMove();
    //         }
    //     }
    //     this.computer.postMessage({type:'update', column:column});
    // }

    async humanMove(column) {
        if(!this.enable || this.pieces[column][0].filled()) return;

        this.enable = false;
        let transitionDone = this.dropPiece(column);

        await transitionDone;

        this.turn = 3 - this.turn;
        this.pieceIndicator.instantFill(this.turn);

        this.enable = true;
    }


    // async dropPiece(column) {
    //     /*
    //      * Handling the updating of the visual board state
    //      */

    //     // If the column doesn't have any empty space return false
    //     if(this.pieces[column][5].color() != colorZero) {
    //         return false;
    //     }

    //     // Find the last open space in the column
    //     let row = 5;
    //     while(row > 0 && this.pieces[column][row-1].color() == colorZero) {
    //         row -= 1;
    //     }

    //     // Transition the piece in the board
    //     this.transitionDown(column, 0, row);

    //     // Swap whose turn it is
    //     this.turn = 3 - this.turn;

    //     return true;
    // }

    /*
     * Handling the updating of the visual board state
     */
    async dropPiece(column) {
        const piecesInCol = this.pieces[column];
        const turn = this.turn;

        // If no spaces are full, the promise rejects
        if(piecesInCol[0].filled()) return Promise.reject(`Column ${column} full`);

        // Find the last open space in the column
        let row = 5;
        while(row > 0 && piecesInCol[row].filled()) {
            row -= 1;
        }

        // index is where the currently animated piece is
        let index = 0;
        // transitionDown is a function which passes the animation from one piece to another
        function transitionDown() {
            piecesInCol[index].removeEventListener('transitionend', transitionDown);

            if(index < row) {
                piecesInCol[index].empty();

                index++;
                piecesInCol[index].addEventListener('transitionend', transitionDown);
                piecesInCol[index].fill(turn);
            }
        }

        return new Promise((resolve, reject) => {
            // Prepare the first piece to pass the transition on
            piecesInCol[0].addEventListener('transitionend', transitionDown);

            // Prepare the final piece to resolve the promise
            const final = () => {
                piecesInCol[row].removeEventListener('transitionend', final);
                resolve();
            };
            piecesInCol[row].addEventListener('transitionend', final);

            // Transition the first piece
            piecesInCol[0].fill(turn);
        });
    }

    empty() {
        for(let i=0; i < 7; i++) {
            for(let j=0; j < 6; j++) {
                this.pieces[i][j].instantEmpty();
            }
        }
    }

    colOnMouseOver(column) {
        this.pieceIndicator.fill(this.turn);
        this.pieceIndicator.show();
        this.pieceIndicator.style.setProperty('transform', `translateX(calc(${column-3} * (var(--piece-size) + 2*var(--piece-margin))))`);
    }

    boardOnMouseOut() {
        this.pieceIndicator.hide();
    }

} customElements.define('game-board', Board);