import { DateTime } from 'luxon';
import { ValueTransformer } from 'typeorm';

export class DateTimeTransformer implements ValueTransformer {
  to(data: DateTime | 'epoch'): Date | 'epoch' {
    return data === 'epoch' ? 'epoch' : data.toJSDate();
  }

  from(data: Date | 'epoch'): DateTime {
    return data === 'epoch'
      ? DateTime.fromMillis(0)
      : DateTime.fromJSDate(data);
  }
}
