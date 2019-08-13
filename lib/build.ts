/**
 * Library to handle the build of the ARM template
 *
 * @author Russell Seymour
 */

import {
  copySync,
  ensureDirSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs-extra";
import { basename, isAbsolute, join as pathJoin } from "path";
import { sync as rimrafSync } from "rimraf";
import { sprintf } from "sprintf-js";
import * as zip from "zip-folder";

import { Utils } from "./utils";

export class Build {

  private utils;

  constructor(utils: Utils) {
    this.utils = utils;
  }

  /**
   * Processes the options that have been specified on the command line
   *
   * @param action string The action that is to be performed. Nothing means all the options
   * @param config Config, the configuration object
   */
  public process(actionsString: string) {
    this.utils.log("Starting the build process");

    // turn the action string into an array
    let actions = [];
    if (actionsString !== undefined) {
      actions = actionsString.split(",");
    }

    // based on the command that has been passed determine the actions to take
    // if the command is null then all the actions should be undertaken
    // Initialisation
    if (actions.length === 0 || actions.indexOf("init") > -1) {
      this.init();
    }

    // Copy
    if (actions.length === 0 || actions.indexOf("copy") > -1) {
      this.copy();
    }

    // Patch
    if (actions.length === 0 || actions.indexOf("patch") > -1) {
      this.patch();
    }

    // Create staging files
    if ((actions.length === 0 || actions.indexOf("staging") > -1) && this.utils.config.build.dual) {
      this.staging();
    }

    // Create package of the working directory
    if (actions.length === 0 || actions.indexOf("package") > -1) {
      this.packageFiles();
    }

  }

  private init() {
    this.utils.log("Initialising the build");

    // if the option to clean the build dir has been set, delete it
    if (this.utils.config.build.clean && existsSync(this.utils.config.getBuildDir())) {
      this.utils.log("Removing build folder: %s", this.utils.config.getBuildDir(), "warn");
      rimrafSync(this.utils.config.getBuildDir());
    }

    // Create the necessary directories if they do not exist
    if (!existsSync(this.utils.config.getWorkingDir())) {
      this.utils.log("Creating working folder: %s", this.utils.config.getWorkingDir());
      ensureDirSync(this.utils.config.getWorkingDir());
    }

    if (!existsSync(this.utils.config.dirs.output)) {
      this.utils.log("Creating output folder: %s", this.utils.config.dirs.output);
      ensureDirSync(this.utils.config.dirs.output);
    }

    // if the dual build mode has been enabled create the working directories
    if (this.utils.config.build.dual) {
      this.utils.log("Creating dual build working directories");
      ensureDirSync(this.utils.config.dirs.production);
      ensureDirSync(this.utils.config.dirs.staging);
    }
  }

  private copy() {
    // initialise method variables
    let source = "";
    let target = "";

    this.utils.log("Copying files");

    // iterate around the source files
    for (let projectFile of this.utils.config.build.files) {

      // get the source and target
      source = projectFile.source;
      target = projectFile.target;

      // ensure that the source and target are absolute values
      if (!isAbsolute(source)) {
        source = pathJoin(this.utils.config.getAppRoot(), source);
      }

      if (!isAbsolute(target)) {
        if (this.utils.config.build.dual) {
          target = pathJoin(this.utils.config.dirs.production, target);
        } else {
          target = pathJoin(this.utils.config.dirs.working, target);
        }
      }

      // ensure that the source file can be located, if it can;t throw a warning
      // and continue to the next file
      if (!existsSync(source)) {
        this.utils.log("Cannot find source file: %s", source, "warn");
        continue;
      }

      // check to see if the source is a directory, if so ensure that the target exists
      if (statSync(source).isDirectory()) {
        this.utils.log("Creating target directory: %s", target);
        ensureDirSync(target);
      }

      // if the source is a file then ensure that the target is as well
      // if the target is a directory, append the file to it
      if (statSync(source).isFile() && statSync(target).isDirectory()) {
        target = pathJoin(target, basename(source));
      }

      this.utils.log("Copying: %s -> %s", [source, target]);
      copySync(source, target);

    }
  }

  private getPath(path: string, baseType: string, dualType: string = "production") {
    // create result variable to return
    let result;

    if (!isAbsolute(path)) {
      switch (baseType) {
      case "working": {
        if (this.utils.config.build.dual) {
          if (dualType === "production") {
            result = pathJoin(this.utils.config.dirs.production, path);
          } else {
            result = pathJoin(this.utils.config.dirs.staging, path);
          }
        } else {
          result = pathJoin(this.utils.config.dirs.working, path);
        }

        break;
      }

      case "root": {
        result = pathJoin(this.utils.config.dirs.appRoot, path);
        break;
      }
      }
    }

    // check that the file can be located
    if (!existsSync(result)) {
      this.utils.log("Unable to find template file: %s", result, "warn");

      // if the environment is a Azure Devops output the message as a log entry
      // @TODO
      result = false;
    }

    return result;
  }

  private patch() {

    // Declare constants for accessing the ARM template files
    const resourcesKey = "resources";
    const propertiesKey = "properties";
    const filesKey = "files";
    const configKey = "config";

    this.utils.log("Patching template files");

    // iterate around the functions
    for (let functionDetail of this.utils.config.build.functions) {

      // determine the full path to the function file that has to be patched
      let templateFilePath = this.getPath(functionDetail.templateFile, "working");

      // determine the full path to the funcftion configuration file
      let functionConfigurationFile = this.getPath(functionDetail.config, "root");

      // only proceed if these two files exist
      if (templateFilePath && functionConfigurationFile) {

        this.utils.log(templateFilePath, [], "debug");

        let base64Files = {};

        // read the configuration file in
        let functionConfiguration = JSON.parse(readFileSync(functionConfigurationFile, "utf8"));

        // determine the path to the code files
        let codeFilesDir = this.getPath(functionDetail.codeFilesDir, "root");

        // get all the specified file types in this directory
        let codeFiles = readdirSync(codeFilesDir);

        if (codeFiles) {
          for (let codeFile of codeFiles) {
            let filePath = pathJoin(codeFilesDir, codeFile);

            // ensure that the codefile is one that should be included
            if (codeFile !== "function.json") {

              this.utils.log("Code File: %s", filePath, "debug");

              // get the basename of the file, this will be used as the key in the files object
              let filename = basename(filePath);

              base64Files[filename] = sprintf("[base64ToString('%s')]",
                Buffer.from(readFileSync(filePath, "utf8"))
                  .toString("base64"));
            }
          }
        }

        // read in the template file so that it can be modified
        let template = JSON.parse(readFileSync(templateFilePath, "utf8"));

        // patch the named resource
        let resource = template[resourcesKey].filter((item) => item.name === functionDetail.resourceName)[0];

        if (resource) {

          // iterate around the base64Files and add each one
          // this is to preserve files that may have been added
          for (let filename in base64Files) {
            if (filename != null) {
              resource[propertiesKey][filesKey][filename] = base64Files[filename];
            }
          }
          // resource[propertiesKey][filesKey] = base64Files;
          resource[propertiesKey][configKey] = functionConfiguration;
        }

        // write out the template file
        writeFileSync(templateFilePath, JSON.stringify(template, null, 4), "utf8");
      }
    }

    this.patchParameters("production");
  }

  private staging() {
    this.utils.log("Creating staging files");

    // Copy the production files into the staging folder
    copySync(this.utils.config.dirs.production, this.utils.config.dirs.staging);

    // patch the specific parameters for staging
    this.patchParameters("staging");
  }

  private packageFiles() {
    this.utils.log("Packaging files");

    // initialise method variables
    let nightlyFlag = "";
    let branchFlag = "local";
    let foldersToPackage = {};
    let zipFilename = null;

    const stagingKey = "staging";
    const productionKey = "production";
    const singleKey = "single";

    // detect if running a scheduled build
    let nightly = this.utils.config.build.getDetectType("nightlyBuild");
    if (nightly && process.env[nightly.name] && process.env[nightly.name].toLocaleLowerCase() === nightly.value) {
      nightlyFlag = "-nightly";
    }

    // get the branch name of the repo
    let branch = this.utils.config.build.getDetectType("sourceBranch");
    if (branch && process.env[branch.name]) {
      branchFlag = process.env[branch.name].toLocaleLowerCase();
    }

    // determine the folders that need to be packaged, based on whether this is a single or dual build
    if (this.utils.config.build.dual) {
      foldersToPackage[stagingKey] = this.utils.config.dirs.staging;
      foldersToPackage[productionKey] = this.utils.config.dirs.production;
    } else {
      foldersToPackage[singleKey] = this.utils.config.dirs.GetWorkingDir();
    }

    // iterate around the folders and package each one up
    for (let dualType in foldersToPackage) {
      if (dualType != null) {
        if (foldersToPackage.hasOwnProperty(dualType)) {
          // Determine the filename of the zip file
          if (dualType === "single") {
            zipFilename = sprintf("%s-%s%s-%s.zip",
              this.utils.config.build.package.name,
              this.utils.config.build.version,
              nightlyFlag,
              branchFlag);

          } else {
            zipFilename = sprintf("%s-%s%s-%s-%s.zip",
              this.utils.config.build.package.name,
              this.utils.config.build.version,
              nightlyFlag,
              branchFlag,
              dualType);
          }
        }

        // determine the full path to the target zipfile
        let zipFilePath = pathJoin(this.utils.config.dirs.output, zipFilename);

        zip(foldersToPackage[dualType], zipFilePath, (err) => {
          if (err) {
            this.utils.log("Packaging failed: %s", err, "error");
          } else {
            this.utils.log("Packaging successful: %s", zipFilePath);

            // get a list of the files that need to be removed from the working directory
            let filesToRemove = this.utils.config.build.getRemoveItems();

            // iterate around the files to remove
            for (let fileToRemove of filesToRemove) {
              let path = pathJoin(foldersToPackage[dualType], fileToRemove.fileName);

              if (existsSync(path)) {
                this.utils.log("Removing file: %s", path, "warn");
                unlinkSync(path);
              }
            }
          }
        });
      }
    }
  }

  private patchParameters(dualType: string) {
    // Iterate around the patch object, performing the necessary patches according to the configuration
    for (let patchDetail of this.utils.config.build.patch) {

      // find the file that needs to be patched
      let filePath = this.getPath(patchDetail.fileName, "working", dualType);

      if (filePath) {
        this.utils.log("Patching Parameters in file: %s", filePath);

        // Read in the template to be patched
        let patchFile = JSON.parse(readFileSync(filePath, "utf8"));

        // iterate around all the items that need to be patched
        for (let patchItem of patchDetail.items) {

          // set the value to be used. Check if an environment var is the value
          let value = null;

          if (dualType === "production") {
            value = patchItem.getValue();
          } else {
            value = patchItem.getStagingValue();
          }

          const [type, name] = value.split("\.");
          if (type === "ENV") {
            value = process.env[name];
          }

          this.utils.log("%s : \"%s\"", [patchItem.path, value], "debug");
          this.setIndex(patchFile, patchItem.path, value);
        }

        // save the file
        writeFileSync(filePath, JSON.stringify(patchFile, null, 4), "utf8");
      }
    }
  }

  private setIndex(obj, is, value) {
    if (typeof is === "string") {
      return this.setIndex(obj, is.split("."), value);
    } else if (is.length === 1 && value !== undefined) {
      return obj[is[0]] = value;
    } else if (is.length === 0) {
      return obj;
    } else {
      return this.setIndex(obj[is[0]], is.slice(1), value);
    }
  }
}
