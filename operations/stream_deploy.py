#!/usr/bin/env python3
"""Stream a verified static build to the restricted receiver; no archive file."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

MAX_FILES = 3000
MAX_BYTES = 200 * 1024 * 1024
MAX_HEADER = 1024 * 1024
CORE = {'index.html', 'app.js', 'model.mjs', 'pdf.mjs', 'styles.css', 'content.json', 'robots.txt'}
PREFIXES = {'assets', 'fonts', 'vendor'}


def valid_path(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]{0,239}', value):
        return False
    parts = value.split('/')
    if any(not part or part.startswith('.') for part in parts):
        return False
    return value in CORE or (len(parts) > 1 and parts[0] in PREFIXES)


def manifest_for(root, commit):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('commit must be 40 lowercase hexadecimal characters')
    root = Path(root)
    if not root.is_dir() or root.is_symlink():
        raise ValueError('build directory must be a real directory')
    entries = []
    total = 0
    for directory, dirs, files in os.walk(root, followlinks=False):
        for name in dirs:
            if (Path(directory) / name).is_symlink():
                raise ValueError('symlink directories are not allowed')
        for name in files:
            path = Path(directory) / name
            metadata = path.lstat()
            relative = path.relative_to(root).as_posix()
            if not stat.S_ISREG(metadata.st_mode) or not valid_path(relative):
                raise ValueError('unsupported build path: ' + relative)
            digest = hashlib.sha256()
            with path.open('rb') as file:
                for chunk in iter(lambda: file.read(1024 * 1024), b''):
                    digest.update(chunk)
            entries.append({'path': relative, 'size': metadata.st_size, 'sha256': digest.hexdigest()})
            total += metadata.st_size
    entries.sort(key=lambda entry: entry['path'])
    if not CORE.issubset({entry['path'] for entry in entries}):
        raise ValueError('build is missing required core files')
    if len(entries) > MAX_FILES or total > MAX_BYTES:
        raise ValueError('build exceeds deployment limits')
    manifest = {'schema': 1, 'commit': commit, 'files': entries}
    encoded = json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode('utf-8') + b'\n'
    if len(encoded) > MAX_HEADER:
        raise ValueError('manifest exceeds deployment limit')
    return manifest, encoded


def stream(root, commit, output, manifest_sha256_output=None):
    root = Path(root)
    manifest, encoded = manifest_for(root, commit)
    if manifest_sha256_output is not None:
        Path(manifest_sha256_output).write_text(hashlib.sha256(encoded[:-1]).hexdigest() + '\n', encoding='ascii')
    output.write(encoded)
    for entry in manifest['files']:
        digest = hashlib.sha256()
        count = 0
        with (root / entry['path']).open('rb') as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b''):
                output.write(chunk)
                digest.update(chunk)
                count += len(chunk)
        if count != entry['size'] or digest.hexdigest() != entry['sha256']:
            raise ValueError('build changed while streaming')
    output.flush()


if __name__ == '__main__':
    try:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument('dist')
        parser.add_argument('commit')
        parser.add_argument('--manifest-sha256-output')
        arguments = parser.parse_args()
        stream(arguments.dist, arguments.commit, sys.stdout.buffer, arguments.manifest_sha256_output)
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
