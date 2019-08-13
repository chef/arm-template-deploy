import { Type } from "class-transformer";
import { PatchItemsModel } from "./PatchItemsModel";

export class PatchModel {
  public fileName: string;

  @Type(() => PatchItemsModel)
  public items: PatchItemsModel[];

  public remove: boolean = false;
}
