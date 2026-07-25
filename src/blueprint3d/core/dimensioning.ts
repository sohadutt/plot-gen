import { Configuration, configDimUnit } from './configuration'

/** Dimensioning in Inch. */
export const dimInch: string = 'inch'

/** Dimensioning in Meter. */
export const dimMeter: string = 'm'

/** Dimensioning in Centi Meter. */
export const dimCentiMeter: string = 'cm'

/** Dimensioning in Milli Meter. */
export const dimMilliMeter: string = 'mm'

/** Dimensioning functions. */
export class Dimensioning {
  /** Converts cm to dimensioning string.
   * @param cm Centi meter value to be converted.
   * @returns String representation.
   */
  public static cmToMeasure(cm: number): string {
    switch (Configuration.getStringValue(configDimUnit)) {
      case dimInch:
        const realFeet = (cm * 0.3937) / 12
        const feet = Math.floor(realFeet)
        const inches = Math.round((realFeet - feet) * 12)
        return feet + "'" + inches + '"'
      case dimMilliMeter:
        return '' + Math.round(10 * cm) + ' mm'
      case dimCentiMeter:
        return '' + Math.round(10 * cm) / 10 + ' cm'
      case dimMeter:
      default:
        return '' + Math.round(10 * cm) / 1000 + ' m'
    }
  }

  /** Converts a cm² area to a dimensioning string — square feet for inch, square
   * meters otherwise (mm/cm areas aren't a normal unit people reach for). */
  public static cmSquaredToAreaMeasure(cm2: number): string {
    if (Configuration.getStringValue(configDimUnit) === dimInch) {
      const sqFt = cm2 / 929.0304
      return `${sqFt < 10 ? sqFt.toFixed(1) : Math.round(sqFt)} ft²`
    }
    const sqM = cm2 / 10000
    return `${sqM < 10 ? sqM.toFixed(1) : Math.round(sqM)} m²`
  }
}
