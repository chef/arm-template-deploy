/**
 * Configuration file model
 */

import { Exclude, Type } from "class-transformer";
import { existsSync, readFileSync, writeFileSync } from "fs-extra";
import { parse as iniParse } from "ini";
import { dirname, isAbsolute, join as pathJoin } from "path";

import { BuildModel } from "./BuildModel";
import { DeployModel } from "./DeployModel";
import { DirModel } from "./DirModel";
import { PublishModel } from "./PublishModel";
import { SPNModel } from "./SPNModel";
import { SPNsModel } from "./SPNsModel";

export class ConfigModel {
  @Type(() => DirModel)
  public dirs: DirModel;

  @Type(() => BuildModel)
  public build: BuildModel;

  @Type(() => DeployModel)
  public deploy: DeployModel;

  @Type(() => PublishModel)
  public publish: PublishModel;

  @Exclude()
  public credentialsFile: string;

  @Exclude()
  @Type(() => SPNsModel)
  public spns: SPNsModel;

  private configFilePath: string;

  /**
   * Resolve all the dirs in the model to be absolute
   *
   * This is usually called after deserializing an object
   *
   * @param path [string] Full path to the configuration file
   */
  public configure(path: string, options, mode: string) {
    // set the configFilePath property
    this.configFilePath = path;

    // Using the options set the relevant object properties
    this.build.clean = options.clean;
    this.build.dual = options.dual;

    if (options.version) {
      this.build.version = options.version;
    }

    // determine the folder for the configuration file
    // this will be used as the appRoot folder
    this.dirs.appRoot = dirname(this.configFilePath);

    // ensure that directories are set to absolute paths

    // If the build folder is relative then prepend the appRoot dir to it
    if (!isAbsolute(this.dirs.build)) {
      this.dirs.build = pathJoin(this.dirs.appRoot, this.dirs.build);
    }

    // If the build dir is relative then prepend the build dir to it
    if (!isAbsolute(this.dirs.working)) {
      this.dirs.working = pathJoin(this.dirs.build, this.dirs.working);
    }

    // Ensure that the output dir is absolute
    if (!isAbsolute(this.dirs.output)) {
      this.dirs.output = pathJoin(this.dirs.build, this.dirs.output);
    }

    // Configure the production and staging dirs if the dual option has been set
    if (this.build.dual) {
      this.dirs.production = pathJoin(this.dirs.working, "production");
      this.dirs.staging = pathJoin(this.dirs.working, "staging");
    }

    // Set the SPN details on the correct part of the configuration model
    // Depending on the sub command that is being run, different parts of the object maybe set
    // If the subscriptionID, clientID, clientSecret and tenantId have all been specied use these
    // If just a subscriptionID get the data from the credentials file
    let spn;
    this.spns = new SPNsModel();

    // set the correct part of the object
    if (mode === "deploy") {
      spn = this.spns.deploy = new SPNModel();
    } else if (mode === "publish") {

      // Set the upload SPN details for static files
      spn = this.spns.upload = new SPNModel();
    }

    if (options.subsciption &&
      options.clientid &&
      options.clientsecret &&
      options.tenantid) {

      spn.subscriptionId = options.subscription;
      spn.clientId = options.clientid;
      spn.clientSecret = options.clientsecret;
      spn.tenantId = options.tenantId;

    } else if (options.subscription && options.authFile) {

      let credentialsFile = options.authFile;

      if (existsSync(credentialsFile)) {
        if (!isAbsolute(credentialsFile)) {
          credentialsFile = pathJoin(process.cwd(), credentialsFile);
        }

        let credentials = iniParse(readFileSync(credentialsFile, "utf8"));

        // set the subscription from the options
        let subscription = options.subscription;

        // if the subscription is a number then get that id from the credentials file
        let pattern = new RegExp("^[0-9]*$");
        if (pattern.test(subscription)) {
          subscription = Object.keys(credentials)[Number(subscription) - 1];
        }

        // if the subscription can be found in the file use it
        if (subscription in credentials) {
          spn.subscriptionId = subscription;
          spn.clientId = credentials[subscription].client_id;
          spn.clientSecret = credentials[subscription].client_secret;
          spn.tenantId = credentials[subscription].tenant_id;
        }
      }
    }

    // If publishing set the publishing credentials
    // If they have not been specified copy the upload details
    if (mode === "publish") {
      if (options.publishclientid &&
        options.publishclientsecret &&
        options.publishtenantid) {

        spn = this.spns.publish = new SPNModel();

        this.spns.publish.clientId = options.publishclientid;
        this.spns.publish.clientSecret = options.publishclientsecret;
        this.spns.publish.tenantId = options.publishtenantid;
      } else {
        this.spns.publish = spn;
      }
    }

    this.deploy.delete = options.delete;

    // If running in deploy mode ensure that the controlfile path is set
    // and that it exists
    if (mode === "deploy") {
      this.dirs.controlFile = pathJoin(this.getAppRoot(), ".deploy");

      if (!existsSync(this.dirs.controlFile)) {
        let controlFile = {};
        controlFile[this.deploy.resourceGroup.name] = {
          iteration: 1,
        };

        // Write out the controlFile
        writeFileSync(this.dirs.controlFile, JSON.stringify(controlFile), "utf8");
      }

      // If it has been set, and it is exists configure the parametersFile
      if (options.parameters !== "") {
        let parametersFile = options.parameters;
        if (!isAbsolute(parametersFile)) {
          parametersFile = pathJoin(this.dirs.appRoot, parametersFile);
        }

        if (existsSync(parametersFile)) {
          this.deploy.parametersFile = parametersFile;
        }
      }
    }
  }

  public getAppRoot() {
    return this.dirs.appRoot;
  }

  public getWorkingDir() {
    return this.dirs.working;
  }

  public getBuildDir() {
    return this.dirs.build;
  }
}
