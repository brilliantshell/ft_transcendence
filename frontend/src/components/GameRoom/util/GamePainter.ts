import { Subject } from 'rxjs';
import { GameMetaData, BallData, PaddlePositions } from './interfaces';

export class GamePainter {
  intervalId: number = 0;
  private readonly scores: [number, number] = [0, 0];
  private readonly subject: Subject<void> = new Subject();
  private metaData: GameMetaData;
  private ballData: BallData;
  private paddlePositions: PaddlePositions;
  private upPressed = false;
  private downPressed = false;

  constructor(
    private readonly isLeft: boolean,
    private readonly context: CanvasRenderingContext2D,
    private readonly dimension: { w: number; h: number },
  ) {
    this.context.font = '4rem DungGeunMo';
    this.metaData = new GameMetaData(dimension);
    const { midX, midY, initialSpeed, paddleW } = this.metaData;
    this.ballData = {
      x: midX,
      y: midY,
      dx: Math.random() < 0.5 ? -1 : 1 * initialSpeed,
      dy: Math.random() < 0.5 ? -1 : 1 * initialSpeed,
    };
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

  startGame() {
    this.subject.subscribe(() => {
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
    this.intervalId = setInterval(() => this.subject.next(), 10);
  }

  keyDownHandler(e: KeyboardEvent) {
    if (e.key === 'Up' || e.key === 'ArrowUp') {
      this.upPressed = true;
    } else if (e.key === 'Down' || e.key === 'ArrowDown') {
      this.downPressed = true;
    }
  }

  keyUpHandler(e: KeyboardEvent) {
    if (e.key === 'Up' || e.key === 'ArrowUp') {
      this.upPressed = false;
    } else if (e.key === 'Down' || e.key === 'ArrowDown') {
      this.downPressed = false;
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  private updateScore() {
    const { midX, midY } = this.metaData;
    this.scores[this.ballData.x > midX ? 0 : 1] += 1;
    this.ballData.x = midX;
    this.ballData.y = midY;
    clearInterval(this.intervalId);
    const { initialSpeed } = this.metaData;
    setTimeout(() => {
      this.ballData.dx = Math.random() < 0.5 ? -1 : 1 * initialSpeed;
      this.ballData.dy = Math.random() < 0.5 ? -1 : 1 * initialSpeed;
      if (this.scores[0] === 5 || this.scores[1] === 5) {
        this.drawResult();
      } else {
        this.intervalId = setInterval(() => this.subject.next(), 10);
      }
    }, 250);
  }

  private updatePaddlePosition() {
    const { myY } = this.paddlePositions;
    const { paddleW } = this.metaData;
    if (this.upPressed && myY > 0) {
      this.paddlePositions.myY = Math.max(myY - 8, 0);
    } else if (this.downPressed && myY < this.dimension.h - paddleW) {
      this.paddlePositions.myY = Math.min(myY + 8, this.dimension.h - paddleW);
    }
  }

  private updateBallData() {
    let { x, y, dx, dy } = this.ballData;
    const { boardEdges, paddleEnds, paddleW } = this.metaData;
    const { myY, opponentY } = this.paddlePositions;
    if (y + dy < boardEdges.top || y + dy > boardEdges.bottom) {
      this.ballData.dy = -dy;
    }
    const [leftY, rightY] = this.isLeft ? [myY, opponentY] : [opponentY, myY];
    const isPaddleTouched =
      (x > paddleEnds.left &&
        x + dx < paddleEnds.left &&
        y > leftY &&
        y < leftY + paddleW) ||
      (x < paddleEnds.right &&
        x + dx > paddleEnds.right &&
        y > rightY &&
        y < rightY + paddleW);
    if (isPaddleTouched) {
      this.ballData.dx = -dx;
      this.accelerate();
    }
    this.ballData.x += this.ballData.dx;
    this.ballData.y += this.ballData.dy;
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
    this.context.beginPath();
    this.context.roundRect(
      radius * 2,
      this.isLeft ? myY : opponentY,
      paddleH,
      paddleW,
      paddleH / 2,
    );
    this.context.roundRect(
      this.dimension.w - paddleH - radius * 2,
      this.isLeft ? opponentY : myY,
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
    this.context.clearRect(0, 0, this.dimension.w, this.dimension.h);
    this.context.fillStyle = '#ccadac';
    const myScore = this.isLeft ? this.scores[0] : this.scores[1];
    const resultString = myScore === 5 ? 'You won!' : 'You lost...';
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
}
