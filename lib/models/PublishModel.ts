import { Type } from "class-transformer";
import { ContactsModel } from "./ContactsModel";
import { LogosModel } from "./LogosModel";
import { OfferModel } from "./OfferModel";
import { PlanModel } from "./PlanModel";
import { SAModel } from "./SAModel";
import { UrlsModel } from "./UrlsModel";

export class PublishModel {
  public display: string;
  public description: string;
  public summary: string;
  public longSummary: string;
  public termsOfUse: string;
  public publisher: string;

  @Type(() => OfferModel)
  public offer: OfferModel;

  // State the categories that the package is applicable to in the Cloud Partner portal
  public categories: [];

  // Which subscription are permitted to see the preview of the offer
  public subscriptions: [];

  // An array of paths to screenshots that should be uploaded
  public screenshots: [];
  public videos: [];

  public usefulLinks: [];

  // Who are the contacts that will be set on the offer
  @Type(() => ContactsModel)
  public contacts: ContactsModel;

  // Specify the logos that need to be uploaded and then referenced
  // These should be paths to assets on the local machine which are uploaded
  @Type(() => LogosModel)
  public logos: LogosModel;

  @Type(() => UrlsModel)
  public urls: UrlsModel;

  @Type(() => PlanModel)
  public plans: PlanModel[];

  // Set the object for the storage account
  @Type(() => SAModel)
  public storageAccount: SAModel;
}
