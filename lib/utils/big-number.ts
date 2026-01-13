import Big from "big.js";

/**
 * BigNumber utility wrapper using big.js
 * Handles all big number operations for onchain integer values
 */

export class BigNumber {
  private value: Big;

  constructor(value: string | number | Big | BigNumber) {
    if (value instanceof BigNumber) {
      this.value = value.value;
    } else if (typeof value === "string" || typeof value === "number") {
      this.value = new Big(value);
    } else {
      this.value = value;
    }
  }

  static fromString(value: string): BigNumber {
    return new BigNumber(value);
  }

  static fromNumber(value: number): BigNumber {
    return new BigNumber(value);
  }

  static fromOnchain(value: string, decimals: number): BigNumber {
    const bigValue = new Big(value);
    const divisor = new Big(10).pow(decimals);
    return new BigNumber(bigValue.div(divisor).toString());
  }

  toOnchain(decimals: number): string {
    return this.value.times(new Big(10).pow(decimals)).toFixed(0);
  }

  toString(): string {
    return this.value.toString();
  }

  toNumber(): number {
    return this.value.toNumber();
  }

  toFixed(decimalPlaces: number): string {
    return this.value.toFixed(decimalPlaces);
  }

  plus(other: BigNumber | string | number): BigNumber {
    const otherBig = other instanceof BigNumber ? other.value : new Big(other);
    return new BigNumber(this.value.plus(otherBig));
  }

  minus(other: BigNumber | string | number): BigNumber {
    const otherBig = other instanceof BigNumber ? other.value : new Big(other);
    return new BigNumber(this.value.minus(otherBig));
  }

  times(other: BigNumber | string | number): BigNumber {
    const otherBig = other instanceof BigNumber ? other.value : new Big(other);
    return new BigNumber(this.value.times(otherBig));
  }

  div(other: BigNumber | string | number): BigNumber {
    const otherBig = other instanceof BigNumber ? other.value : new Big(other);
    return new BigNumber(this.value.div(otherBig));
  }

  pow(n: number): BigNumber {
    // big.js pow only supports integer exponents
    // For fractional exponents, use Math.pow on the number value
    if (Number.isInteger(n)) {
      return new BigNumber(this.value.pow(n));
    } else {
      const numValue = this.value.toNumber();
      return new BigNumber(Math.pow(numValue, n));
    }
  }

  gt(other: BigNumber | string | number): boolean {
    const otherBig = other instanceof BigNumber ? other.value : new Big(other);
    return this.value.gt(otherBig);
  }

  gte(other: BigNumber | string | number): boolean {
    const otherBig = other instanceof BigNumber ? other.value : new Big(other);
    return this.value.gte(otherBig);
  }

  lt(other: BigNumber | string | number): boolean {
    const otherBig = other instanceof BigNumber ? other.value : new Big(other);
    return this.value.lt(otherBig);
  }

  lte(other: BigNumber | string | number): boolean {
    const otherBig = other instanceof BigNumber ? other.value : new Big(other);
    return this.value.lte(otherBig);
  }

  eq(other: BigNumber | string | number): boolean {
    const otherBig = other instanceof BigNumber ? other.value : new Big(other);
    return this.value.eq(otherBig);
  }
}
