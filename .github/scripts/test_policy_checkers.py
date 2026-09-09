#!/usr/bin/env python3
"""Regression tests for the repository's merge-barrier policy checkers."""

import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GATE_CHECKER = ROOT / ".github" / "scripts" / "assert_gate_coverage.py"
HYGIENE_CHECKER = ROOT / ".github" / "scripts" / "assert_workflow_hygiene.py"
COMPLETE_CONDITION = "needs.build.result != 'success'"


def run_gate(condition: str, run_header: str, body: str) -> subprocess.CompletedProcess[str]:
    workflow = textwrap.dedent(
        f"""\
        jobs:
          build:
            runs-on: ubuntu-latest
          ci-gate:
            if: always()
            needs: [build]
            runs-on: ubuntu-latest
            steps:
              - if: {condition}
                run: {run_header}
        """
    ) + textwrap.indent(textwrap.dedent(body), " " * 10)
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "ci.yml"
        path.write_text(workflow, encoding="utf-8")
        env = os.environ.copy()
        for name in ("GATE_EXEMPT", "GATE_CONDITIONAL_EXEMPT", "GATE_FILE_EXEMPT"):
            env.pop(name, None)
        return subprocess.run(
            [sys.executable, str(GATE_CHECKER), str(path)],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )


class GateCoverageTests(unittest.TestCase):
    def test_documented_compound_failures_allow_redirection(self):
        bodies = (
            'echo "bad"; exit 1 >&2',
            'if [ -n "$x" ]; then echo "bad"; exit 1 >&2; fi',
            'if [ -n "$x" ]; then exit 1 >&2; fi',
        )
        for body in bodies:
            with self.subTest(body=body):
                result = run_gate(COMPLETE_CONDITION, "|", body)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_escaped_quote_outside_a_string_does_not_hide_the_exit(self):
        result = run_gate(COMPLETE_CONDITION, "|", r'echo \"; exit 1')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_shell_parameter_length_is_not_stripped_as_a_comment(self):
        result = run_gate(
            COMPLETE_CONDITION,
            "|",
            'if [ ${#x} -eq 0 ]; then exit 1; fi',
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_impossible_result_condition_is_rejected(self):
        result = run_gate(
            "${{ false && contains(needs.*.result, 'failure') }}",
            "|",
            "exit 1",
        )
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_supported_result_conditions_are_accepted(self):
        conditions = (
            "contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')",
            "needs.build.result != 'success'",
        )
        for condition in conditions:
            with self.subTest(condition=condition):
                result = run_gate(condition, "|", "exit 1")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_each_dependency_must_cover_failure_and_cancellation(self):
        conditions = (
            "contains(needs.*.result, 'failure')",
            "contains(needs.*.result, 'cancelled')",
        )
        for condition in conditions:
            with self.subTest(condition=condition):
                result = run_gate(condition, "|", "exit 1")
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_folded_run_body_is_rejected(self):
        result = run_gate(
            COMPLETE_CONDITION,
            ">",
            "echo gate\nexit 1",
        )
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_exit_status_wrapping_to_zero_is_rejected(self):
        accepted = run_gate(COMPLETE_CONDITION, "|", "exit 255")
        self.assertEqual(accepted.returncode, 0, accepted.stdout + accepted.stderr)
        result = run_gate(COMPLETE_CONDITION, "|", "exit 256")
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)


class WorkflowHygieneTests(unittest.TestCase):
    def test_local_docker_action_image_must_be_pinned(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workflows = root / ".github" / "workflows"
            action = root / ".github" / "actions" / "local"
            workflows.mkdir(parents=True)
            action.mkdir(parents=True)
            (workflows / "ci.yml").write_text(
                textwrap.dedent(
                    """\
                    on: push
                    permissions: {}
                    jobs:
                      test:
                        runs-on: ubuntu-latest
                        steps:
                          - uses: ./.github/actions/local
                    """
                ),
                encoding="utf-8",
            )
            (action / "action.yml").write_text(
                textwrap.dedent(
                    """\
                    name: Local Docker action
                    runs:
                      using: docker
                      image: docker://alpine:latest
                    """
                ),
                encoding="utf-8",
            )
            result = subprocess.run(
                [sys.executable, str(HYGIENE_CHECKER)],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn("docker://alpine:latest", result.stdout)


if __name__ == "__main__":
    unittest.main()
