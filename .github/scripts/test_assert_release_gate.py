#!/usr/bin/env python3
import unittest

from assert_release_gate import validate_release_gate


REQUIRED_COMMANDS = (
    "node scripts/release-tag.mjs",
    "npm run verify",
    "npx playwright install --with-deps chromium",
    "npm run test:e2e",
    "npm run test:package",
    "npm run test:container",
    "npm publish --provenance -w @fix-portal/ci-frontend",
)


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
    def test_accepts_the_complete_ordered_release_gate(self):
        self.assertEqual(validate_release_gate(workflow(REQUIRED_COMMANDS)), [])

    def test_reports_the_missing_command_rule_independently(self):
        missing = workflow([command for command in REQUIRED_COMMANDS if command != "npm run test:package"])
        self.assertNotIn("npm run test:package", missing)

        findings = validate_release_gate(missing)

        self.assertEqual(len(findings), 1)
        self.assertTrue(findings[0].startswith("missing-command:"), findings)

    def test_reports_publish_before_verification_independently(self):
        reordered = [*REQUIRED_COMMANDS]
        publish = reordered.pop()
        reordered.insert(-1, publish)
        malformed = workflow(reordered)
        self.assertLess(malformed.index(publish), malformed.index("npm run test:container"))

        findings = validate_release_gate(malformed)

        self.assertEqual(len(findings), 1)
        self.assertTrue(findings[0].startswith("publish-before-verification:"), findings)

    def test_fails_closed_when_the_workflow_shape_cannot_be_parsed(self):
        findings = validate_release_gate("name: Release\njobs: {}\n")

        self.assertEqual(len(findings), 1)
        self.assertTrue(findings[0].startswith("parse-error:"), findings)


if __name__ == "__main__":
    unittest.main()
