"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = void 0;
const checkMinRequiredVersion_1 = require("../checkMinRequiredVersion");
const command_1 = require("../command");
const extensionsHelper_1 = require("../extensions/extensionsHelper");
const requirePermissions_1 = require("../requirePermissions");
const utils_1 = require("../utils");
const manifest = require("../extensions/manifest");
const extensionsApi_1 = require("../extensions/extensionsApi");
const projectUtils_1 = require("../projectUtils");
const prompt_1 = require("../prompt");
const error_1 = require("../error");
exports.command = new command_1.Command("ext:uninstall <extensionInstanceId>")
    .description("uninstall an extension that is installed in your Firebase project by instance ID")
    .option("--local", "deprecated")
    .option("--immediate", "immediately destroy GCP resources instead of waiting on next deploy. Can be run outside a firebase project directory.")
    .withForce()
    .before(requirePermissions_1.requirePermissions, ["firebaseextensions.instances.delete"])
    .before(extensionsHelper_1.ensureExtensionsApiEnabled)
    .before(checkMinRequiredVersion_1.checkMinRequiredVersion, "extMinVersion")
    .before(extensionsHelper_1.diagnoseAndFixProject)
    .action(async (instanceId, options) => {
    if (options.local) {
        (0, utils_1.logLabeledWarning)(extensionsHelper_1.logPrefix, "As of firebase-tools@11.0.0, the `--local` flag is no longer required, as it is the default behavior.");
    }
    if (options.immediate) {
        const projectId = (0, projectUtils_1.needProjectId)(options);
        let config;
        try {
            config = manifest.loadConfig(options);
        }
        catch {
            (0, utils_1.logLabeledBullet)(extensionsHelper_1.logPrefix, "No firebase.json found. Proceeding to immediate extension instance teardown.");
        }
        if (config && manifest.instanceExists(instanceId, config)) {
            manifest.removeFromManifest(instanceId, config);
        }
        if (!(await (0, prompt_1.confirm)({
            message: `About to delete Extensions instance ${projectId}/${instanceId}, its associated resources, and service account. Continue?`,
            nonInteractive: options.nonInteractive,
            force: options.force,
            default: true,
        }))) {
            return;
        }
        try {
            await (0, extensionsApi_1.deleteInstance)(projectId, instanceId);
        }
        catch (err) {
            throw new error_1.FirebaseError(`Error when attempting deletion: ${err instanceof Error ? err.message : String(err)}`, { original: err instanceof Error ? err : undefined });
        }
        (0, utils_1.logLabeledSuccess)(extensionsHelper_1.logPrefix, `Deleted Extensions instance ${projectId}/${instanceId}.`);
        return;
    }
    const config = manifest.loadConfig(options);
    manifest.removeFromManifest(instanceId, config);
});
