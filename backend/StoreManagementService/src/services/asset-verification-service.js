"use strict";

const AssetRepository = require("../repository/asset-repository");
const { assertActorCanAccessLocation } = require("../utils/location-scope");
const {
  parseAssetSecurityCode,
  verifyAssetSecurityCode,
} = require("../utils/asset-security-code");

const normalizeHolder = (holder = null) => {
  if (!holder) return null;
  return {
    type: holder.type || null,
    id: holder.id ?? null,
    name: holder.name || null,
    division: holder.division || null,
    location: holder.location || null,
  };
};

class AssetVerificationService {
  constructor() {
    this.assetRepository = new AssetRepository();
  }

  async verifyByCode(code, actor = null) {
    const parsed = parseAssetSecurityCode(code);
    if (!parsed.valid) {
      return {
        valid: false,
        reason: "Invalid asset verification code.",
      };
    }

    const summary = await this.assetRepository.getVerificationSummaryById(
      parsed.assetId,
    );

    if (!summary) {
      return {
        valid: false,
        reason: "Asset not found for this verification code.",
      };
    }

    if (!verifyAssetSecurityCode(code, summary)) {
      return {
        valid: false,
        reason:
          "Verification failed because the asset label no longer matches the live record.",
      };
    }

    let internalAllowed = false;
    let accessMessage =
      "Sign in with an authorized account to see holder details and open the full timeline.";

    if (actor?.id) {
      try {
        assertActorCanAccessLocation(
          actor,
          summary.location_scope,
          "open full details for this asset",
        );
        internalAllowed = true;
        accessMessage = "Internal asset details are available for your account.";
      } catch (error) {
        accessMessage =
          error?.message ||
          "Your account does not have access to this asset's location.";
      }
    }

    return {
      valid: true,
      code: summary.verification_code,
      verified_at: new Date().toISOString(),
      asset: {
        id: summary.id,
        asset_tag: summary.asset_tag,
        serial_number: summary.serial_number,
        item_name: summary.item_name,
        category_name: summary.category_name,
        status: summary.status,
        location_scope: summary.location_scope,
        last_event_type: summary.last_event_type,
        last_event_date: summary.last_event_date,
        verification_status: "Valid",
      },
      access: {
        authenticated: Boolean(actor?.id),
        internal_allowed: internalAllowed,
        message: accessMessage,
      },
      internal: internalAllowed
        ? {
            current_holder: normalizeHolder(summary.current_holder),
            purchased_at: summary.purchased_at,
            warranty_expiry: summary.warranty_expiry,
            vendor_name: summary.vendor_name,
            daybook_entry_no: summary.daybook_entry_no,
            timeline_path: `/asset/${summary.id}/timeline`,
          }
        : null,
    };
  }
}

module.exports = AssetVerificationService;
