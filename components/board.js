function getBoard() {
    return document.querySelector('game-board');
}

class Board extends HTMLElement {
    constructor() {
        super();

        // Get relevant elements
        let boardTemplate = document.getElementById('board');
        let boardContent = boardTemplate.content.cloneNode(true);
        let boardOuter = boardContent.querySelector('div');
        let boardContainer = boardOuter.querySelector('div');

        // Add the game-pieces
        this.pieces = [];
        for(let i=0; i < 7; i++) {
            this.pieces.push([]);
            let column = document.createElement('div');
            column.setAttribute('class', 'column');
            column.setAttribute('onclick', 'getBoard().dropPiece(' + i + ')')

            for(let j=0; j < 6; j++) {
                let piece = new Piece();

                this.pieces[i].push(piece);
                column.appendChild(piece.element);
            }
            boardContainer.appendChild(column);
        }

        // Set whose turn it is
        this.turn = 'red';

        // Shadow root
        const shadowRoot = this.attachShadow({mode: 'open'});
        shadowRoot.appendChild(boardContent);
    }

    dropPiece(column) {
        if(this.pieces[column][5].color() != 'black') {
            return false;
        }

        let row = 5;
        while(row > 0 && this.pieces[column][row-1].color() == 'black') {
            row -= 1;
        }

        if(this.turn == 'red') {
            this.pieces[column][row].fillBlue();
            this.turn = 'blue';
        } else {
            this.pieces[column][row].fillRed();
            this.turn = 'red';
        }

        return true;
    }

    empty() {
        for(let i = 0; i < 7; i++) {
            for(let j = 0; j < 6; j++) {
                this.pieces[i][j].empty();
            }
        }
    }

} customElements.define('game-board', Board);

class Piece {
    constructor() {
        this.element = document.createElement('span');
        this.element.setAttribute('class', 'circle');
        this.element.style.backgroundColor = 'black';
    }

    color() {
        return this.element.style.backgroundColor;
    }

    fillRed() {
        this.element.style.backgroundColor = 'red';
    }
    fillBlue() {
        this.element.style.backgroundColor = 'blue';
    }
    empty() {
        this.element.style.backgroundColor = 'black';
    }
}