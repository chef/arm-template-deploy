/**
 * Main entry script for the arm-template-deploy module
 *
 * This script configures the menu system and calls in necessary libraries
 *
 * @author Russell Seymour
 */

// Import Libraries -------------------------------------------------------
// External
import * as program from "commander";
import { homedir } from "os";
import { join as pathJoin } from "path";

// Internal
import { Build } from "./build";
import { Deploy } from "./deploy";
import { Publish } from "./publish";
import { UI } from "./ui";
import { Utils } from "./utils";

// Main -------------------------------------------------------------------

// Create a Utils object
let utils = new Utils();

// Set a default path to the configuration file
// This is based on where the command is being run from
let configurationFilePath = pathJoin(process.cwd(), "arm-deploy.json");

// Configure the command line options
program.version("0.0.1")
  .description("Build and deployment command for ARM templates")
  .option("-c, --config [config]", "Configuration file to use", configurationFilePath);

// - `build` command
program.command("build [actions]")
  .description("Patch ARM templates and output a versioned package")
  .option("-C, --clean", "Clean the build directory before running a build", false)
  .option("--dual", "Specify that a dual build is required, of 'production' and 'staging'", false)
  .option("-v, --version <version>", "Version to be applied to the Zip file", "0.0.0")
  .action((actions, options) => {
    utils.parseConfig(options, "build");
    let build = new Build(utils);
    build.process(actions);
  });

// - `deploy` command
program.command("deploy [actions]")
  .description("Upload and deploy templates")
  .option("-a, --authFile [authfilename]",
    "Path to the Azure credentials file containing the SPN",
    pathJoin(homedir(), ".azure", "credentials"))
  .option("-s, --subscription [subscription]",
    "Subscription of the SPN to use in the specified credentials file",
    process.env.AZURE_SUBSCRIPTION_ID)
  .option("-i, --clientid [clientid]", "Client ID of the SPN", process.env.AZURE_CLIENT_ID)
  .option("-p, --clientsecret [clientsecret]", "Secret associated with the spn", process.env.AZURE_CLIENT_SECRET)
  .option("-t, --tenantid [tenantid]", "Tenant ID to be used with the spn", process.env.AZURE_TENANT_ID)
  .option("-P, --parameters [path]", "Path to the parameters file to use", "local/paramaters.json")
  .option("--no-delete", "Do not delete the existing resource group")
  .action((actions, options) => {
    utils.parseConfig(options, "deploy");
    let deploy = new Deploy(utils);
    deploy.process(actions);
  });

// - `publish` command
program.command("publish [actions]")
  .description("Publish package in the Azure Cloud Partner portal")
  .option("-a, --authFile [authfilename]",
    "Path to the Azure credentials file containing the SPN",
    pathJoin(homedir(), ".azure", "credentials"))
  .option("-s, --subscription [subscription]",
    "Subscription of the SPN to use in the specified credentials file",
    process.env.AZURE_SUBSCRIPTION_ID)
  .option("-i, --clientid [clientid]", "Client ID of the SPN", process.env.AZURE_CLIENT_ID)
  .option("-p, --clientsecret [clientsecret]", "Secret associated with the spn", process.env.AZURE_CLIENT_SECRET)
  .option("-t, --tenantid [tenantid]", "Tenant ID to be used with the spn", process.env.AZURE_TENANT_ID)
  // .option("-S, --publishsubscription [publishsubscription]", "Azure Subscription to use to publish offering",
  //    process.env.AZURE_PUBLISH_SUBSCRIPTION_ID)
  .option("-I, --publishclientid [clientid]", "Client ID of the SPN for publishing",
    process.env.AZURE_PUBLISH_CLIENT_ID)
  .option("-P, --publishclientsecret [clientsecret]", "Secret associated with the spn for publishing",
    process.env.AZURE_PUBLISH_CLIENT_SECRET)
  .option("-T, --publishtenantid [tenantid]", "Tenant ID to be used with the spn for publishing",
    process.env.AZURE_PUBLISH_TENANT_ID)
  .action((actions, options) => {
    utils.parseConfig(options, "publish");
    let publish = new Publish(utils);
    publish.process(actions);
  });

// - `ui` command
program.command("ui <file>")
  .description("Test the specified UI definition file in the Azure Portal")
  .action((file) => {
    let ui = new UI(utils);
    ui.process(file);
  });

program.parse(process.argv);
