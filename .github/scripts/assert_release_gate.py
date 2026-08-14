#!/usr/bin/env python3
"""Fail unless the npm publish step is dominated by the complete release gate."""

import sys


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


def _indent(line):
    if line.startswith("\t"):
        raise WorkflowShapeError("tab indentation is unsupported")
    return len(line) - len(line.lstrip(" "))


def _content(line):
    return line.lstrip(" ")


def _is_ignored(line):
    stripped = line.strip()
    return not stripped or stripped.startswith("#")


def _mapping_block(lines, key, start, end, parent_indent):
    child_indents = [_indent(line) for line in lines[start:end] if not _is_ignored(line) and _indent(line) > parent_indent]
    if not child_indents:
        raise WorkflowShapeError(f"'{key}' mapping not found")
    child_indent = min(child_indents)
    target = f"{key}:"
    matches = [
        index
        for index in range(start, end)
        if not _is_ignored(lines[index])
        and _indent(lines[index]) == child_indent
        and _content(lines[index]).split("#", 1)[0].rstrip() == target
    ]
    if len(matches) != 1:
        raise WorkflowShapeError(f"expected one '{key}' mapping, found {len(matches)}")
    index = matches[0]
    block_end = end
    for candidate in range(index + 1, end):
        if not _is_ignored(lines[candidate]) and _indent(lines[candidate]) <= child_indent:
            block_end = candidate
            break
    return index + 1, block_end, child_indent


def _step_blocks(lines, start, end, steps_indent):
    item_indents = [_indent(line) for line in lines[start:end] if not _is_ignored(line) and _indent(line) > steps_indent]
    if not item_indents:
        raise WorkflowShapeError("publish steps are empty")
    item_indent = min(item_indents)
    peers = [
        index
        for index in range(start, end)
        if not _is_ignored(lines[index]) and _indent(lines[index]) == item_indent
    ]
    starts = [
        index
        for index in peers
        if _content(lines[index]) == "-" or _content(lines[index]).startswith("- ")
    ]
    if len(starts) != len(peers):
        invalid = next(index for index in peers if index not in starts)
        raise WorkflowShapeError(f"publish steps contain a non-sequence entry at line {invalid + 1}")
    if not starts:
        raise WorkflowShapeError("publish steps are not a YAML sequence")
    blocks = []
    for offset, index in enumerate(starts):
        block_end = starts[offset + 1] if offset + 1 < len(starts) else end
        blocks.append((index, block_end, item_indent))
    return blocks


def _run_command(lines, start, end, item_indent):
    candidates = []
    first = _content(lines[start])[1:].lstrip()
    if first.startswith("run:"):
        candidates.append((start, item_indent + 2, first[4:].strip()))

    field_indents = [_indent(line) for line in lines[start + 1 : end] if not _is_ignored(line) and _indent(line) > item_indent]
    if field_indents:
        field_indent = min(field_indents)
        for index in range(start + 1, end):
            if _is_ignored(lines[index]) or _indent(lines[index]) != field_indent:
                continue
            content = _content(lines[index])
            if content.startswith("run:"):
                candidates.append((index, field_indent, content[4:].strip()))

    if not candidates:
        return None
    if len(candidates) != 1:
        raise WorkflowShapeError("a publish step contains multiple run fields")

    index, run_indent, scalar = candidates[0]
    if scalar in {"|", "|-", "|+", ">", ">-", ">+"}:
        body = [line for line in lines[index + 1 : end] if not _is_ignored(line) and _indent(line) > run_indent]
        if not body:
            raise WorkflowShapeError("a publish run block is empty")
        body_indent = min(_indent(line) for line in body)
        separator = "\n" if scalar.startswith("|") else " "
        return separator.join(line[body_indent:].rstrip() for line in body).strip()
    if not scalar:
        raise WorkflowShapeError("a publish run command is empty")
    return scalar


def _publish_steps(workflow):
    lines = workflow.splitlines()
    jobs_start, jobs_end, jobs_indent = _mapping_block(lines, "jobs", 0, len(lines), -1)
    publish_start, publish_end, publish_indent = _mapping_block(lines, "publish", jobs_start, jobs_end, jobs_indent)
    steps_start, steps_end, steps_indent = _mapping_block(lines, "steps", publish_start, publish_end, publish_indent)
    return [_run_command(lines, *block) for block in _step_blocks(lines, steps_start, steps_end, steps_indent)]


def validate_release_gate(workflow):
    try:
        steps = _publish_steps(workflow)
    except WorkflowShapeError as error:
        return [f"parse-error: {error}"]

    missing = [command for command in REQUIRED_COMMANDS if command not in steps]
    if missing:
        return [f"missing-command: {command}" for command in missing]

    positions = [steps.index(command) for command in REQUIRED_COMMANDS]
    counts = [steps.count(command) for command in REQUIRED_COMMANDS]
    if positions != sorted(positions) or any(count != 1 for count in counts) or positions[-1] != len(steps) - 1:
        return ["publish-before-verification: required commands must run once in order and npm publish must be the final step"]
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
