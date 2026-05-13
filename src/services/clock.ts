export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  constructor(private value: Date) {}
  now(): Date {
    return this.value;
  }
  set(value: Date): void {
    this.value = value;
  }
  advance(ms: number): void {
    this.value = new Date(this.value.getTime() + ms);
  }
}
