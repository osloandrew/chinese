"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayWarningsForDeploy = displayWarningsForDeploy;
exports.outOfBandChangesWarning = outOfBandChangesWarning;
exports.isSilenced = isSilenced;
exports.showDeprecationWarningBefore = showDeprecationWarningBefore;
exports.showDeprecationWarningAfter = showDeprecationWarningAfter;
const clc = require("colorette");
const extensionsHelper_1 = require("./extensionsHelper");
const deploymentSummary_1 = require("../deploy/extensions/deploymentSummary");
const planner_1 = require("../deploy/extensions/planner");
const error_1 = require("../error");
const logger_1 = require("../logger");
const utils = require("../utils");
const toListEntry = (i) => {
    const idAndRef = (0, deploymentSummary_1.humanReadable)(i);
    const sourceCodeLink = `\n\t[Source Code](${i.extensionVersion?.buildSourceUri ?? i.extensionVersion?.sourceDownloadUri})`;
    const githubLink = i.extensionVersion?.spec?.sourceUrl
        ? `\n\t[Publisher Contact](${i.extensionVersion?.spec.sourceUrl})`
        : "";
    return `${idAndRef}${sourceCodeLink}${githubLink}`;
};
async function displayWarningsForDeploy(instancesToCreate) {
    const uploadedExtensionInstances = instancesToCreate.filter((i) => i.ref);
    for (const i of uploadedExtensionInstances) {
        await (0, planner_1.getExtensionVersion)(i);
    }
    const unpublishedExtensions = uploadedExtensionInstances.filter((i) => i.extensionVersion?.listing?.state !== "APPROVED");
    if (unpublishedExtensions.length) {
        const humanReadableList = unpublishedExtensions.map(toListEntry).join("\n");
        utils.logLabeledBullet(extensionsHelper_1.logPrefix, `The following extension versions have not been published to the Firebase Extensions Hub:\n${humanReadableList}\n.` +
            "Unpublished extensions have not been reviewed by " +
            "Firebase. Please make sure you trust the extension publisher before installing this extension.");
    }
    return unpublishedExtensions.length > 0;
}
function outOfBandChangesWarning(instanceIds, isDynamic) {
    const extra = isDynamic
        ? ""
        : " To avoid this, run `firebase ext:export` to sync these changes to your local extensions manifest.";
    logger_1.logger.warn("The following instances may have been changed in the Firebase console or by another machine since the last deploy from this machine.\n\t" +
        clc.bold(instanceIds.join("\n\t")) +
        `\nIf you proceed with this deployment, those changes will be overwritten.${extra}`);
}
const FAQ_URL = "https://firebase.google.com/docs/extensions/faq-and-troubleshooting";
const WARN_BEFORE_COMMANDS = new Set([
    "ext:install",
    "ext:configure",
    "ext:update",
    "ext:sdk:install",
]);
const WARN_STRONGLY_BEFORE_COMMANDS = new Set([
    "ext:dev:init",
    "ext:dev:upload",
    "ext:dev:list",
    "ext:dev:usage",
    "ext:dev:undeprecate",
]);
const WARN_AFTER_COMMANDS = new Set(["ext:list", "ext:info"]);
function isSilenced(options) {
    const opts = options;
    if (opts?.json ||
        utils.getInheritedOption(options, "json") ||
        opts?.nonInteractive ||
        utils.getInheritedOption(options, "nonInteractive") ||
        !process.stdout?.isTTY ||
        opts?.quiet ||
        utils.getInheritedOption(options, "quiet")) {
        return true;
    }
    if (utils.isRunningInGithubAction() ||
        (!!process.env.CI && process.env.CI !== "false") ||
        !!process.env.BUILD_ID ||
        !!process.env.TF_BUILD ||
        !!process.env.GITHUB_ACTIONS) {
        return true;
    }
    return false;
}
function showDeprecationWarningBefore(commandName, options) {
    if (commandName === "ext:dev:register") {
        throw new error_1.FirebaseError(`ext:dev:register is disabled. Registering new publisher profile IDs is no longer supported.\n` +
            `The Firebase Extensions service will shut down on March 31, 2027.\n` +
            `Learn more: ${FAQ_URL}`, { exit: 1 });
    }
    if (isSilenced(options)) {
        return;
    }
    if (WARN_BEFORE_COMMANDS.has(commandName)) {
        logger_1.logger.warn(clc.yellow(`⚠ Firebase Extensions will shut down on March 31, 2027. You will not be able to install or edit extensions after this date. Learn more: ${FAQ_URL}`));
    }
    else if (WARN_STRONGLY_BEFORE_COMMANDS.has(commandName)) {
        logger_1.logger.warn(clc.yellow(`================================================================================\n` +
            `⚠ Notice for Publishers: Firebase Extensions will shut down on March 31, 2027.\n` +
            `Learn more: ${FAQ_URL}\n` +
            `================================================================================`));
    }
}
function showDeprecationWarningAfter(commandName, options) {
    if (isSilenced(options) || !WARN_AFTER_COMMANDS.has(commandName)) {
        return;
    }
    logger_1.logger.warn(clc.yellow(`⚠ Notice: Firebase Extensions will shut down on March 31, 2027. Learn more: ${FAQ_URL}`));
}
