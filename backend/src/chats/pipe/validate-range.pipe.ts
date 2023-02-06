import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ValidateRangePipe
  implements PipeTransform<string, Promise<[offset: number, limit: number]>>
{
  private readonly MESSAGE_OFFSET_MAX = 2147483647;
  private readonly MESSAGE_LIMIT_MAX = 10000;

  async transform(value: string) {
    if (
      typeof value !== 'string' ||
      !/^(0|[1-9]\d{0,9}),[1-9]\d{0,9}$/.test(value)
    ) {
      throw new BadRequestException(
        'The range must be in the format of "offset,limit"',
      );
    }
    const [offset, limit] = value.split(',');
    return [
      this.validateNumberInRange(offset, this.MESSAGE_OFFSET_MAX),
      this.validateNumberInRange(limit, this.MESSAGE_LIMIT_MAX),
    ] as [number, number];
  }

  private validateNumberInRange(value: string, max: number): number {
    const integer = Math.floor(Number(value));
    if (integer > max) {
      throw new BadRequestException(`The range must be between 0 and ${max}`);
    }
    return integer;
  }
}
