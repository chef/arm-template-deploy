// import {createBlobService} from "azure-storage";
// import {basename, resolve as resolvePath} from "path";
import { stringify as toQueryString } from "querystring";
import { sprintf } from "sprintf-js";

import { ContactModel } from "./models/ContactModel";
import { Utils } from "./utils";

/**
 * Library to publish a package in the Azure Cloud Partner Portal
 *
 * @author Russell Seymour
 */

export class Publish {
  private utils;

  // Properties ----------------------------------------------------------------------
  private accessTokenKey = "access_token";
  private bodyKey = "body";

  constructor(utils: Utils) {
    this.utils = utils;
  }

  /**
   * Process the options that have been specified on the command line
   *
   * @param action string The action that is to be performed. Nothing means all the actions
   * @param config Config, the configuration object
   */
  public async process(actionsString: string) {
    this.utils.log("Staring the Publishing process");

    // Turn the action string into an array
    let actions = [];
    if (actionsString !== undefined) {
      actions = actionsString.split(",");
    }

    // Based on the command that has been passed, determine the actions to take
    // if the command is null then all the actions should be undertaken
    // Initialisation
    if (actions.length === 0 || actions.indexOf("publish") > -1) {
      await this.publish();
    }
  }

  private async publish() {
    // Create an alias to the publishConfig
    let pubConfig = this.utils.config.publish;

    // Upload the static files, images and package, to a public storage account
    // that the Cloud Portal can access
    this.utils.log("Uploading static files");

    // create the necessary clients
    let smClient = this.utils.getAzureClient("storage", "upload");
    let saExists = await this.utils.checkStorageAccountExists(smClient, "publish");
    let containerExists = await this.utils.checkStorageAccountExists(smClient, "publish");

    // if the storage account and container exist, get the keys so that items can be uploaded
    if (saExists && containerExists) {

      await this.utils.setBlobService("publish", smClient);

      // For all the static files in the config, upload each file and set the URL in its place
      for (let plan of pubConfig.plans) {
        plan.package.file = await this.utils.uploadFile(plan.package.file, "publish");
      }

      // Iterate around the logos
      for (let type in pubConfig.logos) {

        // if the type of image is not null upload and set the url
        if (pubConfig.logos[type] !== "") {
          this.utils.log(pubConfig.logos[type], "", "debug");
          pubConfig.logos[type] = await this.utils.uploadFile(pubConfig.logos[type], "publish");
        }
      }

      // upload any screenshots and videos
      // as this is an array the order does not matter, so take a copy and then reset
      // the object to an empty array to which the urls can be appended
      let items;
      let url;
      for (let staticFileType of ["screenshots", "videos"]) {
        items = pubConfig[staticFileType];
        if (items.length > 0) {
          pubConfig[staticFileType] = [];
          for (let item of items) {
            if (item !== "") {
              url = await this.utils.uploadFile(item, "publish");
              pubConfig[staticFileType].push(url);
            }
          }
        }
      }
    }

    // Create a plan array to hold all the necessary plans that have been supplied
    let plans = [];

    // Iterate around the plans in the config
    for (let plan of pubConfig.plans) {

      let item = {
        "microsoft-azure-applications.certificationsAzureGovernment": plan.governmentCertifications,
        "microsoft-azure-applications.cloudAvailability": plan.availability,
        "microsoft-azure-applications.package": {
        },
        "microsoft-azure-applications.skuDescription": plan.sku.description,
        "microsoft-azure-applications.skuSummary": plan.sku.summary,
        "microsoft-azure-applications.skuTitle": plan.sku.title,
        "microsoft-azure-applications.skuType": plan.sku.type,
        "monthlyPricing": plan.monthlyPricing,
        "monthlyPricingV2": plan.monthlyPricingV2,
        "planId": plan.id,
        "regions": plan.regions,
      };

      // Upload the package file and get the url of it
      item["microsoft-azure-applications.package"][plan.package.version] = {
        ApplicationLockingPolicies: {
          CanEnableCustomerActions: false,
        },
        authorizations: plan.package.authorizations,
        packageVersion: {
          packageFile: plan.package.file,
          tenantId: plan.package.tenantId,
        },
        policies: [],
        publisherJitAccessPolicy: {
          jitAccessEnabled: false,
        },
      };

      // Append the item to the array
      plans.push(item);
    }

    // ensure compulsory fields have a value
    if (pubConfig.contacts.support == null) {
      pubConfig.contacts.support = new ContactModel();
    }

    if (pubConfig.contacts.engineering == null) {
      pubConfig.contacts.engineering = new ContactModel();
    }

    // Convert the publish data into an object to be sent to the Cloud Partner portal
    let now = new Date();
    let data = {
      changedTime: now.toISOString(),
      definition: {
        displayText: pubConfig.display,
        offer: {
          "microsoft-azure-applications.gtmMaterials": "",
          "microsoft-azure-applications.managerContactEmail": "",
          "microsoft-azure-applications.managerContactName": "",
          "microsoft-azure-applications.managerContactPhone": "",
          "microsoft-azure-marketplace-testdrive.enabled": false,
          "microsoft-azure-marketplace-testdrive.videos": [],
          "microsoft-azure-marketplace.allowedSubscriptions": pubConfig.subscriptions,
          "microsoft-azure-marketplace.blobLeadConfiguration": {},
          "microsoft-azure-marketplace.categories": pubConfig.categories,
          "microsoft-azure-marketplace.crmLeadConfiguration": {},
          "microsoft-azure-marketplace.cspOfferOptIn": false,
          "microsoft-azure-marketplace.customAmendments": {},
          "microsoft-azure-marketplace.description": pubConfig.description,
          "microsoft-azure-marketplace.engineeringContactEmail": pubConfig.contacts.engineering.email,
          "microsoft-azure-marketplace.engineeringContactName": pubConfig.contacts.engineering.name,
          "microsoft-azure-marketplace.engineeringContactPhone": pubConfig.contacts.engineering.phone,
          "microsoft-azure-marketplace.fairfaxSupportUrl": pubConfig.urls.fairfax,
          "microsoft-azure-marketplace.heroLogo": pubConfig.logos.hero,
          "microsoft-azure-marketplace.httpsEndpointLeadConfiguration": {},
          "microsoft-azure-marketplace.largeLogo": pubConfig.logos.large,
          "microsoft-azure-marketplace.leadDestination": "None",
          "microsoft-azure-marketplace.longSummary": pubConfig.longSummary,
          "microsoft-azure-marketplace.marketoLeadConfiguration": {},
          "microsoft-azure-marketplace.mediumLogo": pubConfig.logos.medium,
          "microsoft-azure-marketplace.offerMarketingUrlIdentifier": pubConfig.offer.id,
          "microsoft-azure-marketplace.privacyURL": pubConfig.urls.privacy,
          "microsoft-azure-marketplace.publicAzureSupportUrl": pubConfig.urls.publicSupport,
          "microsoft-azure-marketplace.salesForceLeadConfiguration": {},
          "microsoft-azure-marketplace.screenshots": pubConfig.screenshots,
          "microsoft-azure-marketplace.smallLogo": pubConfig.logos.small,
          "microsoft-azure-marketplace.summary": pubConfig.summary,
          "microsoft-azure-marketplace.supportContactEmail": pubConfig.contacts.support.email,
          "microsoft-azure-marketplace.supportContactName": pubConfig.contacts.support.name,
          "microsoft-azure-marketplace.supportContactPhone": pubConfig.contacts.support.phone,
          "microsoft-azure-marketplace.tableLeadConfiguration": {},
          "microsoft-azure-marketplace.termsOfUse": pubConfig.termsOfUse,
          "microsoft-azure-marketplace.title": pubConfig.display,
          "microsoft-azure-marketplace.useEnterpriseContract": false,
          "microsoft-azure-marketplace.usefulLinks": pubConfig.usefulLinks,
          "microsoft-azure-marketplace.videos": pubConfig.videos,
          "microsoft-azure-marketplace.wideLogo": pubConfig.logos.wide,
        },
        plans,
      },
      id: pubConfig.offer.id,
      offerTypeId: pubConfig.offer.type,
      publisherId: pubConfig.publisher,
    };

    this.utils.log(JSON.stringify(data), [], "debug");

    // authenticate with the service and then, using the token post the payload
    this.authenticate()
      .then((token) => this.publishPackage(token, data));
  }

  private authenticate(): Promise<string> {
    // declare the token that will be returned
    let token: string;

    // Build up the URL to use for authentication
    let loginUrl: string = sprintf(
      "https://login.microsoft.com/%s/oauth2/token",
      this.utils.config.spns.publish.tenantId,
    );

    // create the body that needs to be sent to get the token
    let postData: string = toQueryString(
      {
        client_id: this.utils.config.spns.publish.clientId,
        client_secret: this.utils.config.spns.publish.clientSecret,
        grant_type: "client_credentials",
        resource: "https://cloudpartner.azure.com",
      },
    );

    return new Promise((resolve) => {
      let headers = {
        "If-Match": "*"
      }
      this.utils.makeRequest("post", loginUrl, headers, postData).then((body) => {
        // if a bearer token has been returned set the property
        if (body[this.bodyKey][this.accessTokenKey]) {
          token = body[this.bodyKey][this.accessTokenKey];
        }

        resolve(token);
      });
    });

  }

  private async publishPackage(token: string, data: {}) {
    // set the headers to be passed to the portal
    let headers = {
      "Authorization": sprintf("Bearer %s", token),
      "Content-Type": "application/json",
    };

    // create the url to use
    let url = sprintf(
      "https://cloudpartner.azure.com/api/publishers/%s/offers/%s?api-version=2017-10-31",
      this.utils.config.publish.publisher,
      this.utils.config.publish.offer.id,
    );

    this.utils.log("Publish URL: %s", url, "debug");

    // make the HTTP post
    let response = await this.utils.makeRequest("put", url, headers, JSON.stringify(data));

    if (response.statusCode >= 200 && response.statusCode < 300) {
      this.utils.log(response.body.Message, "");
    } else if (response.statusCode !== 401) {
      this.utils.log("%s (HTTP code: %d)", [response.body.error.message, response.statusCode], "error");
    } else {
      this.utils.log("%s (HTTP code: %d)", [response.body.Message, response.statusCode], "warn");
    }
  }
}
