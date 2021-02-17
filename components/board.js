class Board extends HTMLElement {
    constructor() {
        super();
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

            for(let j=0; j < 6; j++) {
                let piece = new Piece();

                this.pieces[i].push(piece);
                column.appendChild(piece.element);
            }
            boardContainer.appendChild(column);
        }

        const shadowRoot = this.attachShadow({mode: 'open'});
        
        shadowRoot.appendChild(boardContent);
    }
} customElements.define('game-board', Board);

class Piece {
    constructor() {
        this.element = document.createElement('span');
        this.element.setAttribute('class', 'circle');
        this.state = 0
    }

    fillRed() {
        this.state = 1
        this.element.style.backgroundColor = 'red';
    }
    fillBlue() {
        this.state = 2
        this.element.style.backgroundColor = 'blue';
    }
    empty() {
        this.state = 0
        this.element.style.backgroundColor = 'black';
    }
}