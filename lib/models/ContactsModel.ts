import { Type } from "class-transformer";

import { ContactModel } from "./ContactModel";

export class ContactsModel {
  @Type(() => ContactModel)
  public engineering: ContactModel;

  @Type(() => ContactModel)
  public support: ContactModel;
}
