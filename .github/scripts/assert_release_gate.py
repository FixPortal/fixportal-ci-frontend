#!/usr/bin/env python3
"""Fail unless the npm publish step is dominated by the complete release gate."""

import sys

import yaml


REQUIRED_COMMANDS = (
    "node scripts/release-tag.mjs",
    "npm run verify",
    "npx playwright install --with-deps chromium",
    "npm run test:e2e",
    "npm run test:package",
    "npm run test:container",
    "npm publish --provenance -w @fix-portal/ci-frontend",
)


class WorkflowShapeError(ValueError):
    pass


def _mapping(value, key):
    if not isinstance(value, dict) or not isinstance(value.get(key), dict):
        raise WorkflowShapeError(f"'{key}' mapping not found")
    return value[key]


def _publish_steps(workflow):
    document = yaml.safe_load(workflow)
    jobs = _mapping(document, "jobs")
    publish = _mapping(jobs, "publish")
    steps = publish.get("steps")
    if not isinstance(steps, list) or not steps:
        raise WorkflowShapeError("publish steps are not a non-empty YAML sequence")

    commands = []
    for step in steps:
        if not isinstance(step, dict):
            raise WorkflowShapeError("publish steps contain a non-mapping entry")
        if "run" not in step:
            commands.append((None, False))
            continue
        command = step["run"]
        if not isinstance(command, str) or not command.strip():
            raise WorkflowShapeError("a publish run command is empty or not a string")
        commands.append((command.strip(), "if" in step or "continue-on-error" in step))
    return commands


def validate_release_gate(workflow):
    try:
        steps = _publish_steps(workflow)
    except (WorkflowShapeError, yaml.YAMLError) as error:
        return [f"parse-error: {error}"]

    step_commands = [command for command, _ in steps]
    commands = [command for command in step_commands if command is not None]
    missing = [command for command in REQUIRED_COMMANDS if command not in commands]
    if missing:
        return [f"missing-command: {command}" for command in missing]

    positions = [step_commands.index(command) for command in REQUIRED_COMMANDS]
    counts = [step_commands.count(command) for command in REQUIRED_COMMANDS]
    if positions != sorted(positions) or any(count != 1 for count in counts) or positions[-1] != len(steps) - 1:
        return ["publish-before-verification: required commands must run once in order and npm publish must be the final step"]

    conditional = next((command for command, has_metadata in steps if command in REQUIRED_COMMANDS and has_metadata), None)
    if conditional:
        return [f"conditional-command: {conditional}"]
    return []


def main(argv):
    if len(argv) != 2:
        print("usage: assert_release_gate.py <workflow-file>", file=sys.stderr)
        return 2
    try:
        with open(argv[1], encoding="utf-8") as handle:
            workflow = handle.read()
    except OSError as error:
        print(f"{argv[1]}: parse-error: {error}", file=sys.stderr)
        return 1

    findings = validate_release_gate(workflow)
    if findings:
        for finding in findings:
            print(f"{argv[1]}: {finding}", file=sys.stderr)
        return 1
    print(f"{argv[1]}: npm publish is dominated by the complete release gate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
