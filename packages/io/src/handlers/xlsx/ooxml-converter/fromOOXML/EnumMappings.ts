
export class EnumMappings {

  EnumMappings() {
  }

  static fromOoxmlGradientType(type: string): string {
    if ("circle" === type)
      return "radial";
    return type;
  }

  static fromOoxmlLineCap(value: string): string {
    if ("rnd" === value) {
      return "round";
    } else if ("flat" === value) {
      return "butt";
    } else if ("sq" === value) {
      return "square";
    }
    throw new Error("Invalid lineCap type: " + value);
  }

  static fromOoxmlCompound(value: string): string {
    if ("sng" === value) {
      return "single";
    }
    return value;
  }

  static fromOoxmlAlignment(value: string): string {
    if ("ctr" === value) {
        return "center";
    }
    return value;
  }
}
