import {
  BallCoordinates,
  ControllerType,
  GameDataMessage,
  GameInfo,
  GameMetaData,
  PaddlePositions,
  Score,
} from './interfaces';
import { socket } from '../../../util/Socket';

export class GamePainter {
  private readonly metaData: GameMetaData;

  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly gameInfo: GameInfo,
    private readonly controllerType: ControllerType,
    private readonly dimension: { w: number; h: number },
  ) {
    this.context.font = '4rem DungGeunMo';
    this.metaData = new GameMetaData(dimension);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  drawGame() {
    socket.on(
      'gameData',
      ({ ballCoords, paddlePositions, scores }: GameDataMessage) => {
        this.context.clearRect(0, 0, this.dimension.w, this.dimension.h);
        this.drawLine();
        this.drawBall(ballCoords);
        this.drawPaddles(paddlePositions);
        this.drawScores(scores);
      },
    );
    socket.once(
      'gameComplete',
      ({ winnerSide }: { winnerSide: 'left' | 'right' }) => {
        socket.off('gameData');
        this.drawResult(winnerSide);
      },
    );
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  private drawLine() {
    const { midX } = this.metaData;
    this.context.beginPath();
    this.context.moveTo(midX, 0);
    this.context.setLineDash([10, 15]);
    this.context.lineTo(midX, this.dimension.h);
    this.context.stroke();
  }

  private drawBall(ballCoords: BallCoordinates) {
    const { x, y } = ballCoords;
    const { w, h } = this.dimension;
    this.context.beginPath();
    this.context.arc(x * w, y * h, this.metaData.radius, 0, Math.PI * 2);
    this.context.fillStyle = '#ccadac';
    this.context.fill();
    this.context.closePath();
  }

  private drawPaddles(paddlePositions: PaddlePositions) {
    const { h } = this.dimension;
    const { radius, paddleW, paddleH } = this.metaData;
    const { leftY, rightY } = paddlePositions;
    this.context.beginPath();
    this.context.roundRect(
      radius * 2,
      leftY * h,
      paddleH,
      paddleW,
      paddleH / 2,
    );
    this.context.roundRect(
      this.dimension.w - paddleH - radius * 2,
      rightY * h,
      paddleH,
      paddleW,
      paddleH / 2,
    );
    this.context.fillStyle = '#99aad3';
    this.context.fill();
    this.context.closePath();
  }

  private drawScores(scores: [Score, Score]) {
    this.context.fillStyle = '#ccadac';
    const scoresString = `${scores[0]}        ${scores[1]}`;
    this.context.fillText(
      scoresString,
      this.metaData.midX - this.context.measureText(scoresString).width / 2,
      parseFloat(this.context.font),
    );
  }

  private drawResult(winnerSide: 'left' | 'right') {
    const { isPlayer, isLeft } = this.controllerType;
    this.context.clearRect(0, 0, this.dimension.w, this.dimension.h);
    this.context.fillStyle = '#ccadac';
    let resultString;
    const messages = isLeft
      ? ['You won!', 'You lost...']
      : ['You lost...', 'You won!'];
    resultString = isPlayer
      ? messages[winnerSide === 'left' ? 0 : 1]
      : `${this.gameInfo.players[winnerSide === 'left' ? 0 : 1]} won!`;
    this.context.fillText(
      resultString,
      this.metaData.midX - this.context.measureText(resultString).width / 2,
      this.metaData.midY,
    );
  }
}
