import { DateTime } from 'luxon';
import { FindOperator, ValueTransformer } from 'typeorm';

export class DateTimeTransformer implements ValueTransformer {
  to(data: DateTime | 'epoch'): Date | 'epoch' {
    if (data instanceof FindOperator) {
      return new FindOperator<DateTime>(
        data.type,
        data.value.toJSDate(),
        data.useParameter,
        data.multipleParameters,
        data.getSql,
        data.objectLiteralParameters,
      ) as any;
    }
    return data === 'epoch' ? 'epoch' : data.toJSDate();
  }

  from(data: Date | 'epoch'): DateTime {
    return data === 'epoch'
      ? DateTime.fromMillis(0)
      : DateTime.fromJSDate(data);
  }
}
