import {
  create,
} from "tar";

import {
  dirname,
} from "path";

import {
  existsSync,
  mkdirpSync,
} from "fs-extra";

import {
  sprintf,
} from "sprintf-js";

// determine the build number
let buildNumber = "0.0.0";
if (process.env.BUILD_BUILDNUMBER) {
  buildNumber = process.env.BUILD_BUILDNUMBER;
}

// Determine the filename
let filename = sprintf("build/arm-template-deploy-%s.tar.gz", buildNumber);

// Ensure that the parent directory exists
if (!existsSync(dirname(filename))) {
  mkdirpSync(dirname(filename));
}

create (
  {
    file: filename,
    gzip: true,
    sync: true,
  },
  ["dist"],
);
