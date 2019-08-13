import { Exclude, Type } from "class-transformer";

import { ResourceGroupModel } from "./ResourceGroupModel";
import { SAModel } from "./SAModel";

export class DeployModel {

  @Exclude()
  public subscription: string;

  @Exclude()
  public parametersFile: string;

  @Exclude()
  public delete: boolean;

  public templateFile: string;

  @Type(() => ResourceGroupModel)
  public resourceGroup: ResourceGroupModel;

  @Type(() => SAModel)
  public storageAccount: SAModel;
}
