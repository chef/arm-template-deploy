
import { ControlFile } from "./models/ControlFile";
import { Utils } from "./utils";

import { createBlobService } from "azure-storage";
import { deserialize, serialize } from "class-transformer";
import { lstatSync, readdirSync, readFileSync, writeFileSync } from "fs-extra";

import { join as pathJoin } from "path";
import { sprintf } from "sprintf-js";

export class Deploy {
  private utils;

  constructor(utils: Utils) {
    this.utils = utils;
  }

  public async process(actionsString: string) {
    this.utils.log("Starting deployment process");

    // Turn the actions into an array
    let actions = [];
    if (actionsString !== undefined) {
      actions = actionsString.split(",");
    }

    // based on the action that has been passed perform the most appropriate operation
    if (actions.length === 0 || actions.indexOf("upload") > -1) {
      await this.upload();
    }

    if (actions.length === 0 || actions.indexOf("deploy") > -1) {
      await this.deploy();
    }
  }

  private async upload() {
    this.utils.log("Uploading files to Blob storage");

    // create the necessary clients
    this.utils.log("Creating Storage management client", [], "debug");
    let smClient = this.utils.getAzureClient("storage", "deploy");

    this.utils.log("Creating Resource management client", [], "debug");
    let rmClient = this.utils.getAzureClient("resource", "deploy");

    // Perform some checks to ensure that all the resources exist
    // - Resource Group
    let rgExists = await rmClient.resourceGroups.checkExistence(
      this.utils.config.deploy.storageAccount.groupName,
    );
    this.utils.log("SA Resource Group '%s' exists: %s",
      [
        this.utils.config.deploy.storageAccount.groupName,
        rgExists,
      ],
    );

    // - Storage Account
    let saExists = await this.utils.checkStorageAccountExists(smClient, "deploy");
    this.utils.log("SA account '%s' exists: %s", [this.utils.config.deploy.storageAccount.name, saExists]);

    // - Container
    let containerExists = await this.utils.checkContainerExists(smClient, "deploy");
    this.utils.log("Container '%s' exists: %s",
      [
        this.utils.config.deploy.storageAccount.containerName,
        containerExists,
      ],
    );

    // If all of the resources exist then perform the upload
    if (rgExists && saExists && containerExists) {

      // Get the eys from the storage account and create a blob service object to do the upload
      let saKeys = await smClient.storageAccounts.listKeys(
        this.utils.config.deploy.storageAccount.groupName,
        this.utils.config.deploy.storageAccount.name,
        this.utils.config.deploy.storageAccount.containerName);
      let blobService = createBlobService(this.utils.config.deploy.storageAccount.name, saKeys.keys[0].value);

      // Get a list of all the files to be uploaded
      let items = this.listDir(this.utils.config.getWorkingDir());

      // iterate around all the files
      let stats;
      let name;
      for (let item of items) {

        // continue onto the next item if this is a directory
        stats = lstatSync(item);
        if (stats.isDirectory()) {
          continue;
        }

        // the item is a file so ensure that any path separators are correct
        // this is so that the module works cross platform
        name = item.replace(/\\/g, "/");

        // Perform some checks so that the whole name is correct when uploaded
        let stringToCheck = this.utils.config.getWorkingDir().replace(/\\/g, "/");
        if (stringToCheck.endsWith("/") === false) {
          stringToCheck += "/";
        }
        name = name.replace(stringToCheck, "");

        // Upload the item
        blobService.createAppendBlobFromLocalFile(
          this.utils.config.deploy.storageAccount.containerName,
          name,
          item,
          {},
          (error, result) => {
            if (error) {
              this.utils.log("Failed to upload - %s: %s", [item, Utils.getError(error)] , "error", 1);
            } else {
              this.utils.log("Successful upload: %s", result.name);
            }
          },
        );
      }
    }
  }

  private async deploy() {
    // Read in the controlFile to determine the resource group to create
    let controlFileRaw = readFileSync(this.utils.config.dirs.controlFile, "utf8");
    let controlFile = deserialize(ControlFile, controlFileRaw);

    this.utils.log("Creating Resource management client", [], "debug");
    let rmClient = this.utils.getAzureClient("resource", "deploy");

    // Determine the name of what would be the previous resource group
    let rgNamePrevious = sprintf("%s-%s",
      this.utils.config.deploy.resourceGroup.name,
      controlFile[this.utils.config.deploy.resourceGroup.name].iteration,
    );

    let rgExists = await rmClient.resourceGroups.checkExistence(
      rgNamePrevious,
    );

    // If the rgExists, remove it
    if (rgExists) {
      if (this.utils.config.deploy.delete) {
        this.utils.log("Removing previous resource group: %s", rgNamePrevious);
        rmClient.resourceGroups.deleteMethod(rgNamePrevious, (error) => {
          if (error) {
            this.utils.log("Failed to delete the resource group: %s", Utils.getError(error), "error", 3);
          }
        });
      } else {
        this.utils.log("Not removing previous resource group: %s", rgNamePrevious);
      }
    } else {
      this.utils.log("Previous resource group does not exist: %s", rgNamePrevious);
    }

    // Determine the number of the next iteration
    // - use this to create the new RG
    // - and update the controlfile
    controlFile[this.utils.config.deploy.resourceGroup.name].iteration += 1;
    let rgNameNext = sprintf("%s-%s",
      this.utils.config.deploy.resourceGroup.name,
      controlFile[this.utils.config.deploy.resourceGroup.name].iteration,
    );
    writeFileSync(this.utils.config.dirs.controlFile, serialize(controlFile), "utf8");

    this.utils.log("Creating Resource Group: %s (%s)",
      [
        rgNameNext,
        this.utils.config.deploy.resourceGroup.location,
      ],
    );

    // Create parameters for the resource group to be created
    let parameters = {
      location: this.utils.config.deploy.resourceGroup.location,
      name: rgNameNext,
    };

    await rmClient.resourceGroups.createOrUpdate(rgNameNext, parameters, (error) => {
      if (error) {
        this.utils.log("Failed to create the resource group. %s", Utils.getError(error), "error");
      }
    });

    // wait for the system to be able to find the resource group
    // even though it is being waited on the deployment does not seem to be able to find it
    let threshold = 0;
    do {
      rgExists = await rmClient.resourceGroups.checkExistence(
        rgNameNext,
      );
      Utils.sleep(1000);
      threshold += 1;
    } while (!rgExists || threshold >= 5);

    // Read in the parmeters file, if it exists
    let templateParameters = {
      parameters: {},
    };
    if (this.utils.config.deploy.parametersFile) {
      templateParameters = JSON.parse(
        readFileSync(this.utils.config.deploy.parametersFile, "utf8"),
      );
    }

    let templateUri = sprintf("https://%s.blob.core.windows.net/%s/%s",
      this.utils.config.deploy.storageAccount.name,
      this.utils.config.deploy.storageAccount.containerName,
      this.utils.config.deploy.templateFile,
    );

    this.utils.log("Deploying template: %s", templateUri);

    // create the deployment parameters hash
    let deploymentParameters = {
      properties: {
        mode: "Incremental",
        parameters: templateParameters.parameters,
        templateLink: {
          uri: templateUri,
        },
      },
    };

    // Create a deployment name
    let dateNow = new Date().toISOString().replace(/-|T.*/g, "");
    let deploymentName = sprintf("%s-%s", rgNameNext.toLocaleLowerCase(), dateNow);

    await rmClient.deployments.createOrUpdate(
      rgNameNext,
      deploymentName,
      deploymentParameters,
      (error) => {
        if (error) {
          this.utils.log("Failed to deploy the template: %s", Utils.getError(error), "error");
        }
      },
    );
  }

  private listDir(path) {
    let list = [];
    let files = readdirSync(path);
    let stats;

    files.forEach((file) => {
      stats = lstatSync(pathJoin(path, file));
      if (stats.isDirectory()) {
        list = list.concat(this.listDir(pathJoin(path, file)));
      } else {
        list.push(pathJoin(path, file));
      }
    });

    return list;
  }
}
