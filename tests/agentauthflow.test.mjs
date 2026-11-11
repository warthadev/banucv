import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowRouterAuthModal } from "../src/react/config/agentauthflow.ts";

test("shows the API key modal for a signed-in account without a configured key", () => {
  assert.equal(shouldShowRouterAuthModal({
    isLoading: false,
    userUid: "firebase-user-123",
    isConfigured: false,
  }), true);
});

test("waits until account configuration has finished loading", () => {
  assert.equal(shouldShowRouterAuthModal({
    isLoading: true,
    userUid: "firebase-user-123",
    isConfigured: false,
  }), false);
});

test("does not show the modal when no signed-in UID is available", () => {
  assert.equal(shouldShowRouterAuthModal({
    isLoading: false,
    userUid: null,
    isConfigured: false,
  }), false);
});

test("does not show the modal when the account already has a configured key", () => {
  assert.equal(shouldShowRouterAuthModal({
    isLoading: false,
    userUid: "firebase-user-123",
    isConfigured: true,
  }), false);
});
