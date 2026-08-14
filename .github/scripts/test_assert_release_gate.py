#!/usr/bin/env python3
import unittest

from assert_release_gate import validate_release_gate, validate_verify_gate


REQUIRED_COMMANDS = (
    "node scripts/release-tag.mjs",
    "npm run verify",
    "npm run test:backend-contract -- .contract/backend/contracts/dashboard-snapshot.v1.json",
    "npx playwright install --with-deps chromium",
    "npm run test:e2e",
    "npm run test:package",
    "npm run test:container",
    "npm publish --provenance -w @fix-portal/ci-frontend",
)


PACKAGE_MANIFESTS = {
    "root": {
        "name": "root",
        "scripts": {
            "verify": "npm audit --omit=dev --audit-level=high && npm run lint && npm run test && npm run test:scripts && npm run typecheck -w @fix-portal/ci-frontend && npm run coverage -w @fix-portal/ci-frontend && npm run build:lib && npm run build:app",
            "lint": "eslint .",
            "test": "npm run test --workspaces --if-present",
            "test:scripts": "node --test scripts/*.test.mjs",
            "build:lib": "npm run build -w @fix-portal/ci-frontend",
            "build:app": "npm run build -w dashboard",
        },
    },
    "@fix-portal/ci-frontend": {
        "name": "@fix-portal/ci-frontend",
        "scripts": {
            "test": "vitest run",
            "typecheck": "tsc --noEmit",
            "coverage": "vitest run --coverage",
            "build": "tsup",
        },
    },
    "dashboard": {
        "name": "dashboard",
        "scripts": {"test": "vitest run", "build": "tsc --noEmit && vite build"},
    },
}


def workflow(commands):
    steps = "\n".join(
        f"      - name: Step {index}\n        run: {command}"
        for index, command in enumerate(commands, 1)
    )
    return f"""name: Release
on:
  push:
    tags: ['v*']
jobs:
  publish:
    name: Publish Package (npm)
    runs-on: ubuntu-latest
    steps:
{steps}
"""


class ReleaseGatePolicyTests(unittest.TestCase):
    def test_verify_reaches_each_substantive_nested_gate(self):
        self.assertEqual(validate_verify_gate(PACKAGE_MANIFESTS), [])

    def test_verify_rejects_a_missing_nested_gate(self):
        manifests = {
            **PACKAGE_MANIFESTS,
            "@fix-portal/ci-frontend": {
                **PACKAGE_MANIFESTS["@fix-portal/ci-frontend"],
                "scripts": {
                    **PACKAGE_MANIFESTS["@fix-portal/ci-frontend"]["scripts"],
                },
            },
        }
        del manifests["@fix-portal/ci-frontend"]["scripts"]["build"]

        findings = validate_verify_gate(manifests)

        self.assertEqual(findings, ["missing-verify-gate: @fix-portal/ci-frontend:build"])

    def test_verify_rejects_a_present_but_gutted_nested_gate(self):
        manifests = {
            **PACKAGE_MANIFESTS,
            "root": {
                **PACKAGE_MANIFESTS["root"],
                "scripts": {**PACKAGE_MANIFESTS["root"]["scripts"], "lint": "echo ok"},
            },
        }

        findings = validate_verify_gate(manifests)

        self.assertEqual(findings, ["invalid-verify-gate: root:lint"])

    def test_verify_rejects_a_nested_gate_whose_failure_is_ignored(self):
        manifests = {
            **PACKAGE_MANIFESTS,
            "root": {
                **PACKAGE_MANIFESTS["root"],
                "scripts": {
                    **PACKAGE_MANIFESTS["root"]["scripts"],
                    "verify": PACKAGE_MANIFESTS["root"]["scripts"]["verify"].replace(
                        "npm run lint", "npm run lint || true"
                    ),
                },
            },
        }

        findings = validate_verify_gate(manifests)

        self.assertEqual(findings, ["parse-error: unsupported npm run options: npm run lint || true"])

    def test_verify_rejects_a_missing_audit_segment(self):
        manifests = {
            **PACKAGE_MANIFESTS,
            "root": {
                **PACKAGE_MANIFESTS["root"],
                "scripts": {
                    **PACKAGE_MANIFESTS["root"]["scripts"],
                    "verify": PACKAGE_MANIFESTS["root"]["scripts"]["verify"].replace(
                        "npm audit --omit=dev --audit-level=high && ", ""
                    ),
                },
            },
        }

        findings = validate_verify_gate(manifests)

        self.assertEqual(findings, ["missing-verify-audit: npm audit --omit=dev --audit-level=high"])

    def test_accepts_the_complete_ordered_release_gate(self):
        self.assertEqual(validate_release_gate(workflow(REQUIRED_COMMANDS)), [])

    def test_reports_each_missing_command_independently(self):
        for removed in REQUIRED_COMMANDS:
            with self.subTest(removed=removed):
                missing = workflow([command for command in REQUIRED_COMMANDS if command != removed])
                self.assertNotIn(f"run: {removed}", missing)

                findings = validate_release_gate(missing)

                self.assertEqual(findings, [f"missing-command: {removed}"])
                self.assertFalse(any(finding.startswith("publish-before-verification:") for finding in findings))

    def test_reports_publish_before_verification_independently(self):
        reordered = [*REQUIRED_COMMANDS]
        publish = reordered.pop()
        reordered.insert(-1, publish)
        malformed = workflow(reordered)
        self.assertLess(malformed.index(publish), malformed.index("npm run test:container"))

        findings = validate_release_gate(malformed)

        self.assertEqual(len(findings), 1)
        self.assertTrue(findings[0].startswith("publish-before-verification:"), findings)

    def test_rejects_an_always_condition_on_publish(self):
        guarded_publish = workflow(REQUIRED_COMMANDS).replace(
            "        run: npm publish --provenance -w @fix-portal/ci-frontend",
            "        if: always()\n        run: npm publish --provenance -w @fix-portal/ci-frontend",
        )

        findings = validate_release_gate(guarded_publish)

        self.assertEqual(findings, ["conditional-command: npm publish --provenance -w @fix-portal/ci-frontend"])

    def test_rejects_continue_on_error_on_verification(self):
        tolerated_verification = workflow(REQUIRED_COMMANDS).replace(
            "        run: npm run verify",
            "        continue-on-error: true\n        run: npm run verify",
        )

        findings = validate_release_gate(tolerated_verification)

        self.assertEqual(findings, ["conditional-command: npm run verify"])

    def test_rejects_publish_when_a_non_command_step_follows_it(self):
        publish_not_last = workflow(REQUIRED_COMMANDS).replace(
            "        run: npm publish --provenance -w @fix-portal/ci-frontend",
            "        run: npm publish --provenance -w @fix-portal/ci-frontend\n      - uses: actions/cache@v4",
        )

        findings = validate_release_gate(publish_not_last)

        self.assertEqual(len(findings), 1)
        self.assertTrue(findings[0].startswith("publish-before-verification:"), findings)

    def test_fails_closed_when_the_workflow_shape_cannot_be_parsed(self):
        findings = validate_release_gate("name: Release\njobs: {}\n")

        self.assertEqual(len(findings), 1)
        self.assertTrue(findings[0].startswith("parse-error:"), findings)

    def test_fails_closed_on_mixed_step_sequence_shape(self):
        malformed = workflow(REQUIRED_COMMANDS).replace("    steps:\n", "    steps:\n      bogus: true\n")
        self.assertIn("\n      bogus: true\n      - name:", malformed)

        findings = validate_release_gate(malformed)

        self.assertEqual(len(findings), 1)
        self.assertTrue(findings[0].startswith("parse-error:"), findings)


if __name__ == "__main__":
    unittest.main()
