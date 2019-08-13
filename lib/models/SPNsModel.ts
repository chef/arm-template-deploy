import { Type } from "class-transformer";
import { SPNModel } from "./SPNModel";

export class SPNsModel {
  @Type(() => SPNModel)
  public deploy: SPNModel;

  @Type(() => SPNModel)
  public upload: SPNModel;

  @Type(() => SPNModel)
  public publish: SPNModel;
}
