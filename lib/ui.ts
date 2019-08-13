
import { existsSync, readFileSync } from "fs-extra";
import * as Github from "github-base";
import { homedir } from "os";
import { basename, isAbsolute, join as pathJoin } from "path";
import { sprintf } from "sprintf-js";

import { Utils } from "./utils";

export class UI {

  private utils: Utils;

  constructor(utils: Utils) {
    this.utils = utils;
  }

  /**
   * Processes the options that have been specified on the command line
   *
   * @param action string The action that is to be performed. Nothing means all the options
   * @param config Config, the configuration object
   */
  public async process(filePath: string) {

    const filesKey = "files";

    // if the file is not absolute prepend the current DIR to it
    if (!isAbsolute(filePath)) {
      filePath = pathJoin(process.cwd(), filePath);
    }

    // if the file can be found then upload to Gist and return the
    // URL to access it in the Azure portal
    if (existsSync(filePath)) {

      // attempt to find the gist token file in the user's home directory
      let gistPath = pathJoin(homedir(), ".gist");

      // if the file exist, read it on
      if (existsSync(gistPath)) {
        // read in the token from the gile
        let token = readFileSync(gistPath, "utf8").trim();
        let filename = basename(filePath);
        let content = readFileSync(filePath, "utf8");

        // create a gist object
        let gh = new Github({
          token,
        });

        // Configure the options with the payload to be sent to Github
        let options = {
          files: {},
        };
        options[filesKey][filename] = {
          content,
        };

        this.utils.log("Uploading file: %s", filename, "debug");
        let result = await gh.post("/gists", options).then((res) => {
          return res;
        });

        // Use the output URL and embed into the correct format to test in Azure
        let rawUrl = result.body.files[filename].raw_url;
        let encodedUrl = encodeURIComponent(rawUrl);

        // tslint:disable-next-line
        let testUrl = sprintf("https://portal.azure.com/?clientOptimizations=false#blade/Microsoft_Azure_Compute/CreateMultiVmWizardBlade/internal_bladeCallId/anything/internal_bladeCallerParams/{\"initialData\":{},\"providerConfig\":{\"createUiDefinition\":\"%s\"}}", encodedUrl);

        // Output the URL to the console
        this.utils.log("Gist URL: %s", rawUrl, "debug");
        console.log(testUrl);
      }
    }
  }
}
