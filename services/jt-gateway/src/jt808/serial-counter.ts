export class SerialCounter {
  private value = 0;

  next(): number {
    this.value = (this.value + 1) & 0xffff;
    if (this.value === 0) this.value = 1;
    return this.value;
  }
}
