"""Regression coverage for optional payload records and release API access."""
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import update_release
import validate


ROOT = Path(__file__).resolve().parent


class PayloadPackagingTests(unittest.TestCase):
    def package(self, root, with_records):
        payload = root / 'manatan'
        payload.mkdir()
        for name in ('Manatan', 'manatan-helper'):
            (payload / name).write_text('#!/bin/sh\nexit 0\n')
        for name in ('manatan-flatpak', 'manatan-flatpak-helper',
                     'io.github.kolbyml.Manatan.desktop', 'io.github.kolbyml.Manatan.metainfo.xml',
                     'io.github.kolbyml.Manatan.png', 'LICENSE.manatan'):
            (root / name).write_text(name)
        if with_records:
            records = payload / 'share/licenses/manatan-media'
            records.mkdir(parents=True)
            (records / 'sources.txt').write_text('existing source records\n')
            (records / 'NOTICE').write_text('existing notices\n')
        module = validate.manifest_module(
            (ROOT / 'io.github.kolbyml.Manatan.yml').read_text(), 'manatan')
        commands = re.findall(r'^      - (.+)$', module.split('    sources:\n')[0], re.MULTILINE)
        self.assertGreaterEqual(len(commands), 8)
        destination = root / 'app'
        environment = dict(os.environ, FLATPAK_DEST=str(destination), FLATPAK_ID=validate.APP_ID)
        for command in commands:
            # Payload staging is portable; later wrapper installs require GNU install.
            if command.startswith('install -Dm'):
                break
            subprocess.run(['/bin/sh', '-ec', command], cwd=root, env=environment,
                           check=True, capture_output=True)
        self.assertTrue(os.access(destination / 'lib/manatan/Manatan', os.X_OK))
        self.assertTrue(os.access(destination / 'lib/manatan/manatan-helper', os.X_OK))
        return destination

    def test_payload_without_optional_source_record_is_packaged(self):
        with tempfile.TemporaryDirectory() as directory:
            self.package(Path(directory), False)

    def test_existing_records_and_notices_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = self.package(Path(directory), True)
            records = destination / 'lib/manatan/share/licenses/manatan-media'
            self.assertEqual((records / 'sources.txt').read_text(), 'existing source records\n')
            self.assertEqual((records / 'NOTICE').read_text(), 'existing notices\n')


class ReleaseApiTests(unittest.TestCase):
    def headers(self, url, environment):
        with patch.dict(os.environ, environment, clear=True), \
                patch.object(update_release.urllib.request, 'urlopen') as opened:
            opened.return_value.__enter__.return_value.read.return_value = b'{}'
            self.assertEqual(update_release.fetch(url), b'{}')
            request = opened.call_args.args[0]
            self.assertEqual(opened.call_args.kwargs['timeout'], 60)
            return request

    def test_github_api_uses_workflow_token(self):
        request = self.headers('https://api.github.com/repos/KolbyML/Manatan/releases/latest',
                               {'GH_TOKEN': 'test-workflow-token'})
        self.assertEqual(request.get_header('Authorization'), 'Bearer test-workflow-token')

    def test_github_token_fallback(self):
        request = self.headers('https://api.github.com/repos/KolbyML/Manatan/releases/latest',
                               {'GITHUB_TOKEN': 'test-fallback-token'})
        self.assertEqual(request.get_header('Authorization'), 'Bearer test-fallback-token')

    def test_token_is_not_sent_to_asset_or_other_origins(self):
        for url in ('https://github.com/KolbyML/Manatan/releases/download/v1/Checksums.sha256',
                    'https://release-assets.githubusercontent.com/file',
                    'https://api.github.com.example.invalid/file', 'http://api.github.com/file'):
            with self.subTest(url=url):
                self.assertIsNone(self.headers(url, {'GH_TOKEN': 'test-workflow-token'})
                                  .get_header('Authorization'))

    def test_unauthenticated_local_use_still_works(self):
        self.assertIsNone(self.headers('https://api.github.com/repos/KolbyML/Manatan/releases/latest', {})
                          .get_header('Authorization'))


if __name__ == '__main__':
    unittest.main()
