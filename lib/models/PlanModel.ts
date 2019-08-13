import { Type } from "class-transformer";
import { MonthlyPricingModel } from "./MonthlyPricingModel";
import { PublishPackageModel } from "./PublishPackageModel";
import { SkuModel } from "./SkuModel";

export class PlanModel {
  public id: string;

  public availability: [];

  public regions: [];

  public governmentCertifications: [];

  @Type(() => SkuModel)
  public sku: SkuModel;

  @Type(() => MonthlyPricingModel)
  public monthlyPricing: MonthlyPricingModel;

  @Type(() => MonthlyPricingModel)
  public monthlyPricingV2: MonthlyPricingModel;

  @Type(() => PublishPackageModel)
  public package: PublishPackageModel;
}
