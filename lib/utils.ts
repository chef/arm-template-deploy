/**
 * Library containing methods that can be used by any other
 * lib in the package
 *
 * @author Russell Seymour
 */

import "reflect-metadata";

import { ResourceManagementClient } from "azure-arm-resource";
import { StorageManagementClient } from "azure-arm-storage";
import { createBlobService } from "azure-storage";
import { deserialize } from "class-transformer";
import { existsSync, readFileSync } from "fs";
import { request } from "https";
import { ApplicationTokenCredentials } from "ms-rest-azure";
import { basename, resolve as resolvePath } from "path";
import { sprintf, vsprintf } from "sprintf-js";
import { parse } from "url";

import { createLogger, format, transports } from "winston";

import { ConfigModel } from "./models/ConfigModel";

export class Utils {

  public static getError(error: any): string {
    if (error && error.message) {
      return JSON.stringify(error.message);
    }

    return JSON.stringify(error);
  }

  public static sleep(milliseconds) {
    let start = new Date().getTime();
    for (let i = 0; i < 1e7; i++) {
      if ((new Date().getTime() - start) > milliseconds) {
        break;
      }
    }
  }

  private config: ConfigModel;
  private logger;
  private blobService;

  constructor() {
    // configure the logformat for the console
    let consoleLogFormat = format.printf((info) => {
      return `${info.level}: ${info.message}`;
    });

    // determine the log level for the program
    let logLevel = "info";
    if (process.env.LOG_LEVEL) {
      logLevel = process.env.LOG_LEVEL;
    }

    this.logger = createLogger({
      level: logLevel,
      transports: [
        new transports.Console({
          format: format.combine(format.colorize(), consoleLogFormat),
        }),
      ],
    });
  }

  public parseConfig(options, mode: string) {

    let result;

    // Determine if the file that has been specified for the configuration exists
    let path = resolvePath(options.parent.config);
    if (existsSync(path)) {
      this.log("Reading configuration file: %s", path);

      // attempt to deserialize the config file
      let configRaw = readFileSync(path, "utf8");
      let config = deserialize(ConfigModel, configRaw);

      // set the configuration path on the config object
      config.configure(path, options, mode);
      result = config;
    } else {
      this.log("Unable to read configuration file: %s", path, "error", 1);
      process.exit(1);
    }

    this.config = result;
  }

  public log(message: string, replacements, level: string = "info", exitCode: number = 0) {

    // if replacement is just a string then turn into an array
    if (typeof replacements === "string") {
      replacements = [replacements];
    }

    // create the message using the replacements
    message = vsprintf(message, replacements);

    // Output the string using the logger
    this.logger.log(level, message);

    // if the exitcode is greater than 0, exit the application
    if (exitCode > 0) {
      process.exit(exitCode);
    }
  }

  public getAzureClient(type: string, mode: string) {
    // define the client to return the calling function
    let client;

    // Get the SPN to be used based on the mode
    let spn = this.config.spns[mode];

    // create an Azure token
    let azureToken = new ApplicationTokenCredentials(spn.clientId, spn.tenantId, spn.clientSecret);

    // create the client based on the requested type
    switch (type) {
    case "storage":
      client = new StorageManagementClient(azureToken, spn.subscriptionId);
      break;
    case "resource":
      client = new ResourceManagementClient.ResourceManagementClient(azureToken, spn.subscriptionId);
      break;
    default:
      client = false;
    }

    return client;
  }

  public async checkStorageAccountExists(client: StorageManagementClient, section: string) {
    // determine the configuration to use
    let config = this.getConfigSection(section);

    return new Promise<boolean>((resolve) => {

      client.storageAccounts.checkNameAvailability(config.storageAccount.name, (error, exists) => {
        if (error) {
          this.log(Utils.getError(error), []);
        }

        resolve(!exists.nameAvailable);
      });
    });
  }

  public async checkContainerExists(client: StorageManagementClient, section: string) {
    // determine the configuration to use
    let config = this.getConfigSection(section);

    return new Promise<boolean>((resolve, reject) => {

      client.blobContainers.get(
        config.storageAccount.groupName,
        config.storageAccount.name,
        config.storageAccount.containerName,
        {},
        (error) => {

          let exists: boolean;

          if (error) {
            if (error.message.toLocaleLowerCase().startsWith("the specified container does not")) {
              exists = false;
            } else {
              return reject(sprintf("Failed to return list of containers: %s", Utils.getError(error)));
            }
          } else {
            exists = true;
          }

          resolve(exists);
        });
    });
  }

  public async uploadFile(path: string, section: string) {

    let config = this.getConfigSection(section);
    let name = basename(path);

    // Only proceed if the file can be located
    if (existsSync(path)) {

      this.log("\t%s", name);

      await this.blobService.createBlockBlobFromLocalFile(
        config.storageAccount.container,
        name,
        resolvePath(path),
        {},
        (error) => {
          if (error) {
            this.log("Failed to upload: %s", Utils.getError(error), "error", 1);
          }
        },
      );

      // determine the URL of the uploaded file
      return sprintf("https://%s.blob.core.windows.net/%s/%s",
        config.storageAccount.name,
        config.storageAccount.container,
        name,
      );
    } else {
      this.log("File cannot be found: %s", [path], "warn");
      return "";
    }
  }

  public async setBlobService(section: string, client: StorageManagementClient) {
    let config = this.getConfigSection(section);

    let saKeys = await client.storageAccounts.listKeys(
      config.storageAccount.groupName,
      config.storageAccount.name,
      config.storageAccount.containerName,
    );

    this.blobService = createBlobService(
      config.storageAccount.name,
      saKeys.keys[0].value,
    );
  }

  public makeRequest(method: string, url: string, headers = {}, body = null) {
    // Ensure that a supported method has been specified
    if (["get", "post", "put"].indexOf(method) === -1) {
      throw new Error(sprintf("Invalid method: %s", method));
    }

    // create the URI from the url
    let uri;
    try {
      uri = parse(url);
    } catch (error) {
      throw new Error(sprintf("Invalid url: %s", url));
    }

    // build up the options to pass to the request
    let options = {
      headers,
      hostname: uri.host,
      method: method.toUpperCase(),
      path: uri.path,
      port: uri.port,
    };

    // if a body has been supplied set the content length
    if (body) {
      options.headers["Content-Length"] = Buffer.byteLength(body);
    }

    return new Promise((resolve, reject) => {
      let req = request(options, (incoming) => {

        let data = [];

        // create the response object
        let response = {
          body: {},
          headers: incoming.headers,
          statusCode: incoming.statusCode,
        };

        // get the response data
        incoming.on("data", (chunk) => {
          data.push(chunk);
        });

        // end the response
        incoming.on("end", () => {

          try {
            response.body = JSON.parse(data.join());
          } catch (error) {
            this.log("Error parsing HTTP response: %s", error, "error");
          }

          resolve(response);
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  private getConfigSection(section: string) {
    let config;
    switch (section) {
    case "deploy":
      config = this.config.deploy;
      break;
    case "publish":
      config = this.config.publish;
      break;
    }
    return config;
  }
}
