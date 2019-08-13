import { Exclude } from "class-transformer";
import { isAbsolute, join as pathJoin } from "path";

export class DirModel {
  public build: string = "build";
  public working: string = "working";
  public output: string = "output";

  @Exclude()
  public controlFile: string;

  @Exclude()
  public appRoot: string;

  @Exclude()
  public production: string;

  @Exclude()
  public staging: string;

  public GetWorkingDir() {
    let result = this.working;
    if (!isAbsolute(result)) {
      result = pathJoin(this.build, result);
    }
    return result;
  }
}
