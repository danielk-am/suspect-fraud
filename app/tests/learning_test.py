"""Boundary tests for screenshot OCR and opt-in model data.

protects=private evidence and worker bounds; fails_when=unconsented data or
unsupported images reach processing; why_new=first evidence worker.
"""
import base64
import importlib.util
import io
import pathlib
import subprocess
import sys
import tempfile
import json
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

def load_file(name, path):
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class EvidenceBounds(unittest.TestCase):
    def setUp(self):
        self.ocr = load_file('ocr_worker', ROOT / 'workers/ocr/worker.py')
        self.assertIsNotNone(self.ocr, 'Screenshot boundary is not implemented')

    def test_rejects_mime_and_file_disagreement(self):
        from PIL import Image
        image = io.BytesIO()
        Image.new('RGB', (30, 30), 'white').save(image, format='PNG')
        with self.assertRaises(ValueError):
            self.ocr.decode_image({'imageBase64': base64.b64encode(image.getvalue()).decode(), 'mimeType': 'image/jpeg'})

    def test_rejects_svg_archive_and_unknown_fields(self):
        for data in [
            {'imageBase64': base64.b64encode(b'<svg/>').decode(), 'mimeType': 'image/svg+xml'},
            {'imageBase64': base64.b64encode(b'PK\x03\x04archive').decode(), 'mimeType': 'image/png'},
            {'imageBase64': 'a', 'mimeType': 'image/png', 'command': 'echo bad'},
        ]:
            with self.assertRaises(ValueError):
                self.ocr.decode_image(data)

    def test_rejects_oversize_and_pixel_bomb(self):
        from PIL import Image
        image = io.BytesIO()
        Image.new('1', (5000, 5000), 1).save(image, format='PNG')
        for encoded in ['A' * ((8 * 1024 * 1024 + 2) // 3 * 4 + 4), base64.b64encode(image.getvalue()).decode()]:
            with self.assertRaises(ValueError):
                self.ocr.decode_image({'imageBase64': encoded, 'mimeType': 'image/png'})

    def test_accepts_png_and_strips_metadata(self):
        from PIL import Image, PngImagePlugin
        image = io.BytesIO()
        meta = PngImagePlugin.PngInfo()
        meta.add_text('source-secret', 'PRIVATE METADATA')
        Image.new('RGB', (30, 30), 'white').save(image, format='PNG', pnginfo=meta)
        cleaned, digest = self.ocr.decode_image({'imageBase64': base64.b64encode(image.getvalue()).decode(), 'mimeType': 'image/png'})
        self.assertEqual(len(digest), 64)
        self.assertNotIn(b'PRIVATE METADATA', cleaned)


class TrainingPrivacy(unittest.TestCase):
    def setUp(self):
        self.data = load_file('training_data', ROOT / 'training/data.py')
        self.assertIsNotNone(self.data, 'Opt-in dataset boundary is not implemented')
        self.record = dict(exampleId='e1', caseId='c1', campaignId='campaign1', source='Synthetic fixture', createdAt='2026-11-06T00:00:00Z', consent=True, redactionApproved=True, text='A recruiter asks for a deposit to unlock work.', label='suspected_scam')

    def test_requires_separate_consent_and_redaction(self):
        for key in ['consent', 'redactionApproved']:
            for value in [False, None, 'true', 1]:
                record = {**self.record, key: value}
                with self.assertRaises(ValueError):
                    self.data.validate_record(record)

    def test_rejects_identifiers_and_secrets_in_redacted_copy(self):
        for text in ['Contact person@example.com', 'phone +65 8123 4567', 'password:abc123456', 'api_key=some-secret-value']:
            with self.assertRaises(ValueError):
                self.data.validate_record({**self.record, 'text': text})

    def test_rejects_sensitive_details_in_provenance(self):
        with self.assertRaises(ValueError):
            self.data.validate_record({**self.record, 'source': 'Private mail person@example.com'})

    def test_pseudonymous_ids_allow_numeric_uuid_prefix_but_not_phone(self):
        self.data.validate_record({**self.record, 'exampleId': '12345678-abcd-4321-9876-abcdef123456'})
        with self.assertRaises(ValueError):
            self.data.validate_record({**self.record, 'caseId': '81234567'})

    def test_grouped_split_never_shares_campaign(self):
        records = [{**self.record, 'exampleId': f'e{i}', 'campaignId': f'g{i//2}', 'text': f'Synthetic example number {i} about a generic opportunity.'} for i in range(16)]
        train, valid = self.data.split_by_campaign(records, seed=17)
        self.assertTrue(train and valid)
        self.assertFalse({r['campaignId'] for r in train} & {r['campaignId'] for r in valid})

    def test_duplicate_content_across_campaigns_is_rejected(self):
        records = [self.record, {**self.record, 'exampleId': 'e2', 'campaignId': 'different'}]
        with self.assertRaises(ValueError):
            self.data.split_by_campaign(records, seed=17)


class TrainingSmoke(unittest.TestCase):
    def test_offline_training_emits_traceable_artifacts_without_examples(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, str(ROOT / 'training/train.py'), '--data', str(ROOT / 'training/synthetic.jsonl'), '--out', directory, '--synthetic-smoke'], capture_output=True, text=True, timeout=90)
            self.assertEqual(result.returncode, 0, result.stderr)
            output = pathlib.Path(directory)
            metrics = json.loads((output / 'metrics.json').read_text())
            self.assertEqual(metrics['evaluationStatus'], 'NEEDS_EVIDENCE')
            self.assertFalse(set(metrics['split']['trainingCampaigns']) & set(metrics['split']['validationCampaigns']))
            self.assertEqual(metrics['validation']['count'], 6)
            self.assertEqual(sum(metrics['validation']['confusion'].values()), 6)
            self.assertTrue((output / 'model.pt').is_file())
            self.assertNotIn('A recruiter', (output / 'metrics.json').read_text())


if __name__ == '__main__':
    unittest.main()
