
export class PatchItemsModel {
  public path: string;
  public value: string;
  public stagingValue: string = null;

  public getValue() {
    return this.value;
  }

  public getStagingValue() {
    let result = this.stagingValue;
    if (result === null) {
      result = this.value;
    }
    return result;
  }
}
