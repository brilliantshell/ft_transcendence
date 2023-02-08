import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const RANGE_REGEX = /^(0|[1-9]\d{0,9}),[1-9]\d{0,9}$/;
const OFFSET_MAX = 2147483647;
const LIMIT_MAX = 10000;

@Injectable()
export class ValidateRangePipe
  implements PipeTransform<string, Promise<[offset: number, limit: number]>>
{
  async transform(value: string) {
    if (!RANGE_REGEX.test(value)) {
      throw new BadRequestException(
        'The range must be in the format of "offset,limit"',
      );
    }
    const [offset, limit] = value.split(',');
    return [
      this.validateNumberInRange(offset, OFFSET_MAX),
      this.validateNumberInRange(limit, LIMIT_MAX),
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
