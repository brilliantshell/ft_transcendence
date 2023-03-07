import {
  BallData,
  ControllerType,
  GameInfo,
  GameMetaData,
  KeyPressed,
  PaddlePositions,
} from './interfaces';
import { Subject } from 'rxjs';
import { listenEvent } from '../../../util/Socket';
import { socket } from '../../../util/Socket';

export class GamePainter {
  intervalId: number = 0;
  private ballData: BallData;
  private metaData: GameMetaData;
  private readonly keyPressed: KeyPressed = { up: false, down: false };
  private paddlePositions: PaddlePositions;
  private scores: [number, number] = [0, 0];
  private readonly subject: Subject<void> = new Subject();

  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly gameInfo: GameInfo,
    private readonly controllerType: ControllerType,
    private readonly dimension: { w: number; h: number },
  ) {
    this.context.font = '4rem DungGeunMo';
    this.metaData = new GameMetaData(dimension);
    const { paddleW } = this.metaData;
    this.ballData = this.resetBallData({ xDirection: 1, yDirection: 1 });
    this.paddlePositions = {
      myY: (dimension.h - paddleW) / 2,
      opponentY: (dimension.h - paddleW) / 2,
    };
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  spectateGame() {
    socket.on('gameSpectate', ({ ballData, paddlePositions, scores }) => {
      if (ballData === null) {
        this.drawResult();
        socket.off('gameSpectate');
        return;
      }
      this.ballData = ballData;
      this.paddlePositions = paddlePositions;
      this.scores = scores;
      this.context.clearRect(0, 0, this.dimension.w, this.dimension.h);
      this.drawLine();
      this.drawBall();
      this.drawPaddles();
      this.drawScores();
    });
  }

  async startGame() {
    const [directions] = await Promise.all([
      listenEvent<{
        xDirection: 1 | -1;
        yDirection: 1 | -1;
      }>('gameBallDirections'),
      socket.emit('gameResetBall', { gameId: this.gameInfo.id }),
    ]);
    this.ballData = this.resetBallData(directions);
    socket.off('gameBallDirections');
    this.subject.subscribe(() => {
      if (this.controllerType.isLeft) {
        socket.emit('gameData', {
          gameId: this.gameInfo.id,
          ballData: this.ballData,
          paddlePositions: this.paddlePositions,
          scores: this.scores,
        });
      }
      this.context.clearRect(0, 0, this.dimension.w, this.dimension.h);
      this.drawLine();
      this.drawBall();
      this.drawPaddles();
      this.drawScores();
      const { x, dx } = this.ballData;
      const { boardEdges } = this.metaData;
      if (x + dx < boardEdges.left || x + dx > boardEdges.right) {
        this.updateScore();
      } else {
        this.updateBallData();
        this.updatePaddlePosition();
      }
    });
    socket.on('gameOpponentY', ({ y }: { isLeft: boolean; y: number }) => {
      this.paddlePositions.opponentY = y;
    });
    this.intervalId = setInterval(() => this.subject.next(), 10);
  }

  keyDownHandler(e: KeyboardEvent) {
    if (e.key === 'Up' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.keyPressed.up = true;
    } else if (e.key === 'Down' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.keyPressed.down = true;
    }
  }

  keyUpHandler(e: KeyboardEvent) {
    if (e.key === 'Up' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.keyPressed.up = false;
    } else if (e.key === 'Down' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.keyPressed.down = false;
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  private updateScore() {
    const { midX } = this.metaData;
    this.scores[this.ballData.x > midX ? 0 : 1] += 1;
    clearInterval(this.intervalId);
    setTimeout(() => {
      if (this.scores[0] === 5 || this.scores[1] === 5) {
        this.finishGame();
      } else {
        Promise.all([
          listenEvent<{ xDirection: 1 | -1; yDirection: 1 | -1 }>(
            'gameBallDirections',
          ).then(directions => {
            socket.off('gameBallDirections');
            this.ballData = this.resetBallData(directions);
            this.intervalId = setInterval(() => this.subject.next(), 10);
          }),
          socket.emit('gameResetBall', { gameId: this.gameInfo.id }),
        ]);
      }
    }, 250);
  }

  private updatePaddlePosition() {
    const { myY } = this.paddlePositions;
    const { paddleW } = this.metaData;
    if (this.keyPressed.up && myY > 0) {
      this.paddlePositions.myY = Math.max(myY - 8, 0);
      socket.emit('gamePlayerY', {
        gameId: this.gameInfo.id,
        y: this.paddlePositions.myY,
      });
    } else if (this.keyPressed.down && myY < this.dimension.h - paddleW) {
      this.paddlePositions.myY = Math.min(myY + 8, this.dimension.h - paddleW);
      socket.emit('gamePlayerY', {
        gameId: this.gameInfo.id,
        y: this.paddlePositions.myY,
      });
    }
  }

  private updateBallData() {
    let { x, y, dx, dy } = this.ballData;
    const { boardEdges, paddleEnds, paddleW } = this.metaData;
    const { myY, opponentY } = this.paddlePositions;
    const { isPlayer, isLeft } = this.controllerType;
    const nextX = x + dx;
    const nextY = y + dy;
    if (nextY < boardEdges.top || nextY > boardEdges.bottom) {
      this.ballData.dy = -dy;
    }
    const [leftY, rightY] =
      !isPlayer || isLeft ? [myY, opponentY] : [opponentY, myY];
    const isPaddleTouched =
      (x > paddleEnds.left &&
        nextX < paddleEnds.left &&
        nextY > leftY &&
        nextY < leftY + paddleW) ||
      (x < paddleEnds.right &&
        nextX > paddleEnds.right &&
        nextY > rightY &&
        nextY < rightY + paddleW);
    if (isPaddleTouched) {
      this.ballData.dx = -dx;
      this.accelerate();
    }
    this.ballData.x += this.ballData.dx;
    this.ballData.y += this.ballData.dy;
  }

  private finishGame() {
    socket.off('gameOpponentY');
    const { isPlayer, isLeft } = this.controllerType;
    if (isPlayer && (isLeft ? this.scores[0] : this.scores[1]) === 5) {
      socket.emit('gameComplete', {
        id: this.gameInfo.id,
        scores: this.scores,
      });
    }
    this.drawResult();
  }

  private drawLine() {
    const { midX } = this.metaData;
    this.context.beginPath();
    this.context.moveTo(midX, 0);
    this.context.setLineDash([10, 15]);
    this.context.lineTo(midX, this.dimension.h);
    this.context.stroke();
  }

  private drawBall() {
    const { x, y } = this.ballData;
    this.context.beginPath();
    this.context.arc(x, y, this.metaData.radius, 0, Math.PI * 2);
    this.context.fillStyle = '#ccadac';
    this.context.fill();
    this.context.closePath();
  }

  private drawPaddles() {
    const { paddleW, paddleH, radius } = this.metaData;
    const { myY, opponentY } = this.paddlePositions;
    const { isPlayer, isLeft } = this.controllerType;
    const yCoords = !isPlayer || isLeft ? [myY, opponentY] : [opponentY, myY];
    this.context.beginPath();
    this.context.roundRect(
      radius * 2,
      yCoords[0],
      paddleH,
      paddleW,
      paddleH / 2,
    );
    this.context.roundRect(
      this.dimension.w - paddleH - radius * 2,
      yCoords[1],
      paddleH,
      paddleW,
      paddleH / 2,
    );
    this.context.fillStyle = '#99aad3';
    this.context.fill();
    this.context.closePath();
  }

  private drawScores() {
    this.context.fillStyle = '#ccadac';
    const scoresString = `${this.scores[0]}        ${this.scores[1]}`;
    this.context.fillText(
      scoresString,
      this.metaData.midX - this.context.measureText(scoresString).width / 2,
      parseFloat(this.context.font),
    );
  }

  private drawResult() {
    const { isPlayer, isLeft } = this.controllerType;
    this.context.clearRect(0, 0, this.dimension.w, this.dimension.h);
    this.context.fillStyle = '#ccadac';
    let resultString;
    resultString = isPlayer
      ? this.scores[isLeft ? 0 : 1] === 5
        ? 'You won!'
        : 'You lost...'
      : `${
          this.gameInfo.players[this.scores[0] > this.scores[1] ? 0 : 1]
        } won!`;
    this.context.fillText(
      resultString,
      this.metaData.midX - this.context.measureText(resultString).width / 2,
      this.metaData.midY,
    );
  }

  private accelerate() {
    let { dx, dy } = this.ballData;
    const { maxSpeed, acceleration } = this.metaData;
    if (dx < maxSpeed) {
      this.ballData.dx += dx > 0 ? acceleration : -acceleration;
    }
    if (dy < maxSpeed) {
      this.ballData.dy += dy > 0 ? acceleration : -acceleration;
    }
  }

  private resetBallData({
    xDirection,
    yDirection,
  }: {
    xDirection: 1 | -1;
    yDirection: 1 | -1;
  }) {
    return {
      x: this.metaData.midX,
      y: this.metaData.midY,
      dx: xDirection * this.metaData.initialSpeed,
      dy: yDirection * this.metaData.initialSpeed,
    };
  }
}
