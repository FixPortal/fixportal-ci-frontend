#!/usr/bin/env python3
"""Fail unless the npm publish step is dominated by the complete release gate."""

import json
import sys
from pathlib import Path

import yaml


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

REQUIRED_VERIFY_AUDIT = "npm audit --omit=dev --audit-level=high"
REQUIRED_CI_WORKFLOW = "./.github/workflows/ci.yml"
REQUIRED_VERIFY_GATES = {
    "root:lint": "eslint .",
    "@fix-portal/ci-frontend:test": "vitest run",
    "dashboard:test": "vitest run",
    "root:test:scripts": "node --test scripts/*.test.mjs",
    "@fix-portal/ci-frontend:typecheck": "tsc --noEmit",
    "@fix-portal/ci-frontend:coverage": "vitest run --coverage",
    "@fix-portal/ci-frontend:build": "tsup",
    "dashboard:build": "tsc --noEmit && vite build",
}


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


def validate_release_dependency(workflow):
    try:
        document = yaml.safe_load(workflow)
        jobs = _mapping(document, "jobs")
        quality = _mapping(jobs, "quality")
        publish = _mapping(jobs, "publish")
    except (WorkflowShapeError, yaml.YAMLError) as error:
        return [f"parse-error: {error}"]

    if quality.get("uses") != REQUIRED_CI_WORKFLOW:
        return [f"invalid-quality-workflow: expected {REQUIRED_CI_WORKFLOW}"]
    if "continue-on-error" in quality:
        return ["tolerated-quality-job: quality must not tolerate CI failures"]

    needs = publish.get("needs")
    dependencies = [needs] if isinstance(needs, str) else needs
    if not isinstance(dependencies, list) or "quality" not in dependencies:
        return ["missing-quality-dependency: publish must need quality"]
    if "if" in publish or "continue-on-error" in publish:
        return ["conditional-publish-job: publish must not bypass a failed quality job"]
    return []


def _npm_script_targets(command, manifests):
    tokens = command.split()
    if tokens[:2] != ["npm", "run"]:
        return []
    if len(tokens) < 3:
        raise WorkflowShapeError(f"invalid npm run command: {command}")

    script = tokens[2]
    options = tokens[3:]
    if "--workspaces" in options:
        if options != ["--workspaces", "--if-present"]:
            raise WorkflowShapeError(f"unsupported npm run options: {command}")
        return [(name, script) for name in manifests if name != "root" and script in manifests[name]["scripts"]]
    if "-w" in options:
        index = options.index("-w")
        if index != 0 or len(options) != 2:
            raise WorkflowShapeError(f"unsupported npm run options: {command}")
        return [(options[index + 1], script)]
    if options:
        raise WorkflowShapeError(f"unsupported npm run options: {command}")
    return [("root", script)]


def validate_verify_gate(manifests):
    reached = set()
    visiting = set()

    def visit(package, script):
        gate = f"{package}:{script}"
        if gate in visiting:
            raise WorkflowShapeError(f"recursive npm script: {gate}")

        package_manifest = manifests.get(package)
        scripts = package_manifest.get("scripts") if isinstance(package_manifest, dict) else None
        command = scripts.get(script) if isinstance(scripts, dict) else None
        if not isinstance(command, str) or not command.strip():
            return

        reached.add(gate)
        visiting.add(gate)
        for segment in command.split("&&"):
            segment = segment.strip()
            if not segment:
                raise WorkflowShapeError(f"empty command segment in {gate}")
            for target_package, target_script in _npm_script_targets(segment, manifests):
                visit(target_package, target_script)
        visiting.remove(gate)

    try:
        visit("root", "verify")
    except WorkflowShapeError as error:
        return [f"parse-error: {error}"]

    root_scripts = manifests.get("root", {}).get("scripts", {})
    verify = root_scripts.get("verify") if isinstance(root_scripts, dict) else None
    segments = verify.split("&&") if isinstance(verify, str) else []
    findings = []
    if REQUIRED_VERIFY_AUDIT not in (segment.strip() for segment in segments):
        findings.append(f"missing-verify-audit: {REQUIRED_VERIFY_AUDIT}")

    for gate, expected_command in REQUIRED_VERIFY_GATES.items():
        if gate not in reached:
            findings.append(f"missing-verify-gate: {gate}")
            continue
        package, script = ("root", gate.removeprefix("root:")) if gate.startswith("root:") else gate.split(":", 1)
        command = manifests[package]["scripts"][script]
        if command != expected_command:
            findings.append(f"invalid-verify-gate: {gate}")
    return findings


def load_package_manifests(root_package_path):
    root_path = Path(root_package_path)
    with root_path.open(encoding="utf-8") as handle:
        root = json.load(handle)
    workspaces = root.get("workspaces")
    if not isinstance(workspaces, list) or not all(isinstance(pattern, str) for pattern in workspaces):
        raise WorkflowShapeError("root package workspaces must be a string list")

    manifests = {"root": root}
    for pattern in workspaces:
        for package_path in root_path.parent.glob(f"{pattern}/package.json"):
            with package_path.open(encoding="utf-8") as handle:
                package = json.load(handle)
            name = package.get("name")
            if not isinstance(name, str) or not name or name in manifests:
                raise WorkflowShapeError(f"invalid workspace package name in {package_path}")
            manifests[name] = package
    return manifests


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

    try:
        manifests = load_package_manifests("package.json")
    except (OSError, ValueError, WorkflowShapeError) as error:
        print(f"package.json: parse-error: {error}", file=sys.stderr)
        return 1

    findings = [
        *validate_release_gate(workflow),
        *validate_release_dependency(workflow),
        *validate_verify_gate(manifests),
    ]
    if findings:
        for finding in findings:
            print(f"{argv[1]}: {finding}", file=sys.stderr)
        return 1
    print(f"{argv[1]}: npm publish is dominated by the complete release gate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
