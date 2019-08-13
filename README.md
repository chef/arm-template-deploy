# ARM Template Deploy

When developing ARM templates it is necessary to have a reliable repeatable way of deploying said templates. This is not so bad when one template is being developed, however it gets much more difficult if the template contains nested templates. This requires that the templates are accessible to Azure over a public URL.

Additionally there is the speed of deployment. If working with just one resource group then the work flow is:

 - create resource group
 - deploy templates
 - delete resource group
 - wait for resource group to delete
 - repeat

This can really slow down development time.

This NPM module aims to solve this by providing commands that assist with these work flows.

## Build

The build command will gather up all the templates into a `build` directory and package them up as Zip files. This latter feature is useful when templates are being packaged up for the Azure Marketplace

## Deploy

This command has two sub commands:

 - upload 
 - deploy

The upload command uploads the built templates to the specified blob storage container.

The deploy command then deploys the templates from that blob storage container so that Azure is able to access them.

To assist with the speed up of deployment the deploy mechanism takes the name of the desired resource group (from the configuration file) and appends an incremental number to it. So the first time the deployment is run the group will have `1` appended. The second time it is run the previous resource group will be deleted asynchronously and the new group created and deployed to. Thus the workflow is now:

 - delete previous resource group
 - create new resource group
 - deployment templates to new resource group