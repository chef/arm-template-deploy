import { Type } from "class-transformer";
import { MultiplierModel } from "./MultiplierModel";

export class MonthlyPricingModel {
  @Type(() => MultiplierModel)
  public multiplier: MultiplierModel;
}
