import { Type } from "class-transformer";

import { DetectModel } from "./DetectModel";
import { FunctionModel } from "./FunctionModel";
import { PackageModel } from "./PackageModel";
import { PatchModel } from "./PatchModel";
import { SourceFilesModel } from "./SourceFilesModel";

export class BuildModel {
  public clean: boolean = false;
  public dual: boolean = false;

  public version: string;

  @Type(() => SourceFilesModel)
  public files: SourceFilesModel[];

  @Type(() => FunctionModel)
  public functions: FunctionModel[];

  @Type(() => PackageModel)
  public package: PackageModel;

  @Type(() => PatchModel)
  public patch: PatchModel[];

  @Type(() => DetectModel)
  public detect: DetectModel[];

  public getSourceFilesCount() {
    return this.files.length;
  }

  public getDetectType(name: string) {
    // attempt to get the Detect using the name of the type
    let result = this.detect.filter((item) => item.type === name)[0];

    return result;
  }

  public getRemoveItems() {
    // attempt to get the Detect using the name of the type
    let result = this.patch.filter((item) => item.remove === true);

    return result;
  }
}
