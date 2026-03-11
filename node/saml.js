'use strict';

/**
 * SAML 2.0 Service Provider (SP) module.
 *
 * Configuration is read exclusively from environment variables so that no
 * secrets are stored in source code.  Set the following in your .env or
 * container environment:
 *
 *   SAML_IDP_SSO_URL          (required) – SSO URL of the Identity Provider
 *   SAML_IDP_ENTITY_ID        (required) – Entity ID (issuer) of the IdP
 *   SAML_IDP_CERT             (required) – PEM-encoded X.509 public certificate
 *                                          of the IdP (used to verify signatures)
 *   SAML_SP_ENTITY_ID         (optional) – Entity ID used by this SP
 *                                          default: http://localhost:8180/saml/metadata
 *   SAML_SP_ACS_URL           (optional) – Assertion Consumer Service URL
 *                                          default: http://localhost:8180/saml/acs
 *   SAML_SP_CERT              (optional) – PEM-encoded X.509 public cert of the SP
 *   SAML_SP_PRIVATE_KEY       (optional) – PEM-encoded RSA private key of the SP
 *                                          (used to sign AuthnRequests)
 *   SAML_ATTRIBUTE_EMAIL      (optional) – SAML attribute name to use as the
 *                                          user's e-mail / username
 *                                          default: email
 *   SAML_ATTRIBUTE_NAME       (optional) – SAML attribute name to use as the
 *                                          display name
 *                                          default: displayName
 *   SAML_WANT_ASSERTIONS_SIGNED (optional) – require signed assertions (true/false)
 *                                          default: true
 *   SAML_WANT_AUTHN_RESPONSE_SIGNED (optional) – require signed AuthnResponse
 *                                          default: true
 *
 * When SAML_IDP_SSO_URL or SAML_IDP_CERT are not set the module is considered
 * "unconfigured"; all helpers return safe no-op values so the rest of the app
 * can start without SAML.
 */

const { SAML } = require('@node-saml/node-saml');

// ── Read configuration from the environment ────────────────────────────────
const IDP_SSO_URL    = process.env.SAML_IDP_SSO_URL    || '';
const IDP_ENTITY_ID  = process.env.SAML_IDP_ENTITY_ID  || '';
const IDP_CERT       = process.env.SAML_IDP_CERT        || '';
const SP_ENTITY_ID   = process.env.SAML_SP_ENTITY_ID   || 'http://localhost:8180/saml/metadata';
const SP_ACS_URL     = process.env.SAML_SP_ACS_URL      || 'http://localhost:8180/saml/acs';
const SP_CERT        = process.env.SAML_SP_CERT         || '';
const SP_PRIVATE_KEY = process.env.SAML_SP_PRIVATE_KEY  || '';
const ATTR_EMAIL     = process.env.SAML_ATTRIBUTE_EMAIL || 'email';
const ATTR_NAME      = process.env.SAML_ATTRIBUTE_NAME  || 'displayName';
const WANT_ASSERTIONS_SIGNED       = process.env.SAML_WANT_ASSERTIONS_SIGNED !== 'false';
const WANT_AUTHN_RESPONSE_SIGNED   = process.env.SAML_WANT_AUTHN_RESPONSE_SIGNED !== 'false';

const isConfigured = Boolean(IDP_SSO_URL && IDP_CERT);

let samlInstance = null;

if (isConfigured) {
    const opts = {
        callbackUrl:               SP_ACS_URL,
        entryPoint:                IDP_SSO_URL,
        issuer:                    SP_ENTITY_ID,
        idpCert:                   IDP_CERT,
        wantAssertionsSigned:      WANT_ASSERTIONS_SIGNED,
        wantAuthnResponseSigned:   WANT_AUTHN_RESPONSE_SIGNED,
        signatureAlgorithm:        'sha256',
        digestAlgorithm:           'sha256',
    };

    if (SP_PRIVATE_KEY) {
        opts.privateKey = SP_PRIVATE_KEY;
        // Allow the SP to decrypt encrypted assertions when both cert and key are provided
        if (SP_CERT) {
            opts.decryptionPvk = SP_PRIVATE_KEY;
        }
    }

    try {
        samlInstance = new SAML(opts);
        console.log('[SAML] Service Provider initialised. IdP:', IDP_ENTITY_ID || IDP_SSO_URL);
    } catch (err) {
        console.error('[SAML] Failed to initialise:', err.message);
    }
}

/**
 * True when SAML has been fully configured (IdP URL + cert present).
 */
function isSamlConfigured() {
    return isConfigured && samlInstance !== null;
}

/**
 * Build the SP metadata XML document (for exchanging with the IdP).
 * Returns null when SAML is not configured.
 *
 * @returns {string|null}
 */
function getMetadataXml() {
    if (!isSamlConfigured()) return null;
    try {
        const decryptionCerts = SP_CERT ? [SP_CERT] : [];
        const signingCerts    = SP_CERT ? [SP_CERT] : [];
        return samlInstance.generateServiceProviderMetadata(
            decryptionCerts.length ? decryptionCerts[0] : null,
            signingCerts.length    ? signingCerts[0]    : null
        );
    } catch (err) {
        console.error('[SAML] getMetadataXml error:', err.message);
        return null;
    }
}

/**
 * Generate the SP-initiated login redirect URL (contains the AuthnRequest).
 * Returns null when SAML is not configured.
 *
 * @param {object} [additionalParams] - extra query string params (e.g. RelayState)
 * @returns {Promise<string|null>}
 */
async function getLoginUrl(additionalParams) {
    if (!isSamlConfigured()) return null;
    try {
        const params = Object.assign({}, additionalParams || {});
        const { context } = await samlInstance.getAuthorizeUrlAsync('', '', params);
        return context;
    } catch (err) {
        console.error('[SAML] getLoginUrl error:', err.message);
        return null;
    }
}

/**
 * Validate an inbound SAML assertion (POST body from IdP).
 *
 * @param {object} body - the POST body (must include `SAMLResponse`)
 * @returns {Promise<{username: string, displayName: string, attributes: object}>}
 * @throws {Error} when validation fails
 */
async function validateAssertion(body) {
    if (!isSamlConfigured()) {
        throw new Error('SAML is not configured');
    }
    const { profile } = await samlInstance.validatePostResponseAsync(body);
    if (!profile) {
        throw new Error('SAML response contained no profile');
    }

    // Extract a usable identity. We try several common attribute names in order.
    const attrs = profile.attributes || {};

    const username =
        attrs[ATTR_EMAIL] ||
        profile.nameID    ||
        profile.email     ||
        profile[ATTR_EMAIL] ||
        '';

    const displayName =
        attrs[ATTR_NAME]  ||
        profile[ATTR_NAME] ||
        profile.displayName ||
        username;

    if (!username) {
        throw new Error('SAML assertion did not contain a usable username/email');
    }

    return {
        username:    String(username).trim(),
        displayName: String(displayName).trim(),
        attributes:  attrs,
        nameID:      profile.nameID || '',
        issuer:      profile.issuer || ''
    };
}

module.exports = {
    isSamlConfigured,
    getMetadataXml,
    getLoginUrl,
    validateAssertion,
    SP_ENTITY_ID,
    SP_ACS_URL,
    IDP_SSO_URL,
    IDP_ENTITY_ID
};
