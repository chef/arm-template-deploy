import { Type } from "class-transformer";
import {PublishPackageAuthorization} from "./PublishPackageAuthorization";

export class PublishPackageModel {
  public version: string;

  public file: string;

  public tenantId: string;

  @Type(() => PublishPackageAuthorization)
  public authorizations: PublishPackageAuthorization[];
}
